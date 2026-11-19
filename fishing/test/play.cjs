// node test/play.cjs — opens the built page in a headless browser and plays it: cast with the mouse, reel a fish in, fight one that runs,
// break the line, lose a fish to the shark, ram the shark, run out the clock. Fails on any page error. Pictures of each moment go to out/.
// PHONE=1 runs the same at phone size with real touches.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const out = (n) => path.join(__dirname, '../out', n);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const PHONE = !!process.env.PHONE, size = PHONE ? { width: 400, height: 780 } : { width: 1280, height: 720 };
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: PHONE, isMobile: PHONE });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/favicon|ERR_FAILED|net::|GPU stall|swiftshader|Automatic fallback/i.test(m.text())) errors.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, '../node_modules/three', r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  await p.goto('http://local.test/');
  await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
  const tag = PHONE ? 'phone-' : '';
  // the page's own clock is stopped, so only the test decides how much time passes and nothing moves between its steps
  await p.evaluate(() => {
    window.requestAnimationFrame = () => 0;
    const g = __game;
    window.run = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) g.step(1 / 60); };
    // puts the boat 11 m short of a resting fish of this kind, lets the camera settle and says where the fish is on the screen
    window.setUp = (kind, dist) => {
      const f = g.fish.find((x) => x.kind === kind && x.state === 'swim') || g.spawnFish(kind, 5);
      g.B.x = 0; g.B.z = 6; g.B.vx = g.B.vz = 0; run(1.5);
      f.state = 'swim'; f.x = g.B.x + 2; f.z = g.B.z - (dist || 11); f.y = -f.K.depth; f.spook = 0; f.leapT = 99; f.turnT = 99; f.yaw = f.want = Math.PI / 2;
      for (const o of g.fish) if (o !== f && Math.hypot(o.x - f.x, o.z - f.z) < 9) { o.x += 30; }
      g.camera.updateMatrixWorld();
      const v = new THREE.Vector3(f.x, 0, f.z).project(g.camera);
      window.target = f;
      return { x: (v.x * 0.5 + 0.5) * g.canvas.clientWidth, y: (0.5 - v.y * 0.5) * g.canvas.clientHeight };
    };
    // steps until the test says stop; returns false if it never does
    window.until = (fn, sec) => { for (let i = 0; i < sec * 60; i++) { if (fn()) return true; g.step(1 / 60); } return fn(); };
  });
  const shot = async (name) => { await p.evaluate(() => __game.frame()); await p.screenshot({ path: out(tag + name + '.png') }); };
  const state = () => p.evaluate(() => { const g = __game; return { mode: g.S.mode, line: g.L.state, score: g.S.score, combo: g.S.combo, count: g.S.count, left: g.S.left, x: g.B.x, z: g.B.z, fish: g.fish.length }; });
  await shot('1-title');
  assert(await p.isVisible('#title'), 'the title sheet is up');
  await p.click('#start');
  await p.evaluate(() => { __game.begin(4242); run(1.2); });
  let st = await state();
  assert.strictEqual(st.mode, 'play'); assert(st.fish >= 15, 'the sea is stocked: ' + st.fish);
  await shot('2-sea');

  // a real press on a sardine: the lure flies there, it bites, holding the press hauls it into the boat
  let at = await p.evaluate(() => setUp('sardine'));
  const cdp = PHONE ? await ctx.newCDPSession(p) : null, touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  if (PHONE) await touch('touchStart', [{ x: at.x, y: at.y, id: 1 }]); else { await p.mouse.move(at.x, at.y); await p.mouse.down(); }
  assert.strictEqual((await state()).line, 'fly', 'a press on the water casts');
  await p.evaluate(() => run(0.15)); await shot('3-cast');
  assert(await p.evaluate(() => until(() => __game.L.state === 'hooked', 3)), 'the fish under the lure bites');
  await p.evaluate(() => run(0.3)); await shot('4-hooked');
  assert(await p.isVisible('#fight'), 'the fight gauge shows');
  assert(await p.evaluate(() => until(() => __game.L.state === 'land', 4)), 'holding the press reels it in');
  await p.evaluate(() => run(0.3)); await shot('5-flying');
  await p.evaluate(() => run(0.6));
  if (PHONE) await touch('touchEnd', []); else await p.mouse.up();
  st = await state();
  assert(st.count === 1 && st.score === 100 && st.combo === 1, 'a bullseye sardine pays double: ' + JSON.stringify(st));
  await shot('6-caught');

  // steering
  if (PHONE) {
    await touch('touchStart', [{ x: 70, y: 640, id: 1 }]); await touch('touchMove', [{ x: 140, y: 640, id: 1 }]);
    await p.evaluate(() => run(1));
    assert(await p.evaluate(() => !document.getElementById('stick').hidden), 'the stick shows under the thumb');
    // the other thumb can cast while the first one steers
    await touch('touchStart', [{ x: 140, y: 640, id: 1 }, { x: 250, y: 330, id: 2 }]);
    assert.strictEqual((await state()).line, 'fly', 'a second finger casts while the first steers');
    await touch('touchEnd', [{ x: 140, y: 640, id: 1 }]);
    await touch('touchEnd', []);
    assert(await p.evaluate(() => document.getElementById('stick').hidden), 'lifting the thumb lets go of the stick');
  } else { await p.keyboard.down('KeyD'); await p.evaluate(() => run(1)); await p.keyboard.up('KeyD'); }
  assert((await state()).x > st.x + 3, 'the boat runs right');
  await shot('7-run');

  // a dorado runs: reel while it is tired, let go while it rushes
  await p.evaluate(() => { const g = __game, s = setUp('dorado', 16); g.castAt(target.x, target.z); if (!until(() => g.L.state === 'hooked', 3)) throw new Error('the dorado did not bite'); g.reel(true); });
  assert(await p.evaluate(() => until(() => { __game.reel(target.phase === 'tired'); return target.phase === 'rush'; }, 6)), 'the dorado makes a run');
  await p.evaluate(() => run(0.25)); await shot('8-rush');
  assert.strictEqual(await p.textContent('#cue'), 'ОТПУСТИ!');
  assert(await p.evaluate(() => until(() => { __game.reel(target.state === 'hooked' && target.phase === 'tired'); return __game.S.count === 2; }, 25)), 'played right, the dorado comes in');
  st = await state();
  assert(st.combo === 2 && st.score >= 100 + 150 * 2 * 2, 'the second catch in a row is doubled: ' + JSON.stringify(st));
  await p.evaluate(() => { __game.reel(false); run(0.2); }); await shot('9-combo');

  // reeling through a rush breaks the line
  await p.evaluate(() => { const g = __game; setUp('dorado', 14); g.castAt(target.x, target.z); until(() => g.L.state === 'hooked', 3); g.reel(true); target.phaseT = 0.2; });
  assert(await p.evaluate(() => until(() => __game.L.state === 'idle', 6)), 'the line goes');
  st = await state();
  assert(st.combo === 0 && st.count === 2, 'a break ends the streak and lands nothing: ' + JSON.stringify(st));
  await p.evaluate(() => { __game.reel(false); run(0.2); }); await shot('10-snap');

  // the shark takes a fish left on the line, and can be rammed
  await p.evaluate(() => { const g = __game; setUp('sword', 20); g.castAt(target.x, target.z); until(() => g.L.state === 'hooked', 3); target.phaseT = 99; const s = g.spawnShark(); s.x = target.x + 9; s.z = target.z - 4; run(0.5); });
  await shot('11-shark');
  assert(await p.evaluate(() => until(() => __game.L.state === 'idle', 8)), 'the shark gets there');
  assert(await p.evaluate(() => __game.shark && __game.shark.state === 'flee' && !__game.fish.includes(target)), 'and leaves with the fish');
  st = await state();
  await p.evaluate(() => { const g = __game; until(() => !g.shark, 4); const s = g.spawnShark(); s.x = g.B.x + 3.6; s.z = g.B.z; g.B.vx = 10; g.B.vz = 0; });
  assert(await p.evaluate(() => until(() => __game.shark.state === 'flee', 2)), 'the boat rams the shark');
  assert.strictEqual((await state()).score, st.score + 150);
  await shot('12-ram');

  // the clock runs out
  await p.evaluate(() => { __game.S.left = 0.3; run(0.6); });
  assert.strictEqual((await state()).mode, 'over');
  assert(await p.isVisible('#over'), 'the result sheet is up');
  await shot('13-over');
  await p.click('#again');
  st = await state();
  assert(st.mode === 'play' && st.score === 0 && st.left > 59, 'another run starts clean');
  assert.deepStrictEqual(errors, [], 'page errors:\n' + errors.join('\n'));
  console.log((PHONE ? 'phone' : 'desktop') + ' play ok');
  await b.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
