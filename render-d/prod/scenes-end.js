'use strict';
// Method cards (sources, model rules) and the outro end screen.
(function () {
  const { B, K } = window.SCENES;
  const { C, M, clamp, smooth, back, fade, fadeOut, cueAbs, lineStart, S, Tx, L1, claim, env, axisX, series, charShape } = K;
  const cue = (H, sid, w, off = 0.5) => { try { return H.local(cueAbs(sid, w)); } catch (e) { try { return H.local(lineStart(sid) + off); } catch (e2) { return 0.5; } } };
  const CAM = window.CAMS.CAM;

  function card(items, panel, rect, a) {
    items.push(S(panel + '-card', 'rect', { panel, z: 0, rect, radius: 24, fill: C.surface, alpha: a, shadow: { alpha: 0.45, blur: 50, dy: 24 }, meta: { role: 'card', panel } }));
  }
  // small flat icons
  function icon(items, panel, id, kind, cx, cy, a, col) {
    const P = (k, geo, o) => items.push(S(`${panel}-ic${id}-${k}`, geo, { panel, z: 0, alpha: a, meta: { role: 'mark', panel }, ...o }));
    if (kind === 'table') { for (let r = 0; r < 3; r++) P('r' + r, 'rect', { rect: [cx - 24, cy - 22 + r * 16, 48, 11], radius: 2, fill: col }); }
    if (kind === 'tag') { P('t', 'poly', { pts: [[cx - 24, cy - 16], [cx + 10, cy - 16], [cx + 26, cy], [cx + 10, cy + 16], [cx - 24, cy + 16]], fill: col }); }
    if (kind === 'x') { P('a', 'polyline', { pts: [[cx - 14, cy - 14], [cx + 14, cy + 14]], stroke: col, lw: 5 }); P('b', 'polyline', { pts: [[cx - 14, cy + 14], [cx + 14, cy - 14]], stroke: col, lw: 5 }); }
    if (kind === 'check') { P('c', 'polyline', { pts: [[cx - 16, cy], [cx - 4, cy + 12], [cx + 18, cy - 14]], stroke: col, lw: 5 }); }
    if (kind === 'cycle') { P('c', 'arc', { c: [cx, cy], r: 18, a0: 0.3, a1: Math.PI * 1.8, fill: null, stroke: col, lw: 5 }); }
  }

  B.method = (L, sc, H) => {
    const items = []; env(items, 'method', { glow: 0.08, gx: 1500 });
    const tStern = cue(H, 'method.1', 'stern', 3), tBls = cue(H, 'method.1', 'bureau', 5.5), tFred = cue(H, 'method.1', 'fred', 7.5);
    card(items, 'method', [860, 250, 900, 640], fade(L, 0.2));
    const rows = [
      ['table', 'Annual returns', 'NYU Stern, Damodaran (histretSP)', tStern],
      ['tag', 'Consumer prices', 'Bureau of Labor Statistics, CPI-U', tBls],
      ['tag', 'Price data source', 'retrieved via FRED', tFred],
    ];
    rows.forEach(([k, h, s, t], i) => {
      const y = 350 + i * 150, a = fade(L, t - 0.15, 0.25);
      icon(items, 'method', i, k, 950, y, a, i === 0 ? C.stocks : C.inflation);
      items.push(Tx('method-h' + i, h, 1010, y - 6, 40, C.text, { weight: 700, alpha: a, level: 2 }));
      items.push(Tx('method-s' + i, s, 1010, y + 42, 32, C['text-dim'], { alpha: a, level: 3 }));
    });
    const pf = H.P(930, 810, 0);
    items.push(Tx('method-foot', 'US data only. No taxes, no fees.', pf[0], pf[1], 32, C['text-dim'], { alpha: fade(L, 0.8), level: 3 }));
    items.push(L1('method-l1', 'The data', 560, 360, 72, fade(L, 0.3)));
    items.push(Tx('method-sub', 'where the numbers come from', 560, 450, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.6), level: 2 }));
    return items;
  };
  // the list builds down the card as each source is named
  CAM.method = { f: 50, base: { y: -200, ty: -120, z: -150 }, moves: [[1.0, 1.5, { y: 200, ty: 120 }], [5.0, 1.4, { z: 150 }]] };

  B['method-model'] = (L, sc, H) => {
    const items = []; env(items, 'method-model', { glow: 0.08, gx: 400 });
    const tDiv = cue(H, 'method-model.1', 'dividends', 1), tReb = cue(H, 'method-model.1', 'rebalanced', 3.5), tDesc = cue(H, 'method-model.2', 'description', 8.5);
    const tList = cue(H, 'method-model.2', 'listed', 7.5);
    card(items, 'method-model', [110, 230, 950, 700], fade(L, 0.15));
    const rows = [
      ['check', 'Dividends and bond coupons included', tDiv],
      ['cycle', 'Rebalanced once a year', tReb],
      ['check', 'Withdrawals rise with inflation', 0.4],
      ['x', 'No taxes', 0.6],
      ['x', 'No fees', 0.8],
    ];
    rows.forEach(([k, s, t], i) => {
      const y = 330 + i * 120, a = fade(L, t - 0.15, 0.25);
      icon(items, 'method-model', i, k, 240, y, a, k === 'x' ? C.loss : C.gain);
      items.push(Tx('method-model-r' + i, s, 300, y + 13, 36, C.text, { alpha: a, level: 2 }));
    });
    items.push(L1('method-model-l1', 'The model', 1340, 360, 72, fade(L, 0.2) * fadeOut(L, tList - 0.3, 0.25)));
    items.push(Tx('method-model-sub', 'what the simulation assumes', 1340, 450, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.5) * fadeOut(L, tList - 0.3, 0.25), level: 2 }));
    items.push(L1('method-model-l1b', 'Every formula is listed', 1360, 360, 48, fade(L, tList - 0.1, 0.3)));
    items.push(Tx('method-model-desc', 'in the description', 1360, 450, 36, C['text-dim'], { align: 'center', alpha: fade(L, tDesc - 0.2), level: 2 }));
    // a pointer down toward the description, drawn when it is named
    const u = smooth((L - tDesc) / 0.6);
    items.push(S('method-model-arrow', 'polyline', { panel: 'method-model', z: 0, pts: [[1360, 520], [1360, 520 + 260 * u]], stroke: C.text, lw: 5, alpha: u > 0 ? 1 : 0, meta: { role: 'mark', panel: 'method-model' } }));
    items.push(S('method-model-head', 'poly', { panel: 'method-model', z: 0, pts: [[1334, 520 + 260 * u - 6], [1386, 520 + 260 * u - 6], [1360, 520 + 260 * u + 26]], fill: C.text, alpha: u > 0.05 ? 1 : 0, meta: { role: 'mark', panel: 'method-model' } }));
    return items;
  };
  CAM['method-model'] = { f: 50, base: { x: 250, tx: 250, z: 150 }, moves: [[0.7, 1.4, { x: -250, tx: -250, z: -150 }]] };

  // outro: the two real balance lines (1966 and mirror) drawn once more under the title
  B.outro = (L, sc, H) => {
    const items = []; env(items, 'outro', { glow: 0.12, gx: 960 });
    const tTwo = cue(H, 'outro.1', 'two', 1), tFate = cue(H, 'outro.1', 'fate', 4), tOrder = cue(H, 'outro.1', 'order', 5.2);
    const x0 = 480, x1 = 1440, yb = 880, yt = 500;
    const X = (k) => x0 + (x1 - x0) * k / 30, Y = (v) => yb - (yb - yt) * v / 2.2e6;
    const prog = smooth((L - 0.8) / 6);
    const n = Math.max(1, Math.round(prog * 30));
    axisX(items, 'outro-axis', 'outro', x0, x1, yb + 4, 0, 'outro');
    series(items, 'outro-66', 'outro', '1966', M.real1966.slice(0, n + 1).map((v, k) => [X(k), Y(v)]), 0, 'outro', 1, 'outro-lab66');
    series(items, 'outro-m', 'outro', 'mirror', M.realMirror.slice(0, n + 1).map((v, k) => [X(k), Y(v)]), 0, 'outro', 1, 'outro-labm');
    const a = H.P(x0, yb + 4, 0), b = H.P(x1, yb + 4, 0);
    items.push(Tx('outro-a0', '1966', a[0], a[1] + 46, 30, C['text-dim'], { role: 'axis-label', anchor: 'outro', chart: 'outro', year: 1966, align: 'center', claims: [claim('ax1966')] }));
    items.push(Tx('outro-a1', '1995', b[0], b[1] + 46, 30, C['text-dim'], { role: 'axis-label', anchor: 'outro', chart: 'outro', year: 1995, align: 'center', claims: [claim('ax1995')] }));
    const l66 = H.P(X(3), Y(M.real1966[3]), 0), lm = H.P(X(Math.min(n, 30)), Y(M.realMirror[Math.min(n, 30)]), 0);
    items.push(Tx('outro-lab66', 'first retiree', l66[0] - 20, l66[1] + 60, 32, C.c1966, { align: 'right', series: '1966', alpha: fade(L, 1.2), level: 3 }));
    items.push(Tx('outro-labm', 'mirror retiree', Math.min(lm[0] + 24, 1600), lm[1] - 30, 32, C.cmirror, { series: 'mirror', alpha: fade(L, 1.6), level: 3 }));
    items.push(Tx('outro-basis', 'real balance, after inflation', x0, yt - 40, 30, C['text-dim'], { alpha: fade(L, 1.0), level: 3 }));
    // the fate: 1966 at zero (ringed), the mirror still holding money at the end
    const tz = 0.8 + 6 * 25 / 30;
    items.push(S('outro-zero', 'circle', { panel: 'outro', z: 0, c: [X(25), yb + 4], r: 12 * back((L - Math.max(tz, tFate - 0.3)) / 0.35), fill: C.loss, alpha: L >= Math.max(tz, tFate - 0.3) ? 1 : 0, meta: { role: 'mark', panel: 'outro', ...charShape('1966') } }));
    items.push(L1('outro-l1', 'Two retirees, one average', 960, 250, 72, fade(L, tTwo - 0.1, 0.3) * fadeOut(L, 11.5, 0.4)));
    items.push(Tx('outro-sub', 'a fate decided by the order of the years', 960, 340, 36, C['text-dim'], { align: 'center', alpha: fade(L, tOrder - 0.2) * fadeOut(L, 11.5, 0.4), level: 2 }));
    items.push(L1('outro-title', 'Same average, different fate', 960, 250, 72, fade(L, 12.0, 0.5)));
    items.push(Tx('outro-src', 'Data: NYU Stern (Damodaran) · BLS CPI-U via FRED', 960, 340, 30, C['text-dim'], { align: 'center', alpha: fade(L, 15.5, 0.5), level: 3 }));
    items.push(Tx('outro-hist', 'History, not a forecast', 960, 400, 30, C['text-dim'], { align: 'center', alpha: fade(L, 19, 0.5), level: 3 }));
    void clamp;
    return items;
  };
  // pull back as the lines finish, then settle closer on the title card
  CAM.outro = { f: 35, base: { z: -300 }, moves: [[0.8, 1.6, { z: 300 }], [8.0, 1.6, { y: -150, ty: -150 }], [13.5, 1.6, { y: 150, ty: 150, z: -200 }], [17.0, 1.6, { z: 350 }], [20.5, 1.6, { x: 0, z: -150 }]] };
})();
