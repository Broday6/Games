// Today: the day at a glance across work, gym and life.
import { esc, acts, icon, today, addDays, fmtDate, money, fmtHrs, hours, sum } from './util.js';
import { S, commit, replaceState, fresh } from './store.js';
import { sampleData } from './seed.js';
import { timerCard, eventRow, todaysEvents, weekStats, openWork, eventsOn } from './work.js';
import { todayCard } from './gym.js';
import { taskRow, dueTasks, habitChips, quickAdd } from './life.js';
import { promptCard } from './checkin.js';
import { focusTasks, isFocus } from './tasks.js';

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

export function view() {
  const t = today();
  const evs = todaysEvents();
  const tomorrow = eventsOn(addDays(t, 1));
  const due = dueTasks().filter(x => !isFocus(x));
  const focus = focusTasks();
  const ws = weekStats();
  return `${!S.welcomed ? welcome() : promptCard()}
    ${timerCard()}
    <section class="group"><header class="group-head"><h3>Schedule</h3><button type="button" class="btn ghost sm" data-act="ev-new" data-date="${t}">${icon('plus')} Add</button></header>
      ${evs.length ? `<div class="list panel">${evs.map(e => eventRow(e)).join('')}</div>` : `<p class="muted small">Nothing scheduled today.${tomorrow.length ? ` Tomorrow: ${tomorrow.map(e => e.title || 'visit').slice(0, 3).join(', ')}.` : ''}</p>`}</section>
    ${focus.length ? `<section class="group"><header class="group-head"><h3>Today's focus</h3><span class="muted">${focus.length} of 3</span></header><div class="list panel focus-list">${focus.map(taskRow).join('')}</div></section>` : ''}
    <section class="group"><header class="group-head"><h3>To-do</h3><button type="button" class="btn ghost sm" data-act="go-life" data-v="todo">All</button></header>
      ${due.length ? `<div class="list panel">${due.map(taskRow).join('')}</div>` : ''}${quickAdd('qa-today')}</section>
    ${S.habits.length ? `<section class="group"><header class="group-head"><h3>Habits</h3></header>${habitChips()}</section>` : ''}
    ${todayCard()}
    <section class="group"><header class="group-head"><h3>This week</h3></header>
      <div class="stats">
        <button type="button" data-act="go-work" data-v="time"><span>Hours</span><strong>${fmtHrs(hours(ws.ms))}</strong></button>
        <button type="button" data-act="go-work" data-v="time"><span>Hourly earned</span><strong>${money(ws.value)}</strong></button>
        <button type="button" data-act="go-work" data-v="invoices"><span>Ready to bill</span><strong>${money(ws.unbilled)}</strong></button>
        <button type="button" data-act="go-work" data-v="invoices"><span>Owed to you</span><strong class="${ws.overdue ? 'bad-text' : ''}">${money(ws.outstanding)}</strong>${ws.overdue ? `<small class="bad-text">${ws.overdue} overdue</small>` : ''}</button>
      </div></section>
    <div class="quick">
      <button type="button" class="btn" data-act="time-new">${icon('clock')} Log hours</button>
      <button type="button" class="btn" data-act="exp-new">${icon('receipt')} Expense</button>
      <button type="button" class="btn" data-act="exp-new" data-kind="mileage">${icon('pin')} Miles</button>
      <button type="button" class="btn" data-act="job-new">${icon('work')} New job</button>
    </div>`;
}
export const title = () => fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric' });
