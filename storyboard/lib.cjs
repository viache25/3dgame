// Sketch toolkit for the storyboard: primitives, two parametric figures (hoplite, Luna), background and FX.
const W = 960, H = 540;
const C = {
  board: '#141833', floor: '#181D40', ink: '#E4E8F6', dim: '#8E97C2', faint: '#4A5285',
  body: '#2A3162', body2: '#1F2550', cape: '#191D42', shield: '#353D78', dark: '#0C0F22', sil: '#070914',
  violet: '#9B5CFF', pink: '#FF4FA8', crimson: '#FF3350', scab: '#C81E3A', moon: '#EEF1FA', moonblue: '#9CC8FF',
  blade: '#E3EEFF', grid: '#5C6CF0', cam: '#FFC44D', check: '#6E96DC',
};
const f = (n) => String(Math.round(n * 10) / 10);
const P = (pts) => pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ');
const rad = (d) => (d * Math.PI) / 180;
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ln = (a, b, col, w, x = '') => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" ${x}/>`;
const pl = (pts, fill, col = 'none', w = 0, x = '') => `<polygon points="${P(pts)}" fill="${fill}" stroke="${col}" stroke-width="${f(w)}" stroke-linejoin="round" ${x}/>`;
const pth = (d, fill, col = 'none', w = 0, x = '') => `<path d="${d}" fill="${fill}" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
const circ = (c, r, fill, col = 'none', w = 0, x = '') => `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}" fill="${fill}" stroke="${col}" stroke-width="${f(w)}" ${x}/>`;
const ell = (c, rx, ry, rot, fill, col = 'none', w = 0, x = '') => `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(rot)} ${f(c[0])} ${f(c[1])})" fill="${fill}" stroke="${col}" stroke-width="${f(w)}" ${x}/>`;

/** Two-bone IK; `pole(mid)` scores a candidate elbow/knee, the higher wins. */
function ik(r, t, l1, l2, pole) {
  let dx = t[0] - r[0], dy = t[1] - r[1];
  let d = Math.hypot(dx, dy) || 0.001;
  const max = (l1 + l2) * 0.998;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  const a = Math.atan2(dy, dx);
  const A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const m1 = [r[0] + l1 * Math.cos(a + A), r[1] + l1 * Math.sin(a + A)];
  const m2 = [r[0] + l1 * Math.cos(a - A), r[1] + l1 * Math.sin(a - A)];
  return { mid: pole(m1) >= pole(m2) ? m1 : m2, end: [r[0] + dx, r[1] + dy] };
}
const FWD = (m) => m[0], DOWN = (m) => m[1], BACK = (m) => -m[0], UP = (m) => -m[1];

function kit(p) {
  const s = p.s, sil = p.sil;
  const ow = 2.5 / s;
  const ink = sil ? C.sil : C.ink;
  const tone = (c) => (sil ? C.sil : c);
  const b = [], e = [];
  const cap = (a, c, w, fill = C.body) => b.push(ln(a, c, ink, w + 2 * ow), ln(a, c, tone(fill), w));
  const limb = (a, m, c, w1, w2, fill = C.body) => b.push(ln(a, m, ink, w1 + 2 * ow), ln(m, c, ink, w2 + 2 * ow), ln(a, m, tone(fill), w1), ln(m, c, tone(fill), w2));
  const poly = (pts, fill = C.body) => b.push(pl(pts, tone(fill), ink, ow));
  const dot = (c, r, fill = C.body) => b.push(circ(c, r, tone(fill), ink, ow));
  const sx = p.flip ? -s : s;
  const world = (q) => [p.x + sx * q[0], p.y + s * q[1]];
  const wrap = (gid) => `<g transform="translate(${f(p.x)},${f(p.y)}) scale(${f(sx)},${f(s)})">${b.join('')}<g filter="url(#${gid})">${e.join('')}</g></g>`;
  return { s, sil, ow, ink, tone, b, e, cap, limb, poly, dot, world, wrap };
}

