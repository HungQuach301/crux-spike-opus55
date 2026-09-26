'use strict';
/* Test C renderer. Canvas + camera engine from test B (render-motion/scenes.js): one SVG world
 * under a virtual camera, screen-space text anchored to world points, renderFrame(t) a pure
 * function of time. Fixes from out/conventions.md:
 *   - panels are <g data-panel>; panels a scene does not list fade to 0 during the camera move
 *   - background dot layers are painted before all data
 *   - curves carry data-label, line charts carry axes + anchors, series carry data-series
 *   - timing comes from the voice: anchors (TL.scenes[].anchors) are word onsets
 * Numbers reach the page only through claim spans (K/KS/R). */

const D = window.DATA, TL = window.TL;
const TOK = { bg: '#0E1116', surface: '#171B22', ink: '#F2F4F7', muted: '#9AA4B2', accent: '#4C8DFF', warn: '#F2B441', pos: '#3FBF7F', neg: '#E5484D', grid: '#2A303B' };
const COL = { A: TOK.warn, B: TOK.accent };
const W = 1920, H = 1080, SAFE = 96;
const DRIFT = 8, STAGGER = 0.06, OVERSHOOT = 0.04, PARALLAX = [0.3, 1.0, 1.3], FPS = 30;
const FADE = 0.35, PRE = TL.pre;

// ---------------- easing (test B tokens) ----------------
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
  pct2: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '%', pct1: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%',
  pct0: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(0) + '%', int: (v) => (v < 0 ? '−' : '') + String(Math.abs(Math.round(v))), year: (v) => String(v),
};
function K(id, extra = '') { const c = CL[id]; if (!c) throw new Error('claim ' + id); USED.add(id); return `<span class="n" data-claim="${id}"${extra}>${c.display}</span>`; }
// a claim span with its own onset (fades in from t0; used when one text holds several spoken numbers)
function KS(id, t, t0, ev) {
  const op = clamp((t - t0) / FADE);
  return K(id, ` style="opacity:${op.toFixed(3)}"${ev && op > 0 ? ` data-ev="${ev}"` : ''}`);
}
// rolling counter: starts at the word onset, 0.5 s ease-out, settles on the claim display
function R(id, t, tw) {
  const c = CL[id]; if (!c) throw new Error('claim ' + id); USED.add(id);
  const p = easeOut((t - tw) / 0.5);
  if (p >= 1) return K(id);
  const v = c.fmt === 'int' ? Math.floor(c.value * p) : c.value * p;
  return `<span class="n" data-claim="${id}" data-roll="${p.toFixed(3)}">${FMT[c.fmt](v)}</span>`;
}

// ---------------- timeline ----------------
const SC = TL.scenes;
const S = Object.fromEntries(SC.map((s) => [s.id, s]));
const has = (id) => !!S[id];
const end = (id) => S[id].start + S[id].dur;
const sceneAt = (t) => SC.find((s) => t >= s.start && t < s.start + s.dur) || SC[SC.length - 1];
const AT = (sc, name) => { const a = S[sc] && S[sc].anchors[name]; if (a === undefined) throw new Error(`anchor ${sc}.${name}`); return a; };
const ON = (sc, name) => AT(sc, name) - PRE; // a spoken element starts fading in here
const T0 = (sc, d = 0) => S[sc].start + d;
const inStill = (t) => TL.still.some((w) => t >= w.start && t < w.end);
const pr = (t, t0, dur) => clamp((t - t0) / dur);

// ---------------- world geometry ----------------
const HK = { x0: 200, cw: 28, gap: 5.5, yA: 880, yB: 940, h: 44 };
HK.cx = (m) => HK.x0 + (m - 1) * (HK.cw + HK.gap);
const FK = { root: [2820, 560], a: [3900, 360], b: [3900, 760] };
const AX = { y: 2100, x0: 360, x1: 1560, px: 960 };
const LN = { x: (m) => 160 + (m / 48) * 1600, xs: (usd) => 160 + (usd / 3000) * 1600, yA: 3480, yB: 3570, h: 56, axisY: 3680, facts: 3340 };
const CS = { ax: 2900, bx: 3620, w: 200, base: 3880, k: 0.5 };
const EQ = { lx: 700, rx: 1060, w: 160, base: 5360, k: 0.25 };
const XA = LN.xs(D.loan.intA), XB = LN.xs(D.loan.intB);

// ---------------- camera ----------------
const CUSTOM_CAM = {}; // scene id -> () => { x, y, s } for scenes whose target depends on the data
function camTarget(s) {
  if (s.cam) return s.cam;
  if (s.id === 'certain') return { x: (XA + XB) / 2, y: 3430, s: 2.4 };
  if (CUSTOM_CAM[s.id]) return CUSTOM_CAM[s.id]();
  throw new Error('no cam ' + s.id);
}
function movingTime(s, l) { let m = 0; const dt = 1 / 60; for (let x = 0; x < l; x += dt) if (!inStill(s.start + x)) m += Math.min(dt, l - x); return m; }
const camEndCache = {};
function camEnd(i) {
  if (camEndCache[i]) return camEndCache[i];
  const s = SC[i], c = camTarget(s), d = movingTime(s, s.dur) * DRIFT / c.s;
  return (camEndCache[i] = { x: c.x + s.drift[0] * d, y: c.y + s.drift[1] * d, s: c.s });
}
function cameraReal(t) {
  const s = sceneAt(t), i = s.index, l = t - s.start, c = camTarget(s);
  const d = movingTime(s, l) * DRIFT / c.s;
  const to = { x: c.x + s.drift[0] * d, y: c.y + s.drift[1] * d, s: c.s };
  if (i === 0) return { ...to, moving: 0 };
  const from = camEnd(i - 1), md = s.move, p = easeIO(l / md);
  return { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), s: Math.exp(lerp(Math.log(from.s), Math.log(to.s), p)), moving: l < md && (from.x !== to.x || from.y !== to.y || from.s !== to.s) ? 1 : 0 };
}
let FROZEN = null;
const camera = (t) => FROZEN || cameraReal(t);
let PAR = null; // integrated parallax offsets, computed on the first frame (after all camera targets exist)
const computePAR = () => {
  const n = Math.ceil(TL.total * FPS) + 2; const out = [[0, 0, 0, 0]];
  let prev = cameraReal(0), far = [0, 0], near = [0, 0];
  for (let f = 1; f < n; f++) {
    const c = cameraReal(Math.min(f / FPS, TL.total - 1e-6));
    const dx = (c.x - prev.x) * c.s, dy = (c.y - prev.y) * c.s;
    far = [far[0] - dx * PARALLAX[0], far[1] - dy * PARALLAX[0]];
    near = [near[0] - dx * PARALLAX[2], near[1] - dy * PARALLAX[2]];
    out.push([far[0], far[1], near[0], near[1]]); prev = c;
  }
  return out;
};

// panel visibility: listed panels are on; others fade to 0 during the camera move
function panelOp(name, t) {
  const s = sceneAt(t), now = s.panels.includes(name) ? 1 : 0;
  if (s.index === 0 || s.move <= 0) return now;
  const prev = SC[s.index - 1].panels.includes(name) ? 1 : 0;
  if (prev === now) return now;
  const p = easeIO((t - s.start) / s.move);
  return prev ? 1 - p : p;
}

// ---------------- text overlay ----------------
let CAM = null;
const scr = (wx, wy) => [(wx - CAM.x) * CAM.s + W / 2, (wy - CAM.y) * CAM.s + H / 2];
let TEXT = [];
const winOp = (t, t0, t1) => Math.min(clamp((t - t0) / FADE), clamp((t1 - t) / 0.3));
// a curve is only drawn while its label is legible: curve opacity follows the label's
const labelled = (t, t0, t1) => clamp((winOp(t, t0, t1) - 0.5) * 2);
// o: { id, t, t0, t1, wx, wy | sx, sy, align, valign, cls, html, ev, series, anchor, emph }
function text(o) {
  const op = Math.min(clamp((o.t - o.t0) / FADE), clamp((o.t1 - o.t) / 0.3));
  if (op <= 0.001) return;
  const [x, y] = o.sx !== undefined ? [o.sx, o.sy] : scr(o.wx, o.wy);
  const dy = (1 - easeBack(clamp((o.t - o.t0) / 0.5))) * 12;
  const tx = o.align === 'right' ? '-100%' : o.align === 'center' ? '-50%' : '0';
  const ty = o.valign === 'bottom' ? '-100%' : '0';
  const attrs = [`data-tid="${o.id}"`, o.ev ? `data-ev="${o.ev}"` : '', o.series ? `data-series="${o.series}"` : '', o.anchor ? `data-anchor="${o.anchor}"` : '', o.emph ? 'data-emph="1"' : ''].filter(Boolean).join(' ');
  TEXT.push(`<div class="t ${o.cls}" ${attrs} style="left:${x.toFixed(1)}px;top:${(y + dy).toFixed(1)}px;opacity:${op.toFixed(3)};transform:translate(${tx},${ty})">${o.html}</div>`);
}
const underline = (p, color, ev) => `<i${ev && p > 0 && p < 1 ? ` data-ev="${ev}"` : ''} style="width:${(easeIO(p) * 100).toFixed(1)}%;background:${color}"></i>`;
const badge = () => '<span class="badge">ILLUSTRATIVE</span>';

// ---------------- svg helpers ----------------
const f1 = (v) => v.toFixed(1);
const NS = 'vector-effect="non-scaling-stroke"';
function path(pts) { return pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])},${f1(p[1])}`).join(''); }
function line(x1, y1, x2, y2, stroke, w, extra = '') { return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${stroke}" stroke-width="${w}" ${NS} ${extra}/>`; }
// draw-on stroke: pathLength dashes are unreliable with non-scaling strokes, so the width is
// scaled by the camera instead (same on-screen width)
function drawOn(d, stroke, w, p, extra = '') { return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${(w / CAM.s).toFixed(3)}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - clamp(p)).toFixed(4)}" ${extra}/>`; }
function rect(x, y, w, h, fill, extra = '') { return `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(0, w))}" height="${f1(Math.max(0, h))}" fill="${fill}" ${extra}/>`; }
const barB = (x, y, w, h, extra = '') => rect(x, y, w, h, 'url(#hatchB)', `stroke="${TOK.accent}" stroke-width="2" ${NS} data-series="B" ${extra}`);
const barA = (x, y, w, h, extra = '') => rect(x, y, w, h, TOK.warn, `data-series="A" ${extra}`);

// ================= panels =================
// Each panel returns its markup; renderFrame wraps it in <g data-panel opacity>.
const P = {};
const T = {};

// ---- hook: hero + monthly lots strip
P.hook = (t) => {
  let s = '';
  if (has('hook1')) {
    const gp = easeOut(pr(t, ON('hook1', 'balance'), 1.0)) * clamp((end('hook1') - t) / 0.3);
    if (gp > 0) s += rect(200, 640, 1520 * gp, 20, TOK.grid, 'data-kind="bar"');
  }
  if (has('hook3')) {
    const t0 = ON('hook3', 'months'), fill = (m) => easeOut(pr(t, t0 + (m - 1) * 0.045, 0.3));
    for (let m = 1; m <= 48; m++) {
      const fb = fill(m);
      const tk = m % 12 === 0 && fb > 0 && fb < 1 ? ` data-ev="hook3:cell${m}"` : '';
      if (fb > 0) s += `<g opacity="${fb.toFixed(3)}"${tk}>${barB(HK.cx(m), HK.yB, HK.cw, HK.h)}</g>`;
      const fa = fill(m);
      if (fa > 0) s += `<g opacity="${fa.toFixed(3)}">${m < D.loan.payoffA ? rect(HK.cx(m), HK.yA, HK.cw, HK.h, TOK.grid, 'data-kind="bar"') : barA(HK.cx(m), HK.yA, HK.cw, HK.h, 'data-kind="bar"')}</g>`;
    }
    const lp = easeIO(pr(t, ON('hook3', 'lots'), 0.7));
    if (lp > 0) {
      const x0 = HK.cx(1) - 14, x1 = HK.cx(48) + HK.cw + 14, y0 = HK.yA - 14, y1 = HK.yB + HK.h + 14;
      s += `<g opacity="${labelled(t, ON('hook3', 'lots') - 0.2, end('hook3')).toFixed(3)}"${lp < 1 ? ' data-ev="hook3:hkLots"' : ''}>${drawOn(`M${x0},${y0} L${x1},${y0} L${x1},${y1} L${x0},${y1} Z`, TOK.ink, 2, lp, 'data-label="hkLotsCap"')}</g>`;
    }
  }
  return s;
};
T.hook = (t) => {
  if (has('hook1')) {
    const b0 = ON('hook1', 'balance'), a0 = ON('hook1', 'apr');
    text({ id: 'hkLine', t, t0: T0('hook1', 0.2), t1: end('hook1'), wx: 200, wy: 300, cls: 'l2 muted', html: `Car loan, ${KS('balance', t, b0, 'hook1:hkBal')} left` });
    text({ id: 'hkApr', t, t0: a0, t1: end('hook1'), wx: 200, wy: 380, cls: 'l1 ink', html: `${K('apr')}<span class="l2 muted"> APR</span>`, ev: 'hook1:hkApr' });
  }
  if (has('hook3')) {
    const m0 = ON('hook3', 'months');
    text({ id: 'hkMonths', t, t0: m0, t1: end('hook3'), wx: 200, wy: 640, valign: 'bottom', cls: 'l1 ink', html: K('months'), ev: 'hook3:hkMonths' });
    text({ id: 'hkRowA', t, t0: m0 + STAGGER, t1: end('hook3'), wx: 180, wy: HK.yA + 4, align: 'right', cls: 'l3s warn', html: 'A', series: 'A' });
    text({ id: 'hkRowB', t, t0: m0 + 2 * STAGGER, t1: end('hook3'), wx: 180, wy: HK.yB + 4, align: 'right', cls: 'l3s accent', html: 'B', series: 'B' });
    text({ id: 'hkLotsCap', t, t0: ON('hook3', 'lots') - 0.2, t1: end('hook3'), wx: HK.x0, wy: HK.yB + HK.h + 40, cls: 'l3 muted', html: 'one tax lot per month' });
  }
};

