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
const parts = ranges.flatMap((r) => fs.readdirSync(path.join(REPO, '.frames', 'm3', r)).filter((f) => /^part\d+\.mkv$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]).map((f) => path.join(REPO, '.frames', 'm3', r, f)));
const list = path.join(REPO, '.frames', 'm3', 'list-all.txt');
fs.writeFileSync(list, parts.map((f) => `file '${f}'`).join('\n'));
const frames = ranges.reduce((n, r) => n + J(path.join(R, '..', `render-run-${r}.json`)).frames, 0);
const vf = ["curves=master='0/0.02 0.25/0.235 0.5/0.5 0.75/0.765 1/0.98':r='0/0 0.5/0.505 1/1':b='0/0.01 0.5/0.495 1/0.99'", 'vignette=angle=PI/9:mode=forward', 'noise=alls=4:allf=u',
  'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p', "lutyuv=y='clip(val,16,235)':u='clip(val,16,240)':v='clip(val,16,240)'"].join(',');
const t0 = Date.now();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'fast', '-tune', 'grain',
  '-b:v', '17M', '-minrate', '17M', '-maxrate', '17M', '-bufsize', '17M', '-x264-params', 'nal-hrd=cbr:force-cfr=1', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-r', '30', '-frames:v', String(frames), '-video_track_timescale', '15360', path.join(R, '..', 'picture.mp4')]);
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
console.log('merged', parts.length, 'parts,', frames, 'frames; encode', enc.toFixed(0), 's');
