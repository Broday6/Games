// People: the folks you keep up with (clients, crew, suppliers, family, church) and how often to follow up.
// Logging a call or text sets the next follow-up from the person's rhythm: every N days, or on set weekdays.
import { $$, esc, uid, num, acts, icon, toast, sheet, formSheet, field, input, select, textarea, today, addDays, parseDate, relDay, fmtShort, daysBetween, daysLabel, dayPicker, empty, pill } from './util.js';
import { S, commit, undoable } from './store.js';
import { cats, catLabel } from './tasks.js';

export const KINDS = [['call', 'Called'], ['text', 'Texted'], ['meet', 'Met'], ['email', 'Emailed']];
const KIND = Object.fromEntries(KINDS);
const EVERY = [['', 'No reminders'], ['2', 'Every 2 days'], ['3', 'Every 3 days'], ['4', 'Every 4 days'], ['7', 'Every week'], ['14', 'Every 2 weeks'], ['30', 'Every month'], ['90', 'Every 3 months'], ['days', 'On certain weekdays']];

const list = () => S.people || (S.people = []);
export const rhythm = p => (p.days?.length ? `every ${daysLabel(p.days)}` : num(p.every) ? (EVERY.find(e => e[0] === String(p.every))?.[1] || `every ${p.every} days`).toLowerCase() : 'no reminders');
export function nextFrom(p, from = today()) {
  if (p.days?.length) { let d = addDays(from, 1); while (!p.days.includes(parseDate(d).getDay())) d = addDays(d, 1); return d; }
  return num(p.every) ? addDays(from, num(p.every)) : '';
}
export const isDue = p => !!p.next && p.next <= today();
export const dueToday = () => list().filter(isDue).sort((a, b) => a.next.localeCompare(b.next));
const lastLog = p => p.log?.[p.log.length - 1];
const status = p => {
  if (!p.next) return ['No follow-up set', 'muted'];
  const d = daysBetween(today(), p.next);
  if (d < 0) return [`${-d} day${d === -1 ? '' : 's'} overdue`, 'bad'];
  if (d === 0) return ['Due today', 'warn'];
  return [`Next ${relDay(p.next).toLowerCase()}`, 'muted'];
};

export function logContact(p, kind, note = '') {
  p.log = [...(p.log || []), { date: today(), kind, note }].slice(-60);
  p.last = today();
  p.next = nextFrom(p);
}

export function personRow(p, { quick = false } = {}) {
  const [st, kind] = status(p);
  const l = lastLog(p);
  return `<div class="row person">
    <span class="avatar" aria-hidden="true">${esc((p.name || '?').trim()[0]?.toUpperCase() || '?')}</span>
    <div class="row-main" data-act="person-open" data-id="${p.id}" role="button" tabindex="0"><div class="row-title">${esc(p.name)}</div>
      <div class="row-sub"><span class="${kind === 'bad' ? 'bad-text' : kind === 'warn' ? 'warn-text' : ''}">${esc(st)}</span>${l ? ` · ${esc(KIND[l.kind] || 'Contacted')} ${esc(relDay(l.date).toLowerCase())}` : ''}${quick ? '' : ` · ${esc(rhythm(p))}`}</div></div>
    ${p.phone ? `<a class="icon-btn sm" href="tel:${esc(p.phone.replace(/[^0-9+]/g, ''))}" aria-label="Call ${esc(p.name)}">${icon('phone')}</a>` : ''}
    <button type="button" class="tick" data-act="person-log" data-id="${p.id}" aria-label="Log a follow-up with ${esc(p.name)}">${icon('check')}</button>
  </div>`;
}

export function followupsCard() {
  const due = dueToday();
  if (!due.length) return '';
  return `<section class="group"><header class="group-head"><h3>Follow-ups</h3><button type="button" class="btn ghost sm" data-act="go-life" data-v="people">All</button></header>
    <div class="list panel">${due.map(p => personRow(p, { quick: true })).join('')}</div></section>`;
}

export function view() {
  const all = [...list()].sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999') || a.name.localeCompare(b.name));
  const due = all.filter(isDue), later = all.filter(p => !isDue(p));
  return `<p class="muted small">The people you keep up with. Tap ✓ after a call or text and Daybook schedules the next follow-up.</p>
    ${due.length ? `<section class="group"><header class="group-head"><h3>Due</h3><span class="muted">${due.length}</span></header><div class="list panel">${due.map(p => personRow(p)).join('')}</div></section>` : ''}
    ${later.length ? `<section class="group"><header class="group-head"><h3>${due.length ? 'Coming up' : 'Everyone'}</h3></header><div class="list panel">${later.map(p => personRow(p)).join('')}</div></section>` : ''}
    ${all.length ? '' : empty('No one here yet', 'Add a client, a crew member or a friend and how often you want to touch base.')}
    <div class="row-actions"><button type="button" class="btn" data-act="person-new">${icon('plus')} Person</button></div>`;
}

