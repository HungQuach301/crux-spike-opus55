'use strict';
// Packaging for test C: title, description (sources, assumptions, chapter timestamps) and a
// 1280x720 thumbnail drawn with CRUX tokens only. Writes out/package/{title.txt,description.md,
// thumbnail.png,thumbnail-check.json}.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'package');
const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'timeline.json'), 'utf8'));
const D = require('../src/av/data').build();
const C = D.byId;
const TOK = { bg: '#0E1116', surface: '#171B22', ink: '#F2F4F7', muted: '#9AA4B2', accent: '#4C8DFF', warn: '#F2B441', pos: '#3FBF7F', neg: '#E5484D', grid: '#2A303B' };

const CHAPTERS = [
  ['hook', 'The question'], ['setup', 'Setup and scope (US only)'], ['ch1', '1. The certain part'], ['ch2', '2. Tax, lot by lot'],
  ['ch3', '3. Where the answer flips'], ['ch4', '4. The tax bracket'], ['ch5', '5. Risk: one illustrative sequence'], ['close', 'A threshold, not a forecast'],
];
const ts = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const title = `Pay off a ${C.apr.display} car loan early, or invest? The break-even return after tax (US)`;
const chapterLines = CHAPTERS.map(([id, name]) => { const s = tl.scenes.find((x) => x.chapter === id); return `${ts(s ? s.start : 0)} ${name}`; });
const desc = [
  `A ${C.balance.display} car loan at ${C.apr.display} with ${C.months.display} months left: send the extra cash to the loan (road A), or invest it (road B)? We compute where the answer flips. This is a threshold, not a forecast, and not advice.`,
  '',
  'Result',
  `- Road A pays the loan off at month ${C.payoff_a.display} and avoids ${C.avoided.display} of interest. That part is certain.`,
  `- Break-even average annual return (compounded), after tax at month ${C.horizon.display}: ${C.be_12.display} (${C.ord_12.display} bracket), ${C.be_22.display} (${C.ord_22.display}), ${C.be_32.display} (${C.ord_32.display}, including the ${C.niit.display} NIIT).`,
  `- One ILLUSTRATIVE sequence (${C.seq_first.display} a year for ${C.seq_split.display} months, then ${C.seq_second.display}): road A ends ${C.gap_end.display} ahead.`,
  '',
  'Chapters',
  ...chapterLines,
  '',
  'Assumptions (all stated, none forecast)',
  `- Loan: ${C.balance.display} balance, ${C.apr.display} APR, ${C.months.display} months left, payment ${C.payment.display} (standard amortization).`,
  `- Extra cash: ${C.extra.display} a month, available to either road. ILLUSTRATIVE.`,
  `- Returns: a constant average annual return (compounded monthly as (1+r)^(1/12)); the ${C.axis_lo.display}–${C.axis_hi.display} range is ILLUSTRATIVE.`,
  `- Tax: each monthly contribution is its own lot, sold at month ${C.horizon.display}. Lots held more than ${C.hold_months.display} months are long-term. Rates (ordinary / long-term): ${C.ord_12.display} / ${C.lt_0.display}, ${C.ord_22.display} / ${C.lt_15.display}, ${C.ord_32.display} bracket ${C.ord_32e.display} / ${C.lt_32e.display} with NIIT.`,
  '- Losing lots get no deduction. Loan interest is not deductible; the model ignores the 2025–2028 new-vehicle loan interest deduction. State income tax is ignored. US only.',
  '',
  'Sources',
  '- Inputs are the brief\'s stated scenario and our stated assumptions; no market data is used.',
  '- Every number on screen and in the narration is computed in code and listed with its formula in claims.json (src/av/calc.js, src/av/data.js).',
  '- Narration: synthetic voice (OpenAI gpt-4o-mini-tts, provisional). Music and sound effects: generated in-repo, original work.',
].join('\n');

async function thumbnail() {
  const font = (w) => fs.readFileSync(path.join(__dirname, 'fonts', `inter-latin-${w}-normal.woff2`)).toString('base64');
  const html = `<html><head><style>
    @font-face { font-family: Inter; font-weight: 600; src: url('data:font/woff2;base64,${font(600)}'); }
    @font-face { font-family: Inter; font-weight: 700; src: url('data:font/woff2;base64,${font(700)}'); }
    html { color: ${TOK.ink}; background: ${TOK.bg}; }
    body { margin: 0; width: 1280px; height: 720px; background: ${TOK.bg}; font-family: Inter; color: ${TOK.ink}; position: relative; overflow: hidden; }
    .t { position: absolute; white-space: nowrap; font-variant-numeric: tabular-nums; }
  </style></head><body>
    <svg width="1280" height="720" style="position:absolute;left:0;top:0">
      <path d="M120,600 C360,600 520,540 1160,500" fill="none" stroke="${TOK.warn}" stroke-width="10"/>
      <path d="M120,600 C360,600 520,660 1160,680" fill="none" stroke="${TOK.accent}" stroke-width="10" stroke-dasharray="26 18"/>
      <circle cx="120" cy="600" r="18" fill="${TOK.ink}"/>
    </svg>
    <div class="t" style="left:96px;top:64px;font-size:56px;font-weight:700;color:${TOK.ink}">${C.apr.display} car loan:</div>
    <div class="t" style="left:96px;top:136px;font-size:56px;font-weight:700;color:${TOK.muted}">pay off, or invest?</div>
    <div class="t" style="left:640px;top:210px;font-size:176px;font-weight:700;color:${TOK.ink}">${C.be_22.display}</div>
    <div class="t" style="left:648px;top:410px;font-size:34px;font-weight:600;color:${TOK.muted}">break-even return, ${C.ord_22.display} bracket</div>
    <div class="t" style="left:760px;top:468px;font-size:34px;font-weight:600;color:${TOK.warn}">A: pay off</div>
    <div class="t" style="left:1000px;top:596px;font-size:34px;font-weight:600;color:${TOK.accent}">B: invest</div>
    <div class="t" style="left:96px;top:640px;font-size:40px;font-weight:700;color:${TOK.ink};letter-spacing:0.08em">CRUX</div>
  </body></html>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  // every colour used must be a token
  const used = await p.evaluate(() => {
    const out = new Set();
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (el.closest('svg')) { for (const a of ['fill', 'stroke']) { const v = el.getAttribute(a); if (v && v !== 'none') out.add(v.toLowerCase()); } }
      else { out.add(cs.color); if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') out.add(cs.backgroundColor); }
    }
    return [...out];
  });
  await p.screenshot({ path: path.join(OUT, 'thumbnail.png') });
  await b.close();
  const hex = (c) => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)/); return m ? '#' + m.slice(1, 4).map((v) => (+v).toString(16).padStart(2, '0')).join('') : c; };
  const tok = new Set(Object.values(TOK).map((x) => x.toLowerCase()));
  const off = used.map(hex).filter((c) => !tok.has(c));
  return { size: '1280x720', coloursUsed: [...new Set(used.map(hex))], offToken: off, pass: off.length === 0 };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'title.txt'), title + '\n');
  fs.writeFileSync(path.join(OUT, 'description.md'), desc + '\n');
  const chk = await thumbnail();
  chk.titleChars = title.length;
  fs.writeFileSync(path.join(OUT, 'thumbnail-check.json'), JSON.stringify(chk, null, 1));
  console.log(title, `(${title.length} chars)`); console.log(chapterLines.join('\n')); console.log(JSON.stringify(chk));
})().catch((e) => { console.error(e); process.exit(1); });
