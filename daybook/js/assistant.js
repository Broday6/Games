// Ask Claude: a chat inside Daybook (when it runs in Claude) that can read your day and change it with
// page tools: add or move to-dos, schedule items and habits, update goals, and reflect on your check-ins.
// Every answer that changed something can be undone in one tap.
import { $, esc, uid, num, avg, round2, acts, icon, toast, sheet, today, addDays, parseDate, fmtTime, hmOf, daysLabel, DOW, bus } from './util.js';
import { S, commit, replaceState, set } from './store.js';
import { eventsOn } from './work.js';
import { completeTask, cats, catLabel, addCat, slug, firstOn, repeatText } from './tasks.js';
import * as habits from './habits.js';
import { current, progress } from './goals.js';
import { logGoal } from './goals.js';
import * as people from './people.js';
import { planDay } from './plan.js';
import * as fit from './fitness.js';
import * as billsMod from './bills.js';

let sample = null;
export async function startAssistant() {
  if (!window.claude?.use) return;
  const s = await window.claude.use('sample').catch(() => null);
  if (!s) return;
  const lim = await s.limits().catch(() => null);
  if (!lim?.tools) return;
  sample = s;
  bus.render();
}
export const available = () => !!sample;

export function askBar() {
  if (!sample) return '';
  return `<form class="ask-bar" data-ask-form><label class="sr-only" for="ask-in">Ask Claude</label>${icon('bolt')}
    <input id="ask-in" placeholder="Ask Claude: “Move Bible study to 6:30” or “Plan my day”" autocomplete="off" enterkeyhint="send">
    <button type="submit" class="btn sm primary">Ask</button></form>`;
}

// ---------- tools ----------
const DAYMAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const toDays = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,]+/)).map(x => (typeof x === 'number' ? x : DAYMAP[String(x).toLowerCase().slice(0, 3)])).filter(x => x >= 0 && x <= 6);
const dayNames = d => (d || []).map(x => DOW[x].toLowerCase());
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = v => /^\d{2}:\d{2}$/.test(String(v || ''));
let changed = 0;
const touch = () => { changed++; commit(); };

const taskOut = t => ({ id: t.id, title: t.title, due: t.due || null, time: t.time || null, category: t.cat, repeat: t.repeat ? repeatText(t) : null, focus_today: t.focus === today(), notes: t.notes || undefined, done: !!t.done });
const eventOut = e => ({ id: e.id, title: e.title || 'Visit', date: e.days?.length ? undefined : e.date, repeat_days: e.days?.length ? dayNames(e.days) : undefined, starts: e.days?.length ? e.date : undefined, until: e.until || undefined, start: e.start || null, end: e.end || null, workout: !!e.gym, notes: e.notes || undefined });

