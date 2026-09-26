'use strict';
/* Continuous data canvas + virtual camera. renderFrame(t) is a pure function of time.
 * World graphics live in one SVG group transformed by the camera; text lives in a screen-space
 * overlay anchored to world points, so type always renders at token sizes (128/48/28).
 * Numbers reach the page only through K()/R() (claim spans). */

const D = window.DATA, TL = window.TL;
const TOK = { bg: '#0E1116', surface: '#171B22', ink: '#F2F4F7', muted: '#9AA4B2', accent: '#4C8DFF', warn: '#F2B441', pos: '#3FBF7F', neg: '#E5484D', grid: '#2A303B' };
const W = 1920, H = 1080, SAFE = 96;
const DRIFT = 8;          // px/s on screen (token range 8–20)
const STAGGER = 0.06;     // s (token range 40–80 ms)
const OVERSHOOT = 0.04;   // 4% (token range 3–5%)
const PARALLAX = [0.3, 1.0, 1.3];
const FPS = 30;

// ---------------- easing ----------------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, p) => a + (b - a) * p;
const easeIO = (p) => { p = clamp(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
const easeOut = (p) => 1 - Math.pow(1 - clamp(p), 3);
function bo(x, s) { const u = x - 1; return 1 + (s + 1) * u * u * u + s * u * u; }
const S_BACK = (() => { let lo = 0, hi = 3; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; let pk = 0; for (let i = 0; i <= 1000; i++) pk = Math.max(pk, bo(i / 1000, m)); if (pk > 1 + OVERSHOOT) hi = m; else lo = m; } return (lo + hi) / 2; })();
const easeBack = (p) => bo(clamp(p), S_BACK);

// ---------------- claims ----------------
const CL = Object.fromEntries(D.claims.map((c) => [c.claimId, c]));
const USED = new Set();
const FMT = {
  usd0: (v) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US'),
  pct2: (v) => v.toFixed(2) + '%', pct1: (v) => v.toFixed(1) + '%',
  pct0: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(0) + '%', int: (v) => String(Math.round(v)),
};
function K(id) { const c = CL[id]; if (!c) throw new Error('claim ' + id); USED.add(id); return `<span class="n" data-claim="${id}">${c.display}</span>`; }
function R(id, p) { // rolling counter of a claim: same formatter, value × eased progress
  const c = CL[id]; if (!c) throw new Error('claim ' + id); USED.add(id);
  if (p >= 1) return K(id);
  const v = c.fmt === 'int' ? Math.floor(c.value * p) : c.value * p;
  return `<span class="n" data-claim="${id}" data-roll="${p.toFixed(3)}">${FMT[c.fmt](v)}</span>`;
}

// ---------------- timeline ----------------
const SC = TL.scenes;
const S = Object.fromEntries(SC.map((s) => [s.id, s]));
const end = (id) => S[id].start + S[id].dur;
const sceneAt = (t) => SC.find((s) => t >= s.start && t < s.start + s.dur) || SC[SC.length - 1];
const loc = (id, t) => t - S[id].start;
const inStill = (t) => TL.still.some((w) => t >= w.start && t < w.end);

// ---------------- world geometry ----------------
const L = { x: (m) => 160 + (m / 48) * 1600, xs: (usd) => 160 + (usd / 27744) * 1600, yA: 580, yB: 680, h: 56 };
const R0 = { root: [2400, 560], a: [3700, 340], b: [3700, 780], meet: [3780, 560] };
const F = {
  bx: [180, 520], bw: 160, base: 2080, hs: 520 / 1900,
  sx0: 180, sx1: 860, sy: 2180,
  fx: (r) => 1060 + ((r - 2) / 8) * 720,
  fy: (v) => 2080 - ((v - 19700) / 2750) * 560,
};
F.sx = (r) => F.sx0 + ((r - 2) / 8) * (F.sx1 - F.sx0);
const M = { x: 2400, vx: 2640, ax0: 2960, ax1: 3880, rows: [1560, 1680, 1800], head: 1440 };
M.ax = (r) => M.ax0 + ((r - 2) / 8) * (M.ax1 - M.ax0);
const DN = { mx: (m) => 4560 + (m / 48) * 1600, fy: (v) => 1560 - ((v + 25000) / 45000) * 760, gy: (g) => 1180 - (g / 500) * 330 };

const curve = D.curve;
function curveAt(r, key) { const i = clamp((r - 2) / 0.05, 0, curve.length - 1); const a = Math.floor(i), b = Math.min(a + 1, curve.length - 1); return lerp(curve[a][key], curve[b][key], i - a); }
const BE = D.breakEvens[D.mainTax];
const BEPT = [F.fx(BE), F.fy(D.atBe.nwA)];
const GAPEND = [DN.mx(48), DN.gy(D.downside.gap[48])];

// ---------------- camera ----------------
function camTarget(s) {
  if (s.cam) return s.cam;
  if (s.id === 'morph') return { x: BEPT[0] - 60, y: BEPT[1], s: 1.6 };
  if (s.id === 'detail') return { x: BEPT[0] - 160, y: BEPT[1] - 20, s: 2.6 };
  if (s.id === 'downside') return { x: GAPEND[0] - 190, y: GAPEND[1] - 30, s: 2.6 };
  throw new Error('no cam ' + s.id);
}
function movingTime(s, l) { // local seconds of drift, excluding stillness windows
  let m = 0; const dt = 1 / 60;
  for (let x = 0; x < l; x += dt) if (!inStill(s.start + x)) m += Math.min(dt, l - x);
  return m;
}
const camEndCache = {};
function camEnd(i) {
  if (camEndCache[i]) return camEndCache[i];
  const s = SC[i], c = camTarget(s), d = movingTime(s, s.dur) * DRIFT / c.s;
  return (camEndCache[i] = { x: c.x + s.drift[0] * d, y: c.y + s.drift[1] * d, s: c.s });
}
function camera(t) {
  const s = sceneAt(t), i = s.index, l = t - s.start, c = camTarget(s);
  const d = movingTime(s, l) * DRIFT / c.s;
  const to = { x: c.x + s.drift[0] * d, y: c.y + s.drift[1] * d, s: c.s };
  if (i === 0) return { ...to, moving: 0 };
  const from = camEnd(i - 1), md = Math.min(1.2, 0.5 * s.dur), p = easeIO(l / md);
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), s: Math.exp(lerp(Math.log(from.s), Math.log(to.s), p)), moving: l < md && (from.x !== to.x || from.s !== to.s) ? 1 : 0 };
}
// integrated parallax offsets (per frame), so zoom changes never make the background jump
const PAR = (() => {
  const n = Math.ceil(TL.total * FPS) + 2; const out = [[0, 0, 0, 0]];
  let prev = camera(0), far = [0, 0], near = [0, 0];
  for (let f = 1; f < n; f++) {
    const c = camera(Math.min(f / FPS, TL.total - 1e-6));
    const dx = (c.x - prev.x) * c.s, dy = (c.y - prev.y) * c.s;
    far = [far[0] - dx * PARALLAX[0], far[1] - dy * PARALLAX[0]];
    near = [near[0] - dx * PARALLAX[2], near[1] - dy * PARALLAX[2]];
    out.push([far[0], far[1], near[0], near[1]]); prev = c;
  }
  return out;
})();

