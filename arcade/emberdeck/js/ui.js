'use strict';
// EMBER DECK — UI core: persistence, screens, shared widgets (cards, relics, tooltips, modals), meta screens.
(function (root) {
  const ED = root.ED;
  const R = ED.Run, E = ED.Engine, Art = ED.Art, Au = ED.Audio, FX = ED.FX;
  const U = ED.UI = {};
  const $ = (id) => document.getElementById(id);
  U.$ = $;
  const KEY = 'emberdeck.v1';
  U.params = new URLSearchParams(location.search);
  U.debug = U.params.get('debug') === '1';

  // ---------------- persistence ----------------
  const DEF = () => ({
    v: 1,
    set: { sfx: true, music: true, haptics: true, shake: true, calm: false, fast: false },
    meta: { xp: 0, wins: { cast: 0, witch: 0, rogue: 0 }, unlocked: { cast: true, witch: false, rogue: false }, maxAsc: { cast: 0, witch: 0, rogue: 0 },
      runs: [], stats: { runs: 0, wins: 0, kills: 0, cards: 0, dmg: 0, elites: 0, bosses: 0, gold: 0, floors: 0, best: 0, fastest: 0, potions: 0 },
      seenCards: [], seenRelics: [], seenPotions: [], seenEnemies: [], lastChar: 'cast', lastAsc: 0 },
    run: null,
  });
  function load() {
    const d = DEF();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          if (s.set) Object.assign(d.set, s.set);
          if (s.meta) {
            for (const k of Object.keys(d.meta)) {
              if (s.meta[k] === undefined) continue;
              if (d.meta[k] && typeof d.meta[k] === 'object' && !Array.isArray(d.meta[k])) Object.assign(d.meta[k], s.meta[k]);
              else d.meta[k] = s.meta[k];
            }
          }
          if (s.run && s.run.v === 1 && s.run.deck && ED.CHARS[s.run.char]) d.run = s.run;
        }
      }
    } catch (e) { /* storage unavailable: play without saving */ }
    return d;
  }
  const S = U.S = load();
  U.save = function () {
    try {
      if (S.run && S.run.combat) S.run.combat.ev = [];
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) { /* ignore */ }
  };
  U.run = () => S.run;
  U.haptic = function (p) { if (!S.set.haptics) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };
  U.speed = () => (S.set.fast ? 0.55 : 1) * (S.set.calm ? 0.8 : 1);
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms * U.speed()));
  U.applySettings = function () {
    Au.sfxOn = S.set.sfx; Au.musicOn = S.set.music;
    Au.setSfx(S.set.sfx); Au.setMusic(S.set.music);
    FX.calm = S.set.calm; FX.shakeOn = S.set.shake;
    document.body.classList.toggle('calm', !!S.set.calm);
  };

  // ---------------- small helpers ----------------
  U.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  U.el = function (tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  U.on = function (el, fn, sound) {
    el.addEventListener('click', (ev) => { Au.unlock(); if (sound !== false) Au.play(sound || 'click'); fn(ev); });
  };
  let toastT = 0;
  U.toast = function (msg, ms) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms || 1900);
  };
  U.banner = function (html, cls, ms) {
    const b = $('banner');
    b.innerHTML = '<div class="' + (cls || '') + '">' + html + '</div>';
    b.classList.remove('hidden');
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.add('hidden'), (ms || 1100) * U.speed() + 200);
    const d = b.firstChild; d.style.animationDuration = ((ms || 1100) * U.speed() / 1000) + 's';
  };

  // ---------------- tooltip ----------------
  let tipFor = null;
  U.tip = function (anchor, html) {
    const t = $('tip');
    if (tipFor === anchor && !t.classList.contains('hidden')) { U.hideTip(); return; }
    tipFor = anchor;
    t.innerHTML = html; t.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(10, Math.min(innerWidth - tw - 10, x));
    let y = r.top - th - 8;
    if (y < 10) y = r.bottom + 8;
    if (y + th > innerHeight - 10) y = Math.max(10, innerHeight - th - 10);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  };
  U.hideTip = function () { $('tip').classList.add('hidden'); tipFor = null; };
  document.addEventListener('pointerdown', (e) => { if (tipFor && !tipFor.contains(e.target)) U.hideTip(); }, true);
  U.statusTip = function (k, n) {
    const d = ED.STATUS[k];
    if (!d) return '';
    return '<div class="tt" style="color:' + d.col + '">' + Art.icon(d.icon) + '<b>' + d.n + (n !== undefined && d.show !== false ? ' ' + n : '') + '</b></div>' + U.esc(d.d(n || 1));
  };
  U.relicTip = function (k, R) {
    const d = ED.RELICS[k];
    const rn = { starter: 'Starter', common: 'Common', uncommon: 'Uncommon', rare: 'Rare', boss: 'Boss', shop: 'Shop', special: 'Special' }[d.r];
    return '<div class="tt">' + Art.icon(d.art) + '<b>' + U.esc(d.n) + '</b></div><div class="rar" style="color:' + U.rarCol(d.r) + '">' + rn + ' relic</div><p>' + U.esc(d.d) + '</p>' + (R && d.counter ? '<p>Counter: ' + (R.c || 0) + '</p>' : '');
  };
  U.potionTip = function (k) {
    const d = ED.POTIONS[k];
    return '<div class="tt" style="color:' + d.col + '">' + Art.icon('potion') + '<b>' + U.esc(d.n) + '</b></div><p>' + U.esc(d.d) + '</p>';
  };
  U.rarCol = (r) => ({ common: '#e8dccf', uncommon: '#8fd4ff', rare: '#ffcf4a', boss: '#ff8a6a', starter: '#ffb36b', shop: '#7be0a0', special: '#ffcf4a' }[r] || '#ccc');
  U.relicEl = function (k, cls, R) {
    const d = ED.RELICS[k];
    const b = U.el('button', (cls || 'relic') + ' r-' + d.r, Art.icon(d.art) + (R && d.counter ? '<em>' + (R.c || 0) + '</em>' : ''));
    b.setAttribute('aria-label', d.n);
    b.dataset.relic = k;
    return b;
  };

  // ---------------- cards ----------------
  const TYPE = { atk: 'Attack', skl: 'Skill', pow: 'Power', status: 'Status', curse: 'Curse' };
  const KW = Object.keys(ED.KEYWORDS).concat(['ALL']);
  const KWRE = new RegExp('\\b(' + KW.join('|') + ')(s?)\\b', 'g');
  U.fmtText = function (txt) {
    let s = U.esc(txt).replace(KWRE, (m, w, pl) => (w === 'ALL' ? '<em>ALL</em>' : '<em>' + w + pl + '</em>'));
    s = s.replace(/⟪([+-]?)([^⟫]*)⟫/g, (m, sign, v) => '<b' + (sign === '+' ? ' class="up"' : sign === '-' ? ' class="dn"' : '') + '>' + v + '</b>');
    return s;
  };
  U.cardHTML = function (c, run, tgt) {
    const d = ED.CARDS[c.k];
    const base = d.cost[c.up ? 1 : 0];
    let cost = base, ccls = '';
    if (run && run.combat && !d.unp) {
      cost = E.cost(run, c);
      if (cost < base) ccls = 'dn'; else if (cost > base) ccls = 'upc';
      if (run.combat.phase === 'player' && cost > run.combat.energy) ccls += ' na';
    }
    const txt = E.cardText(run && run.combat ? run : null, c, tgt);
    return (d.unp ? '' : '<div class="cost ' + ccls + '">' + cost + '</div>') +
      '<div class="nm">' + U.esc(d.n) + (c.up ? '+' : '') + '</div>' +
      '<div class="art">' + Art.icon(d.art) + '</div>' +
      '<div class="ty">' + TYPE[d.t] + (d.r === 'uncommon' || d.r === 'rare' ? '<i></i>' : '') + '</div>' +
      '<div class="tx"><span>' + U.fmtText(txt) + '</span></div>';
  };
  U.cardEl = function (c, o) {
    o = o || {};
    const d = ED.CARDS[c.k];
    const e = U.el(o.tag || 'div', 'card c-' + d.c + ' t-' + d.t + ' r-' + d.r + (c.up ? ' up' : '') + (d.unp ? ' unp' : '') + (o.cls ? ' ' + o.cls : ''));
    e.innerHTML = U.cardHTML(c, o.run, o.tgt);
    if (c.u) e.dataset.u = c.u;
    e.dataset.k = c.k;
    if (o.tag === 'button') e.setAttribute('aria-label', d.n + (c.up ? '+' : '') + '. ' + E.cardText(null, c).replace(/[⟪⟫]/g, ''));
    return e;
  };
  U.kwHTML = function (c) {
    return E.keywordsOf(c).slice(0, 4).map((k) => '<div><b>' + k + '</b>' + U.esc(ED.KEYWORDS[k]) + '</div>').join('');
  };
  // A card shown large in a modal, with keyword help and an upgrade preview toggle.
  U.cardModal = function (c, opts) {
    opts = opts || {};
    let showUp = false;
    const draw = () => {
      const cc = { k: c.k, up: showUp ? 1 : c.up };
      U.modal('<div class="modal" style="--cw:min(62vw,230px);--chh:calc(min(62vw,230px)*1.42)">' +
        '<div id="cm-card" style="position:relative;width:var(--cw);height:var(--chh)"></div>' +
        '<div class="kwpanel" style="position:static;width:min(320px,100%)">' + U.kwHTML(cc) + '</div>' +
        '<div class="bar2">' + (!c.up && ED.upgradable(c) ? '<button class="btn" id="cm-up">' + (showUp ? 'Hide upgrade' : 'View upgrade') + '</button>' : '') +
        (opts.action ? '<button class="btn primary" id="cm-act">' + opts.action + '</button>' : '') + '<button class="btn" id="cm-close">Close</button></div></div>');
      const el = U.cardEl(cc, { cls: 'static' });
      $('cm-card').appendChild(el);
      if ($('cm-up')) U.on($('cm-up'), () => { showUp = !showUp; draw(); });
      if ($('cm-act')) U.on($('cm-act'), () => { U.closeModal(); opts.onAction(); }, false);
      U.on($('cm-close'), () => { U.closeModal(); if (opts.onClose) opts.onClose(); });
    };
    draw();
  };

  // ---------------- modal ----------------
  U.modal = function (html, cls) {
    const o = $('overlay');
    o.className = cls || '';
    o.innerHTML = html;
    o.classList.remove('hidden');
    Au.duck(true);
    return o;
  };
  U.closeModal = function () { const o = $('overlay'); o.classList.add('hidden'); o.innerHTML = ''; Au.duck(false); };
  U.modalOpen = () => !$('overlay').classList.contains('hidden');

  // ---------------- screens ----------------
  const SCREENS = ['title', 'chars', 'run', 'end', 'comp', 'records', 'settings'];
  U.screen = null;
  U.show = function (id) {
    U.hideTip();
    for (const s of SCREENS) $('s-' + s).classList.toggle('hidden', s !== id);
    U.screen = id;
    FX.setAmbient(id === 'title' || id === 'chars' || id === 'end');
    const el = $('s-' + id); if (el && id !== 'run') el.scrollTop = 0;
    if (id === 'title') { refreshTitle(); Au.setMode('menu'); U.drawBg(0); }
    if (id === 'chars') buildChars();
    if (id === 'settings') buildSettings($('setList'));
    if (id === 'comp') buildComp();
    if (id === 'records') buildRecords();
  };
  document.querySelectorAll('.backBtn').forEach((b) => U.on(b, () => U.show(b.dataset.to)));

  let bgKey = '';
  U.drawBg = function (act) {
    const key = act + ':' + innerWidth + 'x' + innerHeight;
    if (key === bgKey) return;
    bgKey = key;
    Art.drawBackground($('bg'), act || 1, innerWidth, innerHeight);
  };
  root.addEventListener('resize', () => { bgKey = ''; const r = S.run; U.drawBg(U.screen === 'run' && r ? r.act : 1); });

  // ---------------- title ----------------
  function drawEmblem() {
    const cv = $('t-emblem');
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = 150 * dpr; cv.height = 150 * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gr = g.createRadialGradient(75, 70, 4, 75, 75, 74);
    gr.addColorStop(0, 'rgba(255,150,60,0.6)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 150, 150);
    const cols = [['#2f6f95', '#142b40'], ['#95392b', '#3e1214'], ['#237a5c', '#0e2e26']];
    [-1, 0, 1].forEach((s, i) => {
      g.save(); g.translate(75 + s * 22, 118); g.rotate(s * 0.32);
      const cg = g.createLinearGradient(-22, -76, 22, 0); cg.addColorStop(0, cols[i][0]); cg.addColorStop(1, cols[i][1]);
      g.fillStyle = cg; g.strokeStyle = '#e8d8c0'; g.lineWidth = 2.5;
      g.beginPath(); if (g.roundRect) g.roundRect(-22, -76, 44, 64, 6); else g.rect(-22, -76, 44, 64); g.fill(); g.stroke();
      g.restore();
    });
    g.save(); g.shadowColor = '#ff8a3d'; g.shadowBlur = 24;
    const fg = g.createLinearGradient(75, 10, 75, 80); fg.addColorStop(0, '#fff3c0'); fg.addColorStop(0.5, '#ffad4a'); fg.addColorStop(1, '#e0461a');
    g.fillStyle = fg;
    g.beginPath(); g.moveTo(75, 8); g.bezierCurveTo(95, 34, 100, 50, 90, 66); g.bezierCurveTo(84, 78, 66, 80, 60, 68); g.bezierCurveTo(50, 50, 64, 40, 66, 26); g.bezierCurveTo(70, 34, 72, 40, 76, 42); g.bezierCurveTo(80, 30, 78, 20, 75, 8); g.fill();
    g.restore();
    g.fillStyle = '#fff8e0'; g.beginPath(); g.ellipse(76, 60, 7, 11, 0, 0, Math.PI * 2); g.fill();
  }
  function refreshTitle() {
    $('t-cont').classList.toggle('hidden', !S.run);
    $('t-new').classList.toggle('primary', !S.run);
    const m = S.meta;
    const wins = m.stats.wins;
    $('t-best').textContent = m.stats.runs ? 'Embers ' + m.xp + ' · ' + m.stats.runs + ' run' + (m.stats.runs > 1 ? 's' : '') + ' · ' + wins + ' win' + (wins === 1 ? '' : 's') : 'Three acts. Three bosses. One deck.';
    if (S.run) { const r = S.run; $('t-cont').innerHTML = 'Continue<small>' + ED.CHARS[r.char].short + ' · Act ' + r.act + ' · Floor ' + r.floor + (r.asc ? ' · A' + r.asc : '') + '</small>'; }
  }
  $('t-set').innerHTML = '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>';
  U.on($('t-set'), () => U.show('settings'));
  U.on($('t-cont'), () => { U.route(); });
  U.on($('t-new'), () => {
    if (S.run) {
      U.confirm('Abandon your current run and start a new one?', 'Abandon', () => { R.abandon(S.run); U.finishRun(S.run, true); U.show('chars'); });
      return;
    }
    U.show('chars');
  });
  U.on($('t-comp'), () => U.show('comp'));
  U.on($('t-rec'), () => U.show('records'));
  U.on($('t-how'), () => U.howTo());
  $('set-how') && U.on($('set-how'), () => U.howTo());

  U.confirm = function (msg, yes, fn) {
    U.modal('<div class="modal"><div class="panel" style="text-align:center;font-size:17px;font-weight:700">' + U.esc(msg) + '</div><div class="bar2"><button class="btn" id="cf-no">Cancel</button><button class="btn primary" id="cf-yes">' + yes + '</button></div></div>');
    U.on($('cf-no'), U.closeModal);
    U.on($('cf-yes'), () => { U.closeModal(); fn(); });
  };

  // ---------------- character select ----------------
  let pickChar = S.meta.lastChar || 'cast', pickAsc = S.meta.lastAsc || 0;
  U.unlocked = (k) => !!S.meta.unlocked[k];
  const UNLOCK = { witch: { xp: 300, wins: 1 }, rogue: { xp: 900, wins: 2 } };
  function lockText(k) {
    const u = UNLOCK[k];
    return 'Locked · win ' + (u.wins === 1 ? 'a run' : u.wins + ' runs') + ' or earn ' + u.xp + ' embers (' + S.meta.xp + '/' + u.xp + ')';
  }
  U.drawPortrait = function (cv, ch, px) { Art.drawSprite(cv, ch, ED.CHARS[ch].col, px); };
  function buildChars() {
    if (!U.unlocked(pickChar)) pickChar = 'cast';
    const list = $('charList'); list.innerHTML = '';
    for (const k of ED.CHAR_ORDER) {
      const C = ED.CHARS[k];
      const ok = U.unlocked(k);
      const b = U.el('button', 'hero-card' + (k === pickChar ? ' sel' : '') + (ok ? '' : ' locked'));
      b.style.setProperty('--hc', C.col);
      const cv = document.createElement('canvas');
      b.appendChild(cv); U.drawPortrait(cv, k, 84);
      const info = U.el('div', '', '<div class="nm"></div><div class="meta"></div><div class="bl"></div>');
      info.children[0].textContent = C.n;
      info.children[1].innerHTML = '<span>' + Art.icon('hp') + ' ' + C.hp + ' HP</span><span>' + Art.icon(ED.RELICS[C.relic].art) + ' ' + ED.RELICS[C.relic].n + '</span>' + (S.meta.wins[k] ? '<span>★ ' + S.meta.wins[k] + '</span>' : '');
      info.children[2].textContent = ok ? C.blurb : '';
      if (!ok) info.appendChild(U.el('div', 'lk', U.esc(lockText(k))));
      b.appendChild(info);
      U.on(b, () => {
        if (!ok) { Au.play('deny'); U.toast(lockText(k)); return; }
        pickChar = k; pickAsc = Math.min(pickAsc, S.meta.maxAsc[k] || 0); buildChars();
      }, 'select');
      list.appendChild(b);
    }
    refreshAsc();
    const sd = U.params.get('seed');
    if (sd && !$('seedIn').value) $('seedIn').value = ED.cleanSeed(sd);
  }
  function refreshAsc() {
    const max = S.meta.maxAsc[pickChar] || 0;
    pickAsc = ED.clamp(pickAsc, 0, max);
    $('asc-n').textContent = 'Ascension ' + pickAsc + (max ? '  (max ' + max + ')' : '');
    $('asc-d').textContent = pickAsc ? ED.ASCENSION.slice(1, pickAsc + 1).length + ' modifiers · newest: ' + ED.ASCENSION[pickAsc] : (max ? 'No modifiers.' : 'Win a run to unlock Ascension.');
    $('asc-dn').disabled = pickAsc <= 0; $('asc-up').disabled = pickAsc >= max;
  }
  U.on($('asc-dn'), () => { pickAsc--; refreshAsc(); });
  U.on($('asc-up'), () => { pickAsc++; refreshAsc(); });
  U.on($('embark'), () => {
    const seed = ED.cleanSeed($('seedIn').value);
    S.meta.lastChar = pickChar; S.meta.lastAsc = pickAsc;
    S.run = R.newRun(pickChar, pickAsc, seed || null);
    $('seedIn').value = '';
    U.save();
    U.route();
  }, 'relic');

  // ---------------- settings ----------------
  const SETS = [['sfx', 'Sound effects'], ['music', 'Ambient music'], ['haptics', 'Haptics (vibration)'], ['shake', 'Screen shake'], ['fast', 'Fast animations'], ['calm', 'Reduced motion']];
  function buildSettings(list) {
    list.innerHTML = '';
    for (const [k, label] of SETS) {
      const b = U.el('button', 'btn toggle', '<span></span><span class="sw"></span>');
      b.firstChild.textContent = label;
      b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
      b.addEventListener('click', () => {
        Au.unlock();
        S.set[k] = !S.set[k];
        b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
        U.applySettings(); U.save();
        if (k === 'haptics' && S.set.haptics) U.haptic(25);
        Au.play('click');
        if (k === 'calm') FX.setAmbient(U.screen !== 'run');
      });
      list.appendChild(b);
    }
  }
  U.buildSettings = buildSettings;
  let resetArm = 0;
  U.on($('resetBtn'), () => {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('resetBtn').textContent = 'Tap again to erase everything'; return; }
    const set = S.set, d = DEF();
    S.meta = d.meta; S.run = null; S.set = set;
    U.save(); $('resetBtn').textContent = 'Reset progress'; U.toast('Progress erased');
  });

  // ---------------- how to play ----------------
  U.howTo = function () {
    const st = ['str', 'dex', 'vuln', 'weak', 'frail', 'poison', 'burn', 'thorns', 'artifact'].map((k) => '<span style="color:' + ED.STATUS[k].col + '">' + Art.icon(ED.STATUS[k].icon) + '</span><span><b>' + ED.STATUS[k].n + '</b> — ' + U.esc(ED.STATUS[k].d(1).replace(' for 1 turn', '').replace('1 more', 'more').replace('Negates the next 1 debuff', 'Negates the next debuff')) + '</span>').join('');
    U.modal('<div class="modal"><h2>How to play</h2><div class="scroll"><div class="panel howto">' +
      '<h4>The run</h4><p>Climb three acts. Each act is a branching map: tap a glowing node to travel. Fights, <b>elites</b> (harder, drop relics), <b>campfires</b> (heal or upgrade), <b>shops</b>, <b>?</b> events and treasure lead to the act <b>boss</b>.</p>' +
      '<h4>Combat</h4><p>Each turn you get <b>3 Energy</b> and draw <b>5 cards</b>. The number in a card\'s corner is its Energy cost. Enemies show their <b>intent</b> above their heads, so you know what is coming. <b>Block</b> soaks damage and fades at the start of your next turn.</p>' +
      '<h4>Controls</h4><p><b>Tap a card</b> to lift it, then <b>tap an enemy</b> to play it (or tap the card again for cards with no target). You can also <b>drag a card up</b> onto an enemy, or anywhere above your hand. Tap any icon, status or intent for an explanation.</p>' +
      '<p>Keyboard: <b>1–0</b> pick a card · <b>←/→</b> choose target · <b>Enter</b> play · <b>E</b> end turn · <b>D</b> deck · <b>Esc</b> cancel / menu.</p>' +
      '<h4>Growing stronger</h4><p>After fights pick <b>1 of 3 cards</b> (or skip to keep your deck lean). Relics give lasting powers; potions are one-shot rescues (3 slots). Upgrades add a <b>+</b> and boost a card.</p>' +
      '<h4>Status effects</h4><div class="stl">' + st + '</div>' +
      '<h4>Progress</h4><p>Runs earn <b>embers</b> that unlock the Ember Witch and Tide Rogue (or win a run). Winning unlocks the next <b>Ascension</b>. Your run is saved after every action, so you can close the app any time.</p>' +
      '</div></div><div class="bar2"><button class="btn primary" id="how-ok">Got it</button></div></div>');
    U.on($('how-ok'), U.closeModal);
  };

  // ---------------- compendium ----------------
  let compTab = 'cast';
  const seenSet = (k) => new Set(S.meta[k].concat(S.run ? S.run[k] || [] : []));
  function buildComp() {
    const tabs = [['cast', 'Castaway'], ['witch', 'Ember Witch'], ['rogue', 'Tide Rogue'], ['neutral', 'Colorless'], ['relics', 'Relics'], ['potions', 'Potions'], ['beasts', 'Bestiary']];
    const tb = $('comp-tabs'); tb.innerHTML = '';
    for (const [k, l] of tabs) { const b = U.el('button', 'tab' + (k === compTab ? ' on' : ''), l); U.on(b, () => { compTab = k; buildComp(); }); tb.appendChild(b); }
    const box = $('comp-list'); box.innerHTML = '';
    if (['cast', 'witch', 'rogue', 'neutral'].includes(compTab)) {
      const seen = seenSet('seenCards');
      const order = { starter: 0, common: 1, uncommon: 2, rare: 3, special: 4 };
      const list = ED.CARD_LIST.filter((c) => c.c === compTab || (compTab === 'neutral' && ['token', 'status', 'curse'].includes(c.c))).sort((a, b) => order[a.r] - order[b.r] || a.n.localeCompare(b.n));
      const n = list.filter((c) => seen.has(c.k) || c.r === 'starter' || c.r === 'special').length;
      $('comp-n').textContent = n + '/' + list.length;
      const g = U.el('div', 'grid');
      g.style.setProperty('--cw', 'min(29vw, 120px)'); g.style.setProperty('--chh', 'calc(min(29vw, 120px) * 1.42)');
      for (const d of list) {
        const known = seen.has(d.k) || d.r === 'starter' || d.r === 'special';
        const el = known ? U.cardEl({ k: d.k, up: 0 }, { cls: 'static', tag: 'button' }) : U.el('button', 'card static back');
        if (known) U.on(el, () => U.cardModal({ k: d.k, up: 0 }));
        else U.on(el, () => U.toast('Not yet discovered'));
        g.appendChild(el);
      }
      box.appendChild(g);
    } else if (compTab === 'relics') {
      const seen = seenSet('seenRelics');
      const list = Object.values(ED.RELICS);
      $('comp-n').textContent = list.filter((r) => seen.has(r.k)).length + '/' + list.length;
      const g = U.el('div', 'rgrid');
      for (const r of list) {
        const known = seen.has(r.k);
        const b = U.el('button', 'rcell' + (known ? '' : ' unseen'));
        const ic = U.relicEl(r.k, 'bigrelic'); b.appendChild(ic);
        b.appendChild(U.el('div', '', '<b>' + (known ? U.esc(r.n) : '???') + '</b><small>' + r.r + '</small>'));
        U.on(b, () => (known ? U.tip(b, U.relicTip(r.k)) : U.toast('Not yet discovered')));
        g.appendChild(b);
      }
      box.appendChild(g);
    } else if (compTab === 'potions') {
      const seen = seenSet('seenPotions');
      const list = Object.values(ED.POTIONS);
      $('comp-n').textContent = list.filter((r) => seen.has(r.k)).length + '/' + list.length;
      const g = U.el('div', 'rgrid');
      for (const p of list) {
        const known = seen.has(p.k);
        const b = U.el('button', 'rcell' + (known ? '' : ' unseen'), '<span class="bigrelic" style="--rc:' + p.col + '">' + Art.icon('potion') + '</span><div><b>' + (known ? U.esc(p.n) : '???') + '</b><small>' + p.r + '</small></div>');
        U.on(b, () => (known ? U.tip(b, U.potionTip(p.k)) : U.toast('Not yet discovered')));
        g.appendChild(b);
      }
      box.appendChild(g);
    } else {
      const seen = seenSet('seenEnemies');
      const list = Object.values(ED.ENEMIES);
      $('comp-n').textContent = list.filter((r) => seen.has(r.k)).length + '/' + list.length;
      const g = U.el('div', 'rgrid');
      for (const e of list) {
        const known = seen.has(e.k);
        const b = U.el('button', 'rcell' + (known ? '' : ' unseen'));
        const cv = document.createElement('canvas'); b.appendChild(cv); Art.drawSprite(cv, e.art, e.col, 44);
        if (!known) cv.style.filter = 'brightness(0)';
        b.appendChild(U.el('div', '', '<b>' + (known ? U.esc(e.n) : '???') + '</b><small>Act ' + e.act + (e.boss ? ' boss' : e.elite ? ' elite' : e.minion ? ' minion' : '') + '</small>'));
        U.on(b, () => {
          if (!known) { U.toast('Not yet encountered'); return; }
          const mv = Object.values(e.moves).map((m) => m.n).join(', ');
          U.tip(b, '<b>' + U.esc(e.n) + '</b><p>HP ' + e.hp[0] + (e.hp[1] !== e.hp[0] ? '–' + e.hp[1] : '') + '</p><p>Moves: ' + U.esc(mv) + '</p>');
        });
        g.appendChild(b);
      }
      box.appendChild(g);
    }
  }

  // ---------------- records ----------------
  const fmtTime = (s) => { s = Math.round(s || 0); const m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm ' + (s % 60) + 's'; };
  U.fmtTime = fmtTime;
  function buildRecords() {
    const m = S.meta, st = m.stats;
    const box = $('rec-body'); box.innerHTML = '';
    box.className = 'endbox';
    const cells = [['Runs', st.runs], ['Wins', st.wins], ['Win rate', st.runs ? Math.round(100 * st.wins / st.runs) + '%' : '—'], ['Best score', st.best], ['Embers', m.xp], ['Fastest win', st.fastest ? fmtTime(st.fastest) : '—'],
      ['Enemies slain', st.kills], ['Elites slain', st.elites], ['Bosses slain', st.bosses], ['Cards played', st.cards], ['Damage dealt', st.dmg], ['Gold earned', st.gold]];
    for (const k of ED.CHAR_ORDER) cells.push([ED.CHARS[k].short, (m.wins[k] || 0) + ' win' + (m.wins[k] === 1 ? '' : 's') + ' · A' + (m.maxAsc[k] || 0)]);
    box.innerHTML = '<div class="statgrid">' + cells.map((c) => '<div class="stat"><small>' + c[0] + '</small><b>' + c[1] + '</b></div>').join('') + '</div><h3>Run history</h3>';
    const hist = U.el('div', 'hist');
    if (!m.runs.length) hist.appendChild(U.el('p', 'sub', 'No runs yet. The tide is waiting.'));
    for (const h of m.runs) {
      const b = U.el('button', 'hrun' + (h.won ? ' win' : ''));
      const cv = document.createElement('canvas'); b.appendChild(cv); U.drawPortrait(cv, h.ch, 44);
      b.appendChild(U.el('div', '', '<b>' + (h.won ? 'Victory' : 'Fell on floor ' + h.floor) + (h.asc ? ' · A' + h.asc : '') + '</b><small>' + ED.CHARS[h.ch].short + ' · Act ' + h.act + (h.won ? '' : ' · ' + U.esc(h.killedBy || '')) + ' · seed ' + h.seed + '</small>'));
      b.appendChild(U.el('div', 'sc', String(h.score)));
      U.on(b, () => runDetail(h));
      hist.appendChild(b);
    }
    box.appendChild(hist);
  }
  function runDetail(h) {
    U.modal('<div class="modal"><h2>' + (h.won ? 'Victory' : 'Defeat') + '</h2><div class="sub">' + ED.CHARS[h.ch].n + ' · Ascension ' + h.asc + ' · ' + new Date(h.date).toLocaleDateString() + '</div>' +
      '<div class="scroll"><div class="panel"><div class="relics" style="flex-wrap:wrap" id="rd-rel"></div></div><div class="grid" id="rd-deck" style="--cw:min(27vw,104px);--chh:calc(min(27vw,104px)*1.42)"></div></div>' +
      '<div class="bar2"><button class="btn" id="rd-seed">Copy seed ' + h.seed + '</button><button class="btn primary" id="rd-ok">Close</button></div></div>');
    for (const k of h.relics || []) if (ED.RELICS[k]) { const r = U.relicEl(k); U.on(r, () => U.tip(r, U.relicTip(k)), false); $('rd-rel').appendChild(r); }
    for (const c of h.deck || []) { const [k, up] = c.split('+'); if (ED.CARDS[k]) $('rd-deck').appendChild(U.cardEl({ k, up: up !== undefined ? 1 : 0 }, { cls: 'static' })); }
    U.on($('rd-ok'), U.closeModal);
    U.on($('rd-seed'), () => { try { navigator.clipboard.writeText(h.seed); U.toast('Seed copied'); } catch (e) { U.toast('Seed: ' + h.seed); } });
  }

  // ---------------- end of run ----------------
  U.finishRun = function (run, silent) {
    const m = S.meta, st = m.stats;
    const won = run.phase === 'victory';
    const score = R.score(run);
    const secs = (Date.now() - (run.startedAt || Date.now())) / 1000;
    const unlocks = [];
    m.xp += score;
    st.runs++; if (won) st.wins++;
    st.kills += run.stats.kills || 0; st.cards += run.stats.cards || 0; st.dmg += run.stats.dmg || 0; st.elites += run.stats.elites || 0; st.bosses += run.stats.bosses || 0; st.gold += run.stats.gold || 0; st.floors += run.floor; st.potions += run.stats.potions || 0;
    st.best = Math.max(st.best, score);
    if (won && (!st.fastest || secs < st.fastest)) st.fastest = Math.round(secs);
    for (const k of ['seenCards', 'seenRelics', 'seenPotions', 'seenEnemies']) for (const x of run[k] || []) if (!m[k].includes(x)) m[k].push(x);
    if (won) {
      m.wins[run.char] = (m.wins[run.char] || 0) + 1;
      if (run.asc >= (m.maxAsc[run.char] || 0) && run.asc < ED.MAX_ASC) { m.maxAsc[run.char] = run.asc + 1; unlocks.push('Ascension ' + (run.asc + 1) + ' unlocked for the ' + ED.CHARS[run.char].short + '!'); }
    }
    const totalWins = m.wins.cast + m.wins.witch + m.wins.rogue;
    for (const k of ['witch', 'rogue']) {
      if (m.unlocked[k]) continue;
      if (m.xp >= UNLOCK[k].xp || totalWins >= UNLOCK[k].wins || (won && k === (m.unlocked.witch ? 'rogue' : 'witch'))) { m.unlocked[k] = true; unlocks.push(ED.CHARS[k].n + ' has joined you!'); }
    }
    const entry = { ch: run.char, asc: run.asc, won, floor: run.floor, act: run.act, score, killedBy: run.killedBy || '', seed: run.seed, date: Date.now(), time: Math.round(secs),
      deck: run.deck.map((c) => c.k + (c.up ? '+' : '')), relics: run.relics.map((r) => r.k) };
    if (!run.abandoned || run.floor > 1) m.runs.unshift(entry);
    m.runs = m.runs.slice(0, 30);
    S.run = null;
    U.save();
    if (!silent) showEnd(run, entry, unlocks);
  };
  function showEnd(run, h, unlocks) {
    const box = $('s-end');
    const won = h.won;
    const C = ED.CHARS[run.char];
    box.innerHTML = '<div class="endbox"><div class="endtitle ' + (won ? 'win' : 'lose') + '">' + (won ? 'VICTORY' : 'DEFEAT') + '</div>' +
      '<canvas id="end-port"></canvas><div class="sub">' + C.n + (run.asc ? ' · Ascension ' + run.asc : '') + '<br>' + (won ? 'The Drowned God sinks beneath the waves. The ember burns on.' : 'Fell on floor ' + run.floor + ' (Act ' + run.act + ') to ' + U.esc(run.killedBy || 'the tide') + '.') + '</div>' +
      unlocks.map((u) => '<div class="unlock">' + U.esc(u) + '</div>').join('') +
      '<div class="statgrid">' + [['Score', h.score], ['Floor', run.floor], ['Enemies slain', run.stats.kills], ['Elites', run.stats.elites], ['Bosses', run.stats.bosses], ['Damage dealt', run.stats.dmg], ['Cards played', run.stats.cards], ['Gold earned', run.stats.gold], ['Deck size', run.deck.length], ['Time', fmtTime(h.time)]].map((c) => '<div class="stat"><small>' + c[0] + '</small><b>' + c[1] + '</b></div>').join('') + '</div>' +
      '<div class="sub">Seed ' + run.seed + ' · +' + h.score + ' embers</div>' +
      '<div class="row2" style="max-width:420px"><button class="btn" id="end-menu">Main menu</button><button class="btn primary" id="end-again">Play again</button></div></div>';
    U.drawPortrait($('end-port'), run.char, 110);
    if (!won) $('end-port').style.filter = 'grayscale(0.7) brightness(0.7)';
    U.on($('end-menu'), () => U.show('title'));
    U.on($('end-again'), () => { pickChar = run.char; pickAsc = Math.min(run.asc, S.meta.maxAsc[run.char] || 0); U.show('chars'); });
    U.show('end');
    U.drawBg(won ? 1 : 3);
    Au.setMode('menu');
    Au.play(won ? 'bigwin' : 'lose');
    if (won) setTimeout(() => FX.burst(innerWidth / 2, innerHeight * 0.2, 90, ['#ffcf4a', '#ff8a3d', '#fff3c0'], { speed: 420, life: 1.4, grav: 300, glow: true }), 200);
  }

  drawEmblem();
})(window);
