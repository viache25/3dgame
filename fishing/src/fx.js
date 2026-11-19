// Spray, ripples, the fishing line and the words that fly up from a catch.
function makeSpray(scene, N) {
  const pos = new Float32Array(N * 3), tint = new Float32Array(N * 4), size = new Float32Array(N), vel = new Float32Array(N * 3), life = new Float32Array(N), span = new Float32Array(N), grav = new Float32Array(N), base = new Float32Array(N);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('tint', new T.BufferAttribute(tint, 4)); g.setAttribute('size', new T.BufferAttribute(size, 1));
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { scale: { value: 600 } },
    vertexShader: 'attribute vec4 tint; attribute float size; uniform float scale; varying vec4 vC; void main(){ vC = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(0.5, 0.35, d)); }',
  });
  const pts = new T.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts);
  let next = 0;
  return {
    mat,
    // one drop: where, which way, how long, how big, colour [r,g,b], weight
    add(x, y, z, vx, vy, vz, t, s, c, gv) {
      const i = next; next = (next + 1) % N;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      life[i] = span[i] = t; base[i] = s; grav[i] = gv === undefined ? 14 : gv; tint[i * 4] = c[0]; tint[i * 4 + 1] = c[1]; tint[i * 4 + 2] = c[2]; tint[i * 4 + 3] = 1;
    },
    step(dt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { size[i] = 0; continue; }
        life[i] -= dt; vel[i * 3 + 1] -= grav[i] * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const k = Math.max(0, life[i] / span[i]);
        size[i] = pos[i * 3 + 1] < -0.05 && grav[i] > 0 ? 0 : base[i] * (0.4 + 0.6 * k); tint[i * 4 + 3] = Math.min(1, k * 2.5);
        if (size[i] === 0 && grav[i] > 0 && vel[i * 3 + 1] < 0) life[i] = 0;
      }
      g.attributes.position.needsUpdate = g.attributes.tint.needsUpdate = g.attributes.size.needsUpdate = true;
    },
  };
}

function makeRings(scene, N) {
  const geo = new T.RingGeometry(0.84, 1, 30).rotateX(-Math.PI / 2), list = [];
  for (let i = 0; i < N; i++) { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 })); m.visible = false; m.renderOrder = 2; m.position.y = 0.04; scene.add(m); list.push({ m, t: 0, life: 0, r0: 0, r1: 1, a: 1 }); }
  let next = 0;
  return {
    add(x, z, r0, r1, life, a, color) { const r = list[next]; next = (next + 1) % N; r.t = 0; r.life = life; r.r0 = r0; r.r1 = r1; r.a = a === undefined ? 0.9 : a; r.m.position.x = x; r.m.position.z = z; r.m.material.color.copy(color || WHITE); r.m.visible = true; },
    step(dt) { for (const r of list) { if (!r.m.visible) continue; r.t += dt; const k = r.t / r.life; if (k >= 1) { r.m.visible = false; continue; } const s = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)); r.m.scale.set(s, 1, s); r.m.material.opacity = r.a * (1 - k); } },
  };
}
const WHITE = new T.Color(1.3, 1.5, 1.5);

// The line is a ribbon turned to the camera and widened with distance, so it never thins out below a pixel.
function makeLine(scene, N) {
  const pos = new Float32Array((N + 1) * 6), idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx);
  const mat = new T.MeshBasicMaterial({ side: T.DoubleSide, color: new T.Color(1.5, 1.5, 1.5) });
  const m = new T.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false; scene.add(m);
  const p = new T.Vector3(), d = new T.Vector3(), v = new T.Vector3(), side = new T.Vector3(), pts = [];
  for (let i = 0; i <= N; i++) pts.push(new T.Vector3());
  return {
    mesh: m, mat,
    set(a, b, sag, cam, px) {
      for (let i = 0; i <= N; i++) { const k = i / N; pts[i].lerpVectors(a, b, k); pts[i].y -= sag * 4 * k * (1 - k); }
      for (let i = 0; i <= N; i++) {
        p.copy(pts[i]); d.subVectors(pts[Math.min(N, i + 1)], pts[Math.max(0, i - 1)]);
        v.subVectors(cam, p); const w = v.length() * px;
        side.crossVectors(d, v).normalize().multiplyScalar(w);
        pos[i * 6] = p.x + side.x; pos[i * 6 + 1] = p.y + side.y; pos[i * 6 + 2] = p.z + side.z; pos[i * 6 + 3] = p.x - side.x; pos[i * 6 + 4] = p.y - side.y; pos[i * 6 + 5] = p.z - side.z;
      }
      g.attributes.position.needsUpdate = true; m.visible = true;
    },
  };
}