// ---------------- text overlay ----------------
let CAM = null;
const scr = (wx, wy) => [(wx - CAM.x) * CAM.s + W / 2, (wy - CAM.y) * CAM.s + H / 2];
// visibility window: from scene A (+delay) to the end of scene B, with fades
function win(t, a, b, delay = 0, fin = 0.35, fout = 0.3) {
  const t0 = S[a].start + delay, t1 = end(b);
  return Math.min(clamp((t - t0) / fin), clamp((t1 - t) / fout));
}
function enter(t, a, delay) { const p = clamp((t - S[a].start - delay) / 0.5); return (1 - easeBack(p)) * 12; }
let TEXT = [];
function text(o) { // {id, t, a, b, delay, wx, wy | sx, sy, align, cls, html, ev}
  const op = o.op !== undefined ? o.op : win(o.t, o.a, o.b, o.delay || 0);
  if (op <= 0.001) return;
  const [x, y] = o.sx !== undefined ? [o.sx, o.sy] : scr(o.wx, o.wy);
  const dy = enter(o.t, o.a, o.delay || 0);
  const tx = o.align === 'right' ? '-100%' : o.align === 'center' ? '-50%' : '0';
  const ty = o.valign === 'bottom' ? '-100%' : '0';
  TEXT.push(`<div class="t ${o.cls}" data-tid="${o.id}"${o.ev ? ` data-ev="${o.ev}"` : ''} style="left:${x.toFixed(1)}px;top:${(y + dy).toFixed(1)}px;opacity:${op.toFixed(3)};transform:translate(${tx},${ty})">${o.html}</div>`);
}
const underline = (p, color) => `<i style="width:${(easeIO(p) * 100).toFixed(1)}%;background:${color}"></i>`;

