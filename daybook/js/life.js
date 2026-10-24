// Life: to-dos (work and personal), plus the Check-in, Habits, Goals and Journal tabs.
import { $, $$, esc, uid, acts, icon, toast, formSheet, field, input, select, textarea, checkbox, today, addDays, relDay, fmtTime, parseDate, empty, segs, dayPicker } from './util.js';
import { S, commit, undoable, job } from './store.js';
import { REPEATS, completeTask, isFocus, repeatText, firstOn, cats, catLabel, addCat } from './tasks.js';
import { parseTask, describe } from './parse.js';
import * as checkin from './checkin.js';
import * as goals from './goals.js';
import * as habits from './habits.js';

export { habitChips } from './habits.js';

export function taskRow(t, { showTime = true } = {}) {
  const late = !t.done && t.due && t.due < today();
  return `<div class="row task${t.done ? ' is-done' : ''}">
    <button type="button" class="tick${t.done ? ' on' : ''}" data-act="task-done" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${icon('check')}</button>
    <div class="row-main" data-act="task-edit" data-id="${t.id}" role="button" tabindex="0"><div class="row-title">${esc(t.title)}</div>
    <div class="row-sub">${t.due ? `<span class="${late ? 'bad-text' : ''}">${esc(relDay(t.due))}</span>${showTime && t.time ? ' ' + fmtTime(t.time) : ''} · ` : ''}${esc(catLabel(t.cat))}${t.repeat ? ` · ${icon('repeat', 'xs')} ${esc(repeatText(t))}` : ''}${t.jobId && job(t.jobId) ? ' · ' + esc(job(t.jobId).title) : ''}${t.notes ? ' · ' + esc(t.notes.split('\n')[0]) : ''}</div></div>
    ${t.done ? '' : `<button type="button" class="icon-btn sm star${isFocus(t) ? ' on' : ''}" data-act="task-focus" data-id="${t.id}" aria-pressed="${isFocus(t)}" aria-label="${isFocus(t) ? 'Remove from today\'s focus' : 'Focus on this today'}" title="Today's focus">${icon('star')}</button>`}
  </div>`;
}
export const dueTasks = () => S.tasks.filter(t => !t.done && t.due && t.due <= today()).sort((a, b) => a.due.localeCompare(b.due) || (a.time || '99').localeCompare(b.time || '99'));
// To-dos with a time today sit in the day's schedule instead of the list (time blocking).
export const timedToday = () => S.tasks.filter(t => !t.done && t.due === today() && t.time);

acts['task-done'] = el => {
  const t = S.tasks.find(x => x.id === el.dataset.id);
  if (!t) return;
  if (t.done) { t.done = false; t.doneAt = 0; commit(); return; }
  const undo = completeTask(t);
  commit();
  toast(t.repeat ? `Done. Next one is due ${relDay(S.tasks[S.tasks.length - 1].due).replace(/^(Today|Tomorrow)/, m => m.toLowerCase())}.` : 'Done', { action: { label: 'Undo', fn: () => { undo(); commit(); } } });
};
acts['task-focus'] = el => {
  const t = S.tasks.find(x => x.id === el.dataset.id);
  if (!t) return;
  if (isFocus(t)) t.focus = '';
  else {
    if (S.tasks.filter(isFocus).length >= 3) toast('That makes more than three focus items. Fewer gets more done.');
    t.focus = today();
  }
  commit();
};
acts['task-edit'] = el => taskForm(S.tasks.find(x => x.id === el.dataset.id));
acts['task-new'] = el => taskForm({ due: el.dataset.due ?? today(), cat: el.dataset.cat || 'personal' });

