'use strict';
// EMBER DECK — particles (pooled, one canvas), floating numbers and screen shake.
(function (root) {
  const ED = root.ED;
  const F = ED.FX = { calm: false, shakeOn: true, ambient: false };
  const cv = document.getElementById('fx');
  const g = cv.getContext('2d');
  const layer = document.getElementById('fxl');
  const MAX = 420;
  const P = [];
  for (let i = 0; i < MAX; i++) P.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, l: 0, ml: 1, s: 2, c: '#fff', gr: 0, dr: 0.98, glow: false });
  let W = 0, H = 0, dpr = 1, raf = 0, lastT = 0, live = 0, amb = 0;
  function resize() {
    dpr = Math.min(2, root.devicePixelRatio || 1);
    W = root.innerWidth; H = root.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  resize();
  root.addEventListener('resize', resize);
  function spawn(x, y, vx, vy, life, size, col, grav, glow) {
    for (let i = 0; i < MAX; i++) {
      const p = P[i];
      if (p.on) continue;
      p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.l = life; p.ml = life; p.s = size; p.c = col; p.gr = grav || 0; p.glow = !!glow;
      live++;
      return p;
    }
    return null;
  }
  F.burst = function (x, y, n, cols, o) {
    if (F.calm) n = Math.ceil(n / 3);
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 220) * (0.3 + Math.random() * 0.9);
      spawn(x + (Math.random() - 0.5) * (o.spread || 10), y + (Math.random() - 0.5) * (o.spread || 10), Math.cos(a) * sp, Math.sin(a) * sp - (o.up || 0),
        (o.life || 0.6) * (0.6 + Math.random() * 0.7), (o.size || 3) * (0.6 + Math.random() * 0.8), cols[i % cols.length], o.grav === undefined ? 500 : o.grav, o.glow);
    }
    kick();
  };
  F.embers = function (x, y, w, h, n) {
    for (let i = 0; i < n; i++) spawn(x + Math.random() * w, y + Math.random() * h, (Math.random() - 0.5) * 40, -40 - Math.random() * 90, 0.7 + Math.random() * 0.9, 1.5 + Math.random() * 2.5, Math.random() < 0.5 ? '#ffb347' : '#ff6a2a', -20, true);
    kick();
  };
  F.rectOf = function (el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, t: r.top, l: r.left }; };
  F.num = function (el, text, cls, dy) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'fnum ' + (cls || '');
    d.textContent = text;
    d.style.left = (r.left + r.width / 2 + (Math.random() - 0.5) * 16) + 'px';
    d.style.top = (r.top + r.height * 0.35 + (dy || 0)) + 'px';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1150);
  };
  F.shake = function (mag) {
    if (!F.shakeOn || F.calm) return;
    const app = document.getElementById('app');
    const t0 = performance.now(), dur = 260 + mag * 12;
    function step(now) {
      const k = 1 - (now - t0) / dur;
      if (k <= 0) { app.style.transform = ''; return; }
      app.style.transform = 'translate(' + ((Math.random() - 0.5) * mag * k) + 'px,' + ((Math.random() - 0.5) * mag * k) + 'px)';
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };
  F.setAmbient = function (on) { F.ambient = on && !F.calm; kick(); };
  function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (F.ambient && !document.hidden) {
      amb += dt;
      while (amb > 0.22) { amb -= 0.22; spawn(Math.random() * W, H + 6, (Math.random() - 0.5) * 16, -22 - Math.random() * 36, 4 + Math.random() * 4, 1 + Math.random() * 1.8, Math.random() < 0.6 ? '#ff9a4a' : '#ffd08a', -2, true); }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < MAX; i++) {
      const p = P[i];
      if (!p.on) continue;
      p.l -= dt;
      if (p.l <= 0 || p.y < -20) { p.on = false; live--; continue; }
      p.vy += p.gr * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.min(1, p.l / p.ml * 1.6);
      g.globalAlpha = a;
      g.fillStyle = p.c;
      if (p.glow) { g.globalAlpha = a * 0.3; g.beginPath(); g.arc(p.x, p.y, p.s * 3, 0, 6.283); g.fill(); g.globalAlpha = a; }
      g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    g.globalAlpha = 1;
    if (live > 0 || F.ambient) raf = requestAnimationFrame(loop);
  }
})(window);
