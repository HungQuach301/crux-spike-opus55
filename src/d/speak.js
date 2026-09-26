'use strict';
// Written text (digits) -> the words sent to TTS. Wraps test C's normalizer (src/av/normalize.js) with
// the forms this script uses: "$1.96 million", "−1.8%", "S&P 500", "10-year", "28th", acronyms.
const { toSpoken: baseSpoken } = require('../av/normalize');

const ORD = { 1: 'first', 2: 'second', 3: 'third', 5: 'fifth', 8: 'eighth', 9: 'ninth', 12: 'twelfth' };
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function ordinal(n) {
  if (ORD[n]) return ORD[n];
  if (n < 20) return baseSpoken(String(n)) + 'th';
  const t = Math.floor(n / 10), o = n % 10;
  if (!o) return TENS[t].replace(/y$/, 'ieth');
  return TENS[t] + '-' + (ORD[o] || ONES[o] + 'th');
}

const DICT = { US: 'U.S.', NYU: 'N.Y.U.', FRED: 'Fred', 'S&P': 'S and P' };

function toSpoken(text) {
  let s = text;
  // $1.96 million -> one point nine six million dollars
  s = s.replace(/\$(\d+(?:\.\d+)?) (million|billion)/g, (_, v, m) => `${baseSpoken(v, {})} ${m} dollars`);
  s = s.replace(/−/g, '-');
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, (_, n) => ordinal(+n));
  s = s.replace(/\b(\d+)-year\b/g, (_, n) => `${baseSpoken(n, {})}-year`);
  s = s.replace(/S&P/g, 'S and P');
  s = baseSpoken(s, {});
  for (const [k, v] of Object.entries(DICT)) s = s.replace(new RegExp(`(?<![\\w.])${k.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}(?![\\w])`, 'g'), v);
  return s;
}

module.exports = { toSpoken };

if (require.main === module) {
  for (const t of ['The mirror retiree is now ahead by $1.96 million.', 'After inflation, the 1966 retiree\'s first decade averaged −1.8%.', 'The stocks are the S&P 500 with dividends reinvested.',
    'The bonds are 10-year US Treasury bonds.', '1969 ran out of money in its 28th year.', 'That is $40,000, in 1966 dollars.', 'from 1928 to 1996: 69 retirements', 'annual returns from Professor Damodaran at NYU Stern, and FRED.'])
    console.log(toSpoken(t));
}
