'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../src/av/normalize');

const canons = (s) => N.parseNumbers(s).map((x) => x.canon);

test('integers and years read as American English', () => {
  assert.equal(N.intToWords(0), 'zero');
  assert.equal(N.intToWords(48), 'forty-eight');
  assert.equal(N.intToWords(578), 'five hundred seventy-eight');
  assert.equal(N.intToWords(1190), 'one thousand one hundred ninety');
  assert.equal(N.intToWords(25000), 'twenty-five thousand');
  assert.equal(N.intToWords(1000000), 'one million');
  assert.equal(N.yearToWords(2025), 'twenty twenty-five');
  assert.equal(N.yearToWords(2008), 'two thousand eight');
  assert.equal(N.yearToWords(1999), 'nineteen ninety-nine');
  assert.equal(N.yearToWords(1905), 'nineteen oh five');
  assert.equal(N.yearToWords(2100 - 100), 'two thousand');
});

test('percent: numerals, words and ranges', () => {
  assert.equal(N.toSpoken('5.2%'), 'five point two percent');
  assert.equal(N.toSpoken('22%'), 'twenty-two percent');
  assert.equal(N.toSpoken('2%–10%'), 'two to ten percent');
  assert.deepEqual(canons('5.2%'), ['pct:5.2']);
  assert.deepEqual(canons('five point two percent'), ['pct:5.2']);
  assert.deepEqual(canons('5.2 percent'), ['pct:5.2']);
  assert.deepEqual(canons('two to ten percent'), ['pct:2', 'pct:10']);
  assert.deepEqual(canons('2%–10%'), ['pct:2', 'pct:10']);
  assert.deepEqual(canons('12%, 22% or 32%'), ['pct:12', 'pct:22', 'pct:32']);
});

test('dollars: commas, cents, words, "twelve hundred" style', () => {
  assert.equal(N.toSpoken('$1,240'), 'one thousand two hundred forty dollars');
  assert.equal(N.toSpoken('$578.00'), 'five hundred seventy-eight dollars');
  assert.equal(N.toSpoken('$12.50'), 'twelve dollars and fifty cents');
  assert.equal(N.toSpoken('$1'), 'one dollar');
  assert.deepEqual(canons('$1,240'), ['usd:1240']);
  assert.deepEqual(canons('twelve hundred forty dollars'), ['usd:1240']);
  assert.deepEqual(canons('one thousand two hundred forty dollars'), ['usd:1240']);
  assert.deepEqual(canons('1,240 dollars'), ['usd:1240']);
  assert.deepEqual(canons('twenty-five thousand dollars'), ['usd:25000']);
  assert.deepEqual(canons('$578.00.'), ['usd:578']);
});

test('decimals', () => {
  assert.equal(N.decimalToWords('6.12'), 'six point one two');
  assert.equal(N.decimalToWords('0.5'), 'zero point five');
  assert.deepEqual(canons('six point one two'), ['num:6.12']);
  assert.deepEqual(canons('six point seven oh percent'), ['pct:6.7']);
  assert.deepEqual(canons('6.70%'), ['pct:6.7']);
});

test('negative numbers: minus sign, hyphen, words', () => {
  assert.equal(N.toSpoken('−20%'), 'minus twenty percent');
  assert.equal(N.toSpoken('-20%'), 'minus twenty percent');
  assert.equal(N.toSpoken('−$459'), 'minus four hundred fifty-nine dollars');
  assert.equal(N.toSpoken('a change of −3'), 'a change of minus three');
  assert.deepEqual(canons('−20%'), ['pct:-20']);
  assert.deepEqual(canons('minus twenty percent'), ['pct:-20']);
  assert.deepEqual(canons('negative 20%'), ['pct:-20']);
  assert.deepEqual(canons('−$459'), ['usd:-459']);
});

test('"month N" is its own kind; "N months" is a plain number', () => {
  assert.equal(N.toSpoken('month 28'), 'month twenty-eight');
  assert.deepEqual(canons('in month 28.'), ['month:28']);
  assert.deepEqual(canons('in month twenty-eight'), ['month:28']);
  assert.deepEqual(canons('Month 48'), ['month:48']);
  assert.deepEqual(canons('48 monthly payments'), ['num:48']);
  assert.deepEqual(canons('20 months'), ['num:20']);
});

test('years and year ranges', () => {
  assert.equal(N.toSpoken('2025–2028'), 'twenty twenty-five to twenty twenty-eight');
  assert.equal(N.toSpoken('in 2026'), 'in twenty twenty-six');
  assert.deepEqual(canons('2025–2028'), ['year:2025', 'year:2028']);
  assert.deepEqual(canons('2025 to 2028'), ['year:2025', 'year:2028']);
  assert.deepEqual(canons('twenty twenty-five to twenty twenty-eight'), ['year:2025', 'year:2028']);
  assert.deepEqual(canons('two thousand eight'), ['year:2008']);
  assert.deepEqual(canons('$2,025'), ['usd:2025']); // a comma or a unit means an amount, not a year
});

test('separate numbers are not merged; punctuation ends a number', () => {
  assert.deepEqual(canons('twelve, twenty-two or thirty-two percent'), ['num:12', 'num:22', 'pct:32']);
  assert.deepEqual(canons('forty-eight twenty-eight'), ['num:48', 'num:28']);
  assert.deepEqual(canons('Road A and road B'), []);
});

test('pronunciation dictionary is whole-word and case-sensitive', () => {
  assert.equal(N.toSpoken('CRUX: the APR in the US'), 'crux: the A-P-R in the U.S.');
  assert.equal(N.toSpoken('bus crux USA'), 'bus crux USA');
});

test('round trip: every spoken form parses back to the same canonical number', () => {
  const samples = ['$25,000', '5.2%', '48', '$578', '$400', 'month 28', '$2,744', '$1,554', '$1,190', '6.12%', '−20%', '8%', '2025–2028', '15%', '0%', '20', '$459'];
  for (const s of samples) assert.deepEqual(canons(N.toSpoken(s)), canons(s), s);
});

test('word indices point at the first word of each number', () => {
  const r = N.parseNumbers('saves one thousand two hundred forty dollars in month twenty-eight');
  assert.deepEqual(r.map((x) => [x.canon, x.start, x.end]), [['usd:1240', 1, 7], ['month:28', 9, 10]]);
});
