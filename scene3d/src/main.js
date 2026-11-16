(function () {
  const canvas = document.getElementById('gl');
  const fail = () => { document.getElementById('fail').hidden = false; };
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: /render/.test(location.hash) }); } catch (e) { fail(); return; }
  const RENDER = /render/.test(location.hash);
  if (RENDER) document.body.classList.add('render');
  const PR = RENDER ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.outputEncoding = T.LinearEncoding; // the last pass tone-maps and encodes
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.localClippingEnabled = true; // the spear is revealed by a plane when it is made again

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(col(0x1c1848), 0.0105);
  scene.environment = makeEnv(renderer);
  const camera = new T.PerspectiveCamera(32, 16 / 9, 0.1, 1200);
  camera.layers.enable(1);
  const hdr = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const W = buildWorld(scene, hdr);
  const hoplite = buildHoplite(), luna = buildLuna();
  scene.add(hoplite.root, hoplite.spear, hoplite.pieces[0], hoplite.pieces[1], luna.root, luna.katana);
  for (const o of [hoplite.root, hoplite.spear, hoplite.pieces[0], hoplite.pieces[1]]) addOutlines(o, 0.011);
  addOutlines(luna.root, 0.009); addOutlines(luna.katana, 0.006);
  // light that the energy throws on the floor and on the other fighter
  const pl = (hex, k, d) => { const l = new T.PointLight(col(hex), k, d, 1.6); l.userData.i0 = k; scene.add(l); return l; };
  const lights = [pl(0xff4fb0, 1.0, 5), pl(0xa259ff, 0.9, 4), pl(0xff3b5c, 1.6, 4.5)];

  // ---- post: scene (HDR) → bloom → tone map + vignette
  const rt = new T.WebGLRenderTarget(4, 4, hdr ? { type: T.HalfFloatType, samples: 4 } : {});
  const composer = new T.EffectComposer(renderer, rt);
  composer.setPixelRatio(PR);
  composer.addPass(new T.RenderPass(scene, camera));
  const bloom = new T.UnrealBloomPass(new T.Vector2(4, 4), 0.48, 0.5, 0.45);
  composer.addPass(bloom);
  const grade = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure; varying vec2 vUv;
      vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){
        c = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777) * (c * exposure / 0.6);
        c = fit(c);
        return clamp(mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602) * c, 0.0, 1.0);
      }
      void main(){
        vec3 c = aces(texture2D(tDiffuse, vUv).rgb);
        vec2 q = vUv - 0.5;
        c *= 1.0 - 0.55 * smoothstep(0.35, 0.95, length(q * vec2(1.0, 0.9)) * 1.25);
        c = pow(c, vec3(1.0 / 2.2));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);

  const fx = buildFX(scene);
  const film = buildFilm({ scene, camera, hoplite, luna, fx, W, lights, grade, bloom });
  const DUR = EV.fadeEnd, FPS = 30;
  let now = 0, free = false, freeFov = 34, follow = null, lastS = null, controls = null;
  function setTime(t, cam) { now = Math.min(DUR, Math.max(0, t)); film.update(now, cam); composer.render(); }
  // where a fighter (or the middle of the two) stands at a moment of the film
  const subject = (who, t) => {
    const ta = Math.min(Math.max(0, t), EV.freeze), h = film.evalTrack(film.HT, ta), l = film.evalTrack(film.LT, ta);
    const H = v3(h.x, 1.05, h.z || 0), L = v3(l.x, 1.15, l.z || 0);
    return who === 'hoplite' ? H : who === 'luna' ? L : H.add(L).multiplyScalar(0.5);
  };
  // one frame with whichever camera is in charge: the film's, or the viewer's own
  function draw(t) {
    if (!free) { setTime(t); return; }
    t = Math.min(DUR, Math.max(0, t));
    if (follow) { const s = subject(follow, t); if (lastS) { const d = s.clone().sub(lastS); camera.position.add(d); controls.target.add(d); } lastS = s; }
    controls.update();
    const p = camera.position, g = controls.target;
    if (g.y < 0.05) { p.y += 0.05 - g.y; g.y = 0.05; }
    if (p.y < 0.1) p.y = 0.1; // never under the mirror floor
    setTime(t, [p.x, p.y, p.z, g.x, g.y, g.z, freeFov]);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; freeFov = w / h < 0.8 ? 56 : w / h < 1.25 ? 44 : 34;
    camera.updateProjectionMatrix();
    draw(now);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  window.__film = { setTime, EV, DUR, renderer, scene, camera, film, hoplite, luna };
  if (RENDER) return;

  // ---- the player: picture follows the sound's clock
  const $ = (id) => document.getElementById(id), btn = $('play'), bar = $('seek'), clock = $('clock');
  const B64 = $('audio-data').textContent.trim();
  let actx = null, abuf = null, src = null, playing = false, t0 = 0, wall0 = 0, rate = 1, aud = false;
  const fmt = (t) => t.toFixed(2).replace('.', ',') + ' с';
  const ui = () => { bar.value = String(now); clock.textContent = fmt(now) + ' / ' + fmt(DUR); };
  const press = (list, on) => list.forEach((b) => b.setAttribute('aria-pressed', String(on(b))));
  async function sound() {
    if (!B64 || abuf) return;
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const bin = atob(B64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    abuf = await new Promise((res, rej) => actx.decodeAudioData(u8.buffer, res, rej)).catch(() => null);
  }
  function stopSound() { if (src) { try { src.onended = null; src.stop(); } catch (e) {} src = null; } }
  const clockNow = () => (aud ? actx.currentTime : performance.now() / 1000);
  async function play() {
    if (now >= DUR - 0.05) { lastS = null; draw(0); }
    await sound();
    playing = true; btn.textContent = 'Пауза'; t0 = now; aud = !!abuf && rate === 1; // slowed down, the film runs silent
    if (aud) { if (actx.state === 'suspended') await actx.resume(); stopSound(); src = actx.createBufferSource(); src.buffer = abuf; src.connect(actx.destination); src.start(0, Math.min(now, abuf.duration - 0.01)); }
    wall0 = clockNow();
    requestAnimationFrame(loop);
  }
  function pause() { playing = false; btn.textContent = 'Смотреть'; stopSound(); }
  function loop() {
    if (!playing) return;
    const t = t0 + (clockNow() - wall0) * rate;
    draw(t); ui();
    if (t >= DUR) { pause(); return; }
    requestAnimationFrame(loop);
  }
  const seekTo = (t) => { const was = playing; if (was) pause(); draw(t); ui(); if (was) play(); };
  const step = (n) => { if (playing) pause(); draw((Math.round(now * FPS) + n) / FPS); ui(); };
  btn.addEventListener('click', () => (playing ? pause() : play()));
  bar.max = String(DUR);
  bar.addEventListener('input', () => seekTo(+bar.value));
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  const rates = [...document.querySelectorAll('#rates button')];
  rates.forEach((b) => b.addEventListener('click', () => { const was = playing; if (was) pause(); rate = +b.dataset.rate; press(rates, (x) => x === b); $('quiet').hidden = rate === 1; if (was) play(); }));

  // ---- the viewer's own camera: orbit, zoom and pan at any moment of the film, playing or paused
  controls = new T.OrbitControls(camera, canvas);
  controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.12; controls.screenSpacePanning = true;
  controls.minDistance = 0.5; controls.maxDistance = 26; controls.maxPolarAngle = 89.4 * D; controls.zoomSpeed = 0.9;
  let queued = false;
  const tick = () => { queued = false; if (!playing && free) draw(now); };
  controls.addEventListener('change', () => { if (!queued && !playing && free) { queued = true; requestAnimationFrame(tick); } });
  controls.addEventListener('start', () => $('hint').classList.add('gone'));
  const views = [...document.querySelectorAll('#views button')];
  function setFree(on) {
    if (on === free) return;
    if (on) {
      // start from exactly what the film's camera shows at this moment
      const p = camera.position.clone(), d = camera.getWorldDirection(v3()), f0 = camera.fov;
      let dist = Math.abs(d.z) > 0.05 ? -p.z / d.z : -1; // the fighters stand on the line z = 0
      if (!(dist > 1 && dist < 14)) dist = Math.min(14, Math.max(1, p.distanceTo(subject('both', now))));
      const g = p.clone().addScaledVector(d, dist);
      free = film.free = true; document.body.classList.add('free'); $('views').hidden = false; $('hint').hidden = false; $('hint').classList.remove('gone');
      const w = canvas.clientWidth, h = canvas.clientHeight; if (w && h) freeFov = w / h < 0.8 ? 56 : w / h < 1.25 ? 44 : 34;
      controls.target.copy(g); camera.position.copy(g).add(p.sub(g).multiplyScalar(Math.tan((f0 * D) / 2) / Math.tan((freeFov * D) / 2)));
      controls.enabled = true; follow = null; lastS = null; press(views, () => false);
    } else { free = film.free = false; controls.enabled = false; document.body.classList.remove('free'); $('views').hidden = true; $('hint').hidden = true; }
    $('cam-film').setAttribute('aria-pressed', String(!free)); $('cam-free').setAttribute('aria-pressed', String(free));
    resize(); draw(now);
  }
  // a ready angle that then travels with its fighter; pressing it again leaves the camera standing where it is
  function setView(name) {
    if (follow && views.find((b) => b.dataset.view === name).getAttribute('aria-pressed') === 'true') { follow = null; lastS = null; press(views, () => false); return; }
    const who = name === 'top' ? 'both' : name, s = subject(who, now), sep = Math.abs(subject('luna', now).x - subject('hoplite', now).x);
    const V = { both: { o: [0, 0.1, 1], span: sep / 2 + 1.3 }, hoplite: { o: [0.55, 0.12, 1], span: 1.35 }, luna: { o: [-0.55, 0.12, 1], span: 1.35 }, top: { o: [0, 1, 0.3], span: sep / 2 + 1.6 } }[name];
    const th = Math.tan((freeFov * D) / 2), dist = Math.min(18, Math.max(1.5, V.span / (th * camera.aspect), 1.3 / th));
    controls.target.copy(s); camera.position.copy(s).addScaledVector(v3(V.o[0], V.o[1], V.o[2]).normalize(), dist);
    follow = who; lastS = s; press(views, (b) => b.dataset.view === name);
    draw(now);
  }
  $('cam-film').addEventListener('click', () => setFree(false));
  $('cam-free').addEventListener('click', () => setFree(true));
  views.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onButton = e.target && e.target.tagName === 'BUTTON';
    if (e.code === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.code === 'Space' && !onButton) { e.preventDefault(); playing ? pause() : play(); }
    else if (e.code === 'KeyC') setFree(!free);
  });
  Object.assign(window.__film, { setFree, setView, draw });
  draw(1.0); ui();
})();
