'use strict';
// LUCKY REELS — procedural sticker-style art for every symbol, item and landlord. Drawn in a 100x100 unit box
// with bold dark outlines, cached as sprites per pixel size.
(function (LR) {
  const TAU = Math.PI * 2;
  const OL = '#1a0e24';
  let g = null;

  // ---------- primitives ----------
  function circ(x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function ell(x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function rr(x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function poly(p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
  function starP(x, y, r1, r2, n, rot) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = (rot || -Math.PI / 2) + i * Math.PI / n, r = i & 1 ? r2 : r1; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath();
  }
  function fo(fill, lw) { g.fillStyle = fill; g.fill(); g.lineWidth = lw === undefined ? 5 : lw; if (g.lineWidth > 0) { g.strokeStyle = OL; g.stroke(); } }
  function fl(fill) { g.fillStyle = fill; g.fill(); }
  function ln(pts, w, col) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineWidth = w; g.strokeStyle = col || OL; g.stroke(); }
  function qc(x1, y1, cx, cy, x2, y2, w, col) { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.lineWidth = w; g.strokeStyle = col || OL; g.stroke(); }
  function dot(x, y, r, col) { circ(x, y, r); fl(col); }
  function hl(x, y, rx, ry, rot) { ell(x, y, rx, ry, rot || -0.5); fl('rgba(255,255,255,0.55)'); }
  function eyes(x1, x2, y, r, col) { dot(x1, y, r, col || OL); dot(x2, y, r, col || OL); dot(x1 + r * 0.35, y - r * 0.35, r * 0.38, '#fff'); dot(x2 + r * 0.35, y - r * 0.35, r * 0.38, '#fff'); }
  function sparkle(x, y, r, col) { starP(x, y, r, r * 0.28, 4, 0); fl(col || '#fff7c2'); }
  function txt(s, x, y, size, fill, stroke) {
    g.font = '900 ' + size + 'px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = 6; g.strokeStyle = OL; g.strokeText(s, x, y); }
    g.fillStyle = fill; g.fillText(s, x, y);
  }
  function face(x, y, r, skin) { circ(x, y, r); fo(skin); }
  function gemFacets(cx, cy, w, h, base, light, dark) {
    // brilliant cut seen from the side: crown + pavilion
    const t = cy - h * 0.45, m = cy - h * 0.1, b = cy + h * 0.55;
    poly([cx - w * 0.3, t, cx + w * 0.3, t, cx + w * 0.5, m, cx, b, cx - w * 0.5, m]); fo(base);
    poly([cx - w * 0.3, t, cx - w * 0.1, m, cx - w * 0.5, m]); fl(light);
    poly([cx + w * 0.3, t, cx + w * 0.1, m, cx + w * 0.5, m]); fl(dark);
    poly([cx - w * 0.1, m, cx + w * 0.1, m, cx, b]); fl(light);
    poly([cx + w * 0.1, m, cx + w * 0.5, m, cx, b]); fl(dark);
    ln([cx - w * 0.5, m, cx + w * 0.5, m], 3);
    poly([cx - w * 0.3, t, cx + w * 0.3, t, cx + w * 0.5, m, cx, b, cx - w * 0.5, m]); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
  }
  function dieFace(x, y, s, fill, pip, n) {
    rr(x - s / 2, y - s / 2, s, s, s * 0.2); fo(fill);
    const o = s * 0.26, P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
    for (const p of P) dot(x + p[0] * o, y + p[1] * o, s * 0.09, pip);
  }
  function hatBrim(x, y, w, col) { ell(x, y, w, w * 0.18); fo(col); }

  // ---------- SYMBOLS ----------
  const SYM = {
    coin() { circ(50, 52, 34); fo('#f5a623'); circ(50, 50, 34); fo('#ffd046'); circ(50, 50, 24); g.lineWidth = 4; g.strokeStyle = '#d98a12'; g.stroke(); starP(50, 51, 14, 6, 5); fl('#f2a516'); hl(36, 34, 9, 5); },
    cherry() {
      qc(36, 62, 42, 30, 58, 18, 5); qc(66, 58, 64, 32, 58, 18, 5);
      g.beginPath(); g.moveTo(58, 18); g.quadraticCurveTo(76, 8, 84, 22); g.quadraticCurveTo(70, 28, 58, 18); fo('#3fbf5f', 4);
      circ(34, 66, 17); fo('#ff2d55'); circ(66, 62, 17); fo('#ff2d55'); hl(28, 59, 5, 3); hl(60, 55, 5, 3);
    },
    pearl() { ell(50, 76, 30, 9); fo('#6f4f8f', 4); circ(50, 50, 25); fo('#f6eefc'); g.beginPath(); g.arc(50, 50, 25, 0.2, 2.6); g.lineWidth = 7; g.strokeStyle = 'rgba(190,160,220,0.6)'; g.stroke(); circ(50, 50, 25); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); hl(41, 40, 8, 5); dot(60, 43, 2.5, '#fff'); },
    flower() {
      ln([50, 60, 50, 92], 6, OL); ln([50, 60, 50, 92], 3, '#3fbf5f');
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; circ(50 + Math.cos(a) * 18, 44 + Math.sin(a) * 18, 14); fo('#ff7ac8'); }
      circ(50, 44, 11); fo('#ffd23d'); hl(46, 40, 4, 2.5);
    },
    cat() {
      poly([22, 44, 26, 12, 46, 30]); fo('#ff9f43'); poly([78, 44, 74, 12, 54, 30]); fo('#ff9f43');
      poly([27, 34, 29, 20, 39, 30]); fl('#ffc6d3'); poly([73, 34, 71, 20, 61, 30]); fl('#ffc6d3');
      ell(50, 56, 34, 30); fo('#ff9f43');
      ln([28, 40, 36, 46], 4, '#d9731a'); ln([72, 40, 64, 46], 4, '#d9731a');
      ell(38, 54, 6, 8); fl(OL); ell(62, 54, 6, 8); fl(OL); dot(40, 51, 2.2, '#fff'); dot(64, 51, 2.2, '#fff');
      poly([46, 64, 54, 64, 50, 69]); fl('#ff5d8f');
      ln([10, 64, 30, 66], 2.5); ln([10, 72, 30, 70], 2.5); ln([90, 64, 70, 66], 2.5); ln([90, 72, 70, 70], 2.5);
      qc(44, 72, 50, 77, 56, 72, 3);
    },
    milk() {
      poly([28, 34, 50, 14, 72, 34]); fo('#e9f1ff'); rr(28, 34, 44, 54, 4); fo('#ffffff');
      rr(28, 50, 44, 20, 0); fl('#3d8bff'); g.beginPath(); g.moveTo(50, 52); g.quadraticCurveTo(58, 62, 50, 66); g.quadraticCurveTo(42, 62, 50, 52); fl('#fff');
      rr(28, 34, 44, 54, 4); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); rr(44, 8, 12, 8, 2); fo('#3d8bff', 4);
    },
    ore() { poly([18, 66, 26, 36, 48, 22, 74, 30, 84, 58, 70, 80, 34, 82]); fo('#8b8fa8'); poly([26, 36, 48, 22, 52, 44, 34, 52]); fl('#a7abc2'); dot(40, 62, 6, '#ffb03a'); dot(62, 46, 5, '#ffb03a'); dot(64, 68, 4, '#ffd46a'); dot(38, 40, 3, '#ffd46a'); },
    bee() {
      ell(36, 30, 14, 18, -0.5); fo('rgba(200,235,255,0.9)', 4); ell(64, 30, 14, 18, 0.5); fo('rgba(200,235,255,0.9)', 4);
      ell(50, 58, 28, 22); fo('#ffd23d');
      g.save(); ell(50, 58, 28, 22); g.clip(); g.fillStyle = OL; g.fillRect(36, 30, 8, 60); g.fillRect(54, 30, 8, 60); g.restore();
      ell(50, 58, 28, 22); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
      poly([78, 58, 90, 62, 78, 66]); fo('#1a0e24', 3); dot(30, 54, 4, OL); dot(31, 52.5, 1.5, '#fff');
      ln([28, 40, 22, 28], 3); ln([34, 38, 32, 26], 3);
    },
    seed() { g.beginPath(); g.moveTo(50, 30); g.bezierCurveTo(76, 44, 72, 86, 50, 86); g.bezierCurveTo(28, 86, 24, 44, 50, 30); fo('#b8763a'); ln([50, 40, 50, 76], 3, '#8a5426'); g.beginPath(); g.moveTo(50, 30); g.quadraticCurveTo(50, 12, 70, 12); g.quadraticCurveTo(66, 30, 50, 30); fo('#4bd16b', 4); hl(42, 50, 4, 8, 0.3); },
    egg() { g.beginPath(); g.moveTo(50, 14); g.bezierCurveTo(78, 14, 84, 86, 50, 86); g.bezierCurveTo(16, 86, 22, 14, 50, 14); fo('#fff4e0'); hl(40, 36, 6, 10, 0.3); dot(60, 60, 3, '#e8d6b8'); dot(54, 70, 2, '#e8d6b8'); },
    dog() {
      ell(50, 52, 28, 30); fo('#c98b4f');
      ell(22, 46, 11, 22, 0.25); fo('#7a4a24'); ell(78, 46, 11, 22, -0.25); fo('#7a4a24');
      ell(50, 66, 16, 12); fo('#f0d2a8', 4); eyes(39, 61, 46, 5); ell(50, 60, 7, 5); fl(OL);
      g.beginPath(); g.moveTo(45, 72); g.quadraticCurveTo(50, 86, 55, 72); fo('#ff6b8b', 3);
    },
    clover() {
      ln([50, 54, 60, 90], 6); ln([50, 54, 60, 90], 3, '#2f9e4a');
      for (let i = 0; i < 4; i++) { g.save(); g.translate(50, 48); g.rotate(i * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-22, -10, -18, -32, -4, -28); g.lineTo(0, -22); g.lineTo(4, -28); g.bezierCurveTo(18, -32, 22, -10, 0, 0); fo('#3ccf62'); g.restore(); }
      dot(50, 48, 4, '#2f9e4a'); hl(38, 34, 4, 3);
    },
    die() { g.save(); g.translate(50, 52); g.rotate(-0.15); dieFace(0, 0, 58, '#ffffff', OL, 3); g.restore(); hl(32, 32, 6, 4); },
    shell() {
      g.beginPath(); g.moveTo(50, 86); g.lineTo(16, 46); g.quadraticCurveTo(50, 2, 84, 46); g.closePath(); fo('#ffb38a');
      for (let i = -2; i <= 2; i++) ln([50, 84, 50 + i * 15, 26 + Math.abs(i) * 6], 3, '#d9774f');
      poly([40, 84, 60, 84, 56, 92, 44, 92]); fo('#ffb38a', 4);
    },
    fish() {
      poly([20, 50, 6, 32, 8, 68]); fo('#2fa8ff'); ell(50, 50, 32, 20); fo('#3dc2ff');
      g.beginPath(); g.moveTo(40, 32); g.quadraticCurveTo(52, 16, 64, 32); fo('#2fa8ff', 4);
      ln([30, 38, 34, 50, 30, 62], 3, '#2486d6'); dot(68, 46, 5, OL); dot(69.5, 44.5, 1.8, '#fff'); qc(74, 58, 78, 60, 82, 56, 3); hl(52, 40, 10, 4, -0.1);
    },
    owl() {
      poly([24, 30, 30, 10, 42, 26]); fo('#8a5a3a'); poly([76, 30, 70, 10, 58, 26]); fo('#8a5a3a');
      ell(50, 56, 30, 34); fo('#8a5a3a'); ell(50, 66, 18, 20); fl('#d9b48a');
      circ(38, 44, 12); fo('#fff'); circ(62, 44, 12); fo('#fff'); dot(38, 44, 7, '#ffb000'); dot(62, 44, 7, '#ffb000'); dot(38, 44, 4, OL); dot(62, 44, 4, OL);
      poly([46, 54, 54, 54, 50, 62]); fo('#ff9a1f', 3);
      for (let i = 0; i < 3; i++) qc(40 + i * 7, 70 + (i & 1) * 4, 43 + i * 7, 74 + (i & 1) * 4, 46 + i * 7, 70 + (i & 1) * 4, 2.5, '#a77a52');
    },
    bat() {
      g.beginPath(); g.moveTo(50, 40); g.quadraticCurveTo(30, 22, 6, 32); g.quadraticCurveTo(16, 44, 12, 60); g.quadraticCurveTo(24, 52, 30, 64); g.quadraticCurveTo(38, 54, 50, 66);
      g.quadraticCurveTo(62, 54, 70, 64); g.quadraticCurveTo(76, 52, 88, 60); g.quadraticCurveTo(84, 44, 94, 32); g.quadraticCurveTo(70, 22, 50, 40); fo('#5b3d8f');
      poly([40, 36, 42, 22, 48, 32]); fo('#4a2f78', 4); poly([60, 36, 58, 22, 52, 32]); fo('#4a2f78', 4);
      ell(50, 46, 12, 14); fo('#4a2f78'); dot(45, 44, 3, '#ffe14a'); dot(55, 44, 3, '#ffe14a'); poly([46, 52, 48, 56, 50, 52]); fl('#fff'); poly([50, 52, 52, 56, 54, 52]); fl('#fff');
    },
    candle() {
      g.beginPath(); g.moveTo(50, 8); g.quadraticCurveTo(64, 26, 50, 34); g.quadraticCurveTo(36, 26, 50, 8); fo('#ff9a1f', 4);
      g.beginPath(); g.moveTo(50, 18); g.quadraticCurveTo(57, 27, 50, 31); g.quadraticCurveTo(43, 27, 50, 18); fl('#ffe36a');
      rr(34, 36, 32, 50, 5); fo('#fff1d0'); ln([50, 34, 50, 38], 3); g.beginPath(); g.moveTo(34, 44); g.quadraticCurveTo(42, 44, 42, 58); g.quadraticCurveTo(46, 50, 50, 46); fl('#f5dca6');
      ell(50, 88, 28, 6); fo('#c79a5a', 4);
    },
    banana() {
      g.beginPath(); g.moveTo(22, 26); g.quadraticCurveTo(14, 70, 60, 82); g.quadraticCurveTo(86, 84, 84, 74); g.quadraticCurveTo(46, 70, 36, 24); g.closePath(); fo('#ffe14a');
      qc(30, 34, 30, 66, 62, 76, 3, '#e3b81e'); rr(17, 16, 14, 12, 3); fo('#7a5a2a', 4); dot(84, 76, 3, '#7a5a2a');
    },
    pumpkin() {
      ell(30, 58, 18, 26); fo('#ff8a1f'); ell(70, 58, 18, 26); fo('#ff8a1f'); ell(50, 58, 20, 28); fo('#ff9f2f');
      g.beginPath(); g.moveTo(48, 32); g.quadraticCurveTo(46, 18, 56, 14); ln([48, 32, 48, 32], 1); g.lineWidth = 7; g.strokeStyle = OL; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = '#3f9a3a'; g.stroke();
      hl(44, 44, 4, 8, 0.1);
    },
    bubble() { circ(50, 50, 30); g.fillStyle = 'rgba(120,230,255,0.22)'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#6fe3ff'; g.stroke(); g.beginPath(); g.arc(50, 50, 22, 3.6, 4.6); g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.stroke(); dot(66, 64, 4, 'rgba(255,255,255,0.8)'); circ(22, 80, 7); g.lineWidth = 3; g.strokeStyle = '#6fe3ff'; g.stroke(); circ(82, 22, 5); g.stroke(); },
    mouse() {
      qc(74, 70, 92, 74, 88, 92, 4, '#ff9ab5');
      circ(28, 30, 16); fo('#a8a8c0'); circ(72, 30, 16); fo('#a8a8c0'); circ(28, 30, 9); fl('#ffb6c8'); circ(72, 30, 9); fl('#ffb6c8');
      ell(50, 58, 26, 24); fo('#b9b9d0'); eyes(41, 59, 52, 4.5); dot(50, 64, 5, '#ff6b8b');
      ln([24, 62, 40, 64], 2); ln([24, 70, 40, 68], 2); ln([76, 62, 60, 64], 2); ln([76, 70, 60, 68], 2);
    },
    coal() { poly([20, 62, 30, 34, 56, 24, 80, 38, 82, 66, 62, 82, 32, 80]); fo('#2b2738'); poly([30, 34, 56, 24, 52, 50, 36, 56]); fl('#4a4560'); poly([56, 24, 80, 38, 64, 52, 52, 50]); fl('#3a364c'); dot(66, 64, 3, '#6a6585'); },
    caterpillar() {
      for (let i = 0; i < 4; i++) { circ(22 + i * 15, 62 - (i % 2) * 6, 13); fo(i % 2 ? '#8be04e' : '#6fcf3a'); }
      circ(78, 46, 16); fo('#8be04e'); eyes(73, 84, 44, 3.5); qc(74, 52, 79, 56, 84, 52, 2.5);
      ln([74, 32, 68, 20], 3); ln([84, 32, 88, 20], 3); dot(68, 20, 3, '#ff5d8f'); dot(88, 20, 3, '#ff5d8f');
    },
    miner() {
      face(50, 58, 26, '#ffcc9a'); eyes(41, 59, 60, 4); qc(42, 70, 50, 76, 58, 70, 3);
      g.beginPath(); g.moveTo(22, 50); g.quadraticCurveTo(22, 20, 50, 20); g.quadraticCurveTo(78, 20, 78, 50); g.closePath(); fo('#ffd23d'); hatBrim(50, 50, 32, '#f0b81e');
      circ(50, 34, 9); fo('#fff7c2'); dot(50, 34, 4, '#ffe36a');
      g.beginPath(); g.moveTo(58, 34); g.lineTo(96, 18); g.lineTo(96, 50); g.closePath(); g.fillStyle = 'rgba(255,240,160,0.18)'; g.fill();
    },
    bigore() { poly([10, 64, 18, 32, 44, 14, 76, 20, 92, 50, 82, 82, 40, 90, 16, 82]); fo('#7d8299'); poly([18, 32, 44, 14, 50, 40, 26, 50]); fl('#9da1b8'); ln([30, 70, 46, 56, 56, 62, 72, 44], 5, '#ffb03a'); dot(30, 70, 6, '#ffd46a'); dot(72, 44, 7, '#ffd46a'); dot(58, 76, 5, '#ffb03a'); dot(46, 34, 4, '#ffd46a'); },
    cow() {
      poly([20, 30, 8, 18, 22, 22]); fo('#f5e6c8', 4); poly([80, 30, 92, 18, 78, 22]); fo('#f5e6c8', 4);
      ell(16, 40, 12, 7, -0.3); fo('#fff'); ell(84, 40, 12, 7, 0.3); fo('#fff');
      ell(50, 46, 28, 28); fo('#ffffff'); ell(36, 34, 10, 8, 0.4); fl(OL); ell(64, 52, 7, 9); fl(OL);
      eyes(40, 60, 44, 4); ell(50, 70, 22, 15); fo('#ffb6c8'); ell(42, 70, 4, 5); fl('#d9708f'); ell(58, 70, 4, 5); fl('#d9708f');
    },
    cheese() { poly([12, 70, 88, 52, 88, 80, 12, 86]); fo('#ffcd3a'); poly([12, 70, 70, 26, 88, 52]); fo('#ffe07a'); dot(30, 78, 5, '#e0a414'); dot(56, 70, 7, '#e0a414'); dot(76, 76, 4, '#e0a414'); dot(60, 46, 4, '#f0c03a'); },
    rose() {
      ln([50, 60, 50, 94], 6); ln([50, 60, 50, 94], 3, '#2f9e4a'); ell(38, 78, 10, 5, -0.6); fo('#3fbf5f', 4); ell(62, 74, 10, 5, 0.6); fo('#3fbf5f', 4);
      circ(50, 40, 24); fo('#e8243c'); g.beginPath(); g.arc(50, 40, 15, 0.4, 5.2); g.lineWidth = 4; g.strokeStyle = '#a3122a'; g.stroke(); g.beginPath(); g.arc(52, 40, 7, 3.4, 8.6); g.stroke(); hl(40, 30, 5, 3);
    },
    sunflower() {
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.save(); g.translate(50 + Math.cos(a) * 24, 48 + Math.sin(a) * 24); g.rotate(a); ell(0, 0, 12, 6); fo('#ffd02a', 3.5); g.restore(); }
      circ(50, 48, 18); fo('#7a4a1e'); for (let i = 0; i < 7; i++) { const a = i * TAU / 7; dot(50 + Math.cos(a) * 9, 48 + Math.sin(a) * 9, 2.2, '#4a2a10'); }
    },
    honey() {
      rr(26, 34, 48, 52, 14); fo('#ffb21a'); rr(22, 22, 56, 14, 5); fo('#c8742a');
      g.beginPath(); g.moveTo(30, 36); g.lineTo(70, 36); g.lineTo(70, 46); g.quadraticCurveTo(64, 56, 60, 46); g.quadraticCurveTo(52, 62, 46, 46); g.quadraticCurveTo(38, 54, 30, 46); g.closePath(); fl('#ffd25a');
      rr(36, 56, 28, 18, 4); fo('#fff4d0', 3); hl(34, 64, 3, 9, 0);
    },
    bear() {
      circ(26, 28, 12); fo('#8a5a3a'); circ(74, 28, 12); fo('#8a5a3a'); circ(26, 28, 6); fl('#5a3820'); circ(74, 28, 6); fl('#5a3820');
      circ(50, 54, 32); fo('#8a5a3a'); ell(50, 66, 15, 12); fo('#d9b48a', 4); eyes(39, 61, 48, 4.5); ell(50, 62, 6, 4); fl(OL); qc(44, 72, 50, 76, 56, 72, 3);
    },
    oyster() {
      g.beginPath(); g.moveTo(12, 56); g.quadraticCurveTo(50, 98, 88, 56); g.closePath(); fo('#9a87b5');
      g.beginPath(); g.moveTo(12, 52); g.quadraticCurveTo(50, 2, 88, 52); g.closePath(); fo('#b4a3cc');
      ln([28, 42, 50, 24, 72, 42], 3, '#8a77a5'); ell(50, 56, 30, 8); fl('#ffb6c8'); circ(50, 56, 9); fo('#f6eefc', 3.5); dot(47, 53, 2.5, '#fff');
    },
    crab() {
      circ(18, 32, 11); fo('#ff5a3a'); poly([18, 32, 30, 22, 30, 36]); fl('#2a1a3a'); circ(82, 32, 11); fo('#ff5a3a'); poly([82, 32, 70, 22, 70, 36]); fl('#2a1a3a');
      ln([24, 42, 34, 56], 5); ln([76, 42, 66, 56], 5);
      for (let i = 0; i < 3; i++) { ln([30, 66 + i * 6, 14, 72 + i * 8], 4); ln([70, 66 + i * 6, 86, 72 + i * 8], 4); }
      ell(50, 64, 26, 18); fo('#ff6a4a'); ln([42, 48, 40, 36], 3.5); ln([58, 48, 60, 36], 3.5); dot(40, 34, 5, '#fff'); dot(60, 34, 5, '#fff'); dot(40, 34, 2.5, OL); dot(60, 34, 2.5, OL);
      qc(44, 68, 50, 72, 56, 68, 3);
    },
    wolf() {
      poly([22, 44, 24, 10, 44, 30]); fo('#7d86a3'); poly([78, 44, 76, 10, 56, 30]); fo('#7d86a3');
      poly([20, 46, 50, 28, 80, 46, 70, 74, 50, 90, 30, 74]); fo('#8f98b5');
      poly([36, 66, 50, 58, 64, 66, 56, 88, 50, 90, 44, 88]); fl('#e6e9f5');
      poly([34, 46, 44, 44, 42, 52]); fl('#ffd23d'); poly([66, 46, 56, 44, 58, 52]); fl('#ffd23d'); dot(41, 48, 1.8, OL); dot(59, 48, 1.8, OL);
      ell(50, 76, 6, 4.5); fl(OL);
    },
    thief() {
      face(50, 56, 28, '#ffcc9a');
      g.beginPath(); g.moveTo(20, 46); g.quadraticCurveTo(22, 12, 50, 12); g.quadraticCurveTo(78, 12, 80, 46); g.closePath(); fo('#30304a'); rr(18, 40, 64, 10, 4); fo('#45456a');
      rr(22, 52, 56, 14, 7); fo(OL, 0); dot(38, 59, 4.5, '#fff'); dot(62, 59, 4.5, '#fff'); dot(39, 59, 2, OL); dot(63, 59, 2, OL);
      qc(42, 74, 50, 70, 58, 74, 3); dot(50, 12, 6, '#ff5a5a');
    },
    magpie() {
      poly([20, 70, 4, 86, 12, 66]); fo('#1e1e30'); ell(48, 60, 30, 20, -0.3); fo('#1e1e30');
      ell(52, 66, 16, 10, -0.3); fl('#f2f2fa'); g.beginPath(); g.moveTo(30, 56); g.quadraticCurveTo(50, 40, 66, 58); g.quadraticCurveTo(50, 60, 30, 56); fo('#2d6bff', 3.5);
      circ(72, 38, 14); fo('#1e1e30'); poly([84, 36, 96, 40, 84, 44]); fo('#ffb000', 3); dot(74, 34, 3, '#fff'); ln([46, 78, 44, 92], 3); ln([56, 78, 58, 92], 3);
      circ(90, 20, 6); fo('#ffd046', 3);
    },
    bomb() {
      circ(46, 58, 30); fo('#2b2b40'); hl(34, 44, 8, 5); rr(52, 22, 16, 14, 3); fo('#585878', 4);
      qc(62, 22, 66, 8, 80, 12, 4, '#c8a06a'); sparkle(82, 12, 11, '#ffe14a'); dot(82, 12, 3, '#ff6a1f');
    },
    luckydie() { g.save(); g.translate(48, 54); g.rotate(0.15); dieFace(0, 0, 58, '#ff3d6e', '#fff', 6); g.restore(); sparkle(80, 20, 12, '#ffe14a'); sparkle(18, 84, 7, '#ffe14a'); },
    bell() {
      g.beginPath(); g.moveTo(50, 14); g.quadraticCurveTo(24, 16, 24, 52); g.quadraticCurveTo(24, 66, 14, 72); g.lineTo(86, 72); g.quadraticCurveTo(76, 66, 76, 52); g.quadraticCurveTo(76, 16, 50, 14); fo('#ffcd3a');
      circ(50, 80, 9); fo('#f0a020'); circ(50, 12, 5); fo('#f0a020', 4); hl(38, 34, 5, 11, 0.2); ln([20, 72, 80, 72], 5);
    },
    bar() {
      rr(10, 30, 80, 40, 8); fo('#1e1e30'); rr(16, 36, 68, 28, 5); g.lineWidth = 3; g.strokeStyle = '#ffd046'; g.stroke();
      txt('BAR', 50, 51, 26, '#ffd046');
    },
    monkey() {
      circ(20, 46, 12); fo('#a0663a'); circ(80, 46, 12); fo('#a0663a'); circ(20, 46, 6); fl('#f0c896'); circ(80, 46, 6); fl('#f0c896');
      circ(50, 50, 30); fo('#a0663a');
      g.beginPath(); g.moveTo(50, 44); g.bezierCurveTo(30, 30, 24, 56, 34, 62); g.quadraticCurveTo(50, 84, 66, 62); g.bezierCurveTo(76, 56, 70, 30, 50, 44); fo('#f0c896', 4);
      eyes(42, 58, 48, 4); dot(46, 62, 2, OL); dot(54, 62, 2, OL); qc(42, 70, 50, 76, 58, 70, 3);
    },
    coconut() { circ(50, 52, 32); fo('#7a4a24'); for (let i = 0; i < 9; i++) { const a = i * 0.7; ln([50 + Math.cos(a) * 18, 52 + Math.sin(a) * 18, 50 + Math.cos(a) * 26, 52 + Math.sin(a) * 26], 2, '#5a3214'); } dot(42, 40, 4.5, '#3a200c'); dot(58, 40, 4.5, '#3a200c'); dot(50, 52, 4.5, '#3a200c'); hl(36, 34, 6, 4); },
    chick() {
      circ(50, 56, 30); fo('#ffe14a'); g.beginPath(); g.moveTo(26, 58); g.quadraticCurveTo(14, 66, 30, 72); fo('#f5c81e', 4);
      eyes(42, 60, 50, 4); poly([46, 58, 56, 58, 51, 66]); fo('#ff9a1f', 3); ln([50, 26, 46, 14], 4); ln([50, 26, 56, 16], 4); ln([44, 86, 44, 94], 4, '#ff9a1f'); ln([56, 86, 56, 94], 4, '#ff9a1f');
    },
    fox() {
      poly([18, 40, 22, 6, 44, 28]); fo('#ff7a1f'); poly([82, 40, 78, 6, 56, 28]); fo('#ff7a1f'); poly([22, 22, 22, 8, 31, 16]); fl(OL); poly([78, 22, 78, 8, 69, 16]); fl(OL);
      poly([14, 44, 50, 24, 86, 44, 50, 88]); fo('#ff8a2f'); poly([14, 44, 36, 56, 50, 88]); fl('#fff'); poly([86, 44, 64, 56, 50, 88]); fl('#fff');
      poly([14, 44, 50, 24, 86, 44, 50, 88]); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
      ell(38, 48, 3.5, 5, 0.3); fl(OL); ell(62, 48, 3.5, 5, -0.3); fl(OL); dot(50, 82, 5, OL);
    },
    key() {
      circ(30, 40, 18); fo('#ffcd3a'); circ(30, 40, 7); fo('#5a3a7a', 3.5); rr(42, 34, 46, 12, 4); fo('#ffcd3a');
      rr(70, 44, 8, 14, 2); fo('#ffcd3a', 4); rr(82, 44, 6, 10, 2); fo('#ffcd3a', 4); hl(24, 32, 4, 3);
    },
    piggy() {
      ell(48, 58, 34, 26); fo('#ff9ab5'); poly([30, 38, 30, 22, 42, 34]); fo('#ff8aa8', 4); poly([58, 34, 66, 20, 70, 38]); fo('#ff8aa8', 4);
      ell(82, 58, 9, 11); fo('#ff8aa8'); dot(80, 55, 2, '#c8506e'); dot(80, 61, 2, '#c8506e'); dot(64, 50, 3.5, OL);
      rr(38, 34, 18, 5, 2); fl('#c8506e'); rr(28, 78, 9, 12, 3); fo('#ff8aa8', 4); rr(56, 78, 9, 12, 3); fo('#ff8aa8', 4);
      qc(14, 54, 6, 50, 10, 42, 3); hl(36, 50, 8, 4);
    },
    star() { starP(50, 52, 38, 17, 5); fo('#ffd23d'); starP(50, 52, 22, 10, 5); fl('#ffe782'); eyes(43, 57, 50, 3); qc(45, 60, 50, 64, 55, 60, 2.5); },
    ghost() {
      g.beginPath(); g.moveTo(22, 86); g.lineTo(22, 46); g.quadraticCurveTo(22, 14, 50, 14); g.quadraticCurveTo(78, 14, 78, 46); g.lineTo(78, 86);
      g.quadraticCurveTo(72, 76, 64, 86); g.quadraticCurveTo(57, 76, 50, 86); g.quadraticCurveTo(43, 76, 36, 86); g.quadraticCurveTo(29, 76, 22, 86); fo('#f2f0ff');
      ell(40, 44, 5, 8); fl(OL); ell(60, 44, 5, 8); fl(OL); ell(50, 62, 6, 7); fl(OL); hl(34, 28, 5, 3);
    },
    lantern() {
      ell(28, 58, 18, 26); fo('#ff8a1f'); ell(72, 58, 18, 26); fo('#ff8a1f'); ell(50, 58, 22, 28); fo('#ff9f2f');
      poly([32, 48, 42, 42, 42, 54]); fo('#ffe14a', 3); poly([68, 48, 58, 42, 58, 54]); fo('#ffe14a', 3);
      poly([30, 66, 70, 66, 64, 76, 56, 72, 50, 78, 44, 72, 36, 76]); fo('#ffe14a', 3);
      ln([50, 30, 52, 16], 6); ln([50, 30, 52, 16], 3, '#3f9a3a');
    },
    farmer() {
      face(50, 60, 24, '#ffcc9a'); eyes(42, 58, 60, 3.8); qc(43, 70, 50, 75, 57, 70, 3); dot(36, 68, 3.5, '#ff9a8a'); dot(64, 68, 3.5, '#ff9a8a');
      ell(50, 42, 40, 9); fo('#f0c45a'); g.beginPath(); g.moveTo(30, 42); g.quadraticCurveTo(32, 18, 50, 18); g.quadraticCurveTo(68, 18, 70, 42); g.closePath(); fo('#f0c45a'); rr(31, 34, 38, 6, 2); fl('#d9483a');
      ln([78, 66, 92, 40], 3, '#d9a83a'); ell(92, 36, 4, 8, 0.4); fo('#f0c45a', 3);
    },
    diver() {
      circ(50, 50, 34); fo('#d4a04a'); circ(50, 48, 22); fo('#7ad6ff'); hl(42, 40, 7, 4); circ(50, 48, 22); g.lineWidth = 6; g.strokeStyle = '#a8742a'; g.stroke(); circ(50, 48, 25); g.lineWidth = 3; g.strokeStyle = OL; g.stroke();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.5; dot(50 + Math.cos(a) * 29, 48 + Math.sin(a) * 29, 2.5, '#7a4a1a'); }
      rr(30, 80, 40, 10, 3); fo('#a8742a', 4);
    },
    cop() {
      face(50, 60, 24, '#ffcc9a'); eyes(42, 58, 60, 3.8); ln([42, 72, 58, 72], 3);
      g.beginPath(); g.moveTo(22, 40); g.quadraticCurveTo(26, 16, 50, 16); g.quadraticCurveTo(74, 16, 78, 40); g.closePath(); fo('#2a4cc8'); rr(24, 38, 52, 9, 3); fo('#1a2a7a');
      starP(50, 28, 8, 4, 5); fo('#ffd046', 2.5);
    },
    purse() {
      g.beginPath(); g.moveTo(34, 36); g.quadraticCurveTo(10, 60, 20, 80); g.quadraticCurveTo(50, 94, 80, 80); g.quadraticCurveTo(90, 60, 66, 36); g.closePath(); fo('#9a4ac8');
      poly([34, 36, 26, 22, 40, 28, 50, 18, 60, 28, 74, 22, 66, 36]); fo('#b46ae0', 4); ln([32, 38, 68, 38], 4, '#ffd046');
      circ(50, 64, 11); fo('#ffd046', 4); starP(50, 64, 5, 2.5, 5); fl('#f2a516');
    },
    horseshoe() {
      g.beginPath(); g.arc(50, 46, 30, Math.PI * 0.85, Math.PI * 2.15); g.lineWidth = 24; g.strokeStyle = OL; g.lineCap = 'butt'; g.stroke(); g.lineWidth = 15; g.strokeStyle = '#c8cbe0'; g.stroke(); g.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = Math.PI * (0.95 + i * 0.22); dot(50 + Math.cos(a) * 30, 46 + Math.sin(a) * 30, 2.2, '#5a5d78'); }
      rr(15, 66, 14, 10, 2); fo('#c8cbe0', 4); rr(71, 66, 14, 10, 2); fo('#c8cbe0', 4); sparkle(78, 22, 9);
    },
    rain() {
      for (let i = 0; i < 3; i++) { const x = 32 + i * 18, y = 70 + (i % 2) * 8; g.beginPath(); g.moveTo(x, y - 8); g.quadraticCurveTo(x + 7, y + 4, x, y + 6); g.quadraticCurveTo(x - 7, y + 4, x, y - 8); fo('#3d8bff', 3.5); }
      circ(34, 46, 16); fo('#dfe8ff'); circ(56, 36, 20); fo('#dfe8ff'); circ(74, 48, 14); fo('#dfe8ff');
      rr(22, 44, 62, 18, 9); fl('#dfe8ff'); ln([24, 62, 82, 62], 5); hl(48, 28, 7, 3);
    },
    butterfly() {
      ell(30, 36, 18, 20, -0.4); fo('#5ac8ff'); ell(70, 36, 18, 20, 0.4); fo('#5ac8ff'); ell(32, 68, 13, 15, 0.4); fo('#b06aff'); ell(68, 68, 13, 15, -0.4); fo('#b06aff');
      dot(30, 36, 6, '#fff'); dot(70, 36, 6, '#fff'); dot(32, 68, 4, '#ffe14a'); dot(68, 68, 4, '#ffe14a');
      ell(50, 52, 5, 26); fo('#30304a', 4); ln([48, 28, 40, 14], 3); ln([52, 28, 60, 14], 3);
    },
    orange() { circ(50, 54, 32); fo('#ff9a1f'); g.beginPath(); g.moveTo(50, 24); g.quadraticCurveTo(64, 8, 78, 16); g.quadraticCurveTo(66, 28, 50, 24); fo('#3fbf5f', 4); for (let i = 0; i < 6; i++) dot(36 + (i % 3) * 14, 50 + ((i / 3) | 0) * 14, 1.8, '#e07a10'); hl(38, 40, 8, 5); },
    sapphire() { gemFacets(50, 52, 70, 64, '#2f6bff', '#8ab0ff', '#1a3ea8'); },
    sun() {
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10; poly([50 + Math.cos(a - 0.18) * 30, 50 + Math.sin(a - 0.18) * 30, 50 + Math.cos(a) * 46, 50 + Math.sin(a) * 46, 50 + Math.cos(a + 0.18) * 30, 50 + Math.sin(a + 0.18) * 30]); fo('#ff9a1f', 3.5); }
      circ(50, 50, 28); fo('#ffd23d'); eyes(42, 58, 46, 3.5); qc(41, 56, 50, 64, 59, 56, 3); dot(36, 56, 3.5, '#ff9a6a'); dot(64, 56, 3.5, '#ff9a6a');
    },
    witch() {
      face(50, 64, 22, '#8fe07a'); eyes(42, 58, 64, 3.6); qc(43, 74, 50, 70, 57, 74, 3); poly([48, 66, 52, 66, 50, 72]); fl('#6ac05a');
      ell(50, 46, 38, 8); fo('#5a2a8a'); poly([30, 46, 56, 4, 74, 22, 62, 24, 70, 46]); fo('#6a35a0'); rr(32, 38, 36, 7, 2); fl('#ffd046');
    },
    beehive() {
      g.beginPath(); g.moveTo(16, 86); g.quadraticCurveTo(14, 16, 50, 14); g.quadraticCurveTo(86, 16, 84, 86); g.closePath(); fo('#ffb21a');
      for (let i = 0; i < 4; i++) ln([20 + i * 1, 32 + i * 14, 80 - i * 1, 32 + i * 14], 3.5, '#c8742a');
      g.beginPath(); g.moveTo(16, 86); g.quadraticCurveTo(14, 16, 50, 14); g.quadraticCurveTo(86, 16, 84, 86); g.closePath(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
      ell(50, 70, 9, 8); fl(OL); ln([10, 86, 90, 86], 5); dot(78, 22, 5, '#ffe14a'); dot(78, 22, 2, OL);
    },
    chicken() {
      poly([22, 50, 8, 34, 14, 58]); fo('#f2f2fa'); ell(48, 62, 30, 24); fo('#ffffff'); circ(62, 36, 16); fo('#ffffff');
      g.beginPath(); g.moveTo(54, 22); g.quadraticCurveTo(56, 10, 62, 18); g.quadraticCurveTo(66, 8, 70, 20); g.lineTo(66, 24); g.closePath(); fo('#ff3d4a', 3.5);
      poly([76, 36, 88, 40, 76, 44]); fo('#ffb000', 3); ell(74, 50, 4, 6); fo('#ff3d4a', 3); dot(64, 34, 3, OL);
      g.beginPath(); g.moveTo(32, 58); g.quadraticCurveTo(48, 48, 58, 66); g.quadraticCurveTo(44, 70, 32, 58); fo('#e6e6f0', 3.5);
      ln([42, 84, 40, 94], 4, '#ffb000'); ln([56, 84, 58, 94], 4, '#ffb000');
    },
    goldegg() { g.beginPath(); g.moveTo(50, 14); g.bezierCurveTo(78, 14, 84, 86, 50, 86); g.bezierCurveTo(16, 86, 22, 14, 50, 14); fo('#ffcd3a'); g.save(); g.clip(); circ(66, 66, 26); fl('#f0a820'); g.restore(); hl(40, 36, 6, 11, 0.3); sparkle(76, 22, 10); sparkle(22, 70, 6); },
    chest() {
      rr(14, 44, 72, 42, 5); fo('#a0602a'); g.beginPath(); g.moveTo(14, 46); g.lineTo(14, 36); g.quadraticCurveTo(50, 8, 86, 36); g.lineTo(86, 46); g.closePath(); fo('#b8743a');
      rr(28, 22, 8, 64, 2); fo('#ffcd3a', 3.5); rr(64, 22, 8, 64, 2); fo('#ffcd3a', 3.5); ln([14, 46, 86, 46], 5);
      rr(42, 40, 16, 18, 3); fo('#ffcd3a', 4); dot(50, 49, 3, OL);
    },
    seven() {
      poly([18, 18, 84, 18, 84, 32, 56, 86, 34, 86, 60, 36, 32, 36, 30, 42, 18, 42]); fo('#ff2d55', 6);
      poly([22, 22, 80, 22, 80, 30]); fl('rgba(255,255,255,0.35)'); sparkle(84, 72, 10, '#ffe14a');
    },
    amethyst() {
      poly([22, 86, 18, 50, 30, 30, 40, 50, 40, 86]); fo('#9a5ae0'); poly([62, 86, 60, 46, 72, 26, 84, 46, 82, 86]); fo('#8a4ad0');
      poly([36, 88, 34, 30, 50, 8, 66, 30, 64, 88]); fo('#b07aff'); poly([34, 30, 50, 8, 50, 88, 36, 88]); fl('#c89aff'); ln([50, 8, 50, 88], 3);
      poly([36, 88, 34, 30, 50, 8, 66, 30, 64, 88]); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); ln([12, 88, 90, 88], 5);
    },
    emerald() {
      poly([30, 16, 70, 16, 86, 32, 86, 68, 70, 84, 30, 84, 14, 68, 14, 32]); fo('#17b26a');
      poly([36, 30, 64, 30, 72, 38, 72, 62, 64, 70, 36, 70, 28, 62, 28, 38]); fo('#3fe08f', 3);
      ln([30, 16, 36, 30], 3); ln([70, 16, 64, 30], 3); ln([86, 68, 72, 62], 3); ln([14, 68, 28, 62], 3); hl(42, 40, 7, 4);
    },
    ruby() {
      poly([50, 88, 12, 40, 28, 16, 72, 16, 88, 40]); fo('#e8183c');
      poly([28, 16, 40, 40, 12, 40]); fl('#ff5a7a'); poly([72, 16, 60, 40, 88, 40]); fl('#a80a28'); poly([40, 40, 60, 40, 50, 88]); fl('#ff4a6a');
      ln([12, 40, 88, 40], 3); poly([50, 88, 12, 40, 28, 16, 72, 16, 88, 40]); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); hl(34, 26, 5, 3);
    },
    joker() {
      face(50, 64, 22, '#fff0e0'); eyes(42, 60, 62, 3.6); g.beginPath(); g.arc(50, 68, 9, 0.2, Math.PI - 0.2); g.lineWidth = 3; g.strokeStyle = OL; g.stroke(); dot(36, 70, 3.5, '#ff6a8a'); dot(64, 70, 3.5, '#ff6a8a');
      g.beginPath(); g.moveTo(28, 50); g.quadraticCurveTo(10, 30, 12, 14); g.quadraticCurveTo(36, 22, 50, 44); g.quadraticCurveTo(64, 22, 88, 14); g.quadraticCurveTo(90, 30, 72, 50); g.closePath(); fo('#8a3ae0');
      g.beginPath(); g.moveTo(40, 46); g.quadraticCurveTo(44, 16, 50, 8); g.quadraticCurveTo(56, 16, 60, 46); g.closePath(); fo('#ff3d5a');
      dot(12, 14, 6, '#ffd046'); circ(12, 14, 6); g.lineWidth = 3; g.strokeStyle = OL; g.stroke(); circ(88, 14, 6); fo('#ffd046', 3); circ(50, 8, 6); fo('#ffd046', 3);
    },
    banker() {
      face(50, 62, 24, '#ffcc9a'); dot(42, 60, 3.6, OL); circ(58, 60, 7); g.lineWidth = 3; g.strokeStyle = '#ffd046'; g.stroke(); dot(58, 60, 3, OL); ln([64, 62, 70, 80], 2, '#ffd046');
      g.beginPath(); g.moveTo(36, 72); g.quadraticCurveTo(43, 66, 50, 71); g.quadraticCurveTo(57, 66, 64, 72); g.quadraticCurveTo(57, 76, 50, 73); g.quadraticCurveTo(43, 76, 36, 72); fo('#7a4a24', 2.5);
      ell(50, 40, 32, 7); fo('#1e1e30'); rr(32, 8, 36, 32, 4); fo('#1e1e30'); rr(32, 30, 36, 6, 0); fl('#c8243c');
    },
    safe() {
      rr(14, 16, 72, 70, 8); fo('#7d86a3'); rr(22, 24, 56, 54, 5); fo('#9aa3c0', 4);
      circ(50, 51, 16); fo('#5a6380', 4); circ(50, 51, 6); fo('#c8cbe0', 3); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; dot(50 + Math.cos(a) * 12, 51 + Math.sin(a) * 12, 1.6, '#e6e9f5'); }
      rr(70, 40, 6, 22, 2); fo('#c8cbe0', 3); rr(20, 86, 12, 6, 1); fo('#5a6380', 3); rr(68, 86, 12, 6, 1); fo('#5a6380', 3);
    },
    diamond() { gemFacets(50, 52, 80, 70, '#9ff0ff', '#e6fdff', '#5ac8e8'); sparkle(82, 20, 10); sparkle(16, 74, 6); },
    crown() {
      poly([14, 76, 10, 30, 32, 50, 50, 18, 68, 50, 90, 30, 86, 76]); fo('#ffcd3a'); rr(12, 70, 76, 16, 4); fo('#f0a820');
      dot(10, 30, 5, '#ff2d55'); dot(50, 18, 6, '#2f6bff'); dot(90, 30, 5, '#ff2d55'); circ(50, 78, 5); fo('#17b26a', 3); circ(30, 78, 4); fo('#ff2d55', 3); circ(70, 78, 4); fo('#ff2d55', 3); hl(34, 56, 4, 8, 0.2);
    },
    dragon() {
      poly([30, 34, 18, 6, 40, 26]); fo('#ffd046'); poly([56, 26, 64, 4, 70, 30]); fo('#ffd046');
      g.beginPath(); g.moveTo(16, 60); g.quadraticCurveTo(14, 26, 48, 24); g.quadraticCurveTo(80, 24, 88, 50); g.lineTo(92, 66); g.quadraticCurveTo(70, 70, 60, 64); g.quadraticCurveTo(50, 86, 26, 82); g.closePath(); fo('#2fbf5a');
      g.beginPath(); g.moveTo(58, 62); g.quadraticCurveTo(76, 76, 92, 66); g.quadraticCurveTo(76, 64, 60, 58); fl('#1f8f42');
      ell(50, 40, 7, 5); fo('#ffe14a', 3); ell(51, 40, 2, 4.5); fl(OL); dot(84, 52, 2.5, OL);
      for (let i = 0; i < 3; i++) poly([18 + i * 4, 54 + i * 9, 8, 58 + i * 10, 20 + i * 4, 62 + i * 9]); g.fillStyle = '#ffd046';
      poly([20, 52, 6, 56, 20, 60]); fo('#ffd046', 3); poly([22, 64, 8, 70, 24, 72]); fo('#ffd046', 3);
    },
    genie() {
      g.beginPath(); g.moveTo(50, 60); g.bezierCurveTo(30, 50, 70, 36, 46, 24); g.bezierCurveTo(62, 26, 80, 44, 56, 60); g.closePath(); g.fillStyle = 'rgba(110,200,255,0.75)'; g.fill(); g.lineWidth = 4; g.strokeStyle = OL; g.stroke();
      circ(46, 22, 10); fo('#5ab4ff'); dot(43, 21, 2, OL); dot(50, 21, 2, OL); dot(46, 10, 4, '#ffd046');
      g.beginPath(); g.moveTo(10, 66); g.quadraticCurveTo(24, 62, 32, 66); g.lineTo(70, 66); g.quadraticCurveTo(86, 62, 92, 56); g.lineTo(94, 60); g.quadraticCurveTo(86, 76, 70, 80); g.quadraticCurveTo(50, 92, 30, 82); g.quadraticCurveTo(16, 78, 10, 66); fo('#ffcd3a');
      rr(40, 82, 22, 8, 3); fo('#f0a820', 4); g.beginPath(); g.arc(24, 74, 7, 1.2, 5); g.lineWidth = 4; g.strokeStyle = OL; g.stroke(); hl(50, 70, 9, 3, 0);
    },
    midas() {
      face(50, 60, 24, '#ffd77a'); eyes(42, 58, 58, 3.6);
      g.beginPath(); g.moveTo(28, 64); g.quadraticCurveTo(32, 96, 50, 94); g.quadraticCurveTo(68, 96, 72, 64); g.quadraticCurveTo(60, 76, 50, 72); g.quadraticCurveTo(40, 76, 28, 64); fo('#f0b02a');
      poly([28, 42, 26, 16, 38, 28, 50, 12, 62, 28, 74, 16, 72, 42]); fo('#ffcd3a'); dot(50, 30, 4, '#ff2d55'); sparkle(86, 30, 9); sparkle(14, 80, 6);
    },
    goose() {
      g.beginPath(); g.moveTo(14, 64); g.quadraticCurveTo(30, 90, 66, 84); g.quadraticCurveTo(86, 78, 82, 62); g.quadraticCurveTo(64, 64, 58, 56); g.lineTo(60, 32); g.quadraticCurveTo(62, 14, 74, 16); g.quadraticCurveTo(84, 18, 82, 28); g.lineTo(70, 30); g.lineTo(68, 58);
      g.quadraticCurveTo(40, 50, 14, 64); fo('#ffcd3a'); poly([82, 22, 96, 26, 82, 30]); fo('#ff8a1f', 3); dot(74, 22, 2.5, OL);
      g.beginPath(); g.moveTo(30, 66); g.quadraticCurveTo(50, 56, 66, 72); g.quadraticCurveTo(46, 76, 30, 66); fo('#f0a820', 3.5); sparkle(24, 30, 9); sparkle(40, 16, 5);
    },
    leprechaun() {
      face(50, 62, 22, '#ffcc9a'); eyes(42, 58, 60, 3.4);
      g.beginPath(); g.moveTo(28, 64); g.quadraticCurveTo(30, 94, 50, 92); g.quadraticCurveTo(70, 94, 72, 64); g.quadraticCurveTo(60, 74, 50, 70); g.quadraticCurveTo(40, 74, 28, 64); fo('#ff7a1f');
      ell(50, 44, 34, 7); fo('#1f9a4a'); rr(32, 10, 36, 34, 4); fo('#2fbf5a'); rr(32, 32, 36, 7, 0); fl(OL); rr(44, 30, 12, 11, 2); fo('#ffd046', 3);
      poly([80, 30, 86, 20, 92, 30, 86, 40]); fo('#3ccf62', 3);
    },
  };
  SYM.moon = function () {
    crescentOutline();
    dot(30, 62, 5, '#e8d488'); dot(42, 76, 3.5, '#e8d488'); dot(24, 46, 3, '#e8d488'); sparkle(82, 76, 9);
  };
  function crescentOutline() {
    // outer arc of the big circle outside the cutter, inner arc of the cutter inside the big circle
    const cx = 48, cy = 52, R = 34, dx = 70, dy = 38, r = 28;
    const d = Math.hypot(dx - cx, dy - cy);
    const a = (R * R - r * r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R * R - a * a));
    const ux = (dx - cx) / d, uy = (dy - cy) / d;
    const px = cx + ux * a, py = cy + uy * a;
    const p1x = px - uy * h, p1y = py + ux * h, p2x = px + uy * h, p2y = py - ux * h;
    const A1 = Math.atan2(p1y - cy, p1x - cx), A2 = Math.atan2(p2y - cy, p2x - cx);
    const B1 = Math.atan2(p1y - dy, p1x - dx), B2 = Math.atan2(p2y - dy, p2x - dx);
    g.beginPath(); g.arc(cx, cy, R, A1, A2, false); g.arc(dx, dy, r, B2, B1, true); g.closePath();
    g.fillStyle = '#fff1b0'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke();
  }
  SYM.pirate = function () {
    g.beginPath(); g.moveTo(18, 46); g.quadraticCurveTo(50, 40, 82, 46); g.lineTo(80, 52); g.quadraticCurveTo(50, 46, 20, 52); g.closePath(); fo('#d9243c', 4);
    face(50, 62, 24, '#e8b483'); dot(60, 60, 4, OL); dot(61, 58.5, 1.4, '#fff');
    ell(40, 60, 8, 7); fl(OL); ln([28, 50, 72, 70], 3);
    qc(42, 74, 50, 78, 58, 74, 3);
    g.beginPath(); g.moveTo(16, 46); g.quadraticCurveTo(50, 0, 84, 46); g.quadraticCurveTo(50, 34, 16, 46); fo('#2a2a3e');
    dot(50, 26, 6, '#f2f2fa'); dot(47.5, 25, 1.6, OL); dot(52.5, 25, 1.6, OL); ln([43, 34, 57, 38], 2.5, '#f2f2fa'); ln([57, 34, 43, 38], 2.5, '#f2f2fa');
    circ(27, 78, 4); g.lineWidth = 3; g.strokeStyle = '#ffd046'; g.stroke();
  };

  // ---------- ITEMS ----------
  const ITM = {
    coffee() { rr(24, 34, 42, 46, 8); fo('#fff4e6'); g.beginPath(); g.arc(70, 54, 10, -1.4, 1.4); g.lineWidth = 9; g.strokeStyle = OL; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#fff4e6'; g.stroke(); ell(45, 36, 20, 5); fo('#6a3a1a', 3); qc(36, 26, 32, 16, 38, 8, 3, '#c8b8d8'); qc(50, 26, 46, 16, 52, 8, 3, '#c8b8d8'); rr(30, 52, 30, 10, 3); fl('#ff6a8a'); },
    magnet() { g.beginPath(); g.arc(50, 46, 26, Math.PI, 0); g.lineTo(76, 76); g.lineTo(60, 76); g.lineTo(60, 46); g.arc(50, 46, 10, 0, Math.PI, true); g.lineTo(40, 76); g.lineTo(24, 76); g.closePath(); fo('#ff3d4a'); rr(24, 66, 16, 12, 1); fo('#e6e9f5', 4); rr(60, 66, 16, 12, 1); fo('#e6e9f5', 4); circ(50, 16, 8); fo('#ffd046', 3.5); },
    fruitbasket() { circ(36, 44, 12); fo('#ff2d55'); circ(58, 40, 13); fo('#ff9a1f'); circ(48, 34, 10); fo('#3fbf5f'); g.beginPath(); g.moveTo(16, 50); g.lineTo(84, 50); g.lineTo(74, 84); g.lineTo(26, 84); g.closePath(); fo('#c8843a'); ln([22, 62, 78, 62], 3, '#8a5426'); ln([25, 73, 75, 73], 3, '#8a5426'); },
    watering() { g.beginPath(); g.moveTo(22, 40); g.lineTo(64, 40); g.lineTo(68, 84); g.lineTo(18, 84); g.closePath(); fo('#3fbfa8'); ln([64, 52, 90, 30], 9); ln([64, 52, 90, 30], 4, '#3fbfa8'); g.beginPath(); g.arc(30, 50, 14, Math.PI * 0.6, Math.PI * 1.6); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); for (let i = 0; i < 3; i++) dot(92 + i * 2, 38 + i * 8, 2.5, '#5ab4ff'); },
    net() { g.beginPath(); g.arc(46, 46, 28, 0, TAU); fo('rgba(255,255,255,0.15)'); g.save(); circ(46, 46, 26); g.clip(); for (let i = -3; i <= 3; i++) { ln([20 + i * 9, 18, 46 + i * 9, 76], 2, '#e6e9f5'); ln([72 + i * 9, 18, 46 + i * 9, 76], 2, '#e6e9f5'); } g.restore(); circ(46, 46, 28); g.lineWidth = 6; g.strokeStyle = '#c8843a'; g.stroke(); ln([66, 66, 90, 90], 9); ln([66, 66, 90, 90], 4, '#c8843a'); },
    nightlight() { circ(50, 44, 26); fo('#fff1b0'); g.save(); circ(50, 44, 26); g.clip(); circ(64, 34, 22); fl('#ffe06a'); g.restore(); rr(36, 70, 28, 14, 4); fo('#8a8fa8'); ln([42, 84, 42, 92], 4); ln([58, 84, 58, 92], 4); sparkle(18, 20, 7); sparkle(84, 64, 6); },
    beehat() { ell(50, 58, 40, 10); fo('#f0d48a'); g.beginPath(); g.moveTo(26, 58); g.quadraticCurveTo(28, 22, 50, 22); g.quadraticCurveTo(72, 22, 74, 58); fo('#f0d48a'); g.beginPath(); g.moveTo(14, 60); g.lineTo(18, 88); g.lineTo(82, 88); g.lineTo(86, 60); g.fillStyle = 'rgba(40,40,60,0.45)'; g.fill(); g.lineWidth = 3; g.strokeStyle = OL; g.stroke(); dot(70, 30, 6, '#ffd23d'); dot(70, 30, 2.5, OL); },
    tipjar() { rr(24, 26, 52, 62, 10); g.fillStyle = 'rgba(180,230,255,0.35)'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); circ(40, 70, 9); fo('#ffd046', 3); circ(58, 74, 9); fo('#ffd046', 3); circ(50, 58, 9); fo('#ffd046', 3); rr(30, 18, 40, 10, 3); fo('#8a8fa8', 4); rr(34, 38, 32, 12, 3); fo('#fff', 3); },
    wishbone() { g.beginPath(); g.moveTo(26, 14); g.quadraticCurveTo(30, 54, 50, 66); g.quadraticCurveTo(70, 54, 74, 14); g.lineWidth = 14; g.strokeStyle = OL; g.stroke(); g.lineWidth = 7; g.strokeStyle = '#f5e6c8'; g.stroke(); ln([50, 64, 50, 90], 14); ln([50, 64, 50, 90], 7, '#f5e6c8'); sparkle(82, 76, 9); },
    milkjug() { g.beginPath(); g.moveTo(34, 20); g.lineTo(58, 20); g.lineTo(60, 34); g.quadraticCurveTo(76, 44, 74, 86); g.lineTo(22, 86); g.quadraticCurveTo(20, 44, 34, 34); g.closePath(); fo('#ffffff'); rr(36, 12, 22, 10, 3); fo('#3d8bff', 4); g.beginPath(); g.arc(74, 58, 10, -1.3, 1.3); g.lineWidth = 8; g.strokeStyle = OL; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = '#fff'; g.stroke(); rr(28, 54, 40, 14, 3); fl('#3d8bff'); },
    pickaxe() { ln([26, 84, 66, 30], 10); ln([26, 84, 66, 30], 5, '#b8743a'); g.beginPath(); g.moveTo(30, 22); g.quadraticCurveTo(60, 6, 90, 34); g.quadraticCurveTo(64, 22, 46, 34); g.closePath(); fo('#a7abc2'); },
    loaded() { g.save(); g.translate(36, 58); g.rotate(-0.25); dieFace(0, 0, 40, '#fff', OL, 6); g.restore(); g.save(); g.translate(64, 42); g.rotate(0.3); dieFace(0, 0, 40, '#ff3d6e', '#fff', 6); g.restore(); },
    dynamite() { for (let i = 0; i < 3; i++) { rr(22 + i * 18, 34, 18, 52, 3); fo('#e8243c'); } rr(20, 52, 58, 8, 2); fo('#1e1e30', 3); qc(49, 34, 52, 18, 66, 14, 4, '#c8a06a'); sparkle(70, 13, 10, '#ffe14a'); },
    birdfeeder() { poly([14, 40, 50, 14, 86, 40]); fo('#d9483a'); rr(24, 40, 52, 40, 3); fo('#c8843a'); circ(50, 58, 10); fo('#3a200c', 4); rr(18, 80, 64, 8, 2); fo('#a0602a', 4); dot(42, 86, 2, '#ffd046'); dot(56, 85, 2, '#ffd046'); },
    jewelbox() { rr(14, 46, 72, 38, 6); fo('#8a3ae0'); g.beginPath(); g.moveTo(14, 46); g.lineTo(20, 24); g.lineTo(80, 24); g.lineTo(86, 46); g.closePath(); fo('#a85af0'); rr(42, 40, 16, 14, 3); fo('#ffd046', 3.5); circ(30, 22, 8); fo('#ff2d55', 3); circ(70, 20, 8); fo('#17b26a', 3); circ(50, 16, 8); fo('#5ac8ff', 3); },
    oysterknife() { rr(14, 42, 40, 16, 6); fo('#8a5426'); ln([22, 50, 46, 50], 2, '#5a3214'); g.beginPath(); g.moveTo(54, 40); g.lineTo(90, 46); g.quadraticCurveTo(94, 50, 90, 54); g.lineTo(54, 60); g.closePath(); fo('#c8cbe0'); circ(80, 78, 9); fo('#f6eefc', 3.5); },
    honeypot() { ell(50, 62, 32, 26); fo('#c8742a'); rr(28, 28, 44, 12, 4); fo('#a0602a'); g.beginPath(); g.moveTo(30, 40); g.lineTo(70, 40); g.lineTo(70, 50); g.quadraticCurveTo(62, 58, 58, 50); g.quadraticCurveTo(52, 64, 46, 50); g.quadraticCurveTo(38, 56, 30, 48); g.closePath(); fo('#ffb21a', 3); ln([60, 14, 74, 40], 5); },
    henhouse() { poly([10, 46, 50, 14, 90, 46]); fo('#d9483a'); rr(20, 46, 60, 40, 2); fo('#f5e6c8'); g.beginPath(); g.moveTo(40, 86); g.lineTo(40, 66); g.arc(50, 66, 10, Math.PI, 0); g.lineTo(60, 86); fo('#3a200c', 4); ell(50, 34, 8, 6); fo('#fff4e0', 3); },
    badge() { rr(14, 26, 72, 54, 8); fo('#ffffff'); rr(14, 26, 72, 18, 8); fo('#ff3d4a'); rr(14, 36, 72, 8, 0); fl('#ff3d4a'); ln([26, 60, 74, 60], 4, '#8a8fa8'); ln([26, 70, 58, 70], 4, '#8a8fa8'); rr(14, 26, 72, 54, 8); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); },
    swearjar() { rr(22, 30, 56, 58, 12); g.fillStyle = 'rgba(180,230,255,0.35)'; g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); rr(28, 20, 44, 12, 3); fo('#ff3d4a', 4); txt('#@!', 50, 62, 20, '#ff3d4a', true); },
    eraser() { g.save(); g.translate(50, 54); g.rotate(-0.5); rr(-32, -16, 64, 32, 6); fo('#ff8ab5'); rr(10, -16, 22, 32, 0); fl('#5ab4ff'); rr(-32, -16, 64, 32, 6); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); g.restore(); dot(24, 84, 3, '#ff8ab5'); dot(34, 88, 2, '#ff8ab5'); },
    gloves() { g.beginPath(); g.moveTo(28, 86); g.lineTo(26, 48); g.quadraticCurveTo(18, 40, 22, 34); g.quadraticCurveTo(28, 32, 32, 40); g.lineTo(32, 18); g.quadraticCurveTo(38, 12, 42, 18); g.lineTo(44, 14); g.quadraticCurveTo(50, 8, 54, 14); g.lineTo(56, 18); g.quadraticCurveTo(62, 14, 64, 22); g.lineTo(66, 30); g.quadraticCurveTo(72, 28, 72, 36); g.lineTo(70, 86); g.closePath(); fo('#3ccf62'); rr(26, 74, 46, 12, 3); fo('#2f9e4a', 4); starP(50, 50, 10, 4.5, 4, 0); fl('#ffe14a'); },
    guild() { g.beginPath(); g.moveTo(10, 42); g.quadraticCurveTo(50, 22, 90, 42); g.quadraticCurveTo(88, 66, 66, 64); g.quadraticCurveTo(50, 56, 34, 64); g.quadraticCurveTo(12, 66, 10, 42); fo('#1e1e30'); ell(32, 46, 9, 6); fl('#fff'); ell(68, 46, 9, 6); fl('#fff'); qc(40, 80, 50, 72, 60, 80, 4, '#ffd046'); },
    moonstone() { ell(50, 56, 32, 28); fo('#c8d4ff'); g.save(); ell(50, 56, 32, 28); g.clip(); ell(64, 46, 26, 22); fl('#e6ecff'); g.restore(); ell(50, 56, 32, 28); g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); g.beginPath(); g.arc(46, 54, 13, 0, TAU); g.arc(53, 49, 11, 0, TAU, true); g.fillStyle = '#7a8ae0'; g.fill('evenodd'); sparkle(80, 22, 8); },
    pointyhat() { ell(50, 78, 42, 10); fo('#5a2a8a'); poly([24, 78, 54, 8, 76, 30, 64, 32, 76, 78]); fo('#6a35a0'); rr(28, 66, 46, 8, 2); fl('#ffd046'); starP(56, 46, 7, 3, 5); fl('#ffe14a'); },
    cauldron() { ell(50, 40, 34, 9); fo('#4a4560'); g.beginPath(); g.moveTo(16, 40); g.quadraticCurveTo(12, 86, 50, 86); g.quadraticCurveTo(88, 86, 84, 40); fo('#2b2738'); ell(50, 40, 28, 6); fl('#6ae07a'); dot(40, 28, 6, '#8af08a'); dot(58, 22, 4, '#8af08a'); dot(50, 12, 3, '#8af08a'); },
    map() { poly([12, 24, 36, 16, 64, 24, 88, 16, 88, 80, 64, 88, 36, 80, 12, 88]); fo('#f5dca6'); ln([36, 16, 36, 80], 2.5, '#c8a06a'); ln([64, 24, 64, 88], 2.5, '#c8a06a'); g.setLineDash([4, 5]); qc(20, 70, 40, 40, 64, 50, 3, '#8a5426'); g.setLineDash([]); ln([66, 40, 78, 52], 5, '#ff3d4a'); ln([78, 40, 66, 52], 5, '#ff3d4a'); },
    spotlight() { g.beginPath(); g.moveTo(40, 30); g.lineTo(60, 30); g.lineTo(92, 92); g.lineTo(8, 92); g.closePath(); g.fillStyle = 'rgba(255,240,170,0.35)'; g.fill(); rr(32, 10, 36, 26, 6); fo('#585878'); ell(50, 34, 16, 5); fo('#fff7c2', 3); ell(50, 88, 30, 6); fl('rgba(255,240,170,0.6)'); },
    pockets() { g.beginPath(); g.moveTo(16, 18); g.lineTo(84, 18); g.lineTo(80, 70); g.quadraticCurveTo(50, 94, 20, 70); g.closePath(); fo('#3a6ad0'); g.setLineDash([5, 4]); g.beginPath(); g.moveTo(22, 26); g.lineTo(78, 26); g.lineTo(74, 66); g.quadraticCurveTo(50, 86, 26, 66); g.closePath(); g.lineWidth = 2.5; g.strokeStyle = '#ffb03a'; g.stroke(); g.setLineDash([]); circ(50, 40, 10); fo('#ffd046', 3); },
    rabbitfoot() { ell(50, 62, 20, 26); fo('#f2f0ff'); circ(40, 82, 7); fo('#f2f0ff', 4); circ(60, 82, 7); fo('#f2f0ff', 4); rr(42, 14, 16, 22, 4); fo('#ffd046'); ln([50, 8, 50, 16], 4); },
    ledger() { rr(18, 14, 60, 74, 5); fo('#2f9e4a'); rr(26, 14, 52, 74, 3); fo('#3ccf62'); rr(36, 30, 32, 14, 2); fo('#f5f0dc', 3); ln([18, 24, 26, 24], 3); ln([18, 78, 26, 78], 3); txt('%', 52, 66, 22, '#ffd046', true); },
    rentcontrol() { poly([20, 12, 64, 12, 80, 28, 80, 88, 20, 88]); fo('#ffffff'); poly([64, 12, 64, 28, 80, 28]); fo('#d6dcf0', 4); ln([30, 34, 56, 34], 4, '#8a8fa8'); ln([30, 46, 70, 46], 4, '#8a8fa8'); txt('-15%', 50, 70, 15, '#17b26a', true); },
    hourglass() { rr(22, 10, 56, 10, 3); fo('#a0602a'); rr(22, 80, 56, 10, 3); fo('#a0602a'); g.beginPath(); g.moveTo(28, 20); g.lineTo(72, 20); g.quadraticCurveTo(72, 40, 54, 50); g.quadraticCurveTo(72, 60, 72, 80); g.lineTo(28, 80); g.quadraticCurveTo(28, 60, 46, 50); g.quadraticCurveTo(28, 40, 28, 20); fo('rgba(200,235,255,0.6)'); poly([34, 78, 66, 78, 50, 62]); fl('#ffcd3a'); poly([38, 30, 62, 30, 50, 44]); fl('#ffcd3a'); },
    lastcall() { g.beginPath(); g.moveTo(14, 18); g.lineTo(86, 18); g.lineTo(50, 54); g.closePath(); fo('#ff5ab4'); ln([50, 54, 50, 84], 6); ell(50, 86, 18, 5); fo('#c8cbe0', 4); circ(70, 26, 6); fo('#3ccf62', 3); ln([60, 10, 34, 40], 3); },
    jackpotbell() { SYM.bell(); txt('7', 50, 48, 28, '#ff2d55', true); },
  };

  // ---------- LANDLORDS ----------
  function landlordArt(id) {
    const L = {
      grimsby: { skin: '#f0c8a0', hat: 'top', hatCol: '#26203a', band: '#ffc83d', stache: '#d8d8e8', brows: '#d8d8e8', mono: true, coat: '#3a2a5a' },
      bloom: { skin: '#ffd8c0', hat: 'floppy', hatCol: '#ff6fb5', band: '#3ccf62', stache: null, lips: '#e8243c', coat: '#2f9e4a', flower: true },
      brine: { skin: '#e8b483', hat: 'captain', hatCol: '#1e2a5a', band: '#ffd046', stache: '#f2f2fa', beard: '#f2f2fa', coat: '#1e3a8a' },
      vex: { skin: '#e8d0ff', hat: 'turban', hatCol: '#7a3ae0', band: '#ffd046', lips: '#8a1a5a', coat: '#4a1a7a', gem: true },
      tycoon: { skin: '#ffcc9a', hat: 'none', hair: '#2a2a3e', stache: '#2a2a3e', coat: '#1e1e30', shades: true, cigar: true },
    }[id] || {};
    return function () {
      // shoulders
      g.beginPath(); g.moveTo(10, 100); g.quadraticCurveTo(14, 72, 50, 70); g.quadraticCurveTo(86, 72, 90, 100); g.closePath(); fo(L.coat);
      poly([42, 72, 50, 86, 58, 72]); fo('#fff', 3); poly([47, 78, 53, 78, 50, 94]); fo('#e8243c', 3);
      face(50, 50, 24, L.skin);
      if (L.hair) { g.beginPath(); g.moveTo(26, 46); g.quadraticCurveTo(28, 22, 50, 24); g.quadraticCurveTo(74, 22, 74, 46); g.quadraticCurveTo(66, 32, 50, 34); g.quadraticCurveTo(34, 32, 26, 46); fo(L.hair); }
      if (L.shades) { rr(32, 42, 15, 9, 3); fo(OL, 2); rr(53, 42, 15, 9, 3); fo(OL, 2); ln([47, 45, 53, 45], 2.5); }
      else { eyes(41, 59, 48, 3.4); if (L.brows) { ln([35, 41, 45, 43], 3.5, L.brows); ln([65, 41, 55, 43], 3.5, L.brows); } }
      if (L.mono) { circ(59, 48, 7); g.lineWidth = 2.5; g.strokeStyle = '#ffd046'; g.stroke(); ln([65, 51, 68, 66], 1.6, '#ffd046'); }
      if (L.beard) { g.beginPath(); g.moveTo(28, 54); g.quadraticCurveTo(30, 82, 50, 82); g.quadraticCurveTo(70, 82, 72, 54); g.quadraticCurveTo(60, 66, 50, 62); g.quadraticCurveTo(40, 66, 28, 54); fo(L.beard); }
      if (L.stache) { g.beginPath(); g.moveTo(36, 62); g.quadraticCurveTo(43, 54, 50, 60); g.quadraticCurveTo(57, 54, 64, 62); g.quadraticCurveTo(57, 66, 50, 62); g.quadraticCurveTo(43, 66, 36, 62); fo(L.stache, 2.5); }
      else if (L.lips) { ell(50, 63, 6, 3); fo(L.lips, 2); }
      if (L.cigar) { rr(56, 62, 18, 5, 2); fo('#8a5426', 2); dot(75, 64.5, 2.5, '#ff6a1f'); }
      if (L.hat === 'top') { ell(50, 30, 30, 6); fo(L.hatCol); rr(34, 2, 32, 28, 3); fo(L.hatCol); rr(34, 22, 32, 6, 0); fl(L.band); }
      if (L.hat === 'floppy') { ell(50, 32, 40, 9); fo(L.hatCol); g.beginPath(); g.moveTo(30, 32); g.quadraticCurveTo(32, 10, 50, 10); g.quadraticCurveTo(68, 10, 70, 32); fo(L.hatCol); rr(31, 24, 38, 6, 2); fl(L.band); for (let i = 0; i < 5; i++) { const a = i * TAU / 5; circ(70 + Math.cos(a) * 6, 22 + Math.sin(a) * 6, 4.5); fo('#ffe14a', 2); } }
      if (L.hat === 'captain') { g.beginPath(); g.moveTo(26, 34); g.quadraticCurveTo(26, 12, 50, 12); g.quadraticCurveTo(74, 12, 74, 34); g.closePath(); fo('#f2f2fa'); rr(26, 28, 48, 8, 2); fo(L.hatCol); ell(50, 37, 26, 4); fo(OL, 0); starP(50, 22, 6, 3, 5); fo(L.band, 2); }
      if (L.hat === 'turban') { ell(50, 26, 30, 18); fo(L.hatCol); qc(26, 30, 50, 18, 74, 30, 3, '#5a2aa8'); circ(50, 30, 6); fo(L.band, 3); dot(50, 30, 3, '#ff2d55'); qc(62, 12, 72, 0, 80, 8, 4, L.band); }
    };
  }

  // ---------- sprite cache ----------
  const cache = new Map();
  function render(fn, px) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    g = c;
    c.save(); c.scale(px / 100, px / 100); c.lineJoin = 'round'; c.lineCap = 'round';
    try { fn(); } catch (e) { /* never break the game over one icon */ }
    c.restore();
    g = null;
    return cv;
  }
  function sprite(kind, id, px) {
    px = Math.max(8, Math.round(px));
    const key = kind + ':' + id + ':' + px;
    let cv = cache.get(key);
    if (cv) return cv;
    let fn;
    if (kind === 's') fn = SYM[id];
    else if (kind === 'i') fn = ITM[id];
    else if (kind === 'l') fn = landlordArt(id);
    if (!fn) fn = () => { circ(50, 50, 30); fo('#666'); };
    cv = render(fn, px);
    cache.set(key, cv);
    return cv;
  }
  function clearCache() { cache.clear(); }
  // DOM helper: a crisp icon canvas of a given CSS size
  function icon(kind, id, css) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    const px = Math.round(css * dpr);
    cv.width = cv.height = px; cv.style.width = cv.style.height = css + 'px';
    cv.className = 'ic-cv';
    cv.getContext('2d').drawImage(sprite(kind, id, px), 0, 0);
    return cv;
  }

  LR.Art = { sprite, icon, clearCache, SYM, ITM, has: (kind, id) => !!(kind === 's' ? SYM[id] : kind === 'i' ? ITM[id] : true) };
})(window.LR = window.LR || {});
