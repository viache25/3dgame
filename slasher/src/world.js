// The place: a rain-wet plaza in a night city. The ground is a mirror under a skin of asphalt with holes in it for puddles, so every
// neon sign, every blade and every spark is seen twice. Around it stand blocks with signs, and behind them a painted skyline.
function buildWorld(scene, opt) {
  const KEY = new T.Vector3(-0.42, 0.74, -0.52).normalize();
  const HAZE = lin(0x1c1236);
  scene.fog = new T.Fog(HAZE, 34, 175);
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const NEON = ['#ff2bd6', '#3df2ff', '#ffe14d', '#ff2d55', '#5dff8f', '#b46cff'];

  const sky = new T.Mesh(new T.SphereGeometry(700, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uMoon: { value: new T.Vector3(0.5, 0.42, -0.76).normalize() }, uTop: { value: lin(0x05061a) }, uMid: { value: lin(0x241452) }, uLow: { value: lin(0x7a1f8c) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uMoon, uTop, uMid, uLow; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.2, h));
        c = mix(c, uTop, smoothstep(0.1, 0.7, h));
        float m = max(dot(d, uMoon), 0.0);
        c += vec3(0.5, 0.7, 1.0) * (pow(m, 30.0) * 0.35) + vec3(0.9, 0.95, 1.0) * smoothstep(0.9965, 0.9972, m) * 2.4;
        vec2 g = floor(d.xz / max(d.y, 0.05) * 60.0);
        c += vec3(0.7, 0.8, 1.0) * step(0.997, hash(g)) * smoothstep(0.15, 0.5, h) * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // the far skyline: one long painting of towers with lit windows and signs, wrapped round the horizon
  const sk = document.createElement('canvas');
  sk.width = 2048; sk.height = 512;
  const g2 = sk.getContext('2d');
  g2.clearRect(0, 0, 2048, 512);
  for (let layer = 0; layer < 2; layer++) {
    let x = -20;
    while (x < 2048) {
      const w = 26 + rnd() * 70, h = (layer ? 90 : 170) + rnd() * (layer ? 190 : 300), y = 512 - h;
      g2.fillStyle = layer ? '#0c0d1c' : '#15122e';
      g2.fillRect(x, y, w, h);
      const tone = rnd(), lit = tone < 0.5 ? '#ffc46b' : tone < 0.8 ? '#7fe9ff' : '#ff8ae6';
      for (let wy = y + 6; wy < 506; wy += 7) for (let wx = x + 4; wx < x + w - 4; wx += 6) if (rnd() < (layer ? 0.3 : 0.16)) { g2.globalAlpha = 0.35 + rnd() * 0.65; g2.fillStyle = lit; g2.fillRect(wx, wy, 3, 3.5); }
      g2.globalAlpha = 1;
      if (rnd() < 0.45) { g2.fillStyle = NEON[Math.floor(rnd() * NEON.length)]; const sw = 5 + rnd() * 9, sh = 24 + rnd() * 80; g2.fillRect(x + 3 + rnd() * (w - sw - 6), y + 10 + rnd() * 30, sw, sh); }
      if (rnd() < 0.3) { g2.fillStyle = '#ff2d55'; g2.fillRect(x + w / 2 - 1, y - 14, 2, 14); g2.fillRect(x + w / 2 - 2, y - 17, 4, 3); }
      x += w + (rnd() < 0.25 ? 6 + rnd() * 18 : 1);
    }
  }
  const hz = g2.createLinearGradient(0, 300, 0, 512);
  hz.addColorStop(0, 'rgba(60,24,96,0)'); hz.addColorStop(1, 'rgba(96,34,128,0.85)');
  g2.fillStyle = hz; g2.fillRect(0, 300, 2048, 212);
  const skyTex = new T.CanvasTexture(sk);
  skyTex.wrapS = T.RepeatWrapping; skyTex.repeat.set(2, 1); skyTex.encoding = T.sRGBEncoding;
  const skyline = new T.Mesh(new T.CylinderGeometry(260, 260, 130, 64, 1, true), new T.MeshBasicMaterial({ map: skyTex, transparent: true, side: T.BackSide, fog: false, depthWrite: false }));
  skyline.position.y = 62; skyline.renderOrder = -9;
  scene.add(skyline);

  // the nearer blocks: dark towers with signs that really glow, close enough to lie in the puddles
  const near = [];
  const lit = (piece, heat) => { for (const f of piece.faces) { f.cap = GEO.NEON; f.heat = heat; } return piece; };
  for (let i = 0; i < 18; i++) {
    // each block is turned to face the plaza: its width lies across the view, its depth along it
    const a = (i / 18) * Math.PI * 2 + rnd() * 0.15, r = 58 + rnd() * 26, w = 9 + rnd() * 9, d = 9 + rnd() * 9, h = 16 + rnd() * 46, x = Math.cos(a) * r, z = Math.sin(a) * r, turn = -a + Math.PI / 2;
    near.push(GEO.place(GEO.box(w, h, d, { col: 27 }), x, -0.5, z, 0, turn, 0));
    const signs = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < signs; k++) { // tall sign boards on the face that looks at the plaza
      const sw = 1 + rnd() * 1.6, sh = 5 + rnd() * 12, sx = (rnd() - 0.5) * (w - sw - 1), sy = 3 + rnd() * Math.max(1, h - sh - 6), col = [24, 23, 21, 3, 28][Math.floor(rnd() * 5)];
      near.push(GEO.place(lit(GEO.box(sw, sh, 0.5, { col }), 0.75), x - Math.cos(a) * (d / 2 + 0.3) - Math.sin(a) * sx, sy, z - Math.sin(a) * (d / 2 + 0.3) + Math.cos(a) * sx, 0, turn, 0));
    }
    for (let k = 0; k < 3; k++) near.push(GEO.place(lit(GEO.box(w * 0.86, 0.35, 0.4, { col: k % 2 ? 26 : 23 }), 0.35), x - Math.cos(a) * (d / 2 + 0.25), h * (0.25 + k * 0.25), z - Math.sin(a) * (d / 2 + 0.25), 0, turn, 0));
  }
  scene.add(new T.Mesh(partGeometry(near), PART_MAT));

  // asphalt, drawn once: dark, grainy, with seams between slabs; and where the puddles are
  const make = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };
  const asphalt = make(512, (g) => {
    g.fillStyle = '#2b2e3c'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(150,160,190,0.07)' : 'rgba(0,0,0,0.12)'; const s = 1 + rnd() * 2; g.fillRect(rnd() * 512, rnd() * 512, s, s); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
    g.strokeStyle = 'rgba(120,130,160,0.10)'; g.lineWidth = 1;
    for (let i = 0; i < 30; i++) { g.beginPath(); let x = rnd() * 512, y = rnd() * 512, a = rnd() * 6.28; g.moveTo(x, y); for (let k = 0; k < 5; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * 20; y += Math.sin(a) * 20; g.lineTo(x, y); } g.stroke(); }
  });
  asphalt.repeat.set(55, 55); asphalt.encoding = T.sRGBEncoding;
  const puddles = make(512, (g) => { // green is how much asphalt covers the mirror: little in a puddle, most elsewhere
    g.fillStyle = 'rgb(0,214,0)'; g.fillRect(0, 0, 512, 512);
    g.filter = 'blur(9px)';
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgb(0,' + Math.round(70 + rnd() * 60) + ',0)'; g.beginPath(); g.ellipse(rnd() * 512, rnd() * 512, 16 + rnd() * 54, 10 + rnd() * 30, rnd() * 3.14, 0, 6.29); g.fill(); }
  });
  puddles.repeat.set(9, 9);
  const mirrorOn = !!(opt && opt.mirror) && !!T.Reflector;
  let mirror = null;
  if (mirrorOn) {
    mirror = new T.Reflector(new T.CircleGeometry(150, 48), { clipBias: 0.003, textureWidth: 1024, textureHeight: 576, color: lin(0x5a5f86) });
    mirror.rotation.x = -Math.PI / 2;
    scene.add(mirror);
  }
  const groundMat = new T.MeshLambertMaterial({ map: asphalt, alphaMap: mirrorOn ? puddles : null, transparent: mirrorOn });
  const ground = new T.Mesh(new T.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.006; ground.receiveShadow = true;
  scene.add(ground);

  // lines of light painted on the plaza: the edge of the ring, and two faint circles inside it
  const paint = (mesh, r, gr, b) => { mesh.material = new T.MeshBasicMaterial({ color: new T.Color(r, gr, b), fog: true }); mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.02; scene.add(mesh); return mesh; };
  paint(new T.Mesh(new T.RingGeometry(38.0, 38.3, 128)), 1.5, 0.16, 1.2);
  paint(new T.Mesh(new T.RingGeometry(12.0, 12.05, 96)), 0.05, 0.3, 0.38);
  paint(new T.Mesh(new T.RingGeometry(24.0, 24.05, 128)), 0.05, 0.26, 0.34);

  scene.add(new T.HemisphereLight(lin(0x6f86ee), lin(0x7a2a80), 0.85));
  const sun = new T.DirectionalLight(lin(0xc4d6ff), 2.3); // the moon and the glow of the city, cool and from above
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 130;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const rim = new T.DirectionalLight(lin(0xff3ad0), 1.0); // a magenta rim from behind, so figures stand off the dark
  rim.position.set(30, 14, 40);
  scene.add(rim);
  const pools = [[-9, -6, 0xff2bd6], [11, 7, 0x3df2ff], [3, -15, 0xffe14d], [-14, 12, 0x3df2ff], [17, -10, 0xff2bd6]];
  for (const [x, z, hex] of pools) { const l = new T.PointLight(lin(hex), 2.6, 19, 1.5); l.position.set(x, 3.4, z); scene.add(l); }

  // rain: short streaks falling through a box that travels with the eye
  const N = opt && opt.light ? 260 : 620, rp = new Float32Array(N * 6), drops = [];
  for (let i = 0; i < N; i++) drops.push([(rnd() - 0.5) * 60, rnd() * 22, (rnd() - 0.5) * 60, 17 + rnd() * 9]);
  const rg = new T.BufferGeometry();
  rg.setAttribute('position', new T.BufferAttribute(rp, 3));
  const rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: new T.Color(0.5, 0.62, 0.95), transparent: true, opacity: 0.3, depthWrite: false }));
  rain.frustumCulled = false;
  scene.add(rain);

  const lamp = new T.PointLight(lin(0xdfe6ff), 1.5, 11, 1.4); // a pool of light that goes where the wanderer goes, so the fight is never in the dark
  scene.add(lamp);

  return {
    KEY, sun, mirror,
    follow(x, z) { // the shadow box travels with the wanderer, in whole texels so shadows do not swim
      const step = 44 / 2048 * 8, fx = Math.round(x / step) * step, fz = Math.round(z / step) * step;
      sun.target.position.set(fx, 0, fz); sun.position.set(fx + KEY.x * 60, KEY.y * 60, fz + KEY.z * 60);
      sky.position.set(x, 0, z); skyline.position.x = x * 0.6; skyline.position.z = z * 0.6; lamp.position.set(x, 4.2, z + 1.5);
    },
    step(dt, x, z) {
      for (let i = 0; i < N; i++) {
        const d = drops[i];
        d[1] -= d[3] * dt; d[0] += 1.6 * dt;
        if (d[1] < 0) { d[1] += 22; d[0] = (rnd() - 0.5) * 60; d[2] = (rnd() - 0.5) * 60; }
        const o = i * 6, px = x + d[0], pz = z + d[2];
        rp[o] = px; rp[o + 1] = d[1]; rp[o + 2] = pz; rp[o + 3] = px - 0.06; rp[o + 4] = d[1] + 0.55; rp[o + 5] = pz;
      }
      rg.attributes.position.needsUpdate = true;
    },
    setMirror(on) { // without the mirror the street is simply dry asphalt: far cheaper to draw
      if (!mirror) return;
      mirror.visible = on; groundMat.alphaMap = on ? puddles : null; groundMat.transparent = on; groundMat.needsUpdate = true;
    },
  };
}
