'use strict';
// Renders test C's picture (out/.video-only.mp4, 1080p30 H.264) in 4 parallel workers and records,
// per frame, (a) DOM event probes -> out/visual-events.json (SFX sync) and (b) claim-span opacity
// -> out/claim-visibility.json (spoken-number sync). Also keyframes + contact sheet.
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { launch, openPage, paint } = require('./page');
const { contactSheet } = require('../render-motion/contact');

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const OUT = path.join(__dirname, '..', 'out');
const TMP = path.join(__dirname, '..', '.frames');
const FPS = 30, WORKERS = Number(process.env.WORKERS || 4);
const timeline = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));

function encoder(file) {
  const p = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-vf', 'scale=out_color_matrix=bt709', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  return { stdin: p.stdin, done: new Promise((res, rej) => p.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res()))) };
}

async function chunk(browser, from, to, file) {
  const page = await openPage(browser);
  const enc = encoder(file);
  const first = {}, vis = {};
  for (let f = from; f < to; f++) {
    await paint(page, f / FPS);
    const r = await page.evaluate(() => ({ p: window.SEG.probes(), c: window.SEG.claimVis() }));
    for (const id of r.p) if (!(id in first)) first[id] = f;
    for (const [claim, tid, op] of r.c) if (op >= 0.5) (vis[`${claim}|${tid}`] ||= []).push(f);
    const buf = await page.screenshot({ type: 'png' });
    if (!enc.stdin.write(buf)) await new Promise((r2) => enc.stdin.once('drain', r2));
  }
  enc.stdin.end(); await enc.done; await page.close();
  return { first, vis };
}

const KEYFRAMES = [['establishing', 'hook3', 0.9], ['break-even-teaser', 'hook4', 0.85], ['same-cash', 'cash', 0.85], ['payoff-month', 'timeline', 0.9], ['interest-avoided', 'certain', 0.9]];

async function stills(browser) {
  const page = await openPage(browser);
  const S = Object.fromEntries(timeline.scenes.map((s) => [s.id, s]));
  fs.mkdirSync(path.join(OUT, 'keyframes'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'evidence'), { recursive: true });
  const kf = [];
  for (const [name, sc, frac] of KEYFRAMES) {
    if (!S[sc]) continue;
    const t = S[sc].start + S[sc].dur * frac;
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
    const t = s.start + s.dur * 0.8;
    await paint(page, t);
    const f = path.join(thumbs, `${s.id}.png`);
    await page.screenshot({ path: f });
    const mm = Math.floor(s.start / 60), ss = (s.start - mm * 60).toFixed(1).padStart(4, '0');
    items.push({ png: f, title: `${String(s.index + 1).padStart(2, '0')} · ${mm}:${ss} · ${s.shot}`, sub: `${s.id} · ${s.layout}` });
  }
  await page.close();
  await contactSheet(items, path.join(OUT, 'contact-sheet.png'), { cols: 6, thumbW: 300 });
  fs.writeFileSync(path.join(OUT, 'keyframes', 'index.json'), JSON.stringify(kf, null, 1));
}

async function main() {
  const t0 = Date.now();
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  for (const d of ['keyframes', 'evidence']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
  const browser = await launch();
  await stills(browser);
  if (process.argv.includes('--stills-only')) { await browser.close(); return; }
  const total = Math.round(timeline.total * FPS);
  const per = Math.ceil(total / WORKERS);
  const parts = [];
  for (let w = 0; w < WORKERS; w++) { const from = w * per, to = Math.min(total, from + per); if (from < to) parts.push({ from, to, file: path.join(TMP, `part${w}.mp4`) }); }
  const res = await Promise.all(parts.map((p) => chunk(browser, p.from, p.to, p.file)));
  await browser.close();
  const first = {}, vis = {};
  for (const r of res) {
    for (const [k, v] of Object.entries(r.first)) if (!(k in first) || v < first[k]) first[k] = v;
    for (const [k, v] of Object.entries(r.vis)) (vis[k] ||= []).push(...v);
  }
  fs.writeFileSync(path.join(TMP, 'list.txt'), parts.map((p) => `file '${p.file}'`).join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', '-an', path.join(OUT, '.video-only.mp4')]);
  const visual = timeline.events.map((e) => ({ id: e.id, type: e.type, t: e.t, visualFrame: first[e.id] ?? null, visualT: first[e.id] !== undefined ? +(first[e.id] / FPS).toFixed(4) : null }));
  fs.writeFileSync(path.join(OUT, 'visual-events.json'), JSON.stringify(visual, null, 1));
  // claim visibility as runs of frames with opacity >= 0.5
  const runs = {};
  for (const [k, frames] of Object.entries(vis)) {
    frames.sort((a, b) => a - b);
    const r = [];
    for (const f of frames) { if (r.length && f === r[r.length - 1][1] + 1) r[r.length - 1][1] = f; else r.push([f, f]); }
    runs[k] = r.map(([a, b]) => [+(a / FPS).toFixed(4), +((b + 1) / FPS).toFixed(4)]);
  }
  fs.writeFileSync(path.join(OUT, 'claim-visibility.json'), JSON.stringify({ fps: FPS, threshold: 0.5, runs }, null, 1));
  fs.rmSync(TMP, { recursive: true, force: true });
  const secs = +((Date.now() - t0) / 1000).toFixed(1);
  const logf = path.join(OUT, 'render-log.json');
  const log = fs.existsSync(logf) ? JSON.parse(fs.readFileSync(logf, 'utf8')) : { renders: [] };
  if (!Array.isArray(log.renders)) log.renders = [];
  log.renders.push({ part: process.env.PART || 'full', scenes: timeline.scenes.length, durationS: timeline.total, frames: total, workers: WORKERS, seconds: secs, finished: new Date().toISOString() });
  fs.writeFileSync(logf, JSON.stringify(log, null, 1));
  const missing = visual.filter((v) => v.visualT === null).map((v) => v.id);
  console.log(`rendered ${total} frames in ${secs}s; events without a visual probe: ${missing.length ? missing.join(', ') : 'none'}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
