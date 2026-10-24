// Goals: personal targets with progress and pace. Some update themselves from the rest of the app
// (body weight from the gym log, workouts, money collected, hours worked); the rest you update by hand,
// and the weekly review asks you for those numbers.
import { esc, uid, num, sum, round2, acts, icon, toast, sheet, formSheet, field, input, numInput, select, today, daysBetween, fmtDate, fmtShort, relDay, money, empty, pill, hours } from './util.js';
import { S, commit, undoable, set } from './store.js';
import { lineChart } from './charts.js';

export const GOAL_KINDS = [
  ['manual', 'I update it myself'],
  ['bodyweight', 'Body weight (from the gym log)'],
  ['workouts', 'Workouts logged'],
  ['income', 'Money collected from invoices'],
  ['hours', 'Hours worked'],
];
const AUTO_UNIT = { bodyweight: () => set('units'), workouts: () => 'workouts', income: () => set('currency'), hours: () => 'hours' };
const isMoney = g => g.kind === 'income' || /^(\$|usd|cad|aud|nzd|eur|gbp|dollars?)$/i.test(g.unit || '');

const latestWeight = (from = '') => { const b = [...S.body].filter(x => x.date >= from).sort((a, c) => a.date.localeCompare(c.date)); return b.length ? num(b[b.length - 1].weight) : null; };
export function current(g) {
  switch (g.kind) {
    case 'bodyweight': return latestWeight() ?? num(g.start);
    case 'workouts': return S.workouts.filter(w => w.date >= g.created).length;
    case 'income': return sum(S.invoices.filter(i => i.status === 'paid' && (i.paidDate || i.date) >= g.created), i => sum(i.lines, l => num(l.qty) * num(l.rate)) * (1 + num(i.taxPct) / 100));
    case 'hours': return sum(S.time.filter(t => t.end && fmtISO(t.start) >= g.created), t => hours(t.end - t.start - num(t.breakMin) * 60000));
    default: return g.log.length ? num(g.log[g.log.length - 1].value) : num(g.start);
  }
}
const fmtISO = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const startOf = g => (['workouts', 'income', 'hours'].includes(g.kind) ? 0 : num(g.start));
export const fmtVal = (g, v) => isMoney(g) ? money(v).replace(/\.00$/, '') : `${round2(v).toLocaleString()}${g.unit ? ' ' + g.unit : ''}`;

export function progress(g) {
  const cur = current(g), start = startOf(g), target = num(g.target);
  const p = target === start ? (cur === target ? 1 : 0) : (cur - start) / (target - start);
  const pct = Math.max(0, Math.min(1, p));
  let status = '', kind = 'muted';
  if (pct >= 1) { status = 'Reached'; kind = 'good'; }
  else if (g.due) {
    const total = Math.max(1, daysBetween(g.created, g.due));
    const expected = Math.max(0, Math.min(1, daysBetween(g.created, today()) / total));
    if (today() > g.due) { status = 'Past due'; kind = 'bad'; }
    else if (pct >= expected - 0.05) { status = 'On track'; kind = 'good'; }
    else { status = 'Behind'; kind = 'warn'; }
  }
  return { cur, start, target, pct, status, kind };
}

export function goalRow(g) {
  const p = progress(g);
  return `<div class="row goal" data-act="goal-open" data-id="${g.id}" role="button" tabindex="0">
    <div class="row-main"><div class="row-title">${esc(g.title)}</div>
      <div class="progress"><i style="width:${(p.pct * 100).toFixed(1)}%"></i></div>
      <div class="row-sub">${esc(fmtVal(g, p.cur))} of ${esc(fmtVal(g, p.target))}${g.due ? ` · by ${esc(fmtShort(g.due))}` : ''}</div></div>
    <div class="row-end">${g.done ? pill('Done', 'good') : p.status ? pill(p.status, p.kind) : ''}<span class="row-num">${Math.round(p.pct * 100)}%</span></div></div>`;
}

