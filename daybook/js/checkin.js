// Check-ins: the app asks how you are doing. Morning (sleep, energy, mood, today's focus), evening
// (mood, stress, focus review, habits, reflection) and a weekly review (week in numbers, goal updates,
// reflection). Answers feed trends, simple insights and a searchable journal.
import {
  $$, esc, uid, num, sum, avg, round2, acts, icon, toast, formSheet, field, numInput, textarea, checkbox, select,
  today, addDays, weekStart, parseDate, fmtDate, fmtShort, fmtTime, hmOf, daysBetween, hours, fmtHrs, money, download, empty, pill,
} from './util.js';
import { S, commit, undoable, set } from './store.js';
import { lineChart } from './charts.js';
import { focusTasks, completeTask, isFocus } from './tasks.js';
import { current, fmtVal, logGoal } from './goals.js';

export const MOOD = ['Rough', 'Low', 'Okay', 'Good', 'Great'];
export const ENERGY = ['Drained', 'Low', 'Steady', 'Good', 'Charged'];
export const STRESS = ['Calm', 'Light', 'Some', 'High', 'Maxed'];
const KIND_LABEL = { morning: 'Morning check-in', evening: 'Evening check-in', weekly: 'Weekly review' };

const MORNING_Q = ['What would make today a win?', 'What is the one thing that has to get done today?', 'What are you looking forward to today?', 'What might get in your way today, and how will you handle it?', 'Who could you check in on today?', 'What would you do today with an extra hour?', 'How do you want to feel at the end of today?'];
const EVENING_Q = ['What got in the way today?', 'What did you learn today?', 'What are you grateful for today?', 'What would you do differently tomorrow?', 'Who made your day better?', 'What drained you today, and what recharged you?', 'What did you put off, and why?'];
const WEEKLY_Q = ['Biggest win this week', 'What drained you this week?', 'One thing to do differently next week', 'Next week\'s top priority'];
const dayIndex = d => daysBetween(`${d.slice(0, 4)}-01-01`, d);
const promptFor = (list, d) => list[dayIndex(d) % list.length];

// ---------- what is due ----------
const nowHM = () => hmOf(Date.now());
export const entry = (kind, date = today()) => S.checkins.find(c => c.kind === kind && c.date === date);
// The weekly review opens on the chosen day and stays open the day after, so a busy Sunday can roll into Monday.
export function reviewWeek() {
  const d = parseDate(today()).getDay();
  const since = (d - num(set('reviewDay')) + 7) % 7;
  return since <= 1 ? weekStart(addDays(today(), -since)) : null;
}
const weeklyDone = wk => S.checkins.some(c => c.kind === 'weekly' && c.week === wk);
export function dueCheckins() {
  if (set('checkins') === 'off') return [];
  const out = [];
  const wk = reviewWeek();
  if (wk && !weeklyDone(wk)) out.push('weekly');
  const hm = nowHM();
  if (!entry('morning') && hm >= '04:00' && hm < '12:00') out.push('morning');
  if (!entry('evening') && hm >= (set('pmTime') < '17:00' ? set('pmTime') : '17:00')) out.push('evening');
  return out;
}
export function streak() {
  let d = S.checkins.some(c => c.date === today()) ? today() : addDays(today(), -1);
  let n = 0;
  while (S.checkins.some(c => c.date === d)) { n++; d = addDays(d, -1); }
  return n;
}

