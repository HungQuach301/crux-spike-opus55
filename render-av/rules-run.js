'use strict';
// Runs the composition rules (render-av/rules.js) over every 3rd frame of a rendered video page.
//   node render-av/rules-run.js b   -> test B (render-motion), through a thin adapter
//   node render-av/rules-run.js c   -> test C (render-av)
// Writes out/rules-<target>.json.
//
// Test B adapter: wraps B's panel functions so each panel's markup sits in <g data-panel>, and lets
// the runner freeze B's camera (for the split-view diff). It does not change what B draws.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'out');
const FPS = 30, STEP = 3, DT = 0.1, SPLIT_MIN_RUN = 1.0, SPLIT_MAX = 0.6;

// Which panels each test-B scene is about. Overviews (open, scope, outro) may show everything.
const B_ALLOWED = {
  open: ['*'], facts: ['loan'], extra: ['roads'], roads: ['roads'], timeline: ['loan'], interest: ['loan'], scope: ['*'], tax: ['matrix'],
  bars: ['flip'], sweep: ['flip'], settle: ['flip'], morph: ['flip'], detail: ['flip'], flip: ['flip'], matrix: ['matrix', 'flip'], matrix32: ['matrix'],
  certain: ['matrix'], sequence: ['down'], race: ['down'], gap: ['down'], cross: ['down'], downside: ['down'], converge: ['roads'], outro: ['*'],
};
const B_CHART = new Set(['timeline', 'interest', 'tax', 'bars', 'sweep', 'settle', 'morph', 'detail', 'flip', 'matrix', 'matrix32', 'certain', 'sequence', 'race', 'gap', 'cross', 'downside']);

async function openB(browser) {
  const { data, timeline } = (() => {
    const d = require('../src/car/data').build();
    return { data: d, timeline: require('../src/car/timeline').build(d) };
  })();
  fs.writeFileSync(path.join(__dirname, '..', 'render-motion', 'data.js'), 'window.DATA = ' + JSON.stringify(data) + ';\nwindow.TL = ' + JSON.stringify(timeline) + ';\n');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, '..', 'render-motion', 'index.html'));
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.evaluate(() => {
    for (const [fn, name] of [['panelLoan', 'loan'], ['panelRoads', 'roads'], ['panelFlip', 'flip'], ['panelMatrix', 'matrix'], ['panelDown', 'down']]) {
      const orig = window[fn];
      window[fn] = (t, g) => { const n = g.length; orig(t, g); const added = g.splice(n); g.push(`<g data-panel="${name}">${added.join('')}</g>`); };
    }
    const cam = window.camera;
    window.__freeze = null;
    window.camera = (t) => window.__freeze || cam(t);
    window.__freezeAt = (t) => { window.__freeze = cam(t); };
  });
  const scenes = timeline.scenes.map((s) => ({ id: s.id, start: s.start, dur: s.dur, allowed: B_ALLOWED[s.id], chart: B_CHART.has(s.id), move: s.index === 0 ? 0 : Math.min(1.2, 0.5 * s.dur) }));
  return { page, scenes, total: timeline.total };
}

