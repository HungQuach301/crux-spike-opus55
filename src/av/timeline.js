'use strict';
// Test C timeline: voice first, picture second. Each scene's length comes from its TTS clip
// (trimmed), rounded up to whole beats at 100 BPM so the music keeps test B's phrase-per-scene
// structure. Word times come from faster-whisper (out/voice/asr.json), aligned to the script's
// spoken words; anchors and number markers take their times from those words.
const N = require('./normalize');

const BPM = 100, BEAT = 60 / BPM;
const LEAD = 0.25, TAIL = 0.45;   // s of room before and after the voice in each scene
const PRE = 0.175;                // a spoken number's fade (0.35 s) starts this long before its word
const SILENCE_LEN = 0.4, STILL_LEN = 0.8;
const MOVE_MIN = 0.5, MOVE_MAX = 1.2; // camera move between scenes; it ends before the scene's first visual event

const norm = (w) => w.toLowerCase().replace(/[^a-z0-9'-]/g, '').replace(/'s$/, 's');

/** Align script spoken words to ASR tokens; returns per-script-word { start, end, matched }. */
function alignWords(scriptWords, asrTokens) {
  // expand ASR words into spoken words ("$25,000" -> twenty-five thousand dollars), sharing time
  const joined = N.joinAsrTokens(asrTokens);
  const asr = [];
  for (const j of joined) {
    const sp = N.splitWords(N.toSpoken(j.w));
    sp.forEach((w, k) => asr.push({ w: norm(w), start: j.start + (j.end - j.start) * k / sp.length, end: j.start + (j.end - j.start) * (k + 1) / sp.length }));
  }
  const a = scriptWords.map(norm), b = asr.map((x) => x.w);
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = new Array(n).fill(null);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out[i] = { start: asr[j].start, end: asr[j].end, matched: true }; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  // interpolate unmatched words between matched neighbours
  const endT = asr.length ? asr[asr.length - 1].end : 0;
  for (let k = 0; k < n; k++) {
    if (out[k]) continue;
    let p = k - 1; while (p >= 0 && !out[p]) p--;
    let q = k + 1; while (q < n && !out[q]) q++;
    const t0 = p >= 0 ? out[p].end : 0, t1 = q < n ? out[q].start : endT;
    const span = q - p - 1, pos = k - p;
    out[k] = { start: t0 + (t1 - t0) * (pos - 1) / span, end: t0 + (t1 - t0) * pos / span, matched: false };
  }
  return { words: out, matched: out.filter((x) => x.matched).length, total: n };
}

/** Display words with times: each display word covers the spoken words its normalization yields. */
function displayTiming(displayWords, spokenTimes) {
  const counts = displayWords.map((w) => Math.max(1, N.splitWords(N.toSpoken(w)).length));
  const sum = counts.reduce((a, b) => a + b, 0);
  const scale = spokenTimes.length / sum; // 1 when per-word normalization matches the whole text
  let k = 0;
  return displayWords.map((w, i) => {
    const a = Math.min(spokenTimes.length - 1, Math.round(k)), b = Math.min(spokenTimes.length - 1, Math.round(k + counts[i] * scale) - 1);
    k += counts[i] * scale;
    return { w, start: spokenTimes[a].start, end: spokenTimes[Math.max(a, b)].end };
  });
}

function build({ script, prepared, asr }) {
  const P = Object.fromEntries(prepared.scenes.map((p) => [p.id, p]));
  let t = 0;
  const scenes = [], events = [], silences = [], still = [];
  const alignment = [];
  script.forEach((s, index) => {
    const p = P[s.id];
    if (!p) return;
    const a = asr.scenes[s.id];
    const vdur = a ? a.duration : 0;
    // lead: room before the voice, raised when an anchored event would land during the camera move
    let lead = LEAD;
    let al = null;
    if (a) {
      al = alignWords(p.spokenWords, a.words);
      const used = new Set((s.events || []).filter(([, w]) => typeof w !== 'number').map(([, w]) => String(w).split('+')[0]));  // anchored events only
      const firsts = p.markers.filter((m) => used.has(m.name)).map((m) => al.words[Math.min(m.word, al.words.length - 1)].start);
      if (firsts.length && index > 0) lead = Math.max(LEAD, MOVE_MIN + PRE - Math.min(...firsts));
    }
    const need = a ? lead + vdur + (s.chapter === 'hook' ? 0.3 : TAIL) + (s.hold || 0) : 0; // hold: extra time to read a decisive number
    const beats = Math.max(2, Math.ceil(need / BEAT - 1e-9), Math.ceil((s.minDur || 0) / BEAT - 1e-9));
    const dur = +(beats * BEAT).toFixed(3), start = +t.toFixed(3);
    const anchors = {}, words = [];
    let wordTimes = null, displayWords = [];
    if (a) {
      alignment.push({ scene: s.id, matched: al.matched, total: al.total });
      wordTimes = al.words.map((x) => ({ start: +(start + lead + x.start).toFixed(3), end: +(start + lead + x.end).toFixed(3), matched: x.matched }));
      p.spokenWords.forEach((w, k) => words.push({ w, ...wordTimes[k] }));
      for (const m of p.markers) anchors[m.name] = wordTimes[Math.min(m.word, wordTimes.length - 1)].start;
      displayWords = displayTiming(p.displayWords, wordTimes);
    }
    const sc = {
      id: s.id, index: scenes.length, chapter: s.chapter, section: s.section, shot: s.shot, layout: s.layout, cam: s.cam, drift: s.drift,
      panels: s.panels, chart: !!s.chart, beats, start, dur, move: 0, lead: +lead.toFixed(3),
      voice: a ? { file: `out/voice/${s.id}.final.wav`, start: +(start + lead).toFixed(3), dur: vdur } : null,
      display: p.display, anchors, markers: p.markers, words, displayWords,
    };
    scenes.push(sc);
    const at = (x) => {
      if (typeof x === 'number') return { t: start + x, word: null };
      const [name, off] = String(x).split('+');
      if (!(name in anchors)) throw new Error(`${s.id}: unknown anchor ${name}`);
      return { t: anchors[name] + Number(off || 0), word: anchors[name] };
    };
    const mine = [];
    for (const [type, when, probe, flag] of s.events || []) {
      const r = at(when);
      const pre = typeof when === 'number' ? 0 : PRE; // anchored visuals start PRE before the word
      mine.push({ id: `${s.id}:${probe}`, scene: s.id, type, t: +(r.t - pre).toFixed(4), probe, wordT: r.word, decor: flag === 'decor' });
    }
    events.push(...mine);
    if (sc.index > 0) {
      // 'decor' events (a label appearing) do not shorten the camera move
      const firstEv = Math.min(...mine.filter((e) => e.type !== 'transition' && e.type !== 'dismiss' && !e.decor).map((e) => e.t - start), Infinity);
      sc.move = +Math.max(MOVE_MIN, Math.min(MOVE_MAX, 0.5 * dur, firstEv)).toFixed(3);
    }
    if (s.silenceBefore) { const e = anchors[s.silenceBefore] - PRE; silences.push({ scene: s.id, start: +(e - SILENCE_LEN).toFixed(4), end: +e.toFixed(4) }); }
    if (s.stillAt) { const e = anchors[s.stillAt] - PRE; still.push({ scene: s.id, start: +e.toFixed(4), end: +(e + STILL_LEN).toFixed(4) }); }
    t += dur;
  });
  // progress ticks ('count' SFX) at fixed points of animations the renderer draws with the same formulas
  const S2 = Object.fromEntries(scenes.map((x) => [x.id, x]));
  const tick = (sc, probe, t) => events.push({ id: `${sc}:${probe}`, scene: sc, type: 'count', t: +t.toFixed(4), probe, wordT: null });
  if (S2.hook3) for (const m of [12, 24, 36, 48]) tick('hook3', `cell${m}`, S2.hook3.anchors.months - PRE + (m - 1) * 0.045);
  if (S2.lots1) for (const m of [12, 24, 36, 48]) tick('lots1', `cell${m}`, S2.lots1.anchors.lot - PRE + (m - 1) * 0.03);
  if (S2.race) for (const m of [12, 24, 36]) tick('race', `month${m}`, S2.race.start + 1.0 + (m / 48) * Math.max(2, S2.race.dur - 2.2));
  events.sort((x, y) => x.t - y.t);
  const morphs = [
    "facts->timeline (one principal bar splits into the two roads' month bars)",
    'morphInt->interest (month bars re-scale to interest dollars)',
    "identity->bridge (A's extra invested becomes B's unknown head start)",
    'morphDot->dots (the break-even point flies from the sweep line into its row of the dot plot)',
    'morphGap->gap (the two net-worth lines fold into their difference)',
    'lots1->lots2 (road B lots recolour into long-term and short-term)',
  ].filter((m) => scenes.some((s) => s.id === m.split('->')[1].split(' ')[0]));
  return { bpm: BPM, beat: BEAT, lead: LEAD, tail: TAIL, pre: PRE, total: +t.toFixed(3), scenes, events, silences, still, morphs, alignment };
}

module.exports = { BPM, BEAT, LEAD, TAIL, PRE, alignWords, displayTiming, build };
