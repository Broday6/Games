'use strict';
// HIGH CARD — all art is procedural canvas, rendered once per variant and cached as data URLs.
(function (HC) {
  const A = HC.Art = {};
  const cache = new Map();
  let fourColor = true;
  A.setFourColor = (v) => { if (fourColor !== !!v) { fourColor = !!v; for (const k of Array.from(cache.keys())) if (k[0] === 'c') cache.delete(k); } };
  const SUIT4 = ['#1b2033', '#e01e3c', '#13924a', '#1d6be6'];
  const SUIT2 = ['#1b2033', '#e01e3c', '#1b2033', '#e01e3c'];
  A.suitColor = (s) => (fourColor ? SUIT4 : SUIT2)[s];
  const FONT = '"Arial Narrow","Roboto Condensed","Helvetica Neue",Arial,sans-serif';
  const W = 200, H = 280, TW = 160, TH = 224;

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function memo(key, w, h, draw) {
    let u = cache.get(key);
    if (u) return u;
    const c = mk(w, h);
    draw(c.getContext('2d'), w, h);
    u = c.toDataURL();
    cache.set(key, u);
    return u;
  }
  const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';

  // ---------- suits (unit box, centred, ~1 tall) ----------
  function suitPath(g, s) {
    g.beginPath();
    if (s === 1) {
      g.moveTo(0, 0.44); g.bezierCurveTo(-0.18, 0.28, -0.52, 0.06, -0.52, -0.17);
      g.bezierCurveTo(-0.52, -0.42, -0.2, -0.54, 0, -0.27); g.bezierCurveTo(0.2, -0.54, 0.52, -0.42, 0.52, -0.17);
      g.bezierCurveTo(0.52, 0.06, 0.18, 0.28, 0, 0.44); g.closePath();
    } else if (s === 3) {
      g.moveTo(0, -0.52); g.quadraticCurveTo(0.18, -0.2, 0.4, 0); g.quadraticCurveTo(0.18, 0.2, 0, 0.52);
      g.quadraticCurveTo(-0.18, 0.2, -0.4, 0); g.quadraticCurveTo(-0.18, -0.2, 0, -0.52); g.closePath();
    } else if (s === 0) {
      g.moveTo(0, -0.52); g.bezierCurveTo(0.16, -0.32, 0.52, -0.12, 0.52, 0.11); g.bezierCurveTo(0.52, 0.34, 0.22, 0.4, 0.05, 0.22);
      g.quadraticCurveTo(0.08, 0.42, 0.22, 0.52); g.lineTo(-0.22, 0.52); g.quadraticCurveTo(-0.08, 0.42, -0.05, 0.22);
      g.bezierCurveTo(-0.22, 0.4, -0.52, 0.34, -0.52, 0.11); g.bezierCurveTo(-0.52, -0.12, -0.16, -0.32, 0, -0.52); g.closePath();
    } else {
      g.arc(0, -0.25, 0.23, 0, Math.PI * 2); g.moveTo(-0.03, 0.06);
      g.arc(-0.25, 0.06, 0.23, 0, Math.PI * 2); g.moveTo(0.48, 0.06);
      g.arc(0.25, 0.06, 0.23, 0, Math.PI * 2);
      g.moveTo(-0.06, 0); g.lineTo(0.06, 0); g.quadraticCurveTo(0.08, 0.4, 0.22, 0.52); g.lineTo(-0.22, 0.52); g.quadraticCurveTo(-0.08, 0.4, -0.06, 0); g.closePath();
    }
  }
  function suit(g, s, x, y, size, col, rot) {
    g.save(); g.translate(x, y); if (rot) g.rotate(Math.PI); g.scale(size, size);
    suitPath(g, s); g.fillStyle = col || A.suitColor(s); g.fill();
    g.restore();
  }
  A.drawSuit = suit;

  // ---------- playing cards ----------
  const ENH_BG = { bonus: '#dcebff', mult: '#ffe0e6', glass: 'rgba(214,246,255,0.82)', lucky: '#e4fbe6', wild: '#fff' };
  const PIPS = {
    2: [[0.5, 0], [0.5, 1]], 3: [[0.5, 0], [0.5, 0.5], [0.5, 1]],
    4: [[0, 0], [1, 0], [0, 1], [1, 1]], 5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
    6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
    7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
    8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
    9: [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
    10: [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]],
  };
  function cardBase(g, enh) {
    rr(g, 2, 2, W - 4, H - 4, 18);
    g.save(); g.clip();
    if (enh === 'steel') {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#eef1f6'); gr.addColorStop(0.5, '#aab3c0'); gr.addColorStop(1, '#dfe4ec');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      for (let y = 6; y < H; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 3); g.stroke(); }
    } else if (enh === 'gold') {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#fff2b8'); gr.addColorStop(0.45, '#f2c94c'); gr.addColorStop(0.55, '#e0a92a'); gr.addColorStop(1, '#ffe488');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(0, 90); g.lineTo(W, 30); g.lineTo(W, 60); g.lineTo(0, 120); g.fill();
    } else if (enh === 'stone') {
      g.fillStyle = '#8f8b86'; g.fillRect(0, 0, W, H);
      let seed = 7;
      const rn = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 260; i++) { g.fillStyle = rn() < 0.5 ? 'rgba(60,55,50,0.35)' : 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(rn() * W, rn() * H, 1 + rn() * 3.5, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(40,36,32,0.5)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(30, 40); g.lineTo(70, 80); g.lineTo(60, 120); g.moveTo(150, 190); g.lineTo(120, 220); g.lineTo(140, 250); g.stroke();
    } else if (enh === 'wild') {
      const cols = ['#ffd6de', '#d6f5e0', '#d9e6ff', '#fff1c9'];
      for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); g.moveTo(i * 50 - 100, 0); g.lineTo(i * 50 - 50, 0); g.lineTo(i * 50 + 90, H); g.lineTo(i * 50 + 40, H); g.fill(); }
    } else {
      g.fillStyle = ENH_BG[enh] || '#f7f3ea'; g.fillRect(0, 0, W, H);
      if (enh === 'glass') {
        g.fillStyle = 'rgba(255,255,255,0.65)';
        g.beginPath(); g.moveTo(20, H); g.lineTo(70, H); g.lineTo(W, 60); g.lineTo(W, 20); g.fill();
        g.beginPath(); g.moveTo(0, 150); g.lineTo(0, 175); g.lineTo(110, 0); g.lineTo(95, 0); g.fill();
      }
      if (enh === 'lucky') {
        g.globalAlpha = 0.18;
        for (let i = 0; i < 6; i++) { const x = 30 + (i % 3) * 70, y = 50 + Math.floor(i / 3) * 180; for (let k = 0; k < 4; k++) { g.fillStyle = '#18a050'; g.beginPath(); g.arc(x + Math.cos(k * 1.57) * 8, y + Math.sin(k * 1.57) * 8, 7, 0, 7); g.fill(); } }
        g.globalAlpha = 1;
      }
    }
    g.restore();
    rr(g, 2, 2, W - 4, H - 4, 18);
    g.lineWidth = 3; g.strokeStyle = enh === 'gold' ? '#a87a10' : enh === 'steel' ? '#6c7686' : enh === 'glass' ? '#7cc8e0' : 'rgba(40,40,60,0.35)'; g.stroke();
  }
  function rankText(g, r, x, y, size, col) {
    const t = HC.RANK_CH[r];
    g.save(); g.translate(x, y);
    if (t.length > 1) g.scale(0.74, 1);
    g.font = '900 ' + size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = col; g.fillText(t, 0, 0);
    g.restore();
  }
  function index(g, c, col) {
    rankText(g, c.rank, 31, 60, 58, col);
    suit(g, c.suit, 31, 91, 34, col);
  }
  function faceArt(g, c, col) {
    const x0 = 54, y0 = 26, w = 92, h = 228;
    g.save();
    rr(g, x0, y0, w, h, 10); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = col; g.stroke();
    rr(g, x0, y0, w, h, 10); g.clip();
    for (let half = 0; half < 2; half++) {
      g.save();
      if (half) { g.translate(100, 140); g.rotate(Math.PI); g.translate(-100, -140); }
      // robe
      g.fillStyle = col;
      g.beginPath(); g.moveTo(60, 140); g.quadraticCurveTo(64, 104, 100, 100); g.quadraticCurveTo(136, 104, 140, 140); g.closePath(); g.fill();
      g.fillStyle = '#f2c94c';
      g.beginPath(); g.moveTo(92, 102); g.lineTo(108, 102); g.lineTo(104, 140); g.lineTo(96, 140); g.closePath(); g.fill();
      g.strokeStyle = '#f2c94c'; g.lineWidth = 3; g.beginPath(); g.moveTo(66, 128); g.quadraticCurveTo(100, 118, 134, 128); g.stroke();
      // head
      g.fillStyle = '#f6d2ae'; g.beginPath(); g.arc(100, 80, 17, 0, 7); g.fill();
      g.fillStyle = '#2a1e1a'; g.beginPath(); g.arc(94, 79, 2.2, 0, 7); g.arc(106, 79, 2.2, 0, 7); g.fill();
      g.strokeStyle = '#a0503a'; g.lineWidth = 2; g.beginPath(); g.arc(100, 85, 6, 0.3, Math.PI - 0.3); g.stroke();
      // headwear
      if (c.rank === 13) {
        g.fillStyle = '#f2c94c';
        g.beginPath(); g.moveTo(82, 66); g.lineTo(84, 44); g.lineTo(92, 56); g.lineTo(100, 40); g.lineTo(108, 56); g.lineTo(116, 44); g.lineTo(118, 66); g.closePath(); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(100, 58, 3, 0, 7); g.fill();
        g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(86, 90); g.quadraticCurveTo(100, 112, 114, 90); g.quadraticCurveTo(100, 98, 86, 90); g.fill();
      } else if (c.rank === 12) {
        g.fillStyle = '#5a2a1a'; g.beginPath(); g.ellipse(100, 74, 21, 18, 0, Math.PI, 0); g.fill();
        g.fillRect(79, 74, 6, 22); g.fillRect(115, 74, 6, 22);
        g.fillStyle = '#f2c94c'; g.beginPath(); g.moveTo(86, 62); g.lineTo(92, 52); g.lineTo(100, 60); g.lineTo(108, 52); g.lineTo(114, 62); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(100, 56, 2.5, 0, 7); g.fill();
      } else {
        g.fillStyle = col; g.beginPath(); g.moveTo(80, 70); g.quadraticCurveTo(100, 50, 122, 66); g.lineTo(128, 60); g.lineTo(124, 72); g.closePath(); g.fill();
        g.strokeStyle = '#f2c94c'; g.lineWidth = 3; g.beginPath(); g.moveTo(112, 58); g.quadraticCurveTo(130, 40, 134, 52); g.stroke();
      }
      suit(g, c.suit, 72, 50, 16, col);
      g.restore();
    }
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, 140); g.lineTo(x0 + w, 140); g.stroke();
    g.restore();
  }
  function badge(g, text, bg, fg) {
    g.font = '900 24px ' + FONT;
    const tw = g.measureText(text).width + 22;
    rr(g, 100 - tw / 2, 238, tw, 30, 15); g.fillStyle = bg; g.fill();
    g.fillStyle = fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 100, 254);
  }
  const SEAL_COL = { gold: ['#ffd84a', '#a8780a'], red: ['#ff4a55', '#8a1018'], blue: ['#4a9aff', '#0a3a8a'], purple: ['#b070ff', '#4a1a8a'] };
  function seal(g, s) {
    const c = SEAL_COL[s];
    g.save(); g.translate(31, 132);
    g.fillStyle = c[1]; g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 15 : 17; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
    g.fillStyle = c[0]; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
    g.strokeStyle = c[1]; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke();
    g.restore();
  }
  A.cardURL = function (c) {
    const key = 'c' + c.rank + '.' + c.suit + '.' + (c.enh || '') + '.' + (c.seal || '');
    return memo(key, W, H, (g) => {
      cardBase(g, c.enh);
      if (c.enh === 'stone') {
        g.font = '900 64px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(40,36,32,0.55)'; g.fillText('+50', 100, 144); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillText('+50', 98, 141);
        if (c.seal) seal(g, c.seal);
        return;
      }
      const col = A.suitColor(c.suit);
      index(g, c, col);
      g.save(); g.translate(W, H); g.rotate(Math.PI); index(g, c, col); g.restore();
      if (c.rank >= 11 && c.rank <= 13) faceArt(g, c, col);
      else if (c.rank === 14) {
        suit(g, c.suit, 100, 140, 108, col);
        g.strokeStyle = col; g.globalAlpha = 0.25; g.lineWidth = 2; g.beginPath(); g.arc(100, 140, 66, 0, 7); g.stroke(); g.globalAlpha = 1;
      } else {
        const pts = PIPS[c.rank];
        for (const p of pts) suit(g, c.suit, 74 + p[0] * 52, 54 + p[1] * 172, 36, col, p[1] > 0.5);
      }
      if (c.enh === 'bonus') badge(g, '+30', '#2a7fe0');
      else if (c.enh === 'mult') badge(g, '+4', '#e0283c');
      else if (c.enh === 'glass') badge(g, '×2', '#3aa8c8');
      else if (c.enh === 'steel') badge(g, '×1.5', '#56606e');
      else if (c.enh === 'gold') badge(g, '$3', '#8a5a00', '#ffe9a0');
      else if (c.enh === 'lucky') badge(g, 'LUCKY', '#18a050');
      else if (c.enh === 'wild') badge(g, 'WILD', '#7a3ad8');
      if (c.seal) seal(g, c.seal);
    });
  };
  A.backURL = function (deckId) {
    const d = HC.DECK[deckId] || HC.DECKS[0];
    return memo('b' + d.id, W, H, (g) => {
      rr(g, 2, 2, W - 4, H - 4, 18);
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, d.back[0]); gr.addColorStop(1, d.back[1]);
      g.fillStyle = gr; g.fill();
      g.save(); rr(g, 14, 14, W - 28, H - 28, 10); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2;
      for (let i = -H; i < W + H; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.moveTo(i, H); g.lineTo(i + H, 0); g.stroke(); }
      g.restore();
      rr(g, 14, 14, W - 28, H - 28, 10); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(100, 140, 42, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.beginPath(); g.arc(100, 140, 42, 0, 7); g.stroke();
      suit(g, 0, 88, 132, 30, 'rgba(255,255,255,0.9)'); suit(g, 1, 112, 148, 30, '#ffd23f');
      rr(g, 2, 2, W - 4, H - 4, 18); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3; g.stroke();
    });
  };

  // ---------- icons (unit box -1..1) ----------
  const IC = {};
  function P(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
  const ST = (g, w) => { g.lineWidth = w || 0.1; g.stroke(); };
  IC.coin = (g, c, d) => { g.beginPath(); g.arc(0, 0, 0.8, 0, 7); g.fillStyle = c; g.fill(); ST(g, 0.1); g.beginPath(); g.arc(0, 0, 0.58, 0, 7); ST(g, 0.07); suitPath4(g); };
  function suitPath4(g) { g.save(); g.scale(0.7, 0.7); P(g, [0, -0.6, 0.35, 0, 0, 0.6, -0.35, 0]); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fill(); g.restore(); }
  IC.heart = (g, c) => { g.save(); g.scale(1.8, 1.8); suitPath(g, 1); g.restore(); g.fillStyle = c; g.fill(); ST(g); };
  IC.diamond = (g, c) => { g.save(); g.scale(1.8, 1.8); suitPath(g, 3); g.restore(); g.fillStyle = c; g.fill(); ST(g); };
  IC.club = (g, c) => { g.save(); g.scale(1.75, 1.75); suitPath(g, 2); g.restore(); g.fillStyle = c; g.fill(); ST(g); };
  IC.spade = (g, c) => { g.save(); g.scale(1.75, 1.75); suitPath(g, 0); g.restore(); g.fillStyle = c; g.fill(); ST(g); };
  IC.flame = (g, c) => {
    g.beginPath(); g.moveTo(0, -0.95); g.bezierCurveTo(0.2, -0.5, 0.75, -0.25, 0.7, 0.3); g.bezierCurveTo(0.65, 0.75, 0.3, 0.92, 0, 0.92);
    g.bezierCurveTo(-0.3, 0.92, -0.7, 0.75, -0.7, 0.3); g.bezierCurveTo(-0.7, -0.05, -0.4, -0.15, -0.35, -0.5); g.bezierCurveTo(-0.1, -0.3, -0.05, -0.6, 0, -0.95);
    g.fillStyle = c; g.fill(); ST(g);
    g.beginPath(); g.moveTo(0, -0.1); g.bezierCurveTo(0.3, 0.2, 0.4, 0.5, 0.3, 0.65); g.quadraticCurveTo(0, 0.85, -0.3, 0.65); g.bezierCurveTo(-0.4, 0.4, -0.15, 0.25, 0, -0.1);
    g.fillStyle = '#fff6b0'; g.fill();
  };
  IC.trident = (g, c) => {
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 0.16;
    g.beginPath(); g.moveTo(0, -0.9); g.lineTo(0, 0.95); g.moveTo(-0.55, -0.75); g.quadraticCurveTo(-0.55, -0.1, 0, -0.1); g.quadraticCurveTo(0.55, -0.1, 0.55, -0.75); g.stroke();
    g.fillStyle = c; for (const x of [-0.55, 0, 0.55]) { P(g, [x, -1, x + 0.14, -0.72, x - 0.14, -0.72]); g.fill(); }
  };
  IC.domino = (g, c, d) => {
    rrU(g, -0.45, -0.9, 0.9, 1.8, 0.15); g.fillStyle = '#f4f0e6'; g.fill(); ST(g);
    g.beginPath(); g.moveTo(-0.35, 0); g.lineTo(0.35, 0); ST(g, 0.07);
    g.fillStyle = c; for (const p of [[-0.2, -0.65], [0.2, -0.25], [0, -0.45], [-0.2, 0.25], [0.2, 0.25], [-0.2, 0.65], [0.2, 0.65]]) { g.beginPath(); g.arc(p[0], p[1], 0.1, 0, 7); g.fill(); }
  };
  function rrU(g, x, y, w, h, r) { rr(g, x, y, w, h, r); }
  IC.ladder = (g, c) => {
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 0.15;
    g.beginPath(); g.moveTo(-0.45, -0.95); g.lineTo(-0.45, 0.95); g.moveTo(0.45, -0.95); g.lineTo(0.45, 0.95);
    for (let y = -0.65; y <= 0.7; y += 0.45) { g.moveTo(-0.45, y); g.lineTo(0.45, y); } g.stroke();
  };
  IC.wave = (g, c) => {
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 0.16;
    for (const y of [-0.45, 0.05, 0.55]) { g.beginPath(); g.moveTo(-0.9, y); for (let x = -0.9; x <= 0.9; x += 0.05) g.lineTo(x, y + Math.sin(x * 5) * 0.14); g.stroke(); }
  };
  IC.chips = (g, c) => {
    for (let i = 2; i >= 0; i--) {
      const y = 0.4 - i * 0.38;
      g.beginPath(); g.ellipse(0, y + 0.1, 0.8, 0.32, 0, 0, Math.PI); g.lineTo(-0.8, y); g.ellipse(0, y, 0.8, 0.32, 0, Math.PI, 0, false); g.closePath();
      g.fillStyle = i % 2 ? '#f4f0e6' : c; g.fill(); ST(g, 0.07);
      g.beginPath(); g.ellipse(0, y, 0.8, 0.32, 0, 0, 7); g.fillStyle = i % 2 ? '#fff' : c; g.fill(); ST(g, 0.07);
      g.beginPath(); g.ellipse(0, y, 0.45, 0.17, 0, 0, 7); ST(g, 0.05);
    }
  };
  IC.brick = (g, c) => {
    g.fillStyle = c;
    for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
      const x = -0.95 + k * 0.62 + (r % 2 ? 0.31 : 0), y = -0.86 + r * 0.44;
      const x0 = Math.max(-0.95, x), x1 = Math.min(0.95, x + 0.56);
      if (x1 - x0 < 0.1) continue;
      g.fillRect(x0, y, x1 - x0, 0.38); g.strokeRect(x0, y, x1 - x0, 0.38);
    }
  };
  IC.arrow = (g, c) => { P(g, [-0.85, -0.2, 0.2, -0.2, 0.2, -0.6, 0.9, 0, 0.2, 0.6, 0.2, 0.2, -0.85, 0.2]); g.fillStyle = c; g.fill(); ST(g); };
  IC.gem = (g, c) => {
    P(g, [-0.85, -0.25, -0.45, -0.7, 0.45, -0.7, 0.85, -0.25, 0, 0.85]); g.fillStyle = c; g.fill(); ST(g);
    g.beginPath(); g.moveTo(-0.85, -0.25); g.lineTo(0.85, -0.25); g.moveTo(-0.45, -0.7); g.lineTo(-0.25, -0.25); g.lineTo(0, 0.85); g.lineTo(0.25, -0.25); g.lineTo(0.45, -0.7); g.moveTo(-0.25, -0.25); g.lineTo(0, -0.7); g.lineTo(0.25, -0.25); ST(g, 0.05);
    g.fillStyle = 'rgba(255,255,255,0.5)'; P(g, [-0.45, -0.7, 0, -0.7, -0.25, -0.25]); g.fill();
  };
  IC.fox = (g, c) => {
    P(g, [-0.8, -0.85, -0.35, -0.35, 0.35, -0.35, 0.8, -0.85, 0.75, -0.1, 0, 0.85, -0.75, -0.1]); g.fillStyle = c; g.fill(); ST(g);
    P(g, [-0.55, 0.05, 0, 0.85, 0.55, 0.05, 0, 0.3]); g.fillStyle = '#fff4e6'; g.fill();
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(-0.3, -0.1, 0.09, 0, 7); g.arc(0.3, -0.1, 0.09, 0, 7); g.fill(); g.beginPath(); g.arc(0, 0.72, 0.1, 0, 7); g.fill();
  };
  IC.moon = (g, c) => { g.beginPath(); g.arc(0, 0, 0.85, 0.6, Math.PI * 2 - 0.6, false); g.arc(0.35, 0, 0.62, Math.PI * 2 - 1.2, 1.2, true); g.closePath(); g.fillStyle = c; g.fill(); ST(g); };
  IC.duck = (g, c) => {
    g.beginPath(); g.ellipse(-0.05, 0.35, 0.75, 0.45, 0, 0, 7); g.fillStyle = c; g.fill(); ST(g);
    g.beginPath(); g.arc(0.4, -0.35, 0.36, 0, 7); g.fill(); ST(g);
    P(g, [0.7, -0.4, 1, -0.28, 0.7, -0.2]); g.fillStyle = '#ff9a2a'; g.fill(); ST(g, 0.05);
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(0.48, -0.42, 0.07, 0, 7); g.fill();
  };
  IC.anchor = (g, c) => {
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 0.17;
    g.beginPath(); g.arc(0, -0.7, 0.2, 0, 7); g.moveTo(0, -0.5); g.lineTo(0, 0.85); g.moveTo(-0.45, -0.25); g.lineTo(0.45, -0.25);
    g.moveTo(-0.75, 0.25); g.quadraticCurveTo(-0.6, 0.85, 0, 0.85); g.quadraticCurveTo(0.6, 0.85, 0.75, 0.25); g.stroke();
  };
  IC.mask = (g, c) => {
    g.beginPath(); g.moveTo(-0.8, -0.7); g.quadraticCurveTo(0, -0.95, 0.8, -0.7); g.quadraticCurveTo(0.85, 0.4, 0, 0.9); g.quadraticCurveTo(-0.85, 0.4, -0.8, -0.7);
    g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = '#1a1020';
    g.beginPath(); g.ellipse(-0.35, -0.25, 0.2, 0.13, -0.2, 0, 7); g.ellipse(0.35, -0.25, 0.2, 0.13, 0.2, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-0.35, 0.35); g.quadraticCurveTo(0, 0.6, 0.35, 0.35); g.quadraticCurveTo(0, 0.45, -0.35, 0.35); g.fill();
  };
  IC.card = (g, c) => {
    g.save(); g.rotate(-0.15); rrU(g, -0.6, -0.85, 1.2, 1.7, 0.15); g.fillStyle = '#f7f3ea'; g.fill(); ST(g);
    g.font = '900 0.9px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c; g.fillText('A', 0, 0.06); g.restore();
  };
  IC.seven = (g, c) => {
    rrU(g, -0.8, -0.8, 1.6, 1.6, 0.25); g.fillStyle = '#20142e'; g.fill(); ST(g);
    g.font = '900 1.5px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c; g.fillText('7', 0, 0.1);
    g.lineWidth = 0.05; g.strokeStyle = '#fff'; g.strokeText('7', 0, 0.1);
  };
  IC.bag = (g, c) => {
    g.beginPath(); g.moveTo(-0.3, -0.55); g.quadraticCurveTo(-0.9, 0, -0.75, 0.55); g.quadraticCurveTo(-0.6, 0.9, 0, 0.9); g.quadraticCurveTo(0.6, 0.9, 0.75, 0.55); g.quadraticCurveTo(0.9, 0, 0.3, -0.55); g.closePath();
    g.fillStyle = c; g.fill(); ST(g);
    P(g, [-0.3, -0.55, -0.5, -0.9, 0.5, -0.9, 0.3, -0.55]); g.fill(); ST(g);
    g.font = '900 0.9px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText('$', 0, 0.25);
  };
  IC.pig = (g, c) => {
    g.beginPath(); g.ellipse(0, 0.1, 0.85, 0.6, 0, 0, 7); g.fillStyle = c; g.fill(); ST(g);
    P(g, [-0.5, -0.35, -0.35, -0.8, -0.15, -0.45]); g.fill(); ST(g, 0.06);
    g.beginPath(); g.ellipse(0.82, 0.12, 0.16, 0.22, 0, 0, 7); g.fill(); ST(g, 0.06);
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(0.45, -0.1, 0.07, 0, 7); g.fill(); g.fillRect(-0.2, -0.48, 0.4, 0.08);
    g.fillStyle = c; g.fillRect(-0.55, 0.55, 0.22, 0.32); g.fillRect(0.3, 0.55, 0.22, 0.32);
  };
  IC.cup = (g, c) => {
    P(g, [-0.65, -0.6, 0.65, -0.6, 0.5, 0.9, -0.5, 0.9]); g.fillStyle = 'rgba(200,240,255,0.5)'; g.fill(); ST(g);
    g.fillStyle = c; for (const p of [[-0.2, 0.6], [0.2, 0.6], [0, 0.3], [-0.25, 0.1], [0.25, 0.25]]) { g.beginPath(); g.ellipse(p[0], p[1], 0.22, 0.12, 0, 0, 7); g.fill(); ST(g, 0.04); }
    rrU(g, -0.75, -0.8, 1.5, 0.22, 0.08); g.fillStyle = '#8a8fa0'; g.fill(); ST(g, 0.06);
  };
  IC.ticket = (g, c) => {
    g.beginPath(); g.moveTo(-0.9, -0.5); g.lineTo(0.9, -0.5); g.lineTo(0.9, -0.15); g.arc(0.9, 0, 0.15, -Math.PI / 2, Math.PI / 2, true); g.lineTo(0.9, 0.5); g.lineTo(-0.9, 0.5); g.lineTo(-0.9, 0.15); g.arc(-0.9, 0, 0.15, Math.PI / 2, -Math.PI / 2, true); g.closePath();
    g.fillStyle = c; g.fill(); ST(g);
    g.setLineDash([0.1, 0.08]); g.beginPath(); g.moveTo(0.4, -0.45); g.lineTo(0.4, 0.45); ST(g, 0.06); g.setLineDash([]);
    g.font = '900 0.55px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText('%', -0.2, 0.04);
  };
  IC.broom = (g, c) => {
    g.strokeStyle = '#a0703a'; g.lineCap = 'round'; g.lineWidth = 0.14; g.beginPath(); g.moveTo(0.6, -0.95); g.lineTo(-0.05, 0.15); g.stroke();
    P(g, [-0.25, 0, 0.15, 0.25, -0.2, 0.95, -0.9, 0.6]); g.fillStyle = c; g.fill(); ST(g, 0.06);
  };
  IC.hand = (g, c) => {
    g.fillStyle = c;
    rrU(g, -0.55, -0.1, 1.05, 0.95, 0.3); g.fill(); ST(g, 0.07);
    for (let i = 0; i < 4; i++) { rrU(g, -0.55 + i * 0.27, -0.85 + Math.abs(i - 1.5) * 0.12, 0.24, 0.9, 0.12); g.fill(); ST(g, 0.06); }
    g.save(); g.translate(0.5, 0.2); g.rotate(-0.7); rrU(g, -0.12, -0.5, 0.24, 0.6, 0.12); g.fill(); ST(g, 0.06); g.restore();
  };
  IC.cards = (g, c) => {
    const cols = ['#f7f3ea', '#f7f3ea', '#f7f3ea'];
    for (let i = 0; i < 3; i++) { g.save(); g.rotate((i - 1) * 0.35); g.translate(0, 0.1); rrU(g, -0.42, -0.8, 0.84, 1.2, 0.1); g.fillStyle = cols[i]; g.fill(); ST(g, 0.07); g.save(); g.translate(0, -0.2); g.scale(0.5, 0.5); suitPath(g, i); g.restore(); g.fillStyle = i === 1 ? c : '#1b2033'; g.fill(); g.restore(); }
  };
  IC.mountain = (g, c) => {
    P(g, [-0.95, 0.8, -0.3, -0.5, 0.1, 0.1, 0.45, -0.75, 0.95, 0.8]); g.fillStyle = c; g.fill(); ST(g);
    P(g, [0.45, -0.75, 0.62, -0.42, 0.45, -0.5, 0.3, -0.42]); g.fillStyle = '#fff'; g.fill();
    P(g, [-0.3, -0.5, -0.15, -0.2, -0.3, -0.28, -0.45, -0.2]); g.fill();
  };
  IC.crown = (g, c) => {
    P(g, [-0.85, 0.55, -0.9, -0.45, -0.45, 0, 0, -0.75, 0.45, 0, 0.9, -0.45, 0.85, 0.55]); g.fillStyle = c; g.fill(); ST(g);
    g.fillRect(-0.85, 0.55, 1.7, 0.25); g.strokeRect(-0.85, 0.55, 1.7, 0.25);
    g.fillStyle = '#ff3d6a'; for (const x of [-0.45, 0, 0.45]) { g.beginPath(); g.arc(x, 0.3, 0.1, 0, 7); g.fill(); }
  };
  IC.snow = (g, c) => {
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 0.13;
    for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -0.9); g.moveTo(0, -0.55); g.lineTo(-0.22, -0.75); g.moveTo(0, -0.55); g.lineTo(0.22, -0.75); g.stroke(); g.restore(); }
  };
  IC.bird = (g, c) => {
    g.beginPath(); g.ellipse(-0.05, 0.1, 0.55, 0.38, -0.3, 0, 7); g.fillStyle = c; g.fill(); ST(g);
    g.beginPath(); g.arc(0.45, -0.3, 0.27, 0, 7); g.fill(); ST(g);
    P(g, [0.68, -0.35, 0.95, -0.25, 0.68, -0.18]); g.fillStyle = '#ffb02a'; g.fill();
    P(g, [-0.5, 0.25, -0.95, 0.75, -0.75, 0.2]); g.fillStyle = '#20202a'; g.fill();
    g.beginPath(); g.moveTo(-0.35, -0.05); g.quadraticCurveTo(0, -0.5, 0.25, 0.1); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(0.5, -0.35, 0.06, 0, 7); g.fill();
  };
  IC.bell = (g, c) => {
    g.beginPath(); g.moveTo(-0.7, 0.55); g.quadraticCurveTo(-0.55, 0.35, -0.55, -0.1); g.quadraticCurveTo(-0.55, -0.75, 0, -0.75); g.quadraticCurveTo(0.55, -0.75, 0.55, -0.1); g.quadraticCurveTo(0.55, 0.35, 0.7, 0.55); g.closePath();
    g.fillStyle = c; g.fill(); ST(g);
    g.beginPath(); g.arc(0, 0.68, 0.15, 0, 7); g.fill(); ST(g, 0.06);
    g.beginPath(); g.arc(0, -0.85, 0.1, 0, 7); g.fill();
  };
  IC.curtain = (g, c) => {
    g.fillStyle = '#ffd23f'; g.fillRect(-0.95, -0.95, 1.9, 0.22);
    g.fillStyle = c;
    g.beginPath(); g.moveTo(-0.95, -0.73); g.lineTo(-0.1, -0.73); g.quadraticCurveTo(-0.3, 0.2, -0.75, 0.9); g.lineTo(-0.95, 0.9); g.closePath(); g.fill(); ST(g, 0.06);
    g.beginPath(); g.moveTo(0.95, -0.73); g.lineTo(0.1, -0.73); g.quadraticCurveTo(0.3, 0.2, 0.75, 0.9); g.lineTo(0.95, 0.9); g.closePath(); g.fill(); ST(g, 0.06);
    starPath(g, 0, 0.25, 0.3, 0.13); g.fillStyle = '#ffd23f'; g.fill();
  };
  function starPath(g, x, y, R, r, n) {
    n = n || 5; g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rad = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    g.closePath();
  }
  IC.star = (g, c) => { starPath(g, 0, 0.05, 0.95, 0.42); g.fillStyle = c; g.fill(); ST(g); };
  IC.glass = (g, c) => {
    g.beginPath(); g.moveTo(-0.55, -0.85); g.lineTo(0.55, -0.85); g.quadraticCurveTo(0.6, 0.05, 0.08, 0.15); g.lineTo(0.08, 0.7); g.lineTo(0.45, 0.85); g.lineTo(-0.45, 0.85); g.lineTo(-0.08, 0.7); g.lineTo(-0.08, 0.15); g.quadraticCurveTo(-0.6, 0.05, -0.55, -0.85); g.closePath();
    g.fillStyle = 'rgba(210,245,255,0.55)'; g.fill(); ST(g);
    g.beginPath(); g.moveTo(-0.52, -0.45); g.lineTo(0.52, -0.45); g.quadraticCurveTo(0.5, 0.05, 0, 0.08); g.quadraticCurveTo(-0.5, 0.05, -0.52, -0.45); g.fillStyle = c; g.fill();
    g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(-0.3, -0.75); g.lineTo(-0.35, -0.2); ST(g, 0.07);
  };
  IC.wheel = (g, c) => {
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 0.9, i * Math.PI / 6, (i + 1) * Math.PI / 6); g.closePath(); g.fillStyle = i === 0 ? '#18a050' : i % 2 ? '#1a1020' : c; g.fill(); }
    g.beginPath(); g.arc(0, 0, 0.9, 0, 7); ST(g);
    g.beginPath(); g.arc(0, 0, 0.35, 0, 7); g.fillStyle = '#c9a050'; g.fill(); ST(g, 0.06);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0.6, -0.3, 0.1, 0, 7); g.fill();
  };
  IC.flower = (g, c) => {
    g.fillStyle = c;
    for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * Math.PI * 2 / 5); g.beginPath(); g.ellipse(0, -0.5, 0.28, 0.42, 0, 0, 7); g.fill(); ST(g, 0.06); g.restore(); }
    g.beginPath(); g.arc(0, 0, 0.28, 0, 7); g.fillStyle = '#ffd23f'; g.fill(); ST(g, 0.06);
  };
  IC.anvil = (g, c) => {
    P(g, [-0.95, -0.45, 0.75, -0.45, 0.75, -0.15, 0.4, 0.05, 0.3, 0.45, 0.6, 0.75, -0.6, 0.75, -0.3, 0.45, -0.4, 0.05, -0.6, -0.15, -0.95, -0.25]);
    g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-0.8, -0.42, 1.5, 0.08);
  };
  IC.map = (g, c) => {
    P(g, [-0.9, -0.65, -0.3, -0.85, 0.3, -0.65, 0.9, -0.85, 0.9, 0.65, 0.3, 0.85, -0.3, 0.65, -0.9, 0.85]); g.fillStyle = c; g.fill(); ST(g);
    g.beginPath(); g.moveTo(-0.3, -0.85); g.lineTo(-0.3, 0.65); g.moveTo(0.3, -0.65); g.lineTo(0.3, 0.85); ST(g, 0.05);
    g.setLineDash([0.1, 0.08]); g.beginPath(); g.moveTo(-0.7, 0.5); g.quadraticCurveTo(-0.2, -0.4, 0.45, -0.15); ST(g, 0.06); g.setLineDash([]);
    g.strokeStyle = '#e0283c'; g.beginPath(); g.moveTo(0.4, -0.35); g.lineTo(0.7, -0.05); g.moveTo(0.7, -0.35); g.lineTo(0.4, -0.05); ST(g, 0.12);
  };
  IC.rock = (g, c) => {
    P(g, [-0.85, 0.6, -0.7, -0.2, -0.3, -0.7, 0.35, -0.75, 0.85, -0.2, 0.9, 0.55, 0.3, 0.8, -0.4, 0.8]); g.fillStyle = c; g.fill(); ST(g);
    g.beginPath(); g.moveTo(-0.3, -0.7); g.lineTo(-0.05, -0.1); g.lineTo(0.5, 0.1); g.moveTo(-0.05, -0.1); g.lineTo(-0.3, 0.5); ST(g, 0.06);
  };
  IC.fish = (g, c) => {
    g.beginPath(); g.moveTo(-0.6, 0); g.quadraticCurveTo(0, -0.7, 0.7, 0); g.quadraticCurveTo(0, 0.7, -0.6, 0); g.closePath(); g.fillStyle = c; g.fill(); ST(g);
    P(g, [-0.55, 0, -0.95, -0.45, -0.95, 0.45]); g.fill(); ST(g);
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(0.35, -0.08, 0.08, 0, 7); g.fill();
  };
  IC.steps = (g, c) => { P(g, [-0.9, 0.85, -0.9, 0.35, -0.45, 0.35, -0.45, -0.1, 0, -0.1, 0, -0.55, 0.45, -0.55, 0.45, -0.95, 0.9, -0.95, 0.9, 0.85]); g.fillStyle = c; g.fill(); ST(g); };
  IC.drop = (g, c) => {
    g.beginPath(); g.moveTo(0, -0.95); g.bezierCurveTo(0.3, -0.4, 0.7, -0.05, 0.7, 0.3); g.arc(0, 0.3, 0.7, 0, Math.PI); g.bezierCurveTo(-0.7, -0.05, -0.3, -0.4, 0, -0.95);
    g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-0.3, 0.25, 0.12, 0.22, 0.3, 0, 7); g.fill();
  };
  IC.scope = (g, c) => {
    g.save(); g.rotate(-0.5); rrU(g, -0.9, -0.22, 1.5, 0.44, 0.1); g.fillStyle = c; g.fill(); ST(g); rrU(g, 0.55, -0.3, 0.3, 0.6, 0.08); g.fill(); ST(g); g.restore();
    g.strokeStyle = '#a0a8b8'; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0.05); g.lineTo(-0.5, 0.9); g.moveTo(0, 0.05); g.lineTo(0.5, 0.9); g.moveTo(0, 0.05); g.lineTo(0, 0.9); ST(g, 0.1);
  };
  IC.eye = (g, c) => {
    g.beginPath(); g.moveTo(-0.95, 0); g.quadraticCurveTo(0, -0.85, 0.95, 0); g.quadraticCurveTo(0, 0.85, -0.95, 0); g.closePath(); g.fillStyle = '#f7f3ea'; g.fill(); ST(g);
    g.beginPath(); g.arc(0, 0, 0.36, 0, 7); g.fillStyle = c; g.fill(); ST(g, 0.06);
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(0, 0, 0.16, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0.1, -0.1, 0.07, 0, 7); g.fill();
  };
  IC.skull = (g, c) => {
    g.beginPath(); g.arc(0, -0.2, 0.72, Math.PI * 0.85, Math.PI * 2.15); g.lineTo(0.42, 0.55); g.lineTo(0.42, 0.85); g.lineTo(-0.42, 0.85); g.lineTo(-0.42, 0.55); g.closePath();
    g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = '#1a1020'; g.beginPath(); g.arc(-0.3, -0.15, 0.2, 0, 7); g.arc(0.3, -0.15, 0.2, 0, 7); g.fill();
    P(g, [0, 0.12, 0.12, 0.35, -0.12, 0.35]); g.fill();
    g.fillRect(-0.2, 0.62, 0.06, 0.2); g.fillRect(0.14, 0.62, 0.06, 0.2);
  };
  IC.dice = (g, c) => {
    const die = (x, y, r, pips) => {
      g.save(); g.translate(x, y); g.rotate(r); rrU(g, -0.42, -0.42, 0.84, 0.84, 0.14); g.fillStyle = '#f7f3ea'; g.fill(); ST(g, 0.07);
      g.fillStyle = c; for (const p of pips) { g.beginPath(); g.arc(p[0] * 0.24, p[1] * 0.24, 0.09, 0, 7); g.fill(); } g.restore();
    };
    die(-0.38, 0.3, -0.25, [[-1, -1], [0, 0], [1, 1]]);
    die(0.4, -0.3, 0.3, [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]);
  };
  IC.egg = (g, c) => {
    g.beginPath(); g.moveTo(0, -0.9); g.bezierCurveTo(0.55, -0.9, 0.75, 0.2, 0.7, 0.4); g.bezierCurveTo(0.6, 0.85, -0.6, 0.85, -0.7, 0.4); g.bezierCurveTo(-0.75, 0.2, -0.55, -0.9, 0, -0.9);
    g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(-0.25, -0.3, 0.12, 0.25, 0.3, 0, 7); g.fill();
  };
  IC.wind = (g, c) => {
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 0.15;
    g.beginPath(); g.moveTo(-0.9, -0.35); g.lineTo(0.35, -0.35); g.arc(0.35, -0.6, 0.25, Math.PI / 2, -Math.PI * 0.8, true); g.stroke();
    g.beginPath(); g.moveTo(-0.9, 0.05); g.lineTo(0.6, 0.05); g.stroke();
    g.beginPath(); g.moveTo(-0.9, 0.42); g.lineTo(0.15, 0.42); g.arc(0.15, 0.65, 0.23, -Math.PI / 2, Math.PI * 0.8); g.stroke();
  };
  IC.mirror = (g, c) => {
    g.fillStyle = '#c9a050'; rrU(g, -0.12, 0.35, 0.24, 0.6, 0.08); g.fill(); ST(g, 0.06);
    g.beginPath(); g.ellipse(0, -0.25, 0.62, 0.68, 0, 0, 7); g.fill(); ST(g);
    g.beginPath(); g.ellipse(0, -0.25, 0.5, 0.56, 0, 0, 7); g.fillStyle = c; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.moveTo(-0.25, -0.55); g.lineTo(0.05, -0.75); g.moveTo(-0.3, -0.3); g.lineTo(0.15, -0.6); ST(g, 0.07);
  };
  IC.ghost = (g, c) => {
    g.beginPath(); g.moveTo(-0.7, 0.85); g.lineTo(-0.7, -0.2); g.arc(0, -0.2, 0.7, Math.PI, 0); g.lineTo(0.7, 0.85);
    for (let i = 0; i < 4; i++) { const x = 0.7 - (i + 0.5) * 0.35; g.quadraticCurveTo(x, 0.55, x - 0.175, 0.85); }
    g.closePath(); g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = '#1a1020'; g.beginPath(); g.ellipse(-0.25, -0.2, 0.12, 0.18, 0, 0, 7); g.ellipse(0.25, -0.2, 0.12, 0.18, 0, 0, 7); g.fill();
  };
  IC.puppet = (g, c) => {
    g.strokeStyle = '#c9a050'; g.lineCap = 'round'; g.lineWidth = 0.14; g.beginPath(); g.moveTo(-0.8, -0.8); g.lineTo(0.8, -0.8); g.moveTo(0, -0.95); g.lineTo(0, -0.6); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-0.75, -0.8); g.lineTo(-0.45, 0.1); g.moveTo(0.75, -0.8); g.lineTo(0.45, 0.1); g.moveTo(0, -0.6); g.lineTo(0, -0.35); g.stroke();
    g.fillStyle = c; g.beginPath(); g.arc(0, -0.2, 0.2, 0, 7); g.fill(); ST(g, 0.05);
    P(g, [-0.3, 0.05, 0.3, 0.05, 0.4, 0.6, -0.4, 0.6]); g.fill(); ST(g, 0.05);
    g.strokeStyle = c; g.lineWidth = 0.12; g.beginPath(); g.moveTo(-0.3, 0.1); g.lineTo(-0.45, 0.1); g.moveTo(0.3, 0.1); g.lineTo(0.45, 0.1); g.moveTo(-0.2, 0.6); g.lineTo(-0.25, 0.95); g.moveTo(0.2, 0.6); g.lineTo(0.25, 0.95); g.stroke();
  };
  IC.scepter = (g, c) => {
    g.strokeStyle = '#c9a050'; g.lineCap = 'round'; g.lineWidth = 0.16; g.beginPath(); g.moveTo(-0.55, 0.9); g.lineTo(0.3, -0.3); g.stroke();
    g.beginPath(); g.arc(0.42, -0.5, 0.3, 0, 7); g.fillStyle = c; g.fill(); ST(g);
    starPath(g, 0.42, -0.5, 0.2, 0.08, 4); g.fillStyle = '#fff'; g.fill();
  };
  IC.bomb = (g, c) => {
    g.beginPath(); g.arc(-0.1, 0.2, 0.65, 0, 7); g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-0.3, 0, 0.15, 0, 7); g.fill();
    g.strokeStyle = '#c9a050'; g.lineWidth = 0.1; g.beginPath(); g.moveTo(0.3, -0.3); g.quadraticCurveTo(0.5, -0.7, 0.75, -0.6); g.stroke();
    starPath(g, 0.8, -0.65, 0.25, 0.1, 6); g.fillStyle = '#ffd23f'; g.fill();
  };
  IC.bolt = (g, c) => { P(g, [0.2, -0.95, -0.6, 0.15, -0.05, 0.15, -0.25, 0.95, 0.6, -0.2, 0.05, -0.2]); g.fillStyle = c; g.fill(); ST(g); };
  IC.face = (g, c) => {
    g.beginPath(); g.arc(0, 0, 0.82, 0, 7); g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = '#1a1020'; rrU(g, -0.65, -0.3, 0.55, 0.3, 0.1); g.fill(); rrU(g, 0.1, -0.3, 0.55, 0.3, 0.1); g.fill(); g.fillRect(-0.15, -0.22, 0.3, 0.07);
    g.fillRect(-0.35, 0.35, 0.7, 0.09);
  };
  IC.rain = (g, c) => {
    g.fillStyle = '#c8d0e0'; g.beginPath(); g.arc(-0.35, -0.2, 0.35, 0, 7); g.arc(0.15, -0.4, 0.42, 0, 7); g.arc(0.5, -0.1, 0.3, 0, 7); g.fill();
    g.fillRect(-0.35, -0.2, 0.85, 0.4);
    g.fillStyle = c; for (const p of [[-0.4, 0.5], [0.05, 0.7], [0.5, 0.5]]) { g.beginPath(); g.moveTo(p[0], p[1] - 0.25); g.quadraticCurveTo(p[0] + 0.14, p[1], p[0], p[1] + 0.1); g.quadraticCurveTo(p[0] - 0.14, p[1], p[0], p[1] - 0.25); g.fill(); }
  };
  IC.road = (g, c) => {
    P(g, [-0.25, -0.9, 0.25, -0.9, 0.9, 0.9, -0.9, 0.9]); g.fillStyle = '#3a3a48'; g.fill(); ST(g);
    g.fillStyle = c; for (let i = 0; i < 3; i++) { const y = -0.7 + i * 0.55, w = 0.04 + i * 0.03; g.fillRect(-w, y, w * 2, 0.25 + i * 0.05); }
  };
  IC.tri = (g, c) => {
    P(g, [0, -0.75, 0.8, 0.6, -0.8, 0.6]); g.strokeStyle = c; ST(g, 0.12);
    g.fillStyle = c; for (const p of [[0, -0.75], [0.8, 0.6], [-0.8, 0.6]]) { g.beginPath(); g.arc(p[0], p[1], 0.26, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; ST(g, 0.06); }
  };
  IC.square = (g, c) => {
    g.strokeStyle = c; g.strokeRect(-0.6, -0.6, 1.2, 1.2); g.lineWidth = 0.12; g.strokeRect(-0.6, -0.6, 1.2, 1.2);
    g.fillStyle = c; for (const p of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { g.beginPath(); g.arc(p[0], p[1], 0.25, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; ST(g, 0.06); }
  };
  IC.sun = (g, c) => {
    g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = 0.12;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(Math.cos(a) * 0.6, Math.sin(a) * 0.6); g.lineTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92); g.stroke(); }
    g.beginPath(); g.arc(0, 0, 0.45, 0, 7); g.fillStyle = c; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.6)'; ST(g, 0.08);
  };
  IC.key = (g, c) => {
    g.beginPath(); g.arc(-0.45, 0, 0.38, 0, 7); g.fillStyle = c; g.fill(); ST(g);
    g.fillStyle = '#20142e'; g.beginPath(); g.arc(-0.45, 0, 0.14, 0, 7); g.fill();
    g.fillStyle = c; g.fillRect(-0.1, -0.1, 1, 0.2); g.fillRect(0.55, 0.05, 0.12, 0.3); g.fillRect(0.75, 0.05, 0.12, 0.22);
  };
  IC.slot = (g, c) => {
    rrU(g, -0.85, -0.3, 1.7, 1.1, 0.12); g.fillStyle = c; g.fill(); ST(g);
    rrU(g, -0.55, -0.85, 1.1, 0.5, 0.08); g.fillStyle = '#20142e'; g.fill(); ST(g, 0.07);
    g.font = '900 0.38px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5bff9a'; g.fillText('$$$', 0, -0.58);
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) g.fillRect(-0.6 + k * 0.45, -0.1 + r * 0.3, 0.3, 0.2);
    g.fillRect(-0.85, 0.58, 1.7, 0.08);
  };

  function icon(g, name, cx, cy, size, col) {
    const f = IC[name] || IC.star;
    g.save(); g.translate(cx, cy); g.scale(size / 2, size / 2);
    g.lineJoin = 'round'; g.strokeStyle = 'rgba(10,6,20,0.85)'; g.lineWidth = 0.1;
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 0;
    f(g, col);
    g.restore();
  }
  A.icon = icon;

  // ---------- tiles ----------
  const RAR_COL = ['', '#6fb4ff', '#4fe08a', '#ff4fa8'];
  function tileFrame(g, bg0, bg1, edge, glow) {
    rr(g, 3, 3, TW - 6, TH - 6, 16);
    const gr = g.createLinearGradient(0, 0, 0, TH); gr.addColorStop(0, bg0); gr.addColorStop(1, bg1);
    g.fillStyle = gr; g.fill();
    g.save(); rr(g, 3, 3, TW - 6, TH - 6, 16); g.clip();
    const rg = g.createRadialGradient(TW / 2, TH * 0.44, 4, TW / 2, TH * 0.44, TW * 0.7);
    rg.addColorStop(0, glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, TW, TH);
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    for (let y = 0; y < TH; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(TW, y); g.stroke(); }
    g.restore();
    rr(g, 3, 3, TW - 6, TH - 6, 16); g.lineWidth = 5; g.strokeStyle = edge; g.stroke();
    rr(g, 11, 11, TW - 22, TH - 22, 10); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.stroke();
  }
  A.charmURL = function (id) {
    const d = HC.CHARM[id];
    return memo('h' + id, TW, TH, (g) => {
      tileFrame(g, hsl(d.hue, 40, 20), hsl(d.hue, 45, 8), RAR_COL[d.r], hsl(d.hue, 90, 55, 0.45));
      icon(g, d.icon, TW / 2, TH * 0.44, 98, hsl(d.hue, 85, 62));
      for (let i = 0; i < d.r; i++) { g.fillStyle = RAR_COL[d.r]; g.beginPath(); g.arc(TW / 2 + (i - (d.r - 1) / 2) * 16, TH - 24, 5, 0, 7); g.fill(); }
    });
  };
  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII'];
  A.omenURL = function (id) {
    const o = HC.OMEN[id];
    const n = HC.OMENS.indexOf(o) + 1;
    return memo('o' + id, TW, TH, (g) => {
      tileFrame(g, '#3a1a6a', '#14082a', '#c79aff', 'rgba(190,120,255,0.45)');
      g.strokeStyle = 'rgba(255,220,140,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(TW / 2, TH * 0.42, 52, 0, 7); g.stroke();
      icon(g, o.icon, TW / 2, TH * 0.42, 80, hsl(o.hue, 80, 65));
      g.font = '900 24px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffdc8a'; g.fillText(ROMAN[n] || n, TW / 2, TH - 30);
    });
  };
  A.starURL = function (id) {
    const s = HC.STAR[id];
    return memo('s' + id, TW, TH, (g) => {
      tileFrame(g, '#0c2a48', '#03101e', '#5ad8ff', hsl(s.hue, 90, 60, 0.4));
      g.fillStyle = 'rgba(255,255,255,0.8)';
      let seed = s.hue + 3; const rn = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 26; i++) { g.globalAlpha = 0.3 + rn() * 0.6; g.beginPath(); g.arc(14 + rn() * (TW - 28), 14 + rn() * (TH - 50), rn() * 1.8 + 0.4, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      const cx = TW / 2, cy = TH * 0.42;
      const rg = g.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, 38); rg.addColorStop(0, hsl(s.hue, 100, 85)); rg.addColorStop(0.6, hsl(s.hue, 85, 58)); rg.addColorStop(1, hsl(s.hue, 80, 30));
      g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, 36, 0, 7); g.fill();
      g.strokeStyle = hsl(s.hue, 90, 75, 0.85); g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, 62, 16, -0.35, 0, 7); g.stroke();
      g.fillStyle = hsl(s.hue, 100, 85); starPath(g, cx + 48, cy - 34, 10, 4); g.fill();
      g.font = '900 17px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#cfefff';
      g.fillText(HC.HAND[s.hand].name.toUpperCase(), TW / 2, TH - 30);
    });
  };
  A.voucherURL = function (id) {
    const v = HC.VOUCHER[id];
    return memo('v' + id, TW, TH, (g) => {
      tileFrame(g, '#4a3208', '#1e1202', '#ffd23f', 'rgba(255,210,63,0.4)');
      g.setLineDash([6, 5]); rr(g, 20, 20, TW - 40, TH - 40, 8); g.strokeStyle = 'rgba(255,220,120,0.6)'; g.lineWidth = 2; g.stroke(); g.setLineDash([]);
      icon(g, v.icon, TW / 2, TH * 0.42, 78, '#ffd23f');
      g.font = '900 16px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe9a0'; g.fillText('VOUCHER', TW / 2, TH - 32);
    });
  };
  const PACK_COL = { charm: [215, '#6fb4ff'], omen: [275, '#c79aff'], star: [195, '#5ad8ff'], card: [350, '#ff6a8a'] };
  A.packURL = function (pid) {
    const p = HC.PACKS[pid];
    const pc = PACK_COL[p.kind];
    return memo('p' + pid, TW, TH, (g) => {
      g.beginPath();
      const top = 14, bot = TH - 14;
      g.moveTo(10, top); for (let x = 10; x <= TW - 10; x += 10) g.lineTo(x + 5, x % 20 ? top - 6 : top); g.lineTo(TW - 10, top);
      g.lineTo(TW - 16, bot); for (let x = TW - 16; x >= 16; x -= 10) g.lineTo(x - 5, x % 20 ? bot + 6 : bot); g.lineTo(16, bot); g.closePath();
      const gr = g.createLinearGradient(0, 0, TW, TH); gr.addColorStop(0, hsl(pc[0], 70, 55)); gr.addColorStop(0.5, hsl(pc[0], 60, 30)); gr.addColorStop(1, hsl(pc[0], 75, 50));
      g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = pc[1]; g.stroke();
      g.save(); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(0, 70); g.lineTo(TW, 20); g.lineTo(TW, 44); g.lineTo(0, 98); g.fill();
      g.restore();
      const ic = { charm: 'star', omen: 'eye', star: 'sun', card: 'cards' }[p.kind];
      icon(g, ic, TW / 2, TH * 0.43, 70, '#fff3c4');
      g.font = '900 20px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.fillText(p.kind.toUpperCase(), TW / 2, TH - 52);
      if (p.pick > 1 || p.n > 3) { rr(g, TW / 2 - 34, 30, 68, 24, 12); g.fillStyle = '#ffd23f'; g.fill(); g.fillStyle = '#2a1404'; g.font = '900 15px ' + FONT; g.fillText('MEGA', TW / 2, 43); }
    });
  };
  const BOSS_IC = { bleed: 'heart', tarnish: 'diamond', thicket: 'club', eclipse: 'spade', purist: 'crown', edict: 'scepter', ledger: 'map', veil: 'ghost', mask: 'mask', cutpurse: 'hand',
    taxman: 'bag', monolith: 'rock', anvil: 'anvil', quintet: 'hand', longshot: 'arrow', drought: 'sun', shackle: 'key', leech: 'drop', static: 'bolt',
    crimson: 'crown', lasthouse: 'cards', midnight: 'moon', dealerboss: 'eye' };
  A.chipURL = function (kind) { // 'small' | 'big' | boss id
    return memo('k' + kind, 160, 160, (g) => {
      const b = HC.BOSS[kind];
      const col = b ? b.color : kind === 'small' ? '#2f7fe8' : '#e8902f';
      g.translate(80, 80);
      g.beginPath(); g.arc(0, 0, 74, 0, 7); g.fillStyle = col; g.fill();
      g.fillStyle = '#f7f3ea';
      for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4); g.fillRect(-9, -74, 18, 18); g.restore(); }
      g.beginPath(); g.arc(0, 0, 74, 0, 7); g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
      g.beginPath(); g.arc(0, 0, 52, 0, 7); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fill();
      g.setLineDash([8, 6]); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 52, 0, 7); g.stroke(); g.setLineDash([]);
      if (b) icon(g, BOSS_IC[b.id] || 'skull', 0, 0, 64, '#fff');
      else { g.font = '900 54px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(kind === 'small' ? 'S' : 'B', 0, 3); }
    });
  };
  A.stakeURL = function (i) {
    const s = HC.STAKES[i];
    return memo('t' + i, 96, 96, (g) => {
      g.translate(48, 48);
      const gr = g.createRadialGradient(-12, -14, 4, 0, 0, 44); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, s.color); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.beginPath(); g.arc(0, 0, 42, 0, 7); g.fillStyle = s.color; g.fill(); g.fillStyle = gr; g.globalAlpha = 0.6; g.fill(); g.globalAlpha = 1;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.stroke();
      g.beginPath(); g.arc(0, 0, 30, 0, 7); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
      g.font = '900 30px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(['1¢', '5¢', '10¢', '25¢', '$1'][i], 0, 2);
    });
  };
  A.feltURL = function () {
    return memo('felt', 256, 256, (g) => {
      g.fillStyle = '#0c3a2c'; g.fillRect(0, 0, 256, 256);
      const id = g.getImageData(0, 0, 256, 256), d = id.data;
      let seed = 99;
      for (let i = 0; i < d.length; i += 4) { seed = (seed * 16807) % 2147483647; const n = (seed / 2147483647 - 0.5) * 22; d[i] += n; d[i + 1] += n * 1.2; d[i + 2] += n; }
      g.putImageData(id, 0, 0);
    });
  };
})(window.HC);
