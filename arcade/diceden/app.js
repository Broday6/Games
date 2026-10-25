// DICE DEN — app shell: storage, profiles, wallet, lobby/menus, modals, juice.
(function () {
  'use strict';
  const R = window.DDRules, Dice = window.DDDice, Au = window.DDAudio;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qs = new URLSearchParams(location.search);
  const DEBUG = qs.get('debug') === '1';
  const SPEED = DEBUG ? 0.15 : 1;
  if (qs.has('seed')) R.setSeed(+qs.get('seed'));
  Dice.opts.speed = DEBUG ? 0.35 : 1;

  const KEY = 'diceden.v1';
  const START_CHIPS = 500, LOAN = 100, BROKE = 10;
  const GAMES = {
    liars: { name: "Liar's Dice", short: 'Liar’s Dice', min: 2, max: 6, tag: 'Bluff, bid & call “Liar!”', blurb: 'The headliner. Secret dice, bold bids, one big reveal.' },
    farkle: { name: 'Farkle', short: 'Farkle', min: 2, max: 6, tag: 'Push your luck', blurb: 'Roll six, keep scorers, bank it or risk it all.' },
    scc: { name: 'Ship, Captain & Crew', short: 'Ship & Crew', min: 2, max: 6, tag: 'One-minute pot grab', blurb: 'Roll for 6-5-4, then the best cargo takes the pot.' },
  };
  const BOT_SEED = [
    ['Mabel', 'cautious', 'teal'], ['Vinnie', 'bluffer', 'ruby'], ['Doc', 'calculator', 'violet'],
    ['Lulu', 'bluffer', 'gold'], ['Sal', 'cautious', 'sky'], ['Ada', 'calculator', 'lime'],
  ];
  const COLORS = { ruby: '#ff4d6d', teal: '#35f2dc', violet: '#a77bff', gold: '#f7c948', sky: '#5ab0ff', lime: '#a6e84a' };

  // ---------------- storage ----------------
  function blankProfile(id, name, type, personality, theme) {
    return { id, name, type, personality: personality || 'calculator', theme: theme || 'violet', chips: START_CHIPS, wins: 0, played: 0, biggestPot: 0, byGame: {}, loans: 0, brokeAt: null, created: Date.now() };
  }
  function defaults() {
    const profiles = {}, order = [];
    BOT_SEED.forEach(([n, p, t], i) => { const id = 'bot' + i; profiles[id] = blankProfile(id, n, 'bot', p, t); order.push(id); });
    const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    return {
      v: 1, session: 0, profiles, order, seats: [], game: null, lastSetup: {},
      settings: { sound: true, music: true, muted: false, haptics: true, reduced, shake: false, wild: true, farkleTarget: 10000, stake: 25, showBots: true },
    };
  }
  let DB;
  function load() {
    let d = null;
    try { const raw = localStorage.getItem(KEY); if (raw) d = JSON.parse(raw); } catch (e) { d = null; }
    const def = defaults();
    if (!d || typeof d !== 'object' || !d.profiles) d = def;
    d.settings = Object.assign({}, def.settings, d.settings || {});
    d.order = (d.order || Object.keys(d.profiles)).filter((id) => d.profiles[id]);
    Object.keys(d.profiles).forEach((id) => { if (d.order.indexOf(id) < 0) d.order.push(id); });
    d.seats = (d.seats || []).filter((id) => d.profiles[id]);
    d.lastSetup = d.lastSetup || {};
    d.session = (d.session || 0) + 1;
    DB = d;
    save();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { /* storage unavailable: play on */ } }

  // ---------------- juice ----------------
  function buzz(p) { if (!DB.settings.haptics) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * SPEED * (DB && DB.settings.reduced ? 0.6 : 1)));
  function toast(msg, ms) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('#toast').appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  function applySettings() {
    const s = DB.settings;
    document.documentElement.classList.toggle('reduced', !!s.reduced);
    Dice.opts.reduced = !!s.reduced;
    Au.configure({ sound: s.sound, music: s.music, muted: s.muted });
    $$('[data-act="mute"]').forEach((b) => { b.innerHTML = s.muted ? ICON.mute : ICON.sound; b.setAttribute('aria-label', s.muted ? 'Unmute' : 'Mute'); });
  }
  // confetti
  let fxParts = [], fxRaf = 0;
  function confetti(n) {
    const c = $('#fx'), ctx = c.getContext('2d');
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    n = DB.settings.reduced ? 40 : (n || 160);
    const cols = ['#ff4fb0', '#35f2dc', '#f7c948', '#a77bff', '#ffffff', '#4dff9a'];
    for (let i = 0; i < n; i++) {
      fxParts.push({ x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, c: cols[i % cols.length], life: 0 });
    }
    const step = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
      fxParts = fxParts.filter((p) => p.life < 220 && p.y < innerHeight + 40);
      for (const p of fxParts) {
        p.life++; p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life * 0.15))); ctx.restore();
      }
      fxRaf = fxParts.length ? requestAnimationFrame(step) : 0;
      if (!fxParts.length) ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    if (!fxRaf) fxRaf = requestAnimationFrame(step);
  }
  // chips flying between two elements
  function flyChips(from, to, n) {
    if (!from || !to) return Promise.resolve();
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    n = Math.max(1, Math.min(n || 4, 10));
    if (DB.settings.reduced) { Au.S.chip(2); return Promise.resolve(); }
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = 'flychip';
      const sx = a.left + a.width / 2 + (Math.random() - 0.5) * 16, sy = a.top + a.height / 2 + (Math.random() - 0.5) * 10;
      el.style.left = sx + 'px'; el.style.top = sy + 'px';
      document.body.appendChild(el);
      setTimeout(() => {
        el.style.transform = `translate(${b.left + b.width / 2 - sx}px, ${b.top + b.height / 2 - sy}px)`;
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 220); }, 600);
      }, 20 + i * 70);
    }
    setTimeout(() => Au.S.chip(n), 500);
    return new Promise((r) => setTimeout(r, 700 + n * 70));
  }
  // felt noise texture
  function makeFelt() {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const ctx = c.getContext('2d'), img = ctx.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 14;
      }
      ctx.putImageData(img, 0, 0);
      ctx.globalAlpha = 0.05; ctx.strokeStyle = '#000';
      for (let i = 0; i < 260; i++) { ctx.beginPath(); const x = Math.random() * 160, y = Math.random() * 160; ctx.moveTo(x, y); ctx.lineTo(x + Math.random() * 6 - 3, y + Math.random() * 6 - 3); ctx.stroke(); }
      document.documentElement.style.setProperty('--noise', `url(${c.toDataURL()})`);
    } catch (e) { /* plain felt */ }
  }

  // ---------------- shake to roll ----------------
  const Shake = {
    handler: null, listening: false, last: 0, hits: 0,
    async enable() {
      try {
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
          const r = await DeviceMotionEvent.requestPermission();
          if (r !== 'granted') { toast('Motion access denied — the Roll button still works.'); return false; }
        } else if (typeof DeviceMotionEvent === 'undefined') { toast('No motion sensor here — use the Roll button.'); return false; }
      } catch (e) { toast('Shake is unavailable — use the Roll button.'); return false; }
      this.listen();
      return true;
    },
    listen() {
      if (this.listening) return;
      this.listening = true;
      window.addEventListener('devicemotion', (e) => {
        if (!DB.settings.shake || !this.handler) return;
        const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
        const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
        const now = Date.now();
        if (m > 24) { this.hits++; if (this.hits >= 3 && now - this.last > 1200) { this.last = now; this.hits = 0; const h = this.handler; h(); } }
        else if (m < 14) this.hits = Math.max(0, this.hits - 0.2);
      });
    },
  };

  // ---------------- icons ----------------
  const sv = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    sound: sv('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    mute: sv('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
    menu: sv('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    gear: sv('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
    trophy: sv('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 20h8M9.5 17h5"/>'),
    people: sv('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>'),
    back: sv('<path d="M15 5l-7 7 7 7"/>'),
    close: sv('<path d="M6 6l12 12M18 6L6 18"/>'),
    book: sv('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
    up: sv('<path d="M6 15l6-6 6 6"/>'), down: sv('<path d="M6 9l6 6 6-6"/>'),
    trash: sv('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  };

  function muteBtn(cls) {
    const m = DB && DB.settings.muted;
    return `<button class="btn icon-btn ${cls || ''}" data-act="mute" aria-label="${m ? 'Unmute' : 'Mute'}">${m ? ICON.mute : ICON.sound}</button>`;
  }
  // ---------------- profiles ----------------
  const P = (id) => DB.profiles[id];
  const humans = () => DB.order.map(P).filter((p) => p && p.type === 'human');
  function addProfile(name, type, personality) {
    const id = (type === 'bot' ? 'b' : 'h') + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const used = DB.order.map((i) => P(i).theme);
    const theme = Dice.THEME_LIST.find((t) => used.indexOf(t) < 0) || Dice.THEME_LIST[DB.order.length % Dice.THEME_LIST.length];
    DB.profiles[id] = blankProfile(id, name, type, personality, theme);
    DB.order.push(id);
    save();
    return DB.profiles[id];
  }
  function avatar(p, size) {
    const s = size || 32;
    return `<span class="avatar" style="width:${s}px;height:${s}px;background:${COLORS[p.theme] || '#a77bff'}">${esc((p.name || '?').trim().charAt(0).toUpperCase())}</span>`;
  }
  function favGame(p) {
    let best = null, n = 0;
    for (const k in p.byGame) if (p.byGame[k].played > n) { n = p.byGame[k].played; best = k; }
    return best ? GAMES[best].short : '—';
  }
  function loanOffers() {
    return humans().filter((p) => p.chips < BROKE && p.brokeAt != null && p.brokeAt < DB.session);
  }
  function markBroke() {
    for (const id of DB.order) { const p = P(id); if (p.chips < BROKE) { if (p.brokeAt == null) p.brokeAt = DB.session; } else p.brokeAt = null; }
  }

  // ---------------- screens ----------------
  let current = 'lobby';
  function show(name) {
    current = name;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + name));
    Shake.handler = null;
    if (name !== 'game' && DD.ctrl) { DD.ctrl.destroy(); DD.ctrl = null; }
    const r = RENDER[name]; if (r) r();
    applySettings();
  }

  function gameArt(kind) {
    const vals = kind === 'liars' ? [5, 5, 1] : kind === 'farkle' ? [1, 5, 1] : [6, 5, 4];
    const th = kind === 'liars' ? 'ruby' : kind === 'farkle' ? 'ivory' : 'gold';
    return `<div class="art" data-art="${kind}" data-vals="${vals.join(',')}" data-theme="${th}"></div>`;
  }
  function fillArt(root) {
    $$('[data-art]', root).forEach((el) => {
      const vals = el.dataset.vals.split(',').map(Number);
      const wrapEl = document.createElement('div'); wrapEl.style.cssText = 'position:relative;width:86px;height:86px';
      vals.forEach((v, i) => {
        const d = new Dice.Die(i === 2 ? 40 : 48, el.dataset.theme);
        d.set(v, (i - 1) * 0.5);
        Object.assign(d.el.style, { position: 'absolute', left: [2, 34, 22][i] + 'px', top: [6, 10, 40][i] + 'px' });
        wrapEl.appendChild(d.el);
      });
      el.appendChild(wrapEl);
    });
  }

  const RENDER = {};
  RENDER.lobby = function () {
    const el = $('#scr-lobby');
    const g = DB.game;
    const seats = DB.seats.map(P).filter(Boolean);
    const offers = loanOffers();
    el.innerHTML = `
      <div class="topbar wrap"><a class="back" href="../">‹ Arcade</a><div class="title"></div>
        ${muteBtn('ghost')}
        <button class="btn icon-btn ghost" data-act="go" data-to="settings" aria-label="Settings">${ICON.gear}</button></div>
      <div class="scroll" style="flex:1"><div class="wrap">
        <div class="sign"><h1>DICE <span>DEN</span></h1><p>Neon dice lounge · play chips only</p></div>
        ${g ? `<div class="card resume"><div class="row"><div class="grow"><b>${esc(GAMES[g.kind].name)} in progress</b><div class="muted" style="font-size:14px">${esc(resumeLine(g))}</div></div></div>
          <div class="row" style="margin-top:10px"><button class="btn cyan grow" data-act="resume">Resume</button><button class="btn small" data-act="abandon">Leave table</button></div></div>` : ''}
        ${offers.map((p) => `<div class="card loan"><div class="row">${avatar(p, 40)}<div class="grow"><b>${esc(p.name)} is flat broke.</b><div class="muted" style="font-size:14px">The house will spot you ${LOAN} chips. No interest, no kneecaps, just shame.</div></div></div>
          <button class="btn pink block" style="margin-top:10px" data-act="loan" data-id="${p.id}">Take the house loan</button></div>`).join('')}
        <div class="card"><div class="row"><b class="grow">At the table</b><button class="btn small" data-act="go" data-to="players">Edit</button></div>
          <div class="table-strip" style="margin-top:8px">${seats.length ? seats.map((p) => `<div class="pchip">${avatar(p, 28)}<span>${esc(p.name)}</span><span class="chipcount">${p.chips}</span></div>`).join('') : '<span class="muted">Nobody seated yet.</span>'}</div></div>
        ${Object.keys(GAMES).map((k) => `<div class="card game-card ${k === 'liars' ? 'head' : ''}" data-act="setup" data-game="${k}" role="button" tabindex="0">
          ${gameArt(k)}<div class="grow" style="min-width:0">${k === 'liars' ? '<span class="badge">Headliner</span>' : ''}<h4>${esc(GAMES[k].name)}</h4><p>${esc(GAMES[k].blurb)}</p>
          <div class="row"><button class="btn gold small" data-act="setup" data-game="${k}">Play</button><button class="btn small" data-act="rules" data-game="${k}">${ICON.book} Rules</button></div></div></div>`).join('')}
        <div class="lobby-nav"><button class="btn" data-act="go" data-to="leaders">${ICON.trophy}Leaderboard</button>
          <button class="btn" data-act="go" data-to="players">${ICON.people}Players</button>
          <button class="btn" data-act="go" data-to="settings">${ICON.gear}Settings</button></div>
        <p class="muted" style="text-align:center;font-size:13px;margin:14px 0 4px">Play money only. Chips have no cash value and can’t be bought.</p>
      </div></div>`;
    fillArt(el);
  };
  function resumeLine(g) {
    const s = g.state;
    const pot = g.pot ? ` · pot ${g.pot}` : '';
    if (g.kind === 'liars') return `Round ${s.round} · ${R.Liars.active(s).length} players left${pot}`;
    if (g.kind === 'farkle') return `${s.players.map((p) => `${p.name} ${p.score}`).join(' · ')}${pot}`;
    return `Hand ${s.hand}${pot}`;
  }

  RENDER.players = function () {
    const el = $('#scr-players');
    el.innerHTML = `
      <div class="topbar wrap"><button class="btn icon-btn ghost" data-act="go" data-to="lobby" aria-label="Back">${ICON.back}</button><div class="title">Players</div><div style="width:44px"></div></div>
      <div class="scroll" style="flex:1"><div class="wrap">
        <p class="muted" style="margin:4px 0 6px;font-size:15px">Tap <b>Seat</b> to bring someone to the table (2–6). Humans pass the phone; bots play themselves.</p>
        <div class="card" id="plist">${DB.order.map(P).filter((p) => p.type === 'human').concat(DB.order.map(P).filter((p) => p.type === 'bot')).map(playerRow).join('')}</div>
        <div class="card"><b>Add a player</b>
          <div class="row" style="margin-top:8px"><input class="field grow" id="newname" maxlength="14" placeholder="Name" autocomplete="off"></div>
          <div class="row" style="margin-top:8px"><button class="btn gold grow" data-act="addp" data-type="human">Add human</button><button class="btn grow" data-act="addp" data-type="bot">Add bot</button></div></div>
      </div></div>`;
  };
  function playerRow(p) {
    const seated = DB.seats.indexOf(p.id) >= 0;
    const pos = DB.seats.indexOf(p.id);
    return `<div class="list-item" data-id="${p.id}">
      ${avatar(p, 38)}
      <div class="grow" style="min-width:0;flex:1">
        <div class="name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
        <div class="sub">${p.type === 'bot' ? `<span style="color:var(--cyan);font-weight:800">${esc(R.PERSONALITIES[p.personality].label)} bot</span> · ` : 'Human · '}<span class="chipcount">${p.chips}</span>${seated ? ` · seat ${pos + 1}` : ''}</div>
      </div>
      <button class="btn small" data-act="editp" data-id="${p.id}">Edit</button>
      <button class="btn small ${seated ? 'cyan' : ''}" data-act="seat" data-id="${p.id}" aria-pressed="${seated}">${seated ? 'Seated' : 'Seat'}</button>
    </div>`;
  }
  function editProfile(id) {
    const p = P(id);
    const m = openModal(`<h2>Edit player</h2>
      <label class="muted" style="font-size:14px">Name</label>
      <input class="field" id="ep-name" maxlength="14" value="${esc(p.name)}" autocomplete="off">
      <h3>Type</h3>
      <div class="seg" id="ep-type"><button data-v="human" class="${p.type === 'human' ? 'on' : ''}">Human</button><button data-v="bot" class="${p.type === 'bot' ? 'on' : ''}">Bot</button></div>
      <div id="ep-pers-wrap" class="${p.type === 'bot' ? '' : 'hidden'}"><h3>Bot personality</h3>
        <div class="seg" id="ep-pers">${Object.keys(R.PERSONALITIES).map((k) => `<button data-v="${k}" class="${p.personality === k ? 'on' : ''}">${R.PERSONALITIES[k].label}</button>`).join('')}</div>
        <p class="muted" id="ep-blurb" style="font-size:14px">${esc(R.PERSONALITIES[p.personality].blurb)}</p></div>
      <h3>Dice colour</h3>
      <div class="seg" id="ep-theme">${Dice.THEME_LIST.map((t) => `<button data-v="${t}" class="${p.theme === t ? 'on' : ''}" aria-label="${t}"><span class="avatar" style="width:24px;height:24px;background:${COLORS[t]}"></span></button>`).join('')}</div>
      <div class="actions"><button class="btn" data-act="delp" data-id="${id}">${ICON.trash} Remove</button><button class="btn gold" data-act="savep" data-id="${id}">Save</button></div>`);
    const segPick = (sel, cb) => $(sel, m).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', b.parentNode).forEach((x) => x.classList.toggle('on', x === b)); if (cb) cb(b.dataset.v); });
    segPick('#ep-type', (v) => $('#ep-pers-wrap', m).classList.toggle('hidden', v !== 'bot'));
    segPick('#ep-pers', (v) => { $('#ep-blurb', m).textContent = R.PERSONALITIES[v].blurb; });
    segPick('#ep-theme');
  }

  RENDER.leaders = function () {
    const el = $('#scr-leaders');
    const sortBy = DB.settings.lbSort || 'chips';
    let list = DB.order.map(P).filter((p) => DB.settings.showBots || p.type === 'human');
    list.sort((a, b) => (b[sortBy] - a[sortBy]) || (b.chips - a.chips));
    el.innerHTML = `
      <div class="topbar wrap"><button class="btn icon-btn ghost" data-act="go" data-to="lobby" aria-label="Back">${ICON.back}</button><div class="title">Leaderboard</div><div style="width:44px"></div></div>
      <div class="scroll" style="flex:1"><div class="wrap">
        <div class="row" style="justify-content:space-between;margin:4px 0">
          <div class="seg" id="lb-sort">${[['chips', 'Chips'], ['wins', 'Wins'], ['biggestPot', 'Big pot']].map(([k, l]) => `<button data-act="lbsort" data-k="${k}" class="${sortBy === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="row"><span class="muted" style="font-size:14px">Bots</span><button class="toggle ${DB.settings.showBots ? 'on' : ''}" data-act="lbbots" aria-label="Show bots"></button></div>
        </div>
        <div class="card">${list.length ? list.map((p, i) => `<div class="lb-row"><div class="lb-rank">${i + 1}</div>
          <div style="min-width:0"><div class="row" style="gap:8px">${avatar(p, 28)}<b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</b>${p.type === 'bot' ? '<span class="badge bot">bot</span>' : ''}</div>
          <div class="lb-stats">${p.wins}/${p.played} wins · biggest pot ${p.biggestPot} · fav: ${esc(favGame(p))}${p.loans ? ` · ${p.loans} loan${p.loans > 1 ? 's' : ''}` : ''}</div></div>
          <div class="chipcount" style="font-size:18px">${p.chips}</div></div>`).join('') : '<p class="muted">No players yet.</p>'}</div>
      </div></div>`;
  };

  RENDER.settings = function () {
    const el = $('#scr-settings');
    const s = DB.settings;
    const tg = (k, label, sub) => `<div class="list-item"><div class="grow" style="flex:1"><div class="name">${label}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="toggle ${s[k] ? 'on' : ''}" data-act="tset" data-k="${k}" aria-label="${label}" aria-pressed="${!!s[k]}"></button></div>`;
    el.innerHTML = `
      <div class="topbar wrap"><button class="btn icon-btn ghost" data-act="go" data-to="lobby" aria-label="Back">${ICON.back}</button><div class="title">Settings</div><div style="width:44px"></div></div>
      <div class="scroll" style="flex:1"><div class="wrap">
        <div class="card">
          ${tg('sound', 'Sound effects', 'Dice rattle, clacks, chips')}
          ${tg('music', 'Lounge music', 'Soft jazz loop')}
          ${tg('haptics', 'Haptics', 'Buzz on rolls and reveals')}
          ${tg('reduced', 'Reduced motion', 'Shorter, calmer animations')}
          ${tg('shake', 'Shake to roll', 'Shake the phone instead of tapping Roll (optional)')}
        </div>
        <div class="card"><div class="list-item"><div class="grow" style="flex:1"><div class="name">Players & seating</div><div class="sub">Add, rename, bots & personalities</div></div><button class="btn small" data-act="go" data-to="players">Open</button></div>
          <div class="list-item"><div class="grow" style="flex:1"><div class="name">Rules</div><div class="sub">How each game works</div></div>
          <div class="row"><button class="btn small" data-act="rules" data-game="liars">Liar’s</button><button class="btn small" data-act="rules" data-game="farkle">Farkle</button><button class="btn small" data-act="rules" data-game="scc">Ship</button></div></div></div>
        <div class="card"><div class="list-item"><div class="grow" style="flex:1"><div class="name">Reset everything</div><div class="sub">Wipes profiles, chips and saved games</div></div><button class="btn small" data-act="reset">Reset</button></div></div>
        <p class="muted" style="text-align:center;font-size:13px">Dice Den · play chips only, no real money, no purchases.</p>
      </div></div>`;
  };

  // ---------------- modal ----------------
  let modalClose = null;
  function openModal(html, opt) {
    const m = $('#modal');
    m.innerHTML = `<div class="sheet ${opt && opt.cls ? opt.cls : ''}" role="dialog" aria-modal="true">${html}</div>`;
    m.classList.remove('hidden');
    modalClose = opt && opt.onClose;
    m.onclick = (e) => { if (e.target === m && !(opt && opt.sticky)) closeModal(); };
    return $('.sheet', m);
  }
  function closeModal() {
    const m = $('#modal');
    if (m.classList.contains('hidden')) return;
    m.classList.add('hidden'); m.innerHTML = '';
    const c = modalClose; modalClose = null; if (c) c();
  }

  // ---------------- rules ----------------
  function fi(v, t) { return `<img src="${Dice.faceIcon(v, 44, t)}" alt="${v}">`; }
  const RULES = {
    liars: () => `<h2>Liar’s Dice</h2><div class="rules">
      <p>Everyone shakes five dice under a cup and peeks only at their own.</p>
      <ul><li><b>Bid</b> on <i>all</i> the dice on the table: “four 5s” means you claim at least four dice show 5.</li>
      <li>Each bid must go up: more dice, or the same number of a higher face.</li>
      <li><b>Ones are wild</b> (if on): they count as every face. Switching to ones you may halve the count (round up); switching back, double it and add one. No opening on ones.</li>
      <li>Think the last bid is too high? Call <b>Liar!</b> Cups up. If there are fewer than bid, the bidder loses a die; otherwise the caller does.</li>
      <li>Think it’s exactly right? Call <b>Spot on</b>. Exactly right wins you a die back (max 5); anything else costs you one.</li>
      <li>The loser starts the next round. Last player with dice takes the pot.</li></ul>
      <p class="muted">Pass-and-play: when it’s your turn the phone asks for you by name, so nobody sees your dice.</p></div>`,
    farkle: () => `<h2>Farkle</h2><div class="rules">
      <p>Roll six dice. Tap the scoring dice you want to set aside, then <b>Bank</b> your turn points or <b>Roll</b> the rest to push your luck.</p>
      <ul><li>Each roll you must keep at least one scoring die.</li>
      <li>Roll nothing that scores? <b>Farkle!</b> You lose this turn’s points.</li>
      <li><b>Hot dice:</b> score all six and you may roll all six again.</li>
      <li>First to the target triggers the last round: everyone else gets one more turn. Highest score wins the pot.</li></ul>
      ${scoringTable()}</div>`,
    scc: () => `<h2>Ship, Captain & Crew</h2><div class="rules">
      <p>A quick pot game. Everyone antes, then takes a turn of up to <b>three rolls</b> of five dice.</p>
      <ul><li>You need a <b>6 (ship)</b>, then a <b>5 (captain)</b>, then a <b>4 (crew)</b> — in that order. They lock in automatically.</li>
      <li>Once you have all three, the other two dice are your <b>cargo</b>: their total is your score.</li>
      <li>With rolls left you may keep the cargo or reroll both cargo dice.</li>
      <li>No 6-5-4 after three rolls? You’re sunk: zero.</li>
      <li>Best cargo takes the pot. Ties split it. If everyone sinks, the pot rides on to another hand.</li></ul></div>`,
  };
  function scoringTable() {
    return `<h3>Scoring guide</h3><table class="score-table">
      <tr><td>${fi(1)} single 1</td><td>100</td></tr>
      <tr><td>${fi(5)} single 5</td><td>50</td></tr>
      <tr><td>${fi(1)}${fi(1)}${fi(1)} three 1s</td><td>1000</td></tr>
      <tr><td>${fi(4)}${fi(4)}${fi(4)} three of a kind</td><td>face × 100</td></tr>
      <tr><td>Four / five / six of a kind</td><td>×2 / ×4 / ×8</td></tr>
      <tr><td>${[1, 2, 3, 4, 5, 6].map((v) => fi(v)).join('')} straight</td><td>1500</td></tr>
      <tr><td>Three pairs</td><td>1500</td></tr>
      <tr><td>Two triplets</td><td>2500</td></tr></table>
      <p class="muted" style="font-size:14px">e.g. ${fi(2)}${fi(2)}${fi(2)}${fi(2)} = 400 · ${fi(1)}${fi(5)}${fi(5)} = 200 · Every die you keep must score.</p>`;
  }
  function showRules(kind) {
    openModal(RULES[kind]() + '<div class="actions"><button class="btn gold" data-act="closem">Got it</button></div>');
  }

  // ---------------- game setup / lifecycle ----------------
  function setup(kind) {
    const G = GAMES[kind];
    const seats = DB.seats.map(P).filter(Boolean);
    const last = DB.lastSetup[kind] || {};
    const stake = last.stake != null ? last.stake : DB.settings.stake;
    const stakes = [0, 10, 25, 50, 100, 250];
    const hum = seats.filter((p) => p.type === 'human');
    const canAfford = (st) => hum.every((p) => p.chips >= st);
    let err = '';
    if (seats.length < G.min) err = `Seat at least ${G.min} players.`;
    else if (seats.length > G.max) err = `${G.name} seats up to ${G.max}.`;
    else if (!hum.length) err = 'Seat at least one human to play.';
    const chosen = canAfford(stake) ? stake : 0;
    const targets = DEBUG ? [1000, 2000, 5000, 10000] : [2000, 5000, 10000];
    const m = openModal(`<h2>${esc(G.name)}</h2>
      <div class="row" style="justify-content:space-between"><span class="muted">${esc(G.tag)}</span><button class="btn small" data-act="rules" data-game="${kind}">${ICON.book} Rules</button></div>
      <h3>At the table</h3>
      <div class="table-strip" style="flex-wrap:wrap">${seats.map((p) => `<div class="pchip">${avatar(p, 28)}<span>${esc(p.name)}${p.type === 'bot' ? ' <small class="muted">bot</small>' : ''}</span><span class="chipcount">${p.chips}</span></div>`).join('')}</div>
      <button class="btn small" style="margin-top:8px" data-act="go" data-to="players">Change players</button>
      <h3>Ante per player</h3>
      <div class="seg" id="su-stake">${stakes.map((st) => `<button data-v="${st}" class="${st === chosen ? 'on' : ''}" ${canAfford(st) ? '' : 'disabled'}>${st ? st : 'Free'}</button>`).join('')}</div>
      ${hum.some((p) => p.chips < 10) ? `<p class="muted" style="font-size:14px">${esc(hum.filter((p) => p.chips < 10).map((p) => p.name).join(', '))} ${hum.filter((p) => p.chips < 10).length > 1 ? 'are' : 'is'} tapped out — friendly games only until the house loan next session.</p>` : ''}
      ${kind === 'liars' ? `<h3>Ones are wild</h3><div class="row"><span class="muted grow" style="flex:1;font-size:15px">Classic Perudo rules</span><button class="toggle ${DB.settings.wild ? 'on' : ''}" id="su-wild" aria-label="Ones wild"></button></div>` : ''}
      ${kind === 'farkle' ? `<h3>Target score</h3><div class="seg" id="su-target">${targets.map((t) => `<button data-v="${t}" class="${(last.target || DB.settings.farkleTarget) === t ? 'on' : ''}">${t.toLocaleString()}</button>`).join('')}</div>` : ''}
      ${err ? `<p style="color:var(--red);font-weight:700">${esc(err)}</p>` : ''}
      <div class="actions"><button class="btn" data-act="closem">Cancel</button><button class="btn gold" id="su-go" ${err ? 'disabled' : ''}>Deal me in</button></div>`);
    $$('.seg', m).forEach((sg) => sg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.disabled) return; $$('button', sg).forEach((x) => x.classList.toggle('on', x === b)); Au.S.tap(); }));
    const w = $('#su-wild', m); if (w) w.onclick = () => w.classList.toggle('on');
    $('#su-go', m).onclick = () => {
      const st = +($('#su-stake .on', m) || { dataset: { v: 0 } }).dataset.v;
      const opts = {};
      if (kind === 'liars') { opts.wild = $('#su-wild', m).classList.contains('on'); DB.settings.wild = opts.wild; }
      if (kind === 'farkle') { opts.target = +$('#su-target .on', m).dataset.v; DB.settings.farkleTarget = opts.target; }
      DB.lastSetup[kind] = Object.assign({ stake: st }, opts);
      DB.settings.stake = st;
      closeModal();
      begin(kind, st, opts);
    };
  }
  function begin(kind, stake, opts) {
    const seats = DB.seats.map(P).filter(Boolean);
    // bots never go broke: the house quietly backs them
    for (const p of seats) {
      while (p.type === 'bot' && p.chips < stake) { p.chips += LOAN; p.loans++; toast(`The house spots ${p.name} ${LOAN} chips.`); }
      if (p.chips < stake) { toast(`${p.name} can’t cover the ante.`); return; }
    }
    seats.forEach((p) => { p.chips -= stake; });
    const players = seats.map((p) => ({ id: p.id, name: p.name, type: p.type, personality: p.personality }));
    const mod = kind === 'liars' ? R.Liars : kind === 'farkle' ? R.Farkle : R.SCC;
    const state = mod.newGame(players, opts);
    DB.game = { kind, stake, pot: stake * seats.length, ids: seats.map((p) => p.id), state, opts, ui: {}, started: Date.now() };
    save();
    mountGame(true);
  }
  function mountGame(fresh) {
    const g = DB.game;
    if (!g || !DD.games[g.kind]) { DB.game = null; save(); show('lobby'); return; }
    if (DD.ctrl) { DD.ctrl.destroy(); DD.ctrl = null; }
    show('game');
    try {
      DD.ctrl = new DD.games[g.kind](g, fresh);
      DD.ctrl.mount($('#scr-game'));
    } catch (e) {
      console.warn('could not resume game', e);
      DB.game = null; save(); show('lobby'); toast('That saved game couldn’t be restored.');
    }
  }
  function persist() { save(); }
  function quitGame() {
    const g = DB.game; if (!g) return;
    g.ids.forEach((id) => { if (P(id)) P(id).chips += g.stake; });
    DB.game = null; save();
    toast(g.stake ? 'Table closed — antes refunded.' : 'Table closed.');
    show('lobby');
  }
  // winners: array of seat indexes. Pays the pot, records stats, shows results.
  function endGame(winners, standings) {
    const g = DB.game; if (!g) return;
    const share = Math.floor(g.pot / winners.length);
    let rem = g.pot - share * winners.length;
    g.ids.forEach((id, i) => {
      const p = P(id); if (!p) return;
      p.played++;
      const bg = p.byGame[g.kind] || (p.byGame[g.kind] = { played: 0, wins: 0 });
      bg.played++;
      if (winners.indexOf(i) >= 0) {
        const won = share + (rem > 0 ? rem : 0); rem = 0;
        p.chips += won; p.wins++; bg.wins++;
        p.biggestPot = Math.max(p.biggestPot || 0, won);
      }
    });
    markBroke();
    const kind = g.kind, stake = g.stake, pot = g.pot, opts = g.opts;
    const names = winners.map((i) => P(g.ids[i]) ? P(g.ids[i]).name : '?');
    const humanWon = winners.some((i) => P(g.ids[i]) && P(g.ids[i]).type === 'human');
    DB.game = null; save();
    if (humanWon) { confetti(); Au.S.win(); buzz([30, 60, 30, 60, 90]); } else { Au.S.lose(); buzz(80); }
    const m = openModal(`<div class="results">
      <div style="text-align:center" class="muted">${esc(GAMES[kind].name)}</div>
      <div class="winner">${esc(names.join(' & '))} ${winners.length > 1 ? 'split the pot!' : 'wins!'}</div>
      <div class="potwon">${pot ? `Takes <span class="chipcount">${pot}</span>` : 'Friendly game — bragging rights only.'}</div>
      ${(standings || []).map((s) => `<div class="stand"><span>${esc(s.name)}</span><span class="muted">${esc(s.note)}</span><span class="chipcount">${P(s.id) ? P(s.id).chips : ''}</span></div>`).join('')}
      <div class="actions"><button class="btn" data-act="closem">Lobby</button><button class="btn gold" id="rs-again">Play again</button></div></div>`, { sticky: true, onClose: () => { if (current === 'game') show('lobby'); } });
    $('#rs-again', m).onclick = () => { modalClose = null; closeModal(); const hum = DB.seats.map(P).filter((p) => p && p.type === 'human'); begin(kind, hum.every((p) => p.chips >= stake) ? stake : 0, opts); };
  }

  // ---------------- actions ----------------
  const ACT = {
    go: (b) => { closeModal(); show(b.dataset.to); },
    mute: () => { DB.settings.muted = !DB.settings.muted; save(); applySettings(); },
    setup: (b, e) => { e.stopPropagation(); setup(b.dataset.game); },
    rules: (b, e) => { e.stopPropagation(); showRules(b.dataset.game); },
    closem: () => closeModal(),
    resume: () => mountGame(false),
    abandon: () => {
      const m = openModal(`<h2>Leave the table?</h2><p class="muted">The game ends and everyone’s ante is refunded.</p>
        <div class="actions"><button class="btn" data-act="closem">Stay</button><button class="btn pink" id="ab-yes">Leave table</button></div>`);
      $('#ab-yes', m).onclick = () => { closeModal(); quitGame(); };
    },
    loan: (b) => {
      const p = P(b.dataset.id); if (!p) return;
      p.chips += LOAN; p.loans++; p.brokeAt = null; save();
      toast(`${p.name} takes a ${LOAN}-chip house loan. The house believes in you. Mostly.`, 3200);
      Au.S.chip(5); RENDER.lobby();
    },
    seat: (b) => {
      const id = b.dataset.id, i = DB.seats.indexOf(id);
      if (i >= 0) DB.seats.splice(i, 1);
      else { if (DB.seats.length >= 6) { toast('The table seats six, max.'); return; } DB.seats.push(id); }
      save(); Au.S.tap(); RENDER.players();
    },
    addp: (b) => {
      const inp = $('#newname');
      let name = (inp.value || '').trim().slice(0, 14);
      const bot = b.dataset.type === 'bot';
      if (!name) { if (!bot) { toast('Type a name first.'); inp.focus(); return; } name = ['Rex', 'Pip', 'Moxie', 'Gus', 'Fifi', 'Blue', 'Dot'][Math.floor(Math.random() * 7)]; }
      const p = addProfile(name, bot ? 'bot' : 'human', bot ? ['cautious', 'bluffer', 'calculator'][Math.floor(Math.random() * 3)] : 'calculator');
      if (DB.seats.length < 6) DB.seats.push(p.id);
      save(); toast(`${p.name} joins the den with ${START_CHIPS} chips.`); RENDER.players();
    },
    editp: (b) => editProfile(b.dataset.id),
    savep: (b) => {
      const p = P(b.dataset.id), m = $('#modal');
      const name = ($('#ep-name', m).value || '').trim().slice(0, 14);
      if (name) p.name = name;
      p.type = $('#ep-type .on', m).dataset.v;
      p.personality = ($('#ep-pers .on', m) || { dataset: { v: p.personality } }).dataset.v;
      p.theme = ($('#ep-theme .on', m) || { dataset: { v: p.theme } }).dataset.v;
      save(); closeModal(); RENDER.players();
    },
    delp: (b) => {
      const id = b.dataset.id;
      if (DB.game && DB.game.ids.indexOf(id) >= 0) { toast('They’re mid-game. Leave that table first.'); return; }
      delete DB.profiles[id];
      DB.order = DB.order.filter((x) => x !== id); DB.seats = DB.seats.filter((x) => x !== id);
      save(); closeModal(); RENDER.players();
    },
    lbsort: (b) => { DB.settings.lbSort = b.dataset.k; save(); RENDER.leaders(); },
    lbbots: () => { DB.settings.showBots = !DB.settings.showBots; save(); RENDER.leaders(); },
    tset: async (b) => {
      const k = b.dataset.k;
      const on = !DB.settings[k];
      if (k === 'shake' && on) { const ok = await Shake.enable(); if (!ok) return; }
      DB.settings[k] = on; save(); applySettings(); RENDER.settings();
      if (k === 'haptics' && on) buzz(30);
    },
    reset: () => {
      const m = openModal(`<h2>Reset the den?</h2><p class="muted">All profiles, chips, stats and saved games will be wiped.</p>
        <div class="actions"><button class="btn" data-act="closem">Cancel</button><button class="btn pink" id="rs-yes">Wipe it</button></div>`);
      $('#rs-yes', m).onclick = () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } DB = null; load(); DB.session = 1; closeModal(); show('lobby'); onboard(); };
    },
  };
  document.addEventListener('click', (e) => {
    Au.resume();
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const f = ACT[b.dataset.act] || (DD.ctrl && DD.ctrl.act && DD.ctrl.act[b.dataset.act]);
    if (f) f(b, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && e.target && e.target.id === 'newname') ACT.addp({ dataset: { type: 'human' } });
  });
  ['touchstart', 'pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => Au.resume(), { passive: true }));
  // block double-tap zoom / pinch on iOS
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => { const now = Date.now(); if (now - lastTouch < 300 && !e.target.closest('input')) e.preventDefault(); lastTouch = now; }, { passive: false });

  function onboard() {
    if (humans().length) return;
    const m = openModal(`<h2>Welcome to the Den</h2>
      <p class="muted">Neon, felt and a cup full of dice. Everyone starts with <b class="gold-t">${START_CHIPS} play chips</b>.</p>
      <label class="muted" style="font-size:14px">What should the dealer call you?</label>
      <input class="field" id="ob-name" maxlength="14" placeholder="Your name" autocomplete="off">
      <p class="muted" style="font-size:14px">You’ll be seated with Mabel, Vinnie and Doc. Add friends for pass-and-play in Players.</p>
      <div class="actions"><button class="btn gold" id="ob-go">Take a seat</button></div>`, { sticky: true });
    const go = () => {
      const name = ($('#ob-name', m).value || '').trim().slice(0, 14) || 'You';
      const p = addProfile(name, 'human');
      DB.seats = [p.id, 'bot0', 'bot1', 'bot2'].filter((id) => DB.profiles[id]);
      save(); closeModal(); RENDER.lobby();
      Au.S.chip(4);
    };
    $('#ob-go', m).onclick = go;
    $('#ob-name', m).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  // relayout on resize / orientation
  let rzT = 0;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (DD.ctrl && DD.ctrl.relayout) DD.ctrl.relayout(); }, 150); });

  // service worker
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) { /* ignore */ }

  // ---------------- boot ----------------
  const DD = window.DD = {
    R, Dice, Au, $, $$, esc, ICON, COLORS, GAMES, SPEED, DEBUG,
    get db() { return DB; }, P, wait, toast, buzz, confetti, flyChips, Shake, openModal, closeModal, showRules, scoringTable,
    persist, endGame, quitGame, show, avatar, muteBtn, games: {}, ctrl: null,
  };
  window.addEventListener('DOMContentLoaded', () => {
    load();
    makeFelt();
    Dice.opts.onBounce = (v) => Au.S.clack(0.35 + v * 0.65);
    if (DB.settings.shake) Shake.listen();
    applySettings();
    if (DB.game && qs.get('resume') !== '0') mountGame(false); else show('lobby');
    onboard();
  });
})();
