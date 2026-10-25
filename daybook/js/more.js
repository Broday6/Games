// More: settings, backup/restore, install help and storage status.
import { esc, acts, chg, icon, toast, today, download, copyText, confirmSheet, sheet, setCurrency, num, hubView } from './util.js';
import { S, commit, save, storage, exportJSON, importJSON, replaceState, fresh } from './store.js';
import { status as sync } from './sync.js';
import { available as askAvailable } from './assistant.js';
import { DEFAULT_Q, customQ } from './checkin.js';
import { THEMES, theme, tokensCss, loadFonts, ACCENTS, DISPLAY_FONTS, BODY_FONTS, custom, isCustomized } from './theme.js';

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
  if (window.top !== window) return `<ol class="install-steps"><li>Open your Daybook link in ${ios ? '<b>Safari</b>' : '<b>Chrome</b>'} and sign in to Claude if asked.</li>
    <li>${ios ? 'Tap <b>Share</b> (the square with the arrow), then <b>Add to Home Screen</b>.' : 'Tap the <b>⋮</b> menu, then <b>Add to Home screen</b>.'}</li>
    <li>Name it <b>Daybook</b> and tap <b>Add</b>. It opens from your home screen, stays synced with your Claude account, and keeps Ask Claude.</li></ol>`;
  return `<p class="muted small">${ios ? 'In Safari tap Share, then <b>Add to Home Screen</b>.' : 'In Chrome or Edge open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.'} It then opens full-screen and works offline.</p>
    ${deferredPrompt ? `<button type="button" class="btn" data-act="install">${icon('download')} Install Daybook</button>` : ''}`;
}
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
acts.install = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; commit(); };

// The settings page is a list of sections; each opens on its own instead of one long scroll.
const MORE_META = {
  'Appearance': ['appearance', 'more', () => `${theme().name}${isCustomized() ? ', customized' : ''}`],
  'You and your business': ['profile', 'user', () => S.settings.name || S.settings.biz || 'Name, business, contact'],
  'Rates and money': ['money', 'receipt', () => `${S.settings.currency} · $${S.settings.rate}/h default`],
  'Invoices': ['invoices', 'mail', () => `Next number ${S.settings.nextInv}`],
  'Fitness': ['gym', 'gym', () => `${S.settings.units}, ${S.settings.rest}s rest`],
  'Check-ins': ['checkins', 'sun', () => (S.settings.checkins === 'off' ? 'Off' : `${S.settings.amTime} and ${S.settings.pmTime}`)],
  'To-dos and Today': ['today', 'life', () => 'Categories, Today layout'],
  'Install on your phone': ['install', 'download', () => 'Home screen icon'],
  'Your data': ['data', 'copy', () => 'Backup, restore, sync'],
};
function hubify(html) {
  const parts = html.split(/(?=<section class="group"><header class="group-head"><h3>)/);
  const tail = parts[parts.length - 1].split('<p class="muted small center">');
  parts[parts.length - 1] = tail[0];
  const secs = parts.filter(x => x.startsWith('<section')).map(x => {
    const title = x.match(/<h3>(.*?)<\/h3>/)[1];
    const [id, ic, sub] = MORE_META[title] || [title.toLowerCase().replace(/\W+/g, '-'), 'more', () => ''];
    return { id, title, icon: ic, sub: sub(), html: () => x.replace(/<header class="group-head"><h3>.*?<\/h3>/, '<header class="group-head">') };
  });
  return hubView({ cur: S.ui.moreTab, act: 'more-open', backLabel: 'More', sections: secs }) + (S.ui.moreTab ? '' : `<p class="muted small center">${tail[1] || ''}`);
}
acts['more-open'] = el => { S.ui.moreTab = el.dataset.v; commit(); window.scrollTo(0, 0); };