const TOOLS = [
  {
    name: 'get_day',
    description: 'The schedule, to-dos due, focus items, habits and check-ins for one date (default today). Use first for anything about a day.',
    inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } } },
    execute: ({ date }) => {
      const d = isDate(date) ? date : today();
      return {
        date: d, weekday: DOW[parseDate(d).getDay()],
        schedule: eventsOn(d).map(e => ({ id: e.id, title: e.title || 'Visit', start: e.start, end: e.end, repeats: e.series ? daysLabel(e.days) : null, workout: !!e.gym, done: !!e.done })),
        todos_due: S.tasks.filter(t => !t.done && t.due && t.due <= d).map(taskOut),
        habits: habits.active().filter(h => habits.scheduledOn(h, d)).map(h => ({ id: h.id, name: h.name, done: habits.isDone(h, d), count: habits.countOn(h, d), target: habits.target(h), streak: habits.streak(h) })),
        checkins_done: S.checkins.filter(c => c.date === d).map(c => c.kind),
        follow_ups_due: d === today() ? people.dueToday().map(p => ({ id: p.id, name: p.name, due: p.next })) : undefined,
        workout_in_progress: S.active ? S.active.name : null,
      };
    },
  },
  {
    name: 'list_todos',
    description: 'Open (or done) to-dos with ids. Optional category filter.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['open', 'done'] }, category: { type: 'string' } } },
    execute: ({ status = 'open', category }) => S.tasks.filter(t => (status === 'done' ? t.done : !t.done) && (!category || t.cat === slug(category))).slice(-80).map(taskOut),
  },
  {
    name: 'save_todo',
    description: 'Create a to-do (no id) or change one (with id). Set done:true to complete it (repeating ones roll to the next date) or delete:true to remove it. Returns the saved to-do.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string' }, title: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD, or "" for someday' }, time: { type: 'string', description: 'HH:MM 24h, or ""' },
      category: { type: 'string' }, repeat: { type: 'string', enum: ['', 'daily', 'weekdays', 'days', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] },
      repeat_days: { type: 'array', items: { type: 'string' }, description: 'for repeat "days": e.g. ["mon","thu"]' }, notes: { type: 'string' }, focus_today: { type: 'boolean' }, done: { type: 'boolean' }, delete: { type: 'boolean' } } },
    execute: input => {
      let t = input.id ? S.tasks.find(x => x.id === String(input.id)) : null;
      if (input.id && !t) throw new Error('No to-do with that id. Call list_todos.');
      if (t && input.delete) { S.tasks = S.tasks.filter(x => x !== t); touch(); return 'deleted'; }
      if (!t) { if (!input.title) throw new Error('A new to-do needs a title.'); t = { id: uid(), title: '', due: '', time: '', cat: 'personal', jobId: '', done: false, focus: '', repeat: '', repeatDays: [], notes: '' }; S.tasks.push(t); }
      if (input.title !== undefined) t.title = String(input.title).trim() || t.title;
      if (input.due !== undefined) t.due = isDate(input.due) ? input.due : '';
      if (input.time !== undefined) t.time = isTime(input.time) ? input.time : '';
      if (input.category) { if (!cats().some(c => c[0] === slug(input.category))) addCat(String(input.category)); t.cat = slug(input.category); }
      if (input.notes !== undefined) t.notes = String(input.notes);
      if (input.repeat !== undefined) { t.repeat = input.repeat; t.repeatDays = input.repeat === 'days' ? toDays(input.repeat_days) : []; t.repeatFrom = ''; if (t.repeat === 'days' && !t.repeatDays.length) t.repeat = ''; }
      if (t.repeat === 'days' && (!t.due || !t.repeatDays.includes(parseDate(t.due).getDay()))) t.due = firstOn(t.repeatDays, t.due || today());
      if ((t.repeat || t.time) && !t.due) t.due = today();
      if (input.focus_today !== undefined) t.focus = input.focus_today ? today() : '';
      if (input.done === true && !t.done) completeTask(t);
      if (input.done === false) { t.done = false; t.doneAt = 0; }
      touch();
      return taskOut(t);
    },
  },
  {
    name: 'list_schedule',
    description: 'Repeating schedule items and one-off items from today through `days` ahead (default 14), with ids.',
    inputSchema: { type: 'object', properties: { days: { type: 'number' } } },
    execute: ({ days = 14 }) => {
      const end = addDays(today(), Math.min(60, num(days) || 14));
      return S.events.filter(e => e.days?.length ? (!e.until || e.until >= today()) : e.date >= today() && e.date <= end).map(eventOut);
    },
  },
  {
    name: 'save_schedule_item',
    description: 'Create (no id) or change (with id) a schedule item. A repeating item has repeat_days (["mon","tue"]); a one-off has date. workout:true adds a Start-workout button. skip_date skips one day of a repeating item. delete:true removes it.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string' }, title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD (one-off, or the start of a repeating item)' }, start: { type: 'string', description: 'HH:MM' }, end: { type: 'string', description: 'HH:MM' },
      repeat_days: { type: 'array', items: { type: 'string' } }, until: { type: 'string' }, workout: { type: 'boolean' }, notes: { type: 'string' }, skip_date: { type: 'string' }, delete: { type: 'boolean' } } },
    execute: input => {
      let e = input.id ? S.events.find(x => x.id === String(input.id)) : null;
      if (input.id && !e) throw new Error('No schedule item with that id. Call list_schedule.');
      if (e && input.delete) { S.events = S.events.filter(x => x !== e); touch(); return 'deleted'; }
      if (e && input.skip_date) { e.skip = [...(e.skip || []), String(input.skip_date)]; touch(); return eventOut(e); }
      if (!e) { if (!input.title) throw new Error('A new item needs a title.'); e = { id: uid(), title: '', date: today(), start: '', end: '', jobId: '', notes: '', days: [], until: '', gym: false, done: false, doneDates: [], skip: [] }; S.events.push(e); }
      if (input.title !== undefined) e.title = String(input.title).trim() || e.title;
      if (isDate(input.date)) e.date = input.date;
      if (input.start !== undefined) e.start = isTime(input.start) ? input.start : '';
      if (input.end !== undefined) e.end = isTime(input.end) ? input.end : '';
      if (input.repeat_days !== undefined) e.days = toDays(input.repeat_days);
      if (input.until !== undefined) e.until = isDate(input.until) ? input.until : '';
      if (input.workout !== undefined) e.gym = !!input.workout;
      if (input.notes !== undefined) e.notes = String(input.notes);
      touch();
      return eventOut(e);
    },
  },
  {
    name: 'list_habits',
    description: 'Habits with ids, cue, time of day, days, daily target, streak (forgives one miss) and 30-day completion rate.',
    execute: () => S.habits.map(h => ({ id: h.id, name: h.name, cue: h.cue || null, when: h.when || 'anytime', days: h.days?.length ? dayNames(h.days) : 'every day', target: habits.target(h), unit: h.unit || null, paused: !!h.archived, streak: habits.streak(h), rate_30_days: habits.rate(h) === null ? null : Math.round(habits.rate(h) * 100) + '%', done_today: habits.isDone(h, today()) })),
  },
  {
    name: 'save_habit',
    description: 'Create (no id) or change (with id) a habit. days like ["mon","wed","fri"] (omit for every day). mark_today: true/false checks it off or clears it today. delete:true removes it; paused:true pauses it.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string' }, name: { type: 'string' }, cue: { type: 'string' }, when: { type: 'string', enum: ['morning', 'midday', 'evening', 'anytime'] }, days: { type: 'array', items: { type: 'string' } },
      target: { type: 'number' }, unit: { type: 'string' }, mark_today: { type: 'boolean' }, paused: { type: 'boolean' }, delete: { type: 'boolean' } } },
    execute: input => {
      let h = input.id ? S.habits.find(x => x.id === String(input.id)) : null;
      if (input.id && !h) throw new Error('No habit with that id. Call list_habits.');
      if (h && input.delete) { S.habits = S.habits.filter(x => x !== h); touch(); return 'deleted'; }
      if (!h) { if (!input.name) throw new Error('A new habit needs a name.'); h = { id: uid(), name: '', created: today(), when: 'anytime', days: [], target: 1 }; S.habits.push(h); }
      if (input.name) h.name = String(input.name).trim();
      if (input.cue !== undefined) h.cue = String(input.cue);
      if (input.when) h.when = input.when;
      if (input.days !== undefined) { const d = toDays(input.days); h.days = d.length === 7 ? [] : d; }
      if (input.target !== undefined) h.target = Math.max(1, Math.round(num(input.target)) || 1);
      if (input.unit !== undefined) h.unit = String(input.unit);
      if (input.paused !== undefined) h.archived = !!input.paused;
      if (input.mark_today !== undefined) habits.setCount(h, today(), input.mark_today ? habits.target(h) : 0);
      touch();
      return { id: h.id, name: h.name, streak: habits.streak(h) };
    },
  },
  {
    name: 'get_reflection',
    description: 'How the last `days` (default 14) went: average mood, energy, stress, sleep, workouts, hours worked, recent check-in answers, and goal progress with ids.',
    inputSchema: { type: 'object', properties: { days: { type: 'number' } } },
    execute: ({ days = 14 }) => {
      const from = addDays(today(), -Math.min(90, num(days) || 14));
      const cks = S.checkins.filter(c => c.date >= from).sort((a, b) => a.date.localeCompare(b.date));
      const f = k => { const v = avg(cks.map(c => num(c[k]))); return v === null ? null : round2(v); };
      return {
        from, averages: { mood: f('mood'), energy: f('energy'), stress: f('stress'), sleep_hours: f('sleep') },
        workouts: S.workouts.filter(w => w.date >= from).length,
        hours_worked: round2(S.time.filter(t => t.end && t.start >= parseDate(from).getTime()).reduce((a, t) => a + (t.end - t.start - num(t.breakMin) * 60000) / 36e5, 0)),
        checkins: cks.slice(-24).map(c => ({ date: c.date, kind: c.kind, mood: c.mood || undefined, energy: c.energy || undefined, stress: c.stress || undefined, sleep: c.sleep || undefined, answers: (c.notes || []).map(n => `${n.q}: ${String(n.a).slice(0, 220)}`) })),
        goals: S.goals.filter(g => !g.done).map(g => { const p = progress(g); return { id: g.id, title: g.title, current: round2(current(g)), target: num(g.target), percent: Math.round(p.pct * 100), status: p.status || null, deadline: g.due || null, updates_by_hand: g.kind === 'manual' }; }),
        habits: habits.active().map(h => ({ name: h.name, streak: habits.streak(h), rate_30_days: habits.rate(h) === null ? null : Math.round(habits.rate(h) * 100) + '%' })),
      };
    },
  },
  {
    name: 'list_people',
    description: 'People they follow up with: id, phone, group, rhythm, next follow-up date, last contact.',
    execute: () => (S.people || []).map(p => ({ id: p.id, name: p.name, phone: p.phone || null, group: p.tag, rhythm: people.rhythm(p), next: p.next || null, last: p.last || null, notes: p.notes || undefined })),
  },
  {
    name: 'save_person',
    description: 'Add (no id) or change (with id) a person. every_days sets a follow-up rhythm; or weekdays like ["mon","thu"]. next sets the next follow-up date. delete:true removes them.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, group: { type: 'string' }, every_days: { type: 'number' }, weekdays: { type: 'array', items: { type: 'string' } }, next: { type: 'string' }, notes: { type: 'string' }, delete: { type: 'boolean' } } },
    execute: input => {
      S.people = S.people || [];
      let p = input.id ? S.people.find(x => x.id === String(input.id)) : null;
      if (input.id && !p) throw new Error('No person with that id. Call list_people.');
      if (p && input.delete) { S.people = S.people.filter(x => x !== p); touch(); return 'deleted'; }
      if (!p) { if (!input.name) throw new Error('A new person needs a name.'); p = { id: uid(), name: '', created: today(), log: [], last: '', next: '', every: '', days: [], tag: 'work', notes: '' }; S.people.push(p); }
      if (input.name) p.name = String(input.name).trim();
      for (const k of ['phone', 'email', 'notes']) if (input[k] !== undefined) p[k] = String(input[k]);
      if (input.group) p.tag = slug(input.group);
      if (input.weekdays !== undefined) { p.days = toDays(input.weekdays); if (p.days.length) p.every = ''; }
      if (input.every_days !== undefined) { p.every = String(Math.max(0, Math.round(num(input.every_days))) || ''); if (p.every) p.days = []; }
      if (isDate(input.next)) p.next = input.next;
      else if (!p.next && (p.every || p.days.length)) p.next = p.days.length && !p.days.includes(parseDate(today()).getDay()) ? people.nextFrom(p, today()) : today();
      touch();
      return { id: p.id, name: p.name, rhythm: people.rhythm(p), next: p.next || null };
    },
  },
  {
    name: 'log_follow_up',
    description: 'Record that they followed up with someone (kind: call, text, meet, email) and schedule the next follow-up from that person\'s rhythm.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, kind: { type: 'string', enum: ['call', 'text', 'meet', 'email'] }, note: { type: 'string' } }, required: ['id'] },
    execute: ({ id, kind = 'call', note = '' }) => {
      const p = (S.people || []).find(x => x.id === String(id));
      if (!p) throw new Error('No person with that id. Call list_people.');
      people.logContact(p, kind, String(note));
      touch();
      return { name: p.name, next: p.next || null };
    },
  },
  {
    name: 'plan_my_day',
    description: 'Fit today\'s focus and due to-dos without a time into the free gaps of today\'s schedule (time blocking). Returns what was placed and what did not fit.',
    execute: () => { const r = planDay(); touch(); return { placed: r.placed.map(t => `${t.time} ${t.title}`), did_not_fit: r.left.map(t => t.title) }; },
  },
  {
    name: 'set_training_plan',
    description: 'Set which workout template is done on each weekday, e.g. {"mon":"Upper","tue":"Lower"}. Use template names; "rest" clears a day.',
    inputSchema: { type: 'object', properties: { plan: { type: 'object' } }, required: ['plan'] },
    execute: ({ plan }) => {
      const next = { ...(S.settings.program || {}) };
      for (const [day, name] of Object.entries(plan || {})) {
        const d = toDays([day])[0];
        if (d === undefined) continue;
        const t = S.templates.find(x => x.name.toLowerCase() === String(name).toLowerCase());
        next[d] = /^rest$/i.test(String(name)) || !t ? '' : t.id;
      }
      S.settings.program = next;
      touch();
      return Object.fromEntries(Object.entries(next).filter(([, v]) => v).map(([d, v]) => [DOW[d], S.templates.find(t => t.id === v)?.name]));
    },
  },
  {
    name: 'get_fitness',
    description: 'Cut plan status: body fat now and goal, trend weight and weekly rate, today\'s calorie/protein/carb/fat targets and what has been eaten, steps, recovery score, strength check per lift, and the coach\'s current notes.',
    execute: () => {
      const c = fit.cut();
      const t = fit.targets(), x = fit.intake(today()), r = fit.weeklyRate(), rd = fit.readiness();
      return {
        plan: c ? { body_fat_now: fit.bfNow(), goal_body_fat: num(c.goalBF), pace_pct_per_week: num(c.pace), started: c.start, trend_weight_lb: fit.trendNow() && round2(fit.trendNow()), goal_weight_lb: round2(fit.goalWeight()), weekly_change_lb: r ? round2(r.perWeek) : null } : 'No cut plan set up yet (Fitness → Coach).',
        today: { targets: t ? { kcal: t.kcal, protein_g: t.p, carbs_g: t.c, fat_g: t.f, steps: t.steps } : null, eaten: { kcal: x.kcal, protein_g: x.p, carbs_g: x.c, fat_g: x.f }, steps: fit.stepsOn(today()), cardio_min: fit.cardioOn(today()).reduce((a, k) => a + num(k.mins), 0) },
        recovery: rd ? { score: rd.score, advice: rd.advice } : 'No morning check-in today',
        strength: fit.liftStatus().map(l => `${l.name}: ${l.ch > 0 ? '+' : ''}${l.ch}% (${l.status})`),
        coach_notes: fit.notes().map(n => n.text),
      };
    },
  },
  {
    name: 'log_food',
    description: 'Log foods eaten today (or on date). When they describe a meal, estimate each item\'s calories and macros from typical US portions, log them, and say the totals.',
    inputSchema: { type: 'object', properties: { date: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, kcal: { type: 'number' }, protein_g: { type: 'number' }, carbs_g: { type: 'number' }, fat_g: { type: 'number' } }, required: ['name', 'kcal'] } } }, required: ['items'] },
    execute: ({ date, items }) => {
      const list = (items || []).map(i => ({ name: i.name, kcal: i.kcal, p: i.protein_g, c: i.carbs_g, f: i.fat_g, est: true })).filter(i => num(i.kcal) > 0);
      if (!list.length) throw new Error('No items with calories.');
      fit.addFood(list, isDate(date) ? date : today());
      touch();
      const x = fit.intake(isDate(date) ? date : today()), t = fit.targets();
      return { logged: list.length, day_total: { kcal: x.kcal, protein_g: x.p }, remaining: t ? { kcal: t.kcal - x.kcal, protein_g: t.p - x.p } : null };
    },
  },
  {
    name: 'log_activity',
    description: 'Record today\'s step count and/or a cardio session (kind: walk, incline, bike, run, row, hiit, other).',
    inputSchema: { type: 'object', properties: { steps: { type: 'number' }, cardio_kind: { type: 'string' }, cardio_minutes: { type: 'number' } } },
    execute: ({ steps, cardio_kind, cardio_minutes }) => {
      if (steps !== undefined) S.steps = { ...(S.steps || {}), [today()]: Math.max(0, Math.round(num(steps))) };
      if (num(cardio_minutes) > 0) S.cardio = [...(S.cardio || []), { id: uid(), date: today(), kind: cardio_kind || 'walk', mins: num(cardio_minutes) }];
      touch();
      return { steps: fit.stepsOn(today()), cardio_today_min: fit.cardioOn(today()).reduce((a, k) => a + num(k.mins), 0) };
    },
  },
  {
    name: 'list_bills',
    description: 'Bills with ids: name, amount, next due date, how often, autopay, category, and the last payment.',
    execute: () => billsMod.bills().filter(b => !b.done).map(b => ({ id: b.id, name: b.name, amount: num(b.amount), due: b.due, repeat: b.repeat || 'monthly', autopay: !!b.autopay, category: b.cat, paused: !!b.paused, last_paid: b.lastPaid || null })),
  },
  {
    name: 'save_bill',
    description: 'Add (no id) or change (with id) a bill. repeat: monthly, biweekly, weekly, quarterly, yearly, once. category: housing, utilities, phone, insurance, vehicle, loan, card, subs, giving, other. delete:true removes it.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, amount: { type: 'number' }, due: { type: 'string', description: 'next due date YYYY-MM-DD' }, repeat: { type: 'string' }, autopay: { type: 'boolean' }, category: { type: 'string' }, notes: { type: 'string' }, delete: { type: 'boolean' } } },
    execute: input => {
      const list = billsMod.bills();
      let b = input.id ? list.find(x => x.id === String(input.id)) : null;
      if (input.id && !b) throw new Error('No bill with that id. Call list_bills.');
      if (b && input.delete) { S.bills = list.filter(x => x !== b); touch(); return 'deleted'; }
      if (!b) { if (!input.name || !isDate(input.due)) throw new Error('A new bill needs a name and a due date.'); b = { id: uid(), created: today(), history: [], repeat: 'monthly', cat: 'other', remind: '3' }; list.push(b); }
      if (input.name) b.name = String(input.name).trim();
      if (input.amount !== undefined) b.amount = String(num(input.amount));
      if (isDate(input.due)) { b.due = input.due; b.anchor = input.due; }
      if (input.repeat && billsMod.FREQ.some(f => f[0] === input.repeat)) { b.repeat = input.repeat; b.anchor = b.due; }
      if (input.autopay !== undefined) b.autopay = !!input.autopay;
      if (input.category && billsMod.BILL_CATS.some(c => c[0] === input.category)) b.cat = input.category;
      if (input.notes !== undefined) b.notes = String(input.notes);
      touch();
      return { id: b.id, name: b.name, amount: num(b.amount), due: b.due, repeat: b.repeat, autopay: !!b.autopay };
    },
  },
  {
    name: 'pay_bill',
    description: 'Mark a bill paid (optionally a different amount) and move it to its next due date.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, amount: { type: 'number' } }, required: ['id'] },
    execute: ({ id, amount }) => {
      const b = billsMod.bills().find(x => x.id === String(id));
      if (!b) throw new Error('No bill with that id. Call list_bills.');
      billsMod.pay(b, amount ?? b.amount);
      touch();
      return { name: b.name, next_due: b.done ? null : b.due };
    },
  },
  {
    name: 'update_goal',
    description: 'Log a new current value for a goal that is updated by hand (from get_reflection goals).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, value: { type: 'number' }, note: { type: 'string' } }, required: ['id', 'value'] },
    execute: ({ id, value, note }) => {
      const g = S.goals.find(x => x.id === String(id));
      if (!g) throw new Error('No goal with that id.');
      if (g.kind !== 'manual') throw new Error('That goal updates itself from the app.');
      logGoal(g, num(value), String(note || ''));
      touch();
      return { title: g.title, percent: Math.round(progress(g).pct * 100) };
    },
  },
];

