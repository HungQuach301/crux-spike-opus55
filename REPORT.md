# REPORT — spike 2: car loan early payoff vs investing (motion + sound)

**Topic:** "Pay off a 5.2% car loan early, or invest the cash: at what expected return does the answer flip?"
The segment is 127.8 s, 1920×1080, 30 fps, H.264 video plus AAC 48 kHz stereo audio, in `out/segment.mp4`.
Spike 1's report is kept as `REPORT-spike1.md`, and branch `spike/opus55` is untouched.

## What the segment argues (numbers are computed in `src/car/`)

| Input | Value | Where it comes from |
|---|---|---|
| Loan | $25,000 at 5.2% APR, 48 months left | The brief |
| Payment | $578.00 | Standard amortization, `payment()` |
| Extra cash | **$400 a month** | Our stated assumption; the brief does not fix it |
| Tax treatment (on screen) | Gains taxed once at month 48 at 12%, 22% or 32% | Brief rates, simplified (see below) |

The simplified tax treatment works like this:
- Gains are taxed at the bracket rate if the account were liquidated.
- Losses give no tax credit.
- Loan interest is not deductible.
- Returns compound monthly as (1+r)^(1/12).

The two roads:
- **Road A** puts P + $400 into the loan until it is gone, which happens at **month 28**. After that it invests P + $400 every month.
- **Road B** pays the minimum and invests $400 every month.
- Both spend exactly the same cash. A tested identity follows: A's extra invested basis equals the interest it avoids, **$1,190** ($2,744 − $1,554). That part is certain.

Findings:
- **Break-even expected return:** 6.00% / 6.70% / 7.59% at 12 / 22 / 32% tax.
- **Sanity check:** at 0% tax the break-even is 5.33%, which is the 5.2% APR expressed as an effective annual rate (tested).
- **Downside, one stated sequence (not a forecast):** 8% a year for 36 months, then −20% a year for months 37–48. B leads until month 36, A is ahead from **month 38**, and A finishes **$459** ahead after tax.

No external source was needed: every figure is a brief input, our stated assumption, or computed. Nothing needed an ILLUSTRATIVE label, because no fetched rate is shown.

## Deliverables

| File | Content |
|---|---|
| `out/segment.mp4` | Video + mixed audio |
| `out/contact-sheet.png` | 24 thumbnails, each with timestamp, shot size and layout id |
| `out/keyframes/*.png` | establishing, slider-mid-sweep, crossover, break-even-detail, downside-path. 25% and grayscale copies are in `out/evidence/` |
| `out/motion-metrics.json` | Per-scene duration, words, shot, layout and motion coverage; every global limit with pass/fail |
| `out/audio-metrics.json` | LUFS and true peak (own BS.1770 meter, cross-checked against ffmpeg `ebur128`); per-layer levels; SFX counts, density and sync; silences |
| `out/music-ledger.json` | 10 assets (music bed, room tone, 8 SFX): origin, generator, seed, license |
| `out/audio/{music,sfx,ambience}.wav` | Separate stems, 48 kHz stereo PCM16. The 8 fixed SFX buffers are in `out/audio/sfx-bank/` |
| `claims.json` | 88 claims: every number drawn on screen, with formula, inputs and the scenes it appears in |
| `script.md` | Per scene: timing, shot, layout, on-screen text exported from the DOM, sound cues, narration (322 words, 151.2 wpm), spoken number → claim |
| `src/car/` + `test/car.test.js` | Calculation, data/claims, the shared timeline and the narration. 11 new tests; 31/31 pass with spike 1's |
| `out/checks.json`, `out/text-metrics.json`, `out/visual-events.json`, `out/keyframe-metrics.json` | Raw evidence |

Reproduce: `npm install && pip install imageio-ffmpeg numpy scipy && npm run motion:all`.

## Tooling choice

