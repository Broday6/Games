'use strict';
// EMBER DECK — turn-based combat engine. Pure logic over a serialisable state (run.combat); emits events in C.ev for the UI.
(function (root) {
  const ED = root.ED;
  const E = ED.Engine = {};
  const CARDS = ED.CARDS, ST = ED.STATUS;
  const HAND_MAX = 10;
  const DEBUFFS = { vuln: 1, weak: 1, frail: 1, poison: 1, burn: 1, strDown: 0 };

  E.hasRelic = (run, k) => run.relics.some((r) => r.k === k);
  E.maxEnergy = (run) => 3 + run.relics.reduce((s, r) => s + ((ED.RELICS[r.k] && ED.RELICS[r.k].energy) || 0), 0);
  E.val = function (card, name) { const d = CARDS[card.k]; const a = d.v[name]; return a ? a[card.up ? 1 : 0] : 0; };
  E.vals = function (card) { const d = CARDS[card.k], o = {}; for (const k in d.v) o[k] = d.v[k][card.up ? 1 : 0]; return o; };

  // ---------------- helper context ----------------
  function makeG(run) {
    const C = run.combat;
    const p = C.p;
    const G = { run, C, p };
    G.def = (c) => CARDS[c.k];
    G.enemies = () => C.en.filter((e) => e.hp > 0 && !e.gone);
    G.random = () => ED.rand(run.rng, 'combat');
    G.randomEnemy = () => { const a = G.enemies(); return a.length ? a[Math.floor(G.random() * a.length)] : null; };
    G.ev = (o) => { C.ev.push(o); };
    G.has = (k) => E.hasRelic(run, k);
    G.relic = (k) => run.relics.find((r) => r.k === k);
    G.flash = (k) => G.ev({ t: 'relic', k });
    G.byId = (id) => (id === 'p' ? p : C.en.find((e) => e.id === id));
    G.uid = () => ++run.nextUid;

    G.strOf = function (c) {
      let s = c.st.str || 0;
      if (c === p && G.has('sunburnt') && p.hp <= p.maxHp / 2) s += 3;
      return s;
    };
    G.calcAttack = function (src, tgt, base, strMult, mult) {
      let d = base + G.strOf(src) * (strMult || 1);
      if (mult) d *= mult;
      if ((src.st.weak || 0) > 0) d *= 0.75;
      if (tgt && (tgt.st.vuln || 0) > 0) d *= (tgt !== p && G.has('spyglass')) ? 1.75 : 1.5;
      return Math.max(0, Math.floor(d));
    };
    G.calcBlock = function (base) {
      let b = base + (p.st.dex || 0);
      if ((p.st.frail || 0) > 0) b *= 0.75;
      return Math.max(0, Math.floor(b));
    };

    // ----- damage -----
    G.dealDamage = function (t, amount, o) {
      o = o || {};
      if (!t || t.hp <= 0 || t.gone) return 0;
      amount = Math.max(0, amount | 0);
      const blk = Math.min(t.block, amount);
      t.block -= blk;
      let loss = amount - blk;
      if (t === p && loss > 0 && G.has('ironhull')) loss = Math.max(0, loss - 1);
      loss = Math.min(loss, t.hp);
      t.hp -= loss;
      G.ev({ t: 'dmg', id: t.id, amt: loss, blk, hp: t.hp, block: t.block, kind: o.kind || (o.atk ? 'atk' : 'dmg'), src: o.src ? o.src.id : null });
      if (t === p) { if (loss > 0) G.onPlayerHpLoss(loss); }
      else { run.stats.dmg = (run.stats.dmg || 0) + loss; }
      if (o.atk && t.st.curl && amount > 0 && t.hp > 0) { const c = t.st.curl; delete t.st.curl; G.rawBlock(c, t); G.ev({ t: 'status', id: t.id }); }
      if (o.atk && o.src === p && loss > 0 && p.st.envenom && t.hp > 0) G.apply(t, 'poison', p.st.envenom);
      if (o.atk && o.src && o.src.hp > 0) {
        const th = (t.st.thorns || 0) + (t.st.riposte || 0);
        if (th > 0) G.dealDamage(o.src, th, { kind: 'thorns', src: t });
        if (t.st.shroud && o.src !== p) G.apply(o.src, 'burn', t.st.shroud);
      }
      if (t.hp <= 0) G.onDeath(t);
      else if (t !== p) G.checkThresholds(t);
      return loss;
    };
    G.loseHp = function (t, n, kind) {
      if (!t || t.hp <= 0 || n <= 0) return 0;
      if (t === p && G.has('ironhull')) n = Math.max(0, n - 1);
      n = Math.min(n, t.hp);
      t.hp -= n;
      G.ev({ t: 'dmg', id: t.id, amt: n, blk: 0, hp: t.hp, block: t.block, kind: kind || 'hploss' });
      if (t === p) { if (n > 0) G.onPlayerHpLoss(n); } else run.stats.dmg = (run.stats.dmg || 0) + n;
      if (t.hp <= 0) G.onDeath(t); else if (t !== p) G.checkThresholds(t);
      return n;
    };
    G.onPlayerHpLoss = function (n) {
      C.hpLost = (C.hpLost || 0) + n;
      for (const R of run.relics) { const d = ED.RELICS[R.k]; if (d && d.onHpLoss) d.onHpLoss(G, R, n); }
    };
    G.hit = function (t, base, o) {
      o = o || {};
      const hits = o.hits === undefined ? 1 : o.hits;
      let total = 0;
      for (let i = 0; i < hits; i++) {
        if (!t || t.hp <= 0 || t.gone || C.over) break;
        total += G.dealDamage(t, G.calcAttack(p, t, base, o.strMult, C.dbl ? 2 : 1), { atk: true, src: p });
      }
      return total;
    };
    G.hitAll = function (base, o) { for (const e of G.enemies()) G.hit(e, base, o); };
    G.damage = function (t, n) { return G.dealDamage(t, n, { kind: 'dmg' }); };
    G.damageAll = function (n) { for (const e of G.enemies()) G.dealDamage(e, n, { kind: 'dmg' }); };
    G.damagePlayer = function (n, kind) { return G.dealDamage(p, n, { kind: kind || 'dmg' }); };

    // ----- block -----
    G.rawBlock = function (n, who) {
      who = who || p;
      if (n <= 0 || who.hp <= 0) return;
      who.block = Math.min(999, who.block + n);
      G.ev({ t: 'block', id: who.id, amt: n, block: who.block });
      if (who === p && p.st.tidebreaker) { const e = G.randomEnemy(); if (e) G.dealDamage(e, p.st.tidebreaker, { kind: 'dmg' }); }
    };
    G.block = function (base) { G.rawBlock(G.calcBlock(base), p); };

    // ----- statuses -----
    G.apply = function (t, k, n, o) {
      o = o || {};
      if (!t || t.hp <= 0 || t.gone || !n) return;
      const src = o.src || 'p';
      const side = t === p ? 'p' : 'e';
      const debuff = DEBUFFS[k] !== undefined || ((k === 'str' || k === 'dex') && n < 0);
      if (debuff && src !== side && (t.st.artifact || 0) > 0) {
        t.st.artifact--; if (!t.st.artifact) delete t.st.artifact;
        G.ev({ t: 'status', id: t.id, k: 'artifact', n: -1, blocked: k });
        return;
      }
      if (!o.raw && src === 'p' && side === 'e') {
        if (k === 'burn' && G.has('brazier')) n += 1;
        if (k === 'poison' && G.has('pufferspine')) n += 1;
      }
      t.st[k] = (t.st[k] || 0) + n;
      if (t.st[k] === 0) delete t.st[k];
      if (side === 'p' && src === 'e' && C.phase === 'enemy' && (k === 'vuln' || k === 'weak' || k === 'frail')) C.just[k] = 1;
      G.ev({ t: 'status', id: t.id, k, n, val: t.st[k] || 0 });
    };
    G.applyAll = function (k, n, o) { for (const e of G.enemies()) G.apply(e, k, n, o); };
    G.cleanse = function (t) {
      let any = false;
      for (const k of ['vuln', 'weak', 'frail', 'poison', 'burn']) if (t.st[k]) { delete t.st[k]; any = true; }
      if ((t.st.str || 0) < 0) { delete t.st.str; any = true; }
      if (any) G.ev({ t: 'status', id: t.id, k: 'cleanse' });
    };
    G.totalBurn = () => G.enemies().reduce((s, e) => s + (e.st.burn || 0), 0);
    G.intendsAttack = (e) => { const m = E.moveOf(e); return !!(m && m.dmg); };

    // ----- resources -----
    G.energy = function (n) { C.energy += n; G.ev({ t: 'energy', val: C.energy }); };
    G.heal = function (n, who) {
      who = who || p;
      if (who.hp <= 0) return;
      const h = Math.min(n, who.maxHp - who.hp);
      who.hp += h;
      if (h > 0) G.ev({ t: 'heal', id: who.id, amt: h, hp: who.hp });
    };
    G.raiseMaxHp = function (n) { p.maxHp += n; p.hp += n; G.ev({ t: 'heal', id: 'p', amt: n, hp: p.hp, max: true }); };
    G.gold = function (n) { if (G.has('ghostcoin')) return; run.gold += n; C.goldGain = (C.goldGain || 0) + n; G.ev({ t: 'gold', amt: n }); };

    // ----- piles -----
    G.reshuffle = function () {
      if (!C.disc.length) return false;
      C.draw = ED.shuffle(run.rng, 'combat', C.disc.splice(0));
      G.ev({ t: 'shuffle', n: C.draw.length });
      return true;
    };
    G.draw = function (n) {
      const got = [];
      if (p.st.noDraw) return got;
      for (let i = 0; i < n; i++) {
        if (C.hand.length >= HAND_MAX) break;
        if (!C.draw.length && !G.reshuffle()) break;
        const c = C.draw.pop();
        C.hand.push(c); got.push(c);
        G.ev({ t: 'draw', u: c.u });
      }
      return got;
    };
    G.makeCard = function (k, up) { return { u: G.uid(), k, up: up ? 1 : 0 }; };
    G.add = function (k, where, n, up) {
      for (let i = 0; i < (n || 1); i++) {
        const c = G.makeCard(k, up);
        if (where === 'hand' && C.hand.length < HAND_MAX) { C.hand.push(c); G.ev({ t: 'add', u: c.u, to: 'hand' }); }
        else if (where === 'draw') { C.draw.splice(Math.floor(G.random() * (C.draw.length + 1)), 0, c); G.ev({ t: 'add', u: c.u, to: 'draw', k }); }
        else { C.disc.push(c); G.ev({ t: 'add', u: c.u, to: 'disc', k }); }
      }
    };
    G.addRandomCard = function () {
      const pool = ED.pool(run.char).filter((d) => d.r !== 'rare' || G.random() < 0.3);
      const d = pool[Math.floor(G.random() * pool.length)];
      if (d) G.add(d.k, 'hand', 1);
    };
    G.fromDiscard = function (n) {
      for (let i = 0; i < n && C.disc.length && C.hand.length < HAND_MAX; i++) {
        const j = Math.floor(G.random() * C.disc.length);
        const c = C.disc.splice(j, 1)[0];
        C.hand.push(c); G.ev({ t: 'draw', u: c.u, from: 'disc' });
      }
    };
    G.removeFrom = function (c) {
      for (const pile of [C.hand, C.draw, C.disc]) { const i = pile.indexOf(c); if (i >= 0) { pile.splice(i, 1); return true; } }
      return false;
    };
    G.exhaust = function (c) {
      G.removeFrom(c);
      C.exh.push(c);
      G.ev({ t: 'exhaust', u: c.u });
      G.afterExhaust(c);
    };
    G.afterExhaust = function (c) {
      run.stats.exhausted = (run.stats.exhausted || 0) + 1;
      if (p.st.kindleSoul) G.rawBlock(p.st.kindleSoul, p);
      for (const R of run.relics) { const d = ED.RELICS[R.k]; if (d && d.onExhaust) d.onExhaust(G, R, c); }
      if (p.st.emberHeart) G.draw(p.st.emberHeart);
    };
    G.exhaustHand = function (filter) {
      const list = C.hand.filter(filter);
      for (const c of list) G.exhaust(c);
      return list.length;
    };
    G.exhaustRandom = function (n) {
      for (let i = 0; i < n && C.hand.length; i++) G.exhaust(C.hand[Math.floor(G.random() * C.hand.length)]);
    };
    G.discard = function (c, manual) {
      const i = C.hand.indexOf(c);
      if (i < 0) return;
      C.hand.splice(i, 1); C.disc.push(c);
      G.ev({ t: 'discard', u: c.u });
      if (manual) {
        C.turnDisc++;
        const d = CARDS[c.k];
        if (d.onDiscard) d.onDiscard(G, c);
        for (const R of run.relics) { const rd = ED.RELICS[R.k]; if (rd && rd.onDiscard) rd.onDiscard(G, R, c); }
      }
    };
    G.discardHand = function () { const list = C.hand.slice(); for (const c of list) G.discard(c, true); return list.length; };
    G.upgradeAllCombat = function () {
      for (const pile of [C.hand, C.draw, C.disc]) for (const c of pile) if (ED.upgradable(c)) c.up = 1;
      G.ev({ t: 'upgradeAll' });
    };
    G.choose = function (o) { C.pendingQueue.push(Object.assign({ src: C.playing ? C.playing.k : null, up: C.playing ? C.playing.up : 0 }, o)); };
    G.discover = function () {
      const pool = ED.pool(run.char);
      const opts = [];
      let guard = 0;
      while (opts.length < 3 && guard++ < 50) { const d = pool[Math.floor(G.random() * pool.length)]; if (!opts.includes(d.k)) opts.push(d.k); }
      C.pending = { act: 'discover', opts, prompt: 'Choose a card' };
    };

    // ----- creatures -----
    G.spawn = function (k, o) {
      o = o || {};
      if (G.enemies().length >= 5) return null;
      const e = E.makeEnemy(run, k, C.idc++, o);
      C.en.push(e);
      const d = ED.ENEMIES[k];
      if (d.init) d.init(G, e, C.en.length - 1);
      E.applyAscStart(run, G, e);
      G.ev({ t: 'spawn', id: e.id });
      E.pickIntent(G, e);
      return e;
    };
    G.kill = function (e, silent) {
      if (e.hp <= 0) return;
      e.hp = 0;
      G.ev({ t: 'die', id: e.id, silent: !!silent });
      if (!silent) G.onDeath(e, true);
      G.checkWin();
    };
    G.onDeath = function (t, already) {
      if (t === p) {
        const R = G.relic('phoenixash');
        if (R && !R.used) { R.used = 1; p.hp = Math.floor(p.maxHp / 2); G.flash('phoenixash'); G.ev({ t: 'heal', id: 'p', amt: p.hp, hp: p.hp }); return; }
        C.over = 'lose'; G.ev({ t: 'lose' });
        return;
      }
      if (!already) G.ev({ t: 'die', id: t.id });
      run.stats.kills = (run.stats.kills || 0) + 1;
      if (t.st.spores) G.apply(p, 'vuln', t.st.spores, { src: 'e' });
      const d = ED.ENEMIES[t.k];
      if (d.boss || d.elite) {
        if (!G.enemies().some((e) => !e.st.minion)) for (const e of G.enemies()) if (e.st.minion) { e.gone = true; e.hp = 0; G.ev({ t: 'flee', id: e.id }); }
      }
      G.checkWin();
    };
    G.checkWin = function () {
      if (C.over) return;
      if (!G.enemies().length) { C.over = 'win'; G.ev({ t: 'win' }); }
    };
    G.checkThresholds = function (e) {
      const d = ED.ENEMIES[e.k];
      if (e.st.split && !e.d.splitting && e.hp <= e.maxHp / 2) {
        e.d.splitting = 1; e.mv = 'split'; G.ev({ t: 'intent', id: e.id, phase: 'Splitting!' });
      }
      if (d.phases) {
        while (e.ph < d.phases.length && e.hp <= e.maxHp * d.phases[e.ph].at) {
          const ph = d.phases[e.ph];
          e.ph++;
          G.ev({ t: 'phase', id: e.id, text: ph.text });
          if (ph.enter) ph.enter(G, e);
          E.pickIntent(G, e);
        }
      }
    };
    return G;
  }
  E.G = makeG;

  // ---------------- setup ----------------
  E.makeEnemy = function (run, k, idc, o) {
    const d = ED.ENEMIES[k];
    o = o || {};
    const actGap = Math.max(0, run.act - d.act);
    let hpm = 1 + (d.elite || d.minion ? 0.5 : 0.6) * actGap, dm = 1 + (d.minion ? 0.3 : 0.4) * actGap;
    const a = run.asc || 0;
    if (d.boss) { if (a >= 5) { hpm *= 1.1; dm *= 1.1; } }
    else if (d.elite) { if (a >= 4) { hpm *= 1.15; dm *= 1.1; } }
    else { if (a >= 2) hpm *= 1.1; if (a >= 3) dm *= 1.1; }
    const base = ED.rint(run.rng, 'combat', d.hp[0], d.hp[1]);
    const maxHp = o.hp ? Math.max(1, o.hp) : Math.round(base * hpm);
    const hp = maxHp;
    return { id: 'e' + idc, k, hp, maxHp, block: 0, st: d.minion ? { minion: 1 } : {}, mv: null, hist: [], ph: 0, dm, d: {} };
  };
  E.applyAscStart = function (run, G, e) { if ((run.asc || 0) >= 10) G.apply(e, 'str', 1, { src: 'e' }); };

  E.startCombat = function (run, enc) {
    const C = run.combat = {
      type: enc.type, keys: enc.enemies.slice(), turn: 0, energy: 0, maxEnergy: E.maxEnergy(run),
      p: { id: 'p', hp: run.hp, maxHp: run.maxHp, block: 0, st: {} },
      en: [], idc: 0, draw: [], hand: [], disc: [], exh: [],
      turnAtk: 0, turnSkl: 0, turnCards: 0, turnDisc: 0, bonusDraw: 0, startShivs: 0,
      pending: null, pendingQueue: [], just: {}, playing: null, over: null, ev: [], phase: 'player', rewardsGiven: false,
    };
    const G = makeG(run);
    for (const k of enc.enemies) {
      const e = E.makeEnemy(run, k, C.idc++);
      C.en.push(e);
    }
    C.en.forEach((e, i) => { const d = ED.ENEMIES[e.k]; if (d.init) d.init(G, e, i); E.applyAscStart(run, G, e); });
    // deck → draw pile (combat copies)
    const deck = run.deck.map((c) => ({ u: c.u, k: c.k, up: c.up }));
    ED.shuffle(run.rng, 'combat', deck);
    const innate = deck.filter((c) => { const d = CARDS[c.k]; return d.inn && d.inn[c.up]; });
    C.draw = deck.filter((c) => !innate.includes(c)).concat(innate);
    for (const R of run.relics) { const d = ED.RELICS[R.k]; if (d && d.combatStart) d.combatStart(G, R); }
    if (C.startShivs) G.add('shiv', 'hand', C.startShivs);
    for (const e of G.enemies()) E.pickIntent(G, e);
    C.extraInnate = Math.max(0, innate.length - 5);
    E.startTurn(run, G);
    return C;
  };

  // ---------------- intents ----------------
  E.moveOf = function (e) { const d = ED.ENEMIES[e.k]; return e.mv ? d.moves[e.mv] : null; };
  E.pickIntent = function (G, e) {
    if (e.hp <= 0 || e.gone) return;
    if (e.d.splitting) { e.mv = 'split'; return; }
    e.mv = ED.ENEMIES[e.k].ai(G, e);
  };
  E.scaledDmg = (e, m) => Math.round(m.dmg * e.dm);
  E.intent = function (run, e) {
    const m = E.moveOf(e);
    if (!m) return null;
    const G = makeG(run);
    const it = { name: m.n, kinds: [] };
    if (m.dmg) { it.kinds.push('atk'); it.dmg = G.calcAttack(e, run.combat.p, E.scaledDmg(e, m)); it.hits = m.hits || 1; }
    if (m.block || m.blockAll) it.kinds.push('block');
    if (m.buff || m.buffAll || m.intent === 'buff') it.kinds.push('buff');
    if (m.debuff || m.add) it.kinds.push('debuff');
    if (m.summon) it.kinds.push('summon');
    if (m.intent === 'split') it.kinds.push('split');
    if (m.die && !m.dmg) it.kinds.push('escape');
    if (!it.kinds.length) it.kinds.push('unknown');
    return it;
  };
  E.incoming = function (run) {
    let s = 0;
    for (const e of run.combat.en) { if (e.hp <= 0 || e.gone) continue; const it = E.intent(run, e); if (it && it.dmg !== undefined) s += it.dmg * it.hits; }
    return s;
  };

  // ---------------- turns ----------------
  E.startTurn = function (run, G) {
    const C = run.combat, p = C.p;
    C.turn++; C.phase = 'player';
    C.turnAtk = C.turnSkl = C.turnCards = C.turnDisc = 0; C.tomeUsed = 0;
    if (!p.st.fortress) {
      if (G.has('tideledger') && C.turn > 1) p.block = Math.max(0, p.block - 15); else p.block = 0;
    }
    delete p.st.riposte; delete p.st.shroud; delete p.st.noDraw;
    const maxE = C.maxEnergy;
    C.energy = (G.has('moonjar') && C.turn > 1) ? C.energy + maxE : maxE;
    G.ev({ t: 'turn', who: 'p', n: C.turn });
    // start-of-turn damage
    tickDots(G, p);
    if (C.over) return;
    if (p.st.nextBlock) { const b = p.st.nextBlock; delete p.st.nextBlock; G.rawBlock(b, p); }
    let draw = 5 + C.bonusDraw;
    C.bonusDraw = 0;
    if (C.turn === 1 && C.extraInnate) draw += C.extraInnate;
    if (p.st.nextDraw) { draw += p.st.nextDraw; delete p.st.nextDraw; }
    for (const R of run.relics) { const d = ED.RELICS[R.k]; if (d && d.drawBonus) draw += d.drawBonus; }
    if (p.st.unbroken) G.apply(p, 'str', p.st.unbroken);
    if (p.st.pyromancy) G.applyAll('burn', p.st.pyromancy);
    if (p.st.noxious) G.applyAll('poison', p.st.noxious);
    if (p.st.fireWithin) { G.energy(p.st.fireWithin); G.add('cinder', 'hand', p.st.fireWithin); }
    if (p.st.endlessEdge) G.add('shiv', 'hand', p.st.endlessEdge);
    for (const R of run.relics) { const d = ED.RELICS[R.k]; if (d && d.turnStart) d.turnStart(G, R); }
    G.draw(draw);
    G.ev({ t: 'energy', val: C.energy });
  };

  function tickDots(G, t) {
    if (t.hp <= 0) return;
    if (t.st.poison) {
      const n = t.st.poison;
      t.st.poison = n - 1; if (!t.st.poison) delete t.st.poison;
      G.loseHp(t, n, 'poison');
    }
    if (t.hp > 0 && t.st.burn) {
      const n = t.st.burn;
      const ever = t !== G.p && G.p.st.everburn;
      t.st.burn = ever ? n - 1 : n - Math.max(1, Math.floor(n / 2)); if (!t.st.burn) delete t.st.burn;
      G.loseHp(t, n, 'burn');
    }
  }
  function endOfTurnStatuses(G, t) {
    if (t.hp <= 0) return;
    if (t.st.plating) G.rawBlock(t.st.plating, t);
    if (t.st.rage) G.apply(t, 'str', t.st.rage, { src: t === G.p ? 'p' : 'e' });
    if (t.st.regen) { G.heal(t.st.regen, t); t.st.regen--; if (!t.st.regen) delete t.st.regen; }
  }
  // Vulnerable / Weak / Frail tick down at the end of each round; debuffs enemies put on you this round are spared once.
  function decayDebuffs(G, t, skip) {
    if (t.hp <= 0) return;
    for (const k of ['vuln', 'weak', 'frail']) if (t.st[k] && !(skip && skip[k])) { t.st[k]--; if (!t.st[k]) delete t.st[k]; }
  }

  E.endTurn = function (run) {
    const C = run.combat;
    if (!C || C.over || C.pending || C.phase !== 'player') return false;
    const G = makeG(run), p = C.p;
    C.phase = 'enemy';
    G.ev({ t: 'endturn' });
    // cards that hurt while held
    for (const c of C.hand.slice()) { const d = CARDS[c.k]; if (d.endTurn) { G.ev({ t: 'cardfx', u: c.u }); d.endTurn(G, c); if (C.over) return true; } }
    for (const R of run.relics) { const d = ED.RELICS[R.k]; if (d && d.turnEnd) d.turnEnd(G, R); }
    if (p.st.strDown) { const n = p.st.strDown; delete p.st.strDown; G.apply(p, 'str', -n, { src: 'p' }); }
    for (const c of C.hand.slice()) { const d = CARDS[c.k]; if (d.eth) G.exhaust(c); }
    for (const c of C.hand.slice()) { if (!CARDS[c.k].ret) G.discard(c, false); }
    for (const c of C.draw.concat(C.disc)) delete c.tc;
    endOfTurnStatuses(G, p);
    if (C.over) return true;
    // ----- enemy turn -----
    G.ev({ t: 'turn', who: 'e' });
    for (const e of G.enemies()) e.block = 0;
    for (const e of G.enemies()) { tickDots(G, e); if (C.over) return true; }
    const actors = G.enemies().slice();
    for (const e of actors) {
      if (e.hp <= 0 || e.gone) continue;
      E.doMove(run, G, e);
      if (C.over) return true;
    }
    for (const e of G.enemies()) endOfTurnStatuses(G, e);
    if (C.over) return true;
    for (const e of G.enemies()) decayDebuffs(G, e);
    decayDebuffs(G, p, C.just);
    C.just = {};
    for (const e of G.enemies()) if (!e.fresh) E.pickIntent(G, e);
    for (const e of C.en) delete e.fresh;
    G.ev({ t: 'intent' });
    E.startTurn(run, G);
    return true;
  };

  E.doMove = function (run, G, e) {
    const C = run.combat, p = C.p;
    const d = ED.ENEMIES[e.k];
    const key = e.mv;
    const m = d.moves[key];
    if (!m) return;
    G.ev({ t: 'move', id: e.id, name: m.n, atk: !!m.dmg });
    if (m.dmg) {
      const hits = m.hits || 1;
      for (let i = 0; i < hits; i++) {
        if (p.hp <= 0 || e.hp <= 0 || C.over) break;
        G.dealDamage(p, G.calcAttack(e, p, E.scaledDmg(e, m)), { atk: true, src: e });
      }
    }
    if (C.over) return;
    if (e.hp > 0) {
      if (m.block) G.rawBlock(Math.round(m.block * (e.dm > 1 ? 1 + (e.dm - 1) / 2 : 1)), e);
      if (m.blockAll) for (const a of G.enemies()) G.rawBlock(m.blockAll, a);
      if (m.buff) for (const k in m.buff) G.apply(e, k, m.buff[k], { src: 'e' });
      if (m.buffAll) for (const a of G.enemies()) for (const k in m.buffAll) G.apply(a, k, m.buffAll[k], { src: 'e' });
      if (m.heal) G.heal(m.heal, e);
    }
    if (m.debuff) for (const k in m.debuff) G.apply(p, k, m.debuff[k], { src: 'e' });
    if (m.add) G.add(m.add[0], m.add[2], m.add[1]);
    if (m.summon) for (const k of m.summon) { const s = G.spawn(k); if (s) s.fresh = 1; }
    e.hist.push(key);
    if (m.fn) m.fn(G, e);
    if (m.die && e.hp > 0) { e.hp = 0; G.ev({ t: 'die', id: e.id, silent: true }); G.checkWin(); }
  };

  // ---------------- cards ----------------
  E.cost = function (run, c) {
    const d = CARDS[c.k];
    if (d.unp) return null;
    let cost = d.cost[c.up ? 1 : 0];
    if (c.tc !== undefined) cost = c.tc;
    if (d.costFn && run.combat) cost = d.costFn(makeG(run), c, cost);
    if (run.combat && run.combat.p.st.ashPact && d.t === 'skl') cost = 0;
    return cost;
  };
  E.canPlay = function (run, c) {
    const C = run.combat;
    if (!C || C.over || C.pending || C.phase !== 'player') return 'Not now';
    const d = CARDS[c.k];
    if (d.unp) return 'Unplayable';
    const cost = E.cost(run, c);
    if (cost > C.energy) return 'Not enough Energy';
    if (d.canPlay) { const r = d.canPlay(makeG(run), c); if (r) return r; }
    return null;
  };
  E.needsTarget = (c) => CARDS[c.k].tg === 'enemy';

  E.play = function (run, u, tid) {
    const C = run.combat;
    const c = C.hand.find((x) => x.u === u);
    if (!c) return false;
    if (E.canPlay(run, c)) return false;
    const G = makeG(run);
    const d = CARDS[c.k];
    let t = null;
    if (d.tg === 'enemy') {
      t = tid ? G.byId(tid) : null;
      if (!t || t.hp <= 0 || t.gone || t === C.p) { const al = G.enemies(); if (al.length === 1) t = al[0]; else return false; }
    }
    const cost = E.cost(run, c);
    C.energy -= cost;
    C.hand.splice(C.hand.indexOf(c), 1);
    G.ev({ t: 'play', u: c.u, tgt: t ? t.id : null, k: c.k, energy: C.energy });
    run.stats.cards = (run.stats.cards || 0) + 1;
    if (d.t === 'atk') {
      const R = G.relic('whetstone');
      if (R) { R.c = (R.c || 0) + 1; if (R.c >= 10) { R.c = 0; C.dbl = true; G.flash('whetstone'); } }
    }
    const x = { card: c, up: c.up, v: E.vals(c), t };
    C.pendingQueue = [];
    C.playing = c;
    if (d.play) d.play(G, x);
    C.playing = null;
    C.dbl = false;
    delete c.tc;
    // destination
    if (d.t === 'pow') G.ev({ t: 'power', u: c.u });
    else if (d.ex[c.up ? 1 : 0] || (C.p.st.ashPact && d.t === 'skl')) { C.exh.push(c); G.ev({ t: 'exhaust', u: c.u, played: true }); G.afterExhaust(c); }
    else { C.disc.push(c); G.ev({ t: 'discard', u: c.u, played: true }); }
    C.turnCards++;
    if (d.t === 'atk') C.turnAtk++;
    if (d.t === 'skl') { C.turnSkl++; for (const e of G.enemies()) if (e.st.enrage) G.apply(e, 'str', e.st.enrage, { src: 'e' }); }
    if (!C.over) {
      const p = C.p;
      if (p.st.afterImage) G.rawBlock(p.st.afterImage, p);
      if (p.st.thousandCuts) G.damageAll(p.st.thousandCuts);
      if (p.st.infernoForm) G.applyAll('burn', p.st.infernoForm);
      for (const R of run.relics) { const rd = ED.RELICS[R.k]; if (rd && rd.onPlay) rd.onPlay(G, R, c, d); }
    }
    // a choice the card asked for
    nextPending(run, G);
    checkEmptyHand(run, G);
    return true;
  };
  function checkEmptyHand(run, G) {
    const C = run.combat;
    if (!C.over && !C.pending && C.phase === 'player' && !C.hand.length && G.has('spinningtop')) { G.flash('spinningtop'); G.draw(1); }
  }
  function runAfter(run, G, o, cards) {
    const d = o.src && CARDS[o.src];
    if (d && d.after) d.after(G, { up: o.up, v: E.vals({ k: o.src, up: o.up }), cards });
  }
  function nextPending(run, G) {
    const C = run.combat;
    while (!C.over && !C.pending && C.pendingQueue.length) {
      const o = C.pendingQueue.shift();
      const pool = C.hand.slice();
      const n = Math.min(o.n, pool.length);
      if (n <= 0) { runAfter(run, G, o, []); continue; }
      if (pool.length <= n) { resolveWith(G, o, pool); runAfter(run, G, o, pool); continue; }
      C.pending = { act: o.act, n, prompt: o.prompt, src: o.src, up: o.up };
      return;
    }
  }
  function resolveWith(G, o, cards) {
    for (const c of cards) {
      if (o.act === 'exhaust') G.exhaust(c);
      else if (o.act === 'discard') G.discard(c, true);
    }
  }
  E.resolve = function (run, sel) {
    const C = run.combat;
    const P = C && C.pending;
    if (!P) return false;
    const G = makeG(run);
    if (P.act === 'discover') {
      const k = P.opts[sel];
      if (!k) return false;
      C.pending = null;
      const c = G.makeCard(k, 0); c.tc = 0;
      if (C.hand.length < HAND_MAX) { C.hand.push(c); G.ev({ t: 'add', u: c.u, to: 'hand' }); } else C.disc.push(c);
      return true;
    }
    const cards = (sel || []).map((u) => C.hand.find((c) => c.u === u)).filter(Boolean);
    if (cards.length !== P.n) return false;
    C.pending = null;
    resolveWith(G, P, cards);
    runAfter(run, G, P, cards);
    nextPending(run, G);
    checkEmptyHand(run, G);
    return true;
  };

  // ---------------- potions ----------------
  E.potionNeedsTarget = (k) => ED.POTIONS[k].tg === 'enemy';
  E.usePotion = function (run, slot, tid) {
    const k = run.potions[slot];
    if (!k) return false;
    const P = ED.POTIONS[k];
    const C = run.combat;
    if (!C || C.over || C.pending || C.phase !== 'player') {
      if (P.out && P.useOut && !C) { P.useOut(run); run.potions[slot] = null; return true; }
      return false;
    }
    const G = makeG(run);
    let t = null;
    if (P.tg === 'enemy') {
      t = tid ? G.byId(tid) : null;
      if (!t || t === C.p || t.hp <= 0) { const al = G.enemies(); if (al.length === 1) t = al[0]; else return false; }
    }
    run.potions[slot] = null;
    G.ev({ t: 'potion', k, tgt: t ? t.id : null });
    P.use(G, t);
    run.stats.potions = (run.stats.potions || 0) + 1;
    return true;
  };

  // ---------------- end of combat ----------------
  E.finish = function (run) {
    const C = run.combat;
    const out = { heal: 0 };
    run.hp = Math.max(0, C.p.hp); run.maxHp = C.p.maxHp;
    if (C.over === 'win') {
      for (const R of run.relics) {
        const d = ED.RELICS[R.k];
        if (d && d.combatEnd) { const r = d.combatEnd(run, R, C); if (r && r.heal) { const h = Math.min(r.heal, run.maxHp - run.hp); run.hp += h; out.heal += h; out.relic = R.k; } }
      }
    }
    return out;
  };

  // ---------------- card text ----------------
  // Returns {text, parts} where numbers are adjusted to the current combat (red/green like the classic).
  E.cardText = function (run, c, tgt) {
    const d = CARDS[c.k];
    const up = c.up ? 1 : 0;
    let s = d.d[up];
    const v = E.vals(c);
    const C = run && run.combat;
    const G = C ? makeG(run) : null;
    const x = { card: c, up, v, t: tgt || null };
    const mark = (val, base) => (G ? (val > base ? '⟪+' + val + '⟫' : val < base ? '⟪-' + val + '⟫' : '⟪' + val + '⟫') : '⟪' + val + '⟫');
    s = s.replace(/\{(\w+)\}/g, (m, k) => {
      if (k === 'dd' || k === 'hh') return '';
      if (k === 'd') {
        const base = d.dmgBase ? (G ? d.dmgBase(G, x, tgt) : v.d || 0) : v.d;
        if (!G) return mark(base, base);
        const sm = d.strMult ? d.strMult(up) : 1;
        return mark(G.calcAttack(C.p, tgt || null, base, sm), base);
      }
      if (k === 'b') {
        const base = d.blockBase && G ? d.blockBase(G, x) : v.b;
        if (!G) return mark(base, base);
        return mark(G.calcBlock(base), base);
      }
      return '⟪' + (v[k] !== undefined ? v[k] : '?') + '⟫';
    });
    if (d.d[up].includes('{dd}') && G) {
      const base = d.dmgBase(G, x, tgt);
      s += ' (' + mark(G.calcAttack(C.p, tgt || null, base), base) + ')';
    }
    if (d.d[up].includes('{hh}') && G) s += ' (' + d.hitsFn(G) + ' hits)';
    const pre = [];
    if (d.unp) pre.push('Unplayable.');
    if (d.inn && d.inn[up]) pre.push('Innate.');
    if (d.eth) pre.push('Ethereal.');
    if (d.ret) pre.push('Retain.');
    let out = (pre.length ? pre.join(' ') + ' ' : '') + s;
    if (d.ex[up]) out += ' Exhaust.';
    return out;
  };
  E.keywordsOf = function (c) {
    const txt = E.cardText(null, c);
    return Object.keys(ED.KEYWORDS).filter((k) => new RegExp('\\b' + k + 's?\\b').test(txt));
  };
})(typeof window !== 'undefined' ? window : globalThis);
