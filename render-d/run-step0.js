'use strict';
// Step 0 (b): render the 10 s test scene with depth of field and N× temporal supersampling, time it.
//   node render-d/run-step0.js [subframes=8] [out=out/step0/render-8x.mp4] [--gpu]
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const SUB = +(process.argv[2] || 8);
const OUT = process.argv[3] || `out/step0/render-${SUB}x.mp4`;
const FPS = 30, DUR = 10;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', ...(process.argv.includes('--gpu') ? [] : ['--disable-gpu'])] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'step0.html'));
  await page.evaluate(async () => { await document.fonts.load('600 40px Inter'); await document.fonts.load('700 40px Inter'); await document.fonts.load('400 40px Inter'); await document.fonts.ready; });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  const t0 = Date.now();
  const per = [];
  let pageMs = 0;
  for (let f = 0; f < DUR * FPS; f++) {
    const a = Date.now();
    const r = await page.evaluate(([t, n]) => {
      const q = performance.now();
      const fr = window.ENGINE.frame(window.STEP0.world, t, { subframes: n });
      const ms = performance.now() - q;
      return { b: window.ENGINE.b64(fr.img.data), rendered: fr.rendered, ms };
    }, [f / FPS, SUB]);
    pageMs += r.ms;
    const buf = Buffer.from(r.b, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
    per.push({ f, rendered: r.rendered, ms: Date.now() - a });
  }
  ff.stdin.end(); await done;
  const wall = (Date.now() - t0) / 1000;
  const moving = per.filter((p) => p.rendered > 1), still = per.filter((p) => p.rendered === 1);
  const avg = (a) => a.reduce((s, p) => s + p.ms, 0) / Math.max(1, a.length) / 1000;
  const res = {
    subframes: SUB, videoSeconds: DUR, wallSeconds: +wall.toFixed(1), secondsPerVideoSecond: +(wall / DUR).toFixed(2),
    framesSupersampled: moving.length, framesStatic: still.length,
    secPerFrameMoving: +avg(moving).toFixed(3), secPerFrameStatic: +avg(still).toFixed(3),
    worstCaseSecondsPerVideoSecond: +(avg(moving) * FPS).toFixed(2), pageRenderSeconds: +(pageMs / 1000).toFixed(1), workers: 1,
    browser: process.argv.includes('--gpu') ? 'chromium default GPU flags' : 'chromium --disable-gpu (software raster)',
  };
  console.log(JSON.stringify(res, null, 1));
  fs.writeFileSync(OUT.replace(/\.mp4$/, '.json'), JSON.stringify(res, null, 1));
  await browser.close();
})();