// ---------------- svg helpers ----------------
const f1 = (v) => v.toFixed(1);
const NS = 'vector-effect="non-scaling-stroke"';
function path(pts) { return pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])},${f1(p[1])}`).join(''); }
function line(x1, y1, x2, y2, stroke, w, extra = '') { return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${stroke}" stroke-width="${w}" ${NS} ${extra}/>`; }
function drawOn(d, stroke, w, p, extra = '') { return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" ${NS} pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - clamp(p)).toFixed(4)}" ${extra}/>`; }
const pr = (t, id, delay, dur) => clamp((t - S[id].start - delay) / dur);

// ================= panels =================
function panelLoan(t, g) {
  // timeline bars (scene timeline) morph into stacked-cost bars (scene interest)
  const vis = t >= S.timeline.start ? 1 : 0;
  if (!vis) return;
  const grow = easeOut(pr(t, 'timeline', 0.6, 1.2));
  const mp = easeIO(pr(t, 'interest', 0, 1.2));
  const dim = t >= S.scope.start ? lerp(1, 0.35, easeIO(pr(t, 'scope', 0, 0.5))) : 1;
  const ev = t >= S.scope.start && t < S.scope.start + 0.5 ? ' data-ev="scope:dismissL"' : '';
  const x0 = L.x(0);
  const aEnd = lerp(L.x(0) + (L.x(28) - L.x(0)) * grow, L.xs(D.loan.intA + 25000), mp);
  const bEnd = lerp(L.x(0) + (L.x(48) - L.x(0)) * grow, L.xs(D.loan.intB + 25000), mp);
  const pEnd = L.xs(25000);
  let s = `<g opacity="${dim.toFixed(3)}"${ev}${t >= S.timeline.start + 0.6 && t < S.timeline.start + 1.0 ? ' data-ev="timeline:tlBars"' : ''}>`;
  // principal segments fade in with the morph
  s += `<rect x="${x0}" y="${L.yA}" width="${f1(Math.max(0, Math.min(aEnd, pEnd) - x0))}" height="${L.h}" fill="${TOK.grid}" opacity="${mp.toFixed(3)}"/>`;
  s += `<rect x="${x0}" y="${L.yB}" width="${f1(Math.max(0, Math.min(bEnd, pEnd) - x0))}" height="${L.h}" fill="${TOK.grid}" opacity="${mp.toFixed(3)}"/>`;
  // A (accent, solid) and B (warn, hatched) — the interest part after the morph
  const aStart = lerp(x0, pEnd, mp), bStart = lerp(x0, pEnd, mp);
  s += `<rect x="${f1(aStart)}" y="${L.yA}" width="${f1(Math.max(0, aEnd - aStart))}" height="${L.h}" fill="${TOK.accent}"/>`;
  s += `<rect x="${f1(bStart)}" y="${L.yB}" width="${f1(Math.max(0, bEnd - bStart))}" height="${L.h}" fill="url(#hatchB)" stroke="${TOK.warn}" stroke-width="2" ${NS}/>`;
  // bracket for avoided interest
  const bp = easeOut(pr(t, 'interest', 3.3, 0.6));
  if (bp > 0 && t < S.scope.start + 0.5) {
    const y = 770, xa = L.xs(D.loan.intA + 25000), xb = L.xs(D.loan.intB + 25000);
    s += `<g opacity="${bp.toFixed(3)}">${line(xa, 750, xa, y, TOK.ink, 2)}${line(xb, 750, xb, y, TOK.ink, 2)}${line(xa, y, lerp(xa, xb, bp), y, TOK.ink, 2)}</g>`;
  }
  s += '</g>';
  g.push(s);
}

function textLoan(t) {
  const pe = clamp((t - S.facts.start - 0.9) / 1.2);
  text({ id: 'hero25', t, a: 'facts', b: 'facts', delay: 0.3, wx: 160, wy: 250, cls: 'l1 ink', html: `${R('balance', easeOut(pe))}<span class="l2 muted"> balance</span>`, ev: pe > 0 ? 'facts:balance' : '' });
  text({ id: 'factsline', t, a: 'facts', b: 'facts', delay: 2.7, wx: 160, wy: 420, cls: 'l2 muted', html: `${K('apr')} APR · ${K('months')} months left`, ev: 'facts:factsline' });
  text({ id: 'tlhead', t, a: 'timeline', b: 'timeline', delay: 0.6, wx: 160, wy: 500, cls: 'l3 muted', html: 'Loan paid off' });
  text({ id: 'tlA', t, a: 'timeline', b: 'timeline', delay: 1.8, wx: L.x(28) + 16, wy: L.yA + 10, cls: 'l3s accent', html: `month ${K('payoff_a')}`, ev: 'timeline:tlA' });
  text({ id: 'tlB', t, a: 'timeline', b: 'timeline', delay: 2.7, wx: L.x(48), wy: L.yB - 44, align: 'right', cls: 'l3s warn', html: `month ${K('horizon')}`, ev: 'timeline:tlB' });
  const ip = easeOut(pr(t, 'interest', 1.5, 1.2));
  text({ id: 'inthead', t, a: 'interest', b: 'interest', delay: 0.9, wx: L.xs(25000), wy: 500, cls: 'l3 muted', html: 'Interest paid' });
  text({ id: 'intA', t, a: 'interest', b: 'interest', delay: 1.5, wx: L.xs(D.loan.intA + 25000) + 14, wy: L.yA + 10, cls: 'l3s accent', html: R('int_a', ip), ev: ip > 0 ? 'interest:intRoll' : '' });
  text({ id: 'intB', t, a: 'interest', b: 'interest', delay: 1.5, wx: L.xs(D.loan.intB + 25000) + 14, wy: L.yB + 10, cls: 'l3s warn', html: R('int_b', ip) });
  const up = pr(t, 'interest', 4.2, 0.8);
  text({ id: 'avoided', t, a: 'interest', b: 'interest', delay: 3.3, wx: (L.xs(D.loan.intA + 25000) + L.xs(D.loan.intB + 25000)) / 2, wy: 790, align: 'center', cls: 'l2 ink',
    html: `${K('avoided')} avoided, <span class="u pos"${up > 0 ? ' data-ev="interest:certainLine"' : ''}>certain${underline(up, TOK.pos)}</span>`, ev: 'interest:avoided' });
}

function panelRoads(t, g) {
  const skel = clamp((t - 2.4) / 0.8);
  const pa = easeOut(pr(t, 'roads', 1.2, 1.0)), pb = easeOut(pr(t, 'roads', 2.4, 1.0));
  const cv = easeIO(pr(t, 'converge', 0.4, 1.4));
  const a = [lerp(R0.a[0], R0.meet[0], cv), lerp(R0.a[1], R0.meet[1], cv)], b = [lerp(R0.b[0], R0.meet[0], cv), lerp(R0.b[1], R0.meet[1], cv)];
  const [rx, ry] = R0.root;
  const dA = `M${rx},${ry} C${rx + 420},${ry} ${a[0] - 520},${lerp(R0.a[1], R0.a[1] + 60, cv)} ${a[0]},${a[1]}`;
  const dB = `M${rx},${ry} C${rx + 420},${ry} ${b[0] - 520},${lerp(R0.b[1], R0.b[1] - 60, cv)} ${b[0]},${b[1]}`;
  let s = '';
  // skeleton (faint) from the open
  s += `<g opacity="${(skel * 0.9).toFixed(3)}"${t >= 2.4 && t < 3.2 ? ' data-ev="open:skeleton"' : ''}>${drawOn(dA, TOK.grid, 3, 1)}${drawOn(dB, TOK.grid, 3, 1)}</g>`;
  const cmp = t >= S.roads.start + 3.6 ? 1 : 0;
  const w = cmp ? 6 : 4;
  s += drawOn(dA, TOK.accent, w, pa);
  s += drawOn(dB, TOK.warn, w, pb, 'stroke-dasharray="1 1"');
  const rootOp = clamp((t - S.extra.start - 0.3) / 0.4) || (t > S.extra.start ? 1 : 0);
  s += `<circle cx="${rx}" cy="${ry}" r="14" fill="${TOK.ink}" opacity="${Math.max(skel * 0.4, rootOp).toFixed(3)}"/>`;
  if (pa >= 1) s += `<circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="12" fill="${TOK.accent}"/>`;
  if (pb >= 1) s += `<circle cx="${f1(b[0])}" cy="${f1(b[1])}" r="12" fill="${TOK.bg}" stroke="${TOK.warn}" stroke-width="4" ${NS}/>`;
  if (cv > 0.98) s += `<circle cx="${R0.meet[0]}" cy="${R0.meet[1]}" r="20" fill="${TOK.ink}"/>`;
  g.push(s);
}
function textRoads(t) {
  text({ id: 'extra', t, a: 'extra', b: 'roads', delay: 0.6, wx: R0.root[0], wy: R0.root[1] - 110, align: 'center', cls: 'l2 ink', html: `+${K('extra')} a month`, ev: 'extra:extra' });
  text({ id: 'roadA', t, a: 'roads', b: 'roads', delay: 1.2, wx: 3000, wy: 230, cls: 'l2 accent', html: '<span style="font-weight:700">A:</span> extra to the loan', ev: 'roads:roadA' });
  text({ id: 'roadB', t, a: 'roads', b: 'roads', delay: 2.4, wx: 3000, wy: 820, cls: 'l2 warn', html: '<span style="font-weight:700">B:</span> invest the extra', ev: 'roads:roadB' });
  if (t >= S.roads.start + 3.6 && t < S.roads.start + 4.0) TEXT.push('<i data-ev="roads:roadsCompare" style="position:absolute"></i>');
  text({ id: 'converge', t, a: 'converge', b: 'converge', delay: 1.5, wx: R0.meet[0] - 40, wy: R0.meet[1] + 60, align: 'right', cls: 'l2 ink',
    html: `Flip at <span class="accent">${K('be_22')}</span> expected return · ${K('tax_22')} tax`, ev: 'converge:convergeText' });
}

function panelFlip(t, g) {
  if (t < S.bars.start) {
    // skeleton axes only
    const sk = clamp((t - 2.4) / 0.8) * 0.9;
    g.push(`<g opacity="${sk.toFixed(3)}">${line(F.bx[0] - 30, F.base, F.bx[1] + F.bw + 40, F.base, TOK.grid, 3)}${line(F.fx(2), F.fy(19700), F.fx(10), F.fy(19700), TOK.grid, 3)}</g>`);
    return;
  }
  const r = sliderR(t);
  const barsOp = t < S.morph.start ? 1 : 1 - easeIO(pr(t, 'morph', 0, 0.9));
  const dismissF = t >= S.matrix.start ? lerp(1, 0.35, easeIO(pr(t, 'matrix', 0, 0.6))) : 1;
  let s = `<g opacity="${dismissF.toFixed(3)}">`;
  // baseline
  s += line(F.bx[0] - 30, F.base, F.bx[1] + F.bw + 40, F.base, TOK.grid, 3);
  // bar A (certain)
  const pa = easeBack(pr(t, 'bars', 0.9, 0.6));
  const hA = D.atBe.barA * F.hs * pa;
  s += `<g opacity="${barsOp.toFixed(3)}"><rect x="${F.bx[0]}" y="${f1(F.base - hA)}" width="${F.bw}" height="${f1(hA)}" fill="${TOK.accent}"/></g>`;
  // threshold line at A's level
  const thr = F.base - D.atBe.barA * F.hs;
  const crossed = t >= S.sweep.start + TL.sweep.stepTimes[TL.sweep.crossK];
  if (t >= S.bars.start + 2.1) s += `<g opacity="${barsOp.toFixed(3)}"${crossed && t < S.sweep.start + TL.sweep.stepTimes[TL.sweep.crossK] + 0.4 ? ` data-ev="sweep:cross${TL.sweep.crossK}"` : ''}>${line(F.bx[0] - 20, thr, F.bx[1] + F.bw + 20, thr, crossed ? TOK.warn : TOK.accent, crossed ? 3 : 2, 'stroke-dasharray="10 8"')}</g>`;
  // bar B (grows with r) — morphs into the break-even point
  const pb = easeBack(pr(t, 'bars', 2.1, 0.6));
  const hB = curveAt(r, 'barB') * F.hs * pb;
  const mp = easeIO(pr(t, 'morph', 0, 1.0));
  if (mp < 1) {
    const x = lerp(F.bx[1], BEPT[0] - 12, mp), y = lerp(F.base - hB, BEPT[1] - 12, mp), w = lerp(F.bw, 24, mp), h = lerp(hB, 24, mp);
    s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${f1(lerp(0, 12, mp))}" fill="url(#hatchB)" stroke="${TOK.warn}" stroke-width="3" ${NS}/>`;
  }
  // slider
  const sp = easeOut(pr(t, 'bars', 4.5, 0.6));
  if (sp > 0) {
    s += `<g opacity="${(sp * barsOp).toFixed(3)}">${line(F.sx0, F.sy, F.sx1, F.sy, TOK.grid, 6)}${line(F.sx0, F.sy, F.sx(r), F.sy, TOK.accent, 6)}<circle cx="${f1(F.sx(r))}" cy="${F.sy}" r="16" fill="${TOK.ink}"/></g>`;
  }
  // flip chart: A and B net worth at month 48 vs return, drawn up to the slider
  if (t >= S.sweep.start) {
    const rmax = t < S.settle.start ? r : 10;
    const pts = (key) => { const out = []; for (const c of curve) { if (c.r > rmax + 1e-9) break; out.push([F.fx(c.r), F.fy(c[key])]); } if (rmax < 10) out.push([F.fx(rmax), F.fy(curveAt(rmax, key))]); return out; };
    s += line(F.fx(2), F.fy(19700), F.fx(10), F.fy(19700), TOK.grid, 3);
    s += `<path d="${path(pts('nwA'))}" fill="none" stroke="${TOK.accent}" stroke-width="5" ${NS}/>`;
    s += `<path d="${path(pts('nwB'))}" fill="none" stroke="${TOK.warn}" stroke-width="5" stroke-dasharray="14 10" ${NS}/>`;
    // break-even point and guide (after the morph)
    if (mp >= 1) {
      const gp = easeOut(pr(t, 'flip', 0.3, 0.8));
      s += line(BEPT[0], BEPT[1], BEPT[0], lerp(BEPT[1], F.fy(19700), gp), TOK.muted, 2, 'stroke-dasharray="6 8"');
      s += `<circle cx="${f1(BEPT[0])}" cy="${f1(BEPT[1])}" r="12" fill="${TOK.ink}" stroke="${TOK.bg}" stroke-width="4" ${NS}/>`;
      // arrow doodle
      const ap = easeIO(pr(t, 'flip', 3.3, 0.8));
      if (ap > 0 && t < S.matrix.start + 0.6) {
        const ax = BEPT[0] + 150, ay = BEPT[1] - 190;
        s += `<g${ap < 1 ? ' data-ev="flip:arrow"' : ''}>${drawOn(`M${ax},${ay} Q${BEPT[0] + 130},${BEPT[1] - 50} ${BEPT[0] + 26},${BEPT[1] - 18}`, TOK.ink, 4, ap)}</g>`;
      }
    }
  }
  s += '</g>';
  g.push(s);
}
function sliderR(t) {
  if (t < S.sweep.start + TL.sweep.t0) return 2;
  if (t < S.settle.start) return lerp(2, 10, clamp((t - S.sweep.start - TL.sweep.t0) / (TL.sweep.t1 - TL.sweep.t0)));
  const p = (t - S.settle.start - TL.settle.t0) / (TL.settle.t1 - TL.settle.t0);
  return lerp(10, BE, easeBack(p));
}
function sweepK(r) { return clamp(Math.floor((r - 2) / 0.25 + 1e-9), 0, 32); }
function textFlip(t) {
  const r = sliderR(t), k = sweepK(r);
  const landed = t >= S.settle.start + TL.settle.t1;
  const inSweep = t >= S.sweep.start && t < S.settle.start;
  const bVal = landed ? K('barb_be') : K(`barb_${k}`);
  const topA = F.base - D.atBe.barA * F.hs, topB = F.base - curveAt(r, 'barB') * F.hs;
  text({ id: 'barAval', t, a: 'bars', b: 'settle', delay: 0.9, wx: F.bx[0] + F.bw / 2, wy: topA - 50, align: 'center', cls: 'l3s accent', html: K('avoided'), ev: 'bars:barA' });
  text({ id: 'barBval', t, a: 'bars', b: 'settle', delay: 2.1, wx: F.bx[1] + F.bw / 2, wy: topB - 50, align: 'center', cls: 'l3s warn', html: bVal, ev: 'bars:barB' });
  text({ id: 'barAcap', t, a: 'bars', b: 'settle', delay: 0.9, wx: F.bx[0] + F.bw / 2, wy: F.base + 16, align: 'center', cls: 'l3 muted', html: 'Interest avoided' });
  text({ id: 'barBcap', t, a: 'bars', b: 'settle', delay: 2.1, wx: F.bx[1] + F.bw / 2, wy: F.base + 16, align: 'center', cls: 'l3 muted', html: 'Extra after-tax growth' });
  if (t >= S.bars.start + 3.3 && t < S.bars.start + 3.7) TEXT.push('<i data-ev="bars:barsCompare" style="position:absolute"></i>');
  text({ id: 'retcap', t, a: 'bars', b: 'settle', delay: 4.5, wx: F.sx1 + 40, wy: F.sy - 76, cls: 'l3 muted', html: 'Expected return' });
  const ev = inSweep && k > 0 ? `sweep:step${k}` : landed ? 'settle:land' : 'bars:slider';
  text({ id: 'retval', t, a: 'bars', b: 'settle', delay: 4.5, wx: F.sx1 + 40, wy: F.sy - 40, cls: 'l2 ink', html: landed ? K('be_22') : K(`r_${k}`), ev });
  text({ id: 'equal', t, a: 'settle', b: 'settle', delay: TL.settle.t1, wx: F.bx[1] + F.bw + 40, wy: topA - 17, cls: 'l3s ink', html: 'Equal' });
  // flip chart line labels (at the left end of each line)
  const lab = (id, key, cls, name, a, b) => text({ id, t, a, b, delay: 0.6, wx: F.fx(2) - 20, wy: F.fy(curveAt(2, key)) + (key === 'nwA' ? -40 : 4), align: 'right', cls, html: name });
  lab('fA', 'nwA', 'l3s accent', 'A', 'sweep', 'sweep');
  lab('fB', 'nwB', 'l3s warn', 'B', 'sweep', 'sweep');
  lab('fA2', 'nwA', 'l3s accent', 'A', 'flip', 'flip');
  lab('fB2', 'nwB', 'l3s warn', 'B', 'flip', 'flip');
  // detail hero
  const [px, py] = scr(BEPT[0], BEPT[1]);
  const up = pr(t, 'detail', 2.2, 0.9);
  text({ id: 'hero670', t, a: 'detail', b: 'detail', delay: 1.3, sx: px - 60, sy: py - 100, align: 'right', valign: 'bottom', cls: 'l1 ink',
    html: `<span class="u">${K('be_22')}${underline(up, TOK.accent)}</span>`, ev: 'detail:hero670' });
  if (up > 0 && up < 1) TEXT.push('<i data-ev="detail:underline670" style="position:absolute"></i>');
  text({ id: 'hero670cap', t, a: 'detail', b: 'detail', delay: 1.6, sx: px - 60, sy: py - 40, align: 'right', valign: 'bottom', cls: 'l2 muted', html: `break-even return · ${K('tax_22')} tax` });
  text({ id: 'flip670', t, a: 'flip', b: 'flip', delay: 0.6, wx: BEPT[0] - 60, wy: BEPT[1] - 40, align: 'right', valign: 'bottom', cls: 'l1 ink', html: K('be_22') });
  text({ id: 'below', t, a: 'flip', b: 'flip', delay: 1.2, wx: BEPT[0] - 30, wy: 2010, align: 'right', cls: 'l3s accent', html: 'Below: A ends ahead', ev: 'flip:below' });
  text({ id: 'above', t, a: 'flip', b: 'flip', delay: 2.4, wx: BEPT[0] + 30, wy: 2010, cls: 'l3s warn', html: 'Above: B', ev: 'flip:above' });
}

