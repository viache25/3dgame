// node playtest.cjs — drives the player page like a viewer would: plays, seeks, steps frames, slows down, takes the camera in hand.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const page0 = fs.readFileSync(path.join(__dirname, 'out/index.html'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  let bad = 0;
  const ok = (name, cond, extra) => { if (!cond) bad++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra !== undefined ? '  ' + extra : '')); };
  for (const [w, h, name] of [[1280, 720, 'pl-desk'], [400, 760, 'pl-phone']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: name === 'pl-phone' });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
    await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'node_modules/three', r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
    await p.goto('http://local.test/'); await p.waitForFunction(() => window.__film && window.__film.setFree, null, { timeout: 90000 });
    const cam = () => p.evaluate(() => { const c = window.__film.camera; return [c.position.x, c.position.y, c.position.z, c.fov, c.aspect].map((v) => +v.toFixed(3)); });
    const clock = async () => parseFloat((await p.textContent('#clock')).replace(',', '.'));
    const seek = (t) => p.evaluate((t) => { const s = document.getElementById('seek'); s.value = String(t); s.dispatchEvent(new Event('input')); }, t);
    const box = async () => (await p.$('#gl')).boundingBox();
    console.log('—', name, w + '×' + h);

    if (name === 'pl-desk') {
      await p.click('#play'); await p.waitForTimeout(4000); const t1 = await clock(); await p.click('#play');
      ok('plays with sound clock', t1 > 0.3, 'clock ' + t1 + ' s after 4 s of wall time (software GL is slow)');
      await seek(5.0); await p.click('#next'); await p.click('#next'); const t2 = await clock(); await p.click('#prev'); const t3 = await clock();
      ok('frame step', Math.abs(t2 - (5 + 2 / 30)) < 0.011 && Math.abs(t3 - (5 + 1 / 30)) < 0.011, t2 + ' → ' + t3);
      await p.click('#rates button[data-rate="0.25"]'); ok('slow speed notes silence', await p.isVisible('#quiet'));
      await seek(8.0); const a0 = await clock(); await p.click('#play'); await p.waitForTimeout(3000); await p.click('#play'); const a1 = await clock();
      ok('quarter speed advances slower than the clock', a1 > a0 && a1 - a0 < 1.7, (a1 - a0).toFixed(2) + ' s of film in 3 s');
      await p.click('#rates button[data-rate="1"]');
    }
    // film camera → own camera: the picture must not jump
    await seek(8.3); await p.waitForTimeout(300);
    const b0 = await box(); ok('film frame is 16:9', Math.abs(b0.width / b0.height - 16 / 9) < 0.02, Math.round(b0.width) + '×' + Math.round(b0.height));
    await p.screenshot({ path: path.join(__dirname, 'out', name + '-film.png') });
    await p.click('#cam-free'); await p.waitForTimeout(400);
    const b1 = await box(), c1 = await cam();
    const bars = await p.evaluate(() => [...document.querySelectorAll('.bar')].reduce((m, e) => Math.min(m, e.getBoundingClientRect().top), 1e9));
    ok('own camera fills the room and stops at the controls', b1.height > b0.height - 1 && b1.width >= b0.width - 1 && b1.y + b1.height <= bars + 1, Math.round(b1.width) + '×' + Math.round(b1.height));
    ok('view buttons and hint shown', (await p.isVisible('#views')) && (await p.isVisible('#hint')));
    await p.screenshot({ path: path.join(__dirname, 'out', name + '-free0.png') });
    // drag = orbit, wheel = zoom
    const cx = b1.x + b1.width / 2, cy = b1.y + b1.height / 2;
    await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + 160, cy - 30, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(900);
    const c2 = await cam(); ok('drag turns the camera', Math.hypot(c2[0] - c1[0], c2[2] - c1[2]) > 0.3, JSON.stringify(c1) + ' → ' + JSON.stringify(c2));
    await p.mouse.wheel(0, -400); await p.waitForTimeout(900);
    const c3 = await cam(); ok('wheel moves the camera in', Math.hypot(c3[0] - c2[0], c3[1] - c2[1], c3[2] - c2[2]) > 0.2, JSON.stringify(c3));
    ok('time did not move while orbiting', Math.abs((await clock()) - 8.3) < 0.011);
    // ready angles that travel with a fighter
    await p.click('#views button[data-view="luna"]'); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(__dirname, 'out', name + '-luna.png') });
    const l0 = await cam(); await seek(4.0); await p.waitForTimeout(300); await p.click('#views button[data-view="hoplite"]'); await p.waitForTimeout(200);
    const h0 = await cam(); await seek(5.0); await p.waitForTimeout(300); const h1 = await cam();
    ok('camera travels with the hoplite as he runs', h1[0] - h0[0] > 0.5, 'x ' + h0[0] + ' → ' + h1[0]);
    await p.screenshot({ path: path.join(__dirname, 'out', name + '-hoplite.png') });
    await p.click('#views button[data-view="top"]'); await seek(9.5); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(__dirname, 'out', name + '-top.png') });
    await p.click('#views button[data-view="both"]'); await seek(13.6); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(__dirname, 'out', name + '-both-end.png') });
    if (name === 'pl-desk') { await seek(7.0); await p.click('#play'); await p.waitForTimeout(2500); await p.click('#play'); ok('plays under the own camera', (await clock()) > 7.05, (await clock()) + ' s'); }
    // back to the film
    await p.keyboard.press('KeyC'); await p.waitForTimeout(300);
    const b2 = await box(); ok('C returns the film camera and its frame', Math.abs(b2.width / b2.height - 16 / 9) < 0.02 && !(await p.isVisible('#views')));
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok('no sideways scroll', ov <= 0, 'overflow ' + ov);
    ok('no page errors', errs.length === 0, errs.join(' ; '));
    await p.close();
  }
  await b.close();
  console.log(bad ? bad + ' check(s) failed' : 'all checks passed');
  process.exit(bad ? 1 : 0);
})();
