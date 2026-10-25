'use strict';
// TIDEWALL — procedural WebAudio SFX plus generative day / night music.
(function (TW) {
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, musFilter = null;
  const A = TW.Audio = { sfxOn: true, musicOn: true, intensity: 0, mode: 'day' };
  const last = Object.create(null);

  A.unlock = function () {
    if (!ac) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        ac = new Ctx();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5;
        master = ac.createGain(); master.gain.value = 0.8;
        master.connect(comp); comp.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = A.sfxOn ? 0.5 : 0; sfxBus.connect(master);
        musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 2400;
        musBus = ac.createGain(); musBus.gain.value = A.musicOn ? 0.28 : 0;
        musBus.connect(musFilter); musFilter.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } }
  };
  A.suspend = function () { if (ac && ac.state === 'running') { try { ac.suspend(); } catch (e) { /* ignore */ } } };
  function ramp(g, v) { if (!ac) return; const t = ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(v, t, 0.05); }
  A.setSfx = function (on) { A.sfxOn = on; if (sfxBus) ramp(sfxBus, on ? 0.5 : 0); };
  A.setMusic = function (on) { A.musicOn = on; if (musBus) ramp(musBus, on ? 0.28 : 0); };
  A.duck = function (on) { if (musFilter && ac) musFilter.frequency.setTargetAtTime(on ? 650 : 2400, ac.currentTime, 0.12); };

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
      case 'arrow': if (gap(name, 0.06)) { noise(0.07, 0.07, 'bandpass', 2400, 3, 0, 900); tone(420, 0.05, 'triangle', 0.03, 200); } break;
      case 'siege': if (gap(name, 0.15)) { noise(0.16, 0.14, 'bandpass', 900, 2, 0, 300); tone(160, 0.14, 'triangle', 0.08, 70); } break;
      case 'harpoon': if (gap(name, 0.12)) { noise(0.12, 0.1, 'highpass', 1800, 1, 0, 600); tone(300, 0.12, 'sawtooth', 0.03, 120); } break;
      case 'mortar': if (gap(name, 0.12)) { tone(110, 0.16, 'sine', 0.16, 55); noise(0.1, 0.09, 'lowpass', 500); } break;
      case 'boom': if (gap(name, 0.07)) { noise(0.35, 0.22, 'lowpass', 900, 0.8, 0, 120); tone(80, 0.25, 'sine', 0.16, 35); } break;
      case 'pop': if (gap(name, 0.05)) noise(0.12, 0.1, 'lowpass', 1400, 0.8, 0, 300); break;
      case 'flame': if (gap(name, 0.18)) noise(0.3, 0.07, 'bandpass', 700, 0.8, 0, 1800); break;
      case 'bell': if (gap(name, 0.2)) { tone(1318, 0.6, 'sine', 0.05); tone(1976, 0.4, 'sine', 0.025, 0, 0.005); tone(659, 0.8, 'triangle', 0.03); } break;
      case 'zap': if (gap(name, 0.08)) { noise(0.09, 0.1, 'highpass', 4000, 1); tone(900 + Math.random() * 600, 0.08, 'square', 0.025, 200); } break;
      case 'beam': if (gap(name, 0.12)) tone(1400 + Math.random() * 300, 0.07, 'sine', 0.025, 2200); break;
      case 'hit': if (gap(name, 0.05)) noise(0.05, 0.08, 'bandpass', 1600 + Math.random() * 900, 1.4); break;
      case 'kill': if (gap(name, 0.04)) { tone(300 + Math.random() * 140, 0.1, 'triangle', 0.08, 80); noise(0.08, 0.06, 'lowpass', 800); } break;
      case 'coin': if (gap(name, 0.06)) tone(1568, 0.08, 'square', 0.025, 2093); break;
      case 'leak': tone(220, 0.3, 'sawtooth', 0.1, 70); noise(0.25, 0.18, 'lowpass', 500); break;
      case 'wallhit': if (gap(name, 0.1)) noise(0.06, 0.08, 'bandpass', 500, 2); break;
      case 'wallbreak': if (gap(name, 0.1)) { noise(0.45, 0.24, 'lowpass', 700, 0.8, 0, 90); tone(70, 0.3, 'square', 0.06, 40); } break;
      case 'stomp': tone(50, 0.5, 'sine', 0.3, 30); noise(0.5, 0.25, 'lowpass', 300, 1, 0, 60); break;
      case 'summon': if (gap(name, 0.4)) tone(180, 0.5, 'sawtooth', 0.05, 360); break;
      case 'shatter': if (gap(name, 0.06)) { noise(0.15, 0.12, 'highpass', 5000, 1); tone(2400, 0.1, 'triangle', 0.04, 1200); } break;
      case 'build': tone(392, 0.07, 'triangle', 0.09); noise(0.08, 0.1, 'bandpass', 900, 2, 0.02); tone(587, 0.12, 'triangle', 0.07, 0, 0.06); break;
      case 'wall': if (gap(name, 0.05)) { noise(0.08, 0.12, 'bandpass', 600 + (p || 0) * 60, 2); tone(200 + (p || 0) * 25, 0.06, 'triangle', 0.06); } break;
      case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, 0, i * 0.05)); break;
      case 'sell': tone(784, 0.08, 'square', 0.03); tone(523, 0.12, 'triangle', 0.06, 0, 0.06); break;
      case 'gather': if (gap(name, 0.05)) {
        if (p === 'w') { noise(0.07, 0.14, 'bandpass', 900, 3); tone(260, 0.06, 'triangle', 0.06, 180); }
        else if (p === 's') { noise(0.05, 0.16, 'highpass', 2400, 1); tone(500, 0.05, 'square', 0.03, 300); }
        else { tone(1568, 0.2, 'sine', 0.06); tone(2349, 0.25, 'sine', 0.04, 0, 0.05); }
      } break;
      case 'click': tone(620, 0.04, 'triangle', 0.05); break;
      case 'open': tone(520, 0.05, 'triangle', 0.05); tone(780, 0.06, 'triangle', 0.04, 0, 0.04); break;
      case 'deny': tone(170, 0.14, 'square', 0.045, 130); break;
      case 'night': tone(98, 1.6, 'sawtooth', 0.07, 73); tone(147, 1.6, 'triangle', 0.06, 110); noise(1.4, 0.1, 'lowpass', 300, 1, 0, 1200); break;
      case 'boss': tone(55, 1.6, 'sawtooth', 0.15, 41); noise(1.4, 0.2, 'lowpass', 200, 1, 0, 900); for (let i = 0; i < 3; i++) tone(110, 0.3, 'square', 0.04, 104, i * 0.45); break;
      case 'bossdie': tone(90, 1.2, 'sawtooth', 0.14, 30); noise(1.2, 0.28, 'lowpass', 1500, 1, 0, 100); break;
      case 'dawn': [392, 494, 587, 784].forEach((f, i) => tone(f, 0.5, 'triangle', 0.08, 0, i * 0.1)); break;
      case 'pick': tone(784, 0.1, 'triangle', 0.09); tone(1175, 0.2, 'sine', 0.07, 0, 0.06); break;
      case 'win': [523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.45, 'triangle', 0.09, 0, i * 0.14)); break;
      case 'lose': [392, 349, 311, 262, 196].forEach((f, i) => tone(f, 0.5, 'triangle', 0.09, 0, i * 0.22)); break;
      case 'buy': tone(659, 0.08, 'square', 0.04); tone(988, 0.16, 'triangle', 0.07, 0, 0.07); break;
    }
  };

  // ---------------- music ----------------
  // Day: gentle D major pentatonic arps over a slow pad. Night: D minor ostinato with drums by intensity.
  const DAY = { bpm: 76, prog: [[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52]], arp: [0, 1, 2, 1, 2, 0, 1, 2] };
  const NIGHT = { bpm: 104, prog: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], arp: [0, 2, 1, 2, 0, 2, 1, 0] };
  let nextT = 0, step = 0, timer = 0, playing = false;
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function mt(f, d, type, v, t, f2) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.08, d * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(musBus); o.start(t); o.stop(t + d + 0.05);
  }
  function mn(d, v, type, freq, t, f2) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + d * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(musBus); s.start(t); s.stop(t + d + 0.05);
  }
  function playStep(s, t) {
    const M = A.mode === 'night' ? NIGHT : DAY, ST = 60 / M.bpm / 4;
    const bar = (s >> 4) & 3, s16 = s & 15, ch = M.prog[bar], I = A.intensity;
    if (A.mode === 'day') {
      if (s16 === 0) for (let i = 0; i < 3; i++) mt(mtof(ch[i] + 12), ST * 16, 'triangle', 0.028, t);
      if (s16 === 0 || s16 === 10) mt(mtof(ch[0] - 12), ST * 6, 'sine', 0.12, t);
      if ((s16 & 1) === 0 && (s16 % 6 !== 4)) mt(mtof(ch[M.arp[(s16 >> 1) & 7]] + 24), ST * 2.4, 'sine', 0.03, t);
      if (s16 === 0 && bar % 2 === 0) mn(ST * 30, 0.045, 'lowpass', 320, t, 1300); // surf
      return;
    }
    if (s16 === 0) for (let i = 0; i < 3; i++) mt(mtof(ch[i]), ST * 16, 'sawtooth', 0.012, t);
    if (s16 % 4 === 0 || s16 === 14) mt(mtof(ch[0] - 12), ST * 2.5, 'triangle', 0.14, t);
    if ((s16 & 1) === 0) mt(mtof(ch[M.arp[(s16 >> 1) & 7]] + 12), ST * 1.5, 'square', I >= 1 ? 0.018 : 0.012, t);
    if (s16 === 0 || s16 === 8 || (I >= 2 && s16 === 11)) mt(120, 0.24, 'sine', 0.26, t, 38);
    if (s16 === 4 || s16 === 12) mn(0.14, I >= 1 ? 0.08 : 0.05, 'bandpass', 1700, t);
    if (I >= 1 && (s16 & 1) === 1) mn(0.04, 0.035, 'highpass', 7500, t);
    if (I >= 3 && (s16 === 6 || s16 === 15)) mt(mtof(ch[2] + 24), ST * 2, 'sawtooth', 0.02, t, mtof(ch[2] + 23));
  }
  function sched() {
    if (!ac || !playing || ac.state !== 'running') return;
    const M = A.mode === 'night' ? NIGHT : DAY, ST = 60 / M.bpm / 4;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.3) { playStep(step, nextT); nextT += ST; step = (step + 1) & 127; }
  }
  A.startMusic = function (mode) {
    if (mode) { if (mode !== A.mode) step = 0; A.mode = mode; }
    if (!ac) return;
    if (!playing) { playing = true; step = 0; nextT = ac.currentTime + 0.1; }
    if (!timer) timer = setInterval(sched, 70);
  };
  A.stopMusic = function () { playing = false; if (timer) { clearInterval(timer); timer = 0; } };
  A.setIntensity = function (i) { A.intensity = i; };
})(window.TW = window.TW || {});
