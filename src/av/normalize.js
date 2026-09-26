'use strict';
// Text normalization shared by TTS preparation and the ASR number check. Provider-independent:
// plain strings in, plain strings / canonical numbers out.
//
//   toSpoken(text)      "$1,240 at 5.2% in month 28" -> "one thousand two hundred forty dollars at
//                       five point two percent in month twenty-eight"
//   parseNumbers(text)  numerals OR number words -> [{ kind, value, canon, start, end }]
//                       "5.2%" and "five point two percent" both -> { kind: 'pct', canon: 'pct:5.2' }
//
// Kinds: pct (percent), usd (dollars), month ("month N"), year (1900–2099 written without a
// thousands comma, or "twenty twenty-five"), num (anything else). The same rules apply to both
// sides of a comparison, so a claim and an ASR transcript land on the same canonical form.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = [[1e6, 'million'], [1e3, 'thousand']];

// Pronunciation dictionary: whole-word, case-sensitive replacements applied after numbers.
const PRONOUNCE = {
  CRUX: 'crux',
  APR: 'A-P-R',
  US: 'U.S.',
  vs: 'versus',
  ILLUSTRATIVE: 'illustrative',
};

function under100(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
}
function under1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? ONES[h] + ' hundred' : '', r || !h ? under100(r) : ''].filter(Boolean).join(' ');
}
/** Non-negative integer -> American English words ("one thousand one hundred ninety"). */
function intToWords(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('intToWords: ' + n);
  if (n < 1000) return under1000(n);
  const parts = [];
  let r = n;
  for (const [v, w] of SCALES) if (r >= v) { parts.push(under1000(Math.floor(r / v)) + ' ' + w); r %= v; }
  if (r) parts.push(under1000(r));
  return parts.join(' ');
}
/** Year -> spoken form: 2025 "twenty twenty-five", 2008 "two thousand eight", 1999 "nineteen ninety-nine". */
function yearToWords(y) {
  const hi = Math.floor(y / 100), lo = y % 100;
  if (y >= 2000 && y < 2010) return intToWords(y);
  return under100(hi) + ' ' + (lo === 0 ? 'hundred' : lo < 10 ? 'oh ' + ONES[lo] : under100(lo));
}
/** "5.2" -> "five point two"; "6.12" -> "six point one two". */
function decimalToWords(s) {
  const [i, f] = s.split('.');
  const head = intToWords(Number(i.replace(/,/g, '')));
  return f === undefined ? head : head + ' point ' + [...f].map((d) => ONES[+d]).join(' ');
}

const isYear = (s) => /^(19|20)\d\d$/.test(s);
const MINUS = '[−-]';

