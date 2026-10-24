// Starter exercise library, workout templates and the optional sample data set.
import { uid, today, addDays, tsOf } from './util.js';

// lower: lower-body lift (bigger jumps); bw: bodyweight (weight = added load); rest: default rest in seconds.
export const EXERCISES = [
  ['bench', 'Bench Press', 'Chest', 'Barbell', 0, 0, 180],
  ['incline_db', 'Incline Dumbbell Press', 'Chest', 'Dumbbell', 0, 0, 120],
  ['db_bench', 'Dumbbell Bench Press', 'Chest', 'Dumbbell', 0, 0, 120],
  ['cable_fly', 'Cable Fly', 'Chest', 'Cable', 0, 0, 90],
  ['pushup', 'Push-up', 'Chest', 'Bodyweight', 0, 1, 90],
  ['dip', 'Dip', 'Chest', 'Bodyweight', 0, 1, 120],
  ['deadlift', 'Deadlift', 'Back', 'Barbell', 1, 0, 240],
  ['row', 'Barbell Row', 'Back', 'Barbell', 0, 0, 150],
  ['pullup', 'Pull-up', 'Back', 'Bodyweight', 0, 1, 150],
  ['lat_pulldown', 'Lat Pulldown', 'Back', 'Cable', 0, 0, 120],
  ['cable_row', 'Seated Cable Row', 'Back', 'Cable', 0, 0, 120],
  ['db_row', 'One-arm Dumbbell Row', 'Back', 'Dumbbell', 0, 0, 90],
  ['ohp', 'Overhead Press', 'Shoulders', 'Barbell', 0, 0, 180],
  ['db_shoulder', 'Seated Dumbbell Press', 'Shoulders', 'Dumbbell', 0, 0, 120],
  ['lat_raise', 'Lateral Raise', 'Shoulders', 'Dumbbell', 0, 0, 60],
  ['face_pull', 'Face Pull', 'Shoulders', 'Cable', 0, 0, 60],
  ['rear_fly', 'Reverse Fly', 'Shoulders', 'Dumbbell', 0, 0, 60],
  ['curl', 'Barbell Curl', 'Biceps', 'Barbell', 0, 0, 90],
  ['db_curl', 'Dumbbell Curl', 'Biceps', 'Dumbbell', 0, 0, 60],
  ['hammer_curl', 'Hammer Curl', 'Biceps', 'Dumbbell', 0, 0, 60],
  ['pushdown', 'Triceps Pushdown', 'Triceps', 'Cable', 0, 0, 60],
  ['skull', 'Skull Crusher', 'Triceps', 'Barbell', 0, 0, 90],
  ['oh_ext', 'Overhead Cable Extension', 'Triceps', 'Cable', 0, 0, 60],
  ['squat', 'Back Squat', 'Quads', 'Barbell', 1, 0, 210],
  ['front_squat', 'Front Squat', 'Quads', 'Barbell', 1, 0, 180],
  ['leg_press', 'Leg Press', 'Quads', 'Machine', 1, 0, 150],
  ['split_squat', 'Bulgarian Split Squat', 'Quads', 'Dumbbell', 1, 0, 120],
  ['leg_ext', 'Leg Extension', 'Quads', 'Machine', 1, 0, 60],
  ['rdl', 'Romanian Deadlift', 'Hamstrings', 'Barbell', 1, 0, 150],
  ['leg_curl', 'Leg Curl', 'Hamstrings', 'Machine', 1, 0, 60],
  ['hip_thrust', 'Hip Thrust', 'Glutes', 'Barbell', 1, 0, 120],
  ['calf_raise', 'Standing Calf Raise', 'Calves', 'Machine', 1, 0, 60],
  ['hanging_raise', 'Hanging Leg Raise', 'Core', 'Bodyweight', 0, 1, 60],
  ['cable_crunch', 'Cable Crunch', 'Core', 'Cable', 0, 0, 60],
  ['ab_wheel', 'Ab Wheel Rollout', 'Core', 'Bodyweight', 0, 1, 60],
].map(([id, name, group, equip, lower, bw, rest]) => ({ id, name, group, equip, lower: !!lower, bw: !!bw, rest }));

export const GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];

const T = (id, name, rows) => ({ id, name, items: rows.map(([exId, sets, lo, hi]) => ({ exId, sets, lo, hi })) });
export const TEMPLATES = [
  T('t_push', 'Push', [['bench', 4, 6, 8], ['ohp', 3, 8, 10], ['incline_db', 3, 8, 12], ['lat_raise', 3, 12, 15], ['pushdown', 3, 10, 12]]),
  T('t_pull', 'Pull', [['row', 4, 6, 8], ['pullup', 3, 6, 10], ['cable_row', 3, 10, 12], ['face_pull', 3, 12, 15], ['curl', 3, 8, 12]]),
  T('t_legs', 'Legs', [['squat', 4, 5, 8], ['rdl', 3, 8, 10], ['leg_press', 3, 10, 12], ['leg_curl', 3, 10, 12], ['calf_raise', 4, 10, 15]]),
  T('t_upper', 'Upper', [['bench', 3, 6, 8], ['row', 3, 6, 8], ['ohp', 3, 8, 10], ['lat_pulldown', 3, 10, 12], ['db_curl', 2, 10, 12], ['pushdown', 2, 10, 12]]),
  T('t_lower', 'Lower', [['squat', 3, 5, 8], ['rdl', 3, 8, 10], ['split_squat', 3, 8, 10], ['leg_curl', 3, 10, 12], ['calf_raise', 3, 12, 15], ['hanging_raise', 3, 10, 15]]),
];

