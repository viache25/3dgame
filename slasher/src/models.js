// The figures: the wanderer, and the synths sent after him, each with a blade of light. Every part is a convex piece on a bone, so any of it can be cut.
// A figure faces +z; its right side is -x. Bones turn about their own origin (the joint).
const MODELS = (function () {
  const L = GEO.lathe, B = GEO.box, P = GEO.place;
  // a limb hanging from the joint: r0 thick at the joint, r1 at the far end
  const limb = (len, r0, r1, o) => P(L([[r1, 0], [r0, len]], o), 0, -len, 0);
  const glowing = (piece, heat, how) => { for (const f of piece.faces) { f.cap = how || GEO.PERM; f.heat = heat; } return piece; };
  const neon = (piece, heat) => glowing(piece, heat == null ? 0.9 : heat, GEO.NEON);       // a light of its own colour
  const trim = (piece, heat) => glowing(piece, heat == null ? 0.6 : heat, GEO.BLADE);      // glows in the colour of the wanderer's blade

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

  // A synth: armour over a frame, a visor that glows, a blade of light in the right hand. core pieces are the ones it cannot go on without.
  // kind: grunt (red, a katana), imp (small, yellow, a short blade in each hand), thrower (cyan, a gun), brute (orange, a long heavy blade),
  // colossus (magenta and brass; its legs are not vital, so it can be felled and finished on the ground)
  function synth(kind) {
    const brute = kind === 'brute', giant = kind === 'colossus', imp = kind === 'imp', gunner = kind === 'thrower';
    const armour = brute ? 17 : giant ? 22 : 0, plate = giant ? 18 : brute ? 1 : 1, inner = brute || giant ? 20 : 2, light = brute ? 25 : giant ? 24 : imp ? 21 : gunner ? 23 : 3;
    const o = (col, extra) => Object.assign({ col, inner, glow: 1 }, extra || {});
    const core = { core: true }, chest = { core: true, chest: true }, legs = giant ? null : core, held = { fist: true };
    // what is in the hand, hanging from the forearm and pointing forward: grip, guard, and the blade, which is the part that counts as the weapon
    const sword = (len, wide) => [
      P(B(0.036, 0.25, 0.042, o(16)), 0, -0.4, -0.07, Math.PI / 2, 0, 0),
      P(B(0.11, 0.022, 0.085, o(18)), 0, -0.4, 0.18, Math.PI / 2, 0, 0),
      neon(P(B(0.018, len, wide, o(light, { taper: 0.5, taperZ: 0.45, tag: held })), 0, -0.4, 0.2, Math.PI / 2, 0, 0), 0.85),
    ];
    const gun = () => [
      P(B(0.07, 0.36, 0.11, o(1, { tag: held })), 0, -0.36, -0.06, Math.PI / 2, 0, 0),
      P(B(0.05, 0.14, 0.06, o(16)), 0, -0.5, -0.02),
      neon(P(B(0.03, 0.2, 0.03, o(light)), 0, -0.325, 0.02, Math.PI / 2, 0, 0), 1.1),
    ];
    const arm = (s, hold) => {
      const hand = P(B(0.08, 0.09, 0.08, o(16, hold ? null : { tag: held })), 0, -0.38, 0);
      return [
        { name: 'arm' + s, parent: 'chest', at: [(s === 'L' ? 1 : -1) * 0.27, 0.43, 0], pieces: [
          P(B(0.16, 0.085, 0.18, o(plate, { taper: 0.72 })), 0, 0.0, 0),
          neon(P(B(0.165, 0.016, 0.185, o(light)), 0, -0.012, 0), 0.5),
          limb(0.3, 0.062, 0.052, o(armour, { sides: 6 })),
        ] },
        { name: 'fore' + s, parent: 'arm' + s, at: [0, -0.3, 0], pieces: [
          limb(0.29, 0.05, 0.046, o(armour, { sides: 6 })),
          P(L([[0.064, 0], [0.064, 0.11]], o(plate, { sides: 6 })), 0, -0.24, 0),
          hand,
        ].concat(hold || []) },
      ];
    };
    const leg = (s) => [
      { name: 'thigh' + s, parent: 'hips', at: [(s === 'L' ? 1 : -1) * 0.1, -0.08, 0], pieces: [
        limb(0.42, 0.088, 0.07, o(armour, { sides: 6, tag: legs })),
        P(B(0.11, 0.2, 0.05, o(plate, { taper: 0.8 })), 0, -0.3, 0.06),
      ] },
      { name: 'shin' + s, parent: 'thigh' + s, at: [0, -0.42, 0], pieces: [
        limb(0.34, 0.066, 0.05, o(armour, { sides: 6, tag: legs })),
        P(B(0.095, 0.24, 0.045, o(plate, { taper: 0.75 })), 0, -0.3, 0.045),
        P(B(0.11, 0.07, 0.26, o(16)), 0, -0.4, 0.05),
      ] },
    ];
    const head = [
      L([[0.06, -0.05], [0.06, 0.06]], o(16, { sides: 6 })),
      L([[0.1, 0.03], [0.138, 0.1], [0.138, 0.2], [0.09, 0.29]], o(armour, { sides: 7, sz: 1.05, tag: core })),
      neon(P(B(0.215, 0.036, 0.06, o(light)), 0, 0.15, 0.11), 1.4), // the visor: one slit of light across the face
      P(B(0.26, 0.05, 0.2, o(plate, { taper: 0.85 })), 0, 0.2, -0.01),
    ];
    if (brute || giant) head.push(P(L([[0.045, 0], [0, 0.3]], o(18, { sides: 5 })), 0.12, 0.24, 0.02, 0, 0, -0.55), P(L([[0.045, 0], [0, 0.3]], o(18, { sides: 5 })), -0.12, 0.24, 0.02, 0, 0, 0.55));
    else if (!imp) head.push(P(B(0.03, 0.13, 0.17, o(plate)), 0, 0.27, -0.04));
    if (imp) for (let i = 0; i < head.length; i++) head[i] = P(head[i], 0, 0, 0, 0, 0, 0, 1.35);
    const right = gunner ? gun() : sword(imp ? 0.5 : brute ? 1.4 : giant ? 1.5 : 0.98, brute || giant ? 0.075 : 0.045);
    return [
      { name: 'hips', parent: null, at: [0, 0.9, 0], pieces: [
        P(B(0.32, 0.2, 0.22, o(armour, { taper: 1.06, tag: legs })), 0, -0.1, 0),
        neon(P(L([[0.172, 0], [0.172, 0.022]], o(light, { sides: 6, sz: 0.74 })), 0, 0.085, 0), 0.5),
      ] },
      { name: 'chest', parent: 'hips', at: [0, 0.09, 0], pieces: [
        L([[0.14, 0], [0.17, 0.2]], o(armour, { sides: 6, sz: 0.74, tag: core })),
        P(L([[0.17, 0], [0.25, 0.2], [0.22, 0.34]], o(armour, { sides: 6, sz: 0.7, tag: chest })), 0, 0.18, 0),
        P(B(0.27, 0.17, 0.05, o(plate, { taper: 0.78 })), 0, 0.31, 0.125),
        neon(P(B(0.15, 0.02, 0.035, o(light)), 0, 0.275, 0.16), 0.9),
        P(B(0.19, 0.22, 0.07, o(plate)), 0, 0.25, -0.185),
      ] },
      { name: 'head', parent: 'chest', at: [0, 0.53, 0], pieces: head },
      ...arm('L', imp ? sword(0.5, 0.045) : null), ...arm('R', right), ...leg('L'), ...leg('R'),
    ];
  }

  // The wanderer. Not meant to be cut, but built the same way so that a lost fight leaves a heap. His trim glows in the colour of his blade.
  function hero() {
    const o = (col, extra) => Object.assign({ col, inner: 16, glow: 0.3 }, extra || {});
    const arm = (s) => [
      { name: 'arm' + s, parent: 'chest', at: [(s === 'L' ? 1 : -1) * 0.2, 0.33, 0], pieces: [limb(0.27, 0.06, 0.05, o(11, { sides: 6 })), P(B(0.13, 0.06, 0.15, o(13, { taper: 0.75 })), 0, 0.0, 0)] },
      { name: 'fore' + s, parent: 'arm' + s, at: [0, -0.27, 0], pieces: [limb(0.25, 0.048, 0.04, o(16, { sides: 6 })), trim(P(L([[0.052, 0], [0.052, 0.02]], o(15, { sides: 6 })), 0, -0.2, 0), 0.5), P(B(0.07, 0.08, 0.07, o(14)), 0, -0.32, 0)] },
    ];
    const leg = (s) => [
      { name: 'thigh' + s, parent: 'hips', at: [(s === 'L' ? 1 : -1) * 0.09, -0.06, 0], pieces: [limb(0.38, 0.1, 0.135, o(11, { sides: 6 }))] },
      { name: 'shin' + s, parent: 'thigh' + s, at: [0, -0.38, 0], pieces: [limb(0.3, 0.055, 0.045, o(16, { sides: 6 })), P(B(0.09, 0.06, 0.21, o(16)), 0, -0.36, 0.04)] },
    ];
    return [
      { name: 'hips', parent: null, at: [0, 0.8, 0], pieces: [P(B(0.29, 0.17, 0.2, o(11)), 0, -0.09, 0), trim(P(L([[0.165, 0], [0.165, 0.06]], o(15, { sides: 8, sz: 0.76 })), 0, 0.05, 0), 0.45)] },
      { name: 'chest', parent: 'hips', at: [0, 0.1, 0], pieces: [L([[0.13, 0], [0.195, 0.27], [0.165, 0.38]], o(11, { sides: 6, sz: 0.7 }))] },
      { name: 'head', parent: 'chest', at: [0, 0.39, 0], pieces: [
        L([[0.05, -0.03], [0.05, 0.05]], o(14, { sides: 6 })),
        L([[0.07, 0.02], [0.1, 0.08], [0.1, 0.17], [0.07, 0.23]], o(14, { sides: 6 })),
        trim(P(B(0.15, 0.022, 0.03, o(15)), 0, 0.125, 0.085), 0.9),
        P(L([[0.37, 0], [0.04, 0.17]], o(13, { sides: 11 })), 0, 0.165, 0),
        trim(P(L([[0.378, 0], [0.378, 0.012]], o(15, { sides: 11 })), 0, 0.158, 0), 0.38),
      ] },
      { name: 'scarf', parent: 'chest', at: [0, 0.35, -0.1], pieces: [trim(P(B(0.11, 0.5, 0.025, o(15, { taper: 0.7 })), 0, -0.5, 0), 0.5)] },
      ...arm('L'), ...arm('R'), ...leg('L'), ...leg('R'),
    ];
  }

  // The blade: grip at the origin, edge along +y. It glows for good, which is why whatever it opens glows too.
  function katana() {
    const g = new T.Group();
    g.add(partMesh([
      P(L([[0.019, -0.14], [0.019, 0.13]], { sides: 6, col: 16 }), 0, 0, 0),
      P(L([[0.055, 0], [0.055, 0.016]], { sides: 8, col: 18, sz: 0.8 }), 0, 0.13, 0),
      glowing(P(B(0.014, 1.02, 0.042, { col: 15, taper: 0.5, taperZ: 0.55 }), 0, 0.146, 0), 0.8, GEO.BLADE),
    ]));
    return g;
  }

  // Things standing on the plaza that exist to be cut. c: which light they carry (a colour of the palette).
  const props = {
    pillar(h, c) { // a concrete column with two bands of light
      const o = (col) => ({ col, inner: 5, glow: 0.75, sides: 6 }), out = [L([[0.5, 0], [0.5, 0.22]], o(4))];
      let y = 0.2;
      const drums = Math.max(2, Math.round(h / 0.9));
      for (let i = 0; i < drums; i++) { const dh = h / drums; out.push(P(L([[0.37, 0], [0.36, dh + 0.02]], o(4)), 0, y, 0, 0, i * 0.5, 0)); y += dh; }
      out.push(P(L([[0.36, 0], [0.5, 0.12], [0.5, 0.26]], o(4)), 0, y, 0));
      out.push(neon(P(L([[0.39, 0], [0.39, 0.07]], { col: c, inner: 5, glow: 0.75, sides: 6 }), 0, 0.5, 0), 1), neon(P(L([[0.385, 0], [0.385, 0.07]], { col: c, inner: 5, glow: 0.75, sides: 6 }), 0, y - 0.35, 0), 1));
      return out;
    },
    drum(s, c) { // a steel drum with a hazard band and a lit cap
      const o = (col) => ({ sides: 9, col, inner: 10, glow: 0.85 });
      return [
        P(L([[0.3, 0], [0.34, 0.08], [0.34, 0.76], [0.3, 0.84]], o(8)), 0, 0, 0, 0, 0, 0, s),
        P(L([[0.347, 0], [0.347, 0.12]], o(9)), 0, 0.36 * s, 0, 0, 0, 0, s),
        neon(P(L([[0.16, 0], [0.16, 0.03]], o(c)), 0, 0.835 * s, 0, 0, 0, 0, s), 0.9),
      ];
    },
    tube(h, lean, turn, c) { // a standing tube of light on a dark foot
      const out = [L([[0.09, 0], [0.07, 0.12]], { sides: 5, col: 16, inner: 7, glow: 0.6 })], n = Math.max(2, Math.round(h / 0.8));
      for (let i = 0; i < n; i++) out.push(neon(P(L([[0.045, 0], [0.045, h / n + 0.015]], { sides: 5, col: c, inner: 7, glow: 0.6 }), 0, 0.1 + (h / n) * i, 0), 0.75));
      return out.map((p) => P(p, 0, 0, 0, lean, turn, 0));
    },
    board(w, h, c, turn) { // a sign: a lit panel on a post
      const o = { col: 16, inner: 5, glow: 0.7, sides: 5 };
      return [
        L([[0.16, 0], [0.12, 0.14]], o), P(L([[0.07, 0], [0.065, 2.0]], o), 0, 0.1, 0),
        P(B(w + 0.14, h + 0.14, 0.09, { col: 16, inner: 5, glow: 0.7 }), 0, 2.0, 0),
        neon(P(B(w, h, 0.12, { col: c, inner: 5, glow: 0.7 }), 0, 2.07, 0), 0.8),
      ].map((p) => P(p, 0, 0, 0, 0, turn, 0));
    },
    crate(s) { // a cargo box with a lit corner
      return [
        B(s, s, s, { col: 8, inner: 10, glow: 0.8 }),
        P(B(s * 1.02, s * 0.14, s * 1.02, { col: 9, inner: 10, glow: 0.8 }), 0, s * 0.43, 0),
      ];
    },
  };

  return { makeRig, rebuild, dispose, synth, hero, katana, props };
})();
