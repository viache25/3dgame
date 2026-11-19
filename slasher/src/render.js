// Drawing: turns pieces into meshes, makes fresh cuts glow and cool, and holds the sparks, dust and blade trails.
const T = THREE;
const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
const PAL = [
  0xb8603c, 0x7a3524, 0x21100c, 0xffb060, // 0 clay, 1 clay band, 2 clay inside, 3 eyes
  0xa8977f, 0x362b27, 0x8a9448, 0x3d2f17, // 4 stone, 5 stone inside, 6 reed, 7 reed inside (insides are dark: the blade sears what it opens)
  0xc48a56, 0x2f5a78, 0x3a1d14, 0x1c2350, // 8 jar, 9 jar glaze, 10 jar inside, 11 indigo cloth
  0xc22f3a, 0xdcc47c, 0xd7a988, 0xe4edf7, // 12 red sash, 13 straw, 14 skin, 15 steel
  0x12142a, 0x4b4458, 0xc9a044, 0xe8dcc0, // 16 dark wraps, 17 basalt, 18 gold, 19 bone paint
  0x2a2233,                               // 20 basalt inside
].map(lin);
const SHARED = { uTime: { value: 0 } };

function partGeometry(pieces) {
  let tris = 0;
  for (const p of pieces) for (const f of p.faces) tris += f.p.length / 3 - 2;
  const pos = new Float32Array(tris * 9), nor = new Float32Array(tris * 9), col = new Float32Array(tris * 9), cut = new Float32Array(tris * 6);
  let k = 0, c = 0;
  for (const p of pieces) for (const f of p.faces) {
    const q = f.p, n = f.n, rgb = PAL[f.col] || PAL[0], glow = f.cap >= 0 ? (f.heat || 1) : 0, when = f.cap >= 0 ? f.cap : 0;
    for (let i = 3; i + 3 < q.length; i += 3) {
      for (const j of [0, i, i + 3]) {
        pos[k] = q[j]; pos[k + 1] = q[j + 1]; pos[k + 2] = q[j + 2];
        nor[k] = n[0]; nor[k + 1] = n[1]; nor[k + 2] = n[2];
        col[k] = rgb.r; col[k + 1] = rgb.g; col[k + 2] = rgb.b;
        cut[c] = when; cut[c + 1] = glow;
        k += 3; c += 2;
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.BufferAttribute(nor, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setAttribute('aCut', new T.BufferAttribute(cut, 2));
  g.computeBoundingSphere();
  return g;
}

// One material for every sliceable thing. A face cut at time t starts white-hot and cools to dark over a few seconds.
const PART_MAT = (function () {
  const m = new T.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SHARED.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCut;\nvarying vec2 vCut;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCut = aCut;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vCut;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (vCut.y > 0.0) {
        float age = vCut.x > 9.0e5 ? 0.45 : max(uTime - vCut.x, 0.0);
        vec3 hot = mix(vec3(1.0, 0.1, 0.01), vec3(1.0, 0.45, 0.1), exp(-age * 1.4));
        totalEmissiveRadiance += hot * vCut.y * (2.6 * exp(-age * 0.55) + 0.5 * exp(-age * 0.1));
      }`);
  };
  return m;
})();

function partMesh(pieces) {
  const mesh = new T.Mesh(partGeometry(pieces), PART_MAT);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// Round soft dots with their own size and fade: sparks (added light) and dust (plain).
function makeDots(scene, max, additive) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  const vel = new Float32Array(max * 3), life = new Float32Array(max), span = new Float32Array(max), drag = new Float32Array(max), grav = new Float32Array(max), size0 = new Float32Array(max), a0 = new Float32Array(max);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('aCol', new T.BufferAttribute(col, 4));
  g.setAttribute('aSize', new T.BufferAttribute(size, 1));
  const mat = new T.ShaderMaterial({
    uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
    vertexShader: 'attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vCol; void main(){ vCol = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec4 vCol; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vCol.rgb, vCol.a * smoothstep(0.5, 0.12, d)); }',
  });
  const pts = new T.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = additive ? 6 : 5;
  scene.add(pts);
  let next = 0;
  return {
    mat,
    add(x, y, z, vx, vy, vz, r, gcol, b, alpha, sz, t, dr, gr) {
      const i = next; next = (next + 1) % max;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      col[i * 4] = r; col[i * 4 + 1] = gcol; col[i * 4 + 2] = b; a0[i] = alpha; size0[i] = sz; life[i] = t; span[i] = t; drag[i] = dr; grav[i] = gr;
    },
    step(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
        life[i] -= dt;
        const k = Math.max(0, life[i] / span[i]), d = Math.max(0, 1 - drag[i] * dt);
        vel[i * 3] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d - grav[i] * dt; vel[i * 3 + 2] *= d;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.35; }
        col[i * 4 + 3] = a0[i] * (additive ? k : Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * Math.min(1, (1 - k) * 8));
        size[i] = size0[i] * (additive ? 0.35 + 0.65 * k : 1 + (1 - k) * 1.6);
      }
      g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
    },
  };
}

// The light the blade leaves behind: a fan in the plane of the cut that opens with the swing and fades.
function makeTrails(scene, count) {
  const SEG = 22, list = [];
  const mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  for (let i = 0; i < count; i++) {
    const g = new T.BufferGeometry(), pos = new Float32Array((SEG + 1) * 6), col = new Float32Array((SEG + 1) * 6), idx = [];
    for (let s = 0; s < SEG; s++) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(idx);
    const mesh = new T.Mesh(g, mat);
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 7;
    scene.add(mesh);
    list.push({ mesh, pos, col, age: 9, o: null });
  }
  let next = 0;
  return {
    // o: { px,py,pz (pivot), fx,fy,fz (middle of the swing), sx,sy,sz (side the swing goes to), a0, a1, r0, r1, T (swing time) }
    add(o) { const t = list[next]; next = (next + 1) % count; t.o = o; t.age = 0; t.mesh.visible = true; return t; },
    step(dt) {
      for (const t of list) {
        if (!t.mesh.visible) continue;
        t.age += dt;
        const o = t.o, open = Math.min(1, t.age / o.T), fade = Math.max(0, 1 - Math.max(0, t.age - o.T) / 0.2);
        if (fade <= 0) { t.mesh.visible = false; continue; }
        for (let s = 0; s <= SEG; s++) {
          const u = s / SEG, a = o.a0 + (o.a1 - o.a0) * u * open, c = Math.cos(a), sn = Math.sin(a);
          const dx = o.fx * c + o.sx * sn, dy = o.fy * c + o.sy * sn, dz = o.fz * c + o.sz * sn, i = s * 6;
          t.pos[i] = o.px + dx * o.r0; t.pos[i + 1] = o.py + dy * o.r0; t.pos[i + 2] = o.pz + dz * o.r0;
          t.pos[i + 3] = o.px + dx * o.r1; t.pos[i + 4] = o.py + dy * o.r1; t.pos[i + 5] = o.pz + dz * o.r1;
          const lead = Math.pow(u, 2.2) * fade; // brightest at the blade, dim where it has been
          t.col[i] = 0.35 * lead; t.col[i + 1] = 0.09 * lead; t.col[i + 2] = 0.02 * lead;
          t.col[i + 3] = 1.7 * lead; t.col[i + 4] = 0.62 * lead; t.col[i + 5] = 0.14 * lead;
        }
        t.mesh.geometry.attributes.position.needsUpdate = true; t.mesh.geometry.attributes.color.needsUpdate = true;
      }
    },
  };
}
