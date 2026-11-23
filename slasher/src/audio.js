// Every sound is made on the spot from noise and sine waves; there are no recordings.
const SFX = (function () {
  let ac = null, out = null, lp = null, fx = null, mus = null, noise = null, wind = null, lastThud = 0, muted = false, fxVol = 0.8, musVol = 0.45, heat = 0, beat = 0, nextT = 0, bed = null;
  function start() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    out = ac.createGain(); out.gain.value = 0.9;
    lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; // closes down while time is slowed
    const comp = ac.createDynamicsCompressor();
    lp.connect(comp); comp.connect(out); out.connect(ac.destination);
    fx = ac.createGain(); fx.gain.value = fxVol; fx.connect(lp);     // everything that happens
    mus = ac.createGain(); mus.gain.value = musVol; mus.connect(lp); // the track under it
    nextT = ac.currentTime + 0.15;
    setInterval(track, 70);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // wind over the flat: filtered noise that swells slowly
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    wind = ac.createGain(); wind.gain.value = 0.035;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 170;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    src.connect(f); f.connect(wind); wind.connect(fx); src.start();
    { // the blade burns all the time: a low bed of fire under everything, which swells when the blade moves
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), tr = ac.createGain(), m = ac.createBufferSource(), md = ac.createGain();
      s.buffer = noise; s.loop = true; s.playbackRate.value = 0.5; f.type = 'lowpass'; f.frequency.value = 620; f.Q.value = 0.8;
      m.buffer = noise; m.loop = true; m.playbackRate.value = 0.003; md.gain.value = 0.6; tr.gain.value = 1; m.connect(md); md.connect(tr.gain);
      bed = ac.createGain(); bed.gain.value = 0;
      s.connect(f); f.connect(tr); tr.connect(bed); bed.connect(fx); s.start(); m.start();
    }
  }
  // The track: four bars in D minor that play themselves. Out of a fight only the pad and a slow bass; in one, drums and a running line join in.
  const S16 = 60 / 104 / 4, ROOTS = [38, 38, 34, 36], BASS = [0, null, 0, null, 0, null, 3, null, 0, null, 0, 10, null, 7, 10, null], RUN = [0, 3, 7, 10, 12, 10, 7, 3];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function voice(type, freq, t, dur, vol, cut) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t + dur + 0.05);
  }
  function hit(freq, type, t, dur, vol) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = 0.9;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(mus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function track() {
    if (!ac || ac.state !== 'running') return;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05; // the tab was asleep: pick the beat up from now
    while (nextT < ac.currentTime + 0.25) {
      const s = beat % 16, root = ROOTS[Math.floor(beat / 16) % 4], t = nextT, hot = heat > 0.5, b = BASS[s];
      if (b !== null && (hot || s % 8 === 0)) voice('sawtooth', hz(root + b), t, S16 * 1.8, hot ? 0.2 : 0.13, hot ? 950 : 380);
      if (s === 0) for (const iv of [12, 19, 24, 27]) voice('triangle', hz(root + iv), t, S16 * 16.5, 0.04, 1500);
      if (hot) {
        if (s % 4 === 0) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.25); }
        if (s % 4 === 2) hit(7500, 'highpass', t, 0.04, 0.06);
        if (s === 4 || s === 12) hit(1900, 'bandpass', t, 0.12, 0.13);
        if (s % 2 === 0) voice('square', hz(root + 24 + RUN[(s / 2) % 8]), t, S16 * 0.95, 0.026, 2400);
      }
      nextT += S16; beat++;
    }
  }
  const now = () => ac.currentTime;
  // A blade through the air: a narrow band of noise whose pitch climbs and falls with the speed of the swing.
  function whoosh(dur, vol, f0, f1, delay) {
    const t = now() + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true;
    f.type = 'bandpass'; f.Q.value = 1.9;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4); f.frequency.exponentialRampToValueAtTime(f0 * 1.15, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(fx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // Fire. Dark noise through a filter that opens and closes, with slow noise riding on its level: that unevenness is what makes it a roar and not
  // a hiss. It swells fast, holds for nearly half its length, and only then dies away, so it is heard as a body of sound and not as a pop.
  function roar(dur, vol, lo, hi, delay) {
    const t = now() + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), body = ac.createBiquadFilter(), bg = ac.createGain(), tr = ac.createGain(), g = ac.createGain(), m = ac.createBufferSource(), md = ac.createGain();
    s.buffer = noise; s.loop = true; s.playbackRate.value = 0.45 + Math.random() * 0.3;
    f.type = 'lowpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(lo, t); f.frequency.exponentialRampToValueAtTime(hi, t + dur * 0.2); f.frequency.setValueAtTime(hi, t + dur * 0.4); f.frequency.exponentialRampToValueAtTime(lo * 0.7, t + dur);
    body.type = 'bandpass'; body.frequency.value = Math.min(520, lo * 1.6); body.Q.value = 1.6; bg.gain.value = 1.3; // the chest of the roar
    m.buffer = noise; m.loop = true; m.playbackRate.value = 0.004 + Math.random() * 0.006; md.gain.value = 0.9;
    tr.gain.value = 1; m.connect(md); md.connect(tr.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.12)); g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(tr); s.connect(body); body.connect(bg); bg.connect(tr); tr.connect(g); g.connect(fx);
    s.start(t, Math.random()); m.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
  }
  function burst(freq, q, type, dur, vol, sweepTo, delay) {
    const t = now() + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(fx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, vol, type, to, delay) {
    const t = now() + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(fx); o.start(t); o.stop(t + dur + 0.05);
  }
  const ok = () => ac && !muted && ac.state === 'running';
  return {
    start,
    mute(m) { muted = m; if (out) out.gain.value = m ? 0 : 0.9; },
    volume(v) { fxVol = v; if (fx) fx.gain.value = v; },
    musicVolume(v) { musVol = v; if (mus) mus.gain.value = v; },
    music(h) { heat = h; },
    blade(k) { if (bed) bed.gain.setTargetAtTime(k, ac.currentTime, 0.06); }, // how loud the fire on the blade is just now
    slow(k) { if (ac) lp.frequency.setTargetAtTime(k < 0.5 ? 1100 : 18000, now(), 0.08); },
    // a swing: the blade through the air, its edge, the steel singing a little, and under that the fire it carries
    swing(big) {
      if (!ok()) return;
      const k = big ? 1.35 : 1, p = 0.94 + Math.random() * 0.12;
      whoosh(0.2 * k, 0.6 * k, 520, 3000, 0); whoosh(0.13 * k, 0.24, 2400, 7200, 0.012);
      tone(2300 * p, 0.24 * k, 0.035, 'sine', 0, 0.02); tone(3650 * p, 0.17 * k, 0.02, 'sine', 0, 0.02);
      roar(0.32 * k, 0.34 * k, 260, 1300, 0.015);
    },
    // the blade going through: the bite, the ring of the steel, a little weight, and the fire let out; n is how many pieces it opened
    cut(n) {
      if (!ok()) return;
      const v = Math.min(1, 0.6 + n * 0.05), p = 0.94 + Math.random() * 0.12;
      burst(4200, 0.9, 'highpass', 0.06, 0.34 * v);
      tone(2140 * p, 0.34, 0.08 * v, 'sine'); tone(3390 * p, 0.25, 0.05 * v, 'sine'); tone(5230 * p, 0.15, 0.028 * v, 'sine');
      tone(96, 0.2, 0.3 * v, 'sine', 48);
      roar(0.42, 0.52 * v, 300, 1500, 0.02);
    },
    // the flame on the blade goes out
    hiss() { if (ok()) { burst(3200, 0.8, 'highpass', 0.55, 0.22, 700); tone(300, 0.4, 0.12, 'sine', 80); } },
    // a part hitting the ground: a clink of armour with a little weight, not a pop
    thud(speed) {
      if (!ok() || now() - lastThud < 0.075) return;
      lastThud = now();
      const v = Math.min(0.14, speed * 0.02);
      burst(1300 + Math.random() * 2200, 7, 'bandpass', 0.07, v * 1.6); burst(170, 0.8, 'lowpass', 0.07, v);
    },
    rise() { if (ok()) { burst(180, 0.9, 'lowpass', 0.9, 0.2, 520); tone(58, 0.9, 0.12, 'sawtooth', 96); } },
    windup() { if (ok()) tone(74, 0.42, 0.11, 'sawtooth', 148); },
    // one of many cuts in a row: each a little higher than the last
    flurry(i) { if (ok()) { const k = 1 + i * 0.05; roar(0.26, 0.55, 500 * k, 2600 * k, 0); tone(2400 * k, 0.12, 0.05, 'sine'); burst(5200 + i * 200, 0.9, 'highpass', 0.08, 0.1); } },
    // the blade goes home: a click, and then everything it passed through lets go
    sheath() { if (ok()) { tone(1900, 0.05, 0.3, 'square', 900); burst(2600, 2.0, 'bandpass', 0.05, 0.3); tone(70, 0.5, 0.5, 'sine', 30, 0.04); burst(500, 0.7, 'lowpass', 0.45, 0.45, 80, 0.04); } },
    // the whirl: the blade going round and round, each pass a little higher, over one long breath of fire
    vortex() { if (ok()) { roar(1.0, 0.8, 220, 2400, 0); for (let i = 0; i < 5; i++) whoosh(0.2, 0.5, 500 + i * 110, 2800 + i * 450, i * 0.155); tone(55, 0.9, 0.3, 'sine', 110); } },
    // fire let go all at once
    erupt() { if (ok()) { roar(0.9, 1.0, 160, 2600, 0); roar(0.5, 0.6, 700, 5200, 0.02); burst(300, 0.7, 'lowpass', 0.5, 0.6, 50); tone(60, 0.6, 0.55, 'sine', 28); } },
    wave() { if (ok()) { roar(1.1, 0.95, 200, 2200, 0); roar(0.8, 0.5, 900, 4200, 0.04); tone(70, 0.7, 0.4, 'sine', 34); } },
    shot() { if (ok()) { tone(1500, 0.14, 0.14, 'sawtooth', 300); burst(3000, 1.2, 'bandpass', 0.08, 0.14, 900); } },
    // steel meets steel and gives nothing
    parry() { if (ok()) { const k = 0.92 + Math.random() * 0.16; tone(3100 * k, 0.4, 0.2, 'sine'); tone(4650 * k, 0.3, 0.12, 'sine'); tone(1240 * k, 0.12, 0.2, 'square', 700); burst(6000, 0.8, 'highpass', 0.05, 0.25); } },
    quake() { if (ok()) { burst(300, 0.7, 'lowpass', 0.6, 0.55, 50); tone(52, 0.7, 0.5, 'sine', 26); tone(31, 0.9, 0.35, 'sine', 22, 0.03); } },
    slam() { if (ok()) { burst(420, 0.7, 'lowpass', 0.22, 0.4, 70); tone(64, 0.3, 0.4, 'sine', 34); } },
    hurt() { if (ok()) { tone(160, 0.28, 0.4, 'square', 52); burst(1500, 0.8, 'bandpass', 0.14, 0.25, 400); } },
    dash() { if (ok()) { roar(0.3, 0.4, 400, 2200, 0); burst(500, 0.9, 'bandpass', 0.2, 0.12, 2400); } },
    focus(on) { if (ok()) { tone(on ? 180 : 420, 0.5, 0.12, 'sine', on ? 420 : 160); } },
    gong() { if (ok()) for (const [f, v, d] of [[98, 0.3, 2.6], [147.5, 0.14, 2.0], [196.4, 0.1, 1.5], [262, 0.05, 1.1]]) tone(f, d, v, 'sine'); },
    fall() { if (ok()) { tone(220, 1.4, 0.3, 'sawtooth', 40); burst(300, 0.7, 'lowpass', 1.2, 0.3, 60); } },
  };
})();