export function view() {
  const open = S.goals.filter(g => !g.done);
  const done = S.goals.filter(g => g.done);
  return `<div class="toolbar"><span class="muted">${open.length} active</span><span class="grow"></span><button type="button" class="btn sm" data-act="goal-new">${icon('plus')} Goal</button></div>
    ${open.length ? `<div class="list panel">${open.map(goalRow).join('')}</div>` : empty('No goals yet', 'Set a target like “Emergency fund $5,000”, “Get to 185 lb” or “Train 3 times a week through December”. Weight, workouts, income and hours goals update themselves.', `<button type="button" class="btn" data-act="goal-new">${icon('plus')} New goal</button>`)}
    ${done.length ? `<section class="group"><header class="group-head"><h3>Achieved</h3><span class="muted">${done.length}</span></header><div class="list panel">${done.map(goalRow).join('')}</div></section>` : ''}`;
}

acts['goal-new'] = () => goalForm();
acts['goal-edit'] = el => goalForm(S.goals.find(g => g.id === el.dataset.id));
acts['goal-open'] = el => goalDetail(el.dataset.id);

function goalForm(g = {}) {
  const isNew = !g.id;
  formSheet({
    title: isNew ? 'New goal' : 'Edit goal',
    fields: `${field('Goal', input('title', g.title || '', 'text', 'required autofocus placeholder="e.g. Emergency fund, Read 12 books"'))}
      ${field('How it is tracked', select('kind', GOAL_KINDS, g.kind || 'manual'))}
      <div class="grid3">${field('Starting at', numInput('start', g.start ?? ''), '')}${field('Target', numInput('target', g.target ?? '', 'required'))}${field('Unit', input('unit', g.unit || '', 'text', 'placeholder="$, books, miles"'))}</div>
      <p class="muted small" data-auto-hint></p>
      ${field('Deadline', input('due', g.due || '', 'date'), 'Optional. With a deadline Daybook tells you if you are on pace.')}`,
    del: isNew ? null : () => undoable('Goal deleted', () => { S.goals = S.goals.filter(x => x.id !== g.id); }),
    onMount: el => {
      const k = el.querySelector('[name=kind]');
      const sync = () => {
        const auto = k.value !== 'manual';
        const counted = ['workouts', 'income', 'hours'].includes(k.value);
        el.querySelector('[name=start]').closest('.field').hidden = counted;
        el.querySelector('[name=unit]').closest('.field').hidden = auto;
        if (k.value === 'bodyweight' && !el.querySelector('[name=start]').value && latestWeight() !== null) el.querySelector('[name=start]').value = latestWeight();
        el.querySelector('[data-auto-hint]').textContent = {
          manual: 'You log new values from the goal, and the weekly review asks for them.',
          bodyweight: 'Uses the latest weight you log under Gym → Progress.',
          workouts: 'Counts workouts you finish from today on.',
          income: 'Adds up invoices marked paid from today on.',
          hours: 'Adds up hours you log to jobs from today on.',
        }[k.value];
      };
      k.addEventListener('change', sync); sync();
    },
    onSubmit: d => {
      if (!d.title.trim()) { toast('Name the goal.'); return false; }
      if (d.target.trim() === '') { toast('Set a target number.'); return false; }
      const data = { title: d.title.trim(), kind: d.kind, start: d.start.trim() === '' ? (d.kind === 'bodyweight' ? String(latestWeight() ?? 0) : '0') : d.start.trim(), target: d.target.trim(), unit: d.kind === 'manual' ? d.unit.trim() : AUTO_UNIT[d.kind](), due: d.due };
      if (isNew) S.goals.push({ id: uid(), created: today(), log: [], done: false, ...data });
      else Object.assign(g, data);
      commit();
      toast(isNew ? 'Goal added' : 'Goal saved');
    },
  });
}

export function logGoal(g, value, note = '') {
  g.log = g.log.filter(l => l.date !== today());
  g.log.push({ date: today(), value: String(value), note });
  if (!g.done && progress(g).pct >= 1) { g.done = true; toast(`Goal reached: ${g.title}`, { kind: 'good' }); }
}

