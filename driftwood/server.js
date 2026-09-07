#!/usr/bin/env node
// DRIFTWOOD dedicated server — runs the island simulation headless and serves the game itself.
//
//   node server.js                       # island on port 7777, random seed
//   node server.js --port 8080 --seed REEF --name "Brody's island" --password secret --max 6
//
// Players connect by address (Join a friend → Server address), or simply open http://<your-ip>:7777/ in a browser:
// the page served here has the address filled in already. For friends outside your network, forward the port on your
// router (or use a tunnel such as `cloudflared tunnel --url http://localhost:7777`) and share the public address.
// Node 18+ and no dependencies. Requires the game files next to it (js/, index.html, ...) or dist/driftwood.html.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { createServer, lanAddresses } = require('./wsserver.js');

const args = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[++i] : 'true'; args[k] = v; } }
if (args.help || args.h) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 10).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
const PORT = +(args.port || process.env.PORT || 7777), MAX = +(args.max || 8), PASSWORD = args.password || '', NAME = args.name || 'Driftwood server';
let seed = args.seed || '';

// ---- load the game rules into this process (they are browser scripts attached to window.G) ----
const root = __dirname;
global.window = global; window.G = window.G || {};
if (typeof performance === 'undefined') global.performance = require('perf_hooks').performance;
for (const f of ['util', 'data', 'world', 'sim', 'enemies']) vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
const G = window.G, Sim = G.Sim;

// ---- game state ----
const STEP = 1 / 30, BCAST = 1 / 15;
let S = null, acc = 0, lastB = 0, endedAt = 0;
const clients = {}; let nextId = 1;
const randomSeed = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
function newIsland(why) {
  S = Sim.create(seed || randomSeed()); acc = 0; endedAt = 0;
  log(why + ' — island ' + S.world.seed);
  for (const id in clients) { const c = clients[id]; if (c.hello) { addPlayer(id, c.hello); c.send({ t: 'welcome', id, seed: S.world.seed, snap: Sim.snapshot(S, true) }); c.send({ t: 'start' }); } }
  seed = ''; // the seed argument applies to the first island only; later islands are random
}
function addPlayer(id, h) {
  Sim.addPlayer(S, id, String(h.name || 'Castaway').slice(0, 14), typeof h.col === 'string' ? h.col.slice(0, 9) : '#ffffff', G.CLASSES.some(c => c.id === h.cls) ? h.cls : 'castaway', (h.meta && typeof h.meta === 'object') ? h.meta : {}, typeof h.hat === 'string' ? h.hat : 'none', typeof h.skin === 'string' ? h.skin : 'happy');
}
const log = (s) => console.log(new Date().toISOString().slice(11, 19) + '  ' + s);
const broadcast = (msg) => { const s = JSON.stringify(msg); for (const id in clients) clients[id].ws.send(s); };
function flushEvents() { if (!S.events.length) return; const list = S.events; S.events = []; broadcast({ t: 'ev', list }); }

function onMessage(id, msg) {
  const c = clients[id]; if (!c || !msg || typeof msg !== 'object') return;
  if (msg.t === 'hello') {
    if (c.hello) return;
    if (PASSWORD && msg.pass !== PASSWORD) { c.send({ t: 'kick', reason: 'Wrong server password.' }); c.ws.close(); return; }
    if (Object.keys(S.players).length >= MAX) { c.send({ t: 'kick', reason: 'The server is full (' + MAX + ' players).' }); c.ws.close(); return; }
    c.hello = msg; addPlayer(id, msg);
    c.send({ t: 'welcome', id, seed: S.world.seed, snap: Sim.snapshot(S, true) }); c.send({ t: 'start' });
    log(S.players[id].name + ' joined (' + Object.keys(S.players).length + ' online)');
    flushEvents();
  } else if (msg.t === 'in') Sim.setInput(S, id, msg.in);
  else if (msg.t === 'act') { if (S.players[id]) Sim.action(S, id, msg.a); }
  else if (msg.t === 'ping') c.send({ t: 'pong', k: msg.k });
}

const server = createServer({
  root: fs.existsSync(path.join(root, 'index.html')) ? root : undefined,
  file: fs.existsSync(path.join(root, 'index.html')) ? undefined : path.join(root, 'dist', 'driftwood.html'),
  inject: '<script>window.__SERVER_ADDR = true; window.__SERVER_NAME = ' + JSON.stringify(NAME) + ';</script>',
  health: () => ({ ok: true, name: NAME, players: Object.keys(S.players).length, max: MAX, day: S.day, phase: S.phase, seed: S.world.seed, password: !!PASSWORD }),
  onSocket: (ws, req) => {
    const id = 'c' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 5);
    const c = { id, ws, hello: null, send: (m) => ws.send(JSON.stringify(m)) }; clients[id] = c;
    ws.onmessage = (s) => { let m; try { m = JSON.parse(s); } catch (e) { return; } onMessage(id, m); };
    ws.onclose = () => { delete clients[id]; if (S.players[id]) { log(S.players[id].name + ' left'); Sim.removePlayer(S, id); flushEvents(); } };
  },
});

newIsland('Starting');
let last = performance.now() / 1000;
setInterval(() => {
  const now = performance.now() / 1000; const dt = Math.min(0.25, now - last); last = now;
  const online = Object.keys(S.players).length;
  if (!online) { acc = 0; return; } // the island waits while nobody is on it
  acc += dt; let steps = 0;
  while (acc >= STEP && steps < 8) { Sim.step(S, STEP); Sim.flushChanges(S); acc -= STEP; steps++; }
  if (steps === 8) acc = 0;
  flushEvents();
  if (now - lastB >= BCAST) { lastB = now; broadcast(Sim.snapshot(S, false)); }
  if ((S.phase === 'won' || S.phase === 'lost') && !endedAt) { endedAt = now; log('run over (' + S.phase + ') — new island in 20 s'); }
  if (endedAt && now - endedAt > 20) newIsland('Run over');
}, 1000 / 60);

server.listen(PORT, () => {
  log(NAME + ' listening on port ' + PORT + (PASSWORD ? ' (password protected)' : ''));
  const addrs = lanAddresses(); log('players on your network open:  ' + (addrs.length ? addrs.map(a => 'http://' + a + ':' + PORT + '/').join('  or  ') : 'http://localhost:' + PORT + '/'));
  log('players elsewhere: forward TCP port ' + PORT + ' on your router and share http://<your public IP>:' + PORT + '/  (or a tunnel URL)');
  log('in the game lobby they can also type the address under  Join a friend → Server address');
});
server.on('error', (e) => { console.error('could not listen on port ' + PORT + ': ' + e.message); process.exit(1); });
