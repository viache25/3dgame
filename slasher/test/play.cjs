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
  let st, r;
  // the page's own clock is stopped, so only the test decides how much time passes and nothing moves between its steps
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; });
  const shot = async (name) => { await p.evaluate(() => __game.frame()); await p.screenshot({ path: out(tag + name + '.png') }); };
  const run = (sec) => p.evaluate((s) => { for (let i = 0; i < Math.round(s * 60); i++) __game.step(1 / 60); }, sec);
  await shot('1-title');
  // the main menu: the keys walk it, Enter opens a screen, Esc comes back; settings are applied at once and kept
  st = await p.evaluate(() => ({ items: document.querySelectorAll('#title .item').length, focus: document.activeElement && document.activeElement.id, sheet: __game.S.sheet }));
  assert(st.items === 4 && st.focus === 'start' && st.sheet === 'title', 'the main menu is up with Play in focus: ' + JSON.stringify(st));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  await p.keyboard.press('Enter');
  assert(await p.evaluate(() => __game.S.sheet === 'controls' && !document.getElementById('controls').hidden && document.getElementById('title').hidden), 'three steps down and Enter: the controls screen');
  await shot('0b-controls');
  await p.keyboard.press('Escape');
  assert(await p.evaluate(() => __game.S.sheet === 'title'), 'Esc goes back to the main menu');
  await p.click('#title [data-open="settings"]');
  await p.click('#optGfx [data-v="low"]');
  await p.evaluate(() => { const r = document.getElementById('optShake'); r.value = 40; r.dispatchEvent(new Event('input')); });
  st = await p.evaluate(() => ({ opt: __game.OPT, kept: JSON.parse(localStorage.getItem('blade-neon-settings')), ratio: __game.renderer.getPixelRatio(), shadows: __game.renderer.shadowMap.enabled, mirror: __game.W.mirror ? __game.W.mirror.visible : false }));
  assert(st.opt.gfx === 'low' && st.kept.gfx === 'low' && st.kept.shake === 40 && st.ratio < 1 && !st.shadows && !st.mirror, 'low graphics: fewer pixels, no shadows, no mirror, and it is kept: ' + JSON.stringify(st));
  await shot('0c-settings');
  await p.click('#optGfx [data-v="high"]');
  await p.evaluate(() => { const r = document.getElementById('optShake'); r.value = 100; r.dispatchEvent(new Event('input')); });
  await p.click('#settings [data-back]');
  assert(await p.evaluate(() => __game.S.sheet === 'title' && __game.renderer.shadowMap.enabled), 'back to the menu on high again');
  // the arsenal: pick a style and a technique, each is tried on the practice idol at once, and the choice is kept
  await p.click('#openArsenal');
  await run(1.2);
  await p.click('#optStyle .opt[data-id="violet"]');
  await run(1.6);
  await shot('1b-arsenal-style');
  await p.click('#optTech .opt[data-id="iai"]'); // techniques are not chosen any more, only tried
  await run(0.45);
  await shot('1c-arsenal-technique');
  await run(1.6);
  await p.click('#optUlt .opt[data-id="saw"]'); // the ultimate is a choice, and it is tried at once too
  await run(1.6);
  st = await p.evaluate(() => ({ load: JSON.stringify(__game.LOAD), kept: localStorage.getItem('blade-clay-loadout'), act: !!__game.P.act, mode: __game.S.mode, kills: __game.S.kills, pressed: document.querySelectorAll('#arsenal .opt[aria-pressed="true"]').length }));
  assert.strictEqual(st.load, '{"style":"violet","ult":"saw"}', 'the choice is taken: ' + JSON.stringify(st));
  assert(st.kept === st.load && !st.act && st.mode === 'title' && st.pressed === 2 && st.kills >= 1, 'kept, shown and tried: ' + JSON.stringify(st));
  await p.click('#arsenalDone');
  assert(await p.evaluate(() => !document.getElementById('title').hidden && document.getElementById('arsenal').hidden && !__game.enemies.length), 'back to the title, practice idol gone');
  await p.evaluate(() => { __game.begin(4242); __game.S.autoPick = true; window.clearIdols = () => { const g = __game; for (const e of g.enemies) if (!e.dead) { e.dead = true; if (e.rig.root.parent) e.rig.root.parent.remove(e.rig.root); } g.S.queue.length = 0; g.S.next = 1e9; }; window.risen = () => { const g = __game; for (let k = 0; k < 600; k++) { const e = g.enemies.find((x) => !x.dead && x.state !== 'rise'); if (e) return e; g.P.invul = 1; g.step(1 / 60); } throw new Error('no idol to cut'); }; });
  await run(2.6);
  st = await p.evaluate(() => ({ mode: __game.S.mode, idols: __game.enemies.length, bodies: __game.bodies.length }));
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
  r = await cutIdol(-30, 40);
  assert(r.killed === 1 && r.made >= 2, 'a cut through the chest fells the idol: ' + JSON.stringify(r));
  assert(await p.evaluate(() => __game.S.ult > 0), 'a kill charges the ultimate');
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
    // through the raised forearm: the hand and the blade in it come off
    const f = new THREE.Vector3(0, -0.15, 0).applyMatrix4(e.rig.bones.foreR.matrixWorld), v = f.clone().project(g.camera), x = (v.x * 0.5 + 0.5) * g.canvas.clientWidth, y = (0.5 - v.y * 0.5) * g.canvas.clientHeight, before = g.bodies.length;
    g.slash(x - 60, y, x + 60, y + 4);
    for (let i = 0; i < 6; i++) g.step(1 / 60);
    return { dead: e.dead, state: e.state, made: g.bodies.length - before, fistY: f.y, pieces: e.rig.bones.foreR.pieces.length, arm: e.arm };
  });
  assert(!r.dead && r.made >= 1 && r.arm === 'L', 'the sword arm comes off, the synth lives and fights on with its other hand: ' + JSON.stringify(r));
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
  // pause: Esc stops the world and puts up a menu; from it the run can be left for the main menu
  await p.evaluate(() => { __game.P.invul = 99; });
  await p.keyboard.press('Escape');
  st = await p.evaluate(() => ({ paused: __game.S.paused, sheet: __game.S.sheet, items: document.querySelectorAll('#pause .item').length, t: __game.S.time }));
  assert(st.paused && st.sheet === 'pause' && st.items === 6, 'Esc pauses: ' + JSON.stringify(st));
  await shot('7a-pause');
  await p.keyboard.press('Escape');
  assert(await p.evaluate(() => !__game.S.paused && __game.S.sheet === null), 'Esc again resumes');
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
    for (let i = 0; i < 60 * 7; i++) { g.P.x = e.x; g.P.z = e.z + 8; g.step(1 / 60); if (g.bolts.length) shots++; }
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
  // the four techniques, each against idols set out for it
  await p.evaluate(() => {
    const g = __game;
    window.setOut = (slots, spots) => { // idols that stand still at given offsets from the wanderer, who is put back in the middle
      clearIdols(); g.noMouse(); g.waves.length = 0;
      window.slots = slots; // which techniques this scene is for
      g.P.x = 0; g.P.z = 0; g.P.yaw = 0; g.P.speed = 0; g.P.act = null; g.P.invul = 99; g.P.hp = g.P.maxHp; g.S.slowT = 0; g.S.stop = 0;
      for (const id in g.P.cd) g.P.cd[id] = 0;
      const out = spots.map(([x, z]) => { const e = g.spawnIdol('grunt'); e.x = x; e.z = z; e.speed = 0; e.dummy = true; e.range = -1; e.rig.root.position.set(x, -2 * e.scale, z); return e; });
      for (let i = 0; i < 90; i++) { g.P.x = 0; g.P.z = 0; g.step(1 / 60); }
      return out;
    };
    window.go = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g.step(1 / 60); };
  });
  r = await p.evaluate(() => { const g = __game, es = setOut(['storm', 'wave'], [[0, 3], [0.9, 3.6], [-0.8, 3.4]]), parts = g.S.parts; const ok = g.cast(slots[0]); go(0.45); return { ok, hidden: !g.P.rig.root.visible, scale: g.S.scale, mid: es.filter((e) => e.dead).length, parts: g.S.parts - parts, bodies: g.bodies.length }; });
  assert(r.ok && r.hidden && r.scale < 0.1, 'thousand cuts: the wanderer is gone and the world stands still: ' + JSON.stringify(r));
  await shot('9a-storm');
  r = await p.evaluate(() => { const g = __game; go(1.4); return { act: !!g.P.act, shown: g.P.rig.root.visible, scale: g.S.scale, alive: g.enemies.filter((e) => !e.dead).length, bodies: g.bodies.length, z: g.P.z, cd: g.P.cd.storm }; });
  assert(!r.act && r.shown && r.alive === 0 && r.z > 4 && r.cd > 10, 'thousand cuts: all three in pieces, the wanderer out the far side: ' + JSON.stringify(r));
  assert(r.bodies < 700, 'the rubble is kept in bounds: ' + r.bodies);
  await shot('9b-storm-after');
  r = await p.evaluate(() => { const g = __game, es = setOut(['storm', 'wave'], [[0, 5], [0.6, 9], [-0.7, 13]]); const ok = g.cast(slots[1]); go(0.3); const flying = g.waves.length; return { ok, flying, first: es[0].dead }; });
  assert(r.ok && r.flying === 1, 'crescent: one is in the air: ' + JSON.stringify(r));
  await shot('9c-wave');
  r = await p.evaluate(() => { const g = __game; go(2.2); return { alive: g.enemies.filter((e) => !e.dead).length, flying: g.waves.length, act: !!g.P.act }; });
  assert(r.alive === 0 && r.flying === 0 && !r.act, 'crescent: it cut all three on its way and died out: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const g = __game, es = setOut(['spin', 'iai'], [[2.4, 0], [-2.2, 0.8], [0.3, -2.5], [0.5, 2.6], [7, 7]]); const ok = g.cast(slots[0]); go(0.25); return { ok }; });
  await shot('9d-spin');
  r = await p.evaluate(() => { const g = __game; go(0.6); return { near: g.enemies.filter((e) => !e.dead && Math.hypot(e.x, e.z) < 4).length, far: g.enemies.filter((e) => !e.dead).length, act: !!g.P.act }; });
  assert(r.near === 0 && r.far === 1 && !r.act, 'whirl: everything within reach, nothing beyond: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const g = __game, es = setOut(['spin', 'iai'], [[0, 3], [0.4, 5.5], [-0.5, 8]]); const ok = g.cast(slots[1]); go(0.4); return { ok, z: g.P.z, deadBefore: es.filter((e) => e.dead).length, scale: g.S.scale }; });
  assert(r.ok && r.z > 9 && r.deadBefore === 0 && r.scale < 0.1, 'strike through: past them at once, and nothing has fallen yet: ' + JSON.stringify(r));
  await shot('9e-iai');
  r = await p.evaluate(() => { const g = __game; go(0.6); return { alive: g.enemies.filter((e) => !e.dead).length, act: !!g.P.act }; });
  assert(r.alive === 0 && !r.act, 'strike through: they fall when the blade is home: ' + JSON.stringify(r));
  await run(0.5);
  await shot('9f-iai-after');
  // guard: a gunner's bolt is sent back and takes the gunner; the wanderer is not hurt
  r = await p.evaluate(() => {
    const g = __game;
    setOut(['guard', 'fan'], []);
    g.P.invul = 0;
    const e = g.spawnIdol('thrower'), hp = g.P.hp;
    let fired = false, turned = false;
    for (let i = 0; i < 60 * 9 && !e.dead; i++) {
      g.P.x = 0; g.P.z = 0; e.x = 0; e.z = 8;
      if (g.bolts.length && !g.P.act && g.P.cd.guard <= 0) { fired = true; g.cast(slots[0]); }
      if (g.bolts.some((b) => b.back)) turned = true;
      g.step(1 / 60);
    }
    return { fired, turned, dead: e.dead, hurt: g.P.hp < hp };
  });
  assert(r.fired && r.turned && r.dead && !r.hurt, 'guard turns a bolt back on the gunner: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const g = __game; setOut(['guard', 'fan'], [[0, 6], [-1.9, 6], [1.9, 6]]); const ok = g.cast(slots[1]); go(0.12); return { ok, flying: g.waves.length }; });
  assert(r.ok && r.flying === 3, 'fan: three discs are out: ' + JSON.stringify(r));
  await shot('9g-fan');
  r = await p.evaluate(() => { const g = __game; go(1.3); return { alive: g.enemies.filter((e) => !e.dead).length, flying: g.waves.length }; });
  assert(r.alive === 0 && r.flying === 0, 'fan: each disc found its synth: ' + JSON.stringify(r));
  r = await p.evaluate(() => { const g = __game; setOut(['leap', 'fan'], [[0, 7], [1.5, 7.5], [-1.4, 6.6], [0.5, 8.6]]); const ok = g.cast(slots[0]); go(0.2); return { ok, up: g.P.y }; });
  assert(r.ok && r.up > 1.5, 'leap: he is in the air: ' + JSON.stringify(r));
  await shot('9h-leap');
  r = await p.evaluate(() => { const g = __game; go(0.25); const just = g.S.shake; go(0.6); return { alive: g.enemies.filter((e) => !e.dead).length, z: g.P.z, y: g.P.y, act: !!g.P.act, just }; });
  assert(r.alive === 0 && r.z > 6 && r.y === 0 && !r.act, 'leap: he lands among them and they all fall: ' + JSON.stringify(r));
  await shot('9i-leap-after');
  // the ultimate: nothing until it is full; overload makes the blade longer for eight seconds and then it is over
  r = await p.evaluate(() => {
    const g = __game;
    setOut(['leap', 'fan'], [[0, 5.2]]);
    g.LOAD.ult = 'over'; g.applyLoad(false);
    const reach0 = g.P.reach;
    g.S.ult = 0.5; const early = g.useUlt();
    g.S.ult = 1; const used = g.useUlt();
    const reach1 = g.P.reach;
    go(1); g.frame();
    return { early, used, reach0, reach1, ult: g.S.ult };
  });
  assert(!r.early && r.used && r.reach1 > r.reach0 * 1.5 && r.ult === 0, 'overload: ' + JSON.stringify(r));
  await shot('9j-overload');
  st = await p.evaluate(() => { go(8); return __game.P.reach; });
  assert(Math.abs(st - r.reach0) < 1e-9, 'overload ends: ' + st);
  r = await p.evaluate(() => { const g = __game; setOut(['leap', 'fan'], [[0, 5], [0.8, 9], [-0.9, 13], [0.3, 17]]); g.LOAD.ult = 'saw'; g.applyLoad(false); g.S.ult = 1; const used = g.useUlt(); go(0.9); return { used, flying: g.waves.length }; });
  assert(r.used && r.flying === 1, 'saw: it is rolling: ' + JSON.stringify(r));
  await shot('9k-saw');
  r = await p.evaluate(() => { const g = __game; go(2.6); return { alive: g.enemies.filter((e) => !e.dead).length, flying: g.waves.length, bodies: g.bodies.length }; });
  assert(r.alive === 0 && r.flying === 0 && r.bodies < 800, 'saw: the whole line is in blocks: ' + JSON.stringify(r));
  // a technique is not ready again at once, and the keys reach it
  r = await p.evaluate(() => { const g = __game; setOut(['spin', 'iai'], [[0, 3]]); const a = g.cast(slots[0]); go(0.7); const b = g.cast(slots[0]); return { a, b, cd: g.P.cd.spin }; });
  assert(r.a && !r.b && r.cd > 5, 'cooldown: ' + JSON.stringify(r));
  await p.evaluate(() => { __game.P.cd.iai = 0; });
  await p.keyboard.press('Digit4');
  assert(await p.evaluate(() => __game.P.act && __game.P.act.id === 'iai'), 'the 4 key calls the fourth technique');
  await run(1.2);
  // mouse and keyboard: holding the button on a synth keeps cutting it, the wheel moves the camera, Tab opens the arsenal over a pause
  r = await p.evaluate(() => { const g = __game; setOut([], [[1.6, -0.3]]); const e = g.enemies[0]; for (let i = 0; i < 60; i++) g.step(1 / 60); g.camera.updateMatrixWorld(); const v = new THREE.Vector3(e.x, 1.1 * e.scale, e.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * g.canvas.clientWidth, y: (0.5 - v.y * 0.5) * g.canvas.clientHeight, kills: g.S.kills }; });
  await p.mouse.move(r.x, r.y); await p.mouse.down();
  await run(0.5);
  st = await p.evaluate(() => ({ kills: __game.S.kills, parts: __game.S.parts, ring: __game.reticle.visible }));
  await p.mouse.up();
  // the ring under the cursor is for a mouse; with fingers there is no cursor to mark
  assert(st.kills === r.kills + 1 && (st.ring || process.env.PHONE), 'holding the button cuts what is under the cursor, and the ring marks the spot: ' + JSON.stringify(st));
  await p.mouse.wheel(0, 300);
  assert(await p.evaluate(() => __game.S.zoom > 1.05), 'the wheel pulls the camera back');
  await p.mouse.wheel(0, -300);
  await p.keyboard.press('Tab');
  st = await p.evaluate(() => ({ paused: __game.S.paused, open: !document.getElementById('arsenal').hidden, chips: document.querySelectorAll('#abils .abil').length }));
  assert(st.paused && st.open && st.chips === 8, 'Tab pauses and opens the arsenal; the bar has seven techniques and the ultimate: ' + JSON.stringify(st));
  await p.keyboard.press('Tab');
  await p.keyboard.press('Escape');
  assert(await p.evaluate(() => !__game.S.paused && document.getElementById('arsenal').hidden), 'and back into the fight');
  await run(1.2);
  // lose on purpose
  await p.evaluate(() => { const g = __game; g.P.invul = 0; g.hurt(999, g.P.x + 1, g.P.z); for (let i = 0; i < 40; i++) g.step(1 / 60); });
  st = await p.evaluate(() => __game.S.mode);
  assert.strictEqual(st, 'dead');
  await p.waitForSelector('#dead:not([hidden])', { timeout: 20000 });
  await shot('8-dead');
  assert(await p.evaluate(() => document.querySelectorAll('#deadStats div').length === 6 && document.activeElement.id === 'again'), 'the run is tallied and Again is in focus');
  await p.click('#deadQuit');
  st = await p.evaluate(() => ({ mode: __game.S.mode, sheet: __game.S.sheet, hud: document.getElementById('hud').hidden, idols: __game.enemies.length, best: document.getElementById('bestLine').textContent }));
  assert(st.mode === 'title' && st.sheet === 'title' && st.hud && st.idols === 0 && /Рекорд/.test(st.best), 'back at the main menu with the record shown: ' + JSON.stringify(st));
  await p.click('#start'); // the cursor is still where the last button was, and whatever it rests on takes the focus, so this is a click
  assert(await p.evaluate(() => __game.S.mode === 'play' && __game.S.sheet === null), 'Play starts a new run');
  assert.deepStrictEqual(errors, [], 'page errors:\n' + errors.join('\n'));
  console.log('play ok', JSON.stringify(await p.evaluate(() => ({ kills: __game.S.kills, parts: __game.S.parts, wave: __game.S.wave }))));
  await b.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