// ---------- day context (so the questions come with the facts) ----------
const isoOf = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hoursOn = d => sum(S.time.filter(t => t.end && isoOf(t.start) === d), t => hours(t.end - t.start - num(t.breakMin) * 60000));
const trainedOn = d => S.workouts.some(w => w.date === d);
function morningContext() {
  const evs = S.events.filter(e => e.date === today()).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
  const due = S.tasks.filter(t => !t.done && t.due && t.due <= today()).length;
  const bits = [];
  if (evs.length) bits.push(`${evs.length} visit${evs.length > 1 ? 's' : ''} on the schedule${evs[0].start ? `, first at ${fmtTime(evs[0].start)}` : ''}`);
  else bits.push('nothing on the schedule');
  if (due) bits.push(`${due} to-do${due > 1 ? 's' : ''} due`);
  const lastW = [...S.workouts].sort((a, b) => b.start - a.start)[0];
  if (lastW) bits.push(`last workout ${daysBetween(lastW.date, today()) === 0 ? 'today' : daysBetween(lastW.date, today()) === 1 ? 'yesterday' : daysBetween(lastW.date, today()) + ' days ago'}`);
  return `<p class="context">${icon('sun')}<span>Today: ${esc(bits.join(' · '))}.</span></p>`;
}
function eveningContext() {
  const h = hoursOn(today());
  const habitsDone = (S.habitLog[today()] || []).length;
  const bits = [h ? `${fmtHrs(h)} worked` : 'no hours logged', trainedOn(today()) ? 'trained today' : 'rest day from the gym'];
  if (S.habits.length) bits.push(`${habitsDone} of ${S.habits.length} habits`);
  return `<p class="context">${icon('moon')}<span>Today: ${esc(bits.join(' · '))}.</span></p>`;
}

// ---------- form pieces ----------
const scale = (name, labels, val, legend) => `<fieldset class="scale-field"><legend class="lbl">${esc(legend)}</legend><div class="scale">${labels.map((l, i) => `<label class="scale-opt"><input type="radio" name="${name}" value="${i + 1}"${num(val) === i + 1 ? ' checked' : ''}><span><b>${i + 1}</b><small>${esc(l)}</small></span></label>`).join('')}</div></fieldset>`;
const qa = (key, q, val, ph = '') => field(q, textarea(key, val || '', `rows="2" data-q="${esc(q)}" placeholder="${esc(ph)}"`));
const answerOf = (e, q) => e?.notes?.find(n => n.q === q)?.a || '';
const collectNotes = form => $$('textarea[data-q]', form).map(t => ({ q: t.dataset.q, a: t.value.trim() })).filter(n => n.a);

export function openCheckin(kind, existing) {
  const t = today();
  const e = existing || (kind === 'weekly' ? S.checkins.find(c => c.kind === 'weekly' && c.week === (reviewWeek() || weekStart(t))) : entry(kind));
  const date = e?.date || t;
  const builders = { morning: morningFields, evening: eveningFields, weekly: weeklyFields };
  formSheet({
    title: KIND_LABEL[kind],
    fields: builders[kind](e, date),
    submit: e ? 'Save changes' : 'Save check-in',
    del: e ? () => undoable('Check-in deleted', () => { S.checkins = S.checkins.filter(c => c.id !== e.id); }) : null,
    onMount: el => {
      el.querySelectorAll('[data-sleep]').forEach(b => b.addEventListener('click', () => { el.querySelector('[name=sleep]').value = b.dataset.sleep; }));
      // Keep today's focus to three.
      el.addEventListener('change', ev => {
        if (ev.target.name !== 'focus') return;
        const on = $$('input[name=focus]:checked', el);
        if (on.length > 3) { ev.target.checked = false; toast('Keep it to three. Pick what matters most.'); }
      });
    },
    onSubmit: (d, form) => saveCheckin(kind, e, date, d, form),
  });
}

