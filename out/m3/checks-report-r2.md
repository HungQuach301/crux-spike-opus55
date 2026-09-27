# checks/ report

root: `/home/user/crux-spike-opus55/out/m3/root`  
lock: `0478df7377b754137071e202c2ff396d7deba94293823cabf5f18932c411c612`  
{'PASS': 58, 'FAIL': 13, 'MISSING': 0, 'ERROR': 0}

| rule | § | status | failing metrics |
|---|---|---|---|
| F01 | §0, §6 | PASS |  |
| F02 | §0, §6 | PASS |  |
| F03 | §6 | PASS |  |
| F04 | §6 | PASS |  |
| F05 | §6 | PASS |  |
| F06 | §6 | PASS |  |
| F07 | §0 | PASS |  |
| F08 | §4.4 | PASS |  |
| F09 | §6 | PASS |  |
| F10 | §6 | PASS |  |
| A01 | §5.6 | PASS |  |
| A02 | §5.6 | PASS |  |
| A03 | §5.6 | PASS |  |
| A04 | §5.6 | PASS |  |
| A05 | §5.6, §6 | PASS |  |
| A06 | §5.6 | PASS |  |
| A07 | §5.5 | PASS |  |
| A08 | §5.5 | PASS |  |
| A09 | §5.3 | PASS |  |
| A10 | §5.3 | PASS |  |
| A11 | §5.3 | PASS |  |
| A12 | §5.2 | PASS |  |
| A13 | §5.4 | PASS |  |
| A14 | §5.4 | PASS |  |
| A15 | §5.4 | FAIL | wpm act act1 = 146.810053 (need in [150.0, 160.0]); wpm act act2 = 146.065397 (need in [150.0, 160.0]); wpm act act3 = 144.750795 (need in [150.0, 160.0]); sentences > 175 wpm = 10 (need <= 0) |
| S01 | §1.2 | PASS |  |
| S02 | §1.2 | PASS |  |
| S03 | §1.3 | PASS |  |
| S04 | §1.3 | FAIL | used years missing in a source = 3 (need <= 0) |
| S05 | §1.4 | PASS |  |
| S06 | §1.4, §1.7 | PASS |  |
| S07 | §1.5 | PASS |  |
| S08 | §1.5 (C rule 9, upgraded) | PASS |  |
| S09 | §1.5 | PASS |  |
| S10 | §1.6 | PASS |  |
| S11 | §2.4 | PASS |  |
| S12 | §2.5 | FAIL | max new numbers in a scene = 4 (need <= 2) |
| S13 | §2.6 | PASS |  |
| S14 | §2.8 | PASS |  |
| S15 | §0, §2.1 | PASS |  |
| R01 | §3.1 | FAIL | false peaks = 2 (need <= 0) |
| R02 | §3.2 | PASS |  |
| R03 | §3.3 | FAIL | shortest pause s = 0.11 (need >= 1.0); pauses < 1.0 s = 5 (need <= 0) |
| R04 | §3.4 | PASS |  |
| R05 | §3.5 | PASS |  |
| R06 | §3.4, §3.5, §4.6 (picture check) | FAIL | cuts visible in picture (%) = 69.607843 (need >= 90.0) |
| V01 | §4.1 | PASS |  |
| V02 | §4.2 | PASS |  |
| V03 | §4.2 | FAIL | text outside safe area = 28 (need <= 0) |
| V04 | §4.3 | PASS |  |
| V05 | §4.3 | FAIL | worst ease ratio = 0.65 (need <= 0.4); overshoot > 8% = 3 (need <= 0) |
| V06 | §4.3 | PASS |  |
| V07 | §4.3 | FAIL | median blur ratio = 1.186493 (need <= 0.8) |
| V08 | §4.4 | FAIL | worst text contrast = 3.74 (need >= 4.5); samples below 4.5:1 = 68 (need <= 0) |
| V09 | §4.4 | PASS |  |
| V10 | §4.6 | PASS |  |
| V11 | §4.7 (C rule text-line-collision, upgraded to pixels) | FAIL | text collisions = 35 (need <= 0) |
| C01 | §4.7 (C rule scene-leak) | PASS |  |
| C02 | §4.7 (C rule bg-over-data) | PASS |  |
| C03 | §4.7 (C rule unlabelled-curve) | PASS |  |
| C04 | §4.7 (C rule axis-anchors: "nhãn trục có neo") | FAIL | frames flagged = 364 (need <= 0) |
| C05 | §4.7 (C rule grey-emphasis: "hiểu được ở thang xám") | PASS |  |
| C06 | §4.7 (C rule number-colour) | PASS |  |
| C07 | §4.7 (C rule bar-proportion: "tỷ lệ cột đúng") | PASS |  |
| C10 | §4.7 (C rule level1) | PASS |  |
| C11 | §4.7 (C rule layout-repeat) | PASS |  |
| C12 | §4.7 (C rule split-view) | PASS |  |
| C13 | §4.7 ("đồng bộ số–lời ±250 ms theo giá trị cuối") | FAIL | worst |offset| ms = 347 (need <= 250.0); pairs > 250 ms = 1 (need <= 0) |
| C14 | §4.7 ("đọc được ở cỡ 25%") | PASS |  |
| C15 | §4.7, §4.4 ("chỉ dùng token") | PASS |  |
| P01 | §7 | PASS |  |

## Metrics within 5% of a threshold

- A12 accents on a cut (%) = 100.0 (threshold >= 100.0)
- A15 wpm act cold-open = 155.378486 (threshold in [150.0, 160.0])
- A15 wpm act act1 = 146.810053 (threshold in [150.0, 160.0])
- A15 wpm act act2 = 146.065397 (threshold in [150.0, 160.0])
- A15 wpm act act3 = 144.750795 (threshold in [150.0, 160.0])
- A15 wpm act method = 156.133829 (threshold in [150.0, 160.0])
- A15 wpm act outro = 151.079137 (threshold in [150.0, 160.0])
- S04 stocks tolerance pp = 0.5 (threshold <= 0.5)
- S05 geomean claims shown = 2 (threshold >= 2)
- S06 start years shown in act 3 = 69 (threshold >= 69)
- S11 core claims = 1 (threshold >= 1)
- S11 g1966 callbacks w/ distinct meaning = 3 (threshold >= 3)
- S14 ad breaks = 2 (threshold in [2, 3])
- S15 cold open s = 14.83 (threshold <= 15.0)
- R01 acts with climax peak = 3 (threshold >= 3)
- R05 act-2 last/first mean = 0.777353 (threshold <= 0.8)
- V04 sides used = 1 (threshold <= 1)
- V04 1966 colour share = 0.987208 (threshold >= 0.95)
- V07 subframes = 8 (threshold >= 8)
- P01 thumb 1 token share (%) = 100.0 (threshold >= 97.0)
- P01 thumb 2 token share (%) = 100.0 (threshold >= 97.0)
- P01 thumb 3 token share (%) = 100.0 (threshold >= 97.0)