// ---- fork: two roads
P.fork = (t) => {
  const [rx, ry] = FK.root;
  const dA = `M${rx},${ry} C${rx + 380},${ry} ${FK.a[0] - 480},${FK.a[1]} ${FK.a[0]},${FK.a[1]}`;
  const dB = `M${rx},${ry} C${rx + 380},${ry} ${FK.b[0] - 480},${FK.b[1]} ${FK.b[0]},${FK.b[1]}`;
  // roads draw in hook2/hook2b and again in roads; they are hidden while the camera sits on the root (extra)
  const pick = (sc, anchor) => (has(sc) ? easeOut(pr(t, ON(sc, anchor), 0.9)) : 0);
  let pa = 0, pb = 0, labA = null, labB = null, oa = 1, ob = 1;
  if (has('hook2') && t < end('hook2')) {
    pa = pick('hook2', 'A'); pb = pick('hook2', 'B'); labA = 'hkA'; labB = 'hkB';
    oa = labelled(t, ON('hook2', 'A'), end('hook2')); ob = labelled(t, ON('hook2', 'B'), end('hook2'));
  }
  if (has('roads') && t >= S.roads.start) {
    pa = pick('roads', 'A'); pb = pick('roads', 'B'); labA = 'rdA'; labB = 'rdB';
    oa = labelled(t, ON('roads', 'A'), end('roads')); ob = labelled(t, ON('roads', 'B'), end('roads'));
  }
  let s = '';
  if (pa > 0 && oa > 0) s += `<g opacity="${oa.toFixed(3)}">${drawOn(dA, TOK.warn, 5, pa, `data-series="A" data-label="${labA}"`)}${pa >= 1 ? `<circle cx="${FK.a[0]}" cy="${FK.a[1]}" r="12" fill="${TOK.warn}" data-series="A"/>` : ''}</g>`;
  if (pb > 0 && ob > 0) {
    s += `<g opacity="${ob.toFixed(3)}">${drawOn(dB, TOK.accent, 5, pb, `stroke-dasharray="1 1" data-series="B" data-label="${labB}"`)}`;
    s += `<path d="${dB}" fill="none" stroke="${TOK.bg}" stroke-width="3" ${NS} stroke-dasharray="14 10" opacity="${pb >= 1 ? 1 : 0}" data-label="${labB}"/>`;
    if (pb >= 1) s += `<circle cx="${FK.b[0]}" cy="${FK.b[1]}" r="12" fill="${TOK.bg}" stroke="${TOK.accent}" stroke-width="4" ${NS} data-series="B"/>`;
    s += '</g>';
  }
  const rootOp = Math.max(pa, pb, has('extra') ? easeOut(pr(t, T0('extra', 0.3), 0.4)) : 0);
  if (rootOp > 0) s += `<circle cx="${rx}" cy="${ry}" r="16" fill="${TOK.ink}" opacity="${rootOp.toFixed(3)}"/>`;
  return s;
};
T.fork = (t) => {
  if (has('hook2')) {
    text({ id: 'hkA', t, t0: ON('hook2', 'A'), t1: end('hook2'), wx: 3000, wy: 340, cls: 'l2 warn', html: '<span style="font-weight:700">A:</span> pay off', series: 'A', ev: 'hook2:hkRoadA' });
    text({ id: 'hkB', t, t0: ON('hook2', 'B'), t1: end('hook2'), wx: 3000, wy: 780, cls: 'l2 accent', html: '<span style="font-weight:700">B:</span> invest', series: 'B', ev: 'hook2:hkRoadB' });
  }
  if (has('extra')) {
    const e0 = ON('extra', 'extra');
    text({ id: 'xExtra', t, t0: e0, t1: end('extra'), wx: FK.root[0], wy: FK.root[1] - 60, align: 'center', valign: 'bottom', cls: 'l1 ink', html: `+${K('extra')}`, ev: 'extra:xExtra' });
    text({ id: 'xMonth', t, t0: e0 + STAGGER, t1: end('extra'), wx: FK.root[0], wy: FK.root[1] + 60, align: 'center', cls: 'l3 muted', html: 'a month' });
    const ip = pr(t, ON('extra', 'illu'), 0.7);
    text({ id: 'xIllu', t, t0: e0, t1: end('extra'), wx: FK.root[0], wy: FK.root[1] + 120, align: 'center', cls: 'l3s muted', html: `<span class="u">${badge()}${underline(ip, TOK.muted, 'extra:xIllu')}</span>` });
  }
  if (has('roads')) {
    text({ id: 'rdA', t, t0: ON('roads', 'A'), t1: end('roads'), wx: 3000, wy: 250, cls: 'l2 warn', html: '<span style="font-weight:700">A:</span> extra to the loan', series: 'A', ev: 'roads:rA' });
    text({ id: 'rdB', t, t0: ON('roads', 'B'), t1: end('roads'), wx: 3000, wy: 800, cls: 'l2 accent', html: '<span style="font-weight:700">B:</span> invest the extra', series: 'B', ev: 'roads:rB' });
    text({ id: 'rdX', t, t0: T0('roads', 0.4), t1: end('roads'), wx: FK.root[0] - 30, wy: FK.root[1] - 20, align: 'right', cls: 'l3s muted', html: `+${K('extra')} ${badge()}` });
  }
};

// ---- axis: the break-even teaser
P.axis = (t) => {
  if (!has('hook4')) return '';
  const ap = easeOut(pr(t, T0('hook4', 0.2), 0.8));
  let s = line(AX.x0, AX.y, lerp(AX.x0, AX.x1, ap), AX.y, TOK.grid, 3);
  const pp = easeBack(pr(t, ON('hook4', 'be_22'), 0.5));
  if (has('hook5')) {
    const lp = easeOut(pr(t, ON('hook5', 'below'), 0.6)), rp = easeOut(pr(t, ON('hook5', 'above'), 0.6));
    if (lp > 0) s += line(AX.px, AX.y, lerp(AX.px, AX.x0, lp), AX.y, TOK.warn, 6, 'data-series="A"');
    if (rp > 0) s += line(AX.px, AX.y, lerp(AX.px, AX.x1, rp), AX.y, TOK.accent, 6, 'stroke-dasharray="14 10" data-series="B"');
  }
  if (pp > 0) s += `<circle cx="${AX.px}" cy="${AX.y}" r="${f1(12 * pp)}" fill="${TOK.ink}" stroke="${TOK.bg}" stroke-width="4" ${NS}/>`;
  return s;
};
T.axis = (t) => {
  if (!has('hook4')) return;
  const b0 = ON('hook4', 'be_22'), t1 = has('hook5') ? end('hook5') : end('hook4');
  text({ id: 'hkBe', t, t0: b0, t1, wx: AX.px, wy: AX.y - 110, align: 'center', valign: 'bottom', cls: 'l1 ink', html: K('be_22'), ev: 'hook4:hkBe' });
  text({ id: 'hkBeCap', t, t0: b0 + STAGGER, t1, wx: AX.px, wy: AX.y - 100, align: 'center', cls: 'l3 muted', html: 'average annual return (compounded)' });
  text({ id: 'hkBr', t, t0: ON('hook4', 'ord_22'), t1: end('hook4'), wx: AX.px + 125, wy: AX.y - 115, valign: 'bottom', cls: 'l2 muted', html: `${K('ord_22')} bracket`, ev: 'hook4:hkBracket' });
  if (has('hook5')) {
    text({ id: 'hkBelow', t, t0: ON('hook5', 'below'), t1: end('hook5'), wx: AX.px - 300, wy: AX.y + 40, align: 'center', cls: 'l2 warn', html: 'Below: A ahead', series: 'A', ev: 'hook5:hkBelow' });
    text({ id: 'hkAbove', t, t0: ON('hook5', 'above'), t1: end('hook5'), wx: AX.px + 300, wy: AX.y + 40, align: 'center', cls: 'l2 accent', html: 'Above: B ahead', series: 'B', ev: 'hook5:hkAbove' });
  }
};

// ---- ident: CRUX wordmark
P.ident = (t) => {
  if (!has('ident')) return '';
  const cols = [TOK.warn, TOK.accent, TOK.pos, TOK.neg];
  return cols.map((c, i) => {
    const p = easeOut(pr(t, T0('ident', 0.8 + i * STAGGER), 0.5));
    return rect(5600 + i * 190, 720, 170 * p, 24, c);
  }).join('');
};
T.ident = (t) => {
  if (!has('ident')) return;
  text({ id: 'crux', t, t0: T0('ident', 0.6), t1: end('ident'), sx: W / 2, sy: 330, align: 'center', cls: 'l1 ink', html: 'CRUX', ev: 'ident:crux' });
  text({ id: 'cruxTag', t, t0: T0('ident', 1.0), t1: end('ident'), sx: W / 2, sy: 660, align: 'center', cls: 'l3 muted', html: 'personal finance, computed' });
};

// ---- scope: statements
P.scope = (t) => {
  if (!has('scope1')) return '';
  const p = easeOut(pr(t, ON('scope1', 'setup'), 0.8));
  return `<g opacity="${clamp((end('scope1') - t) / 0.3).toFixed(3)}">${line(5960 - 900, 2560, 5960 - 900 + 1800 * p, 2560, TOK.grid, 3)}</g>`;
};
T.scope = (t) => {
  if (has('scope1')) text({ id: 'setupW', t, t0: ON('scope1', 'setup'), t1: end('scope1'), sx: 160, sy: 200, cls: 'l2 ink', html: 'The setup', ev: 'scope1:setupWord' });
  if (has('scope1')) {
    text({ id: 'usOnly', t, t0: ON('scope1', 'us'), t1: end('scope1'), sx: 160, sy: 330, cls: 'l1 ink', html: 'US only', ev: 'scope1:usOnly' });
    text({ id: 'stated', t, t0: ON('scope1', 'stated'), t1: end('scope1'), sx: 160, sy: 500, cls: 'l2 muted', html: 'Inputs are stated, not forecasts.', ev: 'scope1:stated' });
  }
  if (has('scope2')) {
    text({ id: 'notDed', t, t0: ON('scope2', 'nd'), t1: end('scope2'), sx: 160, sy: 380, cls: 'l2 ink', html: 'Loan interest: not deductible', ev: 'scope2:notDed' });
    const y0 = ON('scope2', 'ded_y0'), y1 = ON('scope2', 'ded_y1');
    text({ id: 'dedNote', t, t0: y0 - 0.15, t1: end('scope2'), sx: 160, sy: 470, cls: 'l3 muted', html: `Ignores the ${KS('ded_y0', t, y0, 'scope2:dedY0')}<span style="opacity:${clamp((t - y1) / FADE).toFixed(3)}">–</span>${KS('ded_y1', t, y1, 'scope2:dedY1')} new-car loan interest deduction` });
  }
};

