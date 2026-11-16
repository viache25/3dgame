'use strict';
// Harder weapons. What made the first set sound like toys: a few pure tones ringing prettily, weak attacks, no weight, no dirt.
// Here a blow is a full-band crack, a dull body, dozens of crowded partials that beat against each other fast (roughness, not shimmer),
// a low thump you feel, a grind of metal on metal, and all of it driven into distortion.
const D = require('./dsp.cjs');
const { SR, TAU, N, rng, smooth, expi, lerp, white, pink, bq, osc, partial, thud, whoosh, servo, crackle, st, put, putSt, reverb, mapSt, finish } = D;
const base = require('./sounds.cjs').S;
const mul = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR, i / x.length); return x; };
const addTo = (dst, src, at = 0, g = 1) => { const o = N(at) - 1; for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * g; return dst; };
/** Distortion: bring the peak to 1, push it through tanh with a little asymmetry (odd and even harmonics). */
function drive(x, d = 3, asym = 0.15) {
  let m = 1e-9; for (const v of x) m = Math.max(m, Math.abs(v));
  const k = 1 / Math.tanh(d);
  for (let i = 0; i < x.length; i++) { const v = x[i] / m; x[i] = Math.tanh(d * (v + asym * v * v)) * k; }
  return x;
}
/** Crowded, rough metal: `n` partials scattered between fLo and fHi, each with a twin 20–70 Hz away so the pair growls. */
function metal(dur, o) {
  const out = new Float32Array(N(dur)), r = rng(o.seed || 1), at = N(o.at || 0);
  for (let k = 0; k < o.n; k++) {
    const f = o.fLo * Math.pow(o.fHi / o.fLo, Math.pow(r(), o.skew || 1));
    const d = lerp(o.dec[0], o.dec[1], r() * r()) * Math.pow(o.fLo / f, o.hiDamp === undefined ? 0.3 : o.hiDamp);
    const a = (0.35 + 0.65 * r()) * Math.pow(f / 3000, o.tilt || 0);
    partial(out, at, f, a, d, o.att); partial(out, at, f + 20 + 50 * r(), a * 0.8, d * 0.85, o.att);
  }
  return out;
}
/** The hard edge of any blow: a few milliseconds of full-band noise, clipped. */
function crack(ms, seed, hp = 300) {
  const n = N((ms / 1000) * 5), w = bq(white(n, seed), 'highpass', hp, 0.7);
  for (let i = 0; i < n; i++) w[i] = Math.max(-0.7, Math.min(0.7, w[i] * Math.exp(-i / ((SR * ms) / 1000)) * 3)) / 0.7;
  return w;
}
/** The dull body of a blow: a short band of noise in the low mids. */
const body = (f, q, dec, seed) => mul(bq(white(N(dec * 7), seed), 'bandpass', f, q), (t) => Math.exp(-t / dec) * 2.6);
/** Metal dragged across metal: noise through a handful of ringing bands, chopped by stick-slip. */
function grind(dur, o) {
  const n = N(dur), w = white(n, o.seed || 3), r = rng((o.seed || 3) + 1), y = new Float32Array(n), ch = bq(white(n, (o.seed || 3) + 2), 'lowpass', o.chop || 70, 0.7);
  for (let k = 0; k < (o.bands || 6); k++) { const f = lerp(o.fLo || 1500, o.fHi || 7500, r()), b = bq(w, 'bandpass', (t) => f * (1 + (o.glide || 0) * (t / dur)), 9 + 12 * r()); for (let i = 0; i < n; i++) y[i] += b[i] * 2.2; }
  const hi = bq(w, 'highpass', 5000, 0.7);
  for (let i = 0; i < n; i++) y[i] = (y[i] + hi[i] * 0.35) * (0.25 + 0.75 * Math.min(1, Math.abs(ch[i]) * 18));
  return y;
}
/** Air torn by a blade: a fast-rising sweep that cuts off, with a whistle on it and a low push under it. */
function rip(dur, o) {
  const n = N(dur);
  const y = whoosh(dur, { fa: o.fa, fb: o.fb, fc: o.fc, q: o.q || 2, peak: o.peak === undefined ? 0.55 : o.peak, rise: o.rise || 1.3, fall: o.fall || 2.2, seed: o.seed || 5 });
  const dl = N(0.0009), lo = mul(bq(white(n, (o.seed || 5) + 3), 'bandpass', (t) => expi(o.lowA || 320, o.lowB || 140, t / dur), 1), (t, u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 1.4) * 2.4 * (o.low === undefined ? 0.6 : o.low));
  for (let i = n - 1; i >= dl; i--) y[i] = y[i] * 0.75 + y[i - dl] * 0.6; // a comb: the whistle of an edge
  for (let i = 0; i < n; i++) y[i] += lo[i];
  return y;
}
/** Electricity: a clipped mains-like buzz gated by noise, with sparks on top. */
function arc(dur, o) {
  const n = N(dur), f = o.f || 110, a = osc(n, typeof f === 'function' ? f : (t) => f * (1 + 0.03 * Math.sin(TAU * 31 * t)), 'saw'), g = bq(white(n, o.seed || 7), 'lowpass', o.gate || 40, 0.7);
  let y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = Math.max(-0.5, Math.min(0.5, a[i] * (0.4 + Math.min(1, Math.abs(g[i]) * 14)) * 1.6)) * 2;
  y = bq(bq(y, 'peak', o.tone || 2400, 1.2, 12), 'highpass', 180, 0.7);
  const c = crackle(dur, { rate: o.rate || 1400, seed: (o.seed || 7) + 1, hp: 3000, fall: o.fall || 0.6 });
  for (let i = 0; i < n; i++) y[i] = y[i] * 0.55 + c[i] * 1.2;
  return y;
}
const env = (x, a, r) => mul(x, (t) => Math.min(1, t / a) * Math.min(1, (x.length / SR - t) / r));

