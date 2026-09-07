// DRIFTWOOD — networking: PeerJS room codes with a manual WebRTC code-exchange fallback
(function (G) {
  'use strict';
  const Net = { mode: null, id: null, conns: {}, onMessage: null, onJoin: null, onLeave: null, onStatus: null, peer: null, room: null };
  G.Net = Net;
  const PREFIX = 'driftwood-v1-';
  // STUN finds the public address; the free Open Relay TURN servers carry traffic when both players sit behind strict NATs
  // (mobile hotspots, university networks) where a direct WebRTC path cannot be punched through.
  const ICE = { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.relay.metered.ca:80'] },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ] };
  Net.ICE = ICE;
  // Where the game lives on the open web. The claude.ai preview page cannot reach the room server (its sandbox blocks
  // the signalling WebSocket), so the lobby points people there for online play.
  Net.hostedUrl = () => window.__HOSTED_URL || (location.protocol.startsWith('http') && !window.__ARTIFACT ? location.origin + location.pathname : '');
  Net.inviteLink = (code) => { const base = window.__ARTIFACT || location.protocol === 'file:' ? (window.__HOSTED_URL || '') : location.origin + location.pathname; return base ? base + (base.includes('?') ? '&' : '?') + 'room=' + code : ''; };
  Net.blockedHere = () => !!window.__ARTIFACT;
  const status = (s) => { Net.status = s; if (Net.onStatus) Net.onStatus(s); };

  Net.hasPeerJS = () => typeof window.Peer === 'function';
  Net.makeCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

  // ---- wrapping a transport (PeerJS DataConnection or RTCDataChannel) into a uniform conn ----
  const CHUNK = 60000;
  function wrap(id, sendRaw, close) {
    const c = { id, open: true, parts: {}, sendRaw, close };
    c.send = (msg) => {
      if (!c.open) return;
      const s = JSON.stringify(msg);
      if (s.length <= CHUNK) { try { sendRaw(s); } catch (e) { } return; }
      const mid = Math.random().toString(36).slice(2, 8), total = Math.ceil(s.length / CHUNK);
      for (let i = 0; i < total; i++) { try { sendRaw('' + mid + '|' + i + '|' + total + '|' + s.slice(i * CHUNK, (i + 1) * CHUNK)); } catch (e) { } }
    };
    c.receive = (raw) => {
      if (typeof raw !== 'string') { try { raw = new TextDecoder().decode(raw); } catch (e) { return; } }
      if (raw[0] === '') {
        const a = raw.indexOf('|'), b = raw.indexOf('|', a + 1), d = raw.indexOf('|', b + 1);
        const mid = raw.slice(1, a), i = +raw.slice(a + 1, b), total = +raw.slice(b + 1, d);
        const P = c.parts[mid] || (c.parts[mid] = { n: 0, arr: new Array(total) });
        P.arr[i] = raw.slice(d + 1); P.n++;
        if (P.n === total) { delete c.parts[mid]; raw = P.arr.join(''); } else return;
      }
      let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
      if (Net.onMessage) Net.onMessage(id, msg);
    };
    return c;
  }
  function addConn(c) { Net.conns[c.id] = c; if (Net.onJoin) Net.onJoin(c.id); }
  function dropConn(id) { const c = Net.conns[id]; if (!c) return; c.open = false; delete Net.conns[id]; if (Net.onLeave) Net.onLeave(id); }

  Net.send = (id, msg) => { const c = Net.conns[id]; if (c) c.send(msg); };
  Net.broadcast = (msg) => { for (const id in Net.conns) Net.conns[id].send(msg); };
  Net.count = () => Object.keys(Net.conns).length;

  // ---- PeerJS path ----
  Net.host = function (code, cb) {
    Net.mode = 'host'; Net.room = code; Net.id = 'host';
    if (!Net.hasPeerJS()) { status('Room codes unavailable here — use the manual invite below.'); cb && cb(false, 'no-peerjs'); return; }
    status('Opening room ' + code + '…');
    const peer = new Peer(PREFIX + code, { debug: 0, config: ICE });
    Net.peer = peer;
    let opened = false;
    peer.on('open', () => { opened = true; status('Room ' + code + ' is open. Share the code!'); cb && cb(true); });
    peer.on('connection', (dc) => {
      const id = dc.peer;
      dc.on('open', () => { const c = wrap(id, (s) => dc.send(s), () => dc.close()); dc.on('data', (d) => c.receive(d)); dc.on('close', () => dropConn(id)); dc.on('error', () => dropConn(id)); addConn(c); });
    });
    peer.on('error', (e) => { console.warn('peer error', e); if (!opened) { status(Net.blockedHere() ? 'Room codes cannot connect from inside this preview — open the web version (link above) to host online.' : 'Could not reach the room server (' + (e.type || 'error') + '). Use the manual invite below.'); cb && cb(false, e.type); } });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
    setTimeout(() => { if (!opened) { status(Net.blockedHere() ? 'Room codes cannot connect from inside this preview — open the web version (link above) to host online.' : 'Room server is slow or blocked — you can still use the manual invite below.'); cb && cb(false, 'timeout'); } }, Net.blockedHere() ? 3500 : 8000);
  };
  Net.join = function (code, cb) {
    Net.mode = 'client'; Net.room = code;
    if (!Net.hasPeerJS()) { status('Room codes unavailable here — ask the host for a manual invite.'); cb && cb(false, 'no-peerjs'); return; }
    status('Connecting to room ' + code + '…');
    const peer = new Peer({ debug: 0, config: ICE }); Net.peer = peer;
    let done = false;
    peer.on('open', (myId) => {
      Net.id = myId;
      const dc = peer.connect(PREFIX + code, { reliable: true, serialization: 'none' });
      dc.on('open', () => { done = true; const c = wrap('host', (s) => dc.send(s), () => dc.close()); dc.on('data', (d) => c.receive(d)); dc.on('close', () => { dropConn('host'); status('Disconnected from host.'); }); addConn(c); status('Connected!'); cb && cb(true); });
      dc.on('error', (e) => { if (!done) { status('Connection failed: ' + e); cb && cb(false, 'conn'); } });
    });
    peer.on('error', (e) => { if (!done) { status(Net.blockedHere() ? 'Room codes cannot connect from inside this preview — open the web version (link above) to join.' : 'Could not join (' + (e.type || 'error') + '). Check the code, or use a manual invite.'); cb && cb(false, e.type); } });
    setTimeout(() => { if (!done) { status(Net.blockedHere() ? 'Room codes cannot connect from inside this preview — open the web version (link above) to join.' : 'Join timed out. Check the code or use a manual invite.'); cb && cb(false, 'timeout'); } }, Net.blockedHere() ? 3500 : 12000);
  };

  // ---- manual WebRTC path (copy/paste offer & answer) ----
  const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '');
  const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s.trim().replace(/\s+/g, '')))));
  function waitIce(pc) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, 2500);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }
  function attachChannel(id, ch, pc) {
    const c = wrap(id, (s) => ch.send(s), () => pc.close());
    ch.onmessage = (ev) => c.receive(ev.data);
    ch.onclose = () => dropConn(id);
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') dropConn(id); };
    addConn(c);
  }
  Net.pendingManual = null;
  // host: create an invite (offer). Returns the invite string.
  Net.manualCreateInvite = async function () {
    Net.mode = Net.mode || 'host'; Net.id = Net.id || 'host';
    const pc = new RTCPeerConnection(ICE);
    const ch = pc.createDataChannel('game', { ordered: true });
    const id = 'm' + Math.random().toString(36).slice(2, 8);
    ch.onopen = () => { attachChannel(id, ch, pc); status('Friend connected via manual invite.'); };
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await waitIce(pc);
    Net.pendingManual = { pc, id };
    return enc({ t: 'o', id, sdp: pc.localDescription });
  };
  // host: accept the friend's reply
  Net.manualAcceptReply = async function (str) {
    const m = dec(str); if (m.t !== 'a' || !Net.pendingManual) throw new Error('bad reply');
    await Net.pendingManual.pc.setRemoteDescription(m.sdp);
    Net.pendingManual = null;
  };
  // client: accept an invite, returns reply string
  Net.manualAcceptInvite = async function (str) {
    const m = dec(str); if (m.t !== 'o') throw new Error('bad invite');
    Net.mode = 'client'; Net.id = m.id;
    const pc = new RTCPeerConnection(ICE);
    pc.ondatachannel = (ev) => { const ch = ev.channel; ch.onopen = () => { attachChannel('host', ch, pc); status('Connected!'); }; };
    await pc.setRemoteDescription(m.sdp);
    const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); await waitIce(pc);
    return enc({ t: 'a', sdp: pc.localDescription });
  };
  // ---- direct connection to a Driftwood server (dedicated `node server.js`, or the desktop app hosting on a port) ----
  // Messages are whole JSON strings over one WebSocket; no chunking needed.
  Net.normalizeAddr = function (addr) {
    addr = String(addr || '').trim(); if (!addr) return '';
    if (/^https?:\/\//i.test(addr)) addr = addr.replace(/^http/i, 'ws');
    if (!/^wss?:\/\//i.test(addr)) addr = 'ws://' + addr;
    try { const u = new URL(addr); if (!u.port && u.protocol === 'ws:') u.port = '7777'; if (u.pathname === '/' || u.pathname === '') u.pathname = '/ws'; u.search = ''; u.hash = ''; return u.toString(); } catch (e) { return ''; }
  };
  Net.connect = function (addr, cb) {
    const url = Net.normalizeAddr(addr); if (!url) { status('Enter a server address like 203.0.113.5:7777'); cb && cb(false, 'addr'); return; }
    if (location.protocol === 'https:' && url.startsWith('ws://')) { status('This page is https, so the browser refuses plain ws:// servers. Open the server\'s own page (http://ADDRESS/) or use the downloaded game / desktop app.'); cb && cb(false, 'mixed'); return; }
    Net.mode = 'client'; Net.room = null; Net.server = url; Net.kickReason = null; status('Connecting to ' + url.replace(/^ws(s?):\/\//, '').replace(/\/ws$/, '') + '…');
    let ws; try { ws = new WebSocket(url); } catch (e) { status('Bad server address.'); cb && cb(false, 'addr'); return; }
    let done = false; Net.ws = ws;
    const c = { id: 'host', open: true, send: (msg) => { if (ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) { } } }, close: () => { try { ws.close(); } catch (e) { } } };
    ws.onopen = () => { done = true; Net.id = 'me'; addConn(c); status('Connected!'); cb && cb(true); };
    ws.onmessage = (e) => { let msg; try { msg = JSON.parse(e.data); } catch (err) { return; } if (Net.onMessage) Net.onMessage('host', msg); };
    ws.onerror = () => { if (!done) { status('Could not reach that server. Is it running, and is the port open?'); cb && cb(false, 'conn'); } };
    ws.onclose = () => { if (done) { dropConn('host'); if (Net.mode === 'client') status(Net.kickReason ? Net.kickReason : 'Disconnected from server.'); } else { status('Could not reach that server. Is it running, and is the port open?'); cb && cb(false, 'conn'); } };
    setTimeout(() => { if (!done) { try { ws.close(); } catch (e) { } } }, 8000);
  };
  // ---- hosting on a port from the desktop app: the Electron main process owns the listening socket and relays through the preload bridge ----
  Net.canListen = () => !!(window.driftwoodNative && window.driftwoodNative.listen);
  Net.listen = async function (port) {
    if (!Net.canListen()) return { ok: false, error: 'Hosting on a port needs the desktop app.' };
    Net.mode = Net.mode || 'host'; Net.id = Net.id || 'host';
    if (!Net.nativeBound) {
      Net.nativeBound = true;
      window.driftwoodNative.on((ev) => {
        if (ev.type === 'open') { const id = ev.id; const c = { id, open: true, send: (msg) => window.driftwoodNative.send(id, JSON.stringify(msg)), close: () => window.driftwoodNative.kick(id) }; addConn(c); }
        else if (ev.type === 'message') { let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; } if (Net.onMessage) Net.onMessage(ev.id, msg); }
        else if (ev.type === 'close') dropConn(ev.id);
      });
    }
    const r = await window.driftwoodNative.listen(port | 0 || 7777); Net.listening = r && r.ok ? r : null; return r;
  };
  Net.leave = function () { for (const id in Net.conns) { try { Net.conns[id].close(); } catch (e) { } } Net.conns = {}; if (Net.peer) { try { Net.peer.destroy(); } catch (e) { } } Net.peer = null; if (Net.ws) { try { Net.ws.close(); } catch (e) { } Net.ws = null; } if (Net.listening && window.driftwoodNative) { try { window.driftwoodNative.stop(); } catch (e) { } Net.listening = null; } Net.mode = null; };
})(window.G);
