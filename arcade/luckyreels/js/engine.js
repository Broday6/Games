'use strict';
// LUCKY REELS — pure, deterministic run engine. No DOM. All randomness flows through run.rng (mulberry32),
// so a run (and its save) replays exactly. Produces an ordered event log the renderer animates.
(function (LR) {
  const SY = LR.SYMBOLS, IT = LR.ITEMS;
  const COLS = LR.COLS, ROWS = LR.ROWS, N = LR.CELLS;
  const ADJ = [];
  for (let i = 0; i < N; i++) {
    const r = (i / COLS) | 0, c = i % COLS, a = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) a.push(rr * COLS + cc);
    }
    ADJ.push(a);
  }
  const CORNERS = [0, COLS - 1, N - COLS, N - 1];
  const CENTRE = [6, 7, 8, 11, 12, 13];
  const GEMS = [['sapphire', 50], ['ruby', 18], ['emerald', 18], ['amethyst', 10], ['diamond', 4]];
  const FLOWERS = [['flower', 6], ['rose', 3], ['sunflower', 1]];

  // ---------- rng ----------
  function rnd(run) {
    let t = (run.rng = (run.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ri = (run, n) => Math.floor(rnd(run) * n);
  const chance = (run, p) => rnd(run) < p;
  function shuffle(run, a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(run, i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function weighted(run, list) {
    let tot = 0; for (const e of list) tot += e[1];
    let x = rnd(run) * tot;
    for (const e of list) { x -= e[1]; if (x < 0) return e[0]; }
    return list[list.length - 1][0];
  }

  const hasTag = (id, t) => SY[id].tags.indexOf(t) >= 0;
  function itemSet(run) { const h = {}; for (const it of run.items) h[it.id] = true; return h; }
  function landlord(run) { return LR.LANDLORDS.find((l) => l.id === run.landlord) || LR.LANDLORDS[0]; }

  // ---------- rent ----------
  function rentFor(run, f) {
    if (f === undefined) f = run.floor;
    const R = LR.RENTS;
    let base = f < R.length ? R[f] : 1000 * Math.pow(1.35, f - R.length + 1);
    const st = run.stake || 0;
    const extra = (st >= 4 ? 0.25 : st >= 1 ? 0.1 : 0) + (landlord(run).rent - 1);
    let m = 1 + extra * Math.min(1, f / 3); // landlord + stake surcharges ramp in over the first floors
    if (run.items.some((x) => x.id === 'rentcontrol')) m *= 0.85;
    const v = base * m;
    return m === 1 && f < R.length ? base : Math.round(v / 5) * 5;
  }
  function spinsFor(run, f) {
    const S = LR.SPINS;
    let s = f < S.length ? S[f] : 12;
    if (run.items.some((x) => x.id === 'hourglass')) s += 1;
    if ((run.stake || 0) >= 5 && f >= 4) s -= 1;
    return Math.max(3, s);
  }

  // ---------- offers ----------
  function luck(run) {
    let L = 0;
    for (const s of run.inv) if (s.id === 'clover') L++;
    L = Math.min(L, 4);
    if (run.items.some((x) => x.id === 'rabbitfoot')) L += 3;
    L += landlord(run).luck || 0;
    if ((run.stake || 0) >= 3) L -= 1.5;
    return L;
  }
  function rarityOdds(run) {
    const f = run.floor;
    let u = 0.12 + 0.035 * f, r = f >= 1 ? 0.012 + 0.017 * f : 0.004, v = f >= 3 ? 0.004 + 0.005 * (f - 3) : 0;
    const k = Math.max(0.35, 1 + 0.16 * luck(run));
    u = Math.min(0.5, u * k); r = Math.min(0.3, r * k); v = Math.min(0.12, v * k);
    return { c: Math.max(0.15, 1 - u - r - v), u, r, v };
  }
  function rollRarity(run, odds) {
    return weighted(run, [['c', odds.c], ['u', odds.u], ['r', odds.r], ['v', odds.v]]);
  }
  function offer(run, n) {
    const odds = rarityOdds(run), bias = landlord(run).bias || null, out = [];
    for (let k = 0; k < n; k++) {
      const rar = rollRarity(run, odds);
      const list = [];
      for (const id of LR.SYM_ORDER) {
        const d = SY[id];
        if (!d.pool || d.rar !== rar || out.indexOf(id) >= 0) continue;
        let w = 1;
        if (bias) for (const t of d.tags) if (bias[t]) w = Math.max(w, bias[t]);
        list.push([id, w]);
      }
      if (list.length) out.push(weighted(run, list));
    }
    return out;
  }
  function offerItems(run, n) {
    const f = run.floor, out = [];
    const odds = { c: Math.max(0.2, 0.6 - 0.04 * f), u: 0.3, r: 0.08 + 0.025 * f, v: 0.02 + 0.012 * f };
    for (let k = 0; k < n; k++) {
      const owned = (id) => run.items.some((x) => x.id === id) || out.indexOf(id) >= 0;
      let rar = rollRarity(run, odds);
      let list = LR.ITEM_ORDER.filter((id) => IT[id].rar === rar && !owned(id));
      if (!list.length) list = LR.ITEM_ORDER.filter((id) => !owned(id));
      if (!list.length) break;
      out.push(list[ri(run, list.length)]);
    }
    return out;
  }

  // ---------- run lifecycle ----------
  function newRun(o) {
    o = o || {};
    const seed = (o.seed === undefined ? (Math.random() * 4294967296) >>> 0 : o.seed >>> 0);
    const start = LR.STARTS.find((s) => s.id === o.start) || LR.STARTS[0];
    const run = {
      v: 1, seed, rng: (seed ^ 0x9E3779B9) | 0, coins: 0, floor: 0, spinsLeft: 0, spins: 0,
      inv: [], nu: 1, items: [], rem: 0, rr: 0, phase: 'spin', picks: null, itemPicks: null, itemLeft: 0,
      grid: new Array(N).fill(null), landlord: o.landlord || 'grimsby', start: start.id, stake: o.stake || 0,
      endless: false, lastTotal: 0, stats: { best: 0, earned: 0, destroyed: 0, picked: 0 },
    };
    for (const id of start.syms) addSym(run, id);
    [6, 8, 11, 13, 7].forEach((c, k) => { if (run.inv[k]) run.grid[c] = { id: run.inv[k].id, u: run.inv[k].u }; }); // a friendly first look
    run.rem = run.stake >= 2 ? 0 : 1;
    run.rr = run.stake >= 2 ? 0 : 1;
    run.spinsLeft = spinsFor(run, 0);
    return run;
  }
  function addSym(run, id) { const s = { id, u: run.nu++, n: 0, b: 0, s: 0 }; run.inv.push(s); return s; }
  function addItem(run, id) {
    if (run.items.some((x) => x.id === id)) return;
    run.items.push({ id });
    if (id === 'eraser') run.rem += 2;
    if (id === 'gloves') run.rr += 2;
  }

  function baseValue(cell) {
    const id = cell.inst.id;
    if (id === 'die' || id === 'luckydie') return cell.roll;
    return SY[id].value + cell.inst.b;
  }

  // ---------- the resolver ----------
  // Returns { drop:[{id,u}|null], events:[], pays:[], total, final:[{id,u}|null] } and mutates run.
  function resolveSpin(run, fixed) {
    const H = itemSet(run), LL = landlord(run);
    const ev = [];
    const cells = new Array(N);
    for (let i = 0; i < N; i++) cells[i] = { inst: null, add: 0, mult: 1, dead: false, gone: false, roll: 0 };
    // placement
    if (fixed) { // tests / debug: fixed layout of instance uids
      for (let j = 0; j < N; j++) if (fixed[j]) cells[j].inst = run.inv.find((s) => s.u === fixed[j]) || null;
    } else {
      const order = shuffle(run, run.inv.map((_, i) => i));
      const slots = shuffle(run, Array.from({ length: N }, (_, i) => i));
      const k = Math.min(N, run.inv.length);
      for (let j = 0; j < k; j++) cells[slots[j]].inst = run.inv[order[j]];
    }
    const drop = cells.map((c) => (c.inst ? { id: c.inst.id, u: c.inst.u } : null));
    for (const c of cells) if (c.inst) c.inst.n++;

    const alive = (j) => cells[j].inst && !cells[j].dead;
    const idAt = (j) => cells[j].inst.id;
    const adjWhere = (i, fn) => ADJ[i].filter((j) => alive(j) && fn(idAt(j)));
    const allWhere = (i, fn) => { const o = []; for (let j = 0; j < N; j++) if (j !== i && alive(j) && fn(idAt(j))) o.push(j); return o; };
    const born = []; // symbols to add after the spin: {id, s}
    let destroyed = 0;

    function xf(j, to, by) {
      const inst = cells[j].inst;
      ev.push({ k: 'xf', c: j, from: inst.id, to, by: by === undefined ? -1 : by });
      inst.id = to; inst.n = 0; inst.b = 0; inst.s = 0;
    }
    function onDeath(j) {
      const c = cells[j], id = c.inst.id;
      if (id === 'ore' && chance(run, 0.5)) born.push({ id: weighted(run, GEMS), s: j });
      else if (id === 'bigore') { born.push({ id: weighted(run, GEMS), s: j }); born.push({ id: weighted(run, GEMS), s: j }); }
      else if (id === 'chest') { c.add += 40; ev.push({ k: 'loot', c: j, v: 40 }); }
      else if ((id === 'safe' || id === 'piggy') && c.inst.s > 0) { c.add += c.inst.s; ev.push({ k: 'loot', c: j, v: c.inst.s }); }
    }
    function kill(j) { cells[j].dead = true; destroyed++; onDeath(j); }
    function eats(i, map, selfBreak) {
      const ts = []; let v = 0;
      for (const j of ADJ[i]) {
        if (!alive(j)) continue;
        const b = map[idAt(j)];
        if (b === undefined) continue;
        ts.push(j); v += b;
      }
      if (!ts.length) return ts;
      ev.push({ k: 'eat', s: i, ts, v });
      for (const j of ts) kill(j);
      cells[i].add += v;
      if (selfBreak) { ev.push({ k: 'break', c: i }); kill(i); }
      return ts;
    }

    // ---- phase 1: growth, transformation, dice, savings ----
    for (let i = 0; i < N; i++) {
      if (!alive(i)) continue;
      const c = cells[i], inst = c.inst, id = inst.id;
      switch (id) {
        case 'seed': {
          let p = H.watering ? 0.5 : 0.25;
          if (ADJ[i].some((j) => alive(j) && (idAt(j) === 'farmer' || idAt(j) === 'rain'))) p = 1;
          if (chance(run, p)) xf(i, weighted(run, FLOWERS));
          break;
        }
        case 'egg': if (chance(run, H.henhouse ? 0.2 : 0.1)) xf(i, 'chick'); break;
        case 'chick': if (chance(run, H.henhouse ? 0.2 : 0.1)) xf(i, 'chicken'); break;
        case 'pumpkin': if (inst.n >= 6) xf(i, 'lantern'); break;
        case 'caterpillar': if (inst.n >= 5) xf(i, 'butterfly'); break;
        case 'coal': if (inst.n >= 15) xf(i, 'diamond'); break;
        case 'piggy': inst.s += 2; break;
        case 'safe': inst.s += 5; ev.push({ k: 'save', c: i, v: inst.s }); break;
        case 'witch': {
          const n = H.pointyhat ? 2 : 1;
          const cand = shuffle(run, adjWhere(i, (x) => SY[x].rar === 'c'));
          const pool = LR.SYM_ORDER.filter((x) => SY[x].pool && SY[x].rar === 'u');
          for (let q = 0; q < n && q < cand.length; q++) xf(cand[q], pool[ri(run, pool.length)], i);
          break;
        }
      }
    }
    // dice roll after transforms (a Witch may have just made one)
    for (let i = 0; i < N; i++) {
      if (!alive(i)) continue;
      const id = idAt(i);
      if (id !== 'die' && id !== 'luckydie') continue;
      const sides = id === 'die' ? 3 : 6;
      let v = 1 + ri(run, sides);
      if (H.loaded) v = Math.max(v, 1 + ri(run, sides));
      let by = -1;
      const hs = ADJ[i].find((j) => alive(j) && idAt(j) === 'horseshoe');
      if (hs !== undefined) { v = sides; by = hs; }
      cells[i].roll = v;
      ev.push({ k: 'roll', c: i, v, by });
    }

    // ---- phase 2: destruction ----
    const jug = H.milkjug ? 5 : 0, pick = H.pickaxe ? 8 : 0, dyn = H.dynamite ? 4 : 0;
    for (let i = 0; i < N; i++) {
      if (!alive(i)) continue;
      const c = cells[i], id = idAt(i);
      switch (id) {
        case 'cat': eats(i, { milk: 9 + jug, fish: 7 + jug }); break;
        case 'mouse': eats(i, { cheese: 15 }); break;
        case 'miner': eats(i, { ore: 12 + pick, bigore: 18 + pick }); break;
        case 'bear': eats(i, { honey: 40 }); break;
        case 'monkey': eats(i, { banana: 8, coconut: 14 }); break;
        case 'fox': eats(i, { egg: 6, chick: 10 }); break;
        case 'cop': eats(i, { thief: 20 }); break;
        case 'pirate': eats(i, { chest: 0, pearl: 5 }); break;
        case 'key': eats(i, { chest: 0, safe: 0 }, true); break;
        case 'diver': {
          const ts = eats(i, { shell: 0 });
          if (ts.length) { c.inst.b += ts.length; ev.push({ k: 'grow', c: i, v: ts.length }); }
          break;
        }
        case 'bomb': {
          const ts = ADJ[i].filter(alive), v = ts.length * (4 + dyn);
          ev.push({ k: 'boom', s: i, ts, v });
          for (const j of ts) kill(j);
          c.add += v; kill(i);
          break;
        }
        case 'piggy':
          if (c.inst.n >= 8) { ev.push({ k: 'break', c: i }); kill(i); }
          break;
      }
    }

    // ---- phase 3: boosts ----
    const gain = (i, v, from) => { if (!v) return; cells[i].add += v; ev.push({ k: 'gain', c: i, v, from }); };
    const mult = (i, ts, m, src) => {
      if (!ts.length) return;
      for (const j of ts) cells[j].mult *= m;
      ev.push(src ? { k: 'imult', item: src, ts, m } : { k: 'mult', s: i, ts, m });
    };
    const plus = (i, ts, v, src) => {
      if (!ts.length) return;
      for (const j of ts) cells[j].add += v;
      ev.push(src ? { k: 'iplus', item: src, ts, v } : { k: 'plus', s: i, ts, v });
    };
    const is = (x) => (y) => y === x;
    const tag = (t) => (y) => hasTag(y, t);
    let coinsOwned = 0; for (const s of run.inv) if (s.id === 'coin') coinsOwned++;
    for (let i = 0; i < N; i++) {
      if (!alive(i)) continue;
      const c = cells[i], inst = c.inst, id = inst.id;
      let f;
      switch (id) {
        case 'dog': f = adjWhere(i, tag('human')); gain(i, 2 * f.length, f); break;
        case 'shell': f = adjWhere(i, tag('sea')); gain(i, f.length, f); break;
        case 'bat': f = adjWhere(i, tag('night')); gain(i, f.length, f); break;
        case 'crab': f = adjWhere(i, tag('sea')); gain(i, 3 * f.length, f); break;
        case 'wolf': f = adjWhere(i, is('wolf')); gain(i, 2 * f.length, f); break;
        case 'purse': f = adjWhere(i, is('coin')); gain(i, f.length, f); break;
        case 'sunflower': f = adjWhere(i, is('bee')); gain(i, f.length, f); break;
        case 'bell': f = adjWhere(i, is('cherry')); gain(i, f.length, f); break;
        case 'emerald': f = allWhere(i, tag('gem')); gain(i, f.length, f); break;
        case 'ruby': f = adjWhere(i, tag('gem')); gain(i, 2 * f.length, f); break;
        case 'seven': f = allWhere(i, is('seven')); gain(i, 7 * f.length, f); break;
        case 'diamond': f = allWhere(i, is('diamond')); gain(i, 2 * f.length, f); break;
        case 'banker': gain(i, coinsOwned, []); break;
        case 'magpie': if (inst.n % (H.birdfeeder ? 3 : 4) === 0) gain(i, 10, []); break;
        case 'leprechaun': if (inst.n % 7 === 0) gain(i, 77, []); break;
        case 'bee': f = adjWhere(i, tag('flower')); mult(i, f, 2); gain(i, f.length, f); break;
        case 'moon': mult(i, adjWhere(i, (y) => y === 'owl' || y === 'wolf' || y === 'bat'), H.moonstone ? 4 : 3); break;
        case 'sun': mult(i, adjWhere(i, tag('flower')), 5); break;
        case 'oyster': mult(i, adjWhere(i, is('pearl')), 3); break;
        case 'bar': mult(i, adjWhere(i, (y) => y === 'bell' || y === 'cherry'), 2); break;
        case 'farmer': mult(i, adjWhere(i, tag('fruit')), 2); break;
        case 'rain': mult(i, adjWhere(i, tag('flower')), 2); break;
        case 'witch': mult(i, adjWhere(i, is('cat')), 3); break;
        case 'beehive': mult(i, adjWhere(i, is('bee')), 3); break;
        case 'crown': mult(i, adjWhere(i, () => true), 2); break;
        case 'dragon': mult(i, adjWhere(i, (y) => y === 'coin' || hasTag(y, 'gem')), 3); break;
        case 'midas': mult(i, adjWhere(i, is('coin')), 4); break;
        case 'lantern': plus(i, adjWhere(i, tag('night')), 2); break;
        case 'star': plus(i, adjWhere(i, () => true), 1); break;
        case 'candle': plus(i, adjWhere(i, tag('night')), 1); break;
        case 'butterfly': plus(i, adjWhere(i, tag('flower')), 1); break;
        case 'thief': {
          const per = H.guild ? 2 : 1;
          const ts = ADJ[i].filter((j) => alive(j) && baseValue(cells[j]) + cells[j].add > 0);
          if (!ts.length) break;
          let got = 0;
          for (const j of ts) { const t = Math.min(per, baseValue(cells[j]) + cells[j].add); cells[j].add -= t; got += t; }
          c.add += 2 * got;
          ev.push({ k: 'steal', s: i, ts, v: 2 * got });
          break;
        }
      }
    }
    // items & landlord
    const all = (fn) => { const o = []; for (let j = 0; j < N; j++) if (alive(j) && fn(idAt(j))) o.push(j); return o; };
    if (H.coffee) plus(-1, all(is('cat')), 1, 'coffee');
    if (H.magnet) plus(-1, all(is('coin')), 1, 'magnet');
    if (H.fruitbasket) plus(-1, all(tag('fruit')), 1, 'fruitbasket');
    if (H.watering) plus(-1, all(tag('flower')), 1, 'watering');
    if (H.net) plus(-1, all(tag('sea')), 1, 'net');
    if (LL.seaBonus) plus(-1, all(tag('sea')), LL.seaBonus, 'landlord');
    if (H.nightlight) plus(-1, all(tag('night')), 1, 'nightlight');
    if (H.beehat) plus(-1, all(is('bee')), 2, 'beehat');
    if (H.birdfeeder) plus(-1, all(tag('bird')), 1, 'birdfeeder');
    if (H.jewelbox) plus(-1, all(tag('gem')), 2, 'jewelbox');
    if (H.honeypot) plus(-1, all(is('honey')), 2, 'honeypot');
    if (H.badge) plus(-1, all(tag('human')), 1, 'badge');
    if (H.spotlight) plus(-1, CENTRE.filter(alive), 1, 'spotlight');
    if (H.map) mult(-1, CORNERS.filter(alive), 2, 'map');
    if (H.cauldron) mult(-1, all((y) => y === 'ghost' || y === 'witch'), 2, 'cauldron');

    // ---- phase 4: payout ----
    const pays = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const c = cells[i];
      if (!c.inst) continue;
      if (c.dead) { pays[i] = Math.max(0, c.add); continue; }
      if (c.inst.id === 'joker') continue;
      pays[i] = Math.max(0, (baseValue(c) + c.add) * c.mult);
    }
    for (let i = 0; i < N; i++) {
      if (!alive(i) || idAt(i) !== 'joker') continue;
      let best = -1, bj = -1;
      for (const j of ADJ[i]) if (alive(j) && idAt(j) !== 'joker' && pays[j] > best) { best = pays[j]; bj = j; }
      const own = Math.max(0, cells[i].add * cells[i].mult);
      if (bj >= 0 && best > 0) ev.push({ k: 'copy', s: bj, c: i, v: best });
      pays[i] = Math.max(0, best) + own;
    }
    let total = 0;
    for (let i = 0; i < N; i++) if (pays[i] > 0) { ev.push({ k: 'pay', c: i, v: pays[i] }); total += pays[i]; }
    if (H.tipjar) {
      let e = 0; for (const c of cells) if (!c.inst) e++;
      if (e) { ev.push({ k: 'ipay', item: 'tipjar', v: e }); total += e; }
    }
    if (H.swearjar && destroyed) { ev.push({ k: 'ipay', item: 'swearjar', v: 2 * destroyed }); total += 2 * destroyed; }
    let gm = 1;
    if (H.lastcall && run.spinsLeft === 1) { gm *= 2; ev.push({ k: 'gmult', item: 'lastcall', m: 2 }); }
    if (H.jackpotbell && (run.spins + 1) % 7 === 0) { gm *= 2; ev.push({ k: 'gmult', item: 'jackpotbell', m: 2 }); }
    total *= gm;

    // ---- phase 5: aftermath ----
    for (let i = 0; i < N; i++) {
      if (!alive(i)) continue;
      const c = cells[i], inst = c.inst, id = inst.id;
      switch (id) {
        case 'owl': if (inst.n % 5 === 0 && inst.b < 3) { inst.b++; ev.push({ k: 'grow', c: i, v: 1 }); } break;
        case 'amethyst': if (inst.b >= 15) break; inst.b++; ev.push({ k: 'grow', c: i, v: 1 }); break;
        case 'oyster': if (chance(run, H.oysterknife ? 0.4 : 0.2)) born.push({ id: 'pearl', s: i }); break;
        case 'cow': if (chance(run, 0.25)) born.push({ id: 'milk', s: i }); break;
        case 'chicken':
          if (chance(run, 1 / 40)) born.push({ id: 'goldegg', s: i });
          else if (chance(run, 1 / 6)) born.push({ id: 'egg', s: i });
          break;
        case 'beehive': if (chance(run, H.honeypot ? 1 / 3 : 1 / 6)) born.push({ id: 'honey', s: i }); break;
        case 'goose': if (chance(run, 0.25)) born.push({ id: 'goldegg', s: i }); break;
        case 'bubble': if (inst.n >= 3) { c.gone = true; ev.push({ k: 'gone', c: i }); } break;
        case 'ghost': if (inst.n >= 5) { c.gone = true; ev.push({ k: 'gone', c: i }); } break;
        case 'genie':
          if (chance(run, 1 / 3)) { run.rr++; ev.push({ k: 'token', c: i, t: 'rr' }); }
          if (chance(run, 1 / 8)) { run.rem++; ev.push({ k: 'token', c: i, t: 'rem' }); }
          break;
      }
    }
    const dead = {};
    for (const c of cells) if (c.inst && (c.dead || c.gone)) dead[c.inst.u] = true;
    run.inv = run.inv.filter((s) => !dead[s.u]);
    for (const b of born) { const s = addSym(run, b.id); ev.push({ k: 'add', c: b.s, id: b.id, u: s.u }); }

    run.coins += total;
    run.spins++;
    run.spinsLeft--;
    run.lastTotal = total;
    run.stats.best = Math.max(run.stats.best, total);
    run.stats.earned += total;
    run.stats.destroyed += destroyed;
    const final = cells.map((c) => (c.inst && !c.dead && !c.gone ? { id: c.inst.id, u: c.inst.u } : null));
    run.grid = final;
    return { drop, events: ev, pays, total, final };
  }

  // ---------- player actions ----------
  function spin(run) {
    if (run.phase !== 'spin') return null;
    const res = resolveSpin(run);
    run.picks = offer(run, run.items.some((x) => x.id === 'pockets') ? 4 : 3);
    run.phase = 'pick';
    return res;
  }
  function pick(run, idx) {
    if (run.phase !== 'pick') return false;
    if (idx >= 0 && run.picks && run.picks[idx]) { addSym(run, run.picks[idx]); run.stats.picked++; }
    else if (run.items.some((x) => x.id === 'wishbone')) run.coins += 4;
    run.picks = null;
    run.phase = run.spinsLeft <= 0 ? 'rent' : 'spin';
    return true;
  }
  function reroll(run) {
    if (run.phase !== 'pick' || run.rr <= 0) return false;
    run.rr--;
    run.picks = offer(run, run.picks ? run.picks.length : 3);
    return true;
  }
  function removeSym(run, u) {
    if (run.rem <= 0 || (run.phase !== 'spin' && run.phase !== 'pick')) return false;
    const i = run.inv.findIndex((s) => s.u === u);
    if (i < 0) return false;
    run.inv.splice(i, 1); run.rem--;
    for (let j = 0; j < N; j++) if (run.grid[j] && run.grid[j].u === u) run.grid[j] = null;
    return true;
  }
  function payRent(run) {
    if (run.phase !== 'rent') return null;
    const rent = rentFor(run, run.floor);
    if (run.coins < rent) { run.phase = 'over'; return { ok: false, rent }; }
    run.coins -= rent;
    let interest = 0;
    if (run.items.some((x) => x.id === 'ledger')) { interest = Math.min(100, Math.floor(run.coins * 0.1)); run.coins += interest; }
    run.floor++;
    const H = itemSet(run);
    run.rem += 1 + (H.eraser ? 2 : 0);
    run.rr += 1 + (H.gloves ? 2 : 0);
    if (run.floor === LR.RENTS.length && !run.endless) { run.phase = 'won'; return { ok: true, rent, interest, won: true }; }
    run.spinsLeft = spinsFor(run, run.floor);
    run.itemLeft = landlord(run).itemPicks || 1;
    run.itemPicks = offerItems(run, 3);
    run.phase = run.itemPicks.length ? 'item' : 'spin';
    return { ok: true, rent, interest };
  }
  function pickItem(run, idx) {
    if (run.phase !== 'item') return false;
    if (idx >= 0 && run.itemPicks && run.itemPicks[idx]) addItem(run, run.itemPicks[idx]);
    run.itemLeft--;
    run.itemPicks = null;
    if (run.itemLeft > 0) {
      run.itemPicks = offerItems(run, 3);
      if (run.itemPicks.length) return true;
    }
    run.itemPicks = null; run.itemLeft = 0;
    run.phase = 'spin';
    return true;
  }
  function goEndless(run) {
    if (run.phase !== 'won') return false;
    run.endless = true;
    run.spinsLeft = spinsFor(run, run.floor);
    run.itemLeft = 1;
    run.itemPicks = offerItems(run, 3);
    run.phase = run.itemPicks.length ? 'item' : 'spin';
    return true;
  }

  // Extra status line for a tooltip ("3 spins until Lantern", "Saved: 12").
  function symStatus(inst) {
    if (!inst) return '';
    const id = inst.id, n = inst.n;
    const left = (t, what) => { const k = Math.max(0, t - n); return k === 1 ? '1 spin until ' + what : k + ' spins until ' + what; };
    switch (id) {
      case 'pumpkin': return left(6, 'it becomes a Lantern');
      case 'caterpillar': return left(5, 'it becomes a Butterfly');
      case 'coal': return left(15, 'it becomes a Diamond');
      case 'bubble': return left(3, 'it pops');
      case 'ghost': return left(5, 'it vanishes');
      case 'piggy': return 'Saved ' + inst.s + ' · ' + left(8, 'it smashes');
      case 'safe': return 'Stored ' + inst.s;
      case 'magpie': { const p = 4 - (n % 4); return p === 1 ? 'Pays 10 next spin' : 'Pays 10 in ' + p + ' spins'; }
      case 'leprechaun': { const p = 7 - (n % 7); return p === 1 ? 'Pays 77 next spin!' : 'Pays 77 in ' + p + ' spins'; }
      case 'owl': return inst.b ? 'Grown +' + inst.b : '';
      case 'amethyst': return inst.b ? 'Grown +' + inst.b : '';
      case 'diver': return inst.b ? 'Grown +' + inst.b : '';
    }
    return '';
  }

  LR.Engine = {
    ADJ, CORNERS, CENTRE, rnd, newRun, addSym, addItem, rentFor, spinsFor, rarityOdds, luck, offer, offerItems,
    resolveSpin, spin, pick, reroll, removeSym, payRent, pickItem, goEndless, symStatus, landlord,
  };
})(typeof window !== 'undefined' ? (window.LR = window.LR || {}) : (global.LR = global.LR || {}));
