# REPORT — mortgage points break-even segment

## Deliverables

| File | What it is |
|---|---|
| `out/segment.mp4` | 86.0 s, 1920×1080, 30 fps, H.264 High, yuv420p/bt709, **no audio stream** (2,580 frames) |
| `out/frame-normal.png`, `out/frame-extreme.png`, `out/frame-missing.png` | The same layout (the "flip table" scene) under three datasets |
| `out/evidence/*` | 25%-scale and grayscale copies of the three frames, plus three stills decoded from the mp4 |
| `out/checks.json` | Machine layout/token/number checks: 21 hold frames (7 scenes × 3 datasets) + 258 sampled video frames |
| `src/calc.js`, `src/data.js` | Calculations and the claims ledger. Every on-screen number comes from here |
| `test/*.test.js` | 20 unit tests (`npm test`), all passing |
| `claims.json` | 324 claims: every number drawn on screen → value, display string, formula or source URL, inputs, where it appears |
| `script.md` | On-screen text (exported from the rendered DOM) + narration, 223 words / 86 s = 155.6 wpm |

Reproduce: `npm install && pip install imageio-ffmpeg && npm run all`.

## Step 0: environment and renderer choice

Found: Node 22.22, Python 3.11 (no Pillow/numpy), Playwright 1.56.1 with its bundled Chromium 1194. No system ffmpeg; Playwright's own ffmpeg build only handles its screencast codec. npm and PyPI were reachable. Freddie Mac, FRED and the press-wire sites were blocked by the egress proxy.

**Choice: our own deterministic HTML renderer. Chromium (via Playwright) paints each frame, and ffmpeg (the static 7.0.2 build from the `imageio-ffmpeg` wheel) encodes it with libx264.** This is the Remotion model without Remotion:

- Remotion needs its own Chrome Headless Shell download and a webpack/React bundle. The download host was not verified reachable, and the bundling adds a failure surface this spike doesn't need. Motion Canvas needs Vite plus an ffmpeg exporter, which has the same issue.
- Python + ffmpeg alone would have meant drawing text with PIL. PIL isn't installed, and PIL has no OpenType `tnum` support or real type layout. Chromium gives us Inter with tabular numerals, flexbox and SVG for free.
- Each frame is a pure function `renderFrame(t, dataset)`. There are no CSS animations and no timers, so any frame can be re-rendered on its own, sampled by the checker, or split across workers (4 parallel pages → 4 H.264 parts → lossless concat).

## Base rate

**7.03%**, Freddie Mac PMMS 30-year fixed average, week of **Sep 24, 2026**. The release is titled "Mortgage Rates Average 7.03%":
<https://www.globenewswire.com/news-release/2026/09/24/3368592/0/en/mortgage-rates-average-7-03.html>, index page <https://www.freddiemac.com/pmms>.

**Caveat:** the sandbox proxy blocked direct fetches of freddiemac.com, freddiemac.gcs-web.com, globenewswire.com, nasdaq.com and FRED. The value and date come from the web-search index: the release titles, the dated URL, and the prior weeks 6.71 / 6.76 / 6.95% for a consistency check. We did not read the page body. Because the rate is sourced, it is not labeled ILLUSTRATIVE; the `extreme` stress dataset (12.875%) is labeled ILLUSTRATIVE on screen. If the published number differs, change `SOURCE.ratePct` in `src/data.js` and run `npm run all`. Every number re-derives.

## Model (stated on screen and in claims.json)

- Payment: `M = L·i / (1 − (1+i)^−360)`, `i = r/12`, rounded to cents.
- One point = 1% of the loan. New rate = base − points × cut per point.
- **Version A (payments only):** the smallest whole month m with m × saving ≥ cost.
- **Version B (opportunity cost):** the upfront cash could have earned **5.00%/yr** (a stated assumption, monthly compounding, j = k/12). This is the smallest m where the present value of m monthly savings at j is ≥ cost. It is the same as the future value of the invested savings catching up with the future value of the invested cost; a test checks that both formulations cross zero in the same month.
- Not modeled (shown on screen): taxes and points deductibility, closing costs, the lower loan balance at sale (this favors points), and refinancing or prepayment.

