'use strict';
// Exports claims.json (every number drawn on screen) and script.md (on-screen text, generated
// from the rendered DOM, plus narration). Run after any change to data or scenes.
const fs = require('fs');
const path = require('path');
const { all, SOURCE } = require('./build-data');
const narration = require('../src/narration');
const { launch, openPage, paint } = require('./page');

const ROOT = path.join(__dirname, '..');
const words = (s) => s.split(/[\s\-–—]+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;

(async () => {
  const b = await launch(); const p = await openPage(b);
  const scenes = await p.evaluate(() => window.SEG.SCENES);
  const total = await p.evaluate(() => window.SEG.TOTAL);
  const used = { normal: new Set(), extreme: new Set(), missing: new Set() };
  const where = {};
  const note = (ds, id, what) => { used[ds].add(id); (where[`${ds}:${id}`] ||= new Set()).add(what); };
  const onscreen = {};
  // whole video, every 5th frame, plus each hold frame
  for (let f = 0; f < total * 30; f += 5) {
    await p.evaluate(() => window.SEG.USED.clear());
    const sid = await paint(p, f / 30, 'normal');
    (await p.evaluate(() => [...window.SEG.USED])).forEach((id) => note('normal', id, `segment.mp4:${sid}`));
  }
  for (const s of scenes) {
    await paint(p, s.start + s.hold, 'normal');
    onscreen[s.id] = await p.evaluate(() => [...document.querySelectorAll('#scene .t, #scene .cell')].map((e) => e.innerText.replace(/\n/g, ' ').trim()).filter(Boolean));
  }
  const tb = scenes.find((s) => s.id === 'tableB');
  for (const ds of ['normal', 'extreme', 'missing']) {
    await p.evaluate(() => window.SEG.USED.clear());
    await paint(p, tb.start + tb.hold, ds);
    (await p.evaluate(() => [...window.SEG.USED])).forEach((id) => note(ds, id, `frame-${ds}.png`));
  }
  await b.close();

  const claims = [];
  for (const ds of ['normal', 'extreme', 'missing']) {
    for (const c of all[ds].claims) {
      if (!used[ds].has(c.claimId)) continue;
      const { claimId, dataset, value, display, formula, source, sourceIndex, sourceDate, note: n, inputs } = c;
      const entry = { claimId: `${dataset}/${claimId}`, dataset, value, display, appearsIn: [...where[`${ds}:${claimId}`]].sort() };
      if (source) Object.assign(entry, { source, sourceIndex, sourceDate });
      else entry.formula = formula;
      if (n) entry.note = n;
      entry.inputs = inputs;
      claims.push(entry);
    }
  }
  fs.writeFileSync(path.join(ROOT, 'claims.json'), JSON.stringify({
    description: 'Every number drawn on screen in out/segment.mp4 and out/frame-*.png. value = computed value; display = exact on-screen string. Code: src/calc.js, src/data.js.',
    baseRateSource: SOURCE,
    count: claims.length,
    claims,
  }, null, 2) + '\n');

  // script.md
  const lines = ['# Script — Buying mortgage points: how long must we keep the home to break even?', '',
    'US-only. Silent segment; narration below is for later TTS (US English).',
    'On-screen text is exported from the rendered frames (render/export.js), so it matches the video exactly.', ''];
  let totalWords = 0;
  for (const s of scenes) {
    const n = narration.find((x) => x.scene === s.id);
    const w = words(n.text); totalWords += w;
    lines.push(`## ${s.id} — ${s.start.toFixed(0)}s to ${(s.start + s.dur).toFixed(0)}s (${s.dur}s)`, '', '**On screen**', '');
    onscreen[s.id].forEach((t) => lines.push(`- ${t}`));
    lines.push('', `**Narration** (${w} words, ${(w / s.dur * 60).toFixed(0)} wpm)`, '', `> ${n.text}`, '');
    if (n.numbers.length) lines.push('Spoken numbers → claims: ' + n.numbers.map(([ph, id]) => `"${ph}" → \`normal/${id}\``).join('; '), '');
  }
  lines.push('## Pace', '', `Total narration: ${totalWords} words over ${total}s = ${(totalWords / total * 60).toFixed(1)} wpm (target 150–160).`, '');
  fs.writeFileSync(path.join(ROOT, 'script.md'), lines.join('\n'));
  console.log('claims', claims.length, 'words', totalWords, 'wpm', (totalWords / total * 60).toFixed(1));
})().catch((e) => { console.error(e); process.exit(1); });