function taskForm(t = {}) {
  const isNew = !t.id;
  formSheet({
    title: isNew ? 'New to-do' : 'Edit to-do',
    fields: `${field('To-do', input('title', t.title || '', 'text', 'required autofocus'))}
      <div class="grid3">${field('Due', input('due', t.due || '', 'date'))}${field('Time', input('time', t.time || '', 'time'), 'Optional')}${field('Category', select('cat', cats(), t.cat || 'personal'))}</div>
      <div class="chips due-chips">${[['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7], ['Someday', '']].map(([l, n]) => `<button type="button" class="chip" data-due="${n === '' ? '' : addDays(today(), n)}">${l}</button>`).join('')}</div>
      <div class="grid2">${field('Repeat', select('repeat', REPEATS, t.repeat || ''))}<div data-days hidden class="field"><span class="lbl">On</span>${dayPicker('rday', t.repeatDays || [])}</div></div>
      ${S.jobs.length ? field('Job', select('jobId', [['', 'None'], ...S.jobs.filter(j => j.status !== 'archived').map(j => [j.id, j.title])], t.jobId)) : ''}
      ${field('Notes', textarea('notes', t.notes || '', 'rows="2" placeholder="Details, phone numbers, links"'))}
      ${t.done ? '' : checkbox('focus', 'Focus on this today', isFocus(t))}`,
    onMount: el => {
      el.querySelectorAll('[data-due]').forEach(b => b.addEventListener('click', () => { el.querySelector('[name=due]').value = b.dataset.due; }));
      const rep = el.querySelector('[name=repeat]');
      const sync = () => { el.querySelector('[data-days]').hidden = rep.value !== 'days'; };
      rep.addEventListener('change', sync); sync();
    },
    del: isNew ? null : () => undoable('To-do deleted', () => { S.tasks = S.tasks.filter(x => x.id !== t.id); }),
    onSubmit: (d, form) => {
      if (!d.title.trim()) { toast('Write the to-do first.'); return false; }
      const repeatDays = d.repeat === 'days' ? $$('input[name=rday]:checked', form).map(c => +c.value) : [];
      if (d.repeat === 'days' && !repeatDays.length) { toast('Pick the days it repeats on.'); return false; }
      if (d.repeat === 'days' && (!d.due || !repeatDays.includes(parseDate(d.due).getDay()))) d.due = firstOn(repeatDays, d.due || today());
      if ((d.repeat || d.time) && !d.due) d.due = today();
      const data = { title: d.title.trim(), due: d.due, time: d.time, cat: d.jobId && d.cat === 'personal' ? 'work' : d.cat, jobId: d.jobId || '', repeat: d.repeat, repeatDays, notes: d.notes.trim() };
      if (d.focus !== undefined) data.focus = d.focus ? today() : (t.focus === today() ? '' : t.focus || '');
      if (!isNew && (data.due !== t.due || data.repeat !== t.repeat || String(repeatDays) !== String(t.repeatDays || []))) data.repeatFrom = ''; // a manual date change resets the repeat anchor
      if (isNew) S.tasks.push({ id: uid(), done: false, ...data }); else Object.assign(t, data);
      commit();
    },
  });
}

// Quick add understands plain language: "Call Wes tomorrow 9am #work", "Gutters this weekend #home",
// "Follow up with Mark every Mon and Thu", "Pay estimated taxes every quarter !".
export function quickAdd(id = 'qa', { defaultDue = 'today' } = {}) {
  return `<form class="quick-add" data-quick-task data-default="${defaultDue}"><div class="inline-form"><label class="sr-only" for="${id}">New to-do</label>
    <input id="${id}" placeholder="Add a to-do… e.g. Call Wes tomorrow 9am #work" autocomplete="off" enterkeyhint="done">
    <button type="submit" class="btn sm" aria-label="Add to-do">${icon('plus')}</button></div><p class="qa-preview" aria-live="polite"></p></form>`;
}
const catKeys = () => cats().map(c => c[0]);
document.addEventListener('input', e => {
  const f = e.target.closest('[data-quick-task]');
  if (!f) return;
  const v = e.target.value.trim();
  const out = f.querySelector('.qa-preview');
  if (!v) { out.textContent = ''; return; }
  const p = parseTask(v, catKeys());
  const bits = describe(p, catLabel);
  out.innerHTML = bits.length ? `${icon('bolt', 'xs')} <b>${esc(p.title || '…')}</b> · ${esc(bits.join(' · '))}` : '';
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-quick-task]');
  if (!f) return;
  e.preventDefault();
  const inp = f.querySelector('input');
  const raw = inp.value.trim();
  if (!raw) return;
  const p = parseTask(raw, catKeys());
  if (!p.title) return toast('Add what the to-do is, not just when.');
  if (p.newCat) addCat(p.newCat);
  const life = inp.id === 'qa-life';
  const cat = p.cat || (life && S.ui.taskCat && S.ui.taskCat !== 'all' ? S.ui.taskCat : /\b(job|client|quote|invoice|order|supplier|permit|bid|follow up|contact|estimate)\b/i.test(p.title) ? 'work' : 'personal');
  const due = p.due || (f.dataset.default === 'today' ? today() : '');
  S.tasks.push({ id: uid(), title: p.title, due, time: p.time, cat, jobId: '', done: false, focus: p.focus ? today() : '', repeat: p.repeat, repeatDays: p.repeatDays, notes: '' });
  commit();
  const bits = describe({ ...p, due }, catLabel);
  toast(`Added${bits.length ? ': ' + bits.join(' · ') : ''}`);
  document.getElementById(inp.id)?.focus();
});

