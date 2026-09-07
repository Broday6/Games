// DRIFTWOOD — shared utilities (global namespace G)
window.G = window.G || {};
(function (G) {
  'use strict';

  // ---- seeded RNG (mulberry32) ----
  function RNG(seed) {
    let a = (seed >>> 0) || 1;
    const r = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (n) => Math.floor(r() * n);
    r.range = (a, b) => a + r() * (b - a);
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  }
  G.RNG = RNG;

  G.hashStr = function (s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };

  // ---- value noise ----
  function makeNoise(seed) {
    const r = RNG(seed);
    const N = 256, perm = new Uint8Array(N * 2), grad = new Float32Array(N);
    for (let i = 0; i < N; i++) { perm[i] = i; grad[i] = r(); }
    for (let i = N - 1; i > 0; i--) { const j = r.int(i + 1); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < N; i++) perm[i + N] = perm[i];
    const val = (ix, iy) => grad[perm[(ix & 255) + perm[iy & 255]]];
    const fade = (t) => t * t * (3 - 2 * t);
    function noise2(x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0);
      const a = val(x0, y0), b = val(x0 + 1, y0), c = val(x0, y0 + 1), d = val(x0 + 1, y0 + 1);
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
    function fbm(x, y, oct, lac, gain) {
      let amp = 1, f = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) { sum += amp * noise2(x * f, y * f); norm += amp; amp *= gain; f *= lac; }
      return sum / norm;
    }
    return { noise2, fbm };
  }
  G.makeNoise = makeNoise;

  // ---- math ----
  G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  G.angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  G.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  G.rnd = (a, b) => a + Math.random() * (b - a);
  G.fmtTime = (s) => { s = Math.floor(s); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
  G.now = () => performance.now() / 1000;

  let _id = 1;
  G.uid = () => _id++;

  // deep-ish copy for snapshots
  G.clone = (o) => JSON.parse(JSON.stringify(o));
})(window.G);
