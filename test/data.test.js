'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAll, SOURCE } = require('../src/data');

const all = buildAll();

test('every claim has an id, a display string and a formula or source', () => {
  for (const ds of Object.values(all)) {
    const ids = new Set();
    for (const c of ds.claims) {
      assert.ok(!ids.has(c.claimId), `duplicate ${c.claimId}`);
      ids.add(c.claimId);
      assert.ok(typeof c.display === 'string' && c.display.length > 0, c.claimId);
      assert.ok(c.formula || c.source, `${c.claimId} lacks formula/source`);
      assert.ok(c.inputs && typeof c.inputs === 'object', c.claimId);
    }
  }
});

test('normal dataset cites the published rate; extreme is labeled illustrative', () => {
  const n = all.normal.claims.find((c) => c.claimId === 'base_rate');
  assert.equal(n.value, SOURCE.ratePct);
  assert.match(n.source, /^https:\/\//);
  assert.equal(all.extreme.rateLabel, 'illustrative');
  assert.match(all.extreme.claims.find((c) => c.claimId === 'base_rate').note, /ILLUSTRATIVE/);
});

test('the flip exists in the base case', () => {
  const n = all.normal;
  assert.ok(Number(n.claims.find((c) => c.claimId === 'flip_count').value) > 0);
  assert.ok(n.chart.flipFrom !== null && n.chart.flipTo >= n.chart.flipFrom);
});

test('missing dataset leaves exactly the configured cells empty', () => {
  const empty = all.missing.cells.flat().filter((c) => c === null).length;
  assert.equal(empty, 6);
});

test('cell references resolve to claims', () => {
  for (const ds of Object.values(all)) {
    const ids = new Set(ds.claims.map((c) => c.claimId));
    for (const row of ds.cells) for (const c of row) if (c) { assert.ok(ids.has(c.a)); assert.ok(ids.has(c.b)); }
  }
});