let showDone = false;
const TABS = [['checkin', 'Check-in'], ['todo', 'To-do'], ['habits', 'Habits'], ['goals', 'Goals'], ['journal', 'Journal']];
export function view() {
  const lifeTab = TABS.some(x => x[0] === S.ui.lifeTab) ? S.ui.lifeTab : 'checkin';
  const t = today();
  const cat = S.ui.taskCat || 'all';
  const inCat = x => cat === 'all' || x.cat === cat;
  const open = S.tasks.filter(x => !x.done && inCat(x));
  const groups = [
    ['Today\'s focus', open.filter(isFocus)],
    ['Overdue', open.filter(x => !isFocus(x) && x.due && x.due < t)],
    ['Today', open.filter(x => !isFocus(x) && x.due === t)],
    ['Next 7 days', open.filter(x => !isFocus(x) && x.due > t && x.due <= addDays(t, 7))],
    ['Later', open.filter(x => !isFocus(x) && x.due > addDays(t, 7))],
    ['Someday', open.filter(x => !isFocus(x) && !x.due)],
  ].map(([l, list]) => [l, list.sort((a, b) => (a.due || '').localeCompare(b.due || '') || (a.time || '99').localeCompare(b.time || '99'))]).filter(g => g[1].length);
  const doneList = S.tasks.filter(x => x.done && inCat(x)).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const used = [['all', 'All'], ...cats().filter(([k]) => S.tasks.some(x => !x.done && x.cat === k))];
  const todo = `${used.length > 2 ? `<div class="chips">${used.map(([k, l]) => `<button type="button" class="chip${cat === k ? ' on' : ''}" data-act="task-cat" data-v="${k}">${esc(l)} <small>${S.tasks.filter(x => !x.done && (k === 'all' || x.cat === k)).length}</small></button>`).join('')}</div>` : ''}
    ${quickAdd('qa-life', { defaultDue: '' })}
    ${groups.length ? groups.map(([l, list]) => `<section class="group"><header class="group-head"><h3>${l}</h3><span class="muted">${list.length}</span></header><div class="list panel">${list.map(x => taskRow(x)).join('')}</div></section>`).join('') : empty('All clear', 'Nothing on your list. Add a to-do above.')}
    ${doneList.length ? `<button type="button" class="btn ghost block" data-act="toggle-done">${showDone ? 'Hide' : 'Show'} completed (${doneList.length})</button>${showDone ? `<div class="list panel">${doneList.slice(0, 30).map(x => taskRow(x)).join('')}</div>` : ''}` : ''}`;
  const body = { checkin: checkin.view, todo: () => todo, habits: habits.view, goals: goals.view, journal: checkin.journalView }[lifeTab]();
  const due = checkin.dueCheckins().length;
  return `${segs('life-tab', TABS.map(([v, l]) => [v, v === 'todo' && open.length ? `${l} ${open.length}` : v === 'checkin' && due ? `${l} •` : l]), lifeTab)}<div class="tab-body">${body}</div>`;
}
acts['life-tab'] = el => { S.ui.lifeTab = el.dataset.v; commit(); window.scrollTo(0, 0); };
acts['task-cat'] = el => { S.ui.taskCat = el.dataset.v; commit(); };
acts['toggle-done'] = () => { showDone = !showDone; commit(); };
export const focusInput = () => $('#qa-today')?.focus();
