'use strict';
// Small offline DSP kit: everything is rendered sample by sample into Float32Array at 44.1 kHz.
const SR = 44100, TAU = Math.PI * 2;
const N = (sec) => Math.max(1, Math.round(sec * SR));
function rng(seed) { let s = (seed * 2654435761) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const expi = (a, b, t) => a * Math.pow(b / a, Math.min(1, Math.max(0, t)));
const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

function white(n, seed) { const r = rng(seed), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = r() * 2 - 1; return o; }
function pink(n, seed) {
  const r = rng(seed), o = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = r() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; o[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; }
  return o;
}
/** RBJ biquad; `f` and `q` may be numbers or functions of time in seconds. */
function bq(x, type, f, q = 0.707, gainDb = 0) {
  const n = x.length, y = new Float32Array(n), vary = typeof f === 'function' || typeof q === 'function';
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
  const set = (t) => {
    const ff = Math.min(SR * 0.45, Math.max(20, typeof f === 'function' ? f(t) : f)), qq = Math.max(0.1, typeof q === 'function' ? q(t) : q);
    const w = (TAU * ff) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * qq);
    let B0, B1, B2, A0, A1, A2;
    if (type === 'lowpass') { B0 = (1 - c) / 2; B1 = 1 - c; B2 = B0; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else if (type === 'highpass') { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = B0; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else if (type === 'bandpass') { B0 = al; B1 = 0; B2 = -al; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else { const A = Math.pow(10, gainDb / 40); B0 = 1 + al * A; B1 = -2 * c; B2 = 1 - al * A; A0 = 1 + al / A; A1 = -2 * c; A2 = 1 - al / A; }
    b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = A1 / A0; a2 = A2 / A0;
  };
  set(0);
  for (let i = 0; i < n; i++) {
    if (vary && (i & 15) === 0) set(i / SR);
    const v = x[i], o = b0 * v + z1;
    z1 = b1 * v - a1 * o + z2; z2 = b2 * v - a2 * o; y[i] = o;
  }
  return y;
}
/** Band-limited oscillator; `f` is a number or a function of time. */
function osc(n, f, shape = 'sin', phase0 = 0) {
  const o = new Float32Array(n); let ph = phase0;
  const blep = (t, dt) => (t < dt ? ((t /= dt), t + t - t * t - 1) : t > 1 - dt ? ((t = (t - 1) / dt), t * t + t + t + 1) : 0);
  for (let i = 0; i < n; i++) {
    const ff = typeof f === 'function' ? f(i / SR) : f, dt = ff / SR;
    if (shape === 'sin') o[i] = Math.sin(TAU * ph);
    else if (shape === 'saw') o[i] = 2 * ph - 1 - blep(ph, dt);
    else if (shape === 'sq') o[i] = (ph < 0.5 ? 1 : -1) + blep(ph, dt) - blep((ph + 0.5) % 1, dt);
    else o[i] = 1 - 4 * Math.abs(ph - 0.5);
    ph += dt; if (ph >= 1) ph -= 1;
  }
  return o;
}
/** One ringing mode added into `out`: a decaying sine with a soft `att`-second attack. */
function partial(out, at, f, amp, dec, att = 0) {
  if (f > SR * 0.46 || f < 20) return;
  const w = (TAU * f) / SR, n = Math.min(out.length - at, Math.ceil(dec * SR * 9.2));
  for (let i = 0; i < n; i++) { const t = i / SR; out[at + i] += amp * Math.exp(-t / dec) * Math.sin(w * i) * (att ? Math.min(1, t / att) : 1); }
}
/** A struck piece of metal: inharmonic modes that die faster the higher they are, each with a detuned twin (beating), a noise click, an optional thud. */
function strike(dur, o) {
  const out = new Float32Array(N(dur)), r = rng(o.seed || 1), at = N(o.at || 0);
  o.ratios.forEach((ra, k) => {
    const f = o.f0 * ra * (1 + (r() - 0.5) * 0.012);
    const tilt = Math.min(2, Math.max(0.15, Math.pow(f / 2500, o.tilt ?? 0)));
    const a = (o.amps ? o.amps[k] : 1 / (1 + k * 0.42)) * (0.65 + 0.7 * r()) * (o.amp ?? 1) * tilt;
    const d = (o.decay / (1 + Math.pow(Math.max(0, ra - 1), 0.9) * (o.damp ?? 0.28))) * (f < (o.lowBelow ?? 0) ? (o.lowDecay ?? 1) : 1);
    partial(out, at, f, a, d, o.att);
    partial(out, at, f * (1.0015 + 0.004 * r()), a * 0.55, d * 0.9, o.att);
  });
  if (o.hit !== 0) {
    const ms = o.hitMs ?? 5, tn = N((ms / 1000) * 6), w = bq(white(tn, (o.seed || 1) + 7), 'highpass', o.hitHp ?? 1800, 0.7);
    for (let i = 0; i < tn && at + i < out.length; i++) out[at + i] += w[i] * Math.exp(-i / ((SR * ms) / 1000)) * (o.hit ?? 0.6) * (o.amp ?? 1);
  }
  if (o.thud) thud(out, at, o.thud);
  return out;
}
function thud(out, at, t) {
  const n = Math.min(out.length - at, N(t.dec * 8)); let ph = 0;
  for (let i = 0; i < n; i++) { const s = i / SR, f = expi(t.f0, t.f1, s / (t.dec * 2.5)); ph += f / SR; out[at + i] += Math.sin(TAU * ph) * Math.exp(-s / t.dec) * t.amp; }
}
/** Air: noise through a band-pass whose centre sweeps fa → fb → fc, with a swell and a fall. */
function whoosh(dur, o) {
  const n = N(dur), pk = o.peak ?? 0.5;
  const fF = (t) => { const u = t / dur; return u < pk ? expi(o.fa, o.fb, u / pk) : expi(o.fb, o.fc, (u - pk) / (1 - pk)); };
  let y = bq(white(n, o.seed || 3), 'bandpass', fF, o.q ?? 1.4);
  if (o.body) { const b = bq(white(n, (o.seed || 3) + 11), 'bandpass', (t) => fF(t) * 0.35, 0.9); for (let i = 0; i < n; i++) y[i] += b[i] * o.body; }
  const g = (o.gain ?? 1) * 2.6 * Math.sqrt(o.q ?? 1.4);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] *= (u < pk ? Math.pow(u / pk, o.rise ?? 2) : Math.pow(1 - (u - pk) / (1 - pk), o.fall ?? 1.6)) * g; }
  return y;
}
/** A servo: a motor that spins up from below `fa`, glides to `fb` and spins down, with gear grit and a stop click. */
function servo(dur, o) {
  const n = N(dur), up = o.up ?? 0.18, down = o.down ?? 0.16;
  const f = (t) => { const u = t / dur; return lerp(o.fa, o.fb, smooth(u)) * (0.62 + 0.38 * smooth(u / up)) * (0.7 + 0.3 * smooth((1 - u) / down)) * (1 + 0.012 * Math.sin(TAU * 23 * t)); };
  const a = osc(n, f, 'saw'), b = osc(n, (t) => f(t) * 2.005, 'sq'), c = osc(n, (t) => f(t) * 0.5, 'sin');
  const gate = osc(n, (t) => f(t) * (o.teeth ?? 6), 'sq'), nz = white(n, o.seed || 5);
  for (let i = 0; i < n; i++) nz[i] *= 0.5 + 0.5 * gate[i];
  const grit = bq(nz, 'bandpass', o.gearF ?? 2800, 3);
  let y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = a[i] * 0.55 + b[i] * 0.22 + c[i] * 0.2 + grit[i] * (o.grit ?? 0.3) * 4;
  y = bq(bq(y, 'peak', o.formant ?? 1300, 1.1, 9), 'highpass', o.hp ?? 140, 0.7);
  const att = N(0.012), rel = N(0.03);
  for (let i = 0; i < n; i++) y[i] *= Math.min(1, i / att) * Math.min(1, (n - i) / rel) * (0.85 + 0.15 * Math.sin((TAU * 31 * i) / SR));
  return y;
}
/** Sparse electric crackle: random clicks whose rate falls from `rate` per second to nothing. */
function crackle(dur, o) {
  const n = N(dur), y = new Float32Array(n), r = rng(o.seed || 9);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    if (r() < ((o.rate ?? 400) * Math.pow(1 - u, o.fall ?? 1.5)) / SR) { const a = (0.3 + 0.7 * r()) * (r() < 0.5 ? 1 : -1), L = 20 + Math.floor(r() * 60); for (let k = 0; k < L && i + k < n; k++) y[i + k] += a * (r() * 2 - 1) * Math.exp(-k / (L * 0.3)); }
  }
  return bq(y, 'highpass', o.hp ?? 3500, 0.7);
}

