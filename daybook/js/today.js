// Today: the day at a glance across work, gym and life.
import { esc, acts, icon, sheet, today, addDays, fmtDate, fmtTime, money, fmtHrs, hours, parseDate } from './util.js';
import { S, commit, replaceState, fresh } from './store.js';
import { sampleData } from './seed.js';
import { timerCard, eventRow, todaysEvents, weekStats, openWork, eventsOn } from './work.js';
import { todayCard } from './gym.js';
import { taskRow, dueTasks, habitChips, quickAdd, timedToday } from './life.js';
import { askBar } from './assistant.js';
import { promptCard } from './checkin.js';
import { focusTasks, isFocus } from './tasks.js';
import { timeline, unplannedCount } from './plan.js';
import { followupsCard } from './people.js';
import * as habits from './habits.js';
import { workoutPlannedOn } from './gym.js';

function welcome() {
  return `<section class="welcome">
    <h2>Run your week from one place</h2>
    <p>Daybook keeps your contracting work and your training side by side: schedule visits, clock hours to jobs, log materials and miles, send invoices, and track every set you lift.</p>
    <ul class="plain">
      <li>${icon('work')} Jobs, clients, schedule, time clock and invoices built from your logged hours</li>
      <li>${icon('gym')} Workout logger that suggests your next weight, flags PRs and runs your rest timer</li>
      <li>${icon('heart')} Bluetooth heart-rate straps and hands-free voice logging (“225 for 8”)</li>
      <li>${icon('sun')} Morning and evening check-ins that ask how you are doing, plus goals, habits and a journal</li>
    </ul>
    <p class="muted small">Everything stays on this device. Export a backup from More any time.</p>
    <div class="row-actions wrap"><button type="button" class="btn primary" data-act="sample">Explore with sample data</button><button type="button" class="btn" data-act="start-fresh">Start with my own</button></div>
  </section>`;
}
acts.sample = () => { sampleData(S); commit(); };
acts['start-fresh'] = () => { S.welcomed = true; commit(); };
acts['clear-sample'] = () => { const ui = S.ui; replaceState(fresh()); S.welcomed = true; S.ui = { ...ui, lastJob: '' }; commit(); };
acts['go-life'] = el => { S.ui.lifeTab = el.dataset.v; location.hash = 'life'; };
acts['go-work'] = el => { openWork(el.dataset.v); location.hash = 'work'; };

// Today is yours to arrange: More → Customize Today, or the button at the bottom.
export const SECTIONS = [['rings', 'Your day (rings)'], ['checkin', 'Check-in prompt'], ['ask', 'Ask Claude'], ['timer', 'Time clock'], ['schedule', 'Schedule'], ['people', 'Follow-ups'], ['focus', "Today's focus"], ['todo', 'To-do'], ['habits', 'Habits'], ['gym', 'Gym'], ['week', 'This week (work numbers)'], ['quick', 'Quick buttons']];
export function layout() {
  const saved = String(S.settings.todayLayout || '').split(',').filter(Boolean).map(x => x.split(':')).filter(([k]) => SECTIONS.some(s => s[0] === k));
  const missing = SECTIONS.filter(([k]) => !saved.some(([x]) => x === k)).map(([k]) => [k, '1']);
  return [...saved, ...missing].map(([k, on]) => ({ k, on: on !== '0' }));
}
const saveLayout = l => { S.settings.todayLayout = l.map(x => `${x.k}:${x.on ? 1 : 0}`).join(','); };

