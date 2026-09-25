'use strict';
// Pure calculation layer. Every number that reaches the screen is produced here
// (or in src/data.js from these functions) — never typed into a scene by hand.

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/** Level monthly payment for a fully amortizing fixed-rate loan, rounded to cents. */
function monthlyPayment(principal, annualRatePct, termMonths) {
  if (!(principal >= 0) || !(termMonths > 0)) throw new RangeError('bad loan inputs');
  const i = annualRatePct / 100 / 12;
  if (i === 0) return round2(principal / termMonths);
  return round2((principal * i) / (1 - Math.pow(1 + i, -termMonths)));
}

/** Upfront cost of points: 1 point = 1% of the loan amount. */
function pointsCost(principal, points) {
  return round2(principal * points / 100);
}

/** Note rate after buying `points` at `cutPerPointPct` percentage points each. */
function rateAfterPoints(baseRatePct, points, cutPerPointPct) {
  return Math.round((baseRatePct - points * cutPerPointPct) * 1e6) / 1e6;
}

/**
 * Version A — payment-savings break-even.
 * Smallest whole month m with m * saving >= cost. null if saving <= 0 and cost > 0.
 */
function simpleBreakEvenMonths(cost, monthlySaving) {
  if (cost <= 0) return 0;
  if (!(monthlySaving > 0)) return null;
  // work in cents to avoid float drift at exact multiples
  const c = Math.round(cost * 100), s = Math.round(monthlySaving * 100);
  return Math.ceil(c / s);
}

/**
 * Version B — opportunity-cost break-even.
 * The upfront cash could instead earn `annualReturnPct` (compounded monthly, j = k/12).
 * Smallest whole month m where the future value of the savings stream, invested at j,
 * is >= the future value of the upfront cost: sum_{t=1..m} s(1+j)^(m-t) >= C(1+j)^m.
 * Equivalent: PV of m savings at j >= C. Returns null if never within maxMonths.
 */
function opportunityBreakEvenMonths(cost, monthlySaving, annualReturnPct, maxMonths = 360) {
  if (cost <= 0) return 0;
  if (!(monthlySaving > 0)) return null;
  const j = annualReturnPct / 100 / 12;
  if (j === 0) return simpleBreakEvenMonths(cost, monthlySaving);
  let pv = 0;
  for (let m = 1; m <= maxMonths; m++) {
    pv += monthlySaving / Math.pow(1 + j, m);
    if (pv >= cost - 1e-9) return m;
  }
  return null;
}

/** Net position (in today's dollars at the sale month) for each month 0..months. */
function netPathSimple(cost, monthlySaving, months) {
  const out = [];
  for (let m = 0; m <= months; m++) out.push(round2(m * monthlySaving - cost));
  return out;
}
function netPathOpportunity(cost, monthlySaving, annualReturnPct, months) {
  // Future-value comparison at month m: savings invested at j vs cost invested at j.
  const j = annualReturnPct / 100 / 12;
  const out = [];
  let fvSavings = 0;
  for (let m = 0; m <= months; m++) {
    if (m > 0) fvSavings = fvSavings * (1 + j) + monthlySaving;
    out.push(round2(fvSavings - cost * Math.pow(1 + j, m)));
  }
  return out;
}

/** Does the owner reach break-even within a holding period of `years`? */
function breaksEvenWithin(months, years) {
  return months !== null && months <= years * 12;
}

/** One scenario, fully evaluated. */
function scenario({ principal, baseRatePct, termMonths, points, cutPerPointPct, annualReturnPct }) {
  const cost = pointsCost(principal, points);
  const newRate = rateAfterPoints(baseRatePct, points, cutPerPointPct);
  const basePay = monthlyPayment(principal, baseRatePct, termMonths);
  const newPay = monthlyPayment(principal, newRate, termMonths);
  const saving = round2(basePay - newPay);
  return {
    points, cutPerPointPct, cost, newRate, basePay, newPay, saving,
    simpleMonths: simpleBreakEvenMonths(cost, saving),
    oppMonths: opportunityBreakEvenMonths(cost, saving, annualReturnPct, termMonths),
  };
}

/** Holding periods (years) where version A says "break-even reached" but version B says "not yet". */
function flipYears(s, years) {
  return years.filter((y) => breaksEvenWithin(s.simpleMonths, y) && !breaksEvenWithin(s.oppMonths, y));
}

module.exports = {
  round2, monthlyPayment, pointsCost, rateAfterPoints, simpleBreakEvenMonths,
  opportunityBreakEvenMonths, netPathSimple, netPathOpportunity, breaksEvenWithin,
  scenario, flipYears,
};
