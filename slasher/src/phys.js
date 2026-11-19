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
