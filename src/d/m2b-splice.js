'use strict';
// Test D M2b: splice a re-rendered range (the last shot, frames 950-1268) into the first full lookdev render: lossless
// parts are concatenated and encoded once (same grain and encode as render-d/look/render.js); camera track, text first
// appearances and the render log are merged.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const K = path.join(REPO, '.frames', 'm2b-keep'), N = path.join(REPO, '.frames', 'm2b'), R = path.join(REPO, 'out', 'm2b', 'root');
const F0 = 950;
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(K, 'part2.mkv'), '-frames:v', String(F0 - 846), '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', path.join(N, 'p2a.mkv')]);
const parts = [path.join(K, 'part0.mkv'), path.join(K, 'part1.mkv'), path.join(N, 'p2a.mkv'), ...['part0', 'part1', 'part2'].map((p) => path.join(N, p + '.mkv')).filter((f) => fs.existsSync(f))];
fs.writeFileSync(path.join(N, 'list.txt'), parts.map((f) => `file '${f}'`).join('\n'));
const vf = ['noise=alls=3:allf=t', 'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p', "lutyuv=y='clip(val,16,235)':u='clip(val,16,240)':v='clip(val,16,240)'"].join(',');
const e0 = Date.now();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(N, 'list.txt'), '-vf', vf,
  '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-tune', 'grain', '-b:v', '20M', '-minrate', '20M', '-maxrate', '20M', '-bufsize', '20M', '-x264-params', 'nal-hrd=cbr:force-cfr=1',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', '30', '-frames:v', '1269', '-video_track_timescale', '15360', path.join(REPO, 'out', 'm2b', 'picture.mp4')]);
const camOld = J(path.join(K, 'camera.json')), camNew = J(path.join(R, 'out', 'camera.json'));
fs.writeFileSync(path.join(R, 'out', 'camera.json'), JSON.stringify({ ...camOld, frames: [...camOld.frames.slice(0, F0), ...camNew.frames] }));
const tfOld = J(path.join(K, 'text-first.json')), tfNew = J(path.join(REPO, 'out', 'm2b', 'text-first.json'));
const tf = Object.fromEntries(Object.entries(tfOld).filter(([, v]) => v.t < F0 / 30)); Object.assign(tf, tfNew);
fs.writeFileSync(path.join(REPO, 'out', 'm2b', 'text-first.json'), JSON.stringify(tf, null, 1));
const r1 = J(path.join(K, 'render-run.json')), r2 = J(path.join(REPO, 'out', 'm2b', 'render-run.json'));
const run = { note: 'render 1 = all 1269 frames; render 2 = frames 950-1268 (last shot re-framed: the $461,000 label was out of frame); the picture splices render 1 (0-949) and render 2', render1: r1, render2: r2,
  frames: 1269, wallSecondsBothRenders: +(r1.wallSeconds + r2.wallSeconds).toFixed(1), secondsPerVideoSecond: r1.secondsPerVideoSecond, finalEncodeSeconds: +((Date.now() - e0) / 1000).toFixed(1) };
fs.writeFileSync(path.join(REPO, 'out', 'm2b', 'render-run.json'), JSON.stringify(run, null, 1));
console.log('spliced', parts.length, 'parts;', JSON.stringify({ wall: run.wallSecondsBothRenders }));
