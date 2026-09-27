'use strict';
// Test D claims registry: every number on screen or in the narration, with its formula, source and data years.
// Values are computed here from the model and the normalized data; displays are rounded from those values.
// `spoken` and `shownIn` are filled by matching the script (src/d/script.js); a sentence with a number that is
// not registered for its scene fails `node src/d/claims.js`.
const fs = require('fs');
const path = require('path');
const M = require('./model');
const { ACTS } = require('./script');

const ROOT = path.join(__dirname, '..', '..');
const D = { id: 'damodaran-histretSP-2026', url: 'https://pages.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls' };
const MODEL = 'src/d/model.js';

const data = M.loadAnnual();
const base = M.window30(data, 1966);
const mir = M.mirrorSeq(base);
const A = M.simulate(base), B = M.simulate(mir);
const realGeo = (s) => Math.pow(s.reduce((p, r) => p * (1 + M.portfolioReturn(r)) / (1 + r.inflation), 1), 1 / s.length) - 1;
const pct = (x, d = 1) => +(x * 100).toFixed(d);
const Y = (y) => y - 1966; // index into the 1966 path
const starts = {};
for (let y = M.FIRST_START; y <= M.LAST_START; y++) starts[y] = M.simulate(M.window30(data, y));
const depleted = Object.entries(starts).filter(([, p]) => p.depletedYear).map(([y]) => +y);
const g66r = realGeo(base);
const lowerReal = Object.keys(starts).map(Number).filter((y) => realGeo(M.window30(data, y)) < g66r);
const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');
const usdK = (v) => '$' + (Math.round(v / 1000) * 1000).toLocaleString('en-US');
const usdM = (v) => '$' + (v / 1e6).toFixed(2) + ' million';

const GAINS_FELL = [];
for (let i = 0; i < A.depletedYear; i++) { const r = M.portfolioReturn(base[i]); const start = i ? A.endReal[i - 1] : M.INITIAL || 1e6; if (r > 0.10 && A.endReal[i] < start) GAINS_FELL.push(1966 + i); }
const hist = (years) => (Array.isArray(years) ? { dataYears: years } : { dataYear: years });
const year = (id, y, formula, extra = {}) => ({ claimId: id, value: y, display: String(y), formula, source: D, ...hist(y), historical: true, illustrative: false, ...extra });