/** The Hoplite (Pilum): stocky, crested helm with a T of light, round shield with a Λ, long spear, short cape. Faces +x. */
function hoplite(o, gid) {
  const p = Object.assign({ s: 1, flip: false, sil: false, hipX: 0, hipH: 38, lean: 10, footN: [16, 0], footF: [-18, 0], footNA: 0, footFA: 0, hand: [-6, -6], spearA: -3, shield: [12, 12], shR: 16, shT: 0.82, shA: 0, head: -6, cape: 6, crest: 0, spear: true, tip: 60, butt: 34, visor: 1, noShield: false }, o);
  const K = kit(p), { ow, ink, tone, b, e, cap, limb, poly, dot } = K;
  const L = rad(p.lean), hip = [p.hipX, -p.hipH];
  const pt = (a, c) => [hip[0] + Math.sin(L) * a + Math.cos(L) * c, hip[1] - Math.cos(L) * a + Math.sin(L) * c];
  const neck = pt(30, 0), shF = pt(27, -3), shN = pt(27, 4);
  const HA = L + rad(p.head);
  const hc = [neck[0] + Math.sin(HA) * 9, neck[1] - Math.cos(HA) * 9];
  const hp = (a, c) => [hc[0] + Math.sin(HA) * a + Math.cos(HA) * c, hc[1] - Math.cos(HA) * a + Math.sin(HA) * c];
  const cp = p.cape;
  const sh = (q, dx, dy) => [q[0] + dx, q[1] + dy];
  poly([pt(30, -3), pt(27, -11), sh(pt(16, -18), -cp * 0.5, -cp * 0.1), sh(pt(3, -17), -cp, -cp * 0.3), sh(pt(-7, -13), -cp * 1.25, -cp * 0.15), sh(pt(-2, -9), -cp * 0.4, 0), pt(12, -8)], C.cape);
  const leg = (root, foot, ang, fill) => {
    const k = ik(root, [foot[0], foot[1] - 3.2], 23, 22, FWD);
    limb(root, k.mid, k.end, 10.5, 8.5, fill);
    const a = rad(ang);
    const R = (x, y) => [k.end[0] + x * Math.cos(a) - y * Math.sin(a), k.end[1] + x * Math.sin(a) + y * Math.cos(a)];
    poly([R(-4.5, 3.2), R(11.5, 3.2), R(10.5, 0.4), R(3, -3.4), R(-4.5, -2.6)], fill);
  };
  leg([hip[0] - 2.5, hip[1]], p.footF, p.footFA, C.body2);
  const g = ik(shF, [shF[0] + p.hand[0], shF[1] + p.hand[1]], 15.5, 14.5, DOWN);
  limb(shF, g.mid, g.end, 7.5, 6.5, C.body2);
  const A = rad(p.spearA), dir = [Math.cos(A), Math.sin(A)], n = [-dir[1], dir[0]];
  const at = (d, k = 0) => [g.end[0] + dir[0] * d + n[0] * k, g.end[1] + dir[1] * d + n[1] * k];
  if (p.spear) {
    b.push(ln(at(-p.butt), at(p.tip - 13), tone(C.ink), 1.7), ln(at(-p.butt), at(-p.butt + 5), tone(C.ink), 2.6));
    e.push(pl([at(p.tip - 14), at(p.tip - 9, 3), at(p.tip), at(p.tip - 9, -3)], C.pink, '#FFD9EC', 0.5));
    e.push(ln(at(p.tip - 11), at(p.tip - 2), '#FFF', 0.7));
  }
  dot(g.end, 3.5, C.body2);
  poly([pt(-1, -8), pt(9, -9.5), pt(24, -12), pt(31, -7), pt(32, 3), pt(27, 11), pt(18, 13), pt(8, 10), pt(-1, 8)]);
  b.push(ln(pt(10, -9), pt(10, 9.5), ink, ow * 0.7), ln(pt(25, 12), pt(20, -8), ink, ow * 0.5));
  leg([hip[0] + 2.5, hip[1]], p.footN, p.footNA, C.body);
  poly([pt(3, -9.5), pt(3, 9.5), pt(-11, 11), pt(-11, -10.5)], C.body2);
  for (const k of [-5.5, -0.5, 4.5]) b.push(ln(pt(2, k), pt(-11, k * 1.08), ink, ow * 0.6));
  cap(pt(2.5, -8.5), pt(2.5, 8.5), 2.6);
  // helm
  poly([hp(-6.5, -12), hp(-1, -9.6), hp(5, -9.6), hp(9, -6), hp(10.6, -1), hp(9.8, 4), hp(7.2, 8.2), hp(3.6, 11.4), hp(1.4, 8.6), hp(-3, 9.6), hp(-10.8, 6.6), hp(-6, 3), hp(-6.6, -3), hp(-8, -8)], '#333B78');
  if (p.visor) {
    e.push(ln(hp(2.2, 2.6), hp(2.6, 9.4), C.pink, 1.6), ln(hp(2, 6.9), hp(-7.6, 6.3), C.violet, 1.4));
    if (p.visor > 1) e.push(circ(hp(2.3, 6.5), 3.2, C.pink, 'none', 0, 'opacity=".55"'));
  }
  // crest of hard light, standing on the dome
  const cb = p.crest;
  const cq = (a, c) => f(hp(a, c)[0]) + ' ' + f(hp(a, c)[1]);
  e.push(pth(`M${cq(9.4, 6)} Q${cq(22, 6)} ${cq(20.5, -3)} Q${cq(18, -14 - cb)} ${cq(2.5, -18 - cb * 1.6)} L${cq(2, -10.6)} Q${cq(9.6, -10)} ${cq(11, -1.5)} Z`, C.violet, C.pink, 1.1));
  for (const [a0, c0, a1, c1] of [[10.6, 3, 19.5, 4], [11, -2, 20, -4], [9.4, -6.5, 16.5, -11 - cb * 0.6], [6, -9.6, 9, -15 - cb]]) e.push(ln(hp(a0, c0), hp(a1, c1), '#FFC6E4', 0.5));
  // near arm and the aspis
  const sc = [shN[0] + p.shield[0], shN[1] + p.shield[1]];
  const na = ik(shN, sc, 15, 14, DOWN);
  limb(shN, na.mid, na.end, 7.5, 6.5);
  dot(shN, 5.4);
  if (!p.noShield) {
    const rx = p.shR * p.shT, ry = p.shR, ra = rad(p.shA);
    b.push(ell(sc, rx, ry, p.shA, tone(C.shield), ink, ow * 1.5), ell(sc, rx * 0.84, ry * 0.84, p.shA, 'none', ink, ow * 0.6));
    const S = (u, v) => [sc[0] + u * rx * Math.cos(ra) - v * ry * Math.sin(ra), sc[1] + u * rx * Math.sin(ra) + v * ry * Math.cos(ra)];
    e.push(ell(sc, rx * 0.7, ry * 0.7, p.shA, 'none', C.violet, 0.7));
    e.push(pth(`M${P([S(-0.36, 0.46)])} L${P([S(0, -0.5)])} L${P([S(0.36, 0.46)])}`, 'none', C.pink, 2));
  } else dot(na.end, 3.4);
  e.push(circ(pt(21, 10.5), 1.7, C.pink));
  return { svg: K.wrap(gid), tip: K.world(at(p.tip)), butt: K.world(at(-p.butt)), hand: K.world(g.end), shield: K.world(sc), head: K.world(hc), visor: K.world(hp(2.3, 6.5)), crest: K.world(hp(18, -6)), hip: K.world(hip) };
}

