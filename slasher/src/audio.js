// Every sound is made on the spot from noise and sine waves; there are no recordings.
const SFX = (function () {
  let ac = null, out = null, lp = null, fx = null, mus = null, noise = null, wind = null, lastThud = 0, muted = false, fxVol = 0.8, musVol = 0.45, heat = 0, beat = 0, nextT = 0;
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
    music(h) { heat = h; }, // 0: quiet, between fights; 1: a fight is on
    slow(k) { if (ac) lp.frequency.setTargetAtTime(k < 0.5 ? 1100 : 18000, now(), 0.08); },
    swing() { if (ok()) burst(900, 1.2, 'bandpass', 0.16, 0.22, 3600); },
    // the blade going through: a ring of steel over a crack of clay; n is how many pieces it opened
    cut(n) {
      if (!ok()) return;
      const k = 0.94 + Math.random() * 0.14, v = Math.min(0.2, 0.09 + n * 0.012);
      tone(2140 * k, 0.34, v, 'sine'); tone(3390 * k, 0.26, v * 0.6, 'sine'); tone(5230 * k, 0.16, v * 0.35, 'sine');
      burst(5200, 0.8, 'highpass', 0.07, 0.18);
      burst(700, 0.7, 'lowpass', 0.2, Math.min(0.5, 0.2 + n * 0.03), 160, 0.01);
      tone(92, 0.22, Math.min(0.45, 0.16 + n * 0.03), 'sine', 46, 0.01);
    },
    thud(speed) {
      if (!ok() || now() - lastThud < 0.045) return;
      lastThud = now();
      const v = Math.min(0.32, speed * 0.045);
      burst(260 + Math.random() * 160, 0.8, 'lowpass', 0.11, v, 90); tone(70 + Math.random() * 30, 0.1, v * 0.8, 'sine', 40);
    },
    rise() { if (ok()) { burst(180, 0.9, 'lowpass', 0.9, 0.2, 520); tone(58, 0.9, 0.12, 'sawtooth', 96); } },
    windup() { if (ok()) tone(74, 0.42, 0.11, 'sawtooth', 148); },
    // one of many cuts in a row: each a little higher than the last
    flurry(i) { if (ok()) { const k = 1 + i * 0.045; tone(2400 * k, 0.16, 0.1, 'sine'); tone(3700 * k, 0.1, 0.06, 'sine'); burst(4200 + i * 180, 1.0, 'bandpass', 0.07, 0.16, 7000); } },
    // the blade goes home: a click, and then everything it passed through lets go
    sheath() { if (ok()) { tone(1900, 0.05, 0.3, 'square', 900); burst(2600, 2.0, 'bandpass', 0.05, 0.3); tone(70, 0.5, 0.5, 'sine', 30, 0.04); burst(500, 0.7, 'lowpass', 0.45, 0.45, 80, 0.04); } },
    wave() { if (ok()) { burst(500, 0.8, 'bandpass', 0.5, 0.3, 3200); tone(240, 0.5, 0.16, 'sawtooth', 620); } },
    shot() { if (ok()) { tone(1500, 0.14, 0.14, 'sawtooth', 300); burst(3000, 1.2, 'bandpass', 0.08, 0.14, 900); } },
    // steel meets steel and gives nothing
    parry() { if (ok()) { const k = 0.92 + Math.random() * 0.16; tone(3100 * k, 0.4, 0.2, 'sine'); tone(4650 * k, 0.3, 0.12, 'sine'); tone(1240 * k, 0.12, 0.2, 'square', 700); burst(6000, 0.8, 'highpass', 0.05, 0.25); } },
    quake() { if (ok()) { burst(300, 0.7, 'lowpass', 0.6, 0.55, 50); tone(52, 0.7, 0.5, 'sine', 26); tone(31, 0.9, 0.35, 'sine', 22, 0.03); } },
    slam() { if (ok()) { burst(420, 0.7, 'lowpass', 0.22, 0.4, 70); tone(64, 0.3, 0.4, 'sine', 34); } },
    hurt() { if (ok()) { tone(160, 0.28, 0.4, 'square', 52); burst(1500, 0.8, 'bandpass', 0.14, 0.25, 400); } },
    dash() { if (ok()) burst(500, 0.9, 'bandpass', 0.2, 0.2, 2400); },
    focus(on) { if (ok()) { tone(on ? 180 : 420, 0.5, 0.12, 'sine', on ? 420 : 160); } },
    gong() { if (ok()) for (const [f, v, d] of [[98, 0.3, 2.6], [147.5, 0.14, 2.0], [196.4, 0.1, 1.5], [262, 0.05, 1.1]]) tone(f, d, v, 'sine'); },
    fall() { if (ok()) { tone(220, 1.4, 0.3, 'sawtooth', 40); burst(300, 0.7, 'lowpass', 1.2, 0.3, 60); } },
  };
})();