const C = [
  // ---- years
  year('y1966', 1966, 'first calendar year of the 1966 retiree\'s 30-year window (brief §1.4)'),
  year('y1991', 1966 + A.depletedYear - 1, 'calendar year in which the 1966 path cannot pay the full withdrawal: 1966 + depletedYear − 1 (depletedYear = ' + A.depletedYear + ')', { dataYears: [1966, 1991], decisive: true, character: '1966' }),
  year('y1995', 1995, 'last calendar year of the 1966–1995 window'),
  // axis labels of the year axes (shown only as axis labels; role axis)
  year('ax1966', 1966, 'first year on a 1966–1995 time axis', { role: 'axis', planned: ['co-lines', 'co-same', 'co-broke', 'a1-raise', 'a1-real', 'a1-horizon', 'a1-mirror-rule', 'a1-arith'] }),
  year('ax1995', 1995, 'last year on a 1966–1995 time axis', { role: 'axis', planned: ['co-lines', 'co-same', 'co-broke', 'a1-raise', 'a1-real', 'a1-horizon', 'a1-mirror-rule', 'a1-arith'] }),
  year('y1928', 1928, 'first year of Damodaran\'s annual series and first start year with a full 30-year window'),
  year('y1996', 1996, 'last start year with 30 full years of data (1996 + 29 = 2025)'),
  year('y1969', 1969, 'calendar year (inflation example; later a start year that ran out)'),
  year('y1973', 1973, 'calendar year of the 1973–1974 bear market'),
  year('y1974', 1974, 'calendar year of the 1973–1974 bear market'),
  year('y1979', 1979, 'calendar year of peak 1970s inflation in the window'),
  year('y1981', 1981, 'calendar year (withdrawal example)'),
  year('y1982', 1982, 'calendar year: first of the 1980s gains; also a start year in act 3'),
  year('y1986', 1986, 'calendar year of the largest real gap between the two paths: argmax_k (mirror endReal[k] − 1966 endReal[k])', { dataYears: [1966, 1986] }),
  year('y1987', 1987, 'calendar year in which the mirror path receives the 1974 return (reverse order: year 22 ← year 9)'),
  year('y1975', 1975, 'calendar year (rebound example)'),
  year('y1976', 1976, 'calendar year (rebound example)'),
  year('y1929', 1929, 'start year beginning with the 1929 crash; its 30-year path is not depleted'),
  year('y1965', 1965, 'start year whose 30-year path is depleted (depletedYear = ' + starts[1965].depletedYear + ')'),
  year('y1968', 1968, 'start year whose 30-year path is depleted (depletedYear = ' + starts[1968].depletedYear + ')'),

  // ---- model inputs (assumptions: no data source -> ILLUSTRATIVE)
  { claimId: 'initial', value: M.INITIAL, display: '$1 million', formula: 'model input: initial balance at the start of 1966', source: null, illustrative: true, basis: 'real' },
  { claimId: 'w60', value: 60, display: '60%', formula: 'model input: stock weight after each annual rebalance', source: null, illustrative: true },
  { claimId: 'w40', value: 40, display: '40%', formula: 'model input: bond weight after each annual rebalance', source: null, illustrative: true },
  { claimId: 'sp500', value: 500, display: 'Standard & Poor\'s 500', formula: 'index name (S&P 500 including dividends, as compiled by Damodaran)', source: D, historical: false, illustrative: false },
  { claimId: 'tbond10', value: 10, display: '10-year', formula: 'bond maturity in Damodaran\'s T.Bond series (10-year constant maturity)', source: D, historical: false, illustrative: false },
  { claimId: 'rate4', value: 4, display: '4%', formula: 'model input: year-1 withdrawal as a share of the initial balance (describes the historical exercise; not a recommendation)', source: null, illustrative: true },
  { claimId: 'wd1', value: A.withdrawals[0], display: usd(A.withdrawals[0]), formula: '4% × $1,000,000; in real terms (1966 dollars) every later withdrawal equals this too', source: null, illustrative: true, basis: 'real' },
  { claimId: 'years30', value: 30, display: '30', formula: 'model input: horizon in years', source: null, illustrative: true },

  // ---- averages (core)
  { claimId: 'g1966', value: +(M.geoMean(base) * 100).toFixed(4), display: pct(M.geoMean(base)) + '%', kind: 'geomean', character: '1966', core: true,
    formula: '(Π_{y=1966..1995} (1 + 0.6·S&P_y + 0.4·TBond_y))^(1/30) − 1, nominal', source: D, ...hist([1966, 1995]), historical: true, illustrative: false,
    callbacks: [
      { scene: 'a1-avg1966', meaning: 'the setup: the 1966 retiree earned this average' },
      { scene: 'a2-payoff', meaning: 'the irony: the same average did not keep the 1966 retiree from going broke' },
      { scene: 'a3-avg-callback', meaning: 'the lesson: an accurate average that said nothing about the outcome' },
    ] },
  { claimId: 'gmirror', value: +(M.geoMean(mir) * 100).toFixed(4), display: pct(M.geoMean(mir)) + '%', kind: 'geomean', character: 'mirror',
    formula: 'same product as g1966 in reverse order (multiplication is commutative)', source: D, ...hist([1966, 1995]), historical: true, illustrative: true },
  { claimId: 'arith', value: +(M.arithMean(base) * 100).toFixed(4), display: pct(M.arithMean(base)) + '%', formula: 'Σ_{1966..1995} (0.6·S&P_y + 0.4·TBond_y) / 30, nominal; identical for the mirror',
    source: D, ...hist([1966, 1995]), historical: true, illustrative: false },

  // ---- act 2
  { claimId: 'ret1966', value: pct(M.portfolioReturn(data[1966])), display: pct(-M.portfolioReturn(data[1966])) + '%', formula: '−(0.6·S&P_1966 + 0.4·TBond_1966): loss in 1966 (shown as a loss)', source: D, ...hist(1966), historical: true, illustrative: false, character: '1966' },
  { claimId: 'ret1995m', value: pct(M.portfolioReturn(data[1995])), display: pct(M.portfolioReturn(data[1995])) + '%', formula: '0.6·S&P_1995 + 0.4·TBond_1995: the mirror retiree\'s year-1 return', source: D, ...hist(1995), historical: true, illustrative: true, character: 'mirror' },
  { claimId: 'inf1969', value: pct(data[1969].inflation), display: pct(data[1969].inflation) + '%', formula: 'CPI-U Dec/Dec 1969 (Damodaran, from FRED)', source: D, ...hist(1969), historical: true, illustrative: false },
  { claimId: 'loss1974', value: pct(M.portfolioReturn(data[1974])), display: pct(-M.portfolioReturn(data[1974])) + '%', formula: '−(0.6·S&P_1974 + 0.4·TBond_1974): loss in 1974', source: D, ...hist(1974), historical: true, illustrative: false },
  { claimId: 'inf1974', value: pct(data[1974].inflation), display: pct(data[1974].inflation) + '%', formula: 'CPI-U Dec/Dec 1974', source: D, ...hist(1974), historical: true, illustrative: false },
  // real 1973-74 returns: drawn as bar heights in a2-7374 (no number text on screen, so they are not new numbers there)
  ...[1973, 1974].flatMap((y) => ['stocks', 'bonds'].map((k) => {
    const v = (1 + data[y][k]) / (1 + data[y].inflation) - 1;
    return { claimId: `real${k === 'stocks' ? 'S' : 'B'}${y}`, value: pct(v, 4), display: (v < 0 ? '−' : '') + Math.abs(pct(v)) + '%', presentation: 'bar height only, no number text',
      formula: `(1 + ${k === 'stocks' ? 'S&P' : 'TBond'}_${y}) / (1 + inflation_${y}) − 1 (${k === 'stocks' ? 'S&P 500 incl. dividends' : '10-year Treasury'}, real)`, source: D, ...hist(y), historical: true, illustrative: false,
      planned: ['a2-7374'] };
  })),
  { claimId: 'bal74', value: A.endReal[Y(1974)], display: usdK(A.endReal[Y(1974)]), basis: 'real', decisive: true, character: '1966', formula: '1966 path endReal[1974] = endNominal / Π(1+inflation) 1966..1974, rounded to $1,000', source: D, ...hist([1966, 1974]), historical: true, illustrative: false },
  { claimId: 'bal74m', value: B.endReal[Y(1974)], display: usdM(B.endReal[Y(1974)]), basis: 'real', character: 'mirror', formula: 'mirror path endReal at the end of 1974 (year 9)', source: D, ...hist([1966, 1995]), historical: true, illustrative: true },
  { claimId: 'inf1979', value: pct(data[1979].inflation), display: pct(data[1979].inflation) + '%', formula: 'CPI-U Dec/Dec 1979', source: D, ...hist(1979), historical: true, illustrative: false },
  { claimId: 'wd1981', value: A.withdrawals[Y(1981)], display: usd(A.withdrawals[Y(1981)]), basis: 'nominal', character: '1966', formula: '$40,000 × Π(1+inflation) 1966..1980: the 1981 withdrawal in dollars of the day', source: D, ...hist([1966, 1980]), historical: true, illustrative: false },
  { claimId: 'ret1975', value: pct(M.portfolioReturn(data[1975])), display: pct(M.portfolioReturn(data[1975])) + '%', formula: '0.6·S&P_1975 + 0.4·TBond_1975', source: D, ...hist(1975), historical: true, illustrative: false },
  { claimId: 'ret1976', value: pct(M.portfolioReturn(data[1976])), display: pct(M.portfolioReturn(data[1976])) + '%', formula: '0.6·S&P_1976 + 0.4·TBond_1976', source: D, ...hist(1976), historical: true, illustrative: false },
  { claimId: 'ret1982', value: pct(M.portfolioReturn(data[1982])), display: pct(M.portfolioReturn(data[1982])) + '%', formula: '0.6·S&P_1982 + 0.4·TBond_1982', source: D, ...hist(1982), historical: true, illustrative: false },
  { claimId: 'share1982', value: pct(A.withdrawals[Y(1982)] / A.startNominal[Y(1982)]), display: pct(A.withdrawals[Y(1982)] / A.startNominal[Y(1982)]) + '%', character: '1966', formula: '1982 withdrawal / balance at the start of 1982 (1966 path)', source: D, ...hist([1966, 1982]), historical: true, illustrative: false },
  // 1980s: good years in which the balance still fell after the withdrawal and inflation (1966 path, years it was alive)
  { claimId: 'gainsFell', value: GAINS_FELL.length, display: String(GAINS_FELL.length), character: '1966', formula: 'count of 1966-path years (1966..1991) with 0.6·S&P + 0.4·TBond > 10% and endReal < real balance at the start of the year: ' + GAINS_FELL.join(', '), source: D, ...hist([1966, 1991]), historical: true, illustrative: false, years: GAINS_FELL },
  { claimId: 'gt10', value: 10, display: '10%', formula: 'threshold of a "gain above 10%": portfolio nominal return > 10%', source: D, ...hist([1966, 1991]), historical: true, illustrative: false },
  { claimId: 'gap86', value: B.endReal[Y(1986)] - A.endReal[Y(1986)], display: usdM(B.endReal[Y(1986)] - A.endReal[Y(1986)]), basis: 'real', decisive: true, formula: 'mirror endReal[1986] − 1966 endReal[1986]; the largest gap of the 30 years', source: D, ...hist([1966, 1995]), historical: true, illustrative: true },
  { claimId: 'years49', value: (B.endReal[Y(1986)] - A.endReal[Y(1986)]) / 40000, display: String(Math.round((B.endReal[Y(1986)] - A.endReal[Y(1986)]) / 40000)), formula: 'gap86 / $40,000 (real withdrawal), rounded', source: D, ...hist([1966, 1995]), historical: true, illustrative: true },
  { claimId: 'last91', value: A.withdrawals[Y(1991)], display: usd(A.withdrawals[Y(1991)]), basis: 'nominal', character: '1966', formula: 'whole remaining balance paid out in 1991 (less than the full withdrawal of ' + usd(A.withdrawals[Y(1990)] * (1 + data[1990].inflation)) + ')', source: D, ...hist([1966, 1991]), historical: true, illustrative: false },
  { claimId: 'emptyYears', value: 30 - A.depletedYear, display: String(30 - A.depletedYear), formula: '30 − depletedYear: plan years with nothing left (1992–1995)', source: D, ...hist([1966, 1991]), historical: true, illustrative: false },
  { claimId: 'endm', value: B.endNominal[29], display: usdM(B.endNominal[29]), basis: 'nominal', character: 'mirror', formula: 'mirror endNominal at the end of year 30', source: D, ...hist([1966, 1995]), historical: true, illustrative: true },
  { claimId: 'endmr', value: B.endReal[29], display: usdM(B.endReal[29]), basis: 'real', character: 'mirror', formula: 'mirror endReal at the end of year 30 (1966 dollars)', source: D, ...hist([1966, 1995]), historical: true, illustrative: true },

  // ---- act 3
  { claimId: 'n69', value: M.LAST_START - M.FIRST_START + 1, display: '69', formula: 'start years 1928..1996', source: D, ...hist([1928, 2025]), historical: true, illustrative: false },
  { claimId: 'n65', value: 69 - depleted.length, display: String(69 - depleted.length), formula: 'start years whose depletedYear is null', source: D, ...hist([1928, 2025]), historical: true, illustrative: false },
  { claimId: 'n4', value: depleted.length, display: String(depleted.length), formula: 'start years with a depletedYear: ' + depleted.join(', '), source: D, ...hist([1928, 2025]), historical: true, illustrative: false },
  { claimId: 'end1982', value: starts[1982].endReal[29], display: usdM(starts[1982].endReal[29]), basis: 'real', formula: 'start-1982 path endReal after 30 years (1982 dollars)', source: D, ...hist([1982, 2011]), historical: true, illustrative: false },
  { claimId: 'n26', value: Object.values(starts).filter((p) => p.endReal[29] < M.INITIAL).length, display: String(Object.values(starts).filter((p) => p.endReal[29] < M.INITIAL).length), formula: 'start years with endReal[30] < $1,000,000 (start-year dollars)', source: D, ...hist([1928, 2025]), historical: true, illustrative: false },
  { claimId: 'rg1966', value: pct(g66r, 4), display: pct(g66r) + '%', formula: '(Π (1+r_y)/(1+i_y))^(1/30) − 1 over 1966..1995: real geometric average', source: D, ...hist([1966, 1995]), historical: true, illustrative: false, character: '1966' },
  { claimId: 'n17', value: lowerReal.filter((y) => !starts[y].depletedYear).length, display: String(lowerReal.filter((y) => !starts[y].depletedYear).length), formula: 'start years with a lower real 30-year average than 1966 and no depletion: ' + lowerReal.filter((y) => !starts[y].depletedYear).join(', '), source: D, ...hist([1928, 2025]), historical: true, illustrative: false },
  { claimId: 'rg1969', value: pct(realGeo(M.window30(data, 1969)), 4), display: pct(realGeo(M.window30(data, 1969))) + '%', formula: 'real geometric average of the 1969–1998 window', source: D, ...hist([1969, 1998]), historical: true, illustrative: false },
  { claimId: 'rg1928', value: pct(realGeo(M.window30(data, 1928)), 4), display: pct(realGeo(M.window30(data, 1928))) + '%', formula: 'real geometric average of the 1928–1957 window', source: D, ...hist([1928, 1957]), historical: true, illustrative: false },
  { claimId: 'end1928', value: starts[1928].endReal[29], display: usdM(starts[1928].endReal[29]), basis: 'real', formula: 'start-1928 path endReal after 30 years (1928 dollars)', source: D, ...hist([1928, 1957]), historical: true, illustrative: false },
  { claimId: 'dep1969', value: starts[1969].depletedYear, display: starts[1969].depletedYear + 'th', formula: 'depletedYear of the 1969 start', source: D, ...hist([1969, 1998]), historical: true, illustrative: false },
  { claimId: 'decade10', value: 10, display: '10 years', formula: 'first-decade window length used in act 3', source: null, illustrative: true },
  { claimId: 'dec1966', value: pct(realGeo(base.slice(0, 10)), 4), display: (realGeo(base.slice(0, 10)) < 0 ? '−' : '') + Math.abs(pct(realGeo(base.slice(0, 10)))) + '%', decisive: true, character: '1966',
    formula: 'real geometric average of 1966–1975', source: D, ...hist([1966, 1975]), historical: true, illustrative: false },
  { claimId: 'decm', value: pct(realGeo(mir.slice(0, 10)), 4), display: pct(realGeo(mir.slice(0, 10))) + '%', character: 'mirror', formula: 'real geometric average of the mirror\'s first 10 years (returns of 1995..1986 with inflation of 1966..1975)', source: D, ...hist([1966, 1995]), historical: true, illustrative: true },
  { claimId: 'dec1929', value: pct(realGeo(M.window30(data, 1929).slice(0, 10)), 4), display: pct(realGeo(M.window30(data, 1929).slice(0, 10))) + '%', formula: 'real geometric average of 1929–1938', source: D, ...hist([1929, 1938]), historical: true, illustrative: false },
  { claimId: 'n98', value: 2025 - 1928 + 1, display: '98', formula: 'years of data 1928..2025', source: D, ...hist([1928, 2025]), historical: true, illustrative: false },
  { claimId: 'n3', value: Math.floor(98 / 30), display: '3', formula: 'floor(98 / 30): non-overlapping 30-year windows', source: D, ...hist([1928, 2025]), historical: true, illustrative: false },
];

