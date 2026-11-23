// Convex pieces. A piece is a closed convex solid kept as face loops, so a plane cut is exact and what comes out can be cut again.
// piece = { faces: [{ p: [x,y,z,...], n: [x,y,z], d, cap, heat, col }], pts: [x,y,z,...], c: [x,y,z], vol, r, inner, glow, tag }
//   cap  < 0: skin. cap >= 0: the time this face was cut open (it glows from then). cap >= GEO.PERM: glows for good (eyes). cap >= GEO.BLADE: glows for good in the colour of the blade. cap >= GEO.NEON: glows for good in its own colour.
var GEO = (function () {
  const EPS = 1e-5, PERM = 1e6, BLADE = 2e6, NEON = 3e6;

  function normalOf(p, out) { // Newell; returns the area
    let nx = 0, ny = 0, nz = 0;
    const n = p.length;
    for (let i = 0; i < n; i += 3) {
      const j = (i + 3) % n;
      nx += (p[i + 1] - p[j + 1]) * (p[i + 2] + p[j + 2]);
      ny += (p[i + 2] - p[j + 2]) * (p[i] + p[j]);
      nz += (p[i] - p[j]) * (p[i + 1] + p[j + 1]);
    }
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-14) { out[0] = 0; out[1] = 1; out[2] = 0; return 0; }
    out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
    return l * 0.5;
  }

  // Turns every face outward, then fills in points, centre of mass, volume and radius. Returns null for a degenerate solid.
  function finish(piece) {
    const faces = piece.faces;
    let ax = 0, ay = 0, az = 0, cnt = 0;
    for (const f of faces) for (let i = 0; i < f.p.length; i += 3) { ax += f.p[i]; ay += f.p[i + 1]; az += f.p[i + 2]; cnt++; }
    if (cnt < 4) return null;
    ax /= cnt; ay /= cnt; az /= cnt;
    let vol = 0, cx = 0, cy = 0, cz = 0;
    const seen = new Map(), pts = [];
    for (const f of faces) {
      const p = f.p;
      if (!f.n) f.n = [0, 0, 0];
      normalOf(p, f.n);
      let d = f.n[0] * p[0] + f.n[1] * p[1] + f.n[2] * p[2];
      if (f.n[0] * ax + f.n[1] * ay + f.n[2] * az - d > 0) { // facing inward: reverse the loop
        const q = [];
        for (let i = p.length - 3; i >= 0; i -= 3) q.push(p[i], p[i + 1], p[i + 2]);
        f.p = q; f.n[0] = -f.n[0]; f.n[1] = -f.n[1]; f.n[2] = -f.n[2]; d = -d;
      }
      f.d = d;
      const q = f.p, x0 = q[0] - ax, y0 = q[1] - ay, z0 = q[2] - az;
      for (let i = 3; i + 3 < q.length; i += 3) {
        const x1 = q[i] - ax, y1 = q[i + 1] - ay, z1 = q[i + 2] - az, x2 = q[i + 3] - ax, y2 = q[i + 4] - ay, z2 = q[i + 5] - az;
        const v = (x0 * (y1 * z2 - z1 * y2) + y0 * (z1 * x2 - x1 * z2) + z0 * (x1 * y2 - y1 * x2)) / 6;
        vol += v; cx += v * (x0 + x1 + x2) / 4; cy += v * (y0 + y1 + y2) / 4; cz += v * (z0 + z1 + z2) / 4;
      }
      for (let i = 0; i < q.length; i += 3) {
        const key = Math.round(q[i] * 2e4) + ',' + Math.round(q[i + 1] * 2e4) + ',' + Math.round(q[i + 2] * 2e4);
        if (!seen.has(key)) { seen.set(key, 1); pts.push(q[i], q[i + 1], q[i + 2]); }
      }
    }
    if (!(vol > 1e-12) || pts.length < 12) return null;
    piece.vol = vol;
    piece.c = [ax + cx / vol, ay + cy / vol, az + cz / vol];
    piece.pts = pts;
    let r2 = 0;
    for (let i = 0; i < pts.length; i += 3) { const dx = pts[i] - piece.c[0], dy = pts[i + 1] - piece.c[1], dz = pts[i + 2] - piece.c[2]; r2 = Math.max(r2, dx * dx + dy * dy + dz * dz); }
    piece.r = Math.sqrt(r2);
    return piece;
  }

  // A solid of revolution with flat sides: profile is [[radius, y], ...] from bottom to top and must bulge outward only.
  // o: { sides, sx, sz, off (turn of the first corner), col, inner, glow }
  function lathe(profile, o) {
    o = o || {};
    const n = o.sides || 6, sx = o.sx == null ? 1 : o.sx, sz = o.sz == null ? 1 : o.sz, off = o.off || 0, col = o.col || 0;
    const ring = (rad, y) => { const a = []; for (let k = 0; k < n; k++) { const t = off + (k / n) * Math.PI * 2; a.push([rad * Math.cos(t) * sx, y, rad * Math.sin(t) * sz]); } return a; };
    const rings = profile.map(([r, y]) => (r > 1e-6 ? ring(r, y) : [[0, y, 0]]));
    const faces = [], face = (list) => { const p = []; for (const v of list) p.push(v[0], v[1], v[2]); faces.push({ p, cap: -1, heat: 0, col }); };
    if (rings[0].length > 1) face(rings[0]);
    for (let i = 0; i + 1 < rings.length; i++) {
      const a = rings[i], b = rings[i + 1];
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n;
        if (a.length === 1) face([a[0], b[k], b[k1]]);
        else if (b.length === 1) face([a[k], b[0], a[k1]]);
        else face([a[k], b[k], b[k1], a[k1]]);
      }
    }
    const top = rings[rings.length - 1];
    if (top.length > 1) face(top);
    const piece = finish({ faces, inner: o.inner == null ? col : o.inner, glow: o.glow == null ? 1 : o.glow, tag: o.tag || null });
    if (!piece) throw new Error('lathe: degenerate solid');
    return piece;
  }

  // A box standing on y = 0, optionally narrower or wider at the top.
  function box(w, h, d, o) {
    o = o || {};
    const t = o.taper == null ? 1 : o.taper, tz = o.taperZ == null ? t : o.taperZ;
    const hw = w / 2, hd = d / 2, faces = [], col = o.col || 0;
    const B = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]], U = [[-hw * t, h, -hd * tz], [hw * t, h, -hd * tz], [hw * t, h, hd * tz], [-hw * t, h, hd * tz]];
    const face = (list) => { const p = []; for (const v of list) p.push(v[0], v[1], v[2]); faces.push({ p, cap: -1, heat: 0, col }); };
    face(B); face(U);
    for (let k = 0; k < 4; k++) { const k1 = (k + 1) % 4; face([B[k], U[k], U[k1], B[k1]]); }
    const piece = finish({ faces, inner: o.inner == null ? col : o.inner, glow: o.glow == null ? 1 : o.glow, tag: o.tag || null });
    if (!piece) throw new Error('box: degenerate solid');
    return piece;
  }

  function copyMeta(to, from) { to.inner = from.inner; to.glow = from.glow; to.tag = from.tag; return to; }

  // 4x4 column-major matrix (the layout THREE.Matrix4.elements uses). Returns a new piece.
  function xf(piece, m) {
    const faces = piece.faces.map((f) => {
      const p = new Array(f.p.length);
      for (let i = 0; i < p.length; i += 3) {
        const x = f.p[i], y = f.p[i + 1], z = f.p[i + 2];
        p[i] = m[0] * x + m[4] * y + m[8] * z + m[12]; p[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; p[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      return { p, cap: f.cap, heat: f.heat, col: f.col };
    });
    return finish(copyMeta({ faces }, piece));
  }

  // Move, turn (Euler XYZ, radians) and scale in one go; for building models.
  function place(piece, tx, ty, tz, rx, ry, rz, s) {
    rx = rx || 0; ry = ry || 0; rz = rz || 0; s = s == null ? 1 : s;
    const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
    const m = [c * e * s, (a * f + b * d * e) * s, (b * f - a * d * e) * s, 0, -c * f * s, (a * e - b * d * f) * s, (b * e + a * d * f) * s, 0, d * s, -b * c * s, a * c * s, 0, tx || 0, ty || 0, tz || 0, 1];
    return xf(piece, m);
  }

  // The same solid moved by a vector; cheaper than xf because nothing has to be measured again.
  function shifted(piece, dx, dy, dz) {
    const faces = piece.faces.map((f) => {
      const p = new Array(f.p.length);
      for (let i = 0; i < p.length; i += 3) { p[i] = f.p[i] + dx; p[i + 1] = f.p[i + 1] + dy; p[i + 2] = f.p[i + 2] + dz; }
      return { p, n: [f.n[0], f.n[1], f.n[2]], d: f.d + f.n[0] * dx + f.n[1] * dy + f.n[2] * dz, cap: f.cap, heat: f.heat, col: f.col };
    });
    const pts = new Array(piece.pts.length);
    for (let i = 0; i < pts.length; i += 3) { pts[i] = piece.pts[i] + dx; pts[i + 1] = piece.pts[i + 1] + dy; pts[i + 2] = piece.pts[i + 2] + dz; }
    return copyMeta({ faces, pts, c: [piece.c[0] + dx, piece.c[1] + dy, piece.c[2] + dz], vol: piece.vol, r: piece.r }, piece);
  }

  // Which side of the plane n·x = d the piece is on: 1, -1, or 0 when it straddles.
  function side(piece, nx, ny, nz, d, eps) {
    eps = eps == null ? 1e-4 : eps;
    const s0 = nx * piece.c[0] + ny * piece.c[1] + nz * piece.c[2] - d;
    if (s0 > piece.r + eps) return 1;
    if (s0 < -piece.r - eps) return -1;
    let pos = false, neg = false;
    const pts = piece.pts;
    for (let i = 0; i < pts.length; i += 3) {
      const s = nx * pts[i] + ny * pts[i + 1] + nz * pts[i + 2] - d;
      if (s > eps) pos = true; else if (s < -eps) neg = true;
      if (pos && neg) return 0;
    }
    return pos ? 1 : neg ? -1 : (s0 >= 0 ? 1 : -1);
  }

  // Cuts a piece by the plane n·x = d. Returns [positive half, negative half], or null when the plane misses or would only shave a sliver.
  function split(piece, nx, ny, nz, d, time, minVol) {
    if (side(piece, nx, ny, nz, d, 1e-4) !== 0) return null;
    const pos = [], neg = [], ring = [];
    for (const f of piece.faces) {
      const p = f.p, n = p.length, a = [], b = [];
      for (let i = 0; i < n; i += 3) {
        const j = (i + 3) % n;
        const x0 = p[i], y0 = p[i + 1], z0 = p[i + 2], x1 = p[j], y1 = p[j + 1], z1 = p[j + 2];
        const s0 = nx * x0 + ny * y0 + nz * z0 - d, s1 = nx * x1 + ny * y1 + nz * z1 - d;
        if (s0 >= -EPS) a.push(x0, y0, z0);
        if (s0 <= EPS) b.push(x0, y0, z0);
        if (s0 >= -EPS && s0 <= EPS) ring.push(x0, y0, z0);
        if ((s0 > EPS && s1 < -EPS) || (s0 < -EPS && s1 > EPS)) {
          // measured from the positive end, so the two faces that share this edge get the very same point
          let x, y, z;
          if (s0 > 0) { const t = s0 / (s0 - s1); x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t; z = z0 + (z1 - z0) * t; }
          else { const t = s1 / (s1 - s0); x = x1 + (x0 - x1) * t; y = y1 + (y0 - y1) * t; z = z1 + (z0 - z1) * t; }
          a.push(x, y, z); b.push(x, y, z); ring.push(x, y, z);
        }
      }
      if (a.length >= 9) pos.push({ p: a, cap: f.cap, heat: f.heat, col: f.col });
      if (b.length >= 9) neg.push({ p: b, cap: f.cap, heat: f.heat, col: f.col });
    }
    // the new face: the ring of crossing points, in order around their middle
    let mx = 0, my = 0, mz = 0;
    const uniq = [];
    for (let i = 0; i < ring.length; i += 3) {
      let dup = false;
      for (let k = 0; k < uniq.length; k += 3) { const dx = ring[i] - uniq[k], dy = ring[i + 1] - uniq[k + 1], dz = ring[i + 2] - uniq[k + 2]; if (dx * dx + dy * dy + dz * dz < 1e-10) { dup = true; break; } }
      if (!dup) { uniq.push(ring[i], ring[i + 1], ring[i + 2]); mx += ring[i]; my += ring[i + 1]; mz += ring[i + 2]; }
    }
    const m = uniq.length / 3;
    if (m < 3) return null;
    mx /= m; my /= m; mz /= m;
    let ux, uy, uz;
    if (Math.abs(nx) < 0.8) { ux = 0; uy = nz; uz = -ny; } else { ux = -nz; uy = 0; uz = nx; }
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    const order = [];
    for (let k = 0; k < m; k++) { const dx = uniq[k * 3] - mx, dy = uniq[k * 3 + 1] - my, dz = uniq[k * 3 + 2] - mz; order.push([Math.atan2(dx * vx + dy * vy + dz * vz, dx * ux + dy * uy + dz * uz), k]); }
    order.sort((p, q) => p[0] - q[0]);
    const loop = [];
    for (const [, k] of order) loop.push(uniq[k * 3], uniq[k * 3 + 1], uniq[k * 3 + 2]);
    const heat = piece.glow == null ? 1 : piece.glow;
    pos.push({ p: loop.slice(), cap: time, heat, col: piece.inner });
    neg.push({ p: loop, cap: time, heat, col: piece.inner });
    const A = finish(copyMeta({ faces: pos }, piece)), B = finish(copyMeta({ faces: neg }, piece));
    if (!A || !B) return null;
    minVol = minVol || 0;
    if (A.vol < minVol || B.vol < minVol) return null;
    return [A, B];
  }

  // True when two pieces touch or overlap (gaps up to tol count as touching). Face normals only, so it errs toward "touching".
  function touching(A, B, tol) {
    const dx = A.c[0] - B.c[0], dy = A.c[1] - B.c[1], dz = A.c[2] - B.c[2], R = A.r + B.r + tol;
    if (dx * dx + dy * dy + dz * dz > R * R) return false;
    for (let pass = 0; pass < 2; pass++) {
      const F = pass ? B.faces : A.faces, P = pass ? A.pts : B.pts;
      for (const f of F) {
        let out = true;
        for (let i = 0; i < P.length; i += 3) if (f.n[0] * P[i] + f.n[1] * P[i + 1] + f.n[2] * P[i + 2] - f.d <= tol) { out = false; break; }
        if (out) return false;
      }
    }
    return true;
  }

  // Cuts a set of pieces that form one object. want(piece) says whether the blade reaches that piece.
  // Returns null when nothing was cut, else { pieces, groups, cut } where groups are the parts that still hold together.
  function cutSet(pieces, nx, ny, nz, d, time, want, o) {
    o = o || {};
    const minPiece = o.minPiece || 0, minHalf = o.minHalf || 0, tol = o.tol == null ? 0.012 : o.tol;
    const out = [], sides = [];
    let cut = 0;
    for (const p of pieces) {
      let halves = null, reached = false;
      const hard = p.tag && p.tag.hard;
      if (side(p, nx, ny, nz, d, 1e-4) === 0) {
        reached = !want || want(p);
        if (reached && !hard && p.vol >= minPiece) halves = split(p, nx, ny, nz, d, time, minHalf);
      }
      if (halves) { out.push(halves[0], halves[1]); sides.push(1, -1); halves[0].from = p; halves[1].from = p; cut++; continue; }
      // a piece the blade reached but that is too small to halve, or that would only lose a sliver, goes whole to the side
      // most of it is on; left as "across the cut" it would hold the two halves together
      let sd = side(p, nx, ny, nz, d, 2e-4);
      if (sd === 0 && reached && !hard) sd = nx * p.c[0] + ny * p.c[1] + nz * p.c[2] - d >= 0 ? 1 : -1;
      out.push(p); sides.push(sd);
    }
    if (!cut) return null;
    const N = out.length, parent = new Array(N);
    for (let i = 0; i < N; i++) parent[i] = i;
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      if (sides[i] * sides[j] === -1) continue; // nothing holds across the cut except a piece the blade did not go through
      if (find(i) === find(j)) continue;
      if (touching(out[i], out[j], tol)) parent[find(i)] = find(j);
    }
    const map = new Map(), groups = [];
    for (let i = 0; i < N; i++) { const r = find(i); if (!map.has(r)) { map.set(r, groups.length); groups.push([]); } groups[map.get(r)].push(i); }
    return { pieces: out, sides, groups, cut };
  }

  return { EPS, PERM, BLADE, NEON, finish, lathe, box, xf, place, shifted, side, split, touching, cutSet, normalOf };
})();
if (typeof module !== 'undefined') module.exports = GEO;

// Rigid bodies for whatever the blade cuts loose. Each one falls, tumbles and settles on flat ground at y = 0.
// Bodies do not collide with each other; a freshly cut top part rides on its cut plane for a moment instead, so it slides off rather than drops through.
var PHYS = (function () {
  const G = 19;
  // directions used to pick the corners a big body rests on
  const DIRS = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) DIRS.push([x, y, z]);
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) for (const u of [-0.14, 0.14]) for (const v of [-0.14, 0.14]) { const d = [u, u, u]; d[a] = s; d[(a + 1) % 3] = u; d[(a + 2) % 3] = v; DIRS.push(d); }

  function setR(b) {
    const x = b.q[0], y = b.q[1], z = b.q[2], w = b.q[3], x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2, R = b.R;
    R[0] = 1 - (yy + zz); R[1] = xy - wz; R[2] = xz + wy;
    R[3] = xy + wz; R[4] = 1 - (xx + zz); R[5] = yz - wx;
    R[6] = xz - wy; R[7] = yz + wx; R[8] = 1 - (xx + yy);
  }

  // pieces are in world space; the body takes them over, centred on their common centre of mass
  function make(pieces, o) {
    o = o || {};
    let V = 0, cx = 0, cy = 0, cz = 0;
    for (const p of pieces) { V += p.vol; cx += p.c[0] * p.vol; cy += p.c[1] * p.vol; cz += p.c[2] * p.vol; }
    cx /= V; cy /= V; cz /= V;
    const local = pieces.map((p) => GEO.shifted(p, -cx, -cy, -cz));
    const all = [];
    let ex = 0.02, ey = 0.02, ez = 0.02, rad = 0, low = Infinity;
    for (const p of local) for (let i = 0; i < p.pts.length; i += 3) {
      const x = p.pts[i], y = p.pts[i + 1], z = p.pts[i + 2];
      all.push(x, y, z);
      ex = Math.max(ex, Math.abs(x)); ey = Math.max(ey, Math.abs(y)); ez = Math.max(ez, Math.abs(z));
      rad = Math.max(rad, Math.hypot(x, y, z)); low = Math.min(low, y);
    }
    let hull = all;
    if (all.length > 48 * 3) {
      const pick = new Set();
      for (const d of DIRS) { let best = -Infinity, bi = 0; for (let i = 0; i < all.length; i += 3) { const s = all[i] * d[0] + all[i + 1] * d[1] + all[i + 2] * d[2]; if (s > best) { best = s; bi = i; } } pick.add(bi); }
      hull = [];
      for (const i of pick) hull.push(all[i], all[i + 1], all[i + 2]);
    }
    const m = V, k = m / 3; // box-shaped spread of mass over the body's extents
    const b = {
      pieces: local, x: cx, y: cy, z: cz, q: [0, 0, 0, 1], R: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, im: 1 / m, ii: [1 / (k * (ey * ey + ez * ez)), 1 / (k * (ex * ex + ez * ez)), 1 / (k * (ex * ex + ey * ey))],
      hull: new Float32Array(hull), radius: rad, vol: V, low,
      asleep: false, calm: 0, anchored: !!o.anchored, born: o.time || 0, slide: null, hit: 0, grounded: false, mesh: null, kind: o.kind || 'part', gone: 0,
    };
    if (o.v) { b.vx = o.v[0]; b.vy = o.v[1]; b.vz = o.v[2]; }
    if (o.w) { b.wx = o.w[0]; b.wy = o.w[1]; b.wz = o.w[2]; }
    return b;
  }

  // pushes the body out of the half-space below the plane n·x = d and takes away the speed going into it
  function contact(b, nx, ny, nz, d, mu, rest, fix) {
    const R = b.R, h = b.hull, ii = b.ii, im = b.im;
    let maxPen = 0, touched = false;
    for (let i = 0; i < h.length; i += 3) {
      const lx = h[i], ly = h[i + 1], lz = h[i + 2];
      const rx = R[0] * lx + R[1] * ly + R[2] * lz, ry = R[3] * lx + R[4] * ly + R[5] * lz, rz = R[6] * lx + R[7] * ly + R[8] * lz;
      const pen = d - (nx * (b.x + rx) + ny * (b.y + ry) + nz * (b.z + rz));
      if (pen <= 0) continue;
      touched = true;
      if (pen > maxPen) maxPen = pen;
      let ux = b.vx + b.wy * rz - b.wz * ry, uy = b.vy + b.wz * rx - b.wx * rz, uz = b.vz + b.wx * ry - b.wy * rx;
      const vn = ux * nx + uy * ny + uz * nz;
      if (vn >= 0) continue;
      // normal impulse
      let cx = ry * nz - rz * ny, cy = rz * nx - rx * nz, cz = rx * ny - ry * nx;
      let tx = (R[0] * cx + R[3] * cy + R[6] * cz) * ii[0], ty = (R[1] * cx + R[4] * cy + R[7] * cz) * ii[1], tz = (R[2] * cx + R[5] * cy + R[8] * cz) * ii[2];
      let ax = R[0] * tx + R[1] * ty + R[2] * tz, ay = R[3] * tx + R[4] * ty + R[5] * tz, az = R[6] * tx + R[7] * ty + R[8] * tz;
      const kn = im + (ay * rz - az * ry) * nx + (az * rx - ax * rz) * ny + (ax * ry - ay * rx) * nz;
      const jn = -(1 + (vn < -1.5 ? rest : 0)) * vn / kn;
      b.vx += nx * jn * im; b.vy += ny * jn * im; b.vz += nz * jn * im;
      b.wx += ax * jn; b.wy += ay * jn; b.wz += az * jn;
      if (-vn > b.hit) b.hit = -vn;
      // friction
      ux = b.vx + b.wy * rz - b.wz * ry; uy = b.vy + b.wz * rx - b.wx * rz; uz = b.vz + b.wx * ry - b.wy * rx;
      const un = ux * nx + uy * ny + uz * nz;
      ux -= nx * un; uy -= ny * un; uz -= nz * un;
      const ut = Math.hypot(ux, uy, uz);
      if (ut < 1e-5) continue;
      ux /= ut; uy /= ut; uz /= ut;
      cx = ry * uz - rz * uy; cy = rz * ux - rx * uz; cz = rx * uy - ry * ux;
      tx = (R[0] * cx + R[3] * cy + R[6] * cz) * ii[0]; ty = (R[1] * cx + R[4] * cy + R[7] * cz) * ii[1]; tz = (R[2] * cx + R[5] * cy + R[8] * cz) * ii[2];
      ax = R[0] * tx + R[1] * ty + R[2] * tz; ay = R[3] * tx + R[4] * ty + R[5] * tz; az = R[6] * tx + R[7] * ty + R[8] * tz;
      const kt = im + (ay * rz - az * ry) * ux + (az * rx - ax * rz) * uy + (ax * ry - ay * rx) * uz;
      let jt = -ut / kt;
      if (jt < -mu * jn) jt = -mu * jn;
      b.vx += ux * jt * im; b.vy += uy * jt * im; b.vz += uz * jt * im;
      b.wx += ax * jt; b.wy += ay * jt; b.wz += az * jt;
    }
    if (fix && maxPen > 0) { const k = Math.min(maxPen, 0.2) * 0.85; b.x += nx * k; b.y += ny * k; b.z += nz * k; }
    return touched;
  }

  function step(list, dt, time) {
    for (const b of list) {
      if (b.asleep || b.anchored) continue;
      b.vy -= G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      const q = b.q, hx = b.wx * dt * 0.5, hy = b.wy * dt * 0.5, hz = b.wz * dt * 0.5;
      const qx = q[0] + hx * q[3] + hy * q[2] - hz * q[1], qy = q[1] + hy * q[3] + hz * q[0] - hx * q[2], qz = q[2] + hz * q[3] + hx * q[1] - hy * q[0], qw = q[3] - hx * q[0] - hy * q[1] - hz * q[2];
      const l = 1 / Math.hypot(qx, qy, qz, qw);
      q[0] = qx * l; q[1] = qy * l; q[2] = qz * l; q[3] = qw * l;
      setR(b);
      if (b.slide) {
        const s = b.slide, moved = Math.hypot(b.x - s.x0, b.z - s.z0);
        if (time > s.until || moved > s.clear) b.slide = null;
        else { contact(b, s.nx, s.ny, s.nz, s.d, 0.03, 0, false); contact(b, s.nx, s.ny, s.nz, s.d, 0.03, 0, true); }
      }
      let on = contact(b, 0, 1, 0, 0, 0.62, 0.22, false);
      if (on) { contact(b, 0, 1, 0, 0, 0.62, 0, false); contact(b, 0, 1, 0, 0, 0.62, 0, false); contact(b, 0, 1, 0, 0, 0.62, 0, true); }
      b.grounded = on;
      const lin = 1 - (on ? 1.4 : 0.05) * dt, ang = 1 - (on ? 3.2 : 0.25) * dt;
      b.vx *= lin; b.vz *= lin; b.wx *= ang; b.wy *= ang; b.wz *= ang;
      const w2 = b.wx * b.wx + b.wy * b.wy + b.wz * b.wz;
      if (w2 > 900) { const k = 30 / Math.sqrt(w2); b.wx *= k; b.wy *= k; b.wz *= k; }
      // spin is judged by how fast the rim moves, so a pebble and a pillar fall asleep by the same rule
      if (on && !b.slide && b.vx * b.vx + b.vy * b.vy + b.vz * b.vz < 0.05 && w2 * b.radius * b.radius < 0.02) {
        b.calm += dt;
        if (b.calm > 0.4) { b.asleep = true; b.vx = b.vy = b.vz = b.wx = b.wy = b.wz = 0; }
      } else b.calm = 0;
      if (b.y < -30) b.gone = 1;
    }
  }

  // world-space copy of a body's pieces, for cutting it again
  function matrixOf(b) { const R = b.R; return [R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, b.x, b.y, b.z, 1]; }
  function velAt(b, x, y, z) { const rx = x - b.x, ry = y - b.y, rz = z - b.z; return [b.vx + b.wy * rz - b.wz * ry, b.vy + b.wz * rx - b.wx * rz, b.vz + b.wx * ry - b.wy * rx]; }

  return { G, make, step, setR, matrixOf, velAt };
})();
if (typeof module !== 'undefined') module.exports = PHYS;

// Drawing: turns pieces into meshes, makes fresh cuts glow and cool, and holds the sparks, dust and blade trails.
const T = THREE;
const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
const PAL = [
  0x3d4353, 0x79849c, 0x0c0e15, 0xff2d55, // 0 armour, 1 plates, 2 inside of a synth, 3 red light
  0x5a6072, 0x191b23, 0x3df2ff, 0x082a30, // 4 concrete, 5 inside of concrete, 6 a tube of light, 7 inside of a tube
  0x3a4252, 0xffd23f, 0x13151b, 0x2a2e48, // 8 drum, 9 hazard yellow, 10 inside of a drum, 11 the wanderer's coat
  0xff2bd6, 0x4a5066, 0xc9a48c, 0xe4edf7, // 12 magenta, 13 grey plate, 14 skin, 15 steel
  0x16181f, 0x4a3a5c, 0xd9a441, 0xd9dde6, // 16 dark wraps, 17 heavy armour, 18 brass, 19 white plate
  0x120f18, 0xffe14d, 0x6a2f50,           // 20 inside of heavy armour, 21 yellow light, 22 the colossus
  0x3df2ff, 0xff2bd6, 0xff8a1e, 0xffc46b, // 23 cyan light, 24 magenta light, 25 orange light, 26 warm window
  0x0d0f18, 0x5dff8f, 0x1b1d26,           // 27 a tower at night, 28 green light, 29 asphalt
  0x14151e, 0x30354a, 0x1c1e2c, 0x0b0b10, // 30 the wanderer's coat, 31 his armour, 32 his hat, 33 what his fire is set in
].map(lin);
// uHotA / uHotB: what a fresh cut and a cooling cut glow with. They follow the style of the blade.
const SHARED = { uTime: { value: 0 }, uHotA: { value: new T.Vector3(1.0, 0.45, 0.1) }, uHotB: { value: new T.Vector3(1.0, 0.1, 0.01) } };

