// Contracting: schedule, jobs, clients, time clock, expenses/mileage, invoices and money reports.
import {
  $, $$, esc, uid, num, sum, round2, acts, chg, icon, toast, sheet, formSheet, field, input, numInput, textarea, select, checkbox,
  today, addDays, weekStart, parseDate, fmtDate, fmtShort, fmtTime, hmOf, tsOf, fmtDur, hours, fmtHrs, relDay, money,
  monthKey, addMonths, fmtMonth, download, copyText, csv, telLink, mailLink, mapLink, empty, pill, segs, daysLabel, dayPicker, DOW,
} from './util.js';
import { S, commit, undoable, job, client, set } from './store.js';

export const STATUSES = [['lead', 'Lead'], ['quoted', 'Quoted'], ['scheduled', 'Scheduled'], ['active', 'In progress'], ['done', 'Complete'], ['archived', 'Archived']];
const STATUS_KIND = { lead: 'muted', quoted: 'info', scheduled: 'info', active: 'accent', done: 'good', archived: 'muted' };
export const KINDS = [['materials', 'Materials'], ['fuel', 'Fuel'], ['tools', 'Tools & equipment'], ['sub', 'Subcontractor'], ['permits', 'Permits & fees'], ['mileage', 'Mileage'], ['other', 'Other']];
const KIND = Object.fromEntries(KINDS);
const statusLabel = s => (STATUSES.find(x => x[0] === s) || [, s])[1];
export const statusPill = s => pill(statusLabel(s), STATUS_KIND[s]);

// ---------- calculations ----------
export const entryMs = t => Math.max(0, (t.end || Date.now()) - t.start - num(t.breakMin) * 60000);
export function jobRate(j) { return num(j?.rate) || num(client(j?.clientId)?.rate) || num(set('rate')); }
export const expBill = e => e.kind === 'mileage' ? num(e.amount) : num(e.amount) * (1 + num(set('markupPct')) / 100);
export const invSubtotal = inv => sum(inv.lines, l => num(l.qty) * num(l.rate));
export const invTotal = inv => round2(invSubtotal(inv) * (1 + num(inv.taxPct) / 100));
export const isOverdue = inv => inv.status === 'sent' && inv.due && inv.due < today();
const entryValue = t => { const j = job(t.jobId); return j && j.billing === 'hourly' ? hours(entryMs(t)) * jobRate(j) : 0; };
const jobName = id => job(id)?.title || 'No job';
const clientName = id => client(id)?.name || '';
const sortedJobs = () => {
  const order = { active: 0, scheduled: 1, quoted: 2, lead: 3, done: 4, archived: 5 };
  return [...S.jobs].sort((a, b) => (order[a.status] - order[b.status]) || (b.created || 0) - (a.created || 0));
};
const jobOptions = (none = 'No job') => [['', none], ...sortedJobs().filter(j => j.status !== 'archived').map(j => [j.id, j.title + (clientName(j.clientId) ? ` · ${clientName(j.clientId)}` : '')])];

export function jobStats(j) {
  const ents = S.time.filter(t => t.jobId === j.id);
  const exps = S.expenses.filter(e => e.jobId === j.id);
  const invs = S.invoices.filter(i => i.jobId === j.id);
  const ms = sum(ents, entryMs);
  const rate = jobRate(j);
  const hourly = j.billing === 'hourly';
  const expCost = sum(exps, e => num(e.amount));
  const invoiced = sum(invs, invTotal);
  const paid = sum(invs.filter(i => i.status === 'paid'), invTotal);
  const unbilledMs = sum(ents.filter(t => !t.invoiceId && t.end), entryMs);
  const unbilledExp = sum(exps.filter(e => e.billable && !e.invoiceId), expBill);
  const value = hourly ? hours(ms) * rate : num(j.price);
  const unbilled = (hourly ? hours(unbilledMs) * rate : (num(j.price) ? Math.max(0, num(j.price) - sum(invs, invSubtotal)) : 0)) + unbilledExp;
  const effRate = ms > 0 ? (value + (hourly ? sum(exps.filter(e => e.billable), expBill) : 0) - expCost) / hours(ms) : 0;
  return { ents, exps, invs, ms, rate, hourly, expCost, invoiced, paid, unbilled, value, effRate };
}

export function weekStats() {
  const ws = weekStart(today());
  const startTs = tsOf(ws, '00:00');
  const ents = S.time.filter(t => t.start >= startTs);
  const open = S.invoices.filter(i => i.status === 'sent');
  return {
    ms: sum(ents, entryMs),
    value: sum(ents, entryValue),
    outstanding: sum(open, invTotal),
    overdue: open.filter(isOverdue).length,
    unbilled: sum(S.jobs.filter(j => j.status !== 'archived' && j.status !== 'lead'), j => jobStats(j).unbilled),
  };
}

// ---------- timer ----------
export function timerCard() {
  if (S.timer) {
    const j = job(S.timer.jobId);
    return `<section class="timer on">
      <div class="timer-info"><span class="eyebrow">On the clock since ${fmtTime(hmOf(S.timer.start))}</span><strong>${esc(j?.title || 'Job')}</strong><span class="muted">${esc(clientName(j?.clientId))}</span></div>
      <span class="timer-clock" data-since="${S.timer.start}">0:00</span>
      <button type="button" class="btn primary" data-act="timer-stop">${icon('stop')} Clock out</button>
    </section>`;
  }
  const opts = jobOptions('Pick a job').filter(([id]) => !id || ['active', 'scheduled', 'quoted', 'lead'].includes(job(id)?.status));
  if (opts.length < 2) return `<section class="timer"><span class="muted">Add a job to start clocking hours.</span><button type="button" class="btn" data-act="job-new">${icon('plus')} New job</button></section>`;
  return `<section class="timer">
    <label class="sr-only" for="timer-job">Job to clock in to</label>
    ${select('timer-job', opts, S.ui.lastJob || '', 'class="grow"').replace('id="f-timer-job"', 'id="timer-job"')}
    <button type="button" class="btn primary" data-act="timer-start">${icon('play')} Clock in</button>
  </section>`;
}
acts['timer-start'] = el => {
  const jobId = el.dataset.job || $('#timer-job')?.value;
  if (!jobId) return toast('Pick a job to clock in to.');
  if (S.timer) stopTimer();
  S.timer = { jobId, start: Date.now() };
  S.ui.lastJob = jobId;
  commit();
  toast(`Clocked in: ${jobName(jobId)}`);
};
acts['timer-stop'] = () => stopTimer();
function stopTimer() {
  const t = S.timer;
  if (!t) return;
  S.timer = null;
  const e = { id: uid(), jobId: t.jobId, start: t.start, end: Date.now(), breakMin: 0, notes: '', invoiceId: '' };
  if (e.end - e.start < 60000) { commit(); toast('Clocked out. Under a minute, so nothing was logged.'); return; }
  S.time.push(e);
  commit();
  toast(`Logged ${fmtDur(entryMs(e))} to ${jobName(e.jobId)}`, { action: { label: 'Add notes', fn: () => timeForm(e) } });
}

