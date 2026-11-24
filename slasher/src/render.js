// Drawing: turns pieces into meshes, makes fresh cuts glow and cool, and holds the sparks, dust and blade trails.
const T = THREE;
const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
const PAL = [
  0x3d4353, 0x79849c, 0x0c0e15, 0xff2d55, // 0 armour, 1 plates, 2 inside of a synth, 3 red light
  0x5a6072, 0x191b23, 0x3df2ff, 0x082a30, // 4 concrete, 5 inside of concrete, 6 a tube of light, 7 inside of a tube
  0x3a4252, 0xffd23f, 0x13151b, 0x2a2e48, // 8 drum, 9 hazard yellow, 10 inside of a drum, 11 the wanderer's coat
  0xff2bd6, 0x4a5066, 0xc9a48c, 0xe4edf7, // 12 magenta, 13 grey plate, 14 skin, 15 steel
  0x16181f, 0x4a3a5c, 0xd9a441, 0xd9dde6, // 16 dark wraps, 17 heavy armour, 18 brass, 19 white plate
  0x120f18, 0xffe14d, 0x6a2f50,           // 20 inside of heavy armour, 21 yellow light, 22 the colossus
  0x3df2ff, 0xff2bd6, 0xff8a1e, 0xffc46b, // 23 cyan light, 24 magenta light, 25 orange light, 26 warm window
  0x0d0f18, 0x5dff8f, 0x1b1d26,           // 27 a tower at night, 28 green light, 29 asphalt
  0x14151e, 0x30354a, 0x1c1e2c, 0x0b0b10, // 30 the wanderer's coat, 31 his armour, 32 his hat, 33 what his fire is set in
  0xb0914e, 0x241a17, 0xb3aa96, 0xa8231c, // 34 straw, 35 dark cloth, 36 bone white, 37 red cord
  0x3b2a1f, 0x7d6534,                     // 38 dark wood, 39 straw in shadow
  0x16301f, 0x24482c, 0x33261d, 0x59635a, // 40 leaves in the dark, 41 leaves, 42 bark, 43 mossy stone
  0x5d8a3a, 0x9fb86a, 0x6e4c2f, 0xb08a58, // 44 bamboo, 45 inside of bamboo, 46 wood, 47 inside of wood
  0xffcf8a, 0xb5271b, 0x12111c, 0x74140f, // 48 lit paper, 49 shrine red, 50 ink cloth, 51 dark red lacquer
  0xd9d3c6, 0x2c2a3a,                     // 52 pale paper, 53 cloth catching light
  0x1b1b25, 0xa81d16, 0x6c110e, 0x868c97, // 54 black lacquer, 55 the red of the mask, 56 the same in its hollows, 57 grey hair
  0x5a5f6a, 0xe8e2d0, 0xc9a23f,           // 58 grey hair in shadow, 59 tooth, 60 gold
].map(lin);
// uHotA / uHotB: what a fresh cut and a cooling cut glow with. They follow the style of the blade.
const SHARED = { uTime: { value: 0 }, uHotA: { value: new T.Vector3(1.0, 0.45, 0.1) }, uHotB: { value: new T.Vector3(1.0, 0.1, 0.01) } };

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
    sh.uniforms.uTime = SHARED.uTime; sh.uniforms.uHotA = SHARED.uHotA; sh.uniforms.uHotB = SHARED.uHotB;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCut;\nvarying vec2 vCut;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCut = aCut;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uHotA, uHotB;\nvarying vec2 vCut;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      if (vCut.y > 0.0) {
        if (vCut.x > 2.5e6) totalEmissiveRadiance += vColor.rgb * vCut.y * 2.4; // a light of its own colour: signs, visors, tubes
        else {
          bool blade = vCut.x > 1.5e6, ember = vCut.x > 9.0e5 && !blade; // the wanderer's blade and trim; and a steady warm light
          float age = (blade || ember) ? 0.45 : max(uTime - vCut.x, 0.0);
          vec3 hot = mix(ember ? vec3(1.0, 0.1, 0.01) : uHotB, ember ? vec3(1.0, 0.45, 0.1) : uHotA, exp(-age * 1.4));
          totalEmissiveRadiance += hot * vCut.y * (2.6 * exp(-age * 0.55) + 0.5 * exp(-age * 0.1));
        }
      }`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { // moonlight along every edge that turns away from the eye, so a dark figure still has an outline
        float rimK = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        totalEmissiveRadiance += vec3(0.34, 0.5, 0.8) * rimK * rimK * rimK * 0.5;
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
