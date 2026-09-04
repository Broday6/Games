// DRIFTWOOD — canvas renderer, lighting, particles, minimap
(function (G) {
  'use strict';
  const TS = G.TS, T = G.T, O = G.OBJS, Sp = G.Sprites;
  const R = { cam: { x: 0, y: 0 }, W: 480, H: 270, scale: 1, shake: 0, hitstop: 0, fx: { parts: [], floats: [], slashes: [], booms: [], zaps: [], targets: [], pings: [], wobble: {} }, tellFlash: {} };
  G.Render = R;
  let cv, cx, dark, dx, mini, minx, miniBase = null;
  const chunks = {}; const CH = 16;

  R.init = function (canvas, minimap) {
    cv = canvas; cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
    dark = document.createElement('canvas'); dx = dark.getContext('2d');
    mini = minimap; minx = mini.getContext('2d'); minx.imageSmoothingEnabled = false;
    R.resize();
    window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    const ww = window.innerWidth, wh = window.innerHeight;
    R.H = 270; R.W = Math.max(320, Math.min(640, Math.round(270 * ww / wh)));
    cv.width = R.W; cv.height = R.H; dark.width = R.W; dark.height = R.H;
    R.scale = Math.min(ww / R.W, wh / R.H);
    cv.style.width = Math.round(R.W * R.scale) + 'px'; cv.style.height = Math.round(R.H * R.scale) + 'px';
    cx.imageSmoothingEnabled = false;
  };
  R.screenToWorld = function (sx, sy) {
    const rect = cv.getBoundingClientRect();
    const ix = (sx - rect.left) / R.scale, iy = (sy - rect.top) / R.scale;
    return { x: R.cam.x + (ix - R.W / 2) / TS, y: R.cam.y + (iy - R.H / 2) / TS };
  };
  const wx = (x) => Math.round((x - R.cam.x) * TS + R.W / 2);
  const wy = (y) => Math.round((y - R.cam.y) * TS + R.H / 2);

  // ---------- terrain chunks ----------
  const h2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
  function chunk(world, cxI, cyI) {
    const key = cxI + ',' + cyI; if (chunks[key]) return chunks[key];
    const c = document.createElement('canvas'); c.width = CH * TS; c.height = CH * TS; const x = c.getContext('2d');
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const X = cxI * CH + tx, Y = cyI * CH + ty; if (X >= G.WORLD || Y >= G.WORLD) continue;
      const t = world.tiles[Y * G.WORLD + X]; const info = G.TILE_INFO[t];
      x.fillStyle = info.col; x.fillRect(tx * TS, ty * TS, TS, TS);
      // texture
      const r = h2(X, Y);
      x.fillStyle = Sp.shade(info.col, r > 0.5 ? 10 : -10);
      x.fillRect(tx * TS + Math.floor(r * 12), ty * TS + Math.floor(h2(Y, X) * 12), 3, 2);
      x.fillRect(tx * TS + Math.floor(h2(X + 7, Y) * 13), ty * TS + Math.floor(h2(X, Y + 7) * 13), 2, 2);
      if (t === T.GRASS || t === T.DARKGRASS) { x.fillStyle = Sp.shade(info.col, 18); for (let k = 0; k < 3; k++) { const gx = Math.floor(h2(X + k * 3, Y) * 15), gy = Math.floor(h2(X, Y + k * 5) * 13); x.fillRect(tx * TS + gx, ty * TS + gy, 1, 3); } }
      if (t === T.WATER || t === T.DEEP) { x.fillStyle = Sp.shade(info.col, 25); x.fillRect(tx * TS + Math.floor(r * 10), ty * TS + Math.floor(h2(X, Y + 3) * 14), 5, 1); }
      if (t === T.LAVA) { x.fillStyle = '#ffd040'; x.fillRect(tx * TS + Math.floor(r * 10), ty * TS + Math.floor(h2(X, Y + 3) * 14), 4, 2); }
      // edges: darker line where neighbour above differs
      const up = Y > 0 ? world.tiles[(Y - 1) * G.WORLD + X] : t, left = X > 0 ? world.tiles[Y * G.WORLD + X - 1] : t;
      if (up !== t) { x.fillStyle = up < t ? Sp.shade(info.col, 22) : Sp.shade(info.col, -28); x.fillRect(tx * TS, ty * TS, TS, 1); }
      if (left !== t) { x.fillStyle = left < t ? Sp.shade(info.col, 16) : Sp.shade(info.col, -22); x.fillRect(tx * TS, ty * TS, 1, TS); }
    }
    chunks[key] = c; return c;
  }
  R.dirtyTile = (i) => { const X = i % G.WORLD, Y = Math.floor(i / G.WORLD); delete chunks[Math.floor(X / CH) + ',' + Math.floor(Y / CH)]; delete chunks[Math.floor(X / CH) + ',' + Math.floor((Y + 1) / CH)]; delete chunks[Math.floor((X + 1) / CH) + ',' + Math.floor(Y / CH)]; };
  R.resetWorld = () => { for (const k in chunks) delete chunks[k]; miniBase = null; };

  // ---------- events -> fx ----------
  R.event = function (ev, me) {
    const F = R.fx;
    switch (ev.t) {
      case 'dmg': F.floats.push({ x: ev.x + (Math.random() - .5) * 0.4, y: ev.y, s: String(ev.v), c: ev.c, t: 0, big: ev.crit, vy: -1.2 }); break;
      case 'txt': if (!ev.to || ev.to === me) F.floats.push({ x: ev.x, y: ev.y, s: ev.s, c: ev.c, t: 0, small: ev.small, vy: -0.7 }); break;
      case 'hit': for (let i = 0; i < ev.n; i++) F.parts.push({ x: ev.x, y: ev.y, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6 - 1, c: ev.c, t: 0, life: 0.3 + Math.random() * 0.3, g: 9 }); break;
      case 'die': for (let i = 0; i < 14; i++) F.parts.push({ x: ev.x, y: ev.y, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 8 - 2, c: i % 3 ? ev.c : '#ffffff', t: 0, life: 0.4 + Math.random() * 0.5, g: 12, sz: 2 }); break;
      case 'boom': F.booms.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, c: ev.c || '#ffb040' }); for (let i = 0; i < 12; i++) F.parts.push({ x: ev.x, y: ev.y, vx: (Math.random() - .5) * 10, vy: (Math.random() - .5) * 10, c: ev.c || '#ffb040', t: 0, life: 0.4, g: 0, sz: 2 }); break;
      case 'zap': F.zaps.push({ x1: ev.x1, y1: ev.y1, x2: ev.x2, y2: ev.y2, t: 0 }); break;
      case 'slash': F.slashes.push({ x: ev.x, y: ev.y, a: ev.a, r: ev.r, t: 0, c: ev.c }); break;
      case 'target': F.targets.push({ x: ev.x, y: ev.y, r: ev.r, t: 0, d: ev.d }); break;
      case 'ping': F.pings.push({ x: ev.x, y: ev.y, col: ev.col, name: ev.name, t: 0 }); break;
      case 'dust': for (let i = 0; i < 6; i++) F.parts.push({ x: ev.x, y: ev.y + 0.3, vx: (Math.random() - .5) * 3, vy: -Math.random() * 1, c: '#d0c0a0', t: 0, life: 0.3, g: 0 }); break;
      case 'fire': F.parts.push({ x: ev.x + (Math.random() - .5) * 0.4, y: ev.y, vx: 0, vy: -2, c: Math.random() < 0.5 ? '#ff6a1a' : '#ffd040', t: 0, life: 0.4, g: -4 }); break;
      case 'shake': if (!ev.id || ev.id === me) R.shake = Math.max(R.shake, ev.v); break;
      case 'hitstop': if (ev.to === me) R.hitstop = 0.06; break;
      case 'wobble': F.wobble[ev.i] = 0.25; break;
      case 'tell': R.tellFlash[ev.id] = 0.3; break;
    }
  };

  // ---------- frame ----------
  R.frame = function (V, dt, L) {
    const me = V.players[V.me]; const F = R.fx;
    if (R.hitstop > 0) { R.hitstop -= dt; dt *= 0.15; }
    // camera
    if (me) { R.cam.x = G.lerp(R.cam.x, me.x, Math.min(1, dt * 8)); R.cam.y = G.lerp(R.cam.y, me.y, Math.min(1, dt * 8)); }
    if (R.shake > 0) { R.shake = Math.max(0, R.shake - dt * 20); }
    const shx = (Math.random() - .5) * R.shake * 0.08, shy = (Math.random() - .5) * R.shake * 0.08;
    R.cam.x += shx; R.cam.y += shy;
    const world = V.world;
    cx.fillStyle = '#1b3a6b'; cx.fillRect(0, 0, R.W, R.H);
    // terrain
    const tx0 = Math.floor(R.cam.x - R.W / 2 / TS) - 1, ty0 = Math.floor(R.cam.y - R.H / 2 / TS) - 2, tx1 = tx0 + Math.ceil(R.W / TS) + 3, ty1 = ty0 + Math.ceil(R.H / TS) + 4;
    for (let cy = Math.floor(ty0 / CH); cy <= Math.floor(ty1 / CH); cy++) for (let cX = Math.floor(tx0 / CH); cX <= Math.floor(tx1 / CH); cX++) {
      if (cX < 0 || cy < 0 || cX * CH >= G.WORLD || cy * CH >= G.WORLD) continue;
      cx.drawImage(chunk(world, cX, cy), wx(cX * CH), wy(cy * CH));
    }
    // puddles
    for (const p of V.puddles) { cx.fillStyle = 'rgba(255,90,20,' + Math.min(0.8, p.t / 3) + ')'; cx.beginPath(); cx.ellipse(wx(p.x), wy(p.y), p.r * TS, p.r * TS * 0.7, 0, 0, 7); cx.fill(); }
    // build a y-sorted draw list
    const list = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= G.WORLD || ty >= G.WORLD) continue;
      const i = ty * G.WORLD + tx; const o = world.objs.get(i); if (!o) continue;
      const d = O[o.t];
      if (d.floor || d.trap) { cx.drawImage(Sp.obj(o.t), wx(tx), wy(ty)); continue; }
      list.push({ y: ty + 1, k: 'o', o, tx, ty, i });
    }
    for (const d of V.drops) list.push({ y: d.y + 0.2, k: 'd', d });
    for (const e of V.enemies) if (!e.hidden) list.push({ y: e.y + e.r, k: 'e', e });
    for (const id in V.players) { const p = V.players[id]; if (!p.dead) list.push({ y: p.y + 0.3, k: 'p', p }); }
    for (const pr of V.projs) list.push({ y: pr.y, k: 'pr', pr });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.k === 'o') drawObj(it, V);
      else if (it.k === 'd') { const d = it.d; const bob = Math.sin(V.now * 4 + d.id) * 1.5; cx.drawImage(Sp.item(d.item), 0, 0, 16, 16, wx(d.x) - 5, wy(d.y) - 5 + bob, 10, 10); if (d.n > 1) { cx.fillStyle = '#fff'; cx.font = '6px monospace'; cx.fillText(d.n, wx(d.x) + 3, wy(d.y) + 6); } }
      else if (it.k === 'e') drawEnemy(it.e, V, dt);
      else if (it.k === 'p') drawPlayer(it.p, V, me);
      else if (it.k === 'pr') { const pr = it.pr; cx.save(); cx.translate(wx(pr.x), wy(pr.y)); cx.rotate(pr.a !== undefined ? pr.a : Math.atan2(pr.vy, pr.vx)); if (pr.type === 'arrow') { cx.fillStyle = '#d8c8a8'; cx.fillRect(-5, -0.5, 10, 1); cx.fillStyle = '#c0c0c8'; cx.fillRect(4, -1, 3, 2); } else if (pr.type === 'glob') { cx.fillStyle = '#ff6a1a'; cx.beginPath(); cx.arc(0, 0, 3, 0, 7); cx.fill(); cx.fillStyle = '#ffd040'; cx.fillRect(-1, -1, 2, 2); } else { cx.fillStyle = '#7d7f83'; cx.beginPath(); cx.arc(0, 0, 5, 0, 7); cx.fill(); } cx.restore(); }
    }
    // fx
    drawFx(dt, V);
    // lighting
    drawLighting(V, world, tx0, ty0, tx1, ty1);
    // overlays (unlit)
    for (const e of V.enemies) if (!e.hidden) drawEnemyOverlay(e, V);
    for (const id in V.players) drawPlayerOverlay(V.players[id], V, me);
    for (const f of F.floats) { cx.font = (f.big ? 'bold 9px' : f.small ? '5px' : '7px') + ' monospace'; cx.textAlign = 'center'; cx.fillStyle = '#000'; cx.fillText(f.s, wx(f.x) + 1, wy(f.y) + 1); cx.fillStyle = f.c; cx.fillText(f.s, wx(f.x), wy(f.y)); }
    for (const p of F.pings) { const a = 1 - p.t / 4; cx.strokeStyle = p.col; cx.globalAlpha = a; cx.lineWidth = 1; cx.beginPath(); cx.arc(wx(p.x), wy(p.y), 4 + (p.t % 1) * 10, 0, 7); cx.stroke(); cx.fillStyle = p.col; cx.font = '6px monospace'; cx.textAlign = 'center'; cx.fillText(p.name, wx(p.x), wy(p.y) - 8); cx.globalAlpha = 1; }
    // build ghost & cursor
    if (L && L.ghost) { const g = L.ghost; const s = Sp.obj(g.obj); cx.globalAlpha = 0.6; cx.drawImage(s, wx(g.tx), wy(g.ty) - (s.height - 16)); cx.globalAlpha = 1; cx.strokeStyle = g.ok ? '#60ff60' : '#ff6060'; cx.strokeRect(wx(g.tx) + 0.5, wy(g.ty) + 0.5, TS - 1, TS - 1); }
    if (L && L.aim) { cx.strokeStyle = 'rgba(255,255,255,0.8)'; cx.lineWidth = 1; const ax = wx(L.aim.x), ay = wy(L.aim.y); cx.beginPath(); cx.moveTo(ax - 4, ay); cx.lineTo(ax - 1, ay); cx.moveTo(ax + 1, ay); cx.lineTo(ax + 4, ay); cx.moveTo(ax, ay - 4); cx.lineTo(ax, ay - 1); cx.moveTo(ax, ay + 1); cx.lineTo(ax, ay + 4); cx.stroke(); }
    // boss bars
    let by = 6;
    for (const e of V.enemies) if (G.ENEMIES[e.t].boss) { const d = G.ENEMIES[e.t]; const w = Math.min(200, R.W - 40); const x0 = (R.W - w) / 2; cx.fillStyle = '#000'; cx.fillRect(x0 - 1, by - 1, w + 2, 8); cx.fillStyle = '#601010'; cx.fillRect(x0, by, w, 6); cx.fillStyle = '#e03030'; cx.fillRect(x0, by, w * Math.max(0, e.hp / e.maxHp), 6); cx.fillStyle = '#fff'; cx.font = '6px monospace'; cx.textAlign = 'center'; cx.fillText(d.name, R.W / 2, by + 5); by += 12; }
    R.cam.x -= shx; R.cam.y -= shy;
    drawMinimap(V);
  };

  function drawObj(it, V) {
    const { o, tx, ty, i } = it; const d = O[o.t];
    let s;
    if (o.stub) s = Sp.obj(o.t, 'stub');
    else if (d.door && !o.closed) s = Sp.obj(o.t, 'open');
    else s = Sp.obj(o.t);
    let ox = 0;
    const w = R.fx.wobble[i]; if (w) ox = Math.round(Math.sin(w * 60) * 1.5);
    cx.drawImage(s, wx(tx) + ox, wy(ty) - (s.height - TS));
    if (d.built && o.hp < d.hp) { cx.fillStyle = '#000'; cx.fillRect(wx(tx) + 2, wy(ty) - 3, 12, 2); cx.fillStyle = '#ffa040'; cx.fillRect(wx(tx) + 2, wy(ty) - 3, 12 * o.hp / d.hp, 2); }
    if (d.isChest) { const cost = o.free ? 0 : Math.round(d.cost * (1 + (V.day - 1) * 0.25) * (V.chestDisc || 1)); cx.fillStyle = '#ffd24a'; cx.font = '6px monospace'; cx.textAlign = 'center'; cx.fillText(cost ? cost + 'c' : 'free', wx(tx) + 8, wy(ty) - 2); }
    if (d.light && (o.t === 'campfire' || o.t === 'torch')) { for (let k = 0; k < 1; k++) if (Math.random() < 0.3) R.fx.parts.push({ x: tx + 0.5 + (Math.random() - .5) * 0.3, y: ty + (o.t === 'torch' ? 0.2 : 0.4), vx: 0, vy: -1.5, c: Math.random() < 0.5 ? '#ff6a1a' : '#ffd040', t: 0, life: 0.5, g: -2 }); }
  }
  function drawEnemy(e, V, dt) {
    const d = G.ENEMIES[e.t]; const frame = Math.floor(V.now * 6 + e.id) % 2;
    const s = Sp.enemy(e.t, frame, e.flash);
    const flip = Math.cos(e.face) < 0;
    const isWind = /wind$/.test(e.st) || e.st === 'wind';
    cx.save(); cx.translate(wx(e.x), wy(e.y));
    if (e.stun) cx.translate(Math.sin(V.now * 30) * 1, 0);
    if (flip) cx.scale(-1, 1);
    const sc = isWind ? 1 + Math.sin(V.now * 25) * 0.05 : 1;
    cx.scale(sc, sc);
    const hw = s.width / 2, hh = s.height;
    cx.drawImage(s, -hw, -hh + e.r * TS * 0.6);
    cx.restore();
    if (e.st === 'charge' || e.st === 'lunge') { for (let i = 0; i < 2; i++) R.fx.parts.push({ x: e.x, y: e.y + e.r * 0.5, vx: (Math.random() - .5) * 2, vy: -1, c: '#d0c0a0', t: 0, life: 0.3, g: 0 }); }
    if (e.burn) R.fx.parts.push({ x: e.x + (Math.random() - .5) * 0.6, y: e.y, vx: 0, vy: -2, c: '#ff6a1a', t: 0, life: 0.3, g: -3 });
  }
  function drawEnemyOverlay(e, V) {
    const d = G.ENEMIES[e.t]; const top = wy(e.y) - (d.boss ? 30 : 18);
    if (!d.boss && e.hp < e.maxHp) { cx.fillStyle = '#000'; cx.fillRect(wx(e.x) - 7, top, 14, 2); cx.fillStyle = (e.pet || e.owner) ? '#60ff60' : '#e03030'; cx.fillRect(wx(e.x) - 7, top, 14 * Math.max(0, e.hp / e.maxHp), 2); }
    const isWind = /wind$/.test(e.st);
    if (isWind) { cx.fillStyle = Math.floor(V.now * 12) % 2 ? '#ff3030' : '#ffe040'; cx.font = 'bold 9px monospace'; cx.textAlign = 'center'; cx.fillText('!', wx(e.x), top - 2); }
    if (e.stun) { cx.fillStyle = '#ffe040'; cx.font = '7px monospace'; cx.textAlign = 'center'; cx.fillText('* *', wx(e.x), top - 2); }
    if (e.st === 'charge' || e.st === 'lunge') { cx.strokeStyle = 'rgba(255,60,60,0.5)'; cx.beginPath(); cx.moveTo(wx(e.x), wy(e.y)); cx.lineTo(wx(e.x + Math.cos(e.face) * 4), wy(e.y + Math.sin(e.face) * 4)); cx.stroke(); }
  }
  function drawPlayer(p, V, me) {
    const frame = p.moving ? Math.floor(p.anim) % 2 : 0;
    const armor = (p.armor.head ? G.ITEMS[p.armor.head].col : '') + ',' + (p.armor.chest ? G.ITEMS[p.armor.chest].col : '') + ',' + (p.armor.legs ? G.ITEMS[p.armor.legs].col : '');
    const s = Sp.player(p.col, frame, p.flash, armor);
    const flip = Math.cos(p.face) < 0;
    const X = wx(p.x), Y = wy(p.y);
    // shadow
    cx.fillStyle = 'rgba(0,0,0,0.3)'; cx.beginPath(); cx.ellipse(X, Y + 4, 5, 2, 0, 0, 7); cx.fill();
    cx.save(); cx.translate(X, Y + 4);
    if (p.downed) { cx.rotate(Math.PI / 2); cx.drawImage(s, -6, -12); cx.restore(); return; }
    if (p.dodgeT) { cx.rotate(Math.sin(V.now * 40) * 0.6); cx.globalAlpha = 0.7; }
    if (flip) cx.scale(-1, 1);
    const bob = p.moving ? -Math.abs(Math.sin(p.anim * Math.PI)) : 0;
    cx.drawImage(s, -6, -16 + bob);
    cx.restore();
    // held item
    const it = p.inv[p.held]; if (it && !p.downed) {
      const d = G.ITEMS[it.id]; const icon = Sp.item(it.id);
      let ang = p.face; let dist = 7;
      if (p.swing) { const prog = p.swing.t / p.swing.dur; ang = p.swing.ang - p.swing.arc / 2 + p.swing.arc * prog; dist = 6 + p.swing.reach * 4; if (prog > 0.35 && prog < 0.7) { cx.strokeStyle = 'rgba(255,255,255,0.7)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(X, Y - 4, p.swing.reach * TS, p.swing.ang - p.swing.arc / 2, p.swing.ang + p.swing.arc / 2); cx.stroke(); } }
      cx.save(); cx.translate(X + Math.cos(ang) * dist, Y - 4 + Math.sin(ang) * dist);
      if (d.type === 'weapon' || d.type === 'tool') cx.rotate(ang + Math.PI / 4);
      else if (d.type === 'bow') { cx.rotate(ang); if (p.draw > 0) { cx.strokeStyle = '#fff'; cx.beginPath(); cx.moveTo(-2, -6); cx.lineTo(-2 - p.draw * 4, 0); cx.lineTo(-2, 6); cx.stroke(); } }
      else if (d.type === 'shield') { cx.rotate(ang); if (p.blocking) cx.translate(2, 0); }
      cx.drawImage(icon, -6, -6, 12, 12); cx.restore();
    } else if (!p.downed && p.swing) { const prog = p.swing.t / p.swing.dur; if (prog > 0.35 && prog < 0.7) { cx.strokeStyle = 'rgba(255,255,255,0.5)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(X, Y - 4, p.swing.reach * TS, p.swing.ang - p.swing.arc / 2, p.swing.ang + p.swing.arc / 2); cx.stroke(); } }
    if (p.burn) R.fx.parts.push({ x: p.x + (Math.random() - .5) * 0.5, y: p.y - 0.3, vx: 0, vy: -2, c: '#ff6a1a', t: 0, life: 0.3, g: -3 });
  }
  function drawPlayerOverlay(p, V, me) {
    if (p.dead) return;
    const X = wx(p.x), Y = wy(p.y);
    cx.font = '6px monospace'; cx.textAlign = 'center';
    if (p !== me) { cx.fillStyle = '#000'; cx.fillText(p.name, X + 1, Y - 17); cx.fillStyle = p.col; cx.fillText(p.name, X, Y - 18); cx.fillStyle = '#000'; cx.fillRect(X - 7, Y - 15, 14, 2); cx.fillStyle = '#e03030'; cx.fillRect(X - 7, Y - 15, 14 * Math.max(0, p.hp / p.maxHp), 2); }
    if (p.downed) { cx.strokeStyle = Math.floor(V.now * 4) % 2 ? '#ff3030' : '#ff9090'; cx.beginPath(); cx.arc(X, Y, 12, 0, 7); cx.stroke(); cx.fillStyle = '#ff6060'; cx.fillText('DOWN ' + p.bleed + 's', X, Y - 14); if (p.revive > 0) { cx.fillStyle = '#000'; cx.fillRect(X - 10, Y + 8, 20, 3); cx.fillStyle = '#60ff60'; cx.fillRect(X - 10, Y + 8, 20 * p.revive / 3, 3); } if (me && me !== p && !me.downed && G.dist(me.x, me.y, p.x, p.y) < 1.6) { cx.fillStyle = '#fff'; cx.fillText('hold E to revive', X, Y + 18); } }
    if (p.dark && p === me) { cx.fillStyle = '#8080ff'; cx.fillText('the dark bites...', X, Y - 24); }
  }

  function drawFx(dt, V) {
    const F = R.fx;
    for (let i = F.parts.length - 1; i >= 0; i--) { const p = F.parts[i]; p.t += dt; if (p.t > p.life) { F.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; cx.fillStyle = p.c; cx.globalAlpha = 1 - p.t / p.life; const sz = p.sz || 1; cx.fillRect(wx(p.x), wy(p.y), sz, sz); }
    cx.globalAlpha = 1;
    for (let i = F.floats.length - 1; i >= 0; i--) { const f = F.floats[i]; f.t += dt; f.y += f.vy * dt; if (f.t > 1.1) F.floats.splice(i, 1); }
    for (let i = F.booms.length - 1; i >= 0; i--) { const b = F.booms[i]; b.t += dt; if (b.t > 0.35) { F.booms.splice(i, 1); continue; } cx.strokeStyle = b.c; cx.globalAlpha = 1 - b.t / 0.35; cx.lineWidth = 2; cx.beginPath(); cx.arc(wx(b.x), wy(b.y), b.r * TS * (0.3 + b.t / 0.35 * 0.7), 0, 7); cx.stroke(); }
    for (let i = F.slashes.length - 1; i >= 0; i--) { const s = F.slashes[i]; s.t += dt; if (s.t > 0.2) { F.slashes.splice(i, 1); continue; } cx.strokeStyle = s.c; cx.globalAlpha = 1 - s.t / 0.2; cx.lineWidth = 2; cx.beginPath(); cx.arc(wx(s.x), wy(s.y), s.r * TS, s.a - 0.7, s.a + 0.7); cx.stroke(); }
    for (let i = F.zaps.length - 1; i >= 0; i--) { const z = F.zaps[i]; z.t += dt; if (z.t > 0.15) { F.zaps.splice(i, 1); continue; } cx.strokeStyle = '#a0d0ff'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(wx(z.x1), wy(z.y1)); const mx = (z.x1 + z.x2) / 2 + (Math.random() - .5), my = (z.y1 + z.y2) / 2 + (Math.random() - .5); cx.lineTo(wx(mx), wy(my)); cx.lineTo(wx(z.x2), wy(z.y2)); cx.stroke(); }
    for (let i = F.targets.length - 1; i >= 0; i--) { const t = F.targets[i]; t.t += dt; if (t.t > t.d) { F.targets.splice(i, 1); continue; } cx.strokeStyle = 'rgba(255,80,80,0.8)'; cx.lineWidth = 1; cx.beginPath(); cx.arc(wx(t.x), wy(t.y), t.r * TS, 0, 7); cx.stroke(); cx.fillStyle = 'rgba(255,60,60,0.25)'; cx.beginPath(); cx.arc(wx(t.x), wy(t.y), t.r * TS * (t.t / t.d), 0, 7); cx.fill(); }
    for (let i = F.pings.length - 1; i >= 0; i--) { F.pings[i].t += dt; if (F.pings[i].t > 4) F.pings.splice(i, 1); }
    for (const k in F.wobble) { F.wobble[k] -= dt; if (F.wobble[k] <= 0) delete F.wobble[k]; }
    for (const k in R.tellFlash) { R.tellFlash[k] -= dt; if (R.tellFlash[k] <= 0) delete R.tellFlash[k]; }
    cx.globalAlpha = 1; cx.lineWidth = 1;
  }

  function drawLighting(V, world, tx0, ty0, tx1, ty1) {
    const darkness = G.Sim.darkness({ time: V.time });
    if (darkness <= 0.01) return;
    dx.globalCompositeOperation = 'source-over';
    dx.clearRect(0, 0, R.W, R.H);
    dx.fillStyle = 'rgba(8,10,34,' + darkness + ')'; dx.fillRect(0, 0, R.W, R.H);
    dx.globalCompositeOperation = 'destination-out';
    const lights = [];
    for (let ty = ty0 - 6; ty <= ty1 + 6; ty++) for (let tx = tx0 - 6; tx <= tx1 + 6; tx++) {
      if (tx < 0 || ty < 0 || tx >= G.WORLD || ty >= G.WORLD) continue;
      const i = ty * G.WORLD + tx; const o = world.objs.get(i); if (o && O[o.t].light && !o.stub) lights.push({ x: tx + .5, y: ty + .5, r: O[o.t].light, f: 1 });
      if (world.tiles[i] === T.LAVA) lights.push({ x: tx + .5, y: ty + .5, r: 1.6, f: 0.8 });
    }
    for (const id in V.players) { const p = V.players[id]; if (p.dead) continue; const it = p.inv[p.held]; if (it && it.id === 'torch_hand') lights.push({ x: p.x, y: p.y, r: 3.5, f: 1 }); else lights.push({ x: p.x, y: p.y, r: 1.2, f: 0.5 }); }
    for (const pr of V.projs) if (pr.type === 'glob') lights.push({ x: pr.x, y: pr.y, r: 1.2, f: 0.8 });
    for (const p of V.puddles) lights.push({ x: p.x, y: p.y, r: 1.5, f: 0.6 });
    for (const e of V.enemies) if (e.t === 'crawler' || e.t === 'cinder') lights.push({ x: e.x, y: e.y, r: 2, f: 0.7 });
    for (const l of lights) {
      const flick = 1 + Math.sin(V.now * 9 + l.x * 7 + l.y * 3) * 0.06;
      const rr = l.r * TS * flick; const X = wx(l.x), Y = wy(l.y);
      const g = dx.createRadialGradient(X, Y, 0, X, Y, rr);
      g.addColorStop(0, 'rgba(0,0,0,' + l.f + ')'); g.addColorStop(0.6, 'rgba(0,0,0,' + (l.f * 0.7) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dx.fillStyle = g; dx.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
    }
    cx.drawImage(dark, 0, 0);
    // warm tint near lights (subtle)
    cx.globalCompositeOperation = 'lighter';
    for (const l of lights) { if (l.f < 0.7) continue; const rr = l.r * TS * 0.8, X = wx(l.x), Y = wy(l.y); const g = cx.createRadialGradient(X, Y, 0, X, Y, rr); g.addColorStop(0, 'rgba(255,140,40,' + (0.18 * darkness) + ')'); g.addColorStop(1, 'rgba(255,140,40,0)'); cx.fillStyle = g; cx.fillRect(X - rr, Y - rr, rr * 2, rr * 2); }
    cx.globalCompositeOperation = 'source-over';
  }

  function drawMinimap(V) {
    const W = G.WORLD; const sz = mini.width;
    if (!miniBase) {
      miniBase = document.createElement('canvas'); miniBase.width = W; miniBase.height = W; const mx = miniBase.getContext('2d');
      const img = mx.createImageData(W, W);
      for (let i = 0; i < W * W; i++) { const c = G.TILE_INFO[V.world.tiles[i]].col; const n = parseInt(c.slice(1), 16); img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255; }
      mx.putImageData(img, 0, 0);
    }
    minx.clearRect(0, 0, sz, sz);
    minx.drawImage(miniBase, 0, 0, sz, sz);
    const k = sz / W;
    for (const [i, o] of V.world.objs) { const d = O[o.t]; if (d.altar || d.boat || d.station === 'workbench' || d.chest === 3) { const x = (i % W) * k, y = Math.floor(i / W) * k; minx.fillStyle = d.boat ? '#ffffff' : d.altar ? (o.t === 'altar_meadow' ? '#30e070' : o.t === 'altar_forest' ? '#3070ff' : '#ff3050') : d.chest === 3 ? '#ffd24a' : '#b08040'; minx.fillRect(x - 1, y - 1, 3, 3); } }
    for (const e of V.enemies) if (G.ENEMIES[e.t].boss) { minx.fillStyle = '#ff2020'; minx.fillRect(e.x * k - 2, e.y * k - 2, 4, 4); }
    for (const id in V.players) { const p = V.players[id]; if (p.dead) continue; minx.fillStyle = p.col; minx.fillRect(p.x * k - 1.5, p.y * k - 1.5, 3, 3); if (id === V.me) { minx.strokeStyle = '#fff'; minx.strokeRect(p.x * k - 2.5, p.y * k - 2.5, 5, 5); } }
    for (const p of R.fx.pings) { minx.strokeStyle = p.col; minx.beginPath(); minx.arc(p.x * k, p.y * k, 3 + (p.t % 1) * 3, 0, 7); minx.stroke(); }
  }
})(window.G);
