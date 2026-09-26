# checks/ — hợp đồng artefact (Phiên D giao, Phiên K chấm)

Máy kiểm chỉ đọc những file dưới đây, theo đường dẫn tương đối từ gốc repo. Thiếu file ⇒ luật dùng nó báo **MISSING** (tính là không đạt).
Máy kiểm không đọc mã dựng. Số liệu tự đo (ffprobe, giải mã khung, ASR riêng, âm thanh) luôn thắng số liệu khai báo; file khai báo chỉ được dùng để biết *đo ở đâu* và luôn được đối chiếu với file đã dựng khi có thể.

| File | Nội dung bắt buộc | Luật dùng |
|---|---|---|
| `out/video.mp4` | bản giao cuối | F01–F08, F10, A01–A06, A09, A14, A15, R03, R04, R06, V05, V07, V10, C13, S11, S14, trang (V08, C14) |
| `out/captions.srt` | phụ đề | F09 |
| `out/package/description.md` | mô tả; chapters dạng dòng `m:ss Tiêu đề` | F10 |
| `out/timeline.json` | `{fps, total, acts:[{id, start, end, climax?}], scenes:[{id, act, start, dur, layout, shot, panels, chart, move, composition?}], turns:[{t, what}]}` — `act` ∈ `cold-open, ident, act1, act2, act3, method, outro`; `layout` dạng `họ/biến thể`; `shot` là chuỗi cỡ cảnh hoặc `{size,…}`; `move` = số giây chuyển động máy ở đầu cảnh (luật bố cục bỏ qua khoảng này); `panels` = các panel thuộc cảnh (`["*"]` = tất cả); `composition:"center"` khai báo trục giữa có chủ ý | S12, S14, S15, R01, R02, R05, V01, V06, C11, trang |
| `out/script.json` | `{sentences:[{id, scene, text, spoken, start, end}]}` — `text` = đúng chữ phụ đề/màn hình (số viết bằng chữ số), `spoken` = chữ gửi TTS, `start/end` = thời điểm câu trong video | F09, A14, A15, S07, S09–S11, S13, R03, V10, C13 |
| `out/claims.json` | `{claims:[{claimId, value, display, formula, source:{id,url}\|null, dataYear\|dataYears, historical?, illustrative, basis:"nominal"\|"real" (mọi số $), role:"axis"?, core?, decisive?, callbacks:[{scene, meaning}], kind?:"geomean", character?:"1966"\|"mirror", shownIn, spoken}]}` | S05, S07–S09, S11, S12, R03, C13, trang |
| `out/terms.json` (tuỳ chọn) | `{terms:[…]}` — chỉ **thêm** thuật ngữ định nghĩa vào danh sách khoá | A14 |
| `out/audio/stems/{voice,music,sfx,whoosh,room}.wav\|flac` | stem 48 kHz stereo, cùng gốc thời gian với video | A07, A08, A10–A12, R01, R03 |
| `out/voice/takes.json` | `{takes:[{id, raw, final}]}` — `raw` = file TTS gốc, `final` = file sau giãn | A13 |
| `out/camera.json` | `{fovAxis:"vertical"\|"horizontal", frames:[{t, pos:[x,y,z], target:[x,y,z], fovDeg, focusDist, coc}]}` mỗi khung; `coc` = đường kính vòng nhoè nền (px ở 1080p) | A10, V05–V07 |
| `out/sfx-events.json` | `{events:[{t, x}]}` — `x` = toạ độ ngang (px) của vật phát tiếng | A11 |
| `out/tempo-map.json` | `{bpm, beats:[t], accents:[t]}` | A12, R04 |
| `out/transitions.json` | `{cuts:[{t, from, to, type:"cut"\|"dissolve"\|…, match:"geometric"\|"semantic"\|null, audio:"j"\|"l"\|null, action?:true, reason}]}` | A12, R01, R04, R06, V10 |
| `out/cues.json` | `{cues:[{t, end, function, key, tempo, layer}], silences:[…]}` | R02 |
| `out/tension-map.json` + `.png` | `{samples:[{t, cutRate, audioDensity, musicLevel, tension}], peaks:[{t}], valleys:[{t}]}` | R01 |
| `out/adbreaks.json` | `{breaks:[t]}` | S14 |
| `out/render-log.json` | `{subframes, stepZero:{secondsPerVideoSecond, reason}}` | V07 |
| `out/model.json` | `{initial, rate, years, weights:{stocks,bonds}, tax:0, fees:0, paths:{"1966":P, "mirror":P+{reverse:["returns",("inflation")]}}, starts:{"1928":P … "1996":P}}`, P = `{withdrawals[30], endNominal[30], endReal[30] (đô la năm bắt đầu), depletedYear}` | S01 |
| `data/sources.json` | `{files:[{path, role:"primary"\|"crosscheck", url, sha256, downloaded, terms:{quote, url}}], tolerance:{inflation_pp, stocks_pp}, mismatches:[{year, series, note}]}` | S03, S04 |
| `data/normalized/annual.csv` | `year,stocks,bonds,inflation` (số thập phân, từ Damodaran) | S01, S04, S05 |
| `data/normalized/fred_inflation.csv`, `stocks2.csv` (nếu có) | `year,inflation` / `year,stocks` | S04 |
| `preprod/shotlist.json`, `preprod/storyboard.*`, `preprod/color-script.*` | `{shots:[{id, scene, size, angle, focalMm, move, moveReason}]}` | V01 |
| `design/tokens.json` | `{colors:{name:hex}, series:{key:hex}, seriesOf:{series:hex}}` — `colors.bg`, `colors.grid`, `colors.muted` bắt buộc | trang, P01 |
| `out/package/thumb-{1,2,3}.png` + `.json` | ảnh 1280×720; `{texts:[{text, box:[x,y,w,h], fontPx}]}` | P01 |
| `out/page.json` | `{url, ready?}` — trang dựng, cùng trang đã sinh ra video | trang |

