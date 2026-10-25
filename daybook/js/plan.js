// The day as a timeline (time blocking): schedule items and timed to-dos placed by the clock, free gaps shown
// as open slots, and "Plan my day", which fits focus and due to-dos into the free time around fixed commitments.
import { esc, num, acts, icon, toast, today, fmtTime, pad, fmtDur } from './util.js';
import { S, commit, replaceState } from './store.js';
import { eventsOn } from './work.js';
import { isFocus } from './tasks.js';

export const toMin = hm => { const [h, m] = String(hm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const toHM = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const window_ = () => [toMin(S.settings.dayStart || '05:00'), toMin(S.settings.dayEnd || '22:00')];

export function blocks(date) {
  const out = [];
  for (const e of eventsOn(date)) {
    if (!e.start) continue;
    const s = toMin(e.start);
    let en = e.end ? toMin(e.end) : s + 60;
    if (en <= s) en = s + 60;
    out.push({ kind: 'event', id: e.id, title: e.title || 'Visit', s, e: en, done: !!e.done, gym: !!e.gym });
  }
  for (const t of S.tasks) {
    if (t.due !== date || !t.time) continue;
    const s = toMin(t.time);
    out.push({ kind: 'task', id: t.id, title: t.title, s, e: s + (num(t.mins) || 30), done: !!t.done, planned: t.planned === date });
  }
  out.sort((a, b) => a.s - b.s || b.e - a.e);
  // Side-by-side lanes for anything that overlaps.
  let cluster = [], end = -1;
  const close = () => { const n = Math.max(...cluster.map(x => x.lane)) + 1; cluster.forEach(x => { x.lanes = n; }); cluster = []; };
  for (const b of out) {
    if (b.s >= end && cluster.length) close();
    const used = new Set(cluster.filter(x => x.e > b.s).map(x => x.lane));
    let lane = 0; while (used.has(lane)) lane++;
    b.lane = lane; cluster.push(b); end = Math.max(end, b.e);
  }
  if (cluster.length) close();
  return out;
}

const PPM = 1.05; // pixels per minute
export function timeline(date = today()) {
  const bl = blocks(date);
  let [a, b] = window_();
  if (bl.length) { a = Math.min(a, Math.floor(Math.min(...bl.map(x => x.s)) / 60) * 60); b = Math.max(b, Math.ceil(Math.max(...bl.map(x => x.e)) / 60) * 60); }
  // Long empty stretches are squeezed so the whole day fits on about one screen: the first and last
  // 45 minutes of a long gap keep full scale, the middle runs at a quarter.
  const occ = bl.map(x => [x.s, x.e]).concat(date === today() ? [[nowMin() - 20, nowMin() + 20]] : []).sort((p, q) => p[0] - q[0]);
  const segs = [];
  let at = a;
  const free = (f0, f1) => { if (f1 - f0 > 150) segs.push([f0, f0 + 45, PPM], [f0 + 45, f1 - 45, PPM / 4], [f1 - 45, f1, PPM]); else if (f1 > f0) segs.push([f0, f1, PPM]); };
  for (const [s0, e0] of occ) { const s1 = Math.max(a, s0), e1 = Math.min(b, e0); if (s1 > at) free(at, s1); if (e1 > at) { segs.push([Math.max(at, s1), e1, PPM]); at = e1; } }
  if (b > at) free(at, b);
  const y = m => Math.round(segs.reduce((sum, [f, t, k]) => sum + Math.max(0, Math.min(m, t) - f) * k, 0));
  const hours = [];
  let lastY = -99;
  for (let h = Math.ceil(a / 60) * 60; h <= b; h += 60) { if (y(h) - lastY >= 20) { hours.push(h); lastY = y(h); } }
  // Free gaps (from now on, today) big enough to use.
  const from = date === today() ? Math.max(a, Math.ceil(nowMin() / 15) * 15) : a;
  const busy = bl.map(x => [x.s, x.e]).sort((p, q) => p[0] - q[0]); // done items still occupy their slot
  const gaps = [];
  let cur = from;
  for (const [s, e] of busy) { if (s - cur >= 30) gaps.push([cur, s]); cur = Math.max(cur, e); }
  if (b - cur >= 30) gaps.push([cur, b]);
  const n = date === today() ? nowMin() : -1;
  const lbl = x => `${fmtTime(toHM(x.s))}–${fmtTime(toHM(x.e))}`;
  return `<div class="timeline" style="height:${y(b) + 8}px">
    ${hours.map(h => `<div class="tl-hour" style="top:${y(h)}px"><span>${fmtTime(toHM(h)).replace(':00', '')}</span></div>`).join('')}
    ${gaps.map(([s, e]) => `<button type="button" class="tl-gap" style="top:${y(s) + 2}px;height:${Math.max(24, y(e) - y(s) - 4)}px" data-act="slot-add" data-time="${toHM(s)}" aria-label="Free ${fmtDur((e - s) * 60000)} from ${fmtTime(toHM(s))}: add a to-do"><span>Free · ${fmtDur((e - s) * 60000)}</span>${icon('plus')}</button>`).join('')}
    ${bl.map(x => `<div class="tl-block ${x.kind}${x.gym ? ' gym' : ''}${x.done ? ' done' : ''}${x.planned ? ' planned' : ''}" style="top:${y(x.s) + 1}px;height:${Math.max(26, y(x.e) - y(x.s) - 2)}px;--lane:${x.lane};--lanes:${x.lanes}"
        data-act="${x.kind === 'event' ? 'ev-edit' : 'task-edit'}" data-id="${x.id}" data-date="${date}" role="button" tabindex="0">
        ${x.kind === 'task' ? `<button type="button" class="tl-tick${x.done ? ' on' : ''}" data-act="task-done" data-id="${x.id}" aria-label="${x.done ? 'Mark not done' : 'Mark done'}">${icon('check')}</button>` : ''}
        <span class="tl-text"><strong>${esc(x.title)}</strong><small>${lbl(x)}</small></span>
        ${x.gym && !x.done && date === today() ? (S.active?.date === today() ? '<a class="btn sm primary" href="#gym">Resume</a>' : `<button type="button" class="btn sm primary" data-act="wo-next">${icon('play')}</button>`) : ''}
      </div>`).join('')}
    ${n >= a && n <= b ? `<div class="tl-now" style="top:${y(n)}px"><span>${fmtTime(toHM(n))}</span></div>` : ''}
  </div>`;
}

// To-dos that want a slot today: focus items first, then overdue, then due today.
const wanting = () => S.tasks.filter(x => !x.done && !x.time && (isFocus(x) || (x.due && x.due <= today())))
  .sort((p, q) => (isFocus(q) - isFocus(p)) || (p.due || '').localeCompare(q.due || ''));
export const unplannedCount = () => wanting().length;

export function planDay() {
  const t = today();
  const [a, b] = window_();
  let cur = Math.max(a, Math.ceil((nowMin() + 5) / 15) * 15);
  // Leave a little air after appointments (travel, cleanup) and between to-dos.
  const busy = blocks(t).filter(x => !x.done).map(x => [x.s, x.e + (x.kind === 'event' ? 15 : 5)]);
  const placed = [], left = [];
  for (const x of wanting()) {
    const m = num(x.mins) || 30;
    let s = cur, hit;
    while ((hit = busy.find(([p, q]) => s < q && s + m > p))) s = Math.ceil(hit[1] / 5) * 5;
    if (s + m > b) { left.push(x); continue; }
    Object.assign(x, { time: toHM(s), due: t, planned: t });
    busy.push([s, s + m + 5]);
    placed.push(x);
  }
  return { placed, left };
}
acts['plan-day'] = () => {
  const snap = JSON.stringify(S);
  const { placed, left } = planDay();
  S.settings.schedView = 'timeline';
  commit();
  if (!placed.length) return toast(left.length ? 'No free time left today for those to-dos.' : 'Nothing to plan. Star focus items or give to-dos a due date of today.');
  toast(`Planned ${placed.length} to-do${placed.length > 1 ? 's' : ''} into your free time${left.length ? `. ${left.length} didn't fit` : ''}`, { action: { label: 'Undo', fn: () => { replaceState(JSON.parse(snap)); commit(); } } });
};
acts['plan-clear'] = () => {
  const n = S.tasks.filter(x => x.planned === today() && !x.done);
  n.forEach(x => { x.time = ''; x.planned = ''; });
  commit();
  toast(`Cleared ${n.length} planned time${n.length === 1 ? '' : 's'}`);
};
acts['sched-view'] = el => { S.settings.schedView = el.dataset.v; commit(); };
