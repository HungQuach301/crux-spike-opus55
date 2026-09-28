'use strict';
// Test D M3 fix round 2: re-render ONLY the scenes with picture errors and splice them into the master picture.
//   node src/d/m3-splice.js render <scene,scene,...>   render each scene range (render.js --from/--to, frame-exact)
//   node src/d/m3-splice.js splice                      build the new master picture from the renders
// Splice: the master (out/m3/picture.mp4, H.264 17 Mbps CBR) is cut with -c copy at its own keyframes; every GOP span
// [kA, kB) that holds a re-rendered range is re-encoded once with the film's settings: the new frames [F0, F1) get the
// grade/grain/vignette pass (as every rendered frame did), the untouched frames of that GOP span ([kA, F0) and [F1, kB))
// are decoded from the master and re-encoded as they are. Frame count and timing stay identical (CFR 30).
// The camera track, text first appearances and render log are patched for the re-rendered ranges.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const R = path.join(REPO, 'out', 'm3', 'root');
const OUT = path.join(REPO, 'out', 'm3');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const FPS = 30;
const ROUND = process.env.ROUND || 'r2', BASE = process.env.BASE || 'r1'; // round 3: ROUND=r3 BASE=r2 (splice onto the round-2 master)
const STATE = path.join(OUT, `splice-${ROUND}.json`);
const VF = ["curves=master='0/0.02 0.25/0.235 0.5/0.5 0.75/0.765 1/0.98':r='0/0 0.5/0.505 1/1':b='0/0.01 0.5/0.495 1/0.99'", 'vignette=angle=PI/9:mode=forward', 'noise=alls=4:allf=u',
  'scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p', "lutyuv=y='clip(val,16,235)':u='clip(val,16,240)':v='clip(val,16,240)'"].join(',');
