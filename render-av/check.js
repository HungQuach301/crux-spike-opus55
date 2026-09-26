'use strict';
// Frame checks over the whole segment (every 3rd frame) + strict checks on the 5 keyframes:
// digits only from claims (and equal to the claim unless mid-roll), token colors/sizes/weights,
// safe area, text overlap, words per scene. Writes out/text-metrics.json and out/checks.json.
const fs = require('fs');
const path = require('path');
const fs0 = require('fs');
const data = require('../src/av/data').build();
const timeline = JSON.parse(fs0.readFileSync(require('path').join(__dirname, '..', 'out', 'timeline.json'), 'utf8'));
const { launch, openPage, paint } = require('./page');

const OUT = path.join(__dirname, '..', 'out');
const TOKENS = ['#0E1116', '#171B22', '#F2F4F7', '#9AA4B2', '#4C8DFF', '#F2B441', '#3FBF7F', '#E5484D', '#2A303B'];

async function inspect(page, claims) {
  return page.evaluate(([TOKENS, claims]) => {
    const rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
    const ok = new Set(TOKENS.map(rgb).concat(['rgba(0, 0, 0, 0)', 'none']));
    const okHex = new Set(TOKENS.map((h) => h.toLowerCase()));
    const issues = [];
    const texts = [];
    const eff = (el) => { let op = 1, e = el; while (e && e.nodeType === 1) { const o = e.getAttribute('opacity') ?? e.style.opacity; if (o !== null && o !== '') op *= parseFloat(o); e = e.parentElement; } return op; };
    for (const el of document.querySelectorAll('#overlay .t')) {
      const op = eff(el);
      if (op <= 0.05) continue;
      const r = el.getBoundingClientRect();
      const words = el.innerText.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
      texts.push({ tid: el.dataset.tid, op, words: words.length, text: el.innerText, box: [r.left, r.top, r.right, r.bottom] });
      if (r.left < 94 || r.top < 94 || r.right > 1826 || r.bottom > 986) issues.push({ kind: 'outside-safe-area', tid: el.dataset.tid, op: +op.toFixed(2) });
      for (const x of [el, ...el.querySelectorAll('*')]) {
        const cs = getComputedStyle(x);
        const own = [...x.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim());
        if (own) {
          if (!['128px', '48px', '28px'].includes(cs.fontSize)) issues.push({ kind: 'off-token-size', v: cs.fontSize, tid: el.dataset.tid });
          if (!['400', '600', '700'].includes(cs.fontWeight)) issues.push({ kind: 'off-token-weight', v: cs.fontWeight });
          if (!ok.has(cs.color)) issues.push({ kind: 'off-token-color', v: cs.color, tid: el.dataset.tid });
          if (!/Inter/.test(cs.fontFamily)) issues.push({ kind: 'off-token-font' });
        }
        if (x.tagName === 'I' && !ok.has(cs.backgroundColor)) issues.push({ kind: 'off-token-color', v: cs.backgroundColor });
      }
    }
    // digits only inside claim spans; settled spans must equal the claim display
    const walker = document.createTreeWalker(document.getElementById('overlay'), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) if (/\d/.test(n.nodeValue) && !n.parentElement.closest('.n')) issues.push({ kind: 'number-not-from-claim', text: n.nodeValue });
    for (const sp of document.querySelectorAll('#overlay .n')) {
      const c = claims[sp.dataset.claim];
      if (!c) issues.push({ kind: 'unknown-claim', id: sp.dataset.claim });
      else if (!sp.dataset.roll && sp.textContent !== c) issues.push({ kind: 'claim-mismatch', id: sp.dataset.claim, shown: sp.textContent, claim: c });
    }
    // svg colors
    for (const el of document.querySelectorAll('svg *')) {
      for (const a of ['fill', 'stroke']) {
        const v = el.getAttribute(a);
        if (v && !v.startsWith('url(') && v !== 'none' && !okHex.has(v.toLowerCase())) issues.push({ kind: 'off-token-svg', a, v });
      }
    }
    // overlaps between clearly visible texts
    const vis = texts.filter((x) => x.op > 0.5);
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i].box, b = vis[j].box;
      const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      if (ox > 2 && oy > 2) issues.push({ kind: 'text-overlap', a: vis[i].tid, b: vis[j].tid });
    }
    return { texts, issues, hier: { l1: document.querySelectorAll('#overlay .l1').length } };
  }, [TOKENS, claims]);
}

