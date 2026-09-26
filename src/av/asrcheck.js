'use strict';
// ASR number check: every number the narration speaks, as heard by faster-whisper small.en, must
// equal its claim. Both sides go through the same normalizer (src/av/normalize.js) before the
// comparison, so "5.2%" and "five point two percent" meet as pct:5.2. Pass = 100%. Every
// mismatch (wrong value, wrong kind, missing, extra) is listed. Writes out/asr-numbers.json.
const fs = require('fs');
const path = require('path');
const N = require('./normalize');

function compare(expected, heard) {
  // order-preserving alignment of two canonical lists (LCS), then list the leftovers
  const n = expected.length, m = heard.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = expected[i].canon === heard[j].canon ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pairs = [], missing = [], extra = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (expected[i].canon === heard[j].canon) { pairs.push([expected[i], heard[j]]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) missing.push(expected[i++]);
    else extra.push(heard[j++]);
  }
  while (i < n) missing.push(expected[i++]);
  while (j < m) extra.push(heard[j++]);
  return { pairs, missing, extra };
}

function run() {
  const ROOT = path.join(__dirname, '..', '..');
  const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'voice', 'script.json'), 'utf8'));
  const asr = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'voice', 'asr.json'), 'utf8'));
  const rows = [], mismatches = [];
  let total = 0, ok = 0;
  for (const s of script.scenes) {
    const nums = s.markers.filter((m) => m.kind === 'number');
    if (!nums.length && !(asr.scenes[s.id] || {}).text) continue;
    const expected = nums.flatMap((m) => m.canon.map((c) => ({ canon: c, claimId: m.claimId, display: m.display })));
    const joined = N.joinAsrTokens((asr.scenes[s.id] || {}).words || []);
    const words = joined.map((w) => w.w);
    const heard = N.parseNumberWords(words).map((x) => ({ canon: x.canon, heardAs: words.slice(x.start, x.end).join(' '), t: joined[x.start].start }));
    const r = compare(expected, heard);
    total += expected.length; ok += r.pairs.length;
    for (const e of r.missing) {
      const near = r.extra.find((x) => x.canon.split(':')[1] === e.canon.split(':')[1]);
      mismatches.push({ scene: s.id, claimId: e.claimId, expected: e.canon, heard: near ? near.canon : null, heardAs: near ? near.heardAs : null, kind: near ? 'value right, kind differs' : 'missing' });
    }
    for (const x of r.extra) if (!mismatches.some((mm) => mm.scene === s.id && mm.heard === x.canon)) mismatches.push({ scene: s.id, expected: null, heard: x.canon, heardAs: x.heardAs, kind: 'extra number heard' });
    rows.push({ scene: s.id, asrText: (asr.scenes[s.id] || {}).text, expected: expected.map((e) => e.canon), heard: heard.map((h) => h.canon), matched: r.pairs.length, of: expected.length });
  }
  const res = { asrModel: asr.model, spokenNumbers: total, correct: ok, percent: +(100 * ok / Math.max(1, total)).toFixed(1), pass: ok === total && !mismatches.length, mismatches, scenes: rows };
  fs.writeFileSync(path.join(ROOT, 'out', 'asr-numbers.json'), JSON.stringify(res, null, 1));
  return res;
}

module.exports = { compare, run };
if (require.main === module) {
  const r = run();
  console.log(`ASR numbers: ${r.correct}/${r.spokenNumbers} (${r.percent}%) pass=${r.pass}`);
  for (const m of r.mismatches) console.log('  MISMATCH', JSON.stringify(m));
}
