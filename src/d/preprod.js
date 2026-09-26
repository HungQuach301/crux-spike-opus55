'use strict';
// Test D pre-production from the timeline: colour script, storyboard, cue sheet (spotting), tension map.
// Writes preprod/color-script.{json,png}, preprod/storyboard.{md,png}, out/cues.json, out/tension-map.{json,png}.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { ACTS } = require('./script');
const { SHOTS } = require('./shots');

const ROOT = path.join(__dirname, '..', '..');
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const W = (p, o) => fs.writeFileSync(path.join(ROOT, p), typeof o === 'string' ? o : JSON.stringify(o, null, 1));
const tl = J('out/timeline.json'), script = J('out/script.json'), tokens = J('design/tokens.json').colors, tempo = J('out/tempo-map.json');
const claims = J('out/claims.json').claims;
const sceneById = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));
const actOf = (t) => tl.acts.find((a) => t >= a.start && t < a.end) || tl.acts[tl.acts.length - 1];
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- colour script
// palette per act (all tokens): background tint, key light, accent; act 2 moves early -> storm -> dusk
const PALETTE = {
  'cold-open': { bg: 'bg-cold', key: 'key-light', accent: 'c1966', mood: 'near-black, one warm key from above-left, both lines glowing from one point' },
  ident: { bg: 'bg-cold', key: 'key-light', accent: 'text', mood: 'title in neutral white, short warm flare' },
  act1: { bg: 'bg-act1', key: 'key-light', accent: 'c1966', mood: 'cool slate dawn of 1966; warm key on the cards, cool rim; mirror blue enters at the turn' },
  'act2-early': { bg: 'bg-act2-early', key: 'key-light', accent: 'c1966', mood: 'late-60s warm amber haze; inflation violet creeps in' },
  'act2-storm': { bg: 'bg-act2-storm', key: 'key-light', accent: 'loss', mood: '1973-74 storm: desaturated brown-red, harder key, long shadows' },
  'act2-dusk': { bg: 'bg-act2-dusk', key: 'rim-light', accent: 'cmirror', mood: 'after the 1986 peak: cold blue dusk, the 1966 amber fades to grey at 1991' },
  act3: { bg: 'bg-act3', key: 'rim-light', accent: 'text', mood: 'analytical teal-ink, even soft light over the map; failures in loss red, survivors in gain green' },
  method: { bg: 'bg-method', key: 'key-light', accent: 'text-dim', mood: 'neutral graphite, flat soft light' },
  outro: { bg: 'bg-outro', key: 'key-light', accent: 'c1966', mood: 'warm dawn: both colours side by side, calm' },
};
function paletteKey(sc) {
  if (sc.act !== 'act2') return sc.act;
  const base = sc.id.replace(/-[bc]$/, '');
  const order = ACTS.find((a) => a.id === 'act2').scenes.map((s) => s.id);
  const i = order.indexOf(base);
  if (i < order.indexOf('a2-7374')) return 'act2-early';
  if (i < order.indexOf('a2-rest')) return 'act2-storm';
  return 'act2-dusk';
}
const colorScript = tl.scenes.map((s) => { const p = PALETTE[paletteKey(s)]; return { scene: s.id, start: s.start, dur: s.dur, act: s.act, bg: p.bg, bgHex: tokens[p.bg], key: p.key, accent: p.accent, accentHex: tokens[p.accent], mood: p.mood }; });

