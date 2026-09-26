'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/car/calc');
const { build, BASE } = require('../src/car/data');
const T = require('../src/car/timeline');
const narration = require('../src/car/narration');

const D = build();
const TL = T.build(D);
const claim = (id) => D.claims.find((c) => c.claimId === id);

test('payment matches the standard amortization formula', () => {
  assert.equal(C.payment(25000, 5.2, 48), 578.0);
  assert.equal(C.payment(12000, 0, 48), 250);
});

test('minimum payments retire the loan exactly at month 48; extra retires it early', () => {
  const b = C.simulate({ ...BASE, returns: 0, taxPct: 0, strategy: 'B' });
  const a = C.simulate({ ...BASE, returns: 0, taxPct: 0, strategy: 'A' });
  assert.equal(b.path[48].loan, 0);
  assert.ok(b.path[47].loan > 0);
  assert.equal(a.payoffMonth, 28);
});

test('both roads spend the same cash; A contributes exactly the interest it avoids', () => {
  const a = C.simulate({ ...BASE, returns: 7, taxPct: 22, strategy: 'A' });
  const b = C.simulate({ ...BASE, returns: 7, taxPct: 22, strategy: 'B' });
  assert.ok(Math.abs((a.basis - b.basis) - (b.interestPaid - a.interestPaid)) < 0.05);
});

test('with no tax the break-even equals the loan APR as an effective annual rate', () => {
  const eff = (Math.pow(1 + 0.052 / 12, 12) - 1) * 100;
  assert.ok(Math.abs(C.breakEven(BASE, 0) - eff) < 0.01, `${C.breakEven(BASE, 0)} vs ${eff}`);
});

test('break-even rises with the tax rate and is where the gap changes sign', () => {
  const [a, b, c] = [12, 22, 32].map((t) => C.breakEven(BASE, t));
  assert.ok(a < b && b < c);
  assert.ok(C.gap(BASE, b - 0.01, 22) < 0 && C.gap(BASE, b + 0.01, 22) > 0);
  assert.equal(claim('be_12').display, '6.00%');
  assert.equal(claim('be_22').display, '6.70%');
  assert.equal(claim('be_32').display, '7.59%');
});

test('bar B equals bar A (interest avoided) at the break-even return', () => {
  assert.ok(Math.abs(D.atBe.barB - D.atBe.barA) < 0.01);
  assert.ok(Math.abs(D.atBe.barA - claim('avoided').value) < 0.05);
});

test('stated bad sequence: B leads, then A finishes ahead', () => {
  assert.ok(D.downside.gap[36] > 0);
  assert.ok(D.downside.gap[48] < 0);
  assert.equal(D.downside.cross, 38);
  assert.equal(claim('gap_end').display, '$459');
});

test('front rate helper reproduces a target average', () => {
  const f = C.frontRateForAverage(48, 36, 8, -20);
  const g = Math.pow(1 + f / 100, 3) * 0.8;
  assert.ok(Math.abs(g - Math.pow(1.08, 4)) < 1e-9);
});

test('genre limits hold on the timeline', () => {
  const d = TL.scenes.map((s) => s.dur);
  const mean = d.reduce((a, b) => a + b) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
  assert.ok(Math.min(...d) >= 1.2 && Math.max(...d) <= 12);
  assert.ok(sd / mean >= 0.4, `ratio ${sd / mean}`);
  assert.ok(TL.total >= 100 && TL.total <= 130);
  let run = 0, maxRun = 0; for (const x of d) { run = x < 2 ? run + 1 : 0; maxRun = Math.max(maxRun, run); }
  assert.ok(maxRun <= 3);
  const types = new Set(TL.events.map((e) => e.type));
  assert.deepEqual([...types].sort(), ['appear', 'compare', 'count', 'dismiss', 'emphasis', 'reveal', 'threshold-cross', 'transition']);
  assert.ok(TL.silences.length <= 3);
  for (const s of TL.silences) assert.ok(s.end - s.start >= 0.3 && s.end - s.start <= 0.5);
  for (const w of TL.still) assert.ok(w.end - w.start >= 0.5 && w.end - w.start <= 1.0);
  // every scene is a whole number of beats: music phrases land on cuts
  for (const s of TL.scenes) assert.ok(Math.abs(s.dur / TL.beat - Math.round(s.dur / TL.beat)) < 1e-9);
});

const words = (s) => s.split(/[\s\-–—]+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
test('narration: one entry per scene, 150-160 wpm overall, spoken numbers match claims', () => {
  assert.deepEqual(narration.map((n) => n.scene), TL.scenes.map((s) => s.id));
  const w = narration.reduce((a, n) => a + words(n.text), 0);
  const wpm = (w / TL.total) * 60;
  assert.ok(wpm >= 150 && wpm <= 160, `wpm ${wpm}`);
  for (const n of narration) {
    const s = TL.scenes.find((x) => x.id === n.scene);
    const r = (words(n.text) / s.dur) * 60;
    assert.ok(r >= 140 && r <= 170, `${n.scene} ${r.toFixed(0)} wpm`);
    for (const [phrase, id, disp] of n.numbers) {
      assert.ok(n.text.includes(phrase), `${phrase} not in ${n.scene}`);
      assert.equal(claim(id).display, disp, id);
    }
  }
});

test('channel voice: analysis "we" only, no advice, no predictions, no hype', () => {
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '../render-motion/scenes.js'), 'utf8');
  const onScreen = [...src.matchAll(/html: (['`])(.*?)\1/g)].map((m) => m[2].replace(/\$\{[^}]*\}/g, ' ').replace(/<[^>]+>/g, ' '));
  const copy = narration.map((n) => n.text).concat(onScreen).join('\n');
  assert.ok(onScreen.length > 20);
  assert.doesNotMatch(copy, /\bI\b/);
  assert.doesNotMatch(copy, /\bour (loan|money|car|cash)\b|we pay|we invest|we should/i);
  assert.doesNotMatch(copy, /you should|we recommend|best choice|should you|you need to|smart|wise/i);
  assert.doesNotMatch(copy, /\b(will (rise|fall|crash|return)|markets? will|expect(ed)? to (rise|fall))\b/i);
  assert.doesNotMatch(copy, /\b(amazing|incredible|huge|massive|shocking|insane|crucial|stunning|secret|hack|no-brainer)\b/i);
  assert.match(copy, /US only|US-only/);
});
