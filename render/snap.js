'use strict';
// Usage: node render/snap.js <dataset> <sceneId|seconds> <out.png>
require('./build-data');
const { launch, openPage, paint } = require('./page');
(async () => {
  const [ds = 'normal', when = 'tableB', out = 'snap.png'] = process.argv.slice(2);
  const b = await launch(); const p = await openPage(b);
  const scenes = await p.evaluate(() => window.SEG.SCENES);
  const s = scenes.find((x) => x.id === when);
  const t = s ? s.start + s.hold : Number(when);
  await paint(p, t, ds);
  await p.screenshot({ path: out });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