function partGeometry(pieces) {
  let tris = 0;
  for (const p of pieces) for (const f of p.faces) tris += f.p.length / 3 - 2;
  const pos = new Float32Array(tris * 9), nor = new Float32Array(tris * 9), col = new Float32Array(tris * 9), cut = new Float32Array(tris * 6);
  let k = 0, c = 0;
  for (const p of pieces) for (const f of p.faces) {
    const q = f.p, n = f.n, rgb = PAL[f.col] || PAL[0], glow = f.cap >= 0 ? (f.heat || 1) : 0, when = f.cap >= 0 ? f.cap : 0;
    for (let i = 3; i + 3 < q.length; i += 3) {
      for (const j of [0, i, i + 3]) {
        pos[k] = q[j]; pos[k + 1] = q[j + 1]; pos[k + 2] = q[j + 2];
        nor[k] = n[0]; nor[k + 1] = n[1]; nor[k + 2] = n[2];
        col[k] = rgb.r; col[k + 1] = rgb.g; col[k + 2] = rgb.b;
        cut[c] = when; cut[c + 1] = glow;
        k += 3; c += 2;
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.BufferAttribute(nor, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setAttribute('aCut', new T.BufferAttribute(cut, 2));
  g.computeBoundingSphere();
  return g;
}

// One material for every sliceable thing. A face cut at time t starts white-hot and cools to dark over a few seconds.
const PART_MAT = (function () {
  const m = new T.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SHARED.uTime; sh.uniforms.uHotA = SHARED.uHotA; sh.uniforms.uHotB = SHARED.uHotB;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCut;\nvarying vec2 vCut;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCut = aCut;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uHotA, uHotB;\nvarying vec2 vCut;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (vCut.y > 0.0) {
        if (vCut.x > 2.5e6) totalEmissiveRadiance += vColor.rgb * vCut.y * 2.4; // a light of its own colour: signs, visors, tubes
        else {
          bool blade = vCut.x > 1.5e6, ember = vCut.x > 9.0e5 && !blade; // the wanderer's blade and trim; and a steady warm light
          float age = (blade || ember) ? 0.45 : max(uTime - vCut.x, 0.0);
          vec3 hot = mix(ember ? vec3(1.0, 0.1, 0.01) : uHotB, ember ? vec3(1.0, 0.45, 0.1) : uHotA, exp(-age * 1.4));
          totalEmissiveRadiance += hot * vCut.y * (2.6 * exp(-age * 0.55) + 0.5 * exp(-age * 0.1));
        }
      }`);
  };
  return m;
})();

function partMesh(pieces) {
  const mesh = new T.Mesh(partGeometry(pieces), PART_MAT);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// Round soft dots with their own size and fade: sparks (added light) and dust (plain).
function makeDots(scene, max, additive) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  const vel = new Float32Array(max * 3), life = new Float32Array(max), span = new Float32Array(max), drag = new Float32Array(max), grav = new Float32Array(max), size0 = new Float32Array(max), a0 = new Float32Array(max);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new T.BufferAttribute(col, 4));
  g.setAttribute('aSize', new T.BufferAttribute(size, 1));
  const mat = new T.ShaderMaterial({
    uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
    vertexShader: 'attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vCol; void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vCol; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vCol.rgb, vCol.a * smoothstep(0.5, 0.12, d)); }',
  });
  const pts = new T.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5;
  scene.add(pts);
  let next = 0;
  return {
    mat,
    add(x, y, z, vx, vy, vz, r, gcol, b, alpha, sz, t, dr, gr) {
      const i = next; next = (next + 1) % max;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      col[i * 4] = r; col[i * 4 + 1] = gcol; col[i * 4 + 2] = b; a0[i] = alpha; size0[i] = sz; life[i] = t; span[i] = t; drag[i] = dr; grav[i] = gr;
    },
    step(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
        life[i] -= dt;
        const k = Math.max(0, life[i] / span[i]), d = Math.max(0, 1 - drag[i] * dt);
        vel[i * 3] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d - grav[i] * dt; vel[i * 3 + 2] *= d;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.35; }
        col[i * 4 + 3] = a0[i] * (additive ? k : Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * Math.min(1, (1 - k) * 8));
        size[i] = size0[i] * (additive ? 0.35 + 0.65 * k : 1 + (1 - k) * 1.6);
      }
      g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
    },
  };
}

// What a cut looks like in the air: the crescent the blade leaves, thin flashes of light for cuts too fast to see, and afterimages of the wanderer.
const NOISE_GLSL = 'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }';

// A crescent: an arc in the plane of the cut, sharp and bright along the blade's edge, thick in the middle and pointed at both ends, with a soft
// wake behind the edge. With flame on, the wake is torn into tongues that flicker.
function makeTrails(scene, count) {
  const SEG = 48, pos = new Float32Array((SEG + 1) * 6), uv = new Float32Array((SEG + 1) * 4), idx = [];
  for (let s = 0; s <= SEG; s++) { uv[s * 4] = s / SEG; uv[s * 4 + 1] = 0; uv[s * 4 + 2] = s / SEG; uv[s * 4 + 3] = 1; }
  for (let s = 0; s < SEG; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const list = [];
  for (let i = 0; i < count; i++) {
    const mat = new T.ShaderMaterial({
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false,
      uniforms: { uP: { value: new T.Vector3() }, uF: { value: new T.Vector3() }, uS: { value: new T.Vector3() }, uArc: { value: new T.Vector4() }, uOpen: { value: 0 }, uFade: { value: 1 }, uTime: { value: 0 }, uSeed: { value: i * 7.3 }, uFlame: { value: 0 }, uGain: { value: 1 }, uColA: { value: new T.Vector3() }, uColB: { value: new T.Vector3() } },
      vertexShader: 'uniform vec3 uP, uF, uS; uniform vec4 uArc; uniform float uOpen; varying vec2 vUv; void main(){ vUv = uv; float a = uArc.x + (uArc.y - uArc.x) * uv.x * uOpen; vec3 p = uP + (uF * cos(a) + uS * sin(a)) * mix(uArc.z, uArc.w, uv.y); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }',
      fragmentShader: `uniform vec3 uColA, uColB; uniform float uOpen, uFade, uTime, uSeed, uFlame, uGain; varying vec2 vUv; ${NOISE_GLSL}
        void main(){
          float u = vUv.x, v = vUv.y;
          float taper = pow(max(sin(3.14159 * u), 0.0), 0.55);
          float n = noise(vec2(u * 10.0 - uTime * 5.0 + uSeed, v * 6.0 + uSeed * 3.0));
          float edge = 0.84 - 0.06 * uFlame * n;
          float w = (0.02 + 0.09 * taper) * (1.0 + 0.9 * uFlame * n);
          float core = smoothstep(w, 0.0, abs(v - edge));
          float wake = smoothstep(0.0, edge, v) * smoothstep(edge + 0.12, edge - 0.02, v) * taper;
          wake *= mix(0.5 * v, (0.15 + 1.5 * n * n) * v, uFlame);
          float lead = mix(0.3, 1.0, pow(u, 1.8));
          float alive = clamp((u - (1.0 - uFade) * 1.1 + 0.3) / 0.3, 0.0, 1.0) * sqrt(uFade);
          vec3 col = uColA * core + uColB * wake + vec3(1.0) * pow(core, 6.0) * 0.4;
          gl_FragColor = vec4(col * lead * alive * uGain, 1.0);
        }`,
    });
    const mesh = new T.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 7;
    scene.add(mesh);
    list.push({ mesh, u: mat.uniforms, age: 0, o: null });
  }
  let next = 0;
  return {
    // o: { p:[x,y,z] pivot, f:[..] middle of the swing, s:[..] the side it swings to, a0, a1, r0, r1, T: time to open, hold, fade: seconds,
    //      colA, colB: [r,g,b], flame: 0..1, gain, follow: optional () => [x,y,z] for a crescent that travels }
    add(o) {
      const t = list[next]; next = (next + 1) % count;
      t.o = o; t.age = 0; t.mesh.visible = true;
      t.u.uP.value.fromArray(o.p); t.u.uF.value.fromArray(o.f); t.u.uS.value.fromArray(o.s); t.u.uArc.value.set(o.a0, o.a1, o.r0, o.r1);
      t.u.uColA.value.fromArray(o.colA); t.u.uColB.value.fromArray(o.colB); t.u.uFlame.value = o.flame || 0; t.u.uGain.value = o.gain == null ? 1 : o.gain;
      t.u.uOpen.value = 0; t.u.uFade.value = 1;
      return t;
    },
    stop(t) { if (t && t.o) { t.o.hold = 0; t.age = Math.max(t.age, t.o.T); t.o.follow = null; } }, // let a travelling crescent die out where it is
    step(dt, time) {
      for (const t of list) {
        if (!t.mesh.visible) continue;
        t.age += dt;
        const o = t.o, hold = o.hold || 0, fade = o.fade || 0.2;
        const k = 1 - Math.max(0, t.age - o.T - hold) / fade;
        if (k <= 0) { t.mesh.visible = false; continue; }
        if (o.follow) t.u.uP.value.fromArray(o.follow());
        if (o.grow) { const g = 1 + o.grow * t.age; t.u.uArc.value.set(o.a0, o.a1, o.r0 * g, o.r1 * g); } // a ring that spreads
        const open = Math.min(1, t.age / o.T);
        t.u.uOpen.value = 1 - (1 - open) * (1 - open); t.u.uFade.value = Math.min(1, k); t.u.uTime.value = time;
      }
    },
  };
}

// Thin flashes of light between two points that always face the eye: the lines of cuts made faster than the blade can be seen.
function makeStreaks(scene, max) {
  const pos = new Float32Array(max * 12), uv = new Float32Array(max * 8), col = new Float32Array(max * 16), idx = [], items = [];
  for (let i = 0; i < max; i++) { uv.set([0, 0, 0, 1, 1, 0, 1, 1], i * 8); const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); items.push(null); }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setAttribute('aCol', new T.BufferAttribute(col, 4)); geo.setIndex(idx);
  const mesh = new T.Mesh(geo, new T.ShaderMaterial({
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, side: T.DoubleSide, fog: false,
    vertexShader: 'attribute vec4 aCol; varying vec4 vCol; varying vec2 vUv; void main(){ vCol = aCol; vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec4 vCol; varying vec2 vUv; void main(){ float across = 1.0 - abs(vUv.y - 0.5) * 2.0, along = pow(max(sin(3.14159 * vUv.x), 0.0), 0.35); float core = pow(across, 3.0); gl_FragColor = vec4((vCol.rgb * across + vec3(1.0) * core) * along * vCol.a, 1.0); }',
  }));
  mesh.frustumCulled = false; mesh.renderOrder = 8;
  scene.add(mesh);
  let next = 0;
  const a = new T.Vector3(), b = new T.Vector3(), d = new T.Vector3(), side = new T.Vector3(), eye = new T.Vector3();
  return {
    // from a to b, width in metres, life in seconds, grow: seconds for the line to shoot from a to b
    add(ax, ay, az, bx, by, bz, width, life, grow, rgb) { items[next] = { ax, ay, az, bx, by, bz, width, life, grow: grow || 0.001, rgb, t: 0 }; next = (next + 1) % max; },
    step(dt, camera) {
      for (let i = 0; i < max; i++) {
        const s = items[i], o = i * 12;
        if (!s) continue;
        s.t += dt;
        const k = 1 - s.t / s.life;
        if (k <= 0) { items[i] = null; for (let j = 0; j < 12; j++) pos[o + j] = 0; continue; }
        const g = Math.min(1, s.t / s.grow);
        a.set(s.ax, s.ay, s.az); b.set(s.ax + (s.bx - s.ax) * g, s.ay + (s.by - s.ay) * g, s.az + (s.bz - s.az) * g);
        d.subVectors(b, a); eye.copy(camera.position).sub(a);
        side.crossVectors(d, eye).normalize().multiplyScalar(s.width * (0.35 + 0.65 * k));
        pos[o] = a.x - side.x; pos[o + 1] = a.y - side.y; pos[o + 2] = a.z - side.z; pos[o + 3] = a.x + side.x; pos[o + 4] = a.y + side.y; pos[o + 5] = a.z + side.z;
        pos[o + 6] = b.x - side.x; pos[o + 7] = b.y - side.y; pos[o + 8] = b.z - side.z; pos[o + 9] = b.x + side.x; pos[o + 10] = b.y + side.y; pos[o + 11] = b.z + side.z;
        for (let j = 0; j < 4; j++) { col[i * 16 + j * 4] = s.rgb[0]; col[i * 16 + j * 4 + 1] = s.rgb[1]; col[i * 16 + j * 4 + 2] = s.rgb[2]; col[i * 16 + j * 4 + 3] = k * k; }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aCol.needsUpdate = true;
    },
  };
}

// Afterimages: a frozen copy of a figure, in one colour, that fades out.
function makeGhosts(scene) {
  const list = [];
  return {
    add(pieces, rgb, life) {
      const mat = new T.MeshBasicMaterial({ color: new T.Color(rgb[0], rgb[1], rgb[2]), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, fog: false });
      const mesh = new T.Mesh(partGeometry(pieces), mat);
      mesh.renderOrder = 4;
      scene.add(mesh);
      list.push({ mesh, mat, t: 0, life });
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const g = list[i];
        g.t += dt;
        if (g.t >= g.life) { scene.remove(g.mesh); g.mesh.geometry.dispose(); g.mat.dispose(); list.splice(i, 1); } else g.mat.opacity = 0.55 * (1 - g.t / g.life);
      }
    },
  };
}

// Fire on the blade: two crossed sheets along it, and the flame is whatever of them the noise lets through. The noise runs from grip to tip,
// so the tongues climb the blade; the middle is white-hot and the edges take the colour of the style.
function makeBladeFire() {
  const w = 0.2, y0 = 0.1, y1 = 1.34, pos = [], uv = [], idx = [];
  for (const [ax, az] of [[1, 0], [0, 1]]) { const b = pos.length / 3; pos.push(-w * ax, y0, -w * az, w * ax, y0, w * az, -w * ax, y1, -w * az, w * ax, y1, w * az); uv.push(0, 0, 1, 0, 0, 1, 1, 1); idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('uv', new T.BufferAttribute(new Float32Array(uv), 2)); g.setIndex(idx);
  const mat = new T.ShaderMaterial({
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uGain: { value: 1 }, uColA: { value: new T.Vector3(1, 0.5, 0.1) }, uColB: { value: new T.Vector3(1, 0.1, 0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColA, uColB; uniform float uTime, uGain; varying vec2 vUv; ${NOISE_GLSL}
      void main(){
        float core = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float n = noise(vec2(vUv.x * 4.0, vUv.y * 7.0 - uTime * 6.5)) * 0.62 + noise(vec2(vUv.x * 9.0 + 3.1, vUv.y * 16.0 - uTime * 12.0)) * 0.38;
        float f = smoothstep(0.34, 0.9, core + (n - 0.5) * 1.15);
        f *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.72, vUv.y + (n - 0.5) * 0.25);
        vec3 col = mix(uColB, uColA, smoothstep(0.25, 0.85, core)) * f + vec3(1.0, 0.95, 0.85) * smoothstep(0.8, 1.0, core) * f * 0.7;
        gl_FragColor = vec4(col * uGain, 1.0);
      }`,
  });
  const mesh = new T.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 7;
  return { mesh, u: mat.uniforms };
}

// Fire that stands in the air. Each flame is a sheet that turns about its own axis to face the eye; the noise climbs it and eats it away from the
// top, so it licks and tears. White-hot at the root, the colour of the blade higher up. A flame can stay where it was lit, drift, or ride on
// something that moves. Because the sheets stand upright in the world, the wet ground mirrors them properly.
function makeFires(scene, max) {
  const pos = new Float32Array(max * 12), cor = new Float32Array(max * 8), dat = new Float32Array(max * 16), axis = new Float32Array(max * 12), gain = new Float32Array(max * 4), idx = [], items = [];
  for (let i = 0; i < max; i++) { cor.set([-1, 0, 1, 0, -1, 1, 1, 1], i * 8); const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); items.push(null); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCor', new T.BufferAttribute(cor, 2)); g.setAttribute('aDat', new T.BufferAttribute(dat, 4));
  g.setAttribute('aAxis', new T.BufferAttribute(axis, 3)); g.setAttribute('aGain', new T.BufferAttribute(gain, 1)); g.setIndex(idx);
  const mat = new T.ShaderMaterial({
    transparent: true, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, depthWrite: false, side: T.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uColA: { value: new T.Vector3(2, 0.7, 0.14) }, uColB: { value: new T.Vector3(0.8, 0.14, 0.02) } },
    vertexShader: `attribute vec2 aCor; attribute vec4 aDat; attribute vec3 aAxis; attribute float aGain; varying vec2 vUv; varying vec3 vInf;
      void main(){
        vUv = aCor; vInf = vec3(aDat.z, aDat.w, aGain);
        vec3 side = cross(aAxis, cameraPosition - position); float l = length(side);
        side = l > 1e-5 ? side / l : vec3(1.0, 0.0, 0.0);
        float grow = 0.45 + 0.55 * smoothstep(0.0, 0.16, aDat.w);
        vec3 p = position + side * aCor.x * aDat.x * 0.5 * grow + aAxis * aCor.y * aDat.y * grow;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColA, uColB; uniform float uTime; varying vec2 vUv; varying vec3 vInf; ${NOISE_GLSL}
      void main(){
        float y = vUv.y, seed = vInf.x, age = vInf.y;
        float n1 = noise(vec2(vUv.x * 1.5 + seed * 13.0, y * 2.4 - uTime * 3.1 + seed * 7.0));
        float n2 = noise(vec2(vUv.x * 3.9 - seed * 5.0, y * 6.2 - uTime * 6.4 + seed));
        float x = vUv.x + (n1 - 0.5) * 0.9 * y + sin(y * 5.0 + uTime * 7.0 + seed * 40.0) * 0.13 * y;      // the whole tongue sways, more the higher it is
        float wide = 0.95 * pow(max(1.0 - y, 0.0), 0.6) * (0.78 + 0.22 * sin(y * 9.0 - uTime * 10.0 + seed * 20.0)); // round at the root, a point at the top, and the outline climbs in waves
        float body = 1.0 - abs(x) / max(wide, 0.02);
        float d = body * 0.85 + (n1 * 0.6 + n2 * 0.4 - 0.5) * (0.55 + 1.25 * y) - age * (0.3 + 1.0 * y) - 0.04;
        d *= smoothstep(0.0, 0.05, y);
        float f = smoothstep(0.0, 0.3, d), core = smoothstep(0.22, 0.66, d), white = smoothstep(0.55, 0.95, d) * (1.0 - 0.7 * y);
        vec3 col = uColB * f * (1.0 - core) * 1.5 + uColA * core * 0.85 + vec3(1.0, 0.88, 0.7) * white * 0.75;
        float k = vInf.z * smoothstep(0.0, 0.07, age) * (1.0 - age * age * age);
        gl_FragColor = vec4(col * k, clamp(f * 0.62 * k, 0.0, 0.85)); // it adds its light, and hides a part of what is behind it
      }`,
  });
  const mesh = new T.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 6;
  scene.add(mesh);
  let next = 0, live = 0;
  return {
    u: mat.uniforms,
    count: () => live,
    // o: { x, y, z: the root, w, h: metres, life: seconds, gain, vx, vy, vz: drift, ux, uy, uz: which way it stands (up if left out),
    //      on: something with x, y, z that it rides on, ox, oy, oz: where on it }
    add(o) {
      let i = next, tries = 0;
      while (items[i] && items[i].keep && tries++ < 12) i = (i + 1) % max; // a flame that was asked to last is not the first to be overwritten
      next = (i + 1) % max;
      o.t = -(o.delay || 0); o.seed = Math.random(); o.gain = o.gain == null ? 1 : o.gain; // delay: seconds before it comes up
      if (o.ux == null) { o.ux = 0; o.uy = 1; o.uz = 0; }
      items[i] = o;
      return o;
    },
    clear() { for (let i = 0; i < max; i++) items[i] = null; },
    step(dt, time) {
      live = 0;
      for (let i = 0; i < max; i++) {
        const f = items[i], o = i * 12;
        if (!f) { if (dat[i * 16 + 1] !== 0) for (let j = 0; j < 4; j++) { dat[i * 16 + j * 4] = 0; dat[i * 16 + j * 4 + 1] = 0; gain[i * 4 + j] = 0; } continue; }
        if (f.on && (f.on.dead || f.on.gone)) { f.on = null; f.life = Math.min(f.life, f.t + 0.2); } // what it was riding is gone: it burns out where it is
        f.t += dt;
        if (f.t < 0) { live++; continue; } // not lit yet
        const age = f.t / f.life;
        if (age >= 1) { items[i] = null; for (let j = 0; j < 4; j++) { dat[i * 16 + j * 4] = 0; dat[i * 16 + j * 4 + 1] = 0; gain[i * 4 + j] = 0; } continue; }
        live++;
        if (f.on) { f.x = f.on.x + (f.ox || 0); f.y = Math.max(0.02, f.on.y + (f.oy || 0)); f.z = f.on.z + (f.oz || 0); }
        else if (f.vx || f.vy || f.vz) { const k = Math.max(0, 1 - 2.2 * dt); f.vx *= k; f.vz *= k; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; }
        for (let j = 0; j < 4; j++) {
          pos[o + j * 3] = f.x; pos[o + j * 3 + 1] = f.y; pos[o + j * 3 + 2] = f.z;
          axis[o + j * 3] = f.ux; axis[o + j * 3 + 1] = f.uy; axis[o + j * 3 + 2] = f.uz;
          const q = i * 16 + j * 4; dat[q] = f.w; dat[q + 1] = f.h; dat[q + 2] = f.seed; dat[q + 3] = age;
          gain[i * 4 + j] = f.gain;
        }
      }
      g.attributes.position.needsUpdate = true; g.attributes.aDat.needsUpdate = true; g.attributes.aAxis.needsUpdate = true; g.attributes.aGain.needsUpdate = true;
      mat.uniforms.uTime.value = time;
    },
  };
}

// Light thrown by fire: a few lamps that are always in the scene and mostly dark. A burst takes the dimmest one, flares, flickers and dies.
function makeFlares(scene, n) {
  const list = [];
  for (let i = 0; i < n; i++) { const l = new T.PointLight(new T.Color(1, 0.5, 0.2), 0, 12, 1.6); l.position.set(0, -50, 0); scene.add(l); list.push({ l, t: 0, life: 0, power: 0, on: null }); }
  return {
    add(x, y, z, rgb, power, life, reach, on) {
      let best = null, low = Infinity;
      for (const f of list) { const k = f.life > 0 ? 1 - f.t / f.life : 0, lit = f.power * k * k; if (f.life <= 0 || lit < low) { low = f.life <= 0 ? -1 : lit; best = f; if (f.life <= 0) break; } }
      const m = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
      best.l.color.setRGB(rgb[0] / m, rgb[1] / m, rgb[2] / m); best.l.position.set(x, Math.max(0.4, y), z); best.l.distance = reach || 12;
      best.t = 0; best.life = life; best.power = power; best.on = on || null;
    },
    step(dt, time) {
      for (const f of list) {
        if (f.life <= 0) continue;
        f.t += dt;
        const k = 1 - f.t / f.life;
        if (k <= 0) { f.life = 0; f.l.intensity = 0; continue; }
        if (f.on) f.l.position.set(f.on.x, Math.max(0.5, (f.on.y || 0) + 1.2), f.on.z);
        f.l.intensity = f.power * k * k * (0.82 + 0.18 * Math.sin(time * 61 + f.power * 7));
      }
    },
  };
}

// The sheet of fire the blade draws through the air: it spans the blade from guard to tip at every place the blade has just been, and burns
// away from the guard outward, so what is left last is the line the tip drew.
function makeSweep(scene, n) {
  const pts = [], pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), heat = new Float32Array(n * 2), idx = [];
  for (let i = 0; i + 1 < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('aHeat', new T.BufferAttribute(heat, 1)); g.setIndex(idx);
  const mat = new T.ShaderMaterial({
    transparent: true, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, depthWrite: false, side: T.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uGain: { value: 1 }, uColA: { value: new T.Vector3(2, 0.7, 0.14) }, uColB: { value: new T.Vector3(0.8, 0.14, 0.02) } },
    vertexShader: 'attribute float aHeat; varying vec2 vUv; varying float vHeat; void main(){ vUv = uv; vHeat = aHeat; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColA, uColB; uniform float uTime, uGain; varying vec2 vUv; varying float vHeat; ${NOISE_GLSL}
      void main(){
        float age = vUv.x, v = vUv.y;
        float nz = noise(vec2(v * 5.0 + uTime * 1.7, age * 8.0 - uTime * 6.0)) * 0.65 + noise(vec2(v * 11.0 - uTime * 2.3, age * 19.0 - uTime * 11.0)) * 0.35;
        float streak = noise(vec2(v * 13.0 + uTime * 0.6, age * 2.2 - uTime * 1.5));        // long streaks that lie along the way the blade went
        float fl = smoothstep(age * 1.05 - 0.05, age * 1.05 + 0.42, v * (0.4 + 0.9 * nz));   // the guard end goes dark first
        fl *= smoothstep(1.0, 0.93, v) * smoothstep(0.0, 0.12, v) * (0.25 + 0.75 * smoothstep(0.3, 0.7, streak));
        float edge = pow(v, 7.0) * (1.0 - age) * (1.0 - age);
        vec3 col = mix(uColB * 1.5, uColA * 0.75, clamp(v * 1.1 - age * 1.2, 0.0, 1.0)) * fl * (0.3 + 0.7 * v) + vec3(1.0, 0.9, 0.75) * edge * fl * 0.9;
        float k = (1.0 - age) * vHeat * uGain;
        gl_FragColor = vec4(col * k, clamp(fl * 0.4 * k, 0.0, 0.6));
      }`,
  });
  const mesh = new T.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 7;
  scene.add(mesh);
  let last = null; // the last true place of the blade, for filling in between frames
  const push = (ax, ay, az, bx, by, bz, t, h) => { pts.push({ ax, ay, az, bx, by, bz, t, h, gap: false }); if (pts.length > n) pts.shift(); };
  return {
    u: mat.uniforms,
    // a: the guard end, d: unit direction of the blade, len: its length, t: now, h: how hot this stretch burns (0..1)
    add(ax, ay, az, dx, dy, dz, len, t, h) {
      const l = last;
      if (l && !l.gap) {
        const dot = Math.max(-1, Math.min(1, l.dx * dx + l.dy * dy + l.dz * dz)), ang = Math.acos(dot), move = Math.hypot(ax - l.ax, ay - l.ay, az - l.az);
        if (ang < 0.012 && move < 0.02) { l.t = t; return; } // the blade is still: nothing new to draw
        const steps = Math.min(14, Math.max(1, Math.ceil(ang / 0.16), Math.ceil(move / 0.5))), sn = Math.sin(ang);
        for (let i = 1; i <= steps; i++) { // between two frames the blade went round, not straight across: fill the arc in
          const k = i / steps, w0 = sn > 1e-4 ? Math.sin((1 - k) * ang) / sn : 1 - k, w1 = sn > 1e-4 ? Math.sin(k * ang) / sn : k;
          const ex = l.dx * w0 + dx * w1, ey = l.dy * w0 + dy * w1, ez = l.dz * w0 + dz * w1, px = l.ax + (ax - l.ax) * k, py = l.ay + (ay - l.ay) * k, pz = l.az + (az - l.az) * k;
          push(px, py, pz, px + ex * len, py + ey * len, pz + ez * len, l.t + (t - l.t) * k, l.h + (h - l.h) * k);
        }
      } else push(ax, ay, az, ax + dx * len, ay + dy * len, az + dz * len, t, h);
      last = { ax, ay, az, dx, dy, dz, t, h, gap: false };
    },
    gap() { if (pts.length) pts[pts.length - 1].gap = true; if (last) last.gap = true; }, // the blade jumped or was put away: the next stretch does not join this one
    step(time, life) {
      while (pts.length && time - pts[0].t > life) pts.shift();
      const m = pts.length;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        if (i >= m) { const q = m ? pts[m - 1] : null; for (let k = 0; k < 2; k++) { pos[o + k * 3] = q ? q.bx : 0; pos[o + k * 3 + 1] = q ? q.by : 0; pos[o + k * 3 + 2] = q ? q.bz : 0; } uv[i * 4] = uv[i * 4 + 2] = 1; heat[i * 2] = heat[i * 2 + 1] = 0; continue; }
        const p = pts[i], age = Math.min(1, (time - p.t) / life), cut = p.gap || (i > 0 && pts[i - 1].gap);
        pos[o] = p.ax; pos[o + 1] = p.ay; pos[o + 2] = p.az; pos[o + 3] = p.bx; pos[o + 4] = p.by; pos[o + 5] = p.bz;
        uv[i * 4] = age; uv[i * 4 + 1] = 0; uv[i * 4 + 2] = age; uv[i * 4 + 3] = 1;
        heat[i * 2] = heat[i * 2 + 1] = cut ? 0 : p.h;
        if (p.gap && i + 1 < m) { const q = pts[i + 1]; pos[o] = q.ax; pos[o + 1] = q.ay; pos[o + 2] = q.az; pos[o + 3] = q.bx; pos[o + 4] = q.by; pos[o + 5] = q.bz; } // folded onto the next, so nothing is drawn across the jump
      }
      g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.aHeat.needsUpdate = true;
      mat.uniforms.uTime.value = time;
    },
  };
}

// What fire leaves on the ground: a patch of embers that crackles, cools from the colour of the blade to a dull red, and goes out.
function makeScorch(scene, max) {
  const pos = new Float32Array(max * 12), uv = new Float32Array(max * 8), dat = new Float32Array(max * 12), idx = [], items = [];
  for (let i = 0; i < max; i++) { uv.set([-1, -1, 1, -1, -1, 1, 1, 1], i * 8); const a = i * 4; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); items.push(null); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('aDat', new T.BufferAttribute(dat, 3)); g.setIndex(idx);
  const mat = new T.ShaderMaterial({
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uTime: { value: 0 }, uColA: { value: new T.Vector3(2, 0.7, 0.14) }, uColB: { value: new T.Vector3(0.8, 0.14, 0.02) } },
    vertexShader: 'attribute vec3 aDat; varying vec2 vUv; varying vec3 vDat; void main(){ vUv = uv; vDat = aDat; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColA, uColB; uniform float uTime; varying vec2 vUv; varying vec3 vDat; ${NOISE_GLSL}
      void main(){
        float r = length(vUv), seed = vDat.x, age = vDat.y;
        float n = noise(vUv * 3.2 + seed * 31.0) * 0.6 + noise(vUv * 8.5 - seed * 17.0) * 0.4;
        float crack = smoothstep(0.42, 0.62, n) * (0.55 + 0.45 * sin(uTime * (7.0 + seed * 9.0) + n * 30.0));  // embers that wink
        float body = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.5);
        float hot = exp(-age * 5.0);
        vec3 col = mix(uColB * 0.55, uColA, hot) * body * (0.3 * hot + crack * (0.5 + hot));
        gl_FragColor = vec4(col * vDat.z * (1.0 - age) * (1.0 - age), 1.0);
      }`,
  });
  const mesh = new T.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  scene.add(mesh);
  let next = 0;
  return {
    u: mat.uniforms,
    // a patch at (x, z): half-sizes a along the direction (dx, dz) and b across it
    add(x, z, a, b, life, gain, dx, dz) {
      const i = next; next = (next + 1) % max;
      if (dx == null) { const g0 = Math.random() * 6.283; dx = Math.cos(g0); dz = Math.sin(g0); }
      const o = i * 12, y = 0.045 + (i % 7) * 0.0015, c = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (let j = 0; j < 4; j++) { pos[o + j * 3] = x + dx * a * c[j][0] - dz * b * c[j][1]; pos[o + j * 3 + 1] = y; pos[o + j * 3 + 2] = z + dz * a * c[j][0] + dx * b * c[j][1]; }
      items[i] = { t: 0, life, seed: Math.random(), gain: gain == null ? 1 : gain };
      g.attributes.position.needsUpdate = true;
    },
    clear() { for (let i = 0; i < max; i++) items[i] = null; },
    step(dt, time) {
      for (let i = 0; i < max; i++) {
        const s = items[i];
        if (s) { s.t += dt; if (s.t >= s.life) items[i] = null; }
        const q = items[i];
        for (let j = 0; j < 4; j++) { dat[i * 12 + j * 3] = q ? q.seed : 0; dat[i * 12 + j * 3 + 1] = q ? q.t / q.life : 1; dat[i * 12 + j * 3 + 2] = q ? q.gain : 0; }
      }
      g.attributes.aDat.needsUpdate = true;
      mat.uniforms.uTime.value = time;
    },
  };
}

// The figures: the wanderer, and the synths sent after him, each with a blade of light. Every part is a convex piece on a bone, so any of it can be cut.
// A figure faces +z; its right side is -x. Bones turn about their own origin (the joint).
const MODELS = (function () {
  const L = GEO.lathe, B = GEO.box, P = GEO.place;
  // a limb hanging from the joint: r0 thick at the joint, r1 at the far end
  const limb = (len, r0, r1, o) => P(L([[r1, 0], [r0, len]], o), 0, -len, 0);
  const glowing = (piece, heat, how) => { for (const f of piece.faces) { f.cap = how || GEO.PERM; f.heat = heat; } return piece; };
  const neon = (piece, heat) => glowing(piece, heat == null ? 0.9 : heat, GEO.NEON);       // a light of its own colour
  const trim = (piece, heat) => glowing(piece, heat == null ? 0.6 : heat, GEO.BLADE);      // glows in the colour of the wanderer's blade

  function makeRig(def) {
    const root = new T.Group(), bones = {}, list = [];
    for (const d of def) {
      const b = new T.Object3D();
      b.name = d.name; b.position.set(d.at[0], d.at[1], d.at[2]); b.rest = d.at.slice();
      b.pieces = d.pieces; b.mesh = null;
      (d.parent ? bones[d.parent] : root).add(b);
      bones[d.name] = b; list.push(b);
      rebuild(b);
    }
    return { root, bones, list };
  }
  function rebuild(b) {
    if (b.mesh) { b.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh = null; }
    if (!b.pieces.length) return;
    b.mesh = partMesh(b.pieces);
    b.add(b.mesh);
  }
  function dispose(rig) { for (const b of rig.list) if (b.mesh) { b.mesh.geometry.dispose(); b.mesh = null; } }

  // A synth: armour over a frame, a visor that glows, a blade of light in the right hand. core pieces are the ones it cannot go on without.
  // kind: grunt (red, a katana), imp (small, yellow, a short blade in each hand), thrower (cyan, a gun), brute (orange, a long heavy blade),
  // colossus (magenta and brass; its legs are not vital, so it can be felled and finished on the ground)
  function synth(kind) {
    const brute = kind === 'brute', giant = kind === 'colossus', imp = kind === 'imp', gunner = kind === 'thrower';
    const armour = brute ? 17 : giant ? 22 : 0, plate = giant ? 18 : brute ? 1 : 1, inner = brute || giant ? 20 : 2, light = brute ? 25 : giant ? 24 : imp ? 21 : gunner ? 23 : 3;
    const o = (col, extra) => Object.assign({ col, inner, glow: 1 }, extra || {});
    const core = { core: true }, chest = { core: true, chest: true }, legs = giant ? null : core, held = { fist: true };
    // what is in the hand, hanging from the forearm and pointing forward: grip, guard, and the blade, which is the part that counts as the weapon
    const sword = (len, wide) => [
      P(B(0.036, 0.25, 0.042, o(16)), 0, -0.4, -0.07, Math.PI / 2, 0, 0),
      P(B(0.11, 0.022, 0.085, o(18)), 0, -0.4, 0.18, Math.PI / 2, 0, 0),
      neon(P(B(0.018, len, wide, o(light, { taper: 0.5, taperZ: 0.45, tag: held })), 0, -0.4, 0.2, Math.PI / 2, 0, 0), 0.85),
    ];
    const gun = () => [
      P(B(0.07, 0.36, 0.11, o(1, { tag: held })), 0, -0.36, -0.06, Math.PI / 2, 0, 0),
      P(B(0.05, 0.14, 0.06, o(16)), 0, -0.5, -0.02),
      neon(P(B(0.03, 0.2, 0.03, o(light)), 0, -0.325, 0.02, Math.PI / 2, 0, 0), 1.1),
    ];
    const arm = (s, hold) => {
      const hand = P(B(0.08, 0.09, 0.08, o(16, hold ? null : { tag: held })), 0, -0.38, 0);
      return [
        { name: 'arm' + s, parent: 'chest', at: [(s === 'L' ? 1 : -1) * 0.27, 0.43, 0], pieces: [
          P(B(0.16, 0.085, 0.18, o(plate, { taper: 0.72 })), 0, 0.0, 0),
          neon(P(B(0.165, 0.016, 0.185, o(light)), 0, -0.012, 0), 0.5),
          limb(0.3, 0.062, 0.052, o(armour, { sides: 6 })),
        ] },
        { name: 'fore' + s, parent: 'arm' + s, at: [0, -0.3, 0], pieces: [
          limb(0.29, 0.05, 0.046, o(armour, { sides: 6 })),
          P(L([[0.064, 0], [0.064, 0.11]], o(plate, { sides: 6 })), 0, -0.24, 0),
          hand,
        ].concat(hold || []) },
      ];
    };
    const leg = (s) => [
      { name: 'thigh' + s, parent: 'hips', at: [(s === 'L' ? 1 : -1) * 0.1, -0.08, 0], pieces: [
        limb(0.42, 0.088, 0.07, o(armour, { sides: 6, tag: legs })),
        P(B(0.11, 0.2, 0.05, o(plate, { taper: 0.8 })), 0, -0.3, 0.06),
      ] },
      { name: 'shin' + s, parent: 'thigh' + s, at: [0, -0.42, 0], pieces: [
        limb(0.34, 0.066, 0.05, o(armour, { sides: 6, tag: legs })),
        P(B(0.095, 0.24, 0.045, o(plate, { taper: 0.75 })), 0, -0.3, 0.045),
        P(B(0.11, 0.07, 0.26, o(16)), 0, -0.4, 0.05),
      ] },
    ];
    const head = [
      L([[0.06, -0.05], [0.06, 0.06]], o(16, { sides: 6 })),
      L([[0.1, 0.03], [0.138, 0.1], [0.138, 0.2], [0.09, 0.29]], o(armour, { sides: 7, sz: 1.05, tag: core })),
      neon(P(B(0.215, 0.036, 0.06, o(light)), 0, 0.15, 0.11), 1.4), // the visor: one slit of light across the face
      P(B(0.26, 0.05, 0.2, o(plate, { taper: 0.85 })), 0, 0.2, -0.01),
    ];
    if (brute || giant) head.push(P(L([[0.045, 0], [0, 0.3]], o(18, { sides: 5 })), 0.12, 0.24, 0.02, 0, 0, -0.55), P(L([[0.045, 0], [0, 0.3]], o(18, { sides: 5 })), -0.12, 0.24, 0.02, 0, 0, 0.55));
    else if (!imp) head.push(P(B(0.03, 0.13, 0.17, o(plate)), 0, 0.27, -0.04));
    if (imp) for (let i = 0; i < head.length; i++) head[i] = P(head[i], 0, 0, 0, 0, 0, 0, 1.35);
    const right = gunner ? gun() : sword(imp ? 0.5 : brute ? 1.4 : giant ? 1.5 : 0.98, brute || giant ? 0.075 : 0.045);
    return [
      { name: 'hips', parent: null, at: [0, 0.9, 0], pieces: [
        P(B(0.32, 0.2, 0.22, o(armour, { taper: 1.06, tag: legs })), 0, -0.1, 0),
        neon(P(L([[0.172, 0], [0.172, 0.022]], o(light, { sides: 6, sz: 0.74 })), 0, 0.085, 0), 0.5),
      ] },
      { name: 'chest', parent: 'hips', at: [0, 0.09, 0], pieces: [
        L([[0.14, 0], [0.17, 0.2]], o(armour, { sides: 6, sz: 0.74, tag: core })),
        P(L([[0.17, 0], [0.25, 0.2], [0.22, 0.34]], o(armour, { sides: 6, sz: 0.7, tag: chest })), 0, 0.18, 0),
        P(B(0.27, 0.17, 0.05, o(plate, { taper: 0.78 })), 0, 0.31, 0.125),
        neon(P(B(0.15, 0.02, 0.035, o(light)), 0, 0.275, 0.16), 0.9),
        P(B(0.19, 0.22, 0.07, o(plate)), 0, 0.25, -0.185),
      ] },
      { name: 'head', parent: 'chest', at: [0, 0.53, 0], pieces: head },
      ...arm('L', imp ? sword(0.5, 0.045) : null), ...arm('R', right), ...leg('L'), ...leg('R'),
    ];
  }

  // The wanderer. Not meant to be cut, but built the same way so that a lost fight leaves a heap. His trim glows in the colour of his blade.
  // Layered shoulder guards, bracers and greaves over a dark coat; a scabbard at the left hip; a wide hat; and cloth that streams behind him:
  // two tails of a scarf from the neck and two tails of the coat from the belt, each on bones of its own.
  function hero() {
    const o = (col, extra) => Object.assign({ col, inner: 16, glow: 0.3 }, extra || {});
    const arm = (s) => {
      const sx = s === 'L' ? 1 : -1, big = s === 'L' ? 1.18 : 1; // the left shoulder, the one turned to the enemy, carries the bigger guard
      return [
        { name: 'arm' + s, parent: 'chest', at: [sx * 0.21, 0.34, 0], pieces: [
          limb(0.27, 0.062, 0.05, o(30, { sides: 6 })),
          P(B(0.17 * big, 0.05, 0.2 * big, o(31, { taper: 0.8 })), sx * 0.02, 0.0, 0, 0, 0, -sx * 0.25),
          P(B(0.165 * big, 0.045, 0.19 * big, o(31, { taper: 0.86 })), sx * 0.05, -0.058, 0, 0, 0, -sx * 0.42),
          trim(P(B(0.17 * big, 0.012, 0.195 * big, o(33)), sx * 0.052, -0.068, 0, 0, 0, -sx * 0.42), 0.6),
          P(B(0.15 * big, 0.04, 0.17 * big, o(31, { taper: 0.88 })), sx * 0.075, -0.115, 0, 0, 0, -sx * 0.58),
        ] },
        { name: 'fore' + s, parent: 'arm' + s, at: [0, -0.27, 0], pieces: [
          limb(0.25, 0.048, 0.04, o(16, { sides: 6 })),
          P(L([[0.05, 0], [0.06, 0.15]], o(31, { sides: 6 })), 0, -0.23, 0),
          trim(P(L([[0.063, 0], [0.063, 0.018]], o(33, { sides: 6 })), 0, -0.1, 0), 0.6),
          P(B(0.07, 0.08, 0.07, o(16)), 0, -0.32, 0),
        ] },
      ];
    };
    const leg = (s) => {
      const sx = s === 'L' ? 1 : -1;
      return [
        { name: 'thigh' + s, parent: 'hips', at: [sx * 0.09, -0.06, 0], pieces: [
          limb(0.38, 0.1, 0.135, o(30, { sides: 6 })),
          P(B(0.035, 0.26, 0.2, o(31, { taper: 0.85 })), sx * 0.135, -0.31, 0, 0, 0, sx * 0.1),
          trim(P(B(0.04, 0.014, 0.205, o(33)), sx * 0.137, -0.315, 0, 0, 0, sx * 0.1), 0.5),
        ] },
        { name: 'shin' + s, parent: 'thigh' + s, at: [0, -0.38, 0], pieces: [
          limb(0.3, 0.055, 0.045, o(16, { sides: 6 })),
          P(B(0.088, 0.21, 0.04, o(31, { taper: 0.8 })), 0, -0.27, 0.042),
          trim(P(B(0.092, 0.012, 0.045, o(33)), 0, -0.07, 0.042), 0.5),
          P(B(0.09, 0.06, 0.22, o(16)), 0, -0.36, 0.04),
        ] },
      ];
    };
    // the scabbard: along -z and a little down from the left hip, with two brass rings and a lit mouth
    const saya = (piece) => P(piece, 0.19, 0.03, 0.15, -1.9, 0, 0);
    // one length of cloth hanging from its bone, lit along its lower edge
    const cloth = (w, len, taper, heat) => [P(B(w, len, 0.022, o(30, { taper: 1 / taper })), 0, -len, 0), trim(P(B(w * taper, 0.03, 0.026, o(33)), 0, -len, 0), heat)];
    const band = (w, len, taper, heat) => [trim(P(B(w * taper, len, 0.024, o(33, { taper: 1 / taper })), 0, -len, 0), heat)];
    return [
      { name: 'hips', parent: null, at: [0, 0.8, 0], pieces: [
        P(B(0.29, 0.17, 0.2, o(30)), 0, -0.09, 0),
        trim(P(L([[0.165, 0], [0.165, 0.06]], o(33, { sides: 8, sz: 0.76 })), 0, 0.05, 0), 0.45),
        P(B(0.1, 0.085, 0.05, o(18, { taper: 0.7 })), 0, 0.035, 0.115),
        saya(B(0.042, 0.94, 0.058, o(16, { taper: 0.75 }))),
        saya(P(B(0.054, 0.05, 0.07, o(18)), 0, 0.0, 0)),
        saya(P(B(0.05, 0.03, 0.066, o(18)), 0, 0.3, 0)),
        trim(saya(P(B(0.048, 0.016, 0.064, o(33)), 0, 0.055, 0)), 0.7),
      ] },
      { name: 'chest', parent: 'hips', at: [0, 0.1, 0], pieces: [
        L([[0.13, 0], [0.195, 0.27], [0.165, 0.38]], o(30, { sides: 6, sz: 0.7 })),
        P(B(0.25, 0.2, 0.05, o(31, { taper: 0.74 })), 0, 0.13, 0.105),          // the breastplate
        trim(P(B(0.03, 0.12, 0.02, o(33, { taper: 0.4 })), 0, 0.17, 0.135), 1.0), // and the ember set in it
        P(B(0.22, 0.24, 0.05, o(31, { taper: 0.8 })), 0, 0.1, -0.135),
        P(L([[0.1, 0], [0.085, 0.075]], o(16, { sides: 6 })), 0, 0.345, 0),
      ] },
      { name: 'head', parent: 'chest', at: [0, 0.39, 0], pieces: [
        L([[0.05, -0.03], [0.05, 0.05]], o(14, { sides: 6 })),
        L([[0.07, 0.02], [0.1, 0.08], [0.1, 0.17], [0.07, 0.23]], o(14, { sides: 6 })),
        P(B(0.14, 0.085, 0.05, o(16, { taper: 1.15 })), 0, 0.02, 0.07),          // a mask over the lower face
        trim(P(B(0.16, 0.024, 0.03, o(33)), 0, 0.122, 0.086), 1.3),               // the eyes: one slit of fire
        P(L([[0.4, 0], [0.05, 0.18]], o(32, { sides: 11 })), 0, 0.165, 0),
        trim(P(L([[0.408, 0], [0.408, 0.014]], o(33, { sides: 11 })), 0, 0.157, 0), 0.45),
        P(L([[0.062, 0], [0.04, 0.05]], o(18, { sides: 6 })), 0, 0.335, 0),
      ] },
      { name: 'scarf', parent: 'chest', at: [-0.045, 0.36, -0.1], pieces: band(0.13, 0.34, 0.9, 0.75) },
      { name: 'scarf2', parent: 'scarf', at: [0, -0.34, 0], pieces: band(0.117, 0.4, 0.5, 0.75) },
      { name: 'band', parent: 'chest', at: [0.05, 0.36, -0.1], pieces: band(0.1, 0.27, 0.9, 0.6) },
      { name: 'band2', parent: 'band', at: [0, -0.27, 0], pieces: band(0.09, 0.3, 0.5, 0.6) },
      { name: 'tailL', parent: 'hips', at: [0.085, -0.02, -0.105], pieces: cloth(0.15, 0.52, 1.3, 0.5) },
      { name: 'tailR', parent: 'hips', at: [-0.085, -0.02, -0.105], pieces: cloth(0.15, 0.52, 1.3, 0.5) },
      ...arm('L'), ...arm('R'), ...leg('L'), ...leg('R'),
    ];
  }

  // The blade: grip at the origin, edge along +y. It glows for good, which is why whatever it opens glows too.
  function katana() {
    const g = new T.Group();
    g.add(partMesh([
      P(L([[0.021, -0.16], [0.019, 0.13]], { sides: 6, col: 16 }), 0, 0, 0),
      P(L([[0.026, 0], [0.026, 0.024]], { sides: 6, col: 18 }), 0, -0.175, 0),
      P(L([[0.062, 0], [0.062, 0.016]], { sides: 8, col: 18, sz: 0.8 }), 0, 0.13, 0),
      P(B(0.02, 0.05, 0.046, { col: 18 }), 0, 0.146, 0),
      glowing(P(B(0.014, 1.02, 0.044, { col: 15, taper: 0.5, taperZ: 0.5 }), 0, 0.146, 0), 1.25, GEO.BLADE),
    ]));
    return g;
  }

  // Things standing on the plaza that exist to be cut. c: which light they carry (a colour of the palette).
  const props = {
    pillar(h, c) { // a concrete column with two bands of light
      const o = (col) => ({ col, inner: 5, glow: 0.75, sides: 6 }), out = [L([[0.5, 0], [0.5, 0.22]], o(4))];
      let y = 0.2;
      const drums = Math.max(2, Math.round(h / 0.9));
      for (let i = 0; i < drums; i++) { const dh = h / drums; out.push(P(L([[0.37, 0], [0.36, dh + 0.02]], o(4)), 0, y, 0, 0, i * 0.5, 0)); y += dh; }
      out.push(P(L([[0.36, 0], [0.5, 0.12], [0.5, 0.26]], o(4)), 0, y, 0));
      out.push(neon(P(L([[0.39, 0], [0.39, 0.07]], { col: c, inner: 5, glow: 0.75, sides: 6 }), 0, 0.5, 0), 1), neon(P(L([[0.385, 0], [0.385, 0.07]], { col: c, inner: 5, glow: 0.75, sides: 6 }), 0, y - 0.35, 0), 1));
      return out;
    },
    drum(s, c) { // a steel drum with a hazard band and a lit cap
      const o = (col) => ({ sides: 9, col, inner: 10, glow: 0.85 });
      return [
        P(L([[0.3, 0], [0.34, 0.08], [0.34, 0.76], [0.3, 0.84]], o(8)), 0, 0, 0, 0, 0, 0, s),
        P(L([[0.347, 0], [0.347, 0.12]], o(9)), 0, 0.36 * s, 0, 0, 0, 0, s),
        neon(P(L([[0.16, 0], [0.16, 0.03]], o(c)), 0, 0.835 * s, 0, 0, 0, 0, s), 0.9),
      ];
    },
    tube(h, lean, turn, c) { // a standing tube of light on a dark foot
      const out = [L([[0.09, 0], [0.07, 0.12]], { sides: 5, col: 16, inner: 7, glow: 0.6 })], n = Math.max(2, Math.round(h / 0.8));
      for (let i = 0; i < n; i++) out.push(neon(P(L([[0.045, 0], [0.045, h / n + 0.015]], { sides: 5, col: c, inner: 7, glow: 0.6 }), 0, 0.1 + (h / n) * i, 0), 0.75));
      return out.map((p) => P(p, 0, 0, 0, lean, turn, 0));
    },
    board(w, h, c, turn) { // a sign: a lit panel on a post
      const o = { col: 16, inner: 5, glow: 0.7, sides: 5 };
      return [
        L([[0.16, 0], [0.12, 0.14]], o), P(L([[0.07, 0], [0.065, 2.0]], o), 0, 0.1, 0),
        P(B(w + 0.14, h + 0.14, 0.09, { col: 16, inner: 5, glow: 0.7 }), 0, 2.0, 0),
        neon(P(B(w, h, 0.12, { col: c, inner: 5, glow: 0.7 }), 0, 2.07, 0), 0.8),
      ].map((p) => P(p, 0, 0, 0, 0, turn, 0));
    },
    crate(s) { // a cargo box with a lit corner
      return [
        B(s, s, s, { col: 8, inner: 10, glow: 0.8 }),
        P(B(s * 1.02, s * 0.14, s * 1.02, { col: 9, inner: 10, glow: 0.8 }), 0, s * 0.43, 0),
      ];
    },
  };

  return { makeRig, rebuild, dispose, synth, hero, katana, props };
})();

// The place: a rain-wet plaza in a night city. The ground is a mirror under a skin of asphalt with holes in it for puddles, so every
// neon sign, every blade and every spark is seen twice. Around it stand blocks with signs, and behind them a painted skyline.
function buildWorld(scene, opt) {
  const KEY = new T.Vector3(-0.42, 0.74, -0.52).normalize();
  const HAZE = lin(0x1c1236);
  scene.fog = new T.Fog(HAZE, 34, 175);
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const NEON = ['#ff2bd6', '#3df2ff', '#ffe14d', '#ff2d55', '#5dff8f', '#b46cff'];

  const sky = new T.Mesh(new T.SphereGeometry(700, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uMoon: { value: new T.Vector3(0.5, 0.42, -0.76).normalize() }, uTop: { value: lin(0x05061a) }, uMid: { value: lin(0x241452) }, uLow: { value: lin(0x7a1f8c) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uMoon, uTop, uMid, uLow; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.2, h));
        c = mix(c, uTop, smoothstep(0.1, 0.7, h));
        float m = max(dot(d, uMoon), 0.0);
        c += vec3(0.5, 0.7, 1.0) * (pow(m, 30.0) * 0.35) + vec3(0.9, 0.95, 1.0) * smoothstep(0.9965, 0.9972, m) * 2.4;
        vec2 g = floor(d.xz / max(d.y, 0.05) * 60.0);
        c += vec3(0.7, 0.8, 1.0) * step(0.997, hash(g)) * smoothstep(0.15, 0.5, h) * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // the far skyline: one long painting of towers with lit windows and signs, wrapped round the horizon
  const sk = document.createElement('canvas');
  sk.width = 2048; sk.height = 512;
  const g2 = sk.getContext('2d');
  g2.clearRect(0, 0, 2048, 512);
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    while (x < 2048) {
      const w = 26 + rnd() * 70, h = (layer ? 90 : 170) + rnd() * (layer ? 190 : 300), y = 512 - h;
      g2.fillStyle = layer ? '#0c0d1c' : '#15122e';
      g2.fillRect(x, y, w, h);
      const tone = rnd(), lit = tone < 0.5 ? '#ffc46b' : tone < 0.8 ? '#7fe9ff' : '#ff8ae6';
      for (let wy = y + 6; wy < 506; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) if (rnd() < (layer ? 0.3 : 0.16)) { g2.globalAlpha = 0.35 + rnd() * 0.65; g2.fillStyle = lit; g2.fillRect(wx, wy, 3, 3.5); }
      g2.globalAlpha = 1;
      if (rnd() < 0.45) { g2.fillStyle = NEON[Math.floor(rnd() * NEON.length)]; const sw = 5 + rnd() * 9, sh = 24 + rnd() * 80; g2.fillRect(x + 3 + rnd() * (w - sw - 6), y + 10 + rnd() * 30, sw, sh); }
      if (rnd() < 0.3) { g2.fillStyle = '#ff2d55'; g2.fillRect(x + w / 2 - 1, y - 14, 2, 14); g2.fillRect(x + w / 2 - 2, y - 17, 4, 3); }
      x += w + (rnd() < 0.25 ? 6 + rnd() * 18 : 1);
    }
  }
  const hz = g2.createLinearGradient(0, 300, 0, 512);
  hz.addColorStop(0, 'rgba(60,24,96,0)'); hz.addColorStop(1, 'rgba(96,34,128,0.85)');
  g2.fillStyle = hz; g2.fillRect(0, 300, 2048, 212);
  const skyTex = new T.CanvasTexture(sk);
  skyTex.wrapS = T.RepeatWrapping; skyTex.repeat.set(2, 1); skyTex.encoding = T.sRGBEncoding;
  const skyline = new T.Mesh(new T.CylinderGeometry(260, 260, 130, 64, 1, true), new T.MeshBasicMaterial({ map: skyTex, transparent: true, side: T.BackSide, fog: false, depthWrite: false }));
  skyline.position.y = 62; skyline.renderOrder = -9;
  scene.add(skyline);

  // the nearer blocks: dark towers with signs that really glow, close enough to lie in the puddles
  const near = [];
  const lit = (piece, heat) => { for (const f of piece.faces) { f.cap = GEO.NEON; f.heat = heat; } return piece; };
  for (let i = 0; i < 18; i++) {
    // each block is turned to face the plaza: its width lies across the view, its depth along it
    const a = (i / 18) * Math.PI * 2 + rnd() * 0.15, r = 58 + rnd() * 26, w = 9 + rnd() * 9, d = 9 + rnd() * 9, h = 16 + rnd() * 46, x = Math.cos(a) * r, z = Math.sin(a) * r, turn = -a + Math.PI / 2;
    near.push(GEO.place(GEO.box(w, h, d, { col: 27 }), x, -0.5, z, 0, turn, 0));
    const signs = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < signs; k++) { // tall sign boards on the face that looks at the plaza
      const sw = 1 + rnd() * 1.6, sh = 5 + rnd() * 12, sx = (rnd() - 0.5) * (w - sw - 1), sy = 3 + rnd() * Math.max(1, h - sh - 6), col = [24, 23, 21, 3, 28][Math.floor(rnd() * 5)];
      near.push(GEO.place(lit(GEO.box(sw, sh, 0.5, { col }), 0.75), x - Math.cos(a) * (d / 2 + 0.3) - Math.sin(a) * sx, sy, z - Math.sin(a) * (d / 2 + 0.3) + Math.cos(a) * sx, 0, turn, 0));
    }
    for (let k = 0; k < 3; k++) near.push(GEO.place(lit(GEO.box(w * 0.86, 0.35, 0.4, { col: k % 2 ? 26 : 23 }), 0.35), x - Math.cos(a) * (d / 2 + 0.25), h * (0.25 + k * 0.25), z - Math.sin(a) * (d / 2 + 0.25), 0, turn, 0));
  }
  scene.add(new T.Mesh(partGeometry(near), PART_MAT));

  // asphalt, drawn once: dark, grainy, with seams between slabs; and where the puddles are
  const make = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
  const asphalt = make(512, (g) => {
    g.fillStyle = '#2b2e3c'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(150,160,190,0.07)' : 'rgba(0,0,0,0.12)'; const s = 1 + rnd() * 2; g.fillRect(rnd() * 512, rnd() * 512, s, s); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
    g.strokeStyle = 'rgba(120,130,160,0.10)'; g.lineWidth = 1;
    for (let i = 0; i < 30; i++) { g.beginPath(); let x = rnd() * 512, y = rnd() * 512, a = rnd() * 6.28; g.moveTo(x, y); for (let k = 0; k < 5; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * 20; y += Math.sin(a) * 20; g.lineTo(x, y); } g.stroke(); }
  });
  asphalt.repeat.set(55, 55); asphalt.encoding = T.sRGBEncoding;
  const puddles = make(512, (g) => { // green is how much asphalt covers the mirror: little in a puddle, most elsewhere
    g.fillStyle = 'rgb(0,214,0)'; g.fillRect(0, 0, 512, 512);
    g.filter = 'blur(9px)';
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgb(0,' + Math.round(70 + rnd() * 60) + ',0)'; g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 16 + rnd() * 54, 10 + rnd() * 30, rnd() * 3.14, 0, 6.29); g.fill(); }
  });
  puddles.repeat.set(9, 9);
  const mirrorOn = !!(opt && opt.mirror) && !!T.Reflector;
  let mirror = null;
  if (mirrorOn) {
    mirror = new T.Reflector(new T.CircleGeometry(150, 48), { clipBias: 0.003, textureWidth: 1024, textureHeight: 576, color: lin(0x5a5f86) });
    mirror.rotation.x = -Math.PI / 2;
    scene.add(mirror);
  }
  const groundMat = new T.MeshLambertMaterial({ map: asphalt, alphaMap: mirrorOn ? puddles : null, transparent: mirrorOn });
  const ground = new T.Mesh(new T.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.006; ground.receiveShadow = true;
  scene.add(ground);

  // lines of light painted on the plaza: the edge of the ring, and two faint circles inside it
  const paint = (mesh, r, gr, b) => { mesh.material = new T.MeshBasicMaterial({ color: new T.Color(r, gr, b), fog: true }); mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.02; scene.add(mesh); return mesh; };
  paint(new T.Mesh(new T.RingGeometry(38.0, 38.3, 128)), 1.5, 0.16, 1.2);
  paint(new T.Mesh(new T.RingGeometry(12.0, 12.05, 96)), 0.05, 0.3, 0.38);
  paint(new T.Mesh(new T.RingGeometry(24.0, 24.05, 128)), 0.05, 0.26, 0.34);

  scene.add(new T.HemisphereLight(lin(0x6f86ee), lin(0x7a2a80), 0.85));
  const sun = new T.DirectionalLight(lin(0xc4d6ff), 2.3); // the moon and the glow of the city, cool and from above
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 130;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const rim = new T.DirectionalLight(lin(0xff3ad0), 1.0); // a magenta rim from behind, so figures stand off the dark
  rim.position.set(30, 14, 40);
  scene.add(rim);
  const pools = [[-9, -6, 0xff2bd6], [11, 7, 0x3df2ff], [3, -15, 0xffe14d], [-14, 12, 0x3df2ff], [17, -10, 0xff2bd6]];
  for (const [x, z, hex] of pools) { const l = new T.PointLight(lin(hex), 2.6, 19, 1.5); l.position.set(x, 3.4, z); scene.add(l); }

  // rain: short streaks falling through a box that travels with the eye
  const N = opt && opt.light ? 260 : 620, rp = new Float32Array(N * 6), drops = [];
  for (let i = 0; i < N; i++) drops.push([(rnd() - 0.5) * 60, rnd() * 22, (rnd() - 0.5) * 60, 17 + rnd() * 9]);
  const rg = new T.BufferGeometry();
  rg.setAttribute('position', new T.BufferAttribute(rp, 3));
  const rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: new T.Color(0.5, 0.62, 0.95), transparent: true, opacity: 0.3, depthWrite: false }));
  rain.frustumCulled = false;
  scene.add(rain);

  const lamp = new T.PointLight(lin(0xdfe6ff), 1.5, 11, 1.4); // a pool of light that goes where the wanderer goes, so the fight is never in the dark
  scene.add(lamp);

  return {
    KEY, sun, mirror,
    follow(x, z) { // the shadow box travels with the wanderer, in whole texels so shadows do not swim
      const step = 44 / 2048 * 8, fx = Math.round(x / step) * step, fz = Math.round(z / step) * step;
      sun.target.position.set(fx, 0, fz); sun.position.set(fx + KEY.x * 60, KEY.y * 60, fz + KEY.z * 60);
      sky.position.set(x, 0, z); skyline.position.x = x * 0.6; skyline.position.z = z * 0.6; lamp.position.set(x, 4.2, z + 1.5);
    },
    step(dt, x, z) {
      for (let i = 0; i < N; i++) {
        const d = drops[i];
        d[1] -= d[3] * dt; d[0] += 1.6 * dt;
        if (d[1] < 0) { d[1] += 22; d[0] = (rnd() - 0.5) * 60; d[2] = (rnd() - 0.5) * 60; }
        const o = i * 6, px = x + d[0], pz = z + d[2];
        rp[o] = px; rp[o + 1] = d[1]; rp[o + 2] = pz; rp[o + 3] = px - 0.06; rp[o + 4] = d[1] + 0.55; rp[o + 5] = pz;
      }
      rg.attributes.position.needsUpdate = true;
    },
    setMirror(on) { // without the mirror the street is simply dry asphalt: far cheaper to draw
      if (!mirror) return;
      mirror.visible = on; groundMat.alphaMap = on ? puddles : null; groundMat.transparent = on; groundMat.needsUpdate = true;
    },
  };
}

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

