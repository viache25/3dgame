// The game itself: the loop, the swipe that becomes a cut, the idols, the waves, the camera and the HUD.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('gl'), ink = $('ink'), stage = $('stage');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { $('fail').hidden = false; return; }
  const TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (TOUCH) document.body.classList.add('touch');
  const PR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2);
  renderer.setPixelRatio(PR);
  renderer.outputEncoding = T.LinearEncoding; // the last pass tone-maps and encodes
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(40, 16 / 9, 0.3, 1600);
  const W = buildWorld(scene);
  if (TOUCH) W.sun.shadow.mapSize.set(1024, 1024);
  const hdr = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const rt = new T.WebGLRenderTarget(4, 4, hdr ? { type: T.HalfFloatType, samples: 4 } : {});
  const composer = new T.EffectComposer(renderer, rt);
  composer.setPixelRatio(PR);
  composer.addPass(new T.RenderPass(scene, camera));
  const bloom = new T.UnrealBloomPass(new T.Vector2(4, 4), 0.62, 0.55, 1.0);
  composer.addPass(bloom);
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, hurt: { value: 0 }, calm: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, hurt, calm; varying vec2 vUv;
      vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){
        c = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777) * (c * exposure / 0.6);
        c = fit(c);
        return clamp(mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602) * c, 0.0, 1.0);
      }
      void main(){
        vec3 c = aces(texture2D(tDiffuse, vUv).rgb * (1.0 - 0.2 * calm));
        vec2 q = vUv - 0.5;
        float edge = smoothstep(0.3, 0.95, length(q * vec2(1.0, 0.9)) * 1.25);
        float grey = dot(c, vec3(0.3, 0.55, 0.15));
        c = mix(c, mix(vec3(grey), c, 0.78) * vec3(0.93, 0.98, 1.1), calm * 0.8);   // slowed time: colder, quieter
        c *= 1.0 - (0.42 + 0.3 * calm) * edge;
        c = mix(c, vec3(0.75, 0.04, 0.03), hurt * edge * 0.85);
        c = pow(c, vec3(1.0 / 2.2));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);

  const SPARKS = makeDots(scene, 900, true), DUST = makeDots(scene, 260, false), TRAILS = makeTrails(scene, 8);

  // ---- state
  const STANDOFF = 1.35, ARENA = 38, TOP = 3.0, MAX_PARTS = TOUCH ? 150 : 240; // TOP: how high the blade reaches
  const CUT = { minPiece: 2.5e-4, minHalf: 2e-5, tol: 0.012 };
  const S = { mode: 'title', time: 0, real: 0, scale: 1, stop: 0, slowT: 0, focusOn: false, focusK: 0, focusHeld: false, focusLock: false, shake: 0, wave: 0, queue: [], spawnT: 0, next: 0, kills: 0, parts: 0, best: 0, paused: false, hurtK: 0, xp: 0, level: 1, need: 8, pending: 0, choosing: false, choice: null, autoPick: false };
  const P = { x: 0, z: 0, yaw: 0, hp: 100, maxHp: 100, focus: 1, speed: 0, phase: 0, dash: 0, dashCd: 0, dx: 0, dz: 1, invul: 0, kx: 0, kz: 0, lunge: null, sw: null, nextSlash: 0, queue: null, flip: 0, dead: false, rig: null, up: {}, reach: 2.9, lungeMax: 3.8, drain: 0.24, run: 6.3, dashGap: 0.6, leech: 0, slowKill: 0.3 };
  const bodies = [], enemies = [], solids = [];
  const keys = {};
  let vw = 1, vh = 1, seed = 20261119, pr = PR;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k, ease = (k) => k * k * (3 - 2 * k);
  try { S.best = +localStorage.getItem('blade-clay-best') || 0; } catch (e) { S.best = 0; }

  // ---- bodies
  function addBody(world, o) {
    const b = PHYS.make(world, o);
    b.mesh = partMesh(b.pieces);
    b.mesh.position.set(b.x, b.y, b.z);
    scene.add(b.mesh);
    bodies.push(b);
    return b;
  }
  function removeBody(b) {
    const i = bodies.indexOf(b);
    if (i >= 0) bodies.splice(i, 1);
    scene.remove(b.mesh); b.mesh.geometry.dispose();
    if (b.solid && b.solid.body === b) b.solid.body = null;
  }
  function clearWorld() {
    for (const b of bodies.slice()) removeBody(b);
    for (const e of enemies) if (!e.dead) { scene.remove(e.rig.root); MODELS.dispose(e.rig); }
    enemies.length = 0; solids.length = 0;
  }
  function prop(pieces, x, z, r) {
    const world = pieces.map((p) => GEO.shifted(p, x, 0, z));
    const b = addBody(world, { anchored: true, time: 0, kind: 'prop' });
    if (r) { b.solid = { x, z, r, body: b }; solids.push(b.solid); }
    return b;
  }
  function buildProps() {
    seed = 77;
    for (let i = 0; i < 9; i++) { const a = i * 0.698 + 0.3, r = 8.5 + (i % 3) * 5.5; prop(MODELS.props.pillar(2.4 + rnd() * 1.4), Math.cos(a) * r, Math.sin(a) * r, 0.56); }
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + 0.9, r = 6 + (i % 2) * 9, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      for (let k = 0; k < 3; k++) { const s = 0.75 + rnd() * 0.55; prop(MODELS.props.jar(s), cx + (rnd() - 0.5) * 2.2, cz + (rnd() - 0.5) * 2.2, 0.36 * s); }
    }
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785 + 0.15, r = 11 + (i % 4) * 4.5, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      for (let k = 0; k < 7; k++) prop(MODELS.props.reed(2.3 + rnd() * 2, (rnd() - 0.5) * 0.14, rnd() * 6.28), cx + (rnd() - 0.5) * 1.7, cz + (rnd() - 0.5) * 1.7, 0);
    }
  }

  // ---- the wanderer
  const katana = MODELS.katana();
  scene.add(katana);
  function newHero() {
    if (P.rig) { scene.remove(P.rig.root); MODELS.dispose(P.rig); }
    P.rig = MODELS.makeRig(MODELS.hero());
    scene.add(P.rig.root);
    Object.assign(P, { x: 0, z: 0, yaw: Math.PI, hp: P.maxHp, focus: 1, speed: 0, dash: 0, dashCd: 0, invul: 0, kx: 0, kz: 0, lunge: null, sw: null, queue: null, dead: false });
    katana.visible = true;
  }
  // ---- what the blade learns: each level offers three of these
  const UPS = [
    { id: 'long', name: 'Длинный клинок', text: 'Клинок достаёт на 18% дальше', max: 4 },
    { id: 'twin', name: 'Двойной срез', text: 'Рядом с каждым разрезом проходит ещё один', max: 2 },
    { id: 'whirl', name: 'Рывок-срез', text: 'Рывок режет всех, мимо кого пронёсся', max: 1 },
    { id: 'calm', name: 'Долгий вдох', text: 'Фокус тратится на треть медленнее', max: 3 },
    { id: 'bone', name: 'Крепкая кость', text: '+30 к жизни и полное лечение', max: 4 },
    { id: 'wind', name: 'Лёгкие ноги', text: 'Бег быстрее на 12%, рывок чаще', max: 3 },
    { id: 'thirst', name: 'Жар клинка', text: 'Каждый сражённый лечит на 3', max: 3 },
    { id: 'leap', name: 'Дальний выпад', text: 'Выпад к цели на 40% дальше', max: 2 },
    { id: 'chain', name: 'Застывший миг', text: 'После смертельного удара время стоит вдвое дольше', max: 2 },
  ];
  function applyUps() {
    const u = P.up;
    P.reach = 2.9 * (1 + 0.18 * u.long); P.lungeMax = 3.8 * (1 + 0.4 * u.leap); P.drain = 0.24 * Math.pow(0.67, u.calm);
    P.maxHp = 100 + 30 * u.bone; P.run = 6.3 * (1 + 0.12 * u.wind); P.dashGap = 0.6 * Math.pow(0.75, u.wind); P.leech = 3 * u.thirst; P.slowKill = 0.3 * (1 + u.chain);
    katana.scale.set(1, 1 + 0.18 * u.long, 1);
  }
  function resetUps() { P.up = {}; for (const u of UPS) P.up[u.id] = 0; applyUps(); }
  function gainXp(n) { S.xp += n; while (S.xp >= S.need) { S.xp -= S.need; S.level++; S.need = 8 + (S.level - 1) * 5; S.pending++; } }
  function openChoice() {
    const pool = UPS.filter((u) => P.up[u.id] < u.max);
    if (!pool.length) { S.pending = 0; return; }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    S.choice = pool.slice(0, 3); S.choosing = true;
    if (S.autoPick) { choose(0); return; }
    const box = $('cards');
    box.textContent = '';
    S.choice.forEach((u, i) => {
      const b = document.createElement('button'), k = document.createElement('span'), nm = document.createElement('b'), tx = document.createElement('span'), lv = document.createElement('i');
      b.type = 'button'; b.className = 'card'; b.id = 'card' + (i + 1);
      k.className = 'num for-keys'; k.textContent = String(i + 1);
      nm.textContent = u.name; tx.textContent = u.text;
      lv.textContent = P.up[u.id] ? 'уже ' + P.up[u.id] + ' из ' + u.max : 'новое';
      b.append(k, nm, tx, lv);
      b.addEventListener('click', () => choose(i));
      box.append(b);
    });
    $('levelNum').textContent = S.level - S.pending + 1;
    $('levelup').hidden = false;
    swipe = null; stick = null; showStick();
    for (const k in keys) keys[k] = false;
    S.focusHeld = false;
    SFX.gong();
  }
  function choose(i) {
    if (!S.choosing || !S.choice || !S.choice[i]) return;
    const u = S.choice[i];
    P.up[u.id]++; applyUps();
    if (u.id === 'bone') P.hp = P.maxHp;
    S.pending--; S.choosing = false; S.choice = null;
    $('levelup').hidden = true;
    hudKey = '';
  }

  const DOWN = new T.Vector3(0, -1, 0), UP = new T.Vector3(0, 1, 0);
  const v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), q1 = new T.Quaternion(), m1 = new T.Matrix4();
  function aim(bone, target) { // turn a limb so that it points at a place in the world
    bone.parent.updateWorldMatrix(true, false);
    m1.copy(bone.parent.matrixWorld).invert();
    v1.copy(target).applyMatrix4(m1).sub(bone.position).normalize();
    bone.quaternion.setFromUnitVectors(DOWN, v1);
  }
  const hilt = new T.Vector3(), bladeDir = new T.Vector3();
  function poseHero(dt) {
    const b = P.rig.bones, run = clamp(P.speed / 6, 0, 1), ph = P.phase, s = Math.sin(ph), c = Math.cos(ph);
    P.rig.root.position.set(P.x, 0, P.z);
    P.rig.root.rotation.y = P.yaw;
    const dash = P.dash > 0 || P.lunge ? 1 : 0;
    b.hips.position.y = b.hips.rest[1] + Math.abs(s) * 0.035 * run - 0.05 * run - dash * 0.12;
    b.hips.rotation.x = 0.16 * run + dash * 0.5;
    b.chest.rotation.set(0.1 * run, s * 0.12 * run, 0);
    b.head.rotation.x = -0.14 * run - dash * 0.35;
    b.thighL.rotation.x = -s * 0.85 * run; b.shinL.rotation.x = Math.max(0, c) * 1.1 * run + 0.06;
    b.thighR.rotation.x = s * 0.85 * run; b.shinR.rotation.x = Math.max(0, -c) * 1.1 * run + 0.06;
    b.armL.rotation.set(s * 0.7 * run, 0, 0.1); b.foreL.rotation.set(-0.3 - 0.5 * run, 0, 0);
    b.scarf.rotation.x = clamp(P.speed * 0.17 + dash * 0.8, 0, 1.35) + Math.sin(S.real * 9) * 0.1 * (0.2 + run);
    P.rig.root.updateMatrixWorld(true);
    const sw = P.sw;
    if (sw) {
      sw.t += dt;
      const k = clamp(sw.t / sw.T, 0, 1), a = lerp(sw.a0, sw.a1, 1 - (1 - k) * (1 - k));
      bladeDir.copy(sw.f).multiplyScalar(Math.cos(a)).addScaledVector(sw.s, Math.sin(a));
      b.chest.rotation.y = lerp(-0.55, 0.55, k) * sw.turn;
      P.rig.root.updateMatrixWorld(true);
      // the grip follows the swing but never leaves the reach of the arms; the trail shows the true plane of the cut
      v2.setFromMatrixPosition(b.chest.matrixWorld); v2.y += 0.3;
      hilt.copy(sw.pv).addScaledVector(bladeDir, 0.42).sub(v2);
      if (hilt.length() > 0.5) hilt.setLength(0.5);
      hilt.add(v2);
      aim(b.armR, hilt); b.foreR.rotation.set(0, 0, 0);
      aim(b.armL, hilt); b.foreL.rotation.set(0, 0, 0);
      katana.position.copy(hilt);
      katana.quaternion.setFromUnitVectors(UP, bladeDir);
      if (sw.t > sw.T + 0.13) P.sw = null;
    } else {
      // carried low and behind while running, low and ahead while standing
      b.armR.rotation.set(0.35 * run - 0.15, 0, -0.18); b.foreR.rotation.set(-0.55 + 0.25 * run, 0, 0);
      P.rig.root.updateMatrixWorld(true);
      hilt.set(0, -0.3, 0).applyMatrix4(b.foreR.matrixWorld);
      const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), k = lerp(0.85, -0.9, run);
      bladeDir.set(fx * k - fz * 0.28, -0.42 + 0.2 * run, fz * k + fx * 0.28).normalize();
      q1.setFromUnitVectors(UP, bladeDir);
      const kk = 1 - Math.exp(-dt * 22);
      katana.position.lerp(hilt, Math.max(kk, 0.6));
      katana.quaternion.slerp(q1, kk);
    }
  }

  // ---- idols
  // grunt: walks up and swings. imp: small and fast, comes in packs. thrower: keeps its distance and lobs fire that can be cut in the air.
  // brute: slow and heavy. colossus: too tall to reach above the hips; its legs go first, then it is finished on the ground.
  const KINDS = {
    grunt: { scale: 1, speed: 2.6, range: 1.55, dmg: 12, wind: 0.5, xp: 2 },
    imp: { scale: 0.56, speed: 4.6, range: 1.0, dmg: 6, wind: 0.3, xp: 1 },
    thrower: { scale: 0.98, speed: 2.3, range: 1.4, dmg: 10, wind: 0.75, xp: 3 },
    brute: { scale: 1.5, speed: 1.75, range: 2.2, dmg: 26, wind: 0.72, xp: 5 },
    colossus: { scale: 3.2, speed: 1.3, range: 3.6, dmg: 34, wind: 1.0, xp: 25 },
  };
  function spawnIdol(kind) {
    if (!KINDS[kind]) kind = 'grunt';
    const K = KINDS[kind], giant = kind === 'colossus', rig = MODELS.makeRig(MODELS.idol(kind)), scale = K.scale * (giant ? 1 : 0.94 + rnd() * 0.12);
    let x = 0, z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const a = rnd() * Math.PI * 2, r = (giant ? 12 : 9) + rnd() * 4.5;
      x = P.x + Math.cos(a) * r; z = P.z + Math.sin(a) * r;
      if (Math.hypot(x, z) < ARENA - 3 && !solids.some((s) => s.body && Math.hypot(s.x - x, s.z - z) < s.r + 1)) break;
    }
    const e = { rig, kind, brute: kind === 'brute', scale, x, z, yaw: Math.atan2(P.x - x, P.z - z), state: 'rise', t: 0, phase: rnd() * 6, walk: 0, atk: 0, hit: 0, struck: false, dead: false, vx: 0, vz: 0, arm: 'R',
      speed: K.speed * (0.94 + rnd() * 0.12), range: K.range, dmg: K.dmg, wind: K.wind, xp: K.xp, rad: 0.42 * scale, riseT: giant ? 2.2 : 1.15, cool: 0.6 + rnd(), ranged: false, down: false, vy: 0, dropTo: 0 };
    rig.root.scale.setScalar(scale);
    rig.root.position.set(x, -2 * scale, z);
    rig.root.rotation.y = e.yaw;
    scene.add(rig.root);
    enemies.push(e);
    SFX.rise();
    return e;
  }
  function poseIdol(e) {
    const b = e.rig.bones, w = e.walk, s = Math.sin(e.phase), c = Math.cos(e.phase), A = e.atk, H = e.hit, giant = e.kind === 'colossus';
    b.hips.position.y = b.hips.rest[1] + Math.abs(s) * 0.03 * w;
    let tR = s * 0.5 * w, sR = Math.max(0, -c) * 0.75 * w;
    if (giant && !e.down) { tR = lerp(lerp(tR, -1.15, A), 0.05, H); sR = lerp(lerp(sR, 1.35, A), 0, H); } // the colossus lifts a foot and brings it down
    b.thighL.rotation.x = -s * 0.5 * w; b.shinL.rotation.x = Math.max(0, c) * 0.75 * w;
    b.thighR.rotation.x = tR; b.shinR.rotation.x = sR;
    let aL = s * 0.4 * w, aR = -s * 0.4 * w, fL = -0.25 - 0.15 * w, fR = -0.25 - 0.15 * w, lean = 0.09 * w;
    const both = giant && e.down, arms = !giant || e.down;
    if (both) { aL = aR = -1.25; fL = fR = -0.3; }
    if (arms && (e.arm === 'R' || both)) { aR = lerp(lerp(aR, -2.8, A), -0.6, H); fR = lerp(lerp(fR, -0.95, A), -0.1, H); }
    if (arms && (e.arm === 'L' || both)) { aL = lerp(lerp(aL, -2.8, A), -0.6, H); fL = lerp(lerp(fL, -0.95, A), -0.1, H); }
    if (arms) lean += -0.24 * A * (1 - H) + 0.55 * H * (e.arm ? 1 : 1.4);
    else lean += -0.1 * A * (1 - H);
    if (e.state === 'stagger') lean -= 0.4 * Math.sin(Math.min(1, e.t / 0.6) * Math.PI);
    b.armL.rotation.x = aL; b.armR.rotation.x = aR; b.foreL.rotation.x = fL; b.foreR.rotation.x = fR;
    b.armL.rotation.z = 0.12; b.armR.rotation.z = -0.12;
    b.chest.rotation.set(lean, s * 0.07 * w, Math.sin(S.time * 1.7 + e.phase) * 0.02);
    b.head.rotation.x = -lean * 0.5;
  }
  function refreshArms(e) {
    const has = (n) => e.rig.bones[n].pieces.some((p) => p.tag && p.tag.fist);
    e.arm = has('foreR') ? 'R' : has('foreL') ? 'L' : null;
    if (!e.arm && !e.armless) { e.armless = true; e.range = Math.min(e.range, 1.25 * e.scale); e.dmg = Math.round(e.dmg * 0.6); }
  }
  // a blow on the ground: dust flies out in a ring and the wanderer is hurt if he stands inside it
  function quake(x, z, radius, dmg) {
    SFX.quake(); S.shake = Math.max(S.shake, 0.85);
    for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2 + rnd() * 0.2, k = radius * (2.2 + rnd()); DUST.add(x + Math.cos(a) * 0.6, 0.15, z + Math.sin(a) * 0.6, Math.cos(a) * k, 0.5 + rnd() * 1.2, Math.sin(a) * k, 0.84, 0.66, 0.46, 0.3, 0.7, 0.9, 2.6, -0.2); }
    if (!P.dead && Math.hypot(P.x - x, P.z - z) < radius) hurt(dmg, x, z);
  }
  const SHOT = MODELS.shot();
  function throwShot(e) {
    const f = fistPos(e), T0 = clamp(Math.hypot(P.x - f.x, P.z - f.z) / 12, 0.5, 1.1);
    const tx = P.x + (P.lunge || P.dash > 0 ? 0 : P.dx * P.speed * T0 * 0.55), tz = P.z + (P.lunge || P.dash > 0 ? 0 : P.dz * P.speed * T0 * 0.55);
    const b = addBody([GEO.shifted(SHOT, f.x, f.y, f.z)], { time: S.time, kind: 'shot', v: [(tx - f.x) / T0, (1.0 - f.y) / T0 + 0.5 * PHYS.G * T0, (tz - f.z) / T0], w: [(rnd() - 0.5) * 9, (rnd() - 0.5) * 9, (rnd() - 0.5) * 9] });
    b.dmg = e.dmg;
    SFX.dash();
  }
  function updateIdols(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt; e.cool = Math.max(0, e.cool - dt);
      const dx = P.x - e.x, dz = P.z - e.z, dist = Math.hypot(dx, dz) || 1e-3, giant = e.kind === 'colossus';
      let turn = 0, go = 0;
      const want = Math.atan2(dx, dz);
      let da = want - e.yaw; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (e.state === 'rise') {
        const k = Math.min(1, e.t / e.riseT);
        if (!e.down) e.rig.root.position.y = -2 * e.scale * (1 - ease(k));
        if (rnd() < dt * 30 * e.scale) DUST.add(e.x + (rnd() - 0.5) * 0.9 * e.scale, 0.1, e.z + (rnd() - 0.5) * 0.9 * e.scale, (rnd() - 0.5) * 1.5, 0.6 + rnd(), (rnd() - 0.5) * 1.5, 0.8, 0.62, 0.42, 0.2, 0.45 * Math.sqrt(e.scale), 1.1, 1.2, -0.3);
        if (giant) S.shake = Math.max(S.shake, 0.3);
        if (k >= 1 || e.down) { e.state = 'chase'; e.t = 0; if (!e.down) e.rig.root.position.y = 0; }
      } else if (e.state === 'chase') {
        turn = giant ? (e.down ? 1.3 : 1.8) : 4.2;
        const throws = e.kind === 'thrower' && e.arm && dist > 2.4;
        if (P.dead || e.down) go = 0;
        else if (throws) go = dist > 9.5 ? 1 : dist < 5 ? -0.55 : 0;
        else go = dist > e.range * 0.82 ? 1 : 0;
        if (!P.dead && throws) { if (dist < 12 && e.cool <= 0 && Math.abs(da) < 0.4) { e.state = 'windup'; e.t = 0; e.struck = false; e.ranged = true; SFX.windup(); } }
        else if (!P.dead && dist < e.range && Math.abs(da) < (giant ? 0.7 : 0.5)) { e.state = 'windup'; e.t = 0; e.struck = false; e.ranged = false; SFX.windup(); }
      } else if (e.state === 'windup') {
        turn = giant ? 0.5 : 1.6; e.atk = ease(Math.min(1, e.t / (e.wind * 0.8)));
        if (rnd() < dt * 40) { const f = giant && !e.down ? footPos(e) : fistPos(e); SPARKS.add(f.x, f.y, f.z, (rnd() - 0.5) * 1.5, rnd() * 1.5, (rnd() - 0.5) * 1.5, 2.4, 0.5, 0.12, 1, 0.09 * Math.sqrt(e.scale), 0.3, 1, 0); }
        if (e.t >= e.wind) { e.state = 'strike'; e.t = 0; }
      } else if (e.state === 'strike') {
        e.hit = Math.min(1, e.t / 0.1);
        if (!e.struck && e.t >= 0.08) {
          e.struck = true;
          if (e.ranged) throwShot(e);
          else if (giant) { const f = e.down ? fistPos(e) : footPos(e); quake(f.x, f.z, e.down ? 2.6 : 3.4, e.down ? 24 : e.dmg); }
          else {
            const f = fistPos(e);
            SFX.slam(); S.shake = Math.max(S.shake, e.brute ? 0.5 : 0.22);
            for (let i = 0; i < 9; i++) DUST.add(f.x, 0.1, f.z, (rnd() - 0.5) * 4, rnd() * 1.6, (rnd() - 0.5) * 4, 0.82, 0.64, 0.44, 0.26, 0.42, 0.8, 2.2, -0.2);
            if (dist < e.range + 0.45 && Math.abs(da) < 1.0) hurt(e.dmg, e.x, e.z);
          }
        }
        if (e.t >= 0.24) { e.state = 'recover'; e.t = 0; if (e.ranged) e.cool = 1.5 + rnd() * 0.8; }
      } else if (e.state === 'recover') {
        const k = Math.min(1, e.t / (giant ? 1.0 : 0.55));
        e.atk = 1 - ease(k); e.hit = 1 - ease(k);
        if (k >= 1) { e.state = 'chase'; e.t = 0; e.atk = 0; e.hit = 0; }
      } else if (e.state === 'stagger') {
        e.atk *= Math.exp(-dt * 8); e.hit *= Math.exp(-dt * 8);
        if (e.t >= (giant ? 1.3 : 0.6)) { e.state = 'chase'; e.t = 0; }
      }
      if (e.down && e.rig.root.position.y > e.dropTo) { // legs gone: the rest comes down
        e.vy -= 26 * dt;
        e.rig.root.position.y = Math.max(e.dropTo, e.rig.root.position.y + e.vy * dt);
        if (e.rig.root.position.y <= e.dropTo) { quake(e.x, e.z, 3.2, 18); e.state = 'stagger'; e.t = 0; }
      }
      e.yaw += clamp(da, -turn * dt, turn * dt);
      const sp = go * e.speed;
      e.vx = Math.sin(e.yaw) * sp; e.vz = Math.cos(e.yaw) * sp;
      e.x += e.vx * dt; e.z += e.vz * dt;
      e.walk = lerp(e.walk, go ? 1 : 0, 1 - Math.exp(-dt * 8));
      e.phase += dt * e.speed * 3.1 * (0.25 + e.walk) / e.scale * (go < 0 ? -1 : 1);
      for (const o of enemies) { // keep apart
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oz = e.z - o.z, d = Math.hypot(ox, oz), min = e.rad + o.rad + 0.25;
        if (d < min && d > 1e-4) { const k = (min - d) * (e.scale > o.scale * 1.5 ? 0.05 : o.scale > e.scale * 1.5 ? 0.95 : 0.5) / d; e.x += ox * k; e.z += oz * k; }
      }
      pushOut(e, Math.min(e.rad, 0.7));
      const er = Math.hypot(e.x, e.z);
      if (er > ARENA + 2) { e.x *= (ARENA + 2) / er; e.z *= (ARENA + 2) / er; }
      if (e.state !== 'rise') { const ox = e.x - P.x, oz = e.z - P.z, d = Math.hypot(ox, oz), min = Math.min(e.rad, 1.0) + 0.38; if (d < min && d > 1e-4) { e.x += ox / d * (min - d); e.z += oz / d * (min - d); } }
      e.rig.root.position.x = e.x; e.rig.root.position.z = e.z; e.rig.root.rotation.y = e.yaw;
      poseIdol(e);
    }
  }
  function footPos(e) {
    const bone = e.rig.bones.shinR;
    bone.updateWorldMatrix(true, false);
    fistV.set(0, -0.36, 0.05).applyMatrix4(bone.matrixWorld);
    fistV.y = Math.max(0.1, fistV.y);
    return fistV;
  }
  const fistV = new T.Vector3();
  function fistPos(e) {
    const bone = e.rig.bones[e.arm === 'L' ? 'foreL' : e.arm === 'R' ? 'foreR' : 'head'];
    bone.updateWorldMatrix(true, false);
    return fistV.set(0, e.arm ? -0.45 : 0.3, 0).applyMatrix4(bone.matrixWorld);
  }
  function pushOut(o, rad) {
    for (const s of solids) {
      if (!s.body) continue;
      const dx = o.x - s.x, dz = o.z - s.z, d = Math.hypot(dx, dz), min = rad + s.r;
      if (d < min && d > 1e-4) { o.x += dx / d * (min - d); o.z += dz / d * (min - d); }
    }
  }

  // ---- the cut
  function bake(rig) {
    rig.root.updateMatrixWorld(true);
    const out = [];
    for (const b of rig.list) for (const p of b.pieces) { const w = GEO.xf(p, b.matrixWorld.elements); if (w) { w.bone = b; w.src = p; out.push(w); } }
    return out;
  }
  function burst(x, y, z, job, n) {
    for (let i = 0; i < n; i++) {
      const k = 1.5 + rnd() * 5.5, side = (rnd() - 0.5) * 3;
      SPARKS.add(x, y, z, job.u.x * k + job.n.x * side + (rnd() - 0.5) * 1.5, job.u.y * k + job.n.y * side + rnd() * 2.5, job.u.z * k + job.n.z * side + (rnd() - 0.5) * 1.5, 2.2, 0.7 + rnd() * 0.45, 0.1, 1, 0.03 + rnd() * 0.04, 0.3 + rnd() * 0.5, 1.2, 11);
    }
  }
  function capSparks(pieces, job, m) {
    let n = 0;
    for (const p of pieces) {
      if (!p.from || n > 7) continue;
      n++;
      let x = p.c[0], y = p.c[1], z = p.c[2];
      const f = p.faces[p.faces.length - 1]; // the new face is the last one
      if (f && f.cap === S.time) { x = y = z = 0; const c = f.p.length / 3; for (let i = 0; i < f.p.length; i += 3) { x += f.p[i] / c; y += f.p[i + 1] / c; z += f.p[i + 2] / c; } }
      if (m) { const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14]; x = X; y = Y; z = Z; }
      burst(x, y, z, job, 3);
    }
  }
  // a loose part gets the speed of what it came from, a shove off the blade and, if it is the upper part, a ride down the cut
  function loosen(world, job, velAt, spin, wasAnchored, solid) {
    let low = Infinity;
    for (const p of world) for (let i = 1; i < p.pts.length; i += 3) low = Math.min(low, p.pts[i]);
    const anchored = wasAnchored && low < 0.05 && Math.abs(job.n.y) >= 0.45;
    const b = addBody(world, { anchored, time: S.time });
    if (anchored) { if (solid && !solid.body) { b.solid = solid; solid.body = b; } return b; }
    const n = job.n, u = job.u, s = n.x * b.x + n.y * b.y + n.z * b.z - job.d >= 0 ? 1 : -1, upper = s * (n.y >= 0 ? 1 : -1) > 0;
    const v = velAt(b.x, b.y, b.z), drag = (upper ? 1.0 : 0.3) * (0.5 + rnd() * 0.9);
    b.vx = v[0] + n.x * s * 0.55 + u.x * drag; b.vy = v[1] + n.y * s * 0.55 + u.y * drag + (upper ? 0.35 : 0); b.vz = v[2] + n.z * s * 0.55 + u.z * drag;
    const flat = Math.abs(n.y), k = s * (1 - flat) * 1.1;
    b.wx = spin[0] + -n.z * k + (rnd() - 0.5) * 0.9; b.wy = spin[1] + (rnd() - 0.5) * 0.9; b.wz = spin[2] + n.x * k + (rnd() - 0.5) * 0.9;
    if (upper && flat > 0.25) {
      const sg = n.y >= 0 ? 1 : -1, nx = n.x * sg, ny = n.y * sg, nz = n.z * sg, d = job.d * sg;
      let clear = true;
      for (let i = 0; i < b.hull.length; i += 3) if (nx * (b.x + b.hull[i]) + ny * (b.y + b.hull[i + 1]) + nz * (b.z + b.hull[i + 2]) - d < -0.01) { clear = false; break; }
      if (clear) b.slide = { nx, ny, nz, d, x0: b.x, z0: b.z, until: S.time + 1.1, clear: Math.min(b.radius, 0.9) * 0.9 + 0.2 };
    }
    return b;
  }
  function cutIdol(e, job, want) {
    const world = bake(e.rig), n = job.n;
    const res = GEO.cutSet(world, n.x, n.y, n.z, job.d, S.time, (p) => want(p.c[0], p.c[1], p.c[2], p.r), CUT);
    if (!res) return 0;
    const pieces = res.pieces, groupOf = new Array(pieces.length);
    res.groups.forEach((g, gi) => { for (const i of g) groupOf[i] = gi; });
    let home = -1, alive = true;
    for (let i = 0; i < pieces.length; i++) if (pieces[i].tag && pieces[i].tag.chest && !pieces[i].from) home = groupOf[i];
    if (home < 0) alive = false;
    else for (let i = 0; i < pieces.length; i++) { const p = pieces[i]; if (p.tag && p.tag.core && (p.from || groupOf[i] !== home)) { alive = false; break; } }
    const vel = () => [e.vx, 0, e.vz], spin = [0, 0, 0];
    capSparks(pieces, job, null);
    let made = 0;
    if (alive) {
      const keep = new Map();
      for (const b of e.rig.list) keep.set(b, []);
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (groupOf[i] !== home) continue;
        if (p.from) { const bone = p.from.bone, back = GEO.xf(p, m1.copy(bone.matrixWorld).invert().elements); if (back) keep.get(bone).push(back); }
        else keep.get(p.bone).push(p.src);
      }
      let legsHit = false;
      for (const b of e.rig.list) { const list = keep.get(b); if (list.length !== b.pieces.length || list.some((p, i) => p !== b.pieces[i])) { b.pieces = list; MODELS.rebuild(b); if (LEGS.indexOf(b.name) >= 0) legsHit = true; } }
      res.groups.forEach((g, gi) => { if (gi !== home) { loosen(g.map((i) => pieces[i]), job, vel, spin, false, null); made++; } });
      refreshArms(e);
      e.state = 'stagger'; e.t = 0;
      if (e.kind === 'colossus' && !e.down && legsHit) made += bringDown(e);
    } else {
      for (const p of pieces) for (const f of p.faces) if (f.cap >= GEO.PERM) f.cap = S.time; // the fire in the eyes goes out
      for (const g of res.groups) { loosen(g.map((i) => pieces[i]), job, vel, spin, false, null); made++; }
      e.dead = true;
      scene.remove(e.rig.root); MODELS.dispose(e.rig);
      S.kills++; P.focus = Math.min(1, P.focus + 0.14);
      S.slowT = Math.max(S.slowT, e.kind === 'colossus' ? 1.1 : P.slowKill);
      if (!P.dead) P.hp = Math.min(P.maxHp, P.hp + P.leech);
      gainXp(e.xp);
      if (e.kind === 'colossus') { banner('Колосс повержен'); S.shake = 0.9; }
    }
    return made;
  }
  const LEGS = ['hips', 'thighL', 'shinL', 'thighR', 'shinR'];
  // the colossus loses its footing: what is left of the legs falls away and the rest comes down to where the blade can reach it
  function bringDown(e) {
    const b = e.rig.bones;
    e.rig.root.updateMatrixWorld(true);
    let made = 0;
    for (const set of [['thighL', 'shinL'], ['thighR', 'shinR'], ['hips']]) {
      const world = [];
      for (const nm of set) { for (const p of b[nm].pieces) { const w = GEO.xf(p, b[nm].matrixWorld.elements); if (w) world.push(w); } b[nm].pieces = []; MODELS.rebuild(b[nm]); }
      if (world.length) { addBody(world, { time: S.time, v: [(rnd() - 0.5) * 1.5, 0.4, (rnd() - 0.5) * 1.5], w: [(rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2] }); made++; }
    }
    let low = Infinity; // it comes to rest on its belly, not on its hanging fists
    for (const p of b.chest.pieces) { const w = GEO.xf(p, b.chest.matrixWorld.elements); if (w) for (let i = 1; i < w.pts.length; i += 3) low = Math.min(low, w.pts[i]); }
    e.down = true; e.vy = 0; e.dropTo = e.rig.root.position.y - (isFinite(low) ? low : 0);
    e.range = 4.3; e.speed = 0; e.wind = 0.85;
    banner('Колосс упал');
    return made;
  }
  function cutBody(b, job, want) {
    const R = b.R, n = job.n;
    if (b.kind === 'shot') { for (const p of b.pieces) for (const f of p.faces) if (f.cap >= GEO.PERM) f.cap = S.time; P.focus = Math.min(1, P.focus + 0.05); } // cut in the air, the fire in it dies
    const lx = R[0] * n.x + R[3] * n.y + R[6] * n.z, ly = R[1] * n.x + R[4] * n.y + R[7] * n.z, lz = R[2] * n.x + R[5] * n.y + R[8] * n.z, ld = job.d - (n.x * b.x + n.y * b.y + n.z * b.z);
    const res = GEO.cutSet(b.pieces, lx, ly, lz, ld, S.time, (p) => want(b.x + R[0] * p.c[0] + R[1] * p.c[1] + R[2] * p.c[2], b.y + R[3] * p.c[0] + R[4] * p.c[1] + R[5] * p.c[2], b.z + R[6] * p.c[0] + R[7] * p.c[1] + R[8] * p.c[2], p.r), CUT);
    if (!res) return 0;
    const m = PHYS.matrixOf(b);
    capSparks(res.pieces, job, m);
    if (res.groups.length === 1) { // cut into, but still holding together: it keeps the glowing scar
      for (const p of res.pieces) delete p.from;
      b.pieces = res.pieces; b.mesh.geometry.dispose(); b.mesh.geometry = partGeometry(b.pieces);
      return 1;
    }
    const spin = [b.wx, b.wy, b.wz], solid = b.solid || null, anchored = b.anchored;
    removeBody(b);
    let made = 0;
    for (const g of res.groups) {
      const world = [];
      for (const i of g) { const w = GEO.xf(res.pieces[i], m); if (w) world.push(w); }
      if (world.length) { loosen(world, job, (x, y, z) => (anchored ? [0, 0, 0] : PHYS.velAt(b, x, y, z)), anchored ? [0, 0, 0] : spin, anchored, solid); made++; }
    }
    return made;
  }
  const d0 = new T.Vector3(), d1 = new T.Vector3(), dm = new T.Vector3(), pj = new T.Vector3();
  function dirAt(px, py, out) { out.set(px / vw * 2 - 1, -(py / vh * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize(); }
  // A swipe on the screen becomes a plane through the eye, so the cut lands exactly on the line that was drawn.
  function slash(ax, ay, bx, by) {
    if (S.mode !== 'play' || P.dead || S.paused) return false;
    if (S.real < P.nextSlash || P.lunge) { P.queue = [ax, ay, bx, by, S.real]; return false; }
    P.queue = null;
    P.nextSlash = S.real + (S.focusOn ? 0.07 : 0.19);
    camera.updateMatrixWorld();
    dirAt(ax, ay, d0); dirAt(bx, by, d1);
    const n = new T.Vector3().crossVectors(d0, d1);
    if (n.lengthSq() < 1e-9) return false;
    n.normalize();
    const C = camera.position;
    dm.copy(d0).add(d1).normalize();
    const tm = clamp(dm.y < -0.02 ? (1.05 - C.y) / dm.y : 16, 2, 45), M = C.clone().addScaledVector(dm, tm);
    const u = d1.clone().sub(d0); u.addScaledVector(n, -u.dot(n)).normalize();
    const job = { n, d: n.dot(C), u, M, ax, ay, bx, by, len: Math.hypot(bx - ax, by - ay), vp: new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), focal: vh / (2 * Math.tan(camera.fov * Math.PI / 360)) };
    const dx = M.x - P.x, dz = M.z - P.z, dist = Math.hypot(dx, dz);
    if (dist > 0.05) P.yaw = Math.atan2(dx, dz);
    const go = Math.min(P.lungeMax, dist - STANDOFF);
    if (go > 0.3) { P.lunge = { x0: P.x, z0: P.z, x1: P.x + dx / dist * go, z1: P.z + dz / dist * go, t: 0, T: 0.045 + go * 0.012, job }; SFX.dash(); }
    else strike(job);
    INK.push({ ax, ay, bx, by, t: 0 });
    return true;
  }
  function strike(job) {
    const n = job.n, px = P.x, py = 1.22, pz = P.z, off = n.x * px + n.y * py + n.z * pz - job.d;
    const pv = new T.Vector3(px - n.x * off, py - n.y * off, pz - n.z * off);
    const f = job.M.clone().sub(pv); f.addScaledVector(n, -f.dot(n));
    if (f.lengthSq() < 0.04) { f.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)); f.addScaledVector(n, -f.dot(n)); }
    f.normalize();
    const s = job.u.clone(); s.addScaledVector(f, -s.dot(f));
    if (s.lengthSq() < 1e-4) s.crossVectors(n, f);
    s.normalize();
    // which way the body turns with the swing: +1 when the blade goes to the wanderer's left
    const turn = (s.x * Math.cos(P.yaw) - s.z * Math.sin(P.yaw)) >= 0 ? 1 : -1;
    P.sw = { t: 0, T: 0.11, pv, f, s, a0: -1.45, a1: 1.45, turn };
    TRAILS.add({ px: pv.x, py: pv.y, pz: pv.z, fx: f.x, fy: f.y, fz: f.z, sx: s.x, sy: s.y, sz: s.z, a0: -1.45, a1: 1.45, r0: 0.5, r1: P.reach, T: 0.11 });
    SFX.swing();
    const e = job.vp.elements, lx = job.bx - job.ax, ly = job.by - job.ay, len2 = lx * lx + ly * ly;
    const want = (x, y, z, r) => {
      if (y - r * 0.3 > TOP) return false;
      const ex = x - px, ey = y - 1.1, ez = z - pz, lim = P.reach + r * 0.6;
      if (ex * ex + ey * ey + ez * ez > lim * lim) return false;
      const w = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (w <= 0.01) return false;
      const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w * 0.5 + 0.5) * vw, sy = (0.5 - (e[1] * x + e[5] * y + e[9] * z + e[13]) / w * 0.5) * vh;
      const t = ((sx - job.ax) * lx + (sy - job.ay) * ly) / len2, pad = (24 + r * job.focal / w * 0.6) / job.len;
      return t > -pad && t < 1 + pad;
    };
    const killed = S.kills;
    let made = cutAll(job, want, px, pz, P.reach);
    for (let k = 1; k <= P.up.twin; k++) { // the second and third edge: the same cut a hand's width to either side
      const side = k === 1 ? 0.26 : -0.26;
      made += cutAll(Object.assign({}, job, { d: job.d + side }), want, px, pz, P.reach);
      TRAILS.add({ px: pv.x + n.x * side, py: pv.y + n.y * side, pz: pv.z + n.z * side, fx: f.x, fy: f.y, fz: f.z, sx: s.x, sy: s.y, sz: s.z, a0: -1.45, a1: 1.45, r0: 0.5, r1: P.reach, T: 0.13 + k * 0.03 });
    }
    if (made) scored(made, killed);
  }
  function cutAll(job, want, cx, cz, R) {
    let made = 0;
    for (const en of enemies.slice()) if (!en.dead && Math.hypot(en.x - cx, en.z - cz) < R + 2 * en.scale) made += cutIdol(en, job, want);
    for (const b of bodies.slice()) {
      const dx = b.x - cx, dy = b.y - 1.1, dz = b.z - cz, lim = R + b.radius;
      if (dx * dx + dy * dy + dz * dz < lim * lim) made += cutBody(b, job, want);
    }
    return made;
  }
  function scored(made, killed) {
    S.parts += made;
    SFX.cut(made);
    S.shake = Math.max(S.shake, Math.min(0.55, 0.16 + made * 0.03));
    if (S.kills > killed) S.stop = 0.05;
    if (!S.cutOnce) { S.cutOnce = true; $('hint').classList.add('gone'); }
  }
  // with the dash upgrade: one flat cut along the whole path of the dash
  function whirl() {
    const ax = P.sx0, az = P.sz0, bx = P.x, bz = P.z, len = Math.hypot(bx - ax, bz - az);
    if (len < 0.3) return;
    const ux = (bx - ax) / len, uz = (bz - az) / len, tilt = P.flip++ % 2 ? 0.16 : -0.16;
    const n = new T.Vector3(-uz * tilt, 1, ux * tilt).normalize(), u = new T.Vector3(ux, 0, uz);
    u.addScaledVector(n, -u.dot(n)).normalize();
    const job = { n, d: n.x * bx + n.y * 1.0 + n.z * bz, u };
    const want = (x, y, z, r) => {
      if (y - r * 0.3 > 2.4) return false;
      const t = clamp(((x - ax) * ux + (z - az) * uz) / len, 0, 1), dx = x - (ax + ux * len * t), dz = z - (az + uz * len * t), lim = 1.5 + r * 0.5;
      return dx * dx + dz * dz < lim * lim;
    };
    const killed = S.kills, made = cutAll(job, want, (ax + bx) / 2, (az + bz) / 2, len / 2 + 1.7);
    const s = new T.Vector3().crossVectors(n, u);
    TRAILS.add({ px: bx, py: 1.0, pz: bz, fx: -u.x, fy: -u.y, fz: -u.z, sx: s.x, sy: s.y, sz: s.z, a0: -2.7, a1: 2.7, r0: 0.4, r1: 1.8, T: 0.1 });
    SFX.swing();
    if (made) scored(made, killed);
  }
  function tapSlash(x, y) {
    let cx = x, cy = y, best = 120 * 120;
    for (const e of enemies) {
      if (e.dead) continue;
      pj.set(e.x, 1.05 * e.scale, e.z).project(camera);
      const sx = (pj.x * 0.5 + 0.5) * vw, sy = (0.5 - pj.y * 0.5) * vh, d = (sx - x) * (sx - x) + (sy - y) * (sy - y);
      if (d < best) { best = d; cx = sx; cy = sy; }
    }
    const ang = [-0.5, Math.PI + 0.5, 0.06][P.flip++ % 3], L = clamp(vh * 0.17, 70, 180);
    slash(cx - Math.cos(ang) * L, cy + Math.sin(ang) * L, cx + Math.cos(ang) * L, cy - Math.sin(ang) * L);
  }

  // ---- the wanderer takes a blow, or falls
  function hurt(dmg, fx, fz) {
    if (P.invul > 0 || P.dash > 0 || P.dead) return;
    P.hp -= dmg; P.invul = 0.7; S.hurtK = 1; S.shake = Math.max(S.shake, 0.6);
    const dx = P.x - fx, dz = P.z - fz, d = Math.hypot(dx, dz) || 1;
    P.kx = dx / d * 9; P.kz = dz / d * 9;
    SFX.hurt();
    if (P.hp <= 0) die();
  }
  function die() {
    P.hp = 0; P.dead = true; S.focusOn = false;
    const rig = P.rig;
    rig.root.updateMatrixWorld(true);
    for (const b of rig.list) {
      const world = [];
      for (const p of b.pieces) { const w = GEO.xf(p, b.matrixWorld.elements); if (w) world.push(w); }
      if (world.length) addBody(world, { time: S.time, v: [P.kx * 0.4 + (rnd() - 0.5) * 2, 1.5 + rnd() * 2.5, P.kz * 0.4 + (rnd() - 0.5) * 2], w: [(rnd() - 0.5) * 7, (rnd() - 0.5) * 7, (rnd() - 0.5) * 7] });
    }
    scene.remove(rig.root);
    katana.position.set(P.x, 0.72, P.z); katana.quaternion.setFromUnitVectors(UP, v1.set(0.12, -1, 0.08).normalize()); // left standing in the sand
    SFX.fall();
    S.mode = 'dead'; S.slowT = 1.2;
    if (S.wave > S.best) { S.best = S.wave; try { localStorage.setItem('blade-clay-best', String(S.best)); } catch (e) { /* storage may be closed */ } }
    setTimeout(() => { if (S.mode !== 'dead') return; $('deadStats').textContent = 'Волна ' + S.wave + ' · уровень ' + S.level + ' · сражено ' + S.kills + ' · кусков ' + S.parts + (S.best ? ' · рекорд: волна ' + S.best : ''); $('dead').hidden = false; }, 1500);
  }

  // ---- waves
  function startWave(n) {
    S.wave = n; S.next = 0;
    const count = { grunt: Math.min(2 + n, 8), imp: n >= 2 ? Math.min(2 + (n - 1) * 2, 14) : 0, thrower: n >= 3 ? Math.min(Math.floor((n - 1) / 2), 4) : 0, brute: n >= 4 ? Math.min(Math.floor((n - 2) / 2), 4) : 0 };
    S.queue = [];
    for (const k in count) for (let i = 0; i < count[k]; i++) S.queue.splice(Math.floor(rnd() * (S.queue.length + 1)), 0, k);
    const giants = n % 5 === 0 ? n / 5 : 0;
    for (let i = 0; i < giants; i++) S.queue.push('colossus'); // taken from the end, so the colossus rises first
    S.spawnT = 0.9;
    banner(giants ? 'Волна ' + n + ': колосс' : 'Волна ' + n);
    SFX.gong();
  }
  function updateWaves(dt) {
    if (S.mode !== 'play') return;
    let alive = 0, load = 0;
    for (const e of enemies) if (!e.dead) { alive++; load += e.kind === 'imp' ? 0.5 : e.kind === 'colossus' ? 3 : 1; }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    if (S.queue.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0 && load < (TOUCH ? 8 : 11)) { const k = S.queue.pop(); spawnIdol(k); S.spawnT = k === 'imp' ? 0.2 + rnd() * 0.25 : 0.5 + rnd() * 0.5; }
    } else if (!alive && !S.next) { S.next = S.time + 2.6; P.hp = Math.min(P.maxHp, P.hp + 25); banner('Тишина'); }
    if (S.next && S.time >= S.next) startWave(S.wave + 1);
  }
  let bannerT = 0;
  function banner(text) { const el = $('banner'); el.textContent = text; el.classList.add('on'); bannerT = S.real + 1.7; }

  // ---- input
  const INK = [];
  let swipe = null, stick = null, focusBtn = false;
  const capture = (ev) => { try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* no such pointer */ } };
  const local = (ev) => { const r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  stage.addEventListener('contextmenu', (ev) => ev.preventDefault());
  // one stroke: press, move, lift. A sharp turn inside a long stroke ends one cut and starts the next, so scribbling chops.
  function press(id, x, y) { if (!swipe) swipe = { id, ax: x, ay: y, x, y, px: x, py: y }; }
  function move(id, x, y) {
    if (!swipe || swipe.id !== id) return;
    swipe.x = x; swipe.y = y;
    const sx = x - swipe.px, sy = y - swipe.py, step = Math.hypot(sx, sy);
    if (step > 12) {
      const lx = swipe.px - swipe.ax, ly = swipe.py - swipe.ay, len = Math.hypot(lx, ly);
      if (len > 56 && (sx * lx + sy * ly) / (step * len) < 0.15) { slash(swipe.ax, swipe.ay, swipe.px, swipe.py); swipe.ax = swipe.px; swipe.ay = swipe.py; }
      swipe.px = x; swipe.py = y;
    }
  }
  function lift(id, x, y, commit) {
    if (!swipe || swipe.id !== id) return;
    if (commit) { if (Math.hypot(x - swipe.ax, y - swipe.ay) < 16) tapSlash(x, y); else slash(swipe.ax, swipe.ay, x, y); }
    swipe = null;
  }
  // fingers and pens come as pointers
  stage.addEventListener('pointerdown', (ev) => {
    SFX.start();
    if (ev.pointerType === 'mouse' || ev.target.closest('button') || S.mode !== 'play' || S.paused || S.choosing) return;
    ev.preventDefault();
    const [x, y] = local(ev);
    if (!stick && x < vw * 0.42 && y > vh * 0.3) { stick = { id: ev.pointerId, ox: x, oy: y, x: 0, y: 0 }; showStick(); capture(ev); return; }
    if (!swipe) { press(ev.pointerId, x, y); capture(ev); }
  });
  stage.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse') return;
    const [x, y] = local(ev);
    if (stick && ev.pointerId === stick.id) { const dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy), m = 56, k = d > m ? m / d : 1; stick.x = dx * k / m; stick.y = dy * k / m; showStick(); return; }
    move(ev.pointerId, x, y);
  });
  const release = (ev) => {
    if (ev.pointerType === 'mouse') return;
    if (stick && ev.pointerId === stick.id) { stick = null; showStick(); return; }
    const [x, y] = local(ev);
    lift(ev.pointerId, x, y, ev.type === 'pointerup');
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  // the mouse comes as mouse events, because a second button pressed while one is held makes no new pointer event:
  // the right button holds time slowed while the left one cuts
  stage.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('button') || S.mode !== 'play' || S.paused || S.choosing) return;
    ev.preventDefault();
    const [x, y] = local(ev);
    if (ev.button === 2) S.focusHeld = true;
    else if (ev.button === 0) press('mouse', x, y);
  });
  window.addEventListener('mousemove', (ev) => { if (swipe && swipe.id === 'mouse') { const [x, y] = local(ev); move('mouse', x, y); } });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 2) S.focusHeld = false;
    else if (ev.button === 0) { const [x, y] = local(ev); lift('mouse', x, y, true); }
  });
  function showStick() {
    const el = $('stick');
    el.hidden = !stick;
    if (stick) { el.style.left = stick.ox + 'px'; el.style.top = stick.oy + 'px'; $('knob').style.transform = 'translate(' + stick.x * 40 + 'px,' + stick.y * 40 + 'px)'; }
  }
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    keys[ev.code] = true;
    if (S.choosing) { const i = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(ev.code); if (i >= 0) choose(i % 3); return; }
    if (ev.code === 'Space') { ev.preventDefault(); if (S.mode === 'play') dash(); else if (S.mode === 'title') begin(); else if (!$('dead').hidden) begin(); }
    if (ev.code === 'Enter' && (S.mode === 'title' || !$('dead').hidden)) begin();
    if ((ev.code === 'Escape' || ev.code === 'KeyP') && S.mode === 'play') pause(!S.paused);
    if (ev.code.startsWith('Arrow')) ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; S.focusHeld = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') pause(true); });
  $('start').addEventListener('click', begin);
  $('again').addEventListener('click', begin);
  $('resume').addEventListener('click', () => pause(false));
  $('btnDash').addEventListener('pointerdown', (ev) => { ev.preventDefault(); dash(); });
  $('btnFocus').addEventListener('pointerdown', (ev) => { ev.preventDefault(); focusBtn = !focusBtn; });
  $('sound').addEventListener('click', () => { const off = $('sound').getAttribute('aria-pressed') !== 'true'; $('sound').setAttribute('aria-pressed', String(off)); $('sound').textContent = off ? 'Звук выкл' : 'Звук вкл'; SFX.mute(off); });
  function pause(on) { S.paused = on; $('pause').hidden = !on; swipe = null; stick = null; showStick(); }
  function dash() {
    if (P.dead || P.dashCd > 0 || S.paused) return;
    let dx = P.dx, dz = P.dz;
    if (!(P.speed > 0.5)) { dx = Math.sin(P.yaw); dz = Math.cos(P.yaw); }
    P.dash = 0.16; P.dashCd = P.dashGap; P.ddx = dx; P.ddz = dz; P.sx0 = P.x; P.sz0 = P.z; P.invul = Math.max(P.invul, 0.26);
    SFX.dash();
    for (let i = 0; i < 6; i++) DUST.add(P.x, 0.15, P.z, -dx * 2 + (rnd() - 0.5) * 2, 0.5 + rnd(), -dz * 2 + (rnd() - 0.5) * 2, 0.85, 0.66, 0.46, 0.2, 0.36, 0.6, 2, -0.2);
  }
  function begin(fixedSeed) {
    SFX.start();
    clearWorld(); buildProps(); resetUps(); newHero();
    Object.assign(S, { xp: 0, level: 1, need: 8, pending: 0, choosing: false, choice: null, mode: 'play', time: 0, scale: 1, stop: 0, slowT: 0, focusOn: false, focusLock: false, wave: 0, queue: [], next: 0, kills: 0, parts: 0, paused: false, hurtK: 0, cutOnce: false });
    seed = typeof fixedSeed === 'number' ? fixedSeed : (Date.now() & 0xffffff) | 1; focusBtn = false;
    $('title').hidden = true; $('dead').hidden = true; $('pause').hidden = true; $('hud').hidden = false; $('hint').classList.remove('gone');
    startWave(1);
  }

  // ---- per frame
  function updateHero(dt) {
    if (P.dead) return;
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz -= 1;
    if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (stick) { mx += stick.x; mz += stick.y; }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    P.invul = Math.max(0, P.invul - dt); P.dashCd = Math.max(0, P.dashCd - dt);
    let vx = 0, vz = 0;
    if (P.lunge) {
      const l = P.lunge; l.t += dt;
      const k = Math.min(1, l.t / l.T);
      P.x = lerp(l.x0, l.x1, k); P.z = lerp(l.z0, l.z1, k);
      if (rnd() < 0.7) DUST.add(P.x, 0.12, P.z, (rnd() - 0.5), 0.4 + rnd() * 0.6, (rnd() - 0.5), 0.85, 0.66, 0.46, 0.16, 0.32, 0.5, 2, -0.2);
      if (k >= 1) { P.lunge = null; strike(l.job); }
      P.speed = 12;
    } else if (P.dash > 0) {
      P.dash -= dt; vx = P.ddx * 17; vz = P.ddz * 17; P.speed = 12;
      if (P.dash <= 0 && P.up.whirl) { P.x += vx * dt; P.z += vz * dt; vx = vz = 0; whirl(); }
      P.yaw = Math.atan2(P.ddx, P.ddz);
    } else {
      const sp = P.run * (P.sw ? 0.35 : 1);
      vx = mx * sp; vz = mz * sp;
      P.speed = lerp(P.speed, Math.hypot(vx, vz), 1 - Math.exp(-dt * 14));
      if (ml > 0.15) { P.dx = mx / ml; P.dz = mz / ml; if (!P.sw) { let da = Math.atan2(mx, mz) - P.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); P.yaw += da * (1 - Math.exp(-dt * 16)); } }
    }
    P.kx *= Math.exp(-dt * 7); P.kz *= Math.exp(-dt * 7);
    P.x += (vx + P.kx) * dt; P.z += (vz + P.kz) * dt;
    P.phase += dt * P.speed * 1.75;
    pushOut(P, 0.36);
    const r = Math.hypot(P.x, P.z);
    if (r > ARENA) { P.x *= ARENA / r; P.z *= ARENA / r; }
    if (P.queue && S.real >= P.nextSlash && !P.lunge) { const q = P.queue; P.queue = null; if (S.real - q[4] < 0.25) slash(q[0], q[1], q[2], q[3]); }
  }
  function updateBodies(dt) {
    if (dt > 0) { const h = dt / 2; PHYS.step(bodies, h, S.time - h); PHYS.step(bodies, h, S.time); }
    let loose = 0, oldest = null;
    for (const b of bodies) {
      if (b.anchored) continue;
      if (!b.asleep) { b.mesh.position.set(b.x, b.y, b.z); b.mesh.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]); b.restAt = 0; }
      else if (!b.restAt) b.restAt = S.time;
      if (b.hit > 2.4) { SFX.thud(b.hit * Math.min(1, 0.3 + b.vol * 30)); if (b.hit > 4.5 && b.vol > 0.008 && rnd() < 0.7) DUST.add(b.x, 0.1, b.z, (rnd() - 0.5) * 1.6, 0.4 + rnd() * 0.5, (rnd() - 0.5) * 1.6, 0.85, 0.66, 0.46, 0.18, 0.28 + b.radius * 0.4, 0.7, 2, -0.2); }
      b.hit = 0;
      if (b.gone) continue;
      if (b.kind === 'shot') { // thrown fire: hurts on a hit, breaks on the ground
        const hx = b.x - P.x, hy = b.y - 1.0, hz = b.z - P.z, hitsHim = !P.dead && hx * hx + hy * hy + hz * hz < 0.42;
        if (hitsHim || b.grounded) {
          if (hitsHim) hurt(b.dmg || 10, b.x - b.vx, b.z - b.vz);
          for (let i = 0; i < 10; i++) SPARKS.add(b.x, Math.max(0.1, b.y), b.z, (rnd() - 0.5) * 6, rnd() * 4, (rnd() - 0.5) * 6, 2.2, 0.8, 0.12, 1, 0.05 + rnd() * 0.05, 0.3 + rnd() * 0.4, 1.2, 11);
          SFX.thud(5); b.gone = 1; continue;
        }
      }
      loose++;
      if (b.asleep && (!oldest || b.restAt < oldest.restAt)) oldest = b;
      if (b.asleep && S.time - b.restAt > (b.vol < 0.004 ? 9 : 24)) b.gone = S.real;
    }
    if (loose > MAX_PARTS && oldest) oldest.gone = S.real;
    for (const b of bodies.slice()) {
      if (!b.gone) continue;
      if (b.gone === 1) { removeBody(b); continue; } // fell out of the world
      const k = (S.real - b.gone) / 0.5;
      if (k >= 1) removeBody(b);
      else { b.mesh.scale.setScalar(1 - k * k); b.mesh.position.y = b.y - k * 0.2; }
    }
  }
  const camAt = new T.Vector3(0, 1, 0);
  function updateCamera(dt) {
    const f = S.focusK, tall = camera.aspect < 0.9;
    const pitch = lerp(0.62, 0.31, f), dist = lerp(11.4, 7.6, f) * (tall ? 1.3 : 1);
    v1.set(P.x + P.dx * Math.min(P.speed, 6.3) * 0.12 * (1 - f), 1.0 + 0.35 * f, P.z + P.dz * Math.min(P.speed, 6.3) * 0.12 * (1 - f));
    camAt.lerp(v1, 1 - Math.exp(-dt * 7));
    S.shake = Math.max(0, S.shake - dt * 2.4);
    const sh = S.shake * S.shake * 0.5;
    camera.position.set(camAt.x + (rnd() - 0.5) * sh, camAt.y + Math.sin(pitch) * dist + (rnd() - 0.5) * sh, camAt.z + Math.cos(pitch) * dist);
    camera.lookAt(camAt.x, camAt.y + 0.3 * f, camAt.z);
    const fov = tall ? 54 : 40;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    W.follow(P.x, P.z);
  }
  const hud = { hp: $('hp'), focus: $('focus'), xp: $('xp'), level: $('level'), wave: $('wave'), kills: $('kills'), parts: $('parts') };
  let hudKey = '';
  function updateHud() {
    const key = [Math.round(P.hp), P.maxHp, Math.round(P.focus * 50), S.xp, S.level, S.wave, S.kills, S.parts, S.focusOn, focusBtn].join();
    if (key === hudKey) return;
    hudKey = key;
    hud.hp.style.transform = 'scaleX(' + clamp(P.hp / P.maxHp, 0, 1) + ')';
    hud.focus.style.transform = 'scaleX(' + clamp(P.focus, 0, 1) + ')';
    hud.xp.style.transform = 'scaleX(' + clamp(S.xp / S.need, 0, 1) + ')';
    hud.level.textContent = S.level; hud.wave.textContent = S.wave; hud.kills.textContent = S.kills; hud.parts.textContent = S.parts;
    document.body.classList.toggle('focus', S.focusOn);
    $('btnFocus').setAttribute('aria-pressed', String(focusBtn));
  }
  const ik = ink.getContext('2d');
  function drawInk(dt) {
    ik.setTransform(PR, 0, 0, PR, 0, 0);
    ik.clearRect(0, 0, vw, vh);
    ik.lineCap = 'round';
    const line = (ax, ay, bx, by, a, w) => {
      ik.strokeStyle = 'rgba(255,150,60,' + (a * 0.35).toFixed(3) + ')'; ik.lineWidth = w * 4; ik.beginPath(); ik.moveTo(ax, ay); ik.lineTo(bx, by); ik.stroke();
      ik.strokeStyle = 'rgba(255,240,215,' + a.toFixed(3) + ')'; ik.lineWidth = w; ik.beginPath(); ik.moveTo(ax, ay); ik.lineTo(bx, by); ik.stroke();
    };
    for (let i = INK.length - 1; i >= 0; i--) { const l = INK[i]; l.t += dt; const k = 1 - l.t / 0.28; if (k <= 0) INK.splice(i, 1); else line(l.ax, l.ay, l.bx, l.by, k * 0.9, 1 + k * 2.5); }
    if (swipe && Math.hypot(swipe.x - swipe.ax, swipe.y - swipe.ay) > 8) line(swipe.ax, swipe.ay, swipe.x, swipe.y, 0.75, 2);
  }
  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 0.9 ? 54 : 40; camera.updateProjectionMatrix();
    ink.width = Math.round(w * PR); ink.height = Math.round(h * PR);
    const scale = h * pr / (2 * Math.tan(camera.fov * Math.PI / 360));
    SPARKS.mat.uniforms.uScale.value = scale; DUST.mat.uniforms.uScale.value = scale;
  }
  let last = 0, slowFrames = 0, quality = 0;
  function lowerQuality() { // a device that cannot keep up gets fewer pixels first, then loses shadows
    quality++;
    if (quality === 1) pr = Math.min(pr, 1);
    else { pr = Math.min(pr, 0.75); renderer.shadowMap.enabled = false; W.sun.castShadow = false; }
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
    vw = 0; resize();
  }
  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    const raw = (now - last) / 1000, dtR = Math.min(0.05, Math.max(0.001, raw));
    last = now;
    if (S.mode === 'play' && !S.paused && quality < 2 && raw < 0.5) { slowFrames = raw > 0.03 ? slowFrames + 1 : Math.max(0, slowFrames - 2); if (slowFrames > 100) { slowFrames = 0; lowerQuality(); } }
    if (S.paused || S.choosing) { composer.render(); return; }
    step(dtR);
    composer.render();
  }
  function step(dtR) {
    if (S.choosing) return; // the world waits while a lesson is chosen
    S.real += dtR;
    // slowed time: held on purpose while there is focus left, and for a breath after a kill
    const wantFocus = (S.focusHeld || keys.ShiftLeft || keys.ShiftRight || focusBtn) && S.mode === 'play' && !P.dead;
    if (!wantFocus) S.focusLock = false;
    const on = wantFocus && !S.focusLock && P.focus > 0;
    if (on !== S.focusOn) { S.focusOn = on; SFX.focus(on); }
    if (S.focusOn) { P.focus -= dtR * P.drain; if (P.focus <= 0) { P.focus = 0; S.focusLock = true; focusBtn = false; } }
    else if (S.mode === 'play') P.focus = Math.min(1, P.focus + dtR * 0.045);
    S.slowT = Math.max(0, S.slowT - dtR);
    const target = S.focusOn ? 0.1 : S.slowT > 0 ? 0.28 : 1;
    S.scale = lerp(S.scale, target, 1 - Math.exp(-dtR * (target < S.scale ? 30 : 7)));
    S.focusK = lerp(S.focusK, S.focusOn ? 1 : 0, 1 - Math.exp(-dtR * 9));
    if ((S.scale < 0.5) !== S.muffled) { S.muffled = S.scale < 0.5; SFX.slow(S.scale); }
    let dt = dtR * S.scale;
    if (S.stop > 0) { S.stop -= dtR; dt = 0; }
    S.time += dt;
    SHARED.uTime.value = S.time;
    if (S.mode !== 'title') {
      updateHero(dtR * lerp(S.scale, 1, 0.62));
      if (!P.dead) poseHero(dtR);
      updateIdols(dt);
      updateWaves(dt);
    } else poseHero(dtR);
    updateBodies(dt);
    SPARKS.step(dt + dtR * 0.02); DUST.step(dt); TRAILS.step(dtR);
    updateCamera(dtR);
    S.hurtK = Math.max(0, S.hurtK - dtR * 1.8);
    grade.uniforms.hurt.value = Math.max(S.hurtK, P.hp < 30 && !P.dead ? 0.25 + 0.12 * Math.sin(S.real * 5) : 0);
    grade.uniforms.calm.value = S.focusK;
    if (bannerT && S.real > bannerT) { $('banner').classList.remove('on'); bannerT = 0; }
    if (S.pending > 0 && S.mode === 'play' && !P.dead && S.slowT <= 0 && S.stop <= 0) openChoice();
    updateHud();
    drawInk(dtR);
  }

  // the title screen shows the place with a few things to look at
  buildProps(); resetUps(); newHero();
  P.rig.root.visible = true;
  resize();
  window.__game = { renderer, S, P, bodies, enemies, slash, tapSlash, begin, step, camera, spawnIdol, dash, hurt, gainXp, choose, applyUps, UPS, KINDS, frame: () => composer.render(), setFocus: (v) => { focusBtn = v; }, canvas };
  requestAnimationFrame((t) => { last = t; frame(t); });
})();