## Trang dựng (§Page)

Trang tại `out/page.json.url` phải cung cấp `window.CHECKS`:

- `seek(t)` — dựng đúng khung ở thời điểm `t` giây (giống hệt khung trong `out/video.mp4`, trước grain/grade hậu kỳ nếu có).
- `freeze(t | null)` — giữ máy quay ở trạng thái thời điểm `t` (null = thả).
- `objects()` — mảng đối tượng toạ độ màn hình theo **thứ tự vẽ**:
  - chữ: `{id, kind:"text", tid, role:"label"|"badge"|"axis-label"|"title", text, box:[l,t,r,b], opacity (hiệu dụng), level:1|2|3|null, emph, series, anchor (id biểu đồ nếu là neo trục), chart, year, char, runs:[{color,size}], color, fontPx (cỡ nhỏ nhất), background, parent, claims:[{id, text, box, opacity, color, series, roll}], key, sig}`
  - hình: `{id, kind:"shape", tag, role:"series"|"axis"|"bar"|"mark"|"line"|"card"|"bg"|"axis-break", panel, chart, label, series, value, full, orient, char, shape, year, stroke, fill, opacity, box, curve, vertices, key, sig}`
  - `ILLUSTRATIVE` là một đối tượng chữ `role:"badge"`; `char` = `"1966"`/`"mirror"` trên mọi hình của hai nhân vật; mọi ô của bản đồ hồi 3 mang `year`.
- `layer(name, ids?)` — `"all"`; `"text"` (chỉ chữ + huy hiệu kèm nền pill, nền trong suốt); `"glyph"` (chỉ nét chữ, bỏ nền pill); `"graphics"` (mọi hình trừ `bg` và phần tô của `card`, không chữ, nền trong suốt); `"only"` (chỉ các `ids`); `"notext"`.

Bài C được chạy qua `checks/adapters/c/` (dịch artefact của C sang hợp đồng này; không bịa thứ C không có).
