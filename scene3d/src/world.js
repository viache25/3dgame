// The roof of the Sky Castle at night: a round duelling floor above the clouds, towers behind, a huge moon.
const FLOOR_R = 11;
const MOON_POS = v3(34, 27, -150);
const MOON_R = 15;

function makeEnv(renderer) {
  const s = new T.Scene();
  const g = new T.SphereGeometry(60, 24, 12);
  const c = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const h = p.getY(i) / 60;
    const top = [0.02, 0.03, 0.1], hor = [0.2, 0.13, 0.42], bot = [0.03, 0.02, 0.07];
    const a = h > 0 ? hor.map((v, k) => v + (top[k] - v) * Math.min(1, h * 1.6)) : hor.map((v, k) => v + (bot[k] - v) * Math.min(1, -h * 3));
    c.push(a[0], a[1], a[2]);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(c, 3));
  s.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const panel = (x, y, z, sz, r, gg, b) => {
    const m = new T.Mesh(new T.SphereGeometry(sz, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(r, gg, b) }));
    m.position.set(x, y, z);
    s.add(m);
  };
  const md = MOON_POS.clone().normalize().multiplyScalar(45);
  panel(md.x, md.y, md.z, 7, 7, 7.6, 9.5); // the moon
  panel(-34, 6, 22, 9, 2.2, 0.35, 1.6); // magenta from the hero's side
  panel(34, 3, 26, 9, 0.25, 1.2, 2.2); // cyan from the other
  panel(0, 26, 40, 12, 0.7, 0.6, 1.8); // violet from the front, above
  const pm = new T.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.035).texture;
  pm.dispose();
  return tex;
}