export const HABITS = ['Drink 3 L water', '7+ hours sleep', 'Hit protein target'];

// Sample data so the app can be explored before entering anything real. Everything is relative to today.
export function sampleData(S) {
  const t = today();
  const d = n => addDays(t, n);
  const c1 = uid(), c2 = uid() + 'b', c3 = uid() + 'c';
  S.clients = [
    { id: c1, name: 'Marisol Ortega', phone: '(555) 201-4417', email: 'marisol.ortega@example.com', address: '1418 Juniper Ave', rate: '', notes: 'Gate code 2291. Dog is friendly.' },
    { id: c2, name: 'Dunmore Property Group', phone: '(555) 388-0142', email: 'maintenance@dunmore.example.com', address: '600 Lakeview Blvd, Office 2', rate: '70', notes: 'Bill to AP, PO number on every invoice.' },
    { id: c3, name: 'Ken & Alice Whitfield', phone: '(555) 714-9023', email: 'whitfields@example.com', address: '77 Orchard Ct', rate: '', notes: '' },
  ];
  const j1 = uid() + 'j1', j2 = uid() + 'j2', j3 = uid() + 'j3', j4 = uid() + 'j4';
  S.jobs = [
    { id: j1, clientId: c1, title: 'Kitchen backsplash + under-cabinet lights', address: '1418 Juniper Ave', status: 'active', billing: 'hourly', rate: '85', price: '', start: d(-3), due: d(4), notes: 'Subway tile, 3x6 white gloss. Herringbone behind range.', created: Date.now() - 9e8 },
    { id: j2, clientId: c2, title: 'Unit 4B turnover: drywall patch & paint', address: '600 Lakeview Blvd, Unit 4B', status: 'scheduled', billing: 'fixed', rate: '', price: '1850', start: d(2), due: d(5), notes: 'Two rooms + hallway. SW Agreeable Gray.', created: Date.now() - 6e8 },
    { id: j3, clientId: c3, title: 'Deck board replacement (220 sq ft)', address: '77 Orchard Ct', status: 'done', billing: 'fixed', rate: '', price: '4200', start: d(-16), due: d(-10), notes: 'Trex Enhance, Toasted Sand.', created: Date.now() - 2e9 },
    { id: j4, clientId: c3, title: 'Bathroom vanity swap (quote)', address: '77 Orchard Ct', status: 'lead', billing: 'fixed', rate: '', price: '', start: '', due: '', notes: '48" vanity, move drain 2" left.', created: Date.now() - 1e8 },
  ];
  S.events = [
    { id: uid(), date: t, start: '08:00', end: '15:30', jobId: j1, title: 'Grout + set lights', notes: '' },
    { id: uid(), date: t, start: '16:30', end: '17:00', jobId: j4, title: 'Measure vanity + drain', notes: 'Bring stud finder' },
    { id: uid(), date: d(1), start: '09:00', end: '12:00', jobId: j1, title: 'Finish + caulk, final walkthrough', notes: '' },
    { id: uid(), date: d(2), start: '08:00', end: '16:00', jobId: j2, title: 'Patch + prime', notes: 'Pick up keys at office' },
    { id: uid(), date: d(3), start: '08:00', end: '16:00', jobId: j2, title: 'Paint', notes: '' },
  ];
  const te = (jobId, day, s, e, brk, notes, invoiceId = '') => ({ id: uid(), jobId, start: tsOf(d(day), s), end: tsOf(d(day), e), breakMin: brk, notes, invoiceId });
  const inv1 = uid() + 'i1', inv0 = uid() + 'i0';
  S.time = [
    te(j1, -3, '07:30', '15:00', 30, 'Demo old backsplash, patch'),
    te(j1, -2, '08:00', '16:00', 30, 'Layout + set tile, field'),
    te(j1, -1, '08:00', '13:30', 0, 'Herringbone + cuts'),
    te(j3, -16, '07:00', '16:00', 30, 'Tear-off, joist check', inv1),
    te(j3, -15, '07:00', '16:30', 30, 'Joist sistering, new boards', inv1),
    te(j3, -14, '07:30', '15:30', 30, 'Boards + fascia', inv1),
    te(j3, -11, '08:00', '12:00', 0, 'Rails, cleanup', inv1),
  ];
  S.expenses = [
    { id: uid(), date: d(-3), jobId: j1, kind: 'materials', desc: 'Subway tile 45 sq ft, thinset, spacers', amount: '412.38', miles: '', billable: true, invoiceId: '' },
    { id: uid(), date: d(-2), jobId: j1, kind: 'materials', desc: 'LED under-cabinet kit (3 bars) + driver', amount: '96.50', miles: '', billable: true, invoiceId: '' },
    { id: uid(), date: d(-2), jobId: '', kind: 'fuel', desc: 'Fuel', amount: '58.20', miles: '', billable: false, invoiceId: '' },
    { id: uid(), date: d(-3), jobId: j1, kind: 'mileage', desc: 'Shop → supply house → site', amount: '29.40', miles: '42', billable: false, invoiceId: '' },
    { id: uid(), date: d(-16), jobId: j3, kind: 'materials', desc: 'Trex boards, hidden fasteners, joist tape', amount: '1640.00', miles: '', billable: false, invoiceId: '' },
    { id: uid(), date: d(-20), jobId: '', kind: 'tools', desc: 'Oscillating multi-tool blades (10 pk)', amount: '44.97', miles: '', billable: false, invoiceId: '' },
  ];
  S.invoices = [
    { id: inv1, no: '1001', jobId: j3, clientId: c3, date: d(-9), due: d(5), status: 'sent', paidDate: '', taxPct: '', notes: 'Thank you for your business.', lines: [{ desc: 'Deck board replacement, 220 sq ft (fixed price, materials included)', qty: 1, rate: 4200 }] },
    { id: inv0, no: '1000', jobId: '', clientId: c2, date: d(-38), due: d(-24), status: 'paid', paidDate: d(-27), taxPct: '', notes: '', lines: [{ desc: 'Unit 2A: replace bifold doors (3) and hardware', qty: 1, rate: 950 }] },
  ];
  S.settings.nextInv = 1002;
  S.tasks = [
    { id: uid(), title: 'Order grout: Bright White, unsanded', due: t, cat: 'work', done: false, jobId: j1 },
    { id: uid(), title: 'Call Dunmore about Unit 4B keys', due: d(1), cat: 'work', done: false, jobId: j2 },
    { id: uid(), title: 'Send vanity quote to the Whitfields', due: d(2), cat: 'work', done: false, jobId: j4 },
    { id: uid(), title: 'Renew general liability insurance', due: d(11), cat: 'work', done: false, jobId: '' },
    { id: uid(), title: 'Truck oil change', due: d(-1), cat: 'personal', done: false, jobId: '' },
    { id: uid(), title: 'Pay quarterly estimated taxes', due: d(-5), cat: 'personal', done: true, jobId: '', doneAt: Date.now() - 4e8 },
  ];
  S.habitLog = {};
  for (let i = 1; i <= 6; i++) S.habitLog[d(-i)] = S.habits.filter((h, k) => (i + k) % 3 !== 0).map(h => h.id);

  // Three weeks of push/pull/legs with steady progression.
  const base = { bench: 185, ohp: 115, incline_db: 60, lat_raise: 20, pushdown: 50, row: 155, pullup: 0, cable_row: 130, face_pull: 40, curl: 65, squat: 245, rdl: 205, leg_press: 360, leg_curl: 90, calf_raise: 180 };
  const plan = [[-20, 't_push'], [-19, 't_pull'], [-17, 't_legs'], [-13, 't_push'], [-12, 't_pull'], [-10, 't_legs'], [-6, 't_push'], [-5, 't_pull'], [-3, 't_legs']];
  S.workouts = plan.map(([day, tid], k) => {
    const tpl = TEMPLATES.find(x => x.id === tid);
    const wk = Math.floor(k / 3);
    const start = tsOf(d(day), '17:45');
    const items = tpl.items.map(it => {
      const ex = EXERCISES.find(e => e.id === it.exId);
      const w = base[it.exId] + wk * (ex.bw ? 0 : ex.lower ? 10 : 5);
      const sets = Array.from({ length: it.sets }, (_, j) => {
        const r = wk === 2 && k === 6 && it.exId === 'bench' ? it.hi : Math.max(it.lo, it.hi - j - (wk === 0 ? 1 : 0));
        return { w: String(w), r: String(ex.bw ? r + wk : r), rpe: String(Math.min(9.5, 7 + j * 0.5 + (wk === 2 ? 0.5 : 0))), done: true };
      });
      return { exId: it.exId, lo: it.lo, hi: it.hi, sets };
    });
    return { id: uid() + k, name: tpl.name, templateId: tid, date: d(day), start, end: start + (58 + k % 3 * 6) * 60000, items, hr: k > 5 ? { sum: 128 * 900, n: 900, max: 168 } : null, notes: '' };
  });
  S.body = Array.from({ length: 15 }, (_, i) => ({ date: d(-28 + i * 2), weight: String(Math.round((193 - i * 0.28 + ((i * 7) % 5 - 2) * 0.35) * 10) / 10) }));
  S.sample = true;
  S.welcomed = true;
}
