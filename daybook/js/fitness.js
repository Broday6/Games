// Fitness coach: a cutting plan that takes you to a lean body-fat target while keeping your muscle.
// What it is built on: lose about 0.5–1% of body weight a week; eat high protein (about 1 g per lb of goal weight);
// keep lifting heavy so the body has a reason to hold muscle; walk a lot; sleep 7+ hours; take a week at
// maintenance every 8–12 weeks. Calorie needs start from a formula and are re-learned from your own weigh-ins and
// food log, then the coach suggests small adjustments (never below a safe floor).
import { $, $$, esc, uid, num, sum, round2, avg, acts, chg, icon, toast, sheet, formSheet, field, input, numInput, select, today, addDays, parseDate, fmtDate, fmtShort, daysBetween, relDay, empty, pill, bus } from './util.js';
import { S, commit, save, undoable, set } from './store.js';
import { lineChart } from './charts.js';

const LB = 2.20462;
const kg = () => set('units') === 'kg';
const U = () => set('units');
const toLb = w => (kg() ? w * LB : w);
const fromLb = lb => (kg() ? lb / LB : lb);
const toIn = x => (kg() ? x / 2.54 : x);
const r10 = n => Math.round(n / 10) * 10;
const fmtW = lb => `${round2(Math.round(fromLb(lb) * 10) / 10)} ${U()}`;
export const cut = () => (S.cut && S.cut.on ? S.cut : null);

export const ACTIVITY = [['desk', 'Desk job, lifting 3–4 days', 1.4], ['light', 'On my feet part of the day', 1.5], ['active', 'Physical work most days (trades, construction)', 1.65], ['very', 'Hard physical work all day', 1.8]];
export const PACES = [['0.5', 'Steady: 0.5% a week (most muscle kept)'], ['0.75', 'Standard: 0.75% a week'], ['1', 'Fast: 1% a week (short pushes only)']];

// ---------- body data ----------
const weighIns = () => [...S.body].filter(b => num(b.weight) > 0).sort((a, b) => a.date.localeCompare(b.date));
// Smoothed weight trend, so a salty dinner does not read as fat gain.
export function trend() {
  const w = weighIns();
  let t = null;
  return w.map(b => { const lb = toLb(num(b.weight)); t = t === null ? lb : t + 0.2 * (lb - t); return { x: b.date, y: t, raw: lb }; });
}
export const trendNow = () => { const t = trend(); return t.length ? t[t.length - 1].y : null; };
// Weekly change from a straight-line fit of the last three weeks of trend.
export function weeklyRate(days = 21) {
  const pts = trend().filter(p => daysBetween(p.x, today()) <= days);
  if (pts.length < 4 || daysBetween(pts[0].x, pts[pts.length - 1].x) < 7) return null;
  const xs = pts.map(p => daysBetween(pts[0].x, p.x)), ys = pts.map(p => p.y);
  const mx = avg(xs.map(x => x + 1)) - 1, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const perWeek = slope * 7;
  return { perWeek, pct: (perWeek / my) * 100 };
}
// U.S. Navy circumference method (inches).
export function navyBF(sex, h, waist, neck, hip) {
  h = toIn(num(h)); waist = toIn(num(waist)); neck = toIn(num(neck)); hip = toIn(num(hip));
  if (!h || !waist || !neck || waist <= neck) return null;
  const bf = sex === 'f'
    ? (hip ? 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(h) - 78.387 : null)
    : 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(h) + 36.76;
  return bf && bf > 2 && bf < 60 ? round2(bf) : null;
}
const measured = () => [...S.body].filter(b => num(b.bf) > 0).sort((a, b) => a.date.localeCompare(b.date));
// Body fat now: the latest measurement, carried forward assuming lean mass holds (the point of the plan).
export function bfNow(c = cut()) {
  if (!c) return null;
  const m = measured().pop();
  const w = trendNow();
  if (m && daysBetween(m.date, today()) <= 10) return num(m.bf);
  const baseLb = m ? (num(m.weight) ? toLb(num(m.weight)) : (w ?? num(c.startWeight))) : num(c.startWeight);
  const lbm = baseLb * (1 - num(m ? m.bf : c.startBF) / 100);
  return w ? round2(Math.max(3, (1 - lbm / w) * 100)) : num(m ? m.bf : c.startBF);
}
export function leanMass(c = cut()) { const w = trendNow() ?? num(c.startWeight); const bf = bfNow(c) ?? num(c.startBF); return w * (1 - bf / 100); }
export const goalWeight = (c = cut()) => leanMass(c) / (1 - num(c.goalBF) / 100);

