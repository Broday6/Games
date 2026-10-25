'use strict';
// EMBER DECK — run structure: characters, map generation, rewards, shops, campfires, treasure, acts.
(function (root) {
  const ED = root.ED;
  const E = ED.Engine;
  const R = ED.Run = {};
  const rand = ED.rand, rint = ED.rint;

  ED.CHARS = {
    cast: { k: 'cast', n: 'The Castaway', short: 'Castaway', hp: 80, relic: 'driftcharm', col: '#4fb3d9', col2: '#1f4f6e',
      deck: ['strike_c', 'strike_c', 'strike_c', 'strike_c', 'strike_c', 'defend_c', 'defend_c', 'defend_c', 'defend_c', 'oarsmash'],
      blurb: 'A shipwreck survivor with a stubborn streak. Balanced: Strength, sturdy Block and Vulnerable.' },
    witch: { k: 'witch', n: 'The Ember Witch', short: 'Ember Witch', hp: 80, relic: 'emberlocket', col: '#ff7a3d', col2: '#6e231c',
      deck: ['strike_w', 'strike_w', 'strike_w', 'strike_w', 'defend_w', 'defend_w', 'defend_w', 'defend_w', 'kindle', 'ashrite'],
      blurb: 'Feeds the flame with her own cards. Stacks Burn, then turns Exhaust into fuel.' },
    rogue: { k: 'rogue', n: 'The Tide Rogue', short: 'Tide Rogue', hp: 70, relic: 'fishhook', col: '#4fe0a8', col2: '#17543f',
      deck: ['strike_r', 'strike_r', 'strike_r', 'strike_r', 'strike_r', 'defend_r', 'defend_r', 'defend_r', 'defend_r', 'defend_r', 'brinedart', 'undertow'],
      blurb: 'Slippery and quick. Poison that builds, piles of cards and fistfuls of 0-cost Shivs.' },
  };
  ED.CHAR_ORDER = ['cast', 'witch', 'rogue'];

  ED.ASCENSION = [
    'No modifiers.',
    'Elites appear more often.',
    'Normal enemies have 10% more HP.',
    'Normal enemies deal 10% more damage.',
    'Elites have 15% more HP and deal 10% more damage.',
    'Bosses have 10% more HP and deal 10% more damage.',
    'Campfires heal 25% instead of 30%; you heal 75% between acts.',
    'Start each run with 10% less HP.',
    'Start each run with the Doubt curse.',
    'Shops cost 10% more and potions drop less often.',
    'All enemies start combat with 1 Strength.',
  ];
  ED.MAX_ASC = 10;
  R.ROWS = 12; R.COLS = 7;

  // ---------------- run creation ----------------
  R.newRun = function (ch, asc, seed) {
    const C = ED.CHARS[ch];
    seed = ED.cleanSeed(seed) || ED.randomSeed();
    const run = {
      v: 1, seed, char: ch, asc: asc || 0, act: 1, floor: 0,
      hp: C.hp, maxHp: C.hp, gold: 99, deck: [], relics: [], potions: [null, null, null],
      nextUid: 0, rng: ED.makeRng(seed), map: null, pos: null, phase: 'neow',
      combat: null, reward: null, shop: null, event: null, rest: null, treasure: null, select: null, bossRelics: null,
      stats: { kills: 0, dmg: 0, cards: 0, elites: 0, bosses: 0, gold: 0, potions: 0, exhausted: 0, fights: 0 },
      rareBonus: -5, potionChance: 40, actFights: 0, encLast: [], eliteLast: null, eventsSeen: [], removals: 0,
      seenCards: [], seenRelics: [], seenPotions: [], seenEnemies: [], startedAt: Date.now(), path: [],
    };
    for (const k of C.deck) R.addCard(run, k, 0, true);
    if (run.asc >= 7) run.hp = Math.floor(run.maxHp * 0.9);
    if (run.asc >= 8) R.addCard(run, 'doubt', 0, true);
    R.gainRelic(run, C.relic);
    // relic pools, shuffled once per run
    run.relicPool = {};
    for (const r of ['common', 'uncommon', 'rare', 'boss', 'shop']) run.relicPool[r] = ED.shuffle(run.rng, 'relic', ED.relicList(r, ch).map((x) => x.k));
    R.newAct(run, 1);
    run.phase = 'event';
    run.event = ED.Events.begin(run, 'neow');
    return run;
  };

  R.newAct = function (run, act) {
    run.act = act;
    run.map = R.genMap(run);
    run.pos = null;
    run.actFights = 0; run.encLast = []; run.eliteLast = null;
    run.boss = ED.pick(run.rng, 'enc', ED.ENCOUNTERS[act].boss);
  };

  // ---------------- deck & items ----------------
  R.addCard = function (run, k, up, silent) {
    const c = { u: ++run.nextUid, k, up: up ? 1 : 0 };
    run.deck.push(c);
    R.see(run, 'seenCards', k);
    return c;
  };
  R.removeCard = function (run, u) { const i = run.deck.findIndex((c) => c.u === u); if (i >= 0) return run.deck.splice(i, 1)[0]; return null; };
  R.upgradeCard = function (run, u) { const c = run.deck.find((x) => x.u === u); if (c && ED.upgradable(c)) { c.up = 1; return true; } return false; };
  R.see = function (run, list, k) { if (!run[list].includes(k)) run[list].push(k); };
  R.has = (run, k) => E.hasRelic(run, k);
  R.gainRelic = function (run, k) {
    if (!k || R.has(run, k)) return false;
    for (const r in run.relicPool || {}) { const i = run.relicPool[r].indexOf(k); if (i >= 0) run.relicPool[r].splice(i, 1); }
    const inst = { k };
    run.relics.push(inst);
    R.see(run, 'seenRelics', k);
    const d = ED.RELICS[k];
    if (d.pickup) d.pickup(run, inst);
    return true;
  };
  R.gainPotion = function (run, k) {
    if (R.has(run, 'crackedflask')) return false;
    const i = run.potions.indexOf(null);
    if (i < 0) return false;
    run.potions[i] = k;
    R.see(run, 'seenPotions', k);
    return true;
  };
  R.gainGold = function (run, n) { if (R.has(run, 'ghostcoin') && n > 0) return 0; run.gold = Math.max(0, run.gold + n); if (n > 0) run.stats.gold += n; return n; };
  R.heal = function (run, n) { const h = Math.max(0, Math.min(n, run.maxHp - run.hp)); run.hp += h; return h; };
  R.hurt = function (run, n) { run.hp = Math.max(1, run.hp - n); };
  R.addMaxHp = function (run, n) { run.maxHp = Math.max(1, run.maxHp + n); if (n > 0) run.hp += n; run.hp = Math.min(run.hp, run.maxHp); };

  R.rollRarity = function (run, kind) {
    const rare = (kind === 'elite' ? 10 : kind === 'shop' ? 9 : 3) + (kind === 'shop' ? 0 : run.rareBonus);
    const unc = kind === 'elite' ? 40 : 37;
    const r = rand(run.rng, 'card') * 100;
    if (r < rare) return 'rare';
    if (r < rare + unc) return 'uncommon';
    return 'common';
  };
  R.rollCards = function (run, n, kind) {
    const out = [];
    const ch = run.char;
    for (let i = 0; i < n; i++) {
      let rar = kind === 'boss' ? 'rare' : R.rollRarity(run, kind);
      if (kind !== 'boss' && kind !== 'shop') { if (rar === 'rare') run.rareBonus = -5; else if (rar === 'common') run.rareBonus = Math.min(40, run.rareBonus + 1); }
      let pool = ED.pool(ch, rar).filter((d) => !out.some((o) => o.k === d.k));
      if (!pool.length) pool = ED.pool(ch).filter((d) => !out.some((o) => o.k === d.k));
      const d = ED.pick(run.rng, 'card', pool);
      const upChance = run.act === 2 ? 0.12 : run.act === 3 ? 0.25 : 0;
      out.push({ k: d.k, up: rand(run.rng, 'card') < upChance ? 1 : 0 });
    }
    for (const c of out) R.see(run, 'seenCards', c.k);
    return out;
  };
  R.rollPotion = function (run) {
    const r = rand(run.rng, 'pot');
    const rar = r < 0.65 ? 'common' : r < 0.9 ? 'uncommon' : 'rare';
    return ED.pick(run.rng, 'pot', ED.potionList(rar)).k;
  };
  R.rollRelic = function (run, rar) {
    if (!rar) { const r = rand(run.rng, 'relic'); rar = r < 0.5 ? 'common' : r < 0.83 ? 'uncommon' : 'rare'; }
    const order = rar === 'rare' ? ['rare', 'uncommon', 'common'] : rar === 'uncommon' ? ['uncommon', 'common', 'rare'] : ['common', 'uncommon', 'rare'];
    for (const t of order) { const pool = run.relicPool[t]; if (pool && pool.length) return pool.shift(); }
    return null;
  };

  // ---------------- map ----------------
  R.genMap = function (run) {
    const rows = R.ROWS, cols = R.COLS, rng = run.rng;
    const grid = [];
    for (let r = 0; r < rows; r++) { grid.push([]); for (let c = 0; c < cols; c++) grid[r].push(null); }
    const node = (r, c) => grid[r][c] || (grid[r][c] = { r, c, t: null, n: [], x: (rand(rng, 'map') - 0.5) * 0.5, y: (rand(rng, 'map') - 0.5) * 0.35 });
    let first = -1;
    for (let p = 0; p < 6; p++) {
      let c = rint(rng, 'map', 0, cols - 1);
      if (p === 1) while (c === first) c = rint(rng, 'map', 0, cols - 1);
      if (p === 0) first = c;
      for (let r = 0; r < rows - 1; r++) {
        const a = node(r, c);
        let nc = ED.clamp(c + rint(rng, 'map', -1, 1), 0, cols - 1);
        // no crossing edges
        if (nc === c + 1 && grid[r][c + 1] && grid[r][c + 1].n.includes(c)) nc = c;
        if (nc === c - 1 && grid[r][c - 1] && grid[r][c - 1].n.includes(c)) nc = c;
        node(r + 1, nc);
        if (!a.n.includes(nc)) a.n.push(nc);
        c = nc;
      }
    }
    const parents = (n) => (n.r === 0 ? [] : grid[n.r - 1].filter((p) => p && p.n.includes(n.c)));
    const elW = run.asc >= 1 ? 16 : 11;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const n = grid[r][c];
        if (!n) continue;
        if (r === 0) { n.t = 'fight'; continue; }
        if (r === 5) { n.t = 'treasure'; continue; }
        if (r === rows - 1) { n.t = 'rest'; continue; }
        const par = parents(n).map((p) => p.t);
        const sib = parents(n).flatMap((p) => p.n.filter((x) => x !== c).map((x) => grid[r][x] && grid[r][x].t)).filter(Boolean);
        let opts = [['fight', 42], ['event', 22], ['elite', r >= 4 ? elW : 0], ['rest', r >= 4 && r !== rows - 2 ? 12 : 0], ['shop', r >= 2 ? 8 : 0]];
        opts = opts.filter((o) => o[1] > 0 && !(o[0] !== 'fight' && o[0] !== 'event' && par.includes(o[0])));
        const nonSib = opts.filter((o) => !sib.includes(o[0]) || o[0] === 'fight');
        n.t = ED.weighted(rng, 'map', nonSib.length ? nonSib : opts);
      }
    }
    const nodes = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c]) nodes.push(grid[r][c]);
    return { rows, cols, nodes, visited: [] };
  };
  R.nodeAt = (run, r, c) => run.map.nodes.find((n) => n.r === r && n.c === c);
  R.available = function (run) {
    if (run.phase !== 'map') return [];
    if (!run.pos) return run.map.nodes.filter((n) => n.r === 0);
    if (run.pos.r === R.ROWS - 1) return [{ r: R.ROWS, c: 3, t: 'boss', n: [] }];
    if (run.pos.r >= R.ROWS) return [];
    const cur = R.nodeAt(run, run.pos.r, run.pos.c);
    return cur.n.map((c) => R.nodeAt(run, run.pos.r + 1, c));
  };

  R.choose = function (run, r, c) {
    const av = R.available(run);
    const n = av.find((x) => x.r === r && x.c === c);
    if (!n) return false;
    run.pos = { r, c };
    run.floor++;
    run.map.visited.push(r + ':' + c);
    run.path.push(n.t);
    R.enter(run, n.t);
    return true;
  };
  R.enter = function (run, t) {
    if (t === 'fight' || t === 'elite' || t === 'boss') return R.startFight(run, t);
    if (t === 'rest') { run.phase = 'rest'; run.rest = { done: false }; return; }
    if (t === 'shop') return R.openShop(run);
    if (t === 'treasure') { run.phase = 'treasure'; run.treasure = { relic: R.rollRelic(run), gold: rint(run.rng, 'gold', 20, 40), opened: false }; return; }
    if (t === 'event') {
      const r = rand(run.rng, 'ev');
      if (r < 0.12 && run.floor > 2) return R.startFight(run, 'fight');
      if (r < 0.16) return R.openShop(run);
      if (r < 0.2) return R.enter(run, 'treasure');
      run.phase = 'event';
      run.event = ED.Events.begin(run, null);
    }
  };

  R.pickEncounter = function (run, type) {
    const T = ED.ENCOUNTERS[run.act];
    if (type === 'boss') return [run.boss];
    if (type === 'elite') {
      let opts = T.elite.map((e, i) => i).filter((i) => i !== run.eliteLast);
      const i = ED.pick(run.rng, 'enc', opts);
      run.eliteLast = i;
      return T.elite[i].slice();
    }
    const pool = run.actFights < 3 ? T.weak : T.strong;
    const idx = pool.map((e, i) => i).filter((i) => !run.encLast.includes((run.actFights < 3 ? 'w' : 's') + i));
    const i = ED.pick(run.rng, 'enc', idx.length ? idx : pool.map((e, j) => j));
    run.encLast.push((run.actFights < 3 ? 'w' : 's') + i);
    if (run.encLast.length > 2) run.encLast.shift();
    return pool[i].slice();
  };
  R.startFight = function (run, type, enemies, from) {
    const list = enemies || R.pickEncounter(run, type);
    if (type === 'fight') run.actFights++;
    run.phase = 'combat';
    run.fightFrom = from || null;
    E.startCombat(run, { type, enemies: list });
    for (const e of run.combat.en) R.see(run, 'seenEnemies', e.k);
    return run.combat;
  };

  // ---------------- after combat ----------------
  R.winCombat = function (run) {
    const C = run.combat;
    const res = E.finish(run);
    run.stats.fights++;
    if (C.type === 'elite') run.stats.elites++;
    if (C.type === 'boss') run.stats.bosses++;
    const items = [];
    let gold = C.type === 'boss' ? rint(run.rng, 'gold', 95, 105) : C.type === 'elite' ? rint(run.rng, 'gold', 25, 35) : rint(run.rng, 'gold', 10, 20);
    if (R.has(run, 'goldenidol')) gold = Math.round(gold * 1.25);
    if (!R.has(run, 'ghostcoin')) items.push({ t: 'gold', n: gold });
    if (C.goldGain) {/* already gained in combat */}
    let pc = run.potionChance - (run.asc >= 9 ? 10 : 0);
    if (C.type === 'elite') pc += 10;
    if (!R.has(run, 'crackedflask') && C.type !== 'boss') {
      if (rand(run.rng, 'pot') * 100 < pc) { items.push({ t: 'potion', k: R.rollPotion(run) }); run.potionChance = Math.max(0, run.potionChance - 10); }
      else run.potionChance = Math.min(100, run.potionChance + 10);
    }
    if (C.type === 'elite') {
      items.push({ t: 'relic', k: R.rollRelic(run) });
      if (R.has(run, 'blackpearl')) items.push({ t: 'relic', k: R.rollRelic(run) });
    }
    const n = Math.max(1, 3 - (R.has(run, 'brokencrown') ? 2 : 0));
    items.push({ t: 'cards', opts: R.rollCards(run, n, C.type) });
    for (const it of items) if (it.t === 'relic' && !it.k) it.t = 'none';
    run.reward = { items: items.filter((i) => i.t !== 'none'), boss: C.type === 'boss', heal: res.heal, healRelic: res.relic };
    run.combat = null;
    run.phase = 'reward';
  };
  R.loseCombat = function (run) {
    const C = run.combat;
    E.finish(run);
    run.killedBy = C.en.filter((e) => !e.st.minion).map((e) => ED.ENEMIES[e.k].n)[0] || 'the tide';
    run.combat = null;
    run.phase = 'dead';
    run.hp = 0;
  };
  R.takeReward = function (run, i, sub) {
    const it = run.reward && run.reward.items[i];
    if (!it || it.done) return false;
    if (it.t === 'gold') { R.gainGold(run, it.n); it.done = true; }
    else if (it.t === 'potion') { if (!R.gainPotion(run, it.k)) return false; it.done = true; }
    else if (it.t === 'relic') { R.gainRelic(run, it.k); it.done = true; }
    else if (it.t === 'cards') {
      if (sub === 'skip') { it.done = true; it.skipped = true; return true; }
      const c = it.opts[sub];
      if (!c) return false;
      R.addCard(run, c.k, c.up);
      it.done = true; it.took = c;
    }
    return true;
  };
  R.leaveReward = function (run) {
    const boss = run.reward && run.reward.boss;
    run.reward = null;
    if (boss) {
      if (run.act >= 3) { run.phase = 'victory'; run.won = true; return; }
      const opts = [];
      for (let i = 0; i < 3; i++) { const k = run.relicPool.boss.shift(); if (k) opts.push(k); }
      if (opts.length) { run.phase = 'bossRelic'; run.bossRelics = opts; return; }
      return R.nextAct(run);
    }
    if (run.fightFrom === 'event' && run.event && run.event.after) { run.phase = 'event'; run.event.s = run.event.after; run.event.after = null; return; }
    R.toMap(run);
  };
  R.pickBossRelic = function (run, i) {
    if (run.phase !== 'bossRelic') return false;
    if (i >= 0 && run.bossRelics[i]) R.gainRelic(run, run.bossRelics[i]);
    run.bossRelics = null;
    R.nextAct(run);
    return true;
  };
  R.nextAct = function (run) {
    R.newAct(run, run.act + 1);
    const heal = run.asc >= 6 ? Math.floor((run.maxHp - run.hp) * 0.75) : run.maxHp - run.hp;
    run.hp += heal;
    run.actHeal = heal;
    run.phase = 'map';
  };
  R.toMap = function (run) {
    run.phase = 'map';
    run.event = null; run.shop = null; run.rest = null; run.treasure = null; run.select = null; run.fightFrom = null;
  };

  // ---------------- treasure ----------------
  R.openTreasure = function (run) {
    const T = run.treasure;
    if (!T || T.opened) return false;
    T.opened = true;
    if (T.relic) R.gainRelic(run, T.relic);
    R.gainGold(run, T.gold);
    return true;
  };

  // ---------------- campfire ----------------
  R.restHeal = (run) => Math.floor(run.maxHp * (run.asc >= 6 ? 0.25 : 0.3)) + (R.has(run, 'pillow') ? 15 : 0);
  R.rest = function (run) {
    if (!run.rest || run.rest.done || R.has(run, 'sleeplamp')) return false;
    run.rest.healed = R.heal(run, R.restHeal(run));
    run.rest.done = 'rest';
    return true;
  };
  R.smith = function (run, u) {
    if (!run.rest || run.rest.done) return false;
    if (!R.upgradeCard(run, u)) return false;
    run.rest.done = 'smith';
    run.rest.card = u;
    return true;
  };

  // ---------------- shop ----------------
  function price(run, base) {
    let p = Math.round(base * (0.9 + rand(run.rng, 'shop') * 0.2));
    if (run.asc >= 9) p = Math.round(p * 1.1);
    return p;
  }
  R.priceOf = function (run, p) { return R.has(run, 'merchantseal') ? Math.round(p * 0.7) : p; };
  R.openShop = function (run) {
    const S = { cards: [], relics: [], potions: [], removed: false };
    const ch = run.char;
    const want = ['atk', 'atk', 'skl', 'skl', 'pow'];
    const seen = [];
    for (const t of want) {
      let rar = R.rollRarity(run, 'shop');
      let pool = ED.pool(ch, rar).filter((d) => d.t === t && !seen.includes(d.k));
      if (!pool.length) pool = ED.pool(ch).filter((d) => d.t === t && !seen.includes(d.k));
      if (!pool.length) pool = ED.pool(ch).filter((d) => !seen.includes(d.k));
      const d = ED.pick(run.rng, 'shop', pool);
      rar = d.r;
      seen.push(d.k);
      S.cards.push({ k: d.k, up: 0, p: price(run, rar === 'rare' ? 150 : rar === 'uncommon' ? 75 : 50) });
    }
    const sale = rint(run.rng, 'shop', 0, 4);
    S.cards[sale].p = Math.round(S.cards[sale].p / 2); S.cards[sale].sale = true;
    const neu = ED.pool('neutral');
    const n1 = ED.pick(run.rng, 'shop', neu.filter((d) => d.r === 'uncommon'));
    const n2 = ED.pick(run.rng, 'shop', neu.filter((d) => d.r === 'rare'));
    S.cards.push({ k: n1.k, up: 0, p: price(run, 90) }, { k: n2.k, up: 0, p: price(run, 180) });
    for (const c of S.cards) R.see(run, 'seenCards', c.k);
    for (let i = 0; i < 2; i++) { const k = R.rollRelic(run); if (k) S.relics.push({ k, p: price(run, { common: 150, uncommon: 240, rare: 300 }[ED.RELICS[k].r] || 200) }); }
    const sk = run.relicPool.shop.shift() || R.rollRelic(run);
    if (sk) S.relics.push({ k: sk, p: price(run, 180) });
    for (let i = 0; i < 3; i++) { const k = R.rollPotion(run); S.potions.push({ k, p: price(run, { common: 50, uncommon: 75, rare: 100 }[ED.POTIONS[k].r]) }); }
    S.removeCost = R.has(run, 'smilemask') ? 50 : 75 + 25 * run.removals;
    run.shop = S;
    run.phase = 'shop';
  };
  R.buy = function (run, kind, i) {
    const S = run.shop;
    if (!S) return 'No shop';
    const list = S[kind];
    const it = list && list[i];
    if (!it || it.sold) return 'Sold out';
    const cost = R.priceOf(run, it.p);
    if (run.gold < cost) return 'Not enough Gold';
    if (kind === 'potions') { if (R.has(run, 'crackedflask')) return 'You cannot hold potions'; if (!run.potions.includes(null)) return 'Potion slots are full'; }
    run.gold -= cost;
    it.sold = true;
    if (kind === 'cards') R.addCard(run, it.k, it.up);
    if (kind === 'relics') R.gainRelic(run, it.k);
    if (kind === 'potions') R.gainPotion(run, it.k);
    return null;
  };
  R.shopRemove = function (run, u) {
    const S = run.shop;
    if (!S || S.removed) return 'Already used';
    const cost = R.priceOf(run, S.removeCost);
    if (run.gold < cost) return 'Not enough Gold';
    if (!R.removeCard(run, u)) return 'No card';
    run.gold -= cost; S.removed = true; run.removals++;
    return null;
  };

  // ---------------- deck selection (upgrade/remove/transform/duplicate) ----------------
  R.selectable = function (run, purpose) {
    return run.deck.filter((c) => {
      if (purpose === 'upgrade') return ED.upgradable(c);
      if (purpose === 'transform' || purpose === 'remove') return true;
      if (purpose === 'duplicate') return ED.CARDS[c.k].t !== 'curse';
      return true;
    });
  };
  R.transform = function (run, u) {
    const old = R.removeCard(run, u);
    if (!old) return null;
    const d = ED.CARDS[old.k];
    const ch = ['cast', 'witch', 'rogue'].includes(d.c) ? d.c : run.char;
    const pool = ED.pool(ch).filter((x) => x.k !== old.k);
    const nd = ED.pick(run.rng, 'misc', pool);
    return R.addCard(run, nd.k, 0);
  };

  // ---------------- end of run ----------------
  R.score = function (run) {
    let s = run.floor * 5 + run.stats.elites * 25 + run.stats.bosses * 100;
    if (run.won) s += 250 + (run.asc || 0) * 50;
    return s;
  };
  R.abandon = function (run) { run.phase = 'dead'; run.killedBy = 'abandoned'; run.abandoned = true; };
})(typeof window !== 'undefined' ? window : globalThis);
(function (root) {
  const ED = root.ED, R = ED.Run;
  // Deck selection is its own phase so it survives a reload.
  R.beginSelect = function (run, purpose, from, o) {
    o = o || {};
    run.select = { purpose, from, n: o.n || 1, title: o.title || '', back: run.phase, after: o.after || null, hurt: o.hurt || 0, cancel: o.cancel !== false };
    run.phase = 'select';
  };
  R.cancelSelect = function (run) {
    const S = run.select;
    if (!S || !S.cancel) return false;
    run.phase = S.back; run.select = null;
    return true;
  };
  R.confirmSelect = function (run, uids) {
    const S = run.select;
    if (!S) return false;
    const ok = R.selectable(run, S.purpose).map((c) => c.u);
    const list = (uids || []).filter((u) => ok.includes(u));
    if (list.length !== Math.min(S.n, ok.length)) return false;
    const results = [];
    for (const u of list) {
      if (S.purpose === 'upgrade') R.upgradeCard(run, u);
      else if (S.purpose === 'remove') { if (S.from === 'shop') { const e = R.shopRemove(run, u); if (e) return false; } else R.removeCard(run, u); }
      else if (S.purpose === 'transform') results.push(R.transform(run, u));
      else if (S.purpose === 'duplicate') { const c = run.deck.find((x) => x.u === u); R.addCard(run, c.k, c.up); }
    }
    if (S.hurt) R.hurt(run, S.hurt);
    run.select = null;
    if (S.from === 'rest') { run.phase = 'rest'; run.rest.done = 'smith'; run.rest.card = list[0]; return true; }
    if (S.from === 'shop') { run.phase = 'shop'; return true; }
    if (S.from === 'event' || S.from === 'neow') {
      run.phase = 'event';
      const names = results.filter(Boolean).map((c) => ED.CARDS[c.k].n);
      run.event.d.msg = S.purpose === 'transform' && names.length ? 'It became ' + names.join(', ') + '.' : (run.event.d.msg || 'Done.');
      run.event.s = S.after || 'done';
      return true;
    }
    R.toMap(run);
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
