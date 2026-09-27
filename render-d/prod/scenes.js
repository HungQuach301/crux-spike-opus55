'use strict';
// Test D scene builders for M2 (cold open, ident, act 1). Each builder gets the local time L (s since the scene cut),
// the scene record and helpers, and returns world shapes (projected, blurred by depth) and screen texts (sharp).
// Conventions (design/tokens.json, preprod/color-script): time runs left to right; the 1966 retiree is amber, solid,
// always on the left; the mirror retiree is blue, dashed, on the right. Level-1 text sits on a thirds intersection
// (or the centre axis when the scene declares composition "center"). Every number on screen is a claim span.
(function () {
  const D = window.DATA, T = D.tokens.colors;
  const lc = (h) => h.toLowerCase();
  const C = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, lc(v)]));
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (x) => { x = clamp(x); return x * x * x * (x * (6 * x - 15) + 10); };
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const back = (x) => { x = clamp(x); const s = 1.4; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); }; // overshoot pop
  const fade = (L, t0, d = 0.35) => smooth((L - t0) / d);
  const fadeOut = (L, t0, d = 0.3) => 1 - smooth((L - t0) / d);

  // cue: absolute video time of a spoken phrase (from the voice alignment) -> scene-local time
  const cueAbs = (sid, phrase) => { for (const k of [sid + '|' + phrase, sid + '|' + phrase.toLowerCase()]) if (k in D.cues) return D.cues[k]; throw new Error('no cue ' + sid + '|' + phrase); };
  const lineStart = (sid) => { const s = D.sentences.find((x) => x.id === sid); if (!s) throw new Error('no line ' + sid); return s.start; };

  // ---------------------------------------------------------------- primitives
  const ids = new Set();
  function S(id, geo, o) { return { kind: 'shape', id, geo, z: 0, lw: 0, ...o, meta: { role: 'mark', panel: o.panel, chart: o.chart || null, ...(o.meta || {}) } }; }
  function Tx(id, text, x, y, size, color, o = {}) { return { kind: 'text', id, tid: o.tid || id, text, x, y, size, color, weight: o.weight || 600, align: o.align || 'left', alpha: o.alpha ?? 1, ...o }; }
  // level-1 text centred on (cx, cy): baseline from the Inter cap height
  const L1 = (id, text, cx, cy, size, a, o = {}) => Tx(id, text, cx, cy + size * 0.27, size, o.color || C.text, { align: 'center', level: 1, weight: 700, alpha: a, ...o });
  const claim = (id) => ({ id, text: D.claims[id].display });
  function badge(id, x, y, a) { return Tx(id, 'ILLUSTRATIVE', x, y, 30, C['badge-text'], { role: 'badge', background: C['badge-bg'], weight: 700, alpha: a, pad: 12 }); }

  // environment: act background, key-light glow on the far wall, floor grid in depth bands (all role "bg")
  function env(items, panel, o = {}) {
    const key = o.key || C['key-light'];
    const gx = o.gx ?? (panel.charCodeAt(0) + panel.length) % 2 ? 1500 : 350;
    items.push(S(panel + '-glow', 'circle', { panel, z: 2600, c: [gx, o.gy ?? 250], r: 1500, fill: key, gradient: { type: 'radial', stops: [[0, key, 2 * (o.glow ?? 0.10)], [1, key, 0]] }, meta: { role: 'bg' } }));
    items.push(S(panel + '-rim', 'circle', { panel, z: 2600, c: [o.rx ?? -300, 900], r: 1100, fill: C['rim-light'], gradient: { type: 'radial', stops: [[0, C['rim-light'], 0.05], [1, C['rim-light'], 0]] }, meta: { role: 'bg' } }));
    const bands = [[-600, 400], [400, 1400], [1400, 3200]];
    bands.forEach(([z0, z1], bi) => {
      const pts = [];
      for (let x = -2600; x <= 4600; x += 260) pts.push([[x, 1180, z0], [x, 1180, z1]]);
      for (let z = z0; z <= z1; z += 200) pts.push([[-2600, 1180, z], [4600, 1180, z]]);
      pts.forEach((p, i) => items.push(S(`${panel}-floor${bi}-${i}`, 'polyline', { panel, z: (z0 + z1) / 2, layer: 'floor' + bi, pts: p, stroke: C.grid, lw: 1.2, screenLw: true, alpha: 0.32 * (o.floor ?? 1), meta: { role: 'bg' }, noRecord: i > 0 })));
    });
  }

  // chart helpers on the world plane z
  function axisX(items, id, chart, x0, x1, y, z, panel, a = 1) {
    items.push(S(id, 'polyline', { panel, chart, z, pts: [[x0, y], [x1, y]], stroke: C.muted, lw: 2, alpha: a, meta: { role: 'axis', panel, chart } }));
  }
  function series(items, id, chart, char, pts, z, panel, a, label) {
    const color = char === 'mirror' ? C.cmirror : C.c1966;
    items.push(S(id, 'polyline', { panel, chart, z, pts, stroke: color, lw: 5, alpha: a, dash: char === 'mirror' ? [18, 12] : null, curve: true,
      meta: { role: 'series', panel, chart, char, series: char, shape: char === 'mirror' ? 'dashed' : 'solid', label } }));
  }
  const charShape = (char) => ({ char, shape: char === 'mirror' ? 'dashed' : 'solid', series: char });
  const colorOf = (char) => (char === 'mirror' ? C.cmirror : C.c1966);

  // model series
  const M = D.model;
  const yearsX = (x0, x1) => (k) => x0 + (x1 - x0) * k / 30;

  // ---------------------------------------------------------------- scenes
  const B = {};

  // Cold open 1: two lines born at one point (growth of $1, no withdrawals): same end point.
  function growthChart(items, L, panel, prog, P, o = {}) {
    const x0 = o.x0 ?? 460, x1 = o.x1 ?? 1460, yb = o.yb ?? 800, yt = o.yt ?? 430;
    const X = yearsX(x0, x1), Y = (v) => yb - (yb - yt) * Math.log(v) / Math.log(M.cumEnd);
    axisX(items, panel + '-axis', panel, x0, x1, yb + 20, 0, panel);
    const n = Math.max(1, Math.round(prog * 30));
    for (const ch of ['1966', 'mirror']) {
      const cum = ch === '1966' ? M.cum1966 : M.cumMirror;
      const pts = cum.slice(0, n + 1).map((v, k) => [X(k), Y(v)]);
      series(items, `${panel}-${ch}`, panel, ch, pts, 0, panel, 1, `${panel}-lab-${ch}`);
      const tip = pts[pts.length - 1];
      const sp = P(tip[0], tip[1], 0);
      const right = false;
      items.push(Tx(`${panel}-lab-${ch}`, ch === '1966' ? '1966 retiree' : 'mirror retiree', sp[0] + (right ? -22 : 22), sp[1] + (ch === '1966' ? 58 : -36), 34, colorOf(ch),
        { align: right ? 'right' : 'left', claims: ch === '1966' ? [claim('y1966')] : [], alpha: prog > 0.2 ? fade(prog * 10, 2.2, 1) : 0, series: ch }));
    }
    const a = P(x0, yb + 20, 0), b = P(x1, yb + 20, 0);
    items.push(Tx(panel + '-a0', '1966', a[0], a[1] + 46, 34, C.text, { role: 'axis-label', anchor: panel, chart: panel, year: 1966, align: 'center', claims: [claim('ax1966')] }));
    items.push(Tx(panel + '-a1', '1995', b[0], b[1] + 46, 34, C.text, { role: 'axis-label', anchor: panel, chart: panel, year: 1995, align: 'center', claims: [claim('ax1995')] }));
  }
  B['co-lines'] = (L, sc, H) => {
    const items = []; env(items, 'co', { glow: 0.06, floor: 0.7 });
    items.push(S('co-origin', 'circle', { panel: 'co', z: 0, c: [460, 780], r: 10 * (1 + 0.3 * Math.sin(L * 6)), fill: C['key-light'], alpha: fade(L, 0), meta: { role: 'mark' } }));
    growthChart(items, L, 'co', smooth((L - 0.4) / 5.0) * 0.35, H.P);
    return items;
  };
  B['co-same'] = (L, sc, H) => {
    const items = []; env(items, 'co', { glow: 0.07, floor: 0.7 });
    const t0 = H.sceneStartOf('co-lines');
    const Lc = L + (sc.start - t0); // continuous growth across the cut
    growthChart(items, L, 'co', 0.35 + 0.65 * smooth((L - 0.2) / 4.2), H.P);
    const w = (p) => H.local(cueAbs('co-same.1', p));
    items.push(L1('co-l1', 'Two retirees', 640, 360, 72, fade(L, 0.15)));
    [['balance', 'Same balance'], ['withdrawals', 'Same withdrawals'], ['average', 'Same average return']].forEach(([p, s], i) =>
      items.push(Tx('co-same-' + i, s, 470, 430 + i * 46, 34, C['text-dim'], { alpha: fade(L, w(p) - 0.1, 0.25), level: 2 })));
    void Lc;
    return items;
  };
  // Cold open 2: balances with the same withdrawals; the 1966 line reaches zero in 1991 (camera follows it right).
  B['co-broke'] = (L, sc, H) => {
    const items = []; env(items, 'cb', { glow: 0.05, key: C['key-light'], floor: 0.8 });
    const tHit = H.local(cueAbs('co-broke.1', '1991'));
    const x0 = 1100, x1 = 2200, yb = 760, yt = 280;
    const X = yearsX(x0, x1), Y = (v) => yb - (yb - yt) * v / 7.5e6;
    const prog = clamp(smooth((L - 0.3) / (tHit - 0.3)) * 25 / 30 + (L > tHit ? 5 / 30 * smooth((L - tHit) / 0.6) : 0));
    const n = Math.max(1, Math.round(prog * 30));
    axisX(items, 'cb-axis', 'cb', x0, x1, yb + 4, 0, 'cb');
    for (const ch of ['1966', 'mirror']) {
      const bal = ch === '1966' ? M.bal1966 : M.balMirror;
      const pts = [[X(0), Y(1e6)], ...bal.slice(0, n).map((v, k) => [X(k + 1), Y(v)])];
      series(items, 'cb-' + ch, 'cb', ch, pts, 0, 'cb', 1, 'cb-lab-' + ch);
    }
    const lab66 = H.P(X(8), Y(M.bal1966[7]), 0), labM = H.P(X(Math.min(n, 21)), Y(M.balMirror[Math.min(n, 21) - 1]), 0);
    items.push(Tx('cb-lab-1966', '1966 retiree', H.P(X(15), yb, 0)[0], H.P(X(15), yb, 0)[1] + 50, 30, C.c1966, { claims: [claim('y1966')], series: '1966' }));
    items.push(Tx('cb-lab-mirror', 'mirror retiree', labM[0] - 250, labM[1] - 30, 30, C.cmirror, { series: 'mirror' }));
    const a = H.P(x0, yb + 4, 0), b = H.P(x1, yb + 4, 0);
    items.push(Tx('cb-a0', '1966', a[0], a[1] + 46, 30, C['text-dim'], { role: 'axis-label', anchor: 'cb', chart: 'cb', year: 1966, align: 'center', claims: [claim('ax1966')] }));
    items.push(Tx('cb-a1', '1995', b[0], b[1] + 46, 30, C['text-dim'], { role: 'axis-label', anchor: 'cb', chart: 'cb', year: 1995, align: 'center', claims: [claim('ax1995')] }));
    const hit = H.P(X(25), yb + 4, -250);
    const ah = L >= tHit - 1 / 60 ? 1 : 0;
    items.push(S('cb-zero', 'circle', { panel: 'cb', z: -250, c: [X(25), yb + 4], r: 12 * back((L - tHit) / 0.35), fill: C.loss, alpha: ah, meta: { role: 'mark', panel: 'cb', ...charShape('1966') }, stroke: null }));
    items.push(L1('cb-l1a', 'With the same withdrawals', 640, 360, 56, fade(L, 0.2) * fadeOut(L, tHit - 0.35, 0.3)));
    items.push(L1('cb-l1', '1991', hit[0], hit[1] - 112, 96, ah, { claims: [claim('y1991')] }));
    items.push(Tx('cb-ranout', 'ran out of money', hit[0], hit[1] - 192, 34, C['text-dim'], { align: 'center', alpha: fade(L, tHit + 0.1) }));
    return items;
  };
  B['co-question'] = (L, sc, H) => {
    const items = []; env(items, 'cq', { glow: 0.05 });
    // foreground: the zero point; background: the surviving mirror line (rack focus between them)
    items.push(S('cq-zero', 'circle', { panel: 'cq', z: -260, c: [700, 820], r: 22, fill: C.loss, meta: { role: 'mark', panel: 'cq', ...charShape('1966') } }));
    const pts = []; for (let k = 0; k <= 7; k++) pts.push([700 + k * 154, 900 - 260 * Math.pow(k / 7, 1.4)]);
    items.push(S('cq-mirror', 'polyline', { panel: 'cq', z: 380, pts, stroke: C.cmirror, lw: 6, dash: [18, 12], meta: { role: 'mark', panel: 'cq', ...charShape('mirror') } }));
    items.push(L1('cq-l1', 'What decided it?', 960, 540, 84, fade(L, H.local(lineStart('co-question.1')) - 0.05, 0.25)));
    return items;
  };
  B.ident = (L) => {
    const items = []; env(items, 'id', { glow: 0.12, floor: 0.5 });
    const u = smooth((L - 0.2) / 0.8);
    items.push(S('id-l66', 'polyline', { panel: 'id', z: 0, pts: [[960 - 420 * u, 640], [960, 640]], stroke: C.c1966, lw: 6, meta: { role: 'mark', panel: 'id', ...charShape('1966') } }));
    items.push(S('id-lm', 'polyline', { panel: 'id', z: 0, pts: [[960, 640], [960 + 420 * u, 640]], stroke: C.cmirror, lw: 6, dash: [18, 12], meta: { role: 'mark', panel: 'id', ...charShape('mirror') } }));
    items.push(L1('id-title', 'Same average, different fate', 960, 540, 80, fade(L, 0.1, 0.5)));
    return items;
  };

  // ---------------------------------------------------------------- act 1
  B['a1-est'] = (L, sc, H) => {
    const items = []; env(items, 'est', { glow: 0.12, gx: 700 });
    // a monumental calendar page standing on the floor, with a month grid
    items.push(S('est-page', 'rect', { panel: 'est', z: 300, rect: [240, 150, 900, 900], radius: 18, fill: C.surface, shadow: { alpha: 0.5, blur: 60, dy: 30 }, meta: { role: 'card', panel: 'est' } }));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
      const k = r * 7 + c;
      items.push(S(`est-d${k}`, 'rect', { panel: 'est', z: 300, rect: [300 + c * 118, 480 + r * 108, 96, 86], radius: 8, fill: k === 5 ? C.c1966 : C['surface-2'], alpha: k === 5 ? fade(L, 1.2) : 1,
        meta: { role: 'mark', panel: 'est', ...(k === 5 ? charShape('1966') : {}) } }));
    }
    items.push(L1('est-l1', 'January 1966', 640, 360, 88, fade(L, H.local(cueAbs('a1-est.1', '1966')) - 0.05, 0.2), { claims: [claim('y1966')] }));
    return items;
  };
  function moneyColumn(items, panel, n, L, x, yb, z, lift) {
    for (let k = 0; k < n; k++) {
      const a = fade(L, 0.3 + k * 0.08, 0.25);
      const y = yb - (k + 1) * 46 - (1 - easeOut((L - 0.3 - k * 0.08) / 0.4)) * 60;
      items.push(S(`${panel}-slab${k}`, 'rect', { panel, z, rect: [x, y, 300, 38], radius: 6, fill: C.c1966, alpha: a, shadow: { alpha: 0.35, blur: 18, dy: 8 }, meta: { role: 'mark', panel, ...charShape('1966') } }));
    }
    if (lift) {
      const u = lift.u;
      items.push(S(`${panel}-slice`, 'rect', { panel, z, rect: [x + 360 * u, yb - n * 46 - 26 - 70 * Math.sin(Math.PI * u), 300, 12], radius: 4, fill: C.c1966, alpha: lift.a, meta: { role: 'mark', panel, ...charShape('1966') } }));
    }
  }
  B['a1-start'] = (L, sc, H) => {
    const items = []; env(items, 'st', { glow: 0.10 });
    moneyColumn(items, 'st', 10, L, 1150, 900, 0, null);
    const tv = H.local(cueAbs('a1-start.1', '$1 million'));
    items.push(badge('st-badge', 470, 638, fade(L, tv - 0.3, 0.2)));
    items.push(L1('st-l1', '$1 million', 640, 720, 104, L >= tv - 1 / 60 ? 1 : 0, { claims: [claim('initial')] }));
    items.push(Tx('st-basis', 'in 1966 dollars', 640, 830, 40, C['text-dim'], { align: 'center', alpha: L >= tv - 1 / 60 ? 1 : 0, claims: [claim('y1966')] }));
    items.push(Tx('st-who', 'the first retiree', 1300, 180, 34, C.c1966, { align: 'center', alpha: fade(L, 0.4), series: '1966' }));
    return items;
  };
  B['a1-who'] = (L, sc, H) => {
    const items = []; env(items, 'who', { glow: 0.05, gx: 1600, floor: 1.2 });
    // the decade ahead, not yet known to the retiree: the real returns of 1966..1975 as bars on a zero line, revealed one
    // by one as the amber path walks over them (no numbers: the shape is the foreshadowing)
    const walk = smooth((L - 0.5) / 4.5), x0 = 380, bw = 70, gap = 18, y0 = 640, k2px = 1000;
    items.push(S('who-zero', 'polyline', { panel: 'who', z: 0, pts: [[x0 - 20, y0], [x0 + 10 * (bw + gap) + 2, y0]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel: 'who' } }));
    for (let k = 0; k < 10; k++) {
      const r = (1 + M.ret1966[k]) / (1 + M.infl[k]) - 1, h = r * k2px, a = clamp((walk * 10 - k) / 1.2);
      const x = x0 + k * (bw + gap);
      items.push(S(`who-bar${k}`, 'rect', { panel: 'who', z: 0, rect: [x, h >= 0 ? y0 - h * a : y0, bw, Math.max(2, Math.abs(h) * a)], fill: r >= 0 ? C.gain : C.loss, alpha: 0.85, meta: { role: 'mark', panel: 'who' } }));
    }
    items.push(S('who-path', 'polyline', { panel: 'who', z: 0, pts: [[x0, y0 - 190], [x0 + 10 * (bw + gap) * walk, y0 - 190]], stroke: C.c1966, lw: 5, meta: { role: 'mark', panel: 'who', ...charShape('1966') } }));
    items.push(Tx('who-cap', 'real return, first ten years', x0, y0 - 220, 30, C['text-dim'], { alpha: fade(L, 0.8), level: 3 }));
    items.push(Tx('who-l2', 'A hard decade for markets', 1280, 250, 38, C['text-dim'], { align: 'center', alpha: fade(L, 0.4), level: 2 }));
    items.push(L1('who-l1', 'Nobody knows it yet', 1280, 360, 64, fade(L, H.local(cueAbs('a1-who.1', 'nobody')) - 0.05, 0.25)));
    return items;
  };
  function yearGrid(items, panel, L, H, reveal, hi) {
    // 69 start years 1928..1996 as tiles in 3 rows, receding in depth
    for (let i = 0; i < 69; i++) {
      const row = Math.floor(i / 23), col = i % 23, y = 1928 + i;
      const z = row * 120;
      const a = clamp((reveal * 69 - i) / 3);
      const isHi = y === 1966;
      items.push(S(`${panel}-y${y}`, 'rect', { panel, z, layer: `${panel}-row${row}`, rect: [150 + col * 70, 500 + row * 110, 58, 80], radius: 8, fill: isHi ? C.c1966 : C['surface-2'], alpha: a * (isHi ? hi : 0.95),
        meta: { role: 'mark', panel, year: y, ...(isHi ? charShape('1966') : {}) } }));
    }
  }
  B['a1-hook'] = (L, sc, H) => {
    const items = []; env(items, 'hk', { glow: 0.08 });
    yearGrid(items, 'hk', L, H, smooth((L - 0.3) / 3), 1);
    items.push(L1('hk-l1', 'Which ten years decided it?', 1280, 360, 64, fade(L, 0.4)));
    return items;
  };
  B['a1-hook-b'] = (L, sc, H) => {
    const items = []; env(items, 'hk', { glow: 0.08 });
    yearGrid(items, 'hk', L, H, 1, 1);
    const t28 = H.local(cueAbs('a1-hook.1', '1928'));
    items.push(L1('hkb-l1', 'Did it hold for every start year?', 640, 360, 60, fade(L, H.local(cueAbs('a1-hook.1', 'whether')) - 0.1, 0.3)));
    const p = H.P(150, 500 + 330, 0);
    items.push(Tx('hkb-1928', 'since 1928', p[0] + 10, p[1] + 60, 34, C['text-dim'], { alpha: L >= t28 - 1 / 60 ? 1 : 0, claims: [claim('y1928')] }));
    return items;
  };
  function donut(items, panel, cx, cy, z, share, a, H, tilt = 0.55) {
    // stocks slice (share) and bonds slice (1 - share) as a ring lying back in depth
    const segs = 60, r = 260, r2 = 170;
    const ang = (u) => -Math.PI / 2 + u * Math.PI * 2;
    const ring = (id, u0, u1, color) => {
      const pts = [];
      for (let k = 0; k <= segs; k++) { const u = u0 + (u1 - u0) * k / segs; pts.push([cx + r * Math.cos(ang(u)), cy + r * tilt * Math.sin(ang(u)), z + r * 0.8 * Math.sin(ang(u))]); }
      for (let k = segs; k >= 0; k--) { const u = u0 + (u1 - u0) * k / segs; pts.push([cx + r2 * Math.cos(ang(u)), cy + r2 * tilt * Math.sin(ang(u)), z + r2 * 0.8 * Math.sin(ang(u))]); }
      items.push(S(id, 'poly', { panel, z, pts, fill: color, alpha: a, shadow: { alpha: 0.3, blur: 30, dy: 16 }, meta: { role: 'mark', panel } }));
    };
    ring(panel + '-stocks', 0, share - 0.005, C.stocks);
    ring(panel + '-bonds', share + 0.005, 1, C.bonds);
  }
  B['a1-mix'] = (L, sc, H) => {
    const items = []; env(items, 'mx', { glow: 0.10 });
    donut(items, 'mx', 960, 640, 0, 0.6 * smooth((L - 0.3) / 1.2) + 0.4 * 0, fade(L, 0.2), H);
    const t60 = H.local(cueAbs('a1-mix.1', '60%')), t40 = H.local(cueAbs('a1-mix.1', '40%'));
    items.push(badge('mx-badge', 1300, 498, fade(L, Math.min(t60, t40) - 0.4, 0.2)));
    items.push(L1('mx-l1', 'The portfolio', 640, 360, 64, fade(L, 0.3)));
    items.push(Tx('mx-s', '60% stocks', 1300, 560, 44, C.stocks, { alpha: L >= t60 - 1 / 60 ? 1 : 0, claims: [claim('w60')] }));
    items.push(Tx('mx-b', '40% bonds', 1300, 760, 44, C.bonds, { alpha: L >= t40 - 1 / 60 ? 1 : 0, claims: [claim('w40')] }));
    return items;
  };
  B['a1-assets'] = (L, sc, H) => {
    const items = []; env(items, 'as', { glow: 0.10, gx: 400 });
    const card = (id, x, a) => items.push(S(id, 'rect', { panel: 'as', z: 0, rect: [x, 470, 640, 420], radius: 18, fill: C.surface, alpha: a, shadow: { alpha: 0.45, blur: 50, dy: 24 }, meta: { role: 'card', panel: 'as' } }));
    card('as-c1', 180, fade(L, 0.2)); card('as-c2', 1100, fade(L, 0.5));
    // stocks icon: rising bars; bonds icon: level steps
    for (let k = 0; k < 6; k++) items.push(S('as-sb' + k, 'rect', { panel: 'as', z: 0, rect: [240 + k * 50, 850 - (30 + k * 22), 34, 30 + k * 22], radius: 4, fill: C.stocks, alpha: fade(L, 0.4 + k * 0.08), meta: { role: 'mark', panel: 'as' } }));
    for (let k = 0; k < 6; k++) items.push(S('as-bb' + k, 'rect', { panel: 'as', z: 0, rect: [1160 + k * 50, 850 - (70 + (k % 2) * 8), 34, 70 + (k % 2) * 8], radius: 4, fill: C.bonds, alpha: fade(L, 0.7 + k * 0.08), meta: { role: 'mark', panel: 'as' } }));
    const ts = H.local(cueAbs('a1-assets.1', '500')), tb = H.local(cueAbs('a1-assets.2', '10-year'));
    items.push(L1('as-l1', 'What it holds', 640, 360, 64, fade(L, 0.2)));
    items.push(Tx('as-t1', "Standard & Poor's 500", 220, 540, 40, C.text, { alpha: L >= ts - 1 / 60 ? 1 : 0, weight: 700, claims: [claim('sp500')] }));
    items.push(Tx('as-t1b', 'stocks, dividends reinvested', 220, 596, 30, C['text-dim'], { alpha: fade(L, ts + 0.2) }));
    items.push(Tx('as-t2', '10-year US Treasury', 1140, 540, 40, C.text, { alpha: L >= tb - 1 / 60 ? 1 : 0, weight: 700, claims: [claim('tbond10')] }));
    items.push(Tx('as-t2b', 'government bonds', 1140, 596, 30, C['text-dim'], { alpha: fade(L, tb + 0.2) }));
    return items;
  };
  B['a1-rebal'] = (L, sc, H) => {
    const items = []; env(items, 'rb', { glow: 0.10, gx: 1500 });
    const tr = H.local(cueAbs('a1-rebal.1', 'rebalanced'));
    const drift = 0.6 + 0.08 * smooth((L - 0.3) / 1.2) * (1 - smooth((L - tr) / 0.5));
    donut(items, 'rb', 1280, 640, 0, drift, 1, H, 0.5);
    items.push(L1('rb-l1', 'Back to the mix every January', 640, 360, 56, fade(L, 0.3)));
    items.push(Tx('rb-sub', 'stocks drift up or down during the year', 640, 470, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.8) }));
    return items;
  };
  B['a1-rule'] = (L, sc, H) => {
    const items = []; env(items, 'ru', { glow: 0.10 });
    const t4 = H.local(cueAbs('a1-rule.1', '4%')), t40 = H.local(cueAbs('a1-rule.2', '$40,000'));
    moneyColumn(items, 'ru', 10, L + 2, 1200, 920, 0, { u: smooth((L - t4) / 1.2), a: L >= t4 - 0.2 ? 1 : 0 });
    items.push(badge('ru-badge', 548, 482, fade(L, t4 - 0.4, 0.2)));
    items.push(L1('ru-l1', '4% in year one', 640, 360, 72, L >= t4 - 1 / 60 ? 1 : 0, { claims: [claim('rate4')] }));
    items.push(Tx('ru-40', '$40,000', 640, 580, 60, C.text, { align: 'center', weight: 700, alpha: L >= t40 - 1 / 60 ? 1 : 0, claims: [claim('wd1')] }));
    items.push(Tx('ru-basis', 'real dollars', 640, 640, 32, C['text-dim'], { align: 'center', alpha: L >= t40 - 1 / 60 ? 1 : 0 }));
    return items;
  };
  function escalator(items, panel, L, H, grow, z, o = {}) {
    const x0 = 280, w = 44, yb = 900;
    const Y = (v) => v / 180000 * 360;
    for (let k = 0; k < 30; k++) {
      const v = M.plannedWd[k];
      const g = clamp((grow - k * 0.08) / 0.3);
      items.push(S(`${panel}-bar${k}`, 'rect', { panel, z, layer: panel + '-bars', rect: [x0 + k * w, yb - Y(v) * g, 34, Y(v) * g], radius: 3, fill: C.inflation, alpha: o.a ?? 1,
        meta: { role: 'bar', panel, chart: panel, value: v, full: g >= 1, orient: 'v' } }));
    }
    const a = H.P(x0 + 17, yb, z), b = H.P(x0 + 29 * w + 17, yb, z);
    items.push(S(panel + '-axis', 'polyline', { panel, z, layer: panel + '-bars', pts: [[x0 - 10, yb + 2], [x0 + 30 * w, yb + 2]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel, chart: panel } }));
    // scale: a dashed gridline at $100,000 (nominal)
    const yg = yb - Y(100000), ga = clamp(grow * 2);
    items.push(S(panel + '-grid100k', 'polyline', { panel, z, layer: panel + '-bars', pts: [[x0 - 10, yg], [x0 + 30 * w, yg]], stroke: C.grid, lw: 2, dash: [10, 10], alpha: ga, meta: { role: 'axis', panel, chart: panel } }));
    const gp = H.P(x0 + 30 * w + 14, yg, z);
    items.push(Tx(panel + '-g100k', '$100,000 nominal', gp[0], gp[1] + 10, 30, C['text-dim'], { role: 'axis-label', anchor: panel, chart: panel, alpha: ga, claims: [claim('axUsd100k')] }));
    items.push(Tx(panel + '-a0', '1966', a[0], a[1] + 48, 30, C['text-dim'], { role: 'axis-label', anchor: panel, chart: panel, year: 1966, align: 'center', claims: [claim('ax1966')] }));
    items.push(Tx(panel + '-a1', '1995', b[0], b[1] + 48, 30, C['text-dim'], { role: 'axis-label', anchor: panel, chart: panel, year: 1995, align: 'center', claims: [claim('ax1995')] }));
    return { x0, w, yb, Y };
  }
  B['a1-raise'] = (L, sc, H) => {
    const items = []; env(items, 'rs', { glow: 0.09, gx: 1500 });
    escalator(items, 'rs', L, H, (L - 0.5) / 0.9, 0);
    items.push(L1('rs-l1', 'It rises with inflation', 640, 360, 60, fade(L, 0.3)));
    items.push(Tx('rs-sub', 'withdrawal each year, nominal', 640, 450, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.6) }));
    return items;
  };
  B['a1-real'] = (L, sc, H) => {
    const items = []; env(items, 're', { glow: 0.09, gx: 1500 });
    const g = escalator(items, 're', L, H, 99, 300, { a: 0.9 });
    const tn = H.local(lineStart('a1-real.2'));
    // real withdrawal: flat at $40,000 in 1966 dollars, in the foreground
    items.push(S('re-flat', 'polyline', { panel: 're', z: -250, layer: 're-flat', pts: [[g.x0 - 10, g.yb - g.Y(40000)], [g.x0 + 30 * g.w, g.yb - g.Y(40000)]], stroke: C.text, lw: 5, meta: { role: 'mark', panel: 're' } }));
    items.push(L1('re-l1', 'Real: flat', 640, 360, 72, fadeOut(L, tn - 0.2, 0.3) * fade(L, 0.2)));
    items.push(L1('re-l1b', 'Nominal: climbs', 640, 360, 72, fade(L, tn - 0.2 + 0.3, 0.3)));
    return items;
  };
  B['a1-horizon'] = (L, sc, H) => {
    const items = []; env(items, 'hz', { glow: 0.08, floor: 1.2 });
    // a ribbon of 30 yearly segments across the floor, 1966 to 1995
    for (let k = 0; k < 30; k++) items.push(S('hz-seg' + k, 'rect', { panel: 'hz', z: 0, rect: [300 + k * 70, 820, 62, 40], radius: 5, fill: k % 5 === 0 ? C.c1966 : C['surface-2'], alpha: 1,
      meta: { role: 'mark', panel: 'hz', ...(k % 5 === 0 ? charShape('1966') : {}) } }));
    const a = H.P(331, 862, 0), b = H.P(300 + 29 * 70 + 31, 862, 0);
    items.push(S('hz-axis', 'polyline', { panel: 'hz', z: 0, pts: [[290, 866], [300 + 30 * 70, 866]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel: 'hz', chart: 'hz' } }));
    const inSafe = (x) => (x > 150 && x < 1770 ? 1 : 0);
    items.push(Tx('hz-a0', '1966', a[0], a[1] + 50, 30, C['text-dim'], { role: 'axis-label', anchor: 'hz', chart: 'hz', year: 1966, align: 'center', claims: [claim('ax1966')], alpha: inSafe(a[0]) * (L >= H.local(cueAbs('a1-horizon.1', '1966')) - 1 / 60 ? 1 : 0) }));
    items.push(Tx('hz-a1', '1995', b[0], b[1] + 50, 30, C['text-dim'], { role: 'axis-label', anchor: 'hz', chart: 'hz', year: 1995, align: 'center', claims: [claim('ax1995')], alpha: inSafe(b[0]) * (L >= H.local(cueAbs('a1-horizon.1', '1995')) - 1 / 60 ? 1 : 0) }));
    const t30 = H.local(cueAbs('a1-horizon.1', '30'));
    items.push(badge('hz-badge', 1150, 282, fade(L, t30 - 0.4, 0.2)));
    items.push(L1('hz-l1', '30 years', 1280, 360, 88, L >= t30 - 1 / 60 ? 1 : 0, { claims: [claim('years30')] }));
    return items;
  };
  B['a1-notax'] = (L, sc, H) => {
    const items = []; env(items, 'nt', { glow: 0.10, gx: 600 });
    items.push(S('nt-card', 'rect', { panel: 'nt', z: 0, rect: [470, 450, 980, 470], radius: 22, fill: C.surface, shadow: { alpha: 0.45, blur: 50, dy: 24 }, meta: { role: 'card', panel: 'nt' } }));
    items.push(L1('nt-l1', 'The rules', 640, 360, 64, fade(L, 0.2)));
    const rows = [['a1-notax.1', 'taxes', 'No taxes'], ['a1-notax.1', 'fees', 'No fees'], ['a1-notax.3', 'US', 'US only'], ['a1-notax.3', 'history', 'History, not a forecast']];
    rows.forEach(([sid, w, s], i) => {
      const t = H.local(cueAbs(sid, w)) - 0.1;
      items.push(S('nt-tick' + i, 'circle', { panel: 'nt', z: 0, c: [560, 540 + i * 96], r: 14 * back((L - t) / 0.3), fill: C.gain, alpha: L >= t ? 1 : 0, meta: { role: 'mark', panel: 'nt' } }));
      items.push(Tx('nt-r' + i, s, 610, 554 + i * 96, 42, C.text, { alpha: fade(L, t, 0.2), level: 2 }));
    });
    return items;
  };
  function tracks(items, panel, L, mirrorIn, o = {}) {
    // two tracks receding in depth: 1966 (left, amber, solid) and the mirror (right, blue, dashed)
    const lane = (ch, x, z0, a) => items.push(S(`${panel}-lane-${ch}`, 'poly', { panel, z: z0, layer: `${panel}-${ch}`, pts: [[x - 120, 1170, z0 - 300], [x + 120, 1170, z0 - 300], [x + 120, 1170, z0 + 2400], [x - 120, 1170, z0 + 2400]],
      fill: colorOf(ch), alpha: 0.22 * a, meta: { role: 'mark', panel, ...charShape(ch) } }));
    const rail = (ch, x, z0, a) => items.push(S(`${panel}-rail-${ch}`, 'polyline', { panel, z: z0, layer: `${panel}-${ch}r`, pts: [[x, 1168, z0 - 300], [x, 1168, z0 + 2400]], stroke: colorOf(ch), lw: 6,
      dash: ch === 'mirror' ? [18, 12] : null, alpha: a, meta: { role: 'mark', panel, ...charShape(ch) } }));
    lane('1966', o.x66 ?? 640, o.z66 ?? -150, 1); rail('1966', o.x66 ?? 640, o.z66 ?? -150, 1);
    const xm = (o.xm ?? 1280) + 500 * (1 - mirrorIn);
    lane('mirror', xm, o.zm ?? 250, mirrorIn); rail('mirror', xm, o.zm ?? 250, mirrorIn);
  }
  B['a1-mirror-in'] = (L, sc, H) => {
    const items = []; env(items, 'mi', { glow: 0.09, key: C['rim-light'] });
    const u = smooth((L - 0.4) / 1.0);
    tracks(items, 'mi', L, u);
    items.push(L1('mi-l1', 'A second retiree', 1280, 360, 64, fade(L, H.local(cueAbs('a1-mirror-in.1', 'second')) - 0.15, 0.25)));
    items.push(Tx('mi-l66', '1966 retiree', 330, 720, 36, C.c1966, { claims: [claim('y1966')], series: '1966' }));
    items.push(Tx('mi-lm', 'mirror retiree', 1360, 720, 36, C.cmirror, { alpha: u, series: 'mirror' }));
    return items;
  };
  function returnRows(items, panel, L, H, t1, t2) {
    const x0 = 300, w = 44, y66 = 640, ym = 930, s = 4.6; // px per percentage point
    const r66 = M.ret1966, rm = M.retMirror;
    for (let k = 0; k < 30; k++) {
      const a1 = clamp((L - t1 - k * 0.06) / 0.2), a2 = clamp((L - t2 - k * 0.06) / 0.2);
      const v1 = r66[k] * 100, v2 = rm[k] * 100;
      items.push(S(`${panel}-r66-${k}`, 'rect', { panel, z: 0, rect: [x0 + k * w, v1 >= 0 ? y66 - v1 * s : y66, 34, Math.abs(v1) * s], radius: 3, fill: C.c1966, alpha: a1,
        meta: { role: 'bar', panel, chart: panel + '-66', value: v1, full: true, orient: 'v', ...charShape('1966') } }));
      items.push(S(`${panel}-rm-${k}`, 'rect', { panel, z: 0, rect: [x0 + k * w, v2 >= 0 ? ym - v2 * s : ym, 34, Math.abs(v2) * s], radius: 3, fill: C.cmirror, alpha: a2,
        meta: { role: 'bar', panel, chart: panel + '-m', value: v2, full: true, orient: 'v', ...charShape('mirror') } }));
    }
    items.push(S(panel + '-ax66', 'polyline', { panel, z: 0, pts: [[x0 - 10, y66], [x0 + 30 * w, y66]], stroke: C.muted, lw: 2, alpha: clamp((L - t1) / 0.3), meta: { role: 'axis', panel, chart: panel + '-66' } }));
    items.push(S(panel + '-axm', 'polyline', { panel, z: 0, pts: [[x0 - 10, ym], [x0 + 30 * w, ym]], stroke: C.muted, lw: 2, alpha: clamp((L - t2) / 0.3), meta: { role: 'axis', panel, chart: panel + '-m' } }));
    // scale: 0% on both zero lines and a dashed 20% gridline on the first row
    items.push(S(panel + '-g20', 'polyline', { panel, z: 0, pts: [[x0 - 10, y66 - 20 * s], [x0 + 30 * w, y66 - 20 * s]], stroke: C.grid, lw: 2, dash: [10, 10], alpha: clamp((L - t1) / 0.3), meta: { role: 'axis', panel, chart: panel + '-66' } }));
    const lp = (y, a, id, text, cl) => { const p = H.P(x0 - 22, y, 0); items.push(Tx(id, text, p[0], p[1] + 10, 28, C['text-dim'], { align: 'right', role: 'axis-label', anchor: panel, chart: panel, alpha: a, claims: [claim(cl)] })); };
    lp(y66, clamp((L - t1) / 0.3), panel + '-z66', '0%', 'axPct0');
    lp(y66 - 20 * s, clamp((L - t1) / 0.3), panel + '-t20', '20%', 'axPct20');
    lp(ym, clamp((L - t2) / 0.3), panel + '-zm', '0%', 'axPct0');
    return { x0, w, y66, ym };
  }
  B['a1-mirror-rule'] = (L, sc, H) => {
    const items = []; env(items, 'mr', { glow: 0.08 });
    const t95 = H.local(cueAbs('a1-mirror-rule.2', '1995')), t66 = H.local(cueAbs('a1-mirror-rule.2', '1966')), t2 = t95 - 0.2;
    const g = returnRows(items, 'mr', L, H, 0.3, t2);
    items.push(L1('mr-l1', 'Same returns, reverse order', 1280, 360, 56, fade(L, 0.3) * fadeOut(L, t2 - 0.4)));
    const lab = (id, text, x, y, a, cl, role, year, chart) => items.push(Tx(id, text, x, y, 30, C['text-dim'], { align: 'center', alpha: a, claims: [claim(cl)], role, year, chart, anchor: role === 'axis-label' ? chart : null }));
    lab('mr-66a', '1966', g.x0 + 17, 450, fade(L, 0.3), 'ax1966', 'axis-label', 1966, 'mr-66');
    lab('mr-66b', '1995', g.x0 + 29 * g.w + 17, 450, fade(L, 1.9), 'ax1995', 'axis-label', 1995, 'mr-66');
    lab('mr-ma', '1995 first', g.x0 + 70, 1004, L >= t95 - 1 / 60 ? 1 : 0, 'y1995', 'label');
    lab('mr-mb', '1966 last', g.x0 + 29 * g.w - 40, 1004, L >= t66 - 1 / 60 ? 1 : 0, 'y1966', 'label');
    items.push(Tx('mr-t66', 'first retiree', 300, 540, 30, C.c1966, { series: '1966', alpha: fade(L, 0.3) }));
    items.push(Tx('mr-tm', 'mirror retiree', 1340, 720, 30, C.cmirror, { series: 'mirror', alpha: fade(L, t2) }));
    items.push(L1('mr-l1b', 'The mirror reads it backwards', 1280, 360, 52, fade(L, t2 - 0.05, 0.35)));
    return items;
  };
  B['a1-illus'] = (L, sc, H) => {
    const items = []; env(items, 'il', { glow: 0.08, key: C['rim-light'] });
    // the mirror row reflected on a glossy floor
    for (let k = 0; k < 30; k++) {
      const v = M.retMirror[k] * 100;
      items.push(S('il-b' + k, 'rect', { panel: 'il', z: 400, layer: 'il-far', rect: [300 + k * 44, 900 - Math.max(0, v) * 6, 34, Math.max(4, Math.abs(v) * 6)], radius: 3, fill: C.cmirror, alpha: 0.8,
        meta: { role: 'mark', panel: 'il', ...charShape('mirror') } }));
    }
    items.push(badge('il-badge', 960 - 125, 250, fade(L, 0.1, 0.2)));
    items.push(L1('il-l1', 'No one lived these years in this order', 960, 540, 56, fade(L, 0.3)));
    return items;
  };
  B['a1-samewd'] = (L, sc, H) => {
    const items = []; env(items, 'sw', { glow: 0.09 });
    const Y = (v) => v / 180000 * 360;
    for (const [ch, x0] of [['1966', 200], ['mirror', 1000]]) {
      for (let k = 0; k < 30; k++) {
        const v = M.plannedWd[k], g = clamp((L - 0.4 - k * 0.05) / 0.25);
        items.push(S(`sw-${ch}-${k}`, 'rect', { panel: 'sw', z: 0, rect: [x0 + k * 24, 900 - Y(v) * g, 18, Y(v) * g], radius: 2, fill: colorOf(ch),
          meta: { role: 'bar', panel: 'sw', chart: 'sw', value: v, full: g >= 1, orient: 'v', ...charShape(ch) } }));
      }
    }
    items.push(L1('sw-l1', 'Same dollars out, every year', 640, 360, 56, fade(L, 0.3)));
    items.push(Tx('sw-a', '1966 retiree', 200, 960, 30, C.c1966, { claims: [claim('y1966')], series: '1966' }));
    items.push(Tx('sw-b', 'mirror retiree', 1000, 960, 30, C.cmirror, { series: 'mirror' }));
    items.push(Tx('sw-c', 'inflation in calendar order for both', 1280, 460, 32, C.inflation, { align: 'center', alpha: fade(L, 0.8) }));
    return items;
  };
  function scale(items, panel, L, tiltU, o = {}) {
    const cx = o.cx ?? 960, top = o.top ?? 560, arm = o.arm ?? 420, tilt = tiltU;
    items.push(S(panel + '-post', 'rect', { panel, z: 0, rect: [cx - 10, top, 20, 360], radius: 6, fill: C.muted, meta: { role: 'mark', panel } }));
    items.push(S(panel + '-base', 'rect', { panel, z: 0, rect: [cx - 160, top + 350, 320, 26], radius: 8, fill: C.muted, meta: { role: 'mark', panel } }));
    const lx = cx - arm, rx = cx + arm, ly = top + tilt * 60, ry = top - tilt * 60;
    items.push(S(panel + '-beam', 'polyline', { panel, z: 0, pts: [[lx, ly], [rx, ry]], stroke: C.muted, lw: 10, meta: { role: 'mark', panel } }));
    const pan = (ch, x, y) => items.push(S(`${panel}-pan-${ch}`, 'poly', { panel, z: 0, pts: [[x - 120, y + 110], [x + 120, y + 110], [x + 80, y + 150], [x - 80, y + 150]], fill: colorOf(ch), meta: { role: 'mark', panel, ...charShape(ch) } }));
    pan('1966', lx, ly); pan('mirror', rx, ry);
    for (const [ch, x, y] of [['1966', lx, ly], ['mirror', rx, ry]]) items.push(S(`${panel}-str-${ch}`, 'polyline', { panel, z: 0, pts: [[x, y], [x, y + 110]], stroke: C.muted, lw: 3, meta: { role: 'mark', panel } }));
  }
  B['a1-question'] = (L, sc, H) => {
    const items = []; env(items, 'q', { glow: 0.10 });
    scale(items, 'q', L, 0.25 * Math.sin(L * 1.6) * (1 - smooth((L - 3) / 2)), { top: 620 });
    items.push(L1('q-l1', 'Same average, same place?', 960, 360, 64, fade(L, H.local(lineStart('a1-question.2')) - 0.1, 0.3)));
    items.push(Tx('q-sub', 'the question for part one', 960, 250, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.3) }));
    return items;
  };
  function avgBars(items, panel, L, char, x0, collapse, a = 1) {
    const r = char === 'mirror' ? M.retMirror : M.ret1966, g = M.geo * 100;
    for (let k = 0; k < 30; k++) {
      const v = r[k] * 100 * (1 - collapse) + g * collapse;
      items.push(S(`${panel}-${char}-${k}`, 'rect', { panel, z: 150, layer: panel + '-bars', rect: [x0 + k * 22, v >= 0 ? 860 - v * 7 : 860, 16, Math.max(2, Math.abs(v) * 7)], radius: 2, fill: colorOf(char), alpha: a,
        meta: { role: 'mark', panel, ...charShape(char) } }));
    }
  }
  B['a1-avg1966'] = (L, sc, H) => {
    const items = []; env(items, 'av', { glow: 0.10, gx: 500 });
    const tv = H.local(cueAbs('a1-avg1966.1', '9.7%'));
    avgBars(items, 'av', L, '1966', 200, smooth((L - (tv - 1.2)) / 1.2));
    items.push(L1('av-l1', '9.7%', 640, 360, 120, L >= tv - 1 / 60 ? 1 : 0, { color: C.c1966, series: '1966', claims: [claim('g1966')] }));
    items.push(Tx('av-sub', '1966 retiree, average return per year', 640, 470, 32, C['text-dim'], { align: 'center', alpha: L >= H.local(cueAbs('a1-avg1966.1', '1966')) - 1 / 60 ? 1 : 0, claims: [claim('y1966')] }));
    return items;
  };
  B['a1-avgmirror'] = (L, sc, H) => {
    const items = []; env(items, 'am', { glow: 0.10, key: C['rim-light'] });
    const tm = H.local(cueAbs('a1-avgmirror.1', '9.7%')), tid = H.local(lineStart('a1-avgmirror.3'));
    avgBars(items, 'am', L, '1966', 200, 1);
    avgBars(items, 'am', L, 'mirror', 1100, smooth((L - 0.2) / 1.0), fade(L, 0.1));
    items.push(Tx('am-66', '9.7%', 640, 360 + 32, 120, C.c1966, { align: 'center', weight: 700, series: '1966', claims: [claim('g1966')], level: L < tid - 0.2 ? 1 : null }));
    items.push(badge('am-badge', 1195, 280, fade(L, tm - 0.4, 0.2)));
    items.push(Tx('am-m', '9.7%', 1280, 360 + 32, 120, C.cmirror, { align: 'center', weight: 700, series: 'mirror', claims: [claim('gmirror')], alpha: L >= tm - 1 / 60 ? 1 : 0 }));
    items.push(Tx('am-sub', 'mirror retiree, average return per year', 1280, 470, 32, C['text-dim'], { align: 'center', alpha: fade(L, tm) }));
    items.push(L1('am-id', 'Identical', 960, 720 - 40, 72, fade(L, tid - 0.2, 0.2)));
    return items;
  };
  B['a1-geo'] = (L, sc, H) => {
    const items = []; env(items, 'ge', { glow: 0.10 });
    // two towers of the 30 growth factors (log heights): 1966 order (left) and reverse order (right), same total height
    const lg = (r) => Math.log(1 + r) * 200; // total height ~560 px: the towers stay below the top edge through the camera move
    for (const [ch, x, rs] of [['1966', 1050, M.ret1966], ['mirror', 1400, M.retMirror]]) {
      let y = 940;
      rs.forEach((r, k) => {
        const h = lg(r), a = clamp((L - 0.4 - k * 0.07 - (ch === 'mirror' ? 0.3 : 0)) / 0.2);
        const y0 = h >= 0 ? y - h : y;
        items.push(S(`ge-${ch}-${k}`, 'rect', { panel: 'ge', z: 0, rect: [x, y0, 200, Math.max(2, Math.abs(h))], fill: colorOf(ch), alpha: a * (0.65 + 0.35 * (k % 2)),
          meta: { role: 'mark', panel: 'ge', ...charShape(ch) } }));
        y -= h;
      });
    }
    const top = 940 - M.ret1966.reduce((s, r) => s + lg(r), 0);
    items.push(S('ge-top', 'polyline', { panel: 'ge', z: 0, pts: [[1030, top - 6], [1620, top - 6]], stroke: C.text, lw: 3, dash: [10, 8], alpha: fade(L, 3.2), meta: { role: 'mark', panel: 'ge' } }));
    items.push(L1('ge-l1', 'Same product, any order', 640, 360, 56, fade(L, 0.3)));
    items.push(Tx('ge-sub', 'compound rate: start dollar to end dollar', 640, 450, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.6) }));
    return items;
  };
  B['a1-arith'] = (L, sc, H) => {
    const items = []; env(items, 'ar', { glow: 0.09, gx: 500 });
    const x0 = 300, w = 44, yb = 800, s = 7;
    M.ret1966.forEach((r, k) => {
      const v = r * 100, g = clamp((L - 0.3 - k * 0.05) / 0.2);
      items.push(S('ar-b' + k, 'rect', { panel: 'ar', z: 0, rect: [x0 + k * w, v >= 0 ? yb - v * s * g : yb, 34, Math.abs(v) * s * g], radius: 3, fill: C.muted,
        meta: { role: 'bar', panel: 'ar', chart: 'ar', value: v, full: g >= 1, orient: 'v' } }));
    });
    const ta = H.local(cueAbs('a1-arith.1', '10.3%'));
    const ym = yb - M.arith * 100 * s;
    items.push(S('ar-mean', 'polyline', { panel: 'ar', z: 0, pts: [[x0 - 10, ym], [x0 + 30 * w, ym]], stroke: C.text, lw: 3, dash: [12, 8], alpha: L >= ta - 0.2 ? 1 : 0, meta: { role: 'mark', panel: 'ar' } }));
    items.push(S('ar-axis', 'polyline', { panel: 'ar', z: 0, pts: [[x0 - 10, yb], [x0 + 30 * w, yb]], stroke: C.muted, lw: 2, meta: { role: 'axis', panel: 'ar', chart: 'ar' } }));
    const a = H.P(x0 + 17, yb, 0), b = H.P(x0 + 29 * w + 17, yb, 0);
    items.push(Tx('ar-a0', '1966', a[0], 1000, 30, C['text-dim'], { role: 'axis-label', anchor: 'ar', chart: 'ar', year: 1966, align: 'center', claims: [claim('ax1966')] }));
    items.push(Tx('ar-a1', '1995', b[0], 1000, 30, C['text-dim'], { role: 'axis-label', anchor: 'ar', chart: 'ar', year: 1995, align: 'center', claims: [claim('ax1995')] }));
    items.push(L1('ar-l1', 'The simple average', 1280, 360, 60, fade(L, 0.3)));
    items.push(Tx('ar-num', '10.3%', 1280, 470, 44, C.text, { align: 'center', weight: 700, alpha: L >= ta - 1 / 60 ? 1 : 0, claims: [claim('arith')] }));
    items.push(Tx('ar-sub', 'add the returns, divide by the count', 1280, 250, 32, C['text-dim'], { align: 'center', alpha: fade(L, 0.3) }));
    return items;
  };
  B['a1-payoff'] = (L, sc, H) => {
    const items = []; env(items, 'po', { glow: 0.11 });
    scale(items, 'po', L, 0, { cx: 1450, top: 600, arm: 260 });
    const rows = [['a1-payoff.1', 'Same money in'], ['a1-payoff.2', 'Same money out'], ['a1-payoff.3', 'Same average']];
    rows.forEach(([sid, s], i) => items.push(Tx('po-r' + i, s, 300, 470 + i * 70, 42, C['text-dim'], { alpha: fade(L, H.local(lineStart(sid)) - 0.05, 0.2), level: 2 })));
    items.push(L1('po-l1', 'Only the order differs', 640, 720 + 30, 64, fade(L, H.local(cueAbs('a1-payoff.4', 'order')) - 0.2, 0.25)));
    return items;
  };

  // helpers for the builders of acts 2, 3, method and outro (render-d/prod/scenes-a2.js, scenes-a3.js, scenes-end.js)
  const K = { D, C, M, clamp, smooth, easeOut, back, fade, fadeOut, cueAbs, lineStart, S, Tx, L1, claim, badge, env, axisX, series, charShape, colorOf, yearsX,
    growthChart, moneyColumn, yearGrid, donut, escalator, tracks, returnRows, scale, avgBars };
  window.SCENES = { B, K, cueAbs, lineStart, smooth };
})();
