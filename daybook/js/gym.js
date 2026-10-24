// Gym: workout logger with progression suggestions, PR detection, rest timer, heart-rate strap (Web Bluetooth),
// voice logging (speech recognition), screen wake lock, history, progress charts and plate/1RM/warm-up tools.
import {
  $, $$, esc, uid, num, sum, round2, acts, chg, icon, toast, sheet, formSheet, confirmSheet, field, input, select, checkbox,
  today, addDays, weekStart, fmtDate, fmtShort, relDay, daysBetween, clock, fmtDur, empty, pill, segs, bus,
} from './util.js';
import { S, commit, save, undoable, exercise, set } from './store.js';
import { GROUPS } from './seed.js';
import { lineChart } from './charts.js';

const kg = () => set('units') === 'kg';
const U = () => set('units');
const fmtW = w => `${round2(w).toLocaleString()} ${U()}`;
const inc = ex => num(ex?.inc) || (ex?.lower ? (kg() ? 5 : 10) : (kg() ? 2.5 : 5));
export const e1 = (w, r) => r <= 0 || w <= 0 ? 0 : r === 1 ? w : w * (1 + Math.min(r, 15) / 30);
const roundTo = (x, step) => Math.round(x / step) * step;
const desc = () => [...S.workouts].sort((a, b) => b.start - a.start);
const done = it => it.sets.filter(s => s.done);
const volume = items => sum(items, it => sum(done(it), s => num(s.w) * num(s.r)));
const setCount = items => sum(items, it => done(it).length);
const exName = id => exercise(id)?.name || 'Exercise';

function lastFor(exId) {
  for (const w of desc()) {
    const it = w.items.find(i => i.exId === exId && done(i).length);
    if (it) return { w, it, sets: done(it) };
  }
  return null;
}
const bestE1 = exId => Math.max(0, ...S.workouts.flatMap(w => w.items.filter(i => i.exId === exId).flatMap(i => done(i).map(s => e1(num(s.w), num(s.r))))));

// Double progression: earn the top of the rep range on every set at a weight, then add the smallest jump.
export function suggest(exId, lo, hi) {
  const ex = exercise(exId);
  const last = lastFor(exId);
  if (!last) return null;
  lo = num(lo) || num(last.it.lo) || 8;
  hi = Math.max(lo, num(hi) || num(last.it.hi) || lo);
  const top = Math.max(...last.sets.map(s => num(s.w)));
  const atTop = last.sets.filter(s => num(s.w) === top);
  const minR = Math.min(...atTop.map(s => num(s.r)));
  const maxRpe = Math.max(0, ...atTop.map(s => num(s.rpe)));
  const when = relDay(last.w.date).toLowerCase();
  if (top <= 0) return { w: '', r: minR + 1, why: `Beat ${minR} reps from ${when}` };
  const step = inc(ex);
  if (minR >= hi && maxRpe < 10) return { w: top + step, r: lo, why: `+${step} ${U()}: you hit ${hi} reps on every set ${when}` };
  if (minR < lo && maxRpe >= 9.5) return { w: roundTo(top * 0.9, step), r: lo, why: `Missed ${lo} reps at RPE ${maxRpe} ${when}. Drop 10% and build back up` };
  return { w: top, r: Math.min(hi, minR + 1), why: `Same weight, get ${Math.min(hi, minR + 1)}+ reps (range ${lo}–${hi})` };
}

// ---------- rest timer, sound, vibration, wake lock ----------
let ac;
const unlockAudio = () => { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { /* no audio */ } };
function beep() {
  if (!ac) return;
  const t = ac.currentTime;
  [0, 0.22, 0.44].forEach((o, k) => {
    const os = ac.createOscillator(), g = ac.createGain();
    os.frequency.value = k === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t + o);
    g.gain.exponentialRampToValueAtTime(0.35, t + o + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.17);
    os.connect(g).connect(ac.destination);
    os.start(t + o); os.stop(t + o + 0.2);
  });
}
const buzz = p => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

function startRest(sec) {
  if (!num(set('rest')) || !S.active) return;
  S.active.restEnd = Date.now() + sec * 1000;
  S.active.restTotal = sec;
}
export function tickRest() {
  const bar = $('#restbar');
  if (!bar) return;
  const a = S.active;
  if (!a || !a.restEnd) { bar.hidden = true; return; }
  const left = a.restEnd - Date.now();
  if (left <= 0) {
    a.restEnd = 0; save(); bar.hidden = true;
    beep(); buzz([300, 120, 300]);
    toast('Rest is up. Next set.');
    return;
  }
  bar.hidden = false;
  bar.querySelector('[data-rest]').textContent = clock(left + 999);
  bar.querySelector('.rest-fill i').style.width = `${Math.min(100, left / (a.restTotal * 1000) * 100)}%`;
}
acts['rest-adj'] = el => { const a = S.active; if (a?.restEnd) { a.restEnd += +el.dataset.d * 1000; a.restTotal = Math.max(a.restTotal, (a.restEnd - Date.now()) / 1000); save(); tickRest(); } };
acts['rest-skip'] = () => { if (S.active) { S.active.restEnd = 0; save(); tickRest(); } };

