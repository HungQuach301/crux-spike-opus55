'use strict';
// Subtitles from the script (never from ASR), timed by aligned word onsets.
// Limits: <= 42 characters per line, <= 2 lines, 1–7 s per cue. Writes out/captions.srt and
// out/captions-check.json (limits + a 100% text match against the script).
const MAX_LINE = 42, MAX_LINES = 2, MIN_DUR = 1.0, MAX_DUR = 7.0;

function wrap(words) {
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if (cur.length + 1 + w.length <= MAX_LINE) lines[lines.length - 1] = cur + ' ' + w;
    else lines.push(w);
  }
  return lines;
}

function build(timeline) {
  const cues = [];
  for (const s of timeline.scenes) {
    const W = s.displayWords || [];
    let cur = [];
    const flush = () => { if (cur.length) cues.push({ scene: s.id, words: cur }); cur = []; };
    for (let i = 0; i < W.length; i++) {
      const next = [...cur, W[i]];
      const tooLong = wrap(next.map((x) => x.w)).length > MAX_LINES || W[i].end - next[0].start > MAX_DUR;
      if (tooLong) { flush(); cur = [W[i]]; } else cur = next;
      // prefer breaking after a sentence end once the cue has some length
      const txt = cur.map((x) => x.w).join(' ');
      if (/[.?!]$/.test(W[i].w) && txt.length >= 24 && i < W.length - 1) flush();
    }
    flush();
  }
  // timing: start at the first word, end at the last word + up to 0.4 s hold, >= 1 s where room allows
  cues.forEach((c, i) => {
    c.start = c.words[0].start;
    const nextStart = i + 1 < cues.length ? cues[i + 1].words[0].start : Infinity;
    c.end = Math.min(c.words[c.words.length - 1].end + 0.4, nextStart - 0.05, c.start + MAX_DUR);
    if (c.end - c.start < MIN_DUR) c.end = Math.min(c.start + MIN_DUR, nextStart - 0.05);
    c.text = wrap(c.words.map((x) => x.w));
  });
  return cues;
}

const ts = (t) => {
  const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const toSrt = (cues) => cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text.join('\n')}\n`).join('\n');

function parseSrt(srt) {
  return srt.trim().split(/\n\s*\n/).map((b) => {
    const [idx, time, ...lines] = b.split('\n');
    const [a, z] = time.split(' --> ').map((x) => { const [hms, ms] = x.split(','); const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + s + Number(ms) / 1000; });
    return { idx: Number(idx), start: a, end: z, lines };
  });
}

function check(srt, timeline) {
  const cues = parseSrt(srt);
  const issues = [];
  cues.forEach((c, i) => {
    if (c.lines.length > MAX_LINES) issues.push({ cue: c.idx, issue: `${c.lines.length} lines` });
    for (const l of c.lines) if (l.length > MAX_LINE) issues.push({ cue: c.idx, issue: `line of ${l.length} chars` });
    const d = c.end - c.start;
    if (d < MIN_DUR - 1e-6 || d > MAX_DUR + 1e-6) issues.push({ cue: c.idx, issue: `duration ${d.toFixed(2)} s` });
    if (i && c.start < cues[i - 1].end) issues.push({ cue: c.idx, issue: 'overlaps previous cue' });
  });
  const norm = (x) => x.replace(/\s+/g, ' ').trim();
  const script = norm(timeline.scenes.map((s) => s.display).filter(Boolean).join(' '));
  const subs = norm(cues.map((c) => c.lines.join(' ')).join(' '));
  const match = script === subs;
  let firstDiff = null;
  if (!match) { let k = 0; while (k < script.length && script[k] === subs[k]) k++; firstDiff = { at: k, script: script.slice(k, k + 40), subs: subs.slice(k, k + 40) }; }
  const durs = cues.map((c) => c.end - c.start);
  return {
    cues: cues.length, maxLineChars: Math.max(...cues.flatMap((c) => c.lines.map((l) => l.length))), maxLines: Math.max(...cues.map((c) => c.lines.length)),
    minDurS: +Math.min(...durs).toFixed(2), maxDurS: +Math.max(...durs).toFixed(2), issues,
    textMatchesScript: match, scriptChars: script.length, subtitleChars: subs.length, firstDiff,
    pass: !issues.length && match,
  };
}

module.exports = { build, toSrt, parseSrt, check, MAX_LINE, MAX_LINES, MIN_DUR, MAX_DUR };

if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const OUT = path.join(__dirname, '..', '..', 'out');
  const tl = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));
  const srt = toSrt(build(tl));
  fs.writeFileSync(path.join(OUT, 'captions.srt'), srt);
  const r = check(srt, tl);
  fs.writeFileSync(path.join(OUT, 'captions-check.json'), JSON.stringify(r, null, 1));
  console.log(JSON.stringify(r));
}
