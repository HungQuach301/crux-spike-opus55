'use strict';
// Test D M2b lookdev contract root (out/m2b/root):
//   node src/d/m2b-glue.js pre   -> timeline, script, claims, page.json, silences, tempo map, transitions, captions,
//                                   description, adbreaks, cue sheet, physical sound spec (after src/d/m2b-build.js)
//   node src/d/m2b-glue.js post  -> sfx-events.json (first appearance of each number) and render-log.json
const fs = require('fs');
const path = require('path');
const B = require('./m2b-build');

const REPO = path.join(__dirname, '..', '..');
const R = path.join(REPO, 'out', 'm2b', 'root');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const W = (rel, o) => { const p = path.join(R, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o, null, 1)); };
const FR = 1 / 30;

function pre() {
  const { data, sentences, scenes, claimsAll } = B.main();
  const total = data.total, off = data.off;
  const link = (rel, target) => { const p = path.join(R, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); try { fs.unlinkSync(p); } catch (e) { /* none */ } fs.symlinkSync(path.relative(path.dirname(p), path.join(REPO, target)), p); };
  for (const d of ['data', 'design', 'preprod']) link(d, d);
  link('out/voice', 'out/voice');
  link('out/model.json', 'out/model.json');
  const aEnd = scenes.find((s) => s.id === 'a2-7374').start;
  const acts = [{ id: 'cold-open', start: 0, end: scenes.find((s) => s.id === 'ident').start }, { id: 'ident', start: scenes.find((s) => s.id === 'ident').start, end: aEnd }, { id: 'act2', start: aEnd, end: total, climax: null }];
  const tl = { fps: 30, total, acts, turns: [
    { scene: 'co-question', sentence: 'co-question.1', t: data.cues['co-question.1|decided'], what: 'open loop: focus racks from the dry tank to the full one' },
    { scene: 'a2-bal74', sentence: 'a2-bal74.1', t: data.cues['a2-bal74.1|retiree'], what: 'focus racks from the mirror tank to the 1966 tank' },
  ], scenes: scenes.map((s) => ({ ...s, panels: ['world'], chart: null, move: 0 })), note: 'M2b lookdev: segment A = cold open + ident; segment B = act 2 lines a2-7374..a2-bal74 moved to follow A' };
  W('out/timeline.json', tl);
  W('out/script.json', { sentences });
  const sceneOf = Object.fromEntries(sentences.map((l) => [l.id, l.scene]));
  const SHOWN = { y1991: ['co-broke'], y1973: ['a2-7374'], y1974: ['a2-7374'], loss1974: ['a2-1974inf'], inf1974: ['a2-1974inf'], bal74: ['a2-bal74'] };
  const cl = claimsAll.filter((c) => B.CLAIMS.includes(c.claimId)).map((c) => {
    const spoken = (c.spoken || []).filter((x) => sceneOf[x.sentence]).map((x) => ({ ...x, scene: sceneOf[x.sentence] }));
    return { ...c, shownIn: SHOWN[c.claimId], spoken, callbacks: [] };
  });
  W('out/claims.json', { claims: cl });
  W('out/page.json', { url: path.relative(R, path.join(REPO, 'render-d', 'look', 'page.html')), ready: 'new Promise((r) => { const f = () => (window.READY ? r(true) : setTimeout(f, 100)); f(); })' });
  // silences after the two decisive lines of the cold open
  const silences = [['co-broke.1', 'let "1991" land'], ['co-question.1', 'the open question hangs before the title']].map(([sid, why]) => {
    const i = sentences.findIndex((l) => l.id === sid); const l = sentences[i], nx = sentences[i + 1];
    const t0 = l.end + 0.08, room = (nx ? nx.start : total) - 0.08 - t0;
    return room >= 0.8 ? { t: +t0.toFixed(3), dur: +Math.min(1.3, room).toFixed(3), why, after: sid } : null;
  }).filter(Boolean);
  W('out/silences.json', { silences });
  // tempo map follows the edit (same method as M2)
  const full = J(path.join(REPO, 'out', 'tempo-map.json'));
  const cuts = tl.scenes.slice(1).map((s) => s.start);
  const nominal = (t) => { const a = acts.find((x) => t >= x.start && t < x.end) || acts[acts.length - 1]; const b = full.bpm[a.id]; return Array.isArray(b) ? b[0] : b; };
  const edges = [0, ...cuts, total]; const beats = [];
  for (let i = 0; i + 1 < edges.length; i++) { const a = edges[i], b = edges[i + 1], per = 60 / nominal(a); const n = Math.max(1, Math.round((b - a) / per)); for (let k = 0; k < n; k++) beats.push(+(a + (b - a) * k / n).toFixed(4)); }
  const accents = ['ident', 'a2-7374'].map((id) => tl.scenes.find((s) => s.id === id).start);
  W('out/tempo-map.json', { bpm: full.bpm, beats, accents, note: 'tempo map follows the edit: every cut is a beat; accents: the ident and the cut into the storm' });
  W('out/transitions.json', { cuts: tl.scenes.slice(1).map((s, i) => ({ t: s.start, from: tl.scenes[i].id, to: s.id, type: 'cut', match: null, audio: null, action: false,
    reason: { 'co-same': 'the crane continues: same world, the line carries on', 'co-broke': 'hard cut to the time-lapse: 25 years in one sun arc', 'co-question': 'dusk close-up after the silence',
      ident: 'title over the road at dusk', 'a2-7374': 'hard cut from dusk to the storm: act 2 opens in 1973', 'a2-1974inf': 'profile of the road: the 1974 stone', 'a2-bal74': 'both tanks at the end of 1974' }[s.id] || 'cut' })) });
  // captions (<= 42 chars per line, <= 2 lines, 1-7 s)
  const wrap = (txt) => { const ws = txt.split(' '); const lines = ['']; for (const w of ws) { const c = lines[lines.length - 1]; if ((c + ' ' + w).trim().length > 42) lines.push(w); else lines[lines.length - 1] = (c + ' ' + w).trim(); } return lines; };
  const cues = [];
  for (const l of sentences) {
    const chunks = []; let cur = [];
    for (const w of l.text.split(' ')) { if (wrap([...cur, w].join(' ')).length > 2) { chunks.push(cur); cur = [w]; } else cur.push(w); }
    if (cur.length) chunks.push(cur);
    // no orphan: move words forward until the last chunk is long enough to read for >= 1 s
    while (chunks.length > 1 && chunks[chunks.length - 1].join(' ').length < 24 && chunks[chunks.length - 2].length > 4) chunks[chunks.length - 1].unshift(chunks[chunks.length - 2].pop());
    let acc = 0; const n = l.text.length;
    chunks.forEach((c, k) => { const txt = c.join(' '); const a = l.start + (l.end - l.start) * acc / n; acc += txt.length + 1; cues.push({ a, b: k === chunks.length - 1 ? l.end : l.start + (l.end - l.start) * acc / n, lines: wrap(txt) }); });
  }
  for (let i = 0; i < cues.length; i++) { const nx = cues[i + 1] ? cues[i + 1].a : total; if (cues[i].b - cues[i].a < 1.0) cues[i].b = Math.min(cues[i].a + 1.0, nx - 0.02); cues[i].b = Math.min(cues[i].b, nx - 0.02, cues[i].a + 7.0); }
  const ts = (x) => { const ms = Math.round(x * 1000); return `00:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  W('out/captions.srt', cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.lines.join('\n')}\n`).join('\n'));
  W('out/package/description.md', ['# Same average, different fate — M2b lookdev', '', 'Two lookdev passages of the new physical world: the cold open with the ident, and act 2 in the 1973-74 storm. History, not a forecast; US only; not advice.', '',
    'Chapters', '0:00 Two retirees', `0:${String(Math.floor(aEnd)).padStart(2, '0')} The storm of 1973-74`, '', 'The narration is a synthetic voice (ElevenLabs, provisional).', ''].join('\n'));
  W('out/adbreaks.json', { breaks: [], note: 'lookdev: no ad breaks' });
  // cue sheet: cold open as in the full sheet; the storm cues shifted to the lookdev time base
  const cs = J(path.join(REPO, 'out', 'cues.json'));
  const aCues = cs.cues.filter((c) => c.t < aEnd).map((c) => ({ ...c, end: Math.min(c.end, aEnd) }));
  const bCues = cs.cues.filter((c) => c.t < 239.83 + (total - aEnd) && c.end > 239.83).map((c) => ({ ...c, t: +Math.max(aEnd, c.t + off).toFixed(3), end: +Math.min(total, c.end + off).toFixed(3) }));
  W('out/cues.json', { note: 'lookdev cue sheet: cold open + ident as in out/cues.json; storm cues moved by ' + off + ' s', cues: [...aCues, ...bCues,
    { t: 0, end: total, function: 'physical sound of the world: water from the spouts, wind, rain, stone, thunder', key: null, tempo: null, layer: 'sfx', scene: 'world' }], silences });
  // physical sound spec (levels are relative; the mix sets the master)
  const c = data.cues; const cl74 = c['a2-1974inf.1|14.7%'], ci74 = c['a2-1974inf.1|12.3%'], c91 = c['co-broke.1|1991'];
  const beds = [
    { kind: 'wind', t0: 0, t1: aEnd, level: [[0, 0.010], [7.5, 0.012], [9, 0.02], [c91, 0.012], [14.8, 0.008], [aEnd, 0.008]] },
    { kind: 'water', t0: 0.3, t1: c91 + 0.05, pan: -0.35, level: [[0, 0.020], [7.8, 0.020], [c91 - 0.4, 0.010], [c91, 0.002]] },
    { kind: 'water', t0: 0.3, t1: aEnd, pan: 0.35, level: [[0, 0.020], [12.1, 0.014], [aEnd, 0.012]] },
    { kind: 'rain', t0: aEnd, t1: total, level: [[aEnd, 0.030], [ci74, 0.030], [ci74 + 1.2, 0.050], [total, 0.045]] },
    { kind: 'wind', t0: aEnd, t1: total, level: [[aEnd, 0.028], [ci74 + 1.2, 0.04], [total, 0.035]] },
  ];
  const events = [];
  for (let t = c91 + 0.6; t < scenes.find((s) => s.id === 'ident').start; t += 0.95) events.push({ t: +t.toFixed(3), kind: 'drip', pan: -0.3, level: 0.05 });
  events.push({ t: cl74 + 0.55, kind: 'thunder', pan: -0.4, level: 0.12 });
  events.push({ t: cl74 - 0.1, kind: 'stone', dur: 0.9, pan: 0, level: 0.10 });
  events.push({ t: ci74 - 0.1, kind: 'stone', dur: 0.9, pan: 0, level: 0.08 });
  W('out/physical.json', { beds, events });
  console.log('lookdev root: scenes', tl.scenes.length, 'sentences', sentences.length, 'beats', beats.length, 'silences', silences.length, 'captions', cues.length);
}

function post() {
  const seen = J(path.join(R, '..', 'text-first.json'));
  const events = Object.entries(seen).filter(([, v]) => v.claims > 0 || v.level === 1).map(([tid, v]) => ({ t: v.t, x: v.x, id: tid, kind: v.level === 1 ? 'impact' : 'reveal' })).sort((a, b) => a.t - b.t);
  W('out/sfx-events.json', { events });
  const run = J(path.join(R, '..', 'render-run.json'));
  W('out/render-log.json', { note: 'M2b lookdev: sharp full-resolution pass + motion-blur residual from N half-resolution subframes over a 180-degree shutter, FXAA', shutter: 0.5, lookdev: run });
  console.log('sfx events', events.length);
}

if (process.argv[2] === 'post') post(); else pre();
