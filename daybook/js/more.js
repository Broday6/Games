// More: settings, backup/restore, install help and storage status.
import { esc, acts, chg, icon, toast, today, download, copyText, confirmSheet, sheet, setCurrency, num } from './util.js';
import { S, commit, save, storage, exportJSON, importJSON, replaceState, fresh } from './store.js';

const f = (k, label, hint = '', attrs = '') => `<label class="field"><span class="lbl">${esc(label)}</span><input id="set-${k}" data-chg="setting" data-k="${k}" value="${esc(S.settings[k])}" ${attrs}>${hint ? `<small>${hint}</small>` : ''}</label>`;
const sel = (k, label, opts) => `<label class="field"><span class="lbl">${esc(label)}</span><select id="set-${k}" data-chg="setting" data-k="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(S.settings[k]) === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

chg.setting = el => {
  const k = el.dataset.k;
  S.settings[k] = el.value.trim();
  if (k === 'currency') setCurrency(S.settings.currency);
  if (k === 'units' && !el.dataset.quiet) {
    // Sensible bar and plate defaults when switching units.
    S.settings.bar = el.value === 'kg' ? '20' : '45';
    S.settings.plates = el.value === 'kg' ? '25, 20, 15, 10, 5, 2.5, 1.25' : '45, 35, 25, 10, 5, 2.5';
  }
  commit();
  toast('Saved', { ms: 1200 });
};

function installHelp() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return '<p class="muted small">Installed. Daybook opens full-screen from your home screen and works offline.</p>';
  return `<p class="muted small">${ios ? 'In Safari tap Share, then <b>Add to Home Screen</b>.' : 'In Chrome or Edge open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.'} It then opens full-screen and works offline.</p>
    ${deferredPrompt ? `<button type="button" class="btn" data-act="install">${icon('download')} Install Daybook</button>` : ''}`;
}
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
acts.install = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; commit(); };

export function view() {
  const counts = `${S.jobs.length} jobs · ${S.time.length} time entries · ${S.invoices.length} invoices · ${S.workouts.length} workouts · ${S.checkins.length} check-ins · ${S.goals.length} goals`;
  return `<section class="group"><header class="group-head"><h3>You and your business</h3></header><div class="panel pad form">
      <div class="grid2">${f('name', 'Your name')}${f('biz', 'Business name', 'Shown at the top of invoices.')}</div>
      ${f('bizAddr', 'Business address')}
      <div class="grid2">${f('bizPhone', 'Phone', '', 'type="tel"')}${f('bizEmail', 'Email', '', 'type="email"')}</div></div></section>
    <section class="group"><header class="group-head"><h3>Rates and money</h3></header><div class="panel pad form">
      <div class="grid2">${f('rate', 'Default hourly rate', '', 'inputmode="decimal"')}${sel('currency', 'Currency', [['USD', 'US dollar'], ['CAD', 'Canadian dollar'], ['GBP', 'British pound'], ['EUR', 'Euro'], ['AUD', 'Australian dollar'], ['NZD', 'NZ dollar']])}</div>
      <div class="grid2">${f('mileRate', 'Mileage rate per mile', 'Check the current IRS standard mileage rate each January.', 'inputmode="decimal"')}${f('markupPct', 'Materials markup %', 'Added to billable materials on invoices.', 'inputmode="decimal"')}</div>
      ${f('taxPct', 'Set aside for taxes, % of net', 'A rough reserve for income and self-employment tax. Your accountant can give you a better number.', 'inputmode="decimal"')}</div></section>
    <section class="group"><header class="group-head"><h3>Invoices</h3></header><div class="panel pad form">
      <div class="grid2">${f('nextInv', 'Next invoice number', '', 'inputmode="numeric"')}${f('terms', 'Payment terms (days)', 'Net 14 sets the due date 14 days out.', 'inputmode="numeric"')}</div>
      ${f('invNote', 'Default note')}${f('payNote', 'How to pay', 'e.g. Checks to Ortiz Carpentry LLC · Zelle 555-201-4417')}</div></section>
    <section class="group"><header class="group-head"><h3>Gym</h3></header><div class="panel pad form">
      <div class="grid2">${sel('units', 'Units', [['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']])}${f('bar', 'Barbell weight', '', 'inputmode="decimal"')}</div>
      ${f('plates', 'Plates you have (per pair)', 'Comma separated. Used by the plate calculator.')}
      <div class="grid2">${f('rest', 'Rest timer (seconds)', 'Big lifts use their own longer rest. 0 turns the timer off.', 'inputmode="numeric"')}${f('setTarget', 'Weekly hard sets per muscle', '10–20 is the usual range for growth.', 'inputmode="numeric"')}</div>
      ${f('age', 'Age (for heart-rate zones)', '', 'inputmode="numeric"')}</div></section>
    <section class="group"><header class="group-head"><h3>Check-ins</h3></header><div class="panel pad form">
      ${sel('checkins', 'Ask me how I am doing', [['on', 'Yes, show check-ins on Today'], ['off', 'No, only when I open them']])}
      <div class="grid3">${f('amTime', 'Morning', '', 'type="time"')}${f('pmTime', 'Evening', '', 'type="time"')}${sel('reviewDay', 'Weekly review', [['0', 'Sunday'], ['1', 'Monday'], ['5', 'Friday'], ['6', 'Saturday']])}</div>
      <p class="muted small">The app cannot buzz your phone on its own while closed. Add the reminders to your phone's calendar and it will ping you at these times with a link back here.</p>
      <div><button type="button" class="btn" data-act="checkin-reminders">${icon('cal')} Add reminders to my calendar</button></div></div></section>
    <section class="group"><header class="group-head"><h3>Install on your phone</h3></header><div class="panel pad">${installHelp()}</div></section>
    <section class="group"><header class="group-head"><h3>Your data</h3></header><div class="panel pad">
      <p class="muted small">${counts}. Stored only in this browser on this device${storage.ok ? '' : ' <b class="bad-text">(saving is blocked here: export a backup now)</b>'}. Export a backup regularly and before switching phones.</p>
      <div class="row-actions wrap"><button type="button" class="btn" data-act="backup">${icon('download')} Download backup</button><button type="button" class="btn ghost" data-act="backup-copy">${icon('copy')} Copy backup</button>
      <label class="btn ghost file-btn">${icon('upload')} Restore from file<input type="file" id="restore-file" accept=".json,application/json" data-chg="restore"></label>
      <button type="button" class="btn ghost" data-act="restore-paste">Paste a backup</button></div>
      ${S.sample ? `<p class="callout">You are looking at sample data. <button type="button" class="link" data-act="clear-sample">Clear it and start fresh</button></p>` : ''}
      <div class="row-actions"><button type="button" class="btn ghost danger-text" data-act="reset">${icon('trash')} Erase everything</button></div></div></section>
    <p class="muted small center">Daybook · works offline · no account, no tracking</p>`;
}

acts.backup = () => { download(`daybook-backup-${today()}.json`, exportJSON(), 'application/json'); S.ui.lastBackup = today(); save(); };
acts['backup-copy'] = () => copyText(exportJSON(), 'Backup copied. Paste it into a note or email to yourself.');
chg.restore = el => {
  const file = el.files?.[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = async () => {
    if (!(await confirmSheet('Restore this backup? It replaces everything currently in Daybook.', { ok: 'Restore' }))) return;
    try { importJSON(String(r.result)); toast('Backup restored'); } catch (e) { toast(e.message || 'Could not read that file.', { kind: 'bad' }); }
  };
  r.readAsText(file);
  el.value = '';
};
acts['restore-paste'] = () => {
  const s = sheet({
    title: 'Paste a backup',
    body: `<p class="muted small">Paste the text from Copy backup. This replaces everything currently in Daybook.</p><textarea id="paste-backup" rows="8" placeholder='{"app":"daybook",…}'></textarea>
      <div class="row-actions end"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" data-go>Restore</button></div>`,
  });
  s.el.querySelector('[data-go]').onclick = () => {
    try { importJSON(s.el.querySelector('textarea').value); s.close(); toast('Backup restored'); }
    catch (e) { toast(e instanceof SyntaxError ? 'That text is not a complete backup. Copy it again.' : e.message, { kind: 'bad' }); }
  };
};
acts.reset = async () => {
  if (!(await confirmSheet('Erase all jobs, hours, invoices, workouts and settings on this device? Download a backup first if you might want them.', { ok: 'Erase everything', danger: true }))) return;
  replaceState(fresh());
  commit();
  toast('Everything erased');
};
export const backupDue = () => S.welcomed && !S.sample && (S.jobs.length + S.workouts.length > 3) && (!S.ui.lastBackup || num(new Date(today()) - new Date(S.ui.lastBackup)) > 30 * 864e5);
