# checks/ report

root: `/home/user/crux-spike-opus55/out/checks-c/root`  
lock: `None`  
{'PASS': 27, 'FAIL': 32, 'MISSING': 12, 'ERROR': 0}

| rule | § | status | failing metrics |
|---|---|---|---|
| F01 | §0, §6 | PASS |  |
| F02 | §0, §6 | PASS |  |
| F03 | §6 | PASS |  |
| F04 | §6 | FAIL | video Mbps = 0.640912 (need >= 16.0) |
| F05 | §6 | PASS |  |
| F06 | §6 | FAIL | audio kbps = 194.782361 (need >= 272.0) |
| F07 | §0 | FAIL | duration s = 364.2 (need >= 600.0) |
| F08 | §4.4 | PASS |  |
| F09 | §6 | PASS |  |
| F10 | §6 | PASS |  |
| A01 | §5.6 | PASS |  |
| A02 | §5.6 | PASS |  |
| A03 | §5.6 | FAIL | LRA LU = 4.1 (need in [6.0, 10.0]) |
| A04 | §5.6 | PASS |  |
| A05 | §5.6, §6 | FAIL | windows r<0 (%) = 6.162311 (need <= 5.0) |
| A06 | §5.6 | PASS |  |
| A07 | §5.5 | FAIL | voice − music dB = 22.747334 (need in [18.0, 22.0]) |
| A08 | §5.5 | FAIL | median 1-4 kHz drop dB = 0.546432 (need >= 6.0); median band-limited excess dB = 0.171261 (need >= 3.0) |
| A09 | §5.3 | FAIL | silences 0.8-1.5 s = 1 (need >= 3) |
| A10 | §5.3 | MISSING | artifact missing: out/audio/stems/whoosh.wav|flac |
| A11 | §5.3 | MISSING | artifact missing: out/sfx-events.json |
| A12 | §5.2 | FAIL | accents = 0 (need >= 5); accents on a cut (%) = None (need >= 100.0); accents confirmed by onset (%) = None (need >= 90.0) |
| A13 | §5.4 | MISSING | artifact missing: out/voice/takes.json |
| A14 | §5.4 | FAIL | key words missing = 2 (need <= 0) |
| A15 | §5.4 | FAIL | wpm act hook = 141.906874 (need in [150.0, 160.0]); wpm act setup = 174.985979 (need in [150.0, 160.0]); wpm act ch5 = 146.562905 (need in [150.0, 160.0]); wpm act close = 166.515014 (need in [150.0, 160.0]); sentences > 175 wpm = 20 (need <= 0) |
| S01 | §1.2 | MISSING | artifact missing: out/model.json |
| S02 | §1.2 | FAIL | no-tax in method card = False (need == True); no-fee in method card = False (need == True); no-tax on screen elsewhere = False (need == True); no-fee on screen elsewhere = False (need == True) |
| S03 | §1.3 | MISSING | artifact missing: data/sources.json |
| S04 | §1.3 | MISSING | artifact missing: data/sources.json |
| S05 | §1.4 | MISSING | artifact missing: data/normalized/annual.csv |
| S06 | §1.4, §1.7 | FAIL | start years shown in act 3 = 0 (need >= 69) |
| S07 | §1.5 | PASS |  |
| S08 | §1.5 (C rule 9, upgraded) | PASS |  |
| S09 | §1.5 | FAIL | money claims without basis = 13 (need <= 0); frames missing basis on screen = 925 (need <= 0); narration $ without basis = 12 (need <= 0) |
| S10 | §1.6 | FAIL | "history, not a forecast" stated = False (need == True) |
| S11 | §2.4 | FAIL | core claims = 0 (need >= 1) |
| S12 | §2.5 | FAIL | new numbers = 64 (need <= 45.525); max new numbers in a scene = 23 (need <= 2); axis claims shown outside axes = 2 (need <= 0) |
| S13 | §2.6 | PASS |  |
| S14 | §2.8 | MISSING | artifact missing: out/adbreaks.json |
| S15 | §0, §2.1 | FAIL | act order = ['hook', 'ident', 'setup', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'close'] (need == ['cold-open', 'ident', 'act1', 'act2', 'act3', 'method', 'outro']); cold open s = None (need <= 15.0); outro s = None (need >= 20.0); total s = 364.2 (need >= 600.0) |
| R01 | §3.1 | MISSING | artifact missing: out/tension-map.json |
| R02 | §3.2 | MISSING | artifact missing: out/cues.json |
| R03 | §3.3 | FAIL | decisive claims = 0 (need >= 1); shortest pause s = None (need >= 1.0) |
| R04 | §3.4 | PASS |  |
| R05 | §3.5 | FAIL | act-2 scenes before climax = 0 (need >= 6) |
| R06 | §3.4, §3.5, §4.6 (picture check) | FAIL | cuts visible in picture (%) = 1.886792 (need >= 90.0) |
| V01 | §4.1 | MISSING | artifact missing: preprod/shotlist.json |
| V02 | §4.2 | FAIL | level-1 placed (%) = 9.38326 (need >= 90.0) |
| V03 | §4.2 | PASS |  |
| V04 | §4.3 | FAIL | both characters seen = False (need == True); side samples = 0 (need >= 1) |
| V05 | §4.3 | FAIL | anticipation in moves ≥1 s (%) = 0.0 (need >= 30.0); overshoot in moves ≥1 s (%) = 0.0 (need >= 30.0); peak |a| fw/s² = 118.07 (need <= 8.0); camera~picture Spearman = 0.200626 (need >= 0.3) |
| V06 | §4.3 | FAIL | racks tied to turns = 0 (need >= 3); frames with DOF (%) = 0.0 (need >= 50.0) |
| V07 | §4.3 | FAIL | subframes = 0 (need >= 8); subframe setting justified = False (need == True); median blur ratio = 0.9845 (need <= 0.8) |
| V08 | §4.4 | FAIL | worst text contrast = 3.73 (need >= 4.5); samples below 4.5:1 = 2 (need <= 0) |
| V09 | §4.4 | FAIL | both characters seen on screen = False (need == True) |
| V10 | §4.6 | FAIL | verified match cuts = 0 (need >= 5); verified J/L cuts = 0 (need >= 4) |
| V11 | §4.7 (C rule text-line-collision, upgraded to pixels) | FAIL | text collisions = 196 (need <= 0) |
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
| C13 | §4.7 ("đồng bộ số–lời ±250 ms theo giá trị cuối") | FAIL | worst |offset| ms = 420 (need <= 250.0); pairs > 250 ms = 2 (need <= 0); spoken numbers not in ASR = 2 (need <= 0) |
| C14 | §4.7 ("đọc được ở cỡ 25%") | FAIL | text samples not legible at 25% = 67 (need <= 0) |
| C15 | §4.7, §4.4 ("chỉ dùng token") | PASS |  |
| P01 | §7 | MISSING | artifact missing: out/package/thumb-1.png |

## Metrics within 5% of a threshold

- A07 voice − music dB = 22.747334 (threshold in [18.0, 22.0])
- A15 wpm act ch1 = 159.111514 (threshold in [150.0, 160.0])
- A15 wpm act ch2 = 157.894737 (threshold in [150.0, 160.0])
- A15 wpm act ch3 = 156.657963 (threshold in [150.0, 160.0])
- A15 wpm act ch4 = 157.820573 (threshold in [150.0, 160.0])
- A15 wpm act ch5 = 146.562905 (threshold in [150.0, 160.0])
- A15 wpm act close = 166.515014 (threshold in [150.0, 160.0])
- S15 ident s = 3.0 (threshold <= 3.0)
- R05 shot length CV = 0.401859 (threshold >= 0.4)