// ---- loan: facts bar -> month bars -> interest bars -> avoided bracket
P.loan = (t) => {
  if (!has('facts')) return '';
  let s = '';
  const tl = has('timeline') ? S.timeline : null, it = has('interest') ? S.interest : null;
  // facts: the $25,000 principal as one bar
  const fb = easeOut(pr(t, ON('facts', 'balance'), 1.0));
  const split = tl ? easeIO(pr(t, tl.start, 1.0)) : 0; // morph: one bar splits into the two roads' month bars
  if (fb > 0 && split < 1) {
    const w = 1600 * fb * (1 - split);
    s += rect(160, lerp(LN.facts, LN.yA, split), w, lerp(40, LN.h, split), TOK.grid, 'data-kind="bar"');
    if (split > 0) s += rect(160, lerp(LN.facts, LN.yB, split), w, lerp(40, LN.h, split), TOK.grid, 'data-kind="bar"');
  }
  if (!tl) return s;
  // month bars grow to their spoken month
  const tA = ON('timeline', 'payoff_a') + FADE, tB = ON('timeline', 'horizon') + FADE;
  const ga = easeIO(pr(t, tl.start + 0.9, tA - tl.start - 0.9));
  const gb = t < tA ? ga * D.loan.payoffA / 48 : lerp(D.loan.payoffA / 48, 1, easeIO(pr(t, tA, tB - tA)));
  const mp = it ? easeIO(pr(t, it.start, 1.2)) : 0; // morph: months -> interest dollars
  const aEnd = lerp(LN.x(0) + (LN.x(D.loan.payoffA) - LN.x(0)) * ga, XA, mp);
  const bEnd = lerp(LN.x(0) + (LN.x(48) - LN.x(0)) * gb, XB, mp);  // gb is the share of 48 months
  const barsOp = has('certain') ? 1 - easeIO(pr(t, S.certain.start, 0.6)) : 1;
  if (split >= 1 && barsOp > 0) {
    const inDollars = mp >= 1, settled = inDollars || (mp === 0 && ga >= 1 && gb >= 1);
    const va = inDollars ? D.loan.intA : D.loan.payoffA, vb = inDollars ? D.loan.intB : 48;
    const tag = (v) => `data-kind="bar" data-orient="h" data-chart="${inDollars ? 'int' : 'months'}" data-value="${v}" data-full="${settled ? 1 : 0}"`;
    s += `<g opacity="${barsOp.toFixed(3)}">${barA(160, LN.yA, aEnd - 160, LN.h, tag(va))}${barB(160, LN.yB, bEnd - 160, LN.h, tag(vb))}</g>`;
  }
  // month axis with anchors (fades out when the bars turn into dollars)
  const axOp = easeOut(pr(t, tl.start + 0.6, 0.6)) * (1 - mp);
  if (axOp > 0) {
    s += `<g opacity="${axOp.toFixed(3)}"${t < tl.start + 1.2 ? ' data-ev="timeline:tlAxis"' : ''}>${line(160, LN.axisY, 1760, LN.axisY, TOK.grid, 3, 'data-kind="axis" data-chart="tl"')}`;
    for (const m of [0, 12, 24, 36, 48]) s += line(LN.x(m), LN.axisY, LN.x(m), LN.axisY + 12, TOK.grid, 3);
    s += '</g>';
  }
  // free: the empty months on road A
  if (has('free')) {
    const fp = easeIO(pr(t, ON('free', 'months_free'), 0.7)) * (1 - mp);
    if (fp > 0) {
      s += rect(LN.x(D.loan.payoffA), LN.yA, (LN.x(48) - LN.x(D.loan.payoffA)) * fp, LN.h, 'none', `stroke="${TOK.warn}" stroke-width="2" stroke-dasharray="8 6" ${NS} data-series="A"`);
      const x0 = LN.x(D.loan.payoffA), x1 = LN.x(48), y = LN.yA - 22;
      s += `<g opacity="${labelled(t, ON('free', 'months_free'), end('free')).toFixed(3)}">${drawOn(`M${x0},${LN.yA - 6} L${x0},${y} L${x1},${y} L${x1},${LN.yA - 6}`, TOK.ink, 3, fp, 'data-label="free20"')}</g>`;
    }
  }
  // avoided: the difference between the two interest totals
  if (has('avoided')) {
    const ap = easeIO(pr(t, ON('avoided', 'avoided'), 0.7));
    if (ap > 0 && barsOp > 0) {
      s += `<g opacity="${barsOp.toFixed(3)}">` + rect(XA, LN.yA, (XB - XA) * ap, LN.h, 'none', `stroke="${TOK.warn}" stroke-width="2" stroke-dasharray="8 6" ${NS} data-series="A"`);
      const capT1 = has('certain') ? end('certain') : end('avoided');
      s += `<g opacity="${labelled(t, ON('avoided', 'avoided') + STAGGER, capT1).toFixed(3)}"${ap < 1 ? ' data-ev="avoided:avdBracket"' : ''}>${drawOn(`M${XA},${LN.yA - 4} L${XA},${LN.yA - 16} L${XB},${LN.yA - 16} L${XB},${LN.yA - 4}`, TOK.ink, 3, ap, 'data-label="avdCap"')}</g></g>`;
    }
  }
  return s;
};
T.loan = (t) => {
  if (has('facts')) {
    const b0 = ON('facts', 'balance'), a0 = ON('facts', 'apr'), m0 = ON('facts', 'months'), p0 = ON('facts', 'payment');
    text({ id: 'fBal', t, t0: b0, t1: end('facts'), wx: 160, wy: 2990, cls: 'l1 ink', html: `${K('balance')}<span class="l2 muted"> left</span>`, ev: 'facts:fBal' });
    text({ id: 'fApr', t, t0: a0, t1: end('facts'), wx: 160, wy: 3130, cls: 'l2 ink', html: `at ${K('apr')} APR`, ev: 'facts:fApr' });
    text({ id: 'fPay', t, t0: m0 - 0.15, t1: end('facts'), wx: 160, wy: 3200, cls: 'l2 muted', html: `${KS('months', t, m0, 'facts:fMonths')} monthly payments of ${KS('payment', t, p0, 'facts:fPay')}` });
  }
  if (has('timeline')) {
    const tl = S.timeline;
    const a0 = ON('timeline', 'payoff_a'), h0 = ON('timeline', 'horizon'), t1 = has('free') ? end('free') : end('timeline');
    text({ id: 'tlA', t, t0: a0, t1: end('timeline'), wx: 160, wy: 3440, valign: 'bottom', cls: 'l1 warn', html: `month ${K('payoff_a')}`, series: 'A', ev: 'timeline:tlA' });
    text({ id: 'tlB', t, t0: h0, t1: end('timeline'), wx: 1760, wy: 3560, align: 'right', valign: 'bottom', cls: 'l2 accent', html: `month ${K('horizon')}`, series: 'B', ev: 'timeline:tlB' });
    const it0 = has('interest') ? S.interest.start + 0.3 : end('timeline');
    [0, 12, 24, 36, 48].forEach((m, i) => text({ id: `tick${m}`, t, t0: tl.start + 0.7 + i * STAGGER, t1: it0, wx: LN.x(m), wy: LN.axisY + 20, align: 'center', cls: 'l3 muted', html: K(`tick_m${m}`), anchor: 'tl' }));
  }
  if (has('free')) {
    const f0 = ON('free', 'months_free');
    text({ id: 'free20', t, t0: f0, t1: end('free'), wx: (LN.x(D.loan.payoffA) + LN.x(48)) / 2, wy: LN.yA - 40, align: 'center', valign: 'bottom', cls: 'l1 warn', html: K('months_free'), series: 'A', ev: 'free:free20' });
    text({ id: 'freeCap', t, t0: f0 + STAGGER, t1: end('free'), wx: (LN.x(D.loan.payoffA) + LN.x(48)) / 2, wy: LN.axisY + 76, align: 'center', cls: 'l2 muted', html: 'months with no car payment' });
  }
  if (has('interest')) {
    const b0 = ON('interest', 'int_b'), a0 = ON('interest', 'int_a');
    text({ id: 'intB', t, t0: b0, t1: end('interest'), wx: XB, wy: LN.yB - 8, align: 'right', valign: 'bottom', cls: 'l2 accent', html: K('int_b'), series: 'B', ev: 'interest:intB' });
    text({ id: 'intA', t, t0: a0, t1: end('interest'), wx: XA, wy: LN.yA - 20, align: 'center', valign: 'bottom', cls: 'l1 warn', html: K('int_a'), series: 'A', ev: 'interest:intA' });
    text({ id: 'intHead', t, t0: S.interest.start + S.interest.move, t1: a0, wx: XA, wy: LN.yA - 20, align: 'center', valign: 'bottom', cls: 'l1 ink', html: 'Interest' });
    text({ id: 'intCap', t, t0: S.interest.start + 0.6, t1: end('interest'), wx: 1100, wy: LN.yB + LN.h + 30, cls: 'l3 muted', html: 'interest paid over the loan' });
  }
  if (has('avoided')) {
    const v0 = ON('avoided', 'avoided'), t1 = has('certain') ? end('certain') : end('avoided');
    const mid = (XA + XB) / 2;
    text({ id: 'avd', t, t0: v0, t1, wx: mid, wy: 3385, align: 'center', valign: 'bottom', cls: 'l1 warn', html: K('avoided'), series: 'A', ev: 'avoided:avd' });
    let cert = '';
    if (has('certain')) {
      const c0 = ON('certain', 'certain'), up = pr(t, ON('certain', 'certain'), 0.8);
      cert = `<span style="opacity:${clamp((t - c0) / FADE).toFixed(3)}"> · <span class="u pos">certain${underline(up, TOK.pos, 'certain:certainLine')}</span></span>`;
    }
    text({ id: 'avdCap', t, t0: v0 + STAGGER, t1, wx: mid, wy: 3390, align: 'center', cls: 'l2 muted', html: `interest avoided${cert}` });
  }
};

// ---- cash: same cash, different order
P.cash = (t) => {
  if (!has('cash')) return '';
  const g = easeBack(pr(t, T0('cash', 0.5), 0.6));
  const hp = D.loan.P * CS.k * g, he = D.base.extra * CS.k * g;
  let s = `<g${t < T0('cash', 1.0) && t >= T0('cash', 0.5) ? ' data-ev="cash:cashCols"' : ''}>`;
  s += rect(CS.ax, CS.base - hp, CS.w, hp, TOK.grid, 'data-kind="bar"') + barA(CS.ax, CS.base - hp - he, CS.w, he, 'data-kind="bar"');
  s += rect(CS.bx, CS.base - hp, CS.w, hp, TOK.grid, 'data-kind="bar"') + barB(CS.bx, CS.base - hp - he, CS.w, he, 'data-kind="bar"');
  s += line(CS.ax - 60, CS.base, CS.bx + CS.w + 60, CS.base, TOK.grid, 3);
  return s + '</g>';
};
T.cash = (t) => {
  if (!has('cash')) return;
  const c0 = T0('cash', 0.6), e1 = end('cash');
  const topY = CS.base - (D.loan.P + D.base.extra) * CS.k;
  const op = pr(t, ON('cash', 'order'), 0.8);
  text({ id: 'same', t, t0: ON('cash', 'same'), t1: e1, wx: 3360, wy: 3280, align: 'center', valign: 'bottom', cls: 'l1 ink', html: 'Same cash', ev: 'cash:cashSame' });
  text({ id: 'cAtop', t, t0: c0, t1: e1, wx: CS.ax + CS.w + 16, wy: topY + 60, cls: 'l3s warn', html: `<span class="u">extra → loan${underline(op, TOK.warn, 'cash:cashOrder')}</span>`, series: 'A' });
  text({ id: 'cBtop', t, t0: c0 + STAGGER, t1: e1, wx: CS.bx + CS.w + 16, wy: topY + 60, cls: 'l3s accent', html: `<span class="u">extra → invested${underline(op, TOK.accent)}</span>`, series: 'B' });
  text({ id: 'cA', t, t0: c0, t1: e1, wx: CS.ax + CS.w / 2, wy: CS.base + 20, align: 'center', cls: 'l2 warn', html: 'A', series: 'A' });
  text({ id: 'cB', t, t0: c0 + STAGGER, t1: e1, wx: CS.bx + CS.w / 2, wy: CS.base + 20, align: 'center', cls: 'l2 accent', html: 'B', series: 'B' });
};

// ---- chapter cards (screen text only)
T.card = (t) => {
  if (!has('card1')) return;
  text({ id: 'card1', t, t0: T0('card1', 0.5), t1: end('card1'), sx: 160, sy: 360, cls: 'l1 ink', html: 'The certain part', ev: 'card1:card1' });
};

