# Bài thử C — báo cáo mốc giữa chừng (câu móc + setup + chương 1)

Đề tài 3: car loan 5,2% — trả sớm hay đầu tư. Nhánh `spike/opus55-av`, tách từ `spike/opus55-motion`. Hai nhánh cũ không bị sửa.

Phần đã dựng dài **2:07,8** (127,8 s), gồm 22 cảnh:

| Phần | Thời lượng |
|---|---|
| Câu móc | 30,0 s |
| Ident CRUX | 3,0 s |
| Setup và phạm vi | 45,6 s |
| Chương 1 "The certain part" | 49,2 s |

- Video `out/video.mp4`: 1080p30 H.264, AAC 48 kHz stereo, phụ đề mềm.
- Phụ đề rời: `out/captions.srt`.
- Kết luận: **mọi tiêu chí dừng đều đạt** (số, ASR, đồng bộ số–lời).
- Theo chỉ dẫn mới, phiên dừng ở mốc này, chưa làm các chương 2–5 và phần kết.

> Ghi chú: 5–8 phút là độ dài của bài thử. Spec kênh vẫn là 8–15 phút.

## 0. Kết quả tiêu chí dừng

| Tiêu chí dừng | Kết quả | Bằng chứng |
|---|---|---|
| Số: mọi số trên màn hình và trong lời đều từ claim; test đạt | ✅ 20 claim hiện hoặc được đọc; 0 lỗi "chữ số không từ claim" trên 1.278 khung lấy mẫu; `npm test` 54/54 | `claims.json`, `out/checks.json` |
| ASR đọc đúng 100% số được nói | ✅ **20/20** | `out/asr-numbers.json` |
| Số được đọc hiện trên màn hình trong ±250 ms | ✅ **max 30 ms, trung bình 16 ms**, 0 chỗ trượt | `out/number-sync.json` |

## 1. Lớp số

**Mô hình thuế mới (`src/av/calc.js`):**
- Mỗi tháng góp là một lô.
- Tại tháng 48, lô giữ **quá 12 tháng** chịu thuế dài hạn; lô giữ ≤ 12 tháng chịu thuế biểu thường. Như vậy lô góp tháng 35 trở về trước là dài hạn, lô tháng 36–48 là ngắn hạn.
- Mỗi lô tự chịu thuế trên lãi của nó. **Lô lỗ không được khấu trừ** (không bù cho lô khác). **Lãi vay không được khấu trừ.**
- Trên màn hình (cảnh `scope2`) có dòng: "Ignores the 2025–2028 new-car loan interest deduction".

| Mức (thường/dài hạn) | Hoà vốn: average annual return (compounded) |
|---|---|
| 12% / 0% | **5,23%** |
| 22% / 15% (trường hợp chính) | **6,11%** |
| 32% / 15% | **6,01%** |
| Không thuế (kiểm chéo) | 5,33% = APR 5,2% quy ra lãi suất năm hiệu dụng |

**Phát hiện mới:** mức 32% hoà vốn *thấp hơn* mức 22%.
- Road A chỉ bắt đầu đầu tư sau tháng 28, nên phần lớn lãi của A nằm ở các lô ngắn hạn, chịu thuế biểu thường.
- Road B góp từ tháng 1, nên 35/48 lô là dài hạn.
- Khi thuế biểu thường tăng từ 22% lên 32%, A bị thiệt hơn B, nên ngưỡng hạ xuống.
- Test `the 32% bracket breaks even below the 22% bracket` kiểm cả nguyên nhân (tỷ lệ lãi ngắn hạn của A > của B).
- Chương 4 (độ nhạy) cần giải thích điều này.

**Các số khác:**
- Không đổi so với bài B (không phụ thuộc thuế): tháng trả xong 28; lãi $2,744 → $1,554; lãi tránh được **$1,190**. A đầu tư nhiều hơn B đúng $1,190 (đẳng thức có test).
- Chuỗi xấu ILLUSTRATIVE (8% rồi −20%): A vượt từ **tháng 39** (bài B: 38) và về đích hơn **$459**. Hai road đều gần như không phải đóng thuế vì các lô lỗ.

**Nhãn và thuật ngữ:**
- "expected return" đã đổi thành "average annual return (compounded)". Lint kịch bản chặn cụm cũ.
- $400/tháng, dải 2%–10% và chuỗi 8% rồi −20% được gắn `illustrative: true` trong claim, và có huy hiệu ILLUSTRATIVE khi hiện trên màn hình. Ở phần giữa chừng, mới $400 xuất hiện.

