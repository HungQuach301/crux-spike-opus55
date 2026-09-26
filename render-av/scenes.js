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
function camTarget(s) {
  if (s.cam) return s.cam;
  if (s.id === 'avoided' || s.id === 'certain') return { x: (XA + XB) / 2, y: 3520, s: 2.4 };
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
const PAR = (() => {
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
})();

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
      if (fb > 0) s += `<g opacity="${fb.toFixed(3)}">${barB(HK.cx(m), HK.yB, HK.cw, HK.h)}</g>`;
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
    text({ id: 'hkMonths', t, t0: m0, t1: end('hook3'), wx: 200, wy: 640, valign: 'bottom', cls: 'l1 ink', html: `${K('months')}<span class="l2 muted"> months</span>`, ev: 'hook3:hkMonths' });
    text({ id: 'hkRowA', t, t0: m0 + STAGGER, t1: end('hook3'), wx: 180, wy: HK.yA + 4, align: 'right', cls: 'l3s warn', html: 'A', series: 'A' });
    text({ id: 'hkRowB', t, t0: m0 + 2 * STAGGER, t1: end('hook3'), wx: 180, wy: HK.yB + 4, align: 'right', cls: 'l3s accent', html: 'B', series: 'B' });
    text({ id: 'hkLotsCap', t, t0: ON('hook3', 'lots') - 0.2, t1: end('hook3'), wx: HK.x0, wy: HK.yB + HK.h + 40, cls: 'l3 muted', html: 'a lot a month' });
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
  if (has('hook2') && t < end('hook2b')) {
    pa = pick('hook2', 'A'); pb = pick('hook2b', 'B'); labA = 'hkA'; labB = 'hkB';
    oa = labelled(t, ON('hook2', 'A'), end('hook2b')); ob = labelled(t, ON('hook2b', 'B'), end('hook2b'));
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
    text({ id: 'hkA', t, t0: ON('hook2', 'A'), t1: end('hook2b'), wx: 3000, wy: 340, cls: 'l2 warn', html: '<span style="font-weight:700">A:</span> pay off', series: 'A', ev: 'hook2:hkRoadA' });
    text({ id: 'hkB', t, t0: ON('hook2b', 'B'), t1: end('hook2b'), wx: 3000, wy: 780, cls: 'l2 accent', html: '<span style="font-weight:700">B:</span> invest', series: 'B', ev: 'hook2b:hkRoadB' });
  }
  if (has('extra')) {
    const e0 = ON('extra', 'extra');
    text({ id: 'xExtra', t, t0: e0, t1: end('extra'), wx: FK.root[0], wy: FK.root[1] - 60, align: 'center', valign: 'bottom', cls: 'l1 ink', html: `+${K('extra')}`, ev: 'extra:xExtra' });
    text({ id: 'xMonth', t, t0: e0 + STAGGER, t1: end('extra'), wx: FK.root[0], wy: FK.root[1] + 60, align: 'center', cls: 'l3 muted', html: 'a month' });
    const ip = pr(t, ON('extra', 'illu'), 0.7);
    text({ id: 'xIllu', t, t0: ON('extra', 'illu'), t1: end('extra'), wx: FK.root[0], wy: FK.root[1] + 120, align: 'center', cls: 'l3s muted', html: `<span class="u">${badge()}${underline(ip, TOK.muted, 'extra:xIllu')}</span>` });
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
  if (!has('setup')) return '';
  const p = easeOut(pr(t, ON('setup', 'setup'), 0.8));
  return line(5960 - 900, 1780, 5960 - 900 + 1800 * p, 1780, TOK.grid, 3);
};
T.scope = (t) => {
  if (has('setup')) text({ id: 'setupW', t, t0: ON('setup', 'setup'), t1: end('scope1'), sx: 160, sy: 200, cls: 'l2 ink', html: 'The setup', ev: 'setup:setupWord' });
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
  if (split >= 1) {
    s += barA(160, LN.yA, aEnd - 160, LN.h, 'data-kind="bar"');
    s += barB(160, LN.yB, bEnd - 160, LN.h, 'data-kind="bar"');
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
    if (ap > 0) {
      s += rect(XA, LN.yA, (XB - XA) * ap, LN.h, 'none', `stroke="${TOK.warn}" stroke-width="2" stroke-dasharray="8 6" ${NS} data-series="A"`);
      const capT1 = has('certain') ? end('certain') : end('avoided');
      s += `<g opacity="${labelled(t, ON('avoided', 'avoided') + STAGGER, capT1).toFixed(3)}"${ap < 1 ? ' data-ev="avoided:avdBracket"' : ''}>${drawOn(`M${XA},${LN.yA - 4} L${XA},${LN.yA - 16} L${XB},${LN.yA - 16} L${XB},${LN.yA - 4}`, TOK.ink, 3, ap, 'data-label="avdCap"')}</g>`;
    }
  }
  return s;
};
T.loan = (t) => {
  if (has('facts')) {
    const b0 = ON('facts', 'balance'), a0 = ON('facts', 'apr'), m0 = ON('facts', 'months'), p0 = ON('facts', 'payment');
    text({ id: 'fBal', t, t0: b0, t1: end('facts'), wx: 160, wy: 2990, cls: 'l1 ink', html: `${K('balance')}<span class="l2 muted"> left</span>`, ev: 'facts:fBal' });
    text({ id: 'fApr', t, t0: a0, t1: end('facts'), wx: 160, wy: 3130, cls: 'l2 ink', html: `at ${K('apr')} APR`, ev: 'facts:fApr' });
    text({ id: 'fPay', t, t0: m0 - 0.15, t1: end('facts'), wx: 160, wy: 3200, cls: 'l2 muted', html: `${KS('months', t, m0, 'facts:fMonths')} monthly payments of <span style="opacity:${clamp((t - p0) / FADE).toFixed(3)}"${t >= p0 ? ' data-ev="facts:fPay"' : ''}>${R('payment', t, p0 + PRE)}</span>` });
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
    text({ id: 'freeCap', t, t0: f0 + STAGGER, t1: end('free'), wx: (LN.x(D.loan.payoffA) + LN.x(48)) / 2, wy: LN.yB + LN.h + 20, align: 'center', cls: 'l2 muted', html: 'months with no car payment' });
  }
  if (has('interest')) {
    const b0 = ON('interest', 'int_b'), a0 = ON('interest', 'int_a');
    text({ id: 'intB', t, t0: b0, t1: end('interest'), wx: XB, wy: LN.yB - 8, align: 'right', valign: 'bottom', cls: 'l2 accent', html: R('int_b', t, b0 + PRE), series: 'B', ev: 'interest:intB' });
    text({ id: 'intA', t, t0: a0, t1: end('interest'), wx: XA, wy: LN.yA - 20, align: 'center', valign: 'bottom', cls: 'l1 warn', html: R('int_a', t, a0 + PRE), series: 'A', ev: 'interest:intA' });
    text({ id: 'intHead', t, t0: S.interest.start + S.interest.move, t1: a0, wx: XA, wy: LN.yA - 20, align: 'center', valign: 'bottom', cls: 'l1 ink', html: 'Interest' });
    text({ id: 'intCap', t, t0: S.interest.start + 0.6, t1: end('interest'), wx: 1100, wy: LN.yB + LN.h + 30, cls: 'l3 muted', html: 'interest paid over the loan' });
  }
  if (has('avoided')) {
    const v0 = ON('avoided', 'avoided'), t1 = has('certain') ? end('certain') : end('avoided');
    const mid = (XA + XB) / 2;
    text({ id: 'avd', t, t0: v0, t1, wx: mid, wy: 3425, align: 'center', valign: 'bottom', cls: 'l1 warn', html: K('avoided'), series: 'A', ev: 'avoided:avd' });
    let cert = '';
    if (has('certain')) {
      const c0 = ON('certain', 'certain'), up = pr(t, ON('certain', 'certain'), 0.8);
      cert = `<span style="opacity:${clamp((t - c0) / FADE).toFixed(3)}"> · <span class="u pos">certain${underline(up, TOK.pos, 'certain:certainLine')}</span></span>`;
    }
    text({ id: 'avdCap', t, t0: v0 + STAGGER, t1, wx: mid, wy: 3432, align: 'center', cls: 'l2 muted', html: `interest avoided${cert}` });
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
  text({ id: 'eqL', t, t0: T0('identity', 0.5), t1: e1, wx: EQ.lx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3 muted', html: 'interest avoided' });
  text({ id: 'eqR', t, t0: T0('identity', 1.1), t1: e1, wx: EQ.rx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3 muted', html: 'extra invested by A' });
  if (has('bridge')) {
    const b1 = end('bridge');
    text({ id: 'brHead', t, t0: T0('bridge', S.bridge.move), t1: ON('bridge', 'avoided'), wx: EQ.lx + EQ.w / 2 - 80, wy: EQ.base - h - 22, valign: 'bottom', cls: 'l1 ink', html: 'The question' });
    text({ id: 'brVal', t, t0: ON('bridge', 'avoided'), t1: b1, wx: EQ.lx + EQ.w / 2, wy: EQ.base - h - 22, align: 'center', valign: 'bottom', cls: 'l1 warn', html: K('avoided'), series: 'A', ev: 'bridge:brVal' });
    text({ id: 'brL', t, t0: T0('bridge', 0.6), t1: b1, wx: EQ.lx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3s pos', html: 'certain' });
    text({ id: 'brR', t, t0: ON('bridge', 'head'), t1: b1, wx: EQ.rx + EQ.w / 2, wy: EQ.base + 14, align: 'center', cls: 'l3s accent', html: 'B: after-tax head start', series: 'B', ev: 'bridge:brB' });
    text({ id: 'brQ', t, t0: ON('bridge', 'head') + STAGGER, t1: b1, wx: EQ.rx + EQ.w / 2, wy: EQ.base - h / 2, align: 'center', valign: 'bottom', cls: 'l2 accent', html: '?', series: 'B' });
  }
};

// ---------------- frame ----------------
function background(t) {
  const f = Math.min(PAR.length - 1, Math.round(t * FPS));
  const [fx, fy, nx, ny] = PAR[f];
  const mod = (v, m) => ((v % m) + m) % m;
  return `<defs>`
    + `<pattern id="far" width="160" height="160" patternUnits="userSpaceOnUse" patternTransform="translate(${f1(mod(fx, 160))},${f1(mod(fy, 160))})"><circle cx="2" cy="2" r="1.5" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="near" width="260" height="260" patternUnits="userSpaceOnUse" patternTransform="translate(${f1(mod(nx, 260))},${f1(mod(ny, 260))})"><circle cx="3" cy="3" r="3" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="mid" width="96" height="96" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="${f1(2 / CAM.s)}" fill="${TOK.grid}"/></pattern>`
    + `<pattern id="hatchB" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="${TOK.surface}"/><rect width="5" height="12" fill="${TOK.accent}"/></pattern>`
    + `<pattern id="hatchA" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="${TOK.surface}"/><rect width="5" height="12" fill="${TOK.warn}"/></pattern>`
    + `</defs><rect width="${W}" height="${H}" fill="url(#far)" data-role="bg"/><rect width="${W}" height="${H}" fill="url(#near)" data-role="bg"/>`;
}

const PANELS = ['hook', 'fork', 'axis', 'ident', 'scope', 'loan', 'cash', 'eq'];
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
  const fade = t > TL.total - 0.9 ? clamp((TL.total - t) / 0.9) : 1;
  const camEv = CAM.moving ? ` data-ev="${s.id}:cam"` : '';
  document.getElementById('stage').innerHTML =
    `<svg width="${W}" height="${H}">${background(t)}`
    + `<g${camEv} transform="translate(${W / 2} ${H / 2}) scale(${CAM.s.toFixed(5)}) translate(${(-CAM.x).toFixed(2)} ${(-CAM.y).toFixed(2)})">${g.join('')}</g></svg>`
    + `<div id="overlay" style="position:absolute;inset:0;opacity:${fade.toFixed(3)}">${TEXT.join('')}</div>`;
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
// claim spans on screen: [claimId, tid, effective opacity]
function claimVis() { return [...document.querySelectorAll('#overlay .n')].map((el) => [el.dataset.claim, el.closest('.t').dataset.tid, +effOp(el).toFixed(3)]); }
function freezeAt(t) { FROZEN = t === null ? null : cameraReal(t); }

window.SEG = { renderFrame, probes, claimVis, freezeAt, TL, USED, TOTAL: TL.total, camera, sceneAt };
