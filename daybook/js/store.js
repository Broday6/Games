// App state: one JSON document in localStorage, plus backup import/export.
import { bus, uid, setCurrency, toast } from './util.js';
import { EXERCISES, TEMPLATES, HABITS } from './seed.js';

const KEY = 'daybook.v1';
export const S = {};
export const storage = { ok: true, warned: false };

export const DEFAULT_SETTINGS = {
  name: '', biz: '', bizAddr: '', bizEmail: '', bizPhone: '', currency: 'USD',
  rate: '75', mileRate: '0.70', taxPct: '25', markupPct: '0', terms: '14', nextInv: 1001,
  invNote: 'Thank you for your business.', payNote: '',
  units: 'lb', bar: '45', plates: '45, 35, 25, 10, 5, 2.5', rest: '120', setTarget: '12', age: '',
  checkins: 'on', amTime: '07:00', pmTime: '20:30', reviewDay: '0',
};

export function fresh() {
  return {
    v: 1, created: Date.now(), welcomed: false, sample: false,
    settings: { ...DEFAULT_SETTINGS },
    clients: [], jobs: [], events: [], time: [], timer: null, expenses: [], invoices: [],
    tasks: [], checkins: [], goals: [], habits: HABITS.map(name => ({ id: uid() + name.length, name })), habitLog: {},
    exercises: EXERCISES.map(e => ({ ...e })), templates: TEMPLATES.map(t => ({ ...t, items: t.items.map(i => ({ ...i })) })),
    workouts: [], active: null, body: [], ui: {},
  };
}

function migrate(d) {
  const base = fresh();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  d.settings = { ...DEFAULT_SETTINGS, ...d.settings };
  // New library exercises added in later versions show up without touching custom ones.
  for (const e of EXERCISES) if (!d.exercises.some(x => x.id === e.id)) d.exercises.push({ ...e });
  return d;
}

export function replaceState(next) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, migrate(next));
  setCurrency(S.settings.currency);
}

export function load() {
  let data = null;
  try { const raw = localStorage.getItem(KEY); if (raw) data = JSON.parse(raw); }
  catch { storage.ok = false; }
  replaceState(data || fresh());
  try { navigator.storage?.persist?.(); } catch { /* optional */ }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storage.ok = true; }
  catch {
    storage.ok = false;
    if (!storage.warned) { storage.warned = true; toast('Changes are not being saved in this browser. Export a backup from More.', { kind: 'bad', ms: 8000 }); }
  }
}

export function commit() { save(); bus.render(); }

// Run a destructive change with a one-tap undo instead of a confirmation prompt.
export function undoable(label, fn) {
  const snap = JSON.stringify(S);
  fn();
  commit();
  toast(label, { action: { label: 'Undo', fn: () => { replaceState(JSON.parse(snap)); commit(); } } });
}

export const byId = (list, id) => list.find(x => x.id === id);
export const job = id => byId(S.jobs, id);
export const client = id => byId(S.clients, id);
export const exercise = id => byId(S.exercises, id);
export const set = k => S.settings[k];

export function exportJSON() { return JSON.stringify({ app: 'daybook', exported: new Date().toISOString(), data: S }, null, 1); }
export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed?.app === 'daybook' ? parsed.data : parsed;
  if (!data || !Array.isArray(data.jobs) || !Array.isArray(data.workouts)) throw new Error('That file is not a Daybook backup.');
  replaceState(data);
  commit();
}
