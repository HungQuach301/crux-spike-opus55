'use strict';
// Test D timeline from the voice: every sentence takes the speech span of its chosen TTS take × the planned stretch
// (out/voice/choice-report.json). Scenes get lead/hold from the script, cuts are snapped forward onto the beat grid
// of the tempo map, J/L-cuts shift chosen cuts against the speech, scenes longer than 11.5 s are split into two shots.
// Writes out/timeline.json, out/script.json, out/tempo-map.json, out/adbreaks.json.
const fs = require('fs');
const path = require('path');
const { ACTS } = require('./script');
const SHOTS = require('./shots');

const ROOT = path.join(__dirname, '..', '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const FPS = 30;
const GAP_SENT = 0.40, GAP_SCENE = 0.40, DECISIVE_HOLD = 1.25, MARGIN = 0.03, AD_SILENCE = 1.4, MAX_SHOT = 11.5;
// tempo per act (bpm): act 2 accelerates towards its climax
const BPM = { 'cold-open': 84, ident: 84, act1: 92, act2: [96, 116], act3: 90, method: 80, outro: 80 };
const AD_AFTER = ['act1', 'act2']; // ad breaks at the act1|act2 and act2|act3 boundaries
const J_CUTS = ['a1-mirror-rule', 'a1-illus', 'a1-geo', 'a2-seq', 'a2-bal74m', 'a3-mirror-d', 'a1-arith', 'a3-1928'];
const L_CUTS = ['a1-assets', 'a1-notax', 'a2-1982r', 'a3-decade', 'a3-usonly'];
const r3 = (x) => Math.round(x * 1000) / 1000;
const snapF = (x) => Math.round(x * FPS) / FPS;

function build() {
  const sents = J('out/voice/sentences.json').sentences;
  const rep = Object.fromEntries(J('out/voice/choice-report.json').sentences.map((r) => [r.id, r]));
  const asr = J('out/voice/asr-takes.json');
  const bySc = {};
  for (const s of sents) (bySc[s.scene] ||= []).push(s);
  // ---- 1. lay out speech on a continuous clock
  const scenes = [], lines = [];
  const acts = [];
  let t = 0;
  for (const a of ACTS) {
    const act = { id: a.id, start: t };
    if (AD_AFTER.includes(ACTS[ACTS.indexOf(a) - 1]?.id)) t += AD_SILENCE; // natural silence at the act boundary
    for (const sc of a.scenes) {
      const s0 = t;
      t += sc.lead || 0;
      if (!sc.lines.length) t += 0.2;
      let tailDecisive = false;
      (bySc[sc.id] || []).forEach((s, k) => {
        const r = rep[s.id];
        const take = r.chosen.take;
        const rec = asr[`${s.id}.t${take}`] || asr[`${s.id}.t0`];
        const span = (rec.speech[1] - rec.speech[0]) * r.chosen.stretch + 2 * MARGIN;
        if (k) t += GAP_SENT;
        lines.push({ id: s.id, scene: sc.id, act: a.id, text: s.text, spoken: s.spoken, start: r3(t), end: r3(t + span), take, stretch: r.chosen.stretch, decisive: s.decisive });
        t += span;
        tailDecisive = !!s.decisive;
        if (s.decisive) t += DECISIVE_HOLD - GAP_SENT;
      });
      // a scene hold after a decisive line includes the decisive pause (not added twice)
      t += Math.max(0, (sc.hold || 0) - (tailDecisive ? DECISIVE_HOLD - GAP_SENT + GAP_SCENE : 0));
      t += GAP_SCENE;
      scenes.push({ id: sc.id, act: a.id, start: s0, end: t, layout: sc.layout + (sc.variant ? '-' + sc.variant : ''), shotSize: sc.shot });
    }
    act.end = t;
    acts.push(act);
  }
  // ---- 2. beat grid at a constant tempo per act (act 2 accelerates); each cut moves to the nearest beat when that
  // keeps the speech clear of it (outgoing line ends / incoming line starts at least 0.1 s from the cut), else stays
  for (let i = 0; i < scenes.length; i++) scenes[i].end = i + 1 < scenes.length ? scenes[i + 1].start : scenes[i].end;
  const beats = [];
  const bpmAt = (x) => {
    const a = acts.find((q) => x >= q.start && x < q.end) || acts[acts.length - 1];
    const b = BPM[a.id];
    if (!Array.isArray(b)) return b;
    const u = Math.min(1, (x - a.start) / Math.max(1, a.end - a.start));
    return b[0] + (b[1] - b[0]) * u;
  };
  for (let bt = 0; bt < t + 2; bt += 60 / bpmAt(bt)) beats.push(r3(bt));
  const onBeat = [];
  for (let i = 1; i < scenes.length; i++) {
    const c = scenes[i].start;
    const outL = lines.filter((l) => l.scene === scenes[i - 1].id).pop();
    const inL = lines.find((l) => l.scene === scenes[i].id);
    // the cut may fall up to 0.3 s into the incoming line (a natural J) but never cuts the outgoing line
    const limits = (x) => (scenes[i - 1].act !== 'ident' || x - scenes[i - 1].start <= 2.95) && (scenes[i].act !== 'ident' || scenes[i + 1].start - x <= 2.95) &&
      (scenes[i - 1].act !== 'cold-open' || scenes[i].act === 'cold-open' || x <= 14.9);
    const ok = (x) => limits(x) && (!outL || x >= outL.end + 0.05) && (!inL || x <= inL.start - 0.05) && x - scenes[i - 1].start >= 1.25 && (i + 1 >= scenes.length || scenes[i + 1].start - x >= 1.25);
    const near = beats.filter((b) => Math.abs(b - c) <= 0.5 && ok(b)).sort((a, b) => Math.abs(a - c) - Math.abs(b - c))[0];
    if (near !== undefined) { scenes[i].start = near; scenes[i - 1].end = near; onBeat.push(scenes[i].id); }
  }
  for (const a of acts) { const sc = scenes.filter((s) => s.act === a.id); a.start = sc[0].start; a.end = sc[sc.length - 1].end; }
  // ---- 3. J/L cuts: move the cut against the speech (incoming line starts before the cut / outgoing line ends after it)
  const cutKinds = {};
  for (const id of J_CUTS) {
    const i = scenes.findIndex((s) => s.id === id);
    const first = lines.find((l) => l.scene === id);
    if (i < 1 || !first) continue;
    const c = snapF(first.start + 0.45);
    if (c - scenes[i - 1].start > 1.5 && c < first.end - 0.3) { scenes[i - 1].end = c; scenes[i].start = c; cutKinds[id] = 'j'; }
  }
  for (const id of L_CUTS) {
    const i = scenes.findIndex((s) => s.id === id);
    const last = lines.filter((l) => l.scene === id).pop();
    if (i < 0 || i + 1 >= scenes.length || !last) continue;
    const nxt = scenes[i + 1];
    const c = snapF(last.end - 0.45);
    if (c > last.start + 0.3 && nxt.end - c > 1.5) { scenes[i].end = c; nxt.start = c; cutKinds[nxt.id] = 'l'; }
  }
  // ---- 4. split long scenes into two shots (cut on action), merge nothing (short scenes are kept ≥ 1.2 s by the lead/hold)
  const out = [];
  const queue = scenes.slice();
  while (queue.length) {
    const s = queue.shift();
    const dur = s.end - s.start;
    if (dur > MAX_SHOT && s.act !== 'outro') {
      const ls = lines.filter((l) => l.scene === s.id);
      // cut at the sentence boundary nearest the middle, else at the middle
      const mid = s.start + dur / 2;
      let c = mid;
      const bnds = ls.slice(1).map((l) => l.start - 0.15);
      if (bnds.length) c = bnds.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
      if (c - s.start < 3 || s.end - c < 3) c = mid;
      c = snapF(c);
      const nid = s.id.endsWith('-b') ? s.id.slice(0, -2) + '-c' : s.id + '-b';
      out.push({ ...s, end: c });
      queue.unshift({ ...s, id: nid, start: c, split: true, shotSize: SHOTS.nextSize(s.shotSize) });
      for (const l of ls) if (l.start >= c) l.scene = nid;
    } else out.push(s);
  }
  // ---- 5. assemble
  const total = r3(out[out.length - 1].end);
  const shots = SHOTS.forScenes(out);
  const tl = {
    fps: FPS, total,
    acts: acts.map((a) => ({ id: a.id, start: r3(a.start), end: r3(a.end), ...(climax(a.id, lines) !== null ? { climax: climax(a.id, lines) } : {}) })),
    scenes: out.map((s) => ({
      id: s.id, act: s.act, start: r3(s.start), dur: r3(s.end - s.start), layout: s.layout, shot: { size: s.shotSize, ...pick(shots[s.id], ['angle', 'focalMm']) },
      panels: [s.layout.split('/')[0]], chart: s.layout.split('/')[0], move: shots[s.id].moveSeconds,
      ...(shots[s.id].composition ? { composition: shots[s.id].composition } : {}),
      cutIn: cutKinds[s.id] || null,
    })),
    turns: turns(lines),
  };
  const script = { sentences: lines.map((l) => ({ id: l.id, scene: l.scene, text: l.text, spoken: l.spoken, start: l.start, end: l.end })) };
  const breaks = AD_AFTER.map((a) => { const x = acts.find((q) => q.id === a); return r3(x.end + AD_SILENCE / 2 - 0.1); });
  return { tl, script, tempo: { bpm: BPM, beats: beats.filter((b) => b <= total + 0.01), accents: [] }, breaks, shots, lines, onBeat };
}

const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
function climax(act, lines) {
  const id = { act1: 'a1-avgmirror', act2: 'a2-climax', act3: 'a3-answer' }[act];
  if (!id) return null;
  const l = lines.find((x) => x.scene === id || x.scene === id + '-b');
  return l ? r3(l.start) : null;
}
function turns(lines) {
  const T = [
    ['a1-mirror-in', 'act 1 turn: the second retiree lives the same years in reverse'],
    ['a1-avgmirror', 'act 1 climax: the two averages are identical'],
    ['a2-1982', 'act 2 turn: the good years arrive, too late for the 1966 retiree'],
    ['a2-climax', 'act 2 climax: the largest gap, 1986'],
    ['a2-1991', 'act 2 payoff: the 1966 account hits zero'],
    ['a3-share', 'act 3 turn: what the four failures share is their first decade'],
    ['a3-answer', 'act 3 answer to the cold-open question'],
    ['a3-limits', 'limits of the analysis'],
  ];
  return T.map(([sc, what]) => { const l = lines.find((x) => x.scene === sc); return l ? { t: l.start, what, scene: sc } : null; }).filter(Boolean);
}

module.exports = { build };

if (require.main === module) {
  const r = build();
  const w = (p, o) => fs.writeFileSync(path.join(ROOT, p), JSON.stringify(o, null, 1));
  w('out/timeline.json', r.tl);
  w('out/script.json', r.script);
  w('out/tempo-map.json', r.tempo);
  w('out/adbreaks.json', { breaks: r.breaks, note: 'each inside the planned act-boundary silence (music and voice out for ' + 1.4 + ' s)' });
  fs.mkdirSync(path.join(ROOT, 'preprod'), { recursive: true });
  w('preprod/shotlist.json', { shots: Object.values(r.shots).map((s) => ({ id: s.id, scene: s.scene, size: s.size, angle: s.angle, focalMm: s.focalMm, move: s.move, moveReason: s.moveReason, moveSeconds: s.moveSeconds, lens: s.lens, depth: s.depth })) });
  const d = r.tl.scenes.map((s) => s.dur);
  const m = d.reduce((a, b) => a + b) / d.length, sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length);
  console.log('cuts on beat', r.onBeat.length, 'of', r.tl.scenes.length - 1, '| total', r.tl.total, 's | scenes', d.length, '| dur min', Math.min(...d).toFixed(2), 'max', Math.max(...d).toFixed(2), 'CV', (sd / m).toFixed(2));
  for (const a of r.tl.acts) console.log(' ', a.id.padEnd(9), a.start.toFixed(1), '→', a.end.toFixed(1), '(' + (a.end - a.start).toFixed(1) + ' s)', a.climax !== undefined ? 'climax ' + a.climax : '');
}
