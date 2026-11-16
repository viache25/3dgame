// The seven frames of the board. Each returns one inline <svg>.
const L = require('./lib.cjs');
const { W, H, C, f, P, rad, ln, pl, pth, circ, ell, hoplite, luna, stars, moon, tower, floor, crescent, burst, sparks, speed, hatch, arrow, arrowPath, note, sfx, frame } = L;

function smooth(pts, closed = true) {
  const n = pts.length, at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${P([pts[0]])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += ` C${P([[p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2])}`;
  }
  return d + (closed ? ' Z' : '');
}
const glow = (n, s) => `<g filter="url(#g${n})">${s}</g>`;

// 1 — wide establishing shot, slow push-in
function p1() {
  const n = 1, hy = 372, gy = 446;
  let s = stars(11, hy - 24) + moon(478, 150, 116);
  s += tower(92, hy, 88, 252, 82, 1) + tower(318, hy, 46, 112, 46, 1) + tower(545, hy, 40, 104, 40, -1) + tower(858, hy, 80, 226, 78, -1);
  s += floor(hy, 480);
  for (const [x, y, l] of [[36, 300, 120], [388, 318, 150], [596, 262, 110], [770, 330, 140], [150, 214, 90]]) s += pth(`M${x} ${y} q${l * 0.5} -12 ${l} 0`, 'none', C.dim, 1.6, 'opacity=".55"');
  const h = hoplite({ x: 236, y: gy, s: 2.05, cape: 10, crest: 3 }, 'gs1');
  const l = luna({ x: 730, y: gy, s: 2.05, eyes: 2, blow: 6 }, 'gs1');
  s += hatch(164, 330, gy, 11) + hatch(690, 800, gy, 8) + h.svg + l.svg;
  let o = '';
  const dash = 'stroke-dasharray="16 12"';
  o += `<rect x="150" y="112" width="660" height="371" fill="none" stroke="#0B0D1A" stroke-width="7" ${dash}/><rect x="150" y="112" width="660" height="371" fill="none" stroke="${C.cam}" stroke-width="3" ${dash}/>`;
  o += arrow([30, 24], [124, 92]) + arrow([930, 24], [836, 92]) + arrow([30, 520], [124, 496]) + arrow([930, 520], [836, 496]);
  o += note(170, 142, 'наезд камеры');
  return frame(n, 'Кадр 1. Общий план крыши: гоплит слева, Луна справа, между ними луна', s, o);
}

