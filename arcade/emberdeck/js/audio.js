'use strict';
// EMBER DECK — procedural WebAudio SFX and a moody generative ambient loop.
(function (root) {
  const ED = root.ED;
  let ac = null, master = null, sfx = null, mus = null, noiseBuf = null, musFilter = null, delay = null;
  const A = ED.Audio = { sfxOn: true, musicOn: true, mode: 'menu' };
  const last = Object.create(null);

  A.unlock = function () {
    if (!ac) {
      try {
        const C = root.AudioContext || root.webkitAudioContext;
        if (!C) return;
        ac = new C();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 4;
        master = ac.createGain(); master.gain.value = 0.9;
        master.connect(comp); comp.connect(ac.destination);
        sfx = ac.createGain(); sfx.gain.value = A.sfxOn ? 0.55 : 0; sfx.connect(master);
        musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 2200;
        mus = ac.createGain(); mus.gain.value = A.musicOn ? 0.32 : 0;
        delay = ac.createDelay(1.5); delay.delayTime.value = 0.42;
        const fb = ac.createGain(); fb.gain.value = 0.38;
        const dl = ac.createGain(); dl.gain.value = 0.5;
        delay.connect(fb); fb.connect(delay); delay.connect(dl); dl.connect(musFilter);
        mus.connect(musFilter); musFilter.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { ac = null; return; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } }
    if (A.musicOn && !playing) A.startMusic();
  };
  const ok = () => ac && ac.state === 'running';
  function ramp(g, v) { if (!ac) return; const t = ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(v, t, 0.08); }
  A.setSfx = function (on) { A.sfxOn = on; if (sfx) ramp(sfx, on ? 0.55 : 0); };
  A.setMusic = function (on) { A.musicOn = on; if (mus) ramp(mus, on ? 0.32 : 0); if (on) A.startMusic(); };
  A.duck = function (on) { if (musFilter && ac) musFilter.frequency.setTargetAtTime(on ? 600 : 2200, ac.currentTime, 0.15); };

  function gap(n, s) { const t = ac.currentTime; if (last[n] !== undefined && t - last[n] < s) return false; last[n] = t; return true; }
  function tone(f, d, type, v, f2, dl, dest) {
    const t = ac.currentTime + (dl || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || sfx); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, v, type, freq, q, dl, f2, dest) {
    const t = ac.currentTime + (dl || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + d);
    f.Q.value = q || 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(dest || sfx); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  A.play = function (n, p) {
    if (!ok() || !A.sfxOn) return;
    p = p || 0;
    switch (n) {
      case 'click': tone(700, 0.05, 'triangle', 0.05); break;
      case 'select': tone(520, 0.06, 'triangle', 0.06); tone(780, 0.08, 'sine', 0.04, 0, 0.03); break;
      case 'draw': if (gap(n, 0.04)) noise(0.08, 0.06, 'highpass', 3000, 0.7, 0, 6000); break;
      case 'play': noise(0.16, 0.12, 'bandpass', 900, 1.2, 0, 3200); break;
      case 'shuffle': for (let i = 0; i < 6; i++) noise(0.04, 0.05, 'highpass', 2500, 1, i * 0.035); break;
      case 'hit': if (gap(n, 0.04)) { noise(0.12, 0.22 + Math.min(0.15, p * 0.006), 'lowpass', 1400, 1, 0, 300); tone(140, 0.14, 'sine', 0.18, 60); } break;
      case 'bighit': noise(0.35, 0.32, 'lowpass', 2200, 1, 0, 150); tone(90, 0.4, 'sine', 0.28, 40); tone(60, 0.5, 'triangle', 0.15, 30); break;
      case 'blocked': if (gap(n, 0.05)) { tone(1400, 0.12, 'square', 0.04, 900); noise(0.08, 0.1, 'bandpass', 3500, 4); } break;
      case 'block': if (gap(n, 0.06)) { tone(880, 0.14, 'triangle', 0.06); tone(1320, 0.22, 'sine', 0.04, 0, 0.04); noise(0.1, 0.04, 'highpass', 5000); } break;
      case 'poison': if (gap(n, 0.08)) for (let i = 0; i < 3; i++) tone(300 + Math.random() * 300, 0.07, 'sine', 0.06, 700, i * 0.05); break;
      case 'burn': if (gap(n, 0.08)) { noise(0.35, 0.12, 'bandpass', 1800, 0.8, 0, 600); for (let i = 0; i < 4; i++) noise(0.02, 0.08, 'highpass', 4000, 1, Math.random() * 0.25); } break;
      case 'buff': tone(392, 0.2, 'triangle', 0.06, 784); tone(587, 0.25, 'sine', 0.04, 1174, 0.05); break;
      case 'debuff': tone(500, 0.3, 'sawtooth', 0.03, 180); tone(300, 0.35, 'triangle', 0.05, 120, 0.04); break;
      case 'energy': tone(660, 0.1, 'square', 0.03, 990); break;
      case 'endturn': tone(196, 0.5, 'triangle', 0.07); tone(294, 0.6, 'sine', 0.04, 0, 0.02); break;
      case 'yourturn': tone(523, 0.2, 'triangle', 0.06); tone(784, 0.3, 'triangle', 0.05, 0, 0.08); break;
      case 'enemyatk': noise(0.18, 0.1, 'bandpass', 600, 1, 0, 2000); break;
      case 'die': noise(0.8, 0.18, 'lowpass', 2000, 1, 0, 120); tone(220, 0.7, 'sawtooth', 0.04, 55); break;
      case 'relic': tone(1047, 0.25, 'sine', 0.06); tone(1568, 0.35, 'sine', 0.04, 0, 0.06); tone(2093, 0.4, 'sine', 0.02, 0, 0.12); break;
      case 'gold': for (let i = 0; i < 4; i++) tone(1568 + i * 220, 0.08, 'square', 0.025, 2093, i * 0.05); break;
      case 'potion': for (let i = 0; i < 4; i++) tone(260 + i * 90, 0.09, 'sine', 0.08, 180, i * 0.06); break;
      case 'heal': tone(523, 0.3, 'sine', 0.07); tone(659, 0.35, 'sine', 0.06, 0, 0.08); tone(784, 0.45, 'sine', 0.05, 0, 0.16); break;
      case 'exhaust': noise(0.4, 0.12, 'bandpass', 1200, 0.9, 0, 4000); tone(300, 0.3, 'sawtooth', 0.02, 900); break;
      case 'upgrade': for (let i = 0; i < 5; i++) tone(880 * Math.pow(1.19, i), 0.15, 'triangle', 0.05, 0, i * 0.05); break;
      case 'deny': tone(180, 0.15, 'square', 0.05, 140); break;
      case 'step': noise(0.1, 0.07, 'lowpass', 700, 1); break;
      case 'shop': tone(1319, 0.3, 'sine', 0.06); tone(1760, 0.4, 'sine', 0.05, 0, 0.1); break;
      case 'chest': noise(0.5, 0.12, 'bandpass', 500, 3, 0, 2400); tone(196, 0.3, 'triangle', 0.1, 392); break;
      case 'phase': tone(70, 1.4, 'sawtooth', 0.14, 40); noise(1.4, 0.22, 'lowpass', 200, 1, 0, 1400); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.45, 'triangle', 0.08, 0, i * 0.12)); break;
      case 'bigwin': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 'triangle', 0.08, 0, i * 0.13)); break;
      case 'lose': [392, 349, 311, 233].forEach((f, i) => tone(f, 0.6, 'triangle', 0.08, 0, i * 0.25)); break;
      case 'fire': noise(0.5, 0.06, 'bandpass', 900, 0.6); break;
    }
  };

  // ---------------- ambient music ----------------
  // D minor drift: Dm, Bb, F, A(m) ; slow pads, sparse bells through a delay, sea-wash noise.
  const PROG = { menu: [[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [45, 52, 57, 61]],
    boss: [[50, 56, 62, 65], [49, 56, 61, 64], [47, 53, 59, 62], [45, 51, 57, 60]] };
  const SCALE = [62, 64, 65, 67, 69, 70, 72, 74, 77];
  let playing = false, timer = 0, nextT = 0, step = 0;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function pad(f, t, d, v) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 1.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + d);
    o.connect(g); o2.connect(g); g.connect(mus); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1);
  }
  function bell(f, t, v) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g); g.connect(mus); g.connect(delay); o.start(t); o.stop(t + 2.3);
  }
  function wash(t, d, v) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(250, t); f.frequency.linearRampToValueAtTime(900, t + d * 0.5); f.frequency.linearRampToValueAtTime(250, t + d);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(mus); s.start(t); s.stop(t + d + 0.1);
  }
  const BEAT = 0.5; // seconds per step (slow)
  function playStep(s, t) {
    const boss = A.mode === 'boss', combat = A.mode === 'combat' || boss;
    const prog = boss ? PROG.boss : PROG.menu;
    const bar = Math.floor(s / 8) % 4, s8 = s % 8;
    const ch = prog[bar];
    if (s8 === 0) {
      pad(mtof(ch[0] - 12), t, BEAT * 8.4, boss ? 0.09 : 0.07);
      for (let i = 1; i < 4; i++) pad(mtof(ch[i]), t + i * 0.04, BEAT * 8.2, 0.035);
    }
    if (s8 === 0 && bar % 2 === 0) wash(t, BEAT * 14, 0.05);
    const r = Math.random();
    if ((s8 === 2 || s8 === 5 || s8 === 7) && r < (combat ? 0.45 : 0.35)) {
      const n = SCALE[Math.floor(Math.random() * SCALE.length)] + (Math.random() < 0.3 ? 12 : 0);
      bell(mtof(n), t, 0.035);
    }
    if (combat && (s8 === 0 || s8 === 4)) { // heartbeat pulse
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(boss ? 62 : 70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(boss ? 0.32 : 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.35);
    }
  }
  function sched() {
    if (!ac || !playing || ac.state !== 'running') return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.6) { playStep(step, nextT); nextT += BEAT; step++; }
  }
  A.startMusic = function () {
    if (!ac) return;
    if (!playing) { playing = true; nextT = ac.currentTime + 0.1; }
    if (!timer) timer = setInterval(sched, 150);
  };
  A.stopMusic = function () { playing = false; if (timer) { clearInterval(timer); timer = 0; } };
  A.setMode = function (m) { A.mode = m; };
})(typeof window !== 'undefined' ? window : globalThis);
