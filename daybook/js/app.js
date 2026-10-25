// App shell: tab routing, header, render loop, live clocks, service worker.
import { $, $$, acts, bus, icon, refreshSheets, clock, uid, today as todayISO, addDays, parseDate, toast } from './util.js';
import { S, load, save, replaceState, fresh } from './store.js';
import { firstOn } from './tasks.js';
import * as today from './today.js';
import * as work from './work.js';
import * as gym from './gym.js';
import * as life from './life.js';
import * as more from './more.js';
import './checkin.js';
import { startSync, status as syncStatus } from './sync.js';
import { startAssistant, available as askAvailable } from './assistant.js';
import { applyTheme, watchMode } from './theme.js';

const TABS = [
  ['today', 'Today', today],
  ['work', 'Work', work],
  ['gym', 'Fitness', gym],
  ['life', 'Life', life],
  ['more', 'More', more],
];
const MOD = Object.fromEntries(TABS.map(t => [t[0], t]));
const current = () => (MOD[location.hash.slice(1)] ? location.hash.slice(1) : 'today');

function render() {
  applyTheme();
  const tab = current();
  const [, label, mod] = MOD[tab];
  const main = $('#main');
  $('#page-title').textContent = tab === 'today' ? today.title() : label;
  $('#page-eyebrow').textContent = tab === 'today' ? today.greeting() : today.title();
  const banner = S.sample ? `<div class="banner">Sample data. Nothing here is real. <button type="button" class="link" data-act="clear-sample">Clear and start fresh</button></div>`
    : more.backupDue() && tab === 'today' ? `<div class="banner">It has been a while since your last backup. <a class="link" href="#more">Back up now</a></div>` : '';
  main.innerHTML = banner + mod.view();
  $$('#nav [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  $('#nav [data-tab=gym]').classList.toggle('live', !!S.active);
  $('#nav [data-tab=work]').classList.toggle('live', !!S.timer);
  const ask = $('#ask-btn');
  if (ask) { ask.hidden = !askAvailable(); ask.innerHTML = `${icon('bolt')} Ask Claude`; }
  document.body.classList.toggle('synced', syncStatus.state === 'on');
  mod.after?.();
  gym.tickRest();
  tick();
  refreshSheets();
}
bus.render = render;

let lastTab = null;
window.addEventListener('hashchange', () => {
  const t = current();
  render();
  if (t !== lastTab) window.scrollTo(0, 0);
  lastTab = t;
});

function tick() {
  const now = Date.now();
  $$('[data-since]').forEach(el => { el.textContent = clock(now - +el.dataset.since); });
  gym.tickRest();
}

// A starter pack (window.DAYBOOK_PACK, set by the page that loads Daybook) adds a person's own routines and to-dos
// once per device. Sample data is cleared first; anything already entered is kept.
function applyPack(pack) {
  if (!pack?.id) return;
  let done = [];
  try { done = JSON.parse(localStorage.getItem('daybook.packs') || '[]'); } catch { /* storage blocked */ }
  if (done.includes(pack.id)) return;
  if (S.sample || !S.welcomed) { const ui = S.ui; replaceState(fresh()); S.ui = { ...ui, lastJob: '' }; }
  S.welcomed = true;
  const t = todayISO();
  const workday = () => { let d = t; while ([0, 6].includes(parseDate(d).getDay())) d = addDays(d, 1); return d; };
  const due = x => x.repeat === 'days' ? firstOn(x.repeatDays, t) : x.due === 'today' ? t : x.due === 'workday' ? workday() : x.due || '';
  for (const e of pack.events || []) S.events.push({ id: uid(), date: t, jobId: '', notes: '', done: false, doneDates: [], skip: [], until: '', ...e });
  for (const x of pack.tasks || []) S.tasks.push({ id: uid(), cat: 'personal', jobId: '', notes: '', focus: '', repeat: '', repeatDays: [], done: false, ...x, due: due(x) });
  save();
  try { localStorage.setItem('daybook.packs', JSON.stringify([...done, pack.id])); } catch { /* storage blocked */ }
  setTimeout(() => toast(`Added your ${(pack.events || []).length + (pack.tasks || []).length} items`), 300);
}

function boot() {
  load();
  applyTheme();
  watchMode();
  applyPack(window.DAYBOOK_PACK);
  $('#nav').innerHTML = TABS.map(([id, label]) => `<a href="#${id}" data-tab="${id}">${icon(id)}<span>${label}</span></a>`).join('');
  lastTab = current();
  render();
  setInterval(tick, 500);
  startSync();
  startAssistant();
  // Re-render on return so "today", timers and overdue states are fresh after the phone sleeps.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); else save(); });
  window.addEventListener('pagehide', save);
  if ('serviceWorker' in navigator && window.top === window && /^https:|^http:\/\/localhost/.test(location.href)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
}
acts.noop = () => {};
boot();