// ---- number canon (same rules as checks/py/common.py numbers_in_text, re-implemented here for the build)
const NUM_RE = /(?<![\w.])([-−–]?\$?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%|percent\b|pp\b)?(\s?(?:million|billion|thousand|k)\b)?/gi;
function numbersIn(text) {
  const out = [];
  for (const m of text.matchAll(NUM_RE)) {
    const [, sign, whole, frac, pc, mult] = m;
    let v = Number(whole.replace(/,/g, '') + (frac || ''));
    if (mult) v *= { million: 1e6, billion: 1e9, thousand: 1e3, k: 1e3 }[mult.trim().toLowerCase()];
    const sg = (sign || '').replace('$', '');
    if (sg && !(m.index > 0 && /\d/.test(text[m.index - 1]))) v = -v;
    const unit = (sign || '').includes('$') ? 'usd' : pc ? (pc.toLowerCase() === 'pp' ? 'pp' : 'pct') : 'num';
    out.push({ canon: `${unit}:${+v.toFixed(6)}`, text: m[0].trim() });
  }
  return out;
}
const canonMatch = (a, b) => { const [ua, va] = a.split(':'), [ub, vb] = b.split(':'); return Math.abs(+va - +vb) <= 1e-9 * Math.max(1, Math.abs(+va)) && (ua === ub || ua === 'num' || ub === 'num'); };