/** Numerals -> words, then the pronunciation dictionary. */
function toSpoken(text, dict = PRONOUNCE) {
  let s = text;
  // year ranges: 2025–2028
  s = s.replace(/\b((?:19|20)\d\d)\s*[–-]\s*((?:19|20)\d\d)\b/g, (_, a, b) => `${yearToWords(+a)} to ${yearToWords(+b)}`);
  // money: −$1,240.50 / $578.00 / $400
  s = s.replace(new RegExp(`(${MINUS})?\\$(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d{2}))?`, 'g'), (_, neg, whole, cents) => {
    const w = Number(whole.replace(/,/g, ''));
    let out = `${intToWords(w)} ${w === 1 ? 'dollar' : 'dollars'}`;
    if (cents && Number(cents)) out += ` and ${intToWords(Number(cents))} cents`;
    return (neg ? 'minus ' : '') + out;
  });
  // percent ranges: 2%–10% / 2–10% -> "two to ten percent"
  s = s.replace(/\b(\d+(?:\.\d+)?)%?\s*–\s*(\d+(?:\.\d+)?)\s?%/g, (_, a, b) => `${decimalToWords(a)} to ${decimalToWords(b)} percent`);
  // percent: −20% / 5.2% / 6.12%
  s = s.replace(new RegExp(`(${MINUS})?(\\d+(?:\\.\\d+)?)\\s?%`, 'g'), (_, neg, v) => (neg ? 'minus ' : '') + decimalToWords(v) + ' percent');
  // ranges between plain numbers: 2–10 -> "two to ten"
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*–\s*(\d+(?:\.\d+)?)\b/g, (_, a, b) => `${decimalToWords(a)} to ${decimalToWords(b)}`);
  // negative plain numbers
  s = s.replace(new RegExp(`(^|[\\s(])${MINUS}(\\d)`, 'g'), '$1minus $2');
  // remaining numerals: years, integers with commas, decimals
  s = s.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b/g, (m) => (isYear(m) ? yearToWords(+m) : decimalToWords(m)));
  for (const [k, v] of Object.entries(dict)) s = s.replace(new RegExp(`(?<![\\w.-])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'g'), v);
  return s;
}

// ------------------------------------------------------------------ parsing
const WORD_VAL = Object.fromEntries([...ONES.map((w, i) => [w, i]), ...TENS.map((w, i) => [w, i * 10]).filter(([w]) => w), ['oh', 0]]);
const clean = (w) => w.toLowerCase().replace(/^[^\w$−-]+|[^\w%]+$/g, '');
const endsClause = (raw) => /[,;:.!?]$/.test(raw);

/** Parse a run of number words starting at i. Returns { value, next, isYearForm } or null. */
function parseWordRun(words, i) {
  // split hyphenated words into parts, remembering which word each part came from
  const parts = [];
  for (let k = i; k < words.length; k++) {
    const raw = words[k];
    const sub = clean(raw).split('-').filter(Boolean);
    if (!sub.length || !sub.every((p) => p in WORD_VAL || p === 'hundred' || p === 'thousand' || p === 'million' || p === 'point')) break;
    for (const p of sub) parts.push({ p, k });
    if (endsClause(raw)) break; // "twelve, twenty-two": punctuation ends a number
  }
  if (!parts.length || parts[0].p === 'point' || parts[0].p === 'oh' || !(parts[0].p in WORD_VAL)) return null;
  const after = (j) => (j >= parts.length ? parts[parts.length - 1].k + 1 : parts[j].k);
  // year form: (nineteen|twenty) + (10..99 | oh X), e.g. "twenty twenty-five", "nineteen oh five"
  const v0 = WORD_VAL[parts[0].p];
  if ((v0 === 19 || v0 === 20) && parts.length >= 2 && parts[1].k !== parts[0].k) {
    const r = parts.slice(1);
    const val = (q) => (q && q.p in WORD_VAL ? WORD_VAL[q.p] : null);
    let lo = null, used = 0;
    if (r[0].p === 'oh' && val(r[1]) !== null && val(r[1]) > 0 && val(r[1]) < 10) { lo = val(r[1]); used = 2; }
    else if (val(r[0]) >= 10) {
      lo = val(r[0]); used = 1;
      if (lo >= 20 && lo % 10 === 0 && r[1] && r[1].k === r[0].k && val(r[1]) > 0 && val(r[1]) < 10) { lo += val(r[1]); used = 2; }
    }
    if (lo !== null) return { value: v0 * 100 + lo, next: after(1 + used), isYearForm: true };
  }
  // cardinal, with an optional "point d d d" fraction
  let total = 0, cur = 0, last = null, j = 0, frac = null;
  for (; j < parts.length; j++) {
    const { p } = parts[j];
    if (p === 'point') {
      const ds = [];
      let q = j + 1;
      while (q < parts.length && parts[q].p in WORD_VAL && WORD_VAL[parts[q].p] < 10) { ds.push(WORD_VAL[parts[q].p]); q++; }
      if (ds.length) { frac = ds.join(''); j = q; }
      break;
    }
    if (p === 'oh') break;
    if (p === 'hundred') { if (last === 'hundred' || last === 'scale' || last === null) break; cur *= 100; last = 'hundred'; continue; }
    if (p === 'thousand' || p === 'million') { if (last === 'scale' || last === null) break; total += cur * (p === 'thousand' ? 1e3 : 1e6); cur = 0; last = 'scale'; continue; }
    const v = WORD_VAL[p];
    const kind = v < 10 ? 'unit' : v < 20 ? 'teen' : 'ten';
    // a unit/teen/ten right after a unit/teen, or a teen/ten after a ten, starts a new number
    if (last === 'unit' || last === 'teen' || (last === 'ten' && kind !== 'unit')) break;
    cur += v; last = kind;
  }
  return { value: total + cur + (frac !== null ? Number('0.' + frac) : 0), next: after(j), isYearForm: false };
}

/** Parse a numeral token (with its neighbours for "percent"/"dollars"). */
function parseNumeralToken(raw) {
  const w = raw.replace(/[.,;:!?)"”]+$/, '').replace(/^[("“]+/, '');
  let m;
  if ((m = w.match(/^((?:19|20)\d\d)[–-]((?:19|20)\d\d)$/))) return [{ kind: 'year', value: +m[1] }, { kind: 'year', value: +m[2] }];
  if ((m = w.match(/^([−-])?\$(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/))) return [{ kind: 'usd', value: (m[1] ? -1 : 1) * Number(m[2].replace(/,/g, '') + (m[3] || '')) }];
  if ((m = w.match(/^([−-])?(\d+(?:\.\d+)?)%$/))) return [{ kind: 'pct', value: (m[1] ? -1 : 1) * Number(m[2]) }];
  if ((m = w.match(/^(\d+(?:\.\d+)?)%?[–-](\d+(?:\.\d+)?)%$/))) return [{ kind: 'pct', value: Number(m[1]) }, { kind: 'pct', value: Number(m[2]) }];
  if ((m = w.match(/^([−-])?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/))) {
    const s = m[2] + (m[3] || '');
    const v = (m[1] ? -1 : 1) * Number(s.replace(/,/g, ''));
    return [{ kind: !m[1] && !m[3] && isYear(m[2]) ? 'year' : 'num', value: v, bare: true }];
  }
  return null;
}

/**
 * Find every number in a list of words (strings, as spoken or as written).
 * Returns [{ kind, value, canon, start, end }] with word indices [start, end).
 */
function parseNumberWords(words) {
  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = clean(words[i]);
    let neg = false, j = i;
    if ((w === 'minus' || w === 'negative') && i + 1 < words.length) { neg = true; j = i + 1; }
    const numeral = parseNumeralToken(words[j]);
    let found = null;
    if (numeral) {
      found = { items: numeral, next: j + 1 };
    } else {
      const r = parseWordRun(words, j);
      if (r) found = { items: [{ kind: r.isYearForm || (Number.isInteger(r.value) && isYear(String(r.value))) ? 'year' : 'num', value: r.value, bare: true }], next: r.next };
    }
    if (!found) { i++; continue; }
    let next = found.next;
    const unit = next < words.length ? clean(words[next]) : '';
    const items = found.items.map((it) => ({ ...it }));
    if (items.length === 1 && items[0].bare && !endsClause(words[next - 1] || '')) {
      if (unit === 'percent') { items[0].kind = 'pct'; next++; }
      else if (unit === 'dollars' || unit === 'dollar') { items[0].kind = 'usd'; next++; }
    }
    const before = clean(words[i - 1] || '');
    for (const it of items) {
      if (neg) it.value = -it.value;
      if (it.kind === 'num' && before === 'month') it.kind = 'month';
    }
    for (const it of items) out.push({ kind: it.kind, value: it.value, canon: canon(it.kind, it.value), start: i, end: next });
    i = next;
  }
  // "two to ten percent": propagate a trailing percent/dollars back over "X to Y"
  for (let k = 0; k + 1 < out.length; k++) {
    const a = out[k], b = out[k + 1];
    if (a.kind === 'num' && (b.kind === 'pct' || b.kind === 'usd') && b.start === a.end + 1 && clean(words[a.end]) === 'to') { a.kind = b.kind; a.canon = canon(a.kind, a.value); }
  }
  return out;
}

function canon(kind, value) { return `${kind}:${Number(value.toFixed(4))}`; }

/**
 * Join ASR sub-word tokens into words: faster-whisper emits "$25" ",000" and "5" ".2%" as separate
 * tokens; a token whose raw text has no leading space continues the previous word.
 * words: [{ raw, start, end }] -> [{ w, start, end, parts }]
 */
function joinAsrTokens(tokens) {
  const out = [];
  for (const t of tokens) {
    const raw = t.raw !== undefined ? t.raw : ' ' + t.w;
    if (out.length && !/^\s/.test(raw)) { const o = out[out.length - 1]; o.w += raw; o.end = t.end; o.parts++; }
    else out.push({ w: raw.trim(), start: t.start, end: t.end, parts: 1 });
  }
  return out;
}

const splitWords = (text) => text.replace(/[–—]/g, (d) => (d === '–' ? '–' : ' ')).split(/\s+/).filter(Boolean);
/** Parse numbers in free text (numerals or words). */
function parseNumbers(text) { return parseNumberWords(splitWords(text)); }

module.exports = { joinAsrTokens, PRONOUNCE, intToWords, yearToWords, decimalToWords, toSpoken, parseNumbers, parseNumberWords, splitWords, canon };
