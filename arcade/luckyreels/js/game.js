'use strict';
// LUCKY REELS — canvas renderer: the cabinet, reels, and the step-by-step playback of a spin's event log
// (arrows between interacting symbols, value pops, coins flying into the counter).
(function (LR) {
  const SY = LR.SYMBOLS, N = LR.CELLS, COLS = LR.COLS, ROWS = LR.ROWS;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const G = LR.Game = {
    mode: 'title', busy: false, speedBase: 1, hold: false, reduced: false, shakeOn: true,
    onCellTap: null, onDone: null, dispCoins: 0, tgtCoins: 0, titleVisible: true,
  };
  let W = 0, H = 0, dpr = 1;
  const M = { x: 0, y: 0, w: 0, h: 0, cell: 64, pad: 10, gx: 0, gy: 0 };
  let bgCv = null, cabCv = null, glassCv = null, bulbOn = null, bulbOff = null;
  const glow = {};
  let bulbs = [];
  let coinTarget = { x: 0, y: 0 }, bagTarget = { x: 0, y: 0 }, remTarget = { x: 0, y: 0 }, rrTarget = { x: 0, y: 0 };
  const itemPos = {};

  // ---------- display state ----------
  const disp = new Array(N).fill(null);           // {id,u} shown in each slot
  const cs = [];                                   // per-cell visual state
  for (let i = 0; i < N; i++) cs.push({ sc: 1, dy: 0, vy: 0, alpha: 1, hide: 0, flash: 0, fcol: '#fff', pay: 0, shake: 0, pop: 0 });
  const reel = [];
  for (let c = 0; c < COLS; c++) reel.push({ spin: false, stopAt: 0, scroll: 0, strip: [] });
  let stripPool = ['coin', 'cherry', 'pearl', 'flower', 'cat'];

  // ---------- pools ----------
  function pool(n, mk) { const a = []; for (let i = 0; i < n; i++) { const o = mk(); o.on = false; a.push(o); } return a; }
  function grab(p) { for (let i = 0; i < p.length; i++) if (!p[i].on) { p[i].on = true; return p[i]; } return null; }
  const labels = pool(80, () => ({ x: 0, y: 0, text: '', col: '#fff', size: 20, t: 0, dur: 1, vy: 0, delay: 0 }));
  const arrows = pool(60, () => ({ x1: 0, y1: 0, x2: 0, y2: 0, col: '#fff', t: 0, dur: 1, bend: 1 }));
  const parts = pool(500, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', size: 3, g: 0, rect: false, rot: 0, vr: 0 }));
  const coinsF = pool(140, () => ({ sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0.5, v: 0, delay: 0, arc: 0, kind: 0, id: '' }));
  const rings = pool(40, () => ({ x: 0, y: 0, r0: 0, r1: 0, col: '#fff', t: 0, dur: 0.4, w: 4 }));
  let banner = { on: false, text: '', sub: '', col: '#ffc83d', t: 0, dur: 1.6 };
  let shake = 0;

  const cxOf = (i) => M.gx + ((i % COLS) + 0.5) * M.cell;
  const cyOf = (i) => M.gy + (((i / COLS) | 0) + 0.5) * M.cell;

  // ---------- layout ----------
  function rectOf(id) { const el = document.getElementById(id); if (!el || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return null; return el.getBoundingClientRect(); }
  G.layout = function () {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const hud = document.getElementById('hud'), ctr = document.getElementById('controls'), bar = document.getElementById('itemsBar');
    const top = hud.classList.contains('hidden') ? 120 : hud.getBoundingClientRect().bottom + 8;
    const bot = ctr.classList.contains('hidden') ? H - 120 : ctr.getBoundingClientRect().top - 8;
    const nItems = bar.children.length;
    const barH = nItems ? Math.ceil(bar.getBoundingClientRect().height || 44) + 8 : 0;
    const availW = Math.min(W - 24, 560), availH = Math.max(200, bot - top - barH);
    let cell = Math.min(availW / (COLS + 0.36), availH / (ROWS + 0.36), 108);
    cell = Math.floor(cell);
    M.cell = cell; M.pad = Math.round(cell * 0.18);
    M.w = cell * COLS + M.pad * 2; M.h = cell * ROWS + M.pad * 2;
    M.x = Math.round((W - M.w) / 2);
    M.y = Math.round(top + Math.max(0, Math.min((availH - M.h) / 2, 14)));
    M.gx = M.x + M.pad; M.gy = M.y + M.pad;
    bar.style.top = (M.y + M.h + 8) + 'px';
    buildStatic();
    G.measureTargets();
    LR.Art.clearCache();
  };
  G.measureTargets = function () {
    const c = rectOf('coinIco'); if (c) coinTarget = { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    const b = rectOf('bagBtn'); if (b) bagTarget = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const r1 = rectOf('remTok'); if (r1) remTarget = { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 };
    const r2 = rectOf('rrTok'); if (r2) rrTarget = { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
    for (const k in itemPos) delete itemPos[k];
    document.querySelectorAll('#itemsBar .item-chip').forEach((el) => { const r = el.getBoundingClientRect(); itemPos[el.dataset.id] = { x: r.left + r.width / 2, y: r.top + r.height / 2, el }; });
  };

  function off(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr)); const g = c.getContext('2d'); g.scale(dpr, dpr); return [c, g]; }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function buildStatic() {
    // background
    let g; [bgCv, g] = off(W, H);
    const lg = g.createLinearGradient(0, 0, 0, H); lg.addColorStop(0, '#22103c'); lg.addColorStop(0.55, '#140a24'); lg.addColorStop(1, '#0c0518');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const blob = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
    blob(W * 0.15, H * 0.2, W * 0.6, 'rgba(255,61,154,0.16)'); blob(W * 0.9, H * 0.55, W * 0.6, 'rgba(62,230,255,0.10)'); blob(W * 0.5, H * 0.95, W * 0.7, 'rgba(255,200,60,0.10)');
    g.strokeStyle = 'rgba(255,170,255,0.05)'; g.lineWidth = 1;
    for (let x = -H; x < W; x += 28) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); }
    // cabinet
    const c = M.cell, p = M.pad;
    [cabCv, g] = off(M.w + 24, M.h + 24);
    g.translate(12, 12);
    g.shadowColor = 'rgba(255,61,154,0.55)'; g.shadowBlur = 24;
    rrect(g, 0, 0, M.w, M.h, p * 1.3); const fg = g.createLinearGradient(0, 0, 0, M.h); fg.addColorStop(0, '#6a1f7e'); fg.addColorStop(0.5, '#3d0f52'); fg.addColorStop(1, '#5a1a6a');
    g.fillStyle = fg; g.fill(); g.shadowBlur = 0;
    g.lineWidth = 3; g.strokeStyle = '#ffc83d'; g.stroke();
    rrect(g, p * 0.45, p * 0.45, M.w - p * 0.9, M.h - p * 0.9, p); g.lineWidth = 2; g.strokeStyle = 'rgba(255,224,138,0.5)'; g.stroke();
    // reel windows
    rrect(g, p - 3, p - 3, c * COLS + 6, c * ROWS + 6, 10); g.fillStyle = '#0b0416'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1a0e24'; g.stroke();
    for (let col = 0; col < COLS; col++) {
      const x = p + col * c;
      const rg = g.createLinearGradient(x, 0, x + c, 0); rg.addColorStop(0, '#d9cfe6'); rg.addColorStop(0.5, '#fbf7ff'); rg.addColorStop(1, '#d4c8e2');
      g.fillStyle = rg; g.fillRect(x + 2, p, c - 4, c * ROWS);
    }
    for (let col = 1; col < COLS; col++) { g.fillStyle = '#2a1640'; g.fillRect(p + col * c - 2, p, 4, c * ROWS); }
    for (let r = 1; r < ROWS; r++) { g.fillStyle = 'rgba(60,30,90,0.12)'; g.fillRect(p, p + r * c - 1, c * COLS, 2); }
    // glass: drum shading per column (drawn over the symbols)
    [glassCv, g] = off(c * COLS, c * ROWS);
    for (let col = 0; col < COLS; col++) {
      const x = col * c;
      const sg = g.createLinearGradient(0, 0, 0, c * ROWS); sg.addColorStop(0, 'rgba(20,6,40,0.55)'); sg.addColorStop(0.12, 'rgba(20,6,40,0)'); sg.addColorStop(0.88, 'rgba(20,6,40,0)'); sg.addColorStop(1, 'rgba(20,6,40,0.55)');
      g.fillStyle = sg; g.fillRect(x, 0, c, c * ROWS);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + c * 0.12, 0, c * 0.1, c * ROWS);
    }
    // bulbs around the frame
    const bs = Math.max(6, Math.round(p * 0.5));
    [bulbOn, g] = off(bs * 3, bs * 3); { const rg = g.createRadialGradient(bs * 1.5, bs * 1.5, 0, bs * 1.5, bs * 1.5, bs * 1.5); rg.addColorStop(0, '#fff8d0'); rg.addColorStop(0.35, '#ffd046'); rg.addColorStop(0.6, 'rgba(255,190,60,0.35)'); rg.addColorStop(1, 'rgba(255,190,60,0)'); g.fillStyle = rg; g.fillRect(0, 0, bs * 3, bs * 3); }
    [bulbOff, g] = off(bs * 3, bs * 3); { g.beginPath(); g.arc(bs * 1.5, bs * 1.5, bs * 0.42, 0, 6.283); g.fillStyle = '#8a5a2a'; g.fill(); }
    bulbs = [];
    const per = M.w * 2 + M.h * 2, nb = Math.max(16, Math.round(per / (c * 0.42)));
    for (let k = 0; k < nb; k++) {
      let d = (k / nb) * per, x, y; const q = p * 0.22;
      if (d < M.w) { x = d; y = q; } else if ((d -= M.w) < M.h) { x = M.w - q; y = d; } else if ((d -= M.h) < M.w) { x = M.w - d; y = M.h - q; } else { d -= M.w; x = q; y = M.h - d; }
      bulbs.push(x, y);
    }
    G.bulbSize = bs * 3;
    // rarity glows
    for (const r of ['u', 'r', 'v']) {
      const col = { u: '78,224,138', r: '90,168,255', v: '255,200,61' }[r];
      let gg; [glow[r], gg] = off(c, c);
      const rg = gg.createRadialGradient(c / 2, c / 2, c * 0.1, c / 2, c / 2, c * 0.5); rg.addColorStop(0, 'rgba(' + col + ',0.38)'); rg.addColorStop(1, 'rgba(' + col + ',0)');
      gg.fillStyle = rg; gg.fillRect(0, 0, c, c);
    }
  }

  // ---------- public display API ----------
  G.setGrid = function (grid) { for (let i = 0; i < N; i++) { disp[i] = grid[i] ? { id: grid[i].id, u: grid[i].u } : null; const s = cs[i]; s.hide = 0; s.alpha = 1; s.sc = 1; s.dy = 0; } };
  G.clearPays = function () { for (const s of cs) s.pay = 0; };
  G.setStripPool = function (ids) { if (ids && ids.length) stripPool = ids.slice(0, 40); };
  G.setCoins = function (v, instant) { G.tgtCoins = v; if (instant) { G.dispCoins = v; updCoinDom(true); } };
  G.cellAt = function (x, y) {
    const c = Math.floor((x - M.gx) / M.cell), r = Math.floor((y - M.gy) / M.cell);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    return r * COLS + c;
  };
  G.dispAt = (i) => disp[i];
  G.machineRect = () => ({ x: M.x, y: M.y, w: M.w, h: M.h });
  let coinEl = null, coinIcoEl = null, lastShown = -1;
  function updCoinDom(force) {
    if (!coinEl) { coinEl = document.getElementById('coins'); coinIcoEl = document.getElementById('coinIco'); }
    const v = Math.round(G.dispCoins);
    if (v !== lastShown || force) { coinEl.textContent = v; lastShown = v; if (G.onCoins) G.onCoins(v); }
  }
  function pulseCoin() { if (!coinIcoEl) return; coinIcoEl.classList.remove('pulse'); void coinIcoEl.offsetWidth; coinIcoEl.classList.add('pulse'); }

  // ---------- effects ----------
  function label(x, y, text, col, size, dur, delay) {
    const l = grab(labels); if (!l) return;
    l.x = x; l.y = y; l.text = text; l.col = col; l.size = size; l.t = 0; l.dur = dur || 0.9; l.vy = -M.cell * 0.55; l.delay = delay || 0;
  }
  function arrow(i1, i2, col, x1, y1) {
    const a = grab(arrows); if (!a) return;
    a.x1 = x1 !== undefined ? x1 : cxOf(i1); a.y1 = y1 !== undefined ? y1 : cyOf(i1); a.x2 = cxOf(i2); a.y2 = cyOf(i2);
    a.col = col; a.t = 0; a.dur = 0.75; a.bend = ((i1 + i2) & 1) ? 1 : -1;
  }
  function burst(x, y, n, col, spd, size, grav) {
    if (G.reduced) n = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const p = grab(parts); if (!p) return;
      const a = Math.random() * 6.283, s = (0.3 + Math.random()) * (spd || 1) * M.cell * 2.2;
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = 0; p.max = 0.45 + Math.random() * 0.4;
      p.col = col; p.size = (size || 1) * (2 + Math.random() * 3); p.g = grav || 0; p.rect = false;
    }
  }
  function confetti(n) {
    const cols = ['#ff3d9a', '#ffc83d', '#3ee6ff', '#4ee08a', '#b07bff', '#fff'];
    if (G.reduced) n = Math.ceil(n / 4);
    for (let k = 0; k < n; k++) {
      const p = grab(parts); if (!p) return;
      p.x = Math.random() * W; p.y = -20 - Math.random() * H * 0.3; p.vx = (Math.random() - 0.5) * 120; p.vy = 120 + Math.random() * 200;
      p.life = 0; p.max = 2.2 + Math.random(); p.col = cols[k % cols.length]; p.size = 5 + Math.random() * 5; p.g = 60; p.rect = true; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 10;
    }
  }
  function ring(i, col, big) { const r = grab(rings); if (!r) return; r.x = cxOf(i); r.y = cyOf(i); r.r0 = M.cell * 0.2; r.r1 = M.cell * (big ? 1.4 : 0.62); r.col = col; r.t = 0; r.dur = big ? 0.55 : 0.4; r.w = big ? 8 : 4; }
  function flyCoins(i, v, delay, x, y) {
    const n = Math.max(1, Math.min(10, Math.ceil(Math.sqrt(v) * 1.6)));
    let rem = v;
    for (let k = 0; k < n; k++) {
      const f = grab(coinsF); if (!f) { G.tgtCoins += rem; return; }
      const share = k === n - 1 ? rem : Math.floor(v / n); rem -= share;
      f.sx = (x !== undefined ? x : cxOf(i)) + (Math.random() - 0.5) * M.cell * 0.4; f.sy = (y !== undefined ? y : cyOf(i)) + (Math.random() - 0.5) * M.cell * 0.3;
      f.tx = coinTarget.x; f.ty = coinTarget.y; f.t = 0; f.dur = 0.42 + Math.random() * 0.16; f.v = share; f.delay = (delay || 0) + k * 0.025; f.arc = -M.cell * (0.8 + Math.random()); f.kind = 0;
    }
  }
  function flySprite(i, id, tx, ty, kind) {
    const f = grab(coinsF); if (!f) return;
    f.sx = cxOf(i); f.sy = cyOf(i); f.tx = tx; f.ty = ty; f.t = 0; f.dur = 0.6; f.v = 0; f.delay = 0; f.arc = -M.cell; f.kind = kind; f.id = id;
  }
  function addShake(a) { if (G.shakeOn && !G.reduced) shake = Math.min(14, shake + a); }
  function showBanner(text, sub, col, dur) { banner.on = true; banner.text = text; banner.sub = sub || ''; banner.col = col || '#ffc83d'; banner.t = 0; banner.dur = dur || 1.6; }
  G.banner = showBanner;
  G.confetti = confetti;
  function flashItem(id) {
    const p = itemPos[id]; if (!p) return;
    p.el.classList.remove('flash'); void p.el.offsetWidth; p.el.classList.add('flash');
  }

  // ---------- spin playback ----------
  const A = LR.Audio;
  let steps = [], stepI = 0, stepT = 0, payCombo = 0, sumSoFar = 0, spinRes = null;
  const COL = { eat: '#ff8a3d', mult: '#ff3d9a', plus: '#3ee6ff', steal: '#c08bff', xf: '#c89aff', copy: '#ffffff', item: '#ffc83d', good: '#4ee08a', gold: '#ffd046' };
  function nameOf(id) { return SY[id] ? SY[id].name : id; }

  G.playSpin = function (res, coinsBefore, opts, done) {
    spinRes = res; G.busy = true; G.onDone = done; stepI = 0; stepT = 0; payCombo = 0; sumSoFar = 0;
    G.dispCoins = coinsBefore; G.tgtCoins = coinsBefore; updCoinDom(true);
    G.clearPays();
    steps = [];
    const S = (d, fn) => steps.push({ d, fn });
    // 1) spin the reels and land the new layout column by column
    S(0.42 + COLS * 0.12 + 0.12, () => {
      A.play('spin');
      for (let c = 0; c < COLS; c++) {
        const R = reel[c]; R.spin = true; R.stopAt = 0.38 + c * 0.12; R.scroll = Math.random() * M.cell;
        R.strip.length = 0; for (let k = 0; k < 6; k++) R.strip.push(stripPool[(Math.random() * stripPool.length) | 0]);
      }
    });
    for (const e of res.events) {
      switch (e.k) {
        case 'xf': S(0.45, () => {
          if (e.by >= 0) arrow(e.by, e.c, COL.xf);
          ring(e.c, COL.xf); burst(cxOf(e.c), cyOf(e.c), 14, '#e0c0ff', 0.6);
          cs[e.c].flash = 1; cs[e.c].fcol = COL.xf; cs[e.c].pop = 1;
          if (disp[e.c]) disp[e.c].id = e.to;
          label(cxOf(e.c), cyOf(e.c) - M.cell * 0.2, nameOf(e.to) + '!', '#e8d0ff', M.cell * 0.2, 1.0);
          A.play('xf');
        }); break;
        case 'roll': S(0.32, () => {
          if (e.by >= 0) arrow(e.by, e.c, COL.gold);
          cs[e.c].shake = 1; label(cxOf(e.c), cyOf(e.c), String(e.v), '#ffffff', M.cell * 0.42, 0.7); A.play('roll');
        }); break;
        case 'eat': S(0.52, () => {
          for (const t of e.ts) { arrow(e.s, t, COL.eat); cs[t].hide = 1; burst(cxOf(t), cyOf(t), 12, '#ffb07a', 0.7, 1, 200); }
          cs[e.s].pop = 1; cs[e.s].flash = 1; cs[e.s].fcol = COL.eat;
          if (e.v) label(cxOf(e.s), cyOf(e.s) - M.cell * 0.15, '+' + e.v, COL.eat, M.cell * 0.32, 1.0, 0.15);
          A.play('eat');
        }); break;
        case 'boom': S(0.75, () => {
          ring(e.s, '#ffb03a', true); burst(cxOf(e.s), cyOf(e.s), 40, '#ffb03a', 1.6, 1.4, 100); burst(cxOf(e.s), cyOf(e.s), 20, '#ff5d3a', 1.2, 1.2);
          for (const t of e.ts) { cs[t].hide = 1; burst(cxOf(t), cyOf(t), 8, '#ffd27a', 0.8); }
          cs[e.s].hide = 1; addShake(10);
          if (e.v) label(cxOf(e.s), cyOf(e.s), '+' + e.v, '#ffb03a', M.cell * 0.38, 1.1, 0.1);
          A.play('boom'); if (LR.haptic) LR.haptic(40);
        }); break;
        case 'break': S(0.3, () => { cs[e.c].hide = 1; burst(cxOf(e.c), cyOf(e.c), 14, '#fff0b0', 0.8, 1, 150); A.play('gone'); }); break;
        case 'loot': S(0.45, () => { ring(e.c, COL.gold, true); burst(cxOf(e.c), cyOf(e.c), 22, COL.gold, 1.1); label(cxOf(e.c), cyOf(e.c) - M.cell * 0.1, '+' + e.v, COL.gold, M.cell * 0.36, 1.1); A.play('loot'); }); break;
        case 'save': S(0.2, () => { label(cxOf(e.c), cyOf(e.c) - M.cell * 0.3, 'stored ' + e.v, '#c8cbe0', M.cell * 0.18, 0.8); }); break;
        case 'gain': S(e.from.length ? 0.4 : 0.3, () => {
          for (const f of e.from) arrow(f, e.c, COL.plus);
          cs[e.c].pop = 1; cs[e.c].flash = 1; cs[e.c].fcol = COL.plus;
          label(cxOf(e.c), cyOf(e.c) - M.cell * 0.15, '+' + e.v, COL.plus, M.cell * 0.3, 1.0, e.from.length ? 0.18 : 0);
          A.play('boost');
        }); break;
        case 'mult': case 'imult': S(0.42, () => {
          let ix, iy; if (e.k === 'imult') { flashItem(e.item); const p = itemPos[e.item]; if (p) { ix = p.x; iy = p.y; } }
          for (const t of e.ts) {
            if (e.k === 'mult') arrow(e.s, t, COL.mult); else if (ix !== undefined) arrow(-1, t, COL.item, ix, iy);
            cs[t].pop = 1; cs[t].flash = 1; cs[t].fcol = COL.mult;
            label(cxOf(t) + M.cell * 0.18, cyOf(t) - M.cell * 0.2, 'x' + e.m, COL.mult, M.cell * 0.32, 1.0, 0.18);
          }
          if (e.k === 'mult') ring(e.s, COL.mult);
          A.play('mult');
        }); break;
        case 'plus': case 'iplus': S(0.36, () => {
          let ix, iy; if (e.k === 'iplus') { flashItem(e.item); const p = itemPos[e.item]; if (p) { ix = p.x; iy = p.y; } }
          for (const t of e.ts) {
            if (e.k === 'plus') arrow(e.s, t, COL.plus); else if (ix !== undefined) arrow(-1, t, COL.item, ix, iy);
            cs[t].pop = 1;
            label(cxOf(t) + M.cell * 0.18, cyOf(t) - M.cell * 0.2, '+' + e.v, e.k === 'plus' ? COL.plus : COL.item, M.cell * 0.27, 0.95, 0.18);
          }
          A.play('boost');
        }); break;
        case 'steal': S(0.48, () => {
          for (const t of e.ts) { arrow(t, e.s, COL.steal); label(cxOf(t), cyOf(t) - M.cell * 0.2, '-', COL.steal, M.cell * 0.3, 0.8); }
          cs[e.s].pop = 1; cs[e.s].flash = 1; cs[e.s].fcol = COL.steal;
          label(cxOf(e.s), cyOf(e.s) - M.cell * 0.15, '+' + e.v, COL.steal, M.cell * 0.3, 1.0, 0.2);
          A.play('steal');
        }); break;
        case 'copy': S(0.42, () => { arrow(e.s, e.c, COL.copy); cs[e.c].pop = 1; cs[e.c].flash = 1; cs[e.c].fcol = '#fff'; label(cxOf(e.c), cyOf(e.c) - M.cell * 0.2, 'copy ' + e.v, '#fff', M.cell * 0.22, 0.9, 0.15); A.play('boost'); }); break;
        case 'grow': S(0.3, () => { ring(e.c, COL.good); label(cxOf(e.c), cyOf(e.c) - M.cell * 0.3, 'grows +' + e.v, COL.good, M.cell * 0.2, 0.9); A.play('grow'); }); break;
        case 'pay': S(0.09 + Math.min(0.1, e.v * 0.003), () => {
          const s = cs[e.c]; s.pop = 1.2; s.pay = e.v;
          const big = e.v >= 20;
          label(cxOf(e.c), cyOf(e.c) - M.cell * 0.05, '+' + e.v, big ? '#fff3a0' : COL.gold, M.cell * (big ? 0.46 : 0.36), 0.8);
          flyCoins(e.c, e.v, 0.05);
          if (big) { burst(cxOf(e.c), cyOf(e.c), 16, COL.gold, 0.9); A.play('big'); }
          A.play('pay', payCombo++); sumSoFar += e.v;
        }); break;
        case 'ipay': S(0.4, () => {
          flashItem(e.item); const p = itemPos[e.item];
          const x = p ? p.x : W / 2, y = p ? p.y : M.y + M.h;
          label(x, y - 30, '+' + e.v, COL.item, M.cell * 0.32, 0.9);
          flyCoins(-1, e.v, 0.05, x, y);
          A.play('pay', payCombo++); sumSoFar += e.v;
        }); break;
        case 'gmult': S(0.9, () => {
          flashItem(e.item);
          showBanner('x' + e.m + '!', LR.ITEMS[e.item] ? LR.ITEMS[e.item].name : '', '#ff3d9a', 1.3);
          G.tgtCoins += sumSoFar * (e.m - 1); sumSoFar *= e.m; pulseCoin(); A.play('jackpot');
        }); break;
        case 'gone': S(0.3, () => { cs[e.c].hide = 1; ring(e.c, '#bff4ff'); burst(cxOf(e.c), cyOf(e.c), 10, '#d8f8ff', 0.6); A.play('gone'); }); break;
        case 'add': S(0.4, () => { ring(e.c, COL.good); flySprite(e.c, e.id, bagTarget.x, bagTarget.y, 1); label(cxOf(e.c), cyOf(e.c) + M.cell * 0.25, '+ ' + nameOf(e.id), COL.good, M.cell * 0.2, 1.0); A.play('add'); }); break;
        case 'token': S(0.38, () => { const t = e.t === 'rr' ? rrTarget : remTarget; flySprite(e.c, e.t, t.x, t.y, 2); label(cxOf(e.c), cyOf(e.c) - M.cell * 0.3, e.t === 'rr' ? '+1 reroll' : '+1 removal', '#9fe9ff', M.cell * 0.2, 1); A.play('token'); }); break;
      }
    }
    S(0.55, () => {});
    S(0.01, () => finish());
    stepFn(0);
  };
  function land(c, fx) {
    const R = reel[c]; if (!R.spin) return;
    R.spin = false;
    for (let r = 0; r < ROWS; r++) { const i = r * COLS + c; const d = spinRes.drop[i]; disp[i] = d ? { id: d.id, u: d.u } : null; cs[i].dy = -M.cell * 0.5; cs[i].vy = M.cell * 9; cs[i].hide = 0; cs[i].alpha = 1; }
    if (fx) { A.play('stop', c); if (LR.haptic) LR.haptic(8); }
  }
  function landAll() { for (let c = 0; c < COLS; c++) land(c, false); }
  function stepFn(i) { if (i < steps.length) { try { steps[i].fn(); } catch (e) { console.error(e); } } }
  function finish() {
    G.busy = false; G.hold = false;
    for (let c = 0; c < COLS; c++) reel[c].spin = false;
    for (let i = 0; i < N; i++) { const f = spinRes.final[i]; disp[i] = f ? { id: f.id, u: f.u } : null; cs[i].hide = 0; cs[i].alpha = 1; cs[i].sc = 1; }
    for (let i = 0; i < N; i++) if (!disp[i]) cs[i].pay = 0;
    const cb = G.onDone; G.onDone = null;
    if (cb) cb();
  }
  G.skipAll = function () { // instantly resolve the remaining playback (used when the app is hidden mid-spin)
    if (!G.busy) return;
    landAll();
    while (G.busy && stepI < steps.length - 1) { stepI++; stepFn(stepI); }
    for (const f of coinsF) if (f.on) { f.on = false; if (f.kind === 0) G.tgtCoins += f.v; }
  };

  // ---------- frame ----------
  let lastT = 0, time = 0;
  function speed() { return G.busy ? (G.hold ? 9 : G.speedBase) : 1; }
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - lastT) / 1000 || 0); lastT = now;
    time += dt;
    const sdt = dt * speed();
    // playback
    if (G.busy && steps.length) {
      stepT += sdt;
      while (G.busy && stepI < steps.length && stepT >= steps[stepI].d) {
        stepT -= steps[stepI].d;
        if (stepI === 0) landAll();
        stepI++;
        if (stepI < steps.length) stepFn(stepI);
      }
    }
    update(sdt, dt);
    draw();
    if (G.titleVisible) drawTitleReels(dt);
  }
  function update(sdt) {
    // reels
    if (G.busy && stepI === 0) {
      for (let c = 0; c < COLS; c++) {
        const R = reel[c]; if (!R.spin) continue;
        R.scroll += sdt * M.cell * 16;
        if (stepT >= R.stopAt) land(c, true);
      }
    }
    for (let i = 0; i < N; i++) {
      const s = cs[i];
      if (s.dy !== 0 || s.vy !== 0) { // drop bounce
        s.vy += M.cell * 60 * sdt; s.dy += s.vy * sdt;
        if (s.dy > 0) { s.dy = 0; s.vy = Math.abs(s.vy) > M.cell * 2 ? -s.vy * 0.28 : 0; }
      }
      if (s.pop > 0) s.pop = Math.max(0, s.pop - sdt * 4);
      s.sc = 1 + 0.22 * Math.sin(Math.min(1, s.pop) * Math.PI);
      if (s.flash > 0) s.flash = Math.max(0, s.flash - sdt * 2.2);
      if (s.shake > 0) s.shake = Math.max(0, s.shake - sdt * 3);
      if (s.hide > 0) { s.alpha = Math.max(0, s.alpha - sdt * 4); }
    }
    for (const l of labels) if (l.on) { if (l.delay > 0) { l.delay -= sdt; continue; } l.t += sdt; l.y += l.vy * sdt; l.vy *= Math.pow(0.04, sdt); if (l.t >= l.dur) l.on = false; }
    for (const a of arrows) if (a.on) { a.t += sdt; if (a.t >= a.dur) a.on = false; }
    for (const r of rings) if (r.on) { r.t += sdt; if (r.t >= r.dur) r.on = false; }
    for (const p of parts) if (p.on) {
      p.life += sdt; if (p.life >= p.max) { p.on = false; continue; }
      p.vy += p.g * sdt; p.x += p.vx * sdt; p.y += p.vy * sdt;
      if (!p.rect) { p.vx *= Math.pow(0.08, sdt); p.vy *= Math.pow(0.08, sdt); } else p.rot += p.vr * sdt;
    }
    for (const f of coinsF) if (f.on) {
      if (f.delay > 0) { f.delay -= sdt; continue; }
      f.t += sdt;
      if (f.t >= f.dur) {
        f.on = false;
        if (f.kind === 0) { G.tgtCoins += f.v; pulseCoin(); A.play('coin'); }
        else if (f.kind === 2 && G.onToken) G.onToken();
      }
    }
    if (banner.on) { banner.t += sdt; if (banner.t >= banner.dur) banner.on = false; }
    shake = Math.max(0, shake - sdt * 40);
    // coin counter tween
    if (G.dispCoins !== G.tgtCoins) {
      const d = G.tgtCoins - G.dispCoins;
      G.dispCoins += d * Math.min(1, sdt * 14) + Math.sign(d) * Math.min(Math.abs(d), sdt * 20);
      if (Math.abs(G.tgtCoins - G.dispCoins) < 0.5) G.dispCoins = G.tgtCoins;
      updCoinDom(false);
    }
  }

  function drawSym(id, x, y, size, alpha) {
    const spr = LR.Art.sprite('s', id, size * dpr);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
    if (alpha < 1) ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bgCv) ctx.drawImage(bgCv, 0, 0, W, H); else { ctx.fillStyle = '#140a24'; ctx.fillRect(0, 0, W, H); }
    if (G.mode !== 'play' || !cabCv) return;
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.save(); ctx.translate(sx, sy);
    ctx.drawImage(cabCv, M.x - 12, M.y - 12, M.w + 24, M.h + 24);
    // bulbs (chasing)
    const ph = Math.floor(time * (G.busy ? 14 : 5)), bs = G.bulbSize;
    for (let k = 0, n = bulbs.length / 2; k < n; k++) {
      const on = G.busy ? ((k + ph) % 3 === 0) : ((k + ph) % 6 < 3);
      ctx.drawImage(on ? bulbOn : bulbOff, M.x + bulbs[k * 2] - bs / 2, M.y + bulbs[k * 2 + 1] - bs / 2, bs, bs);
    }
    const c = M.cell, ss = c * 0.8;
    ctx.save();
    ctx.beginPath(); ctx.rect(M.gx, M.gy, c * COLS, c * ROWS); ctx.clip();
    for (let col = 0; col < COLS; col++) {
      const R = reel[col];
      if (R.spin) {
        // blurred spinning strip
        const off = R.scroll % c;
        ctx.globalAlpha = 0.55;
        for (let k = -1; k < ROWS + 1; k++) {
          const id = R.strip[(k + 6 + Math.floor(R.scroll / c) * 5) % R.strip.length] || 'coin';
          const spr = LR.Art.sprite('s', id, ss * dpr);
          const x = M.gx + (col + 0.5) * c, y = M.gy + k * c + off + c / 2;
          ctx.drawImage(spr, x - ss / 2, y - ss * 0.65, ss, ss * 1.3);
        }
        ctx.globalAlpha = 1;
        continue;
      }
      for (let r = 0; r < ROWS; r++) {
        const i = r * COLS + col, d = disp[i], s = cs[i];
        if (!d) continue;
        const x = cxOf(i) + (s.shake ? Math.sin(time * 80) * s.shake * c * 0.06 : 0), y = cyOf(i) + s.dy;
        const def = SY[d.id];
        if (def && def.rar !== 'c' && glow[def.rar] && s.alpha > 0.01) { ctx.globalAlpha = s.alpha; ctx.drawImage(glow[def.rar], x - c / 2, y - c / 2, c, c); ctx.globalAlpha = 1; }
        if (s.flash > 0) { ctx.globalAlpha = s.flash * 0.6; ctx.fillStyle = s.fcol; ctx.fillRect(x - c / 2 + 2, y - c / 2 + 1, c - 4, c - 2); ctx.globalAlpha = 1; }
        if (s.alpha > 0.01) drawSym(d.id, x, y, ss * s.sc * (s.hide ? 0.6 + 0.4 * s.alpha : 1), s.alpha);
      }
    }
    ctx.drawImage(glassCv, M.gx, M.gy, c * COLS, c * ROWS);
    ctx.restore();
    // pay badges
    ctx.font = font(Math.round(c * 0.2), 900);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const v = cs[i].pay; if (!v || !disp[i]) continue;
      if (cs[i].payT !== v || cs[i].payC !== c) { cs[i].payT = v; cs[i].payC = c; cs[i].payS = String(v); cs[i].payW = ctx.measureText(cs[i].payS).width; }
      const t = cs[i].payS, bw = Math.max(c * 0.3, cs[i].payW + c * 0.12), bh = c * 0.24;
      const x = cxOf(i) + c * 0.5 - bw / 2 - 3, y = cyOf(i) + c * 0.5 - bh / 2 - 3;
      rrect(ctx, x - bw / 2, y - bh / 2, bw, bh, bh / 2); ctx.fillStyle = '#ffc83d'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1a0e24'; ctx.stroke();
      ctx.fillStyle = '#2a1404'; ctx.fillText(t, x, y + 1);
    }
    ctx.restore();
    // FX (no shake)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const r of rings) if (r.on) {
      const k = r.t / r.dur; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(k), 0, 6.283); ctx.lineWidth = r.w * (1 - k) + 1; ctx.strokeStyle = r.col; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const a of arrows) if (a.on) drawArrow(a);
    for (const p of parts) if (p.on) {
      const k = 1 - p.life / p.max; ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.col;
      if (p.rect) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else { const s = p.size * (0.4 + k * 0.6); ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
    }
    ctx.globalAlpha = 1;
    for (const f of coinsF) if (f.on && f.delay <= 0) {
      const k = easeIn(Math.min(1, f.t / f.dur));
      const x = f.sx + (f.tx - f.sx) * k, y = f.sy + (f.ty - f.sy) * k + f.arc * Math.sin(k * Math.PI);
      if (f.kind === 0) { const r = c * 0.11 * (1 - k * 0.3); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = '#ffd046'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#8a5a10'; ctx.stroke(); ctx.fillStyle = '#fff6c0'; ctx.fillRect(x - r * 0.4, y - r * 0.4, r * 0.4, r * 0.4); }
      else if (f.kind === 1) { const s = c * (0.7 - 0.4 * k); drawSym(f.id, x, y, s, 1); }
      else { ctx.beginPath(); ctx.arc(x, y, c * 0.13, 0, 6.283); ctx.fillStyle = f.id === 'rr' ? '#2f9ee8' : '#e8436e'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    }
    for (const l of labels) if (l.on && l.delay <= 0) {
      const k = l.t / l.dur, a = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25, pop = k < 0.15 ? 0.6 + 0.4 * (k / 0.15) * 1.15 : 1;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = font(Math.round(l.size * pop), 1000);
      ctx.lineWidth = Math.max(3, l.size * 0.2); ctx.strokeStyle = '#1a0e24'; ctx.lineJoin = 'round';
      ctx.strokeText(l.text, l.x, l.y); ctx.fillStyle = l.col; ctx.fillText(l.text, l.x, l.y);
    }
    ctx.globalAlpha = 1;
    if (banner.on) {
      const k = banner.t / banner.dur, sc = k < 0.15 ? easeBack(k / 0.15) : 1, a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, M.y + M.h / 2); ctx.scale(sc, sc);
      const fs = Math.min(W * 0.16, 84);
      ctx.font = font(Math.round(fs), 1000);
      ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#1a0e24'; ctx.strokeText(banner.text, 0, 0);
      ctx.shadowColor = banner.col; ctx.shadowBlur = 24; ctx.fillStyle = banner.col; ctx.fillText(banner.text, 0, 0); ctx.shadowBlur = 0;
      if (banner.sub) { ctx.font = font(Math.round(fs * 0.34), 900); ctx.lineWidth = 6; ctx.strokeText(banner.sub, 0, fs * 0.62); ctx.fillStyle = '#fff'; ctx.fillText(banner.sub, 0, fs * 0.62); }
      ctx.restore();
    }
  }
  function drawArrow(a) {
    const k = a.t / a.dur, grow = Math.min(1, k / 0.35), alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const dx = a.x2 - a.x1, dy = a.y2 - a.y1, len = Math.hypot(dx, dy) || 1;
    const sh = M.cell * 0.28;
    const x1 = a.x1 + dx / len * sh, y1 = a.y1 + dy / len * sh, x2 = a.x2 - dx / len * sh, y2 = a.y2 - dy / len * sh;
    const mx = (x1 + x2) / 2 - dy / len * len * 0.18 * a.bend, my = (y1 + y2) / 2 + dx / len * len * 0.18 * a.bend;
    const t = grow, qx1 = x1 + (mx - x1) * t, qy1 = y1 + (my - y1) * t;
    const ex = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, ey = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(qx1, qy1, ex, ey);
    ctx.lineWidth = M.cell * 0.11; ctx.strokeStyle = '#1a0e24'; ctx.stroke();
    ctx.lineWidth = M.cell * 0.055; ctx.strokeStyle = a.col; ctx.stroke();
    // head
    const tx = 2 * (1 - t) * (mx - x1) + 2 * t * (x2 - mx), ty = 2 * (1 - t) * (my - y1) + 2 * t * (y2 - my), tl = Math.hypot(tx, ty) || 1;
    const ux = tx / tl, uy = ty / tl, hs = M.cell * 0.16;
    ctx.beginPath(); ctx.moveTo(ex + ux * hs * 0.6, ey + uy * hs * 0.6); ctx.lineTo(ex - ux * hs + uy * hs * 0.7, ey - uy * hs - ux * hs * 0.7); ctx.lineTo(ex - ux * hs - uy * hs * 0.7, ey - uy * hs + ux * hs * 0.7); ctx.closePath();
    ctx.fillStyle = a.col; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#1a0e24'; ctx.stroke();
    // travelling sparkle
    ctx.beginPath(); ctx.arc(ex, ey, M.cell * 0.05, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.globalAlpha = 1;
  }
  const fontCache = new Map();
  function font(px, w) { const k = (w || 1000) * 1000 + px; let f = fontCache.get(k); if (!f) { f = (w || 1000) + ' ' + px + 'px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'; fontCache.set(k, f); } return f; }
  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  const easeIn = (k) => k * k;
  const easeBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

  // ---------- title reels ----------
  const tcv = document.getElementById('titleReels'), tctx = tcv.getContext('2d');
  const tReels = [0, 0, 0].map((_, i) => ({ off: 0, t: i * 0.22, ids: ['seven', 'cherry', 'diamond', 'bell', 'coin', 'cat', 'moon', 'luckydie'].sort(() => Math.random() - 0.5) }));
  let tSized = false;
  function drawTitleReels(dt) {
    if (!tSized) {
      const d = Math.min(2, window.devicePixelRatio || 1); tcv.width = 300 * d; tcv.height = 120 * d; tSized = true;
    }
    const d = tcv.width / 300;
    tctx.setTransform(d, 0, 0, d, 0, 0);
    tctx.clearRect(0, 0, 300, 120);
    rrect(tctx, 4, 4, 292, 112, 18); tctx.fillStyle = '#4a1460'; tctx.fill(); tctx.lineWidth = 3; tctx.strokeStyle = '#ffc83d'; tctx.stroke();
    for (let k = 0; k < 3; k++) {
      const x = 18 + k * 90, R = tReels[k];
      tctx.save(); rrect(tctx, x, 14, 84, 92, 8); tctx.fillStyle = '#f4eefc'; tctx.fill(); tctx.clip();
      // stop-and-go: each reel spins 3 symbols then rests on the payline
      R.t = (R.t || k * 0.22) + dt;
      const per = 2.6, ph = R.t % per, cyc = Math.floor(R.t / per), sp = 0.75;
      const e = ph < sp ? easeBack(ph / sp) : 1;
      R.off = 84 * (3 * cyc + 3 * e);
      const cell = 84, base = ((R.off % cell) + cell) % cell, n = Math.floor(R.off / cell);
      for (let j = -1; j < 3; j++) {
        const id = R.ids[(n - j + 800) % R.ids.length];
        const s = 68, yc = 60 + j * cell + base;
        tctx.drawImage(LR.Art.sprite('s', id, s * d), x + 8, yc - s / 2, s, s);
      }
      const sg = tctx.createLinearGradient(0, 14, 0, 106); sg.addColorStop(0, 'rgba(30,8,50,0.6)'); sg.addColorStop(0.25, 'rgba(30,8,50,0)'); sg.addColorStop(0.75, 'rgba(30,8,50,0)'); sg.addColorStop(1, 'rgba(30,8,50,0.6)');
      tctx.fillStyle = sg; tctx.fillRect(x, 14, 84, 92);
      tctx.restore();
    }
    // payline
    tctx.fillStyle = 'rgba(255,61,154,0.8)'; tctx.fillRect(10, 59, 6, 3); tctx.fillRect(284, 59, 6, 3);
  }

  // ---------- input ----------
  let downX = 0, downY = 0, downT = 0, downOn = false;
  cv.addEventListener('pointerdown', (e) => {
    downX = e.clientX; downY = e.clientY; downT = performance.now(); downOn = !G.busy;
    if (G.busy) setHold(true);
  });
  window.addEventListener('pointerdown', (e) => {
    if (!G.busy || e.target === cv) return;
    const t = e.target.closest ? e.target.closest('button') : null;
    if (t && (t.id === 'ffBtn' || t.id === 'menuBtn')) return;
    setHold(true);
  });
  window.addEventListener('pointerup', (e) => {
    setHold(false);
    if (!downOn) return; downOn = false;
    if (e.target !== cv) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 14 || performance.now() - downT > 600) return;
    if (G.busy || G.mode !== 'play') return;
    const i = G.cellAt(e.clientX, e.clientY);
    if (G.onCellTap) G.onCellTap(i);
  });
  window.addEventListener('pointercancel', () => { setHold(false); downOn = false; });
  function setHold(on) { G.hold = on && G.busy; }
  G.setHold = setHold;

  window.addEventListener('resize', () => G.layout());
  window.addEventListener('orientationchange', () => setTimeout(() => G.layout(), 120));
  G.start = function () { G.layout(); requestAnimationFrame((t) => { lastT = t; frame(t); }); };
})(window.LR = window.LR || {});
