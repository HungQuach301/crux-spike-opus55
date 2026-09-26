'use strict';
/* Frame rules over the page's screen-space object list (contract: window.CHECKS.objects(), see checks/CONTRACT.md §Page).
 * Ported from test C's render-av/rules.js (12 rules) so they no longer depend on one DOM layout, plus the new test-D frame rules.
 * Every function takes (objs, ctx) and returns a list of violations. ctx: { tokens, allowed, inTransition, illustrative, claims, scene } */
const W = 1920, H = 1080;

const inflate = (r, d) => ({ l: r.l - d, t: r.t - d, r: r.r + d, b: r.b + d });
const B = (o) => ({ l: o.box[0], t: o.box[1], r: o.box[2], b: o.box[3] });
function onFrame(r, minArea = 16) {
  const a = inflate(r, 0.5);
  const w = Math.min(a.r, W) - Math.max(a.l, 0), h = Math.min(a.b, H) - Math.max(a.t, 0);
  return w > 0 && h > 0 && w * h >= minArea;
}
const gapBetween = (a, b) => Math.hypot(Math.max(0, a.l - b.r, b.l - a.r), Math.max(0, a.t - b.b, b.t - a.b));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function lum(hex) { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); }
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const texts = (objs, minOp = 0.5) => objs.filter((o) => o.kind === 'text' && o.opacity > minOp);
const shapes = (objs) => objs.filter((o) => o.kind === 'shape');
const isBg = (o) => o.role === 'bg';
const seriesHex = (tok) => new Set(Object.values(tok.series || {}).map((h) => h.toLowerCase()));
const markHex = (o, tok) => { const S = seriesHex(tok); return [o.stroke, o.fill].find((c) => c && S.has(c)) || null; };

// C1 scene isolation: shapes of panels that do not belong to the scene stay off the settled frame
function sceneLeak(objs, ctx) {
  if (ctx.inTransition || (ctx.allowed || []).includes('*')) return [];
  return shapes(objs).filter((o) => o.panel && !ctx.allowed.includes(o.panel) && !isBg(o) && o.opacity > 0.05 && onFrame(B(o)))
    .map((o) => ({ rule: 'C01', panel: o.panel, id: o.id, op: +o.opacity.toFixed(2), box: o.box.map(Math.round) }));
}

// C2 background painted over data (paint order = array order)
function bgOverData(objs) {
  const idx = objs.findIndex((o) => o.kind === 'shape' && o.panel && !isBg(o) && o.opacity > 0.05);
  if (idx < 0) return [];
  const data = objs.slice(idx).filter((o) => o.kind === 'shape' && o.panel && !isBg(o) && o.opacity > 0.05).map(B).filter((r) => onFrame(r));
  const out = [];
  objs.forEach((o, i) => {
    if (i <= idx || o.kind !== 'shape' || !isBg(o) || o.opacity <= 0.02) return;
    const n = data.filter((d) => gapBetween(d, B(o)) === 0).length;
    if (n) out.push({ rule: 'C02', id: o.id, dataElementsCovered: n });
  });
  return out;
}

// C3 every visible curve is labelled (bound label within 240 px, or any text within 60 px)
function unlabelledCurve(objs) {
  const T = texts(objs);
  const out = [];
  for (const o of shapes(objs)) {
    if (!o.curve || isBg(o) || o.opacity <= 0.1) continue;
    const r = B(o);
    if (!onFrame(r, 1) || Math.hypot(r.r - r.l, r.b - r.t) < 80) continue;
    let ok;
    if (o.label) { const t = T.find((x) => x.tid === o.label); ok = !!t && gapBetween(B(t), r) <= 240; }
    else ok = T.some((x) => gapBetween(B(x), r) <= 60);
    if (!ok) out.push({ rule: 'C03', id: o.id, panel: o.panel, bound: o.label || null, box: o.box.map(Math.round) });
  }
  return out;
}

// C4 line charts have an axis and two numeric anchors
function axisAnchors(objs, ctx) {
  const T = texts(objs);
  const tok = ctx.tokens;
  const neutral = new Set([tok.colors.grid, tok.colors.muted].filter(Boolean).map((h) => h.toLowerCase()));
  const out = [];
  for (const o of shapes(objs)) {
    const explicit = o.role === 'series';
    if (!explicit && !(o.vertices >= 10 && markHex(o, tok))) continue;
    const r = B(o);
    if (o.opacity <= 0.3 || !onFrame(r) || Math.hypot(r.r - r.l, r.b - r.t) < 120) continue;
    const chart = o.chart || null;
    const axes = shapes(objs).filter((a) => a !== o && a.opacity > 0.3 && (chart ? a.role === 'axis' && a.chart === chart : (a.role === 'axis' || neutral.has(a.stroke)) && gapBetween(B(a), inflate(r, 60)) === 0));
    const anchors = T.filter((x) => (chart && x.anchor === chart) || (!chart && (x.claims || []).length && gapBetween(B(x), r) <= 120));
    if (!axes.length || anchors.length < 2) out.push({ rule: 'C04', id: o.id, chart, axes: axes.length, anchors: anchors.length });
  }
  return out;
}

