// Life: to-dos (work and personal) and daily habits with streaks.
import { esc, uid, acts, chg, icon, toast, formSheet, field, input, select, today, addDays, relDay, fmtDate, parseDate, empty, pill, segs } from './util.js';
import { S, commit, undoable, job } from './store.js';

export const CATS = [['work', 'Work'], ['personal', 'Personal'], ['home', 'Home'], ['errand', 'Errand'], ['health', 'Health']];
const CAT = Object.fromEntries(CATS);

export function taskRow(t) {
  const late = !t.done && t.due && t.due < today();
  return `<div class="row task${t.done ? ' is-done' : ''}">
    <button type="button" class="tick${t.done ? ' on' : ''}" data-act="task-done" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${icon('check')}</button>
    <div class="row-main" data-act="task-edit" data-id="${t.id}" role="button" tabindex="0"><div class="row-title">${esc(t.title)}</div>
    <div class="row-sub">${t.due ? `<span class="${late ? 'bad-text' : ''}">${esc(relDay(t.due))}</span> · ` : ''}${esc(CAT[t.cat] || 'Personal')}${t.jobId && job(t.jobId) ? ' · ' + esc(job(t.jobId).title) : ''}</div></div>
  </div>`;
}
export const dueTasks = () => S.tasks.filter(t => !t.done && t.due && t.due <= today()).sort((a, b) => a.due.localeCompare(b.due));

acts['task-done'] = el => {
  const t = S.tasks.find(x => x.id === el.dataset.id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : 0;
  commit();
  if (t.done) toast('Done', { action: { label: 'Undo', fn: () => { t.done = false; commit(); } } });
};
acts['task-edit'] = el => taskForm(S.tasks.find(x => x.id === el.dataset.id));
acts['task-new'] = el => taskForm({ due: el.dataset.due ?? today(), cat: el.dataset.cat || 'personal' });

function taskForm(t = {}) {
  const isNew = !t.id;
  formSheet({
    title: isNew ? 'New to-do' : 'Edit to-do',
    fields: `${field('To-do', input('title', t.title || '', 'text', 'required autofocus'))}
      <div class="grid2">${field('Due', input('due', t.due || '', 'date'), 'Blank means someday.')}${field('Category', select('cat', CATS, t.cat || 'personal'))}</div>
      ${field('Job', select('jobId', [['', 'None'], ...S.jobs.filter(j => j.status !== 'archived').map(j => [j.id, j.title])], t.jobId))}`,
    del: isNew ? null : () => undoable('To-do deleted', () => { S.tasks = S.tasks.filter(x => x.id !== t.id); }),
    onSubmit: d => {
      if (!d.title.trim()) { toast('Write the to-do first.'); return false; }
      const data = { title: d.title.trim(), due: d.due, cat: d.jobId && d.cat === 'personal' ? 'work' : d.cat, jobId: d.jobId };
      if (isNew) S.tasks.push({ id: uid(), done: false, ...data }); else Object.assign(t, data);
      commit();
    },
  });
}

// Quick add: "Call supplier tomorrow" style typing with a due chip.
export function quickAdd(id = 'qa') {
  return `<form class="inline-form" data-quick-task><label class="sr-only" for="${id}">New to-do</label><input id="${id}" placeholder="Add a to-do…" autocomplete="off">
    ${select(id + '-due', [['0', 'Today'], ['1', 'Tomorrow'], ['7', 'Next week'], ['', 'Someday']], '0', 'aria-label="Due"').replace(`id="f-${id}-due"`, `id="${id}-due"`)}
    <button type="submit" class="btn sm" aria-label="Add to-do">${icon('plus')}</button></form>`;
}
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-quick-task]');
  if (!f) return;
  e.preventDefault();
  const inp = f.querySelector('input');
  const title = inp.value.trim();
  if (!title) return;
  const off = f.querySelector('select').value;
  S.tasks.push({ id: uid(), title, due: off === '' ? '' : addDays(today(), +off), cat: /\b(job|client|quote|invoice|order|supplier|permit|bid)\b/i.test(title) ? 'work' : 'personal', jobId: '', done: false });
  commit();
  const again = document.getElementById(inp.id);
  again?.focus();
});