let lock = null;
export async function syncWakeLock() {
  const want = !!S.active && document.visibilityState === 'visible';
  try {
    if (want && !lock && 'wakeLock' in navigator) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    else if (!want && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', syncWakeLock);

// ---------- heart rate (standard Bluetooth Heart Rate service: Polar, Garmin, Wahoo, Coros straps, most watches in broadcast mode) ----------
const hr = { on: false, bpm: 0, name: '', dev: null };
export const hrSupported = () => !!navigator.bluetooth;
const maxHr = () => num(set('age')) ? 220 - num(set('age')) : 0;
const zoneOf = b => { const m = maxHr(); if (!m || !b) return ''; const p = b / m; return p < 0.6 ? 'Z1' : p < 0.7 ? 'Z2' : p < 0.8 ? 'Z3' : p < 0.9 ? 'Z4' : 'Z5'; };
acts['hr-connect'] = async () => {
  if (hr.on) { try { hr.dev?.gatt?.disconnect(); } catch { /* already gone */ } return; }
  if (!hrSupported()) return toast('Heart-rate straps need Chrome or Edge on Android, Windows, Mac or ChromeOS. iPhone browsers do not offer Bluetooth.', { ms: 7000 });
  try {
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    dev.addEventListener('gattserverdisconnected', () => { hr.on = false; hr.bpm = 0; bus.render(); toast('Heart-rate monitor disconnected'); });
    const server = await dev.gatt.connect();
    const ch = await (await server.getPrimaryService('heart_rate')).getCharacteristic('heart_rate_measurement');
    ch.addEventListener('characteristicvaluechanged', e => {
      const v = e.target.value;
      onBpm(v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1));
    });
    await ch.startNotifications();
    Object.assign(hr, { on: true, dev, name: dev.name || 'Heart-rate monitor' });
    toast(`Connected to ${hr.name}`);
    bus.render();
  } catch (e) {
    if (e?.name !== 'NotFoundError') toast(`Could not connect: ${e?.message || e}`);
  }
};
let hrSaves = 0;
function onBpm(b) {
  if (!b) return;
  hr.bpm = b;
  const a = S.active;
  if (a) {
    a.hr = a.hr || { sum: 0, n: 0, max: 0 };
    a.hr.sum += b; a.hr.n++; a.hr.max = Math.max(a.hr.max, b);
    if (++hrSaves % 15 === 0) save();
  }
  $$('[data-hr]').forEach(el => { el.textContent = b; });
  $$('[data-hrzone]').forEach(el => { el.textContent = zoneOf(b); });
}

// ---------- voice logging ----------
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30 };
// "225 for 8", "225 by 8 at 8", "8 reps at 225", "bodyweight for 12", "100 kilos times 5 rpe 9" → { w, r, rpe }
export function parseSpoken(text) {
  let t = ` ${String(text).toLowerCase()} `.replace(/(\d),(\d)/g, '$1$2').replace(/[^a-z0-9.@ ]/g, ' ');
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)\b/g, m => WORDS[m]);
  t = t.replace(/\b([1-9]) ([2-9]0)(?: ([1-9]))?\b/g, (_, h, tens, o) => String(+h * 100 + +tens + (+o || 0))); // "one thirty five" → 135
  t = t.replace(/\b(\d+) point (\d)\b/g, '$1.$2').replace(/\b(\d+) and a half\b/g, '$1.5').replace(/\bbody ?weight\b/g, ' 0 ');
  const N = '(\\d+(?:\\.\\d+)?)';
  let w, r, rest = t, m;
  if ((m = t.match(new RegExp(`${N}\\s*reps?\\s*(?:at|with|of|@)\\s*${N}`)))) { r = m[1]; w = m[2]; rest = t.slice(m.index + m[0].length); }
  else if ((m = t.match(new RegExp(`${N}\\s*(?:pounds?|lbs?|kilos?|kilograms?|kgs?)?\\s*(?:for|by|x|times|4)\\s*${N}`)))) { w = m[1]; r = m[2]; rest = t.slice(m.index + m[0].length); }
  else return null;
  const rp = rest.match(new RegExp(`(?:rpe|at|@)\\s*${N}`)) || t.match(new RegExp(`rpe\\s*${N}`));
  const rpe = rp && num(rp[1]) >= 5 && num(rp[1]) <= 10 ? String(Math.round(num(rp[1]) * 2) / 2) : '';
  if (!(num(r) > 0 && num(r) < 100)) return null;
  return { w: String(num(w) || ''), r: String(num(r)), rpe };
}
let listening = false;
acts.voice = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Voice logging needs Chrome, Edge or Safari.');
  if (!S.active || listening) return;
  unlockAudio();
  const rec = new SR();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = false;
  rec.maxAlternatives = 4;
  listening = true;
  $$('[data-act=voice]').forEach(b => b.classList.add('live'));
  const stop = () => { listening = false; $$('[data-act=voice]').forEach(b => b.classList.remove('live')); };
  rec.onresult = e => {
    const alts = [...e.results[0]].map(a => a.transcript);
    for (const t of alts) { const p = parseSpoken(t); if (p) return applyVoice(p, t); }
    toast(`Heard "${alts[0]}". Try "225 for 8" or "225 for 8 at RPE 8".`, { ms: 6000 });
  };
  rec.onerror = e => toast(e.error === 'not-allowed' ? 'Microphone access is blocked for this page.' : e.error === 'no-speech' ? 'Did not catch that. Tap the mic and say "225 for 8".' : `Voice error: ${e.error}`);
  rec.onend = stop;
  try { rec.start(); toast('Listening… say "225 for 8"'); } catch { stop(); }
};
function applyVoice(p, heard) {
  const a = S.active;
  if (!a.items.length) return toast('Add an exercise first.');
  let i = Math.min(a.focus || 0, a.items.length - 1);
  if (!a.items[i].sets.some(s => !s.done)) { const k = a.items.findIndex(it => it.sets.some(s => !s.done)); if (k >= 0) i = k; }
  const it = a.items[i];
  let j = it.sets.findIndex(s => !s.done);
  if (j < 0) { it.sets.push({ w: '', r: '', rpe: '', done: false }); j = it.sets.length - 1; }
  Object.assign(it.sets[j], { w: p.w, r: p.r, rpe: p.rpe });
  completeSet(i, j);
  toast(`${exName(it.exId)} set ${j + 1}: ${p.w ? p.w + ' × ' : ''}${p.r}${p.rpe ? ' @ ' + p.rpe : ''}  (heard "${heard.trim()}")`, { action: { label: 'Undo', fn: () => { it.sets[j].done = false; commit(); } } });
}

