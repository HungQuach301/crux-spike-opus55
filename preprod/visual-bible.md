# Visual bible — "Same average, different fate" (M2b lookdev)

This replaces the M1/M2 motion-graphics look (cards, donuts and bars on a vignetted dark floor). The film now takes place in
**one physical world**, and the data are objects in it. Style frames: `preprod/style/*.png` (taken from the lookdev render,
so the frames and the film are the same pixels). Engine: `render-d/look/` (three.js, WebGL2).

## 1. The world

| thing | what it is | what the data does to it |
|---|---|---|
| **Tank** (one per retiree) | a glass box, 1.6 × 2.6 × 1.6 m, brass corner frame, steel plinth | the liquid inside is the retiree's money in 1966 dollars; **level = real balance** (same scale for both tanks: 2.3 M$ = full) |
| **Stream** | a thin jet from a brass spout at the plinth into a shallow pool | the **withdrawal**; it flows while there is money, sputters to drips when the tank is empty (1966 tank: 1991) |
| **Road** | 30 stones, 1966 nearest, 1995 furthest, 2.2 m apart, low kerb stones either side | **stone height = that year's real 60/40 return** (0.9 m + 2.6 m × return). Bad years are low steps: 1973 and 1974 are the dip in the road |
| **Ground** | dry soil at dawn/dusk, wet and dark in the storm | — |
| **Sky** | physical sky (sun elevation/azimuth), a cloud dome of moving noise, horizon haze into the fog | the sun's arc is **time**: the cold open's time-lapse moves 25 years as one arc from dawn to sunset |
| **Air** | sunlit dust at dawn/dusk; rain streaks, gusts and one lightning strike in the storm | inflation is weather: the storm thickens when "prices rise 12.3%" |

Characters keep their colour, shape and side from M1/M2: **1966 retiree = amber `#FFC857`, left**; **mirror retiree =
blue `#5A9CEB`, right** (illustrative). The tanks are the characters; nothing else in the world uses those two colours.

## 2. Materials (PBR)

| material | model | values | notes |
|---|---|---|---|
| glass | standard, transparent | opacity 0.12, roughness 0.02, reflections from the sky (env map ×2.2) | the sky and the sun are what you see in it |
| brass frame / spout | metal | metalness 1, roughness 0.28, `#B08D57` | catches the key light; rim at dusk |
| steel plinth | metal | metalness 1, roughness 0.32 | |
| liquid | standard, transparent | character colour ×0.55, opacity 0.93, small self-glow (0.22) so the colour survives cold light; rippling surface (24×24 grid, waves; stronger in rain) | |
| stone | standard | procedural albedo + roughness maps, bevelled edges (7 cm), per-stone tint | roughness drops to 0.55 when wet |
| soil | Lambert | procedural albedo, ×0.55 when wet | Lambert on purpose: large and rough, and 45% cheaper than image-based lighting |

## 3. Light by act (key / fill / rim, all motivated)

| act | key (source) | fill | rim | air | grade |
|---|---|---|---|---|---|
| cold open — dawn 1966 | low sun ahead-left down the road, 1–4°, warm `#FFB070`, soft shadows | sky hemisphere, cool | the sun behind the tanks (backlight) | light fog 0.0065, sunlit dust, sun shafts | warm highlights, lifted cool shadows |
| time-lapse 1966→1991 | the sun arcs over the road (4° → 42° → set) | sky | — | shadows sweep across the road | — |
| dusk (after 1986; the question) | sun below the horizon, red sky | sky, violet | warm sky behind the mirror tank | fog 0.012, dust | slight saturation |
| act 2 — storm 1973–74 | overcast, high, cold `#BFD1F2`, soft | sky hemisphere, grey-blue | cool sky | dense fog 0.045, rain (7,000 streaks, heavier after "12.3%"), one lightning strike on "14.7%" | cooler, sat 0.95 |

## 4. Lens kit

24 mm (establishing, crane), 28 mm (walks along the road, the storm profile), 38–45 mm (medium: the time-lapse, both
tanks in the storm), 50 mm (close: the rack between the tanks). No lens longer than 50 mm in the lookdev: in this
world the depth between the two tanks is the point, and a longer lens flattens it. Aperture per shot as a CoC gain
(background blur 6–12 px at 1080p); the depth of field is gathered from the depth buffer.

## 5. Camera grammar

- Every move has a reason in the story: **crane down** from the sky to the two tanks (arrive in 1966); **truck left
  with the time-lapse** to end on the tank that runs dry; **push in** on the question; **walk down the road** into
  the storm (the next years come toward you); **profile** of the road for the 1974 stone (you see the dip);
  **push in** on the 1966 tank for its balance.
- Inertia: a small wind-up (−1%), eased travel, a 2% overshoot that settles. No cuts inside a move.
- **Rack focus between the two tanks** on the story turns ("what *decided* it?"; "the 1966 *retiree*").
- **Match cuts** (planned for M3): calendar page → year stone; the sun's arc → the next act's light.
- Motion blur: 180° shutter. The lookdev renders a sharp full-resolution centre pass plus a motion-blur residual from
  4–8 half-resolution subframes (4 static shots, 6 in rain, 8 in the time-lapse), then FXAA.

## 6. Text rules

- Minimal text. Numbers appear **in the world**: anchored to the object they belong to (above the tank, above the
  stone), placed against sky or fog, never over a tank or a stone.
- A decisive number gets a clean label: Inter 700, ≥ 52 px (≥ 13 px at 25%), character colour (1966 amber) or the
  semantic token (loss `#E8766A`, inflation `#C98BD8`), soft dark shadow; contrast ≥ 4.5:1 against the sky/fog behind it.
- Basis travels with money: "$461,000" + "in 1966 dollars" (34 px) directly under it.
- One level-1 text at a time. Years as labels only when spoken ("1973", "1974").
- The title (ident) is the only centred text.

## 7. Always-on physical motion (with a cause)

Water ripples and streams (money being withdrawn), dust drifting in the sun, clouds moving, the sun moving
(time), rain and gusts (the storm), the 1974 stone sinking twice (the loss, then inflation). No motion is added to pass
a threshold.

## 8. Sound of the world

Water from each spout panned with its tank (the 1966 stream stops at 1991; drips after), wind (light at dawn, gusts in
the storm), rain (heavier after "12.3%"), stone grinding as the 1974 stone sinks, thunder 0.55 s after the lightning.
Music, voice, ducking and master as in M2 (cue sheet `out/m2b/root/out/cues.json`).
