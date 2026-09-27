'use strict';
// Test D M2b lookdev exporter: WORKERS Chromium pages (WebGL2) render contiguous frame ranges of render-d/look/page.html
// into lossless intermediates; one ffmpeg pass concatenates them, adds a fixed light grain and encodes H.264 High /
// yuv420p / BT.709 limited / 30 fps CFR. Also writes the camera track and the first appearance of every text.
//   node render-d/look/render.js <rootDir> [--from s] [--to s] [--stills t1,t2,... --out dir]
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const ROOT = path.resolve(args[0] || 'out/m2b/root');
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const WORKERS = +(process.env.WORKERS || 2), FPS = 30;
const PAGE = path.resolve(__dirname, 'page.html');
const TMP = path.resolve(__dirname, '..', '..', '.frames', 'm2b');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
  await page.goto('file://' + PAGE);
  await page.waitForFunction('window.READY === true', null, { timeout: 120000 });
  await page.evaluate(async () => { await document.fonts.load('700 40px Inter'); await document.fonts.load('600 40px Inter'); await document.fonts.ready; });
  return page;
}
const png = (buf, f) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-i', '-', f], { input: buf });

async function chunk(browser, f0, f1, file, log) {
  const page = await openPage(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  const cams = [], seen = {}, subs = [];
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const t = f / FPS;
    const r = await page.evaluate((t) => { const x = window.RENDER.frameB64(t); return { ...x, texts: window.RENDER.texts(), cam: window.RENDER.camera(t) }; }, t);
    cams.push(r.cam); subs.push(r.rendered);
    for (const [tid, x, level, role, nClaims] of r.texts) if (!(tid in seen)) seen[tid] = { t: +t.toFixed(4), x: +x.toFixed(1), level, role, claims: nClaims };
    const buf = Buffer.from(r.b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
    if ((f - f0) % 60 === 0) log(`worker ${f0}-${f1}: frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end(); await done; await page.close();
  return { cams, seen, subs, seconds: (Date.now() - t0) / 1000 };
}

async function main() {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  if (opt('stills')) {
    const page = await openPage(browser);
    const dir = path.resolve(opt('out', path.join(ROOT, '..', 'stills'))); fs.mkdirSync(dir, { recursive: true });
    for (const t of opt('stills').split(',').map(Number)) {
      const s0 = Date.now();
      const r = await page.evaluate((t) => window.RENDER.frameB64(t), t);
      png(Buffer.from(r.b64, 'base64'), path.join(dir, `t${t.toFixed(2)}.png`));
      console.log('still', t, 'subframes', r.rendered, ((Date.now() - s0) / 1000).toFixed(2), 's');
    }
    await browser.close();
    return;
  }
  const total = await (async () => { const p = await openPage(browser); const x = await p.evaluate(() => window.RENDER.total); await p.close(); return x; })();
  const from = +opt('from', 0), to = +opt('to', total);
  const F0 = Math.round(from * FPS), F1 = Math.round(to * FPS);
  fs.mkdirSync(TMP, { recursive: true });
  const per = Math.ceil((F1 - F0) / WORKERS);
  const t0 = Date.now();
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const a = F0 + w * per, b = Math.min(F1, a + per);
    if (a >= b) continue;
    jobs.push(chunk(browser, a, b, path.join(TMP, `part${w}.mkv`), console.log).then((r) => ({ ...r, w, a, b })));
  }
  const res = (await Promise.all(jobs)).sort((x, y) => x.a - y.a);
  await browser.close();
  const wall = (Date.now() - t0) / 1000;
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'camera.json'), JSON.stringify({ fovAxis: 'vertical', note: 'world metres; coc = background circle of confusion in px at 1080p (far plane 60 m)', frames: res.flatMap((r) => r.cams) }));
  const seen = {};
  for (const r of res) for (const [k, v] of Object.entries(r.seen)) if (!(k in seen) || v.t < seen[k].t) seen[k] = v;
  fs.writeFileSync(path.join(ROOT, '..', 'text-first.json'), JSON.stringify(seen, null, 1));
  const list = path.join(TMP, 'list.txt');
  fs.writeFileSync(list, res.map((r) => `file '${path.join(TMP, `part${r.w}.mkv`)}'`).join('\n'));
  const out = path.join(ROOT, '..', 'picture.mp4');
  const vf = ['noise=alls=3:allf=t', 'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p', "lutyuv=y='clip(val,16,235)':u='clip(val,16,240)':v='clip(val,16,240)'"].join(',');
  const e0 = Date.now();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', vf,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-tune', 'grain', '-b:v', '20M', '-minrate', '20M', '-maxrate', '20M', '-bufsize', '20M', '-x264-params', 'nal-hrd=cbr:force-cfr=1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(FPS), '-frames:v', String(F1 - F0), '-video_track_timescale', '15360', out]);
  const subs = res.flatMap((r) => r.subs);
  const log = { workers: WORKERS, frames: F1 - F0, subframesHistogram: subs.reduce((h, n) => ((h[n] = (h[n] || 0) + 1), h), {}), shutter: 0.5, wallSeconds: +wall.toFixed(1),
    secondsPerVideoSecond: +(wall / ((F1 - F0) / FPS)).toFixed(2), encodeSeconds: +((Date.now() - e0) / 1000).toFixed(1), workerSeconds: res.map((r) => +r.seconds.toFixed(1)) };
  fs.writeFileSync(path.join(ROOT, '..', 'render-run.json'), JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log));
}
main().catch((e) => { console.error(e); process.exit(1); });
