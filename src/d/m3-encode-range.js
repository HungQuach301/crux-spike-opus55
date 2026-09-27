'use strict';
// Test D M3: encode one rendered range (its parts in .frames/m3/<range>) with the film's grade/grain/H.264 settings
// (17 Mbps CBR, same as src/d/m3-merge.js) to out/m3/picture-<range>.mp4, so the parts can be deleted (disk allowance).
//   node src/d/m3-encode-range.js 0.000-203.019
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const r = process.argv[2];
const dir = path.join(REPO, '.frames', 'm3', r);
const parts = fs.readdirSync(dir).filter((f) => /^part\d+\.mkv$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]).map((f) => path.join(dir, f));
const list = path.join(dir, 'list.txt'); fs.writeFileSync(list, parts.map((f) => `file '${f}'`).join('\n'));
const frames = JSON.parse(fs.readFileSync(path.join(REPO, 'out', 'm3', `render-run-${r}.json`), 'utf8')).frames;
const vf = ["curves=master='0/0.02 0.25/0.235 0.5/0.5 0.75/0.765 1/0.98':r='0/0 0.5/0.505 1/1':b='0/0.01 0.5/0.495 1/0.99'", 'vignette=angle=PI/9:mode=forward', 'noise=alls=4:allf=u',
  'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p', "lutyuv=y='clip(val,16,235)':u='clip(val,16,240)':v='clip(val,16,240)'"].join(',');
const t0 = Date.now();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'fast', '-tune', 'grain',
  '-b:v', '17M', '-minrate', '17M', '-maxrate', '17M', '-bufsize', '17M', '-x264-params', 'nal-hrd=cbr:force-cfr=1', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-r', '30', '-frames:v', String(frames), '-video_track_timescale', '15360', path.join(REPO, 'out', 'm3', `picture-${r}.mp4`)]);
console.log('encoded', r, frames, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's');
