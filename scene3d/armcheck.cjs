// Walk the whole film and report when an elbow or a hand sits inside its owner's torso, or an arm is folded almost shut.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const page0 = fs.readFileSync(path.join(__dirname, 'out/index.html'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 320, height: 180 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', (r) => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'node_modules/three', r.request().url().split('three@0.147.0/')[1])), contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
  await p.goto('http://local.test/#render'); await p.waitForFunction(() => window.__film);
  const rows = await p.evaluate(() => {
    const F = window.__film, out = [], V = THREE.Vector3;
    const who = [['Luna', F.luna, F.luna.parts.chest, [0.25, 0.0, 0.36, -0.17, 0.2], 0.78], ['Hoplite', F.hoplite, F.hoplite.parts.spine, [0.25, 0.0, 0.42, -0.15, 0.2], 0.63]];
    for (let i = 0; i <= 462; i++) {
      const t = i / 30; F.film.update(t);
      for (const [name, ch, torso, box, len] of who) for (const [side, A] of [['L', ch.parts.armL], ['R', ch.parts.armR]]) {
        const S = A.up.getWorldPosition(new V()), E = A.lo.getWorldPosition(new V()), H = A.hand.getWorldPosition(new V());
        const inside = (w) => { const q = torso.worldToLocal(w.clone()); return Math.abs(q.x) < box[0] - 0.04 && q.y > box[1] && q.y < box[2] && q.z > box[3] && q.z < box[4]; };
        const fold = S.distanceTo(H) / len, bad = [];
        if (inside(E)) bad.push('elbow in torso'); if (inside(H)) bad.push('hand in torso'); if (fold < 0.42) bad.push('folded ' + fold.toFixed(2));
        if (bad.length) out.push([t.toFixed(2), name + ' ' + side, bad.join(', ')]);
      }
    }
    return out;
  });
  // merge consecutive frames into ranges
  const groups = {}; for (const [t, who, what] of rows) { const k = who + ' | ' + what.replace(/ \d\.\d+/, ''); (groups[k] ||= []).push(Number(t)); }
  for (const [k, ts] of Object.entries(groups)) { const r = []; let a = ts[0], prev = ts[0]; for (const t of ts.slice(1).concat([1e9])) { if (t - prev > 0.05) { r.push(a === prev ? a.toFixed(2) : a.toFixed(2) + '–' + prev.toFixed(2)); a = t; } prev = t; } console.log(k.padEnd(40), r.join(', ')); }
  if (!rows.length) console.log('nothing flagged');
  await b.close();
})();
