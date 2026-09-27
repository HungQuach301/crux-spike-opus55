'use strict';
// Test D M3: data for the render page (render-d/prod/data.js) and the M3 contract root (out/m3/root): the whole film
// (built from src/d/m2-build.js; the M2 build stays as it was for the M2 segment), the script lines of that range, cues (video time of every spoken number and word, from
// the ElevenLabs character alignment of the chosen take), model series for the charts.
//   node src/d/m3-build.js
const fs = require('fs');
const path = require('path');
const M = require('./model');
const CAMS = require('../../render-d/prod/cameras');
const { toSpoken } = require('./speak');

const ROOT = path.join(__dirname, '..', '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const M2_ACTS = ['cold-open', 'ident', 'act1', 'act2', 'act3', 'method', 'outro'];
const CHART_SCENES = { 'co-same': 'co', 'co-broke': 'cb', 'a1-raise': 'rs', 'a1-real': 're', 'a1-mirror-rule': 'mr', 'a1-samewd': 'sw', 'a1-geo': 'ge', 'a1-arith': 'ar' };
const PANEL = { 'co-lines': 'co', 'co-same': 'co', 'co-broke': 'cb', 'co-question': 'cq', ident: 'id', 'a1-est': 'est', 'a1-start': 'st', 'a1-who': 'who', 'a1-hook': 'hk', 'a1-mix': 'mx', 'a1-assets': 'as',
  'a1-rebal': 'rb', 'a1-rule': 'ru', 'a1-raise': 'rs', 'a1-real': 're', 'a1-horizon': 'hz', 'a1-notax': 'nt', 'a1-mirror-in': 'mi', 'a1-mirror-rule': 'mr', 'a1-illus': 'il', 'a1-samewd': 'sw',
  'a1-question': 'q', 'a1-avg1966': 'av', 'a1-avgmirror': 'am', 'a1-geo': 'ge', 'a1-arith': 'ar', 'a1-payoff': 'po' };
const CENTER = new Set(['co-question', 'ident', 'a1-illus', 'a1-avgmirror', 'a1-question', 'a2-q', 'a2-seq', 'a2-climax-in', 'a2-climax', 'a3-est', 'a3-q', 'a3-answer', 'outro']);
const M2_TURNS = [
  ['co-broke', 'co-broke.1', 'cold-open turn: the 1966 retiree runs out of money in 1991', '1991'],
  ['co-question', 'co-question.1', 'open loop: what decided which retiree went broke?'],
  ['a1-real', 'a1-real.2', 'nominal versus real: the same withdrawal climbs in dollars of the day'],
  ['a1-mirror-in', 'a1-mirror-in.1', 'act 1 turn: the second retiree lives the same years in reverse'],
  ['a1-avgmirror', 'a1-avgmirror.3', 'act 1 climax: the two averages are identical'],
  ['a2-gap1', 'a2-gap1.1', 'act 2: after one year the paths have split', 'split'],
  ['a2-1982', 'a2-1982.1', 'act 2 turn: the good years finally arrive, too late', 'arrive'],
  ['a2-climax', 'a2-climax.1', 'act 2 climax: the gap peaks at $1.96 million', '$1.96 million'],
  ['a2-1991', 'a2-1991.1', 'the 1966 account hits zero in 1991', '1991'],
  ['a3-four', 'a3-four.1', 'act 3: four start years ran out of money', 'money'],
  ['a3-decade', 'a3-decade.1', 'act 3 climax: every failure had a losing first decade', 'lost'],
  ['a3-answer', 'a3-answer.3', 'the answer: the first 10 years', 'years'],
];

function cues(sentences, takes, el) {
  // video time of a phrase = line start + (alignment start of its first character - (speech start - 30 ms))
  const out = {};
  for (const s of sentences) {
    const tk = takes[s.id];
    if (!tk) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, tk.raw.replace(/\.mp3$/, '.json')), 'utf8'));
    const al = meta.alignment;
    const chars = al.characters.join('');
    const off = s.start - (el[tk.name].speech[0] - 0.03);
    const at = (i) => +(off + al.character_start_times_seconds[i]).toFixed(3);
    const low = chars.toLowerCase();
    let from = 0;
    // numbers written in the text, in order
    const nums = s.text.match(/−?\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?:\s(?:million|billion))?(?:-year)?/g) || [];
    const asrW = (el[tk.name].words || []).map((w) => ({ ...w, t: +(s.start + 0.03 + w.start).toFixed(3) }));
    let wi = 0;
    for (const n of nums) {
      const lead = (n.match(/\d+/) || [''])[0];
      const j = asrW.findIndex((w, k) => k >= wi && w.w.replace(/[^0-9]/g, '').startsWith(lead) && lead);
      if (j >= 0) { out[`${s.id}|${n}`] = asrW[j].t; wi = j + 1; continue; }
      const sp = toSpoken(n).toLowerCase().replace(/\.$/, '');
      const first = sp.split(/\s+/)[0].replace(/-.*/, '');
      const i = low.indexOf(first, from);
      if (i >= 0) { out[`${s.id}|${n}`] = at(i); from = i + 1; }
    }
    // every word of the text (first occurrence)
    for (const w of s.text.replace(/[^A-Za-z'\s-]/g, ' ').split(/\s+/).filter(Boolean)) {
      const k = `${s.id}|${w.toLowerCase()}`;
      if (k in out) continue;
      const i = low.search(new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/[-']/g, '.')}`));
      if (i >= 0) out[k] = at(i + (low[i].match(/[a-z]/) ? 0 : 1));
    }
    // multi-word phrases used by the scenes
    for (const p of ['same dollars', 'second', 'nobody', 'whether', 'rebalanced', 'inflation', 'order', 'taxes', 'fees', 'US', 'history', 'average', 'balance', 'withdrawals']) {
      const i = low.search(new RegExp(`(^|[^a-z])${p === 'US' ? 'u\\.s' : p.toLowerCase()}`));
      if (i >= 0 && !(`${s.id}|${p}` in out)) out[`${s.id}|${p}`] = at(i + (low[i].match(/[a-z]/) ? 0 : 1));
    }
  }
  return out;
}

function main() {
  const tl = J('out/timeline.json'), script = J('out/script.json'), claims = J('out/claims.json').claims, tokens = J('design/tokens.json');
  const takesArr = J('out/voice/takes.json').takes, el = J('out/voice/el-takes.json');
  const takes = Object.fromEntries(takesArr.map((t) => [t.id, { ...t, name: path.basename(t.raw, '.mp3') }]));
  const acts = tl.acts.filter((a) => M2_ACTS.includes(a.id));
  const end = acts[acts.length - 1].end;
  const scenes = tl.scenes.filter((s) => M2_ACTS.includes(s.act)).map((s) => ({
    ...s, chart: CHART_SCENES[s.id.replace(/-[bc]$/, '')] || (s.act !== 'act1' && /^(duel|scatter|decade|gap|escalator|map)\//.test(s.layout) ? s.id.replace(/-[bc]$/, '') : null), panels: [PANEL[s.id.replace(/-[bc]$/, '')] || s.id.replace(/-[bc]$/, '')], move: CAMS.moveSeconds(s.id, s.dur),
    ...(CENTER.has(s.id) ? { composition: 'center' } : {}),
  }));
  const sentences = script.sentences.filter((l) => scenes.some((s) => s.id === l.scene));
  const cueMapPre = cues(sentences, takes, el);
  const turns = M2_TURNS.map(([scene, sid, what, at]) => { const l = sentences.find((x) => x.id === sid); return l ? { t: at ? cueMapPre[`${sid}|${at}`] : l.start, what, scene } : null; }).filter(Boolean);
  const m2tl = { fps: 30, total: +end.toFixed(3), acts, scenes, turns, cutIns: Object.fromEntries(scenes.filter((s) => s.cutIn).map((s) => [s.id, s.cutIn])) };
  // model series for the charts
  const data = M.loadAnnual();
  const base = M.window30(data, 1966), mir = M.mirrorSeq(base);
  const A = M.simulate(base), B = M.simulate(mir);
  const cum = (seq) => { const out = [1]; seq.forEach((r) => out.push(out[out.length - 1] * (1 + M.portfolioReturn(r)))); return out; };
  let w = 40000; const planned = [];
  for (let k = 0; k < 30; k++) { if (k) w *= 1 + base[k - 1].inflation; planned.push(w); }
  const model = { cum1966: cum(base), cumMirror: cum(mir), cumEnd: cum(base)[30], bal1966: A.endNominal, balMirror: B.endNominal, ret1966: base.map(M.portfolioReturn), retMirror: mir.map(M.portfolioReturn),
    plannedWd: planned, geo: M.geoMean(base), arith: M.arithMean(base),
    // M3: real balances, withdrawals, inflation, share of the balance taken, and every start year 1928..1996
    real1966: [M.INITIAL, ...A.endReal], realMirror: [M.INITIAL, ...B.endReal], nom1966: [M.INITIAL, ...A.endNominal], nomMirror: [M.INITIAL, ...B.endNominal],
    wd1966: A.withdrawals, wdMirror: B.withdrawals, infl: base.map((r) => r.inflation), share1966: A.withdrawals.map((w, k) => (A.startNominal[k] > 0 ? w / A.startNominal[k] : null)),
    depleted1966: 1966 + A.depletedYear - 1,
    starts: (() => { const out = []; const rg = (s) => Math.pow(s.reduce((p, r) => p * (1 + M.portfolioReturn(r)) / (1 + r.inflation), 1), 1 / s.length) - 1;
      for (let y = M.FIRST_START; y <= M.LAST_START; y++) { const w = M.window30(data, y); const p = M.simulate(w);
        out.push({ y, depleted: p.depletedYear ? y + p.depletedYear - 1 : null, endReal: p.endReal[29], realGeo30: rg(w), realGeo10: rg(w.slice(0, 10)), less: p.endReal[29] < M.INITIAL }); }
      return out; })() };
  const cueMap = cues(sentences, takes, el);
  const pageData = { timeline: m2tl, sentences, claims: Object.fromEntries(claims.map((c) => [c.claimId, { display: c.display, illustrative: !!c.illustrative, basis: c.basis || null, character: c.character || null }])),
    tokens, cues: cueMap, model, subframes: 8 };
  fs.writeFileSync(path.join(ROOT, 'render-d', 'prod', 'data.js'), 'window.DATA = ' + JSON.stringify(pageData) + ';\n');
  // M2 contract root
  const R = path.join(ROOT, 'out', 'm3', 'root');
  fs.mkdirSync(path.join(R, 'out'), { recursive: true });
  const link = (rel, target) => { const p = path.join(R, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); try { fs.unlinkSync(p); } catch (e) { /* none */ } fs.symlinkSync(path.relative(path.dirname(p), path.join(ROOT, target)), p); };
  for (const d of ['data', 'design', 'preprod']) link(d, d);
  link('out/voice', 'out/voice');
  link('out/model.json', 'out/model.json');
  const w2 = (rel, o) => fs.writeFileSync(path.join(R, rel), JSON.stringify(o, null, 1));
  w2('out/timeline.json', m2tl);
  w2('out/script.json', { sentences });
  const sceneOfSentence = Object.fromEntries(sentences.map((l) => [l.id, l.scene]));
  const cl = claims.map((c) => {
    const spoken = (c.spoken || []).filter((x) => sceneOfSentence[x.sentence]).map((x) => ({ ...x, scene: sceneOfSentence[x.sentence] }));
    const shown = [...new Set([...c.shownIn.filter((x) => scenes.some((y) => y.id === x || y.id === x + '-b' || y.id === x + '-c')).flatMap((x) => scenes.filter((y) => y.id === x || y.id === x + '-b' || y.id === x + '-c').map((y) => y.id)), ...spoken.map((x) => x.scene)])];
    return { ...c, shownIn: shown, spoken, callbacks: (c.callbacks || []).filter((cb) => shown.includes(cb.scene)) };
  }).filter((c) => c.shownIn.length);
  w2('out/claims.json', { claims: cl });
  w2('out/page.json', { url: path.relative(R, path.join(ROOT, 'render-d', 'prod', 'page.html')), ready: 'document.fonts.ready' });
  const missingCues = sentences.flatMap((s) => (s.text.match(/−?\$?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?:\s(?:million|billion))?(?:-year)?/g) || []).filter((n) => !(`${s.id}|${n}` in cueMap)).map((n) => `${s.id}|${n}`));
  console.log('M3 scenes', scenes.length, 'end', end.toFixed(2), 's | sentences', sentences.length, '| cues', Object.keys(cueMap).length, '| missing number cues', missingCues.join(' ') || '-');
}

if (require.main === module) main();
module.exports = { cues };