/** Luna: tall thin droid, pale face plate with six eyes, cable ponytail with crimson tips, checkered shoulder plate, long sword in a crimson scabbard. Drawn facing +x, flipped by default. */
function luna(o, gid) {
  const p = Object.assign({ s: 1, flip: true, sil: false, hipX: 0, hipH: 56.5, lean: 0, footN: [5, 0], footF: [-6, 0], footNA: 0, footFA: 0, head: 0, eyes: 2, blow: 0, drawn: false, swordA: -50, swordL: 66, handF: null, handN: null, scabA: 40, bEyes: 0 }, o);
  const K = kit(p), { ow, ink, tone, b, e, cap, limb, poly, dot } = K;
  const L = rad(p.lean), hip = [p.hipX, -p.hipH];
  const pt = (a, c) => [hip[0] + Math.sin(L) * a + Math.cos(L) * c, hip[1] - Math.cos(L) * a + Math.sin(L) * c];
  const neck = pt(38, 0), shF = pt(33.5, -3), shN = pt(33.5, 3);
  const HA = L + rad(p.head);
  const hc = [neck[0] + Math.sin(HA) * 8.5, neck[1] - Math.cos(HA) * 8.5];
  const hp = (a, c) => [hc[0] + Math.sin(HA) * a + Math.cos(HA) * c, hc[1] - Math.cos(HA) * a + Math.sin(HA) * c];
  const m = pt(1.5, 6.5);
  const SA = rad(p.scabA), sd = [-Math.cos(SA), Math.sin(SA)];
  const sAt = (d) => [m[0] + sd[0] * d, m[1] + sd[1] * d];
  const leg = (root, foot, ang, fill) => {
    const k = ik(root, [foot[0], foot[1] - 3], 28, 27, FWD);
    limb(root, k.mid, k.end, 5.4, 4.2, fill);
    dot(k.mid, 2.5, C.dark);
    const a = rad(ang);
    const R = (x, y) => [k.end[0] + x * Math.cos(a) - y * Math.sin(a), k.end[1] + x * Math.sin(a) + y * Math.cos(a)];
    poly([R(-3, 3), R(9.5, 3), R(9, 0.8), R(2, -2.6), R(-3, -2)], fill);
  };
  leg([hip[0] - 1.5, hip[1] + 1], p.footF, p.footFA, C.body2);
  // far arm: on the hilt, or holding the bared blade
  const tF = p.handF ? [shF[0] + p.handF[0], shF[1] + p.handF[1]] : sAt(-9);
  const aF = ik(shF, tF, 17, 16, p.drawn ? DOWN : BACK);
  limb(shF, aF.mid, aF.end, 3.8, 3.2, C.body2);
  dot(aF.mid, 2, C.dark);
  let tipW = null;
  if (p.drawn) {
    const A = rad(p.swordA), d = [Math.cos(A), Math.sin(A)], nn = [-d[1], d[0]];
    const at = (t, k = 0) => [aF.end[0] + d[0] * t + nn[0] * k, aF.end[1] + d[1] * t + nn[1] * k];
    b.push(ln(at(-8), at(2), tone('#1A1F40'), 2.2), ln(at(2, -3), at(2, 3), ink, 1.2));
    const bd = `M${P([at(2.5)])} Q${P([at(p.swordL * 0.55, -2.4)])} ${P([at(p.swordL)])}`;
    if (p.sil) b.push(pth(bd, 'none', C.sil, 2.4)); else e.push(pth(bd, 'none', C.blade, 1.9));
    for (let i = 0; i < p.bEyes; i++) e.push(circ(at(12 + i * 8.5, -1.2 - Math.sin((i + 1) / 7 * Math.PI) * 1.1), 1, C.crimson));
    tipW = K.world(at(p.swordL));
  }
  dot(aF.end, 2.1, C.body2);
  poly([pt(-3.5, -5), pt(4, -5.5), pt(4, 5.5), pt(-3.5, 5)], C.body);
  cap(pt(4, 0), pt(16, 0), 2.2, C.dark);
  for (const a of [7, 10, 13]) b.push(ln(pt(a, -2.4), pt(a, 2.4), ink, ow * 0.7));
  leg([hip[0] + 1.5, hip[1] + 1], p.footN, p.footNA, C.body);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.push(pl([pt(1 - i * 3.5, 2 + j * 3.4), pt(1 - i * 3.5, 5.4 + j * 3.4), pt(-2.5 - i * 3.5, 5.6 + j * 3.4), pt(-2.5 - i * 3.5, 2.2 + j * 3.4)], tone((i + j) % 2 ? C.dark : C.check), ink, ow * 0.4));
  poly([pt(15, -3.5), pt(22, -8), pt(34, -7.5), pt(37.5, -1), pt(36, 6.5), pt(27, 9.5), pt(15, 3.5)]);
  b.push(ln(pt(22, -7), pt(26, 8.5), ink, ow * 0.5));
  e.push(circ(pt(27, 6.5), 1.5, C.pink));
  cap(neck, hp(-6, 0), 2.4, C.dark);
  // the cable ponytail
  const clamp = hp(7.5, -3.5);
  for (let i = 0; i < 5; i++) {
    const end = [clamp[0] - (6 + i * 3.4) - p.blow * (0.8 + 0.16 * i), clamp[1] + 15 + i * 7.6 - p.blow * (0.45 + 0.1 * i)];
    const c1 = [clamp[0] - 1 - i * 1.3, clamp[1] - (11 + i * 2.2)];
    const c2 = [end[0] + 2 + p.blow * 0.25, end[1] - (13 + i * 2.6)];
    b.push(pth(`M${P([clamp])} C${P([c1, c2, end])}`, 'none', tone(C.dim), 1.5));
    const dd = [end[0] - c2[0], end[1] - c2[1]], dl = Math.hypot(dd[0], dd[1]);
    e.push(ln([end[0] - (dd[0] / dl) * 4.6, end[1] - (dd[1] / dl) * 4.6], end, C.crimson, 1.7));
  }
  for (let i = 0; i < 3; i++) {
    const q = hp(13.5 + i * 1.3, 2 + i * 3.6);
    b.push(pth(`M${P([hp(8, -1 + i)])} Q${P([hp(13, -1 + i * 2)])} ${P([q])}`, 'none', tone(C.dim), 1.2));
    e.push(ln(hp(12.4 + i * 1.3, 0.4 + i * 3.2), q, C.crimson, 1.5));
  }
  dot(hp(0.5, -2.5), 7, C.body2);
  poly([hp(7.5, 0.5), hp(7, 6.2), hp(2, 8.4), hp(-5, 7), hp(-9.6, 3.2), hp(-6.5, 0), hp(0, -0.9)], C.moon);
  cap(hp(8.5, -5), hp(8.5, -2), 2, C.body);
  const rows = [[-0.2, 2.4, 5.7], [3.7, 2.4, 5.7], [-4.1, 2.5, 5.1]];
  rows.forEach(([a, c0, c1], r) => {
    for (const c of [c0, c1]) {
      if (r * 2 < p.eyes) e.push(circ(hp(a, c), 1.1, C.crimson));
      else if (!p.sil) b.push(ln(hp(a, c - 0.8), hp(a, c + 0.8), '#2E356A', 0.8));
    }
  });
  // scabbard on the near hip
  b.push(ln(m, sAt(58), ink, 3 + 2 * ow), ln(m, sAt(58), tone(C.scab), 3));
  for (const d of [8, 22, 36, 50]) b.push(ln([sAt(d)[0] - sd[1] * 1.4, sAt(d)[1] + sd[0] * 1.4], [sAt(d)[0] + sd[1] * 1.4, sAt(d)[1] - sd[0] * 1.4], tone('#5E0F1F'), 0.8));
  if (!p.drawn) {
    cap(sAt(-1.5), sAt(-15), 2, '#1A1F40');
    b.push(ln([sAt(-1.5)[0] - sd[1] * 3.2, sAt(-1.5)[1] + sd[0] * 3.2], [sAt(-1.5)[0] + sd[1] * 3.2, sAt(-1.5)[1] - sd[0] * 3.2], ink, 1.3));
  }
  const tN = p.handN ? [shN[0] + p.handN[0], shN[1] + p.handN[1]] : sAt(4);
  const aN = ik(shN, tN, 17, 16, BACK);
  limb(shN, aN.mid, aN.end, 3.8, 3.2);
  dot(aN.mid, 2, C.dark);
  dot(aN.end, 2.1);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) b.push(pl([pt(38.5 - i * 3.3, -2 + j * 3.3), pt(38.5 - i * 3.3, 1.3 + j * 3.3), pt(35.2 - i * 3.3, 1.3 + j * 3.3), pt(35.2 - i * 3.3, -2 + j * 3.3)], tone((i + j) % 2 ? C.dark : C.check), 'none', 0));
  b.push(pl([pt(38.5, -2), pt(38.5, 7.9), pt(28.6, 7.9), pt(28.6, -2)], 'none', ink, ow));
  return { svg: K.wrap(gid), tip: tipW, hand: K.world(aF.end), mouth: K.world(m), hilt: K.world(sAt(-15)), head: K.world(hc), hip: K.world(hip), face: K.world(hp(0, 4)) };
}