const instructions = () => {
  const now = new Date();
  return `You are the assistant inside Daybook, ${S.settings.name ? S.settings.name + '\'s' : 'the user\'s'} personal planner on their phone: contracting work, gym, to-dos, habits, check-ins and goals.
It is ${DOW[now.getDay()]} ${today()}, ${fmtTime(hmOf(now.getTime()))}. Dates are YYYY-MM-DD, times HH:MM (24h). To-do categories: ${cats().map(c => c[1]).join(', ')}.
Use the tools to look things up and to make changes. When they mention a task, routine, appointment or habit, add or change it right away, then confirm in one or two short sentences with the day and time. If a needed detail is missing, choose a sensible default and say what you picked; ask a question only when guessing would likely be wrong. Ask before deleting more than one item.
For fitness, call get_fitness first. They are cutting to a lean body-fat level while keeping muscle: favor high protein, heavy lifting, steps and sleep; never suggest crash diets, eating below the plan's floor, or losing more than about 1% of body weight a week.
People they follow up with live in the People list (save_person, log_follow_up), not as to-dos. "Plan my day" means plan_my_day.
For advice on habits, schedules or their week, read their data first (get_day, get_reflection) and use what works: three priorities a day at most, time-block the important work, tie habits to a cue and a time of day, start small, never miss twice, protect sleep, and do a weekly review. Be warm, direct and brief: short paragraphs, at most five bullets, no headings.`;
};

