// Everything with a shape is built here from numbers: fish, the shark, the boat with its angler and rod. Forward is -z.
function triGeo(pos, col) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
// A body lofted through oval rings. st: [{z, rx, ry, y}], paint(t along, up -1..1) -> T.Color
function loft(st, n, paint) {
  const pos = [], col = [];
  const put = (k, i) => { const s = st[k], a = i / n * Math.PI * 2, c = paint(k / (st.length - 1), Math.cos(a)); pos.push(Math.sin(a) * s.rx, (s.y || 0) + Math.cos(a) * s.ry, s.z); col.push(c.r, c.g, c.b); };
  for (let k = 0; k < st.length - 1; k++) for (let i = 0; i < n; i++) { put(k, i); put(k + 1, i); put(k + 1, i + 1); put(k, i); put(k + 1, i + 1); put(k, i + 1); }
  return triGeo(pos, col);
}
const PROFILE = [[0, 0.04], [0.1, 0.5], [0.26, 0.92], [0.45, 1], [0.66, 0.74], [0.85, 0.34], [1, 0.13]];

function makeFish(K) {
  const g = new T.Group(), L = K.len, back = lin(K.back, K.glow || 1.5), belly = lin(K.belly, K.glow || 1.5), finC = lin(K.fin, K.glow || 1.5);
  const mat = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });
  const body = new T.Mesh(loft(PROFILE.map(([t, r]) => ({ z: (t - 0.5) * L, rx: r * K.w, ry: r * K.h * 0.5 })), 8, (t, up) => back.clone().lerp(belly, T.MathUtils.smoothstep(-up, -0.35, 0.5))), mat);
  g.add(body);
  const fin = (pts) => { const pos = [], col = []; for (const p of pts) { pos.push(p[0], p[1], p[2]); col.push(finC.r, finC.g, finC.b); } return new T.Mesh(triGeo(pos, col), mat); };
  const tail = new T.Group(); tail.position.z = L * 0.47;
  const th = K.h * (K.bill ? 1.25 : 0.95), tl = L * 0.2;
  tail.add(fin([[0, 0, 0], [0, th, tl], [0, 0, tl * 0.45], [0, 0, 0], [0, 0, tl * 0.45], [0, -th, tl]]));
  g.add(tail);
  const dh = K.h * (K.tall || 0.6);
  g.add(fin([[0, K.h * 0.42, -L * 0.2], [0, K.h * 0.42 + dh, -L * 0.02], [0, K.h * 0.36, L * 0.18]]));
  g.add(fin([[K.w * 0.8, -K.h * 0.1, -L * 0.2], [K.w * 0.8 + K.h * 0.5, -K.h * 0.3, -L * 0.05], [K.w * 0.8, -K.h * 0.15, -L * 0.08], [-K.w * 0.8, -K.h * 0.1, -L * 0.2], [-K.w * 0.8 - K.h * 0.5, -K.h * 0.3, -L * 0.05], [-K.w * 0.8, -K.h * 0.15, -L * 0.08]]));
  if (K.bill) { const b = new T.Mesh(new T.ConeGeometry(K.w * 0.22, L * 0.34, 5).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: back })); b.position.z = -L * 0.62; g.add(b); }
  const white = new T.MeshBasicMaterial({ color: new T.Color(1.4, 1.4, 1.4) }), black = new T.MeshBasicMaterial({ color: 0x05080f }), er = Math.max(0.05, K.h * (K.eye || 0.17));
  for (const sx of [-1, 1]) {
    const e = new T.Mesh(new T.SphereGeometry(er, 8, 6), white); e.position.set(sx * K.w * 0.6, K.h * 0.12, -L * 0.33); g.add(e);
    const p = new T.Mesh(new T.SphereGeometry(er * 0.55, 6, 5), black); p.position.set(sx * (K.w * 0.6 + er * 0.6), K.h * 0.12, -L * 0.34); g.add(p);
  }
  g.userData = { tail, mat };
  return g;
}

