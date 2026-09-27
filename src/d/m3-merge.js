'use strict';
// Test D M3: join the partial renders (render-d/prod/render.js --from/--to): lossless parts in time order -> one encode
// (same grade, grain, vignette and H.264 settings as render.js, 17 Mbps CBR), and the merged camera track, text first
// appearances and render log.   node src/d/m3-merge.js 0.000-203.019 203.019-706.010
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const R = path.join(REPO, 'out', 'm3', 'root');
const ranges = process.argv.slice(2);
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
// each range is encoded once (src/d/m3-encode-range.js: grade, grain, H.264 17 Mbps CBR), then the encoded ranges are
// joined without re-encoding
const t0 = Date.now();
for (const r of ranges) if (!fs.existsSync(path.join(REPO, 'out', 'm3', `picture-${r}.mp4`))) execFileSync('node', [path.join(__dirname, 'm3-encode-range.js'), r], { stdio: 'inherit' });
const list = path.join(REPO, 'out', 'm3', 'picture-list.txt');
fs.writeFileSync(list, ranges.map((r) => `file '${path.join(REPO, 'out', 'm3', `picture-${r}.mp4`)}'`).join('\n'));
const frames = ranges.reduce((n, r) => n + J(path.join(R, '..', `render-run-${r}.json`)).frames, 0);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-video_track_timescale', '15360', path.join(R, '..', 'picture.mp4')]);
const enc = (Date.now() - t0) / 1000;
const cams = ranges.flatMap((r) => J(path.join(R, 'out', `camera-${r}.json`)).frames);
fs.writeFileSync(path.join(R, 'out', 'camera.json'), JSON.stringify({ ...J(path.join(R, 'out', `camera-${ranges[0]}.json`)), frames: cams }));
const seen = {};
for (const r of ranges) for (const [k, v] of Object.entries(J(path.join(R, '..', `text-first-${r}.json`)))) if (!(k in seen) || v.t < seen[k].t) seen[k] = v;
fs.writeFileSync(path.join(R, '..', 'text-first.json'), JSON.stringify(seen, null, 1));
const runs = ranges.map((r) => J(path.join(R, '..', `render-run-${r}.json`)));
const wall = runs.reduce((a, r) => a + r.wallSeconds, 0);
fs.writeFileSync(path.join(R, '..', 'render-run.json'), JSON.stringify({ subframes: 8, shutter: 0.5, workers: 4, frames, framesSupersampled: runs.reduce((a, r) => a + r.framesSupersampled, 0), wallSeconds: +wall.toFixed(1),
  secondsPerVideoSecond: +(wall / (frames / 30)).toFixed(2), encodeSeconds: +enc.toFixed(1), ranges: runs }, null, 1));
console.log('merged', ranges.length, 'ranges,', frames, 'frames; encode + join', enc.toFixed(0), 's');
