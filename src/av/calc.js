'use strict';
// Car loan: pay off early (A) vs invest the extra cash (B), with per-lot capital-gains tax.
// Pure functions. Every number the video draws or says is produced here or in src/av/data.js.

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Level monthly payment, rounded to cents. */
function payment(balance, aprPct, months) {
  const i = aprPct / 100 / 12;
  if (i === 0) return round2(balance / months);
  return round2((balance * i) / (1 - Math.pow(1 + i, -months)));
}

/** Monthly growth factor from an average annual return (compounded). */
const monthlyRate = (annualPct) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

/**
 * Tax on liquidating a set of lots at month `at`.
 * lots: [{ m, basis, value }] (m = contribution month). A lot held more than 12 months
 * (at - m > 12) is long-term; otherwise short-term (ordinary rate). Each lot is taxed on its own
 * gain; a lot's loss gives no deduction against other lots or income.
 */
function lotTax(lots, at, bracket) {
  let tax = 0, ltGain = 0, stGain = 0, lossIgnored = 0;
  for (const l of lots) {
    const g = l.value - l.basis;
    const long = at - l.m > 12;
    if (g <= 0) { lossIgnored += -g; continue; }
    if (long) { ltGain += g; tax += g * bracket.lt / 100; } else { stGain += g; tax += g * bracket.ord / 100; }
  }
  return { tax, ltGain, stGain, lossIgnored };
}

/**
 * Simulate one road month by month.
 * 'A': pay (P + extra) toward the loan until it is gone; whatever the loan does not need that
 *      month is invested; after payoff invest the full P + extra.
 * 'B': pay the minimum P; invest `extra` every month.
 * returns: annual % (number) or an array of annual % per month index.
 * Contributions are made at month end, after that month's growth.
 * bracket: { ord, lt } in %. Loan interest is not deductible.
 */
function simulate({ balance, aprPct, months, extra, returns, bracket, strategy }) {
  const P = payment(balance, aprPct, months);
  const i = aprPct / 100 / 12;
  const rOf = (m) => (Array.isArray(returns) ? returns[m] : returns);
  let loan = balance, interestPaid = 0, payoffMonth = null;
  const lots = [];
  const path = [{ m: 0, loan, inv: 0, basis: 0, tax: 0, nw: -loan }];
  for (let m = 1; m <= months; m++) {
    const budget = P + extra;
    let toLoan = 0;
    if (loan > 0) {
      const interest = round2(loan * i);
      interestPaid = round2(interestPaid + interest);
      const due = round2(loan + interest);
      toLoan = strategy === 'A' ? Math.min(budget, due) : Math.min(P, due);
      loan = round2(due - toLoan);
      if (loan <= 0.005) { loan = 0; if (payoffMonth === null) payoffMonth = m; }
    }
    const g = 1 + monthlyRate(rOf(m - 1));
    for (const l of lots) l.value *= g;
    const c = round2(budget - toLoan);
    if (c > 0) lots.push({ m, basis: c, value: c });
    const inv = lots.reduce((a, l) => a + l.value, 0);
    const basis = round2(lots.reduce((a, l) => a + l.basis, 0));
    const tx = lotTax(lots, m, bracket);
    path.push({ m, loan, inv, basis, tax: tx.tax, nw: inv - tx.tax - loan });
  }
  const end = path[path.length - 1];
  const tx = lotTax(lots, months, bracket);
  return { P, payoffMonth, interestPaid, path, lots: lots.map((l) => ({ ...l })), nw: end.nw, inv: end.inv, basis: end.basis, tax: tx };
}

/** Net-worth gap at the horizon: B minus A (positive = investing ahead). */
function gap(base, returnPct, bracket) {
  const a = simulate({ ...base, returns: returnPct, bracket, strategy: 'A' });
  const b = simulate({ ...base, returns: returnPct, bracket, strategy: 'B' });
  return b.nw - a.nw;
}

/** Average annual return (compounded) at which both roads end with equal after-tax net worth. */
function breakEven(base, bracket, lo = 0, hi = 30) {
  if (gap(base, lo, bracket) > 0 || gap(base, hi, bracket) < 0) return null;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (gap(base, mid, bracket) > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Monthly return sequence: `a` %/yr for the first `split` months, then `b` %/yr. */
function sequence(months, split, a, b) {
  return Array.from({ length: months }, (_, m) => (m < split ? a : b));
}

module.exports = { round2, payment, monthlyRate, lotTax, simulate, gap, breakEven, sequence };
