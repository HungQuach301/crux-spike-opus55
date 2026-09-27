'use strict';
// Test D production engine (Chromium). A perspective camera over a 3D world; the scene builders (scenes.js) return a
// list of items per instant: world shapes (projected per vertex, grouped by depth, blurred by their circle of confusion)
// and screen-space text (HUD, always sharp, drawn last). Every drawn item is also reported as a contract object
// (checks/CONTRACT.md §Page) with its screen box, so objects() is exactly what was painted.
// Motion blur: N subframes over a 180° shutter, float accumulation, one triangular-dither quantisation.
(function () {
  const W = 1920, H = 1080;
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function camera(c) {
    const fwd = norm(sub3(c.target, c.pos));
    const right = norm(cross([0, 1, 0], fwd));
    const down = cross(fwd, right);
    const fpx = (H / 2) / Math.tan((c.fovDeg * Math.PI / 180) / 2);
    const cam = { ...c, fwd, right, down, fpx };
    cam.depth = (p) => dot(sub3(p, c.pos), fwd);
    cam.project = (p) => {
      const d = sub3(p, c.pos);
      const z = Math.max(1e-3, dot(d, fwd));
      const s = fpx / z;
      return [W / 2 + dot(d, right) * s, H / 2 + dot(d, down) * s, s, z];
    };
    cam.coc = (z) => (z <= 0 ? 0 : c.aperture * fpx * Math.abs(z - c.focusDist) / (z * c.focusDist));
    return cam;
  }

  // ---- canvases --------------------------------------------------------------------------------
  const pool = [];
  function layerCanvas(scale) {
    let c = pool.find((x) => !x.busy && x.scale === scale);
    if (!c) { const el = document.createElement('canvas'); el.width = Math.round(W * scale); el.height = Math.round(H * scale); c = { el, ctx: el.getContext('2d'), scale }; pool.push(c); }
    c.busy = true;
    c.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    c.ctx.clearRect(0, 0, W, H);
    return c;
  }
  const release = (c) => { c.busy = false; };

  // ---- mode filter for CHECKS.layer ------------------------------------------------------------
  // all | text | glyph | graphics | only | notext
  const MODE = { name: 'all', ids: null };
  const paintShape = (o) => {
    if (MODE.name === 'all' || MODE.name === 'notext') return { fill: true, stroke: true };
    if (MODE.name === 'graphics') return o.role === 'bg' ? null : { fill: o.role !== 'card', stroke: true };
    if (MODE.name === 'only') return MODE.ids.has(o.id) ? { fill: true, stroke: true } : null;
    return null;
  };
  const paintText = (o) => {
    if (MODE.name === 'all' || MODE.name === 'text') return { glyph: true, pill: true };
    if (MODE.name === 'glyph') return { glyph: true, pill: false };
    if (MODE.name === 'only') return MODE.ids.has(o.id) ? { glyph: true, pill: true } : null;
    return null;
  };

  // ---- shape drawing ---------------------------------------------------------------------------
  // item: {kind:'shape', id, z, geo:'poly'|'rect'|'circle'|'ring'|'polyline', pts (world [x,y] at plane z) | rect [x,y,w,h] | c [x,y], r, r2, a0, a1,
  //        fill, stroke, lw, dash, alpha, shadow, gradient:{type, stops:[[t,hex,alpha]], ...}, meta:{role, panel, chart, char, shape, ...}}
  function tracePath(ctx, cam, it, bb) {
    const P = (x, y, z) => { const p = cam.project([x, y, z ?? it.z]); bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.min(bb[1], p[1]); bb[2] = Math.max(bb[2], p[0]); bb[3] = Math.max(bb[3], p[1]); return p; };
    ctx.beginPath();
    let scale = 1;
    if (it.geo === 'rect') {
      const [x, y, w, h] = it.rect;
      const a = P(x, y), b = P(x + w, y), c = P(x + w, y + h), d = P(x, y + h);
      scale = a[2];
      if (it.radius) {
        const r = it.radius * a[2];
        ctx.roundRect(a[0], a[1], c[0] - a[0], c[1] - a[1], r);
      } else { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); }
    } else if (it.geo === 'circle' || it.geo === 'ring' || it.geo === 'arc') {
      const c = P(it.c[0], it.c[1]);
      const e1 = P(it.c[0] + it.r, it.c[1]); const e2 = P(it.c[0], it.c[1] + it.r);
      P(it.c[0] - it.r, it.c[1]); P(it.c[0], it.c[1] - it.r);
      scale = c[2];
      const rx = Math.hypot(e1[0] - c[0], e1[1] - c[1]), ry = Math.hypot(e2[0] - c[0], e2[1] - c[1]);
      const a0 = it.a0 ?? 0, a1 = it.a1 ?? Math.PI * 2;
      if (it.geo === 'circle') ctx.ellipse(c[0], c[1], rx, ry, 0, a0, a1);
      else if (it.geo === 'arc') ctx.ellipse(c[0], c[1], rx, ry, 0, a0, a1);
      else { ctx.ellipse(c[0], c[1], rx, ry, 0, a0, a1); const k = it.r2 / it.r; ctx.ellipse(c[0], c[1], rx * k, ry * k, 0, a1, a0, true); ctx.closePath(); }
    } else {
      it.pts.forEach((q, i) => { const p = P(q[0], q[1], q[2]); if (!i) scale = p[2]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      if (it.geo === 'poly') ctx.closePath();
    }
    return scale;
  }
  function drawShape(ctx, cam, it, objs, coc) {
    const bb = [Infinity, Infinity, -Infinity, -Infinity];
    const paint = paintShape(it.meta);
    const target = paint ? ctx : DUMMY;
    target.save();
    const scale = tracePath(target, cam, it, bb);
    const a = it.alpha ?? 1;
    target.globalAlpha = a;
    const lw = (it.lw || 0) * (it.screenLw ? 1 : scale);
    if (it.fill && (!paint || paint.fill)) {
      if (it.shadow && MODE.name === 'all') { target.shadowColor = 'rgba(0,0,0,' + it.shadow.alpha + ')'; target.shadowBlur = it.shadow.blur * scale; target.shadowOffsetY = it.shadow.dy * scale; }
      if (it.gradient) {
        const g = it.gradient;
        const gr = g.type === 'radial' ? target.createRadialGradient(bbc(bb)[0], bbc(bb)[1], 0, bbc(bb)[0], bbc(bb)[1], Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2)
          : target.createLinearGradient(0, bb[1], 0, bb[3]);
        for (const [s, hex, al] of g.stops) gr.addColorStop(s, rgba(hex, al));
        target.fillStyle = gr;
      } else target.fillStyle = it.fill;
      target.fill();
      target.shadowColor = 'transparent';
    }
    if (it.stroke && lw > 0 && (!paint || paint.stroke)) {
      target.lineWidth = lw; target.strokeStyle = it.stroke; target.lineJoin = 'round'; target.lineCap = it.cap || 'round';
      if (it.dash) target.setLineDash(it.dash.map((d) => d * scale));
      target.stroke();
      target.setLineDash([]);
    }
    target.restore();
    const pad = it.stroke && lw > 0 ? lw / 2 : 0;
    const box = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
    if (it.meta && !it.noRecord) {
      objs.push({ id: it.id, kind: 'shape', tag: it.geo, fill: it.gradient ? 'url(#' + it.id + ')' : (it.fill || null), stroke: it.stroke || null, opacity: a, box, coc: +coc.toFixed(2),
        curve: !!it.curve, vertices: it.pts ? it.pts.length : 4, key: it.key || it.id, sig: it.id + '|' + box.map((v) => v.toFixed(1)).join(','), ...it.meta });
    }
    return bb;
  }
  const DUMMY = document.createElement('canvas').getContext('2d');
  const bbc = (bb) => [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---- text (HUD) ------------------------------------------------------------------------------
  // item: {kind:'text', id, tid, text, x, y (screen px, baseline), size, weight, color, align, alpha, role, level, emph, series, anchor, chart, year, char,
  //        claims:[{id, text, roll?}], background (token hex: pill), pad}
  const measureCtx = document.createElement('canvas').getContext('2d');
  function textBox(it) {
    measureCtx.font = `${it.weight || 600} ${it.size}px Inter`;
    const m = measureCtx.measureText(it.text);
    const w = m.width;
    const x0 = it.align === 'center' ? it.x - w / 2 : it.align === 'right' ? it.x - w : it.x;
    const asc = it.size * 0.74, desc = it.size * 0.2; // Inter cap height ~0.73 em; descender ~0.2 em
    return { x0, w, box: [x0, it.y - asc, x0 + w, it.y + desc], m };
  }
  function drawText(ctx, it, objs) {
    const a = it.alpha ?? 1;
    const tb = textBox(it);
    let box = tb.box;
    const paint = paintText(it);
    const pad = it.pad ?? 14;
    if (it.background) box = [box[0] - pad, box[1] - pad * 0.7, box[2] + pad, box[3] + pad * 0.7];
    if (paint && a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      if (it.background && paint.pill) { ctx.fillStyle = it.background; ctx.beginPath(); ctx.roundRect(box[0], box[1], box[2] - box[0], box[3] - box[1], (box[3] - box[1]) / 2); ctx.fill(); }
      if (paint.glyph) { ctx.font = `${it.weight || 600} ${it.size}px Inter`; ctx.fillStyle = it.color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(it.text, tb.x0, it.y); }
      ctx.restore();
    }
    const claims = (it.claims || []).map((c) => {
      const i = it.text.indexOf(c.text);
      measureCtx.font = `${it.weight || 600} ${it.size}px Inter`;
      const x0 = tb.x0 + measureCtx.measureText(it.text.slice(0, Math.max(0, i))).width, w = measureCtx.measureText(c.text).width;
      return { id: c.id, text: c.text, box: [x0, tb.box[1], x0 + w, tb.box[3]], opacity: a, color: it.color, series: it.series || null, roll: !!c.roll };
    });
    objs.push({ id: it.id, kind: 'text', tid: it.tid || it.id, role: it.role || 'label', text: it.text, box, opacity: a, level: it.level ?? null, emph: !!it.emph,
      series: it.series || null, anchor: it.anchor || null, chart: it.chart || null, year: it.year ?? null, char: it.char || null, runs: [{ color: it.color, size: it.size }],
      color: it.color, fontPx: it.size, background: it.background || null, parent: it.parent || null, claims, key: it.tid || it.id,
      sig: (it.tid || it.id) + '|' + it.text + '|' + box.map((v) => v.toFixed(1)).join(',') });
  }

  // ---- one subframe ----------------------------------------------------------------------------
  // frameState: {camera, bg:{color, glows:[...]}, items:[...]}
  function drawSubframe(ctx, state, opts) {
    const cam = camera(state.camera);
    const objs = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none';
    if (MODE.name === 'all' || MODE.name === 'notext') { ctx.fillStyle = state.bg.color; ctx.fillRect(0, 0, W, H); }
    else ctx.clearRect(0, 0, W, H);
    objs.push({ id: 'bg', kind: 'shape', tag: 'rect', role: 'bg', fill: state.bg.color, stroke: null, opacity: 1, box: [0, 0, W, H], key: 'bg', sig: 'bg' });
    // world shapes grouped by depth (the item's z plane), far to near
    const groups = new Map();
    for (const it of state.items) if (it.kind === 'shape') { const k = it.layer || it.z; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    const layers = [...groups.entries()].map(([k, its]) => ({ its, cz: cam.depth([cam.target[0], cam.target[1], its[0].z]) })).filter((l) => l.cz > 5).sort((a, b) => b.cz - a.cz);
    for (const l of layers) {
      const coc = opts.dof === false ? 0 : cam.coc(l.cz);
      const sigma = coc * 0.42;
      const k = sigma > 1.6 ? 0.5 : 1;
      const lc = layerCanvas(k);
      const bb = [Infinity, Infinity, -Infinity, -Infinity];
      for (const it of l.its) { const b = drawShape(lc.ctx, cam, it, objs, coc); bb[0] = Math.min(bb[0], b[0]); bb[1] = Math.min(bb[1], b[1]); bb[2] = Math.max(bb[2], b[2]); bb[3] = Math.max(bb[3], b[3]); }
      const pad = Math.ceil(3 * sigma + 60);
      const x0 = Math.max(0, Math.floor(bb[0] - pad)), y0 = Math.max(0, Math.floor(bb[1] - pad)), x1 = Math.min(W, Math.ceil(bb[2] + pad)), y1 = Math.min(H, Math.ceil(bb[3] + pad));
      if (x1 > x0 && y1 > y0) {
        const sx = Math.floor(x0 * k), sy = Math.floor(y0 * k), sw = Math.ceil((x1 - x0) * k), sh = Math.ceil((y1 - y0) * k);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (sigma > 0.35) {
          const tmp = layerCanvas(k);
          tmp.ctx.setTransform(1, 0, 0, 1, 0, 0);
          tmp.ctx.filter = `blur(${(sigma * k).toFixed(2)}px)`;
          tmp.ctx.drawImage(lc.el, sx, sy, sw, sh, sx, sy, sw, sh);
          tmp.ctx.filter = 'none';
          ctx.drawImage(tmp.el, sx, sy, sw, sh, sx / k, sy / k, sw / k, sh / k);
          release(tmp);
        } else ctx.drawImage(lc.el, sx, sy, sw, sh, sx / k, sy / k, sw / k, sh / k);
        ctx.restore();
      }
      release(lc);
    }
    // HUD text last (sharp); texts flagged `sharp` are left out of the moving subframes and drawn once, at the exposure
    // midpoint, over the accumulated frame (labels that ride a moving chart stay legible instead of smearing)
    for (const it of state.items) if (it.kind === 'text' && !(opts.skipSharp && it.sharp)) drawText(ctx, it, objs);
    return { cam, objs };
  }

  const main = document.createElement('canvas'); main.width = W; main.height = H;
  main.style.cssText = 'position:absolute;left:0;top:0';
  const mctx = main.getContext('2d', { willReadFrequently: true });
  const acc = new Float32Array(W * H * 4);
  let seed = 1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // full frame at time t: stateAt(t) -> frameState; N subframes centred on t when anything moves
  function frame(stateAt, t, opts = {}) {
    const N = opts.subframes || 8, shutter = 0.5, fps = 30;
    const times = Array.from({ length: N }, (_, k) => t + ((k + 0.5) / N - 0.5) * shutter / fps);
    const states = times.map((x) => stateAt(x));
    // a frame is still when nothing changes but the camera's slow creep (< 1 world px across the shutter, far below a
    // pixel on screen): motion blur would be invisible, so the centre instant is drawn once
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const s0 = states[0], s1 = states[N - 1];
    const still = states.every((s) => s.sig === s0.sig) && d3(s0.camera.pos, s1.camera.pos) < 1 && d3(s0.camera.target, s1.camera.target) < 1 && Math.abs(s0.camera.focusDist - s1.camera.focusDist) < 2;
    const centre = stateAt(t);
    if (N === 1 || still || MODE.name !== 'all') {
      const r = drawSubframe(mctx, centre, opts);
      if (MODE.name === 'all' && opts.dither !== false) {
        // same triangular dither as the accumulated frames (no banding on dark gradients)
        const img = mctx.getImageData(0, 0, W, H), o = img.data;
        seed = 12345 + Math.round(t * 30);
        for (let i = 0; i < o.length; i += 4) { const d = rnd() - rnd(); o[i] += d; o[i + 1] += d; o[i + 2] += d; }
        mctx.putImageData(img, 0, 0);
      }
      return { objs: r.objs, cam: r.cam, rendered: 1 };
    }
    acc.fill(0);
    for (let k = 0; k < N; k++) {
      drawSubframe(mctx, states[k], { ...opts, skipSharp: true });
      const d = mctx.getImageData(0, 0, W, H).data;
      for (let i = 0; i < d.length; i++) acc[i] += d[i];
    }
    const img = mctx.createImageData(W, H);
    const o = img.data, inv = 1 / N;
    seed = 12345 + Math.round(t * 30);
    for (let i = 0; i < o.length; i += 4) {
      const dth = rnd() - rnd();
      o[i] = acc[i] * inv + dth + 0.5; o[i + 1] = acc[i + 1] * inv + dth + 0.5; o[i + 2] = acc[i + 2] * inv + dth + 0.5; o[i + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.globalAlpha = 1; mctx.filter = 'none';
    for (const it of centre.items) if (it.kind === 'text' && it.sharp) drawText(mctx, it, []);
    // objects of the centre instant (the exposure midpoint)
    const tmp = layerCanvas(1);
    const r = drawSubframe(tmp.ctx, centre, opts);
    release(tmp);
    return { objs: r.objs, cam: r.cam, rendered: N };
  }
  function rgbaB64() {
    const u8 = mctx.getImageData(0, 0, W, H).data;
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  window.ENGINE = { W, H, camera, frame, rgbaB64, MODE, canvas: main, textBox };
})();