function panelMatrix(t, g) {
  if (t < S.tax.start) { const sk = clamp((t - 2.4) / 0.8) * 0.9; g.push(`<g opacity="${sk.toFixed(3)}">${M.rows.map((y) => line(M.ax0, y + 30, M.ax1, y + 30, TOK.grid, 3)).join('')}</g>`); return; }
  const dim = t >= S.sequence.start ? lerp(1, 0.35, easeIO(pr(t, 'sequence', 0, 0.5))) : 1;
  let s = `<g opacity="${dim.toFixed(3)}"${t >= S.sequence.start && t < S.sequence.start + 0.5 ? ' data-ev="sequence:dismissM"' : ''}>`;
  M.rows.forEach((y, i) => {
    const ap = easeOut(pr(t, 'tax', 1.8 + i * STAGGER, 0.6));
    s += line(M.ax0, y + 30, lerp(M.ax0, M.ax1, ap), y + 30, TOK.grid, 3);
    const tax = D.taxes[i];
    const be = D.breakEvens[tax];
    if (t >= S.matrix.start) {
      const rp = i === 1 ? 1 : easeOut(pr(t, 'matrix', 1.8, 1.0));
      if (i !== 1 || t >= S.matrix.start + 1.2) s += `<circle cx="${f1(lerp(M.ax0, M.ax(be), rp))}" cy="${y + 30}" r="12" fill="${i === 1 ? TOK.accent : TOK.ink}"/>`;
    }
  });
  // morph: the break-even point flies from the flip chart to the 22% row
  const fp = easeIO(pr(t, 'matrix', 0, 1.2));
  if (t >= S.matrix.start && fp < 1) s += `<circle cx="${f1(lerp(BEPT[0], M.ax(BE), fp))}" cy="${f1(lerp(BEPT[1], M.rows[1] + 30, fp))}" r="12" fill="${TOK.ink}"/>`;
  // circle doodle around 7.59%
  const cp = easeIO(pr(t, 'matrix32', 0.3, 0.7));
  if (cp > 0 && t < S.certain.start + 0.4) s += `<g${cp < 1 ? ' data-ev="matrix32:circle32"' : ''}>${drawOn(`M${M.vx - 44},${M.rows[2] + 29} a128,48 0 1,0 256,0 a128,48 0 1,0 -256,0`, TOK.warn, 4, cp)}</g>`;
  // two-column compare: certain line vs fan of possible returns
  const cc = easeOut(pr(t, 'certain', 1.2, 1.0));
  if (cc > 0) {
    s += drawOn(`M2400,2330 L2960,2240`, TOK.pos, 5, cc);
    for (let r = 2; r <= 10; r += 2) s += drawOn(`M3300,2330 L3860,${2330 - 18 * r}`, TOK.warn, 3, cc, 'stroke-dasharray="1 1"');
  }
  s += '</g>';
  g.push(s);
}
function textMatrix(t) {
  text({ id: 'taxhead', t, a: 'tax', b: 'tax', delay: 0.9, wx: M.x, wy: M.head, cls: 'l2 ink', html: `Gains taxed once, at month ${K('horizon')}`, ev: 'tax:taxHead' });
  text({ id: 'mhead', t, a: 'matrix', b: 'matrix', delay: 0.9, wx: M.x, wy: M.head, cls: 'l2 ink', html: 'Break-even by tax rate', ev: 'matrix:matrixHead' });
  const rp = easeOut(pr(t, 'matrix', 1.8, 1.0));
  M.rows.forEach((y, i) => {
    const tax = D.taxes[i];
    text({ id: `tax${tax}`, t, a: 'tax', b: 'matrix32', delay: 1.8 + i * STAGGER, wx: M.x, wy: y, cls: 'l2 muted', html: K(`tax_${tax}`), ev: i === 0 ? 'tax:taxRows' : '' });
    if (i === 1) text({ id: `be${tax}`, t, a: 'matrix', b: 'matrix32', delay: 1.2, wx: M.vx, wy: y, cls: 'l2b accent', html: K(`be_${tax}`) });
    else text({ id: `be${tax}`, t, a: 'matrix', b: 'matrix32', delay: 1.8, wx: M.vx, wy: y, cls: 'l2b ink', html: R(`be_${tax}`, rp), ev: i === 0 && rp > 0 ? 'matrix:matrixRoll' : '' });
  });
  // two columns
  text({ id: 'c1h', t, a: 'certain', b: 'certain', delay: 1.2, wx: 2400, wy: 1930, cls: 'l3 muted', html: 'Loan payoff', ev: 'certain:columns' });
  text({ id: 'c1v', t, a: 'certain', b: 'certain', delay: 1.2 + STAGGER, wx: 2400, wy: 1965, cls: 'l1 pos', html: K('apr') });
  text({ id: 'c1c', t, a: 'certain', b: 'certain', delay: 1.2 + 2 * STAGGER, wx: 2400, wy: 2105, cls: 'l3s pos', html: 'certain' });
  text({ id: 'c2h', t, a: 'certain', b: 'certain', delay: 1.2, wx: 3300, wy: 1930, cls: 'l3 muted', html: 'Investing' });
  text({ id: 'c2v', t, a: 'certain', b: 'certain', delay: 1.2 + STAGGER, wx: 3300, wy: 1965, cls: 'l1 warn', html: `${K('axis_lo')}–${K('axis_hi')}` });
  text({ id: 'c2c', t, a: 'certain', b: 'certain', delay: 1.2 + 2 * STAGGER, wx: 3300, wy: 2105, cls: 'l3s warn', html: 'expected, not certain' });
}

