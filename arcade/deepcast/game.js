'use strict';
// DEEP CAST — main game: state, scene rendering, fishing loop, UI.
(() => {
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const hexc = {}; function H3(c) { if (hexc[c]) return hexc[c]; let s = c.replace('#', ''); if (s.length === 3) s = s.split('').map(x => x + x).join(''); const n = parseInt(s, 16); return (hexc[c] = [n >> 16 & 255, n >> 8 & 255, n & 255]); }
  function mixc(a, b, t) { const A = typeof a === 'string' ? H3(a) : a, B = typeof b === 'string' ? H3(b) : b; return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; }
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const fmtKg = w => w < 1 ? w.toFixed(2) : w < 100 ? w.toFixed(1) : Math.round(w).toString();
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // ---------------------------------------------------------------- save
  const Q = new URLSearchParams(location.search);
  const DEBUG = Q.get('debug') === '1';
  const KEY = 'deepcast.v1';
  const DAY_LEN = 360;
  function fresh() {
    return { v: 1, coins: 30, rod: 0, line: 0, boat: 0, cooler: 0, bait: 'worm', baits: { worm: 15 }, loc: 'harbour',
      dex: {}, inv: [], tod: .3, day: 1, weather: 'clear', wTimer: 100, bounties: [], bountyDay: 0, rewards: {}, done: {},
      settings: { sound: true, music: true, haptics: true }, stats: { caught: 0, earned: 0, perfect: 0 }, uid: 1, helped: 0 };
  }
  function loadSave() { try { const raw = localStorage.getItem(KEY); if (!raw) return null; const o = JSON.parse(raw); return o && o.v === 1 ? o : null; } catch (e) { return null; } }
  let S = fresh();
  if (Q.get('reset') === '1') { try { localStorage.removeItem(KEY); } catch (e) { } }
  else { const L = loadSave(); if (L) { const f = fresh(); S = Object.assign(f, L); S.settings = Object.assign(fresh().settings, L.settings || {}); S.stats = Object.assign(fresh().stats, L.stats || {}); } }
  if (!LOC_BY_ID[S.loc]) S.loc = 'harbour';
  let dirty = false, dirtyT = 0;
  function save(now) { if (now) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } dirty = false; } else { dirty = true; dirtyT = .4; } }

  const DBG = { fast: DEBUG && Q.get('fast') !== '0', speed: +(Q.get('speed') || 1) || 1, fish: Q.get('fish'), weather: Q.get('weather') };
  if (DEBUG) S.coins = Math.max(S.coins, +(Q.get('coins') || 50000));
  if (Q.get('tod') != null) S.tod = clamp(+Q.get('tod') || 0, 0, .999);
  if (DBG.weather && WEATHER_INFO[DBG.weather]) S.weather = DBG.weather;

  const rod = () => RODS[S.rod], line = () => LINES[S.line], cooler = () => COOLERS[S.cooler], loc = () => LOC_BY_ID[S.loc];
  const bait = () => BAIT_BY_ID[S.bait] || BAITS[0];
  const unlocked = l => S.boat >= l.boat;
  const vib = p => { try { if (S.settings.haptics && navigator.vibrate) navigator.vibrate(p); } catch (e) { } };

  // ---------------------------------------------------------------- time & weather
  const hour = () => S.tod * 24;
  function timeOk(t) {
    const h = hour();
    switch (t) {
      case 'day': return h >= 6 && h < 19;
      case 'night': return h >= 19.5 || h < 5;
      case 'dawn': return h >= 4.5 && h < 8;
      case 'dusk': return h >= 17 && h < 20.5;
      case 'twilight': return (h >= 4.5 && h < 8) || (h >= 17 && h < 20.5);
      default: return true;
    }
  }
  function weatherOk(w) { const c = S.weather; if (w === 'any') return true; if (w === 'wet') return c === 'rain' || c === 'storm'; return c === w; }
  const TIME_LABEL = { any: 'Any time', day: 'Daytime', night: 'Night', dawn: 'Dawn', dusk: 'Dusk', twilight: 'Dawn & dusk' };
  const WEATHER_LABEL = { any: 'Any weather', clear: 'Clear skies', rain: 'Rain', fog: 'Fog', storm: 'Storms', wet: 'Rain or storm' };
  function lightLevel() { const t = S.tod; if (t < .2 || t >= .85) return 0; if (t < .3) return (t - .2) / .1; if (t < .7) return 1; return 1 - (t - .7) / .15; }
  const isNight = () => { const h = hour(); return h >= 19.5 || h < 5; };
  function rollWeather(announce) {
    if (DBG.weather) return;
    const ws = loc().weather; let tot = 0; for (const k in ws) tot += ws[k];
    let r = Math.random() * tot, nw = 'clear'; for (const k in ws) { r -= ws[k]; if (r <= 0) { nw = k; break; } }
    S.wTimer = rand(70, 140);
    if (nw !== S.weather) { S.weather = nw; if (announce) toast({ clear: 'The skies clear.', rain: 'Rain rolls in…', fog: 'A thick fog settles.', storm: 'A storm is brewing! Rare fish stir.' }[nw]); }
  }

  // ---------------------------------------------------------------- canvas & layout
  const cv = $('scene'), ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, surfY = 0, floorY = 0, boatX = 0, bs = 1, hudBottom = 0, navTop = 0, castMin = 0, castMax = 0;
  const safe = { t: 0, r: 0, b: 0, l: 0 };
  function readSafe() { const cs = getComputedStyle($('safe')); safe.t = parseFloat(cs.paddingTop) || 0; safe.r = parseFloat(cs.paddingRight) || 0; safe.b = parseFloat(cs.paddingBottom) || 0; safe.l = parseFloat(cs.paddingLeft) || 0; }
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    readSafe();
    hudBottom = $('hud').getBoundingClientRect().bottom; navTop = $('nav').getBoundingClientRect().top;
    bs = clamp(Math.min(W / 390, H / 760), .85, 1.45);
    surfY = Math.round(clamp(H * .36, hudBottom + 95, H * .5));
    floorY = navTop - 4;
    boatX = Math.max(safe.l + 62 * bs, W / 2 - Math.min(W * .3, 300));
    castMin = boatX + 75 * bs; castMax = Math.min(W - safe.r - 30, boatX + Math.max(260, Math.min(W * .7, 560)));
    buildStatic();
  }
  const depthY = d => surfY + 22 * bs + d * (floorY - surfY - 84 * bs);
  function waveAmp() { return (2.5 + G.wx.rain * 2 + G.wx.storm * 8) * bs; }
  function waveY(x) { const t = G.t, A = waveAmp(); return surfY + A * (Math.sin(x * .021 + t * 1.25) * .55 + Math.sin(x * .047 - t * 1.8) * .3 + Math.sin(x * .009 + t * .55) * .45); }

  // ---------------------------------------------------------------- game state
  const G = {
    st: 'title', t: 0, power: 0, pdir: 1, rodA: -1, rodBend: 0, castD: 0,
    cast: null, bob: { x: 0, y: 0, dip: 0, vis: false }, hook: { x: 0, y: 0, ty: 0, d: 0 },
    biteT: 0, biteT0: 1, nibbles: [], nibbleT: 0, biteWin: 0, fish: null, fishW: 0, app: null, R: null, land: null, retr: null,
    wx: { rain: 0, fog: 0, storm: 0 }, flash: 0, bolt: null, ltNext: 8, shake: 0,
    parts: [], amb: [], rain: [], gulls: [], stars: [], clouds: [], floor: [], kelp: [], smoke: [],
    pointers: new Set(), keyHeld: false, paused: false, sheet: null, banner: 0,
  };
  const overlayOpen = () => G.sheet || G.st === 'reveal' || G.st === 'title' || G.st === 'travel';

  function buildStatic() {
    G.stars = []; for (let i = 0; i < 90; i++) G.stars.push({ x: Math.random() * W, y: Math.random() * surfY * .85, r: rand(.5, 1.6), p: rand(0, 7) });
    if (!G.clouds.length) for (let i = 0; i < 8; i++) G.clouds.push(newCloud(true));
    G.floor = []; for (let x = -20; x <= W + 40; x += 20) G.floor.push(Math.sin(x * .013) * 10 + Math.sin(x * .041) * 5 + rand(-3, 3));
    G.kelp = []; const n = Math.ceil(W / 46); for (let i = 0; i < n; i++) G.kelp.push({ x: i * 46 + rand(-14, 14), h: rand(.45, .92), ph: rand(0, 7), w: rand(5, 9) });
    G.rain = []; for (let i = 0; i < 260; i++) G.rain.push({ x: Math.random() * W * 1.3, y: Math.random() * H, s: rand(.7, 1.3) });
    G.gulls = []; for (let i = 0; i < 3; i++) G.gulls.push({ x: Math.random() * W, y: rand(.25, .6) * surfY, v: rand(14, 26) * (Math.random() < .5 ? 1 : -1), ph: rand(0, 7), s: rand(.7, 1.1) });
  }
  function newCloud(init) { return { x: init ? Math.random() * (W + 200) - 100 : -160, y: rand(.06, .55), s: rand(.6, 1.4), v: rand(3, 10), puffs: Array.from({ length: 5 }, (_, i) => [i * 18 - 36 + rand(-6, 6), rand(-10, 4), rand(14, 26)]) }; }

  // ---------------------------------------------------------------- fish selection
  function eligible(s, d) { return s.loc === S.loc && timeOk(s.t) && weatherOk(s.w) && d >= s.d[0] - .02 && d <= s.d[1] + .02; }
  function weightFor(s) {
    const b = bait(), wi = WEATHER_INFO[S.weather];
    let bias = wi.rare + (b.locs && !b.locs.includes(s.loc) ? 0 : b.rare);
    if (b.night && isNight()) bias *= 1.6;
    let w = RARITY[s.r].w * (s.r ? 1 + bias * s.r * .9 : 1);
    if (s.r === 4 && b.legend) w *= b.legend;
    if (b.attract && b.attract.includes(s.id)) w *= b.night && isNight() ? 4.5 : 3;
    if (b.beh && b.beh === s.b) w *= 2;
    if (b.locs && b.locs.includes(s.loc)) w *= 1.3;
    return w;
  }
  function pickFish(d) {
    if (DBG.fish && SP_BY_ID[DBG.fish]) return SP_BY_ID[DBG.fish];
    let c = SPECIES.filter(s => eligible(s, d));
    if (!c.length) { // nearest band among time/weather-eligible commons
      const pool = SPECIES.filter(s => s.loc === S.loc && s.r <= 1 && timeOk(s.t) && weatherOk(s.w));
      const pool2 = pool.length ? pool : SPECIES.filter(s => s.loc === S.loc && s.r === 0);
      pool2.sort((a, b) => Math.abs((a.d[0] + a.d[1]) / 2 - d) - Math.abs((b.d[0] + b.d[1]) / 2 - d));
      c = pool2.slice(0, 2);
    }
    let tot = 0; const ws = c.map(s => (tot += weightFor(s), tot));
    const r = Math.random() * tot; return c[ws.findIndex(x => x >= r)] || c[0];
  }
  function rollWeight(s) { const w = s.kg[0] + (s.kg[1] - s.kg[0]) * Math.pow(Math.random(), 1.7); return Math.round(w * (w < 1 ? 1000 : 100)) / (w < 1 ? 1000 : 100); }
  function priceOf(s, w, perfect) { return Math.max(1, Math.round(s.p * Math.pow(w / s.mid, .7) * (perfect ? 1.2 : 1))); }
  const sceneLen = (s, w) => bs * 42 * s.sz * (.85 + .35 * (w - s.kg[0]) / (s.kg[1] - s.kg[0] || 1));

  // ---------------------------------------------------------------- input
  function press() {
    if (overlayOpen() || G.paused) return;
    Sfx.init();
    switch (G.st) {
      case 'idle': G.st = 'charging'; G.power = 0; G.pdir = 1; setHint(); break;
      case 'waiting':
        if (G.nibbleT > 0) { spook(); }
        break;
      case 'bite': hookFish(); break;
      case 'reel': if (G.R) G.R.hold = true; break;
    }
  }
  function release() {
    const held = G.pointers.size > 0 || G.keyHeld;
    if (held) return;
    if (G.st === 'charging') doCast();
    if (G.st === 'reel' && G.R) G.R.hold = false;
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); G.pointers.add(e.pointerId); try { cv.setPointerCapture(e.pointerId); } catch (_) { } press(); });
  const up = e => { if (!G.pointers.has(e.pointerId)) return; G.pointers.delete(e.pointerId); release(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape') { if (G.sheet) closeSheet(); return; }
    if (G.st === 'reveal') { if (rev && rev.t < .8) return; if (e.code === 'Enter' || e.code === 'KeyK' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) revealAction(cooler().cap > S.inv.length ? 'keep' : 'sell'); } else if (e.code === 'KeyS') revealAction('sell'); return; }
    if (G.st === 'title' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); startGame(); return; }
    if (overlayOpen()) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat && !G.keyHeld) { G.keyHeld = true; press(); } return; }
    const nav = { Digit1: 'dex', Digit2: 'cooler', Digit3: 'shop', Digit4: 'map', Digit5: 'bounty' }[e.code];
    if (nav && navEnabled()) openSheet(nav);
    if (e.code === 'KeyR' && (G.st === 'waiting' || G.st === 'sinking')) reelIn();
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') { if (G.keyHeld) { G.keyHeld = false; release(); } } });
  // block page gestures (pull-to-refresh, pinch, double-tap zoom) except in scrollable panels
  document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.scroll,.tabs')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  let lastTouchEnd = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouchEnd < 320 && !(e.target.closest && e.target.closest('button,a,input'))) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => Sfx.init(), { capture: true, passive: true });
  window.addEventListener('blur', () => { G.pointers.clear(); if (G.keyHeld) { G.keyHeld = false; } release(); });

  // ---------------------------------------------------------------- fishing flow
  function rodTip() {
    const p = boatPose(), piv = toWorld(p, 13 * bs, -27 * bs), len = 74 * bs;
    const a = G.rodA + G.rodBend * .55, l = len * (1 - G.rodBend * .1);
    return { piv, x: piv.x + Math.cos(a) * l, y: piv.y + Math.sin(a) * l, a0: G.rodA, len };
  }
  function doCast() {
    const p = Math.max(.06, G.power);
    const tx = lerp(castMin, castMax, p), d = p * line().reach;
    const tip = rodTip();
    G.castD = d;
    G.cast = { x0: tip.x, y0: tip.y, x1: tx, t: 0, dur: .5 + p * .35 };
    G.st = 'casting'; Sfx.whoosh(); vib(10); setHint();
  }
  function setupBite() {
    const s = pickFish(G.hook.d); G.fish = s; G.fishW = rollWeight(s);
    const b = bait(), wi = WEATHER_INFO[S.weather];
    let wait = rand(3.5, 9) * b.bite * wi.bite * (b.night && isNight() ? .8 : 1) * (1 + s.r * .08);
    if (DBG.fast) wait = rand(.9, 1.4);
    G.biteT = G.biteT0 = wait;
    const nn = DBG.fast ? 0 : Math.random() < .25 ? 0 : Math.random() < .6 ? 1 : 2;
    G.nibbles = []; for (let i = 0; i < nn; i++) G.nibbles.push(wait * rand(.15, .55));
    G.nibbles.sort((a, b) => b - a);
    const side = Math.random() < .5 ? -1 : 1, L = sceneLen(s, G.fishW);
    G.app = { side, sx: G.hook.x + side * rand(150, 240) * bs, sy: G.hook.y + rand(-40, 40) * bs, x: 0, y: 0, L, dart: 0 };
    G.app.x = G.app.sx; G.app.y = G.app.sy;
  }
  function spook() {
    toast('Too eager! It swam off…'); vib(20);
    G.nibbles = []; G.nibbleT = 0; G.biteT = G.biteT0 = rand(4, 7) * (DBG.fast ? .2 : 1);
    if (G.app) { G.app.sx = G.hook.x + G.app.side * 260 * bs; G.app.x = G.hook.x + G.app.side * 60 * bs; }
    setTimeout(() => { if (G.st === 'waiting') { setupBite(); setHint(); } }, 300);
  }
  function hookFish() {
    const s = G.fish, leg = s.r === 4, rd = rod();
    const zone = rd.zone * (leg ? .82 : s.r === 3 ? .92 : 1);
    G.R = { zone, pos: .5 - zone / 2, vel: 0, fish: .5, fv: 0, ft: 0, target: .5, k: 10, damp: 5, prog: leg ? .4 : .3, hold: G.pointers.size > 0 || G.keyHeld, perfect: true, t: 0, grace: .7, phase: 0, phT: 3, click: 0, strain: 0, over: false, shake: 0 };
    G.st = 'reel'; Sfx.hook(); vib(30); setHint();
    if (leg) { G.shake = .6; banner('LEGENDARY!', '#ffcc4d'); vib([60, 40, 60, 40, 120]); }
    G.bob.dip = 12;
  }
  function fishAI(R, dt, s) {
    const df = s.df, sp = 1.25 - .55 * df;
    R.ft -= dt;
    if (s.b === 'legend') {
      R.phT -= dt; if (R.phT <= 0) { R.phase = (R.phase + 1) % 3; R.phT = rand(2.4, 3.6); R.ft = 0; }
      if (R.phase === 0) { R.target = .5 + .38 * Math.sin(R.t * (1.2 + df * .7)); R.k = 30; R.damp = 7; }
      else if (R.phase === 1 && R.ft <= 0) { R.target = clamp(R.fish + rand(-.5, .5), .05, .95); R.ft = rand(.4, .75); R.k = 40; R.damp = 7.5; }
      else if (R.phase === 2 && R.ft <= 0) { R.target = R.fish > .5 ? .06 : .94; R.ft = rand(.9, 1.3); R.k = 22; R.damp = 6; }
    } else if (R.ft <= 0) {
      switch (s.b) {
        case 'calm': R.target = rand(.12, .88); R.ft = rand(1.2, 2.4) * sp; R.k = 5 + 9 * df; R.damp = 3.6; break;
        case 'darting': R.target = Math.random() < .5 ? rand(.03, .97) : clamp(R.fish + rand(-.3, .3), .03, .97); R.ft = rand(.45, 1.1) * sp; R.k = 24 + 34 * df; R.damp = 6.5; break;
        case 'sinker': R.target = Math.random() < .72 ? rand(.03, .38) : rand(.5, .95); R.ft = rand(.6, 1.4) * sp; R.k = 12 + 18 * df; R.damp = 5; break;
        case 'erratic': R.target = clamp(R.fish + rand(-.45, .45), .03, .97); R.ft = rand(.15, .55) * sp; R.k = 18 + 22 * df; R.damp = 5; break;
      }
    }
    if (s.b === 'erratic') R.fv += (Math.random() - .5) * df * 30 * dt;
    R.fv += (R.target - R.fish) * R.k * dt - R.fv * R.damp * dt;
    R.fish += R.fv * dt;
    if (R.fish < .03) { R.fish = .03; R.fv = Math.abs(R.fv) * .3; } if (R.fish > .97) { R.fish = .97; R.fv = -Math.abs(R.fv) * .3; }
  }
  function updateReel(dt) {
    const R = G.R, s = G.fish, rd = rod();
    R.t += dt;
    const acc = R.hold ? 2.8 : -2.3;
    R.vel = clamp((R.vel + acc * dt) * (1 - dt * 1.2), -1.3, 1.3);
    R.pos += R.vel * dt;
    if (R.pos < 0) { R.pos = 0; R.vel = R.vel < -.5 ? -R.vel * .35 : 0; }
    if (R.pos > 1 - R.zone) { R.pos = 1 - R.zone; if (R.vel > 0) R.vel = 0; }
    if (R.grace > 0) { R.grace -= dt; R.fish = lerp(R.fish, .5, dt * 2); }
    else fishAI(R, dt, s);
    R.over = R.fish >= R.pos - .02 && R.fish <= R.pos + R.zone + .02;
    const fill = .3 * rd.reel / (1 + .12 * s.r), drain = .21 * (1 + .1 * s.r);
    if (R.grace <= 0) {
      if (R.over) { R.prog += fill * dt; R.click -= dt; if (R.click <= 0) { Sfx.click(); R.click = .075; } }
      else { R.prog -= drain * dt; R.perfect = false; R.strain -= dt; if (R.strain <= 0) { Sfx.strain(); R.strain = .2; vib(8); } }
    }
    R.shake = R.over ? Math.max(0, R.shake - dt * 4) : Math.min(1, R.shake + dt * 4);
    G.rodBend = lerp(G.rodBend, R.over ? .55 : .9, dt * 6);
    // pull hook toward the boat as progress fills
    const p = clamp(R.prog, 0, 1);
    G.hook.y = lerp(G.hook.ty, surfY + 26 * bs, p * .85);
    G.hook.x = lerp(G.hook.x, lerp(G.bob.x0 || G.hook.x, castMin, p * .6), dt * 2);
    if (Math.random() < dt * 3) G.parts.push({ k: 'bub', x: G.hook.x + rand(-10, 10), y: G.hook.y, vx: 0, vy: -30, life: 1.2, max: 1.2, r: rand(1, 2.5) });
    if (R.prog >= 1) landFish();
    else if (R.prog <= 0) { Sfx.snap(); vib([20, 30, 20]); lostFish(G.fish.r >= 3 ? 'The line snapped! What a beast…' : 'It slipped the hook…'); }
  }
  function landFish() {
    const tip = rodTip();
    G.land = { t: 0, x0: G.hook.x, y0: G.hook.y, x1: boatX + 10 * bs, y1: surfY - 60 * bs, tip };
    G.st = 'landing'; G.R.hold = false; Sfx.splash(1.2); splash(G.hook.x, surfY, 1.3); vib(40); setHint();
  }
  function lostFish(msg) {
    if (msg) toast(msg);
    if (G.st === 'reel' || G.st === 'bite') Sfx.lose();
    startRetrieve();
  }
  function startRetrieve() { const tip = rodTip(); G.retr = { t: 0, x0: G.bob.x, y0: G.hook.y, tip }; G.st = 'retrieve'; G.R = null; G.app = null; G.nibbleT = 0; setHint(); }
  function reelIn() { if (G.st === 'waiting' || G.st === 'sinking') { Sfx.ui(); startRetrieve(); } }
  function consumeBait() {
    const b = bait(); if (b.id === 'none') return;
    S.baits[b.id] = (S.baits[b.id] || 0) - 1;
    if (S.baits[b.id] <= 0) { delete S.baits[b.id]; toast(`Out of ${b.name}. Switched to Bare Hook.`); S.bait = 'none'; }
    save(); updateBaitChip();
  }

  function updateFishing(dt) {
    const sheetPause = !!G.sheet;
    switch (G.st) {
      case 'idle': G.rodA = lerp(G.rodA, -1.0, dt * 5); G.rodBend = lerp(G.rodBend, 0, dt * 5); G.bob.vis = false; break;
      case 'charging':
        G.power += G.pdir * dt * .85; if (G.power >= 1) { G.power = 1; G.pdir = -1; } if (G.power <= 0) { G.power = 0; G.pdir = 1; }
        G.rodA = lerp(G.rodA, -1.15 - G.power * 1.05, dt * 12); break;
      case 'casting': {
        const c = G.cast; c.t += dt; const k = Math.min(1, c.t / c.dur);
        G.rodA = lerp(G.rodA, -.45, dt * 14);
        const tip = rodTip(); c.x0 = tip.x; c.y0 = tip.y;
        const y1 = waveY(c.x1);
        G.bob.x = lerp(c.x0, c.x1, k); G.bob.y = lerp(c.y0, y1, k) - Math.sin(k * Math.PI) * (60 + (c.x1 - c.x0) * .25) * bs; G.bob.vis = true;
        if (k >= 1) {
          splash(c.x1, y1, .7); Sfx.splash(.6); G.bob.x0 = c.x1;
          G.hook = { x: c.x1, y: y1, ty: depthY(G.castD), d: G.castD };
          G.st = 'sinking'; setHint();
        }
        break;
      }
      case 'sinking':
        G.rodA = lerp(G.rodA, -.8, dt * 4);
        G.hook.y = Math.min(G.hook.ty, G.hook.y + dt * 170 * bs);
        if (G.hook.y >= G.hook.ty) { G.st = 'waiting'; setupBite(); setHint(); }
        break;
      case 'waiting': {
        G.rodA = lerp(G.rodA, -.8, dt * 4);
        if (G.nibbleT > 0) { G.nibbleT -= dt; if (G.nibbleT <= 0) setHint(); }
        if (sheetPause) break;
        G.biteT -= dt;
        if (G.nibbles.length && G.biteT <= G.nibbles[0]) {
          G.nibbles.shift(); G.nibbleT = .42; G.bob.dip = 5; Sfx.nibble(); vib(12); ripple(G.bob.x, G.bob.y, .5); setHint();
          if (G.app) G.app.dart = 1;
        }
        const a = G.app;
        if (a) {
          const k = easeOut(clamp(1 - G.biteT / G.biteT0, 0, 1));
          const ex = G.hook.x + a.side * a.L * .5, ey = G.hook.y;
          a.x = lerp(a.sx, ex, k) - a.side * a.dart * a.L * .3; a.y = lerp(a.sy, ey, k) + Math.sin(G.t * 2) * 3;
          a.dart = Math.max(0, a.dart - dt * 3);
        }
        if (G.biteT <= 0) {
          G.st = 'bite'; G.biteWin = .85 + rod().win - (G.fish.r === 4 ? .1 : 0); G.bob.dip = 13;
          Sfx.bite(); vib([40, 30, 90]); splash(G.bob.x, waveY(G.bob.x), .5); consumeBait(); setHint();
          if (a) { a.x = G.hook.x + a.side * a.L * .35; }
        }
        break;
      }
      case 'bite':
        G.biteWin -= dt; G.rodA = lerp(G.rodA, -.6, dt * 10);
        if (G.biteWin <= 0) lostFish(G.fish.r >= 3 ? 'Too slow — something big got away…' : 'Too slow! It got away.');
        break;
      case 'reel': updateReel(dt); G.rodA = lerp(G.rodA, -1.25, dt * 5); break;
      case 'landing': {
        const L = G.land; L.t += dt; const k = Math.min(1, L.t / .75);
        G.rodA = lerp(G.rodA, -1.5, dt * 8); G.rodBend = lerp(G.rodBend, .2, dt * 6);
        if (k >= 1) { G.land = null; showReveal(); }
        break;
      }
      case 'retrieve': {
        const r = G.retr; r.t += dt; const k = Math.min(1, r.t / .55);
        G.rodBend = lerp(G.rodBend, 0, dt * 6); G.rodA = lerp(G.rodA, -1, dt * 5);
        if (k >= 1) { G.retr = null; G.st = 'idle'; G.bob.vis = false; setHint(); }
        break;
      }
    }
    G.bob.dip = Math.max(0, G.bob.dip - dt * (G.st === 'bite' || G.st === 'reel' ? 3 : 18));
  }

  // ---------------------------------------------------------------- catch, reveal, dex
  let rev = null;
  function showReveal() {
    const s = G.fish, w = G.fishW, perfect = G.R && G.R.perfect;
    const rec = S.dex[s.id] || (S.dex[s.id] = { n: 0, best: 0 });
    const isNew = rec.n === 0, isRecord = !isNew && w > rec.best;
    rec.n++; rec.best = Math.max(rec.best, w);
    S.stats.caught++; if (perfect) S.stats.perfect++;
    const price = priceOf(s, w, perfect);
    progressBounties(s, w);
    checkComplete(s.loc);
    save();
    rev = { s, w, price, perfect, isNew, isRecord, t: 0, roll: 0, rolled: false, uid: S.uid++ };
    G.st = 'reveal'; G.R = null; G.app = null; G.bob.vis = false; setHint();
    const r = RARITY[s.r];
    $('revRarity').textContent = r.name; $('revRarity').style.background = r.col;
    $('revName').textContent = s.name;
    $('revCard').style.setProperty('--rc', r.col);
    $('revWeight').textContent = '0.00';
    $('revPrice').textContent = fmt(price);
    $('revPerfect').classList.toggle('hidden', !perfect);
    $('revNew').classList.toggle('show', false); $('revRecord').classList.toggle('show', false);
    const full = S.inv.length >= cooler().cap;
    $('revKeep').textContent = full ? 'Release' : 'Keep';
    $('revKeep').dataset.act = full ? 'release' : 'keep';
    $('revFull').classList.toggle('hidden', !full);
    $('revSell').innerHTML = `Sell <span class="coin-i">${ICON.coin}</span>${fmt(price)}`;
    const dc = SPECIES.filter(x => S.dex[x.id]).length;
    $('revDex').textContent = `Fishdex ${dc}/${SPECIES.length}` + (rec.n > 1 ? ` · caught ${rec.n}×` : '');
    $('reveal').classList.remove('hidden'); $('reveal').classList.add('in');
    $('revCard').classList.remove('pop'); void $('revCard').offsetWidth; $('revCard').classList.add('pop');
    Sfx.jingle(s.r); vib(s.r >= 3 ? [50, 40, 50, 40, 140] : 40);
    if (s.r >= 2) for (let i = 0; i < 24 + s.r * 10; i++) G.parts.push({ k: 'spark', x: W / 2, y: H * .42, vx: rand(-260, 260), vy: rand(-320, 60), life: rand(.8, 1.6), max: 1.6, r: rand(1.5, 3.5), c: r.col });
    if (isNew) setTimeout(() => { if (rev && rev.uid === S.uid - 1) { $('revNew').classList.add('show'); Sfx.coin(); } }, 350);
    sizeRevCanvas();
  }
  function sizeRevCanvas() {
    const c = $('revCanvas'), r = c.getBoundingClientRect();
    c.width = Math.round(r.width * DPR); c.height = Math.round(r.height * DPR);
  }
  function drawReveal(dt) {
    if (!rev) return;
    rev.t += dt;
    const c = $('revCanvas'), x = c.getContext('2d'), w = c.width / DPR, h = c.height / DPR;
    x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, w, h);
    // rays
    const r = RARITY[rev.s.r];
    x.save(); x.translate(w / 2, h / 2); x.rotate(rev.t * .3); x.fillStyle = r.col; x.globalAlpha = .2 + rev.s.r * .04;
    for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(0, 0); x.lineTo(w, -w * .12); x.lineTo(w, w * .12); x.fill(); }
    x.restore();
    x.save(); x.globalCompositeOperation = 'destination-in';
    const mg = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * .55); mg.addColorStop(0, '#000'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = mg; x.fillRect(0, 0, w, h); x.restore();
    const k = easeOut(Math.min(1, rev.t / .9));
    const L = FishArt.fitLen(rev.s, w * .92, h * .9);
    const spin = (1 - k) * Math.PI * 4;
    FishArt.drawFish(x, rev.s, w / 2 - (rev.s.a.x && rev.s.a.x.includes('bill') ? L * .12 : 0), h / 2 + Math.sin(rev.t * 2) * 3, L * (.3 + .7 * k), { t: rev.t, wig: .7, sx: Math.cos(spin) || .01, rot: Math.sin(rev.t * 1.6) * .04 });
    // weight roll-up
    if (!rev.rolled) {
      const rk = clamp((rev.t - .35) / .9, 0, 1), v = rev.w * easeOut(rk);
      $('revWeight').textContent = fmtKg(v);
      if (rk > 0 && rk < 1 && Math.floor(rev.t * 20) !== rev.roll) { rev.roll = Math.floor(rev.t * 20); Sfx.tick(); }
      if (rk >= 1) { rev.rolled = true; if (rev.isRecord) { $('revRecord').classList.add('show'); Sfx.fanfare(); vib([30, 30, 30]); } }
    }
  }
  function revealAction(act) {
    if (!rev) return;
    const { s, w, price } = rev;
    if (act === 'keep' && S.inv.length < cooler().cap) { S.inv.push({ id: s.id, w, p: price, fav: false, u: rev.uid }); toast(`${s.name} into the cooler (${S.inv.length}/${cooler().cap})`); Sfx.ui(); }
    else if (act === 'sell' || act === 'keep') { addCoins(price); toast(`Sold ${s.name} for ${fmt(price)}`); }
    else { toast(`You let the ${s.name} go. It flicks its tail gratefully.`); Sfx.splash(.5); }
    rev = null;
    $('reveal').classList.add('hidden'); $('reveal').classList.remove('in');
    G.st = 'idle'; setHint(); save(); updateHud(true);
    if (!S.helped) { S.helped = 1; setTimeout(() => toast('Tip: open the Fishdex to see where and when each fish bites.'), 900); }
  }
  function addCoins(n) { S.coins += n; S.stats.earned += n; Sfx.coin(); $('c-coins').classList.remove('bump'); void $('c-coins').offsetWidth; $('c-coins').classList.add('bump'); updateHud(true); }
  function checkComplete(lid) {
    const all = SPECIES.filter(s => s.loc === lid);
    if (all.every(s => S.dex[s.id]) && !S.done[lid]) { S.done[lid] = 1; setTimeout(() => { banner(LOC_BY_ID[lid].name + ' complete!', '#ffcc4d'); toast('Claim your completion reward in the Fishdex!'); Sfx.fanfare(); }, 1600); }
  }

  // ---------------------------------------------------------------- bounties
  function genBounty(existing) {
    const locs = LOCS.filter(unlocked), reach = line().reach;
    for (let tries = 0; tries < 30; tries++) {
      const L = Math.random() < .55 ? loc() : pick(locs);
      const pool = SPECIES.filter(s => s.loc === L.id && s.r <= 2 && s.d[0] < reach - .03);
      if (!pool.length) continue;
      const roll = Math.random(); let b;
      const sp = pick(pool.filter(s => s.r < 2).concat(pool));
      if (roll < .4) {
        const n = sp.r === 0 ? 2 + Math.floor(Math.random() * 3) : sp.r === 1 ? 1 + Math.floor(Math.random() * 2) : 1;
        b = { type: 'sp', sp: sp.id, n, reward: Math.round(sp.p * n * 2.2 + 15 + L.boat * 40) };
      } else if (roll < .65) {
        const kg = +(sp.kg[0] + (sp.kg[1] - sp.kg[0]) * rand(.35, .55)).toFixed(sp.kg[1] < 2 ? 2 : 1);
        b = { type: 'kg', sp: sp.id, kg, n: 1, reward: Math.round(sp.p * 4 + 25 + L.boat * 50) };
      } else if (roll < .88) {
        const n = 4 + Math.floor(Math.random() * 5), avg = pool.reduce((a, s) => a + s.p, 0) / pool.length;
        b = { type: 'loc', loc: L.id, n, reward: Math.round(avg * n * .9 + 20) };
      } else {
        const r = pool.some(s => s.r === 2) && Math.random() < .5 ? 2 : 1, n = r === 2 ? 1 : 2;
        const avg = pool.filter(s => s.r >= r).reduce((a, s) => a + s.p, 0) / Math.max(1, pool.filter(s => s.r >= r).length);
        b = { type: 'rar', r, loc: L.id, n, reward: Math.round(avg * n * 2 + 40) };
      }
      const key = b.type + (b.sp || b.loc) + (b.r || '');
      if (existing.some(e => e.type + (e.sp || e.loc) + (e.r || '') === key)) continue;
      return Object.assign(b, { have: 0, claimed: false, id: Math.random().toString(36).slice(2, 8) });
    }
    return { type: 'loc', loc: S.loc, n: 5, reward: 60, have: 0, claimed: false, id: 'x' + Date.now() };
  }
  function refreshBounties(force) {
    if (!force && S.bountyDay === S.day && S.bounties.length === 3) return;
    const keep = S.bounties.filter(b => b.have >= b.n && !b.claimed);
    const list = keep.slice(0, 3);
    while (list.length < 3) list.push(genBounty(list));
    S.bounties = list; S.bountyDay = S.day; save();
  }
  function bountyText(b) {
    const sp = b.sp && SP_BY_ID[b.sp], L = b.loc && LOC_BY_ID[b.loc];
    if (b.type === 'sp') return `Catch ${b.n} ${sp.name}`;
    if (b.type === 'kg') return `Land a ${sp.name} over ${b.kg} kg`;
    if (b.type === 'loc') return `Catch ${b.n} fish in the ${L.name}`;
    return `Catch ${b.n} ${RARITY[b.r].name}-or-better fish in the ${L.name}`;
  }
  function progressBounties(s, w) {
    let done = false;
    for (const b of S.bounties) {
      if (b.have >= b.n) continue;
      let hit = false;
      if (b.type === 'sp') hit = b.sp === s.id;
      else if (b.type === 'kg') hit = b.sp === s.id && w >= b.kg;
      else if (b.type === 'loc') hit = s.loc === b.loc;
      else hit = s.loc === b.loc && s.r >= b.r;
      if (hit) { b.have++; if (b.have >= b.n) done = true; }
    }
    if (done) setTimeout(() => toast('Bounty complete! Claim it on the board.'), 1200);
    updateBadges();
  }

  // ---------------------------------------------------------------- particles
  function splash(x, y, s = 1) {
    for (let i = 0; i < 14 * s; i++) G.parts.push({ k: 'drop', x: x + rand(-6, 6), y, vx: rand(-70, 70) * s, vy: rand(-190, -70) * s, life: 1, max: 1, r: rand(1.2, 2.8) });
    ripple(x, y, s);
  }
  function ripple(x, y, s = 1) { G.parts.push({ k: 'ring', x, y, life: 1.1, max: 1.1, r: 4, s }); }
  function updateParts(dt) {
    const P = G.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.life -= dt;
      if (p.k === 'drop') { p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vy > 0 && p.y > waveY(p.x)) p.life = 0; }
      else if (p.k === 'bub') { p.x += Math.sin(p.life * 9) * 12 * dt; p.y += p.vy * dt; if (p.y < waveY(p.x)) p.life = 0; }
      else if (p.k === 'spark') { p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .99; }
      else if (p.k === 'ember') { p.y += p.vy * dt; p.x += Math.sin(G.t * 2 + p.r * 9) * 8 * dt; if (p.y < waveY(p.x) + 4) p.life = 0; }
      if (p.life <= 0) P.splice(i, 1);
    }
    if (P.length > 400) P.splice(0, P.length - 400);
  }

  // ---------------------------------------------------------------- ambient fish
  function spawnAmbient(init) {
    const l = loc();
    let pool = SPECIES.filter(s => s.loc === l.id && s.r < 4 && timeOk(s.t));
    const leg = SPECIES.find(s => s.loc === l.id && s.r === 4);
    let s;
    if (leg && timeOk(leg.t) && weatherOk(leg.w) && Math.random() < .12) s = leg;
    else { let tot = 0; const ws = pool.map(p => (tot += RARITY[p.r].w + 8, tot)); const r = Math.random() * tot; s = pool[ws.findIndex(x => x >= r)] || pool[0]; }
    if (!s) return null;
    const dir = Math.random() < .5 ? 1 : -1, w = s.kg[0] + (s.kg[1] - s.kg[0]) * Math.random() * .7;
    const d = rand(s.d[0], s.d[1]);
    return { s, dir, x: init ? rand(0, W) : (dir > 0 ? -80 : W + 80), y: depthY(d), d, L: sceneLen(s, w), v: rand(10, 26) * bs * (s.b === 'darting' ? 1.6 : 1), ph: rand(0, 7), leg: s.r === 4 };
  }
  function updateAmbient(dt) {
    const target = W > 700 ? 11 : 7;
    while (G.amb.length < target) { const a = spawnAmbient(G.t < 1 || G.ambInit); if (!a) break; G.amb.push(a); }
    G.ambInit = false;
    for (let i = G.amb.length - 1; i >= 0; i--) {
      const a = G.amb[i]; a.x += a.dir * a.v * dt; a.ph += dt;
      a.y = depthY(a.d) + Math.sin(a.ph * .7) * 6;
      if ((a.dir > 0 && a.x > W + 120) || (a.dir < 0 && a.x < -120)) G.amb.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- scene rendering
  const SKY = [[0, '#0a0f2c', '#1b2350'], [.2, '#101a42', '#2e3364'], [.245, '#465f9e', '#e8987e'], [.29, '#69a8dc', '#ffd2aa'], [.35, '#5cb0ec', '#cdeeff'],
    [.68, '#5cb0ec', '#cdeeff'], [.73, '#5a78c0', '#ffb488'], [.78, '#3c3c7c', '#ff8a6a'], [.83, '#161b4a', '#4a3060'], [.88, '#0a0f2c', '#1b2350'], [1, '#0a0f2c', '#1b2350']];
  function skyCols() {
    const t = S.tod; let i = 0; while (i < SKY.length - 2 && SKY[i + 1][0] <= t) i++;
    const a = SKY[i], b = SKY[i + 1], k = (t - a[0]) / (b[0] - a[0] || 1);
    let top = mixc(a[1], b[1], k), bot = mixc(a[2], b[2], k);
    const lt = lightLevel(), oc = Math.min(.85, G.wx.rain * .55 + G.wx.fog * .45 + G.wx.storm * .85);
    const grey = mixc('#1a1e28', '#8a939e', lt);
    top = mixc(top, mixc(grey, '#3a4048', G.wx.storm * .5), oc); bot = mixc(bot, grey, oc * .9);
    if (S.loc === 'vent') { top = mixc(top, '#5a2a24', .35); bot = mixc(bot, '#c8603a', .3 * (.3 + lt)); }
    return { top, bot, lt };
  }
  function boatPose() { const y = waveY(boatX) + 3 * bs, sl = (waveY(boatX + 24) - waveY(boatX - 24)) / 48; return { x: boatX, y, a: Math.atan(sl) * .85 }; }
  function toWorld(p, lx, ly) { const c = Math.cos(p.a), s = Math.sin(p.a); return { x: p.x + lx * c - ly * s, y: p.y + lx * s + ly * c }; }

  function render() {
    const sc = skyCols(), lt = sc.lt;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    let shx = 0, shy = 0; if (G.shake > 0) { shx = rand(-4, 4) * G.shake; shy = rand(-3, 3) * G.shake; }
    ctx.translate(shx, shy);
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, surfY); g.addColorStop(0, rgb(sc.top)); g.addColorStop(1, rgb(sc.bot));
    ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, surfY + 20);
    // stars
    const starA = (1 - lt) * (1 - Math.min(1, G.wx.fog + G.wx.storm + G.wx.rain * .6));
    if (starA > .02) { ctx.fillStyle = '#fff'; for (const s of G.stars) { ctx.globalAlpha = starA * (.5 + .5 * Math.sin(G.t * 1.5 + s.p)); ctx.fillRect(s.x, s.y, s.r, s.r); } ctx.globalAlpha = 1; }
    drawSunMoon(lt);
    drawClouds(sc, lt);
    drawHorizon(sc, lt);
    drawGulls(lt);
    drawWater(sc, lt);
    drawBoat(lt);
    drawLine();
    drawParticles();
    drawWeather(lt);
    drawOverlayUI();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (G.flash > 0) { ctx.fillStyle = `rgba(230,240,255,${G.flash * .55})`; ctx.fillRect(0, 0, W, H); }
  }
  function drawSunMoon(lt) {
    const t = S.tod, arcH = Math.max(40, surfY - hudBottom - 30);
    const sunK = (t - .22) / .58;
    if (sunK > 0 && sunK < 1) {
      const x = W * (.08 + .84 * sunK), y = surfY - Math.sin(sunK * Math.PI) * arcH + 10;
      const cl = 1 - Math.min(.92, G.wx.fog * .8 + G.wx.storm + G.wx.rain * .75);
      const warm = 1 - Math.sin(sunK * Math.PI);
      const col = mixc('#fff6d0', '#ff9a50', warm);
      const gg = ctx.createRadialGradient(x, y, 0, x, y, 70 * bs); gg.addColorStop(0, rgb(col, .55 * cl)); gg.addColorStop(1, rgb(col, 0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 70 * bs, 0, 7); ctx.fill();
      ctx.fillStyle = rgb(col, cl); ctx.beginPath(); ctx.arc(x, y, 17 * bs, 0, 7); ctx.fill();
    }
    const mk = (((t + .5) % 1) - .22) / .58;
    if (mk > 0 && mk < 1) {
      const x = W * (.1 + .8 * mk), y = surfY - Math.sin(mk * Math.PI) * arcH * .9 + 14;
      const cl = (1 - lt * .8) * (1 - Math.min(.9, G.wx.fog * .7 + G.wx.storm + G.wx.rain * .4));
      const gg = ctx.createRadialGradient(x, y, 0, x, y, 50 * bs); gg.addColorStop(0, `rgba(220,230,255,${.3 * cl})`); gg.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 50 * bs, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(240,240,225,${cl})`; ctx.beginPath(); ctx.arc(x, y, 12 * bs, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(200,205,215,${cl * .5})`; ctx.beginPath(); ctx.arc(x - 3 * bs, y - 2 * bs, 3 * bs, 0, 7); ctx.arc(x + 4 * bs, y + 3 * bs, 2 * bs, 0, 7); ctx.fill();
    }
  }
  function drawClouds(sc, lt) {
    const oc = Math.min(1, G.wx.rain * .6 + G.wx.storm + G.wx.fog * .4);
    const base = mixc(mixc('#ffffff', rgbArr(sc.bot), .25), '#3a3f4a', oc * .6 + (1 - lt) * .55);
    for (const c of G.clouds) {
      const y = c.y * surfY * .9, s = c.s * bs;
      ctx.fillStyle = rgb(base, .75 + oc * .2);
      ctx.beginPath(); for (const p of c.puffs) { ctx.moveTo(c.x + p[0] * s + p[2] * s, y + p[1] * s); ctx.arc(c.x + p[0] * s, y + p[1] * s, p[2] * s, 0, 7); } ctx.fill();
    }
  }
  const rgbArr = a => a;
  function drawHorizon(sc, lt) {
    const col = mixc(sc.bot, '#1c2634', .55 + (1 - lt) * .25), y0 = surfY + 2;
    const fogK = 1 - G.wx.fog * .6;
    ctx.save(); ctx.globalAlpha = fogK;
    ctx.fillStyle = rgb(col);
    const lit = lt < .5, win = 'rgba(255,210,120,.9)';
    switch (S.loc) {
      case 'harbour': {
        const x0 = W * .52;
        // hill & lighthouse
        ctx.beginPath(); ctx.moveTo(x0 - 30, y0); ctx.quadraticCurveTo(W * .82, y0 - 70 * bs, W + 20, y0 - 40 * bs); ctx.lineTo(W + 20, y0); ctx.fill();
        const lx = W * .86, ly = y0 - 52 * bs;
        ctx.fillStyle = rgb(mixc(col, '#f0ece0', .35)); ctx.fillRect(lx - 5 * bs, ly - 40 * bs, 10 * bs, 40 * bs);
        ctx.fillStyle = rgb(mixc(col, '#b04030', .4)); ctx.fillRect(lx - 5 * bs, ly - 28 * bs, 10 * bs, 6 * bs); ctx.fillRect(lx - 5 * bs, ly - 14 * bs, 10 * bs, 6 * bs);
        ctx.fillStyle = rgb(col); ctx.fillRect(lx - 7 * bs, ly - 48 * bs, 14 * bs, 8 * bs);
        if (lit) {
          ctx.fillStyle = 'rgba(255,230,150,1)'; ctx.fillRect(lx - 4 * bs, ly - 46 * bs, 8 * bs, 5 * bs);
          const a = G.t * .9, bx = lx, by = ly - 44 * bs;
          ctx.save(); ctx.globalAlpha = (.5 - lt) * .5 * fogK; ctx.fillStyle = '#ffe9a8';
          for (const s of [1, -1]) { const ang = a + (s < 0 ? Math.PI : 0); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang) * W, by + Math.sin(ang) * 30 - 12); ctx.lineTo(bx + Math.cos(ang) * W, by + Math.sin(ang) * 30 + 12); ctx.fill(); }
          ctx.restore();
        }
        // houses
        ctx.fillStyle = rgb(mixc(col, '#000', .1));
        let x = x0;
        for (let i = 0; x < W * .8; i++) {
          const hw = (16 + (i * 7) % 11) * bs, hh = (14 + (i * 13) % 17) * bs;
          ctx.fillStyle = rgb(mixc(col, i % 2 ? '#3a2a2a' : '#203040', .15));
          ctx.fillRect(x, y0 - hh, hw, hh);
          ctx.beginPath(); ctx.moveTo(x - 2, y0 - hh); ctx.lineTo(x + hw / 2, y0 - hh - 8 * bs); ctx.lineTo(x + hw + 2, y0 - hh); ctx.fill();
          if (lit && (i * 3) % 4 !== 0) { ctx.fillStyle = win; ctx.fillRect(x + hw * .3, y0 - hh * .7, 3 * bs, 3 * bs); }
          x += hw + 3 * bs;
        }
        break;
      }
      case 'kelp': {
        const isl = (cx, w, h) => {
          ctx.beginPath(); ctx.moveTo(cx - w, y0); ctx.quadraticCurveTo(cx - w * .4, y0 - h, cx, y0 - h * .9); ctx.quadraticCurveTo(cx + w * .5, y0 - h * 1.1, cx + w, y0); ctx.fill();
          for (let k = -2; k <= 2; k++) { const tx = cx + k * w * .25, ty = y0 - h * .85 - Math.abs(k) * -h * .1; ctx.beginPath(); ctx.moveTo(tx - 5 * bs, ty + 6 * bs); ctx.lineTo(tx, ty - 14 * bs); ctx.lineTo(tx + 5 * bs, ty + 6 * bs); ctx.fill(); }
        };
        ctx.fillStyle = rgb(mixc(col, '#1a3a2a', .3)); isl(W * .7, 70 * bs, 34 * bs); isl(W * .2, 40 * bs, 20 * bs);
        break;
      }
      case 'open': {
        const sx = ((G.t * 4) % (W + 200)) - 100;
        ctx.fillRect(sx, y0 - 8 * bs, 46 * bs, 6 * bs); ctx.fillRect(sx + 8 * bs, y0 - 15 * bs, 14 * bs, 7 * bs); ctx.fillRect(sx + 26 * bs, y0 - 13 * bs, 4 * bs, 6 * bs);
        if (lit) { ctx.fillStyle = win; ctx.fillRect(sx + 10 * bs, y0 - 13 * bs, 2, 2); ctx.fillRect(sx + 15 * bs, y0 - 13 * bs, 2, 2); }
        break;
      }
      case 'trench': {
        ctx.beginPath(); ctx.moveTo(W * .55, y0); ctx.lineTo(W * .6, y0 - 40 * bs); ctx.lineTo(W * .64, y0 - 30 * bs); ctx.lineTo(W * .68, y0 - 62 * bs); ctx.lineTo(W * .73, y0 - 22 * bs); ctx.lineTo(W * .8, y0); ctx.fill();
        ctx.beginPath(); ctx.moveTo(W * .02, y0); ctx.lineTo(W * .06, y0 - 26 * bs); ctx.lineTo(W * .1, y0 - 18 * bs); ctx.lineTo(W * .13, y0); ctx.fill();
        const bx = W * .9; ctx.fillRect(bx - 2, y0 - 16 * bs, 4, 16 * bs);
        if (Math.sin(G.t * 3) > .3) { const gg = ctx.createRadialGradient(bx, y0 - 17 * bs, 0, bx, y0 - 17 * bs, 10 * bs); gg.addColorStop(0, 'rgba(255,80,60,1)'); gg.addColorStop(1, 'rgba(255,80,60,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(bx, y0 - 17 * bs, 10 * bs, 0, 7); ctx.fill(); }
        break;
      }
      case 'vent': {
        const vx = W * .74, vt = y0 - 92 * bs;
        ctx.fillStyle = rgb(mixc(col, '#2a1410', .4));
        ctx.beginPath(); ctx.moveTo(vx - 130 * bs, y0); ctx.lineTo(vx - 18 * bs, vt); ctx.lineTo(vx + 18 * bs, vt); ctx.lineTo(vx + 140 * bs, y0); ctx.fill();
        const gl = ctx.createRadialGradient(vx, vt, 0, vx, vt, 40 * bs); gl.addColorStop(0, 'rgba(255,140,60,.9)'); gl.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(vx, vt, 40 * bs, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,110,40,.7)'; ctx.lineWidth = 2 * bs; ctx.beginPath(); ctx.moveTo(vx - 6 * bs, vt + 2); ctx.lineTo(vx - 20 * bs, vt + 30 * bs); ctx.lineTo(vx - 34 * bs, vt + 50 * bs); ctx.stroke();
        // smoke
        for (let i = 0; i < 7; i++) {
          const k = ((G.t * .06 + i / 7) % 1), sx = vx + Math.sin(k * 5 + i) * 18 * bs + k * 60 * bs, sy = vt - k * surfY * .8;
          ctx.fillStyle = `rgba(80,70,72,${.32 * (1 - k)})`; ctx.beginPath(); ctx.arc(sx, sy, (12 + k * 40) * bs, 0, 7); ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  }
  function drawGulls(lt) {
    if (lt < .35 || G.wx.storm > .4) return;
    ctx.strokeStyle = `rgba(40,45,55,${Math.min(1, (lt - .35) * 3) * .8})`; ctx.lineWidth = 1.6 * bs; ctx.lineCap = 'round';
    for (const g of G.gulls) {
      const f = Math.sin(G.t * 6 + g.ph) * 5 * g.s * bs, s = 9 * g.s * bs;
      ctx.beginPath(); ctx.moveTo(g.x - s, g.y - f); ctx.quadraticCurveTo(g.x - s * .4, g.y - s * .5 - f * .3, g.x, g.y); ctx.quadraticCurveTo(g.x + s * .4, g.y - s * .5 - f * .3, g.x + s, g.y - f); ctx.stroke();
    }
  }
  function waterCols(lt) {
    const l = loc();
    let top = mixc(l.water[0], '#0b1c33', (1 - lt) * .82), deep = mixc(l.water[1], '#010308', (1 - lt) * .55);
    const grey = G.wx.fog * .35 + G.wx.storm * .3 + G.wx.rain * .15;
    top = mixc(top, mixc('#4a5560', '#141a22', 1 - lt), grey);
    return { top, deep };
  }
  function drawWater(sc, lt) {
    const wc = waterCols(lt), l = loc();
    // body
    const g = ctx.createLinearGradient(0, surfY - 10, 0, floorY + 20);
    g.addColorStop(0, rgb(wc.top)); g.addColorStop(.35, rgb(mixc(wc.top, wc.deep, .5))); g.addColorStop(1, rgb(wc.deep));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-10, H + 10); for (let x = -10; x <= W + 12; x += 8) ctx.lineTo(x, waveY(x)); ctx.lineTo(W + 12, H + 10); ctx.closePath(); ctx.fill();
    // god rays
    const rayA = lt * (1 - G.wx.fog * .6 - G.wx.storm * .8 - G.wx.rain * .4) * (S.loc === 'trench' ? .6 : 1);
    if (rayA > .03) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const x = (i / 6) * W + Math.sin(G.t * .25 + i * 1.7) * 30, w = (26 + (i % 3) * 18) * bs;
        const rg = ctx.createLinearGradient(0, surfY, 0, surfY + (floorY - surfY) * .75);
        rg.addColorStop(0, `rgba(200,240,255,${.07 * rayA})`); rg.addColorStop(1, 'rgba(200,240,255,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x, surfY); ctx.lineTo(x + w, surfY); ctx.lineTo(x + w * 2.2 - 60, floorY); ctx.lineTo(x + w * .6 - 60, floorY); ctx.fill();
      }
      ctx.restore();
    }
    drawSeabed(lt, wc);
    drawDepthRuler(lt);
    // ambient fish
    const silC = rgb(mixc(wc.deep, '#000', .35), 1);
    for (const a of G.amb) {
      const dk = (a.y - surfY) / (floorY - surfY);
      const alpha = (.28 + .3 * lt) * (1 - dk * .35) * (1 - G.wx.fog * .3) * (a.leg ? 1.2 : 1);
      FishArt.drawFish(ctx, a.s, a.x, a.y, a.L, { flip: a.dir < 0, sil: silC, t: a.ph, wig: .6, alpha: clamp(alpha, .12, .7), glowSil: S.loc === 'trench' || S.loc === 'vent' || lt < .4 });
    }
    // approaching / hooked fish
    if (G.app && (G.st === 'waiting' || G.st === 'bite')) {
      const a = G.app, face = (G.hook.x - a.x) < 0;
      FishArt.drawFish(ctx, G.fish, a.x, a.y, a.L, { flip: face, sil: silC, t: G.t * (G.st === 'bite' ? 2.5 : 1), wig: G.st === 'bite' ? 1.4 : .7, alpha: .78, glowSil: true });
    }
    if (G.st === 'reel' && G.R) {
      const R = G.R, L = sceneLen(G.fish, G.fishW), th = Math.sin(G.t * (10 + R.shake * 10)) * (6 + R.shake * 8);
      const fx = G.hook.x + L * .4 + th, fy = G.hook.y + (R.fish - .5) * 24 * bs;
      FishArt.drawFish(ctx, G.fish, fx, fy, L, { flip: true, sil: silC, t: G.t * 2.5, wig: 1.5, alpha: .85, rot: Math.sin(G.t * 7) * .25, glowSil: true });
    }
    // depth darkness
    const dg = ctx.createLinearGradient(0, surfY, 0, H);
    const deepDark = { harbour: .25, kelp: .35, open: .5, trench: .78, vent: .45 }[S.loc];
    dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, `rgba(0,0,6,${deepDark * (.6 + .4 * (1 - lt))})`);
    ctx.fillStyle = dg; ctx.fillRect(0, surfY, W, H - surfY);
    // vent glow from below
    if (S.loc === 'vent') { const vg = ctx.createLinearGradient(0, floorY - 120 * bs, 0, H); vg.addColorStop(0, 'rgba(255,90,30,0)'); vg.addColorStop(1, `rgba(255,90,30,${.18 + .06 * Math.sin(G.t * 1.3)})`); ctx.fillStyle = vg; ctx.fillRect(0, floorY - 120 * bs, W, H); }
    // surface line + sparkle
    ctx.strokeStyle = rgb(mixc(sc.bot, '#ffffff', .35 * lt), .55 + .2 * lt); ctx.lineWidth = 1.6;
    ctx.beginPath(); for (let x = -10; x <= W + 12; x += 8) { const y = waveY(x); x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    // sun/moon glitter on the water
    const sunK = (S.tod - .22) / .58, mk = (((S.tod + .5) % 1) - .22) / .58;
    const gx = sunK > 0 && sunK < 1 ? W * (.08 + .84 * sunK) : (mk > 0 && mk < 1 ? W * (.1 + .8 * mk) : -1);
    if (gx > 0 && G.wx.storm < .6) {
      ctx.fillStyle = lt > .3 ? 'rgba(255,245,210,.55)' : 'rgba(220,230,255,.35)';
      for (let i = 0; i < 9; i++) { const yy = surfY + 4 + i * 5 * bs, ww = (18 - i * 1.4) * bs * (1 + Math.sin(G.t * 3 + i) * .3); ctx.fillRect(gx - ww / 2 + Math.sin(G.t * 2 + i * 2) * 6, yy, ww, 1.5); }
    }
  }
  function drawSeabed(lt, wc) {
    const l = S.loc;
    if (l === 'kelp') {
      for (const k of G.kelp) {
        const top = surfY + (floorY - surfY) * (1 - k.h) + 20 * bs;
        ctx.strokeStyle = rgb(mixc('#3a7a3a', '#0a1a14', .3 + (1 - lt) * .55)); ctx.lineWidth = k.w * .5 * bs; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(k.x, floorY + 10);
        const segs = 8; let px = k.x, py = floorY + 10;
        for (let i = 1; i <= segs; i++) { const f = i / segs, y = lerp(floorY + 10, top, f), x = k.x + Math.sin(G.t * .9 + k.ph + f * 2.5) * 14 * f * bs; ctx.lineTo(x, y); px = x; py = y; }
        ctx.stroke();
        ctx.fillStyle = rgb(mixc('#5aa04a', '#0a1a14', .3 + (1 - lt) * .55));
        for (let i = 1; i < segs; i++) {
          const f = i / segs, y = lerp(floorY + 10, top, f), x = k.x + Math.sin(G.t * .9 + k.ph + f * 2.5) * 14 * f * bs, s = i % 2 ? 1 : -1;
          ctx.beginPath(); ctx.ellipse(x + s * 7 * bs, y, 8 * bs, 3 * bs, s * .6 + Math.sin(G.t + i) * .2, 0, 7); ctx.fill();
        }
        if (k.h > .8) { ctx.beginPath(); ctx.arc(px, py, 3 * bs, 0, 7); ctx.fillStyle = rgb(mixc('#c8b04a', '#1a1a10', (1 - lt) * .6)); ctx.fill(); }
      }
    }
    if (l === 'harbour' || l === 'kelp' || l === 'vent') {
      const sand = l === 'harbour' ? '#b8a27a' : l === 'kelp' ? '#7a6a5a' : '#2a201e';
      ctx.fillStyle = rgb(mixc(mixc(sand, rgbArr(wc.deep), .45), '#000', (1 - lt) * .5));
      ctx.beginPath(); ctx.moveTo(-20, H + 10);
      G.floor.forEach((h, i) => ctx.lineTo(-20 + i * 20, floorY + h * bs));
      ctx.lineTo(W + 40, H + 10); ctx.closePath(); ctx.fill();
    }
    if (l === 'harbour') {
      // pier pilings on the right
      const px0 = Math.min(W - 30, castMax + 20);
      ctx.fillStyle = rgb(mixc('#4a3a2a', '#000', .3 + (1 - lt) * .4), .9);
      for (let i = 0; i < 3; i++) { const x = px0 + i * 34 * bs; if (x > W + 10) break; ctx.fillRect(x, surfY - 26 * bs, 7 * bs, floorY - surfY + 30 * bs); }
      ctx.fillRect(px0 - 10 * bs, surfY - 30 * bs, W, 6 * bs);
      // anchor
      const ax = W * .42, ay = floorY - 4;
      ctx.strokeStyle = rgb(mixc('#4a5058', '#000', (1 - lt) * .5)); ctx.lineWidth = 3 * bs;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 6 * bs, ay - 26 * bs); ctx.moveTo(ax - 10 * bs, ay - 6 * bs); ctx.quadraticCurveTo(ax, ay + 4 * bs, ax + 12 * bs, ay - 2 * bs); ctx.stroke();
    }
    if (l === 'vent') {
      const chim = [W * .22, W * .55, W * .86];
      chim.forEach((x, i) => {
        const h = (40 + i * 14) * bs, y = floorY + 6;
        ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.moveTo(x - 16 * bs, y); ctx.lineTo(x - 5 * bs, y - h); ctx.lineTo(x + 5 * bs, y - h); ctx.lineTo(x + 16 * bs, y); ctx.fill();
        const gl = ctx.createRadialGradient(x, y - h, 0, x, y - h, 26 * bs); gl.addColorStop(0, 'rgba(255,150,60,.8)'); gl.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y - h, 26 * bs, 0, 7); ctx.fill();
        if (Math.random() < .12) G.parts.push({ k: 'ember', x: x + rand(-3, 3), y: y - h, vy: rand(-40, -20) * bs, life: 6, max: 6, r: rand(1, 2.4) });
      });
    }
    if (l === 'trench' || l === 'open') {
      // marine snow
      ctx.fillStyle = l === 'trench' ? 'rgba(190,230,255,.35)' : 'rgba(220,240,255,.18)';
      for (let i = 0; i < 40; i++) { const x = (i * 97.3 + G.t * 4) % W, y = surfY + 30 + ((i * 53.7 + G.t * (6 + i % 5)) % (H - surfY)); ctx.fillRect(x, y, 1.4, 1.4); }
      if (l === 'trench') for (let i = 0; i < 14; i++) { const a = Math.sin(G.t * .8 + i * 2.1); if (a > .6) { const x = (i * 173.1) % W, y = depthY(.35 + (i % 4) * .17); ctx.fillStyle = `rgba(120,255,230,${(a - .6) * 1.6})`; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); } }
    }
  }
  function drawDepthRuler(lt) {
    const l = loc(), x = safe.l + 8, reach = line().reach;
    ctx.save(); ctx.font = `600 ${10 * Math.min(bs, 1.2)}px system-ui, sans-serif`; ctx.textBaseline = 'middle';
    const active = G.st === 'charging';
    const a = active ? .85 : .35;
    for (let i = 0; i <= 4; i++) {
      const d = i / 4, y = depthY(d);
      ctx.fillStyle = `rgba(220,240,255,${a * (d <= reach + .001 ? 1 : .45)})`;
      ctx.fillRect(x, y, 6, 1.5);
      if (i > 0) ctx.fillText(Math.round(d * l.depth) + 'm', x + 9, y);
    }
    // line limit
    const ly = depthY(reach);
    if (reach < 1) { ctx.strokeStyle = `rgba(255,200,120,${active ? .7 : .25})`; ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(active ? W - safe.r - 8 : x + 40, ly); ctx.stroke(); ctx.setLineDash([]); if (active) { ctx.fillStyle = 'rgba(255,200,120,.85)'; ctx.fillText('line limit', x + 46, ly - 8); } }
    ctx.restore();
  }
  function drawBoat(lt) {
    const p = boatPose(), tier = S.boat, B = BOATS[tier], s = bs;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    const hw = (tier >= 2 ? 66 : 56) * s;
    const dk = (c, k) => rgb(mixc(c, '#05070c', k + (1 - lt) * .45));
    // cabin / superstructure behind
    if (tier === 2 || tier === 4) {
      ctx.fillStyle = dk(tier === 4 ? '#5a5e66' : '#e8e2d4', 0); ctx.fillRect(-hw * .82, -40 * s, 30 * s, 30 * s);
      ctx.fillStyle = lt < .5 ? 'rgba(255,214,130,.95)' : dk('#8ab8d8', 0); ctx.fillRect(-hw * .76, -34 * s, 9 * s, 8 * s); ctx.fillRect(-hw * .76 + 12 * s, -34 * s, 9 * s, 8 * s);
      ctx.fillStyle = dk(B.trim, .1); ctx.fillRect(-hw * .86, -44 * s, 38 * s, 5 * s);
      ctx.strokeStyle = dk('#333', 0); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-hw * .7, -44 * s); ctx.lineTo(-hw * .7, -66 * s); ctx.stroke();
      if (lt < .6) { ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(-hw * .7, -67 * s, 2 * s, 0, 7); ctx.fill(); }
    }
    if (tier === 3) {
      ctx.strokeStyle = dk('#2b2f38', 0); ctx.lineWidth = 3.5 * s; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-hw * .9, -10 * s); ctx.lineTo(-hw * .72, -58 * s); ctx.lineTo(-hw * .45, -10 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-hw * .72, -58 * s); ctx.lineTo(-hw * 1.05, -40 * s); ctx.stroke();
      ctx.fillStyle = dk('#e0b02a', .1); ctx.beginPath(); ctx.arc(-hw * .62, -16 * s, 7 * s, 0, 7); ctx.fill();
    }
    if (tier === 1 || tier === 2) { // outboard
      ctx.fillStyle = dk('#2a2e36', 0); ctx.fillRect(-hw - 8 * s, -16 * s, 10 * s, 14 * s); ctx.fillRect(-hw - 5 * s, -2 * s, 4 * s, 14 * s);
    }
    // lantern
    if (lt < .65) {
      const lx = -hw * .45, ly = -30 * s;
      ctx.strokeStyle = dk('#3a3026', 0); ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(lx, -8 * s); ctx.lineTo(lx, ly); ctx.stroke();
      const gl = ctx.createRadialGradient(lx, ly, 0, lx, ly, 70 * s); gl.addColorStop(0, `rgba(255,200,110,${.5 * (1 - lt)})`); gl.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, ly, 70 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd890'; ctx.fillRect(lx - 3 * s, ly - 4 * s, 6 * s, 7 * s);
    }
    // fisher (sitting)
    const fx = 6 * s;
    ctx.fillStyle = dk('#e8b43a', .05); // raincoat
    ctx.beginPath(); ctx.moveTo(fx - 9 * s, -8 * s); ctx.quadraticCurveTo(fx - 10 * s, -30 * s, fx, -32 * s); ctx.quadraticCurveTo(fx + 10 * s, -30 * s, fx + 9 * s, -8 * s); ctx.fill();
    ctx.fillStyle = dk('#f2d2b0', .05); ctx.beginPath(); ctx.arc(fx + 1 * s, -38 * s, 6.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = dk('#d8a030', .05); ctx.beginPath(); ctx.ellipse(fx + 1 * s, -42 * s, 11 * s, 3 * s, -.08, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(fx + 1 * s, -43 * s, 6 * s, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(fx + 3 * s, -39 * s, 1.6 * s, 1.6 * s);
    // hull
    ctx.beginPath(); ctx.moveTo(-hw, -12 * s); ctx.quadraticCurveTo(-hw * .92, 9 * s, -hw * .45, 11 * s); ctx.lineTo(hw * .5, 11 * s); ctx.quadraticCurveTo(hw * .95, 8 * s, hw * 1.08, -15 * s); ctx.closePath();
    ctx.fillStyle = dk(B.hull, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = dk(B.trim, 0); ctx.beginPath(); ctx.moveTo(-hw, -12 * s); ctx.lineTo(hw * 1.08, -15 * s); ctx.lineTo(hw * 1.04, -10 * s); ctx.lineTo(-hw * .98, -7 * s); ctx.fill();
    if (tier === 0) { ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.moveTo(-hw * .9, -1 * s); ctx.lineTo(hw * .95, -3 * s); ctx.moveTo(-hw * .7, 6 * s); ctx.lineTo(hw * .7, 5 * s); ctx.stroke(); }
    if (tier === 4) { ctx.fillStyle = 'rgba(255,122,42,.8)'; for (let i = 0; i < 6; i++) ctx.fillRect(-hw * .8 + i * hw * .3, -2 * s, 4 * s, 4 * s); }
    if (tier >= 1) { ctx.fillStyle = dk(B.trim, .1); ctx.font = `700 ${6 * s}px system-ui`; }
    ctx.restore();
    // waterline wash
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(p.x - hw * .8, waveY(p.x) + 6 * s, hw * 1.7, 1.5);
  }
  function drawLine() {
    const tip = rodTip(), lt = lightLevel();
    // rod
    const a = G.rodA, ctrl = { x: tip.piv.x + Math.cos(a) * tip.len * .55, y: tip.piv.y + Math.sin(a) * tip.len * .55 };
    ctx.strokeStyle = rgb(mixc(rod().col, '#05070c', (1 - lt) * .45)); ctx.lineWidth = 2.6 * bs; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tip.piv.x - Math.cos(a) * 10 * bs, tip.piv.y - Math.sin(a) * 10 * bs); ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y); ctx.stroke();
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(tip.piv.x + Math.cos(a) * 3 * bs, tip.piv.y + Math.sin(a) * 3 * bs, 3 * bs, 0, 7); ctx.fill(); // reel
    // arm
    const p = boatPose(), sh = toWorld(p, 8 * bs, -26 * bs);
    ctx.strokeStyle = rgb(mixc('#d8a030', '#05070c', (1 - lt) * .45)); ctx.lineWidth = 4 * bs; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tip.piv.x, tip.piv.y); ctx.stroke();
    // fishing line
    const lineCol = lt > .4 ? 'rgba(255,255,255,.75)' : 'rgba(220,230,255,.6)';
    ctx.strokeStyle = lineCol; ctx.lineWidth = 1;
    let bx = G.bob.x, by = G.bob.y;
    if (G.st === 'casting') {
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + bx) / 2, Math.min(tip.y, by) - 20, bx, by); ctx.stroke();
      drawBobber(bx, by, 0); return;
    }
    if (G.st === 'landing' && G.land) {
      const L = G.land, k = Math.min(1, L.t / .75), fx = lerp(L.x0, L.x1, k), fy = lerp(L.y0, L.y1, easeOut(k)) - Math.sin(k * Math.PI) * 60 * bs;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(fx, fy); ctx.stroke();
      FishArt.drawFish(ctx, G.fish, fx, fy + sceneLen(G.fish, G.fishW) * .3, sceneLen(G.fish, G.fishW) * 1.1, { rot: Math.PI / 2 + Math.sin(G.t * 20) * .3, t: G.t * 3, wig: 1.5 });
      return;
    }
    if (G.st === 'retrieve' && G.retr) {
      const r = G.retr, k = easeOut(Math.min(1, r.t / .55)); bx = lerp(r.x0, tip.x, k); by = lerp(waveY(r.x0), tip.y, k) - Math.sin(k * Math.PI) * 20;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(bx, by); ctx.stroke(); drawBobber(bx, by, 0); return;
    }
    if (!['sinking', 'waiting', 'bite', 'reel'].includes(G.st)) return;
    bx = G.st === 'reel' ? G.hook.x : G.bob.x0; by = waveY(bx) + G.bob.dip * bs;
    G.bob.x = bx; G.bob.y = by;
    const taut = G.st === 'reel' || G.st === 'bite';
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
    if (taut) ctx.lineTo(bx, by); else ctx.quadraticCurveTo((tip.x + bx) / 2, Math.max(tip.y, by) + 14 * bs, bx, by);
    ctx.stroke();
    // underwater line
    ctx.strokeStyle = 'rgba(230,240,255,.35)'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(G.hook.x, G.hook.y); ctx.stroke();
    // hook + bait
    ctx.strokeStyle = 'rgba(200,205,215,.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(G.hook.x - 2.5, G.hook.y + 2, 3, 0, Math.PI); ctx.stroke();
    if (G.st !== 'reel') { ctx.fillStyle = bait().col; ctx.beginPath(); ctx.arc(G.hook.x, G.hook.y + 4, 2.4 * bs, 0, 7); ctx.fill(); if (bait().id === 'glow') { const gg = ctx.createRadialGradient(G.hook.x, G.hook.y + 4, 0, G.hook.x, G.hook.y + 4, 18); gg.addColorStop(0, 'rgba(120,255,220,.5)'); gg.addColorStop(1, 'rgba(120,255,220,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(G.hook.x, G.hook.y + 4, 18, 0, 7); ctx.fill(); } }
    if (G.st !== 'reel') drawBobber(bx, by, G.bob.dip);
    // bite alert
    if (G.st === 'bite') {
      const k = 1 + Math.sin(G.t * 30) * .08, y = by - 44 * bs;
      ctx.save(); ctx.translate(bx, y); ctx.scale(k, k);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d23a2a'; ctx.lineWidth = 3;
      roundRect(ctx, -16 * bs, -20 * bs, 32 * bs, 36 * bs, 9 * bs); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5 * bs, 16 * bs); ctx.lineTo(0, 24 * bs); ctx.lineTo(5 * bs, 16 * bs); ctx.fill();
      ctx.fillStyle = '#d23a2a'; ctx.font = `900 ${28 * bs}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, -1 * bs);
      ctx.restore();
    }
  }
  function drawBobber(x, y, dip) {
    const r = 5 * bs;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#e0412f'; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, -r - 6 * bs); ctx.stroke();
    ctx.restore();
    if (dip > 6 && G.st !== 'casting') ripple(x, waveY(x), .3 * Math.random());
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function drawParticles() {
    for (const p of G.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.k === 'drop') { ctx.fillStyle = `rgba(230,245,255,${.85 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      else if (p.k === 'ring') { const r = p.r + (1 - a) * 28 * (p.s || 1) * bs; ctx.strokeStyle = `rgba(240,250,255,${.6 * a})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(p.x, waveY(p.x) + 1, r, r * .28, 0, 0, 7); ctx.stroke(); }
      else if (p.k === 'bub') { ctx.strokeStyle = `rgba(220,240,255,${.6 * a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); }
      else if (p.k === 'ember') { ctx.fillStyle = `rgba(255,150,70,${.7 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
  }
  function drawSparks() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const p of G.parts) if (p.k === 'spark') { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.c; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 6); ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  function drawWeather(lt) {
    const n = Math.floor(G.wx.rain * 120 + G.wx.storm * 140);
    if (n > 0) {
      const slant = -.18 - G.wx.storm * .3;
      ctx.strokeStyle = `rgba(200,215,235,${.32 + .15 * lt})`; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n && i < G.rain.length; i++) { const d = G.rain[i], len = 14 * d.s * bs; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + slant * len, d.y + len); }
      ctx.stroke();
    }
    if (G.wx.fog > .02) {
      const f = G.wx.fog;
      const col = lt > .4 ? '215,222,228' : '70,80,98';
      const fg = ctx.createLinearGradient(0, surfY * .2, 0, surfY + 120 * bs);
      fg.addColorStop(0, `rgba(${col},0)`); fg.addColorStop(.6, `rgba(${col},${.55 * f})`); fg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = fg; ctx.fillRect(0, 0, W, surfY + 120 * bs);
      for (let i = 0; i < 3; i++) { const x = ((G.t * (8 + i * 4) + i * 300) % (W + 400)) - 200; ctx.fillStyle = `rgba(${col},${.18 * f})`; ctx.beginPath(); ctx.ellipse(x, surfY - 10 + i * 18, 220 * bs, 18 * bs, 0, 0, 7); ctx.fill(); }
    }
    if (G.bolt && G.bolt.t > 0) {
      ctx.strokeStyle = `rgba(240,245,255,${G.bolt.t * 4})`; ctx.lineWidth = 2.2; ctx.beginPath();
      G.bolt.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    }
  }

  // ---- canvas UI: power meter, reel minigame ----
  function reelGeom() {
    const lo = hudBottom + 36, hi = navTop - 130; // keep clear of HUD and the hint pill
    const h = clamp((hi - lo) * .92, 180, 420);
    const x = Math.min(W - safe.r - 64, W / 2 + 200);
    const y = Math.max(lo, (lo + hi) / 2 - h / 2);
    return { x, y, w: 46, h };
  }
  function drawOverlayUI() {
    if (G.st === 'charging') {
      const x0 = castMin - 10 * bs, x1 = castMax, y = surfY - 50 * bs, p = G.power;
      ctx.fillStyle = 'rgba(10,20,35,.55)'; roundRect(ctx, x0 - 6, y - 8, x1 - x0 + 12, 16, 8); ctx.fill();
      const gr = ctx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#7ee08f'); gr.addColorStop(.6, '#ffd24d'); gr.addColorStop(1, '#ff6a4a');
      ctx.fillStyle = gr; roundRect(ctx, x0, y - 4, Math.max(8, (x1 - x0) * p), 8, 4); ctx.fill();
      const tx = lerp(castMin, castMax, Math.max(.06, p)), d = Math.max(.06, p) * line().reach, dy = depthY(d);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tx, waveY(tx)); ctx.lineTo(tx, dy); ctx.moveTo(safe.l + 8, dy); ctx.lineTo(tx, dy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx, dy, 4, 0, 7); ctx.fill();
      ctx.font = `800 ${13 * Math.min(bs, 1.2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3;
      const lbl = `${Math.round(d * loc().depth)} m`;
      const lx = clamp(tx, x0 + 30, x1 - 30);
      ctx.strokeText(lbl, lx, y - 10); ctx.fillText(lbl, lx, y - 10); ctx.textAlign = 'left';
    }
    if (G.st === 'reel' && G.R) drawReelUI();
  }
  function drawReelUI() {
    const R = G.R, g = reelGeom(), s = G.fish;
    const sx = R.shake * rand(-1.5, 1.5);
    ctx.save(); ctx.translate(sx, 0);
    // frame
    ctx.fillStyle = 'rgba(16,24,38,.82)'; roundRect(ctx, g.x - 24, g.y - 10, g.w + 34, g.h + 20, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,200,.5)'; ctx.lineWidth = 2; ctx.stroke();
    // bar water
    const bg = ctx.createLinearGradient(0, g.y, 0, g.y + g.h); bg.addColorStop(0, '#3a8fb0'); bg.addColorStop(1, '#0d2a40');
    ctx.fillStyle = bg; roundRect(ctx, g.x, g.y, g.w, g.h, 8); ctx.fill();
    const inner = g.h - 12, vy = v => g.y + g.h - 6 - v * inner;
    // zone
    const zy1 = vy(R.pos + R.zone), zy0 = vy(R.pos);
    ctx.fillStyle = R.over ? 'rgba(126,224,143,.75)' : 'rgba(126,224,143,.4)';
    roundRect(ctx, g.x + 3, zy1, g.w - 6, zy0 - zy1, 7); ctx.fill();
    ctx.strokeStyle = R.over ? '#c8ffd2' : 'rgba(200,255,210,.6)'; ctx.lineWidth = 2; ctx.stroke();
    // fish icon
    const fy = vy(R.fish), rc = RARITY[s.r].col;
    ctx.save(); ctx.shadowColor = rc; ctx.shadowBlur = 10 + s.r * 3;
    FishArt.drawFish(ctx, s, g.x + g.w / 2, fy, 34, { sil: s.r >= 3 ? '#1a1030' : '#0c1a28', t: G.t * 3, wig: 1.2, flip: R.fv > 0 ? false : true, rot: clamp(-R.fv * .5, -.7, .7), aura: false });
    ctx.restore();
    ctx.fillStyle = rc; ctx.beginPath(); ctx.arc(g.x + g.w / 2, fy, 2.2, 0, 7); ctx.fill();
    // progress bar
    const px = g.x - 17, ph = g.h, pr = clamp(R.prog, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, px, g.y, 10, ph, 5); ctx.fill();
    const pc = mixc('#ff6a4a', '#7ee08f', pr);
    ctx.fillStyle = rgb(pc); roundRect(ctx, px, g.y + ph * (1 - pr), 10, ph * pr, 5); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- world update
  function updateWorld(dt) {
    S.tod += dt / DAY_LEN * DBG.speed;
    if (S.tod >= 1) { S.tod -= 1; S.day++; refreshBounties(); toast(`Day ${S.day} — the bounty board has new requests.`); updateBadges(); }
    S.wTimer -= dt * DBG.speed; if (S.wTimer <= 0) rollWeather(true);
    const tgt = { rain: S.weather === 'rain' ? 1 : 0, fog: S.weather === 'fog' ? 1 : 0, storm: S.weather === 'storm' ? 1 : 0 };
    for (const k in tgt) G.wx[k] = lerp(G.wx[k], tgt[k], Math.min(1, dt * .35));
    G.sfxT = (G.sfxT || 0) - dt; if (G.sfxT <= 0) { G.sfxT = .5; Sfx.weather(G.wx.rain, G.wx.storm); Sfx.setNight(isNight()); }
    // rain
    const slant = -.18 - G.wx.storm * .3;
    const nDrops = Math.floor(G.wx.rain * 120 + G.wx.storm * 140);
    for (let i = 0; i < nDrops && i < G.rain.length; i++) { const d = G.rain[i]; d.y += 640 * d.s * dt; d.x += slant * 640 * d.s * dt; if (d.y > waveY(d.x)) { if (Math.random() < .05) ripple(d.x, d.y, .15); d.y = -20; d.x = Math.random() * W * 1.3; } if (d.x < -20) d.x += W * 1.3; }
    // lightning
    if (G.wx.storm > .5) {
      G.ltNext -= dt;
      if (G.ltNext <= 0) {
        G.ltNext = rand(5, 13); G.flash = 1; const x = rand(W * .1, W * .9); const pts = [[x, 0]]; let y = 0, xx = x;
        while (y < surfY) { y += rand(12, 28); xx += rand(-18, 18); pts.push([xx, Math.min(y, surfY)]); }
        G.bolt = { t: .25, pts }; Sfx.thunder(rand(.2, 1.2)); vib(15);
      }
    }
    G.flash = Math.max(0, G.flash - dt * 3); if (G.bolt) G.bolt.t -= dt;
    // clouds & gulls
    for (const c of G.clouds) { c.x += c.v * dt * (1 + G.wx.storm * 2); if (c.x > W + 160) Object.assign(c, newCloud(false)); }
    for (const g of G.gulls) { g.x += g.v * dt; g.y += Math.sin(G.t * .5 + g.ph) * 4 * dt; if (g.x > W + 40) g.x = -40; if (g.x < -40) g.x = W + 40; }
    G.shake = Math.max(0, G.shake - dt * 1.5);
  }

  // ---------------------------------------------------------------- DOM UI
  const ICON = {
    coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffcc4d" stroke="#b8860b" stroke-width="2"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" stroke="#b8860b" stroke-width="1.6" fill="none"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="#ffd24d"/><g stroke="#ffd24d" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="#e8ecff"/></svg>',
    dawn: '<svg viewBox="0 0 24 24"><path d="M5 17a7 7 0 0114 0z" fill="#ffa86a"/><path d="M2 20h20" stroke="#ffa86a" stroke-width="2" stroke-linecap="round"/><g stroke="#ffa86a" stroke-width="2" stroke-linecap="round"><path d="M12 5v3M4.5 9l2 1.5M19.5 9l-2 1.5"/></g></svg>',
    clear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#fff1b8"/><g stroke="#fff1b8" stroke-width="1.8" stroke-linecap="round"><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/></g></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 15a4 4 0 01.5-8 5.5 5.5 0 0110.4 1.6A3.3 3.3 0 0117.5 15z" fill="#c8d4e4"/><g stroke="#7fb8ff" stroke-width="2" stroke-linecap="round"><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></g></svg>',
    fog: '<svg viewBox="0 0 24 24"><g stroke="#d8dee6" stroke-width="2.4" stroke-linecap="round"><path d="M3 8h14M6 12h15M3 16h13M7 20h10"/></g></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 14a4 4 0 01.5-8 5.5 5.5 0 0110.4 1.6A3.3 3.3 0 0117.5 14z" fill="#8a96a8"/><path d="M12.5 13l-3 5h3l-1.5 4.5 5-6.5h-3l1.5-3z" fill="#ffd24d"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21a2 2 0 012-2h13v2"/><path d="M9 9c1.5-1.5 4-1.5 5.5 0-1.5 1.5-4 1.5-5.5 0zM14.5 9l1.5-1v2z" fill="currentColor"/></svg>',
    cooler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 12h18M9 8V5h6v3"/></svg>',
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 016 0"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    bounty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/></svg>',
    bait: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v9a4 4 0 11-4 4"/><circle cx="12" cy="2.5" r="1"/></svg>',
  };
  function initDom() {
    $('i-coin').innerHTML = ICON.coin; $('btnSettings').innerHTML = ICON.gear;
    document.querySelectorAll('#nav button').forEach(b => { b.querySelector('i').innerHTML = ICON[b.dataset.icon]; b.addEventListener('click', () => { if (navEnabled()) { Sfx.init(); Sfx.ui(); openSheet(b.dataset.sheet); } }); });
    $('btnSettings').addEventListener('click', () => { Sfx.init(); Sfx.ui(); openSheet('settings'); });
    $('sheetClose').addEventListener('click', () => { Sfx.ui(); closeSheet(); });
    $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });
    $('btnReelIn').addEventListener('click', () => reelIn());
    $('baitChip').addEventListener('click', () => { if (navEnabled()) { Sfx.init(); Sfx.ui(); G.shopTab = 'bait'; openSheet('shop'); } });
    $('baitChip').querySelector('i').innerHTML = ICON.bait;
    $('revKeep').addEventListener('click', () => revealAction($('revKeep').dataset.act));
    $('revSell').addEventListener('click', () => revealAction('sell'));
    $('btnStart').addEventListener('click', startGame);
    document.querySelectorAll('.coin-i').forEach(e => e.innerHTML = ICON.coin);
    updateTitleInfo();
  }
  const navEnabled = () => ['idle', 'waiting', 'sinking', 'title'].includes(G.st) && G.st !== 'title';
  let hudT = 0, lastHint = '';
  function updateHud(force) {
    hudT -= 1; if (!force && hudT > 0) return; hudT = 12;
    $('coins').textContent = fmt(S.coins);
    const h = Math.floor(hour()), m = Math.floor((hour() - h) * 60 / 10) * 10;
    $('clock').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    const tIcon = isNight() ? 'moon' : (timeOk('dawn') || timeOk('dusk')) ? 'dawn' : 'sun';
    if ($('timeIcon').dataset.k !== tIcon) { $('timeIcon').innerHTML = ICON[tIcon]; $('timeIcon').dataset.k = tIcon; }
    if ($('wIcon').dataset.k !== S.weather) { $('wIcon').innerHTML = ICON[S.weather]; $('wIcon').dataset.k = S.weather; $('wName').textContent = WEATHER_INFO[S.weather].name; }
    $('locname').textContent = loc().name; $('dayn').textContent = S.day;
    $('coolerBadge').textContent = `${S.inv.length}/${cooler().cap}`;
    $('coolerBadge').classList.toggle('full', S.inv.length >= cooler().cap);
    const ne = navEnabled(); $('nav').classList.toggle('dim', !ne); $('baitChip').classList.toggle('dim', !ne);
    $('btnReelIn').classList.toggle('hidden', !(G.st === 'waiting' || G.st === 'sinking'));
    const lt = lightLevel(), phase = lt > .45 ? 'day' : 'night';
    if (document.body.dataset.phase !== phase) { document.body.dataset.phase = phase; $('themeColor').setAttribute('content', phase === 'day' ? '#2f7fa6' : '#0d1530'); }
  }
  function updateBaitChip() { const b = bait(); $('baitName').textContent = b.name + (b.id === 'none' ? '' : ' ×' + (S.baits[b.id] || 0)); $('baitChip').style.setProperty('--bc', b.col); }
  function updateBadges() { const n = S.bounties.filter(b => b.have >= b.n && !b.claimed).length + LOCS.filter(l => S.done[l.id] && !S.rewards[l.id]).length; const el = $('bountyBadge'); el.textContent = n; el.classList.toggle('hidden', n === 0); }
  function setHint() {
    let t = '';
    switch (G.st) {
      case 'idle': t = S.stats.caught < 2 ? 'Hold anywhere · release to cast' : 'Hold & release to cast'; break;
      case 'charging': t = 'Release to cast!'; break;
      case 'casting': case 'sinking': t = 'Sinking…'; break;
      case 'waiting': t = G.nibbleT > 0 ? 'A nibble… not yet!' : 'Wait for the bite…'; break;
      case 'bite': t = 'TAP NOW!'; break;
      case 'reel': t = S.stats.caught < 3 ? 'Hold to lift the green bar · release to drop' : 'Keep the fish in the green!'; break;
    }
    if (t !== lastHint) { lastHint = t; const el = $('hint'); el.textContent = t; el.classList.toggle('hot', G.st === 'bite'); el.classList.toggle('hidden', !t); }
    updateHud(true);
  }
  // toasts & banner
  const toastQ = []; let toastBusy = false;
  function toast(msg) { if (!msg) return; toastQ.push(msg); if (toastQ.length > 4) toastQ.shift(); if (!toastBusy) nextToast(); }
  function nextToast() {
    const m = toastQ.shift(); if (!m) { toastBusy = false; return; } toastBusy = true;
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = m; $('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 2300); setTimeout(() => { el.remove(); nextToast(); }, 2650);
  }
  function banner(text, col) { const b = $('banner'); b.textContent = text; b.style.color = col || '#fff'; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

  // ---- sheets ----
  function openSheet(name) {
    G.sheet = name; const el = $('sheet'); el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('open'));
    renderSheet();
  }
  function closeSheet() { G.sheet = null; const el = $('sheet'); el.classList.remove('open'); setTimeout(() => { if (!G.sheet) el.classList.add('hidden'); }, 220); updateHud(true); }
  function renderSheet() {
    const n = G.sheet; if (!n) return;
    const body = $('sheetBody'), tabs = $('sheetTabs'); const st = body.scrollTop;
    body.innerHTML = ''; tabs.innerHTML = ''; tabs.classList.add('hidden');
    ({ dex: renderDex, cooler: renderCooler, shop: renderShop, map: renderMap, bounty: renderBounty, settings: renderSettings })[n](body, tabs);
    body.scrollTop = st;
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function btn(label, cls, fn, disabled) { const b = el('button', 'btn ' + (cls || ''), label); if (disabled) b.disabled = true; b.addEventListener('click', e => { e.stopPropagation(); Sfx.ui(); fn(); }); return b; }
  function tabBar(tabs, list, cur, fn) {
    tabs.classList.remove('hidden');
    for (const [id, label] of list) { const b = el('button', 'tab' + (id === cur ? ' on' : ''), label); b.addEventListener('click', () => { Sfx.ui(); fn(id); }); tabs.appendChild(b); }
  }
  function silCol() { return document.body.dataset.phase === 'night' ? '#0b1222' : '#2b3d50'; }

  function renderDex(body, tabs) {
    $('sheetTitle').textContent = 'Fishdex';
    const cur = G.dexLoc || S.loc;
    tabBar(tabs, LOCS.map(l => { const all = SPECIES.filter(s => s.loc === l.id), c = all.filter(s => S.dex[s.id]).length; return [l.id, `${l.name.replace('Old ', '').replace('Abyssal ', '').replace('Volcanic ', '').replace(' Forest', '')} <small>${Math.round(c / all.length * 100)}%</small>`]; }), cur, id => { G.dexLoc = id; renderSheet(); });
    const L = LOC_BY_ID[cur], all = SPECIES.filter(s => s.loc === cur), c = all.filter(s => S.dex[s.id]).length;
    const head = el('div', 'dex-head');
    head.innerHTML = `<div class="row between"><b>${L.name}</b><span>${c} / ${all.length} caught</span></div><div class="bar"><i style="width:${c / all.length * 100}%"></i></div>`;
    const rw = el('div', 'reward');
    if (S.rewards[cur]) rw.innerHTML = `Completion reward claimed ✓`;
    else {
      const bb = BAIT_BY_ID[L.rewardBait[0]];
      rw.innerHTML = `<span>Complete reward: <b><span class="coin-i">${ICON.coin}</span>${fmt(L.reward)}</b> + ${L.rewardBait[1]} ${bb.name}</span>`;
      if (c === all.length) rw.appendChild(btn('Claim', 'gold', () => { S.rewards[cur] = 1; addCoins(L.reward); S.baits[bb.id] = (S.baits[bb.id] || 0) + L.rewardBait[1]; save(); updateBaitChip(); updateBadges(); banner('Reward claimed!', '#ffcc4d'); renderSheet(); }));
    }
    head.appendChild(rw); body.appendChild(head);
    const grid = el('div', 'dex-grid');
    for (const s of all) {
      const rec = S.dex[s.id], card = el('button', 'dex-card' + (rec ? '' : ' unk'));
      card.style.setProperty('--rc', RARITY[s.r].col);
      card.appendChild(FishArt.thumb(s, 100, 56, rec ? {} : { sil: silCol() }));
      card.appendChild(el('div', 'nm', rec ? s.name : '???'));
      card.appendChild(el('div', 'sub', rec ? `${fmtKg(rec.best)} kg · ×${rec.n}` : RARITY[s.r].name));
      card.addEventListener('click', () => { Sfx.ui(); dexDetail(s); });
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }
  function condLines(s) {
    const L = LOC_BY_ID[s.loc];
    return `<div class="conds"><div><span>Time</span><b>${TIME_LABEL[s.t]}</b></div><div><span>Weather</span><b>${WEATHER_LABEL[s.w]}</b></div>
      <div><span>Depth</span><b>${Math.round(s.d[0] * L.depth)}–${Math.round(s.d[1] * L.depth)} m</b></div><div><span>Size</span><b>${fmtKg(s.kg[0])}–${fmtKg(s.kg[1])} kg</b></div></div>`;
  }
  function dexDetail(s) {
    const rec = S.dex[s.id], ov = el('div', 'detail');
    const card = el('div', 'detail-card'); card.style.setProperty('--rc', RARITY[s.r].col);
    card.appendChild(el('div', 'rar', RARITY[s.r].name));
    card.appendChild(FishArt.thumb(s, 260, 140, rec ? {} : { sil: silCol() }));
    card.appendChild(el('h3', '', rec ? s.name : '???'));
    const beh = { calm: 'Calm swimmer', darting: 'Darting', sinker: 'Sinker — dives deep', erratic: 'Erratic', legend: 'Legendary fighter' }[s.b];
    card.appendChild(el('p', 'stat', rec ? `Caught ${rec.n}× · Record ${fmtKg(rec.best)} kg · ${beh}` : (s.r === 4 ? 'Legendary. Few have seen it.' : 'Not caught yet. Conditions:')));
    if (s.hint) card.appendChild(el('p', 'hint-t', '“' + s.hint + '”'));
    card.insertAdjacentHTML('beforeend', condLines(s));
    card.appendChild(el('p', 'stat', `Value ≈ <span class="coin-i">${ICON.coin}</span>${fmt(s.p)}`));
    if (S.loc === s.loc && rec == null) { const now = timeOk(s.t) && weatherOk(s.w); card.appendChild(el('p', 'now ' + (now ? 'yes' : 'no'), now ? 'Biting right now!' : 'Not biting right now')); }
    card.appendChild(btn('Close', '', () => ov.remove()));
    ov.appendChild(card); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    $('sheet').querySelector('.sheet-card').appendChild(ov);
  }
  function renderCooler(body) {
    $('sheetTitle').textContent = `Cooler · ${S.inv.length}/${cooler().cap}`;
    const sellable = S.inv.filter(f => !f.fav), tot = sellable.reduce((a, f) => a + f.p, 0);
    const top = el('div', 'row between pad');
    top.appendChild(el('span', 'muted', S.inv.length ? 'Tap ★ to keep favourites safe from Sell All.' : ''));
    top.appendChild(btn(`Sell all <span class="coin-i">${ICON.coin}</span>${fmt(tot)}`, 'gold', () => { if (!sellable.length) return; S.inv = S.inv.filter(f => f.fav); addCoins(tot); toast(`Sold ${sellable.length} fish for ${fmt(tot)}`); save(); renderSheet(); }, !sellable.length));
    body.appendChild(top);
    if (!S.inv.length) { body.appendChild(el('div', 'empty', 'Your cooler is empty.<br>Catch something and choose <b>Keep</b>!')); return; }
    const list = el('div', 'list');
    S.inv.slice().reverse().forEach(f => {
      const s = SP_BY_ID[f.id]; if (!s) return;
      const row = el('div', 'item'); row.style.setProperty('--rc', RARITY[s.r].col);
      row.appendChild(FishArt.thumb(s, W < 360 ? 58 : 76, W < 360 ? 36 : 44));
      const info = el('div', 'info', `<b>${s.name}</b><span>${fmtKg(f.w)} kg · <i class="rtag">${RARITY[s.r].name}</i></span>`);
      row.appendChild(info);
      const star = el('button', 'star' + (f.fav ? ' on' : ''), ICON.star); star.setAttribute('aria-label', 'Favourite');
      star.addEventListener('click', () => { f.fav = !f.fav; Sfx.ui(); save(); renderSheet(); });
      row.appendChild(star);
      row.appendChild(btn(`<span class="coin-i">${ICON.coin}</span>${fmt(f.p)}`, 'sm', () => { S.inv.splice(S.inv.indexOf(f), 1); addCoins(f.p); save(); renderSheet(); }));
      list.appendChild(row);
    });
    body.appendChild(list);
  }
  function renderShop(body, tabs) {
    $('sheetTitle').innerHTML = `Tackle Shop <span class="hdr-coins"><span class="coin-i">${ICON.coin}</span>${fmt(S.coins)}</span>`;
    const cur = G.shopTab || 'rods';
    tabBar(tabs, [['rods', 'Rods'], ['lines', 'Lines'], ['bait', 'Bait'], ['boats', 'Boats'], ['cooler', 'Coolers']], cur, id => { G.shopTab = id; renderSheet(); });
    const list = el('div', 'list');
    const tier = (arr, key, stat, onBuy) => arr.forEach((it, i) => {
      const row = el('div', 'item shop'); const own = S[key] >= i;
      row.appendChild(el('div', 'info', `<b>${it.name}</b><span>${it.desc || ''}</span><span class="stat">${stat(it)}</span>`));
      if (own) row.appendChild(el('span', 'owned', S[key] === i ? 'Equipped' : 'Owned'));
      else if (i === S[key] + 1) row.appendChild(btn(`<span class="coin-i">${ICON.coin}</span>${fmt(it.price)}`, S.coins >= it.price ? 'gold' : '', () => {
        if (S.coins < it.price) { toast('Not enough coins.'); return; }
        S.coins -= it.price; S[key] = i; Sfx.fanfare(); vib(30); toast(`Bought ${it.name}!`); onBuy && onBuy(it); save(); updateHud(true); renderSheet();
      }, S.coins < it.price));
      else row.appendChild(el('span', 'locked', `<span class="coin-i">${ICON.coin}</span>${fmt(it.price)}`));
      list.appendChild(row);
    });
    if (cur === 'rods') tier(RODS, 'rod', r => `Catch zone ${Math.round(r.zone * 100)}% · Reel ×${r.reel.toFixed(2)}`);
    if (cur === 'lines') tier(LINES, 'line', l => `Reaches ${Math.round(l.reach * 100)}% of any water's depth`);
    if (cur === 'cooler') tier(COOLERS, 'cooler', c => `Holds ${c.cap} fish`);
    if (cur === 'boats') tier(BOATS, 'boat', b => `Unlocks: ${LOC_BY_ID[b.loc].name}`, b => { banner('New waters!', '#7ee08f'); toast(`${LOC_BY_ID[b.loc].name} unlocked — open the Map to sail there.`); });
    if (cur === 'bait') BAITS.forEach(b => {
      const row = el('div', 'item shop bait'); row.style.setProperty('--bc', b.col);
      const have = b.id === 'none' ? '∞' : (S.baits[b.id] || 0);
      row.appendChild(el('div', 'info', `<b><i class="dot"></i>${b.name} <small>×${have}</small></b><span>${b.desc}</span>`));
      const act = el('div', 'acts');
      if (S.bait === b.id) act.appendChild(el('span', 'owned', 'Equipped'));
      else if (b.id === 'none' || S.baits[b.id] > 0) act.appendChild(btn('Equip', 'sm', () => { S.bait = b.id; save(); updateBaitChip(); renderSheet(); }));
      if (b.price) act.appendChild(btn(`+${b.pack} · <span class="coin-i">${ICON.coin}</span>${fmt(b.price)}`, 'sm ' + (S.coins >= b.price ? 'gold' : ''), () => {
        if (S.coins < b.price) { toast('Not enough coins.'); return; }
        S.coins -= b.price; S.baits[b.id] = (S.baits[b.id] || 0) + b.pack; if (S.bait === 'none') S.bait = b.id; Sfx.coin(); save(); updateBaitChip(); updateHud(true); renderSheet();
      }, S.coins < b.price));
      row.appendChild(act); list.appendChild(row);
    });
    body.appendChild(list);
  }
  function renderMap(body) {
    $('sheetTitle').textContent = 'Sea Chart';
    const list = el('div', 'list');
    for (const L of LOCS) {
      const all = SPECIES.filter(s => s.loc === L.id), c = all.filter(s => S.dex[s.id]).length, un = unlocked(L), here = S.loc === L.id;
      const card = el('div', 'map-card' + (un ? '' : ' is-locked') + (here ? ' here' : ''));
      card.style.setProperty('--w0', L.water[0]); card.style.setProperty('--w1', L.water[1]);
      card.innerHTML = `<div class="mc-art"></div><div class="mc-info"><b>${L.name}</b><span>${L.desc}</span><span class="stat">Depth ${fmt(L.depth)} m · Fishdex ${c}/${all.length}</span></div>`;
      const art = card.querySelector('.mc-art');
      const sp = all.filter(s => S.dex[s.id]); const show = sp.length ? sp[sp.length - 1] : all[0];
      art.appendChild(FishArt.thumb(show, 74, 44, S.dex[show.id] ? {} : { sil: 'rgba(0,0,0,.45)' }));
      if (here) card.appendChild(el('span', 'owned', 'You are here'));
      else if (un) card.appendChild(btn('Sail', 'gold', () => travel(L.id)));
      else card.appendChild(el('span', 'locked', `Needs ${BOATS[L.boat].name}`));
      list.appendChild(card);
    }
    body.appendChild(list);
  }
  function travel(id) {
    closeSheet(); G.st = 'travel'; $('fade').classList.add('on'); Sfx.whoosh();
    setTimeout(() => {
      S.loc = id; G.amb = []; G.parts = []; G.ambInit = true; G.bob.vis = false; G.R = null; G.app = null;
      rollWeather(false); save(); buildStatic();
      G.st = 'idle'; setHint(); $('fade').classList.remove('on'); banner(loc().name); Sfx.splash(.8);
    }, 650);
  }
  function renderBounty(body) {
    $('sheetTitle').textContent = 'Bounty Board';
    refreshBounties();
    const list = el('div', 'list');
    for (const b of S.bounties) {
      const done = b.have >= b.n, row = el('div', 'item bounty' + (b.claimed ? ' claimed' : done ? ' done' : ''));
      const sp = b.sp && SP_BY_ID[b.sp];
      if (sp) row.appendChild(FishArt.thumb(sp, 70, 42, S.dex[sp.id] ? {} : { sil: silCol() }));
      else row.appendChild(el('div', 'bicon', ICON.bounty));
      const info = el('div', 'info', `<b>${bountyText(b)}</b><div class="bar sm"><i style="width:${Math.min(1, b.have / b.n) * 100}%"></i></div><span>${Math.min(b.have, b.n)} / ${b.n} · Reward <span class="coin-i">${ICON.coin}</span>${fmt(b.reward)}</span>`);
      row.appendChild(info);
      if (b.claimed) row.appendChild(el('span', 'owned', 'Paid ✓'));
      else if (done) row.appendChild(btn('Claim', 'gold', () => { b.claimed = true; addCoins(b.reward); banner(`+${fmt(b.reward)}`, '#ffcc4d'); save(); updateBadges(); renderSheet(); }));
      list.appendChild(row);
    }
    body.appendChild(list);
    const left = (1 - S.tod) * DAY_LEN / DBG.speed, mm = Math.floor(left / 60), ss = Math.floor(left % 60);
    body.appendChild(el('p', 'muted center', `New requests at midnight — in ${mm}:${String(ss).padStart(2, '0')}`));
    const comp = LOCS.filter(l => S.done[l.id] && !S.rewards[l.id]);
    if (comp.length) body.appendChild(el('p', 'muted center', `Fishdex reward waiting: ${comp.map(l => l.name).join(', ')}`));
  }
  function renderSettings(body) {
    $('sheetTitle').textContent = 'Settings';
    const tog = (label, key, fn) => {
      const row = el('div', 'item set'); row.appendChild(el('div', 'info', `<b>${label}</b>`));
      const b = el('button', 'switch' + (S.settings[key] ? ' on' : ''), '<i></i>'); b.setAttribute('aria-label', label); b.setAttribute('aria-pressed', S.settings[key]);
      b.addEventListener('click', () => { S.settings[key] = !S.settings[key]; fn && fn(S.settings[key]); Sfx.init(); Sfx.ui(); save(); renderSheet(); });
      row.appendChild(b); body.appendChild(row);
    };
    tog('Sound', 'sound', v => Sfx.setSound(v)); tog('Music', 'music', v => Sfx.setMusic(v)); tog('Vibration', 'haptics', v => v && vib(30));
    body.appendChild(el('div', 'howto', `<h4>How to fish</h4>
      <p><b>Cast:</b> hold anywhere, release when the power bar is where you want it. More power = farther and deeper (up to your line's limit).</p>
      <p><b>Bite:</b> nibbles are fake-outs — wait. When the <b class="red">!</b> pops, tap fast.</p>
      <p><b>Reel:</b> hold to lift the green bar, release to let it fall. Keep the fish inside to fill the meter.</p>
      <p><b>Desktop:</b> Space / mouse to do everything · 1–5 open panels · R reels in · Esc closes.</p>
      <p>Time of day, weather and depth change which fish bite. Check the Fishdex for clues.</p>`));
    const st = S.stats;
    body.appendChild(el('p', 'muted center', `Caught ${st.caught} fish · ${st.perfect} perfect · earned ${fmt(st.earned)} coins`));
    const row = el('div', 'row center gap');
    const a = el('a', 'btn', '‹ Arcade'); a.href = '../'; row.appendChild(a);
    let armed = false;
    const rb = btn('Reset save', 'danger', () => {
      if (!armed) { armed = true; rb.textContent = 'Tap again to erase'; setTimeout(() => { armed = false; rb.textContent = 'Reset save'; }, 3000); return; }
      try { localStorage.removeItem(KEY); } catch (e) { }
      S = fresh(); save(true); location.reload();
    });
    row.appendChild(rb); body.appendChild(row);
  }

  // ---------------------------------------------------------------- title & loop
  function updateTitleInfo() {
    const c = SPECIES.filter(s => S.dex[s.id]).length;
    $('titleInfo').innerHTML = S.stats.caught ? `Day ${S.day} · ${c}/${SPECIES.length} species · <span class="coin-i">${ICON.coin}</span>${fmt(S.coins)}` : 'A cozy fishing collection';
    $('btnStart').textContent = S.stats.caught ? 'Continue' : 'Cast Off';
  }
  function startGame() {
    if (G.st !== 'title') return;
    Sfx.init(); Sfx.setSound(S.settings.sound); Sfx.setMusic(S.settings.music); Sfx.splash(.8);
    $('title').classList.add('out'); setTimeout(() => $('title').classList.add('hidden'), 500);
    document.body.classList.remove('at-title');
    G.st = 'idle'; setHint(); banner(loc().name);
    refreshBounties(); updateBadges();
  }

  let last = performance.now(), saveClock = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(.05, (now - last) / 1000); last = now;
    if (G.paused) return;
    G.t += dt;
    if (G.st !== 'title') updateWorld(dt); else { for (const k in G.wx) G.wx[k] = lerp(G.wx[k], S.weather === k ? 1 : 0, dt); for (const c of G.clouds) c.x += c.v * dt; if (G.clouds.some(c => c.x > W + 160)) G.clouds.forEach(c => { if (c.x > W + 160) Object.assign(c, newCloud(false)); }); }
    updateFishing(dt);
    updateParts(dt);
    updateAmbient(dt);
    render();
    drawSparks();
    if (G.st === 'reveal') drawReveal(dt);
    updateHud();
    if (dirty) { dirtyT -= dt; if (dirtyT <= 0) save(true); }
    saveClock += dt; if (saveClock > 6 && G.st !== 'title') { saveClock = 0; save(true); }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { G.paused = true; Sfx.suspend(); save(true); }
    else { G.paused = false; last = performance.now(); Sfx.resume(); }
  });
  window.addEventListener('pagehide', () => save(true));
  window.addEventListener('resize', () => { resize(); if (rev) sizeRevCanvas(); if (G.hook && G.hook.d != null) { G.hook.ty = depthY(G.hook.d); if (G.st === 'waiting') G.hook.y = G.hook.ty; if (G.bob.x0) G.hook.x = G.bob.x0 = Math.min(G.bob.x0, castMax); } });
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // boot
  for (const k in G.wx) G.wx[k] = S.weather === k ? 1 : 0;
  initDom();
  Sfx.setSound(S.settings.sound); Sfx.setMusic(S.settings.music);
  resize();
  updateBaitChip(); updateBadges(); updateHud(true);
  requestAnimationFrame(frame);
  if (DEBUG) console.log('[deepcast] debug mode', DBG);

  // test / debug hooks
  window.DeepCast = {
    get state() { return G.st; },
    get reel() { const R = G.R; return R ? { fish: R.fish, pos: R.pos, zone: R.zone, prog: R.prog, hold: R.hold } : null; },
    get save() { return JSON.parse(JSON.stringify(S)); },
    get fish() { return G.fish ? G.fish.id : null; },
    setTod(t) { if (DEBUG) S.tod = t; },
    setWeather(w) { if (DEBUG && WEATHER_INFO[w]) { S.weather = w; G.wx = { rain: 0, fog: 0, storm: 0 }; G.wx[w] = w === 'clear' ? 0 : 1; } },
  };

  // service worker (offline)
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
    }
  } catch (e) { }
})();