// ---------- active workout ----------
const newItem = (exId, n = 3, lo = 8, hi = 12) => ({ exId, lo, hi, sets: Array.from({ length: n }, () => ({ w: '', r: '', rpe: '', done: false })) });
function startWorkout(name, items, templateId = '') {
  if (S.active) { S.ui.gymTab = 'workout'; commit(); return toast('Finish or discard the workout in progress first.'); }
  S.active = { id: uid(), name, templateId, date: today(), start: Date.now(), items, hr: null, focus: 0, restEnd: 0, restTotal: 0 };
  S.ui.gymTab = 'workout';
  unlockAudio();
  commit();
  syncWakeLock();
}
acts['wo-next'] = () => {
  const t = nextTemplate();
  if (t) startWorkout(t.name, t.items.map(i => newItem(i.exId, i.sets, i.lo, i.hi)), t.id); else startWorkout('Workout', []);
  location.hash = 'gym';
};
acts['wo-start'] = el => {
  const t = S.templates.find(x => x.id === el.dataset.id);
  if (t) startWorkout(t.name, t.items.map(i => newItem(i.exId, i.sets, i.lo, i.hi)), t.id);
  else startWorkout('Workout', []);
  if (location.hash !== '#gym') location.hash = 'gym';
};
chg['wo-name'] = el => { if (S.active) { S.active.name = el.value.trim() || 'Workout'; save(); } };
chg['set-field'] = el => {
  const a = S.active;
  const s = a?.items[+el.dataset.i]?.sets[+el.dataset.j];
  if (!s) return;
  s[el.dataset.k] = el.value.trim();
  a.focus = +el.dataset.i;
  save();
};
chg['ex-range'] = el => {
  const it = S.active?.items[+el.dataset.i];
  if (!it) return;
  const [lo, hi] = el.value.split(/[^0-9]+/).map(Number).filter(Boolean);
  if (lo) { it.lo = lo; it.hi = Math.max(lo, hi || lo); }
  commit();
};
acts['set-done'] = el => {
  const i = +el.dataset.i, j = +el.dataset.j;
  const s = S.active?.items[i]?.sets[j];
  if (!s) return;
  if (s.done) { s.done = false; delete s.pr; commit(); return; }
  const row = el.closest('.set-row');
  const val = k => { const f = row.querySelector(`[data-k=${k}]`); return (f.value || f.placeholder || '').trim(); };
  s.w = val('w'); s.r = val('r'); s.rpe = row.querySelector('[data-k=rpe]').value;
  if (!num(s.r)) { toast('Enter the reps for this set.'); row.querySelector('[data-k=r]').focus(); return; }
  unlockAudio();
  completeSet(i, j);
};
function completeSet(i, j) {
  const a = S.active;
  const it = a.items[i];
  const s = it.sets[j];
  const ex = exercise(it.exId);
  s.done = true; s.ts = Date.now(); a.focus = i;
  const est = e1(num(s.w), num(s.r));
  const prior = bestE1(it.exId);
  const earlier = Math.max(0, ...it.sets.filter((x, k) => k !== j && x.done).map(x => e1(num(x.w), num(x.r))));
  if (est > 0 && prior > 0 && est > Math.max(prior, earlier) + 0.01) {
    s.pr = true;
    toast(`PR on ${ex?.name}: estimated 1-rep max ${fmtW(round2(est))}`, { kind: 'good' });
    buzz([50, 40, 50, 40, 140]);
  } else buzz(25);
  startRest(num(ex?.rest) || num(set('rest')));
  commit();
}
acts['set-add'] = el => { const it = S.active?.items[+el.dataset.i]; if (it) { const l = it.sets[it.sets.length - 1]; it.sets.push({ w: l?.w || '', r: '', rpe: '', done: false }); commit(); } };
acts['set-rm'] = el => { const it = S.active?.items[+el.dataset.i]; if (it && it.sets.length > 1) { it.sets.splice(+el.dataset.j, 1); commit(); } };
acts['ex-move'] = el => {
  const a = S.active, i = +el.dataset.i, k = i + +el.dataset.d;
  if (!a || k < 0 || k >= a.items.length) return;
  [a.items[i], a.items[k]] = [a.items[k], a.items[i]];
  commit();
};
acts['ex-rm'] = el => { const a = S.active; if (a) undoable(`Removed ${exName(a.items[+el.dataset.i]?.exId)}`, () => { a.items.splice(+el.dataset.i, 1); }); };
acts['ex-add'] = () => pickExercise(id => {
  const ex = exercise(id);
  const last = lastFor(id);
  S.active.items.push(newItem(id, 3, last?.it.lo || (ex.lower ? 8 : 10), last?.it.hi || (ex.lower ? 10 : 12)));
  S.active.focus = S.active.items.length - 1;
  commit();
});
acts['wo-discard'] = async () => {
  if (await confirmSheet('Discard this workout? Sets you checked off will be lost.', { ok: 'Discard', danger: true })) { S.active = null; commit(); syncWakeLock(); }
};
acts['wo-finish'] = async () => {
  const a = S.active;
  if (!a) return;
  const items = a.items.map(it => ({ ...it, sets: done(it).map(s => ({ ...s })) })).filter(it => it.sets.length);
  if (!items.length) {
    if (await confirmSheet('No sets are checked off yet. Discard this workout?', { ok: 'Discard', danger: true })) { S.active = null; commit(); syncWakeLock(); }
    return;
  }
  const w = { id: a.id, name: a.name, templateId: a.templateId, date: a.date, start: a.start, end: Date.now(), items, hr: a.hr?.n ? a.hr : null, notes: '' };
  S.workouts.push(w);
  S.active = null;
  commit();
  syncWakeLock();
  summarySheet(w);
};

function summarySheet(w) {
  const prs = w.items.flatMap(it => it.sets.filter(s => s.pr).map(s => `${exName(it.exId)}: ${s.w} × ${s.r}`));
  sheet({
    title: 'Workout saved',
    body: `<div class="stats three"><div><span>Time</span><strong>${fmtDur(w.end - w.start)}</strong></div><div><span>Sets</span><strong>${setCount(w.items)}</strong></div><div><span>Volume</span><strong>${fmtW(volume(w.items))}</strong></div>
      ${w.hr ? `<div><span>Avg heart rate</span><strong>${Math.round(w.hr.sum / w.hr.n)} bpm</strong></div><div><span>Max heart rate</span><strong>${w.hr.max} bpm</strong></div>` : ''}</div>
      ${prs.length ? `<h4 class="sub-h">Personal records</h4><ul class="plain">${prs.map(p => `<li>${icon('bolt')} ${esc(p)}</li>`).join('')}</ul>` : ''}
      <div class="row-actions">${w.templateId ? '' : `<button type="button" class="btn ghost" data-act="tpl-from" data-id="${w.id}">Save as template</button>`}<span class="grow"></span><button type="button" class="btn primary" data-close>Done</button></div>`,
  });
}
acts['tpl-from'] = el => {
  const w = S.workouts.find(x => x.id === el.dataset.id);
  if (!w) return;
  templateEditor({ id: '', name: w.name, items: w.items.map(it => ({ exId: it.exId, sets: it.sets.length, lo: it.lo || 8, hi: it.hi || 12 })) });
};

