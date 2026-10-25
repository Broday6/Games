// DICE DEN — pure game logic (no DOM). Loaded by the page and by node test scripts.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.DDRules = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- RNG (seedable for tests / ?seed=) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rand = Math.random;
  function setSeed(s) { rand = (s == null || isNaN(s)) ? Math.random : mulberry32(+s); }
  function rnd() { return rand(); }
  function d6() { return 1 + Math.floor(rand() * 6); }
  function rollN(n) { const a = []; for (let i = 0; i < n; i++) a.push(d6()); return a; }

  // ---------- Probability ----------
  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }
  function binomPmf(n, k, p) {
    if (k < 0 || k > n) return 0;
    return choose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  }
  function binomAtLeast(n, k, p) {
    if (k <= 0) return 1;
    if (k > n) return 0;
    let s = 0;
    for (let i = k; i <= n; i++) s += binomPmf(n, i, p);
    return Math.min(1, Math.max(0, s));
  }

  // ---------- Bot personalities ----------
  const PERSONALITIES = {
    cautious: { label: 'Cautious', blurb: 'Plays it safe, calls bluffs early.' },
    bluffer: { label: 'Bluffer', blurb: 'Big bids, big risks, loves a fib.' },
    calculator: { label: 'Calculator', blurb: 'Runs the odds on every move.' },
  };
  const LIARS_P = {
    cautious: { liar: 0.04, bidMin: 0.55, bluff: 0.04, spot: 0.9, trust: 0.7, raiseBias: -0.04, noise: 0.05 },
    bluffer: { liar: -0.06, bidMin: 0.30, bluff: 0.30, spot: 0.8, trust: 0.4, raiseBias: 0.10, noise: 0.08 },
    calculator: { liar: 0, bidMin: 0.45, bluff: 0.06, spot: 1.0, trust: 0.9, raiseBias: 0, noise: 0.015 },
  };

  // =====================================================================
  // LIAR'S DICE (Perudo)
  // =====================================================================
  const Liars = {};

  // Is `bid` a legal raise over `prev` (null = opening bid)?
  Liars.isValidBid = function (prev, bid, total, wild) {
    if (!bid || !Number.isInteger(bid.q) || !Number.isInteger(bid.f)) return false;
    if (bid.q < 1 || bid.q > total || bid.f < 1 || bid.f > 6) return false;
    if (!prev) return !(wild && bid.f === 1);
    if (!wild) return bid.q > prev.q || (bid.q === prev.q && bid.f > prev.f);
    if (prev.f !== 1 && bid.f !== 1) return bid.q > prev.q || (bid.q === prev.q && bid.f > prev.f);
    if (prev.f !== 1 && bid.f === 1) return bid.q >= Math.ceil(prev.q / 2);
    if (prev.f === 1 && bid.f === 1) return bid.q > prev.q;
    return bid.q >= prev.q * 2 + 1; // leaving ones
  };

  // Smallest legal quantity for face f, or null.
  Liars.minQty = function (prev, f, total, wild) {
    for (let q = 1; q <= total; q++) if (Liars.isValidBid(prev, { q, f }, total, wild)) return q;
    return null;
  };

  Liars.legalBids = function (prev, total, wild, extra) {
    const out = [];
    for (let f = 1; f <= 6; f++) {
      const m = Liars.minQty(prev, f, total, wild);
      if (m == null) continue;
      for (let q = m; q <= Math.min(total, m + (extra == null ? 2 : extra)); q++) out.push({ q, f });
    }
    return out;
  };

  Liars.matches = function (v, f, wild) { return v === f || (wild && f !== 1 && v === 1); };

  Liars.countFace = function (players, f, wild) {
    let n = 0;
    for (const p of players) for (const v of p.dice) if (Liars.matches(v, f, wild)) n++;
    return n;
  };

  Liars.faceP = function (f, wild) { return (wild && f !== 1) ? 1 / 3 : 1 / 6; };

  // P(at least q dice show f overall | my dice)
  // `credit` = expected extra matching dice we believe others hold because of their bids (fractional).
  Liars.probAtLeast = function (q, f, myDice, unknown, wild, credit) {
    const k = myDice.filter((v) => Liars.matches(v, f, wild)).length;
    const p = Liars.faceP(f, wild);
    if (!credit) return binomAtLeast(unknown, q - k, p);
    credit = Math.min(credit, unknown);
    const lo = Math.floor(credit), w = credit - lo;
    const a = binomAtLeast(unknown - lo, q - k - lo, p);
    const b = lo + 1 <= unknown ? binomAtLeast(unknown - lo - 1, q - k - lo - 1, p) : a;
    return (1 - w) * a + w * b;
  };
  // How many of face f other players have signalled this round (each opponent's bids count once).
  Liars.signals = function (s, idx, f) {
    const who = new Set();
    for (const h of s.history) if (h.by !== idx && (h.f === f || (s.wild && h.f === 1))) who.add(h.by);
    return who.size;
  };
  Liars.probExact = function (q, f, myDice, unknown, wild) {
    const k = myDice.filter((v) => Liars.matches(v, f, wild)).length;
    return binomPmf(unknown, q - k, Liars.faceP(f, wild));
  };

  Liars.totalDice = function (s) { return s.players.reduce((n, p) => n + (p.out ? 0 : p.count), 0); };
  Liars.active = function (s) { return s.players.filter((p) => !p.out); };
  Liars.nextActive = function (s, i) {
    const n = s.players.length;
    for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (!s.players[j].out) return j; }
    return i;
  };

  Liars.newGame = function (players, opts) {
    const s = {
      game: 'liars',
      wild: !!(opts && opts.wild),
      players: players.map((p) => ({ id: p.id, name: p.name, type: p.type, personality: p.personality || 'calculator', count: 5, dice: [], out: false })),
      turn: 0, starter: 0, bid: null, history: [], round: 0, phase: 'bidding', result: null, seen: {}, winner: null,
    };
    s.starter = Math.floor(rnd() * s.players.length);
    Liars.startRound(s);
    return s;
  };

  Liars.startRound = function (s) {
    s.round++;
    s.bid = null; s.history = []; s.result = null; s.seen = {};
    for (const p of s.players) p.dice = p.out ? [] : rollN(p.count).sort((a, b) => a - b);
    if (s.players[s.starter].out) s.starter = Liars.nextActive(s, s.starter);
    s.turn = s.starter;
    s.phase = 'bidding';
  };

  Liars.applyBid = function (s, bid) {
    const total = Liars.totalDice(s);
    if (s.phase !== 'bidding' || !Liars.isValidBid(s.bid, bid, total, s.wild)) return false;
    s.bid = { q: bid.q, f: bid.f, by: s.turn };
    s.history.push({ q: bid.q, f: bid.f, by: s.turn });
    s.turn = Liars.nextActive(s, s.turn);
    return true;
  };

  Liars.applyCall = function (s, type) {
    if (s.phase !== 'bidding' || !s.bid) return false;
    const caller = s.turn, bidder = s.bid.by;
    const actual = Liars.countFace(s.players, s.bid.f, s.wild);
    const r = { type, caller, bidder, q: s.bid.q, f: s.bid.f, actual, loser: null, gainer: null, correct: false };
    if (type === 'liar') {
      r.correct = actual < s.bid.q;
      r.loser = r.correct ? bidder : caller;
    } else {
      r.correct = actual === s.bid.q;
      if (r.correct) r.gainer = caller; else r.loser = caller;
    }
    s.result = r;
    s.phase = 'reveal';
    return r;
  };

  // Apply the die loss/gain from the reveal; then start the next round or end the game.
  Liars.applyResult = function (s) {
    const r = s.result;
    if (!r || s.phase !== 'reveal') return;
    if (r.loser != null) {
      const p = s.players[r.loser];
      p.count--;
      if (p.count <= 0) { p.count = 0; p.out = true; p.dice = []; }
      s.starter = p.out ? Liars.nextActive(s, r.loser) : r.loser;
    }
    if (r.gainer != null) {
      const p = s.players[r.gainer];
      if (p.count < 5) p.count++;
      s.starter = r.gainer;
    }
    const alive = Liars.active(s);
    if (alive.length <= 1) {
      s.phase = 'over';
      s.winner = s.players.indexOf(alive[0]);
      return;
    }
    Liars.startRound(s);
  };

  // Bot decision. Returns {type:'bid',q,f} | {type:'liar'} | {type:'spot'}. Never illegal.
  Liars.botDecide = function (s, idx, rng) {
    rng = rng || rnd;
    const me = s.players[idx];
    const P = LIARS_P[me.personality] || LIARS_P.calculator;
    const total = Liars.totalDice(s);
    const unknown = total - me.dice.length;
    const wild = s.wild;
    const noise = () => (rng() * 2 - 1) * P.noise;
    const myCount = (f) => me.dice.filter((v) => Liars.matches(v, f, wild)).length;

    const cands = Liars.legalBids(s.bid, total, wild, 3).map((b) => {
      const pr = Liars.probAtLeast(b.q, b.f, me.dice, unknown, wild, P.trust * 0.7 * Liars.signals(s, idx, b.f));
      return { q: b.q, f: b.f, p: pr };
    });

    // Opening bid
    if (!s.bid) {
      let bestF = 2, bestE = -1;
      for (let f = wild ? 2 : 1; f <= 6; f++) {
        const e = myCount(f) + unknown * Liars.faceP(f, wild) + f * 0.01 + noise();
        if (e > bestE) { bestE = e; bestF = f; }
      }
      if (rng() < P.bluff) bestF = (wild ? 2 : 1) + Math.floor(rng() * (wild ? 5 : 6));
      let q = Math.floor(myCount(bestF) + unknown * Liars.faceP(bestF, wild) * (me.personality === 'bluffer' ? 1.0 : me.personality === 'cautious' ? 0.6 : 0.8));
      q = Math.max(1, Math.min(total, q));
      const b = { q, f: bestF };
      if (Liars.isValidBid(null, b, total, wild)) return { type: 'bid', q: b.q, f: b.f };
      const fb = cands[0] || { q: 1, f: 2 };
      return { type: 'bid', q: fb.q, f: fb.f };
    }

    const credit = P.trust * Liars.signals(s, idx, s.bid.f);
    const pTrue = Liars.probAtLeast(s.bid.q, s.bid.f, me.dice, unknown, wild, credit);
    const pExact = Liars.probExact(s.bid.q, s.bid.f, me.dice, unknown, wild);

    // Pick the best raise: most likely true, slight preference for faces we hold and for small raises.
    let best = null, bestScore = -1;
    for (const c of cands) {
      let sc = c.p + noise() + myCount(c.f) * 0.01 - (c.q - s.bid.q) * 0.005;
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    // Bluffers sometimes push a face they don't hold, as long as it's not absurd.
    if (best && rng() < P.bluff) {
      const bl = cands.filter((c) => myCount(c.f) === 0 && c.p > P.bidMin * 0.55);
      if (bl.length) best = bl[Math.floor(rng() * bl.length)];
    }

    const uLiar = 1 - pTrue + P.liar + noise();
    const uRaise = best ? best.p + P.raiseBias + noise() : -1;
    const uSpot = pExact * P.spot + noise() - 0.05;

    if (best && uRaise >= P.bidMin && uRaise >= uLiar && uRaise >= uSpot) return { type: 'bid', q: best.q, f: best.f };
    if (uSpot > uLiar && pExact > 0.3) return { type: 'spot' };
    if (uLiar >= uRaise || !best) return { type: 'liar' };
    return { type: 'bid', q: best.q, f: best.f };
  };

  // =====================================================================
  // FARKLE
  // =====================================================================
  const Farkle = {};
  Farkle.counts = function (dice) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of dice) c[v]++; return c; };
  function kindScore(f, n) { return (f === 1 ? 1000 : f * 100) * Math.pow(2, n - 3); }

  // Score of a set-aside selection. 0 if empty or any die doesn't score.
  Farkle.score = function (dice) {
    if (!dice || !dice.length) return 0;
    const c = Farkle.counts(dice);
    let special = 0;
    if (dice.length === 6) {
      if (c.slice(1).every((n) => n === 1)) special = Math.max(special, 1500);
      const vals = c.slice(1).filter((n) => n > 0);
      if (vals.every((n) => n === 2 || n === 4) && vals.reduce((a, n) => a + n / 2, 0) === 3) special = Math.max(special, 1500);
      if (vals.length === 2 && vals[0] === 3 && vals[1] === 3) special = Math.max(special, 2500);
    }
    let g = 0, ok = true;
    for (let f = 1; f <= 6; f++) {
      const n = c[f];
      if (!n) continue;
      if (n >= 3) g += kindScore(f, n);
      else if (f === 1) g += 100 * n;
      else if (f === 5) g += 50 * n;
      else { ok = false; break; }
    }
    return Math.max(special, ok ? g : 0);
  };

  Farkle.hasScoring = function (dice) {
    const c = Farkle.counts(dice);
    if (c[1] || c[5]) return true;
    for (let f = 1; f <= 6; f++) if (c[f] >= 3) return true;
    return Farkle.score(dice) > 0;
  };

  // All valid scoring subsets, as index lists.
  Farkle.options = function (dice) {
    const out = [];
    const n = dice.length;
    for (let m = 1; m < (1 << n); m++) {
      const idx = [];
      for (let i = 0; i < n; i++) if (m & (1 << i)) idx.push(i);
      const sc = Farkle.score(idx.map((i) => dice[i]));
      if (sc > 0) out.push({ idx, score: sc });
    }
    return out;
  };

  Farkle.P_FARKLE = { 1: 2 / 3, 2: 4 / 9, 3: 0.2778, 4: 0.1574, 5: 0.0772, 6: 0.0231 };
  Farkle.EXP_GAIN = { 1: 25, 2: 50, 3: 86, 4: 132, 5: 201, 6: 390 };
  const FARKLE_P = { cautious: 0.6, bluffer: 1.7, calculator: 1.0 };

  // Bot: which dice to keep and whether to bank. ctx = {turn, banked, target, leader, finalRound, oppMax}
  Farkle.botChoose = function (dice, ctx, personality) {
    const opts = Farkle.options(dice);
    if (!opts.length) return null;
    let risk = FARKLE_P[personality] || 1;
    const myTotal = ctx.banked + ctx.turn;
    if (personality === 'calculator' && ctx.oppMax >= ctx.target - 1500 && ctx.oppMax > myTotal + 1500) risk *= 1.6;
    let best = null, bestV = -Infinity;
    for (const o of opts) {
      let rem = dice.length - o.idx.length;
      const hot = rem === 0;
      if (hot) rem = 6;
      const t = ctx.turn + o.score;
      const total = ctx.banked + t;
      let action;
      if (ctx.finalRound && total <= ctx.leader) action = 'roll';
      else if (total >= ctx.target && !ctx.finalRound) action = 'bank';
      else if (ctx.finalRound && total > ctx.leader) action = 'bank';
      else {
        const pf = Farkle.P_FARKLE[rem];
        action = (Farkle.EXP_GAIN[rem] * risk > pf * t) ? 'roll' : 'bank';
        if (personality === 'cautious' && t >= 350 && rem <= 3) action = 'bank';
        if (personality === 'bluffer' && t < 300) action = 'roll';
      }
      const v = action === 'bank' ? t : t * (1 - Farkle.P_FARKLE[rem]) + Farkle.EXP_GAIN[rem] * risk;
      const val = v + o.score * 0.001 + (hot ? 5 : 0);
      if (val > bestV) { bestV = val; best = { keep: o.idx, action, score: o.score }; }
    }
    return best;
  };

  Farkle.newGame = function (players, opts) {
    return {
      game: 'farkle',
      target: (opts && opts.target) || 10000,
      players: players.map((p) => ({ id: p.id, name: p.name, type: p.type, personality: p.personality || 'calculator', score: 0, farkles: 0 })),
      turn: 0, turnScore: 0, dice: [], kept: [], phase: 'start', finalRound: null, winner: null, lastRoll: null, turnsTaken: 0,
    };
  };
  // Roll the free dice. Returns 'farkle' | 'ok'.
  Farkle.roll = function (s) {
    let n = 6 - s.kept.length;
    if (n <= 0) { s.kept = []; n = 6; }
    s.dice = rollN(n);
    if (!Farkle.hasScoring(s.dice)) { s.phase = 'farkle'; return 'farkle'; }
    s.phase = 'rolled';
    return 'ok';
  };
  // Set aside chosen indices (must be a valid scoring set). Returns score or 0.
  Farkle.keep = function (s, idx) {
    if (s.phase !== 'rolled') return 0;
    const sel = idx.map((i) => s.dice[i]);
    if (new Set(idx).size !== idx.length || idx.some((i) => i < 0 || i >= s.dice.length)) return 0;
    const sc = Farkle.score(sel);
    if (!sc) return 0;
    s.turnScore += sc;
    s.kept = s.kept.concat(sel);
    s.dice = s.dice.filter((_, i) => idx.indexOf(i) < 0);
    s.phase = 'kept';
    return sc;
  };
  Farkle.hotDice = function (s) { return s.kept.length >= 6; };
  Farkle.leader = function (s, except) {
    let m = 0;
    s.players.forEach((p, i) => { if (i !== except && p.score > m) m = p.score; });
    return m;
  };
  Farkle.bank = function (s) {
    const p = s.players[s.turn];
    p.score += s.turnScore;
    if (!s.finalRound && p.score >= s.target) s.finalRound = { by: s.turn };
    Farkle.endTurn(s);
  };
  Farkle.bust = function (s) { s.players[s.turn].farkles++; Farkle.endTurn(s); };
  Farkle.endTurn = function (s) {
    s.turnScore = 0; s.dice = []; s.kept = []; s.turnsTaken++;
    s.turn = (s.turn + 1) % s.players.length;
    if (s.finalRound && s.turn === s.finalRound.by) {
      let w = 0;
      s.players.forEach((p, i) => { if (p.score > s.players[w].score) w = i; });
      s.winner = w; s.phase = 'over';
      return;
    }
    s.phase = 'start';
  };

  // =====================================================================
  // SHIP, CAPTAIN & CREW
  // =====================================================================
  const SCC = {};
  SCC.newTurn = function () { return { rolls: 3, ship: false, captain: false, crew: false, dice: [], cargo: null, done: false }; };
  // Auto-assign 6 -> 5 -> 4 in order from a fresh roll.
  SCC.assign = function (t, dice) {
    const d = dice.slice();
    const take = (v) => { const i = d.indexOf(v); if (i >= 0) { d.splice(i, 1); return true; } return false; };
    if (!t.ship) t.ship = take(6);
    if (t.ship && !t.captain) t.captain = take(5);
    if (t.captain && !t.crew) t.crew = take(4);
    t.dice = d;
    t.cargo = (t.ship && t.captain && t.crew) ? d.reduce((a, b) => a + b, 0) : null;
    return t;
  };
  SCC.held = function (t) { return (t.ship ? 1 : 0) + (t.captain ? 1 : 0) + (t.crew ? 1 : 0); };
  SCC.roll = function (t) {
    if (t.done || t.rolls <= 0) return t;
    t.rolls--;
    SCC.assign(t, rollN(5 - SCC.held(t)));
    if (t.rolls <= 0) t.done = true;
    return t;
  };
  SCC.score = function (t) { return t.cargo || 0; };
  // Bot: keep current cargo? (only asked when cargo exists and rolls remain)
  SCC.botKeep = function (t, best, personality) {
    if (t.cargo == null) return false;
    if (t.cargo >= 10) return true;
    if (t.cargo <= best) return false; // losing: always push
    if (personality === 'cautious') return t.cargo >= 6;
    if (personality === 'bluffer') return t.cargo >= 9;
    return t.cargo >= 8 || (t.rolls === 1 && t.cargo >= 7);
  };
  SCC.newGame = function (players) {
    return {
      game: 'scc',
      players: players.map((p) => ({ id: p.id, name: p.name, type: p.type, personality: p.personality || 'calculator', result: null })),
      turn: 0, t: SCC.newTurn(), phase: 'play', hand: 1, winners: null,
    };
  };
  SCC.best = function (s) { return s.players.reduce((m, p) => Math.max(m, p.result || 0), 0); };
  SCC.finishTurn = function (s) {
    s.players[s.turn].result = SCC.score(s.t);
    s.t = SCC.newTurn();
    s.turn++;
    if (s.turn >= s.players.length) {
      const best = SCC.best(s);
      if (best <= 0) { s.phase = 'push'; return; }
      s.winners = s.players.map((p, i) => (p.result === best ? i : -1)).filter((i) => i >= 0);
      s.phase = 'over';
    }
  };
  SCC.rehand = function (s) {
    s.players.forEach((p) => { p.result = null; });
    s.turn = 0; s.t = SCC.newTurn(); s.phase = 'play'; s.hand++;
  };

  return { setSeed, rnd, d6, rollN, choose, binomPmf, binomAtLeast, PERSONALITIES, Liars, Farkle, SCC };
});
