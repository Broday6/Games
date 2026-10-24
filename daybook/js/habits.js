// Habits, built on what makes them stick: a cue ("after I pour coffee"), a time of day, the days it applies,
// a small daily target for countable ones, and streaks that survive a single miss ("never miss twice").
// Some habits check themselves off from the rest of the app (a logged workout, a check-in).
import { esc, uid, num, acts, icon, toast, sheet, formSheet, field, input, numInput, select, today, addDays, parseDate, fmtDate, dayPicker, daysLabel, WEEK_ORDER, $$ } from './util.js';
import { S, commit, undoable } from './store.js';

export const WHEN = [['morning', 'Morning'], ['midday', 'Midday'], ['evening', 'Evening'], ['anytime', 'Any time']];
const WHEN_ORDER = Object.fromEntries(WHEN.map(([k], i) => [k, i]));
export const LINKS = [['', 'I check it off myself'], ['workout', 'When I finish a workout'], ['checkin-am', 'When I do my morning check-in'], ['checkin-pm', 'When I do my evening check-in']];

// Starter ideas: small, specific, tied to a cue. Tapping one fills the form.
export const IDEAS = [
  { name: 'Drink water', when: 'anytime', target: 8, unit: 'glasses', cue: 'Every time I get back in the truck' },
  { name: 'Morning devotional', when: 'morning', cue: 'After my first cup of coffee' },
  { name: 'Plan tomorrow (2 minutes)', when: 'evening', cue: 'Before I leave the last job site' },
  { name: 'Read 10 pages', when: 'evening', cue: 'When I get into bed' },
  { name: 'Stretch 5 minutes', when: 'morning', cue: 'Right after my workout' },
  { name: 'No phone for the first 30 minutes', when: 'morning', cue: 'When my alarm goes off' },
  { name: 'Walk after dinner', when: 'evening', cue: 'After I put my plate in the sink' },
  { name: 'Lights out by 10:30', when: 'evening', cue: 'When the 10pm reminder goes off' },
  { name: 'Hit protein target', when: 'anytime' },
  { name: 'Call or text someone I care about', when: 'midday', cue: 'On my lunch break' },
];

const daysOf = h => (h.days?.length ? h.days : [0, 1, 2, 3, 4, 5, 6]);
export const target = h => Math.max(1, Math.round(num(h.target)) || 1);
export const scheduledOn = (h, d) => !h.archived && daysOf(h).includes(parseDate(d).getDay());
function linkDone(h, d) {
  if (h.link === 'workout') return S.workouts.some(w => w.date === d);
  if (h.link === 'checkin-am') return S.checkins.some(c => c.kind === 'morning' && c.date === d);
  if (h.link === 'checkin-pm') return S.checkins.some(c => c.kind === 'evening' && c.date === d);
  return false;
}
export const countOn = (h, d) => (linkDone(h, d) ? target(h) : (S.habitCount?.[d]?.[h.id] ?? ((S.habitLog[d] || []).includes(h.id) ? target(h) : 0)));
export const isDone = (h, d) => countOn(h, d) >= target(h);

export function setCount(h, d, n) {
  n = Math.max(0, Math.min(target(h), n));
  S.habitCount = S.habitCount || {};
  const day = S.habitCount[d] = { ...(S.habitCount[d] || {}) };
  if (n > 0 && target(h) > 1) day[h.id] = n; else delete day[h.id];
  if (!Object.keys(day).length) delete S.habitCount[d];
  const log = (S.habitLog[d] || []).filter(id => id !== h.id);
  if (n >= target(h)) log.push(h.id);
  if (log.length) S.habitLog[d] = log; else delete S.habitLog[d];
}