const RPE = [['', 'RPE'], ...[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(v => [String(v), String(v)])];
function activeView() {
  const a = S.active;
  const hrChip = hrSupported() || hr.on
    ? `<button type="button" class="chip${hr.on ? ' on' : ''}" data-act="hr-connect" title="${hr.on ? 'Disconnect ' + esc(hr.name) : 'Connect a Bluetooth heart-rate strap'}">${icon('heart')} <span data-hr>${hr.on ? hr.bpm || '··' : 'HR'}</span>${hr.on ? ' bpm <span data-hrzone></span>' : ''}</button>` : '';
  return `<section class="wo-head">
      <div class="wo-title"><label class="sr-only" for="wo-name">Workout name</label><input id="wo-name" class="wo-name" data-chg="wo-name" value="${esc(a.name)}">
        <span class="muted"><span data-since="${a.start}">0:00</span> · ${setCount(a.items)} sets · ${fmtW(volume(a.items))}</span></div>
      <div class="wo-tools">${hrChip}<button type="button" class="icon-btn mic" data-act="voice" aria-label="Log a set by voice" title="Log a set by voice: say “225 for 8”">${icon('mic')}</button></div>
    </section>
    ${a.items.map((it, i) => exBlock(it, i, a.items.length)).join('') || empty('No exercises yet', 'Add your first exercise to start logging.')}
    <div class="row-actions wrap"><button type="button" class="btn" data-act="ex-add">${icon('plus')} Add exercise</button><span class="grow"></span>
      <button type="button" class="btn ghost danger-text" data-act="wo-discard">Discard</button><button type="button" class="btn primary" data-act="wo-finish">${icon('check')} Finish workout</button></div>`;
}
function exBlock(it, i, n) {
  const ex = exercise(it.exId) || { name: 'Deleted exercise', group: '' };
  const sg = suggest(it.exId, it.lo, it.hi);
  const prev = lastFor(it.exId)?.sets || [];
  const curFocus = S.active.focus === i;
  return `<section class="ex-block${curFocus ? ' focus' : ''}">
    <header class="ex-head"><div><h3>${esc(ex.name)}</h3>
      <span class="muted">${esc(ex.group)} · <label class="range">reps <input data-chg="ex-range" data-i="${i}" value="${it.lo}–${it.hi}" aria-label="Rep range for ${esc(ex.name)}" inputmode="numeric"></label></span></div>
      <div class="ex-menu"><button type="button" class="icon-btn sm" data-act="ex-move" data-i="${i}" data-d="-1" aria-label="Move up"${i ? '' : ' disabled'}>${icon('up')}</button>
      <button type="button" class="icon-btn sm" data-act="ex-move" data-i="${i}" data-d="1" aria-label="Move down"${i < n - 1 ? '' : ' disabled'}>${icon('down')}</button>
      <button type="button" class="icon-btn sm" data-act="ex-rm" data-i="${i}" aria-label="Remove ${esc(ex.name)}">${icon('x')}</button></div></header>
    ${sg ? `<p class="sugg">${icon('bolt')}<span>Try <b>${sg.w ? esc(sg.w) + ' × ' : ''}${esc(sg.r)}</b>. ${esc(sg.why)}.</span></p>` : '<p class="sugg muted">First time logging this. Pick a weight you could lift for 2 more reps.</p>'}
    <div class="sets" role="table" aria-label="${esc(ex.name)} sets">
      <div class="set-row head" role="row"><span>Set</span><span>Last</span><span>${U()}</span><span>Reps</span><span>RPE</span><span></span></div>
      ${it.sets.map((s, j) => {
        const p = prev[j];
        return `<div class="set-row${s.done ? ' done' : ''}${s.pr ? ' pr' : ''}" role="row">
          <button type="button" class="set-n" data-act="set-rm" data-i="${i}" data-j="${j}" title="Remove set" aria-label="Remove set ${j + 1}">${j + 1}</button>
          <span class="prev">${p ? `${num(p.w) ? esc(p.w) + '×' : ''}${esc(p.r)}` : '—'}</span>
          <input data-chg="set-field" data-k="w" data-i="${i}" data-j="${j}" inputmode="decimal" value="${esc(s.w)}" placeholder="${esc(sg?.w ?? p?.w ?? '')}" aria-label="Weight, set ${j + 1}"${s.done ? ' readonly' : ''}>
          <input data-chg="set-field" data-k="r" data-i="${i}" data-j="${j}" inputmode="numeric" value="${esc(s.r)}" placeholder="${esc(sg?.r ?? p?.r ?? '')}" aria-label="Reps, set ${j + 1}"${s.done ? ' readonly' : ''}>
          ${select(`rpe-${i}-${j}`, RPE, s.rpe, `data-chg="set-field" data-k="rpe" data-i="${i}" data-j="${j}" aria-label="RPE, set ${j + 1}"`)}
          <button type="button" class="tick${s.done ? ' on' : ''}" data-act="set-done" data-i="${i}" data-j="${j}" aria-label="${s.done ? 'Undo set' : 'Complete set'} ${j + 1}">${s.pr ? icon('bolt') : icon('check')}</button>
        </div>`;
      }).join('')}
    </div>
    <button type="button" class="btn ghost sm" data-act="set-add" data-i="${i}">${icon('plus')} Set</button>
  </section>`;
}

// ---------- start screen ----------
function nextTemplate() {
  if (!S.templates.length) return null;
  const lastDone = t => Math.max(0, ...S.workouts.filter(w => w.templateId === t.id).map(w => w.start));
  // Continue the rotation: the template after the most recent one, falling back to the least recently done.
  const recent = desc().find(w => S.templates.some(t => t.id === w.templateId));
  if (recent) {
    const used = S.templates.filter(t => lastDone(t) > 0);
    const k = used.findIndex(t => t.id === recent.templateId);
    if (used.length > 1 && k >= 0) return used[(k + 1) % used.length];
  }
  return [...S.templates].sort((a, b) => lastDone(a) - lastDone(b))[0];
}
export function weekSessions() { const ws = weekStart(today()); return S.workouts.filter(w => w.date >= ws).length; }
export function lastWorkout() { return desc()[0]; }
export function todayCard() {
  if (S.active) return `<section class="card-row"><div class="row-main"><span class="eyebrow">Workout in progress</span><strong>${esc(S.active.name)}</strong><span class="muted"><span data-since="${S.active.start}">0:00</span> · ${setCount(S.active.items)} sets</span></div><a class="btn primary" href="#gym">Resume</a></section>`;
  const t = nextTemplate();
  const last = lastWorkout();
  return `<section class="card-row"><div class="row-main"><span class="eyebrow">Gym · ${weekSessions()} this week</span><strong>${t ? `Up next: ${esc(t.name)}` : 'Start a workout'}</strong>
    <span class="muted">${last ? `Last: ${esc(last.name)}, ${esc(relDay(last.date).toLowerCase())}` : 'No workouts logged yet'}</span></div>
    <button type="button" class="btn primary" data-act="wo-start" data-id="${t?.id || ''}">${icon('play')} Start</button></section>`;
}

function startView() {
  const t = nextTemplate();
  const lastOf = tp => { const w = desc().find(x => x.templateId === tp.id); return w ? 'last ' + relDay(w.date).toLowerCase() : 'not done yet'; };
  return `${t ? `<section class="hero-card"><span class="eyebrow">Up next in your rotation</span><h2>${esc(t.name)}</h2>
      <p class="muted">${t.items.map(i => esc(exName(i.exId))).join(' · ')}</p>
      <button type="button" class="btn primary lg" data-act="wo-start" data-id="${t.id}">${icon('play')} Start ${esc(t.name)}</button></section>` : ''}
    <section class="group"><header class="group-head"><h3>Templates</h3><button type="button" class="btn ghost sm" data-act="tpl-new">${icon('plus')} Template</button></header>
      <div class="list panel">${S.templates.map(tp => `<div class="row"><div class="row-main" data-act="tpl-edit" data-id="${tp.id}" role="button" tabindex="0"><div class="row-title">${esc(tp.name)}</div>
        <div class="row-sub">${tp.items.length} exercises · ${sum(tp.items, i => num(i.sets))} sets · ${esc(lastOf(tp))}</div></div>
        <button type="button" class="btn sm" data-act="wo-start" data-id="${tp.id}">${icon('play')} Start</button></div>`).join('')}</div>
      <div class="row-actions"><button type="button" class="btn ghost" data-act="wo-start" data-id="">${icon('plus')} Empty workout</button></div></section>
    ${muscleBars()}`;
}
function muscleBars() {
  const ws = weekStart(today());
  const target = num(set('setTarget')) || 12;
  const counts = Object.fromEntries(GROUPS.map(g => [g, 0]));
  for (const w of S.workouts.filter(x => x.date >= ws)) for (const it of w.items) { const g = exercise(it.exId)?.group; if (g in counts) counts[g] += done(it).length; }
  return `<section class="group"><header class="group-head"><h3>Hard sets this week</h3><span class="muted">target ${target} per muscle</span></header>
    <div class="bars">${GROUPS.map(g => `<div class="bar-row"><span>${g}</span><div class="bar${counts[g] >= target ? ' full' : ''}"><i style="width:${Math.min(100, counts[g] / target * 100)}%"></i></div><b>${counts[g]}</b></div>`).join('')}</div></section>`;
}

// ---------- templates ----------
acts['tpl-new'] = () => templateEditor(null);
acts['tpl-edit'] = el => templateEditor(S.templates.find(t => t.id === el.dataset.id));
function templateEditor(tpl) {
  const isNew = !tpl?.id;
  const d = tpl ? JSON.parse(JSON.stringify(tpl)) : { id: '', name: '', items: [] };
  const s = sheet({
    title: isNew ? 'New template' : 'Edit template',
    body: '<div data-ed></div>',
    onMount: el => {
      const box = el.querySelector('[data-ed]');
      const draw = () => {
        box.innerHTML = `${field('Name', `<input id="tpl-name" value="${esc(d.name)}" placeholder="e.g. Push, Upper A">`)}
          <div class="tpl-items">${d.items.map((it, i) => `<div class="tpl-row" data-i="${i}"><span class="tpl-name">${esc(exName(it.exId))}</span>
            <label>sets <input data-f="sets" inputmode="numeric" value="${it.sets}"></label><label>reps <input data-f="lo" inputmode="numeric" value="${it.lo}"></label><label>to <input data-f="hi" inputmode="numeric" value="${it.hi}"></label>
            <span class="tpl-btns"><button type="button" class="icon-btn sm" data-mv="-1" aria-label="Move up">${icon('up')}</button><button type="button" class="icon-btn sm" data-mv="1" aria-label="Move down">${icon('down')}</button><button type="button" class="icon-btn sm" data-rm aria-label="Remove">${icon('x')}</button></span></div>`).join('') || '<p class="muted small">No exercises yet.</p>'}</div>
          <button type="button" class="btn ghost sm" data-add>${icon('plus')} Add exercise</button>
          <div class="row-actions">${isNew ? '' : `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Delete</button>`}<span class="grow"></span><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" data-save>Save</button></div>`;
      };
      draw();
      box.addEventListener('input', e => {
        if (e.target.id === 'tpl-name') d.name = e.target.value;
        const row = e.target.closest('.tpl-row');
        if (row && e.target.dataset.f) d.items[+row.dataset.i][e.target.dataset.f] = num(e.target.value);
      });
      box.addEventListener('click', e => {
        const row = e.target.closest('.tpl-row');
        const i = row ? +row.dataset.i : -1;
        if (e.target.closest('[data-rm]')) { d.items.splice(i, 1); draw(); }
        else if (e.target.closest('[data-mv]')) { const k = i + +e.target.closest('[data-mv]').dataset.mv; if (k >= 0 && k < d.items.length) { [d.items[i], d.items[k]] = [d.items[k], d.items[i]]; draw(); } }
        else if (e.target.closest('[data-add]')) pickExercise(id => { const ex = exercise(id); d.items.push({ exId: id, sets: 3, lo: ex.lower ? 8 : 10, hi: ex.lower ? 10 : 12 }); draw(); });
        else if (e.target.closest('[data-del]')) { s.close(); undoable('Template deleted', () => { S.templates = S.templates.filter(t => t.id !== d.id); }); }
        else if (e.target.closest('[data-save]')) {
          if (!d.name.trim()) return toast('Name the template.');
          if (!d.items.length) return toast('Add at least one exercise.');
          d.name = d.name.trim();
          d.items.forEach(it => { it.sets = Math.max(1, num(it.sets) || 3); it.lo = Math.max(1, num(it.lo) || 8); it.hi = Math.max(it.lo, num(it.hi) || it.lo); });
          if (isNew) S.templates.push({ ...d, id: uid() }); else Object.assign(S.templates.find(t => t.id === d.id), d);
          s.close(); commit(); toast('Template saved');
        }
      });
    },
  });
}

// ---------- exercise picker ----------
function pickExercise(cb) {
  const s = sheet({
    title: 'Add exercise',
    body: `<input id="ex-search" class="search" type="search" placeholder="Search ${S.exercises.length} exercises" autocomplete="off" autofocus><div data-list></div>
      <button type="button" class="btn ghost" data-new>${icon('plus')} Create a custom exercise</button>`,
    onMount: el => {
      const list = el.querySelector('[data-list]');
      const draw = q => {
        q = q.trim().toLowerCase();
        const hits = S.exercises.filter(e => !q || e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q) || e.equip.toLowerCase().includes(q));
        const groups = [...new Set(hits.map(e => e.group))];
        list.innerHTML = groups.map(g => `<h4 class="sub-h">${esc(g)}</h4><div class="list">${hits.filter(e => e.group === g).map(e => `<div class="row" data-pick="${e.id}" role="button" tabindex="0"><div class="row-main"><div class="row-title">${esc(e.name)}</div><div class="row-sub">${esc(e.equip)}</div></div></div>`).join('')}</div>`).join('') || '<p class="muted small">No match. Create it below.</p>';
      };
      draw('');
      el.querySelector('#ex-search').addEventListener('input', e => draw(e.target.value));
      el.addEventListener('click', e => {
        const r = e.target.closest('[data-pick]');
        if (r) { s.close(); cb(r.dataset.pick); }
        if (e.target.closest('[data-new]')) {
          const name = el.querySelector('#ex-search').value.trim();
          s.close();
          formSheet({
            title: 'Custom exercise',
            fields: `${field('Name', input('name', name, 'text', 'required autofocus'))}<div class="grid2">${field('Muscle group', select('group', GROUPS.map(g => [g, g]), 'Chest'))}${field('Equipment', select('equip', ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other'].map(x => [x, x]), 'Machine'))}</div>
              ${checkbox('lower', 'Lower-body lift (bigger weight jumps)', false)}${checkbox('bw', 'Bodyweight (log added weight only)', false)}`,
            onSubmit: dd => {
              if (!dd.name.trim()) { toast('Name the exercise.'); return false; }
              const ex = { id: 'c_' + uid(), name: dd.name.trim(), group: dd.group, equip: dd.equip, lower: dd.lower, bw: dd.bw, rest: 0 };
              S.exercises.push(ex);
              save();
              cb(ex.id);
            },
          });
        }
      });
    },
  });
}

