'use strict';
// Act 2 builders: the two balances year by year. A small set of recurring, data-accurate charts, reused with variation:
//   duel()    the two REAL balances (amber solid 1966 retiree, blue dashed mirror), 1966..1995, drawn up to the narrated year,
//             optionally with the gap between them shaded (peaks in 1986)
//   bars()    value bars on a zero baseline (returns: gain/loss colours; inflation; withdrawals; balances)
//   ledgers   one level-1 number (the scene's claim) + a small supporting chart
// Every number is a claim span revealed at its spoken cue; mirror numbers carry an ILLUSTRATIVE badge next to them;
// money carries its basis ("in 1966 dollars" / "real dollars" / "nominal dollars").
(function () {
  const { B, K } = window.SCENES;
  const { D, C, M, clamp, smooth, easeOut, back, fade, fadeOut, cueAbs, lineStart, S, Tx, L1, claim, badge, env, axisX, series, charShape, colorOf } = K;
  const CAM = (window.CAMS && window.CAMS.CAM) || {};

  // ---------------------------------------------------------------- small helpers
  const cueL = (H) => (sid, w, off = 0) => { try { return H.local(cueAbs(sid, w)); } catch (e) { try { return H.local(lineStart(sid)) + off; } catch (e2) { return off; } } };
  const on = (L, t) => (L >= t - 1 / 60 ? 1 : 0);
  const txtW = (s, size) => s.length * size * 0.56;
  const cl = (...ids) => ids.map(claim);
  // basis label: 'real dollars' until the voice says "1966", then 'in 1966 dollars' (a claim span on 1966)
  function basis(items, id, x, y, L, t1966, a, o = {}) {
    const said = L >= t1966 - 1 / 60;
    items.push(Tx(id, said ? 'in 1966 dollars' : 'real dollars', x, y, o.size || 34, C['text-dim'], { align: o.align || 'center', alpha: a, level: 2, claims: said ? cl('y1966') : [] }));
  }
  function bar(items, panel, chart, id, x, yb, w, v, s, g, fill, a, o = {}) {
    const h = Math.abs(v) * s * g;
    if (h <= 0.01 || a <= 0) return;
    items.push(S(id, 'rect', { panel, z: o.z ?? 0, rect: [x, v >= 0 ? yb - h : yb, w, h], radius: o.radius ?? 3, fill, alpha: a, stroke: o.stroke || null, lw: o.lw || 0, dash: o.dash || null,
      meta: { role: 'bar', panel, chart, value: v, full: g >= 0.999, orient: 'v', ...(o.char ? charShape(o.char) : {}) } }));
  }
  function base(items, panel, chart, x0, x1, y, a = 1, z = 0) {
    items.push(S(panel + '-' + chart + '-zero', 'polyline', { panel, chart, z, pts: [[x0, y], [x1, y]], stroke: C.muted, lw: 2, alpha: a, meta: { role: 'axis', panel, chart } }));
  }
  function yearAnchors(items, panel, chart, H, xa, xb, y, a = 1, z = 0) {
    const pa = H.P(xa, y, z), pb = H.P(xb, y, z);
    const cx = (x) => clamp(x, 140, 1780), cy = (y) => Math.min(1004, y);
    items.push(Tx(panel + '-ax0', '1966', cx(pa[0]), cy(pa[1] + 46), 30, C['text-dim'], { role: 'axis-label', anchor: chart, chart, year: 1966, align: 'center', claims: cl('ax1966'), alpha: a, sharp: true }));
    items.push(Tx(panel + '-ax1', '1995', cx(pb[0]), cy(pb[1] + 46), 30, C['text-dim'], { role: 'axis-label', anchor: chart, chart, year: 1995, align: 'center', claims: cl('ax1995'), alpha: a, sharp: true }));
  }

  // ---------------------------------------------------------------- chart 1: the duel of real balances
  function duelGeo(o = {}) {
    const x0 = o.x0 ?? 360, x1 = o.x1 ?? 1560, yb = o.yb ?? 860, yt = o.yt ?? 300, vmax = o.vmax ?? 2.2e6;
    return { x0, x1, yb, yt, X: (k) => x0 + (x1 - x0) * k / 30, Y: (v) => yb - (yb - yt) * v / vmax };
  }
  function upto(arr, p, g) {
    p = clamp(p, 0, 30);
    const n = Math.floor(p), pts = [];
    for (let k = 0; k <= n; k++) pts.push([g.X(k), g.Y(arr[k])]);
    if (p > n && n < 30) { const f = p - n; pts.push([g.X(n + f), g.Y(arr[n] + (arr[n + 1] - arr[n]) * f)]); }
    if (pts.length < 2) pts.push([g.X(p) + 0.5, g.Y(arr[0])]);
    return pts;
  }
  const valAt = (arr, p) => { p = clamp(p, 0, 30); const n = Math.floor(p); return n >= 30 ? arr[30] : arr[n] + (arr[n + 1] - arr[n]) * (p - n); };
  // o: p66, pm (years drawn, 0..30), a66, am (alpha), band [k0, k1] (gap shaded), lk66, lkm (label year), axisA
  function duel(items, panel, H, o = {}) {
    const g = duelGeo(o), chart = panel + '-duel', z = o.z ?? 0;
    axisX(items, panel + '-axis', chart, g.x0, g.x1, g.yb, z, panel, o.axisA ?? 1);
    yearAnchors(items, panel, chart, H, g.x0, g.x1, g.yb, o.axisA ?? 1, z);
    if (o.band && o.band[1] > o.band[0]) {
      const [k0, k1] = o.band, pts = [];
      const steps = Math.max(2, Math.ceil((k1 - k0) * 2));
      for (let i = 0; i <= steps; i++) { const k = k0 + (k1 - k0) * i / steps; pts.push([g.X(k), g.Y(valAt(M.realMirror, k))]); }
      for (let i = steps; i >= 0; i--) { const k = k0 + (k1 - k0) * i / steps; pts.push([g.X(k), g.Y(valAt(M.real1966, k))]); }
      items.push(S(panel + '-band', 'poly', { panel, chart, z, pts, fill: C.cmirror, alpha: (o.bandA ?? 0.2), meta: { role: 'mark', panel, chart } }));
    }
    for (const ch of ['1966', 'mirror']) {
      const p = ch === '1966' ? o.p66 : o.pm, a = ch === '1966' ? (o.a66 ?? 1) : (o.am ?? 1);
      if (p == null || a <= 0) continue;
      const arr = ch === '1966' ? M.real1966 : M.realMirror;
      const lab = `${panel}-lab-${ch}`;
      series(items, `${panel}-${ch}`, chart, ch, upto(arr, p, g), z, panel, a, lab);
      const txt = ch === '1966' ? 'first retiree' : 'mirror retiree';
      // label: bold 34 px on a dark plate (legible at 25 %, and under motion blur), kept on the side away from the other line
      // and from the zero axis, and inside the safe area (flipped to the left of the tip near the right edge)
      const other = ch === '1966' ? o.pm : o.p66, oa = ch === '1966' ? (o.am ?? 1) : (o.a66 ?? 1);
      const v = valAt(arr, p), ov = other != null && oa > 0 && other >= p - 0.5 ? valAt(ch === '1966' ? M.realMirror : M.real1966, Math.min(p, other)) : null;
      let up = ov != null ? v >= ov : ch === 'mirror';
      if (!up && g.Y(v) > g.yb - 70) up = true;
      const w = txtW(txt, 34) * 0.95;
      let sx, sy, al = 'left';
      if (o.startLabels || (ch === '1966' && v < 1e5 && p < 3)) { // left of the common start point
        const sp = H.P(g.X(0), g.Y(arr[0]), z);
        sx = sp[0] - 18; sy = sp[1] + (ch === '1966' ? 44 : -20); al = 'right';
      } else { // at the tip
        const sp = H.P(g.X(p), g.Y(v), z);
        sx = sp[0] + (o.tipDx ?? 20); sy = sp[1] + (up ? -22 : 44);
        if (sx + w > 1800) { const back = valAt(arr, Math.max(0, p - 3)); sx = sp[0] - 20; al = 'right'; sy = sp[1] + (back > v ? 48 : -26); }
      }
      sy = clamp(sy, 90, 1000);
      items.push(Tx(lab, txt, sx, sy, 34, colorOf(ch), { align: al, weight: 700, background: C.surface, pad: 6, sharp: true, alpha: (a > 0.02 ? 1 : 0) * fade(p, 0.15, 0.3), series: ch, level: 3 }));
    }
    return g;
  }

  // ---------------------------------------------------------------- scenes
  // establishing: the empty duel stage, both balances at the start line; the year ticks light up one by one
  B['a2-est'] = (L, sc, H) => {
    const items = [], P = 'a2-est'; env(items, P, { glow: 0.10, gx: 1400 });
    const W = cueL(H);
    const yb = W('a2-est.1', 'year', 2.7);
    const g = duel(items, P, H, { p66: 0.9 * smooth((L - yb) / 1.2), pm: 0.9 * smooth((L - yb) / 1.2) });
    for (let k = 0; k < 30; k++) {
      const a = clamp((L - 0.4 - k * 0.1) / 0.2);
      items.push(S(`${P}-tick${k}`, 'polyline', { panel: P, chart: P + '-duel', z: 0, pts: [[g.X(k + 0.5), g.yb - 8], [g.X(k + 0.5), g.yb + 8]], stroke: C.muted, lw: 2, alpha: a, meta: { role: 'axis', panel: P, chart: P + '-duel' } }));
    }
    for (const ch of ['mirror', '1966']) items.push(S(`${P}-dot-${ch}`, 'circle', { panel: P, z: 0, c: [g.X(0), g.Y(1e6)], r: (ch === '1966' ? 9 : 17) * back((L - 0.3) / 0.4), fill: colorOf(ch), alpha: fade(L, 0.3, 0.2), meta: { role: 'mark', panel: P, ...charShape(ch) } }));
    items.push(L1(P + '-l1', 'Year by year', 1280, 360, 72, fade(L, W('a2-est.1', 'balances', 1.3) - 0.3, 0.3)));
    items.push(Tx(P + '-sub', 'both balances in real dollars', 1280, 440, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.6), level: 2 }));
    return items;
  };
  CAM['a2-est'] = { f: 24, base: { y: -300, ty: -150, z: -200 }, moves: [[0.6, 1.4, { y: 300, ty: 150, z: 200 }]], why: 'crane down from the high wide onto the stage where the two balances start' };

  // the question: one start point, a fork opening (when?) and the distance between the prongs (how much?)
  B['a2-q'] = (L, sc, H) => {
    const items = [], P = 'a2-q'; env(items, P, { glow: 0.09 });
    const W = cueL(H), tWhen = W('a2-q.1', 'when', 1.3), tHow = W('a2-q.1', 'how', 4.9);
    const u = smooth((L - 0.3) / 3.5), sx = 560, sy = 800;
    for (const [ch, dir] of [['1966', 1], ['mirror', -1]]) {
      const pts = []; for (let i = 0; i <= 6; i++) { const f = i / 6 * u; pts.push([sx + 800 * f, sy - dir * 0 - (dir < 0 ? 1 : -0.35) * 260 * f * f]); }
      items.push(S(`${P}-${ch}`, 'polyline', { panel: P, z: 150, pts, stroke: colorOf(ch), lw: 6, dash: ch === 'mirror' ? [18, 12] : null, meta: { role: 'mark', panel: P, ...charShape(ch) } }));
    }
    const ex = sx + 800 * u, e1 = sy + 0.35 * 260 * u * u, e2 = sy - 260 * u * u;
    const gb = smooth((L - tHow) / 0.8);
    items.push(S(`${P}-gap`, 'polyline', { panel: P, z: 150, pts: [[ex + 30, e1], [ex + 30, e1 + (e2 - e1) * gb]], stroke: C.text, lw: 4, alpha: gb > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    items.push(S(`${P}-origin`, 'circle', { panel: P, z: 150, c: [sx, sy], r: 12, fill: C.text, meta: { role: 'mark', panel: P } }));
    items.push(L1(P + '-l1', 'When does order matter?', 960, 300, 64, fade(L, tWhen - 0.2, 0.3)));
    items.push(Tx(P + '-l2', 'And what does it cost?', 960, 400, 44, C['text-dim'], { align: 'center', alpha: fade(L, tHow - 0.1, 0.3), level: 2 }));
    return items;
  };
  CAM['a2-q'] = { f: 50, base: { z: -300 }, moves: [[0.6, 1.4, { z: 320 }]], why: 'push in as the question is asked' };

  // year one: two bars on one zero line, 1966 return (left) vs the mirror's first year = 1995 return (right)
  B['a2-y1'] = (L, sc, H) => {
    const items = [], P = 'a2-y1'; env(items, P, { glow: 0.09 });
    const W = cueL(H), t48 = W('a2-y1.2', '4.8%', 3.2), t95 = W('a2-y1.3', '1995', 6.8), t317 = W('a2-y1.3', '31.7%', 9.8), t66 = W('a2-y1.2', '1966', 1.4);
    const yb = 660, s = 10, xa = 620, xm = 1140, w = 180;
    base(items, P, 'y1', 420, 1520, yb);
    bar(items, P, 'y1', P + '-b66', xa, yb, w, M.ret1966[0] * 100, s, smooth((L - (t48 - 0.4)) / 0.4), C.loss, 1);
    bar(items, P, 'y1', P + '-bm', xm, yb, w, M.retMirror[0] * 100, s, smooth((L - (t317 - 0.9)) / 0.9), C.gain, 1);
    // who: character tags under the zero line
    items.push(S(P + '-t66', 'rect', { panel: P, z: 0, rect: [xa, yb + 90, w, 10], radius: 4, fill: C.c1966, alpha: fade(L, 0.3), meta: { role: 'mark', panel: P, ...charShape('1966') } }));
    items.push(S(P + '-tm', 'polyline', { panel: P, z: 0, pts: [[xm, yb + 95], [xm + w, yb + 95]], stroke: C.cmirror, lw: 10, dash: [18, 12], alpha: fade(L, W('a2-y1.3', 'mirror', 5.5) - 0.2), meta: { role: 'mark', panel: P, ...charShape('mirror') } }));
    const pa = H.P(xa + w / 2, yb + 100, 0), pm = H.P(xm + w / 2, yb + 100, 0);
    items.push(Tx(P + '-n66', '1966 retiree', pa[0], pa[1] + 50, 32, C.c1966, { align: 'center', series: '1966', claims: cl('y1966'), alpha: on(L, t66) }));
    items.push(Tx(P + '-v66', 'loses 4.8%', pa[0], pa[1] + 96, 36, C.text, { align: 'center', weight: 700, claims: cl('ret1966'), alpha: on(L, t48), level: 2 }));
    items.push(Tx(P + '-nm', 'mirror retiree', pm[0], pm[1] + 50, 32, C.cmirror, { align: 'center', series: 'mirror', alpha: fade(L, W('a2-y1.3', 'mirror', 5.5) - 0.2) }));
    items.push(Tx(P + '-ym', '1995 return first', pm[0], pm[1] + 96, 32, C['text-dim'], { align: 'center', claims: cl('y1995'), alpha: on(L, t95), level: 3 }));
    const top = H.P(xm + w / 2, yb - M.retMirror[0] * 100 * s, 0);
    items.push(badge(P + '-badge', top[0] + 20, top[1] - 22, fade(L, t317 - 0.4, 0.2)));
    items.push(Tx(P + '-vm', 'gains 31.7%', top[0] - 12, top[1] - 22, 36, C.text, { align: 'right', weight: 700, claims: cl('ret1995m'), alpha: on(L, t317), level: 2 }));
    items.push(L1(P + '-l1', 'Year one', 640, 360, 72, fade(L, W('a2-y1.1', 'year', 0.1) - 0.1, 0.3)));
    return items;
  };
  CAM['a2-y1'] = { f: 50, base: { z: -350 }, moves: [[0.6, 1.4, { z: 350 }]], why: 'push in to the first year of the two paths' };

  // one year in: the duel, first segment drawn, a bracket shows the split already
  B['a2-gap1'] = (L, sc, H) => {
    const items = [], P = 'a2-gap1'; env(items, P, { glow: 0.08, gx: 400 });
    const W = cueL(H), tSplit = W('a2-gap1.1', 'split', 2.6), tPaths = W('a2-gap1.1', 'paths', 1.8);
    const p = smooth((L - 0.2) / 1.6);
    const g = duel(items, P, H, { p66: p, pm: p, band: [0, p], bandA: 0.25 });
    const gb = smooth((L - (tPaths - 0.2)) / 0.5), x = g.X(1) + 18;
    items.push(S(P + '-brk', 'polyline', { panel: P, z: 0, pts: [[x, g.Y(M.real1966[1])], [x, g.Y(M.real1966[1]) + (g.Y(M.realMirror[1]) - g.Y(M.real1966[1])) * gb]], stroke: C.text, lw: 4, alpha: gb > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    items.push(L1(P + '-l1', 'Already split', 1280, 360, 72, fade(L, Math.min(0.4, tSplit - 0.5), 0.3)));
    return items;
  };
  CAM['a2-gap1'] = { f: 35, base: {}, moves: [[0.6, 1.3, { z: 300 }]], why: 'push in on the first year, where the split is' };

  // inflation climbs: inflation bars 1966..1969 rise, then every withdrawal (nominal) grows with it
  function inflRow(items, P, H, L, n, grow, o = {}) {
    const x0 = o.x0 ?? 300, w = o.w ?? 44, yb = o.yb ?? 560, s = o.s ?? 14, chart = 'infl';
    base(items, P, chart, x0 - 10, x0 + (o.nAxis ?? 30) * w, yb, o.axA ?? 1);
    for (let k = 0; k < n; k++) bar(items, P, chart, `${P}-inf${k}`, x0 + k * w, yb, w - 10, M.infl[k] * 100, s, grow(k), C.inflation, (o.hi && !o.hi.includes(k)) ? 0.45 : 1);
    return { x0, w, yb, s };
  }
  function wdRow(items, P, H, L, n, grow, o = {}) {
    const x0 = o.x0 ?? 300, w = o.w ?? 44, yb = o.yb ?? 940, s = o.s ?? 0.0022, chart = 'wd';
    base(items, P, chart, x0 - 10, x0 + 30 * w, yb, o.axA ?? 1);
    for (let k = 0; k < n; k++) bar(items, P, chart, `${P}-wd${k}`, x0 + k * w, yb, w - 10, M.wd1966[k], s, grow(k), o.fill || C.c1966, 1, { char: o.fill ? null : '1966' });
    return { x0, w, yb, s };
  }
  B['a2-infl'] = (L, sc, H) => {
    const items = [], P = 'a2-infl'; env(items, P, { glow: 0.09, gx: 1500 });
    const W = cueL(H), t69 = W('a2-infl.2', '1969', 2.8), t62 = W('a2-infl.2', '6.2%', 4.3), tWd = W('a2-infl.2', 'withdrawal', 7.5), tIn = W('a2-infl.1', 'inflation', 0.5);
    const gi = inflRow(items, P, H, L, 4, (k) => smooth((L - tIn - k * 0.55) / 0.5), { yb: 560, s: 18 });
    const gw = wdRow(items, P, H, L, 16, (k) => smooth((L - (tWd - 0.8) - k * 0.1) / 0.3), { yb: 960, s: 0.0028, axA: fade(L, tWd - 1.0) });
    const top = H.P(gi.x0 + 3 * gi.w + 17, gi.yb - M.infl[3] * 100 * gi.s, 0);
    items.push(Tx(P + '-v', '6.2% a year', top[0] + 36, top[1] + 10, 40, C.text, { weight: 700, claims: cl('inf1969'), alpha: on(L, t62), level: 2 }));
    const b3 = H.P(gi.x0 + 3 * gi.w + 17, gi.yb, 0);
    items.push(Tx(P + '-y', '1969', b3[0], b3[1] + 44, 30, C['text-dim'], { align: 'center', claims: cl('y1969'), alpha: on(L, t69), level: 3 }));
    items.push(Tx(P + '-cap1', 'inflation per year', H.P(gi.x0 + 4 * gi.w + 30, gi.yb, 0)[0], H.P(gi.x0, gi.yb, 0)[1] + 44, 30, C.inflation, { alpha: fade(L, tIn), level: 3 }));
    const wl = H.P(gw.x0 + 16 * gw.w + 30, gw.yb, 0);
    items.push(Tx(P + '-cap2', 'each withdrawal, nominal', wl[0], wl[1] - 20, 30, C.c1966, { alpha: fade(L, tWd), level: 3, series: '1966' }));
    items.push(L1(P + '-l1', 'Inflation climbs', 1280, 360, 72, fade(L, tIn - 0.2, 0.3)));
    return items;
  };
  CAM['a2-infl'] = { f: 50, base: { y: -260, ty: -160 }, moves: [[0.6, 1.4, { y: 260, ty: 160 }]], why: 'tilt down from the inflation row towards the withdrawals it will push up' };

  // 1973 and 1974: the duel drawn to the end of 1974, the two losing years marked on the chart
  B['a2-7374'] = (L, sc, H) => {
    const items = [], P = 'a2-7374'; env(items, P, { glow: 0.07, gx: 400 });
    const W = cueL(H), t73 = W('a2-7374.1', '1973', 3.5), t74 = W('a2-7374.1', '1974', 4.8), tLose = W('a2-7374.1', 'lose', 2.8);
    const p = 7 + 2 * smooth((L - (tLose - 0.3)) / (t74 - tLose + 0.6));
    const g = duel(items, P, H, { p66: 7 * smooth((L - 0.1) / 1.6) + (p - 7) * (L > 1.8 ? 1 : 0), pm: 7 * smooth((L - 0.1) / 1.6) + (p - 7) * (L > 1.8 ? 1 : 0) });
    for (const [k, t, yr] of [[7, t73, 'y1973'], [8, t74, 'y1974']]) {
      const a = fade(L, t - 0.25, 0.25);
      items.push(S(`${P}-span${k}`, 'rect', { panel: P, z: 20, rect: [g.X(k) + 2, g.yt - 30, g.X(k + 1) - g.X(k) - 4, g.yb - g.yt + 28], fill: C.loss, alpha: 0.16 * a, meta: { role: 'mark', panel: P } }));
      const q = H.P((g.X(k) + g.X(k + 1)) / 2, g.yt - 30, 20);
      items.push(Tx(`${P}-y${k}`, yr === 'y1973' ? '1973' : '1974', q[0], q[1] - 16 - (k === 8 ? 40 : 0), 32, C.loss, { align: 'center', weight: 700, claims: cl(yr), alpha: on(L, t), level: 2 }));
    }
    items.push(L1(P + '-l1', 'Stocks and bonds both lose', 1280, 720, 56, fade(L, tLose - 1.0, 0.3)));
    items.push(Tx(P + '-sub', 'after inflation', 1280, 800, 34, C['text-dim'], { align: 'center', alpha: fade(L, 0.3), level: 2 }));
    return items;
  };
  CAM['a2-7374'] = { f: 35, base: {}, moves: [[0.6, 1.5, { z: 300 }]], why: 'push in on 1973 and 1974, the years the line is about' };

  // 1974 alone: the portfolio's loss (down) against price rise (up) on one zero line
  B['a2-1974inf'] = (L, sc, H) => {
    const items = [], P = 'a2-1974inf'; env(items, P, { glow: 0.07, gx: 1500 });
    const W = cueL(H), t74 = W('a2-1974inf.1', '1974', 0.2), tL = W('a2-1974inf.1', '14.7%', 2.9), tI = W('a2-1974inf.1', '12.3%', 6.3);
    const yb = 600, s = 18, w = 220, xa = 1000, xb = 1380;
    base(items, P, 'y74', 900, 1700, yb);
    bar(items, P, 'y74', P + '-ret', xa, yb, w, M.ret1966[8] * 100, s, smooth((L - (tL - 0.5)) / 0.5), C.loss, 1);
    bar(items, P, 'y74', P + '-inf', xb, yb, w, M.infl[8] * 100, s, smooth((L - (tI - 0.5)) / 0.5), C.inflation, 1);
    const pr = H.P(xa + w / 2, yb - M.ret1966[8] * 100 * s, 0), pi = H.P(xb + w / 2, yb - M.infl[8] * 100 * s, 0);
    items.push(Tx(P + '-vr', 'portfolio loses 14.7%', pr[0], pr[1] + 56, 38, C.text, { align: 'center', weight: 700, claims: cl('loss1974'), alpha: on(L, tL), level: 2 }));
    items.push(Tx(P + '-vi', 'prices rise 12.3%', pi[0], pi[1] - 26, 38, C.text, { align: 'center', weight: 700, claims: cl('inf1974'), alpha: on(L, tI), level: 2 }));
    items.push(L1(P + '-l1', '1974', 640, 360, 110, on(L, t74), { claims: cl('y1974') }));
    items.push(Tx(P + '-sub', 'one year, hit twice', 640, 470, 34, C['text-dim'], { align: 'center', alpha: fade(L, tI + 0.4), level: 2 }));
    return items;
  };
  CAM['a2-1974inf'] = { f: 85, base: { z: -400 }, moves: [[0.6, 1.3, { z: 400 }]], why: 'push in on the single year 1974' };

  // ledger: the 1966 retiree's real balance, year-end 1966..1974, falling; the number at its cue
  function balBars(items, P, H, L, char, n, grow, o = {}) {
    const arr = char === 'mirror' ? M.realMirror : M.real1966;
    const x0 = o.x0 ?? 1000, w = o.w ?? 70, yb = o.yb ?? 900, s = o.s ?? 0.00032;
    base(items, P, 'bal-' + char, x0 - 10, x0 + n * w, yb);
    for (let k = 0; k < n; k++) bar(items, P, 'bal-' + char, `${P}-${char}-b${k}`, x0 + k * w, yb, w - 14, arr[k + 1], s, grow(k), colorOf(char), o.a ? o.a(k) : 1, { char, dash: char === 'mirror' ? [14, 8] : null });
    return { x0, w, yb, s };
  }
  B['a2-bal74'] = (L, sc, H) => {
    const items = [], P = 'a2-bal74'; env(items, P, { glow: 0.08, gx: 500 });
    const W = cueL(H), t74 = W('a2-bal74.1', '1974', 4.1), tV = W('a2-bal74.1', '$461,000', 6.2);
    const g = balBars(items, P, H, L, '1966', 9, (k) => smooth((L - 0.4 - k * 0.42) / 0.4), { x0: 1060, w: 76, s: 0.00046 });
    // the starting balance as a thin reference line (no number)
    items.push(S(P + '-ref', 'polyline', { panel: P, z: 0, pts: [[g.x0 - 10, g.yb - 1e6 * g.s], [g.x0 + 9 * g.w, g.yb - 1e6 * g.s]], stroke: C.muted, lw: 2, dash: [10, 8], alpha: fade(L, 0.3), meta: { role: 'mark', panel: P } }));
    const r = H.P(g.x0 + 9 * g.w, g.yb - 1e6 * g.s, 0);
    items.push(Tx(P + '-refl', 'starting balance', r[0] - 4, r[1] - 16, 30, C['text-dim'], { align: 'right', alpha: fade(L, 0.4), level: 3 }));
    // the loss since the start: a bracket from the start line down to the 1974 bar, drawn after the number
    const bu = smooth((L - (tV + 0.3)) / 1.2), bx = g.x0 + 9 * g.w - 4, y0 = g.yb - 1e6 * g.s, y1 = g.yb - M.real1966[9] * g.s;
    items.push(S(P + '-drop', 'polyline', { panel: P, z: 0, pts: [[bx, y0], [bx, y0 + (y1 - y0) * bu]], stroke: C.loss, lw: 5, alpha: bu > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    const e = H.P(g.x0 + 8 * g.w + 28, g.yb, 0);
    items.push(Tx(P + '-e74', 'end of 1974', e[0] + 34, e[1] + 46, 30, C['text-dim'], { align: 'right', claims: cl('y1974'), alpha: on(L, t74), level: 3 }));
    items.push(Tx(P + '-who', '1966 retiree, real balance', g.x0 - 10, 250, 32, C.c1966, { series: '1966', claims: cl('y1966'), alpha: fade(L, 0.3), level: 3 }));
    items.push(L1(P + '-l1', '$461,000', 640, 720, 104, on(L, tV), { claims: cl('bal74') }));
    basis(items, P + '-basis', 640, 830, L, 0.25, on(L, tV));
    items.push(Tx(P + '-pre', 'ends the year with', 640, 610, 36, C['text-dim'], { align: 'center', alpha: fade(L, t74 - 0.2), level: 2 }));
    return items;
  };
  CAM['a2-bal74'] = { f: 85, base: { x: 320, tx: 320 }, moves: [[0.6, 1.5, { x: -320, tx: -320 }]], why: 'slide from the falling bars to the ledger number' };

  // twin ledger: same year, the mirror's real balance; the 1966 bars sit beside it for scale
  B['a2-bal74m'] = (L, sc, H) => {
    const items = [], P = 'a2-bal74m'; env(items, P, { glow: 0.08, key: C['rim-light'], gx: 1500 });
    const W = cueL(H), tV = H.local(266.66) /* onset of '$1.27 million' measured on the master mix (checks ASR) */, t66 = W('a2-bal74m.1', '1966', 5.6), tM = W('a2-bal74m.1', 'mirror', 0.2);
    const s = 0.00030;
    balBars(items, P, H, L, '1966', 9, () => 1, { x0: 170, w: 44, s });
    const g = balBars(items, P, H, L, 'mirror', 9, (k) => smooth((L - 0.3 - k * 0.3) / 0.35), { x0: 620, w: 44, s });
    items.push(Tx(P + '-a', 'first retiree', 170, 1000, 30, C.c1966, { series: '1966', alpha: 1, level: 3 }));
    items.push(Tx(P + '-b', 'mirror retiree', 620, 1000, 30, C.cmirror, { series: 'mirror', alpha: fade(L, tM), level: 3 }));
    items.push(badge(P + '-badge', 1110, 590, fade(L, tV - 0.4, 0.2)));
    items.push(L1(P + '-l1', '$1.27 million', 1360, 690, 80, on(L, tV), { claims: cl('bal74m') }));
    basis(items, P + '-basis', 1360, 790, L, t66, on(L, tV));
    items.push(Tx(P + '-same', 'same year, same withdrawals', 1360, 470, 34, C['text-dim'], { align: 'center', alpha: fade(L, W('a2-bal74m.1', 'same', 1.1) - 0.1), level: 2 }));
    void g;
    return items;
  };
  CAM['a2-bal74m'] = { f: 50, base: { z: 330 }, moves: [[0.6, 1.4, { z: -330 }]], why: 'pull back to put both retirees side by side' };

  // the bite: the same $40,000 taken from a full pile (1966) and from the cut pile (1975); pie area ~ balance
  function pie(items, P, id, cx, cy, r, share, a, char, z = 0) {
    const n = 72, pts = [[cx, cy]], ang = (u) => -Math.PI / 2 + u * Math.PI * 2;
    for (let i = 0; i <= n; i++) { const u = share + (1 - share) * i / n; pts.push([cx + r * Math.cos(ang(u)), cy + r * Math.sin(ang(u))]); }
    items.push(S(id + '-rest', 'poly', { panel: P, z, pts, fill: colorOf(char), alpha: a, meta: { role: 'mark', panel: P, ...charShape(char) } }));
    if (share > 0.001) {
      const q = [[cx, cy]], off = 26 * Math.min(1, share * 20);
      const mid = ang(share / 2), dx = Math.cos(mid) * off, dy = Math.sin(mid) * off;
      for (let i = 0; i <= 24; i++) { const u = share * i / 24; q.push([cx + r * Math.cos(ang(u)), cy + r * Math.sin(ang(u))]); }
      items.push(S(id + '-bite', 'poly', { panel: P, z, pts: q.map(([x, y]) => [x + dx, y + dy]), fill: C.loss, alpha: a, meta: { role: 'mark', panel: P } }));
    }
  }
  B['a2-bite'] = (L, sc, H) => {
    const items = [], P = 'a2-bite'; env(items, P, { glow: 0.09 });
    const W = cueL(H), tV = W('a2-bite.2', '$40,000', 5.65), t66 = W('a2-bite.2', '1966', 7.3), tSm = W('a2-bite.2', 'smaller', 11.3), tBad = W('a2-bite.1', 'bad', 0.7);
    const r0 = 215, r1 = r0 * Math.sqrt(M.real1966[9] / 1e6);
    const sh0 = 40000 / 1e6 * smooth((L - (tV - 0.3)) / 0.6), sh1 = 40000 / M.real1966[9] * smooth((L - (tSm - 0.8)) / 0.6);
    pie(items, P, P + '-p0', 560, 680, r0, sh0, fade(L, 0.2), '1966');
    pie(items, P, P + '-p1', 1360, 680 + (r0 - r1), r1, sh1, fade(L, tBad), '1966');
    const c0 = H.P(560, 680 + r0 + 56, 0), c1 = H.P(1360, 680 + r0 + 56, 0);
    items.push(Tx(P + '-c0', 'the pile at the start', c0[0], Math.min(1000, c0[1]), 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.3), level: 3 }));
    items.push(Tx(P + '-c1', 'after the bad start', c1[0], Math.min(1000, c1[1]), 32, C['text-dim'], { align: 'center', alpha: fade(L, tBad), level: 3 }));
    const inB = L >= 4.4;
    items.push(L1(P + '-l1', 'Hard to undo', 640, 360, 72, fade(L, 0.3) * fadeOut(L, 4.2, 0.2)));
    items.push(badge(P + '-badge', 1280 - 140, 214, inB ? fade(L, tV - 0.4, 0.2) : 0));
    items.push(L1(P + '-l1b', '$40,000', 1280, 330, 80, inB ? on(L, tV) : 0, { claims: cl('wd1') }));
    basis(items, P + '-basis', 1280, 420, L, t66, inB ? on(L, tV) : 0);
    items.push(Tx(P + '-still', 'same withdrawal, smaller pile', 1360, 480, 32, C['text-dim'], { align: 'center', alpha: inB ? fade(L, tSm - 0.8) : 0, level: 2 }));
    return items;
  };
  CAM['a2-bite'] = { f: 50, base: { z: -300 }, moves: [[0.6, 1.3, { z: 300 }]], why: 'push in on the two piles the withdrawal bites into' };

  // sold after the loss: a stack loses slabs to the loss, one slab is withdrawn, the recovery grows only what is left
  B['a2-sell'] = (L, sc, H) => {
    const items = [], P = 'a2-sell'; env(items, P, { glow: 0.07, gx: 1500 });
    const W = cueL(H), tLoss = W('a2-sell.1', 'loss', 1.6), tW = W('a2-sell.1', 'withdrawn', 0.6), tNot = W('a2-sell.1', 'not', 3.2), tRec = W('a2-sell.1', 'recovery', 4.9);
    const x = 520, yb = 940, h = 44, gap = 8, n = 10;
    const lost = [7, 8, 9];
    for (let k = 0; k < n; k++) {
      if (k === 6 && L > tW + 1.2) continue;
      const isLost = lost.includes(k), y = yb - (k + 1) * (h + gap);
      const drop = isLost ? smooth((L - (tLoss - 0.2) - (9 - k) * 0.08) / 0.5) : 0;
      items.push(S(`${P}-s${k}`, 'rect', { panel: P, z: 0, rect: [x - 60 * drop, y + 200 * drop, 320, h], radius: 6, fill: isLost ? C.loss : C.c1966, alpha: isLost ? 1 - drop : 1, meta: { role: 'mark', panel: P, ...(isLost ? {} : charShape('1966')) } }));
    }
    // the withdrawn slab (the top one left, k = 6) slides out to the right and leaves a hole
    const u = smooth((L - (tW + 1.2)) / 0.8);
    const y6 = yb - 7 * (h + gap);
    items.push(S(`${P}-out`, 'rect', { panel: P, z: 0, rect: [x + 420 * u, y6 - 30 * Math.sin(Math.PI * u), 320, h], radius: 6, fill: C.c1966, alpha: L > tW + 1.2 ? 1 : 0, meta: { role: 'mark', panel: P, ...charShape('1966') } }));
    items.push(S(`${P}-hole`, 'rect', { panel: P, z: 0, rect: [x, y6, 320, h], radius: 6, fill: null, stroke: C.muted, lw: 3, dash: [10, 8], alpha: fade(L, tNot - 0.3), meta: { role: 'mark', panel: P } }));
    // recovery: the remaining slabs grow by the same share; the hole does not
    const rg = smooth((L - tRec) / 0.8);
    for (let k = 0; k < 6; k++) {
      const y = yb - (k + 1) * (h + gap);
      items.push(S(`${P}-g${k}`, 'rect', { panel: P, z: 0, rect: [x + 320, y, 70 * rg, h], radius: 6, fill: C.gain, alpha: rg > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    }
    items.push(Tx(P + '-cr', 'recovery', x + 420, yb + 50, 30, C.gain, { alpha: fade(L, tRec), level: 3 }));
    items.push(Tx(P + '-cw', 'withdrawn', x + 480, y6 - 40, 30, C.c1966, { alpha: fade(L, tW + 1.6), level: 3, series: '1966' }));
    items.push(L1(P + '-l1', 'Gone before the recovery', 1280, 360, 60, fade(L, 0.3, 0.3)));
    return items;
  };
  CAM['a2-sell'] = { f: 85, base: { y: 280, ty: 150 }, moves: [[0.6, 1.4, { y: -280, ty: -150 }]], why: 'rise up the stack to where the slabs are lost' };

  // the term
  B['a2-seq'] = (L, sc, H) => {
    const items = [], P = 'a2-seq'; env(items, P, { glow: 0.12 });
    const W = cueL(H), t = W('a2-seq.1', 'sequence-of-returns', 0.5);
    const u = smooth((L - t) / 0.9);
    items.push(S(P + '-ul', 'polyline', { panel: P, z: 0, pts: [[960 - 420 * u, 620], [960 + 420 * u, 620]], stroke: C.text, lw: 4, alpha: u > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    // a short strip of returns reordering (1966 order -> mirror order) behind the term
    for (let k = 0; k < 12; k++) {
      const v = (M.ret1966[k] * (1 - u) + M.retMirror[k] * u) * 100;
      items.push(S(`${P}-b${k}`, 'rect', { panel: P, z: 600, rect: [620 + k * 58, v >= 0 ? 900 - v * 6 : 900, 44, Math.abs(v) * 6 + 0.1], fill: C.muted, alpha: 0.5, meta: { role: 'mark', panel: P } }));
    }
    items.push(L1(P + '-l1', 'Sequence-of-returns risk', 960, 540, 80, fade(L, t - 0.25, 0.25)));
    return items;
  };

  // good years do come: the return row 1966..1976, the last two bars rise
  function retRow(items, P, H, L, k0, k1, grow, o = {}) {
    const x0 = o.x0 ?? 300, w = o.w ?? 44, yb = o.yb ?? 700, s = o.s ?? 9, hi = o.hi || [];
    base(items, P, 'ret', x0 - 10 - k0 * w, x0 + (k1 + 1 - k0) * w, yb, o.axA ?? 1);
    for (let k = k0; k <= k1; k++) {
      const v = M.ret1966[k] * 100, x = x0 + (k - k0) * w;
      bar(items, P, 'ret', `${P}-r${k}`, x, yb, w - (o.gap ?? 10), v, s, grow(k), v >= 0 ? C.gain : C.loss, hi.length && !hi.includes(k) ? (o.dim ?? 0.4) : 1);
    }
    return { x0, w, yb, s, X: (k) => x0 + (k - k0) * w + (w - (o.gap ?? 10)) / 2 };
  }
  B['a2-7576'] = (L, sc, H) => {
    const items = [], P = 'a2-7576'; env(items, P, { glow: 0.10, gx: 1500 });
    retRow(items, P, H, L, 0, 10, (k) => (k < 9 ? 1 : smooth((L - 0.5 - (k - 9) * 0.35) / 0.5)), { x0: 300, w: 70, yb: 760, s: 12, hi: [9, 10] });
    items.push(L1(P + '-l1', 'Good years do come', 1280, 360, 64, fade(L, 0.1, 0.3)));
    return items;
  };

  // 1975 and 1976 close up
  B['a2-7576n'] = (L, sc, H) => {
    const items = [], P = 'a2-7576n'; env(items, P, { glow: 0.10, gx: 1500 });
    const W = cueL(H), t75 = W('a2-7576n.1', '1975', 0.2), t236 = W('a2-7576n.1', '23.6%', 2.2), t76 = W('a2-7576n.1', '1976', 4.7), t207 = W('a2-7576n.1', '20.7%', 6.5);
    const yb = 820, s = 17, w = 240, xa = 980, xb = 1360;
    base(items, P, 'r7576', 900, 1680, yb);
    bar(items, P, 'r7576', P + '-a', xa, yb, w, M.ret1966[9] * 100, s, smooth((L - (t236 - 0.7)) / 0.7), C.gain, 1);
    bar(items, P, 'r7576', P + '-b', xb, yb, w, M.ret1966[10] * 100, s, smooth((L - (t207 - 0.7)) / 0.7), C.gain, 1);
    const ta = H.P(xa + w / 2, yb - M.ret1966[9] * 100 * s, 0), tb = H.P(xb + w / 2, yb - M.ret1966[10] * 100 * s, 0);
    const ba = H.P(xa + w / 2, yb, 0), bb = H.P(xb + w / 2, yb, 0);
    items.push(Tx(P + '-va', '+23.6%', ta[0], ta[1] - 24, 44, C.text, { align: 'center', weight: 700, claims: cl('ret1975'), alpha: on(L, t236), level: 2 }));
    items.push(Tx(P + '-vb', '+20.7%', tb[0], tb[1] - 24, 44, C.text, { align: 'center', weight: 700, claims: cl('ret1976'), alpha: on(L, t207), level: 2 }));
    items.push(Tx(P + '-ya', '1975', ba[0], ba[1] + 50, 34, C['text-dim'], { align: 'center', claims: cl('y1975'), alpha: on(L, t75), level: 3 }));
    items.push(Tx(P + '-yb', '1976', bb[0], bb[1] + 50, 34, C['text-dim'], { align: 'center', claims: cl('y1976'), alpha: on(L, t76), level: 3 }));
    items.push(L1(P + '-l1', 'Two strong years', 640, 360, 64, fade(L, 0.2, 0.3)));
    items.push(Tx(P + '-sub', 'portfolio return', 640, 450, 34, C['text-dim'], { align: 'center', alpha: fade(L, 0.6), level: 2 }));
    return items;
  };
  CAM['a2-7576n'] = { f: 85, base: { z: -350 }, moves: [[0.6, 1.4, { z: 350 }]], why: 'push in on the two good years' };

  // but on a cut balance: the 1966 real line to 1976 far below the start, withdrawals (nominal) still rising underneath
  B['a2-7576b'] = (L, sc, H) => {
    const items = [], P = 'a2-7576b'; env(items, P, { glow: 0.07, gx: 400 });
    const W = cueL(H), tCut = W('a2-7576b.1', 'cut', 2.5), tWd = W('a2-7576b.1', 'withdrawals', 3.8);
    const g = duel(items, P, H, { p66: 8 + 3 * smooth((L - 0.3) / 1.6), x0: 520, x1: 1560, yb: 640, yt: 240, vmax: 1.2e6, l66dy: 60, ldx: 0 });
    // the start level as a dashed reference, the cut as a bracket from it to the 1974 low
    items.push(S(P + '-ref', 'polyline', { panel: P, z: 0, pts: [[g.X(0), g.Y(1e6)], [g.X(30), g.Y(1e6)]], stroke: C.muted, lw: 2, dash: [10, 8], alpha: 0.8, meta: { role: 'mark', panel: P } }));
    const cu = smooth((L - (tCut - 0.4)) / 0.5), xc = g.X(9) + 20;
    items.push(S(P + '-cut', 'polyline', { panel: P, z: 0, pts: [[xc, g.Y(1e6)], [xc, g.Y(1e6) + (g.Y(M.real1966[9]) - g.Y(1e6)) * cu]], stroke: C.loss, lw: 5, alpha: cu > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    const rp = H.P(g.X(30), g.Y(1e6), 0);
    items.push(Tx(P + '-refl', 'where it started', Math.min(1800, rp[0]), rp[1] - 18, 32, C['text-dim'], { align: 'right', alpha: 1, level: 3, background: C.surface, pad: 6, sharp: true }));
    // withdrawals, nominal, as a bar row under the chart
    const x0 = g.x0, w = (g.x1 - g.x0) / 30;
    base(items, P, 'wd', x0, x0 + 11 * w, 960, fade(L, tWd - 0.6));
    for (let k = 0; k <= 10; k++) bar(items, P, 'wd', `${P}-wd${k}`, x0 + k * w + 4, 960, w - 8, M.wd1966[k], 0.0022, smooth((L - (tWd - 0.5) - k * 0.1) / 0.3), C.inflation, 1);
    const wl = H.P(x0 + 11 * w + 20, 960, 0);
    items.push(Tx(P + '-wdl', 'withdrawals, nominal', wl[0], wl[1] - 10, 30, C.inflation, { alpha: fade(L, tWd), level: 3 }));
    items.push(L1(P + '-l1', 'Growth on a smaller base', 1280, 360, 56, fade(L, 0.3, 0.3)));
    return items;
  };
  CAM['a2-7576b'] = { f: 50, base: { x: 350, tx: 350 }, moves: [[0.6, 1.5, { x: -350, tx: -350 }]], why: 'travel back along the line to the cut it compounds from' };

  // inflation keeps rising: the inflation escalator extends through the late 1970s
  B['a2-grind'] = (L, sc, H) => {
    const items = [], P = 'a2-grind'; env(items, P, { glow: 0.06, gx: 1500 });
    const W = cueL(H), tI = W('a2-grind.1', 'inflation', 2.0);
    inflRow(items, P, H, L, 13, (k) => (k < 10 ? 1 : smooth((L - 0.5 - (k - 10) * 0.5) / 0.5)), { yb: 900, s: 26, x0: 300, w: 70, hi: [10, 11, 12], nAxis: 14 });
    items.push(Tx(P + '-cap', 'inflation per year', 300, 980, 30, C.inflation, { level: 3 }));
    items.push(L1(P + '-l1', 'Inflation keeps rising', 1280, 360, 60, fade(L, tI - 1.2, 0.3)));
    return items;
  };
  CAM['a2-grind'] = { f: 35, base: { x: -350, tx: -350 }, moves: [[0.6, 1.4, { x: 350, tx: 350 }]], why: 'walk along the escalator into the late 1970s' };

  B['a2-1979'] = (L, sc, H) => {
    const items = [], P = 'a2-1979'; env(items, P, { glow: 0.06, gx: 1500 });
    const W = cueL(H), t79 = W('a2-1979.1', '1979', 0.2), t133 = W('a2-1979.1', '13.3%', 1.9);
    const g = inflRow(items, P, H, L, 14, (k) => (k < 13 ? 1 : smooth((L - (t133 - 0.6)) / 0.6)), { yb: 900, s: 26, x0: 300, w: 70, hi: [13], nAxis: 14 });
    const tp = H.P(g.x0 + 13 * g.w + 30, g.yb - M.infl[13] * 100 * g.s, 0), bt = H.P(g.x0 + 13 * g.w + 30, g.yb, 0);
    items.push(Tx(P + '-v', '13.3%', tp[0] + 60, tp[1] + 16, 46, C.text, { weight: 700, claims: cl('inf1979'), alpha: on(L, t133), level: 2 }));
    items.push(Tx(P + '-y', '1979', bt[0], bt[1] + 46, 30, C['text-dim'], { align: 'center', claims: cl('y1979'), alpha: on(L, t79), level: 3 }));
    items.push(Tx(P + '-cap', 'inflation per year', 300, 980, 30, C.inflation, { level: 3 }));
    items.push(L1(P + '-l1', 'Prices at their peak', 1280, 360, 60, fade(L, 0.2, 0.3)));
    return items;
  };
  CAM['a2-1979'] = { f: 85, base: { z: -400 }, moves: [[0.6, 1.3, { z: 400 }]], why: 'push in on the 1979 peak' };

  // the withdrawal in nominal dollars has grown to $108,553; in 1966 dollars it is still $40,000 (flat line)
  B['a2-1981'] = (L, sc, H) => {
    const items = [], P = 'a2-1981'; env(items, P, { glow: 0.08, gx: 1500 });
    const W = cueL(H), t81 = W('a2-1981.1', '1981', 0.2), tV = W('a2-1981.1', '$108,553', 3.2), t66 = W('a2-1981.2', '1966', 9.4), t40 = W('a2-1981.2', '$40,000', 12.6);
    const x0 = 260, w = 46, yb = 920, s = 0.0034;
    base(items, P, 'wd', x0 - 10, x0 + 16 * w, yb);
    for (let k = 0; k < 16; k++) bar(items, P, 'wd', `${P}-wd${k}`, x0 + k * w, yb, w - 10, M.wd1966[k], s, smooth((L - 0.3 - k * 0.16) / 0.3), C.inflation, 1);
    const gu = smooth((L - (tV + 1.6)) / 1.4), gx = x0 + 16 * w + 6, ya = yb - M.wd1966[0] * s, yz = yb - M.wd1966[15] * s;
    items.push(S(P + '-grow', 'polyline', { panel: P, z: 0, pts: [[gx, ya], [gx, ya + (yz - ya) * gu]], stroke: C.text, lw: 4, alpha: gu > 0 && L < 8.9 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    items.push(S(P + '-grow0', 'polyline', { panel: P, z: 0, pts: [[x0 - 10, ya], [x0 - 10 + (gx - x0 + 10) * gu, ya]], stroke: C.text, lw: 2, dash: [8, 8], alpha: gu > 0 && L < 8.9 ? 0.8 : 0, meta: { role: 'mark', panel: P } }));
    const b = H.P(x0 + 15 * w + 18, yb, 0);
    items.push(Tx(P + '-y', '1981', b[0], b[1] + 62, 30, C['text-dim'], { align: 'center', claims: cl('y1981'), alpha: on(L, t81), level: 3 }));
    items.push(Tx(P + '-cap', 'withdrawal each year', x0, yb + 62, 30, C.inflation, { alpha: fade(L, 0.3), level: 3 }));
    const inB = L >= 8.9;
    items.push(L1(P + '-l1', '$108,553', 1280, 360, 96, inB ? 0 : on(L, tV), { claims: cl('wd1981') }));
    items.push(Tx(P + '-nb', 'nominal dollars', 1280, 450, 36, C['text-dim'], { align: 'center', alpha: inB ? 0 : on(L, tV), level: 2 }));
    // the real withdrawal: flat at $40,000 of 1966 money
    const fu = smooth((L - (t66 - 0.2)) / 1.2);
    items.push(S(P + '-flat', 'polyline', { panel: P, z: 0, pts: [[x0 - 10, yb - 40000 * s], [x0 - 10 + (16 * w + 10) * fu, yb - 40000 * s]], stroke: C.text, lw: 5, alpha: fu > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    items.push(badge(P + '-badge', 1080, 632, inB ? fade(L, t40 - 0.4, 0.2) : 0));
    items.push(L1(P + '-l1b', '$40,000', 1280, 720, 96, inB ? on(L, t40) : 0, { claims: cl('wd1') }));
    basis(items, P + '-basis', 1280, 810, L, t66, inB ? fade(L, t66 - 0.1, 0.2) : 0);
    items.push(Tx(P + '-real', 'the same money, in real terms', 1280, 470, 32, C['text-dim'], { align: 'center', alpha: inB ? fade(L, t66 + 0.4) : 0, level: 2 }));
    return items;
  };
  CAM['a2-1981'] = { f: 85, base: { z: -380 }, moves: [[0.6, 1.5, { z: 380 }]], why: 'push in on the withdrawal escalator as it reaches 1981' };

  // dawn: the full return row; the good run from 1982 lights up
  B['a2-1982'] = (L, sc, H) => {
    const items = [], P = 'a2-1982'; env(items, P, { glow: 0.14, gx: 1500 });
    const W = cueL(H), t82 = W('a2-1982.1', '1982', 0.9), tG = W('a2-1982.1', 'good', 3.1);
    const hiA = smooth((L - (tG - 0.3)) / 1.6);
    const good = [16, 17, 18, 19, 20, 22, 23];
    const g = retRow(items, P, H, L, 0, 29, () => 1, { x0: 300, w: 44, yb: 800, s: 9 });
    for (const k of good) {
      const on1 = clamp((hiA * good.length - good.indexOf(k)) / 1);
      items.push(S(`${P}-glow${k}`, 'rect', { panel: P, z: 0, rect: [g.x0 + k * g.w - 4, 800 - M.ret1966[k] * 100 * g.s - 14, g.w - 2, 10], radius: 4, fill: C.text, alpha: on1, meta: { role: 'mark', panel: P } }));
    }
    const b = H.P(g.X(16), 800, 0);
    items.push(Tx(P + '-y', '1982', b[0], b[1] + 50, 32, C.text, { align: 'center', weight: 700, claims: cl('y1982'), alpha: on(L, t82), level: 2 }));
    items.push(Tx(P + '-cap', 'return by year', 300, 1000, 30, C['text-dim'], { level: 3 }));
    items.push(L1(P + '-l1', 'The good years arrive', 640, 360, 64, fade(L, tG - 0.3, 0.3)));
    return items;
  };
  CAM['a2-1982'] = { f: 24, base: { x: -400, tx: -400 }, moves: [[0.7, 1.6, { x: 400, tx: 400 }]], why: 'pan right across the years to where the good run begins' };

  B['a2-1982r'] = (L, sc, H) => {
    const items = [], P = 'a2-1982r'; env(items, P, { glow: 0.12, gx: 500 });
    const W = cueL(H), t66 = W('a2-1982r.1', '1966', 0.6), tV = W('a2-1982r.1', '25.4%', 2.7);
    const yb = 860, s = 18, x = 520, w = 260;
    base(items, P, 'r82', 400, 900, yb);
    bar(items, P, 'r82', P + '-b', x, yb, w, M.ret1966[16] * 100, s, smooth((L - (tV - 0.9)) / 0.9), C.gain, 1);
    items.push(S(P + '-tag', 'rect', { panel: P, z: 0, rect: [x, yb + 20, w, 10], radius: 4, fill: C.c1966, meta: { role: 'mark', panel: P, ...charShape('1966') } }));
    items.push(L1(P + '-l1a', 'A strong year', 1280, 360, 72, L < tV - 0.2 ? fade(L, 0.3, 0.3) : 0));
    items.push(L1(P + '-l1', 'gains 25.4%', 1280, 360, 88, on(L, tV), { claims: cl('ret1982') }));
    items.push(Tx(P + '-who', '1966 retiree, that year', 1280, 470, 36, C.c1966, { align: 'center', claims: cl('y1966'), alpha: on(L, t66), series: '1966', level: 2 }));
    return items;
  };
  CAM['a2-1982r'] = { f: 50, base: { z: -350 }, moves: [[0.6, 1.3, { z: 350 }]], why: 'push in on the single good year' };

  // the share: the withdrawal as a share of the balance, 1966..1982, climbing to 16.9%
  B['a2-1982w'] = (L, sc, H) => {
    const items = [], P = 'a2-1982w'; env(items, P, { glow: 0.07, gx: 1500 });
    const W = cueL(H), tV = W('a2-1982w.1', '16.9%', 1.7), tLeft = W('a2-1982w.1', 'left', 4.2);
    const x0 = 900, w = 50, yb = 900, s = 22;
    base(items, P, 'share', x0 - 10, x0 + 17 * w, yb);
    for (let k = 0; k <= 16; k++) bar(items, P, 'share', `${P}-s${k}`, x0 + k * w, yb, w - 12, M.share1966[k] * 100, s, smooth((L - 0.2 - k * 0.08) / 0.3), k === 16 ? C.loss : C.muted, 1);
    // the whole balance as a strip, the withdrawal slice cut out of it at the cue
    const u = smooth((L - (tV - 0.2)) / 0.6), sx = 300, sw = 600, sy = 560;
    items.push(S(P + '-whole', 'rect', { panel: P, z: 0, rect: [sx, sy, sw * (1 - M.share1966[16]), 70], radius: 6, fill: C.c1966, meta: { role: 'mark', panel: P, ...charShape('1966') } }));
    items.push(S(P + '-slice', 'rect', { panel: P, z: 0, rect: [sx + sw * (1 - M.share1966[16]) + 8 + 40 * u, sy + 60 * u, sw * M.share1966[16] - 8, 70], radius: 6, fill: C.loss, meta: { role: 'mark', panel: P } }));
    items.push(Tx(P + '-cap', 'what is left', sx, sy + 118, 30, C['text-dim'], { alpha: fade(L, tLeft - 0.3), level: 3 }));
    items.push(Tx(P + '-cap2', 'withdrawal as a share of the balance', x0 - 10, yb + 62, 30, C['text-dim'], { alpha: fade(L, 0.3), level: 3 }));
    items.push(L1(P + '-l1', '16.9%', 640, 360, 110, on(L, tV), { claims: cl('share1982') }));
    return items;
  };
  CAM['a2-1982w'] = { f: 85, base: { x: 300, tx: 300 }, moves: [[0.6, 1.4, { x: -300, tx: -300 }]], why: 'slide from the rising share bars to the slice being taken' };

  // gains that still lost: 1979..1991, returns (up) vs withdrawal share (down) on one scale; the 8 years highlighted
  B['a2-gains80'] = (L, sc, H) => {
    const items = [], P = 'a2-gains80'; env(items, P, { glow: 0.08, gx: 1500 });
    const W = cueL(H), t8 = W('a2-gains80.1', '7', 0.1), t10 = W('a2-gains80.1', '10%', 1.8), tBal = W('a2-gains80.1', 'balance', 3.7), tFell = W('a2-gains80.1', 'fell', 6.8), tWd = W('a2-gains80.1', 'withdrawal', 8.1);
    const fell = [1979, 1980, 1983, 1985, 1986, 1988, 1989]; // claim gainsFell: years with gains above 10% in which money remained (1991, the year it ran out, is not one)
    const k0 = 13, k1 = 25, x0 = 300, w = 76, yb = 620, s = 3.6;
    base(items, P, 'g80', x0 - 10, x0 + 13 * w, yb);
    for (let k = k0; k <= k1; k++) {
      const x = x0 + (k - k0) * w, v = M.ret1966[k] * 100, isF = fell.includes(1966 + k) && M.real1966[k + 1] > 0 && M.real1966[k + 1] < M.real1966[k] && v > 10;
      const dim = L > t10 + 0.4 && !isF ? 0.35 : 1;
      bar(items, P, 'g80', `${P}-r${k}`, x, yb, w - 16, v, s, smooth((L - 0.1 - (k - k0) * 0.08) / 0.3), v >= 0 ? C.gain : C.loss, dim);
      bar(items, P, 'g80', `${P}-w${k}`, x, yb, w - 16, -M.share1966[k] * 100, s, smooth((L - (tBal - 0.2) - (k - k0) * 0.1) / 0.35), C.inflation, dim);
      if (isF) {
        const i = fell.indexOf(1966 + k), a = on(L, t8 + i * 0.12);
        const yTop = yb - v * s - 26;
        items.push(S(`${P}-mk${k}`, 'circle', { panel: P, z: 0, c: [x + (w - 16) / 2, yTop], r: 10 * back((L - t8 - i * 0.12) / 0.3), fill: C.text, alpha: a, meta: { role: 'mark', panel: P } }));
        // after "fell": a down arrow in the loss colour under the share bar
        const fa = smooth((L - (tFell - 0.3) - i * 0.08) / 0.3);
        const yB = yb + M.share1966[k] * 100 * s + 16;
        items.push(S(`${P}-dn${k}`, 'poly', { panel: P, z: 0, pts: [[x + 10, yB], [x + w - 26, yB], [x + (w - 16) / 2, yB + 26 * fa]], fill: C.loss, alpha: fa > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
      }
    }
    // the 10% line across the return bars
    const y10 = yb - 10 * s, ua = smooth((L - (t10 - 0.3)) / 0.5);
    items.push(S(P + '-t10', 'polyline', { panel: P, z: 0, pts: [[x0 - 10, y10], [x0 - 10 + (13 * w + 10) * ua, y10]], stroke: C.text, lw: 2, dash: [8, 8], alpha: ua > 0 ? 0.9 : 0, meta: { role: 'mark', panel: P } }));
    const tl = H.P(x0 + 13 * w + 16, y10, 0);
    items.push(Tx(P + '-l10', 'gain above 10%', tl[0], tl[1] + 11, 30, C.text, { claims: cl('gt10'), alpha: on(L, t10), level: 2 }));
    const rl = H.P(x0 - 10, yb - 140, 0), wl = H.P(x0 + 13 * w + 16, yb + 60, 0);
    items.push(Tx(P + '-cr', 'return', rl[0], rl[1], 30, C.gain, { alpha: fade(L, 0.2), level: 3 }));
    items.push(Tx(P + '-cw', 'taken by the withdrawal', wl[0], wl[1], 30, C.inflation, { alpha: fade(L, tBal - 0.2), level: 3 }));
    items.push(Tx(P + '-cw2', 'share of the balance', wl[0], wl[1] + 40, 30, C.inflation, { alpha: fade(L, tBal - 0.2), level: 3 }));
    items.push(L1(P + '-l1', D.claims.gainsFell.display, 1280, 330, 120, on(L, t8), { claims: cl('gainsFell') }));
    items.push(Tx(P + '-sub', 'big-gain years, money left, balance still fell', 1280, 432, 32, C['text-dim'], { align: 'center', alpha: fade(L, t8 + 0.3), level: 2 }));
    items.push(Tx(P + '-who2', '1966 retiree', 1280, 200, 30, C.c1966, { align: 'center', series: '1966', claims: cl('y1966'), alpha: on(L, W('a2-gains80.1', '1966', 4.4)), level: 3 }));
    items.push(Tx(P + '-fell', 'balance fell', H.P(x0 + 13 * w + 16, yb + 150, 0)[0], H.P(x0 + 13 * w + 16, yb + 150, 0)[1], 30, C.loss, { alpha: fade(L, tFell - 0.2), level: 3 }));
    void tWd;
    return items;
  };
  CAM['a2-gains80'] = { f: 50, base: { z: -300 }, moves: [[0.6, 1.4, { z: 300 }]], why: 'push in on the returns and the bites taken from them' };

  // too late: the 1966 line through the boom, still descending
  B['a2-late'] = (L, sc, H) => {
    const items = [], P = 'a2-late'; env(items, P, { glow: 0.10, gx: 1500 });
    const g = duel(items, P, H, { p66: 16 + 7 * smooth((L - 0.1) / 1.8) });
    const a = fade(L, 0.1);
    items.push(S(P + '-boom', 'rect', { panel: P, z: 20, rect: [g.X(16), g.yt - 30, g.X(24) - g.X(16), g.yb - g.yt + 28], fill: C.gain, alpha: 0.13 * a, meta: { role: 'mark', panel: P } }));
    const q = H.P((g.X(16) + g.X(24)) / 2, g.yt - 30, 20);
    items.push(Tx(P + '-bl', 'the boom', q[0], q[1] - 16, 32, C.gain, { align: 'center', alpha: a, level: 2 }));
    items.push(L1(P + '-l1', 'Too late', 640, 360, 80, fade(L, 0.9, 0.3)));
    return items;
  };

  // the mirror met the same boom years first, near its largest balance
  B['a2-mirror-boom'] = (L, sc, H) => {
    const items = [], P = 'a2-mirror-boom'; env(items, P, { glow: 0.09, key: C['rim-light'], gx: 500 });
    const W = cueL(H), tFirst = W('a2-mirror-boom.1', 'first', 3.2), tBal = W('a2-mirror-boom.1', 'largest', 5.1);
    const g = duel(items, P, H, { p66: 23, a66: 0.45, pm: 14 * smooth((L - 0.2) / (tFirst + 0.2)) });
    const a = fade(L, tFirst - 0.6);
    items.push(S(P + '-boom', 'rect', { panel: P, z: 20, rect: [g.X(6), g.yt - 50, g.X(14) - g.X(6), g.yb - g.yt + 48], fill: C.gain, alpha: 0.13 * a, meta: { role: 'mark', panel: P } }));
    const q = H.P((g.X(6) + g.X(14)) / 2, g.yt - 50, 20);
    items.push(Tx(P + '-bl', 'the same boom years', q[0], q[1] - 16, 30, C.gain, { align: 'center', alpha: a, level: 2 }));
    items.push(L1(P + '-l1', 'For the mirror, first', 1280, 720, 60, fade(L, 0.3, 0.3)));
    void tBal;
    return items;
  };
  CAM['a2-mirror-boom'] = { f: 35, base: {}, moves: [[0.6, 1.5, { z: 300 }]], why: 'push in on the mirror\'s early boom years' };

  // the gap widens: the band between the lines grows year by year
  B['a2-climb'] = (L, sc, H) => {
    const items = [], P = 'a2-climb'; env(items, P, { glow: 0.10, gx: 1500 });
    const p = 8 + 13 * smooth((L - 0.1) / 2.2);
    duel(items, P, H, { p66: p, pm: p, band: [0, p], bandA: 0.25 });
    items.push(L1(P + '-l1', 'The gap widens', 640, 360, 64, fade(L, 0.1, 0.3)));
    return items;
  };
  CAM['a2-climb'] = { f: 50, base: { z: -300 }, moves: [[0.6, 1.2, { z: 300 }]], why: 'push in as the gap opens' };

  // the peak: the gap at 1986 as a bracket, centred
  function gapPeak(items, P, H, L, bu, o = {}) {
    const g = duel(items, P, H, { p66: 21, pm: 21, band: [0, 21], bandA: 0.28, x0: 960 - 21 * 32, x1: 960 + 9 * 32, yb: 950, yt: 440, vmax: 2.2e6, tipDx: 50, ...o });
    const x = g.X(21) + 16, ya = g.Y(M.real1966[21]), ym = g.Y(M.realMirror[21]);
    items.push(S(P + '-brk', 'polyline', { panel: P, z: 0, pts: [[x, ya], [x, ya + (ym - ya) * bu]], stroke: C.text, lw: 5, alpha: bu > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    items.push(S(P + '-cap1', 'polyline', { panel: P, z: 0, pts: [[x - 12, ya], [x + 12, ya]], stroke: C.text, lw: 5, alpha: bu > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    items.push(S(P + '-cap2', 'polyline', { panel: P, z: 0, pts: [[x - 12, ya + (ym - ya) * bu], [x + 12, ya + (ym - ya) * bu]], stroke: C.text, lw: 5, alpha: bu > 0 ? 1 : 0, meta: { role: 'mark', panel: P } }));
    return g;
  }
  B['a2-climax-in'] = (L, sc, H) => {
    const items = [], P = 'a2-climax-in'; env(items, P, { glow: 0.12, gx: 960 });
    const W = cueL(H), t86 = W('a2-climax-in.1', '1986', 0.2), tPk = W('a2-climax-in.1', 'peaks', 1.6);
    gapPeak(items, P, H, L, smooth((L - (tPk - 0.4)) / 0.5));
    items.push(L1(P + '-l1', '1986', 960, 250, 110, on(L, t86), { claims: cl('y1986') }));
    return items;
  };
  B['a2-climax'] = (L, sc, H) => {
    const items = [], P = 'a2-climax'; env(items, P, { glow: 0.14, gx: 960 });
    const W = cueL(H), t66 = W('a2-climax.1', '1966', 0.2), tV = W('a2-climax.1', '$1.96 million', 4.6), tAh = W('a2-climax.1', 'ahead', 4.0);
    gapPeak(items, P, H, L, 1, { bandA: 0.28 + 0.2 * smooth((L - tV) / 1.4) });
    items.push(L1(P + '-l1a', 'The mirror is ahead', 960, 250, 64, L < tV - 0.2 ? fade(L, tAh - 1.2, 0.3) : 0));
    items.push(L1(P + '-l1', '$1.96 million', 960, 250, 96, on(L, tV), { claims: cl('gap86') }));
    items.push(badge(P + '-badge', 960 + 340, 250 + 12, fade(L, tV - 0.4, 0.2)));
    basis(items, P + '-basis', 960, 340, L, t66, fade(L, 0.1, 0.2));
    return items;
  };
  CAM['a2-climax'] = { f: 85, base: { z: -300 }, moves: [[0.6, 1.5, { z: 300 }]], why: 'push in on the gap at its widest' };

  // what the gap buys: one $40,000 year as a tile; the gap as a column; the column cut into 49 tiles
  B['a2-years'] = (L, sc, H) => {
    const items = [], P = 'a2-years'; env(items, P, { glow: 0.10, gx: 1500 });
    const W = cueL(H), t40 = W('a2-years.1', '$40,000', 0.45), t66 = W('a2-years.1', '1966', 2.05), tGap = W('a2-years.1', 'gap', 4.6), t49 = W('a2-years.1', '49', 5.6);
    const gx = 1130, tile = 64, pad = 8, cols = 7, gy = 880; // grid bottom-up; 1 tile = $40,000
    const colH = 49 * 40000 / 40000 * (tile + pad) / cols; // column of the gap, same area per $ as the tiles when cut
    const cu = smooth((L - 1.5) / 2.2), split = smooth((L - (tGap)) / 1.2);
    // the gap column before the split (width of the grid, height = 7 rows)
    if (split < 1) items.push(S(P + '-col', 'rect', { panel: P, z: 0, rect: [gx, gy - 7 * (tile + pad) * cu, cols * (tile + pad) - pad, 7 * (tile + pad) * cu - pad], radius: 8, fill: C.cmirror, alpha: (1 - split) * (cu > 0 ? 0.85 : 0), meta: { role: 'mark', panel: P } }));
    for (let i = 0; i < 49; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const a = i === 0 ? fade(L, t40 - 0.2, 0.2) : split;
      items.push(S(`${P}-t${i}`, 'rect', { panel: P, z: 0, rect: [gx + c * (tile + pad), gy - (r + 1) * (tile + pad), tile, tile], radius: 6, fill: i === 0 ? C.c1966 : C.text, alpha: a * (i === 0 ? 1 : 0.85), meta: { role: 'mark', panel: P } }));
    }
    const cq = H.P(gx, gy + 48, 0); cq[1] = Math.min(1004, cq[1]);
    items.push(Tx(P + '-cg', 'the gap', cq[0], cq[1], 30, C['text-dim'], { alpha: fade(L, 1.6) * (1 - split), level: 3 }));
    items.push(Tx(P + '-ct', 'one tile = one year of withdrawals', cq[0], cq[1], 30, C['text-dim'], { alpha: split, level: 3 }));
    const pre = L < t49 - 0.3;
    items.push(badge(P + '-b40', 640 - 110, 250, pre ? fade(L, t40 - 0.4, 0.2) : 0));
    items.push(L1(P + '-l1', '$40,000 a year', 640, 360, 72, pre ? on(L, t40) : 0, { claims: cl('wd1') }));
    basis(items, P + '-basis', 640, 450, L, t66, pre ? on(L, t40) : 0);
    items.push(badge(P + '-b49', 640 - 110, 610, !pre ? fade(L, t49 - 0.4, 0.2) : 0));
    items.push(L1(P + '-l2', '49 more years', 640, 720, 80, !pre ? on(L, t49) : 0, { claims: cl('years49') }));
    items.push(Tx(P + '-sub', 'of withdrawals, paid by the gap', 640, 810, 32, C['text-dim'], { align: 'center', alpha: !pre ? fade(L, t49 + 0.2) : 0, level: 2 }));
    void colH;
    return items;
  };
  CAM['a2-years'] = { f: 50, base: { x: 300, tx: 300 }, moves: [[0.6, 1.4, { x: -300, tx: -300 }]], why: 'slide from the grid of years to the ledger' };

  // the rest is short: the 1966 line from 1986 to zero
  B['a2-rest'] = (L, sc, H) => {
    const items = [], P = 'a2-rest'; env(items, P, { glow: 0.06, gx: 400 });
    const W = cueL(H), t66 = W('a2-rest.1', '1966', 2.2), tSh = W('a2-rest.1', 'short', 4.3);
    duel(items, P, H, { p66: 20 + 6 * smooth((L - 0.4) / 3.8) });
    items.push(Tx(P + '-who', 'the 1966 retiree', 1280, 450, 34, C.c1966, { align: 'center', series: '1966', claims: cl('y1966'), alpha: on(L, t66), level: 2 }));
    items.push(L1(P + '-l1', 'A short story from here', 1280, 360, 60, fade(L, 0.3, 0.3)));
    void tSh;
    return items;
  };
  CAM['a2-rest'] = { f: 24, base: { y: -350, ty: -150 }, moves: [[0.6, 1.5, { y: 350, ty: 150 }]], why: 'crane down onto the last stretch of the 1966 line' };

  // the mirror meets 1974's loss in 1987: the mirror line through 1987 with the drop marked; the 1974 drop on the 1966 line echoes it
  B['a2-mirror-late'] = (L, sc, H) => {
    const items = [], P = 'a2-mirror-late'; env(items, P, { glow: 0.08, key: C['rim-light'], gx: 1500 });
    const W = cueL(H), t74 = W('a2-mirror-late.1', '1974', 3.9), t87 = W('a2-mirror-late.1', '1987', 5.8), tAbs = W('a2-mirror-late.1', 'absorb', 8.7);
    const g = duel(items, P, H, { p66: 26, a66: 0.5, pm: 18 + 12 * smooth((L - 3.6) / 4.6), lmdy: -44 });
    for (const [k, arr, t, txt, yr, dy] of [[8, M.real1966, t74, '1974 loss', 'y1974', -40], [21, M.realMirror, t87, 'arrives in 1987', 'y1987', -44]]) {
      const a = on(L, t), xa = (g.X(k) + g.X(k + 1)) / 2;
      items.push(S(`${P}-ring${k}`, 'ring', { panel: P, z: 0, c: [xa, (g.Y(arr[k]) + g.Y(arr[k + 1])) / 2], r: 44 * back((L - t) / 0.3), r2: 36 * back((L - t) / 0.3), fill: C.loss, alpha: a, meta: { role: 'mark', panel: P } }));
      const q = H.P(xa, Math.min(g.Y(arr[k]), g.Y(arr[k + 1])) - 40, 0);
      items.push(Tx(`${P}-t${k}`, txt, q[0], q[1] + dy, 32, C.text, { align: 'center', weight: 700, claims: cl(yr), alpha: a, level: 2 }));
    }
    items.push(L1(P + '-l1', 'The same loss, late', 1280, 720, 56, fade(L, 0.3, 0.3)));
    items.push(Tx(P + '-sub', 'on a balance big enough to absorb it', 1280, 800, 32, C['text-dim'], { align: 'center', alpha: fade(L, tAbs - 1.2), level: 2 }));
    return items;
  };
  CAM['a2-mirror-late'] = { f: 35, base: { z: -300 }, moves: [[0.6, 1.5, { z: 300 }]], why: 'push in on the chart where the mirror meets the bad years' };

  // the last payment, nominal; the balance column drains to zero in 1991
  B['a2-1991'] = (L, sc, H) => {
    const items = [], P = 'a2-1991'; env(items, P, { glow: 0.05, gx: 400 });
    const W = cueL(H), tV = W('a2-1991.1', '$96,829', 1.4), t91 = W('a2-1991.1', '1991', 8.9), tZero = W('a2-1991.1', 'zero', 7.8);
    const x0 = 240, w = 66, yb = 920, s = 0.0024;
    base(items, P, 'wd', x0 - 10, x0 + 10 * w, yb);
    for (let k = 16; k <= 25; k++) {
      const g = smooth((L - 0.1 - (k - 16) * 0.11) / 0.3);
      if (k === 25) items.push(S(`${P}-plan`, 'rect', { panel: P, z: 0, rect: [x0 + 9 * w, yb - M.plannedWd[25] * s, w - 14, M.plannedWd[25] * s], radius: 3, fill: null, stroke: C.muted, lw: 3, dash: [10, 8], alpha: fade(L, tV + 0.3), meta: { role: 'mark', panel: P } }));
      bar(items, P, 'wd', `${P}-wd${k}`, x0 + (k - 16) * w, yb, w - 14, M.wd1966[k], s, g, k === 25 ? C.loss : C.inflation, 1);
    }
    const cp = H.P(x0, yb + 64, 0);
    items.push(Tx(P + '-cap', 'withdrawals, nominal', cp[0], Math.min(1000, cp[1]), 30, C.inflation, { alpha: fade(L, 0.3), level: 3 }));
    // balance column (nominal), draining year by year from 1982 to 1991
    const dr = clamp((L - 2.2) / (tZero - 2.2)) * 10, n = Math.floor(dr), f = dr - n;
    const vk = n >= 10 ? 0 : M.nom1966[16 + n] + (M.nom1966[17 + n] - M.nom1966[16 + n]) * smooth(f);
    const cx = 1060, cs = 0.0005;
    base(items, P, 'bal', cx - 20, cx + 200, yb);
    bar(items, P, 'bal', P + '-bal', cx, yb, 180, vk, cs, 1, C.c1966, 1, { char: '1966' });
    const cbp = H.P(cx - 20, yb + 64, 0);
    items.push(Tx(P + '-cb', 'balance, nominal', cbp[0], Math.min(1000, cbp[1]), 30, C.c1966, { alpha: 1, level: 3, series: '1966' }));
    const zp = smooth((L - (t91 - 0.2)) / 0.35);
    items.push(S(P + '-zero', 'circle', { panel: P, z: 0, c: [cx + 90, yb], r: 16 * back(zp), fill: C.loss, alpha: zp > 0 ? 1 : 0, meta: { role: 'mark', panel: P, ...charShape('1966') } }));
    const big = L < t91 - 0.3;
    const sz = big ? 96 : 96 - 40 * smooth((L - (t91 - 0.3)) / 0.3);
    items.push(Tx(P + '-v', '$96,829', 1280, 360 + sz * 0.27, sz, C.text, { align: 'center', weight: 700, claims: cl('last91'), alpha: on(L, tV), level: big ? 1 : 2, color: big ? C.text : C['text-dim'] }));
    items.push(Tx(P + '-nb', 'last payment, nominal dollars', 1280, 460, 32, C['text-dim'], { align: 'center', alpha: on(L, tV), level: 2 }));
    items.push(L1(P + '-l1', 'zero in 1991', 1280, 720, 80, on(L, t91), { claims: cl('y1991') }));
    return items;
  };
  CAM['a2-1991'] = { f: 85, base: { z: -350 }, moves: [[0.6, 1.4, { z: 350 }]], why: 'push in on the last payments' };

  // short: planned withdrawals (outlines) vs paid (filled); the last is short, the final 4 are empty
  B['a2-short'] = (L, sc, H) => {
    const items = [], P = 'a2-short'; env(items, P, { glow: 0.05, gx: 1500 });
    const W = cueL(H), tSh = W('a2-short.1', 'short', 1.2), t4 = W('a2-short.1', '4', 4.4);
    const x0 = 300, w = 44, yb = 940, s = 0.0021;
    base(items, P, 'wd', x0 - 10, x0 + 30 * w, yb);
    for (let k = 0; k < 30; k++) {
      const pa = k < 25 ? 0 : k === 25 ? fade(L, tSh - 0.3) : clamp((L - (t4 - 0.4) - (k - 26) * 0.1) / 0.2);
      if (pa > 0) items.push(S(`${P}-p${k}`, 'rect', { panel: P, z: 0, rect: [x0 + k * w, yb - M.plannedWd[k] * s, w - 10, M.plannedWd[k] * s], radius: 3, fill: null, stroke: k === 25 ? C.muted : C.loss, lw: 3, dash: [8, 6], alpha: pa, meta: { role: 'mark', panel: P } }));
      bar(items, P, 'wd', `${P}-wd${k}`, x0 + k * w, yb, w - 10, M.wd1966[k], s, 1, k === 25 ? C.loss : C.inflation, 1);
    }
    yearAnchors(items, P, 'wd', H, x0 + 17, x0 + 29 * w + 17, yb);
    items.push(Tx(P + '-cap', 'withdrawals, nominal: paid and planned', x0, 250, 30, C['text-dim'], { alpha: fade(L, 0.3), level: 3 }));
    items.push(L1(P + '-l1a', 'The last payment falls short', 640, 360, 56, L < t4 - 0.2 ? fade(L, tSh - 0.6, 0.3) : 0));
    items.push(L1(P + '-l1', '4', 1280, 360, 120, on(L, t4), { claims: cl('emptyYears') }));
    items.push(Tx(P + '-sub', 'final years get nothing', 1280, 460, 34, C['text-dim'], { align: 'center', alpha: fade(L, t4 + 0.2), level: 2 }));
    return items;
  };
  CAM['a2-short'] = { f: 50, base: { x: -300, tx: -300 }, moves: [[0.6, 1.5, { x: 300, tx: 300 }]], why: 'pan right to the end of the plan where the payments stop' };

  // the mirror's end, nominal: twin bar rows of the nominal balances (same scale)
  B['a2-mirror-end'] = (L, sc, H) => {
    const items = [], P = 'a2-mirror-end'; env(items, P, { glow: 0.10, key: C['rim-light'], gx: 1500 });
    const W = cueL(H), t95 = W('a2-mirror-end.1', '1995', 1.9), tV = W('a2-mirror-end.1', '$6.96 million', 4.1);
    const s = 0.000052, yb = 800, w = 22;
    base(items, P, 'n66', 190, 200 + 30 * w, yb);
    base(items, P, 'nm', 1010, 1020 + 30 * w, yb);
    for (let k = 0; k < 30; k++) {
      bar(items, P, 'n66', `${P}-a${k}`, 200 + k * w, yb, w - 6, M.nom1966[k + 1], s, 1, C.c1966, 1, { char: '1966', radius: 2 });
      bar(items, P, 'nm', `${P}-m${k}`, 1020 + k * w, yb, w - 6, M.nomMirror[k + 1], s, smooth((L - 0.3 - k * 0.1) / 0.3), C.cmirror, 1, { char: 'mirror', radius: 2 });
    }
    const la = H.P(200, yb + 58, 0), lb = H.P(1020, yb + 58, 0);
    items.push(Tx(P + '-a', 'first retiree', la[0], Math.min(1000, la[1]), 34, C.c1966, { series: '1966', weight: 700, level: 3 }));
    items.push(Tx(P + '-b', 'mirror retiree', lb[0], Math.min(1000, lb[1]), 34, C.cmirror, { series: 'mirror', weight: 700, level: 3 }));
    const e = H.P(1020 + 29 * w + 8, yb, 0);
    items.push(Tx(P + '-y', '1995', e[0] + 30, e[1] + 46, 30, C['text-dim'], { align: 'center', claims: cl('y1995'), alpha: on(L, t95), level: 3 }));
    items.push(badge(P + '-badge', 1000, 250, fade(L, tV - 0.4, 0.2)));
    items.push(L1(P + '-l1', '$6.96 million', 1280, 360, 80, on(L, tV), { claims: cl('endm') }));
    items.push(Tx(P + '-nb', 'nominal dollars', 1280, 440, 34, C['text-dim'], { align: 'center', alpha: on(L, tV), level: 2 }));
    items.push(Tx(P + '-l', 'balance each year, nominal', 200, 250, 30, C['text-dim'], { alpha: fade(L, 0.3), level: 3 }));
    return items;
  };
  CAM['a2-mirror-end'] = { f: 50, base: { z: 200 }, moves: [[0.6, 1.4, { z: -200 }]], why: 'pull back to show both nominal paths to the end' };

  // the mirror's end in 1966 dollars: the nominal column deflates to $1.44 million, above the $1 million start line
  B['a2-mirror-real'] = (L, sc, H) => {
    const items = [], P = 'a2-mirror-real'; env(items, P, { glow: 0.10, key: C['rim-light'], gx: 500 });
    const W = cueL(H), t66 = W('a2-mirror-real.1', '1966', 0.2), tV = W('a2-mirror-real.1', '$1.44 million', 2.3), tMore = W('a2-mirror-real.1', 'more', 5.9), t30 = W('a2-mirror-real.1', '30', 7.9);
    const yb = 920, s = 0.00009, x = 1150, w = 260;
    base(items, P, 'end', x - 60, x + w + 60, yb);
    const u = smooth((L - 0.3) / (tV - 0.3));
    const v = M.nomMirror[30] + (M.realMirror[30] - M.nomMirror[30]) * u;
    bar(items, P, 'end', P + '-bar', x, yb, w, v, s, 1, C.cmirror, 1, { char: 'mirror' });
    const ra = fade(L, tMore - 0.3);
    items.push(S(P + '-ref', 'polyline', { panel: P, z: 0, pts: [[x - 60, yb - 1e6 * s], [x + w + 60, yb - 1e6 * s]], stroke: C.text, lw: 3, dash: [10, 8], alpha: ra, meta: { role: 'mark', panel: P } }));
    const rp = H.P(x + w + 70, yb - 1e6 * s, 0);
    items.push(Tx(P + '-refl', 'starting balance', rp[0], rp[1] + 10, 30, C.text, { alpha: ra, level: 3 }));
    // 30 small withdrawal ticks along the base: 30 years paid
    const ta = clamp((L - (t30 - 0.8)) / 0.8);
    for (let k = 0; k < 30; k++) items.push(S(`${P}-y${k}`, 'rect', { panel: P, z: 0, rect: [300 + k * 20, 940, 14, 40], radius: 2, fill: C.cmirror, alpha: clamp(ta * 30 - k), meta: { role: 'mark', panel: P, ...charShape('mirror') } }));
    items.push(badge(P + '-b30', 300, 900, fade(L, t30 - 0.4, 0.2)));
    items.push(Tx(P + '-30', '30 years of withdrawals', 560, 900, 32, C.text, { claims: cl('years30'), alpha: on(L, t30), level: 2 }));
    items.push(badge(P + '-badge', 640 - 140, 250, fade(L, tV - 0.4, 0.2)));
    items.push(L1(P + '-l1', '$1.44 million', 640, 360, 96, on(L, tV), { claims: cl('endmr') }));
    basis(items, P + '-basis', 640, 450, L, t66, fade(L, 0.1, 0.2));
    items.push(Tx(P + '-more', 'more than it started with', 640, 510, 32, C['text-dim'], { align: 'center', alpha: fade(L, tMore), level: 2 }));
    return items;
  };
  CAM['a2-mirror-real'] = { f: 85, base: { z: -350 }, moves: [[0.6, 1.3, { z: 350 }]], why: 'push in on the balance as it is converted to 1966 dollars' };

  // payoff: both averages collapse to the same flat 9.7%, then the duel shows who went broke
  B['a2-payoff'] = (L, sc, H) => {
    const items = [], P = 'a2-payoff'; env(items, P, { glow: 0.12, gx: 960 });
    const W = cueL(H), tV = W('a2-payoff.1', '9.7%', 1.3), t2 = W('a2-payoff.2', 'the', 4.1), tBroke = W('a2-payoff.2', 'broke', 6.8);
    const part2 = L >= t2 - 0.3;
    const col = smooth((L - (tV - 1.0)) / 1.0), ba = 1 - smooth((L - (t2 - 0.3)) / 0.5);
    if (ba > 0) {
      for (const [ch, x0, rs] of [['1966', 300, M.ret1966], ['mirror', 1000, M.retMirror]]) {
        for (let k = 0; k < 30; k++) {
          const v = (rs[k] * (1 - col) + M.geo * col) * 100;
          items.push(S(`${P}-${ch}${k}`, 'rect', { panel: P, z: 0, rect: [x0 + k * 20, v >= 0 ? 860 - v * 7 : 860, 14, Math.max(1, Math.abs(v) * 7)], radius: 2, fill: colorOf(ch), alpha: ba, meta: { role: 'mark', panel: P, ...charShape(ch) } }));
        }
        base(items, P, 'avg-' + ch, x0 - 8, x0 + 600, 860, ba);
      }
      items.push(Tx(P + '-a', 'first retiree', 300, 960, 34, C.c1966, { series: '1966', weight: 700, alpha: ba, level: 3 }));
      items.push(Tx(P + '-b', 'mirror retiree', 1000, 960, 34, C.cmirror, { series: 'mirror', weight: 700, alpha: ba, level: 3 }));
    }
    const da = smooth((L - (t2 - 0.1)) / 0.5);
    if (da > 0) {
      const g = duel(items, P, H, { p66: 30 * smooth((L - t2) / (tBroke - t2 + 0.3)), pm: 30 * smooth((L - t2) / (tBroke - t2 + 0.3)), a66: da, am: da, axisA: da, yb: 900, yt: 480, startLabels: true });
      const zp = smooth((L - (tBroke - 0.2)) / 0.35);
      items.push(S(P + '-zero', 'circle', { panel: P, z: 0, c: [g.X(26), g.yb], r: 14 * back(zp), fill: C.loss, alpha: zp > 0 ? 1 : 0, meta: { role: 'mark', panel: P, ...charShape('1966') } }));
    }
    items.push(badge(P + '-badge', 420, 362, !part2 ? fade(L, tV - 0.4, 0.2) : 0));
    items.push(L1(P + '-l1', '9.7% a year', 960, 360, 88, !part2 ? on(L, tV) : 0, { claims: cl('g1966', 'gmirror') }));
    items.push(Tx(P + '-sub', 'both averaged', 960, 250, 34, C['text-dim'], { align: 'center', alpha: !part2 ? fade(L, 0.2) : 0, level: 2 }));
    items.push(L1(P + '-l2', 'The average did not decide', 960, 300, 64, part2 ? fade(L, t2 - 0.1, 0.3) : 0));
    return items;
  };
  CAM['a2-payoff'] = { f: 35, base: { z: -300 }, moves: [[0.6, 1.5, { z: 300 }]], why: 'push in as the two averages flatten into one' };
})();
