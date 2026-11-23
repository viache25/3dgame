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
