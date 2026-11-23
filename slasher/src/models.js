// The figures: the wanderer with the hot blade and the clay idols. Every part is a convex piece on a bone, so any of it can be cut.
// A figure faces +z; its right side is -x. Bones turn about their own origin (the joint).
const MODELS = (function () {
  const L = GEO.lathe, B = GEO.box, P = GEO.place;
  // a limb hanging from the joint: r0 thick at the joint, r1 at the far end
  const limb = (len, r0, r1, o) => P(L([[r1, 0], [r0, len]], o), 0, -len, 0);
  const glowing = (piece, heat, how) => { for (const f of piece.faces) { f.cap = how || GEO.PERM; f.heat = heat; } return piece; };

  function makeRig(def) {
    const root = new T.Group(), bones = {}, list = [];
    for (const d of def) {
      const b = new T.Object3D();
      b.name = d.name; b.position.set(d.at[0], d.at[1], d.at[2]); b.rest = d.at.slice();
      b.pieces = d.pieces; b.mesh = null;
      (d.parent ? bones[d.parent] : root).add(b);
      bones[d.name] = b; list.push(b);
      rebuild(b);
    }
    return { root, bones, list };
  }
  function rebuild(b) {
    if (b.mesh) { b.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh = null; }
    if (!b.pieces.length) return;
    b.mesh = partMesh(b.pieces);
    b.add(b.mesh);
  }
  function dispose(rig) { for (const b of rig.list) if (b.mesh) { b.mesh.geometry.dispose(); b.mesh = null; } }

  // A clay idol woken by the fire inside it. core pieces are the ones it cannot live without.
  // kind: grunt, imp (small, big-headed), thrower (blue bands, no maul), brute (basalt, two mauls), colossus (its legs are not vital: it can be felled)
  function idol(kind) {
    const brute = kind === 'brute', giant = kind === 'colossus', imp = kind === 'imp', thrower = kind === 'thrower';
    const skin = brute ? 17 : giant ? 22 : imp ? 21 : 0, band = brute || giant ? 18 : thrower ? 9 : 1, inner = brute || giant ? 20 : 2;
    const o = (col, extra) => Object.assign({ col, inner, glow: 1 }, extra || {});
    const core = { core: true }, chest = { core: true, chest: true }, legs = giant ? null : core;
    const arm = (s, heavy) => [
      { name: 'arm' + s, parent: 'chest', at: [(s === 'L' ? 1 : -1) * 0.31, 0.44, 0], pieces: [
        L([[0.07, -0.09], [0.12, -0.03], [0.12, 0.04], [0.075, 0.1]], o(band, { sides: 6 })),
        limb(0.32, 0.08, 0.07, o(skin, { sides: 6 })),
      ] },
      { name: 'fore' + s, parent: 'arm' + s, at: [0, -0.32, 0], pieces: [
        limb(0.3, 0.065, 0.085, o(skin, { sides: 6 })),
        P(L([[0.098, 0], [0.098, 0.05]], o(band, { sides: 6 })), 0, -0.275, 0),
        heavy ? P(B(0.25, 0.24, 0.25, o(band, { taper: 0.82, tag: { fist: true } })), 0, -0.52, 0) : P(B(0.15, 0.15, 0.15, o(skin, { tag: { fist: true } })), 0, -0.43, 0),
      ] },
    ];
    const leg = (s) => [
      { name: 'thigh' + s, parent: 'hips', at: [(s === 'L' ? 1 : -1) * 0.11, -0.08, 0], pieces: [limb(0.4, 0.105, 0.085, o(skin, { sides: 6, tag: legs }))] },
      { name: 'shin' + s, parent: 'thigh' + s, at: [0, -0.4, 0], pieces: [
        limb(0.31, 0.078, 0.092, o(skin, { sides: 6, tag: legs })),
        P(B(0.16, 0.08, 0.28, o(band)), 0, -0.38, 0.05),
      ] },
    ];
    const head = [
      L([[0.085, -0.04], [0.085, 0.07]], o(band, { sides: 6 })),
      L([[0.12, 0.04], [0.19, 0.12], [0.2, 0.32], [0.15, 0.42]], o(skin, { sides: 6, sz: 0.92, tag: core })),
      P(L([[0.2, 0], [0.275, 0.075]], o(band, { sides: 4, off: Math.PI / 4, sz: 0.8 })), 0, 0.41, 0),
      glowing(P(B(0.07, 0.036, 0.05, o(3)), 0.078, 0.225, 0.146), 1.5),
      glowing(P(B(0.07, 0.036, 0.05, o(3)), -0.078, 0.225, 0.146), 1.5),
      P(B(0.1, 0.022, 0.04, o(band)), 0, 0.12, 0.135),
    ];
    if (brute || giant) head.push(P(L([[0.05, 0], [0, 0.26]], o(19, { sides: 5 })), 0.17, 0.44, 0, 0, 0, -0.5), P(L([[0.05, 0], [0, 0.26]], o(19, { sides: 5 })), -0.17, 0.44, 0, 0, 0, 0.5));
    if (imp) for (let i = 0; i < head.length; i++) head[i] = P(head[i], 0, 0, 0, 0, 0, 0, 1.4);
    return [
      { name: 'hips', parent: null, at: [0, 0.86, 0], pieces: [P(B(0.37, 0.21, 0.25, o(band, { taper: 1.08, tag: legs })), 0, -0.11, 0)] },
      { name: 'chest', parent: 'hips', at: [0, 0.09, 0], pieces: [
        L([[0.17, 0], [0.195, 0.19]], o(skin, { sides: 6, sz: 0.76, tag: core })),
        P(L([[0.19, 0], [0.275, 0.2], [0.25, 0.35]], o(skin, { sides: 6, sz: 0.72, tag: chest })), 0, 0.17, 0),
        P(B(0.2, 0.2, 0.05, o(19, { taper: 0.6 })), 0, 0.23, 0.145),
      ] },
      { name: 'head', parent: 'chest', at: [0, 0.52, 0], pieces: head },
      ...arm('L', brute || giant), ...arm('R', !(imp || thrower)), ...leg('L'), ...leg('R'),
    ];
  }
  // What a thrower lobs: a lump of clay with the fire still in it.
  function shot() { return glowing(L([[0.09, -0.16], [0.17, -0.07], [0.17, 0.07], [0.09, 0.16]], { sides: 7, col: 3, inner: 2, glow: 1 }), 0.75); }

  // The wanderer. Not meant to be cut, but built the same way so that a lost fight leaves a heap.
  function hero() {
    const o = (col, extra) => Object.assign({ col, inner: 16, glow: 0.3 }, extra || {});
    const arm = (s) => [
      { name: 'arm' + s, parent: 'chest', at: [(s === 'L' ? 1 : -1) * 0.2, 0.33, 0], pieces: [limb(0.27, 0.06, 0.05, o(11, { sides: 6 }))] },
      { name: 'fore' + s, parent: 'arm' + s, at: [0, -0.27, 0], pieces: [limb(0.25, 0.048, 0.04, o(16, { sides: 6 })), P(B(0.07, 0.08, 0.07, o(14)), 0, -0.32, 0)] },
    ];
    const leg = (s) => [
      { name: 'thigh' + s, parent: 'hips', at: [(s === 'L' ? 1 : -1) * 0.09, -0.06, 0], pieces: [limb(0.38, 0.1, 0.135, o(11, { sides: 6 }))] },
      { name: 'shin' + s, parent: 'thigh' + s, at: [0, -0.38, 0], pieces: [limb(0.3, 0.055, 0.045, o(16, { sides: 6 })), P(B(0.09, 0.06, 0.21, o(16)), 0, -0.36, 0.04)] },
    ];
    return [
      { name: 'hips', parent: null, at: [0, 0.8, 0], pieces: [P(B(0.29, 0.17, 0.2, o(11)), 0, -0.09, 0), P(L([[0.165, 0], [0.165, 0.07]], o(12, { sides: 8, sz: 0.76 })), 0, 0.05, 0)] },
      { name: 'chest', parent: 'hips', at: [0, 0.1, 0], pieces: [L([[0.13, 0], [0.195, 0.27], [0.165, 0.38]], o(11, { sides: 6, sz: 0.7 }))] },
      { name: 'head', parent: 'chest', at: [0, 0.39, 0], pieces: [
        L([[0.05, -0.03], [0.05, 0.05]], o(14, { sides: 6 })),
        L([[0.07, 0.02], [0.1, 0.08], [0.1, 0.17], [0.07, 0.23]], o(14, { sides: 6 })),
        P(L([[0.37, 0], [0.04, 0.17]], o(13, { sides: 11 })), 0, 0.165, 0),
      ] },
      { name: 'scarf', parent: 'chest', at: [0, 0.35, -0.1], pieces: [P(B(0.11, 0.5, 0.025, o(12, { taper: 0.7 })), 0, -0.5, 0)] },
      ...arm('L'), ...arm('R'), ...leg('L'), ...leg('R'),
    ];
  }

  // The blade: grip at the origin, edge along +y. It glows for good, which is why whatever it opens glows too.
  function katana() {
    const g = new T.Group();
    g.add(partMesh([
      P(L([[0.019, -0.14], [0.019, 0.13]], { sides: 6, col: 16 }), 0, 0, 0),
      P(L([[0.055, 0], [0.055, 0.016]], { sides: 8, col: 18, sz: 0.8 }), 0, 0.13, 0),
      glowing(P(B(0.014, 1.02, 0.042, { col: 15, taper: 0.5, taperZ: 0.55 }), 0, 0.146, 0), 0.7, GEO.BLADE),
    ]));
    return g;
  }

  // Things standing in the sand that exist to be cut.
  const props = {
    pillar(h) {
      const o = (col) => ({ col, inner: 5, glow: 0.75, sides: 6 }), out = [L([[0.5, 0], [0.5, 0.22]], o(4))];
      let y = 0.2;
      const drums = Math.max(2, Math.round(h / 0.9));
      for (let i = 0; i < drums; i++) { const dh = h / drums; out.push(P(L([[0.37, 0], [0.36, dh + 0.02]], o(4)), 0, y, 0, 0, i * 0.5, 0)); y += dh; }
      out.push(P(L([[0.36, 0], [0.5, 0.12], [0.5, 0.26]], o(4)), 0, y, 0));
      return out;
    },
    jar(s) {
      return [
        P(L([[0.17, 0], [0.33, 0.24], [0.36, 0.46], [0.27, 0.68], [0.16, 0.78]], { sides: 8, col: 8, inner: 10, glow: 0.85 }), 0, 0, 0, 0, 0, 0, s),
        P(L([[0.365, 0], [0.365, 0.07]], { sides: 8, col: 9, inner: 10, glow: 0.85 }), 0, 0.4 * s, 0, 0, 0, 0, s),
        P(L([[0.15, 0], [0.2, 0.06]], { sides: 8, col: 9, inner: 10, glow: 0.85 }), 0, 0.76 * s, 0, 0, 0, 0, s),
      ];
    },
    reed(h, lean, turn) {
      const out = [], o = { sides: 5, col: 6, inner: 7, glow: 0.6 }, n = Math.max(2, Math.round(h / 0.8));
      for (let i = 0; i < n; i++) out.push(P(L([[0.055, 0], [0.05, h / n + 0.015]], o), 0, (h / n) * i, 0));
      return out.map((p) => P(p, 0, 0, 0, lean, turn, 0));
    },
  };

  return { makeRig, rebuild, dispose, idol, shot, hero, katana, props };
})();
