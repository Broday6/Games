// DICE DEN — procedural 3D-looking dice on canvas (quaternion cube, lit faces, tumbling roll).
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const DPR = () => Math.min(3, window.devicePixelRatio || 1);

  // ---- quaternion helpers [w,x,y,z]
  const qAxis = (ax, ay, az, a) => { const l = Math.hypot(ax, ay, az) || 1, s = Math.sin(a / 2); return [Math.cos(a / 2), ax / l * s, ay / l * s, az / l * s]; };
  const qMul = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
  const qRot = (q, v) => {
    const [w, x, y, z] = q;
    const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2];
    const iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  };

  // Face value -> normal and in-plane axes (opposites sum to 7)
  const FACES = {
    1: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    6: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
    2: { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    5: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    3: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    4: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  };
  // Rotation bringing face f to the viewer (+z)
  const TO_FRONT = {
    1: [1, 0, 0, 0], 6: qAxis(1, 0, 0, Math.PI), 2: qAxis(0, 1, 0, -Math.PI / 2),
    5: qAxis(0, 1, 0, Math.PI / 2), 3: qAxis(1, 0, 0, Math.PI / 2), 4: qAxis(1, 0, 0, -Math.PI / 2),
  };
  const TILT = qMul(qAxis(1, 0, 0, -0.4), qAxis(0, 1, 0, 0.1));
  const LIGHT = (() => { const l = [-0.3, -0.5, 0.95], m = Math.hypot(...l); return l.map((x) => x / m); })();
  const PIPS = {
    1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  const THEMES = {
    ivory: { face: [250, 244, 230], edge: [196, 182, 160], pip: '#1d1530', one: '#c8193c' },
    ruby: { face: [226, 44, 84], edge: [130, 14, 44], pip: '#fff6e8', one: '#ffd66b' },
    teal: { face: [32, 201, 182], edge: [10, 104, 98], pip: '#08201f', one: '#a0005a' },
    violet: { face: [150, 92, 255], edge: [76, 34, 160], pip: '#fff6e8', one: '#ffd66b' },
    gold: { face: [255, 204, 77], edge: [176, 120, 18], pip: '#2a1a00', one: '#c8193c' },
    sky: { face: [80, 170, 255], edge: [24, 82, 168], pip: '#fff', one: '#ffd66b' },
    lime: { face: [160, 232, 70], edge: [80, 140, 20], pip: '#122000', one: '#c8193c' },
    coal: { face: [58, 52, 74], edge: [24, 20, 34], pip: '#f5c542', one: '#f5c542' },
  };
  const THEME_LIST = ['ruby', 'teal', 'violet', 'gold', 'sky', 'lime'];

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const rgb = (c, k) => `rgb(${Math.round(Math.min(255, c[0] * k))},${Math.round(Math.min(255, c[1] * k))},${Math.round(Math.min(255, c[2] * k))})`;

  function drawPips(ctx, value, th, flat) {
    const pts = PIPS[value];
    const r = value === 1 ? 0.26 : 0.17;
    for (const [px, py] of pts) {
      const x = px * 0.52, y = py * 0.52;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = value === 1 ? th.one : th.pip; ctx.fill();
      if (!flat) {
        ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
      }
    }
  }

  // Draw a cube with orientation q at (cx,cy) with half-size h onto ctx.
  function drawCube(ctx, q, cx, cy, h, th, value, glow) {
    const qq = qMul(TILT, q);
    const faces = [];
    for (let f = 1; f <= 6; f++) {
      const F = FACES[f];
      const n = qRot(qq, F.n);
      if (n[2] <= 0.02) continue;
      faces.push({ f, n, u: qRot(qq, F.u), v: qRot(qq, F.v), z: n[2] });
    }
    faces.sort((a, b) => a.z - b.z);
    // body silhouette with rounded joins (bevels)
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const p = qRot(qq, [sx, sy, sz]); corners.push([cx + p[0] * h, cy + p[1] * h]);
    }
    const hull = convexHull(corners);
    ctx.save();
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = h * 0.9; }
    ctx.beginPath(); hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = h * 0.22; ctx.strokeStyle = rgb(th.edge, 0.85); ctx.fillStyle = rgb(th.edge, 0.85);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    for (const F of faces) {
      const lit = Math.max(0, F.n[0] * LIGHT[0] + F.n[1] * LIGHT[1] + F.n[2] * LIGHT[2]);
      const k = 0.55 + 0.52 * lit;
      const ox = cx + F.n[0] * h, oy = cy + F.n[1] * h;
      ctx.save();
      ctx.setTransform(...curT(ctx, F.u[0] * h, F.u[1] * h, F.v[0] * h, F.v[1] * h, ox, oy));
      rr(ctx, -0.9, -0.9, 1.8, 1.8, 0.42);
      const g = ctx.createLinearGradient(-1, -1, 1, 1);
      g.addColorStop(0, rgb(th.face, k * 1.08)); g.addColorStop(1, rgb(th.face, k * 0.9));
      ctx.fillStyle = g; ctx.fill();
      if (F.z > 0.25) drawPips(ctx, F.f, th, false);
      if (F.z < 0.9) { // darken grazing faces a touch more for depth
        ctx.globalAlpha = (0.9 - F.z) * 0.35; ctx.fillStyle = '#000'; rr(ctx, -0.9, -0.9, 1.8, 1.8, 0.42); ctx.fill();
      }
      ctx.restore();
    }
  }
  // compose with the context's base transform (DPR scale)
  function curT(ctx, a, b, c, d, e, f) {
    const s = ctx._dpr || 1;
    return [a * s, b * s, c * s, d * s, e * s, f * s];
  }
  function convexHull(pts) {
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }

  // ---- animation loop shared by all dice
  const active = new Set();
  let raf = 0;
  function loop(now) {
    raf = 0;
    for (const d of Array.from(active)) d._frame(now);
    if (active.size) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  const opts = { speed: 1, reduced: false, onBounce: null };

  class Die {
    constructor(size, theme) {
      this.size = size;
      this.theme = THEMES[theme] ? theme : 'ivory';
      this.value = 1 + Math.floor(Math.random() * 6);
      this.yaw = (Math.random() - 0.5) * 0.6;
      this.el = document.createElement('canvas');
      this.el.className = 'die';
      this.glow = null;
      this._resize();
      this.q = this._target();
      this.height = 0;
      this.draw();
    }
    _resize() {
      const dpr = DPR();
      this.el.width = Math.round(this.size * dpr); this.el.height = Math.round(this.size * dpr);
      this.el.style.width = this.size + 'px'; this.el.style.height = this.size + 'px';
      this.ctx = this.el.getContext('2d'); this.ctx._dpr = dpr;
    }
    setSize(s) { if (s !== this.size) { this.size = s; this._resize(); this.draw(); } }
    setTheme(t) { this.theme = THEMES[t] ? t : 'ivory'; this.draw(); }
    _target() { return qMul(qAxis(0, 0, 1, this.yaw), TO_FRONT[this.value]); }
    set(v, yaw) { this.value = v; if (yaw != null) this.yaw = yaw; this.q = this._target(); this.height = 0; this.draw(); return this; }
    setGlow(c) { this.glow = c; this.draw(); }
    draw() {
      const ctx = this.ctx, S = this.size, dpr = ctx._dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      const h = S * 0.25;
      const lift = this.height;
      // shadow
      const sh = Math.max(0.15, 1 - lift / (S * 0.3));
      const g = ctx.createRadialGradient(S / 2 + h * 0.15, S / 2 + h * 0.85, 1, S / 2 + h * 0.15, S / 2 + h * 0.85, h * 1.55);
      g.addColorStop(0, `rgba(0,0,0,${0.5 * sh})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(S / 2 + h * 0.15, S / 2 + h * 0.85, h * 1.55, h * 0.75, 0, 0, TAU); ctx.fill();
      const scale = 1 + lift / S * 0.5;
      drawCube(ctx, this.q, S / 2, S / 2 - lift * 0.6, h * scale, THEMES[this.theme], this.value, this.glow);
    }
    // Tumble to value. Returns a promise resolved when settled.
    roll(v, o) {
      o = o || {};
      this.value = v;
      if (o.yaw != null) this.yaw = o.yaw; else this.yaw = (Math.random() - 0.5) * 0.7;
      const target = this._target();
      const dur = (o.dur || 950) * opts.speed * (opts.reduced ? 0.2 : 1) * (0.85 + Math.random() * 0.3);
      if (this._resolve) this._resolve();
      return new Promise((res) => {
        this._anim = {
          t0: performance.now() + (o.delay || 0) * opts.speed, dur, target,
          axis: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5],
          spin: opts.reduced ? 0 : TAU * (1.5 + Math.random() * 1.5),
          dx: opts.reduced ? 0 : (o.dx != null ? o.dx : (Math.random() - 0.5) * this.size * 1.6),
          dy: opts.reduced ? 0 : (o.dy != null ? o.dy : -this.size * (0.4 + Math.random() * 0.5)),
          bounced: 0,
        };
        this._resolve = res;
        active.add(this); kick();
      });
    }
    _frame(now) {
      const a = this._anim;
      if (!a) { active.delete(this); return; }
      let t = (now - a.t0) / a.dur;
      if (t < 0) return;
      if (t >= 1) {
        this._anim = null; active.delete(this);
        this.q = a.target; this.height = 0; this.el.style.transform = '';
        this.draw();
        const r = this._resolve; this._resolve = null; if (r) r();
        return;
      }
      const e = 1 - Math.pow(1 - t, 3);
      this.q = qMul(a.target, qAxis(a.axis[0], a.axis[1], a.axis[2], a.spin * (1 - e)));
      const bounce = Math.abs(Math.cos(t * Math.PI * 2.5)) * Math.pow(1 - t, 1.6);
      this.height = bounce * this.size * 0.3;
      const contacts = Math.floor(t * 2.5 + 0.5);
      if (contacts > a.bounced) { a.bounced = contacts; if (opts.onBounce) opts.onBounce(Math.pow(1 - t, 1.2)); }
      this.el.style.transform = `translate(${a.dx * (1 - e)}px, ${a.dy * (1 - e)}px)`;
      this.draw();
    }
  }

  // Flat face icon (for bid wheels, history, rules). Cached as data URLs.
  const iconCache = {};
  function faceIcon(v, size, theme) {
    theme = theme || 'ivory';
    const key = v + ':' + size + ':' + theme;
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas'), dpr = DPR();
    c.width = c.height = Math.round(size * dpr);
    const ctx = c.getContext('2d');
    const th = THEMES[theme];
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, rgb(th.face, 1.05)); g.addColorStop(1, rgb(th.face, 0.82));
    rr(ctx, 1, 1, size - 2, size - 2, size * 0.22); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, size * 0.04); ctx.strokeStyle = rgb(th.edge, 1); ctx.stroke();
    ctx.translate(size / 2, size / 2); ctx.scale(size * 0.4, size * 0.4);
    drawPips(ctx, v, th, true);
    return (iconCache[key] = c.toDataURL());
  }

  window.DDDice = { Die, faceIcon, opts, THEMES, THEME_LIST };
})();