// ---------- history ----------
function historyView() {
  const list = desc();
  if (!list.length) return empty('No workouts yet', 'Finished workouts land here with their sets, volume and records.');
  const months = [...new Set(list.map(w => w.date.slice(0, 7)))];
  return months.map(m => `<section class="group"><header class="group-head"><h3>${esc(fmtDate(m + '-01', { month: 'long', year: 'numeric' }))}</h3><span class="muted">${list.filter(w => w.date.startsWith(m)).length} sessions</span></header>
    <div class="list panel">${list.filter(w => w.date.startsWith(m)).map(w => {
      const prs = sum(w.items, it => it.sets.filter(s => s.pr).length);
      return `<div class="row" data-act="wo-open" data-id="${w.id}" role="button" tabindex="0"><div class="row-main"><div class="row-title">${esc(w.name)}</div>
        <div class="row-sub">${esc(fmtDate(w.date))} · ${fmtDur(w.end - w.start)} · ${setCount(w.items)} sets${w.hr ? ` · ${Math.round(w.hr.sum / w.hr.n)} bpm avg` : ''}</div></div>
        <div class="row-end">${prs ? pill(`${prs} PR`, 'good') : ''}<span class="row-num">${fmtW(volume(w.items))}</span></div></div>`;
    }).join('')}</div></section>`).join('');
}
acts['wo-open'] = el => {
  const id = el.dataset.id;
  sheet({
    title: 'Workout',
    render: () => {
      const w = S.workouts.find(x => x.id === id);
      if (!w) return null;
      return `<div class="detail-head"><h3>${esc(w.name)}</h3><p class="muted">${esc(fmtDate(w.date, { weekday: 'long', month: 'long', day: 'numeric' }))} · ${fmtDur(w.end - w.start)}${w.hr ? ` · avg ${Math.round(w.hr.sum / w.hr.n)} / max ${w.hr.max} bpm` : ''}</p></div>
        ${w.items.map(it => `<h4 class="sub-h">${esc(exName(it.exId))}</h4><p class="sets-line">${it.sets.map(s => `<span class="${s.pr ? 'pr-text' : ''}">${num(s.w) ? esc(s.w) + ' × ' : ''}${esc(s.r)}${s.rpe ? ' @' + esc(s.rpe) : ''}</span>`).join('')}</p>`).join('')}
        <div class="row-actions"><button type="button" class="btn ghost danger-text" data-act="wo-del" data-id="${id}">${icon('trash')} Delete</button><span class="grow"></span>
        <button type="button" class="btn primary" data-act="wo-repeat" data-id="${id}">${icon('repeat')} Do this again</button></div>`;
    },
  });
};
acts['wo-del'] = el => undoable('Workout deleted', () => { S.workouts = S.workouts.filter(w => w.id !== el.dataset.id); });
acts['wo-repeat'] = el => {
  const w = S.workouts.find(x => x.id === el.dataset.id);
  if (!w) return;
  $$('.sheet-wrap [data-close]').forEach(b => b.click());
  startWorkout(w.name, w.items.map(it => newItem(it.exId, it.sets.length, it.lo || 8, it.hi || 12)), w.templateId);
  location.hash = 'gym';
};

