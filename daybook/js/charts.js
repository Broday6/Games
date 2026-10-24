// Small SVG line chart drawn to scale: time on x (dates), value on y, faint grid, area fill, emphasized last point.
import { esc, parseDate, fmtShort } from './util.js';

export function lineChart(points, { fmt = v => String(Math.round(v)), avg = null, h = 180, yMin = null, yMax = null, yStep = 0 } = {}) {
  if (points.length < 2) return '<p class="muted small chart-empty">Log this at least twice to see a trend.</p>';
  const W = 600, H = h, L = 44, R = 64, T = 14, B = 26;
  const xs = points.map(p => parseDate(p.x).getTime());
  const ys = points.map(p => p.y).concat(avg ? avg.map(p => p.y) : []);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 === x0) x1 = x0 + 864e5;
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.05);
  const step = yStep || niceStep(span / 2);
  lo = yMin ?? Math.floor((lo - span * 0.08) / step) * step;
  hi = yMax ?? Math.ceil((hi + span * 0.08) / step) * step;
  const sx = t => L + (t - x0) / (x1 - x0) * (W - L - R);
  const sy = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  const pts = points.map((p, i) => [sx(xs[i]), sy(p.y)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${sy(lo).toFixed(1)}L${pts[0][0].toFixed(1)},${sy(lo).toFixed(1)}Z`;
  const avgPath = avg && avg.length > 1 ? avg.map((p, i) => `${i ? 'L' : 'M'}${sx(parseDate(p.x).getTime()).toFixed(1)},${sy(p.y).toFixed(1)}`).join('') : '';
  const last = pts[pts.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend from ${esc(fmtShort(points[0].x))} to ${esc(fmtShort(points[points.length - 1].x))}, latest ${esc(fmt(points[points.length - 1].y))}">
    ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="axis" x="${L - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
    <path class="area" d="${area}"/>
    ${avgPath ? `<path class="avg" d="${avgPath}"/>` : ''}
    <path class="line" d="${line}"/>
    ${pts.slice(0, -1).map(p => `<circle class="dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join('')}
    <circle class="dot last" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5"/>
    <text class="end-label" x="${(last[0] + 9).toFixed(1)}" y="${(last[1] + 4).toFixed(1)}">${esc(fmt(points[points.length - 1].y))}</text>
    <text class="axis" x="${L}" y="${H - 6}">${esc(fmtShort(points[0].x))}</text>
    <text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${esc(fmtShort(points[points.length - 1].x))}</text>
  </svg>`;
}

function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
