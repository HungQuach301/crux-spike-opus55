'use strict';
const path = require('path');
const { chromium } = require('playwright');

async function launch() { return chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] }); }
async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 28px Inter`))); });
  if (errors.length) throw new Error(errors.join('\n'));
  page.on('pageerror', (e) => { throw e; });
  return page;
}
const paint = (page, t) => page.evaluate((t) => window.SEG.renderFrame(t), t);
module.exports = { launch, openPage, paint };