// Counts scheduled days kept, walking back from today. One missed day is forgiven if the next one was kept;
// two misses in a row end the streak. Today only counts once it is done.
export function streak(h) {
  let d = isDone(h, today()) ? today() : addDays(today(), -1);
  let n = 0, miss = 0;
  for (let i = 0; i < 1100; i++, d = addDays(d, -1)) {
    if (!scheduledOn(h, d)) continue;
    if (isDone(h, d)) { n++; miss = 0; } else if (++miss >= 2) break;
  }
  return n;
}
// The last scheduled day before today was missed and today is not done yet: don't miss twice.
export function atRisk(h) {
  if (!scheduledOn(h, today()) || isDone(h, today())) return false;
  let d = addDays(today(), -1);
  for (let i = 0; i < 7 && !scheduledOn(h, d); i++) d = addDays(d, -1);
  return scheduledOn(h, d) && !isDone(h, d) && streak(h) > 0;
}
// When the habit started: its creation date, or the first day it was ever checked off (older habits).
const since = h => {
  const logged = Object.keys(S.habitLog).filter(d => S.habitLog[d].includes(h.id)).sort()[0];
  return [h.created, logged].filter(Boolean).sort()[0] || today();
};
export function rate(h, days = 30) {
  let kept = 0, due = 0;
  const start = since(h);
  for (let i = 0; i < days; i++) {
    const d = addDays(today(), -i);
    if (d < start) break;
    if (!scheduledOn(h, d) || (i === 0 && !isDone(h, d))) continue;
    due++; if (isDone(h, d)) kept++;
  }
  return due ? kept / due : null;
}
export const active = () => S.habits.filter(h => !h.archived);
export const todays = () => active().filter(h => scheduledOn(h, today())).sort((a, b) => (WHEN_ORDER[a.when || 'anytime'] - WHEN_ORDER[b.when || 'anytime']));

acts.habit = el => {
  const h = S.habits.find(x => x.id === el.dataset.id);
  if (!h) return;
  const d = el.dataset.date || today();
  if (linkDone(h, d)) return toast(`This one checks itself off ${LINKS.find(l => l[0] === h.link)[1].toLowerCase()}.`);
  const c = countOn(h, d);
  if (el.dataset.set === 'toggle' || target(h) === 1) setCount(h, d, c >= target(h) ? 0 : target(h));
  else setCount(h, d, c >= target(h) ? 0 : c + 1);
  commit();
};

export function habitChips() {
  const list = todays();
  if (!list.length) return '';
  return `<div class="chips">${list.map(h => {
    const c = countOn(h, today()), t = target(h), on = c >= t, st = streak(h), risk = atRisk(h);
    return `<button type="button" class="chip habit-chip${on ? ' on' : ''}${risk ? ' risk' : ''}" data-act="habit" data-id="${h.id}" aria-pressed="${on}" title="${esc(h.cue ? 'Cue: ' + h.cue : h.name)}">
      ${on ? icon('check') : ''}${esc(h.name)}${t > 1 ? ` <b class="count">${c}/${t}</b>` : ''}${st > 1 ? ` <small>${st}d</small>` : ''}${risk ? ' <small class="risk-tag">don\'t miss twice</small>' : ''}</button>`;
  }).join('')}</div>`;
}

export function view() {
  const list = active();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const groups = WHEN.map(([k, l]) => [l, list.filter(h => (h.when || 'anytime') === k)]).filter(g => g[1].length);
  const card = h => {
    const st = streak(h), r = rate(h), t = target(h);
    return `<article class="habit-card${atRisk(h) ? ' risk' : ''}">
      <header><button type="button" class="link hg-name" data-act="habit-edit" data-id="${h.id}">${esc(h.name)}</button>
        <span class="habit-streak" title="Streak, forgiving one missed day">${st ? `${st}<small>day${st > 1 ? 's' : ''}</small>` : ''}</span></header>
      <p class="muted small">${[h.cue ? `${esc(h.cue)}` : '', daysLabel(daysOf(h)), t > 1 ? `${t} ${esc(h.unit || 'times')} a day` : '', h.link ? 'checks itself off' : ''].filter(Boolean).join(' · ')}</p>
      <div class="hc-days">${days.map(d => {
        const sch = scheduledOn(h, d), on = isDone(h, d), c = countOn(h, d);
        return sch
          ? `<button type="button" class="hg-cell${on ? ' on' : c ? ' part' : ''}${d === today() ? ' is-today' : ''}" data-act="habit" data-set="toggle" data-id="${h.id}" data-date="${d}" aria-label="${esc(h.name)} on ${esc(fmtDate(d))}" aria-pressed="${on}"><small>${fmtDate(d, { weekday: 'narrow' })}</small>${on ? icon('check') : c ? `<b>${c}</b>` : ''}</button>`
          : `<span class="hg-cell off" aria-hidden="true"><small>${fmtDate(d, { weekday: 'narrow' })}</small></span>`;
      }).join('')}<span class="hc-rate">${r === null ? '' : Math.round(r * 100) + '%'}<small>${r === null ? '' : '30 days'}</small></span></div>
      ${atRisk(h) ? '<p class="risk-note">You missed last time. Doing it today keeps your streak alive.</p>' : ''}
    </article>`;
  };
  return `<p class="muted small">Tie each habit to a cue you already do, keep it small, and never miss twice. Tap a day to fill it in.</p>
    ${groups.map(([l, hs]) => `<section class="group"><header class="group-head"><h3>${l}</h3></header><div class="habit-list">${hs.map(card).join('')}</div></section>`).join('') || ''}
    <div class="row-actions wrap"><button type="button" class="btn" data-act="habit-new">${icon('plus')} Habit</button><button type="button" class="btn ghost" data-act="habit-ideas">Ideas</button></div>
    ${S.habits.some(h => h.archived) ? `<p class="muted small">Paused: ${S.habits.filter(h => h.archived).map(h => `<button type="button" class="link" data-act="habit-edit" data-id="${h.id}">${esc(h.name)}</button>`).join(', ')}</p>` : ''}`;
}