**Picture: the deterministic Chromium + ffmpeg renderer from spike 1, extended into a continuous data canvas with a virtual camera.**
- All graphics live in one SVG world, transformed by a camera (x, y, scale). Strokes are `non-scaling-stroke`.
- Text lives in a screen-space overlay anchored to world points. Type therefore always renders at the token sizes (128/48/28) whatever the zoom. A camera that scaled text would have broken the type tokens and the 24 px floor.
- Every frame is a pure function of t, so the checker can sample any frame, 4 workers can render in parallel, and the renderer can record **DOM event probes** per frame. Those probes are what sync is measured against.
- Remotion would give the same model at the cost of a React/webpack bundle and its own Chrome download; nothing in this spike needs its features. Motion Canvas's audio preview does not render offline to a mix.

**Sound: Python + NumPy/SciPy DSP (`audio/generate.py`).** It reads the same timeline JSON as the picture (`out/timeline.json`, produced by `src/car/timeline.js`).
- **Timeline-driven:** every scene is a whole number of beats at 100 BPM (0.6 s), so the music's phrase lengths are the scene lengths and chords change exactly on cuts.
- **Deterministic:** fixed seeds.
- **Measurable with the same tools:** a BS.1770-4 K-weighted gated meter and a 4× oversampled true peak (`audio/loudness.py`); integrated LUFS matches ffmpeg `ebur128` to 0.1 LU.
- Tone.js offline rendering would have needed a separate metering path anyway.

## Wall time and iterations

- **Wall time: about 65 min.** This covers the model, renderer, audio, metrics, 4 full renders at ~6.7 min each, and the report.
- **Render iterations: 5 full-video renders started, 4 completed, 1 aborted.** Before them came 3 rounds of storyboard stills (24 + 9 + 2 frames). Each render fixed something the checkers found:
  1. First pass.
  2. (Aborted.) Stillness windows overlapped camera moves, so the numbers were landing while the camera was still moving.
  3. The sweep camera clipped the "Interest avoided" caption.
  4. The stricter safe-area fade hid the sweep counter and the "Month N" label; bar-B's bold weight computed as 900.
  5. Three keyframes lacked a level-1 (128 px) element.
- **Audio iterations:** 5 generations. All levels and density passed from the first build; later runs only followed timeline changes.

## Layout → argument beat

| Beat | Layout(s) | Why this form |
|---|---|---|
| Question and two options | two-roads/fork (open, extra, roads) | Two uses of the same $400: the argument is a fork |
| What is owed | hero-number/with-unit (facts) | One number sets the scale: $25,000 |
| What paying early buys | timeline/months (timeline), then a morph to stacked-cost/absolute (interest) | Months first (month 28 vs 48); the same bars then re-scale to dollars to show the $1,190 of interest, the certain part |
| Scope | canvas/overview (scope) | A wide shot of the whole canvas while the assumptions are stated |
| Tax treatment | threshold-matrix/rows (tax, empty values) | The rows exist before their values: the reader sees which dimension varies |
| The comparison | bar-compare/two (bars, sweep, settle) | Certain dollars (A) vs return-dependent dollars (B), on one axis from zero |
| The sweep | bar-compare/two + line-trend/dual with a slider (sweep) | As the return rises, bar B grows and the two net-worth lines draw; the threshold line changes color when B passes it |
| The break-even | bar → point morph, flip-point/axis, hero-number/plain (morph, detail, flip) | Equal bars become one point where the lines cross; "6.70%" at detail scale, then below/above on the axis |
| Tax dependence | threshold-matrix/rows + doodle/circle (matrix, matrix32) | The point flies into its row; the other two rates roll in; a circle marks the largest threshold |
| Risk | two-column-compare (certain) | A certain 5.2% vs a 2–10% fan labeled "expected, not certain" |
| One bad sequence | timeline/months strip, line-trend/dual race, dual → single morph, hero/with-delta (sequence, race, gap, cross, downside) | Net worth after tax is nearly identical on both roads, so the camera pushes in and the lines morph into their difference: B ahead, then A ahead from month 38, +$459 |
| Resolution | two-roads/converge, canvas/overview (converge, outro) | The fork closes on the threshold; a pull-back to the whole canvas |

That is 11 distinct catalog layouts (13 counting variants). There are 5 morph transitions: timeline→stacked, bar→point, point→matrix row, dual→gap line, fork→converge.

## Motion and genre limits (all measured in `out/motion-metrics.json`)

