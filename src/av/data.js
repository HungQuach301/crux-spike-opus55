'use strict';
// Every number the video can draw or say, as claims, plus the series the charts plot.
const C = require('./calc');

const BASE = { balance: 25000, aprPct: 5.2, months: 48, extra: 400 };
// Tax brackets: ordinary (short-term lots) / long-term (lots held > 12 months at month 48).
const BRACKETS = [{ id: 12, ord: 12, lt: 0 }, { id: 22, ord: 22, lt: 15 }, { id: 32, ord: 32, lt: 15 }];
const MAIN = 22;
const SWEEP = Array.from({ length: 33 }, (_, k) => 2 + k * 0.25); // 2.00 .. 10.00 (ILLUSTRATIVE range)
const SEQ = { first: 8, second: -20, split: 36 }; // ILLUSTRATIVE bad sequence, not a forecast
const ILLU = 'ILLUSTRATIVE: chosen by us to show the mechanics, not a forecast or a recommendation.';

const FMT = {
  usd0: (v) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US'),
  pct2: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '%',
  pct1: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%',
  pct0: (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(0) + '%',
  int: (v) => (v < 0 ? '−' : '') + String(Math.abs(Math.round(v))),
  year: (v) => String(v),
};
const bracketOf = (id) => BRACKETS.find((b) => b.id === id);

function build() {
  const claims = [];
  const byId = {};
  const add = (claimId, value, fmt, how, inputs = {}) => {
    if (byId[claimId]) throw new Error('duplicate claim ' + claimId);
    const c = { claimId, value, fmt, display: FMT[fmt](value), ...how, inputs };
    claims.push(c); byId[claimId] = c; return c;
  };
  const input = (id, v, fmt, note, extra = {}) => add(id, v, fmt, { formula: 'input', note, ...extra });

  input('balance', BASE.balance, 'usd0', 'Base case remaining balance (brief).');
  input('apr', BASE.aprPct, 'pct1', 'Base case APR (brief). A stated input, not a market average.');
  input('months', BASE.months, 'int', 'Months left on the loan (brief).');
  input('extra', BASE.extra, 'usd0', 'Extra cash per month available to either road. ' + ILLU, { illustrative: true });
  input('ord_12', 12, 'pct0', 'Ordinary income bracket (brief): applies to short-term lots.');
  input('ord_22', 22, 'pct0', 'Ordinary income bracket (brief): applies to short-term lots.');
  input('ord_32', 32, 'pct0', 'Ordinary income bracket (brief): applies to short-term lots.');
  input('lt_0', 0, 'pct0', 'Long-term capital-gains rate paired with the 12% bracket (brief).');
  input('lt_15', 15, 'pct0', 'Long-term capital-gains rate paired with the 22% and 32% brackets (brief).');
  input('hold_months', 12, 'int', 'A lot held more than this many months at month 48 is long-term.');
  input('ded_y0', 2025, 'year', 'First tax year of the new-vehicle loan interest deduction; the model ignores this deduction.');
  input('ded_y1', 2028, 'year', 'Last tax year of the new-vehicle loan interest deduction; the model ignores this deduction.');

  const br = bracketOf(MAIN);
  const a0 = C.simulate({ ...BASE, returns: 0, bracket: br, strategy: 'A' });
  const b0 = C.simulate({ ...BASE, returns: 0, bracket: br, strategy: 'B' });
  add('payment', a0.P, 'usd0', { formula: 'P = B·i/(1−(1+i)^−n), i = APR/12, rounded to cents' }, BASE);
  add('payoff_a', a0.payoffMonth, 'int', { formula: 'first month where the balance hits 0 when paying P + extra' }, BASE);
  add('horizon', BASE.months, 'int', { formula: 'horizon month (road B pays its last payment)' });
  add('months_free', BASE.months - a0.payoffMonth, 'int', { formula: 'horizon − payoff_a: months with no car payment on road A' }, BASE);
  add('int_a', a0.interestPaid, 'usd0', { formula: 'Σ monthly interest, paying P + extra until paid off' }, BASE);
  add('int_b', b0.interestPaid, 'usd0', { formula: 'Σ monthly interest, paying P for 48 months' }, BASE);
  add('avoided', C.round2(b0.interestPaid - a0.interestPaid), 'usd0', { formula: 'int_b − int_a (independent of returns and tax: certain)' }, BASE);
  add('extra_basis_a', C.round2(a0.basis - b0.basis), 'usd0', { formula: 'invested basis of road A − invested basis of road B at month 48 (equals interest avoided, since both roads spend the same cash)' }, BASE);
  add('basis_b', b0.basis, 'usd0', { formula: 'road B invested basis at month 48 = extra × 48' }, BASE);
  add('basis_a', a0.basis, 'usd0', { formula: 'road A invested basis at month 48' }, BASE);
  add('budget', C.round2(a0.P + BASE.extra), 'usd0', { formula: 'P + extra: the cash both roads spend each month' }, BASE);
  // month-axis ticks for the timeline chart
  [0, 12, 24, 36, 48].forEach((m) => add(`tick_m${m}`, m, 'int', { formula: 'axis tick: month' }));

  // Lots at the main bracket, for the lot chapter (road B at the break-even return).
  const lotLong = BASE.months - 12; // lots contributed before this month are long-term at month 48
  add('lt_last_month', lotLong - 1, 'int', { formula: 'last contribution month whose lot is held more than 12 months at month 48 (48 − 13)' });
  add('st_first_month', lotLong, 'int', { formula: 'first contribution month whose lot is short-term at month 48' });
  add('lots_st_a', a0.lots.filter((l) => BASE.months - l.m <= 12).length, 'int', { formula: 'road A lots that are short-term at month 48' }, BASE);
  add('lots_lt_a', a0.lots.filter((l) => BASE.months - l.m > 12).length, 'int', { formula: 'road A lots that are long-term at month 48' }, BASE);
  add('lots_st_b', b0.lots.filter((l) => BASE.months - l.m <= 12).length, 'int', { formula: 'road B lots that are short-term at month 48' }, BASE);
  add('lots_lt_b', b0.lots.filter((l) => BASE.months - l.m > 12).length, 'int', { formula: 'road B lots that are long-term at month 48' }, BASE);

  // Break-even average annual return (compounded) per bracket.
  const be = {};
  for (const b of BRACKETS) {
    be[b.id] = C.breakEven(BASE, b);
    add(`be_${b.id}`, be[b.id], 'pct2', { formula: 'average annual return (compounded) at which after-tax net worth at month 48 is equal for A and B (bisection, 80 iterations); per-lot tax, losses not deductible' }, { ...BASE, bracket: b });
  }
  be[0] = C.breakEven(BASE, { ord: 0, lt: 0 });
  add('be_0', be[0], 'pct2', { formula: 'break-even with no tax at all: the 5.2% APR as an effective annual rate' }, BASE);

  // Sweep at the main bracket (ILLUSTRATIVE range 2%–10%).
  const sides = (r, b) => {
    const a = C.simulate({ ...BASE, returns: r, bracket: b, strategy: 'A' });
    const bb = C.simulate({ ...BASE, returns: r, bracket: b, strategy: 'B' });
    return { a, b: bb, gap: bb.nw - a.nw };
  };
  const sweep = SWEEP.map((r, k) => {
    const s = sides(r, br);
    add(`r_${k}`, r, 'pct2', { formula: 'sweep value: 2.00% + k × 0.25% (ILLUSTRATIVE range)', illustrative: true }, { k });
    add(`gap_${k}`, s.gap, 'usd0', { formula: 'after-tax net worth at month 48: B − A' }, { ...BASE, returnPct: r, bracket: br });
    return { r, gap: s.gap, nwA: s.a.nw, nwB: s.b.nw };
  });
  add('axis_lo', 2, 'pct0', { formula: 'sweep minimum (ILLUSTRATIVE range)', illustrative: true });
  add('axis_hi', 10, 'pct0', { formula: 'sweep maximum (ILLUSTRATIVE range)', illustrative: true });
  const curve = [];
  for (let r = 2; r <= 10.0001; r += 0.05) { const s = sides(r, br); curve.push({ r: +r.toFixed(2), gap: s.gap }); }
  const curves = Object.fromEntries(BRACKETS.map((b) => [b.id, curve.map((c) => ({ r: c.r, gap: sides(c.r, b).gap }))]));

  // ILLUSTRATIVE bad sequence at the main bracket.
  const seq = C.sequence(BASE.months, SEQ.split, SEQ.first, SEQ.second);
  const da = C.simulate({ ...BASE, returns: seq, bracket: br, strategy: 'A' });
  const db = C.simulate({ ...BASE, returns: seq, bracket: br, strategy: 'B' });
  const gapPath = da.path.map((p, m) => db.path[m].nw - p.nw);
  const cross = gapPath.findIndex((g, m) => m > 0 && g < 0 && gapPath[m - 1] >= 0);
  add('seq_first', SEQ.first, 'pct0', { formula: 'ILLUSTRATIVE sequence: annual return for months 1–36 (not a forecast)', illustrative: true });
  add('seq_second', SEQ.second, 'pct0', { formula: 'ILLUSTRATIVE sequence: annual return for months 37–48 (not a forecast)', illustrative: true });
  add('seq_split', SEQ.split, 'int', { formula: 'ILLUSTRATIVE sequence: last month of the first rate', illustrative: true });
  add('cross_month', cross, 'int', { formula: 'first month m where NW_B − NW_A turns negative under the ILLUSTRATIVE sequence' }, { ...BASE, bracket: br, sequence: SEQ });
  add('gap_end', -gapPath[BASE.months], 'usd0', { formula: 'NW_A − NW_B at month 48 under the ILLUSTRATIVE sequence (after tax)' }, { ...BASE, bracket: br, sequence: SEQ });

  return {
    base: BASE, brackets: BRACKETS, main: MAIN, seqSpec: SEQ, breakEvens: be,
    sweep, curve, curves,
    loan: { a: a0.path.map((p) => p.loan), b: b0.path.map((p) => p.loan), payoffA: a0.payoffMonth, intA: a0.interestPaid, intB: b0.interestPaid, P: a0.P },
    lots: { a: a0.lots.map((l) => ({ m: l.m, basis: l.basis })), b: b0.lots.map((l) => ({ m: l.m, basis: l.basis })) },
    downside: { a: da.path.map((p) => p.nw), b: db.path.map((p) => p.nw), gap: gapPath, cross },
    claims, byId,
  };
}

module.exports = { BASE, BRACKETS, MAIN, SWEEP, SEQ, FMT, build, bracketOf };
