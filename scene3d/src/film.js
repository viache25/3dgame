// The 15 seconds, second cut: Luna draws and fights from the middle guard with both hands; the hoplite's thrusts are meant to kill
// and are beaten aside; blows land in two frames, hold for a beat and throw the other body back. update(t) sets the whole scene for time t.
function buildFilm(ctx) {
  const { hoplite, luna, fx, camera, W } = ctx;
  const E = { lin: (u) => u, io: smooth, in: (u) => u * u, out: (u) => 1 - (1 - u) * (1 - u), in3: (u) => u * u * u, out3: (u) => 1 - Math.pow(1 - u, 3), snap: (u) => 1 - Math.pow(1 - u, 5),
    back: (u) => { const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); } };
  function smooth(u) { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); }
  const clamp01 = (u) => Math.min(1, Math.max(0, u));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const L3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const mixP = (a, b, k) => { const o = {}; for (const key in a) { const x = a[key], y = b[key] === undefined ? x : b[key]; o[key] = Array.isArray(x) ? x.map((v, i) => v + ((y[i] === undefined ? v : y[i]) - v) * k) : typeof x === 'number' ? x + (y - x) * k : x; } return o; };
  function evalTrack(tr, t) {
    if (t <= tr[0].t) return clone(tr[0].p);
    for (let i = 0; i < tr.length - 1; i++) {
      const a = tr[i], b = tr[i + 1];
      if (t < b.t) {
        const u = (t - a.t) / (b.t - a.t), p = mixP(a.p, b.p, E[b.e || 'io'](u)), s = Math.sin(Math.PI * u);
        if (b.lift) { if (b.lift.R) { p.fR[1] += b.lift.R * s; p.fR[4] = 0.5 * s * Math.cos(Math.PI * u); } if (b.lift.L) { p.fL[1] += b.lift.L * s; p.fL[4] = 0.5 * s * Math.cos(Math.PI * u); } }
        if (b.hipArc) p.hip[1] += b.hipArc * s;
        return p;
      }
    }
    return clone(tr[tr.length - 1].p);
  }
  // frames of reference: the hoplite faces +x (his left is −z), Luna faces −x (her left is +z, the camera's side)
  const hl = (x, w) => [-w[2], w[1], w[0] - x], hlD = (v) => [-v[2], v[1], v[0]];
  const ll = (x, w) => [w[2], w[1], x - w[0]];
  /** Luna's right-hand grip so that her blade, pointing `dir` in her frame, passes through world point `c` at `s` metres from the guard. */
  const bladeTo = (x, c, dir, s) => { const d = nrm(dir), p = ll(x, c); return [p[0] - d[0] * (s + 0.1), p[1] - d[1] * (s + 0.1), p[2] - d[2] * (s + 0.1)]; };
  /** A point of the spear in the world for a hoplite pose, `along` metres from the fist toward the point. */
  const spearPt = (p, along) => { const d = nrm(p.spD); return [p.x + p.spG[2] + d[2] * along, p.spG[1] - 0.06 + d[1] * along, -(p.spG[0] + d[0] * along)]; };
  const TIP = hoplite.spear.userData.tip, HS = EV.hitStop;

  // ================= the hoplite
  const HB = { x: -1.7, z: 0, yaw: 0, hip: [0, 0.86, 0], hipYaw: 0.3, hipPitch: 0, hipRoll: 0, spine: [0.17, 0.25, 0], head: [-0.08, -0.5],
    fR: [-1.28, 0.09, -0.17, -0.1, 0], fL: [-2.2, 0.09, 0.23, 0.75, 0], kneeR: -0.12, kneeL: 0.55,
    shC: [-0.25, 1.04, 0.42], shN: [-0.66, 0.1, 0.74], shRoll: -0.12, spHold: 1, spG: [0.3, 1.62, -0.08], spD: [-0.07, -0.05, 1], elbL: [0.55, -0.35, -0.75], cape: 0, crest: 1, visor: 1 };
  const G = (x, o = {}, f = {}) => { const p = Object.assign(clone(HB), clone(o)); p.x = x; p.fR[0] = f.rw === undefined ? x + 0.42 : f.rw; p.fL[0] = f.lw === undefined ? x - 0.5 : f.lw; return p; };
  const Gc = (x, o = {}, f) => G(x, Object.assign({ crest: 0.55 }, o), f);
  const HT = [], hk = (t, p, e, x) => HT.push(Object.assign({ t, p, e }, x || {}));
  const low = { hip: [0, 0.79, 0.04], spine: [0.3, 0.25, 0], head: [-0.2, -0.5], shC: [-0.2, 1.16, 0.47], shN: [-0.55, 0.05, 0.83], spG: [0.3, 1.56, -0.14] };
  const run = { hip: [0, 0.78, 0.14], spine: [0.46, 0.2, 0], head: [-0.32, -0.45], shC: [-0.16, 1.2, 0.5], shN: [-0.45, 0.05, 0.9], spG: [0.32, 1.6, -0.2], spD: [-0.05, -0.08, 1], cape: 0.6 };
  const runA = Object.assign({}, run, { spine: [0.46, 0.02, 0] }), runB = Object.assign({}, run, { spine: [0.46, 0.4, 0] });
  const guardHi = { hip: [0, 0.76, 0], spine: [0.1, 0.2, 0], head: [-0.2, -0.4], shC: [-0.16, 1.45, 0.48], shN: [-0.2, 0.55, 0.8], spG: [0.36, 1.45, -0.3], spD: [-0.05, 0.15, 1], cape: 0.5 };
  const crushed = { hip: [0, 0.64, -0.14], spine: [-0.08, 0.15, 0.06], head: [0.12, -0.35], shC: [-0.18, 1.2, 0.34], shN: [-0.3, 0.5, 0.8], spG: [0.42, 1.32, -0.36], spD: [-0.1, 0.38, 1], cape: -0.15 };
  const skid = { hip: [0, 0.7, 0], spine: [0.38, 0.3, 0], head: [-0.25, -0.5], shC: [-0.25, 0.9, 0.45], shN: [-0.66, 0.1, 0.74], spG: [0.36, 1.25, -0.1], spD: [-0.05, 0.25, 1], cape: 0.3 };
  // the thrust: coil with the spear far back, then the whole body behind the point
  const cocked = (y) => ({ hip: [0, 0.84, -0.1], hipYaw: 0.45, spine: [0.04, 0.5, 0], head: [-0.08, -0.92], spG: [0.4, 1.66 + (y || 0), -0.5], spD: [0, 0.1 + (y || 0) * 1.4, 1], shC: [-0.3, 1.15, 0.5], shN: [-0.5, 0.1, 0.85], elbL: [0.6, -0.2, -0.75], cape: 0.1 });
  const coil = (y) => Object.assign(cocked(y), { hip: [0, 0.78, -0.2], spine: [-0.03, 0.62, 0], spG: [0.44, 1.62 + (y || 0), -0.62], head: [-0.06, -1.05] });
  const thrustHi = { hip: [0, 0.74, 0.3], hipYaw: 0, spine: [0.42, -0.4, 0], head: [-0.3, 0.35], spG: [0.12, 1.52, 0.9], spD: [0, 0.27, 1], elbL: [0.3, -0.8, -0.3], shC: [-0.38, 1.0, 0.38], shN: [-0.8, 0.05, 0.6], cape: 0.75 };
  const defl1 = Object.assign({}, thrustHi, { spine: [0.36, -0.52, 0.08], spG: [0.2, 1.58, 0.84], spD: [0.26, 0.4, 1] });
  const thrustLo = Object.assign({}, thrustHi, { spG: [0.14, 1.3, 0.88], spD: [0, -0.07, 1], head: [-0.25, 0.35] });
  const pinned = Object.assign({}, thrustHi, { hip: [0, 0.68, 0.32], spine: [0.6, -0.35, 0], head: [-0.45, 0.3], spG: [0.14, 1.02, 0.86], spD: [0.06, -0.62, 1], shC: [-0.42, 0.9, 0.5], shN: [-0.8, 0.1, 0.6] });
  const blockHi = { hip: [0, 0.76, 0.05], hipYaw: 0.2, spine: [0.12, 0.25, 0], head: [-0.1, -0.42], shC: [-0.12, 1.5, 0.42], shN: [-0.35, 0.3, 0.88], spG: [0.32, 1.1, 0.3], spD: [0.1, -0.3, 1], elbL: [0.5, -0.6, -0.5], cape: 0.2 };
  const blockHit = Object.assign({}, blockHi, { hip: [0, 0.7, -0.03], shC: [-0.14, 1.42, 0.34], spine: [0.04, 0.25, 0.04] });
  const bashCoil = Object.assign({}, blockHi, { hip: [0, 0.7, -0.08], spine: [0.2, 0.1, 0], shC: [-0.18, 1.3, 0.3], shN: [-0.3, 0.15, 0.94] });
  const bash = { hip: [0, 0.76, 0.3], hipYaw: 0.4, spine: [0.36, 0.5, 0], head: [-0.25, -0.85], shC: [-0.08, 1.36, 0.84], shN: [-0.12, 0.1, 0.98], spG: [0.42, 1.4, -0.3], spD: [0, 0.15, 1], cape: 0.7 };
  const alert = { head: [-0.45, -0.45], spG: [0.36, 1.35, -0.05], spD: [0.02, 0.2, 1] };
  hk(0, G(-1.7)); hk(2.0, G(-1.7)); hk(2.01, G(-3.6), 'lin'); hk(EV.shots[2], G(-3.6));
  hk(3.98, G(-3.6, low), 'io');
  hk(EV.steps[0], G(-3.3, runA, { rw: -3.18, lw: -3.0 }), 'in', { lift: { L: 0.22 }, hipArc: 0.04 });
  hk(EV.steps[1], G(-2.3, runB, { rw: -1.8, lw: -3.0 }), 'lin', { lift: { R: 0.3 }, hipArc: 0.06 });
  hk(EV.steps[2], G(-1.35, runA, { rw: -1.8, lw: -0.85 }), 'lin', { lift: { L: 0.3 }, hipArc: 0.06 });
  hk(EV.steps[3], G(-0.6, runB, { rw: -0.1, lw: -0.85 }), 'lin', { lift: { R: 0.26 }, hipArc: 0.05 });
  hk(EV.cut1 - 0.02, G(-0.5, guardHi, { rw: -0.1, lw: -0.85 }), 'out');
  hk(EV.cut1 + 0.04, G(-0.53, Object.assign({}, guardHi, { hip: [0, 0.7, -0.04], shC: [-0.16, 1.38, 0.42] }), { rw: -0.1, lw: -0.85 }), 'out');
  hk(EV.slowEnd, G(-0.74, crushed, { rw: -0.32, lw: -1.0 }), 'out');
  hk(EV.skidEnd, G(-1.9, skid, { rw: -1.45, lw: -2.4 }), 'out3');
  hk(6.9, G(-1.9, {}, { rw: -1.48, lw: -2.4 }), 'io'); hk(7.0, G(-1.9, {}, { rw: -1.48, lw: -2.4 }));
  const T1 = G(-1.25, thrustHi, { rw: -0.6, lw: -1.65 }), T2 = G(-1.25, thrustLo, { rw: -0.6, lw: -1.65 }), PIN = G(-1.25, pinned, { rw: -0.6, lw: -1.65 });
  hk(7.18, G(-1.6, cocked(0), { rw: -1.18, lw: -2.05 }), 'io', { lift: { R: 0.1, L: 0.08 } });
  hk(EV.thrust1 - 0.07, G(-1.63, coil(0), { rw: -1.18, lw: -2.05 }), 'out');
  hk(EV.thrust1, T1, 'in3', { lift: { R: 0.07 } }); hk(EV.thrust1 + HS, T1);
  hk(EV.thrust1 + HS + 0.07, G(-1.25, defl1, { rw: -0.6, lw: -1.65 }), 'out3');
  hk(7.72, G(-1.5, cocked(-0.22), { rw: -1.05, lw: -1.95 }), 'io', { lift: { R: 0.06 } });
  hk(EV.thrust2 - 0.07, G(-1.53, coil(-0.22), { rw: -1.05, lw: -1.95 }), 'out');
  hk(EV.thrust2, T2, 'in3', { lift: { R: 0.07 } });
  hk(EV.floor, PIN, 'in'); hk(8.16, PIN);
  hk(EV.cut2, G(-1.25, blockHi, { rw: -0.6, lw: -1.65 }), 'in3'); hk(EV.cut2 + 0.03, G(-1.27, blockHit, { rw: -0.6, lw: -1.65 }), 'out'); hk(EV.cut2 + HS, G(-1.27, blockHit, { rw: -0.6, lw: -1.65 }));
  hk(EV.bash - 0.07, G(-1.3, bashCoil, { rw: -0.6, lw: -1.65 }), 'io');
  hk(EV.bash, G(-0.95, bash, { rw: -0.38, lw: -1.6 }), 'in3', { lift: { R: 0.07 } }); hk(EV.bash + HS, G(-0.95, bash, { rw: -0.38, lw: -1.6 }));
  const f5 = { rw: -0.5, lw: -1.5 };
  hk(8.95, G(-0.95, {}, f5), 'io'); hk(9.2, G(-0.95, {}, f5));
  hk(9.6, G(-0.95, alert, f5), 'io'); hk(10.12, G(-0.95, alert, f5));
  // the crescents come for his head and his body: a late block, a blow of the spear, a duck
  const HANG = [[0.35, 2.9, 0.12], [0.85, 2.7, -0.1], [-0.1, 3.0, -0.05], [1.3, 2.55, 0.1], [1.75, 2.35, -0.05]];
  const AIM = [[-0.92, 1.7, 0.0], [-0.9, 1.3, 0.0], [-0.95, 1.92, 0.0]];
  const D1 = nrm([AIM[0][0] - HANG[0][0], AIM[0][1] - HANG[0][1], AIM[0][2] - HANG[0][2]]), I1 = [AIM[0][0] - D1[0] * 0.2, AIM[0][1] - D1[1] * 0.2, AIM[0][2] - D1[2] * 0.2 + 0.1];
  const block1 = { hip: [0, 0.88, -0.04], spine: [-0.04, 0.2, 0], head: [-0.3, -0.42], shC: hl(-0.95, I1), shN: hlD([-D1[0], -D1[1], -D1[2] + 0.25]), spG: [0.38, 1.3, -0.15], spD: [0.02, 0.2, 1] };
  const P2 = [HANG[1][0] + (AIM[1][0] - HANG[1][0]) * 0.42, HANG[1][1] + (AIM[1][1] - HANG[1][1]) * 0.42, HANG[1][2] + (AIM[1][2] - HANG[1][2]) * 0.42];
  const swatG = [0.3, 1.22, 0.25], swatFrom = { hip: [0, 0.78, -0.06], spine: [0.1, 0.45, 0], head: [-0.35, -0.75], spG: [0.4, 1.05, -0.2], spD: [0.15, -0.35, 1], shC: [-0.3, 1.1, 0.4], elbL: [0.6, -0.5, -0.5] };
  const swat = { hip: [0, 0.82, 0.1], hipYaw: 0.1, spine: [0.05, -0.2, 0], head: [-0.4, 0.05], spG: swatG, spD: hlD([P2[0] - (-1.1 + swatG[2]), P2[1] - (swatG[1] - 0.06), P2[2] + swatG[0]]), shC: [-0.42, 1.0, 0.2], shN: [-0.8, 0.1, 0.55], elbL: [0.4, -0.7, -0.4], cape: 0.4 };
  const duck = { hip: [0, 0.56, 0.02], spine: [0.62, 0.25, 0], head: [0.05, -0.4], shC: [-0.22, 1.02, 0.36], shN: [-0.35, 0.7, 0.6], spG: [0.36, 0.95, 0.05], spD: [0.05, 0.1, 1], cape: 0.5 };
  const f6 = { rw: -0.66, lw: -1.62 };
  hk(EV.falls[0] - 0.07, G(-0.95, alert, f5));
  hk(EV.falls[0], G(-0.97, block1, f5), 'in3'); hk(EV.falls[0] + 0.04, G(-1.06, Object.assign({}, block1, { hip: [0, 0.74, -0.1], spine: [-0.12, 0.2, 0] }), f6), 'out'); hk(EV.falls[0] + HS + 0.02, G(-1.08, Object.assign({}, block1, { hip: [0, 0.74, -0.1], spine: [-0.12, 0.2, 0] }), f6));
  hk(EV.falls[1] - 0.09, G(-1.1, swatFrom, f6), 'io');
  hk(EV.falls[1], G(-1.1, swat, f6), 'in3'); hk(EV.falls[1] + HS, G(-1.1, swat, f6));
  hk(EV.falls[2] - 0.11, G(-1.1, { head: [-0.5, -0.45], spG: [0.36, 1.3, 0.0], spD: [0.05, 0.3, 1] }, f6), 'io');
  hk(EV.falls[2] - 0.012, G(-1.1, duck, f6), 'in'); hk(EV.falls[2] + 0.012, Gc(-1.1, duck, f6), 'lin'); hk(EV.floor3 + 0.06, Gc(-1.1, duck, f6));
  const wind = { hip: [0, 0.82, -0.12], hipYaw: 0.45, spine: [0, 0.5, 0], head: [-0.1, -0.9], spG: [0.42, 1.72, -0.5], spD: [0, 0.03, 1], shC: [-0.3, 1.1, 0.5], shN: [-0.5, 0.1, 0.85], elbL: [0.6, -0.2, -0.75] };
  const rel = { hip: [0, 0.78, 0.28], hipYaw: 0.02, spine: [0.44, -0.4, 0], head: [-0.3, 0.3], spG: [0.14, 1.6, 0.86], spD: [0, -0.01, 1], shC: [-0.38, 1.0, 0.38], shN: [-0.8, 0.05, 0.6], elbL: [0.3, -0.8, -0.3], cape: 0.7 };
  const follow = Object.assign({}, rel, { spG: [0.12, 0.92, 0.78], spine: [0.56, -0.5, 0], head: [-0.35, 0.4] });
  const reach = { spG: [0.6, 1.4, 0.42], spD: [-0.12, 0.34, 1], head: [-0.08, -0.05], spine: [0.08, -0.1, 0], elbL: [0.5, -0.85, -0.2] };
  hk(EV.release - 0.1, Gc(-1.1, wind, f6), 'io');
  hk(EV.release - 0.045, Gc(-1.12, Object.assign({}, wind, { hip: [0, 0.78, -0.2], spine: [-0.04, 0.62, 0], spG: [0.46, 1.7, -0.62] }), f6), 'out');
  hk(EV.release + 0.02, Gc(-0.85, rel, { rw: -0.25, lw: -1.5 }), 'in3', { lift: { R: 0.07 } });
  hk(EV.release + 0.2, Gc(-0.85, follow, { rw: -0.25, lw: -1.5 }), 'out3'); hk(11.795, Gc(-0.85, follow, { rw: -0.25, lw: -1.5 }));
  const f7 = { rw: -2.18, lw: -3.1 };
  hk(11.8, Gc(-2.6, reach, f7), 'lin'); hk(EV.lock, Gc(-2.6, reach, f7));
  hk(EV.dash, Gc(-2.6, cocked(-0.12), f7), 'io');
  hk(EV.dashSteps[0], Gc(-2.3, runA, { rw: -2.18, lw: -2.0 }), 'in', { lift: { L: 0.22 }, hipArc: 0.04 });
  hk(EV.dashSteps[1], Gc(-1.95, Object.assign({}, runB, { spG: [0.4, 1.5, -0.5], spD: [0, -0.02, 1] }), { rw: -1.0, lw: -2.0 }), 'lin', { lift: { R: 0.26 }, hipArc: 0.05 });
  const fin = Object.assign({}, thrustHi, { spG: [0.14, 1.45, 0.9], spD: [0, -0.03, 1], head: [-0.3, 0.35] });
  const FIN = Gc(-1.6, fin, { rw: -1.0, lw: -2.0 });
  hk(EV.clash, FIN, 'in3');

  // ================= Luna
  const LB = { x: 1.7, z: 0, yaw: 0, hip: [0, 1.158, 0], hipYaw: 0.2, hipPitch: 0, hipRoll: 0, waist: [0.04, 0.16, 0], chest: 0.03, neck: -0.02, head: [-0.05, 0.32, 0],
    fR: [1.45, 0.1, -0.1, -0.05, 0], fL: [1.93, 0.1, 0.15, 0.6, 0], kneeR: -0.05, kneeL: 0.4,
    kD: 0, kW: 0, kG: [-0.1, 1.3, 0.4], kDir: [0, 0.27, 1], kUp: [0, -1, 0.27], elbR: [-0.7, -0.25, -0.65], elbL: [0.55, 0.1, -0.85], hLw: 0, eyes: 2, bEyes: 0, mane: 0, maneZ: 0, sayaTilt: 0 };
  const S0 = (x, o = {}, f = {}) => { const p = Object.assign(clone(LB), clone(o)); p.x = x; p.fR[0] = f.rw === undefined ? x - (f.r === undefined ? 0.25 : f.r) : f.rw; p.fL[0] = f.lw === undefined ? x - (f.l === undefined ? -0.23 : f.l) : f.lw; return p; };
  const LT = [], lk = (t, p, e, x) => LT.push(Object.assign({ t, p, e }, x || {}));
  // the stances: the blade is out for the rest of the fight, both hands on the hilt, the edge toward the enemy
  const two = { kW: 1, kD: 1.26, hLw: 1, bEyes: 6, hipYaw: 0.06, elbR: [-0.8, -0.5, -0.3], elbL: [0.8, -0.5, -0.3] };
  const chudan = Object.assign({}, two, { kG: [0.03, 1.3, 0.36], kDir: [0, 0.27, 1], kUp: [0, -1, 0.27], hip: [0, 1.12, 0.02], waist: [0.06, 0, 0], chest: 0.02, head: [-0.06, 0, 0], eyes: 4 });
  const jodan = Object.assign({}, two, { kG: [0.03, 2.2, 0.12], kDir: [0, 0.72, -0.69], kUp: [0, 0.69, 0.72], hip: [0, 1.15, 0], waist: [-0.06, 0, 0], head: [-0.02, 0, 0], elbR: [-1, 0.25, 0.2], elbL: [1, 0.25, 0.2], eyes: 4 });
  const hasso = Object.assign({}, two, { kG: [-0.2, 1.76, 0.32], kDir: [-0.08, 0.98, 0.12], kUp: [0, -0.12, 1], hip: [0, 1.1, 0.05], waist: [0.05, -0.3, 0], head: [-0.05, 0.3, 0], elbR: [-0.9, -0.3, -0.2], elbL: [0.3, -0.9, 0.2], eyes: 5 });
  const cf = { r: 0.3, l: -0.25 }, sf = { r: 0.62, l: -0.5 };
  const C1 = [0.0, 1.47, 0.16], C1b = [-0.36, 1.26, 0.18];
  const kesaHit = Object.assign({}, two, { kG: bladeTo(1.5, C1, [0.2, -0.3, 0.93], 0.55), kDir: [0.2, -0.3, 0.93], kUp: [0, -1, -0.3], hip: [0, 1.0, 0.25], waist: [0.3, 0.12, 0], chest: 0.08, head: [-0.32, 0, 0], eyes: 4, mane: 0.5, elbR: [-0.7, -0.7, 0], elbL: [0.7, -0.7, 0] });
  const kesaPush = Object.assign({}, kesaHit, { kG: bladeTo(1.22, C1b, [0.25, -0.5, 0.83], 0.6), kDir: [0.25, -0.5, 0.83], kUp: [0, -0.85, -0.5], hip: [0, 0.94, 0.3], waist: [0.42, 0.18, 0], head: [-0.4, 0, 0], mane: 0.15 });
  const kesaMid = Object.assign({}, two, { kG: [0.03, 1.98, 0.62], kDir: [0.06, 0.5, 0.86], kUp: [0, -0.86, 0.5], hip: [0, 1.08, 0.16], waist: [0.12, 0.05, 0], head: [-0.14, 0, 0], eyes: 4, mane: 0.3, elbR: [-0.9, -0.2, 0.1], elbL: [0.9, -0.2, 0.1] });
  const kesaEnd = Object.assign({}, two, { kG: [0.2, 0.98, 0.5], kDir: [0.45, -0.5, 0.74], kUp: [0.3, -0.8, -0.5], hip: [0, 0.96, 0.22], waist: [0.36, 0.3, 0], head: [-0.34, -0.25, 0], eyes: 4, elbR: [-0.6, -0.7, -0.2], elbL: [0.6, -0.6, -0.4] });
  // against the spear: knock the shaft off its line, never wait for it
  const cp1 = spearPt(T1, TIP - 0.55), cp2 = spearPt(T2, TIP - 1.25), cp3 = spearPt(PIN, TIP - 1.25);
  const parryPre = Object.assign({}, chudan, { kG: [0.22, 1.22, 0.3], kDir: [-0.05, 0.55, 0.83], kUp: [0.3, -0.8, 0.5], waist: [0.04, 0.2, 0] });
  const parryD = [-0.42, 0.78, 0.46];
  const parry = Object.assign({}, chudan, { kG: bladeTo(1.3, cp1, parryD, 0.45), kDir: parryD, kUp: [0.85, 0.3, 0.4], hip: [0.1, 1.12, -0.03], waist: [0.0, -0.3, 0], head: [-0.04, 0.15, 0], mane: 0.2, maneZ: 0.2 });
  const parryThru = Object.assign({}, parry, { kG: [parry.kG[0] - 0.24, parry.kG[1] + 0.1, parry.kG[2] - 0.05], kDir: [-0.6, 0.72, 0.35], waist: [0.0, -0.45, 0] });
  const beatUp = Object.assign({}, chudan, { kG: [-0.05, 1.76, 0.46], kDir: [-0.1, 0.92, 0.38], kUp: [0, -0.38, 0.92], hip: [0, 1.14, 0] });
  const beatD = [0.15, -0.3, 0.94], beatD2 = [0.15, -0.45, 0.88];
  const beat = Object.assign({}, chudan, { kG: bladeTo(1.3, cp2, beatD, 0.6), kDir: beatD, kUp: [0, -1, -0.3], hip: [0, 1.04, 0.12], waist: [0.22, 0.1, 0], head: [-0.22, 0, 0], mane: 0.3 });
  const press = Object.assign({}, beat, { kG: bladeTo(1.3, cp3, beatD2, 0.6), kDir: beatD2, hip: [0, 0.98, 0.16], waist: [0.3, 0.1, 0], head: [-0.3, 0, 0] });
  const C2 = [-0.8, 1.5, 0.15], cut2D = [0.4, -0.05, 0.92];
  const cut2 = Object.assign({}, two, { kG: bladeTo(0.62, C2, cut2D, 0.6), kDir: cut2D, kUp: [1, 0, -0.66], hip: [0, 1.04, 0.22], waist: [0.22, 0.5, 0], head: [-0.2, -0.45, 0], eyes: 5, mane: 0.45, elbR: [-0.7, -0.6, -0.2], elbL: [0.5, -0.8, -0.2] });
  const stagger = Object.assign({}, two, { kG: [-0.38, 1.72, 0.22], kDir: [-0.3, 0.86, 0.42], kUp: [0, -0.4, 0.9], hip: [0, 1.04, -0.16], waist: [-0.26, 0.1, 0], head: [0.16, 0, 0], eyes: 5, mane: -0.45, elbR: [-0.9, -0.2, -0.2], elbL: [0.6, -0.7, 0] });
  const waki = Object.assign({}, two, { kG: [-0.3, 0.9, -0.05], kDir: [-0.25, -0.3, -0.92], kUp: [0, -1, 0.3], hip: [0, 0.98, -0.05], waist: [0.25, 0.6, 0], head: [-0.3, -0.58, 0], eyes: 5, elbR: [-0.9, -0.2, -0.3], elbL: [0.3, -0.7, -0.6] });
  const rise = Object.assign({}, two, { kG: [0.12, 2.06, 0.42], kDir: [0.3, 0.85, 0.43], kUp: [0.3, -0.25, 0.9], hip: [0, 1.17, 0.12], waist: [-0.1, -0.25, 0], head: [0.04, 0.1, 0], eyes: 6, mane: 0.45, elbR: [-0.9, 0.2, 0], elbL: [0.9, 0.2, 0] });
  const jodan6 = Object.assign({}, jodan, { eyes: 6 }), chudan6 = Object.assign({}, chudan, { eyes: 6 }), kesaEnd6 = Object.assign({}, kesaEnd, { eyes: 6, mane: 0.4 });
  const runL = Object.assign({}, chudan6, { hip: [0, 1.0, 0.15], waist: [0.3, 0.1, 0], head: [-0.3, 0, 0], kG: [-0.22, 1.2, 0.2], kDir: [-0.25, 0.55, 0.8], kUp: [0.3, -0.75, 0.55], mane: 0.6 });
  const CLASH = spearPt(FIN, TIP - 0.04), finD = [0.14, 0.03, 0.99];
  const finL = Object.assign({}, two, { kG: bladeTo(2.62, CLASH, finD, 0.74), kDir: finD, kUp: [0.2, -1, 0], hip: [0, 0.95, 0.28], hipYaw: 0.25, waist: [0.3, 0.2, 0], head: [-0.3, -0.2, 0], eyes: 6, mane: 0.7, elbR: [-0.7, -0.6, -0.2], elbL: [0.7, -0.6, -0.2] });
  lk(0, S0(1.7)); lk(EV.headTurn - 0.03, S0(1.7));
  lk(EV.headTurn + 0.09, S0(1.7, { head: [-0.05, 0, 0] }), 'back'); lk(EV.eye3 - 0.02, S0(1.7, { head: [-0.05, 0, 0] }));
  lk(EV.eye3 + 0.16, S0(1.7, { head: [-0.05, 0, 0], eyes: 3 }), 'lin'); lk(EV.eye4 - 0.02, S0(1.7, { head: [-0.05, 0, 0], eyes: 3 }));
  lk(EV.eye4 + 0.16, S0(1.7, { head: [-0.05, 0, 0], eyes: 4 }), 'lin'); lk(EV.click - 0.01, S0(1.7, { head: [-0.05, 0, 0], eyes: 4 }));
  lk(EV.click + 0.04, S0(1.7, { head: [-0.05, 0, 0], eyes: 4, kD: 0.045 }), 'snap');
  // the draw: out along the scabbard, up, and down into the middle guard with the left hand closing on the hilt
  lk(EV.draw, S0(1.7, { head: [-0.05, 0, 0], eyes: 4, kD: 0.045 }));
  lk(EV.draw + 0.2, S0(1.7, { head: [-0.05, 0, 0], eyes: 4, kD: 1.26, bEyes: 2, waist: [0.02, -0.15, 0], elbR: [-0.6, 0.2, -0.5], hip: [0, 1.15, 0.03] }), 'in');
  lk(EV.drawEnd, S0(1.7, { head: [-0.05, 0, 0], eyes: 4, kD: 1.26, kW: 1, bEyes: 4, kG: [-0.2, 1.98, 0.3], kDir: [0.15, 0.78, 0.6], kUp: [0, -0.6, 0.8], waist: [-0.04, -0.28, 0], hip: [0, 1.16, 0.05], elbR: [-0.7, 0.3, -0.3] }), 'out');
  lk(EV.kamae, S0(1.7, chudan, cf), 'io', { lift: { R: 0.04 } }); lk(4.5, S0(1.7, chudan, cf));
  lk(4.86, S0(1.7, jodan, cf), 'io');
  lk(EV.cut1 - 0.075, S0(1.66, Object.assign({}, jodan, { kG: [0.03, 2.28, 0.02], waist: [-0.12, 0, 0] }), cf), 'out');
  lk(EV.cut1 - 0.03, S0(1.6, kesaMid, { r: 0.45, l: -0.4 }), 'in', { lift: { R: 0.04 } });
  lk(EV.cut1, S0(1.5, kesaHit, sf), 'lin');
  lk(EV.slowEnd, S0(1.22, kesaPush, sf), 'out');
  lk(6.12, S0(1.22, kesaEnd, sf), 'out3');
  lk(6.6, S0(1.3, chudan, cf), 'io', { lift: { R: 0.05 } }); lk(7.2, S0(1.3, chudan, cf));
  lk(EV.thrust1 - 0.06, S0(1.3, parryPre, cf), 'io');
  lk(EV.thrust1, S0(1.3, parry, cf), 'in3'); lk(EV.thrust1 + HS, S0(1.3, parry, cf));
  lk(EV.thrust1 + HS + 0.08, S0(1.3, parryThru, cf), 'out3');
  lk(7.68, S0(1.3, chudan, cf), 'io');
  lk(EV.thrust2 - 0.07, S0(1.3, beatUp, cf), 'out');
  lk(EV.thrust2, S0(1.3, beat, cf), 'in3'); lk(EV.floor, S0(1.3, press, cf), 'lin'); lk(8.04, S0(1.3, press, cf));
  lk(8.2, S0(0.86, hasso, { r: 0.4, l: -0.3 }), 'io', { lift: { R: 0.1, L: 0.06 } });
  lk(EV.cut2 - 0.065, S0(0.8, Object.assign({}, hasso, { kG: [-0.3, 1.82, 0.22], waist: [0.02, -0.5, 0] }), { r: 0.4, l: -0.3 }), 'out');
  lk(EV.cut2, S0(0.62, cut2, { r: 0.6, l: -0.45 }), 'in3', { lift: { R: 0.05 } }); lk(EV.cut2 + HS, S0(0.62, cut2, { r: 0.6, l: -0.45 })); lk(EV.bash - 0.02, S0(0.62, cut2, { r: 0.6, l: -0.45 }));
  lk(EV.bash + 0.05, S0(0.84, stagger, { r: 0.15, l: -0.4 }), 'out'); lk(8.78, S0(1.6, stagger, { r: 0.2, l: -0.4 }), 'out3');
  lk(9.07, S0(1.6, waki, { r: 0.4, l: -0.3 }), 'io');
  lk(EV.slash + 0.06, S0(1.5, rise, { r: 0.45, l: -0.35 }), 'in3', { lift: { R: 0.08 } }); lk(9.34, S0(1.5, rise, { r: 0.45, l: -0.35 }));
  lk(9.66, S0(2.5, jodan6, cf), 'io', { lift: { R: 0.1, L: 0.1 } });
  lk(9.98, S0(3.4, jodan6, cf), 'io', { lift: { R: 0.1, L: 0.1 } }); lk(EV.cut - 0.14, S0(3.4, jodan6, cf));
  lk(EV.cut - 0.065, S0(3.4, Object.assign({}, jodan6, { kG: [0.03, 2.28, 0.02], waist: [-0.12, 0, 0] }), cf), 'out');
  lk(EV.cut - 0.02, S0(3.33, Object.assign({}, kesaMid, { eyes: 6 }), { r: 0.45, l: -0.4 }), 'in', { lift: { R: 0.04 } });
  lk(EV.cut + 0.015, S0(3.25, kesaEnd6, sf), 'lin'); lk(11.86, S0(3.25, kesaEnd6, sf));
  lk(12.3, S0(3.4, chudan6, cf), 'io', { lift: { R: 0.06 } }); lk(EV.dash, S0(3.4, chudan6, cf));
  lk(EV.dashSteps[0], S0(3.2, runL, { rw: 3.1, lw: 2.95 }), 'in', { lift: { L: 0.12 } });
  lk(EV.dashSteps[1], S0(2.9, runL, { rw: 2.0, lw: 2.95 }), 'lin', { lift: { R: 0.14 } });
  lk(EV.clash, S0(2.62, finL, { rw: 2.0, lw: 3.05 }), 'in3');

  // ================= time: slow motion on the first cut, a stop on the last blow (for sparks and thrown things)
  const SLOW = 0.16;
  const warp = (t) => (t < EV.cut1 ? t : t < EV.slowEnd ? EV.cut1 + (t - EV.cut1) * SLOW : t < EV.freeze ? EV.cut1 + (EV.slowEnd - EV.cut1) * SLOW + (t - EV.slowEnd) : warp(EV.freeze - 1e-6) + (t - EV.freeze) * 0.03);
  const burst = (t, b) => fx.burst(Object.assign(b, { t: warp(t) }));
  const PALE = [2.4, 2.8, 3.6], PINK = [3.2, 1.0, 2.2], HOT = [3.4, 3.0, 3.0], VIO = [1.6, 0.8, 3.2], RED = [3.2, 0.5, 0.8];
  burst(EV.click, { o: [1.57, 1.2, 0.16], dir: [-0.6, 0.5, 0.6], spread: 0.9, n: 16, v: [0.5, 1.8], life: [0.1, 0.3], c0: HOT, c1: RED, g: 4 });
  EV.steps.forEach((t, i) => burst(t, { o: [evalTrack(HT, t)[i % 2 ? 'fR' : 'fL'][0], 0.03, i % 2 ? 0.17 : -0.23], dir: [-0.5, 1, 0.3], spread: 0.8, n: 10, v: [0.5, 2], life: [0.12, 0.3], c0: PINK, c1: VIO, g: 6 }));
  burst(EV.cut1, { o: C1, dir: [-0.5, 0.5, 0.7], spread: 1.0, n: 190, v: [2, 12], life: [0.25, 1.0], c0: HOT, c1: PINK, g: 6, drag: 2 });
  burst(EV.cut1, { o: C1, dir: [-0.8, -0.2, 0.2], spread: 0.6, n: 80, v: [3, 13], life: [0.2, 0.7], c0: PALE, c1: VIO, g: 3, drag: 2.5 });
  for (let t = EV.slowEnd; t < EV.skidEnd - 0.05; t += 0.05) { const p = evalTrack(HT, t); burst(t, { o: [p.fR[0], 0.03, 0.17], dir: [1, 0.6, 0.2], spread: 0.7, n: 8, v: [0.6, 3], life: [0.1, 0.32], c0: HOT, c1: PINK, g: 7 }); burst(t, { o: [p.fL[0], 0.03, -0.23], dir: [1, 0.6, 0], spread: 0.7, n: 6, v: [0.6, 2.6], life: [0.1, 0.3], c0: HOT, c1: PINK, g: 7 }); }
  burst(EV.thrust1, { o: cp1, dir: [0.3, 0.8, -0.6], spread: 1.1, n: 110, v: [2, 11], life: [0.2, 0.7], c0: HOT, c1: PINK, g: 7 });
  burst(EV.thrust2, { o: cp2, dir: [0.2, -0.6, 0.6], spread: 1.1, n: 90, v: [2, 10], life: [0.2, 0.6], c0: HOT, c1: PINK, g: 7 });
  const FLOORP = spearPt(PIN, TIP); FLOORP[1] = 0.04;
  burst(EV.floor, { o: FLOORP, dir: [0.6, 1, 0.3], spread: 1.0, n: 90, v: [1.5, 8], life: [0.2, 0.7], c0: PINK, c1: VIO, g: 8 });
  burst(EV.cut2, { o: C2, dir: [-0.3, 0.6, 0.8], spread: 1.1, n: 150, v: [2, 11], life: [0.2, 0.8], c0: HOT, c1: PALE, g: 7 });
  const BASHP = [-0.08, 1.38, 0.1];
  burst(EV.bash, { o: BASHP, dir: [1, 0.3, 0.4], spread: 0.9, n: 80, v: [2, 9], life: [0.15, 0.5], c0: PINK, c1: VIO, g: 6 });
  burst(EV.falls[0], { o: I1, dir: [0.3, 1, 0.5], spread: 1.3, n: 120, v: [2, 9], life: [0.2, 0.7], c0: PALE, c1: VIO, g: 7 });
  burst(EV.falls[1], { o: P2, dir: [0.2, 0.6, 0.6], spread: 2.2, n: 150, v: [2, 10], life: [0.2, 0.75], c0: PALE, c1: PINK, g: 6 });
  burst(EV.falls[2], { o: [-1.12, 1.6, 0.02], dir: [-0.7, 0.6, 0.2], spread: 0.9, n: 70, v: [1.5, 7], life: [0.25, 0.8], c0: PINK, c1: VIO, g: 5 });
  const D3 = nrm([AIM[2][0] - HANG[2][0], AIM[2][1] - HANG[2][1], AIM[2][2] - HANG[2][2]]), F3 = [HANG[2][0] + D3[0] * (HANG[2][1] / -D3[1]), 0.03, HANG[2][2] + D3[2] * (HANG[2][1] / -D3[1])];
  burst(EV.floor3, { o: F3, dir: [-0.5, 1, 0.2], spread: 1.0, n: 110, v: [1.5, 8], life: [0.2, 0.8], c0: PALE, c1: VIO, g: 8 });
  [3, 4].forEach((i, j) => burst(11.5 + j * 0.05, { o: HANG[i], dir: [0, -1, 0], spread: 1.6, n: 45, v: [0.5, 3], life: [0.3, 0.8], c0: PALE, c1: VIO, g: 6 }));
  // the thrown spear and Luna's cut through it
  const rel0 = (() => { hoplite.apply(evalTrack(HT, EV.release)); return { p: hoplite.spear.position.clone(), q: hoplite.spear.quaternion.clone() }; })();
  const CUTX = 1.95, VTHROW = v3((CUTX - 0.5 - rel0.p.x) / (EV.cut - EV.release), 0.0, (0 - rel0.p.z) / (EV.cut - EV.release));
  const CUTP = [CUTX, rel0.p.y, 0.0];
  burst(EV.cut, { o: CUTP, dir: [0.3, 0.6, 0.6], spread: 1.3, n: 150, v: [2, 10], life: [0.2, 0.8], c0: HOT, c1: PINK, g: 7 });
  EV.clatter.forEach((t, i) => burst(t, { o: [CUTX + 0.55 + i * 0.25, 0.04, 0.5 + i * 0.1], dir: [0.3, 1, 0.2], spread: 1, n: 12, v: [0.5, 2], life: [0.1, 0.25], c0: HOT, c1: PINK }));
  const HANDP = [-2.6 + reach.spG[2], reach.spG[1] - 0.06, -reach.spG[0]];
  burst(EV.lock, { o: HANDP, dir: [1, 0.2, 0], spread: 2, n: 60, v: [1, 5], life: [0.15, 0.45], c0: HOT, c1: PINK, g: 3 });
  burst(EV.clash, { o: CLASH, dir: [0, 0.4, 1], spread: 3, n: 340, v: [2, 13], life: [0.5, 1.6], c0: HOT, c1: PINK, g: 5, drag: 2.2, len: 0.05 });
  burst(EV.clash, { o: CLASH, dir: [0, 0.6, 0.6], spread: 2.5, n: 180, v: [2, 15], life: [0.4, 1.3], c0: PALE, c1: VIO, g: 4, drag: 2.5, len: 0.05 });

  const noise = (x) => Math.sin(x * 12.9898) * 0.6 + Math.sin(x * 78.233 + 1.3) * 0.4;
  const pulse = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
  const mats = []; [hoplite.root, hoplite.spear, luna.root, luna.katana].forEach((r) => r.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial && !mats.includes(o.material)) mats.push(o.material); }));
  const HITS = [[EV.cut1, 0.07], [EV.thrust1, 0.045], [EV.thrust2, 0.04], [EV.floor, 0.03], [EV.cut2, 0.055], [EV.bash, 0.05], [EV.falls[0], 0.045], [EV.falls[1], 0.04], [EV.falls[2], 0.02], [EV.floor3, 0.035], [EV.cut, 0.04], [EV.clash, 0.1]];
  const bladeTrail = fx.makeTrail(12), spearTrail = fx.makeTrail(12);

  function cameraAt(t, hx, lx) {
    let p, g, fov = 32;
    const K = (a, b, e) => (E[e || 'io'])(seg(t, a, b));
    if (t < EV.shots[1]) { const k = K(0, 2.0, 'lin'); p = L3([-0.3, 1.95, 10.2], [0.15, 1.42, 8.3], k); g = [0, 1.3, 0]; fov = 32; }
    else if (t < 2.85) { const h = luna.parts.head.getWorldPosition(v3()), k = K(2.0, 2.85, 'out'); g = [h.x - 0.02, h.y + 0.14, h.z + 0.02]; p = L3([g[0] - 1.05, g[1] + 0.02, g[2] + 0.62], [g[0] - 0.84, g[1], g[2] + 0.48], k); fov = 21; }
    else if (t < EV.shots[2]) { const k = K(2.85, 3.6, 'out'); p = L3([0.25, 0.72, 2.25], [0.0, 0.8, 2.6], k); g = L3([1.5, 1.45, 0.05], [1.4, 1.5, 0.0], k); fov = 37; }
    else if (t < EV.shots[3]) {
      const a = K(3.6, 4.0), b = K(4.0, 4.42), c = K(4.42, 5.0, 'lin');
      p = L3(L3([hx + 1.25, 1.78, 1.05], [hx + 1.35, 1.5, 1.7], a), [hx + 0.75, 0.34, 3.3], b); p = L3(p, [hx + 0.75, 0.32, 3.6], c);
      g = L3(L3([hx + 0.1, 1.62, 0], [hx + 0.2, 1.4, 0], a), [hx + 0.6, 1.15, 0], b); fov = 27 + 13 * b;
    }
    else if (t < EV.shots[4]) { const k = K(5.0, EV.slowEnd, 'lin'), s = K(EV.slowEnd, 6.6); p = L3(L3([0.45, 1.25, 5.3], [0.3, 1.2, 4.3], k), [-0.2, 1.2, 5.5], s); g = L3([0.35, 1.25, 0], [-0.4, 1.12, 0], s); fov = 31; }
    else if (t < EV.shots[5]) { const k = K(7.0, 10.0, 'io'), u = K(9.15, 10.0), th = -0.5 + 1.0 * k, R = 5.0 - 0.5 * k, c = [0.05 - 0.3 * u, 1.3 + 0.65 * u, 0]; p = [c[0] + Math.sin(th) * R, 1.5 - 0.7 * k, c[2] + Math.cos(th) * R]; g = c; fov = 33 + 6 * u; }
    else if (t < 11.12) { const k = K(10.0, 11.12, 'lin'); p = L3([0.5, 0.75, 3.9], [0.15, 0.8, 3.5], k); g = [-0.55, 1.62, 0]; fov = 42; }
    else if (t < 11.8) { const k = K(EV.release - 0.02, EV.cut + 0.04, 'io'); p = L3([1.0, 1.25, 6.4], [2.0, 1.3, 5.0], k); g = L3([1.0, 1.5, 0], [2.4, 1.55, 0], k); fov = 37; }
    else if (t < EV.shots[6]) { const k = K(11.8, 12.5, 'out'); p = L3([-1.5, 1.3, -1.95], [-1.62, 1.3, -1.8], k); g = [HANDP[0] + 0.02, HANDP[1] + 0.07, HANDP[2] + 0.1]; fov = 26; }
    else {
      const k = K(12.5, EV.clash, 'in'), s = E.out3(seg(t, EV.freeze, EV.pullEnd)), d = seg(t, EV.pullEnd, EV.fadeEnd), cx = CLASH[0] - 0.35;
      p = L3(L3([cx, 1.0, 7.7], [cx + 0.2, 1.05, 4.9], k), [cx - 2.04, 0.22, 9.24 + 0.25 * d], s); g = L3(L3([cx, 1.25, 0], [cx + 0.2, 1.3, 0], k), [cx + 0.02, 1.62, 0], s); fov = 34 - 4 * s;
    }
    // every blow shakes the camera and punches the lens in
    let sh = 0, kick = 0;
    for (const [t0, a] of HITS) { sh += a * pulse(t, t0, 0.13); kick += a * 40 * pulse(t, t0, 0.09); }
    for (const [t0, a] of [[EV.steps[1], 0.008], [EV.steps[2], 0.011], [EV.steps[3], 0.014]]) sh += a * pulse(t, t0, 0.1);
    if (sh > 0.0005) { p = [p[0] + sh * noise(t * 7.1), p[1] + sh * noise(t * 9.3 + 2), p[2]]; g = [g[0] + sh * 0.6 * noise(t * 8.3 + 5), g[1] + sh * 0.6 * noise(t * 6.7 + 9), g[2]]; }
    camera.position.set(p[0], p[1], p[2]); camera.fov = fov - Math.min(4, kick) * (t < EV.freeze ? 1 : 0); camera.updateProjectionMatrix(); camera.lookAt(g[0], g[1], g[2]);
  }

  const poseAt = (ta) => {
    const hp = evalTrack(HT, ta), lp = evalTrack(LT, ta);
    const idle = 1 - smooth(seg(ta, 3.5, 3.95));
    hp.hip[1] += 0.008 * Math.sin(ta * 2.4) * idle; hp.shC[1] += 0.006 * Math.sin(ta * 2.4 + 0.6) * idle;
    hp.cape += 0.07 * Math.sin(ta * 1.9) + 0.04 * Math.sin(ta * 3.7 + 1);
    lp.mane += 0.03 * Math.sin(ta * 1.3) + 0.02 * Math.sin(ta * 2.9 + 2); lp.maneZ += 0.03 * Math.sin(ta * 1.1 + 1);
    hp.visor = 1 + 2.4 * pulse(ta, EV.visor, 0.35) + (ta > EV.visor ? 0.5 : 0);
    hp.spHold = ta >= EV.release && ta < 11.8 ? 0 : 1;
    return [hp, lp];
  };
  const KA = v3(0, -0.04, 0.82), KB = v3(0, -0.07, 1.2), SA = v3(0, 0, hoplite.spear.userData.from - 0.05), SB = v3(0, 0, TIP);

  function update(t, cam) {
    const ta = Math.min(t, EV.freeze);
    // where the blade and the spear point were over the last instants: the smear of a fast blow
    const bs = [], ss = [], N = 12, DT = 0.0055;
    for (let i = N - 1; i >= 0; i--) {
      const [hp, lp] = poseAt(ta - i * DT);
      luna.apply(lp); bs[i] = [luna.katana.localToWorld(KA.clone()), luna.katana.localToWorld(KB.clone())];
      if (hp.spHold) { hoplite.apply(hp); ss[i] = [hoplite.spear.localToWorld(SA.clone()), hoplite.spear.localToWorld(SB.clone())]; } else ss[i] = null;
    }
    const [hp, lp] = poseAt(ta);
    hoplite.apply(hp); luna.apply(lp);
    const speed = (s) => (s[0] && s[4] ? s[0][1].distanceTo(s[4][1]) / (4 * DT) : 0);
    const moving = t < EV.freeze ? 1 : Math.max(0, 1 - (t - EV.freeze) * 4);
    bladeTrail.set(bs, [0.3, 0.4, 0.66], lp.kW > 0.5 ? clamp01((speed(bs) - 8) / 22) * moving : 0);
    spearTrail.set(ss.every(Boolean) ? ss : [], [0.9, 0.26, 0.66], clamp01((speed(ss) - 8) / 22) * moving);
    // their light travels with them
    ctx.lights[0].position.copy(hoplite.spear.localToWorld(v3(0, 0, 1.3))); ctx.lights[1].position.set(hp.x - 0.2, 1.1, 1.5); ctx.lights[2].position.set(lp.x + 0.5, 1.7, -0.6);

    // ---- the spear: in the fist, in the air, in two pieces, and projected again
    const sp = hoplite.spear, [pa, pb] = hoplite.pieces;
    sp.visible = true; pa.visible = pb.visible = false; sp.userData.holo(null);
    if (ta >= EV.release && ta < EV.cut) { sp.position.copy(rel0.p).addScaledVector(VTHROW, ta - EV.release); sp.quaternion.setFromUnitVectors(v3(0, 0, 1), VTHROW.clone().normalize()); const s = []; for (let i = 0; i < N; i++) { const o = VTHROW.clone().multiplyScalar(-i * DT); s.push([sp.localToWorld(SA.clone()).add(o), sp.localToWorld(SB.clone()).add(o)]); } spearTrail.set(s, [1.0, 0.3, 0.75], 0.8); }
    else if (ta >= EV.cut && ta < 11.8) {
      sp.visible = false;
      const base = rel0.p.clone().addScaledVector(VTHROW, EV.cut - EV.release), dir = VTHROW.clone().normalize(), tau = ta - EV.cut;
      const fly = (pc, v, spin, rest) => {
        pc.visible = true;
        const y0 = base.y, tl = (v[1] + Math.sqrt(v[1] * v[1] + 19.6 * (y0 - 0.03))) / 9.8, tt = Math.min(tau, tl), after = Math.max(0, tau - tl);
        pc.position.copy(base).addScaledVector(dir, pc.userData.c).add(v3(v[0] * (tt + after * 0.35 * Math.exp(-after * 3)), v[1] * tt - 4.9 * tt * tt, v[2] * (tt + after * 0.35 * Math.exp(-after * 3))));
        if (after > 0) pc.position.y = 0.03 + 0.09 * Math.abs(Math.sin(after * 19)) * Math.exp(-after * 9);
        pc.quaternion.setFromUnitVectors(v3(0, 0, 1), dir).multiply(new T.Quaternion().setFromAxisAngle(v3(spin[0], spin[1], spin[2]).normalize(), spin[3] * tt));
        if (after > 0 && rest) pc.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(0, 1.1, 0)), Math.min(1, after * 9));
      };
      fly(pa, [3.4, 3.6, -2.8], [1, 0.3, 0.2, 15], false);
      fly(pb, [1.9, -3.4, 1.4], [1, 0.2, -0.4, 10], true);
    } else if (ta >= 11.8 && ta < EV.lock + 0.25) {
      // a hologram first: edges of light that flicker and jump, then a scan runs along it and leaves it solid
      const k = E.io(seg(ta, EV.form + 0.14, EV.lock - 0.03)), f = Math.floor(ta * 30);
      const on = ta < EV.form ? 0 : ta < EV.lock ? (Math.sin(f * 12.9898) * 43758.5453 % 1 > -0.55 ? 0.55 + 0.45 * Math.abs(Math.sin(f * 7.3)) : 0.12) : 1 - seg(ta, EV.lock, EV.lock + 0.22);
      sp.userData.holo(ta < EV.lock ? k : 1, on);
      if (ta < EV.lock && f % 5 === 0) sp.position.add(v3(0.012 * noise(f), 0.012 * noise(f + 3), 0));
    }

    // ---- light and marks
    fx.sparks(warp(t));
    const eyeP = (i) => { const w = luna.eyes[i].getWorldPosition(v3()); return [w.x, w.y, w.z]; };
    // an eye of the guardian does not blink open: its light stutters twice and then burns
    const eyeK = (t0) => (ta < t0 ? 0 : ta < t0 + 0.04 ? 1 : ta < t0 + 0.08 ? 0.1 : ta < t0 + 0.12 ? 0.8 : ta < t0 + 0.16 ? 0.25 : pulse(ta, t0 + 0.16, 0.18));
    fx.flare(0, eyeP(0), 0.2, RED, 0.9 * eyeK(EV.eye3)); fx.flare(1, eyeP(1), 0.2, RED, 0.9 * eyeK(EV.eye4));
    const vp = hoplite.parts.head.localToWorld(v3(0, 0.15, 0.14));
    fx.flare(2, [vp.x, vp.y, vp.z], 0.5, PINK, pulse(ta, EV.visor, 0.25) * 0.6);
    const mouth = luna.saya.localToWorld(v3(0, 0, 0));
    fx.flare(3, [mouth.x, mouth.y, mouth.z], 0.3, HOT, pulse(ta, EV.click, 0.07));
    const hitP = ta < 7 ? C1 : ta < EV.thrust2 ? cp1 : ta < EV.floor ? cp2 : ta < EV.cut2 ? FLOORP : ta < EV.bash ? C2 : ta < 10 ? BASHP : ta < EV.falls[1] ? I1 : ta < EV.falls[2] ? P2 : ta < 11.3 ? F3 : ta < 11.8 ? CUTP : HANDP;
    let hk2 = 0; for (const [t0] of HITS.slice(0, -1)) hk2 += pulse(ta, t0, 0.075); hk2 += 0.5 * pulse(ta, EV.cut1, 0.6) * (ta < EV.slowEnd ? 1 : 0); if (ta >= 11.8) hk2 = pulse(ta, EV.lock, 0.1);
    fx.flare(4, hitP, ta > 11.8 && ta < 12.6 ? 0.9 : 0.85, ta > 11.8 && ta < 12.6 ? PINK : HOT, Math.min(1.0, hk2));
    fx.flare(6, CLASH, 3.2, HOT, pulse(t, EV.clash, 0.16)); fx.flare(7, CLASH, 0.75, HOT, t > EV.clash ? 0.55 + 0.1 * Math.sin(t * 9) : 0);
    // the mark of her cuts: a crescent left hanging where the blade went
    const _unused = 0;
  const mark = (i, t0, p, R, yaw, tilt, dur, col) => fx.crescent(i, p, R, yaw, tilt, ta < t0 ? 0 : (1 - smooth(seg(ta, t0 + dur * 0.25, t0 + dur))) * 0.9, 1, col);
    mark(0, EV.cut1 - 0.02, [0.3, 1.62, 0.14], 1.05, 0.12, -0.5, EV.slowEnd - EV.cut1 + 0.25);
    mark(6, EV.cut2 - 0.02, [-0.25, 1.55, 0.12], 0.95, 0.9, -1.45, 0.3);
    mark(7, EV.slash + 0.03, [0.35, 1.6, 0.05], 1.15, 0.1, 0.2, 0.55);
    mark(8, EV.cut - 0.01, [CUTX - 0.05, rel0.p.y + 0.1, 0.0], 0.85, 0.3, -0.7, 0.3);
    mark(9, EV.clash - 0.02, [CLASH[0] + 0.5, 1.4, 0.0], 0.9, 0.15, -0.3, 0.9);
    mark(10, EV.clash - 0.02, [CLASH[0] - 0.55, 1.36, 0.0], 0.7, Math.PI - 0.15, 0.25, 0.9, [3.0, 1.1, 2.3]);
    // five crescents rise to hang over the field, then come for him one by one
    for (let i = 0; i < 5; i++) {
      const born = EV.crescents[i], h = HANG[i], src = [lp.x - 0.6, 2.0, 0.05];
      let k = ta < born ? 0 : 1, p = L3(src, [h[0], h[1] + 0.05 * Math.sin(ta * 2.2 + i), h[2]], E.out3(seg(ta, born, born + 0.22))), R = 0.42 + 0.05 * (i % 2), tilt = -1.5 + 0.22 * (i - 2) + 0.05 * Math.sin(ta * 1.7 + i), yaw = 0.25 * Math.sin(i * 1.7);
      if (i < 3) {
        const at = EV.falls[i], T0 = at - 0.15;
        if (ta > T0) {
          const tg = i === 0 ? I1 : i === 1 ? P2 : F3, end = i === 2 ? EV.floor3 : at, u = E.in(seg(ta, T0, end));
          p = L3(h, tg, u); tilt = Math.atan2(tg[1] - h[1], tg[0] - h[0]) + Math.PI / 2; yaw = 0; R *= 1 + 0.5 * u;
          if (ta >= end) k = 0;
        } else if (ta > T0 - 0.18) { const w = seg(ta, T0 - 0.18, T0); p[1] += 0.12 * w; R *= 1 + 0.25 * w; }
      } else k *= 1 - seg(ta, 11.45 + (i - 3) * 0.05, 11.55 + (i - 3) * 0.05);
      fx.crescent(1 + i, p, R, yaw, tilt, k * 0.95);
    }
    const rc = Math.pow(1 - seg(t, EV.clash, EV.clash + 0.62), 1.4);
    fx.ring.visible = t >= EV.clash && rc > 0.01; fx.ring.position.set(CLASH[0], CLASH[1], CLASH[2]);
    fx.ring.scale.setScalar(0.2 + 3.0 * E.out(seg(t, EV.clash, EV.clash + 0.62))); fx.ring.material.color.setRGB(2.2 * rc, 2.2 * rc, 2.8 * rc);
    fx.setLine([0, 0, 0], [1, 0, 0], 0.01, 0);

    cameraAt(t, hp.x, lp.x);
    if (cam) { camera.position.set(cam[0], cam[1], cam[2]); camera.fov = cam[6] || 30; camera.updateProjectionMatrix(); camera.lookAt(cam[3], cam[4], cam[5]); }
    fx.ring.quaternion.copy(camera.quaternion);
    // two silhouettes against the moon
    const sil = api.free ? 0 : smooth(seg(t, EV.freeze, EV.pullEnd)); // the viewer's own camera keeps the fighters lit
    W.fill.intensity = 0.95 * (1 - 0.97 * sil); W.hemi.intensity = 0.6 * (1 - 0.94 * sil); W.moonL.intensity = 2.3 * (1 + 0.7 * sil);
    mats.forEach((m) => (m.envMapIntensity = 1 - 0.9 * sil));
    ctx.lights.forEach((l) => (l.intensity = l.userData.i0 * (1 - sil)));
    W.moon.scale.setScalar(1 + 1.25 * sil); W.halo.scale.setScalar(MOON_R * 6.5 * (1 + 0.5 * sil)); W.moon.material.color.setRGB(1.35 - 0.3 * sil, 1.35 - 0.3 * sil, 1.45 - 0.3 * sil);
    const fade = api.free ? 1 : smooth(seg(t, 0, 0.5)) * (1 - smooth(seg(t, EV.end, EV.fadeEnd)));
    let flash = 0; for (const [t0, a] of HITS.slice(0, -1)) flash += a * 14 * pulse(ta, t0, 0.04);
    ctx.grade.uniforms.exposure.value = fade * (1 + Math.min(1.1, flash) + 0.4 * pulse(ta, EV.lock, 0.07) + 2.2 * pulse(t, EV.clash, 0.045)) * (1 - 0.08 * sil);
    ctx.bloom.strength = 0.48 - 0.24 * sil + 0.25 * pulse(ta, EV.cut1, 0.2) + 0.5 * pulse(t, EV.clash, 0.12);
  }
  const api = { update, HT, LT, evalTrack, warp, free: false };
  return api;
}
