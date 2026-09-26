'use strict';
// Reading pace, measured on the real voice: words per minute per chapter (words / speech time of
// its clips), per clip, and per sentence (words / (last word end - first word start), aligned
// faster-whisper times). Limits: every chapter 150-160 wpm; no sentence above 175 wpm.
// Writes out/voice/pace.json. Exit code 1 when a limit fails (lists what fails).
const fs = require('fs');
const path = require('path');
const { alignWords } = require('./timeline');
const script = require('./script');

const ROOT = path.join(__dirname, '..', '..');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'voice', f), 'utf8'));
const STAGE = process.env.PACE_STAGE || 'final'; // raw: the TTS clips (feeds audio/av_retime.py); final: what the video uses
const prep = rd('script.json'), asr = rd(STAGE === 'raw' ? 'asr-raw.json' : 'asr.json');
const CH = [150, 160], SENT_MAX = 175;
const rows = [], sentences = [], chapters = {};
for (const p of prep.scenes) {
  const a = asr.scenes[p.id];
  if (!a) continue;
  const ch = script.find((s) => s.id === p.id).chapter;
  const aligned = alignWords(p.spokenWords, a.words), al = aligned.words;
  const n = p.spokenWords.length;
  // coverage: share of script words the ASR actually heard (the TTS sometimes drops a sentence)
  rows.push({ scene: p.id, chapter: ch, words: n, seconds: a.duration, wpm: +(n / a.duration * 60).toFixed(1), coverage: +(aligned.matched / n).toFixed(3) });
  (chapters[ch] ||= { words: 0, seconds: 0 });
  chapters[ch].words += n; chapters[ch].seconds += a.duration;
  let s0 = 0;
  p.spokenWords.forEach((w, i) => {
    if ((/[.?!]$/.test(w) && !/^([A-Za-z]\.)+$/.test(w)) || i === n - 1) { // "U.S." does not end a sentence
      const words = i - s0 + 1, dur = Math.max(0.05, al[i].end - al[s0].start);
      sentences.push({ scene: p.id, text: p.spokenWords.slice(s0, i + 1).join(' '), words, start: +al[s0].start.toFixed(3), end: +al[i].end.toFixed(3), seconds: +dur.toFixed(3), wpm: +(words / dur * 60).toFixed(1) });
      s0 = i + 1;
    }
  });
}
// final stage: sentence boundaries are known exactly (audio/av_retime.py built the clip); the
// sentence pace is words / speech span (first to last loud 10 ms window), not whisper edges
if (STAGE === 'final') {
  const rt = rd('retime.json');
  sentences.length = 0;
  for (const [scene, v] of Object.entries(rt)) for (const x of v.sentences) sentences.push({ scene, text: x.text, words: x.words, start: x.start, seconds: x.speechS, wpm: x.wpmAfter, tempo: x.tempo });
}
const chap = Object.fromEntries(Object.entries(chapters).map(([k, v]) => [k, { ...v, seconds: +v.seconds.toFixed(2), wpm: +(v.words / v.seconds * 60).toFixed(1), pass: v.words / v.seconds * 60 >= CH[0] && v.words / v.seconds * 60 <= CH[1] }]));
const fast = sentences.filter((s) => s.wpm > SENT_MAX);
const COVER = 0.92;
const dropped = rows.filter((r) => r.coverage < COVER);
const res = { limits: { chapterWpm: CH, sentenceMaxWpm: SENT_MAX, minWordCoverage: COVER }, chapters: chap, fastSentences: fast, droppedWords: dropped,
  pass: Object.values(chap).every((c) => c.pass) && !fast.length && !dropped.length, clips: rows, sentences };
fs.writeFileSync(path.join(ROOT, 'out', 'voice', STAGE === 'raw' ? 'pace-raw.json' : 'pace.json'), JSON.stringify({ stage: STAGE, ...res }, null, 1));
module.exports = res;
if (require.main === module) {
  for (const [k, v] of Object.entries(chap)) console.log(k.padEnd(6), v.words, v.seconds, v.wpm, v.pass ? 'ok' : 'FAIL');
  for (const s of fast) console.log('  FAST', s.scene, s.wpm, JSON.stringify(s.text));
  for (const r of dropped) console.log('  DROPPED WORDS', r.scene, 'coverage', r.coverage);
  console.log('slowest sentence', Math.min(...sentences.map((s) => s.wpm)), 'fastest', Math.max(...sentences.map((s) => s.wpm)));
  process.exitCode = res.pass ? 0 : 1;
}
