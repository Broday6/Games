// Bills: what you owe, when, how often, and whether it's on autopay. Paying one logs the payment and moves the
// bill to its next due date; autopay bills log themselves once their date passes.
import { esc, uid, num, sum, acts, icon, toast, sheet, formSheet, field, input, numInput, select, checkbox, textarea, today, addDays, daysBetween, relDay, fmtShort, fmtDate, money, empty, pill } from './util.js';
import { S, commit, undoable } from './store.js';
import { nextDue } from './tasks.js';

export const BILL_CATS = [['housing', 'Rent or mortgage'], ['utilities', 'Utilities'], ['phone', 'Phone and internet'], ['insurance', 'Insurance'], ['vehicle', 'Truck and car'], ['loan', 'Loans'], ['card', 'Credit cards'], ['subs', 'Subscriptions'], ['giving', 'Tithe and giving'], ['other', 'Other']];
const CAT = Object.fromEntries(BILL_CATS);
export const FREQ = [['monthly', 'Every month'], ['biweekly', 'Every 2 weeks'], ['weekly', 'Every week'], ['quarterly', 'Every 3 months'], ['yearly', 'Every year'], ['once', 'One time']];
const PER_MONTH = { monthly: 1, biweekly: 26 / 12, weekly: 52 / 12, quarterly: 1 / 3, yearly: 1 / 12, once: 0 };
const STARTERS = [['Rent or mortgage', 'housing'], ['Electric', 'utilities'], ['Water', 'utilities'], ['Phone', 'phone'], ['Internet', 'phone'], ['Truck payment', 'vehicle'], ['Truck insurance', 'insurance'], ['Health insurance', 'insurance'], ['Credit card', 'card'], ['Streaming', 'subs'], ['Gym membership', 'subs'], ['Tithe', 'giving']];

export const bills = () => S.bills || (S.bills = []);
const open = () => bills().filter(b => !b.done && !b.paused && b.due);
export const monthlyTotal = () => sum(bills().filter(b => !b.done && !b.paused), b => num(b.amount) * (PER_MONTH[b.repeat || 'monthly'] || 0));
export const dueSoon = () => open().filter(b => daysBetween(today(), b.due) <= (num(b.remind) || 3)).sort((a, b) => a.due.localeCompare(b.due));

export function pay(b, amount = b.amount, date = today(), auto = false) {
  b.history = [...(b.history || []), { date, amount: String(amount), auto }].slice(-36);
  b.lastPaid = date;
  if ((b.repeat || 'monthly') === 'once') { b.done = true; return; }
  b.anchor = b.anchor || b.due;
  b.due = nextDue(b.anchor, b.repeat || 'monthly');
}
// Autopay bills whose date has passed get logged as paid.
export function runAutopay() {
  let n = 0;
  for (const b of open()) if (b.autopay && b.due < today()) { pay(b, b.amount, b.due, true); n++; }
  return n;
}

const status = b => {
  const d = daysBetween(today(), b.due);
  if (d < 0) return [b.autopay ? `Autopay ran ${relDay(b.due).toLowerCase()}` : `${-d} day${d === -1 ? '' : 's'} overdue`, b.autopay ? 'muted' : 'bad'];
  if (d === 0) return ['Due today', 'warn'];
  if (d <= 3) return [`Due ${relDay(b.due).toLowerCase()}`, 'warn'];
  return [`Due ${fmtShort(b.due)}`, 'muted'];
};
export function billRow(b) {
  const [st, kind] = status(b);
  return `<div class="row bill">
    <div class="row-main" data-act="bill-edit" data-id="${b.id}" role="button" tabindex="0"><div class="row-title">${esc(b.name)}</div>
      <div class="row-sub"><span class="${kind === 'bad' ? 'bad-text' : kind === 'warn' ? 'warn-text' : ''}">${esc(st)}</span>${b.autopay ? ' · autopay' : ''} · ${esc((FREQ.find(f => f[0] === (b.repeat || 'monthly')) || [, ''])[1].toLowerCase())}</div></div>
    <span class="row-num">${money(num(b.amount))}</span>
    <button type="button" class="tick" data-act="bill-pay" data-id="${b.id}" aria-label="Mark ${esc(b.name)} paid">${icon('check')}</button>
  </div>`;
}

export function todayCard() {
  const due = dueSoon();
  if (!due.length) return '';
  return `<section class="group"><header class="group-head"><h3>Bills due</h3><span class="muted">${money(sum(due, b => num(b.amount)))}</span></header>
    <div class="list panel">${due.map(billRow).join('')}</div></section>`;
}