function panelDown(t, g) {
  if (t < S.sequence.start) { const sk = clamp((t - 2.4) / 0.8) * 0.9; g.push(`<g opacity="${sk.toFixed(3)}">${line(DN.mx(0), 1560, DN.mx(48), 1560, TOK.grid, 3)}</g>`); return; }
  const dim = t >= S.converge.start ? lerp(1, 0.35, easeIO(pr(t, 'converge', 0, 0.5))) : 1;
  let s = `<g opacity="${dim.toFixed(3)}"${t >= S.converge.start && t < S.converge.start + 0.5 ? ' data-ev="converge:dismissD"' : ''}>`;
  // sequence strip (timeline, months): 8% for months 1–36, −20% for 37–48
  const sp = easeOut(pr(t, 'sequence', 1.5, 0.8));
  s += `<rect x="${DN.mx(0)}" y="1620" width="${f1((DN.mx(36) - DN.mx(0)) * sp)}" height="28" fill="${TOK.grid}"/>`;
  if (sp > 0.6) s += `<rect x="${DN.mx(36)}" y="1620" width="${f1((DN.mx(48) - DN.mx(36)) * clamp((sp - 0.6) / 0.4))}" height="28" fill="${TOK.neg}"/>`;
  // race: dual lines drawing on in time, then morph to the gap line (B minus A)
  const mo = t < S.race.start ? 0 : clamp((t - S.race.start - TL.race.t0) / (TL.race.t1 - TL.race.t0)) * 48;
  const gm = easeIO(pr(t, 'gap', 0, 1.2));
  const A = D.downside.a, B = D.downside.b, G = D.downside.gap;
  const ya = (m) => lerp(DN.fy(A[m]), DN.gy(0), gm), yb = (m) => lerp(DN.fy(B[m]), DN.gy(G[m]), gm);
  if (t >= S.race.start) {
    const n = Math.floor(mo), fr = mo - n;
    const pts = (yf) => { const o = []; for (let m = 0; m <= n; m++) o.push([DN.mx(m), yf(m)]); if (n < 48 && fr > 0) o.push([DN.mx(mo), lerp(yf(n), yf(n + 1), fr)]); return o; };
    s += line(DN.mx(0), 1560, DN.mx(48), 1560, TOK.grid, 3);
    s += `<path d="${path(pts(ya))}" fill="none" stroke="${TOK.accent}" stroke-width="5" ${NS}/>`;
    s += `<path d="${path(pts(yb))}" fill="none" stroke="${TOK.warn}" stroke-width="5" stroke-dasharray="14 10" ${NS}/>`;
  }
  // crossing marker
  const cm = easeBack(pr(t, 'cross', 2.4, 0.5));
  if (cm > 0) {
    const m0 = D.downside.cross - 1, g0 = G[m0], g1 = G[m0 + 1], fx = g0 / (g0 - g1);
    s += `<circle cx="${f1(DN.mx(m0 + fx))}" cy="${f1(DN.gy(0))}" r="${f1(14 * cm)}" fill="${TOK.ink}" stroke="${TOK.bg}" stroke-width="4" ${NS}${cm < 1 ? ' data-ev="cross:crossMark"' : ''}/>`;
  }
  if (t >= S.downside.start) s += `<circle cx="${f1(GAPEND[0])}" cy="${f1(GAPEND[1])}" r="10" fill="${TOK.warn}"/>`;
  s += '</g>';
  g.push(s);
}
function textDown(t) {
  text({ id: 'seqtext', t, a: 'sequence', b: 'sequence', delay: 1.5, wx: DN.mx(0), wy: 1480, cls: 'l2 ink', html: 'A stated sequence', ev: 'sequence:seqText' });
  text({ id: 'seq8', t, a: 'sequence', b: 'sequence', delay: 2.0, wx: DN.mx(18), wy: 1680, align: 'center', cls: 'l2 muted', html: K('seq_first') });
  text({ id: 'seq20', t, a: 'sequence', b: 'sequence', delay: 2.4, wx: DN.mx(42), wy: 1680, align: 'center', cls: 'l2 neg', html: `then ${K('seq_second')}` });
  const mo = clamp((t - S.race.start - TL.race.t0) / (TL.race.t1 - TL.race.t0));
  const mNow = Math.floor(mo * 48);
  const tick = TL.race.tickEvery;
  const ev = t >= S.race.start && mNow >= tick && mNow % tick === 0 ? `race:month${mNow}` : '';
  text({ id: 'month', t, a: 'race', b: 'race', delay: 0.6, wx: DN.mx(0), wy: 750, cls: 'l2 ink', html: `Month ${R('horizon', mo)}`, ev: ev || 'race:raceAxes' });
  text({ id: 'nwlab', t, a: 'race', b: 'race', delay: 0.6 + STAGGER, wx: DN.mx(0), wy: 820, cls: 'l3 muted', html: 'Net worth after tax' });
  text({ id: 'legA', t, a: 'race', b: 'race', delay: 0.6 + 2 * STAGGER, wx: DN.mx(0), wy: 866, cls: 'l3s accent', html: 'A' });
  text({ id: 'legB', t, a: 'race', b: 'race', delay: 0.6 + 2 * STAGGER, wx: DN.mx(0) + 48, wy: 866, cls: 'l3s warn', html: 'B' });
  text({ id: 'nofc', t, a: 'race', b: 'race', delay: 1.2, wx: DN.mx(48), wy: 760, align: 'right', cls: 'l3 muted', html: 'not a forecast' });
  const G = D.downside.gap;
  text({ id: 'gaplab', t, a: 'cross', b: 'cross', delay: 0.6, wx: DN.mx(29), wy: DN.gy(G[29]) - 64, cls: 'l3s warn', html: 'B minus A', ev: 'cross:gapLabel' });
  text({ id: 'crosstext', t, a: 'cross', b: 'cross', delay: 3.3, wx: DN.mx(D.downside.cross) - 30, wy: DN.gy(0) + 24, align: 'right', cls: 'l2 ink', html: `A ahead from month <span class="l1">${K('cross_month')}</span>`, ev: 'cross:crossText' });
  const [px, py] = scr(GAPEND[0], GAPEND[1]);
  const up = pr(t, 'downside', 2.2, 0.9);
  text({ id: 'hero459', t, a: 'downside', b: 'downside', delay: 1.3, sx: px - 50, sy: py + 30, align: 'right', cls: 'l1 accent',
    html: `<span class="u">+${K('gap_end')}${underline(up, TOK.accent)}</span>`, ev: 'downside:hero459' });
  if (up > 0 && up < 1) TEXT.push('<i data-ev="downside:underline459" style="position:absolute"></i>');
  text({ id: 'hero459cap', t, a: 'downside', b: 'downside', delay: 1.5, sx: px - 50, sy: py + 170, align: 'right', cls: 'l2 muted', html: `A, month ${K('horizon')}` });
}