function morningFields(e, date) {
  const candidates = S.tasks.filter(x => !x.done && (!x.due || x.due <= addDays(date, 7)))
    .sort((a, b) => (isFocus(b) - isFocus(a)) || (a.due || '9').localeCompare(b.due || '9')).slice(0, 10);
  const q = answerOf(e, promptFor(MORNING_Q, date)) ? promptFor(MORNING_Q, date) : (e?.notes?.find(n => MORNING_Q.includes(n.q))?.q || promptFor(MORNING_Q, date));
  return `${e ? '' : morningContext()}
    <div class="field"><span class="lbl">Hours of sleep</span><div class="inline">${numInput('sleep', e?.sleep || '', 'placeholder="7.5" style="max-width:110px"')}${[5, 6, 7, 8, 9].map(h => `<button type="button" class="chip" data-sleep="${h}">${h}</button>`).join('')}</div></div>
    ${scale('energy', ENERGY, e?.energy, 'Energy')}
    ${scale('mood', MOOD, e?.mood, 'Mood')}
    <div class="field"><span class="lbl">Today's focus <span class="muted">· up to 3</span></span>
      ${candidates.length ? `<div class="pick-list">${candidates.map(x => `<label class="check-field"><input type="checkbox" name="focus" value="${x.id}"${isFocus(x) ? ' checked' : ''}><span>${esc(x.title)}${x.due ? ` <small class="muted">${esc(x.due < date ? 'overdue' : x.due === date ? 'today' : fmtShort(x.due))}</small>` : ''}</span></label>`).join('')}</div>` : ''}
      <input name="newFocus" id="f-newFocus" placeholder="Add something new to focus on"></div>
    ${qa('q1', q, answerOf(e, q))}
    ${qa('q2', 'Anything else on your mind?', answerOf(e, 'Anything else on your mind?'))}`;
}
function eveningFields(e, date) {
  const focus = S.tasks.filter(x => x.focus === date);
  const q = e?.notes?.find(n => EVENING_Q.includes(n.q))?.q || promptFor(EVENING_Q, date);
  const doneToday = S.habitLog[date] || [];
  return `${e ? '' : eveningContext()}
    ${scale('mood', MOOD, e?.mood, 'Mood')}
    ${scale('stress', STRESS, e?.stress, 'Stress')}
    ${focus.length ? `<div class="field"><span class="lbl">Today's focus. Check off what got done.</span><div class="pick-list">${focus.map(x => `<label class="check-field"><input type="checkbox" name="fdone" value="${x.id}"${x.done ? ' checked' : ''}><span>${esc(x.title)}</span></label>`).join('')}</div>
      ${checkbox('rollover', 'Move anything unfinished to tomorrow', true)}</div>` : ''}
    ${S.habits.length ? `<div class="field"><span class="lbl">Habits today</span><div class="chips">${S.habits.map(h => `<label class="chip-check"><input type="checkbox" name="habit" value="${h.id}"${doneToday.includes(h.id) ? ' checked' : ''}><span>${esc(h.name)}</span></label>`).join('')}</div></div>` : ''}
    ${qa('q1', 'Win of the day', answerOf(e, 'Win of the day'), 'Big or small')}
    ${qa('q2', q, answerOf(e, q))}
    ${qa('q3', 'Anything else on your mind?', answerOf(e, 'Anything else on your mind?'))}`;
}
function weekStats(ws) {
  const we = addDays(ws, 6);
  const inWk = d => d >= ws && d <= we;
  const cks = S.checkins.filter(c => inWk(c.date));
  return {
    hours: sum(S.time.filter(t => t.end && inWk(isoOf(t.start))), t => hours(t.end - t.start - num(t.breakMin) * 60000)),
    collected: sum(S.invoices.filter(i => i.status === 'paid' && inWk(i.paidDate || i.date)), i => sum(i.lines, l => num(l.qty) * num(l.rate)) * (1 + num(i.taxPct) / 100)),
    workouts: S.workouts.filter(w => inWk(w.date)).length,
    tasks: S.tasks.filter(t => t.done && t.doneAt && inWk(isoOf(t.doneAt))).length,
    mood: avg(cks.map(c => num(c.mood))), energy: avg(cks.map(c => num(c.energy))), sleep: avg(cks.map(c => num(c.sleep))), stress: avg(cks.map(c => num(c.stress))),
    checkins: cks.length,
  };
}
const fmt1 = v => v === null ? '—' : String(round2(Math.round(v * 10) / 10));
function weeklyFields(e) {
  const ws = e?.week || reviewWeek() || weekStart(today());
  const w = weekStats(ws);
  const goals = S.goals.filter(g => !g.done);
  return `<p class="context">${icon('cal')}<span>Week of ${esc(fmtShort(ws))} – ${esc(fmtShort(addDays(ws, 6)))}</span></p>
    <div class="stats three"><div><span>Hours</span><strong>${fmtHrs(w.hours)}</strong></div><div><span>Collected</span><strong>${money(w.collected)}</strong></div><div><span>Workouts</span><strong>${w.workouts}</strong></div>
      <div><span>To-dos done</span><strong>${w.tasks}</strong></div><div><span>Avg mood</span><strong>${fmt1(w.mood)}</strong></div><div><span>Avg sleep</span><strong>${w.sleep ? fmt1(w.sleep) + ' h' : '—'}</strong></div></div>
    ${goals.length ? `<div class="field"><span class="lbl">Goal check</span><div class="goal-updates">${goals.map(g => g.kind === 'manual'
      ? `<label class="goal-upd"><span>${esc(g.title)} <small class="muted">now ${esc(fmtVal(g, current(g)))} · target ${esc(fmtVal(g, num(g.target)))}</small></span><input name="goal-${g.id}" data-goal="${g.id}" inputmode="decimal" placeholder="New value"></label>`
      : `<div class="goal-upd"><span>${esc(g.title)} <small class="muted">tracked automatically</small></span><b>${esc(fmtVal(g, current(g)))}</b></div>`).join('')}</div></div>` : ''}
    ${WEEKLY_Q.map((q, i) => qa('w' + i, q, answerOf(e, q))).join('')}
    ${e ? '' : checkbox('addPriority', 'Add next week\'s top priority to my to-dos for Monday', true)}
    ${qa('w9', 'Anything else on your mind?', answerOf(e, 'Anything else on your mind?'))}`;
}