export function view() {
  const all = open().sort((a, b) => a.due.localeCompare(b.due));
  const t = today();
  const monthEnd = addDays(`${t.slice(0, 8)}01`, 40).slice(0, 8) + '01';
  const groups = [
    ['Overdue', all.filter(b => b.due < t && !b.autopay)],
    ['Next 7 days', all.filter(b => b.due >= t && b.due <= addDays(t, 7))],
    ['Later this month', all.filter(b => b.due > addDays(t, 7) && b.due < monthEnd)],
    ['Coming up', all.filter(b => b.due >= monthEnd && b.due > addDays(t, 7))],
  ].filter(g => g[1].length);
  const week = all.filter(b => b.due <= addDays(t, 7));
  const paidMonth = sum(bills().flatMap(b => (b.history || []).filter(h => h.date.startsWith(t.slice(0, 7)))), h => num(h.amount));
  const paused = bills().filter(b => b.paused && !b.done);
  if (!bills().length) {
    return `${empty('No bills yet', 'Add what you pay each month. Daybook reminds you a few days before each one is due and keeps a record when you pay.')}
      <section class="group"><header class="group-head"><h3>Quick start</h3></header><div class="chips">${STARTERS.map(([n, c]) => `<button type="button" class="chip" data-act="bill-new" data-name="${esc(n)}" data-cat="${c}">${icon('plus')} ${esc(n)}</button>`).join('')}</div></section>`;
  }
  return `<div class="stats three"><div><span>Next 7 days</span><strong>${money(sum(week, b => num(b.amount)))}</strong><small>${week.length} bill${week.length === 1 ? '' : 's'}</small></div>
      <div><span>Paid this month</span><strong>${money(paidMonth)}</strong></div><div><span>Monthly total</span><strong>${money(monthlyTotal())}</strong></div></div>
    ${groups.map(([l, list]) => `<section class="group"><header class="group-head"><h3>${l}</h3><span class="muted">${money(sum(list, b => num(b.amount)))}</span></header><div class="list panel">${list.map(billRow).join('')}</div></section>`).join('')}
    ${paused.length ? `<p class="muted small">Paused: ${paused.map(b => `<button type="button" class="link" data-act="bill-edit" data-id="${b.id}">${esc(b.name)}</button>`).join(', ')}</p>` : ''}
    <div class="row-actions"><button type="button" class="btn" data-act="bill-new">${icon('plus')} Bill</button></div>`;
}

acts['bill-new'] = el => billForm({ name: el.dataset.name || '', cat: el.dataset.cat || 'other' });
acts['bill-edit'] = el => billForm(bills().find(b => b.id === el.dataset.id));
acts['bill-pay'] = el => {
  const b = bills().find(x => x.id === el.dataset.id);
  if (!b) return;
  const s = sheet({
    title: `Pay ${b.name}`,
    body: `<div class="grid2">${field('Amount paid', numInput('payamt', b.amount))}${field('Paid on', input('paydate', today(), 'date'))}</div>
      <p class="muted small">${(b.repeat || 'monthly') === 'once' ? 'This one-time bill will be marked done.' : `Next due: ${esc(fmtDate(nextDue(b.anchor || b.due, b.repeat || 'monthly')))}.`}</p>
      <div class="row-actions"><button type="button" class="btn ghost sm" data-skip>Skip this one</button><span class="grow"></span><button type="button" class="btn primary" data-paid>${icon('check')} Paid</button></div>`,
  });
  s.el.querySelector('[data-paid]').onclick = () => {
    const before = JSON.stringify(b);
    pay(b, num(s.el.querySelector('#f-payamt').value) || b.amount, s.el.querySelector('#f-paydate').value || today());
    s.close(); commit();
    toast(`${b.name} paid${b.done ? '' : `. Next: ${fmtShort(b.due)}`}`, { action: { label: 'Undo', fn: () => { Object.assign(b, JSON.parse(before)); commit(); } } });
  };
  s.el.querySelector('[data-skip]').onclick = () => { b.anchor = b.anchor || b.due; b.due = nextDue(b.anchor, b.repeat || 'monthly'); s.close(); commit(); toast(`Skipped. Next: ${fmtShort(b.due)}`); };
};

function billForm(b = {}) {
  const isNew = !b.id;
  const hist = (b.history || []).slice(-6).reverse();
  formSheet({
    title: isNew ? 'New bill' : 'Edit bill',
    fields: `${field('Bill', input('name', b.name || '', 'text', 'required autofocus placeholder="e.g. Truck insurance"'))}
      <div class="grid2">${field('Amount', numInput('amount', b.amount || '', 'placeholder="0.00"'), 'For bills that vary, use a typical amount.')}${field('Next due', input('due', b.due || '', 'date', 'required'))}</div>
      <div class="grid2">${field('How often', select('repeat', FREQ, b.repeat || 'monthly'))}${field('Category', select('cat', BILL_CATS, b.cat || 'other'))}</div>
      <div class="grid2">${field('Remind me', select('remind', [['1', '1 day before'], ['3', '3 days before'], ['5', '5 days before'], ['7', 'A week before']], String(b.remind || 3)))}<div class="field"><span class="lbl">&nbsp;</span>${checkbox('autopay', 'On autopay', !!b.autopay)}</div></div>
      ${field('Notes', textarea('notes', b.notes || '', 'rows="2" placeholder="Account number, website, who to call"'))}
      ${isNew ? '' : `${checkbox('paused', 'Paused (cancelled or on hold)', !!b.paused)}
        ${hist.length ? `<h4 class="form-h">Paid</h4><div class="list">${hist.map(h => `<div class="row"><div class="row-main"><div class="row-title">${money(num(h.amount))}</div><div class="row-sub">${esc(fmtDate(h.date))}${h.auto ? ' · autopay' : ''}</div></div></div>`).join('')}</div>` : ''}`}`,
    del: isNew ? null : () => undoable(`${b.name} deleted`, () => { S.bills = bills().filter(x => x.id !== b.id); }),
    onSubmit: d => {
      if (!d.name.trim()) { toast('Name the bill.'); return false; }
      if (!d.due) { toast('Pick when it is next due.'); return false; }
      const data = { name: d.name.trim(), amount: String(num(d.amount)), due: d.due, repeat: d.repeat, cat: d.cat, remind: d.remind, autopay: d.autopay, notes: d.notes.trim() };
      if (!isNew) data.paused = d.paused;
      if (isNew || data.due !== b.due || data.repeat !== b.repeat) data.anchor = d.due; // the day of the month it lands on
      if (isNew) bills().push({ id: uid(), created: today(), history: [], ...data }); else Object.assign(b, data);
      commit();
      toast(isNew ? `${data.name} added` : 'Saved');
    },
  });
}
