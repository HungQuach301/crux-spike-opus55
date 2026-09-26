/* Adapter: exposes the test-D page contract (window.CHECKS, checks/CONTRACT.md §Page) over test C's rendered DOM.
 * Uses only what test C documented for its rule engine (render-av/rules.js header): #overlay .t texts with data-tid,
 * .n spans with data-claim, .badge, classes l1/l2/l3, data-panel/-kind/-chart/-anchor/-label/-series/-emph/-role,
 * bars with data-value/-full/-orient; window.SEG.renderFrame(t) and SEG.freezeAt(t). It does not change what C draws. */
(function () {
  const SHAPES = 'rect,circle,ellipse,line,path,polyline,polygon';
  const hex = (c) => {
    if (!c || c === 'none') return null;
    if (c.startsWith('#')) return c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('').toLowerCase() : c.toLowerCase();
    if (c.startsWith('url(')) return c;
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
    return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('');
  };
  function effOpacity(el) {
    let op = 1, e = el;
    while (e && e.nodeType === 1) {
      const a = e.getAttribute && e.getAttribute('opacity');
      if (a !== null && a !== '' && a !== undefined) op *= parseFloat(a);
      if (e.style && e.style.opacity !== '') op *= parseFloat(e.style.opacity);
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
      e = e.parentElement;
    }
    return op;
  }
  const rect = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const vertexCount = (d) => (d.match(/[MLHVCSQTAZ]/gi) || []).length;
  const isCurve = (el) => {
    if (el.tagName === 'polyline') return (el.getAttribute('points') || '').trim().split(/\s+/).length >= 3;
    if (el.tagName !== 'path') return false;
    const d = el.getAttribute('d') || '';
    return /[CSQTA]/i.test(d) || vertexCount(d) >= 3;
  };
  const isBg = (el) => el.dataset.role === 'bg' || /url\(#(far|mid|near|bg)/.test(el.getAttribute('fill') || '');
  const SERIES = new Set(['#4c8dff', '#f2b441', '#3fbf7f', '#e5484d']);
  const SURFACE = new Set(['#0e1116', '#171b22']); // a filled shape in bg/surface colour without a stroke is a card (a panel text sits on)
  const keyOf = (el) => {
    const a = (n) => el.getAttribute(n) || '';
    const d = a('d'); const start = d.match(/^M\s*[-\d.]+[ ,][-\d.]+/);
    return [el.tagName, a('fill'), a('stroke'), a('stroke-dasharray'), a('x'), a('y'), a('x1'), a('y1'), start ? start[0] : '', a('data-label')].join('|');
  };
  function runs(el) {
    const out = [];
    for (const x of [el, ...el.querySelectorAll('*')]) {
      if (![...x.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim())) continue;
      const cs = getComputedStyle(x);
      out.push({ color: hex(cs.color), size: parseFloat(cs.fontSize), weight: cs.fontWeight });
    }
    return out;
  }
  let tagged = [];
  function objects() {
    const out = [];
    let z = 0;
    // shapes in paint order (SVG first: the overlay sits above it)
    for (const el of document.querySelectorAll('svg ' + SHAPES.split(',').join(', svg '))) {
      if (el.closest('defs,pattern,clipPath,mask,marker')) continue;
      const p = el.closest('[data-panel]');
      const kind = el.dataset.kind;
      const stroke = hex(el.getAttribute('stroke') || getComputedStyle(el).stroke);
      const fillA = el.getAttribute('fill');
      const fill = el.tagName === 'line' ? null : fillA && fillA.startsWith('url(') ? fillA : hex(fillA || getComputedStyle(el).fill); // a <line> paints no fill
      let role = isBg(el) ? 'bg' : kind || null;
      if (!role) role = stroke ? 'line' : fill && SURFACE.has(fill) ? 'card' : 'mark';
      const d = el.getAttribute('d') || el.getAttribute('points') || '';
      const o = { id: 'S' + z, z: z++, kind: 'shape', tag: el.tagName, role, panel: p ? p.dataset.panel : null, chart: el.dataset.chart || el.closest('[data-chart]')?.dataset.chart || null,
        label: el.getAttribute('data-label') || el.closest('[data-label]')?.getAttribute('data-label') || null, series: el.dataset.series || null,
        value: el.dataset.value ?? null, full: el.dataset.full === '1', orient: el.dataset.orient || null, char: el.dataset.char || null, shape: el.dataset.shape || null,
        year: el.dataset.year ?? null, stroke, fill, opacity: effOpacity(el), box: rect(el), curve: isCurve(el), vertices: Math.max(vertexCount(d), d.trim() ? d.trim().split(/\s+/).length : 0),
        key: keyOf(el), sig: el.outerHTML.replace(/\s+data-ev="[^"]*"/g, '') };
      el.dataset.kid = o.id;
      out.push(o);
    }
    for (const el of document.querySelectorAll('#overlay .t, #overlay .badge')) {
      const parent = el.parentElement && el.parentElement.closest('#overlay .t');
      const rs = runs(el);
      const big = rs.slice().sort((a, b) => b.size - a.size)[0];
      const cs = getComputedStyle(el);
      const o = { id: 'T' + z, z: z++, kind: 'text', tid: el.dataset.tid || null, role: el.classList.contains('badge') ? 'badge' : el.dataset.anchor ? 'axis-label' : 'label',
        parent: parent ? parent.dataset.kid || null : null, text: el.textContent.replace(/\s+/g, ' ').trim(), box: rect(el), opacity: effOpacity(el),
        level: el.classList.contains('l1') ? 1 : el.classList.contains('l2') || el.classList.contains('l2b') ? 2 : el.classList.contains('l3') || el.classList.contains('l3s') ? 3 : null,
        emph: el.hasAttribute('data-emph'), series: el.dataset.series || null, anchor: el.dataset.anchor || null, chart: el.dataset.anchor || null, year: el.dataset.year ?? null,
        char: el.dataset.char || null, runs: rs, color: big ? big.color : null, fontPx: rs.length ? Math.min(...rs.map((r) => r.size)) : null, background: hex(cs.backgroundColor),
        claims: [...el.querySelectorAll('.n[data-claim]')].map((sp) => ({ id: sp.dataset.claim, text: sp.textContent.trim(), box: rect(sp), opacity: effOpacity(sp),
          color: hex(getComputedStyle(sp).color), series: sp.dataset.series || null, roll: sp.hasAttribute('data-roll') })),
        key: 'text|' + el.dataset.tid, sig: el.outerHTML.replace(/\s+data-ev="[^"]*"/g, '') };
      el.dataset.kid = o.id;
      out.push(o);
    }
    return out;
  }
  const css = document.createElement('style');
  css.textContent = `
    html.k-layer, html.k-layer body { background: transparent !important; }
    html.k-layer *:not(.t):not(.t *):not(.badge):not(.badge *) { background: transparent !important; box-shadow: none !important; }
    html.k-text * { visibility: hidden !important; }
    html.k-text #overlay .t, html.k-text #overlay .t *, html.k-text #overlay .badge, html.k-text #overlay .badge * { visibility: visible !important; }
    html.k-glyph * { visibility: hidden !important; }
    html.k-glyph #overlay .t, html.k-glyph #overlay .t *, html.k-glyph #overlay .badge, html.k-glyph #overlay .badge * { visibility: visible !important; background: transparent !important; border-color: transparent !important; box-shadow: none !important; }
    html.k-gfx #overlay .t, html.k-gfx #overlay .badge { visibility: hidden !important; }
    html.k-gfx [data-kl="bg"] { visibility: hidden !important; }
    html.k-gfx [data-kl="card"] { fill: none !important; }
    html.k-only * { visibility: hidden !important; }
    html.k-only [data-kl="only"], html.k-only [data-kl="only"] * { visibility: visible !important; }
    html.k-notext #overlay .t, html.k-notext #overlay .badge { visibility: hidden !important; }`;
  document.head.appendChild(css);
  function clearTags() { for (const el of tagged) el.removeAttribute('data-kl'); tagged = []; }
  function layer(name, ids) {
    const h = document.documentElement;
    h.className = h.className.replace(/\bk-\S+/g, '').trim();
    clearTags();
    if (name === 'all') return;
    if (name === 'notext') { h.classList.add('k-notext'); return; }
    h.classList.add('k-layer', 'k-' + (name === 'graphics' ? 'gfx' : name));
    if (name === 'graphics') {
      for (const el of document.querySelectorAll('svg ' + SHAPES.split(',').join(', svg '))) {
        const k = isBg(el) ? 'bg' : el.dataset.kind ? null : (hex(el.getAttribute('stroke') || getComputedStyle(el).stroke) ? null : SURFACE.has(hex(el.getAttribute('fill') || getComputedStyle(el).fill) || '') ? 'card' : null);
        if (k) { el.setAttribute('data-kl', k); tagged.push(el); }
      }
    }
    if (name === 'only') for (const id of ids) { const el = document.querySelector(`[data-kid="${id}"]`); if (el) { el.setAttribute('data-kl', 'only'); tagged.push(el); } }
  }
  window.CHECKS = {
    seek: (t) => window.SEG.renderFrame(t),
    freeze: (t) => window.SEG.freezeAt(t),
    objects,
    layer,
  };
})();
