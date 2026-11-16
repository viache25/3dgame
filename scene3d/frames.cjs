// node frames.cjs <name> <t1,t2,…|a:b:n> [WxH] [cols] — a contact sheet of film frames at the given times.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [name, spec, size = '640x360', cols = '4'] = process.argv.slice(2);
  const [w, h] = size.split('x').map(Number);
  let times = spec.includes(':') ? (() => { const [a, b, n] = spec.split(':').map(Number); return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)); })() : spec.split(';').join(',').split(/,(?![^@]*(?:;|$))/).length ? spec.split(';').map((s) => s.includes('@') ? { t: Number(s.split('@')[0]), cam: s.split('@')[1].split(',').map(Number) } : Number(s)) : [];
  const page0 = fs.readFileSync(path.join(__dirname, 'out/index.html'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 700)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'node_modules/three', r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  await p.goto('http://local.test/#render');
  await p.waitForFunction(() => window.__film, null, { timeout: 60000 }).catch(() => errs.push('no film'));
  const shots = [];
  for (const t of times) {
    await p.evaluate((t) => window.__film && (typeof t === 'number' ? window.__film.setTime(t) : window.__film.setTime(t.t, t.cam)), t);
    shots.push([typeof t === 'number' ? t : t.t, (await p.screenshot({ type: 'jpeg', quality: 88 })).toString('base64')]);
  }
  if (errs.length) console.log([...new Set(errs)].slice(0, 8).join('\n'));
  const c = Number(cols), cw = Math.round(w), ch = Math.round(h);
  await p.setViewportSize({ width: c * (cw + 6) + 6, height: Math.ceil(shots.length / c) * (ch + 26) + 6 });
  await p.setContent(`<body style="margin:0;background:#111;font:14px monospace;color:#fff"><div style="display:flex;flex-wrap:wrap;gap:6px;padding:6px">${shots.map(([t, d]) => `<div><div style="height:18px">t = ${t.toFixed(3)}</div><img width="${cw}" height="${ch}" src="data:image/jpeg;base64,${d}"></div>`).join('')}</div></body>`);
  await p.screenshot({ path: path.join(__dirname, 'out', `sheet-${name}.png`), fullPage: true });
  await b.close();
  console.log('sheet', name, shots.length, 'frames');
})();