function saveCheckin(kind, e, date, d, form) {
  const notes = collectNotes(form);
  const rec = e || { id: uid(), kind, date, ts: Date.now() };
  if (kind === 'morning') {
    Object.assign(rec, { sleep: num(d.sleep) || '', energy: num(d.energy) || '', mood: num(d.mood) || '', notes });
    const picked = $$('input[name=focus]', form);
    picked.forEach(c => { const t = S.tasks.find(x => x.id === c.value); if (!t) return; if (c.checked) t.focus = date; else if (t.focus === date) t.focus = ''; });
    if (d.newFocus.trim()) S.tasks.push({ id: uid(), title: d.newFocus.trim(), due: date, cat: 'personal', jobId: '', done: false, focus: date, repeat: '', notes: '' });
  }
  if (kind === 'evening') {
    Object.assign(rec, { mood: num(d.mood) || '', stress: num(d.stress) || '', notes });
    $$('input[name=fdone]', form).forEach(c => {
      const t = S.tasks.find(x => x.id === c.value);
      if (!t) return;
      if (c.checked && !t.done) completeTask(t);
      else if (!c.checked && !t.done && d.rollover) { t.due = addDays(date, 1); t.focus = ''; }
    });
    if ($$('input[name=habit]', form).length) S.habitLog[date] = $$('input[name=habit]:checked', form).map(c => c.value);
  }
  if (kind === 'weekly') {
    rec.week = rec.week || reviewWeek() || weekStart(today());
    Object.assign(rec, { notes });
    $$('input[data-goal]', form).forEach(inp => { const g = S.goals.find(x => x.id === inp.dataset.goal); if (g && inp.value.trim() !== '') logGoal(g, num(inp.value)); });
    const pri = notes.find(n => n.q === "Next week's top priority");
    if (!e && d.addPriority && pri) {
      const mon = addDays(rec.week, 7);
      S.tasks.push({ id: uid(), title: pri.a, due: mon < today() ? today() : mon, cat: 'personal', jobId: '', done: false, focus: '', repeat: '', notes: 'From your weekly review' });
    }
  }
  if (!e) S.checkins.push(rec);
  commit();
  toast(e ? 'Check-in updated' : kind === 'evening' ? 'Logged. Rest up.' : kind === 'weekly' ? 'Week reviewed' : 'Logged. Have a good day.');
}
acts.checkin = el => openCheckin(el.dataset.kind);
acts['checkin-edit'] = el => { const e = S.checkins.find(c => c.id === el.dataset.id); if (e) openCheckin(e.kind, e); };

