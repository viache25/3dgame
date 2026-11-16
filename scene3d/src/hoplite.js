// The cyber-hoplite, Pilum kit: gunmetal, violet light, hot-pink heat. Built facing +Z; his right side (−X) carries the aspis.
function buildHoplite() {
  const root = grp(null, null, 'hoplite');
  const steel = std(0x3d4468, { metalness: 0.72, roughness: 0.4 });
  const steelL = std(0x5e6894, { metalness: 0.78, roughness: 0.34 });
  const steelD = std(0x262b47, { metalness: 0.6, roughness: 0.52 });
  const chrome = std(0xbcc6ea, { metalness: 0.96, roughness: 0.18 });
  const under = std(0x14172a, { metalness: 0.2, roughness: 0.8 });
  const black = new T.MeshBasicMaterial({ color: 0x030308 });
  const capeM = new T.MeshStandardMaterial({ color: col(0x5a1642), roughness: 0.82, metalness: 0.05, side: T.DoubleSide, flatShading: true });
  const pink = glow(0xff4fb0, 1.6), violet = glow(0xa259ff, 1.9), hot = glow(0xffc2e6, 2.0);
  const visP = glow(0xff4fb0, 1.6), visH = glow(0xffc2e6, 2.0), visV = glow(0xa259ff, 1.9);
  const visP0 = visP.color.clone(), visH0 = visH.color.clone(), visV0 = visV.color.clone();

  const HS = 1.14;
  const B = { hipW: 0.13, thigh: 0.46, shin: 0.45, ankle: 0.09, waist: 0.12, chest: 0.36, shW: 0.27, upper: 0.33, fore: 0.3, neck: 0.5 };
  const hips = grp(root, [0, B.ankle + B.shin + B.thigh + 0.02, 0], 'hips');
  const spine = grp(hips, [0, B.waist, 0], 'spine');
  const head = grp(spine, [0, B.neck, 0.01], 'head');
  const mkArm = (s) => { const up = grp(spine, [s * B.shW, B.chest, 0]); const lo = grp(up, [0, -B.upper, 0]); const hand = grp(lo, [0, -B.fore, 0]); return { up, lo, hand, s }; };
  const mkLeg = (s) => { const up = grp(hips, [s * B.hipW, -0.02, 0]); const lo = grp(up, [0, -B.thigh, 0]); const foot = grp(lo, [0, -B.shin, 0]); return { up, lo, foot, s }; };
  const armL = mkArm(1), armR = mkArm(-1), legL = mkLeg(1), legR = mkLeg(-1);

  // ---- pelvis, belt, pteruges
  add(hips, hull([[0.17, 0.06, 0.1], [0.17, 0.06, -0.1], [0.15, -0.1, 0.08], [0.15, -0.1, -0.08], [0, -0.17, 0.07], [0, -0.17, -0.06], [0, 0.06, 0.13], [0, 0.06, -0.12]]), steelD);
  add(hips, cyl(0.205, 0.07, 8), steelL, [0, 0.085, 0], [0, Math.PI / 8, 0], [1, 1, 0.8]);
  add(hips, box(0.075, 0.06, 0.03), chrome, [0, 0.085, 0.158]);
  add(hips, cyl(0.022, 0.012, 6), pink, [0, 0.085, 0.176], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + Math.PI / 11;
    const g = grp(hips, [Math.sin(a) * 0.185, 0.045, Math.cos(a) * 0.148]);
    g.rotation.set(0, a, 0);
    const front = Math.cos(a);
    const s = grp(g);
    s.rotation.x = -0.2 - 0.3 * Math.max(0, front);
    add(s, box(0.094, 0.25, 0.018), steel, [0, -0.125, 0]);
    add(s, box(0.094, 0.03, 0.022), violet, [0, -0.262, 0]);
    add(s, box(0.094, 0.018, 0.022), chrome, [0, -0.012, 0]);
  }

  // ---- cuirass
  const Y = 0.9;
  add(spine, hull([[0.1, 0.36 * Y, 0.15], [0.2, 0.3 * Y, 0.13], [0.11, 0.2 * Y, 0.172], [0, 0.22 * Y, 0.178], [0, 0.36 * Y, 0.142], [0.25, 0.36 * Y, 0.02], [0.24, 0.2 * Y, 0.03], [0.19, 0.05, 0.05], [0.17, 0, 0.09], [0, 0, 0.13], [0.16, 0, -0.09],
    [0.21, 0.34 * Y, -0.12], [0, 0.38 * Y, -0.13], [0, 0.05, -0.11], [0.15, 0.2 * Y, -0.14], [0.13, 0.42 * Y, 0.04], [0.13, 0.42 * Y, -0.06], [0, 0.1, 0.165]]), steel);
  // the pectoral plate: a lighter faceted slab on the breast
  add(spine, hull([[0.19, 0.31, 0.118], [0.1, 0.33, 0.14], [0, 0.335, 0.145], [0, 0.2, 0.186], [0.11, 0.175, 0.176], [0.2, 0.2, 0.13], [0.1, 0.25, 0.19], [0, 0.26, 0.185]]), steelL, [0, 0, 0.004]);
  add(spine, cyl(0.09, 0.05, 8), steelD, [0, B.chest + 0.045, -0.005]);
  add(spine, cyl(0.052, 0.014, 6), steelD, [0, 0.262, 0.193], [Math.PI / 2 - 0.12, 0, 0]);
  add(spine, cyl(0.035, 0.018, 6), pink, [0, 0.262, 0.196], [Math.PI / 2 - 0.12, 0, 0]);
  add(spine, cyl(0.016, 0.022, 6), hot, [0, 0.262, 0.197], [Math.PI / 2 - 0.12, 0, 0]);
  add(spine, box(0.012, 0.17, 0.008), violet, [0, 0.105, 0.172], [0.24, 0, 0]);
  add(spine, limb(0.168, 0.172, 0.13, 8, 0.8, Math.PI / 8), steelD, [0, 0.012, 0]);
  add(spine, cyl(0.178, 0.028, 8), steelL, [0, -0.045, 0], [0, Math.PI / 8, 0], [1, 1, 0.8]);

  // ---- shoulders and arms
  for (const A of [armL, armR]) {
    const s = A.s;
    const p = grp(spine, [s * (B.shW + 0.02), B.chest + 0.012, 0]);
    p.rotation.z = -s * 0.4;
    add(p, new T.SphereGeometry(0.15, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), steelL, [0, -0.01, 0], null, [1, 0.86, 1.08]);
    add(p, new T.TorusGeometry(0.15, 0.011, 4, 14), chrome, [0, -0.01, 0], [Math.PI / 2, 0, 0], [1, 1.08, 1]);
    add(p, box(0.012, 0.012, 0.012), pink, [0, 0.122, 0]);
    add(A.up, new T.SphereGeometry(0.118, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), steel, [s * 0.012, -0.075, 0], [0, 0, -s * 0.25], [1, 0.8, 1.05]);
    add(A.up, new T.SphereGeometry(0.1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), steelL, [s * 0.014, -0.13, 0], [0, 0, -s * 0.2], [1, 0.75, 1.05]);
    add(A.up, limb(0.07, 0.058, B.upper, 6), under);
    add(A.lo, new T.IcosahedronGeometry(0.066, 0), steelL, [0, 0, -0.012]);
    add(A.lo, limb(0.07, 0.052, B.fore * 0.9, 6), steel, [0, -0.025, 0]);
    add(A.lo, cyl(0.06, 0.03, 6), chrome, [0, -B.fore + 0.03, 0]);
    add(A.lo, box(0.008, 0.19, 0.01), violet, [s * 0.062, -0.15, 0], [0, 0, s * 0.06]);
    fist(A.hand, steelD, steelL, HS);
  }

  // ---- legs
  for (const Lg of [legL, legR]) {
    const s = Lg.s;
    add(Lg.up, limb(0.098, 0.078, B.thigh, 6, 0.95), under);
    add(Lg.up, hull([[0, -0.05, 0.118], [0.088, -0.06, 0.07], [0.104, -0.08, 0], [0.088, -0.36, 0], [0, -0.37, 0.102], [0.072, -0.385, 0.06], [0, -0.1, -0.088], [0, -0.34, -0.072]]), steel);
    add(Lg.up, box(0.008, 0.25, 0.014), violet, [s * 0.1, -0.22, 0.005], [0, 0, -s * 0.05]);
    add(Lg.lo, new T.IcosahedronGeometry(0.08, 0), steelL, [0, 0, 0.03], null, [1, 1, 1.1]);
    add(Lg.lo, hull([[0, -0.03, 0.088], [0.072, -0.04, 0.04], [0.078, -0.04, -0.05], [0, -0.2, 0.078], [0, -0.42, 0.056], [0.05, -0.43, 0.02], [0.056, -0.43, -0.046], [0, -0.18, -0.09], [0.082, -0.16, -0.02]]), steel);
    add(Lg.lo, box(0.008, 0.29, 0.014), violet, [s * 0.078, -0.25, -0.01], [0, 0, -s * 0.07]);
    add(Lg.foot, new T.IcosahedronGeometry(0.062, 0), steelL);
    add(Lg.foot, hull([[0.055, 0, -0.085], [0.06, -0.09, -0.098], [0.06, 0.03, 0.02], [0.066, -0.09, 0.12], [0.05, -0.03, 0.15], [0.036, -0.09, 0.245], [0.03, -0.055, 0.225], [0, 0.052, -0.02]]), steelD);
    add(Lg.foot, hull([[0.05, -0.012, 0.03], [0.054, -0.03, 0.15], [0, 0.01, 0.1], [0.05, -0.06, 0.03], [0.05, -0.06, 0.16]]), steelL, [0, 0.012, 0]);
    add(Lg.foot, box(0.05, 0.012, 0.012), pink, [0, -0.072, 0.238]);
  }

  // ---- the helm: a Corinthian helm of a machine, a T of light, a brush of hard light
  const helm = grp(head, null, 'helm');
  helm.scale.setScalar(0.94);
  add(spine, cyl(0.062, 0.1, 8), under, [0, B.neck - 0.04, 0]);
  add(helm, hull([[0, 0.31, -0.01], [0.07, 0.295, 0.02], [0.075, 0.29, -0.07], [0.118, 0.22, 0.03], [0.122, 0.2, -0.07], [0, 0.265, 0.11], [0.07, 0.25, 0.115], [0.115, 0.165, 0.085], [0.126, 0.13, -0.02], [0, 0.28, -0.12], [0.085, 0.23, -0.14], [0, 0.2, -0.172],
    [0.1, 0.13, -0.155], [0.108, 0.03, -0.165], [0, 0.01, -0.195], [0.118, 0.03, -0.07], [0.12, 0.165, 0.06], [0, 0.168, 0.128], [0.08, 0.166, 0.118]]), steel);
  add(helm, hull([[0, 0.196, 0.2], [0, 0.238, 0.135], [0.105, 0.21, 0.105], [0.11, 0.174, 0.1], [0, 0.174, 0.17], [0.065, 0.174, 0.146]]), steelL);
  for (const s of [1, -1]) {
    const c = add(helm, hull([[0.03, 0.147, 0.152], [0.112, 0.15, 0.1], [0.128, 0.14, 0.02], [0.13, 0.03, -0.03], [0.1, -0.045, 0.03], [0.045, -0.105, 0.118], [0.028, -0.092, 0.138], [0.028, 0.142, 0.158], [0.092, 0.02, 0.122], [0.102, 0.1, 0.116], [0.03, 0.14, 0.11], [0.03, -0.08, 0.1]], false), steel);
    c.scale.x = s;
  }
  add(helm, box(0.2, 0.26, 0.11), black, [0, 0.04, 0.062]);
  add(helm, box(0.215, 0.021, 0.02), visP, [0, 0.161, 0.119]);
  add(helm, box(0.1, 0.012, 0.022), visH, [0, 0.161, 0.12]);
  add(helm, box(0.024, 0.215, 0.02), visV, [0, 0.045, 0.121]);
  // the crest ridge and the brush
  let crestM;
  const C0 = { y: 0.14, z: -0.02, ry: 0.176, rz: 0.168 };
  const ridge = [];
  for (let i = 0; i <= 10; i++) {
    const ph = (38 + i * 13.4) * D;
    ridge.push([0, C0.y + C0.ry * Math.sin(ph), C0.z + C0.rz * Math.cos(ph)]);
  }
  add(helm, tube(ridge, 0.017, 5, 20), chrome, null, null, [1.25, 1, 1]);
  {
    const N = 30, pos = [], cl = [];
    const R = rng(5);
    const cRoot = col(0x7a2fe8, 1.5), cMid = col(0xe83cc0, 1.05), cTip = col(0xff6cc4, 1.3);
    const len = (t) => 0.11 + 0.23 * Math.sin(Math.min(1, t / 0.36) * Math.PI / 2) - 0.11 * Math.max(0, (t - 0.36) / 0.64);
    const pt = (ph, r, x) => [x, C0.y + (C0.ry + r) * Math.sin(ph), C0.z + (C0.rz + r) * Math.cos(ph)];
    for (const [xo, ls] of [[0, 1], [0.014, 0.93], [-0.014, 0.93]]) {
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N, tm = (t0 + t1) / 2;
        const p0 = (40 + 134 * t0) * D, p1 = (40 + 134 * t1) * D, pm = (p0 + p1) / 2;
        const a = pt(p0, 0.008, xo), b = pt(p1, 0.008, xo);
        const dir = pm + (16 + 30 * tm) * D;
        const L = len(tm) * ls * (0.9 + 0.2 * R());
        const base = pt(pm, 0.008, xo);
        const at = (k, w) => {
          const cy = base[1] + Math.sin(dir) * L * k, cz = base[2] + Math.cos(dir) * L * k;
          const ty = Math.cos(dir), tz = -Math.sin(dir); // across the filament
          const hw = (0.0105 + 0.006 * tm) * w;
          return [[xo * (1 + 1.6 * k), cy + ty * hw, cz + tz * hw], [xo * (1 + 1.6 * k), cy - ty * hw, cz - tz * hw]];
        };
        const [m0, m1] = at(0.55, 0.85), [e0, e1] = at(1, 0.12);
        const tri = (A, B2, C, ca, cb, cc) => { pos.push(...A, ...B2, ...C); cl.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); };
        tri(a, b, m1, cRoot, cRoot, cMid); tri(a, m1, m0, cRoot, cMid, cMid); tri(m0, m1, e1, cMid, cMid, cTip); tri(m0, e1, e0, cMid, cTip, cTip);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(cl, 3));
    crestM = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, toneMapped: false, fog: false }));
    crestM.position.set(0, C0.y, C0.z);
    g.translate(0, -C0.y, -C0.z);
    helm.add(crestM);
  }

  // ---- the cape: short, wine-dark, thrown back; it hangs from a hinge at the shoulders
  const capeG = grp(spine, [0, 0.335, -0.132]);
  {
    const U = 6, V = 9, pos = [], idx = [], R = rng(3);
    for (let j = 0; j <= V; j++) {
      for (let i = 0; i <= U; i++) {
        const u = i / U - 0.5, v = j / V;
        const x = u * (0.5 + 0.34 * v) + 0.03 * Math.sin(v * 5 + u * 3) * v;
        const y = 0.335 - 0.74 * v + 0.16 * v * v - (j === V ? 0.05 * R() : 0) + 0.02 * Math.cos(u * 9) * v;
        const z = -0.135 - 0.5 * Math.pow(v, 1.25) - 0.05 * Math.sin(u * 7 + v * 6) * v - 0.05 * (1 - Math.abs(u) * 2) * v;
        pos.push(x, y, z);
      }
    }
    for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) { const a = j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    flat.translate(0, -0.335, 0.132);
    add(capeG, flat, capeM);
    add(spine, box(0.36, 0.035, 0.03), chrome, [0, 0.335, -0.132]);
  }

  // ---- the aspis: +Z is its face
  const shield = grp(null, null, 'aspis');
  {
    const lathe = (pts, seg) => { const g = new T.LatheGeometry(pts.map((p) => new T.Vector2(p[0], p[1])), seg); g.rotateX(Math.PI / 2); return g; };
    add(shield, lathe([[0.365, 0], [0.365, 0.034], [0.2, 0.074], [0.001, 0.092]], 10), steelD);
    const rim = add(shield, lathe([[0.36, -0.012], [0.47, -0.012], [0.47, 0.022], [0.44, 0.048], [0.385, 0.052], [0.36, 0.028]], 40), std(0x9aa4cc, { metalness: 0.9, roughness: 0.3, flatShading: false }));
    rim.geometry.computeVertexNormals();
    add(shield, new T.TorusGeometry(0.352, 0.013, 6, 48), violet, [0, 0, 0.043]);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; add(shield, new T.IcosahedronGeometry(0.012, 0), chrome, [Math.cos(a) * 0.425, Math.sin(a) * 0.425, 0.054]); }
    const s = new T.Shape();
    [[0, 0.25], [0.2, -0.2], [0.115, -0.2], [0, 0.075], [-0.115, -0.2], [-0.2, -0.2]].forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
    const lg = new T.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false });
    const lc = [], lp = lg.attributes.position, c1 = col(0xff5fc0, 1.7), c2 = col(0xa259ff, 1.8);
    for (let i = 0; i < lp.count; i++) { const k = Math.min(1, Math.max(0, (lp.getY(i) + 0.2) / 0.45)); lc.push(c2.r + (c1.r - c2.r) * k, c2.g + (c1.g - c2.g) * k, c2.b + (c1.b - c2.b) * k); }
    lg.setAttribute('color', new T.Float32BufferAttribute(lc, 3));
    const lm = new T.Mesh(lg, new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }));
    lm.position.set(0, -0.02, 0.084);
    shield.add(lm);
    add(shield, new T.CircleGeometry(0.47, 24), steelD, [0, 0, -0.012], [0, Math.PI, 0]);
  }

  // ---- the dory: +Z runs to the point
  const spear = grp(null, null, 'dory'), pieces = [];
  {
    const TIP = 1.72, BUTT = 0.92, FROM = 1.28, CUT = 0.5;
    // its own copies of the materials: the spear alone is revealed by a moving plane when it is made again
    const sSteel = steelD.clone(), sChrome = chrome.clone(), sPink = pink.clone(), sHot = hot.clone();
    spear.userData.mats = [sSteel, sChrome, sPink, sHot];
    add(spear, rodZ(0.017, FROM + BUTT, 6), sSteel, [0, 0, (FROM - BUTT) / 2]);
    for (const z of [-0.62, -0.14, 0.14, 0.55, 1.0]) add(spear, rodZ(0.022, 0.03, 6), sChrome, [0, 0, z]);
    add(spear, rodZ(0.001, 0.14, 6, 0.022), sChrome, [0, 0, -BUTT - 0.07]);
    add(spear, rodZ(0.03, 0.05, 6, 0.02), sChrome, [0, 0, FROM - 0.01]);
    add(spear, box(0.1, 0.014, 0.018), sChrome, [0, 0, FROM + 0.012]);
    const blade = (w, k) => { const g = new T.LatheGeometry([new T.Vector2(0.001, 0), new T.Vector2(w, 0.11), new T.Vector2(w * 0.75, 0.2), new T.Vector2(0.001, TIP - FROM)], 4); g.rotateX(Math.PI / 2); g.scale(1, k, 1); return g; };
    add(spear, blade(0.058, 0.3), sPink, [0, 0, FROM + 0.01]);
    add(spear, blade(0.03, 0.42), sHot, [0, 0, FROM + 0.03], null, [1, 1, 0.86]);
    Object.assign(spear.userData, { tip: TIP, butt: BUTT, from: FROM });
    // the hologram it is projected as before it turns solid: its edges in light, and a ring where the scan runs
    const holo = grp(spear, null, 'holo'), hm = new T.LineBasicMaterial({ color: new T.Color(2.6, 0.7, 2.0), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    spear.children.slice().forEach((m) => { if (m.isMesh) { const l = new T.LineSegments(new T.EdgesGeometry(m.geometry, 20), hm); l.position.copy(m.position); l.quaternion.copy(m.quaternion); l.scale.copy(m.scale); holo.add(l); } });
    for (let i = 0; i < 9; i++) { const r = new T.Mesh(new T.RingGeometry(0.024, 0.03, 6), new T.MeshBasicMaterial({ color: new T.Color(1.8, 0.5, 1.5), side: T.DoubleSide, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); r.position.z = -BUTT + ((TIP + BUTT) * (i + 0.5)) / 9; holo.add(r); }
    const scan = add(holo, new T.RingGeometry(0.02, 0.085, 24), new T.MeshBasicMaterial({ color: new T.Color(3, 2.2, 3), side: T.DoubleSide, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
    scan.castShadow = false; holo.visible = false;
    const plane = new T.Plane();
    /** k: null = an ordinary solid spear; 0…1 = how much of it the scan has made solid, with `flick` 0…1 for the hologram's light. */
    spear.userData.holo = (k, flick) => {
      const on = k !== null && k !== undefined;
      holo.visible = on && flick > 0.02;
      spear.userData.mats.forEach((m) => (m.clippingPlanes = on && k < 0.999 ? [plane] : null));
      spear.traverse((o) => { if (o.userData.outline) o.visible = !(on && k < 0.999); }); // its dark contour comes with the solid, not before
      if (!on) return;
      spear.updateWorldMatrix(true, false);
      const d = v3(0, 0, 1).applyQuaternion(spear.getWorldQuaternion(new T.Quaternion())), s = -BUTT - 0.16 + (TIP + BUTT + 0.2) * k;
      plane.setFromNormalAndCoplanarPoint(d.clone().negate(), spear.localToWorld(v3(0, 0, s)));
      hm.color.setRGB(2.6 * flick, 0.7 * flick, 2.0 * flick);
      scan.position.set(0, 0, s); scan.visible = k > 0.001 && k < 0.999; scan.material.color.setRGB(3 * flick + 1, 2.2 * flick + 0.6, 3 * flick + 1);
    };
    // what is left of it after Luna's cut: the head with a stub of shaft, and the rest
    const piece = (front) => {
      const g = grp(null), c = front ? (FROM + CUT) / 2 + 0.1 : (CUT - BUTT) / 2;
      if (front) {
        add(g, rodZ(0.017, FROM - CUT, 6), steelD, [0, 0, (FROM + CUT) / 2 - c]);
        add(g, rodZ(0.03, 0.05, 6, 0.02), chrome, [0, 0, FROM - 0.01 - c]);
        add(g, box(0.1, 0.014, 0.018), chrome, [0, 0, FROM + 0.012 - c]);
        add(g, blade(0.058, 0.3), pink, [0, 0, FROM + 0.01 - c]);
      } else {
        add(g, rodZ(0.017, BUTT + CUT, 6), steelD, [0, 0, (CUT - BUTT) / 2 - c]);
        for (const z of [-0.62, -0.14, 0.14]) add(g, rodZ(0.022, 0.03, 6), chrome, [0, 0, z - c]);
        add(g, rodZ(0.001, 0.14, 6, 0.022), chrome, [0, 0, -BUTT - 0.07 - c]);
      }
      g.userData.c = c; g.visible = false;
      return g;
    };
    pieces.push(piece(true), piece(false));
  }

  /**
   * Stand him in a pose. Feet are [worldX, y, sideLocal, yaw, pitch] so a planted foot stays put while the body travels;
   * everything else is in his own frame (x = his left, z = forward).
   */
  function apply(p) {
    root.position.set(p.x, 0, p.z || 0);
    root.rotation.set(0, Math.PI / 2 + (p.yaw || 0), 0);
    hips.position.set(p.hip[0], p.hip[1], p.hip[2]);
    hips.rotation.set(p.hipPitch || 0, p.hipYaw, p.hipRoll || 0, 'YXZ');
    spine.rotation.set(p.spine[0], p.spine[1], p.spine[2], 'YXZ');
    head.rotation.set(p.head[0], p.head[1], 0, 'YXZ');
    capeG.rotation.x = p.cape || 0;
    crestM.scale.set(1, p.crest ?? 1, p.crest ?? 1);
    const v = p.visor ?? 1;
    visP.color.copy(visP0).multiplyScalar(v); visH.color.copy(visH0).multiplyScalar(v); visV.color.copy(visV0).multiplyScalar(v);
    root.updateWorldMatrix(true, true);
    const qR = root.getWorldQuaternion(new T.Quaternion());
    const P = (x, y, z) => root.localToWorld(v3(x, y, z));
    const Dn = (x, y, z) => v3(x, y, z).applyQuaternion(qR).normalize();
    const foot = (Lg, f, pole) => {
      ik2(Lg.up, Lg.lo, B.thigh, B.shin, P(f[2], f[1], f[0] - p.x), Dn(pole, 0, 1));
      setWorldQuat(Lg.foot, qR.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(f[4] || 0, f[3] || 0, 0, 'YXZ'))));
    };
    foot(legR, p.fR, p.kneeR); foot(legL, p.fL, p.kneeL);
    // the aspis rides the right forearm: elbow behind its centre, fist at the rim
    const N = Dn(p.shN[0], p.shN[1], p.shN[2]), C = P(p.shC[0], p.shC[1], p.shC[2]);
    const across = v3().crossVectors(v3(0, 1, 0), N).normalize(), upS = v3().crossVectors(N, across).normalize();
    const Sh = armR.up.getWorldPosition(v3()), E = C.clone().addScaledVector(N, -0.075), ev = E.clone().sub(Sh);
    if (ev.length() > B.upper * 0.97) { E.copy(Sh).add(ev.setLength(B.upper * 0.97)); C.copy(E).addScaledVector(N, 0.075); }
    const H = E.clone().addScaledVector(across, 0.3);
    ik2(armR.up, armR.lo, B.upper, B.fore, H, E.clone().sub(Sh));
    shield.position.copy(root.worldToLocal(C.clone()));
    shield.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(across, upS, N)).premultiply(qR.clone().invert());
    shield.rotateZ(p.shRoll || 0);
    // the spear arm: to the grip while he holds it, to a free target otherwise
    const G = P(p.spG[0], p.spG[1], p.spG[2]);
    ik2(armL.up, armL.lo, B.upper, B.fore, G, Dn(p.elbL[0], p.elbL[1], p.elbL[2]));
    const sdir = Dn(p.spD[0], p.spD[1], p.spD[2]);
    orientGrip(armL.hand, armL.lo, sdir);
    if (p.spHold > 0.5) {
      spear.quaternion.setFromUnitVectors(v3(0, 0, 1), sdir);
      spear.position.copy(armL.hand.localToWorld(v3(0, -FIST_Y * HS, 0))); // through the fist
    }
    root.updateWorldMatrix(true, true);
  }
  root.add(shield);
  shield.scale.setScalar(0.9);
  return { root, apply, B, spear, pieces, shield, parts: { hips, spine, head, armL, armR, legL, legR } };
}
