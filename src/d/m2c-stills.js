'use strict';
// Test D M2c: six final-quality stills of the grammar (render-d/look/world2.js, q=final), their grayscale and
// colour-vision simulations, and a stills root (out/m2c/stills-root) where video second k holds still k, so the page
// checks (V08, C14, V11) and F08 run on exactly these frames.
//   node src/d/m2c-stills.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const T = [5.0, 10.8, 25.0, 68.5, 113.6, 122.4];
const NAMES = ['dawn-two-tanks', 'coldopen-1991', 'act1-tank-1million', 'act1-stones-profile', 'storm-1974', 'storm-461000'];
const OUT = path.join(REPO, 'preprod', 'style-m2c'); fs.mkdirSync(OUT, { recursive: true });
const R = path.join(REPO, 'out', 'm2c', 'stills-root'); fs.mkdirSync(path.join(R, 'out'), { recursive: true });
const tmp = path.join(REPO, '.frames', 'm2c-stills');
const t0 = Date.now();
execFileSync('node', [path.join(REPO, 'render-d/look/render2.js'), '--q', 'final', '--stills', T.join(','), '--dir', tmp], { stdio: 'inherit' });
const secs = (Date.now() - t0) / 1000;
const files = T.map((t, i) => { const src = path.join(tmp, `t${t.toFixed(2)}.png`); const dst = path.join(OUT, `still-${i + 1}-${NAMES[i]}.png`); fs.copyFileSync(src, dst); return dst; });
// grayscale, deuteranopia and protanopia (Machado et al. 2009, severity 1.0) of each still
const M = { deutan: '0.367:0.861:-0.228:0:0.280:0.673:0.047:0:-0.012:0.043:0.969', protan: '0.152:1.053:-0.205:0:0.115:0.786:0.099:0:-0.004:-0.048:1.052' };
for (const f of files) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-vf', 'format=gray', f.replace('.png', '-gray.png')]);
  for (const [k, m] of Object.entries(M)) { const [a, b, c, , d, e, g, , h, i, j] = m.split(':');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-vf', `colorchannelmixer=rr=${a}:rg=${b}:rb=${c}:gr=${d}:gg=${e}:gb=${g}:br=${h}:bg=${i}:bb=${j}`, f.replace('.png', `-${k}.png`)]); }
}
// stills video: each still held 1 s (30 frames), silent AAC, same encode as the picture
const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, files.map((f) => `file '${f}'\nduration 1`).join('\n') + `\nfile '${files[files.length - 1]}'\n`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-vf', 'fps=30,noise=alls=2:allf=t,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-profile:v', 'high', '-b:v', '20M', '-minrate', '20M', '-maxrate', '20M', '-bufsize', '20M', '-x264-params', 'nal-hrd=cbr:force-cfr=1', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-frames:v', String(30 * T.length), '-c:a', 'aac', '-b:a', '320k', '-shortest', '-video_track_timescale', '15360', path.join(R, 'out', 'video.mp4')]);
const link = (rel, target) => { const p = path.join(R, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); try { fs.unlinkSync(p); } catch (e) { /* none */ } fs.symlinkSync(path.relative(path.dirname(p), path.join(REPO, target)), p); };
for (const d of ['data', 'design', 'preprod']) link(d, d);
link('out/voice', 'out/voice'); link('out/model.json', 'out/model.json');
const W = (rel, o) => fs.writeFileSync(path.join(R, rel), JSON.stringify(o, null, 1));
W('out/timeline.json', { fps: 30, total: T.length, acts: [{ id: 'act1', start: 0, end: T.length }], scenes: T.map((t, i) => ({ id: 'still-' + (i + 1), act: 'act1', start: i, dur: 1, panels: ['world'], move: 0, storyTime: t })), turns: [] });
W('out/script.json', { sentences: [] });
W('out/claims.json', JSON.parse(fs.readFileSync(path.join(REPO, 'out', 'claims.json'), 'utf8')));
W('out/page.json', { url: path.relative(R, path.join(REPO, 'render-d', 'look', 'page2.html')) + '?q=final&stills=' + T.join(','), ready: 'new Promise((r) => { const f = () => (window.READY ? r(true) : setTimeout(f, 100)); f(); })' });
fs.writeFileSync(path.join(REPO, 'out', 'm2c', 'stills.json'), JSON.stringify({ times: T, names: NAMES, finalRenderSeconds: +secs.toFixed(1), perStill: +(secs / T.length).toFixed(2) }, null, 1));
console.log('stills', files.length, 'render s', secs.toFixed(1));
