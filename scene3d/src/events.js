// When things happen, in seconds. Shared by the picture (film.js) and the sound (sfx/mixfilm.cjs).
var EV = {
  headTurn: 1.25, eye3: 2.2, eye4: 2.5, click: 2.95, draw: 3.0, drawEnd: 3.3, kamae: 3.56, visor: 3.66, steps: [4.12, 4.42, 4.68, 4.92],
  cut1: 5.07, slowEnd: 5.9, skidEnd: 6.5,
  thrust1: 7.34, thrust2: 7.91, floor: 7.96, cut2: 8.3, bash: 8.52, slash: 9.14, crescents: [9.3, 9.38, 9.46, 9.54, 9.62],
  falls: [10.3, 10.62, 10.94], floor3: 11.03, release: 11.38, cut: 11.64, clatter: [11.97, 12.13], form: 11.85, lock: 12.47,
  dash: 12.5, dashSteps: [12.72, 12.95], clash: 13.12, freeze: 13.2, pullEnd: 13.8, end: 15.0, fadeEnd: 15.4,
  shots: [0, 2.0, 3.6, 5.0, 7.0, 10.0, 12.5], hitStop: 0.07,
};
if (typeof module !== 'undefined') module.exports = EV;
