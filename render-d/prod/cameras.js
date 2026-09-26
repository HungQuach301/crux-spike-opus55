'use strict';
// Test D M2 camera plan (preprod/shotlist.json gives size, angle, focal, move and why). Per scene: focal length (35 mm
// equivalent), base offset and moves. A move changes the camera position and/or target by a delta (world px) with
// inertia: a small anticipation against the direction, an eased main travel, a 2-4% overshoot that settles. Moves start
// >= 0.6 s after the cut and end >= 0.6 s before the next cut, so every move is framed by rest. Racks move the focus
// plane (world z) and sit on declared story turns (timeline.turns).
(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  // progress with anticipation (-1.5 %) and overshoot (+3 %), exactly 0 at p<=0 and 1 at p>=1
  function inertia(p) {
    p = clamp(p);
    const s = p * p * p * (p * (6 * p - 15) + 10);
    const ant = p < 0.28 ? -0.015 * Math.sin(Math.PI * p / 0.28) : 0;
    const ovs = p > 0.62 ? 0.03 * Math.sin(Math.PI * (p - 0.62) / 0.38) : 0;
    return s + ant + ovs;
  }
  const rackEase = (p) => { p = clamp(p); return p * p * (3 - 2 * p); };
  // moves: [at (s after cut), dur, {x,y,z (position delta), tx,ty (target delta)}]; racks: [at, dur, focus plane z]
  const CAM = {
    'co-lines': { f: 24, base: { y: 120, z: -300, ty: 60 }, moves: [[0.5, 1.0, { y: -120, z: 150, ty: -60 }]] },
    'co-same': { f: 35, base: { z: 0 }, moves: [[0.6, 2.4, { z: 150 }]] },
    'co-broke': { f: 50, base: { x: 0 }, moves: [[0.6, 1.6, { x: 700, tx: 700 }]] },
    'co-question': { f: 85, base: {}, focus: -260, racks: [[0.15, 0.8, 380]] },
    ident: { f: 50, base: { z: -200 }, moves: [[0.6, 1.2, { z: 180 }]] },
    'a1-est': { f: 24, base: { y: -300, ty: -120 }, moves: [[0.6, 1.8, { y: 300, ty: 120 }]], focus: 300 },
    'a1-start': { f: 50, base: { z: -300 }, moves: [[0.6, 1.4, { z: 260 }]] },
    'a1-who': { f: 35, base: { x: 200, tx: 200, y: 100 }, moves: [[0.6, 2.0, { x: -200, tx: -200 }]] },
    'a1-hook': { f: 35, base: { z: 300 }, moves: [[0.6, 2.0, { z: -300 }]] },
    'a1-hook-b': { f: 24, base: { z: -200, y: -120, ty: -60 }, moves: [[0.6, 1.8, { z: -250 }]] },
    'a1-mix': { f: 50, base: { x: -260 }, moves: [[0.6, 1.8, { x: 260, z: 60 }]] },
    'a1-assets': { f: 85, base: { z: 200 }, moves: [[0.6, 1.2, { z: -200 }]] },
    'a1-rebal': { f: 50, base: {} },
    'a1-rule': { f: 50, base: { z: -250 }, moves: [[0.6, 1.2, { z: 220 }]] },
    'a1-raise': { f: 35, base: { y: 160, ty: 100 }, moves: [[0.6, 2.0, { y: -160, ty: -100 }]] },
    'a1-real': { f: 85, base: {}, focus: -250, racks: [['turn', 0.8, 300]] },
    'a1-horizon': { f: 24, base: { x: -450, tx: -450 }, moves: [[0.7, 1.7, { x: 900, tx: 900 }]] },
    'a1-notax': { f: 50, base: {} },
    'a1-mirror-in': { f: 35, base: { x: -150 }, moves: [[0.6, 1.4, { x: 150 }]], focus: -150, racks: [['turn', 0.8, 250]] },
    'a1-mirror-rule': { f: 50, base: { x: 250, tx: 250 }, moves: [[0.6, 1.6, { x: -250, tx: -250 }]] },
    'a1-illus': { f: 85, base: { z: 150 }, moves: [[0.6, 1.0, { z: -150 }]], focus: 0 },
    'a1-samewd': { f: 50, base: { y: -100, ty: -60 }, moves: [[0.6, 1.4, { y: 100, ty: 60 }]] },
    'a1-question': { f: 35, base: { z: 250 }, moves: [[0.6, 1.6, { z: -250 }]] },
    'a1-avg1966': { f: 85, base: { z: -150 }, moves: [[0.6, 1.0, { z: 150 }]], focus: 150 },
    'a1-avgmirror': { f: 85, base: {}, focus: 150, racks: [['turn', 0.8, -300]] },
    'a1-geo': { f: 50, base: { x: 200 }, moves: [[0.6, 1.8, { x: -200, z: 80 }]] },
    'a1-arith': { f: 50, base: { x: -200, tx: -200 }, moves: [[0.6, 1.6, { x: 200, tx: 200 }]] },
    'a1-payoff': { f: 35, base: { z: 200 }, moves: [[0.6, 2.0, { z: -200 }]] },
  };
  const APERTURE = 14; // world units: background (far wall) circle of confusion 6-10 px across the focal lengths used

  // a split shot (-b/-c) of a long line: a cut to another focal length at the parent's end pose, held still
  const OTHER = { 24: 35, 35: 50, 50: 35, 85: 50 };
  function spec(id) {
    if (CAM[id]) return CAM[id];
    const p = CAM[id.replace(/-[bc]$/, '')];
    if (!p) return { f: 50, base: {} };
    const b = { x: 0, y: 0, z: 0, tx: 0, ty: 0, ...p.base };
    for (const [, , d] of p.moves || []) for (const k of Object.keys(d)) b[k] += d[k];
    let focus = p.focus ?? 0;
    for (const r of p.racks || []) focus = r[2];
    return { f: OTHER[p.f] || 50, base: b, focus };
  }
  function fovOf(f) { return 2 * Math.atan(12 / f) * 180 / Math.PI; }
  // camera at scene-local time L; turnAt: scene-local time of the scene's declared turn (for racks marked 'turn')
  function cameraAt(id, L, dur, turnAt) {
    const s = spec(id);
    const fov = fovOf(s.f);
    const Dz = 540 / Math.tan(fov * Math.PI / 360);
    const b = { x: 0, y: 0, z: 0, tx: 0, ty: 0, ...s.base };
    for (const [at, d, delta] of s.moves || []) {
      const t0 = Math.max(0.6, at), d1 = Math.min(d, dur - 0.6 - t0);
      if (d1 < 0.4) continue;
      const u = inertia((L - t0) / d1);
      for (const k of Object.keys(delta)) b[k] += delta[k] * u;
    }
    const pos = [960 + b.x, 540 + b.y, -Dz + b.z];
    const target = [960 + (b.tx || 0), 540 + (b.ty || 0), 0];
    let fz = s.focus ?? 0;
    for (const [at, d, z] of s.racks || []) {
      const t0 = at === 'turn' ? Math.max(0.1, (turnAt ?? 0.5) - d / 2) : at;
      fz += (z - fz) * rackEase((L - t0) / d);
    }
    const focusDist = Math.max(100, fz - pos[2]);
    return { pos, target, fovDeg: fov, focusDist, aperture: APERTURE };
  }
  // seconds of camera move at the scene start (timeline `move`): the first move if it starts within 0.8 s
  function moveSeconds(id, dur) {
    const s = spec(id);
    const m = (s.moves || [])[0];
    if (!m) return 0;
    const t0 = Math.max(0.6, m[0]), d1 = Math.min(m[1], dur - 0.6 - t0);
    return d1 >= 0.4 && t0 <= 0.8 ? +(t0 + d1).toFixed(2) : 0;
  }
  const api = { CAM, cameraAt, moveSeconds, fovOf, spec, inertia };
  if (typeof window !== 'undefined') window.CAMS = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
