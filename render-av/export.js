'use strict';
// Exports claims.json (every number shown OR spoken in out/video.mp4) and out/script.md.
//   shownIn: scenes where a span of the claim reached opacity >= 0.5 (out/claim-visibility.json)
//   spoken:  each time the narration says it: scene, spoken form, faster-whisper onset, and the
//            on-screen appearance offset (out/number-sync.json)
const fs = require('fs');
const path = require('path');
const data = require('../src/av/data').build();

const ROOT = path.join(__dirname, '..');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'out', f), 'utf8'));
const tl = rd('timeline.json'), vis = rd('claim-visibility.json'), sync = rd('number-sync.json'), asr = rd('asr-numbers.json');
const fmtT = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const sceneAt = (t) => tl.scenes.find((s) => t >= s.start && t < s.start + s.dur);

const shownIn = {};
for (const [k, runs] of Object.entries(vis.runs)) {
  const id = k.split('|')[0];
  for (const [a, b] of runs) { const s = sceneAt((a + b) / 2) || sceneAt(a); if (s) (shownIn[id] ||= new Set()).add(s.id); }
}
const spoken = {};
for (const s of tl.scenes) for (const m of (s.markers || []).filter((x) => x.kind === 'number')) {
  const row = sync.rows.find((r) => r.scene === s.id && r.claimId === m.claimId && r.canon === m.canon[0]);
  (spoken[m.claimId] ||= []).push({ scene: s.id, spokenForm: m.spokenForm, canon: m.canon.join(', '), asrOnsetS: row ? row.spokenAt : null, appearsOnScreenS: row ? row.appearsAt : null, offsetMs: row ? row.offsetMs : null });
}
const claims = data.claims.filter((c) => shownIn[c.claimId] || spoken[c.claimId]).map((c) => {
  const { claimId, value, display, formula, note, inputs, illustrative } = c;
  return { claimId, value, display, formula, ...(note ? { note } : {}), ...(illustrative ? { illustrative: true } : {}), inputs, shownIn: [...(shownIn[claimId] || [])], spoken: spoken[claimId] || [] };
});
const spokenCount = claims.reduce((a, c) => a + c.spoken.length, 0);
fs.writeFileSync(path.join(ROOT, 'claims.json'), JSON.stringify({
  description: 'Test C: every number drawn on screen or spoken in out/video.mp4. Code: src/av/calc.js (per-lot tax model), src/av/data.js. Spoken numbers carry their faster-whisper onset and the time the number appears on screen.',
  sources: 'All inputs are stated in the brief or by us. ILLUSTRATIVE (our choice, not a forecast): $400/month extra, the 2%–10% return range, the 8% then −20% sequence. The model ignores the 2025–2028 new-vehicle loan interest deduction and treats loan interest as not deductible.',
  scope: tl.scenes.length < 30 ? 'midpoint build: hook, ident, setup, chapter 1' : 'full video',
  counts: { claims: claims.length, shown: claims.filter((c) => c.shownIn.length).length, spokenOccurrences: spokenCount, asrCorrect: `${asr.correct}/${asr.spokenNumbers}` },
  claims,
}, null, 2) + '\n');

const L = ['# Script — test C: car loan 5.2%, pay off early or invest', '',
  'US only. The narration is the source of the subtitles; numbers are written as on screen and spoken through `src/av/normalize.js`.',
  'Timing comes from the voice (TTS clip lengths and faster-whisper word onsets). The voice is provisional.', ''];
let words = 0, speech = 0;
for (const s of tl.scenes) {
  L.push(`## ${String(s.index + 1).padStart(2, '0')} ${s.id} — ${fmtT(s.start)}–${fmtT(s.start + s.dur)} (${s.dur.toFixed(1)} s) · ${s.chapter} · ${s.shot} · ${s.layout}`, '');
  if (s.display) {
    const n = s.words.length, d = s.voice.dur; words += n; speech += d;
    L.push(`> ${s.display}`, '', `Spoken (${n} words in ${d.toFixed(2)} s = ${(n / d * 60).toFixed(0)} wpm): ${s.words.map((w) => w.w).join(' ')}`, '');
    const nums = (s.markers || []).filter((m) => m.kind === 'number');
    if (nums.length) L.push('Numbers: ' + nums.map((m) => { const r = sync.rows.find((x) => x.scene === s.id && x.claimId === m.claimId); return `\`${m.claimId}\` ${m.display} ("${m.spokenForm}")${r ? ` said at ${r.spokenAt.toFixed(2)} s, on screen ${r.offsetMs >= 0 ? '+' : ''}${r.offsetMs} ms` : ''}`; }).join('; '), '');
  } else L.push('_(no narration)_', '');
  const ev = tl.events.filter((e) => e.scene === s.id);
  const c = {}; ev.forEach((e) => { c[e.type] = (c[e.type] || 0) + 1; });
  L.push(`Sound: ${Object.entries(c).map(([k, v]) => `${k}×${v}`).join(', ') || '—'}`, '');
}
L.push('## Pace', '', `${words} spoken words in ${speech.toFixed(1)} s of speech = ${(words / speech * 60).toFixed(1)} wpm.`, '');
fs.writeFileSync(path.join(ROOT, 'out', 'script.md'), L.join('\n'));
console.log('claims', claims.length, 'spoken occurrences', spokenCount);
