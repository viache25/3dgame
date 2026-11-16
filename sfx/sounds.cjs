'use strict';
// The fight's sound effects, synthesized. No samples, no music: struck metal is a bank of ringing modes, air is filtered noise,
// machines are oscillators with gear grit. Hoplite sits left of centre, Luna right.
const { SR, TAU, N, rng, smooth, expi, lerp, white, pink, bq, osc, partial, strike, thud, whoosh, servo, crackle, st, put, putSt, reverb, mapSt, finish } = require('./dsp.cjs');
const BLADE = [1, 1.48, 2.756, 3.42, 5.404, 6.9, 8.933, 11.2];
const PLATE = [1, 1.48, 1.73, 2.33, 2.66, 3.07, 3.91, 4.11, 4.72, 5.33, 6.3, 6.71, 7.6, 8.9, 10.2];
const TUBE = [1, 2.31, 3.95, 5.7];
const burst = (ms, seed, hp, dec) => { const n = N(ms / 1000), w = bq(white(n, seed), 'highpass', hp, 0.7); for (let i = 0; i < n; i++) w[i] *= Math.exp(-i / (SR * dec)); return w; };
const mul = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR, i / x.length); return x; };

const S = {};
S.click = () => {
  const s = st(0.3);
  const tick = (k) => {
    const m = new Float32Array(N(0.2));
    [[3150, 0.5, 0.035], [4720, 0.4, 0.05], [6480, 0.3, 0.04], [9300, 0.2, 0.025]].forEach(([f, a, d]) => partial(m, 0, f * k, a, d));
    burst(4, 31, 4000, 0.0006).forEach((v, i) => (m[i] += v * 0.9));
    mul(bq(white(N(0.05), 32), 'bandpass', 900 * k, 4), (t) => Math.exp(-t / 0.012) * 2.2).forEach((v, i) => (m[i] += v));
    partial(m, 0, 420 * k, 0.3, 0.01);
    return m;
  };
  put(s, tick(1), 0, 1, 0.3); put(s, tick(1.07), 0.055, 0.4, 0.3);
  return finish(reverb(s, { room: 0.5, wet: 0.1, tail: 0.4 }));
};
S.sheath = () => {
  const s = st(0.5), d = 0.26;
  put(s, mul(bq(white(N(d), 41), 'bandpass', (t) => expi(5200, 2400, t / d), 1.2), (t, u) => Math.min(1, t / 0.02) * (0.8 + 0.2 * Math.sin(TAU * 35 * t)) * (1 + 0.6 * u) * 1.7), 0, 0.7, 0.3);
  const m = new Float32Array(N(0.22));
  [[1900, 0.5, 0.05], [2850, 0.4, 0.06], [4100, 0.3, 0.04], [6200, 0.2, 0.03]].forEach(([f, a, dd]) => partial(m, 0, f, a, dd));
  thud(m, 0, { f0: 260, f1: 170, dec: 0.03, amp: 0.7 });
  burst(4, 43, 2000, 0.001).forEach((v, i) => (m[i] += v * 0.9));
  put(s, m, d + 0.005, 1, 0.3);
  return finish(reverb(s, { room: 0.55, wet: 0.12, tail: 0.5 }));
};
S.draw = () => {
  const s = st(2.2), d = 0.55, rough = bq(white(N(d), 52), 'lowpass', 60, 0.7);
  const scr = mul(bq(white(N(d), 51), 'bandpass', (t) => expi(2500, 7800, t / d), 2.5), (t, u) => Math.pow(u, 1.4) * (0.6 + 0.4 * Math.min(1, Math.abs(rough[Math.floor(t * SR)]) * 14)) * 3.2);
  const res = bq(scr, 'bandpass', 2360, 25), res2 = bq(scr, 'bandpass', 3540, 25);
  for (let i = 0; i < scr.length; i++) scr[i] += (res[i] + res2[i]) * 1.6;
  put(s, scr, 0, 0.75, 0.3);
  put(s, strike(2.15, { f0: 1180, ratios: BLADE, decay: 1.0, damp: 0.22, hit: 0, att: 0.09, at: 0.46, seed: 53 }), 0, 0.5, 0.3);
  return finish(reverb(s, { room: 0.8, wet: 0.22, tail: 1.2 }));
};
S.clang = (k = 1) => {
  const s = st(1.6);
  put(s, strike(1.6, { f0: 640 * k, ratios: [1, 1.5, 2.756, 3.9, 5.404, 6.8, 8.933, 13.34], decay: 0.6, damp: 0.3, hit: 0.9, hitMs: 3, seed: 61, tilt: 0.6, lowBelow: 1500, lowDecay: 0.4 }), 0, 1, 0.15);
  put(s, strike(0.6, { f0: 410 * k, ratios: TUBE, decay: 0.16, damp: 0.2, hit: 0.5, hitMs: 4, hitHp: 900, seed: 62, amp: 0.6 }), 0, 1, -0.1);
  put(s, whoosh(0.11, { fa: 5000, fb: 7000, fc: 6000, q: 3, peak: 0.15, rise: 1, fall: 2, seed: 63, gain: 0.35 }), 0.012, 1, 0.1);
  return finish(reverb(s, { room: 0.75, wet: 0.2, tail: 1 }));
};
S.shield = () => {
  const s = st(2.3);
  put(s, strike(2.3, { f0: 235, ratios: PLATE, decay: 0.75, damp: 0.22, tilt: 0.25, hit: 1.0, hitMs: 8, hitHp: 900, seed: 71, thud: { f0: 150, f1: 62, dec: 0.12, amp: 1.6 } }), 0, 1, -0.3);
  put(s, strike(0.8, { f0: 1500, ratios: [1, 2.756, 5.404], decay: 0.35, hit: 0.3, seed: 72, amp: 0.35 }), 0, 1, -0.1);
  put(s, crackle(0.4, { rate: 700, seed: 73, hp: 5000 }), 0.004, 0.5, [-0.4, 0.1]);
  return finish(reverb(s, { room: 0.84, wet: 0.24, tail: 1.4 }));
};
S.skid = () => {
  const dur = 0.9, s = st(dur), n = N(dur), w = white(n, 81), rough = bq(white(n, 82), 'lowpass', 45, 0.7);
  const drift = (f) => (t) => f * (1 - 0.18 * (t / dur));
  const a = bq(w, 'bandpass', drift(950), 6), b = bq(w, 'bandpass', drift(2150), 8), c = bq(w, 'bandpass', drift(3600), 7), h = bq(w, 'highpass', 1500, 0.7), lo = bq(pink(n, 83), 'lowpass', 180, 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n, e = Math.min(1, i / N(0.03)) * Math.pow(1 - u, 1.3); y[i] = ((a[i] * 2 + b[i] * 2.4 + c[i] * 1.8 + h[i] * 0.25) * (0.3 + 0.7 * Math.min(1, Math.abs(rough[i]) * 16)) + lo[i] * 2.5) * e; }
  put(s, y, 0, 1, [-0.1, -0.5]);
  return finish(reverb(s, { room: 0.6, wet: 0.12, tail: 0.5 }));
};
S.steps = () => {
  const s = st(1.3), r = rng(91);
  [0.04, 0.4, 0.69, 0.94].forEach((t, k) => {
    const m = new Float32Array(N(0.3));
    thud(m, 0, { f0: 88, f1: 46, dec: 0.07, amp: 1.5 });
    mul(bq(white(N(0.12), 92 + k), 'bandpass', 700, 1), (tt) => Math.exp(-tt / 0.035) * 1.3).forEach((v, i) => (m[i] += v));
    [1700, 2600, 3900, 5200].forEach((f, j) => partial(m, N(0.004), f * (1 + (r() - 0.5) * 0.1), 0.2 / (1 + j * 0.4), 0.04 + 0.03 * r()));
    for (let c = 0; c < 4; c++) burst(3, 95 + k * 7 + c, 3500, 0.0008).forEach((v, i) => { const at = N(0.01 + 0.08 * r()) + i; if (at < m.length) m[at] += v * 0.3; });
    put(s, m, t, 0.72 + 0.09 * k, lerp(-0.55, -0.15, k / 3));
  });
  return finish(reverb(s, { room: 0.65, wet: 0.14, tail: 0.6 }));
};
S.clash = () => {
  const s = st(2.6), T0 = 0.2;
  // the breath in before the blow
  const inh = whoosh(0.18, { fa: 1500, fb: 5000, fc: 5200, q: 1.1, peak: 0.97, rise: 3, fall: 1, seed: 101, gain: 0.5 });
  put(s, inh, 0, 0.6, -0.3); put(s, whoosh(0.18, { fa: 1700, fb: 5600, fc: 5800, q: 1.1, peak: 0.97, rise: 3, fall: 1, seed: 102, gain: 0.5 }), 0, 0.6, 0.3);
  const boom = new Float32Array(N(2.2));
  thud(boom, 0, { f0: 64, f1: 30, dec: 0.5, amp: 2.2 }); thud(boom, 0, { f0: 128, f1: 60, dec: 0.2, amp: 0.7 });
  burst(110, 103, 800, 0.016).forEach((v, i) => (boom[i] += v * 1.6));
  mul(bq(white(N(0.5), 104), 'bandpass', 300, 0.8), (t) => Math.exp(-t / 0.09) * 2.2).forEach((v, i) => (boom[i] += v));
  put(s, boom, T0, 1, 0);
  put(s, strike(2.3, { f0: 520, ratios: [1, 1.48, 2.756, 3.42, 5.404, 6.9, 8.933, 11.2, 13.344, 16], decay: 1.6, damp: 0.2, hit: 1, hitMs: 4, seed: 105, tilt: 0.5, lowBelow: 1200, lowDecay: 0.45 }), T0, 0.9, 0.25);
  put(s, strike(2.0, { f0: 880, ratios: [1, 2.2, 3.6, 5.1, 7.4, 9.3], decay: 1.1, damp: 0.25, hit: 0.6, seed: 106 }), T0, 0.7, -0.25);
  // the ring of the shock running out
  put(s, whoosh(0.75, { fa: 4200, fb: 3200, fc: 250, q: 0.9, peak: 0.06, rise: 1, fall: 1.3, seed: 107, gain: 0.7, body: 0.6 }), T0 + 0.02, 0.8, -0.5);
  put(s, whoosh(0.75, { fa: 4600, fb: 3400, fc: 270, q: 0.9, peak: 0.06, rise: 1, fall: 1.3, seed: 108, gain: 0.7, body: 0.6 }), T0 + 0.02, 0.8, 0.5);
  put(s, crackle(0.8, { rate: 900, seed: 109, hp: 4500 }), T0, 0.45, [-0.5, 0.5]);
  let o = reverb(s, { room: 0.9, damp: 0.25, wet: 0.3, tail: 2.2 });
  // the frame freezes: the tail closes down
  o = mapSt(o, (x) => bq(x, 'lowpass', (t) => (t < 1.35 ? 16000 : expi(16000, 650, (t - 1.35) / 0.7)), 0.8));
  return finish(o, 0.89, 0.5);
};
S.servoS = (k = 1) => {
  const s = st(0.42);
  const end = (m) => { burst(3, 111, 3000, 0.0006).forEach((v, i) => (m[m.length - N(0.004) + i - 1] += v * 0.5)); return m; };
  put(s, end(servo(0.2, { fa: 520 * k, fb: 880 * k, seed: 112, grit: 0.25, teeth: 5 })), 0, 0.8, 0.4);
  put(s, end(servo(0.075, { fa: 760 * k, fb: 640 * k, seed: 113, grit: 0.25, teeth: 5, up: 0.3, down: 0.3 })), 0.27, 0.6, 0.4);
  return finish(reverb(s, { room: 0.4, wet: 0.07, tail: 0.25 }));
};
S.servoL = (k = 1, pan = -0.4) => {
  const s = st(0.75), m = new Float32Array(N(0.2));
  put(s, mul(bq(white(N(0.14), 121), 'highpass', 3000, 0.7), (t) => Math.exp(-t / 0.05) * 0.5), 0, 1, pan);
  put(s, servo(0.5, { fa: 95 * k, fb: 172 * k, seed: 122, grit: 0.45, gearF: 1400, formant: 700, hp: 70, teeth: 9 }), 0.02, 0.9, pan);
  thud(m, 0, { f0: 115, f1: 68, dec: 0.04, amp: 1.2 });
  burst(4, 123, 1800, 0.001).forEach((v, i) => (m[i] += v * 0.7));
  partial(m, 0, 1450, 0.2, 0.03); partial(m, 0, 2300, 0.15, 0.025);
  put(s, m, 0.52, 1, pan);
  return finish(reverb(s, { room: 0.5, wet: 0.1, tail: 0.35 }));
};
S.eye = (k = 1) => {
  const s = st(0.85), m = new Float32Array(N(0.8));
  for (let c = 0; c < 3; c++) burst(3, 131 + c, 3500, 0.0007).forEach((v, i) => (m[N(0.012 * c) + i] += v * 0.5));
  whoosh(0.07, { fa: 2000, fb: 7000, fc: 7500, q: 2, peak: 0.8, rise: 1.5, fall: 1, seed: 134, gain: 0.35 }).forEach((v, i) => (m[i] += v));
  const fc = 1480 * k;
  for (let i = N(0.035); i < m.length; i++) { const t = (i - N(0.035)) / SR, idx = 2.2 * Math.exp(-t / 0.06), f = fc * (1 + 0.02 * Math.min(1, t / 0.1)); m[i] += 0.5 * Math.exp(-t / 0.2) * Math.sin(TAU * f * t + idx * Math.sin(TAU * f * 1.41 * t)) + 0.2 * Math.exp(-t / 0.12) * Math.sin(TAU * 2 * f * t); }
  thud(m, N(0.03), { f0: 62, f1: 50, dec: 0.09, amp: 0.7 });
  mul(bq(osc(N(0.22), 120, 'saw'), 'bandpass', 2000, 2), (t, u) => Math.sin(Math.PI * u) * 0.5).forEach((v, i) => (m[N(0.04) + i] += v));
  put(s, m, 0, 1, 0.4);
  return finish(reverb(s, { room: 0.6, wet: 0.16, tail: 0.5 }));
};
S.visor = () => {
  const dur = 0.9, s = st(dur), n = N(dur);
  const f = (t) => (t < 0.45 ? expi(70, 300, t / 0.45) : lerp(300, 285, (t - 0.45) / 0.45));
  const a = osc(n, f, 'saw'), b = osc(n, (t) => f(t) * 1.012, 'saw'), sub = osc(n, (t) => f(t) / 2, 'sin');
  let y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = (a[i] + b[i]) * 0.5 + sub[i] * 0.4;
  y = mul(bq(y, 'lowpass', (t) => expi(260, 5200, t / 0.5), 4.5), (t) => smooth(t / 0.08) * (t < 0.5 ? 0.55 + 0.45 * smooth(t / 0.5) : 1) * (0.7 + 0.3 * Math.sin(TAU * 55 * t)) * Math.min(1, (dur - t) / 0.09));
  put(s, y, 0, 0.8, -0.35);
  put(s, crackle(0.22, { rate: 900, seed: 141, hp: 4000 }), 0, 0.5, -0.35);
  return finish(reverb(s, { room: 0.5, wet: 0.1, tail: 0.4 }));
};
S.thrust = (k = 1) => {
  const dur = 0.45, s = st(dur), n = N(dur);
  put(s, whoosh(dur, { fa: 400 * k, fb: 2600 * k, fc: 700 * k, q: 1.3, peak: 0.4, rise: 2.2, fall: 1.5, seed: 151, body: 0.5 }), 0, 1, [-0.5, 0.25]);
  const hum = mul(bq(osc(n, (t) => (t < 0.18 ? lerp(190, 285, t / 0.18) : lerp(285, 200, (t - 0.18) / 0.27)) * k, 'saw'), 'bandpass', 900, 2), (t, u) => Math.pow(Math.sin(Math.PI * u), 1.5) * (0.6 + 0.4 * Math.sin(TAU * 45 * t)) * 0.8);
  put(s, hum, 0, 1, [-0.5, 0.25]);
  return finish(reverb(s, { room: 0.5, wet: 0.08, tail: 0.3 }));
};
S.iai = () => {
  const s = st(1.9), T0 = 0.09;
  put(s, mul(bq(white(N(T0), 161), 'highpass', 6000, 0.7), (t, u) => u * u * 0.3), 0, 1, 0.5);
  put(s, whoosh(0.1, { fa: 2500, fb: 9500, fc: 6000, q: 3, peak: 0.3, rise: 1.5, fall: 1.8, seed: 162 }), T0, 1, [0.6, -0.5]);
  put(s, strike(1.8, { f0: 2240, ratios: [1, 1.59, 2.4, 3.5, 4.9], decay: 0.75, damp: 0.3, hit: 0, att: 0.008, seed: 163 }), T0 + 0.01, 0.45, 0.2);
  const m = new Float32Array(N(0.6));
  thud(m, 0, { f0: 72, f1: 44, dec: 0.16, amp: 1 });
  put(s, m, T0 + 0.01, 0.7, 0);
  return finish(reverb(s, { room: 0.86, wet: 0.28, tail: 1.6 }));
};
S.crescent = () => {
  const s = st(1.7), r = rng(171);
  put(s, whoosh(0.34, { fa: 700, fb: 5200, fc: 3000, q: 1.6, peak: 0.55, rise: 2, fall: 1.4, seed: 172, body: 0.4 }), 0, 0.9, [0.6, 0.1]);
  // five crescents come to hang one after another: glassy tones that do not make a chord
  [1870, 2590, 3310, 4230, 5470].forEach((f, k) => {
    const at = 0.2 + k * 0.075, n = N(1.45 - at), m = new Float32Array(n), w1 = 0.6 + 2.2 * r(), p1 = r() * TAU;
    for (let i = 0; i < n; i++) { const t = i / SR; m[i] = (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 1.003 * t)) * Math.min(1, t / 0.03) * Math.pow(Math.max(0, 1 - t / (1.4 - at)), 1.3) * (0.7 + 0.3 * Math.sin(TAU * w1 * t + p1)) * 0.22; }
    partial(m, 0, f * 2.01, 0.25, 0.05);
    burst(3, 173 + k, 5000, 0.0006).forEach((v, i) => (m[i] += v * 0.25));
    put(s, m, at, 1, lerp(0.5, -0.3, k / 4));
  });
  return finish(reverb(s, { room: 0.85, wet: 0.3, tail: 1.4 }));
};
S.fall = (v = 0) => {
  const s = st(1.0), k = 1 + v * 0.07, T1 = 0.19, crest = v === 2;
  const m0 = new Float32Array(N(0.2));
  partial(m0, 0, 3900 * k, 0.4, 0.08); partial(m0, 0, 5600 * k, 0.3, 0.06);
  put(s, m0, 0, 0.6, 0.1);
  put(s, whoosh(0.18, { fa: 5200 * k, fb: 2600 * k, fc: 800, q: 2, peak: 0.35, rise: 1.5, fall: 1.5, seed: 181 + v }), 0.005, 1, [0.2, -0.35]);
  const m = new Float32Array(N(0.78));
  if (crest) {
    // the third one shears the crest of light: a zip and a fizz, no metal
    mul(osc(m.length, (t) => expi(2600, 300, t / 0.09), 'saw'), (t) => Math.exp(-t / 0.035) * 0.8).forEach((x, i) => (m[i] += x));
    crackle(0.35, { rate: 1600, seed: 185, hp: 3000 }).forEach((x, i) => (m[i] += x * 0.9));
  } else {
    thud(m, 0, { f0: 132, f1: 70, dec: 0.07, amp: 1.2 });
    strike(0.78, { f0: 235 * k, ratios: PLATE.slice(0, 9), decay: 0.3, tilt: 0.25, damp: 0.25, hit: 0.5, hitHp: 1200, seed: 183 + v, amp: 0.7 }).forEach((x, i) => (m[i] += x));
    mul(bq(white(N(0.3), 184 + v), 'highpass', 4000, 0.7), (t) => Math.exp(-t / 0.05) * (0.5 + 0.5 * Math.sin(TAU * 90 * t)) * 0.6).forEach((x, i) => (m[i] += x));
  }
  put(s, m, T1, 1, -0.35);
  return finish(reverb(s, { room: 0.7, wet: 0.16, tail: 0.7 }));
};
S.throwcut = () => {
  const s = st(1.5), n = N(0.38), T1 = 0.42, r = rng(191);
  put(s, whoosh(0.38, { fa: 1800, fb: 900, fc: 380, q: 1.2, peak: 0.2, rise: 1.5, fall: 1.3, seed: 192, body: 0.6 }), 0, 1, [-0.5, 0.45]);
  put(s, mul(bq(osc(n, (t) => lerp(320, 190, t / 0.38), 'saw'), 'bandpass', 800, 1.5), (t, u) => Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(TAU * 50 * t)) * 0.9), 0, 1, [-0.5, 0.45]);
  put(s, strike(0.6, { f0: 930, ratios: [1, 2.756, 5.404, 8.933], decay: 0.28, damp: 0.3, hit: 1, hitMs: 3, hitHp: 3000, seed: 193 }), T1, 0.9, 0.4);
  put(s, mul(osc(N(0.14), (t) => expi(3200, 180, t / 0.11), 'sin'), (t) => Math.exp(-t / 0.04) * 0.7), T1, 1, 0.4);
  put(s, crackle(0.3, { rate: 1200, seed: 194, hp: 3500 }), T1, 0.6, 0.4);
  [[0.62, 0.5, 0.3, 1], [0.8, 0.42, 0.55, 1.13], [0.9, 0.24, 0.35, 1.02], [0.96, 0.14, 0.58, 1.15], [1.0, 0.08, 0.38, 1.03]].forEach(([t, g, p, k], j) =>
    put(s, strike(0.3, { f0: 1250 * k, ratios: TUBE, decay: 0.09, damp: 0.2, hit: 0.5, hitHp: 1500, seed: 195 + j }), t, g, p));
  return finish(reverb(s, { room: 0.72, wet: 0.17, tail: 0.8 }));
};
S.form = () => {
  const s = st(1.0), r = rng(201), G = 30;
  for (let g = 0; g < G; g++) {
    const u = g / (G - 1), n = N(0.036), m = new Float32Array(n), f = expi(500, 3000, u) * (1 + (r() - 0.5) * 0.16);
    for (let i = 0; i < n; i++) m[i] = Math.sin((TAU * f * i) / SR) * (0.5 - 0.5 * Math.cos((TAU * i) / n)) * (0.15 + 0.5 * u);
    put(s, m, 0.02 + 0.58 * Math.pow(u, 0.85), 1, -0.35 + (r() - 0.5) * 0.7);
  }
  put(s, whoosh(0.62, { fa: 800, fb: 4500, fc: 4600, q: 5, peak: 0.95, rise: 1.6, fall: 1, seed: 202, gain: 0.3 }), 0, 1, -0.35);
  const n = N(0.3), lock = mul(bq(osc(n, 240, 'saw').map((v, i) => v + Math.sin((TAU * 242.5 * i) / SR)), 'lowpass', 1500, 1), (t, u) => Math.sin(Math.PI * Math.pow(u, 0.5)) * (0.7 + 0.3 * Math.sin(TAU * 60 * t)) * 0.5);
  partial(lock, 0, 1900, 0.35, 0.15); burst(3, 203, 3000, 0.0008).forEach((v, i) => (lock[i] += v * 0.6));
  put(s, lock, 0.62, 1, -0.35);
  return finish(reverb(s, { room: 0.7, wet: 0.18, tail: 0.7 }));
};
S.dash = () => {
  const s = st(0.62), m = new Float32Array(N(0.3));
  thud(m, 0, { f0: 84, f1: 48, dec: 0.06, amp: 1.2 });
  put(s, m, 0, 0.8, -0.8); put(s, m, 0.03, 0.5, 0.8);
  put(s, whoosh(0.56, { fa: 300, fb: 1800, fc: 900, q: 1.1, peak: 0.6, rise: 2, fall: 1.2, seed: 211, body: 0.7 }), 0.03, 1, [-0.9, -0.1]);
  put(s, whoosh(0.5, { fa: 500, fb: 3000, fc: 1500, q: 1.4, peak: 0.6, rise: 2, fall: 1.2, seed: 212 }), 0.08, 0.8, [0.9, 0.1]);
  put(s, servo(0.3, { fa: 110, fb: 210, seed: 213, grit: 0.4, gearF: 1500, formant: 800, hp: 80, teeth: 9 }), 0.02, 0.3, -0.7);
  put(s, servo(0.26, { fa: 380, fb: 720, seed: 214, grit: 0.25 }), 0.07, 0.22, 0.7);
  return finish(reverb(s, { room: 0.6, wet: 0.1, tail: 0.3 }));
};
S.slowmo = () => {
  const dur = 1.0, s = st(dur), n = N(dur), f = (t) => expi(330, 52, t / 0.8);
  const a = osc(n, f, 'sin'), b = osc(n, f, 'saw');
  const y = mul(bq(a.map((v, i) => v + 0.4 * b[i]), 'lowpass', (t) => expi(4000, 280, t / 0.9), 2), (t, u) => Math.pow(Math.sin(Math.PI * u), 0.7) * 0.7);
  put(s, y, 0, 1, 0);
  put(s, whoosh(dur, { fa: 3200, fb: 2400, fc: 200, q: 0.8, peak: 0.12, rise: 1, fall: 1.2, seed: 221, gain: 0.3 }), 0, 1, 0);
  return finish(reverb(s, { room: 0.8, wet: 0.2, tail: 0.8 }));
};
S.wind = (dur = 6) => {
  const n = N(dur), mk = (seed) => {
    const y = bq(pink(n, seed), 'bandpass', (t) => 520 + 260 * Math.sin(TAU * 0.11 * t + seed) + 140 * Math.sin(TAU * 0.27 * t + seed * 2), 0.9);
    const wh = bq(white(n, seed + 1), 'bandpass', (t) => 2100 + 380 * Math.sin(TAU * 0.19 * t + seed * 3), 14);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] = y[i] * (0.7 + 0.3 * Math.sin(TAU * 0.13 * t + seed)) * 3 + wh[i] * Math.pow(0.5 + 0.5 * Math.sin(TAU * 0.07 * t + seed * 5), 2) * 0.9; }
    return y;
  };
  return finish({ L: mk(231), R: mk(232) }, 0.7, 0.4);
};