function buildWorld(scene, hdr) {
  const R = rng(11);
  const world = grp(scene, null, 'world');

  // ---- sky
  const sky = new T.Mesh(
    new T.SphereGeometry(500, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 top = vec3(0.004, 0.007, 0.030), mid = vec3(0.014, 0.022, 0.095), hor = vec3(0.075, 0.050, 0.200), low = vec3(0.012, 0.012, 0.050);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h));
          c = mix(c, top, smoothstep(0.18, 0.85, h));
          c = mix(c, low, smoothstep(0.0, -0.25, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  world.add(sky);

  // ---- stars
  {
    const n = 1400, pos = [], cl = [];
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, h = Math.pow(R(), 0.7) * 0.95 + 0.03, r = Math.sqrt(1 - h * h);
      pos.push(Math.cos(a) * r * 460, h * 460, Math.sin(a) * r * 460);
      const k = 0.5 + Math.pow(R(), 3) * 2.4, tint = R();
      cl.push(k * (0.8 + 0.2 * tint), k * 0.88, k * (1.0 - 0.15 * tint));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
    world.add(new T.Points(g, new T.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, toneMapped: false, fog: false, depthWrite: false })));
  }

  // ---- the moon
  let moon, halo;
  {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    x.beginPath();
    x.arc(256, 256, 254, 0, 7);
    x.clip();
    const g = x.createRadialGradient(200, 190, 20, 256, 256, 260);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#e6edff');
    g.addColorStop(1, '#a9bbee');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 22; i++) {
      const cx = 60 + R() * 392, cy = 60 + R() * 392, r = 10 + R() * R() * 70;
      const cg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0, 'rgba(110,130,200,0.30)');
      cg.addColorStop(0.7, 'rgba(110,130,200,0.16)');
      cg.addColorStop(1, 'rgba(110,130,200,0)');
      x.fillStyle = cg;
      x.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    moon = new T.Mesh(new T.CircleGeometry(MOON_R, 72), new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.35, 1.35, 1.45), toneMapped: false, fog: false, transparent: true }));
    moon.position.copy(MOON_POS);
    moon.lookAt(0, 2, 6);
    world.add(moon);
    halo = new T.Sprite(new T.SpriteMaterial({ map: dotTexture([[0, 'rgba(170,190,255,0.34)'], [0.28, 'rgba(140,160,255,0.12)'], [0.6, 'rgba(120,120,255,0.04)'], [1, 'rgba(100,100,255,0)']], 256), blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    halo.position.copy(MOON_POS).multiplyScalar(1.01);
    halo.scale.setScalar(MOON_R * 6.5);
    world.add(halo);
  }

  // ---- the sea of clouds
  {
    const tex = dotTexture([[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']], 128);
    for (let i = 0; i < 90; i++) {
      const a = R() * Math.PI * 2, r = 30 + R() * 190;
      const m = new T.SpriteMaterial({ map: tex, color: col(i % 3 ? 0x4b5cc4 : 0x8a6fe0, 0.5 + R() * 0.5), transparent: true, opacity: 0.32 + R() * 0.3, depthWrite: false, fog: false });
      const s = new T.Sprite(m);
      s.position.set(Math.cos(a) * r, -16 + R() * 10 + r * 0.02, Math.sin(a) * r);
      const w = 36 + R() * 70;
      s.scale.set(w, w * (0.16 + R() * 0.12), 1);
      world.add(s);
    }
  }

  // ---- the duelling floor: a dark mirror with a grid of light
  const mirror = {
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
    vertexShader: T.Reflector.ReflectorShader.vertexShader,
    fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv;
      void main(){ vec3 base = min(texture2DProj(tDiffuse, vUv).rgb, vec3(1.3)); gl_FragColor = vec4(base * color + vec3(0.003, 0.004, 0.012), 1.0); }`,
  };
  // without float render targets the mirror cannot be drawn: a plain dark floor instead
  const refl = hdr
    ? new T.Reflector(new T.CircleGeometry(FLOOR_R, 72), { textureWidth: 1024, textureHeight: 1024, color: new T.Color(0.17, 0.18, 0.28), clipBias: 0.003, multisample: 4, shader: mirror })
    : new T.Mesh(new T.CircleGeometry(FLOOR_R, 72), new T.MeshBasicMaterial({ color: new T.Color(0.006, 0.008, 0.024) }));
  refl.rotation.x = -Math.PI / 2;
  world.add(refl);
  {
    const N = 2048, PX = N / (2 * FLOOR_R), c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    const cx = N / 2;
    x.lineCap = 'round';
    for (let i = -FLOOR_R; i <= FLOOR_R; i++) {
      const major = i % 4 === 0;
      x.strokeStyle = major ? 'rgba(150,130,255,0.75)' : 'rgba(110,110,240,0.34)';
      x.lineWidth = major ? 3.2 : 1.6;
      x.beginPath();
      x.moveTo(cx + i * PX, 0); x.lineTo(cx + i * PX, N);
      x.moveTo(0, cx + i * PX); x.lineTo(N, cx + i * PX);
      x.stroke();
    }
    // fade the grid toward the rim
    x.globalCompositeOperation = 'destination-in';
    const fade = x.createRadialGradient(cx, cx, 0, cx, cx, cx);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    fade.addColorStop(0.93, 'rgba(0,0,0,0.18)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = fade;
    x.fillRect(0, 0, N, N);
    x.globalCompositeOperation = 'source-over';
    const ring = (r, style, w, dash) => {
      x.strokeStyle = style; x.lineWidth = w; x.setLineDash(dash || []);
      x.beginPath(); x.arc(cx, cx, r * PX, 0, 7); x.stroke(); x.setLineDash([]);
    };
    ring(10.45, 'rgba(70,220,255,0.85)', 5);
    ring(10.1, 'rgba(70,220,255,0.3)', 2);
    ring(4.6, 'rgba(160,120,255,0.55)', 3, [26, 20]);
    const hex = (wx, wz, r, style) => {
      x.strokeStyle = style; x.lineWidth = 5; x.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (k * Math.PI) / 3;
        const px = cx + (wx + Math.cos(a) * r) * PX, py = cx + (wz + Math.sin(a) * r * 0.9) * PX;
        k ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
    };
    hex(-1.7, 0, 1.05, 'rgba(255,95,200,0.85)');
    hex(1.7, 0, 1.05, 'rgba(255,70,95,0.85)');
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 8;
    const grid = new T.Mesh(new T.CircleGeometry(FLOOR_R, 72), new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.1, 1.1, 1.1), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = 0.006;
    world.add(grid);
    const sh = new T.Mesh(new T.CircleGeometry(FLOOR_R, 48), new T.ShadowMaterial({ opacity: 0.6 }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.003;
    sh.receiveShadow = true;
    world.add(sh);
  }

  // ---- stone: the platform, its parapet, the tower under it
  const stone = std(0x121632, { metalness: 0.15, roughness: 0.85 });
  const stoneL = std(0x1a1f45, { metalness: 0.15, roughness: 0.8 });
  const roofM = std(0x1e2258, { metalness: 0.3, roughness: 0.6 });
  const merge = (list) => T.BufferGeometryUtils.mergeBufferGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
  {
    add(world, new T.CylinderGeometry(FLOOR_R + 0.45, FLOOR_R + 0.9, 1.4, 48), stone, [0, -0.72, 0]);
    add(world, new T.CylinderGeometry(9.6, 6.5, 60, 20), stone, [0, -31, 0]);
    add(world, new T.TorusGeometry(FLOOR_R + 0.02, 0.035, 6, 120), glow(0x35e0ff, 1.0), [0, 0.03, 0], [Math.PI / 2, 0, 0]);
    const parts = [];
    const N = 40;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, r = FLOOR_R + 0.42;
      const low = box(1.9, 0.78, 0.5);
      low.translate(0, 0.39, 0); low.rotateY(-a + Math.PI / 2); low.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      parts.push(low);
      if (i % 2 === 0) {
        const m = box(0.95, 0.62, 0.5);
        m.translate(0, 0.78 + 0.31, 0); m.rotateY(-a + Math.PI / 2); m.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
        parts.push(m);
      }
    }
    add(world, merge(parts), stoneL);
  }

  // ---- lamp posts with the castle's wind curl
  {
    const pillar = [], curls = [];
    for (const deg of [48, 132, 12, 168, 215, 325]) {
      const a = deg * D, px = Math.cos(a) * 9.9, pz = -Math.sin(a) * 9.9;
      const p = new T.CylinderGeometry(0.11, 0.2, 2.7, 6);
      p.translate(px, 1.35, pz);
      pillar.push(p);
      const cap = new T.CylinderGeometry(0.26, 0.12, 0.16, 6);
      cap.translate(px, 2.78, pz);
      pillar.push(cap);
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40, r = 0.04 + 0.34 * t, an = t * Math.PI * 4.4;
        pts.push([Math.cos(an) * r, Math.sin(an) * r, 0]);
      }
      const c = tube(pts, 0.028, 5, 60);
      c.rotateY(Math.atan2(-px, -pz));
      c.translate(px, 3.32, pz);
      curls.push(c);
    }
    add(world, merge(pillar), stoneL);
    const cm = add(world, merge(curls), glow(0x35e0ff, 1.25));
    cm.castShadow = false;
  }

  // ---- crimson banners of the king
  {
    const poles = [], cloth = [];
    for (const deg of [26, 154]) {
      const a = deg * D, px = Math.cos(a) * 10.6, pz = -Math.sin(a) * 10.6;
      const p = new T.CylinderGeometry(0.05, 0.07, 6.2, 6);
      p.translate(px, 3.1, pz);
      poles.push(p);
      const s = new T.Shape();
      s.moveTo(0, 0); s.lineTo(1.0, 0); s.lineTo(1.0, -2.3); s.lineTo(0.5, -2.9); s.lineTo(0, -2.3); s.closePath();
      const g = new T.ShapeGeometry(s, 1);
      g.rotateY(Math.atan2(-px, -pz) + Math.PI / 2);
      g.translate(px, 6.0, pz);
      cloth.push(g);
    }
    add(world, merge(poles), stoneL);
    add(world, merge(cloth), new T.MeshStandardMaterial({ color: col(0x8e1230), roughness: 0.9, metalness: 0, side: T.DoubleSide, flatShading: true }));
  }

  // ---- the castle behind
  {
    const body = [], roofs = [], lit = [], flags = [];
    const tower = (x, z, r, top) => {
      const base = -34, h = top - base;
      const b = new T.CylinderGeometry(r, r * 1.12, h, 10);
      b.translate(x, base + h / 2, z);
      body.push(b);
      const ring = new T.CylinderGeometry(r * 1.2, r * 1.05, r * 0.5, 10);
      ring.translate(x, top + r * 0.1, z);
      body.push(ring);
      const roof = new T.ConeGeometry(r * 1.28, r * 2.6, 10);
      roof.translate(x, top + r * 0.35 + r * 1.3, z);
      roofs.push(roof);
      const tipY = top + r * 0.35 + r * 2.6;
      const pole = new T.CylinderGeometry(0.06, 0.06, r * 1.1, 4);
      pole.translate(x, tipY + r * 0.5, z);
      body.push(pole);
      const f = new T.BufferGeometry();
      f.setAttribute('position', new T.Float32BufferAttribute([x, tipY + r * 1.0, z, x + r * 0.9, tipY + r * 0.82, z, x, tipY + r * 0.62, z], 3));
      f.computeVertexNormals();
      flags.push(f);
      const n = 3 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const an = Math.atan2(-z + 6, -x) + (R() - 0.5) * 1.6;
        const w = new T.PlaneGeometry(r * 0.09, r * 0.2);
        w.rotateY(-an + Math.PI / 2);
        w.translate(x + Math.cos(an) * r * 1.03, top - r * (0.6 + R() * 3.2), z - Math.sin(an) * r * 1.03 * -1);
        lit.push(w);
      }
    };
    [[-12, -26, 1.6, 4.2], [-22, -36, 2.2, 6.5], [-1.5, -52, 3.0, 8], [-36, -30, 1.7, 3.2], [-48, -58, 3.2, 10], [20, -30, 1.8, 4.6], [31, -46, 2.6, 8], [47, -64, 3.4, 11], [58, -36, 1.9, 3.5], [-78, -90, 4.5, 15], [84, -100, 4.5, 16]].forEach((t) => tower(...t));
    const wall = (x1, z1, x2, z2, top) => {
      const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
      const w = box(L, 50, 1.4);
      w.rotateY(-Math.atan2(dz, dx));
      w.translate((x1 + x2) / 2, top - 25, (z1 + z2) / 2);
      body.push(w);
      for (let i = 0; i < L / 2.2; i++) {
        const m = box(1.1, 0.9, 1.5);
        m.translate(-L / 2 + 1 + i * 2.2, 0, 0);
        m.rotateY(-Math.atan2(dz, dx));
        m.translate((x1 + x2) / 2, top + 0.45, (z1 + z2) / 2);
        body.push(m);
      }
    };
    wall(-12, -26, -22, -36, 0.6); wall(-22, -36, -1.5, -52, 1.6); wall(-1.5, -52, 31, -46, 1.0); wall(31, -46, 20, -30, 0.4); wall(-36, -30, -22, -36, 0.2);
    add(world, merge(body), stone);
    add(world, merge(roofs), roofM);
    const lm = add(world, merge(lit), new T.MeshBasicMaterial({ color: col(0xffb860, 1.2), toneMapped: false, side: T.DoubleSide }));
    lm.castShadow = false;
    const fm = add(world, merge(flags), new T.MeshBasicMaterial({ color: col(0x35e0ff, 0.9), toneMapped: false, side: T.DoubleSide }));
    fm.castShadow = false;
  }

  // ---- light
  const moonL = new T.DirectionalLight(col(0xc6d4ff), 2.3);
  moonL.position.set(6.5, 10.5, -12);
  moonL.castShadow = true;
  moonL.shadow.mapSize.set(2048, 2048);
  Object.assign(moonL.shadow.camera, { left: -7, right: 7, top: 7, bottom: -4, near: 2, far: 40 });
  moonL.shadow.bias = -0.0006;
  moonL.shadow.normalBias = 0.02;
  scene.add(moonL);
  const fill = new T.DirectionalLight(col(0x8f86ff), 0.95);
  fill.position.set(-4, 5, 9);
  scene.add(fill);
  const hemi = new T.HemisphereLight(col(0x5868d8), col(0x1e1238), 0.6);
  scene.add(hemi);
  return { world, refl, moonL, fill, hemi, moon, halo };
}
