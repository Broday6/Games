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

  // ---------- items ----------
  const itemDraw = {
    material(x, d) { x.fillStyle = d.col; x.beginPath(); x.moveTo(3, 12); x.lineTo(4, 5); x.lineTo(9, 3); x.lineTo(13, 7); x.lineTo(12, 13); x.fill(); px(x, 5, 6, 3, 2, shade(d.col, 40)); },
    food(x, d) { x.fillStyle = d.col; x.beginPath(); x.arc(8, 9, 5, 0, 7); x.fill(); px(x, 6, 6, 2, 2, shade(d.col, 60)); px(x, 8, 3, 1, 2, '#3a7a3a'); },
    tool(x, d) { px(x, 7, 6, 2, 9, '#8a5a30'); if (d.tool === 'axe') { px(x, 3, 2, 7, 5, d.col); px(x, 3, 2, 7, 1, shade(d.col, 40)); } else { px(x, 2, 3, 12, 3, d.col); px(x, 2, 3, 12, 1, shade(d.col, 40)); } },
    weapon(x, d) { x.save(); x.translate(8, 8); x.rotate(-Math.PI / 4); px(x, -1, -8, 2, 11, d.col); px(x, -1, -8, 1, 11, shade(d.col, 50)); px(x, -3, 3, 6, 1, '#6a4a20'); px(x, -1, 4, 2, 4, '#4a3010'); x.restore(); },
    bow(x, d) { x.strokeStyle = d.col; x.lineWidth = 2; x.beginPath(); x.arc(5, 8, 6, -1.2, 1.2); x.stroke(); x.strokeStyle = '#e0e0e0'; x.lineWidth = 1; x.beginPath(); x.moveTo(7, 2.5); x.lineTo(7, 13.5); x.stroke(); },
    arrow(x, d) { px(x, 3, 7, 10, 1, '#d8c8a8'); px(x, 12, 6, 3, 3, '#9a9ca1'); px(x, 2, 5, 2, 2, '#e05050'); px(x, 2, 8, 2, 2, '#e05050'); },
    shield(x, d) { x.fillStyle = d.col; x.beginPath(); x.moveTo(3, 3); x.lineTo(13, 3); x.lineTo(13, 9); x.lineTo(8, 14); x.lineTo(3, 9); x.fill(); px(x, 7, 5, 2, 6, shade(d.col, 60)); },
    armor(x, d) { if (d.slot === 'head') { px(x, 3, 5, 10, 7, d.col); px(x, 4, 3, 8, 2, d.col); px(x, 5, 8, 6, 2, OUT); } else if (d.slot === 'chest') { px(x, 3, 3, 10, 10, d.col); px(x, 1, 3, 2, 5, d.col); px(x, 13, 3, 2, 5, d.col); px(x, 6, 5, 4, 5, shade(d.col, -30)); } else { px(x, 3, 3, 10, 4, d.col); px(x, 3, 7, 4, 7, d.col); px(x, 9, 7, 4, 7, d.col); } },
    place(x, d) { const oc = Sp.obj(d.obj); x.drawImage(oc, 0, oc.height === 32 ? 8 : 0, 16, 16, 0, 0, 16, 16); },
    key(x, d) { px(x, 6, 2, 4, 12, '#6a4a30'); px(x, 5, 3, 6, 3, d.col); px(x, 5, 8, 6, 3, d.col); px(x, 7, 4, 2, 1, OUT); px(x, 7, 9, 2, 1, OUT); },
    gem(x, d) { x.fillStyle = d.col; x.beginPath(); x.moveTo(8, 2); x.lineTo(13, 7); x.lineTo(8, 14); x.lineTo(3, 7); x.fill(); px(x, 6, 5, 2, 2, '#ffffff'); },
  };
  Sp.item = function (id) {
    const key = 'i:' + id; if (cache[key]) return cache[key];
    const [c, x] = mk(16, 16); const d = G.ITEMS[id];
    if (id === 'coin') { px(x, 5, 4, 6, 8, '#ffd24a'); px(x, 6, 5, 2, 6, '#fff0a0'); }
    else if (d.type === 'place' && d.obj === 'torch') objDraw.torch(x);
    else (itemDraw[d.type] || itemDraw.material)(x, d);
    if (id !== 'coin') outline(c); cache[key] = c; return c;
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