**claims.json:**
- Có cả số hiển thị lẫn số được đọc: 20 claim, 20 lần đọc.
- Mỗi lần đọc có dạng đọc, mốc ASR và mốc hiện hình.
- Claim của bài B chuyển sang `out/b/claims.json`.

**Test (`test/av.test.js` 12 test, `test/normalize.test.js` 11 test, cộng test cũ = 54/54 đạt):**
- Phân loại lô tại biên 12 tháng, lỗ không khấu trừ, số lô (A: 13 ngắn hạn / 8 dài hạn; B: 13 / 35).
- Hoà vốn đổi dấu ở từng mức; hoà vốn không thuế = APR hiệu dụng.
- Chuỗi xấu; cờ ILLUSTRATIVE.
- Kịch bản: số chỉ đi qua claim, số trong lời parse ngược đúng claim, không có câu khuyên người xem, không có "expected return".

## 2. Lớp hình

Canvas và camera giữ nguyên của bài B (một thế giới SVG, camera x/y/scale, chữ neo toàn màn hình, parallax 3 lớp, token chuyển động). Quy ước viết trước: `out/conventions.md`.

### 2.1 Luật máy kiểm cho 5 lỗi của bài B (viết trước, chạy trên B rồi trên C)

Luật nằm ở `render-av/rules.js`, bộ chạy ở `render-av/rules-run.js`. Mỗi lần chạy lấy mẫu 1.278 khung (cứ 3 khung lấy 1). Bài B được chạy qua một adapter mỏng: adapter chỉ gắn `data-panel` cho các hàm panel của B và cho phép cố định camera, không đổi thứ B vẽ.

| Lỗi | Luật | Bài B | Bài C |
|---|---|---|---|
| Mảnh cảnh khác lọt khung | `scene-leak`: sau khi camera đến, không phần tử nào của panel ngoài danh sách của cảnh được hiện trong khung | ❌ 714 khung (cảnh sequence thấy panel matrix và fork) | ✅ 0 |
| Lưới nền vẽ đè dữ liệu | `bg-over-data`: lớp nền không được đứng sau dữ liệu theo thứ tự vẽ | ❌ 1.209 khung, 24/24 cảnh (lớp chấm `near` vẽ trên cùng) | ✅ 0 |
| Nét cong không nhãn (cảnh flip) | `unlabelled-curve`: đường cong/đa đỉnh phải có nhãn hiện trong khung, cách ≤ 240 px (có `data-label`) hoặc ≤ 60 px | ❌ 1.715 khung, 22 cảnh; ở flip là mũi tên màu ink (đã kiểm riêng khung flip +4,5 s) | ✅ 0 |
| Sweep chia điểm nhìn | `split-view`: với camera cố định, vùng thay đổi trong 0,1 s không vượt 60% chiều rộng/cao liên tục ≥ 1 s | ❌ sweep 2,1 s (69% × 66%); race 1,2 s và 1,8 s; roads 1 s | ✅ 0 |
| Sweep thiếu phần tử mức 1 | `level1`: cảnh biểu đồ ≥ 2 s có đúng 1 phần tử l1 trong ≥ 50% khung, không khung nào có 2 | ❌ 11 cảnh (sweep 0%; certain có 2 l1) | ✅ 0 |
| Biểu đồ đường không trục/neo | `axis-anchors`: series phải có trục và ≥ 2 nhãn số neo | ❌ 929 khung, 12 cảnh | ✅ 0 (phần giữa chừng chưa có biểu đồ đường; luật sẽ áp cho chương 3–5) |
| Điểm nhấn chìm ở thang xám | `grey-emphasis`: l1 có tương phản xám ≥ 7:1, và không chữ ≥ 48 px nào sáng hơn | ❌ downside: "+$459" màu accent, 5,9:1 | ✅ 0 |
| Màu con số lệch màu chuỗi | `number-colour`: số có màu phải cùng màu chuỗi nó chú thích | ❌ 111 khung, 5 cảnh (downside: "+$459" accent cạnh đường gap warn; converge; timeline) | ✅ 0 |

**Minh bạch về hai lần sửa luật và lỗi hình:**

1. Luật `split-view` ban đầu tính cả khung bao của phần tử đổi. Vì vậy một thanh đang mọc bị tính là "đổi" trên toàn bộ chiều dài của nó.
   - Tôi sửa luật: ghép phiên bản cũ và mới của cùng một phần tử, rồi chỉ tính phần chênh lệch giữa hai khung.
   - Sau khi sửa, đã chạy lại luật trên B: B vẫn trượt (sweep, race, roads).