// ---------- background ----------
function stars(seed, yMax, n = 46) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * yMax, k = r();
    s += k > 0.86 ? ln([x - 4, y], [x + 4, y], C.ink, 1, 'opacity=".8"') + ln([x, y - 4], [x, y + 4], C.ink, 1, 'opacity=".8"') : circ([x, y], 0.7 + k * 1.2, C.ink, 'none', 0, `opacity="${f(0.35 + k * 0.5)}"`);
  }
  return s;
}
function moon(cx, cy, r, tone = C.moon) {
  return circ([cx, cy], r * 1.36, tone, 'none', 0, 'opacity=".05"') + circ([cx, cy], r * 1.16, tone, 'none', 0, 'opacity=".09"') + circ([cx, cy], r, tone) +
    pth(`M${f(cx - r * 0.5)} ${f(cy - r * 0.3)} q${f(r * 0.16)} ${f(-r * 0.14)} ${f(r * 0.3)} ${f(-r * 0.02)}`, 'none', '#BFC8E2', r * 0.03) +
    pth(`M${f(cx + r * 0.2)} ${f(cy + r * 0.34)} q${f(r * 0.2)} ${f(r * 0.1)} ${f(r * 0.34)} ${f(-r * 0.08)}`, 'none', '#BFC8E2', r * 0.03) +
    circ([cx + r * 0.3, cy - r * 0.42], r * 0.12, 'none', '#C7CFE8', r * 0.025) + circ([cx - r * 0.34, cy + r * 0.3], r * 0.08, 'none', '#C7CFE8', r * 0.025);
}
function tower(x, base, w, h, roof, flag = 1, fill = '#0E1230', col = C.faint) {
  const top = base - h;
  let s = pl([[x - w / 2, base], [x - w / 2, top], [x + w / 2, top], [x + w / 2, base]], fill, col, 2);
  s += pl([[x - w / 2 - 6, top], [x, top - roof], [x + w / 2 + 6, top]], fill, col, 2);
  s += ln([x, top - roof], [x, top - roof - 22], col, 2) + pl([[x, top - roof - 22], [x + 22 * flag, top - roof - 16], [x, top - roof - 10]], fill === C.sil ? C.sil : '#2A1A3A', col, 1.6);
  if (fill !== C.sil) s += ln([x - w * 0.18, top + h * 0.2], [x - w * 0.18, top + h * 0.2 + 12], C.dim, 2.4, 'opacity=".7"') + ln([x + w * 0.2, top + h * 0.45], [x + w * 0.2, top + h * 0.45 + 12], C.dim, 2.4, 'opacity=".5"');
  return s;
}
function floor(hy, vx, o = {}) {
  const col = o.col || C.grid, op = o.op ?? 0.5;
  let s = `<rect x="0" y="${hy}" width="${W}" height="${H - hy}" fill="${o.fill || C.floor}"/>`;
  const n = o.n || 13;
  for (let i = -n; i <= n; i++) s += ln([vx + i * (o.near || 24), hy], [vx + i * (o.spread || 170), H + 10], col, 1.3, `opacity="${op}"`);
  for (let k = 1; k <= 7; k++) { const y = hy + (H - hy) * Math.pow(k / 7.4, 1.9); s += ln([0, y], [W, y], col, 1.3, `opacity="${op}"`); }
  // parapet with merlons along the far edge
  let d = `M0 ${hy}`;
  for (let x = 0; x < W; x += 44) d += ` h14 v-9 h16 v9 h14`;
  s += pth(d + ` V${hy + 4} H0 Z`, o.wall || '#0E1230', o.wallInk || C.faint, 2);
  return s;
}