// ---------- chat sheet ----------
let turns = [];
let ctl = null;
function bubble(role, text) { return `<div class="msg ${role}"><div class="bubble">${esc(text)}</div></div>`; }
export function openChat(first = '') {
  const s = sheet({
    title: 'Ask Claude',
    cls: 'chat',
    body: `<div class="chat-log" id="chat-log">${turns.length ? turns.map(t => bubble(t.role, t.content)).join('') : `<p class="muted small">Tell me what to add or change, or ask how your week is going. I can see your schedule, to-dos, habits, check-ins and goals.</p>
        <div class="chips">${['Plan my day', 'What bills are due this week?', 'How is my cut going?', 'I had 2 eggs, toast and a protein shake', 'Who do I need to follow up with?', 'How did this week go?', 'Move Bible study to 6:30pm', 'Suggest a morning routine that fits my 5:40 workouts', 'What should I focus on today?'].map(x => `<button type="button" class="chip" data-suggest="${esc(x)}">${esc(x)}</button>`).join('')}</div>`}</div>
      <form class="chat-form" data-chat-form><label class="sr-only" for="chat-in">Message</label><textarea id="chat-in" rows="2" placeholder="Message Claude"></textarea>
        <div class="row-actions"><span class="muted small grow" data-chat-status></span><button type="button" class="btn ghost sm" data-stop hidden>Stop</button><button type="submit" class="btn primary sm">Send</button></div></form>`,
    onMount: el => {
      el.addEventListener('click', e => { const b = e.target.closest('[data-suggest]'); if (b) send(el, b.dataset.suggest); if (e.target.closest('[data-stop]')) ctl?.abort(); });
      el.querySelector('[data-chat-form]').addEventListener('submit', e => { e.preventDefault(); const ta = el.querySelector('#chat-in'); const v = ta.value.trim(); if (v) { ta.value = ''; send(el, v); } });
      el.querySelector('#chat-in').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.querySelector('[data-chat-form]').requestSubmit(); } });
      if (first) send(el, first); else setTimeout(() => el.querySelector('#chat-in')?.focus(), 80);
    },
    onClose: () => ctl?.abort(),
  });
  return s;
}

