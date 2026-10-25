'use strict';
// DEEP CAST — procedural fish renderer. drawFish(ctx, species, x, y, length, opts)
// opts: flip (face left), sil (silhouette colour), t (time), wig (wiggle amount), sx (horizontal squash for spin),
//       rot (radians), glowSil (let glow bits show through silhouettes), aura (legendary aura on/off, default on)

const FishArt = (() => {
  const PROF = {
    fusi:     { a: .55, b: .38, tb: -.34, min: .13 },
    deep:     { a: .75, b: .5,  tb: -.31, min: .15 },
    hatchet:  { a: 1.3, b: .3,  tb: -.3,  min: .1, asym: 1.7 },
    shark:    { a: .62, b: .6,  tb: -.3,  min: .1 },
    longtail: { a: 2.2, b: .35, tb: -.5,  min: .0 },
    eel:      { a: .22, b: .2,  tb: -.5,  min: 0, wave: 1 },
    angler:   { a: 1.1, b: .14, tb: -.3,  min: .16, asym: 1.15 },
    flat:     { a: .65, b: .6,  tb: -.3,  min: .14 },
  };
  const N = 26;

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function profMax(a, b) { const u = a / (a + b); return Math.pow(u, a) * Math.pow(1 - u, b); }

  // Build body sample points
  function body(sp, L, t, wig) {
    const a = sp.a, P = PROF[a.sh] || PROF.fusi, H = L * (a.h || .3);
    const mx = profMax(P.a, P.b), tb = P.tb;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = L * (tb + u * (.5 - tb));
      let p = Math.pow(u, P.a) * Math.pow(1 - u, P.b) / mx;
      p = Math.max(P.min, p);
      if (i === N) p = P.min * .5;
      const half = p * H / 2;
      let yc;
      if (P.wave) yc = Math.sin(u * 7.5 - t * 7) * H * .55 * (1 - u * .75) * wig;
      else yc = wig * H * .22 * Math.pow(1 - u, 3) * Math.sin(t * 8);
      pts.push({ u, x, yc, half, top: yc - half, bot: yc + half * (P.asym || 1) });
    }
    return { pts, H, P };
  }
  function at(B, u) { // interpolate sample at u
    const f = Math.max(0, Math.min(1, u)) * N, i = Math.min(N - 1, Math.floor(f)), k = f - i, p = B.pts[i], q = B.pts[i + 1];
    return { x: p.x + (q.x - p.x) * k, yc: p.yc + (q.yc - p.yc) * k, half: p.half + (q.half - p.half) * k, top: p.top + (q.top - p.top) * k, bot: p.bot + (q.bot - p.bot) * k };
  }
  function bodyPath(ctx, B) {
    const pts = B.pts;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].top);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      ctx.quadraticCurveTo(p.x, p.top, (p.x + q.x) / 2, (p.top + q.top) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.quadraticCurveTo(last.x + B.H * .06, (last.top + last.bot) / 2, last.x, last.bot);
    for (let i = pts.length - 2; i >= 0; i--) {
      const p = pts[i + 1], q = pts[i];
      ctx.quadraticCurveTo(p.x, p.bot, (p.x + q.x) / 2, (p.bot + q.bot) / 2);
    }
    ctx.lineTo(pts[0].x, pts[0].bot);
    ctx.closePath();
  }

  function tailPath(ctx, type, tl, th, h0) {
    ctx.beginPath();
    switch (type) {
      case 'lunate':
        ctx.moveTo(0, -h0); ctx.quadraticCurveTo(-tl * .5, -th * .5, -tl * 1.1, -th * 1.25);
        ctx.quadraticCurveTo(-tl * .55, -th * .2, -tl * .38, 0);
        ctx.quadraticCurveTo(-tl * .55, th * .2, -tl * 1.1, th * 1.25);
        ctx.quadraticCurveTo(-tl * .5, th * .5, 0, h0); break;
      case 'round':
        ctx.moveTo(0, -h0); ctx.bezierCurveTo(-tl * .5, -th * 1.1, -tl * 1.15, -th * .7, -tl * 1.1, 0);
        ctx.bezierCurveTo(-tl * 1.15, th * .7, -tl * .5, th * 1.1, 0, h0); break;
      case 'square':
        ctx.moveTo(0, -h0); ctx.lineTo(-tl, -th); ctx.quadraticCurveTo(-tl * .88, 0, -tl, th); ctx.lineTo(0, h0); break;
      case 'shark':
        ctx.moveTo(0, -h0); ctx.quadraticCurveTo(-tl * .6, -th * .7, -tl * 1.35, -th * 1.6);
        ctx.quadraticCurveTo(-tl * .7, -th * .3, -tl * .55, th * .1);
        ctx.lineTo(-tl * .8, th * .8); ctx.quadraticCurveTo(-tl * .35, th * .45, 0, h0); break;
      case 'point':
        ctx.moveTo(0, -h0 - th * .35); ctx.quadraticCurveTo(-tl * .7, -th * .25, -tl * 1.2, 0);
        ctx.quadraticCurveTo(-tl * .7, th * .25, 0, h0 + th * .35); break;
      default: // fork
        ctx.moveTo(0, -h0); ctx.quadraticCurveTo(-tl * .55, -th * .45, -tl, -th);
        ctx.quadraticCurveTo(-tl * .45, -th * .05, -tl * .52, 0);
        ctx.quadraticCurveTo(-tl * .45, th * .05, -tl, th);
        ctx.quadraticCurveTo(-tl * .55, th * .45, 0, h0);
    }
    ctx.closePath();
  }

  function eye(ctx, x, y, r, sil) {
    if (sil || r <= 0) return;
    ctx.fillStyle = '#f3ecd2'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#121218'; ctx.beginPath(); ctx.arc(x + r * .12, y, r * .66, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x + r * .32, y - r * .3, r * .24, 0, 7); ctx.fill();
  }

  function glowDot(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, col); g.addColorStop(.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 7); ctx.fill();
  }

  function patterns(ctx, sp, B, L, sil) {
    const a = sp.a; if (sil || !a.pat) return;
    const H = B.H, R = rng(hash(sp.id));
    ctx.save();
    switch (a.pat) {
      case 'stripeH': {
        ctx.strokeStyle = a.pc; ctx.lineWidth = Math.max(1, H * .07); ctx.lineCap = 'round';
        for (const f of [-.42, -.05]) {
          ctx.beginPath();
          for (let i = 2; i <= N - 3; i++) { const p = B.pts[i]; const y = p.yc + p.half * f; i === 2 ? ctx.moveTo(p.x, y) : ctx.lineTo(p.x, y); }
          ctx.stroke();
        }
        break;
      }
      case 'stripeV': {
        ctx.strokeStyle = a.pc; ctx.lineWidth = Math.max(1, L * .04);
        for (let u = .22; u < .82; u += .12) { const p = at(B, u); ctx.beginPath(); ctx.moveTo(p.x, p.top - 2); ctx.lineTo(p.x - L * .02, p.yc + p.half * .4); ctx.stroke(); }
        break;
      }
      case 'bands': {
        ctx.strokeStyle = a.pc; ctx.lineWidth = Math.max(1, L * .018); ctx.lineJoin = 'round';
        for (let u = .12; u < .82; u += .075) {
          const p = at(B, u); ctx.beginPath(); ctx.moveTo(p.x, p.top - 1);
          const n = 4; for (let k = 1; k <= n; k++) { const y = p.top + (p.half * 1.05) * k / n; ctx.lineTo(p.x + (k % 2 ? L * .025 : -L * .01), y); }
          ctx.stroke();
        }
        break;
      }
      case 'spots': case 'mottle': {
        const big = a.pat === 'mottle';
        ctx.fillStyle = a.pc; ctx.globalAlpha = big ? .55 : .9;
        const n = big ? 12 : 22;
        for (let i = 0; i < n; i++) {
          const u = .08 + R() * .82, f = -.85 + R() * 1.4, p = at(B, u);
          const r = H * (big ? .07 + R() * .1 : .025 + R() * .045);
          ctx.beginPath(); ctx.ellipse(p.x, p.yc + p.half * f, r * (big ? 1.4 : 1), r, R() * 3, 0, 7); ctx.fill();
        }
        break;
      }
      case 'scales': {
        ctx.strokeStyle = a.pc; ctx.lineWidth = Math.max(.6, L * .006);
        const s = Math.max(3, H * .13);
        for (let u = .12; u < .78; u += s / L * 1.1) {
          const p = at(B, u);
          for (let y = p.top + s; y < p.bot - s * .5; y += s) { ctx.beginPath(); ctx.arc(p.x, y, s * .6, -1.2, 1.2); ctx.stroke(); }
        }
        break;
      }
      case 'sheep': {
        ctx.fillStyle = a.pc;
        const h = at(B, .72), tt = at(B, .24);
        ctx.fillRect(h.x, -H, L, H * 2); ctx.fillRect(-L, -H, tt.x + L, H * 2);
        ctx.fillStyle = '#f4f1ea'; const c = at(B, .97); ctx.beginPath(); ctx.ellipse(c.x - L * .02, c.yc + c.half * .5, L * .05, H * .12, 0, 0, 7); ctx.fill();
        break;
      }
      case 'dots': {
        for (let u = .14; u < .86; u += .07) { const p = at(B, u); glowDot(ctx, p.x, p.yc + p.half * .62, Math.max(.8, H * .035), a.pc); }
        for (let u = .3; u < .7; u += .1) { const p = at(B, u); glowDot(ctx, p.x, p.yc + p.half * .1, Math.max(.6, H * .025), a.pc); }
        break;
      }
      case 'cracks': {
        ctx.strokeStyle = a.pc; ctx.lineWidth = Math.max(.8, L * .012); ctx.shadowColor = a.pc; ctx.shadowBlur = 6; ctx.lineJoin = 'round';
        for (let i = 0; i < 6; i++) {
          let u = .12 + R() * .7, f = -.7 + R() * 1.3; let p = at(B, u);
          ctx.beginPath(); ctx.moveTo(p.x, p.yc + p.half * f);
          for (let k = 0; k < 4; k++) { u += (R() - .3) * .09; f += (R() - .5) * .6; p = at(B, u); ctx.lineTo(p.x, p.yc + p.half * f); }
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  function fin(ctx, col, sil) { ctx.fillStyle = sil || col; ctx.fill(); }

  function drawGeneric(ctx, sp, L, o) {
    const a = sp.a, x = a.x || [], sil = o.sil, t = o.t || 0, wig = o.wig == null ? 1 : o.wig;
    const B = body(sp, L, t, wig), H = B.H, P = B.P;
    const finCol = a.f;
    // ---- tail ----
    const p0 = B.pts[0], p1 = B.pts[2];
    const tl = Math.max(L * (.5 + P.tb), L * .09), th = Math.max(H * .48, L * .07) * (a.tail === 'point' ? .45 : 1);
    ctx.save(); ctx.translate(p0.x, p0.yc);
    ctx.rotate(Math.atan2(p1.yc - p0.yc, p1.x - p0.x) + (P.wave ? 0 : Math.sin(t * 8 + 1.2) * .22 * wig));
    tailPath(ctx, a.tail || 'fork', tl, th, Math.max(p0.half, H * .03)); fin(ctx, finCol, sil);
    ctx.restore();
    // ---- dorsal ----
    const dor = a.dor || 0;
    if (dor > 0 || x.includes('fringe')) {
      let u1 = .36, u2 = .7, dh = H * .5 * dor;
      if (a.dt === 'long') { u1 = .12; u2 = .93; dh = H * .42 * dor; }
      if (a.dt === 'sail') { u1 = .38; u2 = .82; dh = H * 1.15 * dor; }
      if (x.includes('fringe')) { u1 = .08; u2 = .9; dh = H * .16; }
      const A = at(B, u1), Bq = at(B, u2), pk = at(B, u2 - (u2 - u1) * (a.dt === 'long' || x.includes('fringe') ? .5 : .22));
      ctx.beginPath(); ctx.moveTo(A.x, A.top + 1);
      ctx.quadraticCurveTo(A.x + (pk.x - A.x) * .4, pk.top - dh * .9, pk.x, pk.top - dh);
      ctx.quadraticCurveTo(Bq.x - (Bq.x - pk.x) * .3, pk.top - dh * .6, Bq.x, Bq.top + 1);
      ctx.closePath(); fin(ctx, finCol, sil);
      if (a.dt === 'spiny' && !sil) {
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(.5, L * .006);
        for (let k = 0; k <= 5; k++) { const p = at(B, u1 + (u2 - u1) * k / 5); ctx.beginPath(); ctx.moveTo(p.x, p.top); ctx.lineTo(p.x - L * .02, p.top - dh * (.4 + .5 * Math.sin(k / 5 * 3))); ctx.stroke(); }
      }
    }
    // ---- anal / bottom fringe ----
    {
      let u1 = .18, u2 = .38, dh = H * .26;
      if (x.includes('fringe')) { u1 = .08; u2 = .85; dh = H * .14; }
      if (a.sh === 'eel' || a.sh === 'longtail') { u1 = .02; u2 = .5; dh = H * .22; }
      const A = at(B, u1), Bq = at(B, u2), pk = at(B, (u1 + u2) / 2);
      ctx.beginPath(); ctx.moveTo(A.x, A.bot - 1); ctx.quadraticCurveTo(pk.x - L * .03, pk.bot + dh * 1.3, Bq.x, Bq.bot - 1); ctx.closePath(); fin(ctx, finCol, sil);
      if (a.sh === 'eel' || a.sh === 'longtail') { // matching top fringe
        const A2 = at(B, .02), B2 = at(B, .62), pk2 = at(B, .32);
        ctx.beginPath(); ctx.moveTo(A2.x, A2.top + 1); ctx.quadraticCurveTo(pk2.x - L * .03, pk2.top - dh * 1.3, B2.x, B2.top + 1); ctx.closePath(); fin(ctx, finCol, sil);
      }
    }
    // finlets
    if (x.includes('finlets')) {
      for (let u = .05; u < .24; u += .045) { const p = at(B, u); ctx.beginPath(); ctx.moveTo(p.x - L * .012, p.top + .5); ctx.lineTo(p.x, p.top - H * .1); ctx.lineTo(p.x + L * .012, p.top + .5); ctx.moveTo(p.x - L * .012, p.bot - .5); ctx.lineTo(p.x, p.bot + H * .1); ctx.lineTo(p.x + L * .012, p.bot - .5); fin(ctx, a.f, sil); }
    }
    // leafy appendages (behind body)
    if (x.includes('leafy')) {
      for (let k = 0; k < 7; k++) {
        const u = .1 + k * .12, p = at(B, u), up = k % 2 === 0, sway = Math.sin(t * 3 + k) * .3;
        const by = up ? p.top : p.bot, len = H * (1.1 + (k % 3) * .3) * (a.sh === 'deep' ? .5 : 1);
        ctx.save(); ctx.translate(p.x, by); ctx.rotate((up ? -1 : 1) * (.4 + sway) + (up ? 0 : 0));
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, (up ? -1 : 1) * len * .2, len * .1, (up ? -1 : 1) * len);
        ctx.quadraticCurveTo(-len * .3, (up ? -1 : 1) * len * .4, 0, 0); fin(ctx, a.f, sil); ctx.restore();
      }
    }
    // ---- body ----
    ctx.save();
    const aura = x.includes('crown') && !sil && o.aura !== false;
    if (aura) { ctx.shadowColor = a.glow || '#fff'; ctx.shadowBlur = 18 * (o.auraScale || 1); }
    bodyPath(ctx, B);
    if (sil) ctx.fillStyle = sil;
    else {
      const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2 * (P.asym || 1));
      g.addColorStop(0, a.c); g.addColorStop(.45, a.c); g.addColorStop(1, a.bl); ctx.fillStyle = g;
    }
    ctx.fill();
    ctx.restore();
    if (!sil) {
      ctx.save(); bodyPath(ctx, B); ctx.clip();
      patterns(ctx, sp, B, L, sil);
      // soft top highlight
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.beginPath(); for (let i = 3; i < N - 2; i++) { const p = B.pts[i]; ctx.lineTo(p.x, p.top + p.half * .35); } ctx.lineTo(B.pts[N - 3].x, B.pts[N - 3].top - 4); ctx.lineTo(B.pts[3].x, B.pts[3].top - 4); ctx.fill();
      // gill arc
      const g = at(B, a.sh === 'angler' ? .62 : .74);
      ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = Math.max(.6, L * .008);
      ctx.beginPath(); ctx.moveTo(g.x, g.yc - g.half * .7); ctx.quadraticCurveTo(g.x + L * .035, g.yc, g.x, g.yc + g.half * .7); ctx.stroke();
      ctx.restore();
      bodyPath(ctx, B); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = Math.max(.6, L * .01); ctx.stroke();
    }
    // frill
    if (x.includes('frill')) {
      for (let k = 0; k < 5; k++) { const p = at(B, .66 + k * .025); ctx.beginPath(); ctx.ellipse(p.x, p.yc, L * .012, p.half * 1.05, 0, 0, 7); ctx.fillStyle = sil || (k % 2 ? '#c8486a' : '#e2708a'); ctx.fill(); }
    }
    // ---- pectoral fin / wings ----
    const pc = at(B, .66);
    if (x.includes('wings')) {
      ctx.save(); ctx.translate(pc.x, pc.yc); ctx.rotate(-.25 + Math.sin(t * 6) * .12);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-L * .2, -H * 1.6, -L * .55, -H * .9); ctx.quadraticCurveTo(-L * .35, -H * .3, 0, H * .1); ctx.closePath();
      ctx.fillStyle = sil || 'rgba(160,210,255,.75)'; ctx.fill();
      if (!sil) { ctx.strokeStyle = 'rgba(40,80,140,.5)'; ctx.lineWidth = Math.max(.5, L * .006); for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-L * .12 * k, -H * (1.35 - k * .1)); ctx.stroke(); } }
      ctx.restore();
    } else if (a.sh !== 'eel' || x.includes('frill')) {
      ctx.save(); ctx.translate(pc.x, pc.yc + pc.half * .25); ctx.rotate(.5 + Math.sin(t * 6 + 2) * .25 * wig);
      ctx.beginPath(); ctx.ellipse(-L * .045, 0, L * .06, H * .1, 0, 0, 7);
      ctx.fillStyle = sil || a.f; ctx.globalAlpha = sil ? 1 : .85; ctx.fill(); ctx.restore();
    }
    // ---- head details ----
    const nose = B.pts[N], hd = at(B, a.sh === 'angler' ? .8 : .86);
    if (x.includes('bill')) {
      ctx.beginPath(); ctx.moveTo(nose.x - L * .02, nose.yc - H * .06); ctx.lineTo(nose.x + L * .36, nose.yc + H * .02); ctx.lineTo(nose.x - L * .02, nose.yc + H * .08); ctx.closePath();
      ctx.fillStyle = sil || '#2a3046'; ctx.fill();
    }
    if (x.includes('bigmouth') || a.sh === 'angler') {
      const j = at(B, a.sh === 'angler' ? .72 : .8);
      ctx.beginPath(); ctx.moveTo(nose.x + L * .01, nose.yc - nose.half * .2 - H * .05); ctx.lineTo(j.x, j.yc + j.half * .15); ctx.lineTo(nose.x + L * .02, nose.yc + H * .3); ctx.closePath();
      ctx.fillStyle = sil || '#16090f'; ctx.fill();
      if (x.includes('teeth') && !sil) {
        ctx.fillStyle = '#f4f0e0';
        for (let k = 0; k < 5; k++) { const f = k / 5, tx = nose.x + (j.x - nose.x) * f * .9; const ty = nose.yc - H * .05 + (j.yc + j.half * .15 - nose.yc + H * .05) * f; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - L * .008, ty + H * .1); ctx.lineTo(tx - L * .018, ty); ctx.fill(); }
      }
    } else if (!sil) {
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = Math.max(.6, L * .008);
      ctx.beginPath(); ctx.moveTo(nose.x, nose.yc + H * .03); ctx.lineTo(nose.x - L * .05, nose.yc + H * .06); ctx.stroke();
      if (x.includes('teeth')) { ctx.fillStyle = '#f4f0e0'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(nose.x - L * .012 * k, nose.yc + H * .04); ctx.lineTo(nose.x - L * .012 * k - L * .006, nose.yc + H * .1); ctx.lineTo(nose.x - L * .012 * k - L * .012, nose.yc + H * .04); ctx.fill(); } }
    }
    if (x.includes('whisk')) {
      ctx.strokeStyle = sil || a.f; ctx.lineWidth = Math.max(.7, L * .008);
      ctx.beginPath(); ctx.moveTo(nose.x - L * .05, nose.yc + nose.half + H * .05); ctx.quadraticCurveTo(nose.x - L * .02, nose.yc + H * .4, nose.x - L * .08, nose.yc + H * .45); ctx.stroke();
    }
    if (x.includes('tube')) {
      ctx.beginPath(); ctx.ellipse(hd.x - L * .03, hd.top + H * .05, L * .1, H * .32, 0, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = sil ? sil : 'rgba(190,255,230,.28)'; ctx.fill();
      if (!sil) { ctx.strokeStyle = 'rgba(220,255,240,.6)'; ctx.lineWidth = Math.max(.6, L * .006); ctx.stroke(); glowDot(ctx, hd.x - L * .05, hd.top - H * .1, Math.max(1, H * .05), '#5dff8a'); glowDot(ctx, hd.x, hd.top - H * .1, Math.max(1, H * .05), '#5dff8a'); }
    }
    if (x.includes('lure')) {
      const sway = Math.sin(t * 2.2) * L * .03;
      const bx = nose.x + L * .14 + sway, by = hd.top - H * .55;
      ctx.strokeStyle = sil || a.f; ctx.lineWidth = Math.max(.8, L * .012);
      ctx.beginPath(); ctx.moveTo(hd.x - L * .03, hd.top + 1); ctx.quadraticCurveTo(hd.x + L * .02, by - H * .4, bx, by); ctx.stroke();
      if (!sil || o.glowSil) glowDot(ctx, bx, by, Math.max(1.5, L * .025), a.glow || '#b0ffef');
    }
    if (x.includes('tailglow') && (!sil || o.glowSil)) glowDot(ctx, p0.x - tl * .8, p0.yc, Math.max(1.2, L * .015), a.glow || '#ff6ad5');
    if (!sil || o.glowSil) if (a.pat === 'dots' && sil) { for (let u = .2; u < .85; u += .13) { const p = at(B, u); glowDot(ctx, p.x, p.yc + p.half * .6, Math.max(.6, H * .03), a.pc); } }
    eye(ctx, hd.x, hd.yc - hd.half * .3, Math.max(1.1, H * .085 * (a.eye == null ? 1 : a.eye)), sil);
    if (x.includes('crown') && !sil) crownSparkles(ctx, sp, L, H, t);
  }

  function crownSparkles(ctx, sp, L, H, t) {
    ctx.save(); ctx.fillStyle = sp.a.glow || '#fff';
    for (let k = 0; k < 5; k++) {
      const ph = t * 1.3 + k * 1.7, s = (Math.sin(ph) + 1) / 2;
      const sx = Math.cos(k * 2.4) * L * .42, sy = Math.sin(k * 2.4) * H * .9;
      ctx.globalAlpha = s; const r = Math.max(1.2, L * .018) * s;
      ctx.beginPath(); ctx.moveTo(sx, sy - r * 2); ctx.lineTo(sx + r * .5, sy); ctx.lineTo(sx, sy + r * 2); ctx.lineTo(sx - r * .5, sy); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx - r * 2, sy); ctx.lineTo(sx, sy + r * .5); ctx.lineTo(sx + r * 2, sy); ctx.lineTo(sx, sy - r * .5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawPuff(ctx, sp, L, o) {
    const a = sp.a, sil = o.sil, t = o.t || 0, R = L * .32, cx = L * .06;
    // tail
    ctx.save(); ctx.translate(cx - R * .92, 0); ctx.rotate(Math.sin(t * 9) * .3);
    tailPath(ctx, 'round', L * .16, R * .45, R * .15); fin(ctx, a.f, sil); ctx.restore();
    // spikes
    ctx.strokeStyle = sil || a.f; ctx.lineWidth = Math.max(.7, L * .012);
    for (let k = 0; k < 22; k++) { const an = k / 22 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * R * .9, Math.sin(an) * R * .9); ctx.lineTo(cx + Math.cos(an) * R * 1.18, Math.sin(an) * R * 1.18); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, 0, R, 0, 7);
    if (sil) ctx.fillStyle = sil; else { const g = ctx.createLinearGradient(0, -R, 0, R); g.addColorStop(0, a.c); g.addColorStop(.5, a.c); g.addColorStop(1, a.bl); ctx.fillStyle = g; }
    ctx.fill();
    if (!sil) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, 0, R, 0, 7); ctx.clip();
      const Rr = rng(hash(sp.id)); ctx.fillStyle = a.pc;
      for (let i = 0; i < 16; i++) { const an = Rr() * 7, rr = Math.sqrt(Rr()) * R * .85; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * rr, Math.sin(an) * rr - R * .15, R * (.04 + Rr() * .05), 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.ellipse(cx - R * .1, -R * .45, R * .6, R * .3, 0, 0, 7); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(.6, L * .01); ctx.beginPath(); ctx.arc(cx, 0, R, 0, 7); ctx.stroke();
      ctx.fillStyle = '#5a3a2a'; ctx.beginPath(); ctx.ellipse(cx + R * .98, R * .1, R * .1, R * .08, 0, 0, 7); ctx.fill();
    }
    ctx.save(); ctx.translate(cx + R * .1, R * .2); ctx.rotate(.4 + Math.sin(t * 10) * .4); ctx.beginPath(); ctx.ellipse(-R * .1, 0, R * .22, R * .1, 0, 0, 7); ctx.fillStyle = sil || a.f; ctx.fill(); ctx.restore();
    eye(ctx, cx + R * .5, -R * .3, R * .2 * (a.eye || 1) * .8, sil);
  }

  function drawMola(ctx, sp, L, o) {
    const a = sp.a, sil = o.sil, t = o.t || 0, Hh = L * .42;
    const fl = Math.sin(t * 2.5) * .15;
    // dorsal & anal
    ctx.beginPath(); ctx.moveTo(-L * .05, -Hh * .8); ctx.quadraticCurveTo(-L * .18, -Hh * 1.5, -L * (.3 + fl * .3), -Hh * 1.65); ctx.quadraticCurveTo(-L * .32, -Hh * 1.1, -L * .3, -Hh * .6); ctx.closePath(); fin(ctx, a.f, sil);
    ctx.beginPath(); ctx.moveTo(-L * .05, Hh * .8); ctx.quadraticCurveTo(-L * .18, Hh * 1.5, -L * (.3 - fl * .3), Hh * 1.65); ctx.quadraticCurveTo(-L * .32, Hh * 1.1, -L * .3, Hh * .6); ctx.closePath(); fin(ctx, a.f, sil);
    // clavus
    ctx.beginPath(); ctx.moveTo(-L * .3, -Hh * .85);
    for (let k = 0; k <= 6; k++) { const y = -Hh * .85 + Hh * 1.7 * k / 6; ctx.quadraticCurveTo(-L * .48, y - Hh * .14, -L * .33, y); }
    ctx.closePath(); fin(ctx, a.f, sil);
    // body
    const path = () => { ctx.beginPath(); ctx.moveTo(L * .44, -Hh * .05); ctx.bezierCurveTo(L * .4, -Hh * 1.05, -L * .15, -Hh * 1.15, -L * .33, -Hh * .85); ctx.lineTo(-L * .33, Hh * .85); ctx.bezierCurveTo(-L * .15, Hh * 1.15, L * .4, Hh * 1.05, L * .44, Hh * .1); ctx.closePath(); };
    path();
    if (sil) ctx.fillStyle = sil; else { const g = ctx.createLinearGradient(0, -Hh, 0, Hh); g.addColorStop(0, a.c); g.addColorStop(1, a.bl); ctx.fillStyle = g; }
    ctx.fill();
    if (!sil) {
      ctx.save(); path(); ctx.clip(); const R = rng(hash(sp.id)); ctx.fillStyle = a.pc; ctx.globalAlpha = .6;
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(-L * .3 + R() * L * .7, -Hh + R() * Hh * 2, L * (.03 + R() * .05), L * (.02 + R() * .04), R() * 3, 0, 7); ctx.fill(); }
      ctx.restore(); path(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(.6, L * .01); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(L * .44, Hh * .02); ctx.lineTo(L * .4, Hh * .05); ctx.stroke();
    }
    ctx.save(); ctx.translate(L * .18, Hh * .1); ctx.rotate(.3 + Math.sin(t * 5) * .2); ctx.beginPath(); ctx.ellipse(-L * .05, 0, L * .07, Hh * .12, 0, 0, 7); ctx.fillStyle = sil || a.f; ctx.fill(); ctx.restore();
    eye(ctx, L * .3, -Hh * .25, Math.max(1.2, L * .03), sil);
  }

  function drawRay(ctx, sp, L, o) {
    const a = sp.a, sil = o.sil, t = o.t || 0, flap = Math.sin(t * 3) * .5;
    const W = L * .48, wy1 = -W * (.75 + flap * .35), wy2 = W * (.75 - flap * .35);
    // tail
    ctx.strokeStyle = sil || a.f; ctx.lineWidth = Math.max(1, L * .015);
    ctx.beginPath(); ctx.moveTo(-L * .2, 0); ctx.quadraticCurveTo(-L * .45, Math.sin(t * 3) * L * .05, -L * .7, Math.sin(t * 3 + 1) * L * .06); ctx.stroke();
    const path = () => { ctx.beginPath(); ctx.moveTo(L * .3, 0); ctx.quadraticCurveTo(L * .15, wy1 * .4, -L * .02, wy1); ctx.quadraticCurveTo(-L * .05, wy1 * .5, -L * .24, 0); ctx.quadraticCurveTo(-L * .05, wy2 * .5, -L * .02, wy2); ctx.quadraticCurveTo(L * .15, wy2 * .4, L * .3, 0); ctx.closePath(); };
    path();
    if (sil) ctx.fillStyle = sil; else { const g = ctx.createLinearGradient(-L * .2, 0, L * .3, 0); g.addColorStop(0, a.c); g.addColorStop(1, a.f); ctx.fillStyle = g; }
    ctx.fill();
    if (!sil) {
      ctx.save(); path(); ctx.clip(); const R = rng(hash(sp.id)); ctx.fillStyle = a.pc; ctx.globalAlpha = .85;
      for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc(-L * .15 + R() * L * .3, (R() - .5) * W * 1.2, L * (.012 + R() * .02), 0, 7); ctx.fill(); }
      ctx.restore(); path(); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = Math.max(.6, L * .008); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(L * .05, 0, L * .14, W * .14, 0, 0, 7); ctx.fill();
    }
    // cephalic fins
    ctx.fillStyle = sil || a.f;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(L * .3, s * W * .12, L * .06, W * .05, s * .3, 0, 7); ctx.fill(); }
    eye(ctx, L * .22, -W * .14, Math.max(1, L * .018), sil);
  }

  function drawFish(ctx, sp, x, y, L, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.flip ? -1 : 1) * (o.sx == null ? 1 : o.sx), 1);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    const sh = sp.a.sh;
    if (sh === 'puff') drawPuff(ctx, sp, L, o);
    else if (sh === 'mola') drawMola(ctx, sp, L, o);
    else if (sh === 'ray') drawRay(ctx, sp, L, o);
    else drawGeneric(ctx, sp, L, o);
    ctx.restore();
  }

  // Render a species into a fresh canvas (used by UI cards)
  function thumb(sp, w, h, o = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    const L = fitLen(sp, w, h);
    drawFish(ctx, sp, w / 2 + (sp.a.x && sp.a.x.includes('bill') ? -L * .12 : 0), h / 2 + (sp.a.sh === 'angler' ? h * .06 : 0), L, Object.assign({ t: 1.3, wig: .5, auraScale: .6 }, o));
    return c;
  }
  function fitLen(sp, w, h) {
    const a = sp.a; let hr = a.h || .3;
    if (a.sh === 'mola') hr = 1.45; else if (a.sh === 'ray') hr = .85; else if (a.sh === 'puff') hr = .78;
    else if (a.dt === 'sail') hr += .4; else if (a.x && a.x.includes('lure')) hr += .35; else if (a.x && a.x.includes('leafy')) hr *= (a.sh === 'deep' ? 1.7 : 3); else if (a.x && a.x.includes('wings')) hr += .4; else hr += .2;
    const wr = (a.x && a.x.includes('bill')) ? 1.35 : (a.sh === 'ray' ? 1.1 : 1);
    return Math.min(w * .9 / wr, h * .82 / hr);
  }

  return { drawFish, thumb, fitLen };
})();
