'use strict';
// Test D M2 renderer: WORKERS parallel Chromium pages render contiguous frame ranges of the page (8 subframes when
// anything moves) into lossless intermediates; then one ffmpeg pass concatenates them and applies the single grade,
// a fixed light grain and vignette, and encodes H.264 High / yuv420p / BT.709 limited / 30 fps CFR.
// Also writes, per frame, the camera (out/camera.json) and the first-visible frame of every text (sfx events with the
// screen x of the text that appears).
//   node render-d/prod/render.js <rootDir> [--from s] [--to s] [--stills t1,t2,...]
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const ROOT = path.resolve(args[0] || 'out/m2/root');
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const WORKERS = +(process.env.WORKERS || 4), FPS = 30;
const PAGE = path.resolve(__dirname, 'page.html');
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'timeline.json'), 'utf8'));
const TMP = path.resolve(__dirname, '..', '..', '.frames', 'm2');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto('file://' + PAGE);
  await page.evaluate(async () => { await document.fonts.load('700 40px Inter'); await document.fonts.load('600 40px Inter'); await document.fonts.load('400 40px Inter'); await document.fonts.ready; });
  return page;
}

async function stills(browser, times, dir) {
  const page = await openPage(browser);
  fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const r = await page.evaluate((t) => window.RENDER.frameB64(t), t);
    const buf = Buffer.from(r.b64, 'base64');
    const f = path.join(dir, `t${t.toFixed(2)}.png`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-i', '-', f], { input: buf });
  }
  await page.close();
}

async function chunk(browser, f0, f1, file, log) {
  const page = await openPage(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '1920x1080', '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  const cams = [], seen = {};
  let moving = 0;
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const t = f / FPS;
    const r = await page.evaluate((t) => {
      const x = window.RENDER.frameB64(t);
      const objs = window.CHECKS.objects().filter((o) => o.kind === 'text' && o.opacity > 0.5).map((o) => [o.tid, (o.box[0] + o.box[2]) / 2, o.level, o.role, (o.claims || []).length]);
      return { ...x, cam: window.RENDER.camera(t), texts: objs };
    }, t);
    if (r.rendered > 1) moving++;
    cams.push(r.cam);
    for (const [tid, x, level, role, nClaims] of r.texts) if (!(tid in seen)) seen[tid] = { t: +t.toFixed(4), x: +x.toFixed(1), level, role, claims: nClaims };
    const buf = Buffer.from(r.b64, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((res) => ff.stdin.once('drain', res));
    if ((f - f0) % 150 === 0) log(`worker ${f0}-${f1}: frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end(); await done; await page.close();
  return { cams, seen, moving, seconds: (Date.now() - t0) / 1000 };
}

async function main() {
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu'] });
  if (opt('stills')) {
    await stills(browser, opt('stills').split(',').map(Number), path.join(ROOT, '..', 'stills'));
    await browser.close();
    return;
  }
  const from = +opt('from', 0), to = +opt('to', TL.total);
  const F0 = Math.round(from * FPS), F1 = Math.round(to * FPS);
  fs.mkdirSync(TMP, { recursive: true });
  const per = Math.ceil((F1 - F0) / WORKERS);
  const t0 = Date.now();
  const log = (m) => console.log(m);
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const a = F0 + w * per, b = Math.min(F1, a + per);
    if (a >= b) continue;
    jobs.push(chunk(browser, a, b, path.join(TMP, `part${w}.mkv`), log).then((r) => ({ ...r, w, a, b })));
  }
  const res = (await Promise.all(jobs)).sort((x, y) => x.a - y.a);
  await browser.close();
  const wall = (Date.now() - t0) / 1000;
  // camera track + text first appearances
  const frames = res.flatMap((r) => r.cams);
  fs.writeFileSync(path.join(ROOT, 'out', 'camera.json'), JSON.stringify({ fovAxis: 'vertical', note: 'world px; focus plane z = 0 unless racked; coc = background (far wall) circle of confusion in px at 1080p', frames }));
  const seen = {};
  for (const r of res) for (const [k, v] of Object.entries(r.seen)) if (!(k in seen) || v.t < seen[k].t) seen[k] = v;
  fs.writeFileSync(path.join(ROOT, '..', 'text-first.json'), JSON.stringify(seen, null, 1));
  // concat + grade + grain + vignette -> master picture
  const list = path.join(TMP, 'list.txt');
  fs.writeFileSync(list, res.map((r) => `file '${path.join(TMP, `part${r.w}.mkv`)}'`).join('\n'));
  const out = path.join(ROOT, '..', 'picture.mkv');
  const vf = [
    // ONE grade for the whole film (token colours in, graded colours out): gentle filmic curve, slight warm highlights
    "curves=master='0/0.02 0.25/0.235 0.5/0.5 0.75/0.765 1/0.98':r='0/0 0.5/0.505 1/1':b='0/0.01 0.5/0.495 1/0.99'",
    'vignette=angle=PI/5:mode=forward',
    'noise=alls=5:allf=t',
    'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p',
  ].join(',');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', vf,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-b:v', '20M', '-minrate', '20M', '-maxrate', '20M', '-bufsize', '20M', '-x264-params', 'nal-hrd=cbr:force-cfr=1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', String(FPS), out]);
  const log2 = { subframes: 8, shutter: 0.5, workers: WORKERS, frames: F1 - F0, framesSupersampled: res.reduce((a, r) => a + r.moving, 0), wallSeconds: +wall.toFixed(1),
    secondsPerVideoSecond: +(wall / ((F1 - F0) / FPS)).toFixed(2), workerSeconds: res.map((r) => +r.seconds.toFixed(1)) };
  fs.writeFileSync(path.join(ROOT, '..', 'render-run.json'), JSON.stringify(log2, null, 1));
  console.log(JSON.stringify(log2));
}
main().catch((e) => { console.error(e); process.exit(1); });