// The game itself: the loop, the swipe that becomes a cut, the idols, the waves, the camera and the HUD.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('gl'), ink = $('ink'), stage = $('stage');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { $('fail').hidden = false; return; }
  const TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches, CALM_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (TOUCH) document.body.classList.add('touch');
  const PR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2);
  renderer.setPixelRatio(PR);
  renderer.outputEncoding = T.LinearEncoding; // the last pass tone-maps and encodes
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 16 / 9, 0.3, 1600);
  const W = buildWorld(scene, { mirror: !TOUCH, light: TOUCH });
  if (TOUCH) W.sun.shadow.mapSize.set(1024, 1024);
  const hdr = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const rt = new T.WebGLRenderTarget(4, 4, hdr ? { type: T.HalfFloatType, samples: 4 } : {});
  const composer = new T.EffectComposer(renderer, rt);
  composer.setPixelRatio(PR);
  composer.addPass(new T.RenderPass(scene, camera));
  const bloom = new T.UnrealBloomPass(new T.Vector2(4, 4), 0.7, 0.6, 0.95);
  composer.addPass(bloom);
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, exposure: { value: 1.12 }, hurt: { value: 0 }, calm: { value: 0 }, flash: { value: 0 }, ab: { value: 0.002 }, uT: { value: 0 }, fire: { value: 0 }, tint: { value: new T.Color(1, 0.5, 0.2) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, hurt, calm, flash, ab, uT, fire; uniform vec3 tint; varying vec2 vUv;
      float grain(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uT * 37.0) * 43758.5453); }
      vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){
        c = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777) * (c * exposure / 0.6);
        c = fit(c);
        return clamp(mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602) * c, 0.0, 1.0);
      }
      void main(){
        vec2 q = vUv - 0.5;
        vec2 off = q * ab * (0.5 + dot(q, q) * 3.0); // colours pull apart toward the edges, and harder on a blow
        vec3 raw = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        vec3 c = aces(raw * (1.0 - 0.2 * calm));
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        c = mix(vec3(lum), c, 1.12) + vec3(0.0, 0.006, 0.022) * (1.0 - lum); // a little more colour, and blue in the dark
        float edge = smoothstep(0.3, 0.95, length(q * vec2(1.0, 0.9)) * 1.25);
        float grey = dot(c, vec3(0.3, 0.55, 0.15));
        c = mix(c, mix(vec3(grey), c, 0.78) * vec3(0.93, 0.98, 1.1), calm * 0.8);   // slowed time: colder, quieter
        c *= 1.0 - (0.42 + 0.3 * calm) * edge;
        c += tint * fire * edge * edge * 0.11;                                        // a blade that burns high lights the edges of everything
        c = mix(c, vec3(0.75, 0.04, 0.03), hurt * edge * 0.85);
        c = mix(c, vec3(dot(c, vec3(0.34, 0.5, 0.16))) * 1.5 + tint * 0.3 + 0.06, flash * 0.42);   // the instant a technique lands: one frame bleached by the fire
        c = pow(max(c, 0.0), vec3(1.0 / 2.2));
        c += (grain(vUv * 900.0) - 0.5) * 0.028;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);

  const SPARKS = makeDots(scene, 1100, true), DUST = makeDots(scene, 260, false), TRAILS = makeTrails(scene, 14), STREAKS = makeStreaks(scene, 110), GHOSTS = makeGhosts(scene);
  const SWEEP = makeSweep(scene, 96), FIRES = makeFires(scene, TOUCH ? 160 : 320), FLARES = makeFlares(scene, 3), SCORCH = makeScorch(scene, 56);

  // ---- the look of the blade: what it leaves in the air and on whatever it opens
  const STYLES = [
    { id: 'ember', name: 'Жар', text: 'Клинок в рыжем огне, срезы горят и тлеют', css: '#ff8a3c', hotA: [1.0, 0.45, 0.1], hotB: [1.0, 0.1, 0.01], trailA: [2.0, 0.7, 0.14], trailB: [0.8, 0.14, 0.02], spark: [2.2, 0.8, 0.12], ghost: [1.0, 0.4, 0.1], flame: 1 },
    { id: 'violet', name: 'Лиловое пламя', text: 'Клинок горит, срезы долго полыхают фиолетовым', css: '#b46cff', hotA: [0.8, 0.4, 1.0], hotB: [0.42, 0.06, 1.0], trailA: [1.25, 0.4, 2.6], trailB: [0.5, 0.06, 1.5], spark: [1.0, 0.3, 2.3], ghost: [0.55, 0.2, 1.0], flame: 1 },
    { id: 'frost', name: 'Иней', text: 'Холодное голубое пламя, срезы искрят', css: '#7fd8ff', hotA: [0.7, 0.95, 1.0], hotB: [0.08, 0.4, 1.0], trailA: [1.1, 2.0, 2.6], trailB: [0.1, 0.5, 1.4], spark: [1.2, 2.0, 2.6], ghost: [0.3, 0.7, 1.0], flame: 0.7 },
    { id: 'blood', name: 'Алая луна', text: 'Тёмно-красный огонь, тяжёлый след', css: '#ff3b4a', hotA: [1.0, 0.16, 0.12], hotB: [0.7, 0.0, 0.06], trailA: [2.6, 0.3, 0.3], trailB: [1.0, 0.02, 0.08], spark: [2.6, 0.35, 0.3], ghost: [1.0, 0.1, 0.12], flame: 0.9 },
  ];
  const reticle = new T.Mesh(new T.RingGeometry(0.36, 0.43, 44), new T.MeshBasicMaterial({ color: new T.Color(1, 1, 1), transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  reticle.rotation.x = -Math.PI / 2; reticle.renderOrder = 3; reticle.visible = false;
  scene.add(reticle);
  let style = STYLES[0];
  function setStyle(id) {
    style = STYLES.find((s) => s.id === id) || STYLES[0];
    SHARED.uHotA.value.fromArray(style.hotA); SHARED.uHotB.value.fromArray(style.hotB);
    document.documentElement.style.setProperty('--style', style.css);
    reticle.material.color.setRGB(style.trailA[0] * 0.7, style.trailA[1] * 0.7, style.trailA[2] * 0.7);
    for (const u of [bladeFire.u, FIRES.u, SWEEP.u, SCORCH.u]) { u.uColA.value.fromArray(style.trailA); u.uColB.value.fromArray(style.trailB); }
    grade.uniforms.tint.value.set(style.css).convertSRGBToLinear();
    const m = Math.max(style.trailA[0], style.trailA[1], style.trailA[2]); bladeLight.color.setRGB(style.trailA[0] / m, style.trailA[1] / m, style.trailA[2] / m);
  }
  // a crescent in the colours of the blade
  function crescent(p, f, s, a0, a1, r0, r1, T0, o) {
    return TRAILS.add(Object.assign({ p: [p.x, p.y, p.z], f: [f.x, f.y, f.z], s: [s.x, s.y, s.z], a0, a1, r0, r1, T: T0, hold: 0, fade: 0.22, colA: style.trailA, colB: style.trailB, flame: style.flame, gain: 1 }, o || {}));
  }
  // a tongue of flame: a spark that rises instead of falling
  function flame(x, y, z) {
    const c = style.trailB, k = 0.8 + rnd() * 0.7;
    SPARKS.add(x, Math.max(0.05, y), z, (rnd() - 0.5) * 0.7, 1.1 + rnd() * 1.6, (rnd() - 0.5) * 0.7, c[0] * k, c[1] * k, c[2] * k, 1, 0.045 + rnd() * 0.07, 0.35 + rnd() * 0.5, 1.2, -3);
  }
  // ---- fire. Everything the blade does is answered with it: flames that stand where a cut landed, ride on what was cut, race along the ground.
  const FIRE_ROOM = TOUCH ? 110 : 230; // above this many flames alight at once, the small ones are not lit
  // one flame, `size` metres tall, rooted at (x, y, z)
  function fire(x, y, z, size, life, o) {
    return FIRES.add(Object.assign({ x, y: Math.max(0.02, y), z, w: size * (0.55 + rnd() * 0.25), h: size * (0.85 + rnd() * 0.35), life: life * (0.8 + rnd() * 0.4), gain: 1 }, o || {}));
  }
  // flames standing in a circle on the ground; wait: seconds before they come up
  function fireRing(x, z, r, n, size, life, wait) {
    const g0 = rnd() * 6.28;
    for (let i = 0; i < n; i++) { const g = g0 + i / n * 6.283 + (rnd() - 0.5) * 0.3, rr = r * (0.9 + rnd() * 0.2); fire(x + Math.cos(g) * rr, 0.03, z + Math.sin(g) * rr, size, life, { delay: (wait || 0) + rnd() * 0.05, keep: true }); }
  }
  // flames coming up one after another along a line on the ground, from the first end to the second over `run` seconds
  function fireLine(x0, z0, x1, z1, n, size, life, run, wide) {
    for (let i = 0; i < n; i++) { const k = (i + rnd() * 0.6) / n, sd = (rnd() - 0.5) * (wide || 0.5); const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1; fire(lerp(x0, x1, k) - dz / l * sd, 0.03, lerp(z0, z1, k) + dx / l * sd, size, life, { delay: k * (run || 0), keep: true }); }
  }
  // fire thrown out from a point in every direction, with light and a mark on the ground
  function blaze(x, y, z, n, size, power) {
    for (let i = 0; i < n; i++) {
      const g = rnd() * 6.28, up = 0.2 + rnd() * 0.9, sp = 2 + rnd() * 4.5, cx = Math.cos(g), cz = Math.sin(g), l = Math.hypot(1, up);
      fire(x + cx * 0.2, y, z + cz * 0.2, size * (0.7 + rnd() * 0.6), 0.34, { vx: cx * sp, vy: up * sp * 0.5, vz: cz * sp, ux: cx / l * 0.75, uy: Math.max(0.5, up / l), uz: cz / l * 0.75, gain: 1.15 });
    }
    if (power) { FLARES.add(x, y + 0.5, z, style.trailA, power, 0.5, 13); SCORCH.add(x, z, size * 1.5, size * 1.5, 4.5, 1); }
  }
  // something loose catches fire and carries it
  function ignite(b, life) {
    const live = FIRES.count();
    if (!style.flame || b.radius < 0.07 || live > FIRE_ROOM || (live > FIRE_ROOM * 0.6 && rnd() < 0.5)) return;
    const r = clamp(b.radius, 0.14, 0.95);
    let top = 0;
    if (b.anchored) for (let i = 1; i < b.hull.length; i += 3) top = Math.max(top, b.hull[i]); // what still stands burns along its cut top
    FIRES.add({ on: b, x: b.x, y: b.y, z: b.z, oy: b.anchored ? top - 0.05 : -r * 0.35, w: r * 1.5, h: r * 1.9 + 0.3, life, gain: 0.95 });
  }

  // ---- state
  const LEAP_MAX = 9, STANDOFF = 1.35, ARENA = 38, TOP = 3.0, MAX_PARTS = TOUCH ? 150 : 240, HARD_PARTS = TOUCH ? 260 : 420; // TOP: how high the blade reaches
  const CUT = { minPiece: 2.5e-4, minHalf: 2e-5, tol: 0.012 };
  const S = { mode: 'title', time: 0, real: 0, scale: 1, stop: 0, slowT: 0, focusOn: false, focusK: 0, focusHeld: false, focusLock: false, shake: 0, wave: 0, queue: [], spawnT: 0, next: 0, kills: 0, parts: 0, best: 0, paused: false, hurtK: 0, xp: 0, level: 1, need: 8, pending: 0, choosing: false, choice: null, autoPick: false, arsenal: false, flash: 0, demoQ: null, dummyAt: 0, kick: 0, shx: 1, shz: 0, ult: 0, zoom: 1, sheet: 'title', playT: 0, heat: 0 };
  const P = { x: 0, z: 0, yaw: 0, hp: 100, maxHp: 100, focus: 1, speed: 0, phase: 0, dash: 0, dashCd: 0, dx: 0, dz: 1, invul: 0, kx: 0, kz: 0, lunge: null, sw: null, nextSlash: 0, queue: null, flip: 0, dead: false, rig: null, vx: 0, vz: 0, y: 0, heat: 0, yawS: 0, snap: true, heatAt: 0, fireK: 0, auraAt: 0, over: 0, ultId: 'over', up: {}, cd: {}, slots: [], act: null, stance: 0, front: 1, combo: 0, comboAt: 0, reach: 2.9, dashLen: 5.6, drain: 0.24, run: 6.3, dashGap: 0.6, leech: 0, slowKill: 0.3 };
  const bodies = [], enemies = [], solids = [];
  const keys = {};
  let vw = 1, vh = 1, seed = 20261119, pr = PR;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k, ease = (k) => k * k * (3 - 2 * k);
  try { S.best = +localStorage.getItem('blade-clay-best') || 0; } catch (e) { S.best = 0; }

  // ---- bodies
  function addBody(world, o) {
    const b = PHYS.make(world, o);
    b.mesh = partMesh(b.pieces);
    b.mesh.position.set(b.x, b.y, b.z);
    scene.add(b.mesh);
    bodies.push(b);
    return b;
  }
  function removeBody(b) {
    const i = bodies.indexOf(b);
    if (i >= 0) bodies.splice(i, 1);
    scene.remove(b.mesh); b.mesh.geometry.dispose(); b.dead = true;
    if (b.solid && b.solid.body === b) b.solid.body = null;
  }
  function clearWorld() {
    for (const b of bodies.slice()) removeBody(b);
    for (const e of enemies) if (!e.dead) { scene.remove(e.rig.root); MODELS.dispose(e.rig); }
    enemies.length = 0; solids.length = 0; FIRES.clear(); SCORCH.clear();
    for (let i = bolts.length - 1; i >= 0; i--) dropBolt(i, false);
  }
  function prop(pieces, x, z, r) {
    const world = pieces.map((p) => GEO.shifted(p, x, 0, z));
    const b = addBody(world, { anchored: true, time: 0, kind: 'prop' });
    if (r) { b.solid = { x, z, r, body: b }; solids.push(b.solid); }
    return b;
  }
  function buildProps() {
    seed = 77;
    const lights = [23, 24, 21, 3, 28];
    for (let i = 0; i < 9; i++) { const a = i * 0.698 + 0.3, r = 8.5 + (i % 3) * 5.5; prop(MODELS.props.pillar(2.4 + rnd() * 1.4, lights[i % 2]), Math.cos(a) * r, Math.sin(a) * r, 0.56); }
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + 0.9, r = 6 + (i % 2) * 9, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      for (let k = 0; k < 3; k++) {
        const s = 0.75 + rnd() * 0.45, x = cx + (rnd() - 0.5) * 2.4, z = cz + (rnd() - 0.5) * 2.4;
        if (k === 2) prop(MODELS.props.crate(0.7 + rnd() * 0.4), x, z, 0.5); else prop(MODELS.props.drum(s, lights[(i + k) % 5]), x, z, 0.36 * s);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785 + 0.15, r = 11 + (i % 4) * 4.5, cx = Math.cos(a) * r, cz = Math.sin(a) * r, c = lights[i % 5];
      for (let k = 0; k < 6; k++) prop(MODELS.props.tube(2.0 + rnd() * 2.2, (rnd() - 0.5) * 0.12, rnd() * 6.28, c), cx + (rnd() - 0.5) * 1.7, cz + (rnd() - 0.5) * 1.7, 0);
    }
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.4, r = 15 + (i % 3) * 5; prop(MODELS.props.board(1.6 + rnd() * 1.2, 0.9 + rnd() * 0.6, lights[(i * 2) % 5], a + 1.57), Math.cos(a) * r, Math.sin(a) * r, 0.2); }
  }

  // ---- the wanderer
  const katana = MODELS.katana();
  scene.add(katana);
  // the blade is on fire: sheets of flame along it, embers climbing off it, and a light of its own that everything near it catches
  const bladeFire = makeBladeFire(), bladeLight = new T.PointLight(new T.Color(1, 0.5, 0.2), 2, 8, 1.5), bladeAxis = new T.Vector3();
  katana.add(bladeFire.mesh);
  scene.add(bladeLight);
  const lastTip = new T.Vector3(), tip = new T.Vector3();
  function burnBlade(dt) {
    P.fireK = Math.max(0, (P.fireK || 0) - dt * 3.2);
    const on = katana.visible, k = P.fireK + (P.over ? 0.6 : 0), len = katana.scale.y;
    const lit = 0.8 + 1.0 * P.heat; // how high the fire on it burns
    const whirl = P.act && P.act.id === 'spin' ? Math.min(1, P.act.t / 0.12) : 0, far = 1 + 1.75 * whirl; // in the whirl the fire runs out well past the steel
    bladeFire.u.uTime.value = S.real; bladeFire.u.uGain.value = Math.min(2.4, (1.0 + 0.8 * k) * (0.75 + 0.5 * P.heat)) * (1 - 0.7 * whirl);
    bladeFire.mesh.scale.set(1 + 0.5 * P.heat + 0.3 * Math.min(1, k), far, 1 + 0.5 * P.heat + 0.3 * Math.min(1, k));
    bladeAxis.set(0, 1, 0).applyQuaternion(katana.quaternion);
    bladeLight.visible = on;
    bladeLight.position.copy(katana.position).addScaledVector(bladeAxis, 0.65 * len); bladeLight.position.y = Math.max(0.35, bladeLight.position.y);
    bladeLight.intensity = (1.25 + 0.4 * Math.sin(S.real * 23) + 0.35 * Math.sin(S.real * 57)) * (1 + 0.9 * Math.min(1.6, k)) * (0.8 + 0.6 * P.heat);
    bladeLight.distance = 8 + 4 * P.heat + 3 * whirl;
    if (!on) { SFX.blade(0); SWEEP.gap(); lastTip.set(0, -99, 0); return; }
    SFX.blade(S.paused || S.mode === 'dead' ? 0.03 : 0.08 + 0.24 * Math.min(1, k) + 0.03 * Math.min(1, P.speed / 6) + 0.1 * P.heat);
    // the sheet of fire the blade leaves where it has just been: bright when the blade is fast, barely there when it is only carried
    const reach = 1.02 * len * far;
    tip.copy(katana.position).addScaledVector(bladeAxis, 0.15 * len + reach);
    const jump = lastTip.y < -50 ? 99 : tip.distanceTo(lastTip), fast = dt > 0 ? jump / dt : 0;
    if (jump > 3.4 + 2 * far) SWEEP.gap();
    SWEEP.add(katana.position.x + bladeAxis.x * 0.15 * len, katana.position.y + bladeAxis.y * 0.15 * len, katana.position.z + bladeAxis.z * 0.15 * len, bladeAxis.x, bladeAxis.y, bladeAxis.z, reach, S.real, (clamp((fast - 3) / 15, 0, 1) * (0.75 + 0.5 * P.heat) + (P.over ? 0.15 : 0)) * (1 - 0.5 * whirl));
    lastTip.copy(tip);
    const c = style.trailB, hot = style.trailA;
    const rate = dt * (40 + 170 * k) * lit;
    for (let n = Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0); n > 0; n--) { // sparks that leave the blade and climb
      const at = (0.15 + rnd() * 1.05) * len * far, w = rnd() < 0.3 ? hot : c, j = 0.7 + rnd() * 0.6;
      SPARKS.add(katana.position.x + bladeAxis.x * at + (rnd() - 0.5) * 0.08, katana.position.y + bladeAxis.y * at, katana.position.z + bladeAxis.z * at + (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.7, 0.9 + rnd() * 1.5, (rnd() - 0.5) * 0.7, w[0] * j, w[1] * j, w[2] * j, 1, 0.09 + rnd() * 0.11, 0.2 + rnd() * 0.3, 2, -4.5);
    }
    const lick = dt * (10 + 26 * P.heat + 30 * Math.min(1, k) + 40 * whirl);
    for (let n = Math.floor(lick) + (rnd() < lick % 1 ? 1 : 0); n > 0; n--) { // and whole tongues of flame that tear off it
      const at = (0.2 + rnd() * 1.0) * len * far;
      fire(katana.position.x + bladeAxis.x * at, katana.position.y + bladeAxis.y * at - 0.05, katana.position.z + bladeAxis.z * at, 0.24 + 0.3 * P.heat + rnd() * 0.2 + 0.3 * whirl, 0.3, { vx: (rnd() - 0.5) * 0.8, vy: 1.2 + rnd(), vz: (rnd() - 0.5) * 0.8, gain: 0.9 });
    }
  }
  // the wanderer himself burns a little: the ends of his scarf are alight, and when the blade is hot he leaves embers where he runs
  function burnHero(dt) {
    if (P.dead || !P.rig || !P.rig.root.visible || S.mode === 'dead') return;
    const b = P.rig.bones, hot = P.heat + (P.over ? 0.6 : 0);
    const r = dt * (9 + 16 * hot);
    for (const [bone, len] of [[b.scarf2, 0.4], [b.band2, 0.3]]) {
      if (rnd() >= r) continue;
      v1.set(0, -len, 0).applyMatrix4(bone.matrixWorld);
      fire(v1.x, v1.y - 0.04, v1.z, 0.2 + 0.2 * Math.min(1, hot) + rnd() * 0.12, 0.32, { vy: 0.9, gain: 0.85 });
    }
    if (hot > 0.45 && P.speed > 3 && !P.y && S.real >= (P.stepAt || 0)) { // footprints of fire
      P.stepAt = S.real + 0.13;
      SCORCH.add(P.x + (rnd() - 0.5) * 0.3, P.z + (rnd() - 0.5) * 0.3, 0.34, 0.26, 1.5, 0.75 * Math.min(1, hot));
      if (rnd() < 0.6) fire(P.x + (rnd() - 0.5) * 0.3, 0.03, P.z + (rnd() - 0.5) * 0.3, 0.3 + 0.3 * rnd(), 0.4, { gain: 0.8 });
    }
    if (P.over && rnd() < dt * 26) { const g = rnd() * 6.28, rr = 0.3 + rnd() * 0.5; fire(P.x + Math.cos(g) * rr, P.y + 0.03, P.z + Math.sin(g) * rr, 0.6 + rnd() * 0.8, 0.45, { vy: 1.5, gain: 0.9 }); }
  }
  function newHero() {
    if (P.rig) { scene.remove(P.rig.root); MODELS.dispose(P.rig); }
    P.rig = MODELS.makeRig(MODELS.hero());
    scene.add(P.rig.root);
    Object.assign(P, { x: 0, z: 0, yaw: Math.PI, hp: P.maxHp, focus: 1, speed: 0, dash: 0, dashCd: 0, invul: 0, kx: 0, kz: 0, lunge: null, sw: null, queue: null, dead: false, act: null, stance: 0, vx: 0, vz: 0, y: 0, heat: 0, yawS: Math.PI, snap: true });
    P.rig.root.scale.setScalar(1.1);
    katana.visible = true;
  }
  // ---- what the blade learns: each level offers three of these
  const UPS = [
    { id: 'long', name: 'Длинный клинок', text: 'Клинок достаёт на 18% дальше', max: 4 },
    { id: 'twin', name: 'Двойной срез', text: 'Рядом с каждым разрезом проходит ещё один', max: 2 },
    { id: 'whirl', name: 'Рывок-срез', text: 'Рывок режет всех, мимо кого пронёсся', max: 1 },
    { id: 'calm', name: 'Долгий вдох', text: 'Фокус тратится на треть медленнее', max: 3 },
    { id: 'bone', name: 'Крепкая кость', text: '+30 к жизни и полное лечение', max: 4 },
    { id: 'wind', name: 'Лёгкие ноги', text: 'Бег быстрее на 12%, рывок чаще', max: 3 },
    { id: 'thirst', name: 'Жар клинка', text: 'Каждый сражённый лечит на 3', max: 3 },
    { id: 'leap', name: 'Дальний рывок', text: 'Рывок на 30% дальше', max: 2 },
    { id: 'chain', name: 'Застывший миг', text: 'Каждый сражённый на миг замедляет время', max: 2 },
  ];
  function applyUps() {
    const u = P.up;
    const ov = P.over ? 1 : 0; // overloaded
    P.reach = 2.9 * (1 + 0.18 * u.long) * (1 + 0.7 * ov); P.dashLen = 5.6 * (1 + 0.3 * u.leap) * (1 + 0.25 * ov); P.drain = 0.24 * Math.pow(0.67, u.calm);
    P.maxHp = 100 + 30 * u.bone; P.run = 6.3 * (1 + 0.12 * u.wind) * (1 + 0.2 * ov); P.dashGap = 0.6 * Math.pow(0.75, u.wind); P.leech = 3 * u.thirst; P.slowKill = 0.22 * u.chain;
    katana.scale.set(1 + 0.8 * ov, (1 + 0.18 * u.long) * (1 + 0.7 * ov), 1 + 0.8 * ov);
  }
  function resetUps() { P.up = {}; for (const u of UPS) P.up[u.id] = 0; applyUps(); }
  function gainXp(n) { S.xp += n; while (S.xp >= S.need) { S.xp -= S.need; S.level++; S.need = 8 + (S.level - 1) * 5; S.pending++; } }
  function openChoice() {
    const pool = UPS.filter((u) => P.up[u.id] < u.max);
    if (!pool.length) { S.pending = 0; return; }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    S.choice = pool.slice(0, 3); S.choosing = true;
    if (S.autoPick) { choose(0); return; }
    const box = $('cards');
    box.textContent = '';
    S.choice.forEach((u, i) => {
      const b = document.createElement('button'), k = document.createElement('span'), nm = document.createElement('b'), tx = document.createElement('span'), lv = document.createElement('i');
      b.type = 'button'; b.className = 'card'; b.id = 'card' + (i + 1);
      k.className = 'num for-keys'; k.textContent = String(i + 1);
      nm.textContent = u.name; tx.textContent = u.text;
      lv.textContent = P.up[u.id] ? 'уже ' + P.up[u.id] + ' из ' + u.max : 'новое';
      b.append(k, nm, tx, lv);
      b.addEventListener('click', () => choose(i));
      box.append(b);
    });
    $('levelNum').textContent = S.level - S.pending + 1;
    $('levelup').hidden = false;
    swipe = null; stick = null; showStick();
    for (const k in keys) keys[k] = false;
    S.focusHeld = false;
    SFX.gong();
  }
  function choose(i) {
    if (!S.choosing || !S.choice || !S.choice[i]) return;
    const u = S.choice[i];
    P.up[u.id]++; applyUps();
    if (u.id === 'bone') P.hp = P.maxHp;
    S.pending--; S.choosing = false; S.choice = null;
    $('levelup').hidden = true;
    hudKey = '';
  }

  const DOWN = new T.Vector3(0, -1, 0), UP = new T.Vector3(0, 1, 0);
  const v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), q1 = new T.Quaternion(), m1 = new T.Matrix4();
  function aim(bone, target) { // turn a limb so that it points at a place in the world
    bone.parent.updateWorldMatrix(true, false);
    m1.copy(bone.parent.matrixWorld).invert();
    v1.copy(target).applyMatrix4(m1).sub(bone.position).normalize();
    bone.quaternion.setFromUnitVectors(DOWN, v1);
  }
  const hilt = new T.Vector3(), bladeDir = new T.Vector3();
  // The body does not jump from one pose to the next: every frame it goes most of the way there. The arms are aimed afterwards, at the body
  // as it has settled. The cloth is hung here too: the scarf leads, and its second length, the other tail and the tails of the coat follow it.
  const SOFT = ['hips', 'chest', 'head', 'thighL', 'shinL', 'thighR', 'shinR', 'scarf'];
  let poseDt = 0.016;
  function settle(b) {
    const k = P.snap ? 1 : 1 - Math.exp(-poseDt * 26);
    for (const nm of SOFT) { const bone = b[nm]; if (!bone.sm) bone.sm = bone.quaternion.clone(); bone.sm.slerp(bone.quaternion, k); bone.quaternion.copy(bone.sm); }
    b.hips.sy = b.hips.sy == null || P.snap ? b.hips.position.y : lerp(b.hips.sy, b.hips.position.y, k); b.hips.position.y = b.hips.sy;
    P.snap = false;
    const fly = b.scarf.rotation.x, t = S.real, flow = clamp(P.speed / 6, 0, 1) + (P.act ? 0.6 : 0);
    b.scarf.rotation.z = Math.sin(t * 5.1) * 0.08 * (0.4 + flow);
    b.scarf2.rotation.set(fly * 0.25 + Math.sin(t * 8.3 + 1.1) * (0.1 + 0.2 * flow), 0, Math.sin(t * 6.7) * 0.12 * (0.3 + flow));
    b.band.rotation.set(fly * 0.84 + Math.sin(t * 7.1 + 2.3) * 0.12, 0, -0.1 + Math.sin(t * 4.3 + 1) * 0.08 * (0.4 + flow));
    b.band2.rotation.set(fly * 0.3 + Math.sin(t * 9.4 + 0.4) * (0.1 + 0.2 * flow), 0, 0);
    b.tailL.rotation.set(fly * 0.66 + Math.sin(t * 6.3) * 0.07 * (0.3 + flow), 0, -0.05 - fly * 0.12);
    b.tailR.rotation.set(fly * 0.6 + Math.sin(t * 6.9 + 1.7) * 0.07 * (0.3 + flow), 0, 0.05 + fly * 0.12);
    P.rig.root.updateMatrixWorld(true);
  }
  function carry(b, run, dt) { // carried low and behind while running, low and ahead while standing
    b.armR.rotation.set(0.35 * run - 0.15, 0, -0.18); b.foreR.rotation.set(-0.55 + 0.25 * run, 0, 0);
    settle(b);
    hilt.set(0, -0.3, 0).applyMatrix4(b.foreR.matrixWorld);
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), k = lerp(0.85, -0.9, run);
    bladeDir.set(fx * k - fz * 0.28, -0.42 + 0.2 * run, fz * k + fx * 0.28).normalize();
    q1.setFromUnitVectors(UP, bladeDir);
    const kk = 1 - Math.exp(-dt * 22);
    katana.position.lerp(hilt, Math.max(kk, 0.6));
    katana.quaternion.slerp(q1, kk);
  }
  // after a cut too fast to see: down on one knee, the blade sliding home into the scabbard at the left hip. k: 0 still out .. 1 home
  function poseSheath(b, k) {
    b.hips.position.y = b.hips.rest[1] - 0.3; b.hips.rotation.x = 0.2;
    b.thighL.rotation.x = -1.35; b.shinL.rotation.x = 1.5; b.thighR.rotation.x = 0.25; b.shinR.rotation.x = 1.45;
    b.chest.rotation.set(0.28, -0.35, 0); b.head.rotation.x = 0.25;
    b.scarf.rotation.x = 0.5 + Math.sin(S.real * 7) * 0.12;
    P.rig.root.rotation.y = P.yawS;
    settle(b);
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), out = lerp(0.55, 0.12, ease(k));
    v2.setFromMatrixPosition(b.hips.matrixWorld);
    hilt.set(v2.x + fz * 0.2 + fx * out, v2.y + 0.12, v2.z - fx * 0.2 + fz * out);
    bladeDir.set(-fx * 0.92 + fz * 0.1, -0.22, -fz * 0.92 - fx * 0.1).normalize();
    aim(b.armR, hilt); b.foreR.rotation.set(0, 0, 0);
    v3.copy(hilt).addScaledVector(bladeDir, 0.3); aim(b.armL, v3); b.foreL.rotation.set(0, 0, 0);
    katana.position.copy(hilt); katana.quaternion.setFromUnitVectors(UP, bladeDir);
  }
  // poses that belong to a technique; returns true when it has placed the arms and the blade itself
  function poseAct(b, a) {
    if (a.hidden) { P.rig.root.visible = false; katana.visible = false; return true; }
    P.rig.root.visible = true; katana.visible = true;
    if (a.pose === 'sheath') { poseSheath(b, clamp(a.sheath, 0, 1)); return true; }
    if (a.pose === 'spin') { // the whirl: turning fast with the blade flung out level, low at first, rising as he goes
      const up = Math.sin(Math.PI * Math.min(1, a.t / 0.84));
      P.rig.root.rotation.y = P.yawS + a.spin;
      b.hips.position.y = b.hips.rest[1] - 0.2 + 0.14 * up; b.hips.rotation.x = 0.12;
      b.thighL.rotation.x = -0.9 + 0.5 * up; b.shinL.rotation.x = 1.2 - 0.5 * up; b.thighR.rotation.x = 0.55; b.shinR.rotation.x = 0.5 + 0.8 * up;
      b.chest.rotation.set(0.12, 0.55, 0); b.head.rotation.x = -0.1; b.scarf.rotation.x = 1.4;
      settle(b);
      v2.setFromMatrixPosition(b.chest.matrixWorld); v2.y += 0.27;
      const ang = P.yawS + a.spin + 1.2;
      bladeDir.set(Math.sin(ang), 0.2 * Math.sin(a.spin * 0.5) - 0.02, Math.cos(ang)).normalize(); // the blade dips and lifts as it goes round, so the fire it draws is a coil
      hilt.copy(v2).addScaledVector(bladeDir, 0.5);
      aim(b.armR, hilt); b.foreR.rotation.set(0, 0, 0); aim(b.armL, hilt); b.foreL.rotation.set(0, 0, 0);
      katana.position.copy(hilt); katana.quaternion.setFromUnitVectors(UP, bladeDir);
      return true;
    }
    if (a.pose === 'slam') { // down on one knee, the blade driven into the ground in front of him
      P.rig.root.rotation.y = P.yawS;
      b.hips.position.y = b.hips.rest[1] - 0.33; b.hips.rotation.x = 0.3;
      b.thighL.rotation.x = -1.4; b.shinL.rotation.x = 1.5; b.thighR.rotation.x = 0.2; b.shinR.rotation.x = 1.5;
      b.chest.rotation.set(0.45, 0, 0); b.head.rotation.x = 0.1; b.scarf.rotation.x = 1.0;
      settle(b);
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      v2.setFromMatrixPosition(b.chest.matrixWorld);
      hilt.set(v2.x + fx * 0.44, 1.0, v2.z + fz * 0.44);
      bladeDir.set(fx * 0.14, -1, fz * 0.14).normalize();
      aim(b.armR, hilt); b.foreR.rotation.set(0, 0, 0); aim(b.armL, hilt); b.foreL.rotation.set(0, 0, 0);
      katana.position.copy(hilt); katana.quaternion.setFromUnitVectors(UP, bladeDir);
      return true;
    }
    if (a.pose === 'guard') { // feet set, both hands on the grip, the blade a blur in front of the chest
      b.hips.position.y = b.hips.rest[1] - 0.1; b.chest.rotation.set(0.12, 0, 0);
      settle(b);
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), g = a.t * 42;
      v2.setFromMatrixPosition(b.chest.matrixWorld); v2.y += 0.22;
      hilt.set(v2.x + fx * 0.42, v2.y, v2.z + fz * 0.42);
      bladeDir.set(fz * Math.sin(g), Math.cos(g), -fx * Math.sin(g)).normalize();
      aim(b.armR, hilt); b.foreR.rotation.set(0, 0, 0); aim(b.armL, hilt); b.foreL.rotation.set(0, 0, 0);
      katana.position.copy(hilt); katana.quaternion.setFromUnitVectors(UP, bladeDir);
      return true;
    }
    if (a.pose === 'leap') { // in the air: knees drawn up, the blade raised over the head with both hands
      b.hips.rotation.x = 0.3; b.thighL.rotation.x = -1.3; b.shinL.rotation.x = 1.7; b.thighR.rotation.x = -0.6; b.shinR.rotation.x = 1.5;
      b.chest.rotation.set(-0.25, 0, 0); b.head.rotation.x = 0.2; b.scarf.rotation.x = 1.3;
      settle(b);
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
      v2.setFromMatrixPosition(b.head.matrixWorld);
      hilt.set(v2.x - fx * 0.05, v2.y + 0.42, v2.z - fz * 0.05);
      bladeDir.set(-fx * 0.75, 0.66, -fz * 0.75).normalize();
      aim(b.armR, hilt); b.foreR.rotation.set(0, 0, 0); aim(b.armL, hilt); b.foreL.rotation.set(0, 0, 0);
      katana.position.copy(hilt); katana.quaternion.setFromUnitVectors(UP, bladeDir);
      return true;
    }
    return false;
  }
  function poseHero(dt) {
    const b = P.rig.bones, run = clamp(P.speed / 6, 0, 1), ph = P.phase, s = Math.sin(ph), c = Math.cos(ph), sw = P.sw, act = P.act;
    poseDt = dt;
    let turn = P.yaw - P.yawS; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); P.yawS += turn * (P.snap ? 1 : 1 - Math.exp(-dt * 30)); // he turns fast, but he turns
    P.rig.root.position.set(P.x, P.y, P.z);
    P.rig.root.rotation.y = P.yawS;
    const dash = P.dash > 0 || P.lunge ? 1 : 0;
    b.hips.position.y = b.hips.rest[1] + Math.abs(s) * 0.035 * run - 0.05 * run - dash * 0.12;
    b.hips.rotation.x = 0.16 * run + dash * 0.5;
    b.chest.rotation.set(0.1 * run, s * 0.12 * run, 0);
    b.head.rotation.x = -0.14 * run - dash * 0.35;
    b.thighL.rotation.x = -s * 0.85 * run; b.shinL.rotation.x = Math.max(0, c) * 1.1 * run + 0.06;
    b.thighR.rotation.x = s * 0.85 * run; b.shinR.rotation.x = Math.max(0, -c) * 1.1 * run + 0.06;
    b.armL.rotation.set(s * 0.7 * run, 0, 0.1); b.foreL.rotation.set(-0.3 - 0.5 * run, 0, 0);
    b.scarf.rotation.x = clamp(P.speed * 0.17 + dash * 0.8, 0, 1.35) + Math.sin(S.real * 9) * 0.1 * (0.2 + run);
    // a cut is made from a deep lunge: front knee bent, back leg stretched out, body low and leaning in. It eases back up afterwards.
    if (!act && !(sw && sw.t < sw.T)) P.stance = Math.max(0, P.stance - dt * (run > 0.3 ? 10 : sw ? 1.2 : 3.4));
    const st = ease(clamp(P.stance, 0, 1));
    if (st > 0) {
      const F = P.front >= 0 ? 'L' : 'R', B = F === 'L' ? 'R' : 'L';
      b.hips.position.y -= 0.19 * st; b.hips.rotation.x = lerp(b.hips.rotation.x, 0.34, st);
      b['thigh' + F].rotation.x = lerp(b['thigh' + F].rotation.x, -1.15, st); b['shin' + F].rotation.x = lerp(b['shin' + F].rotation.x, 1.1, st);
      b['thigh' + B].rotation.x = lerp(b['thigh' + B].rotation.x, 0.75, st); b['shin' + B].rotation.x = lerp(b['shin' + B].rotation.x, 0.3, st);
      b.head.rotation.x = lerp(b.head.rotation.x, -0.3, st);
      b.scarf.rotation.x = Math.max(b.scarf.rotation.x, 0.9 * st);
    }
    if (act && poseAct(b, act)) return;
    if (sw) {
      sw.t += dt;
      // the blade runs a little past the end of the cut and settles back
      const k = clamp(sw.t / sw.T, 0, 1), e = 1 - (1 - k) * (1 - k), over = sw.t > sw.T ? Math.sin(Math.min(1, (sw.t - sw.T) / 0.2) * Math.PI) * 0.14 : 0;
      const a = lerp(sw.a0, sw.a1, e) + over * (sw.a1 > sw.a0 ? 1 : -1);
      bladeDir.copy(sw.f).multiplyScalar(Math.cos(a)).addScaledVector(sw.s, Math.sin(a));
      b.chest.rotation.y = lerp(-0.85, 0.85, e) * sw.turn; b.chest.rotation.x = 0.22;
      if (sw.turns) { P.rig.root.rotation.y = P.yawS + sw.turn * e * Math.PI * 2 * sw.turns; if (sw.t < sw.T && rnd() < dt * 34) GHOSTS.add(bake(P.rig), style.ghost, 0.18); } // a blow on the turn takes the whole body round, once or twice
      if (sw.hop) P.rig.root.position.y = P.y + Math.sin(Math.PI * k) * sw.hop; // and off the ground
      settle(b);
      // the grip follows the swing but never leaves the reach of the arms; the crescent shows the true plane of the cut
      v2.setFromMatrixPosition(b.chest.matrixWorld); v2.y += 0.3;
      hilt.copy(sw.pv).addScaledVector(bladeDir, 0.42).sub(v2);
      if (hilt.length() > 0.5) hilt.setLength(0.5);
      hilt.add(v2);
      aim(b.armR, hilt); b.foreR.rotation.set(0, 0, 0);
      aim(b.armL, hilt); b.foreL.rotation.set(0, 0, 0);
      katana.position.copy(hilt);
      katana.quaternion.setFromUnitVectors(UP, bladeDir);
      if (sw.t > sw.T + 0.22) P.sw = null;
    } else carry(b, run, dt);
  }

  // ---- idols
  // grunt: walks up and swings. imp: small and fast, comes in packs. thrower: keeps its distance and lobs fire that can be cut in the air.
  // brute: slow and heavy. colossus: too tall to reach above the hips; its legs go first, then it is finished on the ground.
  const KINDS = {
    grunt: { scale: 1, speed: 2.6, range: 1.55, dmg: 12, wind: 0.5, xp: 2 },
    imp: { scale: 0.56, speed: 4.6, range: 1.0, dmg: 6, wind: 0.3, xp: 1 },
    thrower: { scale: 0.98, speed: 2.3, range: 1.4, dmg: 10, wind: 0.55, xp: 3 },
    brute: { scale: 1.5, speed: 1.75, range: 2.2, dmg: 26, wind: 0.72, xp: 5 },
    colossus: { scale: 3.2, speed: 1.3, range: 3.6, dmg: 34, wind: 1.0, xp: 25 },
  };
  function spawnIdol(kind) {
    if (!KINDS[kind]) kind = 'grunt';
    const K = KINDS[kind], giant = kind === 'colossus', rig = MODELS.makeRig(MODELS.synth(kind)), scale = K.scale * (giant ? 1 : 0.94 + rnd() * 0.12);
    let x = 0, z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const a = rnd() * Math.PI * 2, r = (giant ? 12 : 9) + rnd() * 4.5;
      x = P.x + Math.cos(a) * r; z = P.z + Math.sin(a) * r;
      if (Math.hypot(x, z) < ARENA - 3 && !solids.some((s) => s.body && Math.hypot(s.x - x, s.z - z) < s.r + 1)) break;
    }
    const e = { rig, kind, brute: kind === 'brute', scale, x, z, yaw: Math.atan2(P.x - x, P.z - z), state: 'rise', t: 0, phase: rnd() * 6, walk: 0, atk: 0, hit: 0, struck: false, dead: false, vx: 0, vz: 0, arm: 'R',
      speed: K.speed * (0.94 + rnd() * 0.12), range: K.range, dmg: K.dmg, wind: K.wind, xp: K.xp, rad: 0.42 * scale, riseT: giant ? 1.2 : 0.62, cool: 0.6 + rnd(), ranged: false, down: false, vy: 0, dropTo: 0 };
    rig.root.scale.setScalar(scale);
    rig.root.position.set(x, 15, z);
    rig.root.rotation.y = e.yaw;
    scene.add(rig.root);
    enemies.push(e);
    return e;
  }
  function poseIdol(e) {
    const b = e.rig.bones, w = e.walk, s = Math.sin(e.phase), c = Math.cos(e.phase), A = e.atk, H = e.hit, giant = e.kind === 'colossus';
    b.hips.position.y = b.hips.rest[1] + Math.abs(s) * 0.03 * w;
    let tR = s * 0.5 * w, sR = Math.max(0, -c) * 0.75 * w;
    if (giant && !e.down) { tR = lerp(lerp(tR, -1.15, A), 0.05, H); sR = lerp(lerp(sR, 1.35, A), 0, H); } // the colossus lifts a foot and brings it down
    b.thighL.rotation.x = -s * 0.5 * w; b.shinL.rotation.x = Math.max(0, c) * 0.75 * w;
    b.thighR.rotation.x = tR; b.shinR.rotation.x = sR;
    let aL = s * 0.4 * w, aR = -s * 0.4 * w, fL = -0.25 - 0.15 * w, fR = -0.25 - 0.15 * w, lean = 0.09 * w;
    const both = giant && e.down, arms = !giant || e.down;
    if (both) { aL = aR = -1.25; fL = fR = -0.3; }
    if (arms && (e.arm === 'R' || both)) { aR = lerp(lerp(aR, -2.8, A), -0.6, H); fR = lerp(lerp(fR, -0.95, A), -0.1, H); }
    if (arms && (e.arm === 'L' || both)) { aL = lerp(lerp(aL, -2.8, A), -0.6, H); fL = lerp(lerp(fL, -0.95, A), -0.1, H); }
    if (arms) lean += -0.24 * A * (1 - H) + 0.55 * H * (e.arm ? 1 : 1.4);
    else lean += -0.1 * A * (1 - H);
    if (e.state === 'stagger') lean -= 0.4 * Math.sin(Math.min(1, e.t / 0.6) * Math.PI);
    b.armL.rotation.x = aL; b.armR.rotation.x = aR; b.foreL.rotation.x = fL; b.foreR.rotation.x = fR;
    b.armL.rotation.z = 0.12; b.armR.rotation.z = -0.12;
    b.chest.rotation.set(lean, s * 0.07 * w, Math.sin(S.time * 1.7 + e.phase) * 0.02);
    b.head.rotation.x = -lean * 0.5;
  }
  function refreshArms(e) {
    const has = (n) => e.rig.bones[n].pieces.some((p) => p.tag && p.tag.fist);
    e.arm = has('foreR') ? 'R' : has('foreL') ? 'L' : null;
    if (!e.arm && !e.armless) { e.armless = true; e.range = Math.min(e.range, 1.25 * e.scale); e.dmg = Math.round(e.dmg * 0.6); }
  }
  // a blow on the ground: dust flies out in a ring and the wanderer is hurt if he stands inside it
  function quake(x, z, radius, dmg) {
    SFX.quake(); S.shake = Math.max(S.shake, 0.85);
    for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2 + rnd() * 0.2, k = radius * (2.2 + rnd()); DUST.add(x + Math.cos(a) * 0.6, 0.15, z + Math.sin(a) * 0.6, Math.cos(a) * k, 0.5 + rnd() * 1.2, Math.sin(a) * k, 0.3, 0.34, 0.52, 0.3, 0.7, 0.9, 2.6, -0.2); }
    if (!P.dead && Math.hypot(P.x - x, P.z - z) < radius) hurt(dmg, x, z);
  }
  // the light each kind carries, as it shows in their blades and in what flies off them
  const LIGHTS = { grunt: [2.6, 0.2, 0.4], imp: [2.4, 2.0, 0.3], thrower: [0.3, 2.2, 2.6], brute: [2.6, 1.0, 0.15], colossus: [2.6, 0.3, 2.2] };
  // ---- bolts: what a gunner fires. Straight and fast; a cut through one kills it, and a guard sends it back to whoever fired it
  const bolts = [], boltGeo = new T.BoxGeometry(0.07, 0.07, 0.8);
  function fireBolt(e) {
    const f = fistPos(e), tx = P.x + P.vx * 0.25, tz = P.z + P.vz * 0.25, dx = tx - f.x, dy = 1.05 - f.y, dz = tz - f.z, l = Math.hypot(dx, dy, dz) || 1, sp = 17;
    const mesh = new T.Mesh(boltGeo, new T.MeshBasicMaterial({ color: new T.Color(0.5, 2.6, 3.0), fog: false }));
    scene.add(mesh);
    bolts.push({ x: f.x, y: f.y, z: f.z, vx: dx / l * sp, vy: dy / l * sp, vz: dz / l * sp, t: 0, owner: e, back: false, dmg: e.dmg, mesh });
    SFX.shot();
    for (let i = 0; i < 5; i++) SPARKS.add(f.x, f.y, f.z, dx / l * 4 + (rnd() - 0.5) * 3, (rnd() - 0.5) * 3, dz / l * 4 + (rnd() - 0.5) * 3, 0.4, 2.2, 2.6, 1, 0.04, 0.2, 1, 0);
  }
  function dropBolt(i, pop) {
    const b = bolts[i];
    scene.remove(b.mesh); b.mesh.material.dispose();
    if (pop) for (let k = 0; k < 8; k++) SPARKS.add(b.x, b.y, b.z, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6, 0.4, 2.2, 2.6, 1, 0.04 + rnd() * 0.04, 0.25 + rnd() * 0.3, 1.2, 6);
    bolts.splice(i, 1);
  }
  function turnBolt(b) { // sent back the way it came, faster, and now it is the wanderer's
    const o = b.owner, live = o && !o.dead, tx = live ? o.x : b.x - b.vx, ty = live ? 1.1 * o.scale : b.y, tz = live ? o.z : b.z - b.vz, dx = tx - b.x, dy = ty - b.y, dz = tz - b.z, l = Math.hypot(dx, dy, dz) || 1;
    b.vx = dx / l * 30; b.vy = dy / l * 30; b.vz = dz / l * 30; b.back = true; b.t = 0;
    b.mesh.material.color.setRGB(style.trailA[0] * 1.2, style.trailA[1] * 1.2, style.trailA[2] * 1.2);
  }
  function updateBolts(dt) {
    const guard = P.act && P.act.id === 'guard';
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z); b.mesh.lookAt(b.x + b.vx, b.y + b.vy, b.z + b.vz);
      if (b.t > 3 || b.y < 0.05) { dropBolt(i, b.y < 0.05); continue; }
      if (!b.back) {
        const dx = b.x - P.x, dy = b.y - 1.05, dz = b.z - P.z, d2 = dx * dx + dy * dy + dz * dz;
        if (guard && d2 < 6.8) { turnBolt(b); SFX.parry(); S.shake = Math.max(S.shake, 0.3); for (let k = 0; k < 6; k++) SPARKS.add(b.x, b.y, b.z, (rnd() - 0.5) * 7, (rnd() - 0.5) * 7, (rnd() - 0.5) * 7, style.spark[0], style.spark[1], style.spark[2], 1, 0.05, 0.3, 1.2, 6); continue; }
        if (!P.dead && d2 < 0.36) { hurt(b.dmg, b.x - b.vx, b.z - b.vz); dropBolt(i, true); }
      } else {
        for (const e of enemies) {
          if (e.dead || e.state === 'rise') continue;
          const dx = b.x - e.x, dz = b.z - e.z, r = e.rad + 0.35;
          if (dx * dx + dz * dz < r * r && b.y < 2.2 * e.scale) { // it goes through whoever is in its way
            const l = Math.hypot(b.vx, b.vz) || 1, n = new T.Vector3(-b.vz / l * 0.94, 0.34, b.vx / l * 0.94).normalize(), u = new T.Vector3(b.vx / l, 0, b.vz / l);
            const killed = S.kills, made = cutIdol(e, { n, d: n.x * b.x + n.y * b.y + n.z * b.z, u }, () => true);
            if (made) scored(made, killed);
            dropBolt(i, true); break;
          }
        }
      }
    }
  }
  // what the death of a synth looks like beyond its parts: a ring of light on the ground, the last of its current jumping out, sparks of its own colour
  function killFx(e) {
    const c = LIGHTS[e.kind] || LIGHTS.grunt, y = Math.min(2.4, 1.05 * e.scale);
    TRAILS.add({ p: [e.x, 0.07, e.z], f: [1, 0, 0], s: [0, 0, 1], a0: -Math.PI, a1: Math.PI, r0: 0.25 * e.scale, r1: 1.0 * e.scale, T: 0.02, hold: 0, fade: 0.38, colA: c, colB: [c[0] * 0.3, c[1] * 0.3, c[2] * 0.3], flame: 0, gain: 0.9, grow: 9 });
    for (let i = 0; i < 5; i++) {
      const ax = e.x + (rnd() - 0.5) * 0.7 * e.scale, ay = y + (rnd() - 0.5) * 1.2 * e.scale, az = e.z + (rnd() - 0.5) * 0.7 * e.scale;
      STREAKS.add(ax, ay, az, ax + (rnd() - 0.5) * 1.6, ay + (rnd() - 0.5) * 1.6, az + (rnd() - 0.5) * 1.6, 0.035, 0.16 + rnd() * 0.12, 0.03, c);
    }
    for (let i = 0; i < 14; i++) SPARKS.add(e.x, y, e.z, (rnd() - 0.5) * 9, rnd() * 6, (rnd() - 0.5) * 9, c[0], c[1], c[2], 1, 0.035 + rnd() * 0.04, 0.3 + rnd() * 0.5, 1.4, 12);
    // and the fire of the blade takes what is left: a burst, a patch that goes on burning where it stood, and light over everything near
    const big = e.kind === 'colossus' ? 2.2 : e.kind === 'brute' ? 1.4 : e.kind === 'imp' ? 0.7 : 1;
    blaze(e.x, y * 0.6, e.z, Math.round(7 * big), 0.9 * big, 5.5 * big);
    fire(e.x, 0.03, e.z, 1.9 * big, 0.55, { gain: 1.2, keep: true });
    for (let i = 0; i < Math.round(3 * big); i++) { const g = rnd() * 6.28, r = (0.25 + rnd() * 0.6) * big; fire(e.x + Math.cos(g) * r, 0.03, e.z + Math.sin(g) * r, (0.6 + rnd() * 0.6) * big, 1.5 + rnd(), { delay: rnd() * 0.15, keep: true }); }
    S.kick = 1;
  }
  function updateIdols(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt; e.cool = Math.max(0, e.cool - dt);
      const dx = P.x - e.x, dz = P.z - e.z, dist = Math.hypot(dx, dz) || 1e-3, giant = e.kind === 'colossus';
      let turn = 0, go = 0;
      const want = Math.atan2(dx, dz);
      let da = want - e.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (e.state === 'rise') {
        const k = Math.min(1, e.t / e.riseT);
        if (!e.down) e.rig.root.position.y = 15 * (1 - k * k); // it falls out of the dark above and lands hard
        if (k >= 1 || e.down) {
          e.state = 'chase'; e.t = 0;
          if (!e.down) { e.rig.root.position.y = 0; if (giant) quake(e.x, e.z, 3.4, 20); else { SFX.thud(4 * e.scale); S.shake = Math.max(S.shake, 0.16 * e.scale); for (let i = 0; i < 8; i++) { const g = rnd() * 6.28; DUST.add(e.x + Math.cos(g) * 0.3, 0.1, e.z + Math.sin(g) * 0.3, Math.cos(g) * 3.5, 0.3 + rnd() * 0.5, Math.sin(g) * 3.5, 0.3, 0.34, 0.52, 0.22, 0.4 * e.scale, 0.6, 2.4, -0.2); } } }
        }
      } else if (e.state === 'chase') {
        turn = giant ? (e.down ? 1.3 : 1.8) : 4.2;
        const throws = e.kind === 'thrower' && e.arm && dist > 2.4;
        if (P.dead || e.down || e.dummy) go = 0;
        else if (throws) go = dist > 9.5 ? 1 : dist < 5 ? -0.55 : 0;
        else go = dist > e.range * 0.82 ? 1 : 0;
        if (!P.dead && throws) { if (dist < 12 && e.cool <= 0 && Math.abs(da) < 0.4) { e.state = 'windup'; e.t = 0; e.struck = false; e.ranged = true; SFX.windup(); } }
        else if (!P.dead && dist < e.range && Math.abs(da) < (giant ? 0.7 : 0.5)) { e.state = 'windup'; e.t = 0; e.struck = false; e.ranged = false; SFX.windup(); }
      } else if (e.state === 'windup') {
        turn = giant ? 0.5 : 1.6; e.atk = ease(Math.min(1, e.t / (e.wind * 0.8)));
        if (rnd() < dt * 40) { const f = giant && !e.down ? footPos(e) : fistPos(e); SPARKS.add(f.x, f.y, f.z, (rnd() - 0.5) * 1.5, rnd() * 1.5, (rnd() - 0.5) * 1.5, 2.4, 0.5, 0.12, 1, 0.09 * Math.sqrt(e.scale), 0.3, 1, 0); }
        if (e.t >= e.wind) { e.state = 'strike'; e.t = 0; }
      } else if (e.state === 'strike') {
        e.hit = Math.min(1, e.t / 0.1);
        if (!e.struck && e.t >= 0.08) {
          e.struck = true;
          if (e.ranged) fireBolt(e);
          else if (giant) { const f = e.down ? fistPos(e) : footPos(e); quake(f.x, f.z, e.down ? 2.6 : 3.4, e.down ? 24 : e.dmg); }
          else {
            const f = fistPos(e), c = LIGHTS[e.kind] || LIGHTS.grunt;
            TRAILS.add({ p: [e.x, 1.25 * e.scale, e.z], f: [0, 1, 0], s: [Math.sin(e.yaw), 0, Math.cos(e.yaw)], a0: -0.5, a1: 2.3, r0: 0.5 * e.scale, r1: e.range + 0.55, T: 0.09, hold: 0, fade: 0.2, colA: c, colB: [c[0] * 0.3, c[1] * 0.3, c[2] * 0.3], flame: 0, gain: 0.9 });
            SFX.slam(); S.shake = Math.max(S.shake, e.brute ? 0.5 : 0.22);
            for (let i = 0; i < 9; i++) DUST.add(f.x, 0.1, f.z, (rnd() - 0.5) * 4, rnd() * 1.6, (rnd() - 0.5) * 4, 0.3, 0.34, 0.52, 0.26, 0.42, 0.8, 2.2, -0.2);
            if (dist < e.range + 0.45 && Math.abs(da) < 1.0) hurt(e.dmg, e.x, e.z);
          }
        }
        if (e.t >= 0.24) { e.state = 'recover'; e.t = 0; if (e.ranged) e.cool = 1.1 + rnd() * 0.7; }
      } else if (e.state === 'recover') {
        const k = Math.min(1, e.t / (giant ? 1.0 : 0.55));
        e.atk = 1 - ease(k); e.hit = 1 - ease(k);
        if (k >= 1) { e.state = 'chase'; e.t = 0; e.atk = 0; e.hit = 0; }
      } else if (e.state === 'stagger') {
        e.atk *= Math.exp(-dt * 8); e.hit *= Math.exp(-dt * 8);
        if (e.t >= (giant ? 1.3 : 0.6)) { e.state = 'chase'; e.t = 0; }
      }
      if (e.down && e.rig.root.position.y > e.dropTo) { // legs gone: the rest comes down
        e.vy -= 26 * dt;
        e.rig.root.position.y = Math.max(e.dropTo, e.rig.root.position.y + e.vy * dt);
        if (e.rig.root.position.y <= e.dropTo) { quake(e.x, e.z, 3.2, 18); e.state = 'stagger'; e.t = 0; }
      }
      e.yaw += clamp(da, -turn * dt, turn * dt);
      const sp = go * e.speed;
      e.vx = Math.sin(e.yaw) * sp; e.vz = Math.cos(e.yaw) * sp;
      e.x += e.vx * dt; e.z += e.vz * dt;
      e.walk = lerp(e.walk, go ? 1 : 0, 1 - Math.exp(-dt * 8));
      e.phase += dt * e.speed * 3.1 * (0.25 + e.walk) / e.scale * (go < 0 ? -1 : 1);
      for (const o of enemies) { // keep apart
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oz = e.z - o.z, d = Math.hypot(ox, oz), min = e.rad + o.rad + 0.25;
        if (d < min && d > 1e-4) { const k = (min - d) * (e.scale > o.scale * 1.5 ? 0.05 : o.scale > e.scale * 1.5 ? 0.95 : 0.5) / d; e.x += ox * k; e.z += oz * k; }
      }
      pushOut(e, Math.min(e.rad, 0.7));
      const er = Math.hypot(e.x, e.z);
      if (er > ARENA + 2) { e.x *= (ARENA + 2) / er; e.z *= (ARENA + 2) / er; }
      if (e.state !== 'rise') { const ox = e.x - P.x, oz = e.z - P.z, d = Math.hypot(ox, oz), min = Math.min(e.rad, 1.0) + 0.38; if (d < min && d > 1e-4) { e.x += ox / d * (min - d); e.z += oz / d * (min - d); } }
      e.rig.root.position.x = e.x; e.rig.root.position.z = e.z; e.rig.root.rotation.y = e.yaw;
      poseIdol(e);
    }
  }
  function footPos(e) {
    const bone = e.rig.bones.shinR;
    bone.updateWorldMatrix(true, false);
    fistV.set(0, -0.36, 0.05).applyMatrix4(bone.matrixWorld);
    fistV.y = Math.max(0.1, fistV.y);
    return fistV;
  }
  const fistV = new T.Vector3();
  function fistPos(e) {
    const bone = e.rig.bones[e.arm === 'L' ? 'foreL' : e.arm === 'R' ? 'foreR' : 'head'];
    bone.updateWorldMatrix(true, false);
    return fistV.set(0, e.arm ? -0.45 : 0.3, 0).applyMatrix4(bone.matrixWorld);
  }
  function pushOut(o, rad) {
    for (const s of solids) {
      if (!s.body) continue;
      const dx = o.x - s.x, dz = o.z - s.z, d = Math.hypot(dx, dz), min = rad + s.r;
      if (d < min && d > 1e-4) { o.x += dx / d * (min - d); o.z += dz / d * (min - d); }
    }
  }

  // ---- the cut
  function bake(rig) {
    rig.root.updateMatrixWorld(true);
    const out = [];
    for (const b of rig.list) for (const p of b.pieces) { const w = GEO.xf(p, b.matrixWorld.elements); if (w) { w.bone = b; w.src = p; out.push(w); } }
    return out;
  }
  function burst(x, y, z, job, n) {
    for (let i = 0; i < n; i++) {
      const k = 1.5 + rnd() * 5.5, side = (rnd() - 0.5) * 3;
      SPARKS.add(x, y, z, job.u.x * k + job.n.x * side + (rnd() - 0.5) * 1.5, job.u.y * k + job.n.y * side + rnd() * 2.5, job.u.z * k + job.n.z * side + (rnd() - 0.5) * 1.5, style.spark[0], style.spark[1] * (0.8 + rnd() * 0.5), style.spark[2], 1, 0.03 + rnd() * 0.04, 0.3 + rnd() * 0.5, 1.2, 11);
    }
  }
  function capSparks(pieces, job, m) {
    let n = 0;
    for (const p of pieces) {
      if (!p.from || n > 7) continue;
      n++;
      let x = p.c[0], y = p.c[1], z = p.c[2];
      const f = p.faces[p.faces.length - 1]; // the new face is the last one
      if (f && f.cap === S.time) { x = y = z = 0; const c = f.p.length / 3; for (let i = 0; i < f.p.length; i += 3) { x += f.p[i] / c; y += f.p[i + 1] / c; z += f.p[i + 2] / c; } }
      if (m) { const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14]; x = X; y = Y; z = Z; }
      burst(x, y, z, job, 3);
      if (n <= 5 && style.flame) fire(x, y - 0.12, z, 0.5 + rnd() * 0.4, 0.3, { vx: job.u.x * 2.5, vy: 0.8 + job.u.y * 2, vz: job.u.z * 2.5, gain: 1.1 });
    }
  }
  // a loose part gets the speed of what it came from, a shove off the blade and, if it is the upper part, a ride down the cut
  function loosen(world, job, velAt, spin, wasAnchored, solid) {
    let low = Infinity;
    for (const p of world) for (let i = 1; i < p.pts.length; i += 3) low = Math.min(low, p.pts[i]);
    const anchored = wasAnchored && low < 0.05 && Math.abs(job.n.y) >= 0.45;
    if (!anchored) for (const p of world) for (const f of p.faces) if (f.cap >= GEO.NEON) f.cap = S.time; // a light cut off from its power dies down
    const b = addBody(world, { anchored, time: S.time });
    if (style.flame) { b.burn = S.time + 1.5 + rnd() * 1.8; ignite(b, 1.3 + rnd() * 1.5); }
    if (anchored) { if (solid && !solid.body) { b.solid = solid; solid.body = b; } return b; }
    const n = job.n, ua = job.uAt ? job.uAt(b.x, b.z) : null, u = ua ? v3.set(ua[0], ua[1], ua[2]) : job.u, s = n.x * b.x + n.y * b.y + n.z * b.z - job.d >= 0 ? 1 : -1, upper = s * (n.y >= 0 ? 1 : -1) > 0;
    const v = velAt(b.x, b.y, b.z), drag = (upper ? 1.7 : 0.6) * (0.6 + rnd() * 0.9);
    b.vx = v[0] + n.x * s * 0.55 + u.x * drag; b.vy = v[1] + n.y * s * 0.55 + u.y * drag + (upper ? 0.9 : 0.15); b.vz = v[2] + n.z * s * 0.55 + u.z * drag;
    const flat = Math.abs(n.y), k = s * (1 - flat) * 1.1;
    b.wx = spin[0] + -n.z * k + (rnd() - 0.5) * 0.9; b.wy = spin[1] + (rnd() - 0.5) * 0.9; b.wz = spin[2] + n.x * k + (rnd() - 0.5) * 0.9;
    if (upper && flat > 0.25) {
      const sg = n.y >= 0 ? 1 : -1, nx = n.x * sg, ny = n.y * sg, nz = n.z * sg, d = job.d * sg;
      let clear = true;
      for (let i = 0; i < b.hull.length; i += 3) if (nx * (b.x + b.hull[i]) + ny * (b.y + b.hull[i + 1]) + nz * (b.z + b.hull[i + 2]) - d < -0.01) { clear = false; break; }
      if (clear) b.slide = { nx, ny, nz, d, x0: b.x, z0: b.z, until: S.time + 1.1, clear: Math.min(b.radius, 0.9) * 0.9 + 0.2 };
    }
    return b;
  }
  function cutIdol(e, job, want) {
    const world = bake(e.rig), n = job.n;
    const res = GEO.cutSet(world, n.x, n.y, n.z, job.d, S.time, (p) => want(p.c[0], p.c[1], p.c[2], p.r), CUT);
    if (!res) return 0;
    const pieces = res.pieces, groupOf = new Array(pieces.length);
    res.groups.forEach((g, gi) => { for (const i of g) groupOf[i] = gi; });
    let home = -1, alive = true;
    for (let i = 0; i < pieces.length; i++) if (pieces[i].tag && pieces[i].tag.chest && !pieces[i].from) home = groupOf[i];
    if (home < 0) alive = false;
    else for (let i = 0; i < pieces.length; i++) { const p = pieces[i]; if (p.tag && p.tag.core && (p.from || groupOf[i] !== home)) { alive = false; break; } }
    const vel = () => [e.vx, 0, e.vz], spin = [0, 0, 0];
    capSparks(pieces, job, null);
    let made = 0;
    if (alive) {
      const keep = new Map();
      for (const b of e.rig.list) keep.set(b, []);
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (groupOf[i] !== home) continue;
        if (p.from) { const bone = p.from.bone, back = GEO.xf(p, m1.copy(bone.matrixWorld).invert().elements); if (back) keep.get(bone).push(back); }
        else keep.get(p.bone).push(p.src);
      }
      let legsHit = false;
      for (const b of e.rig.list) { const list = keep.get(b); if (list.length !== b.pieces.length || list.some((p, i) => p !== b.pieces[i])) { b.pieces = list; MODELS.rebuild(b); if (LEGS.indexOf(b.name) >= 0) legsHit = true; } }
      res.groups.forEach((g, gi) => { if (gi !== home) { loosen(g.map((i) => pieces[i]), job, vel, spin, false, null); made++; } });
      refreshArms(e);
      e.state = 'stagger'; e.t = 0;
      if (e.kind === 'colossus' && !e.down && legsHit) made += bringDown(e);
    } else {
      for (const p of pieces) for (const f of p.faces) if (f.cap >= GEO.PERM) f.cap = S.time; // the fire in the eyes goes out
      for (const g of res.groups) { loosen(g.map((i) => pieces[i]), job, vel, spin, false, null); made++; }
      e.dead = true;
      scene.remove(e.rig.root); MODELS.dispose(e.rig);
      S.kills++; P.focus = Math.min(1, P.focus + 0.14);
      S.slowT = Math.max(S.slowT, e.kind === 'colossus' ? 1.1 : P.slowKill);
      if (S.mode === 'play' && !S.queue.length && !enemies.some((o) => !o.dead)) S.slowT = Math.max(S.slowT, 0.55); // the last one of a wave falls slowly
      killFx(e);
      if (!P.dead) P.hp = Math.min(P.maxHp, P.hp + P.leech);
      gainXp(e.xp);
      if (!P.over) S.ult = Math.min(1, S.ult + e.xp * 0.03);
      if (e.kind === 'colossus') { banner('Колосс повержен'); S.shake = 0.9; }
    }
    return made;
  }
  const LEGS = ['hips', 'thighL', 'shinL', 'thighR', 'shinR'];
  // the colossus loses its footing: what is left of the legs falls away and the rest comes down to where the blade can reach it
  function bringDown(e) {
    const b = e.rig.bones;
    e.rig.root.updateMatrixWorld(true);
    let made = 0;
    for (const set of [['thighL', 'shinL'], ['thighR', 'shinR'], ['hips']]) {
      const world = [];
      for (const nm of set) { for (const p of b[nm].pieces) { const w = GEO.xf(p, b[nm].matrixWorld.elements); if (w) world.push(w); } b[nm].pieces = []; MODELS.rebuild(b[nm]); }
      if (world.length) { addBody(world, { time: S.time, v: [(rnd() - 0.5) * 1.5, 0.4, (rnd() - 0.5) * 1.5], w: [(rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2] }); made++; }
    }
    let low = Infinity; // it comes to rest on its belly, not on its hanging fists
    for (const p of b.chest.pieces) { const w = GEO.xf(p, b.chest.matrixWorld.elements); if (w) for (let i = 1; i < w.pts.length; i += 3) low = Math.min(low, w.pts[i]); }
    e.down = true; e.vy = 0; e.dropTo = e.rig.root.position.y - (isFinite(low) ? low : 0);
    e.range = 4.3; e.speed = 0; e.wind = 0.85;
    banner('Колосс упал');
    return made;
  }
  function cutBody(b, job, want) {
    const R = b.R, n = job.n;
    if (b.kind === 'part' && bodies.length > HARD_PARTS) return 0; // enough rubble: more would only choke the frame
    if (b.kind === 'shot') { for (const p of b.pieces) for (const f of p.faces) if (f.cap >= GEO.PERM) f.cap = S.time; P.focus = Math.min(1, P.focus + 0.05); } // cut in the air, the fire in it dies
    const lx = R[0] * n.x + R[3] * n.y + R[6] * n.z, ly = R[1] * n.x + R[4] * n.y + R[7] * n.z, lz = R[2] * n.x + R[5] * n.y + R[8] * n.z, ld = job.d - (n.x * b.x + n.y * b.y + n.z * b.z);
    const res = GEO.cutSet(b.pieces, lx, ly, lz, ld, S.time, (p) => want(b.x + R[0] * p.c[0] + R[1] * p.c[1] + R[2] * p.c[2], b.y + R[3] * p.c[0] + R[4] * p.c[1] + R[5] * p.c[2], b.z + R[6] * p.c[0] + R[7] * p.c[1] + R[8] * p.c[2], p.r), CUT);
    if (!res) return 0;
    const m = PHYS.matrixOf(b);
    capSparks(res.pieces, job, m);
    if (res.groups.length === 1) { // cut into, but still holding together: it keeps the glowing scar
      for (const p of res.pieces) delete p.from;
      b.pieces = res.pieces; b.mesh.geometry.dispose(); b.mesh.geometry = partGeometry(b.pieces);
      if (style.flame) { b.burn = S.time + 2; ignite(b, 1.6); }
      return 1;
    }
    const spin = [b.wx, b.wy, b.wz], solid = b.solid || null, anchored = b.anchored;
    removeBody(b);
    let made = 0;
    for (const g of res.groups) {
      const world = [];
      for (const i of g) { const w = GEO.xf(res.pieces[i], m); if (w) world.push(w); }
      if (world.length) { loosen(world, job, (x, y, z) => (anchored ? [0, 0, 0] : PHYS.velAt(b, x, y, z)), anchored ? [0, 0, 0] : spin, anchored, solid); made++; }
    }
    return made;
  }
  const d0 = new T.Vector3(), d1 = new T.Vector3(), dm = new T.Vector3(), pj = new T.Vector3();
  function dirAt(px, py, out) { out.set(px / vw * 2 - 1, -(py / vh * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize(); }
  // A swipe on the screen becomes a plane through the eye, so the cut lands exactly on the line that was drawn.
  // the plane of a cut from a line on the screen; kind: 0 a plain cut, 1 a cut on the turn, 2 two turns in the air, 3 a blow straight down
  function jobFor(ax, ay, bx, by, kind) {
    camera.updateMatrixWorld();
    dirAt(ax, ay, d0); dirAt(bx, by, d1);
    const n = new T.Vector3().crossVectors(d0, d1);
    if (n.lengthSq() < 1e-9) return null;
    n.normalize();
    const C = camera.position;
    dm.copy(d0).add(d1).normalize();
    const tm = clamp(dm.y < -0.02 ? (1.05 - C.y) / dm.y : 16, 2, 45), M = C.clone().addScaledVector(dm, tm);
    const u = d1.clone().sub(d0); u.addScaledVector(n, -u.dot(n)).normalize();
    return { kind: kind === true ? 1 : kind | 0, n, d: n.dot(C), u, M, ax, ay, bx, by, len: Math.hypot(bx - ax, by - ay), vp: new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), focal: vh / (2 * Math.tan(camera.fov * Math.PI / 360)) };
  }
  // to: [x, z] on the ground, the place he goes to before he cuts; left out, he cuts from where he stands
  function slash(ax, ay, bx, by, kind, to) {
    if ((S.mode !== 'play' && !S.arsenal) || P.dead || S.paused || P.act) return false;
    if (S.real < P.nextSlash || P.lunge) { P.queue = [ax, ay, bx, by, S.real, kind, to]; return false; }
    const job = jobFor(ax, ay, bx, by, kind);
    if (!job) return false;
    P.queue = null;
    P.nextSlash = S.real + (P.over ? 0.05 : S.focusOn ? 0.06 : 0.12) + (job.kind === 2 ? 0.2 : 0);
    const M = job.M, dx = M.x - P.x, dz = M.z - P.z, dist = Math.hypot(dx, dz);
    if (dist > 0.05) P.yaw = Math.atan2(dx, dz);
    let gx = 0, gz = 0, go = 0;
    if (to) { // no farther than a good leap, and never out of the arena
      gx = to[0] - P.x; gz = to[1] - P.z; go = Math.hypot(gx, gz);
      const lim = Math.min(go, LEAP_MAX), r = Math.hypot(P.x + gx / (go || 1) * lim, P.z + gz / (go || 1) * lim);
      go = r > ARENA ? Math.max(0, lim - (r - ARENA)) : lim;
    }
    if (go > 0.45) {
      const ux = gx / Math.hypot(gx, gz), uz = gz / Math.hypot(gx, gz), x1 = P.x + ux * go, z1 = P.z + uz * go;
      P.lunge = { x0: P.x, z0: P.z, x1, z1, t: 0, T: 0.05 + go * 0.011, job };
      P.yaw = Math.atan2(ux, uz); P.invul = Math.max(P.invul, P.lunge.T + 0.1);
      SFX.dash(); ghostAt(P.x, P.z, P.yaw, 0.25);
      if (go > 1.2) { fireLine(P.x, P.z, x1, z1, Math.ceil(go * 1.6), 0.5, 0.32, P.lunge.T, 0.2); SCORCH.add((P.x + x1) / 2, (P.z + z1) / 2, go / 2, 0.22, 1.8, 0.7, ux, uz); }
    } else strike(job);
    INK.push({ ax, ay, bx, by, t: 0 });
    return true;
  }
  function strike(job) {
    { const dx = job.M.x - P.x, dz = job.M.z - P.z; if (dx * dx + dz * dz > 0.01) P.yaw = Math.atan2(dx, dz); } // he faces the cut from wherever he now stands
    const n = job.n, px = P.x, py = 1.22, pz = P.z, off = n.x * px + n.y * py + n.z * pz - job.d;
    const pv = new T.Vector3(px - n.x * off, py - n.y * off, pz - n.z * off);
    const f = job.M.clone().sub(pv); f.addScaledVector(n, -f.dot(n));
    if (f.lengthSq() < 0.04) { f.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)); f.addScaledVector(n, -f.dot(n)); }
    f.normalize();
    const s = job.u.clone(); s.addScaledVector(f, -s.dot(f));
    if (s.lengthSq() < 1e-4) s.crossVectors(n, f);
    s.normalize();
    // which way the body turns with the swing: +1 when the blade goes to the wanderer's left
    const turn = (s.x * Math.cos(P.yaw) - s.z * Math.sin(P.yaw)) >= 0 ? 1 : -1;
    // the third blow of a quick combo is a full turn with a wider, longer cut
    // overloaded, every blow is at least a turn and he leaves the ground for it
    const kind = job.kind, heavy = kind > 0, over = !!P.over, turns = kind === 2 ? 2 : kind === 1 ? 1 : over ? 1 : 0;
    const A = turns ? Math.PI : kind === 3 ? 1.9 : 1.5, T0 = kind === 2 ? 0.3 : heavy ? 0.18 : 0.11, R = P.reach * (heavy ? 1.2 : 1);
    P.sw = { t: 0, T: T0, pv, f, s, a0: -A, a1: A, turn, heavy, turns, hop: kind === 2 ? 1.25 : over && turns ? 0.45 : 0 };
    P.stance = 1; P.front = turn; P.fireK = heavy ? 1.6 : 1;
    crescent(pv, f, s, -A * turn, A * turn, 0.45, R * 1.06, T0, heavy ? { gain: 1.5, fade: 0.36 } : { gain: 1.15, fade: 0.28 });
    for (let i = 0; i < (heavy ? 26 : 14); i++) { // fire torn off the blade all along the arc
      const g = lerp(-A, A, rnd()), c = Math.cos(g), sn = Math.sin(g), r = 0.9 + rnd() * (R - 0.9), w = rnd() < 0.35 ? style.trailA : style.trailB, j = 0.7 + rnd() * 0.6;
      SPARKS.add(pv.x + (f.x * c + s.x * sn) * r, Math.max(0.1, pv.y + (f.y * c + s.y * sn) * r), pv.z + (f.z * c + s.z * sn) * r, (-f.x * sn + s.x * c) * (2 + rnd() * 4), 0.6 + rnd() * 1.6 + (-f.y * sn + s.y * c) * 2, (-f.z * sn + s.z * c) * (2 + rnd() * 4), w[0] * j, w[1] * j, w[2] * j, 1, 0.1 + rnd() * 0.13, 0.25 + rnd() * 0.35, 2.2, -3.5);
    }
    for (let i = 0, m = heavy ? 9 : 5; i < m; i++) { // and whole flames standing on it for a moment, leaning the way the blade went
      const g = lerp(-A, A, (i + rnd()) / m) * turn, c = Math.cos(g), sn = Math.sin(g), r = R * (0.5 + rnd() * 0.5), tx = (-f.x * sn + s.x * c) * turn, ty = (-f.y * sn + s.y * c) * turn, tz = (-f.z * sn + s.z * c) * turn, l = Math.hypot(tx, ty + 0.9, tz) || 1;
      fire(pv.x + (f.x * c + s.x * sn) * r, Math.max(0.05, pv.y + (f.y * c + s.y * sn) * r - 0.25), pv.z + (f.z * c + s.z * sn) * r, (heavy ? 0.85 : 0.6) * (0.8 + 0.5 * P.heat), 0.3, { vx: tx * 3, vy: 0.6, vz: tz * 3, ux: tx / l, uy: (ty + 0.9) / l, uz: tz / l, delay: (i / m) * T0 * 0.8, gain: 1.05 });
    }
    FLARES.add(pv.x + f.x * 1.5, 1.3, pv.z + f.z * 1.5, style.trailA, heavy ? 4.5 : 2.6, 0.3, 10);
    if (heavy) { ghostAt(P.x, P.z, P.yaw + 2.1, 0.22); ghostAt(P.x, P.z, P.yaw + 4.2, 0.3); }
    if (kind === 2) fireRing(P.x, P.z, 1.5, 9, 0.9, 0.5, 0.1);
    SFX.swing(heavy);
    for (let k = 1; k <= Math.max(P.up.twin, P.over ? 2 : 0); k++) { const side = k === 1 ? 0.26 : -0.26; crescent({ x: pv.x + n.x * side, y: pv.y + n.y * side, z: pv.z + n.z * side }, f, s, -A, A, 0.45, R * 1.06, T0 + 0.02 + k * 0.03, { gain: 0.8 }); }
    if (kind === 2) crescent({ x: pv.x, y: pv.y + 0.55, z: pv.z }, f, s, A, -A, 0.5, R * 1.0, T0, { gain: 1.2, fade: 0.36 }); // the second turn, higher and the other way round
    if (kind === 3) { // straight down: the ground takes it too
      const gx = P.x + Math.sin(P.yaw) * 1.4, gz = P.z + Math.cos(P.yaw) * 1.4;
      TRAILS.add({ p: [gx, 0.08, gz], f: [1, 0, 0], s: [0, 0, 1], a0: -Math.PI, a1: Math.PI, r0: 0.3, r1: 1.1, T: 0.02, hold: 0, fade: 0.4, colA: style.trailA, colB: style.trailB, flame: style.flame, gain: 1.2, grow: 7 });
      for (let i = 0; i < 12; i++) { const g = rnd() * 6.28; DUST.add(gx, 0.12, gz, Math.cos(g) * 6, 0.4 + rnd(), Math.sin(g) * 6, 0.3, 0.34, 0.52, 0.24, 0.5, 0.7, 2.6, -0.2); }
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), far = Math.min(6.5, R * 1.7); // and a line of fire runs out ahead of it
      fireLine(P.x + fx * 0.9, P.z + fz * 0.9, P.x + fx * far, P.z + fz * far, 10, 1.5, 0.6, 0.16, 0.5);
      SCORCH.add(P.x + fx * (far + 0.9) / 2, P.z + fz * (far + 0.9) / 2, far / 2, 0.55, 4, 1, fx, fz);
      blaze(gx, 0.2, gz, 6, 0.9, 6);
      S.shake = Math.max(S.shake, 0.55); S.kick = Math.max(S.kick, 0.7);
    }
    cutWith(job, R);
    if (kind === 2) cutWith(Object.assign({}, job, { d: job.d + (n.y >= 0 ? 0.5 : -0.5) }), R);
  }
  // The cut itself: whatever the blade reaches along the line that was drawn, with the second and third edge if he has them.
  function cutWith(job, R) {
    R *= 1 + 0.12 * P.heat; // a blade that burns high reaches a little further
    const px = P.x, pz = P.z, e = job.vp.elements, lx = job.bx - job.ax, ly = job.by - job.ay, len2 = lx * lx + ly * ly;
    const want = (x, y, z, r) => {
      if (y - r * 0.3 > (P.over ? 4.8 : TOP)) return false;
      const ex = x - px, ey = y - 1.1, ez = z - pz, lim = R + r * 0.6;
      if (ex * ex + ey * ey + ez * ez > lim * lim) return false;
      const w = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (w <= 0.01) return false;
      const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w * 0.5 + 0.5) * vw, sy = (0.5 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / w * 0.5) * vh;
      const t = ((sx - job.ax) * lx + (sy - job.ay) * ly) / len2, pad = (24 + r * job.focal / w * 0.6) / job.len;
      return t > -pad && t < 1 + pad;
    };
    const killed = S.kills;
    let made = cutAll(job, want, px, pz, R);
    for (let k = 1; k <= Math.max(P.up.twin, P.over ? 2 : 0); k++) made += cutAll(Object.assign({}, job, { d: job.d + (k === 1 ? 0.26 : -0.26) }), want, px, pz, R);
    if (made) { scored(made, killed); stoke(made); S.shx = job.u.x; S.shz = job.u.z; }
    for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; if (!b.back && Math.hypot(b.x - px, b.z - pz) < R * 0.9) { dropBolt(i, true); P.focus = Math.min(1, P.focus + 0.05); } } // a swing takes bolts out of the air
    return made;
  }
  // cutting stokes the fire on the blade: the more he cuts, the bigger it burns; left alone it dies back down
  function stoke(made) { P.heat = Math.min(1, P.heat + 0.05 + made * 0.012); P.heatAt = S.real; }
  function cutAll(job, want, cx, cz, R) {
    let made = 0;
    for (const en of enemies.slice()) if (!en.dead && Math.hypot(en.x - cx, en.z - cz) < R + 2 * en.scale) made += cutIdol(en, job, want);
    for (const b of bodies.slice()) {
      const dx = b.x - cx, dy = b.y - 1.1, dz = b.z - cz, lim = R + b.radius;
      if (dx * dx + dy * dy + dz * dz < lim * lim) made += cutBody(b, job, want);
    }
    return made;
  }
  function scored(made, killed) {
    S.parts += made;
    SFX.cut(made);
    S.shake = Math.max(S.shake, Math.min(0.55, 0.16 + made * 0.03));
    if (S.kills > killed) { S.stop = 0.028; if (P.sw && P.sw.heavy) S.flash = Math.max(S.flash, 0.6); }
    if (!S.cutOnce) { S.cutOnce = true; $('hint').classList.add('gone'); }
  }
  // with the dash upgrade: one flat cut along the whole path of the dash
  function whirl() {
    const ax = P.sx0, az = P.sz0, bx = P.x, bz = P.z, len = Math.hypot(bx - ax, bz - az);
    if (len < 0.3) return;
    const ux = (bx - ax) / len, uz = (bz - az) / len, tilt = P.flip++ % 2 ? 0.16 : -0.16;
    const n = new T.Vector3(-uz * tilt, 1, ux * tilt).normalize(), u = new T.Vector3(ux, 0, uz);
    u.addScaledVector(n, -u.dot(n)).normalize();
    const job = { n, d: n.x * bx + n.y * 1.0 + n.z * bz, u };
    const want = (x, y, z, r) => {
      if (y - r * 0.3 > 2.4) return false;
      const t = clamp(((x - ax) * ux + (z - az) * uz) / len, 0, 1), dx = x - (ax + ux * len * t), dz = z - (az + uz * len * t), lim = 1.5 + r * 0.5;
      return dx * dx + dz * dz < lim * lim;
    };
    const killed = S.kills, made = cutAll(job, want, (ax + bx) / 2, (az + bz) / 2, len / 2 + 1.7);
    const s = new T.Vector3().crossVectors(n, u);
    crescent({ x: bx, y: 1.0, z: bz }, { x: -u.x, y: -u.y, z: -u.z }, s, -2.7, 2.7, 0.4, 1.9, 0.1);
    STREAKS.add(ax, 1.0, az, bx, 1.0, bz, 0.12, 0.35, 0.04, style.trailA);
    SFX.swing();
    if (made) scored(made, killed);
  }
  function tapSlash(x, y) {
    let cx = x, cy = y, best = 120 * 120;
    for (const e of enemies) {
      if (e.dead) continue;
      pj.set(e.x, 1.05 * e.scale, e.z).project(camera);
      const sx = (pj.x * 0.5 + 0.5) * vw, sy = (0.5 - pj.y * 0.5) * vh, d = (sx - x) * (sx - x) + (sy - y) * (sy - y);
      if (d < best) { best = d; cx = sx; cy = sy; }
    }
    if (S.real - P.comboAt > 1.1) P.combo = 0;
    // down to the right, down to the left, a flat cut on the turn, two turns in the air, and a blow straight down; overloaded, only the last three
    const seq = P.over ? [[0.06, 1], [Math.PI - 0.06, 2], [Math.PI / 2, 3]] : [[-0.5, 0], [Math.PI + 0.5, 0], [0.06, 1], [Math.PI - 0.06, 2], [Math.PI / 2, 3]];
    const pick = seq[P.combo % seq.length], ang = pick[0], L = clamp(vh * 0.17, 70, 180) * (pick[1] ? 1.3 : 1);
    if (slash(cx - Math.cos(ang) * L, cy + Math.sin(ang) * L, cx + Math.cos(ang) * L, cy - Math.sin(ang) * L, pick[1])) { P.combo++; P.comboAt = S.real; }
  }

  // ---- techniques: two are worn at a time, chosen in the arsenal
  const ABIL = {
    storm: { name: 'Тысяча срезов', short: 'Срезы', text: 'Исчезаешь, и всё вокруг цели изрублено раньше, чем успело упасть', cd: 14 },
    wave: { name: 'Полумесяц', short: 'Месяц', text: 'Срез срывается с клинка и летит вперёд, разрезая всё на пути', cd: 6 },
    spin: { name: 'Вихрь', short: 'Вихрь', text: 'Огненный смерч: пять оборотов, врагов тянет под клинок, срезы идут на всех высотах, в конце удар в землю. Во время вихря можно бежать', cd: 3.5 },
    iai: { name: 'Удар сквозь', short: 'Сквозь', text: 'Проносишься насквозь. Всё распадается, когда клинок входит в ножны', cd: 9 },
    guard: { name: 'Отражение', short: 'Щит', text: 'Клинок вращается перед тобой: удары отбиты, выстрелы летят обратно в стрелка', cd: 7 },
    fan: { name: 'Веер дисков', short: 'Веер', text: 'Три диска света расходятся веером и режут всё на пути', cd: 5 },
    leap: { name: 'Удар с неба', short: 'Прыжок', text: 'Прыжок к цели и удар сверху: звезда срезов во все стороны', cd: 8 },
  };
  const COOL = false; // cooldowns are switched off for now: a technique is ready again as soon as the last one is over. true brings them back
  const ABIL_IDS = Object.keys(ABIL), waves = [], mouse = { x: 0, y: 0, seen: false };
  for (const id of ABIL_IDS) P.cd[id] = 0;
  // where a technique is pointed: at the mouse, or with fingers at the nearest idol, or else straight ahead
  function aimDir() {
    if (mouse.seen && !TOUCH && !S.arsenal) {
      camera.updateMatrixWorld(); dirAt(mouse.x, mouse.y, d0);
      if (d0.y < -0.02) { const t = -camera.position.y / d0.y, x = camera.position.x + d0.x * t - P.x, z = camera.position.z + d0.z * t - P.z, l = Math.hypot(x, z); if (l > 0.3) return [x / l, z / l]; }
    }
    let best = null, bd = 16;
    for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; best = e; } }
    if (best && bd > 0.2) return [(best.x - P.x) / bd, (best.z - P.z) / bd];
    return [Math.sin(P.yaw), Math.cos(P.yaw)];
  }
  function ghostAt(x, z, yaw, life) { // an afterimage of the wanderer as he stands now, set down somewhere else
    const r = P.rig.root, px = r.position.x, pz = r.position.z, ry = r.rotation.y;
    r.position.x = x; r.position.z = z; r.rotation.y = yaw;
    GHOSTS.add(bake(P.rig), style.ghost, life || 0.3);
    r.position.x = px; r.position.z = pz; r.rotation.y = ry; r.updateMatrixWorld(true);
  }
  // the spot a technique is pointed at, no farther than max: under the mouse, or with fingers the nearest synth
  function aimPoint(max) {
    let x = P.x + Math.sin(P.yaw) * max * 0.6, z = P.z + Math.cos(P.yaw) * max * 0.6, got = false;
    if (mouse.seen && !TOUCH && !S.arsenal) {
      camera.updateMatrixWorld(); dirAt(mouse.x, mouse.y, d0);
      if (d0.y < -0.02) { const t = -camera.position.y / d0.y; x = camera.position.x + d0.x * t; z = camera.position.z + d0.z * t; got = true; }
    }
    if (!got) { let bd = 14; for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; x = e.x; z = e.z; } } }
    const dx = x - P.x, dz = z - P.z, l = Math.hypot(dx, dz);
    if (l > max) { x = P.x + dx / l * max; z = P.z + dz / l * max; }
    const r = Math.hypot(x, z);
    if (r > ARENA) { x *= ARENA / r; z *= ARENA / r; }
    return [x, z];
  }
  function keepIn() { pushOut(P, 0.36); const r = Math.hypot(P.x, P.z); if (r > ARENA) { P.x *= ARENA / r; P.z *= ARENA / r; } }
  function endAct() { P.act = null; P.y = 0; P.rig.root.visible = true; katana.visible = true; }
  function useAbility(slot) {
    const id = P.slots[slot];
    if (!id || P.act || P.dead || S.paused || S.choosing || P.cd[id] > 0 || (S.mode !== 'play' && !S.arsenal)) return false;
    const [ax, az] = aimDir();
    P.yaw = Math.atan2(ax, az); P.lunge = null; P.sw = null; P.dash = 0; P.queue = null; P.kx = P.kz = 0;
    const a = P.act = { id, t: 0, ax, az, x0: P.x, z0: P.z, made: 0, kills: S.kills, hidden: false, pose: null, slow: null, step: 0 };
    P.cd[id] = COOL ? ABIL[id].cd : 0; P.invul = Math.max(P.invul, 1.5); P.stance = 1; P.front = 1;
    if (id === 'storm') {
      // the middle of it: the nearest idol in front, or a spot a few steps ahead
      const mg = mouseGround(), md = mg ? Math.hypot(mg[0] - P.x, mg[1] - P.z) : 0, far = Math.min(md, 14); // at the cursor, if there is one
      const cx = mg && md > 0.3 ? P.x + (mg[0] - P.x) / md * far : P.x + ax * 2.6, cz = mg && md > 0.3 ? P.z + (mg[1] - P.z) / md * far : P.z + az * 2.6;
      let bd = mg ? 2.2 : 4.4;
      for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - cx, e.z - cz); if (d < bd) { bd = d; a.c = [e.x, Math.min(1.7, 1.05 * e.scale), e.z]; } }
      if (!a.c) a.c = [cx, 1.1, cz];
      a.slow = 0.04; a.cuts = 12; a.next = 0.13;
      SFX.focus(true);
    } else if (id === 'wave') {
      const tilt = P.flip++ % 2 ? 0.5 : -0.5, n = new T.Vector3(az * Math.sin(tilt), Math.cos(tilt), -ax * Math.sin(tilt)), f = new T.Vector3(ax, 0, az), s = new T.Vector3().crossVectors(n, f), pv = new T.Vector3(P.x, 1.25, P.z);
      a.n = n; a.f = f; a.s = s;
      P.sw = { t: 0, T: 0.13, pv, f, s, a0: -1.9, a1: 1.3, turn: 1, heavy: false };
      crescent(pv, f, s, -1.9, 1.3, 0.45, P.reach * 1.1, 0.13, { gain: 1.3 });
      SFX.swing();
    } else if (id === 'spin') {
      a.pose = 'spin'; a.spin = 0; a.free = true; a.move = 0.85;
      FLARES.add(P.x, 1.3, P.z, style.trailA, 8, 1.1, 15, P);
      SFX.vortex();
    } else if (id === 'iai') {
      const mg = mouseGround();
      let L = mg ? clamp(Math.hypot(mg[0] - P.x, mg[1] - P.z), 2.5, 14) : 9.5; // he comes out exactly where the cursor was
      const er = Math.hypot(P.x + ax * L, P.z + az * L);
      if (er > ARENA) L = Math.max(2, L - (er - ARENA));
      a.x1 = P.x + ax * L; a.z1 = P.z + az * L; a.L = L;
      for (let i = 0; i < 6; i++) ghostAt(lerp(P.x, a.x1, i / 6), lerp(P.z, a.z1, i / 6), P.yaw, 0.25 + i * 0.07);
      STREAKS.add(P.x, 1.05, P.z, a.x1, 1.05, a.z1, 0.16, 0.8, 0.06, style.trailA);
      for (let i = 0; i < 14; i++) DUST.add(lerp(P.x, a.x1, i / 14), 0.12, lerp(P.z, a.z1, i / 14), (rnd() - 0.5) * 2, 0.4 + rnd(), (rnd() - 0.5) * 2, 0.3, 0.34, 0.52, 0.2, 0.4, 0.7, 2, -0.2);
      P.x = a.x1; P.z = a.z1; a.pose = 'sheath'; a.sheath = 0; a.slow = 0.03;
      SFX.dash(); SFX.focus(true);
    } else if (id === 'guard') {
      a.pose = 'guard'; a.free = true; a.next = 0;
      SFX.parry();
    } else if (id === 'fan') {
      const pv = new T.Vector3(P.x, 1.2, P.z), f = new T.Vector3(ax, 0, az), up = new T.Vector3(0, 1, 0), sd = new T.Vector3(az, 0, -ax);
      P.sw = { t: 0, T: 0.1, pv, f, s: sd, a0: -1.4, a1: 1.4, turn: 1, heavy: false };
      crescent(pv, f, sd, -1.4, 1.4, 0.4, 1.6, 0.1);
      [-0.3, 0, 0.3].forEach((off, i) => { // three discs, each on edge and each leaning its own way
        const c = Math.cos(off), sn = Math.sin(off), dx = ax * c - az * sn, dz = az * c + ax * sn, lean = (i - 1) * 0.45 + 0.12;
        const n = new T.Vector3(dz * Math.cos(lean), Math.sin(lean), -dx * Math.cos(lean)), fd = new T.Vector3(dx, 0, dz), sx = new T.Vector3().crossVectors(n, fd);
        const w = { x: P.x + dx * 0.9, z: P.z + dz * 0.9, y: 1.1, ax: dx, az: dz, d: 0, max: 13, speed: 25, half: 0.75, top: 3.2, kills: S.kills, flames: 1, tail: 0.07, trail: null, burn: 0.7 };
        w.jobs = [{ n, d: n.x * w.x + n.y * 1.1 + n.z * w.z, u: fd }];
        w.trail = crescent({ x: w.x, y: 1.1, z: w.z }, fd, sx, -Math.PI, Math.PI, 0.1, 0.62, 0.04, { hold: 9, fade: 0.2, gain: 1.6, follow: () => [w.x, w.y, w.z] });
        waves.push(w);
      });
      SFX.swing(); SFX.shot();
    } else if (id === 'leap') {
      const at = aimPoint(10);
      a.x1 = at[0]; a.z1 = at[1]; a.pose = 'leap';
      const dx = a.x1 - P.x, dz = a.z1 - P.z;
      if (Math.hypot(dx, dz) > 0.3) P.yaw = Math.atan2(dx, dz);
      ghostAt(P.x, P.z, P.yaw, 0.3);
      SFX.dash();
    }
    return true;
  }
  function updateAct(dt) { // dt: real seconds; a technique does not slow down with the world
    for (const id of ABIL_IDS) P.cd[id] = Math.max(0, P.cd[id] - dt);
    const a = P.act;
    if (!a) return;
    if (P.dead) { endAct(); return; }
    a.t += dt;
    if (a.id === 'storm') {
      const c = a.c;
      if (a.t > 0.1 && a.step < a.cuts) a.hidden = true;
      while (a.step < a.cuts && a.t >= a.next) {
        a.next += 0.05; a.step++;
        // a plane at any angle through the middle of it
        let nx, ny, nz, l;
        do { nx = rnd() * 2 - 1; ny = rnd() * 2 - 1; nz = rnd() * 2 - 1; l = Math.hypot(nx, ny, nz); } while (l > 1 || l < 0.2);
        const n = new T.Vector3(nx / l, ny / l, nz / l), u = new T.Vector3(rnd() - 0.5, (rnd() - 0.5) * 0.6, rnd() - 0.5);
        u.addScaledVector(n, -u.dot(n)).normalize();
        const px = c[0] + (rnd() - 0.5) * 0.9, py = Math.max(0.25, c[1] + (rnd() - 0.5) * 0.9), pz = c[2] + (rnd() - 0.5) * 0.9;
        const want = (x, y, z, r) => { const dx = x - c[0], dy = y - c[1], dz = z - c[2], lim = 3.3 + r * 0.5; return dx * dx + dy * dy + dz * dz < lim * lim; };
        CUT.minPiece = 1.4e-3; // crumbs smaller than a fist are left alone, or there would be thousands
        a.made += cutAll({ n, d: n.x * px + n.y * py + n.z * pz, u }, want, c[0], c[2], 3.3);
        CUT.minPiece = 2.5e-4;
        STREAKS.add(px - u.x * 4.4, py - u.y * 4.4, pz - u.z * 4.4, px + u.x * 4.4, py + u.y * 4.4, pz + u.z * 4.4, 0.1, 0.5, 0.045, style.trailA);
        for (const o of [-1.4, 0, 1.4]) fire(px + u.x * o, Math.max(0.05, py + u.y * o - 0.3), pz + u.z * o, 0.8, 0.5, { gain: 1.1 });
        ghostAt(px - u.x * 1.6, pz - u.z * 1.6, Math.atan2(u.x, u.z), 0.32);
        SFX.flurry(a.step);
        S.shake = Math.max(S.shake, 0.25);
      }
      if (a.step >= a.cuts && !a.landed && a.t >= a.next + 0.02) { // out the far side, already putting the blade away
        a.landed = true; a.hidden = false; a.pose = 'sheath'; a.sheath = 0; a.from = a.t;
        P.x = c[0] + a.ax * 2.7; P.z = c[2] + a.az * 2.7; keepIn();
        P.yaw = Math.atan2(a.ax, a.az);
      }
      if (a.landed) {
        a.sheath = (a.t - a.from) / 0.42;
        if (!a.clicked && a.t >= a.from + 0.45) { a.clicked = true; a.slow = null; SFX.sheath(); SFX.erupt(); S.flash = 1; S.kick = 1; S.shake = Math.max(S.shake, 0.7); blaze(c[0], 0.6, c[2], 14, 1.3, 11); fireRing(c[0], c[2], 2.3, 12, 1.4, 0.8, 0.03); fire(c[0], 0.03, c[2], 3.6, 0.7, { gain: 1.3, keep: true }); if (a.made) scored(a.made, a.kills); }
        if (a.t >= a.from + 0.7) endAct();
      }
    } else if (a.id === 'wave') {
      if (!a.fired && a.t >= 0.11) {
        a.fired = true;
        const w = { x: P.x + a.ax, z: P.z + a.az, y: 1.2, ax: a.ax, az: a.az, d: 0, max: 16, speed: 28, half: 2.0, top: 3.6, kills: S.kills, flames: 4, tail: 0, trail: null, burn: 1.5 };
        w.jobs = [{ n: a.n, d: a.n.x * w.x + a.n.y * 1.2 + a.n.z * w.z, u: a.f }];
        w.trail = crescent({ x: w.x, y: 1.2, z: w.z }, a.f, a.s, -1.05, 1.05, 1.0, 2.5, 0.05, { hold: 9, fade: 0.25, gain: 1.5, flame: Math.max(style.flame, 0.6), follow: () => [w.x - w.ax * 1.9, 1.2, w.z - w.az * 1.9] });
        waves.push(w);
        blaze(P.x + a.ax * 1.2, 1.0, P.z + a.az * 1.2, 6, 0.9, 6);
        SFX.wave(); S.shake = Math.max(S.shake, 0.3); S.kick = Math.max(S.kick, 0.6);
      }
      if (a.t >= 0.34) endAct();
    } else if (a.id === 'spin') {
      const k = Math.min(1, a.t / 0.84), px = P.x, pz = P.z;
      const ring = (h, R, tilt) => { // one cut all the way round at this height; what it frees is flung round and outward
        const ph = rnd() * 6.28, n = new T.Vector3(Math.cos(ph) * tilt, 1, Math.sin(ph) * tilt).normalize(), f = new T.Vector3(1, 0, 0);
        f.addScaledVector(n, -f.dot(n)).normalize();
        const s = new T.Vector3().crossVectors(n, f);
        const job = { n, d: n.x * px + n.y * h + n.z * pz, u: f, uAt: (x, z) => { const dx = x - px, dz = z - pz, l = Math.hypot(dx, dz) || 1; return [(dx * 0.6 - dz) / l, 0, (dz * 0.6 + dx) / l]; } };
        const want = (x, y, z, r) => { if (y - r * 0.3 > 3.4) return false; const dx = x - px, dz = z - pz, lim = R + r * 0.5; return dx * dx + dz * dz < lim * lim; };
        const made = cutAll(job, want, px, pz, R + 0.1);
        if (made) { scored(made, a.kills); a.kills = S.kills; stoke(made); }
        return [f, s];
      };
      if (!a.landed) {
        a.spin = (0.3 * ease(k) + 0.7 * k) * Math.PI * 10; // five turns
        P.y = Math.sin(Math.PI * k) * 0.5;
        for (const e of enemies) { // whatever stands near is drawn in under the blade
          if (e.dead || e.dummy || e.kind === 'colossus') continue;
          const dx = px - e.x, dz = pz - e.z, d = Math.hypot(dx, dz);
          if (d < 8 && d > 1.7) { const pull = (2 + 6 * (1 - d / 8)) * dt; e.x += dx / d * pull; e.z += dz / d * pull; }
        }
        const rate = dt * (TOUCH ? 50 : 80); // the fire goes round with the blade and climbs: a column of it turning about him
        for (let n = Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0); n > 0; n--) {
          const g = rnd() * 6.28, r = 1.1 + rnd() * 2.8, cx = Math.cos(g), cz = Math.sin(g), y = rnd() * rnd() * 2.7 * (0.3 + k);
          fire(px + cx * r, y, pz + cz * r, 0.7 + rnd() * 1.0, 0.36, { vx: -cz * (3 + r * 1.6), vy: 1.5 + rnd() * 2.5, vz: cx * (3 + r * 1.6), ux: -cz * 0.62, uy: 0.78, uz: cx * 0.62, gain: 1.05 });
        }
        const H = [0.5, 1.0, 1.55, 2.1, 1.25], at = [0.05, 0.2, 0.35, 0.5, 0.65];
        while (a.step < 5 && a.t >= at[a.step]) {
          const h = H[a.step], R = 3.8 + a.step * 0.12, [f, s] = ring(h, R, 0.1);
          crescent({ x: px, y: h + P.y * 0.5, z: pz }, f, s, -Math.PI, Math.PI, 1.6, R + 0.5, 0.14, { fade: 0.22, gain: 0.7, flame: 1 });
          SCORCH.add(px, pz, R * 0.8, R * 0.8, 3, 0.5);
          for (let i = 0; i < 8; i++) { const g = rnd() * 6.28; DUST.add(px + Math.cos(g) * 1.2, 0.12, pz + Math.sin(g) * 1.2, Math.cos(g) * 6, 0.4 + rnd(), Math.sin(g) * 6, 0.3, 0.34, 0.52, 0.2, 0.42, 0.6, 2.4, -0.2); }
          if (a.step % 2 === 0) GHOSTS.add(bake(P.rig), style.ghost, 0.2);
          S.shake = Math.max(S.shake, 0.35); S.kick = Math.max(S.kick, 0.35); P.fireK = 1.6;
          a.step++;
        }
        if (k >= 1) { // and down: the blade goes into the ground and the fire he gathered goes out from it in rings
          a.landed = true; a.pose = 'slam'; a.free = false; P.y = 0; P.stance = 1; a.end = a.t + 0.26;
          const [f, s] = ring(0.9, 5.0, 0.06);
          TRAILS.add({ p: [px, 0.1, pz], f: [f.x, f.y, f.z], s: [s.x, s.y, s.z], a0: -Math.PI, a1: Math.PI, r0: 0.5, r1: 1.7, T: 0.02, hold: 0, fade: 0.5, colA: style.trailA, colB: style.trailB, flame: 1, gain: 1.6, grow: 9 });
          fireRing(px, pz, 1.5, 9, 1.7, 0.75, 0); fireRing(px, pz, 3.2, 15, 1.25, 0.65, 0.06); fireRing(px, pz, 4.8, 20, 0.9, 0.55, 0.13);
          fire(px + Math.sin(P.yaw) * 0.5, 0.03, pz + Math.cos(P.yaw) * 0.5, 3.2, 0.6, { gain: 1.3, keep: true });
          SCORCH.add(px, pz, 5.2, 5.2, 5.5, 1);
          FLARES.add(px, 1.4, pz, style.trailA, 11, 0.7, 18);
          for (let i = 0; i < 20; i++) { const g = rnd() * 6.28; DUST.add(px + Math.cos(g) * 0.6, 0.12, pz + Math.sin(g) * 0.6, Math.cos(g) * 10, 0.4 + rnd() * 1.4, Math.sin(g) * 10, 0.3, 0.34, 0.52, 0.26, 0.6, 0.8, 2.6, -0.2); }
          SFX.erupt(); S.flash = 0.85; S.kick = 1; S.shake = Math.max(S.shake, 0.9);
        }
      } else if (a.t >= a.end) endAct();
    } else if (a.id === 'iai') {
      a.sheath = (a.t - 0.12) / 0.4;
      if (!a.clicked && a.t >= 0.55) { // the blade is home: only now does what it passed through come apart
        a.clicked = true; a.slow = null;
        const sx = a.az, sz = -a.ax, f = new T.Vector3(a.ax, 0, a.az), x0 = a.x0, z0 = a.z0, L = a.L;
        const want = (x, y, z, r) => {
          if (y - r * 0.3 > 3.2) return false;
          const t = clamp(((x - x0) * a.ax + (z - z0) * a.az) / L, 0, 1), dx = x - (x0 + a.ax * L * t), dz = z - (z0 + a.az * L * t), lim = 1.7 + r * 0.5;
          return dx * dx + dz * dz < lim * lim;
        };
        let made = 0;
        for (const [ny, ns, h] of [[1, 0.2, 1.05], [0.25, 1, 1.0]]) { // one flat cut and one upright along the path: what stood on it falls in four
          const n = new T.Vector3(sx * ns, ny, sz * ns).normalize();
          made += cutAll({ n, d: n.x * x0 + n.y * h + n.z * z0, u: f }, want, (x0 + a.x1) / 2, (z0 + a.z1) / 2, L / 2 + 1.9);
        }
        fireLine(x0, z0, a.x1, a.z1, Math.ceil(L * 1.7), 1.6, 0.8, 0.13, 0.7); // the whole path he took goes up
        for (let i = 0; i < 4; i++) SCORCH.add(lerp(x0, a.x1, (i + 0.5) / 4), lerp(z0, a.z1, (i + 0.5) / 4), L / 8 + 0.2, 0.8, 4.5, 1, a.ax, a.az);
        FLARES.add((x0 + a.x1) / 2, 1.3, (z0 + a.z1) / 2, style.trailA, 9, 0.6, 18);
        SFX.sheath(); SFX.erupt(); S.flash = 1; S.shake = Math.max(S.shake, 0.6);
        if (made) scored(made, a.kills);
      }
      if (a.t >= 0.8) endAct();
    } else if (a.id === 'rise') { // the overload takes hold: up off the ground for a moment with the blade over his head, light breaking out of him
      const k = Math.min(1, a.t / 0.45);
      P.y = Math.sin(Math.PI * k) * 0.95;
      while (a.step < 3 && a.t >= a.step * 0.13) { a.step++; STREAKS.add(P.x, 0.1, P.z, P.x, 6.5, P.z, 0.2 + a.step * 0.12, 0.5, 0.08, style.trailA); for (let i = 0; i < 10; i++) flame(P.x + (rnd() - 0.5) * 1.2, 0.3 + rnd() * 2, P.z + (rnd() - 0.5) * 1.2); for (let i = 0; i < 3; i++) fire(P.x + (rnd() - 0.5) * 0.8, 0.03, P.z + (rnd() - 0.5) * 0.8, 3 + rnd() * 1.8, 0.7, { gain: 1.25, keep: true }); fireRing(P.x, P.z, 0.9 + a.step * 0.8, 7 + a.step * 3, 1.3, 0.7, 0); }
      if (k >= 1) endAct();
    } else if (a.id === 'guard') {
      const d = aimDir();
      P.yaw = Math.atan2(d[0], d[1]);
      if (a.t >= a.next) { // the blade is everywhere at once in front of him: short arcs at every angle, on a disc that faces forward
        a.next = a.t + 0.055;
        const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), g = rnd() * 6.28, f = new T.Vector3(fz * Math.sin(g), Math.cos(g), -fx * Math.sin(g)), fw = new T.Vector3(fx, 0, fz);
        crescent({ x: P.x + fx * 0.7, y: 1.15, z: P.z + fz * 0.7 }, f, new T.Vector3().crossVectors(fw, f), -1.4, 1.4, 0.2, 1.3, 0.05, { fade: 0.12, gain: 0.85 });
        fire(P.x + fx * 0.75 + f.x * 1.0, Math.max(0.05, 0.95 + f.y * 1.0), P.z + fz * 0.75 + f.z * 1.0, 0.55, 0.26, { gain: 0.95 });
      }
      if (a.t >= 1.35) endAct();
    } else if (a.id === 'fan') {
      if (a.t >= 0.2) endAct();
    } else if (a.id === 'leap') {
      const k = Math.min(1, a.t / 0.4);
      if (!a.landed) {
        P.x = lerp(a.x0, a.x1, k); P.z = lerp(a.z0, a.z1, k); P.y = Math.sin(Math.PI * k) * 3.4;
        if (a.t - (a.gt || 0) > 0.07) { a.gt = a.t; GHOSTS.add(bake(P.rig), style.ghost, 0.25); }
        if (k >= 1) { // he comes down blade first, and the ground around the place opens in a star
          a.landed = true; a.pose = null; P.y = 0; P.stance = 1; keepIn();
          const px = P.x, pz = P.z, base = rnd() * 3.14, want = (x, y, z, r) => { if (y - r * 0.3 > 3.6) return false; const dx = x - px, dz = z - pz, lim = 3.5 + r * 0.5; return dx * dx + dz * dz < lim * lim; };
          const out = (x, z) => { const dx = x - px, dz = z - pz, l = Math.hypot(dx, dz) || 1; return [dx / l * 1.3, 0.6, dz / l * 1.3]; };
          // one flat cut that reaches everyone around him, then the star that breaks them up
          const flat = new T.Vector3(Math.cos(base) * 0.1, 1, Math.sin(base) * 0.1).normalize();
          let made = cutAll({ n: flat, d: flat.x * px + flat.y * 1.0 + flat.z * pz, u: new T.Vector3(1, 0, 0), uAt: out }, want, px, pz, 3.6);
          for (let i = 0; i < 4; i++) {
            const g = base + i * Math.PI / 4, n = new T.Vector3(Math.cos(g), 0.08, Math.sin(g)).normalize(), lx = -Math.sin(g), lz = Math.cos(g);
            made += cutAll({ n, d: n.x * px + n.y * 1.0 + n.z * pz, u: new T.Vector3(lx, 0, lz), uAt: out }, want, px, pz, 3.6);
            STREAKS.add(px - lx * 3.8, 0.12, pz - lz * 3.8, px + lx * 3.8, 0.12, pz + lz * 3.8, 0.14, 0.5, 0.05, style.trailA);
          }
          TRAILS.add({ p: [px, 0.1, pz], f: [1, 0, 0], s: [0, 0, 1], a0: -Math.PI, a1: Math.PI, r0: 0.4, r1: 1.4, T: 0.02, hold: 0, fade: 0.45, colA: style.trailA, colB: style.trailB, flame: style.flame, gain: 1.4, grow: 8 });
          crescent({ x: px, y: 1.2, z: pz }, { x: 0, y: 1, z: 0 }, { x: Math.sin(P.yaw), y: 0, z: Math.cos(P.yaw) }, -0.5, 2.5, 0.5, 3.3, 0.07, { gain: 1.4 });
          for (let i = 0; i < 22; i++) { const g = rnd() * 6.28; DUST.add(px + Math.cos(g) * 0.5, 0.12, pz + Math.sin(g) * 0.5, Math.cos(g) * 9, 0.4 + rnd() * 1.4, Math.sin(g) * 9, 0.3, 0.34, 0.52, 0.26, 0.6, 0.8, 2.6, -0.2); }
          fireRing(px, pz, 1.4, 10, 1.9, 0.85, 0); fireRing(px, pz, 3.1, 16, 1.2, 0.7, 0.07);
          fire(px, 0.03, pz, 3.8, 0.65, { gain: 1.35, keep: true });
          for (let i = 0; i < 4; i++) { const g = base + i * Math.PI / 4, lx = -Math.sin(g), lz = Math.cos(g); fireLine(px, pz, px + lx * 3.8, pz + lz * 3.8, 5, 1.0, 0.5, 0.1, 0.2); fireLine(px, pz, px - lx * 3.8, pz - lz * 3.8, 5, 1.0, 0.5, 0.1, 0.2); }
          SCORCH.add(px, pz, 4.2, 4.2, 5.5, 1); FLARES.add(px, 1.5, pz, style.trailA, 12, 0.7, 18);
          SFX.quake(); SFX.erupt(); S.flash = 0.9; S.kick = 1; S.shake = Math.max(S.shake, 0.9);
          if (made) scored(made, a.kills);
          a.end = a.t + 0.26;
        }
      } else if (a.t >= a.end) endAct();
    }
  }
  // true for whatever stands within `half` of the stretch from (x0, z0) along (ax, az) for `len`, and no higher than `top`
  const strip = (x0, z0, ax, az, len, half, top) => (x, y, z, r) => {
    if (y - r * 0.3 > top) return false;
    const t = clamp(((x - x0) * ax + (z - z0) * az) / len, 0, 1), dx = x - (x0 + ax * len * t), dz = z - (z0 + az * len * t), lim = half + r * 0.5;
    return dx * dx + dz * dz < lim * lim;
  };
  function updateFlying(dt) { // what has left the blade and is on its way: crescents, discs, the saw
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i], len = w.speed * dt, x0 = w.x, z0 = w.z;
      if (len <= 0) continue;
      w.x += w.ax * len; w.z += w.az * len; w.d += len;
      const want = strip(x0, z0, w.ax, w.az, len, w.half, w.top), mx = (x0 + w.x) / 2, mz = (z0 + w.z) / 2;
      let made = 0;
      for (const job of w.jobs) made += cutAll(job, want, mx, mz, w.half + 0.3 + len / 2);
      if (w.saw) {
        w.next -= len;
        if (w.next <= 0) { // and a slice across the corridor every pace, so what it passes over comes out in blocks
          w.next = 0.95;
          const n = new T.Vector3(w.ax, 0.1, w.az).normalize();
          made += cutAll({ n, d: n.x * w.x + n.y * 1.0 + n.z * w.z, u: new T.Vector3(-w.az, 0.3, w.ax).normalize() }, strip(w.x - w.ax * 1.3, w.z - w.az * 1.3, w.ax, w.az, 2.6, w.half, w.top), w.x, w.z, w.half + 1.6);
        }
        S.shake = Math.max(S.shake, 0.3); S.shx = -w.az; S.shz = w.ax;
        for (let k = 0; k < 5; k++) SPARKS.add(w.x + (rnd() - 0.5) * 0.5, 0.08, w.z + (rnd() - 0.5) * 0.5, -w.ax * 6 + (rnd() - 0.5) * 9, 2 + rnd() * 6, -w.az * 6 + (rnd() - 0.5) * 9, style.spark[0], style.spark[1], style.spark[2], 1, 0.04 + rnd() * 0.05, 0.3 + rnd() * 0.5, 1.2, 12);
        STREAKS.add(x0, 0.06, z0, w.x, 0.06, w.z, 0.3, 0.7, 0.01, style.trailB);
      }
      if (made) { scored(made, w.kills); w.kills = S.kills; }
      if (w.tail) STREAKS.add(x0, w.y, z0, w.x, w.y, w.z, w.tail, 0.14, 0.01, style.trailA);
      if (w.burn) { // what flies from the blade sets the ground alight under it
        w.lit = (w.lit || 0) + len;
        while (w.lit > 0.8) {
          w.lit -= 0.8;
          for (const o of w.half > 1 ? [-0.62, 0, 0.62] : [0]) fire(w.x + w.az * (o + (rnd() - 0.5) * 0.35) * w.half, 0.03, w.z - w.ax * (o + (rnd() - 0.5) * 0.35) * w.half, w.burn * (0.65 + rnd() * 0.6), w.saw ? 1.2 : 0.75, { keep: true });
          SCORCH.add(w.x, w.z, 0.7, Math.max(0.3, w.half * 0.85), w.saw ? 5 : 3, 0.9, w.ax, w.az);
        }
      }
      for (let k = 0; k < w.flames; k++) { const o = (rnd() - 0.5) * w.half * 1.8; flame(w.x + w.az * o, 0.3 + rnd() * (w.saw ? 4 : 1.6), w.z - w.ax * o); }
      if (w.d >= w.max || Math.hypot(w.x, w.z) > ARENA + 8) { TRAILS.stop(w.trail); waves.splice(i, 1); }
    }
  }
  // ---- the ultimate: filled by kills, then spent all at once
  const ULTS = {
    over: { name: 'Перегрузка', short: 'Мощь', text: 'Восемь секунд клинок вдвое длиннее, каждый удар идёт тремя срезами и почти без пауз' },
    saw: { name: 'Неоновая пила', short: 'Пила', text: 'Диск света в два роста катится вперёд и шинкует всё в коридоре на кубики' },
  };
  function useUlt() {
    if (S.ult < 1 || P.act || P.dead || S.paused || S.choosing || (S.mode !== 'play' && !S.arsenal)) return false;
    S.ult = 0; S.flash = 1; S.kick = 1; S.shake = Math.max(S.shake, 0.7);
    SFX.gong(); SFX.sheath();
    if (P.ultId === 'over') {
      P.over = S.real + 8.45; applyUps();
      P.act = { id: 'rise', t: 0, pose: 'leap', slow: 0.2, hidden: false, step: 0 }; P.invul = Math.max(P.invul, 0.8);
      for (let i = 0; i < 3; i++) TRAILS.add({ p: [P.x, 0.1 + i * 0.7, P.z], f: [1, 0, 0], s: [0, 0, 1], a0: -Math.PI, a1: Math.PI, r0: 0.3, r1: 1.2, T: 0.02, hold: 0, fade: 0.5, colA: style.trailA, colB: style.trailB, flame: 1, gain: 1.3, grow: 7 });
      FLARES.add(P.x, 1.5, P.z, style.trailA, 11, 1.0, 18, P); SCORCH.add(P.x, P.z, 3, 3, 6, 1); SFX.erupt();
      banner('Перегрузка');
    } else {
      const [ax, az] = aimDir();
      P.yaw = Math.atan2(ax, az); P.stance = 1;
      const w = { saw: true, x: P.x + ax * 1.5, z: P.z + az * 1.5, y: 1.55, ax, az, d: 0, max: 27, speed: 11, half: 1.8, top: 5.2, next: 0.4, kills: S.kills, flames: 5, tail: 0, trail: null, jobs: [], burn: 2.3 };
      const side = new T.Vector3(az, 0.05, -ax).normalize(), f = new T.Vector3(ax, 0, az);
      w.jobs.push({ n: side, d: side.x * w.x + side.y * 1.0 + side.z * w.z, u: f }); // one cut along the track, and three flat ones at different heights
      for (const h of [0.5, 1.15, 1.8, 2.9]) { const n = new T.Vector3(az * 0.07, 1, -ax * 0.07).normalize(); w.jobs.push({ n, d: n.x * w.x + n.y * h + n.z * w.z, u: f }); }
      w.trail = crescent({ x: w.x, y: w.y, z: w.z }, { x: 0, y: 1, z: 0 }, f, -Math.PI, Math.PI, 1.25, 3.05, 0.12, { hold: 30, fade: 0.4, gain: 1.7, flame: 1, follow: () => [w.x, w.y, w.z] });
      waves.push(w);
      SFX.wave();
      banner('Неоновая пила');
    }
    return true;
  }

  // ---- the wanderer takes a blow, or falls
  function hurt(dmg, fx, fz) {
    if (P.act && P.act.id === 'guard' && !P.dead) { // turned aside: whoever struck is thrown back on its heels
      let best = null, bd = 2.2;
      for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - fx, e.z - fz); if (d < bd) { bd = d; best = e; } }
      if (best && best.kind !== 'colossus') { best.state = 'stagger'; best.t = 0; }
      for (let k = 0; k < 10; k++) SPARKS.add(P.x + (fx - P.x) * 0.35, 1.2, P.z + (fz - P.z) * 0.35, (rnd() - 0.5) * 8, rnd() * 5, (rnd() - 0.5) * 8, style.spark[0], style.spark[1], style.spark[2], 1, 0.05, 0.35, 1.2, 9);
      blaze(P.x + (fx - P.x) * 0.35, 1.0, P.z + (fz - P.z) * 0.35, 5, 0.6, 4);
      SFX.parry(); S.shake = Math.max(S.shake, 0.4); S.kick = 0.6;
      return;
    }
    if (P.invul > 0 || P.dash > 0 || P.dead) return;
    P.hp -= dmg; P.invul = 0.7; S.hurtK = 1; S.shake = Math.max(S.shake, 0.6);
    const dx = P.x - fx, dz = P.z - fz, d = Math.hypot(dx, dz) || 1;
    P.kx = dx / d * 9; P.kz = dz / d * 9;
    SFX.hurt();
    if (P.hp <= 0) die();
  }
  function die() {
    P.hp = 0; P.dead = true; S.focusOn = false; P.act = null; P.y = 0; katana.visible = true; $('abils').hidden = true;
    const rig = P.rig;
    rig.root.updateMatrixWorld(true);
    for (const b of rig.list) {
      const world = [];
      for (const p of b.pieces) { const w = GEO.xf(p, b.matrixWorld.elements); if (w) world.push(w); }
      if (world.length) addBody(world, { time: S.time, v: [P.kx * 0.4 + (rnd() - 0.5) * 2, 1.5 + rnd() * 2.5, P.kz * 0.4 + (rnd() - 0.5) * 2], w: [(rnd() - 0.5) * 7, (rnd() - 0.5) * 7, (rnd() - 0.5) * 7] });
    }
    scene.remove(rig.root);
    katana.position.set(P.x, 0.72, P.z); katana.quaternion.setFromUnitVectors(UP, v1.set(0.12, -1, 0.08).normalize()); // left standing in the sand
    blaze(P.x, 0.8, P.z, 12, 1.2, 9);
    SFX.fall();
    S.mode = 'dead'; S.slowT = 1.2;
    if (S.wave > S.best) { S.best = S.wave; try { localStorage.setItem('blade-clay-best', String(S.best)); } catch (e) { /* storage may be closed */ } }
    setTimeout(() => {
      if (S.mode !== 'dead') return;
      const box = $('deadStats'), t = Math.floor(S.playT || 0);
      box.textContent = '';
      for (const [v, label] of [[S.wave, 'Волна'], [S.level, 'Уровень'], [S.kills, 'Сражено'], [S.parts, 'Кусков'], [Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'), 'Время'], [S.best || S.wave, 'Рекорд, волна']]) {
        const d = document.createElement('div'), n = document.createElement('b'), l = document.createElement('span');
        n.textContent = v; l.textContent = label; d.append(n, l); box.append(d);
      }
      show('dead');
    }, 1500);
  }

  // ---- waves
  function startWave(n) {
    S.wave = n; S.next = 0;
    const count = { grunt: Math.min(2 + n, 8), imp: n >= 2 ? Math.min(2 + (n - 1) * 2, 14) : 0, thrower: n >= 3 ? Math.min(Math.floor((n - 1) / 2), 4) : 0, brute: n >= 4 ? Math.min(Math.floor((n - 2) / 2), 4) : 0 };
    S.queue = [];
    for (const k in count) for (let i = 0; i < count[k]; i++) S.queue.splice(Math.floor(rnd() * (S.queue.length + 1)), 0, k);
    const giants = n % 5 === 0 ? n / 5 : 0;
    for (let i = 0; i < giants; i++) S.queue.push('colossus'); // taken from the end, so the colossus rises first
    S.spawnT = 0.9;
    banner(giants ? 'Волна ' + n + ': колосс' : 'Волна ' + n);
    SFX.gong();
  }
  function updateWaves(dt) {
    if (S.mode !== 'play') return;
    let alive = 0, load = 0;
    for (const e of enemies) if (!e.dead) { alive++; load += e.kind === 'imp' ? 0.5 : e.kind === 'colossus' ? 3 : 1; }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    if (S.queue.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0 && load < (TOUCH ? 8 : 11)) { const k = S.queue.pop(); spawnIdol(k); S.spawnT = k === 'imp' ? 0.2 + rnd() * 0.25 : 0.5 + rnd() * 0.5; }
    } else if (!alive && !S.next) { S.next = S.time + 2.6; P.hp = Math.min(P.maxHp, P.hp + 25); banner('Тишина'); }
    if (S.next && S.time >= S.next) startWave(S.wave + 1);
  }
  let bannerT = 0;
  function banner(text) { const el = $('banner'); el.textContent = text; el.classList.add('on'); bannerT = S.real + 1.7; }

  // ---- input
  const INK = [];
  let swipe = null, stick = null, focusBtn = false;
  const capture = (ev) => { try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* no such pointer */ } };
  const local = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  stage.addEventListener('contextmenu', (ev) => ev.preventDefault());
  // one stroke: press, move, lift. A sharp turn inside a long stroke ends one cut and starts the next, so scribbling chops.
  function press(id, x, y) { if (!swipe) swipe = { id, ax: x, ay: y, x, y, px: x, py: y, at: S.real, n: 0, nextTap: 0 }; }
  function cutStroke() { if (slash(swipe.ax, swipe.ay, swipe.x, swipe.y)) swipe.n++; swipe.ax = swipe.px = swipe.x; swipe.ay = swipe.py = swipe.y; }
  function move(id, x, y) {
    if (!swipe || swipe.id !== id) return;
    swipe.x = x; swipe.y = y; swipe.at = S.real;
    if (Math.hypot(x - swipe.ax, y - swipe.ay) > clamp(vh * 0.3, 150, 300)) { cutStroke(); return; } // long enough: do not wait for the button to come up
    const sx = x - swipe.px, sy = y - swipe.py, step = Math.hypot(sx, sy);
    if (step > 12) { // a sharp turn in the stroke ends one cut and begins the next
      const lx = swipe.px - swipe.ax, ly = swipe.py - swipe.ay, len = Math.hypot(lx, ly);
      if (len > 56 && (sx * lx + sy * ly) / (step * len) < 0.15) { if (slash(swipe.ax, swipe.ay, swipe.px, swipe.py)) swipe.n++; swipe.ax = swipe.px; swipe.ay = swipe.py; }
      swipe.px = x; swipe.py = y;
    }
  }
  function lift(id, x, y, commit) {
    if (!swipe || swipe.id !== id) return;
    // a click is a blow of the combo; the end of a stroke the frame has not caught up with is one last cut
    if (commit) { if (Math.hypot(x - swipe.ax, y - swipe.ay) < 16) { if (!swipe.n) tapSlash(x, y); } else slash(swipe.ax, swipe.ay, x, y); }
    swipe = null;
  }
  // fingers and pens come as pointers
  stage.addEventListener('pointerdown', (ev) => {
    SFX.start();
    if (ev.pointerType === 'mouse' || ev.target.closest('button') || S.mode !== 'play' || S.paused || S.choosing) return;
    ev.preventDefault();
    const [x, y] = local(ev);
    if (!stick && x < vw * 0.42 && y > vh * 0.3) { stick = { id: ev.pointerId, ox: x, oy: y, x: 0, y: 0 }; showStick(); capture(ev); return; }
    if (!swipe) { press(ev.pointerId, x, y); capture(ev); }
  });
  stage.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse') return;
    const [x, y] = local(ev);
    if (stick && ev.pointerId === stick.id) { const dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy), m = 56, k = d > m ? m / d : 1; stick.x = dx * k / m; stick.y = dy * k / m; showStick(); return; }
    move(ev.pointerId, x, y);
  });
  const release = (ev) => {
    if (ev.pointerType === 'mouse') return;
    if (stick && ev.pointerId === stick.id) { stick = null; showStick(); return; }
    const [x, y] = local(ev);
    lift(ev.pointerId, x, y, ev.type === 'pointerup');
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  // the mouse comes as mouse events, because a second button pressed while one is held makes no new pointer event:
  // the right button holds time slowed while the left one cuts
  stage.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('button') || S.mode !== 'play' || S.paused || S.choosing) return;
    ev.preventDefault();
    const [x, y] = local(ev);
    if (ev.button === 2) S.focusHeld = true;
    else if (ev.button === 0) press('mouse', x, y);
  });
  window.addEventListener('mousemove', (ev) => { const [x, y] = local(ev); mouse.x = x; mouse.y = y; mouse.seen = true; if (swipe && swipe.id === 'mouse') move('mouse', x, y); });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 2) S.focusHeld = false;
    else if (ev.button === 0) { const [x, y] = local(ev); lift('mouse', x, y, true); }
  });
  function showStick() {
    const el = $('stick');
    el.hidden = !stick;
    if (stick) { el.style.left = stick.ox + 'px'; el.style.top = stick.oy + 'px'; $('knob').style.transform = 'translate(' + stick.x * 40 + 'px,' + stick.y * 40 + 'px)'; }
  }
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    if (S.choosing) { const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(ev.code); if (i >= 0) choose(i % 3); return; }
    if (ev.code === 'KeyF' && S.sheet !== 'settings') fullScreen();
    if (ev.code === 'Tab' && S.sheet !== 'settings' && S.sheet !== 'controls') { ev.preventDefault(); if (S.sheet === 'arsenal') arsenal(false); else if (S.mode !== 'play') arsenal(true); else if (!P.dead) { if (!S.paused) pause(true); arsenal(true); } return; }
    if (S.sheet) { // a menu is up: arrows or W and S walk its items, Enter and space press the one in focus, Esc goes back
      const items = Array.from($(S.sheet).querySelectorAll('.list .item')), i = items.indexOf(document.activeElement);
      if (items.length && (ev.code === 'ArrowDown' || ev.code === 'KeyS')) { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (items.length && (ev.code === 'ArrowUp' || ev.code === 'KeyW')) { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (ev.code === 'Escape') { if (S.sheet === 'pause') pause(false); else if (S.sheet !== 'title' && S.sheet !== 'dead') back(); }
      return;
    }
    keys[ev.code] = true;
    const num = Math.max(KEYS.indexOf(ev.code), ['', '', '', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'].indexOf(ev.code));
    if (num >= 0) useAbility(num);
    if (ev.code === 'KeyR') useUlt();
    if (ev.code === 'Space') { ev.preventDefault(); dash(); }
    if ((ev.code === 'Escape' || ev.code === 'KeyP') && S.mode === 'play' && !P.dead) pause(true);
    if (ev.code.startsWith('Arrow')) ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; S.focusHeld = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') pause(true); });
  $('start').addEventListener('click', () => begin());
  $('again').addEventListener('click', () => begin());
  $('restart').addEventListener('click', () => begin());
  $('resume').addEventListener('click', () => pause(false));
  $('quit').addEventListener('click', toTitle);
  $('deadQuit').addEventListener('click', toTitle);
  $('deadArsenal').addEventListener('click', () => arsenal(true));
  for (const b of document.querySelectorAll('[data-open]')) b.addEventListener('click', () => show(b.dataset.open));
  for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', back);
  for (const b of document.querySelectorAll('.item')) b.addEventListener('pointerenter', () => b.focus({ preventScroll: true })); // the mouse and the keys share one highlight
  $('btnDash').addEventListener('pointerdown', (ev) => { ev.preventDefault(); dash(); });
  $('btnFocus').addEventListener('pointerdown', (ev) => { ev.preventDefault(); focusBtn = !focusBtn; });
  $('openArsenal').addEventListener('click', () => arsenal(true));
  $('pauseArsenal').addEventListener('click', () => arsenal(true));
  $('arsenalDone').addEventListener('click', () => arsenal(false));
  $('fullBtn').addEventListener('click', fullScreen);
  function fullScreen() { // a browser may refuse; then nothing happens
    try { if (document.fullscreenElement) document.exitFullscreen(); else { const r = document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(() => {}); } } catch (e) { /* not allowed here */ }
  }
  // where the mouse points on the ground, or null
  function mouseGround() {
    if (!mouse.seen || TOUCH) return null;
    camera.updateMatrixWorld(); dirAt(mouse.x, mouse.y, d0);
    if (d0.y > -0.02) return null;
    const t = -camera.position.y / d0.y;
    return [camera.position.x + d0.x * t, camera.position.z + d0.z * t];
  }
  stage.addEventListener('wheel', (ev) => { ev.preventDefault(); S.zoom = clamp(S.zoom * (ev.deltaY > 0 ? 1.08 : 0.925), 0.68, 1.45); }, { passive: false });
  // ---- screens: one sheet at a time over the picture
  const SHEETS = ['title', 'pause', 'settings', 'controls', 'arsenal', 'dead'];
  function show(id) {
    for (const k of SHEETS) $(k).hidden = k !== id;
    S.sheet = id || null;
    document.body.classList.toggle('menu-up', !!id);
    if (id) { const b = $(id).querySelector('.list .item'); if (b) b.focus({ preventScroll: true }); }
  }
  const home = () => (S.mode === 'title' ? 'title' : S.mode === 'dead' ? 'dead' : S.paused ? 'pause' : null); // the sheet a sub-screen goes back to
  function back() { if (S.sheet === 'arsenal') arsenal(false); else show(home()); }
  function pause(on) {
    S.paused = on; swipe = null; stick = null; showStick();
    for (const k in keys) keys[k] = false;
    S.focusHeld = false;
    if (on) $('pauseLine').textContent = 'Волна ' + S.wave + ' · уровень ' + S.level + ' · сражено ' + S.kills;
    show(on ? 'pause' : null);
  }
  function bestLine() { $('bestLine').textContent = S.best ? 'Рекорд: волна ' + S.best : 'Первый забег впереди'; }
  function toTitle() {
    clearWorld(); buildProps(); resetUps(); newHero();
    waves.length = 0; P.over = 0; katana.visible = true;
    Object.assign(S, { mode: 'title', paused: false, choosing: false, choice: null, pending: 0, arsenal: false, demoQ: null, focusOn: false, scale: 1, slowT: 0, stop: 0, queue: [], next: 0, ult: 0, flash: 0 });
    $('hud').hidden = true; $('abils').hidden = true; $('levelup').hidden = true; $('hint').classList.add('gone'); $('banner').classList.remove('on');
    bestLine(); show('title');
  }
  // ---- settings, kept between visits
  const OPT = { sfx: 80, music: 45, gfx: TOUCH ? 'mid' : 'high', shake: 100, flash: true };
  try {
    const j = JSON.parse(localStorage.getItem('blade-neon-settings') || 'null') || {};
    for (const k of ['sfx', 'music', 'shake']) if (typeof j[k] === 'number' && j[k] >= 0 && j[k] <= 100) OPT[k] = j[k];
    if (['low', 'mid', 'high'].indexOf(j.gfx) >= 0) OPT.gfx = j.gfx;
    if (typeof j.flash === 'boolean') OPT.flash = j.flash;
  } catch (e) { /* storage may be closed */ }
  let bloomBase = 0.72;
  function setQuality(q) { // high: the wet mirror and full sharpness; mid: dry street; low: fewer pixels and no shadows
    const hi = q === 'high', lo = q === 'low';
    pr = Math.min(window.devicePixelRatio || 1, hi ? 2 : lo ? 1 : 1.5) * (lo ? 0.8 : 1);
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
    W.setMirror(hi);
    renderer.shadowMap.enabled = !lo; W.sun.castShadow = !lo;
    bloomBase = lo ? 0.5 : 0.72;
    vw = 0; resize();
  }
  function applyOpt(save) {
    SFX.volume(OPT.sfx / 100); SFX.musicVolume(OPT.music / 100);
    setQuality(OPT.gfx);
    for (const [id, k] of [['optSfx', 'sfx'], ['optMusic', 'music'], ['optShake', 'shake']]) { $(id).value = OPT[k]; $(id + 'Out').textContent = OPT[k] + '%'; }
    for (const b of $('optGfx').children) b.setAttribute('aria-pressed', String(b.dataset.v === OPT.gfx));
    for (const b of $('optFlash').children) b.setAttribute('aria-pressed', String((b.dataset.v === '1') === OPT.flash));
    if (save) try { localStorage.setItem('blade-neon-settings', JSON.stringify(OPT)); } catch (e) { /* storage may be closed */ }
  }
  for (const [id, k] of [['optSfx', 'sfx'], ['optMusic', 'music'], ['optShake', 'shake']]) $(id).addEventListener('input', () => { OPT[k] = +$(id).value; applyOpt(true); if (k === 'sfx') SFX.swing(); });
  for (const b of $('optGfx').children) b.addEventListener('click', () => { OPT.gfx = b.dataset.v; quality = 0; applyOpt(true); });
  for (const b of $('optFlash').children) b.addEventListener('click', () => { OPT.flash = b.dataset.v === '1'; applyOpt(true); });
  const DASH_T = 0.17; // a dash: a long, fast slide the way he is running, or toward the cursor if he stands; nothing can hurt him in it
  function dash() {
    if (P.dead || P.dashCd > 0 || S.paused || P.act) return;
    let dx = P.dx, dz = P.dz;
    if (!(P.speed > 0.5)) { const at = mouseGround(), l = at ? Math.hypot(at[0] - P.x, at[1] - P.z) : 0; if (l > 0.5) { dx = (at[0] - P.x) / l; dz = (at[1] - P.z) / l; } else { dx = Math.sin(P.yaw); dz = Math.cos(P.yaw); } }
    P.dash = DASH_T; P.dashCd = P.dashGap; P.ddx = dx; P.ddz = dz; P.sx0 = P.x; P.sz0 = P.z; P.invul = Math.max(P.invul, DASH_T + 0.12);
    P.sw = null; P.queue = null; P.lunge = null; P.ghostAt = 0; S.kick = Math.max(S.kick, 0.5);
    ghostAt(P.x, P.z, Math.atan2(dx, dz), 0.3);
    SFX.dash();
    fireLine(P.x, P.z, P.x + dx * P.dashLen, P.z + dz * P.dashLen, Math.ceil(P.dashLen * 2), 0.6 + 0.4 * P.heat, 0.45, DASH_T, 0.25);
    SCORCH.add(P.x + dx * P.dashLen / 2, P.z + dz * P.dashLen / 2, P.dashLen / 2 + 0.2, 0.3, 2.4, 0.85, dx, dz);
    for (let i = 0; i < 6; i++) DUST.add(P.x, 0.15, P.z, -dx * 2 + (rnd() - 0.5) * 2, 0.5 + rnd(), -dz * 2 + (rnd() - 0.5) * 2, 0.3, 0.34, 0.52, 0.2, 0.36, 0.6, 2, -0.2);
  }
  function begin(fixedSeed) {
    SFX.start();
    clearWorld(); buildProps(); resetUps(); newHero();
    waves.length = 0; for (const id of ABIL_IDS) P.cd[id] = 0;
    P.over = 0; S.ult = 0;
    katana.visible = true; $('abils').hidden = false;
    Object.assign(S, { arsenal: false, demoQ: null, flash: 0, xp: 0, level: 1, need: 8, pending: 0, choosing: false, choice: null, mode: 'play', time: 0, scale: 1, stop: 0, slowT: 0, focusOn: false, focusLock: false, wave: 0, queue: [], next: 0, kills: 0, parts: 0, paused: false, hurtK: 0, cutOnce: false });
    seed = typeof fixedSeed === 'number' ? fixedSeed : (Date.now() & 0xffffff) | 1; focusBtn = false;
    show(null); $('levelup').hidden = true; $('hud').hidden = false; $('hint').classList.remove('gone'); S.playT = 0;
    startWave(1);
  }

  // ---- the arsenal: the style of the blade and the two techniques worn, kept between visits
  // The seven techniques, in the order of their keys: the whirl first, under Q; then the quick ones; the long ones further along.
  const ORDER = ['spin', 'wave', 'fan', 'iai', 'leap', 'guard', 'storm'];
  // their keys: around the left hand and the numbers above it; R, in the middle of them, is the ultimate
  const KEYS = ['KeyQ', 'KeyE', 'KeyT', 'Digit1', 'Digit2', 'Digit3', 'Digit4'], KEY_NAMES = ['Q', 'E', 'T', '1', '2', '3', '4'];
  const LOAD = { style: 'ember', ult: 'over' };
  try {
    const j = JSON.parse(localStorage.getItem('blade-clay-loadout') || 'null');
    if (j && STYLES.some((s) => s.id === j.style)) LOAD.style = j.style;
    if (j && ULTS[j.ult]) LOAD.ult = j.ult;
  } catch (e) { /* storage may be closed */ }
  function applyLoad(save) {
    setStyle(LOAD.style); P.slots = ORDER.slice(); P.ultId = LOAD.ult;
    if (save) try { localStorage.setItem('blade-clay-loadout', JSON.stringify(LOAD)); } catch (e) { /* storage may be closed */ }
    drawArsenal(); hudKey = '';
  }
  function drawArsenal() {
    const fill = (box, items, cur, pick, about, idle) => {
      box.textContent = '';
      const say = (it) => { $(about).textContent = it ? it.text + (it.cd && COOL ? '. Перезарядка ' + String(it.cd).replace('.', ',') + ' с.' : '.') : idle; };
      say(items.find((x) => x.id === cur));
      for (const it of items) {
        const b = document.createElement('button'), nm = document.createElement('b');
        b.type = 'button'; b.className = 'opt'; b.dataset.id = it.id;
        if (cur !== null) b.setAttribute('aria-pressed', String(it.id === cur));
        if (it.css) { const sw = document.createElement('i'); sw.style.background = it.css; b.append(sw); }
        if (it.key) { const k = document.createElement('kbd'); k.textContent = it.key; b.append(k); }
        nm.textContent = it.name;
        b.append(nm);
        b.addEventListener('click', () => pick(it.id));
        b.addEventListener('pointerenter', () => say(it));
        b.addEventListener('pointerleave', () => say(items.find((x) => x.id === cur)));
        box.append(b);
      }
    };
    fill($('optStyle'), STYLES, LOAD.style, (id) => { LOAD.style = id; applyLoad(true); demo('style'); }, 'aboutStyle', '');
    fill($('optUlt'), Object.keys(ULTS).map((id) => Object.assign({ id }, ULTS[id])), LOAD.ult, (id) => { LOAD.ult = id; applyLoad(true); demo('ult'); }, 'aboutUlt', '');
    // the techniques are not chosen, they are all there: this shelf is for reading about them and trying them
    fill($('optTech'), ORDER.map((id, i) => Object.assign({ id, key: KEY_NAMES[i] }, ABIL[id])), null, (id) => demo(ORDER.indexOf(id)), 'aboutTech', 'Все семь всегда с тобой. Наведи, чтобы прочитать; нажми, чтобы увидеть на синтете.');
  }
  // the bar at the bottom: a chip for each technique with its key, and one for the ultimate
  function buildBar() {
    const box = $('abils');
    box.textContent = '';
    const chip = (i, key, ult) => {
      const b = document.createElement('button'), k = document.createElement('kbd'), n = document.createElement('span'), sh = document.createElement('i');
      b.type = 'button'; b.className = ult ? 'abil ult' : 'abil'; b.id = 'abil' + i; k.textContent = key; n.id = 'abilName' + i; sh.id = 'abilCd' + i;
      b.append(k, n, sh);
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); if (ult) useUlt(); else useAbility(i); });
      box.append(b);
    };
    ORDER.forEach((id, i) => chip(i, KEY_NAMES[i], false));
    chip('U', 'R', true);
  }
  // On the title screen the arsenal comes with a practice idol, and every choice is shown on it at once.
  function arsenal(on) {
    S.arsenal = on && S.mode === 'title';
    if (on) show('arsenal');
    else {
      if (S.mode === 'title') { for (const e of enemies) if (!e.dead) { e.dead = true; scene.remove(e.rig.root); MODELS.dispose(e.rig); } enemies.length = 0; S.demoQ = null; }
      show(home());
    }
    if (S.arsenal) { S.dummyAt = 0; dummy(); }
  }
  function dummy() {
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    const e = spawnIdol('grunt');
    e.x = P.x + 2.1; e.z = P.z - 0.8; e.dummy = true; e.riseT = 0.5; e.speed = 0; e.range = -1; e.yaw = Math.atan2(P.x - e.x, P.z - e.z);
    e.rig.root.position.set(e.x, -2 * e.scale, e.z);
    return e;
  }
  function demo(what) {
    if (!S.arsenal || P.act) return;
    const e = enemies.find((x) => !x.dead);
    if (e && Math.hypot(e.x - P.x, e.z - P.z) > 6) { P.x = e.x - 2.1; P.z = e.z + 0.8; }
    if (what === 'style') { const at = e ? [e.x, e.z] : [P.x + 2.4, P.z - 0.9]; S.demoQ = [0.05, 0.4, 0.8].map((t) => [S.real + t, at]); }
    else if (what === 'ult') { S.demoQ = null; P.over = 0; applyUps(); S.ult = 1; useUlt(); if (P.over) S.demoQ = [0.4, 0.8, 1.2].map((t) => [S.real + t, e ? [e.x, e.z] : [P.x + 2.4, P.z - 0.9]]); }
    else { P.cd[P.slots[what]] = 0; S.demoQ = null; useAbility(what); }
  }
  function updateDemo() {
    if (!S.arsenal) return;
    if (S.demoQ && S.demoQ.length && S.real >= S.demoQ[0][0] && !P.lunge) {
      const at = S.demoQ.shift()[1];
      camera.updateMatrixWorld();
      pj.set(at[0], 1.05, at[1]).project(camera);
      tapSlash((pj.x * 0.5 + 0.5) * vw, (0.5 - pj.y * 0.5) * vh);
    }
    if (!enemies.some((e) => !e.dead)) { if (!S.dummyAt) S.dummyAt = S.real + 1.3; else if (S.real >= S.dummyAt) { S.dummyAt = 0; dummy(); } }
  }

  // ---- per frame
  function updateHero(dt) {
    if (P.dead) return;
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz -= 1;
    if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (stick) { mx += stick.x; mz += stick.y; }
    if ((P.act && !P.act.free) || S.mode !== 'play') { mx = 0; mz = 0; }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    P.invul = Math.max(0, P.invul - dt); P.dashCd = Math.max(0, P.dashCd - dt);
    let vx = 0, vz = 0;
    if (P.lunge) {
      const l = P.lunge; l.t += dt;
      const k = Math.min(1, l.t / l.T);
      P.x = lerp(l.x0, l.x1, k); P.z = lerp(l.z0, l.z1, k);
      if (rnd() < 0.7) DUST.add(P.x, 0.12, P.z, (rnd() - 0.5), 0.4 + rnd() * 0.6, (rnd() - 0.5), 0.3, 0.34, 0.52, 0.16, 0.32, 0.5, 2, -0.2);
      if (k >= 1) { P.lunge = null; strike(l.job); }
      P.speed = 12;
    } else if (P.dash > 0) {
      const sp = P.dashLen / DASH_T, step = Math.min(dt, P.dash); // exactly its length, whatever the frame rate
      P.dash -= dt; vx = P.ddx * sp * step / dt; vz = P.ddz * sp * step / dt; P.speed = 12; P.vx = P.ddx * P.run; P.vz = P.ddz * P.run;
      if (S.real >= (P.ghostAt || 0)) { P.ghostAt = S.real + 0.035; GHOSTS.add(bake(P.rig), style.ghost, 0.22); }
      if (P.dash <= 0 && P.up.whirl) { P.x += vx * dt; P.z += vz * dt; vx = vz = 0; whirl(); }
      P.yaw = Math.atan2(P.ddx, P.ddz);
    } else {
      // the feet answer at once but without a jerk: speed eases in and out over a few frames, and a cut barely slows them
      const sp = P.run * (P.sw && P.sw.t < P.sw.T ? 0.8 : 1) * (P.act && P.act.free ? P.act.move || 0.55 : 1), k = 1 - Math.exp(-dt * (ml > 0.1 ? 18 : 13));
      P.vx = lerp(P.vx, mx * sp, k); P.vz = lerp(P.vz, mz * sp, k);
      vx = P.vx; vz = P.vz;
      P.speed = Math.hypot(vx, vz);
      if (ml <= 0.15 && !P.sw && !P.act && S.mode === 'play') { const at = mouseGround(); if (at && Math.hypot(at[0] - P.x, at[1] - P.z) > 0.8) { let da = Math.atan2(at[0] - P.x, at[1] - P.z) - P.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); P.yaw += da * (1 - Math.exp(-dt * 9)); } }
      if (ml > 0.15) { P.dx = mx / ml; P.dz = mz / ml; if (!P.sw) { let da = Math.atan2(mx, mz) - P.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); P.yaw += da * (1 - Math.exp(-dt * 16)); } }
    }
    P.kx *= Math.exp(-dt * 7); P.kz *= Math.exp(-dt * 7);
    P.x += (vx + P.kx) * dt; P.z += (vz + P.kz) * dt;
    P.phase += dt * P.speed * 1.75;
    pushOut(P, 0.36);
    const r = Math.hypot(P.x, P.z);
    if (r > ARENA) { P.x *= ARENA / r; P.z *= ARENA / r; }
    if (P.queue && S.real >= P.nextSlash && !P.lunge) { const q = P.queue; P.queue = null; if (S.real - q[4] < 0.25) slash(q[0], q[1], q[2], q[3], q[5], q[6]); }
  }
  function updateBodies(dt) {
    if (dt > 0) { const h = dt / 2; PHYS.step(bodies, h, S.time - h); PHYS.step(bodies, h, S.time); }
    let loose = 0, oldest = null;
    for (const b of bodies) {
      if (b.burn > S.time && rnd() < dt * 40 * style.flame) flame(b.x + (rnd() - 0.5) * b.radius, b.y + (rnd() - 0.4) * b.radius * 0.8, b.z + (rnd() - 0.5) * b.radius);
      if (b.anchored) continue;
      if (!b.asleep) { b.mesh.position.set(b.x, b.y, b.z); b.mesh.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]); b.restAt = 0; }
      else if (!b.restAt) b.restAt = S.time;
      if (b.hit > 2.4) { SFX.thud(b.hit * Math.min(1, 0.3 + b.vol * 30)); if (b.hit > 4.5 && b.vol > 0.008 && rnd() < 0.7) DUST.add(b.x, 0.1, b.z, (rnd() - 0.5) * 1.6, 0.4 + rnd() * 0.5, (rnd() - 0.5) * 1.6, 0.3, 0.34, 0.52, 0.18, 0.28 + b.radius * 0.4, 0.7, 2, -0.2); }
      b.hit = 0;
      if (b.gone) continue;
      loose++;
      if (b.asleep && (!oldest || b.restAt < oldest.restAt)) oldest = b;
      if (b.asleep && S.time - b.restAt > (b.vol < 0.004 ? 9 : 24)) b.gone = S.real;
    }
    if (loose > MAX_PARTS) { // too much rubble: the oldest goes first, a few each frame; in a flood even what is still moving goes
      const over = loose - MAX_PARTS, flood = over > MAX_PARTS * 0.4;
      const old = bodies.filter((b) => !b.anchored && !b.gone && b.kind === 'part' && (b.asleep || flood)).sort((p, q) => p.born - q.born);
      for (let i = 0; i < Math.min(over, flood ? 24 : 8, old.length); i++) old[i].gone = S.real;
    }
    for (const b of bodies.slice()) {
      if (!b.gone) continue;
      if (b.gone === 1) { removeBody(b); continue; } // fell out of the world
      const k = (S.real - b.gone) / 0.5;
      if (k >= 1) removeBody(b);
      else { b.mesh.scale.setScalar(1 - k * k); b.mesh.position.y = b.y - k * 0.2; }
    }
  }
  const camAt = new T.Vector3(0, 1, 0), camVel = new T.Vector3();
  function updateCamera(dt) {
    const f = S.focusK, tall = camera.aspect < 0.9, ox = S.arsenal ? (tall ? 1.2 : -3.4) : 0, oz = S.arsenal && tall ? 6.6 : 0;
    const pitch = lerp(0.62, 0.31, f), dist = lerp(11.4, 7.6, f) * (tall ? 1.3 : 1);
    // The camera looks at where he is going, not where he is: the moment a lunge or a leap begins it sets off for the far end, so it is
    // already moving when he gets there. It is carried by a spring, so it gathers speed and sheds it and never jumps.
    let tx = P.x, tz = P.z;
    if (P.lunge) { tx = P.lunge.x1; tz = P.lunge.z1; }
    else if (P.dash > 0) { tx = P.x + P.ddx * P.dashLen * P.dash / DASH_T; tz = P.z + P.ddz * P.dashLen * P.dash / DASH_T; }
    else if (P.act && P.act.x1 != null && !P.act.landed) { tx = P.act.x1; tz = P.act.z1; }
    const lead = 0.14 * (1 - f) * (P.lunge || P.act ? 0 : 1);
    v1.set(tx + ox + clamp(P.vx, -7, 7) * lead, 1.0 + 0.35 * f, tz + oz + clamp(P.vz, -7, 7) * lead);
    const om = 2 / 0.15, xk = om * dt, ex = 1 / (1 + xk + 0.48 * xk * xk + 0.235 * xk * xk * xk);
    for (const ax of ['x', 'y', 'z']) { const ch = camAt[ax] - v1[ax], tmp = (camVel[ax] + om * ch) * dt; camVel[ax] = (camVel[ax] - om * tmp) * ex; camAt[ax] = v1[ax] + (ch + tmp) * ex; }
    S.kick = Math.max(0, S.kick - dt * 6); S.kickS = lerp(S.kickS || 0, S.kick, 1 - Math.exp(-dt * 22)); // the punch-in eases on too
    S.shake = Math.max(0, S.shake - dt * 2.4);
    const sh = S.shake * S.shake * 0.5 * (OPT.shake / 100), wob = Math.sin(S.real * 78) * sh * 0.9, kd = dist * (1 - 0.06 * S.kickS) * S.zoom;
    camera.position.set(camAt.x + (rnd() - 0.5) * sh * 0.6 + S.shx * wob, camAt.y + Math.sin(pitch) * kd + (rnd() - 0.5) * sh * 0.6, camAt.z + Math.cos(pitch) * kd + S.shz * wob);
    camera.lookAt(camAt.x, camAt.y + 0.3 * f, camAt.z);
    const fov = (tall ? 54 : 40) - 2.2 * S.kickS;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    W.follow(P.x, P.z);
  }
  const hud = { hp: $('hp'), focus: $('focus'), xp: $('xp'), level: $('level'), wave: $('wave'), kills: $('kills'), parts: $('parts') };
  let hudKey = '';
  function updateHud() {
    const key = [P.ultId, Math.round(S.ult * 50), !!P.over, Math.round(P.heat * 40), ORDER.map((id) => Math.ceil(P.cd[id] * 10)).join('.'), Math.round(P.hp), P.maxHp, Math.round(P.focus * 50), S.xp, S.level, S.wave, S.kills, S.parts, S.focusOn, focusBtn].join();
    if (key === hudKey) return;
    hudKey = key;
    hud.hp.style.transform = 'scaleX(' + clamp(P.hp / P.maxHp, 0, 1) + ')';
    hud.focus.style.transform = 'scaleX(' + clamp(P.focus, 0, 1) + ')';
    $('heat').style.transform = 'scaleX(' + clamp(P.heat, 0, 1) + ')'; $('heat').classList.toggle('full', P.heat > 0.97);
    hud.xp.style.transform = 'scaleX(' + clamp(S.xp / S.need, 0, 1) + ')';
    hud.level.textContent = S.level; hud.wave.textContent = S.wave; hud.kills.textContent = S.kills; hud.parts.textContent = S.parts;
    for (let k = 0; k < ORDER.length; k++) { const id = ORDER[k], cd = P.cd[id]; $('abilName' + k).textContent = ABIL[id].short; $('abilCd' + k).style.transform = 'scaleY(' + clamp(cd / ABIL[id].cd, 0, 1) + ')'; $('abil' + k).classList.toggle('wait', cd > 0); }
    $('abilNameU').textContent = ULTS[P.ultId].short; $('abilCdU').style.transform = 'scaleY(' + (1 - clamp(S.ult, 0, 1)) + ')'; $('abilU').classList.toggle('wait', S.ult < 1); $('abilU').classList.toggle('ready', S.ult >= 1); document.body.classList.toggle('over', !!P.over);
    document.body.classList.toggle('focus', S.focusOn);
    $('btnFocus').setAttribute('aria-pressed', String(focusBtn));
  }
  const ik = ink.getContext('2d');
  function drawInk(dt) {
    ik.setTransform(PR, 0, 0, PR, 0, 0);
    ik.clearRect(0, 0, vw, vh);
    ik.lineCap = 'round';
    const line = (ax, ay, bx, by, a, w) => {
      ik.globalAlpha = a * 0.4; ik.strokeStyle = style.css; ik.lineWidth = w * 4; ik.beginPath(); ik.moveTo(ax, ay); ik.lineTo(bx, by); ik.stroke();
      ik.globalAlpha = a; ik.strokeStyle = '#fff6ea'; ik.lineWidth = w; ik.beginPath(); ik.moveTo(ax, ay); ik.lineTo(bx, by); ik.stroke();
      ik.globalAlpha = 1;
    };
    for (let i = INK.length - 1; i >= 0; i--) { const l = INK[i]; l.t += dt; const k = 1 - l.t / 0.28; if (k <= 0) INK.splice(i, 1); else line(l.ax, l.ay, l.bx, l.by, k * 0.9, 1 + k * 2.5); }
    if (swipe && Math.hypot(swipe.x - swipe.ax, swipe.y - swipe.ay) > 8) line(swipe.ax, swipe.ay, swipe.x, swipe.y, 0.75, 2);
  }
  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 0.9 ? 54 : 40; camera.updateProjectionMatrix();
    ink.width = Math.round(w * PR); ink.height = Math.round(h * PR);
    const scale = h * pr / (2 * Math.tan(camera.fov * Math.PI / 360));
    SPARKS.mat.uniforms.uScale.value = scale; DUST.mat.uniforms.uScale.value = scale;
  }
  let last = 0, slowFrames = 0, quality = 0;
  function lowerQuality() { // a machine that cannot keep up is moved one preset down; the choice in the settings is not overwritten
    quality++;
    OPT.gfx = OPT.gfx === 'high' ? 'mid' : 'low';
    applyOpt(false);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    const raw = (now - last) / 1000, dtR = Math.min(0.05, Math.max(0.001, raw));
    last = now;
    if (S.mode === 'play' && !S.paused && quality < 2 && raw < 0.5) { slowFrames = raw > 0.03 ? slowFrames + 1 : Math.max(0, slowFrames - 2); if (slowFrames > 100) { slowFrames = 0; lowerQuality(); } }
    if (S.paused || S.choosing) { composer.render(); return; }
    step(dtR);
    composer.render();
  }
  function step(dtR) {
    if (S.choosing) return; // the world waits while a lesson is chosen
    S.real += dtR;
    if (S.mode === 'play' && !P.dead) S.playT += dtR;
    const fight = S.mode === 'play' && !P.dead && enemies.some((e) => !e.dead) ? 1 : 0;
    if (fight !== S.heat) { S.heat = fight; SFX.music(fight); }
    // slowed time: held on purpose while there is focus left, and for a breath after a kill
    const wantFocus = (S.focusHeld || keys.ShiftLeft || keys.ShiftRight || focusBtn) && S.mode === 'play' && !P.dead;
    if (!wantFocus) S.focusLock = false;
    const on = wantFocus && !S.focusLock && P.focus > 0;
    if (on !== S.focusOn) { S.focusOn = on; SFX.focus(on); }
    if (S.focusOn) { P.focus -= dtR * P.drain; if (P.focus <= 0) { P.focus = 0; S.focusLock = true; focusBtn = false; } }
    else if (S.mode === 'play') P.focus = Math.min(1, P.focus + dtR * 0.045);
    S.slowT = Math.max(0, S.slowT - dtR);
    const still = P.act && P.act.slow != null; // a technique that stops the world
    const target = still ? P.act.slow : S.focusOn ? 0.1 : S.slowT > 0 ? 0.28 : 1;
    S.scale = lerp(S.scale, target, 1 - Math.exp(-dtR * (target < S.scale ? 30 : 7)));
    S.focusK = lerp(S.focusK, S.focusOn || still ? 1 : 0, 1 - Math.exp(-dtR * 9));
    if ((S.scale < 0.5) !== S.muffled) { S.muffled = S.scale < 0.5; SFX.slow(S.scale); }
    let dt = dtR * S.scale;
    if (S.stop > 0) { S.stop -= dtR; dt = 0; }
    S.time += dt;
    SHARED.uTime.value = S.time;
    if (S.mode !== 'title' || S.arsenal) {
      if (swipe) {
        const len = Math.hypot(swipe.x - swipe.ax, swipe.y - swipe.ay), still = S.real - swipe.at;
        if (still > 0.1 && len > 36) cutStroke(); // a stroke that has stopped is a cut already
        else if (still > 0.07 && len <= 36 && S.real >= swipe.nextTap && !P.lunge && !P.act) { // held in one place: blow after blow at whatever is under the cursor
          swipe.ax = swipe.px = swipe.x; swipe.ay = swipe.py = swipe.y;
          tapSlash(swipe.x, swipe.y); swipe.n++; swipe.nextTap = S.real + 0.27;
        }
      }
      updateDemo();
      if (P.over) { // overloaded: light pours off him, and it ends on the clock
        if (S.real >= P.over || P.dead) { P.over = 0; applyUps(); }
        else { if (S.real >= P.auraAt) { P.auraAt = S.real + 0.5; TRAILS.add({ p: [P.x, 0.08, P.z], f: [1, 0, 0], s: [0, 0, 1], a0: -Math.PI, a1: Math.PI, r0: 0.3, r1: 0.9, T: 0.02, hold: 0, fade: 0.5, colA: style.trailA, colB: style.trailB, flame: 1, gain: 0.9, grow: 5 }); }
          if (P.speed > 2 && rnd() < dtR * 16) GHOSTS.add(bake(P.rig), style.ghost, 0.22); if (rnd() < dtR * 40) flame(katana.position.x + (rnd() - 0.5) * 0.4, katana.position.y + rnd() * 1.2, katana.position.z + (rnd() - 0.5) * 0.4); }
      }
      updateAct(dtR);
      updateFlying(dtR * Math.max(S.scale, 0.35));
      updateHero(dtR * (S.focusOn ? 0.8 : 1));
      updateBolts(dt);
      if (!P.dead) poseHero(dtR);
      updateIdols(dt);
      updateWaves(dt);
    } else poseHero(dtR);
    updateBodies(dt);
    if (S.real - P.heatAt > 1.3) P.heat = Math.max(0, P.heat - dtR * 0.2); // left alone, the fire dies back down
    burnBlade(dtR); burnHero(dtR);
    const dtF = dtR * Math.max(S.scale, 0.3); // fire slows with the world, but never stands still
    S.fireT = (S.fireT || 0) + dtF;
    SWEEP.step(S.real, P.over ? 0.36 : 0.27); FIRES.step(dtF, S.fireT); FLARES.step(dtF, S.real); SCORCH.step(dtF, S.fireT);
    S.glow = lerp(S.glow || 0, Math.min(1, P.heat + (P.over ? 0.5 : 0)) * (S.mode === 'play' ? 1 : 0.4), 1 - Math.exp(-dtR * 4));
    grade.uniforms.fire.value = S.glow; bloom.strength = bloomBase * (1 + 0.22 * S.glow) + (OPT.flash ? S.flash * 0.25 : 0);
    SPARKS.step(dt + dtR * 0.02); DUST.step(dt); TRAILS.step(dtR, S.real); STREAKS.step(dtR, camera); GHOSTS.step(dtR);
    updateCamera(dtR);
    S.hurtK = Math.max(0, S.hurtK - dtR * 1.8);
    grade.uniforms.hurt.value = Math.max(S.hurtK, P.hp < 30 && !P.dead ? 0.25 + 0.12 * Math.sin(S.real * 5) : 0);
    grade.uniforms.calm.value = S.focusK;
    S.flash = Math.max(0, S.flash - dtR * 7);
    grade.uniforms.flash.value = CALM_MOTION || !OPT.flash ? 0 : S.flash;
    grade.uniforms.ab.value = CALM_MOTION ? 0.0015 : 0.0022 + S.shake * S.shake * 0.02 * (OPT.shake / 100) + (OPT.flash ? S.flash * 0.012 : 0) + S.focusK * 0.003;
    grade.uniforms.uT.value = S.real % 10;
    W.step(dtR, camAt.x, camAt.z);
    const at = S.mode === 'play' && !P.dead ? mouseGround() : null;
    reticle.visible = !!at;
    if (at) { reticle.position.set(at[0], 0.05, at[1]); reticle.scale.setScalar(1 + 0.08 * Math.sin(S.real * 6)); }
    if (bannerT && S.real > bannerT) { $('banner').classList.remove('on'); bannerT = 0; }
    // a new lesson is offered between waves, never in the middle of a fight
    if (S.pending > 0 && S.mode === 'play' && !P.dead && S.slowT <= 0 && S.stop <= 0 && !S.queue.length && !enemies.some((e) => !e.dead)) openChoice();
    updateHud();
    drawInk(dtR);
  }

  // the title screen shows the place with a few things to look at
  buildBar();
  buildProps(); resetUps(); newHero(); applyLoad(false); applyOpt(false); bestLine(); show('title');
  P.rig.root.visible = true;
  resize();
  window.__game = { renderer, S, P, bodies, enemies, slash, tapSlash, begin, step, camera, spawnIdol, dash, hurt, gainXp, choose, applyUps, UPS, KINDS, FIRES, SWEEP, COOL, show, pause, toTitle, OPT, applyOpt, reticle, useAbility, useUlt, cast: (id) => useAbility(ORDER.indexOf(id)), ORDER, arsenal, ABIL, ULTS, STYLES, LOAD, applyLoad, waves, bolts, W, noMouse: () => { mouse.seen = false; }, frame: () => composer.render(), setFocus: (v) => { focusBtn = v; }, canvas };
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
