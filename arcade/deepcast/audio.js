'use strict';
// DEEP CAST — procedural WebAudio: ambience, sfx, gentle generative music.

const Sfx = (() => {
  let ac = null, master, sfxG, musG, ambG, rainG, waveG, noiseBuf, musIn;
  let soundOn = true, musicOn = true, night = false, timer = null, nextT = 0, step = 0, chordIx = 0, lastNote = 7;
  const tempo = 68, eighth = 60 / tempo / 2;

  function g(v, to) { const n = ac.createGain(); n.gain.value = v; if (to) n.connect(to); return n; }
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    master = g(soundOn ? 1 : 0, ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfxG = g(.75, comp); ambG = g(.7, comp); musG = g(musicOn ? .42 : 0, comp);
    // noise
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // waves: lowpassed noise swelling slowly
    const n1 = noise(true), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    waveG = g(.05); n1.connect(lp); lp.connect(waveG); waveG.connect(ambG);
    const lfo = ac.createOscillator(); lfo.frequency.value = .11; const lfoG = g(.035); lfo.connect(lfoG); lfoG.connect(waveG.gain); lfo.start();
    const n2 = noise(true), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = .6;
    const lap = g(.008); n2.connect(bp); bp.connect(lap); lap.connect(ambG);
    const lfo2 = ac.createOscillator(); lfo2.frequency.value = .23; const l2g = g(.006); lfo2.connect(l2g); l2g.connect(lap.gain); lfo2.start();
    // rain
    const n3 = noise(true), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
    rainG = g(0); n3.connect(hp); hp.connect(rainG); rainG.connect(ambG);
    // music bus with echo
    musIn = g(1, musG);
    const dl = ac.createDelay(1); dl.delayTime.value = eighth * 3; const fb = g(.32), dlp = ac.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
    musIn.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(g(.55, musG));
    nextT = ac.currentTime + .3;
    timer = setInterval(schedule, 90);
  }
  function noise(loop) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; if (loop) s.start(0, Math.random() * 1.5); return s; }
  function ok() { return ac && soundOn && ac.state === 'running'; }

  function tone(f, dur, type = 'sine', vol = .2, at = 0, to = sfxG, slideTo = 0, attack = .005) {
    if (!ac) return;
    const t = ac.currentTime + at, o = ac.createOscillator(), e = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + attack); e.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(e); e.connect(to); o.start(t); o.stop(t + dur + .05);
  }
  function burst(dur, f0, f1, vol, at = 0, type = 'lowpass', q = .7) {
    if (!ac) return;
    const t = ac.currentTime + at, s = noise(false), fl = ac.createBiquadFilter(), e = ac.createGain();
    fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(e); e.connect(sfxG); s.start(t, Math.random()); s.stop(t + dur + .05);
  }

  const api = {
    init,
    get on() { return soundOn; }, get music() { return musicOn; },
    setSound(v) { soundOn = v; if (master) master.gain.setTargetAtTime(v ? 1 : 0, ac.currentTime, .05); },
    setMusic(v) { musicOn = v; if (musG) musG.gain.setTargetAtTime(v ? .42 : 0, ac.currentTime, .3); },
    setNight(v) { night = v; },
    weather(rain, storm) { if (rainG) rainG.gain.setTargetAtTime(Math.min(.09, rain * .05 + storm * .05), ac.currentTime, 1.5); if (waveG) waveG.gain.setTargetAtTime(.05 + storm * .05, ac.currentTime, 2); },
    suspend() { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); },
    resume() { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); },
    ui() { if (!ok()) return; tone(660, .07, 'triangle', .08); },
    whoosh() { if (!ok()) return; burst(.45, 600, 3000, .12, 0, 'bandpass', 1.2); },
    splash(size = 1) { if (!ok()) return; burst(.35 + size * .25, 2400, 220, .22 * Math.min(1.6, size)); tone(300, .12, 'sine', .08 * size, 0, sfxG, 120); },
    plop() { if (!ok()) return; tone(520, .1, 'sine', .14, 0, sfxG, 180); },
    nibble() { if (!ok()) return; tone(420, .06, 'sine', .1, 0, sfxG, 300); burst(.08, 1500, 600, .05); },
    bite() { if (!ok()) return; tone(880, .12, 'square', .07); tone(1320, .18, 'square', .07, .1); burst(.25, 2600, 400, .16); },
    hook() { if (!ok()) return; tone(220, .15, 'sawtooth', .08, 0, sfxG, 440); },
    click(p = 1) { if (!ok()) return; tone(1500 + Math.random() * 300, .02, 'square', .025 * p); },
    strain() { if (!ok()) return; tone(160 + Math.random() * 40, .08, 'sawtooth', .025); },
    snap() { if (!ok()) return; tone(900, .25, 'triangle', .12, 0, sfxG, 120); burst(.2, 4000, 800, .1); },
    lose() { if (!ok()) return; [392, 330, 262].forEach((f, i) => tone(f, .3, 'triangle', .1, i * .13)); },
    coin() { if (!ok()) return; tone(1318, .1, 'square', .05); tone(1760, .22, 'square', .05, .07); },
    tick() { if (!ok()) return; tone(2200, .015, 'square', .02); },
    thunder(delay = 0) { if (!ok()) return; burst(2.6, 380, 50, .5, delay); burst(1.2, 900, 80, .2, delay + .1); },
    jingle(r = 0) {
      if (!ok()) return;
      const base = [523, 659, 784, 1046, 1318, 1568];
      const n = 3 + Math.min(3, r);
      for (let i = 0; i < n; i++) tone(base[i], .4 + i * .05, 'triangle', .12, i * .09);
      if (r >= 2) for (let i = 0; i < 6; i++) tone(2093 + Math.random() * 800, .25, 'sine', .04, .4 + i * .06);
      if (r >= 4) { tone(261, 1.6, 'sawtooth', .05, .2); tone(392, 1.6, 'triangle', .06, .2); }
    },
    fanfare() { if (!ok()) return; [784, 988, 1175, 1568].forEach((f, i) => tone(f, .3, 'square', .045, .15 + i * .08)); },
  };

  // --- generative music ---
  const DAY = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];   // major pentatonic
  const NIGHT = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22]; // minor pentatonic
  const CH_DAY = [0, -3, 5, 7], CH_NIGHT = [0, -4, -2, 3];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function voice(f, t, dur, vol, type) {
    const o = ac.createOscillator(), e = ac.createGain(); o.type = type; o.frequency.value = f;
    e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + .02); e.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(e); e.connect(musIn); o.start(t); o.stop(t + dur + .1);
  }
  function schedule() {
    if (!ac || ac.state !== 'running') return;
    if (nextT < ac.currentTime - .5) nextT = ac.currentTime + .05;
    while (nextT < ac.currentTime + .4) {
      if (musicOn) playStep(nextT);
      nextT += eighth; step++;
    }
  }
  function playStep(t) {
    const sc = night ? NIGHT : DAY, chords = night ? CH_NIGHT : CH_DAY, root = night ? 57 : 60;
    if (step % 16 === 0) {
      chordIx = (chordIx + 1) % chords.length;
      const c = root - 12 + chords[chordIx];
      for (const iv of [0, 7, night ? 15 : 16]) {
        const o = ac.createOscillator(), e = ac.createGain(); o.type = 'sine'; o.frequency.value = mtof(c + iv);
        e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(.028, t + 1.6); e.gain.linearRampToValueAtTime(0, t + eighth * 16 + .4);
        o.connect(e); e.connect(musIn); o.start(t); o.stop(t + eighth * 16 + .5);
      }
      voice(mtof(c - 12), t, 2.2, .05, 'triangle');
    }
    const density = night ? .28 : .4;
    if (Math.random() < density && step % 2 === 0 || Math.random() < density * .3) {
      lastNote = Math.max(0, Math.min(sc.length - 1, lastNote + Math.round((Math.random() - .5) * 4)));
      voice(mtof(root + sc[lastNote] + chords[chordIx] % 12 * 0), t, 1.4, .055, 'triangle');
      if (Math.random() < .2) voice(mtof(root + 12 + sc[lastNote]), t + eighth * .5, .8, .02, 'sine');
    }
  }
  return api;
})();
