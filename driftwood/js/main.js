// DRIFTWOOD — main glue: lobby flow, game loop, host/client sync, first-person camera state
(function (G) {
  'use strict';
  const M = { S: null, V: null, me: null, mode: null, started: false, pending: null, acc: 0, lastB: 0, lastIn: 0, snapPrev: null, snapCur: null, snapT: 0, pred: null, world: null, pingMs: 0, jumpZ: 0, vz: 0, walkT: 0, bob: 0 };
  G.Main = M;
  const STEP = 1 / 30, BCAST = 1 / 15, INRATE = 1 / 20;
  const Sim = G.Sim, Net = G.Net, R = G.Render, UI = G.UI, In = G.Input, A = G.Audio;

  window.addEventListener('DOMContentLoaded', () => {
    UI.init(); R.init(document.getElementById('game'), document.getElementById('overlay'), document.getElementById('minimap')); In.init(document.getElementById('game'));
    if (G.Assets) G.Assets.load();
    In.onAction = onLocalAction; In.onLockChange = onLockChange;
    Net.onMessage = onMessage; Net.onJoin = onJoin; Net.onLeave = onLeave;
    const p = new URLSearchParams(location.search); if (p.get('room')) { document.getElementById('tab-join').click(); document.getElementById('joincode').value = p.get('room').toUpperCase(); }
    requestAnimationFrame(loop);
  });

  // ---------- lobby flows ----------
  function makeHostSim(name, col, seed, opts) {
    if (M.S) return;
    seed = seed || Math.random().toString(36).slice(2, 8).toUpperCase();
    M.S = Sim.create(seed, opts); M.me = 'host'; M.mode = 'host'; M.world = M.S.world;
    Sim.addPlayer(M.S, 'host', name, col, UI.cls, UI.loadMeta().up, UI.hat, UI.skin);
    updateLobbyPlayers();
  }
  M.host = function (name, col, seed) {
    makeHostSim(name, col, seed);
    const code = Net.makeCode();
    Net.host(code, (ok) => { if (!ok) UI.showHostInfo('—'); });
    UI.showHostInfo(code); document.getElementById('seed').value = M.S.world.seed;
  };
  M.ensureHostForManual = function (name, col, seed) { makeHostSim(name, col, seed); Net.mode = 'host'; Net.id = 'host'; document.getElementById('hostinfo').classList.remove('hidden'); document.getElementById('seed').value = M.S.world.seed; };
  M.solo = function (name, col, seed) { makeHostSim(name, col, seed); M.startHostGame(); };
  // tutorial run: a guaranteed clearing with a tree, rock and bush by the beach, the clock frozen until the first campfire, no spawns meanwhile
  M.tutorialRun = function (name, col) { makeHostSim(name, col, 'LESSON', { tutorial: true }); M.startHostGame(); const m = UI.loadMeta(); m.tutorialOff = false; m.tutorialDone = false; UI.saveMeta(m); UI.tutMeta = null; UI.tutStep = 0; UI.tutLast = ''; UI.toast('Tutorial', 'Time stands still until you light a campfire. Follow the checklist on the left.', '#80ffd0'); };
  M.startHostGame = function () {
    if (!M.S || M.started) return; M.started = true; A.init(); A.resume();
    UI.enterGame(M.S.world.seed); Net.broadcast({ t: 'start' });
    UI.chat({ sys: true, msg: 'Punch a tree for wood (LMB). Craft an axe and a workbench (Tab).' });
    UI.chat({ sys: true, msg: 'Before dark: craft a torch (1 stick + 1 wood) and a campfire. Total darkness hurts, and monsters never spawn near light.' });
    In.wantLock = true; In.lock();
  };
  M.join = function (name, col, code) { M.pending = { name, col }; M.mode = 'client'; Net.join(code, (ok) => { if (!ok) document.getElementById('btn-join').disabled = false; }); };
  M.prepareClient = function (name, col) { M.pending = { name, col }; M.mode = 'client'; };
  function updateLobbyPlayers() { if (M.S) UI.setLobbyPlayers(Object.values(M.S.players).map(p => ({ name: p.name, col: p.col }))); }
  function onLockChange(locked) { if (!document.getElementById('settings').classList.contains('hidden')) return; UI.setResume(!locked && M.started && !UI.open && !UI.chatOpen); }

  // ---------- networking ----------
  function onJoin(id) {
    if (M.mode === 'client') { Net.send('host', { t: 'hello', name: M.pending ? M.pending.name : 'Castaway', col: M.pending ? M.pending.col : '#fff', cls: UI.cls, meta: UI.loadMeta().up, hat: UI.hat, skin: UI.skin }); UI.status('Connected — waiting for host…'); }
  }
  function onLeave(id) {
    if (M.mode === 'host' && M.S) { Sim.removePlayer(M.S, id); updateLobbyPlayers(); }
    else if (M.mode === 'client') { UI.toast('Disconnected from host', 'The host left or the connection dropped.', '#ff6060'); }
  }
  function onMessage(from, msg) {
    if (M.mode === 'host') {
      if (!M.S) return;
      if (msg.t === 'hello') {
        if (!M.S.players[from]) Sim.addPlayer(M.S, from, msg.name, msg.col, G.CLASSES.some(c => c.id === msg.cls) ? msg.cls : 'castaway', (msg.meta && typeof msg.meta === 'object') ? msg.meta : {}, typeof msg.hat === 'string' ? msg.hat : 'none', typeof msg.skin === 'string' ? msg.skin : 'happy');
        updateLobbyPlayers();
        Net.send(from, { t: 'welcome', id: from, seed: M.S.world.seed, snap: Sim.snapshot(M.S, true) });
        if (M.started) Net.send(from, { t: 'start' });
        flushEvents();
      } else if (msg.t === 'in') Sim.setInput(M.S, from, msg.in);
      else if (msg.t === 'act') Sim.action(M.S, from, msg.a);
      else if (msg.t === 'ping') Net.send(from, { t: 'pong', k: msg.k });
    } else {
      if (msg.t === 'welcome') {
        M.me = msg.id; M.world = G.generateWorld(msg.seed); R.resetWorld();
        applySnapshot(msg.snap); UI.status('Joined! Waiting for the host to start…');
      } else if (msg.t === 'snap') applySnapshot(msg);
      else if (msg.t === 'ev') handleEvents(msg.list);
      else if (msg.t === 'start') { if (!M.started) { M.started = true; A.init(); A.resume(); UI.enterGame(M.world.seed); In.wantLock = true; UI.setResume(true); } }
      else if (msg.t === 'pong') M.pingMs = Math.round((performance.now() - msg.k));
    }
  }
  function applySnapshot(snap) {
    if (!M.world) return;
    if (snap.objs) for (const [i, o] of snap.objs) { if (o) M.world.objs.set(i, o); else M.world.objs.delete(i); if (o && G.OBJS[o.t].floor) { M.world.tiles[i] = G.T.WATER; R.dirtyTile(i); } }
    if (snap.tiles) for (const [i, v] of snap.tiles) { M.world.tiles[i] = v; R.dirtyTile(i); }
    const enemies = snap.enemies.map(a => ({ id: a[0], t: G.EN_LIST[a[1]], x: a[2], y: a[3], hp: a[4], maxHp: a[5], st: a[6], face: a[7], flash: a[8], r: a[9], stun: a[10], hidden: a[11], pet: a[12], burn: a[13], tm: a[14], elite: a[15] }));
    const projs = snap.projs.map(a => ({ id: a[0], type: a[1], x: a[2], y: a[3], a: a[4] }));
    const drops = snap.drops.map(a => ({ id: a[0], item: a[1] < 0 ? 'coin' : G.ITEM_LIST[a[1]], x: a[2], y: a[3], n: a[4], aff: a[5] || null, q: a[6] || 0 }));
    const puddles = snap.puddles.map(a => ({ x: a[0], y: a[1], r: a[2], t: a[3] }));
    M.snapPrev = M.snapCur; M.snapCur = { time: snap.time, day: snap.day, phase: snap.phase, nev: snap.nev, siegeT: snap.siegeT, boat: snap.boat, bosses: snap.bosses, players: snap.players, enemies, projs, drops, puddles, stats: snap.stats, diff: snap.diff, at: performance.now() / 1000 };
    M.snapT = M.snapCur.at;
    const me = snap.players[M.me];
    if (me) {
      if (!M.pred || me.dead || me.downed || me.dodgeT) M.pred = { x: me.x, y: me.y };
      else { const d = G.dist(M.pred.x, M.pred.y, me.x, me.y); if (d > 1.5) { M.pred.x = me.x; M.pred.y = me.y; } else { M.pred.x = G.lerp(M.pred.x, me.x, 0.35); M.pred.y = G.lerp(M.pred.y, me.y, 0.35); } }
    }
  }

  // ---------- events ----------
  function handleEvents(list) {
    const V = M.V; const me = V && V.players[V.me];
    for (const ev of list) {
      if (ev.to && ev.to !== M.me && ev.t !== 'txt') continue;
      R.event(ev, M.me);
      switch (ev.t) {
        case 'sfx': if (me && ev.x !== undefined) A.play(ev.n, ev.x, ev.y, me.x, me.y); else A.play(ev.n); break;
        case 'chat': UI.chat(ev); break;
        case 'pw': if (ev.to === M.me) { const p = G.PW[ev.id]; UI.toast(p.name, p.desc, G.RARITY_COL[p.rarity]); A.play('pw'); } break;
        case 'end': A.play(ev.win ? 'win' : 'lose'); In.unlock(); { const sh = ev.shards ? (ev.shards[M.me] || 0) : 0; setTimeout(() => UI.end(ev.win, M.V, sh), 1500); } break;
        case 'nev': { const e = G.NIGHT_EVENTS.find(x => x.id === ev.id); if (e && ev.id !== 'clear') A.play('horn'); break; }
        case 'bossin': A.play('roar'); break;
        case 'sail': In.unlock(); UI.confirm('<b>The ship is ready.</b><p>Setting sail will summon everything the island has left.<br>Hold the dock for 90 seconds, then kill what rises.<br>Make sure everyone is here and stocked up.</p>', () => M.act({ a: 'sail' })); break;
        case 'boatinfo': { const b = V ? V.boat : null; if (b) UI.toast('Ship repairs', Object.keys(G.BOAT_NEED).map(k => G.ITEMS[k].name + ' ' + b[k] + '/' + G.BOAT_NEED[k]).join(' · ')); break; }
        case 'tile': if (M.world) { M.world.tiles[ev.i] = ev.v; R.dirtyTile(ev.i); } break;
        case 'casino': UI.casino(true, ev); break;
        case 'gres': UI.gres(ev); break;
        case 'hat': UI.unlockHat(ev.id); break;
      }
    }
  }
  function flushEvents() {
    const S = M.S; if (!S.events.length) return;
    const list = S.events; S.events = [];
    handleEvents(list);
    if (Net.count()) Net.broadcast({ t: 'ev', list });
  }

  // ---------- local actions ----------
  M.act = function (a) { if (M.mode === 'host') { if (M.S) { Sim.action(M.S, 'host', a); flushEvents(); } } else Net.send('host', { t: 'act', a }); };
  function targetTile() { const V = M.V; if (!V) return null; const hit = R.rayGround(V.world, 6.5); const me = V.players[V.me]; if (hit) return { tx: Math.floor(hit.x), ty: Math.floor(hit.y) }; if (!me) return null; const f = In.forward(); return { tx: Math.floor(me.x + f.x * 2.5), ty: Math.floor(me.y + f.y * 2.5) }; }
  function onLocalAction(a) {
    const V = M.V; const me = V && V.players[V.me]; if (!me || !M.started) return;
    if (a.a === 'jump') { if (M.jumpZ <= 0.001 && !me.downed && !me.dead) { M.vz = 4.2; A.play('dodge'); } return; }
    if (a.a === 'click') { const it = me.inv[me.held]; if (it && G.ITEMS[it.id].type === 'place') { const t = targetTile(); if (t) M.act({ a: 'build', item: it.id, tx: t.tx, ty: t.ty }); } return; }
    if (a.a === 'wheel') { M.act({ a: 'held', slot: (me.held + a.d + 9) % 9 }); return; }
    if (a.a === 'ping') { const hit = R.rayGround(V.world, 40); const f = In.forward(); M.act({ a: 'ping', x: hit ? hit.x : me.x + f.x * 8, y: hit ? hit.y : me.y + f.y * 8 }); return; }
    if (a.a === 'quickeat') { let best = -1, bv = -1; me.inv.forEach((s, i) => { if (s && G.ITEMS[s.id].type === 'food' && s.id !== 'raw_meat') { const v = G.ITEMS[s.id].hunger; if (v > bv && me.hunger < 100 - v * 0.5) { bv = v; best = i; } } }); if (best >= 0) M.act({ a: 'eat', slot: best }); return; }
    M.act(a);
  }

  // ---------- view construction ----------
  function hostView() {
    const S = M.S; const V = { world: S.world, time: S.time, day: S.day, phase: S.phase, nev: S.nev, siegeT: Math.ceil(S.siegeT), boat: S.boat, bosses: S.bosses, players: S.players, enemies: S.enemies, projs: S.projs, drops: S.drops, puddles: S.puddles, stats: S.stats, diff: Sim.difficulty(S), me: 'host', now: performance.now() / 1000, elapsed: S.elapsed };
    const me = S.players.host; V.chestDisc = me ? Sim.stats(me).chestDisc : 1;
    V.netlbl = Net.count() ? 'hosting · ' + (Net.count() + 1) + ' players' : (M.mode === 'host' && Net.room ? 'room ' + Net.room + ' · waiting for friends' : 'solo');
    return V;
  }
  function clientView() {
    const c = M.snapCur; if (!c) return null;
    const p = M.snapPrev; const now = performance.now() / 1000;
    const alpha = p ? G.clamp((now - c.at) / Math.max(0.02, c.at - p.at), 0, 1.2) : 1;
    const players = {};
    for (const id in c.players) {
      const cur = c.players[id]; const prev = p && p.players[id]; const q = Object.assign({}, cur);
      if (prev && id !== M.me) { q.x = G.lerp(prev.x, cur.x, Math.min(1, alpha)); q.y = G.lerp(prev.y, cur.y, Math.min(1, alpha)); }
      if (id === M.me && M.pred && !cur.dead && !cur.downed) { q.x = M.pred.x; q.y = M.pred.y; q.face = In.yaw; }
      players[id] = q;
    }
    const prevE = {}; if (p) for (const e of p.enemies) prevE[e.id] = e;
    const enemies = c.enemies.map(e => { const pe = prevE[e.id]; if (!pe) return e; return Object.assign({}, e, { x: G.lerp(pe.x, e.x, Math.min(1, alpha)), y: G.lerp(pe.y, e.y, Math.min(1, alpha)) }); });
    const me = c.players[M.me];
    return { world: M.world, time: c.time + (now - c.at), day: c.day, phase: c.phase, nev: c.nev, siegeT: c.siegeT, boat: c.boat, bosses: c.bosses, players, enemies, projs: c.projs, drops: c.drops, puddles: c.puddles, stats: c.stats, diff: c.diff, me: M.me, now, elapsed: 0, chestDisc: me ? Sim.stats(me).chestDisc : 1, netlbl: 'connected · ' + M.pingMs + 'ms' };
  }
  M.view = () => M.V;
  M.simForUI = () => M.mode === 'host' ? M.S : { world: M.world };

  function predict(dt) {
    const c = M.snapCur; if (!c || !M.pred) return; const me = c.players[M.me]; if (!me || me.dead || me.downed || me.dodgeT) return;
    const inp = In.packet(M.pred.x, M.pred.y); const l = Math.hypot(inp.ax, inp.ay); if (!l) return;
    const st = Sim.stats(me); let spd = st.speed * G.tileSpeed(M.world, M.pred.x, M.pred.y);
    if (inp.sprint && me.stam > 0 && !me.blocking && !me.draw) spd *= 1.5; if (me.blocking) spd *= 0.5; if (me.draw > 0) spd *= 0.6; if (me.swing) spd *= 0.75;
    G.moveCircle(M.world, M.pred, inp.ax * spd * dt, inp.ay * spd * dt, 0.3, false);
  }

  // ---------- hints ----------
  function hintFor(V) {
    const me = V.players[V.me]; if (!me || me.dead) return me && me.dead ? 'You are dead. You will wash ashore again at dawn.' : '';
    if (me.downed) return '';
    const w = V.world; let best = null, bd = 2.2;
    for (let y = Math.floor(me.y - 2); y <= me.y + 2; y++) for (let x = Math.floor(me.x - 2); x <= me.x + 2; x++) { const o = w.objs.get(G.idx(x, y)); if (!o) continue; const d = G.OBJS[o.t]; if (!(d.isChest || d.altar || d.boat || d.door || d.casino)) continue; const dd = G.dist(me.x, me.y, x + .5, y + .5); if (dd < bd) { bd = dd; best = { o, d }; } }
    for (const id in V.players) { const q = V.players[id]; if (q !== me && q.downed && G.dist(q.x, q.y, me.x, me.y) < 1.6) return 'Hold E to revive ' + q.name; }
    if (best) {
      const { o, d } = best;
      if (d.isChest) return 'E: open ' + d.name + ' (' + (o.free ? 'free' : Math.round(d.cost * (1 + (V.day - 1) * 0.25) * (V.chestDisc || 1)) + ' coins') + ') — everyone nearby gets a powerup';
      if (d.altar) return V.bosses[d.altar] === 'dead' ? 'This guardian is slain.' : V.bosses[d.altar] ? 'The guardian is loose!' : 'E: summon the guardian (needs ' + G.ITEMS[d.key].name + ')';
      if (d.boat) return V.boat.done ? 'E: SET SAIL' : 'E: deposit repairs — ' + Object.keys(G.BOAT_NEED).map(k => G.ITEMS[k].name + ' ' + V.boat[k] + '/' + G.BOAT_NEED[k]).join(', ');
      if (d.door) return 'E: ' + (o.closed ? 'open' : 'close') + ' door';
      if (d.casino) return "E: sit at the Dealer's Table — slots · dice · Wheel of Fates · blackjack (bet coins, win boons)";
    }
    const it = me.inv[me.held]; if (it && G.ITEMS[it.id].type === 'place') return 'LMB: place ' + G.ITEMS[it.id].name + ' where you look';
    if (it && G.ITEMS[it.id].type === 'bow') return 'Hold RMB to draw, release to shoot';
    if (me.hunger < 25) return 'You are starving — eat something (F)';
    return '';
  }
  function lookingAt(V, me) {
    const w = V.world; const f = In.forward();
    for (let s = 0.6; s <= 3.2; s += 0.4) { const x = me.x + f.x * s, y = me.y + f.y * s; const o = w.objs.get(G.idx(x, y)); if (o && !o.stub) { const d = G.OBJS[o.t]; let txt = d.name; if (d.tool && d.tool !== 'none' && d.tier > 1) txt += ' — needs ' + (d.tool === 'axe' ? 'axe' : 'pickaxe') + ' tier ' + d.tier + '+'; if (d.built && o.hp < d.hp) txt += ' (' + Math.ceil(o.hp) + '/' + d.hp + ')'; return txt; } }
    for (const e of V.enemies) { if (e.hidden) continue; const d = G.dist(me.x, me.y, e.x, e.y); if (d > 12) continue; const a = G.angleTo(me.x, me.y, e.x, e.y); if (Math.abs(G.angDiff(In.yaw, a)) < Math.atan2(e.r + 0.2, d)) return (e.elite ? 'ELITE ' : '') + G.ENEMIES[e.t].name + ' ' + Math.round(e.hp) + '/' + e.maxHp; }
    return '';
  }

  // ---------- main loop ----------
  let last = performance.now() / 1000;
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now() / 1000; let dt = Math.min(0.1, now - last); if (M.started) R.autoQuality((now - last) * 1000); last = now;
    if (!M.started) { if (M.mode === 'client' && M.snapCur && Net.count() && now - M.lastIn > 1) { M.lastIn = now; Net.send('host', { t: 'ping', k: performance.now() }); } if (R.preview && G.Assets.ready && !document.getElementById('lobby').classList.contains('hidden')) R.preview({ skin: UI.skin, hat: UI.hat, col: UI.color || '#5aa0ff', cls: UI.cls }, dt); return; }
    let mePos = M.mode === 'host' ? M.S.players.host : (M.pred || { x: 0, y: 0 });
    if (M.mode === 'host') {
      const S = M.S; if (!UI.paused) M.acc += dt; else M.acc = 0;
      let steps = 0;
      while (M.acc >= STEP && steps < 5) { Sim.setInput(S, 'host', In.packet(mePos.x, mePos.y)); Sim.step(S, STEP); Sim.flushChanges(S); M.acc -= STEP; steps++; }
      if (steps === 5) M.acc = 0;
      flushEvents();
      if (Net.count() && now - M.lastB >= BCAST) { M.lastB = now; Net.broadcast(Sim.snapshot(S, false)); }
      M.V = hostView();
    } else {
      if (now - M.lastIn >= INRATE) { M.lastIn = now; Net.send('host', { t: 'in', in: In.packet(mePos.x, mePos.y) }); if (Math.random() < 0.05) Net.send('host', { t: 'ping', k: performance.now() }); }
      predict(dt);
      M.V = clientView();
      if (!M.V) return;
    }
    const V = M.V; const me = V.players[V.me];
    // local first-person motion: jump & head bob
    if (M.jumpZ > 0 || M.vz > 0) { M.vz -= 12 * dt; const wasUp = M.jumpZ > 0; M.jumpZ = Math.max(0, M.jumpZ + M.vz * dt); if (M.jumpZ === 0) { if (wasUp) { M.land = 0.06; A.play('thud'); } M.vz = 0; } }
    M.land = Math.max(0, (M.land || 0) - dt * 0.5);
    if (me && me.dodgeT && !M.dodging) { M.dodging = true; const f = In.forward(); M.dodgeDir = (In.is('left') || In.keys.ArrowLeft) ? -1 : (In.is('right') || In.keys.ArrowRight) ? 1 : (In.is('back') ? 0.5 : 0.3); } else if (me && !me.dodgeT) M.dodging = false;
    const moving = me && me.moving && !me.dead && !me.downed; const sprinting = moving && In.is('sprint') && me.stam > 0;
    // head bob: gentle and eased in/out so sprinting reads as speed, not as bouncing
    if (moving && M.jumpZ === 0) M.walkT += dt * (sprinting ? 9.5 : 7); const bobTarget = moving && M.jumpZ === 0 && In.settings.bob ? Math.sin(M.walkT) * (sprinting ? 0.016 : 0.012) : 0; M.bob = G.lerp(M.bob, bobTarget, Math.min(1, dt * 10));
    // build ghost
    let ghost = null;
    if (me && !me.dead) { const it = me.inv[me.held]; if (it && G.ITEMS[it.id].type === 'place') { const t = targetTile(); if (t) { const d = G.ITEMS[it.id]; const od = G.OBJS[d.obj]; const tt = G.tileAt(V.world, t.tx, t.ty); const ok = G.inWorld(t.tx, t.ty) && G.dist(me.x, me.y, t.tx + .5, t.ty + .5) <= 5.5 && !V.world.objs.has(G.idx(t.tx, t.ty)) && (od.floor ? (tt === G.T.WATER || tt === G.T.DEEP) : (tt > G.T.WATER && tt !== G.T.LAVA)); ghost = { obj: d.obj, tx: t.tx, ty: t.ty, ok }; } } }
    UI.update(V, hintFor(V)); UI.tutorial(V);
    R.frame(V, dt, { yaw: In.yaw, pitch: In.pitch, jumpZ: M.jumpZ, bob: M.bob, walkT: M.walkT, sprinting, ghost, land: M.land, dodgeDir: M.dodgeDir, lookingAt: me && !me.dead ? lookingAt(V, me) : '' });
    A.setNight(Sim.darkness({ time: V.time }));
  }
})(window.G);
