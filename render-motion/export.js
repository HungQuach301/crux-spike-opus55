'use strict';
// Exports claims.json (every claim drawn on screen, with the scenes it appears in) and
// script.md (per scene: timing, shot, layout, on-screen text from the rendered DOM, SFX cues,
// narration paced for TTS).
const fs = require('fs');
const path = require('path');
const { timeline, data } = require('./build-data');
const narration = require('../src/car/narration');
const { launch, openPage, paint } = require('./page');

const ROOT = path.join(__dirname, '..');
const words = (s) => s.split(/[\s\-–—]+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const fmtT = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

(async () => {
  const b = await launch(); const p = await openPage(b);
  const FPS = 30, total = Math.round(timeline.total * FPS);
  const where = {}, onscreen = {};
  for (let f = 0; f < total; f += 5) {
    await p.evaluate(() => window.SEG.USED.clear());
    const sid = await paint(p, f / FPS);
    const r = await p.evaluate(() => ({
      used: [...window.SEG.USED],
      shown: [...document.querySelectorAll('#overlay .n')].map((e) => e.dataset.claim),
      texts: [...document.querySelectorAll('#overlay .t')].filter((e) => parseFloat(e.style.opacity) > 0.5).map((e) => [e.dataset.tid, e.innerText.replace(/\n/g, ' ')]),
    }));
    for (const id of r.shown) (where[id] ||= new Set()).add(sid);
    const o = (onscreen[sid] ||= new Map());
    for (const [tid, txt] of r.texts) o.set(tid, txt);
  }
  await b.close();
  const claims = data.claims.filter((c) => where[c.claimId]).map((c) => {
    const { claimId, value, display, formula, note, inputs } = c;
    return { claimId, value, display, formula, ...(note ? { note } : {}), inputs, appearsIn: [...where[c.claimId]] };
  });
  fs.writeFileSync(path.join(ROOT, 'claims.json'), JSON.stringify({
    description: 'Every number drawn on screen in out/segment.mp4 (rolling counters are shown as animations of these claims; the checker verifies every settled number equals its claim). Code: src/car/calc.js, src/car/data.js.',
    sources: 'All inputs are stated in the brief or by us (the $400/month extra and the 8% then -20% sequence). No external rate source is used, so nothing on screen depends on a fetched figure.',
    count: claims.length, claims,
  }, null, 2) + '\n');

  const L = ['# Script — Pay off a 5.2% car loan early, or invest the cash?', '',
    'US-only. No narration was recorded in this spike; the narration below is written for later TTS (US English) and paced per scene.',
    'On-screen text is exported from the rendered frames (render-motion/export.js). SFX cues come from the shared timeline (src/car/timeline.js).', ''];
  let tw = 0;
  for (const s of timeline.scenes) {
    const n = narration.find((x) => x.scene === s.id);
    const w = words(n.text); tw += w;
    L.push(`## ${String(s.index + 1).padStart(2, '0')} ${s.id} — ${fmtT(s.start)}–${fmtT(s.start + s.dur)} (${s.dur.toFixed(1)} s, ${s.beats} beats) · ${s.shot} · ${s.layout} · ${s.section}`, '');
    L.push('**On screen**', '');
    for (const [, txt] of onscreen[s.id] || []) L.push(`- ${txt}`);
    const ev = timeline.events.filter((e) => e.scene === s.id);
    const counts = {}; ev.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
    const sil = timeline.silences.filter((x) => x.scene === s.id).map((x) => `music silence ${fmtT(x.start)}–${fmtT(x.end)}`);
    const st = timeline.still.filter((x) => x.scene === s.id).map((x) => `stillness ${fmtT(x.start)}–${fmtT(x.end)}`);
    L.push('', `**Sound** ${Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ') || '—'}${sil.length ? ' · ' + sil.join(', ') : ''}${st.length ? ' · ' + st.join(', ') : ''}`, '');
    L.push(`**Narration** (${w} words, ${(w / s.dur * 60).toFixed(0)} wpm)`, '', `> ${n.text}`, '');
    if (n.numbers.length) L.push('Spoken numbers → claims: ' + n.numbers.map(([ph, id, d]) => `"${ph}" → \`${id}\` (${d})`).join('; '), '');
  }
  L.push('## Pace', '', `Total narration: ${tw} words over ${timeline.total} s = ${(tw / timeline.total * 60).toFixed(1)} wpm (target 150–160).`, '');
  fs.writeFileSync(path.join(ROOT, 'script.md'), L.join('\n'));
  console.log('claims', claims.length, 'narration wpm', (tw / timeline.total * 60).toFixed(1));
})().catch((e) => { console.error(e); process.exit(1); });