// ---------- energy ----------
function bmr(c, lbW) {
  const kgW = lbW / LB;
  const bf = bfNow(c);
  if (bf) return 370 + 21.6 * kgW * (1 - bf / 100); // Katch-McArdle when body fat is known
  const cm = kg() ? num(c.height) : num(c.height) * 2.54;
  return 10 * kgW + 6.25 * cm - 5 * (num(set('age')) || 35) + (c.sex === 'f' ? -161 : 5);
}
const foodOn = d => (S.food || []).filter(f => f.date === d);
export const intake = d => ({ kcal: sum(foodOn(d), f => num(f.kcal)), p: sum(foodOn(d), f => num(f.p)), c: sum(foodOn(d), f => num(f.c)), f: sum(foodOn(d), f => num(f.f)), n: foodOn(d).length });
// What your weigh-ins and food log say you actually burn: intake minus the energy in the weight you lost.
export function learnedTDEE() {
  const span = 28;
  const days = Array.from({ length: span }, (_, i) => addDays(today(), -i - 1)).filter(d => intake(d).kcal > 600);
  if (days.length < 12) return null;
  const tr = trend().filter(p => daysBetween(p.x, today()) <= span + 1);
  if (tr.length < 4) return null;
  const n = daysBetween(tr[0].x, tr[tr.length - 1].x);
  if (n < 12) return null;
  const change = tr[tr.length - 1].y - tr[0].y;
  return { tdee: avg(days.map(d => intake(d).kcal)) - (change * 3500) / n, days: days.length };
}
export function targets(c = cut()) {
  if (!c) return null;
  const w = trendNow() ?? num(c.startWeight);
  const formula = bmr(c, w) * (ACTIVITY.find(a => a[0] === c.activity)?.[2] || 1.5);
  const learned = learnedTDEE();
  const maint = learned ? 0.7 * learned.tdee + 0.3 * formula : formula;
  const done = (bfNow(c) ?? 99) <= num(c.goalBF);
  const lossPerWeek = done || inBreak(c) ? 0 : w * num(c.pace) / 100;
  const floor = Math.max(c.sex === 'f' ? 1200 : 1500, bmr(c, w) * 0.9);
  const kcal = r10(Math.max(floor, maint - (lossPerWeek * 3500) / 7 + num(c.adj)));
  const gw = goalWeight(c);
  const p = Math.round(Math.min(1.1 * w, Math.max(0.8 * w, gw)));
  const f = Math.round(Math.max(0.3 * w, (kcal * 0.22) / 9));
  const carbs = Math.max(50, Math.round((kcal - p * 4 - f * 9) / 4));
  return { kcal, p, c: carbs, f, maint: r10(maint), learned, floorHit: kcal <= r10(floor) + 5, lossPerWeek, done, steps: num(c.steps) || 10000 };
}
const inBreak = c => c.breakStart && daysBetween(c.breakStart, today()) < 7;

// ---------- recovery (readiness) ----------
export function readiness(d = today()) {
  const m = S.checkins.find(x => x.kind === 'morning' && x.date === d);
  if (!m || (!num(m.sleep) && !num(m.energy))) return null;
  const ev = S.checkins.find(x => x.kind === 'evening' && x.date === addDays(d, -1));
  const sets2 = sum(S.workouts.filter(w => w.date >= addDays(d, -2) && w.date < d), w => sum(w.items, it => it.sets.length));
  let s = 62;
  if (num(m.sleep)) s += Math.max(-28, Math.min(15, (num(m.sleep) - 7.25) * 11));
  if (num(m.energy)) s += (num(m.energy) - 3) * 9;
  if (ev && num(ev.stress)) s -= (num(ev.stress) - 3) * 5;
  if (sets2 > 40) s -= 8;
  s = Math.round(Math.max(5, Math.min(100, s)));
  const level = s >= 75 ? 'push' : s >= 50 ? 'normal' : 'easy';
  const advice = {
    push: 'Recovered. Go for a rep PR on your first lift.',
    normal: 'Hit your planned weights. Stop each set with 1–2 reps left.',
    easy: 'Short on recovery. Keep the weights heavy, drop one set per exercise, and skip anything to failure.',
  }[level];
  return { score: s, level, advice, sleep: num(m.sleep) || null };
}

// ---------- strength check: is muscle holding? ----------
const e1 = (w, r) => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : w * (1 + Math.min(r, 12) / 30));
export function liftStatus() {
  const out = [];
  const ids = [...new Set(S.workouts.filter(w => daysBetween(w.date, today()) <= 42).flatMap(w => w.items.map(i => i.exId)))];
  for (const id of ids) {
    const ex = S.exercises.find(e => e.id === id);
    if (!ex || ex.bw) continue;
    const best = (from, to) => { const s = S.workouts.filter(w => { const a = daysBetween(w.date, today()); return a >= from && a < to; }).flatMap(w => w.items.filter(i => i.exId === id).flatMap(i => i.sets.filter(x => x.done !== false))); return s.length ? Math.max(...s.map(x => e1(num(x.w), num(x.r)))) : 0; };
    const now = best(0, 21), before = best(21, 42);
    if (!now || !before) continue;
    const ch = (now - before) / before * 100;
    out.push({ id, name: ex.name, now: round2(now), ch: round2(ch), status: ch > 2 ? 'up' : ch < -4 ? 'down' : 'hold' });
  }
  return out.sort((a, b) => a.ch - b.ch);
}

