'use strict';
// TIDEWALL — procedural art: terrain, structures, towers, enemy sprites and UI icons. All canvas paths.
(function (TW) {
  const T = TW.T;
  const Art = TW.Art = {};
  const TAU = Math.PI * 2;

  function hash2(x, y, s) {
    let h = Math.imul(x * 374761393 + y * 668265263 + (s | 0) * 2147483647, 1274126177);
    h ^= h >>> 13; h = Math.imul(h, 1103515245); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  Art.hash2 = hash2;
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  Art.rr = rr;
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function shade(hex, f) { // f<0 darken, f>0 lighten
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; }
    return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
  }
  Art.shade = shade;

  // ---------------- terrain (cached) ----------------
  Art.isWater = function (terr, W, H, x, y) { return x < 0 || y < 0 || x >= W || y >= H || terr[y * W + x] === T.WATER; };
  Art.drawTerrain = function (g, map, ts) {
    const W = map.W, H = map.H, terr = map.terr, seed = map.seed | 0;
    // shallows: soft halos around the land (sea itself is drawn live underneath)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (terr[i] === T.WATER) continue;
      let coastal = false;
      for (let k = 0; k < 8 && !coastal; k++) { const xx = x + [1, -1, 0, 0, 1, 1, -1, -1][k], yy = y + [0, 0, 1, -1, 1, -1, 1, -1][k]; if (xx < 0 || yy < 0 || xx >= W || yy >= H || terr[yy * W + xx] === T.WATER) coastal = true; }
      if (!coastal) continue;
      const cx = (x + 0.5) * ts, cy = (y + 0.5) * ts, rad = ts * 1.9;
      const gr = g.createRadialGradient(cx, cy, ts * 0.4, cx, cy, rad);
      gr.addColorStop(0, 'rgba(110,215,225,0.5)'); gr.addColorStop(0.55, 'rgba(80,190,215,0.22)'); gr.addColorStop(1, 'rgba(60,160,200,0)');
      g.fillStyle = gr; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    // land: sand underlay with rounded edges, then grass
    const land = (t) => t !== T.WATER;
    g.fillStyle = '#e8d29a';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!land(terr[y * W + x])) continue;
      rr(g, x * ts - ts * 0.1, y * ts - ts * 0.1, ts * 1.2, ts * 1.2, ts * 0.42); g.fill();
    }
    // wet sand rim
    g.strokeStyle = 'rgba(190,160,100,0.5)'; g.lineWidth = Math.max(1, ts * 0.05);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!land(terr[y * W + x])) continue;
      rr(g, x * ts - ts * 0.1, y * ts - ts * 0.1, ts * 1.2, ts * 1.2, ts * 0.42); g.stroke();
    }
    g.fillStyle = '#e8d29a';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!land(terr[y * W + x])) continue;
      rr(g, x * ts - ts * 0.06, y * ts - ts * 0.06, ts * 1.12, ts * 1.12, ts * 0.38); g.fill();
    }
    const grassy = (t) => t === T.GRASS || t === T.TREE || t === T.STONE || t === T.CRYSTAL || t === T.ROCK;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = terr[y * W + x];
      if (!grassy(t)) continue;
      const h = hash2(x, y, seed);
      g.fillStyle = (x + y) % 2 ? '#5d9a4c' : '#64a352';
      if (h < 0.15) g.fillStyle = '#5a944a';
      const n = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && grassy(terr[yy * W + xx]); };
      const r = ts * 0.32;
      const l = n(-1, 0), rt = n(1, 0), u = n(0, -1), dn = n(0, 1);
      // rounded only on outer corners
      g.beginPath();
      const x0 = x * ts, y0 = y * ts, x1 = x0 + ts, y1 = y0 + ts;
      const tl = !l && !u ? r : 0, tr = !rt && !u ? r : 0, br = !rt && !dn ? r : 0, bl = !l && !dn ? r : 0;
      g.moveTo(x0 + tl, y0); g.lineTo(x1 - tr, y0); if (tr) g.arcTo(x1, y0, x1, y0 + tr, tr);
      g.lineTo(x1, y1 - br); if (br) g.arcTo(x1, y1, x1 - br, y1, br);
      g.lineTo(x0 + bl, y1); if (bl) g.arcTo(x0, y1, x0, y1 - bl, bl);
      g.lineTo(x0, y0 + tl); if (tl) g.arcTo(x0, y0, x0 + tl, y0, tl);
      g.closePath(); g.fill();
      // tufts
      if (t === T.GRASS) {
        g.strokeStyle = 'rgba(40,90,40,0.45)'; g.lineWidth = Math.max(1, ts * 0.035);
        for (let k = 0; k < 3; k++) {
          const hx = hash2(x * 3 + k, y * 7, seed + 1), hy = hash2(x * 5, y * 3 + k, seed + 2);
          if (hx > 0.75) continue;
          const px = x0 + (0.15 + hx * 0.7) * ts, py = y0 + (0.2 + hy * 0.65) * ts;
          g.beginPath(); g.moveTo(px - ts * 0.05, py); g.lineTo(px - ts * 0.07, py - ts * 0.09);
          g.moveTo(px, py); g.lineTo(px, py - ts * 0.12); g.moveTo(px + ts * 0.05, py); g.lineTo(px + ts * 0.08, py - ts * 0.08); g.stroke();
        }
        if (h > 0.9) { g.fillStyle = hash2(x, y, seed + 9) > 0.5 ? '#ffe9a0' : '#ffd0e0'; circle(g, x0 + ts * 0.7, y0 + ts * 0.3, ts * 0.05); g.fill(); }
      }
    }
    // sand speckles
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (terr[y * W + x] !== T.SAND && terr[y * W + x] !== T.CORE) continue;
      g.fillStyle = 'rgba(170,140,90,0.35)';
      for (let k = 0; k < 4; k++) { const hx = hash2(x * 11 + k, y, seed + 4), hy = hash2(x, y * 13 + k, seed + 5); g.fillRect(x * ts + hx * ts, y * ts + hy * ts, Math.max(1, ts * 0.04), Math.max(1, ts * 0.04)); }
      if (hash2(x, y, seed + 6) > 0.85) { // shell
        g.fillStyle = '#fff0e0'; g.beginPath(); g.ellipse(x * ts + ts * 0.3, y * ts + ts * 0.7, ts * 0.07, ts * 0.05, 0.5, 0, TAU); g.fill();
      }
    }
    // obstacles & nodes
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = terr[y * W + x], cx = (x + 0.5) * ts, cy = (y + 0.5) * ts;
      const h = hash2(x, y, seed + 3);
      if (t === T.ROCK) drawRock(g, cx, cy, ts, h, y === H - 1);
      else if (t === T.TREE) drawTree(g, cx, cy, ts, h);
      else if (t === T.STONE) drawBoulder(g, cx, cy, ts, h);
      else if (t === T.CRYSTAL) drawCrystal(g, cx, cy, ts, h);
    }
  };
  function drawRock(g, cx, cy, ts, h, sea) {
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(cx, cy + ts * 0.28, ts * 0.42, ts * 0.14, 0, 0, TAU); g.fill();
    g.fillStyle = sea ? '#5f6878' : '#767f90';
    g.beginPath();
    g.moveTo(cx - ts * 0.42, cy + ts * 0.28); g.lineTo(cx - ts * 0.3, cy - ts * (0.12 + h * 0.15)); g.lineTo(cx - ts * 0.02, cy - ts * 0.36);
    g.lineTo(cx + ts * 0.3, cy - ts * 0.18); g.lineTo(cx + ts * 0.42, cy + ts * 0.26); g.closePath(); g.fill();
    g.fillStyle = sea ? '#7d8698' : '#9aa3b4';
    g.beginPath(); g.moveTo(cx - ts * 0.3, cy - ts * (0.12 + h * 0.15)); g.lineTo(cx - ts * 0.02, cy - ts * 0.36); g.lineTo(cx + ts * 0.06, cy - ts * 0.02); g.lineTo(cx - ts * 0.2, cy + ts * 0.08); g.closePath(); g.fill();
  }
  function drawTree(g, cx, cy, ts, h) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx + ts * 0.04, cy + ts * 0.3, ts * 0.36, ts * 0.12, 0, 0, TAU); g.fill();
    g.fillStyle = '#6b4526'; g.fillRect(cx - ts * 0.05, cy + ts * 0.05, ts * 0.1, ts * 0.25);
    const palm = h > 0.55;
    if (palm) {
      g.strokeStyle = '#2f7a3a'; g.lineWidth = ts * 0.12; g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.62;
        g.beginPath(); g.moveTo(cx, cy - ts * 0.08); g.quadraticCurveTo(cx + Math.cos(a) * ts * 0.3, cy - ts * 0.3 + Math.sin(a) * ts * 0.1, cx + Math.cos(a) * ts * 0.42, cy + Math.sin(a) * ts * 0.25 + ts * 0.05); g.stroke();
      }
      g.lineCap = 'butt';
      g.fillStyle = '#7a4f2a'; circle(g, cx, cy - ts * 0.06, ts * 0.07); g.fill();
    } else {
      g.fillStyle = '#2e6a37'; circle(g, cx, cy - ts * 0.06, ts * 0.33); g.fill();
      g.fillStyle = '#3d8445'; circle(g, cx - ts * 0.08, cy - ts * 0.14, ts * 0.22); g.fill();
      g.fillStyle = '#58a35a'; circle(g, cx - ts * 0.12, cy - ts * 0.2, ts * 0.09); g.fill();
    }
  }
  function drawBoulder(g, cx, cy, ts, h) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + ts * 0.27, ts * 0.38, ts * 0.12, 0, 0, TAU); g.fill();
    g.fillStyle = '#8f9ab0'; g.beginPath(); g.ellipse(cx, cy + ts * 0.02, ts * 0.38, ts * 0.3, 0, 0, TAU); g.fill();
    g.fillStyle = '#b5bfd2'; g.beginPath(); g.ellipse(cx - ts * 0.08, cy - ts * 0.08, ts * 0.22, ts * 0.15, -0.3, 0, TAU); g.fill();
    g.strokeStyle = '#5d677c'; g.lineWidth = Math.max(1, ts * 0.04);
    g.beginPath(); g.moveTo(cx + ts * 0.05, cy - ts * 0.2); g.lineTo(cx + ts * 0.12, cy); g.lineTo(cx + ts * 0.05, cy + ts * 0.15); g.stroke();
    g.fillStyle = '#cfd6e4'; g.fillRect(cx - ts * 0.22, cy + ts * 0.05, ts * 0.06, ts * 0.06); g.fillRect(cx + ts * 0.18, cy - ts * 0.06, ts * 0.05, ts * 0.05);
  }
  function drawCrystal(g, cx, cy, ts, h) {
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, ts * 0.55);
    glow.addColorStop(0, 'rgba(170,150,255,0.45)'); glow.addColorStop(1, 'rgba(170,150,255,0)');
    g.fillStyle = glow; g.fillRect(cx - ts * 0.6, cy - ts * 0.6, ts * 1.2, ts * 1.2);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(cx, cy + ts * 0.28, ts * 0.3, ts * 0.1, 0, 0, TAU); g.fill();
    const shard = (x, y, w, hh, a, c1, c2) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = c1; g.beginPath(); g.moveTo(0, -hh); g.lineTo(w, -hh * 0.55); g.lineTo(w * 0.7, 0); g.lineTo(-w * 0.7, 0); g.lineTo(-w, -hh * 0.55); g.closePath(); g.fill();
      g.fillStyle = c2; g.beginPath(); g.moveTo(0, -hh); g.lineTo(w, -hh * 0.55); g.lineTo(w * 0.7, 0); g.lineTo(0, 0); g.closePath(); g.fill();
      g.restore();
    };
    shard(cx - ts * 0.16, cy + ts * 0.26, ts * 0.1, ts * 0.42, -0.35, '#8b7cff', '#b9aeff');
    shard(cx + ts * 0.15, cy + ts * 0.26, ts * 0.09, ts * 0.36, 0.4, '#7a6af0', '#a99dff');
    shard(cx, cy + ts * 0.28, ts * 0.13, ts * 0.62, 0.05, '#9d90ff', '#d9d3ff');
  }
  Art.drawCrystal = drawCrystal; Art.drawTree = drawTree; Art.drawBoulder = drawBoulder;

  // ---------------- lighthouse ----------------
  Art.lighthouse = function (g, cx, cy, ts, t, lit, hpFrac) {
    const b = cy + ts * 0.38;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, b, ts * 0.46, ts * 0.15, 0, 0, TAU); g.fill();
    // base
    g.fillStyle = '#6f7888'; rr(g, cx - ts * 0.42, b - ts * 0.26, ts * 0.84, ts * 0.3, ts * 0.08); g.fill();
    g.fillStyle = '#8c95a6'; rr(g, cx - ts * 0.42, b - ts * 0.26, ts * 0.84, ts * 0.1, ts * 0.05); g.fill();
    // tower (tapered with stripes)
    const top = b - ts * 1.45, w0 = ts * 0.3, w1 = ts * 0.2;
    g.save();
    g.beginPath(); g.moveTo(cx - w0, b - ts * 0.24); g.lineTo(cx - w1, top); g.lineTo(cx + w1, top); g.lineTo(cx + w0, b - ts * 0.24); g.closePath();
    g.fillStyle = '#f4f1ea'; g.fill(); g.clip();
    g.fillStyle = '#d8423a';
    for (let k = 0; k < 3; k++) { const y0 = b - ts * 0.24 - ts * (0.22 + k * 0.4); g.fillRect(cx - ts * 0.4, y0 - ts * 0.18, ts * 0.8, ts * 0.18); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(cx + ts * 0.02, top, ts * 0.4, ts * 1.3);
    g.restore();
    // gallery + lamp room
    g.fillStyle = '#2b3242'; g.fillRect(cx - ts * 0.27, top - ts * 0.04, ts * 0.54, ts * 0.07);
    const lampY = top - ts * 0.2;
    const pulse = lit ? 0.75 + 0.25 * Math.sin(t * 3) : 0.5;
    g.fillStyle = 'rgba(255,230,140,' + pulse + ')'; rr(g, cx - ts * 0.15, lampY - ts * 0.12, ts * 0.3, ts * 0.22, ts * 0.04); g.fill();
    g.strokeStyle = '#2b3242'; g.lineWidth = Math.max(1, ts * 0.035);
    g.beginPath(); g.moveTo(cx, lampY - ts * 0.12); g.lineTo(cx, lampY + ts * 0.1); g.stroke();
    g.fillStyle = '#d8423a'; g.beginPath(); g.moveTo(cx - ts * 0.2, lampY - ts * 0.11); g.lineTo(cx, lampY - ts * 0.3); g.lineTo(cx + ts * 0.2, lampY - ts * 0.11); g.closePath(); g.fill();
    // door
    g.fillStyle = '#5b3a24'; rr(g, cx - ts * 0.07, b - ts * 0.42, ts * 0.14, ts * 0.18, ts * 0.06); g.fill();
    return lampY;
  };

  // ---------------- walls / harvester ----------------
  Art.wall = function (g, x0, y0, ts, stone, nb, flash, hpFrac) {
    // nb bitmask: 1 left, 2 right, 4 up, 8 down
    const p = ts * 0.14, cx = x0 + ts / 2, cy = y0 + ts / 2;
    const L = nb & 1 ? x0 : x0 + p, R = nb & 2 ? x0 + ts : x0 + ts - p, U = nb & 4 ? y0 : y0 + p, D = nb & 8 ? y0 + ts : y0 + ts - p;
    const bw = ts * 0.5, top = ts * 0.22;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(cx - bw / 2 + ts * 0.04, cy - bw / 2 + ts * 0.1, bw, bw);
    if (nb & 1) g.fillRect(L, cy - bw / 2 + ts * 0.1, cx - L, bw);
    if (nb & 2) g.fillRect(cx, cy - bw / 2 + ts * 0.1, R - cx, bw);
    if (nb & 8) g.fillRect(cx - bw / 2 + ts * 0.04, cy, bw, D - cy + ts * 0.06);
    const side = stone ? '#6e778a' : '#7a4c27', face = stone ? '#a9b2c4' : '#b07a45', hi = stone ? '#cbd2df' : '#d29a5c';
    // body: center block + arms to neighbours
    const arm = (ax, ay, aw, ah) => { g.fillStyle = side; g.fillRect(ax, ay, aw, ah); g.fillStyle = face; g.fillRect(ax, ay - top, aw, ah); };
    if (nb & 4) arm(cx - bw / 2, U + top, bw, cy - U);
    arm(cx - bw / 2, cy - bw / 2 + top, bw, bw);
    if (nb & 1) arm(L, cy - bw / 2 + top, cx - L, bw);
    if (nb & 2) arm(cx, cy - bw / 2 + top, R - cx, bw);
    if (nb & 8) arm(cx - bw / 2, cy + top, bw, D - cy);
    // details
    g.fillStyle = hi;
    if (stone) {
      g.fillRect(cx - bw / 2, cy - bw / 2, bw, Math.max(1, ts * 0.05));
      g.strokeStyle = 'rgba(70,80,100,0.55)'; g.lineWidth = Math.max(1, ts * 0.03);
      g.beginPath(); g.moveTo(cx - bw / 2, cy); g.lineTo(cx + bw / 2, cy); g.moveTo(cx, cy - bw / 2); g.lineTo(cx, cy); g.moveTo(cx - bw * 0.25, cy); g.lineTo(cx - bw * 0.25, cy + bw / 2); g.moveTo(cx + bw * 0.25, cy); g.lineTo(cx + bw * 0.25, cy + bw / 2); g.stroke();
    } else {
      g.strokeStyle = 'rgba(80,45,20,0.6)'; g.lineWidth = Math.max(1, ts * 0.03);
      g.beginPath();
      for (let k = 1; k < 4; k++) { const xx = cx - bw / 2 + bw * k / 4; g.moveTo(xx, cy - bw / 2); g.lineTo(xx, cy + bw / 2); }
      g.stroke();
      // pointed stake tips
      g.fillStyle = hi;
      for (let k = 0; k < 4; k++) { const xx = cx - bw / 2 + bw * (k + 0.5) / 4; g.beginPath(); g.moveTo(xx - bw / 8, cy - bw / 2); g.lineTo(xx, cy - bw / 2 - ts * 0.08); g.lineTo(xx + bw / 8, cy - bw / 2); g.fill(); }
    }
    if (hpFrac < 0.99) { // cracks
      g.strokeStyle = 'rgba(20,10,10,' + (0.8 - hpFrac * 0.6) + ')'; g.lineWidth = Math.max(1, ts * 0.04);
      g.beginPath(); g.moveTo(cx - bw * 0.3, cy - bw * 0.4); g.lineTo(cx - bw * 0.05, cy - bw * 0.05); g.lineTo(cx - bw * 0.2, cy + bw * 0.3);
      if (hpFrac < 0.5) { g.moveTo(cx + bw * 0.35, cy - bw * 0.3); g.lineTo(cx + bw * 0.1, cy + bw * 0.05); g.lineTo(cx + bw * 0.3, cy + bw * 0.4); }
      g.stroke();
    }
    if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, flash * 5) + ')'; g.fillRect(cx - bw / 2, cy - bw / 2, bw, bw); }
  };
  Art.harvester = function (g, cx, cy, ts, t, yieldType) {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(cx, cy + ts * 0.3, ts * 0.36, ts * 0.12, 0, 0, TAU); g.fill();
    g.fillStyle = '#7a5230'; rr(g, cx - ts * 0.32, cy - ts * 0.08, ts * 0.64, ts * 0.38, ts * 0.06); g.fill();
    g.fillStyle = '#a06c3c'; rr(g, cx - ts * 0.32, cy - ts * 0.08, ts * 0.64, ts * 0.1, ts * 0.04); g.fill();
    g.fillStyle = '#3b5b8a'; g.beginPath(); g.moveTo(cx - ts * 0.38, cy - ts * 0.06); g.lineTo(cx, cy - ts * 0.38); g.lineTo(cx + ts * 0.38, cy - ts * 0.06); g.closePath(); g.fill();
    g.fillStyle = '#4f75ad'; g.beginPath(); g.moveTo(cx - ts * 0.38, cy - ts * 0.06); g.lineTo(cx, cy - ts * 0.38); g.lineTo(cx, cy - ts * 0.06); g.closePath(); g.fill();
    // wheel
    g.save(); g.translate(cx + ts * 0.22, cy + ts * 0.18); g.rotate(t * 1.5);
    g.strokeStyle = '#e6c08a'; g.lineWidth = Math.max(1, ts * 0.04);
    circle(g, 0, 0, ts * 0.12); g.stroke();
    g.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; g.moveTo(Math.cos(a) * ts * 0.12, Math.sin(a) * ts * 0.12); g.lineTo(-Math.cos(a) * ts * 0.12, -Math.sin(a) * ts * 0.12); } g.stroke();
    g.restore();
    g.fillStyle = '#2b1a0c'; g.fillRect(cx - ts * 0.18, cy + ts * 0.08, ts * 0.12, ts * 0.2);
  };

  // ---------------- towers ----------------
  // draws a tower centred at (cx, cy) bottom-anchored on the tile
  Art.tower = function (g, type, tier, br, cx, cy, ts, t, aim, pulse, flash) {
    const d = TW.TOWERS[type];
    const by = cy + ts * 0.22;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(cx, by + ts * 0.08, ts * 0.42, ts * 0.15, 0, 0, TAU); g.fill();
    // stone plinth (bigger with tier)
    const pw = ts * (0.36 + tier * 0.03);
    g.fillStyle = '#5d6577'; g.beginPath(); g.ellipse(cx, by, pw, pw * 0.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#4a5162'; g.fillRect(cx - pw, by - ts * 0.14, pw * 2, ts * 0.14);
    g.fillStyle = '#7e879b'; g.beginPath(); g.ellipse(cx, by - ts * 0.14, pw, pw * 0.5, 0, 0, TAU); g.fill();
    if (tier === 2) { g.strokeStyle = br === 0 ? '#ffcf4a' : '#ff9de0'; g.lineWidth = Math.max(1.5, ts * 0.05); g.beginPath(); g.ellipse(cx, by - ts * 0.14, pw, pw * 0.5, 0, 0, TAU); g.stroke(); }
    const hy = by - ts * 0.2; // head anchor
    const col = d.color, acc = d.accent, dark = shade(col, -0.45);
    const p = pulse > 0 ? pulse : 0;
    switch (type) {
      case 'ballista': {
        g.save(); g.translate(cx, hy - ts * 0.05); g.rotate(aim);
        const L = ts * (0.34 + tier * 0.04);
        g.fillStyle = '#6b4526'; g.fillRect(-ts * 0.1, -ts * 0.07, L + ts * 0.06, ts * 0.14);
        g.strokeStyle = col; g.lineWidth = ts * 0.07; g.lineCap = 'round';
        g.beginPath(); g.moveTo(L * 0.55, -ts * 0.3); g.quadraticCurveTo(L * 0.85, 0, L * 0.55, ts * 0.3); g.stroke();
        g.strokeStyle = '#f3ead8'; g.lineWidth = Math.max(1, ts * 0.025);
        const pull = p > 0 ? 0 : ts * 0.08;
        g.beginPath(); g.moveTo(L * 0.55, -ts * 0.3); g.lineTo(L * 0.2 - pull, 0); g.lineTo(L * 0.55, ts * 0.3); g.stroke();
        if (br === 0 && tier === 2) { g.fillStyle = acc; g.fillRect(-ts * 0.16, -ts * 0.13, ts * 0.14, ts * 0.26); }
        if (br === 1 && tier === 2) { g.fillStyle = '#c9d2e4'; g.fillRect(L * 0.2, -ts * 0.025, L * 0.9, ts * 0.05); }
        g.lineCap = 'butt'; g.restore();
        break;
      }
      case 'brazier': {
        g.fillStyle = '#3a3440'; g.fillRect(cx - ts * 0.05, hy - ts * 0.08, ts * 0.1, ts * 0.12);
        g.fillStyle = br === 1 && tier === 2 ? '#2d4a6a' : '#4d3a33';
        g.beginPath(); g.moveTo(cx - ts * 0.3, hy - ts * 0.22); g.lineTo(cx + ts * 0.3, hy - ts * 0.22); g.lineTo(cx + ts * 0.18, hy - ts * 0.04); g.lineTo(cx - ts * 0.18, hy - ts * 0.04); g.closePath(); g.fill();
        g.fillStyle = '#8a6a50'; g.fillRect(cx - ts * 0.3, hy - ts * 0.25, ts * 0.6, ts * 0.05);
        const blue = br === 1 && tier === 2;
        const f1 = blue ? '#4fb8ff' : '#ff7a2a', f2 = blue ? '#c8f0ff' : '#ffd35a';
        const fl = 1 + p * 1.6;
        for (let k = 0; k < 3; k++) {
          const ph = t * 9 + k * 2.1, fx0 = cx + (k - 1) * ts * 0.12, hh = ts * (0.22 + 0.06 * Math.sin(ph) + tier * 0.04) * fl;
          g.fillStyle = f1; g.beginPath(); g.moveTo(fx0 - ts * 0.09, hy - ts * 0.24); g.quadraticCurveTo(fx0 + Math.sin(ph) * ts * 0.04, hy - ts * 0.24 - hh * 1.3, fx0 + ts * 0.09, hy - ts * 0.24); g.fill();
          g.fillStyle = f2; g.beginPath(); g.moveTo(fx0 - ts * 0.045, hy - ts * 0.24); g.quadraticCurveTo(fx0, hy - ts * 0.24 - hh * 0.7, fx0 + ts * 0.045, hy - ts * 0.24); g.fill();
        }
        break;
      }
      case 'frost': {
        g.fillStyle = '#4a5162'; g.fillRect(cx - ts * 0.24, hy - ts * 0.5, ts * 0.05, ts * 0.46); g.fillRect(cx + ts * 0.19, hy - ts * 0.5, ts * 0.05, ts * 0.46);
        g.fillRect(cx - ts * 0.26, hy - ts * 0.54, ts * 0.52, ts * 0.06);
        g.save(); g.translate(cx, hy - ts * 0.48); g.rotate(Math.sin(t * 2) * 0.05 + p * Math.sin(t * 30) * 0.4);
        g.fillStyle = br === 1 && tier === 2 ? '#bfe9ff' : col;
        g.beginPath(); g.moveTo(-ts * 0.08, ts * 0.04); g.quadraticCurveTo(-ts * 0.1, ts * 0.26, -ts * 0.18, ts * 0.34); g.lineTo(ts * 0.18, ts * 0.34); g.quadraticCurveTo(ts * 0.1, ts * 0.26, ts * 0.08, ts * 0.04); g.closePath(); g.fill();
        g.fillStyle = acc; g.fillRect(-ts * 0.05, ts * 0.06, ts * 0.04, ts * 0.22);
        g.fillStyle = '#e4fbff'; circle(g, 0, ts * 0.36, ts * 0.04); g.fill();
        g.restore();
        if (tier >= 1) { g.fillStyle = 'rgba(220,250,255,0.85)'; for (let k = 0; k < tier + 1; k++) { const a = t * 0.8 + k * 2.1; circle(g, cx + Math.cos(a) * ts * 0.3, hy - ts * 0.3 + Math.sin(a) * ts * 0.1, ts * 0.03); g.fill(); } }
        break;
      }
      case 'mortar': {
        g.save(); g.translate(cx, hy - ts * 0.06);
        const rec = p > 0 ? p * ts * 0.25 : 0;
        g.fillStyle = '#3c4250'; g.beginPath(); g.ellipse(0, 0, ts * 0.24, ts * 0.13, 0, 0, TAU); g.fill();
        g.rotate(Math.max(-0.6, Math.min(0.6, Math.cos(aim) * 0.5)));
        g.fillStyle = br === 1 && tier === 2 ? '#3a2c22' : col;
        rr(g, -ts * 0.14, -ts * 0.36 + rec, ts * 0.28, ts * 0.34, ts * 0.06); g.fill();
        g.fillStyle = dark; g.beginPath(); g.ellipse(0, -ts * 0.36 + rec, ts * 0.14, ts * 0.06, 0, 0, TAU); g.fill();
        g.fillStyle = '#16181e'; g.beginPath(); g.ellipse(0, -ts * 0.36 + rec, ts * 0.09, ts * 0.035, 0, 0, TAU); g.fill();
        g.fillStyle = acc; g.fillRect(-ts * 0.14, -ts * 0.2 + rec, ts * 0.28, ts * 0.04);
        if (br === 0 && tier === 2) { g.fillStyle = '#ffcf4a'; for (let k = -1; k <= 1; k++) { circle(g, k * ts * 0.08, -ts * 0.1 + rec, ts * 0.03); g.fill(); } }
        g.restore();
        break;
      }
      case 'lantern': {
        g.fillStyle = '#3a3440'; g.fillRect(cx - ts * 0.035, hy - ts * 0.6, ts * 0.07, ts * 0.58);
        g.fillRect(cx - ts * 0.035, hy - ts * 0.62, ts * 0.22, ts * 0.05);
        const lx = cx + ts * 0.15, ly = hy - ts * 0.5;
        g.strokeStyle = '#3a3440'; g.lineWidth = Math.max(1, ts * 0.025); g.beginPath(); g.moveTo(lx, hy - ts * 0.58); g.lineTo(lx, ly - ts * 0.08); g.stroke();
        const fl = 0.8 + 0.2 * Math.sin(t * 7 + cx);
        const lg = g.createRadialGradient(lx, ly + ts * 0.06, 0, lx, ly + ts * 0.06, ts * (0.32 + tier * 0.06));
        lg.addColorStop(0, 'rgba(255,240,170,' + 0.7 * fl + ')'); lg.addColorStop(1, 'rgba(255,230,140,0)');
        g.fillStyle = lg; g.fillRect(lx - ts * 0.5, ly - ts * 0.4, ts, ts);
        g.fillStyle = '#2b2630'; rr(g, lx - ts * 0.1, ly - ts * 0.08, ts * 0.2, ts * 0.26, ts * 0.04); g.fill();
        g.fillStyle = br === 1 && tier === 2 ? '#fff8d8' : col; rr(g, lx - ts * 0.07, ly - ts * 0.04, ts * 0.14, ts * 0.18, ts * 0.03); g.fill();
        if (br === 0 && tier === 2) { g.strokeStyle = '#ffcf4a'; g.lineWidth = Math.max(1, ts * 0.03); circle(g, lx, ly + ts * 0.05, ts * 0.17); g.stroke(); }
        break;
      }
      case 'tesla': {
        g.fillStyle = '#3e4658'; g.beginPath(); g.moveTo(cx - ts * 0.14, hy); g.lineTo(cx - ts * 0.07, hy - ts * 0.48); g.lineTo(cx + ts * 0.07, hy - ts * 0.48); g.lineTo(cx + ts * 0.14, hy); g.closePath(); g.fill();
        g.strokeStyle = '#c98f3a'; g.lineWidth = Math.max(1, ts * 0.035);
        for (let k = 0; k < 4; k++) { const yy = hy - ts * (0.08 + k * 0.1); g.beginPath(); g.moveTo(cx - ts * (0.13 - k * 0.015), yy); g.lineTo(cx + ts * (0.13 - k * 0.015), yy - ts * 0.04); g.stroke(); }
        const oy = hy - ts * 0.58, orr = ts * (0.13 + tier * 0.015);
        const og = g.createRadialGradient(cx, oy, 0, cx, oy, orr * 2.2);
        const ov = br === 1 && tier === 2 ? '198,164,255' : '160,210,255';
        og.addColorStop(0, 'rgba(' + ov + ',0.8)'); og.addColorStop(1, 'rgba(' + ov + ',0)');
        g.fillStyle = og; g.fillRect(cx - orr * 2.2, oy - orr * 2.2, orr * 4.4, orr * 4.4);
        g.fillStyle = br === 1 && tier === 2 ? '#d9c6ff' : '#dff0ff'; circle(g, cx, oy, orr); g.fill();
        if (Math.sin(t * 13 + cx) > 0.6 || p > 0) {
          g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, ts * 0.025); g.beginPath();
          let a = t * 7 + cx; g.moveTo(cx + Math.cos(a) * orr, oy + Math.sin(a) * orr);
          g.lineTo(cx + Math.cos(a + 0.3) * orr * 2, oy + Math.sin(a + 0.6) * orr * 2); g.lineTo(cx + Math.cos(a - 0.2) * orr * 2.7, oy + Math.sin(a) * orr * 2.6); g.stroke();
        }
        break;
      }
      case 'harpoon': {
        g.save(); g.translate(cx, hy - ts * 0.1); g.rotate(aim);
        g.fillStyle = '#2f4a48'; rr(g, -ts * 0.14, -ts * 0.12, ts * 0.28, ts * 0.24, ts * 0.06); g.fill();
        g.fillStyle = col; g.fillRect(0, -ts * 0.06, ts * (0.36 + tier * 0.04), ts * 0.12);
        if (p <= 0.05) {
          g.fillStyle = '#e8f6f2'; g.fillRect(ts * 0.1, -ts * 0.02, ts * 0.42, ts * 0.04);
          g.beginPath(); g.moveTo(ts * 0.52, -ts * 0.07); g.lineTo(ts * 0.62, 0); g.lineTo(ts * 0.52, ts * 0.07); g.closePath(); g.fill();
        }
        if (tier === 2) { g.fillStyle = br === 0 ? '#ffcf4a' : '#9a9a9a'; g.fillRect(-ts * 0.18, -ts * 0.16, ts * 0.08, ts * 0.32); }
        g.restore();
        break;
      }
      case 'shrine': {
        g.fillStyle = '#6b6680'; g.beginPath(); g.moveTo(cx - ts * 0.16, hy); g.lineTo(cx - ts * 0.1, hy - ts * 0.55); g.lineTo(cx, hy - ts * 0.68); g.lineTo(cx + ts * 0.1, hy - ts * 0.55); g.lineTo(cx + ts * 0.16, hy); g.closePath(); g.fill();
        g.fillStyle = '#8a84a2'; g.beginPath(); g.moveTo(cx - ts * 0.16, hy); g.lineTo(cx - ts * 0.1, hy - ts * 0.55); g.lineTo(cx, hy - ts * 0.68); g.lineTo(cx, hy); g.closePath(); g.fill();
        const glow = 0.6 + 0.4 * Math.sin(t * 2.5);
        const rc = tier === 2 ? (br === 0 ? '255,120,120' : '120,220,255') : '240,150,255';
        g.fillStyle = 'rgba(' + rc + ',' + glow + ')';
        g.fillRect(cx - ts * 0.03, hy - ts * 0.48, ts * 0.06, ts * 0.2); g.fillRect(cx - ts * 0.08, hy - ts * 0.4, ts * 0.16, ts * 0.05);
        g.fillStyle = 'rgba(' + rc + ',' + (0.5 * glow) + ')';
        for (let k = 0; k < 3; k++) { const a = t * 1.2 + k * 2.09; circle(g, cx + Math.cos(a) * ts * 0.28, hy - ts * 0.35 + Math.sin(a) * ts * 0.09, ts * 0.035); g.fill(); }
        break;
      }
    }
    // tier pips
    if (tier > 0) {
      g.fillStyle = tier === 2 ? '#ffcf4a' : '#e9eeff';
      for (let k = 0; k <= tier; k++) { circle(g, cx + (k - tier / 2) * ts * 0.11, by + ts * 0.02, ts * 0.035); g.fill(); }
    }
    if (flash > 0) { g.fillStyle = 'rgba(255,90,90,' + Math.min(0.5, flash * 4) + ')'; g.beginPath(); g.ellipse(cx, by - ts * 0.14, pw, pw * 0.5, 0, 0, TAU); g.fill(); }
  };

  // ---------------- enemies (sprites) ----------------
  // Draws enemy centred at 0,0 with body radius R. frame 0/1 for simple animation.
  Art.enemy = function (g, id, R, frame, white) {
    const def = TW.ENEMIES[id] || TW.BOSSES[id];
    const c = def.color, dk = shade(c, -0.45), lt = shade(c, 0.35);
    const eye = (x, y, r, col) => { g.fillStyle = col || '#fff6d0'; circle(g, x, y, r); g.fill(); };
    g.lineJoin = 'round';
    switch (id) {
      case 'shade': case 'wisp': {
        const wisp = id === 'wisp';
        g.fillStyle = wisp ? 'rgba(181,243,255,0.85)' : c;
        g.beginPath(); g.moveTo(-R, R * 0.5); g.quadraticCurveTo(-R * 1.05, -R * 1.1, 0, -R * 1.05); g.quadraticCurveTo(R * 1.05, -R * 1.1, R, R * 0.5);
        const w = frame ? 0.25 : -0.25;
        g.quadraticCurveTo(R * 0.6, R * (0.9 + w), R * 0.3, R * 0.6); g.quadraticCurveTo(0, R * (1.05 - w), -R * 0.3, R * 0.6); g.quadraticCurveTo(-R * 0.6, R * (0.9 + w), -R, R * 0.5);
        g.fill();
        g.fillStyle = wisp ? 'rgba(255,255,255,0.55)' : dk; g.beginPath(); g.ellipse(-R * 0.25, -R * 0.55, R * 0.35, R * 0.22, -0.5, 0, TAU); g.fill();
        eye(-R * 0.35, -R * 0.2, R * 0.17, wisp ? '#2a7a9a' : '#ffe27a'); eye(R * 0.35, -R * 0.2, R * 0.17, wisp ? '#2a7a9a' : '#ffe27a');
        break;
      }
      case 'skitter': case 'blobling': case 'blob': {
        if (id === 'skitter') {
          g.strokeStyle = dk; g.lineWidth = R * 0.22; g.lineCap = 'round';
          for (let k = 0; k < 3; k++) { const yy = (k - 1) * R * 0.45, f = (frame ^ (k & 1)) ? 0.3 : -0.3; g.beginPath(); g.moveTo(-R * 0.4, yy); g.lineTo(-R * 1.25, yy + R * f); g.moveTo(R * 0.4, yy); g.lineTo(R * 1.25, yy - R * f); g.stroke(); }
          g.lineCap = 'butt';
          g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, R * 0.8, R * 0.9, 0, 0, TAU); g.fill();
          g.fillStyle = lt; g.beginPath(); g.ellipse(-R * 0.2, -R * 0.35, R * 0.3, R * 0.2, 0, 0, TAU); g.fill();
          eye(-R * 0.28, -R * 0.15, R * 0.18, '#2a0a20'); eye(R * 0.28, -R * 0.15, R * 0.18, '#2a0a20');
          eye(-R * 0.24, -R * 0.2, R * 0.07); eye(R * 0.32, -R * 0.2, R * 0.07);
        } else {
          const sq = frame ? 1.08 : 0.94;
          g.fillStyle = c; g.beginPath(); g.ellipse(0, R * 0.1, R * sq, R / sq * 0.92, 0, 0, TAU); g.fill();
          g.fillStyle = dk; g.beginPath(); g.ellipse(0, R * 0.65, R * 0.75 * sq, R * 0.22, 0, 0, TAU); g.fill();
          g.fillStyle = lt; g.beginPath(); g.ellipse(-R * 0.35, -R * 0.35, R * 0.28, R * 0.18, -0.5, 0, TAU); g.fill();
          if (id === 'blob') { g.fillStyle = 'rgba(255,255,255,0.35)'; circle(g, R * 0.3, R * 0.25, R * 0.14); g.fill(); circle(g, -R * 0.1, R * 0.4, R * 0.09); g.fill(); }
          eye(-R * 0.3, -R * 0.05, R * 0.15, '#103a18'); eye(R * 0.3, -R * 0.05, R * 0.15, '#103a18');
        }
        break;
      }
      case 'crab': case 'crabking': {
        g.strokeStyle = dk; g.lineWidth = R * 0.16; g.lineCap = 'round';
        for (let k = 0; k < 3; k++) { const f = (frame ^ (k & 1)) ? 0.15 : -0.15; g.beginPath(); g.moveTo(-R * 0.6, R * (0.1 + k * 0.2)); g.lineTo(-R * 1.15, R * (0.35 + k * 0.25 + f)); g.moveTo(R * 0.6, R * (0.1 + k * 0.2)); g.lineTo(R * 1.15, R * (0.35 + k * 0.25 - f)); g.stroke(); }
        g.lineCap = 'butt';
        // claws
        g.fillStyle = c;
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.95, -R * 0.55, R * 0.32, R * 0.24, s * 0.6, 0, TAU); g.fill(); g.fillStyle = dk; g.beginPath(); g.moveTo(s * R * 1.0, -R * 0.62); g.lineTo(s * R * 1.3, -R * 0.75); g.lineTo(s * R * 1.1, -R * 0.5); g.fill(); g.fillStyle = c; }
        g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, R * 0.92, R * 0.7, 0, 0, TAU); g.fill();
        g.fillStyle = dk; g.beginPath(); g.ellipse(0, R * 0.15, R * 0.8, R * 0.45, 0, 0, Math.PI); g.fill();
        g.strokeStyle = lt; g.lineWidth = R * 0.08;
        g.beginPath(); g.arc(0, R * 0.2, R * 0.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        g.beginPath(); g.arc(0, R * 0.35, R * 0.35, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
        eye(-R * 0.25, -R * 0.62, R * 0.13, '#fff'); eye(R * 0.25, -R * 0.62, R * 0.13, '#fff');
        eye(-R * 0.25, -R * 0.62, R * 0.06, '#1a0a00'); eye(R * 0.25, -R * 0.62, R * 0.06, '#1a0a00');
        if (id === 'crabking') {
          g.fillStyle = '#ffcf4a'; g.beginPath(); g.moveTo(-R * 0.4, -R * 0.55); g.lineTo(-R * 0.45, -R * 0.95); g.lineTo(-R * 0.2, -R * 0.75); g.lineTo(0, -R * 1.05); g.lineTo(R * 0.2, -R * 0.75); g.lineTo(R * 0.45, -R * 0.95); g.lineTo(R * 0.4, -R * 0.55); g.closePath(); g.fill();
        }
        break;
      }
      case 'gull': case 'harpy': {
        const up = frame ? -0.55 : 0.25;
        g.fillStyle = id === 'harpy' ? '#cfd8ff' : c;
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * R * 0.2, -R * 0.1); g.quadraticCurveTo(s * R * 1.0, R * up - R * 0.5, s * R * 1.5, R * up); g.quadraticCurveTo(s * R * 0.9, R * 0.2, s * R * 0.2, R * 0.25); g.fill(); }
        g.fillStyle = id === 'harpy' ? '#8e9cd8' : '#7d86a8';
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * R * 1.1, R * up * 0.8); g.lineTo(s * R * 1.5, R * up); g.lineTo(s * R * 1.2, R * up + R * 0.2); g.fill(); }
        g.fillStyle = id === 'harpy' ? '#eef2ff' : '#e9edff'; g.beginPath(); g.ellipse(0, 0, R * 0.38, R * 0.62, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(-R * 0.1, -R * 0.45); g.lineTo(0, -R * 0.78); g.lineTo(R * 0.1, -R * 0.45); g.fill();
        eye(-R * 0.14, -R * 0.35, R * 0.08, '#ff3d6e'); eye(R * 0.14, -R * 0.35, R * 0.08, '#ff3d6e');
        if (id === 'harpy') { g.fillStyle = '#7a5cff'; g.beginPath(); g.moveTo(-R * 0.3, -R * 0.55); g.lineTo(-R * 0.1, -R * 0.95); g.lineTo(0, -R * 0.6); g.lineTo(R * 0.1, -R * 0.95); g.lineTo(R * 0.3, -R * 0.55); g.fill(); }
        break;
      }
      case 'ram': {
        g.fillStyle = dk; g.fillRect(-R * 0.6, R * 0.4, R * 0.3, R * 0.5 + (frame ? R * 0.1 : 0)); g.fillRect(R * 0.3, R * 0.4, R * 0.3, R * 0.5 + (frame ? 0 : R * 0.1));
        g.fillStyle = c; g.beginPath(); g.ellipse(0, R * 0.1, R * 0.95, R * 0.72, 0, 0, TAU); g.fill();
        g.fillStyle = '#f2e6d0'; g.beginPath(); g.ellipse(0, -R * 0.1, R * 0.7, R * 0.45, 0, 0, TAU); g.fill();
        g.fillStyle = '#5a4030'; g.beginPath(); g.ellipse(0, -R * 0.35, R * 0.38, R * 0.36, 0, 0, TAU); g.fill();
        g.strokeStyle = '#e8d8b0'; g.lineWidth = R * 0.22; g.lineCap = 'round';
        for (const s of [-1, 1]) { g.beginPath(); g.arc(s * R * 0.42, -R * 0.55, R * 0.3, s > 0 ? -Math.PI * 0.9 : -Math.PI * 0.1, s > 0 ? Math.PI * 0.5 : Math.PI * 0.5 + Math.PI * 0.0, s < 0); g.stroke(); }
        g.lineCap = 'butt';
        eye(-R * 0.15, -R * 0.4, R * 0.08, '#ff5a2a'); eye(R * 0.15, -R * 0.4, R * 0.08, '#ff5a2a');
        break;
      }
      case 'mender': {
        g.strokeStyle = 'rgba(125,255,216,0.7)'; g.lineWidth = R * 0.12; g.lineCap = 'round';
        for (let k = 0; k < 4; k++) { const xx = (k - 1.5) * R * 0.35, f = (frame ^ (k & 1)) ? 0.2 : -0.2; g.beginPath(); g.moveTo(xx, R * 0.2); g.quadraticCurveTo(xx + R * f, R * 0.7, xx, R * 1.1); g.stroke(); }
        g.lineCap = 'butt';
        g.fillStyle = 'rgba(125,255,216,0.9)'; g.beginPath(); g.arc(0, R * 0.2, R * 0.85, Math.PI, 0); g.quadraticCurveTo(0, R * 0.45, -R * 0.85, R * 0.2); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(-R * 0.08, -R * 0.4, R * 0.16, R * 0.5); g.fillRect(-R * 0.25, -R * 0.23, R * 0.5, R * 0.16);
        eye(-R * 0.45, -R * 0.05, R * 0.09, '#0a4a3a'); eye(R * 0.45, -R * 0.05, R * 0.09, '#0a4a3a');
        break;
      }
      case 'mole': {
        g.fillStyle = dk; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.8, R * 0.1 + (frame ? s : -s) * R * 0.1, R * 0.32, R * 0.2, s * 0.5, 0, TAU); g.fill(); }
        g.fillStyle = '#f0d8c0'; for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) { g.fillRect(s * R * (1.0 + k * 0.05) - R * 0.04, R * (0.0 + k * 0.1), R * 0.08, R * 0.2); } }
        g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, R * 0.78, R * 0.9, 0, 0, TAU); g.fill();
        g.fillStyle = lt; g.beginPath(); g.ellipse(0, -R * 0.55, R * 0.35, R * 0.28, 0, 0, TAU); g.fill();
        g.fillStyle = '#ff9db0'; circle(g, 0, -R * 0.78, R * 0.13); g.fill();
        eye(-R * 0.25, -R * 0.45, R * 0.07, '#1a0a00'); eye(R * 0.25, -R * 0.45, R * 0.07, '#1a0a00');
        break;
      }
      case 'warden': {
        g.fillStyle = dk; g.fillRect(-R * 0.5, R * 0.45, R * 0.3, R * 0.45); g.fillRect(R * 0.2, R * 0.45, R * 0.3, R * 0.45);
        g.fillStyle = c; rr(g, -R * 0.7, -R * 0.6, R * 1.4, R * 1.2, R * 0.35); g.fill();
        g.fillStyle = '#d8e6ff'; rr(g, -R * 0.55, -R * 0.95, R * 1.1, R * 0.6, R * 0.25); g.fill();
        g.fillStyle = '#1a2a4a'; g.fillRect(-R * 0.4, -R * 0.72, R * 0.8, R * 0.14);
        eye(-R * 0.18, -R * 0.65, R * 0.07, '#7af0ff'); eye(R * 0.18, -R * 0.65, R * 0.07, '#7af0ff');
        g.fillStyle = '#c9a24a'; g.beginPath(); g.moveTo(R * 0.25, -R * 0.2); g.lineTo(R * 1.05, -R * 0.2); g.lineTo(R * 1.05, R * 0.35); g.lineTo(R * 0.65, R * 0.7); g.lineTo(R * 0.25, R * 0.35); g.closePath(); g.fill();
        break;
      }
      case 'brute': case 'colossus': {
        const col = id === 'colossus';
        g.fillStyle = dk; g.fillRect(-R * 0.55, R * 0.4, R * 0.35, R * 0.55 + (frame ? R * 0.08 : 0)); g.fillRect(R * 0.2, R * 0.4, R * 0.35, R * 0.55 + (frame ? 0 : R * 0.08));
        g.fillStyle = c;
        g.beginPath(); g.ellipse(-R * 0.95, R * 0.05 + (frame ? R * 0.08 : 0), R * 0.28, R * 0.45, 0.3, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(R * 0.95, R * 0.05 + (frame ? 0 : R * 0.08), R * 0.28, R * 0.45, -0.3, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(0, 0, R * 0.85, R * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = lt; g.beginPath(); g.ellipse(-R * 0.25, -R * 0.35, R * 0.35, R * 0.22, -0.4, 0, TAU); g.fill();
        if (col) { g.fillStyle = '#2a7a66'; for (let k = 0; k < 4; k++) { circle(g, -R * 0.5 + k * R * 0.33, R * 0.3, R * 0.1); g.fill(); } g.fillStyle = '#8a9a7a'; g.fillRect(-R * 0.6, -R * 0.1, R * 1.2, R * 0.12); }
        eye(-R * 0.25, -R * 0.15, R * 0.12, col ? '#b8ffe8' : '#ffcf4a'); eye(R * 0.25, -R * 0.15, R * 0.12, col ? '#b8ffe8' : '#ffcf4a');
        g.fillStyle = '#f4f0e0'; g.beginPath(); g.moveTo(-R * 0.3, R * 0.2); g.lineTo(-R * 0.22, R * 0.02); g.lineTo(-R * 0.14, R * 0.2); g.fill(); g.beginPath(); g.moveTo(R * 0.14, R * 0.2); g.lineTo(R * 0.22, R * 0.02); g.lineTo(R * 0.3, R * 0.2); g.fill();
        break;
      }
      case 'eye': {
        g.strokeStyle = '#5a1030'; g.lineWidth = R * 0.18; g.lineCap = 'round';
        for (let k = 0; k < 6; k++) { const a = Math.PI * (0.15 + k * 0.14), f = (frame ^ (k & 1)) ? 0.2 : -0.2; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7); g.quadraticCurveTo(Math.cos(a + f) * R * 1.2, Math.sin(a + f) * R * 1.2, Math.cos(a) * R * 1.45, Math.sin(a) * R * 1.4); g.stroke(); }
        g.lineCap = 'butt';
        g.fillStyle = '#3a0a22'; circle(g, 0, 0, R); g.fill();
        g.fillStyle = '#f8e8ee'; g.beginPath(); g.ellipse(0, -R * 0.05, R * 0.8, R * 0.6, 0, 0, TAU); g.fill();
        g.fillStyle = c; circle(g, 0, -R * 0.05, R * 0.42); g.fill();
        g.fillStyle = '#12020a'; g.beginPath(); g.ellipse(0, -R * 0.05, R * 0.12, R * 0.34, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff'; circle(g, -R * 0.15, -R * 0.22, R * 0.08); g.fill();
        break;
      }
    }
    if (white) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-R * 2, -R * 2, R * 4, R * 4); g.globalCompositeOperation = 'source-over'; }
  };

  // Sprite cache: canvases per enemy id / frame / flash, rebuilt when tile size changes.
  const spriteCache = {};
  let spriteTs = 0;
  Art.sprite = function (id, ts, frame, white) {
    if (ts !== spriteTs) { for (const k in spriteCache) delete spriteCache[k]; spriteTs = ts; }
    const key = id + frame + (white ? 'w' : '');
    let c = spriteCache[key];
    if (!c) {
      const def = TW.ENEMIES[id] || TW.BOSSES[id];
      const R = def.r * ts;
      const size = Math.ceil(R * 3.4);
      c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d');
      g.translate(size / 2, size / 2);
      Art.enemy(g, id, R, frame, white);
      c.half = size / 2;
      spriteCache[key] = c;
    }
    return c;
  };

  // ---------------- UI icons ----------------
  Art.iconCanvas = function (kind, id, css, opts) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(css * dpr);
    c.style.width = c.style.height = css + 'px';
    const g = c.getContext('2d');
    g.scale(dpr * css / 64, dpr * css / 64);
    Art.icon(g, kind, id, opts || {});
    return c;
  };
  Art.icon = function (g, kind, id, o) {
    if (kind === 'tower') { Art.tower(g, id, o.tier || 0, o.br === undefined ? -1 : o.br, 32, 34, 52, 0.5, -0.5, 0, 0); return; }
    if (kind === 'enemy') { g.translate(32, 32); const def = TW.ENEMIES[id] || TW.BOSSES[id]; Art.enemy(g, id, def.boss ? 17 : 15, 0, false); return; }
    if (kind === 'wall') { Art.wall(g, 6, 8, 52, !!o.stone, 3, 0, 1); return; }
    if (kind === 'harv') { Art.harvester(g, 32, 32, 52, 0, 'w'); return; }
    if (kind === 'core') { Art.lighthouse(g, 32, 44, 34, 0, true, 1); return; }
    if (kind === 'res') { Art.resIcon(g, id, 32, 32, 26); return; }
    if (kind === 'cmd') { Art.portrait(g, id); return; }
    if (kind === 'boon') { Art.boonIcon(g, id); return; }
  };
  Art.resIcon = function (g, id, x, y, r) {
    if (id === 'g') {
      g.fillStyle = '#b8860b'; circle(g, x, y + r * 0.08, r * 0.8); g.fill();
      g.fillStyle = '#ffcf4a'; circle(g, x, y, r * 0.8); g.fill();
      g.fillStyle = '#fff1a8'; circle(g, x - r * 0.25, y - r * 0.25, r * 0.22); g.fill();
      g.strokeStyle = '#b8860b'; g.lineWidth = r * 0.12; circle(g, x, y, r * 0.5); g.stroke();
    } else if (id === 'w') {
      g.save(); g.translate(x, y); g.rotate(-0.4);
      g.fillStyle = '#8a5a30'; rr(g, -r * 0.85, -r * 0.35, r * 1.6, r * 0.7, r * 0.3); g.fill();
      g.fillStyle = '#e6b271'; g.beginPath(); g.ellipse(r * 0.75, 0, r * 0.22, r * 0.35, 0, 0, TAU); g.fill();
      g.strokeStyle = '#a06c3c'; g.lineWidth = r * 0.08; g.beginPath(); g.ellipse(r * 0.75, 0, r * 0.1, r * 0.17, 0, 0, TAU); g.stroke();
      g.restore();
    } else if (id === 's') {
      g.fillStyle = '#6f7a90'; g.beginPath(); g.moveTo(x - r * 0.8, y + r * 0.5); g.lineTo(x - r * 0.5, y - r * 0.5); g.lineTo(x + r * 0.3, y - r * 0.7); g.lineTo(x + r * 0.85, y + r * 0.1); g.lineTo(x + r * 0.5, y + r * 0.6); g.closePath(); g.fill();
      g.fillStyle = '#b8c2d6'; g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.5); g.lineTo(x + r * 0.3, y - r * 0.7); g.lineTo(x + r * 0.2, y); g.lineTo(x - r * 0.4, y + r * 0.1); g.closePath(); g.fill();
    } else if (id === 'c') {
      g.fillStyle = '#7a6af0'; g.beginPath(); g.moveTo(x, y - r * 0.9); g.lineTo(x + r * 0.5, y - r * 0.2); g.lineTo(x, y + r * 0.9); g.lineTo(x - r * 0.5, y - r * 0.2); g.closePath(); g.fill();
      g.fillStyle = '#c9c0ff'; g.beginPath(); g.moveTo(x, y - r * 0.9); g.lineTo(x + r * 0.5, y - r * 0.2); g.lineTo(x, y); g.closePath(); g.fill();
    } else if (id === 'hp') {
      g.fillStyle = '#ff5d73'; g.beginPath(); g.moveTo(x, y + r * 0.8); g.bezierCurveTo(x - r * 1.2, y, x - r * 0.6, y - r * 0.9, x, y - r * 0.35); g.bezierCurveTo(x + r * 0.6, y - r * 0.9, x + r * 1.2, y, x, y + r * 0.8); g.fill();
    } else if (id === 'tap') {
      g.fillStyle = '#ffe2b0'; rr(g, x - r * 0.3, y - r * 0.8, r * 0.36, r * 1.0, r * 0.18); g.fill();
      rr(g, x - r * 0.6, y - r * 0.1, r * 1.2, r * 0.9, r * 0.3); g.fill();
    } else if (id === 'pearl') {
      const pg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 0.8);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.6, '#f0e6ff'); pg.addColorStop(1, '#b8a8d8');
      g.fillStyle = pg; circle(g, x, y, r * 0.75); g.fill();
    }
  };
  Art.portrait = function (g, id) {
    const cm = TW.COMMANDERS.find((c) => c.id === id) || TW.COMMANDERS[0];
    const bg = g.createRadialGradient(32, 28, 4, 32, 32, 34);
    bg.addColorStop(0, shade(cm.color, -0.2)); bg.addColorStop(1, '#0b1026');
    g.fillStyle = bg; circle(g, 32, 32, 31); g.fill();
    g.fillStyle = shade(cm.color, -0.1); g.beginPath(); g.ellipse(32, 62, 22, 16, 0, 0, TAU); g.fill();
    g.fillStyle = '#f2c9a0'; circle(g, 32, 32, 13); g.fill();
    g.fillStyle = '#2a1a10'; circle(g, 27, 32, 1.8); g.fill(); circle(g, 37, 32, 1.8); g.fill();
    g.strokeStyle = '#8a4a30'; g.lineWidth = 1.5; g.beginPath(); g.arc(32, 36, 4, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = cm.color;
    if (id === 'mara') { g.beginPath(); g.ellipse(32, 22, 16, 6, 0, 0, TAU); g.fill(); g.fillRect(24, 12, 16, 10); }
    else if (id === 'bram') { g.fillStyle = '#7a5a40'; g.beginPath(); g.ellipse(32, 44, 12, 7, 0, 0, Math.PI); g.fill(); g.fillStyle = cm.color; rr(g, 19, 16, 26, 9, 4); g.fill(); }
    else if (id === 'rook') { g.beginPath(); g.moveTo(14, 24); g.lineTo(32, 10); g.lineTo(50, 24); g.closePath(); g.fill(); g.fillStyle = '#2a1a10'; g.fillRect(34, 29, 7, 5); }
    else if (id === 'ilse') { g.beginPath(); g.moveTo(16, 30); g.quadraticCurveTo(32, -4, 48, 30); g.lineTo(44, 24); g.quadraticCurveTo(32, 14, 20, 24); g.closePath(); g.fill(); g.fillStyle = '#e4ddff'; circle(g, 32, 17, 3); g.fill(); }
    else if (id === 'nell') { g.fillStyle = '#5a3a22'; g.beginPath(); g.ellipse(32, 23, 20, 5, 0, 0, TAU); g.fill(); g.fillStyle = cm.color; rr(g, 23, 10, 18, 13, 5); g.fill(); }
  };
  Art.boonIcon = function (g, id) {
    const b = TW.BOONS.find((x) => x.id === id);
    if (!b) return;
    const tag = b.tag;
    const towerTag = { Ballista: 'ballista', Brazier: 'brazier', Mortar: 'mortar', Frost: 'frost', Tesla: 'tesla', Harpoon: 'harpoon', Lantern: 'lantern' }[tag];
    if (towerTag) { Art.tower(g, towerTag, 1, -1, 32, 34, 50, 0.5, -0.5, 0, 0); return; }
    if (tag === 'Walls') { Art.wall(g, 8, 10, 48, id !== 'timber', 3, 0, 1); return; }
    if (tag === 'Gold' || tag === 'Economy') { Art.resIcon(g, 'g', 32, 32, 22); return; }
    if (tag === 'Wood') { Art.resIcon(g, 'w', 32, 32, 22); return; }
    if (tag === 'Stone') { Art.resIcon(g, 's', 32, 32, 22); return; }
    if (tag === 'Harvest') { Art.harvester(g, 32, 34, 48, 0, 'w'); if (id === 'vein') Art.resIcon(g, 'c', 48, 18, 12); return; }
    if (tag === 'Gather') { Art.resIcon(g, 'tap', 32, 34, 24); return; }
    if (tag === 'Lighthouse') { Art.lighthouse(g, 32, 46, 34, 0, true, 1); return; }
    // generic towers
    g.fillStyle = '#ffcf4a';
    g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 9 : 22; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill();
  };
})(window.TW = window.TW || {});
