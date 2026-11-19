// The game itself: the boat, the cast, the fight on the line, the shark, the clock, the camera and the HUD.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('gl'), stage = $('stage');
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { $('fail').hidden = false; return; }
  const TOUCH = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (TOUCH) document.body.classList.add('touch');
  const PR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2);
  renderer.setPixelRatio(PR);
  renderer.outputEncoding = T.LinearEncoding; // the last pass tone-maps and encodes
  renderer.toneMapping = T.NoToneMapping;

  const ARENA = 44, RANGE = 30, MAXLINE = 40, MAXS = 11, FOV = 50;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, 16 / 9, 0.5, 4000);
  const W = buildWorld(scene, ARENA);
  const hdr = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const rt = new T.WebGLRenderTarget(4, 4, hdr ? { type: T.HalfFloatType, samples: 4 } : {});
  const composer = new T.EffectComposer(renderer, rt);
  composer.setPixelRatio(PR);
  composer.addPass(new T.RenderPass(scene, camera));
  const bloom = new T.UnrealBloomPass(new T.Vector2(4, 4), 0.5, 0.6, 1.0);
  composer.addPass(bloom);
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, exposure: { value: 0.72 }, danger: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, danger, flash; varying vec2 vUv;
      vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){
        c = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777) * (c * exposure / 0.6);
        c = fit(c);
        return clamp(mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602) * c, 0.0, 1.0);
      }
      void main(){
        vec3 c = aces(texture2D(tDiffuse, vUv).rgb * (1.0 + flash * 0.8));
        float edge = smoothstep(0.3, 0.95, length((vUv - 0.5) * vec2(1.0, 0.9)) * 1.25);
        float grey = dot(c, vec3(0.3, 0.55, 0.15));
        c = mix(vec3(grey), c, 1.18);               // a touch more colour than the film curve leaves
        c *= 1.0 - 0.3 * edge;
        c = mix(c, vec3(0.95, 0.1, 0.12), danger * edge * 0.8);
        gl_FragColor = vec4(pow(max(c, 0.0), vec3(1.0 / 2.2)), 1.0);
      }`,
  });
  composer.addPass(grade);

  const SPRAY = makeSpray(scene, TOUCH ? 500 : 900), RINGS = makeRings(scene, 64), LINE = makeLine(scene, 16);
  const boat = makeBoat(); scene.add(boat.root);
  const lure = new T.Group();
  lure.add(new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshBasicMaterial({ color: new T.Color(3.2, 0.5, 0.35) })));
  const lureCap = new T.Mesh(new T.SphereGeometry(0.205, 10, 5, 0, 6.3, 0, 1.2), new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.6, 1.6) })); lure.add(lureCap);
  lure.visible = false; scene.add(lure);
  const AQUA = new T.Color(0.4, 2.2, 2.0), RED = new T.Color(2.6, 0.5, 0.45), SUN = new T.Color(2.4, 1.8, 0.4);
  const reticle = new T.Mesh(new T.RingGeometry(0.75, 0.95, 28).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: AQUA, transparent: true, opacity: 0.85, depthWrite: false }));
  reticle.renderOrder = 2; reticle.position.y = 0.05; reticle.visible = false; scene.add(reticle);

  // ---- what swims here
  const KINDS = {
    sardine: { name: 'Килька', len: 1.5, h: 0.46, w: 0.2, back: 0x2f6bff, belly: 0xeaf6ff, fin: 0x8fd0ff, eye: 0.24, score: 50, time: 2, speed: 3.2, reel: 16, rush: 0, sense: 6, n: 9 },
    dorado: { name: 'Дорадо', len: 2.3, h: 0.78, w: 0.28, back: 0x12c95e, belly: 0xffe04a, fin: 0x16a0ff, tall: 0.5, score: 150, time: 3, speed: 3.8, reel: 7.5, rush: 8, rushDur: [0.7, 1.0], rest: [1.2, 1.8], sense: 6.5, n: 6 },
    sword: { name: 'Меч-рыба', len: 4.2, h: 0.9, w: 0.4, back: 0x4a2fe0, belly: 0xe6eaff, fin: 0xff4fa3, tall: 1.25, bill: true, score: 400, time: 6, speed: 4.6, reel: 8, rush: 9, rushDur: [0.8, 1.1], rest: [1.3, 1.9], sense: 7.5, n: 2 },
    gold: { name: 'Золотая рыбка', len: 1.8, h: 0.8, w: 0.3, back: 0xffb300, belly: 0xfff3a0, fin: 0xff6a00, glow: 2.3, tall: 0.8, score: 1000, time: 8, speed: 6.2, reel: 7.5, rush: 10, rushDur: [0.6, 0.9], rest: [1.0, 1.5], sense: 5, n: 1 },
  };
  const SHARK = { name: 'Акула', len: 5.4, h: 1.15, w: 0.52, back: 0x46536b, belly: 0xdfe7f2, fin: 0x2b3446, tall: 1.5, eye: 0.08, glow: 1 };
  for (const k in KINDS) KINDS[k].depth = KINDS[k].h * 0.5 + 0.1;

  // ---- state
  const S = { mode: 'title', t: 0, left: 60, score: 0, combo: 0, bestCombo: 0, count: 0, best: 0, big: null, paused: false, shake: 0, slowT: 0, flash: 0, sharkT: 16, tension: 0, testReel: false, castK: 0, wakeT: 0, hinted: false, shown: {} };
  const B = { x: 0, z: 0, vx: 0, vz: 0, yaw: 0, roll: 0, speed: 0, bend: 0, aim: 0 };
  const L = { state: 'idle', x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, tx: 0, tz: 0, t: 0, dur: 1, fish: null, cool: 0 };
  const fish = [], keys = {};
  let shark = null, vw = 1, vh = 1, seed = 20261119, hold = false, stick = null;
  const camF = new T.Vector3(0, 0, 0), tipW = new T.Vector3(), endW = new T.Vector3(), v3 = new T.Vector3();
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = (r) => r[0] + rnd() * (r[1] - r[0]);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), damp = (a, b, k) => a + (b - a) * Math.min(1, k);
  const turn = (a, b, max) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + clamp(d, -max, max); };
  const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
  try { S.best = +localStorage.getItem('mad-bite-best') || 0; } catch (e) { S.best = 0; }

  // ---- little shows
  const DROP = [1.3, 1.6, 1.7], CONF = [[2.4, 1.8, 0.3], [0.4, 2.0, 1.8], [2.4, 0.6, 0.6], [1.7, 1.7, 1.7]];
  function splash(x, z, n, power) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = (0.6 + Math.random() * 2.2) * power; SPRAY.add(x, 0.05, z, Math.cos(a) * sp, (2.5 + Math.random() * 4) * power, Math.sin(a) * sp, 0.5 + Math.random() * 0.5, 0.1 + Math.random() * 0.18, DROP); }
    RINGS.add(x, z, 0.2, 1.4 + power * 1.4, 0.8, 0.9);
  }
  function confetti(x, y, z, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = 2 + Math.random() * 5; SPRAY.add(x, y, z, Math.cos(a) * sp, 3 + Math.random() * 7, Math.sin(a) * sp, 0.7 + Math.random() * 0.6, 0.14 + Math.random() * 0.16, CONF[i % 4], 12); } }
  function pop(text, x, y, z, cls) {
    v3.set(x, y, z).project(camera);
    if (v3.z > 1) return;
    const el = document.createElement('span'); el.className = 'pop ' + (cls || ''); el.textContent = text;
    el.style.left = clamp((v3.x * 0.5 + 0.5) * vw, 50, vw - 50) + 'px'; el.style.top = clamp((0.5 - v3.y * 0.5) * vh, vh * 0.3, vh - 40) + 'px';
    $('pops').appendChild(el); setTimeout(() => el.remove(), 1150);
  }
  let bannerT = 0;
  function banner(text, ms) { const b = $('banner'); b.textContent = text; b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), ms || 1100); }

  // ---- fish
  function spawnFish(kind, far) {
    const K = KINDS[kind], mesh = makeFish(K); scene.add(mesh);
    let x = 0, z = 0;
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (ARENA - 4); x = Math.sin(a) * r; z = Math.cos(a) * r; if (Math.hypot(x - B.x, z - B.z) > far) break; }
    const yaw = rnd() * 6.283;
    const f = { kind, K, mesh, x, z, y: -K.depth, yaw, want: yaw, turnT: rnd() * 2, state: 'swim', wig: rnd() * 6, spook: 0, leapT: 3 + rnd() * 10, ringT: rnd() * 2, vy: 0, pitch: 0, phase: 'tired', phaseT: 0, side: 1, yankT: 0, wasReel: false, t: 0, bonus: 1, sx: 0, sz: 0 };
    fish.push(f); return f;
  }
  function dropFish(f, again) {
    const i = fish.indexOf(f); if (i >= 0) fish.splice(i, 1);
    scene.remove(f.mesh); f.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    if (again) spawnFish(f.kind, 24);
  }
  function bite(f, bonus) {
    f.state = 'hooked'; f.bonus = bonus; f.phase = 'tired'; f.phaseT = f.K.rush ? 0.5 + rnd() * 0.4 : 1e9; f.yankT = 0; f.wasReel = true;
    L.state = 'hooked'; L.fish = f; S.tension = 0.3; lure.visible = false;
    splash(f.x, f.z, 14, 1); SFX.bite();
    pop(bonus > 1 ? 'В яблочко! x2' : 'Клюёт!', f.x, 1, f.z, bonus > 1 ? 'gold' : 'cool');
    if (!S.hinted) { S.hinted = true; $('hint').classList.add('gone'); }
  }
  function snap(f) {
    f.state = 'swim'; f.spook = 2; f.want = yawTo(f.x - B.x, f.z - B.z); f.mesh.userData.mat.color.setScalar(1);
    L.state = 'idle'; L.fish = null; L.cool = S.t + 0.35; S.combo = 0; S.shake = 0.5;
    pop('Обрыв!', f.x, 1.2, f.z, 'bad'); SFX.snap(); splash(f.x, f.z, 10, 1);
  }
  function land(f) {
    f.state = 'fly'; f.t = 0; f.sx = f.x; f.sz = f.z; f.mesh.userData.mat.color.setScalar(1); L.state = 'land';
    splash(f.x, f.z, 22, 1.5); SFX.splash(0.35);
    if (f.K.score >= 300) S.slowT = 0.35;
  }
  function caught(f) {
    const mult = Math.min(8, 1 + S.combo), gain = Math.round(f.K.score * mult * f.bonus);
    S.score += gain; S.combo++; S.count++; S.bestCombo = Math.max(S.bestCombo, S.combo); S.left = Math.min(99, S.left + f.K.time);
    if (!S.big || f.K.score > S.big.score) S.big = f.K;
    S.shake = Math.min(1, 0.35 + f.K.score / 800); S.flash = 0.6;
    confetti(B.x, 1.6, B.z, 18 + Math.min(40, f.K.score / 12)); SFX.win(Math.round(f.K.score / 150));
    pop('+' + gain, B.x, 2.6, B.z, 'gold'); pop(f.K.name + ' · +' + f.K.time + ' с', B.x, 1.2, B.z + 1.2, 'cool');
    if (S.combo === 3 || S.combo === 5 || S.combo === 8) banner('Комбо x' + Math.min(8, 1 + S.combo) + '!');
    const c = $('combo'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
    L.state = 'idle'; L.fish = null; L.cool = S.t + 0.1;
    dropFish(f, true);
  }
  const wantReel = () => S.mode === 'play' && (hold || keys.Space || S.testReel);

  function fight(f, dt) {
    const K = f.K; let dx = f.x - B.x, dz = f.z - B.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const reel = wantReel();
    f.phaseT -= dt;
    if (f.phaseT <= 0) {
      if (f.phase === 'tired') { f.phase = 'warn'; f.phaseT = 0.45; SFX.warn(); pop('!', f.x, 1.4, f.z, 'bad'); }
      else if (f.phase === 'warn') { f.phase = 'rush'; f.phaseT = pick(K.rushDur); f.side = rnd() < 0.5 ? -1 : 1; }
      else { f.phase = 'tired'; f.phaseT = pick(K.rest); f.yankT = 0.5; }
    }
    // pressing right as the rush ends jerks the fish closer
    if (f.yankT > 0) {
      f.yankT -= dt;
      if (reel && !f.wasReel) { const pull = Math.min(4.5, d - 3.6); f.x -= dx * pull; f.z -= dz * pull; f.yankT = 0; S.score += 20; pop('Чётко! +20', f.x, 1.3, f.z, 'cool'); SFX.yank(); splash(f.x, f.z, 10, 1.2); }
    }
    f.wasReel = reel;
    let out = 0, lat = 0;
    if (f.phase === 'rush') { out = K.rush; lat = K.rush * 0.45 * f.side; S.tension = reel ? S.tension + 1.5 * dt : damp(S.tension, 0.3, 4 * dt); }
    else if (reel) { out = -K.reel; S.tension = damp(S.tension, 0.5 + 0.06 * Math.sin(S.t * 22), 8 * dt); }
    else { out = 1.2; S.tension = damp(S.tension, 0.1, 4 * dt); }
    if (d > MAXLINE) S.tension += (0.3 + (d - MAXLINE) * 0.2) * dt;
    f.x += (dx * out - dz * lat) * dt; f.z += (dz * out + dx * lat) * dt;
    const r = Math.hypot(f.x, f.z); if (r > ARENA + 4) { f.x *= (ARENA + 4) / r; f.z *= (ARENA + 4) / r; }
    f.yaw = turn(f.yaw, yawTo(dx, dz) + Math.sin(f.wig * 0.9) * (f.phase === 'tired' ? 0.5 : 0.25) + lat * 0.05, 9 * dt);
    f.y = damp(f.y, -K.depth * 0.5, 6 * dt); f.pitch = 0;
    f.ringT -= dt;
    if (f.ringT <= 0 && (reel || f.phase === 'rush')) { f.ringT = 0.07; SPRAY.add(f.x, 0.05, f.z, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 0.5, 0.12 + Math.random() * 0.12, DROP); if (Math.random() < 0.3) RINGS.add(f.x, f.z, 0.2, 1.2, 0.6, 0.6); }
    const hot = f.phase === 'tired' ? 0 : 0.5 + 0.5 * Math.sin(S.t * 30);
    f.mesh.userData.mat.color.setRGB(1 + hot * 2.2, 1 - hot * 0.55, 1 - hot * 0.6);
    if (S.tension >= 1) snap(f); else if (d < 3.5) land(f);
  }

  function stepFish(f, dt) {
    const K = f.K, u = f.mesh.userData;
    f.wig += dt * (f.state === 'swim' ? 7 : 15);
    if (f.state === 'hooked') fight(f, dt);
    else if (f.state === 'fly') {
      f.t += dt / 0.55; const k = Math.min(1, f.t);
      f.x = f.sx + (B.x - f.sx) * k; f.z = f.sz + (B.z - f.sz) * k; f.y = -0.2 + 1.5 * k + 4.2 * k * (1 - k); f.pitch = k * 7;
      if (Math.random() < 0.6) SPRAY.add(f.x, f.y, f.z, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.5, 0.1 + Math.random() * 0.1, DROP);
      if (k >= 1) { caught(f); return; }
    } else if (f.state === 'leap') {
      f.vy -= 15 * dt; f.y += f.vy * dt; const sp = K.speed * 1.7;
      f.x -= Math.sin(f.yaw) * sp * dt; f.z -= Math.cos(f.yaw) * sp * dt; f.pitch = Math.atan2(f.vy, sp);
      if (f.y < -K.depth && f.vy < 0) { f.state = 'swim'; f.leapT = 5 + rnd() * 11; f.pitch = 0; splash(f.x, f.z, 8, 0.6 + K.len * 0.25); }
    } else if (f.state === 'lured') {
      if (L.state !== 'wait' || L.fish !== f) { f.state = 'swim'; }
      else {
        const dx = L.x - f.x, dz = L.z - f.z, d = Math.hypot(dx, dz);
        f.yaw = turn(f.yaw, yawTo(dx, dz), 9 * dt); const sp = Math.min(K.speed * 3.2, d / dt);
        f.x -= Math.sin(f.yaw) * sp * dt; f.z -= Math.cos(f.yaw) * sp * dt;
        if (d < 0.8) bite(f, 1);
      }
    } else {
      f.turnT -= dt;
      const r = Math.hypot(f.x, f.z);
      if (f.turnT <= 0) { f.turnT = 1 + rnd() * 2.5; f.want = r > ARENA - 8 ? Math.atan2(f.x, f.z) + (rnd() - 0.5) : f.want + (rnd() - 0.5) * 2.4; }
      const bx = f.x - B.x, bz = f.z - B.z, bd = Math.hypot(bx, bz);
      if (bd < 3.4 && B.speed > 2.5 && f.spook <= 0) { f.spook = 1.3; f.want = yawTo(bx, bz); }
      let sp = K.speed; if (f.spook > 0) { f.spook -= dt; sp *= 2.6; }
      f.yaw = turn(f.yaw, f.want, (f.spook > 0 ? 7 : 1.8) * dt);
      f.x -= Math.sin(f.yaw) * sp * dt; f.z -= Math.cos(f.yaw) * sp * dt; f.y = damp(f.y, -K.depth, 4 * dt); f.pitch = 0;
      f.leapT -= dt; f.ringT -= dt;
      if (f.leapT <= 0 && f.spook <= 0 && r < ARENA - 4) { f.state = 'leap'; f.vy = 5 + K.len * 0.9; f.y = -K.depth; splash(f.x, f.z, 8, 0.6 + K.len * 0.25); }
      if (f.ringT <= 0) { f.ringT = 0.9 + rnd(); RINGS.add(f.x, f.z, K.len * 0.3, K.len * 0.9, 1.1, 0.45); }
      if (L.state === 'wait' && !L.fish && f.spook <= 0 && Math.hypot(L.x - f.x, L.z - f.z) < K.sense * 0.75) { f.state = 'lured'; L.fish = f; pop('!', f.x, 1, f.z, 'gold'); }
    }
    f.mesh.position.set(f.x, f.y, f.z);
    f.mesh.rotation.set(f.pitch, f.yaw + Math.sin(f.wig) * 0.12, 0, 'YXZ');
    u.tail.rotation.y = Math.sin(f.wig - 1) * 0.6;
  }

  // ---- the lure
  function castAt(wx, wz) {
    if (S.mode !== 'play' || S.paused || L.state === 'fly' || L.state === 'hooked' || L.state === 'land' || S.t < L.cool) return false;
    let dx = wx - B.x, dz = wz - B.z, d = Math.hypot(dx, dz) || 1;
    const dd = clamp(d, 5, RANGE); dx *= dd / d; dz *= dd / d;
    L.fish = null; L.state = 'fly'; L.t = 0; L.dur = 0.26 + dd * 0.011; L.tx = B.x + dx; L.tz = B.z + dz;
    boat.root.updateMatrixWorld(true); boat.tip.getWorldPosition(tipW); L.sx = tipW.x; L.sy = tipW.y; L.sz = tipW.z;
    L.x = L.sx; L.y = L.sy; L.z = L.sz; L.cool = S.t + 0.2; S.castK = 1; lure.visible = true; SFX.cast();
    return true;
  }
  function stepLure(dt) {
    if (L.state === 'fly') {
      L.t += dt / L.dur; const k = Math.min(1, L.t), d = Math.hypot(L.tx - L.sx, L.tz - L.sz);
      L.x = L.sx + (L.tx - L.sx) * k; L.z = L.sz + (L.tz - L.sz) * k; L.y = L.sy * (1 - k) + (1.5 + d * 0.1) * 4 * k * (1 - k);
      if (k >= 1) {
        L.state = 'wait'; L.y = 0; splash(L.x, L.z, 10, 0.8); SFX.plop();
        let best = null, bd = 1e9;
        for (const f of fish) { if (f.state !== 'swim') continue; const d2 = Math.hypot(f.x - L.x, f.z - L.z); if (d2 < f.K.sense && d2 < bd) { bd = d2; best = f; } }
        if (best && bd < 1.5 + best.K.len * 0.35) bite(best, 2);
        else if (best) { best.state = 'lured'; best.spook = 0; L.fish = best; pop('!', best.x, 1, best.z, 'gold'); }
        else RINGS.add(L.x, L.z, 0.5, 5, 0.9, 0.35, AQUA);
      }
    } else if (L.state === 'wait') {
      L.y = Math.sin(S.t * 5) * 0.05;
      if (Math.hypot(L.x - B.x, L.z - B.z) > RANGE + 8) { L.state = 'idle'; L.fish = null; }
    }
    lure.visible = L.state === 'fly' || L.state === 'wait';
    lure.position.set(L.x, L.y + 0.08, L.z);
  }
  function autoCast() { // the space bar throws at the nearest fish, a little ahead of it
    let best = null, bd = RANGE;
    for (const f of fish) { if (f.state !== 'swim') continue; const d = Math.hypot(f.x - B.x, f.z - B.z); if (d < bd && d > 4) { bd = d; best = f; } }
    if (best) { const lead = best.K.speed * (0.26 + bd * 0.011); castAt(best.x - Math.sin(best.yaw) * lead, best.z - Math.cos(best.yaw) * lead); }
    else castAt(B.x - Math.sin(B.yaw) * 14, B.z - Math.cos(B.yaw) * 14);
  }

  // ---- the shark
  function spawnShark() {
    if (shark) return shark;
    const a = rnd() * 6.283, mesh = makeFish(SHARK); scene.add(mesh);
    shark = { mesh, x: B.x + Math.sin(a) * 30, z: B.z + Math.cos(a) * 30, yaw: a + Math.PI, t: 0, state: 'hunt', orbit: a, wig: 0 };
    banner('Акула!'); SFX.shark();
    return shark;
  }
  function stepShark(dt) {
    const s = shark; s.t += dt; s.wig += dt * 6;
    const f = L.state === 'hooked' ? L.fish : null;
    let sp = 5.5;
    if (s.state === 'flee') { sp = 15; s.yaw = turn(s.yaw, yawTo(s.x - B.x, s.z - B.z), 6 * dt); if (s.t > 2.2) { scene.remove(s.mesh); shark = null; return; } }
    else {
      let tx, tz;
      if (f) { tx = f.x; tz = f.z; sp = 8.4; } else { s.orbit += dt * 0.5; tx = B.x + Math.sin(s.orbit) * 10; tz = B.z + Math.cos(s.orbit) * 10; }
      s.yaw = turn(s.yaw, yawTo(tx - s.x, tz - s.z), 2.4 * dt);
      if (f && Math.hypot(f.x - s.x, f.z - s.z) < 1.6) {
        pop('Акула сожрала улов!', f.x, 1.4, f.z, 'bad'); splash(f.x, f.z, 30, 1.8); SFX.chomp(); S.combo = 0; S.shake = 0.8;
        L.state = 'idle'; L.fish = null; L.cool = S.t + 0.4; dropFish(f, true); s.state = 'flee'; s.t = 0;
      } else if (Math.hypot(B.x - s.x, B.z - s.z) < 2.9 && B.speed > 4.5) {
        S.score += 150; pop('Таран! +150', s.x, 1.6, s.z, 'gold'); splash(s.x, s.z, 30, 1.8); SFX.ram(); S.shake = 0.9; s.state = 'flee'; s.t = 0; B.vx *= 0.4; B.vz *= 0.4;
      } else if (s.t > 15 && !f) { s.state = 'flee'; s.t = 0; }
    }
    s.x -= Math.sin(s.yaw) * sp * dt; s.z -= Math.cos(s.yaw) * sp * dt;
    s.mesh.position.set(s.x, -0.6, s.z); s.mesh.rotation.set(0, s.yaw + Math.sin(s.wig) * 0.1, 0); s.mesh.userData.tail.rotation.y = Math.sin(s.wig - 1) * 0.55;
    if (Math.random() < dt * 8) RINGS.add(s.x, s.z, 0.4, 2.4, 0.8, 0.8, RED);
  }

  // ---- the boat
  function stepBoat(dt, live) {
    let ix = 0, iz = 0;
    if (live) {
      ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (stick ? stick.x : 0);
      iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + (stick ? stick.y : 0);
      const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
    }
    const on = ix || iz, k = Math.min(1, (on ? 2.6 : 1.3) * dt);
    B.vx += (ix * MAXS - B.vx) * k; B.vz += (iz * MAXS - B.vz) * k;
    B.x += B.vx * dt; B.z += B.vz * dt;
    const r = Math.hypot(B.x, B.z);
    if (r > ARENA - 1.5) { const nx = B.x / r, nz = B.z / r, vo = B.vx * nx + B.vz * nz; B.x = nx * (ARENA - 1.5); B.z = nz * (ARENA - 1.5); if (vo > 0) { B.vx -= nx * vo; B.vz -= nz * vo; } }
    B.speed = Math.hypot(B.vx, B.vz);
    let rate = 0;
    if (B.speed > 0.7) { const prev = B.yaw; B.yaw = turn(B.yaw, yawTo(B.vx, B.vz), 3.4 * dt); rate = (B.yaw - prev) / dt; }
    B.roll = damp(B.roll, clamp(rate * 0.13, -0.35, 0.35), 6 * dt);
    const sk = B.speed / MAXS;
    boat.root.position.set(B.x, Math.sin(S.t * 2.1) * 0.06 + sk * 0.1, B.z); boat.root.rotation.y = B.yaw;
    boat.hull.rotation.set(sk * 0.1 + Math.sin(S.t * 1.7) * 0.02, 0, B.roll + Math.sin(S.t * 1.3) * 0.025);
    // wake and bow spray
    S.wakeT -= dt * B.speed;
    if (S.wakeT <= 0 && B.speed > 1.5) {
      S.wakeT = 1.1; const fx = -Math.sin(B.yaw), fz = -Math.cos(B.yaw);
      RINGS.add(B.x - fx * 2.2, B.z - fz * 2.2, 0.5, 1.6 + sk * 1.6, 1.2, 0.55);
      for (const sd of [-1, 1]) for (let i = 0; i < 2; i++) SPRAY.add(B.x + fx * 1.6 + fz * sd * 0.7, 0.1, B.z + fz * 1.6 - fx * sd * 0.7, fz * sd * (2 + Math.random() * 2) - fx * 1, 1.5 + Math.random() * 2.5 * sk, -fx * sd * (2 + Math.random() * 2) - fz * 1, 0.5, 0.1 + Math.random() * 0.14, DROP);
    }
    // the angler and the rod follow the line
    const hooked = L.state === 'hooked' || L.state === 'land';
    let tx = null, tz = 0;
    if (hooked && L.fish) { tx = L.fish.x; tz = L.fish.z; } else if (L.state === 'fly' || L.state === 'wait') { tx = L.x; tz = L.z; }
    B.aim = turn(B.aim, tx === null ? 0 : yawTo(tx - B.x, tz - B.z) - B.yaw, 10 * dt);
    boat.man.rotation.y = B.aim;
    S.castK = Math.max(0, S.castK - dt * 4.5);
    B.bend = damp(B.bend, hooked ? 0.3 + S.tension : 0.08, 10 * dt);
    boat.rod.rotation.x = -0.8 + S.castK * 1.5 + (hooked && wantReel() ? 0.25 : 0);
    boat.segs.forEach((s, i) => { s.rotation.x = i ? -B.bend * 0.22 : 0; });
    if (hooked && wantReel()) boat.reel.rotation.x += dt * 25;
  }

  // ---- one step of the world
  const camOff = new T.Vector3(0, 11, 17);
  function step(dt) {
    if (S.paused) return;
    const play = S.mode === 'play';
    if (S.slowT > 0) { S.slowT -= dt; dt *= 0.3; }
    S.t += dt;
    stepBoat(dt, play);
    if (play) {
      S.left -= dt;
      S.sharkT -= dt;
      if (S.sharkT <= 0 && !shark) { S.sharkT = 16 + rnd() * 10; spawnShark(); }
      if (S.left <= 0) { S.left = 0; if (L.state !== 'hooked' && L.state !== 'land') over(); }
    }
    stepLure(dt);
    for (let i = fish.length - 1; i >= 0; i--) stepFish(fish[i], dt);
    if (shark) stepShark(dt);
    SPRAY.step(dt); RINGS.step(dt);
    // the line
    if (L.state === 'idle') LINE.mesh.visible = false;
    else {
      boat.root.updateMatrixWorld(true); boat.tip.getWorldPosition(tipW);
      const f = L.fish, tied = (L.state === 'hooked' || L.state === 'land') && f;
      if (tied) endW.set(f.x, f.y + 0.1, f.z); else endW.set(L.x, L.y + 0.1, L.z);
      const d = tipW.distanceTo(endW), t = tied ? S.tension : 0;
      LINE.set(tipW, endW, L.state === 'fly' ? d * 0.03 : (1 - t) * Math.min(1.6, d * 0.06), camera.position, 0.0016 * 720 / Math.max(480, vh));
      const hot = clamp((t - 0.55) / 0.4, 0, 1); LINE.mat.color.setRGB(1.5 + hot * 1.6, 1.5 - hot * 1.1, 1.5 - hot * 1.2);
    }
    // the camera keeps its angle and slides after the boat, leaning toward the fish on the line
    const asp = vw / vh, ck = asp < 1 ? 1.5 : asp < 1.4 ? 1.2 : 1;
    let fx = B.x + B.vx * 0.3, fz = B.z + B.vz * 0.3;
    if (L.state !== 'idle') { const lx = L.fish && L.state !== 'wait' ? L.fish.x : L.x, lz = L.fish && L.state !== 'wait' ? L.fish.z : L.z; fx += clamp(lx - B.x, -16, 16) * 0.3; fz += clamp(lz - B.z, -16, 16) * 0.3; }
    camF.x = damp(camF.x, fx, 3.5 * dt); camF.z = damp(camF.z, fz, 3.5 * dt);
    S.shake = Math.max(0, S.shake - dt * 2.4);
    const sh = S.shake * S.shake * 0.5;
    camera.position.set(camF.x + camOff.x * ck + (Math.random() - 0.5) * sh, camOff.y * ck + (Math.random() - 0.5) * sh, camF.z + camOff.z * ck);
    camera.lookAt(camF.x, 0, camF.z - 11.7 * ck); camera.updateMatrixWorld();
    W.update(S.t, camera);
    S.flash = Math.max(0, S.flash - dt * 2.5);
    grade.uniforms.flash.value = S.flash;
    grade.uniforms.danger.value = damp(grade.uniforms.danger.value, L.state === 'hooked' ? clamp((S.tension - 0.6) / 0.35, 0, 1) : 0, 10 * dt);
    reticle.visible = play && !TOUCH && aim.on && (L.state === 'idle' || L.state === 'wait');
    if (reticle.visible) { let dx = aim.x - B.x, dz = aim.z - B.z; const d = Math.hypot(dx, dz) || 1, dd = clamp(d, 5, RANGE); reticle.position.x = B.x + dx * dd / d; reticle.position.z = B.z + dz * dd / d; reticle.rotation.y = S.t * 2; }
    SFX.live(B.speed / MAXS, L.state === 'hooked' ? S.tension : 0, L.state === 'hooked' && wantReel());
    hud();
  }
  function set(id, key, val, fn) { if (S.shown[key] !== val) { S.shown[key] = val; fn($(id), val); } }
  function hud() {
    set('score', 'score', S.score, (el, v) => { el.textContent = v; });
    set('time', 'time', Math.ceil(S.left), (el, v) => { el.textContent = v; el.classList.toggle('low', v <= 10); });
    const mult = Math.min(8, 1 + S.combo);
    set('combo', 'mult', mult, (el, v) => { el.hidden = v < 2; el.textContent = 'x' + v; });
    const f = L.state === 'hooked' ? L.fish : null;
    set('fight', 'fight', !!f, (el, v) => { el.hidden = !v; });
    if (f) {
      $('tfill').style.clipPath = 'inset(0 ' + (100 - clamp(S.tension, 0, 1) * 100).toFixed(1) + '% 0 0)';
      set('fname', 'fname', f.K.name + ' · ' + Math.round(Math.hypot(f.x - B.x, f.z - B.z)) + ' м', (el, v) => { el.textContent = v; });
      set('cue', 'cue', f.phase === 'tired' ? 'ТЯНИ!' : 'ОТПУСТИ!', (el, v) => { el.textContent = v; el.classList.toggle('stop', v !== 'ТЯНИ!'); });
    }
  }
  function frame() { composer.render(); }

  // ---- starting and ending a run
  function begin(sd) {
    if (sd) seed = sd >>> 0;
    while (fish.length) dropFish(fish[0], false);
    if (shark) { scene.remove(shark.mesh); shark = null; }
    Object.assign(S, { mode: 'play', left: 60, score: 0, combo: 0, bestCombo: 0, count: 0, big: null, paused: false, shake: 0, slowT: 0, sharkT: 16, tension: 0, testReel: false, hinted: false });
    Object.assign(B, { x: 0, z: 0, vx: 0, vz: 0, yaw: 0, roll: 0 }); L.state = 'idle'; L.fish = null; L.cool = 0; hold = false; stick = null; showStick();
    for (const k in KINDS) for (let i = 0; i < KINDS[k].n; i++) spawnFish(k, k === 'gold' ? 26 : 7);
    $('title').hidden = $('over').hidden = $('pause').hidden = true; $('hud').hidden = false;
    $('hint').classList.remove('gone'); setTimeout(() => { if (!S.hinted) { S.hinted = true; $('hint').classList.add('gone'); } }, 12000);
    SFX.start();
  }
  function over() {
    S.mode = 'over'; hold = false; stick = null; showStick();
    const rec = S.score > S.best; if (rec) { S.best = S.score; try { localStorage.setItem('mad-bite-best', String(S.best)); } catch (e) { /* private window */ } }
    $('overStats').innerHTML = '<b>' + S.score + '</b> очков' + (rec && S.score ? ' — новый рекорд!' : ', рекорд ' + S.best + '.') + '<br>Поймано: <b>' + S.count + '</b>, лучшая серия: <b>' + S.bestCombo + '</b>' + (S.big ? ', главный трофей: <b>' + S.big.name.toLowerCase() + '</b>' : '') + '.';
    $('over').hidden = false; $('hud').hidden = true; $('banner').classList.remove('on'); $('fight').hidden = true; S.shown = {}; SFX.over();
  }
  function pause(on) { if (S.mode !== 'play') return; S.paused = on; $('pause').hidden = !on; if (on) hold = false; }

  // ---- hands
  const aim = { x: 0, z: 0, on: false }, ray = new T.Raycaster(), ndc = new T.Vector2();
  const local = (ev) => { const r = stage.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  function toWater(x, y, o) {
    ndc.set(x / vw * 2 - 1, 1 - y / vh * 2); ray.setFromCamera(ndc, camera);
    const d = ray.ray.direction, p = ray.ray.origin, t = d.y < -0.02 ? -p.y / d.y : 400;
    o.x = p.x + d.x * t; o.z = p.z + d.z * t; return o;
  }
  const hit = { x: 0, z: 0 };
  function press(x, y) {
    if (S.mode !== 'play' || S.paused) return;
    SFX.start(); hold = true;
    if (L.state !== 'hooked' && L.state !== 'land') { toWater(x, y, hit); castAt(hit.x, hit.z); }
  }
  function showStick() { const el = $('stick'); el.hidden = !stick; if (stick) { el.style.left = stick.ox + 'px'; el.style.top = stick.oy + 'px'; $('knob').style.transform = 'translate(' + stick.x * 34 + 'px,' + stick.y * 34 + 'px)'; } }
  const capture = (ev) => { try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* no such pointer */ } };
  let finger = null;
  stage.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' || ev.target.closest('button') || S.mode !== 'play' || S.paused) return;
    ev.preventDefault();
    const [x, y] = local(ev);
    if (!stick && x < vw * 0.4 && y > vh * 0.55) { stick = { id: ev.pointerId, ox: x, oy: y, x: 0, y: 0 }; showStick(); capture(ev); return; }
    finger = ev.pointerId; press(x, y); capture(ev);
  });
  stage.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'mouse' || !stick || ev.pointerId !== stick.id) return;
    const [x, y] = local(ev), dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy), m = 56, k = d > m ? m / d : 1;
    stick.x = dx * k / m; stick.y = dy * k / m; showStick();
  });
  const release = (ev) => {
    if (ev.pointerType === 'mouse') return;
    if (stick && ev.pointerId === stick.id) { stick = null; showStick(); return; }
    if (ev.pointerId === finger) { finger = null; hold = false; }
  };
  stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);
  stage.addEventListener('mousedown', (ev) => { if (ev.button !== 0 || ev.target.closest('button')) return; ev.preventDefault(); const [x, y] = local(ev); press(x, y); });
  window.addEventListener('mousemove', (ev) => { const [x, y] = local(ev); toWater(x, y, aim); aim.on = true; });
  window.addEventListener('mouseup', (ev) => { if (ev.button === 0) hold = false; });
  stage.addEventListener('contextmenu', (ev) => ev.preventDefault());
  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Escape' || ev.code === 'KeyP') { pause(!S.paused); return; }
    if (S.mode !== 'play') return;
    if (/^(Key[WASD]|Arrow|Space)/.test(ev.code)) ev.preventDefault();
    if (ev.code === 'Space' && !ev.repeat && !S.paused) { SFX.start(); if (L.state !== 'hooked' && L.state !== 'land') autoCast(); }
    keys[ev.code] = true;
  });
  window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; hold = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  $('start').addEventListener('click', () => begin());
  $('again').addEventListener('click', () => begin());
  $('resume').addEventListener('click', () => pause(false));
  $('sound').addEventListener('click', (ev) => { const off = ev.currentTarget.getAttribute('aria-pressed') !== 'true'; ev.currentTarget.setAttribute('aria-pressed', String(off)); ev.currentTarget.textContent = off ? 'Звук выкл' : 'Звук вкл'; SFX.mute(off); });

  function resize() {
    vw = stage.clientWidth || 1; vh = stage.clientHeight || 1;
    renderer.setSize(vw, vh, false); composer.setSize(vw, vh);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    SPRAY.mat.uniforms.scale.value = vh * PR / (2 * Math.tan(FOV * Math.PI / 360));
  }
  window.addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  resize();

  // the title screen already has a living sea behind it
  for (const k in KINDS) for (let i = 0; i < KINDS[k].n; i++) spawnFish(k, 6);
  let last = performance.now();
  function tick(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); frame(); requestAnimationFrame(tick); }
  step(0.016); frame();
  requestAnimationFrame(tick);
  window.__game = { S, B, L, fish, camera, canvas, KINDS, step, frame, begin, castAt, spawnShark, spawnFish, get shark() { return shark; }, reel(on) { S.testReel = on; } };
})();
