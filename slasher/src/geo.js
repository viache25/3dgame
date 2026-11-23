// Convex pieces. A piece is a closed convex solid kept as face loops, so a plane cut is exact and what comes out can be cut again.
// piece = { faces: [{ p: [x,y,z,...], n: [x,y,z], d, cap, heat, col }], pts: [x,y,z,...], c: [x,y,z], vol, r, inner, glow, tag }
//   cap  < 0: skin. cap >= 0: the time this face was cut open (it glows from then). cap >= GEO.PERM: glows for good (eyes). cap >= GEO.BLADE: glows for good in the colour of the blade.
var GEO = (function () {
  const EPS = 1e-5, PERM = 1e6, BLADE = 2e6;

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

  return { EPS, PERM, BLADE, finish, lathe, box, xf, place, shifted, side, split, touching, cutSet, normalOf };
})();
if (typeof module !== 'undefined') module.exports = GEO;