// ---------------------------------------------------------------- cue sheet (spotting)
const firstLine = (sc) => script.sentences.find((l) => l.scene === sc);
const sceneStart = (id) => sceneById[id].start;
const bpmAt = (t) => { const a = actOf(t); const b = tempo.bpm[a.id]; return Array.isArray(b) ? +(b[0] + (b[1] - b[0]) * (t - a.start) / (a.end - a.start)).toFixed(1) : b; };
const cueDefs = [
  // [start scene, end scene (exclusive), function, key, layer]
  ['co-lines', 'co-broke', 'cold open: both leitmotifs in unison on one low pad, same notes', 'D minor', 'music'],
  ['co-broke', 'ident', 'the split: 1966 motif descends alone, mirror motif holds; music cuts to silence after "1991"', 'D minor', 'music'],
  ['ident', 'a1-est', 'ident sting: two-note signature, filtered pluck + sub', 'D minor', 'music'],
  ['a1-est', 'a1-mirror-in', 'act 1 theme: 1966 leitmotif (rising 4-note figure, warm Rhodes), light pulse', 'F major', 'music'],
  ['a1-mirror-in', 'a1-avg1966', 'mirror enters: the same figure in retrograde, bell timbre, panned right', 'F major', 'music'],
  ['a1-avg1966', 'a2-est', 'reveal: both motifs meet on one chord; riser into the equal averages, low hit on "Identical"', 'F major', 'music'],
  ['a2-est', 'a2-7374', 'act 2 departure: motifs split into two lanes, harmony drifts to D minor', 'D minor', 'music'],
  ['a2-7374', 'a2-1982', 'storm 1973-74: low strings, filtered noise swell, 1966 motif in minor, slower', 'D minor', 'music'],
  ['a2-1982', 'a2-climb', 'turn 1982: harmonic shift to B-flat major, brighter, but the 1966 motif stays minor', 'Bb major', 'music'],
  ['a2-climb', 'a2-rest', 'accelerando to the 1986 climax: pulse doubles, riser, impact + sub-drop on the gap figure', 'D minor', 'music'],
  ['a2-rest', 'a2-payoff', 'valley: sparse piano; the 1966 motif thins to a single note and stops at 1991 (silence)', 'D minor', 'music'],
  ['a2-payoff', 'a3-est', 'act 2 payoff: mirror motif alone, resolved in F major; music out for the ad break', 'F major', 'music'],
  ['a3-est', 'a3-share', 'act 3 analytical pulse: clean arpeggio, map cells tick on the beat', 'A minor', 'music'],
  ['a3-share', 'a3-limits', 'answer: the first-decade reveal, both motifs quoted in their first four notes, riser + hit', 'A minor', 'music'],
  ['a3-limits', 'method', 'limits: sparse, low, room tone forward', 'A minor', 'music'],
  ['method', 'outro', 'method bed: neutral pad', 'C major', 'music'],
  ['outro', null, 'outro: both leitmotifs together, resolved, fade under the end screen', 'F major', 'music'],
];
const cues = cueDefs.map(([a, b, fn, key, layer]) => {
  const t = sceneStart(a), end = b ? sceneStart(b) : tl.total;
  return { t: +t.toFixed(3), end: +end.toFixed(3), function: fn, key, tempo: bpmAt(t), layer, scene: a };
});
// sound-design layers as cues (R02 counts audio-layer changes)
const sdx = [
  ['co-lines', 'room', 'room tone in: dark hall, the one reverb space of the film'],
  ['a1-est', 'sfx', 'clock-tick texture for the 1966 calendar, whooshes on camera moves'],
  ['a2-7374', 'sfx', 'storm layer: low rumble under the bear market'],
  ['a2-climax', 'sfx', 'impact + sub-drop on the climax figure'],
  ['a3-est', 'sfx', 'map ticks: one soft click per start-year cell'],
  ['a3-limits', 'room', 'room tone forward, music back'],
];
for (const [sc, layer, fn] of sdx) cues.push({ t: +sceneStart(sc).toFixed(3), end: +(sceneStart(sc) + sceneById[sc].dur).toFixed(3), function: fn, key: null, tempo: bpmAt(sceneStart(sc)), layer, scene: sc });
cues.sort((x, y) => x.t - y.t);
// intentional silences: voice pause + music out (master below -40 dBFS)
const silences = [];
const after = (sc, why, dur) => { const ls = script.sentences.filter((l) => l.scene === sc); const l = ls[ls.length - 1]; if (l) silences.push({ t: +(l.end + 0.1).toFixed(3), dur, why, scene: sc }); };
after('co-broke', 'let "1991" land: full stop, music cut', 1.0);
for (const a of ['act1', 'act2']) { const x = tl.acts.find((q) => q.id === a); silences.push({ t: +(x.end - 0.05).toFixed(3), dur: 1.3, why: `ad break at the ${a} boundary (natural pause, voice and music out)`, scene: null }); }
after('a2-1991', 'the account hits zero: the 1966 motif stops, a beat of nothing', 1.1);
const cueSheet = { note: 'Spotting from the M1 timeline. Music is generated in code (M2); keys/tempi are the plan. Leitmotifs: 1966 = rising 4-note figure (D-F-A-C), mirror = its retrograde (C-A-F-D). One reverb space (a dark hall, 1.8 s RT60) for every layer.', cues, silences };

