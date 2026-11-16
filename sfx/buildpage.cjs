const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
for (const d of ['out', 'wav', 'mp3']) fs.mkdirSync(path.join(__dirname, d), { recursive: true }); // a fresh clone has none of the output folders
const { SR } = require('./dsp.cjs');
const { S: S0 } = require('./sounds.cjs');
const { H } = require('./hard.cjs');
const { st, putSt, finish } = require('./dsp.cjs');
const EV = require('../scene3d/src/events.js');
// the weapons are the hard set now; machines, wind and the small clicks stay
const seq = (dur, items) => { const m = st(dur); for (const [s, t, g] of items) putSt(m, s, t, g); return finish(m, 0.92); };
const S = Object.assign({}, S0, {
  clang: H.clang, shield: H.shield, clash: H.clash, skid: H.skid, thrust: H.thrust, fall: H.fall, throwcut: H.throwcut, dash: H.dash,
  bash: H.bash, floor: H.floorHit, draw: () => H.drawFast(EV.drawEnd - EV.draw), kamae: H.kamae, head: H.head, eye: H.eye, slash: H.slash, holo: () => H.holo(EV.lock - EV.form),
  steps: () => seq(1.5, EV.steps.map((t, i) => [H.step(1 + 0.04 * i, -0.55 + 0.13 * i), t - EV.steps[0] + 0.04, 0.6 + 0.1 * i])),
  crescent: () => seq(2.6, [[H.slash(), 0, 0.9], ...EV.crescents.map((t, i) => [H.ignite(1 + 0.09 * i), t - EV.slash + 0.1, 0.45]), [H.hang(1.6), EV.crescents[0] - EV.slash + 0.1, 0.3]]),
});
const META = [
  ['shield', 'steel', 'Клинок в щит', 'кадры 4, 5', 'удар Луны, принятый на щит'],
  ['clang', 'steel', 'Сталь о сталь', 'кадр 5', 'клинок сбивает копьё с линии'],
  ['bash', 'steel', 'Удар щитом', 'кадр 5', 'гоплит бьёт кромкой и отбрасывает Луну'],
  ['floor', 'steel', 'Остриё в камень', 'кадры 5, 6', 'копьё прибито к полу; серп уходит в плиту'],
  ['clash', 'steel', 'Финальное столкновение', 'кадр 7', 'вдох, удар, ударное кольцо, стоп-кадр'],
  ['draw', 'steel', 'Клинок из ножен', 'кадр 2', 'быстрый выхват со звоном'],
  ['kamae', 'steel', 'Средняя стойка', 'кадр 2', 'вторая рука ложится на рукоять'],
  ['click', 'steel', 'Щелчок гарды', 'кадр 2', 'большой палец выдвигает гарду'],
  ['skid', 'steel', 'Скольжение по полу', 'кадры 4, 5', 'бойца отбрасывает назад'],
  ['steps', 'steel', 'Рывок в броне', 'кадр 3', 'четыре тяжёлых шага'],
  ['eye', 'machine', 'Глаз стража', 'кадр 2', 'шторки, свет запинается, низкий удар'],
  ['head', 'machine', 'Поворот головы', 'кадр 1', 'короткий привод и жёсткий упор'],
  ['servoL', 'machine', 'Большой сервопривод', 'кадры 3, 5', 'нога, плечо, корпус'],
  ['visor', 'machine', 'Визор загорается', 'кадр 3', 'Т-визор гоплита набирает ток'],
  ['thrust', 'energy', 'Выпад копьём', 'кадр 5', 'толчок воздуха и гул светового жала'],
  ['slash', 'energy', 'Взмах клинка', 'кадры 4, 5', 'разорванный воздух перед ударом'],
  ['crescent', 'energy', 'Серпы повисают', 'кадр 5', 'взмах, пять разрядов и гул тока'],
  ['fall', 'energy', 'Серп бьёт сверху', 'кадр 6', 'воздух рвётся, удар в щит'],
  ['throwcut', 'energy', 'Бросок и рассечённое копьё', 'кадр 6', 'свист, удар, обломки по камню'],
  ['holo', 'energy', 'Копьё из света', 'кадр 6', 'голограмма мерцает, скан, лязг'],
  ['dash', 'energy', 'Бросок навстречу', 'кадр 7', 'двое с разных сторон'],
  ['wind', 'air', 'Ветер на крыше', 'вся сцена', 'фон под всеми звуками'],
  ['slowmo', 'air', 'Замедление', 'кадр 4', 'время проседает на ударе'],
];
const peaksOf = (s, n) => { const o = [], L = s.L.length; let m = 1e-9; for (let b = 0; b < n; b++) { let p = 0; for (let i = Math.floor((b * L) / n); i < Math.floor(((b + 1) * L) / n); i++) p = Math.max(p, Math.abs(s.L[i]), Math.abs(s.R[i])); o.push(p); m = Math.max(m, p); } return o.map((v) => Math.round(Math.pow(v / m, 0.7) * 100)); };
const { wav } = require('./dsp.cjs');
const mp3 = (name, s) => { const src = path.join(__dirname, 'wav', 'p-' + name + '.wav'), out = path.join(__dirname, 'mp3', name + '.mp3'); if (s) fs.writeFileSync(src, wav(s)); execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', s ? src : path.join(__dirname, 'out/film.wav'), '-codec:a', 'libmp3lame', '-b:a', '160k', out]); return fs.readFileSync(out).toString('base64'); };
const durs = {};
const sounds = META.map(([id, group, title, shot, note]) => { const s = S[id](); durs[id] = s.L.length / SR; return { id, group, title, shot, note, dur: durs[id], peaks: peaksOf(s, 90), b64: mp3(id, s) }; });
const m = (() => { const b = fs.readFileSync(path.join(__dirname, 'out/film.wav')), n = (b.length - 44) / 4, L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = b.readInt16LE(44 + i * 4) / 32768; R[i] = b.readInt16LE(46 + i * 4) / 32768; } return { L, R }; })();
const DATA = {
  groups: [
    { id: 'steel', title: 'Сталь', note: 'удары, клинок, броня' },
    { id: 'machine', title: 'Машины', note: 'приводы, оптика, питание' },
    { id: 'energy', title: 'Энергия и воздух', note: 'копьё из света, серпы, взмахи' },
    { id: 'air', title: 'Среда и время', note: 'то, что звучит под остальным' },
  ],
  shots: ['Встреча', 'Глаза', 'Рывок', 'Иай', 'Размен', 'Серпы', 'Стоп-кадр'].map((name, i) => ({ t: EV.shots[i], name })),
  sounds,
  mix: { dur: m.L.length / SR, peaks: peaksOf(m, 520), b64: mp3('mix'), events: [
    ['head', EV.headTurn], ['eye', EV.eye3], ['eye', EV.eye4], ['click', EV.click], ['draw', EV.draw], ['kamae', EV.kamae - 0.2], ['visor', EV.visor], ['steps', EV.steps[0]],
    ['slash', EV.cut1 - 0.16], ['shield', EV.cut1], ['slowmo', EV.cut1 + 0.06], ['skid', EV.slowEnd],
    ['thrust', EV.thrust1 - 0.17], ['clang', EV.thrust1], ['thrust', EV.thrust2 - 0.17], ['clang', EV.thrust2], ['floor', EV.floor], ['shield', EV.cut2], ['bash', EV.bash], ['crescent', EV.slash - 0.1],
    ['fall', EV.falls[0] - 0.19], ['fall', EV.falls[1] - 0.19], ['fall', EV.falls[2] - 0.19], ['floor', EV.floor3], ['throwcut', EV.release], ['holo', EV.form], ['dash', EV.dash], ['clash', EV.clash - 0.2],
  ].map(([id, t]) => ({ id, t, dur: durs[id] })) },
};
const html = fs.readFileSync(path.join(__dirname, 'page.html'), 'utf8').replace('__DATA__', () => JSON.stringify(DATA));
fs.writeFileSync(path.join(__dirname, 'out/index.html'), html);
console.log('page', (html.length / 1024).toFixed(0), 'kB;', sounds.length, 'sounds');
