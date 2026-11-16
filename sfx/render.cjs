const fs = require('fs'), path = require('path');
for (const d of ['out', 'wav', 'mp3']) fs.mkdirSync(path.join(__dirname, d), { recursive: true }); // a fresh clone has none of the output folders
const { wav, SR } = require('./dsp.cjs');
const { S, mix } = require('./sounds.cjs');
const stats = (s) => { let p = 0, e = 0, bad = 0; for (const ch of [s.L, s.R]) for (const v of ch) { if (!isFinite(v)) bad++; p = Math.max(p, Math.abs(v)); e += v * v; } return `${(s.L.length / SR).toFixed(2)} s  peak ${p.toFixed(2)}  rms ${(10 * Math.log10(e / (2 * s.L.length) + 1e-12)).toFixed(1)} dB${bad ? '  NaN:' + bad : ''}`; };
const t0 = Date.now();
for (const name of Object.keys(S)) { const s = S[name](); fs.writeFileSync(path.join(__dirname, 'wav', name + '.wav'), wav(s)); console.log(name.padEnd(9), stats(s)); }
const m = mix(); fs.writeFileSync(path.join(__dirname, 'wav', 'mix.wav'), wav(m)); console.log('mix'.padEnd(9), stats(m), ' render', Date.now() - t0, 'ms');
