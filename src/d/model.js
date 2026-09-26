'use strict';
// Test D model (brief §1.2): 60/40 portfolio (S&P 500 incl. dividends / 10-year Treasury), rebalanced every year.
// Withdrawal at the start of each year: year 1 = 4% of the initial balance, later years = previous withdrawal ×
// (1 + previous year's inflation). 30 years. No taxes, no fees.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const INITIAL = 1000000, RATE = 0.04, YEARS = 30, W = { stocks: 0.6, bonds: 0.4 };
const FIRST_START = 1928, LAST_START = 1996;

function loadAnnual(file = path.join(ROOT, 'data', 'normalized', 'annual.csv')) {
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map((l) => l.split(',').map(Number));
  return Object.fromEntries(rows.map(([y, s, b, i]) => [y, { stocks: s, bonds: b, inflation: i }]));
}

const portfolioReturn = (r) => W.stocks * r.stocks + W.bonds * r.bonds;

// seq: [{stocks, bonds, inflation}] for years 1..30
function simulate(seq, initial = INITIAL, rate = RATE) {
  let B = initial, wd = rate * initial, price = 1, depletedYear = null;
  const withdrawals = [], endNominal = [], endReal = [], startNominal = [];
  seq.forEach((r, k) => {
    if (k > 0) wd *= 1 + seq[k - 1].inflation;
    if (depletedYear === null && B < wd) depletedYear = k + 1;
    const take = Math.min(wd, B);
    startNominal.push(B);
    B = (B - take) * (1 + portfolioReturn(r));
    price *= 1 + r.inflation;
    withdrawals.push(take); endNominal.push(B); endReal.push(B / price);
  });
  return { withdrawals, endNominal, endReal, depletedYear, startNominal };
}

const geoMean = (seq) => Math.pow(seq.reduce((p, r) => p * (1 + portfolioReturn(r)), 1), 1 / seq.length) - 1;
const arithMean = (seq) => seq.reduce((s, r) => s + portfolioReturn(r), 0) / seq.length;
const window30 = (data, y0) => Array.from({ length: YEARS }, (_, k) => data[y0 + k]);

// mirror: the 1966-1995 returns in reverse order (1995 first); inflation keeps calendar order, so both
// retirees take out exactly the same dollars every year and only the order of returns differs.
function mirrorSeq(base) {
  const rr = base.slice().reverse();
  return base.map((r, k) => ({ stocks: rr[k].stocks, bonds: rr[k].bonds, inflation: r.inflation }));
}

function build(data = loadAnnual()) {
  const base = window30(data, 1966);
  const mir = mirrorSeq(base);
  const P = (seq) => { const s = simulate(seq); return { withdrawals: s.withdrawals, endNominal: s.endNominal, endReal: s.endReal, depletedYear: s.depletedYear }; };
  const starts = {};
  for (let y = FIRST_START; y <= LAST_START; y++) starts[y] = P(window30(data, y));
  return {
    initial: INITIAL, rate: RATE, years: YEARS, weights: W, tax: 0, fees: 0, rebalance: 'annual', withdrawalTiming: 'start of year',
    realBasis: 'end-of-year balance deflated by cumulative CPI-U (Dec/Dec) since the start of year 1: dollars of the start year',
    paths: { 1966: P(base), mirror: { ...P(mir), reverse: ['returns'], illustrative: true } },
    starts,
  };
}

module.exports = { INITIAL, RATE, YEARS, W, FIRST_START, LAST_START, loadAnnual, portfolioReturn, simulate, geoMean, arithMean, window30, mirrorSeq, build };

if (require.main === module) {
  const m = build();
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'model.json'), JSON.stringify(m));
  const d = loadAnnual(), base = window30(d, 1966);
  console.log('G1966', (geoMean(base) * 100).toFixed(4), 'Gmirror', (geoMean(mirrorSeq(base)) * 100).toFixed(4));
  for (const k of ['1966', 'mirror']) {
    const p = m.paths[k];
    console.log(k, 'dep', p.depletedYear, 'end nominal', Math.round(p.endNominal[29]), 'end real', Math.round(p.endReal[29]),
      'by year:', p.endNominal.map((v, i) => `${i + 1}:${Math.round(v / 1000)}k`).join(' '));
  }
  const dep = Object.entries(m.starts).filter(([, p]) => p.depletedYear).map(([y, p]) => `${y}:${p.depletedYear}`);
  console.log('depleted starts', dep.join(' '));
}