// ---------- the prompt card on Today ----------
export function promptCard() {
  const due = dueCheckins();
  if (!due.length) return '';
  const k = due[0];
  const copy = {
    morning: ['Good morning', 'How did you sleep, and what matters most today?'],
    evening: ['How did today go?', 'Two minutes: mood, wins, and what carries over to tomorrow.'],
    weekly: ['Time for your weekly review', 'Look back at the week, update your goals, and set next week\'s priority.'],
  }[k];
  const st = streak();
  return `<section class="prompt-card"><div class="row-main"><span class="eyebrow">${icon(k === 'evening' ? 'moon' : k === 'weekly' ? 'book' : 'sun')} ${esc(KIND_LABEL[k])}${st > 1 ? ` · ${st}-day streak` : ''}</span>
    <strong>${esc(copy[0])}</strong><span class="muted">${esc(copy[1])}</span></div>
    <button type="button" class="btn primary" data-act="checkin" data-kind="${k}">Check in</button></section>`;
}

// ---------- insights ----------
function daily(field, kinds, from) {
  const map = {};
  for (const c of S.checkins) if (kinds.includes(c.kind) && c.date >= from && num(c[field]) > 0) (map[c.date] = map[c.date] || []).push(num(c[field]));
  return Object.keys(map).sort().map(x => ({ x, y: round2(avg(map[x])) }));
}
function compare(series, test, a, b) {
  const yes = series.filter(p => test(p.x)), no = series.filter(p => !test(p.x));
  if (yes.length < 3 || no.length < 3) return null;
  const ya = avg(yes.map(p => p.y)), na = avg(no.map(p => p.y));
  return Math.abs(ya - na) >= 0.3 ? { ya, na, a, b, ny: yes.length, nn: no.length } : null;
}
export function insights() {
  const from = addDays(today(), -60);
  const mood = daily('mood', ['morning', 'evening'], from);
  const energy = daily('energy', ['morning'], from);
  const sleep = Object.fromEntries(daily('sleep', ['morning'], from).map(p => [p.x, p.y]));
  const out = [];
  const say = (r, what) => r && out.push(`${what} averages <b>${fmt1(r.ya)}</b> ${r.a} vs <b>${fmt1(r.na)}</b> ${r.b}.`);
  say(compare(mood, d => trainedOn(d), 'on days you train', `on days you don't`), 'Mood');
  say(compare(energy, d => trainedOn(addDays(d, -1)), 'the morning after a workout', 'otherwise'), 'Energy');
  say(compare(energy, d => sleep[d] >= 7, 'after 7+ hours of sleep', 'after less'), 'Energy');
  say(compare(mood, d => hoursOn(d) > 9, 'on days you work more than 9 hours', 'on shorter days'), 'Mood');
  const habitDays = d => (S.habitLog[d] || []).length >= Math.max(1, Math.ceil(S.habits.length * 0.66));
  if (S.habits.length) say(compare(mood, habitDays, 'on days you hit most of your habits', 'on other days'), 'Mood');
  return out;
}
function lowStretch() {
  const recent = [...S.checkins].filter(c => num(c.mood) > 0).sort((a, b) => (b.date + b.kind).localeCompare(a.date + a.kind)).slice(0, 3);
  return recent.length === 3 && recent.every(c => num(c.mood) <= 2);
}