2. Cảnh timeline của C cũng trượt `split-view` ở lượt đầu, vì hai thanh mọc song song trên toàn bề ngang. Tôi sửa **hình**: hai thanh cùng mọc tới tháng 28, rồi chỉ thanh B mọc tiếp tới tháng 48.
3. Lượt kiểm trước render còn bắt được 4 lỗi hình khác, cũng đều được sửa ở nội dung, không nới luật:
   - `unlabelled-curve`: nhãn tắt trước đường cong. Giờ độ mờ của đường cong đi theo nhãn.
   - Nhãn "A" sát mép vùng an toàn.
   - Dấu "=" màu ink sáng hơn l1.
   - Ba cảnh có l1 xuất hiện muộn: thêm tiêu đề l1 cho đến khi con số tới.

**Luật "chuyển động nhìn thấy được"** (tỷ lệ khung có ≥ 0,5% điểm ảnh đổi quá 4 mức sáng): **52,2%** toàn phần giữa chừng. Theo cảnh, từ 9,7% (hook2) và 11,7% (hook1) tới 100% (free). Chưa đặt ngưỡng. Số liệu theo cảnh ở `out/motion-metrics.json`.

### 2.2 Các tiêu chí của bài B (`out/motion-metrics.json`, `out/text-metrics.json`, `out/checks.json`)

| Tiêu chí | Đo được | Đạt |
|---|---|---|
| Số cảnh | 22 | — |
| Mỗi cảnh 1,2–12 s | 1,8–9,0 s | ✅ |
| Độ lệch chuẩn / trung bình độ dài cảnh ≥ 0,4 | 0,418 | ✅ |
| ≤ 3 cảnh < 2 s liên tiếp | 1 | ✅ |
| Chuyển động ≥ 70% (ngưỡng như bài B) | 89,1% | ✅ |
| Đoạn tĩnh dài nhất ≤ 8 s | 3,93 s (scope2) | ✅ |
| ≤ 12 từ trên màn hình / cảnh | tối đa 11 | ✅ |
| Tốc độ chữ ≤ 1,5 từ/s | 1,05 toàn bài; cảnh cao nhất 1,48 (hook3, cash) | ✅ |
| Cỡ cảnh theo số cảnh (20/40/30/10 ±8) | wide 22,7 / medium 36,4 / close 27,3 / detail 13,6 | ✅ (theo thời gian: 15,0 / 43,7 / 25,8 / 15,5) |
| ≥ 3 morph | 3: thanh gốc tách thành 2 thanh tháng; tháng quy ra đô la lãi; khoản đầu tư thêm của A thành "head start" chưa biết của B | ✅ |
| Kiểm DOM (token màu, cỡ, đậm, Inter, vùng an toàn, chồng chữ, chữ số từ claim) | 0 lỗi / 1.278 khung; 0 lỗi / 5 keyframe | ✅ |
| Keyframe: mực phủ, l1 | 1,4–10,3% mực; mỗi keyframe đúng 1 l1 | ✅ |

## 3. Lớp giọng

- **Hạ tầng:** `gpt-4o-mini-tts`, gọi qua proxy môi trường, không gửi khoá.
- **Giọng `cedar` là tạm thời, KHÔNG phải quyết định chọn giọng.** Chỉ dẫn persona: "calm, precise, warm financial analyst; General American; …". Toàn văn ở `out/voice/tts-manifest.json`.
- **Chuẩn hoá trước TTS:** `src/av/normalize.js` là module riêng, không phụ thuộc nhà cung cấp.
  - Xử lý số, %, $, "month N", dấu trừ, số thập phân, năm và dải năm.
  - Kèm từ điển phát âm (CRUX, APR, US, vs, ILLUSTRATIVE).
  - Module này dùng chung cho cả TTS lẫn máy kiểm ASR, và có test riêng cho từng loại trên.
- **Kịch bản:** chỉ đưa số vào qua marker `{claimId}`. Lint chặn chữ số trần, số viết bằng chữ, câu khuyên người xem và cụm "expected return". "We" chỉ người phân tích; không có câu dự báo thị trường.
- **Timeline do giọng quyết định:**
  - Độ dài cảnh = ceil((lead + giọng + 0,30 s) / nhịp 0,6 s).
  - Các neo lấy từ mốc từng từ của faster-whisper small.en. Căn từ kịch bản với ASR: 285/286 từ khớp; từ còn lại nội suy.
  - Lead tăng lên khi từ neo đầu tiên rơi vào lúc camera đang di chuyển. Camera di chuyển tối thiểu 0,5 s và phải xong trước sự kiện hình đầu tiên.

