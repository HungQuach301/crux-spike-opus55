# CRUX — conventions for test C (car loan 5.2%: pay off early or invest)

Written before any chapter was built. Every chapter follows this file; the checkers in
`render-av/rules.js` and `render-av/check.js` enforce the parts marked **[checked]**.

## 1. Colour tokens (the existing CRUX set, nothing else) [checked]

| Token | Hex | Grey luma (Rec.709) | Contrast vs bg | Use |
|---|---|---|---|---|
| bg | `#0E1116` | 17 | — | Page background |
| surface | `#171B22` | 27 | 1.1 | Pills, hatch gaps |
| ink | `#F2F4F7` | 243 | 17.3 | Body text, thresholds, neutral numbers, emphasis |
| ink-muted | `#9AA4B2` | 162 | 7.5 | Captions, secondary labels |
| accent | `#4C8DFF` | 135 | 5.9 | **Road B** (invest) |
| warn | `#F2B441` | 185 | 10.3 | **Road A** (pay off early) |
| positive | `#3FBF7F` | 159 | 8.1 | Long-term lots; the word "certain" |
| negative | `#E5484D` | 106 | 4.8 | Short-term lots; negative returns |
| grid | `#2A303B` | 48 | 1.5 | Axes, baselines, principal, background dots |

The CRUX wordmark and the thumbnail use only these tokens.

## 2. Data series → colour and pattern (fixed for the whole video) [checked]

| Series | Colour | Stroke / fill | Grey-scale cue |
|---|---|---|---|
| Road A — pay off early | warn | solid 5 px line; solid fill | brightest series |
| Short-term share / long-term share (bars) | negative hatched / positive | — | hatch |
| Road B — invest | accent | dashed line `14 10`; hatched fill (accent stripes on surface) | dashes / hatch |
| Gap B − A (one line) | accent above zero, warn below zero | solid 5 px | sign is labelled in words |
| Loan principal | grid | solid fill | neutral |
| Long-term lot | positive | solid cell | — |
| Short-term lot | negative | hatched cell | hatch |
| Negative-return period | negative | solid strip | labelled with its value |
| Break-even / threshold | ink | 12 px dot, dashed guide | brightest |

- A number that annotates a series uses that series' colour, or a neutral colour (ink or ink-muted). It never uses another series' colour. Elements carry `data-series="A|B|gap|lt|st|neg"`. **[checked: rule `number-colour`]**
- Road A was accent in test B. It is warn here, so that Road A's decisive numbers (interest avoided, months free, the downside gap) can be the emphasis without sinking in grey scale (see §5).

## 3. Type [checked]

Inter only. Tabular numerals in every number.

| Level | Class | Size / weight | Use |
|---|---|---|---|
| 1 | `l1` | 128 / 700 | One per chart scene: the number or word the scene is about |
| 2 | `l2`, `l2b` | 48 / 600, 48 / 700 | Headlines, secondary numbers |
| 3 | `l3`, `l3s` | 28 / 400, 28 / 600 | Captions, axis ticks, badges |

- Maximum 12 on-screen words per scene; at most 1.5 new words per second.
- Text stays inside the safe area (96 px from each edge). Text that would leave it fades out instead of clipping.

## 4. Shot sizes (virtual camera scale) [checked]

wide < 0.6 ≤ medium < 1.3 ≤ close < 2.4 ≤ detail. The target mix by scene count is wide 20 / medium 40 / close 30 / detail 10 (±8 points each).

Canvas and camera are those of test B: one SVG world, a camera (x, y, scale), non-scaling strokes, and screen-space text anchored to world points. Motion tokens are unchanged:

- drift 8 px/s
- stagger 60 ms
- back-out overshoot 4%
- parallax 0.3 / 1.0 / 1.3
- camera move = min(1.2 s, half the scene)
- 0.8 s stillness when a decisive number lands

## 5. Composition rules (the five test-B defects, each a machine rule) [checked]