acts['person-new'] = () => personForm();
acts['person-edit'] = el => personForm(list().find(p => p.id === el.dataset.id));
acts['person-log'] = el => {
  const p = list().find(x => x.id === el.dataset.id);
  if (!p) return;
  const s = sheet({
    title: `Followed up with ${p.name}`,
    body: `<div class="log-kinds">${KINDS.map(([k, l]) => `<button type="button" class="btn" data-kind="${k}">${l}</button>`).join('')}</div>
      ${field('Note (optional)', input('lognote', '', 'text', 'placeholder="What you talked about, what comes next"'))}
      <p class="muted small">${p.every || p.days?.length ? `Next follow-up: ${esc(relDay(nextFrom(p)))} (${esc(rhythm(p))}).` : 'No follow-up rhythm set for this person.'}</p>
      <div class="row-actions wrap"><span class="muted small">Or push it back:</span>${[['Tomorrow', 1], ['3 days', 3], ['Next week', 7]].map(([l, n]) => `<button type="button" class="btn ghost sm" data-snooze="${n}">${l}</button>`).join('')}</div>`,
  });
  s.el.addEventListener('click', e => {
    const k = e.target.closest('[data-kind]');
    const z = e.target.closest('[data-snooze]');
    if (k) {
      const before = JSON.stringify(p);
      logContact(p, k.dataset.kind, s.el.querySelector('#f-lognote').value.trim());
      s.close(); commit();
      toast(`${KIND[k.dataset.kind]} ${p.name}${p.next ? `. Next: ${relDay(p.next).replace(/^(Today|Tomorrow)/, m => m.toLowerCase())}` : ''}`, { action: { label: 'Undo', fn: () => { Object.assign(p, JSON.parse(before)); commit(); } } });
    }
    if (z) { p.next = addDays(today(), +z.dataset.snooze); s.close(); commit(); toast(`${p.name}: ${relDay(p.next)}`); }
  });
};
acts['person-open'] = el => {
  const id = el.dataset.id;
  sheet({
    title: 'Person',
    render: () => {
      const p = list().find(x => x.id === id);
      if (!p) return null;
      const [st, kind] = status(p);
      return `<div class="detail-head"><h3>${esc(p.name)}</h3><div class="inline">${pill(st, kind === 'muted' ? 'muted' : kind)}<span class="muted">${esc(catLabel(p.tag))} · ${esc(rhythm(p))}</span></div>
          <div class="row-links">${p.phone ? `<a class="contact" href="tel:${esc(p.phone.replace(/[^0-9+]/g, ''))}">${icon('phone')}${esc(p.phone)}</a><a class="contact" href="sms:${esc(p.phone.replace(/[^0-9+]/g, ''))}">${icon('mail')}Text</a>` : ''}${p.email ? `<a class="contact" href="mailto:${esc(p.email)}">${icon('mail')}${esc(p.email)}</a>` : ''}</div>
          ${p.notes ? `<p class="note">${esc(p.notes)}</p>` : ''}</div>
        <div class="row-actions wrap"><button type="button" class="btn primary" data-act="person-log" data-id="${id}">${icon('check')} Log a follow-up</button><button type="button" class="btn ghost" data-act="person-edit" data-id="${id}">${icon('edit')} Edit</button></div>
        <h4 class="sub-h">History</h4>
        ${p.log?.length ? `<div class="list">${[...p.log].reverse().map(l => `<div class="row"><div class="row-main"><div class="row-title">${esc(KIND[l.kind] || 'Contacted')}</div><div class="row-sub">${esc(fmtShort(l.date))}${l.note ? ' · ' + esc(l.note) : ''}</div></div></div>`).join('')}</div>` : '<p class="muted small">No follow-ups logged yet.</p>'}`;
    },
  });
};

function personForm(p = {}) {
  const isNew = !p.id;
  formSheet({
    title: isNew ? 'New person' : 'Edit person',
    fields: `${field('Name', input('name', p.name || '', 'text', 'required autofocus'))}
      <div class="grid2">${field('Phone', input('phone', p.phone || '', 'tel'))}${field('Email', input('email', p.email || '', 'email'))}</div>
      <div class="grid2">${field('Group', select('tag', cats(), p.tag || 'work'))}${field('Follow up', select('every', EVERY, p.days?.length ? 'days' : String(p.every || '')))}</div>
      <div data-days hidden class="field"><span class="lbl">On</span>${dayPicker('pday', p.days || [])}</div>
      ${field('Next follow-up', input('next', p.next || '', 'date'), 'Leave blank to start from today.')}
      ${field('Notes', textarea('notes', p.notes || '', 'rows="2" placeholder="Role, what you are working on together, kids’ names"'))}`,
    del: isNew ? null : () => undoable(`${p.name} removed`, () => { S.people = list().filter(x => x.id !== p.id); }),
    onMount: el => { const ev = el.querySelector('[name=every]'); const sync = () => { el.querySelector('[data-days]').hidden = ev.value !== 'days'; }; ev.addEventListener('change', sync); sync(); },
    onSubmit: (d, form) => {
      if (!d.name.trim()) { toast('Add a name.'); return false; }
      const days = d.every === 'days' ? $$('input[name=pday]:checked', form).map(c => +c.value) : [];
      if (d.every === 'days' && !days.length) { toast('Pick the days.'); return false; }
      const data = { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), tag: d.tag, every: d.every === 'days' ? '' : d.every, days, notes: d.notes.trim() };
      if (isNew) { const np = { id: uid(), created: today(), log: [], last: '', ...data }; np.next = d.next || (data.every || days.length ? (days.length && !days.includes(parseDate(today()).getDay()) ? nextFrom(np, today()) : today()) : ''); list().push(np); }
      else Object.assign(p, data, { next: d.next || p.next || (data.every || days.length ? nextFrom({ ...p, ...data }, p.last || today()) : '') });
      commit();
      toast(isNew ? `${data.name} added` : 'Saved');
    },
  });
}
