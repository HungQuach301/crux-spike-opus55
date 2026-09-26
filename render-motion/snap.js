'use strict';
// node render-motion/snap.js <outdir> [sceneId|seconds ...]  -> PNGs at 75% of each scene (or given times)
const fs = require('fs'); const path = require('path');
const { timeline } = require('./build-data');
const { launch, openPage, paint } = require('./page');
(async () => {
  const [dir, ...which] = process.argv.slice(2); fs.mkdirSync(dir, { recursive: true });
  const b = await launch(); const p = await openPage(b);
  const list = which.length ? which : timeline.scenes.map((s) => s.id);
  for (const w of list) {
    const s = timeline.scenes.find((x) => x.id === w);
    const t = s ? s.start + s.dur * 0.75 : Number(w);
    await paint(p, t); await p.screenshot({ path: path.join(dir, `${String(s ? s.index + 1 : t).padStart(2, '0')}-${w}.png`) });
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
