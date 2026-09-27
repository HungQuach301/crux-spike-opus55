'use strict';
// Act 3 builders: from one start year (1966) to all 69 (1928..1996). Recurring charts:
//  (1) the start-year map: 69 tiles, one row per decade (1920s..1990s), one column per year digit; fill = outcome
//      (ran out = loss, ended below the start after inflation = muted, ended above = gain); every tile carries meta.year;
//  (2) end balance by start year (69 bars) and the 30-year real average as a dot strip / scatter vs end balance;
//  (3) first-decade real average return bars (realGeo10);
//  (4) the answer card; (5) the limits as a clean list with small flat icons.
(function () {
  const { B, K } = window.SCENES;
  const { D, C, M, clamp, smooth, easeOut, back, fade, fadeOut, cueAbs, lineStart, S, Tx, L1, claim, badge, env, axisX, series, charShape, colorOf } = K;
  const ST = M.starts; // 69 start years
  const byY = Object.fromEntries(ST.map((s) => [s.y, s]));
  const FAIL = ST.filter((s) => s.depleted).map((s) => s.y); // 1965 1966 1968 1969
  const outcome = (s) => (s.depleted ? 'loss' : s.less ? 'less' : 'gain');
  const outColor = { loss: C.loss, less: C.muted, gain: C.gain };
  // scene-local time of a spoken word (fallback: sentence start + offset)
  const cue = (H, sid, w, off = 0.5) => { try { return H.local(cueAbs(sid, w)); } catch (e) { try { return H.local(lineStart(sid) + off); } catch (e2) { return 0.5; } } };
  const at = (L, t) => (L >= t - 1 / 60 ? 1 : 0);
  const CAM = window.CAMS.CAM;

  // ------------------------------------------------------------------ (1) the start-year map
  const MG = { x0: 120, y0: 250, w: 78, h: 50, gx: 14, gy: 40, z: 0 };
  function tileRect(y, g) { const row = Math.floor(y / 10) - 192, col = y % 10; return [g.x0 + col * (g.w + g.gx), g.y0 + row * (g.h + g.gy), g.w, g.h]; }
  // o: { g, color(s, i) -> token, alpha(s, i), dz(s, i) (z offset), pop(s, i) (0..1 scale-in) }
  function startMap(items, panel, o = {}) {
    const g = { ...MG, ...(o.g || {}) };
    ST.forEach((s, i) => {
      const [x, y, w, h] = tileRect(s.y, g);
      const p = o.pop ? o.pop(s, i) : 1;
      const k = 0.4 + 0.6 * p, dz = o.dz ? o.dz(s, i) : 0;
      const col = o.color ? o.color(s, i) : C['surface-2'];
      const is66 = col === C.c1966;
      items.push(S(`${panel}-y${s.y}`, 'rect', { panel, z: g.z + dz, rect: [x + w * (1 - k) / 2, y + h * (1 - k) / 2, w * k, h * k], radius: 7, fill: col,
        alpha: (o.alpha ? o.alpha(s, i) : 1) * clamp(p * 3), meta: { role: 'mark', panel, chart: panel, year: s.y, ...(is66 ? charShape('1966') : {}) } }));
    });
    return g;
  }
  // screen point under a tile (for its label), label text baseline
  const under = (H, y, g, dz = 0) => { const [x, yy, w, h] = tileRect(y, g); return H.P(x + w / 2, yy + h + 30, g.z + dz); };
  // legend swatches drawn as screen-aligned squares via world rects at z = 0 (positions given in world units)
  function legendW(items, panel, x, y, a, rows) {
    rows.forEach(([col, s], i) => {
      items.push(S(`${panel}-lg${i}`, 'rect', { panel, z: 0, rect: [x, y + i * 56 - 26, 30, 30], radius: 6, fill: col, alpha: a, meta: { role: 'mark', panel } }));
    });
  }

  // ------------------------------------------------------------------ scenes
  B['a3-est'] = (L, sc, H) => {
    const items = []; env(items, 'a3-est', { glow: 0.10, gx: 960 });
    const t66 = cue(H, 'a3-est.1', '1966', 0.3);
    const g = { x0: 506, y0: 330, z: 200 };
    // the 1966 tile is lit first, then the other 68 start years appear around it, rippling out from 1966
    startMap(items, 'a3-est', { g, color: (s) => (s.y === 1966 ? C.c1966 : C['surface-2']), pop: (s) => (s.y === 1966 ? easeOut((L - 0.2) / 0.4) : easeOut((L - 1.6 - Math.abs(s.y - 1966) * 0.035) / 0.4)) });
    items.push(L1('a3-est-l1', 'Was 1966 a fluke?', 960, 170, 72, at(L, t66), { claims: [claim('y1966')] }));
    return items;
  };
  CAM['a3-est'] = { f: 24, base: { y: -420, ty: -200, z: -150 }, moves: [[0.7, 1.5, { y: 420, ty: 200, z: 150 }]], focus: 200 };

  B['a3-all'] = (L, sc, H) => {
    const items = []; env(items, 'a3-all', { glow: 0.09, gx: 1500 });
    const t28 = cue(H, 'a3-all.1', '1928', 3), t96 = cue(H, 'a3-all.1', '1996', 5.5), t69 = cue(H, 'a3-all.2', '69', 7);
    // the tiles fill in year order while the voice walks from 1928 to 1996
    const g = startMap(items, 'a3-all', { g: { x0: 120, y0: 230 }, color: (s) => (s.y === 1966 ? C.c1966 : C['surface-2']),
      pop: (s, i) => easeOut((L - (t28 - 0.1) - i * (t96 - t28) / 68) / 0.3) });
    const p28 = under(H, 1928, g), p96 = under(H, 1996, g);
    items.push(Tx('a3-all-28', '1928', p28[0], p28[1], 30, C.text, { align: 'center', alpha: at(L, t28), claims: [claim('y1928')], year: 1928 }));
    items.push(Tx('a3-all-96', '1996', p96[0], p96[1], 30, C.text, { align: 'center', alpha: at(L, t96), claims: [claim('y1996')], year: 1996 }));
    items.push(L1('a3-all-l1', 'Every start year', 1340, 360, 64, fade(L, 0.3) * fadeOut(L, t69 - 0.3, 0.25)));
    items.push(Tx('a3-all-sub', 'same rules, same mix, same withdrawals', 1340, 450, 32, C['text-dim'], { align: 'center', alpha: fade(L, 1.0), level: 2 }));
    items.push(L1('a3-all-69', '69 retirements', 1340, 360, 64, at(L, t69), { claims: [claim('n69')] }));
    return items;
  };
  CAM['a3-all'] = { f: 35, base: { x: 260, tx: 260, z: -100 }, moves: [[0.8, 1.5, { x: -260, tx: -260, z: 100 }]] };

  B['a3-q'] = (L, sc, H) => {
    const items = []; env(items, 'a3-q', { glow: 0.12, gx: 960 });
    // the map recedes behind the question (out of focus: context, not content)
    startMap(items, 'a3-q', { g: { x0: 506, y0: 260, z: 900 }, color: (s) => (s.y === 1966 ? C.c1966 : C['surface-2']), alpha: () => 0.9 });
    items.push(S('a3-q-card', 'rect', { panel: 'a3-q', z: 0, rect: [420, 380, 1080, 320], radius: 24, fill: C.surface, alpha: fade(L, 0.1, 0.3), shadow: { alpha: 0.5, blur: 60, dy: 30 }, meta: { role: 'card', panel: 'a3-q' } }));
    items.push(Tx('a3-q-k', 'The question for this part', 960, 470, 34, C['text-dim'], { align: 'center', alpha: fade(L, 0.3), level: 2 }));
    items.push(L1('a3-q-l1', 'What decides the outcome?', 960, 580, 64, fade(L, cue(H, 'a3-q.1', 'what', 1) - 0.1, 0.3)));
    return items;
  };
  CAM['a3-q'] = { f: 50, base: { z: -380 }, moves: [[0.7, 1.4, { z: 380 }]], focus: 0 };

  B['a3-fine'] = (L, sc, H) => {
    const items = []; env(items, 'a3-fine', { glow: 0.09, gx: 400 });
    const tNever = cue(H, 'a3-fine.1', 'never', 1.2), t65 = cue(H, 'a3-fine.2', '65', 3.8), t69 = cue(H, 'a3-fine.2', '69', 4.4);
    // outcome sweep, year by year: the money lasted (gain) or ran out (loss)
    const g = startMap(items, 'a3-fine', { g: { x0: 800, y0: 250 }, color: (s, i) => (L < tNever - 0.3 + i * 0.03 ? C['surface-2'] : s.depleted ? C.loss : C.gain),
      dz: (s) => (s.depleted ? -60 * smooth((L - t65) / 0.6) : 0) });
    void g;
    items.push(L1('a3-fine-l1', 'Most never ran out', 560, 360, 60, fade(L, 0.3) * fadeOut(L, t65 - 0.3, 0.25)));
    items.push(L1('a3-fine-65', '65', 560, 360, 120, at(L, t65), { claims: [claim('n65')], color: C.gain }));
    items.push(Tx('a3-fine-of', 'of 69 start years', 560, 480, 40, C.text, { align: 'center', alpha: at(L, t69), claims: [claim('n69')], level: 2 }));
    items.push(Tx('a3-fine-sub', 'the money lasted to the end', 560, 540, 32, C['text-dim'], { align: 'center', alpha: fade(L, t69 + 0.3), level: 3 }));
    legendW(items, 'a3-fine', 196, 780, fade(L, tNever), [[C.gain, ''], [C.loss, '']]);
    const q0 = H.P(240, 780 - 2, 0), q1 = H.P(240, 836 - 2, 0);
    items.push(Tx('a3-fine-lgA', 'money lasted', q0[0], q0[1], 30, C['text-dim'], { alpha: fade(L, tNever), level: 3 }));
    items.push(Tx('a3-fine-lgB', 'ran out', q1[0], q1[1], 30, C['text-dim'], { alpha: fade(L, tNever), level: 3 }));
    return items;
  };
  CAM['a3-fine'] = { f: 35, base: { z: -300, x: 200, tx: 200 }, moves: [[0.8, 1.5, { z: 300, x: -200, tx: -200 }]] };

  // (2a) end balance by start year: 69 bars on a zero baseline (value = endReal, same scale for every bar)
  function endBars(items, panel, L, o) {
    const x0 = o.x0 ?? 170, step = o.step ?? 23, bw = o.bw ?? 17, yb = o.yb ?? 920, k = o.k ?? 440 / 5.4e6;
    ST.forEach((s, i) => {
      const gr = o.grow ? o.grow(s, i) : 1, h = s.endReal * k;
      items.push(S(`${panel}-e${s.y}`, 'rect', { panel, z: 0, rect: [x0 + i * step, yb - Math.max(3, h * gr), bw, Math.max(3, h * gr)], radius: 2, fill: o.color(s, i), alpha: o.alpha ? o.alpha(s, i) : 1,
        meta: { role: 'bar', panel, chart: panel, value: s.endReal, full: gr >= 1 && h >= 3, orient: 'v', year: s.y } }));
    });
    items.push(S(panel + '-base', 'polyline', { panel, z: 0, pts: [[x0 - 10, yb], [x0 + 69 * step, yb]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel, chart: panel } }));
    return { x0, step, bw, yb, k };
  }
  B['a3-good'] = (L, sc, H) => {
    const items = []; env(items, 'a3-good', { glow: 0.10, gx: 1400 });
    const t82 = cue(H, 'a3-good.1', '1982', 2.5), tM = cue(H, 'a3-good.1', '$5.36 million', 6);
    const g = endBars(items, 'a3-good', L, { grow: (s, i) => smooth((L - 0.4 - i * 0.025) / 0.6), color: (s) => (s.y === 1982 ? C.gain : s.depleted ? C.loss : s.less ? C.muted : C.gain),
      alpha: (s) => (s.y === 1982 || L < t82 ? 1 : 1 - 0.55 * smooth((L - t82) / 0.5)) });
    const i82 = 1982 - 1928, x82 = g.x0 + i82 * g.step + g.bw / 2, top82 = g.yb - byY[1982].endReal * g.k;
    const p = H.P(x82, top82 - 26, 0);
    items.push(Tx('a3-good-82', '1982', p[0], p[1], 34, C.text, { align: 'center', weight: 700, alpha: at(L, t82), claims: [claim('y1982')], year: 1982 }));
    items.push(Tx('a3-good-cap', 'what was left at the end, by start year, after inflation', 170, 1000, 30, C['text-dim'], { alpha: fade(L, 1.0), level: 3 }));
    items.push(L1('a3-good-l1', 'Same rules, a fortune', 640, 360, 60, fade(L, 0.3) * fadeOut(L, tM - 0.3, 0.25)));
    items.push(L1('a3-good-m', '$5.36 million', 640, 330, 88, at(L, tM), { claims: [claim('end1982')], color: C.text }));
    items.push(Tx('a3-good-basis', 'in 1982 dollars, left at the end', 640, 430, 34, C['text-dim'], { align: 'center', alpha: at(L, tM), claims: [claim('y1982')], level: 2 }));
    return items;
  };
  CAM['a3-good'] = { f: 85, base: { x: -300, tx: -300, z: 250 }, moves: [[0.8, 1.5, { x: 300, tx: 300, z: -250 }]] };

  B['a3-1929'] = (L, sc, H) => {
    const items = []; env(items, 'a3-1929', { glow: 0.08, gx: 1500 });
    const t29 = cue(H, 'a3-1929.1', '1929', 2.2), tNever = cue(H, 'a3-1929.1', 'never', 4.5);
    const tDec = cue(H, 'a3-1929.2', 'decade', 12), t39 = cue(H, 'a3-1929.2', '3.9%', 13.5);
    const g = startMap(items, 'a3-1929', { g: { x0: 100, y0: 250 }, color: (s) => (s.y === 1929 ? (L >= tNever - 0.2 ? C.gain : C['surface-2']) : s.depleted ? C.loss : C.gain),
      alpha: (s) => (s.y === 1929 ? 1 : 1 - 0.45 * smooth((L - t29) / 0.5)), dz: (s) => (s.y === 1929 ? -120 * smooth((L - t29) / 0.5) : 0) });
    const tr = tileRect(1929, g), p = H.P(tr[0] + tr[2] / 2, tr[1] - 22, -120 * smooth((L - t29) / 0.5));
    items.push(Tx('a3-1929-y', '1929', p[0], p[1], 34, C.text, { align: 'center', weight: 700, alpha: at(L, t29), claims: [claim('y1929')], year: 1929 }));
    items.push(L1('a3-1929-l1', 'The crash year', 1340, 360, 56, fade(L, t29 - 0.1, 0.3) * fadeOut(L, tNever + 0.9, 0.3)));
    items.push(L1('a3-1929-l1b', 'Never ran out', 1340, 360, 56, fade(L, tNever + 1.2, 0.3) * fadeOut(L, t39 - 0.3, 0.25), { color: C.text }));
    // first-decade real average return of 1929: one bar on a zero line, grows when the decade is named
    const x0 = 1150, yb = 800, k = 2600; // px per unit of return (39 pp -> ~100 px)
    const v = byY[1929].realGeo10, gr = smooth((L - tDec) / 0.8);
    items.push(S('a3-1929-zero', 'polyline', { panel: 'a3-1929', z: 0, pts: [[x0 - 40, yb], [x0 + 450, yb]], stroke: C.muted, lw: 2, alpha: fade(L, tDec - 1), meta: { role: 'axis', panel: 'a3-1929', chart: 'a3-1929-dec' } }));
    items.push(S('a3-1929-bar', 'rect', { panel: 'a3-1929', z: 0, rect: [x0, yb - v * k * gr, 160, Math.max(2, v * k * gr)], radius: 4, fill: C.gain, alpha: fade(L, tDec - 1),
      meta: { role: 'bar', panel: 'a3-1929', chart: 'a3-1929-dec', value: v, full: gr >= 1, orient: 'v', year: 1929 } }));
    const q = H.P(x0 + 80, yb - v * k - 24, 0);
    items.push(Tx('a3-1929-39', '3.9%', q[0], q[1], 56, C.text, { align: 'center', weight: 700, alpha: at(L, t39), claims: [claim('dec1929')], level: 2 }));
    const c = H.P(x0 - 40, yb + 56, 0);
    items.push(Tx('a3-1929-cap', 'first decade, after inflation, per year', c[0], c[1], 30, C['text-dim'], { alpha: fade(L, tDec - 0.6), level: 3 }));
    items.push(Tx('a3-1929-pr', 'prices fell, so the withdrawals shrank', 1340, 460, 32, C['text-dim'], { align: 'center', alpha: fade(L, cue(H, 'a3-1929.2', 'prices', 7) - 0.1) * fadeOut(L, t39 - 0.3), level: 3 }));
    items.push(L1('a3-1929-l1c', 'A mild first decade', 1340, 360, 56, fade(L, t39 - 0.2, 0.3)));
    return items;
  };
  CAM['a3-1929'] = { f: 50, base: { z: 150 }, moves: [[0.8, 1.4, { z: -300 }]] };

  B['a3-nohurt'] = (L, sc, H) => {
    const items = []; env(items, 'a3-nohurt', { glow: 0.10, gx: 400 });
    // a wave runs through every start year that ended above its start: order did them no harm
    const tNo = cue(H, 'a3-nohurt.1', 'harm', 3);
    startMap(items, 'a3-nohurt', { g: { x0: 840, y0: 240 }, color: (s) => (s.depleted ? C.loss : C.gain),
      dz: (s, i) => (s.depleted || s.less ? 0 : -60 * Math.sin(Math.PI * clamp((L - 0.8 - i * 0.04) / 0.8))),
      alpha: (s) => (s.depleted ? 1 - 0.4 * smooth((L - tNo) / 0.5) : 1) });
    items.push(L1('a3-nohurt-l1', 'Order did no harm', 560, 360, 64, fade(L, 0.3)));
    items.push(Tx('a3-nohurt-sub', 'for many start years', 560, 450, 34, C['text-dim'], { align: 'center', alpha: fade(L, 0.6), level: 2 }));
    return items;
  };
  CAM['a3-nohurt'] = { f: 35, base: { y: -300, ty: -140 }, moves: [[0.7, 1.4, { y: 300, ty: 140 }]] };

  B['a3-less'] = (L, sc, H) => {
    const items = []; env(items, 'a3-less', { glow: 0.09, gx: 1500 });
    const t26 = cue(H, 'a3-less.2', '26', 3.6), t69 = cue(H, 'a3-less.2', '69', 4.3), tIn = cue(H, 'a3-less.2', 'inflation', 7);
    // survivors that ended below their starting balance (after inflation) turn muted, one by one
    startMap(items, 'a3-less', { g: { x0: 120, y0: 250 }, color: (s, i) => (s.depleted ? C.loss : s.less && L >= t26 - 0.8 + i * 0.012 ? C.muted : C.gain) });
    items.push(L1('a3-less-l1', 'Lasting is not thriving', 1340, 360, 60, fade(L, 0.2) * fadeOut(L, t26 - 0.3, 0.25)));
    items.push(L1('a3-less-26', '26', 1340, 360, 120, at(L, t26), { claims: [claim('n26')], color: C.text }));
    items.push(Tx('a3-less-of', 'of 69 ended below their start', 1340, 480, 36, C.text, { align: 'center', alpha: at(L, t69), claims: [claim('n69')], level: 2 }));
    items.push(Tx('a3-less-inf', 'after inflation', 1340, 536, 32, C['text-dim'], { align: 'center', alpha: fade(L, tIn - 0.1), level: 3 }));
    legendW(items, 'a3-less', 1240, 720, fade(L, t26 + 0.4), [[C.gain, ''], [C.muted, ''], [C.loss, '']]);
    ['above the start', 'below the start', 'ran out'].forEach((s, i) => {
      const q = H.P(1286, 720 + i * 56 - 1, 0);
      items.push(Tx('a3-less-lg' + i, s, q[0], q[1], 30, C['text-dim'], { alpha: fade(L, t26 + 0.4), level: 3 }));
    });
    return items;
  };
  CAM['a3-less'] = { f: 35, base: { z: -250, x: 150, tx: 150 }, moves: [[0.7, 1.5, { z: 250, x: -150, tx: -150 }]] };

  // the four that ran out rise out of the map
  function fourMap(items, panel, L, H, g, lift, dimOthers) {
    return startMap(items, panel, { g, color: (s) => (s.depleted ? C.loss : s.less ? C.muted : C.gain),
      alpha: (s) => (s.depleted ? 1 : 1 - 0.5 * dimOthers), dz: (s, i) => (s.depleted ? -60 * lift(s) : 0) });
  }
  B['a3-four'] = (L, sc, H) => {
    const items = []; env(items, 'a3-four', { glow: 0.09, gx: 400 });
    const t4 = cue(H, 'a3-four.1', '4', 0.2), t65 = cue(H, 'a3-four.1', '1965', 4), t66 = cue(H, 'a3-four.1', '1966', 5);
    const lift = (s) => smooth((L - (s.y === 1965 ? t65 : s.y === 1966 ? t66 : t4 + 0.4) + 0.2) / 0.5);
    const g = fourMap(items, 'a3-four', L, H, { x0: 820, y0: 260 }, lift, smooth((L - t4) / 0.6));
    for (const [y, t, cl] of [[1965, t65, 'y1965'], [1966, t66, 'y1966']]) {
      const p = under(H, y, g, -60 * lift(byY[y]));
      items.push(Tx('a3-four-' + y, String(y), p[0], p[1] + 6, 32, C.text, { align: 'center', weight: 700, alpha: at(L, t), claims: [claim(cl)], year: y }));
    }
    items.push(L1('a3-four-l1', '4 ran out of money', 560, 360, 60, at(L, t4), { claims: [claim('n4')] }));
    items.push(Tx('a3-four-sub', 'start years that failed', 560, 450, 34, C['text-dim'], { align: 'center', alpha: fade(L, t4 + 0.3), level: 2 }));
    return items;
  };
  CAM['a3-four'] = { f: 50, base: { z: 100 }, moves: [[1.0, 1.5, { y: 180, ty: 180, z: -150 }]], focus: 300, racks: [['turn', 0.8, -60]] };

  B['a3-four2'] = (L, sc, H) => {
    const items = []; env(items, 'a3-four2', { glow: 0.09, gx: 1500 });
    const t68 = cue(H, 'a3-four2.1', '1968', 0.6), t69 = cue(H, 'a3-four2.1', '1969', 1.5);
    const lift = (s) => (s.y === 1968 ? smooth((L - t68 + 0.2) / 0.5) : s.y === 1969 ? smooth((L - t69 + 0.2) / 0.5) : 1);
    const g = fourMap(items, 'a3-four2', L, H, { x0: 120, y0: 240 }, lift, 1);
    for (const [y, t] of [[1968, t68], [1969, t69]]) {
      const p = under(H, y, g, -60 * lift(byY[y]));
      items.push(Tx('a3-four2-' + y, String(y), p[0], p[1] + 6, 32, C.text, { align: 'center', weight: 700, alpha: at(L, t), claims: [claim(y === 1968 ? 'y1968' : 'y1969')], year: y }));
    }
    items.push(L1('a3-four2-l1', 'Then two more', 1340, 360, 60, fade(L, 0.1, 0.2)));
    items.push(Tx('a3-four2-sub', 'all four within five years', 1340, 450, 34, C['text-dim'], { align: 'center', alpha: fade(L, 0.4), level: 2 }));
    return items;
  };
  CAM['a3-four2'] = { f: 85, base: { x: -200, tx: -200, z: 300 }, moves: [[0.6, 1.3, { x: 200, tx: 200, z: -120 }]] };

  // (2b) 30-year real average: a dot strip (beeswarm) and a scatter against the end balance
  const RX = (v) => 360 + (v - 0.025) / (0.08 - 0.025) * 1200;
  const swarm = (() => {
    const r = 15, placed = [];
    const order = ST.slice().sort((a, b) => a.realGeo30 - b.realGeo30);
    const pos = {};
    for (const s of order) {
      const x = RX(s.realGeo30);
      let lvl = 0;
      while (placed.some((p) => Math.abs(p.x - x) < 2 * r + 2 && p.lvl === lvl)) lvl++;
      placed.push({ x, lvl }); pos[s.y] = [x, lvl];
    }
    return pos;
  })();
  const SW = { yb: 760, dy: 32, r: 15 };
  const swXY = (y) => [swarm[y][0], SW.yb - SW.r - swarm[y][1] * SW.dy];
  const SC = { yb: 900, top: 440, max: 5.4e6 };
  const scXY = (s) => [RX(s.realGeo30), SC.yb - (SC.yb - SC.top) * s.endReal / SC.max];
  // dots: position = mix of swarm (u=0) and scatter (u=1)
  function dots(items, panel, L, o) {
    ST.forEach((s, i) => {
      const u = o.u ? o.u(s, i) : 0;
      const a = swXY(s.y), b = scXY(s);
      const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
      const col = o.color(s, i);
      items.push(S(`${panel}-d${s.y}`, 'circle', { panel, z: o.z ?? 0, c: [x, y], r: (o.r ? o.r(s, i) : 1) * SW.r, fill: col, alpha: o.alpha ? o.alpha(s, i) : 1,
        meta: { role: 'mark', panel, chart: panel, year: s.y, ...(col === C.c1966 ? charShape('1966') : {}) } }));
      if (o.ring && o.ring(s, i) > 0) items.push(S(`${panel}-rg${s.y}`, 'ring', { panel, z: o.z ?? 0, c: [x, y], r: SW.r + 12, r2: SW.r + 7, fill: o.ringColor || C.text, alpha: o.ring(s, i), meta: { role: 'mark', panel, chart: panel } }));
    });
  }
  const dotAt = (s, u) => { const a = swXY(s.y), b = scXY(s); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
  function stripAxis(items, panel, H, a, capY) {
    items.push(S(panel + '-ax', 'polyline', { panel, z: 0, pts: [[330, SW.yb + 4], [1600, SW.yb + 4]], stroke: C.muted, lw: 2, alpha: a, meta: { role: 'axis', panel, chart: panel } }));
    const p = H.P(330, SW.yb + 4, 0), q = H.P(1600, SW.yb + 4, 0);
    items.push(Tx(panel + '-axl', 'lower real average', p[0], capY ?? p[1] + 50, 30, C['text-dim'], { alpha: a, level: 3 }));
    items.push(Tx(panel + '-axr', 'higher real average', q[0], capY ?? q[1] + 50, 30, C['text-dim'], { align: 'right', alpha: a, level: 3 }));
  }
  B['a3-avg-not'] = (L, sc, H) => {
    const items = []; env(items, 'a3-avg-not', { glow: 0.09, gx: 960 });
    // dots drop in by start year onto their long-run real average; the four failures sit among the others
    dots(items, 'a3-avg-not', L, { color: (s) => (s.depleted ? C.loss : C.muted), alpha: (s, i) => smooth((L - 0.2 - i * 0.012) / 0.3) });
    stripAxis(items, 'a3-avg-not', H, fade(L, 0.2));
    items.push(L1('a3-avg-not-l1', 'Averages don’t single them out', 640, 360, 56, fade(L, cue(H, 'a3-avg-not.1', 'averages', 0.5) - 0.2, 0.3)));
    items.push(Tx('a3-avg-not-sub', 'average return over the whole plan, after inflation', 640, 450, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.8), level: 2 }));
    return items;
  };
  CAM['a3-avg-not'] = { f: 35, base: { z: -300 }, moves: [[0.6, 1.3, { z: 300 }]] };

  B['a3-real66'] = (L, sc, H) => {
    const items = []; env(items, 'a3-real66', { glow: 0.09, gx: 400 });
    const t41 = cue(H, 'a3-real66.1', '4.1%', 4), t17 = cue(H, 'a3-real66.2', '17', 8.9);
    const g66 = byY[1966].realGeo30;
    const low = (s) => s.realGeo30 < g66 && !s.depleted;
    dots(items, 'a3-real66', L, { color: (s) => (s.y === 1966 ? C.c1966 : s.depleted ? C.loss : low(s) && L >= t17 - 0.3 ? C.gain : C.muted),
      r: (s) => (s.y === 1966 ? 1 + 0.35 * back((L - t41 + 0.2) / 0.4) : 1), alpha: (s) => (L >= t17 - 0.3 && !low(s) && s.y !== 1966 ? 0.55 : 1) });
    stripAxis(items, 'a3-real66', H, 1);
    // the 1966 reference line through the strip
    const x66 = RX(g66);
    items.push(S('a3-real66-ref', 'polyline', { panel: 'a3-real66', z: 0, pts: [[x66, SW.yb + 4], [x66, SW.yb - 250 * smooth((L - t41) / 0.5)]], stroke: C.c1966, lw: 3, dash: null, alpha: at(L, t41),
      meta: { role: 'mark', panel: 'a3-real66', ...charShape('1966') } }));
    const p = H.P(x66, SW.yb - 270, 0);
    items.push(Tx('a3-real66-41', '4.1%', p[0], p[1], 56, C.c1966, { align: 'center', weight: 700, alpha: at(L, t41), claims: [claim('rg1966')], series: '1966', level: 2 }));
    items.push(Tx('a3-real66-who', '1966 retiree, real average', p[0], p[1] - 70, 30, C.c1966, { align: 'center', alpha: fade(L, t41 + 0.1), claims: [claim('y1966')], series: '1966', level: 3 }));
    items.push(L1('a3-real66-l1', 'After inflation', 1280, 360, 60, fade(L, 0.2) * fadeOut(L, t17 - 0.3, 0.25)));
    items.push(L1('a3-real66-17', '17', 1280, 330, 110, at(L, t17), { claims: [claim('n17')], color: C.gain }));
    items.push(Tx('a3-real66-17s', 'averaged less, never ran out', 1280, 430, 34, C.text, { align: 'center', alpha: fade(L, t17 + 0.2), level: 2 }));
    return items;
  };
  CAM['a3-real66'] = { f: 50, base: { x: 250, tx: 250 }, moves: [[0.8, 1.5, { x: -250, tx: -250 }]] };

  // scatter: real average (x) vs what was left (y); failures sit on the zero line
  function scatterAxes(items, panel, H, a) {
    items.push(S(panel + '-ax', 'polyline', { panel, z: 0, pts: [[330, SC.yb + 20], [1600, SC.yb + 20]], stroke: C.muted, lw: 2, alpha: a, meta: { role: 'axis', panel, chart: panel } }));
    items.push(S(panel + '-ay', 'polyline', { panel, z: 0, pts: [[330, SC.yb + 20], [330, SC.top - 20]], stroke: C.muted, lw: 2, alpha: a, meta: { role: 'axis', panel, chart: panel } }));
    const p = H.P(1600, SC.yb + 20, 0), q = H.P(330, SC.top - 20, 0);
    const p0 = H.P(330, SC.yb + 20, 0); void p;
    items.push(Tx(panel + '-axx', 'higher real average →', p0[0], p0[1] + 48, 30, C['text-dim'], { alpha: a, level: 3 }));
    items.push(Tx(panel + '-axy', '↑ more left at the end, after inflation', q[0] + 16, q[1] - 16, 30, C['text-dim'], { alpha: a, level: 3 }));
  }
  B['a3-1969'] = (L, sc, H) => {
    const items = []; env(items, 'a3-1969', { glow: 0.09, gx: 1500 });
    const t69 = cue(H, 'a3-1969.1', '1969', 1), t56 = cue(H, 'a3-1969.1', '5.6%', 3.5), t28 = cue(H, 'a3-1969.2', '1928', 6.4), t49 = cue(H, 'a3-1969.2', '4.9%', 9);
    const u = smooth((L - 0.3) / 1.2);
    dots(items, 'a3-1969', L, { u: () => u, color: (s) => (s.y === 1969 ? C.loss : s.y === 1928 ? C.gain : C.muted),
      alpha: (s) => (s.y === 1969 || s.y === 1928 ? 1 : 0.45), r: (s) => (s.y === 1969 ? 1 + 0.4 * back((L - t69) / 0.4) : s.y === 1928 ? 1 + 0.4 * back((L - t28) / 0.4) : 1) });
    scatterAxes(items, 'a3-1969', H, fade(L, 0.2));
    const d69 = H.P(...dotAt(byY[1969], u), 0), d28 = H.P(...dotAt(byY[1928], u), 0);
    const ya = H.P(0, SC.yb + 20, 0)[1];
    items.push(Tx('a3-1969-y', '1969', d69[0] - 24, ya + 56, 34, C.text, { align: 'right', weight: 700, alpha: at(L, t69), claims: [claim('y1969')], year: 1969 }));
    items.push(Tx('a3-1969-v', '5.6%', d69[0] + 24, ya + 56, 34, C.loss, { weight: 700, alpha: at(L, t56), claims: [claim('rg1969')], level: 2 }));
    // 1928: a callout in the empty upper-left of the plot, tied to its dot by a leader
    const co = H.P(560, 600, 0);
    items.push(S('a3-1969-lead', 'polyline', { panel: 'a3-1969', z: 0, pts: [[600, 640], [scXY(byY[1928])[0] - 22, scXY(byY[1928])[1] - 16]], stroke: C.gain, lw: 2, alpha: at(L, t28), meta: { role: 'mark', panel: 'a3-1969' } }));
    items.push(Tx('a3-1928-y', '1928', co[0], co[1] - 40, 34, C.text, { align: 'center', weight: 700, alpha: at(L, t28), claims: [claim('y1928')], year: 1928 }));
    items.push(Tx('a3-1928-v', '4.9%', co[0], co[1] + 14, 40, C.gain, { align: 'center', weight: 700, alpha: at(L, t49), claims: [claim('rg1928')], level: 2 }));
    items.push(L1('a3-1969-l1', 'Real average, whole plan', 640, 360, 52, fade(L, 0.2) * fadeOut(L, t28 - 0.3, 0.25)));
    items.push(L1('a3-1969-l1b', '1928 averaged less', 640, 360, 52, fade(L, t49 - 0.2, 0.3), { claims: [claim('y1928')] }));
    return items;
  };
  CAM['a3-1969'] = { f: 50, base: { z: -250 }, moves: [[0.8, 1.4, { z: 250 }]] };

  B['a3-1928'] = (L, sc, H) => {
    const items = []; env(items, 'a3-1928', { glow: 0.10, gx: 400 });
    const tM = cue(H, 'a3-1928.1', '$1.21 million', 2.5), t28th = cue(H, 'a3-1928.1', '28', 8.5), t69 = cue(H, 'a3-1928.1', '1969', 6);
    dots(items, 'a3-1928', L, { u: () => 1, color: (s) => (s.y === 1969 ? C.loss : s.y === 1928 ? C.gain : C.muted), alpha: (s) => (s.y === 1969 || s.y === 1928 ? 1 : 0.35),
      r: (s) => (s.y === 1969 || s.y === 1928 ? 1.4 : 1) });
    scatterAxes(items, 'a3-1928', H, 1);
    const d69 = H.P(...scXY(byY[1969]), 0);
    const ya = H.P(0, SC.yb + 20, 0)[1];
    // what each one had left: 1928 rises to its end balance, 1969 sits on zero
    const s28 = byY[1928], p28 = scXY(s28);
    const up = smooth((L - tM + 0.6) / 0.6);
    items.push(S('a3-1928-stem', 'polyline', { panel: 'a3-1928', z: 0, pts: [[p28[0], SC.yb + 20], [p28[0], SC.yb + 20 - (SC.yb + 20 - p28[1] - 22) * up]], stroke: C.gain, lw: 4, alpha: fade(L, tM - 0.6, 0.2),
      meta: { role: 'mark', panel: 'a3-1928' } }));
    items.push(S('a3-1928-lead', 'polyline', { panel: 'a3-1928', z: 0, pts: [[600, 660], [p28[0] - 22, p28[1] - 16]], stroke: C.gain, lw: 2, meta: { role: 'mark', panel: 'a3-1928' } }));
    const co = H.P(560, 600, 0);
    items.push(Tx('a3-1928-y', '1928', co[0], co[1] - 110, 34, C.text, { align: 'center', weight: 700, claims: [claim('y1928')], year: 1928 }));
    items.push(Tx('a3-1928-m', '$1.21 million', co[0], co[1] - 40, 48, C.gain, { align: 'center', weight: 700, alpha: at(L, tM), claims: [claim('end1928')], level: 2 }));
    items.push(Tx('a3-1928-b', 'in 1928 dollars, left at the end', co[0], co[1] + 12, 30, C['text-dim'], { align: 'center', alpha: at(L, tM), claims: [claim('y1928')], level: 3 }));
    items.push(Tx('a3-1969-y2', '1969', d69[0] - 24, ya + 56, 34, C.text, { align: 'right', weight: 700, alpha: at(L, t69), claims: [claim('y1969')], year: 1969 }));
    items.push(Tx('a3-1969-r', 'ran out in its 28th year', d69[0] + 24, ya + 56, 34, C.loss, { weight: 700, alpha: at(L, t28th), claims: [claim('dep1969')], level: 2 }));
    items.push(L1('a3-1928-l1', 'Lower average, money left', 1280, 360, 52, fade(L, 0.3)));
    return items;
  };
  CAM['a3-1928'] = { f: 85, base: { x: -150, tx: -150, z: 200 }, moves: [[1.0, 1.5, { x: 150, tx: 150, z: -200 }]] };

  // (3) first decade: the four failures, their first 10 plan years lit on a 30-year strip
  B['a3-share'] = (L, sc, H) => {
    const items = []; env(items, 'a3-share', { glow: 0.10, gx: 960 });
    startMap(items, 'a3-share', { g: { x0: 506, y0: 250, z: 1000 }, color: (s) => (s.depleted ? C.loss : s.less ? C.muted : C.gain), alpha: () => 0.8 });
    const tFirst = cue(H, 'a3-share.1', 'first', 2.5);
    FAIL.forEach((y, r) => {
      const y0 = 470 + r * 110;
      for (let k = 0; k < 30; k++) {
        const on = k < 10 ? smooth((L - tFirst + 0.3 - k * 0.04) / 0.3) : 0;
        items.push(S(`a3-share-${y}-${k}`, 'rect', { panel: 'a3-share', z: 0, rect: [420 + k * 36, y0, 30, 60], radius: 4, fill: on > 0.5 ? C.loss : C['surface-2'], alpha: fade(L, 0.2 + r * 0.15 + k * 0.01, 0.3),
          meta: { role: 'mark', panel: 'a3-share', year: k === 0 ? y : undefined } }));
      }
    });
    const pb = H.P(420, 470 + 4 * 110 + 20, 0);
    items.push(Tx('a3-share-cap', 'each row: one failed start year, one tile per plan year', pb[0], pb[1] + 26, 30, C['text-dim'], { alpha: fade(L, 0.8), level: 3 }));
    items.push(L1('a3-share-l1', 'What the four share', 960, 280, 64, fade(L, 0.2)));
    return items;
  };
  CAM['a3-share'] = { f: 24, base: { z: -200, y: -150, ty: -60 }, moves: [[0.7, 1.4, { z: 200, y: 150, ty: 60 }]] };

  // first-decade real average return, all 69 start years (bars on a zero baseline)
  function decadeBars(items, panel, L, o) {
    const x0 = o.x0 ?? 170, step = o.step ?? 23, bw = o.bw ?? 17, yb = o.yb ?? 760, k = o.k ?? 3000;
    ST.forEach((s, i) => {
      const gr = o.grow ? o.grow(s, i) : 1, v = s.realGeo10, h = Math.abs(v) * k * gr;
      items.push(S(`${panel}-b${s.y}`, 'rect', { panel, z: 0, rect: [x0 + i * step, v >= 0 ? yb - h : yb, bw, Math.max(2, h)], radius: 2, fill: o.color(s, i), alpha: o.alpha ? o.alpha(s, i) : 1,
        meta: { role: 'bar', panel, chart: panel, value: v, full: gr >= 1, orient: 'v', year: s.y } }));
    });
    items.push(S(panel + '-zero', 'polyline', { panel, z: 0, pts: [[x0 - 10, yb], [x0 + 69 * step, yb]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel, chart: panel } }));
    return { x0, step, bw, yb, k };
  }
  B['a3-decade'] = (L, sc, H) => {
    const items = []; env(items, 'a3-decade', { glow: 0.09, gx: 1500 });
    const tLost = cue(H, 'a3-decade.1', 'lost', 2.5);
    const g = decadeBars(items, 'a3-decade', L, { grow: (s, i) => smooth((L - 0.3 - i * 0.02) / 0.5), color: (s) => (s.depleted ? C.loss : C.muted),
      alpha: (s) => (s.depleted ? 1 : 1 - 0.45 * smooth((L - tLost) / 0.5)) });
    const p = H.P(g.x0 + (1966 - 1928) * g.step, g.yb + 90, 0);
    items.push(Tx('a3-decade-f', 'the four that ran out', p[0], p[1] + 20, 32, C.loss, { align: 'center', weight: 700, alpha: fade(L, tLost), level: 2 }));
    items.push(Tx('a3-decade-cap', 'average return per year over the first decade, after inflation, by start year', 170, 1000, 30, C['text-dim'], { alpha: fade(L, 0.8), level: 3 }));
    items.push(Tx('a3-decade-z', 'zero', g.x0 - 20, g.yb + 10, 28, C['text-dim'], { align: 'right', alpha: fade(L, 0.5), level: 3 }));
    items.push(L1('a3-decade-l1', 'All four lost ground early', 640, 360, 60, fade(L, tLost - 0.2, 0.3)));
    return items;
  };
  CAM['a3-decade'] = { f: 50, base: { z: 200 }, moves: [[0.8, 1.4, { z: -250, x: 150, tx: 150 }]], focus: 400, racks: [['turn', 0.8, 0]] };

  // the four failures' first decades as large bars, 1966 in its own colour
  function fourBars(items, panel, L, H, o) {
    const x0 = o.x0, yb = o.yb, k = o.k, bw = 130, gap = 60;
    FAIL.forEach((y, i) => {
      const v = byY[y].realGeo10, gr = o.grow(y, i), h = Math.abs(v) * k * gr;
      const is66 = y === 1966;
      items.push(S(`${panel}-f${y}`, 'rect', { panel, z: 0, rect: [x0 + i * (bw + gap), yb, bw, Math.max(2, h)], radius: 4, fill: is66 ? C.c1966 : C.loss, alpha: is66 ? 1 : o.dim,
        meta: { role: 'bar', panel, chart: panel, value: v, full: gr >= 1, orient: 'v', year: y, ...(is66 ? charShape('1966') : {}) } }));
    });
    items.push(S(panel + '-zero', 'polyline', { panel, z: 0, pts: [[x0 - 30, yb], [x0 + 4 * (bw + gap) - gap + 30, yb]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel, chart: panel } }));
    return { bw, gap };
  }
  B['a3-1966d'] = (L, sc, H) => {
    const items = []; env(items, 'a3-1966d', { glow: 0.10, gx: 400 });
    const t18 = cue(H, 'a3-1966d.1', '−1.8%', 6), t66 = cue(H, 'a3-1966d.1', '1966', 4);
    const x0 = 300, yb = 420, k = 9000;
    const g = fourBars(items, 'a3-1966d', L, H, { x0, yb, k, grow: (y, i) => smooth((L - 0.3 - i * 0.15) / 0.6), dim: 1 - 0.5 * smooth((L - t66) / 0.5) });
    const i66 = FAIL.indexOf(1966), xc = x0 + i66 * (g.bw + g.gap) + g.bw / 2;
    const hb = H.P(xc, yb + Math.abs(byY[1966].realGeo10) * k + 70, 0);
    items.push(Tx('a3-1966d-v', '−1.8%', hb[0], hb[1], 72, C.c1966, { align: 'center', weight: 700, alpha: at(L, t18), claims: [claim('dec1966')], series: '1966', level: 2 }));
    const ht = H.P(xc, yb - 40, 0);
    items.push(Tx('a3-1966d-y', '1966', ht[0], ht[1], 34, C.c1966, { align: 'center', weight: 700, alpha: at(L, t66), claims: [claim('y1966')], series: '1966', year: 1966 }));
    const zc = H.P(x0 - 30, yb, 0);
    items.push(Tx('a3-1966d-z', 'zero', zc[0] - 12, zc[1] + 10, 28, C['text-dim'], { align: 'right', alpha: fade(L, 0.4), level: 3 }));
    items.push(L1('a3-1966d-l1', 'A losing first decade', 1280, 720, 60, fade(L, 0.3)));
    items.push(Tx('a3-1966d-sub', 'average per year, after inflation', 1280, 810, 34, C['text-dim'], { align: 'center', alpha: fade(L, 0.6), level: 2 }));
    items.push(Tx('a3-1966d-cap', 'the four start years that ran out', 300, 250, 30, C['text-dim'], { alpha: fade(L, 0.5), level: 3 }));
    return items;
  };
  CAM['a3-1966d'] = { f: 85, base: { x: 250, tx: 250, z: 150 }, moves: [[1.0, 1.5, { x: -250, tx: -250, z: -150 }]] };

  B['a3-mirror-d'] = (L, sc, H) => {
    const items = []; env(items, 'a3-mirror-d', { glow: 0.10, key: C['rim-light'] });
    const t69 = cue(H, 'a3-mirror-d.1', '6.9%', 3.5);
    // same first decade, two orders: the 1966 retiree (left, below zero) and the mirror (right, above zero)
    const yb = 620, k = 3200, v66 = byY[1966].realGeo10, vm = 0.06878403749352757;
    let pm = 1, pr = 1; for (let j = 0; j < 10; j++) { pm *= (1 + M.retMirror[j]) / (1 + M.infl[j]); pr *= (1 + M.ret1966[j]) / (1 + M.infl[j]); }
    const vMir = Math.pow(pm, 0.1) - 1, v66b = Math.pow(pr, 0.1) - 1; void vm; void v66b;
    const g66 = smooth((L - 0.2) / 0.5), gm = smooth((L - t69 + 0.9) / 0.9);
    items.push(S('a3-mirror-d-b66', 'rect', { panel: 'a3-mirror-d', z: 0, rect: [520, yb, 220, Math.abs(v66) * k * g66], radius: 4, fill: C.c1966,
      meta: { role: 'bar', panel: 'a3-mirror-d', chart: 'a3-mirror-d', value: v66, full: g66 >= 1, orient: 'v', ...charShape('1966') } }));
    items.push(S('a3-mirror-d-bm', 'rect', { panel: 'a3-mirror-d', z: 0, rect: [1180, yb - vMir * k * gm, 220, Math.max(2, vMir * k * gm)], radius: 4, fill: C.cmirror, stroke: C.cmirror, lw: 0,
      meta: { role: 'bar', panel: 'a3-mirror-d', chart: 'a3-mirror-d', value: vMir, full: gm >= 1, orient: 'v', ...charShape('mirror') } }));
    items.push(S('a3-mirror-d-zero', 'polyline', { panel: 'a3-mirror-d', z: 0, pts: [[440, yb], [1480, yb]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel: 'a3-mirror-d', chart: 'a3-mirror-d' } }));
    const pm1 = H.P(1290, yb - vMir * k, 0);
    items.push(Tx('a3-mirror-d-v', '6.9%', pm1[0], pm1[1] - 30, 64, C.cmirror, { align: 'center', weight: 700, alpha: at(L, t69), claims: [claim('decm')], series: 'mirror', level: 2 }));
    items.push(badge('a3-mirror-d-badge', pm1[0] + 120, pm1[1] - 48, fade(L, t69 - 0.5, 0.2)));
    const l66 = H.P(630, yb - 40, 0), lm = H.P(1290, yb + 60, 0);
    items.push(Tx('a3-mirror-d-l66', 'first retiree', l66[0], l66[1], 32, C.c1966, { align: 'center', series: '1966', level: 3 }));
    items.push(Tx('a3-mirror-d-lm', 'mirror retiree', lm[0], lm[1], 32, C.cmirror, { align: 'center', series: 'mirror', alpha: fade(L, 0.3), level: 3 }));
    items.push(Tx('a3-mirror-d-cap', 'first decade, average per year, after inflation', 960, 960, 30, C['text-dim'], { align: 'center', alpha: fade(L, 0.4), level: 3 }));
    items.push(L1('a3-mirror-d-l1', 'The mirror’s first decade', 640, 260 + 100, 52, fade(L, 0.2)));
    return items;
  };
  CAM['a3-mirror-d'] = { f: 85, base: { x: -200, tx: -200 }, moves: [[0.8, 1.4, { x: 400, tx: 400 }]] };

  // (4) the answer card
  B['a3-answer'] = (L, sc, H) => {
    const items = []; env(items, 'a3-answer', { glow: 0.14, gx: 960 });
    const tNot = cue(H, 'a3-answer.2', 'not', 2.4), tFirst = cue(H, 'a3-answer.3', 'first', 4.1);
    // behind the card: the first-decade bars, out of focus
    decadeBars(items, 'a3-answer-bg', L, { x0: 170, yb: 820, k: 2200, color: (s) => (s.depleted ? C.loss : C.muted), alpha: () => 0.7 });
    items.forEach((it) => { if (it.id && it.id.startsWith('a3-answer-bg')) { it.z = 800; it.panel = 'a3-answer'; it.meta.panel = 'a3-answer'; } });
    items.push(S('a3-answer-card', 'rect', { panel: 'a3-answer', z: 0, rect: [360, 300, 1200, 480], radius: 28, fill: C.surface, shadow: { alpha: 0.55, blur: 70, dy: 30 }, alpha: fade(L, 0.1), meta: { role: 'card', panel: 'a3-answer' } }));
    items.push(L1('a3-answer-q', 'What decided it?', 960, 540, 72, fade(L, 0.2) * fadeOut(L, tNot - 0.3, 0.25)));
    const strike = smooth((L - tNot - 0.3) / 0.5);
    items.push(Tx('a3-answer-avg', 'Not the average', 960, 440, 44, C['text-dim'], { align: 'center', alpha: fade(L, tNot - 0.1, 0.2), level: 2 }));
    items.push(S('a3-answer-strike', 'polyline', { panel: 'a3-answer', z: -1, pts: [[790, 425], [790 + 340 * strike, 425]], stroke: C.loss, lw: 4, alpha: strike > 0 ? fadeOut(L, tFirst + 0.8) : 0, meta: { role: 'mark', panel: 'a3-answer' } }));
    items.push(L1('a3-answer-l1', 'The first decade', 960, 600, 84, fade(L, tFirst - 0.15, 0.25), { color: C.text }));
    items.push(S('a3-answer-ul', 'polyline', { panel: 'a3-answer', z: 0, pts: [[660, 690], [660 + 600 * smooth((L - tFirst) / 0.6), 690]], stroke: C.loss, lw: 6, alpha: at(L, tFirst), meta: { role: 'mark', panel: 'a3-answer' } }));
    return items;
  };
  CAM['a3-answer'] = { f: 35, base: { z: -300 }, moves: [[0.7, 1.4, { z: 300 }]], focus: 0, racks: [['turn', 0.8, 0]] };

  B['a3-nuance'] = (L, sc, H) => {
    const items = []; env(items, 'a3-nuance', { glow: 0.09, gx: 1500 });
    const t69 = cue(H, 'a3-nuance.1', '69', 1.8), tLeft = cue(H, 'a3-nuance.1', 'left', 7.8);
    const tBad = cue(H, 'a3-nuance.2', 'bad', 12.5);
    // the swarm opens into the scatter: the real average lines up with what is left
    const u = (s, i) => smooth((L - 1.5 - i * 0.03) / 1.4);
    dots(items, 'a3-nuance', L, { u, color: (s) => (s.depleted ? C.loss : s.less ? C.muted : C.gain),
      ring: (s) => (s.realGeo10 < 0 ? smooth((L - tBad + 0.3) / 0.4) : 0), ringColor: C.loss, alpha: (s) => (L > tBad - 0.3 && s.realGeo10 >= 0 ? 0.5 : 1) });
    scatterAxes(items, 'a3-nuance', H, fade(L, 1.8));
    items.push(L1('a3-nuance-l1', 'The long average still matters', 640, 360, 52, fade(L, tLeft - 1.5, 0.3) * fadeOut(L, tBad - 0.4, 0.25)));
    items.push(Tx('a3-nuance-69', 'all 69 start years', 640, 450, 34, C['text-dim'], { align: 'center', alpha: at(L, t69) * fadeOut(L, tBad - 0.4, 0.25), claims: [claim('n69')], level: 2 }));
    items.push(L1('a3-nuance-l1b', 'Every failure: a bad first decade', 640, 360, 48, fade(L, tBad - 0.2, 0.3)));
    items.push(Tx('a3-nuance-ring', 'ringed: lost money in the first decade', 640, 450, 32, C.loss, { align: 'center', alpha: fade(L, tBad + 0.2), level: 2 }));
    return items;
  };
  CAM['a3-nuance'] = { f: 35, base: { z: -250 }, moves: [[0.8, 1.5, { z: 250 }]] };

  B['a3-avg-callback'] = (L, sc, H) => {
    const items = []; env(items, 'a3-avg-callback', { glow: 0.10, gx: 400 });
    const t97 = cue(H, 'a3-avg-callback.1', '9.7%', 0.3), t66 = cue(H, 'a3-avg-callback.1', '1966', 2.5), t91 = cue(H, 'a3-avg-callback.1', '1991', 7);
    // the 1966 real balance under its average: the line walks down to zero as the voice reaches 1991
    const x0 = 820, x1 = 1640, yb = 860, yt = 520;
    const X = (k) => x0 + (x1 - x0) * k / 30, Y = (v) => yb - (yb - yt) * v / 1e6;
    const prog = smooth((L - 0.8) / Math.max(1, t91 - 0.8));
    const n = Math.max(1, Math.round(prog * 25));
    axisX(items, 'a3-avg-callback-axis', 'a3-avg-callback', x0, x1, yb + 4, 0, 'a3-avg-callback');
    series(items, 'a3-avg-callback-66', 'a3-avg-callback', '1966', M.real1966.slice(0, n + 1).map((v, k) => [X(k), Y(v)]), 0, 'a3-avg-callback', 1, 'a3-avg-callback-lab');
    const a = H.P(x0, yb + 4, 0), b = H.P(x1, yb + 4, 0);
    items.push(Tx('a3-avg-callback-a0', '1966', a[0], a[1] + 46, 30, C['text-dim'], { role: 'axis-label', anchor: 'a3-avg-callback', chart: 'a3-avg-callback', year: 1966, align: 'center', claims: [claim('y1966')] }));
    items.push(Tx('a3-avg-callback-a1', '1995', b[0], b[1] + 46, 30, C['text-dim'], { role: 'axis-label', anchor: 'a3-avg-callback', chart: 'a3-avg-callback', year: 1995, align: 'center', claims: [claim('ax1995')] }));
    const lp = H.P(X(3), Y(M.real1966[3]), 0);
    items.push(Tx('a3-avg-callback-lab', '1966 retiree, real balance', lp[0] + 10, lp[1] - 34, 30, C.c1966, { claims: [claim('y1966')], series: '1966', alpha: fade(L, 1.0), level: 3 }));
    const hit = H.P(X(25), yb + 4, 0);
    items.push(S('a3-avg-callback-zero', 'circle', { panel: 'a3-avg-callback', z: 0, c: [X(25), yb + 4], r: 12 * back((L - t91) / 0.35), fill: C.loss, alpha: at(L, t91), meta: { role: 'mark', panel: 'a3-avg-callback', ...charShape('1966') } }));
    items.push(Tx('a3-avg-callback-91', '1991', hit[0], hit[1] - 60, 44, C.loss, { align: 'center', weight: 700, alpha: at(L, t91), claims: [claim('y1991')], level: 2 }));
    items.push(L1('a3-avg-callback-l1', '9.7%', 640, 360, 120, at(L, t97), { color: C.c1966, series: '1966', claims: [claim('g1966')] }));
    items.push(Tx('a3-avg-callback-s1', 'described the 1966 retiree perfectly', 640, 470, 32, C['text-dim'], { align: 'center', alpha: at(L, t66), claims: [claim('y1966')], level: 2 }));
    items.push(Tx('a3-avg-callback-s2', 'and said nothing about the end', 640, 530, 32, C['text-dim'], { align: 'center', alpha: fade(L, cue(H, 'a3-avg-callback.1', 'nothing', 6) - 0.1), level: 2 }));
    return items;
  };
  CAM['a3-avg-callback'] = { f: 85, base: { z: 250, x: -200, tx: -200 }, moves: [[1.0, 1.5, { z: -250, x: 200, tx: 200 }]] };

  // (5) the limits: clean list rows with small flat icons
  function icon(items, panel, kind, cx, cy, a, col) {
    const P = (id, geo, o) => items.push(S(`${panel}-ic-${kind}-${id}`, geo, { panel, z: 0, alpha: a, meta: { role: 'mark', panel }, ...o }));
    if (kind === 'history') { P('c', 'ring', { c: [cx, cy], r: 26, r2: 21, fill: col }); P('h', 'polyline', { pts: [[cx, cy], [cx, cy - 15], [cx, cy], [cx + 12, cy + 6]], stroke: col, lw: 4 }); }
    if (kind === 'us') { P('pole', 'polyline', { pts: [[cx - 18, cy + 26], [cx - 18, cy - 26]], stroke: col, lw: 4 }); P('flag', 'rect', { rect: [cx - 16, cy - 26, 36, 24], radius: 3, fill: col }); }
    if (kind === 'overlap') { P('a', 'rect', { rect: [cx - 26, cy - 20, 36, 16], radius: 3, fill: col }); P('b', 'rect', { rect: [cx - 14, cy - 6, 36, 16], radius: 3, fill: col, alpha: a * 0.7 }); P('c', 'rect', { rect: [cx - 2, cy + 8, 30, 16], radius: 3, fill: col, alpha: a * 0.5 }); }
    if (kind === 'bare') { P('box', 'rect', { rect: [cx - 24, cy - 20, 48, 40], radius: 5, fill: null, stroke: col, lw: 4 }); }
    if (kind === 'x') { P('a', 'polyline', { pts: [[cx - 16, cy - 16], [cx + 16, cy + 16]], stroke: col, lw: 5 }); P('b', 'polyline', { pts: [[cx - 16, cy + 16], [cx + 16, cy - 16]], stroke: col, lw: 5 }); }
    if (kind === 'one') { P('d', 'circle', { c: [cx, cy], r: 16, fill: col }); }
  }
  B['a3-limits'] = (L, sc, H) => {
    const items = []; env(items, 'a3-limits', { glow: 0.10, gx: 1500 });
    const tH = cue(H, 'a3-limits.2', 'history', 3.2);
    items.push(S('a3-limits-card', 'rect', { panel: 'a3-limits', z: 0, rect: [980, 330, 760, 520], radius: 22, fill: C.surface, shadow: { alpha: 0.45, blur: 50, dy: 24 }, alpha: fade(L, 0.2), meta: { role: 'card', panel: 'a3-limits' } }));
    const rows = [['history', 'History, not a forecast'], ['us', 'US only'], ['overlap', 'Overlapping windows'], ['bare', 'A bare model']];
    rows.forEach(([k, s], i) => {
      const y = 420 + i * 110, on = i === 0 ? at(L, tH - 0.1) : 0;
      const a = fade(L, 0.4 + i * 0.25, 0.3) * (on ? 1 : 0.55);
      const p = H.P(1070, y, 0), q = H.P(1130, y + 14, 0);
      icon(items, 'a3-limits', k, 1070, y, a, on ? C.text : C.muted);
      items.push(Tx('a3-limits-r' + i, s, q[0], q[1], 40, on ? C.text : C['text-dim'], { alpha: fade(L, 0.4 + i * 0.25, 0.3), level: 2 }));
      void p;
    });
    items.push(L1('a3-limits-l1', 'The limits', 640, 360, 72, fade(L, 0.3)));
    return items;
  };
  CAM['a3-limits'] = { f: 50, base: { x: -250, tx: -250 }, moves: [[0.8, 1.4, { x: 250, tx: 250 }]] };

  B['a3-usonly'] = (L, sc, H) => {
    const items = []; env(items, 'a3-usonly', { glow: 0.10, gx: 960 });
    // a flat globe: one country lit, the rest of the world's markets left out
    const cx = 1280, cy = 600, r = 300, a = fade(L, 0.2);
    items.push(S('a3-usonly-globe', 'circle', { panel: 'a3-usonly', z: 0, c: [cx, cy], r, fill: C['surface-2'], alpha: a, meta: { role: 'mark', panel: 'a3-usonly' } }));
    for (let j = 1; j <= 3; j++) {
      const pts = []; for (let t = 0; t <= 40; t++) { const th = -Math.PI / 2 + Math.PI * t / 40; pts.push([cx + Math.cos(th) * r * (j / 4) * Math.cos(L * 0.25), cy + Math.sin(th) * r]); }
      const pts2 = pts.map(([x, y]) => [2 * cx - x, y]);
      items.push(S('a3-usonly-m' + j, 'polyline', { panel: 'a3-usonly', z: 0, pts, stroke: C.grid, lw: 2, alpha: a, meta: { role: 'mark', panel: 'a3-usonly' } }));
      items.push(S('a3-usonly-n' + j, 'polyline', { panel: 'a3-usonly', z: 0, pts: pts2, stroke: C.grid, lw: 2, alpha: a, meta: { role: 'mark', panel: 'a3-usonly' } }));
    }
    for (const dy of [-150, 0, 150]) { const w = Math.sqrt(r * r - dy * dy); items.push(S('a3-usonly-p' + dy, 'polyline', { panel: 'a3-usonly', z: 0, pts: [[cx - w, cy + dy], [cx + w, cy + dy]], stroke: C.grid, lw: 2, alpha: a, meta: { role: 'mark', panel: 'a3-usonly' } })); }
    const tUS = cue(H, 'a3-usonly.1', 'US', 1.2);
    const lit = smooth((L - tUS + 0.2) / 0.5);
    items.push(S('a3-usonly-us', 'poly', { panel: 'a3-usonly', z: 0, pts: [[cx - 230, cy - 120], [cx - 60, cy - 140], [cx - 30, cy - 70], [cx - 70, cy - 10], [cx - 150, cy + 10], [cx - 210, cy - 40]], fill: C.c1966, alpha: 0.25 + 0.75 * lit,
      meta: { role: 'mark', panel: 'a3-usonly' } }));
    items.push(L1('a3-usonly-l1', 'US only', 640, 360, 80, fade(L, tUS - 0.15, 0.25)));
    items.push(Tx('a3-usonly-sub', 'one country, one set of markets', 640, 460, 34, C['text-dim'], { align: 'center', alpha: fade(L, cue(H, 'a3-usonly.1', 'country', 2) - 0.1), level: 2 }));
    return items;
  };
  CAM['a3-usonly'] = { f: 24, base: { z: -300, y: -200, ty: -100 }, moves: [[0.6, 1.3, { z: 300, y: 200, ty: 100 }]] };

  B['a3-overlap'] = (L, sc, H) => {
    const items = []; env(items, 'a3-overlap', { glow: 0.09, gx: 400 });
    const t69 = cue(H, 'a3-overlap.1', '69', 0.3), t98 = cue(H, 'a3-overlap.1', '98', 3.5), t3 = cue(H, 'a3-overlap.1', '3', 5);
    // one thin bar per start year spanning its 30 plan years, on a data span of 1928..2025
    const x0 = 200, x1 = 1720, yr = (x1 - x0) / 98, y0 = 330, dy = 8;
    const sep = [1928, 1958, 1988];
    ST.forEach((s, i) => {
      const x = x0 + (s.y - 1928) * yr, isSep = sep.includes(s.y);
      const gr = smooth((L - 0.2 - i * 0.03) / 0.3);
      items.push(S('a3-overlap-w' + s.y, 'rect', { panel: 'a3-overlap', z: 0, rect: [x, y0 + i * dy, 30 * yr * gr, dy - 2], radius: 2,
        fill: isSep && L >= t3 - 0.2 ? C.c1966 : C.muted, alpha: L >= t3 - 0.2 && !isSep ? 0.4 : 0.95, meta: { role: 'mark', panel: 'a3-overlap', year: s.y } }));
    });
    // the data span underneath: 98 years
    const ya = y0 + 69 * dy + 30, span = smooth((L - t98 + 0.3) / 0.6);
    items.push(S('a3-overlap-span', 'polyline', { panel: 'a3-overlap', z: 0, pts: [[x0, ya], [x0 + (x1 - x0) * span, ya]], stroke: C.text, lw: 4, alpha: span > 0 ? 1 : 0, meta: { role: 'axis', panel: 'a3-overlap', chart: 'a3-overlap' } }));
    items.push(Tx('a3-overlap-98', '98 years of data', 960, ya + 60, 40, C.text, { align: 'center', weight: 700, alpha: at(L, t98), claims: [claim('n98')], level: 2 }));
    items.push(L1('a3-overlap-l1', '69 windows overlap', 640, 220 + 50, 56, at(L, t69), { claims: [claim('n69')] }));
    items.push(Tx('a3-overlap-3', 'only 3 separate stretches', 1280, 250, 40, C.c1966, { align: 'center', weight: 700, alpha: at(L, t3), claims: [claim('n3')], level: 2 }));
    return items;
  };
  CAM['a3-overlap'] = { f: 50, base: { z: -250 }, moves: [[1.0, 1.4, { z: 300 }]] };

  B['a3-bare'] = (L, sc, H) => {
    const items = []; env(items, 'a3-bare', { glow: 0.10, gx: 960 });
    const rows = [['x', 'No taxes', 'taxes'], ['x', 'No fees', 'fees'], ['one', 'One portfolio mix', 'portfolio'], ['one', 'One withdrawal rule', 'withdrawal']];
    const tCh = cue(H, 'a3-bare.2', 'change', 7.7);
    items.push(S('a3-bare-card', 'rect', { panel: 'a3-bare', z: 0, rect: [180, 400, 760, 520], radius: 22, fill: C.surface, shadow: { alpha: 0.45, blur: 50, dy: 24 }, alpha: fade(L, 0.2), meta: { role: 'card', panel: 'a3-bare' } }));
    rows.forEach(([k, s, w], i) => {
      const t = cue(H, 'a3-bare.1', w, 2 + i * 1.3) - 0.15, y = 490 + i * 110;
      const a = fade(L, t, 0.25);
      const q = H.P(340, y + 14, 0);
      items.push(S('a3-bare-ic' + i, k === 'x' ? 'ring' : 'circle', { panel: 'a3-bare', z: 0, c: [270, y], r: 22 * back((L - t) / 0.3), r2: 16, fill: k === 'x' ? C.loss : C.muted, alpha: L >= t ? 1 : 0, meta: { role: 'mark', panel: 'a3-bare' } }));
      items.push(Tx('a3-bare-r' + i, s, q[0], q[1], 42, C.text, { alpha: a, level: 2 }));
    });
    items.push(L1('a3-bare-l1', 'A bare model', 1280, 360, 72, fade(L, 0.2) * fadeOut(L, tCh - 0.3, 0.25)));
    items.push(L1('a3-bare-l1b', 'Change one, every result moves', 1280, 360, 48, fade(L, tCh - 0.1, 0.3)));
    // the end balances of every start year (real data) grey out: each of them rests on these four rules
    const grey = smooth((L - tCh - 0.4) / 1.2);
    ST.forEach((s, i) => {
      const h = s.endReal * 180 / 5.4e6, x = 1040 + i * 11, gr = smooth((L - tCh + 0.4 - i * 0.01) / 0.4);
      items.push(S('a3-bare-e' + s.y, 'rect', { panel: 'a3-bare', z: 0, rect: [x, 860 - Math.max(2, h * gr), 8, Math.max(2, h * gr)], fill: grey > 0.5 ? C.muted : s.depleted ? C.loss : C.gain, alpha: 1 - 0.5 * grey,
        meta: { role: 'bar', panel: 'a3-bare', chart: 'a3-bare', value: s.endReal, full: gr >= 1, orient: 'v', year: s.y } }));
    });
    items.push(Tx('a3-bare-ecap', 'every start year\u2019s result rests on these rules', 1040, 920, 30, C['text-dim'], { alpha: fade(L, tCh + 0.6), level: 3 }));
    items.push(S('a3-bare-eb', 'polyline', { panel: 'a3-bare', z: 0, pts: [[1030, 860], [1810, 860]], stroke: C.muted, lw: 2, alpha: fade(L, tCh - 0.4, 0.4), meta: { role: 'axis', panel: 'a3-bare', chart: 'a3-bare' } }));
    return items;
  };
  CAM['a3-bare'] = { f: 50, base: { z: -250, x: -150, tx: -150 }, moves: [[0.8, 1.4, { z: 250, x: 150, tx: 150 }]] };
})();