// ---------- daily rings: plan, habits, body ----------
const isoOf = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function dayRings(d) {
  const focus = S.tasks.filter(x => x.focus === d);
  let plan = null, planLabel = '';
  if (focus.length) { const n = focus.filter(x => x.done).length; plan = n / focus.length; planLabel = `${n} of ${focus.length} focus`; }
  else if (d === today()) {
    const dueD = S.tasks.filter(x => (!x.done && x.due && x.due <= d) || (x.done && x.doneAt && isoOf(x.doneAt) === d && x.due && x.due <= d));
    if (dueD.length) { const n = dueD.filter(x => x.done).length; plan = n / dueD.length; planLabel = `${n} of ${dueD.length} due`; }
  }
  const hs = habits.active().filter(h => habits.scheduledOn(h, d));
  const hn = hs.filter(h => habits.isDone(h, d)).length;
  const hab = hs.length ? hn / hs.length : null;
  const trained = S.workouts.some(w => w.date === d);
  const due = workoutPlannedOn(d);
  const body = trained ? 1 : due ? 0 : null;
  return { plan, planLabel, hab, habLabel: hs.length ? `${hn} of ${hs.length}` : 'none today', body, bodyLabel: trained ? 'Trained' : due ? (due.start ? `Workout ${fmtTime(due.start)}` : 'Workout day') : 'Rest day' };
}
const full = r => [r.plan, r.hab, r.body].filter(v => v !== null).length > 0 && [r.plan, r.hab, r.body].every(v => v === null || v >= 1);
export function fullStreak() {
  let d = full(dayRings(today())) ? today() : addDays(today(), -1), n = 0;
  for (let i = 0; i < 365 && full(dayRings(d)); i++, d = addDays(d, -1)) n++;
  return n;
}
function ringsCard() {
  const r = dayRings(today());
  const ring = (v, rad, cls) => { const c = 2 * Math.PI * rad; const p = v === null ? 1 : Math.max(0, Math.min(1, v)); return `<circle class="ring-bg ${cls}" r="${rad}" cx="44" cy="44"/><circle class="ring ${cls}${v === null ? ' rest' : ''}${p === 0 ? ' zero' : ''}" r="${rad}" cx="44" cy="44" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 44 44)"/>`; };
  const week = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const st = fullStreak();
  return `<section class="rings-card">
    <svg class="rings" viewBox="0 0 88 88" role="img" aria-label="Plan ${Math.round((r.plan ?? 0) * 100)}%, habits ${Math.round((r.hab ?? 0) * 100)}%, body ${r.body === null ? 'rest day' : Math.round(r.body * 100) + '%'}">${ring(r.plan ?? 0, 38, 'r-plan')}${ring(r.hab ?? 0, 28, 'r-hab')}${ring(r.body, 18, 'r-body')}</svg>
    <div class="ring-legend">
      <div><i class="dot r-plan"></i><b>Plan</b><span>${esc(r.planLabel || 'Star up to 3 focus items')}</span></div>
      <div><i class="dot r-hab"></i><b>Habits</b><span>${esc(r.habLabel)}</span></div>
      <div><i class="dot r-body"></i><b>Body</b><span>${esc(r.bodyLabel)}</span></div>
      <div class="ring-week" aria-label="Full days this week">${week.map(d => `<span class="${full(dayRings(d)) ? 'on' : ''}${d === today() ? ' is-today' : ''}" title="${esc(fmtDate(d))}">${fmtDate(d, { weekday: 'narrow' })}</span>`).join('')}<small>${st ? `${st}-day run of full days` : 'Close all three rings for a full day'}</small></div>
    </div></section>`;
}