| Limit | Measured | Pass |
|---|---|---|
| Every scene 1.2–12 s | 1.2 – 10.8 s | ✅ |
| Scene-length std / mean ≥ 0.4 | 0.432 | ✅ |
| ≤ 3 consecutive scenes < 2 s | 1 | ✅ |
| Motion coverage ≥ 70% | **95.1%** | ✅ |
| Longest static run ≤ 8 s | **0.93 s** (at 62.4 s) | ✅ |
| ≤ 12 on-screen words per scene | max 12 (roads, sweep) | ✅ |
| Text rate ≤ 1.5 words/s | 1.16 overall; worst single scene 1.50 | ✅ |
| Shot mix by scene count: wide 20 / medium 40 / close 30 / detail 10 (±8) | 16.7 / 45.8 / 29.2 / 8.3 | ✅ (by time: 18.8 / 58.7 / 16.4 / 6.1) |
| ≥ 3 morph transitions | 5 | ✅ |

How the rows above were measured:
- **Moving frame:** mean |Δluma| over the full 1920×1080 frame > **0.02** 8-bit levels. The threshold is 4× the encoder noise floor, floored at 0.02. The noise floor is measured by encoding each keyframe as a 2 s still with the same x264 settings (p95 = 0.0001).
- **Words:** counted from the rendered DOM every 3rd frame (text at opacity > 0.5; numbers count as words). "New words/s" counts words not visible at the end of the previous scene.
- **Shot size:** comes from camera scale (wide < 0.6 ≤ medium < 1.3 ≤ close < 2.4 ≤ detail).

Motion tokens:
- Camera drift is 8 px/s on screen.
- Stagger is 60 ms.
- Back-out easing is solved to peak at exactly 4%.
- Background parallax layers move at 0.3 / 1.0 / 1.3 of camera motion, integrated per frame so zooms never make the background jump.
- **Stillness:** at 4 landings (6.70%, detail 6.70%, month-38 crossing, +$459) the camera and all three background layers stop for 0.8 s. The measured moving frames inside those windows (3 / 20 / 6 / 16 of 24) come only from the landing number's own 0.35 s fade and 0.5 s rise.

## Sound limits (`out/audio-metrics.json`)

Reference: 0 dB = −16 LUFS integrated, where a narration track would sit.

| Limit | Measured | Pass |
|---|---|---|
| Music bed −18 to −22 dB | −20.0 dB (−36.0 LUFS) | ✅ |
| SFX −8 to −14 dB | −9 to −14 dB (momentary max per type: appear −12, count −14, compare −11, threshold-cross −9, reveal −9, dismiss −13, transition −12, emphasis −9) | ✅ |
| Ambience about −40 dB | −40.0 dB (−56.0 LUFS) | ✅ |
| Exactly 8 SFX types, one fixed sound each | 8 types, 102 events: appear 24, count 43, transition 17, emphasis 6, dismiss 4, compare 3, reveal 3, threshold-cross 2 | ✅ |
| SFX within 60 ms of the visual event | **max 33.3 ms, mean 17.3 ms**, 102/102 measured | ✅ |
| SFX active 30–40% of duration | **34.9%** | ✅ |
| Music silence 300–500 ms before decisive numbers, max 3 | 3 × 400 ms: 65.0 s → 6.70% lands; 108.8 s → crossing at month 38; 113.1 s → +$459 | ✅ |
| Final mix (report only) | **−31.1 LUFS integrated, −13.5 dBTP true peak** (own meter and ffmpeg agree) | — |

How these were measured:
- **Sync:** the audio onset is the argmax of the cross-correlation between `sfx.wav` and that type's fixed buffer (±150 ms search). The visual onset is the first rendered frame whose DOM carries the event's `data-ev` probe at opacity > 0.02. Audio leads by 17 ms on average because visuals are quantized to the next 33 ms frame.
- **SFX density:** the share of 50 ms windows where the SFX layer is above the room-tone RMS (−56.8 dBFS).

Music is one tonal identity: D minor/dorian pads, and the chord changes on every cut. The texture changes by section:

