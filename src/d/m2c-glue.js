'use strict';
// Test D M2c animatic root (out/m2c/root): the files the sound pipeline (audio/d_m2_audio.py) reads, built from the
// animatic timeline (src/d/m2c-build.js). Picture: out/m2c/animatic-picture.mp4 (render-d/look/render2.js --q animatic).
//   node src/d/m2c-glue.js
const fs = require('fs');
const path = require('path');
const B = require('./m2c-build');
const REPO = path.join(__dirname, '..', '..');
const R = path.join(REPO, 'out', 'm2c', 'root');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const W = (rel, o) => { const p = path.join(R, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o, null, 1)); };

const { data, claimsAll, aEnd } = B.main();
const link = (rel, target) => { const p = path.join(R, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); try { fs.unlinkSync(p); } catch (e) { /* none */ } fs.symlinkSync(path.relative(path.dirname(p), path.join(REPO, target)), p); };
for (const d of ['data', 'design', 'preprod']) link(d, d);
link('out/voice', 'out/voice'); link('out/model.json', 'out/model.json');
const total = data.total;
const act2 = data.sentences.find((s) => s.act === 'act2').start - 1.4, act1 = data.sentences.find((s) => s.act === 'act1').start - 0.9;
const acts = [{ id: 'cold-open', start: 0, end: 14.83 }, { id: 'ident', start: 14.83, end: aEnd }, { id: 'act1', start: aEnd, end: act2, climax: null }, { id: 'act2', start: act2, end: total, climax: null }];
const scenes = data.shots.map((s) => ({ id: s.id, act: s.act === 'cold-open' && s.id === 'ident' ? 'ident' : s.act, start: s.start, dur: s.dur }));
W('out/timeline.json', { fps: 30, total, acts, scenes, turns: [], note: 'M2c animatic: cold open + the act-1 lines that teach the world + act 2 1973-74' });
W('out/script.json', { sentences: data.sentences.map((s) => ({ id: s.id, scene: s.id.startsWith('co-') ? s.scene : s.id, text: s.text, start: s.start, end: s.end })) });
W('out/claims.json', { claims: claimsAll });
const silences = ['co-broke.1', 'co-question.1'].map((sid) => { const i = data.sentences.findIndex((l) => l.id === sid); const l = data.sentences[i], nx = data.sentences[i + 1];
  const t0 = l.end + 0.08, room = (nx ? nx.start : total) - 0.08 - t0; return room >= 0.8 ? { t: +t0.toFixed(3), dur: +Math.min(1.3, room).toFixed(3), after: sid } : null; }).filter(Boolean);
W('out/silences.json', { silences });
const full = J(path.join(REPO, 'out', 'tempo-map.json'));
const edges = [0, ...scenes.slice(1).map((s) => s.start), total]; const beats = [];
const nominal = (t) => { const a = acts.find((x) => t >= x.start && t < x.end) || acts[acts.length - 1]; const b = full.bpm[a.id]; return Array.isArray(b) ? b[0] : b; };
for (let i = 0; i + 1 < edges.length; i++) { const a = edges[i], b = edges[i + 1], per = 60 / nominal(a); const n = Math.max(1, Math.round((b - a) / per)); for (let k = 0; k < n; k++) beats.push(+(a + (b - a) * k / n).toFixed(4)); }
W('out/tempo-map.json', { bpm: full.bpm, beats, accents: [scenes.find((s) => s.id === 'ident').start, act1 + 0.9 - 0.9, act2].map((x) => +x.toFixed(3)).filter((x) => beats.some((b) => Math.abs(b - x) < 0.034)) });
W('out/transitions.json', { cuts: scenes.slice(1).map((s, i) => ({ t: s.start, from: scenes[i].id, to: s.id, type: 'cut' })) });
W('out/sfx-events.json', { events: [] });
W('out/cues.json', { cues: [
  { t: 0, end: aEnd, key: 'D minor', tempo: 84, layer: 'music', function: 'cold open' },
  { t: aEnd, end: act2, key: 'F major', tempo: 92, layer: 'music', function: 'act 1: learning the world' },
  { t: act2, end: total, key: 'D minor', tempo: 99, layer: 'music', function: 'storm 1973-74' }] });
// physical sound spec: water from each tap while it pours, wind, rain in the storm cell, thunder at the lightning;
// numbers[] = video time of every spoken number (the physical layer dips -18 dB around them)
const c = data.cues; const S = (id) => data.sentences.find((s) => s.id === id);
const numbers = Object.entries(c).filter(([k]) => /\|\$?\d/.test(k)).map(([, v]) => v).sort((a, b) => a - b);
const cl = c['a2-1974inf.1|14'] || S('a2-1974inf.1').start + 2.9, ci = c['a2-1974inf.1|12'] || S('a2-1974inf.1').start + 6.4;
const c91 = c['co-broke.1|1991'] || 10.07, rule = c['a1-rule.1|withdraws'] || S('a1-rule.1').start + 2;
W('out/physical.json', { numbers,
  beds: [
    { kind: 'wind', t0: 0, t1: act2, level: 0.010 },
    { kind: 'water', t0: 7.8, t1: c91, pan: -0.35, level: 0.018 },
    { kind: 'water', t0: 7.8, t1: 14.9, pan: 0.35, level: 0.016 },
    { kind: 'water', t0: rule, t1: act2 - 0.2, pan: -0.35, level: 0.018 },
    { kind: 'rain', t0: act2, t1: S('a2-bal74m.1').start - 0.4, level: [[act2, 0.03], [ci, 0.03], [ci + 1.2, 0.05], [total, 0.05]] },
    { kind: 'wind', t0: act2, t1: S('a2-bal74m.1').start - 0.4, level: 0.03 },
    { kind: 'water', t0: act2, t1: total, pan: -0.35, level: 0.016 },
  ],
  events: [{ t: cl + 0.55, kind: 'thunder', pan: -0.4, level: 0.12 }] });
const cam = path.join(R, 'out', 'camera.json'); if (!fs.existsSync(cam)) W('out/camera.json', { frames: [] });
console.log('animatic root: shots', scenes.length, 'numbers', numbers.length, 'silences', silences.length);