function makeBoat() {
  const root = new T.Group(), hull = new T.Group(); root.add(hull);
  // sections bow to stern: z, half-width, gunwale height, keel height
  const sec = [[-2.9, 0.04, 1.0, 0.75], [-2.1, 0.62, 0.86, 0.1], [-1.0, 1.02, 0.74, -0.18], [0.4, 1.12, 0.68, -0.22], [1.9, 1.0, 0.68, -0.16]];
  const white = lin(0xffffff), coral = lin(0xff5a5f), wood = lin(0xd9a066), navy = lin(0x12305c);
  const pos = [], col = [];
  const ring = (s) => [[-s[1], s[2], s[0]], [-s[1] * 0.8, (s[2] + s[3]) * 0.45 + 0.05, s[0]], [0, s[3], s[0]], [s[1] * 0.8, (s[2] + s[3]) * 0.45 + 0.05, s[0]], [s[1], s[2], s[0]]];
  const tri = (a, b, c, k) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); col.push(k.r, k.g, k.b); } };
  for (let i = 0; i < sec.length - 1; i++) {
    const A = ring(sec[i]), B = ring(sec[i + 1]);
    for (let j = 0; j < 4; j++) { const k = j === 0 || j === 3 ? coral : white; tri(A[j], B[j], B[j + 1], k); tri(A[j], B[j + 1], A[j + 1], k); }
    const fa = 0.36, a0 = [A[0][0] * 0.9, fa, A[0][2]], a1 = [A[4][0] * 0.9, fa, A[4][2]], b0 = [B[0][0] * 0.9, fa, B[0][2]], b1 = [B[4][0] * 0.9, fa, B[4][2]];
    tri(a0, b0, b1, wood); tri(a0, b1, a1, wood);
  }
  const E = ring(sec[sec.length - 1]); for (let j = 1; j < 4; j++) tri(E[0], E[j], E[j + 1], navy);
  hull.add(new T.Mesh(triGeo(pos, col), new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: T.DoubleSide, roughness: 0.6 })));
  const box = (w, h, d, hex, x, y, z, o) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), flat(hex, o)); m.position.set(x, y, z); hull.add(m); return m; };
  box(1.5, 0.12, 1.6, 0xff5a5f, 0, 0.8, -1.9);                 // foredeck
  box(1.0, 0.5, 0.45, 0xffffff, 0, 0.62, -0.9);                // console
  box(1.0, 0.4, 0.05, 0x7fe9ff, 0, 1.05, -1.1, { transparent: true, opacity: 0.55, emissive: lin(0x2fe0d0, 0.4) }).rotation.x = 0.35;
  box(1.5, 0.14, 0.4, 0xffd23f, 0, 0.55, 1.45);                // stern bench
  const motor = new T.Group(); motor.position.set(0, 0.55, 2.05); hull.add(motor);
  const cowl = new T.Mesh(new T.BoxGeometry(0.42, 0.62, 0.5), flat(0x12305c)); cowl.position.y = 0.3; motor.add(cowl);
  const cap = new T.Mesh(new T.BoxGeometry(0.44, 0.14, 0.52), flat(0xff5a5f)); cap.position.y = 0.66; motor.add(cap);
  const leg = new T.Mesh(new T.BoxGeometry(0.14, 0.9, 0.2), flat(0x8a97a8)); leg.position.y = -0.4; motor.add(leg);

  // the angler stands amidships and turns to wherever the lure is
  const man = new T.Group(); man.position.set(0, 0.36, 0.45); hull.add(man);
  const part = (geo, hex, x, y, z) => { const m = new T.Mesh(geo, flat(hex)); m.position.set(x, y, z); man.add(m); return m; };
  part(new T.BoxGeometry(0.2, 0.62, 0.22), 0x12305c, -0.14, 0.31, 0); part(new T.BoxGeometry(0.2, 0.62, 0.22), 0x12305c, 0.14, 0.31, 0);
  part(new T.BoxGeometry(0.56, 0.62, 0.32), 0xffd23f, 0, 0.93, 0);
  part(new T.SphereGeometry(0.2, 8, 6), 0xf2b48a, 0, 1.45, 0);
  part(new T.CylinderGeometry(0.42, 0.42, 0.04, 10), 0xe8c98a, 0, 1.6, 0); part(new T.CylinderGeometry(0.2, 0.23, 0.2, 8), 0xe8c98a, 0, 1.7, 0);
  part(new T.BoxGeometry(0.14, 0.14, 0.55), 0xf2b48a, -0.26, 1.02, -0.3); part(new T.BoxGeometry(0.14, 0.14, 0.55), 0xf2b48a, 0.26, 1.02, -0.3);
  const rod = new T.Group(); rod.position.set(0, 1.02, -0.55); man.add(rod);
  const segs = []; let at = rod; const SL = 0.72, rodMat = new T.MeshBasicMaterial({ color: new T.Color(1.6, 0.5, 0.15) });
  for (let i = 0; i < 5; i++) { const s = new T.Mesh(new T.CylinderGeometry(0.035 - i * 0.005, 0.042 - i * 0.005, SL, 5).translate(0, SL / 2, 0), rodMat); s.position.y = i ? SL : 0; at.add(s); at = s; segs.push(s); }
  const tip = new T.Object3D(); tip.position.y = SL; at.add(tip);
  const reel = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.08, 8).rotateZ(Math.PI / 2), flat(0x8a97a8)); reel.position.set(0.08, 0.15, 0); rod.add(reel);
  return { root, hull, man, rod, segs, tip, motor, reel };
}
