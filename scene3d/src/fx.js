// Sparks, crescents of light, flares, the shock ring. Everything is a pure function of time, so any frame can be drawn alone.
function buildFX(scene) {
  const fx = { bursts: [] };
  const MAX = 1800, pos = new Float32Array(MAX * 6), colr = new Float32Array(MAX * 6), hp = new Float32Array(MAX * 3), hc = new Float32Array(MAX * 3);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(colr, 3));
  const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ vertexColors: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, transparent: true }));
  const hgeo = new T.BufferGeometry();
  hgeo.setAttribute('position', new T.BufferAttribute(hp, 3)); hgeo.setAttribute('color', new T.BufferAttribute(hc, 3));
  const heads = new T.Points(hgeo, new T.PointsMaterial({ size: 0.035, sizeAttenuation: true, vertexColors: true, map: dotTexture([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']], 32), blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, transparent: true }));
  lines.frustumCulled = heads.frustumCulled = false;
  scene.add(lines, heads);
  /** o: origin, dir, spread, n, v [min,max], life [min,max], g, drag, c0/c1 colours, len (streak seconds), implode */
  fx.burst = (b) => {
    const r = rng(b.seed || fx.bursts.length + 1), parts = [], d = v3(...(b.dir || [0, 1, 0])).normalize();
    for (let i = 0; i < b.n; i++) {
      const u = v3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(b.spread ?? 1).add(d).normalize();
      parts.push({ v: u.multiplyScalar(lerpN(b.v[0], b.v[1], r() * r())), life: lerpN(b.life[0], b.life[1], r()), k: 0.6 + 0.8 * r() });
    }
    fx.bursts.push(Object.assign({ g: 7, drag: 1.6, len: 0.035, c0: [3, 2.6, 2.4], c1: [2.2, 0.5, 1.2] }, b, { parts }));
  };
  const lerpN = (a, b, t) => a + (b - a) * t;
  const at = (b, p, tau, out) => {
    if (b.implode) { const q = Math.pow(1 - tau / p.life, 2); out.set(b.o[0] + p.v.x * q * 0.12, b.o[1] + p.v.y * q * 0.12, b.o[2] + p.v.z * q * 0.12); return; }
    const e = (1 - Math.exp(-b.drag * tau)) / b.drag;
    out.set(b.o[0] + p.v.x * e, Math.max(0.015, b.o[1] + p.v.y * e - 0.5 * b.g * tau * tau), b.o[2] + p.v.z * e);
  };
  const a = v3(), c = v3();
  fx.sparks = (time) => {
    let n = 0;
    for (const b of fx.bursts) {
      const tau0 = time - b.t;
      if (tau0 <= 0 || tau0 > b.life[1] + 0.05) continue;
      for (const p of b.parts) {
        if (tau0 >= p.life || n >= MAX) continue;
        at(b, p, tau0, a); at(b, p, Math.max(0, tau0 - b.len), c);
        const f = Math.pow(1 - tau0 / p.life, 1.3) * p.k, m = tau0 / p.life;
        const cr = lerpN(b.c0[0], b.c1[0], m) * f, cg = lerpN(b.c0[1], b.c1[1], m) * f, cb = lerpN(b.c0[2], b.c1[2], m) * f;
        pos.set([a.x, a.y, a.z, c.x, c.y, c.z], n * 6); colr.set([cr, cg, cb, cr * 0.2, cg * 0.2, cb * 0.2], n * 6);
        hp.set([a.x, a.y, a.z], n * 3); hc.set([cr, cg, cb], n * 3);
        n++;
      }
    }
    geo.setDrawRange(0, n * 2); hgeo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = hgeo.attributes.position.needsUpdate = hgeo.attributes.color.needsUpdate = true;
  };

  // ---- crescents: the mark Luna's blade leaves
  const cg = (() => {
    const s = new T.Shape(), N = 28, A = 1.3;
    for (let i = 0; i <= N; i++) { const th = -A + (2 * A * i) / N; i ? s.lineTo(Math.cos(th), Math.sin(th)) : s.moveTo(Math.cos(th), Math.sin(th)); }
    for (let i = N; i >= 0; i--) { const th = -A + (2 * A * i) / N, r = 1 - 0.26 * Math.cos((th / A) * Math.PI / 2); s.lineTo(Math.cos(th) * r, Math.sin(th) * r); }
    const g = new T.ShapeGeometry(s, 1);
    g.translate(-0.85, 0, 0);
    return g;
  })();
  fx.crescents = [];
  for (let i = 0; i < 12; i++) {
    const m = new T.Mesh(cg, new T.MeshBasicMaterial({ color: new T.Color(1.5, 1.8, 2.6), side: T.DoubleSide, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
    m.visible = false; m.frustumCulled = false; scene.add(m); fx.crescents.push(m);
  }
  /** Show crescent `i`: centre, radius, facing (yaw about Y), tilt in its own plane, brightness 0…1, optional stretch. */
  fx.crescent = (i, p, R, yaw, tilt, k, sx = 1, col) => {
    const m = fx.crescents[i];
    m.visible = k > 0.01;
    if (!m.visible) return;
    m.position.set(p[0], p[1], p[2]); m.rotation.set(0, yaw, tilt, 'YXZ'); m.scale.set(R * sx, R, R);
    const c0 = col || [1.5, 1.8, 2.6];
    m.material.color.setRGB(c0[0] * k, c0[1] * k, c0[2] * k);
  };

  // ---- flares, the hairline of light, the ring of the shock
  const ftex = dotTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']], 128);
  fx.flares = [];
  for (let i = 0; i < 8; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: ftex, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, fog: false })); s.visible = false; scene.add(s); fx.flares.push(s); }
  fx.flare = (i, p, size, col, k) => { const s = fx.flares[i]; s.visible = k > 0.01; if (!s.visible) return; s.position.set(p[0], p[1], p[2]); s.scale.setScalar(size); s.material.color.setRGB(col[0] * k, col[1] * k, col[2] * k); };
  fx.line = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: new T.Color(3, 3, 3.4), toneMapped: false, fog: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  fx.line.visible = false; scene.add(fx.line);
  fx.setLine = (p0, p1, w, k) => {
    fx.line.visible = k > 0.01; if (!fx.line.visible) return;
    const A = v3(...p0), B2 = v3(...p1), d = B2.clone().sub(A);
    fx.line.position.copy(A).addScaledVector(d, 0.5); fx.line.quaternion.setFromUnitVectors(v3(1, 0, 0), d.clone().normalize()); fx.line.scale.set(d.length(), w, w);
    fx.line.material.color.setRGB(3 * k, 3 * k, 3.4 * k);
  };
  // ---- trails: the smear a fast blade leaves, built from where it was over the last instants
  fx.makeTrail = (N = 10) => {
    const g = new T.BufferGeometry(), pos = new Float32Array(N * 6), colr = new Float32Array(N * 6), idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(colr, 3)); g.setIndex(idx);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
    m.frustumCulled = false; m.visible = false; scene.add(m);
    return { set(samples, col, k) {
      m.visible = k > 0.01 && samples.length > 1; if (!m.visible) return;
      for (let i = 0; i < N; i++) { const s = samples[Math.min(i, samples.length - 1)], f = k * Math.pow(1 - i / (N - 1), 1.4); pos.set([s[0].x, s[0].y, s[0].z, s[1].x, s[1].y, s[1].z], i * 6); colr.set([col[0] * f * 0.35, col[1] * f * 0.35, col[2] * f * 0.35, col[0] * f, col[1] * f, col[2] * f], i * 6); }
      g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true;
    } };
  };
  fx.ring = new T.Mesh(new T.RingGeometry(0.93, 1, 72), new T.MeshBasicMaterial({ color: new T.Color(2, 2, 2.6), side: T.DoubleSide, toneMapped: false, fog: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  fx.ring.visible = false; scene.add(fx.ring);
  return fx;
}
