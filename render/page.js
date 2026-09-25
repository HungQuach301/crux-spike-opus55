'use strict';
// Opens the renderer page in the preinstalled Chromium via Playwright.
const path = require('path');
const { chromium } = require('playwright');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 28px Inter`))); });
  if (errors.length) throw new Error(errors.join('\n'));
  return page;
}
async function launch() {
  return chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
}
async function paint(page, t, ds = 'normal') {
  return page.evaluate(([t, ds]) => window.SEG.renderFrame(t, ds), [t, ds]);
}
module.exports = { openPage, launch, paint };
