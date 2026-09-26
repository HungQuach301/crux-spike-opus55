'use strict';
// Tiles PNGs into one contact sheet (DOM grid, captured by Chromium).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function contactSheet(items, out, { cols = 6, thumbW = 300 } = {}) {
  const thumbH = Math.round(thumbW * 9 / 16);
  const cellH = thumbH + 70;
  const rows = Math.ceil(items.length / cols);
  const Wd = cols * (thumbW + 24) + 72, Ht = rows * (cellH + 16) + 72;
  const html = `<html><head><style>
    @font-face { font-family: Inter; font-weight: 400; src: url('data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, 'fonts/inter-latin-400-normal.woff2')).toString('base64')}'); }
    @font-face { font-family: Inter; font-weight: 600; src: url('data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, 'fonts/inter-latin-600-normal.woff2')).toString('base64')}'); }
    body { margin: 0; background: #0E1116; font-family: Inter; color: #F2F4F7; }
    .g { display: grid; grid-template-columns: repeat(${cols}, ${thumbW}px); gap: 16px 24px; padding: 36px; }
    img { width: ${thumbW}px; height: ${thumbH}px; display: block; border: 1px solid #2A303B; }
    .c { font-size: 24px; font-weight: 600; margin-top: 6px; font-variant-numeric: tabular-nums; }
    .s { font-size: 24px; color: #9AA4B2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style></head><body><div class="g">${items.map((it) => `<div><img src="data:image/png;base64,${fs.readFileSync(it.png).toString('base64')}"><div class="c">${it.title}</div><div class="s">${it.sub}</div></div>`).join('')}</div></body></html>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: Wd, height: Ht } });
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
}
module.exports = { contactSheet };
if (require.main === module) {
  const dir = process.argv[2];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  contactSheet(files.map((f) => ({ png: path.join(dir, f), title: f.replace('.png', ''), sub: '' })), process.argv[3], { cols: Number(process.argv[4] || 4), thumbW: Number(process.argv[5] || 460) });
}