export function view() {
  const t = today();
  const evs = todaysEvents();
  const timed = timedToday();
  const tomorrow = eventsOn(addDays(t, 1));
  const due = dueTasks().filter(x => !isFocus(x) && !(x.due === t && x.time));
  const focus = focusTasks();
  const items = [...evs.map(e => [e.start || '99', eventRow(e)]), ...timed.map(x => [x.time, taskRow(x)])].sort((a, b) => a[0].localeCompare(b[0]));
  const sec = {
    checkin: () => (S.welcomed ? promptCard() : ''),
    ask: () => askBar(),
    timer: () => (S.jobs.length || S.timer ? timerCard() : ''),
    rings: () => ringsCard(),
    people: () => followupsCard(),
    schedule: () => {
      const tl = S.settings.schedView !== 'list';
      const want = unplannedCount();
      const planned = S.tasks.some(x => x.planned === t && !x.done);
      return `<section class="group"><header class="group-head"><h3>Schedule</h3><span class="head-tools">
        <span class="segs mini" role="tablist"><button type="button" class="seg${tl ? ' on' : ''}" data-act="sched-view" data-v="timeline" aria-selected="${tl}">Timeline</button><button type="button" class="seg${tl ? '' : ' on'}" data-act="sched-view" data-v="list" aria-selected="${!tl}">List</button></span>
        <button type="button" class="icon-btn sm" data-act="ev-new" data-date="${t}" aria-label="Add to schedule">${icon('plus')}</button></span></header>
      ${want || planned ? `<div class="plan-bar">${want ? `<span>${want} to-do${want > 1 ? 's' : ''} without a time today</span><button type="button" class="btn sm primary" data-act="plan-day">${icon('bolt')} Plan my day</button>` : '<span>Your free time is planned.</span>'}${planned ? '<button type="button" class="btn ghost sm" data-act="plan-clear">Clear plan</button>' : ''}</div>` : ''}
      ${tl ? timeline(t) : items.length ? `<div class="list panel">${items.map(i => i[1]).join('')}</div>` : `<p class="muted small">Nothing scheduled today.${tomorrow.length ? ` Tomorrow: ${esc(tomorrow.map(e => e.title || 'visit').slice(0, 3).join(', '))}.` : ''}</p>`}</section>`;
    },
    focus: () => (focus.length ? `<section class="group"><header class="group-head"><h3>Today's focus</h3><span class="muted">${focus.length} of 3</span></header><div class="list panel focus-list">${focus.map(x => taskRow(x)).join('')}</div></section>` : ''),
    todo: () => `<section class="group"><header class="group-head"><h3>To-do</h3><button type="button" class="btn ghost sm" data-act="go-life" data-v="todo">All</button></header>
      ${due.length ? `<div class="list panel">${due.map(x => taskRow(x)).join('')}</div>` : ''}${quickAdd('qa-today')}</section>`,
    habits: () => { const c = habitChips(); return c ? `<section class="group"><header class="group-head"><h3>Habits</h3><button type="button" class="btn ghost sm" data-act="go-life" data-v="habits">All</button></header>${c}</section>` : ''; },
    gym: () => todayCard(),
    week: () => { const ws = weekStats(); return (S.jobs.length ? `<section class="group"><header class="group-head"><h3>This week</h3></header>
      <div class="stats">
        <button type="button" data-act="go-work" data-v="time"><span>Hours</span><strong>${fmtHrs(hours(ws.ms))}</strong></button>
        <button type="button" data-act="go-work" data-v="time"><span>Hourly earned</span><strong>${money(ws.value)}</strong></button>
        <button type="button" data-act="go-work" data-v="invoices"><span>Ready to bill</span><strong>${money(ws.unbilled)}</strong></button>
        <button type="button" data-act="go-work" data-v="invoices"><span>Owed to you</span><strong class="${ws.overdue ? 'bad-text' : ''}">${money(ws.outstanding)}</strong>${ws.overdue ? `<small class="bad-text">${ws.overdue} overdue</small>` : ''}</button>
      </div></section>` : ''); },
    quick: () => `<div class="quick">
      <button type="button" class="btn" data-act="time-new">${icon('clock')} Log hours</button>
      <button type="button" class="btn" data-act="exp-new">${icon('receipt')} Expense</button>
      <button type="button" class="btn" data-act="exp-new" data-kind="mileage">${icon('pin')} Miles</button>
      <button type="button" class="btn" data-act="job-new">${icon('work')} New job</button>
    </div>`,
  };
  return `${!S.welcomed ? welcome() : ''}${layout().filter(x => x.on).map(x => sec[x.k]()).join('')}
    <div class="row-actions center-row"><button type="button" class="btn ghost sm" data-act="today-layout">${icon('more')} Customize Today</button></div>`;
}

acts['today-layout'] = () => {
  const draw = el => {
    const l = layout();
    el.querySelector('[data-rows]').innerHTML = l.map((x, i) => `<div class="layout-row"><label class="check-field"><input type="checkbox" data-on="${x.k}"${x.on ? ' checked' : ''}><span>${esc(SECTIONS.find(s => s[0] === x.k)[1])}</span></label>
      <span class="grow"></span><button type="button" class="icon-btn sm" data-mv="${i}" data-d="-1" aria-label="Move up"${i ? '' : ' disabled'}>${icon('up')}</button><button type="button" class="icon-btn sm" data-mv="${i}" data-d="1" aria-label="Move down"${i < l.length - 1 ? '' : ' disabled'}>${icon('down')}</button></div>`).join('');
  };
  sheet({
    title: 'Customize Today',
    body: `<p class="muted small">Show what you use, in the order you want it. Changes apply right away.</p><div class="layout-rows" data-rows></div>
      <div class="row-actions"><button type="button" class="btn ghost sm" data-reset>Reset</button><span class="grow"></span><button type="button" class="btn primary" data-close>Done</button></div>`,
    onMount: el => {
      draw(el);
      el.addEventListener('change', e => { const k = e.target.dataset.on; if (!k) return; const l = layout(); l.find(x => x.k === k).on = e.target.checked; saveLayout(l); commit(); });
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-mv]');
        if (b) { const l = layout(), i = +b.dataset.mv, j = i + +b.dataset.d; [l[i], l[j]] = [l[j], l[i]]; saveLayout(l); commit(); draw(el); }
        if (e.target.closest('[data-reset]')) { S.settings.todayLayout = ''; commit(); draw(el); }
      });
    },
  });
};
export const greeting = () => { const h = new Date().getHours(); const n = String(S.settings.name || '').split(' ')[0]; return `${h < 5 ? 'Up early' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}${n ? ', ' + n : ''}`; };
export const title = () => fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric' });
