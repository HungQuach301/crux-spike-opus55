'use strict';
// Probe-only pass: paints every frame (no screenshot, no encode) and records the first frame of
// each event's DOM probe -> out/visual-events.json. Used when events are added to elements that
// are already in the picture (data-ev attributes do not change any pixel), so the encoded video
// stays valid without a re-render.
const fs = require('fs');
const path = require('path');
const { launch, openPage, paint } = require('./page');
const OUT = path.join(__dirname, '..', 'out');
const tl = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));
const FPS = 30, W = 4;
(async () => {
  const t0 = Date.now();
  const b = await launch();
  const total = Math.round(tl.total * FPS), per = Math.ceil(total / W);
  const parts = await Promise.all(Array.from({ length: W }, async (_, w) => {
    const p = await openPage(b); const first = {};
    for (let f = w * per; f < Math.min(total, (w + 1) * per); f++) {
      await paint(p, f / FPS);
      for (const id of await p.evaluate(() => window.SEG.probes())) if (!(id in first)) first[id] = f;
    }
    await p.close(); return first;
  }));
  await b.close();
  const first = {};
  for (const m of parts) for (const [k, v] of Object.entries(m)) if (!(k in first) || v < first[k]) first[k] = v;
  const visual = tl.events.map((e) => ({ id: e.id, type: e.type, t: e.t, visualFrame: first[e.id] ?? null, visualT: first[e.id] !== undefined ? +(first[e.id] / FPS).toFixed(4) : null }));
  fs.writeFileSync(path.join(OUT, 'visual-events.json'), JSON.stringify(visual, null, 1));
  const missing = visual.filter((v) => v.visualT === null).map((v) => v.id);
  console.log(`probed ${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s; events without a probe: ${missing.join(', ') || 'none'}`);
})().catch((e) => { console.error(e); process.exit(1); });
