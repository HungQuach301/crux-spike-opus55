# checks/ report

root: `/home/user/crux-spike-opus55/out/m2b/root`  
lock: `0478df7377b754137071e202c2ff396d7deba94293823cabf5f18932c411c612`  
{'PASS': 32, 'FAIL': 38, 'MISSING': 1, 'ERROR': 0}

| rule | § | status | failing metrics |
|---|---|---|---|
| F01 | §0, §6 | PASS |  |
| F02 | §0, §6 | PASS |  |
| F03 | §6 | PASS |  |
| F04 | §6 | PASS |  |
| F05 | §6 | PASS |  |
| F06 | §6 | PASS |  |
| F07 | §0 | FAIL | duration s = 42.3 (need >= 600.0) |
| F08 | §4.4 | FAIL | worst banding (%) = 15.026042 (need <= 5.0) |
| F09 | §6 | PASS |  |
| F10 | §6 | FAIL | chapters = 2 (need >= 3) |
| A01 | §5.6 | PASS |  |
| A02 | §5.6 | PASS |  |
| A03 | §5.6 | PASS |  |
| A04 | §5.6 | PASS |  |
| A05 | §5.6, §6 | PASS |  |
| A06 | §5.6 | PASS |  |
| A07 | §5.5 | PASS |  |
| A08 | §5.5 | FAIL | median 1-4 kHz drop dB = -0.337351 (need >= 6.0); median band-limited excess dB = 1.046188 (need >= 3.0) |
| A09 | §5.3 | FAIL | silences 0.8-1.5 s = 2 (need >= 3) |
| A10 | §5.3 | PASS |  |
| A11 | §5.3 | FAIL | events measured = 6 (need >= 8) |
| A12 | §5.2 | FAIL | accents = 2 (need >= 5); accents confirmed by onset (%) = 50.0 (need >= 90.0) |
| A13 | §5.4 | PASS |  |
| A14 | §5.4 | FAIL | key words missing = 1 (need <= 0) |
| A15 | §5.4 | FAIL | wpm act act2 = 129.060579 (need in [150.0, 160.0]) |
| S01 | §1.2 | PASS |  |
| S02 | §1.2 | FAIL | no-tax in method card = False (need == True); no-fee in method card = False (need == True); no-tax on screen elsewhere = False (need == True); no-fee on screen elsewhere = False (need == True) |
| S03 | §1.3 | PASS |  |
| S04 | §1.3 | FAIL | used years missing in a source = 3 (need <= 0) |
| S05 | §1.4 | FAIL | geomean claims shown = 0 (need >= 2) |
| S06 | §1.4, §1.7 | FAIL | start years shown in act 3 = 0 (need >= 69) |
| S07 | §1.5 | FAIL | orphan numbers on screen = 1 (need <= 0); unregistered numbers in narration = 2 (need <= 0) |
| S08 | §1.5 (C rule 9, upgraded) | PASS |  |
| S09 | §1.5 | PASS |  |
| S10 | §1.6 | FAIL | "US only" stated = False (need == True); "history, not a forecast" stated = False (need == True) |
| S11 | §2.4 | FAIL | core claims = 0 (need >= 1) |
| S12 | §2.5 | FAIL | new numbers = 6 (need <= 5.289125) |
| S13 | §2.6 | FAIL | sentence length CV = 0.341362 (need >= 0.35) |
| S14 | §2.8 | FAIL | ad breaks = 0 (need in [2, 3]) |
| S15 | §0, §2.1 | FAIL | act order = ['cold-open', 'ident', 'act2'] (need == ['cold-open', 'ident', 'act1', 'act2', 'act3', 'method', 'outro']); outro s = None (need >= 20.0); total s = 42.313 (need >= 600.0) |
| R01 | §3.1 | FAIL | r music level = 0.330959 (need >= 0.7); acts with climax peak = 0 (need >= 3) |
| R02 | §3.2 | PASS |  |
| R03 | §3.3 | FAIL | shortest pause s = 0.15 (need >= 1.0); pauses < 1.0 s = 1 (need <= 0); decisive numbers not heard = 1 (need <= 0) |
| R04 | §3.4 | PASS |  |
| R05 | §3.5 | FAIL | act-2 scenes before climax = 0 (need >= 6) |
| R06 | §3.4, §3.5, §4.6 (picture check) | FAIL | cuts visible in picture (%) = 14.285714 (need >= 90.0) |
| V01 | §4.1 | PASS |  |
| V02 | §4.2 | FAIL | level-1 placed (%) = 14.393939 (need >= 90.0) |
| V03 | §4.2 | PASS |  |
| V04 | §4.3 | FAIL | shapes differ = False (need == True) |
| V05 | §4.3 | FAIL | worst ease ratio = 0.86 (need <= 0.4); linear moves = 1 (need <= 0); anticipation in moves ≥1 s (%) = 0.0 (need >= 30.0); overshoot in moves ≥1 s (%) = 0.0 (need >= 30.0); overshoot > 8% = 1 (need <= 0); peak |a| fw/s² = 92.48 (need <= 8.0) |
| V06 | §4.3 | FAIL | racks tied to turns = 2 (need >= 3) |
| V07 | §4.3 | FAIL | subframes = 0 (need >= 8); subframe setting justified = False (need == True); moves measured = 0 (need >= 1); median blur ratio = None (need <= 0.8) |
| V08 | §4.4 | FAIL | worst text contrast = 1.44 (need >= 4.5); samples below 4.5:1 = 103 (need <= 0) |
| V09 | §4.4 | PASS |  |
| V10 | §4.6 | FAIL | verified match cuts = 0 (need >= 5); verified J/L cuts = 0 (need >= 4) |
| V11 | §4.7 (C rule text-line-collision, upgraded to pixels) | FAIL | text collisions = 15 (need <= 0) |
| C01 | §4.7 (C rule scene-leak) | PASS |  |
| C02 | §4.7 (C rule bg-over-data) | PASS |  |
| C03 | §4.7 (C rule unlabelled-curve) | PASS |  |
| C04 | §4.7 (C rule axis-anchors: "nhãn trục có neo") | PASS |  |
| C05 | §4.7 (C rule grey-emphasis: "hiểu được ở thang xám") | FAIL | frames flagged = 52 (need <= 0) |
| C06 | §4.7 (C rule number-colour) | FAIL | frames flagged = 52 (need <= 0) |
| C07 | §4.7 (C rule bar-proportion: "tỷ lệ cột đúng") | PASS |  |
| C10 | §4.7 (C rule level1) | PASS |  |
| C11 | §4.7 (C rule layout-repeat) | PASS |  |
| C12 | §4.7 (C rule split-view) | FAIL | split-view runs = 2 (need <= 0) |
| C13 | §4.7 ("đồng bộ số–lời ±250 ms theo giá trị cuối") | FAIL | spoken numbers not in ASR = 1 (need <= 0) |
| C14 | §4.7 ("đọc được ở cỡ 25%") | FAIL | text samples not legible at 25% = 61 (need <= 0) |
| C15 | §4.7, §4.4 ("chỉ dùng token") | FAIL | frames flagged = 9160 (need <= 0) |
| P01 | §7 | MISSING | artifact missing: out/package/thumb-1.png |

## Metrics within 5% of a threshold

- A10 camera moves = 5 (threshold >= 5)
- A12 accents on a cut (%) = 100.0 (threshold >= 100.0)
- A15 wpm act cold-open = 156.312625 (threshold in [150.0, 160.0])
- S04 stocks tolerance pp = 0.5 (threshold <= 0.5)
- S12 max new numbers in a scene = 2 (threshold <= 2)
- S13 sentence length CV = 0.341362 (threshold >= 0.35)
- S15 cold open s = 14.83 (threshold <= 15.0)
- V04 sides used = 1 (threshold <= 1)
- V05 camera moves = 5 (threshold >= 5)
