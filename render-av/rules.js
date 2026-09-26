/* Composition rules for the five test-B defects (+ helpers for the split-view rule).
 * Loaded into a rendered page (test B's render-motion page or test C's render-av page) and run
 * per frame by render-av/rules-run.js. Pure DOM inspection: the rules see what a viewer sees
 * (screen-space boxes, effective opacity, computed colours), not the authoring intent.
 *
 * Tags used when present (test C sets them; test B's adapter sets data-panel only):
 *   data-panel   panel an SVG element belongs to            data-kind   series | axis | bar
 *   data-chart   chart id (series, axis, anchors)           data-anchor chart id on an anchor text
 *   data-label   tid of the text that names a curve         data-series A | B | gap | lt | st | neg
 *   data-emph    marks an emphasis element besides .l1      data-role   bg (background layer)
 */
(function () {
  const W = 1920, H = 1080;
  const TOK = { bg: '#0E1116', surface: '#171B22', ink: '#F2F4F7', muted: '#9AA4B2', accent: '#4C8DFF', warn: '#F2B441', pos: '#3FBF7F', neg: '#E5484D', grid: '#2A303B' };
  const SERIES_HEX = new Set([TOK.accent, TOK.warn, TOK.pos, TOK.neg].map((h) => h.toLowerCase()));
  const SERIES_OF = { A: TOK.warn, B: TOK.accent, lt: TOK.pos, st: TOK.neg, neg: TOK.neg };
  const SHAPES = 'rect,circle,ellipse,line,path,polyline,polygon';

  const hex = (c) => {
    if (!c) return null;
    if (c.startsWith('#')) return c.toLowerCase();
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
    return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('');
  };
  function effOpacity(el) {
    let op = 1, e = el;
    while (e && e.nodeType === 1) {
      const a = e.getAttribute('opacity');
      if (a !== null && a !== '') op *= parseFloat(a);
      if (e.style && e.style.opacity !== '') op *= parseFloat(e.style.opacity);
      e = e.parentElement;
    }
    return op;
  }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  function lum(h) { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
  const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const inflate = (r, d) => ({ l: r.l - d, t: r.t - d, r: r.r + d, b: r.b + d });
  const onFrame = (r, minArea = 16) => {
    const a = inflate(r, 0.5);
    const w = Math.min(a.r, W) - Math.max(a.l, 0), h = Math.min(a.b, H) - Math.max(a.t, 0);
    return w > 0 && h > 0 && w * h >= minArea;
  };
  const gapBetween = (a, b) => Math.hypot(Math.max(0, a.l - b.r, b.l - a.r), Math.max(0, a.t - b.b, b.t - a.b));
  const strokeHex = (el) => hex(el.getAttribute('stroke')) || hex(getComputedStyle(el).stroke);
  const fillHex = (el) => { const f = el.getAttribute('fill'); return f && f.startsWith('url(') ? null : hex(f) || hex(getComputedStyle(el).fill); };
  const markHex = (el) => { const s = strokeHex(el), f = fillHex(el); return [s, f].find((c) => c && SERIES_HEX.has(c)) || null; };
  function vertexCount(d) { return (d.match(/[MLHVCSQTAZ]/gi) || []).length; }
  const isCurve = (el) => {
    if (el.tagName === 'polyline') return (el.getAttribute('points') || '').trim().split(/\s+/).length >= 3;
    if (el.tagName !== 'path') return false;
    const d = el.getAttribute('d') || '';
    return /[CSQTA]/i.test(d) || vertexCount(d) >= 3;
  };
  const isBg = (el) => el.dataset.role === 'bg' || /url\(#(far|mid|near|bg)/.test(el.getAttribute('fill') || '');
  const texts = () => [...document.querySelectorAll('#overlay .t')].map((el) => ({ el, op: effOpacity(el), box: rect(el) }));
  function panelShapes() {
    return [...document.querySelectorAll('svg [data-panel]')].flatMap((p) => [...p.querySelectorAll(SHAPES)].map((el) => ({ el, panel: el.closest('[data-panel]').dataset.panel })));
  }

  // 1. scene isolation --------------------------------------------------------------
  function sceneLeak(ctx) {
    if (ctx.inTransition || ctx.allowed.includes('*')) return [];
    const out = [];
    for (const { el, panel } of panelShapes()) {
      if (ctx.allowed.includes(panel) || isBg(el)) continue;
      const op = effOpacity(el);
      if (op <= 0.05) continue;
      const r = rect(el);
      if (onFrame(r)) out.push({ rule: 'scene-leak', panel, tag: el.tagName, op: +op.toFixed(2), box: [r.l, r.t, r.r, r.b].map(Math.round) });
    }
    return out;
  }

  // 2. background painted over data -------------------------------------------------
  function bgOverData() {
    const all = [...document.querySelectorAll('svg *')];
    const firstData = all.findIndex((el) => el.closest('[data-panel]') && el.matches(SHAPES) && effOpacity(el) > 0.05);
    if (firstData < 0) return [];
    const dataBoxes = all.slice(firstData).filter((el) => el.closest('[data-panel]') && el.matches(SHAPES) && effOpacity(el) > 0.05).map(rect).filter((r) => onFrame(r));
    const out = [];
    all.forEach((el, i) => {
      if (i <= firstData || !el.matches(SHAPES) || !isBg(el) || effOpacity(el) <= 0.02) return;
      const r = rect(el);
      const covered = dataBoxes.filter((d) => gapBetween(d, r) === 0).length;
      if (covered) out.push({ rule: 'bg-over-data', fill: el.getAttribute('fill'), dataElementsCovered: covered });
    });
    return out;
  }

  // 3. every curve labelled -----------------------------------------------------------
  function unlabelledCurve() {
    const T = texts().filter((x) => x.op > 0.5);
    const out = [];
    for (const { el, panel } of panelShapes()) {
      if (!isCurve(el) || isBg(el)) continue;
      const op = effOpacity(el);
      if (op <= 0.1) continue;
      const r = rect(el);
      if (!onFrame(r, 1) || Math.hypot(r.r - r.l, r.b - r.t) < 80) continue;
      const lab = el.getAttribute('data-label') || el.closest('[data-label]')?.getAttribute('data-label');
      let ok = false;
      if (lab) { const t = T.find((x) => x.el.dataset.tid === lab); ok = !!t && gapBetween(t.box, r) <= 240; }
      else ok = T.some((x) => gapBetween(x.box, r) <= 60);
      if (!ok) out.push({ rule: 'unlabelled-curve', panel, stroke: strokeHex(el), bound: lab || null, box: [r.l, r.t, r.r, r.b].map(Math.round) });
    }
    return out;
  }

  // 4a. level-1 elements visible (aggregated per scene by the runner) ------------------
  function level1Count() { return texts().filter((x) => x.op > 0.5 && x.el.classList.contains('l1') && onFrame(x.box)).length; }

  // 4b. split view: snapshot of leaf elements for a frozen-camera diff ------------------
  // sig = full markup + opacity (any change shows); key = identity that survives growth
  // (tag, colours, anchor point), so a growing bar counts only its new strip, not its whole box
  const keyOf = (el) => {
    const a = (n) => el.getAttribute(n) || '';
    const d = a('d'); const start = d.match(/^M\s*[-\d.]+[ ,][-\d.]+/);
    return [el.tagName, a('fill'), a('stroke'), a('stroke-dasharray'), a('x'), a('y'), a('x1'), a('y1'), start ? start[0] : '', a('data-label')].join('|');
  };
  function snapshot() {
    const out = [];
    for (const { el } of panelShapes()) {
      if (isBg(el)) continue;
      const op = effOpacity(el);
      const r = rect(el);
      if (op <= 0.05 || !onFrame(r, 1)) continue;
      out.push({ sig: el.outerHTML.replace(/\s+data-ev="[^"]*"/g, '') + '|' + op.toFixed(3), key: keyOf(el), box: [r.l, r.t, r.r, r.b] });
    }
    for (const x of texts()) {
      if (x.op <= 0.05 || !onFrame(x.box, 1)) continue;
      out.push({ sig: x.el.outerHTML.replace(/\s+data-ev="[^"]*"/g, '') + '|' + x.op.toFixed(3), key: 'text|' + x.el.dataset.tid, box: [x.box.l, x.box.t, x.box.r, x.box.b] });
    }
    return out;
  }

  // 5. line charts have an axis and two numeric anchors --------------------------------
  function axisAnchors() {
    const T = texts().filter((x) => x.op > 0.5);
    const out = [];
    for (const { el, panel } of panelShapes()) {
      if (el.tagName !== 'path' && el.tagName !== 'polyline') continue;
      const explicit = el.dataset.kind === 'series';
      const d = el.getAttribute('d') || el.getAttribute('points') || '';
      if (!explicit && !(vertexCount(d) >= 10 || d.trim().split(/\s+/).length >= 10) ) continue;
      if (!explicit && !markHex(el)) continue;
      const op = effOpacity(el);
      const r = rect(el);
      if (op <= 0.3 || !onFrame(r) || Math.hypot(r.r - r.l, r.b - r.t) < 120) continue;
      const chart = el.dataset.chart || el.closest('[data-chart]')?.dataset.chart || null;
      const axes = [...document.querySelectorAll('svg line, svg path')].filter((a) => {
        if (a === el || effOpacity(a) <= 0.3) return false;
        if (chart && a.dataset.kind === 'axis') return a.dataset.chart === chart;
        const s = strokeHex(a);
        return !chart && (s === TOK.grid.toLowerCase() || s === TOK.muted.toLowerCase()) && gapBetween(rect(a), inflate(r, 60)) === 0;
      });
      const anchors = T.filter((x) => (chart && x.el.dataset.anchor === chart) || (!chart && x.el.querySelector('.n') && gapBetween(x.box, r) <= 120));
      if (!axes.length || anchors.length < 2) out.push({ rule: 'axis-anchors', panel, chart, axes: axes.length, anchors: anchors.length });
    }
    return out;
  }

  // 6. emphasis survives grey scale ------------------------------------------------------
  function textColour(el, minSize) {
    // colour of the largest text run inside el (claim spans first)
    let best = null, bestSize = 0;
    for (const x of [el, ...el.querySelectorAll('*')]) {
      if (![...x.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue;
      const cs = getComputedStyle(x), size = parseFloat(cs.fontSize);
      if (size >= (minSize || 0) && size > bestSize) { best = hex(cs.color); bestSize = size; }
    }
    return { colour: best, size: bestSize };
  }
  function greyEmphasis() {
    const T = texts().filter((x) => x.op > 0.5 && onFrame(x.box));
    const bgL = lum(TOK.bg.toLowerCase());
    const emph = T.filter((x) => x.el.classList.contains('l1') || x.el.hasAttribute('data-emph'));
    const out = [];
    for (const e of emph) {
      const { colour } = textColour(e.el);
      if (!colour) continue;
      const L = lum(colour), cr = contrast(L, bgL);
      if (cr < 7) out.push({ rule: 'grey-emphasis', tid: e.el.dataset.tid, colour, contrast: +cr.toFixed(2), why: 'emphasis below 7:1 against bg in grey' });
      for (const o of T) {
        if (emph.includes(o)) continue;
        const oc = textColour(o.el, 48);
        if (!oc.colour || oc.size < 48) continue;
        if (lum(oc.colour) > L + 1e-6) out.push({ rule: 'grey-emphasis', tid: e.el.dataset.tid, colour, brighter: o.el.dataset.tid, brighterColour: oc.colour, why: 'a 48 px+ non-emphasis text is brighter in grey' });
      }
    }
    return out;
  }

  // 7. number colour = colour of the series it annotates -----------------------------------
  function numberColour() {
    const marks = panelShapes().filter(({ el }) => !isBg(el) && effOpacity(el) > 0.3).map(({ el }) => ({ el, c: markHex(el), box: rect(el) })).filter((m) => m.c && onFrame(m.box, 1));
    const out = [];
    for (const sp of document.querySelectorAll('#overlay .n')) {
      const t = sp.closest('.t');
      if (!t || effOpacity(sp) <= 0.5) continue;
      const c = hex(getComputedStyle(sp).color);
      if (!c || !SERIES_HEX.has(c)) continue; // neutral numbers (ink, muted) are always allowed
      const box = rect(sp);
      if (!onFrame(box)) continue;
      const ser = t.dataset.series || sp.dataset.series;
      let want = null, via = null;
      if (ser && SERIES_OF[ser]) { want = SERIES_OF[ser].toLowerCase(); via = 'data-series ' + ser; }
      else {
        let best = null, bd = 150;
        for (const m of marks) { const g = gapBetween(m.box, box); if (g < bd) { bd = g; best = m; } }
        if (best) { want = best.c; via = `nearest mark (${best.el.tagName}, ${Math.round(bd)} px)`; }
      }
      if (want && want !== c) out.push({ rule: 'number-colour', claim: sp.dataset.claim, colour: c, seriesColour: want, via });
    }
    return out;
  }

  function checkFrame(ctx) {
    return [...sceneLeak(ctx), ...bgOverData(), ...unlabelledCurve(), ...axisAnchors(), ...greyEmphasis(), ...numberColour()];
  }
  window.RULES = { checkFrame, level1Count, snapshot, effOpacity, sceneLeak, bgOverData, unlabelledCurve, axisAnchors, greyEmphasis, numberColour, TOK };
})();
