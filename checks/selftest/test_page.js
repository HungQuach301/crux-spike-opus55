'use strict';
// Self-test of the frame rules (page sampler + their Python verdicts): one clean fixture that every frame rule must pass,
// and one fixture per rule (or per variant) that the rule must fail. Fixture pages implement the page contract natively
// (checks/selftest/fixture-page.html); each fixture video is rendered from its page so the pixel rules see real frames.
//   node checks/selftest/test_page.js [--keep] [--case name]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const HERE = __dirname, CHECKS = path.join(HERE, '..');
const FIX = path.join(HERE, 'fixture-page.html');
const TOK = { bg: '#0E1116', surface: '#171B22', ink: '#F2F4F7', muted: '#9AA4B2', accent: '#4C8DFF', warn: '#F2B441', pos: '#3FBF7F', neg: '#E5484D', grid: '#2A303B' };
const TOKENS = { colors: TOK, series: { A: TOK.warn, B: TOK.accent }, seriesOf: { A: TOK.warn, B: TOK.accent } };
const DUR = 2.1;

// ---- the clean frame ------------------------------------------------------------------------------
const curve = 'M 300 700 L 430 690 L 560 660 L 690 640 L 820 600 L 950 610 L 1080 560 L 1210 540 L 1340 520 L 1470 470 L 1600 430';
function good() {
  return [
    { type: 'rect', x: 0, y: 0, w: 1920, h: 1080, fill: TOK.bg, role: 'bg' },
    { type: 'line', x1: 300, y1: 800, x2: 1600, y2: 800, stroke: TOK.grid, width: 3, role: 'axis', chart: 'c', panel: 'p' },
    { type: 'path', d: curve, stroke: TOK.warn, width: 4, role: 'series', chart: 'c', panel: 'p', label: 'lab' },
    { type: 'text', tid: 'lab', text: '1966 retiree', x: 1330, y: 360, size: 32, color: TOK.warn, role: 'label', claims: [{ id: 'y1966', text: '1966' }] },
    { type: 'text', tid: 'y0', text: '1966', x: 270, y: 830, size: 32, color: TOK.muted, role: 'axis-label', anchor: 'c', year: 1966, claims: [{ id: 'y1966', text: '1966' }] },
    { type: 'text', tid: 'y1', text: '1995', x: 1560, y: 830, size: 32, color: TOK.muted, role: 'axis-label', anchor: 'c', year: 1995, claims: [{ id: 'y1995', text: '1995' }] },
    { type: 'text', tid: 'head', text: 'Same average', x: 640, y: 360, size: 64, color: TOK.ink, level: 1, center: true },
    { type: 'text', tid: 'money', text: 'Mirror ends with $1,200 real', x: 700, y: 900, size: 36, color: TOK.ink, claims: [{ id: 'm_end', text: '$1,200' }] },
    { type: 'text', tid: 'ill', text: 'ILLUSTRATIVE', badge: true, bg: TOK.warn, color: TOK.bg, x: 1450, y: 900, size: 28 },
    { type: 'circle', cx: 500, cy: 200, r: 18, fill: TOK.warn, char: '1966', shape: 'circle', panel: 'p' },
    { type: 'rect', x: 1282, y: 182, w: 36, h: 36, fill: TOK.accent, char: 'mirror', shape: 'square', panel: 'p' },
  ];
}
const CLAIMS = [
  { claimId: 'y1966', value: 1966, display: '1966', formula: 'first year of the sequence', source: { id: 'damodaran' }, dataYear: 1966, role: 'axis' },
  { claimId: 'y1995', value: 1995, display: '1995', formula: 'last year of the sequence', source: { id: 'damodaran' }, dataYear: 1995, role: 'axis' },
  { claimId: 'm_end', value: 1200, display: '$1,200', formula: 'mirror path end balance', illustrative: true, basis: 'real' },
];
const mod = (fn) => { const e = good(); fn(e); return e; };
const find = (e, tid) => e.find((x) => x.tid === tid);

