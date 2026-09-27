'use strict';
// Test D M3 (whole film) contract files (from src/d/m2-glue.js) that depend on the timeline and the render:
//   node src/d/m3-glue.js pre    -> tempo-map.json (beats + accents on cuts), transitions.json, silences.json, captions.srt,
//                                   package/description.md, cues.json, tension-map (M2 range), adbreaks.json, render-log.json
//   node src/d/m3-glue.js post   -> sfx-events.json from the render's first-visible texts
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const R = path.join(REPO, 'out', 'm3', 'root');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const W = (rel, o) => { const p = path.join(R, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof o === 'string' ? o : JSON.stringify(o, null, 1)); };
const tl = J(path.join(R, 'out', 'timeline.json'));
const script = J(path.join(R, 'out', 'script.json'));
const FR = 1 / 30;

// match cuts (semantic: the idea carries across the cut; reasons >= 5 words)
const MATCH = {
  'co-broke': ['semantic', 'the shared end point splits into two very different balances'],
  'co-question': ['semantic', 'the zero point of 1991 becomes the open question'],
  'a1-assets': ['semantic', 'the two slices of the ring open into what each slice holds'],
  'a1-raise': ['semantic', 'the slice taken from the column becomes the first withdrawal bar'],
  'a1-real': ['semantic', 'the same staircase of withdrawals is now read in real terms'],
  'a1-mirror-rule': ['semantic', 'the second track becomes the reversed row of the same returns'],
  'a1-avgmirror': ['semantic', 'the same number reappears on the other side for the mirror retiree'],
  'a1-payoff': ['semantic', 'the arithmetic bars resolve into the balanced scale of the question'],
  'a2-gap1': ['semantic', 'the first-year bars become the start of the two balance lines'],
  'a2-bal74m': ['semantic', 'the 1966 ledger number is answered by the mirror ledger at the same year'],
  'a2-1982r': ['semantic', 'the dawn of 1982 lands as the 1982 bar of the return row'],
  'a2-climax': ['semantic', 'the widening gap closes up on its peak value'],
  'a3-all': ['semantic', 'the single 1966 tile becomes one of 69 start-year tiles'],
  'a3-decade': ['semantic', 'the four failing tiles become four first-decade bars'],
  'a3-mirror-d': ['semantic', 'the 1966 first decade is answered by the mirror first decade'],
};

