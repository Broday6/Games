'use strict';
// HIGH CARD — procedural WebAudio: casino SFX and a soft lounge loop.
(function (HC) {
  let ac = null, master = null, sfx = null, mus = null, noiseBuf = null, musTimer = 0, nextBar = 0, bar = 0;
  const A = HC.Audio = { sfxOn: true, musicOn: true };
  A.unlock = function () {
    if (!ac) {
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        ac = new C();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -12; comp.ratio.value = 4;
        master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
        sfx = ac.createGain(); sfx.gain.value = A.sfxOn ? 0.5 : 0; sfx.connect(master);
        mus = ac.createGain(); mus.gain.value = A.musicOn ? 0.16 : 0; mus.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } }
    if (A.musicOn && !musTimer) startMusic();
  };
  function ramp(g, v) { if (ac && g) g.gain.setTargetAtTime(v, ac.currentTime, 0.05); }
  A.setSfx = (on) => { A.sfxOn = on; ramp(sfx, on ? 0.5 : 0); };
  A.setMusic = (on) => { A.musicOn = on; ramp(mus, on ? 0.16 : 0); if (on && ac && !musTimer) startMusic(); if (!on) stopMusic(); };
  A.suspend = () => { stopMusic(); if (ac && ac.state === 'running') { try { ac.suspend(); } catch (e) { /* ignore */ } } };
  A.resume = () => { if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } } if (ac && A.musicOn && !musTimer) startMusic(); };

  function tone(f, d, type, v, f2, delay, dest) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v, type, freq, q, delay, f2) {
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
    f.Q.value = q || 0.7;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  const last = {};
  function gap(n, s) { const t = ac.currentTime; if (last[n] && t - last[n] < s) return false; last[n] = t; return true; }
  const semi = (n) => 440 * Math.pow(2, n / 12);

  A.play = function (name, p) {
    if (!ac || !A.sfxOn || ac.state !== 'running') return;
    p = p || 0;
    switch (name) {
      case 'click': tone(900, 0.04, 'triangle', 0.08, 600); break;
      case 'select': if (gap(name, 0.02)) { noise(0.05, 0.12, 'bandpass', 3200, 2); tone(1200, 0.05, 'sine', 0.05); } break;
      case 'deselect': if (gap(name, 0.02)) noise(0.05, 0.1, 'bandpass', 1800, 2); break;
      case 'deal': if (gap(name, 0.03)) noise(0.09, 0.14, 'highpass', 2500, 0.8, 0, 6000); break;
      case 'shuffle': for (let i = 0; i < 8; i++) noise(0.05, 0.1, 'highpass', 2000 + i * 200, 0.8, i * 0.035); break;
      case 'chip': { // rising per step
        const f = semi(Math.min(24, p) - 5);
        tone(f, 0.09, 'triangle', 0.12); tone(f * 2, 0.06, 'sine', 0.04); noise(0.03, 0.08, 'highpass', 5000); break;
      }
      case 'mult': { const f = semi(Math.min(24, p) - 2); tone(f, 0.12, 'square', 0.06); tone(f * 1.5, 0.1, 'triangle', 0.06); break; }
      case 'xmult': { const f = semi(Math.min(24, p) + 3); tone(f, 0.22, 'sawtooth', 0.05, f * 1.02); tone(f * 1.26, 0.22, 'triangle', 0.08); tone(f * 1.5, 0.25, 'triangle', 0.07); noise(0.15, 0.12, 'bandpass', 1200, 1); break; }
      case 'money': tone(1568, 0.08, 'square', 0.05); tone(2093, 0.18, 'square', 0.05, null, 0.06); break;
      case 'again': tone(660, 0.07, 'triangle', 0.08, 990); break;
      case 'debuff': tone(200, 0.15, 'sawtooth', 0.06, 120); break;
      case 'charm': tone(semi(Math.min(20, p)), 0.08, 'sine', 0.08, semi(Math.min(20, p) + 7)); break;
      case 'final': for (let i = 0; i < 4; i++) tone(semi(i * 4), 0.14, 'triangle', 0.08, null, i * 0.04); break;
      case 'flame': noise(0.9, 0.25, 'lowpass', 400, 0.6, 0, 2400); tone(110, 0.7, 'sawtooth', 0.05, 220); break;
      case 'shatter': noise(0.35, 0.3, 'highpass', 3000, 1); for (let i = 0; i < 5; i++) tone(2500 + Math.random() * 2500, 0.08, 'sine', 0.04, null, i * 0.03); break;
      case 'win': [0, 4, 7, 12, 16].forEach((n, i) => tone(semi(n), 0.35, 'triangle', 0.1, null, i * 0.09)); break;
      case 'lose': [7, 3, 0, -5].forEach((n, i) => tone(semi(n - 12), 0.4, 'sawtooth', 0.05, null, i * 0.16)); break;
      case 'buy': tone(1046, 0.06, 'square', 0.05); tone(1568, 0.12, 'square', 0.05, null, 0.05); noise(0.12, 0.1, 'bandpass', 4000, 2, 0.02); break;
      case 'sell': tone(784, 0.08, 'square', 0.05); tone(523, 0.12, 'square', 0.05, null, 0.06); break;
      case 'reroll': for (let i = 0; i < 5; i++) tone(500 + i * 120, 0.05, 'triangle', 0.06, null, i * 0.04); break;
      case 'pack': noise(0.3, 0.25, 'bandpass', 1500, 0.8, 0, 5000); tone(300, 0.3, 'sine', 0.08, 900); break;
      case 'level': [0, 7, 12, 19].forEach((n, i) => tone(semi(n + 3), 0.2, 'sine', 0.09, null, i * 0.06)); break;
      case 'omen': tone(semi(-3), 0.5, 'sine', 0.08, semi(9)); tone(semi(4), 0.5, 'triangle', 0.05, null, 0.05); break;
      case 'error': tone(180, 0.12, 'square', 0.06); tone(150, 0.14, 'square', 0.05, null, 0.08); break;
      case 'cash': for (let i = 0; i < 6; i++) tone(1800 + i * 150, 0.05, 'square', 0.03, null, i * 0.045); break;
      case 'tick': if (gap(name, 0.03)) tone(1400, 0.025, 'square', 0.03); break;
    }
  };

  // ---------- music: slow jazzy chords + walking bass ----------
  const PROG = [[-9, -5, -2, 2], [-4, 0, 3, 7], [-11, -7, -4, 0], [-6, -2, 1, 5]]; // Cm7 Fm9-ish...
  const BASS = [[-21, -17, -14, -16], [-16, -12, -9, -11], [-23, -19, -16, -18], [-18, -14, -11, -13]];
  function startMusic() {
    if (!ac || musTimer) return;
    nextBar = ac.currentTime + 0.1;
    musTimer = setInterval(schedule, 200);
  }
  function stopMusic() { if (musTimer) { clearInterval(musTimer); musTimer = 0; } }
  function schedule() {
    if (!ac || !A.musicOn || ac.state !== 'running') return;
    const beat = 0.62;
    while (nextBar < ac.currentTime + 1.2) {
      const ch = PROG[bar % 4], bs = BASS[bar % 4];
      for (const n of ch) {
        const t = nextBar;
        const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = 'triangle'; o.frequency.value = semi(n); f.type = 'lowpass'; f.frequency.value = 1100;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 3.8);
        o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t + beat * 4);
      }
      for (let i = 0; i < 4; i++) tone(semi(bs[i]), beat * 0.9, 'sine', 0.16, null, nextBar - ac.currentTime + i * beat, mus);
      for (let i = 0; i < 8; i++) {
        const t = nextBar + i * beat / 2 + (i % 2 ? beat * 0.16 : 0);
        const s = ac.createBufferSource(); s.buffer = noiseBuf;
        const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
        const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(i % 2 ? 0.03 : 0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        s.connect(f); f.connect(g); g.connect(mus); s.start(t, Math.random() * 0.5); s.stop(t + 0.1);
      }
      nextBar += beat * 4; bar++;
    }
  }
})(window.HC);
