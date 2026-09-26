'use strict';
// Page sampler: drives the render page through the contract (window.CHECKS), evaluates the frame rules and writes <root>/out/checks/page.json.
//   node checks/page/sampler.js <root> [--step 3] [--pixel-step 6] [--scenes a,b]
// Object rules every `step` frames (0.1 s); pixel rules every `pixel-step` frames (0.2 s) on the page's layer masks and on the decoded video frame.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const R = require('./objrules');
const P = require('./pixels');

const FPS = 30, DT = 0.1, SPLIT_MIN_RUN = 1.0, SPLIT_MAX = 0.6;
const SAFE = [96, 54, 1824, 1026]; // 90% action/title safe area
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.resolve(args[0] || '.');
const STEP = +opt('step', 3), PSTEP = +opt('pixel-step', 6);
const ONLY = opt('scenes', null) ? new Set(opt('scenes').split(',')) : null;
const J = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// video frames (rgb24) every PSTEP frames, read sequentially from ffmpeg
function videoReader(file, every) {
  const w = 1920, h = 1080, size = w * h * 3;
  const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select='not(mod(n\\,${every}))'`, '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
  let chunks = [], have = 0, done = false, waiters = [], idx = -1;
  ff.stdout.on('data', (c) => { chunks.push(c); have += c.length; ff.stdout.pause(); flush(); });
  ff.stdout.on('end', () => { done = true; flush(); });
  function flush() {
    while (waiters.length && (have >= size || done)) {
      if (have < size) { waiters.shift()(null); continue; }
      const all = Buffer.concat(chunks); const f = all.subarray(0, size);
      chunks = [all.subarray(size)]; have -= size;
      waiters.shift()(Buffer.from(f));
    }
    if (have < size * 2 && !done) ff.stdout.resume();
  }
  return {
    // frame number n (multiple of every)
    async get(n) {
      let f = null;
      while (idx < n / every) { f = await new Promise((res) => { waiters.push(res); flush(); }); idx++; if (!f) return null; }
      return f;
    },
    close() { try { ff.kill(); } catch (e) { /* ignore */ } },
  };
}

function sceneWindow(scenes) { return (t) => scenes.find((s) => t >= s.start && t < s.start + s.dur) || scenes[scenes.length - 1]; }

async function run() {
  const t0 = Date.now();
  const tl = J('out/timeline.json');
  const claimsArr = J('out/claims.json').claims;
  const claims = Object.fromEntries(claimsArr.map((c) => [c.claimId, c]));
  const tokens = J('design/tokens.json');
  const pageCfg = J('out/page.json');
  const illustrative = claimsArr.filter((c) => c.illustrative).map((c) => c.claimId);
  const scenes = tl.scenes.map((s) => ({ ...s, move: s.move || 0, allowed: s.panels || ['*'] }));
  const sceneAt = sceneWindow(scenes);
  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const url = /^[a-z]+:/.test(pageCfg.url) ? pageCfg.url : 'file://' + path.join(ROOT, pageCfg.url);
  await page.goto(url);
  await page.evaluate(async () => { await document.fonts.ready; });
  if (pageCfg.ready) await page.evaluate(pageCfg.ready);
  if (pageCfg.shim) await page.addScriptTag({ path: path.isAbsolute(pageCfg.shim) ? pageCfg.shim : path.join(ROOT, pageCfg.shim) });
  const seek = (t) => page.evaluate((t) => window.CHECKS.seek(t), t);
  const objects = () => page.evaluate(() => window.CHECKS.objects());
  const layer = (n, ids) => page.evaluate(([n, ids]) => window.CHECKS.layer(n, ids), [n, ids || []]);
  const shotMask = async (n, ids) => { await layer(n, ids); const buf = await page.screenshot({ omitBackground: true, type: 'png' }); await layer('all'); return P.alphaMask(P.decodePNG(buf)); };
  const video = videoReader(path.join(ROOT, 'out/video.mp4'), PSTEP);

  const total = tl.total, frames = Math.round(total * FPS);
  const per = Object.fromEntries(scenes.map((s) => [s.id, { samples: 0, l1: [], issues: {}, examples: {} }]));
  const add = (sid, rid, ex) => { const P_ = per[sid]; P_.issues[rid] = (P_.issues[rid] || 0) + 1; ((P_.examples[rid] ||= []).length < 3) && P_.examples[rid].push(ex); };
  const textTrack = [], yearsTrack = [];
  let lastTextSig = '';
  const claimScenes = {}, claimFirst = {}, claimRoles = {}, claimFinal = {};
  const orphan = [], charObs = {}, posRows = [], timeBad = [];
  let s08Without = 0, s08Lag = 0; const s08Ex = []; const s09Ex = []; let s09Missing = 0;
  const badgeFirst = {}, illFirst = {};
  const px = { collisions: [], transientCollisions: 0, safe: [], contrast: [], small: [], worstContrast: null, samples: 0 };
  let splitRun = []; const splitRuns = [];
  const prevVisible = new Set();

  function visibleClaims(objs) {
    const out = [];
    for (const t of objs) if (t.kind === 'text' && t.opacity > 0.5) for (const sp of t.claims || []) if (sp.opacity > 0.5 && R.onFrame({ l: sp.box[0], t: sp.box[1], r: sp.box[2], b: sp.box[3] })) out.push({ sp, t });
    return out;
  }
  function recordClaims(objs, t, s) {
    for (const { sp, t: tx } of visibleClaims(objs)) {
      (claimScenes[sp.id] ||= new Set()).add(s.id);
      if (claimFirst[sp.id] === undefined || t < claimFirst[sp.id]) claimFirst[sp.id] = t;
      (claimRoles[sp.id] ||= new Set()).add(tx.role);
      const c = claims[sp.id];
      const fk = sp.id + '|' + s.id;
      if (c && !sp.roll && sp.text === String(c.display) && (claimFinal[fk] === undefined || t < claimFinal[fk])) claimFinal[fk] = t;
    }
  }
  // S08 at one frame; also first-visible times for the lag
  function s08(objs, t, s) {
    const st = R.illustrativeState(objs, { illustrative });
    if (st.badge && badgeFirst[s.id] === undefined) badgeFirst[s.id] = t;
    for (const id of st.shown) if (illFirst[s.id + '|' + id] === undefined) illFirst[s.id + '|' + id] = t;
    if (st.shown.length && !st.badge) { s08Without++; if (s08Ex.length < 10) s08Ex.push({ t: +t.toFixed(3), scene: s.id, claims: st.shown }); }
  }

  for (let f = 0; f < frames; f += STEP) {
    const t = f / FPS, s = sceneAt(t), PS = per[s.id];
    if (ONLY && !ONLY.has(s.id)) continue;
    if (process.env.K_PROGRESS && (f / STEP) % 50 === 0) console.error(`t=${t.toFixed(1)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    const inTransition = t - s.start < s.move;
    await seek(t);
    let objs = await objects();
    // frame-accurate refinement: when something new became visible since the last sample, look at the skipped frames too
    const vis = new Set(visibleClaims(objs).map((x) => x.sp.id + '|' + x.sp.text));
    const newly = [...vis].some((k) => !prevVisible.has(k));
    if (newly && f > 0) {
      for (let g = f - STEP + 1; g < f; g++) {
        const tg = g / FPS, sg = sceneAt(tg);
        await seek(tg);
        const og = await objects();
        recordClaims(og, tg, sg); s08(og, tg, sg);
      }
      await seek(t);
      objs = await objects();
    }
    prevVisible.clear(); vis.forEach((k) => prevVisible.add(k));
    const ctx = { tokens, allowed: s.allowed, inTransition, illustrative, claims, scene: s };
    PS.samples++;
    const issues = [...R.sceneLeak(objs, ctx), ...R.bgOverData(objs), ...(inTransition ? [] : R.unlabelledCurve(objs)), ...(inTransition ? [] : R.axisAnchors(objs, ctx)),
      ...R.greyEmphasis(objs, ctx), ...R.numberColour(objs, ctx), ...R.barProportion(objs, ctx), ...R.offToken(objs, ctx)];
    for (const i of issues) add(s.id, i.rule, { t: +t.toFixed(2), ...i });
    PS.l1.push(R.level1Count(objs));
    if (!inTransition) for (const r of R.level1Position(objs, ctx)) posRows.push({ t: +t.toFixed(2), scene: s.id, ...r });
    recordClaims(objs, t, s);
    s08(objs, t, s);
    const mb = R.moneyBasis(objs, ctx);
    if (mb.length) { s09Missing++; if (s09Ex.length < 10) s09Ex.push({ t: +t.toFixed(2), scene: s.id, ...mb[0] }); }
    for (const o of R.orphanNumbers(objs)) if (orphan.length < 200 && !orphan.some((x) => x.text === o.text)) orphan.push({ t: +t.toFixed(2), scene: s.id, ...o });
    const ch = R.characters(objs);
    for (const [k, v] of Object.entries(ch)) { const c = charObs[k] ||= { xs: [], colours: {}, shapes: {} }; v.colours.forEach((x) => { c.colours[x] = (c.colours[x] || 0) + 1; }); v.shapes.forEach((x) => { c.shapes[x] = (c.shapes[x] || 0) + 1; }); }
    if (ch['1966'] && ch.mirror) (charObs.sides ||= []).push(Math.sign(Math.min(...ch['1966'].xs) - Math.min(...ch.mirror.xs)) * (Math.abs(Math.min(...ch['1966'].xs) - Math.min(...ch.mirror.xs)) >= 20 ? 1 : 0));
    const tb = R.timeOrder(objs); if (tb.length && timeBad.length < 10) timeBad.push({ t: +t.toFixed(2), ...tb[0] });
    const years = [...new Set(objs.filter((o) => o.year != null && o.opacity > 0.5 && R.onFrame(R.B(o))).map((o) => +o.year))];
    if (years.length) yearsTrack.push({ t: +t.toFixed(2), scene: s.id, years });
    const items = objs.filter((o) => o.kind === 'text' && o.opacity > 0.5 && R.onFrame(R.B(o))).map((o) => ({ tid: o.tid, role: o.role, text: o.text }));
    const sig = JSON.stringify(items);
    if (sig !== lastTextSig) { textTrack.push({ t: +t.toFixed(2), scene: s.id, items }); lastTextSig = sig; }

    // ---- pixel rules --------------------------------------------------------------------------
    if (f % PSTEP === 0) {
      const vf = await video.get(f);
      const T = objs.filter((o) => o.kind === 'text' && o.opacity > 0.5 && R.onFrame(R.B(o)));
      if (T.length) {
        px.samples++;
        const tm = await shotMask('text'), gm = await shotMask('graphics');
        const td = P.dilate(tm, 2);
        // V11 glyph/badge ink vs graphic ink (2 px clearance)
        for (const o of T) {
          const box = [o.box[0] - 3, o.box[1] - 3, o.box[2] + 3, o.box[3] + 3];
          const n = P.overlapIn(td, gm, box);
          if (n >= 4) { if (inTransition) px.transientCollisions++; else px.collisions.push({ t: +t.toFixed(2), scene: s.id, tid: o.tid, role: o.role, with: 'graphics', pixels: n }); }
        }
        // V11 text vs text (pairs whose boxes touch; nested badge/parent pairs excluded)
        for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
          const a = T[i], b = T[j];
          if (a.parent === b.id || b.parent === a.id) continue;
          if (R.gapBetween(R.inflate(R.B(a), 3), R.B(b)) > 0) continue;
          const ma = P.dilate(await shotMask('only', [a.id]), 2), mb2 = await shotMask('only', [b.id]);
          const n = P.overlapIn(ma, mb2, [Math.min(a.box[0], b.box[0]) - 3, Math.min(a.box[1], b.box[1]) - 3, Math.max(a.box[2], b.box[2]) + 3, Math.max(a.box[3], b.box[3]) + 3]);
          if (n >= 4) { if (inTransition) px.transientCollisions++; else px.collisions.push({ t: +t.toFixed(2), scene: s.id, tid: a.tid, role: a.role, with: 'text:' + b.tid, pixels: n }); }
        }
        if (!inTransition) {
          // V03 safe area: text ink outside the 90% rectangle
          for (const o of T) {
            const ib = P.inkBox(tm, [o.box[0] - 2, o.box[1] - 2, o.box[2] + 2, o.box[3] + 2]);
            if (ib && (ib[0] < SAFE[0] || ib[1] < SAFE[1] || ib[2] > SAFE[2] || ib[3] > SAFE[3])) px.safe.push({ t: +t.toFixed(2), scene: s.id, tid: o.tid, ink: ib });
          }
          // V08 contrast and C14 legibility at 25%, measured on the delivered video frame
          if (vf) {
            const needGlyph = T.some((o) => o.role === 'badge' || o.background);
            const gl = needGlyph ? await shotMask('glyph') : tm;
            const core = P.erode(gl, 1), ring1 = P.dilate(tm, 1), ring4 = P.dilate(tm, 4);
            const ring = { w: tm.w, h: tm.h, m: ring4.m.map((v, i) => v && !ring1.m[i] ? 1 : 0) };
            for (const o of T) {
              if (o.opacity < 0.95) continue;
              const box = [o.box[0] - 5, o.box[1] - 5, o.box[2] + 5, o.box[3] + 5];
              if (box[0] < 0 || box[1] < 0 || box[2] > 1920 || box[3] > 1080) continue;
              const hasCore = P.countIn(core, o.box) >= 12;
              const fg = P.medianColour(vf, 1920, hasCore ? core : gl, o.box);
              const inner = o.role === 'badge' ? { w: tm.w, h: tm.h, m: tm.m.map((v, i) => v && !gl.m[i] ? 1 : 0) } : ring;
              const bg = P.medianColour(vf, 1920, inner, box);
              if (!fg || !bg) continue;
              const cr = (Math.max(P.relLum(...fg), P.relLum(...bg)) + 0.05) / (Math.min(P.relLum(...fg), P.relLum(...bg)) + 0.05);
              if (px.worstContrast === null || cr < px.worstContrast.cr) px.worstContrast = { t: +t.toFixed(2), tid: o.tid, cr: +cr.toFixed(2), fg, bg };
              if (cr < 4.5) px.contrast.push({ t: +t.toFixed(2), scene: s.id, tid: o.tid, cr: +cr.toFixed(2), fg, bg });
              // C14: font ≥ 28 px and contrast ≥ 3:1 inside the box on the 25% downscale
              const q = [Math.floor(o.box[0] / 4), Math.floor(o.box[1] / 4), Math.ceil(o.box[2] / 4), Math.ceil(o.box[3] / 4)];
              const L = [];
              for (let y = q[1]; y < q[3]; y++) for (let x = q[0]; x < q[2]; x++) {
                let r = 0, g = 0, b = 0;
                for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) { const i = ((y * 4 + dy) * 1920 + x * 4 + dx) * 3; r += vf[i]; g += vf[i + 1]; b += vf[i + 2]; }
                L.push(P.relLum(r / 16, g / 16, b / 16));
              }
              L.sort((a, b) => a - b);
              const c25 = L.length ? (L[Math.floor(L.length * 0.95)] + 0.05) / (L[Math.floor(L.length * 0.05)] + 0.05) : 0;
              if ((o.fontPx || 0) < 28 || c25 < 3) px.small.push({ t: +t.toFixed(2), scene: s.id, tid: o.tid, fontPx: o.fontPx, contrastAt25: +c25.toFixed(2) });
            }
          }
        }
      }
    }

    // ---- C12 split view: same camera, 0.1 s later ------------------------------------------------
    let split = null;
    if (!inTransition && t + DT < s.start + s.dur) {
      const snap = (os) => os.filter((o) => !(o.kind === 'shape' && o.role === 'bg') && o.opacity > 0.05 && R.onFrame(R.B(o), 1)).map((o) => ({ sig: o.sig + '|' + o.opacity.toFixed(3), key: o.key, box: o.box }));
      const a0 = snap(objs);
      await page.evaluate((t) => window.CHECKS.freeze(t), t);
      await seek(t + DT);
      const a1 = snap(await objects());
      await page.evaluate(() => window.CHECKS.freeze(null));
      const count = (arr) => { const m = new Map(); for (const x of arr) m.set(x.sig, (m.get(x.sig) || 0) + 1); return m; };
      const ca = count(a0), cb = count(a1);
      const gone = a0.filter((x) => (cb.get(x.sig) || 0) < ca.get(x.sig)), came = a1.filter((x) => (ca.get(x.sig) || 0) < cb.get(x.sig));
      const changed = [], pool = [...gone];
      for (const n of came) { const i = pool.findIndex((o) => o.key === n.key); if (i < 0) { changed.push(n); continue; } const o = pool.splice(i, 1)[0]; changed.push({ box: diffBox(o.box, n.box) }); }
      changed.push(...pool);
      if (changed.length) {
        const bb = changed.reduce((u, x) => [Math.min(u[0], x.box[0]), Math.min(u[1], x.box[1]), Math.max(u[2], x.box[2]), Math.max(u[3], x.box[3])], [1e9, 1e9, -1e9, -1e9]);
        split = { w: +((Math.min(bb[2], 1920) - Math.max(bb[0], 0)) / 1920).toFixed(3), h: +((Math.min(bb[3], 1080) - Math.max(bb[1], 0)) / 1080).toFixed(3) };
      }
    }
    const isSplit = split && (split.w > SPLIT_MAX || split.h > SPLIT_MAX);
    if (isSplit && (!splitRun.length || splitRun[0].scene === s.id)) splitRun.push({ t, scene: s.id, ...split });
    else { if (splitRun.length) splitRuns.push(splitRun); splitRun = isSplit ? [{ t, scene: s.id, ...split }] : []; }
  }
  if (splitRun.length) splitRuns.push(splitRun);
  video.close();
  await browser.close();

  // ---- aggregate --------------------------------------------------------------------------------
  const rules = {};
  const sum = (rid) => { const sc = Object.entries(per).filter(([, P_]) => P_.issues[rid]); return { framesFlagged: sc.reduce((a, [, P_]) => a + P_.issues[rid], 0), scenes: sc.map(([id, P_]) => `${id} (${P_.issues[rid]})`), examples: sc.flatMap(([, P_]) => P_.examples[rid]).slice(0, 5) }; };
  for (const rid of ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C15']) rules[rid] = sum(rid);
  const l1 = scenes.filter((s) => per[s.id].samples).map((s) => { const xs = per[s.id].l1; const one = xs.filter((n) => n === 1).length / Math.max(1, xs.length); return { id: s.id, chart: !!s.chart, dur: s.dur, one, max: Math.max(0, ...xs) }; });
  rules.C10 = { failing: l1.filter((r) => r.chart && r.dur >= 2 && !(r.one >= 0.5 && r.max <= 1)).map((r) => `${r.id} (one l1 in ${Math.round(r.one * 100)}%, max ${r.max})`) };
  rules.C12 = { violations: splitRuns.map((r) => ({ scene: r[0].scene, start: +r[0].t.toFixed(2), durationS: +(r.length * STEP / FPS).toFixed(2), maxW: Math.max(...r.map((x) => x.w)), maxH: Math.max(...r.map((x) => x.h)) })).filter((v) => v.durationS >= SPLIT_MIN_RUN) };
  let maxLag = 0; const lagEx = [];
  for (const [k, ti] of Object.entries(illFirst)) { const sid = k.split('|')[0]; const tb_ = badgeFirst[sid]; const lag = tb_ === undefined ? 999 : Math.round((tb_ - ti) * FPS); if (lag > maxLag) maxLag = lag; if (lag > 0 && lagEx.length < 10) lagEx.push({ key: k, claimFirst: ti, badgeFirst: tb_ ?? null, lagFrames: lag }); }
  rules.S08 = { framesWithout: s08Without, maxLagFrames: maxLag, examples: [...s08Ex, ...lagEx] };
  rules.S09 = { framesMissing: s09Missing, examples: s09Ex };
  rules.V02 = { samples: posRows.length, ok: posRows.filter((r) => r.ok).length, examples: posRows.filter((r) => !r.ok).slice(0, 8) };
  // one example per distinct (scene, text, other) — first time seen — so the report names every offender
  const distinct = (xs, key, n = 40) => { const seen = new Map(); for (const x of xs) { const k = key(x); if (!seen.has(k)) seen.set(k, { ...x, samples: 0 }); seen.get(k).samples++; } return [...seen.values()].slice(0, n); };
  rules.V03 = { violations: px.safe.length, examples: distinct(px.safe, (x) => x.scene + '|' + x.tid) };
  rules.V08 = { violations: px.contrast.length, worst: px.worstContrast, examples: distinct(px.contrast, (x) => x.scene + '|' + x.tid) };
  rules.V11 = { violations: px.collisions.length, transientDuringMoves: px.transientCollisions, byRole: px.collisions.reduce((m, c) => { m[c.role] = (m[c.role] || 0) + 1; return m; }, {}), examples: distinct(px.collisions, (x) => x.scene + '|' + x.tid + '|' + x.with) };
  rules.C14 = { violations: px.small.length, examples: distinct(px.small, (x) => x.scene + '|' + x.tid) };
  const mode = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1])[0];
  const characters = {};
  for (const k of ['1966', 'mirror']) if (charObs[k]) { const mc = mode(charObs[k].colours), ms = mode(charObs[k].shapes); const n = Object.values(charObs[k].colours).reduce((a, b) => a + b, 0); const ns = Object.values(charObs[k].shapes).reduce((a, b) => a + b, 0);
    characters[k] = { mainColour: mc && mc[0], colourShare: mc ? mc[1] / n : 0, mainShape: ms && ms[0], shapeShare: ms ? ms[1] / ns : 0 }; }
  const sides = charObs.sides || [];
  rules.V04 = { characters, sideSamples: sides.filter((x) => x).length, sideSigns: [...new Set(sides.filter((x) => x))], timeOrderViolations: timeBad };
  const out = {
    root: ROOT, step: STEP, pixelStep: PSTEP, samples: Object.values(per).reduce((a, p) => a + p.samples, 0), pixelSamples: px.samples, seconds: +((Date.now() - t0) / 1000).toFixed(1),
    rules, characters,
    textTrack, yearsTrack, orphanNumbers: orphan,
    claimScenes: Object.fromEntries(Object.entries(claimScenes).map(([k, v]) => [k, [...v]])), claimFirst, claimRoles: Object.fromEntries(Object.entries(claimRoles).map(([k, v]) => [k, [...v]])), claimFinal,
    scenes: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, { samples: v.samples, issues: v.issues }])),
  };
  fs.mkdirSync(path.join(ROOT, 'out', 'checks'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'checks', ONLY ? 'page-partial.json' : 'page.json'), JSON.stringify(out));
  console.log(JSON.stringify({ seconds: out.seconds, samples: out.samples, pixelSamples: out.pixelSamples, summary: Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, v.framesFlagged ?? v.violations ?? v.framesWithout ?? v.failing?.length ?? ''])) }));
}

function diffBox(a, b) {
  const same = (i) => Math.abs(a[i] - b[i]) < 0.5;
  const x = same(0) && !same(2) ? [Math.min(a[2], b[2]), Math.max(a[2], b[2])] : same(2) && !same(0) ? [Math.min(a[0], b[0]), Math.max(a[0], b[0])] : [Math.min(a[0], b[0]), Math.max(a[2], b[2])];
  const y = same(1) && !same(3) ? [Math.min(a[3], b[3]), Math.max(a[3], b[3])] : same(3) && !same(1) ? [Math.min(a[1], b[1]), Math.max(a[1], b[1])] : [Math.min(a[1], b[1]), Math.max(a[3], b[3])];
  const onlyX = same(1) && same(3), onlyY = same(0) && same(2);
  return [onlyY ? Math.min(a[0], b[0]) : x[0], onlyX ? Math.min(a[1], b[1]) : y[0], onlyY ? Math.max(a[2], b[2]) : x[1], onlyX ? Math.max(a[3], b[3]) : y[1]];
}

if (require.main === module) run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
module.exports = { diffBox };
