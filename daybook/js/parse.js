// Natural-language quick add: "Follow up with Mark every Mon and Thu 9am #work" becomes a to-do with a title,
// due date, time, repeat and category. Recognized phrases are removed from the title; anything else stays.
import { today, addDays, parseDate, addMonthsISO, pad, fmtTime, relDay, daysLabel } from './util.js';

const DAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAYRE = '(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
const END = '(?=[\\s,.!?]|$)';
const dayNum = w => DAY[w.toLowerCase().slice(0, 3)];
const nextDow = (dow, strict = false) => { let d = strict ? addDays(today(), 1) : today(); while (parseDate(d).getDay() !== dow) d = addDays(d, 1); return d; };
const hm = (h, m = 0) => `${pad(h)}:${pad(m)}`;
// "at 5" on a to-do almost always means 5pm; "at 9" means 9am.
const guessHour = h => (h >= 1 && h <= 6 ? h + 12 : h);

export function parseTask(text, catKeys = []) {
  let s = ` ${text} `;
  const out = { title: '', due: '', time: '', cat: '', repeat: '', repeatDays: [], focus: false, hasDate: false };
  const take = re => { const m = s.match(re); if (m) s = `${s.slice(0, m.index)} ${s.slice(m.index + m[0].length)}`; return m; };
  let m;

  if ((m = take(new RegExp(`\\s#([\\p{L}\\d][\\p{L}\\d-]*)${END}`, 'iu')))) out.cat = m[1].toLowerCase();
  if (take(/\s(?:!{1,3}|\*)(?=\s)/)) out.focus = true;

  // Repeats
  if ((m = take(new RegExp(`\\s(?:every|each)\\s+(${DAYRE}(?:\\s*(?:,|and|&|\\+)\\s*${DAYRE})*)${END}`, 'i')))
    || (m = take(new RegExp(`\\s(?:on\\s+)?(${DAYRE}s(?:\\s*(?:,|and|&|\\+)\\s*${DAYRE}s)*)${END}`, 'i')))) {
    out.repeat = 'days';
    out.repeatDays = [...new Set(m[1].split(/\s*(?:,|and|&|\+)\s*/i).map(dayNum).filter(x => x !== undefined))];
  } else if (take(/\s(?:twice|2x|2 times) (?:a|per) week(?=\s)/i)) { out.repeat = 'days'; out.repeatDays = [1, 4]; }
  else if (take(/\s(?:three times|3x|3 times) (?:a|per) week(?=\s)/i)) { out.repeat = 'days'; out.repeatDays = [1, 3, 5]; }
  else if (take(/\s(?:every ?day|daily|each day)(?=[\s,.]|$)/i)) out.repeat = 'daily';
  else if (take(/\s(?:every (?:weekday|workday)|weekdays|on weekdays)(?=[\s,.]|$)/i)) out.repeat = 'weekdays';
  else if (take(/\s(?:every other week|every (?:2|two) weeks|biweekly|bi-weekly)(?=[\s,.]|$)/i)) out.repeat = 'biweekly';
  else if (take(/\s(?:every week|weekly)(?=[\s,.]|$)/i)) out.repeat = 'weekly';
  else if (take(/\s(?:every quarter|quarterly|every (?:3|three) months)(?=[\s,.]|$)/i)) out.repeat = 'quarterly';
  else if (take(/\s(?:every month|monthly)(?=[\s,.]|$)/i)) out.repeat = 'monthly';
  else if (take(/\s(?:every year|yearly|annually)(?=[\s,.]|$)/i)) out.repeat = 'yearly';

  // Times
  if ((m = take(/\s(?:at\s+|@\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)(?=[\s,.]|$)/i))) {
    let h = +m[1] % 12;
    if (/^p/i.test(m[3])) h += 12;
    out.time = hm(h, +(m[2] || 0));
  } else if (take(/\s(?:at\s+)?noon(?=[\s,.]|$)/i)) out.time = '12:00';
  else if ((m = take(/\s(?:at|@)\s*(\d{1,2})(?::(\d{2}))?(?=[\s,.]|$)/i)) && +m[1] < 24) out.time = hm(+m[1] > 12 ? +m[1] : guessHour(+m[1]), +(m[2] || 0));
  else if ((m = take(/\s(\d{1,2}):(\d{2})(?=[\s,.]|$)/)) && +m[1] < 24) out.time = hm(+m[1] > 12 ? +m[1] : guessHour(+m[1]), +m[2]);

  // Dates
  const set = d => { out.due = d; out.hasDate = true; };
  if (take(/\s(?:the\s+)?day after tomorrow(?=[\s,.]|$)/i)) set(addDays(today(), 2));
  else if (take(/\s(?:today|tdy)(?=[\s,.]|$)/i)) set(today());
  else if (take(/\s(?:tonight)(?=[\s,.]|$)/i)) { set(today()); out.time = out.time || '19:00'; }
  else if (take(/\s(?:tomorrow|tmrw|tmw|tomorow)(?=[\s,.]|$)/i)) set(addDays(today(), 1));
  else if (take(/\s(?:next week)(?=[\s,.]|$)/i)) set(nextDow(1, true));
  else if (take(/\s(?:this |next )?weekend(?=[\s,.]|$)/i)) set(nextDow(6));
  else if (take(/\s(?:next month)(?=[\s,.]|$)/i)) set(addMonthsISO(today().slice(0, 8) + '01', 1));
  else if ((m = take(/\s(?:in\s+)(\d+|a|an|one|two|three|four|five|six|seven|ten)\s+(day|week|month)s?(?=[\s,.]|$)/i))) {
    const n = NUM[m[1].toLowerCase()] || +m[1];
    set(/month/i.test(m[2]) ? addMonthsISO(today(), n) : addDays(today(), n * (/week/i.test(m[2]) ? 7 : 1)));
  } else if ((m = take(new RegExp(`\\s(?:(?:on|by|due)\\s+)?(next\\s+|this\\s+)?(${DAYRE})${END}`, 'i')))) set(nextDow(dayNum(m[2]), /next/i.test(m[1] || '')));
  else if ((m = take(/\s(?:(?:on|by|due)\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=[\s,.]|$)/))) set(dateFrom(+m[1] - 1, +m[2], m[3]));
  else if ((m = take(new RegExp(`\\s(?:(?:on|by|due)\\s+)?(${MONTHS.join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${END}`, 'i')))) set(dateFrom(MONTHS.indexOf(m[1].toLowerCase()), +m[2]));

  if (out.repeat === 'days' && !out.repeatDays.length) out.repeat = '';
  if (out.repeat === 'days' && !out.hasDate) { let d = today(); while (!out.repeatDays.includes(parseDate(d).getDay())) d = addDays(d, 1); out.due = d; }
  else if ((out.repeat || out.time) && !out.hasDate) out.due = today();
  if (out.cat && catKeys.length && !catKeys.includes(out.cat)) out.newCat = out.cat;

  out.title = s.replace(/\s+/g, ' ').trim().replace(/\s+(?:on|at|by|due|every|for)$/i, '').replace(/^(?:on|at|by)\s+/i, '');
  return out;
}

function dateFrom(month, day, year) {
  const now = parseDate(today());
  let y = year ? (+year < 100 ? 2000 + +year : +year) : now.getFullYear();
  let d = `${y}-${pad(month + 1)}-${pad(day)}`;
  // No year given and the date already passed by more than a month: they mean next year.
  if (!year && d < addDays(today(), -30)) d = `${y + 1}-${pad(month + 1)}-${pad(day)}`;
  return d;
}

export function describe(p, catLabel = k => k) {
  const bits = [];
  if (p.due) bits.push(relDay(p.due));
  if (p.time) bits.push(fmtTime(p.time));
  if (p.repeat) bits.push(p.repeat === 'days' ? `every ${daysLabel(p.repeatDays)}` : { daily: 'every day', weekdays: 'every weekday', weekly: 'every week', biweekly: 'every 2 weeks', monthly: 'every month', quarterly: 'every 3 months', yearly: 'every year' }[p.repeat]);
  if (p.cat) bits.push(p.newCat ? `new category “${p.cat}”` : catLabel(p.cat));
  if (p.focus) bits.push('today\'s focus');
  return bits;
}
