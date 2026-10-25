'use strict';
// HIGH CARD — seeded RNG. Every random stream lives inside the run state so a saved run
// replays identically after reload (no save-scumming) and a shown seed reproduces a run.
(function (G) {
  const HC = G.HC = G.HC || {};
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  // mulberry32 step on st[k]; returns [0,1)
  function next(st, k) {
    let a = (st[k] + 0x6D2B79F5) >>> 0; st[k] = a;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randomSeed() {
    let s = '';
    for (let i = 0; i < 8; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    return s;
  }
  function cleanSeed(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
  const STREAMS = ['deck', 'shop', 'luck', 'boss', 'pack', 'misc'];
  function streams(seed) {
    const o = {};
    for (const k of STREAMS) o[k] = hash(seed + '/' + k);
    return o;
  }
  HC.RNG = { hash, next, randomSeed, cleanSeed, streams };
})(typeof window !== 'undefined' ? window : globalThis);
