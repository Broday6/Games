'use strict';
// TIDEWALL — renderer: camera, cached terrain, structures, enemies, projectiles, pooled particles, night lighting.
(function (TW) {
  const Art = TW.Art, T = TW.T, W = TW.W, H = TW.H, N = W * H;
  const TAU = Math.PI * 2;
  const R = TW.Rend = {};

  let cv, g, dpr = 1, vw = 0, vh = 0;
  let top = 0, bottom = 0;
  let ts0 = 32, zoom = 1, panX = 0, panY = 0, ts = 32, bx = 0, by = 0;
  const TM = 2; // terrain cache margin (tiles) so shoreline halos are not clipped
  let terrCv = null, terrTs = 0, terrDirty = true, spriteTs = 0, zoomSettle = 0;
  let run = null, coast = [], waterCells = [];
  let shakeAmt = 0, shakeX = 0, shakeY = 0;
  let dark = 0, darkTarget = 0;
  let time = 0;
  const lightCv = document.createElement('canvas'), LS = 8;
  lightCv.width = W * LS; lightCv.height = H * LS;
  const lg = lightCv.getContext('2d');
  const lightSprite = document.createElement('canvas');
  lightSprite.width = lightSprite.height = 64;
  {
    const sg = lightSprite.getContext('2d');
    const gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
  }
  R.settings = { shake: true, reduced: false };

  // ---------------- pools ----------------
  const MAXPT = 1000;
  const P = { x: new Float32Array(MAXPT), y: new Float32Array(MAXPT), vx: new Float32Array(MAXPT), vy: new Float32Array(MAXPT),
    life: new Float32Array(MAXPT), max: new Float32Array(MAXPT), size: new Float32Array(MAXPT), kind: new Uint8Array(MAXPT), col: new Array(MAXPT).fill('#fff'), n: 0, cur: 0 };
  function addP(kind, x, y, vx, vy, life, size, col) {
    let k = P.cur;
    for (let tries = 0; tries < MAXPT; tries++) { if (P.life[k] <= 0) break; k = (k + 1) % MAXPT; }
    P.cur = (k + 1) % MAXPT;
    P.kind[k] = kind; P.x[k] = x; P.y[k] = y; P.vx[k] = vx; P.vy[k] = vy; P.life[k] = life; P.max[k] = life; P.size[k] = size; P.col[k] = col;
  }
  const RINGS = []; for (let i = 0; i < 80; i++) RINGS.push({ t: 0, max: 0, x: 0, y: 0, r: 0, col: '' });
  const BOLTS = []; for (let i = 0; i < 48; i++) BOLTS.push({ t: 0, pts: new Float32Array(20), n: 0, col: '' });
  const BEAMS = []; for (let i = 0; i < 64; i++) BEAMS.push({ t: 0, x1: 0, y1: 0, x2: 0, y2: 0, col: '' });
  const TEXTS = []; for (let i = 0; i < 64; i++) TEXTS.push({ t: 0, x: 0, y: 0, s: '', col: '', big: false });
  function slot(arr) { let best = arr[0]; for (const o of arr) { if (o.t <= 0) return o; if (o.t < best.t) best = o; } return best; }
  const numStr = []; for (let i = 0; i <= 600; i++) numStr.push('+' + i);

  // ---------------- fx hooks for the sim ----------------
  R.onEvent = null; R.onSound = null;
  R.fx = {
    spark(x, y, col, n) { if (R.settings.reduced) n = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 1.5 + Math.random() * 3; addP(0, x, y, Math.cos(a) * s, Math.sin(a) * s - 1, 0.25 + Math.random() * 0.25, 0.05 + Math.random() * 0.04, col); } },
    puff(x, y, col, size) { const n = R.settings.reduced ? 3 : 7; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 0.4 + Math.random() * 1.2; addP(1, x, y, Math.cos(a) * s, Math.sin(a) * s - 0.3, 0.45 + Math.random() * 0.3, size * (0.18 + Math.random() * 0.14), col); } },
    text(x, y, s, col, big) { const o = slot(TEXTS); o.t = 1; o.x = x; o.y = y; o.s = s; o.col = col; o.big = !!big; },
    shake(a) { if (R.settings.shake) shakeAmt = Math.min(1, shakeAmt + a); },
    sound(n) { if (R.onSound) R.onSound(n); },
    ring(x, y, r, col) { const o = slot(RINGS); o.t = o.max = 0.45; o.x = x; o.y = y; o.r = r; o.col = col; },
    bolt(x1, y1, x2, y2, col) {
      const o = slot(BOLTS); o.t = 0.16; o.col = col; o.n = 10;
      const dx = x2 - x1, dy = y2 - y1, nx = -dy, ny = dx, L = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 10; i++) {
        const u = i / 9, j = (i === 0 || i === 9) ? 0 : (Math.random() - 0.5) * 0.35;
        o.pts[i * 2] = x1 + dx * u + nx / L * j; o.pts[i * 2 + 1] = y1 + dy * u + ny / L * j;
      }
    },
    beam(x1, y1, x2, y2, col) { const o = slot(BEAMS); o.t = 0.12; o.x1 = x1; o.y1 = y1; o.x2 = x2; o.y2 = y2; o.col = col; },
    flame(x, y, r, col) {
      const n = R.settings.reduced ? 6 : 14;
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = r * (1.6 + Math.random() * 1.4); addP(2, x, y - 0.2, Math.cos(a) * s, Math.sin(a) * s - 0.4, 0.35 + Math.random() * 0.15, 0.12 + Math.random() * 0.08, col); }
      R.fx.ring(x, y, r, col);
    },
    haptic() {},
    event(name, a, b) { if (R.onEvent) R.onEvent(name, a, b); },
  };
  R.gold = function (x, y, g) { R.fx.text(x, y - 0.3, numStr[Math.min(600, g)] || '+' + g, '#ffd75a', false); };
  R.clearFx = function () { for (let i = 0; i < MAXPT; i++) P.life[i] = 0; for (const a of [RINGS, BOLTS, BEAMS, TEXTS]) for (const o of a) o.t = 0; };

  // ---------------- setup / camera ----------------
  R.init = function (canvas) { cv = canvas; g = cv.getContext('2d'); };
  R.setRun = function (r) {
    run = r; terrDirty = true; zoom = 1; panX = panY = 0; R.clearFx();
    coast = []; waterCells = [];
    if (!r) return;
    const terr = r.terr;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = terr[y * W + x];
      if (t === T.WATER) { waterCells.push(x, y); continue; }
      const wat = (xx, yy) => Art.isWater(terr, W, H, xx, yy);
      if (wat(x, y - 1)) coast.push(x, y, x + 1, y);
      if (wat(x, y + 1)) coast.push(x, y + 1, x + 1, y + 1);
      if (wat(x - 1, y)) coast.push(x, y, x, y + 1);
      if (wat(x + 1, y)) coast.push(x + 1, y, x + 1, y + 1);
    }
  };
  R.resize = function (t, b) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    top = t; bottom = b;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
    const availW = vw - 8, availH = vh - top - bottom - 6;
    ts0 = Math.max(12, Math.floor(Math.min(availW / W, availH / H) * 4) / 4);
    terrDirty = true;
    clampCam(); layout();
  };
  function layout() {
    ts = ts0 * zoom;
    const bw = W * ts, bh = H * ts;
    bx = (vw - bw) / 2 + panX;
    by = top + (vh - top - bottom - bh) / 2 + panY;
  }
  function clampCam() {
    const bw = W * ts0 * zoom, bh = H * ts0 * zoom;
    const availH = vh - top - bottom;
    const mx = Math.max(0, (bw - vw) / 2 + 24), my = Math.max(0, (bh - availH) / 2 + 24);
    panX = Math.max(-mx, Math.min(mx, panX)); panY = Math.max(-my, Math.min(my, panY));
  }
  R.zoomAt = function (f, px, py) {
    const nz = Math.max(1, Math.min(2.4, zoom * f));
    if (nz === zoom) return;
    // keep point under finger fixed
    const wx = (px - bx) / ts, wy = (py - by) / ts;
    zoom = nz; layout();
    panX += px - (bx + wx * ts); panY += py - (by + wy * ts);
    clampCam(); layout();
    zoomSettle = 0.18;
  };
  R.pan = function (dx, dy) { panX += dx; panY += dy; clampCam(); layout(); };
  R.resetCam = function () { zoom = 1; panX = panY = 0; layout(); zoomSettle = 0.05; };
  R.zoomed = function () { return zoom > 1.01; };
  R.toCell = function (px, py) {
    const x = Math.floor((px - bx) / ts), y = Math.floor((py - by) / ts);
    if (x < 0 || y < 0 || x >= W || y >= H) return -1;
    return y * W + x;
  };
  R.toWorld = function (px, py) { return { x: (px - bx) / ts, y: (py - by) / ts }; };
  R.cellRect = function (i) { const x = i % W, y = (i / W) | 0; return { x: bx + x * ts, y: by + y * ts, s: ts }; };
  R.worldToScreen = function (x, y) { return { x: bx + x * ts, y: by + y * ts }; };
  R.tileSize = function () { return ts; };
  R.setNight = function (on, instant) { darkTarget = on ? 0.66 : 0; if (instant) dark = darkTarget; };
  R.terrainDirty = function () { terrDirty = true; };

  function buildTerrain() {
    terrTs = ts; spriteTs = Math.round(ts * dpr);
    const pw = Math.ceil((W + TM * 2) * ts * dpr), ph = Math.ceil((H + TM * 2) * ts * dpr);
    if (!terrCv) terrCv = document.createElement('canvas');
    terrCv.width = pw; terrCv.height = ph;
    const tg = terrCv.getContext('2d');
    tg.setTransform(1, 0, 0, 1, TM * ts * dpr, TM * ts * dpr);
    Art.drawTerrain(tg, run.map, ts * dpr);
    terrDirty = false;
  }

  // island preview for the expedition screen
  R.drawPreview = function (canvas, map, cssW) {
    const d = Math.min(2, window.devicePixelRatio || 1);
    const tsz = cssW / W;
    canvas.width = Math.round(cssW * d); canvas.height = Math.round(tsz * H * d);
    canvas.style.width = cssW + 'px'; canvas.style.height = (tsz * H) + 'px';
    const pg = canvas.getContext('2d');
    Art.drawTerrain(pg, map, tsz * d);
    pg.save(); pg.scale(d, d);
    const cx = (map.core % W + 0.5) * tsz, cy = (((map.core / W) | 0) + 0.5) * tsz;
    Art.lighthouse(pg, cx, cy, tsz, 0, true, 1);
    map.spawns.forEach((sp, k) => {
      const x = (sp % W + 0.5) * tsz, y = (((sp / W) | 0) + 0.5) * tsz;
      pg.fillStyle = k === 0 ? 'rgba(120,80,255,0.85)' : 'rgba(120,80,255,0.5)';
      pg.beginPath(); pg.arc(x, y, tsz * 0.3, 0, TAU); pg.fill();
      pg.strokeStyle = '#fff'; pg.lineWidth = 1.5; pg.stroke();
    });
    pg.restore();
  };

  // ---------------- frame ----------------
  // ui: { sel, hover, radialCell, preview: {cells, kind, type, routes, ok}, drag, showRange }
  R.frame = function (dt, ui) {
    time += dt;
    if (!run) { g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#0a2a44'; g.fillRect(0, 0, vw, vh); return; }
    if (zoomSettle > 0) { zoomSettle -= dt; if (zoomSettle <= 0) terrDirty = true; }
    if (terrDirty || !terrCv) buildTerrain();
    dark += (darkTarget - dark) * Math.min(1, dt * 1.6);
    if (shakeAmt > 0) { shakeAmt = Math.max(0, shakeAmt - dt * 2.4); const a = shakeAmt * shakeAmt * ts * 0.35; shakeX = (Math.random() - 0.5) * a; shakeY = (Math.random() - 0.5) * a; } else { shakeX = shakeY = 0; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sea backdrop
    g.fillStyle = '#11507c'; g.fillRect(0, 0, vw, vh);
    drawSeaLines();
    const ox = bx + shakeX, oy = by + shakeY;
    g.drawImage(terrCv, ox - TM * ts, oy - TM * ts, (W + TM * 2) * ts, (H + TM * 2) * ts);
    g.save(); g.translate(ox, oy);
    drawWater();
    drawRoutes(ui);
    drawSpawns();
    drawWorld(ui);
    drawProjectiles();
    drawParticles(dt);
    g.restore();
    if (dark > 0.01) drawDarkness(ox, oy);
    g.save(); g.translate(ox, oy);
    drawGlows();
    drawFxTop(dt);
    drawBars();
    drawOverlay(ui);
    drawTexts(dt);
    g.restore();
  };

  function drawSeaLines() {
    g.strokeStyle = 'rgba(140,210,240,0.10)'; g.lineWidth = 1.5;
    const step = 26;
    for (let y = -step + ((time * 6) % step); y < vh + step; y += step) {
      g.beginPath();
      for (let x = 0; x <= vw + 20; x += 20) { const yy = y + Math.sin(x * 0.03 + time * 0.8 + y * 0.1) * 3; if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
      g.stroke();
    }
  }
  function drawWater() {
    // twinkles over water + animated foam on coast
    g.strokeStyle = 'rgba(220,250,255,0.22)'; g.lineWidth = Math.max(1, ts * 0.04);
    g.beginPath();
    for (let k = 0; k < waterCells.length; k += 2) {
      const x = waterCells[k], y = waterCells[k + 1], h = Art.hash2(x, y, 7);
      const ph = time * 0.9 + h * 6.28, s = Math.sin(ph);
      if (s < 0.2) continue;
      const cx = (x + 0.2 + h * 0.6) * ts, cy = (y + 0.3 + Art.hash2(y, x, 3) * 0.4) * ts, w = ts * 0.16 * s;
      g.moveTo(cx - w, cy); g.quadraticCurveTo(cx, cy - ts * 0.06, cx + w, cy);
    }
    g.stroke();
    const f = 0.35 + 0.2 * Math.sin(time * 1.6);
    g.strokeStyle = 'rgba(255,255,255,' + f.toFixed(3) + ')'; g.lineWidth = Math.max(1.5, ts * 0.07); g.lineCap = 'round';
    g.beginPath();
    const off = Math.sin(time * 1.2) * ts * 0.04;
    for (let k = 0; k < coast.length; k += 4) {
      const x1 = coast[k], y1 = coast[k + 1], x2 = coast[k + 2], y2 = coast[k + 3];
      const nx = y1 === y2 ? 0 : 1, ny = y1 === y2 ? 1 : 0;
      g.moveTo(x1 * ts + ts * 0.12 * nx + off * ny, y1 * ts + ts * 0.12 * ny + off * nx); g.lineTo(x2 * ts - ts * 0.12 * nx + off * ny, y2 * ts - ts * 0.12 * ny + off * nx);
    }
    g.stroke(); g.lineCap = 'butt';
  }
  const dashA = [0, 0], dashB = [0, 0], dashC = [0, 0], NODASH = [];
  function pathLine(p, col, w, dash, speed) {
    if (!p || p.length < 2) return;
    g.strokeStyle = col; g.lineWidth = w;
    g.setLineDash(dash); g.lineDashOffset = -time * speed;
    g.beginPath();
    for (let k = 0; k < p.length; k++) { const c = p[k], x = (c % W + 0.5) * ts, y = (((c / W) | 0) + 0.5) * ts; if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke(); g.setLineDash(NODASH);
  }
  function drawRoutes(ui) {
    const night = run.phase === 'night';
    const cur = run.routes;
    if (!cur) return;
    const pv = ui.preview && ui.preview.routes;
    g.lineJoin = 'round'; g.lineCap = 'round';
    dashA[0] = ts * 0.18; dashA[1] = ts * 0.22; dashB[0] = ts * 0.22; dashB[1] = ts * 0.16;
    for (const p of cur.paths) pathLine(p, night ? 'rgba(255,93,115,0.22)' : (pv ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.6)'), Math.max(2, ts * (pv ? 0.06 : 0.09)), dashA, ts * 0.8);
    if (pv) {
      const col = pv.sealed || pv.breach.length ? '#ff7a5a' : '#5ce1e6';
      for (const p of pv.paths) pathLine(p, col, Math.max(2.5, ts * 0.11), dashB, ts * 1.2);
      drawBreach(pv.breach, true);
    } else if (!night) drawBreach(cur.breach, false);
    g.lineCap = 'butt';
  }
  function drawBreach(list, strong) {
    if (!list || !list.length) return;
    const a = 0.55 + 0.35 * Math.sin(time * 6);
    g.strokeStyle = 'rgba(255,80,80,' + (strong ? a : a * 0.7) + ')'; g.lineWidth = Math.max(2, ts * 0.08);
    for (const c of list) {
      const x = (c % W) * ts, y = ((c / W) | 0) * ts, m = ts * 0.22;
      g.beginPath(); g.moveTo(x + m, y + m); g.lineTo(x + ts - m, y + ts - m); g.moveTo(x + ts - m, y + m); g.lineTo(x + m, y + ts - m); g.stroke();
    }
  }
  function drawSpawns() {
    const act = run.spawnsActive(run.phase === 'night' ? run.night : run.night);
    for (let k = 0; k < run.map.spawns.length; k++) {
      const sp = run.map.spawns[k], on = k < act.length;
      const x = (sp % W + 0.5) * ts, y = (((sp / W) | 0) + 0.5) * ts;
      g.save(); g.translate(x, y - ts * 0.55); g.scale(1, 0.45);
      const r = ts * (on ? 0.42 : 0.3);
      g.fillStyle = on ? 'rgba(40,20,80,0.75)' : 'rgba(40,20,80,0.3)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      if (on) {
        g.rotate(time * 1.6);
        g.strokeStyle = 'rgba(170,120,255,0.85)'; g.lineWidth = Math.max(1.5, ts * 0.06);
        for (let s = 0; s < 3; s++) { g.beginPath(); g.arc(0, 0, r * (0.35 + s * 0.22), s * 2, s * 2 + 3.6); g.stroke(); }
      }
      g.restore();
    }
  }
  const nbOf = (s) => {
    let m = 0; const x = s.x, y = s.y, occ = run.occ, st = run.structs;
    const isW = (xx, yy) => { if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false; const id = occ[yy * W + xx]; return id >= 0 && st[id] && st[id].kind === 'wall'; };
    if (isW(x - 1, y)) m |= 1; if (isW(x + 1, y)) m |= 2; if (isW(x, y - 1)) m |= 4; if (isW(x, y + 1)) m |= 8;
    return m;
  };
  function drawWorld(ui) {
    const occ = run.occ, st = run.structs, E = run.enemies, head = run.head;
    const night = run.phase === 'night';
    // tar pools
    for (const t of run.tars) {
      if (!t.active) continue;
      g.fillStyle = 'rgba(60,32,14,' + Math.min(0.22, t.t * 0.15).toFixed(3) + ')';
      g.beginPath(); g.ellipse(t.x * ts, t.y * ts, t.r * ts, t.r * ts * 0.6, 0, 0, TAU); g.fill();
      if (Math.random() < 0.3) addP(2, t.x + (Math.random() - 0.5) * t.r, t.y + (Math.random() - 0.5) * t.r * 0.5, 0, -0.6, 0.4, 0.08, '#ff9a3a');
    }
    // burrowed movers (under everything)
    for (let k = 0; k < E.length; k++) {
      const e = E[k];
      if (!e.active || !e.burrowed) continue;
      const x = e.x * ts, y = e.y * ts;
      g.fillStyle = '#6b4a30'; g.beginPath(); g.ellipse(x, y + ts * 0.08, ts * 0.26, ts * 0.12, 0, 0, TAU); g.fill();
      g.fillStyle = '#8a6040'; g.beginPath(); g.ellipse(x, y + ts * 0.02, ts * 0.18, ts * 0.09, 0, 0, TAU); g.fill();
      if (Math.random() < 0.08) addP(1, e.x, e.y, (Math.random() - 0.5) * 0.6, -0.4, 0.4, 0.06, '#8a6040');
    }
    const coreRow = (run.core / W) | 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, id = occ[i];
        if (id < 0) continue;
        const s = st[id]; if (!s) continue;
        const cx = (x + 0.5) * ts, cy = (y + 0.5) * ts;
        if (s.kind === 'wall') Art.wall(g, x * ts, y * ts, ts, s.stone, nbOf(s), s.flash, s.hp / s.maxHp);
        else if (s.kind === 'harv') Art.harvester(g, cx, cy, ts, time, 'w');
        else Art.tower(g, s.type, s.tier, s.br, cx, cy, ts, time + s.id, s.aim, s.pulse, s.flash);
        if (ui.sel === s) { g.strokeStyle = '#ffd27a'; g.lineWidth = Math.max(2, ts * 0.06); Art.rr(g, x * ts + 2, y * ts + 2, ts - 4, ts - 4, ts * 0.18); g.stroke(); }
      }
      if (y === coreRow) {
        const lampY = Art.lighthouse(g, run.cx * ts, run.cy * ts, ts, time, true, run.hp / run.maxHp);
        R.lampY = lampY;
      }
      // ground enemies in this row (from the sim's spatial grid)
      for (let x = 0; x < W; x++) {
        let k = head[y * W + x];
        while (k >= 0) { const e = E[k]; k = run.enext[k]; if (e.active && !e.fly) drawEnemy(e); }
      }
    }
    // flyers above everything
    for (let k = 0; k < E.length; k++) { const e = E[k]; if (e.active && e.fly && !e.burrowed) drawEnemy(e); }
  }
  function drawEnemy(e) {
    if (spriteTs !== Math.round(ts * dpr) && zoomSettle <= 0) spriteTs = Math.round(ts * dpr);
    const frame = ((e.t * (e.fly ? 6 : 5) + e.wob) | 0) & 1;
    const hidden = e.invis && e.revealT <= 0;
    const spr = Art.sprite(e.id, spriteTs, frame, e.hitT > 0);
    const sc = ts * dpr / spriteTs;
    const w = spr.width / dpr * sc, h = spr.height / dpr * sc;
    const bob = e.fly ? Math.sin(e.t * 4 + e.wob) * ts * 0.06 - ts * 0.35 : -Math.abs(Math.sin(e.t * 8 + e.wob)) * ts * 0.04;
    const x = e.x * ts, y = e.y * ts;
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(x, y + e.r * ts * 0.7, e.r * ts * 0.85, e.r * ts * 0.3, 0, 0, TAU); g.fill();
    if (hidden) g.globalAlpha = 0.16 + 0.08 * Math.sin(time * 5 + e.wob);
    else if (e.def.invis || e.faded) g.globalAlpha = 0.75;
    if (e.face < 0) { g.save(); g.translate(x, y + bob); g.scale(-1, 1); g.drawImage(spr, -w / 2, -h / 2, w, h); g.restore(); }
    else g.drawImage(spr, x - w / 2, y + bob - h / 2, w, h);
    g.globalAlpha = 1;
    if (hidden) return;
    // status overlays
    if (e.shield > 0) { g.strokeStyle = 'rgba(120,200,255,' + (0.35 + 0.5 * e.shield / Math.max(1, e.shieldMax)) + ')'; g.lineWidth = Math.max(1.5, ts * 0.05); g.beginPath(); g.arc(x, y + bob, e.r * ts * 1.35, 0, TAU); g.stroke(); }
    if (e.freezeT > 0) { g.fillStyle = 'rgba(200,245,255,0.55)'; g.beginPath(); g.arc(x, y + bob, e.r * ts * 1.1, 0, TAU); g.fill(); }
    else if (e.slowT > 0 && e.slow > 0) { g.fillStyle = 'rgba(143,227,255,0.28)'; g.beginPath(); g.arc(x, y + bob, e.r * ts * 1.05, 0, TAU); g.fill(); }
    if (e.burnT > 0 && Math.random() < 0.35) addP(2, e.x + (Math.random() - 0.5) * e.r, e.y - e.r * 0.5, 0, -0.9, 0.3, 0.07, '#ff8a3d');
    if (e.rootT > 0) { g.strokeStyle = '#5fd3b0'; g.lineWidth = Math.max(1, ts * 0.04); g.beginPath(); g.ellipse(x, y + e.r * ts * 0.6, e.r * ts * 1.1, e.r * ts * 0.4, 0, 0, TAU); g.stroke(); }
    if (e.stunT > 0 && !e.fly) { g.fillStyle = '#ffe27a'; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; g.fillRect(x + Math.cos(a) * e.r * ts - 1.5, y - e.r * ts * 1.2 + Math.sin(a) * 3 - 1.5, 3, 3); } }
    if (e.atk && Math.random() < 0.05) addP(0, e.x, e.y - 0.1, (Math.random() - 0.5) * 2, -1.5, 0.2, 0.05, '#ffe0a0');
  }
  function drawProjectiles() {
    const PR = run.projs;
    for (let k = 0; k < PR.length; k++) {
      const p = PR[k];
      if (!p.active) continue;
      const x = p.x * ts, y = p.y * ts;
      if (p.kind === 'arrow') {
        const big = p.src && p.src.br === 1 && p.src.tier === 2;
        const L = ts * (big ? 0.5 : 0.3);
        g.strokeStyle = big ? '#e8ecf6' : '#f3dcb0'; g.lineWidth = Math.max(1.5, ts * (big ? 0.07 : 0.045));
        g.beginPath(); g.moveTo(x - Math.cos(p.ang) * L, y - Math.sin(p.ang) * L); g.lineTo(x, y); g.stroke();
      } else if (p.kind === 'harpoon') {
        const sx = (p.src.x + 0.5) * ts, sy = (p.src.y + 0.3) * ts;
        g.strokeStyle = 'rgba(220,240,235,0.7)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(x, y); g.stroke();
        g.strokeStyle = '#d6fff2'; g.lineWidth = Math.max(2, ts * 0.06);
        g.beginPath(); g.moveTo(x - Math.cos(p.ang) * ts * 0.35, y - Math.sin(p.ang) * ts * 0.35); g.lineTo(x, y); g.stroke();
      } else if (p.kind === 'bomb') {
        const z = p.z * ts;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y, ts * 0.12, ts * 0.05, 0, 0, TAU); g.fill();
        g.fillStyle = p.small ? '#ffcf8a' : '#2a2c34'; g.beginPath(); g.arc(x, y - z, ts * (p.small ? 0.07 : 0.12), 0, TAU); g.fill();
        if (!p.small) { g.fillStyle = '#ffb067'; g.beginPath(); g.arc(x + ts * 0.05, y - z - ts * 0.08, ts * 0.04, 0, TAU); g.fill(); }
      }
    }
  }
  function drawParticles(dt) {
    for (let k = 0; k < MAXPT; k++) {
      if (P.life[k] <= 0) continue;
      P.life[k] -= dt;
      if (P.life[k] <= 0) continue;
      const u = P.life[k] / P.max[k], kind = P.kind[k];
      P.x[k] += P.vx[k] * dt; P.y[k] += P.vy[k] * dt;
      if (kind === 0) { P.vy[k] += 6 * dt; P.vx[k] *= 0.96; }
      else { P.vx[k] *= 0.92; P.vy[k] *= 0.92; }
      const x = P.x[k] * ts, y = P.y[k] * ts;
      g.fillStyle = P.col[k];
      if (kind === 0) { g.globalAlpha = u; const s = P.size[k] * ts; g.fillRect(x - s / 2, y - s / 2, s, s); }
      else if (kind === 1) { g.globalAlpha = u * 0.7; g.beginPath(); g.arc(x, y, P.size[k] * ts * (1.6 - u * 0.6), 0, TAU); g.fill(); }
      else { g.globalAlpha = u * 0.9; g.beginPath(); g.arc(x, y, P.size[k] * ts * (0.5 + u * 0.6), 0, TAU); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  function addLight(x, y, r) {
    const s = r * 2 * LS;
    lg.drawImage(lightSprite, x * LS - s / 2, y * LS - s / 2, s, s);
  }
  function drawDarkness(ox, oy) {
    const a = dark;
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, lightCv.width, lightCv.height);
    lg.fillStyle = 'rgba(6,10,34,' + a.toFixed(3) + ')';
    lg.fillRect(0, 0, lightCv.width, lightCv.height);
    lg.globalCompositeOperation = 'destination-out';
    addLight(run.cx, run.cy - 0.6, 3.3 + 0.15 * Math.sin(time * 2));
    for (const s of run.structs) {
      if (!s || s.kind !== 'tower') continue;
      const x = s.x + 0.5, y = s.y + 0.4;
      if (s.type === 'brazier') addLight(x, y, 1.9 + 0.12 * Math.sin(time * 9 + s.id) + s.pulse);
      else if (s.type === 'lantern') addLight(x + 0.15, y - 0.3, (s.st ? s.st.range : 2.5) * 0.95);
      else if (s.type === 'tesla') addLight(x, y - 0.4, 1.1 + s.pulse * 3);
      else if (s.type === 'shrine') addLight(x, y - 0.3, 1.2);
      else addLight(x, y, 0.75);
    }
    for (let i = 0; i < N; i++) if (run.terr[i] === T.CRYSTAL) addLight(i % W + 0.5, ((i / W) | 0) + 0.5, 0.9);
    for (const o of RINGS) if (o.t > 0) addLight(o.x, o.y, o.r * 0.9 * (o.t / o.max) + 0.3);
    for (const o of BEAMS) if (o.t > 0) addLight(o.x2, o.y2, 0.6);
    for (const t of run.tars) if (t.active) addLight(t.x, t.y, t.r * 0.8);
    lg.globalCompositeOperation = 'source-over';
    g.drawImage(lightCv, ox, oy, W * ts, H * ts);
    // margins
    g.fillStyle = 'rgba(6,10,34,' + a.toFixed(3) + ')';
    const bw = W * ts, bh = H * ts;
    if (oy > 0) g.fillRect(0, 0, vw, oy);
    if (oy + bh < vh) g.fillRect(0, oy + bh, vw, vh - oy - bh);
    if (ox > 0) g.fillRect(0, Math.max(0, oy), ox, Math.min(vh, bh));
    if (ox + bw < vw) g.fillRect(ox + bw, Math.max(0, oy), vw - ox - bw, Math.min(vh, bh));
  }
  function drawGlows() {
    if (dark < 0.05) return;
    const a = dark / 0.66;
    // lighthouse sweep
    const lx = run.cx * ts, ly = (R.lampY !== undefined ? R.lampY : (run.cy - 1) * ts);
    const ang = run.phase === 'night' && run.beamFlash > 0 ? run.beamAim : -Math.PI / 2 + Math.sin(time * 0.5) * 1.2;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.translate(lx, ly); g.rotate(ang);
    const L = ts * 4.2, gr = g.createLinearGradient(0, 0, L, 0);
    gr.addColorStop(0, 'rgba(255,236,170,' + (0.32 * a).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -ts * 0.08); g.lineTo(L, -ts * 0.8); g.lineTo(L, ts * 0.8); g.lineTo(0, ts * 0.08); g.closePath(); g.fill();
    g.restore();
    // eyes of the shadows
    const E = run.enemies;
    g.fillStyle = 'rgba(255,230,120,' + (0.85 * a).toFixed(3) + ')';
    for (let k = 0; k < E.length; k++) {
      const e = E[k];
      if (!e.active || e.burrowed || (e.invis && e.revealT <= 0)) continue;
      const bob = e.fly ? Math.sin(e.t * 4 + e.wob) * ts * 0.06 - ts * 0.35 : 0;
      const R0 = e.r * ts, ex = e.x * ts, ey = e.y * ts + bob - R0 * 0.2, s = Math.max(1.5, R0 * 0.22);
      g.fillRect(ex - R0 * 0.35 - s / 2, ey - s / 2, s, s); g.fillRect(ex + R0 * 0.35 - s / 2, ey - s / 2, s, s);
    }
  }
  function drawFxTop(dt) {
    g.lineCap = 'round';
    for (const o of RINGS) {
      if (o.t <= 0) continue;
      o.t -= dt; if (o.t <= 0) continue;
      const u = 1 - o.t / o.max;
      g.strokeStyle = o.col; g.globalAlpha = (1 - u) * 0.8; g.lineWidth = Math.max(1.5, ts * 0.08 * (1 - u));
      g.beginPath(); g.arc(o.x * ts, o.y * ts, o.r * ts * (0.3 + 0.7 * u), 0, TAU); g.stroke();
    }
    for (const o of BOLTS) {
      if (o.t <= 0) continue;
      o.t -= dt; if (o.t <= 0) continue;
      g.globalAlpha = Math.min(1, o.t * 8);
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? '#ffffff' : o.col; g.lineWidth = pass ? Math.max(1, ts * 0.03) : Math.max(2, ts * 0.09);
        g.beginPath();
        for (let i = 0; i < o.n; i++) { const x = o.pts[i * 2] * ts, y = o.pts[i * 2 + 1] * ts; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
    }
    for (const o of BEAMS) {
      if (o.t <= 0) continue;
      o.t -= dt; if (o.t <= 0) continue;
      g.globalAlpha = Math.min(1, o.t * 10);
      g.strokeStyle = o.col; g.lineWidth = Math.max(1.5, ts * 0.07);
      g.beginPath(); g.moveTo(o.x1 * ts, o.y1 * ts); g.lineTo(o.x2 * ts, o.y2 * ts); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, ts * 0.025); g.stroke();
    }
    g.globalAlpha = 1; g.lineCap = 'butt';
  }
  function drawBars() {
    const E = run.enemies;
    for (let k = 0; k < E.length; k++) {
      const e = E[k];
      if (!e.active || e.burrowed || e.boss || (e.invis && e.revealT <= 0)) continue;
      if (e.hp >= e.maxHp && e.shield >= e.shieldMax) continue;
      const w = Math.max(ts * 0.5, e.r * ts * 2), x = e.x * ts - w / 2, y = e.y * ts - e.r * ts - ts * (e.fly ? 0.62 : 0.22);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, y - 1, w + 2, 4);
      g.fillStyle = e.hp / e.maxHp > 0.5 ? '#7dff8a' : (e.hp / e.maxHp > 0.25 ? '#ffd24a' : '#ff5d5d');
      g.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 2);
      if (e.shieldMax > 0 && e.shield > 0) { g.fillStyle = '#7ac8ff'; g.fillRect(x, y - 2, w * e.shield / e.shieldMax, 1.5); }
    }
    // damaged structures
    for (const s of run.structs) {
      if (!s || s.hp >= s.maxHp) continue;
      const w = ts * 0.7, x = s.x * ts + ts * 0.15, y = s.y * ts + ts * 0.02;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, y - 1, w + 2, 5);
      g.fillStyle = s.hp / s.maxHp > 0.4 ? '#ffc35a' : '#ff5d5d'; g.fillRect(x, y, w * s.hp / s.maxHp, 3);
    }
  }
  function rangeCircle(cx, cy, r, col, fill) {
    g.fillStyle = fill; g.strokeStyle = col; g.lineWidth = Math.max(1.5, ts * 0.05);
    dashC[0] = ts * 0.2; dashC[1] = ts * 0.12;
    g.setLineDash(dashC); g.lineDashOffset = -time * ts * 0.4;
    g.beginPath(); g.arc(cx * ts, cy * ts, r * ts, 0, TAU); g.fill(); g.stroke(); g.setLineDash(NODASH);
  }
  function drawOverlay(ui) {
    // hover (desktop)
    if (ui.hover >= 0 && run.phase === 'day' && !ui.preview) {
      const x = ui.hover % W, y = (ui.hover / W) | 0;
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; Art.rr(g, x * ts + 2, y * ts + 2, ts - 4, ts - 4, ts * 0.15); g.stroke();
    }
    if (ui.radialCell >= 0) {
      const x = ui.radialCell % W, y = (ui.radialCell / W) | 0;
      g.fillStyle = 'rgba(255,210,122,0.25)'; g.strokeStyle = '#ffd27a'; g.lineWidth = Math.max(2, ts * 0.07);
      Art.rr(g, x * ts + 2, y * ts + 2, ts - 4, ts - 4, ts * 0.18); g.fill(); g.stroke();
    }
    const pv = ui.preview;
    if (pv) {
      const bad = pv.routes && (pv.routes.sealed || pv.routes.breach.length);
      for (const c of pv.cells) {
        const x = c % W, y = (c / W) | 0, ok = run.cellFree(c);
        g.globalAlpha = 0.55 + 0.15 * Math.sin(time * 5);
        if (!ok) { g.fillStyle = 'rgba(255,80,80,0.5)'; g.fillRect(x * ts + 3, y * ts + 3, ts - 6, ts - 6); g.globalAlpha = 1; continue; }
        if (pv.kind === 'wall') Art.wall(g, x * ts, y * ts, ts, false, 0, 0, 1);
        else if (pv.kind === 'harv') Art.harvester(g, (x + 0.5) * ts, (y + 0.5) * ts, ts, time, 'w');
        else Art.tower(g, pv.type, 0, -1, (x + 0.5) * ts, (y + 0.5) * ts, ts, time, -Math.PI / 2, 0, 0);
        g.globalAlpha = 1;
        g.strokeStyle = bad ? '#ff7a5a' : '#5ce1e6'; g.lineWidth = Math.max(1.5, ts * 0.05);
        Art.rr(g, x * ts + 2, y * ts + 2, ts - 4, ts - 4, ts * 0.15); g.stroke();
      }
      if (pv.kind === 'tower' && pv.cells.length === 1) {
        const c = pv.cells[0], st = run.statsFor(pv.type, 0, 0, null);
        rangeCircle(c % W + 0.5, ((c / W) | 0) + 0.5, st.range, 'rgba(92,225,230,0.9)', 'rgba(92,225,230,0.10)');
        if (st.min) rangeCircle(c % W + 0.5, ((c / W) | 0) + 0.5, st.min, 'rgba(255,120,90,0.7)', 'rgba(0,0,0,0)');
      }
    }
    if (ui.drag && ui.drag.length) {
      for (const c of ui.drag) {
        const x = c % W, y = (c / W) | 0, ok = run.cellFree(c);
        g.fillStyle = ok ? 'rgba(255,210,122,0.35)' : 'rgba(255,80,80,0.35)';
        g.fillRect(x * ts + 2, y * ts + 2, ts - 4, ts - 4);
      }
    }
    const s = ui.sel;
    if (s && run.structs[s.id] === s && s.kind === 'tower' && s.st) {
      const cx = s.x + 0.5, cy = s.y + 0.5;
      if (s.type === 'shrine') rangeCircle(cx, cy, s.st.range, 'rgba(233,140,255,0.9)', 'rgba(233,140,255,0.10)');
      else {
        rangeCircle(cx, cy, s.st.range, 'rgba(255,210,122,0.95)', 'rgba(255,210,122,0.10)');
        if (s.st.min) rangeCircle(cx, cy, s.st.min, 'rgba(255,120,90,0.7)', 'rgba(0,0,0,0)');
      }
    }
    if (ui.coreSel) rangeCircle(run.cx, run.cy, TW.CORE_RANGE + run.mods.beamRange, 'rgba(255,236,170,0.9)', 'rgba(255,236,170,0.08)');
  }
  function drawTexts(dt) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const o of TEXTS) {
      if (o.t <= 0) continue;
      o.t -= dt * 1.1; if (o.t <= 0) continue;
      const u = 1 - o.t;
      const x = o.x * ts, y = o.y * ts - u * ts * 0.7;
      const fs = Math.max(11, ts * (o.big ? 0.55 : 0.36)) * (u < 0.15 ? 0.7 + u * 2 : 1);
      g.font = '900 ' + fs.toFixed(1) + 'px ui-rounded, system-ui, sans-serif';
      g.globalAlpha = Math.min(1, o.t * 3);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(o.s, x + 1, y + 1.5);
      g.fillStyle = o.col; g.fillText(o.s, x, y);
    }
    g.globalAlpha = 1;
  }
})(window.TW = window.TW || {});
