'use strict';
const T = THREE;
const D = Math.PI / 180;
const v3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const col = (hex, k = 1) => new T.Color(hex).convertSRGBToLinear().multiplyScalar(k);
let ENV = null;

// ---------- materials
function std(hex, o = {}) {
  return new T.MeshStandardMaterial(Object.assign({ color: col(hex), flatShading: true, metalness: 0.65, roughness: 0.45, envMapIntensity: 1 }, o));
}
// light: unlit and brighter than white, so only it blooms
function glow(hex, k = 2.4) {
  return new T.MeshBasicMaterial({ color: col(hex, k), toneMapped: false, fog: false });
}

// ---------- geometry
function hull(pts, mirror = true) {
  const P = [];
  for (const p of pts) {
    P.push(v3(p[0], p[1], p[2]));
    if (mirror && Math.abs(p[0]) > 1e-6) P.push(v3(-p[0], p[1], p[2]));
  }
  return new T.ConvexGeometry(P);
}
/** A tapered prism hanging from the joint down −Y. */
function limb(rTop, rBot, len, seg = 6, sz = 1, turn = 0) {
  const g = new T.CylinderGeometry(rTop, rBot, len, seg, 1);
  g.translate(0, -len / 2, 0);
  if (turn) g.rotateY(turn);
  if (sz !== 1) g.scale(1, 1, sz);
  return g;
}
const cyl = (r, h, seg = 8, r2 = r) => new T.CylinderGeometry(r2, r, h, seg, 1);
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
/** A cylinder lying along X (a servo drum, a ring). */
function drum(r, w, seg = 10) {
  const g = new T.CylinderGeometry(r, r, w, seg, 1);
  g.rotateZ(Math.PI / 2);
  return g;
}
/** A cylinder along Z. */
function rodZ(r, len, seg = 6, r2 = r) {
  const g = new T.CylinderGeometry(r2, r, len, seg, 1);
  g.rotateX(Math.PI / 2);
  return g;
}
/** A thick curved plate: the band r1…r2 between angles a0…a1 (radians, in the XY plane), `depth` along Z. */
function arcPlate(r1, r2, a0, a1, depth, segs = 6) {
  const s = new T.Shape();
  s.absarc(0, 0, r2, a0, a1, false);
  s.absarc(0, 0, r1, a1, a0, true);
  const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: segs });
  g.translate(0, 0, -depth / 2);
  return g;
}
function tube(pts, r, seg = 6, n = 24) {
  const c = new T.CatmullRomCurve3(pts.map((p) => v3(p[0], p[1], p[2])));
  return new T.TubeGeometry(c, n, r, seg, false);
}
function add(parent, geo, mat, p, r, s) {
  const m = new T.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s) typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(s[0], s[1], s[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function grp(parent, p, name) {
  const g = new T.Group();
  if (p) g.position.set(p[0], p[1], p[2]);
  if (name) g.name = name;
  if (parent) parent.add(g);
  return g;
}

// ---------- posing
const _m = new T.Matrix4();
const _q = new T.Quaternion();
const _pq = new T.Quaternion();
/** Turn a bone so its −Y runs along `dirW` and its +Z looks toward `poleW` (world directions). */
function aim(g, dirW, poleW) {
  const y = dirW.clone().normalize().negate();
  let z = poleW.clone().addScaledVector(y, -poleW.dot(y));
  if (z.lengthSq() < 1e-8) z = v3(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize();
  const x = v3().crossVectors(y, z);
  _m.makeBasis(x, y, z);
  _q.setFromRotationMatrix(_m);
  g.parent.updateWorldMatrix(true, false);
  g.parent.getWorldQuaternion(_pq);
  g.quaternion.copy(_pq.invert().multiply(_q));
  g.updateWorldMatrix(false, true);
}
/** Two-bone IK: the upper bone at its joint, the lower hanging from it; the end reaches `targetW`, the middle joint bends toward `poleW`. */
function ik2(upper, lower, L1, L2, targetW, poleW) {
  upper.parent.updateWorldMatrix(true, false);
  upper.updateWorldMatrix(false, false);
  const H = upper.getWorldPosition(v3());
  const to = targetW.clone().sub(H);
  const dir = to.clone().normalize();
  const d = Math.min(Math.max(to.length(), Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const perp = poleW.clone().addScaledVector(dir, -poleW.dot(dir)).normalize();
  const K = H.clone().addScaledVector(dir, a).addScaledVector(perp, h);
  const end = H.clone().addScaledVector(dir, d);
  aim(upper, K.clone().sub(H), perp);
  aim(lower, end.clone().sub(K), perp);
  return { K, end };
}
function setWorldQuat(g, qW) {
  g.parent.updateWorldMatrix(true, false);
  g.parent.getWorldQuaternion(_pq);
  g.quaternion.copy(_pq.invert().multiply(qW));
}
/** Soft radial dot for sprites and halos. */
function dotTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, s] of stops) g.addColorStop(o, s);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  return t;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** The game's dark contour in 3D: every solid part gets a slightly larger back-facing shell in the outline colour. */
function addOutlines(root, t = 0.011, hex = 0x0b0d26) {
  const mat = new T.ShaderMaterial({
    side: T.BackSide, fog: false,
    uniforms: { t: { value: t }, c: { value: col(hex) } },
    vertexShader: 'uniform float t; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.xyz += normalize(normalMatrix * normal) * t; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }',
  });
  const list = [];
  root.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial && o.material.side !== T.DoubleSide) list.push(o); });
  for (const o of list) {
    let g = o.geometry.clone();
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = T.BufferGeometryUtils.mergeVertices(g, 1e-4);
    g.computeVertexNormals();
    const m = new T.Mesh(g, mat);
    m.userData.outline = true;
    m.layers.set(1); // the main camera only: not in the floor's mirror
    o.add(m);
  }
  return list.length;
}

