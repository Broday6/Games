'use strict';
// EMBER DECK — run views: HUD, router, map, rewards, shop, campfire, events, treasure, boss relics, deck selection, menus.
(function (root) {
  const ED = root.ED;
  const U = ED.UI, R = ED.Run, E = ED.Engine, Art = ED.Art, Au = ED.Audio, FX = ED.FX;
  const $ = U.$, S = U.S;
  const V = ED.Views = {};

  // ---------------- HUD ----------------
  U.hud = function () {
    const run = S.run;
    if (!run) return;
    const C = run.combat;
    const hp = C ? C.p.hp : run.hp, mx = C ? C.p.maxHp : run.maxHp;
    $('h-hp').innerHTML = Art.icon('hp') + '<span>' + Math.max(0, hp) + '/' + mx + '</span>';
    $('h-gold').innerHTML = Art.icon('gold') + '<span>' + run.gold + '</span>';
    const pots = $('h-pots'); pots.innerHTML = '';
    run.potions.forEach((k, i) => {
      const b = U.el('button', 'pot' + (k ? ' full' : ''), k ? Art.icon('potion') : '');
      if (k) b.style.setProperty('--pc', ED.POTIONS[k].col);
      b.setAttribute('aria-label', k ? ED.POTIONS[k].n : 'Empty potion slot');
      b.dataset.slot = i;
      U.on(b, () => V.potionMenu(i, b));
      pots.appendChild(b);
    });
    $('h-deck').innerHTML = Art.icon('deck') + '<em>' + run.deck.length + '</em>';
    $('h-map').innerHTML = Art.icon('map');
    $('h-menu').innerHTML = Art.icon('menu');
    const rel = $('h-relics'); rel.innerHTML = '';
    for (const r of run.relics) {
      const b = U.relicEl(r.k, 'relic', r);
      U.on(b, () => U.tip(b, U.relicTip(r.k, r)), false);
      rel.appendChild(b);
    }
    const hh = $('hud').offsetHeight;
    $('view').style.setProperty('--hudh', hh + 'px');
    $('view').style.top = hh + 'px';
  };
  U.hudHp = function (hp, mx) { const s = $('h-hp').querySelector('span'); if (s) s.textContent = Math.max(0, hp) + '/' + mx; };
  U.flashRelic = function (k) {
    const b = $('h-relics').querySelector('[data-relic="' + k + '"]');
    if (!b) return;
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
    b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const R0 = S.run && S.run.relics.find((r) => r.k === k);
    const em = b.querySelector('em'); if (em && R0) em.textContent = R0.c || 0;
  };
  U.on($('h-deck'), () => V.deckView());
  U.on($('h-map'), () => V.mapModal());
  U.on($('h-menu'), () => V.pauseMenu());

  // ---------------- router ----------------
  const VIEWS = { map: 'v-map', combat: 'v-combat', reward: 'v-reward', shop: 'v-shop', rest: 'v-rest', event: 'v-event', treasure: 'v-treasure', bossRelic: 'v-boss' };
  U.route = function () {
    const run = S.run;
    if (!run) { U.show('title'); return; }
    if (run.phase === 'victory' || run.phase === 'dead') { U.closeModal(); U.finishRun(run); return; }
    if (U.screen !== 'run') U.show('run');
    U.drawBg(run.act);
    U.hud();
    const ph = run.phase === 'select' ? run.select.back : run.phase;
    for (const k in VIEWS) $(VIEWS[k]).classList.toggle('on', k === ph);
    FX.setAmbient(ph !== 'combat' && ph !== 'map');
    stopFire();
    if (ph !== 'combat') Au.setMode('menu');
    if (ph === 'map') renderMap($('v-map'), true);
    else if (ph === 'combat') ED.Combat.enter();
    else if (ph === 'reward') renderReward();
    else if (ph === 'shop') renderShop();
    else if (ph === 'rest') renderRest();
    else if (ph === 'event') renderEvent();
    else if (ph === 'treasure') renderTreasure();
    else if (ph === 'bossRelic') renderBoss();
    if (run.phase === 'select') selectOverlay();
    else if (U.modalOpen() && $('overlay').dataset.keep !== '1') U.closeModal();
  };
  U.commit = function () { U.save(); U.route(); };

  // ---------------- map ----------------
  const LEG = [['fight', 'Fight'], ['elite', 'Elite'], ['event', 'Unknown'], ['rest', 'Campfire'], ['shop', 'Shop'], ['treasure', 'Treasure']];
  function renderMap(v, interactive) {
    const run = S.run;
    v.innerHTML = '<div class="maphead"><b>Act ' + run.act + ' — ' + ED.ACT_NAMES[run.act] + '</b><small>Floor ' + run.floor + ' · Seed ' + run.seed + (run.asc ? ' · Ascension ' + run.asc : '') + '</small></div><div class="mapscroll"><div class="mapinner"></div></div>' +
      (interactive ? '<div class="legend">' + LEG.map((l) => '<span class="node-l t-' + l[0] + '">' + Art.icon(l[0]) + l[1] + '</span>').join('') + '</div>' : '');
    const sc = v.querySelector('.mapscroll'), inner = v.querySelector('.mapinner');
    const Wi = Math.min(480, (sc.clientWidth || innerWidth) - 8);
    inner.style.width = Wi + 'px';
    const rows = R.ROWS, rowH = 76, top = 130, bot = 56;
    const H = top + (rows - 1) * rowH + bot;
    inner.style.height = H + 'px';
    const pos = (n) => (n.t === 'boss' ? { x: Wi / 2, y: 62 } : { x: ((n.c + 0.5) / R.COLS + n.x * 0.08) * Wi, y: H - bot - n.r * rowH - n.y * 14 });
    const av = interactive ? R.available(run) : [];
    const avKey = new Set(av.map((n) => n.r + ':' + n.c));
    const vis = run.map.visited;
    const doneEdge = new Set();
    for (let i = 1; i < vis.length; i++) doneEdge.add(vis[i - 1] + '>' + vis[i]);
    const curK = run.pos ? run.pos.r + ':' + run.pos.c : null;
    let svg = '<svg class="edges" viewBox="0 0 ' + Wi + ' ' + H + '">';
    const boss = { r: rows, c: 3, t: 'boss', x: 0, y: 0 };
    for (const n of run.map.nodes) {
      const a = pos(n);
      const kids = n.r === rows - 1 ? [boss] : n.n.map((c) => R.nodeAt(run, n.r + 1, c));
      for (const k of kids) {
        const b = pos(k);
        const key = n.r + ':' + n.c + '>' + k.r + ':' + k.c;
        const cls = doneEdge.has(key) ? 'done' : (curK === n.r + ':' + n.c && avKey.has(k.r + ':' + k.c)) ? 'next' : '';
        const mx = (a.x + b.x) / 2 + (n.c % 2 ? 6 : -6);
        svg += '<path class="' + cls + '" d="M' + a.x.toFixed(1) + ' ' + (a.y - 4).toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + ((a.y + b.y) / 2).toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + (b.y + (k.t === 'boss' ? 40 : 4)).toFixed(1) + '"/>';
      }
    }
    svg += '</svg>';
    inner.innerHTML = svg;
    const all = run.map.nodes.concat([boss]);
    for (const n of all) {
      const p = pos(n);
      const k = n.r + ':' + n.c;
      const isAv = avKey.has(k) || (n.t === 'boss' && av.some((x) => x.t === 'boss'));
      const b = U.el('button', 'node t-' + n.t + (vis.includes(k) ? ' done' : '') + (k === curK ? ' cur' : '') + (isAv ? ' avail' : ''), Art.icon(n.t));
      b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
      const names = { fight: 'Fight', elite: 'Elite', event: 'Unknown', rest: 'Campfire', shop: 'Shop', treasure: 'Treasure', boss: 'Boss: ' + ED.ENEMIES[run.boss].n };
      b.setAttribute('aria-label', names[n.t] + (isAv ? ' (available)' : ''));
      if (isAv) U.on(b, () => { if (R.choose(run, n.t === 'boss' ? rows : n.r, n.t === 'boss' ? 3 : n.c)) { Au.play('step'); U.haptic(12); U.commit(); } }, 'select');
      else U.on(b, () => U.tip(b, '<b>' + names[n.t] + '</b>' + (n.t === 'boss' ? '<p>The guardian of this act.</p>' : '')), false);
      inner.appendChild(b);
    }
    // scroll so the next choices sit comfortably in view
    requestAnimationFrame(() => {
      const ys = av.length ? av.map((n) => pos(n).y) : [run.pos ? pos(R.nodeAt(run, run.pos.r, run.pos.c) || boss).y : H - bot];
      const y = Math.min.apply(null, ys);
      sc.scrollTop = Math.max(0, y - sc.clientHeight * 0.55);
    });
  }
  V.mapModal = function () {
    if (!S.run || !S.run.map) return;
    U.modal('<div class="modal" style="height:100%"><div id="mm" style="flex:1;min-height:0;width:100%;display:flex;flex-direction:column"></div><div class="bar2"><button class="btn primary" id="mm-close">Close</button></div></div>');
    const mm = $('mm'); renderMap(mm, false);
    mm.querySelector('.mapscroll').style.flex = '1';
    U.on($('mm-close'), U.closeModal);
  };

  // ---------------- rewards ----------------
  function renderReward() {
    const run = S.run, rw = run.reward;
    const v = $('v-reward');
    v.innerHTML = '<div class="inner"><div class="vtitle">' + (rw.boss ? 'Boss defeated!' : 'Victory!') + '</div>' + (rw.heal ? '<div class="vsub">' + U.esc(ED.RELICS[rw.healRelic].n) + ' heals ' + rw.heal + ' HP.</div>' : '<div class="vsub">Claim your spoils.</div>') + '<div class="rlist" id="rw-list"></div><button class="btn primary big" id="rw-go" style="width:100%">Proceed</button></div>';
    const list = $('rw-list');
    rw.items.forEach((it, i) => {
      let html = '', cls = 'ritem ' + it.t;
      if (it.t === 'gold') html = '<span class="bigic">' + Art.icon('gold') + '</span><span>' + it.n + ' Gold</span>';
      else if (it.t === 'potion') { const d = ED.POTIONS[it.k]; html = '<span class="bigic" style="color:' + d.col + ';--ia:' + d.col + ';--iao:.7">' + Art.icon('potion') + '</span><span>' + U.esc(d.n) + '<small>' + U.esc(d.d) + '</small></span>'; }
      else if (it.t === 'relic') { const d = ED.RELICS[it.k]; html = '<span class="bigic" style="color:' + U.rarCol(d.r) + ';--ia:' + U.rarCol(d.r) + ';--iao:.4">' + Art.icon(d.art) + '</span><span>' + U.esc(d.n) + '<small>' + U.esc(d.d) + '</small></span>'; }
      else if (it.t === 'cards') html = '<span class="bigic">' + Art.icon('cards') + '</span><span>' + (it.done ? (it.took ? 'Took ' + U.esc(ED.CARDS[it.took.k].n) : 'Skipped card') : 'Add a card to your deck') + '</span>';
      const b = U.el('button', cls + (it.done ? ' done' : ''), html);
      U.on(b, () => {
        if (it.t === 'cards') { cardChoice(it.opts, (sel) => { R.takeReward(run, i, sel); if (sel !== 'skip') { Au.play('select'); } U.commit(); }); return; }
        if (it.t === 'potion' && !run.potions.includes(null)) { Au.play('deny'); U.toast('Potion slots full — tap a potion up top to discard one'); return; }
        if (R.takeReward(run, i)) {
          if (it.t === 'gold') { Au.play('gold'); const r = FX.rectOf(b); FX.burst(r.x, r.y, 18, ['#ffcf4a', '#fff3a0'], { speed: 200, grav: 300 }); }
          if (it.t === 'relic') { Au.play('relic'); U.haptic(20); }
          if (it.t === 'potion') Au.play('potion');
          U.commit();
        }
      }, false);
      list.appendChild(b);
    });
    U.on($('rw-go'), () => {
      const left = rw.items.filter((x) => !x.done && x.t !== 'cards').length;
      const go = () => { R.leaveReward(run); U.commit(); };
      if (left) U.confirm('Leave unclaimed rewards behind?', 'Leave', go); else go();
    });
  }
  // pick 1 of N cards (or skip)
  function cardChoice(opts, done, o) {
    o = o || {};
    let sel = -1;
    const cw = 'min(29vw, 150px)';
    U.modal('<div class="modal" style="--cw:' + cw + ';--chh:calc(' + cw + ' * 1.42)"><h2>' + (o.title || 'Choose a card') + '</h2><div class="sub" id="cc-sub">Tap a card to inspect it, tap again to take it.</div><div class="choice3" id="cc"></div><div class="kwpanel" id="cc-kw" style="position:static;width:min(340px,100%)"></div><div class="bar2"><button class="btn" id="cc-skip">' + (o.skip || 'Skip') + '</button><button class="btn primary" id="cc-take" disabled>Take</button></div></div>');
    const box = $('cc');
    opts.forEach((c, i) => {
      const el = U.cardEl(c, { cls: 'static', tag: 'button' });
      el.style.animation = 'spawnIn .35s ease-out ' + (i * 0.08) + 's both';
      U.on(el, () => {
        if (sel === i) { take(); return; }
        sel = i;
        box.querySelectorAll('.card').forEach((x, j) => x.classList.toggle('sel', j === i));
        $('cc-kw').innerHTML = U.kwHTML(c);
        $('cc-take').disabled = false;
        $('cc-take').textContent = 'Take ' + ED.CARDS[c.k].n + (c.up ? '+' : '');
      }, 'select');
      box.appendChild(el);
    });
    const take = () => { if (sel < 0) return; U.closeModal(); done(sel); };
    U.on($('cc-take'), take, false);
    U.on($('cc-skip'), () => { U.closeModal(); done('skip'); });
  }
  V.cardChoice = cardChoice;

  // ---------------- shop ----------------
  const SAYS = ['"Click click. Shiny things for shiny coins."', '"Everything here washed up fair and square."', '"The deep pays well for good cards."', '"No refunds. The tide took them."'];
  function renderShop() {
    const run = S.run, Sh = run.shop;
    const v = $('v-shop');
    const cw = 'min(28vw, 116px)';
    v.innerHTML = '<div class="inner" style="--cw:' + cw + ';--chh:calc(' + cw + ' * 1.42)"><div class="merchant"><canvas id="sh-m"></canvas><div class="say">' + SAYS[(run.floor + run.act) % SAYS.length] + '</div></div>' +
      '<div class="shopsec"><h3>Cards</h3><div class="shopcards" id="sh-cards"></div></div>' +
      '<div class="shopsec"><h3>Relics</h3><div class="shoprow" id="sh-rel"></div></div>' +
      '<div class="shopsec"><h3>Potions</h3><div class="shoprow" id="sh-pot"></div></div>' +
      '<div class="shopsec"><h3>Services</h3><button class="ritem" id="sh-rm"><span class="bigic">' + Art.icon('ash') + '</span><span>Remove a card<small>' + (Sh.removed ? 'Already used this visit' : 'Burn one card from your deck forever.') + '</small></span><span class="price' + (run.gold < R.priceOf(run, Sh.removeCost) ? ' poor' : '') + '" style="position:static;transform:none;margin-left:auto">' + Art.icon('gold') + R.priceOf(run, Sh.removeCost) + '</span></button></div>' +
      '<button class="btn primary big" id="sh-leave" style="width:100%">Leave shop</button></div>';
    Art.drawSprite($('sh-m'), 'crab', '#e0704a', 80);
    const priceTag = (p, sale) => { const cost = R.priceOf(run, p); return '<span class="price' + (run.gold < cost ? ' poor' : '') + '">' + (sale ? '<s>' + R.priceOf(run, p * 2) + '</s>' : '') + Art.icon('gold') + cost + '</span>'; };
    Sh.cards.forEach((c, i) => {
      const w = U.el('div', 'ware' + (c.sold ? ' sold' : ''));
      const el = U.cardEl(c, { cls: 'static', tag: 'button' });
      w.appendChild(el);
      w.insertAdjacentHTML('beforeend', priceTag(c.p, c.sale) + (c.sale && !c.sold ? '<span class="sale">SALE</span>' : ''));
      U.on(el, () => U.cardModal(c, { action: 'Buy · ' + R.priceOf(run, c.p) + ' gold', onAction: () => buy('cards', i) }), 'select');
      $('sh-cards').appendChild(w);
    });
    Sh.relics.forEach((r, i) => {
      const w = U.el('div', 'ware' + (r.sold ? ' sold' : ''));
      const b = U.relicEl(r.k, 'bigrelic');
      w.appendChild(b); w.insertAdjacentHTML('beforeend', priceTag(r.p));
      U.on(b, () => itemModal(U.relicTip(r.k), 'Buy · ' + R.priceOf(run, r.p) + ' gold', () => buy('relics', i)), 'select');
      $('sh-rel').appendChild(w);
    });
    Sh.potions.forEach((p, i) => {
      const d = ED.POTIONS[p.k];
      const w = U.el('div', 'ware' + (p.sold ? ' sold' : ''));
      const b = U.el('button', 'bigrelic', Art.icon('potion')); b.style.setProperty('--rc', d.col);
      w.appendChild(b); w.insertAdjacentHTML('beforeend', priceTag(p.p));
      U.on(b, () => itemModal(U.potionTip(p.k), 'Buy · ' + R.priceOf(run, p.p) + ' gold', () => buy('potions', i)), 'select');
      $('sh-pot').appendChild(w);
    });
    U.on($('sh-rm'), () => {
      if (Sh.removed) return;
      if (run.gold < R.priceOf(run, Sh.removeCost)) { Au.play('deny'); U.toast('Not enough Gold'); return; }
      R.beginSelect(run, 'remove', 'shop', { title: 'Remove a card · ' + R.priceOf(run, Sh.removeCost) + ' gold' });
      U.commit();
    });
    U.on($('sh-leave'), () => { R.toMap(run); U.commit(); });
    function buy(kind, i) {
      const err = R.buy(run, kind, i);
      if (err) { Au.play('deny'); U.toast(err); return; }
      Au.play(kind === 'relics' ? 'relic' : 'gold'); U.haptic(15);
      U.commit();
    }
  }
  function itemModal(html, action, fn) {
    U.modal('<div class="modal"><div class="panel relicinfo" style="max-width:340px">' + html + '</div><div class="bar2"><button class="btn" id="im-no">Close</button><button class="btn primary" id="im-yes">' + action + '</button></div></div>');
    U.on($('im-no'), U.closeModal);
    U.on($('im-yes'), () => { U.closeModal(); fn(); }, false);
  }

  // ---------------- campfire ----------------
  let fireRaf = 0;
  function stopFire() { if (fireRaf) cancelAnimationFrame(fireRaf); fireRaf = 0; }
  function fireLoop(cv) {
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = 180 * dpr; cv.height = 170 * dpr;
    const g = cv.getContext('2d');
    const parts = [];
    let t0 = performance.now();
    const step = (now) => {
      if (!cv.isConnected) { fireRaf = 0; return; }
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, 180, 170);
      const gl = g.createRadialGradient(90, 120, 5, 90, 110, 90); gl.addColorStop(0, 'rgba(255,150,60,0.55)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gl; g.fillRect(0, 0, 180, 170);
      g.strokeStyle = '#5a3a22'; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(50, 150); g.lineTo(130, 132); g.moveTo(50, 132); g.lineTo(130, 150); g.stroke();
      for (let i = 0; i < 3; i++) parts.push({ x: 90 + (Math.random() - 0.5) * 34, y: 138, vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 60, l: 0.6 + Math.random() * 0.5, ml: 1, s: 10 + Math.random() * 10 });
      g.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.l -= dt;
        if (p.l <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt + (90 - p.x) * dt * 1.5; p.y += p.vy * dt;
        const k = p.l / p.ml;
        g.fillStyle = 'rgba(' + 255 + ',' + Math.round(90 + 140 * k) + ',' + Math.round(40 * k) + ',' + (0.5 * k) + ')';
        g.beginPath(); g.arc(p.x, p.y, p.s * (0.4 + k * 0.6), 0, 6.283); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      fireRaf = requestAnimationFrame(step);
    };
    stopFire();
    fireRaf = requestAnimationFrame(step);
  }
  function renderRest() {
    const run = S.run, Rs = run.rest;
    const v = $('v-rest');
    const heal = R.restHeal(run);
    const canUp = R.selectable(run, 'upgrade').length > 0;
    const noRest = R.has(run, 'sleeplamp');
    let body;
    if (!Rs.done) body = '<div class="vsub">The fire crackles. Rest a while, or work your blade.</div><div class="row2" style="max-width:460px"><button class="btn big" id="rs-rest"' + (noRest ? ' disabled' : '') + '>Rest<small>' + (noRest ? 'Sleepless Lamp' : 'Heal ' + Math.min(heal, run.maxHp - run.hp) + ' HP') + '</small></button><button class="btn big" id="rs-smith"' + (canUp ? '' : ' disabled') + '>Smith<small>Upgrade a card</small></button></div>';
    else body = '<div class="vsub">' + (Rs.done === 'rest' ? 'You wake refreshed. +' + (Rs.healed || 0) + ' HP' : 'Your ' + U.esc(((run.deck.find((c) => c.u === Rs.card) || { k: 'strike_c' }) && ED.CARDS[(run.deck.find((c) => c.u === Rs.card) || { k: 'strike_c' }).k].n)) + ' gleams anew.') + '</div><button class="btn primary big" id="rs-go" style="width:100%;max-width:460px">Continue</button>';
    v.innerHTML = '<div class="inner"><div class="vtitle">Campfire</div><canvas class="fire" id="rs-fire"></canvas>' + body + '</div>';
    fireLoop($('rs-fire'));
    Au.play('fire');
    if ($('rs-rest')) U.on($('rs-rest'), () => { if (R.rest(run)) { Au.play('heal'); U.haptic(20); const r = FX.rectOf($('rs-fire')); FX.burst(r.x, r.y, 26, ['#9dffb8', '#e0ffe8'], { speed: 160, grav: -60, glow: true }); U.commit(); } }, false);
    if ($('rs-smith')) U.on($('rs-smith'), () => { R.beginSelect(run, 'upgrade', 'rest', { title: 'Upgrade a card' }); U.commit(); });
    if ($('rs-go')) U.on($('rs-go'), () => { R.toMap(run); U.commit(); });
  }

  // ---------------- events ----------------
  function renderEvent() {
    const run = S.run;
    const ev = ED.Events.view(run);
    const v = $('v-event');
    v.innerHTML = '<div class="inner"><div class="evart">' + Art.icon(ev.art) + '</div><div class="vtitle">' + U.esc(ev.n) + '</div><div class="evtext">' + U.esc(ev.text) + '</div><div class="opts" id="ev-opts"></div></div>';
    const box = $('ev-opts');
    const cardOpts = ev.opts.filter((o) => o.card);
    if (cardOpts.length) {
      const cw = 'min(28vw, 140px)';
      const row = U.el('div', 'choice3'); row.style.setProperty('--cw', cw); row.style.setProperty('--chh', 'calc(' + cw + ' * 1.42)');
      ev.opts.forEach((o, i) => {
        if (!o.card) return;
        const el = U.cardEl(o.card, { cls: 'static', tag: 'button' });
        U.on(el, () => U.cardModal(o.card, { action: 'Take', onAction: () => choose(i) }), 'select');
        row.appendChild(el);
      });
      box.appendChild(row);
    }
    ev.opts.forEach((o, i) => {
      if (o.card) return;
      const b = U.el('button', 'opt', U.esc(o.l) + (o.d ? '<small>' + U.esc(o.d) + '</small>' : '') + (o.dis ? '<small class="why">' + U.esc(o.dis) + '</small>' : ''));
      if (o.dis) b.disabled = true;
      U.on(b, () => choose(i));
      box.appendChild(b);
    });
    function choose(i) {
      const hp0 = run.hp, g0 = run.gold, r0 = run.relics.length;
      if (!ED.Events.choose(run, i)) return;
      if (run.hp < hp0) { Au.play('hit'); FX.shake(5); }
      else if (run.hp > hp0) Au.play('heal');
      if (run.gold > g0) Au.play('gold');
      if (run.relics.length > r0) Au.play('relic');
      U.commit();
    }
  }

  // ---------------- treasure ----------------
  function renderTreasure() {
    const run = S.run, T = run.treasure;
    const v = $('v-treasure');
    v.innerHTML = '<div class="inner"><div class="vtitle">Treasure</div><div class="vsub">' + (T.opened ? 'Inside the chest...' : 'A barnacled chest, half-sunk in the sand.') + '</div>' +
      '<div class="chest' + (T.opened ? ' open' : '') + '" id="tr-chest"><div class="glow"></div><div class="box"><div class="band"></div></div><div class="lid"></div></div><div id="tr-loot" class="rlist"></div>' +
      '<button class="btn primary big" id="tr-go" style="width:100%;max-width:460px">' + (T.opened ? 'Continue' : 'Open') + '</button></div>';
    const show = () => {
      const l = $('tr-loot'); l.innerHTML = '';
      if (T.relic) { const d = ED.RELICS[T.relic]; l.appendChild(U.el('div', 'ritem', '<span class="bigic" style="color:' + U.rarCol(d.r) + ';--ia:' + U.rarCol(d.r) + '">' + Art.icon(d.art) + '</span><span>' + U.esc(d.n) + '<small>' + U.esc(d.d) + '</small></span>')); }
      l.appendChild(U.el('div', 'ritem gold', '<span class="bigic">' + Art.icon('gold') + '</span><span>' + T.gold + ' Gold</span>'));
    };
    if (T.opened) show();
    const open = () => {
      if (T.opened) { R.toMap(run); U.commit(); return; }
      R.openTreasure(run); U.save();
      $('tr-chest').classList.add('open');
      Au.play('chest'); setTimeout(() => Au.play('relic'), 350); U.haptic(30);
      const r = FX.rectOf($('tr-chest'));
      FX.burst(r.x, r.y - 20, 50, ['#ffcf4a', '#fff3c0', '#ff8a3d'], { speed: 300, grav: 400, glow: true });
      show(); U.hud();
      $('tr-go').textContent = 'Continue';
    };
    U.on($('tr-chest'), () => { if (!T.opened) open(); }, false);
    U.on($('tr-go'), open, false);
  }

  // ---------------- boss relic ----------------
  function renderBoss() {
    const run = S.run;
    let sel = -1;
    const v = $('v-boss');
    v.innerHTML = '<div class="inner"><div class="vtitle">Boss Relic</div><div class="vsub">Power from the depths, at a price. Choose one.</div><div class="rlist" id="br-list"></div><div class="row2" style="max-width:460px"><button class="btn" id="br-skip">Skip</button><button class="btn primary" id="br-take" disabled>Take</button></div></div>';
    run.bossRelics.forEach((k, i) => {
      const d = ED.RELICS[k];
      const b = U.el('button', 'ritem', '<span class="bigic" style="color:#ff8a6a;--ia:#ff8a6a">' + Art.icon(d.art) + '</span><span>' + U.esc(d.n) + '<small>' + U.esc(d.d) + '</small></span>');
      U.on(b, () => { sel = i; $('br-list').querySelectorAll('.ritem').forEach((x, j) => { x.style.borderColor = j === i ? 'var(--accent2)' : ''; x.style.boxShadow = j === i ? '0 0 18px rgba(255,195,90,.5)' : ''; }); $('br-take').disabled = false; }, 'select');
      $('br-list').appendChild(b);
    });
    U.on($('br-take'), () => { if (sel < 0) return; R.pickBossRelic(run, sel); Au.play('relic'); U.commit(); actBanner(); }, false);
    U.on($('br-skip'), () => { R.pickBossRelic(run, -1); U.commit(); actBanner(); });
  }
  function actBanner() { const run = S.run; if (run && run.phase === 'map') { U.banner('<small>Act ' + run.act + '</small>' + ED.ACT_NAMES[run.act], 'phase', 1800); if (run.actHeal) U.toast('You recover ' + run.actHeal + ' HP between acts'); } }

  // ---------------- deck selection ----------------
  function selectOverlay() {
    const run = S.run, Se = run.select;
    const list = R.selectable(run, Se.purpose).slice().sort(sortCards);
    const picked = [];
    const cw = 'min(28vw, 118px)';
    const o = U.modal('<div class="modal" style="height:100%;--cw:' + cw + ';--chh:calc(' + cw + ' * 1.42)"><h2>' + U.esc(Se.title || 'Choose a card') + '</h2><div class="sub">' + (Se.purpose === 'upgrade' ? 'Tap a card to preview its upgrade.' : 'Tap a card to select it.') + '</div><div class="scroll"><div class="grid" id="sel-grid"></div></div><div class="bar2">' + (Se.cancel ? '<button class="btn" id="sel-no">Cancel</button>' : '') + '<button class="btn primary" id="sel-ok" disabled>Confirm</button></div></div>');
    o.dataset.keep = '1';
    const grid = $('sel-grid');
    const els = [];
    list.forEach((c, i) => {
      const el = U.cardEl(c, { cls: 'static', tag: 'button' });
      U.on(el, () => {
        const j = picked.indexOf(c.u);
        if (j >= 0) picked.splice(j, 1);
        else { if (picked.length >= Se.n) picked.shift(); picked.push(c.u); }
        list.forEach((cc, k) => {
          const on = picked.includes(cc.u);
          const show = Se.purpose === 'upgrade' && on ? { k: cc.k, up: 1, u: cc.u } : cc;
          els[k].innerHTML = U.cardHTML(show, null);
          els[k].classList.toggle('up', !!show.up);
          els[k].classList.toggle('picked', on);
        });
        $('sel-ok').disabled = picked.length !== Math.min(Se.n, list.length);
      }, 'select');
      els.push(el);
      grid.appendChild(el);
    });
    U.on($('sel-ok'), () => {
      const purpose = Se.purpose;
      if (R.confirmSelect(run, picked)) {
        o.dataset.keep = ''; U.closeModal();
        Au.play(purpose === 'upgrade' ? 'upgrade' : purpose === 'remove' ? 'exhaust' : 'relic'); U.haptic(20);
        U.commit();
      }
    }, false);
    if ($('sel-no')) U.on($('sel-no'), () => { o.dataset.keep = ''; U.closeModal(); R.cancelSelect(run); U.commit(); });
  }
  const TORD = { atk: 0, skl: 1, pow: 2, status: 3, curse: 4 };
  function sortCards(a, b) { const da = ED.CARDS[a.k], db = ED.CARDS[b.k]; return TORD[da.t] - TORD[db.t] || da.n.localeCompare(db.n) || b.up - a.up; }
  V.sortCards = sortCards;

  // ---------------- deck viewer ----------------
  V.deckView = function (which) {
    const run = S.run;
    if (!run) return;
    const C = run.combat;
    let tab = which || 'deck';
    const draw = () => {
      const piles = { deck: run.deck, draw: C ? C.draw : [], disc: C ? C.disc : [], exh: C ? C.exh : [] };
      const names = { deck: 'Deck', draw: 'Draw pile', disc: 'Discard', exh: 'Exhausted' };
      const list = piles[tab].slice();
      if (tab !== 'disc') list.sort(sortCards);
      const cw = 'min(28vw, 118px)';
      U.modal('<div class="modal" style="height:100%;--cw:' + cw + ';--chh:calc(' + cw + ' * 1.42)"><h2>' + names[tab] + ' (' + list.length + ')</h2>' +
        (C ? '<div class="tabs" style="justify-content:center">' + ['deck', 'draw', 'disc', 'exh'].map((k) => '<button class="tab' + (k === tab ? ' on' : '') + '" data-t="' + k + '">' + names[k] + ' ' + piles[k].length + '</button>').join('') + '</div>' : '') +
        (tab === 'draw' ? '<div class="sub">Shown in sorted order — the real order is hidden.</div>' : '') +
        '<div class="scroll"><div class="grid" id="dv-grid"></div></div><div class="bar2"><button class="btn primary" id="dv-close">Close</button></div></div>');
      const g = $('dv-grid');
      if (!list.length) g.appendChild(U.el('p', 'sub', 'Empty.'));
      for (const c of list) { const el = U.cardEl(c, { cls: 'static', tag: 'button', run: tab === 'deck' ? null : run }); U.on(el, () => U.cardModal(c, { onClose: () => draw() }), 'select'); g.appendChild(el); }
      document.querySelectorAll('#overlay .tab').forEach((b) => U.on(b, () => { tab = b.dataset.t; draw(); }));
      U.on($('dv-close'), U.closeModal);
    };
    draw();
  };

  // ---------------- potions ----------------
  V.potionMenu = function (slot, btn) {
    const run = S.run;
    const k = run.potions[slot];
    if (!k) { U.tip(btn, '<b>Empty slot</b><p>Potions drop after fights and can be bought at shops.</p>'); return; }
    const d = ED.POTIONS[k];
    const C = run.combat;
    const canUse = C ? (C.phase === 'player' && !C.over && !C.pending && !ED.Combat.busy()) : !!d.out;
    U.modal('<div class="modal"><div class="panel relicinfo" style="max-width:340px">' + U.potionTip(k) + (!C && !d.out ? '<p style="color:var(--faint)">Use it during combat.</p>' : '') + '</div><div class="bar2"><button class="btn" id="po-x">Discard</button><button class="btn" id="po-no">Close</button>' + (canUse ? '<button class="btn primary" id="po-use">Drink</button>' : '') + '</div></div>');
    U.on($('po-no'), U.closeModal);
    U.on($('po-x'), () => { run.potions[slot] = null; U.closeModal(); U.save(); U.hud(); });
    if ($('po-use')) U.on($('po-use'), () => {
      U.closeModal();
      if (C) ED.Combat.usePotion(slot);
      else if (E.usePotion(run, slot)) { Au.play('potion'); Au.play('heal'); U.commit(); }
    }, false);
  };

  // ---------------- pause menu ----------------
  V.pauseMenu = function () {
    const run = S.run;
    if (!run) return;
    const dbg = U.debug ? '<h3>Debug</h3><div class="row2" style="flex-wrap:wrap"><button class="btn" data-d="gold">+500 gold</button><button class="btn" data-d="heal">Full heal</button><button class="btn" data-d="win">Win fight</button><button class="btn" data-d="die">Lose</button><button class="btn" data-d="god">God mode' + (U.god ? ' ✓' : '') + '</button><button class="btn" data-d="boss">Go to boss</button><button class="btn" data-d="act">Next act</button><button class="btn" data-d="relic">Random relic</button><button class="btn" data-d="unlock">Unlock all</button></div>' : '';
    U.modal('<div class="modal"><h2>Paused</h2><div class="sub">' + ED.CHARS[run.char].n + ' · Act ' + run.act + ' · Floor ' + run.floor + (run.asc ? ' · Ascension ' + run.asc : '') + '<br>Seed <b>' + run.seed + '</b></div><div class="scroll"><div class="list" style="margin:0 auto">' +
      '<button class="btn primary" id="pm-res">Resume</button><div class="row2"><button class="btn" id="pm-deck">Deck</button><button class="btn" id="pm-map">Map</button></div><button class="btn" id="pm-how">How to play</button>' +
      '<h3>Settings</h3><div id="pm-set" class="list"></div>' +
      '<button class="btn" id="pm-quit">Save &amp; quit to title</button><button class="btn danger" id="pm-ab">Abandon run</button>' + dbg + '</div></div></div>');
    U.buildSettings($('pm-set'));
    U.on($('pm-res'), U.closeModal);
    U.on($('pm-deck'), () => V.deckView());
    U.on($('pm-map'), () => V.mapModal());
    U.on($('pm-how'), () => U.howTo());
    U.on($('pm-quit'), () => { U.closeModal(); U.save(); ED.Combat.leave(); U.show('title'); });
    U.on($('pm-ab'), () => U.confirm('Abandon this run? It will count as a defeat.', 'Abandon', () => { ED.Combat.leave(); R.abandon(run); U.route(); }));
    document.querySelectorAll('#overlay [data-d]').forEach((b) => U.on(b, () => debugAct(b.dataset.d)));
  };
  function debugAct(k) {
    const run = S.run;
    U.closeModal();
    if (k === 'gold') { run.gold += 500; U.commit(); }
    if (k === 'heal') { run.hp = run.maxHp; if (run.combat) run.combat.p.hp = run.combat.p.maxHp; U.commit(); }
    if (k === 'god') { U.god = !U.god; U.toast('God mode ' + (U.god ? 'on' : 'off')); }
    if (k === 'win' && run.combat) ED.Combat.debugWin();
    if (k === 'die' && run.combat) ED.Combat.debugLose();
    if (k === 'boss') { ED.Combat.leave(); run.combat = null; run.pos = { r: R.ROWS - 1, c: run.map.nodes.filter((n) => n.r === R.ROWS - 1)[0].c }; run.phase = 'map'; U.commit(); }
    if (k === 'act') { ED.Combat.leave(); run.combat = null; if (run.act < 3) R.nextAct(run); U.commit(); }
    if (k === 'relic') { const r = R.rollRelic(run); if (r) R.gainRelic(run, r); U.commit(); }
    if (k === 'unlock') { S.meta.unlocked.witch = S.meta.unlocked.rogue = true; for (const c of ED.CHAR_ORDER) S.meta.maxAsc[c] = 10; U.save(); U.toast('Everything unlocked'); }
  }
})(window);
