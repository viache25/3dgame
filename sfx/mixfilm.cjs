'use strict';
// The film's soundtrack: every sound placed on the picture's own event times (scene3d/src/events.js).
const fs = require('fs'), path = require('path');
for (const d of ['out', 'wav', 'mp3']) fs.mkdirSync(path.join(__dirname, d), { recursive: true }); // a fresh clone has none of the output folders
const EV = require('../scene3d/src/events.js');
const { SR, N, st, putSt, finish, wav } = require('./dsp.cjs');
const { H, base } = require('./hard.cjs');
const DUR = EV.fadeEnd + 0.1, m = st(DUR), log = [];
const at = (name, s, t, g) => { putSt(m, s, t, g); log.push([t, name, g]); };
at('wind', base.wind(DUR), 0, 0.12);
at('head', H.head(), EV.headTurn - 0.03, 0.34);
at('eye', H.eye(1), EV.eye3 - 0.005, 0.62); at('eye', H.eye(0.9), EV.eye4 - 0.005, 0.7);
at('click', base.click(), EV.click - 0.005, 0.7);
at('draw', H.drawFast(EV.drawEnd - EV.draw), EV.draw, 0.72);
at('kamae', H.kamae(), EV.kamae - 0.2, 0.5);
at('visor', base.visor(), EV.visor, 0.5); at('servo', base.servoL(1, -0.5), 3.8, 0.26);
EV.steps.forEach((t, i) => at('step', H.step(1 + 0.04 * i, -0.55 + 0.13 * i), t - 0.004, 0.52 + 0.07 * i));
at('servo', base.servoL(1.3, 0.4), 4.55, 0.2);
// her first cut, caught on the shield
at('slash', H.slash(), EV.cut1 - 0.16, 0.85);
at('shield', H.shield(), EV.cut1 + 0.005, 0.95);
at('slowmo', base.slowmo(), EV.cut1 + 0.06, 0.26);
at('skid', H.skid(), EV.slowEnd - 0.04, 0.62);
at('kamae', H.kamae(), 6.3, 0.34);
// he goes for her; she knocks the spear off its line twice, steps in, and he answers with the rim of the shield
at('step', H.step(1.05, -0.4), 7.1, 0.4);
at('thrust', H.thrust(), EV.thrust1 - 0.17, 0.85); at('clang', H.clang(), EV.thrust1, 0.95);
at('thrust', H.thrust(1.1), EV.thrust2 - 0.17, 0.85); at('clang', H.clang(), EV.thrust2, 0.85); at('floor', H.floorHit(), EV.floor, 0.8);
at('step', H.step(1.2, 0.3, true), 8.08, 0.34); at('step', H.step(1.25, 0.2, true), 8.2, 0.34);
at('slash', H.slash(), EV.cut2 - 0.16, 0.7); at('shield', H.shield(), EV.cut2 + 0.005, 0.78);
at('bash', H.bash(), EV.bash, 0.95); at('skid', H.skid(), EV.bash + 0.06, 0.34);
at('servo', base.servoL(1.1, 0.4), 8.85, 0.18);
at('slash', H.slash(), EV.slash - 0.1, 0.85);
EV.crescents.forEach((t, i) => at('ignite', H.ignite(1 + 0.09 * i), t, 0.42));
at('hang', H.hang(11.5 - EV.crescents[0]), EV.crescents[0], 0.22);
at('step', H.step(1.2, 0.45, true), 9.5, 0.28); at('step', H.step(1.25, 0.6, true), 9.82, 0.26);
// the crescents come to kill: a block, a blow of the spear, a duck and the stone behind him
at('fall', H.fall(0), EV.falls[0] - 0.19, 0.88);
at('thrust', H.thrust(1.2), EV.falls[1] - 0.19, 0.6); at('fall', H.fall(2), EV.falls[1] - 0.19, 0.8); at('clang', H.clang(), EV.falls[1], 0.5);
at('fall', H.fall(2), EV.falls[2] - 0.19, 0.6); at('floor', H.floorHit(1.1), EV.floor3, 0.8);
at('ignite', H.ignite(0.8), 11.5, 0.3); at('ignite', H.ignite(0.75), 11.55, 0.3);
at('servo', base.servoL(0.9, -0.5), EV.release - 0.26, 0.24);
at('throwcut', H.throwcut(EV.cut - EV.release + 0.02, EV.clatter.map((t) => t - EV.release + 0.02)), EV.release - 0.02, 0.95);
at('holo', H.holo(EV.lock - EV.form), EV.form, 0.62);
at('dash', H.dash(), EV.dash, 0.6);
EV.dashSteps.forEach((t, i) => { at('step', H.step(1.05, -0.6 + 0.2 * i), t, 0.5); at('step', H.step(1.25, 0.7 - 0.2 * i, true), t + 0.03, 0.36); });
at('thrust', H.thrust(), EV.clash - 0.2, 0.6);
at('clash', H.clash(), EV.clash - 0.2, 1.45);
// the bus: a little glue, hard ceiling
for (const ch of [m.L, m.R]) for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * 1.5);
const out = finish(m, 0.9, 0.45);
let e = 0; for (const v of out.L) e += v * v;
fs.writeFileSync(path.join(__dirname, 'out', 'film.wav'), wav(out));
console.log('film.wav', (out.L.length / SR).toFixed(2), 's  rms', (10 * Math.log10(e / out.L.length)).toFixed(1), 'dB ', log.length, 'events');