async function send(el, text) {
  if (!sample || ctl) return;
  const log = el.querySelector('#chat-log');
  if (!turns.length) log.innerHTML = '';
  turns.push({ role: 'user', content: text });
  log.insertAdjacentHTML('beforeend', bubble('user', text) + `<div class="msg assistant"><div class="bubble thinking">Thinking…</div></div>`);
  const out = log.lastElementChild.querySelector('.bubble');
  const status = el.querySelector('[data-chat-status]');
  const stop = el.querySelector('[data-stop]');
  log.scrollTop = log.scrollHeight;
  const snap = JSON.stringify(S);
  changed = 0;
  ctl = new AbortController();
  stop.hidden = false;
  // Edits answer fast on the quick tier; questions and planning get the thinking tier.
  const deep = /\?|plan|advice|suggest|review|how (did|was|am|is)|why|improve|routine|week/i.test(text);
  try {
    const { text: answer } = await sample([{ role: 'user', content: instructions() }, ...turns.slice(-12)], {
      tools: TOOLS.map(t => ({ ...t, execute: (input, ctx) => { status.textContent = `Working: ${t.name.replace(/_/g, ' ')}…`; return t.execute(input || {}, ctx); } })),
      modelTier: deep ? 'default' : 'quick', signal: ctl.signal,
      onText: ({ text: tx }) => { out.classList.remove('thinking'); out.textContent = tx; log.scrollTop = log.scrollHeight; },
    });
    out.classList.remove('thinking');
    out.textContent = answer;
    turns.push({ role: 'assistant', content: answer });
  } catch (e) {
    out.classList.remove('thinking');
    out.textContent = e?.text || '';
    const msg = { cancelled: 'Stopped.', not_granted: 'Claude is not allowed for this page. You can allow it from the page’s permissions.', rate_limited: 'Too many requests right now. Try again in a minute.', refused: 'Claude could not help with that one.', session_expired: 'Sign in to Claude again, then retry.' }[e?.code] || 'Something went wrong. Try again.';
    if (!e?.text) out.textContent = msg; else out.insertAdjacentHTML('beforeend', `<br><small class="muted">${esc(msg)}</small>`);
    if (e?.text) turns.push({ role: 'assistant', content: e.text });
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'tools_unavailable'].includes(e?.code)) { sample = null; bus.render(); }
  }
  ctl = null;
  stop.hidden = true;
  status.textContent = '';
  if (changed) {
    toast(`Claude made ${changed === 1 ? 'a change' : changed + ' changes'}`, { action: { label: 'Undo', fn: () => { replaceState(JSON.parse(snap)); commit(); } } });
  }
  log.scrollTop = log.scrollHeight;
}

acts.ask = () => openChat();
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-ask-form]');
  if (!f) return;
  e.preventDefault();
  const v = f.querySelector('input').value.trim();
  f.querySelector('input').value = '';
  openChat(v);
});