// ---------- schedule ----------
let weekOff = 0;
export function eventRow(e, { showDate = false } = {}) {
  const j = job(e.jobId);
  const c = client(j?.clientId);
  const when = e.start ? `${fmtTime(e.start)}${e.end ? '–' + fmtTime(e.end) : ''}` : 'Any time';
  const addr = j?.address || c?.address;
  const gymBtn = e.gym && !e.done && e.date === today()
    ? (S.active?.date === today() ? `<a class="btn sm primary" href="#gym">Resume</a>` : `<button type="button" class="btn sm primary" data-act="wo-next">${icon('play')} Start</button>`) : '';
  return `<div class="row ev${e.done ? ' is-done' : ''}${e.gym ? ' gym' : ''}">
    <button type="button" class="tick${e.done ? ' on' : ''}" data-act="ev-done" data-id="${e.id}" data-date="${e.date}" aria-label="${e.done ? 'Mark not done' : 'Mark done'}">${icon('check')}</button>
    <div class="row-main" data-act="ev-edit" data-id="${e.id}" data-date="${e.date}" role="button" tabindex="0">
      <div class="row-title">${esc(e.title || j?.title || 'Appointment')}</div>
      <div class="row-sub">${showDate ? esc(relDay(e.date)) + ' · ' : ''}${esc(when)}${c ? ' · ' + esc(c.name) : ''}${e.series ? ` · ${icon('repeat', 'xs')} ${esc(daysLabel(e.days))}` : ''}</div>
      ${addr || c?.phone ? `<div class="row-links">${mapLink(addr)}${telLink(c?.phone)}</div>` : ''}
    </div>${gymBtn}
  </div>`;
}
// Repeating items (days = weekdays it happens on) expand into one occurrence per matching date.
const occurs = (e, date) => e.days?.length
  ? date >= e.date && (!e.until || date <= e.until) && e.days.includes(parseDate(date).getDay()) && !(e.skip || []).includes(date)
  : e.date === date;
export const eventsOn = date => S.events.filter(e => occurs(e, date))
  .map(e => (e.days?.length ? { ...e, date, done: (e.doneDates || []).includes(date), series: true } : e))
  .sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
export const todaysEvents = () => eventsOn(today());