1. **Scene isolation.** Every panel is tagged `data-panel`, and every scene lists the panels it may show. Once the camera move has finished, no element of another panel may be visible inside the frame. Panels leave by fading to 0, not by dimming to 0.35. **[rule `scene-leak`]**
2. **Background under data.** Background layers (dot patterns) are painted before every data element. No background element comes after a data element in paint order. **[rule `bg-over-data`]**
3. **Every curve is labelled.** A path with curve commands or three or more vertices carries `data-label` naming a text element. That text is visible (opacity > 0.5) in the same frame and within 240 px of the curve. **[rule `unlabelled-curve`]**
4. **One viewpoint, one level-1 element.** Every chart scene of 2 s or more shows exactly one `l1` for at least 50% of its frames, and no frame shows two. Everything that animates at once lies inside one region: the bounding box of the changing elements is at most 60% of the frame width and 60% of the frame height. **[rules `level1`, `split-view`]**
5. **Line charts have axes and anchors.** A series line (`data-kind="series"`) is drawn only while its chart's axis (`data-kind="axis"`) and at least two numeric anchor labels (`data-anchor`, same `data-chart`) are visible. **[rule `axis-anchors`]**
6. **Emphasis survives grey scale.** The emphasis element (the `l1`, or anything marked `data-emph`) has a grey contrast of at least 7:1 against bg. No other visible text of 48 px or more is brighter in grey. So emphasis is ink or warn; accent, positive and negative are never the emphasis colour. **[rule `grey-emphasis`]**
7. **Number colour = series colour** (§2). **[rule `number-colour`]**

8. **Bars keep their data proportion.** A bar (`data-kind="bar"`) may not run off the frame along its value axis unless an axis break (`data-kind="axis-break"`) is shown. Settled bars of one chart that carry `data-value` share one scale (±3%). Close shots of bars either show their full length or hide the bars. **[rule `bar-proportion`]** *(added after the midpoint)*
9. **ILLUSTRATIVE badge on screen with every illustrative number**, in the same frame. Chart ticks inside the ILLUSTRATIVE return range count as illustrative numbers. **[rule `illustrative-badge`]** *(added after the midpoint)*
10. **Text never touches a line.** No point of a visible stroked line, path or outline (sampled every 3 px on screen) falls inside a visible text box. The glyph band is the box minus 2% top and bottom, because Inter's ascent + descent fill a 1.2 line box. **[rule `text-line-collision`]** *(added after the midpoint)*
11. **No layout more than twice in any 90 s window.** **[rule `layout-repeat`]** *(added after the midpoint)*
12. **Rules judge settled shots.** During the camera move at the start of a scene, `scene-leak`, `split-view`, `bar-proportion`, `unlabelled-curve`, `axis-anchors` and `text-line-collision` are skipped. `bg-over-data`, `grey-emphasis`, `number-colour` and `illustrative-badge` apply to every frame.

Chart labelling in practice:
- A level-1 header hands over to the scene's number at its word (`heroSwap`), so exactly one l1 is on screen.
- A series carries a small series label ("B − A") next to its line wherever the l1 handover would leave a gap.
- A label that belongs to a chart continuing into the next scene stays at opacity ≥ 0.5 until the cut.

Extra measure, reported without a threshold: **visible motion** is the share of frames in which at least 0.5% of pixels change by more than 4 luma levels.

## 6. Counters and numbers on screen [checked]

- Every digit on screen comes from a claim span (`<span class="n" data-claim>`), and a settled span equals its claim's display exactly.
- **A spoken number appears at its word.** Visual onset is the first frame in which the claim span's effective opacity is ≥ 0.5. It must fall within ±250 ms of the onset of the spoken number (faster-whisper word start). To get there, the fade (0.35 s) starts 0.175 s before the word onset taken from the voice alignment.
- A spoken number is introduced fresh at its word: a new element, or the old one re-entering. It is never "already on screen".
- **Sync is measured on the FINAL value** (changed after the midpoint): the first frame in which a span of the claim shows its settled display (no `data-roll`) at opacity ≥ 0.5, within ±250 ms of the faster-whisper word start.
- **No rolling counters for single numbers** ($578, $2,744, $1,554 and every other spoken amount appear settled at their word). Rolling or stepping displays are kept only for quantities that accumulate or sweep over time, and each value they show is itself a claim (the sweep counter shows `r_k` claims; month ticks are axis claims).
- Formats:
  - dollars: `$1,190` (no cents)
  - negative dollars: `−$459`
  - percent: one or two decimals as in the claim (`5.2%`, `6.11%`)
  - negatives use U+2212 `−`
  - years: `2025–2028`
- **ILLUSTRATIVE** values ($400/month; the 2%–10% range; the 8% then −20% sequence) carry an `ILLUSTRATIVE` badge whenever they are on screen: `l3s`, ink-muted, uppercase, in a surface pill with a 2 px grid border.
- Wording: "average annual return (compounded)", never "expected return".

## 7. Voice and script

