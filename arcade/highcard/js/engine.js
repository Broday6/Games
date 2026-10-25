'use strict';
// HIGH CARD — pure game engine (no DOM). Hand evaluation, the scoring pipeline (emits an event list the UI
// animates), and the run state machine: blinds, rounds, cash out, shop, packs, consumables.
(function (G) {
  const HC = G.HC;
  const R = HC.RNG;
  const E = HC.Engine = {};
  const DEF = (ch) => HC.CHARM[ch.id];

  // ---------- rng helpers (state lives in run.rng) ----------
  const rnd = (run, k) => R.next(run.rng, k);
  const rint = (run, k, n) => Math.floor(rnd(run, k) * n);
  const pick = (run, k, arr) => arr[rint(run, k, arr.length)];
  function shuffle(run, k, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = rint(run, k, i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function wpick(run, k, list) { // list of [item, weight]
    let tot = 0; for (const it of list) tot += it[1];
    let r = rnd(run, k) * tot;
    for (const it of list) { r -= it[1]; if (r < 0) return it[0]; }
    return list[list.length - 1][0];
  }
  E.chance = (run, n, d) => rnd(run, 'luck') < (n * Math.pow(2, E.passives(run).prob)) / d;

  // ---------- helpers ----------
  E.card = (run, id) => { for (const c of run.cards) if (c.id === id) return c; return null; };
  const has = (run, v) => run.vouchers.indexOf(v) >= 0;
  E.hasVoucher = has;
  function cnt(run, enh) { let n = 0; for (const c of run.cards) if (c.enh === enh) n++; return n; }
  function charmOn(run, ch) { return !(run.round && run.round.disabled && run.round.disabled.indexOf(ch.uid) >= 0); }
  E.charmOn = charmOn;
  E.passives = function (run) {
    const p = { handSize: 0, hands: 0, discards: 0, four: 0, gaps: 0, smeared: 0, allFace: 0, splash: 0, prob: 0, freeReroll: 0, interest2: 0 };
    for (const ch of run.charms) {
      if (!charmOn(run, ch)) continue;
      const d = DEF(ch);
      if (d && d.passive) for (const k in d.passive) p[k] += d.passive[k];
    }
    return p;
  };
  function suitIs(c, s, smeared) {
    if (c.enh === 'stone') return false;
    if (c.enh === 'wild') return true;
    return smeared ? (c.suit & 1) === (s & 1) : c.suit === s;
  }
  E.suitIs = suitIs;
  const isFaceP = (c, p) => c.enh !== 'stone' && (!!(p && p.allFace) || (c.rank >= 11 && c.rank <= 13));
  E.isFace = (run, c) => isFaceP(c, E.passives(run));
  function bossOf(run) { return run.round && run.round.boss ? HC.BOSS[run.round.boss] : null; }
  E.isDebuffed = function (run, c, p) {
    const b = bossOf(run);
    if (!b) return false;
    if (b.debuff && b.debuff(c)) return true;
    if (b.debuffFace && isFaceP(c, p || E.passives(run))) return true;
    return false;
  };
  E.isFaceDown = (run, id) => !!(run.round && run.round.fd.indexOf(id) >= 0);
  E.sellValue = (ch) => Math.max(1, Math.floor(ch.cost / 2)) + ((ch.s && ch.s.sell) || 0);

  // ---------- hand evaluation ----------
  function findStraight(cards, need, gaps) {
    const byRank = {};
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (c.enh === 'stone') continue;
      if (byRank[c.rank] === undefined) byRank[c.rank] = i;
      if (c.rank === 14 && byRank[1] === undefined) byRank[1] = i;
    }
    const ranks = Object.keys(byRank).map(Number).sort((a, b) => a - b);
    let best = null;
    const chain = [];
    const steps = gaps ? [1, 2] : [1];
    function dfs(r) {
      if (!best || chain.length > best.length) best = chain.slice();
      for (const st of steps) {
        const n = r + st;
        if (byRank[n] !== undefined) { chain.push(n); dfs(n); chain.pop(); }
      }
    }
    for (const r of ranks) { chain.length = 0; chain.push(r); dfs(r); }
    if (!best || best.length < need) return null;
    const idx = best.map((r) => byRank[r]);
    if (new Set(idx).size !== idx.length) return null;
    return idx;
  }
  function union() {
    const s = new Set();
    for (let a = 0; a < arguments.length; a++) for (const v of arguments[a]) s.add(v);
    return Array.from(s);
  }
  // cards: array of card objects in played order; p: passives {four, gaps, smeared, splash}
  E.evaluate = function (cards, p) {
    p = p || {};
    const n = cards.length;
    const groups = {};
    for (let i = 0; i < n; i++) {
      const c = cards[i];
      if (c.enh === 'stone') continue;
      (groups[c.rank] = groups[c.rank] || []).push(i);
    }
    const gl = Object.keys(groups).map((k) => groups[k]).sort((a, b) => b.length - a.length || cards[b[0]].rank - cards[a[0]].rank);
    const c0 = gl[0] ? gl[0].length : 0, c1 = gl[1] ? gl[1].length : 0;
    const need = p.four ? 4 : 5;
    let flush = null;
    if (n >= need) {
      for (let s = 0; s < 4; s++) {
        const idx = [];
        for (let i = 0; i < n; i++) if (suitIs(cards[i], s, p.smeared)) idx.push(i);
        if (idx.length >= need && (!flush || idx.length > flush.length)) flush = idx;
      }
    }
    const straight = n >= need ? findStraight(cards, need, p.gaps) : null;
    const h = {
      high: true, pair: c0 >= 2, two: (c0 >= 2 && c1 >= 2) || c0 >= 4, three: c0 >= 3, four: c0 >= 4, five: c0 >= 5,
      straight: !!straight, flush: !!flush, full: c0 >= 3 && c1 >= 2,
    };
    h.sflush = h.straight && h.flush;
    h.fhouse = h.full && h.flush;
    h.ffive = h.five && h.flush;
    let type, sc;
    if (h.ffive) { type = 'ffive'; sc = union(gl[0], flush); }
    else if (h.fhouse) { type = 'fhouse'; sc = union(gl[0], gl[1], flush); }
    else if (h.five) { type = 'five'; sc = gl[0].slice(); }
    else if (h.sflush) { type = 'sflush'; sc = union(straight, flush); }
    else if (h.four) { type = 'four'; sc = gl[0].slice(); }
    else if (h.full) { type = 'full'; sc = union(gl[0], gl[1]); }
    else if (h.flush) { type = 'flush'; sc = flush.slice(); }
    else if (h.straight) { type = 'straight'; sc = straight.slice(); }
    else if (h.three) { type = 'three'; sc = gl[0].slice(); }
    else if (h.two) { type = 'two'; sc = union(gl[0], gl[1]); }
    else if (h.pair) { type = 'pair'; sc = gl[0].slice(); }
    else { type = 'high'; sc = gl.length ? [gl[0][0]] : []; }
    for (let i = 0; i < n; i++) if (cards[i].enh === 'stone' || p.splash) sc.push(i);
    sc = Array.from(new Set(sc)).sort((a, b) => a - b);
    return { type, scoring: sc, has: h };
  };

  // ---------- levels ----------
  E.handValue = function (run, type, lvl) {
    const H = HC.HAND[type];
    lvl = lvl || run.levels[type];
    return { c: H.c + H.lc * (lvl - 1), m: H.m + H.lm * (lvl - 1) };
  };

  // copy resolution (Mimic / Doppelganger)
  function resolve(charms, i, run, depth) {
    const ch = charms[i];
    if (!ch || (depth || 0) > charms.length + 1) return null;
    if (!charmOn(run, ch)) return null;
    const d = DEF(ch);
    if (d.copy === 'right') return resolve(charms, i + 1, run, (depth || 0) + 1);
    if (d.copy === 'left') return i === 0 ? null : resolve(charms, 0, run, (depth || 0) + 1);
    return ch;
  }
  E.copyTarget = (run, i) => { const t = resolve(run.charms, i, run, 0); return t && t !== run.charms[i] && !DEF(t).nocopy ? t : null; };

  // ---------- the scoring pipeline ----------
  // Returns { type, lvl, events, chips, mult, total, money, destroyed, lucky, blocked }.
  // With opt.dry nothing in run is mutated (charms are cloned, rng is copied).
  E.score = function (run, playedIds, heldIds, opt) {
    opt = opt || {};
    const dry = !!opt.dry;
    const p = E.passives(run);
    const charms = dry ? JSON.parse(JSON.stringify(run.charms)) : run.charms;
    const rs = { luck: run.rng.luck };
    const played = playedIds.map((id) => E.card(run, id));
    const held = heldIds.map((id) => E.card(run, id));
    const ev = E.evaluate(played, p);
    const type = ev.type;
    const scoring = ev.scoring.map((i) => played[i]);
    const round = run.round;
    const boss = bossOf(run);
    const probMul = Math.pow(2, p.prob);
    const events = [];
    const x = {
      run, p, type, has: ev.has, played, scoring, held, charms, events,
      isFirst: round.handsPlayed === 0, isFinal: round.hands <= 1,
      chips: 0, mult: 0, money: 0, destroyed: [], lucky: 0,
      rankOf: (c) => (c.enh === 'stone' ? 0 : c.rank),
      suitIs: (c, s) => suitIs(c, s, p.smeared),
      isFace: (c) => isFaceP(c, p),
      chance: (n, d) => R.next(rs, 'luck') < (n * probMul) / d,
      count: (enh) => cnt(run, enh),
      blackVal: (c) => (c.enh === 'stone' ? 0 : HC.rankChips(c.rank)),
    };
    const deb = (c) => E.isDebuffed(run, c, p);
    let lvl = run.levels[type];
    if (boss && boss.id === 'leech') lvl = Math.max(1, lvl - 1);
    const hv = E.handValue(run, type, lvl);
    let bc = hv.c, bm = hv.m;
    if (boss && boss.id === 'anvil') { bc = Math.ceil(bc / 2); bm = Math.max(1, Math.ceil(bm / 2)); }
    x.chips = bc; x.mult = bm;
    events.push({ k: 'base', type, lvl, c: bc, m: bm, scoring: scoring.map((c) => c.id) });
    const out = { type, lvl, events, scoringIds: scoring.map((c) => c.id), has: ev.has };

    let blocked = false;
    if (boss && boss.id === 'edict' && round.types.length && round.types[0] !== type) blocked = true;
    if (boss && boss.id === 'ledger' && round.types.indexOf(type) >= 0) blocked = true;
    if (blocked) {
      events.push({ k: 'blocked', t: boss.name });
      return Object.assign(out, { chips: 0, mult: 0, total: 0, money: 0, destroyed: [], lucky: 0, blocked: true });
    }

    const push = (e) => { e.c = x.chips; e.m = x.mult; events.push(e); };
    function eff(e, src, id, uid) {
      if (!e) return;
      if (e.chips) { x.chips += e.chips; push({ k: 'fx', src, id, uid, kind: 'chips', v: e.chips }); }
      if (e.mult) { x.mult += e.mult; push({ k: 'fx', src, id, uid, kind: 'mult', v: e.mult }); }
      if (e.xmult && e.xmult !== 1) { x.mult *= e.xmult; push({ k: 'fx', src, id, uid, kind: 'xmult', v: e.xmult }); }
      if (e.money) { x.money += e.money; push({ k: 'fx', src, id, uid, kind: 'money', v: e.money }); }
      if (e.msg) push({ k: 'fx', src, id, uid, kind: 'info', t: e.msg });
    }
    function retrigSources(c, zone) {
      const s = [];
      if (c.seal === 'red') s.push(null);
      for (let i = 0; i < charms.length; i++) {
        const t = resolve(charms, i, run, 0);
        if (!t) continue;
        const d = DEF(t);
        if (d.retrig) { const n = d.retrig(x, t, c, zone) | 0; for (let k = 0; k < n; k++) s.push(charms[i].uid); }
      }
      return s;
    }
    function trigger(c, zone, once) {
      const srcs = retrigSources(c, zone);
      for (let t = 0; t <= srcs.length; t++) {
        const mark = events.length;
        once(c);
        if (t > 0 && events.length > mark) events.splice(mark, 0, { k: 'again', id: c.id, uid: srcs[t - 1], src: zone === 'play' ? 'card' : 'held', c: x.chips, m: x.mult });
      }
    }

    // 1) before-hooks (scaling charms upgrade)
    for (const ch of charms) {
      if (!charmOn(run, ch)) continue;
      const d = DEF(ch);
      if (d.before) { const r = d.before(x, ch); if (r) eff({ msg: r.msg }, 'charm', null, ch.uid); }
    }
    // 2) scored cards, left to right
    const glass = [];
    for (const c of scoring) {
      if (deb(c)) { push({ k: 'debuff', id: c.id }); continue; }
      trigger(c, 'play', (cc) => {
        const base = cc.enh === 'stone' ? 50 : HC.rankChips(cc.rank) + (cc.enh === 'bonus' ? 30 : 0);
        eff({ chips: base }, 'card', cc.id);
        if (cc.enh === 'mult') eff({ mult: 4 }, 'card', cc.id);
        if (cc.enh === 'glass') { eff({ xmult: 2 }, 'card', cc.id); if (glass.indexOf(cc) < 0) glass.push(cc); }
        if (cc.enh === 'lucky') {
          let hit = false;
          if (x.chance(1, 5)) { eff({ mult: 20 }, 'card', cc.id); hit = true; }
          if (x.chance(1, 15)) { eff({ money: 20 }, 'card', cc.id); hit = true; }
          if (hit) x.lucky++;
        }
        if (cc.ed === 'shimmer') eff({ chips: 50 }, 'card', cc.id);
        else if (cc.ed === 'prism') eff({ mult: 10 }, 'card', cc.id);
        else if (cc.ed === 'aurora') eff({ xmult: 1.5 }, 'card', cc.id);
        if (cc.seal === 'gold') eff({ money: 3 }, 'card', cc.id);
        for (let i = 0; i < charms.length; i++) {
          const t = resolve(charms, i, run, 0);
          if (!t) continue;
          const d = DEF(t);
          if (d.card) eff(d.card(x, t, cc), 'card', cc.id, charms[i].uid);
        }
      });
    }
    // 3) cards held in hand
    for (const c of held) {
      if (deb(c)) continue;
      trigger(c, 'held', (cc) => {
        if (cc.enh === 'steel') eff({ xmult: 1.5 }, 'held', cc.id);
        for (let i = 0; i < charms.length; i++) {
          const t = resolve(charms, i, run, 0);
          if (!t) continue;
          const d = DEF(t);
          if (d.held) eff(d.held(x, t, cc), 'held', cc.id, charms[i].uid);
        }
      });
    }
    // 4) charms left to right (editions: shimmer/prism before, aurora after)
    for (let i = 0; i < charms.length; i++) {
      const ch = charms[i];
      if (!charmOn(run, ch)) continue;
      if (ch.ed === 'shimmer') eff({ chips: 50 }, 'charm', null, ch.uid);
      else if (ch.ed === 'prism') eff({ mult: 10 }, 'charm', null, ch.uid);
      const t = resolve(charms, i, run, 0);
      if (t) { const d = DEF(t); if (d.main) eff(d.main(x, t), 'charm', null, ch.uid); }
      if (ch.ed === 'aurora') eff({ xmult: 1.5 }, 'charm', null, ch.uid);
    }
    let total = Math.floor(x.chips * x.mult);
    if (!isFinite(total) || total > 1e300) total = 1e300;
    events.push({ k: 'final', total, c: x.chips, m: x.mult });
    // 5) glass shatters
    for (const c of glass) if (x.chance(1, 4)) { x.destroyed.push(c.id); events.push({ k: 'shatter', id: c.id }); }
    if (!dry) run.rng.luck = rs.luck;
    return Object.assign(out, { chips: x.chips, mult: x.mult, total, money: x.money, destroyed: x.destroyed, lucky: x.lucky, blocked: false });
  };

  // quick preview for the selection UI (no randomness, base values only)
  E.preview = function (run, ids) {
    if (!ids.length) return null;
    const cards = ids.map((id) => E.card(run, id));
    const p = E.passives(run);
    const ev = E.evaluate(cards, p);
    const boss = bossOf(run);
    let lvl = run.levels[ev.type];
    if (boss && boss.id === 'leech') lvl = Math.max(1, lvl - 1);
    const hv = E.handValue(run, ev.type, lvl);
    let c = hv.c, m = hv.m;
    if (boss && boss.id === 'anvil') { c = Math.ceil(c / 2); m = Math.max(1, Math.ceil(m / 2)); }
    let blocked = false;
    if (run.round && boss) {
      if (boss.id === 'edict' && run.round.types.length && run.round.types[0] !== ev.type) blocked = true;
      if (boss.id === 'ledger' && run.round.types.indexOf(ev.type) >= 0) blocked = true;
    }
    const hidden = run.round ? ids.some((id) => run.round.fd.indexOf(id) >= 0) : false;
    return { type: ev.type, lvl: run.levels[ev.type], effLvl: lvl, c, m, blocked, hidden, scoring: ev.scoring.map((i) => ids[i]) };
  };

  // ---------- run creation ----------
  function mkCard(run, rank, suit, extra) {
    const c = { id: run.nextId++, rank, suit, enh: null, ed: null, seal: null };
    if (extra) Object.assign(c, extra);
    return c;
  }
  function mkCharm(run, id, ed, cost) {
    const d = HC.CHARM[id];
    return { uid: run.nextUid++, id, ed: ed || null, cost: cost == null ? d.cost : cost, s: d.init ? d.init() : {} };
  }
  E.mkCharm = mkCharm;
  E.newRun = function (opt) {
    opt = opt || {};
    const seed = R.cleanSeed(opt.seed) || R.randomSeed();
    const deck = HC.DECK[opt.deck] || HC.DECK.house;
    const mod = deck.mod || {};
    const run = {
      v: 1, seed, deck: deck.id, stake: Math.max(0, Math.min(HC.STAKES.length - 1, opt.stake | 0)),
      ante: 1, blind: 0, phase: 'select', money: 4 + (mod.money || 0), rng: R.streams(seed), nextId: 1, nextUid: 1,
      cards: [], draw: [], hand: [], charms: [], charmSlots: 5 + (mod.charmSlots || 0), cons: [], consSlots: 2,
      vouchers: [], levels: {}, plays: {}, bosses: {}, usedBosses: [], anteVoucher: null, voucherSold: false,
      shop: null, pack: null, round: null, cashout: null, lastCons: null, firstShop: true, endless: false, wonAt: 0,
      stats: { hands: 0, discards: 0, omens: 0, stars: 0, best: 0, bestType: null, money: 0, rerolls: 0, bought: 0, blinds: 0 },
      started: Date.now(),
    };
    for (const h of HC.HANDS) { run.levels[h.k] = 1; run.plays[h.k] = 0; }
    const suits = mod.twoTone ? [0, 1, 0, 1] : [0, 1, 2, 3];
    for (const s of suits) for (let r = 2; r <= 14; r++) {
      if (mod.noFace && r >= 11 && r <= 13) continue;
      run.cards.push(mkCard(run, r, s));
    }
    for (const v of mod.vouchers || []) applyVoucher(run, v);
    for (const c of mod.cons || []) run.cons.push({ kind: c[0], id: c[1] });
    for (const id of mod.charms || []) run.charms.push(mkCharm(run, id, null));
    run.bosses[1] = rollBoss(run, 1);
    return run;
  };

  function rollBoss(run, ante) {
    const show = ante % 8 === 0;
    let pool = HC.BOSSES.filter((b) => (show ? b.show : !b.show && b.min <= ante) && run.usedBosses.indexOf(b.id) < 0);
    if (!pool.length) {
      run.usedBosses = run.usedBosses.filter((id) => !!HC.BOSS[id].show !== show);
      pool = HC.BOSSES.filter((b) => (show ? b.show : !b.show && b.min <= ante));
    }
    const b = pick(run, 'boss', pool);
    run.usedBosses.push(b.id);
    return b.id;
  }

  // ---------- blinds ----------
  function baseTarget(run, ante) {
    const t = run.stake >= 2 ? HC.STEEP_TARGETS : HC.BASE_TARGETS;
    if (ante <= 8) return t[ante - 1];
    const v = t[7] * Math.pow(run.stake >= 2 ? 2.2 : 1.9, ante - 8);
    const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return Math.round(v / mag) * mag;
  }
  E.blindInfo = function (run, idx) {
    if (idx == null) idx = run.blind;
    const boss = idx === 2 ? HC.BOSS[run.bosses[run.ante] || (run.bosses[run.ante] = rollBoss(run, run.ante))] : null;
    let mult = HC.BLIND_MULT[idx];
    if (boss && boss.mult) mult = boss.mult;
    if (boss && run.stake >= 4) mult *= 1.25;
    let reward = HC.BLIND_REWARD[idx];
    if (idx === 0 && run.stake >= 1) reward = 0;
    return { idx, name: boss ? boss.name : HC.BLIND_NAMES[idx], boss, target: Math.round(baseTarget(run, run.ante) * mult), reward };
  };
  E.handSize = function (run) {
    const deck = HC.DECK[run.deck];
    let n = 8 + E.passives(run).handSize + ((deck.mod && deck.mod.handSize) || 0) + (has(run, 'palms') ? 1 : 0);
    if (run.round && run.round.boss === 'shackle') n -= 1;
    return Math.max(1, n);
  };
  function roundCounts(run, boss) {
    const deck = HC.DECK[run.deck];
    const mod = deck.mod || {};
    const p = E.passives(run);
    let hands = 4 + p.hands + (mod.hands || 0) + (has(run, 'steady') ? 1 : 0);
    let discards = 3 + p.discards + (mod.discards || 0) + (has(run, 'basket') ? 1 : 0) - (run.stake >= 3 ? 1 : 0);
    if (boss === 'longshot') hands = 1;
    if (boss === 'drought') discards = 0;
    if (boss === 'lasthouse') { hands -= 1; discards -= 1; }
    return { hands: Math.max(1, hands), discards: Math.max(0, discards) };
  }
  E.roundCounts = roundCounts;

  function pickDisabled(run) {
    const r = run.round;
    if (!r) return;
    if (r.boss === 'static' || (r.boss === 'crimson' && !r.disabled.length)) {
      r.disabled = run.charms.length ? [pick(run, 'boss', run.charms).uid] : [];
    }
  }

  E.startBlind = function (run) {
    if (run.phase !== 'select') return { ok: false, err: 'Not now' };
    const info = E.blindInfo(run);
    const bossId = info.boss ? info.boss.id : null;
    run.round = { boss: bossId, target: info.target, reward: info.reward, name: info.name, score: 0, hands: 0, discards: 0, handsPlayed: 0, discardsUsed: 0, types: [], disabled: [], fd: [] };
    pickDisabled(run);
    const rc = roundCounts(run, bossId);
    run.round.hands = rc.hands; run.round.discards = rc.discards; run.round.handsMax = rc.hands; run.round.discardsMax = rc.discards;
    run.draw = shuffle(run, 'deck', run.cards.map((c) => c.id));
    run.hand = [];
    const msgs = [];
    for (const ch of run.charms) {
      if (!charmOn(run, ch)) continue;
      const d = DEF(ch);
      if (d.roundStart) { const r = d.roundStart(run, ch, E); if (r) msgs.push({ uid: ch.uid, t: r.msg }); }
    }
    run.phase = 'play';
    const drawn = drawCards(run);
    return { ok: true, drawn, msgs };
  };

  function drawCards(run) {
    const r = run.round;
    const p = E.passives(run);
    const want = E.handSize(run);
    const drawn = [];
    while (run.hand.length < want && run.draw.length) {
      const id = run.draw.pop();
      run.hand.push(id); drawn.push(id);
      const c = E.card(run, id);
      let fd = false;
      if (r.boss === 'veil' && rnd(run, 'boss') < 1 / 3) fd = true;
      if (r.boss === 'mask' && isFaceP(c, p)) fd = true;
      if (r.boss === 'dealerboss' && r.handsPlayed === 0) fd = true;
      if (fd) r.fd.push(id);
    }
    return drawn;
  }
  E.drawCards = drawCards;
  function clearFd(run, ids) { if (run.round) run.round.fd = run.round.fd.filter((id) => ids.indexOf(id) < 0); }

  function removeCards(run, ids) {
    if (!ids.length) return 0;
    run.cards = run.cards.filter((c) => ids.indexOf(c.id) < 0);
    run.hand = run.hand.filter((id) => ids.indexOf(id) < 0);
    run.draw = run.draw.filter((id) => ids.indexOf(id) < 0);
    if (run.pack && run.pack.hand) run.pack.hand = run.pack.hand.filter((id) => ids.indexOf(id) < 0);
    for (const ch of run.charms) if (ch.id === 'bonfire') ch.s.v += ids.length;
    return ids.length;
  }

  function validSel(run, ids, max) {
    if (!Array.isArray(ids) || !ids.length) return 'Select some cards first';
    if (ids.length > (max || 5)) return 'Select at most ' + (max || 5) + ' cards';
    if (new Set(ids).size !== ids.length) return 'Bad selection';
    for (const id of ids) if (run.hand.indexOf(id) < 0) return 'Bad selection';
    return null;
  }

  // ---------- play a hand ----------
  E.play = function (run, ids) {
    if (run.phase !== 'play') return { ok: false, err: 'Not now' };
    const bad = validSel(run, ids);
    if (bad) return { ok: false, err: bad };
    const r = run.round;
    if (r.boss === 'quintet' && ids.length !== 5) return { ok: false, err: 'The Quintet: play exactly 5 cards' };
    ids = run.hand.filter((id) => ids.indexOf(id) >= 0); // keep hand order
    const res = { ok: true, played: ids.slice(), cut: [], drawn: [], tax: 0, faceDown: ids.filter((id) => r.fd.indexOf(id) >= 0) };
    if (r.boss === 'taxman') { res.tax = Math.min(Math.max(0, run.money), ids.length); run.money -= res.tax; }
    let rest = run.hand.filter((id) => ids.indexOf(id) < 0);
    if (r.boss === 'cutpurse') {
      for (let k = 0; k < 2 && rest.length; k++) { const j = rint(run, 'boss', rest.length); res.cut.push(rest[j]); rest.splice(j, 1); }
    }
    res.held = rest.slice();
    clearFd(run, ids);
    const sc = E.score(run, ids, rest, {});
    res.score = sc;
    run.money += sc.money;
    r.score += sc.total; r.handsPlayed++; r.hands--; r.types.push(sc.type);
    run.plays[sc.type]++; run.stats.hands++;
    if (sc.total > run.stats.best) { run.stats.best = sc.total; run.stats.bestType = sc.type; }
    run.lastHand = sc.type;
    if (r.boss === 'leech') run.levels[sc.type] = Math.max(1, run.levels[sc.type] - 1);
    if (sc.lucky) for (const ch of run.charms) if (ch.id === 'jackpot') ch.s.v += sc.lucky;
    if (sc.total >= r.target && !sc.blocked) for (const ch of run.charms) if (ch.id === 'hotstreak' && charmOn(run, ch)) { ch.s.v += 1; res.hot = ch.uid; }
    run.hand = rest;
    clearFd(run, res.cut);
    res.destroyed = sc.destroyed.slice();
    removeCards(run, sc.destroyed);
    if (r.score >= r.target) {
      res.won = true;
      endRound(run);
    } else if (r.hands <= 0) {
      res.lost = true; run.phase = 'over';
    } else {
      res.drawn = drawCards(run);
      if (r.boss === 'static') pickDisabled(run);
      if (!run.hand.length) { res.lost = true; run.phase = 'over'; }
    }
    return res;
  };

  E.discard = function (run, ids) {
    if (run.phase !== 'play') return { ok: false, err: 'Not now' };
    const r = run.round;
    if (r.discards <= 0) return { ok: false, err: 'No discards left' };
    const bad = validSel(run, ids);
    if (bad) return { ok: false, err: bad };
    ids = run.hand.filter((id) => ids.indexOf(id) >= 0);
    const cards = ids.map((id) => E.card(run, id));
    r.discards--; r.discardsUsed++; run.stats.discards++;
    const msgs = [];
    for (const ch of run.charms) {
      if (!charmOn(run, ch)) continue;
      const d = DEF(ch);
      if (d.discard) { const m = d.discard(run, ch, cards, E); if (m) msgs.push({ uid: ch.uid, t: m.msg }); }
    }
    let omens = 0;
    for (const c of cards) if (c.seal === 'purple' && !E.isDebuffed(run, c) && gainOmen(run)) omens++;
    run.hand = run.hand.filter((id) => ids.indexOf(id) < 0);
    clearFd(run, ids);
    const drawn = drawCards(run);
    const res = { ok: true, discarded: ids, msgs, omens, drawn };
    if (!run.hand.length) { res.lost = true; run.phase = 'over'; }
    return res;
  };

  // ---------- end of round / cash out ----------
  function interestCap(run) { return has(run, 'seedmoney') ? 10 : 5; }
  function endRound(run) {
    const r = run.round;
    const lines = [];
    const p = E.passives(run);
    if (r.reward) lines.push({ label: r.name, v: r.reward, kind: 'blind' });
    if (r.hands > 0) lines.push({ label: 'Remaining Hands (' + r.hands + ')', v: r.hands, kind: 'hands' });
    let gold = 0, blue = 0;
    for (const id of run.hand) {
      const c = E.card(run, id);
      if (!c || E.isDebuffed(run, c, p)) continue;
      if (c.enh === 'gold') gold++;
      if (c.seal === 'blue' && run.lastHand && gainCons(run, 'star', run.lastHand)) blue++;
    }
    if (gold) lines.push({ label: 'Gold Cards (' + gold + ')', v: 3 * gold, kind: 'gold' });
    if (blue) lines.push({ label: 'Blue Seals: +' + blue + ' Star', v: 0, kind: 'info' });
    const gone = [];
    for (const ch of run.charms) {
      if (!charmOn(run, ch)) continue;
      const d = DEF(ch);
      if (!d.roundEnd) continue;
      const res = d.roundEnd(run, ch, E);
      if (!res) continue;
      if (res.money) lines.push({ label: d.name, v: res.money, kind: 'charm', uid: ch.uid });
      else if (res.msg) lines.push({ label: d.name + ': ' + res.msg, v: 0, kind: 'info', uid: ch.uid });
      if (res.destroy) gone.push(ch.uid);
    }
    run.charms = run.charms.filter((ch) => gone.indexOf(ch.uid) < 0);
    const m = Math.max(0, run.money);
    const intr = Math.min(Math.floor(m / 5), interestCap(run));
    if (intr > 0) lines.push({ label: 'Interest ($1 per $5, max $' + interestCap(run) + ')', v: intr, kind: 'interest' });
    if (p.interest2) { const i2 = Math.min(Math.floor(m / 5), 5); if (i2 > 0) lines.push({ label: 'Nest Egg', v: i2, kind: 'interest' }); }
    let total = 0;
    for (const l of lines) total += l.v;
    run.cashout = { lines, total, gone };
    run.stats.blinds++;
    if (run.blind === 2 && run.ante >= 8 && !run.wonAt) run.wonAt = run.ante;
    run.phase = 'cashout';
  }

  E.cashOut = function (run) {
    if (run.phase !== 'cashout') return { ok: false, err: 'Not now' };
    const amt = run.cashout.total;
    run.money += amt; run.stats.money += amt;
    run.cashout = null;
    run.round = null;
    run.hand = []; run.draw = [];
    // advance the blind pointer
    if (run.blind === 2) {
      run.ante++; run.blind = 0;
      run.bosses[run.ante] = rollBoss(run, run.ante);
      run.anteVoucher = null; run.voucherSold = false;
    } else run.blind++;
    if (run.wonAt && !run.endless) { run.phase = 'won'; return { ok: true, amt, won: true }; }
    run.phase = 'shop';
    makeShop(run);
    return { ok: true, amt };
  };
  E.goEndless = function (run) {
    if (run.phase !== 'won') return { ok: false };
    run.endless = true; run.phase = 'shop'; makeShop(run);
    return { ok: true };
  };

  // ---------- shop ----------
  function price(run, base) {
    let p = base;
    if (has(run, 'clearance')) p = Math.floor(p * 0.75);
    if (run.stake >= 4) p += 1;
    return Math.max(1, p);
  }
  E.price = price;
  function rollEdition(run, k) {
    const g = has(run, 'glint') ? 2 : 1;
    const r = rnd(run, k);
    if (r < 0.008 * g) return 'aurora';
    if (r < 0.03 * g) return 'prism';
    if (r < 0.07 * g) return 'shimmer';
    return null;
  }
  function takenCharms(run) {
    const t = run.charms.map((c) => c.id);
    if (run.shop) for (const it of run.shop.items) if (it.kind === 'charm' && !it.sold) t.push(it.id);
    if (run.pack) for (const c of run.pack.choices) if (c.kind === 'charm') t.push(c.id);
    return t;
  }
  function rollCharm(run, k, extraTaken) {
    const r = rnd(run, k);
    const rar = r < 0.7 ? 1 : r < 0.95 ? 2 : 3;
    const taken = takenCharms(run).concat(extraTaken || []);
    let pool = HC.CHARMS.filter((c) => c.r === rar && taken.indexOf(c.id) < 0);
    if (!pool.length) pool = HC.CHARMS.filter((c) => taken.indexOf(c.id) < 0);
    if (!pool.length) pool = HC.CHARMS;
    return pick(run, k, pool).id;
  }
  function starPool(run) { return HC.STARS.filter((s) => !s.secret || run.plays[s.hand] > 0); }
  function genItem(run) {
    const kind = wpick(run, 'shop', [['charm', 20], ['omen', has(run, 'omenmerch') ? 8 : 4], ['star', has(run, 'starmerch') ? 8 : 4]]);
    if (kind === 'charm') {
      const id = rollCharm(run, 'shop');
      const ed = rollEdition(run, 'shop');
      return { kind, id, ed, price: price(run, HC.CHARM[id].cost + (ed ? HC.ED[ed].cost : 0)), sold: false };
    }
    if (kind === 'omen') return { kind, id: pick(run, 'shop', HC.OMENS).id, price: price(run, 3), sold: false };
    return { kind, id: pick(run, 'shop', starPool(run)).id, price: price(run, 3), sold: false };
  }
  function genPack(run) {
    const list = Object.keys(HC.PACKS).map((k) => [k, HC.PACKS[k].w]);
    const id = wpick(run, 'shop', list);
    return { id, price: price(run, HC.PACKS[id].cost), sold: false };
  }
  function baseReroll(run) { return Math.max(0, 5 - (has(run, 'rerun') ? 2 : 0)); }
  function makeShop(run) {
    if (!run.anteVoucher) {
      const pool = HC.VOUCHERS.filter((v) => run.vouchers.indexOf(v.id) < 0);
      run.anteVoucher = pool.length ? pick(run, 'shop', pool).id : null;
      run.voucherSold = false;
    }
    const shop = run.shop = { items: [], packs: [], rerollCost: baseReroll(run), freeUsed: false };
    const slots = 2 + (has(run, 'shelf') ? 1 : 0);
    for (let i = 0; i < slots; i++) shop.items.push(genItem(run));
    if (run.firstShop) { shop.packs.push({ id: 'charm', price: price(run, HC.PACKS.charm.cost), sold: false }); run.firstShop = false; }
    while (shop.packs.length < 2) shop.packs.push(genPack(run));
  }
  E.makeShop = makeShop;
  E.voucherPrice = (run) => price(run, 10);
  E.rerollCost = (run) => (run.shop && E.passives(run).freeReroll && !run.shop.freeUsed ? 0 : run.shop ? run.shop.rerollCost : 0);

  function addCons(run, kind, id) { if (run.cons.length >= run.consSlots) return false; run.cons.push({ kind, id }); return true; }
  function gainCons(run, kind, id) { return addCons(run, kind, id); }
  function gainOmen(run) { return addCons(run, 'omen', pick(run, 'misc', HC.OMENS).id); }
  E.gainOmen = gainOmen;

  E.buy = function (run, idx, useNow) {
    if (run.phase !== 'shop') return { ok: false, err: 'Not now' };
    const it = run.shop.items[idx];
    if (!it || it.sold) return { ok: false, err: 'Sold out' };
    if (run.money < it.price) return { ok: false, err: 'Not enough money' };
    if (it.kind === 'charm') {
      if (run.charms.length >= run.charmSlots) return { ok: false, err: 'No free Charm slot — sell one first' };
      run.money -= it.price; it.sold = true; run.stats.bought++;
      const ch = mkCharm(run, it.id, it.ed, it.price);
      run.charms.push(ch);
      return { ok: true, uid: ch.uid };
    }
    if (useNow) {
      const chk = E.canUseItem(run, { kind: it.kind, id: it.id }, [], true);
      if (!chk.ok) return chk;
      run.money -= it.price; it.sold = true; run.stats.bought++;
      return Object.assign({ used: true }, applyCons(run, { kind: it.kind, id: it.id }, []));
    }
    if (run.cons.length >= run.consSlots) return { ok: false, err: 'Consumable slots are full' };
    run.money -= it.price; it.sold = true; run.stats.bought++;
    run.cons.push({ kind: it.kind, id: it.id });
    return { ok: true };
  };
  function applyVoucher(run, id) {
    if (run.vouchers.indexOf(id) >= 0) return;
    run.vouchers.push(id);
    if (id === 'pouch') run.consSlots++;
    if (id === 'shelf' && run.shop) run.shop.items.push(genItem(run));
    if (id === 'rerun' && run.shop) run.shop.rerollCost = Math.max(0, run.shop.rerollCost - 2);
  }
  E.buyVoucher = function (run) {
    if (run.phase !== 'shop' || !run.anteVoucher || run.voucherSold) return { ok: false, err: 'Sold out' };
    const pr = E.voucherPrice(run);
    if (run.money < pr) return { ok: false, err: 'Not enough money' };
    run.money -= pr; run.voucherSold = true;
    applyVoucher(run, run.anteVoucher);
    return { ok: true, id: run.anteVoucher };
  };
  E.reroll = function (run) {
    if (run.phase !== 'shop') return { ok: false, err: 'Not now' };
    const cost = E.rerollCost(run);
    if (run.money < cost) return { ok: false, err: 'Not enough money' };
    run.money -= cost;
    if (cost === 0 && E.passives(run).freeReroll && !run.shop.freeUsed) run.shop.freeUsed = true;
    else run.shop.rerollCost++;
    const n = run.shop.items.length;
    run.shop.items = [];
    for (let i = 0; i < n; i++) run.shop.items.push(genItem(run));
    run.stats.rerolls++;
    return { ok: true, cost };
  };
  E.sellCharm = function (run, uid) {
    if (['play', 'shop', 'pack', 'select'].indexOf(run.phase) < 0) return { ok: false, err: 'Not now' };
    const i = run.charms.findIndex((c) => c.uid === uid);
    if (i < 0) return { ok: false, err: 'Gone' };
    const v = E.sellValue(run.charms[i]);
    run.charms.splice(i, 1);
    run.money += v;
    if (run.round) run.round.disabled = run.round.disabled.filter((u) => u !== uid);
    if (run.phase === 'play') drawCards(run); // hand size may have shrunk; never shrinks the hand but may grow it
    return { ok: true, v };
  };
  E.sellCons = function (run, idx) {
    if (['play', 'shop', 'pack', 'select'].indexOf(run.phase) < 0) return { ok: false, err: 'Not now' };
    if (!run.cons[idx]) return { ok: false, err: 'Gone' };
    run.cons.splice(idx, 1);
    run.money += 1;
    return { ok: true, v: 1 };
  };
  E.moveCharm = function (run, from, to) {
    if (from === to || !run.charms[from]) return;
    to = Math.max(0, Math.min(run.charms.length - 1, to));
    const [c] = run.charms.splice(from, 1);
    run.charms.splice(to, 0, c);
  };
  E.reorderHand = function (run, ids) {
    if (!Array.isArray(ids) || ids.length !== run.hand.length) return false;
    for (const id of ids) if (run.hand.indexOf(id) < 0) return false;
    run.hand = ids.slice();
    return true;
  };
  E.sortHand = function (run, by) {
    const fd = run.round ? run.round.fd : [];
    const key = (id) => {
      const c = E.card(run, id);
      if (fd.indexOf(id) >= 0) return -1000;
      if (c.enh === 'stone') return -500;
      return by === 'suit' ? (4 - c.suit) * 100 + c.rank : c.rank * 10 + (4 - c.suit);
    };
    run.hand.sort((a, b) => key(b) - key(a));
  };
  E.nextRound = function (run) {
    if (run.phase !== 'shop') return { ok: false, err: 'Not now' };
    run.shop = null; run.phase = 'select';
    return { ok: true };
  };

  // ---------- packs ----------
  function randomPlayingCard(run, k) {
    const deck = HC.DECK[run.deck];
    let rank = 2 + rint(run, k, 13);
    if (deck.mod && deck.mod.noFace) while (rank >= 11 && rank <= 13) rank = 2 + rint(run, k, 13);
    const suit = deck.mod && deck.mod.twoTone ? rint(run, k, 2) : rint(run, k, 4);
    const c = { rank, suit, enh: null, ed: null, seal: null };
    if (rnd(run, k) < 0.4) c.enh = pick(run, k, Object.keys(HC.ENH));
    const er = rnd(run, k);
    if (er < 0.02) c.ed = 'aurora'; else if (er < 0.05) c.ed = 'prism'; else if (er < 0.1) c.ed = 'shimmer';
    if (rnd(run, k) < 0.12) c.seal = pick(run, k, Object.keys(HC.SEAL));
    return c;
  }
  E.buyPack = function (run, idx) {
    if (run.phase !== 'shop') return { ok: false, err: 'Not now' };
    const pk = run.shop.packs[idx];
    if (!pk || pk.sold) return { ok: false, err: 'Sold out' };
    if (run.money < pk.price) return { ok: false, err: 'Not enough money' };
    run.money -= pk.price; pk.sold = true; run.stats.bought++;
    openPack(run, pk.id);
    return { ok: true, pack: run.pack };
  };
  function openPack(run, id) {
    const def = HC.PACKS[id];
    const pack = run.pack = { id, kind: def.kind, picks: def.pick, choices: [], hand: [] };
    if (def.kind === 'charm') {
      const ex = [];
      for (let i = 0; i < def.n; i++) {
        const cid = rollCharm(run, 'pack', ex); ex.push(cid);
        const ed = rollEdition(run, 'pack');
        pack.choices.push({ kind: 'charm', id: cid, ed });
      }
    } else if (def.kind === 'omen') {
      const pool = HC.OMENS.slice();
      for (let i = 0; i < def.n; i++) { const j = rint(run, 'pack', pool.length); pack.choices.push({ kind: 'omen', id: pool[j].id }); pool.splice(j, 1); }
      const ids = shuffle(run, 'pack', run.cards.map((c) => c.id));
      pack.hand = ids.slice(0, Math.min(ids.length, E.handSize(run)));
      sortIds(run, pack.hand);
    } else if (def.kind === 'star') {
      const pool = starPool(run).slice();
      if (has(run, 'telescope')) {
        let best = 'high', bn = -1;
        for (const h of HC.HANDS) if (run.plays[h.k] > bn) { bn = run.plays[h.k]; best = h.k; }
        pack.choices.push({ kind: 'star', id: best });
        pool.splice(pool.findIndex((s) => s.id === best), 1);
      }
      while (pack.choices.length < def.n && pool.length) { const j = rint(run, 'pack', pool.length); pack.choices.push({ kind: 'star', id: pool[j].id }); pool.splice(j, 1); }
    } else {
      for (let i = 0; i < def.n; i++) pack.choices.push({ kind: 'card', card: randomPlayingCard(run, 'pack') });
    }
    run.phase = 'pack';
  }
  E.openPack = openPack;
  function sortIds(run, ids) {
    ids.sort((a, b) => { const A = E.card(run, a), B = E.card(run, b); return B.rank * 10 + (4 - B.suit) - (A.rank * 10 + (4 - A.suit)); });
  }
  E.packPick = function (run, idx, sel) {
    if (run.phase !== 'pack' || !run.pack) return { ok: false, err: 'Not now' };
    const pk = run.pack;
    const ch = pk.choices[idx];
    if (!ch || ch.taken) return { ok: false, err: 'Already taken' };
    let res = { ok: true };
    if (ch.kind === 'charm') {
      if (run.charms.length >= run.charmSlots) return { ok: false, err: 'No free Charm slot — sell one first' };
      const c = mkCharm(run, ch.id, ch.ed, HC.CHARM[ch.id].cost + (ch.ed ? HC.ED[ch.ed].cost : 0));
      run.charms.push(c); res.uid = c.uid;
    } else if (ch.kind === 'card') {
      const c = mkCard(run, ch.card.rank, ch.card.suit, { enh: ch.card.enh, ed: ch.card.ed, seal: ch.card.seal });
      run.cards.push(c); res.cardId = c.id;
    } else {
      const chk = E.canUseItem(run, ch, sel || [], true);
      if (!chk.ok) return chk;
      res = Object.assign(res, applyCons(run, ch, sel || []));
      if (!res.ok) return res;
    }
    ch.taken = true;
    pk.picks--;
    const left = pk.choices.filter((c) => !c.taken).length;
    if (pk.picks <= 0 || !left) { run.pack = null; run.phase = 'shop'; res.closed = true; }
    return res;
  };
  E.packSkip = function (run) {
    if (run.phase !== 'pack') return { ok: false, err: 'Not now' };
    run.pack = null; run.phase = 'shop';
    return { ok: true };
  };

  // ---------- consumables ----------
  function targetPool(run) {
    if (run.phase === 'play') return run.hand;
    if (run.phase === 'pack' && run.pack) return run.pack.hand;
    return [];
  }
  // free: the item is not in a consumable slot (shop/pack), so creation omens need a slot of their own
  E.canUseItem = function (run, item, sel, free) {
    if (item.kind === 'star') return { ok: true };
    const o = HC.OMEN[item.id];
    if (!o) return { ok: false, err: '?' };
    const room = run.consSlots - run.cons.length + (free ? 0 : 1);
    if (o.need) {
      const pool = targetPool(run);
      if (!pool.length) return { ok: false, err: 'Use this while you hold cards (in a round or an Omen Pack)' };
      if (sel.length < o.need[0] || sel.length > o.need[1]) return { ok: false, err: 'Select ' + (o.need[0] === o.need[1] ? o.need[0] : o.need[0] + '–' + o.need[1]) + ' card' + (o.need[1] > 1 ? 's' : '') };
      for (const id of sel) if (pool.indexOf(id) < 0) return { ok: false, err: 'Bad selection' };
      return { ok: true };
    }
    if (o.id === 'oracle' && room < 1) return { ok: false, err: 'No consumable slot free' };
    if (o.id === 'echo') {
      if (!run.lastCons) return { ok: false, err: 'Nothing to echo yet' };
      if (room < 1) return { ok: false, err: 'No consumable slot free' };
    }
    if (o.id === 'pact' && run.charms.length >= run.charmSlots) return { ok: false, err: 'No free Charm slot' };
    if (o.id === 'wheel' && !run.charms.some((c) => !c.ed)) return { ok: false, err: 'No Charm without an edition' };
    return { ok: true };
  };
  function applyCons(run, item, sel) {
    const res = { ok: true, kind: item.kind, id: item.id, changed: [], msg: '' };
    if (item.kind === 'star') {
      run.levels[item.id]++; run.stats.stars++;
      run.lastCons = { kind: 'star', id: item.id };
      res.msg = HC.HAND[item.id].name + ' → level ' + run.levels[item.id];
      return res;
    }
    const o = HC.OMEN[item.id];
    const pool = targetPool(run);
    const ordered = pool.filter((id) => sel.indexOf(id) >= 0);
    const cards = ordered.map((id) => E.card(run, id));
    run.stats.omens++;
    if (o.id !== 'echo') run.lastCons = { kind: 'omen', id: o.id };
    if (o.use) { o.use(run, cards); res.changed = ordered; return res; }
    switch (o.id) {
      case 'twin': {
        const c = cards[0];
        const n = mkCard(run, c.rank, c.suit, { enh: c.enh, ed: c.ed, seal: c.seal });
        run.cards.push(n);
        if (run.phase === 'play') run.hand.push(n.id);
        else if (run.pack && run.pack.hand) run.pack.hand.push(n.id);
        res.added = [n.id]; res.changed = ordered; break;
      }
      case 'mirror': {
        const L = cards[0], Rr = cards[1];
        L.rank = Rr.rank; L.suit = Rr.suit; L.enh = Rr.enh; L.ed = Rr.ed; L.seal = Rr.seal;
        res.changed = [L.id]; break;
      }
      case 'ascent':
        for (const c of cards) c.rank = c.rank === 14 ? 2 : c.rank + 1;
        res.changed = ordered; break;
      case 'reaper':
        removeCards(run, ordered); res.destroyed = ordered; break;
      case 'notary':
        cards[0].seal = pick(run, 'misc', Object.keys(HC.SEAL)); res.changed = ordered; res.msg = HC.SEAL[cards[0].seal].name; break;
      case 'miser': { const g = Math.min(Math.max(0, run.money), 20); run.money += g; res.money = g; res.msg = '+$' + g; break; }
      case 'oracle': {
        let n = 0;
        for (let i = 0; i < 2; i++) if (addCons(run, 'star', pick(run, 'misc', starPool(run)).id)) n++;
        res.msg = '+' + n + ' Star' + (n === 1 ? '' : 's'); break;
      }
      case 'echo':
        addCons(run, run.lastCons.kind, run.lastCons.id);
        res.msg = 'Echoed ' + (run.lastCons.kind === 'star' ? HC.STAR[run.lastCons.id].name : HC.OMEN[run.lastCons.id].name); break;
      case 'pact': {
        const id = rollCharm(run, 'misc');
        const ch = mkCharm(run, id, null); run.charms.push(ch); res.uid = ch.uid; res.msg = HC.CHARM[id].name; break;
      }
      case 'wheel': {
        if (E.chance(run, 1, 4)) {
          const cand = run.charms.filter((c) => !c.ed);
          const ch = pick(run, 'misc', cand);
          const r = rnd(run, 'misc');
          ch.ed = r < 0.5 ? 'shimmer' : r < 0.85 ? 'prism' : 'aurora';
          res.uid = ch.uid; res.msg = HC.ED[ch.ed].name + '!';
        } else res.msg = 'Nope!';
        break;
      }
      case 'tithe': {
        let v = 0; for (const ch of run.charms) v += E.sellValue(ch);
        v = Math.min(50, v); run.money += v; res.money = v; res.msg = '+$' + v; break;
      }
    }
    return res;
  }
  E.useCons = function (run, idx, sel) {
    if (['play', 'shop', 'pack', 'select'].indexOf(run.phase) < 0) return { ok: false, err: 'Not now' };
    const item = run.cons[idx];
    if (!item) return { ok: false, err: 'Gone' };
    const chk = E.canUseItem(run, item, sel || [], false);
    if (!chk.ok) return chk;
    run.cons.splice(idx, 1);
    const res = applyCons(run, item, sel || []);
    if (run.phase === 'play') drawCards(run);
    return res;
  };

  // ---------- misc ----------
  E.mostPlayed = function (run) {
    let best = null, n = 0;
    for (const h of HC.HANDS) if (run.plays[h.k] > n) { n = run.plays[h.k]; best = h.k; }
    return best;
  };
  E.forceWin = function (run) { // debug
    if (run.phase !== 'play') return false;
    run.round.score = Math.max(run.round.score, run.round.target);
    endRound(run);
    return true;
  };
  E.fmt = function (n) {
    if (n == null || isNaN(n)) return '0';
    if (n >= 1e11) { const e = Math.floor(Math.log10(n)); return (n / Math.pow(10, e)).toFixed(2) + 'e' + e; }
    return Math.floor(n).toLocaleString('en-US');
  };
})(typeof window !== 'undefined' ? window : globalThis);