function scheduleView() {
  const ws = addDays(weekStart(today()), weekOff * 7);
  const we = addDays(ws, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const t = today();
  return `<div class="toolbar">
      <div class="stepper"><button type="button" class="icon-btn" data-act="wk" data-d="-1" aria-label="Previous week">${icon('chevL')}</button>
      <strong>${fmtShort(ws)} – ${fmtShort(we)}</strong>
      <button type="button" class="icon-btn" data-act="wk" data-d="1" aria-label="Next week">${icon('chevR')}</button></div>
      ${weekOff ? `<button type="button" class="btn ghost sm" data-act="wk" data-d="0">This week</button>` : ''}
      <span class="grow"></span>
      <button type="button" class="btn ghost sm" data-act="ics-week" data-ws="${ws}" title="Download this week as a calendar file">${icon('cal')} .ics</button>
      <button type="button" class="btn sm" data-act="ev-new" data-date="${days.includes(t) ? t : ws}">${icon('plus')} Add</button>
    </div>
    <div class="week">${days.map(d => {
      const evs = eventsOn(d);
      return `<section class="day${d === t ? ' is-today' : ''}${d < t ? ' is-past' : ''}">
        <header class="day-head"><span class="dow">${fmtDate(d, { weekday: 'short' })}</span><span class="dnum">${parseDate(d).getDate()}</span>
          <span class="day-hrs">${evs.length ? `${evs.length} scheduled` : ''}</span>
          <button type="button" class="icon-btn sm" data-act="ev-new" data-date="${d}" aria-label="Add on ${fmtDate(d)}">${icon('plus')}</button></header>
        ${evs.length ? `<div class="list">${evs.map(e => eventRow(e)).join('')}</div>` : ''}
      </section>`;
    }).join('')}</div>`;
}
acts.wk = el => { const d = +el.dataset.d; weekOff = d === 0 ? 0 : weekOff + d; commit(); };
acts['ev-done'] = el => {
  const e = S.events.find(x => x.id === el.dataset.id);
  if (!e) return;
  if (e.days?.length) {
    const d = el.dataset.date;
    const list = (e.doneDates || []).filter(x => x >= addDays(today(), -90));
    e.doneDates = list.includes(d) ? list.filter(x => x !== d) : [...list, d];
  } else e.done = !e.done;
  commit();
};
acts['ev-new'] = el => eventForm({ date: el.dataset.date || today(), jobId: el.dataset.job || '' });
acts['ev-edit'] = el => eventForm(S.events.find(x => x.id === el.dataset.id), el.dataset.date);

function eventForm(e = {}, occDate = '') {
  const isNew = !e.id;
  const series = !!e.days?.length;
  formSheet({
    title: isNew ? 'Add to schedule' : series ? 'Edit repeating item' : 'Edit',
    fields: `${field('What', input('title', e.title || '', 'text', 'placeholder="Workout, site visit, Bible study…"'))}
      ${field('Job', select('jobId', jobOptions('No job (personal or other)'), e.jobId))}
      <div class="grid3">${field(series ? 'Starting' : 'Date', input('date', e.date || today(), 'date', 'required'))}${field('Start', input('start', e.start ?? '08:00', 'time'))}${field('End', input('end', e.end ?? '', 'time'))}</div>
      ${field('Repeat', select('repeat', [['', 'Does not repeat'], ['days', 'Every week on certain days']], series ? 'days' : ''))}
      <div data-days hidden>${dayPicker('day', e.days || [])}${field('Until', input('until', e.until || '', 'date'), 'Optional. Leave blank to keep it going.')}</div>
      ${checkbox('gym', 'This is a workout (adds a Start button)', !!e.gym)}
      ${field('Notes', textarea('notes', e.notes || ''))}
      ${series && occDate ? `<div class="row-actions wrap"><button type="button" class="btn ghost sm" data-skip>Skip ${esc(fmtDate(occDate))} only</button><button type="button" class="btn ghost sm" data-ics>${icon('cal')} Add series to my calendar</button></div>` : ''}`,
    del: isNew ? null : () => undoable(series ? 'Repeating item deleted' : 'Deleted', () => { S.events = S.events.filter(x => x.id !== e.id); }),
    onMount: (el, s) => {
      const rep = el.querySelector('[name=repeat]');
      const sync = () => {
        const on = rep.value === 'days';
        el.querySelector('[data-days]').hidden = !on;
        if (on && !$$('input[name=day]:checked', el).length) {
          const dow = parseDate(el.querySelector('[name=date]').value || today()).getDay();
          el.querySelector(`input[name=day][value="${dow}"]`).checked = true;
        }
      };
      rep.addEventListener('change', sync); sync();
      el.querySelector('[data-skip]')?.addEventListener('click', () => { e.skip = [...(e.skip || []), occDate]; s.close(); commit(); toast(`Skipped ${fmtDate(occDate)}`, { action: { label: 'Undo', fn: () => { e.skip = e.skip.filter(x => x !== occDate); commit(); } } }); });
      el.querySelector('[data-ics]')?.addEventListener('click', () => download(`${(e.title || 'daybook').replace(/\W+/g, '-').toLowerCase()}.ics`, ics([e]), 'text/calendar'));
    },
    onSubmit: (d, form) => {
      if (!d.date) { toast('Pick a date.'); return false; }
      const days = d.repeat === 'days' ? $$('input[name=day]:checked', form).map(c => +c.value) : [];
      if (d.repeat === 'days' && !days.length) { toast('Pick at least one day.'); return false; }
      if (!d.title.trim() && !d.jobId) { toast('Say what it is.'); return false; }
      const base = { jobId: d.jobId, title: d.title.trim(), date: d.date, start: d.start, end: d.end, notes: d.notes.trim(), days, until: days.length ? d.until : '', gym: d.gym };
      if (isNew) {
        S.events.push({ id: uid(), ...base, done: false, doneDates: [], skip: [] });
        const j = job(d.jobId);
        if (j && ['lead', 'quoted'].includes(j.status)) j.status = 'scheduled';
      } else Object.assign(e, base);
      commit();
      toast(days.length ? `Repeats ${daysLabel(days)}${d.start ? ' at ' + fmtTime(d.start) : ''}` : isNew ? 'Added to schedule' : 'Saved');
    },
  });
}

// Calendar export (.ics) so visits land in the phone's own calendar with a 30-minute reminder.
const icsText = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
const icsStamp = (date, hm) => date.replace(/-/g, '') + (hm ? 'T' + hm.replace(':', '') + '00' : '');
function ics(events) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daybook//EN', 'CALSCALE:GREGORIAN'];
  for (let e of events) {
    const j = job(e.jobId);
    const c = client(j?.clientId);
    const rule = e.days?.length && !e.series;
    let date = e.date;
    if (rule) while (!e.days.includes(parseDate(date).getDay())) date = addDays(date, 1);
    e = { ...e, date };
    out.push('BEGIN:VEVENT', `UID:${e.id}${e.series ? '-' + e.date : ''}@daybook`, `DTSTAMP:${now}`);
    if (rule) out.push(`RRULE:FREQ=WEEKLY;BYDAY=${e.days.map(d => DOW[d].slice(0, 2).toUpperCase()).join(',')}${e.until ? `;UNTIL=${e.until.replace(/-/g, '')}T235959` : ''}`);
    if (e.start) {
      out.push(`DTSTART:${icsStamp(e.date, e.start)}`, `DTEND:${icsStamp(e.date, e.end && e.end > e.start ? e.end : addHour(e.start))}`);
    } else out.push(`DTSTART;VALUE=DATE:${icsStamp(e.date)}`, `DTEND;VALUE=DATE:${icsStamp(addDays(e.date, 1))}`);
    out.push(`SUMMARY:${icsText(e.title || j?.title || 'Appointment')}`);
    if (j?.address || c?.address) out.push(`LOCATION:${icsText(j?.address || c?.address)}`);
    const desc = [c?.name, c?.phone, e.notes].filter(Boolean).join('\n');
    if (desc) out.push(`DESCRIPTION:${icsText(desc)}`);
    if (e.start) out.push('BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'END:VALARM');
    out.push('END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n');
}
const addHour = hm => { const [h, m] = hm.split(':').map(Number); return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
acts['ics-week'] = el => {
  const ws = el.dataset.ws;
  const evs = Array.from({ length: 7 }, (_, i) => eventsOn(addDays(ws, i))).flat();
  if (!evs.length) return toast('Nothing scheduled this week to export.');
  download(`daybook-week-${ws}.ics`, ics(evs), 'text/calendar');
  toast(`Exported ${evs.length} items. Open the file to add them to your calendar.`);
};

// ---------- jobs ----------
let jobFilter = 'open';
function jobsView() {
  const f = { open: j => ['active', 'scheduled'].includes(j.status), leads: j => ['lead', 'quoted'].includes(j.status), done: j => j.status === 'done', all: j => j.status !== 'archived' };
  const list = sortedJobs().filter(f[jobFilter]);
  return `<div class="toolbar">${segs('job-filter', [['open', 'Open'], ['leads', 'Leads'], ['done', 'Complete'], ['all', 'All']], jobFilter)}<span class="grow"></span>
    <button type="button" class="btn ghost sm" data-act="work-tab" data-v="clients">${icon('user')} Clients</button><button type="button" class="btn sm" data-act="job-new">${icon('plus')} Job</button></div>
    ${list.length ? `<div class="list panel">${list.map(jobRow).join('')}</div>` : empty('No jobs here yet', jobFilter === 'open' ? 'Jobs you schedule or start show up here.' : '', `<button type="button" class="btn" data-act="job-new">${icon('plus')} New job</button>`)}`;
}
function jobRow(j) {
  const st = jobStats(j);
  const next = S.events.filter(e => e.jobId === j.id && e.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0];
  return `<div class="row" data-act="job-open" data-id="${j.id}" role="button" tabindex="0">
    <div class="row-main"><div class="row-title">${esc(j.title)}</div>
      <div class="row-sub">${esc(clientName(j.clientId) || 'No client')}${next ? ` · next visit ${esc(relDay(next.date))}` : ''}</div></div>
    <div class="row-end">${statusPill(j.status)}<span class="row-num">${st.ms ? fmtHrs(hours(st.ms)) : (j.billing === 'fixed' && num(j.price) ? money(num(j.price)) : '')}</span></div>
  </div>`;
}
acts['job-filter'] = el => { jobFilter = el.dataset.v; commit(); };
acts['job-new'] = el => jobForm({ clientId: el.dataset.client || '' });
acts['job-open'] = el => jobDetail(el.dataset.id);

function jobForm(j = {}) {
  const isNew = !j.id;
  const s = formSheet({
    title: isNew ? 'New job' : 'Edit job',
    fields: `${field('Job name', input('title', j.title || '', 'text', 'required autofocus placeholder="e.g. Basement egress window"'))}
      <div class="grid2">${field('Client', select('clientId', [['', 'No client'], ...S.clients.map(c => [c.id, c.name])].concat([['__new', '+ New client…']]), j.clientId))}
      ${field('Status', select('status', STATUSES, j.status || 'scheduled'))}</div>
      <div data-newclient hidden>${field('New client name', input('newClient', ''))}<div class="grid2">${field('Phone', input('newPhone', '', 'tel'))}${field('Email', input('newEmail', '', 'email'))}</div></div>
      ${field('Job site address', input('address', j.address || '', 'text', 'autocomplete="street-address"'), 'Leave blank to use the client\'s address.')}
      <div class="grid2">${field('Billing', select('billing', [['hourly', 'Hourly'], ['fixed', 'Fixed price']], j.billing || 'hourly'))}
      <div data-hourly>${field('Hourly rate', numInput('rate', j.rate || '', `placeholder="${esc(set('rate'))}"`), 'Blank uses the client or default rate.')}</div>
      <div data-fixed hidden>${field('Price', numInput('price', j.price || '', 'placeholder="0.00"'))}</div></div>
      <div class="grid2">${field('Start', input('start', j.start || '', 'date'))}${field('Due', input('due', j.due || '', 'date'))}</div>
      ${field('Notes', textarea('notes', j.notes || '', 'placeholder="Scope, materials, colors, gate codes…"'))}`,
    del: isNew ? null : () => undoable('Job deleted', () => {
      S.jobs = S.jobs.filter(x => x.id !== j.id);
      S.events = S.events.filter(e => e.jobId !== j.id);
      S.time.forEach(t => { if (t.jobId === j.id) t.jobId = ''; });
      S.expenses.forEach(e => { if (e.jobId === j.id) e.jobId = ''; });
      if (S.timer?.jobId === j.id) S.timer = null;
    }),
    onMount: el => {
      const sync = () => {
        const fixed = el.querySelector('[name=billing]').value === 'fixed';
        el.querySelector('[data-hourly]').hidden = fixed;
        el.querySelector('[data-fixed]').hidden = !fixed;
        el.querySelector('[data-newclient]').hidden = el.querySelector('[name=clientId]').value !== '__new';
      };
      el.querySelector('[name=billing]').addEventListener('change', sync);
      el.querySelector('[name=clientId]').addEventListener('change', sync);
      sync();
    },
    onSubmit: d => {
      if (!d.title.trim()) { toast('Give the job a name.'); return false; }
      let clientId = d.clientId;
      if (clientId === '__new') {
        if (!d.newClient.trim()) { toast('Enter the new client\'s name.'); return false; }
        const c = { id: uid(), name: d.newClient.trim(), phone: d.newPhone.trim(), email: d.newEmail.trim(), address: d.address.trim(), rate: '', notes: '' };
        S.clients.push(c);
        clientId = c.id;
      }
      const data = { title: d.title.trim(), clientId, status: d.status, address: d.address.trim() || client(clientId)?.address || '', billing: d.billing, rate: d.rate.trim(), price: d.price.trim(), start: d.start, due: d.due, notes: d.notes.trim() };
      if (isNew) { const nj = { id: uid(), created: Date.now(), ...data }; S.jobs.push(nj); commit(); jobDetail(nj.id); }
      else { Object.assign(j, data); commit(); }
    },
  });
  return s;
}

function jobDetail(id) {
  sheet({
    title: 'Job',
    cls: 'wide',
    render: () => {
      const j = job(id);
      if (!j) return null;
      const c = client(j.clientId);
      const st = jobStats(j);
      const visits = S.events.filter(e => e.jobId === id).sort((a, b) => a.date.localeCompare(b.date));
      const upcoming = visits.filter(e => e.date >= today());
      const ents = [...st.ents].sort((a, b) => b.start - a.start);
      const exps = [...st.exps].sort((a, b) => b.date.localeCompare(a.date));
      return `<div class="detail-head"><h3>${esc(j.title)}</h3>
          <div class="inline">${select('jstatus', STATUSES, j.status, `data-chg="job-status" data-id="${id}" aria-label="Status" class="pill-select"`)}
          <span class="muted">${j.billing === 'hourly' ? `${money(st.rate)}/h` : `Fixed ${money(num(j.price))}`}</span></div>
          ${c ? `<p class="who"><button type="button" class="link" data-act="client-open" data-id="${c.id}">${esc(c.name)}</button></p>` : ''}
          <div class="row-links">${mapLink(j.address || c?.address)}${telLink(c?.phone)}${mailLink(c?.email)}</div>
          ${j.notes ? `<p class="note">${esc(j.notes)}</p>` : ''}</div>
        <div class="stats">
          <div><span>Hours</span><strong>${fmtHrs(hours(st.ms))}</strong></div>
          <div><span>${st.hourly ? 'Labor' : 'Price'}</span><strong>${money(st.value)}</strong></div>
          <div><span>Costs</span><strong>${money(st.expCost)}</strong></div>
          <div><span>Left to bill</span><strong>${money(st.unbilled)}</strong></div>
          <div><span>Paid</span><strong>${money(st.paid)}</strong></div>
          <div title="(earnings − costs) ÷ hours"><span>Effective rate</span><strong>${st.ms ? money(st.effRate) + '/h' : '—'}</strong></div>
        </div>
        <div class="row-actions wrap">
          ${S.timer?.jobId === id ? `<button type="button" class="btn primary" data-act="timer-stop">${icon('stop')} Clock out</button>` : `<button type="button" class="btn primary" data-act="timer-start" data-job="${id}">${icon('play')} Clock in</button>`}
          <button type="button" class="btn" data-act="time-new" data-job="${id}">${icon('clock')} Log hours</button>
          <button type="button" class="btn" data-act="exp-new" data-job="${id}">${icon('receipt')} Expense</button>
          <button type="button" class="btn" data-act="ev-new" data-job="${id}" data-date="${today()}">${icon('cal')} Visit</button>
          <button type="button" class="btn" data-act="inv-from-job" data-job="${id}">${icon('mail')} Invoice</button>
          <button type="button" class="btn ghost" data-act="job-edit" data-id="${id}">${icon('edit')} Edit</button>
        </div>
        ${upcoming.length ? `<h4 class="sub-h">Upcoming visits</h4><div class="list">${upcoming.map(e => eventRow(e, { showDate: true })).join('')}</div>` : ''}
        <h4 class="sub-h">Hours <span class="muted">${ents.length}</span></h4>
        ${ents.length ? `<div class="list">${ents.slice(0, 12).map(timeRow).join('')}</div>${ents.length > 12 ? `<p class="muted small">Showing the latest 12. All entries are under Work → Time.</p>` : ''}` : '<p class="muted small">No hours logged yet.</p>'}
        <h4 class="sub-h">Expenses <span class="muted">${exps.length}</span></h4>
        ${exps.length ? `<div class="list">${exps.map(expRow).join('')}</div>` : '<p class="muted small">No expenses yet.</p>'}
        ${st.invs.length ? `<h4 class="sub-h">Invoices</h4><div class="list">${st.invs.map(invRow).join('')}</div>` : ''}`;
    },
  });
}
chg['job-status'] = el => { const j = job(el.dataset.id); if (j) { j.status = el.value; commit(); toast(`Marked ${statusLabel(el.value).toLowerCase()}`); } };
acts['job-edit'] = el => jobForm(job(el.dataset.id));

// ---------- clients ----------
function clientsView() {
  const list = [...S.clients].sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="toolbar"><span class="muted">${list.length} client${list.length === 1 ? '' : 's'}</span><span class="grow"></span><button type="button" class="btn sm" data-act="client-new">${icon('plus')} Client</button></div>
    ${list.length ? `<div class="list panel">${list.map(c => {
      const jobs = S.jobs.filter(j => j.clientId === c.id);
      const owed = sum(S.invoices.filter(i => i.clientId === c.id && i.status === 'sent'), invTotal);
      return `<div class="row" data-act="client-open" data-id="${c.id}" role="button" tabindex="0"><div class="row-main"><div class="row-title">${esc(c.name)}</div>
        <div class="row-sub">${jobs.length} job${jobs.length === 1 ? '' : 's'}${c.phone ? ' · ' + esc(c.phone) : ''}</div></div>
        <div class="row-end">${owed ? `<span class="row-num warn-text">${money(owed)} owed</span>` : ''}</div></div>`;
    }).join('')}</div>` : empty('No clients yet', 'Add the people and companies you work for. Their rate, address and phone fill in automatically on jobs.', `<button type="button" class="btn" data-act="client-new">${icon('plus')} New client</button>`)}`;
}
acts['client-new'] = () => clientForm();
acts['client-open'] = el => clientDetail(el.dataset.id);
acts['client-edit'] = el => clientForm(client(el.dataset.id));
function clientForm(c = {}) {
  const isNew = !c.id;
  formSheet({
    title: isNew ? 'New client' : 'Edit client',
    fields: `${field('Name', input('name', c.name || '', 'text', 'required autofocus autocomplete="off"'))}
      <div class="grid2">${field('Phone', input('phone', c.phone || '', 'tel'))}${field('Email', input('email', c.email || '', 'email'))}</div>
      ${field('Address', input('address', c.address || ''))}
      ${field('Hourly rate', numInput('rate', c.rate || '', `placeholder="${esc(set('rate'))}"`), 'Blank uses your default rate.')}
      ${field('Notes', textarea('notes', c.notes || '', 'placeholder="Billing contact, PO rules, gate codes…"'))}`,
    del: isNew ? null : () => undoable('Client deleted', () => {
      S.clients = S.clients.filter(x => x.id !== c.id);
      S.jobs.forEach(j => { if (j.clientId === c.id) j.clientId = ''; });
    }),
    onSubmit: d => {
      if (!d.name.trim()) { toast('Enter a name.'); return false; }
      const data = { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), address: d.address.trim(), rate: d.rate.trim(), notes: d.notes.trim() };
      if (isNew) S.clients.push({ id: uid(), ...data }); else Object.assign(c, data);
      commit();
    },
  });
}
function clientDetail(id) {
  sheet({
    title: 'Client',
    render: () => {
      const c = client(id);
      if (!c) return null;
      const jobs = S.jobs.filter(j => j.clientId === id);
      const invs = S.invoices.filter(i => i.clientId === id);
      const yr = today().slice(0, 4);
      return `<div class="detail-head"><h3>${esc(c.name)}</h3><div class="row-links">${telLink(c.phone)}${mailLink(c.email)}${mapLink(c.address)}</div>
        ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ''}</div>
        <div class="stats three"><div><span>Rate</span><strong>${money(num(c.rate) || num(set('rate')))}/h</strong></div>
          <div><span>Owed</span><strong>${money(sum(invs.filter(i => i.status === 'sent'), invTotal))}</strong></div>
          <div><span>Paid in ${yr}</span><strong>${money(sum(invs.filter(i => i.status === 'paid' && (i.paidDate || i.date).startsWith(yr)), invTotal))}</strong></div></div>
        <div class="row-actions"><button type="button" class="btn" data-act="job-new" data-client="${id}">${icon('plus')} Job</button><button type="button" class="btn ghost" data-act="client-edit" data-id="${id}">${icon('edit')} Edit</button></div>
        <h4 class="sub-h">Jobs</h4>${jobs.length ? `<div class="list">${jobs.map(jobRow).join('')}</div>` : '<p class="muted small">No jobs yet.</p>'}
        ${invs.length ? `<h4 class="sub-h">Invoices</h4><div class="list">${invs.map(invRow).join('')}</div>` : ''}`;
    },
  });
}

// ---------- time ----------
function timeRow(t) {
  const running = !t.end;
  return `<div class="row" data-act="time-edit" data-id="${t.id}" role="button" tabindex="0">
    <div class="row-main"><div class="row-title">${esc(jobName(t.jobId))}</div>
    <div class="row-sub">${esc(fmtDate(isoOfTs(t.start)))} · ${fmtTime(hmOf(t.start))}–${running ? 'now' : fmtTime(hmOf(t.end))}${num(t.breakMin) ? ` · ${num(t.breakMin)}m break` : ''}${t.notes ? ' · ' + esc(t.notes) : ''}</div></div>
    <div class="row-end"><span class="row-num">${fmtDur(entryMs(t))}</span>${t.invoiceId ? pill('Billed', 'muted') : ''}</div></div>`;
}
const isoOfTs = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let timeWeeks = 4;
function timeView() {
  const ws0 = weekStart(today());
  const weeks = Array.from({ length: timeWeeks }, (_, i) => addDays(ws0, -7 * i));
  const older = S.time.some(t => t.start < tsOf(weeks[weeks.length - 1], '00:00'));
  return `${timerCard()}
    <div class="toolbar"><span class="grow"></span><button type="button" class="btn ghost sm" data-act="csv-time">${icon('download')} CSV</button><button type="button" class="btn sm" data-act="time-new">${icon('plus')} Log hours</button></div>
    ${weeks.map(ws => {
      const a = tsOf(ws, '00:00'), b = tsOf(addDays(ws, 7), '00:00');
      const ents = S.time.filter(t => t.start >= a && t.start < b).sort((x, y) => y.start - x.start);
      return `<section class="group"><header class="group-head"><h3>${ws === ws0 ? 'This week' : 'Week of ' + fmtShort(ws)}</h3>
        <span class="muted">${fmtHrs(hours(sum(ents, entryMs)))}${sum(ents, entryValue) ? ' · ' + money(sum(ents, entryValue)) : ''}</span></header>
        ${ents.length ? `<div class="list panel">${ents.map(timeRow).join('')}</div>` : '<p class="muted small">No hours.</p>'}</section>`;
    }).join('')}
    ${older ? `<button type="button" class="btn ghost block" data-act="time-more">Show 4 more weeks</button>` : ''}`;
}
acts['time-more'] = () => { timeWeeks += 4; commit(); };
acts['time-new'] = el => timeForm({ jobId: el.dataset.job || S.ui.lastJob || '' });
acts['time-edit'] = el => timeForm(S.time.find(t => t.id === el.dataset.id));
function timeForm(t = {}) {
  const isNew = !t.id;
  const date = t.start ? isoOfTs(t.start) : today();
  formSheet({
    title: isNew ? 'Log hours' : 'Edit hours',
    fields: `${field('Job', select('jobId', jobOptions(), t.jobId))}
      <div class="grid3">${field('Date', input('date', date, 'date'))}${field('Start', input('start', t.start ? hmOf(t.start) : '08:00', 'time'))}${field('End', input('end', t.end ? hmOf(t.end) : '16:00', 'time'))}</div>
      ${field('Unpaid break (minutes)', numInput('breakMin', t.breakMin ?? (isNew ? '30' : '0')))}
      ${field('Notes', input('notes', t.notes || '', 'text', 'placeholder="What got done"'))}
      ${t.invoiceId ? '<p class="muted small">This entry is on an invoice. Changing it does not change the invoice.</p>' : ''}`,
    del: isNew ? null : () => undoable('Hours deleted', () => { S.time = S.time.filter(x => x.id !== t.id); }),
    onSubmit: d => {
      const start = tsOf(d.date, d.start);
      let end = tsOf(d.date, d.end);
      if (end <= start) end += 864e5; // past midnight
      const data = { jobId: d.jobId, start, end, breakMin: num(d.breakMin), notes: d.notes.trim() };
      if (isNew) S.time.push({ id: uid(), invoiceId: '', ...data }); else Object.assign(t, data);
      if (d.jobId) S.ui.lastJob = d.jobId;
      commit();
      toast(`${isNew ? 'Logged' : 'Saved'} ${fmtDur(end - start - data.breakMin * 60000)}`);
    },
  });
}

// ---------- expenses ----------
function expRow(e) {
  return `<div class="row" data-act="exp-edit" data-id="${e.id}" role="button" tabindex="0">
    <div class="row-main"><div class="row-title">${esc(e.kind === 'mileage' ? `${num(e.miles)} mi${e.desc ? ' · ' + e.desc : ''}` : e.desc || KIND[e.kind])}</div>
    <div class="row-sub">${esc(fmtShort(e.date))} · ${esc(KIND[e.kind] || 'Other')}${e.jobId ? ' · ' + esc(jobName(e.jobId)) : ''}</div></div>
    <div class="row-end"><span class="row-num">${money(num(e.amount))}</span>${e.billable ? pill(e.invoiceId ? 'Billed' : 'Billable', e.invoiceId ? 'muted' : 'info') : ''}</div></div>`;
}
acts['exp-new'] = el => expForm({ jobId: el.dataset.job || '', kind: el.dataset.kind || 'materials' });
acts['exp-edit'] = el => expForm(S.expenses.find(x => x.id === el.dataset.id));
function expForm(e = {}) {
  const isNew = !e.id;
  formSheet({
    title: isNew ? (e.kind === 'mileage' ? 'Log mileage' : 'Add expense') : 'Edit expense',
    fields: `<div class="grid2">${field('Type', select('kind', KINDS, e.kind || 'materials'))}${field('Date', input('date', e.date || today(), 'date'))}</div>
      ${field('Job', select('jobId', jobOptions('General business'), e.jobId))}
      ${field('Description', input('desc', e.desc || '', 'text', 'placeholder="Supplier, what you bought"'))}
      <div data-amt>${field('Amount', numInput('amount', e.amount || '', 'placeholder="0.00"'))}</div>
      <div data-miles hidden>${field('Miles', numInput('miles', e.miles || ''), `At ${money(num(set('mileRate')))} per mile (change in More).`)}</div>
      ${checkbox('billable', 'Bill this to the client', e.billable ?? (isNew && e.kind === 'materials' && !!e.jobId))}
      <p class="muted small" data-markup>${num(set('markupPct')) ? `Billable materials get your ${num(set('markupPct'))}% markup on invoices.` : ''}</p>`,
    del: isNew ? null : () => undoable('Expense deleted', () => { S.expenses = S.expenses.filter(x => x.id !== e.id); }),
    onMount: el => {
      const k = el.querySelector('[name=kind]');
      const sync = () => { const m = k.value === 'mileage'; el.querySelector('[data-amt]').hidden = m; el.querySelector('[data-miles]').hidden = !m; };
      k.addEventListener('change', sync); sync();
    },
    onSubmit: d => {
      const miles = num(d.miles);
      const amount = d.kind === 'mileage' ? round2(miles * num(set('mileRate'))) : num(d.amount);
      if (!amount) { toast(d.kind === 'mileage' ? 'Enter the miles driven.' : 'Enter the amount.'); return false; }
      const data = { kind: d.kind, date: d.date || today(), jobId: d.jobId, desc: d.desc.trim(), amount: amount.toFixed(2), miles: d.kind === 'mileage' ? String(miles) : '', billable: d.billable };
      if (isNew) S.expenses.push({ id: uid(), invoiceId: '', ...data }); else Object.assign(e, data);
      commit();
      toast(`${isNew ? 'Added' : 'Saved'} ${money(amount)}`);
    },
  });
}

// ---------- money (month report) ----------
let month = monthKey(today());
function moneyView() {
  const inMonth = (d, m = month) => d && d.startsWith(m);
  const yr = month.slice(0, 4);
  const calc = pred => {
    const invoiced = sum(S.invoices.filter(i => i.status !== 'draft' && pred(i.date)), invTotal);
    const collected = sum(S.invoices.filter(i => i.status === 'paid' && pred(i.paidDate || i.date)), invTotal);
    const spent = sum(S.expenses.filter(e => pred(e.date)), e => num(e.amount));
    const net = collected - spent;
    return { invoiced, collected, spent, net, tax: Math.max(0, net) * num(set('taxPct')) / 100 };
  };
  const m = calc(d => inMonth(d));
  const y = calc(d => d && d.startsWith(yr) && d.slice(0, 7) <= month);
  const exps = S.expenses.filter(e => inMonth(e.date)).sort((a, b) => b.date.localeCompare(a.date));
  const byKind = KINDS.map(([k, l]) => [l, sum(exps.filter(e => e.kind === k), e => num(e.amount))]).filter(x => x[1] > 0);
  const miles = sum(exps.filter(e => e.kind === 'mileage'), e => num(e.miles));
  return `<div class="toolbar"><div class="stepper"><button type="button" class="icon-btn" data-act="mon" data-d="-1" aria-label="Previous month">${icon('chevL')}</button>
      <strong>${fmtMonth(month)}</strong><button type="button" class="icon-btn" data-act="mon" data-d="1" aria-label="Next month">${icon('chevR')}</button></div><span class="grow"></span>
      <button type="button" class="btn ghost sm" data-act="exp-new" data-kind="mileage">${icon('pin')} Miles</button>
      <button type="button" class="btn sm" data-act="exp-new">${icon('plus')} Expense</button></div>
    <div class="stats">
      <div><span>Invoiced</span><strong>${money(m.invoiced)}</strong></div>
      <div><span>Collected</span><strong>${money(m.collected)}</strong></div>
      <div><span>Spent</span><strong>${money(m.spent)}</strong></div>
      <div><span>Net</span><strong class="${m.net < 0 ? 'bad-text' : ''}">${money(m.net)}</strong></div>
      <div title="${num(set('taxPct'))}% of net, set in More"><span>Set aside for tax</span><strong>${money(m.tax)}</strong></div>
      <div><span>Miles</span><strong>${miles.toLocaleString()}</strong></div>
    </div>
    <p class="muted small ytd">${yr} through ${fmtMonth(month).split(' ')[0]}: collected ${money(y.collected)}, spent ${money(y.spent)}, net ${money(y.net)}, set aside ${money(y.tax)}.</p>
    ${byKind.length ? `<div class="bars">${byKind.map(([l, v]) => `<div class="bar-row"><span>${esc(l)}</span><div class="bar"><i style="width:${Math.max(2, v / Math.max(...byKind.map(x => x[1])) * 100)}%"></i></div><b>${money(v)}</b></div>`).join('')}</div>` : ''}
    <section class="group"><header class="group-head"><h3>Expenses</h3><span class="muted">${exps.length}</span></header>
    ${exps.length ? `<div class="list panel">${exps.map(expRow).join('')}</div>` : '<p class="muted small">Nothing spent this month.</p>'}</section>
    <div class="row-actions wrap"><button type="button" class="btn ghost sm" data-act="csv-exp">${icon('download')} Expenses ${yr} CSV</button><button type="button" class="btn ghost sm" data-act="csv-inv">${icon('download')} Invoices ${yr} CSV</button></div>`;
}
acts.mon = el => { month = addMonths(month, +el.dataset.d); commit(); };
acts['csv-exp'] = () => {
  const yr = month.slice(0, 4);
  const rows = S.expenses.filter(e => e.date.startsWith(yr)).sort((a, b) => a.date.localeCompare(b.date))
    .map(e => [e.date, KIND[e.kind], e.desc, e.miles, num(e.amount).toFixed(2), jobName(e.jobId), clientName(job(e.jobId)?.clientId), e.billable ? 'yes' : 'no']);
  download(`expenses-${yr}.csv`, csv([['Date', 'Type', 'Description', 'Miles', 'Amount', 'Job', 'Client', 'Billable'], ...rows]), 'text/csv');
};
acts['csv-inv'] = () => {
  const yr = month.slice(0, 4);
  const rows = S.invoices.filter(i => i.date.startsWith(yr)).map(i => [i.no, i.date, i.due, clientName(i.clientId), jobName(i.jobId), i.status, invTotal(i).toFixed(2), i.paidDate]);
  download(`invoices-${yr}.csv`, csv([['Invoice', 'Date', 'Due', 'Client', 'Job', 'Status', 'Total', 'Paid on'], ...rows]), 'text/csv');
};
acts['csv-time'] = () => {
  const rows = [...S.time].sort((a, b) => a.start - b.start).map(t => [isoOfTs(t.start), hmOf(t.start), t.end ? hmOf(t.end) : '', num(t.breakMin), (hours(entryMs(t))).toFixed(2), jobName(t.jobId), clientName(job(t.jobId)?.clientId), t.notes]);
  download('hours.csv', csv([['Date', 'Start', 'End', 'Break min', 'Hours', 'Job', 'Client', 'Notes'], ...rows]), 'text/csv');
};

// ---------- invoices ----------
let invFilter = 'open';
function invRow(i) {
  const st = i.status === 'paid' ? pill('Paid', 'good') : isOverdue(i) ? pill('Overdue', 'bad') : i.status === 'sent' ? pill(`Due ${fmtShort(i.due)}`, 'warn') : pill('Draft', 'muted');
  return `<div class="row" data-act="inv-open" data-id="${i.id}" role="button" tabindex="0">
    <div class="row-main"><div class="row-title">#${esc(i.no)} · ${esc(clientName(i.clientId) || 'No client')}</div>
    <div class="row-sub">${esc(fmtShort(i.date))}${i.jobId ? ' · ' + esc(jobName(i.jobId)) : ''}</div></div>
    <div class="row-end">${st}<span class="row-num">${money(invTotal(i))}</span></div></div>`;
}
function invoicesView() {
  const f = { open: i => i.status !== 'paid', paid: i => i.status === 'paid', all: () => true };
  const list = S.invoices.filter(f[invFilter]).sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  const open = S.invoices.filter(i => i.status === 'sent');
  const overdue = open.filter(isOverdue);
  return `<div class="stats three"><div><span>Outstanding</span><strong>${money(sum(open, invTotal))}</strong></div>
      <div><span>Overdue</span><strong class="${overdue.length ? 'bad-text' : ''}">${money(sum(overdue, invTotal))}</strong></div>
      <div><span>Ready to bill</span><strong>${money(sum(S.jobs.filter(j => j.status !== 'lead' && j.status !== 'archived'), j => jobStats(j).unbilled))}</strong></div></div>
    <div class="toolbar">${segs('inv-filter', [['open', 'Open'], ['paid', 'Paid'], ['all', 'All']], invFilter)}<span class="grow"></span><button type="button" class="btn sm" data-act="inv-new">${icon('plus')} Invoice</button></div>
    ${list.length ? `<div class="list panel">${list.map(invRow).join('')}</div>` : empty(invFilter === 'paid' ? 'No paid invoices yet' : 'Nothing open', 'Make an invoice from a job and Daybook pulls in the unbilled hours and billable expenses for you.')}`;
}
acts['inv-filter'] = el => { invFilter = el.dataset.v; commit(); };
acts['inv-new'] = () => {
  const ready = S.jobs.filter(j => j.status !== 'archived').map(j => [j, jobStats(j).unbilled]).sort((a, b) => b[1] - a[1]);
  const s = sheet({
    title: 'New invoice',
    body: `<p class="muted">Pick a job. Its unbilled hours and billable expenses become line items you can edit.</p>
      <div class="list panel">${ready.map(([j, u]) => `<div class="row" data-pick="${j.id}" role="button" tabindex="0"><div class="row-main"><div class="row-title">${esc(j.title)}</div><div class="row-sub">${esc(clientName(j.clientId))}</div></div><div class="row-end"><span class="row-num">${u ? money(u) : ''}</span></div></div>`).join('') || '<p class="muted small">No jobs yet.</p>'}</div>
      <div class="row-actions"><button type="button" class="btn ghost" data-blank>Blank invoice</button></div>`,
  });
  s.el.addEventListener('click', e => {
    const r = e.target.closest('[data-pick]');
    if (r) { s.close(); createInvoice(r.dataset.pick); }
    if (e.target.closest('[data-blank]')) { s.close(); createInvoice(''); }
  });
};
acts['inv-from-job'] = el => createInvoice(el.dataset.job);
acts['inv-open'] = el => invoiceView(el.dataset.id);

function createInvoice(jobId) {
  const j = job(jobId);
  const lines = [];
  if (j) {
    const st = jobStats(j);
    if (j.billing === 'hourly') {
      const byDay = {};
      st.ents.filter(t => !t.invoiceId && t.end).sort((a, b) => a.start - b.start).forEach(t => {
        const d = isoOfTs(t.start);
        (byDay[d] = byDay[d] || { ms: 0, notes: [], ids: [] }).ms += entryMs(t);
        if (t.notes) byDay[d].notes.push(t.notes);
        byDay[d].ids.push(t.id);
      });
      for (const [d, v] of Object.entries(byDay)) lines.push({ desc: `Labor ${fmtShort(d)}${v.notes.length ? ': ' + v.notes.join('; ') : ''}`, qty: round2(hours(v.ms)), rate: st.rate, timeIds: v.ids });
    } else {
      const billed = sum(st.invs, invSubtotal);
      const left = num(j.price) - billed;
      if (left > 0) lines.push({ desc: billed ? `${j.title} (balance)` : j.title, qty: 1, rate: round2(left) });
      st.ents.filter(t => !t.invoiceId && t.end).forEach(t => { t.invoiceId = 'pending'; });
    }
    st.exps.filter(e => e.billable && !e.invoiceId).forEach(e => {
      lines.push(e.kind === 'mileage'
        ? { desc: `Mileage${e.desc ? ': ' + e.desc : ''}`, qty: num(e.miles), rate: round2(num(e.amount) / (num(e.miles) || 1)), expId: e.id }
        : { desc: `${KIND[e.kind]}: ${e.desc || ''}`.trim(), qty: 1, rate: round2(expBill(e)), expId: e.id });
    });
  }
  if (!lines.length) lines.push({ desc: j?.title || '', qty: 1, rate: 0 });
  const inv = { id: uid(), no: String(S.settings.nextInv), jobId: j?.id || '', clientId: j?.clientId || '', date: today(), due: addDays(today(), num(set('terms'))), status: 'draft', paidDate: '', taxPct: '', notes: set('invNote'), lines: lines.map(({ desc, qty, rate }) => ({ desc, qty, rate })) };
  // Link the source entries so they are not billed twice.
  lines.forEach(l => {
    (l.timeIds || []).forEach(id => { const t = S.time.find(x => x.id === id); if (t) t.invoiceId = inv.id; });
    if (l.expId) { const e = S.expenses.find(x => x.id === l.expId); if (e) e.invoiceId = inv.id; }
  });
  S.time.forEach(t => { if (t.invoiceId === 'pending') t.invoiceId = inv.id; });
  S.settings.nextInv = num(S.settings.nextInv) + 1;
  S.invoices.push(inv);
  commit();
  invoiceView(inv.id);
  invoiceForm(inv);
}

function invoiceDoc(inv) {
  const c = client(inv.clientId);
  const j = job(inv.jobId);
  const st = S.settings;
  const sub = invSubtotal(inv);
  const tax = sub * num(inv.taxPct) / 100;
  return `<article class="invoice-doc">
    <header class="inv-top"><div><h3>${esc(st.biz || st.name || 'Your business name')}</h3>
      <p>${[st.bizAddr, st.bizPhone, st.bizEmail].filter(Boolean).map(esc).join('<br>') || '<span class="muted">Add your business details in More → Invoices</span>'}</p></div>
      <div class="inv-meta"><h4>Invoice</h4><dl><dt>No.</dt><dd>${esc(inv.no)}</dd><dt>Date</dt><dd>${esc(fmtDate(inv.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</dd><dt>Due</dt><dd>${esc(fmtDate(inv.due, { month: 'short', day: 'numeric', year: 'numeric' }))}</dd></dl></div></header>
    <section class="inv-to"><span class="eyebrow">Bill to</span><strong>${esc(c?.name || '')}</strong><p>${[c?.address, c?.email, c?.phone].filter(Boolean).map(esc).join('<br>')}</p>
      ${j ? `<p class="muted">Job: ${esc(j.title)}${j.address && j.address !== c?.address ? ', ' + esc(j.address) : ''}</p>` : ''}</section>
    <div class="table-wrap"><table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead>
      <tbody>${inv.lines.map(l => `<tr><td>${esc(l.desc)}</td><td class="n">${num(l.qty)}</td><td class="n">${money(num(l.rate))}</td><td class="n">${money(num(l.qty) * num(l.rate))}</td></tr>`).join('')}</tbody></table></div>
    <dl class="inv-totals"><dt>Subtotal</dt><dd>${money(sub)}</dd>${num(inv.taxPct) ? `<dt>Tax ${num(inv.taxPct)}%</dt><dd>${money(tax)}</dd>` : ''}
      <dt class="total">${inv.status === 'paid' ? 'Paid' : 'Balance due'}</dt><dd class="total">${money(sub + tax)}</dd></dl>
    ${inv.notes ? `<p class="inv-notes">${esc(inv.notes)}</p>` : ''}${st.payNote ? `<p class="inv-notes muted">${esc(st.payNote)}</p>` : ''}
  </article>`;
}
function invoiceText(inv) {
  const c = client(inv.clientId);
  const st = S.settings;
  return [`INVOICE #${inv.no} from ${st.biz || st.name || ''}`.trim(), `Date: ${inv.date}   Due: ${inv.due}`, c ? `Bill to: ${c.name}` : '', '',
    ...inv.lines.map(l => `- ${l.desc}: ${num(l.qty)} × ${money(num(l.rate))} = ${money(num(l.qty) * num(l.rate))}`), '',
    num(inv.taxPct) ? `Tax ${num(inv.taxPct)}%` : '', `Total due: ${money(invTotal(inv))}`, inv.notes, st.payNote].filter((x, i) => x || i === 3).join('\n');
}
function invoiceView(id) {
  sheet({
    title: 'Invoice',
    cls: 'wide',
    render: () => {
      const inv = S.invoices.find(i => i.id === id);
      if (!inv) return null;
      const c = client(inv.clientId);
      return `<div class="row-actions wrap">
          ${inv.status === 'draft' ? `<button type="button" class="btn primary" data-act="inv-status" data-id="${id}" data-s="sent">${icon('check')} Mark sent</button>` : ''}
          ${inv.status === 'sent' ? `<button type="button" class="btn primary" data-act="inv-status" data-id="${id}" data-s="paid">${icon('check')} Mark paid</button>` : ''}
          ${inv.status === 'paid' ? `<button type="button" class="btn ghost" data-act="inv-status" data-id="${id}" data-s="sent">Mark unpaid</button>` : ''}
          <button type="button" class="btn" data-act="inv-edit" data-id="${id}">${icon('edit')} Edit</button>
          <button type="button" class="btn" data-act="inv-print" data-id="${id}">${icon('print')} Print / PDF</button>
          <button type="button" class="btn" data-act="inv-copy" data-id="${id}">${icon('copy')} Copy text</button>
          ${c?.email ? `<a class="btn" href="mailto:${esc(c.email)}?subject=${encodeURIComponent(`Invoice #${inv.no}`)}&body=${encodeURIComponent(invoiceText(inv))}">${icon('mail')} Email</a>` : ''}
        </div>
        ${isOverdue(inv) ? `<p class="callout bad">Overdue by ${-Math.round((parseDate(inv.due) - parseDate(today())) / 864e5)} days.</p>` : ''}
        ${invoiceDoc(inv)}
        <div class="row-actions"><button type="button" class="btn ghost danger-text" data-act="inv-del" data-id="${id}">${icon('trash')} Delete invoice</button></div>`;
    },
  });
}
acts['inv-status'] = el => {
  const inv = S.invoices.find(i => i.id === el.dataset.id);
  if (!inv) return;
  inv.status = el.dataset.s;
  inv.paidDate = inv.status === 'paid' ? today() : '';
  const j = job(inv.jobId);
  if (inv.status === 'paid' && j && j.status === 'active' && jobStats(j).unbilled < 0.01) j.status = 'done';
  commit();
  toast(inv.status === 'paid' ? `#${inv.no} paid: ${money(invTotal(inv))}` : `#${inv.no} marked ${inv.status}`);
};
acts['inv-copy'] = el => { const inv = S.invoices.find(i => i.id === el.dataset.id); if (inv) copyText(invoiceText(inv), 'Invoice text copied'); };
acts['inv-print'] = el => {
  const inv = S.invoices.find(i => i.id === el.dataset.id);
  if (!inv) return;
  const root = $('#print-root');
  root.innerHTML = invoiceDoc(inv);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  try { window.print(); } catch { /* blocked */ }
  setTimeout(() => { if (document.body.classList.contains('printing')) toast('If no print dialog opened, use Copy text instead.'); }, 1500);
};
acts['inv-del'] = el => {
  const id = el.dataset.id;
  undoable('Invoice deleted. Its hours and expenses are unbilled again.', () => {
    S.invoices = S.invoices.filter(i => i.id !== id);
    S.time.forEach(t => { if (t.invoiceId === id) t.invoiceId = ''; });
    S.expenses.forEach(e => { if (e.invoiceId === id) e.invoiceId = ''; });
  });
};
acts['inv-edit'] = el => invoiceForm(S.invoices.find(i => i.id === el.dataset.id));

function invoiceForm(inv) {
  const lineRow = (l = { desc: '', qty: 1, rate: '' }) => `<div class="line-row"><input name="ld" aria-label="Description" value="${esc(l.desc)}" placeholder="Description"><input name="lq" aria-label="Quantity" inputmode="decimal" value="${esc(l.qty)}"><input name="lr" aria-label="Rate" inputmode="decimal" value="${esc(l.rate)}" placeholder="0.00"><span class="line-amt"></span><button type="button" class="icon-btn sm" data-rm aria-label="Remove line">${icon('x')}</button></div>`;
  formSheet({
    title: `Edit invoice #${inv.no}`,
    fields: `<div class="grid3">${field('Number', input('no', inv.no))}${field('Date', input('date', inv.date, 'date'))}${field('Due', input('due', inv.due, 'date'))}</div>
      ${field('Client', select('clientId', [['', 'No client'], ...S.clients.map(c => [c.id, c.name])], inv.clientId))}
      <div class="lines"><div class="line-row head"><span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span></span></div><div data-lines>${inv.lines.map(lineRow).join('')}</div>
      <button type="button" class="btn ghost sm" data-add>${icon('plus')} Add line</button></div>
      <div class="grid2">${field('Sales tax %', numInput('taxPct', inv.taxPct || '', 'placeholder="0"'))}<div class="inv-sum"><span>Total</span><strong data-total></strong></div></div>
      ${field('Note on invoice', textarea('notes', inv.notes || ''))}`,
    onMount: el => {
      const box = el.querySelector('[data-lines]');
      const recalc = () => {
        let t = 0;
        $$('.line-row', box).forEach(r => { const a = num(r.querySelector('[name=lq]').value) * num(r.querySelector('[name=lr]').value); t += a; r.querySelector('.line-amt').textContent = money(a); });
        el.querySelector('[data-total]').textContent = money(t * (1 + num(el.querySelector('[name=taxPct]').value) / 100));
      };
      el.addEventListener('input', recalc);
      el.querySelector('[data-add]').onclick = () => { box.insertAdjacentHTML('beforeend', lineRow()); recalc(); box.lastElementChild.querySelector('input').focus(); };
      box.addEventListener('click', e => { if (e.target.closest('[data-rm]')) { e.target.closest('.line-row').remove(); recalc(); } });
      recalc();
    },
    onSubmit: (d, form) => {
      const lines = $$('[data-lines] .line-row', form).map(r => ({ desc: r.querySelector('[name=ld]').value.trim(), qty: num(r.querySelector('[name=lq]').value), rate: num(r.querySelector('[name=lr]').value) })).filter(l => l.desc || l.rate);
      if (!lines.length) { toast('Add at least one line.'); return false; }
      Object.assign(inv, { no: d.no.trim() || inv.no, date: d.date, due: d.due, clientId: d.clientId, taxPct: d.taxPct.trim(), notes: d.notes.trim(), lines });
      commit();
      toast('Invoice saved');
    },
  });
}

// ---------- view ----------
const TABS = [['schedule', 'Schedule'], ['jobs', 'Jobs'], ['time', 'Time'], ['invoices', 'Invoices'], ['money', 'Money']];
const VIEWS = { schedule: scheduleView, jobs: jobsView, time: timeView, invoices: invoicesView, money: moneyView, clients: clientsView };
export function view() {
  const tab = VIEWS[S.ui.workTab] ? S.ui.workTab : 'schedule';
  const inClients = tab === 'clients';
  return `${segs('work-tab', TABS, inClients ? 'jobs' : tab)}${inClients ? `<div class="hub-back"><button type="button" class="btn ghost sm" data-act="work-tab" data-v="jobs">${icon('chevL')} Jobs</button></div><h2 class="hub-title">Clients</h2>` : ''}<div class="tab-body">${VIEWS[tab]()}</div>`;
}
acts['work-tab'] = el => { S.ui.workTab = el.dataset.v; commit(); window.scrollTo(0, 0); };
export const openWork = tab => { S.ui.workTab = tab; };