const X264 = ['-c:v', 'libx264', '-profile:v', 'high', '-preset', 'fast', '-tune', 'grain', '-b:v', '17M', '-minrate', '17M', '-maxrate', '17M', '-bufsize', '17M',
  '-x264-params', 'nal-hrd=cbr:force-cfr=1', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-r', '30'];
const range = (a, b) => `${(a / FPS).toFixed(3)}-${(b / FPS).toFixed(3)}`;

// scene ids -> merged frame ranges [F0, F1) (scenes closer than 1 s are rendered as one range)
function ranges(ids) {
  const tl = J(path.join(R, 'out', 'timeline.json'));
  const rs = ids.map((id) => { const s = tl.scenes.find((x) => x.id === id); if (!s) throw new Error('no scene ' + id); return [Math.round(s.start * FPS), Math.round((s.start + s.dur) * FPS), [id]]; }).sort((x, y) => x[0] - y[0]);
  const m = [];
  for (const r of rs) { const l = m[m.length - 1]; if (l && r[0] <= l[1] + FPS) { l[1] = Math.max(l[1], r[1]); l[2].push(...r[2]); } else m.push([...r]); }
  return m;
}

function render(ids) {
  const rs = ranges(ids), t0 = Date.now(), runs = [];
  for (const [a, b, sc] of rs) {
    const r = range(a, b);
    if (fs.existsSync(path.join(OUT, `render-run-${r}.json`)) && fs.existsSync(path.join(REPO, '.frames', 'm3', r))) { runs.push({ range: r, scenes: sc, skipped: true }); continue; }
    execFileSync('node', [path.join(REPO, 'render-d', 'prod', 'render.js'), R, '--from', String(a / FPS), '--to', String(b / FPS)], { stdio: 'inherit' });
    const run = J(path.join(OUT, `render-run-${r}.json`));
    if (run.frames !== b - a) throw new Error(`range ${r}: ${run.frames} frames, expected ${b - a}`);
    runs.push({ range: r, scenes: sc, frames: run.frames, framesSupersampled: run.framesSupersampled, wallSeconds: run.wallSeconds });
  }
  fs.writeFileSync(STATE, JSON.stringify({ scenes: ids, ranges: rs.map(([a, b, sc]) => ({ f0: a, f1: b, range: range(a, b), scenes: sc })), renders: runs, renderWallSeconds: +((Date.now() - t0) / 1000).toFixed(1) }, null, 1));
  console.log('rendered', rs.length, 'ranges in', ((Date.now() - t0) / 1000).toFixed(0), 's');
}

function splice() {
  const st = J(STATE);
  // the round-1 master and its tracks are kept once; every splice starts from them
  const keep = [[path.join(OUT, 'picture.mp4'), path.join(OUT, `picture-${BASE}.mp4`)], [path.join(R, 'out', 'camera.json'), path.join(R, 'out', `camera-${BASE}.json`)], [path.join(OUT, 'text-first.json'), path.join(OUT, `text-first-${BASE}.json`)]];
  for (const [a, b] of keep) if (!fs.existsSync(b)) fs.copyFileSync(a, b);
  const master = path.join(OUT, `picture-${BASE}.mp4`);
  const NF = +execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', master]).toString().trim();
  const kf = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-skip_frame', 'nokey', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', master]).toString().trim().split('\n').map((x) => Math.round(parseFloat(x) * FPS));
  // GOP spans around each range, merged when they touch
  const spans = [];
  for (const r of st.ranges) {
    const kA = Math.max(...kf.filter((k) => k <= r.f0)), kB = Math.min(...kf.filter((k) => k >= r.f1), NF);
    const l = spans[spans.length - 1];
    if (l && kA <= l.kB) { l.kB = Math.max(l.kB, kB); l.parts.push(r); } else spans.push({ kA, kB, parts: [r] });
  }
  const t0 = Date.now(), dir = path.join(REPO, '.frames', 'm3', 'splice');
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // 1) the untouched stretches, cut at keyframes without re-encoding
  const cuts = spans.flatMap((s) => [s.kA, s.kB]).filter((f) => f > 0 && f < NF);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-map', '0:v', '-c', 'copy', '-f', 'segment', '-segment_frames', cuts.join(','), '-reset_timestamps', '1', '-segment_format', 'mp4', path.join(dir, 'seg%03d.mp4')]);
  const segs = fs.readdirSync(dir).filter((f) => /^seg\d+\.mp4$/.test(f)).sort();
  const bounds = [0, ...cuts, NF];
  if (segs.length !== bounds.length - 1) throw new Error(`segment count ${segs.length} != ${bounds.length - 1}`);
  // 2) each GOP span re-encoded: master frames before/after the new range(s) + the new frames (graded)
  const list = [];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = bounds[i], b = bounds[i + 1], sp = spans.find((s) => s.kA === a && s.kB === b);
    if (!sp) { list.push(path.join(dir, segs[i])); continue; }
    const args = ['-y', '-loglevel', 'error'], fc = [], labels = [];
    let n = 0, cur = a;
    const masterPart = (f0, f1) => { args.push('-ss', (f0 / FPS - 0.001).toFixed(6), '-i', master); /* 1 ms early: the first frame kept is exactly f0 */ fc.push(`[${n}:v]trim=end_frame=${f1 - f0},setpts=PTS-STARTPTS,format=yuv420p[p${n}]`); labels.push(`[p${n}]`); n++; };
    for (const r of sp.parts) {
      if (r.f0 > cur) masterPart(cur, r.f0);
      const rdir = path.join(REPO, '.frames', 'm3', r.range);
      const parts = fs.readdirSync(rdir).filter((f) => /^part\d+\.mkv$/.test(f)).sort((x, y) => +x.match(/\d+/)[0] - +y.match(/\d+/)[0]).map((f) => path.join(rdir, f));
      const pl = path.join(rdir, 'list.txt'); fs.writeFileSync(pl, parts.map((f) => `file '${f}'`).join('\n'));
      args.push('-f', 'concat', '-safe', '0', '-i', pl);
      fc.push(`[${n}:v]trim=end_frame=${r.f1 - r.f0},setpts=PTS-STARTPTS,${VF}[p${n}]`); labels.push(`[p${n}]`); n++;
      cur = r.f1;
    }
    if (cur < b) masterPart(cur, b);
    fc.push(`${labels.join('')}concat=n=${labels.length}:v=1:a=0,setpts=N/(30*TB)[v]`);
    const out = path.join(dir, `new${String(i).padStart(3, '0')}.mp4`);
    execFileSync('ffmpeg', [...args, '-filter_complex', fc.join(';'), '-map', '[v]', ...X264, '-frames:v', String(b - a), '-video_track_timescale', '15360', out], { stdio: 'inherit' });
    const got = +execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', out]).toString().trim();
    if (got !== b - a) throw new Error(`span ${a}-${b}: ${got} frames, expected ${b - a}`);
    list.push(out);
  }
  const lf = path.join(dir, 'list.txt'); fs.writeFileSync(lf, list.map((f) => `file '${f}'`).join('\n'));
  const tmp = path.join(OUT, `picture-${ROUND}-tmp.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lf, '-c', 'copy', '-video_track_timescale', '15360', tmp]);
  const NF2 = +execFileSync('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', tmp]).toString().trim();
  if (NF2 !== NF) throw new Error(`spliced picture has ${NF2} frames, master ${NF}`);
  fs.renameSync(tmp, path.join(OUT, 'picture.mp4'));
  const enc = (Date.now() - t0) / 1000;
  // camera track and text first appearances: the re-rendered ranges replace the old ones
  const cam = J(path.join(R, 'out', `camera-${BASE}.json`));
  const inR = (t) => st.ranges.some((r) => t * FPS >= r.f0 - 1e-6 && t * FPS < r.f1 - 1e-6);
  const newCams = st.ranges.flatMap((r) => J(path.join(R, 'out', `camera-${r.range}.json`)).frames);
  cam.frames = [...cam.frames.filter((f) => !inR(f.t)), ...newCams].sort((x, y) => x.t - y.t);
  fs.writeFileSync(path.join(R, 'out', 'camera.json'), JSON.stringify(cam));
  const tf = J(path.join(OUT, `text-first-${BASE}.json`));
  const seen = Object.fromEntries(Object.entries(tf).filter(([, v]) => !inR(v.t)));
  for (const r of st.ranges) for (const [k, v] of Object.entries(J(path.join(OUT, `text-first-${r.range}.json`)))) if (!(k in seen) || v.t < seen[k].t) seen[k] = v;
  fs.writeFileSync(path.join(OUT, 'text-first.json'), JSON.stringify(seen, null, 1));
  st.splice = { masterFrames: NF, splicedFrames: NF2, gopSpans: spans.map((s) => ({ kA: s.kA, kB: s.kB, reencodedFrames: s.kB - s.kA, newFrames: s.parts.reduce((x, r) => x + r.f1 - r.f0, 0) })),
    reencodedFrames: spans.reduce((x, s) => x + s.kB - s.kA, 0), newFrames: st.ranges.reduce((x, r) => x + r.f1 - r.f0, 0), encodeSeconds: +enc.toFixed(1) };
  fs.writeFileSync(STATE, JSON.stringify(st, null, 1));
  console.log('spliced', spans.length, 'GOP spans,', st.splice.newFrames, 'new frames,', st.splice.reencodedFrames, 're-encoded; frames', NF2, '; encode', enc.toFixed(0), 's');
}

if (process.argv[2] === 'render') render(process.argv[3].split(','));
else if (process.argv[2] === 'splice') splice();
else console.log('usage: m3-splice.js render <scenes> | splice');