const CASES = {
  good: { els: good(), expect: { PASS: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C10', 'C12', 'C14', 'C15', 'V02', 'V03', 'V04', 'V08', 'V11', 'S08', 'S09', 'S07'] } },
  'V11-text-on-line': { els: mod((e) => { Object.assign(find(e, 'money'), { y: 780 }); find(e, 'money').x = 400; }), expect: { FAIL: ['V11'] } },
  'V11-badge-on-series': { els: mod((e) => Object.assign(find(e, 'ill'), { x: 900, y: 590 })), expect: { FAIL: ['V11'] } },
  'V11-axis-label-on-axis': { els: mod((e) => Object.assign(find(e, 'y1'), { y: 785 })), expect: { FAIL: ['V11'] } },
  'V11-text-on-text': { els: mod((e) => e.push({ type: 'text', tid: 'over', text: 'overlap', x: 720, y: 905, size: 36, color: TOK.ink })), expect: { FAIL: ['V11'] } },
  'V03-outside-safe': { els: mod((e) => Object.assign(find(e, 'money'), { x: 20 })), expect: { FAIL: ['V03'] } },
  'V08-low-contrast': { els: mod((e) => e.push({ type: 'text', tid: 'dim', text: 'hard to read', x: 700, y: 980, size: 32, color: TOK.grid })), expect: { FAIL: ['V08'] } },
  'C14-too-small': { els: mod((e) => e.push({ type: 'text', tid: 'tiny', text: 'small print', x: 700, y: 980, size: 20, color: TOK.ink })), expect: { FAIL: ['C14'] } },
  'C01-scene-leak': { els: mod((e) => e.push({ type: 'rect', x: 1700, y: 300, w: 60, h: 60, fill: TOK.pos, panel: 'q' })), expect: { FAIL: ['C01'] } },
  'C02-bg-over-data': { els: mod((e) => e.push({ type: 'rect', x: 250, y: 400, w: 700, h: 380, fill: TOK.surface, role: 'bg' })), expect: { FAIL: ['C02'] } },
  'C03-unlabelled-curve': { els: mod((e) => e.push({ type: 'path', d: 'M 950 540 C 1000 500 1100 580 1150 540', stroke: TOK.accent, width: 4, panel: 'p' })), expect: { FAIL: ['C03'] } },
  'C04-no-anchors': { els: mod((e) => { delete find(e, 'y0').anchor; delete find(e, 'y1').anchor; }), expect: { FAIL: ['C04'] } },
  'C05-weak-emphasis': { els: mod((e) => { find(e, 'head').color = TOK.accent; }), expect: { FAIL: ['C05'] } },
  'C06-number-colour': { els: mod((e) => e.push({ type: 'text', tid: 'serA', text: '7%', x: 1000, y: 250, size: 36, color: TOK.accent, series: 'A', claims: [{ id: 'y1966', text: '7%' }] })), expect: { FAIL: ['C06'] } },
  'C07-bar-cropped': { els: mod((e) => e.push({ type: 'rect', x: 1500, y: 950, w: 600, h: 30, fill: TOK.accent, role: 'bar', orient: 'h', panel: 'p' })), expect: { FAIL: ['C07'] } },
  'C10-two-level1': { els: mod((e) => e.push({ type: 'text', tid: 'head2', text: 'Different fate', x: 1280, y: 720, size: 64, color: TOK.ink, level: 1, center: true })), expect: { FAIL: ['C10'] } },
  'C12-split-view': { els: mod((e) => { e.push({ type: 'rect', x: 150, y: 1000, w: 30, h: 30, fill: TOK.pos, panel: 'p', anim: { prop: 'y', from: 980, to: 1040, t0: 0, t1: DUR } });
    e.push({ type: 'rect', x: 1750, y: 1000, w: 30, h: 30, fill: TOK.pos, panel: 'p', anim: { prop: 'y', from: 1040, to: 980, t0: 0, t1: DUR } }); }), expect: { FAIL: ['C12'] } },
  'C15-off-token': { els: mod((e) => { find(e, 'money').color = '#123456'; }), expect: { FAIL: ['C15'] } },
  'S08-no-badge': { els: mod((e) => { e.splice(e.indexOf(find(e, 'ill')), 1); }), expect: { FAIL: ['S08'] } },
  'S08-badge-late': { els: mod((e) => { find(e, 'ill').show = [0.2, 99]; }), expect: { FAIL: ['S08'] } },
  'S09-no-basis': { els: mod((e) => { find(e, 'money').text = 'Mirror ends with $1,200'; }), expect: { FAIL: ['S09'] } },
  'V02-off-thirds': { els: mod((e) => Object.assign(find(e, 'head'), { x: 960, y: 540 })), expect: { FAIL: ['V02'] } },
  'V04-side-swap': { els: mod((e) => { e.find((x) => x.char === '1966').anim = { prop: 'cx', from: 500, to: 1600, t0: 0.9, t1: 1.0 }; }), expect: { FAIL: ['V04'] } },
  'V04-time-reversed': { els: mod((e) => { find(e, 'y0').x = 1560; find(e, 'y1').x = 270; }), expect: { FAIL: ['V04'] } },
  'S07-orphan-number': { els: mod((e) => e.push({ type: 'text', tid: 'orph', text: 'Up 12% since then', x: 700, y: 980, size: 32, color: TOK.ink })), expect: { FAIL: ['S07'] } },
};

function writeRoot(name, els) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kpage-' + name + '-'));
  const w = (rel, o) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), JSON.stringify(o)); };
  w('out/timeline.json', { fps: 30, total: DUR, acts: [{ id: 'act1', start: 0, end: DUR }], scenes: [{ id: 'a', act: 'act1', start: 0, dur: DUR, move: 0, panels: ['p'], chart: true, layout: 'line/single', shot: 'medium' }] });
  w('out/claims.json', { claims: CLAIMS });
  w('out/script.json', { sentences: [] });
  w('design/tokens.json', TOKENS);
  w('out/page.json', { url: 'file://' + FIX + '?spec=' + encodeURIComponent(JSON.stringify({ els })) });
  return root;
}

