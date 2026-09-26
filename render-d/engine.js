'use strict';
// Test D picture engine (runs in Chromium). A perspective camera over a 3D world of flat layers.
// World axes: x right, y down, z away from the viewer. Every drawable lives on a layer at one depth
// (z); the floor is split into depth bands. Each layer is drawn into its own canvas with every vertex
// projected through the camera, then composited far → near with a Gaussian blur whose size is the
// layer's circle of confusion (thin lens). Motion blur = temporal supersampling: N subframes across a
// 180° shutter, averaged in float, quantized once with triangular dither (no banding on dark gradients).
(function () {
  const W = 1920, H = 1080;
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };

  // Camera: {pos, target, fovDeg (vertical), focusDist, aperture (world units)}
  function camera(c) {
    const fwd = V.norm(V.sub(c.target, c.pos));
    const right = V.norm(V.cross([0, 1, 0], fwd));
    const down = V.cross(fwd, right);
    const fpx = (H / 2) / Math.tan((c.fovDeg * Math.PI / 180) / 2);
    const cam = { ...c, fwd, right, down, fpx };
    cam.depth = (p) => V.dot(V.sub(p, c.pos), fwd);
    cam.project = (p) => {
      const d = V.sub(p, c.pos);
      const z = V.dot(d, fwd);
      const s = fpx / z;
      return [W / 2 + V.dot(d, right) * s, H / 2 + V.dot(d, down) * s, s, z];
    };
    // background circle of confusion (px) of a point at camera depth z
    cam.coc = (z) => (z <= 0 ? 0 : c.aperture * fpx * Math.abs(z - c.focusDist) / (z * c.focusDist));
    return cam;
  }

  // ---- canvas pool ---------------------------------------------------------------------------
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

  // ---- one subframe --------------------------------------------------------------------------
  // world(t) -> {camera, bg(ctx) (screen-space backdrop), layers:[{id, z, draw(ctx, cam, rec)}]}
  // draw() receives the camera; it must draw with projected coordinates. rec(obj) records a screen object.
  function drawSubframe(ctx, world, t, opts) {
    const w = world(t);
    const cam = camera(w.camera);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none';
    w.bg(ctx, cam);
    const layers = w.layers.map((l) => ({ ...l, cz: cam.depth([l.x || 0, l.y || 0, l.z]) })).filter((l) => l.cz > 1)
      .sort((a, b) => b.cz - a.cz);
    const objs = [];
    for (const l of layers) {
      const coc = opts.dof === false ? 0 : cam.coc(l.cz);
      const sigma = coc * 0.42; // Gaussian sigma matching a disc of diameter coc (energy-equivalent)
      const half = sigma > 1.6;
      const lc = layerCanvas(half ? 0.5 : 1);
      // bounding box of what the layer draws: every projected point, plus explicit marks (text extents)
      const bb = [Infinity, Infinity, -Infinity, -Infinity];
      const grow = (x0, y0, x1, y1) => { if (x0 < bb[0]) bb[0] = x0; if (y0 < bb[1]) bb[1] = y0; if (x1 > bb[2]) bb[2] = x1; if (y1 > bb[3]) bb[3] = y1; };
      const lcam = Object.assign(Object.create(cam), {
        project: (p) => { const r = cam.project(p); grow(r[0], r[1], r[0], r[1]); return r; },
        mark: grow,
      });
      l.draw(lc.ctx, lcam, (o) => objs.push({ ...o, layer: l.id, coc }));
      const pad = Math.ceil(3 * sigma + (l.pad || 48));
      const x0 = Math.max(0, Math.floor(bb[0] - pad)), y0 = Math.max(0, Math.floor(bb[1] - pad));
      const x1 = Math.min(W, Math.ceil(bb[2] + pad)), y1 = Math.min(H, Math.ceil(bb[3] + pad));
      if (x1 > x0 && y1 > y0) {
        const k = lc.scale;
        const sx = Math.floor(x0 * k), sy = Math.floor(y0 * k), sw = Math.ceil((x1 - x0) * k), sh = Math.ceil((y1 - y0) * k);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (sigma > 0.35) {
          const tmp = layerCanvas(k);
          tmp.ctx.setTransform(1, 0, 0, 1, 0, 0);
          tmp.ctx.filter = `blur(${(sigma * k).toFixed(2)}px)`;
          tmp.ctx.drawImage(lc.el, sx, sy, sw, sh, sx, sy, sw, sh);
          tmp.ctx.filter = 'none';
          ctx.drawImage(tmp.el, sx, sy, sw, sh, sx / k, sy / k, sw / k, sh / k);
          release(tmp);
        } else {
          ctx.drawImage(lc.el, sx, sy, sw, sh, sx / k, sy / k, sw / k, sh / k);
        }
        ctx.restore();
      }
      release(lc);
    }
    return { cam, objs, sig: w.sig };
  }

  // ---- temporal supersampling -----------------------------------------------------------------
  const main = document.createElement('canvas'); main.width = W; main.height = H;
  const mctx = main.getContext('2d', { willReadFrequently: true });
  const acc = new Float32Array(W * H * 4);
  let seed = 1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  // frame at time t (seconds): N subframes over a shutter of `shutter` × frame interval, centred on t
  function frame(world, t, opts = {}) {
    const N = opts.subframes || 8, shutter = opts.shutter ?? 0.5, fps = opts.fps || 30;
    const times = Array.from({ length: N }, (_, k) => t + ((k + 0.5) / N - 0.5) * shutter / fps);
    // static frame: every subframe state identical -> one render is exactly their average
    const sigs = opts.forceAll ? null : times.map((x) => world(x).sig);
    const still = sigs && sigs.every((s) => s !== undefined && s === sigs[0]);
    let info;
    if (N === 1 || still) {
      info = drawSubframe(mctx, world, t, opts);
      const img = mctx.getImageData(0, 0, W, H);
      return { img, info, rendered: 1 };
    }
    acc.fill(0);
    for (let k = 0; k < N; k++) {
      const r = drawSubframe(mctx, world, times[k], opts);
      if (k === N >> 1) info = r;
      const d = mctx.getImageData(0, 0, W, H).data;
      for (let i = 0; i < d.length; i++) acc[i] += d[i];
    }
    const img = mctx.createImageData(W, H);
    const o = img.data, inv = 1 / N;
    seed = 12345 + Math.round(t * 30);
    for (let i = 0; i < o.length; i += 4) {
      const dth = rnd() - rnd(); // triangular dither, ±1 code
      o[i] = acc[i] * inv + dth + 0.5; o[i + 1] = acc[i + 1] * inv + dth + 0.5; o[i + 2] = acc[i + 2] * inv + dth + 0.5; o[i + 3] = 255;
    }
    return { img, info, rendered: N };
  }

  // base64 of the RGBA buffer (fast path to the Node encoder)
  function b64(u8) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }

  window.ENGINE = { W, H, V, camera, frame, b64, display: main };
})();