// ---------- the coach's notes ----------
export function notes(c = cut()) {
  if (!c) return [];
  const t = targets(c), r = weeklyRate(), out = [];
  const pace = num(c.pace);
  const wk = Math.floor(daysBetween(c.start, today()) / 7);
  const logged = Array.from({ length: 7 }, (_, i) => addDays(today(), -i - 1)).filter(d => intake(d).n);
  if (t.done) out.push({ kind: 'good', text: `You're at your ${c.goalBF}% goal. Eat about ${t.maint.toLocaleString()} kcal a day to hold it, keep protein high, and keep lifting.`, act: 'cut-maintain', label: 'Switch to maintenance' });
  if (r && daysBetween(c.start, today()) >= 14) {
    if (-r.pct > Math.max(pace + 0.35, 1.2)) out.push({ kind: 'warn', text: `You're losing ${round2(-r.pct)}% a week, faster than planned. Faster than about 1% a week costs muscle. Eat 150 kcal more a day.`, act: 'cut-adj', d: 150, label: '+150 kcal' });
    else if (-r.pct < 0.2 && !inBreak(c)) out.push({ kind: 'warn', text: `Your weight trend has been flat for about 3 weeks. Cut 150 kcal a day, or add about 2,000 steps a day.`, act: 'cut-adj', d: -150, label: '−150 kcal' });
    else if (-r.pct >= pace - 0.25) out.push({ kind: 'good', text: `On pace: ${round2(-r.pct)}% a week (${fmtW(-r.perWeek)}).` });
    else out.push({ kind: 'info', text: `Losing ${round2(-r.pct)}% a week, a little under the ${pace}% plan. That's fine while strength holds. To speed up, cut 100 kcal a day or add 2,000 steps.`, act: 'cut-adj', d: -100, label: '−100 kcal' });
  } else if (weighIns().filter(b => daysBetween(b.date, today()) <= 7).length < 3) out.push({ kind: 'info', text: 'Weigh in most mornings after the bathroom, before eating. The trend line needs a few points a week to steer you.' });
  const drops = liftStatus().filter(l => l.status === 'down');
  if (drops.length) out.push({ kind: 'warn', text: `Strength is slipping on ${drops.map(l => l.name).join(', ')}. On a cut, holding strength means holding muscle: keep the weights heavy, cut volume before load, check protein and sleep${pace > 0.5 ? ', and consider slowing to 0.5% a week' : ''}.`, act: pace > 0.5 ? 'cut-pace' : '', d: 0.5, label: 'Slow to 0.5%' });
  if (logged.length >= 3) {
    const p = avg(logged.map(d => intake(d).p));
    if (p < t.p * 0.85) out.push({ kind: 'warn', text: `Protein is averaging ${Math.round(p)} g against a ${t.p} g target. This is the biggest lever for keeping muscle: get 40–50 g at each meal.` });
  } else out.push({ kind: 'info', text: 'Log what you eat in Fuel, even roughly. After about two weeks the coach learns your real calorie burn.' });
  const sl = avg(S.checkins.filter(x => x.kind === 'morning' && daysBetween(x.date, today()) <= 7).map(x => num(x.sleep)));
  if (sl && sl < 6.5) out.push({ kind: 'warn', text: `Sleep is averaging ${round2(sl)} h. Short sleep on a diet shifts the loss toward muscle. With 5:40 workouts, aim for lights out by about 9:30.` });
  if (wk >= 10 && !c.breakStart) out.push({ kind: 'info', text: `${wk} weeks in. A week at maintenance (a diet break) helps reset hunger, energy and training before the next push.`, act: 'cut-break', label: 'Start a diet break' });
  if (inBreak(c)) out.push({ kind: 'good', text: `Diet break: eat at maintenance (${t.kcal.toLocaleString()} kcal) until ${fmtShort(addDays(c.breakStart, 7))}. Keep protein and training the same.` });
  if (t.floorHit && !t.done) out.push({ kind: 'info', text: 'Calories are at the safe floor. Lose the rest with steps rather than eating less.' });
  if (!out.length) out.push({ kind: 'good', text: 'Everything is on track. Keep hitting protein, steps and your lifts.' });
  return out;
}
acts['cut-adj'] = el => { const c = cut(); if (!c) return; c.adj = num(c.adj) + +el.dataset.d; c.lastAdjust = today(); commit(); toast(`Daily target ${+el.dataset.d > 0 ? 'raised' : 'lowered'} by ${Math.abs(+el.dataset.d)} kcal`); };
acts['cut-pace'] = el => { const c = cut(); if (!c) return; c.pace = el.dataset.d; commit(); toast('Pace set to 0.5% a week'); };
acts['cut-break'] = () => { const c = cut(); if (!c) return; c.breakStart = today(); commit(); toast('Diet break: one week at maintenance'); };
acts['cut-maintain'] = () => { const c = cut(); if (!c) return; c.pace = '0'; c.phase = 'maintain'; commit(); toast('Maintenance mode'); };