**ASR số:** 20/20.
- Lượt đầu chỉ đạt 7/20, do lỗi của chính máy kiểm: faster-whisper tách "$25,000" thành "$25" + ",000". Đã sửa bằng cách ghép token theo khoảng trắng đầu từ.
- Lượt hai đạt 18/20: small.en nghe "in month 28" thành "months 28". medium.en nghe đúng, nên lỗi nằm ở ASR chứ không ở giọng. Tôi không nới luật chuẩn hoá mà đổi câu gốc thành "at month 28 / through month 48", được 20/20.

**Tốc độ đọc thực đo** (từ đọc / thời lượng clip đã cắt khoảng lặng):

| Chương | Từ | Giây nói | Từ/phút | Đích 150–160 |
|---|---|---|---|---|
| Câu móc | 64 | 24,6 | 156 | ✅ |
| Setup | 105 | 39,4 | 160 | ✅ |
| Chương 1 | 117 | 42,7 | **165** | ❌ vượt 5 |
| Toàn bộ | 286 | — | 160,8 | ✅ (vừa chạm mép) |

- Chỉ dẫn "about 155 wpm" cho ra ~170 từ/phút. Chỉ dẫn mạnh hơn ("noticeably slower … about 140") kéo xuống 153–161.
- Các cảnh chương 1 được sinh lại sau khi tách câu, nên nhanh hơn lượt đo trước (161 → 165).
- Cách đếm: số viết bằng chữ được tính đủ từ ("one thousand one hundred ninety dollars" = 6 từ), nên chương nhiều số đô la sẽ có số từ/phút cao hơn.
- Chưa sửa; đây không phải tiêu chí dừng ở mốc này. Đề xuất ở mục 6.

## 4. Lớp âm thanh

Thiết kế âm thanh của bài B (đã nghiệm thu) được **gọi nguyên hàm**: `audio/generate.py` `make_music`, `make_sfx`, `make_ambience`, không sửa dòng nào. Mức tương đối và cách đặt SFX theo sự kiện cũng giữ nguyên. Phần mới nằm ở `audio/av_mix.py`:
- Lớp giọng ở 0 dB (−16 LUFS).
- Sidechain nén nhạc 1,0 dB khi có giọng (attack 40 ms, release 300 ms).
- Limiter đỉnh cho bus giọng ở −6 dBTP. Lý do: đỉnh TTS cao hơn độ to khoảng 16 dB và chạm 0 dBFS. Limiter này nén trên 1 dB trong 12,8% thời gian, trên 3 dB trong 3,6%.
- Master +1,97 dB, rồi limiter true-peak ở −2 dBTP. Limiter master giảm tối đa 0,93 dB và hầu như không hoạt động.

| Tiêu chí | Đo được | Đạt |
|---|---|---|
| Giọng 0 dB | −16,0 LUFS (0,0 dB) | ✅ |
| Nhạc −18 đến −22 dB (mức bài B, trước nén) | −20,0 dB (sau nén −20,8) | ✅ |
| SFX −8 đến −14 dB | −9 đến −14 (giống bài B) | ✅ |
| Không khí ~−40 dB | −40,0 dB | ✅ |
| Đúng 8 loại SFX | 8 loại, 61 sự kiện | ✅ |
| Mật độ SFX 30–40% | 32,7% | ✅ |
| SFX lệch hình ≤ 60 ms | **max 38,3 ms, trung bình 19,8 ms**, đo được 61/61 | ✅ |
| Cắt nhạc 300–500 ms trước số quyết định, tối đa 3 | 1 lần × 390 ms, trước "$1,190" | ✅ |
| **Nhạc thấp hơn giọng 18–22 dB khi đang đọc** | **21,4 dB** (792 khối 400 ms có giọng; p10 17,5 / trung vị 21,3 / p90 24,0; 47,5% khối nằm trong 18–22) | ✅ theo mức trung bình năng lượng |

Theo chương (`out/audio-metrics.json`):

| Chương | Giọng | Nhạc (sau nén) | Master | Giọng − nhạc trong cửa sổ có giọng |
|---|---|---|---|---|
| Câu móc | −16,08 | −36,92 | −14,11 | 21,5 dB |
| Ident | — | −35,75 | −27,28 | — |
| Setup | −16,09 | −36,78 | −14,06 | 21,3 dB |
| Chương 1 | −15,87 | −36,84 | −13,83 | 21,4 dB |

