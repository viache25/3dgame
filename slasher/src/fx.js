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
