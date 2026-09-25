'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/calc');

test('monthlyPayment matches standard amortization values', () => {
  assert.equal(C.monthlyPayment(400000, 7, 360), 2661.21);
  assert.equal(C.monthlyPayment(200000, 6, 360), 1199.10);
  assert.equal(C.monthlyPayment(360000, 0, 360), 1000);
});

test('pointsCost: 1 point = 1% of loan', () => {
  assert.equal(C.pointsCost(400000, 1), 4000);
  assert.equal(C.pointsCost(400000, 2.5), 10000);
  assert.equal(C.pointsCost(400000, 0), 0);
});

test('rateAfterPoints avoids float drift', () => {
  assert.equal(C.rateAfterPoints(7.03, 1, 0.25), 6.78);
  assert.equal(C.rateAfterPoints(7.03, 3, 0.375), 5.905);
});

test('simpleBreakEvenMonths: first month where cumulative savings >= cost', () => {
  assert.equal(C.simpleBreakEvenMonths(4000, 40), 100); // exact multiple
  assert.equal(C.simpleBreakEvenMonths(4000, 66.9), 60); // 59*66.9 < 4000 <= 60*66.9
  assert.ok(59 * 66.9 < 4000 && 60 * 66.9 >= 4000);
  assert.equal(C.simpleBreakEvenMonths(0, 0), 0);
  assert.equal(C.simpleBreakEvenMonths(4000, 0), null);
});

test('opportunity version equals simple at 0% return and is never shorter', () => {
  for (const s of [10, 33.53, 66.9, 200]) {
    assert.equal(C.opportunityBreakEvenMonths(4000, s, 0), C.simpleBreakEvenMonths(4000, s));
    for (const k of [1, 3, 5, 7]) {
      const b = C.opportunityBreakEvenMonths(4000, s, k);
      if (b !== null) assert.ok(b >= C.simpleBreakEvenMonths(4000, s));
    }
  }
});

test('opportunity version is never when monthly return on cost exceeds saving', () => {
  // cost * j >= saving  => PV of perpetuity <= cost
  assert.equal(C.opportunityBreakEvenMonths(4000, 16, 6, 10000), null); // 4000*0.005 = 20 > 16
});

test('opportunity break-even is monotonic in the return rate', () => {
  let prev = 0;
  for (const k of [0, 1, 2, 3, 4, 5, 6]) {
    const m = C.opportunityBreakEvenMonths(4000, 33.53, k);
    assert.ok(m !== null && m >= prev);
    prev = m;
  }
});

test('net paths cross zero exactly at the two break-even months (PV and FV agree)', () => {
  const cost = 4000, s = 33.53, k = 5;
  const a = C.netPathSimple(cost, s, 240), b = C.netPathOpportunity(cost, s, k, 240);
  const ma = C.simpleBreakEvenMonths(cost, s), mb = C.opportunityBreakEvenMonths(cost, s, k);
  assert.ok(a[ma] >= 0 && a[ma - 1] < 0);
  assert.ok(b[mb] >= 0 && b[mb - 1] < 0);
});

test('base case: 1 point at 0.25% on $400,000 at 7.03%', () => {
  const s = C.scenario({ principal: 400000, baseRatePct: 7.03, termMonths: 360, points: 1, cutPerPointPct: 0.25, annualReturnPct: 5 });
  assert.equal(s.cost, 4000);
  assert.equal(s.basePay, 2669.27);
  assert.equal(s.newPay, 2602.37);
  assert.equal(s.saving, 66.9);
  assert.equal(s.simpleMonths, 60);
  assert.equal(s.oppMonths, 69);
});

test('flipYears: holding periods where the two versions disagree', () => {
  const s = { simpleMonths: 120, oppMonths: 166 };
  assert.deepEqual(C.flipYears(s, [9, 10, 11, 12, 13, 14, 15]), [10, 11, 12, 13]);
  assert.deepEqual(C.flipYears({ simpleMonths: 40, oppMonths: 44 }, [1, 2, 3, 4, 5]), []);
  assert.deepEqual(C.flipYears({ simpleMonths: 100, oppMonths: null }, [8, 9, 10]), [9, 10]);
});