// ---------- setup ----------
acts['cut-setup'] = () => cutForm(S.cut || {});
acts['cut-end'] = () => undoable('Cut plan ended. Your logs are kept.', () => { S.cut = { ...S.cut, on: false, ended: today() }; });
// Height as typed by people: 5'10", 5 10, 5ft 10in, 70 (inches) or 178 (cm).
export function parseHeight(ft, inch) {
  const raw = String(ft || '').trim();
  if (kg()) return num(raw);
  const m = raw.match(/^(\d)\s*(?:'|ft|feet|’|\s)\s*(\d{1,2}(?:\.\d)?)?/i);
  if (m) return +m[1] * 12 + num(m[2] || inch);
  const n = num(raw);
  if (n > 0 && n < 9) return n * 12 + num(inch); // just feet in the first box
  return n; // already inches
}
const LOOK = {
  m: [['10', 'Lean', 'Abs clearly visible, veins on the arms'], ['13', 'Athletic', 'Outline of abs, defined shoulders and arms'], ['17', 'Fit', 'Some definition, a little softness at the waist'], ['22', 'Average', 'Soft midsection, no ab outline'], ['27', 'Above average', 'Belly sits out past the chest line'], ['33', 'Higher', 'Rounder all over']],
  f: [['18', 'Lean', 'Abs visible, defined arms and legs'], ['22', 'Athletic', 'Some ab outline, toned'], ['26', 'Fit', 'Flat stomach, little definition'], ['30', 'Average', 'Soft hips and midsection'], ['35', 'Above average', 'Fuller midsection and hips'], ['40', 'Higher', 'Rounder all over']],
};
function cutForm(c) {
  const w = trendNow();
  const isNew = !c.on;
  const ht = num(c.height);
  const method = c.bfMethod || 'look';
  const radio = (name, opts, cur) => `<div class="segs seg-radio" role="radiogroup">${opts.map(([v, l]) => `<label class="seg${v === cur ? ' on' : ''}"><input type="radio" name="${name}" value="${v}"${v === cur ? ' checked' : ''}>${l}</label>`).join('')}</div>`;
  formSheet({
    title: isNew ? 'Set up your cut' : 'Edit your plan',
    fields: `<p class="muted small">Daybook turns this into daily calorie, protein and step targets, then adjusts them from your weigh-ins. General guidance, not medical advice.</p>
      <h4 class="form-h">You</h4>
      ${radio('sex', [['m', 'Male'], ['f', 'Female']], c.sex || 'm')}
      <div class="grid3">${kg() ? field('Height (cm)', numInput('ft', ht || '', 'placeholder="178"')) : `${field('Height (ft)', numInput('ft', ht ? Math.floor(ht / 12) : '', 'placeholder="5"'))}${field('Inches', numInput('in', ht ? Math.round(ht % 12) : '', 'placeholder="10"'))}`}${field('Age', numInput('age', set('age') || '', 'placeholder="30"'))}</div>
      ${field(`Weight now (${U()})`, numInput('weight', w ? Math.round(fromLb(w) * 10) / 10 : '', `placeholder="${kg() ? '86' : '190'}"`))}
      <h4 class="form-h">Body fat now</h4>
      ${radio('method', [['look', 'By look'], ['tape', 'Tape measure'], ['known', 'I know it']], method)}
      <div data-m="look"><div class="look-list" data-look></div></div>
      <div data-m="tape" hidden><div class="grid3">${field(`Waist at navel (${kg() ? 'cm' : 'in'})`, numInput('waist', ''))}${field(`Neck (${kg() ? 'cm' : 'in'})`, numInput('neck', ''))}<div data-hip>${field(`Hips (${kg() ? 'cm' : 'in'})`, numInput('hip', ''))}</div></div><p class="muted small">Measure in the morning, tape snug, not tight.</p></div>
      <div data-m="known" hidden>${field('Body fat (%)', numInput('bf', c.startBF || '', 'placeholder="18"'))}</div>
      <h4 class="form-h">Plan</h4>
      ${field('Your days', select('activity', ACTIVITY.map(a => [a[0], a[1]]), c.activity || 'active'))}
      <div class="grid2">${field('Goal body fat (%)', numInput('goalBF', c.goalBF || ''), 'Lean and defined: about 10–12% for men, 18–20% for women.')}${field('Pace', select('pace', PACES, String(c.pace || '0.75')))}</div>
      ${field('Daily steps', select('steps', [['7000', '7,000'], ['8000', '8,000'], ['10000', '10,000'], ['12000', '12,000']], String(c.steps || 10000)))}`,
    del: isNew ? null : () => acts['cut-end'](),
    onMount: el => {
      const val = n => el.querySelector(`[name=${n}]:checked`)?.value;
      const drawLook = () => {
        const sex = val('sex') || 'm';
        const cur = el.querySelector('[name=lookbf]:checked')?.value || (method === 'look' && c.startBF ? String(c.startBF) : '');
        el.querySelector('[data-look]').innerHTML = LOOK[sex].map(([v, l, dsc]) => `<label class="look-opt"><input type="radio" name="lookbf" value="${v}"${v === cur ? ' checked' : ''}><span><b>${l} <small>~${v}%</small></b><small>${dsc}</small></span></label>`).join('');
      };
      const sync = () => {
        const m = val('method');
        el.querySelectorAll('[data-m]').forEach(x => { x.hidden = x.dataset.m !== m; });
        el.querySelector('[data-hip]').hidden = val('sex') !== 'f';
        el.querySelectorAll('.seg-radio .seg').forEach(x => x.classList.toggle('on', x.querySelector('input').checked));
        const g = el.querySelector('[name=goalBF]');
        g.placeholder = val('sex') === 'f' ? '20' : '11';
      };
      el.addEventListener('change', e => { if (e.target.name === 'sex') drawLook(); if (['sex', 'method'].includes(e.target.name)) sync(); });
      drawLook(); sync();
    },
    onSubmit: (d, form) => {
      const sex = form.querySelector('[name=sex]:checked').value;
      const method = form.querySelector('[name=method]:checked').value;
      const height = parseHeight(d.ft, d.in);
      const wt = num(d.weight);
      const bad = msg => { toast(msg, { kind: 'bad' }); return false; };
      if (kg() ? height < 120 || height > 230 : height < 48 || height > 90) return bad(kg() ? 'Enter your height in centimeters, like 178.' : 'Enter your height in feet and inches, like 5 and 10.');
      if (!wt || (kg() ? wt < 35 || wt > 250 : wt < 80 || wt > 550)) return bad(`Enter your weight in ${U()}.`);
      let bf = 0;
      if (method === 'known') bf = num(d.bf);
      if (method === 'tape') { bf = navyBF(sex, height, d.waist, d.neck, d.hip); if (!bf) return bad(sex === 'f' ? 'Enter waist, neck and hips. The waist must be bigger than the neck.' : 'Enter waist and neck. The waist must be bigger than the neck.'); }
      if (method === 'look') { bf = num(form.querySelector('[name=lookbf]:checked')?.value); if (!bf) return bad('Pick the description closest to how you look.'); }
      if (!(bf > 3 && bf < 60)) return bad('Body fat should be a percentage, like 18.');
      const goal = num(d.goalBF) || (sex === 'f' ? 20 : 11);
      const floorGoal = sex === 'f' ? 15 : 7;
      if (goal < floorGoal) return bad(`${goal}% is contest-stage lean and not safe to hold. Pick ${floorGoal}% or higher.`);
      if (goal >= bf) return bad(`Your goal (${goal}%) should be below where you are now (about ${round2(bf)}%).`);
      if (num(d.age)) S.settings.age = d.age;
      const entry = S.body.find(b => b.date === today());
      const m = method === 'tape' ? { bf: String(round2(bf)), waist: d.waist, neck: d.neck, hip: d.hip || '' } : method === 'known' ? { bf: String(round2(bf)) } : {};
      if (entry) Object.assign(entry, { weight: String(wt), ...m }); else S.body.push({ date: today(), weight: String(wt), ...m });
      S.cut = { ...(S.cut || {}), on: true, phase: 'cut', sex, height: String(height), activity: d.activity, goalBF: String(goal), pace: d.pace, steps: d.steps, bfMethod: method, start: isNew ? today() : c.start, startWeight: String(toLb(wt)), startBF: String(round2(bf)), adj: isNew ? 0 : c.adj || 0 };
      commit();
      const t = targets();
      toast(isNew ? `Plan set: ${t.kcal.toLocaleString()} kcal and ${t.p} g protein a day` : 'Plan updated');
    },
  });
}

// ---------- measurements ----------
acts['measure'] = () => {
  const c = cut();
  formSheet({
    title: 'Weekly measurements',
    fields: `<p class="muted small">Measure first thing in the morning, tape snug but not tight. Waist at the navel, neck just below the Adam's apple.</p>
      <div class="grid3">${field(`Waist (${kg() ? 'cm' : 'in'})`, numInput('waist', '', 'autofocus'))}${field(`Neck (${kg() ? 'cm' : 'in'})`, numInput('neck', ''))}${c?.sex === 'f' ? field(`Hips (${kg() ? 'cm' : 'in'})`, numInput('hip', '')) : ''}</div>
      ${field(`Weight (${U()})`, numInput('weight', S.body.find(b => b.date === today())?.weight || ''))}`,
    onSubmit: d => {
      const bf = navyBF(c?.sex || 'm', c?.height, d.waist, d.neck, d.hip);
      if (!bf) { toast('Enter waist and neck (and hips for women).'); return false; }
      const e = S.body.find(b => b.date === today()) || (S.body.push({ date: today(), weight: '' }), S.body[S.body.length - 1]);
      Object.assign(e, { bf: String(bf), waist: d.waist, neck: d.neck, hip: d.hip || '' });
      if (num(d.weight)) e.weight = String(num(d.weight));
      commit();
      toast(`Estimated body fat: ${bf}%`);
    },
  });
};

// ---------- steps and cardio ----------
export const stepsOn = d => num((S.steps || {})[d]);
export const cardioOn = d => (S.cardio || []).filter(x => x.date === d);
chg.steps = el => { S.steps = { ...(S.steps || {}), [today()]: Math.max(0, Math.round(num(el.value))) }; commit(); };
acts['cardio-new'] = () => formSheet({
  title: 'Log cardio',
  fields: `<div class="grid2">${field('Type', select('kind', [['walk', 'Walk'], ['incline', 'Incline walk'], ['bike', 'Bike'], ['run', 'Run'], ['row', 'Rower'], ['hiit', 'Intervals'], ['other', 'Other']], 'walk'))}${field('Minutes', numInput('mins', '30', 'autofocus'))}</div>
    <p class="muted small">On a cut, easy cardio (a brisk walk you could talk through) burns fat without eating into recovery for lifting. Keep hard intervals to once or twice a week.</p>`,
  onSubmit: d => { if (!num(d.mins)) { toast('Enter minutes.'); return false; } S.cardio = [...(S.cardio || []), { id: uid(), date: today(), kind: d.kind, mins: num(d.mins) }]; commit(); toast(`Logged ${num(d.mins)} min`); },
});

// ---------- food (Fuel) ----------
let fuelDay = '';
const day = () => fuelDay || today();
export function addFood(items, date = today()) {
  S.food = S.food || [];
  for (const it of items) S.food.push({ id: uid(), date, t: Date.now(), name: String(it.name || 'Food').slice(0, 80), kcal: Math.round(num(it.kcal)), p: Math.round(num(it.p)), c: Math.round(num(it.c)), f: Math.round(num(it.f)), est: !!it.est });
}
const FAVS = [
  { name: 'Protein shake (1 scoop)', kcal: 130, p: 25, c: 4, f: 2 }, { name: 'Chicken breast, 6 oz cooked', kcal: 280, p: 52, c: 0, f: 6 },
  { name: '3 eggs', kcal: 215, p: 19, c: 1, f: 15 }, { name: 'Greek yogurt, nonfat, 1 cup', kcal: 130, p: 23, c: 9, f: 0 },
  { name: 'Rice, 1 cup cooked', kcal: 205, p: 4, c: 45, f: 0 }, { name: 'Lean ground beef 93%, 6 oz', kcal: 300, p: 40, c: 0, f: 15 },
];
const favs = () => [...(S.foods || []), ...FAVS.filter(f => !(S.foods || []).some(x => x.name === f.name))].slice(0, 12);
const bar = (label, v, t, unit) => `<div class="macro"><div class="macro-top"><b>${label}</b><span>${Math.round(v).toLocaleString()}${t ? ` / ${t.toLocaleString()}` : ''} ${unit}</span></div><div class="mbar${t && v > t * 1.05 ? ' over' : ''}"><i style="width:${t ? Math.min(100, v / t * 100) : 0}%"></i></div></div>`;
export function fuelSummary(d = today()) {
  const t = targets(), x = intake(d);
  if (!t && !x.n) return '';
  return `<div class="macros">${bar('Calories', x.kcal, t?.kcal, 'kcal')}${bar('Protein', x.p, t?.p, 'g')}</div>`;
}
export function fuelView() {
  const d = day(), t = targets(), x = intake(d);
  const items = foodOn(d).sort((a, b) => a.t - b.t);
  return `<div class="toolbar"><div class="stepper"><button type="button" class="icon-btn" data-act="fuel-day" data-d="-1" aria-label="Previous day">${icon('chevL')}</button><strong>${esc(relDay(d))}</strong><button type="button" class="icon-btn" data-act="fuel-day" data-d="1" aria-label="Next day"${d >= today() ? ' disabled' : ''}>${icon('chevR')}</button></div></div>
    <section class="fit-panel"><div class="macros">${bar('Calories', x.kcal, t?.kcal, 'kcal')}${bar('Protein', x.p, t?.p, 'g')}${bar('Carbs', x.c, t?.c, 'g')}${bar('Fat', x.f, t?.f, 'g')}</div>
      ${t ? `<p class="fit-sub">${x.kcal < t.kcal ? `${(t.kcal - x.kcal).toLocaleString()} kcal and ${Math.max(0, t.p - x.p)} g protein left` : `${(x.kcal - t.kcal).toLocaleString()} kcal over today`}</p>` : ''}</section>
    ${window.claude?.use ? `<form class="ask-bar" data-meal-form><label class="sr-only" for="meal-in">Describe a meal</label>${icon('bolt')}<input id="meal-in" placeholder="Describe a meal: “2 eggs, toast and a coffee with milk”" autocomplete="off"><button type="submit" class="btn sm primary">Estimate</button></form>` : ''}
    <section class="group"><header class="group-head"><h3>Quick add</h3></header><div class="chips">${favs().map((f, i) => `<button type="button" class="chip" data-act="fav-add" data-i="${i}" title="${f.kcal} kcal · ${f.p} g protein">${esc(f.name)} <small>${f.p}g</small></button>`).join('')}</div>
      <form class="food-form" data-food-form><input name="name" placeholder="Food" aria-label="Food" required><input name="kcal" inputmode="numeric" placeholder="kcal" aria-label="Calories"><input name="p" inputmode="numeric" placeholder="Protein g" aria-label="Protein grams"><button type="submit" class="btn sm">${icon('plus')}</button></form>
      <p class="muted small">Carbs and fat are optional. Foods you add are saved to Quick add.</p></section>
    <section class="group"><header class="group-head"><h3>Logged</h3><span class="muted">${items.length}</span></header>
      ${items.length ? `<div class="list panel">${items.map(f => `<div class="row"><div class="row-main"><div class="row-title">${esc(f.name)}${f.est ? ' <span class="pill muted">estimate</span>' : ''}</div><div class="row-sub">${f.kcal} kcal · ${f.p} g protein${f.c ? ` · ${f.c} g carbs` : ''}${f.f ? ` · ${f.f} g fat` : ''}</div></div><button type="button" class="icon-btn sm" data-act="food-del" data-id="${f.id}" aria-label="Delete ${esc(f.name)}">${icon('x')}</button></div>`).join('')}</div>` : '<p class="muted small">Nothing logged yet.</p>'}</section>`;
}
acts['fuel-day'] = el => { const d = addDays(day(), +el.dataset.d); fuelDay = d >= today() ? '' : d; commit(); };
acts['fav-add'] = el => { const f = favs()[+el.dataset.i]; if (!f) return; addFood([f], day()); commit(); toast(`Added ${f.name}`); };
acts['food-del'] = el => undoable('Removed', () => { S.food = (S.food || []).filter(f => f.id !== el.dataset.id); });
document.addEventListener('submit', async e => {
  const ff = e.target.closest('[data-food-form]');
  if (ff) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(ff));
    if (!d.name.trim() || !num(d.kcal)) return toast('Enter a food and its calories.');
    const it = { name: d.name.trim(), kcal: num(d.kcal), p: num(d.p), c: 0, f: 0 };
    addFood([it], day());
    S.foods = [it, ...(S.foods || []).filter(x => x.name.toLowerCase() !== it.name.toLowerCase())].slice(0, 20);
    commit();
    return;
  }
  const mf = e.target.closest('[data-meal-form]');
  if (!mf) return;
  e.preventDefault();
  const text = mf.querySelector('input').value.trim();
  if (!text) return;
  const sample = await window.claude?.use?.('sample').catch(() => null);
  if (!sample) return toast('Meal estimates need Daybook open inside Claude.');
  const btn = mf.querySelector('button');
  btn.disabled = true; btn.textContent = 'Estimating…';
  try {
    const out = await sample.json(`Estimate the nutrition of this meal as typically prepared in the US. Reply with only a JSON array, one object per food: {"name": string (short, with amount), "kcal": number, "p": protein grams, "c": carb grams, "f": fat grams}.\n\nMeal: ${text}`, { modelTier: 'quick' });
    const list = (Array.isArray(out) ? out : [out]).filter(x => x && num(x.kcal) > 0).map(x => ({ ...x, est: true }));
    if (!list.length) throw { code: 'invalid_json' };
    addFood(list, day());
    commit();
    toast(`Added ${list.length} item${list.length > 1 ? 's' : ''}: ${sum(list, x => num(x.kcal))} kcal, ${sum(list, x => num(x.p))} g protein`);
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Estimate';
    toast(err?.code === 'not_granted' ? 'Claude is not allowed for this page.' : 'Could not estimate that. Try listing the foods and amounts.');
  }
});