// ---------- progress ----------
function progressView() {
  const freq = {};
  for (const w of S.workouts) for (const it of w.items) freq[it.exId] = (freq[it.exId] || 0) + 1;
  const ids = Object.keys(freq).filter(exercise).sort((a, b) => freq[b] - freq[a]);
  const cur = ids.includes(S.ui.progEx) ? S.ui.progEx : ids[0];
  let exHtml = empty('No lifts logged yet', 'Your estimated 1-rep max for each lift is charted here after a couple of sessions.');
  if (cur) {
    const ex = exercise(cur);
    const sessions = S.workouts.filter(w => w.items.some(i => i.exId === cur)).sort((a, b) => a.start - b.start).map(w => {
      const sets = w.items.filter(i => i.exId === cur).flatMap(done);
      return { w, sets, best: Math.max(...sets.map(s => e1(num(s.w), num(s.r)))), reps: Math.max(...sets.map(s => num(s.r))), heavy: Math.max(...sets.map(s => num(s.w))), vol: sum(sets, s => num(s.w) * num(s.r)) };
    }).filter(x => x.sets.length);
    const byWeight = sessions.some(x => x.heavy > 0);
    const pts = sessions.map(x => ({ x: x.w.date, y: byWeight ? round2(x.best) : x.reps }));
    const best = sessions.reduce((a, b) => ((byWeight ? b.best > a.best : b.reps > a.reps) ? b : a), sessions[0]);
    const heaviest = sessions.reduce((a, b) => (b.heavy > a.heavy ? b : a), sessions[0]);
    const first = pts[0], last = pts[pts.length - 1];
    const change = last && first && pts.length > 1 ? last.y - first.y : 0;
    exHtml = `<div class="toolbar"><label class="sr-only" for="prog-ex">Exercise</label>${select('prog-ex', ids.map(id => [id, `${exName(id)} (${freq[id]})`]), cur, 'data-chg="prog-ex" class="grow"').replace('id="f-prog-ex"', 'id="prog-ex"')}</div>
      <section class="chart-card"><header class="group-head"><h3>${byWeight ? 'Estimated 1-rep max' : 'Best set (reps)'}</h3>
        <span class="${change > 0 ? 'good-text' : change < 0 ? 'bad-text' : 'muted'}">${change ? `${change > 0 ? '+' : ''}${round2(change)}${byWeight ? ' ' + U() : ' reps'} since ${esc(fmtShort(first.x))}` : ''}</span></header>
        ${lineChart(pts, { fmt: v => byWeight ? `${Math.round(v)}` : `${Math.round(v)}` })}</section>
      <div class="stats three"><div><span>${byWeight ? 'Best est. 1RM' : 'Most reps'}</span><strong>${byWeight ? fmtW(Math.round(best.best)) : best.reps}</strong><small>${esc(fmtShort(best.w.date))}</small></div>
        <div><span>Heaviest set</span><strong>${byWeight ? fmtW(heaviest.heavy) : '—'}</strong><small>${byWeight ? esc(fmtShort(heaviest.w.date)) : ''}</small></div>
        <div><span>Sessions</span><strong>${sessions.length}</strong><small>${esc(ex.group)}</small></div></div>
      <h4 class="sub-h">Recent sessions</h4>
      <div class="list panel">${sessions.slice(-6).reverse().map(x => `<div class="row"><div class="row-main"><div class="row-title">${esc(fmtDate(x.w.date))}</div><div class="row-sub sets-line">${x.sets.map(s => `<span class="${s.pr ? 'pr-text' : ''}">${num(s.w) ? esc(s.w) + '×' : ''}${esc(s.r)}</span>`).join('')}</div></div><div class="row-end"><span class="row-num">${byWeight ? fmtW(Math.round(x.best)) : ''}</span></div></div>`).join('')}</div>`;
  }
  return `${exHtml}${muscleBars()}${bodyView()}`;
}
chg['prog-ex'] = el => { S.ui.progEx = el.value; commit(); };

