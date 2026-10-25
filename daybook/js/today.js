// Today: the day at a glance across work, gym and life.
import { esc, acts, icon, sheet, today, addDays, fmtDate, money, fmtHrs, hours } from './util.js';
import { S, commit, replaceState, fresh } from './store.js';
import { sampleData } from './seed.js';
import { timerCard, eventRow, todaysEvents, weekStats, openWork, eventsOn } from './work.js';
import { todayCard } from './gym.js';
import { taskRow, dueTasks, habitChips, quickAdd, timedToday } from './life.js';
import { askBar } from './assistant.js';
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

// Today is yours to arrange: More → Customize Today, or the button at the bottom.
export const SECTIONS = [['checkin', 'Check-in prompt'], ['ask', 'Ask Claude'], ['timer', 'Time clock'], ['schedule', 'Schedule'], ['focus', "Today's focus"], ['todo', 'To-do'], ['habits', 'Habits'], ['gym', 'Gym'], ['week', 'This week (work numbers)'], ['quick', 'Quick buttons']];
export function layout() {
  const saved = String(S.settings.todayLayout || '').split(',').filter(Boolean).map(x => x.split(':')).filter(([k]) => SECTIONS.some(s => s[0] === k));
  const missing = SECTIONS.filter(([k]) => !saved.some(([x]) => x === k)).map(([k]) => [k, '1']);
  return [...saved, ...missing].map(([k, on]) => ({ k, on: on !== '0' }));
}
const saveLayout = l => { S.settings.todayLayout = l.map(x => `${x.k}:${x.on ? 1 : 0}`).join(','); };

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
    schedule: () => `<section class="group"><header class="group-head"><h3>Schedule</h3><button type="button" class="btn ghost sm" data-act="ev-new" data-date="${t}">${icon('plus')} Add</button></header>
      ${items.length ? `<div class="list panel">${items.map(i => i[1]).join('')}</div>` : `<p class="muted small">Nothing scheduled today.${tomorrow.length ? ` Tomorrow: ${esc(tomorrow.map(e => e.title || 'visit').slice(0, 3).join(', '))}.` : ''}</p>`}</section>`,
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