// ---- eq: interest avoided = extra invested by A; then B's question
P.eq = (t) => {
  if (!has('identity')) return '';
  const h = CL.avoided.value * EQ.k;
  const gl = easeBack(pr(t, T0('identity', 0.4), 0.6)), gr = easeBack(pr(t, T0('identity', 1.0), 0.6));
  const mb = has('bridge') ? easeIO(pr(t, S.bridge.start, 1.0)) : 0; // morph: A's extra invested -> B's unknown head start
  let s = line(EQ.lx - 80, EQ.base, EQ.rx + EQ.w + 80, EQ.base, TOK.grid, 3);
  s += barA(EQ.lx, EQ.base - h * gl, EQ.w, h * gl, 'data-kind="bar"');
  if (gr > 0) {
    s += `<g opacity="${(1 - mb).toFixed(3)}"${gr < 1 ? ' data-ev="identity:eqRight"' : ''}>${rect(EQ.rx, EQ.base - h * gr, EQ.w, h * gr, 'url(#hatchA)', `stroke="${TOK.warn}" stroke-width="2" ${NS} data-series="A" data-kind="bar"`)}</g>`;
    if (mb > 0) s += `<g opacity="${mb.toFixed(3)}">${rect(EQ.rx, EQ.base - h, EQ.w, h, 'none', `stroke="${TOK.accent}" stroke-width="3" stroke-dasharray="12 8" ${NS} data-series="B" data-kind="bar"`)}</g>`;
  }
  return s;
};
T.eq = (t) => {
  if (!has('identity')) return;
  const e1 = end('identity'), h = CL.avoided.value * EQ.k;
  text({ id: 'eqHead', t, t0: T0('identity', S.identity.move), t1: ON('identity', 'avoided'), wx: (EQ.lx + EQ.rx + EQ.w) / 2, wy: EQ.base - h - 22, align: 'center', valign: 'bottom', cls: 'l1 ink', html: 'Same cash' });
  text({ id: 'eqVal', t, t0: ON('identity', 'avoided'), t1: e1, wx: (EQ.lx + EQ.rx + EQ.w) / 2, wy: EQ.base - h - 22, align: 'center', valign: 'bottom', cls: 'l1 warn', html: K('avoided'), series: 'A', ev: 'identity:eqVal' });
  text({ id: 'eqSign', t, t0: T0('identity', 1.0), t1: e1, wx: (EQ.lx + EQ.w + EQ.rx) / 2, wy: EQ.base - h / 2, align: 'center', valign: 'bottom', cls: 'l2 muted', html: '=' });
  text({ id: 'eqL', t, t0: T0('identity', 0.5), t1: e1, wx: EQ.lx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3 muted', html: 'interest avoided', ev: 'identity:eqLeft' });
  text({ id: 'eqR', t, t0: T0('identity', 1.1), t1: e1, wx: EQ.rx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3 muted', html: 'extra invested by A' });
  if (has('bridge')) {
    const b1 = end('bridge');
    text({ id: 'brHead', t, t0: T0('bridge', S.bridge.move), t1: ON('bridge', 'avoided'), wx: EQ.lx + EQ.w / 2 - 80, wy: EQ.base - h - 22, valign: 'bottom', cls: 'l1 ink', html: 'The question' });
    text({ id: 'brVal', t, t0: ON('bridge', 'avoided'), t1: b1, wx: EQ.lx + EQ.w / 2, wy: EQ.base - h - 22, align: 'center', valign: 'bottom', cls: 'l1 warn', html: K('avoided'), series: 'A', ev: 'bridge:brVal' });
    text({ id: 'brL', t, t0: T0('bridge', 0.6), t1: b1, wx: EQ.lx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3s pos', html: 'certain', ev: 'bridge:brCertain' });
    text({ id: 'brR', t, t0: ON('bridge', 'head'), t1: b1, wx: EQ.rx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3s accent', html: 'B: after-tax head start', series: 'B', ev: 'bridge:brB' });
    text({ id: 'brQ', t, t0: ON('bridge', 'head') + STAGGER, t1: b1, wx: EQ.rx + EQ.w / 2, wy: EQ.base - h / 2, align: 'center', valign: 'bottom', cls: 'l2 accent', html: '?', series: 'B' });
  }
};

// ================= chapters 2–5 and close =================
// helpers: a level-1 header that hands over to the scene's number at its word (never two l1 at once)
const heroSwap = (t, sc, o) => {
  const tSwap = o.anchor ? ON(sc, o.anchor) : end(sc);
  if (o.header) text({ id: `${sc}Head`, t, t0: o.t0 !== undefined ? o.t0 : T0(sc, S[sc].move), t1: o.anchor ? tSwap : end(sc) + 0.15, cls: 'l1 ink', ...o.at, html: o.header });
  if (o.number) text({ id: `${sc}Hero`, t, t0: tSwap, t1: o.t1 || end(sc), cls: `l1 ${o.cls || 'ink'}`, ...o.at, html: o.number, ev: o.ev, series: o.series, anchor: o.anchorChart });
};
const barTag = (chart, v, full) => `data-kind="bar" data-orient="h" data-chart="${chart}" data-value="${v}" data-full="${full ? 1 : 0}"`;

// ---- lots: one tax lot per month (lots1, lots2, lots3)
const LT = { x0: 200, cw: 28, gap: 5.33, yB: 6560, yA: 6660, h: 56 };
LT.cx = (m) => LT.x0 + (m - 1) * (LT.cw + LT.gap);
const LONG_LAST = 48 - 13; // lots from months 1..35 are held more than 12 months at month 48
const cell = (m, y, fill, extra = '') => rect(LT.cx(m), y, LT.cw, LT.h, fill, `data-kind="cell" ${extra}`);
P.lots = (t) => {
  if (!has('lots1')) return '';
  let s = '';
  const c0 = ON('lots1', 'lot');
  const lt = has('lots2') ? easeOut(pr(t, ON('lots2', 'lt'), 0.5)) : 0, st = has('lots2') ? easeOut(pr(t, ON('lots2', 'st'), 0.5)) : 0;
  const showA = has('lots3') ? easeOut(pr(t, S.lots3.start + 0.4, 0.8)) : 0;
  for (let m = 1; m <= 48; m++) {
    const f = easeOut(pr(t, c0 + (m - 1) * 0.03, 0.25));
    if (f <= 0) continue;
    const long = m <= LONG_LAST, k = long ? lt : st;
    s += `<g opacity="${f.toFixed(3)}"${m === 1 && f < 1 ? ' data-ev="lots1:ltCells"' : m % 12 === 0 && f < 1 ? ` data-ev="lots1:cell${m}"` : ''}>${cell(m, LT.yB, 'url(#hatchB)', `stroke="${TOK.accent}" stroke-width="2" ${NS} data-series="B"`)}`;
    if (k > 0) s += `<g opacity="${k.toFixed(3)}">${long ? cell(m, LT.yB, TOK.pos, 'data-series="lt"') : cell(m, LT.yB, 'url(#hatchN)', `stroke="${TOK.neg}" stroke-width="2" ${NS} data-series="st"`)}</g>`;
    s += '</g>';
    if (showA > 0) {
      const inA = m >= D.loan.payoffA;
      s += `<g opacity="${showA.toFixed(3)}">${!inA ? cell(m, LT.yA, TOK.grid) : long ? cell(m, LT.yA, TOK.pos, 'data-series="lt"') : cell(m, LT.yA, 'url(#hatchN)', `stroke="${TOK.neg}" stroke-width="2" ${NS} data-series="st"`)}</g>`;
    }
  }
  // the sale at month 48
  const sp = easeOut(pr(t, ON('lots1', 'horizon'), 0.5)) * (has('lots3') ? 1 - easeIO(pr(t, S.lots3.start, 0.5)) : 1);
  if (sp > 0) s += `<g opacity="${sp.toFixed(3)}"${sp < 1 ? ' data-ev="lots1:ltSale"' : ''}>${line(LT.cx(48) + LT.cw + 14, LT.yB - 30, LT.cx(48) + LT.cw + 14, LT.yB + LT.h + 30, TOK.ink, 3)}</g>`;
  // lots2: the 12-month boundary and the bracket over the short-term lots
  if (has('lots2')) {
    const bp = easeIO(pr(t, ON('lots2', 'hold_months'), 0.6)), bo = labelled(t, ON('lots2', 'hold_months'), end('lots2'));
    if (bp > 0 && bo > 0) {
      const x = LT.cx(LONG_LAST + 1) - LT.gap / 2, x1 = LT.cx(48) + LT.cw, y = LT.yB - 22;
      s += `<g opacity="${bo.toFixed(3)}">${line(x, LT.yB - 8, x, LT.yB + LT.h + 8, TOK.ink, 2, 'stroke-dasharray="6 6"')}${drawOn(`M${x},${LT.yB - 6} L${x},${y} L${x1},${y} L${x1},${LT.yB - 6}`, TOK.ink, 3, bp, 'data-label="lots2Hero"')}</g>`;
    }
  }
  return s;
};
T.lots = (t) => {
  if (!has('lots1')) return;
  heroSwap(t, 'lots1', { header: 'Tax lots', at: { wx: LT.x0, wy: 6420, valign: 'bottom' } });
  text({ id: 'ltSold', t, t0: ON('lots1', 'horizon'), t1: end('lots1'), wx: LT.cx(48) + LT.cw + 14, wy: LT.yB + LT.h + 50, align: 'right', cls: 'l2 ink', html: `sold at month ${K('horizon')}`, ev: 'lots1:ltSale' });
  if (has('lots2')) {
    heroSwap(t, 'lots2', { header: 'Holding time', number: `${K('hold_months')} months`, anchor: 'hold_months', at: { wx: LT.cx(42), wy: LT.yB - 40, align: 'center', valign: 'bottom' }, ev: 'lots2:ltHold' });
    text({ id: 'ltLong', t, t0: ON('lots2', 'lt'), t1: end('lots2'), wx: LT.cx(24), wy: LT.yB + LT.h + 20, align: 'center', cls: 'l2 pos', html: 'long-term', series: 'lt', ev: 'lots2:ltLong' });
    text({ id: 'ltShort', t, t0: ON('lots2', 'st'), t1: end('lots2'), wx: LT.cx(42), wy: LT.yB + LT.h + 20, align: 'center', cls: 'l2 neg', html: 'short-term', series: 'st', ev: 'lots2:ltShort' });
  }
  if (has('lots3')) {
    const e = end('lots3');
    heroSwap(t, 'lots3', { header: 'Long-term lots', at: { wx: LT.x0, wy: 6420, valign: 'bottom' } });
    text({ id: 'l3rB', t, t0: T0('lots3', 0.4), t1: e, wx: LT.x0 - 20, wy: LT.yB + 6, align: 'right', cls: 'l3s accent', html: 'B', series: 'B', ev: 'lots3:l3Rows' });
    text({ id: 'l3rA', t, t0: T0('lots3', 0.4), t1: e, wx: LT.x0 - 20, wy: LT.yA + 6, align: 'right', cls: 'l3s warn', html: 'A', series: 'A' });
    const b0 = ON('lots3', 'lots_lt_b'), m0 = ON('lots3', 'months'), a0 = ON('lots3', 'lots_lt_a'), n0 = ON('lots3', 'lots_a');
    text({ id: 'l3B', t, t0: b0 - 0.15, t1: e, wx: LT.x0, wy: LT.yB - 70, cls: 'l2 ink', html: `${KS('lots_lt_b', t, b0, 'lots3:l3B')} of ${KS('months', t, m0, 'lots3:l3Bof')} long-term` });
    text({ id: 'l3A', t, t0: a0 - 0.15, t1: e, wx: LT.x0, wy: LT.yA + LT.h + 18, cls: 'l2 ink', html: `${KS('lots_lt_a', t, a0, 'lots3:l3A')} of ${KS('lots_a', t, n0, 'lots3:l3Aof')}` });
  }
};

// ---- rates: tax table (rates, niit)
const RT = { x0: 2880, x1: 3880, head: 6300, r1: 6390, r2: 6580, div: 6530 };
P.rates = (t) => {
  let s = '';
  for (const sc of ['rates', 'niit']) {
    if (!has(sc) || t < S[sc].start || t >= end(sc)) continue;
    const p = easeOut(pr(t, T0(sc, 0.6), 0.6));
    s += line(RT.x0, RT.div, lerp(RT.x0, RT.x1, p), RT.div, TOK.grid, 2);
  }
  return s;
};
T.rates = (t) => {
  if (has('rates')) {
    const e = end('rates'), h0 = ON('rates', 'ord_22');
    text({ id: 'rtHead', t, t0: h0, t1: e, wx: RT.x0, wy: RT.head, cls: 'l2 ink', html: `${K('ord_22')} bracket`, ev: 'rates:rtHead' });
    text({ id: 'rtLtL', t, t0: T0('rates', 0.6), t1: e, wx: RT.x0, wy: RT.r1 + 34, cls: 'l2 pos', html: 'Long-term', series: 'lt' });
    text({ id: 'rtLt', t, t0: ON('rates', 'lt_15'), t1: e, wx: RT.x1, wy: RT.r1, align: 'right', cls: 'l1 ink', html: K('lt_15'), ev: 'rates:rtLt' });
    text({ id: 'rtStL', t, t0: T0('rates', 0.6 + STAGGER), t1: e, wx: RT.x0, wy: RT.r2 + 34, cls: 'l2 neg', html: 'Short-term', series: 'st' });
    text({ id: 'rtSt', t, t0: ON('rates', 'ord_22#2'), t1: e, wx: RT.x1, wy: RT.r2, align: 'right', cls: 'l1 ink', html: K('ord_22'), ev: 'rates:rtSt' });
  }
  if (has('niit')) {
    const e = end('niit'), h0 = ON('niit', 'ord_32'), n0 = ON('niit', 'niit');
    text({ id: 'niHead', t, t0: h0, t1: e, wx: RT.x0, wy: RT.head, cls: 'l2 ink', html: `${K('ord_32')} bracket ${KS('niit', t, n0, 'niit:niNiit').replace('class="n"', 'class="n"')}<span style="opacity:${clamp((t - n0) / FADE).toFixed(3)}"> NIIT</span>`.replace(`${K('ord_32')} bracket `, `${K('ord_32')} bracket <span style="opacity:${clamp((t - n0) / FADE).toFixed(3)}">+</span> `), ev: 'niit:niHead' });
    text({ id: 'niStL', t, t0: T0('niit', 0.6), t1: e, wx: RT.x0, wy: RT.r1 + 34, cls: 'l2 neg', html: 'Short-term', series: 'st' });
    text({ id: 'niSt', t, t0: ON('niit', 'ord_32e'), t1: e, wx: RT.x1, wy: RT.r1, align: 'right', cls: 'l1 ink', html: K('ord_32e'), ev: 'niit:niSt' });
    text({ id: 'niLtL', t, t0: T0('niit', 0.6 + STAGGER), t1: e, wx: RT.x0, wy: RT.r2 + 34, cls: 'l2 pos', html: 'Long-term', series: 'lt' });
    text({ id: 'niLt', t, t0: ON('niit', 'lt_32e'), t1: e, wx: RT.x1, wy: RT.r2, align: 'right', cls: 'l1 ink', html: K('lt_32e'), ev: 'niit:niLt' });
    text({ id: 'niState', t, t0: T0('niit', 1.0), t1: e, wx: RT.x0, wy: 6740, cls: 'l3 muted', html: 'No state tax' });
  }
};

// ---- share of gains in short-term lots, at the break-even
const SH = { x0: 2800, w: 1100, yA: 5080, yB: 5230, h: 70 };
P.share = (t) => {
  if (!has('share')) return '';
  const g = easeOut(pr(t, T0('share', 0.5), 0.8));
  const full = g >= 1;
  let s = '';
  for (const [row, y, id] of [['A', SH.yA, 'share_st_a'], ['B', SH.yB, 'share_st_b']]) {
    const v = CL[id].value, ws = SH.w * v / 100 * g, wl = SH.w * (100 - v) / 100 * g;
    s += rect(SH.x0, y, ws, SH.h, 'url(#hatchN)', `stroke="${TOK.neg}" stroke-width="2" ${NS} data-series="st" ${barTag('share', v, full)}`);
    s += rect(SH.x0 + ws, y, wl, SH.h, TOK.pos, `data-series="lt" ${barTag('share', 100 - v, full)}`);
  }
  return s;
};
T.share = (t) => {
  if (!has('share')) return;
  const e = end('share'), a0 = ON('share', 'share_st_a'), b0 = ON('share', 'share_st_b');
  heroSwap(t, 'share', { header: 'Short-term share', number: K('share_st_a'), anchor: 'share_st_a', at: { wx: SH.x0, wy: SH.yA - 14, valign: 'bottom' }, ev: 'share:shA' });
  text({ id: 'shB', t, t0: b0, t1: e, wx: SH.x0, wy: SH.yB - 12, valign: 'bottom', cls: 'l2 ink', html: K('share_st_b'), ev: 'share:shB' });
  text({ id: 'shRA', t, t0: T0('share', 0.5), t1: e, wx: SH.x0 - 20, wy: SH.yA + 6, align: 'right', cls: 'l2 warn', html: 'A', series: 'A' });
  text({ id: 'shRB', t, t0: T0('share', 0.5), t1: e, wx: SH.x0 - 20, wy: SH.yB + 6, align: 'right', cls: 'l2 accent', html: 'B', series: 'B' });
  text({ id: 'shLegS', t, t0: T0('share', 1.0), t1: e, wx: SH.x0, wy: SH.yB + SH.h + 16, cls: 'l3s neg', html: 'short-term', series: 'st', ev: 'share:shLegend' });
  text({ id: 'shLegL', t, t0: T0('share', 1.0), t1: e, wx: SH.x0 + SH.w, wy: SH.yB + SH.h + 16, align: 'right', cls: 'l3s pos', html: 'long-term', series: 'lt' });
};

// ---- sweep: B − A after tax at month 48 vs the average annual return
const BE = D.breakEvens[D.main];
const SW = { x0: 2560, x1: 4160, zero: 8300, k: 300 / 900 };
SW.x = (r) => SW.x0 + ((r - 2) / 8) * (SW.x1 - SW.x0);
SW.y = (g) => SW.zero - g * SW.k;
const BE_X = SW.x(BE);
CUSTOM_CAM.sw4 = () => ({ x: BE_X, y: SW.zero - 40, s: 2.6 });
function sweepR(t) { // return shown by the moving dot in sw2 (2% until the line starts, 10% when drawn)
  if (!has('sw2') || t < ON('sw2', 'rises')) return 2;
  return lerp(2, 10, easeIO(pr(t, ON('sw2', 'rises'), Math.max(1.5, end('sw2') - 0.6 - ON('sw2', 'rises')))));
}
function gapAt(r) { const c = D.curve, i = clamp((r - 2) / 0.05, 0, c.length - 1), a = Math.floor(i), b = Math.min(a + 1, c.length - 1); return lerp(c[a].gap, c[b].gap, i - a); }
P.sweep = (t) => {
  if (!has('sw1')) return '';
  let s = '';
  const ap = easeOut(pr(t, S.sw1.start + S.sw1.move, 0.8)) * clamp((end(has('sw5') ? 'sw5' : 'sw4') - t) / 0.3);
  if (ap <= 0 && !(has('morphDot') && t >= S.morphDot.start)) return '';
  s += line(SW.x0, SW.zero, lerp(SW.x0, SW.x1, ap), SW.zero, TOK.grid, 3, 'data-kind="axis" data-chart="sw"');
  s += line(SW.x0, SW.y(900), SW.x0, lerp(SW.y(900), SW.y(-900), ap), TOK.grid, 3, 'data-kind="axis" data-chart="sw"');
  // the line, drawn up to the moving return; below zero = road A ahead (warn), above = road B (accent)
  const rmax = t < S.sw2.start ? 2 : t < end('sw2') ? sweepR(t) : 10;
  const lineOp = clamp((end(has('sw5') ? 'sw5' : 'sw4') - 0.2 - t) / 0.3); // leaves before its labels and anchors
  if (rmax > 2.001 && lineOp > 0) {
    s += `<g opacity="${lineOp.toFixed(3)}">`;
    const pts = [];
    for (const c of D.curve) { if (c.r > rmax + 1e-9) break; pts.push([SW.x(c.r), SW.y(c.gap)]); }
    pts.push([SW.x(rmax), SW.y(gapAt(rmax))]);
    const labA = t < end('sw2') ? 'swLab0' : t < end('sw3') ? 'sw3Head' : 'swLab4';
    const labB = t < end('sw2') ? 'swR' : t < end('sw3') ? 'sw3Head' : 'swLab4';
    const below = pts.filter((p) => p[0] <= BE_X + 0.5), above = pts.filter((p) => p[0] >= BE_X - 0.5);
    if (below.length > 1) s += `<path d="${path(below)}" fill="none" stroke="${TOK.warn}" stroke-width="5" ${NS} data-kind="series" data-chart="sw" data-series="A" data-label="${labA}"/>`;
    if (above.length > 1) s += `<path d="${path(above)}" fill="none" stroke="${TOK.accent}" stroke-width="5" ${NS} data-kind="series" data-chart="sw" data-series="B" data-label="${labB}"/>`;
    s += '</g>';
  }
  if (t >= S.sw2.start && t < end('sw2')) {
    const r = sweepR(t);
    s += `<circle cx="${f1(SW.x(r))}" cy="${f1(SW.y(gapAt(r)))}" r="12" fill="${TOK.ink}"${t >= ON('sw2', 'rises') && t < ON('sw2', 'rises') + 0.4 ? ' data-ev="sw2:swDraw"' : ''}/>`;
  }
  // sw4/sw5: the break-even point and the two zones
  if (has('sw4') && t >= S.sw4.start) {
    const pp = easeBack(pr(t, ON('sw4', 'be_22'), 0.5));
    if (has('sw5')) {
      const zl = easeOut(pr(t, ON('sw5', 'below'), 0.6)) * 0.14, zr = easeOut(pr(t, ON('sw5', 'above'), 0.6)) * 0.14;
      if (zl > 0) s += rect(SW.x0, SW.y(900), BE_X - SW.x0, SW.y(-900) - SW.y(900), TOK.warn, `opacity="${(zl * lineOp).toFixed(3)}" data-kind="region"`);
      if (zr > 0) s += rect(BE_X, SW.y(900), SW.x1 - BE_X, SW.y(-900) - SW.y(900), TOK.accent, `opacity="${(zr * lineOp).toFixed(3)}" data-kind="region"`);
    }
    if (pp > 0 && lineOp > 0) s += `<circle cx="${f1(BE_X)}" cy="${SW.zero}" r="${f1(12 * pp)}" fill="${TOK.ink}" stroke="${TOK.bg}" stroke-width="4" ${NS} opacity="${lineOp.toFixed(3)}"/>`;
  }
  // morphDot: the break-even point flies into its row of the dot plot
  if (has('morphDot') && t >= S.morphDot.start && t < end('morphDot') + 0.05) {
    const p = easeIO(pr(t, S.morphDot.start, S.morphDot.dur));
    s += `<circle cx="${f1(lerp(BE_X, DT.x(BE), p))}" cy="${f1(lerp(SW.zero, DT.rows[1], p))}" r="12" fill="${TOK.ink}"/>`;
  }
  return s;
};
T.sweep = (t) => {
  if (!has('sw1')) return;
  const lo0 = ON('sw1', 'axis_lo'), hi0 = ON('sw1', 'axis_hi');
  const tickEnd = has('sw3') ? ON('sw3', 'axis_lo') : end('sw2');
  const chartEnd = has('sw5') ? end('sw5') : end('sw4');
  text({ id: 'swLo', t, t0: lo0, t1: tickEnd, wx: SW.x0, wy: SW.y(-900) + 18, align: 'center', cls: 'l3 muted', html: K('axis_lo'), anchor: 'sw', ev: 'sw1:swLo' });
  text({ id: 'swHi', t, t0: hi0, t1: tickEnd, wx: SW.x1, wy: SW.y(-900) + 18, align: 'center', cls: 'l3 muted', html: K('axis_hi'), anchor: 'sw', ev: 'sw1:swHi' });
  // one ILLUSTRATIVE badge for the chart, on screen from the first illustrative number on
  text({ id: 'swBadge', t, t0: lo0 - 0.1, t1: (has('sw3') ? end('sw3') : end('sw2')) + 0.15, wx: SW.x1 - 60, wy: SW.y(900) - 24, align: 'right', valign: 'bottom', cls: 'l3s muted', html: badge() });
  text({ id: 'swZero', t, t0: S.sw1.start + S.sw1.move, t1: has('sw3') ? end('sw3') : end('sw2'), wx: SW.x0 - 16, wy: SW.zero - 17, align: 'right', cls: 'l3 muted', html: K('tick_g0'), anchor: 'sw' });
  text({ id: 'swAx', t, t0: lo0, t1: end('sw1'), wx: (SW.x0 + SW.x1) / 2, wy: SW.y(-900) + 56, align: 'center', cls: 'l3 muted', html: 'average annual return (compounded)' });
  text({ id: 'swAx2', t, t0: end('sw1') - 0.05, t1: tickEnd, wx: (SW.x0 + SW.x1) / 2, wy: SW.y(-900) + 56, align: 'center', cls: 'l3 muted', html: 'annual return' });
  heroSwap(t, 'sw1', { header: 'Return sweep', number: `${K('ord_22')}<span class="l2 muted"> bracket</span>`, anchor: 'ord_22', at: { wx: SW.x0 + 40, wy: SW.y(900) - 20, valign: 'bottom' }, ev: 'sw1:swBr' });
  if (has('sw2')) {
    const r = sweepR(t), k = clamp(Math.round((r - 2) / 0.25), 0, 32), g = gapAt(r);
    heroSwap(t, 'sw2', { header: '<span class="accent">B</span> − <span class="warn">A</span>', t0: S.sw2.start, number: `month ${K('horizon')}`, anchor: 'horizon', t1: end('sw2') + 0.15, at: { wx: SW.x0 + 40, wy: SW.y(900) + 10 }, ev: 'sw2:swDef' });
    // the return counter rides with the dot: right of it, on the side away from the zero line
    // the return counter rides with the dot, on the side where neither the rising line nor the
    // zero line passes: below-right while B − A < 0, above-left once it is positive
    text({ id: 'swR', t, t0: S.sw2.start, t1: end('sw2') + 0.15, wx: g < 0 ? SW.x(r) + 26 : SW.x(r) - 26, wy: g < 0 ? SW.y(g) + 14 : SW.y(g) - 14, align: g < 0 ? 'left' : 'right', valign: g < 0 ? 'top' : 'bottom', cls: 'l2b ink', html: K(`r_${k}`), anchor: 'sw' });
    text({ id: 'swLab0', t, t0: S.sw2.start, t1: end('sw2') + 0.15, wx: SW.x0 + 40, wy: SW.y(D.sweep[0].gap) + 22, cls: 'l3s ink', html: '<span class="accent">B</span> − <span class="warn">A</span>' });
  }
  if (has('sw3')) {
    const e = end('sw3');
    heroSwap(t, 'sw3', { t0: S.sw3.start + 0.2, header: '<span class="accent">B</span> − <span class="warn">A</span>', at: { wx: SW.x0 + 40, wy: SW.y(900) - 20, valign: 'bottom' } });

    const l0 = ON('sw3', 'axis_lo'), g0 = ON('sw3', 'gap_lo_abs'), h0 = ON('sw3', 'axis_hi'), g1 = ON('sw3', 'gap_hi');
    text({ id: 'swA', t, t0: l0 - 0.4, t1: e + 0.15, wx: SW.x0 + 20, wy: SW.y(D.sweep[0].gap) + 26, cls: 'l2 warn', series: 'A', anchor: 'sw', html: `${KS('axis_lo', t, l0)}: A ahead ${KS('gap_lo_abs', t, g0, 'sw3:swA')}` });
    text({ id: 'swB', t, t0: h0 - 0.4, t1: e + 0.15, wx: SW.x1 - 20, wy: SW.y(D.sweep[32].gap) - 26, align: 'right', valign: 'bottom', cls: 'l2 accent', series: 'B', anchor: 'sw', html: `${KS('axis_hi', t, h0)}: B ahead ${KS('gap_hi', t, g1, 'sw3:swB')}` });
  }
  if (has('sw4')) {
    const b0 = ON('sw4', 'be_22');
    text({ id: 'swLab4', t, t0: S.sw4.start - 0.2, t1: chartEnd, wx: BE_X + 24, wy: SW.zero + 18, cls: 'l3s ink', html: '<span class="accent">B</span> − <span class="warn">A</span>' });
    heroSwap(t, 'sw4', { header: 'Even', t0: S.sw4.start, number: K('be_22'), anchor: 'be_22', t1: end('sw4'), at: { wx: BE_X, wy: SW.zero - 44, align: 'center', valign: 'bottom' }, ev: 'sw4:swBe', anchorChart: 'sw' });
    text({ id: 'swZ4', t, t0: S.sw4.start, t1: chartEnd, wx: BE_X - 70, wy: SW.zero - 48, align: 'right', cls: 'l3 muted', html: K('tick_g0'), anchor: 'sw' });
    text({ id: 'swT6', t, t0: S.sw4.start, t1: chartEnd, wx: SW.x(6) - 20, wy: SW.zero - 110, align: 'right', cls: 'l3 muted', html: `${K('tick_r6')} ${badge()}`, anchor: 'sw' });
    if (has('sw5')) {
      // in the wider sw5 shot the value sits above-left of the point, clear of the rising line
      text({ id: 'swBeL', t, t0: S.sw5.start, t1: chartEnd, wx: BE_X - 20, wy: SW.zero - 30, align: 'right', valign: 'bottom', cls: 'l1 ink', html: K('be_22'), anchor: 'sw' });
      text({ id: 'swBelow', t, t0: ON('sw5', 'below'), t1: chartEnd, wx: SW.x(3), wy: SW.zero - 60, valign: 'bottom', cls: 'l2 warn', html: 'A ahead', series: 'A', ev: 'sw5:swBelow' });
      text({ id: 'swAbove', t, t0: ON('sw5', 'above'), t1: chartEnd, wx: SW.x(9.0), wy: SW.zero - 120, align: 'right', cls: 'l2 accent', html: 'B ahead', series: 'B', ev: 'sw5:swAbove' });
    }
  }
};

// ---- dots: break-even by bracket
const DT = { x0: 380, x1: 1780, rows: [9760, 9900, 10040], axisY: 10140 };
DT.x = (r) => DT.x0 + ((r - 5) / 1.5) * (DT.x1 - DT.x0);
const BR = [12, 22, 32];
P.dots = (t) => {
  if (!has('dots')) return '';
  let s = '';
  const ap = easeOut(pr(t, S.dots.start + S.dots.move, 0.6));
  s += line(DT.x0, DT.axisY, lerp(DT.x0, DT.x1, ap), DT.axisY, TOK.grid, 3, 'data-kind="axis" data-chart="dots"');
  for (const r of [5, 6]) s += line(DT.x(r), DT.axisY, DT.x(r), DT.axisY + 12, TOK.grid, 3);
  BR.forEach((b, i) => {
    const sc = b === 32 ? 'dots32' : 'dots', a = `be_${b}`;
    if (!has(sc)) return;
    const p = easeBack(pr(t, ON(sc, a), 0.5));
    if (p > 0) s += `<circle cx="${f1(DT.x(D.breakEvens[b]))}" cy="${DT.rows[i]}" r="${f1(12 * p)}" fill="${TOK.ink}"/>`;
  });
  if (has('rises')) {
    const p = easeIO(pr(t, ON('rises', 'rises'), 0.8)), o = labelled(t, T0('rises', S.rises.move), end('rises') + 0.15);
    if (p > 0 && o > 0) {
      const x0 = DT.x(D.breakEvens[12]) + 22, y0 = DT.rows[0] + 10, x1 = DT.x(D.breakEvens[32]) - 20, y1 = DT.rows[2] - 14;
      s += `<g opacity="${o.toFixed(3)}"${p < 1 ? ' data-ev="rises:dArrow"' : ''}>${drawOn(`M${f1(x0)},${y0} C${f1(x0 + 260)},${y0 + 10} ${f1(x1 - 200)},${y1 - 60} ${f1(x1)},${y1}`, TOK.ink, 3, p, 'data-label="risesHead"')}</g>`;
    }
  }
  if (has('below')) {
    const p = easeOut(pr(t, ON('below', 'be_0'), 0.6));
    if (p > 0) s += `<g opacity="${p.toFixed(3)}"${p < 1 ? ' data-ev="below:dRef"' : ''}>${line(DT.x(D.breakEvens[0]), DT.rows[0] - 60, DT.x(D.breakEvens[0]), DT.axisY - 20, TOK.ink, 2, 'stroke-dasharray="6 8"')}</g>`;
  }
  return s;
};
T.dots = (t) => {
  if (!has('dots')) return;
  const tEnd = has('below') ? end('below') : end('dots32');
  [[5, 'tick_d5'], [6, 'tick_d6']].forEach(([r, id]) => text({ id: `dtk${r}`, t, t0: S.dots.start + S.dots.move, t1: tEnd, wx: DT.x(r), wy: DT.axisY + 20, align: 'center', cls: 'l3 muted', html: K(id), anchor: 'dots' }));
  heroSwap(t, 'dots', { header: 'Break-even', at: { wx: DT.x0, wy: 9660, valign: 'bottom' } });
  if (has('dots32')) heroSwap(t, 'dots32', { header: 'Break-even', at: { wx: DT.x0, wy: 9660, valign: 'bottom' } });
  BR.forEach((b, i) => {
    const sc = b === 32 ? 'dots32' : 'dots';
    if (!has(sc)) return;
    const r0 = ON(sc, `ord_${b}`), v0 = ON(sc, `be_${b}`);
    const rowEnd = b === 12 ? (has('rises') ? end('rises') : end('dots32')) : tEnd;
    text({ id: `dr${b}`, t, t0: r0, t1: rowEnd, wx: DT.x0 - 30, wy: DT.rows[i] - 17, align: 'right', cls: 'l3s muted', html: K(`ord_${b}`), ev: b === 32 ? 'dots32:d32r' : '' });
    text({ id: `dv${b}`, t, t0: v0, t1: tEnd, wx: DT.x(D.breakEvens[b]) + (b === 12 ? -26 : 26), wy: DT.rows[i] - 29, align: b === 12 ? 'right' : 'left', cls: 'l2b ink', html: K(`be_${b}`), ev: b === 12 ? 'dots:d12' : b === 22 ? 'dots:d22' : 'dots32:d32' });
  });
  if (has('rises')) heroSwap(t, 'rises', { header: 'Rises', at: { wx: 1500, wy: 9700, align: 'right', valign: 'bottom' } });
  if (has('below')) {
    const e = end('below'), r0 = ON('below', 'ord_12'), z0 = ON('below', 'be_0');
    text({ id: 'bl12', t, t0: r0, t1: e, wx: DT.x0 - 30, wy: DT.rows[0] - 17, align: 'right', cls: 'l3s muted', html: K('ord_12') });
    text({ id: 'belowHead', t, t0: r0, t1: z0, wx: DT.x(D.breakEvens[0]) + 30, wy: DT.rows[0] - 80, valign: 'bottom', cls: 'l1 ink', html: `${K('ord_12')}<span class="l2 muted"> bracket</span>` });
    text({ id: 'belowHero', t, t0: z0, t1: e, wx: DT.x(D.breakEvens[0]) + 30, wy: DT.rows[0] - 80, valign: 'bottom', cls: 'l1 ink', html: K('be_0'), ev: 'below:dRef' });
    text({ id: 'blRef', t, t0: z0 + STAGGER, t1: e, wx: DT.x(D.breakEvens[0]) + 30, wy: DT.rows[0] - 70, cls: 'l3s ink', html: 'loan rate, annualized' });
    const up = pr(t, ON('below', 'st'), 0.8);
    text({ id: 'blSt', t, t0: ON('below', 'st'), t1: e, wx: DT.x(D.breakEvens[0]) + 30, wy: DT.rows[0] + 40, cls: 'l2 neg', series: 'st', html: `<span class="u">A: mostly short-term${underline(up, TOK.neg, 'below:dSt')}</span>` });
  }
};

// ---- risk: certain vs average
const RK = { lx: 2600, rx: 3300 };
P.risk = (t) => {
  if (!has('risk1')) return '';
  let s = '';
  const a = easeOut(pr(t, ON('risk1', 'apr'), 0.8));
  if (a > 0) s += drawOn(`M${RK.lx},10060 L${RK.lx + 520},10060`, TOK.pos, 5, a);
  if (has('risk2')) {
    const b = easeOut(pr(t, ON('risk2', 'promise'), 0.8));
    if (b > 0) for (let r = 2; r <= 10; r += 2) s += line(RK.rx, 10100, lerp(RK.rx, RK.rx + 520, b), lerp(10100, 10100 - 20 * r, b), TOK.accent, 3, 'stroke-dasharray="10 8" data-series="B"');
  }
  return s;
};
T.risk = (t) => {
  if (!has('risk1')) return;
  const e = has('risk2') ? end('risk2') : end('risk1');
  text({ id: 'rk1h', t, t0: T0('risk1', 0.5), t1: e, wx: RK.lx, wy: 9680, cls: 'l3 muted', html: 'Paying off', ev: 'risk1:rk1Head' });
  text({ id: 'rk1v', t, t0: ON('risk1', 'apr'), t1: e, wx: RK.lx, wy: 9720, cls: 'l1 ink', html: K('apr'), ev: 'risk1:rkApr' });
  text({ id: 'rk1c', t, t0: ON('risk1', 'apr') + STAGGER, t1: e, wx: RK.lx, wy: 9870, cls: 'l3s pos', html: 'certain' });
  if (has('risk2')) {
    const l0 = ON('risk2', 'axis_lo'), h0 = ON('risk2', 'axis_hi');
    text({ id: 'rk2h', t, t0: T0('risk2', 0.5), t1: e, wx: RK.rx, wy: 9680, cls: 'l3 muted', html: 'Investing', ev: 'risk2:rk2Head' });
    text({ id: 'rk2c', t, t0: ON('risk2', 'promise'), t1: e, wx: RK.rx, wy: 9870, cls: 'l3s accent', html: 'an average, not a promise', ev: 'risk2:rkProm' });
    text({ id: 'rk2v', t, t0: l0 - 0.1, t1: e, wx: RK.rx, wy: 9720, cls: 'l1 ink', html: `${KS('axis_lo', t, l0, 'risk2:rkRange')}<span style="opacity:${clamp((t - h0) / FADE).toFixed(3)}">–</span>${KS('axis_hi', t, h0)}` });
    text({ id: 'rk2b', t, t0: l0, t1: e, wx: RK.rx, wy: 9930, cls: 'l3s muted', html: badge() });
  }
};

// ---- seq: the ILLUSTRATIVE sequence, the race, the gap, the downside
const SQ = { x0: 5060, x1: 6560, stripY: 8420, bottom: 8540, top: 7880 };
SQ.x = (m) => SQ.x0 + (m / 48) * (SQ.x1 - SQ.x0);
SQ.ny = (v) => SQ.bottom - 20 - ((v + 25000) / 45000) * 640;
SQ.gy = (g) => 8220 - (g / 500) * 220;
const GAP_END = [SQ.x(48), SQ.gy(D.downside.gap[48])];
CUSTOM_CAM.downside = () => ({ x: GAP_END[0] - 170, y: GAP_END[1] + 10, s: 2.6 });
function raceMonth(t) { if (!has('race') || t < T0('race', 1.0)) return 0; return clamp((t - T0('race', 1.0)) / Math.max(2, S.race.dur - 2.2)) * 48; }
P.seq = (t) => {
  if (!has('seq')) return '';
  let s = '';
  const f0 = ON('seq', 'seq_first'), f1s = ON('seq', 'seq_second');
  const stripOut = has('race') ? 1 - easeIO(pr(t, S.race.start, 0.6)) : 1;
  const p1 = easeOut(pr(t, f0, 0.8)) * stripOut, p2 = easeOut(pr(t, f1s, 0.6)) * stripOut;
  if (p1 > 0) s += rect(SQ.x(0), SQ.stripY, (SQ.x(36) - SQ.x(0)) * clamp(p1 / Math.max(stripOut, 1e-3)), 40, TOK.pos, `opacity="${stripOut.toFixed(3)}"`);
  if (p2 > 0) s += rect(SQ.x(36), SQ.stripY, (SQ.x(48) - SQ.x(36)) * clamp(p2 / Math.max(stripOut, 1e-3)), 40, TOK.neg, `opacity="${stripOut.toFixed(3)}"`);
  if (!has('race') || t < S.race.start) return s;
  // race + gap share one panel: the dual lines fold into their difference in morphGap
  const ax = easeOut(pr(t, T0('race', 0.6), 0.6));
  const gm = has('morphGap') ? easeIO(pr(t, S.morphGap.start, S.morphGap.dur)) : 0;
  const axOut = has('gap') ? 1 - easeIO(pr(t, S.gap.start, 0.3)) : 1; // race axes stay through the morph
  s += `<g opacity="${(ax * axOut).toFixed(3)}"${t < T0('race', 1.0) && t >= T0('race', 0.6) ? ' data-ev="race:raceAxes"' : ''}>${line(SQ.x0, SQ.bottom, SQ.x1, SQ.bottom, TOK.grid, 3, 'data-kind="axis" data-chart="race"')}${line(SQ.x0, SQ.top, SQ.x0, SQ.bottom, TOK.grid, 3, 'data-kind="axis" data-chart="race"')}</g>`;
  if (gm > 0) s += `<g opacity="${gm.toFixed(3)}">${line(SQ.x0, SQ.gy(0), SQ.x1, SQ.gy(0), TOK.grid, 3, 'data-kind="axis" data-chart="gap"')}</g>`;
  const mo = raceMonth(t), n = Math.floor(mo), fr = mo - n;
  const A = D.downside.a, B = D.downside.b, G = D.downside.gap;
  const ya = (m) => lerp(SQ.ny(A[m]), SQ.gy(0), gm), yb = (m) => lerp(SQ.ny(B[m]), SQ.gy(G[m]), gm);
  const pts = (yf) => { const o = []; for (let m = 0; m <= n; m++) o.push([SQ.x(m), yf(m)]); if (n < 48 && fr > 0) o.push([SQ.x(mo), lerp(yf(n), yf(n + 1), fr)]); return o; };
  const laA = gm < 0.5 ? 'raceA' : null;
  const seqLinesOp = has('downside') ? clamp((end('downside') - 0.2 - t) / 0.3) : 1;
  if (seqLinesOp <= 0) return s;
  s += `<g opacity="${seqLinesOp.toFixed(3)}">`;
  const inRace = t < end('race');
  const lab = has('morphGap') && t < end('morphGap') ? 'raceB' : t < end('gap') ? 'gapLab' : 'dnLab';
  if (n >= 1 || fr > 0) {
    if (gm < 1) s += `<path d="${path(pts(ya))}" fill="none" stroke="${TOK.warn}" stroke-width="5" opacity="${(1 - gm).toFixed(3)}" ${NS} data-kind="series" data-chart="race" data-series="A" data-label="${laA || lab}"/>`;
    const gp = pts(yb);
    if (gm < 1) s += `<path d="${path(gp)}" fill="none" stroke="${TOK.accent}" stroke-width="5" stroke-dasharray="14 10" ${NS} data-kind="series" data-chart="race" data-series="B" data-label="raceB"/>`;
    else {
      // the gap line: accent while B leads, warn once A leads
      const cm = D.downside.cross, pre = gp.filter((p) => p[0] <= SQ.x(cm - 1) + 0.5), fx = G[cm - 1] / (G[cm - 1] - G[cm]), xc = SQ.x(cm - 1 + fx);
      const post = [[xc, SQ.gy(0)], ...gp.filter((p) => p[0] >= SQ.x(cm) - 0.5)];
      s += `<path d="${path([...pre, [xc, SQ.gy(0)]])}" fill="none" stroke="${TOK.accent}" stroke-width="5" ${NS} data-kind="series" data-chart="gap" data-series="B" data-label="${lab}"/>`;
      s += `<path d="${path(post)}" fill="none" stroke="${TOK.warn}" stroke-width="5" ${NS} data-kind="series" data-chart="gap" data-series="A" data-label="${lab}"/>`;
    }
  }
  // race: month ticks on the x axis appear as the lines pass them
  if (inRace) for (const m of [12, 24, 36]) {
    const tp = clamp((mo - m) / 1.5);
    if (tp > 0) s += `<g opacity="${tp.toFixed(3)}"${tp < 1 ? ` data-ev="race:month${m}"` : ''}>${line(SQ.x(m), SQ.bottom, SQ.x(m), SQ.bottom + 12, TOK.grid, 3)}</g>`;
  }
  // race: the band where both roads run together (months 0..36)
  if (inRace) {
    const bp = easeOut(pr(t, ON('race', 'together'), 0.6));
    if (bp > 0) s += `<g${bp < 1 ? ' data-ev="race:raceTog"' : ''}>${rect(SQ.x(0), SQ.top, SQ.x(36) - SQ.x(0), SQ.bottom - SQ.top, TOK.ink, `opacity="${(0.06 * bp).toFixed(3)}" data-kind="region"`)}</g>`;
    const kp = easeIO(pr(t, ON('race', 'seq_split'), 0.6)), ko = labelled(t, ON('race', 'seq_split'), end('race'));
    if (kp > 0 && ko > 0) s += `<g opacity="${ko.toFixed(3)}">${drawOn(`M${SQ.x(0)},${SQ.top + 90} L${SQ.x(0)},${SQ.top + 72} L${SQ.x(36)},${SQ.top + 72} L${SQ.x(36)},${SQ.top + 90}`, TOK.ink, 2, kp, 'data-label="race36"')}</g>`;
  }
  // gap: the peak (B's largest lead) and the crossing
  if (has('gap')) {
    const pk = easeBack(pr(t, ON('gap', 'peaks'), 0.5));
    if (pk > 0) s += `<circle cx="${f1(SQ.x(36))}" cy="${f1(SQ.gy(G[36]))}" r="${f1(10 * pk)}" fill="${TOK.accent}" data-series="B"${pk < 1 ? ' data-ev="gap:gapPeak"' : ''}/>`;
    const cp = easeBack(pr(t, ON('gap', 'cross_month'), 0.5));
    if (cp > 0) {
      const cm = D.downside.cross, fx = G[cm - 1] / (G[cm - 1] - G[cm]);
      s += `<circle cx="${f1(SQ.x(cm - 1 + fx))}" cy="${f1(SQ.gy(0))}" r="${f1(14 * cp)}" fill="${TOK.ink}" stroke="${TOK.bg}" stroke-width="4" ${NS}${cp < 1 ? ' data-ev="gap:gapCross"' : ''}/>`;
    }
  }
  if (has('downside') && t >= S.downside.start) s += `<circle cx="${f1(GAP_END[0])}" cy="${f1(GAP_END[1])}" r="10" fill="${TOK.warn}"/>`;
  return s + '</g>';
};
T.seq = (t) => {
  if (!has('seq')) return;
  const e = end('seq'), f0 = ON('seq', 'seq_first'), p0 = ON('seq', 'seq_split'), s0 = ON('seq', 'seq_second'), h0 = ON('seq', 'hold_months');
  heroSwap(t, 'seq', { number: `${K('seq_first')}<span class="l2 muted"> a year</span> ${badge()}`, anchor: 'seq_first', at: { wx: SQ.x0, wy: SQ.stripY - 30, valign: 'bottom' }, ev: 'seq:sqFirst' });
  text({ id: 'sqSplit', t, t0: p0, t1: e, wx: SQ.x(18), wy: SQ.stripY + 60, align: 'center', cls: 'l2 muted', html: `for ${K('seq_split')} months` });
  text({ id: 'sqSecond', t, t0: s0, t1: e, wx: SQ.x(44), wy: SQ.stripY + 60, align: 'center', cls: 'l2 neg', series: 'neg', html: `then ${K('seq_second')}`, ev: 'seq:sqSecond' });
  text({ id: 'sqLast', t, t0: h0, t1: e, wx: SQ.x(44), wy: SQ.stripY + 140, align: 'center', cls: 'l2 muted', html: `last ${K('hold_months')}` });
  if (has('race')) {
    const re = end('race');
    const tickEnd = has('morphGap') ? end('morphGap') + 0.15 : re;
    heroSwap(t, 'race', { header: 'Net worth', at: { wx: SQ.x0 + 20, wy: SQ.top + 20, valign: 'bottom' } });
    text({ id: 'rx48', t, t0: T0('race', 0.6), t1: tickEnd, wx: SQ.x(48), wy: SQ.bottom + 16, align: 'center', cls: 'l3 muted', html: K('tick_m48'), anchor: 'race' });
    text({ id: 'ryLo', t, t0: T0('race', 0.6), t1: tickEnd, wx: SQ.x0 - 16, wy: SQ.ny(-20000) - 17, align: 'right', cls: 'l3 muted', html: K('tick_nwm20000'), anchor: 'race' });
    text({ id: 'ryHi', t, t0: T0('race', 0.6), t1: tickEnd, wx: SQ.x0 - 16, wy: SQ.ny(20000) - 17, align: 'right', cls: 'l3 muted', html: K('tick_nw20000'), anchor: 'race' });
    text({ id: 'race36', t, t0: ON('race', 'seq_split'), t1: re, wx: SQ.x(18), wy: SQ.top + 60, align: 'center', valign: 'bottom', cls: 'l3s ink', html: `${K('seq_split')} months ${badge()}` });
    const mo = raceMonth(t), n = Math.min(47, Math.floor(mo)), fr = mo - n;
    if (mo > 0.5 && t < (has('morphGap') ? end('morphGap') + 0.15 : re)) {
      const xa = SQ.x(mo), yA = lerp(SQ.ny(D.downside.a[n]), SQ.ny(D.downside.a[n + 1]), fr), yB = lerp(SQ.ny(D.downside.b[n]), SQ.ny(D.downside.b[n + 1]), fr);
      text({ id: 'raceA', t, t0: T0('race', 0.8), t1: has('morphGap') ? S.morphGap.start + 0.9 : re, wx: xa + 14, wy: Math.min(Math.min(yA, yB) - 44, SQ.bottom - 104), cls: 'l3s warn', html: 'A', series: 'A' });
      text({ id: 'raceB', t, t0: T0('race', 0.8), t1: has('morphGap') ? end('morphGap') + 0.15 : re, wx: xa + 14, wy: Math.min(Math.max(yA, yB) + 8, SQ.bottom - 60), cls: 'l3s accent', html: 'B', series: 'B' });
    }
  }
  if (has('gap')) {
    const e2 = end('gap'), c0 = ON('gap', 'cross_month'), cm = D.downside.cross;
    heroSwap(t, 'gap', { header: '<span class="accent">B</span> − <span class="warn">A</span>', t0: S.gap.start - 0.1, number: `month ${K('cross_month')}`, anchor: 'cross_month', cls: 'warn', series: 'A', anchorChart: 'gap', at: { wx: SQ.x(cm) - 40, wy: SQ.gy(0) + 40, align: 'right' }, ev: 'gap:gapCross' });
    const zEnd = has('downside') ? end('downside') : e2;
    text({ id: 'gapLab', t, t0: S.gap.start - 0.1, t1: e2 + 0.15, wx: SQ.x(35), wy: SQ.gy(D.downside.gap[35]) + 30, align: 'center', cls: 'l3s ink', html: '<span class="accent">B</span> − <span class="warn">A</span>' });
    text({ id: 'gap48', t, t0: S.gap.start - 0.1, t1: zEnd, wx: SQ.x(48), wy: SQ.gy(0) + 18, align: 'center', cls: 'l3 muted', html: K('tick_m48'), anchor: 'gap' });
    text({ id: 'gapZero', t, t0: S.gap.start - 0.1, t1: zEnd, wx: SQ.x(48) - 16, wy: SQ.gy(0) - 40, align: 'right', valign: 'bottom', cls: 'l3 muted', html: K('tick_g0'), anchor: 'gap' });
  }
  if (has('downside')) {
    const [px, py] = scr(GAP_END[0], GAP_END[1]);
    heroSwap(t, 'downside', { header: `month ${K('horizon')}`, t0: S.downside.start, number: `+${K('gap_end')}`, anchor: 'gap_end', cls: 'warn', series: 'A', anchorChart: 'gap', at: { sx: px - 40, sy: py + 30, align: 'right' }, ev: 'downside:dnEnd' });
    text({ id: 'dnLab', t, t0: S.downside.start - 0.3, t1: end('downside'), wx: SQ.x(45), wy: SQ.gy(D.downside.gap[45]) - 40, align: 'center', cls: 'l3s ink', html: '<span class="accent">B</span> − <span class="warn">A</span>' });
    text({ id: 'dnTick', t, t0: S.downside.start, t1: end('downside'), wx: SQ.x(46) - 20, wy: SQ.gy(-500) - 17, align: 'right', cls: 'l3 muted', html: K('tick_gm500'), anchor: 'gap' });
    text({ id: 'dnM48', t, t0: S.downside.start, t1: end('downside'), wx: GAP_END[0] + 20, wy: GAP_END[1] - 14, cls: 'l3 muted', html: `month ${K('tick_m48')}`, anchor: 'gap' });
    text({ id: 'dnCap', t, t0: ON('downside', 'gap_end') + STAGGER, t1: end('downside'), sx: px - 40, sy: py + 170, align: 'right', cls: 'l2 muted', html: 'A ahead, after tax' });
  }
  if (has('order')) {
    const e3 = end('order'), h1 = ON('order', 'horizon'), a1 = ON('order', 'seq_avg');
    text({ id: 'ordOver', t, t0: h1, t1: e3, wx: 5200, wy: 8960, cls: 'l2 muted', html: `over ${K('horizon')} months` });
    text({ id: 'ordHead', t, t0: a1, t1: e3, wx: 5200, wy: 9020, cls: 'l1 ink', html: `${K('seq_avg')}<span class="l2 muted"> a year</span> ${badge()}`, ev: 'order:ordAvg' });
    const up = pr(t, ON('order', 'order'), 0.8);
    text({ id: 'ordLine', t, t0: ON('order', 'order'), t1: e3, wx: 5200, wy: 9180, cls: 'l2 ink', html: `<span class="u">the order decided${underline(up, TOK.ink, 'order:ordLine')}</span>` });
  }
};

// ---- close: callback to the threshold axis
T.close = (t) => {
  if (has('end1')) {
    const e = end('end1');
    text({ id: 'e1Br', t, t0: ON('end1', 'ord_22'), t1: e, wx: AX.px + 125, wy: AX.y - 115, valign: 'bottom', cls: 'l2 muted', html: `${K('ord_22')} bracket`, ev: 'end1:e1Br' });
    text({ id: 'e1Be', t, t0: ON('end1', 'be_22'), t1: e, wx: AX.px, wy: AX.y - 110, align: 'center', valign: 'bottom', cls: 'l1 ink', html: K('be_22'), ev: 'end1:e1Be' });
    text({ id: 'e1Cap', t, t0: ON('end1', 'be_22') + STAGGER, t1: e, wx: AX.px, wy: AX.y - 100, align: 'center', cls: 'l3 muted', html: 'average annual return (compounded)' });
    text({ id: 'e1A', t, t0: T0('end1', 0.6), t1: e, wx: AX.px - 300, wy: AX.y + 40, align: 'center', cls: 'l2 warn', html: 'A ahead', series: 'A', ev: 'end1:e1Zones' });
    text({ id: 'e1B', t, t0: T0('end1', 0.6), t1: e, wx: AX.px + 300, wy: AX.y + 40, align: 'center', cls: 'l2 accent', html: 'B ahead', series: 'B' });
  }
  if (has('recap')) {
    const e = end('recap');
    text({ id: 'rc1', t, t0: ON('recap', 'fixed'), t1: e, sx: 160, sy: 300, cls: 'l2 ink', html: '<span class="pos">Fixed:</span> payoff month, interest avoided', ev: 'recap:rc1' });
    text({ id: 'rc2', t, t0: ON('recap', 'lot'), t1: e, sx: 160, sy: 420, cls: 'l2 ink', html: '<span class="muted">Depends on holding time:</span> tax', ev: 'recap:rc2' });
    text({ id: 'rc3', t, t0: ON('recap', 'ret'), t1: e, sx: 160, sy: 540, cls: 'l2 ink', html: '<span class="warn">Unknown:</span> return', ev: 'recap:rc3' });
  }
  if (has('end2')) text({ id: 'e2Th', t, t0: ON('end2', 'th'), t1: end('end2'), sx: W / 2, sy: 460, align: 'center', cls: 'l2 ink', html: 'A threshold, not a forecast.', ev: 'end2:e2Th' });
  if (has('outro')) {
    text({ id: 'outroMark', t, t0: T0('outro', 0.6), t1: end('outro') + 1, sx: W / 2, sy: 330, align: 'center', cls: 'l1 ink', html: 'CRUX', ev: 'outro:outroMark' });
    text({ id: 'outroTag', t, t0: T0('outro', 1.0), t1: end('outro') + 1, sx: W / 2, sy: 660, align: 'center', cls: 'l3 muted', html: 'personal finance, computed', ev: 'outro:outroTag' });
  }
};

// ---- chapter cards and statements (screen text)
const CARDS = { card2: 'Tax, lot by lot', card3: 'Where it flips', card4: 'The tax bracket', card5: 'Risk' };
T.cards = (t) => {
  for (const [id, title] of Object.entries(CARDS)) if (has(id)) text({ id, t, t0: T0(id, 0.5), t1: end(id), sx: 160, sy: 360, cls: 'l1 ink', html: title, ev: `${id}:${id}` });
  if (has('nodeduct')) {
    text({ id: 'ndLoss', t, t0: ON('nodeduct', 'nd'), t1: end('nodeduct'), sx: 160, sy: 380, cls: 'l2 ink', html: 'Losing lots: no deduction', ev: 'nodeduct:ndLoss' });
    text({ id: 'ndState', t, t0: ON('nodeduct', 'st'), t1: end('nodeduct'), sx: 160, sy: 470, cls: 'l2 muted', html: 'State income tax: ignored', ev: 'nodeduct:ndState' });
  }
};

// ---------------- frame ----------------
function background(t) {
  if (!PAR) PAR = computePAR();
  const f = Math.min(PAR.length - 1, Math.round(t * FPS));
  const [fx, fy, nx, ny] = PAR[f];
  const mod = (v, m) => ((v % m) + m) % m;
  return `<defs>`
    + `<pattern id="far" width="160" height="160" patternUnits="userSpaceOnUse" patternTransform="translate(${f1(mod(fx, 160))},${f1(mod(fy, 160))})"><circle cx="2" cy="2" r="1.5" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="near" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="translate(${f1(mod(nx, 260))},${f1(mod(ny, 260))})"><circle cx="3" cy="3" r="3" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="mid" width="96" height="96" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="${f1(2 / CAM.s)}" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="hatchB" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="${TOK.surface}"/><rect width="5" height="12" fill="${TOK.accent}"/></pattern>`
    + `<pattern id="hatchA" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="${TOK.surface}"/><rect width="5" height="12" fill="${TOK.warn}"/></pattern>`
    + `<pattern id="hatchN" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="${TOK.surface}"/><rect width="5" height="12" fill="${TOK.neg}"/></pattern>`
    + `</defs><rect width="${W}" height="${H}" fill="url(#far)" data-role="bg"/><rect width="${W}" height="${H}" fill="url(#near)" data-role="bg"/>`;
}

const PANELS = ['hook', 'fork', 'axis', 'ident', 'scope', 'loan', 'cash', 'eq', 'lots', 'rates', 'share', 'sweep', 'dots', 'risk', 'seq'];
function renderFrame(t) {
  CAM = camera(t);
  TEXT = [];
  const s = sceneAt(t);
  const dismissEv = TL.events.filter((e) => e.scene === s.id && e.type === 'dismiss');
  const g = [`<rect x="-3000" y="-3000" width="14000" height="12000" fill="url(#mid)" data-role="bg"/>`];
  for (const name of PANELS) {
    const op = panelOp(name, t);
    if (op <= 0.001) continue;
    const body = P[name](t);
    if (!body) continue;
    const fading = op < 1 && SC[s.index - 1] && SC[s.index - 1].panels.includes(name) && !s.panels.includes(name);
    const ev = fading && dismissEv.length && t - s.start < 0.5 ? ` data-ev="${dismissEv[0].id}"` : '';
    g.push(`<g data-panel="${name}" opacity="${op.toFixed(3)}"${ev}>${body}</g>`);
  }
  T.hook(t); T.fork(t); T.axis(t); T.ident(t); T.scope(t); T.loan(t); T.cash(t); T.card(t); T.eq(t);
  T.lots(t); T.rates(t); T.share(t); T.sweep(t); T.dots(t); T.risk(t); T.seq(t); T.close(t); T.cards(t);
  const fade = t > TL.total - 0.9 ? clamp((TL.total - t) / 0.9) : 1;
  const fadeEv = fade < 1 && TL.total - t > 0.5 ? ' data-ev="outro:fadeAll"' : '';
  const camEv = CAM.moving ? ` data-ev="${s.id}:cam"` : '';
  document.getElementById('stage').innerHTML =
    `<svg width="${W}" height="${H}">${background(t)}`
    + `<g${camEv} transform="translate(${W / 2} ${H / 2}) scale(${CAM.s.toFixed(5)}) translate(${(-CAM.x).toFixed(2)} ${(-CAM.y).toFixed(2)})">${g.join('')}</g></svg>`
    + `<div id="overlay"${fadeEv} style="position:absolute;inset:0;opacity:${fade.toFixed(3)}">${TEXT.join('')}</div>`;
  // text that would leave the safe area fades out instead of clipping
  for (const el of document.querySelectorAll('#overlay .t')) {
    const r = el.getBoundingClientRect();
    const inset = Math.min(r.left - SAFE, r.top - SAFE, W - SAFE - r.right, H - SAFE - r.bottom);
    if (inset < 16) { const k = clamp(inset / 16); el.style.opacity = (parseFloat(el.style.opacity) * k).toFixed(3); if (k <= 0.02) el.removeAttribute('data-ev'); }
  }
  document.querySelector('svg').style.opacity = fade.toFixed(3);
  return s.id;
}

function effOp(el) { let op = 1, e = el; while (e && e.nodeType === 1) { const o = e.getAttribute('opacity'); if (o !== null && o !== '') op *= parseFloat(o); if (e.style && e.style.opacity !== '') op *= parseFloat(e.style.opacity); e = e.parentElement; } return op; }
// DOM probes for sync: data-ev elements with effective opacity > 0.02
function probes() { return [...document.querySelectorAll('[data-ev]')].filter((el) => effOp(el) > 0.02).map((el) => el.getAttribute('data-ev')); }
// claim spans on screen showing their FINAL value: [claimId, tid, effective opacity]
// (a span mid-roll carries data-roll and does not count as the number being shown)
function claimVis() { return [...document.querySelectorAll('#overlay .n')].filter((el) => !el.dataset.roll).map((el) => [el.dataset.claim, el.closest('.t').dataset.tid, +effOp(el).toFixed(3)]); }
function freezeAt(t) { FROZEN = t === null ? null : cameraReal(t); }

window.SEG = { renderFrame, probes, claimVis, freezeAt, TL, USED, TOTAL: TL.total, camera, sceneAt };
