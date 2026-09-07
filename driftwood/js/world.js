// DRIFTWOOD — procedural island generation + world queries
(function (G) {
  'use strict';
  const T = G.T, W = G.WORLD;

  // Island archetypes give every seed a different silhouette; rivers, gravel banks and snow caps break up the interior; ores come as
  // big rare clusters. Casino mode builds a small neon plaza instead; bastion mode fortifies the landing beach.
  const ARCHES = ['classic', 'classic', 'crescent', 'twin', 'caldera', 'archipelago'];
  function generate(seedStr, opts) {
    opts = opts || {};
    const mode = opts.mode || 'survival';
    const seed = G.hashStr(String(seedStr));
    const rng = G.RNG(seed);
    const nz = G.makeNoise(seed ^ 0x9e3779b9);
    const nz2 = G.makeNoise(seed ^ 0x51ed270b);
    const tiles = new Uint8Array(W * W);
    const biome = new Uint8Array(W * W);
    const height = new Float32Array(W * W);
    const cx = W / 2, cy = W / 2;
    const arch = mode === 'casino' ? 'plaza' : (opts.arch || ARCHES[rng.int(ARCHES.length)]);
    const islets = []; if (arch === 'archipelago') { const n = 4 + rng.int(3); for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + rng() * 0.8, dd = 0.6 + rng() * 0.2; islets.push({ x: Math.cos(a) * dd, y: Math.sin(a) * dd, r: 0.11 + rng() * 0.08 }); } }
    const twinA = { x: -0.34, y: 0.06 }, twinB = { x: 0.34, y: -0.06 };

    // --- height & tiles ---
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / (W * 0.5), dy = (y - cy) / (W * 0.5);
      const d = Math.sqrt(dx * dx + dy * dy);
      const n = nz.fbm(x / 28, y / 28, 4, 2.1, 0.5);      // 0..1
      const shape = nz2.fbm(x / 60, y / 60, 2, 2, 0.5);  // coastline wobble
      let h;
      if (arch === 'plaza') h = 0.34 - d * d * 1.9 + (n - 0.5) * 0.02;
      else if (arch === 'twin') {
        const d1 = Math.hypot(dx - twinA.x, dy - twinA.y) / 0.66, d2 = Math.hypot(dx - twinB.x, dy - twinB.y) / 0.66; const dm = Math.min(d1, d2);
        h = n * 0.7 + 0.3 - dm * dm * (1.05 + shape * 0.4);
        // a sandbar joins the two lobes so the island stays one walkable piece
        const t = Math.max(0, Math.min(1, ((dx - twinA.x) * (twinB.x - twinA.x) + (dy - twinA.y) * (twinB.y - twinA.y)) / ((twinB.x - twinA.x) ** 2 + (twinB.y - twinA.y) ** 2)));
        const sx = twinA.x + (twinB.x - twinA.x) * t, sy = twinA.y + (twinB.y - twinA.y) * t; const ds = Math.hypot(dx - sx, dy - sy);
        if (ds < 0.09) h = Math.max(h, 0.085 - ds * 0.3 + (n - 0.5) * 0.02);
      } else {
        h = n * 0.75 + 0.25 - d * d * (arch === 'archipelago' ? 1.7 + shape * 0.5 : 1.05 + shape * 0.5);
        if (arch === 'crescent') { const bx = dx - 0.4, by = dy + 0.12; h -= Math.exp(-(bx * bx + by * by) / 0.11) * 0.62; }
        if (arch === 'caldera') { h -= Math.exp(-(d * d) / 0.055) * 0.8; h += Math.exp(-((d - 0.36) ** 2) / 0.012) * 0.22; }
        if (arch === 'archipelago') for (const il of islets) { const dd = Math.hypot(dx - il.x, dy - il.y) / il.r; h = Math.max(h, 0.3 - dd * dd * 0.34 + (n - 0.5) * 0.12); }
      }
      height[y * W + x] = h;
    }
    // biome: three sectors by angle from center, warped by noise (the plaza is all meadow)
    const spawnAngle = Math.PI / 2; // spawn on south side
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (arch === 'plaza') { biome[i] = G.BIOME.MEADOW; continue; }
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
      else if (arch === 'plaza') t = T.GRASS;
      else {
        const det = nz2.fbm(x / 5.3 + 31, y / 4.7 + 17, 2, 2.3, 0.5);
        if (b === G.BIOME.MEADOW) t = h > 0.7 ? T.SNOW : h > 0.55 ? T.STONE : (det > 0.78 ? T.DIRT : T.GRASS);
        else if (b === G.BIOME.FOREST) t = h > 0.72 ? T.SNOW : h > 0.58 ? T.STONE : (det > 0.82 ? T.DIRT : T.DARKGRASS);
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
    const dToSpawn = (x, y) => G.dist(x, y, spawn.x, spawn.y);

    // --- rivers: from a high interior point downhill to the sea, carving a valley of shallow water with gravel banks. A river that
    // runs out of downhill ends in a pond. The landing beach stays dry.
    const rivers = [];
    if (arch !== 'plaza') {
      const nRivers = 1 + rng.int(3);
      for (let r = 0; r < nRivers; r++) {
        let src = -1; for (let tries = 0; tries < 300 && src < 0; tries++) { const x = 8 + rng.int(W - 16), y = 8 + rng.int(W - 16), i = y * W + x; if (tiles[i] > T.SAND && tiles[i] !== T.LAVA && onMain(i) && height[i] > 0.45 && dToSpawn(x, y) > 30) src = i; }
        if (src < 0) continue;
        let i = src; const path = []; const seen = new Set();
        for (let step = 0; step < 600; step++) {
          path.push(i); seen.add(i);
          const x = i % W, y = (i - x) / W;
          if (tiles[i] <= T.WATER && step > 0) break; // reached the sea (or another river)
          let best = -1, bh = Infinity;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { if (!ox && !oy) continue; const nx = x + ox, ny = y + oy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= W - 1) continue; const j = ny * W + nx; if (seen.has(j)) continue; const hh = height[j] + (nz2.noise2(nx / 3 + 50, ny / 3) - 0.5) * 0.04 + (ox && oy ? 0.006 : 0); if (hh < bh) { bh = hh; best = j; } }
          if (best < 0 || (bh > height[i] + 0.012 && tiles[best] > T.WATER)) { // stuck in a hollow: leave a pond
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const j = (y + oy) * W + x + ox; if (tiles[j] > T.SAND && tiles[j] !== T.LAVA && dToSpawn(x + ox, y + oy) > 9) path.push(j); }
            break;
          }
          i = best;
        }
        if (path.length < 12) continue;
        rivers.push(path.length);
        for (let k = 0; k < path.length; k++) {
          const j = path[k]; const x = j % W, y = (j - x) / W; if (dToSpawn(x, y) < 9 || tiles[j] === T.LAVA) continue;
          if (tiles[j] > T.WATER) { tiles[j] = T.WATER; height[j] = Math.min(height[j], 0.03); }
          if (k > 6 && k % 2 === 0) { const side = ((k >> 1) & 1) ? j + 1 : j + W; if (tiles[side] > T.SAND && tiles[side] !== T.LAVA && dToSpawn(side % W, Math.floor(side / W)) > 9) { tiles[side] = T.WATER; height[side] = Math.min(height[side], 0.03); } } // widen downstream
        }
        for (const j of path) for (const nb of [j - 1, j + 1, j - W, j + W]) { if (nb < W || nb >= W * W - W) continue; if (tiles[nb] > T.SAND && tiles[nb] !== T.LAVA && tiles[nb] !== T.SNOW && rng() < 0.6) tiles[nb] = T.GRAVEL; }
      }
    }

    // --- relief: hills and valleys for the renderer (tiles/biomes use the base height). Slope-limited so nothing is a wall.
    const relief = new Float32Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const i = y * W + x; const h = height[i]; const land = Math.max(0, Math.min(1, (h - 0.1) / 0.12)); const hill = (nz2.fbm(x / 36 + 7, y / 36 + 3, 3, 2, 0.5) - 0.5) * (arch === 'plaza' ? 0.08 : 0.5) + (nz.fbm(x / 12 + 40, y / 12, 2, 2, 0.5) - 0.5) * 0.08; relief[i] = tiles[i] > T.WATER ? Math.max(0.115, h + hill * land) : h; }
    const MAXD = 0.07; for (let pass = 0; pass < 4; pass++) for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (tiles[i] <= T.WATER) continue; for (const j of [i - 1, i + 1, i - W, i + W]) { if (tiles[j] <= T.WATER) { relief[i] = Math.min(relief[i], 0.115 + MAXD * 1.5); continue; } if (relief[i] > relief[j] + MAXD) relief[i] = relief[j] + MAXD; } }

    // --- objects ---
    const objs = new Map();
    const setObj = (i, t, extra) => objs.set(i, Object.assign({ t, hp: G.OBJS[t].hp }, extra || {}));
    const solidNear = (i) => { for (const j of [i - 1, i + 1, i - W, i + W]) { const o = objs.get(j); if (o && G.OBJS[o.t].solid) return true; } return false; };
    const setNat = (i, t) => { if (G.OBJS[t].solid && solidNear(i)) return; setObj(i, t); }; // natural objects keep a walkable gap between them
    const landFor = (t) => t > T.SAND && t !== T.LAVA;
    if (arch !== 'plaza') {
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
        } else if (t === T.DARKGRASS) {
          if (r < 0.085 + dens * 0.09) setNat(i, rng() < 0.4 ? 'birch' : 'tree');
          else if (r < 0.25) setNat(i, 'mushroom');
          else if (r < 0.265) setNat(i, 'rock');
          else if (r < 0.275) setNat(i, 'berry_bush');
        } else if (t === T.DIRT) {
          if (r < 0.08) setNat(i, 'rock');
        } else if (t === T.STONE) {
          if (r < 0.08) setNat(i, 'rock');
        } else if (t === T.SNOW) {
          if (r < 0.06) setNat(i, 'rock');
        } else if (t === T.GRAVEL) {
          if (r < 0.05) setNat(i, 'rock'); else if (r < 0.07) setNat(i, 'grass_tuft');
        } else if (t === T.ASH) {
          if (r < 0.05) setNat(i, 'deadtree'); else if (r < 0.10) setNat(i, 'rock');
        } else if (t === T.OBSIDIAN) {
          if (r < 0.03) setNat(i, 'deadtree');
        } else if (t === T.SAND) {
          if (r < 0.03) setNat(i, 'cactus'); else if (r < 0.035) setNat(i, 'rock');
        }
      }
      // ore deposits: rare seeds that grow into clusters of 2-6 rocks of the same ore (the seed rock is the big one)
      const ORE = [
        // [tile, ore, seed chance, min size, extra size, biome filter]
        [T.GRASS, 'coal_rock', 0.0016, 3, 3], [T.GRASS, 'iron_vein', 0.0012, 3, 2],
        [T.DARKGRASS, 'iron_vein', 0.0024, 3, 3], [T.DARKGRASS, 'coal_rock', 0.0014, 3, 2],
        [T.DIRT, 'iron_vein', 0.010, 3, 3],
        [T.STONE, 'iron_vein', 0.011, 3, 3], [T.STONE, 'coal_rock', 0.006, 3, 3], [T.STONE, 'gold_vein', 0.005, 2, 3, (b) => b !== G.BIOME.MEADOW],
        [T.SNOW, 'gold_vein', 0.008, 2, 2], [T.GRAVEL, 'iron_vein', 0.006, 2, 3],
        [T.ASH, 'coal_rock', 0.008, 3, 3], [T.ASH, 'iron_vein', 0.005, 3, 2],
        [T.OBSIDIAN, 'obsidian_vein', 0.012, 2, 2], [T.OBSIDIAN, 'gold_vein', 0.009, 2, 3],
      ];
      for (let y = 2; y < W - 2; y++) for (let x = 2; x < W - 2; x++) {
        const i = y * W + x, t = tiles[i]; if (objs.has(i) || dToSpawn(x, y) < 10) continue;
        const r = rng(); let acc = 0;
        for (const [tt, ore, p, mn, ex, filt] of ORE) { if (tt !== t) continue; if (filt && !filt(biome[i])) continue; acc += p; if (r < acc) {
          for (const j of [i - 1, i + 1, i - W, i + W]) objs.delete(j); // a little clearing around the deposit
          setObj(i, ore, { big: true }); let size = mn + rng.int(ex + 1), cur = i; const cells = [i];
          for (let k = 0; k < size * 3 && cells.length < size; k++) { const from = cells[rng.int(cells.length)]; const cand = [from - 1, from + 1, from - W, from + W][rng.int(4)]; const cx2 = cand % W, cy2 = Math.floor(cand / W); if (cx2 < 1 || cy2 < 1 || cx2 >= W - 1 || cy2 >= W - 1) continue; if (objs.has(cand) || !landFor(tiles[cand]) || tiles[cand] <= T.SAND) continue; setObj(cand, ore); cells.push(cand); }
          break; } }
      }
    }
    // chests: scattered on land, rarity by distance from spawn
    let chests = 0;
    if (arch !== 'plaza') for (let tries = 0; tries < 6000 && chests < 70; tries++) {
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
        const score = height[i] + rng() * 0.05;
        if (score > best && dToSpawn(x, y) > 25) { best = score; bi = i; }
      }
      if (bi < 0) return;
      const ax = bi % W, ay = Math.floor(bi / W);
      for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
        const j = (ay + oy) * W + ax + ox; objs.delete(j);
        if (tiles[j] === T.LAVA) tiles[j] = T.OBSIDIAN; if (tiles[j] <= T.WATER) tiles[j] = T.GRAVEL; // an altar never stands in a river
      }
      setObj(bi, name);
      altars[name] = { x: ax + 0.5, y: ay + 0.5 };
    };
    if (arch !== 'plaza') { altarFor(G.BIOME.MEADOW, 'altar_meadow'); altarFor(G.BIOME.FOREST, 'altar_forest'); altarFor(G.BIOME.VOLCANO, 'altar_volcano'); }
    // boat on the beach next to spawn
    const bx = Math.floor(spawn.x) + 3, by = Math.floor(spawn.y);
    const bi = by * W + bx; objs.delete(bi); setObj(bi, 'boat');
    // the Dealer's Table: one by the shipwreck, one beside each altar
    const casinos = [];
    const placeCasino = (cx, cy) => { for (let r = 0; r < 6; r++) for (let k = 0; k < 8; k++) { const x = Math.round(cx + Math.cos(k * 0.785) * (1 + r)), y = Math.round(cy + Math.sin(k * 0.785) * (1 + r)); const j = y * W + x; if (x < 2 || y < 2 || x >= W - 2 || y >= W - 2) continue; if (tiles[j] > T.SAND && tiles[j] !== T.LAVA && !objs.has(j)) { setObj(j, 'casino'); for (const nb of [j - 1, j + 1, j - W, j + W]) if (objs.has(nb) && G.OBJS[objs.get(nb).t].solid) objs.delete(nb); casinos.push({ x: x + .5, y: y + .5 }); return; } } };
    let plaza = null;
    if (arch === 'plaza') {
      // the Gamble With Friends plaza: tables in a ring around a fire, torches around them, the odd tree beyond
      const px = Math.floor(cx), py = Math.floor(cy); plaza = { x: px + .5, y: py + .5 };
      spawn = { x: px + .5, y: py + 4.5 };
      setObj(py * W + px, 'campfire');
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; const x = Math.round(px + Math.cos(a) * 6), y = Math.round(py + Math.sin(a) * 6); const j = y * W + x; if (tiles[j] > T.SAND) { setObj(j, 'casino'); casinos.push({ x: x + .5, y: y + .5 }); } }
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const x = Math.round(px + Math.cos(a) * 10), y = Math.round(py + Math.sin(a) * 10); const j = y * W + x; if (tiles[j] > T.SAND && !objs.has(j)) setObj(j, 'torch'); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.3; const x = Math.round(px + Math.cos(a) * 3.2), y = Math.round(py + Math.sin(a) * 3.2); const j = y * W + x; if (tiles[j] > T.SAND && !objs.has(j)) setObj(j, k % 2 ? 'torch' : 'chest_c'); }
      for (let y = 1; y < W - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (tiles[i] !== T.GRASS || objs.has(i)) continue; const dd = Math.hypot(x - px, y - py); if (dd > 13 && rng() < 0.08) setNat(i, rng() < 0.7 ? 'tree' : 'rock'); else if (dd > 11 && rng() < 0.05) setNat(i, 'grass_tuft'); }
    } else {
      placeCasino(Math.floor(spawn.x) - 3, by - 3); for (const k in altars) placeCasino(altars[k].x + 4, altars[k].y);
      // starter supplies near spawn
      for (let k = 0; k < 4; k++) { const j = (by - 2 - rng.int(2)) * W + Math.floor(spawn.x) - 3 + k * 2; if (tiles[j] > T.SAND && !objs.has(j)) setObj(j, k < 2 ? 'tree' : 'rock'); }
    }
    // the fishmonger stands by the wreck on every island; in bastion mode the beach is fortified
    let bastion = null;
    if (arch !== 'plaza') {
      let fx = -1, fy = -1; // the nearest land tile a few steps west of the wreck, falling back to anywhere near the beach
      outer: for (let dy = 1; dy <= 10 && fx < 0; dy++) for (const ox of [-5, -6, -4, -7, 6, 7, -8, 8]) { const x = Math.floor(spawn.x) + ox, y = by - dy; if (x < 2 || x >= W - 2 || y < 2) continue; const j = y * W + x; const o = objs.get(j); if (tiles[j] > T.SAND && tiles[j] !== T.LAVA && !(o && (G.OBJS[o.t].casino || G.OBJS[o.t].boat))) { fx = x; fy = y; break outer; } }
      if (fx >= 0) { objs.delete(fy * W + fx); setObj(fy * W + fx, 'fishmonger'); for (const nb of [fy * W + fx - 1, fy * W + fx + 1, (fy + 1) * W + fx]) if (objs.has(nb) && G.OBJS[objs.get(nb).t].solid && !G.OBJS[objs.get(nb).t].casino) objs.delete(nb); }
      if (mode === 'bastion') {
        const bcx = Math.floor(spawn.x), bcy = Math.floor(spawn.y) - 7, R = 5; bastion = { x: bcx + .5, y: bcy + .5 };
        for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
          const x = bcx + ox, y = bcy + oy; if (x < 1 || y < 1 || x >= W - 1 || y >= W - 1) continue; const j = y * W + x;
          if (tiles[j] <= T.WATER) tiles[j] = T.SAND; if (tiles[j] === T.LAVA) tiles[j] = T.ASH; objs.delete(j);
          const edge = Math.abs(ox) === R || Math.abs(oy) === R;
          if (edge) { if (oy === -R && ox === 0) setObj(j, 'door_wood', { closed: true }); else if (oy === R && ox === 0) setObj(j, 'door_wood', { closed: true }); else setObj(j, 'wall_stone'); }
        }
        setObj(bcy * W + bcx, 'campfire'); setObj(bcy * W + bcx - 2, 'workbench'); setObj(bcy * W + bcx + 2, 'storage', { inv: new Array(18).fill(null) });
        setObj((bcy - 2) * W + bcx, 'fishmonger'); setObj((bcy + 2) * W + bcx - 1, 'furnace'); setObj((bcy + 2) * W + bcx + 1, 'anvil');
        for (const [ox, oy] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) setObj((bcy + oy) * W + bcx + ox, 'torch');
        if (fx >= 0) objs.delete(fy * W + fx); // the stall inside the walls replaces the one on the beach
        // a dock: planks from the beach out over the water
        const dx0 = Math.floor(spawn.x) - 1; let dy0 = Math.floor(spawn.y) + 1; for (let k = 0; k < 7; k++) { const j = (dy0 + k) * W + dx0; if (dy0 + k >= W - 1) break; if (tiles[j] === T.DEEP && k > 3) break; if (tiles[j] <= T.WATER) { objs.delete(j); setObj(j, 'floor_wood'); if (k === 6 || tiles[j + W] === T.DEEP) break; } }
      }
    }

    // tutorial clearing: a tree, a rock, a berry bush and a coal rock a few steps from the beach so every lesson has its material at hand
    if (opts.tutorial) { const sx = Math.floor(spawn.x); let y0 = Math.floor(spawn.y) - 1; while (y0 > 4 && tiles[y0 * W + sx] <= T.SAND) y0--; // first grass row north of the beach
      for (const [dx, dy, t] of [[-2, -1, 'tree'], [2, -1, 'rock'], [0, -2, 'berry_bush'], [3, -3, 'coal_rock'], [-3, -4, 'tree'], [1, -5, 'rock'], [-1, -3, 'grass_tuft']]) { const x = sx + dx, y = y0 + dy; const j = y * W + x; if (x > 1 && y > 1 && x < W - 2 && y < W - 2 && tiles[j] > T.WATER && tiles[j] !== T.LAVA) { for (const k of [j - 1, j + 1, j - W, j + W]) objs.delete(k); if (tiles[j] <= T.SAND) tiles[j] = T.GRASS; setObj(j, t); } } }
    return { seed: String(seedStr), arch, mode, tiles, biome, height, relief, objs, spawn, boat: { x: bx + 0.5, y: by + 0.5, idx: bi }, altars, casinos, plaza, bastion, rivers: rivers.length, tutorial: !!opts.tutorial, changes: new Map() };
  }
  G.generateWorld = generate;

  // ---- queries ----
  G.idx = (x, y) => (y | 0) * W + (x | 0);
  G.inWorld = (x, y) => x >= 0 && y >= 0 && x < W && y < W;
  G.tileAt = (w, x, y) => G.inWorld(x, y) ? w.tiles[G.idx(x, y)] : T.DEEP;
  G.objAt = (w, x, y) => w.objs.get(G.idx(x, y));

  // Is the tile blocked for a walker? (water needs a floor; solid objects block; doors open for players)
  G.blocked = function (w, x, y, forEnemy, skipRound) {
    if (!G.inWorld(x, y)) return true;
    const i = G.idx(x, y), t = w.tiles[i], o = w.objs.get(i);
    if (t === T.DEEP) return true;
    if (o) {
      const d = G.OBJS[o.t];
      if (d.door) return forEnemy ? true : !!o.closed;
      if (d.solid) { if (d.colR === undefined || o.stub) return true; if (skipRound) return false; const dx = x - (Math.floor(x) + 0.5), dy = y - (Math.floor(y) + 0.5); return dx * dx + dy * dy < d.colR * d.colR; }
    }
    return false;
  };
  G.tileSpeed = function (w, x, y) {
    const i = G.idx(x, y); const t = w.tiles[i]; const o = w.objs.get(i);
    if (o && G.OBJS[o.t].floor) return 1;
    return G.TILE_INFO[t].slow || 1;
  };

  // circle move with axis separation; returns true if fully moved
  const OFF = [-1, -1, 1, -1, -1, 1, 1, 1, 0, -1, 0, 1, -1, 0, 1, 0];
  G.moveCircle = function (w, e, dx, dy, r, forEnemy) {
    let moved = true;
    // tile blockers (water, walls, doors) are sampled around the circle; round colliders (trees, rocks) are handled analytically below so you slide around them instead of catching on sample points
    const test = (x, y) => { for (let k = 0; k < 16; k += 2) if (G.blocked(w, x + OFF[k] * r, y + OFF[k + 1] * r, forEnemy, true)) return true; return false; };
    if (dx !== 0) { const nx = e.x + dx; if (!test(nx, e.y)) e.x = nx; else moved = false; }
    if (dy !== 0) { const ny = e.y + dy; if (!test(e.x, ny)) e.y = ny; else moved = false; }
    for (let pass = 0; pass < 2; pass++) { const tx0 = Math.floor(e.x), ty0 = Math.floor(e.y); let pushed = false;
      for (let ty = ty0 - 1; ty <= ty0 + 1; ty++) for (let tx = tx0 - 1; tx <= tx0 + 1; tx++) { if (tx < 0 || ty < 0 || tx >= G.WORLD || ty >= G.WORLD) continue; const o = w.objs.get(ty * G.WORLD + tx); if (!o || o.stub) continue; const d = G.OBJS[o.t]; if (!d.solid || d.colR === undefined || d.door) continue;
        const cx = tx + 0.5, cy = ty + 0.5; let ddx = e.x - cx, ddy = e.y - cy; let dist = Math.hypot(ddx, ddy); const min = r + d.colR; if (dist >= min) continue; if (dist < 1e-4) { ddx = 1; ddy = 0; dist = 1; } const px = ddx / dist * (min - dist), py = ddy / dist * (min - dist);
        if (!test(e.x + px, e.y + py)) { e.x += px; e.y += py; } else moved = false; pushed = true; }
      if (!pushed) break; }
    return moved;
  };

  // apply object change on the world and record it for network delta
  // Storage chests placed within two tiles of each other form one linked store: stowing routes an item to whichever chest already
  // holds that kind, and the sort action groups everything across the whole network. Returns the indices, the requested one first.
  G.chestNetwork = function (w, i) {
    const W = G.WORLD, out = [i], seen = new Set([i]); const isChest = (j) => { const o = w.objs.get(j); return !!(o && G.OBJS[o.t] && G.OBJS[o.t].storage && o.inv); };
    if (!isChest(i)) return out;
    for (let k = 0; k < out.length && out.length < 12; k++) {
      const cx = out[k] % W, cy = Math.floor(out[k] / W);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { if (!dx && !dy) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= W) continue; const j = y * W + x; if (!seen.has(j) && isChest(j)) { seen.add(j); out.push(j); } }
    }
    return out;
  };
  G.setObj = function (w, i, o) {
    if (o) w.objs.set(i, o); else w.objs.delete(i); w.objVer = (w.objVer || 0) + 1;
    w.changes.set(i, o ? G.clone(o) : null);
    (w.dirty || (w.dirty = [])).push(i);
  };
})(window.G);