**The flip:** at a 10-year hold (chosen by code as the holding period with the most disagreements, ties going to the shorter one), 6 of 18 cells flip. At 0.125% off per point, version A breaks even at 10.0 years and version B at 13.8 to 13.9, so for holds of 10 to 13 years the answer changes. At 0.25% off per point, version A is 5.0 to 5.1 years and version B is 5.8. Across 0.5 to 3 points, the number of points moves version A's break-even by at most 1 month.

## Wall time and iterations

- **Total wall time: ~24 minutes** (environment check → PR), including a **259 s** full-video render (2,580 frames, 4 workers).
- **Render iterations: 1 full video render.** Before it: 3 rounds of still-frame iterations (8 stills, then 6, then 5) and 2 checker runs. The first checker run flagged the 128 px glyph boxes above the safe margin, stray SVG `fill` checks, and the footer's entrance moving it below the margin; all were fixed before the video render.

## Automated evidence (what `render/check.js` asserts)

For every hold frame and every 10th video frame:

- Text ink boxes stay inside the 96 px safe area, with no cell overflow or clipping and no text/text overlap.
- Every digit on screen sits inside a `K(claimId)` span. A tree-walk fails on any digit outside one, so a hand-typed number cannot reach the screen.
- Computed colors (text, background, border, SVG fill/stroke) are all in the 9-token table. Font sizes are only 128/48/28, weights only 700/600/400, family Inter.
- Ink coverage is the share of pixels that differ visibly from the bg token.

Result: **0 issues on all 21 hold frames and 0 on 258 sampled video frames.**

Motion tokens in `render/scenes.js`:

- Drift: the background dot grid moves at 12 px/s, and the drift **stops** while each focal number holds (emphasis by stillness).
- Stagger: 60 ms.
- Overshoot: back-out easing solved numerically to peak at exactly 4%.
- Entrances: a 16 px rise over 0.5 s.

## Self-score: 8 criteria per frame

Legend: ✅ pass, ⚠️ partial (counted as fail), ❌ fail.

### frame-normal.png — 8/8

| # | Criterion | Score | Evidence |
|---|---|---|---|
| 1 | Readable at 25% | ✅ | `evidence/frame-normal-25pct.png`: "6 of 18" (32 px at 25%) and the headline (12 px) read clearly; the flip column reads as a pattern even though the 7 px cell digits are soft. |
| 2 | One focal point | ✅ | A single 128/700 element ("6 of 18"); everything else is 48 or 28. |
| 3 | Negative space | ✅ | Ink coverage 6.8% of pixels (checks.json); the table stops at y≈770 and leaves about 110 px free above the legend. |
| 4 | Three-level hierarchy | ✅ | Computed sizes {128, 48, 28} and weights {700, 600, 400}; one l1, two l2, 31 l3. |
| 5 | Survives worst-case data | ✅ | The same code renders `extreme` (12×6 grid, $9,999,999 loan, "never" values) with 0 overflow, clip or safe-area issues. |
| 6 | Meaning survives grayscale | ✅ | `evidence/frame-normal-gray.png`: flipped cells carry a 2 px outline, a surface fill and 600 weight. The legend uses the same outlined box plus words. |
| 7 | Room for motion | ✅ | 60 ms row/column stagger and 16 px entrances run without overlap in all 258 sampled frames; the dot grid drifts behind with no collisions. |
| 8 | Only token values | ✅ | Checker: 0 off-token colors, sizes, weights or fonts; 6 distinct computed colors, all tokens. |

### frame-extreme.png — 6/8

