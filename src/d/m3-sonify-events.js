'use strict';
// Test D M3 round 3 (H7a): data events for the sonification, read frame by frame from the render page's own scene
// state (RENDER.stateAt: the builders, no drawing), so every sound starts on the frame its element changes.
//   node src/d/m3-sonify-events.js out/m3/root   -> <root>/out/sonify-events.json
// Events: bar (a bar grows: start/end frame, value, chart), line (a series is drawn: per-frame tip slope and height),
// dot (a circle mark appears: frame, screen y), tick (a number text changes: frame). Appearances on the first frame of a
// scene (things that are simply there at the cut) are not events.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.argv[2] || 'out/m3/root');
const PAGE = path.join(__dirname, '..', '..', 'render-d', 'prod', 'page.html');
const FPS = 30;

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'timeline.json'), 'utf8'));
  const N = Math.round(tl.total * FPS);
  const browser = await chromium.launch({ args: ['--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + PAGE);
  await page.waitForFunction(() => window.RENDER && window.DATA);
  await page.evaluate(() => { window.__SON = { prev: {}, scene: null, bars: {}, out: { bar: [], line: [], dot: [], tick: [] } }; });
  const t0 = Date.now();
  for (let a = 0; a < N; a += 600) {
    const b = Math.min(N, a + 600);
    await page.evaluate(([a, b, FPS]) => {
      const S = window.__SON, R = window.RENDER, E = window.ENGINE;
      for (let f = a; f < b; f++) {
        const t = f / FPS, st = R.stateAt(t), cam = E.camera(st.camera);
        const fresh = st.scene !== S.scene; // first frame of a scene
        if (fresh) { for (const [id, g] of Object.entries(S.bars)) S.out.bar.push({ ...g, f1: f }); S.bars = {}; S.prev = {}; S.scene = st.scene; }
        const cur = {};
        for (const it of st.items) {
          const m = it.meta || {};
          if (it.kind === 'text') {
            if (/\d/.test(it.text) && it.alpha > 0.5) { cur['t:' + it.id] = it.text; const p = S.prev['t:' + it.id]; if (!fresh && p !== undefined && p !== it.text) S.out.tick.push({ f, id: it.id, x: it.x }); }
            continue;
          }
          if (m.role === 'bg' || it.alpha <= 0.05) continue;
          if (it.geo === 'rect' && m.role === 'bar' && it.rect) {
            const h = it.rect[3], k = 'b:' + it.id, p = S.prev[k];
            cur[k] = h;
            const P = cam.project([it.rect[0] + it.rect[2] / 2, it.rect[1], it.z || 0]);
            if (!fresh && (p === undefined ? h > 0.3 : h > p + 0.3)) {
              if (!S.bars[it.id]) S.bars[it.id] = { id: it.id, f0: f, value: m.value, chart: m.chart || it.panel, x: P[0], y: P[1] };
              S.bars[it.id].last = f;
            } else if (S.bars[it.id] && f - S.bars[it.id].last > 1) { S.out.bar.push({ ...S.bars[it.id], f1: S.bars[it.id].last + 1 }); delete S.bars[it.id]; }
          } else if (m.role === 'series' && it.pts && it.pts.length >= 2) {
            const q = it.pts[it.pts.length - 1], k = 's:' + it.id, p = S.prev[k];
            cur[k] = q;
            if (!fresh && p && (Math.abs(q[0] - p[0]) > 0.3 || Math.abs(q[1] - p[1]) > 0.3)) {
              const dx = q[0] - p[0], dy = q[1] - p[1];
              const P = cam.project([q[0], q[1], it.z || 0]);
              S.out.line.push({ f, id: it.id, char: m.char || null, slope: dx > 0.01 ? -dy / dx : 0, x: P[0], y: P[1] });
            }
          } else if (it.geo === 'circle') {
            const k = 'c:' + it.id, p = S.prev[k], vis = (it.r || 0) > 0.5;
            cur[k] = vis;
            if (!fresh && vis && p === false) { const P = cam.project([it.c[0], it.c[1], it.z || 0]); S.out.dot.push({ f, id: it.id, x: P[0], y: P[1] }); }
          }
        }
        // circles that were absent last frame count as appearing when they show up
        for (const k of Object.keys(cur)) if (k.startsWith('c:') && S.prev[k] === undefined && !fresh) {
          const it = st.items.find((x) => 'c:' + x.id === k);
          if (cur[k] && it) { const P = cam.project([it.c[0], it.c[1], it.z || 0]); S.out.dot.push({ f, id: it.id, x: P[0], y: P[1] }); }
        }
        S.prev = cur;
      }
    }, [a, b, FPS]);
    if (a % 6000 === 0) console.log('frame', a, ((Date.now() - t0) / 1000).toFixed(0), 's');
  }
  const out = await page.evaluate(() => { const S = window.__SON; for (const g of Object.values(S.bars)) S.out.bar.push({ ...g, f1: g.last + 1 }); return S.out; });
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'out', 'sonify-events.json'), JSON.stringify({ fps: FPS, frames: N, ...out }));
  console.log(JSON.stringify({ bars: out.bar.length, lineSamples: out.line.length, dots: out.dot.length, ticks: out.tick.length, seconds: +((Date.now() - t0) / 1000).toFixed(0) }));
})();
