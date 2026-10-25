// DICE DEN — procedural WebAudio: dice rattle/clack, chips, stingers and a soft lounge loop.
(function () {
  'use strict';
  let ctx = null, master, sfx, music, noise, verb;
  const cfg = { sound: true, music: true, muted: false };
  let musicOn = false, nextT = 0, step = 0, timer = 0;

  function init() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.connect(ctx.destination);
      sfx = ctx.createGain(); sfx.connect(master);
      music = ctx.createGain(); music.gain.value = 0; music.connect(master);
      // short noise buffer
      noise = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // tiny feedback-delay "room" for the music
      verb = ctx.createDelay(1); verb.delayTime.value = 0.23;
      const fb = ctx.createGain(); fb.gain.value = 0.28;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      verb.connect(lp); lp.connect(fb); fb.connect(verb);
      const wet = ctx.createGain(); wet.gain.value = 0.35; lp.connect(wet); wet.connect(music);
      apply();
    } catch (e) { ctx = null; }
    return ctx;
  }
  function apply() {
    if (!ctx) return;
    master.gain.value = cfg.muted ? 0 : 1;
    sfx.gain.value = cfg.sound ? 0.9 : 0;
    const want = cfg.music && !cfg.muted;
    music.gain.cancelScheduledValues(ctx.currentTime);
    music.gain.setTargetAtTime(want ? 0.22 : 0, ctx.currentTime, 0.4);
    if (want && !musicOn) startMusic();
    if (!want && musicOn) stopMusic();
  }
  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    apply();
  }
  const ok = () => ctx && cfg.sound && !cfg.muted && ctx.state === 'running';

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function noiseHit(t, freq, q, vol, dec, dest) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.002, vol, dec);
    s.connect(f); f.connect(g); g.connect(dest || sfx);
    s.start(t, Math.random() * 0.5, dec + 0.05);
  }
  function tone(t, freq, type, vol, a, dec, dest, slide) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + a + dec);
    const g = ctx.createGain(); env(g, t, a, vol, dec);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + a + dec + 0.05);
  }

  const S = {
    clack(vol) {
      if (!ok()) return; vol = vol == null ? 1 : vol;
      const t = ctx.currentTime;
      noiseHit(t, 2600 + Math.random() * 1800, 3, 0.5 * vol, 0.035);
      tone(t, 1400 + Math.random() * 900, 'triangle', 0.18 * vol, 0.001, 0.03);
      noiseHit(t, 300, 1, 0.25 * vol, 0.05);
    },
    rattle(dur) {
      if (!ok()) return; dur = dur || 0.6;
      const t0 = ctx.currentTime;
      const n = Math.round(dur * 26);
      for (let i = 0; i < n; i++) {
        const t = t0 + Math.random() * dur;
        noiseHit(t, 2000 + Math.random() * 3000, 4, 0.18 + Math.random() * 0.25, 0.025);
        if (Math.random() < 0.4) tone(t, 900 + Math.random() * 1500, 'triangle', 0.06, 0.001, 0.025);
      }
      // cup "whoosh"
      noiseHit(t0, 500, 0.7, 0.12, dur);
    },
    chip(n) {
      if (!ok()) return; n = Math.min(n || 1, 8);
      const t0 = ctx.currentTime;
      for (let i = 0; i < n; i++) {
        const t = t0 + i * 0.055 + Math.random() * 0.02;
        tone(t, 3100 + Math.random() * 400, 'sine', 0.12, 0.001, 0.09);
        tone(t, 4700 + Math.random() * 500, 'sine', 0.06, 0.001, 0.06);
        noiseHit(t, 6000, 2, 0.12, 0.02);
      }
    },
    blip(up) {
      if (!ok()) return; const t = ctx.currentTime;
      tone(t, up ? 620 : 520, 'sine', 0.16, 0.005, 0.12, null, up ? 930 : 780);
    },
    tick(i) {
      if (!ok()) return; const t = ctx.currentTime;
      const f = 520 * Math.pow(2, Math.min(i || 0, 24) / 12);
      tone(t, f, 'triangle', 0.14, 0.003, 0.11);
      tone(t, f * 2, 'sine', 0.05, 0.003, 0.08);
    },
    liar() {
      if (!ok()) return; const t = ctx.currentTime;
      [110, 116.5, 164.8].forEach((f) => tone(t, f, 'sawtooth', 0.12, 0.01, 0.7));
      noiseHit(t, 180, 0.8, 0.5, 0.4);
      tone(t, 880, 'square', 0.05, 0.005, 0.25, null, 440);
    },
    spot() {
      if (!ok()) return; const t = ctx.currentTime;
      [523, 659, 784].forEach((f, i) => tone(t + i * 0.06, f, 'triangle', 0.12, 0.005, 0.35));
    },
    win() {
      if (!ok()) return; const t = ctx.currentTime;
      [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => { tone(t + i * 0.09, f, 'triangle', 0.16, 0.005, 0.5); tone(t + i * 0.09, f * 2, 'sine', 0.04, 0.005, 0.4); });
      for (let i = 0; i < 6; i++) tone(t + 0.5 + i * 0.07, 2093 + Math.random() * 800, 'sine', 0.05, 0.002, 0.3);
    },
    lose() {
      if (!ok()) return; const t = ctx.currentTime;
      [392, 349, 311, 262].forEach((f, i) => tone(t + i * 0.16, f, 'triangle', 0.13, 0.01, 0.3));
    },
    farkle() {
      if (!ok()) return; const t = ctx.currentTime;
      tone(t, 233, 'sawtooth', 0.12, 0.01, 0.35, null, 200);
      tone(t + 0.38, 196, 'sawtooth', 0.12, 0.01, 0.7, null, 150);
    },
    hot() {
      if (!ok()) return; const t = ctx.currentTime;
      for (let i = 0; i < 8; i++) tone(t + i * 0.045, 660 * Math.pow(2, i / 6), 'square', 0.05, 0.003, 0.12);
    },
    tap() { if (!ok()) return; tone(ctx.currentTime, 880, 'sine', 0.07, 0.002, 0.05); },
  };

  // ---------- Lounge loop: ii–V–I–vi in F, swung brushes, walking bass, soft keys ----------
  const BPM = 84;
  const beat = 60 / BPM;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // chords as MIDI voicings, bass roots
  const PROG = [
    { v: [55, 60, 64, 67], b: [43, 45, 46, 47] }, // Gm9-ish  (G A Bb B)
    { v: [55, 58, 62, 65], b: [48, 47, 45, 43] }, // C13
    { v: [57, 60, 64, 67], b: [41, 43, 45, 48] }, // Fmaj9
    { v: [55, 58, 61, 66], b: [50, 49, 48, 46] }, // D7b9
  ];
  function keys(t, notes, vol) {
    for (const m of notes) {
      const f = mtof(m);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.001;
      const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 3.6);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(music); g.connect(verb);
      o.start(t); o2.start(t); o.stop(t + beat * 3.8); o2.stop(t + beat * 3.8);
    }
  }
  function bass(t, m) {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    const g = ctx.createGain(); env(g, t, 0.01, 0.5, beat * 0.9);
    o.connect(lp); lp.connect(g); g.connect(music); o.start(t); o.stop(t + beat);
  }
  function brush(t, v) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = ctx.createGain(); env(g, t, 0.004, v, 0.09);
    s.connect(f); f.connect(g); g.connect(music); s.start(t, Math.random() * 0.5, 0.15);
  }
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.4) {
      const bar = Math.floor(step / 4) % PROG.length, b = step % 4;
      const ch = PROG[bar];
      if (b === 0) keys(nextT + 0.02, ch.v, 0.05);
      if (b === 2 && Math.random() < 0.5) keys(nextT + beat * 0.66, ch.v.slice(1), 0.03);
      bass(nextT, ch.b[b]);
      brush(nextT, b % 2 ? 0.07 : 0.045);
      brush(nextT + beat * 0.66, 0.03);
      nextT += beat; step++;
    }
  }
  function startMusic() {
    if (!ctx || musicOn) return;
    musicOn = true; nextT = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 120); schedule();
  }
  function stopMusic() { musicOn = false; clearInterval(timer); timer = 0; }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    try { if (document.hidden) ctx.suspend(); else if (cfg.sound || cfg.music) ctx.resume(); } catch (e) { /* ignore */ }
  });

  window.DDAudio = {
    S,
    resume,
    configure(o) { Object.assign(cfg, o); apply(); },
    get cfg() { return cfg; },
  };
})();