// ---- where each sound sits in the 15 seconds (seconds, gain); keyed to the storyboard's seven shots
const TIMELINE = [
  ['servoS', 1.25, 0.22], ['eye', 2.25, 0.5], ['eye', 2.62, 0.55, 1.12], ['click', 3.12, 0.6],
  ['visor', 3.52, 0.5], ['servoL', 3.95, 0.35], ['steps', 4.05, 0.62],
  ['iai', 4.98, 0.75], ['shield', 5.1, 1.0], ['slowmo', 5.14, 0.33], ['skid', 5.75, 0.5], ['sheath', 6.45, 0.55],
  ['servoL', 7.0, 0.3], ['thrust', 7.2, 0.55], ['servoS', 7.38, 0.25, 0.85], ['draw', 7.55, 0.6], ['thrust', 8.5, 0.55, 1.1], ['clang', 8.68, 0.85], ['servoL', 8.9, 0.3, 1.2, 0.4], ['crescent', 9.1, 0.6],
  ['fall', 10.1, 0.6, 0], ['fall', 10.5, 0.65, 1], ['fall', 10.9, 0.6, 2], ['throwcut', 11.25, 0.75], ['form', 11.95, 0.5],
  ['dash', 12.5, 0.6], ['clash', 12.92, 1.0],
];
function mix() {
  const dur = 15.6, m = st(dur), cache = {};
  putSt(m, S.wind(dur), 0, 0.13);
  for (const [name, t, g, ...args] of TIMELINE) { const key = name + args.join(','); putSt(m, (cache[key] ||= S[name](...args)), t, g); }
  for (const ch of [m.L, m.R]) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * 1.15);
  return finish(m, 0.94, 0.6);
}
module.exports = { S, TIMELINE, mix };
