'use strict';
// Turns the marked-up script into display text (subtitles), spoken text (TTS) and markers with
// spoken-word indices. Numbers are spoken from their claim's display, through normalize.js.
const N = require('./normalize');

const TOKEN = /\{([a-z0-9_]+)\}|\^([A-Za-z0-9_]+)\s*/g;

function prepareScene(scene, claimsById) {
  const pieces = []; // { kind: 'text'|'claim'|'anchor', display, spoken, name }
  let last = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(scene.text))) {
    if (m.index > last) pieces.push({ kind: 'text', display: scene.text.slice(last, m.index) });
    if (m[1]) {
      const c = claimsById[m[1]];
      if (!c) throw new Error(`${scene.id}: unknown claim ${m[1]}`);
      pieces.push({ kind: 'claim', claimId: m[1], display: c.display });
    } else pieces.push({ kind: 'anchor', name: m[2], display: '' });
    last = TOKEN.lastIndex;
  }
  if (last < scene.text.length) pieces.push({ kind: 'text', display: scene.text.slice(last) });

  const spokenWords = [], displayWords = [];
  const markers = [];
  const seen = {};
  let pendingAnchor = null;
  // build display text and spoken text piece by piece, tracking word positions
  let display = '', spoken = '';
  for (const p of pieces) {
    if (p.kind === 'anchor') { pendingAnchor = p.name; continue; }
    const sp = N.toSpoken(p.display);
    const dispGlue = display && !/\s$/.test(display) && !/^\s/.test(p.display) && p.kind === 'claim' ? '' : '';
    display += dispGlue + p.display;
    spoken += (spoken && !/\s$/.test(spoken) && !/^[\s,.;:?!]/.test(sp) && p.kind === 'claim' && !/[\s(]$/.test(spoken) ? '' : '') + sp;
    const before = N.splitWords(spoken.slice(0, spoken.length - sp.length)).length;
    const wordsHere = N.splitWords(sp).length;
    // a piece that starts mid-word (e.g. "road B's") is still anchored at its first word
    if (pendingAnchor) { markers.push({ name: pendingAnchor, kind: 'anchor', word: before }); pendingAnchor = null; }
    if (p.kind === 'claim') {
      seen[p.claimId] = (seen[p.claimId] || 0) + 1;
      const name = seen[p.claimId] === 1 ? p.claimId : `${p.claimId}#${seen[p.claimId]}`;
      const parsed = N.parseNumbers(p.display);
      markers.push({ name, kind: 'number', claimId: p.claimId, display: p.display, spokenForm: sp.trim(), word: before, words: wordsHere, canon: parsed.map((x) => x.canon) });
    }
  }
  display = display.replace(/\s+/g, ' ').trim();
  spoken = spoken.replace(/\s+/g, ' ').trim();
  // canonical numbers in context ("month 28" -> month:28): parse the whole display text and hand
  // the results to the number markers in order
  const nums = markers.filter((x) => x.kind === 'number');
  const parsed = N.parseNumbers(display);
  let k = 0;
  for (const x of nums) { x.canon = parsed.slice(k, k + x.canon.length).map((p) => p.canon); k += x.canon.length; }
  return { id: scene.id, display, spoken, markers, spokenWords: N.splitWords(spoken), displayWords: N.splitWords(display) };
}

/** Checks the script obeys its own rules; returns a list of problems (empty = clean). */
function lint(scene, prepared) {
  const out = [];
  const textOnly = scene.text.replace(/\{[a-z0-9_]+\}/g, ' ').replace(/\^[A-Za-z0-9_]+/g, ' ');
  if (/\d/.test(textOnly)) out.push(`${scene.id}: bare digit in script text`);
  const stray = N.parseNumbers(textOnly);
  if (stray.length) out.push(`${scene.id}: number word outside a claim: ${stray.map((x) => x.canon).join(', ')}`);
  if (/expected return/i.test(scene.text)) out.push(`${scene.id}: says "expected return"`);
  if (/\byou(r)?\b|\bshould\b/i.test(scene.text)) out.push(`${scene.id}: addresses or advises the viewer`);
  // spoken text must parse back to exactly the claim numbers, in order
  const want = prepared.markers.filter((m) => m.kind === 'number').flatMap((m) => m.canon);
  const got = N.parseNumbers(prepared.spoken).map((x) => x.canon);
  if (JSON.stringify(want) !== JSON.stringify(got)) out.push(`${scene.id}: spoken numbers ${JSON.stringify(got)} != claims ${JSON.stringify(want)}`);
  const disp = N.parseNumbers(prepared.display);
  if (disp.length !== want.length) out.push(`${scene.id}: display has ${disp.length} numbers, markers ${want.length}`);
  for (const m of prepared.markers.filter((x) => x.kind === 'number')) {
    const alone = N.parseNumbers(m.display).map((x) => x.canon.split(':')[1]);
    if (JSON.stringify(alone) !== JSON.stringify(m.canon.map((c) => c.split(':')[1]))) out.push(`${scene.id}: ${m.name} value ${m.canon} != claim display ${m.display}`);
  }
  // piecewise normalization must equal whole-text normalization
  if (N.toSpoken(prepared.display).replace(/\s+/g, ' ') !== prepared.spoken) out.push(`${scene.id}: piecewise spoken text differs from whole-text normalization`);
  return out;
}

module.exports = { prepareScene, lint };

if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const data = require('./data').build();
  const script = require('./script');
  const only = process.env.PART === 'mid' ? require('./parts').MID : null;
  const scenes = script.filter((s) => !only || only.includes(s.chapter));
  const prepared = scenes.map((s) => prepareScene(s, data.byId));
  const problems = scenes.flatMap((s, i) => (s.text ? lint(s, prepared[i]) : []));
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  const dir = path.join(__dirname, '..', '..', 'out', 'voice');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'script.json'), JSON.stringify({ scenes: prepared }, null, 1));
  const words = prepared.reduce((a, p) => a + p.spokenWords.length, 0);
  console.log(`prepared ${prepared.length} scenes, ${words} spoken words`);
}