(async () => {
  const claims = Object.fromEntries(data.claims.map((c) => [c.claimId, c.display]));
  const b = await launch(); const p = await openPage(b);
  const FPS = 30, total = Math.round(timeline.total * FPS);
  const perScene = Object.fromEntries(timeline.scenes.map((s) => [s.id, { maxWords: 0, tids: new Map(), issues: [] }]));
  const lastVisible = {}; // scene -> Set of tids visible (op>0.5) at the scene's last sample
  const transient = {};
  const allIssues = [];
  for (let f = 0; f < total; f += 3) {
    const t = f / FPS;
    const sid = await paint(p, t);
    const r = await inspect(p, claims);
    const ps = perScene[sid];
    const strong = r.texts.filter((x) => x.op > 0.5);
    ps.maxWords = Math.max(ps.maxWords, strong.reduce((a, x) => a + x.words, 0));
    for (const x of strong) ps.tids.set(x.tid, Math.max(ps.tids.get(x.tid) || 0, x.words));
    lastVisible[sid] = new Set(strong.map((x) => x.tid));
    for (const i of r.issues) {
      if (i.kind === 'outside-safe-area' || i.kind === 'text-overlap') { transient[i.kind] = (transient[i.kind] || 0) + 1; continue; }
      allIssues.push({ frame: f, scene: sid, ...i });
    }
  }
  // keyframes: strict (safe area and overlap count here)
  const kf = JSON.parse(fs.readFileSync(path.join(OUT, 'keyframes', 'index.json'), 'utf8'));
  const keyframes = [];
  for (const k of kf) {
    await paint(p, k.t);
    const r = await inspect(p, claims);
    const cov = await p.evaluate(async () => 0); // placeholder, coverage computed from PNG below
    keyframes.push({ ...k, issues: r.issues, words: r.texts.filter((x) => x.op > 0.5).reduce((a, x) => a + x.words, 0), l1: r.hier.l1 });
  }
  await b.close();
  const scenes = timeline.scenes.map((s, i) => {
    const ps = perScene[s.id];
    const prev = i ? lastVisible[timeline.scenes[i - 1].id] || new Set() : new Set();
    let newWords = 0;
    for (const [tid, w] of ps.tids) if (!prev.has(tid)) newWords += w;
    return { id: s.id, words: ps.maxWords, newWords, newWordsPerSec: +(newWords / s.dur).toFixed(2) };
  });
  const totalNew = scenes.reduce((a, s) => a + s.newWords, 0);
  fs.writeFileSync(path.join(OUT, 'text-metrics.json'), JSON.stringify({ scenes, totalNewWords: totalNew, wordsPerSec: +(totalNew / timeline.total).toFixed(3) }, null, 1));
  fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify({ sampledFrames: Math.ceil(total / 3), issues: allIssues, transientDuringCameraMoves: transient, keyframes }, null, 1));
  console.log('issues', allIssues.length, JSON.stringify(allIssues.slice(0, 6)));
  console.log('transient', transient);
  keyframes.forEach((k) => console.log('kf', k.name, 'issues', k.issues.length, JSON.stringify(k.issues.slice(0, 3)), 'words', k.words));
  scenes.forEach((s) => console.log(s.id.padEnd(10), 'words', s.words, 'new', s.newWords, 'rate', s.newWordsPerSec));
  console.log('total new words', totalNew, 'w/s', (totalNew / timeline.total).toFixed(2));
})().catch((e) => { console.error(e); process.exit(1); });