const FIST_Y = 0.065;
/** A hand closed around a shaft that runs along its local Z through (0, −FIST_Y·s, 0); −Y continues the forearm. */
function fist(parent, mFinger, mPlate, s = 1) {
  const g = grp(parent), cy = -FIST_Y * s, R = 0.037 * s;
  add(g, box(0.074 * s, 0.05 * s, 0.104 * s), mPlate, [0, -0.012 * s, 0]);
  for (let f = 0; f < 4; f++) {
    const z = (f - 1.5) * 0.0255 * s;
    for (let k = 0; k < 5; k++) { const a = (-152 + k * 63) * D; add(g, box(0.038 * s, 0.018 * s, 0.022 * s), k === 1 || k === 2 ? mPlate : mFinger, [Math.sin(a) * R, cy + Math.cos(a) * R, z], [0, 0, -a]); }
  }
  for (const [a, r] of [[-165, 1.0], [150, 1.05]]) add(g, box(0.034 * s, 0.018 * s, 0.026 * s), mFinger, [Math.sin(a * D) * R * r, cy + Math.cos(a * D) * R * r, 0.064 * s], [0, 0.35, -a * D]);
  return g;
}
/** Turn a hand so that its grip (local Z) lies along `axisW` while it still continues its forearm as nearly as it can. */
function orientGrip(hand, lo, axisW) {
  lo.updateWorldMatrix(true, false);
  const z = axisW.clone().normalize(), y = v3(0, 1, 0).applyQuaternion(lo.getWorldQuaternion(new T.Quaternion()));
  y.addScaledVector(z, -y.dot(z));
  if (y.lengthSq() < 1e-6) y.set(0, 1, 0).addScaledVector(z, -z.y);
  y.normalize();
  setWorldQuat(hand, new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(v3().crossVectors(y, z), y, z)));
  hand.updateWorldMatrix(false, true);
}