acts['habit-new'] = () => habitForm();
acts['habit-edit'] = el => habitForm(S.habits.find(h => h.id === el.dataset.id));
acts['habit-ideas'] = () => {
  const s = sheet({
    title: 'Habit ideas',
    body: `<p class="muted small">Small habits tied to something you already do stick best. Pick one to start; you can change anything.</p>
      <div class="list panel">${IDEAS.map((x, i) => `<div class="row" data-idea="${i}" role="button" tabindex="0"><div class="row-main"><div class="row-title">${esc(x.name)}${x.target ? ` <span class="muted">· ${x.target} ${esc(x.unit)}</span>` : ''}</div>${x.cue ? `<div class="row-sub">${esc(x.cue)}</div>` : ''}</div>${icon('plus')}</div>`).join('')}</div>`,
  });
  s.el.addEventListener('click', e => { const r = e.target.closest('[data-idea]'); if (r) { s.close(); habitForm({ ...IDEAS[+r.dataset.idea], id: '' }); } });
};

function habitForm(h = {}) {
  const isNew = !h.id;
  const i = S.habits.indexOf(h);
  formSheet({
    title: isNew ? 'New habit' : 'Edit habit',
    fields: `${field('Habit', input('name', h.name || '', 'text', 'required autofocus placeholder="e.g. Read 10 pages"'))}
      ${field('Cue', input('cue', h.cue || '', 'text', 'placeholder="After I… (pour coffee, park the truck, get into bed)"'), 'Linking a habit to something you already do makes it automatic.')}
      <div class="grid2">${field('Time of day', select('when', WHEN, h.when || 'anytime'))}${field('Checks itself off', select('link', LINKS, h.link || ''))}</div>
      <div class="field"><span class="lbl">Days</span>${dayPicker('hday', daysOf(h))}</div>
      <div class="grid2">${field('Times a day', numInput('target', h.target || 1))}${field('Unit', input('unit', h.unit || '', 'text', 'placeholder="glasses, pages"'))}</div>
      ${isNew ? '' : `<div class="row-actions wrap"><button type="button" class="btn ghost sm" data-mv="-1"${i > 0 ? '' : ' disabled'}>${icon('up')} Move up</button><button type="button" class="btn ghost sm" data-mv="1"${i < S.habits.length - 1 ? '' : ' disabled'}>${icon('down')} Move down</button>
        <button type="button" class="btn ghost sm" data-pause>${h.archived ? 'Resume' : 'Pause'}</button></div>`}`,
    del: isNew ? null : () => undoable('Habit deleted', () => { S.habits = S.habits.filter(x => x.id !== h.id); }),
    onMount: (el, s) => {
      el.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => {
        const k = S.habits.indexOf(h), j = k + +b.dataset.mv;
        if (j < 0 || j >= S.habits.length) return;
        [S.habits[k], S.habits[j]] = [S.habits[j], S.habits[k]];
        s.close(); commit();
      }));
      el.querySelector('[data-pause]')?.addEventListener('click', () => { h.archived = !h.archived; s.close(); commit(); toast(h.archived ? 'Paused. It keeps its history.' : 'Resumed'); });
    },
    onSubmit: (d, form) => {
      if (!d.name.trim()) { toast('Name the habit.'); return false; }
      const days = $$('input[name=hday]:checked', form).map(c => +c.value);
      if (!days.length) { toast('Pick at least one day.'); return false; }
      const data = { name: d.name.trim(), cue: d.cue.trim(), when: d.when, link: d.link, days: days.length === 7 ? [] : WEEK_ORDER.filter(x => days.includes(x)), target: Math.max(1, Math.round(num(d.target)) || 1), unit: d.unit.trim() };
      if (isNew) S.habits.push({ id: uid(), created: today(), ...data }); else Object.assign(h, data);
      commit();
      toast(isNew ? 'Habit added' : 'Habit saved');
    },
  });
}
