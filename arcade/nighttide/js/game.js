'use strict';
// NIGHT TIDE — core simulation + rendering.
(function (NT) {
  const TAU = Math.PI * 2;
  const sqrt = Math.sqrt, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, abs = Math.abs;
  const min = Math.min, max = Math.max, floor = Math.floor, rnd = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------------- debug params (harmless; only with ?debug=1) ----------------
  const QS = new URLSearchParams(location.search);
  const DEBUG = QS.get('debug') === '1';
  const DBG = {
    on: DEBUG,
    speed: DEBUG ? clamp(+QS.get('speed') || 1, 0.1, 20) : 1,
    xp: DEBUG ? clamp(+QS.get('xp') || 1, 0, 100) : 1,
    t: DEBUG ? clamp(+QS.get('t') || 0, 0, 599) : 0,
    spawn: DEBUG ? clamp(+QS.get('spawn') || 0, 0, 600) : 0,
    god: DEBUG && QS.get('god') === '1',
    nospawn: DEBUG && QS.get('nospawn') === '1',
  };
  NT.DBG = DBG;

  // ---------------- enemy types ----------------
  const ET = NT.ET = [
    { key: 'shade', r: 12, hp: 11, spd: 50, dmg: 6, xp: 1, body: '#2c2050', rim: '#9a7bea', shape: 'ghost', kb: 0 },
    { key: 'skitter', r: 9, hp: 5, spd: 96, dmg: 4, xp: 1, body: '#103a42', rim: '#4fd8cf', shape: 'crab', kb: 0 },
    { key: 'brute', r: 22, hp: 95, spd: 36, dmg: 18, xp: 4, body: '#44172a', rim: '#ff5d78', shape: 'brute', kb: 0.75 },
    { key: 'spitter', r: 13, hp: 20, spd: 46, dmg: 7, xp: 2, body: '#22381a', rim: '#a8ec68', shape: 'urchin', kb: 0.1 },
    { key: 'splitter', r: 16, hp: 36, spd: 44, dmg: 10, xp: 2, body: '#3c1646', rim: '#ee7cf0', shape: 'bubble', kb: 0.2 },
    { key: 'mini', r: 8, hp: 8, spd: 80, dmg: 5, xp: 1, body: '#3c1646', rim: '#ee7cf0', shape: 'mini', kb: 0 },
    { key: 'jelly', r: 14, hp: 30, spd: 50, dmg: 14, xp: 2, body: '#16285a', rim: '#78b4ff', shape: 'jelly', kb: 0.2 },
    { key: 'boss1', name: 'OLD PINCER', r: 44, hp: 1900, spd: 58, dmg: 18, xp: 0, body: '#55200f', rim: '#ff9a5a', shape: 'bosscrab', kb: 1, boss: 1 },
    { key: 'boss2', name: 'THE MAWLIGHT', r: 46, hp: 12000, spd: 52, dmg: 22, xp: 0, body: '#0f2c3c', rim: '#5ce1e6', shape: 'angler', kb: 1, boss: 2 },
    { key: 'boss3', name: 'THE TIDE KING', r: 60, hp: 40000, spd: 56, dmg: 30, xp: 0, body: '#22104a', rim: '#ffcf4a', shape: 'king', kb: 1, boss: 3 },
  ];
  const T_SHADE = 0, T_SKIT = 1, T_BRUTE = 2, T_SPIT = 3, T_SPLIT = 4, T_MINI = 5, T_JELLY = 6, T_B1 = 7, T_B2 = 8, T_B3 = 9;

  // ---------------- pools ----------------
  function Pool(n, make) {
    this.list = new Array(n); this.free = new Array(n); this.nf = n; this.n = 0; this.cap = n;
    for (let i = 0; i < n; i++) { const o = make(); o.alive = false; this.free[i] = o; this.list[i] = o; }
  }
  Pool.prototype.get = function () {
    if (this.nf === 0) return null;
    const o = this.free[--this.nf]; o.alive = true; this.list[this.n++] = o; return o;
  };
  Pool.prototype.compact = function () {
    const L = this.list; let j = 0;
    for (let i = 0; i < this.n; i++) { const o = L[i]; if (o.alive) L[j++] = o; else this.free[this.nf++] = o; }
    this.n = j;
  };
  Pool.prototype.clear = function () { for (let i = 0; i < this.n; i++) this.list[i].alive = false; this.compact(); };

  const MAXE = 640;
  let uidC = 0;
  const EP = new Pool(MAXE, () => ({
    uid: 0, type: 0, def: null, x: 0, y: 0, kx: 0, ky: 0, r: 10, hp: 1, maxHp: 1, spd: 1, dmg: 1, xp: 1,
    elite: false, big: false, flash: 0, state: 0, st: 0, st2: 0, st3: 0, atk: 0, phase: 0, stun: 0, slow: 0, slowT: 0,
    nx: 0, ny: 1, ax: 0, ay: 0, dir: 1, sa: 0, imm: new Float32Array(6), pul: new Int32Array(3),
  }));
  const PP = new Pool(260, () => ({ kind: 0, x: 0, y: 0, dx: 0, dy: 0, spd: 0, rs: 0, t: 0, out: 0, r: 0, dmg: 0, w: null,
    hits: new Int32Array(40), hitN: 0, pierce: 0, ret: false, rot: 0, life: 0, size: 1 }));
  const BP = new Pool(360, () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 1, life: 0 }));
  const GP = new Pool(900, () => ({ x: 0, y: 0, vx: 0, vy: 0, v: 1, kind: 0, mag: false, sp: 0, ph: 0 }));
  const KP = new Pool(40, () => ({ kind: 0, x: 0, y: 0, t: 0, mag: false, sp: 0, boss: false }));
  const FX = new Pool(1000, () => ({ kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, col: '#fff', drag: 0 }));
  const NP = new Pool(80, () => ({ x: 0, y: 0, vy: 0, life: 0, s: '', crit: false, col: '' }));
  const PICK_COCO = 0, PICK_CONCH = 1, PICK_CHEST = 2;

  const numStr = [];
  function nstr(n) { n = n | 0; if (n < 0) n = 0; if (n > 99999) n = 99999; return numStr[n] || (numStr[n] = String(n)); }

  // ---------------- spatial hash ----------------
  const CELL = 48, GN = 72;
  const gHead = new Int32Array(GN * GN), gNext = new Int32Array(MAXE);
  let gOX = 0, gOY = 0;
  const qBuf = new Int32Array(MAXE);
  const bigList = [];
  function gridBuild() {
    gHead.fill(-1);
    gOX = P.x - CELL * GN / 2; gOY = P.y - CELL * GN / 2;
    const L = EP.list;
    for (let i = 0; i < EP.n; i++) {
      const e = L[i];
      if (!e.alive || e.big) continue;
      const cx = floor((e.x - gOX) / CELL), cy = floor((e.y - gOY) / CELL);
      if (cx < 0 || cy < 0 || cx >= GN || cy >= GN) continue;
      const c = cy * GN + cx;
      gNext[i] = gHead[c]; gHead[c] = i;
    }
  }
  // fills qBuf with indices of live enemies whose circle overlaps (x,y,r); returns count
  function query(x, y, r) {
    let n = 0;
    const L = EP.list, m = r + 24;
    let x0 = floor((x - m - gOX) / CELL), x1 = floor((x + m - gOX) / CELL);
    let y0 = floor((y - m - gOY) / CELL), y1 = floor((y + m - gOY) / CELL);
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= GN) x1 = GN - 1; if (y1 >= GN) y1 = GN - 1;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let i = gHead[cy * GN + cx];
        while (i !== -1) {
          const e = L[i];
          if (e.alive) {
            const dx = e.x - x, dy = e.y - y, rr = r + e.r;
            if (dx * dx + dy * dy < rr * rr) qBuf[n++] = i;
          }
          i = gNext[i];
        }
      }
    }
    for (let b = 0; b < bigList.length; b++) {
      const e = bigList[b];
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.r;
      if (dx * dx + dy * dy < rr * rr) qBuf[n++] = -1 - b; // negative => big list
    }
    return n;
  }
  function qEnemy(code) { return code >= 0 ? EP.list[code] : bigList[-1 - code]; }
  function nearest(x, y, maxR) {
    let best = null, bd = 1e12;
    const n = query(x, y, maxR);
    for (let i = 0; i < n; i++) {
      const e = qEnemy(qBuf[i]);
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------------- canvas ----------------
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d', { alpha: false });
  let W = 1, H = 1, DPR = 1, SCALE = 1, K = 1, viewW = 1, viewH = 1, spawnR = 500;
  const SAFE = { t: 0, r: 0, b: 0, l: 0 };
  let vignette = null, redVig = null;
  let camX = 0, camY = 0, wOX = 0, wOY = 0;

  function readSafe() {
    const el = document.getElementById('safe');
    if (!el) return;
    const cs = getComputedStyle(el);
    SAFE.t = parseFloat(cs.paddingTop) || 0; SAFE.r = parseFloat(cs.paddingRight) || 0;
    SAFE.b = parseFloat(cs.paddingBottom) || 0; SAFE.l = parseFloat(cs.paddingLeft) || 0;
  }
  function makeVig(rgb, inner, a1, a2) {
    const c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    const g = c.getContext('2d');
    const cx = c.width / 2, cy = c.height / 2;
    const r0 = Math.min(c.width, c.height) * inner, r1 = Math.hypot(c.width, c.height) * 0.56;
    const grd = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
    grd.addColorStop(0, 'rgba(' + rgb + ',0)');
    grd.addColorStop(0.5, 'rgba(' + rgb + ',' + a1 + ')');
    grd.addColorStop(1, 'rgba(' + rgb + ',' + a2 + ')');
    g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function resize() {
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    SCALE = clamp(Math.min(W, H) / 380, 0.75, 1.7);
    K = DPR * SCALE;
    viewW = W / SCALE; viewH = H / SCALE;
    spawnR = sqrt(viewW * viewW + viewH * viewH) / 2 + 40;
    readSafe();
    NT.Art.build(K);
    vignette = makeVig('3,5,16', 0.3, 0.34, 0.86);
    redVig = makeVig('200,20,50', 0.3, 0.25, 0.75);
  }

  // ---------------- input ----------------
  const IN = { id: -1, ox: 0, oy: 0, cx: 0, cy: 0, jx: 0, jy: 0, keys: Object.create(null) };
  const JR = 56;
  function canSteer() { return G.mode === 'play' && !G.modal; }
  cv.addEventListener('pointerdown', (e) => {
    NT.Audio.unlock();
    if (!canSteer() || IN.id !== -1) return;
    IN.id = e.pointerId; IN.ox = IN.cx = e.clientX; IN.oy = IN.cy = e.clientY;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerId !== IN.id) return;
    IN.cx = e.clientX; IN.cy = e.clientY;
    const dx = IN.cx - IN.ox, dy = IN.cy - IN.oy, d = sqrt(dx * dx + dy * dy);
    if (d > JR) { IN.ox = IN.cx - dx / d * JR; IN.oy = IN.cy - dy / d * JR; } // floating base follows the thumb
    e.preventDefault();
  });
  function endPtr(e) { if (e.pointerId === IN.id) IN.id = -1; }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('lostpointercapture', endPtr);
  window.addEventListener('keydown', (e) => {
    IN.keys[e.code] = true;
    if (e.code.indexOf('Arrow') === 0 || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { IN.keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in IN.keys) IN.keys[k] = false; IN.id = -1; });
  function readInput() {
    let x = 0, y = 0;
    const k = IN.keys;
    if (k.KeyA || k.ArrowLeft) x -= 1;
    if (k.KeyD || k.ArrowRight) x += 1;
    if (k.KeyW || k.ArrowUp) y -= 1;
    if (k.KeyS || k.ArrowDown) y += 1;
    if (x || y) { const l = sqrt(x * x + y * y); x /= l; y /= l; }
    if (IN.id !== -1) {
      const dx = IN.cx - IN.ox, dy = IN.cy - IN.oy, d = sqrt(dx * dx + dy * dy);
      if (d > 6) {
        const m = clamp((d - 6) / (JR * 0.55), 0, 1);
        x = dx / d * m; y = dy / d * m;
      }
    }
    IN.jx = x; IN.jy = y;
  }
  function resetInput() { IN.id = -1; IN.jx = IN.jy = 0; }

  // ---------------- state ----------------
  const P = { x: 0, y: 0, vx: 0, vy: 0, r: 13, hp: 100, maxHp: 100, fx: 0, fy: 1, iT: 0, moving: false, dead: false,
    st: { might: 1, area: 1, cd: 1, speed: 1, magnet: 1, armor: 0, regen: 0, luck: 0, crit: 0.05, xp: 1 } };
  const G = NT.G = {
    mode: 'title', modal: null, t: 0, time: 0, kills: 0, level: 1, xp: 0, xpNext: 5, pendingLv: 0,
    weapons: [], passives: {}, passiveOrder: [], boss: null, bossesKilled: 0, shake: 0, hurtFlash: 0,
    banner: null, ending: null, timeScale: 1, evI: 0, eliteT: 50, spawnAcc: 0, rerolls: 1, revives: 0,
    char: null, bonusShards: 0, dmgBy: {}, lvlFx: 0, pulseId: 0, healed: 0, chestsOpened: 0, dmgTaken: 0,
  };
  NT.P = P;

  function hpMul() { const t = G.t, l = t > 240 ? (t - 240) / 60 : 0; return 1 + t / 60 * 0.38 + l * l * 0.5; }
  function dmgMul() { return 1 + G.t / 60 * 0.15; }
  function xpForLevel(l) { return 4 + (l - 1) * 4 + max(0, l - 10) * 8 + max(0, l - 20) * 24 + max(0, l - 30) * 70; }

  function meta(id) { const s = NT.save; return (s && s.up && s.up[id]) || 0; }
  function recalc() {
    const c = (G.char && G.char.mods) || {}, pv = G.passives, st = P.st;
    st.might = 1 + 0.05 * meta('might') + 0.10 * (pv.might || 0) + (c.might || 0);
    st.area = 1 + 0.10 * (pv.area || 0) + (c.area || 0);
    st.cd = max(0.4, 1 - 0.03 * meta('cooldown') - 0.07 * (pv.cooldown || 0) - (c.cooldown || 0));
    st.speed = 1 + 0.04 * meta('speed') + 0.08 * (pv.speed || 0) + (c.speed || 0);
    st.magnet = 1 + 0.15 * meta('magnet') + 0.30 * (pv.magnet || 0) + (c.magnet || 0);
    st.armor = meta('armor') + (pv.armor || 0) + (c.armor || 0);
    st.regen = 0.3 * (pv.regen || 0) + (c.regen || 0);
    st.luck = 0.10 * (pv.luck || 0) + (c.luck || 0);
    st.crit = 0.05 + 0.03 * (pv.luck || 0);
    st.xp = 1 + 0.06 * meta('growth');
    const mh = 100 + 10 * meta('hp') + (c.maxHp || 0);
    if (mh !== P.maxHp) { P.hp += mh - P.maxHp; P.maxHp = mh; }
    if (P.hp > P.maxHp) P.hp = P.maxHp;
  }

  // ---------------- weapons ----------------
  function computeStats(w) {
    const d = NT.WEAPONS[w.id], s = {};
    for (let i = 0; i < Math.min(w.level, d.lv.length); i++) Object.assign(s, d.lv[i]);
    if (w.evo) Object.assign(s, d.evoStats);
    w.s = s;
  }
  function getW(id) { for (let i = 0; i < G.weapons.length; i++) if (G.weapons[i].id === id) return G.weapons[i]; return null; }
  function addWeapon(id, lv) {
    const w = { id, slot: NT.WEAPON_IDS.indexOf(id), level: lv || 1, evo: false, s: null, t: 0.4, dmg: 0, kills: 0,
      got: G.t, ang: 0, on: true, vis: 0, phT: 0, burst: 0, burstT: 0, tick: 0.2,
      sx: new Float32Array(8), sy: new Float32Array(8),
      pulses: [{ on: false, t: 0, id: 0, r: 0 }, { on: false, t: 0, id: 0, r: 0 }, { on: false, t: 0, id: 0, r: 0 }],
      gulls: [] };
    for (let i = 0; i < 6; i++) w.gulls.push({ init: false, state: 0, x: P.x, y: P.y, vx: 0, vy: 0, tx: 0, ty: 0, tgt: null, tuid: 0, rest: i * 0.25 });
    computeStats(w);
    if (id === 'shell') { w.on = true; w.phT = w.s.dur; }
    G.weapons.push(w);
    return w;
  }
  function weaponName(w) { return w.evo ? NT.EVOS[NT.WEAPONS[w.id].evo].name : NT.WEAPONS[w.id].name; }

  function hit(e, dmg, w, kx, ky, kb, critBonus) {
    if (!e.alive) return;
    const crit = rnd() < P.st.crit + (critBonus || 0);
    let d = dmg * P.st.might * (crit ? 2 : 1) * (0.9 + rnd() * 0.2);
    const before = e.hp;
    e.hp -= d; e.flash = 0.09;
    if (w) w.dmg += min(d, max(0, before));
    if (kb) { const res = 1 - e.def.kb; e.kx += kx * kb * res; e.ky += ky * kb * res; }
    if (NT.save.set.nums) spawnNum(e.x + (rnd() - 0.5) * 8, e.y - e.r, d, crit);
    NT.Audio.play(crit ? 'crit' : 'hit');
    if (e.hp <= 0) kill(e, w);
  }

  function fireBoom(w) {
    const s = w.s, a0 = aimAngle(420);
    for (let k = 0; k < s.count; k++) {
      const a = s.all ? a0 + k * TAU / s.count : a0 + (k - (s.count - 1) / 2) * 0.42;
      const p = PP.get(); if (!p) break;
      p.kind = 1; p.x = P.x; p.y = P.y; p.dx = cos(a); p.dy = sin(a); p.spd = s.speed; p.rs = 0; p.t = 0; p.out = s.out;
      p.size = s.size * P.st.area; p.r = 12 * p.size; p.dmg = s.dmg; p.w = w; p.hitN = 0; p.pierce = 9999; p.ret = false;
      p.rot = rnd() * TAU; p.life = 4;
    }
    NT.Audio.play('throw');
  }
  function aimAngle(r) {
    const e = nearest(P.x, P.y, r);
    if (e) return atan2(e.y - P.y, e.x - P.x);
    return atan2(P.fy, P.fx);
  }
  function fireHarp(w) {
    const s = w.s;
    const e = nearest(P.x, P.y, 460);
    const a = e ? atan2(e.y - P.y, e.x - P.x) : atan2(P.fy, P.fx);
    const n = s.fan ? 3 : 1;
    for (let j = 0; j < n; j++) {
      const p = PP.get(); if (!p) break;
      const aa = a + (n > 1 ? (j - 1) * 0.2 : (rnd() - 0.5) * 0.1);
      p.kind = 2; p.x = P.x; p.y = P.y; p.dx = cos(aa); p.dy = sin(aa); p.spd = s.speed; p.t = 0; p.life = 1.15;
      p.size = s.size * (1 + (P.st.area - 1) * 0.5); p.r = 6 * p.size; p.dmg = s.dmg; p.w = w; p.hitN = 0; p.pierce = s.pierce; p.ret = false;
    }
    NT.Audio.play('harp');
  }

  function updateWeapons(dt) {
    const cdm = P.st.cd, area = P.st.area;
    for (let wi = 0; wi < G.weapons.length; wi++) {
      const w = G.weapons[wi], s = w.s;
      switch (w.id) {
        case 'boom':
          w.t -= dt;
          if (w.t <= 0) { w.t = s.cd * cdm; fireBoom(w); }
          break;
        case 'harp':
          w.t -= dt;
          if (w.t <= 0 && w.burst <= 0) { w.t = s.cd * cdm; w.burst = s.count; w.burstT = 0; }
          if (w.burst > 0) { w.burstT -= dt; if (w.burstT <= 0) { w.burstT = 0.09; w.burst--; fireHarp(w); } }
          break;
        case 'shell': {
          if (s.always) w.on = true;
          else {
            w.phT -= dt;
            if (w.phT <= 0) { w.on = !w.on; w.phT = w.on ? s.dur : s.off * cdm; if (w.on) NT.Audio.play('shell'); }
          }
          w.vis += ((w.on ? 1 : 0) - w.vis) * min(1, dt * 8);
          w.ang += s.spin * dt;
          const R = s.radius * area * (0.4 + 0.6 * w.vis), sr = 10 * area, cnt = s.count;
          for (let k = 0; k < cnt; k++) {
            const a = w.ang + k * TAU / cnt, x = P.x + cos(a) * R, y = P.y + sin(a) * R;
            w.sx[k] = x; w.sy[k] = y;
            if (w.vis < 0.5) continue;
            const n = query(x, y, sr);
            for (let i = 0; i < n; i++) {
              const e = qEnemy(qBuf[i]);
              if (G.t < e.imm[w.slot]) continue;
              e.imm[w.slot] = G.t + 0.4;
              const dx = e.x - P.x, dy = e.y - P.y, d = sqrt(dx * dx + dy * dy) || 1;
              hit(e, s.dmg, w, dx / d, dy / d, 140);
            }
          }
          break;
        }
        case 'lamp': {
          w.tick -= dt;
          if (w.tick <= 0) {
            w.tick = s.tick * (0.5 + 0.5 * cdm);
            const R = s.radius * area;
            const n = query(P.x, P.y, R);
            let healed = 0;
            for (let i = 0; i < n; i++) {
              const e = qEnemy(qBuf[i]);
              if (s.slow) { e.slow = s.slow; e.slowT = G.t + w.tick + 0.15; }
              hit(e, s.dmg, w, 0, 0, 0);
              healed++;
            }
            if (n) NT.Audio.play('lamp');
            if (s.heal && healed) heal(min(3, healed * 0.35), false);
          }
          break;
        }
        case 'tide': {
          w.t -= dt;
          if (w.t <= 0) {
            w.t = s.cd * cdm;
            for (let k = 0; k < s.pulses; k++) { const pu = w.pulses[k]; pu.on = true; pu.t = -k * 0.28; pu.id = ++G.pulseId; pu.r = 0; }
          }
          const R = s.radius * (1 + (area - 1) * 0.5);
          for (let k = 0; k < 3; k++) {
            const pu = w.pulses[k];
            if (!pu.on) continue;
            const prev = pu.t;
            pu.t += dt;
            if (pu.t < 0) continue;
            if (prev < 0 || prev === 0) { NT.Audio.play('pulse'); if (G.mode === 'play') G.shake = max(G.shake, 2); }
            const f = pu.t / s.expand;
            if (f >= 1) { pu.on = false; continue; }
            const r = R * (1 - (1 - f) * (1 - f) * (1 - f));
            pu.r = r;
            const n = query(P.x, P.y, r);
            for (let i = 0; i < n; i++) {
              const e = qEnemy(qBuf[i]);
              if (e.pul[k] === pu.id) continue;
              e.pul[k] = pu.id;
              const dx = e.x - P.x, dy = e.y - P.y, d = sqrt(dx * dx + dy * dy) || 1;
              if (s.stun && !e.big) e.stun = s.stun;
              hit(e, s.dmg, w, dx / d, dy / d, s.kb);
            }
          }
          break;
        }
        case 'gull': {
          const cnt = s.count;
          for (let k = 0; k < cnt; k++) {
            const g = w.gulls[k];
            if (!g.init) { g.init = true; g.x = P.x; g.y = P.y - 20; g.state = 0; g.rest = 0.2 + k * 0.25; }
            const ha = G.time * 1.6 + k * TAU / cnt;
            const hx = P.x + cos(ha) * 34, hy = P.y - 22 + sin(ha) * 14;
            let tx, ty, sp;
            if (g.state === 0) {
              tx = hx; ty = hy; sp = 340;
              g.rest -= dt;
              if (g.rest <= 0) {
                const n = query(P.x, P.y, 300);
                if (n > 0) { const e = qEnemy(qBuf[(rnd() * n) | 0]); g.tgt = e; g.tuid = e.uid; g.tx = e.x; g.ty = e.y; g.state = 1; }
                else g.rest = 0.25;
              }
            } else if (g.state === 1) {
              const e = g.tgt;
              if (e && e.alive && e.uid === g.tuid) { g.tx = e.x; g.ty = e.y; }
              tx = g.tx; ty = g.ty; sp = s.speed;
            } else { tx = hx; ty = hy; sp = s.speed * 0.85; }
            const dx = tx - g.x, dy = ty - g.y, d = sqrt(dx * dx + dy * dy);
            if (d > 0.01) {
              const step = min(d, sp * dt);
              g.vx = dx / d * sp; g.vy = dy / d * sp;
              g.x += dx / d * step; g.y += dy / d * step;
            }
            if (g.state === 1 && d < 10) {
              const sr = s.splash * area;
              const n = query(g.x, g.y, sr);
              for (let i = 0; i < n; i++) {
                const e = qEnemy(qBuf[i]);
                const ex = e.x - g.x, ey = e.y - g.y, ed = sqrt(ex * ex + ey * ey) || 1;
                hit(e, s.dmg, w, ex / ed, ey / ed, 90, s.crit || 0);
              }
              splash(g.x, g.y, sr);
              NT.Audio.play('gull');
              g.state = 2;
            } else if (g.state === 2 && d < 14) { g.state = 0; g.rest = s.rest * cdm; }
          }
          break;
        }
      }
    }
  }

  function updateProjectiles(dt) {
    const L = PP.list;
    for (let i = 0; i < PP.n; i++) {
      const p = L[i];
      if (!p.alive) continue;
      p.t += dt; p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      if (p.kind === 1) {
        p.rot += dt * 15;
        if (!p.ret) {
          const f = 1 - p.t / p.out;
          if (f <= 0) { p.ret = true; p.hitN = 0; }
          else { p.x += p.dx * p.spd * 1.7 * f * dt; p.y += p.dy * p.spd * 1.7 * f * dt; }
        } else {
          const dx = P.x - p.x, dy = P.y - p.y, d = sqrt(dx * dx + dy * dy) || 1;
          p.rs = min(p.spd * 1.5, p.rs + p.spd * 3.2 * dt);
          if (d < P.r + 8) { p.alive = false; continue; }
          p.dx = dx / d; p.dy = dy / d;
          p.x += p.dx * p.rs * dt; p.y += p.dy * p.rs * dt;
        }
      } else {
        p.x += p.dx * p.spd * dt; p.y += p.dy * p.spd * dt;
      }
      const n = query(p.x, p.y, p.r);
      for (let q = 0; q < n && p.alive; q++) {
        const e = qEnemy(qBuf[q]);
        let seen = false;
        for (let h = 0; h < p.hitN; h++) if (p.hits[h] === e.uid) { seen = true; break; }
        if (seen) continue;
        if (p.hitN < 40) p.hits[p.hitN++] = e.uid;
        hit(e, p.dmg, p.w, p.dx, p.dy, p.kind === 1 ? 110 : 70);
        if (p.kind === 2) { p.pierce--; if (p.pierce <= 0) p.alive = false; }
      }
    }
  }

  // ---------------- spawning ----------------
  function spawnEnemy(type, x, y, elite) {
    const e = EP.get();
    if (!e) return null;
    const d = ET[type];
    e.uid = ++uidC; e.type = type; e.def = d; e.x = x; e.y = y; e.kx = e.ky = 0;
    e.elite = !!elite; e.big = !!d.boss;
    const hm = d.boss ? 1 : hpMul();
    e.r = d.r * (elite ? 1.35 : 1);
    e.maxHp = e.hp = d.hp * hm * (elite ? 6 : 1);
    e.spd = d.spd * (elite ? 1.05 : 1) * (d.boss ? 1 : 0.9 + rnd() * 0.2);
    e.dmg = d.dmg * dmgMul() * (elite ? 1.4 : 1);
    e.xp = elite ? 25 : d.xp;
    e.flash = 0; e.state = 0; e.st = 1 + rnd() * 2; e.st2 = 4; e.st3 = 0; e.atk = 0; e.phase = rnd() * TAU;
    e.stun = 0; e.slow = 0; e.slowT = 0; e.dir = rnd() < 0.5 ? -1 : 1; e.sa = 0;
    e.imm.fill(0); e.pul.fill(-1);
    if (e.big) bigList.push(e);
    return e;
  }
  function edgePoint(spread) {
    let a;
    if (P.moving && rnd() < 0.45) a = atan2(P.vy, P.vx) + (rnd() - 0.5) * 1.8;
    else a = rnd() * TAU;
    const r = spawnR * (1 + rnd() * (spread || 0.15));
    EDGE.x = P.x + cos(a) * r; EDGE.y = P.y + sin(a) * r; EDGE.a = a;
    return EDGE;
  }
  const EDGE = { x: 0, y: 0, a: 0 };
  function pickType(t) {
    const w0 = 10, w1 = t > 35 ? 5 : 0, w3 = t > 105 ? 1.2 + t / 300 : 0, w4 = t > 190 ? 2.5 + t / 200 : 0,
      w2 = t > 235 ? 1.5 + t / 160 : 0, w6 = t > 275 ? 2.5 + t / 220 : 0;
    let r = rnd() * (w0 + w1 + w2 + w3 + w4 + w6);
    if ((r -= w0) < 0) return T_SHADE;
    if ((r -= w1) < 0) return T_SKIT;
    if ((r -= w2) < 0) return T_BRUTE;
    if ((r -= w3) < 0) return T_SPIT;
    if ((r -= w4) < 0) return T_SPLIT;
    return T_JELLY;
  }
  function spawnPack(type, n) {
    const p = edgePoint();
    for (let i = 0; i < n; i++) spawnEnemy(type, p.x + (rnd() - 0.5) * 50, p.y + (rnd() - 0.5) * 50, false);
  }
  function spawnElite() {
    const t = G.t;
    const pool = t < 120 ? [T_SHADE, T_SPIT] : t < 300 ? [T_SPIT, T_SPLIT, T_BRUTE] : [T_BRUTE, T_SPLIT, T_JELLY, T_SPIT];
    const p = edgePoint();
    spawnEnemy(pool[(rnd() * pool.length) | 0], p.x, p.y, true);
  }
  function relocate(e) {
    const p = edgePoint(0.1);
    e.x = p.x; e.y = p.y; e.kx = e.ky = 0;
  }

  const EVENTS = [
    [88, 'swarm'], [175, 'warn'], [180, 'boss1'], [250, 'ring'], [320, 'swarm'], [355, 'warn'], [360, 'boss2'],
    [430, 'march'], [480, 'ring'], [535, 'warn'], [540, 'boss3'], [575, 'swarm'],
  ];
  function runEvent(ev) {
    switch (ev) {
      case 'swarm': {
        const p = edgePoint();
        const n = 26 + (G.t / 20) | 0;
        for (let i = 0; i < n; i++) spawnEnemy(T_SKIT, p.x + (rnd() - 0.5) * 120, p.y + (rnd() - 0.5) * 120, false);
        banner('THE SAND SKITTERS', 'A swarm rushes in', '#4fd8cf', 2);
        break;
      }
      case 'ring': {
        const n = G.t > 400 ? 70 : 54, R = spawnR * 0.92;
        for (let i = 0; i < n; i++) { const a = i / n * TAU; spawnEnemy(T_SHADE, P.x + cos(a) * R, P.y + sin(a) * R, false); }
        banner('ENCIRCLED', 'Break through the ring!', '#9a7bea', 2);
        break;
      }
      case 'march': {
        const p = edgePoint(0);
        const px = -sin(p.a), py = cos(p.a);
        for (let i = -4; i <= 4; i++) spawnEnemy(T_BRUTE, p.x + px * i * 46, p.y + py * i * 46, false);
        banner('THE BRUTES MARCH', '', '#ff5d78', 2);
        break;
      }
      case 'warn':
        banner('SOMETHING STIRS IN THE SURF', '', '#ff8a5a', 2.6);
        NT.Audio.play('warn');
        NT.haptic([40, 60, 40]);
        break;
      case 'boss1': spawnBoss(T_B1); break;
      case 'boss2': spawnBoss(T_B2); break;
      case 'boss3': spawnBoss(T_B3); break;
    }
  }
  function spawnBoss(type) {
    const p = edgePoint(0);
    const e = spawnEnemy(type, P.x + cos(p.a) * spawnR * 0.8, P.y + sin(p.a) * spawnR * 0.8, false);
    if (!e) return;
    // boss scales a little with player progress so overleveled builds still get a fight
    const lvScale = 1 + max(0, G.level - (type === T_B1 ? 12 : type === T_B2 ? 24 : 34)) * 0.05;
    e.maxHp = e.hp = e.def.hp * lvScale;
    e.st = 2.5; e.st2 = 5; e.st3 = 0;
    G.boss = e;
    banner(e.def.name, type === T_B3 ? 'Defeat it to break the night!' : 'A guardian of the dark', e.def.rim, 3);
    NT.Audio.play('boss');
    NT.Audio.setIntensity(2);
    NT.haptic([80, 50, 120]);
    G.shake = max(G.shake, 8);
  }

  function director(dt) {
    if (DBG.nospawn) return;
    const t = G.t;
    while (G.evI < EVENTS.length && t >= EVENTS[G.evI][0]) { runEvent(EVENTS[G.evI][1]); G.evI++; }
    if (t >= G.eliteT) { G.eliteT += max(26, 42 - t / 30); spawnElite(); }
    const bossOn = G.boss && G.boss.alive;
    let target = min(440, 10 + t * 0.42 + max(0, t - 180) * 0.4);
    if (bossOn) target *= 0.55;
    const rate = (2.2 + t * 0.055) * (bossOn ? 0.5 : 1);
    G.spawnAcc += rate * dt;
    while (G.spawnAcc >= 1) {
      G.spawnAcc -= 1;
      if (EP.n >= target) { G.spawnAcc = 0; break; }
      const type = pickType(t);
      if (type === T_SKIT) spawnPack(T_SKIT, 3 + ((rnd() * 3) | 0));
      else { const p = edgePoint(); spawnEnemy(type, p.x, p.y, false); }
    }
  }

  // ---------------- enemies ----------------
  function fireBullet(x, y, dx, dy, spd, dmg, r) {
    const b = BP.get(); if (!b) return;
    b.x = x; b.y = y; b.vx = dx * spd; b.vy = dy * spd; b.dmg = dmg; b.life = 4.5; b.r = r || 5;
  }
  function radial(e, n, spd, off) {
    for (let i = 0; i < n; i++) { const a = off + i / n * TAU; fireBullet(e.x, e.y, cos(a), sin(a), spd, e.dmg * 0.6, 6); }
    NT.Audio.play('spit');
  }
  function bossAI(e, dt, nx, ny, d) {
    const enr = e.hp < e.maxHp * 0.5;
    const ts = enr ? 1.35 : 1;
    let mx = 0, my = 0;
    e.st -= dt * ts; e.st2 -= dt * ts;
    if (e.type === T_B1 || (e.type === T_B3 && e.state > 0 && e.state < 3)) {
      if (e.state === 0) {
        mx = nx; my = ny;
        if (e.st <= 0) { e.state = 1; e.st3 = 0.75; e.ax = nx; e.ay = ny; NT.Audio.play('charge'); }
      } else if (e.state === 1) {
        e.st3 -= dt;
        if (e.st3 <= 0) { e.state = 2; e.st3 = 0.7; }
      } else if (e.state === 2) {
        mx = e.ax * 7.5; my = e.ay * 7.5;
        e.st3 -= dt;
        if (e.st3 <= 0) { e.state = 0; e.st = e.type === T_B1 ? 2.6 : 3.2; G.shake = max(G.shake, 3); }
      }
      if (e.type === T_B1 && e.st2 <= 0) {
        e.st2 = 8;
        for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; spawnEnemy(T_SKIT, e.x + cos(a) * 60, e.y + sin(a) * 60, false); }
      }
    } else if (e.type === T_B2) {
      if (d > 230) { mx = nx; my = ny; } else if (d < 150) { mx = -nx * 0.6; my = -ny * 0.6; } else { mx = -ny * e.dir * 0.8; my = nx * e.dir * 0.8; }
      if (e.st <= 0) { e.st = 3.2; radial(e, enr ? 22 : 16, 125, e.sa); e.sa += 0.2; }
      if (e.st2 <= 0) {
        e.st2 = 1.35;
        for (let j = -1; j <= 1; j++) { const a = atan2(ny, nx) + j * 0.22; fireBullet(e.x, e.y, cos(a), sin(a), 195, e.dmg * 0.6, 6); }
        NT.Audio.play('spit');
      }
      if (rnd() < dt * 0.25) e.dir = -e.dir;
    } else if (e.type === T_B3) {
      if (e.state === 0) {
        mx = nx; my = ny;
        if (e.st2 <= 0) { e.st2 = 1.6; const a = atan2(ny, nx); for (let j = -2; j <= 2; j++) fireBullet(e.x, e.y, cos(a + j * 0.16), sin(a + j * 0.16), 180, e.dmg * 0.5, 6); NT.Audio.play('spit'); }
        if (e.st <= 0) {
          const atk = e.atk++ % 4;
          if (atk === 0) { e.state = 1; e.st3 = 0.75; e.ax = nx; e.ay = ny; NT.Audio.play('charge'); }
          else if (atk === 1) { radial(e, 22, 120, e.sa); e.sa += 0.14; e.st = 0.5; e.atk += 0; e.state = 4; e.st3 = 0.4; }
          else if (atk === 2) {
            for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; spawnEnemy(T_SPLIT, e.x + cos(a) * 80, e.y + sin(a) * 80, false); }
            for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; spawnEnemy(T_SHADE, e.x + cos(a) * 70, e.y + sin(a) * 70, false); }
            e.st = 3;
          } else { e.state = 3; e.st3 = 2.2; }
        }
      } else if (e.state === 3) { // spiral volley
        mx = nx * 0.2; my = ny * 0.2;
        e.st3 -= dt; e.sa += dt * 3.2;
        e.phase -= dt;
        if (e.phase <= 0) { e.phase = 0.09; for (let j = 0; j < 3; j++) { const a = e.sa + j * TAU / 3; fireBullet(e.x, e.y, cos(a), sin(a), 140, e.dmg * 0.5, 6); } }
        if (e.st3 <= 0) { e.state = 0; e.st = 3; }
      } else if (e.state === 4) { // second ring of a double burst
        e.st3 -= dt;
        if (e.st3 <= 0) { radial(e, 22, 120, e.sa + TAU / 44); e.state = 0; e.st = 3; }
      }
    }
    MV.x = mx; MV.y = my;
  }
  const MV = { x: 0, y: 0 };

  function updateEnemies(dt) {
    const L = EP.list, n = EP.n, px = P.x, py = P.y;
    const dr = spawnR * 1.6, despawnR2 = dr * dr;
    const kd = Math.exp(-7 * dt);
    const ending = !!G.ending;
    for (let i = 0; i < n; i++) {
      const e = L[i];
      if (!e.alive) continue;
      const dx = px - e.x, dy = py - e.y, d2 = dx * dx + dy * dy, d = sqrt(d2) || 1;
      const nx = dx / d, ny = dy / d;
      e.nx = nx; e.ny = ny;
      if (e.flash > 0) e.flash -= dt;
      if (d2 > despawnR2) {
        if (!e.big) { relocate(e); continue; }
        if (d2 > despawnR2 * 1.5) { const p = edgePoint(0); e.x = p.x; e.y = p.y; }
      }
      let spd = e.spd;
      if (G.t < e.slowT) spd *= 1 - e.slow;
      let mx = 0, my = 0;
      if (e.stun > 0) e.stun -= dt;
      else if (ending && !G.ending.win) { mx = -ny * 0.3; my = nx * 0.3; }
      else if (e.big) { bossAI(e, dt, nx, ny, d); mx = MV.x; my = MV.y; }
      else switch (e.type) {
        case T_SPIT:
          e.st -= dt;
          if (d < 140) { mx = -nx * 0.7; my = -ny * 0.7; } else if (d < 230) { mx = -ny * 0.55 * e.dir; my = nx * 0.55 * e.dir; } else { mx = nx; my = ny; }
          if (e.st <= 0 && d < 330) {
            e.st = 3.8 + rnd() * 1.8;
            fireBullet(e.x, e.y, nx, ny, 135, e.dmg * 0.65, e.elite ? 7 : 5.5);
            if (e.elite) { fireBullet(e.x, e.y, cos(atan2(ny, nx) + 0.25), sin(atan2(ny, nx) + 0.25), 150, e.dmg, 6); fireBullet(e.x, e.y, cos(atan2(ny, nx) - 0.25), sin(atan2(ny, nx) - 0.25), 150, e.dmg, 6); }
            NT.Audio.play('spit');
          }
          break;
        case T_JELLY:
          if (e.state === 0) {
            mx = nx; my = ny; e.st -= dt;
            if (e.st <= 0 && d < 200) { e.state = 1; e.st = 0.6; e.ax = nx; e.ay = ny; }
          } else if (e.state === 1) {
            mx = -e.ax * 0.15; my = -e.ay * 0.15; e.st -= dt;
            if (e.st <= 0) { e.state = 2; e.st = 0.42; }
          } else if (e.state === 2) {
            mx = e.ax * 7; my = e.ay * 7; e.st -= dt;
            if (e.st <= 0) { e.state = 3; e.st = 0.5; }
          } else {
            mx = nx * 0.3; my = ny * 0.3; e.st -= dt;
            if (e.st <= 0) { e.state = 0; e.st = 1.4 + rnd(); }
          }
          break;
        default:
          mx = nx; my = ny;
      }
      e.x += (mx * spd + e.kx) * dt; e.y += (my * spd + e.ky) * dt;
      e.kx *= kd; e.ky *= kd;
      if (!ending && d < e.r + P.r - 3) touchPlayer(e, nx, ny);
    }
    // separation (cheap, capped neighbour checks)
    for (let i = 0; i < n; i++) {
      const e = L[i];
      if (!e.alive || e.big) continue;
      const cx = floor((e.x - gOX) / CELL), cy = floor((e.y - gOY) / CELL);
      if (cx < 1 || cy < 1 || cx >= GN - 1 || cy >= GN - 1) continue;
      let checks = 0;
      for (let yy = cy - 1; yy <= cy + 1 && checks < 10; yy++) {
        for (let xx = cx - 1; xx <= cx + 1 && checks < 10; xx++) {
          let j = gHead[yy * GN + xx];
          while (j !== -1 && checks < 10) {
            if (j !== i) {
              const o = L[j];
              const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
              const dd = dx * dx + dy * dy;
              if (dd < rr * rr && dd > 0.0001) {
                const dl = sqrt(dd), push = (rr - dl) / dl * 0.25;
                e.x += dx * push; e.y += dy * push;
              }
              checks++;
            }
            j = gNext[j];
          }
        }
      }
    }
  }

  function touchPlayer(e, nx, ny) {
    if (P.iT > 0) return;
    hurt(e.dmg, e.def.key);
    e.kx -= nx * 160 * (1 - e.def.kb); e.ky -= ny * 160 * (1 - e.def.kb);
  }
  function hurt(raw, src) {
    if (P.iT > 0 || P.dead || G.ending) return;
    const dmg = max(1, raw - P.st.armor);
    if (DBG.on) { const k = src || '?'; G.dmgBy[k] = (G.dmgBy[k] || 0) + dmg; }
    P.iT = 0.6;
    G.hurtFlash = 1;
    G.dmgTaken += dmg;
    if (!DBG.god) P.hp -= dmg;
    G.shake = max(G.shake, 5);
    NT.Audio.play('hurt');
    NT.haptic(25);
    burst(P.x, P.y, '#ff6b81', 6, 120);
    if (P.hp <= 0) {
      if (G.revives > 0) {
        G.revives--;
        P.hp = P.maxHp * 0.5; P.iT = 2;
        const n = query(P.x, P.y, 220);
        for (let i = 0; i < n; i++) { const e = qEnemy(qBuf[i]); const dx = e.x - P.x, dy = e.y - P.y, d = sqrt(dx * dx + dy * dy) || 1; e.kx += dx / d * 600 * (1 - e.def.kb); e.ky += dy / d * 600 * (1 - e.def.kb); }
        ringFx(P.x, P.y, '#ffcf4a', 200);
        banner('SECOND WIND', 'Back on your feet!', '#ffcf4a', 2);
        NT.Audio.play('evo');
      } else die();
    }
  }
  function heal(v, fx) {
    if (P.hp >= P.maxHp) return;
    P.hp = min(P.maxHp, P.hp + v); G.healed += v;
    if (fx) { NT.Audio.play('heal'); burst(P.x, P.y, '#5fd08a', 10, 90); }
  }
  function updateBullets(dt) {
    const L = BP.list;
    for (let i = 0; i < BP.n; i++) {
      const b = L[i];
      if (!b.alive) continue;
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0 || G.ending) { b.alive = false; continue; }
      const dx = b.x - P.x, dy = b.y - P.y, rr = b.r + P.r - 2;
      if (dx * dx + dy * dy < rr * rr) { b.alive = false; hurt(b.dmg, 'bullet'); }
    }
  }

  function kill(e, w) {
    if (!e.alive) return;
    e.alive = false;
    const d = e.def;
    G.kills++;
    if (w) w.kills++;
    burst(e.x, e.y, d.rim, e.big ? 40 : e.elite ? 18 : 6, e.big ? 260 : 150);
    if (e.elite || e.big) ringFx(e.x, e.y, d.rim, e.r * 3);
    if (e.xp) dropGem(e.x, e.y, e.xp);
    NT.Audio.play('kill');
    if (e.elite) dropPick(PICK_CHEST, e.x, e.y, false);
    if (!e.big && !e.elite) {
      const luck = 1 + P.st.luck;
      const r = rnd();
      if (r < 0.0035 * luck) dropPick(PICK_COCO, e.x, e.y);
      else if (r < 0.005 * luck) dropPick(PICK_CONCH, e.x, e.y);
    }
    if (e.type === T_SPLIT) {
      const n = e.elite ? 4 : 2 + (rnd() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) { const a = rnd() * TAU; const m = spawnEnemy(T_MINI, e.x + cos(a) * 10, e.y + sin(a) * 10, false); if (m) { m.kx = cos(a) * 160; m.ky = sin(a) * 160; } }
    }
    if (e.big) bossDie(e);
  }
  function bossDie(e) {
    G.bossesKilled++;
    G.shake = 14;
    NT.Audio.play('bossdie');
    NT.haptic([60, 40, 60, 40, 140]);
    for (let i = 0; i < 5; i++) ringFx(e.x + (rnd() - 0.5) * 60, e.y + (rnd() - 0.5) * 60, i % 2 ? '#ffffff' : e.def.rim, 80 + i * 40);
    for (let i = 0; i < 12; i++) dropGem(e.x + (rnd() - 0.5) * 90, e.y + (rnd() - 0.5) * 90, 20);
    for (let i = bigList.length - 1; i >= 0; i--) if (bigList[i] === e) bigList.splice(i, 1);
    if (G.boss === e) G.boss = null;
    NT.Audio.setIntensity(1);
    G.timeScale = 0.35; G.slowT = 0.8;
    if (e.type === T_B3) { endRun(true, 'tideking'); return; }
    dropPick(PICK_CHEST, e.x, e.y, true);
    heal(P.maxHp * 0.25, true);
    banner(e.def.name + ' FALLS', '+30 Shards', '#ffcf4a', 2.4);
  }

  // ---------------- gems & pickups ----------------
  function dropGem(x, y, v) {
    const g = GP.get();
    if (!g) { if (GP.n) GP.list[(rnd() * GP.n) | 0].v += v; return; }
    g.x = x + (rnd() - 0.5) * 6; g.y = y + (rnd() - 0.5) * 6; g.v = v; g.kind = v >= 20 ? 2 : v >= 5 ? 1 : 0;
    g.mag = false; g.sp = 0; g.vx = (rnd() - 0.5) * 70; g.vy = (rnd() - 0.5) * 70; g.ph = rnd() * TAU;
  }
  function dropPick(kind, x, y, boss) {
    const k = KP.get(); if (!k) return;
    k.kind = kind; k.x = x; k.y = y; k.t = 0; k.mag = false; k.sp = 0; k.boss = !!boss;
  }
  function gainXp(v) {
    G.xp += v * P.st.xp * DBG.xp;
    while (G.xp >= G.xpNext) {
      G.xp -= G.xpNext; G.level++; G.xpNext = xpForLevel(G.level); G.pendingLv++;
    }
  }
  function updateGems(dt) {
    const L = GP.list, mr = 76 * P.st.magnet, mr2 = mr * mr, px = P.x, py = P.y;
    const fr = Math.exp(-6 * dt);
    for (let i = 0; i < GP.n; i++) {
      const g = L[i];
      if (!g.alive) continue;
      const dx = px - g.x, dy = py - g.y, d2 = dx * dx + dy * dy;
      if (!g.mag) {
        g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= fr; g.vy *= fr;
        if (d2 < mr2) { g.mag = true; g.sp = -80; }
      } else {
        const d = sqrt(d2) || 1;
        g.sp = min(900, g.sp + 1100 * dt);
        const s = max(0, g.sp) * dt;
        if (d < P.r + 6 || s >= d) {
          g.alive = false; gainXp(g.v); NT.Audio.play('gem');
          continue;
        }
        g.x += dx / d * (g.sp < 0 ? g.sp * dt : s); g.y += dy / d * (g.sp < 0 ? g.sp * dt : s);
      }
    }
    const K2 = KP.list;
    for (let i = 0; i < KP.n; i++) {
      const k = K2[i];
      if (!k.alive) continue;
      k.t += dt;
      const dx = px - k.x, dy = py - k.y, d2 = dx * dx + dy * dy, d = sqrt(d2) || 1;
      if (k.kind !== PICK_CHEST && !k.mag && d < mr) k.mag = true;
      if (k.mag) { k.sp = min(700, k.sp + 900 * dt); k.x += dx / d * min(d, k.sp * dt); k.y += dy / d * min(d, k.sp * dt); }
      if (d < P.r + 14) {
        k.alive = false;
        if (k.kind === PICK_COCO) { heal(30, true); }
        else if (k.kind === PICK_CONCH) { for (let j = 0; j < GP.n; j++) if (L[j].alive) { L[j].mag = true; L[j].sp = 200; } NT.Audio.play('chest'); ringFx(P.x, P.y, '#7aa8ff', 300); }
        else openChest(k.boss);
      }
    }
  }

  // ---------------- particles / numbers / banners ----------------
  function burst(x, y, col, n, spd) {
    for (let i = 0; i < n; i++) {
      const p = FX.get(); if (!p) return;
      const a = rnd() * TAU, s = spd * (0.3 + rnd() * 0.7);
      p.kind = 0; p.x = x; p.y = y; p.vx = cos(a) * s; p.vy = sin(a) * s; p.max = p.life = 0.3 + rnd() * 0.35;
      p.size = 2 + rnd() * 2.5; p.col = col; p.drag = 4;
    }
  }
  function ringFx(x, y, col, r) {
    const p = FX.get(); if (!p) return;
    p.kind = 1; p.x = x; p.y = y; p.vx = r; p.vy = 0; p.max = p.life = 0.45; p.size = 4; p.col = col; p.drag = 0;
  }
  function sparkle(x, y, col, n, spd) {
    for (let i = 0; i < n; i++) {
      const p = FX.get(); if (!p) return;
      const a = rnd() * TAU, s = spd * (0.4 + rnd() * 0.6);
      p.kind = 2; p.x = x; p.y = y; p.vx = cos(a) * s; p.vy = sin(a) * s - 30; p.max = p.life = 0.5 + rnd() * 0.5;
      p.size = 3 + rnd() * 3; p.col = col; p.drag = 2.5;
    }
  }
  function splash(x, y, r) {
    for (let i = 0; i < 8; i++) {
      const p = FX.get(); if (!p) return;
      const a = rnd() * TAU, s = r * (2 + rnd() * 3);
      p.kind = 0; p.x = x; p.y = y; p.vx = cos(a) * s; p.vy = sin(a) * s; p.max = p.life = 0.35 + rnd() * 0.2;
      p.size = 2 + rnd() * 2; p.col = i & 1 ? '#e8ffff' : '#7fd6ff'; p.drag = 5;
    }
    ringFx(x, y, '#bff4ff', r);
  }
  function spawnNum(x, y, v, crit) {
    const p = NP.get(); if (!p) return;
    p.x = x; p.y = y; p.vy = crit ? -70 : -50; p.life = crit ? 0.8 : 0.55; p.s = nstr(Math.round(v)); p.crit = crit;
  }
  function banner(text, sub, col, dur) { G.banner = { text, sub, col, t: 0, dur: dur || 2 }; }
  function updateFx(dt) {
    const L = FX.list;
    for (let i = 0; i < FX.n; i++) {
      const p = L[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      if (p.kind !== 1) {
        const f = Math.exp(-p.drag * dt);
        p.vx *= f; p.vy *= f;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    const N = NP.list;
    for (let i = 0; i < NP.n; i++) {
      const p = N[i];
      if (!p.alive) continue;
      p.life -= dt; p.y += p.vy * dt; p.vy *= 0.94;
      if (p.life <= 0) p.alive = false;
    }
    FX.compact(); NP.compact();
    if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  }

  // ---------------- player ----------------
  function updatePlayer(dt) {
    readInput();
    const sp = 125 * P.st.speed;
    P.vx = IN.jx * sp; P.vy = IN.jy * sp;
    P.moving = abs(IN.jx) + abs(IN.jy) > 0.05;
    if (P.moving) { const l = sqrt(IN.jx * IN.jx + IN.jy * IN.jy); P.fx = IN.jx / l; P.fy = IN.jy / l; }
    P.x += P.vx * dt; P.y += P.vy * dt;
    if (P.iT > 0) P.iT -= dt;
    if (P.st.regen > 0) heal(P.st.regen * dt, false);
  }

  // ---------------- level up / choices ----------------
  function candidates() {
    const c = [];
    for (const id of NT.WEAPON_IDS) {
      const w = getW(id);
      if (w) { if (!w.evo && w.level < NT.MAX_LEVEL) c.push({ kind: 'wup', id, wt: 3 }); }
      else if (G.weapons.length < NT.MAX_WEAPONS) c.push({ kind: 'wnew', id, wt: G.weapons.length < 3 ? 2.6 : 1.1 });
    }
    for (const id of NT.PASSIVE_IDS) {
      const lv = G.passives[id] || 0;
      if (lv > 0) { if (lv < NT.MAX_LEVEL) c.push({ kind: 'pup', id, wt: 2 }); }
      else if (G.passiveOrder.length < NT.MAX_PASSIVES) c.push({ kind: 'pnew', id, wt: 1.4 });
    }
    return c;
  }
  function evoReady() {
    const out = [];
    for (const w of G.weapons) if (!w.evo && w.level >= NT.MAX_LEVEL && (G.passives[NT.WEAPONS[w.id].needs] || 0) > 0) out.push(w);
    return out;
  }
  function curLevel(c) {
    if (c.kind === 'wup') return getW(c.id).level;
    if (c.kind === 'pup') return G.passives[c.id] || 0;
    return 0;
  }
  function setRarity(c) {
    if (c.kind === 'evo') { c.rarity = 3; return c; }
    if (c.kind === 'heal' || c.kind === 'shards') { c.rarity = 0; return c; }
    const r = rnd(), luck = P.st.luck;
    let lv = r < 0.03 + luck * 0.04 ? 3 : r < 0.15 + luck * 0.1 ? 2 : 1;
    c.from = curLevel(c);
    c.to = min(NT.MAX_LEVEL, c.from + lv);
    c.rarity = c.to - c.from - 1;
    return c;
  }
  function rollChoices(n) {
    const pool = candidates(), out = [];
    const evos = evoReady();
    if (evos.length && rnd() < 0.5) { const w = evos[(rnd() * evos.length) | 0]; out.push({ kind: 'evo', id: NT.WEAPONS[w.id].evo, wid: w.id }); }
    while (out.length < n && pool.length) {
      let tot = 0; for (const c of pool) tot += c.wt;
      let r = rnd() * tot, idx = 0;
      for (; idx < pool.length - 1; idx++) { r -= pool[idx].wt; if (r < 0) break; }
      out.push(pool.splice(idx, 1)[0]);
    }
    if (out.length < n) out.push({ kind: 'heal', id: 'heal' });
    if (out.length < n) out.push({ kind: 'shards', id: 'shards' });
    return out.map(setRarity);
  }
  function applyChoice(c) {
    switch (c.kind) {
      case 'wnew': addWeapon(c.id, c.to); break;
      case 'wup': { const w = getW(c.id); w.level = c.to; computeStats(w); break; }
      case 'pnew': G.passiveOrder.push(c.id); G.passives[c.id] = c.to; break;
      case 'pup': G.passives[c.id] = c.to; break;
      case 'evo': {
        const w = getW(c.wid); if (!w) break;
        w.evo = true; computeStats(w);
        if (w.id === 'shell') { w.on = true; }
        banner('EVOLVED!', NT.EVOS[c.id].name, '#ffcf4a', 2.2);
        NT.Audio.play('evo');
        sparkle(P.x, P.y, '#ffcf4a', 30, 220);
        break;
      }
      case 'heal': heal(P.maxHp * 0.3, true); break;
      case 'shards': G.bonusShards += 15; break;
    }
    recalc();
  }
  function describe(c) {
    const out = { name: '', tag: '', desc: '', hint: '', icon: c.id, color: NT.RARITY[c.rarity || 0].color };
    const MAX = NT.MAX_LEVEL;
    if (c.kind === 'wnew' || c.kind === 'wup') {
      const d = NT.WEAPONS[c.id];
      out.name = d.name;
      out.tag = c.kind === 'wnew' ? (c.to > 1 ? 'NEW · LV ' + c.to : 'NEW WEAPON') : 'LV ' + c.from + ' → ' + (c.to >= MAX ? 'MAX' : c.to);
      const lines = [];
      for (let l = max(1, c.from + (c.kind === 'wnew' ? 0 : 1)); l <= c.to; l++) lines.push(d.desc[l - 1]);
      out.desc = lines.join(' · ');
      if (c.kind === 'wnew') out.hint = 'Evolves with ' + NT.PASSIVES[d.needs].name;
      else if (c.to >= MAX) out.hint = (G.passives[d.needs] ? 'Ready to evolve! (chests)' : 'Evolves with ' + NT.PASSIVES[d.needs].name);
    } else if (c.kind === 'pnew' || c.kind === 'pup') {
      const d = NT.PASSIVES[c.id];
      out.name = d.name;
      out.tag = c.kind === 'pnew' ? (c.to > 1 ? 'NEW · LV ' + c.to : 'NEW PASSIVE') : 'LV ' + c.from + ' → ' + (c.to >= MAX ? 'MAX' : c.to);
      out.desc = d.desc + (c.to - c.from > 1 ? '  ×' + (c.to - c.from) : '');
      for (const w of G.weapons) if (!w.evo && NT.WEAPONS[w.id].needs === c.id) out.hint = 'Evolves ' + NT.WEAPONS[w.id].short + ' at max level';
    } else if (c.kind === 'evo') {
      out.name = NT.EVOS[c.id].name; out.tag = 'EVOLUTION'; out.desc = NT.EVOS[c.id].desc;
      out.hint = 'Replaces ' + NT.WEAPONS[c.wid].name;
    } else if (c.kind === 'heal') { out.name = 'Coconut'; out.tag = 'SNACK'; out.desc = 'Restore 30% of your HP.'; }
    else { out.name = 'Shard Pouch'; out.tag = 'TREASURE'; out.desc = '+15 Shards at the end of the run.'; }
    out.rarityName = NT.RARITY[c.rarity || 0].name;
    return out;
  }
  function openLevelUp() {
    G.pendingLv--;
    G.modal = 'levelup';
    resetInput();
    G.lvlFx = 1;
    sparkle(P.x, P.y, '#5ce1e6', 24, 200);
    ringFx(P.x, P.y, '#5ce1e6', 120);
    NT.Audio.play('lvl');
    NT.haptic([20, 30, 20]);
    NT.UI.openLevelUp(rollChoices(3));
  }
  function openChest(boss) {
    G.modal = 'chest';
    G.chestsOpened++;
    resetInput();
    const luck = P.st.luck, r = rnd();
    const count = boss ? 3 : r < 0.1 + luck * 0.12 ? 3 : r < 0.4 + luck * 0.1 ? 2 : 1;
    const items = [];
    for (let i = 0; i < count; i++) {
      let c = null;
      const evos = evoReady();
      if (evos.length) { const w = evos[0]; c = { kind: 'evo', id: NT.WEAPONS[w.id].evo, wid: w.id, rarity: 3 }; }
      else {
        const opts = [];
        for (const w of G.weapons) if (!w.evo && w.level < NT.MAX_LEVEL) opts.push({ kind: 'wup', id: w.id });
        for (const id of G.passiveOrder) if (G.passives[id] < NT.MAX_LEVEL) opts.push({ kind: 'pup', id });
        if (opts.length) { c = opts[(rnd() * opts.length) | 0]; c.from = curLevel(c); c.to = c.from + 1; c.rarity = 0; }
        else c = { kind: rnd() < 0.5 ? 'heal' : 'shards', id: 'x', rarity: 0 };
        if (c.kind === 'heal') c.id = 'heal'; if (c.kind === 'shards') c.id = 'shards';
      }
      if (c.kind === 'wup' && i > 0 && rnd() < 0.25 + luck * 0.2 && c.to < NT.MAX_LEVEL) { c.to++; c.rarity = 1; }
      applyChoice(c);
      items.push(describe(c));
    }
    NT.Audio.play('chest');
    NT.haptic([30, 40, 30]);
    NT.UI.openChest(items, boss);
  }

  // ---------------- run lifecycle ----------------
  function resetRun(charId) {
    EP.clear(); PP.clear(); BP.clear(); GP.clear(); KP.clear(); FX.clear(); NP.clear();
    bigList.length = 0;
    G.char = NT.CHARS.find((c) => c.id === charId) || NT.CHARS[0];
    P.x = 0; P.y = 0; P.vx = P.vy = 0; P.fx = 0; P.fy = 1; P.iT = 0; P.dead = false; P.maxHp = 100; P.hp = 100;
    G.t = DBG.t; G.kills = 0; G.level = 1; G.xp = 0; G.xpNext = xpForLevel(1); G.pendingLv = 0;
    G.weapons = []; G.passives = {}; G.passiveOrder = []; G.boss = null; G.bossesKilled = 0;
    G.shake = 0; G.hurtFlash = 0; G.banner = null; G.ending = null; G.timeScale = 1; G.slowT = 0;
    G.evI = 0; while (G.evI < EVENTS.length && EVENTS[G.evI][0] < G.t) G.evI++;
    G.eliteT = max(50, G.t + 20); G.spawnAcc = 0; G.bonusShards = 0; G.lvlFx = 0; G.healed = 0; G.chestsOpened = 0; G.dmgTaken = 0;
    G.dmgBy = {}; G.rerolls = 1 + meta('reroll'); G.revives = meta('revive');
    recalc(); P.hp = P.maxHp;
    addWeapon(G.char.weapon, 1);
    for (let i = 0; i < DBG.spawn; i++) { const a = rnd() * TAU, r = 120 + rnd() * spawnR; spawnEnemy(pickType(max(300, G.t)), cos(a) * r, sin(a) * r, false); }
  }
  function start(charId) {
    resetRun(charId);
    G.mode = 'play'; G.modal = null;
    resetInput();
    banner('NIGHT FALLS', 'Survive until dawn', '#ffb347', 2.6);
    NT.Audio.setIntensity(G.t > 120 ? 1 : 0);
    NT.Audio.startMusic();
  }
  function die() {
    P.dead = true;
    burst(P.x, P.y, G.char.color, 30, 220);
    ringFx(P.x, P.y, '#ff6b81', 120);
    NT.haptic([100, 50, 200]);
    endRun(false, 'dead');
  }
  function endRun(win, why) {
    if (G.ending) return;
    G.ending = { t: 0, win, why };
    if (win) {
      const L = EP.list;
      for (let i = 0; i < EP.n; i++) { const e = L[i]; if (e.alive) { e.alive = false; burst(e.x, e.y, '#ffd9a0', 3, 90); } }
      bigList.length = 0; G.boss = null;
      banner(why === 'tideking' ? 'THE TIDE BREAKS' : 'DAWN BREAKS', 'You survived the night!', '#ffcf4a', 3);
      NT.Audio.play('win');
      for (let i = 0; i < GP.n; i++) if (GP.list[i].alive) { GP.list[i].mag = true; GP.list[i].sp = 300; }
    } else NT.Audio.play('lose');
    NT.Audio.setIntensity(0);
  }
  function finishRun() {
    const win = G.ending.win;
    const s = NT.save;
    const greed = 1 + 0.12 * meta('greed');
    const base = floor(G.t / 10) + floor(G.kills / 15) + G.bossesKilled * 30 + (win ? 100 : 0) + floor(G.level / 2) + G.bonusShards;
    const shards = Math.round(base * greed);
    const res = {
      win, why: G.ending.why, time: G.t, kills: G.kills, level: G.level, shards, bosses: G.bossesKilled,
      char: G.char, chests: G.chestsOpened, dmgTaken: G.dmgTaken,
      weapons: G.weapons.map((w) => ({ id: w.evo ? NT.WEAPONS[w.id].evo : w.id, name: weaponName(w), dmg: w.dmg, kills: w.kills, level: w.level, evo: w.evo, dps: w.dmg / max(1, G.t - w.got) })),
      passives: G.passiveOrder.map((id) => ({ id, level: G.passives[id] })),
    };
    res.weapons.sort((a, b) => b.dmg - a.dmg);
    G.mode = 'over'; G.modal = null;
    NT.UI.showSummary(res);
    void s;
  }
  function pause() {
    if (G.mode !== 'play' || G.modal || G.ending) return false;
    G.modal = 'pause'; resetInput();
    NT.UI.openPause();
    return true;
  }
  function resume() { G.modal = null; resetInput(); lastT = performance.now(); }
  function quit() { if (G.mode === 'play' && !G.ending) { G.modal = null; endRun(false, 'quit'); G.ending.t = 99; } }
  function toTitle() {
    G.mode = 'title'; G.modal = null;
    EP.clear(); PP.clear(); BP.clear(); GP.clear(); KP.clear(); NP.clear(); bigList.length = 0;
    G.weapons = []; G.boss = null; G.banner = null; G.ending = null; G.t = 0;
    P.x = P.y = 0; P.dead = false;
    G.char = NT.CHARS.find((c) => c.id === NT.save.char) || NT.CHARS[0];
    titleSpawned = false;
  }

  // ---------------- main update ----------------
  function update(dt) {
    G.time += dt;
    if (G.slowT > 0) { G.slowT -= dt / max(0.1, G.timeScale); if (G.slowT <= 0) G.timeScale = 1; }
    if (G.ending) {
      G.ending.t += dt;
      gridBuild(); updateEnemies(dt); updateGems(dt); updateFx(dt); updateBullets(dt);
      EP.compact(); GP.compact(); BP.compact(); KP.compact();
      if (G.ending.win) { readInput(); P.x += IN.jx * 60 * dt; P.y += IN.jy * 60 * dt; }
      if (G.ending.t > (G.ending.win ? 3.2 : 2.0)) finishRun();
      return;
    }
    G.t += dt;
    director(dt);
    updatePlayer(dt);
    gridBuild();
    updateEnemies(dt);
    if (G.ending) return;
    updateWeapons(dt);
    updateProjectiles(dt);
    updateBullets(dt);
    updateGems(dt);
    updateFx(dt);
    EP.compact(); PP.compact(); BP.compact(); GP.compact(); KP.compact();
    if (G.shake > 0) G.shake = max(0, G.shake - dt * 30);
    if (G.hurtFlash > 0) G.hurtFlash = max(0, G.hurtFlash - dt * 3);
    if (G.lvlFx > 0) G.lvlFx = max(0, G.lvlFx - dt * 1.5);
    if (G.t >= NT.RUN_LENGTH && !G.ending) { endRun(true, 'dawn'); return; }
    if (G.t > 120 && NT.Audio.intensity === 0) NT.Audio.setIntensity(1);
    if (!G.modal && G.pendingLv > 0 && !G.ending) openLevelUp();
  }

  // title ambience: a few shades drifting around the idle castaway
  let titleSpawned = false;
  function updateTitle(dt) {
    G.time += dt;
    if (!titleSpawned) {
      titleSpawned = true;
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU, r = 200 + rnd() * 140;
        const e = spawnEnemy(i % 5 === 0 ? T_SKIT : i % 7 === 3 ? T_JELLY : T_SHADE, cos(a) * r, sin(a) * r, i === 5);
        if (e) { e.st = a; e.st2 = r; }
      }
      for (let i = 0; i < 26; i++) { const a = rnd() * TAU, r = 60 + rnd() * 240; dropGem(cos(a) * r, sin(a) * r, rnd() < 0.15 ? 5 : 1); }
    }
    const L = EP.list;
    for (let i = 0; i < EP.n; i++) {
      const e = L[i];
      e.st += dt * 0.12 * (i % 2 ? 1 : -1);
      e.x = cos(e.st) * e.st2; e.y = sin(e.st) * e.st2 * 1.25;
      e.nx = -e.x / e.st2; e.ny = -e.y / (e.st2 * 1.25);
    }
    updateFx(dt);
    if (rnd() < dt * 3) { const g = GP.list[(rnd() * GP.n) | 0]; if (g) sparkle(g.x, g.y, '#bfe8ff', 1, 20); }
  }

  // ---------------- rendering ----------------
  const visBuf = new Array(MAXE);
  function hash(x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function setWorld() { ctx.setTransform(K, 0, 0, K, wOX, wOY); }
  function drawRot(img, x, y, w, h, a) {
    const c = cos(a) * K, s = sin(a) * K;
    ctx.setTransform(c, s, -s, c, wOX + x * K, wOY + y * K);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  }

  function render() {
    const A = NT.Art;
    let sx = 0, sy = 0;
    if (G.shake > 0 && NT.save.set.shake) { sx = (rnd() * 2 - 1) * G.shake; sy = (rnd() * 2 - 1) * G.shake; }
    camX = P.x; camY = P.y;
    wOX = cv.width / 2 - (camX - sx) * K; wOY = cv.height / 2 - (camY - sy) * K;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    setWorld();
    const vx0 = camX - viewW / 2 - 30, vx1 = camX + viewW / 2 + 30, vy0 = camY - viewH / 2 - 30, vy1 = camY + viewH / 2 + 30;
    // ground
    const TS = 256;
    for (let y = floor(vy0 / TS) * TS; y < vy1; y += TS) for (let x = floor(vx0 / TS) * TS; x < vx1; x += TS) ctx.drawImage(A.sand, x, y, TS + 0.6, TS + 0.6);
    const DC = 170;
    for (let cy = floor((vy0 - 60) / DC); cy <= floor((vy1 + 60) / DC); cy++) {
      for (let cx = floor((vx0 - 60) / DC); cx <= floor((vx1 + 60) / DC); cx++) {
        const h = hash(cx, cy);
        if ((h & 255) > 110) continue;
        let type = (h >>> 8) % 6;
        if (type === 5 && ((h >>> 12) & 3) !== 0) type = (h >>> 14) % 5;
        const spr = A.decor[type];
        const px = cx * DC + ((h >>> 16) & 127) / 127 * 140, py = cy * DC + ((h >>> 23) & 127) / 127 * 140;
        ctx.drawImage(spr, px - spr.ww / 2, py - spr.wh / 2, spr.ww, spr.wh);
      }
    }
    // player light
    ctx.globalAlpha = 0.22;
    ctx.drawImage(A.glowWarm, P.x - 150, P.y - 150, 300, 300);
    ctx.globalAlpha = 1;
    // auras
    for (let wi = 0; wi < G.weapons.length; wi++) {
      const w = G.weapons[wi], s = w.s;
      if (w.id === 'lamp') {
        const R = s.radius * P.st.area, fl = 1 + sin(G.time * 13) * 0.02 + sin(G.time * 7.3) * 0.02;
        ctx.globalAlpha = w.evo ? 0.55 : 0.45;
        ctx.drawImage(w.evo ? A.glowWhite : A.glowWarm, P.x - R * 1.15 * fl, P.y - R * 1.15 * fl, R * 2.3 * fl, R * 2.3 * fl);
        ctx.globalAlpha = 0.35 + 0.15 * sin(G.time * 5);
        ctx.strokeStyle = w.evo ? '#fff3b0' : '#ffb347'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(P.x, P.y, R * fl, 0, TAU); ctx.stroke();
        if (w.evo) {
          ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff6c8';
          const a = G.time * 1.4;
          ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.arc(P.x, P.y, R * 1.9, a - 0.22, a + 0.22); ctx.closePath();
          ctx.moveTo(P.x, P.y); ctx.arc(P.x, P.y, R * 1.9, a + Math.PI - 0.22, a + Math.PI + 0.22); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (w.id === 'tide') {
        for (let k = 0; k < 3; k++) {
          const pu = w.pulses[k];
          if (!pu.on || pu.t < 0) continue;
          const f = pu.t / s.expand;
          ctx.globalAlpha = (1 - f) * 0.85;
          ctx.strokeStyle = w.evo ? '#bff8ff' : '#5ce1e6'; ctx.lineWidth = 7 * (1 - f) + 2;
          ctx.beginPath(); ctx.arc(P.x, P.y, pu.r, 0, TAU); ctx.stroke();
          ctx.globalAlpha = (1 - f) * 0.6; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(P.x, P.y, max(0, pu.r - 5), 0, TAU); ctx.stroke();
          ctx.globalAlpha = (1 - f) * 0.08; ctx.fillStyle = '#5ce1e6';
          ctx.beginPath(); ctx.arc(P.x, P.y, pu.r, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    // pickups
    const KL = KP.list;
    for (let i = 0; i < KP.n; i++) {
      const k = KL[i];
      if (!k.alive) continue;
      const bob = sin(G.time * 4 + i) * 2;
      if (k.kind === PICK_CHEST) {
        ctx.globalAlpha = 0.55 + 0.25 * sin(G.time * 5);
        ctx.drawImage(A.glowGold, k.x - 40, k.y - 40, 80, 80); ctx.globalAlpha = 1;
        const s = k.boss ? 1.35 : 1;
        ctx.drawImage(A.chest, k.x - 20 * s, k.y - 20 * s + bob, 40 * s, 40 * s);
      } else {
        const spr = k.kind === PICK_COCO ? A.coconut : A.conch;
        ctx.drawImage(spr, k.x - spr.ww / 2, k.y - spr.wh / 2 + bob, spr.ww, spr.wh);
      }
    }
    // gems
    const GL = GP.list;
    for (let i = 0; i < GP.n; i++) {
      const g = GL[i];
      if (!g.alive || g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
      const spr = A.gems[g.kind];
      ctx.drawImage(spr, g.x - spr.ww / 2, g.y - spr.wh / 2, spr.ww, spr.wh);
    }
    // twinkles
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < GP.n; i++) {
      const g = GL[i];
      if (!g.alive || g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue;
      const tw = sin(G.time * 3 + g.ph * 7);
      if (tw < 0.92) continue;
      const s = (tw - 0.92) * 40;
      ctx.rect(g.x - s / 2 + 2, g.y - 4.5, s, 0.9); ctx.rect(g.x + 2 - 0.45, g.y - 4 - s / 2, 0.9, s);
    }
    ctx.fill();
    // telegraphs
    const L = EP.list;
    let nv = 0;
    for (let i = 0; i < EP.n; i++) {
      const e = L[i];
      if (!e.alive) continue;
      if (e.x + e.r * 2 < vx0 || e.x - e.r * 2 > vx1 || e.y + e.r * 2 < vy0 || e.y - e.r * 2 > vy1) continue;
      visBuf[nv++] = e;
      if (e.state === 1 && (e.type === T_JELLY || e.big)) {
        const len = e.big ? 400 : 150, wdt = e.big ? e.r * 1.6 : e.r * 1.2;
        ctx.globalAlpha = 0.16 + 0.1 * sin(G.time * 30);
        ctx.strokeStyle = '#ff4a6a'; ctx.lineWidth = wdt; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.ax * len, e.y + e.ay * len); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // enemies
    for (let i = 0; i < nv; i++) {
      const e = visBuf[i];
      if (e.elite || e.big) {
        const gr = e.r * (e.big ? 2.6 : 2.4);
        ctx.globalAlpha = 0.6 + 0.3 * sin(G.time * 6 + e.phase);
        ctx.drawImage(e.big ? (e.type === T_B2 ? A.glowCyan : A.glowRed) : A.glowGold, e.x - gr, e.y - gr, gr * 2, gr * 2);
        ctx.globalAlpha = 1;
      }
      const spr = e.flash > 0 ? A.eFlash[e.type] : A.eSpr[e.type];
      const sc = e.r / e.def.r;
      const wb = sin(G.time * 8 + e.phase) * 0.06;
      const w = spr.ww * sc * (1 + wb), h = spr.wh * sc * (1 - wb);
      if (e.stun > 0) ctx.globalAlpha = 0.65;
      ctx.drawImage(spr, e.x - w / 2, e.y - h / 2, w, h);
      if (e.stun > 0) ctx.globalAlpha = 1;
    }
    // eyes (batched)
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#ff3b5c' : '#ffe9a0';
      ctx.beginPath();
      for (let i = 0; i < nv; i++) {
        const e = visBuf[i];
        if ((e.elite || e.big) !== (pass === 1)) continue;
        const r = e.r, er = max(1.6, r * 0.15), sep = r * 0.33;
        const ex = e.x + e.nx * r * 0.22, ey = e.y - r * 0.18 + e.ny * r * 0.14 + (e.type === T_SKIT ? -r * 0.05 : 0);
        ctx.moveTo(ex - sep + er, ey); ctx.arc(ex - sep, ey, er, 0, TAU);
        ctx.moveTo(ex + sep + er, ey); ctx.arc(ex + sep, ey, er, 0, TAU);
      }
      ctx.fill();
    }
    // player
    if (!P.dead) {
      const blink = P.iT > 0 && ((P.iT * 20) | 0) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.55;
      NT.Art.drawBlob(ctx, P.x, P.y, P.r, G.char ? G.char.color : '#ffd27a', G.char ? G.char.acc : 'sprout', P.fx, P.fy, G.time, P.moving ? 1 : 0.2, P.iT > 0.4);
      ctx.globalAlpha = 1;
      if (G.mode === 'play') {
        const bw = 30, bx = P.x - bw / 2, by = P.y + P.r + 7;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
        const f = clamp(P.hp / P.maxHp, 0, 1);
        ctx.fillStyle = f > 0.5 ? '#6dff9a' : f > 0.25 ? '#ffcf4a' : '#ff5d73';
        ctx.fillRect(bx, by, bw * f, 3);
      }
      if (G.lvlFx > 0) {
        ctx.globalAlpha = G.lvlFx; ctx.strokeStyle = '#5ce1e6'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(P.x, P.y, P.r + (1 - G.lvlFx) * 60, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    // shells
    for (let wi = 0; wi < G.weapons.length; wi++) {
      const w = G.weapons[wi];
      if (w.id !== 'shell' || w.vis < 0.05) continue;
      const spr = w.evo ? A.pearl : A.shell, sz = 22 * P.st.area * (0.5 + 0.5 * w.vis);
      ctx.globalAlpha = w.vis;
      for (let k = 0; k < w.s.count; k++) drawRot(spr, w.sx[k], w.sy[k], sz, sz, w.ang * 2 + k);
      setWorld();
      ctx.globalAlpha = 1;
    }
    // projectiles
    const PL = PP.list;
    for (let i = 0; i < PP.n; i++) {
      const p = PL[i];
      if (!p.alive || p.kind !== 1) continue;
      const sz = 30 * p.size;
      drawRot(p.w.evo ? A.kraken : A.boom, p.x, p.y, sz, sz, p.rot);
    }
    setWorld();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(200,220,255,0.25)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < PP.n; i++) {
      const p = PL[i];
      if (!p.alive || p.kind !== 2) continue;
      ctx.moveTo(p.x - p.dx * 20 * p.size, p.y - p.dy * 20 * p.size); ctx.lineTo(p.x - p.dx * 60 * p.size, p.y - p.dy * 60 * p.size);
    }
    ctx.stroke();
    ctx.strokeStyle = '#d6e2f5'; ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i < PP.n; i++) {
      const p = PL[i];
      if (!p.alive || p.kind !== 2) continue;
      ctx.moveTo(p.x - p.dx * 22 * p.size, p.y - p.dy * 22 * p.size); ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < PP.n; i++) {
      const p = PL[i];
      if (!p.alive || p.kind !== 2) continue;
      const s = 5 * p.size, px = -p.dy, py = p.dx;
      ctx.moveTo(p.x + p.dx * s * 1.6, p.y + p.dy * s * 1.6);
      ctx.lineTo(p.x + px * s, p.y + py * s); ctx.lineTo(p.x - p.dx * s * 0.3, p.y - p.dy * s * 0.3); ctx.lineTo(p.x - px * s, p.y - py * s);
      ctx.closePath();
    }
    ctx.fill();
    // gulls
    for (let wi = 0; wi < G.weapons.length; wi++) {
      const w = G.weapons[wi];
      if (w.id !== 'gull') continue;
      const big = w.evo ? 1.45 : 1;
      for (let k = 0; k < w.s.count; k++) {
        const g = w.gulls[k];
        if (!g.init) continue;
        const flap = sin(G.time * 18 + k * 2) * 5 * big;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(g.x, g.y + 18, 7 * big, 2.5 * big, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = w.evo ? '#fff6dc' : '#eef3fb'; ctx.lineWidth = 3 * big;
        ctx.beginPath();
        ctx.moveTo(g.x - 11 * big, g.y - flap); ctx.quadraticCurveTo(g.x - 5 * big, g.y - 6 * big, g.x, g.y);
        ctx.quadraticCurveTo(g.x + 5 * big, g.y - 6 * big, g.x + 11 * big, g.y - flap);
        ctx.stroke();
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(g.x, g.y + 1, 1.8 * big, 0, TAU); ctx.fill();
      }
    }
    // enemy bullets
    const BL = BP.list;
    ctx.fillStyle = 'rgba(255,70,150,0.3)';
    ctx.beginPath();
    for (let i = 0; i < BP.n; i++) { const b = BL[i]; if (!b.alive) continue; ctx.moveTo(b.x + b.r * 1.9, b.y); ctx.arc(b.x, b.y, b.r * 1.9, 0, TAU); }
    ctx.fill();
    ctx.fillStyle = '#ff4fa0';
    ctx.beginPath();
    for (let i = 0; i < BP.n; i++) { const b = BL[i]; if (!b.alive) continue; ctx.moveTo(b.x + b.r, b.y); ctx.arc(b.x, b.y, b.r, 0, TAU); }
    ctx.fill();
    ctx.fillStyle = '#ffe0f2';
    ctx.beginPath();
    for (let i = 0; i < BP.n; i++) { const b = BL[i]; if (!b.alive) continue; ctx.moveTo(b.x + b.r * 0.45, b.y); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); }
    ctx.fill();
    // particles
    const FL = FX.list;
    let lastCol = '';
    for (let i = 0; i < FX.n; i++) {
      const p = FL[i];
      if (!p.alive) continue;
      const f = p.life / p.max;
      if (p.kind === 0) {
        if (p.col !== lastCol) { ctx.fillStyle = p.col; lastCol = p.col; }
        const s = p.size * (0.4 + 0.6 * f);
        ctx.globalAlpha = min(1, f * 1.6);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.kind === 1) {
        ctx.globalAlpha = f * 0.9;
        ctx.strokeStyle = p.col; ctx.lineWidth = 1 + 4 * f;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.vx * (1 - f * f) + 4, 0, TAU); ctx.stroke();
      } else {
        if (p.col !== lastCol) { ctx.fillStyle = p.col; lastCol = p.col; }
        const s = p.size * f;
        ctx.globalAlpha = min(1, f * 2);
        ctx.fillRect(p.x - s, p.y - 0.6, s * 2, 1.2); ctx.fillRect(p.x - 0.6, p.y - s, 1.2, s * 2);
      }
    }
    ctx.globalAlpha = 1;
    // damage numbers
    const NL = NP.list;
    if (NP.n) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let pass = 0; pass < 2; pass++) {
        ctx.font = pass ? '900 15px system-ui, sans-serif' : '800 11px system-ui, sans-serif';
        for (let i = 0; i < NP.n; i++) {
          const p = NL[i];
          if (!p.alive || p.crit !== (pass === 1)) continue;
          ctx.globalAlpha = min(1, p.life * 4);
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(p.s, p.x + 1, p.y + 1);
          ctx.fillStyle = pass ? '#ffd23f' : '#ffffff'; ctx.fillText(p.s, p.x, p.y);
        }
      }
      ctx.globalAlpha = 1;
    }
    // ---- screen space ----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let dawn = 0;
    if (G.mode !== 'title') dawn = clamp((G.t - 555) / 45, 0, 1);
    if (G.ending && G.ending.win) dawn = max(dawn, min(1, 0.5 + G.ending.t / 2));
    ctx.globalAlpha = 1 - dawn * 0.8;
    ctx.drawImage(vignette, 0, 0);
    if (dawn > 0) { ctx.globalAlpha = dawn * 0.22; ctx.fillStyle = '#ff9a6a'; ctx.fillRect(0, 0, cv.width, cv.height); }
    const low = G.mode === 'play' && !P.dead ? clamp(1 - P.hp / (P.maxHp * 0.3), 0, 1) : 0;
    const red = max(G.hurtFlash * 0.8, low * (0.35 + 0.25 * sin(G.time * 6)));
    if (red > 0.01) { ctx.globalAlpha = red; ctx.drawImage(redVig, 0, 0); }
    ctx.globalAlpha = 1;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (G.mode === 'play') drawHUD();
  }

  const iconCache = Object.create(null);
  function hudIcon(id) { return iconCache[id] || (iconCache[id] = NT.Art.iconCanvas(id, 26)); }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fmtTime(t) { t = max(0, t | 0); const m = (t / 60) | 0, s = t % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  NT.fmtTime = fmtTime;
  let hudBottom = 100;
  let timeStr = '', timeSec = -1, killStr = '', killN = -1, lvStr = '', lvN = -1;

  function drawHUD() {
    const top = SAFE.t + 10, left = SAFE.l + 12, right = W - SAFE.r - 12;
    // XP bar
    const bx = left, bw = right - left - 56, bh = 12;
    rr(bx, top, bw, bh, 6); ctx.fillStyle = 'rgba(4,8,22,0.75)'; ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    const f = clamp(G.xp / G.xpNext, 0, 1);
    if (f > 0.01) { rr(bx + 2, top + 2, (bw - 4) * f, bh - 4, 4); ctx.fillStyle = '#5ce1e6'; ctx.fill(); }
    if (lvN !== G.level) { lvN = G.level; lvStr = 'LV ' + G.level; }
    ctx.font = '800 13px system-ui, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(lvStr, bx + 1, top + bh + 13);
    ctx.fillStyle = '#bff8ff'; ctx.fillText(lvStr, bx, top + bh + 12);
    // timer
    const ts = G.t | 0;
    if (ts !== timeSec) { timeSec = ts; timeStr = fmtTime(ts); }
    ctx.textAlign = 'center';
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(timeStr, W / 2 + 1, top + bh + 22);
    ctx.fillStyle = G.t >= 540 ? '#ffcf4a' : '#ffffff'; ctx.fillText(timeStr, W / 2, top + bh + 21);
    // kills
    if (killN !== G.kills) { killN = G.kills; killStr = nstr(G.kills); }
    ctx.textAlign = 'right'; ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(killStr, right - 55, top + bh + 13);
    ctx.fillStyle = '#e9eeff'; ctx.fillText(killStr, right - 56, top + bh + 12);
    const kw = ctx.measureText(killStr).width;
    // little skull
    const sx = right - 56 - kw - 11, sy = top + bh + 12;
    ctx.fillStyle = '#e9eeff'; ctx.beginPath(); ctx.arc(sx, sy - 1, 5, 0, TAU); ctx.fill(); ctx.fillRect(sx - 3, sy + 2, 6, 3);
    ctx.fillStyle = '#0b1026'; ctx.beginPath(); ctx.arc(sx - 2, sy - 1, 1.4, 0, TAU); ctx.arc(sx + 2, sy - 1, 1.4, 0, TAU); ctx.fill();
    // boss bar
    let iy = top + bh + 34;
    const boss = G.boss && G.boss.alive ? G.boss : null;
    if (boss) {
      const bbw = min(320, W * 0.72), bbx = (W - bbw) / 2, bby = top + bh + 40;
      ctx.font = '900 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = boss.def.rim; ctx.fillText(boss.def.name, W / 2, bby);
      rr(bbx, bby + 8, bbw, 10, 5); ctx.fillStyle = 'rgba(4,8,22,0.8)'; ctx.fill();
      ctx.strokeStyle = boss.def.rim; ctx.stroke();
      const bf = clamp(boss.hp / boss.maxHp, 0, 1);
      if (bf > 0) { rr(bbx + 2, bby + 10, (bbw - 4) * bf, 6, 3); ctx.fillStyle = '#ff4a6a'; ctx.fill(); }
      iy = bby + 26;
    }
    // weapon & passive icons
    let x = left;
    for (let i = 0; i < G.weapons.length; i++) {
      const w = G.weapons[i];
      const id = w.evo ? NT.WEAPONS[w.id].evo : w.id;
      rr(x, iy, 28, 28, 7); ctx.fillStyle = w.evo ? 'rgba(80,60,10,0.75)' : 'rgba(4,8,22,0.7)'; ctx.fill();
      ctx.strokeStyle = w.evo ? '#ffcf4a' : 'rgba(140,180,255,0.3)'; ctx.stroke();
      ctx.drawImage(hudIcon(id), x + 1, iy + 1, 26, 26);
      if (!w.evo) for (let l = 0; l < w.level; l++) { ctx.fillStyle = '#5ce1e6'; ctx.fillRect(x + 3 + l * 5, iy + 30, 4, 2.5); }
      x += 32;
    }
    x = left;
    const py = iy + 36;
    for (let i = 0; i < G.passiveOrder.length; i++) {
      const id = G.passiveOrder[i];
      rr(x, py, 22, 22, 6); ctx.fillStyle = 'rgba(4,8,22,0.6)'; ctx.fill();
      ctx.drawImage(hudIcon(id), x + 2, py + 2, 18, 18);
      for (let l = 0; l < G.passives[id]; l++) { ctx.fillStyle = '#ffb347'; ctx.fillRect(x + 1 + l * 4.2, py + 24, 3.4, 2); }
      x += 26;
    }
    // offscreen indicators
    hudBottom = py + (G.passiveOrder.length ? 34 : 4);
    const KL = KP.list;
    let na = 0;
    for (let i = 0; i < KP.n && na < 3; i++) { const k = KL[i]; if (k.alive && k.kind === PICK_CHEST) { edgeArrow(k.x, k.y, '#ffcf4a'); na++; } }
    if (boss) edgeArrow(boss.x, boss.y, '#ff4a6a');
    // banner
    const b = G.banner;
    if (b) {
      const a = b.t < 0.25 ? b.t / 0.25 : b.t > b.dur - 0.4 ? max(0, (b.dur - b.t) / 0.4) : 1;
      const y = H * 0.3, sc = 1 + max(0, 0.25 - b.t) * 1.2;
      ctx.globalAlpha = a; ctx.textAlign = 'center';
      const fs = min(34, (W - 30) / (b.text.length * 0.62));
      ctx.font = '900 ' + (fs * sc).toFixed(1) + 'px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(b.text, W / 2 + 2, y + 2);
      ctx.fillStyle = b.col; ctx.fillText(b.text, W / 2, y);
      if (b.sub) { ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(b.sub, W / 2 + 1, y + fs * 0.9 + 1); ctx.fillStyle = '#e9eeff'; ctx.fillText(b.sub, W / 2, y + fs * 0.9); }
      ctx.globalAlpha = 1;
    }
    // joystick
    if (IN.id !== -1) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(IN.ox, IN.oy, JR, 0, TAU); ctx.fill(); ctx.stroke();
      const dx = IN.cx - IN.ox, dy = IN.cy - IN.oy, d = sqrt(dx * dx + dy * dy), m = min(d, JR);
      const kx = d > 0 ? IN.ox + dx / d * m : IN.ox, ky = d > 0 ? IN.oy + dy / d * m : IN.oy;
      ctx.fillStyle = 'rgba(255,179,71,0.45)'; ctx.strokeStyle = 'rgba(255,220,160,0.7)';
      ctx.beginPath(); ctx.arc(kx, ky, 24, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (DBG.on) {
      ctx.textAlign = 'left'; ctx.font = '700 11px ui-monospace, monospace'; ctx.fillStyle = '#9fffb0';
      ctx.fillText('fps ' + PERF.fps.toFixed(0) + '  upd ' + PERF.upd.toFixed(2) + 'ms  draw ' + PERF.draw.toFixed(2) + 'ms  e ' + EP.n + ' g ' + GP.n + ' fx ' + FX.n, left, H - SAFE.b - 12);
    }
  }
  function edgeArrow(x, y, col) {
    const sx = (x - camX) * SCALE + W / 2, sy = (y - camY) * SCALE + H / 2;
    const m = 26;
    const topY = max(SAFE.t + 60, hudBottom + 14);
    if (sx > m && sx < W - m && sy > topY && sy < H - SAFE.b - m) return;
    const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
    const a = atan2(dy, dx);
    const hx = (W / 2 - m - SAFE.l), hy0 = (H / 2 - SAFE.b - m), hy1 = (H / 2 - topY);
    const tx = abs(dx) > 0.001 ? hx / abs(dx) : 1e9, ty = abs(dy) > 0.001 ? (dy > 0 ? hy0 : hy1) / abs(dy) : 1e9;
    const t = min(tx, ty);
    const ax = cx + dx * t, ay = cy + dy * t;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.globalAlpha = 0.75 + 0.25 * sin(G.time * 8);
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---------------- loop ----------------
  const PERF = { fps: 60, upd: 0, draw: 0, frames: 0, acc: 0, updAcc: 0, drawAcc: 0, hist: [] };
  let lastT = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (!(dt > 0)) dt = 0.001;
    if (dt > 0.1) dt = 0.1;
    const t0 = performance.now();
    if (G.mode === 'play' && !G.modal) {
      const sdt = dt * DBG.speed * G.timeScale;
      const steps = Math.max(1, Math.ceil(sdt / (1 / 45)));
      const h = sdt / steps;
      for (let i = 0; i < steps; i++) { update(h); if (G.modal || G.mode !== 'play') break; }
    } else if (G.mode === 'title') updateTitle(dt);
    const t1 = performance.now();
    render();
    const t2 = performance.now();
    PERF.acc += dt; PERF.frames++; PERF.updAcc += t1 - t0; PERF.drawAcc += t2 - t1;
    if (PERF.acc >= 0.5) {
      PERF.fps = PERF.frames / PERF.acc; PERF.upd = PERF.updAcc / PERF.frames; PERF.draw = PERF.drawAcc / PERF.frames;
      PERF.acc = 0; PERF.frames = 0; PERF.updAcc = 0; PERF.drawAcc = 0;
    }
  }

  function init() {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
    G.char = NT.CHARS.find((c) => c.id === NT.save.char) || NT.CHARS[0];
    requestAnimationFrame((t) => { lastT = t; frame(t); });
  }

  NT.Game = {
    init, start, pause, resume, quit, toTitle, applyChoice, rollChoices, describe,
    reroll() { if (G.rerolls <= 0) return null; G.rerolls--; return rollChoices(3); },
    closeModal() { G.modal = null; resetInput(); lastT = performance.now(); },
    get mode() { return G.mode; },
  };
  if (DEBUG) {
    NT.debug = {
      G, P, PERF, EP, GP, BP,
      spawn(n, type) { for (let i = 0; i < n; i++) { const a = rnd() * TAU, r = 100 + rnd() * spawnR; spawnEnemy(type === undefined ? pickType(400) : type, P.x + cos(a) * r, P.y + sin(a) * r, false); } },
      xp(v) { gainXp(v); },
      setTime(t) { G.t = t; while (G.evI < EVENTS.length && EVENTS[G.evI][0] < t) G.evI++; },
      boss(n) { spawnBoss([T_B1, T_B2, T_B3][(n || 1) - 1]); },
      chest(boss) { dropPick(PICK_CHEST, P.x + 30, P.y, !!boss); },
      kill() { die(); },
      win() { endRun(true, 'dawn'); },
      maxAll(evo) { for (const id of NT.WEAPON_IDS) { const w = getW(id) || addWeapon(id, 1); w.level = 5; w.evo = !!evo; computeStats(w); } for (const id of NT.PASSIVE_IDS.slice(0, 6)) { if (!G.passives[id]) G.passiveOrder.push(id); G.passives[id] = 5; } recalc(); },
      counts() { return { e: EP.n, p: PP.n, b: BP.n, g: GP.n, fx: FX.n }; },
    };
  }
})(window.NT);
