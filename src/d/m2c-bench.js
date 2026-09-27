'use strict';
// Test D M2c render benchmark after load reduction: three kinds of shot, 5 s each, in the load-reduced final mode
// (q=fast: 1280x720 render upscaled to 1080p, camera-velocity motion blur, rain/dust LOD, shafts only where asked) and,
// for reference, 1 s of each in the M2b final mode (q=final: 1080p, half-res subframe residual). Writes
// out/m2c/bench.json and before/after images preprod/style-m2c/bench-<kind>.png (same frame, left = final, right = fast).
//   node src/d/m2c-bench.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const R2 = path.join(REPO, 'render-d', 'look', 'render2.js');
const KINDS = { clear: [58.2, 'a1-horizon.1: wide road in clear daylight'], storm: [107.0, 'a2-1974inf.1: inside the storm cell, rain + lightning'], close: [22.2, 'a1-start.1: close on the 1966 tank'] };
const out = {}; const tmp = path.join(REPO, '.frames', 'm2c-bench'); fs.mkdirSync(tmp, { recursive: true });
for (const [k, [t0, what]] of Object.entries(KINDS)) {
  const run = (q, dur) => { const j = path.join(tmp, `${k}-${q}.json`); execFileSync('node', [R2, '--q', q, '--from', String(t0), '--to', String(t0 + dur), '--json', j], { stdio: 'inherit' }); return JSON.parse(fs.readFileSync(j, 'utf8')); };
  const fast = run('fast', 5), fin = run('final', 1);
  const ts = +(t0 + 0.5).toFixed(2);
  for (const q of ['final', 'fast']) execFileSync('node', [R2, '--q', q, '--stills', String(ts), '--dir', path.join(tmp, q)], { stdio: 'inherit' });
  const a = path.join(tmp, 'final', `t${ts.toFixed(2)}.png`), b = path.join(tmp, 'fast', `t${ts.toFixed(2)}.png`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex', '[0]scale=960:-1[l];[1]scale=960:-1[r];[l][r]hstack', path.join(REPO, 'preprod', 'style-m2c', `bench-${k}.png`)]);
  // 1:1 crop of the centre for detail (left final, right fast)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex', '[0]crop=640:540:640:270[l];[1]crop=640:540:640:270[r];[l][r]hstack', path.join(REPO, 'preprod', 'style-m2c', `bench-${k}-crop.png`)]);
  out[k] = { what, window: [t0, t0 + 5], fast: fast.secondsPerVideoSecond, finalRef: fin.secondsPerVideoSecond, fastFrames: fast.frames, finalFrames: fin.frames };
  console.log(k, JSON.stringify(out[k]));
}
fs.writeFileSync(path.join(REPO, 'out', 'm2c', 'bench.json'), JSON.stringify(out, null, 1));