export function view() {
  const t = today();
  const wk = reviewWeek();
  const card = (kind, label, doneE, note) => `<button type="button" class="ci-btn${doneE ? ' done' : ''}" data-act="${doneE ? 'checkin-edit' : 'checkin'}" data-kind="${kind}" data-id="${doneE?.id || ''}">
      ${icon(kind === 'evening' ? 'moon' : kind === 'weekly' ? 'book' : 'sun')}<span><b>${label}</b><small>${doneE ? `Done ${fmtTime(hmOf(doneE.ts))} · edit` : note}</small></span>${doneE ? icon('check', 'ok') : ''}</button>`;
  const weeklyE = S.checkins.find(c => c.kind === 'weekly' && c.week === (wk || weekStart(t)));
  const from = addDays(t, -30);
  const mood = daily('mood', ['morning', 'evening'], from);
  const energy = daily('energy', ['morning'], from);
  const sleep = daily('sleep', ['morning'], from);
  const thisW = weekStats(weekStart(t)), lastW = weekStats(addDays(weekStart(t), -7));
  const delta = (a, b, unit = '') => a === null || b === null ? '' : `<small class="${a - b > 0.05 ? 'good-text' : a - b < -0.05 ? 'bad-text' : 'muted'}">${a - b > 0 ? '+' : ''}${fmt1(a - b)}${unit} vs last week</small>`;
  const ins = insights();
  const st = streak();
  return `<div class="ci-grid">${card('morning', 'Morning', entry('morning'), 'Sleep, energy, today\'s focus')}${card('evening', 'Evening', entry('evening'), 'Mood, wins, wrap up the day')}${card('weekly', 'Weekly review', weeklyE, wk ? 'Due now' : `Opens ${fmtDate(addDays(weekStart(t), (num(set('reviewDay')) + 6) % 7), { weekday: 'long' })}`)}</div>
    ${st ? `<p class="muted small">${st}-day check-in streak.</p>` : ''}
    ${lowStretch() ? `<p class="callout">Your last few check-ins have been low. Go easy on yourself: sleep, food, a walk, and a talk with someone you trust. If it keeps up, reach out to a doctor or counselor.</p>` : ''}
    <section class="group"><header class="group-head"><h3>This week</h3></header>
      <div class="stats three"><div><span>Mood</span><strong>${fmt1(thisW.mood)}</strong>${delta(thisW.mood, lastW.mood)}</div><div><span>Energy</span><strong>${fmt1(thisW.energy)}</strong>${delta(thisW.energy, lastW.energy)}</div><div><span>Sleep</span><strong>${thisW.sleep ? fmt1(thisW.sleep) + ' h' : '—'}</strong>${delta(thisW.sleep, lastW.sleep, ' h')}</div></div></section>
    <section class="chart-card"><header class="group-head"><h3>Mood and energy, 30 days</h3></header>
      ${mood.length > 1 ? `${lineChart(mood, { avg: energy, yMin: 1, yMax: 5, yStep: 1, fmt: v => String(Math.round(v * 10) / 10) })}<p class="legend"><i class="sw line"></i> Mood <i class="sw avg"></i> Energy (1 low, 5 high)</p>` : '<p class="muted small chart-empty">Check in a couple of days to see your trend.</p>'}</section>
    ${sleep.length > 1 ? `<section class="chart-card"><header class="group-head"><h3>Sleep, hours</h3></header>${lineChart(sleep, { fmt: v => String(Math.round(v * 10) / 10) })}</section>` : ''}
    <section class="group"><header class="group-head"><h3>Patterns</h3></header>
      ${ins.length ? `<ul class="plain insights">${ins.map(s => `<li>${icon('bolt')}<span>${s}</span></li>`).join('')}</ul>` : '<p class="muted small">After a couple of weeks of check-ins Daybook compares your days: training vs rest, long vs short workdays, sleep, and habits.</p>'}</section>`;
}

