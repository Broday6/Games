'use strict';
// NIGHT TIDE — procedural art: pre-rendered sprites, icons and the castaway blob.
(function (NT) {
  const TAU = Math.PI * 2;
  const Art = NT.Art = { res: 0 };

  function sprite(ww, wh, res, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(ww * res));
    c.height = Math.max(2, Math.ceil(wh * res));
    const g = c.getContext('2d');
    g.scale(c.width / ww, c.height / wh);
    g.translate(ww / 2, wh / 2);
    g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g);
    c.ww = ww; c.wh = wh;
    return c;
  }
  Art.sprite = sprite;

  function shade(hex, f) { // lighten (f>0) / darken (f<0)
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
    if (f > 0) { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; } else { r *= 1 + f; gg *= 1 + f; b *= 1 + f; }
    return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
  }
  Art.shade = shade;

  // ---------- enemy shapes ----------
  function pathShape(g, shape, r) {
    g.beginPath();
    switch (shape) {
      case 'ghost': {
        const by = r * 0.72;
        g.arc(0, -r * 0.12, r, Math.PI, 0);
        g.lineTo(r, by);
        const w = (2 * r) / 4;
        for (let k = 0; k < 4; k++) {
          g.quadraticCurveTo(r - (k + 0.5) * w, by + (k % 2 ? -0.05 : 0.45) * r, r - (k + 1) * w, by);
        }
        g.closePath();
        break;
      }
      case 'crab':
        g.ellipse(0, 0, r, r * 0.74, 0, 0, TAU);
        g.moveTo(-r * 0.55 + r * 0.32, -r * 0.82); g.arc(-r * 0.55, -r * 0.82, r * 0.32, 0, TAU);
        g.moveTo(r * 0.55 + r * 0.32, -r * 0.82); g.arc(r * 0.55, -r * 0.82, r * 0.32, 0, TAU);
        break;
      case 'brute':
        g.moveTo(-r * 0.7, -r * 0.55); g.lineTo(-r * 0.95, -r * 1.25); g.lineTo(-r * 0.25, -r * 0.88);
        g.lineTo(r * 0.25, -r * 0.88); g.lineTo(r * 0.95, -r * 1.25); g.lineTo(r * 0.7, -r * 0.55);
        g.arc(0, 0, r, -0.3, Math.PI + 0.3);
        g.closePath();
        break;
      case 'urchin': {
        const n = 26;
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * TAU, rr = i % 2 ? r * 0.7 : r * 1.05;
          if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
        break;
      }
      case 'bubble':
        g.arc(0, r * 0.1, r * 0.82, 0, TAU);
        g.moveTo(-r * 0.45 + r * 0.5, -r * 0.45); g.arc(-r * 0.45, -r * 0.45, r * 0.5, 0, TAU);
        g.moveTo(r * 0.5 + r * 0.45, -r * 0.4); g.arc(r * 0.5, -r * 0.4, r * 0.45, 0, TAU);
        break;
      case 'mini':
        g.arc(0, 0, r, 0, TAU);
        break;
      case 'jelly':
        g.arc(0, 0, r, Math.PI, 0);
        g.quadraticCurveTo(r * 0.9, r * 0.38, r * 0.6, r * 0.32);
        g.lineTo(-r * 0.6, r * 0.32);
        g.quadraticCurveTo(-r * 0.9, r * 0.38, -r, 0);
        g.closePath();
        break;
      case 'bosscrab':
        g.ellipse(0, r * 0.1, r, r * 0.68, 0, 0, TAU);
        // claws
        g.moveTo(-r * 0.62 + r * 0.42, -r * 0.78); g.arc(-r * 0.62, -r * 0.78, r * 0.42, 0, TAU);
        g.moveTo(r * 0.62 + r * 0.42, -r * 0.78); g.arc(r * 0.62, -r * 0.78, r * 0.42, 0, TAU);
        break;
      case 'angler':
        g.arc(0, 0, r, 0, TAU);
        g.moveTo(r * 0.8, r * 0.2); g.lineTo(r * 1.15, -r * 0.35); g.lineTo(r * 1.15, r * 0.65); g.closePath();
        break;
      case 'king': {
        g.arc(0, 0, r, Math.PI * 0.95, Math.PI * 0.05, false);
        const w = (2 * r) / 5, by = r * 0.3;
        g.lineTo(r, by);
        for (let k = 0; k < 5; k++) g.quadraticCurveTo(r - (k + 0.5) * w, by + (k % 2 ? 0 : 0.75) * r, r - (k + 1) * w, by);
        g.closePath();
        break;
      }
    }
  }

  function drawEnemy(g, d, flash) {
    const r = d.r, shape = d.shape;
    if (!flash) {
      g.fillStyle = 'rgba(0,0,0,0.32)';
      g.beginPath(); g.ellipse(0, r * 0.95, r * 0.85, r * 0.28, 0, 0, TAU); g.fill();
    }
    // extra strokes under body
    g.strokeStyle = flash ? '#fff' : d.rim; g.lineWidth = Math.max(1.4, r * 0.12);
    if (shape === 'crab' || shape === 'bosscrab') {
      g.beginPath();
      for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 3; i++) {
        const y = -r * 0.1 + i * r * 0.32;
        g.moveTo(s * r * 0.7, y); g.lineTo(s * r * 1.25, y + r * 0.25); g.lineTo(s * r * 1.4, y + r * 0.55);
      }
      g.stroke();
    }
    if (shape === 'jelly') {
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const x = -r * 0.45 + i * r * 0.3;
        g.moveTo(x, r * 0.3); g.quadraticCurveTo(x + r * 0.2, r * 0.75, x - r * 0.05, r * 1.15);
      }
      g.stroke();
    }
    if (shape === 'angler') { // lure stalk
      g.beginPath(); g.moveTo(0, -r * 0.85); g.quadraticCurveTo(r * 0.3, -r * 1.7, r * 0.95, -r * 1.35); g.stroke();
    }
    pathShape(g, shape, r);
    if (flash) { g.fillStyle = '#ffffff'; g.fill(); return; }
    const grd = g.createRadialGradient(-r * 0.25, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
    grd.addColorStop(0, shade(d.body, 0.42)); grd.addColorStop(0.6, shade(d.body, 0.1)); grd.addColorStop(1, shade(d.body, -0.3));
    g.fillStyle = grd; g.fill();
    g.strokeStyle = d.rim; g.lineWidth = Math.max(1.5, r * 0.11); g.stroke();
    // details
    if (shape === 'bubble') {
      g.fillStyle = shade(d.rim, 0.2); g.globalAlpha = 0.35;
      g.beginPath(); g.arc(-r * 0.25, r * 0.35, r * 0.18, 0, TAU); g.arc(r * 0.3, r * 0.25, r * 0.12, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    if (shape === 'brute' || shape === 'bosscrab' || shape === 'king' || shape === 'angler') {
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = r * 0.06;
      g.beginPath(); g.moveTo(-r * 0.4, r * 0.45); g.quadraticCurveTo(0, r * 0.62, r * 0.4, r * 0.45); g.stroke();
    }
    if (shape === 'bosscrab') {
      g.fillStyle = shade(d.body, -0.5);
      for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.moveTo(s * r * 0.62, -r * 0.78); g.lineTo(s * r * 0.4, -r * 1.25); g.lineTo(s * r * 0.85, -r * 1.25); g.closePath(); g.fill(); }
    }
    if (shape === 'angler') {
      g.fillStyle = '#e8f6ff';
      g.beginPath();
      for (let i = 0; i < 6; i++) { const x = -r * 0.55 + i * r * 0.22; g.moveTo(x, r * 0.32); g.lineTo(x + r * 0.11, r * 0.55); g.lineTo(x + r * 0.22, r * 0.32); }
      g.fill();
      g.fillStyle = 'rgba(160,255,250,0.35)'; g.beginPath(); g.arc(r * 0.95, -r * 1.35, r * 0.4, 0, TAU); g.fill();
      g.fillStyle = '#d8fffb'; g.beginPath(); g.arc(r * 0.95, -r * 1.35, r * 0.17, 0, TAU); g.fill();
    }
    if (shape === 'king') {
      g.fillStyle = '#ffcf4a'; g.strokeStyle = '#7a4a10'; g.lineWidth = r * 0.04;
      g.beginPath(); g.moveTo(-r * 0.55, -r * 0.78);
      const pts = [-0.55, -0.4, -0.28, 0, 0.28, 0.4, 0.55];
      for (let i = 0; i < pts.length; i++) g.lineTo(pts[i] * r, (i % 2 ? -1.35 : -0.88) * r - (i === 3 ? r * 0.2 : 0));
      g.lineTo(r * 0.55, -r * 0.7); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff5d8f'; g.beginPath(); g.arc(0, -r * 0.95, r * 0.09, 0, TAU); g.fill();
    }
  }

  function glowSprite(rgb, a) {
    return sprite(2, 2, 64, (g) => {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      grd.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
      grd.addColorStop(0.45, 'rgba(' + rgb + ',' + a * 0.45 + ')');
      grd.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = grd; g.fillRect(-1, -1, 2, 2);
    });
  }

  function gemSprite(r, col, hi) {
    return sprite(r * 5, r * 5, Art.res, (g) => {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      grd.addColorStop(0, col.replace('rgb', 'rgba').replace(')', ',0.45)'));
      grd.addColorStop(1, col.replace('rgb', 'rgba').replace(')', ',0)'));
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r * 2.4, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(0, -r * 1.3); g.lineTo(r * 0.85, 0); g.lineTo(0, r * 1.3); g.lineTo(-r * 0.85, 0); g.closePath();
      g.fillStyle = col; g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 0.8; g.stroke();
      g.beginPath(); g.moveTo(0, -r * 1.3); g.lineTo(r * 0.85, 0); g.lineTo(0, 0); g.closePath();
      g.fillStyle = hi; g.fill();
    });
  }

  function shellSprite(g, r, col) {
    // spiral seashell (cone)
    g.fillStyle = col; g.strokeStyle = '#5a3b2a'; g.lineWidth = r * 0.12;
    g.beginPath(); g.moveTo(-r, r * 0.45); g.quadraticCurveTo(-r * 0.2, -r * 1.2, r, -r * 0.1);
    g.quadraticCurveTo(r * 0.6, r * 0.9, -r, r * 0.45); g.closePath(); g.fill(); g.stroke();
    g.beginPath();
    for (let i = 0; i < 3; i++) { const t = 0.25 + i * 0.22; g.moveTo(-r + 2 * r * t, r * (0.45 - t * 0.9)); g.lineTo(-r + 2 * r * t + r * 0.2, r * (0.45 - t * 0.2)); }
    g.stroke();
  }

  Art.build = function (res) {
    res = Math.min(4, Math.max(1, res));
    if (Math.abs(res - Art.res) < 0.01) return;
    Art.res = res;
    const ET = NT.ET;
    Art.eSpr = []; Art.eFlash = [];
    for (let i = 0; i < ET.length; i++) {
      const d = ET[i], s = d.r * 3.2;
      Art.eSpr.push(sprite(s, s, res, (g) => drawEnemy(g, d, false)));
      Art.eFlash.push(sprite(s, s, res, (g) => drawEnemy(g, d, true)));
    }
    Art.glowGold = glowSprite('255,196,80', 0.7);
    Art.glowWarm = glowSprite('255,180,90', 0.55);
    Art.glowCyan = glowSprite('92,225,230', 0.6);
    Art.glowRed = glowSprite('255,70,110', 0.6);
    Art.glowWhite = glowSprite('255,255,255', 0.8);
    Art.gems = [gemSprite(3.6, 'rgb(92,200,255)', 'rgba(220,245,255,0.85)'),
      gemSprite(4.6, 'rgb(109,255,154)', 'rgba(230,255,235,0.85)'),
      gemSprite(5.8, 'rgb(255,93,143)', 'rgba(255,225,235,0.85)')];
    Art.boom = sprite(34, 34, res, (g) => {
      g.strokeStyle = '#3b2414'; g.lineWidth = 7.5;
      g.beginPath(); g.arc(0, 4, 12, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.strokeStyle = '#d9a46c'; g.lineWidth = 5;
      g.beginPath(); g.arc(0, 4, 12, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.strokeStyle = '#f2cf9b'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 4, 13, Math.PI * 1.15, Math.PI * 1.6); g.stroke();
    });
    Art.kraken = sprite(34, 34, res, (g) => {
      g.strokeStyle = '#1b0f30'; g.lineWidth = 8;
      g.beginPath(); g.arc(0, 4, 12, Math.PI * 1.0, Math.PI * 2.0); g.stroke();
      g.strokeStyle = '#b07cff'; g.lineWidth = 5.5;
      g.beginPath(); g.arc(0, 4, 12, Math.PI * 1.0, Math.PI * 2.0); g.stroke();
      g.strokeStyle = '#ffe1ff'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(0, 4, 13, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    });
    Art.shell = sprite(24, 24, res, (g) => shellSprite(g, 9, '#f6d8c0'));
    Art.pearl = sprite(24, 24, res, (g) => {
      const grd = g.createRadialGradient(-3, -3, 1, 0, 0, 9);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.6, '#f2e6ff'); grd.addColorStop(1, '#b49ad8');
      g.fillStyle = 'rgba(255,240,255,0.25)'; g.beginPath(); g.arc(0, 0, 11.5, 0, TAU); g.fill();
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 8.5, 0, TAU); g.fill();
    });
    Art.chest = sprite(40, 40, res, (g) => drawChest(g, 0));
    Art.coconut = sprite(26, 26, res, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 9, 9, 3, 0, 0, TAU); g.fill();
      g.fillStyle = '#6b4226'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
      g.fillStyle = '#f5f0e6'; g.beginPath(); g.arc(0, 0, 6.2, 0, TAU); g.fill();
      g.fillStyle = '#c8f0ff'; g.globalAlpha = 0.7; g.beginPath(); g.arc(0, 0, 3.6, 0, TAU); g.fill(); g.globalAlpha = 1;
      g.fillStyle = '#5fd08a'; g.beginPath(); g.ellipse(4, -9, 5, 2, -0.6, 0, TAU); g.fill();
    });
    Art.conch = sprite(28, 28, res, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 9, 10, 3, 0, 0, TAU); g.fill();
      shellSprite(g, 10, '#ffb0c8');
      g.fillStyle = '#7aa8ff'; g.globalAlpha = 0.6; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill(); g.globalAlpha = 1;
    });
    // decor
    Art.decor = [
      sprite(30, 24, res, (g) => { shellSprite(g, 7, '#4a4f6e'); }),
      sprite(40, 26, res, (g) => {
        g.fillStyle = '#20263d'; g.beginPath(); g.ellipse(-7, 3, 9, 6, 0, 0, TAU); g.ellipse(7, 5, 6, 4, 0, 0, TAU); g.ellipse(2, -3, 5, 4, 0, 0, TAU); g.fill();
        g.fillStyle = '#2f3756'; g.beginPath(); g.ellipse(-9, 1, 4, 2.5, 0, 0, TAU); g.ellipse(5, 3, 2.5, 1.5, 0, 0, TAU); g.fill();
      }),
      sprite(84, 34, res, (g) => {
        g.rotate(-0.15);
        g.fillStyle = '#2a2230'; g.beginPath(); g.ellipse(0, 2, 36, 7, 0, 0, TAU); g.fill();
        g.strokeStyle = '#3d3245'; g.lineWidth = 2; g.beginPath(); g.moveTo(-28, 0); g.lineTo(26, 1); g.moveTo(-18, 4); g.lineTo(12, 5); g.stroke();
        g.strokeStyle = '#2a2230'; g.lineWidth = 3; g.beginPath(); g.moveTo(10, 0); g.lineTo(22, -10); g.stroke();
      }),
      sprite(40, 40, res, (g) => {
        g.strokeStyle = '#1d3a33'; g.lineWidth = 3;
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.35; g.moveTo(0, 10); g.quadraticCurveTo(Math.cos(a) * 8, 4, Math.cos(a) * 16, 10 + Math.sin(a) * 18); }
        g.stroke();
      }),
      sprite(26, 26, res, (g) => {
        g.fillStyle = '#4a2c3c'; g.beginPath();
        for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? 4 : 10; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.fill();
      }),
      sprite(120, 70, res, (g) => {
        g.fillStyle = '#0f1a33'; g.beginPath(); g.ellipse(0, 0, 54, 26, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(120,170,255,0.25)'; g.lineWidth = 2; g.stroke();
        g.fillStyle = 'rgba(180,210,255,0.35)'; g.beginPath(); g.ellipse(-14, -7, 12, 2.5, 0, 0, TAU); g.ellipse(18, 6, 7, 1.6, 0, 0, TAU); g.fill();
      }),
    ];
    // digit atlases for damage numbers (drawImage is much cheaper than fillText)
    Art.digits = [digitAtlas(11, '#ffffff', 800), digitAtlas(15, '#ffd23f', 900)];
    // sand tile 256 world units
    Art.sand = sprite(256, 256, res, (g) => {
      g.translate(-128, -128);
      g.fillStyle = '#1b2242'; g.fillRect(-1, -1, 258, 258);
      let seed = 1337;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      g.strokeStyle = 'rgba(70,86,140,0.16)'; g.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) {
        const y = rnd() * 256, x = rnd() * 256, w = 40 + rnd() * 70;
        g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - 6, x + w / 2, y + 1); g.stroke();
        // wrap copies
        g.beginPath(); g.moveTo(x - w / 2 - 256, y); g.quadraticCurveTo(x - 256, y - 6, x + w / 2 - 256, y + 1); g.stroke();
      }
      for (let i = 0; i < 260; i++) {
        const x = rnd() * 256, y = rnd() * 256, s = 0.6 + rnd() * 1.4;
        g.fillStyle = rnd() < 0.5 ? 'rgba(90,108,165,0.22)' : 'rgba(5,8,20,0.28)';
        g.fillRect(x, y, s, s);
      }
    });
  };

  function digitAtlas(fs, col, wt) {
    const cw = fs * 0.66, chh = fs * 1.25, res = Art.res;
    const c = document.createElement('canvas');
    c.width = Math.ceil(cw * 10 * res); c.height = Math.ceil(chh * res);
    const g = c.getContext('2d');
    g.scale(res, res);
    g.font = wt + ' ' + fs + 'px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (let d = 0; d < 10; d++) {
      const x = cw * d + cw / 2, y = chh / 2;
      g.strokeStyle = 'rgba(0,0,0,0.75)'; g.lineWidth = fs * 0.22; g.strokeText(String(d), x, y);
      g.fillStyle = col; g.fillText(String(d), x, y);
    }
    return { img: c, cw, ch: chh, pw: c.width / 10, ph: c.height };
  }

  function drawChest(g, open) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 13, 15, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#7a4a22'; g.strokeStyle = '#2a160a'; g.lineWidth = 1.6;
    g.beginPath(); g.rect(-14, -2, 28, 15); g.fill(); g.stroke();
    if (open > 0) {
      g.fillStyle = 'rgba(255,230,140,' + (0.9 * open) + ')';
      g.beginPath(); g.ellipse(0, -2, 13, 3.5, 0, 0, Math.PI * 2); g.fill();
    }
    g.save(); g.translate(0, -2 - open * 9); g.scale(1, 1 - open * 1.6);
    g.fillStyle = '#9a5e2c'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-14, -6); g.quadraticCurveTo(0, -14, 14, -6); g.lineTo(14, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffcf4a'; g.fillRect(-2.5, -10, 5, 10);
    g.restore();
    g.fillStyle = '#ffcf4a'; g.fillRect(-15, 2, 30, 3); g.fillRect(-2.5, -2, 5, 8);
    g.fillStyle = '#3a2208'; g.fillRect(-1, 1, 2, 3);
  }
  Art.drawChest = drawChest;

  // ---------- castaway blob ----------
  // x,y world/canvas units; r radius; lookX/lookY unit-ish direction; t time; sq squash (0..1 bounce)
  Art.drawBlob = function (g, x, y, r, color, acc, lookX, lookY, t, sq, hurt) {
    const bob = Math.sin(t * 10) * sq;
    const sx = 1 + bob * 0.08, sy = 1 - bob * 0.08;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(x, y + r * 0.95, r * 0.95, r * 0.3, 0, 0, TAU); g.fill();
    const by = y - Math.abs(bob) * r * 0.18;
    g.save(); g.translate(x, by); g.scale(sx, sy);
    const grd = g.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.15, 0, 0, r * 1.1);
    grd.addColorStop(0, shade(color, 0.45)); grd.addColorStop(0.65, color); grd.addColorStop(1, shade(color, -0.3));
    g.fillStyle = hurt ? '#ffffff' : grd;
    g.beginPath();
    g.moveTo(-r, r * 0.3);
    g.bezierCurveTo(-r * 1.05, -r * 0.9, r * 1.05, -r * 0.9, r, r * 0.3);
    g.quadraticCurveTo(r * 0.95, r * 0.85, 0, r * 0.85);
    g.quadraticCurveTo(-r * 0.95, r * 0.85, -r, r * 0.3);
    g.fill();
    g.strokeStyle = 'rgba(20,14,30,0.55)'; g.lineWidth = r * 0.1; g.stroke();
    // accessory
    g.lineWidth = r * 0.12;
    switch (acc) {
      case 'sprout':
        g.strokeStyle = '#3e8a4a'; g.beginPath(); g.moveTo(0, -r * 0.62); g.quadraticCurveTo(r * 0.05, -r * 0.95, -r * 0.05, -r * 1.05); g.stroke();
        g.fillStyle = '#6fd07a'; g.beginPath(); g.ellipse(-r * 0.25, -r * 1.05, r * 0.25, r * 0.12, -0.5, 0, TAU); g.ellipse(r * 0.18, -r * 1.12, r * 0.22, r * 0.1, 0.5, 0, TAU); g.fill();
        break;
      case 'candle':
        g.fillStyle = '#f2e6d0'; g.fillRect(-r * 0.12, -r * 1.05, r * 0.24, r * 0.42);
        g.fillStyle = '#ffcf4a'; g.beginPath(); g.ellipse(0, -r * 1.2, r * 0.11, r * 0.2, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,200,90,0.3)'; g.beginPath(); g.arc(0, -r * 1.2, r * 0.38, 0, TAU); g.fill();
        break;
      case 'bandana':
        g.fillStyle = '#e04a4a'; g.beginPath(); g.moveTo(-r * 0.92, -r * 0.18); g.quadraticCurveTo(0, -r * 0.95, r * 0.92, -r * 0.18);
        g.lineTo(r * 0.82, -r * 0.02); g.quadraticCurveTo(0, -r * 0.6, -r * 0.82, -r * 0.02); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(r * 0.85, -r * 0.1); g.lineTo(r * 1.25, -r * 0.3); g.lineTo(r * 1.15, r * 0.05); g.closePath(); g.fill();
        break;
      case 'feather':
        g.fillStyle = '#7fd6ff'; g.beginPath(); g.ellipse(r * 0.35, -r * 0.95, r * 0.13, r * 0.42, 0.5, 0, TAU); g.fill();
        g.strokeStyle = '#3d6c8a'; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(r * 0.15, -r * 0.6); g.lineTo(r * 0.55, -r * 1.3); g.stroke();
        break;
      case 'kelp':
        g.strokeStyle = '#2e9a5e';
        g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(i * r * 0.2, -r * 0.6); g.quadraticCurveTo(i * r * 0.3 + r * 0.15, -r * 0.85, i * r * 0.32, -r * (0.95 + (i & 1) * 0.12)); } g.stroke();
        break;
      case 'shell':
        g.save(); g.translate(0, -r * 0.78); g.scale(r / 18, r / 18); shellSprite(g, 9, '#fff0f4'); g.restore();
        break;
    }
    // eyes
    const ex = lookX * r * 0.18, ey = lookY * r * 0.12;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(-r * 0.32 + ex, -r * 0.08 + ey, r * 0.2, r * 0.25, 0, 0, TAU); g.ellipse(r * 0.32 + ex, -r * 0.08 + ey, r * 0.2, r * 0.25, 0, 0, TAU); g.fill();
    g.fillStyle = '#1a1426';
    g.beginPath(); g.arc(-r * 0.32 + ex * 1.5, -r * 0.05 + ey * 1.5, r * 0.11, 0, TAU); g.arc(r * 0.32 + ex * 1.5, -r * 0.05 + ey * 1.5, r * 0.11, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,120,140,0.45)';
    g.beginPath(); g.ellipse(-r * 0.6, r * 0.25, r * 0.15, r * 0.08, 0, 0, TAU); g.ellipse(r * 0.6, r * 0.25, r * 0.15, r * 0.08, 0, 0, TAU); g.fill();
    g.restore();
  };

  // ---------- icons (100x100 design space) ----------
  Art.drawIcon = function (g, id, size) {
    g.save();
    g.scale(size / 100, size / 100);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const evo = NT.EVOS[id];
    const base = evo ? evo.from : id;
    const gold = !!evo;
    switch (base) {
      case 'boom':
        g.translate(50, 56); g.rotate(-0.5);
        g.strokeStyle = gold ? '#1b0f30' : '#3b2414'; g.lineWidth = 20; g.beginPath(); g.arc(0, 8, 30, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
        g.strokeStyle = gold ? '#b07cff' : '#d9a46c'; g.lineWidth = 13; g.beginPath(); g.arc(0, 8, 30, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
        break;
      case 'shell':
        if (gold) {
          for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.fillStyle = '#f2e6ff'; g.beginPath(); g.arc(50 + Math.cos(a) * 30, 50 + Math.sin(a) * 30, 10, 0, TAU); g.fill(); }
          g.strokeStyle = '#c9a7ff'; g.lineWidth = 3; g.beginPath(); g.arc(50, 50, 30, 0, TAU); g.stroke();
        } else { g.translate(50, 52); g.scale(3.4, 3.4); shellSprite(g, 9, '#f6d8c0'); }
        break;
      case 'harp':
        g.translate(50, 50); g.rotate(-Math.PI / 4);
        g.strokeStyle = '#c9d4e6'; g.lineWidth = 7; g.beginPath(); g.moveTo(-38, 0); g.lineTo(26, 0); g.stroke();
        g.fillStyle = gold ? '#ffffff' : '#9fb3cc'; g.beginPath(); g.moveTo(40, 0); g.lineTo(20, -12); g.lineTo(24, 0); g.lineTo(20, 12); g.closePath(); g.fill();
        if (gold) { g.strokeStyle = '#ffcf4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-30, -14); g.lineTo(10, -14); g.moveTo(-30, 14); g.lineTo(10, 14); g.stroke(); }
        break;
      case 'lamp':
        g.fillStyle = gold ? 'rgba(255,240,180,0.45)' : 'rgba(255,180,90,0.35)'; g.beginPath(); g.arc(50, 55, 40, 0, TAU); g.fill();
        if (gold) {
          g.fillStyle = '#f2f2f2'; g.beginPath(); g.moveTo(38, 88); g.lineTo(44, 34); g.lineTo(56, 34); g.lineTo(62, 88); g.closePath(); g.fill();
          g.fillStyle = '#e04a4a'; g.fillRect(41, 52, 18, 8); g.fillRect(39, 70, 22, 8);
          g.fillStyle = '#ffe680'; g.beginPath(); g.arc(50, 28, 9, 0, TAU); g.fill();
        } else {
          g.strokeStyle = '#3a2a18'; g.lineWidth = 5; g.beginPath(); g.arc(50, 26, 9, Math.PI, 0); g.stroke();
          g.fillStyle = '#6b4a2a'; g.fillRect(34, 30, 32, 8); g.fillRect(34, 72, 32, 8);
          g.fillStyle = '#ffcf4a'; g.fillRect(37, 38, 26, 34);
          g.fillStyle = '#fff3c0'; g.beginPath(); g.ellipse(50, 56, 6, 10, 0, 0, TAU); g.fill();
        }
        break;
      case 'tide':
        g.strokeStyle = gold ? '#9ff6ff' : '#5ce1e6'; g.lineWidth = 8;
        g.beginPath(); g.arc(50, 50, 34, 0, TAU); g.stroke();
        g.globalAlpha = 0.55; g.lineWidth = 6; g.beginPath(); g.arc(50, 50, 20, 0, TAU); g.stroke(); g.globalAlpha = 1;
        if (gold) { g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(50, 50, 44, 0, TAU); g.stroke(); }
        g.fillStyle = '#e8ffff'; g.beginPath(); g.arc(50, 50, 7, 0, TAU); g.fill();
        break;
      case 'gull':
        g.strokeStyle = gold ? '#ffffff' : '#e8eef8'; g.lineWidth = gold ? 11 : 9;
        g.beginPath(); g.moveTo(10, 46); g.quadraticCurveTo(30, 26, 50, 50); g.quadraticCurveTo(70, 26, 90, 46); g.stroke();
        g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(50, 50); g.lineTo(56, 58); g.lineTo(46, 56); g.fill();
        if (gold) { g.strokeStyle = '#ffcf4a'; g.lineWidth = 3; g.beginPath(); g.moveTo(14, 60); g.quadraticCurveTo(30, 44, 46, 64); g.moveTo(54, 64); g.quadraticCurveTo(70, 44, 86, 60); g.stroke(); }
        break;
      case 'speed':
        g.fillStyle = '#7fe0ff';
        g.beginPath(); g.moveTo(20, 50); g.quadraticCurveTo(50, 18, 78, 40); g.lineTo(90, 30); g.lineTo(88, 70); g.lineTo(78, 60); g.quadraticCurveTo(50, 82, 20, 50); g.fill();
        g.fillStyle = '#123'; g.beginPath(); g.arc(34, 47, 4, 0, TAU); g.fill();
        break;
      case 'might':
        g.strokeStyle = '#ff7a7a'; g.lineWidth = 10;
        g.beginPath(); g.moveTo(50, 90); g.lineTo(50, 50); g.lineTo(28, 22); g.moveTo(50, 50); g.lineTo(74, 18); g.moveTo(38, 36); g.lineTo(22, 40); g.moveTo(64, 32); g.lineTo(82, 40); g.stroke();
        break;
      case 'area':
        g.strokeStyle = '#9fe07a'; g.lineWidth = 4;
        g.beginPath();
        for (let i = 0; i <= 4; i++) { g.moveTo(14 + i * 18, 14); g.lineTo(14 + i * 18, 86); g.moveTo(14, 14 + i * 18); g.lineTo(86, 14 + i * 18); }
        g.stroke();
        g.fillStyle = '#9fe07a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(14 + (i % 2) * 72, 14 + (i >> 1) * 72, 7, 0, TAU); g.fill(); }
        break;
      case 'cooldown':
        g.strokeStyle = '#c9a7ff'; g.lineWidth = 8; g.beginPath(); g.arc(50, 52, 34, 0, TAU); g.stroke();
        g.lineWidth = 7; g.beginPath(); g.moveTo(50, 52); g.lineTo(50, 30); g.moveTo(50, 52); g.lineTo(66, 60); g.stroke();
        g.fillStyle = '#c9a7ff'; g.fillRect(42, 8, 16, 8);
        break;
      case 'magnet':
        g.strokeStyle = '#7aa8ff'; g.lineWidth = 16; g.lineCap = 'butt';
        g.beginPath(); g.arc(50, 46, 24, Math.PI, 0); g.lineTo(74, 76); g.moveTo(26, 46); g.lineTo(26, 76); g.stroke();
        g.strokeStyle = '#e8eef8'; g.beginPath(); g.moveTo(26, 70); g.lineTo(26, 86); g.moveTo(74, 70); g.lineTo(74, 86); g.stroke();
        break;
      case 'armor':
        g.fillStyle = '#d7c39a'; g.beginPath(); g.moveTo(50, 12); g.lineTo(84, 26); g.quadraticCurveTo(82, 70, 50, 90); g.quadraticCurveTo(18, 70, 16, 26); g.closePath(); g.fill();
        g.fillStyle = '#8a7650'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(36 + (i % 2) * 28, 40 + (i >> 1) * 22, 6, 0, TAU); g.fill(); }
        break;
      case 'regen':
        g.strokeStyle = '#5fd08a'; g.lineWidth = 9;
        g.beginPath(); g.moveTo(50, 90); g.quadraticCurveTo(30, 60, 50, 40); g.quadraticCurveTo(68, 22, 50, 8); g.stroke();
        g.fillStyle = '#ff6b81'; g.beginPath(); g.moveTo(70, 66); g.bezierCurveTo(70, 52, 90, 52, 90, 66); g.bezierCurveTo(90, 76, 80, 80, 80, 88); g.bezierCurveTo(80, 80, 70, 76, 70, 66); g.fill();
        break;
      case 'luck': {
        const grd = g.createRadialGradient(42, 40, 4, 50, 52, 32);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.7, '#ffe9a8'); grd.addColorStop(1, '#c9a050');
        g.fillStyle = grd; g.beginPath(); g.arc(50, 52, 30, 0, TAU); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(80, 14); g.lineTo(84, 24); g.lineTo(94, 28); g.lineTo(84, 32); g.lineTo(80, 42); g.lineTo(76, 32); g.lineTo(66, 28); g.lineTo(76, 24); g.closePath(); g.fill();
        break;
      }
      case 'heal':
        g.translate(50, 52); g.scale(3.6, 3.6);
        g.fillStyle = '#6b4226'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
        g.fillStyle = '#f5f0e6'; g.beginPath(); g.arc(0, 0, 6.2, 0, TAU); g.fill();
        g.fillStyle = '#5fd08a'; g.beginPath(); g.ellipse(4, -9, 5, 2, -0.6, 0, TAU); g.fill();
        break;
      case 'shards':
        g.translate(50, 50);
        g.fillStyle = '#5ce1e6'; g.beginPath(); g.moveTo(0, -38); g.lineTo(24, 0); g.lineTo(0, 38); g.lineTo(-24, 0); g.closePath(); g.fill();
        g.fillStyle = '#e8ffff'; g.beginPath(); g.moveTo(0, -38); g.lineTo(24, 0); g.lineTo(0, 0); g.closePath(); g.fill();
        break;
      case 'chest':
        g.translate(50, 50); g.scale(2.6, 2.6); drawChest(g, 0);
        break;
    }
    g.restore();
  };

  Art.iconCanvas = function (id, cssSize) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(cssSize * dpr);
    c.style.width = c.style.height = cssSize + 'px';
    Art.drawIcon(c.getContext('2d'), id, c.width);
    return c;
  };
})(window.NT);
