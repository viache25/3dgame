// Luna, the king's third guardian: a tall thin swordsman droid — visible skeleton, lacquer plates, a pale six-eyed mask,
// a cable mane with burning crimson ends, a very long blade in a crimson scabbard. Built facing +Z; his left side (+X) carries the sword.
function buildLuna() {
  const root = grp(null, null, 'luna');
  const lac = std(0x384898, { metalness: 0.55, roughness: 0.3 });
  const lacD = std(0x232c60, { metalness: 0.5, roughness: 0.4 });
  const bone = std(0x7884b4, { metalness: 0.88, roughness: 0.32 });
  const dark = std(0x0e1124, { metalness: 0.45, roughness: 0.55 });
  const gold = new T.MeshStandardMaterial({ color: col(0xf2c256), metalness: 1, roughness: 0.3, flatShading: true, emissive: col(0xe6a030, 0.05) });
  const ceramic = new T.MeshStandardMaterial({ color: col(0xecebf5), metalness: 0.05, roughness: 0.32, flatShading: true, emissive: col(0xdfe6ff, 0.02) });
  const cable = std(0x161c3a, { metalness: 0.35, roughness: 0.6 });
  const scab = std(0xb01430, { metalness: 0.4, roughness: 0.22 });
  const scabD = std(0x6a0c20, { metalness: 0.4, roughness: 0.35 });
  const chkA = std(0x5e86c8, { metalness: 0.35, roughness: 0.28 });
  const chkB = std(0x131b36, { metalness: 0.35, roughness: 0.3 });
  const wire = new T.MeshStandardMaterial({ color: col(0x8a1228), metalness: 0.3, roughness: 0.5, flatShading: true, emissive: col(0xff3b5c, 0.25) });
  const black = new T.MeshBasicMaterial({ color: 0x030308 });
  const crim = glow(0xff2f52, 1.9), crimHot = glow(0xff8a9a, 1.9), moonG = glow(0xd8e6ff, 1.0), mag = glow(0xff4d8d, 1.7), cyan = glow(0x5ff2e0, 1.3);

  const HS = 0.92, GR = -0.1, GL = -0.3;
  const B = { hipW: 0.1, thigh: 0.54, shin: 0.54, ankle: 0.1, waist: 0.12, spine: 0.22, shY: 0.28, shW: 0.225, upper: 0.4, fore: 0.38, neckY: 0.3, neck: 0.13 };
  const hips = grp(root, [0, B.ankle + B.shin + B.thigh + 0.03, 0], 'hips');
  const waist = grp(hips, [0, B.waist, 0], 'waist');
  const chest = grp(waist, [0, B.spine, 0], 'chest');
  const neck = grp(chest, [0, B.neckY + 0.02, 0], 'neck');
  const head = grp(neck, [0, B.neck, 0], 'head');
  head.scale.setScalar(1.16);
  const mkArm = (s) => { const up = grp(chest, [s * B.shW, B.shY, 0]); const lo = grp(up, [0, -B.upper, 0]); const hand = grp(lo, [0, -B.fore, 0]); return { up, lo, hand, s }; };
  const mkLeg = (s) => { const up = grp(hips, [s * B.hipW, -0.03, 0]); const lo = grp(up, [0, -B.thigh, 0]); const foot = grp(lo, [0, -B.shin, 0]); return { up, lo, foot, s }; };
  const armL = mkArm(1), armR = mkArm(-1), legL = mkLeg(1), legR = mkLeg(-1);
  /** A servo: a dark drum across the joint, a gold ring and a pale bolt on each face. */
  const servo = (g, r, w) => {
    add(g, drum(r, w, 10), dark);
    for (const s of [1, -1]) { add(g, drum(r * 1.04, 0.01, 10), gold, [s * (w / 2 + 0.003), 0, 0]); add(g, drum(r * 0.34, 0.012, 6), ceramic, [s * (w / 2 + 0.012), 0, 0]); }
  };

  // ---- pelvis: a lacquer block, the gold belt with the waist bearing, two checkered tassets on hinges
  add(hips, hull([[0.12, 0.05, 0.085], [0.12, 0.05, -0.085], [0.1, -0.08, 0.07], [0.1, -0.08, -0.07], [0, -0.14, 0.06], [0, -0.14, -0.05], [0, 0.05, 0.102], [0, 0.05, -0.095]]), lac);
  add(hips, cyl(0.138, 0.046, 10), gold, [0, 0.074, 0], null, [1, 1, 0.8]);
  add(hips, cyl(0.07, 0.04, 10), bone, [0, 0.11, 0]);
  add(hips, new T.IcosahedronGeometry(0.014, 0), crim, [0, -0.03, 0.09]);
  for (const s of [1, -1]) {
    const t = grp(hips, [s * 0.128, 0.05, 0.015]);
    t.rotation.set(0, s * 0.25, s * 0.22);
    add(t, box(0.014, 0.3, 0.19), lac, [0, -0.15, 0]);
    add(t, hull([[0.007, -0.3, 0.095], [0.007, -0.3, -0.095], [0.007, -0.36, 0], [-0.007, -0.3, 0.095], [-0.007, -0.3, -0.095], [-0.007, -0.36, 0]], false), lac);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) add(t, box(0.006, 0.078, 0.078), (r + c) % 2 ? chkB : chkA, [s * 0.009, -0.062 - r * 0.084, -0.042 + c * 0.084]);
    add(t, box(0.02, 0.016, 0.2), gold, [0, -0.008, 0]);
    add(t, box(0.018, 0.012, 0.2), gold, [0, -0.3, 0]);
    add(t, drum(0.014, 0.03, 6), gold, [0, 0.005, 0.07]); add(t, drum(0.014, 0.03, 6), gold, [0, 0.005, -0.07]);
  }

  // ---- the spine in the open, a crimson power cable looping behind it
  for (let i = 0; i < 4; i++) { add(waist, cyl(0.038, 0.034, 8), bone, [0, 0.035 + i * 0.052, 0]); add(waist, cyl(0.024, 0.02, 8), dark, [0, 0.061 + i * 0.052, 0]); }
  add(waist, tube([[0.03, -0.06, -0.07], [0.07, 0.04, -0.15], [0.06, 0.16, -0.17], [0.03, 0.27, -0.12]], 0.013, 6, 16), wire);

  // ---- chest: a lacquer keel over the skeleton
  add(chest, hull([[0.2, 0.27, 0], [0.17, 0.3, -0.07], [0.11, 0.31, 0.06], [0, 0.31, 0.09], [0, 0.22, 0.165], [0, 0.03, 0.11], [0.09, 0.02, 0.07], [0.17, 0.15, 0.09], [0.19, 0.2, 0.03], [0.15, 0.24, -0.125], [0, 0.27, -0.14], [0.08, 0.02, -0.08], [0, 0.02, -0.09], [0.14, 0.08, -0.02], [0.13, 0.13, -0.12]]), lac, null, null, [1.22, 1.08, 1.2]);
  add(chest, hull([[0.007, 0.305, 0.096], [0.007, 0.22, 0.174], [0.007, 0.025, 0.118], [0.007, 0.305, 0.08], [0.007, 0.22, 0.155], [0.007, 0.025, 0.1]]), gold, [0, 0, 0.004], null, [1, 1.08, 1.2]);
  const coreG = grp(chest, [0.098, 0.205, 0.148]);
  coreG.rotation.set(-0.12, 0.62, 0);
  add(coreG, cyl(0.04, 0.012, 6), dark, null, [Math.PI / 2, 0, 0]);
  add(coreG, cyl(0.027, 0.016, 6), mag, [0, 0, 0.003], [Math.PI / 2, 0, 0]);
  add(coreG, cyl(0.012, 0.02, 6), crimHot, [0, 0, 0.004], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) add(chest, box(0.22, 0.012, 0.04), bone, [0, 0.1 + i * 0.048, -0.158]);
  for (const s of [1, -1]) for (let i = 0; i < 3; i++) add(chest, box(0.006, 0.012, 0.06), black, [s * 0.213, 0.11 + i * 0.03, 0.036], [0, 0, s * 0.25]);
  for (let i = 0; i < 3; i++) add(chest, box(0.007, 0.03, 0.004), ceramic, [-0.092 + i * 0.016, 0.26, 0.146], [0, -0.62, 0]);
  add(chest, cyl(0.082, 0.05, 10), ceramic, [0, 0.345, 0]);
  add(neck, cyl(0.03, B.neck, 8), dark, [0, B.neck / 2, 0]);
  for (const y of [0.035, 0.085]) add(neck, cyl(0.04, 0.014, 8), bone, [0, y, 0]);
  for (const s of [1, -1]) add(neck, cyl(0.008, B.neck + 0.02, 5), bone, [s * 0.036, B.neck / 2, -0.022]);

  // ---- the head: a dark skull, the pale face plate, six optics
  add(head, hull([[0.075, 0.2, -0.02], [0.08, 0.12, -0.06], [0.07, 0.05, -0.05], [0, 0.25, -0.02], [0, 0.22, -0.1], [0, 0.1, -0.125], [0.06, 0.18, -0.1], [0, 0, -0.07], [0.05, 0.02, 0.04], [0.07, 0.2, 0.06], [0, 0.245, 0.07], [0.06, 0, 0], [0.075, 0.1, 0.07]]), lacD);
  add(head, hull([[0.07, 0.228, 0.085], [0, 0.248, 0.098], [0.084, 0.15, 0.088], [0.075, 0.06, 0.085], [0.04, -0.012, 0.085], [0, -0.04, 0.088], [0, 0.13, 0.126], [0.045, 0.14, 0.116], [0.04, 0.03, 0.108], [0, 0, 0.112], [0, 0.22, 0.112],
    [0.07, 0.228, 0.06], [0.084, 0.15, 0.06], [0.075, 0.06, 0.06], [0.04, -0.012, 0.06], [0, -0.04, 0.06]]), ceramic);
  const eyes = [];
  [[0.19, 0.0165, 0.105], [0.128, 0.021, 0.111], [0.064, 0.0175, 0.105]].forEach(([y, r, z]) => {
    for (const s of [1, -1]) {
      const e = grp(head, [s * 0.04, y, z]);
      e.rotation.set(0, s * 0.3, 0);
      add(e, rodZ(r + 0.008, 0.014, 10), black);
      e.userData.iris = [add(e, rodZ(r * 0.8, 0.02, 10), crim), add(e, rodZ(r * 0.3, 0.024, 8), crimHot)];
      add(e, rodZ(r * 0.2, 0.028, 6), black);
      eyes.push(e);
    }
  });
  for (const s of [1, -1]) { add(head, drum(0.03, 0.02, 8), gold, [s * 0.082, 0.12, -0.012]); add(head, drum(0.014, 0.026, 6), dark, [s * 0.084, 0.12, -0.012]); }
  add(head, box(0.014, 0.05, 0.006), crim, [0.062, 0.2, 0.09], [0, 0.3, -0.35]);
  add(head, box(0.07, 0.04, 0.06), gold, [0, 0.262, -0.05]);
  // the mane: a trunk of cable out of the gold clamp, taps hanging from it, bare fibre burning at the ends
  const maneP = grp(head, [0, 0.27, -0.06]), maneG = grp(maneP, [0, -0.27, 0.06]);
  {
    const trunkPts = [[0, 0.27, -0.06], [0, 0.42, -0.12], [0, 0.5, -0.26], [0, 0.42, -0.4], [0, 0.2, -0.46], [0, -0.08, -0.46], [0, -0.34, -0.43]];
    const curve = new T.CatmullRomCurve3(trunkPts.map((p) => v3(...p)));
    add(maneG, new T.TubeGeometry(curve, 28, 0.05, 7, false), cable);
    const up = v3(0, 1, 0);
    for (const t of [0.12, 0.36, 0.6, 0.84]) {
      const m = add(maneG, cyl(0.06, 0.04, 8), gold);
      m.position.copy(curve.getPoint(t));
      m.quaternion.setFromUnitVectors(up, curve.getTangent(t));
    }
    const R = rng(21);
    const tap = (from, to, r, tipLen) => {
      const mid = [(from[0] + to[0]) / 2 + (to[0] - from[0]) * 0.25, (from[1] + to[1]) / 2 + 0.04, (from[2] + to[2]) / 2 - 0.05];
      const c = new T.CatmullRomCurve3([v3(...from), v3(...mid), v3(...to)]);
      add(maneG, new T.TubeGeometry(c, 10, r, 5, false), cable);
      const end = c.getPoint(1), tan = c.getTangent(1);
      const q = new T.Quaternion().setFromUnitVectors(up, tan);
      const sl = add(maneG, cyl(r * 1.35, 0.03, 6), gold); sl.position.copy(end); sl.quaternion.copy(q);
      const f = add(maneG, cyl(r * 0.42, tipLen, 5), crim); f.position.copy(end).addScaledVector(tan, 0.02 + tipLen / 2); f.quaternion.copy(q);
      const h = add(maneG, cyl(r * 0.42, tipLen * 0.3, 5), crimHot); h.position.copy(end).addScaledVector(tan, 0.02 + tipLen * 0.85); h.quaternion.copy(q);
    };
    for (let i = 0; i < 16; i++) {
      const t = 0.22 + 0.78 * (i / 15), p = curve.getPoint(t), s = i % 2 ? 1 : -1, w = 0.06 + 0.16 * R();
      tap([p.x, p.y, p.z], [s * w, p.y - 0.2 - 0.4 * R(), p.z - 0.03 - 0.1 * R() + 0.05 * (1 - t)], 0.017, 0.11 + 0.07 * R());
    }
    for (const x of [-0.045, 0, 0.045]) tap([x * 0.5, 0.275, -0.035], [x * 1.8, 0.43 - Math.abs(x) * 0.9, 0.13], 0.012, 0.075);
  }

  // ---- arms: servo, bone and actuator, a small shroud; two tendon rods and a vambrace; a ceramic wrist
  for (const A of [armL, armR]) {
    const s = A.s;
    servo(A.up, 0.055, 0.07);
    add(A.up, cyl(0.02, B.upper, 6), bone, [0, -B.upper / 2, 0]);
    add(A.up, cyl(0.01, B.upper * 0.7, 5), bone, [0, -B.upper * 0.5, -0.036]);
    add(A.up, hull([[0.05, -0.08, 0.034], [0.05, -0.08, -0.034], [0.054, -0.27, 0.028], [0.054, -0.27, -0.028], [0.012, -0.06, 0.044], [0.012, -0.29, 0.038], [0.012, -0.06, -0.044], [0.012, -0.29, -0.038]], false), lac).scale.x = s;
    servo(A.lo, 0.04, 0.062);
    for (const x of [0.018, -0.018]) add(A.lo, cyl(0.009, B.fore, 5), bone, [x, -B.fore / 2, 0]);
    add(A.lo, hull([[0.042, -0.07, 0.034], [0.042, -0.07, -0.034], [0.046, -0.3, 0.03], [0.046, -0.3, -0.03], [0, -0.06, 0.05], [0, -0.31, 0.044], [0, -0.07, -0.04], [0, -0.3, -0.036]]), lac, null, null, [1.18, 1, 1.18]);
    add(A.lo, box(0.005, 0.2, 0.005), crim, [0, -0.185, 0.058]);
    add(A.lo, cyl(0.033, 0.03, 8), ceramic, [0, -B.fore + 0.012, 0]);
    fist(A.hand, dark, lac, HS);
  }
  // the checkered shoulder plate, on the sword side only
  {
    const p = grp(chest, [B.shW - 0.05, B.shY - 0.06, 0]);
    p.rotation.set(0, 0, -0.06);
    const r1 = 0.142, r2 = 0.158, a0 = 4 * D, a1 = 96 * D;
    add(p, arcPlate(r1, r2, a0, a1, 0.27, 8), lac);
    const da = (a1 - a0 - 0.1) / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) add(p, arcPlate(r2, r2 + 0.007, a0 + 0.05 + r * da + 0.01, a0 + 0.05 + (r + 1) * da - 0.01, 0.072, 3), (r + c) % 2 ? chkB : chkA, [0, 0, -0.078 + c * 0.078]);
    for (const z of [0.136, -0.136]) add(p, arcPlate(r1 - 0.002, r2 + 0.008, a0 - 0.02, a1 + 0.02, 0.01, 8), gold, [0, 0, z]);
    for (const a of [a0, a1]) add(p, box(0.03, 0.012, 0.28), gold, [Math.cos(a) * (r2 - 0.004), Math.sin(a) * (r2 - 0.004), 0], [0, 0, a]);
    add(p, drum(0.018, 0.05, 6), gold, [0.0, 0.155, 0]);
  }

  // ---- legs: servos in every joint, bone, a plate only along the middle
  for (const Lg of [legL, legR]) {
    servo(Lg.up, 0.058, 0.085);
    add(Lg.up, cyl(0.024, B.thigh, 6), bone, [0, -B.thigh / 2, 0]);
    add(Lg.up, hull([[0.052, -0.1, 0.05], [0.058, -0.1, -0.03], [0.046, -0.41, 0.046], [0.046, -0.41, -0.026], [0, -0.075, 0.07], [0, -0.43, 0.062], [0, -0.12, -0.045]]), lac, null, null, [1.3, 1, 1.28]);
    add(Lg.up, cyl(0.012, 0.3, 5), bone, [0, -0.26, -0.056]);
    add(Lg.up, box(0.005, 0.25, 0.005), crim, [0, -0.25, 0.088], [0.02, 0, 0]);
    servo(Lg.lo, 0.048, 0.078);
    add(Lg.lo, hull([[0.036, 0.035, 0.05], [0.03, -0.045, 0.056], [0, 0, 0.078], [0.036, 0, 0.03], [0, 0.05, 0.05], [0, -0.055, 0.055]]), lac);
    add(Lg.lo, cyl(0.02, B.shin, 6), bone, [0, -B.shin / 2, 0]);
    add(Lg.lo, cyl(0.014, 0.28, 5), bone, [0, -0.22, -0.058]);
    add(Lg.lo, cyl(0.006, 0.44, 4), gold, [0, -0.28, -0.058]);
    add(Lg.lo, hull([[0.04, -0.09, 0.046], [0.044, -0.09, -0.012], [0.032, -0.45, 0.036], [0.035, -0.45, -0.012], [0, -0.08, 0.064], [0, -0.46, 0.052]]), lac, null, null, [1.25, 1, 1.28]);
    add(Lg.lo, box(0.005, 0.27, 0.005), crim, [0, -0.27, 0.076], [0.03, 0, 0]);
    servo(Lg.foot, 0.04, 0.07);
    add(Lg.foot, hull([[0.04, 0, -0.07], [0.046, -0.1, -0.082], [0.046, 0.022, 0.03], [0.052, -0.1, 0.1], [0.042, -0.035, 0.12], [0, 0.04, -0.01]]), lacD);
    for (const s of [1, -1]) add(Lg.foot, hull([[0.005, -0.1, 0.1], [0.05, -0.1, 0.1], [0.005, -0.045, 0.1], [0.046, -0.045, 0.1], [0.008, -0.1, 0.22], [0.042, -0.1, 0.208], [0.012, -0.072, 0.212], [0.036, -0.072, 0.2]], false), ceramic).scale.x = s;
  }

  // ---- the sword: +Z runs from the mouth of the scabbard to its end, the hilt back along −Z
  const saya = grp(null, null, 'saya'), katana = grp(null, null, 'katana'), bladeEyes = [];
  const bladeM = new T.MeshStandardMaterial({ color: col(0xcfe0ff), metalness: 1, roughness: 0.14, flatShading: true, emissive: col(0x7fa8ff, 0.3) });
  {
    const LEN = 1.3, SORI = -0.075;
    const y = (z) => SORI * (z / LEN) * (z / LEN);
    const pts = [];
    for (let i = 0; i <= 8; i++) { const z = (LEN * i) / 8; pts.push([0, y(z), z]); }
    add(saya, tube(pts, 0.029, 8, 32), scab, null, null, [0.72, 1, 1]);
    for (let i = 1; i <= 11; i++) { const z = 0.1 + i * 0.1; add(saya, new T.TorusGeometry(0.03, 0.006, 4, 10), scabD, [0, y(z), z], null, [0.74, 1, 1]); }
    add(saya, rodZ(0.035, 0.06, 8), gold, [0, 0, 0.03], null, [0.75, 1, 1]);
    add(saya, rodZ(0.034, 0.03, 8), gold, [0, y(0.62), 0.62], null, [0.75, 1, 1]);
    add(saya, rodZ(0.012, 0.09, 8, 0.033), gold, [0, y(LEN) - 0.004, LEN + 0.03], [0.1, 0, 0], [0.75, 1, 1]);
    for (let i = 0; i < 6; i++) { const z = 0.2 + i * 0.17; add(saya, drum(0.013, 0.008, 8), dark, [0.0215, y(z), z]); add(saya, drum(0.006, 0.01, 6), crim, [0.022, y(z), z]); }
    for (let i = 0; i < 5; i++) { const z = 0.285 + i * 0.17; add(saya, box(0.004, 0.005, 0.07), moonG, [0.0215, y(z), z]); }
    add(katana, rodZ(0.056, 0.012, 6), gold, [0, 0, -0.008]);
    add(katana, rodZ(0.021, 0.36, 8), dark, [0, 0, -0.195], null, [0.78, 1, 1]);
    for (let i = 0; i < 6; i++) for (const s of [1, -1]) add(katana, new T.OctahedronGeometry(0.013, 0), cyan, [s * 0.0165, 0, -0.05 - i * 0.055], null, [0.3, 1, 1.3]);
    add(katana, rodZ(0.024, 0.035, 8), gold, [0, 0, -0.385], null, [0.8, 1, 1]);
    add(katana, rodZ(0.017, 0.045, 6), gold, [0, 0, 0.022], null, [0.5, 1.15, 1]);
    // the blade: the scabbard's own curve, the edge on the outside of it, six eyes along its flat
    const BL = LEN - 0.07, R = 18, pos = [], idx = [], edge = [];
    for (let i = 0; i <= R; i++) {
      const u = i / R, z = 0.02 + (BL - 0.02) * u, w = 0.036 - 0.009 * u, tip = Math.max(0, (u - 0.93) / 0.07), yy = y(z);
      const hw = (w / 2) * (1 - tip), th = 0.0045 * (1 - tip);
      pos.push(0, yy + hw - tip * w * 0.5, z, th, yy - hw * 0.3 - tip * w * 0.5, z, 0, yy - hw - tip * w * 0.5, z, -th, yy - hw * 0.3 - tip * w * 0.5, z);
      edge.push([0, yy + hw - tip * w * 0.5 + 0.0015, z]);
      if (i < R) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = a + 4, d = b + 4; idx.push(a, c, b, b, c, d); }
    }
    let bg = new T.BufferGeometry();
    bg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    bg.setIndex(idx);
    bg = bg.toNonIndexed(); bg.computeVertexNormals();
    add(katana, bg, bladeM);
    add(katana, tube(edge, 0.0028, 4, 40), moonG).castShadow = false;
    for (let i = 0; i < 6; i++) {
      const z = 0.2 + i * 0.165, e = grp(katana, [0, y(z) - 0.002, z]);
      for (const s of [1, -1]) { add(e, drum(0.0125, 0.003, 8), dark, [s * 0.0052, 0, 0]); add(e, drum(0.008, 0.004, 8), crim, [s * 0.0058, 0, 0]); }
      bladeEyes.push(e);
    }
    add(saya, box(0.1, 0.022, 0.03), bone, [-0.055, 0.0, 0.13]);
  }

  // the scabbard hangs from the pelvis, fixed once from the standing pose
  {
    const hm = new T.Matrix4().makeRotationY(0.2).setPosition(0, 1.158, 0);
    const sd = v3(0.26, -0.62, -0.74).normalize(), left = v3(1, 0, 0);
    const x = left.clone().addScaledVector(sd, -left.dot(sd)).normalize(), yv = v3().crossVectors(sd, x);
    new T.Matrix4().makeBasis(x, yv, sd).setPosition(0.155, 1.2, 0.13).premultiply(hm.invert()).decompose(saya.position, saya.quaternion, saya.scale);
    hips.add(saya);
  }
  const sayaQ0 = saya.quaternion.clone(), ORDER = [2, 3, 0, 1, 4, 5];
  const _mS = new T.Matrix4(), _pS = v3(), _qS = new T.Quaternion(), _sc = v3();
  /**
   * Stand him in a pose. Feet are [worldX, y, sideLocal, yaw, pitch]; the rest is in his own frame (x = his left, z = forward).
   * The sword: `kD` metres drawn along the scabbard, and `kW` 0…1 blends that to a free blade held at `kG`, pointing `kDir`, its edge toward `kUp`.
   */
  function apply(p) {
    root.position.set(p.x, 0, p.z || 0);
    root.rotation.set(0, -Math.PI / 2 + (p.yaw || 0), 0);
    hips.position.set(p.hip[0], p.hip[1], p.hip[2]);
    hips.rotation.set(p.hipPitch || 0, p.hipYaw, p.hipRoll || 0, 'YXZ');
    waist.rotation.set(p.waist[0], p.waist[1], p.waist[2], 'YXZ');
    chest.rotation.set(p.chest || 0, 0, 0);
    neck.rotation.set(p.neck || 0, 0, 0);
    head.rotation.set(p.head[0], p.head[1], p.head[2] || 0, 'YXZ');
    maneP.rotation.set(p.mane || 0, 0, p.maneZ || 0);
    saya.quaternion.copy(sayaQ0).multiply(new T.Quaternion().setFromEuler(new T.Euler(p.sayaTilt || 0, 0, 0)));
    ORDER.forEach((e, k) => { const o = Math.min(1, Math.max(0, (p.eyes ?? 6) - k)); eyes[e].userData.iris.forEach((m) => { m.visible = o > 0.02; m.scale.set(o, o, 1); }); });
    bladeEyes.forEach((e, k) => { const o = Math.min(1, Math.max(0, (p.bEyes || 0) - k)); e.visible = o > 0.02; e.scale.setScalar(Math.max(0.01, o)); });
    root.updateWorldMatrix(true, true);
    const qR = root.getWorldQuaternion(new T.Quaternion());
    const P = (x, y, z) => root.localToWorld(v3(x, y, z));
    const Dn = (x, y, z) => v3(x, y, z).applyQuaternion(qR).normalize();
    const foot = (Lg, f, pole) => {
      ik2(Lg.up, Lg.lo, B.thigh, B.shin, P(f[2], f[1], p.x - f[0]), Dn(pole, 0, 1));
      setWorldQuat(Lg.foot, qR.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(f[4] || 0, f[3] || 0, 0, 'YXZ'))));
    };
    foot(legR, p.fR, p.kneeR); foot(legL, p.fL, p.kneeL);
    _mS.copy(saya.matrixWorld).multiply(new T.Matrix4().makeTranslation(0, 0, -(p.kD || 0))).decompose(_pS, _qS, _sc);
    if (p.kW > 0.001) {
      const z = Dn(p.kDir[0], p.kDir[1], p.kDir[2]), up = Dn(p.kUp[0], p.kUp[1], p.kUp[2]);
      const yv = up.addScaledVector(z, -up.dot(z)).normalize(), x = v3().crossVectors(yv, z);
      const qF = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, yv, z));
      _pS.lerp(P(p.kG[0], p.kG[1], p.kG[2]).addScaledVector(z, -GR), p.kW);
      _qS.slerp(qF, p.kW);
    }
    katana.position.copy(_pS); katana.quaternion.copy(_qS); katana.updateMatrixWorld(true);
    // a hand on the hilt: reach the grip, turn the fist to the hilt's axis, then reach again with the wrist where that fist needs it
    const axis = v3(0, 0, 1).applyQuaternion(_qS);
    const grip = (A, gp, pole, ax) => {
      ik2(A.up, A.lo, B.upper, B.fore, gp, pole); orientGrip(A.hand, A.lo, ax);
      ik2(A.up, A.lo, B.upper, B.fore, gp.clone().addScaledVector(v3(0, 1, 0).applyQuaternion(A.hand.getWorldQuaternion(new T.Quaternion())), FIST_Y * HS), pole); orientGrip(A.hand, A.lo, ax);
    };
    grip(armR, katana.localToWorld(v3(0, 0, GR)), Dn(p.elbR[0], p.elbR[1], p.elbR[2]), axis);
    const lh = saya.localToWorld(v3(0.0, 0.0, 0.1)), w = p.hLw || 0;
    if (w > 0.001) lh.lerp(katana.localToWorld(v3(0, 0, GL)), w);
    grip(armL, lh, Dn(p.elbL[0], p.elbL[1], p.elbL[2]), w > 0.5 ? axis : v3(0, 0, 1).applyQuaternion(saya.getWorldQuaternion(new T.Quaternion())));
    root.updateWorldMatrix(true, true);
  }
  return { root, apply, B, eyes, katana, saya, parts: { hips, waist, chest, neck, head, armL, armR, legL, legR } };
}