function textScreen(t) {
  text({ id: 'title1', t, a: 'open', b: 'open', delay: 0.6, sx: 160, sy: 330, cls: 'l1 ink', html: K('apr'), ev: 'open:title' });
  text({ id: 'title2', t, a: 'open', b: 'open', delay: 0.6 + STAGGER, sx: 160, sy: 480, cls: 'l2 ink', html: 'car loan: pay off early, or invest?' });
  text({ id: 'title3', t, a: 'open', b: 'open', delay: 0.6 + 2 * STAGGER, sx: 160, sy: 560, cls: 'l3 muted', html: 'US only' });
  text({ id: 'scope', t, a: 'scope', b: 'scope', delay: 1.2, sx: W / 2, sy: 500, align: 'center', cls: 'l2 ink', html: 'US only. Inputs are stated, not forecasts.', ev: 'scope:scope' });
  text({ id: 'outro1', t, a: 'outro', b: 'outro', delay: 1.2, sx: W / 2, sy: 470, align: 'center', cls: 'l2 ink', html: 'A threshold, not a forecast. US only.', ev: 'outro:outroText' });
}

// ---------------- frame ----------------
function background(t, cam) {
  const f = Math.min(PAR.length - 1, Math.round(t * FPS));
  const [fx, fy, nx, ny] = PAR[f];
  const mod = (v, m) => ((v % m) + m) % m;
  let s = `<defs>`
    + `<pattern id="far" width="160" height="160" patternUnits="userSpaceOnUse" patternTransform="translate(${f1(mod(fx, 160))},${f1(mod(fy, 160))})"><circle cx="2" cy="2" r="1.5" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="near" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="translate(${f1(mod(nx, 260))},${f1(mod(ny, 260))})"><circle cx="3" cy="3" r="3" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="mid" width="96" height="96" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="${f1(2 / cam.s)}" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="hatchB" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="${TOK.surface}"/><rect width="5" height="12" fill="${TOK.warn}"/></pattern>`
    + `</defs><rect width="${W}" height="${H}" fill="url(#far)"/>`;
  return s;
}