const H = {};
/** Steel on steel: Luna's blade knocks the shaft aside. */
H.clang = () => {
  const s = st(1.3), m = new Float32Array(N(1.2));
  addTo(m, crack(2.5, 301), 0, 1.6);
  addTo(m, metal(1.2, { n: 34, fLo: 1400, fHi: 11500, dec: [0.05, 0.42], tilt: 0.3, seed: 302 }), 0, 0.5);
  addTo(m, metal(0.6, { n: 14, fLo: 480, fHi: 2600, dec: [0.03, 0.11], seed: 303 }), 0, 0.5);
  addTo(m, body(720, 1.2, 0.022, 304), 0, 1.3);
  thud(m, 0, { f0: 100, f1: 52, dec: 0.05, amp: 1.5 });
  addTo(m, mul(grind(0.17, { seed: 305, fLo: 2200, fHi: 8000, glide: 0.25 }), (t, u) => Math.pow(1 - u, 1.2)), 0.014, 0.55);
  addTo(m, crack(1.5, 306), 0.041, 0.6);
  addTo(m, metal(0.5, { n: 14, fLo: 2000, fHi: 10000, dec: [0.03, 0.16], seed: 307 }), 0.041, 0.18);
  put(s, drive(m, 3.2), 0, 1, 0.12);
  return finish(reverb(s, { room: 0.66, damp: 0.35, wet: 0.13, tail: 0.8 }), 0.93);
};
/** The iai lands on the shield: weight first, then torn metal and sparks. */
H.shield = () => {
  const s = st(2.2), m = new Float32Array(N(2.1));
  thud(m, 0, { f0: 96, f1: 36, dec: 0.26, amp: 2.6 }); thud(m, 0, { f0: 190, f1: 80, dec: 0.07, amp: 1.2 });
  addTo(m, crack(7, 311, 120), 0, 1.8);
  addTo(m, metal(2.0, { n: 42, fLo: 250, fHi: 7200, dec: [0.07, 0.85], skew: 1.25, tilt: 0.1, seed: 312 }), 0, 0.42);
  addTo(m, metal(0.9, { n: 16, fLo: 3000, fHi: 12000, dec: [0.08, 0.45], seed: 313 }), 0.003, 0.2);
  // the plate buckles: dirty low mids with a rattle in them
  const cr = mul(bq(white(N(0.5), 314), 'bandpass', (t) => expi(820, 300, t / 0.3), 0.9), (t) => Math.exp(-t / 0.085) * 3 * (0.6 + 0.4 * Math.sin(TAU * 47 * t)));
  addTo(m, cr, 0.002, 1.1);
  addTo(m, mul(grind(0.3, { seed: 315, fLo: 900, fHi: 5200, bands: 7, chop: 55, glide: -0.2 }), (t, u) => Math.pow(1 - u, 1.4)), 0.02, 0.5);
  put(s, drive(m, 3.6), 0, 1, -0.25);
  put(s, crackle(0.6, { rate: 1100, seed: 316, hp: 4500, fall: 1.2 }), 0.01, 0.55, [-0.4, 0.2]);
  return finish(reverb(s, { room: 0.82, damp: 0.3, wet: 0.2, tail: 1.3 }), 0.95);
};
/** The cut nobody sees: a breath in, a razor through the air, the ring of the blade, a dead thump. */
H.iai = () => {
  const s = st(1.7), T0 = 0.09, m = new Float32Array(N(1.6));
  put(s, mul(bq(white(N(T0), 321), 'highpass', 5000, 0.7), (t, u) => u * u * u * 0.5), 0, 1, 0.5);
  addTo(m, rip(0.1, { fa: 2600, fb: 10500, fc: 7000, q: 2.6, peak: 0.25, rise: 1, fall: 2.5, seed: 322, low: 0.9, lowA: 420, lowB: 160 }), 0, 1.3);
  addTo(m, crack(1.2, 323, 2500), 0.006, 1.2);
  addTo(m, metal(1.5, { n: 14, fLo: 2500, fHi: 12500, dec: [0.18, 0.85], seed: 324, att: 0.004 }), 0.012, 0.3);
  thud(m, N(0.012), { f0: 74, f1: 40, dec: 0.18, amp: 1.6 });
  put(s, drive(m, 2.4), T0, 1, [0.6, -0.5]);
  return finish(reverb(s, { room: 0.86, wet: 0.24, tail: 1.5 }), 0.93);
};
/** The spear driven home: a heavy push of air and the buzz of its blade of light. */
H.thrust = (k = 1) => {
  const dur = 0.42, s = st(dur + 0.1), n = N(dur), m = new Float32Array(n);
  addTo(m, rip(dur, { fa: 380 * k, fb: 3000 * k, fc: 900 * k, q: 1.3, peak: 0.42, rise: 1.6, fall: 2, seed: 331, low: 1.1, lowA: 360, lowB: 130 }), 0, 1);
  const bz = mul(osc(n, (t) => (t < 0.17 ? lerp(140, 270, t / 0.17) : lerp(270, 160, (t - 0.17) / 0.25)) * k, 'saw'), (t, u) => Math.pow(Math.sin(Math.PI * u), 1.3) * (0.55 + 0.45 * Math.sign(Math.sin(TAU * 68 * t))));
  for (let i = 0; i < n; i++) bz[i] = Math.max(-0.45, Math.min(0.45, bz[i])) * 2;
  addTo(m, bq(bz, 'peak', 1700, 1, 10), 0, 0.42);
  thud(m, N(0.15), { f0: 82, f1: 50, dec: 0.06, amp: 0.9 });
  put(s, drive(m, 2.2), 0, 1, [-0.5, 0.25]);
  return finish(reverb(s, { room: 0.5, wet: 0.08, tail: 0.3 }), 0.9);
};
/** The rising cut. */
H.slash = () => {
  const s = st(1.4), m = new Float32Array(N(1.3));
  addTo(m, rip(0.33, { fa: 600, fb: 6200, fc: 3800, q: 1.7, peak: 0.6, rise: 1.6, fall: 2.6, seed: 341, low: 1.2, lowA: 300, lowB: 520 }), 0, 1.2);
  addTo(m, metal(1.1, { n: 12, fLo: 2200, fHi: 11000, dec: [0.15, 0.7], seed: 342, att: 0.01 }), 0.2, 0.22);
  put(s, drive(m, 2.2), 0, 1, [0.6, 0.1]);
  return finish(reverb(s, { room: 0.84, wet: 0.22, tail: 1.2 }), 0.9);
};
/** One crescent catching light in the air: a spit of current. */
H.ignite = (k = 1) => {
  const s = st(0.3), m = env(arc(0.13, { f: 150 * k, seed: 351 + Math.round(k * 10), tone: 3200 * k, rate: 2600, fall: 0.3 }), 0.002, 0.07);
  addTo(m, crack(1, 352, 3000), 0, 0.8);
  put(s, drive(m, 2.5), 0, 1, 0);
  return finish(reverb(s, { room: 0.7, wet: 0.18, tail: 0.4 }), 0.85);
};
/** Crescents hanging over him: a low hum of current and a thin whine, nothing sweet. */
H.hang = (dur = 1.9) => {
  const n = N(dur), mk = (seed) => {
    const a = osc(n, 55.3 + seed * 0.07, 'saw'), b = osc(n, 82.1 - seed * 0.05, 'saw'), wh = bq(white(n, 360 + seed), 'bandpass', (t) => 6800 + 500 * Math.sin(TAU * 0.7 * t + seed), 30);
    let y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = Math.max(-0.6, Math.min(0.6, (a[i] + b[i]) * 0.8));
    y = bq(y, 'lowpass', 900, 1.5);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] = y[i] * (0.7 + 0.3 * Math.sin(TAU * 23 * t)) + wh[i] * 5 * (0.6 + 0.4 * Math.sin(TAU * 3.1 * t + seed)); }
    return env(y, 0.25, 0.3);
  };
  return finish({ L: mk(1), R: mk(2) }, 0.7, 0.3);
};
/** A crescent comes down: the air rips, then it lands — on the shield (v 0, 1) or through the crest of light (v 2). */
H.fall = (v = 0) => {
  const s = st(1.2), T1 = 0.19, k = 1 + v * 0.06, m = new Float32Array(N(1.1));
  put(s, drive(rip(0.19, { fa: 6500 * k, fb: 2800 * k, fc: 700, q: 2.2, peak: 0.5, rise: 1.4, fall: 1.2, seed: 371 + v, low: 0.9, lowA: 500, lowB: 180 }), 2), 0.004, 0.9, [0.2, -0.35]);
  if (v === 2) {
    addTo(m, env(arc(0.4, { f: (t) => expi(420, 70, t / 0.25), seed: 375, tone: 2000, rate: 2400 }), 0.001, 0.2), 0, 1.3);
    addTo(m, crack(2, 376, 1500), 0, 1.2);
    thud(m, 0, { f0: 120, f1: 60, dec: 0.06, amp: 1.0 });
  } else {
    thud(m, 0, { f0: 118, f1: 46, dec: 0.1, amp: 2.2 });
    addTo(m, crack(5, 372 + v, 200), 0, 1.6);
    addTo(m, metal(1.0, { n: 28, fLo: 260 * k, fHi: 6500, dec: [0.05, 0.42], skew: 1.2, seed: 373 + v }), 0, 0.42);
    addTo(m, body(540, 0.9, 0.05, 374 + v), 0, 1.2);
    addTo(m, env(arc(0.16, { f: 130, seed: 377 + v, tone: 2800, rate: 2000 }), 0.001, 0.1), 0.004, 0.7);
  }
  put(s, drive(m, 3.3), T1, 1, -0.35);
  put(s, crackle(0.4, { rate: 900, seed: 378 + v, hp: 4500, fall: 1.2 }), T1, 0.45, -0.3);
  return finish(reverb(s, { room: 0.74, wet: 0.16, tail: 0.8 }), 0.94);
};
/** The throw, Luna's cut through the shaft, the pieces on the stone. `cutAt` and `clatter` are seconds from the start. */
H.throwcut = (cutAt = 0.39, clatter = [0.72, 0.88]) => {
  const s = st(1.7), n = N(cutAt), m = new Float32Array(N(1.2));
  const fly = rip(cutAt, { fa: 2000, fb: 1000, fc: 420, q: 1.2, peak: 0.18, rise: 1.2, fall: 1.1, seed: 381, low: 1.2, lowA: 300, lowB: 150 });
  const bz = mul(osc(n, (t) => lerp(330, 200, t / cutAt), 'saw'), (t, u) => Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sign(Math.sin(TAU * 52 * t))));
  for (let i = 0; i < n; i++) fly[i] += Math.max(-0.4, Math.min(0.4, bz[i])) * 1.1;
  put(s, drive(fly, 2), 0, 1, [-0.5, 0.45]);
  addTo(m, crack(2.5, 382, 800), 0, 1.7);
  addTo(m, metal(0.6, { n: 24, fLo: 1800, fHi: 11000, dec: [0.03, 0.22], seed: 383 }), 0, 0.4);
  addTo(m, body(900, 1.4, 0.02, 384), 0, 1.1);
  thud(m, 0, { f0: 110, f1: 55, dec: 0.045, amp: 1.2 });
  addTo(m, env(arc(0.22, { f: (t) => expi(420, 60, t / 0.2), seed: 385, tone: 1800, rate: 2200 }), 0.001, 0.12), 0.004, 1.0);
  put(s, drive(m, 3.2), cutAt, 1, 0.4);
  clatter.forEach((t, j) => {
    const c = new Float32Array(N(0.4));
    for (const [d, g] of j ? [[0, 0.7], [0.07, 0.35], [0.12, 0.2]] : [[0, 1]]) { addTo(c, crack(1.5, 386 + j, 1200), d, g); addTo(c, metal(0.3, { n: 12, fLo: 900, fHi: 5200, dec: [0.025, 0.09], seed: 387 + j * 3 }), d, g * 0.4); addTo(c, body(600, 1.5, 0.014, 388 + j), d, g * 0.8); }
    put(s, drive(c, 2.4), t, 0.55 - 0.1 * j, 0.5);
  });
  return finish(reverb(s, { room: 0.72, wet: 0.15, tail: 0.7 }), 0.93);
};
/** A new spear out of current: it builds, whines up, and locks with a clunk. */
H.form = (lockAt = 0.62) => {
  const s = st(lockAt + 0.6), n = N(lockAt), m = new Float32Array(N(lockAt + 0.5));
  const build = arc(lockAt, { f: (t) => expi(70, 240, t / lockAt), seed: 391, tone: 2600, rate: 2600, fall: -0.01 });
  addTo(m, mul(build, (t, u) => 0.25 + 0.75 * u * u), 0, 0.9);
  const wh = mul(osc(n, (t) => expi(220, 1100, t / lockAt), 'saw'), (t, u) => u * u);
  for (let i = 0; i < n; i++) wh[i] = Math.max(-0.4, Math.min(0.4, wh[i])) * 2;
  addTo(m, bq(wh, 'bandpass', (t) => expi(700, 4200, t / lockAt), 3), 0, 0.6);
  const lk = new Float32Array(N(0.45));
  thud(lk, 0, { f0: 130, f1: 58, dec: 0.07, amp: 2.0 });
  addTo(lk, crack(3, 392, 400), 0, 1.4); addTo(lk, body(620, 1.1, 0.03, 393), 0, 1.2);
  addTo(lk, metal(0.4, { n: 14, fLo: 1200, fHi: 7000, dec: [0.03, 0.16], seed: 394 }), 0, 0.35);
  addTo(lk, env(arc(0.3, { f: 120, seed: 395, tone: 1900, rate: 500 }), 0.002, 0.22), 0.01, 0.55);
  addTo(m, lk, lockAt, 1.5);
  put(s, drive(m, 2.8), 0, 1, -0.35);
  return finish(reverb(s, { room: 0.66, wet: 0.14, tail: 0.6 }), 0.92);
};
/** One armoured footfall. */
H.step = (k = 1, pan = -0.4, light = false) => {
  const s = st(0.5), m = new Float32Array(N(0.4));
  thud(m, 0, { f0: (light ? 120 : 92) * k, f1: light ? 62 : 42, dec: light ? 0.045 : 0.08, amp: 2.0 });
  addTo(m, crack(2.5, 401 + Math.round(k * 7), 500), 0, 0.9);
  addTo(m, body(light ? 1100 : 640, 1, 0.03, 402), 0, 1.2);
  addTo(m, metal(0.25, { n: light ? 7 : 10, fLo: light ? 2400 : 1500, fHi: 6500, dec: [0.02, 0.07], seed: 403 + Math.round(k * 11) }), 0.004, 0.3);
  put(s, drive(m, 2.6), 0, 1, pan);
  return finish(reverb(s, { room: 0.6, wet: 0.12, tail: 0.4 }), 0.9);
};
/** Dragged back across the floor on his heels. */
H.skid = () => {
  const dur = 0.8, s = st(dur + 0.1), m = mul(grind(dur, { seed: 411, fLo: 700, fHi: 5200, bands: 8, chop: 48, glide: -0.22 }), (t, u) => Math.min(1, t / 0.02) * Math.pow(1 - u, 1.2));
  addTo(m, mul(bq(pink(N(dur), 412), 'lowpass', 200, 0.7), (t, u) => Math.pow(1 - u, 1.2) * 9), 0, 1);
  put(s, drive(m, 3), 0, 1, [-0.1, -0.5]);
  return finish(reverb(s, { room: 0.6, wet: 0.12, tail: 0.4 }), 0.9);
};
/** The blade out of the scabbard, slowly: steel grinding along the mouth, then it rings free. */
H.draw = () => {
  const d = 0.55, s = st(2.0), m = new Float32Array(N(1.9));
  addTo(m, mul(grind(d, { seed: 421, fLo: 2400, fHi: 9000, bands: 7, chop: 95, glide: 0.35 }), (t, u) => Math.pow(u, 1.3) * 1.2), 0, 1);
  addTo(m, metal(1.4, { n: 13, fLo: 1900, fHi: 9500, dec: [0.3, 1.0], seed: 422, att: 0.05 }), d - 0.08, 0.3);
  addTo(m, crack(1.2, 423, 3000), d - 0.01, 0.7);
  put(s, drive(m, 2.4), 0, 1, 0.3);
  return finish(reverb(s, { room: 0.8, wet: 0.2, tail: 1.1 }), 0.9);
};
/** Two fighters leaving the ground toward each other. */
H.dash = () => {
  const s = st(0.75);
  put(s, drive(rip(0.6, { fa: 260, fb: 1900, fc: 1000, q: 1.1, peak: 0.7, rise: 2, fall: 1.6, seed: 431, low: 1.4, lowA: 200, lowB: 420 }), 2), 0.02, 1, [-0.9, -0.1]);
  put(s, drive(rip(0.55, { fa: 460, fb: 3300, fc: 1700, q: 1.4, peak: 0.7, rise: 2, fall: 1.6, seed: 432, low: 0.8, lowA: 260, lowB: 520 }), 2), 0.06, 0.85, [0.9, 0.1]);
  return finish(reverb(s, { room: 0.6, wet: 0.1, tail: 0.3 }), 0.88);
};
/** The last blow: the air goes out of the world, then everything at once, then the frame stops. */
H.clash = () => {
  const s = st(3.0), T0 = 0.2, m = new Float32Array(N(2.7));
  for (const [seed, pan] of [[441, -0.4], [442, 0.4]]) put(s, mul(rip(0.19, { fa: 900, fb: 5200, fc: 6000, q: 1.1, peak: 0.98, rise: 3, fall: 1, seed, low: 0.6, lowA: 150, lowB: 500 }), () => 0.7), 0, 1, pan);
  thud(m, 0, { f0: 72, f1: 27, dec: 0.62, amp: 3.0 }); thud(m, 0, { f0: 150, f1: 60, dec: 0.16, amp: 1.5 });
  addTo(m, crack(9, 443, 100), 0, 2.0);
  addTo(m, metal(2.6, { n: 46, fLo: 1200, fHi: 12500, dec: [0.1, 1.4], tilt: 0.25, seed: 444 }), 0, 0.4);
  addTo(m, metal(1.2, { n: 22, fLo: 420, fHi: 5200, dec: [0.05, 0.5], skew: 1.2, seed: 445 }), 0, 0.42);
  addTo(m, mul(bq(white(N(0.6), 446), 'bandpass', (t) => expi(900, 260, t / 0.35), 0.9), (t) => Math.exp(-t / 0.1) * 3 * (0.6 + 0.4 * Math.sin(TAU * 41 * t))), 0.002, 1.2);
  addTo(m, mul(grind(0.34, { seed: 447, fLo: 1500, fHi: 8000, bands: 8, chop: 60, glide: 0.3 }), (t, u) => Math.pow(1 - u, 1.3)), 0.02, 0.6);
  addTo(m, crack(2, 448, 1200), 0.052, 0.8); addTo(m, metal(0.6, { n: 16, fLo: 1800, fHi: 10000, dec: [0.04, 0.22], seed: 449 }), 0.052, 0.2);
  put(s, drive(m, 3.8), T0, 1, 0);
  for (const [seed, pan] of [[450, -0.6], [451, 0.6]]) put(s, whoosh(0.8, { fa: 4400, fb: 3300, fc: 220, q: 0.9, peak: 0.05, rise: 1, fall: 1.25, seed, gain: 0.7, body: 0.7 }), T0 + 0.02, 0.75, pan);
  put(s, crackle(0.9, { rate: 1200, seed: 452, hp: 4200, fall: 1.1 }), T0, 0.5, [-0.5, 0.5]);
  let o = reverb(s, { room: 0.9, damp: 0.25, wet: 0.27, tail: 2.3 });
  o = mapSt(o, (x) => bq(x, 'lowpass', (t) => (t < 1.25 ? 16000 : expi(16000, 520, (t - 1.25) / 0.7)), 0.8));
  // what is left in the ears when the picture stops
  const ring = new Float32Array(o.L.length);
  for (let i = N(T0 + 0.25); i < ring.length; i++) { const t = i / SR - T0 - 0.25; ring[i] = (Math.sin(TAU * 3180 * t) + 0.7 * Math.sin(TAU * 3243 * t)) * Math.min(1, t / 0.5) * Math.exp(-t / 1.6) * 0.035; }
  for (let i = 0; i < ring.length; i++) { o.L[i] += ring[i]; o.R[i] += ring[i]; }
  return finish(o, 0.96, 0.6);
};
/** An eye of the king's guardian comes on: heavy shutters, the light stutters twice, then a low blow you feel and a thin whine left hanging. */
H.eye = (k = 1) => {
  const s = st(1.5), m = new Float32Array(N(1.4));
  [0, 0.034, 0.068].forEach((t, i) => { addTo(m, crack(2, 501 + i, 600), t, 0.7); addTo(m, body(1050 * k, 1.4, 0.016, 504 + i), t, 0.9); addTo(m, metal(0.2, { n: 8, fLo: 900 * k, fHi: 4200, dec: [0.02, 0.06], seed: 507 + i }), t, 0.22); });
  addTo(m, env(servo(0.13, { fa: 125 * k, fb: 88 * k, seed: 510, grit: 0.5, gearF: 900, formant: 520, hp: 60, teeth: 9 }), 0.01, 0.03), 0, 0.5);
  addTo(m, env(arc(0.04, { f: 140 * k, seed: 511, tone: 2600, rate: 3000 }), 0.001, 0.015), 0.0, 0.5); addTo(m, env(arc(0.04, { f: 150 * k, seed: 512, tone: 3000, rate: 3000 }), 0.001, 0.015), 0.08, 0.6);
  const T0 = 0.16, n = N(1.1), g = new Float32Array(n);
  thud(g, 0, { f0: 60 * k, f1: 33 * k, dec: 0.42, amp: 2.4 });
  const a = osc(n, 55 * k, 'saw'), b = osc(n, 82.7 * k, 'saw'), c = osc(n, 110.9 * k, 'saw');
  const gr = bq(a.map((v, i) => Math.max(-0.5, Math.min(0.5, (v + b[i] + c[i] * 0.7) * 0.8))), 'lowpass', (t) => expi(700, 170, t / 0.7), 1.6);
  for (let i = 0; i < n; i++) g[i] += gr[i] * 2.2 * Math.exp(-i / (SR * 0.36)) * Math.min(1, i / (SR * 0.004));
  addTo(g, crack(4, 513, 300), 0, 0.9);
  addTo(m, g, T0, 1);
  put(s, drive(m, 2.8), 0, 1, 0.35);
  const wn = N(1.2), wh = new Float32Array(wn), w1 = osc(wn, 2930 * k, 'saw'), w2 = osc(wn, 3105 * k, 'saw');
  for (let i = 0; i < wn; i++) wh[i] = (w1[i] + w2[i]) * 0.05 * Math.min(1, i / (SR * 0.05)) * Math.exp(-i / (SR * 0.45));
  put(s, bq(wh, 'bandpass', 3000 * k, 4), T0, 1, 0.35);
  return finish(reverb(s, { room: 0.88, damp: 0.4, wet: 0.28, tail: 1.5 }), 0.93);
};
/** The head turns: a short low drive and a hard stop. Nothing that chirps. */
H.head = () => {
  const s = st(0.4), m = new Float32Array(N(0.35));
  addTo(m, env(servo(0.11, { fa: 150, fb: 235, seed: 521, grit: 0.55, gearF: 950, formant: 520, hp: 60, teeth: 10, up: 0.3, down: 0.1 }), 0.006, 0.012), 0, 0.6);
  thud(m, N(0.108), { f0: 135, f1: 70, dec: 0.035, amp: 1.5 });
  addTo(m, crack(1.5, 522, 900), 0.108, 0.7); addTo(m, body(760, 1.6, 0.014, 523), 0.108, 0.9);
  addTo(m, metal(0.15, { n: 6, fLo: 1300, fHi: 4200, dec: [0.015, 0.04], seed: 524 }), 0.108, 0.16);
  put(s, drive(m, 2.2), 0, 1, 0.4);
  return finish(reverb(s, { room: 0.5, wet: 0.08, tail: 0.3 }), 0.9);
};
/** The draw at full speed, and the left hand closing on the hilt as the blade settles in the middle guard. */
H.drawFast = (d = 0.28) => {
  const s = st(1.7), m = new Float32Array(N(1.6));
  addTo(m, mul(grind(d, { seed: 531, fLo: 2600, fHi: 9500, bands: 7, chop: 110, glide: 0.5 }), (t, u) => Math.pow(u, 1.1) * 1.3), 0, 1);
  addTo(m, rip(d, { fa: 900, fb: 5200, fc: 3000, q: 1.6, peak: 0.8, rise: 1.5, fall: 2, seed: 532, low: 0.5 }), 0, 0.5);
  addTo(m, crack(1.2, 533, 3000), d - 0.006, 0.9);
  addTo(m, metal(1.3, { n: 14, fLo: 1900, fHi: 10500, dec: [0.25, 0.9], seed: 534, att: 0.03 }), d - 0.05, 0.3);
  put(s, drive(m, 2.5), 0, 1, 0.3);
  return finish(reverb(s, { room: 0.8, wet: 0.2, tail: 1.0 }), 0.9);
};
H.kamae = () => {
  const s = st(0.6), m = new Float32Array(N(0.5));
  addTo(m, rip(0.2, { fa: 500, fb: 2600, fc: 1200, q: 1.3, peak: 0.6, seed: 541, low: 0.8 }), 0, 0.7);
  addTo(m, crack(1.5, 542, 800), 0.19, 0.8); addTo(m, body(820, 1.5, 0.016, 543), 0.19, 1.0);
  addTo(m, metal(0.4, { n: 9, fLo: 2200, fHi: 9000, dec: [0.06, 0.25], seed: 544 }), 0.19, 0.18);
  put(s, drive(m, 2.2), 0, 1, 0.3);
  return finish(reverb(s, { room: 0.6, wet: 0.12, tail: 0.4 }), 0.88);
};
/** A spear point or a crescent driven into the stone floor. */
H.floorHit = (k = 1) => {
  const s = st(1.0), m = new Float32Array(N(0.9));
  thud(m, 0, { f0: 105 * k, f1: 40, dec: 0.12, amp: 2.4 });
  addTo(m, crack(5, 551, 250), 0, 1.6); addTo(m, body(420, 0.8, 0.06, 552), 0, 1.5);
  addTo(m, mul(grind(0.22, { seed: 553, fLo: 600, fHi: 3800, bands: 7, chop: 60, glide: -0.3 }), (t, u) => Math.pow(1 - u, 1.3)), 0.01, 0.6);
  addTo(m, metal(0.4, { n: 12, fLo: 1200, fHi: 7000, dec: [0.03, 0.14], seed: 554 }), 0, 0.22);
  put(s, drive(m, 3.2), 0, 1, 0);
  put(s, crackle(0.4, { rate: 900, seed: 555, hp: 4200, fall: 1.2 }), 0.01, 0.45, 0);
  return finish(reverb(s, { room: 0.7, wet: 0.15, tail: 0.6 }), 0.93);
};
/** The rim of the shield driven into her: a slab of metal on metal with a body behind it. */
H.bash = () => {
  const s = st(1.2), m = new Float32Array(N(1.1));
  thud(m, 0, { f0: 104, f1: 40, dec: 0.16, amp: 2.6 });
  addTo(m, crack(6, 561, 150), 0, 1.7); addTo(m, body(520, 0.9, 0.05, 562), 0, 1.5);
  addTo(m, metal(0.8, { n: 26, fLo: 300, fHi: 4200, dec: [0.04, 0.3], skew: 1.2, seed: 563 }), 0, 0.4);
  addTo(m, metal(0.4, { n: 10, fLo: 2500, fHi: 9000, dec: [0.03, 0.15], seed: 564 }), 0.004, 0.14);
  put(s, drive(m, 3.6), 0, 1, 0);
  return finish(reverb(s, { room: 0.72, wet: 0.16, tail: 0.8 }), 0.94);
};
/** A spear projected out of light: a flickering carrier, data chatter, a scan running along it, then it locks solid. */
H.holo = (lockAt = 0.62) => {
  const s = st(lockAt + 0.7), n = N(lockAt), m = new Float32Array(N(lockAt + 0.6)), r = rng(571);
  const car = osc(n, (t) => 110 + 30 * Math.sin(TAU * 7 * t), 'saw');
  for (let i = 0; i < n; i++) { const f = Math.floor((i / SR) * 30); car[i] = Math.max(-0.45, Math.min(0.45, car[i])) * (Math.sin(f * 12.9898) > -0.55 ? 1 : 0.15) * (0.4 + 0.6 * (i / n)); }
  addTo(m, bq(car, 'peak', 2200, 1.2, 12), 0, 0.9);
  for (let t = 0.02; t < lockAt - 0.03; t += 0.018 + 0.03 * r()) { const L = N(0.008 + 0.01 * r()), f = 1800 + 5200 * r(), b = new Float32Array(L); for (let i = 0; i < L; i++) b[i] = (Math.sin((TAU * f * i) / SR) > 0 ? 1 : -1) * Math.min(1, i / 20) * Math.min(1, (L - i) / 20); addTo(m, b, t, 0.16 + 0.2 * (t / lockAt)); }
  addTo(m, whoosh(lockAt - 0.14, { fa: 600, fb: 6200, fc: 6800, q: 6, peak: 0.97, rise: 1.2, fall: 1, seed: 572, gain: 0.5 }), 0.14, 1);
  const lk = new Float32Array(N(0.5));
  thud(lk, 0, { f0: 130, f1: 56, dec: 0.08, amp: 2.2 });
  addTo(lk, crack(3, 573, 400), 0, 1.5); addTo(lk, body(640, 1.1, 0.03, 574), 0, 1.3);
  addTo(lk, metal(0.4, { n: 14, fLo: 1200, fHi: 7000, dec: [0.03, 0.16], seed: 575 }), 0, 0.3);
  addTo(lk, env(arc(0.32, { f: 120, seed: 576, tone: 1900, rate: 500 }), 0.002, 0.24), 0.01, 0.55);
  addTo(m, lk, lockAt, 1.5);
  put(s, drive(m, 2.6), 0, 1, -0.35);
  return finish(reverb(s, { room: 0.66, wet: 0.14, tail: 0.6 }), 0.92);
};
module.exports = { H, base, drive };