// 2 — extreme close-up of the six-eyed mask, with an insert of the thumb pushing the guard
function p2() {
  const n = 2;
  let s = '';
  // cables behind
  const cable = (d, tipA, tipB) => pth(d, 'none', C.ink, 21) + pth(d, 'none', C.body, 16) + pth(d, 'none', C.dark, 16, 'stroke-dasharray="3 11" opacity=".7"') + glow(n, ln(tipA, tipB, C.crimson, 13));
  s += cable('M470 70 C500 -60 640 -50 664 70 S682 130 688 150', [688, 150], [694, 176]);
  s += cable('M452 60 C520 -90 760 -80 782 40 S796 100 800 116', [800, 116], [806, 142]);
  s += cable('M440 84 C470 -10 560 -10 584 90 S596 150 598 168', [598, 168], [602, 194]);
  s += cable('M430 40 C520 -110 880 -100 900 20 S905 70 906 84', [906, 84], [910, 112]);
  for (const [a, b, c] of [[[330, 40], [300, -30], [240, -6]], [[360, 36], [372, -40], [330, -10]], [[392, 40], [440, -30], [420, -8]]]) s += pth(`M${P([a])} Q${P([b])} ${P([c])}`, 'none', C.ink, 13) + pth(`M${P([a])} Q${P([b])} ${P([c])}`, 'none', C.body, 9);
  // skull, then the pale plate
  s += pth(smooth([[250, 40], [420, 6], [545, 80], [578, 280], [528, 446], [404, 552], [290, 552]]), C.body2, C.ink, 4);
  s += pl([[440, 22], [500, 22], [506, 70], [436, 70]], C.body, C.ink, 3);
  s += pth(smooth([[204, 92], [334, 48], [464, 92], [486, 290], [434, 434], [334, 520], [236, 434], [184, 290]]), C.moon, C.dark, 4);
  s += ln([334, 56], [334, 512], '#B9C2DD', 2.5);
  for (let i = 0; i < 9; i++) s += ln([452 - i * 3, 150 + i * 34], [478 - i * 2, 132 + i * 34], '#C2CAE3', 3);
  const eye = (cx, cy, r, state) => {
    let e = circ([cx, cy], r, '#151936', C.dark, 4) + circ([cx, cy], r * 0.82, 'none', '#3A4173', 2);
    if (state === 'shut') {
      for (let k = 0; k < 6; k++) { const a = rad(k * 60 + 15); e += ln([cx + r * 0.82 * Math.cos(a), cy + r * 0.82 * Math.sin(a)], [cx + r * 0.2 * Math.cos(a + 1.2), cy + r * 0.2 * Math.sin(a + 1.2)], '#3A4173', 2); }
      return e;
    }
    e += glow(n, circ([cx, cy], r * 0.58, C.crimson)) + circ([cx, cy], r * 0.22, '#2A0710') + pth(`M${f(cx - r * 0.36)} ${f(cy - r * 0.2)} q${f(r * 0.14)} ${f(-r * 0.2)} ${f(r * 0.34)} ${f(-r * 0.2)}`, 'none', '#FFD0D8', 3);
    if (state === 'opening') {
      const rr = r * 0.82;
      e += pth(`M${f(cx - rr)} ${f(cy)} A${f(rr)} ${f(rr)} 0 0 1 ${f(cx + rr)} ${f(cy)} Q${f(cx)} ${f(cy - rr * 0.62)} ${f(cx - rr)} ${f(cy)} Z`, '#151936', '#3A4173', 2);
      e += pth(`M${f(cx - rr)} ${f(cy)} A${f(rr)} ${f(rr)} 0 0 0 ${f(cx + rr)} ${f(cy)} Q${f(cx)} ${f(cy + rr * 0.62)} ${f(cx - rr)} ${f(cy)} Z`, '#151936', '#3A4173', 2);
      e += glow(n, circ([cx, cy], r * 1.08, 'none', C.crimson, 3));
      for (let k = 0; k < 12; k++) { const a = rad(k * 30 + 8); e += ln([cx + r * 1.28 * Math.cos(a), cy + r * 1.28 * Math.sin(a)], [cx + r * (k % 2 ? 1.62 : 1.95) * Math.cos(a), cy + r * (k % 2 ? 1.62 : 1.95) * Math.sin(a)], k % 2 ? C.crimson : C.dark, 3.5); }
    }
    return e;
  };
  s += eye(264, 268, 40, 'on') + eye(406, 268, 40, 'on') + eye(266, 150, 38, 'opening') + eye(402, 150, 38, 'opening') + eye(282, 388, 34, 'shut') + eye(386, 388, 34, 'shut');
  // the insert: the scabbard mouth, the thumb pushes the guard out a finger's width
  const u = [-0.913, -0.407], nn = [0.407, -0.913], m = [172, 136];
  const A = (d, k = 0) => [m[0] + u[0] * d + nn[0] * k, m[1] + u[1] * d + nn[1] * k];
  let i = `<clipPath id="ci2"><rect width="345" height="238"/></clipPath><rect width="345" height="238" fill="#0E1228"/><g clip-path="url(#ci2)">`;
  i += ln(A(-40, -32), A(-150, -40), C.ink, 60) + ln(A(-40, -32), A(-150, -40), C.body2, 54);
  i += ln(m, A(-230), C.ink, 46) + ln(m, A(-230), C.scab, 40);
  for (const d of [-60, -120, -180]) i += ln(A(d, -19), A(d, 19), '#5E0F1F', 4);
  i += ln(A(0, -24), A(0, 24), C.ink, 9);
  i += glow(n, ln(A(3), A(26), C.blade, 20));
  i += ell(A(33), 9, 42, 24, '#3A4173', C.ink, 3);
  i += ln(A(42), A(190), C.ink, 32) + ln(A(42), A(190), '#1A1F40', 26);
  for (const d of [62, 86, 110, 134]) i += ln(A(d, -12), A(d + 14, 12), C.dim, 2.5) + ln(A(d + 14, -12), A(d, 12), C.dim, 2.5);
  for (const d of [-52, -84, -116]) i += ln(A(d, 25), A(d + 4, -6), C.ink, 28) + ln(A(d, 25), A(d + 4, -6), C.body, 23);
  i += ln(A(-62, -44), A(24, -40), C.ink, 31) + ln(A(-62, -44), A(24, -40), C.body, 26) + ln(A(-14, -52), A(-12, -34), C.ink, 2.5);
  i += '</g>';
  i += glow(n, sparks(A(16, -6)[0], A(16, -6)[1], 9, 24, 52, 5, C.blade));
  i += arrow(A(-30, -78), A(30, -78), { col: C.ink, w: 3, head: 11 });
  i += `<rect width="345" height="238" fill="none" stroke="${C.ink}" stroke-width="5"/>`;
  s += `<g transform="translate(590,274) rotate(-3)">${i}</g>`;
  const o = `<g transform="translate(590,274) rotate(-3)">${sfx(250, 62, 'ЩЁЛК', { size: 46, rot: -7 })}</g>` + note(610, 248, 'вставка: палец выдвигает гарду', { size: 23 });
  return frame(n, 'Кадр 2. Маска Луны очень крупно: два глаза горят, два открываются; вставка — палец выдвигает гарду', s, o, { wobble: 6 });
}

