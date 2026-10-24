// Shared helpers: DOM, dates, money, icons, toasts, sheets (modals) and forms.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
export const round2 = n => Math.round(n * 100) / 100;
export const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (f(x) || 0), 0);

// Late-bound hooks so modules can ask the shell to re-render without importing it.
export const bus = { render: () => {} };

// ---------- actions (event delegation) ----------
export const acts = {};
export const chg = {};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  // Real links (phone, map, email) inside a tappable row keep their own behaviour.
  const a = e.target.closest('a[href]');
  if (a && a !== t && t.contains(a)) return;
  const fn = acts[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t, e); }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-chg]');
  if (!t) return;
  const fn = chg[t.dataset.chg];
  if (fn) fn(t, e);
});

// ---------- dates ----------
export const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const parseDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return iso(d); };
export const weekStart = s => { const d = parseDate(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);
export const monthKey = s => String(s).slice(0, 7);
export const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export const addMonthsISO = (s, n) => {
  const d = parseDate(s); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return iso(d);
};
export const avg = arr => { const v = arr.filter(x => Number.isFinite(x) && x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const daysLabel = days => {
  const s = WEEK_ORDER.filter(d => (days || []).includes(d));
  if (s.length === 7) return 'every day';
  if (s.join() === '1,2,3,4,5') return 'weekdays';
  if (s.join() === '6,0') return 'weekends';
  return s.map(d => DOW[d]).join(', ');
};
export const dayPicker = (name, on = []) => `<div class="day-pick" role="group">${WEEK_ORDER.map(d => `<label class="chip-check"><input type="checkbox" name="${name}" value="${d}"${on.includes(d) ? ' checked' : ''}><span>${DOW[d]}</span></label>`).join('')}</div>`;
export const fmtMonth = key => parseDate(key + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const fmtDate = (s, o = { weekday: 'short', month: 'short', day: 'numeric' }) => s ? parseDate(s).toLocaleDateString(undefined, o) : '';
export const fmtShort = s => fmtDate(s, { month: 'short', day: 'numeric' });
export const fmtTime = hm => {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return `${(h % 12) || 12}${m ? ':' + pad(m) : ''}${h >= 12 ? 'pm' : 'am'}`;
};
export const hmOf = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const tsOf = (date, hm) => { const d = parseDate(date); const [h, m] = (hm || '0:0').split(':').map(Number); d.setHours(h || 0, m || 0, 0, 0); return d.getTime(); };
export const fmtDur = ms => { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h}h ${pad(m % 60)}m` : `${m}m`; };
export const clock = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
};
export const hours = ms => ms / 36e5;
export const fmtHrs = h => `${(Math.round(h * 10) / 10).toLocaleString()} h`;
export const relDay = s => {
  const d = daysBetween(today(), s);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d < 0 && d > -7) return `${-d} days ago`;
  if (d > 0 && d < 7) return fmtDate(s, { weekday: 'long' });
  return fmtShort(s);
};

// ---------- money ----------
let moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
export const setCurrency = c => { try { moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: c || 'USD' }); } catch { /* keep previous */ } };
export const money = n => moneyFmt.format(round2(n || 0));

// ---------- icons (24px stroke icons) ----------
const P = {
  today: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  work: 'M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 8V5h6v3M3 13h18',
  gym: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  life: 'M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9',
  more: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  play: 'M8 5.5l11 6.5-11 6.5z',
  stop: 'M7 7h10v10H7z',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  phone: 'M5.5 4h3.5l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v3.5a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 4 5.5 1.5 1.5 0 0 1 5.5 4z',
  pin: 'M12 21s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21zM12 7.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z',
  mail: 'M3.5 6h17v12h-17zM3.5 6.5l8.5 6.5 8.5-6.5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  print: 'M7 9V3.5h10V9M7 17H4v-7.5h16V17h-3M7 14h10v6.5H7z',
  download: 'M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 20h15',
  upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M4.5 20h15',
  cal: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  bt: 'M7 7.5l10 9-5 4.5v-18l5 4.5-10 9',
  receipt: 'M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5zM9 8h6M9 12h6M9 16h3',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
  scale: 'M5 20h14l-1.5-12h-11zM9.5 8a2.5 2.5 0 0 1 5 0M12 11.5l1.5 3',
  repeat: 'M17 2.5l3 3-3 3M4 11.5v-1a5 5 0 0 1 5-5h11M7 21.5l-3-3 3-3M20 12.5v1a5 5 0 0 1-5 5H4',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  flag: 'M5.5 21V4M5.5 4.5h11.5l-2.2 4.2 2.2 4.3H5.5',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z',
};
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || ''}"/></svg>`;

// ---------- toasts ----------
let toastHost;
export function toast(msg, { action, ms = 3800, kind = '' } = {}) {
  toastHost = toastHost || $('#toasts');
  if (!toastHost) return;
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
  if (action) t.querySelector('button').onclick = () => { action.fn(); kill(); };
  toastHost.appendChild(t);
  while (toastHost.children.length > 3) toastHost.firstChild.remove();
  setTimeout(kill, action ? Math.max(ms, 6000) : ms);
}

// ---------- sheets (modal panels) ----------
const sheets = [];
export function sheet({ title, body = '', render, onMount, onClose, cls = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
    <div class="sheet-body">${render ? render() : body}</div></div>`;
  const s = { wrap, el: wrap.querySelector('.sheet-body'), render, onMount, onClose, close: () => closeSheet(s) };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) s.close(); });
  document.body.appendChild(wrap);
  document.body.classList.add('has-sheet');
  sheets.push(s);
  requestAnimationFrame(() => wrap.classList.add('in'));
  onMount?.(s.el, s);
  const first = s.el.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 60);
  return s;
}
export function closeSheet(s) {
  const i = sheets.indexOf(s);
  if (i < 0) return;
  sheets.splice(i, 1);
  s.wrap.classList.remove('in');
  setTimeout(() => s.wrap.remove(), 200);
  if (!sheets.length) document.body.classList.remove('has-sheet');
  s.onClose?.();
}
export const closeAllSheets = () => [...sheets].forEach(closeSheet);
// Re-render sheets that show live data (detail views); forms have no render fn so typing is never lost.
export function refreshSheets() {
  for (const s of sheets) {
    if (!s.render) continue;
    const html = s.render();
    if (html === null) { closeSheet(s); continue; }
    const top = s.el.scrollTop;
    s.el.innerHTML = html;
    s.onMount?.(s.el, s);
    s.el.scrollTop = top;
  }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close(); });

export function confirmSheet(message, { ok = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const s = sheet({
      title: 'Are you sure?',
      body: `<p class="lede">${esc(message)}</p><div class="row-actions end"><button type="button" class="btn ghost" data-no>Cancel</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div>`,
      onClose: () => { if (!done) resolve(false); },
    });
    s.el.querySelector('[data-no]').onclick = () => s.close();
    s.el.querySelector('[data-yes]').onclick = () => { done = true; resolve(true); s.close(); };
  });
}

// ---------- forms ----------
export const field = (label, control, hint = '', cls = '') => `<label class="field ${cls}"><span class="lbl">${esc(label)}</span>${control}${hint ? `<small>${hint}</small>` : ''}</label>`;
export const input = (name, val = '', type = 'text', attrs = '') => `<input id="f-${name}" name="${name}" type="${type}" value="${esc(val)}" ${attrs}>`;
export const numInput = (name, val = '', attrs = '') => `<input id="f-${name}" name="${name}" type="text" inputmode="decimal" value="${esc(val)}" ${attrs}>`;
export const textarea = (name, val = '', attrs = '') => `<textarea id="f-${name}" name="${name}" rows="3" ${attrs}>${esc(val)}</textarea>`;
export const select = (name, opts, val, attrs = '') => `<select id="f-${name}" name="${name}" ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
export const checkbox = (name, label, on) => `<label class="check-field"><input id="f-${name}" name="${name}" type="checkbox"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;

export function formSheet({ title, fields, submit = 'Save', onSubmit, del, onMount }) {
  const s = sheet({
    title,
    body: `<form class="form" novalidate>${fields}<div class="row-actions">${del ? `<button type="button" class="btn ghost danger-text" data-del>${icon('trash')} Delete</button>` : ''}<span class="grow"></span><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn primary">${esc(submit)}</button></div></form>`,
    onMount: (el, s) => {
      const form = el.querySelector('form');
      form.addEventListener('submit', e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        $$('input[type=checkbox]', form).forEach(c => { data[c.name] = c.checked; });
        if (onSubmit(data, form) !== false) s.close();
      });
      if (del) el.querySelector('[data-del]').onclick = () => { s.close(); del(); };
      onMount?.(el, s);
    },
  });
  return s;
}

// ---------- files ----------
export function download(name, text, type = 'text/plain') {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch { toast('This browser blocked the download. Use Copy instead.'); }
}
export async function copyText(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(label); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    toast(ok ? label : 'Copy is blocked here. Select the text and copy it by hand.');
    return ok;
  }
}
export const csv = rows => rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');

// Contact links. They are conveniences; the address/number is always shown as text too.
export const telLink = p => p ? `<a class="contact" href="tel:${esc(p.replace(/[^0-9+]/g, ''))}">${icon('phone')}${esc(p)}</a>` : '';
export const mailLink = m => m ? `<a class="contact" href="mailto:${esc(m)}">${icon('mail')}${esc(m)}</a>` : '';
export const mapLink = a => a ? `<a class="contact" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}" target="_blank" rel="noopener">${icon('pin')}${esc(a)}</a>` : '';

export const empty = (title, text = '', action = '') => `<div class="empty"><strong>${esc(title)}</strong>${text ? `<p>${text}</p>` : ''}${action}</div>`;
export const pill = (label, kind = '') => `<span class="pill ${kind}">${esc(label)}</span>`;
export const segs = (act, items, cur) => `<div class="segs" role="tablist">${items.map(([v, l]) => `<button type="button" role="tab" class="seg${v === cur ? ' on' : ''}" aria-selected="${v === cur}" data-act="${act}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
