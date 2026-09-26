'use strict';
// node render-av/snap.js <outdir> [sceneId|seconds ...]  -> PNGs at 75% of each scene (or given times)
const fs = require('fs'); const path = require('path');
const { launch, openPage, paint } = require('./page');
const timeline = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'out', 'timeline.json'), 'utf8'));
(async () => {
  const [dir, ...which] = process.argv.slice(2); fs.mkdirSync(dir, { recursive: true });
  const b = await launch(); const p = await openPage(b);
  const list = which.length ? which : timeline.scenes.map((s) => s.id);
  for (const w of list) {
    const [id, frac] = w.split('@');
    const s = timeline.scenes.find((x) => x.id === id);
    const t = s ? s.start + s.dur * (frac ? Number(frac) : 0.75) : Number(w);
    await paint(p, t); await p.screenshot({ path: path.join(dir, `${String(s ? s.index + 1 : t).padStart(2, '0')}-${w}.png`) });
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
