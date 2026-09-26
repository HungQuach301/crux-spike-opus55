'use strict';
// Step 0 profiler: cost of one subframe with/without depth of field, 8 subframes, readback and encode.
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  for (const gpu of [false, true]) {
    const b = await chromium.launch({ args: ['--font-render-hinting=none', ...(gpu ? [] : ['--disable-gpu'])] });
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto('file://' + path.resolve(__dirname, 'step0.html'));
    await p.evaluate(async () => { await document.fonts.ready; });
    const r = await p.evaluate(() => {
      const E = window.ENGINE, w = window.STEP0.world; const out = {};
      let q = performance.now(); for (let i = 0; i < 3; i++) E.frame(w, 2 + i / 30, { subframes: 1 }); out.sub1 = (performance.now() - q) / 3;
      q = performance.now(); for (let i = 0; i < 3; i++) E.frame(w, 2 + i / 30, { subframes: 1, dof: false }); out.sub1noDof = (performance.now() - q) / 3;
      q = performance.now(); const f = E.frame(w, 2, { subframes: 8 }); out.sub8 = performance.now() - q;
      q = performance.now(); E.b64(f.img.data); out.b64 = performance.now() - q;
      const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d', { willReadFrequently: true });
      q = performance.now(); for (let i = 0; i < 5; i++) x.getImageData(0, 0, 1920, 1080); out.getImageData = (performance.now() - q) / 5;
      return out;
    });
    console.log(gpu ? 'gpu' : 'nogpu', JSON.stringify(r)); await b.close();
  }
})();
