'use strict';
// Test D M2c exporter for render-d/look/page2.html (world2): any mode (?q=final|fast|animatic), any size.
//   node render-d/look/render2.js --q animatic --out out/m2c/animatic-picture.mp4 [--from s --to s] [--workers n]
//   node render-d/look/render2.js --q final --stills 5,10.6 --dir out/m2c/stills
//   node render-d/look/render2.js --q fast --from 30 --to 35 --out x.mp4 --bench     (timing only, lossless file)
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const Q = opt('q', 'final'), FPS = 30, WORKERS = +opt('workers', 1);
const W = Q === 'animatic' ? 854 : 1920, H = Q === 'animatic' ? 480 : 1080;
const url = (extra = '') => 'file://' + path.resolve(__dirname, 'page2.html') + `?q=${Q}${extra}`;
async function openPage(browser, extra) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(url(extra)); await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  await page.evaluate(async () => { await document.fonts.load('700 40px Inter'); await document.fonts.load('600 40px Inter'); await document.fonts.ready; });
  return page;
}
(async () => {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  if (opt('stills')) {
    const page = await openPage(browser); const dir = path.resolve(opt('dir')); fs.mkdirSync(dir, { recursive: true }); const times = [];
    for (const t of opt('stills').split(',').map(Number)) { const s0 = Date.now(); const r = await page.evaluate((t) => window.RENDER.frameB64(t), t);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', path.join(dir, `t${t.toFixed(2)}.png`)], { input: Buffer.from(r.b64, 'base64') });
      times.push((Date.now() - s0) / 1000); console.log('still', t, ((Date.now() - s0) / 1000).toFixed(2), 's'); }
    await browser.close(); return;
  }
  const total = await (async () => { const p = await openPage(browser); const x = await p.evaluate(() => window.RENDER.total); await p.close(); return x; })();
  const F0 = Math.round(+opt('from', 0) * FPS), F1 = Math.round(+opt('to', total) * FPS);
  const tmp = path.resolve(__dirname, '..', '..', '.frames', 'm2c-' + Q); fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil((F1 - F0) / WORKERS); const t0 = Date.now(); const cams = [], seen = {};
  const jobs = [...Array(WORKERS).keys()].map(async (w) => {
    const a = F0 + w * per, b = Math.min(F1, a + per); if (a >= b) return null;
    const page = await openPage(browser); const file = path.join(tmp, `part${w}.mkv`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
    const c = [];
    for (let f = a; f < b; f++) { const r = await page.evaluate((t) => { const x = window.RENDER.frameB64(t); return { ...x, texts: window.RENDER.texts(), cam: window.RENDER.camera(t) }; }, f / FPS);
      c.push(r.cam); for (const [tid, x, level, role, n] of r.texts) if (!(tid in seen)) seen[tid] = { t: +(f / FPS).toFixed(4), x: +x.toFixed(1), level, role, claims: n };
      if (!ff.stdin.write(Buffer.from(r.b64, 'base64'))) await new Promise((res) => ff.stdin.once('drain', res));
      if ((f - a) % 150 === 0) console.log(`worker ${w}: frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
    ff.stdin.end(); await done; await page.close(); return { w, a, file, c };
  });
  const res = (await Promise.all(jobs)).filter(Boolean).sort((x, y) => x.a - y.a);
  await browser.close();
  const wall = (Date.now() - t0) / 1000;
  const run = { mode: Q, size: [W, H], frames: F1 - F0, from: F0 / FPS, to: F1 / FPS, workers: WORKERS, wallSeconds: +wall.toFixed(1), secondsPerVideoSecond: +(wall / ((F1 - F0) / FPS)).toFixed(2) };
  console.log(JSON.stringify(run));
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(run, null, 1));
  if (opt('out')) {
    fs.writeFileSync(path.join(tmp, 'list.txt'), res.map((r) => `file '${r.file}'`).join('\n'));
    const vf = [Q === 'animatic' ? 'null' : 'noise=alls=2:allf=t', 'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p'].join(',');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-vf', vf, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium',
      ...(Q === 'animatic' ? ['-crf', '20'] : ['-b:v', '20M', '-minrate', '20M', '-maxrate', '20M', '-bufsize', '20M', '-x264-params', 'nal-hrd=cbr:force-cfr=1']),
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', '30', '-frames:v', String(F1 - F0), '-video_track_timescale', '15360', path.resolve(opt('out'))]);
    if (opt('cam')) fs.writeFileSync(opt('cam'), JSON.stringify({ fovAxis: 'vertical', frames: res.flatMap((r) => r.c) }));
    if (opt('seen')) fs.writeFileSync(opt('seen'), JSON.stringify(seen, null, 1));
  }
})().catch((e) => { console.error(e); process.exit(1); });