// 3 — low tracking shot of the charge
function p3() {
  const n = 3, hy = 452, gy = 506;
  let s = stars(31, hy - 24) + moon(806, 112, 80);
  s += tower(96, hy, 150, 560, 120, 1) + tower(640, hy, 64, 250, 70, -1) + tower(930, hy, 70, 300, 70, -1);
  s += floor(hy, 900, { near: 34, spread: 300, n: 16 });
  s += speed(0, 400, 120, 470, 20, 5) + speed(380, 700, 380, 440, 6, 9, C.ink, 0.3);
  const l = luna({ x: 846, y: 474, s: 0.8, eyes: 4, blow: 2 }, 'gs3');
  const h = hoplite({ x: 372, y: gy, s: 3.3, hipH: 35, lean: 26, head: -20, footN: [26, 0], footF: [-36, -9], footFA: 38, hand: [-9, -3], spearA: 3, shield: [15, 5], shR: 17, cape: 17, crest: 5, visor: 2 }, 'gs3');
  s += hatch(820, 876, 474, 5, 8) + l.svg + hatch(330, 500, gy, 12, 18) + h.svg;
  for (const [x, y, k] of [[236, 498, 1], [198, 486, 0.8], [166, 500, 0.6]]) s += pth(`M${x} ${y} q${-16 * k} ${-24 * k} ${8 * k} ${-32 * k} q${12 * k} ${-22 * k} ${34 * k} ${-6 * k} q${20 * k} ${6 * k} ${10 * k} ${26 * k}`, 'none', C.ink, 2.4, 'opacity=".75"');
  const v = h.visor;
  s += glow(n, ln([v[0] - 70, v[1]], [v[0] + 110, v[1]], C.pink, 3) + ln([v[0], v[1] - 34], [v[0], v[1] + 34], C.pink, 2.5) + circ(v, 7, '#FFF'));
  const o = arrow([86, 524], [452, 524]) + note(474, 532, 'камера у самого пола, едет рядом');
  return frame(n, 'Кадр 3. Гоплит за щитом бросается вперёд, визор горит; Луна стоит вдалеке', s, o);
}

