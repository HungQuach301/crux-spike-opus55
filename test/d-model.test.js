'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/d/model');

const data = M.loadAnnual();
const base = M.window30(data, 1966);

test('data covers every 30-year window 1928-1996', () => {
  for (let y = 1928; y <= 2025; y++) assert.ok(data[y], `year ${y}`);
  assert.strictEqual(M.window30(data, 1996).length, 30);
});

test('year-1 withdrawal is 4% of the initial balance, then grows with the previous year\'s inflation', () => {
  const s = M.simulate(base);
  assert.strictEqual(s.withdrawals[0], 40000);
  assert.ok(Math.abs(s.withdrawals[1] - 40000 * (1 + data[1966].inflation)) < 1e-9);
  assert.ok(Math.abs(s.withdrawals[2] - 40000 * (1 + data[1966].inflation) * (1 + data[1967].inflation)) < 1e-9);
});

test('balance recursion: withdraw at the start of the year, then the 60/40 return', () => {
  const s = M.simulate(base);
  const r1 = 0.6 * data[1966].stocks + 0.4 * data[1966].bonds;
  assert.ok(Math.abs(s.endNominal[0] - (1e6 - 40000) * (1 + r1)) < 1e-6);
  assert.ok(Math.abs(s.endReal[0] - s.endNominal[0] / (1 + data[1966].inflation)) < 1e-6);
});

test('mirror has the same geometric mean to 0.01 pp and the same withdrawals', () => {
  const mir = M.mirrorSeq(base);
  assert.ok(Math.abs(M.geoMean(base) - M.geoMean(mir)) * 100 < 0.01);
  assert.ok(Math.abs(M.arithMean(base) - M.arithMean(mir)) < 1e-12);
  const a = M.simulate(base), b = M.simulate(mir);
  // withdrawals are identical while both can pay them
  for (let k = 0; k < 20; k++) assert.ok(Math.abs(a.withdrawals[k] - b.withdrawals[k]) < 1e-6);
  assert.strictEqual(mir[0].stocks, data[1995].stocks);
  assert.strictEqual(mir[0].inflation, data[1966].inflation);
});

test('the 1966 retiree is depleted, the mirror is not', () => {
  const m = M.build(data);
  assert.strictEqual(m.paths['1966'].depletedYear, 26);
  assert.strictEqual(m.paths.mirror.depletedYear, null);
  assert.strictEqual(Object.keys(m.starts).length, 69);
});

test('depletion stops the balance at zero and caps the withdrawal', () => {
  const crash = Array.from({ length: 30 }, () => ({ stocks: -0.5, bonds: -0.5, inflation: 0 }));
  const s = M.simulate(crash);
  const k = s.depletedYear - 1;
  assert.ok(s.withdrawals[k] < 40000);
  assert.ok(s.endNominal.slice(k).every((v) => v === 0));
});

test('1973-1974: bonds rose in nominal terms but stocks and bonds both lost money after inflation', () => {
  for (const y of [1973, 1974]) {
    const r = data[y];
    assert.ok(r.bonds > 0, `bonds nominal ${y}`);
    assert.ok((1 + r.stocks) / (1 + r.inflation) - 1 < 0, `stocks real ${y}`);
    assert.ok((1 + r.bonds) / (1 + r.inflation) - 1 < 0, `bonds real ${y}`);
  }
});

test('script: every number is registered, and "US only" / "history, not a forecast" are said in act 1', () => {
  const { build } = require('../src/d/claims');
  const { ACTS } = require('../src/d/script');
  const r = build();
  assert.deepStrictEqual(r.errors, []);
  const act1 = ACTS.find((a) => a.id === 'act1').scenes.flatMap((s) => s.lines.map((l) => l.t)).join(' ');
  assert.match(act1, /\bUS only\b/);
  assert.match(act1, /history, not a forecast/);
  const real = r.claims.filter((c) => /^real[SB]197[34]$/.test(c.claimId));
  assert.strictEqual(real.length, 4);
  assert.ok(real.every((c) => c.value < 0));
});

test('act 2: in 7 years with gains above 10% in which money remained, the 1966 balance still fell (1979, 1980, 1983, 1985, 1986, 1988, 1989; not 1991, the year it ran out)', () => {
  const { build } = require('../src/d/claims');
  const r = build();
  const c = r.claims.find((x) => x.claimId === 'gainsFell');
  assert.strictEqual(c.value, 7);
  assert.deepStrictEqual(c.years, [1979, 1980, 1983, 1985, 1986, 1988, 1989]);
  assert.ok(!c.years.includes(1991)); // 1991: the withdrawal ($168,302 nominal) exceeded the balance ($96,829 paid): no money remained
  assert.ok(c.spoken.some((s) => s.sentence === 'a2-gains80.1'));
  const t = r.claims.find((x) => x.claimId === 'gt10');
  assert.strictEqual(t.display, '10%');
});