function pre() {
  // intentional silences (music, sfx and whoosh out; room tone stays under -40 dBFS): after decisive / reveal lines
  const SIL = [['co-broke.1', 'let "1991" land'], ['co-question.1', 'the open question hangs before the title'], ['a1-avg1966.1', 'let the first average land before the mirror answers'],
    ['a1-payoff.4', 'end of act 1: ad break'], ['a2-climax.1', 'let the $1.96 million gap land'], ['a2-payoff.2', 'end of act 2: ad break'], ['a3-answer.3', 'the answer lands']];
  const silences = SIL.map(([sid, why]) => {
    const i = script.sentences.findIndex((l) => l.id === sid);
    const l = script.sentences[i], nx = script.sentences[i + 1];
    const t0 = l.end + 0.08, room = (nx ? nx.start : tl.total) - 0.08 - t0;
    const cap = /ad break/.test(why) ? 3.2 : 1.3; // the ad-break silences run up to the next act's first line
    return room >= 0.8 ? { t: +t0.toFixed(3), dur: +Math.min(cap, room).toFixed(3), why, after: sid } : null;
  }).filter(Boolean);
  W('out/silences.json', { silences });
  const full = J(path.join(REPO, 'out', 'tempo-map.json'));
  const cuts = tl.scenes.slice(1).map((s) => s.start);
  // the tempo map follows the edit: every cut is a beat; each shot is divided into a whole number of beats at the
  // act's nominal tempo (so the local tempo moves a little shot to shot, like a conductor following picture)
  const nominal = (t) => { const a = tl.acts.find((x) => t >= x.start && t < x.end) || tl.acts[tl.acts.length - 1]; const b = full.bpm[a.id]; return Array.isArray(b) ? b[0] : b; };
  const edges = [0, ...cuts, tl.total];
  const beats = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = edges[i], b = edges[i + 1], per = 60 / nominal(a);
    const n = Math.max(1, Math.round((b - a) / per));
    for (let k = 0; k < n; k++) beats.push(+(a + (b - a) * k / n).toFixed(4));
  }
  const onBeat = (c) => beats.some((b) => Math.abs(b - c) <= FR + 1e-6);
  // accents: cuts that sit on a beat at the start of a new idea (act boundary, reveal scenes)
  const ACC = ['ident', 'a1-est', 'a1-mix', 'a1-rule', 'a1-horizon', 'a1-mirror-in', 'a1-question', 'a1-avg1966', 'a1-avgmirror', 'a1-geo', 'a1-payoff', 'co-broke', 'a2-est', 'a2-7374', 'a2-1982', 'a2-climax', 'a2-1991', 'a3-est', 'a3-four', 'a3-decade', 'a3-answer', 'method', 'outro'];
  const silPre = J(path.join(R, 'out', 'silences.json')).silences;
  const accents = tl.scenes.filter((s) => ACC.includes(s.id) && onBeat(s.start) && !silPre.some((x) => s.start >= x.t - 0.1 && s.start <= x.t + x.dur + 0.1)).map((s) => s.start);
  W('out/tempo-map.json', { bpm: full.bpm, beats, accents, note: 'tempo map follows the edit: every cut is a beat, each shot holds a whole number of beats near the act tempo; accents are cuts' });
  const transitions = { cuts: tl.scenes.slice(1).map((s, i) => {
    const from = tl.scenes[i].id, base = s.id.replace(/-[bc]$/, '');
    const m = MATCH[base] && !s.id.endsWith('-b') ? MATCH[base] : null;
    return { t: s.start, from, to: s.id, type: 'cut', match: m ? m[0] : null, audio: s.cutIn || null, action: false,
      reason: m ? m[1] : s.id.endsWith('-b') ? 'a second angle inside one long line of narration' : `hard cut on the beat into ${base.replace(/-/g, ' ')} to start the next idea` };
  }) };
  W('out/transitions.json', transitions);

  // captions: one cue per sentence, split into <= 42-char lines (max 2) and 1-7 s cues by the word timing
  const cues = [];
  const cueMap = {};
  const wrap = (txt) => { const ws = txt.split(' '); const lines = ['']; for (const w of ws) { const c = lines[lines.length - 1]; if ((c + ' ' + w).trim().length > 42) lines.push(w); else lines[lines.length - 1] = (c + ' ' + w).trim(); } return lines; };
  for (const l of script.sentences) {
    const words = l.text.split(' ');
    // chunks of <= 2 lines of 42 chars
    const chunks = [];
    let cur = [];
    for (const w of words) { const cand = [...cur, w].join(' '); if (wrap(cand).length > 2) { chunks.push(cur); cur = [w]; } else cur.push(w); }
    if (cur.length) chunks.push(cur);
    const n = l.text.length;
    let acc = 0;
    chunks.forEach((c, k) => {
      const txt = c.join(' ');
      const a = l.start + (l.end - l.start) * acc / n;
      acc += txt.length + 1;
      const b = k === chunks.length - 1 ? l.end : l.start + (l.end - l.start) * acc / n;
      cues.push({ a, b, lines: wrap(txt) });
    });
  }
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].b - cues[i].a < 1.0) {
      const j = i + 1 < cues.length && wrap(cues[i].lines.join(' ') + ' ' + cues[i + 1].lines.join(' ')).length <= 2 && cues[i + 1].b - cues[i].a <= 7 ? i + 1
        : i > 0 && wrap(cues[i - 1].lines.join(' ') + ' ' + cues[i].lines.join(' ')).length <= 2 && cues[i].b - cues[i - 1].a <= 7 ? i - 1 : -1;
      if (j === i + 1) { cues[i + 1] = { a: cues[i].a, b: cues[i + 1].b, lines: wrap(cues[i].lines.join(' ') + ' ' + cues[i + 1].lines.join(' ')) }; cues.splice(i, 1); i--; continue; }
      if (j === i - 1) { cues[i - 1] = { a: cues[i - 1].a, b: cues[i].b, lines: wrap(cues[i - 1].lines.join(' ') + ' ' + cues[i].lines.join(' ')) }; cues.splice(i, 1); i -= 2; continue; }
    }
  }
  for (let i = 0; i < cues.length; i++) {
    const nx = cues[i + 1] ? cues[i + 1].a : tl.total;
    if (cues[i].b - cues[i].a < 1.0) cues[i].b = Math.min(cues[i].a + 1.0, nx - 0.02);
    if (cues[i].b - cues[i].a < 1.0 && i > 0) cues[i].a = Math.max(cues[i - 1].b + 0.02, cues[i].b - 1.0);
    cues[i].b = Math.min(cues[i].b, nx - 0.02, cues[i].a + 7.0);
  }
  const ts = (x) => { const ms = Math.round(x * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  W('out/captions.srt', cues.map((c, i) => `${i + 1}\n${ts(c.a)} --> ${ts(c.b)}\n${c.lines.join('\n')}\n`).join('\n'));
  void cueMap;
  // description with chapters (M2 segment)
  const sc = (id) => tl.scenes.find((s) => s.id === id).start;
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const act = (id) => tl.acts.find((a) => a.id === id).start;
  W('out/package/description.md', [
    '# Same average, different fate: why two retirees with the same average return ended so differently', '',
    'Two retirees start with the same money, take out the same dollars every year and earn the same average return over 30 years. One runs out of money in 1991; the other ends with more than they started with. The only difference is the order of the years. This is history, not a forecast. US only. Not financial advice.', '',
    'Chapters', `0:00 Two retirees, one average`, `${mmss(act('act1'))} The first retiree and the rules`, `${mmss(sc('a1-mirror-in'))} The mirror retiree`, `${mmss(act('act2'))} Year by year: when order starts to matter`,
    `${mmss(act('act3'))} Every start year since 1928`, `${mmss(sc('a3-limits'))} The limits of this analysis`, `${mmss(act('method'))} Data and method`, '',
    'Sources: Aswath Damodaran, NYU Stern, Historical Returns on Stocks, Bonds and Bills 1928-2025 (https://pages.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls; data years 1928-2025, 1966-1995 for the two retirees); inflation: U.S. Bureau of Labor Statistics CPI-U via FRED (https://fred.stlouisfed.org/series/CPIAUCNS).',
    'Assumptions: $1,000,000 start (illustrative); 60% S&P 500 with dividends and 40% 10-year US Treasury bonds, rebalanced every January; 4% of the start balance withdrawn at the start of year one, then raised each year by the previous year\'s inflation; 30 years; no taxes, no fees. The mirror retiree lives the same 30 annual returns in reverse order and is illustrative. Every number and formula is listed in the claims registry (out/claims.json).',
    'Not advice: this video describes history and does not recommend any withdrawal rate, portfolio or product.',
    'Narration: synthetic voice (ElevenLabs text-to-speech). Music and sound: original, synthesised for this video.', '',
  ].join('\n'));
  // adbreaks: none inside the M2 segment (its only act-to-act boundary with speech on both sides is act1|act2, after the end)
  // ad breaks: inside the silences at the act1|act2 and act2|act3 boundaries
  const brk = ['a1-payoff.4', 'a2-payoff.2'].map((sid) => silences.find((x) => x.after === sid)).filter(Boolean).map((x) => { const bnd = tl.acts.find((a) => a.start > x.t).start; return { t: +Math.min(x.t + x.dur - 0.5, Math.max(x.t + 0.5, bnd)).toFixed(3), boundary: bnd, why: 'act boundary, inside a ' + x.dur.toFixed(2) + ' s silence' }; });
  W('out/adbreaks.json', { breaks: brk });
  // cue sheet and tension map, cut to the M2 range
  const cs = J(path.join(REPO, 'out', 'cues.json'));
  W('out/cues.json', { ...cs, silences });
  // numbers[]: video time of every spoken number (the mix dips music, whoosh and sfx around each one); no physical beds
  const cm = eval(fs.readFileSync(path.join(REPO, 'render-d', 'prod', 'data.js'), 'utf8').replace('window.DATA = ', '(').replace(/;\s*$/, ')')).cues;
  const numbers = [...new Set(Object.entries(cm).filter(([k]) => /\|[−$]?\d/.test(k)).map(([, v]) => v))].sort((a, b) => a - b);
  W('out/physical.json', { beds: [], events: [], numbers });
  console.log('beats', beats.length, 'accents', accents.length, '| cuts', cuts.length, 'on beat', cuts.filter(onBeat).length, '| silences', silences.length, '| captions', cues.length);
}

function post() {
  const seen = J(path.join(R, '..', 'text-first.json'));
  const events = [];
  for (const [tid, v] of Object.entries(seen)) {
    if (!(v.level === 1 || v.claims > 0 || v.role === 'badge')) continue;
    if (v.t < 0.3) continue;
    const impact = ['cb-l1', 'av-l1', 'am-id'].includes(tid) || /-l1$/.test(tid) && v.claims > 0;
    events.push({ t: v.t, x: v.x, id: tid, kind: impact ? 'impact' : 'reveal', ...(impact ? { riser: 0.9 } : {}) });
  }
  events.sort((a, b) => a.t - b.t);
  // keep events at least 0.25 s apart (each is measured over its own 150 ms window)
  const kept = [];
  for (const e of events) if (!kept.length || e.t - kept[kept.length - 1].t >= 0.25) kept.push(e);
  W('out/sfx-events.json', { events: kept.map((e) => ({ t: e.t, x: e.x, id: e.id, kind: e.kind, ...(e.riser ? { riser: e.riser } : {}) })) });
  const run = J(path.join(R, '..', 'render-run.json'));
  const step0 = J(path.join(REPO, 'out', 'render-log.json')).stepZero;
  W('out/render-log.json', { subframes: 8, shutter: 0.5, stepZero: step0, m3: run });
  console.log('sfx events', kept.length);
}

if (process.argv[2] === 'post') post(); else pre();
