'use strict';
// EMBER DECK — namespace, seeded RNG streams, small helpers. Shared by the browser and the node tests.
(function (root) {
  const ED = root.ED = root.ED || {};

  // ---- seeds ----
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ED.randomSeed = function () {
    let s = '';
    for (let i = 0; i < 7; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return s;
  };
  ED.cleanSeed = function (s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  };
  function hashStr(str) { // xmur3
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  ED.hashStr = hashStr;
  const STREAMS = ['map', 'enc', 'card', 'ev', 'shop', 'pot', 'relic', 'combat', 'misc', 'gold'];
  ED.makeRng = function (seed) {
    const r = {};
    STREAMS.forEach((k, i) => { r[k] = hashStr(seed + ':' + k + ':' + i) | 0; });
    return r;
  };
  // mulberry32 over a state slot held in a plain (serialisable) object
  ED.rand = function (rng, k) {
    let a = rng[k] = (rng[k] + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ED.rint = function (rng, k, lo, hi) { return lo + Math.floor(ED.rand(rng, k) * (hi - lo + 1)); };
  ED.pick = function (rng, k, arr) { return arr[Math.floor(ED.rand(rng, k) * arr.length)]; };
  ED.shuffle = function (rng, k, arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(ED.rand(rng, k) * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };
  ED.weighted = function (rng, k, pairs) { // [[item, weight], ...]
    let tot = 0; for (const p of pairs) tot += p[1];
    let r = ED.rand(rng, k) * tot;
    for (const p of pairs) { r -= p[1]; if (r < 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };
  ED.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  ED.clone = (o) => JSON.parse(JSON.stringify(o));
})(typeof window !== 'undefined' ? window : globalThis);
