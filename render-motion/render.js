'use strict';
// Renders the picture (out/.video-only.mp4), records per-frame DOM event probes
// (out/visual-events.json), keyframes and the contact sheet.
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { timeline } = require('./build-data');
const { launch, openPage, paint } = require('./page');
const { contactSheet } = require('./contact');

const FFMPEG = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).toString().trim();
const OUT = path.join(__dirname, '..', 'out');
const TMP = path.join(__dirname, '..', '.frames');
const FPS = 30, WORKERS = Number(process.env.WORKERS || 4);

function encoder(file) {
  const p = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-vf', 'scale=out_color_matrix=bt709', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  return { stdin: p.stdin, done: new Promise((res, rej) => p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()))) };
}

async function chunk(browser, from, to, file) {
  const page = await openPage(browser);
  const enc = encoder(file);
  const first = {};
  for (let f = from; f < to; f++) {
    await paint(page, f / FPS);
    for (const id of await page.evaluate(() => window.SEG.probes())) if (!(id in first)) first[id] = f;
    const buf = await page.screenshot({ type: 'png' });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
  }
  enc.stdin.end(); await enc.done; await page.close();
  return first;
}

const KEYFRAMES = [
  ['establishing', 'open', 5.5], ['slider-mid-sweep', 'sweep', 5.1], ['crossover', 'flip', 4.8],
  ['break-even-detail', 'detail', 3.0], ['downside-path', 'cross', 4.6],
];

async function stills(browser) {
  const page = await openPage(browser);
  const S = Object.fromEntries(timeline.scenes.map((s) => [s.id, s]));
  fs.mkdirSync(path.join(OUT, 'keyframes'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'evidence'), { recursive: true });
  const kf = [];
  for (const [name, sc, at] of KEYFRAMES) {
    const t = S[sc].start + at;
    await paint(page, t);
    const f = path.join(OUT, 'keyframes', `${name}.png`);
    await page.screenshot({ path: f });
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', f, '-vf', 'scale=480:270:flags=area', path.join(OUT, 'evidence', `${name}-25pct.png`)]);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', f, '-vf', 'format=gray', path.join(OUT, 'evidence', `${name}-gray.png`)]);
    kf.push({ name, scene: sc, t: +t.toFixed(3) });
  }
  const thumbs = path.join(TMP, 'thumbs'); fs.mkdirSync(thumbs, { recursive: true });
  const items = [];
  for (const s of timeline.scenes) {
    const t = s.start + s.dur * 0.75;
    await paint(page, t);
    const f = path.join(thumbs, `${s.id}.png`);
    await page.screenshot({ path: f });
    const mm = Math.floor(s.start / 60), ss = (s.start - mm * 60).toFixed(1).padStart(4, '0');
    items.push({ png: f, title: `${String(s.index + 1).padStart(2, '0')} · ${mm}:${ss} · ${s.shot}`, sub: s.layout });
  }
  await page.close();
  await contactSheet(items, path.join(OUT, 'contact-sheet.png'), { cols: 6, thumbW: 300 });
  fs.writeFileSync(path.join(OUT, 'keyframes', 'index.json'), JSON.stringify(kf, null, 1));
}

async function main() {
  const t0 = Date.now();
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const browser = await launch();
  await stills(browser);
  if (process.argv.includes('--stills-only')) { await browser.close(); return; }
  const total = Math.round(timeline.total * FPS);
  const per = Math.ceil(total / WORKERS);
  const parts = [];
  for (let w = 0; w < WORKERS; w++) { const from = w * per, to = Math.min(total, from + per); if (from < to) parts.push({ from, to, file: path.join(TMP, `part${w}.mp4`) }); }
  const firsts = await Promise.all(parts.map((p) => chunk(browser, p.from, p.to, p.file)));
  await browser.close();
  const first = {};
  for (const m of firsts) for (const [k, v] of Object.entries(m)) if (!(k in first) || v < first[k]) first[k] = v;
  fs.writeFileSync(path.join(TMP, 'list.txt'), parts.map((p) => `file '${p.file}'`).join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', '-an', path.join(OUT, '.video-only.mp4')]);
  const visual = timeline.events.map((e) => ({ id: e.id, type: e.type, t: e.t, visualFrame: first[e.id] ?? null, visualT: first[e.id] !== undefined ? +(first[e.id] / FPS).toFixed(4) : null }));
  fs.writeFileSync(path.join(OUT, 'visual-events.json'), JSON.stringify(visual, null, 1));
  fs.rmSync(TMP, { recursive: true, force: true });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  fs.writeFileSync(path.join(OUT, 'render-log.json'), JSON.stringify({ frames: total, fps: FPS, workers: WORKERS, seconds: Number(secs), finished: new Date().toISOString() }, null, 1));
  const missing = visual.filter((v) => v.visualT === null).map((v) => v.id);
  console.log(`rendered ${total} frames in ${secs}s; events without a visual probe: ${missing.length ? missing.join(', ') : 'none'}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