- Mức nén sidechain bị kẹp bởi hai yêu cầu. Nhạc bài B đã ở −20 dB so với giọng, nên nén 2 dB đẩy độ chênh lên 22,3 dB (trượt), còn nén 1 dB cho 21,4 dB.
- Nghĩa là trong khoảng 18–22 dB, sidechain chỉ còn chỗ cho ~0–1,5 dB.

## 5. Lớp ghép

- **Master:** `out/video.mp4` là 1920×1080, 30 fps, H.264 + AAC 48 kHz stereo 192 kb/s, dài 126,6 s (hình và tiếng bằng nhau).
- **Loudness đo trên file đã mã hoá:** **−14,05 LUFS** (máy đo BS.1770 riêng) / −14,1 (ffmpeg ebur128); **true peak −1,98 dBTP** / −2,0. ✅ (−14 ±1; ≤ −1 dBTP).
  - Lượt trước, với trần −1,5, true peak sau AAC là −1,0 dBTP: đạt nhưng sát mép, nên tôi hạ trần xuống −2.
- **Phụ đề** `out/captions.srt`: chữ lấy từ kịch bản, căn theo mốc từng từ; 31 khung; dòng dài nhất 42 ký tự; tối đa 2 dòng; 1,34–7,0 s. **Khớp kịch bản 100%** (1.277/1.277 ký tự). ✅ `out/captions-check.json`
- **Đóng gói** (tiêu đề, mô tả, thumbnail): **chưa làm**, vì thuộc bản hoàn chỉnh.

### Thời gian và số lần render

- **Thời gian thực chạy phần giữa chừng: khoảng 80 phút** (02:07 → 03:27 UTC, sau khi bước 0 được chấp nhận). Bước 0 trước đó mất khoảng 10 phút.
- **Render đầy đủ: 3 lần** (giới hạn là 8), mỗi lần dựng cả phần giữa chừng, nên cả ba chương đều được render 3 lần:

| Lần | Giây | Lý do chạy lại |
|---|---|---|
| 1 | 405 | Lần đầu |
| 2 | 419 | Sửa lead/chuyển camera theo giọng; `unlabelled-curve`, `level1`, `split-view`, `grey-emphasis`; tốc độ chữ |
| 3 | 394 | SFX hkLots lệch 198 ms: đường viền chỉ hiện khi nhãn đạt 0,5, nên cho nhãn bắt đầu sớm hơn 0,2 s |

- Chưa tính: 3 lượt ảnh tĩnh để soát, 5 lượt chạy luật (khoảng 2,5 phút mỗi lượt), 7 lượt TTS (chủ yếu là cache), 7 lượt ASR (khoảng 1 phút mỗi lượt).

## 6. Điểm yếu và việc tiếp theo

1. **Chương 1 đọc 165 từ/phút** (đích 150–160). Hướng sửa: sinh lại riêng các cảnh nhanh nhất (bridge 190, card1 188), hoặc kéo giãn nhẹ (atempo ≥ 0,97) ở cấp chương. Việc này cần thêm một lần render.
2. **Cảnh `setup` (1,8 s) gần như trống:** chỉ có "The setup" và một vạch kẻ. Chữ l3 ở `scope2` nhỏ, và độ phủ chuyển động của cảnh này chỉ 23,7% (trong khi toàn bài vẫn đạt 89%).
3. Biểu đồ trong phần giữa chừng đều là biểu đồ thanh. Luật `axis-anchors` chưa gặp đường series nào của C; nó sẽ có tác dụng thật ở chương 3–5.
4. Luật `unlabelled-curve` và `number-colour` dùng khoảng cách (60/150 px) khi phần tử không có thẻ. Bài C gắn thẻ tường minh; bài B được đo bằng khoảng cách.
5. Có 52,5% số khối 400 ms có giọng nằm ngoài 18–22 dB, dù mức trung bình là 21,4 dB. Nguyên nhân: nhạc của bài B thay đổi theo phần (xung nhịp, swell).
6. Hook dài đúng 30,0 s, chạm mép trên của khoảng 20–30 s.
7. TTS không tất định. Clip giọng đã dùng được commit dạng FLAC (`out/voice/*.trim.flac`), kèm `asr.json` và `tts-manifest.json`, để kiểm lại được. Pipeline hiện chưa tự đọc lại từ FLAC: chạy lại `av:tts` trong môi trường mới sẽ gọi API và cho ra một take khác.

## Tái tạo

```
npm install && pip install numpy scipy faster-whisper requests
PART=mid npm run av:all      # TTS dùng cache nếu có manifest + clip
npm run av:rules-b           # chạy 7 luật trên bài B
```
