'use strict';
// Machine checks per frame: safe area, overflow, text overlap, digits only from claims,
// only token colors / type sizes / weights, and ink coverage (negative space).
// Usage: node render/check.js            -> out/checks.json
const fs = require('fs');
const path = require('path');
require('./build-data');
const { launch, openPage, paint } = require('./page');

const TOKENS = ['#0E1116', '#171B22', '#F2F4F7', '#9AA4B2', '#4C8DFF', '#F2B441', '#3FBF7F', '#E5484D', '#2A303B'];

async function inspect(page) {
  return page.evaluate((TOKENS) => {
    const hex2rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
    const okColors = new Set(TOKENS.map(hex2rgb).concat(['rgba(0, 0, 0, 0)', 'none']));
    const SAFE = { l: 96, t: 96, r: 1824, b: 984 };
    const scene = document.getElementById('scene');
    const issues = [];
    const boxes = [];
    // text containers
    const texts = [...scene.querySelectorAll('.t, .cell')].filter((e) => e.textContent.trim());
    for (const el of texts) {
      // measure the text itself, not the (possibly wider) container
      const r = document.createRange(); r.selectNodeContents(el);
      const rects = [...r.getClientRects()].filter((q) => q.width > 0);
      const rb = rects.reduce((a, q) => ({ l: Math.min(a.l, q.left), t: Math.min(a.t, q.top), r: Math.max(a.r, q.right), b: Math.max(a.b, q.bottom) }), { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
      const label = el.textContent.trim().slice(0, 40);
      if (rb.l < SAFE.l - 2 || rb.t < SAFE.t - 2 || rb.r > SAFE.r + 2 || rb.b > SAFE.b + 2) issues.push({ kind: 'outside-safe-area', label, box: rb });
      if (el.classList.contains('cell') && el.scrollWidth > el.clientWidth + 1) issues.push({ kind: 'overflow', label });
      const cb = el.getBoundingClientRect();
      if (el.classList.contains('cell') && (rb.l < cb.left - 1 || rb.r > cb.right + 1)) issues.push({ kind: 'cell-clip', label });
      boxes.push({ label, ...rb });
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ox > 2 && oy > 2) issues.push({ kind: 'text-overlap', a: a.label, b: b.label });
    }
    // digits must live inside claim spans (.n)
    const walker = document.createTreeWalker(scene, NodeFilter.SHOW_TEXT);
    let n; const stray = [];
    while ((n = walker.nextNode())) if (/\d/.test(n.nodeValue) && !n.parentElement.closest('.n')) stray.push(n.nodeValue.trim());
    stray.forEach((s) => issues.push({ kind: 'number-not-from-claim', text: s }));
    // tokens
    const sizes = new Set(), weights = new Set(), colors = new Set();
    for (const el of scene.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.nodeValue.trim());
      const isSvg = el instanceof SVGElement;
      if (isSvg && !['path', 'rect', 'circle', 'line'].includes(el.tagName)) continue;
      const props = isSvg ? (el.tagName === 'line' ? ['stroke'] : ['fill', 'stroke']) : ['color', 'background-color'];
      if (!isSvg && parseFloat(cs.borderTopWidth) > 0) props.push('border-top-color');
      for (const p of props) {
        let v = cs.getPropertyValue(p);
        if (p === 'color' && !hasText) continue;
        if (v.startsWith('url(')) continue;
        colors.add(v);
        if (!okColors.has(v)) issues.push({ kind: 'off-token-color', prop: p, value: v, tag: el.tagName });
      }
      if (hasText) {
        sizes.add(cs.fontSize); weights.add(cs.fontWeight);
        if (!['128px', '48px', '28px'].includes(cs.fontSize)) issues.push({ kind: 'off-token-size', value: cs.fontSize, text: el.textContent.slice(0, 30) });
        if (!['400', '600', '700'].includes(cs.fontWeight)) issues.push({ kind: 'off-token-weight', value: cs.fontWeight });
        if (!/Inter/.test(cs.fontFamily)) issues.push({ kind: 'off-token-font', value: cs.fontFamily });
      }
    }
    // chart geometry inside safe area
    for (const g of scene.querySelectorAll('path, rect, line, circle')) {
      const b = g.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      if (b.left < SAFE.l - 10 || b.top < SAFE.t - 10 || b.right > SAFE.r + 10 || b.bottom > SAFE.b + 10) issues.push({ kind: 'graphic-outside-safe-area', tag: g.tagName });
    }
    const hier = { l1: scene.querySelectorAll('.l1').length, l2: scene.querySelectorAll('.l2, .l2b').length, l3: scene.querySelectorAll('.l3, .l3s, .cell').length };
    return { issues, sizes: [...sizes], weights: [...weights], colors: [...colors], hierarchy: hier, textBoxes: boxes.length };
  }, TOKENS);
}

async function coverage(page) {
  // share of pixels that differ visibly from the background (lower = more negative space)
  const buf = await page.screenshot({ type: 'png' });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 480, 270);
    const d = x.getImageData(0, 0, 480, 270).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 14) + Math.abs(d[i + 1] - 17) + Math.abs(d[i + 2] - 22) > 60) ink++;
    return +(ink / (480 * 270)).toFixed(4);
  }, buf.toString('base64'));
}

async function main() {
  const b = await launch(); const p = await openPage(b);
  const scenes = await p.evaluate(() => window.SEG.SCENES);
  const report = { generated: new Date().toISOString(), holdFrames: [], videoSamples: { checked: 0, issues: [] } };
  for (const ds of ['normal', 'extreme', 'missing']) {
    for (const s of scenes) {
      await paint(p, s.start + s.hold, ds);
      const r = await inspect(p);
      r.coverage = await coverage(p);
      report.holdFrames.push({ dataset: ds, scene: s.id, t: s.start + s.hold, ...r });
    }
  }
  // every 1/3 s through the normal video: overflow/overlap/number/token checks while things move
  const total = await p.evaluate(() => window.SEG.TOTAL);
  for (let f = 0; f < total * 30; f += 10) {
    await paint(p, f / 30, 'normal');
    const r = await inspect(p);
    report.videoSamples.checked++;
    // mid-animation overlaps of entering text are expected to be transient; keep all others
    r.issues.forEach((i) => report.videoSamples.issues.push({ frame: f, ...i }));
  }
  await b.close();
  const outDir = path.join(__dirname, '..', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'checks.json'), JSON.stringify(report, null, 1));
  const bad = report.holdFrames.filter((h) => h.issues.length);
  for (const h of report.holdFrames) console.log(`${h.dataset.padEnd(8)} ${h.scene.padEnd(8)} issues=${h.issues.length} coverage=${h.coverage} hier=${JSON.stringify(h.hierarchy)}`);
  bad.forEach((h) => console.log(h.dataset, h.scene, JSON.stringify(h.issues.slice(0, 5))));
  console.log('video samples', report.videoSamples.checked, 'issues', report.videoSamples.issues.length);
  const kinds = {}; report.videoSamples.issues.forEach((i) => { kinds[i.kind] = (kinds[i.kind] || 0) + 1; });
  console.log(kinds, JSON.stringify(report.videoSamples.issues.slice(0, 4)));
  if (bad.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(1); });
