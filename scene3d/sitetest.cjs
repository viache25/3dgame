// node sitetest.cjs — the standalone page (../index.html) must boot by itself as a complete document.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const html = fs.readFileSync(path.join(__dirname, process.argv[2] || '../index.html'), 'utf8');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'node_modules/three', r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html; charset=utf-8' }));
  await p.goto('http://local.test/'); await p.waitForFunction(() => window.__film && window.__film.setFree, null, { timeout: 90000 });
  const info = await p.evaluate(() => ({ title: document.title, mode: document.compatMode, titleInHead: !!document.head.querySelector('title'), styleInHead: document.head.querySelectorAll('style').length, canvas: [document.getElementById('gl').clientWidth, document.getElementById('gl').clientHeight], scrollW: document.documentElement.scrollWidth - innerWidth, scrollH: document.documentElement.scrollHeight - innerHeight }));
  await p.click('#play'); await p.waitForTimeout(2500); await p.click('#play');
  const clock = await p.textContent('#clock');
  await p.click('#cam-free'); await p.click('#views button[data-view="top"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, 'out', 'site.png') });
  console.log(JSON.stringify(info), '| clock after play:', clock, '|', errs.length ? 'ERRORS: ' + errs.join(' ; ') : 'no errors');
  await b.close();
})();
