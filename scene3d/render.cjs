// node render.cjs <WxH> <fps> <outDir> [workers] [t0] [t1] — every frame of the film as JPEG files, split across browser processes.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [size = '1920x1080', fpsS = '30', outDir = 'frames', wS = '3', t0S = '0', t1S = ''] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number), fps = Number(fpsS), W = Number(wS);
  const EV = require('./src/events.js'), t0 = Number(t0S), t1 = t1S ? Number(t1S) : EV.fadeEnd, total = Math.round((t1 - t0) * fps);
  const out = path.resolve(__dirname, outDir); fs.mkdirSync(out, { recursive: true });
  const page0 = fs.readFileSync(path.join(__dirname, 'out/index.html'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
  const start = Date.now(); let done = 0;
  await Promise.all(Array.from({ length: W }, async (_, k) => {
    const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
    await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'node_modules/three', r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
    await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
    await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
    await p.goto('http://local.test/#render');
    await p.waitForFunction(() => window.__film, null, { timeout: 120000 });
    for (let i = k; i < total; i += W) {
      const f = path.join(out, 'f' + String(i).padStart(5, '0') + '.jpg');
      if (fs.existsSync(f)) { done++; continue; }
      const d = await p.evaluate((t) => { window.__film.setTime(t); return document.getElementById('gl').toDataURL('image/jpeg', 0.95); }, t0 + i / fps);
      fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
      if (++done % 60 === 0) console.log(done + '/' + total, ((Date.now() - start) / 1000).toFixed(0) + 's');
    }
    await b.close();
  }));
  console.log('rendered', total, 'frames in', ((Date.now() - start) / 1000).toFixed(0), 's');
})();