export function view() {
  const counts = `${S.jobs.length} jobs · ${S.time.length} time entries · ${S.invoices.length} invoices · ${S.workouts.length} workouts · ${S.checkins.length} check-ins · ${S.goals.length} goals`;
  const optSeg = (k, items, def) => `<div class="segs" role="radiogroup">${items.map(([v, l]) => `<button type="button" class="seg${(S.settings[k] || def) === v ? ' on' : ''}" data-act="appearance" data-k="${k}" data-v="${v}" role="radio" aria-checked="${(S.settings[k] || def) === v}">${esc(l)}</button>`).join('')}</div>`;
  const cur = theme();
  const cseg = (k, items) => `<div class="segs" role="radiogroup">${items.map(([v, l]) => `<button type="button" class="seg${(custom()[k] || '') === v ? ' on' : ''}" data-act="custom" data-k="${k}" data-v="${v}" role="radio" aria-checked="${(custom()[k] || '') === v}">${esc(l)}</button>`).join('')}</div>`;
  const appearance = `<section class="group"><header class="group-head"><h3>Appearance</h3><span class="muted">${esc(cur.name)}</span></header><div class="panel pad form">
      <div class="theme-grid">${THEMES.map(t => { loadFonts(t); const dark = t.single === 'dark' || document.documentElement.dataset.dark === '1'; return `<button type="button" class="theme-card${t.id === cur.id ? ' on' : ''}" data-act="appearance" data-k="skin" data-v="${t.id}" aria-pressed="${t.id === cur.id}">
        <div class="tc-preview" style="${esc(tokensCss(t, dark))}"><span class="tc-title" style="text-transform:${t.headings === 'upper' ? 'uppercase' : 'none'}">Monday</span>
          <span class="tc-row"><span>Workout</span><b>5:40am</b></span><span class="tc-row"><span>Bible study</span><b>7pm</b></span><span class="tc-btn">Check in</span></div>
        <span class="tc-name">${esc(t.name)}${t.id === cur.id ? icon('check') : ''}</span></button>`; }).join('')}</div>
      <p class="muted small">${esc(cur.blurb)}</p>
      <div class="editor"><h4 class="form-h">Make it yours${isCustomized() ? ` <button type="button" class="link small" data-act="custom-reset">Reset to ${esc(cur.name)}</button>` : ''}</h4>
        <div class="opt-row"><span class="lbl muted small">Accent color</span><div class="swatches">${ACCENTS.map(a => `<button type="button" class="swatch${custom().accent === a ? ' on' : ''}" style="--sw:${a}" data-act="custom" data-k="accent" data-v="${a}" aria-label="Accent color ${a}"></button>`).join('')}
          <label class="swatch pick${custom().accent && !ACCENTS.includes(custom().accent) ? ' on' : ''}" title="Any color" style="--sw:${esc(custom().accent || '#888888')}"><input type="color" id="accent-any" data-chg="custom" data-k="accent" value="${esc(custom().accent || '#1c58cf')}" aria-label="Pick any accent color">+</label></div></div>
        <div class="grid2"><label class="field"><span class="lbl">Heading font</span><select id="font-display" data-chg="custom" data-k="display"><option value="">${esc(cur.name)} default</option>${DISPLAY_FONTS.map(f => `<option${custom().display === f[0] ? ' selected' : ''}>${esc(f[0])}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">Body font</span><select id="font-body" data-chg="custom" data-k="body"><option value="">${esc(cur.name)} default</option>${BODY_FONTS.map(f => `<option${custom().body === f[0] ? ' selected' : ''}>${esc(f[0])}</option>`).join('')}</select></label></div>
        <div class="font-sample"><b>Monday, October 26</b><span>Follow up with Mark, then grout outside.</span></div>
        <div class="opt-row"><span class="lbl muted small">Corners</span>${cseg('corners', [['', 'Theme'], ['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round']])}</div>
        <div class="opt-row"><span class="lbl muted small">Cards</span>${cseg('cards', [['', 'Theme'], ['border', 'Outlined'], ['shadow', 'Raised'], ['flat', 'Flat'], ['bold', 'Bold']])}</div>
        <div class="opt-row"><span class="lbl muted small">Headings</span>${cseg('headings', [['', 'Theme'], ['upper', 'CAPITALS'], ['normal', 'Normal']])}</div></div>
      <div class="opt-row"><span class="lbl muted small">Light or dark${cur.single ? ' (this theme has one look)' : ''}</span>${optSeg('mode', [['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']], 'auto')}</div>
      <div class="opt-row"><span class="lbl muted small">Text size</span>${optSeg('text', [['auto', 'Theme'], ['small', 'Small'], ['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']], 'auto')}</div>
      <div class="grid2"><div class="opt-row"><span class="lbl muted small">Spacing</span>${optSeg('density', [['comfortable', 'Roomy'], ['compact', 'Compact']], 'comfortable')}</div>
      <div class="opt-row"><span class="lbl muted small">Tab bar</span>${optSeg('nav', [['auto', 'Theme'], ['bar', 'Edge'], ['float', 'Floating']], 'auto')}</div></div></div></section>`;
  return hubify(`${appearance}<section class="group"><header class="group-head"><h3>You and your business</h3></header><div class="panel pad form">
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
    <section class="group"><header class="group-head"><h3>Fitness</h3></header><div class="panel pad form">
      <div class="grid2">${sel('units', 'Units', [['lb', 'Pounds (lb)'], ['kg', 'Kilograms (kg)']])}${f('bar', 'Barbell weight', '', 'inputmode="decimal"')}</div>
      ${f('plates', 'Plates you have (per pair)', 'Comma separated. Used by the plate calculator.')}
      <div class="grid2">${f('rest', 'Rest timer (seconds)', 'Big lifts use their own longer rest. 0 turns the timer off.', 'inputmode="numeric"')}${f('setTarget', 'Weekly hard sets per muscle', '10–20 is the usual range for growth.', 'inputmode="numeric"')}</div>
      ${f('age', 'Age (for heart-rate zones)', '', 'inputmode="numeric"')}</div></section>
    <section class="group"><header class="group-head"><h3>Check-ins</h3></header><div class="panel pad form">
      ${sel('checkins', 'Ask me how I am doing', [['on', 'Yes, show check-ins on Today'], ['off', 'No, only when I open them']])}
      <div class="grid3">${f('amTime', 'Morning', '', 'type="time"')}${f('pmTime', 'Evening', '', 'type="time"')}${sel('reviewDay', 'Weekly review', [['0', 'Sunday'], ['1', 'Monday'], ['5', 'Friday'], ['6', 'Saturday']])}</div>
      <p class="muted small">The app cannot buzz your phone on its own while closed. Add the reminders to your phone's calendar and it will ping you at these times with a link back here.</p>
      <div><button type="button" class="btn" data-act="checkin-reminders">${icon('cal')} Add reminders to my calendar</button></div>
      <div class="field"><span class="lbl">What to ask</span><div class="chips">${[['sleep', 'Sleep'], ['energy', 'Energy'], ['mood', 'Mood'], ['stress', 'Stress']].map(([k, l]) => `<label class="chip-check"><input type="checkbox" data-scale="${k}"${String(S.settings.ciScales ?? '').split(',').includes(k) ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <div><button type="button" class="btn ghost" data-act="ci-questions">${icon('edit')} Write my own questions</button>
        <span class="muted small">${['morning', 'evening', 'weekly'].some(k => customQ(k).length) ? 'Using your questions' : 'Using Daybook\'s rotating questions'}</span></div></div></section>
    <section class="group"><header class="group-head"><h3>To-dos and Today</h3></header><div class="panel pad form">
      ${f('cats', 'To-do categories', 'Comma separated. Rename or add your own, like Church or Family. In quick add, type #home to file a to-do.')}
      <div><button type="button" class="btn ghost" data-act="today-layout">${icon('more')} Customize Today</button></div></div></section>
    <section class="group"><header class="group-head"><h3>Install on your phone</h3></header><div class="panel pad">${installHelp()}</div></section>
    <section class="group"><header class="group-head"><h3>Your data</h3>${sync.state === 'on' ? '<span class="pill good">Synced</span>' : ''}</header><div class="panel pad">
      <p class="muted small">${counts}. ${sync.state === 'on'
        ? `Saved to your Claude account, so it is the same on your phone and computer, and Claude can read and update it when you ask in a chat.${askAvailable() ? ' Use Ask Claude at the top to make changes by talking.' : ''}`
        : sync.state === 'connecting' ? 'Connecting to your Claude account…' : `Stored only in this browser on this device${storage.ok ? '' : ' <b class="bad-text">(saving is blocked here: export a backup now)</b>'}.`} Export a backup now and then.</p>
      <div class="row-actions wrap"><button type="button" class="btn" data-act="backup">${icon('download')} Download backup</button><button type="button" class="btn ghost" data-act="backup-copy">${icon('copy')} Copy backup</button>
      <label class="btn ghost file-btn">${icon('upload')} Restore from file<input type="file" id="restore-file" accept=".json,application/json" data-chg="restore"></label>
      <button type="button" class="btn ghost" data-act="restore-paste">Paste a backup</button></div>
      ${S.sample ? `<p class="callout">You are looking at sample data. <button type="button" class="link" data-act="clear-sample">Clear it and start fresh</button></p>` : ''}
      <div class="row-actions"><button type="button" class="btn ghost danger-text" data-act="reset">${icon('trash')} Erase everything</button></div></div></section>
    <p class="muted small center">Daybook · works offline · no account, no tracking</p>`);
}

document.addEventListener('change', e => {
  const k = e.target.dataset?.scale;
  if (!k) return;
  const on = [...document.querySelectorAll('[data-scale]')].filter(x => x.checked).map(x => x.dataset.scale);
  S.settings.ciScales = on.join(',');
  commit();
  toast('Saved', { ms: 1200 });
});
acts['ci-questions'] = () => {
  const box = (k, key, label) => `<label class="field"><span class="lbl">${label}</span><textarea id="ciq-${k}" rows="4" data-q-key="${key}" placeholder="${esc(DEFAULT_Q[k].slice(0, 3).join('\n'))}">${esc(S.settings[key] || '')}</textarea></label>`;
  const s = sheet({
    title: 'Check-in questions',
    body: `<p class="muted small">One question per line. Leave a box empty to use Daybook's rotating questions for that check-in. Good questions are short and about something you can act on.</p>
      <div class="form">${box('morning', 'ciMorningQ', 'Morning')}${box('evening', 'ciEveningQ', 'Evening')}${box('weekly', 'ciWeeklyQ', 'Weekly review')}</div>
      <div class="row-actions end"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" data-save>Save</button></div>`,
  });
  s.el.querySelector('[data-save]').onclick = () => {
    s.el.querySelectorAll('[data-q-key]').forEach(t => { S.settings[t.dataset.qKey] = t.value.split('\n').map(x => x.trim()).filter(Boolean).join('\n'); });
    s.close(); commit(); toast('Questions saved');
  };
};
acts.custom = el => { S.settings.custom = { ...custom(), [el.dataset.k]: el.dataset.v }; commit(); };
chg.custom = el => { S.settings.custom = { ...custom(), [el.dataset.k]: el.value }; commit(); };
acts['custom-reset'] = () => { S.settings.custom = {}; commit(); toast('Back to the original theme'); };
acts.appearance = el => {
  S.settings[el.dataset.k] = el.dataset.v;
  commit();
  if (el.dataset.k === 'skin') toast(`${theme().name} theme`, { ms: 1400 });
};
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
