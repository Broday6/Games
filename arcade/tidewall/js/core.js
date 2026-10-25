'use strict';
// TIDEWALL — pure logic: seeded RNG, island generation, flow fields (Dijkstra), damage math, wave plans.
// Loadable in node for unit tests (attaches to globalThis.TW).
(function (TW) {
  const T = TW.T;
  const Core = TW.Core = {};

  // ---------------- RNG ----------------
  Core.rng = function (seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    const f = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = (n) => Math.floor(f() * n);
    f.range = (a0, b0) => a0 + f() * (b0 - a0);
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.state = () => a;
    f.setState = (s) => { a = s | 0; };
    return f;
  };
  Core.hash = function (a, b) {
    let h = Math.imul((a | 0) ^ 0x5bd1e995, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b);
    h ^= h >>> 15; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 13;
    return h >>> 0;
  };
  Core.newSeed = function () { return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1; };
  Core.seedStr = function (s) { return (s >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6); };

  Core.passable = function (t) { return t === T.GRASS || t === T.SAND || t === T.CORE; };
  Core.buildable = function (t) { return t === T.GRASS || t === T.SAND; };

  // ---------------- binary heap (preallocated, lazy deletion) ----------------
  function Heap(cap) { this.idx = new Int32Array(cap); this.key = new Float32Array(cap); this.n = 0; }
  Heap.prototype.push = function (i, k) {
    if (this.n >= this.idx.length) { // grow (rare)
      const ni = new Int32Array(this.idx.length * 2); ni.set(this.idx); this.idx = ni;
      const nk = new Float32Array(this.key.length * 2); nk.set(this.key); this.key = nk;
    }
    let p = this.n++;
    const I = this.idx, K = this.key;
    while (p > 0) {
      const q = (p - 1) >> 1;
      if (K[q] <= k) break;
      I[p] = I[q]; K[p] = K[q]; p = q;
    }
    I[p] = i; K[p] = k;
  };
  Heap.prototype.pop = function () { // returns index; key in this.lastKey
    const I = this.idx, K = this.key;
    const top = I[0]; this.lastKey = K[0];
    const n = --this.n;
    if (n > 0) {
      const li = I[n], lk = K[n];
      let p = 0;
      for (;;) {
        let c = 2 * p + 1;
        if (c >= n) break;
        if (c + 1 < n && K[c + 1] < K[c]) c++;
        if (K[c] >= lk) break;
        I[p] = I[c]; K[p] = K[c]; p = c;
      }
      I[p] = li; K[p] = lk;
    }
    return top;
  };
  Core.Heap = Heap;

  // 8-neighbourhood offsets
  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const DL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  Core.DX = DX; Core.DY = DY; Core.DL = DL;

  // Field: dist-to-goal for every cell and the best next cell.
  Core.makeField = function (W, H) {
    return { W, H, dist: new Float32Array(W * H), next: new Int16Array(W * H), heap: new Heap(W * H * 8) };
  };

  // cost[i]: cost to ENTER cell i (Infinity = impassable). solid[i]=1 for structures (no diagonal squeeze
  // past them, never entered diagonally). Dijkstra outward from goal; then next[] = argmin neighbour.
  Core.computeField = function (F, cost, solid, goal) {
    const W = F.W, H = F.H, N = W * H, dist = F.dist, next = F.next, heap = F.heap;
    for (let i = 0; i < N; i++) { dist[i] = Infinity; next[i] = -1; }
    heap.n = 0;
    dist[goal] = 0; heap.push(goal, 0);
    while (heap.n > 0) {
      const b = heap.pop();
      const db = heap.lastKey;
      if (db > dist[b]) continue;
      const bx = b % W, by = (b - bx) / W;
      const cb = b === goal ? 0 : cost[b];
      for (let k = 0; k < 8; k++) {
        const ax = bx + DX[k], ay = by + DY[k];
        if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
        const a = ay * W + ax;
        if (cost[a] === Infinity) continue;
        if (k >= 4 && !diagOk(W, cost, solid, a, b, ax, ay, bx, by)) continue;
        const nd = db + (cb === 0 ? 1 : cb) * DL[k];
        if (nd < dist[a]) { dist[a] = nd; heap.push(a, nd); }
      }
    }
    // next pointers (consistent with the relaxation above)
    for (let a = 0; a < N; a++) {
      if (a === goal || dist[a] === Infinity) continue;
      const ax = a % W, ay = (a - ax) / W;
      let best = Infinity, bi = -1;
      for (let k = 0; k < 8; k++) {
        const bx = ax + DX[k], by = ay + DY[k];
        if (bx < 0 || by < 0 || bx >= W || by >= H) continue;
        const b = by * W + bx;
        if (dist[b] === Infinity) continue;
        if (k >= 4 && !diagOk(W, cost, solid, a, b, ax, ay, bx, by)) continue;
        const cb = b === goal ? 1 : cost[b];
        const v = dist[b] + cb * DL[k] + (k >= 4 ? 1e-4 : 0); // tie-break: prefer orthogonal
        if (v < best) { best = v; bi = b; }
      }
      next[a] = bi;
    }
    return F;
  };
  function diagOk(W, cost, solid, a, b, ax, ay, bx, by) {
    if (solid && (solid[a] || solid[b])) return false;
    const o1 = ay * W + bx, o2 = by * W + ax;
    if (cost[o1] === Infinity || cost[o2] === Infinity) return false;
    if (solid && (solid[o1] || solid[o2])) return false;
    return true;
  }
  Core.diagOk = diagOk;

  // Build a cost array from terrain + structure occupancy.
  // mode: 'open' (structures impassable), 'walk' (structures cost to break), 'break' (breakers), 'free' (underground)
  // structs: Int16Array occupancy (-1 none) and sinfo(i) -> {wall:bool, maxHp}
  Core.fillCost = function (terr, occ, kindOf, hpOf, mode, cost, solid) {
    const P = TW.PATH;
    for (let i = 0; i < terr.length; i++) {
      const t = terr[i];
      solid[i] = 0;
      if (t === T.CORE) { cost[i] = 1; continue; }
      if (!Core.passable(t)) { cost[i] = Infinity; continue; }
      const s = occ[i];
      if (s < 0) { cost[i] = 1; continue; }
      if (mode === 'free') { cost[i] = 1; continue; }
      if (mode === 'open') { cost[i] = Infinity; continue; }
      solid[i] = 1;
      const wall = kindOf(s) === 'wall', hp = hpOf(s);
      if (mode === 'break') cost[i] = 1 + (wall ? P.bWallPen : P.bTowerPen) + hp / P.bHpDiv;
      else cost[i] = 1 + (wall ? P.wallPen : P.towerPen) + hp / P.hpDiv;
    }
  };

  // Trace a path of cells following next[] from start; returns array of cell indices (ends at goal).
  Core.trace = function (F, start, goal, out) {
    const res = out || [];
    res.length = 0;
    let c = start, guard = F.W * F.H + 2;
    if (F.dist[c] === Infinity) return res;
    res.push(c);
    while (c !== goal && guard-- > 0) {
      c = F.next[c];
      if (c < 0) break;
      res.push(c);
    }
    return res;
  };

  // ---------------- damage math ----------------
  // Flat armor, reduced by pierce; a hit always does at least 20% of its damage.
  Core.armorDmg = function (dmg, armor, pierce) {
    const a = Math.max(0, (armor || 0) - (pierce || 0));
    return Math.max(dmg * 0.2, dmg - a);
  };
  // Apply a hit to an enemy-like {hp, shield, armor}. Shield soaks raw damage (x shieldMul) first and
  // ignores armor; overflow carries to HP through armor. Returns total HP+shield removed.
  Core.resolveHit = function (e, dmg, pierce, shieldMul, ignoreShield) {
    if (dmg <= 0) return 0;
    let dealt = 0;
    if (e.shield > 0 && !ignoreShield) {
      const sm = shieldMul || 1;
      const sd = dmg * sm;
      if (sd <= e.shield) { e.shield -= sd; return sd; }
      dealt += e.shield;
      dmg -= e.shield / sm; // remaining raw damage
      e.shield = 0;
    }
    const hd = Core.armorDmg(dmg, e.armor, pierce);
    const lost = Math.min(e.hp, hd);
    e.hp -= hd;
    return dealt + lost;
  };

  // ---------------- island generation ----------------
  const STYLES = ['bay', 'coves', 'reef', 'lagoon', 'cliffs', 'spit'];
  Core.STYLE_NAMES = { bay: 'Moon Bay', coves: 'Twin Coves', reef: 'Reef Shallows', lagoon: 'Lagoon Isle', cliffs: 'Cliffside', spit: 'Sand Spit' };
  Core.genMap = function (seed) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const m = tryMap(Core.hash(seed, attempt));
      if (m) { m.seed = seed; return m; }
    }
    return tryMap(12345, true);
  };
  function tryMap(s, force) {
    const W = TW.W, H = TW.H, R = Core.rng(s);
    const terr = new Uint8Array(W * H);
    const style = force ? 'bay' : R.pick(STYLES);
    const at = (x, y) => terr[y * W + x];
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) terr[y * W + x] = v; };
    // shoreline depth per column
    const depth = [];
    let wob = R.range(-0.5, 0.5);
    for (let x = 0; x < W; x++) {
      wob = wob * 0.55 + R.range(-0.7, 0.7);
      let d = 2.4 + wob;
      const u = x / (W - 1);
      if (style === 'bay') d += 1.6 * Math.sin(Math.PI * u);
      if (style === 'coves') d += 1.5 * Math.max(Math.exp(-Math.pow((u - 0.2) / 0.11, 2)), Math.exp(-Math.pow((u - 0.8) / 0.11, 2)));
      if (style === 'spit') d += 1.4 * Math.abs(u - 0.5) * 2 - 0.4;
      if (style === 'reef') d += 0.3;
      depth.push(Math.max(1, Math.min(5, Math.round(d))));
    }
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < depth[x]; y++) set(x, y, T.WATER);
      set(x, depth[x], T.SAND);
      if (R() < 0.45) set(x, depth[x] + 1, T.SAND);
    }
    // cliffside: a channel of sea down one edge
    let side = 0;
    if (style === 'cliffs') {
      side = R() < 0.5 ? -1 : 1;
      const sx = side < 0 ? 0 : W - 1;
      const len = 6 + R.int(3);
      for (let y = 0; y < len + 3; y++) { set(sx, y, T.WATER); if (y < len) set(sx - side, y, T.SAND); }
      for (let y = 0; y < len; y++) if (at(sx - side, y) === T.SAND && at(sx - 2 * side, y) === T.WATER) set(sx - side, y, T.WATER);
    }
    // the southern tip: sea with the lighthouse on a rocky point
    const cx = (W - 1) >> 1, cy = H - 2;
    for (let x = 0; x < W; x++) set(x, H - 1, T.WATER);
    set(cx - 1, H - 1, T.ROCK); set(cx + 1, H - 1, T.ROCK); set(cx, H - 1, T.ROCK);
    if (R() < 0.6) set(0, H - 2, T.WATER);
    if (R() < 0.6) set(W - 1, H - 2, T.WATER);
    set(cx, cy, T.CORE);
    for (let x = cx - 2; x <= cx + 2; x++) if (at(x, cy) !== T.CORE && R() < 0.5) set(x, cy, T.SAND);
    // spawn candidates: sand touching sea from above or the side
    const cand = [];
    for (let y = 1; y < H - 5; y++) for (let x = 0; x < W; x++) {
      if (at(x, y) !== T.SAND) continue;
      const up = y > 0 && at(x, y - 1) === T.WATER;
      const sideW = (x > 0 && at(x - 1, y) === T.WATER) || (x < W - 1 && at(x + 1, y) === T.WATER);
      if (up || (style === 'cliffs' && sideW && y > 2)) cand.push(y * W + x);
    }
    if (cand.length < 3) return null;
    // choose 3 spread-out spawns: one central-ish, then the farthest from chosen
    const spawns = [];
    const cxs = cand.slice().sort((a, b) => Math.abs((a % W) - cx) - Math.abs((b % W) - cx));
    spawns.push(cxs[R.int(Math.min(3, cxs.length))]);
    while (spawns.length < 3) {
      let best = -1, bd = -1;
      for (const c of cand) {
        if (spawns.includes(c)) continue;
        let md = 1e9;
        for (const s0 of spawns) md = Math.min(md, Math.abs((c % W) - (s0 % W)) + Math.abs(((c / W) | 0) - ((s0 / W) | 0)) * 0.7);
        md += R() * 1.2;
        if (md > bd) { bd = md; best = c; }
      }
      if (best < 0) return null;
      spawns.push(best);
    }
    // reserved cells (spawns, cell below them, around the core)
    const reserved = new Uint8Array(W * H);
    for (const sp of spawns) {
      const sx = sp % W, sy = (sp / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = sx + dx, y = sy + dy; if (x >= 0 && y >= 0 && x < W && y < H) reserved[y * W + x] = 1;
      }
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < W && y < H) reserved[y * W + x] = 1; }
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !reserved[y * W + x] && Core.buildable(at(x, y));
    const blob = (kind, n, x0, y0) => {
      let x = x0, y = y0, placed = 0, tries = 0;
      while (placed < n && tries++ < n * 10) {
        if (free(x, y)) { set(x, y, kind); placed++; }
        const k = R.int(4); x += DX[k]; y += DY[k];
        if (x < 0 || y < 0 || x >= W || y >= H || !Core.passable(at(x, y)) && at(x, y) !== kind) { x = x0; y = y0; }
      }
      return placed;
    };
    const midY0 = Math.max(...depth) + 2;
    const rx = () => R.int(W), ry = (a, b) => a + R.int(Math.max(1, b - a));
    // lagoon: inland pond
    if (style === 'lagoon') {
      const lx = 3 + R.int(W - 7), ly = midY0 + 1 + R.int(3);
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2 + R.int(2); dx++) if (free(lx + dx, ly + dy)) set(lx + dx, ly + dy, T.WATER);
    }
    // forests (wood), boulders (stone), crystal outcrops
    const forests = 2 + R.int(2);
    for (let i = 0; i < forests; i++) blob(T.TREE, 3 + R.int(3), rx(), ry(midY0, H - 3));
    const quarries = 2;
    for (let i = 0; i < quarries; i++) blob(T.STONE, 2 + R.int(2), rx(), ry(midY0, H - 3));
    const cr = 1 + R.int(2);
    for (let i = 0; i < cr; i++) {
      const x = R() < 0.5 ? R.int(3) : W - 1 - R.int(3);
      blob(T.CRYSTAL, 1 + R.int(2), x, ry(midY0 + 3, H - 3));
    }
    const rocks = (style === 'reef' ? 7 : 3) + R.int(4);
    for (let i = 0; i < rocks; i++) {
      const x = rx(), y = style === 'reef' ? ry(depth[x] + 1, depth[x] + 4) : ry(midY0, H - 3);
      if (free(x, y)) set(x, y, T.ROCK);
    }
    // validation: every spawn reaches the core, enough nodes & buildable land
    const N = W * H, cost = new Float32Array(N), solid = new Uint8Array(N);
    for (let i = 0; i < N; i++) cost[i] = terr[i] === T.CORE ? 1 : (Core.passable(terr[i]) ? 1 : Infinity);
    const F = Core.computeField(Core.makeField(W, H), cost, solid, cy * W + cx);
    for (const sp of spawns) if (F.dist[sp] === Infinity) return null;
    let land = 0, nodes = { 4: 0, 5: 0, 6: 0 };
    for (let i = 0; i < N; i++) { if (Core.buildable(terr[i]) && F.dist[i] < Infinity) land++; if (nodes[terr[i]] !== undefined) nodes[terr[i]]++; }
    if (!force && (land < 85 || nodes[4] < 4 || nodes[5] < 3 || nodes[6] < 1)) return null;
    // every node must be reachable to gather (adjacent to some reachable land)
    // (gathering is by tap, so this only matters for harvester placement; keep it lenient)
    return { W, H, terr, spawns, core: cy * W + cx, style, side };
  }

  // ---------------- wave plans ----------------
  Core.hpMul = function (n) { return 1 + 0.12 * (n - 1) + 0.035 * (n - 1) * (n - 1); };
  Core.budget = function (n) { return 5 + 4.5 * n + 1.3 * n * n; };
  Core.spawnCount = function (n) { return n <= 2 ? 1 : (n <= 9 ? 2 : 3); };
  // Returns {groups:[{type,n,gap,at,sp}], hpMul, boss, total}
  Core.genWave = function (night, seed) {
    const R = Core.rng(Core.hash(seed, night * 7919 + 17));
    const E = TW.ENEMIES;
    const avail = TW.ENEMY_IDS.filter((id) => E[id].from <= night);
    const nsp = Core.spawnCount(night);
    let budget = Core.budget(night);
    const boss = TW.BOSS_BY_NIGHT[night] || null;
    if (boss) budget *= 0.6;
    const groups = [];
    let t = 1.5, sp = R.int(nsp);
    const fresh = avail.filter((id) => E[id].from === night);
    const addGroup = (type, share) => {
      const d = E[type];
      const gb = Math.max(d.cost, budget * share);
      const n = Math.max(1, Math.round(gb / d.cost));
      const gap = d.pack ? 0.32 : (d.cost >= 5 ? 2.2 : 0.75 + R() * 0.4);
      groups.push({ type, n, gap, at: t, sp });
      t += n * gap * 0.55 + 1.8 + R() * 2.2;
      sp = (sp + 1 + R.int(2)) % nsp;
      return n * d.cost;
    };
    let left = budget;
    for (const f of fresh) left -= addGroup(f, 0.14);
    let guard = 40;
    while (left > 0.5 && guard-- > 0) {
      // weight: newer types more likely, basics always present
      let tot = 0;
      const w = avail.map((id) => { const v = 1 + (E[id].from / Math.max(1, night)) * 1.6; tot += v; return v; });
      let r = R() * tot, k = 0;
      while (r > w[k]) { r -= w[k]; k++; }
      const share = Math.min(left / budget, 0.1 + R() * 0.14);
      left -= addGroup(avail[Math.min(k, avail.length - 1)], share);
    }
    let total = 0;
    for (const g of groups) total += g.n;
    return { groups, hpMul: Core.hpMul(night), boss, bossAt: boss ? Math.max(6, t * 0.35) : 0, total: total + (boss ? 1 : 0), nsp };
  };

  // Weighted boon roll (no duplicates within an offer, respects max stacks)
  const TAG_TOWER = { Ballista: 'ballista', Brazier: 'brazier', Mortar: 'mortar', Frost: 'frost', Tesla: 'tesla', Harpoon: 'harpoon', Lantern: 'lantern' };
  Core.TAG_TOWER = TAG_TOWER;
  // unlocked: tower ids available this run; built: {type: count} currently standing (boosts matching boons)
  Core.rollBoons = function (R, owned, n, night, unlocked, built) {
    const pool = TW.BOONS.filter((b) => (owned[b.id] || 0) < b.max && (!unlocked || !TAG_TOWER[b.tag] || unlocked.indexOf(TAG_TOWER[b.tag]) >= 0));
    const out = [];
    const lateBoost = Math.min(1, (night || 1) / 20);
    for (let i = 0; i < n && pool.length; i++) {
      let tot = 0;
      const ws = pool.map((b) => {
        const base = TW.RARITY[b.rar].w;
        let w = b.rar === 'common' ? base * (1 - 0.35 * lateBoost) : base * (1 + lateBoost);
        const tt = TAG_TOWER[b.tag];
        if (tt && built) w *= built[tt] ? 2.2 : 0.45;
        tot += w; return w;
      });
      let r = R() * tot, k = 0;
      while (k < pool.length - 1 && r > ws[k]) { r -= ws[k]; k++; }
      out.push(pool[k].id);
      pool.splice(k, 1);
    }
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TW;
})(typeof window !== 'undefined' ? (window.TW = window.TW || {}) : (globalThis.TW = globalThis.TW || {}));
