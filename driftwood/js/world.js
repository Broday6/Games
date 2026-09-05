// DRIFTWOOD — procedural island generation + world queries
(function (G) {
  'use strict';
  const T = G.T, W = G.WORLD;

  function generate(seedStr, opts) {
    opts = opts || {};
    const seed = G.hashStr(String(seedStr));
    const rng = G.RNG(seed);
    const nz = G.makeNoise(seed ^ 0x9e3779b9);
    const nz2 = G.makeNoise(seed ^ 0x51ed270b);
    const tiles = new Uint8Array(W * W);
    const biome = new Uint8Array(W * W);
    const height = new Float32Array(W * W);
    const cx = W / 2, cy = W / 2;

    // --- height & tiles ---
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / (W * 0.5), dy = (y - cy) / (W * 0.5);
      const d = Math.sqrt(dx * dx + dy * dy);
      const n = nz.fbm(x / 28, y / 28, 4, 2.1, 0.5);      // 0..1
      const shape = nz2.fbm(x / 60, y / 60, 2, 2, 0.5);  // coastline wobble
      let h = n * 0.75 + 0.25 - (d * d) * (1.05 + shape * 0.5);
      height[y * W + x] = h;
    }
    // biome: three sectors by angle from center, warped by noise
    const spawnAngle = Math.PI / 2; // spawn on south side
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let a = Math.atan2(y - cy, x - cx) - spawnAngle;
      a += (nz2.fbm(x / 22, y / 22, 3, 2, 0.5) - 0.5) * 1.4;
      while (a < -Math.PI) a += Math.PI * 2; while (a > Math.PI) a -= Math.PI * 2;
      const abs = Math.abs(a);
      biome[i] = abs < Math.PI * 0.42 ? G.BIOME.MEADOW : (a > 0 ? G.BIOME.FOREST : G.BIOME.VOLCANO);
    }
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, h = height[i], b = biome[i];
      let t;
      if (h < -0.02) t = T.DEEP;
      else if (h < 0.05) t = T.WATER;
      else if (h < 0.11) t = T.SAND;
      else {
        const det = nz2.fbm(x / 5.3 + 31, y / 4.7 + 17, 2, 2.3, 0.5);
        if (b === G.BIOME.MEADOW) t = h > 0.55 ? T.STONE : (det > 0.78 ? T.DIRT : T.GRASS);
        else if (b === G.BIOME.FOREST) t = h > 0.58 ? T.STONE : (det > 0.82 ? T.DIRT : T.DARKGRASS);
        else { // volcano
          if (h < 0.2) t = T.ASH;
          else if (h > 0.62 && det > 0.45) t = T.LAVA;
          else if (h > 0.4) t = T.OBSIDIAN;
          else t = det > 0.5 ? T.STONE : T.ASH;
        }
      }
      tiles[i] = t;
    }
    // remove lava next to sand/water to avoid lava beaches; guarantee lava neighbours are obsidian
    for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (tiles[i] === T.LAVA) {
        let ok = true;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const tt = tiles[i + oy * W + ox]; if (tt <= T.SAND) ok = false; }
        if (!ok) tiles[i] = T.OBSIDIAN;
      }
    }

    // --- relief: hills and valleys for the renderer (tiles/biomes use the base height). Slope-limited so nothing is a wall.
    const relief = new Float32Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const i = y * W + x; const h = height[i]; const land = Math.max(0, Math.min(1, (h - 0.1) / 0.12)); const hill = (nz2.fbm(x / 36 + 7, y / 36 + 3, 3, 2, 0.5) - 0.5) * 0.5 + (nz.fbm(x / 12 + 40, y / 12, 2, 2, 0.5) - 0.5) * 0.08; relief[i] = tiles[i] > T.WATER ? Math.max(0.115, h + hill * land) : h; }
    const MAXD = 0.07; for (let pass = 0; pass < 4; pass++) for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (tiles[i] <= T.WATER) continue; for (const j of [i - 1, i + 1, i - W, i + W]) { if (tiles[j] <= T.WATER) { relief[i] = Math.min(relief[i], 0.115 + MAXD * 1.5); continue; } if (relief[i] - relief[j] > MAXD) relief[i] = relief[j] + MAXD; } }
    // --- main landmass: label connected land (4-neighbours); everything important goes on the largest piece ---
    const comp = new Int32Array(W * W).fill(-1); const compSize = []; { const q = new Int32Array(W * W);
      for (let s0 = 0; s0 < W * W; s0++) { if (comp[s0] >= 0 || tiles[s0] <= T.WATER) continue; const id = compSize.length; let head = 0, tail = 0; q[tail++] = s0; comp[s0] = id; let n = 0;
        while (head < tail) { const i = q[head++]; n++; const x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue; const j = ny * W + nx; if (comp[j] < 0 && tiles[j] > T.WATER) { comp[j] = id; q[tail++] = j; } } }
        compSize.push(n); } }
    let main = 0; compSize.forEach((n, i) => { if (n > compSize[main]) main = i; });
    const onMain = (i) => comp[i] === main;
    // --- spawn point: southmost sand tile of the main landmass near the centre column ---
    let spawn = null;
    for (let y = W - 2; y > 6 && !spawn; y--) {
      for (let ox = 0; ox < W / 2 - 4 && !spawn; ox++) for (const s of [1, -1]) {
        const x = Math.round(cx + ox * s); if (x < 2 || x >= W - 2) continue;
        const i = y * W + x;
        if (tiles[i] === T.SAND && onMain(i) && tiles[i - W] !== T.DEEP && tiles[i - W] !== T.WATER && tiles[i - 2 * W] > T.SAND && onMain(i - 2 * W)) { spawn = { x: x + 0.5, y: y + 0.5 }; break; }
      }
    }
    if (!spawn) spawn = { x: cx, y: cy + 20 };

    // --- objects ---
    const objs = new Map();
    const setObj = (i, t, extra) => objs.set(i, Object.assign({ t, hp: G.OBJS[t].hp }, extra || {}));
    const solidNear = (i) => { for (const j of [i - 1, i + 1, i - W, i + W]) { const o = objs.get(j); if (o && G.OBJS[o.t].solid) return true; } return false; };
    const setNat = (i, t) => { if (G.OBJS[t].solid && solidNear(i)) return; setObj(i, t); }; // natural objects keep a walkable gap between them
    const dToSpawn = (x, y) => G.dist(x, y, spawn.x, spawn.y);
    for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, t = tiles[i], b = biome[i];
      if (dToSpawn(x, y) < 5) continue;
      const r = rng();
      const dens = nz.noise2(x / 9 + 100, y / 9);
      if (t === T.GRASS) {
        if (r < 0.045 + dens * 0.05) setNat(i, 'tree');
        else if (r < 0.10) setNat(i, 'grass_tuft');
        else if (r < 0.115) setNat(i, 'berry_bush');
        else if (r < 0.128) setNat(i, 'wheat');
        else if (r < 0.14) setNat(i, 'rock');
        else if (r < 0.145) setNat(i, 'coal_rock');
        else if (r < 0.15 && dens > 0.5) setNat(i, 'iron_vein');
      } else if (t === T.DARKGRASS) {
        if (r < 0.085 + dens * 0.09) setNat(i, rng() < 0.4 ? 'birch' : 'tree');
        else if (r < 0.25) setNat(i, 'mushroom');
        else if (r < 0.265) setNat(i, 'rock');
        else if (r < 0.275) setNat(i, 'berry_bush');
        else if (r < 0.285) setNat(i, 'iron_vein');
        else if (r < 0.29) setNat(i, 'coal_rock');
      } else if (t === T.DIRT) {
        if (r < 0.08) setNat(i, 'rock'); else if (r < 0.12) setNat(i, 'iron_vein');
      } else if (t === T.STONE) {
        if (r < 0.08) setNat(i, 'rock'); else if (r < 0.14) setNat(i, 'iron_vein'); else if (r < 0.165) setNat(i, 'coal_rock');
        else if (r < 0.185 && b !== G.BIOME.MEADOW) setNat(i, 'gold_vein');
      } else if (t === T.ASH) {
        if (r < 0.05) setNat(i, 'deadtree'); else if (r < 0.10) setNat(i, 'rock'); else if (r < 0.13) setNat(i, 'coal_rock');
        else if (r < 0.15) setNat(i, 'iron_vein');
      } else if (t === T.OBSIDIAN) {
        if (r < 0.05) setNat(i, 'obsidian_vein'); else if (r < 0.09) setNat(i, 'gold_vein'); else if (r < 0.11) setNat(i, 'deadtree');
      } else if (t === T.SAND) {
        if (r < 0.03) setNat(i, 'cactus'); else if (r < 0.035) setNat(i, 'rock');
      }
    }
    // chests: scattered on land, rarity by distance from spawn
    let chests = 0;
    for (let tries = 0; tries < 6000 && chests < 70; tries++) {
      const x = 2 + rng.int(W - 4), y = 2 + rng.int(W - 4), i = y * W + x;
      if (tiles[i] <= T.SAND || tiles[i] === T.LAVA || objs.has(i)) continue;
      const d = dToSpawn(x, y) / (W * 0.5);
      const roll = rng() + d * 0.6;
      const type = roll < 0.75 ? 'chest_c' : roll < 1.05 ? 'chest_u' : roll < 1.3 ? 'chest_r' : 'chest_l';
      setObj(i, type); chests++;
    }
    // altars: deepest interior point of each biome
    const altars = {};
    const altarFor = (b, name) => {
      let best = -1, bi = -1;
      for (let y = 6; y < W - 6; y += 2) for (let x = 6; x < W - 6; x += 2) {
        const i = y * W + x;
        if (biome[i] !== b || tiles[i] <= T.SAND || tiles[i] === T.LAVA || !onMain(i)) continue;
        const score = height[i] + rng() * 0.05 - (b === G.BIOME.MEADOW ? 0 : 0) ;
        if (score > best && dToSpawn(x, y) > 25) { best = score; bi = i; }
      }
      if (bi < 0) return;
      const ax = bi % W, ay = Math.floor(bi / W);
      for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
        const j = (ay + oy) * W + ax + ox; objs.delete(j);
        if (tiles[j] === T.LAVA) tiles[j] = T.OBSIDIAN;
      }
      setObj(bi, name);
      altars[name] = { x: ax + 0.5, y: ay + 0.5 };
    };
    altarFor(G.BIOME.MEADOW, 'altar_meadow'); altarFor(G.BIOME.FOREST, 'altar_forest'); altarFor(G.BIOME.VOLCANO, 'altar_volcano');
    // boat on the beach next to spawn
    const bx = Math.floor(spawn.x) + 3, by = Math.floor(spawn.y);
    const bi = by * W + bx; objs.delete(bi); setObj(bi, 'boat');
    // the Dealer's Table: one by the shipwreck, one beside each altar
    const casinos = [];
    const placeCasino = (cx, cy) => { for (let r = 0; r < 6; r++) for (let k = 0; k < 8; k++) { const x = Math.round(cx + Math.cos(k * 0.785) * (1 + r)), y = Math.round(cy + Math.sin(k * 0.785) * (1 + r)); const j = y * W + x; if (x < 2 || y < 2 || x >= W - 2 || y >= W - 2) continue; if (tiles[j] > T.SAND && tiles[j] !== T.LAVA && !objs.has(j)) { setObj(j, 'casino'); casinos.push({ x: x + 0.5, y: y + 0.5 }); return; } } };
    placeCasino(Math.floor(spawn.x) - 3, by - 3); for (const k in altars) placeCasino(altars[k].x + 4, altars[k].y);
    // starter supplies near spawn
    for (let k = 0; k < 4; k++) { const j = (by - 2 - rng.int(2)) * W + Math.floor(spawn.x) - 3 + k * 2; if (tiles[j] > T.SAND && !objs.has(j)) setObj(j, k < 2 ? 'tree' : 'rock'); }

    // tutorial clearing: a tree, a rock, a berry bush and a coal rock a few steps from the beach so every lesson has its material at hand
    if (opts.tutorial) { const sx = Math.floor(spawn.x); let y0 = Math.floor(spawn.y) - 1; while (y0 > 4 && tiles[y0 * W + sx] <= T.SAND) y0--; // first grass row north of the beach
      for (const [dx, dy, t] of [[-2, -1, 'tree'], [2, -1, 'rock'], [0, -2, 'berry_bush'], [3, -3, 'coal_rock'], [-3, -4, 'tree'], [1, -5, 'rock'], [-1, -3, 'grass_tuft']]) { const x = sx + dx, y = y0 + dy; const j = y * W + x; if (x > 1 && y > 1 && x < W - 2 && y < W - 2 && tiles[j] > T.WATER && tiles[j] !== T.LAVA) { for (const k of [j - 1, j + 1, j - W, j + W]) objs.delete(k); setObj(j, t); } } }
    return { seed: String(seedStr), tiles, biome, height, relief, objs, spawn, boat: { x: bx + 0.5, y: by + 0.5, idx: bi }, altars, casinos, tutorial: !!opts.tutorial, changes: new Map() };
  }
  G.generateWorld = generate;

  // ---- queries ----
  G.idx = (x, y) => (y | 0) * W + (x | 0);
  G.inWorld = (x, y) => x >= 0 && y >= 0 && x < W && y < W;
  G.tileAt = (w, x, y) => G.inWorld(x, y) ? w.tiles[G.idx(x, y)] : T.DEEP;
  G.objAt = (w, x, y) => w.objs.get(G.idx(x, y));

  // Is the tile blocked for a walker? (water needs a floor; solid objects block; doors open for players)
  G.blocked = function (w, x, y, forEnemy) {
    if (!G.inWorld(x, y)) return true;
    const i = G.idx(x, y), t = w.tiles[i], o = w.objs.get(i);
    if (t === T.DEEP) return true;
    if (o) {
      const d = G.OBJS[o.t];
      if (d.door) return forEnemy ? true : !!o.closed;
      if (d.solid) { if (d.colR === undefined || o.stub) return true; const dx = x - (Math.floor(x) + 0.5), dy = y - (Math.floor(y) + 0.5); return dx * dx + dy * dy < d.colR * d.colR; }
    }
    return false;
  };
  G.tileSpeed = function (w, x, y) {
    const i = G.idx(x, y); const t = w.tiles[i]; const o = w.objs.get(i);
    if (o && G.OBJS[o.t].floor) return 1;
    return G.TILE_INFO[t].slow || 1;
  };

  // circle move with axis separation; returns true if fully moved
  G.moveCircle = function (w, e, dx, dy, r, forEnemy) {
    let moved = true;
    const test = (x, y) => {
      for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]])
        if (G.blocked(w, x + ox, y + oy, forEnemy)) return true;
      return false;
    };
    if (dx !== 0) { const nx = e.x + dx; if (!test(nx, e.y)) e.x = nx; else moved = false; }
    if (dy !== 0) { const ny = e.y + dy; if (!test(e.x, ny)) e.y = ny; else moved = false; }
    return moved;
  };

  // apply object change on the world and record it for network delta
  G.setObj = function (w, i, o) {
    if (o) w.objs.set(i, o); else w.objs.delete(i);
    w.changes.set(i, o ? G.clone(o) : null);
    (w.dirty || (w.dirty = [])).push(i);
  };
})(window.G);