// ---------------------------------------------------------------- tension map (planned)
// music plan: bed at -34 dB; rises to -24 dB over the 25 s before each act climax, holds 3 s, then drops to a -42 dB
// valley for 12 s; intentional silences at -70. Audio density = stems planned active (voice, music, sfx on cuts/reveals,
// whoosh on camera moves) as a 5 s moving mean. Tension = 5 s moving mean of the normalised components.
const cutTimes = tl.scenes.slice(1).map((s) => s.start);
const peaksWanted = tl.acts.filter((a) => a.climax !== undefined).map((a) => a.climax);
const raw = [];
for (let t = 0; t <= Math.floor(tl.total); t += 1) {
  const cutRate = cutTimes.filter((c) => c > t - 5 && c <= t + 5).length;
  const speaking = script.sentences.some((l) => t + 0.5 >= l.start && t + 0.5 < l.end);
  const silent = silences.some((s) => t + 0.5 >= s.t && t + 0.5 < s.t + s.dur);
  let music = -34;
  for (const p of peaksWanted) {
    if (t >= p - 25 && t < p) music = Math.max(music, -34 + 10 * (t - (p - 25)) / 25);
    else if (t >= p && t < p + 3) music = -24;
    else if (t >= p + 3 && t < p + 15) music = -42;
  }
  if (t >= tl.acts.find((a) => a.id === 'outro').start) music = -30;
  if (silent) music = -70;
  const moving = tl.scenes.some((s) => t >= s.start && t < s.start + (s.move || 0));
  const sfx = cutTimes.some((c) => Math.abs(c - t) < 1);
  const stems = (speaking ? 1 : 0) + (music > -45 ? 1 : 0) + (sfx ? 1 : 0) + (moving ? 1 : 0);
  raw.push({ t, cutRate, stems, music });
}
const mean5 = (arr, k) => arr.map((_, i) => { const w = arr.slice(Math.max(0, i - 2), i + 3); return w.reduce((a, b) => a + b[k], 0) / w.length; });
const dens = mean5(raw, 'stems');
const comp = raw.map((r, i) => 0.4 * Math.min(1, r.cutRate / 4) + 0.4 * Math.max(0, (r.music + 44) / 20) + 0.2 * dens[i] / 4);
const ten = comp.map((_, i) => { const w = comp.slice(Math.max(0, i - 2), i + 3); return w.reduce((a, b) => a + b, 0) / w.length; });
const samples = raw.map((r, i) => ({ t: r.t, cutRate: r.cutRate, audioDensity: +dens[i].toFixed(2), musicLevel: +r.music.toFixed(1), tension: +ten[i].toFixed(3) }));
const peaks = peaksWanted.map((p) => { const w = samples.filter((s) => Math.abs(s.t - p) <= 5); return { t: w.reduce((a, b) => (b.tension > a.tension ? b : a)).t }; });
const valleys = peaks.map((p) => { const w = samples.filter((s) => s.t > p.t + 3 && s.t < p.t + 40); return { t: w.reduce((a, b) => (b.tension < a.tension ? b : a)).t }; });
const tension = { note: 'Planned curves from the M1 timeline and cue sheet (cuts per 10 s window, planned stems active, planned music dB). Re-measured on the stems at M3.', samples, peaks, valleys };
// self-check against the R01 peak definition: a declared peak is the maximum within ±10 s; valley ≥ 25% of range lower within 45 s
const rng = Math.max(...samples.map((s) => s.tension)) - Math.min(...samples.map((s) => s.tension));
tension.selfCheck = peaks.map((p, k) => {
  const at = samples[p.t].tension, win = samples.filter((s) => Math.abs(s.t - p.t) <= 10);
  return { peak: p.t, localMax: win.every((s) => s.tension <= at + 0.05 * rng), valleyDrop: +((at - samples[valleys[k].t].tension) / rng).toFixed(2) };
});

