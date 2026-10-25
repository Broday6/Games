'use strict';
// NIGHT TIDE — menus, modals, persistence, settings, boot.
(function (NT) {
  const $ = (id) => document.getElementById(id);
  const KEY = 'nighttide.v1';
  const DEF = () => ({
    v: 1, shards: 0, up: {}, chars: { pip: true }, char: 'pip',
    best: { time: 0, kills: 0, level: 0, wins: 0, runs: 0 },
    set: { sfx: true, music: true, haptics: true, shake: true, nums: true },
  });
  function load() {
    const d = DEF();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          d.shards = Math.max(0, +s.shards || 0);
          if (s.up && typeof s.up === 'object') d.up = s.up;
          if (s.chars && typeof s.chars === 'object') d.chars = Object.assign({ pip: true }, s.chars);
          if (typeof s.char === 'string') d.char = s.char;
          if (s.best) Object.assign(d.best, s.best);
          if (s.set) Object.assign(d.set, s.set);
        }
      }
    } catch (e) { /* storage unavailable: play without saving */ }
    if (!d.chars[d.char]) d.char = 'pip';
    return d;
  }
  const S = NT.save = load();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  NT.persist = persist;

  NT.haptic = function (p) {
    if (!S.set.haptics) return;
    try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ }
  };
  NT.Audio.sfxOn = S.set.sfx; NT.Audio.musicOn = S.set.music;

  let toastT = 0;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  // ---------- screens ----------
  const SCREENS = ['title', 'chars', 'shop', 'settings', 'levelup', 'chest', 'pause', 'summary'];
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('pauseBtn').classList.toggle('hidden', id !== null);
    if (id === 'title') refreshTitle();
    if (id === 'chars') buildChars();
    if (id === 'shop') buildShop();
    if (id === 'settings') buildSettings($('setList'));
    document.querySelectorAll('.shardCount').forEach((el) => { el.textContent = S.shards; });
    const el = id && $(id);
    if (el) el.scrollTop = 0;
  }
  function click(id, fn) {
    $(id).addEventListener('click', (e) => { NT.Audio.unlock(); NT.Audio.play('click'); fn(e); });
  }

  function drawPreview(cv, ch, locked) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = parseFloat(cv.style.width) || cv.width;
    cv.width = cv.height = Math.round(size * dpr);
    cv.style.width = cv.style.height = size + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr * size / 72, 0, 0, dpr * size / 72, 0, 0);
    g.clearRect(0, 0, 72, 72);
    const grd = g.createRadialGradient(36, 40, 4, 36, 40, 36);
    grd.addColorStop(0, 'rgba(255,180,90,0.35)'); grd.addColorStop(1, 'rgba(255,180,90,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 72, 72);
    NT.Art.drawBlob(g, 36, 42, 20, locked ? '#5a6078' : ch.color, ch.acc, 0.3, 0.4, 0, 0, false);
  }

  function refreshTitle() {
    $('titleShards').textContent = S.shards;
    const ch = NT.CHARS.find((c) => c.id === S.char) || NT.CHARS[0];
    $('charName').textContent = ch.name + ' · ' + ch.title.replace('The ', '');
    const pv = $('charPrev'); pv.style.width = '54px'; drawPreview(pv, ch, false);
    const b = S.best;
    $('bestLine').textContent = b.runs ? 'Best night: ' + NT.fmtTime(b.time) + ' · ' + b.kills + ' kills' + (b.wins ? ' · ' + b.wins + ' dawn' + (b.wins > 1 ? 's' : '') : '') : 'The shadows come with the tide.';
  }

  // ---------- characters ----------
  function buildChars() {
    const list = $('charList'); list.innerHTML = '';
    for (const ch of NT.CHARS) {
      const owned = !!S.chars[ch.id];
      const el = document.createElement('div');
      el.className = 'item' + (S.char === ch.id ? ' sel' : '') + (owned ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.style.width = '64px';
      el.appendChild(cv); drawPreview(cv, ch, !owned);
      const info = document.createElement('div'); info.className = 'info';
      const w = NT.WEAPONS[ch.weapon];
      info.innerHTML = '<div class="name"></div><div class="title"></div><div class="wpn"></div><div class="perk"></div>';
      info.children[0].textContent = ch.name; info.children[1].textContent = ch.title;
      info.children[2].appendChild(NT.Art.iconCanvas(ch.weapon, 20));
      info.children[2].appendChild(document.createTextNode(w.name));
      info.children[3].textContent = ch.perk;
      el.appendChild(info);
      const b = document.createElement('button'); b.className = 'btn';
      if (S.char === ch.id) { b.textContent = 'Chosen'; b.disabled = true; }
      else if (owned) { b.textContent = 'Choose'; b.onclick = () => { NT.Audio.play('click'); S.char = ch.id; persist(); buildChars(); }; }
      else {
        b.innerHTML = '<i class="shard"></i> ' + ch.cost;
        if (S.shards < ch.cost) b.classList.add('poor');
        b.onclick = () => {
          if (S.shards < ch.cost) { NT.Audio.play('deny'); toast('Need ' + (ch.cost - S.shards) + ' more Shards'); return; }
          S.shards -= ch.cost; S.chars[ch.id] = true; S.char = ch.id; persist();
          NT.Audio.play('buy'); toast(ch.name + ' joins you!'); show('chars');
        };
      }
      el.appendChild(b);
      list.appendChild(el);
    }
  }

  // ---------- shop ----------
  function buildShop() {
    const list = $('shopList'); list.innerHTML = '';
    for (const u of NT.SHOP) {
      const lv = S.up[u.id] || 0;
      const el = document.createElement('div'); el.className = 'item shopitem';
      el.innerHTML = '<div class="name"></div><div class="desc"></div><div class="pips"></div>';
      el.children[0].textContent = u.name; el.children[1].textContent = u.desc;
      for (let i = 0; i < u.max; i++) { const p = document.createElement('i'); if (i < lv) p.className = 'on'; el.children[2].appendChild(p); }
      const b = document.createElement('button'); b.className = 'btn';
      if (lv >= u.max) { b.textContent = 'Maxed'; b.disabled = true; }
      else {
        const cost = u.cost[lv];
        b.innerHTML = '<i class="shard"></i> ' + cost;
        b.onclick = () => {
          if (S.shards < cost) { NT.Audio.play('deny'); toast('Need ' + (cost - S.shards) + ' more Shards'); return; }
          S.shards -= cost; S.up[u.id] = lv + 1; persist(); NT.Audio.play('buy'); show('shop');
        };
      }
      el.appendChild(b);
      list.appendChild(el);
    }
  }

  // ---------- settings ----------
  const SETS = [['sfx', 'Sound effects'], ['music', 'Music'], ['haptics', 'Haptics (vibration)'], ['shake', 'Screen shake'], ['nums', 'Damage numbers']];
  function buildSettings(list) {
    list.innerHTML = '';
    for (const [k, label] of SETS) {
      const b = document.createElement('button');
      b.className = 'btn toggle'; b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
      b.innerHTML = '<span></span><span class="sw"></span>'; b.firstChild.textContent = label;
      b.onclick = () => {
        NT.Audio.unlock();
        S.set[k] = !S.set[k]; persist();
        b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
        if (k === 'sfx') NT.Audio.setSfx(S.set.sfx);
        if (k === 'music') NT.Audio.setMusic(S.set.music);
        if (k === 'haptics' && S.set.haptics) NT.haptic(30);
        NT.Audio.play('click');
      };
      list.appendChild(b);
    }
  }
  let resetArm = 0;
  click('resetBtn', () => {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('resetBtn').textContent = 'Tap again to erase everything'; return; }
    const set = S.set; const d = DEF(); Object.keys(S).forEach((k) => delete S[k]); Object.assign(S, d); S.set = set;
    persist(); $('resetBtn').textContent = 'Reset progress'; toast('Progress erased'); show('settings');
  });

  // ---------- level-up ----------
  let cur = null, cardsLive = false;
  function cardEl(d, i, interactive) {
    const b = document.createElement(interactive ? 'button' : 'div');
    b.className = 'card' + (d.rarityName === 'Legendary' ? ' legendary' : '');
    b.style.setProperty('--rc', d.color);
    b.style.animationDelay = (i * 0.07) + 's';
    const ic = document.createElement('div'); ic.className = 'ic'; ic.appendChild(NT.Art.iconCanvas(d.icon, 52));
    b.appendChild(ic);
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = d.name; b.appendChild(nm);
    const tg = document.createElement('div'); tg.className = 'tg';
    const t1 = document.createElement('span'); t1.textContent = d.tag; tg.appendChild(t1);
    if (d.rarityName !== 'Common') { const t2 = document.createElement('span'); t2.className = 'rar'; t2.textContent = d.rarityName; tg.appendChild(t2); }
    b.appendChild(tg);
    const ds = document.createElement('div'); ds.className = 'ds'; ds.textContent = d.desc; b.appendChild(ds);
    if (d.hint) { const hn = document.createElement('div'); hn.className = 'hn'; hn.textContent = d.hint; b.appendChild(hn); }
    if (interactive && window.matchMedia('(hover: hover)').matches) { const k = document.createElement('span'); k.className = 'key'; k.textContent = String(i + 1); b.appendChild(k); }
    return b;
  }
  function renderCards() {
    const box = $('cards'); box.innerHTML = '';
    cardsLive = false;
    cur.forEach((c, i) => {
      const d = NT.Game.describe(c);
      const b = cardEl(d, i, true);
      b.disabled = true;
      b.onclick = () => pick(i);
      box.appendChild(b);
    });
    // guard against the thumb that was steering lifting onto a card
    setTimeout(() => { cardsLive = true; box.querySelectorAll('.card').forEach((b) => { b.disabled = false; }); }, 380);
    const rb = $('rerollBtn');
    rb.textContent = 'Reroll (' + NT.G.rerolls + ')';
    rb.disabled = NT.G.rerolls <= 0;
  }
  function pick(i) {
    if (!cardsLive || !cur || !cur[i]) return;
    const c = cur[i]; cur = null; cardsLive = false;
    NT.Game.applyChoice(c);
    NT.Audio.play('pick');
    NT.haptic(15);
    $('levelup').classList.add('hidden');
    $('pauseBtn').classList.remove('hidden');
    NT.Audio.duck(false);
    NT.Game.closeModal();
  }
  click('rerollBtn', () => {
    if (!cur) return;
    const n = NT.Game.reroll();
    if (n) { cur = n; renderCards(); }
  });

  // ---------- chest ----------
  let chest = null;
  function chestLoop(now) {
    if (!chest) return;
    requestAnimationFrame(chestLoop);
    const cv = $('chestCv');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== 240 * dpr) { cv.width = 240 * dpr; cv.height = 190 * dpr; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, 240, 190);
    const t = (now - chest.t0) / 1000;
    const cx = 120, cy = 112;
    if (chest.open) {
      const ot = (now - chest.openT) / 1000;
      g.save(); g.translate(cx, cy - 10); g.rotate(t * 0.5);
      const ra = Math.min(1, ot * 2);
      for (let i = 0; i < 14; i++) {
        g.rotate(Math.PI * 2 / 14);
        g.fillStyle = 'rgba(255,214,110,' + (0.18 * ra) + ')';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-10, -120); g.lineTo(10, -120); g.closePath(); g.fill();
      }
      g.restore();
      const grd = g.createRadialGradient(cx, cy - 14, 2, cx, cy - 14, 70);
      grd.addColorStop(0, 'rgba(255,240,180,' + 0.8 * ra + ')'); grd.addColorStop(1, 'rgba(255,200,90,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 240, 190);
      for (const p of chest.parts) {
        p.vy += 260 / 60; p.x += p.vx / 60; p.y += p.vy / 60; p.l -= 1 / 60;
        if (p.l <= 0) continue;
        g.globalAlpha = Math.min(1, p.l * 2); g.fillStyle = p.c;
        g.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      g.globalAlpha = 1;
    }
    g.save();
    const shake = chest.open ? 0 : Math.sin(t * 40) * Math.min(1, t) * 2.5;
    g.translate(cx + shake, cy); g.scale(3.2, 3.2);
    NT.Art.drawChest(g, chest.open ? Math.min(1, (now - chest.openT) / 250) : 0);
    g.restore();
  }
  function openChestUI(items, boss) {
    chest = { items, boss, t0: performance.now(), open: false, openT: 0, revealed: 0, timer: 0, parts: [] };
    $('chestTitle').textContent = boss ? 'GUARDIAN\'S HOARD' : 'TREASURE!';
    $('chestItems').innerHTML = '';
    const b = $('chestBtn'); b.textContent = 'Open'; b.disabled = true;
    setTimeout(() => { if (chest) b.disabled = false; }, 350);
    show('chest');
    NT.Audio.duck(true);
    requestAnimationFrame(chestLoop);
  }
  function revealNext() {
    if (!chest) return;
    const i = chest.revealed++;
    const d = chest.items[i];
    $('chestItems').appendChild(cardEl(d, 0, false));
    NT.Audio.play(d.rarityName === 'Legendary' ? 'evo' : 'reveal', 1 + i * 0.25);
    NT.haptic(20);
    if (chest.revealed < chest.items.length) chest.timer = setTimeout(revealNext, 520);
    else { const b = $('chestBtn'); b.textContent = 'Continue'; b.disabled = false; }
  }
  function chestAction() {
    if (!chest) return;
    if (!chest.open) {
      chest.open = true; chest.openT = performance.now();
      for (let i = 0; i < 40; i++) chest.parts.push({ x: 120, y: 100, vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 220, l: 0.8 + Math.random() * 0.8, c: Math.random() < 0.5 ? '#ffcf4a' : '#fff4c0' });
      NT.Audio.play('coin');
      $('chestBtn').disabled = true;
      chest.timer = setTimeout(revealNext, 420);
      return;
    }
    if (chest.revealed < chest.items.length) { // skip ahead
      clearTimeout(chest.timer);
      while (chest.revealed < chest.items.length) revealNext();
      clearTimeout(chest.timer);
      return;
    }
    chest = null;
    $('chest').classList.add('hidden');
    $('pauseBtn').classList.remove('hidden');
    NT.Audio.duck(false);
    NT.Game.closeModal();
  }
  $('chestBtn').addEventListener('click', () => { NT.Audio.play('click'); chestAction(); });
  $('chestCv').addEventListener('click', () => { if (chest && !chest.open && !$('chestBtn').disabled) chestAction(); });

  // ---------- pause ----------
  function buildBuild(box) {
    box.innerHTML = '';
    for (const w of NT.G.weapons) {
      const id = w.evo ? NT.WEAPONS[w.id].evo : w.id;
      const b = document.createElement('div'); b.className = 'b' + (w.evo ? ' evo' : '');
      b.title = w.evo ? NT.EVOS[id].name : NT.WEAPONS[w.id].name;
      b.appendChild(NT.Art.iconCanvas(id, 34));
      const em = document.createElement('em'); em.textContent = w.evo ? '★' : w.level; b.appendChild(em);
      box.appendChild(b);
    }
    for (const id of NT.G.passiveOrder) {
      const b = document.createElement('div'); b.className = 'b'; b.title = NT.PASSIVES[id].name;
      b.appendChild(NT.Art.iconCanvas(id, 30));
      const em = document.createElement('em'); em.textContent = NT.G.passives[id]; b.appendChild(em);
      box.appendChild(b);
    }
  }
  function openPause() {
    const G = NT.G, P = NT.P;
    $('pauseStats').innerHTML = '<span>Time <b>' + NT.fmtTime(G.t) + '</b></span><span>Level <b>' + G.level + '</b></span><span>Kills <b>' + G.kills + '</b></span><span>HP <b>' + Math.ceil(P.hp) + '/' + P.maxHp + '</b></span>';
    buildBuild($('pauseBuild'));
    buildSettings($('pauseSet'));
    $('quitBtn').textContent = 'End run';
    show('pause');
    NT.Audio.duck(true);
  }
  click('resumeBtn', () => { show(null); NT.Audio.duck(false); NT.Game.resume(); });
  let quitArm = 0;
  click('quitBtn', () => {
    if (Date.now() - quitArm > 3000) { quitArm = Date.now(); $('quitBtn').textContent = 'Tap again to end the run'; return; }
    show(null); NT.Audio.duck(false); NT.Game.quit();
  });
  $('pauseBtn').addEventListener('click', () => { NT.Audio.unlock(); NT.Game.pause(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { NT.Game.pause(); NT.Audio.stopMusic(); }
    else NT.Audio.startMusic();
  });

  // ---------- summary ----------
  function showSummary(r) {
    const b = S.best;
    const newBest = r.time > b.time + 0.5;
    b.runs = (b.runs || 0) + 1;
    b.time = Math.max(b.time, r.time); b.kills = Math.max(b.kills, r.kills); b.level = Math.max(b.level, r.level);
    if (r.win) b.wins = (b.wins || 0) + 1;
    S.shards += r.shards;
    persist();
    const t = $('sumTitle');
    t.textContent = r.win ? (r.why === 'tideking' ? 'THE TIDE BREAKS' : 'DAWN BREAKS') : r.why === 'quit' ? 'YOU FLED THE BEACH' : 'THE TIDE TOOK YOU';
    t.classList.toggle('win', r.win);
    $('sumSub').textContent = (r.win ? 'You held the beach through the night as ' : 'Washed away as ') + r.char.name + '.' + (newBest && !r.win ? ' New best!' : '');
    const st = [['Time', NT.fmtTime(r.time)], ['Kills', r.kills], ['Level', r.level], ['Bosses', r.bosses + '/3'], ['Chests', r.chests], ['Best', NT.fmtTime(b.time)]];
    $('sumStats').innerHTML = '';
    for (const [k, v] of st) { const d = document.createElement('div'); d.innerHTML = '<b></b><small></small>'; d.children[0].textContent = v; d.children[1].textContent = k; $('sumStats').appendChild(d); }
    $('sumShards').textContent = r.shards;
    const box = $('sumWeapons'); box.innerHTML = '';
    const top = Math.max(1, ...r.weapons.map((w) => w.dmg));
    for (const w of r.weapons) {
      const el = document.createElement('div'); el.className = 'dmg';
      el.appendChild(NT.Art.iconCanvas(w.id, 30));
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = w.name + (w.evo ? ' ★' : ' · Lv ' + w.level); el.appendChild(nm);
      const v = document.createElement('div'); v.className = 'val'; v.innerHTML = '<span></span><small></small>';
      v.children[0].textContent = fmtNum(w.dmg); v.children[1].textContent = fmtNum(w.dps) + ' dps · ' + w.kills + ' kills';
      v.style.gridRow = '1 / span 2'; v.style.gridColumn = '3';
      el.appendChild(v);
      const bar = document.createElement('div'); bar.className = 'bar'; bar.innerHTML = '<i></i>'; bar.firstChild.style.width = (w.dmg / top * 100).toFixed(1) + '%';
      el.appendChild(bar);
      box.appendChild(el);
    }
    show('summary');
    const aff = NT.CHARS.find((c) => !S.chars[c.id] && c.cost <= S.shards);
    if (aff) setTimeout(() => toast('You can now unlock ' + aff.name + '!'), 600);
  }
  function fmtNum(n) { n = Math.round(n); return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
  click('againBtn', () => { show(null); NT.Game.start(S.char); });
  click('homeBtn', () => { NT.Game.toTitle(); show('title'); });

  // ---------- title wiring ----------
  click('playBtn', () => { show(null); NT.Game.start(S.char); NT.Audio.startMusic(); });
  click('charBtn', () => show('chars'));
  click('shopBtn', () => show('shop'));
  click('setBtn', () => show('settings'));
  document.querySelectorAll('.backBtn').forEach((b) => b.addEventListener('click', () => { NT.Audio.play('click'); NT.Game.toTitle(); show(b.dataset.to); }));

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e) => {
    NT.Audio.unlock();
    const vis = (id) => !$(id).classList.contains('hidden');
    if (vis('levelup')) {
      if (e.code === 'Digit1' || e.code === 'Numpad1') pick(0);
      else if (e.code === 'Digit2' || e.code === 'Numpad2') pick(1);
      else if (e.code === 'Digit3' || e.code === 'Numpad3') pick(2);
      else if (e.code === 'KeyR' && !$('rerollBtn').disabled) $('rerollBtn').click();
      return;
    }
    if (vis('chest')) { if ((e.code === 'Enter' || e.code === 'Space') && !$('chestBtn').disabled) { e.preventDefault(); $('chestBtn').click(); } return; }
    if (vis('pause')) { if (e.code === 'Escape' || e.code === 'KeyP') $('resumeBtn').click(); return; }
    if (vis('summary')) { if (e.code === 'Enter') $('againBtn').click(); return; }
    if (vis('title')) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); $('playBtn').click(); } return; }
    if (NT.G.mode === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) NT.Game.pause();
  });

  // ---------- gesture hygiene ----------
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerdown', () => { NT.Audio.unlock(); if (NT.Audio.ready()) NT.Audio.startMusic(); }, true);
  document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.screen')) e.preventDefault(); }, { passive: false });

  NT.UI = {
    openLevelUp(choices) { cur = choices; renderCards(); show('levelup'); NT.Audio.duck(true); },
    openChest: openChestUI,
    openPause,
    showSummary,
    toast,
  };

  NT.Game.init();
  show('title');

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ }
  }
})(window.NT);
