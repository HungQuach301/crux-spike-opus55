'use strict';
// Test D M3 package: three thumbnails (1280x720, token colours only, text >= 90 px, readable at 10 %), their text
// sidecars (P01), and three title options. None suggests a conclusion the video does not make.
//   node src/d/m3-package.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const REPO = path.join(__dirname, '..', '..');
const OUT = path.join(REPO, 'out', 'm3', 'root', 'out', 'package');
fs.mkdirSync(OUT, { recursive: true });
const T = JSON.parse(fs.readFileSync(path.join(REPO, 'design', 'tokens.json'), 'utf8')).colors;
const font = (w) => `@font-face { font-family: Inter; font-weight: ${w}; src: url(file://${REPO}/render-av/fonts/inter-latin-${w}-normal.woff2); }`;
const css = `${font(700)} ${font(600)} body { margin: 0; width: 1280px; height: 720px; background: ${T.bg}; overflow: hidden; font-family: Inter; }
.t { position: absolute; font-weight: 700; line-height: 1; white-space: nowrap; }`;
// two balance paths drawn as simple polylines in the character colours (shapes of the real data, no numbers)
const D = eval(fs.readFileSync(path.join(REPO, 'render-d', 'prod', 'data.js'), 'utf8').replace('window.DATA = ', '(').replace(/;\s*$/, ')'));
const path2 = (arr, x0, x1, y0, y1, max) => arr.map((v, k) => `${(x0 + (x1 - x0) * k / (arr.length - 1)).toFixed(1)},${(y0 - (y0 - y1) * v / max).toFixed(1)}`).join(' ');
const max = Math.max(...D.model.realMirror, ...D.model.real1966);
const lines = (x0, x1, y0, y1, w = 16) => `<svg width="1280" height="720" style="position:absolute;left:0;top:0">
  <polyline points="${path2(D.model.realMirror, x0, x1, y0, y1, max)}" fill="none" stroke="${T.cmirror}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${w * 2.2} ${w * 1.4}"/>
  <polyline points="${path2(D.model.real1966, x0, x1, y0, y1, max)}" fill="none" stroke="${T.c1966}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const THUMBS = [
  { html: `${lines(760, 1230, 660, 140)}<div class="t" id="a" style="left:60px;top:90px;font-size:124px;color:${T.text}">SAME</div><div class="t" id="b" style="left:60px;top:230px;font-size:124px;color:${T.text}">AVERAGE</div><div class="t" id="c" style="left:60px;top:470px;font-size:96px;color:${T.c1966}">1 ran out</div>`,
    texts: [['a', 'SAME'], ['b', 'AVERAGE'], ['c', '1 ran out']] },
  { html: `<div class="t" id="a" style="left:80px;top:110px;font-size:300px;color:${T.c1966}">1991</div><div class="t" id="b" style="left:90px;top:470px;font-size:100px;color:${T.text}">same average</div>${lines(900, 1230, 400, 90, 12)}`,
    texts: [['a', '1991'], ['b', 'same average']] },
  { html: `<div class="t" id="a" style="left:70px;top:80px;font-size:120px;color:${T.c1966}">9.7%</div><div class="t" id="b" style="left:70px;top:230px;font-size:120px;color:${T.cmirror}">9.7%</div><div class="t" id="c" style="left:70px;top:470px;font-size:108px;color:${T.text}">order matters?</div>${lines(620, 1230, 420, 80, 12)}`,
    texts: [['a', '9.7%'], ['b', '9.7%'], ['c', 'order matters?']] },
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  for (let i = 0; i < THUMBS.length; i++) {
    const hf = path.join(OUT, `.thumb-${i + 1}.html`); fs.writeFileSync(hf, `<!doctype html><html><head><style>${css}</style></head><body>${THUMBS[i].html}</body></html>`);
    await p.goto('file://' + hf); await p.evaluate(async () => { await document.fonts.load('700 100px Inter'); });
    await p.evaluate(async () => { await document.fonts.ready; });
    const texts = [];
    for (const [id, text] of THUMBS[i].texts) { const r = await p.evaluate((id) => { const e = document.getElementById(id); const x = e.getBoundingClientRect(); return [x.left, x.top, x.width, x.height, parseFloat(getComputedStyle(e).fontSize)]; }, id);
      texts.push({ text, box: r.slice(0, 4).map((v) => Math.round(v)), fontPx: r[4] }); }
    await p.screenshot({ path: path.join(OUT, `thumb-${i + 1}.png`) });
    fs.writeFileSync(path.join(OUT, `thumb-${i + 1}.json`), JSON.stringify({ texts }, null, 1));
  }
  await b.close();
  for (let i = 1; i <= THUMBS.length; i++) fs.unlinkSync(path.join(OUT, `.thumb-${i}.html`));
  fs.writeFileSync(path.join(OUT, 'titles.md'), ['# Title options', '',
    '1. Same Average, Different Fate: Why One Retiree Ran Out of Money',
    '2. Two Retirees Earned the Same 9.7% Average. Only One Ran Out.',
    '3. Sequence-of-Returns Risk, Explained with 1966 and Its Mirror', ''].join('\n'));
  console.log('thumbs', THUMBS.length);
})();
