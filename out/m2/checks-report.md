# checks/ report

root: `/home/user/crux-spike-opus55/out/m2/root`  
lock: `0478df7377b754137071e202c2ff396d7deba94293823cabf5f18932c411c612`  
{'PASS': 51, 'FAIL': 19, 'MISSING': 1, 'ERROR': 0}

| rule | § | status | failing metrics |
|---|---|---|---|
| F01 | §0, §6 | PASS |  |
| F02 | §0, §6 | PASS |  |
| F03 | §6 | FAIL | |frames - duration*30| = 1.57 (need <= 1) |
| F04 | §6 | PASS |  |
| F05 | §6 | PASS |  |
| F06 | §6 | PASS |  |
| F07 | §0 | FAIL | duration s = 203.019 (need >= 600.0) |
| F08 | §4.4 | FAIL | worst banding (%) = 31.365728 (need <= 5.0) |
| F09 | §6 | FAIL | cues outside 1-7 s = 1 (need <= 0) |
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
| A15 | §5.4 | FAIL | wpm act act1 = 146.756855 (need in [150.0, 160.0]); sentences > 175 wpm = 4 (need <= 0) |
| S01 | §1.2 | PASS |  |
| S02 | §1.2 | FAIL | no-tax in method card = False (need == True); no-fee in method card = False (need == True) |
| S03 | §1.3 | PASS |  |
| S04 | §1.3 | FAIL | used years missing in a source = 3 (need <= 0) |
| S05 | §1.4 | PASS |  |
| S06 | §1.4, §1.7 | FAIL | start years shown in act 3 = 0 (need >= 69) |
| S07 | §1.5 | PASS |  |
| S08 | §1.5 (C rule 9, upgraded) | PASS |  |
| S09 | §1.5 | PASS |  |
| S10 | §1.6 | PASS |  |
| S11 | §2.4 | FAIL | g1966 scenes = 2 (need >= 3); g1966 acts = 1 (need >= 2); g1966 callbacks w/ distinct meaning = 1 (need >= 3) |
| S12 | §2.5 | PASS |  |
| S13 | §2.6 | PASS |  |
| S14 | §2.8 | FAIL | ad breaks = 0 (need in [2, 3]) |
| S15 | §0, §2.1 | FAIL | act order = ['cold-open', 'ident', 'act1'] (need == ['cold-open', 'ident', 'act1', 'act2', 'act3', 'method', 'outro']); outro s = None (need >= 20.0); total s = 203.019 (need >= 600.0) |
| R01 | §3.1 | FAIL | r music level = 0.178475 (need >= 0.7); false peaks = 1 (need <= 0); acts with climax peak = 1 (need >= 3) |
| R02 | §3.2 | PASS |  |
| R03 | §3.3 | PASS |  |
| R04 | §3.4 | PASS |  |
| R05 | §3.5 | FAIL | shot length CV = 0.351685 (need >= 0.4); act-2 scenes before climax = 0 (need >= 6) |
| R06 | §3.4, §3.5, §4.6 (picture check) | FAIL | cuts visible in picture (%) = 70.0 (need >= 90.0) |
| V01 | §4.1 | PASS |  |
| V02 | §4.2 | PASS |  |
| V03 | §4.2 | PASS |  |
| V04 | §4.3 | PASS |  |
| V05 | §4.3 | PASS |  |
| V06 | §4.3 | FAIL | racks tied to turns = 2 (need >= 3) |
| V07 | §4.3 | FAIL | median blur ratio = 1.202203 (need <= 0.8) |
| V08 | §4.4 | FAIL | worst text contrast = 3.19 (need >= 4.5); samples below 4.5:1 = 2 (need <= 0) |
| V09 | §4.4 | PASS |  |
| V10 | §4.6 | PASS |  |
| V11 | §4.7 (C rule text-line-collision, upgraded to pixels) | PASS |  |
| C01 | §4.7 (C rule scene-leak) | PASS |  |
| C02 | §4.7 (C rule bg-over-data) | PASS |  |
| C03 | §4.7 (C rule unlabelled-curve) | PASS |  |
| C04 | §4.7 (C rule axis-anchors: "nhãn trục có neo") | PASS |  |
| C05 | §4.7 (C rule grey-emphasis: "hiểu được ở thang xám") | PASS |  |
| C06 | §4.7 (C rule number-colour) | PASS |  |
| C07 | §4.7 (C rule bar-proportion: "tỷ lệ cột đúng") | PASS |  |
| C10 | §4.7 (C rule level1) | PASS |  |
| C11 | §4.7 (C rule layout-repeat) | PASS |  |
| C12 | §4.7 (C rule split-view) | PASS |  |
| C13 | §4.7 ("đồng bộ số–lời ±250 ms theo giá trị cuối") | FAIL | worst |offset| ms = 433 (need <= 250.0); pairs > 250 ms = 1 (need <= 0) |
| C14 | §4.7 ("đọc được ở cỡ 25%") | FAIL | text samples not legible at 25% = 2 (need <= 0) |
| C15 | §4.7, §4.4 ("chỉ dùng token") | PASS |  |
| P01 | §7 | MISSING | artifact missing: out/package/thumb-1.png |

## Metrics within 5% of a threshold

- A03 LRA LU = 6.3 (threshold in [6.0, 10.0])
- A09 silences 0.8-1.5 s = 3 (threshold >= 3)
- A12 accents on a cut (%) = 100.0 (threshold >= 100.0)
- A15 wpm act cold-open = 156.312625 (threshold in [150.0, 160.0])
- A15 wpm act act1 = 146.756855 (threshold in [150.0, 160.0])
- S04 stocks tolerance pp = 0.5 (threshold <= 0.5)
- S05 geomean claims shown = 2 (threshold >= 2)
- S11 core claims = 1 (threshold >= 1)
- S12 max new numbers in a scene = 2 (threshold <= 2)
- S15 cold open s = 14.83 (threshold <= 15.0)
- R03 decisive claims = 1 (threshold >= 1)
- V04 sides used = 1 (threshold <= 1)
- V04 1966 colour share = 0.997149 (threshold >= 0.95)
- V05 worst ease ratio = 0.4 (threshold <= 0.4)
- V07 subframes = 8 (threshold >= 8)