// C5 emphasis survives grey scale: ≥ 7:1 against bg, and no 48 px+ non-emphasis text brighter in grey
function greyEmphasis(objs, ctx) {
  const T = texts(objs).filter((x) => onFrame(B(x)));
  const bgL = lum(ctx.tokens.colors.bg.toLowerCase());
  const emph = T.filter((x) => x.level === 1 || x.emph);
  const out = [];
  for (const e of emph) {
    if (!e.color) continue;
    const L = lum(e.color), cr = contrast(L, bgL);
    if (cr < 7) out.push({ rule: 'C05', tid: e.tid, colour: e.color, contrast: +cr.toFixed(2) });
    for (const o of T) {
      if (emph.includes(o)) continue;
      const big = (o.runs || []).filter((r) => r.size >= 48).sort((a, b) => b.size - a.size)[0];
      if (big && lum(big.color) > L + 1e-6) out.push({ rule: 'C05', tid: e.tid, brighter: o.tid, brighterColour: big.color });
    }
  }
  return out;
}

// C6 a number in a series colour takes the colour of the series it annotates
function numberColour(objs, ctx) {
  const tok = ctx.tokens, S = seriesHex(tok);
  const marks = shapes(objs).filter((o) => !isBg(o) && o.opacity > 0.3).map((o) => ({ o, c: markHex(o, tok), r: B(o) })).filter((m) => m.c && onFrame(m.r, 1));
  const out = [];
  for (const t of texts(objs)) for (const sp of t.claims || []) {
    if (sp.opacity <= 0.5 || !sp.color || !S.has(sp.color)) continue;
    const r = { l: sp.box[0], t: sp.box[1], r: sp.box[2], b: sp.box[3] };
    if (!onFrame(r)) continue;
    const ser = sp.series || t.series;
    let want = null;
    if (ser && tok.seriesOf && tok.seriesOf[ser]) want = tok.seriesOf[ser].toLowerCase();
    else { let bd = 150; for (const m of marks) { const g = gapBetween(m.r, r); if (g < bd) { bd = g; want = m.c; } } }
    if (want && want !== sp.color) out.push({ rule: 'C06', claim: sp.id, colour: sp.color, seriesColour: want });
  }
  return out;
}

// C7 bars keep their data proportion (not cropped along the value axis unless an axis break is shown; one scale per chart ±3%)
function barProportion(objs, ctx) {
  if (ctx.inTransition) return [];
  const out = [];
  const breaks = new Set(shapes(objs).filter((o) => o.role === 'axis-break' && o.opacity > 0.3).map((o) => o.panel));
  const scale = {};
  for (const o of shapes(objs)) {
    if (o.role !== 'bar' || o.opacity <= 0.3) continue;
    const r = B(o);
    if (!onFrame(r)) continue;
    const horiz = o.orient ? o.orient === 'h' : (r.r - r.l) >= (r.b - r.t);
    const cropped = horiz ? (r.l < -0.5 || r.r > W + 0.5) : (r.t < -0.5 || r.b > H + 0.5);
    if (cropped && !breaks.has(o.panel)) out.push({ rule: 'C07', id: o.id, why: 'bar runs off the frame along its value axis', box: o.box.map(Math.round) });
    const v = parseFloat(o.value);
    if (!cropped && o.full && v > 0 && o.chart) (scale[o.chart] ||= []).push((horiz ? r.r - r.l : r.b - r.t) / v);
  }
  for (const [chart, ks] of Object.entries(scale)) {
    const lo = Math.min(...ks), hi = Math.max(...ks);
    if (ks.length > 1 && hi / lo > 1.03) out.push({ rule: 'C07', chart, why: `bars of one chart use different scales (${lo.toFixed(4)}–${hi.toFixed(4)})` });
  }
  return out;
}

// S08 (C rule 9): illustrative number visible => ILLUSTRATIVE badge visible in the same frame
function illustrativeState(objs, ctx) {
  const ill = new Set(ctx.illustrative || []);
  const shown = [];
  for (const t of texts(objs)) for (const sp of t.claims || []) if (ill.has(sp.id) && sp.opacity > 0.5 && onFrame({ l: sp.box[0], t: sp.box[1], r: sp.box[2], b: sp.box[3] })) shown.push(sp.id);
  const badge = objs.some((o) => o.kind === 'text' && o.role === 'badge' && o.opacity > 0.5 && onFrame(B(o)));
  return { shown, badge };
}

