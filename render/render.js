'use strict';
// Renders out/segment.mp4 (1920x1080, 30 fps, H.264, no audio track) and the three layout frames.
// Frames are painted deterministically in Chromium and piped as PNG into ffmpeg.
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
require('./build-data');
const { launch, openPage, paint } = require('./page');

const FFMPEG = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())']).toString().trim();
const OUT = path.join(__dirname, '..', 'out');
const TMP = path.join(__dirname, '..', '.frames');
const FPS = 30;
const WORKERS = Number(process.env.WORKERS || 4);

function encoder(file) {
  const p = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-vf', 'scale=out_color_matrix=bt709',
    '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  return { stdin: p.stdin, done };
}

async function renderChunk(browser, from, to, file) {
  const page = await openPage(browser);
  const enc = encoder(file);
  for (let f = from; f < to; f++) {
    await paint(page, f / FPS, 'normal');
    const buf = await page.screenshot({ type: 'png' });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
  }
  enc.stdin.end();
  await enc.done;
  await page.close();
}

async function frames(browser) {
  const page = await openPage(browser);
  const scenes = await page.evaluate(() => window.SEG.SCENES);
  const s = scenes.find((x) => x.id === 'tableB');
  for (const ds of ['normal', 'extreme', 'missing']) {
    await paint(page, s.start + s.hold, ds);
    const f = path.join(OUT, `frame-${ds}.png`);
    await page.screenshot({ path: f });
    // evidence copies: 25% size and grayscale
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', f, '-vf', 'scale=480:270:flags=area', path.join(OUT, 'evidence', `frame-${ds}-25pct.png`)]);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', f, '-vf', 'format=gray', path.join(OUT, 'evidence', `frame-${ds}-gray.png`)]);
  }
  await page.close();
}

async function main() {
  const t0 = Date.now();
  fs.mkdirSync(path.join(OUT, 'evidence'), { recursive: true });
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const browser = await launch();
  await frames(browser);
  if (process.argv.includes('--frames-only')) { await browser.close(); return; }
  const probe = await openPage(browser);
  const total = Math.round((await probe.evaluate(() => window.SEG.TOTAL)) * FPS);
  await probe.close();
  const per = Math.ceil(total / WORKERS);
  const parts = [];
  for (let w = 0; w < WORKERS; w++) {
    const from = w * per, to = Math.min(total, from + per);
    if (from < to) parts.push({ from, to, file: path.join(TMP, `part${w}.mp4`) });
  }
  await Promise.all(parts.map((p) => renderChunk(browser, p.from, p.to, p.file)));
  await browser.close();
  fs.writeFileSync(path.join(TMP, 'list.txt'), parts.map((p) => `file '${p.file}'`).join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', '-an', '-movflags', '+faststart', path.join(OUT, 'segment.mp4')]);
  // stills from the video itself for review
  for (const [name, sec] of [['video-t20', 20], ['video-t55', 55], ['video-t70', 70]]) {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(sec), '-i', path.join(OUT, 'segment.mp4'), '-frames:v', '1', path.join(OUT, 'evidence', `${name}.png`)]);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`rendered ${total} frames in ${secs}s`);
  fs.writeFileSync(path.join(OUT, 'render-log.json'), JSON.stringify({ frames: total, fps: FPS, workers: WORKERS, seconds: Number(secs), ffmpeg: FFMPEG, finished: new Date().toISOString() }, null, 1));
}
main().catch((e) => { console.error(e); process.exit(1); });