| # | Criterion | Score | Evidence |
|---|---|---|---|
| 1 | Readable at 25% | ❌ | `evidence/frame-extreme-25pct.png`: the focal "24 of 72" and the headline read, but 72 cells at 28 px become 7 px of text on a 46 px row pitch. Only the flip pattern survives, not the values. |
| 2 | One focal point | ✅ | Still one 128 px element; the 24 outlined cells form a strong secondary block but not a competing focal. |
| 3 | Negative space | ⚠️ | Coverage 13.2%, double the normal frame; the row pitch drops to 46 px and outlined cells sit 4–8 px apart. It is legible but crowded. |
| 4 | Three-level hierarchy | ✅ | Same {128, 48, 28} / {700, 600, 400}. |
| 5 | Survives worst-case data | ✅ | This is the worst case: the longest labels ("0.1875% off", "2.25 pt · $225,000", "17.2 → never"), 13 rows including the header, and 6 columns. Checker finds 0 overflow, clip or overlap issues, and everything stays inside the safe area. |
| 6 | Meaning survives grayscale | ✅ | `evidence/frame-extreme-gray.png`: outlines and weight carry the flip; the ILLUSTRATIVE label keeps its 600 weight. |
| 7 | Room for motion | ✅ | Entrance offsets stay inside the row pitch; no sampled-frame overlaps (only the normal dataset is animated in the video). |
| 8 | Only token values | ✅ | Checker: 0 off-token values. |

### frame-missing.png — 8/8

| # | Criterion | Score | Evidence |
|---|---|---|---|
| 1 | Readable at 25% | ✅ | Same geometry as the normal frame; "4 of 12" and the headline read at 25%. |
| 2 | One focal point | ✅ | One 128 px count; the denominator counts only quoted cells (12, not 18). |
| 3 | Negative space | ✅ | Coverage 6.1%. |
| 4 | Three-level hierarchy | ✅ | Same size and weight sets. |
| 5 | Survives worst-case data | ✅ | 6 empty cells render as "—" with a "— no lender quote" legend. The count, the holding-period choice and the thresholds all skip empty cells in code (`src/data.js`). |
| 6 | Meaning survives grayscale | ✅ | Missing is shown by a glyph and words, not color. |
| 7 | Room for motion | ✅ | Same as normal. |
| 8 | Only token values | ✅ | Checker: 0 off-token values. |

## Known weaknesses

1. **Rate provenance is secondhand.** It was confirmed from search-index titles and a dated URL, not from reading the Freddie Mac page, which the sandbox blocked.
2. **The opportunity-cost model is simple.** It uses one constant pre-tax 5.00% return with no sensitivity sweep on screen. The lower loan balance at sale, which pushes break-even *earlier* for points, is omitted. Including it would shrink the flip window, and the segment says it is left out but does not quantify it.
3. **"6 of 18" depends on the chosen hold.** The count moves with H; the code picks the H with the most flips (10 years). That is disclosed on screen as "at a 10-year hold", but it is a selection.
4. **13.8 vs 13.9.** The chart shows 1 point (13.8 years); the closing card shows the longest value across 0.5 to 3 points (13.9). Both are labeled, but a viewer could read them as inconsistent.
5. **25% readability of table cells.** 28 px is the smallest token size at or above the 24 px floor, and it becomes 7 px at 25%. The extreme dataset fails this criterion.
6. **The encoded video is not exactly on-token.** yuv420p/bt709 limited range shifts token colors by a few code values. Anti-aliasing and scene cross-fades (0.4 s) create in-between colors. The checker validates authored/computed CSS, not decoded pixels.
7. **Non-token geometry.** Row heights, the 2 px stroke width, chart plot bounds and the 16 px entrance distance are computed or chosen values; the token table does not cover them.
8. **The narration is not recorded or synced.** Per-scene word counts are paced to the scene lengths (146–163 wpm per scene, 155.6 overall), but there is no word-level timing, and the TTS voice may run long on the dollar amounts.
9. **Scene coverage.** Only the flip-table scene is delivered as three PNGs. The other six scenes were checked under all three datasets (checks.json) but not exported as images.
10. **Environment coupling.** The renderer depends on Playwright's Chromium 1194 and the imageio-ffmpeg binary. Other Chromium versions can shift font rasterization slightly.
