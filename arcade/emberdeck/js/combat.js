'use strict';
// EMBER DECK — combat view: battlefield rendering, the animation queue, and tap / drag / keyboard input.
(function (root) {
  const ED = root.ED;
  const U = ED.UI, R = ED.Run, E = ED.Engine, Art = ED.Art, Au = ED.Audio, FX = ED.FX;
  const $ = U.$, S = U.S;
  const K = ED.Combat = {};
  const vc = $('v-combat'), handEl = $('hand'), foesEl = $('foes'), meEl = $('me'), field = $('field');
  let cur = null;          // the combat object currently on screen
  let busy = false;
  let sel = null;          // selected card uid
  let drag = null;
  let picks = [];          // cards chosen for a pending exhaust/discard
  let potAim = null;       // potion slot waiting for a target
  let tgtIdx = 0;
  let vhand = [];          // uids currently displayed in hand (lags the engine during animations)
  const cardEls = new Map();
  const foeEls = new Map();
  let meE = null;
  let dims = { cw: 96, ch: 136, spr: 120, me: 110, W: 390 };
  let kwp = null;

  K.busy = () => busy;
  const run = () => S.run;
  const Cb = () => S.run && S.run.combat;

  // ---------------- layout ----------------
  function measure() {
    const W = vc.clientWidth || innerWidth;
    const cw = Math.round(ED.clamp(W * 0.236, 82, W >= 700 ? 132 : 122));
    const ch = Math.round(cw * 1.42);
    vc.style.setProperty('--cw', cw + 'px'); vc.style.setProperty('--chh', ch + 'px');
    dims.cw = cw; dims.ch = ch; dims.W = W;
    const fh = field.clientHeight || 400;
    dims.zoneH = fh * 0.6;
    dims.me = Math.round(ED.clamp(fh * 0.4 - 62, 64, W >= 700 ? 150 : 118));
  }
  function foeSize(e, n) {
    const d = ED.ENEMIES[e.k];
    const per = (dims.W - 16) / Math.max(1, n);
    const room = Math.max(60, dims.zoneH - 96);
    const base = Math.min(per * 0.9, room * 0.84);
    return Math.round(ED.clamp(Math.min(base * d.size, room, per * 0.97), 44, 240));
  }

  // ---------------- enter / leave ----------------
  K.enter = function () {
    const C = Cb();
    if (!C) return;
    measure();
    Au.setMode(C.type === 'boss' ? 'boss' : 'combat');
    if (cur !== C) {
      cur = C; sel = null; drag = null; picks = []; potAim = null; busy = false; tgtIdx = 0;
      for (const el of cardEls.values()) el.remove();
      cardEls.clear(); foesEl.innerHTML = ''; foeEls.clear(); meEl.innerHTML = ''; meE = null;
      buildMe();
      renderFoes(true);
      vhand = [];
      const evs = C.ev.splice(0);
      if (C.over) { renderAll(); finish(); return; }
      if (evs.length) { process(evs); return; }
      intro();
      return;
    }
    renderAll();
  };
  K.leave = function () { cur = null; busy = false; for (const el of cardEls.values()) el.remove(); cardEls.clear(); vhand = []; hideKw(); $('aim').classList.add('hidden'); };
  async function intro() {
    const C = Cb();
    busy = true; renderControls();
    if (C.turn === 1 && C.type !== 'fight') {
      const boss = C.type === 'boss';
      const nm = ED.ENEMIES[C.en[0].k].n;
      U.banner('<small>' + (boss ? 'Boss' : 'Elite') + '</small>' + U.esc(nm), boss ? 'phase' : 'enemy', 1300);
      if (boss) { Au.play('phase'); FX.shake(8); }
      await U.wait(boss ? 900 : 500);
    }
    for (const c of C.hand) { addCardEl(c, 'draw'); vhand.push(c.u); }
    requestAnimationFrame(() => { layoutHand(); });
    for (let i = 0; i < C.hand.length; i++) { Au.play('draw'); await U.wait(55); }
    busy = false;
    renderAll();
  }

  // ---------------- creatures ----------------
  function bar(cls) {
    const b = U.el('div', 'bar ' + (cls || ''), '<i class="lag"></i><i class="pz"></i><i class="bz"></i><i class="fill"></i><span></span>');
    const sh = U.el('div', 'shieldb', '<b></b>');
    b.appendChild(sh);
    return b;
  }
  function buildMe() {
    const run0 = run();
    const w = U.el('div', 'who');
    const wrap = U.el('div', 'sprwrap');
    const cv = document.createElement('canvas'); cv.className = 'spr';
    wrap.appendChild(cv); w.appendChild(wrap);
    Art.drawSprite(cv, run0.char, ED.CHARS[run0.char].col, dims.me);
    const b = bar(); b.style.width = Math.max(100, dims.me * 0.95) + 'px';
    w.appendChild(b);
    const sts = U.el('div', 'sts'); w.appendChild(sts);
    meEl.appendChild(w);
    meE = { root: w, wrap, cv, bar: b, sts, id: 'p' };
    U.on(wrap, () => U.tip(wrap, '<b>' + ED.CHARS[run0.char].n + '</b><p>' + Cb().p.hp + '/' + Cb().p.maxHp + ' HP' + (Cb().p.block ? ' · ' + Cb().p.block + ' Block' : '') + '</p>'), false);
  }
  function buildFoe(e, n, anim) {
    const d = ED.ENEMIES[e.k];
    const root0 = U.el('div', 'foe' + (anim ? ' spawn' : ''));
    root0.dataset.id = e.id;
    const it = U.el('button', 'intent');
    const wrap = U.el('div', 'sprwrap');
    const cv = document.createElement('canvas'); cv.className = 'spr';
    wrap.appendChild(cv);
    const px = foeSize(e, n);
    Art.drawSprite(cv, d.art, d.col, px);
    const b = bar(); b.style.width = Math.max(70, Math.min(px * 0.9, 150)) + 'px';
    const sts = U.el('div', 'sts'); sts.style.maxWidth = Math.max(80, px) + 'px';
    const nm = U.el('div', 'fname', U.esc(d.n));
    root0.append(it, wrap, b, sts, nm);
    root0.style.width = Math.max(px, 76) + 'px';
    const o = { root: root0, wrap, cv, bar: b, sts, it, id: e.id, px, k: e.k };
    U.on(it, (ev) => { ev.stopPropagation(); intentTip(e.id, it); }, false);
    root0.addEventListener('click', (ev) => { if (ev.target.closest('.st') || ev.target.closest('.intent')) return; Au.unlock(); onFoeTap(e.id, root0); });
    return o;
  }
  function renderFoes(anim) {
    const C = Cb();
    const live = C.en.filter((e) => e.hp > 0 && !e.gone);
    for (const e of live) {
      let o = foeEls.get(e.id);
      if (!o) { o = buildFoe(e, live.length, anim !== false); foeEls.set(e.id, o); foesEl.appendChild(o.root); }
    }
    // keep DOM order = engine order; resize sprites when the crowd changes
    for (const e of live) { const o = foeEls.get(e.id); foesEl.appendChild(o.root); }
    for (const [id, o] of foeEls) if (!o.root.classList.contains('dead') && !o.root.classList.contains('fled') && !live.some((e) => e.id === id)) { o.root.remove(); foeEls.delete(id); }
    for (const e of live) {
      const o = foeEls.get(e.id);
      const px = foeSize(e, live.length);
      if (Math.abs(px - o.px) > 4) { o.px = px; o.root.style.width = Math.max(px, 76) + 'px'; Art.drawSprite(o.cv, ED.ENEMIES[e.k].art, ED.ENEMIES[e.k].col, px); o.bar.style.width = Math.max(70, Math.min(px * 0.9, 150)) + 'px'; o.sts.style.maxWidth = Math.max(80, px) + 'px'; }
      updateCreature(o, e);
      updateIntent(o, e, false);
    }
  }
  function setBar(o, hp, max, block, st) {
    const f = o.bar.querySelector('.fill'), l = o.bar.querySelector('.lag'), pz = o.bar.querySelector('.pz'), bz = o.bar.querySelector('.bz');
    o.hp = hp;
    const pct = Math.max(0, hp) / max * 100;
    f.style.width = pct + '%';
    l.style.width = pct + '%';
    const p = Math.min(Math.max(0, hp), (st && st.poison) || 0), b = Math.min(Math.max(0, hp - p), (st && st.burn) || 0);
    pz.style.left = ((hp - p) / max * 100) + '%'; pz.style.width = (p / max * 100) + '%';
    bz.style.left = ((hp - p - b) / max * 100) + '%'; bz.style.width = (b / max * 100) + '%';
    o.bar.querySelector('span').textContent = Math.max(0, hp) + '/' + max;
    const sh = o.bar.querySelector('.shieldb');
    sh.classList.toggle('on', block > 0);
    sh.querySelector('b').textContent = block;
    o.bar.classList.toggle('blk', block > 0);
  }
  function updateCreature(o, c) {
    setBar(o, c.hp, c.maxHp, c.block, c.st);
    const sts = o.sts;
    const keys = Object.keys(c.st).filter((k) => ED.STATUS[k] && ED.STATUS[k].show !== false && c.st[k]);
    let html = '';
    for (const k of keys) {
      const d = ED.STATUS[k], n = c.st[k];
      html += '<button class="st' + (n < 0 ? ' neg' : '') + '" data-st="' + k + '" style="--sc:' + d.col + '" aria-label="' + d.n + ' ' + n + '">' + Art.icon(d.icon) + '<em>' + n + '</em></button>';
    }
    for (const k of ['fortress', 'everburn', 'ashPact']) if (c.st[k]) html += '<button class="st" data-st="' + k + '" style="--sc:' + ED.STATUS[k].col + '">' + Art.icon(ED.STATUS[k].icon) + '</button>';
    if (c.st.split && !c.d.splitting) html += '<button class="st" data-st="split" style="--sc:#8bdc5a">' + Art.icon('split') + '</button>';
    if (c.st.minion) html += '<button class="st" data-st="minion" style="--sc:#a3aed0">' + Art.icon('minion') + '</button>';
    if (sts._h !== html) {
      sts._h = html; sts.innerHTML = html;
      sts.querySelectorAll('.st').forEach((b) => U.on(b, (ev) => { ev.stopPropagation(); U.tip(b, U.statusTip(b.dataset.st, c.st[b.dataset.st])); }, false));
    }
  }
  function intentHTML(e) {
    const run0 = run();
    if (R.has(run0, 'blindfold')) return '<span class="k-unknown">' + Art.icon('unknown') + '</span>';
    const it = E.intent(run0, e);
    if (!it) return '';
    let h = '';
    for (const k of it.kinds) {
      if (k === 'atk') h += '<span class="k-atk">' + Art.icon('atk') + '</span><b>' + it.dmg + (it.hits > 1 ? '×' + it.hits : '') + '</b>';
      else h += '<span class="k-' + k + '">' + Art.icon(k) + '</span>';
    }
    return h;
  }
  function updateIntent(o, e, pop) {
    const h = intentHTML(e);
    if (o.it._h === h && !pop) return;
    o.it._h = h; o.it.innerHTML = h;
    if (pop) { o.it.classList.remove('pop'); void o.it.offsetWidth; o.it.classList.add('pop'); }
  }
  function intentTip(id, anchor) {
    const run0 = run(), C = Cb();
    const e = C.en.find((x) => x.id === id);
    if (!e || e.hp <= 0) return;
    if (R.has(run0, 'blindfold')) { U.tip(anchor, '<b>Hidden intent</b><p>Your blindfold hides what this enemy will do.</p>'); return; }
    const it = E.intent(run0, e);
    const m = E.moveOf(e);
    const parts = [];
    for (const k of it.kinds) {
      if (k === 'atk') parts.push('attack for <b>' + it.dmg + '</b> damage' + (it.hits > 1 ? ' <b>' + it.hits + '</b> times (' + it.dmg * it.hits + ' total)' : ''));
      if (k === 'block') parts.push('gain Block');
      if (k === 'buff') parts.push('strengthen itself' + (m.buffAll ? ' and its allies' : ''));
      if (k === 'debuff') parts.push(m.add ? 'add junk cards to your deck' + (m.debuff ? ' and weaken you' : '') : 'inflict a debuff on you');
      if (k === 'summon') parts.push('summon allies');
      if (k === 'split') parts.push('split in two');
      if (k === 'escape') parts.push('do something drastic');
      if (k === 'unknown') parts.push('do something');
    }
    U.tip(anchor, '<b>' + U.esc(ED.ENEMIES[e.k].n) + ' · ' + U.esc(m.n) + '</b><p>Intends to ' + parts.join(', ') + '.</p>');
  }

  // ---------------- hand ----------------
  function addCardEl(c, from) {
    const run0 = run();
    let el = cardEls.get(c.u);
    if (el) return el;
    el = U.cardEl(c, { run: run0 });
    el.dataset.u = c.u;
    el.style.zIndex = 1;
    handEl.appendChild(el);
    cardEls.set(c.u, el);
    const p = pileXY(from || 'draw');
    el.style.transition = 'none';
    el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(.2) rotate(-20deg)';
    el.style.opacity = '0.3';
    void el.offsetWidth;
    el.style.transition = '';
    el.style.opacity = '';
    return el;
  }
  function pileXY(which) {
    const hr = handEl.getBoundingClientRect();
    if (which === 'center') return { x: hr.width / 2 - dims.cw / 2, y: -dims.ch * 1.3 };
    const id = which === 'disc' ? 'pile-disc' : which === 'exh' ? 'pile-exh' : 'pile-draw';
    const pr = $(id).getBoundingClientRect();
    return { x: pr.left + pr.width / 2 - hr.left - dims.cw / 2, y: pr.top + pr.height / 2 - hr.top - dims.ch / 2 };
  }
  function cardData(u) { const C = Cb(); return C.hand.find((c) => c.u === u) || C.disc.find((c) => c.u === u) || C.exh.find((c) => c.u === u) || C.draw.find((c) => c.u === u); }
  function layoutHand() {
    const n = vhand.length;
    const W = handEl.clientWidth || dims.W;
    const cw = dims.cw, ch = dims.ch;
    const maxSpread = W - cw - 4;
    const step = n > 1 ? Math.min(cw * 0.8, maxSpread / (n - 1)) : 0;
    const x0 = (W - cw) / 2 - step * (n - 1) / 2;
    const rot = Math.min(4, 22 / Math.max(1, n));
    vhand.forEach((u, i) => {
      const el = cardEls.get(u);
      if (!el || (drag && drag.u === u && drag.started)) return;
      const off = i - (n - 1) / 2;
      let x = x0 + i * step, y = 6 + off * off * (n > 6 ? 1.6 : 2.4), a = off * rot, s = 1;
      const isSel = sel === u;
      const picked = picks.includes(u);
      if (isSel) {
        s = 1.42; a = 0; y = -ch * 0.22;
        const half = cw * s / 2;
        const cx = ED.clamp(x + cw / 2, half + 6, W - half - 6);
        x = cx - cw / 2;
      } else if (picked) { y -= ch * 0.18; }
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + a.toFixed(2) + 'deg) scale(' + s + ')';
      el.style.zIndex = isSel ? 60 : 10 + i;
      el.classList.toggle('sel', isSel);
      el.classList.toggle('picked', picked);
    });
    if (sel) showKw(); else hideKw();
  }
  function refreshCards() {
    const run0 = run(), C = Cb();
    let aimT = null;
    if (sel) { const c = C.hand.find((x) => x.u === sel); if (c && E.needsTarget(c)) { const a = foesEl.querySelector('.foe.aimed'); aimT = a ? C.en.find((e) => e.id === a.dataset.id) : null; } }
    for (const u of vhand) {
      const el = cardEls.get(u);
      const c = C.hand.find((x) => x.u === u);
      if (!el || !c) continue;
      const h = U.cardHTML(c, run0, u === sel ? aimT : null);
      if (el._h !== h) { el._h = h; el.innerHTML = h; }
      el.classList.toggle('up', !!c.up);
    }
  }
  function showKw() {
    const c = Cb().hand.find((x) => x.u === sel);
    if (!c) { hideKw(); return; }
    const html = U.kwHTML(c);
    if (!html) { hideKw(); return; }
    if (!kwp) { kwp = U.el('div', 'kwpanel'); document.body.appendChild(kwp); }
    kwp.innerHTML = html;
    kwp.classList.remove('hidden');
    const hr = handEl.getBoundingClientRect();
    const top = hr.top - dims.ch * 0.7 - kwp.offsetHeight - 10;
    const el = cardEls.get(sel);
    const r = el ? el.getBoundingClientRect() : hr;
    const cx = r.left + r.width / 2;
    kwp.style.left = ED.clamp(cx - 85, 8, innerWidth - 178) + 'px';
    kwp.style.top = Math.max(field.getBoundingClientRect().top + 4, top) + 'px';
  }
  function hideKw() { if (kwp) kwp.classList.add('hidden'); }

  // ---------------- controls ----------------
  function renderControls() {
    const C = Cb();
    if (!C) return;
    $('energy').innerHTML = '<b>' + C.energy + '</b><small>/' + C.maxEnergy + '</small>';
    $('energy').classList.toggle('empty', C.energy <= 0);
    $('pile-draw').querySelector('span').textContent = C.draw.length;
    $('pile-disc').querySelector('span').textContent = C.disc.length;
    $('pile-exh').querySelector('span').textContent = C.exh.length;
    $('pile-exh').classList.toggle('hidden', !C.exh.length);
    const et = $('endturn');
    et.classList.toggle('wait', busy || C.phase !== 'player' || !!C.pending);
    et.textContent = C.phase === 'player' ? 'End Turn' : 'Enemy Turn';
    const any = C.phase === 'player' && C.hand.some((c) => !E.canPlay(run(), c));
    et.classList.toggle('nudge', C.phase === 'player' && !busy && !any && !C.pending);
  }
  function renderPrompt() {
    const C = Cb(), P = C.pending, pr = $('prompt');
    if (potAim !== null) {
      pr.innerHTML = '<span>Choose a target</span><button class="btn" id="pa-x">Cancel</button>';
      pr.classList.remove('hidden');
      U.on($('pa-x'), () => { potAim = null; renderAll(); });
      return;
    }
    if (!P || P.act === 'discover') { pr.classList.add('hidden'); return; }
    pr.innerHTML = '<span>' + U.esc(P.prompt || 'Choose') + ' (' + picks.length + '/' + P.n + ')</span><button class="btn primary" id="pp-ok"' + (picks.length === P.n ? '' : ' disabled') + '>Confirm</button>';
    pr.classList.remove('hidden');
    U.on($('pp-ok'), () => { if (picks.length !== P.n) return; const ch = picks.slice(); picks = []; act(() => E.resolve(run(), ch)); }, 'select');
  }
  function renderTargets() {
    const C = Cb();
    let need = potAim !== null;
    if (!need && sel) { const c = C.hand.find((x) => x.u === sel); need = !!(c && E.needsTarget(c) && !E.canPlay(run(), c)); }
    for (const [, o] of foeEls) o.root.classList.toggle('targetable', need && !o.root.classList.contains('dead'));
    if (!need) for (const [, o] of foeEls) o.root.classList.remove('aimed');
  }
  function renderAll() {
    const C = Cb();
    if (!C || cur !== C) return;
    renderFoes(false);
    if (meE) updateCreature(meE, C.p);
    // sync hand to engine state
    if (!busy) {
      for (const c of C.hand) if (!cardEls.has(c.u)) addCardEl(c, 'draw');
      for (const [u, el] of cardEls) if (!C.hand.some((c) => c.u === u) && !el.classList.contains('flyout') && !el.classList.contains('burn')) { el.remove(); cardEls.delete(u); }
      vhand = C.hand.map((c) => c.u);
      if (sel && !vhand.includes(sel)) sel = null;
      picks = picks.filter((u) => vhand.includes(u));
    }
    refreshCards();
    layoutHand();
    renderControls();
    renderPrompt();
    renderTargets();
    U.hudHp(C.p.hp, C.p.maxHp);
    if (C.pending && C.pending.act === 'discover' && !busy && !U.modalOpen()) discoverModal();
  }
  K.render = renderAll;

  // ---------------- actions ----------------
  function act(fn) {
    const C = Cb();
    if (busy || !C || C.over) return false;
    if (U.god && C.phase === 'player') C.p.block = Math.max(C.p.block, 999);
    const ok = fn();
    if (!ok) { renderAll(); return false; }
    const evs = C.ev.splice(0);
    U.save();
    process(evs);
    return true;
  }
  K.tryPlay = function (u, tid) {
    const C = Cb();
    if (busy || !C) return;
    const c = C.hand.find((x) => x.u === u);
    if (!c) return;
    const why = E.canPlay(run(), c);
    if (why) { Au.play('deny'); U.toast(why); shakeCard(u); return; }
    if (E.needsTarget(c) && !tid) {
      const al = C.en.filter((e) => e.hp > 0 && !e.gone);
      if (al.length === 1) tid = al[0].id;
      else { sel = u; Au.play('select'); renderAll(); U.toast('Choose a target'); return; }
    }
    sel = null;
    hideKw();
    act(() => E.play(run(), u, tid));
  };
  K.endTurn = function () {
    const C = Cb();
    if (busy || !C || C.pending || C.phase !== 'player') return;
    sel = null; potAim = null;
    if (U.god) C.p.block = Math.max(C.p.block, 999);
    Au.play('endturn');
    act(() => E.endTurn(run()));
  };
  K.usePotion = function (slot) {
    const C = Cb(), k = run().potions[slot];
    if (!k || busy) return;
    if (E.potionNeedsTarget(k) && C.en.filter((e) => e.hp > 0 && !e.gone).length > 1) { potAim = slot; sel = null; renderAll(); return; }
    act(() => E.usePotion(run(), slot));
  };
  K.debugWin = function () { const C = Cb(); if (!C || busy) return; act(() => { const G = E.G(run()); for (const e of G.enemies()) G.dealDamage(e, 9999, { kind: 'dmg' }); return true; }); };
  K.debugLose = function () { const C = Cb(); if (!C || busy) return; act(() => { const G = E.G(run()); G.loseHp(C.p, 9999); return true; }); };
  function shakeCard(u) { const el = cardEls.get(u); if (!el) return; el.animate([{ marginLeft: '0px' }, { marginLeft: '-6px' }, { marginLeft: '6px' }, { marginLeft: '0px' }], { duration: 220 }); }
  function discoverModal() {
    const C = Cb();
    ED.Views.cardChoice(C.pending.opts.map((k) => ({ k, up: 0 })), (i) => { if (i === 'skip') i = 0; act(() => E.resolve(run(), i)); }, { title: 'Bottled Tide', skip: 'Take first' });
  }

  // ---------------- animation queue ----------------
  function foeO(id) { return id === 'p' ? meE : foeEls.get(id); }
  function creature(id) { const C = Cb(); return id === 'p' ? C.p : C.en.find((e) => e.id === id); }
  function anim(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600); }
  async function process(evs) {
    busy = true;
    renderControls();
    for (const ev of evs) {
      if (cur !== Cb()) break;
      try { await handle(ev); } catch (e) { /* never let a visual glitch block the game */ }
    }
    busy = false;
    const C = Cb();
    if (!C || cur !== C) return;
    if (C.ev.length) { const more = C.ev.splice(0); U.save(); return process(more); }
    renderAll();
    U.hud();
    U.save();
    if (C.over) finish();
  }
  async function handle(ev) {
    const C = Cb();
    const sp = U.speed();
    switch (ev.t) {
      case 'draw': {
        const c = cardData(ev.u); if (!c) return;
        addCardEl(c, ev.from === 'disc' ? 'disc' : 'draw');
        if (!vhand.includes(ev.u)) vhand.push(ev.u);
        requestAnimationFrame(layoutHand);
        $('pile-draw').querySelector('span').textContent = Math.max(0, +$('pile-draw').querySelector('span').textContent - 1);
        Au.play('draw');
        return U.wait(65);
      }
      case 'add': {
        const c = cardData(ev.u); if (!c) return;
        const el = addCardEl(c, 'center');
        el.style.transition = 'none';
        const p = pileXY('center');
        el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(.6)';
        void el.offsetWidth; el.style.transition = '';
        el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(1)';
        Au.play('draw');
        await U.wait(ev.to === 'hand' ? 160 : 260);
        if (ev.to === 'hand') { if (!vhand.includes(ev.u)) vhand.push(ev.u); layoutHand(); return; }
        flyTo(el, ev.to === 'draw' ? 'draw' : 'disc', ev.u);
        return U.wait(120);
      }
      case 'play': {
        vhand = vhand.filter((u) => u !== ev.u);
        const el = cardEls.get(ev.u);
        if (el) {
          el.classList.remove('sel');
          const p = pileXY('center');
          el.style.zIndex = 65;
          el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(1.05)';
        }
        layoutHand();
        $('energy').innerHTML = '<b>' + ev.energy + '</b><small>/' + C.maxEnergy + '</small>';
        anim($('energy'), 'pulse');
        Au.play('play'); U.haptic(8);
        const d = ED.CARDS[ev.k];
        if (d.t === 'atk' && meE) anim(meE.wrap, 'lunge');
        return U.wait(170);
      }
      case 'discard': {
        const el = cardEls.get(ev.u);
        vhand = vhand.filter((u) => u !== ev.u);
        if (el) flyTo(el, 'disc', ev.u);
        layoutHand();
        bumpPile('pile-disc', 1);
        return U.wait(ev.played ? 90 : 55);
      }
      case 'exhaust': {
        let el = cardEls.get(ev.u);
        vhand = vhand.filter((u) => u !== ev.u);
        if (!el) { const c = cardData(ev.u); if (c) el = addCardEl(c, 'center'); }
        if (el) {
          cardEls.delete(ev.u);
          el.classList.add('burn');
          const r = el.getBoundingClientRect();
          FX.embers(r.left, r.top, r.width, r.height, 22);
          setTimeout(() => el.remove(), 600);
        }
        layoutHand();
        Au.play('exhaust');
        $('pile-exh').classList.remove('hidden');
        bumpPile('pile-exh', 1);
        return U.wait(200);
      }
      case 'power': {
        const el = cardEls.get(ev.u);
        cardEls.delete(ev.u);
        if (el) {
          el.style.transition = 'transform .45s ease-in, opacity .45s';
          const p = pileXY('center');
          el.style.transform = 'translate(' + p.x + 'px,' + (p.y - 60) + 'px) scale(.5)';
          el.style.opacity = '0';
          el.style.filter = 'drop-shadow(0 0 20px #ffc35a) brightness(1.6)';
          setTimeout(() => el.remove(), 480);
        }
        Au.play('buff');
        if (meE) anim(meE.wrap, 'buffed');
        return U.wait(260);
      }
      case 'shuffle': {
        Au.play('shuffle');
        const hr = handEl.getBoundingClientRect();
        const a = $('pile-disc').getBoundingClientRect(), b = $('pile-draw').getBoundingClientRect();
        for (let i = 0; i < 6; i++) {
          const f = U.el('div', 'card back flying');
          f.style.cssText = 'position:fixed;left:' + a.left + 'px;top:' + a.top + 'px;width:28px;height:38px;--cw:28px;transition:transform .35s ease-in-out ' + (i * 0.03 * sp) + 's;z-index:66';
          document.body.appendChild(f);
          requestAnimationFrame(() => { f.style.transform = 'translate(' + (b.left - a.left) + 'px,' + (b.top - a.top) + 'px) rotate(' + (i * 30) + 'deg)'; });
          setTimeout(() => f.remove(), 520);
        }
        void hr;
        $('pile-draw').querySelector('span').textContent = ev.n;
        $('pile-disc').querySelector('span').textContent = 0;
        return U.wait(380);
      }
      case 'dmg': {
        const o = foeO(ev.id);
        if (!o) return;
        const c = creature(ev.id);
        setBar(o, ev.hp, c ? c.maxHp : ev.hp || 1, ev.block, c ? c.st : null);
        if (ev.id === 'p') U.hudHp(ev.hp, c.maxHp);
        const r = FX.rectOf(o.wrap);
        if (ev.amt > 0) {
          anim(o.wrap, 'hit');
          const cls = ev.kind === 'poison' ? 'poison' : ev.kind === 'burn' ? 'burn' : '';
          FX.num(o.wrap, String(ev.amt), cls + (ev.amt >= 20 ? ' big' : ''));
          if (ev.kind === 'poison') { FX.burst(r.x, r.y, 14, ['#8bdc5a', '#c8ff9a'], { speed: 120, grav: -80, life: 0.7 }); Au.play('poison'); }
          else if (ev.kind === 'burn') { FX.embers(r.l + r.w * 0.2, r.t + r.h * 0.3, r.w * 0.6, r.h * 0.6, 18); Au.play('burn'); }
          else { FX.burst(r.x, r.y, 10 + Math.min(20, ev.amt), ['#fff3d0', '#ffb36b', '#ff6a3d'], { speed: 260, life: 0.45, grav: 300 }); Au.play(ev.amt >= 15 ? 'bighit' : 'hit', ev.amt); }
          if (ev.id === 'p') { FX.shake(Math.min(16, 4 + ev.amt * 0.5)); U.haptic(ev.amt >= 10 ? 40 : 20); }
          else if (ev.amt >= 18) FX.shake(8);
        } else if (ev.blk > 0) {
          FX.num(o.wrap, 'Blocked', 'blocked');
          Au.play('blocked');
          const sh = o.bar.querySelector('.shieldb'); anim(sh, 'glint');
        }
        if (ev.blk > 0 && ev.amt > 0) Au.play('blocked');
        return U.wait(ev.kind === 'poison' || ev.kind === 'burn' ? 260 : ev.kind === 'thorns' ? 160 : 150);
      }
      case 'block': {
        const o = foeO(ev.id);
        if (!o) return;
        const c = creature(ev.id);
        if (c) setBar(o, o.hp !== undefined ? o.hp : c.hp, c.maxHp, ev.block, c.st);
        const sh = o.bar.querySelector('.shieldb'); anim(sh, 'glint');
        FX.num(o.bar, '+' + ev.amt, 'blk', -20);
        Au.play('block');
        return U.wait(110);
      }
      case 'status': {
        const o = foeO(ev.id);
        const c = creature(ev.id);
        if (!o || !c) return;
        updateCreature(o, c);
        if (ev.blocked) { FX.num(o.wrap, 'Negated', 'lbl', -30); Au.play('block'); return U.wait(160); }
        if (!ev.k || ev.k === 'cleanse') { FX.num(o.wrap, 'Cleansed', 'lbl', -30); Au.play('buff'); return U.wait(200); }
        const d = ED.STATUS[ev.k];
        if (!d || d.show === false || !ev.n) return;
        const btn = o.sts.querySelector('[data-st="' + ev.k + '"]');
        if (btn) anim(btn, 'pop');
        const lbl = (ev.n > 0 ? '+' : '') + ev.n + ' ' + d.n;
        const el = FX.num(o.wrap, lbl, 'lbl', -34);
        void el;
        const neg = d.kind === 'debuff' || ev.n < 0;
        Au.play(neg ? 'debuff' : 'buff');
        if (!neg) anim(o.wrap, 'buffed');
        return U.wait(110);
      }
      case 'heal': {
        const o = foeO(ev.id), c = creature(ev.id);
        if (!o || !c) return;
        setBar(o, ev.hp, c.maxHp, c.block, c.st);
        if (ev.id === 'p') U.hudHp(ev.hp, c.maxHp);
        FX.num(o.wrap, '+' + ev.amt, 'heal');
        const r = FX.rectOf(o.wrap);
        FX.burst(r.x, r.y, 14, ['#9dffb8', '#e0ffe8'], { speed: 120, grav: -60, glow: true });
        Au.play('heal');
        return U.wait(180);
      }
      case 'energy': $('energy').innerHTML = '<b>' + ev.val + '</b><small>/' + C.maxEnergy + '</small>'; $('energy').classList.toggle('empty', ev.val <= 0); return;
      case 'relic': U.flashRelic(ev.k); Au.play('relic'); return U.wait(170);
      case 'gold': FX.num($('h-gold'), '+' + ev.amt, 'gold'); Au.play('gold'); U.hud(); return U.wait(120);
      case 'potion': Au.play('potion'); U.hud(); return U.wait(220);
      case 'die': {
        const o = foeEls.get(ev.id);
        if (!o) return;
        o.root.classList.add('dead');
        const r = FX.rectOf(o.wrap);
        if (!ev.silent) {
          FX.burst(r.x, r.y, 40, ['#2a1d34', '#6a4a7a', '#ffb36b', '#ff6a2a'], { speed: 200, grav: -40, life: 0.9, size: 4, glow: true });
          Au.play('die'); U.haptic(30);
        }
        setTimeout(() => { o.root.remove(); if (foeEls.get(ev.id) === o) foeEls.delete(ev.id); }, 760);
        return U.wait(ev.silent ? 120 : 420);
      }
      case 'flee': { const o = foeEls.get(ev.id); if (o) { o.root.classList.add('fled'); setTimeout(() => { o.root.remove(); foeEls.delete(ev.id); }, 620); } return U.wait(200); }
      case 'spawn': renderFoes(true); Au.play('buff'); return U.wait(300);
      case 'move': {
        const o = foeEls.get(ev.id);
        if (!o) return;
        FX.num(o.it, ev.name, 'lbl', 10);
        if (ev.atk) { anim(o.wrap, 'lunge'); Au.play('enemyatk'); return U.wait(260); }
        anim(o.wrap, 'buffed');
        return U.wait(380);
      }
      case 'turn': {
        if (ev.who === 'e') { sel = null; layoutHand(); renderTargets(); U.banner('Enemy Turn', 'enemy', 900); return U.wait(620); }
        sel = null; picks = [];
        U.banner('<small>Turn ' + ev.n + '</small>Your Turn', '', 900);
        Au.play('yourturn');
        for (const [, o] of foeEls) { const e = creature(o.id); if (e) updateCreature(o, e); }
        if (meE) updateCreature(meE, C.p);
        return U.wait(480);
      }
      case 'endturn': renderControls(); return;
      case 'phase': {
        const o = foeEls.get(ev.id);
        U.banner(U.esc(ev.text), 'phase', 1600);
        Au.play('phase'); FX.shake(12); U.haptic([40, 40, 60]);
        if (o) { anim(o.wrap, 'buffed'); const r = FX.rectOf(o.wrap); FX.burst(r.x, r.y, 60, ['#ff5a2a', '#ffcf4a', '#5c2a6a'], { speed: 360, grav: 100, glow: true }); }
        for (const [, f] of foeEls) { const e = creature(f.id); if (e) updateIntent(f, e, true); }
        return U.wait(1200);
      }
      case 'intent': {
        for (const [, o] of foeEls) { const e = creature(o.id); if (e && e.hp > 0) updateIntent(o, e, !ev.id || ev.id === o.id); }
        if (ev.phase) { const o = foeEls.get(ev.id); if (o) FX.num(o.wrap, ev.phase, 'lbl', -40); return U.wait(400); }
        return U.wait(100);
      }
      case 'cardfx': { const el = cardEls.get(ev.u); if (el) { el.animate([{ filter: 'none' }, { filter: 'brightness(1.8) sepia(1) hue-rotate(-30deg)' }, { filter: 'none' }], { duration: 400 }); } return U.wait(200); }
      case 'upgradeAll': refreshCards(); Au.play('upgrade'); return U.wait(300);
      case 'win': case 'lose': return;
      default: return;
    }
  }
  function flyTo(el, pile, u) {
    el.classList.add('flyout');
    el.classList.remove('sel');
    cardEls.delete(u);
    const p = pileXY(pile);
    el.style.zIndex = 5;
    el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(.18) rotate(25deg)';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 360);
  }
  function bumpPile(id, d) { const b = $(id); const s = b.querySelector('span'); s.textContent = (+s.textContent || 0) + d; anim(b, 'bump'); }
  async function finish() {
    const C = Cb();
    if (!C) return;
    busy = true;
    sel = null; hideKw();
    if (C.over === 'win') {
      U.banner('Victory', 'phase', 1100);
      Au.play('win');
      await U.wait(900);
      if (Cb() !== C) return;
      K.leave();
      R.winCombat(run());
      U.commit();
    } else {
      if (meE) { meE.root.style.transition = 'filter 1s, transform 1s, opacity 1s'; meE.root.style.filter = 'grayscale(1) brightness(.5)'; meE.root.style.transform = 'translateY(16px) rotate(-8deg)'; }
      U.banner('Defeated', 'enemy', 1500);
      Au.play('lose');
      await U.wait(1400);
      if (Cb() !== C) return;
      K.leave();
      R.loseCombat(run());
      U.commit();
    }
  }

  // ---------------- input ----------------
  function playable(u) { const c = Cb().hand.find((x) => x.u === u); return c && !E.canPlay(run(), c); }
  function needsT(u) { const c = Cb().hand.find((x) => x.u === u); return c && E.needsTarget(c); }
  function aliveFoes() { return Cb().en.filter((e) => e.hp > 0 && !e.gone); }
  function foeAt(x, y) {
    for (const [id, o] of foeEls) {
      if (o.root.classList.contains('dead')) continue;
      const r = o.root.getBoundingClientRect();
      if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 10 && y <= r.bottom + 10) return id;
    }
    return null;
  }
  function onCardTap(u) {
    const C = Cb();
    if (C.pending && C.pending.act !== 'discover') {
      const i = picks.indexOf(u);
      if (i >= 0) picks.splice(i, 1);
      else { if (picks.length >= C.pending.n) picks.shift(); picks.push(u); }
      Au.play('select'); layoutHand(); renderPrompt();
      return;
    }
    if (potAim !== null) { potAim = null; }
    if (sel === u) {
      if (!needsT(u)) { K.tryPlay(u); return; }
      const al = aliveFoes();
      if (al.length === 1) { K.tryPlay(u, al[0].id); return; }
      U.toast('Tap an enemy to play it');
      return;
    }
    sel = u;
    Au.play('select'); U.haptic(6);
    tgtIdx = 0;
    renderAll();
  }
  function onFoeTap(id, el) {
    const C = Cb();
    if (!C || C.phase !== 'player') { intentTip(id, el.querySelector('.intent')); return; }
    if (potAim !== null) { const slot = potAim; potAim = null; act(() => E.usePotion(run(), slot, id)); return; }
    if (sel && needsT(sel)) { K.tryPlay(sel, id); return; }
    const e = C.en.find((x) => x.id === id);
    if (e) U.tip(el.querySelector('.sprwrap'), '<b>' + U.esc(ED.ENEMIES[e.k].n) + '</b><p>' + e.hp + '/' + e.maxHp + ' HP' + (e.block ? ' · ' + e.block + ' Block' : '') + '</p><p style="color:var(--faint)">Tap its intent or statuses for details.</p>');
  }
  handEl.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('.card');
    if (!el || !el.dataset.u || el.classList.contains('flyout') || el.classList.contains('burn')) return;
    Au.unlock();
    const u = +el.dataset.u;
    if (!vhand.includes(u)) return;
    drag = { u, el, x0: ev.clientX, y0: ev.clientY, started: false, id: ev.pointerId, aim: false };
    try { el.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  });
  handEl.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    const C = Cb();
    if (!drag.started) {
      if (dx * dx + dy * dy < 100 || (C.pending && C.pending.act !== 'discover') || busy) return;
      drag.started = true;
      sel = drag.u;
      drag.aim = needsT(drag.u) && playable(drag.u) && aliveFoes().length > 0;
      hideKw();
      if (drag.aim) { layoutHand(); renderTargets(); } else { drag.el.classList.add('drag'); drag.el.classList.add('sel'); }
    }
    if (drag.aim) {
      const r = drag.el.getBoundingClientRect();
      const sx = r.left + r.width / 2, sy = r.top + 4;
      const hit = foeAt(ev.clientX, ev.clientY);
      for (const [id, o] of foeEls) o.root.classList.toggle('aimed', id === hit);
      drawAim(sx, sy, ev.clientX, ev.clientY, !!hit);
      refreshCards();
    } else {
      const hr = handEl.getBoundingClientRect();
      const x = ev.clientX - hr.left - dims.cw / 2, y = ev.clientY - hr.top - dims.ch * 0.6;
      drag.el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(1.12)';
      drag.el.classList.toggle('ready', ev.clientY < hr.top - 30);
    }
  });
  function endDrag(ev, cancel) {
    if (!drag || ev.pointerId !== drag.id) return;
    const d = drag; drag = null;
    $('aim').classList.add('hidden');
    if (!d.started) { if (!cancel) onCardTap(d.u); return; }
    d.el.classList.remove('drag');
    const hr = handEl.getBoundingClientRect();
    if (cancel) { sel = null; renderAll(); return; }
    if (d.aim) {
      const hit = foeAt(ev.clientX, ev.clientY);
      for (const [, o] of foeEls) o.root.classList.remove('aimed');
      if (hit) { K.tryPlay(d.u, hit); return; }
      sel = null; renderAll(); return;
    }
    if (ev.clientY < hr.top - 30) {
      if (needsT(d.u) && !playable(d.u)) { sel = null; renderAll(); K.tryPlay(d.u); return; }
      const al = aliveFoes();
      if (needsT(d.u) && al.length === 1) { K.tryPlay(d.u, al[0].id); return; }
      K.tryPlay(d.u); return;
    }
    sel = null; renderAll();
  }
  handEl.addEventListener('pointerup', (ev) => endDrag(ev, false));
  handEl.addEventListener('pointercancel', (ev) => endDrag(ev, true));
  function drawAim(sx, sy, ex, ey, hot) {
    const svg = $('aim');
    svg.classList.remove('hidden');
    const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 60;
    svg.querySelector('path').setAttribute('d', 'M' + sx + ' ' + sy + ' Q' + mx + ' ' + my + ' ' + ex + ' ' + ey);
    const ang = Math.atan2(ey - my, ex - mx);
    const s = 14, p1 = [ex + Math.cos(ang) * 6, ey + Math.sin(ang) * 6], p2 = [ex - Math.cos(ang - 0.5) * s, ey - Math.sin(ang - 0.5) * s], p3 = [ex - Math.cos(ang + 0.5) * s, ey - Math.sin(ang + 0.5) * s];
    svg.querySelector('polygon').setAttribute('points', p1.join(',') + ' ' + p2.join(',') + ' ' + p3.join(','));
    svg.querySelector('path').style.stroke = hot ? '#ff9a5a' : '#ffd9a0';
  }
  field.addEventListener('click', (ev) => {
    if (ev.target.closest('.foe') || ev.target.closest('#prompt') || ev.target.closest('#me')) return;
    if (sel) { sel = null; renderAll(); }
  });
  U.on($('endturn'), () => K.endTurn(), false);
  U.on($('pile-draw'), () => ED.Views.deckView('draw'));
  U.on($('pile-disc'), () => ED.Views.deckView('disc'));
  U.on($('pile-exh'), () => ED.Views.deckView('exh'));
  U.on($('energy'), () => U.tip($('energy'), '<b>Energy</b><p>Spend it to play cards. Refills to ' + (Cb() ? Cb().maxEnergy : 3) + ' each turn.</p>'), false);

  document.addEventListener('keydown', (ev) => {
    if (U.screen !== 'run' || !S.run) return;
    if (ev.key === 'Escape') {
      if (U.modalOpen()) { if ($('overlay').dataset.keep !== '1') U.closeModal(); return; }
      if (sel || potAim !== null) { sel = null; potAim = null; Cb() && renderAll(); return; }
      ED.Views.pauseMenu(); return;
    }
    if (U.modalOpen()) return;
    if (ev.key === 'd' || ev.key === 'D') { ED.Views.deckView(); return; }
    const C = Cb();
    if (!C || S.run.phase !== 'combat' || cur !== C) return;
    if (ev.key === 'e' || ev.key === 'E') { K.endTurn(); return; }
    if (/^[0-9]$/.test(ev.key)) {
      const i = ev.key === '0' ? 9 : +ev.key - 1;
      const u = vhand[i];
      if (u !== undefined) onCardTap(u);
      ev.preventDefault(); return;
    }
    const al = aliveFoes();
    if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Tab') && al.length) {
      tgtIdx = (tgtIdx + (ev.key === 'ArrowLeft' ? -1 : 1) + al.length) % al.length;
      for (const [id, o] of foeEls) o.root.classList.toggle('aimed', id === al[tgtIdx].id);
      refreshCards();
      ev.preventDefault(); return;
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && sel) {
      ev.preventDefault();
      if (needsT(sel)) { const t = al[ED.clamp(tgtIdx, 0, al.length - 1)]; K.tryPlay(sel, t && t.id); } else K.tryPlay(sel);
    }
  });

  let rsT = 0;
  root.addEventListener('resize', () => {
    clearTimeout(rsT);
    rsT = setTimeout(() => {
      if (!Cb() || cur !== Cb()) return;
      measure();
      if (meE) Art.drawSprite(meE.cv, run().char, ED.CHARS[run().char].col, dims.me);
      for (const [, o] of foeEls) o.px = 0;
      renderAll();
    }, 120);
  });
})(window);