function goalDetail(id) {
  sheet({
    title: 'Goal',
    render: () => {
      const g = S.goals.find(x => x.id === id);
      if (!g) return null;
      const p = progress(g);
      const left = p.target - p.cur;
      const daysLeft = g.due ? daysBetween(today(), g.due) : null;
      const pts = g.kind === 'bodyweight'
        ? S.body.filter(b => b.date >= g.created).sort((a, b) => a.date.localeCompare(b.date)).map(b => ({ x: b.date, y: num(b.weight) }))
        : g.kind === 'manual' ? [{ x: g.created, y: num(g.start) }, ...g.log.map(l => ({ x: l.date, y: num(l.value) }))] : [];
      const perWeek = daysLeft > 0 && Math.abs(left) > 0 && p.pct < 1 ? Math.abs(left) / daysLeft * 7 : 0;
      return `<div class="detail-head"><h3>${esc(g.title)}</h3><div class="inline">${g.done ? pill('Achieved', 'good') : p.status ? pill(p.status, p.kind) : ''}<span class="muted">${esc(GOAL_KINDS.find(k => k[0] === g.kind)?.[1] || '')}</span></div></div>
        <div class="goal-big"><strong>${esc(fmtVal(g, p.cur))}</strong><span class="muted">of ${esc(fmtVal(g, p.target))} · ${Math.round(p.pct * 100)}%</span></div>
        <div class="progress lg"><i style="width:${(p.pct * 100).toFixed(1)}%"></i></div>
        <p class="muted small">${p.pct >= 1 ? 'Target reached.' : `${esc(fmtVal(g, Math.abs(left)))} to go`}${daysLeft !== null && p.pct < 1 ? (daysLeft >= 0 ? `, ${daysLeft} days left${perWeek ? ` (about ${esc(fmtVal(g, round2(perWeek)))} a week)` : ''}` : `, deadline was ${esc(relDay(g.due).toLowerCase())}`) : ''}.</p>
        ${g.kind === 'manual' && !g.done ? `<form class="inline-form" data-goal-log="${g.id}"><label class="sr-only" for="goal-v">New value</label><input id="goal-v" inputmode="decimal" placeholder="Where are you now?"><input id="goal-n" placeholder="Note (optional)"><button type="submit" class="btn sm primary">Update</button></form>` : ''}
        ${pts.length > 1 ? `<section class="chart-card">${lineChart(pts, { fmt: v => isMoney(g) ? money(v).replace(/\.00$/, '') : String(round2(v)) })}</section>` : ''}
        ${g.log.length ? `<h4 class="sub-h">Updates</h4><div class="list">${[...g.log].reverse().map(l => `<div class="row"><div class="row-main"><div class="row-title">${esc(fmtVal(g, num(l.value)))}</div><div class="row-sub">${esc(fmtDate(l.date))}${l.note ? ' · ' + esc(l.note) : ''}</div></div></div>`).join('')}</div>` : ''}
        <div class="row-actions wrap"><button type="button" class="btn ghost" data-act="goal-edit" data-id="${id}">${icon('edit')} Edit</button>
          <button type="button" class="btn ghost" data-act="goal-toggle" data-id="${id}">${g.done ? 'Reopen' : `${icon('check')} Mark achieved`}</button></div>`;
    },
  });
}
acts['goal-toggle'] = el => { const g = S.goals.find(x => x.id === el.dataset.id); if (g) { g.done = !g.done; commit(); if (g.done) toast(`Nice work: ${g.title}`, { kind: 'good' }); } };
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-goal-log]');
  if (!f) return;
  e.preventDefault();
  const g = S.goals.find(x => x.id === f.dataset.goalLog);
  const v = f.querySelector('#goal-v').value.trim();
  if (!g || v === '') return toast('Enter the new number.');
  logGoal(g, num(v), f.querySelector('#goal-n').value.trim());
  commit();
  toast('Goal updated');
});
