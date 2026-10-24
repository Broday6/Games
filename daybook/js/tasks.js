// To-do rules shared by the Life tab, Today and check-ins: repeating tasks and "focus today".
import { uid, today, addDays, addMonthsISO, parseDate, daysLabel } from './util.js';
import { S } from './store.js';

export const REPEATS = [['', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday'], ['weekly', 'Every week'], ['days', 'On certain weekdays'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year']];
export const REPEAT_LABEL = Object.fromEntries(REPEATS);

function step(date, repeat, days = []) {
  switch (repeat) {
    case 'days': { if (!days.length) return addDays(date, 7); let d = addDays(date, 1); while (!days.includes(parseDate(d).getDay())) d = addDays(d, 1); return d; }
    case 'daily': return addDays(date, 1);
    case 'weekdays': { let d = addDays(date, 1); while ([0, 6].includes(parseDate(d).getDay())) d = addDays(d, 1); return d; }
    case 'weekly': return addDays(date, 7);
    case 'biweekly': return addDays(date, 14);
    default: return '';
  }
}
// Next due date strictly after today, so finishing an overdue bill schedules the next real one.
export function nextDue(due, repeat, days = []) {
  const base = due || today();
  const months = { monthly: 1, quarterly: 3, yearly: 12 }[repeat];
  // Month steps are measured from the original date so the 31st stays the 31st (or the month's last day).
  if (months) { let k = 1; while (addMonthsISO(base, k * months) <= today() && k < 1000) k++; return addMonthsISO(base, k * months); }
  let d = step(base, repeat, days);
  for (let i = 0; d && d <= today() && i < 5000; i++) d = step(d, repeat, days);
  return d;
}

export const repeatText = t => t.repeat === 'days' ? `every ${daysLabel(t.repeatDays)}` : (REPEAT_LABEL[t.repeat] || '').toLowerCase();
// First matching weekday on or after a date (for a new "certain weekdays" task).
export const firstOn = (days, from = today()) => { let d = from; for (let i = 0; i < 7 && !days.includes(parseDate(d).getDay()); i++) d = addDays(d, 1); return d; };
export const isFocus = t => !t.done && t.focus === today();
export const focusTasks = () => S.tasks.filter(isFocus);

// Marks a task done; a repeating task spawns its next occurrence. Returns an undo function.
export function completeTask(t) {
  t.done = true;
  t.doneAt = Date.now();
  let spawned = null;
  if (t.repeat) {
    const anchor = t.repeatFrom || t.due || today();
    spawned = { ...t, id: uid(), done: false, doneAt: 0, focus: '', repeatFrom: anchor, due: nextDue(anchor, t.repeat, t.repeatDays || []) };
    S.tasks.push(spawned);
  }
  return () => { t.done = false; t.doneAt = 0; if (spawned) S.tasks = S.tasks.filter(x => x !== spawned); };
}
