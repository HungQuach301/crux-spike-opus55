'use strict';
// Test C: per-lot tax model, claims, script rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/av/calc');
const { build, BASE, BRACKETS } = require('../src/av/data');
const script = require('../src/av/script');
const { prepareScene, lint } = require('../src/av/prepare');

const D = build();
const claim = (id) => D.byId[id];
const B22 = BRACKETS.find((b) => b.id === 22);

test('loan mechanics are unchanged from test B', () => {
  assert.equal(C.payment(25000, 5.2, 48), 578.0);
  const a = C.simulate({ ...BASE, returns: 0, bracket: B22, strategy: 'A' });
  const b = C.simulate({ ...BASE, returns: 0, bracket: B22, strategy: 'B' });
  assert.equal(a.payoffMonth, 28);
  assert.equal(b.path[48].loan, 0);
  assert.equal(claim('avoided').display, '$1,190');
  assert.equal(claim('months_free').display, '20');
});

test('both roads spend the same cash: A invests exactly the interest it avoids', () => {
  assert.ok(Math.abs(claim('extra_basis_a').value - claim('avoided').value) < 0.05);
  assert.equal(claim('extra_basis_a').display, claim('avoided').display);
});

test('lots: held more than 12 months at the sale is long-term, otherwise ordinary', () => {
  const lots = [{ m: 35, basis: 100, value: 110 }, { m: 36, basis: 100, value: 110 }];
  const r = C.lotTax(lots, 48, { ord: 22, lt: 15 });
  assert.equal(r.ltGain, 10); // month 35 lot: held 13 months
  assert.equal(r.stGain, 10); // month 36 lot: held 12 months, not more than 12
  assert.ok(Math.abs(r.tax - (1.5 + 2.2)) < 1e-9);
});

test('losses are not deductible: a losing lot adds no credit', () => {
  const r = C.lotTax([{ m: 1, basis: 100, value: 150 }, { m: 40, basis: 100, value: 60 }], 48, { ord: 22, lt: 15 });
  assert.ok(Math.abs(r.tax - 7.5) < 1e-9);
  assert.equal(r.lossIgnored, 40);
});

test('lot counts: A has 13 short-term and 8 long-term lots, B 13 and 35', () => {
  assert.deepEqual(['lots_st_a', 'lots_lt_a', 'lots_st_b', 'lots_lt_b'].map((k) => claim(k).value), [13, 8, 13, 35]);
});

test('with no tax the break-even equals the APR as an effective annual rate', () => {
  const eff = (Math.pow(1 + 0.052 / 12, 12) - 1) * 100;
  assert.ok(Math.abs(claim('be_0').value - eff) < 0.01);
});

test('break-evens per bracket: the gap changes sign there, and values match the claims', () => {
  for (const b of BRACKETS) {
    const be = claim(`be_${b.id}`).value;
    assert.ok(C.gap(BASE, be - 0.01, b) < 0 && C.gap(BASE, be + 0.01, b) > 0, `bracket ${b.id}`);
  }
  assert.deepEqual(['be_12', 'be_22', 'be_32'].map((k) => claim(k).display), ['5.23%', '6.11%', '6.26%']);
});

test('the 32% bracket carries the 3.8% NIIT on both rates: 35.8% / 18.8%', () => {
  const b32 = BRACKETS.find((b) => b.id === 32);
  assert.equal(b32.ord, 35.8);
  assert.equal(b32.lt, 18.8);
  assert.equal(claim('ord_32e').display, '35.8%');
  assert.equal(claim('lt_32e').display, '18.8%');
  // without NIIT the 32% bracket would break even lower (6.01%); the video uses the NIIT rates
  assert.ok(Math.abs(C.breakEven(BASE, { ord: 32, lt: 15 }) - 6.008) < 0.01);
});

test('with NIIT the break-even rises with the bracket', () => {
  assert.ok(claim('be_12').value < claim('be_22').value && claim('be_22').value < claim('be_32').value);
});

test('at the 12% bracket the break-even sits below the no-tax break-even (A holds more short-term lots)', () => {
  assert.ok(claim('be_12').value < claim('be_0').value);
  const r = claim('be_12').value, b12 = BRACKETS.find((b) => b.id === 12);
  const a = C.simulate({ ...BASE, returns: r, bracket: b12, strategy: 'A' }), b = C.simulate({ ...BASE, returns: r, bracket: b12, strategy: 'B' });
  assert.ok(a.tax.stGain / (a.tax.stGain + a.tax.ltGain) > b.tax.stGain / (b.tax.stGain + b.tax.ltGain));
});

test('ILLUSTRATIVE sequence: B leads, then A finishes ahead', () => {
  assert.ok(D.downside.gap[36] > 0 && D.downside.gap[48] < 0);
  assert.equal(claim('cross_month').display, '39');
  assert.equal(claim('gap_end').display, '$459');
});

test('illustrative inputs are flagged', () => {
  for (const id of ['extra', 'axis_lo', 'axis_hi', 'seq_first', 'seq_second']) assert.ok(claim(id).illustrative || /ILLUSTRATIVE/.test(claim(id).note || claim(id).formula), id);
});

test('script obeys its rules: numbers only via claims, spoken numbers parse back to the claims, no advice, no "expected return"', () => {
  const problems = [];
  for (const s of script) if (s.text) problems.push(...lint(s, prepareScene(s, D.byId)));
  assert.deepEqual(problems, []);
});

test('every scene lists its panels, shot and a known section', () => {
  for (const s of script) {
    assert.ok(Array.isArray(s.panels), s.id);
    assert.ok(['wide', 'medium', 'close', 'detail'].includes(s.shot), s.id);
    assert.ok(['setup', 'sweep', 'tension', 'resolution'].includes(s.section), s.id);
    if (s.cam) {
      const want = s.cam.s < 0.6 ? 'wide' : s.cam.s < 1.3 ? 'medium' : s.cam.s < 2.4 ? 'close' : 'detail';
      assert.equal(s.shot, want, `${s.id} camera scale ${s.cam.s}`);
    }
  }
});
