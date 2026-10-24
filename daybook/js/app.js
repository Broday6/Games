// App shell: tab routing, header, render loop, live clocks, service worker.
import { $, $$, acts, bus, icon, refreshSheets, clock } from './util.js';
import { S, load, save } from './store.js';
import * as today from './today.js';
import * as work from './work.js';
import * as gym from './gym.js';
import * as life from './life.js';
import * as more from './more.js';

const TABS = [
  ['today', 'Today', today],
  ['work', 'Work', work],
  ['gym', 'Gym', gym],
  ['life', 'Life', life],
  ['more', 'More', more],
];
const MOD = Object.fromEntries(TABS.map(t => [t[0], t]));
const current = () => (MOD[location.hash.slice(1)] ? location.hash.slice(1) : 'today');

function render() {
  const tab = current();
  const [, label, mod] = MOD[tab];
  const main = $('#main');
  $('#page-title').textContent = tab === 'today' ? today.title() : label;
  $('#page-eyebrow').textContent = tab === 'today' ? 'Daybook' : today.title();
  const banner = S.sample ? `<div class="banner">Sample data. Nothing here is real. <button type="button" class="link" data-act="clear-sample">Clear and start fresh</button></div>`
    : more.backupDue() && tab === 'today' ? `<div class="banner">It has been a while since your last backup. <a class="link" href="#more">Back up now</a></div>` : '';
  main.innerHTML = banner + mod.view();
  $$('#nav [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  $('#nav [data-tab=gym]').classList.toggle('live', !!S.active);
  $('#nav [data-tab=work]').classList.toggle('live', !!S.timer);
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

function boot() {
  load();
  $('#nav').innerHTML = TABS.map(([id, label]) => `<a href="#${id}" data-tab="${id}">${icon(id)}<span>${label}</span></a>`).join('');
  lastTab = current();
  render();
  setInterval(tick, 500);
  // Re-render on return so "today", timers and overdue states are fresh after the phone sleeps.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); else save(); });
  window.addEventListener('pagehide', save);
  if ('serviceWorker' in navigator && /^https:|^http:\/\/localhost/.test(location.href)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }
}
acts.noop = () => {};
boot();
