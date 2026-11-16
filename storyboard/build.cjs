// node build.cjs — writes index.html (Artifact page contract: no doctype/html/head/body of its own).
const fs = require('fs');
const { panels } = require('./panels.cjs');
const SHOTS = [
  { t: [0, 2], tc: '0–2 с', name: 'Встреча', size: 'общий план', act: 'Крыша Воздушного замка, ночь. Гоплит в боевой стойке слева, Луна неподвижен справа, рука на рукояти. Ветер треплет плащ и кабели.', cam: 'Общий план, медленный наезд.' },
  { t: [2, 3.5], tc: '2–3,5 с', name: 'Глаза', size: 'очень крупно', act: 'Маска Луны: два глаза горят, ещё два открываются со вспышкой. Короткая вставка: большой палец выдвигает гарду — щелчок, искра.', cam: 'Очень крупный план лица, затем ножны.' },
  { t: [3.5, 5], tc: '3,5–5 с', name: 'Рывок', size: 'снизу', act: 'Т-визор гоплита вспыхивает. Он уходит за щит и бросается вперёд; Луна ждёт.', cam: 'У самого пола, едет рядом с гоплитом.' },
  { t: [5, 7], tc: '5–7 с', name: 'Иай', size: 'сбоку', act: 'Самого удара не видно — только линия света и повисший серп. Гоплит принимает на щит, искры, его отбрасывает назад. Клинок уже в ножнах.', cam: 'Сбоку, замедление в момент удара.' },
  { t: [7, 10], tc: '7–10 с', name: 'Размен', size: 'двое в кадре', act: 'Выпад копьём — Луна отклоняется корпусом, голова остаётся ровной, клинок отводит древко. Взмах вверх оставляет в воздухе серпы.', cam: 'Облёт пары на пол-оборота.' },
  { t: [10, 12.5], tc: '10–12,5 с', name: 'Серпы', size: 'три быстрых кадра', act: 'Серпы падают по одному: в щит и по гребню шлема. Гоплит бросает копьё — Луна рассекает его в воздухе. В кулаке собирается новое копьё из света.', cam: 'Быстрые склейки: из-за плеча гоплита, копьё крупно, кулак крупно.' },
  { t: [12.5, 15], tc: '12,5–15 с', name: 'Стоп-кадр', size: 'общий план', act: 'Оба бросаются навстречу. Остриё встречает клинок: вспышка, ударное кольцо — и стоп-кадр: два силуэта на фоне луны. Победителя нет.', cam: 'Резкий отъезд на общий план, стоп-кадр.' },
];
const num = (n) => String(n).replace('.', ',');
const ticks = [0, 2, 3.5, 5, 7, 10, 12.5, 15];
const css = `
/* Layout: a pinboard. A to-scale 15 s strip on top, the frames in two columns below it, the last frame full width as the splash. */
:root {
  color-scheme: dark;
  --bg: #0B0D1A; --board: #141833; --strip: #1B2146; --strip2: #232A58; --ink: #E4E8F6; --muted: #98A1C8; --rule: #2A3058;
  --cam: #FFC44D; --violet: #9B5CFF; --pink: #FF4FA8; --crimson: #FF3350; --moon: #EEF1FA;
  --display: 'Dela Gothic One', 'Rubik Mono One', Impact, 'Arial Black', sans-serif;
  --text: 'Golos Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --hand: Neucha, 'Comic Sans MS', 'Segoe Print', cursive;
}
body { background: var(--bg); color: var(--ink); font-family: var(--text); font-size: 15px; line-height: 1.5; }
.page { max-width: 1180px; margin: 0 auto; padding-block: 28px 44px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 28px; }
.top { display: flex; flex-direction: column; gap: 10px; }
.eyebrow { margin: 0; font-family: var(--hand); font-size: 20px; color: var(--cam); }
h1 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(30px, 6vw, 56px); line-height: 1.05; letter-spacing: 0.01em; text-wrap: balance; color: var(--moon); }
.lede { margin: 0; max-width: 62ch; color: var(--muted); font-size: 16px; }
.legend { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 22px; color: var(--muted); font-size: 13px; }
.legend li { display: flex; align-items: center; gap: 8px; }
.sw { display: inline-flex; gap: 3px; }
.sw i { width: 14px; height: 6px; border-radius: 3px; }
.timeline { display: flex; flex-direction: column; gap: 6px; }
.tl-bar { display: flex; gap: 3px; height: 46px; }
.seg { min-width: 0; display: flex; align-items: center; gap: 8px; padding: 0 10px; background: var(--strip); border-top: 2px solid var(--ink); overflow: hidden; white-space: nowrap; }
.seg:nth-child(even) { background: var(--strip2); }
.seg b { font-family: var(--display); font-weight: 400; font-size: 17px; color: var(--moon); }
.seg span { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.tl-ticks { position: relative; height: 18px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.tl-ticks span { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }
.tl-ticks span:first-child { transform: none; }
.tl-ticks span:last-child { transform: translateX(-100%); }
.board { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 34px 26px; }
.shot { min-width: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.shot.wide { grid-column: 1 / -1; }
.shot-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; }
.num { font-family: var(--display); font-size: 30px; line-height: 1; color: var(--moon); }
.name { font-family: var(--display); font-size: 17px; color: var(--ink); }
.tc { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--cam); }
.size { font-size: 12px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); }
.frame { display: block; width: 100%; height: auto; max-width: 100%; background: var(--board); border: 2px solid var(--ink); border-radius: 3px; }
.cap { margin: 0; display: grid; grid-template-columns: 5.4rem minmax(0, 1fr); gap: 6px 12px; }
.cap dt { font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--muted); padding-top: 3px; }
.cap dt.cam { color: var(--cam); }
.cap dd { margin: 0; min-width: 0; max-width: 68ch; }
.foot { margin: 0; color: var(--muted); font-size: 13px; max-width: 70ch; border-top: 1px solid var(--rule); padding-top: 14px; }
@media (max-width: 760px) {
  .board { grid-template-columns: minmax(0, 1fr); gap: 30px; }
  .page { gap: 22px; padding-block: 20px 36px; }
}
@media (max-width: 600px) {
  .seg { padding: 0; justify-content: center; }
  .seg span { display: none; }
  .tl-bar { height: 38px; }
}
`;
const seg = SHOTS.map((s, i) => `<div class="seg" style="flex:${s.t[1] - s.t[0]} 1 0" title="Кадр ${i + 1}: ${s.tc}"><b>${i + 1}</b><span>${s.name}</span></div>`).join('');
const tk = ticks.map((t, i) => `<span style="left:${((t / 15) * 100).toFixed(3)}%">${num(t)}${i === ticks.length - 1 ? ' с' : ''}</span>`).join('');
const shots = SHOTS.map((s, i) => `<figure class="shot${i === 6 ? ' wide' : ''}" id="k${i + 1}">
<div class="shot-head"><span class="num">${i + 1}</span><span class="name">${s.name}</span><span class="tc">${s.tc}</span><span class="size">${s.size}</span></div>
${panels[i]()}
<figcaption><dl class="cap"><dt>Действие</dt><dd>${s.act}</dd><dt class="cam">Камера</dt><dd>${s.cam}</dd></dl></figcaption>
</figure>`).join('\n');
const html = `<title>Гоплит против Луны</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Golos+Text:wght@400;600&family=Neucha&display=swap">
<style>${css}</style>
<div class="page">
<header class="top">
<p class="eyebrow">раскадровка · 15 секунд · 7 кадров</p>
<h1>Гоплит против Луны</h1>
<p class="lede">Черновые эскизы сцены боя на крыше Воздушного замка: что происходит в каждом кадре и как движется камера.</p>
<ul class="legend">
<li><span class="sw"><i style="background:var(--cam)"></i></span>жёлтым — движение камеры</li>
<li><span class="sw"><i style="background:var(--violet)"></i><i style="background:var(--pink)"></i></span>энергия гоплита</li>
<li><span class="sw"><i style="background:var(--crimson)"></i><i style="background:var(--moon)"></i></span>Луна: глаза, кабели, серпы</li>
</ul>
</header>
<section class="timeline" aria-label="Шкала сцены: семь кадров на 15 секунд">
<div class="tl-bar">${seg}</div>
<div class="tl-ticks">${tk}</div>
</section>
<main class="board">
${shots}
</main>
<p class="foot">Фигуры и фон условные: раскадровка показывает позы, ракурсы и порядок событий, а не финальный вид персонажей и сцены.</p>
</div>
`;
fs.writeFileSync(__dirname + '/index.html', html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' kB');
