# Writing scene builders for Test D (acts 2, 3, method, outro)

Style: **the chart is the lead character; cinematic craft around it** (2.5D: parallax layers, background blur to lead
the eye, camera moves on the chart plane with a reason). Read `render-d/prod/scenes.js` first: it holds the act-1
builders and the helpers. Your builders go in your own file (`scenes-a2.js`, `scenes-a3.js`, `scenes-end.js`), loaded
after `scenes.js`, in this form:

```js
'use strict';
(function () {
  const { B, K } = window.SCENES;
  const { D, C, M, clamp, smooth, easeOut, back, fade, fadeOut, cueAbs, lineStart, S, Tx, L1, claim, badge, env, axisX, series, charShape, colorOf, yearsX } = K;
  B['a2-est'] = (L, sc, H) => { const items = []; env(items, 'a2-est'); /* ... */ return items; };
  // camera for a scene (optional): window.CAMS.CAM['a2-est'] = { f: 35, base: { z: -300 }, moves: [[0.6, 1.4, { z: 380 }]] };
})();
```

A builder gets `L` (seconds since the scene's cut), `sc` (the timeline scene: id, start, dur, act, layout, shot) and
`H` (`H.local(absTime)` → scene-local time; `H.P(x, y, z)` → screen point of a world point). It returns items:

- **shape** `S(id, geo, { panel, z, pts|rect|c,r, fill, stroke, lw, dash, alpha, layer, meta: { role, panel, chart, char, shape, series } })`
  — world units: the chart plane is z = 0 and roughly x 0..1920, y 0..1080 (y down). Larger z = further (blurred,
  smaller, parallax). Use 2–3 depth layers: data at z = 0, context marks at z = 300–800, `env()` puts the far wall and
  floor at z ≥ 1400. `role`: 'series' (a data line), 'axis', 'mark' (bars, dots), 'bg'. A series needs an axis and two
  labelled anchors (year labels) or it fails C04.
- **text** `Tx(id, text, x, y, size, color, { align, level, weight, alpha, role, claims, series, year, char, background })`
  — screen pixels, sharp (not blurred). `L1(id, text, cx, cy, size, alpha, o)` = the level-1 headline (bold, centred).

Rules the machine checks enforce (read `checks/README.md` for the full table; you must not edit `checks/`):

1. **Panels**: every item's `panel` (and `meta.panel`) = the scene's base id (e.g. 'a2-est'; for split shots
   'a2-bal74-b' the parent builder runs with panel 'a2-bal74').
2. **One level-1 text** per scene at a time (`level: 1`), on a thirds point (x 640 or 1280, y 360 or 720, ±96/±54) or
   centred (x 960 ±48) when the scene is in the CENTER list. Other texts `level: 2` or 3. Level-1 contrast ≥ 7:1: use
   `C.text` or the character colour on the dark background; no other text brighter or larger than 48 px.
3. **Every number on screen is a claim span**: `Tx(..., { claims: [claim('bal74')] })` and the text must contain
   `D.claims[id].display` verbatim. Only use claim ids listed in `out/claims.json` whose `shownIn` includes your scene
   (or the scene's line says the number). Axis years use axis claims when they exist (`ax1966`, `ax1995`); don't
   print other numbers (no tick numbers without a claim). Money needs its basis ("in 1966 dollars" / "nominal") in the
   same text or within 300 px.
4. **Illustrative claims** (`D.claims[id].illustrative`, e.g. every mirror number) need `badge(id, x, y, a)` visible
   no later than the number and **directly next to it** (within ~60 px).
5. **Reveal numbers when they are spoken**: `alpha: L >= H.local(cueAbs('a2-1974inf.1', '14.7%')) - 1/60 ? 1 : 0`.
   Cue keys are `<sentenceId>|<word as written in the text>`; numbers exactly as written ('14.7%', '$461,000', '1974').
   Wrap `cueAbs` in try/catch with `lineStart(sid) + offset` as the fallback.
6. **Characters**: 1966 retiree = `C.c1966` amber, solid, left side; mirror = `C.cmirror` blue, dashed, right side.
   Use `charShape(char)` in meta. Semantic tokens: `C.loss`, `C.gain`, `C.inflation`, `C.text`, `C['text-dim']`,
   `C.muted`, `C.grid`, `C.surface`, `C['surface-2']`. Only token colours (lower-case hex from `C`).
7. **Bars**: a visible **zero baseline** (`role: 'axis'`) and heights proportional to the value (±3 %). If a scale tick
   label is shown, it must be a claim; otherwise draw the baseline without numbers.
8. **Safe area**: texts inside x 96..1824, y 54..1026; no text over a mark (pixel collision is checked).
9. **Motion with a reason**: something should change on screen most of the time (≥ 0.5 % of pixels per frame): lines
   draw on as the voice walks through years, bars grow when named, the camera moves toward what the line is about
   (moves are 1.2–1.6 s, start ≥ 0.6 s after the cut, end ≥ 0.6 s before the next cut; `inertia` is applied by
   cameras.js). No decorative motion added only to pass a threshold. Longest still stretch ≤ 4 s.
10. **Layouts**: don't reuse the same composition more than twice within 90 s; vary between line charts, bar rows,
   ledgers (big number + small chart), grids and scatter plots, and between left/right/centre placements.

Data (`D.model`, all arrays indexed by year of the plan k = 0..29 for 1966..1995, or with the initial value first):
`real1966`, `realMirror` (31 values, real balance, index 0 = $1,000,000), `nom1966`, `nomMirror`, `wd1966`, `wdMirror`
(nominal withdrawals), `infl` (inflation per calendar year), `ret1966` (nominal 60/40 return by calendar year),
`retMirror` (returns in the mirror's order), `share1966` (withdrawal / balance at the start of the year),
`depleted1966` (1991), `starts` (69 objects: `{ y, depleted, endReal, realGeo30, realGeo10, less }` for start years
1928..1996), `cum1966`, `cumMirror`, `geo`, `arith`. Sentences: `D.sentences` (id, scene, text, start, end).
Claims: `D.claims[id]` → `{ display, illustrative, basis, character }`; the full registry is `out/claims.json`.

Test your builders: `node render-d/prod/render.js out/m3/root --stills 240.5,251.2 ` writes
`out/m3/stills/t240.50.png` etc. (seconds of the whole film; scene times are in `out/m3/root/out/timeline.json`).
Look at the stills (Read tool) and fix what looks wrong. Keep every builder free of exceptions (a thrown error
breaks the render).