function build() {
  const byId = Object.fromEntries(C.map((c) => [c.claimId, { ...c, spoken: [], shownIn: [], callbacks: c.callbacks || [] }]));
  const errors = [];
  const sceneAct = {};
  for (const a of ACTS) for (const s of a.scenes) sceneAct[s.id] = a.id;
  let seen = new Set();
  for (const a of ACTS) for (const s of a.scenes) s.lines.forEach((l, i) => {
    const sid = `${s.id}.${i + 1}`;
    for (const n of numbersIn(l.t)) {
      // disambiguation: explicit hint on the line, then verbatim display, exact unit, character, already introduced
      const cands = C.filter((c) => c.role !== 'axis' && numbersIn(c.display).some((x) => canonMatch(x.canon, n.canon)));
      if (!cands.length) { errors.push(`${sid}: unregistered number "${n.text}"`); continue; }
      const hint = (l.claims || {})[n.text];
      const unit = n.canon.split(':')[0];
      const who = /mirror/i.test(l.t) ? 'mirror' : '1966';
      const score = (c) => (hint === c.claimId ? 100 : 0) + (l.t.includes(c.display) ? 8 : 0) + (numbersIn(c.display)[0].canon.split(':')[0] === unit ? 4 : 0) +
        (c.character ? (c.character === who ? 2 : -20) : 0) + (seen.has(c.claimId) ? 1 : 0);
      const pick = cands.slice().sort((a, b) => score(b) - score(a))[0];
      seen.add(pick.claimId);
      const cl = byId[pick.claimId];
      cl.spoken.push({ scene: s.id, sentence: sid });
      if (!cl.shownIn.includes(s.id)) cl.shownIn.push(s.id);
    }
  });
  for (const c of Object.values(byId)) for (const sc of c.planned || []) if (!c.shownIn.includes(sc)) c.shownIn.push(sc);
  // both geomean claims are shown together wherever either is shown (the two cards of the "average" scenes)
  for (const s of byId.g1966.shownIn) if (s !== 'a3-avg-callback' && !byId.gmirror.shownIn.includes(s)) byId.gmirror.shownIn.push(s);
  for (const c of Object.values(byId)) {
    if (!c.formula) errors.push(`${c.claimId}: no formula`);
    if (!c.source && !c.illustrative) errors.push(`${c.claimId}: no source and not illustrative`);
    if (c.source && c.historical !== false && !(c.dataYear || c.dataYears)) errors.push(`${c.claimId}: no data year`);
    if (c.display.includes('$') && !['real', 'nominal'].includes(c.basis)) errors.push(`${c.claimId}: money without basis`);
    if (c.character === 'mirror' && !c.illustrative) errors.push(`${c.claimId}: mirror claim not illustrative`);
    for (const cb of c.callbacks) if (!c.shownIn.includes(cb.scene)) errors.push(`${c.claimId}: callback scene ${cb.scene} does not show/say it`);
  }
  const unused = Object.values(byId).filter((c) => !c.shownIn.length).map((c) => c.claimId);
  return { claims: Object.values(byId), errors, unused };
}

module.exports = { build, numbersIn, canonMatch, CLAIMS: C };

if (require.main === module) {
  const r = build();
  fs.writeFileSync(path.join(ROOT, 'out', 'claims.json'), JSON.stringify({ claims: r.claims }, null, 1));
  console.log('claims', r.claims.length, '| unused', r.unused.join(' ') || '-');
  if (r.errors.length) { console.error(r.errors.join('\n')); process.exit(1); }
}
