'use strict';
// Flatten the script into sentences for TTS: id, scene, act, text (screen/subtitle), spoken (TTS words), direction.
// Writes out/voice/sentences.json. Sentence ids: <scene>.<n>.
const fs = require('fs');
const path = require('path');
const { ACTS } = require('./script');
const { toSpoken } = require('./speak');
const { withPauses } = require('./pauses');

const ROOT = path.join(__dirname, '..', '..');
const TAKES = path.join(ROOT, 'out', 'voice', 'openai-m1', 'takes-wanted.json'); // sentence -> number of takes to generate

// ElevenLabs reads the text as written: the OpenAI-only `sp` pause hacks of M1 are not used.
function sentences() {
  const takes = fs.existsSync(TAKES) ? JSON.parse(fs.readFileSync(TAKES, 'utf8')) : {};
  const out = [];
  for (const a of ACTS) for (const s of a.scenes) s.lines.forEach((l, i) => {
    const id = `${s.id}.${i + 1}`;
    out.push({ id, scene: s.id, act: a.id, text: l.t, spoken: withPauses(toSpoken(l.pause || l.t)), direction: l.d, decisive: !!l.decisive, takes: (takes[id] && takes[id].n) || 1, paceHint: (takes[id] && takes[id].hint) || '' });
  });
  return out;
}

module.exports = { sentences };

if (require.main === module) {
  const s = sentences();
  fs.mkdirSync(path.join(ROOT, 'out', 'voice'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'voice', 'sentences.json'), JSON.stringify({ sentences: s }, null, 1));
  const words = s.reduce((n, x) => n + x.spoken.split(/\s+/).length, 0);
  console.log('sentences', s.length, 'spoken words', words, '-> at 155 wpm', (words / 155).toFixed(2), 'min of speech');
}
