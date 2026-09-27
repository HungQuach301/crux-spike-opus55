const { chromium } = require('playwright'); const fs = require('fs');
const picks = JSON.parse(fs.readFileSync('picks.json'));
(async () => {
  const b = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file:///home/user/d/render-d/prod/page.html'); await p.evaluate(() => document.fonts.ready);
  const out = [];
  for (const k of picks) {
    const res = {};
    for (const dt of [-0.3, 0.5]) {
      await p.evaluate((t) => window.CHECKS.seek(t), k.t + dt);
      const o = (await p.evaluate(() => window.CHECKS.objects())).find((x) => x.tid === k.tid);
      res[dt] = o ? { box: o.box.map(Math.round), opacity: +o.opacity.toFixed(2), text: o.text } : null;
    }
    out.push({ ...k, page: res });
  }
  fs.writeFileSync('first-declared.json', JSON.stringify(out, null, 1)); await b.close();
})();
