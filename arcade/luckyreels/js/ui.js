'use strict';
// LUCKY REELS — screens, panels, run flow, persistence, settings, codex, boot.
(function (LR) {
  const $ = (id) => document.getElementById(id);
  const E = LR.Engine, G = LR.Game, A = LR.Audio, Art = LR.Art, SY = LR.SYMBOLS, IT = LR.ITEMS, RAR = LR.RAR;
  const KEY = 'luckyreels.v1';
  const Q = new URLSearchParams(location.search);
  const DEBUG = Q.get('debug') === '1';

  // ---------- persistence ----------
  const DEF = () => ({
    v: 1,
    set: { sfx: true, music: true, haptics: true, shake: true, fast: false, reduced: false },
    meta: { runs: 0, wins: 0, bestFloor: 0, bestSpin: 0, bestEndless: 0, maxStakeWon: -1, seenS: {}, seenI: {}, ownS: {}, ownI: {}, landlord: 'grimsby', start: 'classic', stake: 0 },
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
          if (s.meta) Object.assign(d.meta, s.meta);
          if (s.run && typeof s.run === 'object' && Array.isArray(s.run.inv)) d.run = s.run;
        }
      }
    } catch (e) { /* storage unavailable: play without saving */ }
    if (!d.meta.seenS || typeof d.meta.seenS !== 'object') d.meta.seenS = {};
    if (!d.meta.seenI || typeof d.meta.seenI !== 'object') d.meta.seenI = {};
    for (const k of ['ownS', 'ownI']) if (!d.meta[k] || typeof d.meta[k] !== 'object') d.meta[k] = {};
    return d;
  }
  const S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  LR.haptic = function (ms) { if (!S.set.haptics) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  A.sfxOn = S.set.sfx; A.musicOn = S.set.music;
  const reducedPref = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  function applySettings() {
    G.reduced = S.set.reduced || reducedPref; G.shakeOn = S.set.shake;
    G.speedBase = (S.set.fast ? 3 : 1.25) * (DEBUG && +Q.get('speed') > 0 ? +Q.get('speed') : 1);
    $('ffBtn').setAttribute('aria-pressed', S.set.fast ? 'true' : 'false');
  }

  let toastT = 0;
  function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms || 2200); }

  // ---------- unlocks ----------
  const seenCount = () => Object.keys(S.meta.seenS).length;
  function unlocked(u) {
    if (!u) return true;
    const m = S.meta;
    if (u.floor) return m.bestFloor >= u.floor;
    if (u.wins) return m.wins >= u.wins;
    if (u.stake !== undefined) return m.maxStakeWon >= u.stake;
    if (u.codex) return seenCount() >= u.codex;
    return true;
  }
  const maxStake = () => Math.min(LR.STAKES.length - 1, S.meta.maxStakeWon + 1);
  function unlockSnapshot() {
    const o = [];
    for (const l of LR.LANDLORDS) if (unlocked(l.unlock)) o.push('l:' + l.id);
    for (const s of LR.STARTS) if (unlocked(s.unlock)) o.push('s:' + s.id);
    o.push('k:' + maxStake());
    return o;
  }
  function markSeenS(ids) { for (const id of ids || []) S.meta.seenS[id] = 1; }
  function markSeenI(ids) { for (const id of ids || []) S.meta.seenI[id] = 1; }

  // ---------- screens ----------
  const SCREENS = ['title', 'setup', 'settings', 'codex', 'menu', 'inv', 'rent', 'itemPick', 'summary'];
  let backTo = 'title';
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    G.titleVisible = id === 'title';
    hideTip();
    if (id === 'title') refreshTitle();
    const el = id && $(id); if (el) el.scrollTop = 0;
  }
  function closeOverlays() { for (const s of SCREENS) $(s).classList.add('hidden'); G.titleVisible = false; hideTip(); }
  function click(id, fn) { $(id).addEventListener('click', (e) => { A.unlock(); fn(e); }); }

  // ---------- title ----------
  function refreshTitle() {
    G.mode = 'title';
    setPlayUI(false);
    const r = S.run;
    const canCont = r && r.phase !== 'over';
    $('contBtn').classList.toggle('hidden', !canCont);
    if (canCont) {
      $('contBtn').textContent = r.phase === 'won' ? 'Continue (Landlord beaten!)' : 'Continue · Floor ' + (r.floor + 1);
      $('newBtn').classList.remove('primary');
    } else $('newBtn').classList.add('primary');
    const m = S.meta;
    $('bestLine').innerHTML = m.runs
      ? 'Best floor <b>' + Math.min(m.bestFloor, 13) + '</b> · Best spin <b>' + m.bestSpin + '</b>' + (m.wins ? ' · <b>' + m.wins + '</b> win' + (m.wins > 1 ? 's' : '') : '') + '<br>Codex ' + seenCount() + '/' + LR.SYM_ORDER.length
      : 'Build a lucky machine. Beat the Landlord.';
  }
  function setPlayUI(on) {
    for (const id of ['hud', 'controls', 'itemsBar']) $(id).classList.toggle('hidden', !on);
    if (!on) { $('pick').classList.add('hidden'); }
  }

  // ---------- setup ----------
  function drawLL(cv, id, css) {
    const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = Math.round(css * d);
    cv.getContext('2d').drawImage(Art.sprite('l', id, css * d), 0, 0);
  }
  function buildSetup() {
    const m = S.meta;
    if (!unlocked((LR.LANDLORDS.find((l) => l.id === m.landlord) || {}).unlock)) m.landlord = 'grimsby';
    if (!unlocked((LR.STARTS.find((l) => l.id === m.start) || {}).unlock)) m.start = 'classic';
    m.stake = Math.max(0, Math.min(m.stake, maxStake()));
    const ll = $('llList'); ll.innerHTML = '';
    for (const l of LR.LANDLORDS) {
      const ok = unlocked(l.unlock);
      const b = document.createElement('button');
      b.className = 'll-card' + (m.landlord === l.id ? ' sel' : '') + (ok ? '' : ' locked');
      const c = document.createElement('canvas'); c.style.width = c.style.height = '80px'; drawLL(c, l.id, 80); b.appendChild(c);
      const nm = document.createElement('b'); nm.textContent = l.name; b.appendChild(nm);
      const ds = document.createElement('small'); ds.textContent = ok ? l.desc : 'Locked — ' + l.unlock.text; if (!ok) ds.className = 'lock'; b.appendChild(ds);
      b.onclick = () => { A.unlock(); if (!ok) { A.play('deny'); toast(l.unlock.text + ' to unlock'); return; } A.play('click'); m.landlord = l.id; save(); buildSetup(); };
      ll.appendChild(b);
    }
    const sl = $('startList'); sl.innerHTML = '';
    for (const st of LR.STARTS) {
      const ok = unlocked(st.unlock);
      const b = document.createElement('button');
      b.className = 'opt' + (m.start === st.id ? ' sel' : '') + (ok ? '' : ' locked');
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = st.name; b.appendChild(nm);
      const sy = document.createElement('div'); sy.className = 'syms';
      for (const id of st.syms) sy.appendChild(Art.icon('s', id, 34));
      b.appendChild(sy);
      if (!ok) { const lk = document.createElement('small'); lk.className = 'lock'; lk.textContent = st.unlock.text; b.appendChild(lk); }
      b.onclick = () => { A.unlock(); if (!ok) { A.play('deny'); toast(st.unlock.text + ' to unlock'); return; } A.play('click'); m.start = st.id; save(); buildSetup(); };
      sl.appendChild(b);
    }
    const sk = LR.STAKES[m.stake];
    $('stakeName').textContent = sk.name + (maxStake() < LR.STAKES.length - 1 && m.stake === maxStake() ? '' : '');
    $('stakeDesc').textContent = sk.desc + (m.stake === maxStake() && maxStake() < LR.STAKES.length - 1 ? ' (win to unlock the next stake)' : '');
    $('stakeDn').disabled = m.stake <= 0; $('stakeUp').disabled = m.stake >= maxStake();
  }
  click('stakeDn', () => { A.play('click'); S.meta.stake = Math.max(0, S.meta.stake - 1); save(); buildSetup(); });
  click('stakeUp', () => { A.play('click'); S.meta.stake = Math.min(maxStake(), S.meta.stake + 1); save(); buildSetup(); });
  click('newBtn', () => {
    A.play('click');
    if (S.run && S.run.phase !== 'over' && S.run.phase !== 'won' && !newArm) { newArm = true; toast('Tap again to abandon your current run'); setTimeout(() => { newArm = false; }, 2600); return; }
    newArm = false; buildSetup(); show('setup');
  });
  let newArm = false;
  click('contBtn', () => { A.play('click'); enterPlay(); });
  click('goBtn', () => {
    A.play('pick');
    if (S.run && S.run.phase !== 'over' && S.run.phase !== 'won') recordEnd(S.run, false, true);
    const m = S.meta;
    const opts = { landlord: m.landlord, start: m.start, stake: m.stake };
    if (DEBUG && Q.get('seed')) opts.seed = +Q.get('seed');
    const run = E.newRun(opts);
    if (DEBUG) {
      if (Q.get('floor')) { run.floor = Math.max(0, Math.min(40, +Q.get('floor'))); run.spinsLeft = E.spinsFor(run, run.floor); if (run.floor >= 13) run.endless = true; }
      if (Q.get('coins')) run.coins = +Q.get('coins');
      if (Q.get('give')) for (const id of Q.get('give').split(',')) if (SY[id]) E.addSym(run, id);
      if (Q.get('items')) for (const id of Q.get('items').split(',')) if (IT[id]) E.addItem(run, id);
      if (Q.get('spins')) run.spinsLeft = Math.max(1, +Q.get('spins'));
    }
    markSeenS(run.inv.map((s) => s.id)); markSeenI(run.items.map((x) => x.id));
    S.run = run; save();
    enterPlay();
  });

  // ---------- play ----------
  let run = null;
  function enterPlay() {
    run = S.run; if (!run) { show('title'); return; }
    closeOverlays();
    G.mode = 'play';
    setPlayUI(true);
    buildItemsBar();
    refreshHud();
    G.setGrid(run.grid);
    G.clearPays();
    G.setStripPool(run.inv.map((s) => s.id));
    G.setCoins(run.coins, true);
    requestAnimationFrame(() => { G.layout(); resumePhase(); });
    A.unlock();
  }
  function resumePhase() {
    $('pick').classList.add('hidden');
    if (!run) return;
    if (run.phase === 'pick') showPick();
    else if (run.phase === 'rent') showRent();
    else if (run.phase === 'item') showItemPick();
    else if (run.phase === 'over') showSummary(false);
    else if (run.phase === 'won') showSummary(true);
    refreshSpinBtn();
  }
  function rentNow() { return E.rentFor(run, run.floor); }
  function refreshHud() {
    if (!run) return;
    $('floorNum').textContent = run.floor + 1;
    $('floorOf').textContent = run.endless ? ' endless' : '/' + LR.RENTS.length;
    $('remN').textContent = run.rem; $('rrN').textContent = run.rr;
    $('bagN').textContent = run.inv.length;
    $('rentAmt').textContent = rentNow();
    const w = $('rentWhen');
    if (run.phase === 'rent' || run.spinsLeft <= 0) { w.textContent = 'due now!'; w.classList.add('urgent'); }
    else { w.textContent = run.spinsLeft === 1 ? 'due after this spin' : 'due in ' + run.spinsLeft + ' spins'; w.classList.toggle('urgent', run.spinsLeft <= 1); }
    rentFill(G.busy ? G.dispCoins : run.coins);
    refreshSpinBtn();
  }
  function rentFill(coins) {
    if (!run) return;
    const r = rentNow(), k = Math.max(0, Math.min(1, coins / r));
    const f = $('rentFill'); f.style.width = (k * 100).toFixed(1) + '%'; f.classList.toggle('full', k >= 1);
  }
  G.onCoins = (v) => rentFill(v);
  function refreshSpinBtn() {
    const b = $('spinBtn');
    if (!run) return;
    b.classList.toggle('busy', G.busy);
    b.classList.remove('go');
    if (G.busy) b.textContent = 'HOLD TO SKIP';
    else if (run.phase === 'rent') { b.textContent = 'RENT'; b.classList.add('go'); }
    else if (run.phase === 'item') { b.textContent = 'ITEM'; b.classList.add('go'); }
    else if (run.phase === 'pick') { b.textContent = 'PICK'; }
    else b.textContent = 'SPIN';
  }
  function buildItemsBar() {
    const bar = $('itemsBar'); bar.innerHTML = '';
    if (!run) return;
    const cap = Math.max(4, Math.floor((Math.min(window.innerWidth, 560) - 28) / 50) * 2);
    const its = run.items;
    its.forEach((it, i) => {
      if (i >= cap - 1 && its.length > cap) return;
      const b = document.createElement('button'); b.className = 'item-chip'; b.dataset.id = it.id; b.setAttribute('aria-label', IT[it.id].name);
      b.appendChild(Art.icon('i', it.id, 34));
      b.onclick = () => { A.unlock(); A.play('click'); tipItem(it.id); };
      bar.appendChild(b);
    });
    if (its.length > cap) { const m = document.createElement('button'); m.className = 'item-chip more'; m.textContent = '+' + (its.length - cap + 1); m.onclick = () => openInv(); bar.appendChild(m); }
  }

  function doSpin() {
    if (!run || G.busy) return;
    if (run.phase === 'pick') { showPick(); return; }
    if (run.phase === 'rent') { showRent(); return; }
    if (run.phase === 'item') { showItemPick(); return; }
    if (run.phase !== 'spin') return;
    hideTip();
    const before = run.coins;
    const res = E.spin(run);
    if (!res) return;
    markSeenS(run.picks);
    for (const e of res.events) if (e.k === 'add' || e.k === 'xf') markSeenS([e.to || e.id]);
    S.meta.bestSpin = Math.max(S.meta.bestSpin, res.total);
    save(); // the run is saved the moment the spin resolves
    LR.haptic(12);
    refreshHud();
    G.playSpin(res, before, {}, () => afterSpin(res));
    refreshSpinBtn();
  }
  function afterSpin(res) {
    G.setCoins(run.coins);
    refreshHud();
    G.setStripPool(run.inv.map((s) => s.id));
    const rent = rentNow();
    const tot = res.total;
    if (tot >= Math.max(60, rent * 0.5)) { G.banner('JACKPOT!', '+' + tot + ' coins', '#ffc83d', 1.8); G.confetti(90); A.play('jackpot'); LR.haptic([30, 40, 30, 40, 60]); }
    else if (tot >= Math.max(25, rent * 0.25)) { G.banner('BIG WIN', '+' + tot, '#3ee6ff', 1.3); A.play('big'); LR.haptic(25); }
    showPick();
  }

  // ---------- symbol pick ----------
  function symCard(id, i, total) {
    const d = SY[id];
    const b = document.createElement('button'); b.className = 'card';
    b.style.setProperty('--rc', RAR[d.rar].col); b.style.animationDelay = (i * 0.06) + 's';
    if (!S.meta.ownS[id] && !ownedCount(id)) b.classList.add('new');
    const ic = document.createElement('div'); ic.className = 'ic'; ic.appendChild(Art.icon('s', id, 56)); b.appendChild(ic);
    const tx = document.createElement('div'); tx.className = 'tx';
    const nm = document.createElement('div'); nm.className = 'nm';
    const n1 = document.createElement('span'); n1.textContent = d.name; nm.appendChild(n1);
    const v = document.createElement('span'); v.className = 'val'; v.textContent = valText(id); nm.appendChild(v);
    const r = document.createElement('span'); r.className = 'rar'; r.textContent = RAR[d.rar].name; nm.appendChild(r);
    tx.appendChild(nm);
    const ds = document.createElement('div'); ds.className = 'ds'; ds.textContent = d.desc; tx.appendChild(ds);
    b.appendChild(tx);
    const own = ownedCount(id); if (own) { const o = document.createElement('span'); o.className = 'own'; o.textContent = 'own ' + own; b.appendChild(o); }
    if (total && window.matchMedia && window.matchMedia('(hover: hover)').matches) { const k = document.createElement('span'); k.className = 'key'; k.textContent = String(i + 1); b.appendChild(k); }
    return b;
  }
  function valText(id) { if (id === 'die') return '1–3'; if (id === 'luckydie') return '1–6'; return String(SY[id].value); }
  function ownedCount(id) { let n = 0; if (run) for (const s of run.inv) if (s.id === id) n++; return n; }
  let pickLock = 0;
  function showPick() {
    if (!run || run.phase !== 'pick') return;
    hideTip();
    const box = $('pickCards'); box.innerHTML = '';
    run.picks.forEach((id, i) => {
      const b = symCard(id, i, run.picks.length);
      b.onclick = () => choosePick(i);
      box.appendChild(b);
    });
    $('rerollN').textContent = run.rr; $('rerollBtn').disabled = run.rr <= 0;
    $('pickSub').textContent = run.spinsLeft <= 0 ? 'Then the Landlord comes for rent…' : 'Tap one to add it · ' + run.inv.length + ' owned';
    $('pick').classList.remove('hidden'); $('pick').classList.remove('min'); $('peekLbl').textContent = 'Peek';
    pickLock = performance.now() + 250; // guard against the spin tap landing on a card
    refreshSpinBtn();
  }
  function choosePick(i) {
    if (performance.now() < pickLock || !run || run.phase !== 'pick') return;
    A.unlock();
    const id = i >= 0 ? run.picks[i] : null;
    if (id) { S.meta.ownS[id] = 1; }
    E.pick(run, i);
    save();
    A.play(i >= 0 ? 'pick' : 'skip');
    $('pick').classList.add('hidden');
    if (id) G.setStripPool(run.inv.map((s) => s.id));
    refreshHud();
    if (run.phase === 'rent') setTimeout(showRent, 250);
  }
  click('skipBtn', () => choosePick(-1));
  click('pickHead', () => { const m = $('pick').classList.toggle('min'); $('peekLbl').textContent = m ? 'Show' : 'Peek'; A.play('click'); });
  click('rerollBtn', () => {
    if (!run || !E.reroll(run)) { A.play('deny'); return; }
    markSeenS(run.picks); save(); A.play('xf'); refreshHud(); showPick();
  });

  // ---------- rent ----------
  const SAY = {
    grimsby: ['"Rent\'s due. Pay up."', '"The meter is always running."', '"Lovely machine. Shame if it were repossessed."'],
    bloom: ['"Darling, the roses don\'t water themselves."', '"Pay, and do keep the bees off my hat."'],
    brine: ['"Hand over yer doubloons, matey."', '"The tide waits for no tenant."'],
    vex: ['"I foresaw this moment. And your payment."', '"The cards say… you owe me."'],
    tycoon: ['"Time is money. Yours, specifically."', '"Penthouse prices, kid."'],
  };
  function showRent() {
    if (!run || run.phase !== 'rent') return;
    const L = E.landlord(run), rent = rentNow();
    drawLL($('llCv'), L.id, 120);
    $('llName').textContent = L.name + (run.floor === LR.RENTS.length - 1 && !run.endless ? ' — final bill!' : '');
    const lines = SAY[L.id] || SAY.grimsby;
    $('llSay').textContent = run.floor === LR.RENTS.length - 1 && !run.endless ? '"This is it. Pay this and the building is yours."' : lines[(run.floor + run.spins) % lines.length];
    $('rentDue').textContent = rent;
    $('rentHave').innerHTML = 'You have <b>' + run.coins + '</b>';
    const short = run.coins < rent && !(DEBUG && Q.get('god') === '1');
    $('rentHave').classList.toggle('short', short);
    $('payBtn').textContent = short ? 'Can\'t pay… hand over the keys' : 'Pay ' + rent + ' rent';
    $('payBtn').classList.toggle('primary', !short); $('payBtn').classList.toggle('danger', short);
    show('rent');
  }
  click('payBtn', () => {
    if (!run || run.phase !== 'rent') return;
    if (DEBUG && Q.get('god') === '1') run.coins = Math.max(run.coins, rentNow());
    const res = E.payRent(run);
    save();
    if (!res.ok) { A.play('lose'); LR.haptic([60, 60, 120]); showSummary(false); return; }
    A.play('rent'); LR.haptic([20, 30, 20]);
    G.setCoins(run.coins, true);
    if (res.interest) toast('Savings Ledger: +' + res.interest + ' interest');
    S.meta.bestFloor = Math.max(S.meta.bestFloor, run.floor + 1);
    if (run.endless) S.meta.bestEndless = Math.max(S.meta.bestEndless, run.floor);
    save();
    if (res.won) { setTimeout(() => A.play('win'), 300); G.confetti(160); showSummary(true); return; }
    closeOverlays(); setPlayUI(true); refreshHud();
    G.banner('FLOOR ' + (run.floor + 1), 'Next rent: ' + rentNow() + ' in ' + run.spinsLeft + ' spins', '#4ee08a', 1.6);
    A.play('floor');
    setTimeout(showItemPick, 450);
  });

  // ---------- item pick ----------
  function itemCard(id, i) {
    const d = IT[id];
    const b = document.createElement('button'); b.className = 'card';
    b.style.setProperty('--rc', RAR[d.rar].col); b.style.animationDelay = (i * 0.07) + 's';
    if (!S.meta.ownI[id]) b.classList.add('new');
    const ic = document.createElement('div'); ic.className = 'ic'; ic.appendChild(Art.icon('i', id, 56)); b.appendChild(ic);
    const tx = document.createElement('div'); tx.className = 'tx';
    const nm = document.createElement('div'); nm.className = 'nm';
    const n1 = document.createElement('span'); n1.textContent = d.name; nm.appendChild(n1);
    const r = document.createElement('span'); r.className = 'rar'; r.textContent = RAR[d.rar].name + ' item'; nm.appendChild(r);
    tx.appendChild(nm);
    const ds = document.createElement('div'); ds.className = 'ds'; ds.textContent = d.desc; tx.appendChild(ds);
    b.appendChild(tx);
    return b;
  }
  let itemLock = 0;
  function showItemPick() {
    if (!run || run.phase !== 'item') { if (run && run.phase === 'spin') { closeOverlays(); setPlayUI(true); } return; }
    markSeenI(run.itemPicks); save();
    const box = $('itemCards'); box.innerHTML = '';
    run.itemPicks.forEach((id, i) => { const b = itemCard(id, i); b.onclick = () => chooseItem(i); box.appendChild(b); });
    $('itemSub').textContent = run.itemLeft > 1 ? 'Choose ' + run.itemLeft + ' items — they work every spin' : 'Choose an item — it works every spin';
    show('itemPick');
    itemLock = performance.now() + 300;
  }
  function chooseItem(i) {
    if (performance.now() < itemLock || !run || run.phase !== 'item') return;
    const id = i >= 0 ? run.itemPicks[i] : null;
    if (id) S.meta.ownI[id] = 1;
    E.pickItem(run, i); save();
    A.play(i >= 0 ? 'pick' : 'skip');
    buildItemsBar(); refreshHud();
    if (id) toast(IT[id].name + ' acquired', 1500);
    if (run.phase === 'item') { showItemPick(); return; }
    closeOverlays(); setPlayUI(true);
    G.layout();
    refreshSpinBtn();
  }
  click('itemSkip', () => chooseItem(-1));

  // ---------- summary ----------
  function recordEnd(r, won, silent) {
    if (r.counted) return [];
    const before = unlockSnapshot();
    const m = S.meta;
    m.runs++;
    m.bestFloor = Math.max(m.bestFloor, r.floor + (won ? 0 : 1));
    if (won) { m.wins++; m.maxStakeWon = Math.max(m.maxStakeWon, r.stake || 0); }
    r.counted = true;
    save();
    if (silent) return [];
    const after = unlockSnapshot();
    const out = [];
    for (const k of after) if (before.indexOf(k) < 0) {
      const [t, id] = k.split(':');
      if (t === 'l') out.push('New landlord: ' + LR.LANDLORDS.find((x) => x.id === id).name);
      if (t === 's') out.push('New starting set: ' + LR.STARTS.find((x) => x.id === id).name);
      if (t === 'k') out.push('Unlocked Stake ' + id + '!');
    }
    return out;
  }
  function showSummary(won) {
    if (!run) return;
    const endless = run.endless;
    const newly = won ? recordEnd(run, true) : recordEnd(run, false);
    const sc = $('sumCv'); drawLL(sc, E.landlord(run).id, 120);
    const t = $('sumTitle');
    t.textContent = won ? 'LANDLORD BEATEN!' : run.abandoned ? 'MOVED OUT' : 'EVICTED';
    t.classList.toggle('win', won);
    $('sumSub').textContent = won ? 'You paid every bill. The building is yours.' : run.abandoned ? 'You handed back the keys on floor ' + (run.floor + 1) + '.' : (endless ? 'The endless rent finally caught up with you on floor ' + (run.floor + 1) + '.' : 'Couldn\'t make rent on floor ' + (run.floor + 1) + '. The landlord changes the locks.');
    const st = $('sumStats'); st.innerHTML = '';
    const stat = (k, v) => { const d = document.createElement('div'); d.className = 'stat'; d.innerHTML = '<small></small><b></b>'; d.children[0].textContent = k; d.children[1].textContent = v; st.appendChild(d); };
    stat('Floor', won ? 'All 13' : String(run.floor + 1)); stat('Spins', run.spins); stat('Best spin', run.stats.best); stat('Total earned', run.stats.earned);
    stat('Symbols', run.inv.length); stat('Stake', run.stake || 0);
    const ul = $('unlocks'); ul.innerHTML = '';
    for (const n of newly) { const d = document.createElement('div'); d.className = 'unlock'; d.textContent = n; ul.appendChild(d); }
    $('endlessBtn').classList.toggle('hidden', !won);
    if (!won) { S.run = null; save(); }
    setPlayUI(false);
    G.mode = 'title';
    show('summary');
  }
  click('endlessBtn', () => { if (!run || !E.goEndless(run)) return; A.play('pick'); save(); enterPlay(); });
  click('againBtn', () => { A.play('click'); if (S.run && S.run.phase === 'won') { S.run = null; save(); } buildSetup(); show('setup'); });
  click('homeBtn', () => { A.play('click'); run = null; show('title'); });

  // ---------- inventory ----------
  function openInv() {
    if (!run) return;
    A.play('click');
    renderInv();
    show('inv');
  }
  function renderInv() {
    const grid = $('invGrid'); grid.innerHTML = '';
    const groups = {};
    for (const s of run.inv) (groups[s.id] = groups[s.id] || []).push(s);
    const ids = Object.keys(groups).sort((a, b) => 'vruc'.indexOf(SY[a].rar) - 'vruc'.indexOf(SY[b].rar) || SY[a].name.localeCompare(SY[b].name));
    for (const id of ids) {
      const b = document.createElement('button'); b.className = 'ig'; b.style.setProperty('--rc', RAR[SY[id].rar].col);
      b.appendChild(Art.icon('s', id, 52));
      if (groups[id].length > 1) { const n = document.createElement('span'); n.className = 'n'; n.textContent = '×' + groups[id].length; b.appendChild(n); }
      b.onclick = () => { A.play('click'); tipSym(id, groups[id][0], true); };
      grid.appendChild(b);
    }
    $('invRem').textContent = run.rem;
    $('invSub').textContent = run.inv.length + ' symbols' + (run.inv.length > 20 ? ' — only 20 fit on the machine each spin' : ' — ' + (20 - run.inv.length) + ' empty slot' + (20 - run.inv.length === 1 ? '' : 's')) + ' · tap one to read or remove it';
    const ig = $('invItems'); ig.innerHTML = '';
    $('invItemsH').classList.toggle('hidden', !run.items.length);
    for (const it of run.items) {
      const b = document.createElement('button'); b.className = 'ig'; b.style.setProperty('--rc', RAR[IT[it.id].rar].col);
      b.appendChild(Art.icon('i', it.id, 40)); b.onclick = () => { A.play('click'); tipItem(it.id); };
      ig.appendChild(b);
    }
  }
  click('bagBtn', () => { if (G.busy) return; openInv(); });
  click('invClose', () => { A.play('click'); closeOverlays(); setPlayUI(true); if (run && run.phase === 'pick') showPick(); });
  click('remTok', () => { if (G.busy) return; if (!run) return; toast(run.rem + ' Removal token' + (run.rem === 1 ? '' : 's') + ' — open your symbols to remove one'); });
  click('rrTok', () => { if (!run) return; toast(run.rr + ' Reroll token' + (run.rr === 1 ? '' : 's') + ' — reroll the symbol choices after a spin'); });

  // ---------- tooltip ----------
  let tipAction = null;
  function tipShow(kind, id, name, meta, desc, status, col) {
    const t = $('tip');
    t.style.setProperty('--rc', col);
    const ic = $('tipIc'); ic.innerHTML = ''; ic.appendChild(Art.icon(kind, id, 56));
    $('tipName').textContent = name; $('tipMeta').textContent = meta; $('tipDesc').textContent = desc; $('tipStatus').textContent = status || '';
    $('tipAct').classList.add('hidden'); tipAction = null;
    t.classList.remove('hidden');
  }
  function tipSym(id, inst, allowRemove) {
    const d = SY[id];
    const tags = d.tags.map((x) => LR.TAG_NAMES[x]).filter(Boolean).join(' · ');
    const extra = inst && inst.b ? ' (+' + inst.b + ' grown)' : '';
    tipShow('s', id, d.name, RAR[d.rar].name + ' · pays ' + valText(id) + extra + (tags ? ' · ' + tags : ''), d.desc, inst ? E.symStatus(inst) : '', RAR[d.rar].col);
    if (allowRemove && run && inst && (run.phase === 'spin' || run.phase === 'pick')) {
      const b = $('tipAct');
      b.classList.remove('hidden');
      b.disabled = run.rem <= 0;
      b.textContent = run.rem > 0 ? 'Remove one ' + d.name + ' (1 removal token)' : 'No removal tokens';
      tipAction = () => {
        if (!E.removeSym(run, inst.u)) { A.play('deny'); return; }
        A.play('remove'); LR.haptic(20); save();
        G.setGrid(run.grid); refreshHud(); hideTip(); renderInv(); toast(d.name + ' removed');
      };
    }
  }
  function tipItem(id) { const d = IT[id]; tipShow('i', id, d.name, RAR[d.rar].name + ' item', d.desc, '', RAR[d.rar].col); }
  function hideTip() { $('tip').classList.add('hidden'); tipAction = null; }
  click('tipX', () => { A.play('click'); hideTip(); });
  click('tipAct', () => { if (tipAction) tipAction(); });
  G.onCellTap = (i) => {
    if (!run) return;
    A.unlock();
    if (i < 0) { hideTip(); return; }
    const d = G.dispAt(i);
    if (!d) { tipShowEmpty(); return; }
    A.play('click');
    const inst = run.inv.find((s) => s.u === d.u);
    tipSym(d.id, inst, false);
  };
  function tipShowEmpty() {
    const t = $('tip'); t.style.setProperty('--rc', 'var(--line)');
    $('tipIc').innerHTML = ''; $('tipName').textContent = 'Empty slot'; $('tipMeta').textContent = '';
    $('tipDesc').textContent = 'You own ' + (run ? run.inv.length : 0) + ' symbols. With fewer than 20, some slots stay empty — add symbols after each spin to fill your machine.';
    $('tipStatus').textContent = ''; $('tipAct').classList.add('hidden'); t.classList.remove('hidden');
  }

  // ---------- menu ----------
  click('menuBtn', () => {
    if (!run) return;
    if (G.busy) G.skipAll();
    A.play('click');
    const L = E.landlord(run);
    $('pauseStats').innerHTML = 'Floor <b>' + (run.floor + 1) + '</b> · ' + L.name + ' · Stake ' + (run.stake || 0) + '<br>' + run.spins + ' spins · best spin ' + run.stats.best + ' · ' + run.inv.length + ' symbols';
    buildSettings($('pauseSet'), true);
    quitArm = 0; $('quitBtn').textContent = 'Abandon run';
    setPlayUI(false);
    show('menu');
  });
  click('resumeBtn', () => { A.play('click'); closeOverlays(); setPlayUI(true); G.layout(); resumePhase(); });
  click('mCodex', () => { A.play('click'); backTo = 'menu'; openCodex(); });
  click('mHow', () => { A.play('click'); backTo = 'menu'; buildSettings($('setList')); show('settings'); setTimeout(() => $('howto').scrollIntoView(), 30); });
  let quitArm = 0;
  click('quitBtn', () => {
    if (Date.now() - quitArm > 3000) { quitArm = Date.now(); $('quitBtn').textContent = 'Tap again to abandon'; A.play('deny'); return; }
    run.phase = 'over'; run.abandoned = true; save(); A.play('lose'); showSummary(false);
  });
  click('titleBtn', () => { A.play('click'); save(); run = null; show('title'); });

  // ---------- settings ----------
  const SETS = [['sfx', 'Sound effects'], ['music', 'Music'], ['haptics', 'Haptics (vibration)'], ['shake', 'Screen shake'], ['fast', 'Fast spins'], ['reduced', 'Reduced motion']];
  function buildSettings(list, compact) {
    list.innerHTML = '';
    for (const [k, lab] of SETS) {
      if (compact && (k === 'reduced')) continue;
      const b = document.createElement('button');
      b.className = 'btn toggle'; b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
      b.innerHTML = '<span></span><span class="sw"></span>'; b.firstChild.textContent = lab;
      b.onclick = () => {
        A.unlock();
        S.set[k] = !S.set[k]; save();
        b.setAttribute('aria-pressed', S.set[k] ? 'true' : 'false');
        if (k === 'sfx') A.setSfx(S.set.sfx);
        if (k === 'music') { A.setMusic(S.set.music); if (!S.set.music) A.stopMusic(); }
        if (k === 'haptics' && S.set.haptics) LR.haptic(30);
        applySettings();
        A.play('click');
      };
      list.appendChild(b);
    }
  }
  click('setBtn', () => { A.play('click'); backTo = 'title'; buildSettings($('setList')); show('settings'); });
  document.querySelectorAll('.backBtn').forEach((b) => b.addEventListener('click', () => {
    A.unlock(); A.play('click');
    const to = b.dataset.to === 'back' ? backTo : b.dataset.to;
    if (to === 'menu') { show('menu'); buildSettings($('pauseSet'), true); } else show(to);
  }));
  let resetArm = 0;
  click('resetBtn', () => {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('resetBtn').textContent = 'Tap again to erase everything'; return; }
    const set = S.set, d = DEF(); S.meta = d.meta; S.run = null; S.set = set; run = null;
    save(); $('resetBtn').textContent = 'Reset all progress'; toast('Progress erased'); backTo = 'title'; show('title');
  });

  // ---------- codex ----------
  let codexTab = 's';
  function openCodex() { renderCodex(); show('codex'); }
  function renderCodex() {
    $('tabS').classList.toggle('on', codexTab === 's'); $('tabI').classList.toggle('on', codexTab === 'i');
    const grid = $('codexGrid'); grid.innerHTML = '';
    const list = codexTab === 's' ? LR.SYM_ORDER : LR.ITEM_ORDER;
    const seen = codexTab === 's' ? S.meta.seenS : S.meta.seenI;
    let n = 0;
    for (const id of list) {
      const d = codexTab === 's' ? SY[id] : IT[id];
      const known = !!seen[id]; if (known) n++;
      const b = document.createElement('button'); b.className = 'ig' + (known ? '' : ' unk');
      b.style.setProperty('--rc', RAR[d.rar].col);
      b.appendChild(Art.icon(codexTab, id, 50));
      b.setAttribute('aria-label', known ? d.name : 'Undiscovered');
      b.onclick = () => {
        A.play('click');
        if (!known) { tipShow(codexTab, id, '???', RAR[d.rar].name, 'Not discovered yet. Keep spinning — it will show up as a choice eventually' + (d.pool === false ? ' (this one is only created by another symbol).' : '.'), '', RAR[d.rar].col); $('tipIc').firstChild.style.filter = 'brightness(0) opacity(0.4)'; return; }
        if (codexTab === 's') tipSym(id, null, false); else tipItem(id);
      };
      grid.appendChild(b);
    }
    $('codexCount').textContent = n + '/' + list.length;
  }
  click('codexBtn', () => { A.play('click'); backTo = 'title'; openCodex(); });
  click('tabS', () => { A.play('click'); codexTab = 's'; renderCodex(); });
  click('tabI', () => { A.play('click'); codexTab = 'i'; renderCodex(); });

  // ---------- controls ----------
  click('spinBtn', () => doSpin());
  click('ffBtn', () => { S.set.fast = !S.set.fast; save(); applySettings(); A.play('click'); toast(S.set.fast ? 'Fast spins on' : 'Fast spins off', 1000); });
  window.addEventListener('keydown', (e) => {
    if (e.repeat && e.key !== ' ') return;
    const k = e.key.toLowerCase();
    const vis = (id) => !$(id).classList.contains('hidden');
    A.unlock();
    if (k === 'escape') {
      if (vis('tip')) { hideTip(); return; }
      if (vis('menu')) { $('resumeBtn').click(); return; }
      if (vis('inv')) { $('invClose').click(); return; }
      if (G.mode === 'play' && vis('hud')) $('menuBtn').click();
      return;
    }
    if (vis('itemPick')) {
      if (k >= '1' && k <= '3') { itemLock = 0; chooseItem(+k - 1); }
      else if (k === 's') { itemLock = 0; chooseItem(-1); }
      return;
    }
    if (vis('rent')) { if (k === ' ' || k === 'enter') { e.preventDefault(); $('payBtn').click(); } return; }
    if (G.mode !== 'play' || !vis('hud')) return;
    if (k === ' ' || k === 'enter') {
      e.preventDefault();
      if (G.busy) { G.setHold(true); G.hold = true; return; }
      if (!$('pick').classList.contains('hidden')) return;
      doSpin(); return;
    }
    if (!$('pick').classList.contains('hidden')) {
      if (k >= '1' && k <= '4') { pickLock = 0; choosePick(+k - 1); return; }
      if (k === 's') { pickLock = 0; choosePick(-1); return; }
      if (k === 'r') { $('rerollBtn').click(); return; }
    }
    if (k === 'b' && !G.busy) openInv();
    if (k === 'f') $('ffBtn').click();
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') G.hold = false; });

  // ---------- lifecycle ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (G.busy) G.skipAll(); save(); A.suspend(); }
    else A.resume();
  });
  window.addEventListener('pagehide', save);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (run && G.mode === 'play') { buildItemsBar(); G.layout(); } });

  // ---------- boot ----------
  applySettings();
  G.start();
  show('title');
  if (DEBUG && Q.get('seen') === 'all') { for (const id of LR.SYM_ORDER) S.meta.seenS[id] = 1; for (const id of LR.ITEM_ORDER) S.meta.seenI[id] = 1; save(); refreshTitle(); }
  if (DEBUG && Q.get('wins')) { S.meta.wins = Math.max(S.meta.wins, +Q.get('wins')); S.meta.maxStakeWon = Math.max(S.meta.maxStakeWon, +Q.get('wins') - 1); S.meta.bestFloor = 13; save(); refreshTitle(); }
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch (e) { /* ignore */ }
  LR.UI = { S, save, get run() { return run; } };
})(window.LR = window.LR || {});
