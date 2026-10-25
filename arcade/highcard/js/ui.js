'use strict';
// HIGH CARD — UI: screens, the table, card layer (tap/drag), scoring animation, shop, packs, meta, boot.
(function (HC) {
  const E = HC.Engine, A = HC.Art, AU = HC.Audio;
  const $ = (id) => document.getElementById(id);
  const KEY = 'highcard.v1';
  const Q = new URLSearchParams(location.search);
  const DEBUG = Q.get('debug') === '1';

  // ================= storage =================
  const defMeta = () => ({ runs: 0, wins: 0, bestAnte: 0, bestHand: 0, bestType: null, omens: 0, stars: 0, maxStakeWon: -1, handsPlayed: 0,
    seen: { charm: {}, omen: {}, star: {}, voucher: {}, boss: {} }, history: [], deck: 'house', stake: 0 });
  const defSet = () => ({ sfx: true, music: true, haptics: true, shake: true, reduced: false, four: true, crt: true, speed: 1 });
  let meta = defMeta(), set = defSet(), run = null;
  function load() {
    let fresh = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          fresh = false;
          if (s.meta) { meta = Object.assign(defMeta(), s.meta); meta.seen = Object.assign(defMeta().seen, s.meta.seen || {}); if (!Array.isArray(meta.history)) meta.history = []; }
          if (s.set) set = Object.assign(defSet(), s.set);
          if (s.run && s.run.v === 1 && s.run.phase !== 'over' && Array.isArray(s.run.cards)) run = s.run;
        }
      }
    } catch (e) { /* storage unavailable */ }
    if (fresh) { try { set.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* ignore */ } }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, meta, set, run })); } catch (e) { /* ignore */ } }
  function buzz(p) { if (!set.haptics) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }

  let toastT = 0;
  function toast(msg, ms) {
    const t = $('toast'); t.innerHTML = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms || 2200);
  }
  const md = (s) => String(s).replace(/\{([cmx$gbr]):([^}]*)\}/g, (m, k, t) => '<span class="c-' + (k === '$' ? 'd' : k) + '">' + t + '</span>');
  const fmt = E.fmt;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function on(id, fn) { $(id).addEventListener('click', (e) => { AU.unlock(); fn(e); }); }

  // ================= settings application =================
  function applySettings() {
    document.body.classList.toggle('reduced', !!set.reduced);
    document.body.classList.toggle('nocrt', !set.crt);
    AU.setSfx(set.sfx); AU.setMusic(set.music);
    A.setFourColor(set.four);
    document.documentElement.style.setProperty('--spd', String(set.speed * turbo));
  }

  // ================= screens =================
  const SCREENS = ['title', 'newrun', 'collection', 'records', 'settings', 'howto'];
  let screen = 'title';
  function show(id) {
    screen = id;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('table').classList.toggle('hidden', id !== 'table');
    hideTip();
    if (id !== 'table') { clearCards(); clearFx(); }
    if (id === 'title') refreshTitle();
    if (id === 'newrun') buildNewRun();
    if (id === 'collection') buildCollection();
    if (id === 'records') buildRecords();
    if (id === 'settings') buildSettings($('setList'));
    if (id === 'howto') buildHowTo();
    const s = $(id); if (s && s.scrollTo) s.scrollTop = 0;
  }
  document.querySelectorAll('.backBtn').forEach((b) => b.addEventListener('click', () => { AU.unlock(); AU.play('click'); show(b.dataset.to); }));

  function refreshTitle() {
    $('continueBtn').classList.toggle('hidden', !run);
    $('newRunBtn').classList.toggle('primary', !run);
    $('titleBest').textContent = meta.bestHand ? 'Best hand ' + fmt(meta.bestHand) : 'Best —';
    const fan = $('titleFan');
    if (!fan.childElementCount) {
      const cards = [{ rank: 10, suit: 0 }, { rank: 11, suit: 3 }, { rank: 12, suit: 2 }, { rank: 13, suit: 1 }, { rank: 14, suit: 0 }];
      cards.forEach((c, i) => {
        const im = new Image();
        im.src = A.cardURL(Object.assign({ enh: i === 4 ? 'gold' : null, seal: null }, c));
        im.style.transform = 'rotate(' + (i - 2) * 13 + 'deg)';
        im.style.animationDelay = i * 0.07 + 's';
        fan.appendChild(im);
      });
    }
  }

  // ================= unlocks =================
  function deckUnlocked(d) {
    const u = d.unlock;
    if (!u) return true;
    if (u.ante) return meta.bestAnte >= u.ante;
    if (u.omens) return meta.omens >= u.omens;
    if (u.stars) return meta.stars >= u.stars;
    if (u.wins) return meta.wins >= u.wins;
    if (u.stakeWin) return meta.maxStakeWon >= u.stakeWin;
    return false;
  }
  function deckReq(d) {
    const u = d.unlock;
    if (!u) return '';
    if (u.ante) return 'Unlock: reach Ante ' + u.ante + ' (best ' + meta.bestAnte + ')';
    if (u.omens) return 'Unlock: use ' + u.omens + ' Omens (' + meta.omens + ')';
    if (u.stars) return 'Unlock: use ' + u.stars + ' Stars (' + meta.stars + ')';
    if (u.wins) return 'Unlock: win a run';
    if (u.stakeWin) return 'Unlock: win at Nickel stake or higher';
    return '';
  }
  const stakeUnlocked = (i) => i <= meta.maxStakeWon + 1;
  function unlockSnapshot() { return HC.DECKS.filter(deckUnlocked).map((d) => d.id).join(',') + '|' + (meta.maxStakeWon + 1); }
  let lastUnlock = '';
  function checkUnlocks() {
    const now = unlockSnapshot();
    if (lastUnlock && now !== lastUnlock) {
      const before = lastUnlock.split('|')[0].split(',');
      const fresh = HC.DECKS.filter((d) => deckUnlocked(d) && before.indexOf(d.id) < 0);
      if (fresh.length) toast('Unlocked: <b>' + fresh.map((d) => d.name).join(', ') + '</b>', 3000);
    }
    lastUnlock = now;
  }

  // ================= new run screen =================
  let deckIdx = 0, stakeSel = 0;
  function buildNewRun() {
    deckIdx = Math.max(0, HC.DECKS.findIndex((d) => d.id === meta.deck));
    stakeSel = Math.min(meta.stake || 0, meta.maxStakeWon + 1);
    renderDeckPick();
    const row = $('stakeRow'); row.innerHTML = '';
    HC.STAKES.forEach((s, i) => {
      const b = el('button', stakeUnlocked(i) ? '' : 'locked');
      b.setAttribute('aria-label', s.name + ' stake');
      b.appendChild(Object.assign(new Image(), { src: A.stakeURL(i), alt: '' }));
      b.addEventListener('click', () => {
        AU.unlock();
        if (!stakeUnlocked(i)) { AU.play('error'); toast('Win a run at ' + HC.STAKES[i - 1].name + ' stake to unlock'); return; }
        AU.play('click'); stakeSel = i; renderStake();
      });
      row.appendChild(b);
    });
    renderStake();
    $('seedIn').value = DEBUG && Q.get('seed') ? HC.RNG.cleanSeed(Q.get('seed')) : '';
  }
  function renderDeckPick() {
    const d = HC.DECKS[deckIdx];
    const ok = deckUnlocked(d);
    $('deckImg').src = A.backURL(d.id);
    $('deckLock').classList.toggle('hidden', ok);
    $('deckName').textContent = d.name;
    $('deckDesc').innerHTML = md(d.desc);
    $('deckReq').textContent = ok ? (deckIdx + 1) + ' / ' + HC.DECKS.length : deckReq(d);
    $('startBtn').disabled = !ok;
  }
  function renderStake() {
    const kids = $('stakeRow').children;
    for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('sel', i === stakeSel);
    const parts = HC.STAKES.slice(1, stakeSel + 1).map((s) => md(s.desc));
    $('stakeDesc').innerHTML = '<b>' + HC.STAKES[stakeSel].name + '</b> — ' + (stakeSel ? parts.join(' · ') : 'Base difficulty');
  }
  on('deckPrev', () => { AU.play('click'); deckIdx = (deckIdx + HC.DECKS.length - 1) % HC.DECKS.length; renderDeckPick(); });
  on('deckNext', () => { AU.play('click'); deckIdx = (deckIdx + 1) % HC.DECKS.length; renderDeckPick(); });
  on('seedRnd', () => { AU.play('click'); $('seedIn').value = HC.RNG.randomSeed(); });
  $('seedIn').addEventListener('input', () => { const v = HC.RNG.cleanSeed($('seedIn').value); if (v !== $('seedIn').value) $('seedIn').value = v; });
  on('startBtn', () => {
    const d = HC.DECKS[deckIdx];
    if (!deckUnlocked(d)) return;
    meta.deck = d.id; meta.stake = stakeSel;
    startNewRun({ deck: d.id, stake: stakeSel, seed: $('seedIn').value });
  });
  function startNewRun(opt) {
    run = E.newRun(opt);
    meta.runs++;
    if (DEBUG) {
      if (Q.get('money')) run.money = +Q.get('money') || run.money;
      if (Q.get('ante')) { run.ante = Math.max(1, Math.min(40, +Q.get('ante') || 1)); run.bosses[run.ante] = run.bosses[run.ante] || null; delete run.bosses[run.ante]; }
      if (Q.get('charms')) for (const id of Q.get('charms').split(',')) if (HC.CHARM[id] && run.charms.length < run.charmSlots) run.charms.push(E.mkCharm(run, id));
    }
    AU.play('shuffle'); buzz(15);
    save();
    enterTable();
  }

  // ================= collection =================
  let collTab = 'charm';
  const COLL = {
    charm: { name: 'Charms', list: () => HC.CHARMS, url: (x) => A.charmURL(x.id) },
    omen: { name: 'Omens', list: () => HC.OMENS, url: (x) => A.omenURL(x.id) },
    star: { name: 'Stars', list: () => HC.STARS, url: (x) => A.starURL(x.id) },
    voucher: { name: 'Vouchers', list: () => HC.VOUCHERS, url: (x) => A.voucherURL(x.id) },
    boss: { name: 'Bosses', list: () => HC.BOSSES, url: (x) => A.chipURL(x.id), round: true },
  };
  function buildCollection() {
    const tabs = $('collTabs'); tabs.innerHTML = '';
    let total = 0, seen = 0;
    for (const k in COLL) {
      const n = COLL[k].list().length, s = COLL[k].list().filter((x) => meta.seen[k][x.id]).length;
      total += n; seen += s;
      const b = el('button', 'btn small' + (k === collTab ? ' sel' : ''), COLL[k].name + ' ' + s + '/' + n);
      b.addEventListener('click', () => { AU.play('click'); collTab = k; buildCollection(); });
      tabs.appendChild(b);
    }
    $('collCount').textContent = seen + '/' + total;
    const g = $('collGrid'); g.innerHTML = ''; g.classList.toggle('round', !!COLL[collTab].round);
    for (const x of COLL[collTab].list()) {
      const known = !!meta.seen[collTab][x.id];
      const c = el('button', 'cell' + (known ? '' : ' unseen'));
      c.setAttribute('aria-label', known ? x.name : 'Undiscovered');
      c.appendChild(Object.assign(new Image(), { src: COLL[collTab].url(x), alt: '' }));
      c.addEventListener('click', () => {
        AU.play('click');
        if (!known) { toast('Not discovered yet — find it in a shop or pack'); return; }
        openSheet('<div style="display:flex;gap:14px;align-items:center"><img src="' + COLL[collTab].url(x) + '" style="width:90px;border-radius:10px"><div><h2 style="text-align:left">' + esc(x.name) + '</h2>' + itemSub(collTab, x) + '</div></div><p class="sub" style="text-align:left;max-width:none">' + itemDesc(collTab, x.id, null) + '</p><button class="btn" data-close>Close</button>');
      });
      g.appendChild(c);
    }
  }
  function itemSub(kind, x) {
    if (kind === 'charm') return '<span class="pill" style="color:' + ['', '#6fb4ff', '#4fe08a', '#ff4fa8'][x.r] + '">' + HC.RARITY[x.r] + ' Charm · $' + x.cost + '</span>';
    if (kind === 'boss') return '<span class="pill">' + (x.show ? 'Showdown boss' : 'From Ante ' + x.min) + '</span>';
    return '<span class="pill">' + { omen: 'Omen', star: 'Star', voucher: 'Voucher' }[kind] + '</span>';
  }

  // ================= records =================
  function buildRecords() {
    const st = $('recStats');
    const seenCharms = Object.keys(meta.seen.charm).length;
    const cells = [
      ['Runs', meta.runs], ['Wins', meta.wins], ['Best ante', meta.bestAnte || '—'],
      ['Best hand', meta.bestHand ? fmt(meta.bestHand) + (meta.bestType ? ' <small style="display:inline">' + HC.HAND[meta.bestType].name + '</small>' : '') : '—'],
      ['Omens used', meta.omens], ['Stars used', meta.stars], ['Charms found', seenCharms + '/' + HC.CHARMS.length],
      ['Top stake won', meta.maxStakeWon >= 0 ? HC.STAKES[meta.maxStakeWon].name : '—'],
    ];
    st.innerHTML = cells.map((c) => '<div><small>' + c[0] + '</small><b>' + c[1] + '</b></div>').join('');
    const L = $('recList'); L.innerHTML = '';
    if (!meta.history.length) { L.appendChild(el('p', 'sub', 'No runs yet. The table is waiting.')); return; }
    for (const h of meta.history) {
      const d = new Date(h.date || Date.now());
      const it = el('div', 'item' + (h.won ? ' win' : ''));
      it.innerHTML = '<img src="' + A.backURL(h.deck) + '" style="width:30px;height:42px;border-radius:4px"><div class="info"><div class="name">' + (h.won ? 'Won' + (h.ante > 8 ? ' · endless to Ante ' + h.ante : '') : 'Ante ' + h.ante + ' · ' + esc(h.lostTo || '')) + '</div><div class="meta">' +
        esc((HC.DECK[h.deck] || HC.DECKS[0]).name) + ' · ' + HC.STAKES[h.stake || 0].name + ' · best ' + fmt(h.best || 0) + ' · seed <b>' + esc(h.seed) + '</b></div><div class="meta">' + d.toLocaleDateString() + '</div></div>';
      L.appendChild(it);
    }
  }

  // ================= settings =================
  const TOGGLES = [['sfx', 'Sound effects'], ['music', 'Music'], ['haptics', 'Haptics'], ['shake', 'Screen shake'], ['reduced', 'Reduced motion'], ['four', 'Four-colour suits'], ['crt', 'CRT scanlines']];
  function buildSettings(box, compact) {
    box.innerHTML = '';
    const sp = el('div', 'setrow', '<b>Scoring speed</b>');
    const seg = el('div', 'seg');
    [['1×', 1], ['2×', 2], ['3×', 3], ['4×', 4]].forEach((o) => {
      const b = el('button', 'btn small' + (set.speed === o[1] ? ' sel' : ''), o[0]);
      b.addEventListener('click', () => { AU.unlock(); AU.play('click'); set.speed = o[1]; applySettings(); save(); buildSettings(box, compact); });
      seg.appendChild(b);
    });
    sp.appendChild(seg); box.appendChild(sp);
    for (const [k, label] of TOGGLES) {
      if (compact && (k === 'crt' || k === 'four' || k === 'reduced')) continue;
      const b = el('button', 'btn toggle', '<span>' + label + '</span><span class="sw"></span>');
      b.setAttribute('aria-pressed', String(!!set[k]));
      b.addEventListener('click', () => {
        AU.unlock(); set[k] = !set[k]; b.setAttribute('aria-pressed', String(set[k])); applySettings(); save(); AU.play('click');
        if (k === 'four' && screen === 'table') { refreshAllCards(); }
      });
      box.appendChild(b);
    }
  }
  on('resetBtn', () => {
    confirmSheet('Reset everything?', 'This wipes your collection, records, unlocks and any run in progress.', 'Reset', () => {
      meta = defMeta(); run = null; save(); lastUnlock = unlockSnapshot(); toast('Progress reset'); show('title');
    });
  });

  // ================= how to =================
  function buildHowTo() {
    const rows = HC.HANDS.map((h) => '<tr><td>' + h.name + (h.secret ? ' <small style="color:var(--dim)">secret</small>' : '') + '</td><td><span class="c-c">' + h.c + '</span> × <span class="c-m">' + h.m + '</span></td></tr>').join('');
    $('howText').innerHTML =
      '<p>Each <b>blind</b> asks for a target score. You get <span class="c-b">4 Hands</span> and <span class="c-r">3 Discards</span> and hold <b>8 cards</b> from your own 52-card deck.</p>' +
      '<p><b>Tap</b> up to 5 cards to select them, then <b>Play</b> a poker hand or <b>Discard</b> them for new ones. <b>Drag</b> cards to reorder; use <b>Sort</b> for rank or suit.</p>' +
      '<p>Score = (<span class="c-c">hand Chips</span> + <span class="c-c">Chips of scoring cards</span>) × <span class="c-m">hand Mult</span>, then changed by your <b>Charms</b> from left to right. Add <span class="c-m">+Mult</span> before <span class="c-x">×Mult</span> — order matters, so drag Charms to reorder.</p>' +
      '<p>Every ante has a <b>Small</b>, <b>Big</b> and <b>Boss</b> blind. Bosses bend the rules. Beat Ante 8 to beat the House.</p>' +
      '<p>Win a blind to <b>cash out</b>: the reward, <span class="c-d">$1</span> per hand left and <span class="c-d">$1</span> interest per $5 saved (max $5). Then visit the <b>shop</b>:</p>' +
      '<p>• <b>Charms</b> (up to 5) give Chips, Mult, ×Mult, money or retriggers.<br>• <b>Omens</b> enhance or convert your cards (select cards first).<br>• <b>Stars</b> level up a poker hand.<br>• <b>Packs</b> offer a choice of several. <b>Vouchers</b> are permanent upgrades.</p>' +
      '<p>Card enhancements: ' + Object.keys(HC.ENH).map((k) => '<b>' + HC.ENH[k].name + '</b> ' + md(HC.ENH[k].desc)).join(' · ') + '.</p>' +
      '<p>Editions: ' + Object.keys(HC.ED).map((k) => '<b>' + HC.ED[k].name + '</b> ' + md(HC.ED[k].desc)).join(' · ') + '. Seals: ' + Object.keys(HC.SEAL).map((k) => '<b>' + HC.SEAL[k].name + '</b> ' + md(HC.SEAL[k].desc)).join(' · ') + '.</p>' +
      '<h3>Hands (level 1)</h3><table>' + rows + '</table>' +
      '<p>Keys: <b>1–9</b> select · <b>Enter</b> play · <b>D</b> discard · <b>R</b>/<b>S</b> sort · <b>Space</b> speed up scoring · <b>Esc</b> menu.</p>' +
      '<p>Your run saves after every action, so close the app any time. Same seed, same shuffles.</p>';
  }

  // ================= descriptions =================
  function itemDesc(kind, id, inst, extra) {
    if (kind === 'charm') {
      const d = HC.CHARM[id];
      let s = typeof d.desc === 'function' ? d.desc(inst, inst ? run : null) : d.desc;
      return md(s);
    }
    if (kind === 'omen') return md(HC.OMEN[id].desc);
    if (kind === 'star') {
      const s = HC.STAR[id], h = HC.HAND[s.hand];
      const lv = run ? run.levels[s.hand] : 1;
      return md('Level up {g:' + h.name + '}' + (run ? ' (lvl ' + lv + ' → ' + (lv + 1) + ')' : '') + ': {c:+' + h.lc + '} Chips and {m:+' + h.lm + '} Mult');
    }
    if (kind === 'voucher') return md(HC.VOUCHER[id].desc);
    if (kind === 'boss') return md(HC.BOSS[id].desc);
    if (kind === 'pack') { const p = HC.PACKS[id]; return md('Choose {g:' + p.pick + '} of ' + p.n + ' ' + { charm: 'Charms', omen: 'Omens', star: 'Stars', card: 'playing cards to add to your deck' }[p.kind]); }
    return '';
  }
  function itemName(kind, id) {
    if (kind === 'charm') return HC.CHARM[id].name;
    if (kind === 'omen') return HC.OMEN[id].name;
    if (kind === 'star') return HC.STAR[id].name;
    if (kind === 'voucher') return HC.VOUCHER[id].name;
    if (kind === 'pack') return HC.PACKS[id].name;
    return '';
  }
  function itemURL(kind, id) {
    return kind === 'charm' ? A.charmURL(id) : kind === 'omen' ? A.omenURL(id) : kind === 'star' ? A.starURL(id) : kind === 'voucher' ? A.voucherURL(id) : A.packURL(id);
  }
  function cardName(c) {
    if (c.enh === 'stone') return 'Stone card';
    return (HC.RANK_NAME[c.rank] || c.rank) + ' of ' + HC.SUITS[c.suit];
  }
  function cardDescLine(c) {
    const parts = [HC.RANK_CH[c.rank] + HC.SUIT_CH[c.suit] + ' · ' + HC.rankChips(c.rank) + ' chips'];
    if (c.enh === 'stone') parts[0] = 'Stone';
    if (c.enh) parts.push(HC.ENH[c.enh].name + ': ' + HC.ENH[c.enh].desc.replace(/\{[a-z$]:([^}]*)\}/g, '$1'));
    if (c.ed) parts.push(HC.ED[c.ed].name);
    if (c.seal) parts.push(HC.SEAL[c.seal].name);
    return parts.join(' · ');
  }
  function markSeen(kind, id) { if (id && meta.seen[kind] && !meta.seen[kind][id]) { meta.seen[kind][id] = 1; } }

  // ================= sizing =================
  function computeSizes() {
    const root = document.documentElement.style;
    const hud = $('hud');
    const w = hud.clientWidth || Math.min(560, innerWidth - 20);
    const tw = Math.floor(Math.max(42, Math.min(72, (w - 24) / 5, innerHeight * 0.074)));
    root.setProperty('--tw', tw + 'px'); root.setProperty('--th', Math.round(tw * 1.4) + 'px');
    let cw = Math.min(98, w * 0.2);
    const stage = $('stage');
    if (stage && stage.clientHeight && !$('playView').classList.contains('hidden')) {
      const fixed = $('scorePanel').offsetHeight + ($('bossNote').classList.contains('hidden') ? 0 : $('bossNote').offsetHeight + 4) + $('infoLine').offsetHeight + $('controls').offsetHeight;
      const ch = (stage.clientHeight - fixed - 24 - 6) / 1.72;
      cw = Math.min(cw, ch / 1.4);
    }
    cw = Math.floor(Math.max(40, cw));
    root.setProperty('--cw', cw + 'px'); root.setProperty('--ch', Math.round(cw * 1.4) + 'px');
    sz.cw = cw; sz.ch = Math.round(cw * 1.4); sz.tw = tw; sz.th = Math.round(tw * 1.4);
  }
  const sz = { cw: 62, ch: 87, tw: 60, th: 84 };

  // ================= view state =================
  const view = { hand: [], played: [], sel: [], lift: new Set(), dim: new Set(), lastTap: null };
  let busy = false, turbo = 1;
  const spd = () => set.speed * turbo;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / spd()));
  function setTurbo(t) { turbo = t; document.documentElement.style.setProperty('--spd', String(set.speed * turbo)); }

  // ================= card layer =================
  const layer = $('cardLayer');
  const cardEls = new Map();
  function isFd(id) { return !!(run && run.phase === 'play' && run.round && run.round.fd.indexOf(id) >= 0); }
  function cardSig(c, id) { return isFd(id) ? 'fd' + run.deck : c.rank + '.' + c.suit + '.' + c.enh + '.' + c.seal + '.' + c.ed + '.' + (run.round && E.isDebuffed(run, c) ? 'd' : ''); }
  function ensureCard(id) {
    let o = cardEls.get(id);
    const c = E.card(run, id) || (o && o.data);
    if (!c) return null;
    if (!o) {
      const e = el('div', 'card');
      e.dataset.id = id;
      const im = new Image(); im.alt = ''; e.appendChild(im);
      layer.appendChild(e);
      o = { el: e, img: im, sig: '', data: c, x: 0, y: 0, r: 0, fresh: true };
      cardEls.set(id, o);
    }
    o.data = c;
    refreshCard(o, id);
    return o;
  }
  function refreshCard(o, id) {
    const c = o.data;
    const s = cardSig(c, id);
    if (s === o.sig) return false;
    o.sig = s;
    const fd = isFd(id);
    o.img.src = fd ? A.backURL(run.deck) : A.cardURL(c);
    o.el.classList.remove('ed-shimmer', 'ed-prism', 'ed-aurora');
    if (!fd && c.ed) o.el.classList.add('ed-' + c.ed);
    o.el.classList.toggle('debuff', !fd && !!run.round && run.phase === 'play' && E.isDebuffed(run, c));
    o.el.setAttribute('aria-label', fd ? 'Face-down card' : cardName(c));
    return true;
  }
  function refreshAllCards() { for (const [id, o] of cardEls) { o.sig = ''; o.data = E.card(run, id) || o.data; refreshCard(o, id); } }
  function place(o, x, y, r, instant, delay) {
    o.x = x; o.y = y; o.r = r;
    const tf = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg)';
    if (instant) { o.el.style.transition = 'none'; o.el.style.transform = tf; void o.el.offsetWidth; o.el.style.transition = ''; }
    else { o.el.style.transitionDelay = delay ? delay + 'ms' : ''; o.el.style.transform = tf; }
  }
  function deckPos() {
    const r = $('deckBtn').getBoundingClientRect();
    return { x: r.left + r.width / 2 - sz.cw / 2, y: r.top + r.height / 2 - sz.ch / 2 };
  }
  function removeCard(id, how) {
    const o = cardEls.get(id);
    if (!o) return;
    cardEls.delete(id);
    if (how === 'fly') place(o, innerWidth + 40, o.y - 30, 25);
    o.el.classList.add('gone');
    o.el.style.pointerEvents = 'none';
    setTimeout(() => o.el.remove(), 320);
  }
  function clearCards() { for (const id of Array.from(cardEls.keys())) { const o = cardEls.get(id); o.el.remove(); cardEls.delete(id); } }
  function handZoneEl() { return run && run.phase === 'pack' ? $('packHand') : $('handZone'); }
  let drag = null;
  function handGeom(n) {
    const z = handZoneEl().getBoundingClientRect();
    const cw = sz.cw;
    const step = n > 1 ? Math.min(cw + 6, (z.width - cw) / (n - 1)) : 0;
    const total = cw + step * Math.max(0, n - 1);
    return { z, step, x0: z.left + (z.width - total) / 2, y0: z.top + 22 };
  }
  function layoutCards(opt) {
    opt = opt || {};
    if (!run || screen !== 'table') return;
    const showHand = busy || run.phase === 'play' || (run.phase === 'pack' && run.pack && run.pack.kind === 'omen');
    const keep = new Set();
    if (showHand) {
      const ids = view.hand;
      const n = ids.length;
      const g = handGeom(n);
      const mid = (n - 1) / 2;
      const red = set.reduced;
      let k = 0;
      const dp = deckPos();
      ids.forEach((id, i) => {
        const o = ensureCard(id);
        if (!o) return;
        keep.add(id);
        if (o.fresh) { place(o, dp.x, dp.y, 0, true); o.fresh = false; o.deal = true; }
        if (drag && drag.id === id && drag.moved) return;
        const d = i - mid;
        let x = g.x0 + i * g.step, y = g.y0 + (red ? 0 : d * d * 0.9), r = red ? 0 : d * 2.2;
        const sel = view.sel.indexOf(id) >= 0;
        if (sel) y -= Math.min(24, sz.ch * 0.26);
        o.el.classList.toggle('sel', sel);
        o.el.classList.toggle('dim', view.dim.has(id));
        o.el.style.zIndex = String(10 + i);
        place(o, x, y, r, opt.instant, o.deal ? (k++) * 55 / spd() : 0);
        o.deal = false;
      });
      const pz = $('playZone').getBoundingClientRect();
      const m = view.played.length;
      const pstep = m > 1 ? Math.min(sz.cw + 8, (pz.width - sz.cw) / (m - 1)) : 0;
      const ptot = sz.cw + pstep * Math.max(0, m - 1);
      view.played.forEach((id, i) => {
        const o = ensureCard(id);
        if (!o) return;
        keep.add(id);
        o.el.classList.remove('sel');
        o.el.classList.toggle('dim', view.dim.has(id));
        o.el.style.zIndex = String(50 + i);
        const y = pz.top + Math.max(4, (pz.height - sz.ch) / 2) - (view.lift.has(id) ? 12 : 0);
        place(o, pz.left + (pz.width - ptot) / 2 + i * pstep, y, 0, opt.instant);
      });
    }
    for (const id of Array.from(cardEls.keys())) if (!keep.has(id)) removeCard(id);
  }
  function syncHand() {
    if (!run) return;
    if (run.phase === 'play') view.hand = run.hand.slice();
    else if (run.phase === 'pack' && run.pack && run.pack.kind === 'omen') view.hand = run.pack.hand.slice();
    else view.hand = [];
    view.sel = view.sel.filter((id) => view.hand.indexOf(id) >= 0);
    view.played = []; view.lift.clear(); view.dim.clear();
  }

  // hand pointer input (tap to select, drag to reorder)
  layer.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.card');
    if (!t || busy || !run) return;
    const id = +t.dataset.id;
    if (view.hand.indexOf(id) < 0) return;
    AU.unlock();
    hideTip();
    drag = { id, el: t, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
    try { t.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    e.preventDefault();
  });
  layer.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 9) { drag.moved = true; drag.el.classList.add('drag'); }
    if (!drag.moved) return;
    const o = cardEls.get(drag.id);
    if (!o) return;
    o.el.style.zIndex = '80';
    place(o, e.clientX - sz.cw / 2, e.clientY - sz.ch * 0.6, 0, true);
    const n = view.hand.length;
    const g = handGeom(n);
    let idx = g.step ? Math.round((e.clientX - sz.cw / 2 - g.x0) / g.step) : 0;
    idx = Math.max(0, Math.min(n - 1, idx));
    const cur = view.hand.indexOf(drag.id);
    if (idx !== cur) { view.hand.splice(cur, 1); view.hand.splice(idx, 0, drag.id); AU.play('tick'); layoutCards(); }
  });
  function endDrag(e, cancel) {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    const d = drag; drag = null;
    d.el.classList.remove('drag');
    if (d.moved) {
      if (run.phase === 'play') E.reorderHand(run, view.hand);
      else if (run.pack) run.pack.hand = view.hand.slice();
      save();
      layoutCards();
    } else if (!cancel) toggleSel(d.id);
  }
  layer.addEventListener('pointerup', (e) => endDrag(e, false));
  layer.addEventListener('pointercancel', (e) => endDrag(e, true));
  function maxSel() { return 5; }
  function toggleSel(id) {
    const i = view.sel.indexOf(id);
    if (i >= 0) { view.sel.splice(i, 1); AU.play('deselect'); }
    else {
      if (view.sel.length >= maxSel()) { AU.play('error'); toast('5 cards max'); return; }
      view.sel.push(id); AU.play('select'); buzz(6);
    }
    view.lastTap = id;
    layoutCards();
    updatePreview();
  }
  function selectedIds() { return view.hand.filter((id) => view.sel.indexOf(id) >= 0); }

  // ================= HUD =================
  function updateHUD() {
    if (!run) return;
    let info, hands, discs;
    if (run.round && (run.phase === 'play' || run.phase === 'cashout')) {
      const r = run.round;
      info = { name: r.name, target: r.target, reward: r.reward, boss: r.boss ? HC.BOSS[r.boss] : null, idx: r.boss ? 2 : HC.BLIND_NAMES.indexOf(r.name) };
      hands = r.hands; discs = r.discards;
      $('roundScore').textContent = fmt(r.score);
      $('scoreBox').classList.toggle('hot', r.score >= r.target);
    } else {
      info = E.blindInfo(run);
      const rc = E.roundCounts(run, info.boss ? info.boss.id : null);
      hands = rc.hands; discs = rc.discards;
      $('roundScore').textContent = '—';
      $('scoreBox').classList.remove('hot');
    }
    $('hudName').textContent = info.name;
    $('hudTarget').textContent = fmt(info.target);
    $('hudReward').textContent = info.reward ? 'Reward ' + '$'.repeat(Math.min(info.reward, 8)) : 'No reward';
    const kind = info.boss ? info.boss.id : info.idx === 1 ? 'big' : 'small';
    $('hudChip').src = A.chipURL(kind);
    $('hudBlind').style.setProperty('--bcol', info.boss ? info.boss.color : info.idx === 1 ? '#e8902f' : '#2f7fe8');
    $('hHands').textContent = hands; $('hDisc').textContent = discs;
    $('hMoney').textContent = '$' + run.money;
    $('hAnte').textContent = run.ante <= 8 ? run.ante + '/8' : String(run.ante);
    $('deckCount').textContent = (run.phase === 'play' ? run.draw.length + '/' : '') + run.cards.length;
    $('deckMini').src = A.backURL(run.deck);
  }
  function bumpStat(id) { const b = $(id).parentNode; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

  // ================= charms & consumables rows =================
  const tileEls = new Map(); // uid -> {el,img,badge}
  let cdrag = null;
  function slotX(i, n, rowW, tw) {
    const gap = n > 1 ? Math.min(10, (rowW - n * tw) / (n - 1)) : 0;
    const total = n * tw + (n - 1) * gap;
    return (rowW - total) / 2 + i * (tw + gap);
  }
  function charmBadge(ch) {
    const d = HC.CHARM[ch.id];
    const s = ch.s || {};
    if (!E.charmOn(run, ch)) return '';
    switch (ch.id) {
      case 'snowball': return '+' + s.v;
      case 'magpie': case 'rising': return '+' + s.v;
      case 'bonfire': case 'hotstreak': return '×' + (1 + 0.25 * s.v).toFixed(2).replace(/\.?0+$/, '');
      case 'jackpot': return '×' + (1 + 0.5 * s.v).toFixed(1).replace(/\.0$/, '');
      case 'piggy': return '$' + E.sellValue(ch);
      case 'stargazer': return '×' + (1 + 0.1 * run.stats.stars).toFixed(1);
      case 'fortune': return '+' + run.stats.omens;
      case 'hoard': return '+' + 2 * Math.floor(Math.max(0, run.money) / 5);
      case 'deckhand': return run.phase === 'play' ? '+' + 2 * run.draw.length : '';
      case 'anteup': return '+' + 3 * run.ante;
      case 'register': return '+' + 2 * Math.max(0, run.money);
      default: return d.copy ? (E.copyTarget(run, run.charms.indexOf(ch)) ? 'copying' : '—') : '';
    }
  }
  function renderCharms() {
    if (!run) return;
    const row = $('charmRow');
    const rowW = row.clientWidth;
    const n = run.charmSlots;
    $('charmCount').textContent = run.charms.length + '/' + n;
    row.querySelectorAll('.slot-empty').forEach((e) => e.remove());
    for (let i = run.charms.length; i < n; i++) { const s = el('div', 'slot-empty'); s.style.left = slotX(i, n, rowW, sz.tw) + 'px'; row.appendChild(s); }
    const alive = new Set();
    run.charms.forEach((ch, i) => {
      alive.add(ch.uid);
      markSeen('charm', ch.id);
      let t = tileEls.get(ch.uid);
      if (!t) {
        const e = el('div', 'tile');
        e.dataset.uid = ch.uid;
        const im = new Image(); im.alt = ''; e.appendChild(im);
        const b = el('span', 'badge hidden'); e.appendChild(b);
        row.appendChild(e);
        t = { el: e, img: im, badge: b };
        tileEls.set(ch.uid, t);
        im.src = A.charmURL(ch.id);
        e.setAttribute('aria-label', HC.CHARM[ch.id].name);
        placeTile(t, slotX(i, n, rowW, sz.tw), true);
      }
      t.el.classList.remove('ed-shimmer', 'ed-prism', 'ed-aurora');
      if (ch.ed) t.el.classList.add('ed-' + ch.ed);
      t.el.classList.toggle('off', !E.charmOn(run, ch));
      const bt = charmBadge(ch);
      t.badge.textContent = bt; t.badge.classList.toggle('hidden', !bt);
      if (!(cdrag && cdrag.uid === ch.uid && cdrag.moved)) placeTile(t, slotX(i, n, rowW, sz.tw));
    });
    for (const [uid, t] of Array.from(tileEls)) if (!alive.has(uid)) { t.el.remove(); tileEls.delete(uid); }
  }
  function placeTile(t, x, instant) {
    const tx = 'translateX(' + x.toFixed(1) + 'px)';
    t.el.style.setProperty('--tx', tx);
    if (instant) { t.el.style.transition = 'none'; t.el.style.transform = tx; void t.el.offsetWidth; t.el.style.transition = ''; }
    else t.el.style.transform = tx;
  }
  function wiggle(uid) {
    const t = tileEls.get(uid);
    if (!t) return;
    t.el.classList.remove('wig'); void t.el.offsetWidth; t.el.classList.add('wig');
  }
  const crow = $('charmRow');
  crow.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tile');
    if (!t || !run) return;
    AU.unlock();
    const uid = +t.dataset.uid;
    cdrag = { uid, el: t, sx: e.clientX, moved: false, pid: e.pointerId, from: run.charms.findIndex((c) => c.uid === uid) };
    try { t.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    e.preventDefault();
  });
  crow.addEventListener('pointermove', (e) => {
    if (!cdrag || e.pointerId !== cdrag.pid) return;
    if (busy) return;
    const dx = e.clientX - cdrag.sx;
    if (!cdrag.moved && Math.abs(dx) > 8) { cdrag.moved = true; cdrag.el.classList.add('drag'); hideTip(); }
    if (!cdrag.moved) return;
    const rr = crow.getBoundingClientRect();
    const x = e.clientX - rr.left - sz.tw / 2;
    const t = tileEls.get(cdrag.uid);
    placeTile(t, x, true);
    const n = run.charmSlots;
    let best = 0, bd = 1e9;
    for (let i = 0; i < run.charms.length; i++) { const d = Math.abs(slotX(i, n, rr.width, sz.tw) - x); if (d < bd) { bd = d; best = i; } }
    const cur = run.charms.findIndex((c) => c.uid === cdrag.uid);
    if (best !== cur) { E.moveCharm(run, cur, best); AU.play('tick'); renderCharms(); }
  });
  function endCDrag(e) {
    if (!cdrag || (e && e.pointerId !== cdrag.pid)) return;
    const d = cdrag; cdrag = null;
    d.el.classList.remove('drag');
    if (d.moved) { save(); renderCharms(); updatePreview(); return; }
    const ch = run.charms.find((c) => c.uid === d.uid);
    if (ch) charmTip(ch, d.el);
  }
  crow.addEventListener('pointerup', endCDrag);
  crow.addEventListener('pointercancel', (e) => { if (cdrag) { cdrag.moved = true; endCDrag(e); } });

  function charmTip(ch, anchor) {
    const d = HC.CHARM[ch.id];
    let note = '';
    if (d.copy) {
      const t = E.copyTarget(run, run.charms.indexOf(ch));
      note = t ? 'Copying <b>' + HC.CHARM[t.id].name + '</b>' : 'Nothing compatible to copy';
    } else if (d.nocopy) note = 'Not copyable by Mimic';
    if (!E.charmOn(run, ch)) note = '<span class="c-r">Disabled by the boss</span>';
    const html = '<h4>' + d.name + '</h4><div class="rar r' + d.r + '">' + HC.RARITY[d.r] + (ch.ed ? ' · ' + HC.ED[ch.ed].name + ' (' + md(HC.ED[ch.ed].desc) + ')' : '') + '</div><p>' + itemDesc('charm', ch.id, ch) + '</p>' + (note ? '<p class="note">' + note + '</p>' : '');
    const canSell = !busy && ['play', 'shop', 'pack', 'select'].indexOf(run.phase) >= 0;
    showTip(anchor, html, [
      { label: 'Sell $' + E.sellValue(ch), cls: 'danger', off: !canSell, fn: () => act(() => {
        const r = E.sellCharm(run, ch.uid);
        if (r.ok) { AU.play('sell'); buzz(10); burstAt(anchor, 'coin'); bumpStat('hMoney'); }
        return r;
      }) },
      { label: 'Close', fn: hideTip },
    ]);
  }
  function renderCons() {
    if (!run) return;
    const row = $('consRow');
    row.innerHTML = '';
    const tw = Math.round(sz.tw * 0.64);
    for (let i = 0; i < run.consSlots; i++) {
      const x = i * (tw + 6);
      const it = run.cons[i];
      if (!it) { const s = el('div', 'slot-empty'); s.style.left = x + 'px'; row.appendChild(s); continue; }
      markSeen(it.kind, it.id);
      const t = el('div', 'tile');
      t.style.transform = 'translateX(' + x + 'px)';
      t.appendChild(Object.assign(new Image(), { src: itemURL(it.kind, it.id), alt: '' }));
      t.setAttribute('aria-label', itemName(it.kind, it.id));
      t.addEventListener('click', () => { AU.unlock(); AU.play('click'); consTip(i, t); });
      row.appendChild(t);
    }
  }
  function consTip(i, anchor) {
    const it = run.cons[i];
    if (!it) return;
    const o = it.kind === 'omen' ? HC.OMEN[it.id] : null;
    const sel = selectedIds();
    const chk = E.canUseItem(run, it, sel, false);
    let note = '';
    if (o && o.need) note = 'Select ' + (o.need[0] === o.need[1] ? o.need[0] : o.need[0] + '–' + o.need[1]) + ' card' + (o.need[1] > 1 ? 's' : '') + ' in your hand first';
    const html = '<h4>' + itemName(it.kind, it.id) + '</h4><div class="rar r0">' + (it.kind === 'omen' ? 'Omen' : 'Star') + '</div><p>' + itemDesc(it.kind, it.id) + '</p>' + (note ? '<p class="note">' + note + '</p>' : '') + (!chk.ok ? '<p class="note c-r">' + esc(chk.err) + '</p>' : '');
    showTip(anchor, html, [
      { label: 'Use', cls: 'primary', off: !chk.ok || busy, fn: () => useCons(i) },
      { label: 'Sell $1', cls: 'danger', off: busy, fn: () => act(() => { const r = E.sellCons(run, i); if (r.ok) AU.play('sell'); return r; }) },
    ]);
  }
  async function useCons(i) {
    if (busy) return;
    const it = run.cons[i];
    const sel = selectedIds();
    const before = snapshotStats();
    const r = E.useCons(run, i, sel);
    if (!r.ok) { AU.play('error'); toast(r.err); return; }
    hideTip();
    afterStats(before);
    await showConsResult(it, r);
    save();
  }
  async function showConsResult(it, r) {
    if (it.kind === 'star') {
      AU.play('level'); buzz(20);
      const h = HC.HAND[it.id], v = E.handValue(run, it.id);
      flashPanel(h.name + ' → lvl ' + run.levels[it.id], v.c, v.m);
      toast(h.name + ' leveled up to <b>' + run.levels[it.id] + '</b>');
    } else {
      AU.play('omen'); buzz(15);
      if (r.msg) toast(esc(r.msg));
    }
    for (const id of r.changed || []) { const o = cardEls.get(id); if (o) { o.data = E.card(run, id) || o.data; o.sig = ''; refreshCard(o, id); o.el.classList.remove('pulse'); void o.el.offsetWidth; o.el.classList.add('pulse'); burstAt(o.el, 'spark'); } }
    for (const id of r.destroyed || []) { const o = cardEls.get(id); if (o) { burstAt(o.el, 'shatter'); } removeCard(id); }
    view.sel = [];
    syncHand();
    renderAll();
  }
  function flashPanel(name, c, m) {
    $('hnName').textContent = name; $('hnLvl').textContent = '';
    $('chipsBox').textContent = fmt(c); $('multBox').textContent = fmt(m);
    popBox('chipsBox'); popBox('multBox');
    clearTimeout(flashPanel.t);
    flashPanel.t = setTimeout(() => { if (!busy) updatePreview(); }, 1300);
  }
  function popBox(id) { const b = $(id); b.classList.remove('boxpop'); void b.offsetWidth; b.classList.add('boxpop'); }

  // ================= tip =================
  let tipAnchor = null;
  function showTip(anchor, html, buttons) {
    const t = $('tip');
    t.innerHTML = html + (buttons && buttons.length ? '<div class="tbtns"></div>' : '');
    const bx = t.querySelector('.tbtns');
    (buttons || []).forEach((b) => {
      const e = el('button', 'btn ' + (b.cls || '') + (b.off ? ' off' : ''), b.label);
      e.addEventListener('click', (ev) => { ev.stopPropagation(); AU.unlock(); if (b.off) { AU.play('error'); return; } AU.play('click'); b.fn(); });
      bx.appendChild(e);
    });
    t.classList.remove('hidden');
    tipAnchor = anchor;
    const r = anchor.getBoundingClientRect();
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(10, Math.min(innerWidth - tw - 10, x));
    let y = r.bottom + 10;
    if (y + th > innerHeight - 10) y = r.top - th - 10;
    if (y < 10) y = 10;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  }
  function hideTip() { $('tip').classList.add('hidden'); tipAnchor = null; document.querySelectorAll('.ware.selc').forEach((w) => w.classList.remove('selc')); }
  document.addEventListener('pointerdown', (e) => {
    const t = $('tip');
    if (t.classList.contains('hidden')) return;
    if (t.contains(e.target)) return;
    if (tipAnchor && tipAnchor.contains(e.target)) return;
    hideTip();
  }, true);

  // ================= generic action wrapper =================
  function snapshotStats() { return run ? { o: run.stats.omens, s: run.stats.stars } : { o: 0, s: 0 }; }
  function afterStats(b) {
    if (!run) return;
    meta.omens += Math.max(0, run.stats.omens - b.o);
    meta.stars += Math.max(0, run.stats.stars - b.s);
    checkUnlocks();
  }
  function act(fn) {
    if (busy) return null;
    const b = snapshotStats();
    const r = fn();
    if (r && !r.ok) { AU.play('error'); toast(esc(r.err || 'Not now')); return r; }
    hideTip();
    afterStats(b);
    save();
    renderAll();
    return r;
  }

  // ================= rendering per phase =================
  const VIEWS = ['playView', 'selectView', 'cashView', 'shopView', 'packView'];
  function showView(v) { for (const x of VIEWS) $(x).classList.toggle('hidden', x !== v); }
  function enterTable() {
    show('table');
    syncHand();
    renderAll({ instant: false });
    if (run.phase === 'won') showWin();
  }
  function renderAll(opt) {
    if (!run || screen !== 'table') return;
    const ph = run.phase;
    showView(ph === 'play' ? 'playView' : ph === 'select' ? 'selectView' : ph === 'cashout' ? 'cashView' : ph === 'shop' ? 'shopView' : ph === 'pack' ? 'packView' : 'cashView');
    if (ph === 'play') renderPlay();
    else if (ph === 'select') renderSelect();
    else if (ph === 'cashout') renderCash();
    else if (ph === 'shop') renderShop();
    else if (ph === 'pack') renderPack();
    else if (ph === 'won') $('cashView').innerHTML = '';
    updateHUD();
    computeSizes();
    renderCharms();
    renderCons();
    if (!busy) syncHand();
    layoutCards(opt);
  }
  function renderPlay() {
    const r = run.round;
    const b = r.boss ? HC.BOSS[r.boss] : null;
    const bn = $('bossNote');
    if (b) {
      markSeen('boss', b.id);
      let t = '<b>' + b.name + ':</b> ' + md(b.desc);
      if (r.disabled.length) { const ch = run.charms.find((c) => c.uid === r.disabled[0]); if (ch) t += ' · <b>' + HC.CHARM[ch.id].name + '</b> is off'; }
      if (b.id === 'edict' && r.types.length) t += ' · only <b>' + HC.HAND[r.types[0]].name + '</b>';
      bn.innerHTML = t; bn.classList.remove('hidden');
    } else bn.classList.add('hidden');
    if (!busy) updatePreview();
  }
  function updatePreview() {
    if (!run || run.phase !== 'play' || busy) return;
    const ids = selectedIds();
    const pv = E.preview(run, ids);
    const hn = $('hnName').parentNode;
    hn.classList.remove('blocked');
    $('handTotal').textContent = ''; $('handTotal').classList.remove('flame');
    if (!pv) { $('hnName').textContent = 'Select up to 5 cards'; $('hnLvl').textContent = ''; $('chipsBox').textContent = '0'; $('multBox').textContent = '0'; }
    else if (pv.hidden) { $('hnName').textContent = '??? (face down)'; $('hnLvl').textContent = ''; $('chipsBox').textContent = '?'; $('multBox').textContent = '?'; }
    else {
      $('hnName').textContent = HC.HAND[pv.type].name;
      $('hnLvl').textContent = 'lvl ' + pv.effLvl;
      $('chipsBox').textContent = fmt(pv.c); $('multBox').textContent = fmt(pv.m);
      if (pv.blocked) hn.classList.add('blocked');
    }
    const r = run.round;
    $('playBtn').disabled = !ids.length || r.hands <= 0;
    $('discBtn').disabled = !ids.length || r.discards <= 0;
    const tap = view.lastTap != null && view.hand.indexOf(view.lastTap) >= 0 ? E.card(run, view.lastTap) : null;
    let info = 'Tap cards to select · drag to reorder';
    if (tap) info = isFd(view.lastTap) ? 'Face-down card' : cardDescLine(tap) + (E.isDebuffed(run, tap) ? ' · DEBUFFED' : '');
    $('infoLine').textContent = info;
  }

  function renderSelect() {
    const v = $('selectView');
    v.innerHTML = '';
    const h = el('div', 'vhead', '<h2>Ante ' + run.ante + (run.ante > 8 ? ' <small style="color:var(--pink)">endless</small>' : '') + '</h2><span class="pill">Seed ' + esc(run.seed) + '</span>');
    v.appendChild(h);
    const box = el('div', 'blinds');
    for (let i = 0; i < 3; i++) {
      const info = E.blindInfo(run, i);
      if (info.boss) markSeen('boss', info.boss.id);
      const st = i < run.blind ? 'done' : i === run.blind ? 'next' : '';
      const b = el('div', 'blind ' + st);
      b.style.setProperty('--bcol', info.boss ? info.boss.color : i ? '#e8902f' : '#2f7fe8');
      b.innerHTML = '<img src="' + A.chipURL(info.boss ? info.boss.id : i ? 'big' : 'small') + '" alt=""><div class="bi"><div class="tag">' + (i === 2 ? 'Boss Blind' : HC.BLIND_NAMES[i]) + (st === 'done' ? ' · defeated' : '') + '</div><div class="bn">' + info.name + '</div><div class="bt">Score at least <b>' + fmt(info.target) + '</b> · ' + (info.reward ? '<span class="c-d">$' + info.reward + '</span>' : 'no reward') + '</div>' + (info.boss ? '<div class="bd">' + md(info.boss.desc) + '</div>' : '') + '</div>';
      if (st === 'next') {
        const pb = el('button', 'btn primary', 'Play');
        pb.id = 'blindPlay';
        pb.addEventListener('click', () => { AU.unlock(); doStartBlind(); });
        b.appendChild(pb);
      }
      box.appendChild(b);
    }
    v.appendChild(box);
  }
  function doStartBlind() {
    if (busy || run.phase !== 'select') return;
    const r = E.startBlind(run);
    if (!r.ok) return;
    if (DEBUG && Q.get('god') === '1') run.round.target = 1;
    AU.play('shuffle'); buzz(12);
    view.sel = []; view.lastTap = null;
    save();
    renderAll();
    for (const m of r.msgs) { wiggle(m.uid); popAt(tileEls.get(m.uid) && tileEls.get(m.uid).el, m.t, 'info'); }
    if (run.round.boss) { const b = HC.BOSS[run.round.boss]; splash(b.name, true); }
  }

  function renderCash() {
    const v = $('cashView');
    const co = run.cashout;
    v.innerHTML = '';
    v.appendChild(el('div', 'vhead', '<h2>Cash out</h2><span class="pill">' + fmt(run.round.score) + ' / ' + fmt(run.round.target) + '</span>'));
    const c = el('div', 'cash');
    co.lines.forEach((l, i) => {
      const ln = el('div', 'ln' + (l.v ? '' : ' info'), '<span>' + esc(l.label) + '</span><b>' + (l.v ? '+$' + l.v : '✓') + '</b>');
      ln.style.animationDelay = (i * 0.16 / spd()) + 's';
      c.appendChild(ln);
      setTimeout(() => AU.play('tick'), i * 160 / spd());
    });
    if (!co.lines.length) c.appendChild(el('div', 'sum', 'No payout this time.'));
    for (const uid of co.gone || []) toast('A Charm shattered!');
    v.appendChild(c);
    const b = el('button', 'btn primary big', 'Cash out  $' + co.total);
    b.id = 'cashBtn';
    b.addEventListener('click', () => {
      AU.unlock();
      if (busy) return;
      const r = E.cashOut(run);
      if (!r.ok) return;
      AU.play('cash'); buzz(15); bumpStat('hMoney');
      meta.bestAnte = Math.max(meta.bestAnte, run.endless ? run.ante : Math.min(8, run.ante));
      checkUnlocks();
      if (r.won) { save(); renderAll(); showWin(); return; }
      save(); renderAll();
    });
    v.appendChild(b);
  }

  function renderShop() {
    const v = $('shopView');
    v.innerHTML = '';
    const nb = E.blindInfo(run);
    v.appendChild(el('div', 'vhead', '<h2>Shop</h2><span class="pill">Next: ' + esc(nb.name) + ' · ' + fmt(nb.target) + '</span>'));
    const wrap = el('div', 'shopwrap');
    const s1 = el('div', 'shelf', '<div class="lbl">For sale</div>');
    run.shop.items.forEach((it, i) => {
      markSeen(it.kind, it.id);
      s1.appendChild(ware(it.kind, it.id, it.price, it.sold, it.ed, () => shopItemTip(i)));
    });
    wrap.appendChild(s1);
    const s2 = el('div', 'shelf', '<div class="lbl">Voucher &amp; packs</div>');
    if (run.anteVoucher) { markSeen('voucher', run.anteVoucher); s2.appendChild(ware('voucher', run.anteVoucher, E.voucherPrice(run), run.voucherSold, null, () => voucherTip())); }
    run.shop.packs.forEach((p, i) => s2.appendChild(ware('pack', p.id, p.price, p.sold, null, () => packTip(i))));
    wrap.appendChild(s2);
    v.appendChild(wrap);
    const btns = el('div', 'shopbtns');
    const rc = E.rerollCost(run);
    const rb = el('button', 'btn green' + (run.money < rc ? ' off' : ''), 'Reroll $' + rc);
    rb.id = 'rerollBtn';
    rb.addEventListener('click', () => { AU.unlock(); act(() => { const r = E.reroll(run); if (r.ok) { AU.play('reroll'); buzz(8); bumpStat('hMoney'); } return r; }); });
    const nx = el('button', 'btn primary', 'Next round ›');
    nx.id = 'nextBtn';
    nx.addEventListener('click', () => { AU.unlock(); act(() => { const r = E.nextRound(run); if (r.ok) AU.play('click'); return r; }); });
    btns.appendChild(rb); btns.appendChild(nx);
    v.appendChild(btns);
  }
  function ware(kind, id, price, sold, ed, fn, label) {
    const w = el('button', 'ware' + (sold ? ' sold' : '') + (price != null && run.money < price ? ' poor' : ''));
    const art = el('div', 'art' + (ed ? ' ed-' + ed : ''));
    art.appendChild(Object.assign(new Image(), { src: kind === 'card' ? A.cardURL(id) : itemURL(kind, id), alt: '' }));
    w.appendChild(art);
    if (price != null) w.appendChild(el('span', 'price', sold ? 'sold' : '$' + price));
    else if (label) w.appendChild(el('span', 'kind', label));
    w.setAttribute('aria-label', kind === 'card' ? cardName(id) : itemName(kind, id));
    w.addEventListener('click', () => { AU.unlock(); AU.play('click'); hideTip(); w.classList.add('selc'); fn(w); });
    return w;
  }
  function shopItemTip(i) {
    const it = run.shop.items[i];
    const anchor = $('shopView').querySelectorAll('.shelf')[0].querySelectorAll('.ware')[i];
    let html = '<h4>' + itemName(it.kind, it.id) + '</h4>';
    if (it.kind === 'charm') { const d = HC.CHARM[it.id]; html += '<div class="rar r' + d.r + '">' + HC.RARITY[d.r] + ' Charm' + (it.ed ? ' · ' + HC.ED[it.ed].name + ' (' + md(HC.ED[it.ed].desc) + ')' : '') + '</div>'; }
    else html += '<div class="rar r0">' + (it.kind === 'omen' ? 'Omen' : 'Star') + '</div>';
    html += '<p>' + itemDesc(it.kind, it.id) + '</p>';
    const btns = [{ label: 'Buy $' + it.price, cls: 'primary', off: run.money < it.price, fn: () => buyItem(i, false) }];
    if (it.kind !== 'charm') {
      const o = it.kind === 'omen' ? HC.OMEN[it.id] : null;
      if (!o || !o.need) btns.push({ label: 'Buy & use', cls: 'blue', off: run.money < it.price, fn: () => buyItem(i, true) });
      else html += '<p class="note">Needs cards: buy it now, use it during a round.</p>';
    }
    showTip(anchor, html, btns);
  }
  async function buyItem(i, use) {
    const it = run.shop.items[i];
    const before = snapshotStats();
    const r = E.buy(run, i, use);
    if (!r.ok) { AU.play('error'); toast(esc(r.err)); return; }
    AU.play('buy'); buzz(10); bumpStat('hMoney');
    hideTip(); afterStats(before); save();
    if (r.used) await showConsResult({ kind: it.kind, id: it.id }, r);
    else renderAll();
  }
  function voucherTip() {
    const anchor = $('shopView').querySelectorAll('.shelf')[1].querySelector('.ware');
    const pr = E.voucherPrice(run);
    showTip(anchor, '<h4>' + HC.VOUCHER[run.anteVoucher].name + '</h4><div class="rar r0">Voucher · permanent</div><p>' + itemDesc('voucher', run.anteVoucher) + '</p><p class="note">One voucher per ante.</p>', [
      { label: 'Redeem $' + pr, cls: 'primary', off: run.money < pr, fn: () => act(() => { const r = E.buyVoucher(run); if (r.ok) { AU.play('buy'); buzz(12); toast('<b>' + HC.VOUCHER[r.id].name + '</b> redeemed'); } return r; }) },
    ]);
  }
  function packTip(i) {
    const p = run.shop.packs[i];
    const wares = $('shopView').querySelectorAll('.shelf')[1].querySelectorAll('.ware');
    const anchor = wares[(run.anteVoucher ? 1 : 0) + i];
    showTip(anchor, '<h4>' + HC.PACKS[p.id].name + '</h4><p>' + itemDesc('pack', p.id) + '</p>', [
      { label: 'Open $' + p.price, cls: 'primary', off: run.money < p.price, fn: () => act(() => { const r = E.buyPack(run, i); if (r.ok) { AU.play('pack'); buzz(15); view.sel = []; } return r; }) },
    ]);
  }

  function renderPack() {
    const v = $('packView');
    const pk = run.pack;
    const def = HC.PACKS[pk.id];
    v.innerHTML = '';
    v.appendChild(el('div', 'packhead', '<h2>' + def.name + '</h2><small>Choose ' + pk.picks + ' more · ' + def.n + ' on offer</small>'));
    const ch = el('div', 'choices');
    pk.choices.forEach((c, i) => {
      const w = c.kind === 'card' ? ware('card', c.card, null, false, c.card.ed, () => packChoiceTip(i, w), cardShort(c.card)) : ware(c.kind, c.id, null, false, c.ed, () => packChoiceTip(i, w), itemName(c.kind, c.id));
      if (c.kind !== 'card') markSeen(c.kind, c.id);
      if (c.taken) w.classList.add('taken');
      ch.appendChild(w);
    });
    v.appendChild(ch);
    if (pk.kind === 'omen') {
      v.appendChild(el('div', 'zone', '')).id = 'packHand';
      v.appendChild(el('div', 'infoline', 'Select cards, then tap an Omen to use it'));
    }
    const pb = el('div', 'packbtns');
    const sk = el('button', 'btn', 'Skip');
    sk.id = 'skipBtn';
    sk.addEventListener('click', () => { AU.unlock(); act(() => { const r = E.packSkip(run); if (r.ok) AU.play('click'); return r; }); });
    pb.appendChild(sk);
    v.appendChild(pb);
  }
  const cardShort = (c) => (c.enh === 'stone' ? 'Stone' : HC.RANK_CH[c.rank] + HC.SUIT_CH[c.suit]);
  function packChoiceTip(i, anchor) {
    const c = run.pack.choices[i];
    let html, label = 'Take';
    if (c.kind === 'card') {
      html = '<h4>' + cardName(c.card) + '</h4><p>' + esc(cardDescLine(c.card)) + '</p>';
      label = 'Add to deck';
    } else {
      html = '<h4>' + itemName(c.kind, c.id) + '</h4>';
      if (c.kind === 'charm') { const d = HC.CHARM[c.id]; html += '<div class="rar r' + d.r + '">' + HC.RARITY[d.r] + (c.ed ? ' · ' + HC.ED[c.ed].name : '') + '</div>'; }
      html += '<p>' + itemDesc(c.kind, c.id) + '</p>';
      if (c.kind !== 'charm') label = 'Use';
      const o = c.kind === 'omen' ? HC.OMEN[c.id] : null;
      if (o && o.need) html += '<p class="note">Selected: ' + selectedIds().length + ' (needs ' + (o.need[0] === o.need[1] ? o.need[0] : o.need[0] + '–' + o.need[1]) + ')</p>';
    }
    showTip(anchor, html, [{ label, cls: 'primary', fn: () => pickPack(i) }]);
  }
  async function pickPack(i) {
    if (busy) return;
    const c = run.pack.choices[i];
    const before = snapshotStats();
    const sel = selectedIds();
    const r = E.packPick(run, i, sel);
    if (!r.ok) { AU.play('error'); toast(esc(r.err)); return; }
    hideTip(); afterStats(before);
    if (c.kind === 'charm') { AU.play('buy'); toast('<b>' + HC.CHARM[c.id].name + '</b> joins your Charms'); }
    else if (c.kind === 'card') { AU.play('deal'); toast('Added <b>' + cardName(c.card) + '</b> to your deck'); }
    save();
    if (c.kind === 'star' || c.kind === 'omen') {
      if (c.kind === 'star') { AU.play('level'); const h = HC.HAND[c.id]; toast(h.name + ' leveled up to <b>' + run.levels[c.id] + '</b>'); }
      else { AU.play('omen'); if (r.msg) toast(esc(r.msg)); }
      for (const id of r.changed || []) { const o = cardEls.get(id); if (o) { o.data = E.card(run, id) || o.data; o.sig = ''; refreshCard(o, id); o.el.classList.remove('pulse'); void o.el.offsetWidth; o.el.classList.add('pulse'); burstAt(o.el, 'spark'); } }
      for (const id of r.destroyed || []) { const o = cardEls.get(id); if (o) burstAt(o.el, 'shatter'); }
      view.sel = [];
      if (run.phase === 'pack' && run.pack.kind === 'omen' && (r.changed || []).length) await wait(500);
    }
    syncHand();
    renderAll();
  }

  // ================= playing a hand =================
  function cardEl(id) { const o = cardEls.get(id); return o ? o.el : null; }
  async function doPlay() {
    if (busy || !run || run.phase !== 'play') return;
    const ids = selectedIds();
    if (!ids.length) return;
    hideTip();
    const prevScore = run.round.score, target = run.round.target;
    const moneyBefore = run.money;
    const res = E.play(run, ids);
    if (!res.ok) { AU.play('error'); toast(esc(res.err)); return; }
    meta.handsPlayed++;
    if (res.score.total > meta.bestHand) { meta.bestHand = res.score.total; meta.bestType = res.score.type; }
    save();
    busy = true; view.sel = []; setTurbo(1);
    document.body.classList.add('busy');
    let money = moneyBefore - res.tax;
    $('hMoney').textContent = '$' + money;
    $('playBtn').disabled = true; $('discBtn').disabled = true;
    AU.play('deal'); buzz(10);
    try {
      if (res.tax) { popAt($('hMoney'), '-$' + res.tax, 'bad'); bumpStat('hMoney'); }
      if (res.cut.length) {
        for (const id of res.cut) { removeCard(id, 'fly'); }
        view.hand = view.hand.filter((id) => res.cut.indexOf(id) < 0);
        popAt($('handZone'), 'The Cutpurse!', 'bad');
        await wait(300);
      }
      view.hand = view.hand.filter((id) => res.played.indexOf(id) < 0);
      view.played = res.played.slice();
      $('hHands').textContent = run.round.hands; bumpStat('hHands');
      layoutCards();
      await wait(340);
      for (const id of res.faceDown) { const o = cardEls.get(id); if (o) { o.sig = ''; refreshCard(o, id); } }
      if (res.faceDown.length) await wait(200);
      money = await runEvents(res.score.events, prevScore, target, money);
      await wait(380);
      for (const id of view.played) removeCard(id, 'fly');
      view.played = []; view.lift.clear(); view.dim.clear();
      if (res.hot) wiggle(res.hot);
      await wait(260);
    } finally {
      busy = false; setTurbo(1);
      document.body.classList.remove('busy');
    }
    if (res.won) {
      splash('Blind defeated!');
      AU.play('win'); buzz([30, 40, 60]);
      await wait(700);
      syncHand(); renderAll();
    } else if (res.lost) {
      gameOver();
    } else {
      syncHand(); renderAll();
    }
  }
  async function runEvents(evs, prevScore, target, money) {
    let step = 0;
    const pz = $('playZone');
    for (const e of evs) {
      switch (e.k) {
        case 'base': {
          $('hnName').textContent = HC.HAND[e.type].name; $('hnLvl').textContent = 'lvl ' + e.lvl;
          $('chipsBox').textContent = fmt(e.c); $('multBox').textContent = fmt(e.m);
          $('handTotal').textContent = ''; $('handTotal').classList.remove('flame');
          popBox('chipsBox'); popBox('multBox');
          for (const id of view.played) { if (e.scoring.indexOf(id) >= 0) view.lift.add(id); else view.dim.add(id); }
          layoutCards();
          AU.play('select');
          await wait(400);
          break;
        }
        case 'blocked':
          $('hnName').parentNode.classList.add('blocked');
          popAt(pz, 'Not allowed!', 'bad', true);
          AU.play('debuff'); buzz(30);
          await wait(800);
          break;
        case 'debuff': {
          const c = cardEl(e.id);
          if (c) { c.classList.remove('shakec'); void c.offsetWidth; c.classList.add('shakec'); }
          popAt(c, 'Debuffed', 'bad'); AU.play('debuff');
          await wait(280);
          break;
        }
        case 'again': {
          const c = cardEl(e.id);
          if (e.uid != null) wiggle(e.uid);
          popAt(c, 'Again!', 'again'); AU.play('again');
          await wait(230);
          break;
        }
        case 'fx': {
          const isCharm = e.src === 'charm';
          const anchor = isCharm ? (tileEls.get(e.uid) || {}).el : cardEl(e.id);
          if (e.uid != null) wiggle(e.uid);
          if (!isCharm && anchor) { anchor.classList.remove('pulse'); void anchor.offsetWidth; anchor.classList.add('pulse'); }
          step++;
          let txt, dur = 230;
          if (e.kind === 'chips') { txt = '+' + fmt(e.v); AU.play('chip', step); $('chipsBox').textContent = fmt(e.c); popBox('chipsBox'); }
          else if (e.kind === 'mult') { txt = '+' + fmt(e.v) + ' Mult'; AU.play('mult', step); $('multBox').textContent = fmt(e.m); popBox('multBox'); dur = 250; }
          else if (e.kind === 'xmult') { txt = '×' + (Math.round(e.v * 100) / 100); AU.play('xmult', step); $('multBox').textContent = fmt(e.m); popBox('multBox'); shake(); buzz(15); dur = 380; }
          else if (e.kind === 'money') { txt = '+$' + e.v; AU.play('money'); money += e.v; $('hMoney').textContent = '$' + money; bumpStat('hMoney'); burstAt(anchor, 'coin'); dur = 250; }
          else { txt = e.t; AU.play('charm', step); dur = 300; }
          popAt(anchor, txt, e.kind, isCharm);
          await wait(dur);
          break;
        }
        case 'final': {
          const total = e.total;
          AU.play('final');
          rollTo($('handTotal'), 0, total, 520 / spd());
          await wait(560);
          const ns = prevScore + total;
          rollTo($('roundScore'), prevScore, ns, 480 / spd());
          if (total >= target) {
            $('handTotal').classList.add('flame');
            flames($('handTotal'), 1500, 1.6);
          }
          if (ns >= target) {
            $('scoreBox').classList.add('hot');
            flames($('scoreBox'), 1400, 1);
            AU.play('flame'); buzz([20, 30, 40]);
            shake();
            await wait(650);
          } else await wait(420);
          break;
        }
        case 'shatter': {
          const c = cardEl(e.id);
          if (c) burstAt(c, 'shatter');
          AU.play('shatter'); buzz(20);
          removeCard(e.id);
          view.played = view.played.filter((id) => id !== e.id);
          await wait(300);
          break;
        }
      }
    }
    return money;
  }
  async function doDiscard() {
    if (busy || !run || run.phase !== 'play') return;
    const ids = selectedIds();
    if (!ids.length) return;
    hideTip();
    const res = E.discard(run, ids);
    if (!res.ok) { AU.play('error'); toast(esc(res.err)); return; }
    save();
    busy = true; view.sel = [];
    AU.play('deal'); buzz(8);
    for (const id of res.discarded) removeCard(id, 'fly');
    view.hand = view.hand.filter((id) => res.discarded.indexOf(id) < 0);
    $('hDisc').textContent = run.round.discards; bumpStat('hDisc');
    layoutCards();
    for (const m of res.msgs) { wiggle(m.uid); popAt((tileEls.get(m.uid) || {}).el, m.t, 'info', true); }
    if (res.omens) toast('Purple Seal: +' + res.omens + ' Omen');
    await wait(260);
    busy = false;
    if (res.lost) { gameOver(); return; }
    syncHand(); renderAll();
  }
  function sortHand(by) {
    if (busy || !run) return;
    AU.play('shuffle');
    if (run.phase === 'play') { E.sortHand(run, by); save(); syncHand(); }
    else if (run.pack && run.pack.hand) {
      const k = (id) => { const c = E.card(run, id); return by === 'suit' ? (4 - c.suit) * 100 + c.rank : c.rank * 10 + (4 - c.suit); };
      run.pack.hand.sort((a, b) => k(b) - k(a)); syncHand();
    }
    layoutCards();
  }

  // ================= game over / win =================
  function recordRun(won) {
    const r = run;
    const ante = r.phase === 'won' ? r.ante - 1 : r.ante;
    meta.history.unshift({ date: Date.now(), seed: r.seed, deck: r.deck, stake: r.stake, ante, won: !!(won || r.winCounted), best: r.stats.best, bestType: r.stats.bestType,
      lostTo: won ? '' : r.round ? r.round.name : '' });
    meta.history = meta.history.slice(0, 30);
    meta.bestAnte = Math.max(meta.bestAnte, ante);
    checkUnlocks();
  }
  function runSummary(r) {
    const mp = E.mostPlayed(r);
    return '<div class="kv"><span>Deck</span><b>' + esc(HC.DECK[r.deck].name) + '</b><span>Stake</span><b>' + HC.STAKES[r.stake].name + '</b><span>Ante reached</span><b>' + (r.phase === 'won' ? r.ante - 1 : r.ante) + '</b>' +
      '<span>Best hand</span><b>' + fmt(r.stats.best) + (r.stats.bestType ? ' · ' + HC.HAND[r.stats.bestType].name : '') + '</b><span>Most played</span><b>' + (mp ? HC.HAND[mp].name + ' ×' + r.plays[mp] : '—') + '</b>' +
      '<span>Hands / discards</span><b>' + r.stats.hands + ' / ' + r.stats.discards + '</b><span>Money earned</span><b>$' + r.stats.money + '</b><span>Charms</span><b>' + (r.charms.map((c) => HC.CHARM[c.id].name).join(', ') || '—') + '</b></div>' +
      '<div class="seedline">' + esc(r.seed) + '</div><p class="sub" style="margin:0 auto">Seed — replay it from New Run</p>';
  }
  function gameOver() {
    const r = run;
    AU.play('lose'); buzz([60, 40, 90]);
    splash('Busted', true);
    recordRun(false);
    run = null;
    save();
    setTimeout(() => {
      openSheet('<div class="bigtitle lose">BUSTED</div><p class="sub" style="margin:0 auto 6px">' + esc(r.round ? r.round.name : '') + ' wanted ' + fmt(r.round ? r.round.target : 0) + ', you had ' + fmt(r.round ? r.round.score : 0) + '</p>' + runSummary(r) +
        '<div class="row2"><button class="btn primary" id="ovAgain">New run</button><button class="btn" id="ovTitle">Title</button></div>', true);
      $('ovAgain').addEventListener('click', () => { closeSheet(); startNewRun({ deck: r.deck, stake: r.stake }); });
      $('ovTitle').addEventListener('click', () => { closeSheet(); show('title'); });
    }, 900);
  }
  function showWin() {
    const r = run;
    if (!r.winCounted) { r.winCounted = true; meta.wins++; meta.maxStakeWon = Math.max(meta.maxStakeWon, r.stake); meta.bestAnte = Math.max(meta.bestAnte, 8); checkUnlocks(); save(); }
    confetti();
    openSheet('<div class="bigtitle win">YOU BEAT<br>THE HOUSE</div><p class="sub" style="margin:0 auto 6px">All 8 antes cleared. Keep riding the streak in endless mode, or cash in.</p>' + runSummary(r) +
      '<button class="btn primary" id="winEndless">Keep playing (endless)</button><button class="btn" id="winEnd">Cash in &amp; finish</button>', true);
    $('winEndless').addEventListener('click', () => { closeSheet(); E.goEndless(run); save(); renderAll(); });
    $('winEnd').addEventListener('click', () => { closeSheet(); recordRun(true); run = null; save(); show('title'); });
  }

  // ================= modals =================
  let sheetLocked = false;
  function openSheet(html, locked) {
    hideTip();
    $('sheet').innerHTML = html;
    $('modal').classList.remove('hidden');
    sheetLocked = !!locked;
    $('sheet').scrollTop = 0;
    $('sheet').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { AU.play('click'); closeSheet(); }));
  }
  function closeSheet() { $('modal').classList.add('hidden'); sheetLocked = false; }
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal') && !sheetLocked) closeSheet(); });
  function confirmSheet(title, text, yes, fn) {
    openSheet('<h2>' + title + '</h2><p class="sub" style="margin:0 auto">' + text + '</p><div class="row2"><button class="btn danger" id="cfYes">' + yes + '</button><button class="btn" data-close>Cancel</button></div>');
    $('cfYes').addEventListener('click', () => { AU.play('click'); closeSheet(); fn(); });
  }
  function openMenu() {
    if (!run) return;
    AU.play('click');
    openSheet('<h2>Paused</h2><div class="kv"><span>Seed</span><b>' + esc(run.seed) + '</b><span>Deck · Stake</span><b>' + esc(HC.DECK[run.deck].name) + ' · ' + HC.STAKES[run.stake].name + '</b><span>Best hand this run</span><b>' + fmt(run.stats.best) + '</b></div>' +
      '<div class="list" id="menuSet"></div><div class="row2"><button class="btn" id="mInfo">Run info</button><button class="btn" id="mDeck">Deck</button></div>' +
      '<button class="btn primary" data-close>Resume</button><button class="btn" id="mQuit">Save &amp; quit to title</button><button class="btn danger" id="mAbandon">Abandon run</button>' +
      (DEBUG ? '<h3>Debug</h3><div class="row2"><button class="btn small" id="dMoney">+$50</button><button class="btn small" id="dWin">Win blind</button><button class="btn small" id="dAnte">Ante +1</button></div><div class="row2"><button class="btn small" id="dCharm">Random charm</button><button class="btn small" id="dOmen">Random omen</button><button class="btn small" id="dLose">Lose</button></div>' : ''));
    buildSettings($('menuSet'), true);
    $('mInfo').addEventListener('click', () => { AU.play('click'); openRunInfo(); });
    $('mDeck').addEventListener('click', () => { AU.play('click'); openDeck(); });
    $('mQuit').addEventListener('click', () => { AU.play('click'); closeSheet(); save(); show('title'); });
    $('mAbandon').addEventListener('click', () => confirmSheet('Abandon this run?', 'It will count as a loss in your records.', 'Abandon', () => { recordRun(false); run = null; save(); show('title'); }));
    if (DEBUG) {
      const dbg = (id, fn) => $(id).addEventListener('click', () => { fn(); save(); closeSheet(); syncHand(); renderAll(); });
      dbg('dMoney', () => { run.money += 50; });
      dbg('dWin', () => { E.forceWin(run); });
      dbg('dAnte', () => { run.ante++; run.bosses[run.ante] = null; delete run.bosses[run.ante]; });
      dbg('dCharm', () => { if (run.charms.length < run.charmSlots) run.charms.push(E.mkCharm(run, HC.CHARMS[Math.floor(Math.random() * HC.CHARMS.length)].id)); });
      dbg('dOmen', () => { E.gainOmen(run); });
      $('dLose').addEventListener('click', () => { closeSheet(); if (run.phase === 'play') { run.phase = 'over'; gameOver(); } });
    }
  }
  function openRunInfo() {
    if (!run) return;
    const rows = HC.HANDS.filter((h) => !h.secret || run.plays[h.k] || run.levels[h.k] > 1).map((h) => {
      const v = E.handValue(run, h.k);
      return '<tr><td><span class="lv">' + run.levels[h.k] + '</span> ' + h.name + '</td><td class="n"><span class="c-c">' + v.c + '</span> × <span class="c-m">' + v.m + '</span></td><td class="n" style="color:var(--dim)">#' + run.plays[h.k] + '</td></tr>';
    }).join('');
    const vs = run.vouchers.map((v) => '<b>' + HC.VOUCHER[v].name + '</b>: ' + md(HC.VOUCHER[v].desc)).join('<br>') || 'None yet';
    const boss = E.blindInfo(run, 2).boss;
    openSheet('<h2>Run info</h2><table class="lvtable"><tr><td style="color:var(--dim)">Hand</td><td class="n" style="color:var(--dim)">Chips × Mult</td><td class="n" style="color:var(--dim)">Played</td></tr>' + rows + '</table>' +
      '<h3>Vouchers</h3><p class="sub" style="text-align:left;max-width:none">' + vs + '</p>' +
      (boss ? '<h3>This ante\'s boss</h3><p class="sub" style="text-align:left;max-width:none"><b>' + boss.name + '</b>: ' + md(boss.desc) + '</p>' : '') +
      '<div class="seedline">' + esc(run.seed) + '</div><button class="btn" data-close>Close</button>');
  }
  function openDeck() {
    if (!run) return;
    const inRound = run.phase === 'play';
    let html = '<h2>Deck</h2><p class="sub" style="margin:0 auto 8px">' + (inRound ? run.draw.length + ' left in the draw pile of ' + run.cards.length : run.cards.length + ' cards') + '</p><div class="deckgrid">';
    for (const s of [0, 1, 2, 3]) {
      const cs = run.cards.filter((c) => c.suit === s && c.enh !== 'stone').sort((a, b) => b.rank - a.rank);
      if (!cs.length) continue;
      for (const c of cs) html += '<img src="' + A.cardURL(c) + '" class="' + (inRound && run.draw.indexOf(c.id) < 0 ? 'used' : '') + '" alt="">';
      html += '<div class="gap"></div>';
    }
    for (const c of run.cards.filter((x) => x.enh === 'stone')) html += '<img src="' + A.cardURL(c) + '" class="' + (inRound && run.draw.indexOf(c.id) < 0 ? 'used' : '') + '" alt="">';
    html += '</div><button class="btn" data-close>Close</button>';
    openSheet(html);
  }

  // ================= fx: popups, splash, particles, rolls =================
  const popLayer = $('popLayer');
  const popPool = [];
  function popAt(anchor, text, kind, below) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    if (anchor._pop && anchor._pop._busy && anchor._pop._anchor === anchor) { anchor._pop._busy = false; anchor._pop.style.display = 'none'; }
    let p = popPool.find((x) => !x._busy);
    if (!p) { p = el('div', 'pop'); popLayer.appendChild(p); popPool.push(p); p.addEventListener('animationend', () => { p._busy = false; p.style.display = 'none'; }); }
    p._busy = true; p._anchor = anchor; anchor._pop = p;
    p.className = 'pop ' + (kind || 'info');
    p.textContent = text;
    p.style.display = 'block';
    p.style.left = (r.left + r.width / 2) + 'px';
    p.style.top = (below ? r.bottom + 30 : r.top + 6) + 'px';
    p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  }
  function splash(text, bad) {
    const s = $('splash');
    s.textContent = text; s.className = 'splash' + (bad ? ' bad' : '');
    s.style.animation = 'none'; void s.offsetWidth; s.style.animation = '';
    clearTimeout(splash.t); splash.t = setTimeout(() => s.classList.add('hidden'), 1500);
  }
  function shake() {
    if (!set.shake || set.reduced) return;
    const t = $('table'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake');
  }
  const cv = $('fx'), g = cv.getContext('2d');
  let dpr = 1, fxOn = false;
  const PN = 420;
  const parts = [];
  for (let i = 0; i < PN; i++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, k: 0, hue: 0 });
  const emitters = [];
  const tweens = [];
  const FLAME = [], SHARD = 'rgb(200,245,255)', COIN = 'rgb(255,205,60)', SPARK = 'rgb(255,250,170)';
  for (let i = 0; i < 32; i++) { const f = i / 31; FLAME.push('hsl(' + Math.round(8 + f * 44) + ',100%,' + Math.round(48 + f * 22) + '%)'); }
  const CONF = []; for (let i = 0; i < 12; i++) CONF.push('hsl(' + i * 30 + ',90%,60%)');
  function resizeFx() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  }
  function spawn(x, y, vx, vy, life, size, k, hue) {
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (p.on) continue;
      p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.k = k; p.hue = hue;
      return;
    }
  }
  function flames(anchor, ms, power) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    emitters.push({ l: r.left, t: r.top, w: r.width, h: r.height, until: performance.now() + ms * (set.reduced ? 0.5 : 1), p: power || 1 });
    startFx();
  }
  function burstAt(anchor, kind) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const n = set.reduced ? 8 : kind === 'shatter' ? 34 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (kind === 'shatter' ? 120 : 90) + Math.random() * 160;
      spawn(cx + (Math.random() - 0.5) * r.width * 0.6, cy + (Math.random() - 0.5) * r.height * 0.6, Math.cos(a) * s, Math.sin(a) * s - 120, 0.7 + Math.random() * 0.5,
        kind === 'shatter' ? 3 + Math.random() * 5 : 3 + Math.random() * 3, kind === 'shatter' ? 2 : kind === 'coin' ? 3 : 4, kind === 'coin' ? 45 : 190);
    }
    startFx();
  }
  function confetti() {
    const n = set.reduced ? 40 : 160;
    for (let i = 0; i < n; i++) spawn(Math.random() * innerWidth, -10 - Math.random() * 100, (Math.random() - 0.5) * 120, 80 + Math.random() * 160, 2.5 + Math.random() * 1.5, 4 + Math.random() * 4, 5, Math.random() * 360);
    startFx();
  }
  function rollTo(elm, from, to, ms) {
    for (const t of tweens) if (t.el === elm) t.done = true;
    tweens.push({ el: elm, from, to, t0: performance.now(), ms: Math.max(1, ms), done: false });
    startFx();
  }
  function clearFx() { for (const p of parts) p.on = false; emitters.length = 0; }
  let lastT = 0;
  function startFx() { if (!fxOn) { fxOn = true; lastT = performance.now(); requestAnimationFrame(fxLoop); } }
  function fxLoop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    let alive = 0;
    for (let i = emitters.length - 1; i >= 0; i--) {
      const em = emitters[i];
      if (now > em.until) { emitters.splice(i, 1); continue; }
      const n = Math.ceil(7 * em.p);
      for (let k = 0; k < n; k++) spawn(em.l + Math.random() * em.w, em.t + em.h * (0.55 + Math.random() * 0.45), (Math.random() - 0.5) * 30, -110 - Math.random() * 170 * em.p, 0.3 + Math.random() * 0.4, 3 + Math.random() * 6 * em.p, 1, 0);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      alive++;
      const f = p.life / p.max;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 1) {
        p.vy -= 90 * dt; p.vx *= 0.96;
        g.globalAlpha = f * 0.9; g.fillStyle = FLAME[(f * 31) | 0];
        const sz2 = p.size * (0.35 + f * 0.65);
        g.beginPath(); g.ellipse(p.x, p.y, sz2 * 0.7, sz2 * 1.3, 0, 0, 6.283); g.fill();
      } else if (p.k === 5) {
        p.vy += 10 * dt; p.x += Math.sin(now / 300 + i) * 0.6;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, f * 2); g.fillStyle = CONF[(p.hue / 30) | 0];
        g.fillRect(p.x, p.y, p.size, p.size * 0.6); g.globalCompositeOperation = 'lighter';
      } else {
        p.vy += 520 * dt; g.globalAlpha = f; g.fillStyle = p.k === 3 ? COIN : p.k === 2 ? SHARD : SPARK;
        g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (let i = tweens.length - 1; i >= 0; i--) {
      const t = tweens[i];
      if (t.done) { tweens.splice(i, 1); continue; }
      const k = Math.min(1, (now - t.t0) / t.ms);
      const e = 1 - Math.pow(1 - k, 3);
      t.el.textContent = fmt(t.from + (t.to - t.from) * e);
      if (k >= 1) { t.el.textContent = fmt(t.to); tweens.splice(i, 1); }
    }
    if (alive || emitters.length || tweens.length) requestAnimationFrame(fxLoop);
    else { fxOn = false; g.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ================= input wiring =================
  on('continueBtn', () => { AU.play('click'); if (run) enterTable(); });
  on('newRunBtn', () => { AU.play('click'); if (run) confirmSheet('Start a new run?', 'Your run in progress will be abandoned and recorded as a loss.', 'New run', () => { recordRun(false); run = null; save(); show('newrun'); }); else show('newrun'); });
  on('collBtn', () => { AU.play('click'); show('collection'); });
  on('recBtn', () => { AU.play('click'); show('records'); });
  on('howBtn', () => { AU.play('click'); show('howto'); });
  on('setBtn', () => { AU.play('click'); show('settings'); });
  on('playBtn', doPlay);
  on('discBtn', doDiscard);
  on('sortRank', () => sortHand('rank'));
  on('sortSuit', () => sortHand('suit'));
  on('menuBtn', openMenu);
  on('infoBtn', () => { AU.play('click'); openRunInfo(); });
  on('deckBtn', () => { AU.play('click'); openDeck(); });
  // tap anywhere while scoring = fast forward
  document.addEventListener('pointerdown', () => { AU.unlock(); if (busy && turbo === 1) setTurbo(4); }, true);
  document.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    AU.unlock();
    if (e.key === 'Escape') {
      if (!$('tip').classList.contains('hidden')) { hideTip(); return; }
      if (!$('modal').classList.contains('hidden')) { if (!sheetLocked) closeSheet(); return; }
      if (screen === 'table') openMenu(); else if (screen !== 'title') show('title');
      return;
    }
    if (screen !== 'table' || !run || !$('modal').classList.contains('hidden')) return;
    if (e.key === ' ') { if (busy) setTurbo(4); e.preventDefault(); return; }
    if (busy) return;
    if (/^[1-9]$/.test(e.key)) { const id = view.hand[+e.key - 1]; if (id != null) toggleSel(id); return; }
    const k = e.key.toLowerCase();
    if (run.phase === 'play') {
      if (e.key === 'Enter' || k === 'p') { e.preventDefault(); doPlay(); }
      else if (k === 'd' || e.key === 'Backspace') { e.preventDefault(); doDiscard(); }
      else if (k === 'r') sortHand('rank');
      else if (k === 's') sortHand('suit');
    } else if (run.phase === 'select' && e.key === 'Enter') doStartBlind();
    else if (run.phase === 'cashout' && e.key === 'Enter') { const b = $('cashBtn'); if (b) b.click(); }
    else if (run.phase === 'shop' && e.key === 'Enter') { const b = $('nextBtn'); if (b) b.click(); }
    else if (run.phase === 'shop' && k === 'r') { const b = $('rerollBtn'); if (b) b.click(); }
  });
  let rsT = 0;
  window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { resizeFx(); hideTip(); if (screen === 'table') { computeSizes(); renderCharms(); renderCons(); layoutCards({ instant: true }); } }, 80); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); AU.suspend(); } else AU.resume();
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.card,.tile,.ware')) e.preventDefault(); });

  // ================= boot =================
  load();
  applySettings();
  document.documentElement.style.setProperty('--feltimg', 'url(' + A.feltURL() + ')');
  resizeFx();
  lastUnlock = unlockSnapshot();
  if (DEBUG && Q.get('speed')) set.speed = Math.max(1, Math.min(4, +Q.get('speed') || 1));
  show('title');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ }
  }
  HC.UI = { get run() { return run; }, get busy() { return busy; }, view, save, meta: () => meta };
})(window.HC);
