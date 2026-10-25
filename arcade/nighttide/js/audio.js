'use strict';
// NIGHT TIDE — procedural WebAudio SFX and a light generative music loop.
(function (NT) {
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, musFilter = null;
  const A = NT.Audio = { sfxOn: true, musicOn: true, intensity: 0 };
  const last = Object.create(null);
  let gemCombo = 0, gemLast = 0;

  A.unlock = function () {
    if (!ac) {
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        ac = new C();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5;
        master = ac.createGain(); master.gain.value = 0.85;
        master.connect(comp); comp.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = A.sfxOn ? 0.55 : 0; sfxBus.connect(master);
        musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 2600;
        musBus = ac.createGain(); musBus.gain.value = A.musicOn ? 0.3 : 0;
        musBus.connect(musFilter); musFilter.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } }
  };
  A.ready = function () { return !!ac && ac.state === 'running'; };

  function ramp(g, v) { if (!ac) return; const t = ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(v, t, 0.05); }
  A.setSfx = function (on) { A.sfxOn = on; if (sfxBus) ramp(sfxBus, on ? 0.55 : 0); };
  A.setMusic = function (on) { A.musicOn = on; if (musBus) ramp(musBus, on ? 0.3 : 0); };
  A.duck = function (on) { if (musFilter && ac) musFilter.frequency.setTargetAtTime(on ? 700 : 2600, ac.currentTime, 0.12); };

  function gap(name, g) {
    const t = ac.currentTime;
    if (last[name] !== undefined && t - last[name] < g) return false;
    last[name] = t; return true;
  }
  function tone(f, d, type, v, f2, delay, dest) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v, ftype, freq, q, delay, f2, dest) {
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = ac.createBiquadFilter(); f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
    f.Q.value = q || 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }

  A.play = function (name, p) {
    if (!ac || !A.sfxOn || ac.state !== 'running') return;
    switch (name) {
      case 'hit': if (gap(name, 0.045)) noise(0.06, 0.16, 'bandpass', 1800 + Math.random() * 900, 1.2); break;
      case 'crit': if (gap(name, 0.08)) { tone(1300, 0.08, 'square', 0.05, 900); noise(0.08, 0.2, 'highpass', 2500); } break;
      case 'kill': if (gap(name, 0.035)) { tone(320 + Math.random() * 120, 0.09, 'triangle', 0.12, 90); noise(0.07, 0.1, 'lowpass', 900); } break;
      case 'gem': {
        const t = ac.currentTime;
        if (t - gemLast > 0.6) gemCombo = 0;
        gemLast = t;
        if (!gap(name, 0.03)) break;
        gemCombo = Math.min(gemCombo + 1, 24);
        tone(880 * Math.pow(2, (gemCombo % 12) / 24), 0.07, 'sine', 0.08, 0, 0);
        break;
      }
      case 'throw': if (gap(name, 0.12)) noise(0.12, 0.08, 'bandpass', 700, 2, 0, 1600); break;
      case 'harp': if (gap(name, 0.07)) { tone(520, 0.07, 'sawtooth', 0.035, 180); noise(0.06, 0.07, 'highpass', 3000); } break;
      case 'pulse': if (gap(name, 0.2)) { noise(0.5, 0.18, 'lowpass', 300, 1, 0, 1800); tone(110, 0.35, 'sine', 0.12, 55); } break;
      case 'shell': if (gap(name, 0.3)) tone(660, 0.18, 'triangle', 0.06, 990); break;
      case 'gull': if (gap(name, 0.09)) { tone(1500, 0.09, 'triangle', 0.04, 900); noise(0.18, 0.12, 'lowpass', 1400, 1, 0.03); } break;
      case 'lamp': if (gap(name, 0.25)) noise(0.12, 0.05, 'bandpass', 500, 1.5); break;
      case 'spit': if (gap(name, 0.12)) tone(240, 0.12, 'square', 0.03, 120); break;
      case 'hurt': if (gap(name, 0.12)) { tone(160, 0.22, 'sawtooth', 0.12, 60); noise(0.15, 0.2, 'lowpass', 600); } break;
      case 'heal': tone(523, 0.12, 'sine', 0.1); tone(784, 0.18, 'sine', 0.1, 0, 0.08); break;
      case 'lvl': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, 0, i * 0.06)); break;
      case 'pick': tone(784, 0.1, 'triangle', 0.1); tone(1175, 0.2, 'sine', 0.08, 0, 0.06); break;
      case 'click': tone(600, 0.05, 'triangle', 0.06); break;
      case 'chest': noise(0.5, 0.12, 'bandpass', 600, 3, 0, 2400); tone(196, 0.3, 'triangle', 0.1, 392); break;
      case 'reveal': tone(880 * (p || 1), 0.25, 'triangle', 0.1); tone(1320 * (p || 1), 0.3, 'sine', 0.06, 0, 0.05); break;
      case 'evo': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.35, 'triangle', 0.09, 0, i * 0.07)); break;
      case 'warn': for (let i = 0; i < 3; i++) tone(220, 0.3, 'sawtooth', 0.07, 180, i * 0.42); break;
      case 'boss': tone(70, 1.4, 'sawtooth', 0.16, 40); noise(1.4, 0.2, 'lowpass', 200, 1, 0, 900); break;
      case 'bossdie': tone(90, 1.2, 'sawtooth', 0.15, 30); noise(1.2, 0.3, 'lowpass', 1500, 1, 0, 100); break;
      case 'charge': if (gap(name, 0.3)) tone(140, 0.45, 'square', 0.06, 420); break;
      case 'win': [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, 0, i * 0.14)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => tone(f, 0.45, 'triangle', 0.1, 0, i * 0.2)); break;
      case 'buy': tone(659, 0.08, 'square', 0.05); tone(988, 0.16, 'triangle', 0.08, 0, 0.07); break;
      case 'deny': tone(180, 0.15, 'square', 0.05, 140); break;
      case 'coin': if (gap(name, 0.05)) tone(1568, 0.1, 'square', 0.035, 2093); break;
    }
  };

  // ---------------- music ----------------
  const BPM = 92, STEP = 60 / BPM / 4;
  // A minor: Am, F, Dm, E  (moody beach night)
  const PROG = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
  let nextT = 0, step = 0, timer = 0, playing = false;
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function musTone(f, d, type, v, t, f2) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.08, d * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(musBus); o.start(t); o.stop(t + d + 0.05);
  }
  function musNoise(d, v, type, freq, t, f2) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + d * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(musBus); s.start(t); s.stop(t + d + 0.05);
  }
  function playStep(s, t) {
    const bar = (s >> 4) & 3, s16 = s & 15, ch = PROG[bar], I = A.intensity;
    if (s16 === 0) { // pad
      for (let i = 0; i < 3; i++) musTone(mtof(ch[i]), STEP * 16, 'triangle', 0.035, t);
    }
    if (s16 === 0 || s16 === 7 || s16 === 10) musTone(mtof(ch[0] - 12), STEP * 3, 'triangle', 0.13, t);
    if ((s16 & 1) === 0) {
      const n = ch[ARP[(s16 >> 1) & 7]] + 12 + ((s >> 6) & 1 ? 12 : 0);
      musTone(mtof(n), STEP * 1.6, 'sine', I >= 1 ? 0.05 : 0.035, t);
    }
    if (I >= 1 && (s16 & 3) === 2) musNoise(0.05, 0.05, 'highpass', 7000, t);
    if (I >= 2 && (s16 === 0 || s16 === 8 || s16 === 11)) musTone(130, 0.22, 'sine', 0.25, t, 40);
    if (I >= 2 && (s16 === 4 || s16 === 12)) musNoise(0.12, 0.08, 'bandpass', 1800, t);
    if (s16 === 0 && (s >> 4) % 2 === 0) musNoise(STEP * 28, 0.05, 'lowpass', 300, t, 1400); // surf wash
  }
  function sched() {
    if (!ac || !playing) return;
    if (ac.state !== 'running') return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.3) { playStep(step, nextT); nextT += STEP; step = (step + 1) & 127; }
  }
  A.startMusic = function () {
    if (!ac) return;
    if (!playing) { playing = true; step = 0; nextT = ac.currentTime + 0.1; }
    if (!timer) timer = setInterval(sched, 70);
  };
  A.stopMusic = function () { playing = false; if (timer) { clearInterval(timer); timer = 0; } };
  A.setIntensity = function (i) { A.intensity = i; };
})(window.NT);
