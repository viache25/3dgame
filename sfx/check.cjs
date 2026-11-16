const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const page0 = fs.readFileSync(path.join(__dirname, 'out/index.html'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page0}</body></html>`;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h, name] of [[1280, 900, 'desk'], [400, 800, 'phone']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
    await p.route('http://local.test/', (r) => r.fulfill({ body: html, contentType: 'text/html' }));
    await p.goto('http://local.test/');
    await p.waitForTimeout(700);
    if (name === 'desk') {
      const res = await p.evaluate(async () => {
        const ctx = new AudioContext(); const out = [];
        for (const s of [...DATA.sounds, { id: 'mix', b64: DATA.mix.b64, dur: DATA.mix.dur }]) {
          const bin = atob(s.b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          try { const buf = await ctx.decodeAudioData(u8.buffer); out.push(s.id + ' ' + buf.duration.toFixed(2) + '/' + s.dur.toFixed(2)); } catch (e) { out.push(s.id + ' FAIL'); }
        }
        return out.join(' | ');
      });
      console.log(res);
      await p.click('#pad-clang'); await p.waitForTimeout(300);
      console.log('pad pressed:', await p.getAttribute('#pad-clang', 'aria-pressed'));
      await p.click('#go'); await p.waitForTimeout(2600);
      console.log('now:', await p.textContent('#now'), '| button:', await p.textContent('#go'));
    }
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await p.screenshot({ path: path.join(__dirname, 'out', name + '.png'), fullPage: true });
    console.log(name, 'overflow', ov, errs.length ? errs.join(' ; ') : 'no errors');
    await p.close();
  }
  await b.close();
})();