// ---- stereo
const st = (sec) => ({ L: new Float32Array(N(sec)), R: new Float32Array(N(sec)) });
/** Mix a mono buffer in at `at` seconds; `pan` −1…1 or [from, to] for a move across the buffer. */
function put(dst, m, at = 0, gain = 1, pan = 0) {
  const o = N(at) - 1, n = Math.min(m.length, dst.L.length - Math.max(0, o));
  for (let i = 0; i < n; i++) {
    const p = Array.isArray(pan) ? lerp(pan[0], pan[1], i / m.length) : pan, a = ((p + 1) * Math.PI) / 4, k = Math.max(0, o) + i;
    dst.L[k] += m[i] * gain * Math.cos(a) * 1.414; dst.R[k] += m[i] * gain * Math.sin(a) * 1.414;
  }
  return dst;
}
function putSt(dst, s, at = 0, gain = 1) {
  const o = Math.max(0, N(at) - 1), n = Math.min(s.L.length, dst.L.length - o);
  for (let i = 0; i < n; i++) { dst.L[o + i] += s.L[i] * gain; dst.R[o + i] += s.R[i] * gain; }
  return dst;
}
/** Freeverb: eight damped combs into four all-passes per side; returns dry + wet with `tail` seconds added. */
function reverb(s, o = {}) {
  const room = o.room ?? 0.8, damp = o.damp ?? 0.3, wet = o.wet ?? 0.2, n = s.L.length + N(o.tail ?? 1.2), out = st(n / SR);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  const inp = new Float32Array(n), fo = N(0.04), m0 = s.L.length;
  s = mapSt(s, (x) => { const y = Float32Array.from(x); for (let i = 0; i < fo && i < m0; i++) y[m0 - 1 - i] *= i / fo; return y; });
  for (let i = 0; i < m0; i++) inp[i] = (s.L[i] + s.R[i]) * 0.5;
  ['L', 'R'].forEach((ch, ci) => {
    const acc = new Float32Array(n);
    for (const c of combs) {
      const len = c + ci * 23, buf = new Float32Array(len); let idx = 0, fs = 0;
      for (let i = 0; i < n; i++) { const y = buf[idx]; fs = y * (1 - damp) + fs * damp; buf[idx] = inp[i] * 0.06 + fs * room; acc[i] += y; if (++idx >= len) idx = 0; }
    }
    for (const a of aps) {
      const len = a + ci * 23, buf = new Float32Array(len); let idx = 0;
      for (let i = 0; i < n; i++) { const b = buf[idx], v = acc[i]; acc[i] = b - v; buf[idx] = v + b * 0.5; if (++idx >= len) idx = 0; }
    }
    const d = out[ch], src = s[ch];
    for (let i = 0; i < n; i++) d[i] = (i < src.length ? src[i] : 0) + acc[i] * wet;
  });
  return out;
}
function mapSt(s, fn) { return { L: fn(s.L, 0), R: fn(s.R, 1) }; }
/** Remove DC, fade the edges, bring the peak to `peak`. */
function finish(s, peak = 0.89, fadeOut = 0.02) {
  const o = mapSt(s, (x) => bq(x, 'highpass', 24, 0.7)); let m = 1e-9;
  const n = o.L.length, fi = N(0.002), fo = N(fadeOut);
  for (const ch of [o.L, o.R]) for (let i = 0; i < n; i++) { ch[i] *= Math.min(1, i / fi) * Math.min(1, (n - 1 - i) / fo); m = Math.max(m, Math.abs(ch[i])); }
  const g = peak / m;
  for (const ch of [o.L, o.R]) for (let i = 0; i < n; i++) ch[i] *= g;
  return o;
}
function wav(s) {
  const n = s.L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.R[i])) * 32767), 46 + i * 4); }
  return b;
}
module.exports = { SR, TAU, N, rng, smooth, expi, lerp, white, pink, bq, osc, partial, strike, thud, whoosh, servo, crackle, st, put, putSt, reverb, mapSt, finish, wav };