| Section | Texture | Spectral centroid |
|---|---|---|
| Setup | Pad only | 1151 Hz |
| Sweep | Adds a sub and a quiet 8th-note root/fifth pulse (rhythm, no melody) | 639 Hz |
| Tension | Darker filter, filtered-noise swells | 806 Hz |
| Resolution | Open voicing, fade | 694 Hz |

## Self-score: 8 criteria per keyframe

Legend: ✅ pass, ⚠️ partial (counted as fail).

Evidence behind every row: `out/checks.json` has 0 issues on all five keyframes. That covers the safe area, overlaps, digits from claims, token colors, sizes and weights, and Inter. Ink coverage and grayscale deltas are in `out/keyframe-metrics.json`.

| Criterion | establishing | slider mid-sweep | crossover | break-even detail | downside path |
|---|---|---|---|---|---|
| 1 Readable at 25% | ✅ 5.2% (32 px) and the question (12 px) read | ⚠️ 6.00% counter and $ labels read; 28 px captions are 7 px | ✅ 6.70% reads; A/B labels are soft | ✅ 6.70% + caption | ✅ "38" reads; the line label is soft |
| 2 One focal point | ✅ l1 "5.2%" | ✅ bar B + counter move together; everything else is static | ✅ 6.70% beside the crossing point | ✅ | ✅ "38" at the crossing |
| 3 Negative space | ✅ ink 1.6% | ✅ 5.3% | ✅ 1.6% | ✅ 2.1% | ✅ 1.6% |
| 4 Three-level hierarchy | ✅ 128/48/28 | ⚠️ 48/600 · 28/600 · 28/400: three levels by weight, only two sizes | ✅ 128 / 28-600 / axes | ✅ 128/48 + grid | ✅ 128/48/28 |
| 5 Worst-case data | ✅ | ✅ Bar B at 10% (largest) keeps its label inside the frame; the counter's longest value "10.00%" was checked in every sampled frame | ✅ | ✅ | ✅ Longest labels checked frame by frame; 0 issues across 1,278 samples |
| 6 Grayscale | ✅ | ✅ A solid vs B hatched; luma Δ accent/warn = 49.5 | ✅ A solid vs B dashed | ✅ | ✅ B dashed, A baseline solid |
| 7 Room for motion | ✅ | ✅ Top third reserved for bar B's growth | ✅ | ✅ | ✅ |
| 8 Tokens only | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Score** | **8/8** | **6/8** | **8/8** | **8/8** | **8/8** |

## Known weaknesses

1. **The $400/month extra is our assumption.** The break-even returns barely move with it (6.708 / 6.699 / 6.693% at $300 / $400 / $500 extra, 22% tax), but the dollar amounts ($1,190, $459) scale with it.
2. **Simplified tax.** One liquidation at month 48 at the ordinary bracket rate, with no long-term capital-gains rates, no loss credit, and no state tax. Loan interest is treated as non-deductible. Some 2025–2028 new-vehicle loans are now deductible; we did not model that.
3. **The certainty framing is exact only for the payoff leg.** After month 28, road A also invests and carries market risk. The downside scene shows this honestly (both lines fall), but the two-column card simplifies it.
4. **One stated bad sequence** is shown, not a distribution. Stated on screen as "not a forecast", by design.
5. **Tight word budgets.** Several scenes sit exactly at 1.5 new words/s or 12 words, so small copy edits break the limits (the checker catches this).
6. **Shot mix by time** is medium-heavy (58.7%). The limit is met by scene count, which is how the brief states it.
7. **Stillness is camera and background only.** The landing number still eases in during the 0.8 s window.
8. **The encoded video is not exactly on-token.** It is yuv420p, so token colors shift by a few code values, and cross-fades and anti-aliasing create in-between colors. The checkers validate the authored DOM/SVG, not decoded pixels.
9. **Canvas graphics bleed past the safe margin.** In wide and close shots the continuous canvas intentionally runs off-frame; only text is held to the safe area (text fades out within 16 px of it).
10. **No narration was recorded,** so real TTS timing may drift from the per-scene wpm. The integrated mix is −31 LUFS because the 0 dB narration layer is absent.
11. **Render cost.** ~6.7 min per full render on 4 cores. A camera change means a full re-render; per-scene caching would fix that.