// 4 — the iai from the side, slowed down
function p4() {
  const n = 4, hy = 385, gy = 462;
  let s = stars(41, hy - 24) + moon(822, 100, 60);
  s += tower(58, hy, 72, 214, 70, 1) + tower(934, hy, 62, 150, 58, -1);
  s += floor(hy, 480);
  const h = hoplite({ x: 285, y: gy, s: 2.35, hipH: 35, lean: -7, head: 4, footN: [15, 0], footF: [-23, 0], shield: [16, 0], shR: 17, shT: 0.72, shA: -8, hand: [-9, 9], spearA: -28, cape: -2, crest: -3 }, 'gs4');
  const l = luna({ x: 668, y: gy, s: 2.35, hipH: 41, lean: 24, head: -24, footN: [31, 0], footF: [-33, 0], eyes: 4, blow: 13, scabA: 16 }, 'gs4');
  s += hatch(214, 356, gy, 11) + hatch(590, 760, gy, 11);
  s += glow(n, crescent(456, 292, 120, 172, { span: 62 }));
  s += h.svg + l.svg;
  const ix = h.shield[0] + 38, iy = h.shield[1] - 6;
  s += glow(n, ln([24, iy + 90], [612, iy - 84], C.blade, 2.4));
  s += burst(ix, iy, 18, 44, 9, 12) + glow(n, sparks(ix, iy, 14, 34, 92, 3, C.pink, 170, 330) + sparks(ix, iy, 10, 30, 80, 8, C.blade, -50, 110));
  for (const [a, b] of [[332, 438], [250, 318]]) s += ln([a, gy + 5], [b, gy + 5], C.ink, 2.4) + ln([a + 8, gy + 11], [b + 20, gy + 11], C.ink, 1.6, 'opacity=".7"');
  s += glow(n, sparks(330, gy + 2, 6, 6, 26, 12, C.pink, 280, 350));
  let o = sfx(332, 150, 'ДЗЫНЬ!', { size: 60, rot: -9, shadow: C.pink });
  o += arrow([262, 506], [150, 506], { col: C.ink, w: 3, head: 11 }) + note(274, 513, 'отбрасывает', { col: C.ink, size: 24 });
  o += pth(`M${f(l.mouth[0] + 86)} ${f(l.mouth[1] + 82)} Q${f(l.mouth[0] + 74)} ${f(l.mouth[1] + 52)} ${f(l.mouth[0] + 40)} ${f(l.mouth[1] + 20)}`, 'none', C.ink, 2) + note(l.mouth[0] + 30, l.mouth[1] + 108, 'клинок уже в ножнах', { col: C.ink, size: 24 });
  // slow-motion mark
  o += circ([52, 50], 20, '#0B0D1A', C.cam, 4) + ln([52, 50], [52, 37], C.cam, 3.5) + ln([52, 50], [61, 55], C.cam, 3.5) + ln([52, 26], [52, 20], C.cam, 5) + ln([45, 19], [59, 19], C.cam, 4) + note(84, 59, 'замедление', { size: 28 });
  return frame(n, 'Кадр 4. Иай сбоку: линия света и серп, гоплит принимает удар на щит и скользит назад', s, o);
}

// 5 — the exchange, the camera circles the pair
function p5() {
  const n = 5, hy = 296, gy = 444;
  let s = stars(51, hy - 24) + moon(132, 92, 56);
  s += tower(884, hy, 72, 196, 70, -1) + tower(770, hy, 44, 104, 44, 1) + tower(40, hy, 50, 120, 50, 1);
  s += floor(hy, 300, { spread: 200 });
  const h = hoplite({ x: 285, y: gy, s: 2.6, hipH: 33, lean: 22, head: -20, footN: [29, 0], footF: [-31, 0], hand: [27, 3], spearA: 1, shield: [6, 16], shA: -10, cape: 10, crest: 3 }, 'gs5');
  const l = luna({ x: 612, y: gy, s: 2.6, hipH: 54, lean: -15, head: 15, footN: [9, 0], footF: [-14, 0], eyes: 6, blow: -4, drawn: true, handF: [14, 8], swordA: 37.8, swordL: 68, bEyes: 5 }, 'gs5');
  s += hatch(200, 380, gy, 12) + hatch(570, 670, gy, 8);
  s += glow(n, crescent(338, 118, 50, -128) + crescent(430, 74, 64, -112) + crescent(516, 108, 44, -96) + crescent(404, 176, 32, -120, { w: 1.2 }));
  s += pth(`M${P([l.tip])} Q${f(l.tip[0] - 86)} ${f(l.tip[1] - 110)} 420 150`, 'none', C.blade, 2, 'stroke-dasharray="3 9" opacity=".8"');
  s += h.svg + l.svg;
  s += glow(n, sparks(h.tip[0] - 6, h.tip[1] + 2, 9, 10, 34, 4, C.blade));
  const hd = l.head;
  let o = ln([hd[0] - 52, hd[1] - 34], [hd[0] + 46, hd[1] - 34], C.ink, 2, 'stroke-dasharray="7 6"') + note(hd[0] + 56, hd[1] - 27, 'голова — ровно', { col: C.ink, size: 24 });
  o += note(474, 418, 'клинок отводит копьё', { col: C.ink, size: 24, anchor: 'middle' });
  const ex = 452, ey = 452, rx = 348, ry = 64, a0 = rad(200), a1 = rad(-20);
  o += arrowPath(`M${f(ex + rx * Math.cos(a0))} ${f(ey + ry * Math.sin(a0))} A${rx} ${ry} 0 1 0 ${f(ex + rx * Math.cos(a1))} ${f(ey + ry * Math.sin(a1))}`, [ex + rx * Math.cos(a1), ey + ry * Math.sin(a1)], -150, { dash: '18 12' });
  o += note(452, 500, 'облёт пары на пол-оборота', { anchor: 'middle' });
  return frame(n, 'Кадр 5. Размен: выпад копьём, Луна отводит его клинком, в воздухе висят серпы', s, o);
}