// ---------- habits ----------
const doneOn = (h, d) => (S.habitLog[d] || []).includes(h.id);
export function streak(h) {
  let d = doneOn(h, today()) ? today() : addDays(today(), -1);
  let n = 0;
  while (doneOn(h, d)) { n++; d = addDays(d, -1); }
  return n;
}
acts['habit'] = el => {
  const d = el.dataset.date || today();
  const list = S.habitLog[d] = S.habitLog[d] || [];
  const i = list.indexOf(el.dataset.id);
  if (i >= 0) list.splice(i, 1); else list.push(el.dataset.id);
  commit();
};
export function habitChips() {
  if (!S.habits.length) return '';
  return `<div class="chips">${S.habits.map(h => { const on = doneOn(h, today()); const st = streak(h); return `<button type="button" class="chip${on ? ' on' : ''}" data-act="habit" data-id="${h.id}" aria-pressed="${on}">${on ? icon('check') : ''}${esc(h.name)}${st > 1 ? ` <small>${st}d</small>` : ''}</button>`; }).join('')}</div>`;
}
acts['habit-new'] = () => habitForm();
acts['habit-edit'] = el => habitForm(S.habits.find(h => h.id === el.dataset.id));
function habitForm(h = {}) {
  const isNew = !h.id;
  formSheet({
    title: isNew ? 'New habit' : 'Edit habit',
    fields: field('Habit', input('name', h.name || '', 'text', 'required autofocus placeholder="e.g. Stretch 10 minutes"')),
    del: isNew ? null : () => undoable('Habit deleted', () => { S.habits = S.habits.filter(x => x.id !== h.id); }),
    onSubmit: d => {
      if (!d.name.trim()) { toast('Name the habit.'); return false; }
      if (isNew) S.habits.push({ id: uid(), name: d.name.trim() }); else h.name = d.name.trim();
      commit();
    },
  });
}

let showDone = false;
let lifeTab = 'todo';
export function view() {
  const t = today();
  const open = S.tasks.filter(x => !x.done);
  const groups = [
    ['Overdue', open.filter(x => x.due && x.due < t)],
    ['Today', open.filter(x => x.due === t)],
    ['Next 7 days', open.filter(x => x.due > t && x.due <= addDays(t, 7))],
    ['Later', open.filter(x => x.due > addDays(t, 7))],
    ['Someday', open.filter(x => !x.due)],
  ].map(([l, list]) => [l, list.sort((a, b) => (a.due || '').localeCompare(b.due || ''))]).filter(g => g[1].length);
  const doneList = S.tasks.filter(x => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const todo = `${quickAdd('qa-life')}
    ${groups.length ? groups.map(([l, list]) => `<section class="group"><header class="group-head"><h3>${l}</h3><span class="muted">${list.length}</span></header><div class="list panel">${list.map(taskRow).join('')}</div></section>`).join('') : empty('All clear', 'Nothing on your list. Add a to-do above.')}
    ${doneList.length ? `<button type="button" class="btn ghost block" data-act="toggle-done">${showDone ? 'Hide' : 'Show'} completed (${doneList.length})</button>${showDone ? `<div class="list panel">${doneList.slice(0, 30).map(taskRow).join('')}</div>` : ''}` : ''}`;
  const habits = `<p class="muted small">Tap a square to fill in a missed day.</p>
    <div class="habit-grid" role="table">
      <div class="hg-row head" role="row"><span></span>${days.map(d => `<span class="${d === t ? 'today' : ''}">${fmtDate(d, { weekday: 'narrow' })}<small>${parseDate(d).getDate()}</small></span>`).join('')}<span>Streak</span></div>
      ${S.habits.map(h => `<div class="hg-row" role="row"><button type="button" class="link hg-name" data-act="habit-edit" data-id="${h.id}">${esc(h.name)}</button>
        ${days.map(d => `<button type="button" class="hg-cell${doneOn(h, d) ? ' on' : ''}" data-act="habit" data-id="${h.id}" data-date="${d}" aria-label="${esc(h.name)} on ${esc(fmtDate(d))}" aria-pressed="${doneOn(h, d)}">${doneOn(h, d) ? icon('check') : ''}</button>`).join('')}
        <span class="hg-streak">${streak(h) ? streak(h) + 'd' : ''}</span></div>`).join('')}
    </div>
    <button type="button" class="btn ghost" data-act="habit-new">${icon('plus')} Habit</button>`;
  return `${segs('life-tab', [['todo', `To-do${open.length ? ' ' + open.length : ''}`], ['habits', 'Habits']], lifeTab)}<div class="tab-body">${lifeTab === 'todo' ? todo : habits}</div>`;
}
acts['life-tab'] = el => { lifeTab = el.dataset.v; commit(); };
acts['toggle-done'] = () => { showDone = !showDone; commit(); };
