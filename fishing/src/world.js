// The lagoon: sky, water, islands, buoys, light. Colours are written as sRGB hex and turned linear, because the last pass does the encoding.
const T = THREE;
const lin = (hex, k) => { const c = new T.Color(hex).convertSRGBToLinear(); if (k) c.multiplyScalar(k); return c; };
const flat = (hex, o) => new T.MeshStandardMaterial(Object.assign({ color: lin(hex), flatShading: true, roughness: 0.85, metalness: 0 }, o || {}));

function buildWorld(scene, ARENA) {
  const sunDir = new T.Vector3(0.42, 0.2, -0.88).normalize();
  const sky = new T.Mesh(new T.SphereGeometry(1800, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, uniforms: { sunDir: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
      void main(){
        vec3 d = normalize(vDir); float h = max(d.y, 0.0);
        vec3 c = mix(vec3(1.0, 0.5, 0.32), vec3(0.3, 0.6, 1.0), smoothstep(0.0, 0.2, h));
        c = mix(c, vec3(0.05, 0.2, 0.75), smoothstep(0.12, 0.8, h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.0, 0.5, 0.2) * pow(s, 5.0) * 0.5 + vec3(1.0, 0.75, 0.45) * pow(s, 70.0) * 1.3 + vec3(1.0, 0.92, 0.75) * smoothstep(0.9982, 0.999, s) * 14.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.frustumCulled = false; scene.add(sky);

  const seabed = new T.Mesh(new T.CircleGeometry(1700, 24), new T.MeshBasicMaterial({ color: lin(0x0a4f86) }));
  seabed.rotation.x = -Math.PI / 2; seabed.position.y = -7; scene.add(seabed);

  const water = new T.Mesh(new T.PlaneGeometry(3400, 3400), new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, cam: { value: new T.Vector3() }, sunDir: { value: sunDir }, shallow: { value: lin(0x1fe3d0) }, deep: { value: lin(0x0a66c8) }, horizon: { value: lin(0xffa37a) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float time; uniform vec3 cam, sunDir, shallow, deep, horizon;
      void main(){
        vec2 p = vW.xz; float t = time;
        // slope of a few crossing swells, taken analytically
        vec2 g = vec2(0.0);
        g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.55 + t * 1.3) * 0.16;
        g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 0.9 - t * 1.7) * 0.12;
        g += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98)) * 1.7 + t * 2.3) * 0.1;
        g += vec2(0.95, -0.3) * cos(dot(p, vec2(0.95, -0.3)) * 3.1 + t * 3.1) * 0.07;
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cam - vW); float dist = length(cam - vW);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 c = mix(shallow, deep, smoothstep(10.0, 120.0, dist) * 0.8 + 0.1);
        // bright wavering lines, the way sun nets a shallow floor
        float a = sin(p.x * 0.9 + sin(p.y * 0.7 + t * 0.9) * 1.6), b = sin(p.y * 1.0 + sin(p.x * 0.6 - t * 0.7) * 1.6);
        c += shallow * smoothstep(0.86, 1.0, abs(a * b)) * 0.55 * smoothstep(90.0, 20.0, dist);
        c = mix(c, horizon, fres * 0.7);
        vec3 r = reflect(-v, n);
        c += vec3(1.0, 0.85, 0.6) * (pow(max(dot(r, sunDir), 0.0), 220.0) * 9.0 + pow(max(dot(r, sunDir), 0.0), 24.0) * 0.2);
        c = mix(c, horizon, smoothstep(250.0, 1500.0, dist));
        gl_FragColor = vec4(c, mix(0.42, 1.0, smoothstep(45.0, 220.0, dist)));
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.renderOrder = 1; water.frustumCulled = false; scene.add(water);

  scene.add(new T.HemisphereLight(lin(0xcfe8ff), lin(0x1c8fa0), 0.95));
  const key = new T.DirectionalLight(lin(0xfff0d8), 1.7); key.position.set(-0.5, 1, 0.6); scene.add(key);
  const rim = new T.DirectionalLight(lin(0xff9a5c), 1.3); rim.position.copy(sunDir); scene.add(rim);

  // islands with palms, far enough that the boat never reaches them
  let s = 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sand = flat(0xffe2a0), green = flat(0x2fbf5f), trunk = flat(0x9a6a3c), leaf = flat(0x3ad66f), rock = flat(0x8a7f92);
  function palm(h) {
    const g = new T.Group(); let at = g;
    for (let i = 0; i < 4; i++) { const seg = new T.Mesh(new T.CylinderGeometry(0.22 - i * 0.03, 0.27 - i * 0.03, h / 4, 5).translate(0, h / 8, 0), trunk); seg.position.y = i ? h / 4 : 0; seg.rotation.z = 0.12; at.add(seg); at = seg; }
    const top = new T.Group(); top.position.y = h / 4; at.add(top);
    for (let i = 0; i < 7; i++) { const l = new T.Mesh(new T.ConeGeometry(0.55, 3.6, 4).translate(0, 1.8, 0).scale(1, 1, 0.25), leaf); l.rotation.set(0, 0, 1.25 + rnd() * 0.3); const piv = new T.Group(); piv.rotation.y = i / 7 * Math.PI * 2 + rnd() * 0.4; piv.add(l); top.add(piv); }
    return g;
  }
  for (const [ang, dist, sc] of [[-0.5, 120, 1.5], [0.35, 150, 2.2], [1.5, 110, 1.1], [-1.9, 125, 1.6], [2.7, 135, 1.3], [-2.9, 160, 2.0]]) {
    const g = new T.Group(); g.position.set(Math.sin(ang) * dist, 0, -Math.cos(ang) * dist);
    const base = new T.Mesh(new T.CylinderGeometry(8 * sc, 11 * sc, 1.4, 9), sand); base.position.y = 0.2; g.add(base);
    const hill = new T.Mesh(new T.ConeGeometry(5.5 * sc, 6 * sc, 7), green); hill.position.set(1 * sc, 0.9 + 3 * sc, -1 * sc); g.add(hill);
    for (let i = 0; i < 3; i++) { const p = palm(5 + rnd() * 3); const a = rnd() * 6.28; p.position.set(Math.cos(a) * 6 * sc, 0.8, Math.sin(a) * 6 * sc); p.rotation.y = rnd() * 6.28; p.scale.setScalar(1.2); g.add(p); }
    const r = new T.Mesh(new T.DodecahedronGeometry(2.2 * sc, 0), rock); r.position.set(-9 * sc, 0.3, 5 * sc); g.add(r);
    scene.add(g);
  }
  // clouds: lumps lit from below by the low sun
  const cloud = new T.MeshBasicMaterial({ color: new T.Color(1.25, 0.95, 0.85) });
  for (let i = 0; i < 9; i++) {
    const g = new T.Group(), a = i / 9 * 6.28 + rnd(), d = 700 + rnd() * 500;
    for (let k = 0; k < 5; k++) { const m = new T.Mesh(new T.IcosahedronGeometry(40 + rnd() * 35, 0), cloud); m.position.set((k - 2) * 55, rnd() * 25, rnd() * 30); m.scale.y = 0.55; g.add(m); }
    g.position.set(Math.sin(a) * d, 170 + rnd() * 160, -Math.cos(a) * d); g.rotation.y = -a; scene.add(g);
  }
  // buoys mark the edge of the fishing ground
  const buoys = [], red = flat(0xff4b4b), white = flat(0xffffff);
  for (let i = 0; i < 14; i++) {
    const g = new T.Group(), a = i / 14 * Math.PI * 2;
    g.add(new T.Mesh(new T.CylinderGeometry(0.45, 0.6, 0.7, 8), red));
    const cone = new T.Mesh(new T.ConeGeometry(0.42, 0.9, 8), white); cone.position.y = 0.8; g.add(cone);
    const lamp = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(4, 1.2, 0.6) })); lamp.position.y = 1.35; g.add(lamp);
    g.position.set(Math.sin(a) * (ARENA + 2), 0.1, Math.cos(a) * (ARENA + 2)); g.userData = { ph: i * 1.7, lamp };
    scene.add(g); buoys.push(g);
  }
  return {
    sunDir, sky, water,
    update(time, camera) {
      water.material.uniforms.time.value = time; water.material.uniforms.cam.value.copy(camera.position);
      sky.position.copy(camera.position); water.position.set(camera.position.x, 0, camera.position.z); seabed.position.set(camera.position.x, -7, camera.position.z);
      for (const b of buoys) { const u = b.userData; b.position.y = 0.1 + Math.sin(time * 1.6 + u.ph) * 0.12; b.rotation.z = Math.sin(time * 1.1 + u.ph) * 0.12; u.lamp.visible = Math.sin(time * 3 + u.ph) > 0; }
    },
  };
}
