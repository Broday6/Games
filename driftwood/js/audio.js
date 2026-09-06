// DRIFTWOOD — procedural WebAudio sound effects + ambient
(function (G) {
  'use strict';
  const A = { ctx: null, master: null, muted: false, amb: null, volume: 0.5, lx: 0, ly: 0, yaw: 0 }; let curGain = 1, curPan = 0;
  G.Audio = A;
  A.init = function () {
    if (A.ctx) return;
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : A.volume; A.master.connect(A.ctx.destination);
    // ambient drone: two detuned oscillators through a lowpass, wind noise
    const o1 = A.ctx.createOscillator(), o2 = A.ctx.createOscillator(), g = A.ctx.createGain(), f = A.ctx.createBiquadFilter();
    o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = 55; o2.frequency.value = 82.5; f.type = 'lowpass'; f.frequency.value = 300; g.gain.value = 0.04;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(A.master); o1.start(); o2.start();
    const noise = A.ctx.createBufferSource(); const buf = A.ctx.createBuffer(1, A.ctx.sampleRate * 2, A.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3; noise.buffer = buf; noise.loop = true;
    const nf = A.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 0.5; const ng = A.ctx.createGain(); ng.gain.value = 0.03; noise.connect(nf); nf.connect(ng); ng.connect(A.master); noise.start();
    A.amb = { g, ng, o1, o2, f };
  };
  A.resume = () => { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  A.setNight = (darkness) => { if (!A.amb) return; A.amb.g.gain.value = 0.03 + darkness * 0.05; A.amb.o1.frequency.value = 55 - darkness * 12; A.amb.ng.gain.value = 0.02 + darkness * 0.03; };
  A.toggleMute = () => { A.muted = !A.muted; if (A.master) A.master.gain.value = A.muted ? 0 : A.volume; return A.muted; };
  A.setVolume = (v) => { A.volume = Math.max(0, Math.min(1, v)); if (A.master && !A.muted) A.master.gain.value = A.volume; };
  A.listen = (x, y, yaw) => { A.lx = x; A.ly = y; A.yaw = yaw; };
  // every one-shot goes through a per-sound gain/pan so distance and direction are audible (a wolf circling behind you should sound like it)
  function out(g) { const c = A.ctx; if (curPan !== 0 && c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = curPan; g.connect(pn); pn.connect(A.master); } else g.connect(A.master); }

  function tone(freq, dur, type, vol, slide, delay) {
    const c = A.ctx; if (!c) return; const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime((vol || 0.2) * curGain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); out(g); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, freq, delay) {
    const c = A.ctx; if (!c) return; const t0 = c.currentTime + (delay || 0);
    const src = c.createBufferSource(); const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = 0.8; const g = c.createGain(); g.gain.setValueAtTime((vol || 0.2) * curGain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); out(g); src.start(t0);
  }
  const SFX = {
    hit: () => { noise(0.08, 0.25, 1800); tone(220, 0.08, 'square', 0.12, 110); },
    crit: () => { noise(0.1, 0.3, 2400); tone(440, 0.12, 'square', 0.15, 180); tone(660, 0.1, 'square', 0.1, 220, 0.03); },
    swing: () => noise(0.12, 0.08, 900),
    chop: () => { noise(0.06, 0.25, 600); tone(160, 0.06, 'triangle', 0.15, 90); },
    mine: () => { noise(0.05, 0.25, 2500); tone(900, 0.05, 'square', 0.08, 500); },
    clank: () => { tone(1200, 0.08, 'square', 0.08, 900); },
    break: () => { noise(0.25, 0.3, 500); tone(120, 0.2, 'triangle', 0.15, 50); },
    pickup: () => { tone(660, 0.05, 'square', 0.08); tone(990, 0.08, 'square', 0.08, 0, 0.05); },
    coin: () => { tone(1320, 0.05, 'square', 0.07); tone(1760, 0.1, 'square', 0.07, 0, 0.05); },
    hurt: () => { tone(200, 0.15, 'sawtooth', 0.2, 80); noise(0.1, 0.15, 400); },
    die: () => { tone(300, 0.25, 'sawtooth', 0.12, 60); noise(0.2, 0.2, 700); },
    bossdie: () => { tone(200, 0.8, 'sawtooth', 0.25, 30); noise(0.8, 0.3, 300); tone(100, 1.2, 'square', 0.15, 20, 0.2); },
    eat: () => { tone(300, 0.06, 'triangle', 0.1); tone(250, 0.06, 'triangle', 0.1, 0, 0.08); tone(350, 0.08, 'triangle', 0.1, 0, 0.16); },
    craft: () => { tone(500, 0.06, 'square', 0.1); tone(750, 0.06, 'square', 0.1, 0, 0.07); tone(1000, 0.1, 'square', 0.1, 0, 0.14); },
    build: () => { noise(0.08, 0.2, 800); tone(180, 0.1, 'triangle', 0.15, 120); },
    chest: () => { tone(523, 0.1, 'square', 0.1); tone(659, 0.1, 'square', 0.1, 0, 0.1); tone(784, 0.1, 'square', 0.1, 0, 0.2); tone(1046, 0.25, 'square', 0.12, 0, 0.3); },
    pw: () => { tone(784, 0.1, 'triangle', 0.15); tone(1175, 0.2, 'triangle', 0.15, 0, 0.1); },
    dodge: () => noise(0.1, 0.12, 1400),
    bow: () => { noise(0.06, 0.15, 2000); tone(800, 0.1, 'sine', 0.08, 300); },
    throw: () => noise(0.15, 0.15, 500),
    block: () => { tone(400, 0.08, 'square', 0.12, 300); noise(0.05, 0.1, 3000); },
    parry: () => { tone(1500, 0.15, 'square', 0.12, 2200); tone(2200, 0.1, 'sine', 0.1, 0, 0.05); },
    boom: () => { noise(0.3, 0.35, 250); tone(80, 0.3, 'sawtooth', 0.2, 30); },
    slam: () => { noise(0.35, 0.4, 180); tone(60, 0.35, 'square', 0.25, 25); },
    roar: () => { tone(90, 0.7, 'sawtooth', 0.25, 50); tone(140, 0.6, 'square', 0.12, 70, 0.1); noise(0.6, 0.15, 200); },
    growl: () => tone(120, 0.3, 'sawtooth', 0.12, 90),
    horn: () => { tone(220, 0.5, 'sawtooth', 0.12); tone(330, 0.6, 'sawtooth', 0.12, 0, 0.3); },
    down: () => { tone(300, 0.4, 'square', 0.15, 80); },
    revive: () => { tone(440, 0.15, 'triangle', 0.15); tone(660, 0.15, 'triangle', 0.15, 0, 0.15); tone(880, 0.3, 'triangle', 0.15, 0, 0.3); },
    door: () => { noise(0.08, 0.12, 600); tone(200, 0.08, 'triangle', 0.08); },
    summon: () => { tone(200, 0.4, 'sine', 0.15, 600); },
    tele: () => { tone(900, 0.2, 'sine', 0.12, 200); },
    splash: () => { noise(0.3, 0.25, 900); },
    thud: () => { noise(0.08, 0.2, 300); tone(90, 0.1, 'triangle', 0.15, 60); },
    equip: () => { tone(600, 0.05, 'square', 0.08); tone(500, 0.08, 'square', 0.08, 0, 0.06); },
    no: () => tone(150, 0.15, 'square', 0.08, 100),
    tick: () => tone(1400, 0.02, 'square', 0.05),
    stepGrass: () => noise(0.05, 0.05, 700), stepSand: () => noise(0.06, 0.045, 1100), stepStone: () => { noise(0.04, 0.05, 1800); tone(240, 0.03, 'triangle', 0.03); }, stepWater: () => noise(0.09, 0.06, 900),
    heart: () => { tone(55, 0.09, 'sine', 0.18); tone(48, 0.13, 'sine', 0.16, 0, 0.14); },
    win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, 'square', 0.12, 0, i * 0.15)); },
    lose: () => { [400, 350, 300, 200].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.12, 0, i * 0.3)); },
  };
  A.play = function (name, x, y, lx, ly) {
    if (!A.ctx || A.muted) return;
    curGain = 1; curPan = 0;
    if (x !== undefined) { if (lx === undefined) { lx = A.lx; ly = A.ly; } const d = G.dist(x, y, lx, ly); if (d > 24) return; const g = 1 - d / 24; curGain = Math.max(0.05, g * g);
      if (d > 0.6) { const a = Math.atan2(y - ly, x - lx) - A.yaw; curPan = Math.max(-1, Math.min(1, Math.sin(a) * 0.8)); } }
    const f = SFX[name]; if (f) f();
  };
})(window.G);
