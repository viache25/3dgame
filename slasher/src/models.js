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
    const brute = kind === 'brute', giant = kind === 'colossus', imp = kind === 'imp', gunner = kind === 'thrower', shield = kind === 'shield', ninja = kind === 'ninja', bomber = kind === 'bomber';
    const armour = brute ? 17 : giant ? 22 : ninja ? 16 : bomber ? 9 : 0, plate = giant ? 18 : shield ? 19 : ninja ? 0 : 1, inner = brute || giant ? 20 : 2, light = brute ? 25 : giant ? 24 : imp ? 21 : gunner ? 23 : shield ? 28 : ninja ? 24 : 3;
    const shed = brute ? { plate: true } : null; // the plates a heavy synth wears over its frame come off before it can be cut down
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
          P(B(brute ? 0.2 : 0.16, brute ? 0.11 : 0.085, brute ? 0.22 : 0.18, o(plate, { taper: 0.72, tag: shed })), 0, 0.0, 0),
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
    const right = gunner ? gun() : sword(imp ? 0.5 : ninja ? 0.8 : bomber ? 0.4 : brute ? 1.4 : giant ? 1.5 : 0.98, brute || giant ? 0.075 : 0.045);
    // a wall of light carried on the left arm, wide and tall enough to stand behind
    const wall = () => [
      neon(P(B(0.72, 1.12, 0.035, o(light, { taper: 0.82, tag: { shield: true } })), -0.26, -0.86, 0.34), 0.42),
      P(B(0.76, 0.05, 0.06, o(plate, { tag: { shield: true } })), -0.26, -0.88, 0.34),
      P(B(0.1, 0.1, 0.3, o(16, { tag: { shield: true } })), -0.1, -0.36, 0.16),
    ];
    const left = imp ? sword(0.5, 0.045) : ninja ? sword(0.8, 0.045) : shield ? wall() : null;
    return [
      { name: 'hips', parent: null, at: [0, 0.9, 0], pieces: [
        P(B(0.32, 0.2, 0.22, o(armour, { taper: 1.06, tag: legs })), 0, -0.1, 0),
        neon(P(L([[0.172, 0], [0.172, 0.022]], o(light, { sides: 6, sz: 0.74 })), 0, 0.085, 0), 0.5),
      ] },
      { name: 'chest', parent: 'hips', at: [0, 0.09, 0], pieces: [
        L([[0.14, 0], [0.17, 0.2]], o(armour, { sides: 6, sz: 0.74, tag: core })),
        P(L([[0.17, 0], [0.25, 0.2], [0.22, 0.34]], o(armour, { sides: 6, sz: 0.7, tag: chest })), 0, 0.18, 0),
        P(B(brute ? 0.32 : 0.27, brute ? 0.26 : 0.17, brute ? 0.08 : 0.05, o(plate, { taper: 0.78, tag: shed })), 0, brute ? 0.24 : 0.31, 0.125),
        neon(P(B(0.15, 0.02, 0.035, o(light)), 0, 0.275, 0.16), 0.9),
        P(B(brute ? 0.3 : 0.19, brute ? 0.28 : 0.22, brute ? 0.09 : 0.07, o(plate, { tag: shed })), 0, brute ? 0.2 : 0.25, -0.185),
      ].concat(bomber ? [neon(P(L([[0.1, 0], [0.12, 0.05], [0.12, 0.31], [0.1, 0.36]], o(25, { sides: 7 })), 0, 0.1, -0.3), 1.3)] : []).concat([
      ]) },
      { name: 'head', parent: 'chest', at: [0, 0.53, 0], pieces: head },
      ...arm('L', left), ...arm('R', right), ...leg('L'), ...leg('R'),
    ];
  }

  // The ronin. Not meant to be cut, but built the same way so that a lost fight leaves a heap. A tall, lean swordsman without a master:
  // the red mask of a demon over his face (black horns ringed with gold, a heavy brow lined in gold, tusks, and eyes that burn), long grey
  // hair down his back, a dark kimono with a pale collar, wide trousers bound at the shin, a torn cloak, one layered shoulder guard of black
  // lacquer, bracers and greaves to match, a sash, a scabbard at the left hip and a paper lantern at the right. Everything that hangs from
  // him (hair, cloak, the panels of his coat) is on bones of its own and streams behind him.
  function hero() {
    const o = (col, extra) => Object.assign({ col, inner: 50, glow: 0.3 }, extra || {});
    const ember = (piece, heat) => trim(piece, heat);
    const arm = (s) => {
      const sx = s === 'L' ? 1 : -1, L0 = s === 'L';
      const guard = L0 ? [ // the shoulder guard: three plates, each lower and wider than the last, with fire along their edges
        P(B(0.2, 0.05, 0.24, o(54, { taper: 0.8 })), sx * 0.03, 0.03, 0, 0, 0, -sx * 0.22),
        P(B(0.22, 0.045, 0.26, o(54, { taper: 0.88 })), sx * 0.07, -0.035, 0, 0, 0, -sx * 0.42),
        ember(P(B(0.225, 0.012, 0.265, o(33)), sx * 0.074, -0.046, 0, 0, 0, -sx * 0.42), 0.7),
        P(B(0.21, 0.045, 0.25, o(54, { taper: 0.9 })), sx * 0.105, -0.105, 0, 0, 0, -sx * 0.62),
        ember(P(B(0.215, 0.012, 0.255, o(33)), sx * 0.11, -0.116, 0, 0, 0, -sx * 0.62), 0.7),
        P(L([[0.02, 0], [0.02, 0.012]], o(60, { sides: 6 })), sx * 0.05, 0.08, 0.07), P(L([[0.02, 0], [0.02, 0.012]], o(60, { sides: 6 })), sx * 0.05, 0.08, -0.07),
      ] : [P(B(0.15, 0.045, 0.19, o(50, { taper: 0.8 })), sx * 0.02, 0.02, 0, 0, 0, -sx * 0.25)];
      return [
        { name: 'arm' + s, parent: 'chest', at: [sx * 0.2, 0.36, 0], pieces: [
          limb(0.3, 0.06, 0.052, o(50, { sides: 8 })),
          P(B(0.085, 0.27, 0.19, o(53, { taper: 1.35 })), 0, -0.3, -0.03),   // the sleeve, hanging wide
        ].concat(guard) },
        { name: 'fore' + s, parent: 'arm' + s, at: [0, -0.3, 0], pieces: [
          limb(0.28, 0.046, 0.038, o(36, { sides: 8 })),
          P(L([[0.05, 0], [0.058, 0.16]], o(54, { sides: 8 })), 0, -0.24, 0),
          ember(P(L([[0.061, 0], [0.061, 0.014]], o(33, { sides: 8 })), 0, -0.085, 0), 0.7),
          P(L([[0.05, 0], [0.05, 0.02]], o(37, { sides: 8 })), 0, -0.26, 0),
          P(B(0.062, 0.085, 0.07, o(50)), 0, -0.36, 0),
        ] },
      ];
    };
    const leg = (s) => {
      const sx = s === 'L' ? 1 : -1;
      return [
        { name: 'thigh' + s, parent: 'hips', at: [sx * 0.085, -0.07, 0], pieces: [limb(0.44, 0.105, 0.155, o(50, { sides: 8 }))] },
        { name: 'shin' + s, parent: 'thigh' + s, at: [0, -0.44, 0], pieces: [
          limb(0.4, 0.062, 0.044, o(36, { sides: 8 })),
          P(B(0.085, 0.26, 0.04, o(54, { taper: 0.75 })), 0, -0.31, 0.045),
          ember(P(B(0.09, 0.012, 0.046, o(33)), 0, -0.05, 0.045), 0.6),
          P(L([[0.056, 0], [0.056, 0.022]], o(37, { sides: 8 })), 0, -0.34, 0),
          P(B(0.085, 0.07, 0.25, o(50, { taper: 0.8 })), 0, -0.47, 0.05),
        ] },
      ];
    };
    const saya = (piece) => P(piece, 0.18, 0.02, 0.16, -1.9, 0, 0);
    const cloth = (w, len, taper, col, heat) => [P(B(w, len, 0.022, o(col, { taper: 1 / taper })), 0, -len, 0), ember(P(B(w * taper, 0.022, 0.026, o(33)), 0, -len, 0), heat)];
    // a length of hair hanging from its bone: w wide at the top, narrowing by `taper` to the bottom
    // Hair is made of locks, each a narrow strip of its own: [x, width, length, colour, how far back it lies]. The upper length of a fall
    // of hair is straight strips side by side; the lower length is the same locks running out to points at different heights.
    const locks = (list, point) => list.map(([x, w, len, col, z]) => P(B(w * (point ? 0.16 : 0.92), len, 0.026, o(col, { taper: point ? 1 / 0.16 : 1 / 0.92 })), x, -len, z || 0));

    // ---- the mask. Built about the face and then set a little larger than life, as such masks are.
    const K = 1.14, mk = (piece) => P(piece, 0, 0.0, -0.008, 0, 0, 0, K);
    const horn = (sx) => { // out from the temple, then up, then to a point: three lengths, each turned a little further upright
      const out = [], segs = [[0.032, 0.026, 0.075, 1.05], [0.026, 0.017, 0.08, 0.6], [0.017, 0, 0.1, 0.12]];
      let x = sx * 0.072, y = 0.2, z = 0.062;
      out.push(P(L([[0.037, 0], [0.037, 0.014]], o(60, { sides: 7 })), x, y, z, 0.1, 0, -sx * 1.05));
      for (const [r0, r1, len, tilt] of segs) {
        out.push(P(L([[r0, 0], [r1, len]], o(33, { sides: 7 })), x, y, z, 0.1, 0, -sx * tilt));
        x += sx * Math.sin(tilt) * len * 0.98; y += Math.cos(tilt) * len * 0.98; z += 0.1 * len;
      }
      return out;
    };
    const side = (sx) => [
      P(B(0.11, 0.05, 0.062, o(55)), sx * 0.053, 0.148, 0.106, 0, 0, sx * 0.3),                              // the brow, drawn down toward the nose
      P(B(0.118, 0.009, 0.014, o(60)), sx * 0.054, 0.142, 0.14, 0, 0, sx * 0.3),                              // and the line of gold under it
      P(B(0.056, 0.032, 0.02, o(33)), sx * 0.05, 0.112, 0.104, 0, 0, sx * 0.22),                              // the hollow of the eye
      ember(P(B(0.034, 0.013, 0.014, o(33)), sx * 0.05, 0.121, 0.113, 0, 0, sx * 0.22), 2.0),                 // and what burns in it
      P(B(0.06, 0.07, 0.045, o(55, { taper: 0.75 })), sx * 0.073, 0.045, 0.1),                                // the cheek
      P(B(0.022, 0.13, 0.07, o(56, { taper: 0.8 })), sx * 0.107, 0.03, 0.066),                                // the wing of the mask by the ear
      P(L([[0.018, 0], [0.013, 0.05], [0, 0.115]], o(59, { sides: 6 })), sx * 0.066, -0.012, 0.126, 0.22, 0, -sx * 0.2), // a tusk from the lower jaw
      P(L([[0.011, 0], [0, 0.05]], o(59, { sides: 5 })), sx * 0.036, 0.05, 0.13, Math.PI, 0, 0),                // a fang from the upper
      P(L([[0.014, 0], [0.014, 0.01]], o(56, { sides: 6 })), sx * 0.062, 0.168, 0.14, Math.PI / 2, 0, 0),       // a boss on the brow
    ];
    const mask = [
      P(B(0.15, 0.255, 0.04, o(55, { taper: 1.32 })), 0, -0.012, 0.086),                                        // the face of it
      P(B(0.19, 0.075, 0.05, o(55, { taper: 0.82 })), 0, 0.172, 0.088),                                         // the forehead
      P(B(0.034, 0.034, 0.016, o(56, { taper: 0.6 })), 0, 0.176, 0.114),                                           // a crease between the brows
      P(B(0.056, 0.078, 0.052, o(55, { taper: 0.42 })), 0, 0.066, 0.118),                                       // the nose, broad at the nostrils
      P(B(0.136, 0.022, 0.046, o(55)), 0, 0.052, 0.112),                                                        // the upper lip, drawn back
      P(B(0.122, 0.052, 0.03, o(33)), 0, 0.004, 0.108),                                                         // the mouth
      P(B(0.108, 0.017, 0.012, o(59)), 0, 0.036, 0.127), P(B(0.098, 0.015, 0.012, o(59)), 0, 0.006, 0.127),     // teeth, above and below
      P(B(0.118, 0.04, 0.052, o(55, { taper: 1.2 })), 0, -0.04, 0.108),                                         // the jaw
      ...side(1), ...side(-1), ...horn(1), ...horn(-1),
    ].map(mk);
    return [
      { name: 'hips', parent: null, at: [0, 0.92, 0], pieces: [
        P(L([[0.14, 0], [0.165, 0.1], [0.15, 0.2]], o(50, { sides: 8, sz: 0.72 })), 0, -0.12, 0),
        P(L([[0.166, 0], [0.172, 0.05], [0.166, 0.1]], o(56, { sides: 10, sz: 0.74 })), 0, 0.0, 0),              // the sash
        P(L([[0.176, 0], [0.176, 0.022]], o(37, { sides: 10, sz: 0.74 })), 0, 0.04, 0),
        P(B(0.085, 0.085, 0.06, o(37, { taper: 0.75 })), 0.02, 0.02, 0.12),
        P(B(0.04, 0.26, 0.018, o(56, { taper: 0.6 })), -0.02, -0.24, 0.135), P(B(0.04, 0.2, 0.018, o(56, { taper: 0.6 })), 0.05, -0.18, 0.135),
        saya(B(0.04, 0.98, 0.056, o(54, { taper: 0.72 }))),
        saya(P(B(0.052, 0.05, 0.068, o(60)), 0, 0.0, 0)),
        saya(P(B(0.048, 0.03, 0.064, o(37)), 0, 0.3, 0)),
        saya(P(B(0.04, 0.04, 0.056, o(60)), 0, 0.9, 0)),
        // the lantern at the right hip
        P(B(0.012, 0.14, 0.012, o(38)), -0.2, -0.12, 0.07),
        P(L([[0.05, 0], [0.064, 0.022]], o(38, { sides: 8 })), -0.2, -0.14, 0.07),
        ember(P(L([[0.05, 0], [0.08, 0.05], [0.08, 0.14], [0.05, 0.19]], o(52, { sides: 8 })), -0.2, -0.33, 0.07), 1.2),
        P(L([[0.054, 0], [0.04, 0.022]], o(38, { sides: 8 })), -0.2, -0.352, 0.07),
      ] },
      { name: 'chest', parent: 'hips', at: [0, 0.1, 0], pieces: [
        L([[0.122, 0], [0.19, 0.3], [0.14, 0.43]], o(50, { sides: 8, sz: 0.66 })),
        P(B(0.05, 0.36, 0.03, o(52)), 0.045, 0.06, 0.1, -0.12, 0, 0.3), P(B(0.05, 0.36, 0.03, o(52)), -0.045, 0.06, 0.1, -0.12, 0, -0.3), // the collar, crossed
        P(L([[0.1, 0], [0.085, 0.07]], o(50, { sides: 8 })), 0, 0.385, 0),
      ] },
      { name: 'head', parent: 'chest', at: [0, 0.42, 0], pieces: [
        L([[0.048, -0.03], [0.048, 0.05]], o(14, { sides: 8 })),
        L([[0.066, 0.02], [0.096, 0.08], [0.096, 0.17], [0.066, 0.23]], o(14, { sides: 8 })),
        P(L([[0.104, 0], [0.114, 0.08], [0.094, 0.17], [0.04, 0.215]], o(58, { sides: 9 })), 0, 0.06, -0.034),   // hair over the crown
        P(B(0.024, 0.34, 0.022, o(57, { taper: 1.9 })), 0.127, -0.12, 0.03, 0, 0, -0.05), P(B(0.024, 0.4, 0.022, o(57, { taper: 1.9 })), -0.127, -0.18, 0.03, 0, 0, 0.05), // two locks that fall past the mask
        ...mask,
      ] },
      { name: 'scarf', parent: 'head', at: [0, 0.14, -0.13], pieces: locks([[-0.088, 0.05, 0.4, 58, -0.006], [-0.044, 0.052, 0.4, 57, 0.004], [0, 0.056, 0.4, 58, -0.01], [0.044, 0.052, 0.4, 57, 0.004], [0.088, 0.05, 0.4, 58, -0.006]]) },
      { name: 'scarf2', parent: 'scarf', at: [0, -0.4, 0], pieces: locks([[-0.088, 0.05, 0.34, 58, -0.006], [-0.044, 0.052, 0.52, 57, 0.004], [0, 0.056, 0.42, 58, -0.01], [0.044, 0.052, 0.58, 57, 0.004], [0.088, 0.05, 0.38, 58, -0.006]], true) },
      { name: 'band', parent: 'head', at: [0.092, 0.15, -0.1], pieces: locks([[-0.02, 0.04, 0.34, 57, 0], [0.022, 0.04, 0.34, 58, 0.008]]) },
      { name: 'band2', parent: 'band', at: [0, -0.34, 0], pieces: locks([[-0.02, 0.04, 0.46, 57, 0], [0.022, 0.04, 0.3, 58, 0.008]], true) },
      { name: 'hair', parent: 'head', at: [-0.092, 0.15, -0.1], pieces: locks([[0.02, 0.04, 0.3, 57, 0], [-0.022, 0.04, 0.3, 58, 0.008]]) },
      { name: 'hair2', parent: 'hair', at: [0, -0.3, 0], pieces: locks([[0.02, 0.04, 0.4, 57, 0], [-0.022, 0.04, 0.26, 58, 0.008]], true) },
      { name: 'cape', parent: 'chest', at: [0, 0.4, -0.105], pieces: [P(B(0.36, 0.5, 0.024, o(50, { taper: 1 / 1.25 })), 0, -0.5, 0), P(B(0.3, 0.46, 0.016, o(51, { taper: 1 / 1.25 })), 0, -0.48, 0.016)] },
      { name: 'cape2', parent: 'cape', at: [0, -0.5, 0], pieces: [ // the torn lower edge: three tongues of unequal length, each burning at its tip
        ...[[-0.15, 0.13, 0.52], [0, 0.15, 0.4], [0.15, 0.13, 0.58]].flatMap(([x, w, len]) => [P(B(w, len, 0.022, o(50, { taper: 2.2 })), x, -len, 0), ember(P(B(w * 0.5, 0.05, 0.026, o(33, { taper: 2 })), x, -len, 0), 0.75)]),
      ] },
      { name: 'tailL', parent: 'hips', at: [0.1, -0.02, -0.1], pieces: cloth(0.15, 0.5, 1.25, 53, 0.45) },
      { name: 'tailR', parent: 'hips', at: [-0.1, -0.02, -0.1], pieces: cloth(0.15, 0.5, 1.25, 53, 0.45) },
      ...arm('L'), ...arm('R'), ...leg('L'), ...leg('R'),
    ];
  }

  // The blade: grip at the origin, edge along +y. It glows for good, which is why whatever it opens glows too.
  function katana() {
    const g = new T.Group();
    g.add(partMesh([
      P(L([[0.021, -0.16], [0.019, 0.13]], { sides: 6, col: 16 }), 0, 0, 0),
      P(L([[0.026, 0], [0.026, 0.024]], { sides: 6, col: 18 }), 0, -0.175, 0),
      P(L([[0.062, 0], [0.062, 0.016]], { sides: 8, col: 18, sz: 0.8 }), 0, 0.13, 0),
      P(B(0.02, 0.05, 0.046, { col: 18 }), 0, 0.146, 0),
      glowing(P(B(0.014, 1.02, 0.044, { col: 15, taper: 0.5, taperZ: 0.5 }), 0, 0.146, 0), 1.25, GEO.BLADE),
    ]));
    return g;
  }

  // Things standing in the clearing that exist to be cut. The old names are kept (pillar, drum, tube, board, crate) because the game places
  // them by those; what they are now: a tree, a stone lantern, a stalk of bamboo, a lantern on a post, a wooden chest.
  const props = {
    pillar(h) { // a young cedar: roots, a trunk bound with a rope, and its crown in three tiers
      const bark = (extra) => Object.assign({ col: 42, inner: 47, glow: 0.7, sides: 7 }, extra || {}), leaf = (col) => ({ col, inner: 41, glow: 0.5, sides: 7 });
      const out = [L([[0.56, 0], [0.4, 0.16], [0.36, 0.3]], bark())];
      let y = 0.28;
      const n = Math.max(2, Math.round(h / 0.9));
      for (let i = 0; i < n; i++) { const dh = h / n, r0 = 0.36 - 0.1 * i / n, r1 = 0.36 - 0.1 * (i + 1) / n; out.push(P(L([[r0, 0], [r1, dh + 0.02]], bark()), 0, y, 0, 0, i * 0.5, 0)); y += dh; }
      out.push(P(L([[0.39, 0], [0.4, 0.035], [0.39, 0.07]], { col: 37, inner: 47, glow: 0.7, sides: 7 }), 0, 1.0, 0));
      out.push(P(B(0.05, 0.2, 0.015, { col: 52, inner: 47, glow: 0.7, taper: 0.6 }), 0.1, 0.78, 0.39), P(B(0.05, 0.16, 0.015, { col: 52, inner: 47, glow: 0.7, taper: 0.6 }), -0.14, 0.82, 0.37));
      out.push(P(L([[1.5, 0], [1.25, 0.25], [0.3, 1.5]], leaf(40)), 0, y - 0.25, 0), P(L([[1.2, 0], [1.0, 0.2], [0.2, 1.35]], leaf(41)), 0, y + 0.75, 0, 0, 0.4, 0), P(L([[0.85, 0], [0.7, 0.15], [0, 1.4]], leaf(40)), 0, y + 1.7, 0, 0, 0.8, 0));
      return out;
    },
    drum(s) { // a stone lantern with a light in it
      const st = (extra) => Object.assign({ sides: 6, col: 43, inner: 5, glow: 0.8 }, extra || {});
      return [
        P(L([[0.34, 0], [0.3, 0.1]], st()), 0, 0, 0, 0, 0, 0, s),
        P(L([[0.13, 0], [0.11, 0.42]], st()), 0, 0.1 * s, 0, 0, 0, 0, s),
        P(L([[0.14, 0], [0.26, 0.07], [0.26, 0.11]], st()), 0, 0.5 * s, 0, 0, 0, 0, s),
        neon(P(L([[0.19, 0], [0.19, 0.2]], { sides: 6, col: 48, inner: 5, glow: 0.8 }), 0, 0.61 * s, 0, 0, 0, 0, s), 1.0),
        P(L([[0.4, 0], [0.34, 0.06], [0.06, 0.24]], st()), 0, 0.81 * s, 0, 0, 0, 0, s),
      ];
    },
    tube(h, lean, turn) { // a stalk of bamboo: joints all the way up and a few leaves at the top
      const H = h * 1.5, n = Math.max(3, Math.round(H / 0.6)), out = [];
      for (let i = 0; i < n; i++) {
        const r = 0.06 - 0.02 * i / n;
        out.push(P(L([[r, 0], [r * 0.96, H / n - 0.02]], { sides: 6, col: 44, inner: 45, glow: 0.6 }), 0, (H / n) * i, 0));
        out.push(P(L([[r * 1.25, 0], [r * 1.25, 0.03]], { sides: 6, col: 41, inner: 45, glow: 0.6 }), 0, (H / n) * (i + 1) - 0.03, 0));
      }
      for (let k = 0; k < 3; k++) out.push(P(B(0.09, 0.5, 0.012, { col: 41, inner: 45, glow: 0.5, taper: 0.1 }), 0, H - 0.25 - k * 0.3, 0, 0.9 + k * 0.15, k * 2.1, 0));
      return out.map((p) => P(p, 0, 0, 0, lean, turn, 0));
    },
    board(w, h, c, turn) { // a post with a crossbar and a paper lantern hanging from it
      const wd = { col: 49, inner: 47, glow: 0.7, sides: 6 };
      return [
        L([[0.15, 0], [0.11, 0.14]], { col: 43, inner: 5, glow: 0.7, sides: 6 }), P(L([[0.07, 0], [0.06, 2.5]], wd), 0, 0.1, 0),
        P(B(w + 0.5, 0.1, 0.12, { col: 49, inner: 47, glow: 0.7 }), 0, 2.36, 0), P(B(w + 0.8, 0.07, 0.16, { col: 38, inner: 47, glow: 0.7, taper: 1.06 }), 0, 2.56, 0),
        P(B(0.015, 0.3, 0.015, { col: 38, inner: 47, glow: 0.7 }), w * 0.42, 2.06, 0),
        neon(P(L([[0.1, 0], [0.17, 0.09], [0.17, 0.36], [0.1, 0.45]], { col: 48, inner: 47, glow: 0.7, sides: 7 }), w * 0.42, 1.62, 0), 0.95),
      ].map((p) => P(p, 0, 0, 0, 0, turn, 0));
    },
    crate(s) { // a wooden chest bound with rope
      return [
        B(s, s * 0.8, s, { col: 46, inner: 47, glow: 0.8 }),
        P(B(s * 1.04, s * 0.1, s * 1.04, { col: 38, inner: 47, glow: 0.8 }), 0, s * 0.8, 0),
        P(B(s * 1.03, s * 0.07, s * 1.03, { col: 37, inner: 47, glow: 0.8 }), 0, s * 0.38, 0),
      ];
    },
  };

  return { makeRig, rebuild, dispose, synth, hero, katana, props };
})();
