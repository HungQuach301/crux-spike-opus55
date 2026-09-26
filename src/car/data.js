'use strict';
// Every number the motion segment can draw, as claims, plus the series the charts plot.
const C = require('./calc');

const BASE = { balance: 25000, aprPct: 5.2, months: 48, extra: 400 };
const TAXES = [12, 22, 32];
const MAIN_TAX = 22;
const SWEEP = Array.from({ length: 33 }, (_, k) => 2 + k * 0.25); // 2.00 .. 10.00
const SEQ = { first: 8, second: -20, split: 36 }; // stated bad-sequence scenario (not a forecast)

const FMT = {
  usd0: (v) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US'),
  pct2: (v) => v.toFixed(2) + '%',
  pct1: (v) => v.toFixed(1) + '%',
  pct0: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(0) + '%',
  int: (v) => String(Math.round(v)),
};

function sides(r, t) {
  const a = C.simulate({ ...BASE, returns: r, taxPct: t, strategy: 'A' });
  const b = C.simulate({ ...BASE, returns: r, taxPct: t, strategy: 'B' });
  const gainA = a.inv - a.basis, gainB = b.inv - b.basis;
  return { a, b, barA: a.basis - b.basis, barB: (gainB - gainA) * (1 - t / 100), gap: b.nw - a.nw };
}

function build() {
  const claims = [];
  const byId = {};
  const add = (claimId, value, fmt, how, inputs = {}) => {
    const c = { claimId, value, fmt, display: FMT[fmt](value), ...how, inputs };
    claims.push(c); byId[claimId] = c; return c;
  };
  const input = (id, v, fmt, note) => add(id, v, fmt, { formula: 'input', note });

  input('balance', BASE.balance, 'usd0', 'Base case remaining balance (brief).');
  input('apr', BASE.aprPct, 'pct1', 'Base case APR (brief). Stated input, not a market average.');
  input('months', BASE.months, 'int', 'Months left (brief).');
  input('extra', BASE.extra, 'usd0', 'Extra cash per month available to either strategy. Our stated assumption; the brief does not fix it.');
  TAXES.forEach((t) => input(`tax_${t}`, t, 'pct0', 'Marginal tax rate on investment gains (brief sweep). Simplified: gains taxed once, at month 48, at this rate; no tax credit for losses; loan interest not deductible.'));

  const base = C.simulate({ ...BASE, returns: 0, taxPct: 0, strategy: 'A' });
  const minPath = C.simulate({ ...BASE, returns: 0, taxPct: 0, strategy: 'B' });
  add('payment', base.P, 'usd0', { formula: 'P = B·i/(1−(1+i)^−n), i = APR/12, rounded to cents' }, BASE);
  add('payoff_a', base.payoffMonth, 'int', { formula: 'first month where balance hits 0 when paying P + extra' }, BASE);
  add('horizon', BASE.months, 'int', { formula: 'input: horizon month' });
  add('int_a', base.interestPaid, 'usd0', { formula: 'Σ monthly interest, paying P + extra until paid off' }, BASE);
  add('int_b', minPath.interestPaid, 'usd0', { formula: 'Σ monthly interest, paying P for 48 months' }, BASE);
  add('avoided', C.round2(minPath.interestPaid - base.interestPaid), 'usd0', { formula: 'int_b − int_a (independent of returns and tax: certain)' }, BASE);

  const be = {};
  TAXES.forEach((t) => {
    be[t] = C.breakEven(BASE, t);
    add(`be_${t}`, be[t], 'pct2', { formula: 'r such that after-tax net worth at month 48 is equal for A and B (bisection, 80 iterations)' }, { ...BASE, taxPct: t });
  });
  be[0] = C.breakEven(BASE, 0);

  // Sweep at the main tax rate.
  const sweep = SWEEP.map((r, k) => {
    const s = sides(r, MAIN_TAX);
    add(`r_${k}`, r, 'pct2', { formula: 'sweep value: 2.00% + k × 0.25%' }, { k });
    add(`barb_${k}`, s.barB, 'usd0', { formula: '(gains_B − gains_A) × (1 − tax): extra after-tax growth from investing earlier' }, { ...BASE, returnPct: r, taxPct: MAIN_TAX });
    return { r, barA: s.barA, barB: s.barB, nwA: s.a.nw, nwB: s.b.nw };
  });
  add('axis_lo', 2, 'pct0', { formula: 'axis label: sweep minimum' });
  add('axis_hi', 10, 'pct0', { formula: 'axis label: sweep maximum' });

  // Fine curve for drawing (0.05% steps) at the main tax rate.
  const curve = [];
  for (let r = 2; r <= 10.0001; r += 0.05) { const s = sides(r, MAIN_TAX); curve.push({ r: +r.toFixed(2), nwA: s.a.nw, nwB: s.b.nw, barB: s.barB }); }
  const atBe = sides(be[MAIN_TAX], MAIN_TAX);
  add('barb_be', atBe.barB, 'usd0', { formula: 'extra after-tax growth at the break-even return (equals interest avoided)' }, { ...BASE, returnPct: be[MAIN_TAX], taxPct: MAIN_TAX });

  // Stated bad sequence.
  const seq = C.sequence(BASE.months, SEQ.split, SEQ.first, SEQ.second);
  const da = C.simulate({ ...BASE, returns: seq, taxPct: MAIN_TAX, strategy: 'A' });
  const db = C.simulate({ ...BASE, returns: seq, taxPct: MAIN_TAX, strategy: 'B' });
  const gapPath = da.path.map((p, m) => db.path[m].nw - p.nw); // B minus A
  const cross = gapPath.findIndex((g, m) => m > 0 && g < 0 && gapPath[m - 1] >= 0);
  add('seq_first', SEQ.first, 'pct0', { formula: 'stated scenario: annual return for months 1–36 (not a forecast)' });
  add('seq_second', SEQ.second, 'pct0', { formula: 'stated scenario: annual return for months 37–48 (not a forecast)' });
  add('seq_year', 4, 'int', { formula: 'year in which the second rate applies (months 37–48)' });
  add('cross_month', cross, 'int', { formula: 'first month m where NW_B − NW_A turns negative under the stated sequence' }, { ...BASE, taxPct: MAIN_TAX, sequence: SEQ });
  add('gap_end', -gapPath[BASE.months], 'usd0', { formula: 'NW_A − NW_B at month 48 under the stated sequence (after tax)' }, { ...BASE, taxPct: MAIN_TAX, sequence: SEQ });

  return {
    base: BASE, taxes: TAXES, mainTax: MAIN_TAX, seqSpec: SEQ,
    breakEvens: be,
    sweep, curve, atBe: { r: be[MAIN_TAX], nwA: atBe.a.nw, nwB: atBe.b.nw, barB: atBe.barB, barA: atBe.barA },
    loan: {
      a: base.path.map((p) => p.loan), b: minPath.path.map((p) => p.loan),
      payoffA: base.payoffMonth, intA: base.interestPaid, intB: minPath.interestPaid,
    },
    downside: { a: da.path.map((p) => p.nw), b: db.path.map((p) => p.nw), gap: gapPath, cross },
    claims,
  };
}

module.exports = { BASE, TAXES, MAIN_TAX, SWEEP, SEQ, FMT, build, sides };
