'use strict';
// TIDEWALL — menus, HUD, input (tap / drag / pinch), radial build ring, sheets, persistence, main loop, boot.
(function (TW) {
  const $ = (id) => document.getElementById(id);
  const Art = TW.Art, Rend = TW.Rend, Audio = TW.Audio, C = TW.Core;
  const W = TW.W, H = TW.H, T = TW.T;
  const KEY = 'tidewall.v1';
  const QS = new URLSearchParams(location.search);
  const DEBUG = QS.get('debug') === '1';
  const STEP = 1 / 60;

  // ---------------- persistence ----------------
  const DEF = () => ({
    v: 1, pearls: 0, towers: {}, cmds: { mara: true }, cmd: 'mara', perks: {},
    best: { night: 0, wins: 0, runs: 0, kills: 0 },
    set: { sfx: true, music: true, haptics: true, shake: true, reduced: false }, run: null, helped: false,
  });
  function load() {
    const d = DEF();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          d.pearls = Math.max(0, +s.pearls || 0);
          if (s.towers && typeof s.towers === 'object') d.towers = s.towers;
          if (s.cmds && typeof s.cmds === 'object') d.cmds = Object.assign({ mara: true }, s.cmds);
          if (typeof s.cmd === 'string') d.cmd = s.cmd;
          if (s.perks && typeof s.perks === 'object') d.perks = s.perks;
          if (s.best) Object.assign(d.best, s.best);
          if (s.set) Object.assign(d.set, s.set);
          if (s.run && typeof s.run === 'object') d.run = s.run;
          d.helped = !!s.helped;
        }
      }
    } catch (e) { /* storage unavailable: play without saving */ }
    if (!d.cmds[d.cmd]) d.cmd = 'mara';
    return d;
  }
  const S = load();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  let saveT = 0;
  function saveRunSoon() { clearTimeout(saveT); saveT = setTimeout(saveRun, 250); }
  function saveRun() {
    clearTimeout(saveT);
    if (!run || run.phase === 'over') return;
    const snap = run.serialize();
    if (snap) { S.run = snap; persist(); }
  }

  Audio.sfxOn = S.set.sfx; Audio.musicOn = S.set.music;
  Rend.settings.shake = S.set.shake; Rend.settings.reduced = S.set.reduced;
  document.body.classList.toggle('reduced', !!S.set.reduced);
  function haptic(p) { if (!S.set.haptics) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }
  function snd(n, p) { Audio.play(n, p); }
  Rend.onSound = (n) => Audio.play(n);

  let toastT = 0;
  function toast(msg, ms) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms || 2200);
  }

  // ---------------- screens ----------------
  const SCREENS = ['title', 'setup', 'armory', 'settings', 'boon', 'pause', 'help', 'summary'];
  let screen = 'title';
  function show(id) {
    screen = id;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    const inGame = !!run && (id === null || id === 'boon' || id === 'pause' || id === 'help');
    $('hud').classList.toggle('hidden', !inGame);
    $('bar').classList.toggle('hidden', !inGame);
    if (!inGame) { $('bossbar').classList.add('hidden'); $('routeTag').classList.add('hidden'); }
    if (id && id !== 'title' && id !== 'setup' && id !== 'armory') { $('toast').classList.add('hidden'); }
    if (id === 'title') refreshTitle();
    if (id === 'setup') buildSetup();
    if (id === 'armory') buildArmory();
    if (id === 'settings') buildSettings($('setList'));
    document.querySelectorAll('.pearlCount').forEach((el) => { el.textContent = S.pearls; });
    const el = id && $(id);
    if (el) el.scrollTop = 0;
    if (id === null) requestAnimationFrame(measure);
  }
  function click(id, fn) { $(id).addEventListener('click', (e) => { Audio.unlock(); snd('click'); fn(e); }); }
  document.querySelectorAll('.backBtn').forEach((b) => b.addEventListener('click', () => { Audio.unlock(); snd('click'); show(b.dataset.to); }));

  // ---------------- cost rendering ----------------
  const resIcons = {};
  function resIc(id, size) {
    const c = Art.iconCanvas('res', id, size);
    return c;
  }
  function costHTML(el, cost, check) {
    el.innerHTML = '';
    for (const k of ['g', 'w', 's', 'c']) {
      const v = cost[k]; if (!v) continue;
      const sp = document.createElement('span'); sp.className = 'cost' + (check && run && run.res[k] < v ? ' no' : '');
      sp.appendChild(resIc(k, 16)); sp.appendChild(document.createTextNode(v));
      el.appendChild(sp);
    }
    if (!el.childNodes.length) el.textContent = 'Free';
  }
  function needText(cost) {
    const parts = [];
    for (const r of TW.RES) { const v = cost[r.id] || 0; if (v > run.res[r.id]) parts.push((v - run.res[r.id]) + ' ' + r.name.toLowerCase()); }
    return 'Need ' + parts.join(', ');
  }

  // ---------------- title ----------------
  function drawHero() {
    const cv = $('heroCv'), d = Math.min(2, window.devicePixelRatio || 1);
    const w = parseFloat(getComputedStyle(cv).width) || 260, h = parseFloat(getComputedStyle(cv).height) || 210;
    cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    const g = cv.getContext('2d'); g.setTransform(d * w / 260, 0, 0, d * h / 210, 0, 0);
    // island
    g.fillStyle = '#e8d29a'; g.beginPath(); g.ellipse(130, 168, 118, 34, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5d9a4c'; g.beginPath(); g.ellipse(130, 164, 100, 26, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(130, 170, 124, 37, 0, 0.1, Math.PI - 0.1); g.stroke();
    // beam
    const gr = g.createLinearGradient(130, 70, 0, 20);
    gr.addColorStop(0, 'rgba(255,236,170,0.55)'); gr.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(130, 66); g.lineTo(0, 0); g.lineTo(0, 70); g.closePath(); g.fill();
    const gr2 = g.createLinearGradient(130, 70, 260, 30);
    gr2.addColorStop(0, 'rgba(255,236,170,0.4)'); gr2.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = gr2; g.beginPath(); g.moveTo(130, 66); g.lineTo(260, 10); g.lineTo(260, 60); g.closePath(); g.fill();
    Art.wall(g, 52, 140, 26, false, 2, 0, 1); Art.wall(g, 78, 140, 26, true, 1, 0, 1);
    Art.wall(g, 156, 140, 26, true, 2, 0, 1); Art.wall(g, 182, 140, 26, false, 1, 0, 1);
    Art.tower(g, 'ballista', 1, -1, 40, 160, 34, 0, -2.4, 0, 0);
    Art.tower(g, 'brazier', 0, -1, 220, 162, 32, 0.4, 0, 0, 0);
    Art.lighthouse(g, 130, 158, 66, 0.2, true, 1);
    g.save(); g.translate(20, 196); Art.enemy(g, 'shade', 9, 0); g.restore();
    g.save(); g.translate(240, 196); Art.enemy(g, 'crab', 9, 1); g.restore();
    g.save(); g.translate(210, 40); Art.enemy(g, 'gull', 7, 0); g.restore();
  }
  function refreshTitle() {
    $('titlePearls').textContent = S.pearls;
    const has = S.run && S.run.v === 1;
    $('contBtn').classList.toggle('hidden', !has);
    if (has) $('contBtn').textContent = 'Continue · Night ' + S.run.night;
    $('newBtn').classList.toggle('secondary', has);
    $('newBtn').textContent = 'New Expedition';
    $('newBtn').classList.toggle('primary', !has);
    const b = S.best;
    $('bestLine').textContent = b.runs ? 'Best: night ' + b.night + (b.wins ? ' · ' + b.wins + ' victor' + (b.wins > 1 ? 'ies' : 'y') : '') + ' · ' + b.runs + ' run' + (b.runs > 1 ? 's' : '') : 'Twenty nights. One light.';
    drawHero();
  }
  click('contBtn', () => { if (S.run) resumeRun(S.run); });
  let newArm = 0;
  click('newBtn', () => {
    if (S.run && Date.now() - newArm > 3000) { newArm = Date.now(); $('newBtn').textContent = 'Tap again — replaces your saved run'; return; }
    $('newBtn').textContent = 'New Expedition';
    setupSeeds(); show('setup');
  });
  click('armBtn', () => show('armory'));
  click('setBtn', () => show('settings'));

  // ---------------- expedition setup ----------------
  let setupMapSeed = 0, setupRunSeed = 0, setupMap = null;
  function setupSeeds() {
    const qs = +QS.get('seed');
    setupMapSeed = DEBUG && qs ? qs >>> 0 : C.newSeed();
    setupRunSeed = DEBUG && qs ? (qs * 31 + 7) >>> 0 : C.newSeed();
    setupMap = C.genMap(setupMapSeed);
  }
  function drawIsland() {
    const cv = $('islandCv');
    const w = Math.min(150, Math.max(110, (window.innerWidth - 80) * 0.42));
    Rend.drawPreview(cv, setupMap, w);
    $('islandName').textContent = C.STYLE_NAMES[setupMap.style] || 'Island';
    $('islandSeed').textContent = 'SEED ' + C.seedStr(setupMapSeed);
  }
  function buildSetup() {
    if (!setupMap) setupSeeds();
    drawIsland();
    const list = $('cmdList'); list.innerHTML = '';
    for (const cm of TW.COMMANDERS) {
      const owned = !!S.cmds[cm.id];
      const el = document.createElement('div');
      el.className = 'item' + (S.cmd === cm.id ? ' sel' : '') + (owned ? '' : ' locked');
      el.appendChild(Art.iconCanvas('cmd', cm.id, 56));
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = '<div class="name"></div><div class="title"></div><div class="perk"></div>';
      info.children[0].textContent = cm.name; info.children[1].textContent = cm.title; info.children[2].textContent = cm.perk;
      el.appendChild(info);
      const b = document.createElement('button'); b.className = 'btn';
      if (S.cmd === cm.id) { b.textContent = 'Chosen'; b.disabled = true; }
      else if (owned) { b.textContent = 'Choose'; b.onclick = () => { snd('click'); S.cmd = cm.id; persist(); buildSetup(); }; }
      else {
        b.innerHTML = '<i class="pearl"></i> ' + cm.cost;
        b.onclick = () => buy(cm.cost, () => { S.cmds[cm.id] = true; S.cmd = cm.id; }, cm.name + ' joins the expedition!', buildSetup);
      }
      el.appendChild(b);
      list.appendChild(el);
    }
  }
  function buy(cost, fn, msg, after) {
    Audio.unlock();
    if (S.pearls < cost) { snd('deny'); toast('Need ' + (cost - S.pearls) + ' more Pearls'); return; }
    S.pearls -= cost; fn(); persist(); snd('buy'); toast(msg);
    document.querySelectorAll('.pearlCount').forEach((el) => { el.textContent = S.pearls; });
    after();
  }
  click('rerollBtn', () => { setupMapSeed = C.newSeed(); setupRunSeed = C.newSeed(); setupMap = C.genMap(setupMapSeed); drawIsland(); });
  click('goBtn', () => newRun());

  // ---------------- armory ----------------
  function buildArmory() {
    const lt = $('armTowers'); lt.innerHTML = '';
    const order = TW.TOWER_IDS.slice().sort((a, b) => (TW.UNLOCKS.some((u) => u.id === b) && !S.towers[b] ? 1 : 0) - (TW.UNLOCKS.some((u) => u.id === a) && !S.towers[a] ? 1 : 0));
    for (const id of order) {
      const d = TW.TOWERS[id];
      const un = TW.UNLOCKS.find((u) => u.id === id);
      const owned = !un || S.towers[id];
      const el = document.createElement('div'); el.className = 'item' + (owned ? '' : ' locked');
      el.appendChild(Art.iconCanvas('tower', id, 52));
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = '<div class="name"></div><div class="perk"></div>';
      info.children[0].textContent = d.name;
      info.children[1].textContent = d.blurb + ' Tier 3: ' + d.branches[0].name + ' or ' + d.branches[1].name + '.';
      el.appendChild(info);
      const b = document.createElement('button'); b.className = 'btn';
      if (owned) { b.textContent = un ? 'Owned' : 'Starter'; b.disabled = true; }
      else { b.innerHTML = '<i class="pearl"></i> ' + un.cost; b.onclick = () => buy(un.cost, () => { S.towers[id] = true; }, d.name + ' unlocked!', buildArmory); }
      el.appendChild(b); lt.appendChild(el);
    }
    const lc = $('armCmds'); lc.innerHTML = '';
    for (const cm of TW.COMMANDERS) {
      const owned = !!S.cmds[cm.id];
      const el = document.createElement('div'); el.className = 'item' + (owned ? '' : ' locked');
      el.appendChild(Art.iconCanvas('cmd', cm.id, 52));
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = '<div class="name"></div><div class="perk"></div>';
      info.children[0].textContent = cm.name + ', ' + cm.title; info.children[1].textContent = cm.perk;
      el.appendChild(info);
      const b = document.createElement('button'); b.className = 'btn';
      if (owned) { b.textContent = 'Owned'; b.disabled = true; }
      else { b.innerHTML = '<i class="pearl"></i> ' + cm.cost; b.onclick = () => buy(cm.cost, () => { S.cmds[cm.id] = true; }, cm.name + ' unlocked!', buildArmory); }
      el.appendChild(b); lc.appendChild(el);
    }
    const lp = $('armPerks'); lp.innerHTML = '';
    for (const p of TW.PERKS) {
      const lv = S.perks[p.id] || 0;
      const el = document.createElement('div'); el.className = 'item perkitem';
      el.innerHTML = '<div class="name"></div><div class="desc"></div><div class="pips"></div>';
      el.children[0].textContent = p.name; el.children[1].textContent = p.desc + ' per level';
      for (let i = 0; i < p.cost.length; i++) { const pi = document.createElement('i'); if (i < lv) pi.className = 'on'; el.children[2].appendChild(pi); }
      const b = document.createElement('button'); b.className = 'btn';
      if (lv >= p.cost.length) { b.textContent = 'Maxed'; b.disabled = true; }
      else { const c = p.cost[lv]; b.innerHTML = '<i class="pearl"></i> ' + c; b.onclick = () => buy(c, () => { S.perks[p.id] = lv + 1; }, p.name + ' improved!', buildArmory); }
      el.appendChild(b); lp.appendChild(el);
    }
  }

  // ---------------- settings ----------------
  const SETS = [['sfx', 'Sound effects'], ['music', 'Music'], ['haptics', 'Haptics (vibration)'], ['shake', 'Screen shake'], ['reduced', 'Reduced motion']];
  function buildSettings(list) {
    list.innerHTML = '';
    for (const [k, label] of SETS) {
      const b = document.createElement('button');
      b.className = 'btn toggle'; b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
      b.innerHTML = '<span></span><span class="sw"></span>'; b.firstChild.textContent = label;
      b.onclick = () => {
        Audio.unlock();
        S.set[k] = !S.set[k]; persist();
        b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
        if (k === 'sfx') Audio.setSfx(S.set.sfx);
        if (k === 'music') { Audio.setMusic(S.set.music); if (S.set.music) Audio.startMusic(); }
        if (k === 'haptics' && S.set.haptics) haptic(30);
        if (k === 'shake') Rend.settings.shake = S.set.shake;
        if (k === 'reduced') { Rend.settings.reduced = S.set.reduced; document.body.classList.toggle('reduced', S.set.reduced); }
        snd('click');
      };
      list.appendChild(b);
    }
  }
  let resetArm = 0;
  click('resetBtn', () => {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('resetBtn').textContent = 'Tap again to erase everything'; return; }
    const set = S.set; const d = DEF(); Object.keys(S).forEach((k) => delete S[k]); Object.assign(S, d); S.set = set;
    persist(); $('resetBtn').textContent = 'Reset all progress'; toast('Progress erased'); show('settings');
  });

  // ================================================================ GAME
  let run = null, paused = false, speed = 1, acc = 0;
  const ui = { sel: null, hover: -1, radialCell: -1, preview: null, drag: null, coreSel: false };
  let pendingModal = 0;

  function unlockedTowers() { return TW.TOWER_IDS.filter((id) => TW.START_TOWERS.indexOf(id) >= 0 || S.towers[id]); }
  function newRun() {
    Audio.unlock();
    if (!setupMap) setupSeeds();
    const r = new TW.Run({ seed: setupRunSeed, mapSeed: setupMapSeed, cmd: S.cmd, perks: S.perks, unlocked: unlockedTowers(), fx: Rend.fx, god: DEBUG && QS.get('god') === '1' });
    if (DEBUG) {
      if (QS.get('rich') === '1') { r.res.g += 5000; r.res.w += 500; r.res.s += 500; r.res.c += 200; }
      const n = +QS.get('night');
      if (n > 1 && n <= TW.NIGHTS) { r.night = n; r.res.g += 60 * n * n; r.res.w += 12 * n; r.res.s += 12 * n; r.res.c += 3 * n; r.actions = r.actionsMax(); }
    }
    S.best.runs++;
    setupMap = null;
    startRun(r);
    if (!S.helped) { S.helped = true; persist(); setTimeout(() => openHelp(), 600); }
  }
  function resumeRun(o) {
    Audio.unlock();
    const r = TW.Run.restore(o, Rend.fx);
    if (!r) { S.run = null; persist(); toast('Saved run could not be restored'); refreshTitle(); return; }
    for (const id of unlockedTowers()) if (r.unlocked.indexOf(id) < 0) r.unlocked.push(id); // towers unlocked since
    startRun(r);
    toast('Welcome back — Night ' + r.night);
  }
  function startRun(r) {
    run = r; window.TWDBG.run = r;
    paused = false; acc = 0;
    clearUI();
    Rend.setRun(r);
    Rend.setNight(false, true);
    show(null);
    measure();
    buildRes();
    if (r.phase === 'boon') { openBoon(); }
    else enterDay();
    Audio.startMusic('day');
    saveRun();
  }
  function enterDay() {
    Rend.setNight(false);
    Audio.startMusic('day'); Audio.setIntensity(0);
    buildThreats();
    hudDirty = true;
  }
  function measure() {
    if (!run) { Rend.resize(0, 0); return; }
    const top = $('hud').offsetHeight || 90, bottom = $('bar').offsetHeight || 76;
    Rend.resize(top + 4, bottom + 2);
    $('bossbar').style.top = (top + 6) + 'px';
    $('routeTag').style.top = (top + 2) + 'px';
    $('radialHint').style.top = (top + 4) + 'px';
  }

  // ---------------- HUD ----------------
  let hudDirty = true, lastHud = '';
  const resEls = {};
  function buildRes() {
    const row = $('resRow'); row.innerHTML = '';
    for (const r of TW.RES) {
      const el = document.createElement('div'); el.className = 'res'; el.title = r.name;
      el.appendChild(resIc(r.id, 22));
      const b = document.createElement('b'); b.textContent = '0'; el.appendChild(b);
      row.appendChild(el); resEls[r.id] = { el, b, v: -1 };
    }
    const gi = $('gatherIc'); gi.innerHTML = ''; gi.appendChild(resIc('tap', 26));
    const hb = document.querySelector('.hpbar'); const old = hb.querySelector('canvas'); if (old) old.remove();
    hb.insertBefore(Art.iconCanvas('core', 0, 22), hb.firstChild);
  }
  function updateHud() {
    if (!run) return;
    for (const r of TW.RES) {
      const o = resEls[r.id], v = Math.floor(run.res[r.id]);
      if (o && o.v !== v) { if (o.v >= 0 && v > o.v) { o.el.classList.add('bump'); setTimeout(() => o.el.classList.remove('bump'), 150); } o.v = v; o.b.textContent = v; }
    }
    const night = run.phase === 'night';
    const key = run.night + '|' + run.phase + '|' + Math.ceil(run.hp) + '|' + run.maxHp + '|' + run.actions + '|' + speed + (hudDirty ? '!' : '');
    if (key !== lastHud) {
      lastHud = key; hudDirty = false;
      $('nightLbl').textContent = run.night;
      $('phaseLbl').textContent = night ? 'NIGHT' : (run.phase === 'boon' ? 'DAWN' : 'DAY');
      document.querySelector('.night-badge').classList.toggle('night', night);
      const f = Math.max(0, run.hp / run.maxHp);
      $('hpFill').style.width = (f * 100) + '%';
      $('hpTxt').textContent = Math.ceil(Math.max(0, run.hp)) + ' / ' + run.maxHp;
      document.querySelector('.hpbar').classList.toggle('low', f < 0.3);
      $('dayBar').classList.toggle('hidden', night);
      $('nightBar').classList.toggle('hidden', !night);
      $('gatherN').textContent = run.actions;
      $('gatherChip').classList.toggle('empty', run.actions <= 0);
      $('startBtn').firstChild.textContent = 'Night ' + run.night + ' ';
      $('speedBtn').textContent = speed + '×';
    }
    if (night && run.wave) {
      const left = Math.max(0, run.wave.total - (run.wave.spawned - run.alive));
      const p = run.waveProgress();
      $('waveFill').style.width = (p * 100).toFixed(1) + '%';
      const t = left + ' shadow' + (left === 1 ? '' : 's') + ' left';
      if ($('waveTxt').textContent !== t) $('waveTxt').textContent = t;
      // boss bar
      let boss = null;
      if (run.wave.boss) for (const e of run.enemies) if (e.active && e.boss) { boss = e; break; }
      const bb = $('bossbar');
      if (boss) {
        bb.classList.remove('hidden');
        $('bossName').textContent = boss.def.name + (boss.faded ? ' — faded' : '');
        $('bossFill').style.width = (Math.max(0, boss.hp / boss.maxHp) * 100).toFixed(1) + '%';
      } else bb.classList.add('hidden');
      $('routeTag').classList.add('hidden');
      Audio.setIntensity(run.alive > 40 ? 3 : run.alive > 18 ? 2 : run.alive > 5 ? 1 : 0);
    } else {
      $('bossbar').classList.add('hidden');
      updateRouteTag();
    }
  }
  let lastRoute = '';
  function updateRouteTag() {
    const el = $('routeTag');
    if (!run || run.phase !== 'day' || ui.preview || ui.radialCell >= 0 || screen !== null) { el.classList.add('hidden'); return; }
    const r = run.routes;
    const sealed = r.sealed, br = r.breach.length;
    const t = sealed ? '⚠ Sealed — they will smash through the ✕ walls' : (br ? '⚠ Route breaks a wall (✕)' : 'Route: ' + r.len + ' tiles');
    if (t !== lastRoute) { lastRoute = t; el.textContent = t; el.classList.toggle('warn', sealed || br > 0); }
    el.classList.remove('hidden');
  }
  function buildThreats() {
    const box = $('threats'); box.innerHTML = '';
    if (!run) return;
    const w = C.genWave(run.night, run.seed);
    const counts = {};
    for (const g of w.groups) counts[g.type] = (counts[g.type] || 0) + g.n;
    const list = [];
    if (w.boss) list.push({ id: w.boss, n: 1, boss: true });
    for (const id of TW.ENEMY_IDS) if (counts[id]) list.push({ id, n: counts[id], fresh: TW.ENEMIES[id].from === run.night });
    for (const t of list) {
      const b = document.createElement('button'); b.className = 'threat' + (t.boss ? ' boss' : '') + (t.fresh ? ' new' : '');
      b.appendChild(Art.iconCanvas('enemy', t.id, 34));
      if (!t.boss) { const em = document.createElement('em'); em.textContent = t.n; b.appendChild(em); }
      const d = t.boss ? TW.BOSSES[t.id] : TW.ENEMIES[t.id];
      b.setAttribute('aria-label', d.name);
      b.onclick = (e) => { e.stopPropagation(); Audio.unlock(); snd('click'); toast((t.boss ? 'BOSS · ' : '') + d.name + (t.boss ? '' : ' ×' + t.n) + ' — ' + d.desc, 2800); };
      box.appendChild(b);
    }
  }
  click('gatherChip', () => toast(run && run.actions > 0 ? 'Tap trees, boulders or crystals to gather (' + run.actions + ' taps left today)' : 'No gather taps left today — harvesters pay out at dawn', 2600));
  click('startBtn', () => startNight());
  click('speedBtn', () => cycleSpeed());
  click('menuBtn', () => pause());

  function cycleSpeed() {
    const opts = DEBUG ? [1, 2, 3, 5, 8] : [1, 2, 3];
    speed = opts[(opts.indexOf(speed) + 1) % opts.length];
    hudDirty = true;
  }
  function startNight() {
    if (!run || run.phase !== 'day') return;
    clearUI();
    saveRun();
    run.startNight();
    if (DEBUG && QS.get('stress') === '1') {
      const sp = run.spawnsActive();
      for (let i = 0; i < 260; i++) { const id = TW.ENEMY_IDS[i % 10]; if (run.spawnAt(sp[i % sp.length], id, false)) { run.wave.total++; run.wave.spawned++; } }
    }
    hudDirty = true;
  }

  // ---------------- events from the sim ----------------
  Rend.onEvent = function (name, a, b) {
    if (!run) return;
    if (name === 'kill') {
      const e = a;
      Rend.gold(e.x, e.y, b);
      Rend.fx.puff(e.x, e.y, e.def.color, e.boss ? 2.4 : 0.9);
      if (e.boss) {
        Rend.fx.spark(e.x, e.y, '#ffcf4a', 24); Rend.fx.shake(0.9); snd('bossdie'); haptic([40, 40, 80]);
        banner('BOSS SLAIN', e.def.name, '', 'dawn');
      } else { snd('kill'); if (Math.random() < 0.5) snd('coin'); }
    } else if (name === 'leak') {
      Rend.fx.text(run.cx, run.cy - 1.2, '-' + a, '#ff5d73', true);
      Rend.fx.spark(run.cx, run.cy - 0.5, '#ff5d73', 8);
      Rend.fx.shake(0.35); snd('leak'); haptic(a >= 5 ? [30, 30, 60] : 25);
      const hb = document.querySelector('.hpbar'); hb.classList.remove('hit'); void hb.offsetWidth; hb.classList.add('hit');
    } else if (name === 'boss') {
      const d = TW.BOSSES[a];
      banner('BOSS', d.name, d.desc, 'boss'); snd('boss'); haptic([60, 40, 60]); Rend.fx.shake(0.5);
    } else if (name === 'nightStart') {
      const d = b ? TW.BOSSES[b] : null;
      banner('THEY COME ASHORE', 'NIGHT ' + a, d ? d.name + ' approaches…' : nightFlavor(a), d ? 'boss' : '');
      snd('night'); Rend.setNight(true);
      Audio.startMusic('night');
    } else if (name === 'dawn') {
      Rend.setNight(false);
      snd('dawn'); banner('DAWN', 'Night ' + a.night + ' survived', '', 'dawn');
      Audio.startMusic('day'); Audio.setIntensity(0);
      saveRun();
      clearTimeout(pendingModal);
      pendingModal = setTimeout(openBoon, 1500);
    } else if (name === 'win') {
      Rend.setNight(false); snd('win'); banner('VICTORY', 'The light endures', '', 'dawn');
      clearTimeout(pendingModal); pendingModal = setTimeout(() => endRun('win'), 2200);
    } else if (name === 'lose') {
      snd('lose'); haptic([80, 60, 120]); Rend.fx.shake(1);
      clearTimeout(pendingModal); pendingModal = setTimeout(() => endRun('lose'), 1600);
    } else if (name === 'structLost') {
      if (ui.sel === a) closeSheet();
      haptic(15);
    }
  };
  function nightFlavor(n) {
    const fresh = TW.ENEMY_IDS.filter((id) => TW.ENEMIES[id].from === n).map((id) => TW.ENEMIES[id].name);
    if (fresh.length) return 'New: ' + fresh.join(', ');
    if (C.spawnCount(n) > C.spawnCount(n - 1)) return 'A new beach opens';
    return n >= 16 ? 'The tide is endless' : 'Hold the line';
  }
  let banT = 0;
  function banner(small, big, sub, cls) {
    const b = $('banner');
    $('banSmall').textContent = small; $('banBig').textContent = big; $('banSub').textContent = sub || '';
    b.className = 'banner' + (cls ? ' ' + cls : '') + (big.length > 11 ? ' long' : '');
    void b.offsetWidth;
    clearTimeout(banT); banT = setTimeout(() => b.classList.add('hidden'), 2400);
  }

  // ---------------- boons ----------------
  let cardsLive = false;
  function openBoon() {
    if (!run || run.phase !== 'boon') return;
    clearUI();
    const rep = run.dawn;
    $('dawnSub').textContent = rep ? 'Night ' + rep.night + ' survived · ' + rep.kills + ' shadows banished' : 'Choose a boon';
    const gains = $('dawnGains'); gains.innerHTML = '';
    if (rep) {
      const add = (ic, txt) => { const s = document.createElement('span'); s.className = 'gain'; s.appendChild(ic); s.appendChild(document.createTextNode(txt)); gains.appendChild(s); };
      add(resIc('g', 20), '+' + rep.g + ' dawn');
      if (rep.killGold) add(resIc('g', 20), '+' + rep.killGold + ' bounty');
      if (rep.w) add(resIc('w', 20), '+' + rep.w);
      if (rep.s) add(resIc('s', 20), '+' + rep.s);
      if (rep.c) add(resIc('c', 20), '+' + rep.c);
      if (rep.heal) add(resIc('hp', 20), '+' + rep.heal);
      if (rep.leaks) add(resIc('hp', 20), '−' + rep.leaks + ' light');
    }
    const box = $('cards'); box.innerHTML = '';
    cardsLive = false;
    run.offers.forEach((id, i) => {
      const bd = TW.BOONS.find((x) => x.id === id);
      const rar = TW.RARITY[bd.rar];
      const b = document.createElement('button');
      b.className = 'card' + (bd.rar === 'legendary' ? ' legendary' : '');
      b.style.setProperty('--rc', rar.color);
      b.style.animationDelay = (i * 0.07) + 's';
      const ic = document.createElement('div'); ic.className = 'ic'; ic.appendChild(Art.iconCanvas('boon', id, 54)); b.appendChild(ic);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = bd.name; b.appendChild(nm);
      const tg = document.createElement('div'); tg.className = 'tg';
      const t1 = document.createElement('span'); t1.textContent = bd.tag; tg.appendChild(t1);
      const t2 = document.createElement('span'); t2.className = 'rar'; t2.textContent = rar.name; tg.appendChild(t2);
      const have = run.boons[id] || 0;
      if (have) { const t3 = document.createElement('span'); t3.textContent = 'Owned ×' + have; tg.appendChild(t3); }
      b.appendChild(tg);
      const ds = document.createElement('div'); ds.className = 'ds'; ds.textContent = bd.desc; b.appendChild(ds);
      if (window.matchMedia('(hover: hover)').matches) { const k = document.createElement('span'); k.className = 'key'; k.textContent = String(i + 1); b.appendChild(k); }
      b.disabled = true;
      b.onclick = () => pickBoon(i);
      box.appendChild(b);
    });
    show('boon');
    setTimeout(() => { cardsLive = true; box.querySelectorAll('.card').forEach((c) => { c.disabled = false; }); }, 420);
  }
  function pickBoon(i) {
    if (!cardsLive || !run || run.phase !== 'boon') return;
    cardsLive = false;
    Audio.unlock();
    const id = run.offers[i];
    const bd = TW.BOONS.find((x) => x.id === id);
    run.pickBoon(i);
    snd('pick'); haptic(20);
    show(null);
    toast(bd.name + ' — ' + bd.desc, 2400);
    enterDay();
    saveRun();
  }

  // ---------------- pause / help / summary ----------------
  function pause() {
    if (!run || run.phase === 'over' || screen === 'boon') return;
    clearUI();
    paused = true;
    const st = run.stats;
    $('pauseStats').innerHTML = '';
    const add = (lbl, v) => { const s = document.createElement('span'); s.innerHTML = lbl + ' <b></b>'; s.lastChild.textContent = v; $('pauseStats').appendChild(s); };
    add('Night', run.night + '/20'); add('Kills', st.kills); add('Seed', C.seedStr(run.mapSeed));
    const bl = $('pauseBoons'); bl.innerHTML = '';
    for (const id in run.boons) {
      const bd = TW.BOONS.find((x) => x.id === id); if (!bd) continue;
      const s = document.createElement('span'); s.className = 'b'; s.style.setProperty('--rc', TW.RARITY[bd.rar].color);
      s.appendChild(Art.iconCanvas('boon', id, 20)); s.appendChild(document.createTextNode(bd.name + (run.boons[id] > 1 ? ' ×' + run.boons[id] : '')));
      bl.appendChild(s);
    }
    buildSettings($('pauseSet'));
    $('quitBtn').textContent = 'Abandon run';
    Audio.duck(true);
    show('pause');
  }
  function resume() {
    paused = false; Audio.duck(false); show(null);
    if (run && run.phase === 'boon') openBoon();
  }
  click('resumeBtn', resume);
  let quitArm = 0;
  click('quitBtn', () => {
    if (Date.now() - quitArm > 3000) { quitArm = Date.now(); $('quitBtn').textContent = 'Tap again to abandon'; return; }
    endRun('abandon');
  });
  function openHelp() {
    $('helpBody').innerHTML = document.querySelector('#settings .howto').innerHTML;
    const h = $('helpBody').querySelector('h3'); if (h) h.remove();
    paused = true;
    show('help');
  }
  click('helpBtn2', openHelp);
  click('helpClose', () => { paused = false; show(null); if (run && run.phase === 'boon') openBoon(); });

  function endRun(result) {
    if (!run) return;
    clearTimeout(pendingModal);
    if (result === 'abandon') { run.result = 'lose'; run.phase = 'over'; }
    const st = run.stats, won = result === 'win';
    const pearls = run.pearls();
    S.pearls += pearls;
    S.best.night = Math.max(S.best.night, won ? TW.NIGHTS : st.nightsCleared);
    S.best.kills = Math.max(S.best.kills, st.kills);
    if (won) S.best.wins++;
    S.run = null; persist();
    $('sumTitle').textContent = won ? 'THE LIGHT ENDURES' : (result === 'abandon' ? 'EXPEDITION ABANDONED' : 'THE LIGHT WENT OUT');
    $('sumTitle').classList.toggle('win', won);
    $('sumSub').textContent = won ? 'Twenty nights held on ' + (C.STYLE_NAMES[run.map.style] || 'the island') + '.' : 'Fell on night ' + run.night + ' of 20.';
    const sst = $('sumStats'); sst.innerHTML = '';
    const stat = (v, l) => { const d = document.createElement('div'); d.innerHTML = '<b></b><small></small>'; d.firstChild.textContent = v; d.lastChild.textContent = l; sst.appendChild(d); };
    stat(st.nightsCleared, 'Nights'); stat(st.kills, 'Kills'); stat(st.bossKills, 'Bosses');
    stat(st.built, 'Built'); stat(st.leaks, 'Light lost'); stat(Object.keys(run.boons).length, 'Boons');
    $('sumPearls').textContent = pearls;
    const list = $('sumTowers'); list.innerHTML = '';
    const ent = Object.entries(st.dmgBy).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const mx = ent.length ? ent[0][1] : 1;
    for (const [k, v] of ent) {
      const row = document.createElement('div'); row.className = 'dmg';
      row.appendChild(k === 'core' ? Art.iconCanvas('core', 0, 30) : Art.iconCanvas('tower', k, 30));
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = k === 'core' ? 'Lighthouse' : TW.TOWERS[k].name; row.appendChild(nm);
      const val = document.createElement('div'); val.className = 'val'; val.textContent = v >= 10000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v); row.appendChild(val);
      const bar = document.createElement('div'); bar.className = 'bar2'; bar.innerHTML = '<i></i>'; bar.firstChild.style.width = (v / mx * 100) + '%'; row.appendChild(bar);
      list.appendChild(row);
    }
    if (!ent.length) list.innerHTML = '<p class="sub">No damage dealt.</p>';
    paused = true;
    show('summary');
    Audio.stopMusic();
  }
  click('againBtn', () => { run = null; Rend.setRun(null); setupSeeds(); show('setup'); });
  click('homeBtn', () => { run = null; Rend.setRun(null); show('title'); });

  // ---------------- selection / radial / sheets ----------------
  function clearUI() {
    closeRadial(); closeSheet(); cancelPreview();
    ui.drag = null; ui.coreSel = false;
  }
  function closeRadial() { ui.radialCell = -1; $('radial').classList.add('hidden'); $('radialHint').classList.add('hidden'); }
  function cancelPreview() { ui.preview = null; $('confirm').classList.add('hidden'); }
  function closeSheet() { ui.sel = null; ui.coreSel = false; $('sheet').classList.add('hidden'); sheetKey = ''; }

  function openRadial(cell) {
    clearUI();
    ui.radialCell = cell;
    const r = Rend.cellRect(cell);
    const opts = [{ kind: 'wall' }];
    if (run.harvCount() < run.harvMax()) opts.push({ kind: 'harv' });
    for (const id of run.unlocked) opts.push({ kind: 'tower', type: id });
    const n = opts.length, rad = n > 7 ? 92 : 80;
    let cx = r.x + r.s / 2, cy = r.y + r.s / 2;
    const vw = window.innerWidth, vh = window.innerHeight;
    const topLim = $('hud').offsetHeight + rad + 34, botLim = vh - $('bar').offsetHeight - rad - 20;
    cx = Math.max(rad + 34, Math.min(vw - rad - 34, cx));
    cy = Math.max(topLim, Math.min(botLim, cy));
    const box = $('radial'); box.innerHTML = '';
    box.style.left = cx + 'px'; box.style.top = cy + 'px';
    opts.forEach((o, k) => {
      const a = -Math.PI / 2 + k * Math.PI * 2 / n;
      const b = document.createElement('button'); b.className = 'ritem';
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      b.style.left = x + 'px'; b.style.top = y + 'px';
      b.style.setProperty('--fx', (-x) + 'px'); b.style.setProperty('--fy', (-y) + 'px');
      b.style.animationDelay = (k * 0.018) + 's';
      let cost, label;
      if (o.kind === 'wall') { cost = run.wallCost(); label = 'Palisade'; b.appendChild(Art.iconCanvas('wall', 0, 40)); }
      else if (o.kind === 'harv') { cost = run.harvCost(); label = 'Harvester'; b.appendChild(Art.iconCanvas('harv', 0, 40)); }
      else { cost = run.towerCost(o.type, 0); label = TW.TOWERS[o.type].name; b.appendChild(Art.iconCanvas('tower', o.type, 42)); }
      const sm = document.createElement('small');
      sm.textContent = shortCost(cost); b.appendChild(sm);
      if (!run.afford(cost)) b.classList.add('poor');
      b.setAttribute('aria-label', label);
      b.onclick = (e) => {
        e.stopPropagation(); Audio.unlock();
        if (!run.afford(cost)) { snd('deny'); toast(label + ': ' + needText(cost)); return; }
        snd('click');
        beginPreview(o.kind, o.type, [cell]);
      };
      box.appendChild(b);
    });
    const c = document.createElement('button'); c.className = 'ritem center'; c.textContent = '✕'; c.setAttribute('aria-label', 'Close');
    c.style.left = '0px'; c.style.top = '0px';
    c.onclick = (e) => { e.stopPropagation(); snd('click'); closeRadial(); };
    box.appendChild(c);
    box.classList.remove('hidden');
    const hint = $('radialHint'); hint.textContent = 'Pick something to build · drag on tiles to paint walls';
    hint.classList.remove('hidden');
    snd('open');
  }
  function shortCost(c) {
    const p = [];
    if (c.g) p.push(c.g + 'g'); if (c.w) p.push(c.w + 'w'); if (c.s) p.push(c.s + 's'); if (c.c) p.push(c.c + 'c');
    return p.join(' ') || 'free';
  }
  function beginPreview(kind, type, cells) {
    closeRadial(); closeSheet();
    const valid = cells.filter((c) => run.cellFree(c));
    if (!valid.length) { cancelPreview(); return; }
    const routes = run.previewRoutes(valid, kind, type);
    ui.preview = { kind, type, cells: valid, routes };
    let name, cost, desc = '';
    if (kind === 'wall') {
      const wc = run.wallCost().w;
      const afford = Math.min(valid.length, Math.floor(run.res.w / wc));
      name = valid.length > 1 ? valid.length + ' Palisades' : 'Palisade';
      cost = { w: wc * valid.length };
      if (afford < valid.length) desc = 'Wood for only ' + afford + ' — the rest are skipped. ';
    } else if (kind === 'harv') {
      name = 'Harvester'; cost = run.harvCost();
      const y = run.harvYield(valid[0]);
      const parts = []; if (y.w) parts.push('+' + y.w + ' wood'); if (y.s) parts.push('+' + y.s + ' stone'); if (y.c) parts.push('+' + y.c + ' crystal');
      desc = parts.length ? 'Each dawn: ' + parts.join(', ') + '. ' : 'Nothing nearby to harvest! Place next to trees, boulders or crystals. ';
    } else {
      const d = TW.TOWERS[type]; name = d.name; cost = run.towerCost(type, 0); desc = d.blurb + ' ';
    }
    $('cName').textContent = name;
    costHTML($('cCost'), cost, true);
    const note = $('cNote');
    const before = run.routes.len, after = routes.len;
    if (routes.sealed) { note.textContent = desc + '⚠ Seals every path — the shadows will smash through the ✕ wall.'; note.className = 'warn'; }
    else if (routes.breach.length) { note.textContent = desc + '⚠ The new route goes through a structure (✕) — they will break it.'; note.className = 'warn'; }
    else {
      const dl = after - before;
      note.textContent = desc + 'Route ' + before + ' → ' + after + ' tiles' + (dl > 0 ? ' (+' + dl + ')' : dl < 0 ? ' (' + dl + ')' : '');
      note.className = dl > 0 ? 'good' : '';
    }
    $('cYes').textContent = kind === 'wall' && valid.length > 1 ? 'Build ' + valid.length : 'Build';
    $('confirm').classList.remove('hidden');
  }
  click('cNo', () => cancelPreview());
  click('cYes', () => confirmPreview());
  function confirmPreview() {
    const pv = ui.preview; if (!pv || !run) return;
    let ok = false;
    if (pv.kind === 'wall') {
      const n = run.buildWalls(pv.cells);
      ok = n > 0;
      if (ok) { pv.cells.slice(0, n).forEach((c, k) => setTimeout(() => { snd('wall', k); Rend.fx.puff(c % W + 0.5, ((c / W) | 0) + 0.6, '#c8a070', 0.5); }, k * 40)); haptic(12); }
    } else if (pv.kind === 'harv') ok = !!run.buildHarvester(pv.cells[0]);
    else ok = !!run.buildTower(pv.cells[0], pv.type);
    if (!ok) { snd('deny'); toast(needText(pv.kind === 'wall' ? run.wallCost() : pv.kind === 'harv' ? run.harvCost() : run.towerCost(pv.type, 0))); cancelPreview(); return; }
    if (pv.kind !== 'wall') { snd('build'); haptic(18); const c = pv.cells[0]; Rend.fx.puff(c % W + 0.5, ((c / W) | 0) + 0.7, '#d8c8a0', 0.8); Rend.fx.spark(c % W + 0.5, ((c / W) | 0) + 0.3, '#ffd27a', 6); }
    cancelPreview();
    saveRunSoon();
    hudDirty = true;
  }

  let sheetKey = '', sellArm = -1, sellArmT = 0;
  function openSheet(s) {
    closeRadial(); cancelPreview();
    ui.sel = s; ui.coreSel = false;
    sheetKey = '';
    renderSheet();
    snd('open');
  }
  function openCoreSheet() {
    clearUI(); ui.coreSel = true;
    const sh = $('sheet'); sh.innerHTML = '';
    const head = document.createElement('div'); head.className = 'sh-head';
    const ic = document.createElement('div'); ic.className = 'ic'; ic.appendChild(Art.iconCanvas('core', 0, 46)); head.appendChild(ic);
    const nm = document.createElement('div'); nm.className = 'nm'; nm.innerHTML = '<b>The Lighthouse</b><small></small>';
    nm.lastChild.textContent = 'Keep it burning. Every shadow that reaches it dims the light.'; head.appendChild(nm);
    head.appendChild(closeBtn());
    sh.appendChild(head);
    const stats = document.createElement('div'); stats.className = 'sh-stats';
    statBox(stats, Math.ceil(run.hp) + '/' + run.maxHp, 'Light');
    statBox(stats, Math.round((5 + run.night * 0.9) * run.mods.beam), 'Beam dmg');
    statBox(stats, (TW.CORE_RANGE + run.mods.beamRange).toFixed(1), 'Range');
    statBox(stats, run.mods.beams, 'Beams');
    sh.appendChild(stats);
    sh.classList.remove('hidden');
    snd('open');
  }
  function closeBtn() {
    const b = document.createElement('button'); b.className = 'btn icon'; b.textContent = '✕'; b.setAttribute('aria-label', 'Close');
    b.onclick = () => { snd('click'); closeSheet(); };
    return b;
  }
  function statBox(parent, v, l) { const d = document.createElement('div'); d.innerHTML = '<b></b><small></small>'; d.firstChild.textContent = v; d.lastChild.textContent = l; parent.appendChild(d); }
  function fmt(v) { return v >= 100 ? Math.round(v) : (Math.round(v * 10) / 10); }
  function tierName(s) {
    const d = TW.TOWERS[s.type];
    return s.tier === 2 ? d.branches[s.br].name : d.name + (s.tier ? ' II' : '');
  }
  function renderSheet() {
    const s = ui.sel;
    if (!s || !run || run.structs[s.id] !== s) { closeSheet(); return; }
    const key = s.id + '|' + s.tier + '|' + s.stone + '|' + s.prio + '|' + Math.floor(run.res.g) + '|' + run.res.w + '|' + run.res.s + '|' + run.res.c + '|' + run.phase + '|' + (s.kills | 0);
    if (key === sheetKey) return;
    sheetKey = key;
    const sh = $('sheet'); sh.innerHTML = '';
    const day = run.phase === 'day';
    const head = document.createElement('div'); head.className = 'sh-head';
    const ic = document.createElement('div'); ic.className = 'ic';
    const nm = document.createElement('div'); nm.className = 'nm'; nm.innerHTML = '<b></b><small></small>';
    const stats = document.createElement('div'); stats.className = 'sh-stats';
    const row = document.createElement('div'); row.className = 'sh-row';
    if (s.kind === 'wall') {
      ic.appendChild(Art.iconCanvas('wall', 0, 46, { stone: s.stone }));
      nm.firstChild.textContent = s.stone ? 'Stone Wall' : 'Palisade';
      nm.lastChild.textContent = 'Blocks the path. Shadows must go around — or smash through.';
      statBox(stats, Math.ceil(s.hp) + '/' + s.maxHp, 'HP');
      statBox(stats, s.stone ? 'Stone' : 'Wood', 'Type');
      if (!s.stone) {
        const c = run.upgradeCost(s);
        const b = document.createElement('button'); b.className = 'btn primary';
        b.innerHTML = '<span>Reinforce</span><span class="costs"></span>'; costHTML(b.lastChild, c, true);
        if (!run.afford(c)) b.classList.add('off');
        b.onclick = () => doUpgrade(s, 0, c);
        row.appendChild(b);
      }
    } else if (s.kind === 'harv') {
      ic.appendChild(Art.iconCanvas('harv', 0, 46));
      nm.firstChild.textContent = 'Harvester';
      nm.lastChild.textContent = 'Collects from adjacent trees, boulders and crystals every dawn.';
      const y = run.harvYield(s.i);
      statBox(stats, '+' + y.w, 'Wood'); statBox(stats, '+' + y.s, 'Stone'); statBox(stats, '+' + y.c, 'Crystal');
    } else {
      const d = TW.TOWERS[s.type], st = s.st;
      ic.appendChild(Art.iconCanvas('tower', s.type, 46, { tier: s.tier, br: s.br }));
      nm.firstChild.textContent = tierName(s);
      nm.lastChild.textContent = (s.tier === 2 ? d.branches[s.br].blurb : d.blurb) + ' · Tier ' + (s.tier + 1);
      const next = s.tier === 0 ? run.statsFor(s.type, 1, 0, s.buf) : null;
      const arrow = (a, b) => (b != null && Math.abs(b - a) > 0.05 ? fmt(a) + '→' + fmt(b) : fmt(a));
      if (d.mode === 'aura') {
        statBox(stats, '+' + Math.round(st.aura * 100) + '%', 'Damage aura');
        if (st.auraRate) statBox(stats, '+' + Math.round(st.auraRate * 100) + '%', 'Rate aura');
        if (st.auraRange) statBox(stats, '+' + Math.round(st.auraRange * 100) + '%', 'Range aura');
        statBox(stats, fmt(st.range), 'Radius');
      } else {
        statBox(stats, arrow(st.dmg, next && next.dmg), d.mode === 'flame' ? 'Burst' : 'Damage');
        statBox(stats, arrow(st.rate, next && next.rate) + '/s', 'Rate');
        statBox(stats, arrow(st.range, next && next.range), 'Range');
        if (st.burn) statBox(stats, fmt(st.burn) + '/s', 'Burn');
        if (st.slow) statBox(stats, Math.round(st.slow * 100) + '%', 'Slow');
        if (st.chains) statBox(stats, st.chains, 'Chains');
        if (st.splash) statBox(stats, fmt(st.splash), 'Splash');
        if (st.pull) statBox(stats, fmt(st.pull), 'Pull');
        if (st.reveal) statBox(stats, 'Yes', 'Reveals');
        if (!st.air) statBox(stats, 'No', 'Hits air');
        statBox(stats, s.kills | 0, 'Kills');
      }
      if (s.buf && s.buf.dmg > 0) statBox(stats, '+' + Math.round(s.buf.dmg * 100) + '%', 'Shrine');
      // upgrades
      if (s.tier === 0) {
        const c = run.upgradeCost(s, 0);
        const b = document.createElement('button'); b.className = 'btn primary';
        b.innerHTML = '<span>Upgrade</span><span class="costs"></span>'; costHTML(b.lastChild, c, true);
        if (!run.afford(c)) b.classList.add('off');
        b.onclick = () => doUpgrade(s, 0, c);
        row.appendChild(b);
      } else if (s.tier === 1) {
        for (let k = 0; k < 2; k++) {
          const br = d.branches[k], c = run.upgradeCost(s, k);
          const b = document.createElement('button'); b.className = 'branch' + (run.afford(c) ? '' : ' poor');
          b.appendChild(Art.iconCanvas('tower', s.type, 40, { tier: 2, br: k }));
          const bb = document.createElement('b'); bb.textContent = br.name; b.appendChild(bb);
          const sm = document.createElement('small'); sm.textContent = br.blurb; b.appendChild(sm);
          const cs = document.createElement('span'); cs.className = 'costs'; costHTML(cs, c, true); b.appendChild(cs);
          b.onclick = () => doUpgrade(s, k, c);
          row.appendChild(b);
        }
      }
    }
    head.appendChild(ic); head.appendChild(nm); head.appendChild(closeBtn());
    sh.appendChild(head); sh.appendChild(stats);
    if (row.childNodes.length) sh.appendChild(row);
    const row2 = document.createElement('div'); row2.className = 'sh-row';
    if (s.kind === 'tower' && TW.TOWERS[s.type].mode !== 'aura' && TW.TOWERS[s.type].mode !== 'flame' && TW.TOWERS[s.type].mode !== 'pulse') {
      const b = document.createElement('button'); b.className = 'btn prio';
      b.textContent = '◎ Target: ' + TW.PRIO_NAMES[s.prio];
      b.onclick = () => { snd('click'); run.cyclePrio(s); saveRunSoon(); renderSheet(); };
      row2.appendChild(b);
    }
    const sb = document.createElement('button'); sb.className = 'btn';
    const ref = run.refundOf(s);
    sb.innerHTML = '<span>Sell</span><span class="costs"></span>'; costHTML(sb.lastChild, ref, false);
    if (!day) { sb.classList.add('off'); }
    if (sellArm === s.id && Date.now() - sellArmT < 3000) { sb.classList.add('danger'); sb.firstChild.textContent = 'Confirm sell'; }
    sb.onclick = () => {
      if (!day) { snd('deny'); toast('Sell during the day'); return; }
      if (sellArm !== s.id || Date.now() - sellArmT > 3000) { sellArm = s.id; sellArmT = Date.now(); snd('click'); sheetKey = ''; renderSheet(); return; }
      sellArm = -1;
      run.sell(s); snd('sell'); Rend.fx.puff(s.x + 0.5, s.y + 0.6, '#c8b090', 0.8); closeSheet(); saveRunSoon(); hudDirty = true;
    };
    row2.appendChild(sb);
    sh.appendChild(row2);
    sh.classList.remove('hidden');
  }
  function doUpgrade(s, br, c) {
    Audio.unlock();
    if (!run.afford(c)) { snd('deny'); toast(needText(c)); return; }
    if (run.upgrade(s, br)) {
      snd('upgrade'); haptic(20);
      Rend.fx.spark(s.x + 0.5, s.y + 0.2, '#ffcf4a', 12); Rend.fx.ring(s.x + 0.5, s.y + 0.5, 0.8, '#ffcf4a');
      sheetKey = ''; renderSheet(); saveRunSoon();
    }
  }

  // ---------------- input ----------------
  const cv = $('game');
  Rend.init(cv);
  const ptrs = new Map();
  let downCell = -1, downX = 0, downY = 0, moved = false, dragMode = '', pinch = null, lastPan = null;
  function lineCells(a, b) {
    const out = [];
    let x0 = a % W, y0 = (a / W) | 0;
    const x1 = b % W, y1 = (b / W) | 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, guard = 64;
    for (;;) {
      out.push(y0 * W + x0);
      if (x0 === x1 && y0 === y1 || guard-- <= 0) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return out;
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!run || screen !== null) return;
    Audio.unlock();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      dragMode = 'pinch'; ui.drag = null;
      return;
    }
    if (ptrs.size > 2) return;
    downX = e.clientX; downY = e.clientY; moved = false; dragMode = '';
    downCell = Rend.toCell(e.clientX, e.clientY);
    if (e.button === 1 || e.button === 2) { dragMode = 'pan'; lastPan = { x: e.clientX, y: e.clientY }; }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!run) return;
    if (e.pointerType === 'mouse' && ptrs.size === 0) { ui.hover = Rend.toCell(e.clientX, e.clientY); return; }
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dragMode === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch.d > 10) Rend.zoomAt(d / pinch.d, mx, my);
      Rend.pan(mx - pinch.mx, my - pinch.my);
      pinch.d = d; pinch.mx = mx; pinch.my = my;
      if (ui.radialCell >= 0) closeRadial();
      return;
    }
    if (dragMode === 'pan') { Rend.pan(e.clientX - lastPan.x, e.clientY - lastPan.y); lastPan = { x: e.clientX, y: e.clientY }; return; }
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (!moved && dist > Math.max(10, Rend.tileSize() * 0.4)) {
      moved = true;
      if (run.phase === 'day' && downCell >= 0 && run.cellFree(downCell)) {
        dragMode = 'wall'; closeRadial(); closeSheet(); cancelPreview();
      } else if (Rend.zoomed()) { dragMode = 'pan'; lastPan = { x: e.clientX, y: e.clientY }; }
    }
    if (dragMode === 'wall') {
      let c = Rend.toCell(e.clientX, e.clientY);
      if (c < 0) return;
      // snap to a straight / diagonal line from the start
      const x0 = downCell % W, y0 = (downCell / W) | 0, x1 = c % W, y1 = (c / W) | 0;
      const ax = Math.abs(x1 - x0), ay = Math.abs(y1 - y0);
      if (ax > ay * 2) c = y0 * W + x1; else if (ay > ax * 2) c = y1 * W + x0;
      else { const m = Math.min(ax, ay); c = (y0 + Math.sign(y1 - y0) * m) * W + x0 + Math.sign(x1 - x0) * m; }
      ui.drag = lineCells(downCell, c);
    } else if (dragMode === 'pan') { Rend.pan(e.clientX - lastPan.x, e.clientY - lastPan.y); lastPan = { x: e.clientX, y: e.clientY }; }
  });
  function endPtr(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (dragMode === 'pinch') { if (ptrs.size === 0) dragMode = ''; return; }
    if (ptrs.size > 0) return;
    if (dragMode === 'wall') {
      const cells = ui.drag || []; ui.drag = null; dragMode = '';
      const free = cells.filter((c) => run.cellFree(c));
      if (free.length) beginPreview('wall', null, free);
      return;
    }
    if (dragMode === 'pan') { dragMode = ''; return; }
    dragMode = '';
    if (!moved && e.type === 'pointerup') tapCell(Rend.toCell(e.clientX, e.clientY));
  }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { if (!run) return; e.preventDefault(); Rend.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); closeRadial(); }, { passive: false });
  cv.addEventListener('pointerleave', () => { ui.hover = -1; });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouchEnd < 300 && e.target === cv) e.preventDefault(); lastTouchEnd = now; }, { passive: false });

  function tapCell(c) {
    if (!run) return;
    const hadMenu = ui.radialCell >= 0 || ui.preview || ui.sel || ui.coreSel;
    if (c < 0) { clearUI(); return; }
    const sid = run.occ[c];
    if (sid >= 0 && run.structs[sid]) {
      if (ui.sel === run.structs[sid]) { closeSheet(); return; }
      openSheet(run.structs[sid]); return;
    }
    const t = run.terr[c];
    if (t === T.CORE) { if (ui.coreSel) closeSheet(); else openCoreSheet(); return; }
    if (TW.NODE_RES[t]) { clearUI(); gatherAt(c); return; }
    if (run.phase !== 'day') { clearUI(); return; }
    if (ui.preview && ui.preview.cells.length === 1 && ui.preview.cells[0] === c) { confirmPreview(); return; }
    if (ui.radialCell === c) { closeRadial(); return; }
    if (run.cellFree(c)) { openRadial(c); return; }
    if (run.isSpawn(c)) { clearUI(); toast('Landing beach — the shadows come ashore here'); return; }
    if (hadMenu) clearUI();
  }
  function gatherAt(c) {
    if (run.phase !== 'day') { toast('Gather during the day'); return; }
    const r = TW.NODE_RES[run.terr[c]];
    if (run.actions <= 0) { snd('deny'); toast('No gather taps left today — harvesters pay out at dawn'); return; }
    const v = run.gather(c);
    if (!v) return;
    const x = c % W + 0.5, y = ((c / W) | 0) + 0.4;
    const col = TW.RES.find((q) => q.id === r).color;
    Rend.fx.text(x, y, '+' + v + ' ' + (r === 'w' ? 'wood' : r === 's' ? 'stone' : 'crystal'), col, false);
    Rend.fx.spark(x, y, col, 6);
    snd('gather', r); haptic(8);
    saveRunSoon();
  }

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key;
    if (screen === 'boon' && /^[1-4]$/.test(k)) { pickBoon(+k - 1); return; }
    if (screen === 'pause' && (k === 'Escape' || k === 'p' || k === 'P')) { resume(); return; }
    if (screen === 'help' && (k === 'Escape' || k === 'Enter')) { $('helpClose').click(); return; }
    if (screen !== null || !run) return;
    if (k === 'Escape') { if (ui.radialCell >= 0 || ui.preview || ui.sel || ui.coreSel) clearUI(); else pause(); return; }
    if (k === 'p' || k === 'P') { pause(); return; }
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (ui.preview && k === 'Enter') { confirmPreview(); return; }
      if (run.phase === 'day') startNight(); else if (run.phase === 'night') cycleSpeed();
      return;
    }
    if (run.phase === 'night' && /^[1-3]$/.test(k)) { speed = +k; hudDirty = true; return; }
    if (DEBUG) {
      if (k === 'k' || k === 'K') { for (const en of run.enemies) if (en.active) run.kill(en, null); }
      if (k === 'n' || k === 'N') debugSkip();
      if (k === 'g' || k === 'G') { run.god = !run.god; toast('God mode ' + (run.god ? 'on' : 'off')); }
    }
  });

  function debugSkip() {
    if (!run || run.phase !== 'night') return;
    const wv = run.wave;
    wv.bossDone = true;
    for (let i = 0; i < wv.gs.length; i++) wv.gs[i].n = wv.groups[i].n;
    wv.spawned = wv.total;
    for (const en of run.enemies) if (en.active) { en.active = false; run.alive--; }
  }

  // ---------------- main loop ----------------
  let lastT = 0, fpsAcc = 0, fpsN = 0, barCovered = false;
  window.TWDBG = { run: null, fps: 0, S, show, endRun, tapCell, Rend, debugSkip, get ui() { return ui; }, get screen() { return screen; } };
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 1) { window.TWDBG.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    if (run && !paused && run.phase === 'night' && screen === null) {
      acc += dt * speed;
      let n = 0;
      while (acc >= STEP && n < 10) { run.update(STEP); acc -= STEP; n++; }
      if (n >= 10) acc = 0;
    } else acc = 0;
    Rend.frame(paused ? 0 : dt, ui);
    if (run) {
      updateHud(); if (ui.sel) renderSheet();
      const cov = !!ui.preview || !$('sheet').classList.contains('hidden');
      if (cov !== barCovered) { barCovered = cov; $('bar').classList.toggle('covered', cov); }
    }
  }

  // ---------------- lifecycle ----------------
  function onResize() {
    measure();
    if (screen === 'title') drawHero();
    if (screen === 'setup' && setupMap) drawIsland();
    if (ui.radialCell >= 0) closeRadial();
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (run && run.phase === 'day') saveRun();
      if (run && run.phase === 'night' && screen === null) pause();
      Audio.suspend();
    }
  });
  window.addEventListener('pagehide', () => { if (run && run.phase === 'day') saveRun(); });

  measure();
  show('title');
  requestAnimationFrame(loop);
  if (DEBUG && QS.get('autostart') === '1') { setupSeeds(); newRun(); }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ }
  }
})(window.TW = window.TW || {});