// ---------- journal ----------
export function journalView() {
  const list = [...S.checkins].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  if (!list.length) return empty('Nothing here yet', 'Every check-in and weekly review is saved here so you can look back.', `<button type="button" class="btn" data-act="checkin" data-kind="${new Date().getHours() < 14 ? 'morning' : 'evening'}">Check in now</button>`);
  const dates = [...new Set(list.map(c => c.date))].slice(0, 90);
  return `<div class="toolbar"><label class="sr-only" for="journal-q">Search the journal</label><input id="journal-q" class="grow" type="search" placeholder="Search your answers" data-journal-search autocomplete="off">
      <button type="button" class="btn ghost sm" data-act="journal-export">${icon('download')} Export</button></div>
    ${dates.map(d => `<section class="group journal-day"><header class="group-head"><h3>${esc(fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' }))}</h3></header>
      ${list.filter(c => c.date === d).map(c => `<article class="panel pad journal-entry" data-act="checkin-edit" data-id="${c.id}" role="button" tabindex="0">
        <header class="inline"><b>${esc(KIND_LABEL[c.kind])}</b><span class="muted small">${fmtTime(hmOf(c.ts))}</span><span class="grow"></span>
          ${c.mood ? pill(`Mood ${c.mood} · ${MOOD[c.mood - 1]}`, c.mood >= 4 ? 'good' : c.mood <= 2 ? 'warn' : 'muted') : ''}${c.energy ? pill(`Energy ${c.energy}`, 'muted') : ''}${c.stress ? pill(`Stress ${c.stress}`, c.stress >= 4 ? 'warn' : 'muted') : ''}${c.sleep ? pill(`${c.sleep} h sleep`, 'muted') : ''}</header>
        ${(c.notes || []).map(n => `<p class="qa"><span>${esc(n.q)}</span>${esc(n.a)}</p>`).join('')}</article>`).join('')}</section>`).join('')}`;
}
document.addEventListener('input', e => {
  if (!e.target.matches('[data-journal-search]')) return;
  const q = e.target.value.trim().toLowerCase();
  $$('.journal-entry').forEach(a => { a.hidden = !!q && !a.textContent.toLowerCase().includes(q); });
  $$('.journal-day').forEach(s => { s.hidden = !s.querySelector('.journal-entry:not([hidden])'); });
});
acts['journal-export'] = () => {
  const lines = [...S.checkins].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts).flatMap(c => [
    `## ${c.date} · ${KIND_LABEL[c.kind]}`,
    [c.mood && `Mood ${c.mood}/5`, c.energy && `Energy ${c.energy}/5`, c.stress && `Stress ${c.stress}/5`, c.sleep && `Sleep ${c.sleep} h`].filter(Boolean).join(' · '),
    ...(c.notes || []).map(n => `**${n.q}** ${n.a}`), '']);
  download(`daybook-journal-${today()}.md`, `# Daybook journal\n\n${lines.join('\n')}`, 'text/markdown');
};

// ---------- calendar reminders: the phone's own calendar asks you to check in ----------
export function reminderICS() {
  const url = location.href.split('#')[0] + '#life';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const start = (hm, d = addDays(today(), 1)) => d.replace(/-/g, '') + 'T' + hm.replace(':', '') + '00';
  const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const rd = num(set('reviewDay'));
  let first = addDays(today(), 1);
  while (parseDate(first).getDay() !== rd) first = addDays(first, 1);
  const ev = (id, title, dt, rule) => ['BEGIN:VEVENT', `UID:${id}@daybook`, `DTSTAMP:${stamp}`, `DTSTART:${dt}`, 'DURATION:PT5M', `RRULE:${rule}`, `SUMMARY:${title}`, `DESCRIPTION:Open Daybook: ${url}`, `URL:${url}`, 'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM', 'END:VEVENT'];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daybook//EN',
    ...ev('checkin-am', 'Daybook: morning check-in', start(set('amTime') || '07:00'), 'FREQ=DAILY'),
    ...ev('checkin-pm', 'Daybook: evening check-in', start(set('pmTime') || '20:30'), 'FREQ=DAILY'),
    ...ev('checkin-week', 'Daybook: weekly review', start('18:00', first), `FREQ=WEEKLY;BYDAY=${days[rd]}`),
    'END:VCALENDAR'].join('\r\n');
}
acts['checkin-reminders'] = () => { download('daybook-check-in-reminders.ics', reminderICS(), 'text/calendar'); toast('Open the file to add the reminders to your calendar.', { ms: 6000 }); };
