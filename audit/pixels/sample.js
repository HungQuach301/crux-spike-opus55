// Random-time audit: D's page scene graph (declared) + page screenshot at each time.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const times = JSON.parse(fs.readFileSync(process.argv[2]));
(async () => {
  const b = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await p.goto('file:///home/user/d/render-d/prod/page.html'); await p.evaluate(() => document.fonts.ready);
  const out = [];
  for (const t of times) {
    await p.evaluate((t) => window.CHECKS.seek(t), t);
    const objs = await p.evaluate(() => window.CHECKS.objects());
    const texts = objs.filter((o) => o.kind === 'text' && o.opacity > 0.5 && o.box[2] > 0 && o.box[0] < 1920 && o.box[3] > 0 && o.box[1] < 1080)
      .map((o) => ({ tid: o.tid, role: o.role, text: o.text, box: o.box.map(Math.round), claims: (o.claims || []).map((c) => c.id), opacity: +o.opacity.toFixed(2) }));
    await p.screenshot({ path: path.join(__dirname, `page-${t.toFixed(3)}.png`) });
    out.push({ t, texts });
  }
  fs.writeFileSync(path.join(__dirname, 'declared.json'), JSON.stringify(out, null, 1)); await b.close();
})();