async function renderVideo(root, els) {
  const b = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await p.goto('file://' + FIX + '?spec=' + encodeURIComponent(JSON.stringify({ els })));
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '30', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', path.join(root, 'out', 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < Math.round(DUR * 30); f++) {
    await p.evaluate((t) => window.CHECKS.seek(t), f / 30);
    ff.stdin.write(await p.screenshot({ type: 'png' }));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
}

async function main() {
  const only = process.argv.includes('--case') ? process.argv[process.argv.indexOf('--case') + 1] : null;
  const results = [];
  for (const [name, c] of Object.entries(CASES)) {
    if (only && name !== only) continue;
    const root = writeRoot(name, c.els);
    if (process.env.K_VERBOSE) console.log('case', name);
    await renderVideo(root, c.els);
    execFileSync('node', [path.join(CHECKS, 'page', 'sampler.js'), root, '--step', '3', '--pixel-step', '3'], { stdio: ['ignore', 'ignore', 'inherit'] });
    const ids = [...(c.expect.PASS || []), ...(c.expect.FAIL || [])];
    execFileSync('python3', [path.join(CHECKS, 'py', 'run.py'), root, '--only', ids.join(',')], { stdio: ['ignore', 'ignore', 'inherit'] });
    const rep = JSON.parse(fs.readFileSync(path.join(root, 'out', 'checks', 'report-partial.json'), 'utf8'));
    const st = Object.fromEntries(rep.results.map((r) => [r.id, r]));
    for (const [want, list] of Object.entries(c.expect)) for (const id of list) {
      const got = st[id] ? st[id].status : 'NOT RUN';
      const ok = got === want;
      results.push({ case: name, rule: id, want, got, ok });
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(24)} ${id} want ${want} got ${got}${ok ? '' : '  ' + JSON.stringify(st[id] && st[id].metrics.filter((m) => !m.pass)).slice(0, 300)}`);
    }
    if (!process.argv.includes('--keep')) fs.rmSync(root, { recursive: true, force: true });
  }
  const bad = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(process.env.K_SELFTEST_OUT || os.tmpdir(), 'selftest-page.json'), JSON.stringify(results, null, 1));
  console.log(`page self-test: ${results.length - bad.length}/${results.length} as expected`);
  process.exit(bad.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