// ---------------------------------------------------------------- storyboard
// level-1 placement per layout family (thirds intersections unless declared centre)
const L1 = { duel: [1280, 360], world: [640, 360], ledger: [640, 720], promise: [640, 360], donut: [1280, 360], rules: [640, 360], timeline: [640, 720], mirror: [1280, 360],
  average: [1280, 720], escalator: [640, 360], question: [640, 360], gap: [1280, 360], map: [640, 360], scatter: [1280, 360], decade: [640, 720], answer: [960, 540],
  limits: [640, 360], method: [640, 360], end: [640, 360], title: [960, 540] };
function frameSvg(s) {
  const p = PALETTE[paletteKey(s)], fam = s.layout.split('/')[0], sh = SHOTS[s.id.replace(/-[bc]$/, '')];
  const [x, y] = sh[5] === 'center' ? [960, 540] : L1[fam] || [640, 360];
  const cx = x / 6, cy = y / 6; // 320x180 thumb
  const L = [];
  L.push(`<rect width="320" height="180" fill="${tokens[p.bg]}"/>`);
  // floor
  for (let i = 0; i < 7; i++) L.push(`<line x1="${-60 + i * 70}" y1="180" x2="${130 + i * 10}" y2="118" stroke="${tokens.grid}" stroke-width="0.7"/>`);
  L.push(`<line x1="0" y1="118" x2="320" y2="118" stroke="${tokens.grid}" stroke-width="0.7"/>`);
  // thirds guides
  for (const g of [106.7, 213.3]) L.push(`<line x1="${g}" y1="0" x2="${g}" y2="180" stroke="#ffffff" stroke-opacity="0.08" stroke-dasharray="2 3"/>`);
  for (const g of [60, 120]) L.push(`<line x1="0" y1="${g}" x2="320" y2="${g}" stroke="#ffffff" stroke-opacity="0.08" stroke-dasharray="2 3"/>`);
  // background layer (blurred wall), mid chart, foreground card
  L.push(`<rect x="14" y="20" width="292" height="40" fill="${tokens.grid}" opacity="0.35" rx="2"/>`);
  if (['duel', 'gap', 'world', 'timeline', 'mirror'].includes(fam)) {
    L.push(`<polyline points="30,120 80,112 130,118 180,96 230,88 290,60" fill="none" stroke="${tokens.cmirror}" stroke-width="2" stroke-dasharray="5 3"/>`);
    L.push(`<polyline points="30,120 80,124 130,132 180,128 230,142 270,160" fill="none" stroke="${tokens.c1966}" stroke-width="2"/>`);
  } else if (fam === 'map') {
    for (let i = 0; i < 69; i++) { const bad = [37, 38, 40, 41].includes(i); L.push(`<rect x="${20 + (i % 23) * 12.4}" y="${70 + Math.floor(i / 23) * 16}" width="10" height="12" fill="${bad ? tokens.loss : tokens.gain}" opacity="${bad ? 1 : 0.55}"/>`); }
  } else if (['scatter'].includes(fam)) {
    for (let i = 0; i < 40; i++) L.push(`<circle cx="${40 + (i * 37) % 240}" cy="${150 - ((i * 53) % 90)}" r="2.5" fill="${tokens.muted}"/>`);
  } else if (['donut'].includes(fam)) {
    L.push(`<circle cx="120" cy="100" r="42" fill="none" stroke="${tokens.c1966}" stroke-width="14" stroke-dasharray="158 106"/><circle cx="120" cy="100" r="42" fill="none" stroke="${tokens.muted}" stroke-width="14" stroke-dasharray="0 158 106 0"/>`);
  } else if (['decade', 'escalator', 'average'].includes(fam)) {
    for (let i = 0; i < 10; i++) L.push(`<rect x="${40 + i * 24}" y="${150 - (20 + i * 6)}" width="14" height="${20 + i * 6}" fill="${fam === 'escalator' ? tokens.inflation : i % 2 ? tokens.cmirror : tokens.c1966}" opacity="0.8"/>`);
  }
  // level-1 element
  L.push(`<rect x="${cx - 36}" y="${cy - 14}" width="72" height="28" rx="4" fill="${tokens.surface}" stroke="${tokens[p.accent]}" stroke-width="1.2"/>`);
  L.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="${tokens[p.accent]}"/>`);
  // camera move arrow
  if (sh[4] > 0) L.push(`<path d="M 250 170 l 50 0 m -8 -5 l 8 5 l -8 5" stroke="${tokens['text-dim']}" fill="none" stroke-width="1.2"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">${L.join('')}</svg>`;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function storyboardHtml() {
  const cards = tl.scenes.map((s) => {
    const sh = SHOTS[s.id.replace(/-[bc]$/, '')];
    const line = script.sentences.filter((l) => l.scene === s.id).map((l) => l.text).join(' ') || (s.id === 'ident' ? '[title: Same average, different fate]' : '[picture only]');
    return `<div class="c"><div class="h"><b>${esc(s.id)}</b><span>${mmss(s.start)} · ${s.dur.toFixed(1)} s</span></div>${frameSvg(s)}<div class="m">${esc(s.shot.size)} · ${sh[0]} · ${sh[1]} mm · ${esc(s.layout)}</div><div class="v">${esc(sh[2])}</div><div class="t">${esc(line.slice(0, 150))}</div></div>`;
  }).join('');
  return `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#07090d;font:11px/1.3 Inter,Arial,sans-serif;color:#cfd6e2;width:2000px;padding:16px;box-sizing:border-box}
  h1{font-size:22px;margin:0 0 12px;color:#fff}.g{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.c{background:#10151e;border-radius:6px;padding:6px}
  .h{display:flex;justify-content:space-between;margin-bottom:4px}.m{color:#9fb0c6;margin-top:4px}.v{color:#e9c46a}.t{color:#dfe5ee;margin-top:3px}svg{display:block;width:100%;height:auto;border-radius:3px}</style>
  <h1>Storyboard — Same average, different fate (M1 plan). Thirds grid dotted; filled dot = level-1 element; arrow = camera move at scene start.</h1><div class="g">${cards}</div>`;
}
function colorScriptHtml() {
  const total = tl.total, Wd = 1900;
  const bars = colorScript.map((c) => `<div title="${c.scene}" style="position:absolute;left:${(c.start / total) * Wd}px;width:${Math.max(1, (c.dur / total) * Wd)}px;top:40px;height:120px;background:linear-gradient(180deg,${tokens[c.key]}33 0%,${c.bgHex} 45%,${c.bgHex} 100%)"><div style="position:absolute;bottom:0;height:18px;width:100%;background:${c.accentHex}"></div></div>`).join('');
  const acts = tl.acts.map((a) => `<div style="position:absolute;left:${(a.start / total) * Wd}px;top:170px;font:12px Inter,Arial;color:#cfd6e2">${a.id} ${mmss(a.start)}</div><div style="position:absolute;left:${(a.start / total) * Wd}px;top:36px;height:130px;border-left:1px solid #ffffff55"></div>`).join('');
  const moods = Object.entries(PALETTE).map(([k, p]) => `<tr><td style="background:${tokens[p.bg]};width:40px"></td><td style="background:${tokens[p.accent]};width:20px"></td><td><b>${k}</b></td><td>${esc(p.mood)}</td></tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#07090d;color:#cfd6e2;font:13px Inter,Arial;width:1940px;padding:20px;box-sizing:border-box">
  <div style="font-size:20px;color:#fff">Colour script — background tint per scene (top glow = key light), accent strip = dominant accent token</div>
  <div style="position:relative;height:200px">${bars}${acts}</div><table style="border-spacing:6px">${moods}</table>
  <div style="margin-top:8px">Characters everywhere: 1966 <span style="color:${tokens.c1966}">■ ${tokens.c1966} solid/circle, left</span> · mirror <span style="color:${tokens.cmirror}">■ ${tokens.cmirror} dashed/diamond, right</span>. One grade (design/grade.json), fixed light grain and vignette.</div></body>`;
}
function tensionHtml() {
  const Wd = 1800, Hh = 360, x = (t) => 60 + (t / tl.total) * Wd, y = (v, lo, hi) => 40 + Hh - ((v - lo) / (hi - lo)) * Hh;
  const pl = (k, lo, hi, c, w = 2) => `<polyline fill="none" stroke="${c}" stroke-width="${w}" points="${samples.map((s) => `${x(s.t).toFixed(1)},${y(s[k], lo, hi).toFixed(1)}`).join(' ')}"/>`;
  const acts = tl.acts.map((a) => `<line x1="${x(a.start)}" x2="${x(a.start)}" y1="40" y2="${40 + Hh}" stroke="#ffffff30"/><text x="${x(a.start) + 4}" y="34" fill="#cfd6e2" font-size="13">${a.id}</text>`).join('');
  const pk = peaks.map((p) => `<circle cx="${x(p.t)}" cy="${y(samples[Math.round(p.t)].tension, 0, 1)}" r="7" fill="none" stroke="#ff6b6b" stroke-width="2.5"/>`).join('');
  const vl = valleys.map((p) => `<circle cx="${x(p.t)}" cy="${y(samples[Math.round(p.t)].tension, 0, 1)}" r="7" fill="none" stroke="#6cc49a" stroke-width="2.5"/>`).join('');
  const ticks = Array.from({ length: Math.floor(tl.total / 60) + 1 }, (_, m) => `<text x="${x(m * 60)}" y="${Hh + 60}" fill="#9fb0c6" font-size="12">${m}:00</text>`).join('');
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0b0f17"><svg xmlns="http://www.w3.org/2000/svg" width="1900" height="470" font-family="Inter,Arial">
  <text x="60" y="18" fill="#fff" font-size="16">Tension map (planned): tension (white), cut rate /10 s (amber), music level dB (blue), audio density (violet). Red = act climax peaks, green = valleys.</text>
  ${acts}${pl('cutRate', 0, 6, '#FFC857', 1.5)}${pl('musicLevel', -70, -20, '#5A9CEB', 1.5)}${pl('audioDensity', 0, 4, '#C98BD8', 1.2)}${pl('tension', 0, 1, '#F2F4F8', 3)}${pk}${vl}${ticks}</svg></body>`;
}
function storyboardMd() {
  const rows = tl.scenes.map((s) => {
    const sh = SHOTS[s.id.replace(/-[bc]$/, '')];
    const line = script.sentences.filter((l) => l.scene === s.id).map((l) => l.text).join(' ');
    return `| ${mmss(s.start)} | ${s.id} | ${s.layout} | ${s.shot.size}, ${sh[0]}, ${sh[1]} mm | ${sh[2]} — ${sh[3]} | ${PALETTE[paletteKey(s)].bg} | ${line.replace(/\|/g, '/')} |`;
  });
  return `# Storyboard (M1 plan)\n\nFrames: \`preprod/storyboard.png\` (one thumbnail per scene: thirds grid, level-1 position, depth layers, palette). Time runs left to right; the 1966 retiree (amber, solid, circles) stays on the left/lower side, the mirror (blue, dashed, diamonds) on the right/upper side. Every scene has three depth layers: foreground card, mid chart, background floor + year wall (blurred by depth of field).\n\n| t | scene | layout | shot | camera move — why | palette | narration |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

async function shoot(html, file, w, h) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.setContent(html);
  const hh = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: w, height: Math.max(h, hh + 20) });
  await p.screenshot({ path: path.join(ROOT, file), fullPage: true });
  await b.close();
}

(async () => {
  fs.mkdirSync(path.join(ROOT, 'preprod'), { recursive: true });
  W('preprod/color-script.json', { palettes: PALETTE, scenes: colorScript });
  W('out/cues.json', cueSheet);
  W('out/tension-map.json', tension);
  W('preprod/storyboard.md', storyboardMd());
  await shoot(colorScriptHtml(), 'preprod/color-script.png', 1940, 400);
  await shoot(tensionHtml(), 'out/tension-map.png', 1900, 470);
  await shoot(storyboardHtml(), 'preprod/storyboard.png', 2000, 1000);
  console.log(JSON.stringify(tension.selfCheck)); console.log('cues', cues.length, '| silences', silences.length, '| peaks', peaks.map((p) => p.t).join(' '), '| valleys', valleys.map((v) => v.t).join(' '));
})();