// ---------- FX ----------
function crescent(cx, cy, R, rot, o = {}) {
  const th = rad(o.span ?? 64), R2 = R * (o.fat ?? 1.45);
  const p1 = [R * Math.cos(-th), R * Math.sin(-th)], p2 = [R * Math.cos(th), R * Math.sin(th)];
  const d = `M${P([p1])} A${f(R)} ${f(R)} 0 0 1 ${P([p2])} A${f(R2)} ${f(R2)} 0 0 0 ${P([p1])} Z`;
  return `<g transform="translate(${f(cx)},${f(cy)}) rotate(${f(rot)})">${pth(d, o.fill || C.moon, o.col || C.moonblue, o.w ?? 1.6)}</g>`;
}
function burst(cx, cy, r1, r2, n, rot = 0, fill = C.board, col = C.ink, w = 3) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = rad(rot) + (i * Math.PI) / n, r = i % 2 ? r1 : r2 * (0.82 + 0.18 * Math.sin(i * 2.7)); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pl(pts, fill, col, w);
}
function sparks(cx, cy, n, r0, r1, seed, col = C.ink, a0 = 0, a1 = 360) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = rad(a0 + (a1 - a0) * r()), q0 = r0 * (0.7 + 0.6 * r()), q1 = r1 * (0.55 + 0.6 * r());
    s += ln([cx + q0 * Math.cos(a), cy + q0 * Math.sin(a)], [cx + q1 * Math.cos(a), cy + q1 * Math.sin(a)], col, 1.4 + r() * 1.6);
    if (r() > 0.5) s += circ([cx + (q1 + 8) * Math.cos(a), cy + (q1 + 8) * Math.sin(a)], 1.6 + r() * 1.4, col);
  }
  return s;
}
function speed(x0, x1, y0, y1, n, seed, col = C.ink, op = 0.5) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * r(), a = x0 + (x1 - x0) * r() * 0.5, l = (x1 - x0) * (0.25 + 0.5 * r()); s += ln([a, y], [Math.min(x1, a + l), y], col, 1 + r() * 2, `opacity="${f(op * (0.5 + 0.5 * r()))}"`); }
  return s;
}
function hatch(x0, x1, y, n, len = 14, col = C.dark, op = 0.8) {
  let s = '';
  for (let i = 0; i < n; i++) { const x = x0 + ((x1 - x0) * i) / (n - 1); const k = 1 - Math.abs(i / (n - 1) - 0.5) * 1.6; s += ln([x, y + 3], [x - len * 0.9 * k, y + 3 + len * 0.42 * k], col, 2.2, `opacity="${op}"`); }
  return s;
}
/** Camera language: an amber arrow along a polyline or a path. */
function arrowHead(p, ang, size = 15, col = C.cam) {
  const a = rad(ang);
  const q = (dx, dy) => [p[0] + dx * Math.cos(a) - dy * Math.sin(a), p[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  return pl([q(size * 0.75, 0), q(-size * 0.55, -size * 0.62), q(-size * 0.25, 0), q(-size * 0.55, size * 0.62)], col, '#0B0D1A', 1.5);
}
function arrow(a, b, o = {}) {
  const col = o.col || C.cam, w = o.w || 4.5;
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return ln(a, b, '#0B0D1A', w + 4) + ln(a, b, col, w, o.dash ? `stroke-dasharray="${o.dash}"` : '') + arrowHead(b, ang, o.head || 15, col);
}
function arrowPath(d, end, ang, o = {}) {
  const col = o.col || C.cam, w = o.w || 4.5;
  return pth(d, 'none', '#0B0D1A', w + 4) + pth(d, 'none', col, w, o.dash ? `stroke-dasharray="${o.dash}"` : '') + arrowHead(end, ang, o.head || 15, col);
}
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function note(x, y, text, o = {}) {
  return `<text x="${f(x)}" y="${f(y)}" font-family="Neucha, 'Comic Sans MS', 'Segoe Print', cursive" font-size="${o.size || 28}" fill="${o.col || C.cam}" text-anchor="${o.anchor || 'start'}" paint-order="stroke" stroke="#0B0D1A" stroke-width="5" stroke-linejoin="round"${o.rot ? ` transform="rotate(${o.rot} ${f(x)} ${f(y)})"` : ''}>${esc(text)}</text>`;
}
function sfx(x, y, text, o = {}) {
  const size = o.size || 54, t = ` transform="rotate(${o.rot || -8} ${f(x)} ${f(y)})"`;
  const base = `x="${f(x)}" y="${f(y)}" font-family="'Dela Gothic One', 'Rubik Mono One', Impact, 'Arial Black', sans-serif" font-size="${size}" text-anchor="${o.anchor || 'middle'}" letter-spacing="1"`;
  return `<text ${base} fill="${o.shadow || C.crimson}" dx="4" dy="4"${t}>${esc(text)}</text><text ${base} fill="${o.col || C.moon}" paint-order="stroke" stroke="#0B0D1A" stroke-width="7" stroke-linejoin="round"${t}>${esc(text)}</text>`;
}
/** One 16:9 frame: `scene` is displaced for a hand-drawn wobble, `over` (lettering, camera marks) stays crisp. */
function frame(n, label, scene, over = '', o = {}) {
  return `<svg class="frame" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">
<defs>
<filter id="r${n}" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${n * 7 + 3}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="${o.wobble ?? 5}" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="g${n}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="gs${n}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="n${n}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${n + 11}"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.11 0 0 0 0"/></filter>
<radialGradient id="v${n}" cx="50%" cy="46%" r="75%"><stop offset="55%" stop-color="#05060F" stop-opacity="0"/><stop offset="100%" stop-color="#05060F" stop-opacity=".55"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="${o.bg || C.board}"/>
<g filter="url(#r${n})">${scene}</g>
<rect width="${W}" height="${H}" fill="url(#v${n})"/>
<rect width="${W}" height="${H}" filter="url(#n${n})"/>
${over}
</svg>`;
}
module.exports = { W, H, C, f, P, rad, rng, ln, pl, pth, circ, ell, hoplite, luna, stars, moon, tower, floor, crescent, burst, sparks, speed, hatch, arrow, arrowPath, arrowHead, note, sfx, frame, esc };