function renderFrame(t) {
  CAM = camera(t);
  TEXT = [];
  const g = [];
  g.push(`<rect x="-2000" y="-2000" width="10400" height="6500" fill="url(#mid)"/>`);
  panelLoan(t, g); panelRoads(t, g); panelFlip(t, g); panelMatrix(t, g); panelDown(t, g);
  textLoan(t); textRoads(t); textFlip(t); textMatrix(t); textDown(t); textScreen(t);
  const fade = t > TL.total - 0.9 ? clamp((TL.total - t) / 0.9) : 1;
  const camEv = CAM.moving ? ` data-ev="${sceneAt(t).id}:cam"` : '';
  const fadeEv = t >= S.outro.start + 5.1 && t < S.outro.start + 5.5 ? ' data-ev="outro:fadeAll"' : '';
  document.getElementById('stage').innerHTML =
    `<svg width="${W}" height="${H}">${background(t, CAM)}`
    + `<g${camEv} transform="translate(${W / 2} ${H / 2}) scale(${CAM.s.toFixed(5)}) translate(${(-CAM.x).toFixed(2)} ${(-CAM.y).toFixed(2)})">${g.join('')}</g>`
    + `<rect width="${W}" height="${H}" fill="url(#near)"/></svg>`
    + `<div id="overlay"${fadeEv} style="position:absolute;inset:0;opacity:${fade.toFixed(3)}">${TEXT.join('')}</div>`;
  // text that would leave the safe area fades out instead of clipping
  for (const el of document.querySelectorAll('#overlay .t')) {
    const r = el.getBoundingClientRect();
    const inset = Math.min(r.left - SAFE, r.top - SAFE, W - SAFE - r.right, H - SAFE - r.bottom);
    if (inset < 16) { const k = clamp(inset / 16); el.style.opacity = (parseFloat(el.style.opacity) * k).toFixed(3); if (k <= 0.02) el.removeAttribute('data-ev'); }
  }
  document.querySelector('svg').style.opacity = fade.toFixed(3);
  return sceneAt(t).id;
}

// DOM probes for sync measurement: data-ev elements with effective opacity > 0.02
function probes() {
  const out = [];
  for (const el of document.querySelectorAll('[data-ev]')) {
    let op = 1, e = el;
    while (e && e.nodeType === 1) { const o = e.getAttribute('opacity') ?? e.style.opacity; if (o !== null && o !== '') op *= parseFloat(o); e = e.parentElement; }
    if (op > 0.02) out.push(el.getAttribute('data-ev'));
  }
  return out;
}

window.SEG = { renderFrame, probes, TL, USED, TOTAL: TL.total, camera, sceneAt };