const level1Count = (objs) => texts(objs).filter((x) => x.level === 1 && onFrame(B(x))).length;

// V02 position of level-1 elements: near a thirds intersection, or on the centre axis when the scene declares composition "center"
const POWER = [[640, 360], [1280, 360], [640, 720], [1280, 720]];
function level1Position(objs, ctx) {
  const out = [];
  for (const x of texts(objs).filter((x) => x.level === 1 && onFrame(B(x)))) {
    const cx = (x.box[0] + x.box[2]) / 2, cy = (x.box[1] + x.box[3]) / 2;
    const thirds = POWER.some(([px, py]) => Math.abs(cx - px) <= 96 && Math.abs(cy - py) <= 54);
    const centre = ctx.scene && ctx.scene.composition === 'center' && Math.abs(cx - 960) <= 48;
    out.push({ tid: x.tid, ok: thirds || centre, c: [Math.round(cx), Math.round(cy)] });
  }
  return out;
}

// C15 only token colours on visible objects
function offToken(objs, ctx) {
  const ok = new Set(Object.values(ctx.tokens.colors).map((h) => h.toLowerCase()));
  const out = [];
  for (const o of objs) {
    if (o.opacity <= 0.05 || !onFrame(B(o), 1)) continue;
    const cs = o.kind === 'text' ? [...(o.runs || []).map((r) => r.color), o.background].filter(Boolean) : [o.fill, o.stroke].filter(Boolean);
    for (const c of cs) if (!c.startsWith('url(') && !ok.has(c)) out.push({ rule: 'C15', id: o.id, colour: c });
  }
  return out;
}

// S09 money basis on screen
const BASIS = { real: /\breal\b|inflation[- ]adjusted|today'?s dollars|\b(19|20)\d\d dollars\b|after inflation/i, nominal: /\bnominal\b|before inflation|dollars of the day|then-year/i };
function moneyBasis(objs, ctx) {
  const T = texts(objs);
  const out = [];
  for (const t of T) for (const sp of t.claims || []) {
    const c = ctx.claims[sp.id];
    if (!c || !String(c.display).includes('$') || sp.opacity <= 0.5) continue;
    const rx = BASIS[c.basis];
    const near = T.filter((o) => o === t || gapBetween(B(o), B(t)) <= 300);
    if (!rx || !near.some((o) => rx.test(o.text))) out.push({ rule: 'S09', claim: sp.id, basis: c.basis || null });
  }
  return out;
}

// numbers written in visible text outside claim spans (S07)
const NUM = /(?<![\w.])[-−–]?\$?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%|percent\b)?/g;
function orphanNumbers(objs) {
  const out = [];
  for (const t of texts(objs)) {
    let s = t.text || '';
    for (const sp of t.claims || []) s = s.split(sp.text).join(' ');
    const m = s.match(NUM);
    if (m) out.push({ tid: t.tid, numbers: m.map((x) => x.trim()), text: t.text.slice(0, 80) });
  }
  return out;
}

// V04 characters: side, colour, shape; time runs left to right
function characters(objs) {
  const ch = {};
  for (const o of objs) {
    if (!o.char || o.opacity <= 0.5 || !onFrame(B(o))) continue;
    const c = ch[o.char] ||= { xs: [], colours: [], shapes: [] };
    c.xs.push((o.box[0] + o.box[2]) / 2);
    if (o.kind === 'shape') { c.colours.push(o.stroke && o.stroke !== 'none' && !o.fill ? o.stroke : o.fill || o.stroke); c.shapes.push(o.shape || o.tag); }
  }
  return ch;
}
function timeOrder(objs) {
  // year labels per chart must increase left to right
  const by = {};
  for (const o of texts(objs)) if (o.year != null && o.role === 'axis-label' && onFrame(B(o))) (by[o.chart || o.anchor || '_'] ||= []).push([+o.year, (o.box[0] + o.box[2]) / 2]);
  const bad = [];
  for (const [chart, xs] of Object.entries(by)) {
    xs.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < xs.length; i++) if (xs[i][1] <= xs[i - 1][1]) { bad.push({ chart, years: [xs[i - 1][0], xs[i][0]] }); break; }
  }
  return bad;
}

module.exports = { W, H, B, onFrame, gapBetween, inflate, lum, contrast, sceneLeak, bgOverData, unlabelledCurve, axisAnchors, greyEmphasis, numberColour, barProportion,
  illustrativeState, level1Count, level1Position, offToken, moneyBasis, orphanNumbers, characters, timeOrder, BASIS };
