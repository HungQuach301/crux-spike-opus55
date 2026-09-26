'use strict';
// Car loan: pay off early (A) vs invest the extra cash (B). Pure functions; every on-screen
// number in the motion segment is produced here or in src/car/data.js.

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Level monthly payment, rounded to cents. */
function payment(balance, aprPct, months) {
  const i = aprPct / 100 / 12;
  if (i === 0) return round2(balance / months);
  return round2((balance * i) / (1 - Math.pow(1 + i, -months)));
}

/** Monthly growth factor from an effective annual return. */
const monthlyRate = (annualPct) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;

/**
 * Simulate one strategy month by month.
 * strategy 'A': every month pay (P + extra) toward the loan until it is gone; whatever is not
 *   needed for the loan that month is invested; after payoff invest the full P + extra.
 * strategy 'B': pay the minimum P; invest `extra` every month.
 * returns: array (length months) of annual returns in % per month index, or a single number.
 * Contributions are made at month end, after that month's growth.
 * Tax: gains are taxed once, at the stated rate, if the account were liquidated (no tax on
 * losses, no credit for them). Loan interest is not deductible.
 */
function simulate({ balance, aprPct, months, extra, returns, taxPct, strategy }) {
  const P = payment(balance, aprPct, months);
  const i = aprPct / 100 / 12;
  const rOf = (m) => (Array.isArray(returns) ? returns[m] : returns);
  let loan = balance, inv = 0, basis = 0, interestPaid = 0, payoffMonth = null;
  const path = [{ m: 0, loan, inv, basis, nw: -loan }];
  for (let m = 1; m <= months; m++) {
    const budget = P + extra;
    // loan
    let toLoan = 0;
    if (loan > 0) {
      const interest = round2(loan * i);
      interestPaid = round2(interestPaid + interest);
      const due = round2(loan + interest);
      toLoan = strategy === 'A' ? Math.min(budget, due) : Math.min(P, due);
      loan = round2(due - toLoan);
      if (loan <= 0.005) { loan = 0; if (payoffMonth === null) payoffMonth = m; }
    }
    const contribution = round2(budget - toLoan);
    inv = inv * (1 + monthlyRate(rOf(m - 1))) + contribution;
    basis = round2(basis + contribution);
    const tax = Math.max(0, inv - basis) * taxPct / 100;
    path.push({ m, loan, inv, basis, nw: inv - tax - loan });
  }
  const end = path[path.length - 1];
  return { P, payoffMonth, interestPaid, path, nw: end.nw, inv: end.inv, basis: end.basis };
}

/** Net-worth gap at the horizon: B minus A (positive = investing ahead). */
function gap(base, returnPct, taxPct) {
  const a = simulate({ ...base, returns: returnPct, taxPct, strategy: 'A' });
  const b = simulate({ ...base, returns: returnPct, taxPct, strategy: 'B' });
  return b.nw - a.nw;
}

/** Pre-tax annual return at which both strategies end with equal after-tax net worth. */
function breakEven(base, taxPct, lo = 0, hi = 30) {
  let g0 = gap(base, lo, taxPct), g1 = gap(base, hi, taxPct);
  if (g0 > 0 || g1 < 0) return null;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (gap(base, mid, taxPct) > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Monthly return sequence: `a` %/yr for the first `split` months, then `b` %/yr. */
function sequence(months, split, a, b) {
  return Array.from({ length: months }, (_, m) => (m < split ? a : b));
}

/** Annual rate a such that (1+a)^(split/12) * (1+b)^((months-split)/12) = (1+avg)^(months/12). */
function frontRateForAverage(months, split, avg, b) {
  const total = Math.pow(1 + avg / 100, months / 12);
  const back = Math.pow(1 + b / 100, (months - split) / 12);
  return (Math.pow(total / back, 12 / split) - 1) * 100;
}

module.exports = { round2, payment, monthlyRate, simulate, gap, breakEven, sequence, frontRateForAverage };