- The voice is provisional, not a casting decision.
  - Persona: calm, precise, warm analyst; General American; 150–160 words per minute of speech.
  - Settings: OpenAI `gpt-4o-mini-tts`, voice `cedar`, style set by instructions.
- **Pace** (tightened after the midpoint): every chapter reads at 150–160 wpm, measured as words / clip time. No sentence exceeds 175 wpm, measured as words / speech span, where the speech span runs from the first to the last loud 10 ms window.
  - The TTS ignores pace instructions: it reads short sentences at 180–300 wpm.
  - `audio/av_retime.py` therefore cuts each clip into sentences at the TTS's own pauses. It time-stretches any sentence faster than the chapter's target (ffmpeg rubberband, pitch and formants kept, at most −25%), and rejoins the sentences with a fixed pause.
  - The target and the pause are solved per chapter.
  - A scene whose sentence is still too fast after the stretch limit, or whose ASR hears less than 92% of the script words, gets a new TTS take (`audio/av_pace_loop.sh`).
- **Word coverage:** faster-whisper must hear ≥ 92% of each scene's script words. The TTS sometimes drops a whole sentence; the midpoint's aligner had silently interpolated over such gaps.
- "We" means the analyst. There is no advice to the viewer and no market prediction.
- Every number in the script is a claim marker `{claimId}`; bare digits and number words in the script are rejected by a test. The narration's display text (numbers as on screen) is the source for subtitles. The spoken text is produced from it by `src/av/normalize.js`.
- Picture follows voice. Scene length = ceil((0.25 s lead + voice + 0.30 s tail) / 0.6 s beat) beats. Anchors (`^name` markers, number markers) take their times from faster-whisper word timings.

### Pronunciation dictionary (`src/av/normalize.js`, `PRONOUNCE`)

| Written | Sent to TTS as |
|---|---|
| CRUX | crux |
| APR | A-P-R |
| US | U.S. |
| vs | versus |
| ILLUSTRATIVE | illustrative |

Numbers:
- `$1,190` → "one thousand one hundred ninety dollars"
- `5.2%` → "five point two percent"
- `−20%` → "minus twenty percent"
- `month 28` → "month twenty-eight"
- `2025–2028` → "twenty twenty-five to twenty twenty-eight"
- `6.11%` → "six point one one percent"

## 8. Sound (test B's accepted design, unchanged, plus voice)

| Layer | Level (0 dB = −16 LUFS, before master) |
|---|---|
| Voice | 0 dB (−16 LUFS integrated) |
| Music bed | −20 dB, sidechain-ducked under voice |
| SFX, 8 types | −9 to −14 dB momentary max, the same 8 buffers as test B |
| Ambience | −40 dB |

- Music generation, the SFX bank, relative levels and density are imported from `audio/generate.py` unchanged. Scene lengths are whole beats at 100 BPM.
- At most 3 music silences (400 ms), each before a decisive number.
- Master: +2 dB then a true-peak limiter, giving −14 LUFS ±1 integrated and ≤ −1 dBTP. AAC 48 kHz.

## 9. Subtitles

The text comes from the script, never from ASR, timed by word timings. Each cue has at most 42 characters per line and at most 2 lines, and lasts 1–7 s.

## 10. Chapters

| Chapter | Scenes | Music section |
|---|---|---|
| Hook (20–30 s) | hook1–hook5 | setup |
| CRUX ident | ident | setup |
| Setup and scope | scope1, scope2, facts, extra, roads, cash | setup |
| 1 The certain part | card1, timeline, free, morphInt, interest, avoided, certain, identity, bridge | setup |
| 2 Tax by lot | card2, lots1, lots2, rates, lots3, share, nodeduct | setup |
| 3 Return sweep and break-even | card3, sw1–sw5 | sweep |
| 4 Sensitivity to the tax bracket | card4, niit, morphDot, dots, dots32, rises, below | sweep |
| 5 Risk and one bad sequence (ILLUSTRATIVE) | card5, risk1, risk2, seq, race, morphGap, gap, downside, order | tension |
| Close: a threshold, not a forecast | recap, end1, end2, outro | resolution |

## 11. Tax model (after the midpoint)

- The 32% bracket carries the 3.8% net investment income tax on both rates: 35.8% short-term, 18.8% long-term.
- State income tax is ignored, and this is said on screen (`nodeduct`, `niit`).
- Losing lots get no deduction.
- Loan interest is not deductible; the 2025–2028 new-vehicle loan interest deduction is ignored (on screen in `scope2`).
