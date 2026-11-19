// node test/phys.test.cjs — dropped and thrown parts must come to rest on the ground: not sink, not fly off, not spin for ever.
global.GEO = require('../src/geo.js');
const PHYS = require('../src/phys.js');
const assert = require('assert');
let seed = 3;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const bodies = [];
const shapes = [() => GEO.box(0.5, 0.3, 0.2), () => GEO.lathe([[0.1, 0], [0.1, 1.2]], { sides: 6 }), () => GEO.lathe([[0.2, 0], [0.3, 0.2], [0.05, 0.5]], { sides: 7 }), () => GEO.box(0.08, 0.08, 0.08)];
for (let i = 0; i < 40; i++) {
  const p = GEO.place(shapes[i % shapes.length](), rnd() * 6 - 3, 0.6 + rnd() * 3, rnd() * 6 - 3, rnd() * 6, rnd() * 6, rnd() * 6);
  // some bodies are a wedge cut from the shape, so they have odd faces to rest on
  const h = i % 3 === 0 ? GEO.split(p, 0.3, 0.9, 0.3, 0.3 * p.c[0] + 0.9 * p.c[1] + 0.3 * p.c[2], 0, 0) : null;
  bodies.push(PHYS.make([h ? h[0] : p], { v: [rnd() * 6 - 3, rnd() * 4, rnd() * 6 - 3], w: [rnd() * 10 - 5, rnd() * 10 - 5, rnd() * 10 - 5] }));
}
// a two-piece body, like half a figure
bodies.push(PHYS.make([GEO.place(GEO.box(0.4, 0.5, 0.25), 0, 1, 0), GEO.place(GEO.lathe([[0.08, 0], [0.08, 0.5]], { sides: 6 }), 0.25, 0.6, 0)], { v: [1, 2, 0], w: [0, 0, 3] }));
let t = 0;
for (let i = 0; i < 120 * 8; i++) { t += 1 / 120; PHYS.step(bodies, 1 / 120, t); }
let asleep = 0;
for (const b of bodies) {
  let low = Infinity;
  for (let i = 0; i < b.hull.length; i += 3) low = Math.min(low, b.y + b.R[3] * b.hull[i] + b.R[4] * b.hull[i + 1] + b.R[5] * b.hull[i + 2]);
  assert(low > -0.03 && low < 0.05, 'rests on the ground, lowest point at ' + low.toFixed(3));
  assert(Math.abs(b.x) < 30 && Math.abs(b.z) < 30 && isFinite(b.x + b.y + b.z), 'stays nearby');
  if (b.asleep) asleep++;
}
for (const [i, b] of bodies.entries()) if (!b.asleep && process.env.DBG) console.log(i, i % 4, 'v', Math.hypot(b.vx, b.vy, b.vz).toFixed(3), 'w', Math.hypot(b.wx, b.wy, b.wz).toFixed(3), 'y', b.y.toFixed(3), 'grounded', b.grounded, 'calm', b.calm.toFixed(2));
assert(asleep >= bodies.length - 2, 'settled: ' + asleep + ' of ' + bodies.length);
// a top part on a tilted cut slides off sideways before it falls
const top = PHYS.make([GEO.place(GEO.box(0.5, 0.5, 0.5), 0, 1, 0)], {});
const n = [0.5, Math.sqrt(0.75), 0];
top.slide = { nx: n[0], ny: n[1], nz: n[2], d: n[1] * 1, x0: 0, z0: 0, until: 5, clear: 0.6 };
for (let i = 0; i < 30; i++) PHYS.step([top], 1 / 120, i / 120);
assert(top.x > 0.15 && top.x < 0.45 && top.y > 1.0, 'slides along the cut: x ' + top.x.toFixed(2) + ' y ' + top.y.toFixed(2));
console.log('phys ok:', asleep, 'of', bodies.length, 'asleep after 8 s; slide x', top.x.toFixed(2));
