'use strict';
// Channel-identity and narration checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const narration = require('../src/narration');
const { buildAll } = require('../src/data');

const ROOT = path.join(__dirname, '..');
const scenesSrc = fs.readFileSync(path.join(ROOT, 'render/scenes.js'), 'utf8');
const durations = Object.fromEntries([...scenesSrc.matchAll(/\{ id: '(\w+)', dur: (\d+)/g)].map((m) => [m[1], Number(m[2])]));
const words = (s) => s.split(/[\s\-–—]+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
const claims = Object.fromEntries(buildAll().normal.claims.map((c) => [c.claimId, c]));

// on-screen copy = string/template literals in scenes.js
const literals = [...scenesSrc.matchAll(/'([^'\n]*)'|`([^`]*)`/g)].map((m) => m[1] ?? m[2]).join('\n');
const allCopy = [literals, ...narration.map((n) => n.text)].join('\n');

test('no first-person singular, no advice phrasing, no hype words', () => {
  assert.doesNotMatch(allCopy, /\bI\b|\bI'm\b|\bmy\b/);
  assert.doesNotMatch(allCopy, /you should|we recommend|best choice|should you|you need to|must buy|don't buy/i);
  assert.doesNotMatch(allCopy, /\b(amazing|incredible|huge|massive|shocking|insane|crucial|game[- ]chang\w*|stunning|secret|hack|smart move|no-brainer)\b/i);
});

test('US-only stated on screen and in narration', () => {
  assert.match(literals, /US only/);
  assert.match(narration[0].text, /US/);
});

test('narration covers every scene at 150–160 wpm overall', () => {
  assert.deepEqual(narration.map((n) => n.scene), Object.keys(durations));
  const w = narration.reduce((a, n) => a + words(n.text), 0);
  const secs = Object.values(durations).reduce((a, b) => a + b, 0);
  const wpm = (w / secs) * 60;
  assert.ok(wpm >= 150 && wpm <= 160, `wpm ${wpm}`);
  for (const n of narration) {
    const s = (words(n.text) / durations[n.scene]) * 60;
    assert.ok(s >= 140 && s <= 170, `${n.scene} at ${s.toFixed(0)} wpm`);
  }
});

test('every spoken number is in the narration and matches its claim', () => {
  for (const n of narration) for (const [phrase, id, value] of n.numbers) {
    assert.ok(n.text.includes(phrase), `"${phrase}" missing from ${n.scene}`);
    assert.ok(claims[id], `unknown claim ${id}`);
    assert.deepEqual(claims[id].value, value, `${id}`);
  }
});

test('the segment is 60–90 seconds', () => {
  const secs = Object.values(durations).reduce((a, b) => a + b, 0);
  assert.ok(secs >= 60 && secs <= 90);
});
