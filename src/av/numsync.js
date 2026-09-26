'use strict';
// Spoken-number sync: every number the voice says must appear on screen within ±250 ms of the
// moment faster-whisper says the word starts. "Appear" = the first rendered frame of a run in
// which a span of that claim has effective opacity >= 0.5 (out/claim-visibility.json, recorded
// by render-av/render.js). A number already on screen before the window counts as a slip
// ("pre-shown"): the convention is that spoken numbers are introduced at their word.
// Writes out/number-sync.json.
const fs = require('fs');
const path = require('path');
const N = require('./normalize');
const { compare } = require('./asrcheck');

const LIMIT = 0.25;

function run() {
  const ROOT = path.join(__dirname, '..', '..');
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'out', f), 'utf8'));
  const tl = rd('timeline.json'), asr = rd('voice/asr.json'), vis = rd('claim-visibility.json');
  const rows = [];
  for (const s of tl.scenes) {
    const nums = (s.markers || []).filter((m) => m.kind === 'number');
    if (!nums.length) continue;
    const joined = N.joinAsrTokens(asr.scenes[s.id].words);
    const words = joined.map((w) => w.w);
    const heard = N.parseNumberWords(words).map((x) => ({ canon: x.canon, t: joined[x.start].start }));
    const expected = nums.flatMap((m) => m.canon.map((c) => ({ canon: c, claimId: m.claimId, name: m.name })));
    const { pairs, missing } = compare(expected, heard);
    for (const [e, h] of pairs) {
      const onset = s.voice.start + h.t;
      const runs = Object.entries(vis.runs).filter(([k]) => k.split('|')[0] === e.claimId).flatMap(([k, r]) => r.map(([a, b]) => ({ tid: k.split('|')[1], a, b })));
      const covering = runs.filter((r) => r.a <= onset - LIMIT && r.b > onset - LIMIT);
      let best = null;
      for (const r of runs) if (!best || Math.abs(r.a - onset) < Math.abs(best.a - onset)) best = r;
      const off = best ? best.a - onset : null;
      const status = covering.length && (!best || Math.abs(off) > LIMIT) ? 'pre-shown' : best && Math.abs(off) <= LIMIT ? 'ok' : best ? 'late-or-early' : 'never shown';
      rows.push({ scene: s.id, claimId: e.claimId, canon: e.canon, spokenAt: +onset.toFixed(3), appearsAt: best ? best.a : null, tid: best ? best.tid : null, offsetMs: off === null ? null : Math.round(off * 1000), status });
    }
    for (const e of missing) rows.push({ scene: s.id, claimId: e.claimId, canon: e.canon, spokenAt: null, status: 'not heard by ASR (see asr-numbers.json)' });
  }
  const offs = rows.filter((r) => r.offsetMs !== null).map((r) => Math.abs(r.offsetMs));
  const slips = rows.filter((r) => r.status !== 'ok');
  const res = {
    definition: 'offset = first frame a span of the claim shows its FINAL value (no data-roll) at opacity >= 0.5, minus the faster-whisper word start of the spoken number; limit ±250 ms. No spoken number uses a rolling counter.',
    numbers: rows.length, maxAbsOffsetMs: Math.max(0, ...offs), meanAbsOffsetMs: offs.length ? Math.round(offs.reduce((a, b) => a + b, 0) / offs.length) : null,
    slips, pass: slips.length === 0, rows,
  };
  fs.writeFileSync(path.join(ROOT, 'out', 'number-sync.json'), JSON.stringify(res, null, 1));
  return res;
}
module.exports = { run };
if (require.main === module) {
  const r = run();
  console.log(`number sync: ${r.numbers} numbers, max ${r.maxAbsOffsetMs} ms, mean ${r.meanAbsOffsetMs} ms, slips ${r.slips.length}, pass=${r.pass}`);
  for (const s of r.slips) console.log('  SLIP', JSON.stringify(s));
}
