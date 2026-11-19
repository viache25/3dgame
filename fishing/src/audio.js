// Every sound is made on the spot from noise and oscillators; there are no recordings.
const SFX = (function () {
  let ac = null, out = null, bus = null, noise = null, motor = null, motorG = null, whine = null, whineG = null, muted = false, lastTick = 0;
  function start() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    out = ac.createGain(); out.gain.value = muted ? 0 : 0.9;
    bus = ac.createDynamicsCompressor(); bus.connect(out); out.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the sea: slow breathing noise
    const sea = ac.createBufferSource(); sea.buffer = noise; sea.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const sg = ac.createGain(); sg.gain.value = 0.05;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.17; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(sg.gain); lfo.start();
    sea.connect(f); f.connect(sg); sg.connect(bus); sea.start();
    // the outboard and the singing line run all the time and are only turned up and down
    motor = ac.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 50; motorG = ac.createGain(); motorG.gain.value = 0;
    const mf = ac.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 320; motor.connect(mf); mf.connect(motorG); motorG.connect(bus); motor.start();
    whine = ac.createOscillator(); whine.type = 'triangle'; whine.frequency.value = 400; whineG = ac.createGain(); whineG.gain.value = 0; whine.connect(whineG); whineG.connect(bus); whine.start();
  }
  const now = () => ac.currentTime, ok = () => ac && !muted && ac.state === 'running';
  function burst(freq, q, type, dur, vol, sweepTo, delay) {
    const t = now() + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(freq, dur, vol, type, to, delay) {
    const t = now() + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  return {
    start,
    mute(m) { muted = m; if (out) out.gain.value = m ? 0 : 0.9; },
    // called every frame: boat speed 0..1, line tension 0..1 (0 when nothing is hooked), whether the reel turns
    live(speed, tension, reeling) {
      if (!ac) return;
      const t = now();
      motor.frequency.setTargetAtTime(48 + speed * 70, t, 0.1); motorG.gain.setTargetAtTime(0.03 + speed * 0.09, t, 0.1);
      whine.frequency.setTargetAtTime(300 + tension * 900, t, 0.05); whineG.gain.setTargetAtTime(tension > 0.55 ? (tension - 0.55) * 0.22 : 0, t, 0.05);
      if (reeling && ok() && t - lastTick > 0.055) { lastTick = t; tone(1900 + Math.random() * 300, 0.025, 0.05, 'square'); }
    },
    cast() { if (ok()) burst(700, 1.5, 'bandpass', 0.28, 0.25, 4200); },
    plop() { if (ok()) { tone(420, 0.14, 0.25, 'sine', 140); burst(1800, 0.7, 'highpass', 0.12, 0.12); } },
    splash(v) { if (ok()) burst(1200, 0.5, 'lowpass', 0.35, Math.min(0.4, v), 300); },
    bite() { if (ok()) { tone(660, 0.08, 0.25, 'square'); tone(990, 0.12, 0.25, 'square', 0, 0.08); } },
    warn() { if (ok()) { tone(880, 0.09, 0.22, 'sawtooth'); tone(880, 0.09, 0.22, 'sawtooth', 0, 0.13); } },
    yank() { if (ok()) { tone(520, 0.12, 0.25, 'triangle', 1040); } },
    snap() { if (ok()) { tone(1400, 0.2, 0.4, 'sawtooth', 90); burst(3000, 0.8, 'highpass', 0.08, 0.3); } },
    // the bigger the catch, the longer the run of notes
    win(n) { if (ok()) [523, 659, 784, 1047, 1319, 1568].slice(0, 3 + Math.min(3, n)).forEach((f, i) => tone(f, 0.16, 0.2, 'triangle', 0, i * 0.07)); },
    shark() { if (ok()) { tone(82, 0.5, 0.35, 'sawtooth'); tone(87, 0.5, 0.35, 'sawtooth', 0, 0.55); } },
    chomp() { if (ok()) { burst(500, 0.8, 'lowpass', 0.25, 0.5, 90); tone(120, 0.3, 0.4, 'square', 50); } },
    ram() { if (ok()) { burst(300, 0.7, 'lowpass', 0.3, 0.5, 80); tone(220, 0.25, 0.3, 'triangle', 660); } },
    over() { if (ok()) [784, 659, 523, 392].forEach((f, i) => tone(f, 0.3, 0.22, 'triangle', 0, i * 0.16)); },
  };
})();
