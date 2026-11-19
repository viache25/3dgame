// The place: a salt flat at dusk. Low sun, long shadows, mesas far off in the haze.
function buildWorld(scene) {
  const SUN = new T.Vector3(-0.56, 0.42, -0.72).normalize();
  const HAZE = lin(0xe9a26b);
  scene.fog = new T.Fog(HAZE, 38, 190);

  const sky = new T.Mesh(new T.SphereGeometry(600, 32, 16), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN }, uTop: { value: lin(0x27325f) }, uMid: { value: lin(0xc8748a) }, uLow: { value: HAZE } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSun, uTop, uMid, uLow; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.22, h));
        c = mix(c, uTop, smoothstep(0.12, 0.75, h));
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.55, 0.22) * (pow(s, 6.0) * 0.55 + pow(s, 60.0) * 1.2);
        c += vec3(1.0, 0.9, 0.7) * smoothstep(0.9988, 0.9993, s) * 6.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // sand: pale, with wind ripples and salt cracks drawn once on a canvas
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#dcb98f'; g.fillRect(0, 0, 512, 512);
  let seed = 11;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() > 0.5 ? 'rgba(255,236,205,0.10)' : 'rgba(120,70,40,0.07)'; const s = 1 + rnd() * 2.2; g.fillRect(rnd() * 512, rnd() * 512, s, s); }
  g.lineWidth = 1.4;
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = 'rgba(126,78,52,' + (0.1 + rnd() * 0.12).toFixed(3) + ')';
    g.beginPath();
    let x = rnd() * 512, y = rnd() * 512, a = rnd() * 6.28;
    g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { a += (rnd() - 0.5) * 1.3; x += Math.cos(a) * (14 + rnd() * 22); y += Math.sin(a) * (14 + rnd() * 22); g.lineTo(x, y); }
    g.stroke();
  }
  const tex = new T.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(70, 70); tex.anisotropy = 4; tex.encoding = T.sRGBEncoding;
  const ground = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  // mesas on the horizon: one mesh, never cut
  const far = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rnd() * 0.2, r = 110 + rnd() * 90, w = 14 + rnd() * 26, h = 9 + rnd() * 26;
    far.push(GEO.place(GEO.lathe([[w, 0], [w * 0.8, h * 0.55], [w * 0.62, h]], { sides: 7, col: 1, sx: 1 + rnd() * 0.8, sz: 0.7 + rnd() * 0.5 }), Math.cos(a) * r, -0.5, Math.sin(a) * r, 0, rnd() * 3, 0));
  }
  const mesas = new T.Mesh(partGeometry(far), new T.MeshLambertMaterial({ vertexColors: true }));
  scene.add(mesas);

  scene.add(new T.HemisphereLight(lin(0x8ea2e8), lin(0xd08a58), 0.62));
  const sun = new T.DirectionalLight(lin(0xffc890), 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  return {
    SUN, sun,
    follow(x, z) { // the shadow box travels with the wanderer, in whole texels so shadows do not swim
      const step = 44 / 2048 * 8, fx = Math.round(x / step) * step, fz = Math.round(z / step) * step;
      sun.target.position.set(fx, 0, fz); sun.position.set(fx + SUN.x * 60, SUN.y * 60, fz + SUN.z * 60);
      sky.position.set(x, 0, z);
    },
  };
}
