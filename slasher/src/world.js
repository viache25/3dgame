// The place: a clearing in a forest at night. A moon behind the trees, mist between the trunks, cedars standing all round with their crowns
// in the dark, a floor of earth, moss and fallen needles, grass and ferns underfoot, and fireflies. What light there is comes from the moon,
// from a few lanterns, and from whatever the blade sets burning.
function buildWorld(scene, opt) {
  const KEY = new T.Vector3(-0.42, 0.74, -0.52).normalize();
  const HAZE = lin(0x0d1c26);
  scene.fog = new T.Fog(HAZE, 26, 120);
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const sky = new T.Mesh(new T.SphereGeometry(700, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uMoon: { value: new T.Vector3(0.38, 0.4, -0.83).normalize() }, uTop: { value: lin(0x02050d) }, uMid: { value: lin(0x0b1f33) }, uLow: { value: lin(0x1d4250) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uMoon, uTop, uMid, uLow; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.22, h));
        c = mix(c, uTop, smoothstep(0.12, 0.75, h));
        float m = max(dot(d, uMoon), 0.0);
        c += vec3(0.45, 0.65, 0.9) * (pow(m, 14.0) * 0.4 + pow(m, 120.0) * 0.5) + vec3(1.0, 0.98, 0.9) * smoothstep(0.9925, 0.9935, m) * 3.0; // a full moon and the glow round it
        vec2 g = floor(d.xz / max(d.y, 0.05) * 70.0);
        c += vec3(0.75, 0.85, 1.0) * step(0.996, hash(g)) * smoothstep(0.12, 0.5, h) * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // the far forest: rows of treetops one behind another, each paler with distance, painted once and wrapped round the horizon
  const sk = document.createElement('canvas');
  sk.width = 2048; sk.height = 512;
  const g2 = sk.getContext('2d');
  g2.clearRect(0, 0, 2048, 512);
  for (let layer = 0; layer < 3; layer++) {
    g2.fillStyle = ['#12303a', '#0b2029', '#06131a'][layer];
    let x = -30;
    while (x < 2080) {
      const w = 34 + rnd() * 50, h = 150 + layer * 55 + rnd() * 150, top = 512 - h;
      g2.beginPath(); g2.moveTo(x + w / 2, top);
      for (let k = 1; k <= 6; k++) { const y = top + (h * 0.8) * k / 6, half = w * 0.16 + w * 0.5 * k / 6; g2.lineTo(x + w / 2 + half, y); g2.lineTo(x + w / 2 + half * 0.55, y); }
      for (let k = 6; k >= 1; k--) { const y = top + (h * 0.8) * k / 6, half = w * 0.16 + w * 0.5 * k / 6; g2.lineTo(x + w / 2 - half * 0.55, y); g2.lineTo(x + w / 2 - half, y); }
      g2.closePath(); g2.fill();
      g2.fillRect(x + w / 2 - 3, top + h * 0.7, 6, h * 0.3);
      x += w * (0.45 + rnd() * 0.5);
    }
    g2.fillRect(0, 512 - 60 - layer * 30, 2048, 100);
  }
  const skyTex = new T.CanvasTexture(sk);
  skyTex.wrapS = T.RepeatWrapping; skyTex.repeat.set(2, 1); skyTex.encoding = T.sRGBEncoding;
  const skyline = new T.Mesh(new T.CylinderGeometry(240, 240, 120, 64, 1, true), new T.MeshBasicMaterial({ map: skyTex, transparent: true, side: T.BackSide, fog: false, depthWrite: false }));
  skyline.position.y = 50; skyline.renderOrder = -9;
  scene.add(skyline);

  // the forest that stands round the clearing: cedars, each a trunk and a crown in tiers, thick enough that nothing shows between them far off
  const near = [];
  const lit = (piece, heat) => { for (const f of piece.faces) { f.cap = GEO.NEON; f.heat = heat; } return piece; };
  const cedar = (x, z, h, r) => {
    near.push(GEO.place(GEO.lathe([[r * 0.34, 0], [r * 0.2, h * 0.5], [r * 0.12, h * 0.62]], { sides: 6, col: 42 }), x, -0.3, z, 0, rnd() * 6, 0));
    const tiers = 4;
    for (let k = 0; k < tiers; k++) { const y = h * (0.26 + 0.17 * k), rr = r * (1 - k * 0.2); near.push(GEO.place(GEO.lathe([[rr, 0], [rr * 0.82, h * 0.05], [rr * 0.12, h * 0.3]], { sides: 7, col: k % 2 ? 41 : 40 }), x, y, z, 0, rnd() * 6, 0)); }
  };
  for (let i = 0; i < 130; i++) { const a = rnd() * Math.PI * 2, r = 43 + rnd() * rnd() * 55; cedar(Math.cos(a) * r, Math.sin(a) * r, 13 + rnd() * 16, 3 + rnd() * 2.6); }
  // a gate on the far side of the clearing and stones that mark its edge
  const gate = (x, z, turn) => {
    for (const sx of [-2.6, 2.6]) near.push(GEO.place(GEO.lathe([[0.34, 0], [0.28, 6.4]], { sides: 8, col: 49 }), x + Math.cos(turn) * sx, 0, z - Math.sin(turn) * sx, 0, 0, 0));
    near.push(GEO.place(GEO.box(7.4, 0.42, 0.5, { col: 49 }), x, 5.1, z, 0, turn, 0), GEO.place(GEO.box(8.6, 0.5, 0.7, { col: 38, taper: 1.05 }), x, 6.3, z, 0, turn, 0), GEO.place(GEO.box(9.2, 0.16, 0.9, { col: 38 }), x, 6.8, z, 0, turn, 0));
    near.push(GEO.place(lit(GEO.box(0.9, 1.3, 0.12, { col: 48 }), 0.5), x, 5.25, z, 0, turn, 0));
  };
  gate(0, -41.5, 0); gate(41.5, 0, Math.PI / 2); gate(-29.3, 29.3, Math.PI / 4);
  for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2 + rnd() * 0.08, r = 39.4 + rnd() * 1.2, s = 0.5 + rnd() * 0.9; near.push(GEO.place(GEO.lathe([[s * 0.8, 0], [s * 0.7, s * 0.5], [s * 0.2, s]], { sides: 6, col: 43 }), Math.cos(a) * r, -0.1, Math.sin(a) * r, 0, rnd() * 6, 0)); }
  const forest = new T.Mesh(partGeometry(near), PART_MAT);
  scene.add(forest);

  // the forest floor, drawn once: dark earth, patches of moss, needles and fallen leaves
  const make = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
  const floor = make(1024, (g) => {
    g.fillStyle = '#1d1f1c'; g.fillRect(0, 0, 1024, 1024);
    g.filter = 'blur(14px)';
    for (let i = 0; i < 90; i++) { // moss, wrapped round the edges so the tile has no seam
      const x = rnd() * 1024, y = rnd() * 1024, rx = 30 + rnd() * 90, ry = 20 + rnd() * 60, a = rnd() * 3.14;
      g.fillStyle = 'rgba(' + [Math.round(24 + rnd() * 16), Math.round(40 + rnd() * 24), Math.round(28 + rnd() * 12)].join(',') + ',0.5)';
      for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) { g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, a, 0, 6.29); g.fill(); }
    }
    g.filter = 'none';
    for (let i = 0; i < 26000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(190,200,160,0.06)' : 'rgba(0,0,0,0.14)'; const s = 1 + rnd() * 2.4; g.fillRect(rnd() * 1024, rnd() * 1024, s, s); }
    for (let i = 0; i < 2600; i++) { // needles
      const x = rnd() * 1024, y = rnd() * 1024, a = rnd() * 6.28, l = 4 + rnd() * 9;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(120,96,58,0.5)' : 'rgba(70,110,64,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 520; i++) { // leaves
      g.fillStyle = ['rgba(150,86,40,0.6)', 'rgba(170,120,50,0.55)', 'rgba(110,60,36,0.6)'][Math.floor(rnd() * 3)];
      g.beginPath(); g.ellipse(rnd() * 1024, rnd() * 1024, 3 + rnd() * 3, 1.5 + rnd() * 1.5, rnd() * 3.14, 0, 6.29); g.fill();
    }
  });
  floor.repeat.set(34, 34); floor.encoding = T.sRGBEncoding;
  const groundMat = new T.MeshLambertMaterial({ map: floor });
  const ground = new T.Mesh(new T.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.006; ground.receiveShadow = true;
  scene.add(ground);

  // grass and ferns: thousands of small blades standing in tufts, thicker toward the trees
  {
    const blade = new T.ConeGeometry(0.032, 0.34, 3, 1); blade.translate(0, 0.17, 0);
    const N = opt && opt.light ? 2600 : 6000, grass = new T.InstancedMesh(blade, new T.MeshLambertMaterial({ color: 0xffffff }), N);
    const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(), col = new T.Color();
    let cx = 0, cz = 0;
    for (let i = 0; i < N; i++) {
      if (i % 9 === 0) { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 56; cx = Math.cos(a) * r; cz = Math.sin(a) * r; }
      v.set(cx + (rnd() - 0.5) * 0.9, 0, cz + (rnd() - 0.5) * 0.9);
      e.set((rnd() - 0.5) * 0.7, rnd() * 6.28, (rnd() - 0.5) * 0.7); q.setFromEuler(e);
      const s = 0.6 + rnd() * 1.3; sc.set(s, s * (0.7 + rnd() * 0.9), s);
      grass.setMatrixAt(i, m.compose(v, q, sc));
      grass.setColorAt(i, col.setRGB(0.012 + rnd() * 0.02, 0.04 + rnd() * 0.05, 0.02 + rnd() * 0.02));
    }
    grass.receiveShadow = true; grass.frustumCulled = false;
    scene.add(grass);
  }

  // the rope round the clearing, where the forest proper begins
  const rope = new T.Mesh(new T.RingGeometry(38.0, 38.16, 128), new T.MeshBasicMaterial({ color: new T.Color(0.5, 0.09, 0.05), fog: true }));
  rope.rotation.x = -Math.PI / 2; rope.position.y = 0.03; scene.add(rope);

  scene.add(new T.HemisphereLight(lin(0x4f73b8), lin(0x16242a), 0.7));
  const sun = new T.DirectionalLight(lin(0xbdd2ff), 2.1); // the moon, cool and from above
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 130;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const rim = new T.DirectionalLight(lin(0x3f9fc8), 0.6); // a green light out of the mist behind, so figures stand off the dark
  rim.position.set(30, 14, 40);
  scene.add(rim);
  const pools = [[-9, -6, 0xffa64d], [11, 7, 0x4fb8d8], [3, -15, 0xffa64d], [-14, 12, 0x4fb8d8], [17, -10, 0xffa64d]]; // lantern light, and the cold light of spirits
  for (const [x, z, hex] of pools) { const l = new T.PointLight(lin(hex), 1.7, 17, 1.5); l.position.set(x, 3.0, z); scene.add(l); }

  // fireflies: slow lights adrift in a box that travels with the eye
  const N = opt && opt.light ? 70 : 150, fp = new Float32Array(N * 3), flies = [];
  for (let i = 0; i < N; i++) flies.push([(rnd() - 0.5) * 54, 0.3 + rnd() * 3.2, (rnd() - 0.5) * 54, rnd() * 6.28, 0.4 + rnd() * 0.8]);
  const fg = new T.BufferGeometry();
  fg.setAttribute('position', new T.BufferAttribute(fp, 3));
  const fireflies = new T.Points(fg, new T.PointsMaterial({ color: new T.Color(1.9, 2.3, 0.7), size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  fireflies.frustumCulled = false;
  scene.add(fireflies);
  let clock = 0;

  const lamp = new T.PointLight(lin(0xcfdcff), 1.3, 11, 1.4); // a pool of light that goes where the fire-bearer goes, so the fight is never in the dark
  scene.add(lamp);

  return {
    KEY, sun, mirror: null,
    follow(x, z) { // the shadow box travels with the wanderer, in whole texels so shadows do not swim
      const step = 44 / 2048 * 8, fx = Math.round(x / step) * step, fz = Math.round(z / step) * step;
      sun.target.position.set(fx, 0, fz); sun.position.set(fx + KEY.x * 60, KEY.y * 60, fz + KEY.z * 60);
      sky.position.set(x, 0, z); skyline.position.x = x * 0.6; skyline.position.z = z * 0.6; lamp.position.set(x, 4.2, z + 1.5);
    },
    step(dt, x, z) {
      clock += dt;
      for (let i = 0; i < N; i++) {
        const f = flies[i], o = i * 3;
        let px = f[0] + Math.sin(clock * f[4] + f[3]) * 1.6, pz = f[2] + Math.cos(clock * f[4] * 0.8 + f[3] * 2) * 1.6;
        // the box wraps, so wherever he goes there are as many round him
        px = x + ((px - x + 27) % 54 + 54) % 54 - 27; pz = z + ((pz - z + 27) % 54 + 54) % 54 - 27;
        fp[o] = px; fp[o + 1] = f[1] + Math.sin(clock * 1.3 * f[4] + f[3]) * 0.4; fp[o + 2] = pz;
      }
      fg.attributes.position.needsUpdate = true;
    },
    setMirror() { /* there is no water here to mirror anything */ },
  };
}
