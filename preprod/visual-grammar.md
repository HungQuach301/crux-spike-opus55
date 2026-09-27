# Visual grammar — "Same average, different fate" (M2c)

One rule above all: **every object is a variable, and every change you see has its cause in the same frame.**
Anything that carries no meaning is removed or pushed into the soft background (ground, sky, far dust).
Engine: `render-d/look/world.js`; data: `render-d/look/data.js` (from `out/model.json` and `data/normalized/annual.csv`).

## 1. Objects and what they mean

| object | variable | unit / scale | introduced (act 1) | narration line that introduces it | how it is labelled |
|---|---|---|---|---|---|
| **Road of 30 stones** | time | one stone = one calendar year, 1966 (near) → 1995 (far), 2.2 m apart | a1-horizon | a1-horizon.1 "The plan runs for 30 years, from 1966 through 1995." | the year is **carved on both faces** of every stone (read when the stone is close; far stones are texture) |
| **Stone height** | that year's 60/40 return — the same 30 numbers both retirees live through, in opposite order | top = road level + 4.5 m × return (1974, −14.7 % → 0.66 m below the rails; 1995 → 1.3 m above); road level = 0 %; a losing year's top is **below the rails** | a1-horizon | a1-horizon.2 "Each stone on this road is one year's return; a losing year sinks below the road." | one-time caption on a dark plate: "each stone = one year's real return" |
| **Road level (the two rails)** | 0 % return | the rails run along both edges at road level | a1-horizon | (same line) | the rails are the zero line; no text |
| **Glass tank** | the retiree's balance | liquid level = real balance (1966 dollars); one scale for both tanks: full = 2.3 M$ (the highest balance either reaches × 1.12) | a1-start | a1-start.2 "Their money is the water in this glass tank." | one-time caption: "water = balance, in 1966 dollars"; balances as numbers on a dark plate **attached to the tank** (moves with it) |
| **Tank on the road** | where the retiree is in their 30 years | the tank stands on the stone of the year it is living; it rides up and down with the stones | a1-horizon | a1-horizon.3 "As the tank passes each stone, the water rises or falls with that year." | — |
| **Level change on a stone** | that year's gain or loss | the tank stands on the stone for the whole year: first the tap pours the withdrawal (level drops by $40,000 in 1966 dollars), then the level moves by the stone's return and that year's inflation to the balance at the end of the year, then the tank steps to the next stone: **cause (stone) and effect (level) in the same frame**. A tall stone always raises the water, a sunk stone always lowers it; a low positive stone in a year of high inflation can still lower it (that is the inflation lesson of act 2) | a1-horizon | (same line) | — |
| **Tap and stream** | the withdrawal | stream thickness ∝ √(nominal withdrawal / $40,000): it widens as prices rise; it pours at the start of each year | a1-raise | a1-raise.2 "The tap is that withdrawal, and it widens as prices rise." | one-time caption: "tap = withdrawal"; "$40,000" at a1-rule.2 on the plate of the 1966 tank |
| **1966 tank** | the 1966 retiree | amber `#FFC857` liquid, **solid** brass rim, **left lane**, walks 1966 → 1995 (toward the far end) | a1-start | a1-start.1 | its numbers ride on a plate above it |
| **Mirror tank** | the mirror retiree (illustrative) | blue `#5A9CEB` liquid, **dashed** brass rim, **right lane**, walks the **same road the other way**, 1995 → 1966 | a1-mirror-in | a1-mirror-rule.3 "So the mirror tank walks the same road, the other way." | "mirror retiree" plate at a1-mirror-in; ILLUSTRATIVE badge on top of every mirror number |
| **Storm cell** | the 1973–74 bear market and inflation | a dark cloud with rain and fog that sits **over the 1973–74 stones** (a place, not a time); a tank is in the storm only while it is on those stones | cold open (seen from afar) | a2-7374.1 "…lose money in 1973 and 1974." | "1973", "1974" carved; spoken years on plates |
| **Light (sun)** | context of time in the story | dawn at the 1966 end, dusk toward the 1995 end; the cold-open time-lapse is one arc of the sun | cold open | — | — |
| ground, sky, far dust | nothing | soft background: low contrast, out of focus | — | — | — |
| ~~kerb stones~~ (M2b) | nothing | **removed** | | | |

## 2. Colour and value (for grayscale and colour-blind viewers)

The two liquids differ in **hue and in value**: the 1966 liquid is light amber (albedo 0.9 × `#FFC857`, self-glow 0.45),
the mirror liquid is a darker blue (albedo 0.5 × `#5A9CEB`, self-glow 0.2), so the amber stays lighter than the blue in
grayscale and keeps its hue under the cold storm light (the storm grade no longer desaturates). The 1966 tank has a
**solid** brass rim, the mirror tank a **dashed** (segmented) rim — a shape cue that survives any colour vision.
Checked on stills in grayscale and under a deuteranopia / protanopia simulation (`preprod/style-m2c/`).

## 3. Labels

- Dark plate (`#0B0F17` at 78 % opacity, 10 px radius) behind every number, text ≥ 4.5:1 against the plate, font ≥ 34 px
  (≥ 8.5 px at 25 %).
- A balance label is **attached to its tank**: anchored 0.5 m above the tank's top, it moves with the tank.
- Teaching captions appear once, at the line that introduces the object, and fade after the line.
- A number's plates form one stack (ILLUSTRATIVE badge, value, basis from top to bottom) that moves as one piece.
- Labels are placed by the projected screen box, and pushed up/sideways until they do not overlap a tank or a
  stone (checked by V11 against the graphics mask). Carved years are part of the stone surface, not labels: a spoken
  year also gets a plate.

## 4. Camera

- The camera follows the 1966 tank as a travelling companion in act 1 (its lane on the left); it looks across to the
  mirror lane when the mirror enters.
- Foreground rule: no stone between the camera and a tank or a label. The camera stays at least 2.5 m above the road
  when it looks along the road, or beside the road (outside the rails) for profiles.
- Racks between the two tanks on story turns.

## 5. Time mapping

| story time | picture |
|---|---|
| a year of the retiree's life | the tank crosses one stone (2.2 m) |
| cold-open time-lapse (25 years in 2.3 s) | both tanks cross 25 stones in opposite directions and pass each other in the middle of the road |
| act 1 (no years pass) | tanks stand at their start stones (1966 tank on 1966; mirror tank on 1995) |
| act 2 1973–74 | the 1966 tank crosses the 1973 and 1974 stones inside the storm; the mirror tank is on 1987–86 in clear light (its years 8–9) |