// ---------- coach view ----------
export function coachView() {
  const c = cut();
  if (!c) {
    return `<section class="fit-hero"><span class="fit-eyebrow">Fitness coach</span><h2>Get lean. Keep the muscle.</h2>
      <p>A plan built for cutting to a lean body-fat level without losing what you've built in the gym:</p>
      <ul class="fit-list"><li><b>Lose 0.5–1% of body weight a week.</b> Slower keeps more muscle.</li><li><b>Protein first</b>, about 1 g per pound of goal weight.</li><li><b>Lift heavy</b> and track strength. Holding it means holding muscle.</li><li><b>Walk a lot</b>, sleep 7+ hours, and take a diet break every 8–12 weeks.</li></ul>
      <p>Targets start from a formula, then the coach learns your real calorie burn from your weigh-ins and food log and adjusts.</p>
      <button type="button" class="btn lg fit-cta" data-act="cut-setup">${icon('bolt')} Set up my cut</button></section>
      ${readinessCard()}`;
  }
  const t = targets(c), bf = bfNow(c), w = trendNow(), r = weeklyRate();
  const startBF = num(c.startBF), goal = num(c.goalBF);
  const prog = startBF > goal ? Math.max(0, Math.min(1, (startBF - bf) / (startBF - goal))) : 0;
  const gw = goalWeight(c);
  const toLose = Math.max(0, w - gw);
  const perWeek = Math.max(0.1, -(r?.perWeek ?? -w * num(c.pace) / 100));
  const weeks = toLose / perWeek;
  const eta = addDays(today(), Math.round(weeks * 7));
  const x = intake(today());
  const st = stepsOn(today()), cardio = cardioOn(today());
  const wk = Math.floor(daysBetween(c.start, today()) / 7) + 1;
  const lastM = measured().pop();
  const measureDue = !lastM || daysBetween(lastM.date, today()) >= 7;
  const ns = notes(c);
  const lifts = liftStatus();
  const tr = trend().filter(p => daysBetween(p.x, today()) <= 56);
  return `<section class="fit-hero">
      <div class="fit-top"><span class="fit-eyebrow">${t.done ? 'Goal reached' : inBreak(c) ? 'Diet break' : `Cut · week ${wk}`}</span><button type="button" class="fit-link" data-act="cut-setup">Edit plan</button></div>
      <div class="fit-score"><div><span class="fit-big">${round2(Math.round(bf * 10) / 10)}<small>%</small></span><span class="fit-lbl">body fat now</span></div>
        <div class="fit-arrow">${icon('chevR')}</div>
        <div><span class="fit-big goal">${goal}<small>%</small></span><span class="fit-lbl">goal</span></div></div>
      <div class="fit-prog"><i style="width:${(prog * 100).toFixed(1)}%"></i></div>
      <div class="fit-stats"><div><b>${fmtW(w)}</b><span>trend weight</span></div><div><b>${fmtW(gw)}</b><span>goal weight</span></div>
        <div><b>${t.done ? '—' : weeks < 1 ? '< 1 wk' : `${Math.ceil(weeks)} wks`}</b><span>${t.done ? 'at goal' : `about ${esc(fmtShort(eta))}`}</span></div>
        <div><b>${r ? `${r.perWeek < 0 ? '−' : '+'}${round2(Math.abs(fromLb(r.perWeek)))}` : '—'}</b><span>${U()} per week</span></div></div>
      <p class="fit-sub">Lean mass ${fmtW(leanMass(c))}. The plan keeps it while the rest comes off.</p>
    </section>
    <section class="fit-panel"><header class="fit-panel-head"><h3>Today's targets</h3><button type="button" class="btn ghost sm" data-act="gym-tab" data-v="fuel">Log food</button></header>
      <div class="macros">${bar('Calories', x.kcal, t.kcal, 'kcal')}${bar('Protein', x.p, t.p, 'g')}${bar('Carbs', x.c, t.c, 'g')}${bar('Fat', x.f, t.f, 'g')}</div>
      <div class="fit-row"><label class="steps-in"><span>Steps</span><input inputmode="numeric" data-chg="steps" value="${st || ''}" placeholder="0" aria-label="Steps today"><small>/ ${t.steps.toLocaleString()}</small></label>
        <div class="mbar steps"><i style="width:${Math.min(100, st / t.steps * 100)}%"></i></div>
        <button type="button" class="btn ghost sm" data-act="cardio-new">${icon('plus')} Cardio${cardio.length ? ` · ${sum(cardio, k => k.mins)} min` : ''}</button></div>
      <p class="muted small">${t.learned ? `Calories learned from ${t.learned.days} days of your logs: you burn about ${t.maint.toLocaleString()} a day.` : `Estimated burn: about ${t.maint.toLocaleString()} kcal a day. This sharpens after two weeks of logging.`}${num(c.adj) ? ` Includes your ${num(c.adj) > 0 ? '+' : ''}${num(c.adj)} kcal adjustment.` : ''}</p></section>
    ${readinessCard()}
    ${ns.length ? `<section class="group"><header class="group-head"><h3>Coach</h3></header><div class="coach-notes">${ns.map(n => `<div class="coach-note ${n.kind}"><p>${esc(n.text)}</p>${n.act ? `<button type="button" class="btn sm" data-act="${n.act}" data-d="${n.d ?? ''}">${esc(n.label)}</button>` : ''}</div>`).join('')}</div></section>` : ''}
    <section class="fit-panel"><header class="fit-panel-head"><h3>Weight trend</h3>${measureDue ? `<button type="button" class="btn sm" data-act="measure">Measure this week</button>` : `<span class="muted small">Measured ${esc(relDay(lastM.date).toLowerCase())}</span>`}</header>
      ${tr.length > 1 ? `${lineChart(tr.map(p => ({ x: p.x, y: round2(fromLb(p.raw)) })), { avg: tr.map(p => ({ x: p.x, y: round2(fromLb(p.y)) })), fmt: v => String(Math.round(v * 10) / 10) })}<p class="legend"><i class="sw line"></i> Weigh-ins <i class="sw avg"></i> Trend</p>` : '<p class="muted small chart-empty">Weigh in a few mornings to see your trend.</p>'}
      <form class="inline-form" data-body-form><label class="sr-only" for="bw-in2">Today's weight</label><input id="bw-in2" inputmode="decimal" placeholder="Today's weight (${U()})"><button type="submit" class="btn sm">${icon('scale')} Log</button></form></section>
    <section class="fit-panel"><header class="fit-panel-head"><h3>Strength check</h3><span class="muted small">last 3 weeks vs the 3 before</span></header>
      ${lifts.length ? `<div class="lift-list">${lifts.map(l => `<div class="lift ${l.status}"><span class="lift-ico">${l.status === 'up' ? '↑' : l.status === 'down' ? '↓' : '→'}</span><span class="lift-name">${esc(l.name)}</span><span class="lift-ch">${l.ch > 0 ? '+' : ''}${l.ch}%</span></div>`).join('')}</div>
        <p class="muted small">On a cut, → holding is a win. ↓ dropping means losing muscle.</p>` : '<p class="muted small">After a few weeks of logged workouts, this shows whether each lift is going up, holding or slipping.</p>'}</section>
    <section class="fit-panel rules"><header class="fit-panel-head"><h3>The rules</h3></header>
      <ol><li>Hit protein every day: ${t.p} g, spread over 3–4 meals.</li><li>Lift heavy. Keep the weight on the bar; cut sets before you cut load.</li><li>${t.steps.toLocaleString()} steps a day. Easy cardio over hard.</li><li>Sleep 7+ hours. Lights out by about 9:30 for the 5:40 workouts.</li><li>Weigh in most mornings and trust the trend, not the day.</li></ol></section>`;
}
export function readinessCard() {
  const r = readiness();
  if (!r) return `<section class="fit-panel readiness none"><div><h3>Recovery</h3><p class="muted small">Do your morning check-in (sleep and energy) to get a recovery score before training.</p></div><button type="button" class="btn sm" data-act="checkin" data-kind="morning">Check in</button></section>`;
  return `<section class="fit-panel readiness ${r.level}"><div class="ready-score"><b>${r.score}</b><span>recovery</span></div><div><h3>${{ push: 'Push today', normal: 'Train as planned', easy: 'Take it easier' }[r.level]}</h3><p>${esc(r.advice)}</p></div></section>`;
}