function bodyView() {
  const list = [...S.body].sort((a, b) => a.date.localeCompare(b.date));
  const pts = list.map(b => ({ x: b.date, y: num(b.weight) }));
  // 7-day rolling average smooths out water-weight noise.
  const avg = pts.map(p => { const win = pts.filter(q => q.x <= p.x && daysBetween(q.x, p.x) < 7); return { x: p.x, y: round2(sum(win, q => q.y) / win.length) }; });
  const lastAvg = avg[avg.length - 1];
  const prevAvg = lastAvg ? [...avg].reverse().find(p => daysBetween(p.x, lastAvg.x) >= 7) : null;
  const wk = lastAvg && prevAvg ? round2((lastAvg.y - prevAvg.y) / daysBetween(prevAvg.x, lastAvg.x) * 7) : null;
  return `<section class="group"><header class="group-head"><h3>Body weight</h3><span class="muted">${wk !== null ? `${wk > 0 ? '+' : ''}${wk} ${U()}/week (7-day avg)` : ''}</span></header>
    <form class="inline-form" data-body-form><label class="sr-only" for="bw-in">Today's weight</label><input id="bw-in" inputmode="decimal" placeholder="Today's weight (${U()})"><button type="submit" class="btn sm">${icon('scale')} Log</button></form>
    ${pts.length ? `<section class="chart-card">${lineChart(pts, { avg, fmt: v => String(Math.round(v * 10) / 10) })}<p class="legend"><i class="sw line"></i> Daily <i class="sw avg"></i> 7-day average</p></section>` : ''}
    ${list.length ? `<div class="list panel">${list.slice(-5).reverse().map(b => `<div class="row"><div class="row-main"><div class="row-title">${esc(b.weight)} ${U()}</div><div class="row-sub">${esc(fmtDate(b.date))}</div></div><button type="button" class="icon-btn sm" data-act="bw-del" data-date="${b.date}" aria-label="Delete ${esc(b.date)}">${icon('x')}</button></div>`).join('')}</div>` : ''}</section>`;
}
document.addEventListener('submit', e => {
  if (!e.target.matches('[data-body-form]')) return;
  e.preventDefault();
  const v = num(e.target.querySelector('input').value);
  if (!v) return toast('Enter your weight.');
  S.body = S.body.filter(b => b.date !== today());
  S.body.push({ date: today(), weight: String(v) });
  commit();
  toast(`Logged ${v} ${U()}`);
});
acts['bw-del'] = el => undoable('Weight entry deleted', () => { S.body = S.body.filter(b => b.date !== el.dataset.date); });

