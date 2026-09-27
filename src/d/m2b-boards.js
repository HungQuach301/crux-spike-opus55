'use strict';
// Test D M2b: style frames for the visual bible (preprod/style/*.png), made from frames of the lookdev render itself
// (so the boards show exactly the film's pixels), laid out with HTML and captured with Chromium.
//   node src/d/m2b-boards.js out/m2b/lookdev.mp4
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const REPO = path.join(__dirname, '..', '..');
const VIDEO = path.resolve(process.argv[2] || path.join(REPO, 'out', 'm2b', 'lookdev.mp4'));
const OUT = path.join(REPO, 'preprod', 'style');
const TMP = path.join(REPO, '.frames', 'boards');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const cam = JSON.parse(fs.readFileSync(path.join(REPO, 'out', 'm2b', 'root', 'out', 'camera.json'), 'utf8')).frames;
const focal = (t) => { const f = cam[Math.min(cam.length - 1, Math.round(t * 30))]; return Math.round(12 / Math.tan(f.fovDeg * Math.PI / 360)); };
const frame = (t) => { const f = path.join(TMP, `f${t.toFixed(2)}.png`); if (!fs.existsSync(f)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', VIDEO, '-frames:v', '1', f]); return 'file://' + f; };

const CSS = `@font-face { font-family: Inter; font-weight: 400; src: url(file://${REPO}/render-av/fonts/inter-latin-400-normal.woff2); }
@font-face { font-family: Inter; font-weight: 600; src: url(file://${REPO}/render-av/fonts/inter-latin-600-normal.woff2); }
@font-face { font-family: Inter; font-weight: 700; src: url(file://${REPO}/render-av/fonts/inter-latin-700-normal.woff2); }
body { margin: 0; width: 1920px; height: 1080px; background: #0b0d10; color: #e8ebf0; font-family: Inter; overflow: hidden; }
.pad { padding: 40px 56px; } h1 { font-size: 34px; font-weight: 700; margin: 0 0 6px; } .sub { font-size: 20px; color: #aab3c0; margin-bottom: 22px; }
.grid { display: grid; gap: 18px; } img { width: 100%; display: block; border-radius: 4px; } .cap { font-size: 17px; color: #c9d0da; margin-top: 8px; line-height: 1.35; }
.tag { font-weight: 700; color: #fff; } .sw { display: inline-block; width: 14px; height: 14px; border-radius: 3px; vertical-align: -1px; margin-right: 6px; }`;
const page = (title, sub, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="pad"><h1>${title}</h1><div class="sub">${sub}</div>${body}</div></body></html>`;
const cell = (t, cap, crop) => `<div>${crop ? `<div style="width:100%;aspect-ratio:${crop.ar || '16/9'};overflow:hidden;border-radius:4px"><img src="${frame(t)}" style="width:${crop.z * 100}%;margin-left:-${crop.x * crop.z * 100}%;margin-top:-${crop.y * crop.z * 56.25}%"></div>` : `<img src="${frame(t)}">`}<div class="cap">${cap}</div></div>`;

const boards = {
  'style-1-world': page('1 · The world', 'One physical place. The data are objects in it; nothing floats on a card.',
    `<div class="grid" style="grid-template-columns: 1.45fr 1fr">${cell(6.6, '<span class="tag">Dawn, January 1966.</span> Two glass tanks at the head of a road of 30 stones. The liquid is each retiree\'s money in 1966 dollars (level = real balance, one scale for both); the thin stream from the spout is the withdrawal.')}
    <div class="grid">${cell(20.2, '<span class="tag">The road.</span> One stone per year, 1966 nearest. Height = the year\'s real 60/40 return. 1973 and 1974 are the dip.')}${cell(29.2, '<span class="tag">The 1974 stone</span>, in profile: it sinks with the loss, then again with inflation.')}</div></div>`),
  'style-2-light': page('2 · Light tells the story', 'Key / fill / rim all have a source: the sun, the sky, the storm. Grade is one pipeline (ACES, lift/gain per act).',
    `<div class="grid" style="grid-template-columns: 1fr 1fr 1fr">${cell(4.5, '<span class="tag">Dawn · 1966</span><br>Key: low sun ahead-left, 1–4°, warm. Fill: sky hemisphere, cool. Rim: the sun behind the tanks. Air: light fog, sunlit dust, sun shafts.')}
    ${cell(21.0, '<span class="tag">Storm · 1973–74</span><br>Key: overcast, high, cold. Fill: grey-blue sky. Air: dense fog, rain that thickens when prices rise; one lightning strike on the loss.')}
    ${cell(13.1, '<span class="tag">Dusk · after 1986</span><br>Key: the sun has set; red sky behind the mirror tank acts as rim. Fill: violet sky. Air: dust, low haze.')}</div>
    <div class="cap" style="margin-top:22px"><span class="tag">Time-lapse (cold open):</span> 25 years pass as one arc of the sun, dawn to sunset; the shadows of the tanks sweep across the road while the 1966 tank drains.</div>`),
  'style-3-lenses': page('3 · Lens kit', '24 · 28 · 38–45 · 50 mm (35 mm equivalent). Nothing longer than 50 mm: the depth between the two tanks is the point.',
    `<div class="grid" style="grid-template-columns: 1fr 1fr">${[0.9, 20.5, 10.6, 13.9].map((t) => cell(t, `<span class="tag">${focal(t)} mm</span> — ${{ 0.9: 'establishing crane over the road', 20.5: 'walking down the road into the storm', 10.6: 'medium: the time-lapse ends on the empty tank', 13.9: 'close: focus racks from the dry tank to the full one' }[t]}`)).join('')}</div>`),
  'style-4-camera': page('4 · Camera grammar', 'Every move has a reason. Inertia: small wind-up, eased travel, 2% overshoot that settles. 180° shutter.',
    [['Crane down — arrive in 1966', [0.3, 3.5, 7.0]], ['Truck left with the time-lapse — end on the tank that runs dry', [7.9, 9.0, 10.5]], ['Rack focus on the turn — "what decided it?"', [12.6, 13.6, 14.4]]]
      .map(([cap, ts]) => `<div class="cap" style="font-size:20px;margin:6px 0"><span class="tag">${cap}</span></div><div class="grid" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom: 10px">${ts.map((t) => `<img src="${frame(t)}" style="height:220px;object-fit:cover">`).join('')}</div>`).join('')),
  'style-5-text': page('5 · Text in the world', 'Minimal. Numbers are anchored to the object they belong to, set against sky or fog, never over a tank or a stone. Decisive numbers ≥ 52 px, contrast ≥ 4.5:1.',
    `<div class="grid" style="grid-template-columns: 1fr 1fr 1fr">${cell(10.9, '<span class="tag">"1991"</span> — 76 px, 1966 amber, over the sky between the two tanks at the moment it is spoken.')}
    ${cell(30.6, '<span class="tag">"lost 14.7%" / "prices rose 12.3%"</span> — loss and inflation tokens, above the 1974 stone that each one sinks.')}
    ${cell(39.2, '<span class="tag">"$461,000" + "in 1966 dollars"</span> — the basis travels with the money, 34 px directly under it.')}</div>
    <div class="cap" style="margin-top:22px"><span class="tag">Title</span> (ident) is the only centred text. Years appear only when spoken. One level-1 text at a time.</div>`),
  'style-6-materials': page('6 · Materials', 'PBR: glass (reflects the sky), brass and steel (metal), liquid in the character colour with a rippling surface, bevelled stone, soil; wet in the storm.',
    `<div class="grid" style="grid-template-columns: 1fr 1fr">${cell(39.8, '<span class="tag">Glass, brass, liquid</span> in storm light (1966 tank)', { x: 0.0, y: 0.25, z: 1.8 })}${cell(8.4, '<span class="tag">Glass and water</span> at dawn; spout and stream', { x: 0.1, y: 0.3, z: 1.6 })}
    ${cell(25.0, '<span class="tag">Stone and rain</span>, wet', { x: 0.25, y: 0.3, z: 1.6 })}${cell(14.3, '<span class="tag">Dusk:</span> the full mirror tank in the red sky', { x: 0.45, y: 0.15, z: 1.6 })}</div>`),
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const [name, html] of Object.entries(boards)) {
    const f = path.join(TMP, name + '.html'); fs.writeFileSync(f, html);
    await p.goto('file://' + f); await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = r; i.onerror = r; })))); });
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('board', name);
  }
  await b.close();
})();
