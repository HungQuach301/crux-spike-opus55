'use strict';
// Readable script: acts (question / turn / payoff), scenes (time, layout, shot), every line with its performance
// direction and planned timing. Writes out/script.md from src/d/script.js + out/script.json + out/timeline.json.
const fs = require('fs');
const path = require('path');
const { ACTS } = require('./script');

const ROOT = path.join(__dirname, '..', '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const tl = J('out/timeline.json'), sents = J('out/script.json').sentences;
const mmss = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const out = [`# Same average, different fate — script (M1)\n`,
  `Running time ${mmss(tl.total)} (${tl.total.toFixed(1)} s) from the table-read takes with the planned stretch. ${sents.length} lines, ${sents.reduce((n, s) => n + s.spoken.split(/\s+/).length, 0)} spoken words.`,
  'Text = subtitles/screen (numbers as digits); every number is a claim in out/claims.json. Directions go to TTS with each line. "We" is the analyst only.\n'];
for (const a of ACTS) {
  const act = tl.acts.find((x) => x.id === a.id);
  out.push(`\n## ${a.title} — ${mmss(act.start)}–${mmss(act.end)}${act.climax !== undefined ? ` (climax ${mmss(act.climax)})` : ''}\n`);
  if (a.question) out.push(`- **Question:** ${a.question}`);
  if (a.turn) out.push(`- **Turn:** ${a.turn}`);
  if (a.payoff) out.push(`- **Payoff:** ${a.payoff}\n`);
  for (const sc of a.scenes) {
    const shots = tl.scenes.filter((s) => s.id === sc.id || s.id === sc.id + '-b' || s.id === sc.id + '-c');
    const s0 = shots[0];
    out.push(`\n**${sc.id}** · ${mmss(s0.start)} · ${shots.reduce((n, s) => n + s.dur, 0).toFixed(1)} s · ${s0.layout} · ${shots.map((s) => s.shot.size).join(' → ')}`);
    if (!sc.lines.length) out.push('  - *(picture only)*');
    sc.lines.forEach((l, i) => {
      const s = sents.find((x) => x.id === `${sc.id}.${i + 1}`);
      out.push(`  - \`${mmss(s.start)}\` ${l.t}${l.decisive ? ' **[decisive: ≥ 1 s silence after]**' : ''}\n    - *${l.d}*${l.sp ? `\n    - spoken: "${l.sp}"` : ''}`);
    });
  }
}
fs.writeFileSync(path.join(ROOT, 'out', 'script.md'), out.join('\n') + '\n');
console.log('out/script.md', out.length, 'lines');
