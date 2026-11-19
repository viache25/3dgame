// node test/play.cjs — opens the built page in a headless browser and plays it: start, cut an idol, cut the parts again in slowed time,
// cut a pillar, take a blow. Fails on any page error. Writes pictures of each moment to out/.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
// DIST=1 plays the site in dist/ instead, with the CDN cut off, to prove it needs nothing from outside
const DIST = !!process.env.DIST, html = fs.readFileSync(path.join(__dirname, DIST ? '../dist/index.html' : '../index.html'), 'utf8');
const out = (n) => path.join(__dirname, '../out', n);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const size = process.env.PHONE ? { width: 400, height: 780 } : { width: 1280, height: 720 };
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: !!process.env.PHONE, isMobile: !!process.env.PHONE });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  if (DIST) { await p.route('https://cdn.jsdelivr.net/**', (r) => r.abort()); await p.route('http://local.test/*.js', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, '../dist', new URL(r.request().url()).pathname)), contentType: 'application/javascript' })); }
  else await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, '../node_modules/three', r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  await p.goto('http://local.test/');
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
  const tag = process.env.PHONE ? 'phone-' : '';
  // the page's own clock is stopped, so only the test decides how much time passes and nothing moves between its steps
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; });
  const shot = async (name) => { await p.evaluate(() => __game.frame()); await p.screenshot({ path: out(tag + name + '.png') }); };
  const run = (sec) => p.evaluate((s) => { for (let i = 0; i < Math.round(s * 60); i++) __game.step(1 / 60); }, sec);
  await shot('1-title');
  await p.evaluate(() => { __game.begin(4242); __game.S.autoPick = true; window.clearIdols = () => { const g = __game; for (const e of g.enemies) if (!e.dead) { e.dead = true; if (e.rig.root.parent) e.rig.root.parent.remove(e.rig.root); } g.S.queue.length = 0; g.S.next = 1e9; }; window.risen = () => { const g = __game; for (let k = 0; k < 600; k++) { const e = g.enemies.find((x) => !x.dead && x.state !== 'rise'); if (e) return e; g.P.invul = 1; g.step(1 / 60); } throw new Error('no idol to cut'); }; });
  await run(2.6);
  let st = await p.evaluate(() => ({ mode: __game.S.mode, idols: __game.enemies.length, bodies: __game.bodies.length }));
  assert.strictEqual(st.mode, 'play'); assert(st.idols >= 2, 'idols have risen: ' + st.idols);
  await shot('2-wave');
  // stand next to an idol and cut across its chest
  const cutIdol = (dy0, dy1) => p.evaluate(([a, c]) => {
    const g = __game, e = risen();
    g.P.x = e.x - 1.7; g.P.z = e.z + 0.4;
    for (let i = 0; i < 6; i++) g.step(1 / 60);
    const v = new THREE.Vector3(e.x, 1.1 * e.scale, e.z).project(g.camera), w = g.canvas.clientWidth, h = g.canvas.clientHeight;
    const x = (v.x * 0.5 + 0.5) * w, y = (0.5 - v.y * 0.5) * h, before = g.bodies.length, kills = g.S.kills;
    g.slash(x - 110, y + a, x + 110, y + c);
    for (let i = 0; i < 8; i++) g.step(1 / 60);
    return { made: g.bodies.length - before, killed: g.S.kills - kills, parts: g.S.parts };
  }, [dy0, dy1]);
  let r = await cutIdol(-30, 40);
  assert(r.killed === 1 && r.made >= 2, 'a cut through the chest fells the idol: ' + JSON.stringify(r));
  await run(0.25);
  await shot('3-cut');
  // a real drag of the mouse across an idol, and a real key held down
  r = await p.evaluate(() => { const g = __game, e = risen(); g.P.x = e.x - 1.6; g.P.z = e.z + 0.3; g.P.invul = 9; for (let i = 0; i < 70; i++) g.step(1 / 60); /* the camera has caught up */ g.camera.updateMatrixWorld(); const v = new THREE.Vector3(e.x, 1.1 * e.scale, e.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * g.canvas.clientWidth, y: (0.5 - v.y * 0.5) * g.canvas.clientHeight, kills: g.S.kills }; });
  await p.mouse.move(r.x - 100, r.y - 20); await p.mouse.down(); await p.mouse.move(r.x, r.y + 5, { steps: 4 }); await p.mouse.move(r.x + 100, r.y + 30, { steps: 4 }); await p.mouse.up();
  await run(0.2);
  st = await p.evaluate(() => ({ kills: __game.S.kills, x: __game.P.x }));
  assert(st.kills === r.kills + 1, 'a mouse drag cuts: ' + JSON.stringify(st));
  await p.keyboard.down('KeyD'); await run(0.5); await p.keyboard.up('KeyD');
  assert((await p.evaluate(() => __game.P.x)) > st.x + 1.5, 'D runs right');
  await p.evaluate(() => { __game.P.invul = 0; });
  if (process.env.PHONE) { // real fingers: the left thumb runs the wanderer while the right one cuts
    const cdp = await ctx.newCDPSession(p), touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    r = await p.evaluate(() => { const g = __game, e = risen(); g.P.x = e.x - 1.6; g.P.z = e.z + 0.3; g.P.invul = 9; for (let i = 0; i < 70; i++) g.step(1 / 60); g.camera.updateMatrixWorld(); const v = new THREE.Vector3(e.x, 1.1 * e.scale, e.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * g.canvas.clientWidth, y: (0.5 - v.y * 0.5) * g.canvas.clientHeight, kills: g.S.kills, px: g.P.x }; });
    await touch('touchStart', [{ x: 60, y: 600, id: 1 }]);
    await touch('touchMove', [{ x: 130, y: 600, id: 1 }]);
    await touch('touchStart', [{ x: 130, y: 600, id: 1 }, { x: r.x - 80, y: r.y - 20, id: 2 }]);
    await touch('touchMove', [{ x: 130, y: 600, id: 1 }, { x: r.x, y: r.y, id: 2 }]);
    await touch('touchMove', [{ x: 130, y: 600, id: 1 }, { x: r.x + 80, y: r.y + 25, id: 2 }]);
    await touch('touchEnd', [{ x: r.x + 80, y: r.y + 25, id: 2 }]); // lifts the cutting finger only
    await run(0.4);
    st = await p.evaluate(() => ({ kills: __game.S.kills, x: __game.P.x, stick: !document.getElementById('stick').hidden }));
    assert(st.kills === r.kills + 1, 'a finger swipe cuts: ' + JSON.stringify(st));
    assert(st.stick && st.x > r.px + 1, 'the left thumb runs the wanderer: ' + JSON.stringify(st));
    await touch('touchEnd', [{ x: 130, y: 600, id: 1 }]);
    assert(await p.evaluate(() => document.getElementById('stick').hidden), 'lifting the thumb lets go of the stick');
    await p.evaluate(() => { __game.P.invul = 0; });
  }
  // a raised fist can be cut off and the idol lives on
  await run(1.5);
  r = await p.evaluate(() => {
    const g = __game;
    let e = g.enemies.find((x) => !x.dead && x.kind === 'grunt' && x.state === 'chase');
    if (!e) { e = g.spawnIdol('grunt'); g.P.invul = 9; for (let i = 0; i < 80; i++) g.step(1 / 60); }
    // the idol faces away from the camera, so the line across its raised fist passes over its head, not through it
    e.yaw = Math.PI; g.P.x = e.x; g.P.z = e.z - 1.9; g.P.invul = 9;
    e.state = 'windup'; e.t = 0.3; e.atk = 1; for (let i = 0; i < 2; i++) g.step(1 / 240);
    e.rig.root.updateMatrixWorld(true); g.camera.updateMatrixWorld();
    const f = new THREE.Vector3(0, -0.42, 0).applyMatrix4(e.rig.bones.foreR.matrixWorld), v = f.clone().project(g.camera), x = (v.x * 0.5 + 0.5) * g.canvas.clientWidth, y = (0.5 - v.y * 0.5) * g.canvas.clientHeight, before = g.bodies.length;
    g.slash(x - 60, y, x + 60, y + 4);
    for (let i = 0; i < 6; i++) g.step(1 / 60);
    return { dead: e.dead, state: e.state, made: g.bodies.length - before, fistY: f.y, pieces: e.rig.bones.foreR.pieces.length };
  });
  assert(!r.dead && r.made >= 1, 'the fist comes off and the idol lives: ' + JSON.stringify(r));
  await shot('3b-fist');
  // slowed time: chop what is falling
  await p.evaluate(() => {
    const g = __game; g.setFocus(true);
    for (let i = 0; i < 20; i++) g.step(1 / 60);
    const w = g.canvas.clientWidth, h = g.canvas.clientHeight, v = new THREE.Vector3(g.P.x + 1.6, 0.8, g.P.z - 0.3).project(g.camera), x = (v.x * 0.5 + 0.5) * w, y = (0.5 - v.y * 0.5) * h;
    for (const [a, c, d, e] of [[-120, -60, 120, 70], [-120, 60, 120, -50], [-20, -130, 30, 130], [-130, 0, 130, 10], [-90, -90, 90, 90]]) { g.slash(x + a, y + c, x + d, y + e); for (let i = 0; i < 7; i++) g.step(1 / 60); }
  });
  st = await p.evaluate(() => ({ parts: __game.S.parts, focus: __game.S.focusOn, scale: __game.S.scale }));
  assert(st.focus && st.scale < 0.2, 'time is slowed'); assert(st.parts >= 8, 'the parts were chopped again: ' + st.parts);
  await shot('4-focus');
  await p.evaluate(() => __game.setFocus(false));
  await run(1.2);
  // a pillar: the top comes off and the stump stays
  r = await p.evaluate(() => {
    const g = __game, pil = g.bodies.filter((b) => b.anchored && b.solid && b.solid.r > 0.5)[0];
    g.P.x = pil.x - 1.5; g.P.z = pil.z + 0.6;
    for (let i = 0; i < 20; i++) g.step(1 / 60);
    const w = g.canvas.clientWidth, h = g.canvas.clientHeight, v = new THREE.Vector3(pil.x, 1.5, pil.z).project(g.camera), x = (v.x * 0.5 + 0.5) * w, y = (0.5 - v.y * 0.5) * h, before = g.bodies.length;
    g.slash(x - 120, y - 45, x + 120, y + 45);
    for (let i = 0; i < 16; i++) g.step(1 / 60);
    const near = g.bodies.filter((b) => Math.hypot(b.x - pil.x, b.z - pil.z) < 3 && b.radius > 0.5);
    return { made: g.bodies.length - before, stump: near.some((b) => b.anchored), top: near.some((b) => !b.anchored), blocked: !!pil.solid.body };
  });
  assert(r.made >= 1 && r.stump && r.top && r.blocked, 'pillar: ' + JSON.stringify(r));
  await shot('5-pillar');
  // stand still and get hit
  const hp0 = await p.evaluate(() => { const g = __game; g.P.invul = 0; if (!g.enemies.some((e) => !e.dead)) g.spawnIdol('grunt'); return g.P.hp; });
  await run(12);
  st = await p.evaluate(() => ({ hp: __game.P.hp, mode: __game.S.mode, bodies: __game.bodies.length, wave: __game.S.wave }));
  assert(st.hp < hp0, 'idols hit a wanderer who stands still: ' + st.hp);
  await shot('6-hit');
  // a quick tap picks the nearest idol
  await p.evaluate(() => { const g = __game; g.P.hp = 100; for (let k = 0; k < 14; k++) { const e = risen(); g.P.x = e.x - 1.5; g.P.z = e.z + 0.3; g.step(1 / 60); const v = new THREE.Vector3(e.x, 1, e.z).project(g.camera); g.tapSlash((v.x * 0.5 + 0.5) * g.canvas.clientWidth, (0.5 - v.y * 0.5) * g.canvas.clientHeight); for (let i = 0; i < 16; i++) g.step(1 / 60); } });
  st = await p.evaluate(() => ({ kills: __game.S.kills, wave: __game.S.wave, bodies: __game.bodies.length, parts: __game.S.parts }));
  assert(st.kills >= 4, 'taps fell idols: ' + JSON.stringify(st));
  await run(0.3);
  await shot('7-taps');
  // a new level stops the world and offers three lessons; picking one changes the wanderer
  await p.evaluate(() => { const g = __game; clearIdols(); g.S.autoPick = false; g.P.invul = 99; g.gainXp(g.S.need); for (let i = 0; i < 200 && !g.S.choosing; i++) g.step(1 / 60); });
  await p.waitForSelector('#levelup:not([hidden])', { timeout: 5000 });
  await shot('7b-level');
  r = await p.evaluate(() => JSON.stringify(__game.P.up));
  await p.click('#card2');
  st = await p.evaluate(() => ({ choosing: __game.S.choosing, up: JSON.stringify(__game.P.up), hidden: document.getElementById('levelup').hidden }));
  assert(!st.choosing && st.hidden && st.up !== r, 'a lesson was learned: ' + JSON.stringify(st));
  await p.evaluate(() => { __game.S.autoPick = true; });
  // a thrower keeps its distance and its fire reaches a wanderer who stands still
  r = await p.evaluate(() => {
    const g = __game, e = g.spawnIdol('thrower');
    g.P.invul = 0; g.P.hp = g.P.maxHp; g.P.speed = 0;
    let shots = 0;
    for (let i = 0; i < 60 * 7; i++) { g.P.x = e.x; g.P.z = e.z + 8; g.step(1 / 60); if (g.bodies.some((b) => b.kind === 'shot')) shots++; }
    return { shots, hp: g.P.hp, max: g.P.maxHp, state: e.state };
  });
  assert(r.shots > 0 && r.hp < r.max, 'thrown fire flies and lands: ' + JSON.stringify(r));
  // the colossus: the legs go first, the rest comes down alive, and then the chest is in reach
  r = await p.evaluate(() => {
    const g = __game;
    clearIdols();
    const e = g.spawnIdol('colossus'), hold = () => { g.P.x = e.x - 2.3; g.P.z = e.z + 0.4; g.P.invul = 99; g.P.hp = g.P.maxHp; };
    const cutAt = (bone, y, half) => { g.camera.updateMatrixWorld(); e.rig.root.updateMatrixWorld(true); const w = new THREE.Vector3(0, y, 0).applyMatrix4(e.rig.bones[bone].matrixWorld), v = w.clone().project(g.camera), sx = (v.x * 0.5 + 0.5) * g.canvas.clientWidth, sy = (0.5 - v.y * 0.5) * g.canvas.clientHeight; g.slash(sx - half, sy - 6, sx + half, sy + 6); for (let i = 0; i < 12; i++) { hold(); g.step(1 / 60); } return w.y; };
    for (let i = 0; i < 230; i++) { hold(); g.step(1 / 60); }
    const high = cutAt('chest', 0.3, 150), stood = { dead: e.dead, down: e.down }; // out of reach while it stands
    const shin = cutAt('shinL', -0.15, 110), felled = { dead: e.dead, down: e.down };
    for (let i = 0; i < 150; i++) { hold(); g.step(1 / 60); }
    const chest = cutAt('chest', 0.3, 170);
    return { high, stood, shin, felled, chest, dead: e.dead, level: g.S.level };
  });
  assert(!r.stood.dead && !r.stood.down, 'a standing colossus is too tall to cut down the middle: ' + JSON.stringify(r));
  assert(r.felled.down && !r.felled.dead, 'cutting a leg brings it down alive: ' + JSON.stringify(r));
  assert(r.dead && r.chest < 2.2, 'on the ground its chest is in reach: ' + JSON.stringify(r));
  await run(0.4);
  await shot('7c-colossus');
  // the dash upgrade cuts whoever the dash passes
  r = await p.evaluate(() => {
    const g = __game;
    clearIdols();
    g.P.up.whirl = 1; g.applyUps();
    const e = g.spawnIdol('grunt');
    for (let i = 0; i < 90; i++) { g.P.x = e.x - 2; g.P.z = e.z; g.P.invul = 9; g.step(1 / 60); }
    g.P.x = e.x - 2; g.P.z = e.z; g.P.yaw = Math.PI / 2; g.P.speed = 0; g.P.dashCd = 0; e.state = 'stagger'; e.t = 0;
    const from = g.P.x;
    g.dash();
    for (let i = 0; i < 20; i++) g.step(1 / 60);
    return { dead: e.dead, moved: g.P.x - from };
  });
  assert(r.dead && r.moved > 2, 'a dash with the upgrade cuts through: ' + JSON.stringify(r));
  // lose on purpose
  await p.evaluate(() => { const g = __game; g.P.invul = 0; g.hurt(999, g.P.x + 1, g.P.z); for (let i = 0; i < 40; i++) g.step(1 / 60); });
  st = await p.evaluate(() => __game.S.mode);
  assert.strictEqual(st, 'dead');
  await p.waitForSelector('#dead:not([hidden])', { timeout: 20000 });
  await shot('8-dead');
  assert.deepStrictEqual(errors, [], 'page errors:\n' + errors.join('\n'));
  console.log('play ok', JSON.stringify(await p.evaluate(() => ({ kills: __game.S.kills, parts: __game.S.parts, wave: __game.S.wave }))));
  await b.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
