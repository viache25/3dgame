// node test/geo.test.cjs — checks the cutting maths: volumes add up, solids stay closed, parts group the way they hold together.
const GEO = require('../src/geo.js');
const assert = require('assert');
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function closed(piece) { // every edge is used once in each direction
  const edges = new Map(), key = (x, y, z) => Math.round(x * 2e4) + ',' + Math.round(y * 2e4) + ',' + Math.round(z * 2e4);
  for (const f of piece.faces) for (let i = 0; i < f.p.length; i += 3) {
    const j = (i + 3) % f.p.length, a = key(f.p[i], f.p[i + 1], f.p[i + 2]), b = key(f.p[j], f.p[j + 1], f.p[j + 2]);
    if (a === b) continue;
    edges.set(a + '>' + b, (edges.get(a + '>' + b) || 0) + 1);
  }
  for (const [k, n] of edges) { const [a, b] = k.split('>'); if (n !== 1 || edges.get(b + '>' + a) !== 1) return false; }
  return true;
}

// 1. known volumes
const cube = GEO.box(2, 2, 2);
assert(Math.abs(cube.vol - 8) < 1e-9, 'cube volume');
assert(Math.abs(cube.c[1] - 1) < 1e-9, 'cube centre');
assert(closed(cube), 'cube closed');
const prism = GEO.lathe([[1, 0], [1, 3]], { sides: 6 });
assert(Math.abs(prism.vol - (3 * Math.sqrt(3) / 2) * 3) < 1e-9, 'hex prism volume');
const cone = GEO.lathe([[1, 0], [0, 3]], { sides: 8 });
assert(Math.abs(cone.vol - (2 * Math.sqrt(2)) * 3 / 3) < 1e-9, 'cone volume');
assert(closed(cone) && closed(prism), 'lathe closed');

// 2. a cut through the middle of a cube
const halves = GEO.split(cube, 0, 1, 0, 1, 5, 0);
assert(halves && Math.abs(halves[0].vol - 4) < 1e-9 && Math.abs(halves[1].vol - 4) < 1e-9, 'cube halves');
assert(halves[0].c[1] > 1 && halves[1].c[1] < 1, 'halves on their sides');
assert(halves[0].faces.filter((f) => f.cap === 5).length === 1, 'one new face per half');
assert(GEO.split(cube, 0, 1, 0, 5, 0, 0) === null, 'plane that misses');
assert(GEO.split(cube, 0, 1, 0, 2, 0, 0) === null, 'plane that only touches a face');

// 3. many random cuts: volume is kept, every part is closed and convex
let parts = [GEO.lathe([[0.3, 0], [0.5, 0.4], [0.5, 1.1], [0.2, 1.5]], { sides: 7, sx: 1.2, sz: 0.8 })];
const total = parts[0].vol;
for (let k = 0; k < 60; k++) {
  let nx = rnd() * 2 - 1, ny = rnd() * 2 - 1, nz = rnd() * 2 - 1;
  const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
  const d = nx * (rnd() - 0.5) * 0.6 + ny * (0.2 + rnd() * 1.1) + nz * (rnd() - 0.5) * 0.6;
  const next = [];
  for (const p of parts) { const h = GEO.split(p, nx, ny, nz, d, k, 0); if (h) next.push(h[0], h[1]); else next.push(p); }
  parts = next;
}
let sum = 0, open = 0;
for (const p of parts) {
  sum += p.vol;
  // a shard thinner than the grid this check snaps to can read as open; that is far below anything the game cuts or shows
  if (!closed(p)) { open++; assert(p.vol < 2e-4, 'only dust may read as open'); }
  for (const f of p.faces) for (let i = 0; i < p.pts.length; i += 3) assert(f.n[0] * p.pts[i] + f.n[1] * p.pts[i + 1] + f.n[2] * p.pts[i + 2] - f.d < 2e-5, 'part convex');
}
assert(Math.abs(sum - total) < 1e-7, 'volume kept: ' + sum + ' vs ' + total);
assert(parts.length > 200, 'enough parts: ' + parts.length);
assert(open / parts.length < 0.005, 'open parts: ' + open);

// 4. grouping: a three-block tower cut through the middle block falls into two groups
const tower = [GEO.box(1, 1, 1), GEO.place(GEO.box(1, 1, 1), 0, 0.98, 0), GEO.place(GEO.box(1, 1, 1), 0, 1.96, 0)];
let r = GEO.cutSet(tower, 0, 1, 0, 1.5, 1, null);
assert(r && r.cut === 1 && r.groups.length === 2 && r.pieces.length === 4, 'tower in two');
// a cut that the blade only makes in one of two side-by-side legs leaves a single object
const arch = [GEO.box(0.3, 1, 0.3), GEO.place(GEO.box(0.3, 1, 0.3), 1, 0, 0), GEO.place(GEO.box(1.4, 0.3, 0.3), 0.5, 0.95, 0)];
r = GEO.cutSet(arch, 0, 1, 0, 0.5, 1, (p) => p.c[0] < 0.5);
assert(r && r.cut === 1 && r.groups.length === 2, 'one leg cut: the foot comes off, the arch stays whole');
assert(r.groups.some((g) => g.length === 1) && r.groups.some((g) => g.length === 3), 'foot alone, rest together');
r = GEO.cutSet(arch, 0, 1, 0, 0.5, 1, null);
assert(r && r.cut === 2 && r.groups.length === 3, 'both legs cut: two feet and the top');
// pieces that sit against the cut from both sides do not stick across it
const pair = [GEO.box(1, 1, 1), GEO.place(GEO.box(1, 1, 1), 0, 1, 0), GEO.place(GEO.box(0.2, 2, 0.2), 0.3, 0, 0)];
r = GEO.cutSet(pair, 0, 1, 0, 1, 1, null);
assert(r && r.groups.length === 2, 'no sticking across the cut');

// a small piece lying across the cut, or one that would only lose a sliver, must not hold the halves together
const glued = [GEO.box(1, 2, 1), GEO.place(GEO.box(0.05, 0.05, 0.05), 0.5, 0.98, 0), GEO.place(GEO.box(0.3, 1, 0.3), 0.6, 0.999, 0)];
r = GEO.cutSet(glued, 0, 1, 0, 1, 1, null, { minPiece: 1e-3, minHalf: 1e-4 });
assert(r && r.cut === 1 && r.groups.length === 2, 'small and shaved pieces pick a side: ' + (r && r.groups.length));

// 5. moving a piece keeps its measurements
const moved = GEO.shifted(prism, 1, 2, 3), placed = GEO.place(prism, 1, 2, 3, 0.4, 1.1, -0.7, 1.5);
assert(Math.abs(moved.vol - prism.vol) < 1e-9 && Math.abs(moved.c[1] - prism.c[1] - 2) < 1e-9, 'shifted');
assert(Math.abs(placed.vol - prism.vol * 1.5 ** 3) < 1e-8 && closed(placed), 'placed');
console.log('geo ok:', parts.length, 'parts from 60 cuts, volume error', Math.abs(sum - total).toExponential(1));
