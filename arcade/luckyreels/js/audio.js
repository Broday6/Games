'use strict';
// LUCKY REELS — procedural WebAudio: slot machine SFX, jackpot fanfare and a light lounge loop.
(function (LR) {
  let ac = null, master = null, sfx = null, mus = null, noiseBuf = null;
  const A = LR.Audio = { sfxOn: true, musicOn: true };
  const last = Object.create(null);

  A.unlock = function () {
    if (!ac) {
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        ac = new C();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -12; comp.knee.value = 16; comp.ratio.value = 4;
        master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
        sfx = ac.createGain(); sfx.gain.value = A.sfxOn ? 0.6 : 0; sfx.connect(master);
        mus = ac.createGain(); mus.gain.value = A.musicOn ? 0.22 : 0; mus.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } }
    if (A.musicOn) A.startMusic();
  };
  A.suspend = function () { try { if (ac && ac.state === 'running') ac.suspend(); } catch (e) { /* ignore */ } };
  A.resume = function () { try { if (ac && ac.state === 'suspended') ac.resume(); } catch (e) { /* ignore */ } };
  function ramp(gn, v) { if (!ac) return; const t = ac.currentTime; gn.gain.cancelScheduledValues(t); gn.gain.setTargetAtTime(v, t, 0.06); }
  A.setSfx = function (on) { A.sfxOn = on; if (sfx) ramp(sfx, on ? 0.6 : 0); };
  A.setMusic = function (on) { A.musicOn = on; if (mus) ramp(mus, on ? 0.22 : 0); if (on) A.startMusic(); };

  function gap(n, s) { const t = ac.currentTime; if (last[n] !== undefined && t - last[n] < s) return false; last[n] = t; return true; }
  function tone(f, d, type, v, f2, delay, dest) {
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v, t + 0.006); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(dest || sfx); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v, ft, freq, q, delay, f2, dest) {
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ac.createBiquadFilter(); f.type = ft || 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
    f.Q.value = q || 0.8;
    const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(gn); gn.connect(dest || sfx); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  function bell(f, v, delay, d) { tone(f, d || 0.5, 'sine', v, 0, delay); tone(f * 2.76, (d || 0.5) * 0.4, 'sine', v * 0.25, 0, delay); tone(f * 5.4, (d || 0.5) * 0.2, 'sine', v * 0.1, 0, delay); }

  A.play = function (name, p) {
    if (!ac || !A.sfxOn || ac.state !== 'running') return;
    switch (name) {
      case 'click': tone(700, 0.05, 'triangle', 0.07); break;
      case 'spin':
        noise(0.5, 0.12, 'bandpass', 500, 1.5, 0, 2600);
        tone(140, 0.3, 'square', 0.04, 70);
        for (let i = 0; i < 6; i++) noise(0.025, 0.08, 'highpass', 3500, 1, 0.04 + i * 0.05);
        break;
      case 'tick': if (gap(name, 0.035)) noise(0.02, 0.06, 'highpass', 4000); break;
      case 'stop': { const k = p || 0; tone(220 - k * 12, 0.12, 'square', 0.06, 90); noise(0.07, 0.16, 'lowpass', 900); tone(1200 + k * 120, 0.05, 'triangle', 0.04); break; }
      case 'pay': { const k = Math.min(p || 0, 24); const f = 660 * Math.pow(2, (k % 12) / 12 + (k >= 12 ? 0.5 : 0)); bell(f, 0.09, 0, 0.28); break; }
      case 'big': [0, 4, 7].forEach((s, i) => bell(523 * Math.pow(2, s / 12), 0.08, i * 0.05, 0.5)); break;
      case 'coin': if (gap(name, 0.03)) tone(2093 + Math.random() * 300, 0.06, 'square', 0.025, 2600); break;
      case 'boost': if (gap(name, 0.05)) { tone(400, 0.16, 'triangle', 0.07, 1100); tone(800, 0.12, 'sine', 0.04, 1600, 0.04); } break;
      case 'mult': if (gap(name, 0.05)) { tone(300, 0.22, 'sawtooth', 0.04, 1200); tone(600, 0.2, 'triangle', 0.07, 2000, 0.03); } break;
      case 'eat': if (gap(name, 0.05)) { noise(0.08, 0.2, 'lowpass', 700, 2); tone(180, 0.08, 'square', 0.05, 90, 0.06); noise(0.06, 0.14, 'lowpass', 600, 2, 0.1); } break;
      case 'boom': noise(0.7, 0.4, 'lowpass', 1400, 1, 0, 80); tone(90, 0.5, 'sawtooth', 0.12, 30); break;
      case 'xf': [0, 4, 7, 12].forEach((s, i) => tone(880 * Math.pow(2, s / 12), 0.14, 'sine', 0.05, 0, i * 0.04)); break;
      case 'add': tone(520, 0.08, 'sine', 0.08, 1040); break;
      case 'grow': tone(392, 0.14, 'triangle', 0.07, 784); break;
      case 'steal': noise(0.18, 0.1, 'bandpass', 1500, 2, 0, 400); tone(900, 0.1, 'triangle', 0.03, 400); break;
      case 'gone': tone(900, 0.06, 'sine', 0.07, 1800); noise(0.05, 0.06, 'highpass', 3000); break;
      case 'loot': noise(0.3, 0.12, 'bandpass', 700, 3, 0, 2400); [784, 988, 1175, 1568].forEach((f, i) => bell(f, 0.06, 0.08 + i * 0.05, 0.3)); break;
      case 'token': tone(1046, 0.1, 'triangle', 0.07); tone(1568, 0.16, 'sine', 0.06, 0, 0.07); break;
      case 'roll': for (let i = 0; i < 3; i++) noise(0.03, 0.1, 'bandpass', 2000 + i * 400, 3, i * 0.045); break;
      case 'pick': tone(784, 0.08, 'triangle', 0.09); tone(1175, 0.18, 'sine', 0.08, 0, 0.06); break;
      case 'skip': tone(392, 0.1, 'triangle', 0.06, 330); break;
      case 'deny': tone(180, 0.15, 'square', 0.05, 140); break;
      case 'remove': noise(0.2, 0.12, 'bandpass', 900, 2, 0, 300); tone(300, 0.15, 'triangle', 0.06, 150); break;
      case 'rent':
        bell(1568, 0.08, 0, 0.6); noise(0.25, 0.1, 'bandpass', 2400, 4, 0.08);
        for (let i = 0; i < 8; i++) tone(1800 + Math.random() * 900, 0.05, 'square', 0.02, 0, 0.12 + i * 0.035);
        break;
      case 'jackpot': {
        const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
        seq.forEach((f, i) => { tone(f, 0.22, 'square', 0.035, 0, i * 0.09); bell(f, 0.06, i * 0.09, 0.4); });
        for (let i = 0; i < 18; i++) tone(2000 + Math.random() * 1200, 0.05, 'square', 0.018, 0, 0.75 + i * 0.04);
        break;
      }
      case 'win': {
        const seq = [[523, 0], [659, 0.15], [784, 0.3], [1047, 0.45], [988, 0.75], [1047, 0.9], [1319, 1.05], [1568, 1.35]];
        seq.forEach(([f, t]) => { tone(f, 0.4, 'triangle', 0.09, 0, t); tone(f / 2, 0.4, 'sine', 0.06, 0, t); bell(f * 2, 0.03, t, 0.4); });
        break;
      }
      case 'lose': [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.35, 'sawtooth', 0.05, i === 3 ? 220 : 0, i * 0.32)); break;
      case 'floor': [523, 784, 1047].forEach((f, i) => bell(f, 0.07, i * 0.08, 0.5)); break;
    }
  };

  // ---------------- music: light lounge loop ----------------
  const BPM = 96, BEAT = 60 / BPM;
  // Cmaj7, Am7, Dm7, G7 voicings (midi)
  const CH = [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]];
  const BASS = [[36, 40, 43, 45], [33, 36, 40, 43], [38, 41, 45, 43], [31, 35, 38, 41]];
  const PENT = [72, 74, 76, 79, 81, 84];
  let nextT = 0, beat = 0, timer = 0, playing = false;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function mtone(f, d, type, v, t, att) {
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v, t + (att || 0.01)); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(mus); o.start(t); o.stop(t + d + 0.05);
  }
  function mnoise(d, v, freq, t) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v, t + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(gn); gn.connect(mus); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  let melRand = 12345;
  const mr = () => { melRand = (melRand * 1103515245 + 12345) & 0x7fffffff; return melRand / 0x7fffffff; };
  function playBeat(b, t) {
    const bar = (b >> 2) & 3, q = b & 3, ch = CH[bar];
    // rhodes comp: on beat 1 and the "and" of 2
    if (q === 0) for (const m of ch) { mtone(mtof(m), BEAT * 1.6, 'sine', 0.05, t, 0.02); mtone(mtof(m + 12), BEAT * 0.5, 'triangle', 0.01, t); }
    if (q === 1) for (const m of ch) mtone(mtof(m), BEAT * 0.8, 'sine', 0.03, t + BEAT * 0.66, 0.02);
    // walking bass
    mtone(mtof(BASS[bar][q]), BEAT * 0.9, 'triangle', 0.16, t, 0.01);
    // brushed hats, swung
    mnoise(0.05, 0.03, 7000, t); mnoise(0.04, 0.018, 8000, t + BEAT * 0.66);
    if (q === 1 || q === 3) mnoise(0.12, 0.025, 2500, t);
    // occasional vibes melody
    if (((b >> 4) & 1) && mr() < 0.55) {
      const m = PENT[Math.floor(mr() * PENT.length)];
      mtone(mtof(m), BEAT * 1.2, 'sine', 0.035, t + (mr() < 0.5 ? 0 : BEAT * 0.66), 0.01);
    }
  }
  function sched() {
    if (!ac || !playing || ac.state !== 'running') return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.35) { playBeat(beat, nextT); nextT += BEAT; beat = (beat + 1) & 63; }
  }
  A.startMusic = function () {
    if (!ac || !A.musicOn) return;
    if (!playing) { playing = true; beat = 0; nextT = ac.currentTime + 0.1; }
    if (!timer) timer = setInterval(sched, 80);
  };
  A.stopMusic = function () { playing = false; if (timer) { clearInterval(timer); timer = 0; } };
})(window.LR = window.LR || {});