// 6 — three quick cuts in one frame
function p6() {
  const n = 6;
  const A = [[0, 0], [500, 0], [440, 540], [0, 540]], B = [[512, 0], [960, 0], [960, 262], [483, 262]], Cc = [[481, 276], [960, 276], [960, 540], [452, 540]];
  let s = `<clipPath id="c6a"><polygon points="${P(A)}"/></clipPath><clipPath id="c6b"><polygon points="${P(B)}"/></clipPath><clipPath id="c6c"><polygon points="${P(Cc)}"/></clipPath>`;
  // a: over the hoplite's shoulder, the crescents come down
  let a = stars(61, 310, 30) + moon(382, 66, 34) + tower(452, 330, 60, 170, 60, -1) + floor(330, 330, { spread: 150 });
  const l = luna({ x: 388, y: 392, s: 1.2, eyes: 6, blow: 4, drawn: true, handF: [5, -24], swordA: -104, swordL: 60, bEyes: 0 }, 'gs6');
  a += hatch(362, 414, 392, 5, 8) + l.svg;
  let cr = '';
  for (const [x, y, r, rot] of [[300, 78, 40, 118], [338, 208, 30, 100], [236, 150, 34, 124]]) {
    cr += crescent(x, y, r, rot);
    for (let k = -1; k <= 1; k++) a += ln([x + 26 + k * 12, y - 34 - Math.abs(k) * 4], [x + 52 + k * 14, y - 86 - Math.abs(k) * 6], C.blade, 2, 'opacity=".7"');
  }
  a += glow(n, cr);
  a += circ([58, 196], 168, '#262C5A', C.ink, 5) + circ([58, 196], 146, 'none', C.dim, 2.5) + circ([58, 196], 58, 'none', C.dim, 2);
  a += burst(190, 82, 16, 44, 8, 10) + glow(n, sparks(190, 82, 12, 30, 72, 2, C.blade, 200, 380));
  a += ln([100, 570], [138, 404], C.ink, 64) + ln([138, 404], [88, 238], C.ink, 54) + ln([100, 570], [138, 404], C.body2, 58) + ln([138, 404], [88, 238], C.body, 48);
  a += pth('M58 316 Q112 282 156 326', 'none', C.dim, 9) + circ([84, 226], 30, C.body, C.ink, 4) + ln([66, 212], [100, 206], C.ink, 2.5) + ln([66, 226], [102, 220], C.ink, 2.5);
  a += circ([372, 566], 96, C.body, C.ink, 4);
  a += pth('M118 540 Q100 392 214 372 Q332 380 320 540 Z', '#333B78', C.ink, 4) + pth('M132 524 Q152 500 124 468', 'none', C.dim, 2.5) + pth('M300 524 Q284 500 310 470', 'none', C.dim, 2.5);
  let cg = pth('M240 540 L236 398 Q240 364 262 346 L236 310 Q196 330 186 358 Q170 400 176 540 Z', C.violet, C.pink, 3);
  for (const [q, r] of [[[238, 520], [178, 520]], [[237, 462], [176, 456]], [[236, 402], [181, 388]], [[244, 368], [200, 334]], [[256, 350], [226, 316]]]) cg += ln(q, r, '#FFC6E4', 1.5);
  cg += pl([[262, 280], [300, 270], [290, 310]], C.violet, C.pink, 2.5) + sparks(252, 322, 8, 8, 32, 6, C.pink);
  a += glow(n, cg) + glow(n, crescent(226, 316, 28, 152, { w: 1.2 }));
  s += `<g clip-path="url(#c6a)">${a}</g>`;
  // b: the thrown spear, cut in two in the air
  let b = stars(62, 262, 20).replace(/cx="/g, 'cx="') + speed(500, 700, 40, 236, 11, 21, C.ink, 0.6);
  b += pth(smooth([[900, 58], [990, 40], [990, 262], [934, 246], [896, 168]]), C.moon, C.dark, 3);
  b += glow(n, circ([926, 104], 7, C.crimson) + circ([922, 150], 7, C.crimson) + circ([930, 196], 7, C.crimson));
  b += pth('M920 44 C930 -20 980 -10 990 30', 'none', C.dim, 6);
  b += glow(n, crescent(846, 134, 146, 180, { span: 52, fat: 1.16 }));
  b += ln([524, 172], [668, 142], C.ink, 5.5) + ln([524, 172], [544, 168], C.ink, 9);
  b += ln([722, 112], [806, 78], C.ink, 5.5);
  b += glow(n, pl([[800, 80], [820, 60], [862, 54], [826, 84]], C.pink, '#FFD9EC', 2) + sparks(694, 130, 12, 10, 44, 14, C.blade) + sparks(694, 130, 6, 10, 40, 15, C.pink));
  s += `<g clip-path="url(#c6b)">${b}</g>`;
  // c: a new spear of light gathers in the fist
  const u = [0.96, -0.28], nn = [0.28, 0.96], F = [676, 412];
  const Q = (d, k = 0) => [F[0] + u[0] * d + nn[0] * k, F[1] + u[1] * d + nn[1] * k];
  let c = `<rect x="440" y="270" width="520" height="270" fill="#10142C"/>`;
  for (let k = 0; k < 16; k++) { const d = -190 + k * 31, side = k % 2 ? 1 : -1; c += ln(Q(d, side * (70 + (k * 37) % 50)), Q(d + 8, side * 26), k % 3 ? C.violet : C.pink, 2.2, 'opacity=".8"'); }
  c += ln([528, 574], [640, 452], C.ink, 80) + ln([528, 574], [640, 452], C.body2, 74) + ln([560, 482], [612, 528], C.dim, 3) + ln([578, 462], [630, 508], C.dim, 3);
  c += circ(Q(-4, 14), 46, C.body2, C.ink, 4);
  c += glow(n, ln(Q(-110), Q(150), C.violet, 9) + ln(Q(-220), Q(-110), C.violet, 7, 'stroke-dasharray="16 12"') + ln(Q(150), Q(236), C.violet, 7, 'stroke-dasharray="16 12"') + ln(Q(-110), Q(150), '#FFF', 3) + pl([Q(236), Q(256, 17), Q(318), Q(256, -17)], 'none', C.pink, 3.5, 'stroke-dasharray="12 8"') + ln(Q(244), Q(300), '#FFE1F0', 2));
  for (let k = 0; k < 4; k++) { const d = -38 + k * 25; c += ln(Q(d, -27), Q(d, 22), C.ink, 26) + ln(Q(d, -27), Q(d, 22), C.body, 21); }
  c += ln(Q(-46, 34), Q(8, 40), C.ink, 25) + ln(Q(-46, 34), Q(8, 40), C.body, 20);
  c += glow(n, sparks(Q(60)[0], Q(60)[1], 8, 20, 48, 31, C.pink) + sparks(Q(-130)[0], Q(-130)[1], 6, 14, 40, 33, C.violet));
  s += `<g clip-path="url(#c6c)">${c}</g>`;
  let o = pl([[500, -4], [512, -4], [452, 544], [440, 544]], '#0B0D1A') + pl([[482.6, 262], [964, 262], [964, 276], [481, 276]], '#0B0D1A');
  o += pl(A, 'none', C.ink, 3) + pl(B, 'none', C.ink, 3) + pl(Cc, 'none', C.ink, 3);
  o += sfx(596, 64, 'ВЖИК!', { size: 40, rot: -8 });
  o += note(508, 318, 'новое копьё — из света', { col: C.ink, size: 24 });
  o += note(16, 34, '6а', { col: C.ink, size: 26 }) + note(526, 248, '6б', { col: C.ink, size: 26 }) + note(916, 528, '6в', { col: C.ink, size: 26 });
  o += note(20, 524, 'из-за плеча', { size: 23 });
  return frame(n, 'Кадр 6. Три быстрых кадра: серпы падают на щит и срезают гребень; копьё рассечено в воздухе; в кулаке собирается новое копьё из света', s, o);
}

// 7 — the clash, a pull-back and a freeze frame against the moon
function p7() {
  const n = 7, hy = 440, gy = 456;
  let s = stars(71, hy - 10, 64) + moon(480, 226, 236, '#CCD4EE');
  for (let i = 0; i < 12; i++) s += ln([596 + i * 9, 404 - i * 22], [640 + i * 5.5, 372 - i * 22], '#B4BEDD', 3, 'opacity=".45"');
  s += tower(70, hy, 92, 300, 90, 1, C.sil, C.sil) + tower(176, hy, 50, 140, 50, 1, C.sil, C.sil) + tower(890, hy, 86, 268, 84, -1, C.sil, C.sil) + tower(790, hy, 46, 124, 46, -1, C.sil, C.sil);
  s += floor(hy, 480, { fill: '#090B18', wall: C.sil, wallInk: C.sil, op: 0.32 });
  const h = hoplite({ x: 282, y: gy, s: 2.05, sil: true, hipH: 32, lean: 26, head: -22, footN: [30, 0], footF: [-34, 0], hand: [29, -1], spearA: -4, shield: [2, 17], shA: -12, cape: 14, crest: 6, visor: 2 }, 'gs7');
  const l = luna({ x: 688, y: gy, s: 2.05, sil: true, hipH: 40, lean: 24, head: -24, footN: [32, 0], footF: [-34, 0], eyes: 6, blow: 14, drawn: true, handF: [30, 0], swordA: 8, swordL: 66, scabA: 14 }, 'gs7');
  s += h.svg + l.svg;
  const cx = (h.tip[0] + l.tip[0]) / 2, cy = (h.tip[1] + l.tip[1]) / 2;
  s += ell([cx, cy], 172, 46, 0, 'none', C.sil, 7) + ell([cx, cy], 172, 46, 0, 'none', '#FFF', 3) + ell([cx, cy], 236, 64, 0, 'none', C.sil, 2.5, 'stroke-dasharray="6 14"');
  s += sparks(cx, cy, 22, 78, 150, 17, C.sil);
  s += glow(n, burst(cx, cy, 20, 66, 10, 6, '#FFF', C.sil, 2.5));
  s += glow(n, sparks(cx, cy, 8, 30, 70, 5, C.pink, 110, 250) + sparks(cx, cy, 8, 30, 70, 6, C.moonblue, -70, 70));
  let o = arrow([168, 100], [62, 40]) + arrow([792, 100], [898, 40]) + arrow([168, 494], [62, 524]) + arrow([792, 494], [898, 524]);
  o += note(178, 84, 'резкий отъезд');
  o += `<text x="480" y="520" text-anchor="middle" font-family="'Dela Gothic One', 'Rubik Mono One', Impact, 'Arial Black', sans-serif" font-size="26" letter-spacing="8" fill="${C.moon}" paint-order="stroke" stroke="#0B0D1A" stroke-width="6">СТОП-КАДР</text>`;
  return frame(n, 'Кадр 7. Два силуэта на фоне огромной луны: остриё копья встречает клинок, вспышка и ударное кольцо', s, o, { bg: '#10132A' });
}
module.exports = { panels: [p1, p2, p3, p4, p5, p6, p7] };