async function openC(browser) {
  const tl = JSON.parse(fs.readFileSync(path.join(OUT, 'timeline.json'), 'utf8'));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 28px Inter`))); });
  const scenes = tl.scenes.map((s) => ({ id: s.id, start: s.start, dur: s.dur, allowed: s.panels, chart: !!s.chart, move: s.move }));
  return { page, scenes, total: tl.total };
}

// bounding box of the region where two boxes differ (e.g. the new strip of a growing bar)
function diffBox(a, b) {
  const same = (i) => Math.abs(a[i] - b[i]) < 0.5;
  const x = same(0) && !same(2) ? [Math.min(a[2], b[2]), Math.max(a[2], b[2])] : same(2) && !same(0) ? [Math.min(a[0], b[0]), Math.max(a[0], b[0])] : [Math.min(a[0], b[0]), Math.max(a[2], b[2])];
  const y = same(1) && !same(3) ? [Math.min(a[3], b[3]), Math.max(a[3], b[3])] : same(3) && !same(1) ? [Math.min(a[1], b[1]), Math.max(a[1], b[1])] : [Math.min(a[1], b[1]), Math.max(a[3], b[3])];
  const onlyX = same(1) && same(3), onlyY = same(0) && same(2);
  return [onlyY ? Math.min(a[0], b[0]) : x[0], onlyX ? Math.min(a[1], b[1]) : y[0], onlyY ? Math.max(a[2], b[2]) : x[1], onlyX ? Math.max(a[3], b[3]) : y[1]];
}

async function run(target) {
  const t0 = Date.now();
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const { page, scenes, total } = target === 'b' ? await openB(browser) : await openC(browser);
  await page.addScriptTag({ path: path.join(__dirname, 'rules.js') });
  const sceneAt = (t) => scenes.find((s) => t >= s.start && t < s.start + s.dur) || scenes[scenes.length - 1];
  const frames = Math.round(total * FPS);
  const per = Object.fromEntries(scenes.map((s) => [s.id, { samples: 0, l1: [], issues: {}, examples: {}, split: [] }]));
  let splitRun = [];
  const splitRuns = [];
  for (let f = 0; f < frames; f += STEP) {
    const t = f / FPS, s = sceneAt(t), P = per[s.id];
    const inTransition = t - s.start < s.move;
    await page.evaluate((t) => window.SEG.renderFrame(t), t);
    const r = await page.evaluate((ctx) => ({ issues: window.RULES.checkFrame(ctx), l1: window.RULES.level1Count(), snap: window.RULES.snapshot() }), { allowed: s.allowed, inTransition });
    P.samples++;
    P.l1.push(r.l1);
    for (const i of r.issues) { P.issues[i.rule] = (P.issues[i.rule] || 0) + 1; (P.examples[i.rule] ||= []).length < 3 && P.examples[i.rule].push({ t: +t.toFixed(2), ...i }); }
    // split view: same camera, 0.1 s later; which elements changed?
    let split = null;
    if (!inTransition && t + DT < s.start + s.dur) {
      await page.evaluate((t) => { if (window.__freezeAt) window.__freezeAt(t); else window.SEG.freezeAt(t); }, t);
      await page.evaluate((t) => window.SEG.renderFrame(t), t + DT);
      const snap2 = await page.evaluate(() => window.RULES.snapshot());
      await page.evaluate(() => { if (window.__freezeAt) window.__freeze = null; else window.SEG.freezeAt(null); });
      const count = (arr) => { const m = new Map(); for (const x of arr) m.set(x.sig, (m.get(x.sig) || 0) + 1); return m; };
      const a = count(r.snap), b = count(snap2);
      const gone = r.snap.filter((x) => (b.get(x.sig) || 0) < a.get(x.sig)), came = snap2.filter((x) => (a.get(x.sig) || 0) < b.get(x.sig));
      // pair old/new versions of the same element (same key): only the part that differs counts
      const changed = [];
      const pool = [...gone];
      for (const n of came) {
        const i = pool.findIndex((o) => o.key === n.key);
        if (i < 0) { changed.push(n); continue; }
        const o = pool.splice(i, 1)[0];
        changed.push({ box: diffBox(o.box, n.box) });
      }
      changed.push(...pool);
      if (changed.length) {
        const bb = changed.reduce((u, x) => [Math.min(u[0], x.box[0]), Math.min(u[1], x.box[1]), Math.max(u[2], x.box[2]), Math.max(u[3], x.box[3])], [1e9, 1e9, -1e9, -1e9]);
        const w = (Math.min(bb[2], 1920) - Math.max(bb[0], 0)) / 1920, h = (Math.min(bb[3], 1080) - Math.max(bb[1], 0)) / 1080;
        split = { w: +w.toFixed(3), h: +h.toFixed(3), n: changed.length };
      }
    }
    const isSplit = split && (split.w > SPLIT_MAX || split.h > SPLIT_MAX);
    if (isSplit && (!splitRun.length || splitRun[0].scene === s.id)) splitRun.push({ t, scene: s.id, ...split });
    else {
      if (splitRun.length) splitRuns.push(splitRun);
      splitRun = isSplit ? [{ t, scene: s.id, ...split }] : [];
    }
  }
  if (splitRun.length) splitRuns.push(splitRun);
  await browser.close();

  const splitViolations = splitRuns.map((r) => ({ scene: r[0].scene, start: +r[0].t.toFixed(2), durationS: +(r.length * STEP / FPS).toFixed(2), maxW: Math.max(...r.map((x) => x.w)), maxH: Math.max(...r.map((x) => x.h)) }))
    .filter((v) => v.durationS >= SPLIT_MIN_RUN);
  const sceneRows = scenes.map((s) => {
    const P = per[s.id];
    const one = P.l1.filter((n) => n === 1).length / Math.max(1, P.l1.length);
    const level1 = s.chart && s.dur >= 2 ? { shareExactlyOne: +one.toFixed(2), max: Math.max(0, ...P.l1), pass: one >= 0.5 && Math.max(0, ...P.l1) <= 1 } : { shareExactlyOne: +one.toFixed(2), max: Math.max(0, ...P.l1), pass: null };
    return { id: s.id, samples: P.samples, chart: s.chart, issues: P.issues, level1, split: splitViolations.filter((v) => v.scene === s.id), examples: P.examples };
  });
  const rules = ['scene-leak', 'bg-over-data', 'unlabelled-curve', 'axis-anchors', 'grey-emphasis', 'number-colour'];
  const summary = Object.fromEntries(rules.map((k) => {
    const sc = sceneRows.filter((r) => r.issues[k]);
    return [k, { framesFlagged: sc.reduce((a, r) => a + r.issues[k], 0), scenes: sc.map((r) => `${r.id} (${r.issues[k]})`), pass: sc.length === 0 }];
  }));
  const l1Fail = sceneRows.filter((r) => r.level1.pass === false);
  summary['level1'] = { scenes: l1Fail.map((r) => `${r.id} (one l1 in ${Math.round(r.level1.shareExactlyOne * 100)}% of samples, max ${r.level1.max})`), pass: l1Fail.length === 0 };
  summary['split-view'] = { scenes: splitViolations.map((v) => `${v.scene} (${v.durationS}s from ${v.start}s, changes span ${Math.round(v.maxW * 100)}% × ${Math.round(v.maxH * 100)}%)`), pass: splitViolations.length === 0 };
  const res = {
    target: target === 'b' ? 'test B (render-motion, out/segment.mp4 source)' : 'test C (render-av)',
    sampledEvery: `${STEP} frames (${(STEP / FPS).toFixed(1)} s)`, samples: sceneRows.reduce((a, r) => a + r.samples, 0),
    definitions: {
      'split-view': `changed elements between t and t+${DT}s with the camera frozen (an element present in both frames counts only the region where its old and new boxes differ); violation when the union box of changes exceeds ${SPLIT_MAX * 100}% of frame width or height for >= ${SPLIT_MIN_RUN}s, outside camera moves`,
      level1: 'chart scenes of >= 2 s: exactly one visible .l1 (opacity > 0.5) in >= 50% of samples, never two',
      exemptions: 'scene-leak and split-view skip the camera move at the start of each scene',
    },
    summary, scenes: sceneRows, seconds: +((Date.now() - t0) / 1000).toFixed(1),
  };
  fs.writeFileSync(path.join(OUT, `rules-${target}.json`), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  console.log('seconds', res.seconds);
}

run(process.argv[2] || 'c').catch((e) => { console.error(e); process.exit(1); });
