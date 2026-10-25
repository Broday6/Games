// Sync: when Daybook runs inside Claude (the published artifact), every part of your data is mirrored to the
// artifact's private database. It follows you between phone and computer, and Claude can read and update it
// from a conversation. Outside Claude (GitHub Pages, a downloaded copy) this does nothing and the browser
// copy is the only one.
//
// Layout: collection `daybook`, one document per top-level key ({v: value}); long histories are split by
// year (`workouts.2026`) to stay well under the 256 KiB document limit. `meta` holds the small flags.
import { bus, toast } from './util.js';
import { S, save, hooks } from './store.js';

const LOCAL_ONLY = new Set(['ui']);
const META = ['v', 'created', 'welcomed', 'sample'];
const isoOf = ts => { const d = new Date(ts); return `${d.getFullYear()}`; };
const SERIES = { workouts: x => String(x.date).slice(0, 4), checkins: x => String(x.date).slice(0, 4), time: x => isoOf(x.start), expenses: x => String(x.date).slice(0, 4), invoices: x => String(x.date).slice(0, 4), food: x => String(x.date).slice(0, 4), cardio: x => String(x.date).slice(0, 4) };

export const status = { state: 'off', at: 0, error: '' };
let col = null, ready = false, pushing = false, again = false, timer = 0;
const written = new Map(); // document id -> JSON last known to be in the store

function wanted() {
  const docs = new Map();
  docs.set('meta', { v: Object.fromEntries(META.map(k => [k, S[k] ?? null])) });
  for (const [k, val] of Object.entries(S)) {
    if (LOCAL_ONLY.has(k) || META.includes(k)) continue;
    if (SERIES[k] && Array.isArray(val)) {
      const by = {};
      for (const x of val) (by[SERIES[k](x)] = by[SERIES[k](x)] || []).push(x);
      for (const [y, items] of Object.entries(by)) docs.set(`${k}.${y}`, { v: items });
      if (!val.length) docs.set(`${k}.empty`, { v: [] });
    } else docs.set(k, { v: val ?? null });
  }
  return docs;
}

// Rebuild state from the store's documents, leaving alone any key with local edits not yet sent.
function apply(docs) {
  const local = wanted();
  const keys = new Set([...docs.keys()].map(id => id.split('.')[0]));
  let changed = false;
  for (const key of keys) {
    const ids = [...docs.keys()].filter(id => id === key || id.startsWith(key + '.'));
    const dirty = [...local.keys()].filter(id => id === key || id.startsWith(key + '.')).some(id => written.has(id) && JSON.stringify(local.get(id)) !== written.get(id));
    for (const id of ids) written.set(id, JSON.stringify(docs.get(id)));
    if (dirty) continue;
    if (key === 'meta') {
      const m = docs.get('meta').v || {};
      for (const k of META) if (m[k] !== undefined && m[k] !== S[k]) { S[k] = m[k]; changed = true; }
      continue;
    }
    const val = SERIES[key] ? ids.sort().flatMap(id => docs.get(id).v || []) : docs.get(key).v;
    if (JSON.stringify(S[key]) !== JSON.stringify(val)) { S[key] = val; changed = true; }
  }
  if (changed) { save({ quiet: true }); bus.render(); }
}

async function push() {
  if (!ready || !col) return;
  if (pushing) { again = true; return; }
  pushing = true;
  try {
    const want = wanted();
    for (const [id, data] of want) {
      const j = JSON.stringify(data);
      if (written.get(id) === j) continue;
      if (j.length > 250000) throw { code: 'too_large', message: id };
      await col.doc(id).set(data);
      written.set(id, j);
    }
    for (const id of [...written.keys()]) if (!want.has(id) && id.includes('.')) { await col.doc(id).delete(); written.delete(id); }
    status.state = 'on'; status.at = Date.now(); status.error = '';
  } catch (e) {
    status.error = e?.code || 'error';
    if (e?.code === 'revoked' || e?.code === 'not_granted') status.state = 'off';
    if (!push.warned) { push.warned = true; toast(e?.code === 'too_large' ? 'One part of your data is too big to sync. Export a backup from More.' : e?.code === 'quota_exceeded' ? 'Sync storage is full. Export a backup from More.' : 'Could not sync just now. Your changes are safe on this device.', { kind: 'bad' }); }
  }
  pushing = false;
  if (again) { again = false; push(); }
}

export async function startSync() {
  if (!window.claude?.use) return;
  const db = await window.claude.use('db').catch(() => null);
  if (!db) return;
  status.state = 'connecting';
  col = db.collection('daybook');
  let first = true;
  hooks.afterSave = () => { if (!ready) return; clearTimeout(timer); timer = setTimeout(push, 700); };
  col.onSnapshot(snap => {
    if (first && snap.metadata.fromCache) return; // wait for the store's answer before deciding anything
    const docs = new Map(snap.docs.filter(d => d.exists).map(d => [d.id, d.data()]));
    if (first) {
      first = false;
      // An empty store takes this device's data; otherwise the store wins and this device catches up.
      if (docs.has('meta')) apply(docs);
      ready = true; status.state = 'on'; status.at = Date.now();
      push();
      bus.render();
      return;
    }
    apply(docs);
  }, e => { status.state = 'off'; status.error = e?.code || 'error'; bus.render(); });
}