// ---------- tools ----------
const PLATE_COLORS_KG = { 25: 'p-red', 20: 'p-blue', 15: 'p-yellow', 10: 'p-green', 5: 'p-white', 2.5: 'p-red', 1.25: 'p-steel' };
export function plates(target, bar, avail) {
  let side = (target - bar) / 2;
  if (side < 0) return { ok: false, list: [], left: side };
  const list = [];
  for (const p of [...avail].sort((a, b) => b - a)) while (side >= p - 1e-9) { list.push(p); side = round2(side - p); }
  return { ok: side < 1e-6, list, left: side };
}
function toolsView() {
  const bar = num(set('bar'));
  return `<section class="tool" data-tool>
      <header class="group-head"><h3>Plate calculator</h3><span class="muted">${bar} ${U()} bar</span></header>
      <div class="inline-form"><label class="sr-only" for="pl-w">Target weight</label><input id="pl-w" inputmode="decimal" placeholder="Target weight (${U()})" value="${esc(S.ui.plW || '')}"></div>
      <div data-out="plates"></div></section>
    <section class="tool" data-tool>
      <header class="group-head"><h3>1-rep max and percentages</h3><span class="muted">Epley formula</span></header>
      <div class="grid2"><input id="rm-w" inputmode="decimal" placeholder="Weight lifted" aria-label="Weight lifted" value="${esc(S.ui.rmW || '')}"><input id="rm-r" inputmode="numeric" placeholder="Reps" aria-label="Reps" value="${esc(S.ui.rmR || '')}"></div>
      <div data-out="rm"></div></section>
    <section class="tool" data-tool>
      <header class="group-head"><h3>Warm-up sets</h3></header>
      <input id="wu-w" inputmode="decimal" placeholder="Working weight (${U()})" aria-label="Working weight" value="${esc(S.ui.wuW || '')}">
      <div data-out="wu"></div></section>
    <section class="tool">
      <header class="group-head"><h3>Heart-rate strap</h3>${hr.on ? pill('Connected', 'good') : ''}</header>
      <p class="muted small">Pairs with any strap or watch that broadcasts the standard Bluetooth heart-rate signal (Polar H10, Garmin HRM, Wahoo TICKR, Coros, most watches in broadcast mode). Live BPM shows on your workout, and the average and max are saved with it.${num(set('age')) ? ` Zones use a max of ${maxHr()} bpm.` : ' Add your age in More to see heart-rate zones.'}</p>
      ${hrSupported() ? `<button type="button" class="btn" data-act="hr-connect">${icon('bt')} ${hr.on ? `Disconnect ${esc(hr.name)}` : 'Connect a monitor'}</button>` : '<p class="callout">This browser cannot reach Bluetooth devices. Use Chrome or Edge on Android, Windows, Mac or ChromeOS. iPhone browsers do not support it.</p>'}</section>
    <section class="tool">
      <header class="group-head"><h3>Voice logging</h3></header>
      <p class="muted small">During a workout tap the mic and say the set. It fills the next open set of the exercise you last touched and starts your rest timer.</p>
      <ul class="plain small"><li>“225 for 8”</li><li>“225 for 8 at RPE 8”</li><li>“8 reps at 100 kilos”</li><li>“Bodyweight for 12”</li></ul></section>
    <section class="tool">
      <header class="group-head"><h3>RPE guide</h3></header>
      <dl class="rpe-guide"><dt>10</dt><dd>Max effort, no reps left</dd><dt>9</dt><dd>1 rep left in the tank</dd><dt>8</dt><dd>2 reps left</dd><dt>7</dt><dd>3 reps left, bar speed still fast</dd><dt>6</dt><dd>Warm-up effort</dd></dl>
      <p class="muted small">Most working sets belong at RPE 7–9. Suggestions add weight once you reach the top of your rep range on every set without hitting RPE 10.</p></section>`;
}
export function updateTools() {
  const v = id => $('#' + id)?.value;
  if (!$('#pl-w')) return;
  Object.assign(S.ui, { plW: v('pl-w'), rmW: v('rm-w'), rmR: v('rm-r'), wuW: v('wu-w') });
  const bar = num(set('bar'));
  const avail = String(set('plates')).split(/[ ,]+/).map(num).filter(x => x > 0);
  const step = kg() ? 2.5 : 5;
  const t = num(S.ui.plW);
  const out = (k, html) => { const el = $(`[data-out=${k}]`); if (el) el.innerHTML = html; };
  if (t) {
    const p = plates(t, bar, avail);
    out('plates', !p.list.length && !p.ok ? `<p class="muted small">That is lighter than the bar.</p>` : `<div class="barbell" aria-hidden="true"><span class="sleeve"></span>${p.list.map(x => `<span class="plate ${kg() ? PLATE_COLORS_KG[x] || 'p-steel' : 'p-iron'}" style="--h:${Math.round(34 + Math.sqrt(x / Math.max(...avail)) * 66)}%">${x}</span>`).join('')}<span class="collar"></span></div>
      <p><b>Each side:</b> ${p.list.length ? p.list.join(' + ') : 'nothing, just the bar'}${p.ok ? '' : ` <span class="warn-text">(${round2(p.left * 2)} ${U()} short of ${t}; closest is ${round2(t - p.left * 2)})</span>`}</p>`);
  } else out('plates', '');
  const w = num(S.ui.rmW), r = num(S.ui.rmR);
  if (w && r) {
    const m = e1(w, r);
    out('rm', `<p class="big-num">${fmtW(Math.round(m))}<small>estimated 1-rep max${r > 12 ? ' (less reliable above 12 reps)' : ''}</small></p>
      <div class="table-wrap"><table class="pct"><thead><tr><th>%</th><th class="n">${U()}</th><th class="n">≈ reps</th></tr></thead><tbody>${[95, 90, 85, 80, 75, 70, 65, 60].map(p => `<tr><td>${p}%</td><td class="n">${roundTo(m * p / 100, step)}</td><td class="n">${Math.max(1, Math.round(30 * (100 / p - 1)))}</td></tr>`).join('')}</tbody></table></div>`);
  } else out('rm', '');
  const ww = num(S.ui.wuW);
  if (ww) {
    const rows = [[bar, 10], [0.4, 5], [0.6, 3], [0.8, 2]].map(([f, reps], k) => [k ? Math.max(bar, roundTo(ww * f, step)) : bar, reps]).filter(([x], k, arr) => x < ww && (k === 0 || x > arr[k - 1][0]));
    out('wu', `<ol class="warmup">${rows.map(([x, reps]) => `<li><b>${x} ${U()}</b> × ${reps}</li>`).join('')}<li class="work"><b>${ww} ${U()}</b> working sets</li></ol>`);
  } else out('wu', '');
}
document.addEventListener('input', e => { if (e.target.closest('[data-tool]')) { updateTools(); save(); } });

// ---------- view ----------
const TABS = [['workout', 'Workout'], ['history', 'History'], ['progress', 'Progress'], ['tools', 'Tools']];
export function view() {
  const tab = TABS.some(t => t[0] === S.ui.gymTab) ? S.ui.gymTab : 'workout';
  const body = tab === 'workout' ? (S.active ? activeView() : startView()) : tab === 'history' ? historyView() : tab === 'progress' ? progressView() : toolsView();
  return `${segs('gym-tab', TABS.map(([v, l]) => [v, v === 'workout' && S.active ? 'Workout •' : l]), tab)}<div class="tab-body">${body}</div>`;
}
export function after() { updateTools(); tickRest(); syncWakeLock(); }
acts['gym-tab'] = el => { S.ui.gymTab = el.dataset.v; commit(); window.scrollTo(0, 0); };
