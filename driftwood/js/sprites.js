// DRIFTWOOD — procedural pixel-art sprites (no external assets)
(function (G) {
  'use strict';
  const Sp = {}; G.Sprites = Sp;
  const cache = {};
  const OUT = '#14121a';

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  const px = (x, X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  function shade(col, amt) { // lighten/darken hex
    const n = parseInt(col.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = G.clamp(Math.round(r + amt), 0, 255); g = G.clamp(Math.round(g + amt), 0, 255); b = G.clamp(Math.round(b + amt), 0, 255);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  Sp.shade = shade;
  // outline everything drawn (non-transparent) in a canvas
  function outline(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    const src = new Uint8ClampedArray(a);
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const i = (y * w + X) * 4; if (src[i + 3]) continue;
      let n = false;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = X + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; if (src[(ny * w + nx) * 4 + 3]) { n = true; break; } }
      if (n) { a[i] = 20; a[i + 1] = 18; a[i + 2] = 26; a[i + 3] = 255; }
    }
    x.putImageData(d, 0, 0); return c;
  }

  // ---------- world objects ----------
  const objDraw = {
    tree(x) { px(x, 6, 20, 4, 10, '#6b4426'); px(x, 7, 20, 2, 10, '#8a5a30'); x.fillStyle = '#2f6f2a'; x.beginPath(); x.arc(8, 13, 7, 0, 7); x.fill(); x.fillStyle = '#3f8f38'; x.beginPath(); x.arc(7, 11, 5, 0, 7); x.fill(); px(x, 5, 8, 2, 2, '#5cb050'); px(x, 9, 12, 2, 1, '#5cb050'); },
    birch(x) { px(x, 6, 18, 4, 12, '#e8e8e0'); px(x, 7, 21, 1, 2, '#333'); px(x, 8, 25, 1, 2, '#333'); x.fillStyle = '#5a9a3a'; x.beginPath(); x.arc(8, 11, 7, 0, 7); x.fill(); x.fillStyle = '#7cc050'; x.beginPath(); x.arc(6, 9, 4, 0, 7); x.fill(); },
    deadtree(x) { px(x, 7, 12, 3, 18, '#3a2a22'); px(x, 4, 14, 4, 2, '#3a2a22'); px(x, 3, 10, 2, 5, '#3a2a22'); px(x, 9, 10, 3, 2, '#3a2a22'); px(x, 11, 6, 2, 5, '#3a2a22'); px(x, 7, 6, 2, 7, '#3a2a22'); },
    rock(x) { x.fillStyle = '#6e7075'; x.beginPath(); x.moveTo(2, 14); x.lineTo(4, 7); x.lineTo(9, 4); x.lineTo(14, 8); x.lineTo(14, 14); x.fill(); px(x, 5, 7, 4, 3, '#9a9ca1'); px(x, 4, 12, 9, 2, '#55575c'); },
    coal_rock(x) { objDraw.rock(x); px(x, 6, 9, 2, 2, '#1a1a1e'); px(x, 10, 8, 2, 2, '#1a1a1e'); px(x, 8, 12, 2, 1, '#1a1a1e'); },
    iron_vein(x) { objDraw.rock(x); px(x, 6, 9, 2, 2, '#c08060'); px(x, 10, 7, 2, 2, '#c08060'); px(x, 8, 12, 3, 1, '#d09070'); },
    gold_vein(x) { objDraw.rock(x); px(x, 6, 9, 2, 2, '#ffd24a'); px(x, 10, 7, 2, 2, '#ffe070'); px(x, 8, 12, 3, 1, '#ffd24a'); },
    obsidian_vein(x) { x.fillStyle = '#3a3048'; x.beginPath(); x.moveTo(2, 14); x.lineTo(5, 5); x.lineTo(10, 3); x.lineTo(14, 9); x.lineTo(13, 14); x.fill(); px(x, 6, 6, 3, 2, '#8060b0'); px(x, 9, 10, 2, 3, '#7050a0'); },
    berry_bush(x) { x.fillStyle = '#2f7a2a'; x.beginPath(); x.arc(8, 10, 6, 0, 7); x.fill(); px(x, 5, 8, 2, 2, '#e03060'); px(x, 9, 7, 2, 2, '#e03060'); px(x, 7, 12, 2, 2, '#e03060'); px(x, 11, 11, 2, 2, '#e03060'); },
    mushroom(x) { px(x, 6, 9, 4, 5, '#e8e0c8'); px(x, 3, 5, 10, 5, '#c04040'); px(x, 5, 6, 2, 2, '#fff'); px(x, 9, 7, 2, 1, '#fff'); px(x, 10, 11, 3, 3, '#e8e0c8'); px(x, 9, 9, 5, 3, '#d05050'); },
    wheat(x) { for (let i = 0; i < 4; i++) { px(x, 3 + i * 3, 6 + (i % 2) * 2, 1, 9, '#c8b040'); px(x, 2 + i * 3, 4 + (i % 2) * 2, 3, 3, '#e0c850'); } },
    cactus(x) { px(x, 6, 3, 4, 12, '#3a9a4a'); px(x, 2, 6, 4, 2, '#3a9a4a'); px(x, 2, 3, 2, 4, '#3a9a4a'); px(x, 10, 8, 4, 2, '#3a9a4a'); px(x, 12, 5, 2, 4, '#3a9a4a'); px(x, 7, 5, 1, 8, '#5ac060'); px(x, 7, 1, 2, 2, '#e05a9a'); },
    grass_tuft(x) { for (let i = 0; i < 5; i++) px(x, 3 + i * 2, 7 + (i % 3) * 2, 1, 8 - (i % 3) * 2, i % 2 ? '#7ab84a' : '#5c9a45'); },
    chest_c(x, c) { px(x, 2, 6, 12, 8, c || '#8a6a3f'); px(x, 2, 6, 12, 3, shade(c || '#8a6a3f', 30)); px(x, 7, 8, 2, 3, '#ffd24a'); px(x, 2, 9, 12, 1, OUT); },
    chest_u(x) { objDraw.chest_c(x, '#3a9a4a'); }, chest_r(x) { objDraw.chest_c(x, '#b03030'); }, chest_l(x) { objDraw.chest_c(x, '#d0a020'); },
    altar(x, c) { px(x, 2, 12, 12, 3, '#5a5a60'); px(x, 4, 5, 8, 7, '#7a7a80'); px(x, 6, 2, 4, 3, c); px(x, 7, 6, 2, 5, c); },
    altar_meadow(x) { objDraw.altar(x, '#30e070'); }, altar_forest(x) { objDraw.altar(x, '#3070ff'); }, altar_volcano(x) { objDraw.altar(x, '#ff3050'); },
    boat(x) { px(x, 1, 10, 14, 4, '#7a4a20'); px(x, 2, 8, 12, 2, '#9a6a30'); px(x, 7, 1, 1, 8, '#5a3a20'); px(x, 8, 2, 5, 5, '#e8e0d0'); px(x, 3, 11, 3, 2, '#4a2a10'); },
    workbench(x) { px(x, 2, 6, 12, 3, '#b08040'); px(x, 3, 9, 2, 6, '#8a6030'); px(x, 11, 9, 2, 6, '#8a6030'); px(x, 5, 4, 3, 2, '#9a9ca1'); px(x, 9, 4, 2, 2, '#c8c8d0'); },
    furnace(x) { px(x, 2, 3, 12, 12, '#6a6a70'); px(x, 3, 3, 10, 2, '#8a8a90'); px(x, 5, 8, 6, 5, '#ff6a1a'); px(x, 6, 10, 4, 3, '#ffd040'); },
    anvil(x) { px(x, 3, 10, 10, 4, '#404048'); px(x, 5, 7, 6, 3, '#606068'); px(x, 2, 5, 12, 3, '#707078'); px(x, 2, 5, 12, 1, '#909098'); },
    cauldron(x) { px(x, 3, 6, 10, 8, '#303840'); px(x, 2, 5, 12, 2, '#505860'); px(x, 4, 6, 8, 2, '#60c060'); px(x, 4, 14, 2, 2, '#202020'); px(x, 10, 14, 2, 2, '#202020'); },
    campfire(x) { px(x, 2, 12, 12, 2, '#5a3a20'); px(x, 4, 10, 8, 2, '#7a4a20'); px(x, 5, 4, 6, 7, '#ff6a1a'); px(x, 6, 2, 4, 5, '#ffb040'); px(x, 7, 5, 2, 3, '#fff0a0'); },
    torch(x) { px(x, 7, 7, 2, 8, '#8a5a30'); px(x, 6, 3, 4, 4, '#ff9a30'); px(x, 7, 1, 2, 3, '#ffe060'); },
    wall_wood(x) { px(x, 0, 0, 16, 16, '#8a5a30'); for (let i = 0; i < 4; i++) px(x, 0, i * 4, 16, 1, '#6b4426'); px(x, 5, 0, 1, 16, '#6b4426'); px(x, 11, 0, 1, 16, '#6b4426'); },
    wall_stone(x) { px(x, 0, 0, 16, 16, '#7a7c80'); for (let i = 0; i < 4; i++) { px(x, 0, i * 4, 16, 1, '#55575c'); px(x, (i % 2) * 4 + 3, i * 4, 1, 4, '#55575c'); px(x, (i % 2) * 4 + 11, i * 4, 1, 4, '#55575c'); } },
    door_wood(x) { px(x, 1, 0, 14, 16, '#a07040'); px(x, 3, 1, 10, 14, '#c09050'); px(x, 8, 1, 1, 14, '#8a5a30'); px(x, 11, 8, 2, 2, '#ffd24a'); },
    door_open(x) { px(x, 0, 0, 3, 16, '#a07040'); px(x, 13, 0, 3, 16, '#a07040'); },
    floor_wood(x) { px(x, 0, 0, 16, 16, '#b08858'); for (let i = 0; i < 4; i++) px(x, 0, i * 4 + 3, 16, 1, '#8a6030'); px(x, 8, 0, 1, 4, '#8a6030'); px(x, 3, 8, 1, 4, '#8a6030'); },
    spikes(x) { px(x, 0, 0, 16, 16, '#6a5a40'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { px(x, 1 + i * 4, 1 + j * 4, 2, 2, '#c0c0c8'); px(x, 1 + i * 4, 1 + j * 4, 1, 1, '#ffffff'); } },
  };
  Sp.obj = function (t, variant) {
    const key = 'o:' + t + ':' + (variant || '');
    if (cache[key]) return cache[key];
    const d = G.OBJS[t]; const tall = d && d.tall;
    const [c, x] = mk(16, tall ? 32 : 16);
    const fn = variant === 'open' ? objDraw.door_open : (variant === 'stub' ? null : objDraw[t]);
    if (fn) fn(x); else if (variant === 'stub') { px(x, 5, 11, 6, 3, '#4a6a30'); }
    outline(c); cache[key] = c; return c;
  };

  // ---------- items (32 px, shaded, outlined) ----------
  const S32 = 32;
  const rr = (x, X, Y, w, h, r, col) => { x.fillStyle = col; x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); x.fill(); };
  const poly = (x, pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach((p, k) => k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill(); };
  const circ = (x, cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  const gloss = (x, cx, cy, r) => { x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.ellipse(cx, cy, r, r * 0.55, -0.6, 0, Math.PI * 2); x.fill(); };
  // handle + head helpers shared by tools and weapons (drawn along a diagonal from bottom-left to top-right)
  const haft = (x, x0, y0, x1, y1, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.strokeStyle = shade(col, 40); x.lineWidth = Math.max(1, w * 0.35); x.beginPath(); x.moveTo(x0 - 0.6, y0 - 0.6); x.lineTo(x1 - 0.6, y1 - 0.6); x.stroke(); };
  const wrap = (x, cx, cy, col) => { for (let k = -1; k <= 1; k++) { x.strokeStyle = col; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx - 2.5 + k * 1.6, cy + 2.5 + k * 1.6); x.lineTo(cx + 2.5 + k * 1.6, cy - 2.5 + k * 1.6); x.stroke(); } };
  const materialDraw = {
    wood(x, d) { x.save(); x.translate(16, 16); x.rotate(-0.5); rr(x, -13, -5, 26, 10, 4, d.col); rr(x, -13, -5, 26, 4, 3, shade(d.col, 35)); circ(x, 11, 0, 5, shade(d.col, 30)); circ(x, 11, 0, 3, shade(d.col, -20)); circ(x, 11, 0, 1.2, shade(d.col, 20)); x.restore(); },
    stick(x, d) { haft(x, 7, 26, 25, 6, 4, d.col); x.strokeStyle = d.col; x.lineWidth = 3; x.beginPath(); x.moveTo(15, 17); x.lineTo(21, 15); x.stroke(); },
    stone(x, d) { poly(x, [[6, 22], [9, 11], [17, 7], [26, 12], [25, 23], [15, 26]], d.col); poly(x, [[9, 11], [17, 7], [21, 13], [12, 15]], shade(d.col, 40)); poly(x, [[6, 22], [15, 26], [25, 23], [22, 19], [10, 19]], shade(d.col, -35)); },
    fiber(x, d) { for (let k = 0; k < 6; k++) { x.strokeStyle = k % 2 ? d.col : shade(d.col, -30); x.lineWidth = 2; x.beginPath(); x.moveTo(9 + k * 2.4, 27); x.quadraticCurveTo(10 + k * 2.4 + (k % 2 ? 4 : -3), 15, 12 + k * 2.2, 5 + (k % 3) * 2); x.stroke(); } },
    rope(x, d) { x.strokeStyle = d.col; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.ellipse(16, 17, 9, 7, 0, 0, Math.PI * 2); x.stroke(); x.strokeStyle = shade(d.col, -50); x.lineWidth = 1; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; x.beginPath(); x.moveTo(16 + Math.cos(a) * 7, 17 + Math.sin(a) * 5); x.lineTo(16 + Math.cos(a + 0.4) * 11, 17 + Math.sin(a + 0.4) * 9); x.stroke(); } x.strokeStyle = d.col; x.lineWidth = 4; x.beginPath(); x.moveTo(20, 9); x.lineTo(26, 5); x.stroke(); },
    coal(x, d) { materialDraw.stone(x, { col: '#2a2a32' }); circ(x, 13, 14, 1.5, '#7a7a90'); circ(x, 20, 18, 1.2, '#7a7a90'); },
    iron_ore(x, d) { materialDraw.stone(x, { col: '#8a8a90' }); circ(x, 13, 15, 2.6, d.col); circ(x, 20, 12, 2, d.col); circ(x, 19, 20, 2.2, d.col); gloss(x, 12, 14, 1.2); },
    gold_ore(x, d) { materialDraw.stone(x, { col: '#8a8a90' }); circ(x, 13, 15, 2.8, '#ffd24a'); circ(x, 20, 12, 2.2, '#ffe070'); circ(x, 19, 20, 2.4, '#ffd24a'); gloss(x, 12, 14, 1.4); },
    obsidian(x, d) { poly(x, [[8, 24], [10, 10], [17, 5], [24, 12], [23, 25], [15, 27]], '#3a3048'); poly(x, [[10, 10], [17, 5], [20, 12], [13, 15]], '#8060b0'); poly(x, [[13, 15], [20, 12], [23, 25], [15, 27]], '#5a4878'); gloss(x, 15, 9, 2); },
    bar(x, d) { x.save(); x.translate(16, 17); x.rotate(-0.35); poly(x, [[-13, 2], [-10, -5], [10, -5], [13, 2]], shade(d.col, 30)); rr(x, -13, 2, 26, 7, 1.5, d.col); rr(x, -13, 6, 26, 3, 1.5, shade(d.col, -40)); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(-8, -3, 8, 1.5); x.restore(); },
    generic(x, d) { poly(x, [[7, 23], [9, 11], [17, 6], [25, 13], [24, 24], [15, 27]], d.col); poly(x, [[9, 11], [17, 6], [21, 13], [12, 15]], shade(d.col, 45)); poly(x, [[7, 23], [15, 27], [24, 24], [21, 19], [10, 19]], shade(d.col, -35)); },
  };
  const foodDraw = {
    berry(x, d) { x.strokeStyle = '#3a7a3a'; x.lineWidth = 2; x.beginPath(); x.moveTo(16, 6); x.lineTo(16, 13); x.stroke(); poly(x, [[16, 7], [22, 4], [21, 10]], '#4a9a4a'); [[11, 17], [19, 16], [15, 23], [22, 22], [9, 24]].forEach(([cx, cy]) => { circ(x, cx, cy, 4.2, d.col); gloss(x, cx - 1.3, cy - 1.5, 1.6); }); },
    mushroom(x, d) { rr(x, 12, 15, 8, 12, 3, '#e8e0c8'); rr(x, 12, 15, 8, 4, 2, '#cfc6ac'); x.fillStyle = d.col; x.beginPath(); x.ellipse(16, 14, 12, 8, 0, Math.PI, 0); x.fill(); circ(x, 11, 10, 2, '#fff8e8'); circ(x, 19, 8, 1.6, '#fff8e8'); circ(x, 22, 12, 1.4, '#fff8e8'); },
    cactus_fruit(x, d) { x.fillStyle = d.col; x.beginPath(); x.ellipse(16, 17, 8, 10, 0, 0, Math.PI * 2); x.fill(); for (let k = 0; k < 7; k++) circ(x, 16 + Math.cos(k * 0.9) * 5, 17 + Math.sin(k * 0.9) * 7, 0.9, shade(d.col, -60)); rr(x, 14, 5, 4, 5, 1, '#3a9a4a'); gloss(x, 12, 12, 2.2); },
    raw_meat(x, d) { x.fillStyle = d.col; x.beginPath(); x.ellipse(14, 17, 10, 8, -0.4, 0, Math.PI * 2); x.fill(); x.fillStyle = '#f0d0c0'; x.beginPath(); x.ellipse(24, 9, 4, 3, -0.4, 0, Math.PI * 2); x.fill(); rr(x, 20, 9, 5, 4, 1, '#f0d0c0'); circ(x, 12, 17, 3, shade(d.col, 40)); gloss(x, 10, 13, 2.5); },
    cooked_meat(x, d) { foodDraw.raw_meat(x, d); x.fillStyle = 'rgba(60,20,10,0.35)'; for (let k = 0; k < 3; k++) x.fillRect(8 + k * 4, 12 + k * 3, 6, 1.5); },
    bread(x, d) { x.fillStyle = d.col; x.beginPath(); x.ellipse(16, 17, 12, 8, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = shade(d.col, 35); x.beginPath(); x.ellipse(16, 14, 11, 5, 0, Math.PI, 0); x.fill(); x.strokeStyle = shade(d.col, -50); x.lineWidth = 1.5; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(9 + k * 6, 12); x.lineTo(12 + k * 6, 16); x.stroke(); } },
    stew(x, d) { rr(x, 5, 14, 22, 12, 4, '#4a4a58'); rr(x, 5, 14, 22, 3, 2, '#6a6a78'); x.fillStyle = d.col; x.beginPath(); x.ellipse(16, 15, 10, 3, 0, 0, Math.PI * 2); x.fill(); circ(x, 12, 15, 1.6, '#e0a040'); circ(x, 19, 14, 1.4, '#6ab04a'); x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(13, 10); x.quadraticCurveTo(14, 6, 12, 3); x.moveTo(19, 10); x.quadraticCurveTo(20, 6, 18, 3); x.stroke(); },
    wheat(x, d) { for (let k = 0; k < 3; k++) { const bx = 11 + k * 5; x.strokeStyle = '#b09a3a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(bx, 28); x.lineTo(bx + 1, 12); x.stroke(); for (let g = 0; g < 4; g++) { x.fillStyle = g % 2 ? d.col : shade(d.col, 25); x.beginPath(); x.ellipse(bx + 1 + (g % 2 ? 2 : -2), 12 - g * 2.2, 2, 3, g % 2 ? 0.5 : -0.5, 0, Math.PI * 2); x.fill(); } } },
    bandage(x, d) { x.save(); x.translate(16, 16); x.rotate(-0.4); rr(x, -12, -6, 24, 12, 3, d.col); for (let k = -10; k < 12; k += 4) { x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(k, -6, 1.2, 12); } circ(x, 8, 0, 5.5, shade(d.col, -20)); circ(x, 8, 0, 3.5, d.col); circ(x, 8, 0, 1.2, shade(d.col, -40)); x.fillStyle = '#e03040'; x.fillRect(-6, -1, 5, 2); x.fillRect(-4.5, -2.5, 2, 5); x.restore(); },
    generic(x, d) { circ(x, 16, 18, 10, d.col); gloss(x, 12, 13, 3); rr(x, 15, 5, 2, 5, 1, '#3a7a3a'); },
  };
  const itemDraw = {
    material(x, d) { (materialDraw[d.id] || (/_bar$/.test(d.id) ? materialDraw.bar : materialDraw.generic))(x, d); },
    food(x, d) { (foodDraw[d.id] || foodDraw.generic)(x, d); },
    tool(x, d) {
      haft(x, 7, 27, 23, 9, 3.6, '#8a5a30'); wrap(x, 12, 21, '#4a3010');
      if (d.tool === 'axe') { poly(x, [[19, 5], [29, 8], [30, 16], [23, 14], [17, 12]], d.col); poly(x, [[29, 8], [30, 16], [31, 12]], shade(d.col, 70)); poly(x, [[19, 5], [23, 6], [22, 10], [17, 12]], shade(d.col, -35)); rr(x, 20, 9, 6, 3, 1, shade(d.col, -50)); }
      else { poly(x, [[10, 8], [24, 4], [30, 10], [26, 12], [22, 9], [14, 12]], d.col); poly(x, [[24, 4], [30, 10], [28, 6]], shade(d.col, 60)); poly(x, [[10, 8], [14, 12], [8, 12]], shade(d.col, -30)); rr(x, 19, 6, 5, 4, 1, shade(d.col, -50)); }
    },
    weapon(x, d) {
      const id = d.id; const kind = /dagger|fang/.test(id) ? 'dagger' : /greatsword|bonecleaver/.test(id) ? 'great' : /hammer|maul/.test(id) ? 'hammer' : /spear/.test(id) ? 'spear' : /fist/.test(id) ? 'fist' : 'sword';
      if (kind === 'hammer') { haft(x, 8, 27, 21, 11, 3.6, '#6a4a20'); wrap(x, 12, 22, '#3a2810'); x.save(); x.translate(22, 9); x.rotate(0.65); rr(x, -9, -5, 18, 10, 2, d.col); rr(x, -9, -5, 18, 3, 1.5, shade(d.col, 45)); rr(x, -9, -5, 3, 10, 1.5, shade(d.col, 60)); rr(x, 6, -5, 3, 10, 1.5, shade(d.col, 60)); x.restore(); return; }
      if (kind === 'spear') { haft(x, 5, 28, 23, 9, 2.6, '#8a5a30'); poly(x, [[21, 10], [29, 2], [27, 10]], d.col); poly(x, [[21, 10], [29, 2], [24, 9]], shade(d.col, 60)); wrap(x, 20, 12, '#c0303a'); return; }
      if (kind === 'fist') { rr(x, 7, 12, 18, 14, 5, d.col); for (let k = 0; k < 4; k++) rr(x, 8 + k * 4.2, 9, 3.4, 6, 1.5, shade(d.col, 30)); rr(x, 7, 20, 18, 4, 2, shade(d.col, -35)); gloss(x, 12, 15, 2.5); return; }
      x.save(); x.translate(16, 16); x.rotate(-Math.PI / 4);
      const L = kind === 'dagger' ? 9 : kind === 'great' ? 15 : 13, w = kind === 'great' ? 6 : kind === 'dagger' ? 3.4 : 4.4;
      rr(x, -1.6, 4, 3.2, 8, 1.2, '#4a3010'); circ(x, 0, 12.5, 2.2, '#9a8a48'); rr(x, -6, 2, 12, 2.6, 1, '#7a6a38'); circ(x, -6, 3.2, 1.6, '#a08a48'); circ(x, 6, 3.2, 1.6, '#a08a48');
      poly(x, [[-w / 2, 2], [w / 2, 2], [w / 2, 2 - L], [0, 2 - L - 4], [-w / 2, 2 - L]], d.col); poly(x, [[-w / 2, 2], [-w / 2 + 1.2, 2], [-w / 2 + 1.2, 2 - L], [-w / 2, 2 - L]], shade(d.col, 70)); poly(x, [[w / 2 - 1.2, 2], [w / 2, 2], [w / 2, 2 - L], [w / 2 - 1.2, 2 - L]], shade(d.col, -45));
      if (d.burn || d.special) { x.fillStyle = 'rgba(255,200,120,0.35)'; x.fillRect(-w / 2 - 1.5, 2 - L - 3, w + 3, L + 4); } x.restore();
    },
    bow(x, d) { const cross = /crossbow/.test(d.id); if (cross) { haft(x, 9, 26, 22, 8, 3.2, '#6a4a20'); x.strokeStyle = d.col; x.lineWidth = 3; x.beginPath(); x.moveTo(8, 8); x.lineTo(26, 16); x.stroke(); x.strokeStyle = '#e8e8f0'; x.lineWidth = 1; x.beginPath(); x.moveTo(8, 8); x.lineTo(17, 5); x.lineTo(26, 16); x.stroke(); return; }
      x.strokeStyle = d.col; x.lineWidth = 3.2; x.lineCap = 'round'; x.beginPath(); x.arc(10, 16, 13, -1.15, 1.15); x.stroke(); x.strokeStyle = shade(d.col, 50); x.lineWidth = 1.2; x.beginPath(); x.arc(10, 16, 12, -1.0, 1.0); x.stroke(); x.strokeStyle = '#e8e8f0'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(15.3, 4.2); x.lineTo(15.3, 27.8); x.stroke(); rr(x, 21, 13, 3, 6, 1, '#4a3010'); },
    arrow(x, d) { haft(x, 5, 27, 24, 8, 2.2, '#d8c8a8'); poly(x, [[22, 10], [29, 3], [27, 11]], '#9a9ca1'); poly(x, [[22, 10], [29, 3], [25, 10]], '#d0d0d8'); poly(x, [[5, 27], [3, 22], [9, 24]], '#e05050'); poly(x, [[5, 27], [10, 29], [9, 24]], '#c03030'); },
    shield(x, d) { poly(x, [[6, 5], [26, 5], [26, 17], [16, 28], [6, 17]], d.col); poly(x, [[6, 5], [16, 5], [16, 28], [6, 17]], shade(d.col, 30)); x.strokeStyle = shade(d.col, -50); x.lineWidth = 2; x.beginPath(); x.moveTo(6, 5); x.lineTo(26, 5); x.lineTo(26, 17); x.lineTo(16, 28); x.lineTo(6, 17); x.closePath(); x.stroke(); rr(x, 14.5, 8, 3, 15, 1, shade(d.col, -45)); rr(x, 9, 12, 14, 3, 1, shade(d.col, -45)); circ(x, 16, 13.5, 2.4, '#ffd24a'); },
    armor(x, d) {
      if (d.slot === 'head') { x.fillStyle = d.col; x.beginPath(); x.arc(16, 15, 11, Math.PI, 0); x.lineTo(27, 22); x.lineTo(5, 22); x.closePath(); x.fill(); rr(x, 5, 20, 22, 4, 1.5, shade(d.col, -30)); rr(x, 10, 15, 12, 5, 1.5, '#14121a'); rr(x, 15, 5, 2, 10, 1, shade(d.col, 50)); gloss(x, 11, 9, 2.5); }
      else if (d.slot === 'chest') { poly(x, [[8, 6], [24, 6], [29, 12], [26, 15], [25, 27], [7, 27], [6, 15], [3, 12]], d.col); poly(x, [[8, 6], [16, 6], [16, 27], [7, 27], [6, 15], [3, 12]], shade(d.col, 25)); rr(x, 12, 4, 8, 4, 1.5, '#14121a'); rr(x, 15, 10, 2, 15, 1, shade(d.col, -45)); rr(x, 9, 20, 14, 2, 1, shade(d.col, -45)); }
      else if (d.slot === 'legs') { rr(x, 7, 5, 18, 6, 2, shade(d.col, -25)); poly(x, [[7, 10], [15, 10], [14, 28], [6, 28]], d.col); poly(x, [[17, 10], [25, 10], [26, 28], [18, 28]], d.col); rr(x, 7, 10, 3, 18, 1, shade(d.col, 30)); rr(x, 18, 10, 3, 18, 1, shade(d.col, 30)); rr(x, 6, 25, 8, 3, 1, shade(d.col, -45)); rr(x, 18, 25, 8, 3, 1, shade(d.col, -45)); }
      else { x.strokeStyle = '#8a7a50'; x.lineWidth = 2; x.beginPath(); x.arc(16, 12, 9, 0.3, Math.PI - 0.3, true); x.stroke(); circ(x, 16, 21, 6, shade(d.col, -30)); circ(x, 16, 21, 4.5, d.col); gloss(x, 14.5, 19.5, 1.6); }
    },
    place(x, d) { const oc = Sp.obj(d.obj); x.imageSmoothingEnabled = false; x.drawImage(oc, 0, oc.height === 32 ? 8 : 0, 16, 16, 3, 3, 26, 26); x.imageSmoothingEnabled = true; },
    key(x, d) { rr(x, 13, 6, 6, 21, 2, '#6a4a30'); rr(x, 14, 6, 2, 21, 1, shade('#6a4a30', 40)); rr(x, 9, 8, 14, 6, 2, d.col); rr(x, 9, 17, 14, 6, 2, d.col); rr(x, 11, 10, 3, 2, 0.5, '#14121a'); rr(x, 18, 19, 3, 2, 0.5, '#14121a'); },
    staff(x, d) { haft(x, 9, 28, 21, 11, 3.4, '#5a3a20'); for (let k = 0; k < 3; k++) { x.strokeStyle = '#5a3a20'; x.lineWidth = 2; x.beginPath(); x.moveTo(21, 11); x.lineTo(21 + Math.cos(-1.2 + k * 1.2) * 6, 11 + Math.sin(-1.2 + k * 1.2) * 6 - 2); x.stroke(); } circ(x, 22, 8, 5, shade(d.col, -20)); circ(x, 22, 8, 3.8, d.col); gloss(x, 20.5, 6.5, 1.5); x.fillStyle = 'rgba(255,255,255,0.25)'; circ(x, 22, 8, 6.5, 'rgba(255,255,255,0.12)'); },
    gem(x, d) { poly(x, [[16, 4], [27, 13], [16, 28], [5, 13]], d.col); poly(x, [[16, 4], [27, 13], [16, 13]], shade(d.col, 50)); poly(x, [[5, 13], [16, 13], [16, 28]], shade(d.col, -40)); poly(x, [[16, 4], [16, 13], [5, 13]], shade(d.col, 20)); gloss(x, 12, 9, 2.2); },
    arrowless(x, d) { materialDraw.generic(x, d); },
  };
  Sp.item = function (id) {
    const key = 'i:' + id; if (cache[key]) return cache[key];
    const [c, x] = mk(S32, S32); x.imageSmoothingEnabled = true; const d = G.ITEMS[id];
    if (id === 'coin') { circ(x, 16, 16, 11, '#c9a020'); circ(x, 16, 16, 9, '#ffd24a'); circ(x, 16, 16, 6.5, '#e0b030'); x.fillStyle = '#fff0a0'; x.font = 'bold 9px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('¢', 16, 16.5); gloss(x, 12, 11, 2.5); }
    else if (d.type === 'place' && d.obj === 'torch') { haft(x, 16, 28, 16, 12, 3.6, '#8a5a30'); poly(x, [[10, 12], [22, 12], [20, 6], [16, 1], [12, 6]], '#ff9a30'); poly(x, [[13, 11], [19, 11], [18, 7], [16, 4], [14, 7]], '#ffe060'); }
    else (itemDraw[d.type] || itemDraw.material)(x, d);
    // soft drop shadow under the icon then the dark pixel outline
    if (id !== 'coin') { const [c2, x2] = mk(S32, S32); x2.globalAlpha = 0.35; x2.drawImage(c, 1, 1.5); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#000'; x2.fillRect(0, 0, S32, S32); x2.globalCompositeOperation = 'source-over'; x2.globalAlpha = 1; x2.drawImage(c, 0, 0); outline(c2); cache[key] = c2; return c2; }
    cache[key] = c; return c;
  };
  Sp.powerup = function (id) {
    const key = 'p:' + id; if (cache[key]) return cache[key];
    const [c, x] = mk(16, 16); const d = G.PW[id];
    x.fillStyle = G.RARITY_COL[d.rarity]; x.beginPath(); x.arc(8, 8, 7, 0, 7); x.fill();
    x.fillStyle = d.col; x.beginPath(); x.arc(8, 8, 5, 0, 7); x.fill();
    x.fillStyle = OUT; x.font = 'bold 8px monospace'; x.textAlign = 'center'; x.fillText(d.name[0], 8, 11);
    cache[key] = c; return c;
  };

  // ---------- creatures ----------
  // humanoid: 12x16 body. col = shirt, skin, frame 0/1, flags
  function humanoid(x, col, skin, frame, o) {
    o = o || {}; const s = o.scale || 1; x.save(); x.scale(s, s);
    const legY = 11, step = frame ? 1 : 0;
    px(x, 3, legY + step, 2, 4 - step, o.legs || '#3a3040'); px(x, 7, legY + (1 - step), 2, 3 + step, o.legs || '#3a3040');
    px(x, 2, 6, 8, 6, col); px(x, 3, 7, 6, 1, shade(col, 40));
    if (o.armor) { px(x, 2, 6, 8, 6, o.armor); px(x, 5, 7, 2, 4, shade(o.armor, -40)); }
    px(x, 3, 1, 6, 5, skin); px(x, 4, 3, 1, 1, OUT); px(x, 7, 3, 1, 1, OUT);
    if (o.helm) { px(x, 2, 0, 8, 3, o.helm); px(x, 2, 2, 2, 2, o.helm); px(x, 8, 2, 2, 2, o.helm); }
    if (o.hair) px(x, 3, 0, 6, 2, o.hair);
    if (o.crown) { px(x, 3, -1, 6, 2, '#ffd24a'); px(x, 3, -3, 1, 2, '#ffd24a'); px(x, 5, -3, 2, 2, '#ffd24a'); px(x, 8, -3, 1, 2, '#ffd24a'); }
    x.restore();
  }
  function quadruped(x, col, frame) {
    px(x, 2, 6, 11, 5, col); px(x, 11, 4, 5, 5, col); px(x, 14, 5, 1, 1, '#ff4040'); px(x, 12, 8, 3, 1, shade(col, -40));
    px(x, 3, 11, 2, 3 + (frame ? 1 : 0), shade(col, -30)); px(x, 6, 11, 2, 4 - (frame ? 1 : 0), shade(col, -30)); px(x, 9, 11, 2, 3 + (frame ? 1 : 0), shade(col, -30)); px(x, 11, 11, 2, 4 - (frame ? 1 : 0), shade(col, -30));
    px(x, 0, 5, 3, 2, col); px(x, 12, 2, 2, 2, col);
  }
  const enDraw = {
    slime(x, c, f) { x.fillStyle = c; x.beginPath(); x.ellipse(8, 11 + (f ? 1 : 0), 7, 5 - (f ? 1 : 0), 0, 0, 7); x.fill(); px(x, 5, 9, 2, 2, OUT); px(x, 9, 9, 2, 2, OUT); px(x, 4, 7, 3, 1, shade(c, 60)); },
    slime_small(x, c, f) { x.fillStyle = c; x.beginPath(); x.ellipse(8, 12, 4, 3, 0, 0, 7); x.fill(); px(x, 6, 11, 1, 1, OUT); px(x, 9, 11, 1, 1, OUT); },
    goblin(x, c, f) { humanoid(x, c, '#7aa040', f, { legs: '#4a5a20' }); px(x, 0, 2, 3, 2, '#7aa040'); px(x, 9, 2, 3, 2, '#7aa040'); px(x, 10, 7, 2, 6, '#9a9ca1'); },
    goblin_archer(x, c, f) { humanoid(x, c, '#7aa040', f, { legs: '#4a5a20', hair: '#4a3020' }); x.strokeStyle = '#8a5a30'; x.lineWidth = 1.5; x.beginPath(); x.arc(11, 8, 4, -1.3, 1.3); x.stroke(); },
    wolf(x, c, f) { quadruped(x, c, f); },
    wolf_pet(x, c, f) { quadruped(x, c, f); px(x, 11, 3, 5, 1, '#ff4040'); },
    treant(x, c, f) { px(x, 4, 10, 8, 6, '#5a3a20'); px(x, 2, 14, 3, 2, '#5a3a20'); px(x, 11, 14, 3, 2, '#5a3a20'); px(x, 5, 4, 6, 7, '#6b4426'); x.fillStyle = c; x.beginPath(); x.arc(8, 4, 6, 0, 7); x.fill(); px(x, 6, 6, 1, 2, '#ffe040'); px(x, 9, 6, 1, 2, '#ffe040'); px(x, 0, 6, 5, 2, '#6b4426'); px(x, 11, 5, 5, 2, '#6b4426'); },
    skeleton(x, c, f) { humanoid(x, '#e8e8e0', '#f0f0e8', f, { legs: '#d0d0c8' }); px(x, 4, 8, 4, 1, OUT); px(x, 4, 10, 4, 1, OUT); px(x, 10, 5, 4, 7, '#6a5a40'); px(x, 11, 6, 2, 5, '#9a9ca1'); },
    crawler(x, c, f) { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? c : shade(c, -40); x.beginPath(); x.arc(3 + i * 3.4, 10 + (f ? (i % 2) : (1 - i % 2)), 3, 0, 7); x.fill(); } px(x, 12, 7, 2, 2, '#ffe040'); px(x, 1, 13, 14, 1, shade(c, -60)); },
    bat(x, c, f) { px(x, 6, 6, 4, 4, c); px(x, 6, 6, 1, 1, '#ff4040'); px(x, 9, 6, 1, 1, '#ff4040'); if (f) { px(x, 0, 4, 6, 3, c); px(x, 10, 4, 6, 3, c); } else { px(x, 1, 8, 5, 3, c); px(x, 10, 8, 5, 3, c); } },
    tentacle(x, c, f) { px(x, 5, 2 + (f ? 1 : 0), 6, 14, c); px(x, 6, 2 + (f ? 1 : 0), 2, 14, shade(c, 40)); px(x, 4, 5, 2, 2, '#80c0ff'); px(x, 10, 9, 2, 2, '#80c0ff'); px(x, 3, 12, 2, 2, '#80c0ff'); },
    gronk(x, c, f) { humanoid(x, c, '#8aa050', f, { legs: '#4a4a30', scale: 2 }); px(x, 20, 2, 6, 22, '#6a4a20'); px(x, 18, 0, 10, 6, '#8a8a90'); px(x, 8, 4, 2, 2, '#ffe040'); px(x, 14, 4, 2, 2, '#ffe040'); },
    hollow(x, c, f) { humanoid(x, c, '#e8e8e0', f, { legs: '#202040', scale: 2, crown: true }); px(x, 8, 5, 2, 2, '#60a0ff'); px(x, 14, 5, 2, 2, '#60a0ff'); px(x, 2, 12, 20, 14, 'rgba(20,20,60,0.8)'); },
    cinder(x, c, f) { for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? c : shade(c, -50); x.beginPath(); x.arc(4 + i * 6, 18 + (f ? (i % 2) * 2 : (1 - i % 2) * 2), 6, 0, 7); x.fill(); } x.fillStyle = shade(c, 20); x.beginPath(); x.arc(27, 14, 8, 0, 7); x.fill(); px(x, 28, 10, 3, 3, '#ffe040'); px(x, 24, 18, 8, 2, OUT); px(x, 26, 16, 1, 3, '#fff'); },
    leviathan(x, c, f) { x.fillStyle = c; x.beginPath(); x.ellipse(24, 26, 22, 14, 0, 0, 7); x.fill(); x.fillStyle = shade(c, 30); x.beginPath(); x.ellipse(24, 20, 16, 8, 0, 0, 7); x.fill(); px(x, 12, 16, 5, 5, '#ffe040'); px(x, 30, 16, 5, 5, '#ffe040'); px(x, 14, 18, 2, 2, OUT); px(x, 32, 18, 2, 2, OUT); for (let i = 0; i < 6; i++) px(x, 12 + i * 4, 30, 2, 5, '#e0f0ff'); px(x, 4, 4 + (f ? 2 : 0), 4, 16, c); px(x, 40, 2 + (f ? 0 : 2), 4, 18, c); },
  };
  Sp.enemy = function (t, frame, flash) {
    const key = 'e:' + t + ':' + frame + ':' + (flash ? 1 : 0); if (cache[key]) return cache[key];
    const d = G.ENEMIES[t]; const big = d.boss; const size = t === 'leviathan' ? 48 : big ? 32 : 16;
    const [c, x] = mk(size, size);
    (enDraw[t] || enDraw.goblin)(x, d.col, frame);
    outline(c);
    if (flash) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, size, size); }
    cache[key] = c; return c;
  };
  Sp.player = function (col, frame, flash, armor) {
    const key = 'pl:' + col + ':' + frame + ':' + (flash ? 1 : 0) + ':' + (armor || ''); if (cache[key]) return cache[key];
    const [c, x] = mk(12, 16);
    const a = armor ? armor.split(',') : [];
    humanoid(x, col, '#f0c8a0', frame, { legs: a[2] ? a[2] : '#3a3040', hair: '#5a3a20', armor: a[1] || null, helm: a[0] || null });
    outline(c);
    if (flash) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, 12, 16); }
    cache[key] = c; return c;
  };
})(window.G);
