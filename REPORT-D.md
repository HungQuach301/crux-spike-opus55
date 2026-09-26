# Bài thử D — "Same average, different fate": báo cáo M0 + M1

Nhánh `claude/opus55-cine-phase-d-jw6me1` (tách từ `spike/opus55-cine`). Phiên D không sửa `checks/`. SHA của `checks/` được tính lại trước commit: `0478df7377b754137071e202c2ff396d7deba94293823cabf5f18932c411c612`, khớp `checks/LOCK`.

Thời gian chạy M0 + M1: khoảng 60 phút (12:10–13:10 UTC). Số lần render:
- 1 lần render thử bước 0 đầy đủ, 10 s × 8 khung con.
- 1 lần render đầu bị dừng giữa chừng vì quá chậm (3,1 s/khung). Sau đó tối ưu blur rồi mới đo lại.
- Chưa render bản dựng nào.

## M0 — Bước 0 (BRIEF-D §8): ĐẠT

| Bước | Kết quả |
|---|---|
| a) Dữ liệu | Tải được cả ba file. Damodaran `histretSP.xls` (dữ liệu tới 2025, cập nhật 01/2026), trang HTML cùng bảng, và FRED `CPIAUCNS` hằng tháng. SHA-256, URL và ngày tải ghi trong `data/sources.json`. |
| a) Điều khoản | **Damodaran:** "I hope you find this data useful and there are no strings attached." (pages.stern.nyu.edu/~adamodar/New_Home_Page/datahistory.html). Không có điều khoản cấm dùng thương mại. **FRED CPIAUCNS:** nhãn "Public Domain: Citation Requested". Câu trích: "These series may be under copyright or in the public domain and may be used without permission, provided you do not engage in any prohibited use." (fred.stlouisfed.org/legal/). Cần ghi nguồn "Source: BLS via FRED". Bản chụp các trang điều khoản nằm ở `data/terms/`. **Lưu ý cho chủ dự án:** mục "Commercial Use" của FRED liệt kê ví dụ (dùng nội bộ, sách, bản tin, báo cáo) mà không nêu video có quảng cáo. Series này là public domain (BLS), và FRED chỉ dùng để đối chiếu, không hiện trên hình. Phiên D đánh giá là được phép, nhưng chủ dự án nên xác nhận. |
| b) Render thử 10 s | Cảnh 3D phối cảnh thật: sàn chia 4 dải chiều sâu, 3 lớp ở z khác nhau, DOF thin-lens theo từng lớp, rack focus, dolly có lấy đà và vượt nhẹ, truck ngang nhanh. Motion blur **8 khung con**, màn trập 180°, cộng dồn float, dither tam giác. **33,3 s render cho mỗi giây video** (1 worker, Chromium không GPU). Trường hợp xấu nhất, khi mọi khung đều động: 43,7 s/s. Cả hai **< 60 s/s**, nên giữ 8 khung con. Bằng chứng: `out/step0/render-8x.mp4`, `render-8x.json`, `contact.png` (khung 7.1 s cho thấy thẻ bị nhoè ngang theo chuyển động, lớp xa mờ theo DOF). |
| c) TTS + ASR | `gpt-4o-mini-tts` qua proxy (không gửi khoá) trả HTTP 200. faster-whisper small.en int8 chép đúng "In 1966, a retiree with $1 million withdrew $40,000…" (`out/step0/tts-asr.json`). |

Hạ tầng: ffmpeg không có sẵn trong container, Phiên D tự cài bằng `apt-get` (như bài C). `npm ci` chạy được. Môi trường không có PIL/matplotlib, nên mọi PNG được dựng bằng Playwright.

## M1 — Tiền kỳ

### Mô hình và dữ liệu
- **Dữ liệu chính.** Damodaran, sheet "Returns by year": S&P 500 gồm cổ tức và T.Bond 10 năm. Lạm phát lấy từ sheet "Inflation Rate" (CPI-U NSA, Dec/Dec).
- **Đối chiếu với FRED.** Tính lạm phát Dec/Dec từ CPIAUCNS: lệch tối đa **0,058 pp** (năm 2025), dung sai khai báo 0,10 pp, 0 năm vượt.
- **Lệch nội bộ trong workbook.** Sheet "Nominal vs Real Data" của cùng file có cột lạm phát khác, lệch tới 0,37 pp (1954). Sheet đó không được dùng; đã ghi trong `data/sources.json`.
- **Nguồn thứ hai cho lợi suất cổ phiếu: không truy cập được.** `www.econ.yale.edu` trả 403, `shillerdata.com` bị proxy từ chối. Nếu cần, chủ dự án mở một trong hai domain này. Phiên D không tự đổi nguồn.
- **Mô hình.** `src/d/model.js` theo §1.2. Mirror = lợi suất 1966–1995 đảo thứ tự; lạm phát giữ thứ tự lịch, nên hai người rút **cùng số đô la mỗi năm** và chỉ khác thứ tự lợi suất.
- **Kết quả chính.**
  - Bình quân nhân danh nghĩa 9,6717% cho cả hai (lệch 0,0000 pp); thực 4,07%.
  - Người 1966 cạn tiền năm thứ 26 (1991).
  - Mirror còn $6,96M danh nghĩa, tức $1,44M theo đô la 1966.
  - Chênh lớn nhất năm 1986: $1,96M theo đô la 1966.
  - Trong 69 năm bắt đầu (1928–1996), 4 năm cạn tiền: 1965, 1966, 1968, 1969. Cả bốn đều có thập kỷ đầu lợi suất thực âm.
- **Một kết quả đo phải nêu thẳng.** Trên cả 69 năm, lợi suất thực 30 năm tương quan với số dư cuối (Spearman 0,78) **mạnh hơn** thập kỷ đầu (0,73). Kịch bản nói đúng điều này (cảnh a3-nuance) thay vì tuyên bố "thập kỷ đầu quyết định tất cả".
- **Test.** `test/d-model.test.js` có 6 test; `npm test` 62/62 pass.
- **Claims.** `out/claims.json` có 65 claim, mỗi claim có công thức, nguồn hoặc ILLUSTRATIVE, và năm dữ liệu.
  - 15 claim illustrative: các đầu vào giả định ($1M, 60/40, 4%, 30 năm) và mọi claim của mirror.
  - Core `g1966` (9.7%) có 3 callback mang nghĩa khác nhau: dựng bối cảnh → trớ trêu → bài học.
  - 4 claim quyết định: 1991, $461,000, $1.96M, −1.8%.
  - `node src/d/claims.js` tự kiểm: mọi số trong lời đều đã đăng ký cho đúng cảnh.

### Kịch bản
- **Tệp.**
  - `src/d/script.js` là nguồn. `out/script.md` là bản đọc được, gồm chỉ đạo diễn xuất từng câu, câu hỏi, bước ngoặt và payoff mỗi hồi.
  - `out/script.json` theo hợp đồng.
- **Quy mô.** 117 câu, 1.446 từ đọc, **10:50** (650 s). Cold open 14,6 s, ident 2,6 s, outro 23,5 s.
- **Câu móc** ("By the end of this video, you will know which ten years decided the fate of this retiree…") nằm ở 0:32,4–0:44,7.
- **Vòng mở** "So what decided it?" (0:12,6) được trả lời ở 9:10 ("Not the average. The first 10 years."). Ngay sau đó là câu nói rõ giới hạn của câu trả lời này.
- **Table read:**
  - `out/tableread/tableread-v1.mp3`: bản đầu, 612 s.
  - `tableread-v2.mp3`: sau sửa, 667 s, đã giãn theo kế hoạch.
  - Danh sách sửa: `out/tableread/fixes.md`, 12 chỗ sửa lời (1 lỗi số: "last 5 years" → 4) cộng sửa take.
  - "Nghe" ở đây là ASR + đo nhịp + đọc bản chép. Chủ dự án nên nghe v2 bằng tai.

### Tiền kỳ hình, âm và nhịp
- **Shot list.** `preprod/shotlist.json` có 99 shot. Mỗi shot có cỡ cảnh, góc máy, tiêu cự (24/35/50/85 mm), chuyển động và lý do. Rack focus gắn với các bước ngoặt đã khai báo ở `timeline.turns`.
- **Storyboard.** `preprod/storyboard.png` + `.md`. Đây là **storyboard sơ đồ**: mỗi khung là một bố cục theo họ layout, vị trí phần tử mức 1 trên lưới một phần ba, 3 lớp chiều sâu, bảng màu. Chưa phải tranh vẽ từng cảnh.
- **Color script.** `preprod/color-script.png` + `.json`, bảng màu đổi theo hồi:
  - cold open: đen, một nguồn sáng ấm;
  - hồi 1: xanh xám bình minh 1966;
  - hồi 2: hổ phách → bão nâu đỏ 1973–74 → xanh lạnh sau 1986;
  - hồi 3: xanh mực phân tích;
  - outro: bình minh ấm.
- **Token.** `design/tokens.json`. Hai nhân vật: 1966 `#FFC857` (nét liền, chấm tròn, bên trái) và mirror `#5A9CEB` (nét đứt, hình thoi, bên phải). Đã kiểm bằng chính hàm V09 khoá: ΔE2000 55,3 (protan) / 59,0 (deutan), tương phản xám 1,85:1. Chữ mirror trên nền surface-2 đạt 5,2:1.
- **Cue sheet.** `out/cues.json` có 23 cue (17 nhạc, 6 lớp âm thanh), ghi thời điểm, chức năng kịch tính, giọng và tempo. Có 4 khoảng lặng có chủ ý kèm lý do.
  - Leitmotif 1966 = hình 4 nốt đi lên; mirror = đảo ngược của hình đó.
  - Đổi hoà âm sang Bb trưởng tại bước ngoặt 1982.
- **Tempo map, cắt và quảng cáo.**
  - `out/tempo-map.json`: phách theo hồi, hồi 2 tăng tốc 96 → 116 bpm.
  - 74/98 cú cắt đặt đúng phách, 10 J/L-cut.
  - `out/adbreaks.json`: 2 điểm quảng cáo tại ranh giới hồi 1|2 và 2|3, mỗi điểm có 1,4 s im hẳn.
- **Tension map.** `out/tension-map.json` + `.png`. Ba đỉnh ở cao trào của ba hồi, đều là cực đại cục bộ. Thung lũng sau mỗi đỉnh thấp hơn 65–100% biên độ.

### Ước tính render toàn bài (từ số đo bước 0)
- **Số khung và chi phí.** 650 s × 30 = 19.500 khung. Chi phí đo ở bước 0: khung động (8 khung con) 1,46 s, khung tĩnh 0,38 s, trên 1 worker.
- **Giả định.**
  - Khoảng 50% khung có chuyển động: 74 s chuyển động máy cộng khoảng 2,5 s dựng phần tử mỗi cảnh × 99 cảnh.
  - Cảnh thật phức tạp hơn cảnh thử khoảng 1,5×.
- **Ước tính.** Khoảng 27.000 s ≈ **7,5 giờ trên 1 worker**, khoảng **2,3 giờ với 4 worker** (4 lõi).
- **Cộng thêm.** Bộ lấy mẫu của máy kiểm (trang dựng mỗi 0,1 s, lớp điểm ảnh mỗi 0,2 s): ước 1,5–2,5 giờ. Mix và ASR: khoảng 15 phút.
- **M2** (cold open + hồi 1, 191 s): khoảng 40 phút render với 4 worker.

## Kết quả checks/ (Phiên D chạy, không sửa)

`checks/run.sh` trên M1: **11 PASS, 0 FAIL, 60 MISSING, 0 ERROR** (`out/checks/report.md`).

- **PASS:** S01 (6.390 giá trị mô hình khớp), S03, S04, S05, S10, S13 (CV 0,49), S15, R02, R05 (hồi 2: 6,24 → 5,40 → 4,53 s; cuối/đầu 0,69), V01, C11.
- **MISSING:** 60 luật cần `out/video.mp4`, trang dựng (`out/page.json`), stem âm thanh, phụ đề hoặc thumbnail. Tất cả thuộc M2/M3.
- **Luật đã tự kiểm trước ở M1** (bằng code riêng hoặc hàm khoá chỉ đọc):
  - phần lời của S07/S09/S12 (mọi số đều có claim, số tiền nào cũng có "real/nominal", tối đa 2 số mới mỗi cảnh);
  - A14 (từ khoá trên từng take);
  - A15 (nhịp theo hồi);
  - V09 (màu nhân vật).

**Chỉ số sát ngưỡng** (trong 5% quanh ngưỡng):
1. S15 cold open 14,56 s (≤ 15).
2. S05: đúng 2 claim bình quân nhân (≥ 2), vì chỉ có hai nhân vật.
3. S04: dung sai cổ phiếu khai báo đúng 0,5 pp (≤ 0,5). Hiện chưa dùng vì chưa có nguồn thứ hai.
4. **Theo kế hoạch, chưa đo trên video:**
   - A13: 29/117 câu dùng đúng mức giãn ±10%. M2 sẽ sinh thêm take để giảm.
   - A15: nhịp phương pháp 154,4 và các hồi 156–158 wpm, nằm trong khoảng 150–160 nhưng chưa đo trên bản mix.

## checks-appeal.md (tóm tắt)
1. **A14 và "retiree's".** ASR chép sở hữu cách thành "retirees", stem thành `retire`, không khớp `retiree`. Phiên D đã viết lại 10 câu, không dùng sở hữu cách.
2. **A14 và "S&P".** faster-whisper tách thành "S" "&P", và `asr_join` không nối nên không khớp mẫu. Lời đọc giờ dùng "Standard & Poor's 500 index".
3. **Ghi nhận:** không có nguồn cổ phiếu thứ hai (domain cần mở nêu ở trên).

## Chưa làm (M2/M3)
- Trang dựng thật với `window.CHECKS` (seek/freeze/objects/layer), cảnh thật cho 99 shot, `out/camera.json`, `out/transitions.json`, `out/sfx-events.json`.
- Nhạc và sound design sinh bằng code, sổ giấy phép, stem, mix, master.
- Video, phụ đề SRT, chapters, đóng gói (3 tiêu đề, 3 thumbnail, mô tả).
- Chọn take cuối (giảm các câu đang ở mức giãn 10%) và `out/voice/takes.json`. Các take TTS gốc (79 MB) chưa commit, sẽ commit take cuối ở M2.
- Storyboard vẽ tay từng cảnh: hiện mới là sơ đồ bố cục.

**DỪNG** ở M1, chờ chủ dự án duyệt trước khi render.

Tái tạo: `npm ci && pip install numpy scipy faster-whisper xlrd requests && npm run d:m1`. Đo bước 0: `npm run d:step0`. Máy kiểm: `checks/run.sh`.

---

# M1b-1 — sau khi duyệt M1 (quyết định: BRIEF-D-amendments.md)

## A. checks-appeal
- **§1, §2:** giữ nguyên cách né đã làm, không mở khoá.
- **§3 — nguồn cổ phiếu thứ hai:** đã thêm. `http://www.econ.yale.edu/~shiller/data/ie_data.xls` tải được qua HTTP; qua HTTPS thì lỗi nguyên văn `curl: (35) Recv failure: Connection reset by peer`. `https://shillerdata.com/` cũng lỗi nguyên văn `curl: (35) Recv failure: Connection reset by peer`.
  - **Cách tính:** `data/normalized/stocks2.csv` = lợi suất tổng Dec→Dec từ giá tháng của Shiller, cổ tức D/12 tái đầu tư hằng tháng.
  - **Lệch:** 82/95 năm vượt dung sai 0,5 pp (trung vị 1,61 pp, lớn nhất 8,17 pp năm 1991). Tất cả đã liệt kê trong `data/sources.json` → `mismatches`. Nguyên nhân: Shiller dùng giá **trung bình tháng**, Damodaran dùng mức **cuối năm**, nên hai định nghĩa khác nhau từ gốc. Tôi không tự chọn nguồn; mô hình vẫn dùng Damodaran.
  - **Thiếu năm:** bản trên Yale dừng ở 09/2023, nên thiếu 2023–2025. Vì vậy **S04 giờ FAIL** ("used years missing in a source = 3"). Bản đang được cập nhật nằm ở shillerdata.com, domain đang bị chặn.
  - **Điều khoản:** Shiller không có câu cấp phép hay điều khoản sử dụng rõ ràng, chỉ có sheet "Disclaimer" (đã trích nguyên văn trong `sources.json`). Nguồn này chỉ dùng để đối chiếu, không hiện trên hình.
  - **Cần chủ dự án quyết:** mở shillerdata.com để lấy bản đủ năm, hoặc chấp nhận S04 thiếu 3 năm.

## B. Kịch bản
- **a2-7374** → "After inflation, stocks and bonds both lose money in 1973 and 1974."
  - Thêm 4 claim lợi suất thực: cổ phiếu −21.2% (1973) / −34% (1974), trái phiếu −4.6% / −9.2%.
  - Bốn số này hiện dưới dạng chiều cao cột, không có chữ số trên hình, nên không tính là số mới trong cảnh.
- **a1-notax** thêm câu "The data is US only, and this is history, not a forecast." Đoạn ở hồi 3 giữ nguyên.
- **Test:** thêm 2 test (thực âm 1973–74; mọi số trong kịch bản đã đăng ký; câu "US only" nằm ở hồi 1). `npm test` pass.
- **Timeline:** `out/script.json` và `out/timeline.json` được dựng lại bằng take giọng cũ cho 2 câu này (10:56). Timeline sẽ dựng lại hẳn bằng giọng mới ở table read v3.
- **checks (chỉ phần Python):** 10 PASS, 1 FAIL (S04, lý do ở trên), 60 MISSING.

## C. ElevenLabs — bước 0: ĐẠT
- `GET /v1/voices` và `POST /v1/text-to-speech/{voice_id}/with-timestamps` đều trả HTTP 200. Khoá do proxy gắn; không có khoá trong code hay log.
- `eleven_v3` chấp nhận `speed` và `with-timestamps`.
- Khoá **không có quyền `user_read`**. Lỗi nguyên văn: `"The API key you used is missing the permission user_read to execute this operation."` Vì vậy không đọc được số dư; credit được cộng từ header `Character-Cost` của từng lần gọi.

## D. Thử giọng mù
- **Kết quả:** `out/voice-audition/V1.mp3` … `V8.mp3`, bảng số đo đầy đủ trong `out/voice-audition/README.md`. Giải mã chỉ có trong `key.json`.
- **Credit ElevenLabs đã dùng: 4.883 ký tự** cho 125 lần gọi thử giọng, cộng khoảng 132 cho 3 lần gọi thăm dò. Tổng khoảng **5.015**.

| | V1 | V2 | V3 | V4 | V5 | V6 | V7 | V8 |
|---|---|---|---|---|---|---|---|---|
| wpm toàn đoạn | 163.5 | 168.3 | 156.4 | 161.6 | 156.1 | 152.5 | 158.5 | 158.3 |
| độ lệch chuẩn wpm | 23.3 | 24.2 | 8.9 | 26.1 | 4.9 | 8.7 | 9.8 | 36.6 |
| số câu trong 150–160 (trên 6) | 3 | 3 | 4 | 2 | 5 | 3 | 4 | 1 |
| độ nhạy với speed | 0.18 | 0.20 | 0.99 | 0.09 | 1.07 | 0.99 | 1.05 | 0.19 |
| từ quan trọng ASR bỏ sót (trên 15) | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 1 |
| LUFS gốc / file | −19.4 / −20.4 | −18.6 / −20.4 | −24.0 / −20.5 | −17.1 / −20.5 | −22.8 / −20.5 | −19.9 / −20.4 | −23.8 / −20.5 | −18.5 / −20.4 |
| khoảng lặng dài nhất (s) | 0.76 | 0.74 | 0.72 | 0.70 | 0.76 | 0.76 | 0.76 | 0.76 |

**DỪNG**, chờ chủ dự án chọn giọng.

---

# M1b-2 + M2 — sau quyết định chủ dự án (giọng V8, S04 chấp nhận trượt)

Nhánh: **`claude/opus55-cine-phase-d-jw6me1`**. checks/ không đổi; SHA khớp LOCK `0478df73…c612` trước mỗi commit.
Quyết định đã ghi: `BRIEF-D-amendments.md` (giọng V8 = Eric, eleven_v3, **tạm thời, không phải #158**; miễn trần 175 wpm/câu của A15 cho câu cố ý), `checks-appeal.md` (S04 trượt vì khác phương pháp, dữ liệu Yale dừng ở 09/2023; mô hình vẫn dùng Damodaran). Đối chiếu mô tả đã thêm vào `data/sources.json`: 91/95 năm cùng chiều; chênh lệch trung bình nhân 30 năm trung bình 0,13 điểm %, lớn nhất 0,53 điểm %, cửa sổ 1966 là 0,011 điểm %.

## M1b-2 — lồng tiếng toàn bài (ElevenLabs, không kéo giãn thời gian)
- Mỗi câu tối đa 4 lần đọc với eleven_v3 (speed 0.9, seed 1000+lần). Chọn theo thứ tự: đủ từ khoá (ASR) → trong 120–190 wpm → gần 156 nhất. Nếu 4 lần v3 đều hỏng, đọc lại bằng Eric trên **eleven_multilingual_v2** (tối đa 4 lần).
- `out/tableread/tableread-v3.mp3`: **693,4 s (11:33)**, đạt yêu cầu ≥ 10:00.
- **"Mirror" nghe đúng** qua ASR ở mọi câu. **Từ khoá bị sót: không có.**
- **wpm theo hồi** (số khai báo, `out/voice/choice-report.json`):

  | hồi | wpm | đạt 150–160? |
  |---|---|---|
  | cold-open | 158,9 | có |
  | act1 | 156,1 | có |
  | act2 | 151,1 | có |
  | act3 | **149,6** | không — sửa ở M3 |
  | method | 155,4 | có |
  | outro | 150,0 | có |

- **Số đo của máy thắng số khai báo:** A15 đo act1 trên video M2 = **146,8** (trượt), cold-open = 156,3. Trong act1, các dấu ngừng (…) nằm trong cửa sổ câu mà máy đo, nên wpm thấp hơn. Sửa ở M3: act1 chọn lần đọc nhanh hơn hoặc bớt dấu ngừng.
- **wpm từng câu:** bảng đủ 118 câu ở `out/voice/wpm-report.md` (sinh bằng `src/d/wpm-report.py`), kèm lý do diễn xuất của từng câu lệch.
  - 88/118 câu nằm ngoài 150–160. Lý do diễn xuất chính:
    - Câu chốt / câu hỏi đọc chậm, có dấu ngừng cố ý (ví dụ co-question.1 127,7; co-broke.1).
    - Câu "một hơi" theo chỉ đạo đọc nhanh hơn (ví dụ co-same.1 169,4; a1-notax.2 188,2).
    - Câu 2–4 từ không thể ghim nhịp.
  - Trong M2 có 38 câu, 13 câu nằm trong 150–160.
  - **Ngoài 120–190** (đều là câu 2–3 từ, đã thử đủ 8 lần): a1-avgmirror.2 193,5; a1-payoff.1 195,7; a2-y1.1 200,0; a3-answer.2 204,5.
  - A15 đo được 4 câu > 175 trong M2: a1-who.1 178; a1-notax.2 190; a1-question.1 175; a1-question.2 180. Các câu này thuộc diện được miễn trần 175 (câu cố ý).
- **Câu dùng eleven_multilingual_v2 (13):** a1-who.1, a1-real.1, a1-question.2, a1-avgmirror.2, a1-payoff.1, a1-payoff.2, a2-y1.1, a2-bal74m.1, a2-seq.1, a2-short.1, a3-answer.2, a3-limits.1, method-model.2.
- **Credit ElevenLabs** (cộng từ header `Character-Cost`; khoá không có quyền đọc số dư):

  | hạng mục | ký tự |
  |---|---|
  | lần đọc đang dùng | 13.513 |
  | lần đọc bị thay | 592 |
  | thăm dò (mirror, thẻ) | 1.193 |
  | **M1b-2/M2 cộng** | **≈ 15.298** |
  | thử giọng (M1b-1) | ≈ 5.015 |
  | **tổng từ đầu** | **≈ 20.300** |

## M2 — cold open + ident + act 1 (0 → hết a1-payoff), chất lượng cuối
- **Video:** `out/m2/video.mp4` là **bản xem trước** 203,0 s, 2,8 Mbps, 68 MB, có trong git. Bản master đúng hợp đồng (`out/m2/root/out/video.mp4`) là H.264 High 20 Mbps CBR, BT.709 limited, 30 fps, AAC 320k, **515 MB, chỉ ở máy** vì quá lớn cho git.
- **Có trong git:** stems (voice, music, sfx, whoosh, room), phụ đề `out/m2/captions.srt`, `camera.json`, sfx-events, tension map đo từ stems, render-log.
- **Hình:**
  - Trang thật với `window.CHECKS`; camera 3D (24/35/50/85 mm) với lấy đà và vượt đích; DOF theo lớp độ sâu; motion blur 8 subframe.
  - Một bộ màu grade, vignette nhẹ, grain tĩnh.
- **Âm:** nhạc (pad, pluck theo phách, leitmotif "mirror"), sound design, duck theo dải tần, master **−14,0 LUFS, LRA 6,3, true peak −1,3 dBTP**.
- **Bố cục:** kiểu "thẻ + hai dòng" đã được thay bằng các thành phần riêng: growth chart, money column, year grid, donut, escalator, tracks, return rows, avg bars, cái cân, cùng các cảnh chữ căn giữa.
  - **Theo nghĩa chặt** (đếm thành phần chính), yêu cầu "không bố cục nào quá 2 lần trong 90 s" **chưa đạt**:
    - moneyColumn: a1-est, a1-start, a1-rule
    - yearGrid: a1-who, a1-hook, a1-hook-b
    - escalator: a1-rule, a1-raise, a1-real
    - scale: a1-samewd, a1-question, a1-payoff
    - avgBars: a1-question, a1-avg1966, a1-avgmirror
    - donut (tính cả khi chỉ là thành phần phụ): a1-hook-b, a1-mix, a1-rebal
  - Phần lớn là một đối tượng được giữ nguyên và phát triển qua các cảnh liền nhau. Nhưng theo luật đếm thì vẫn là lặp. Sửa ở M3: mỗi chuỗi như vậy đổi góc hoặc bố cục ở lần thứ 3, hoặc gộp thành một cảnh.

### Kết quả checks/ trên đoạn M2 (`checks/run.sh out/m2/root`, không sửa checks)
**51 PASS / 19 FAIL / 1 MISSING** (lần chạy đầu: 39 / 31 / 1). Log: `out/m2/checks-run.log`, chi tiết: `out/m2/checks-report.json` / `.md`.

**FAIL do cấu trúc — đoạn M2 chưa thể đạt** (không phải lỗi của đoạn):

| luật | lý do |
|---|---|
| F07 | 203 s < 600 s |
| S02 | chưa có thẻ phương pháp |
| S04 | chủ dự án đã chấp nhận trượt |
| S06 | act 3 |
| S11 | callback 1966 nằm ở act 2/3 |
| S14 | ad break nằm giữa các hồi |
| S15 | thứ tự hồi / outro |
| R05 | vế act 2; CV 0,35 |
| P01 (MISSING) | thumbnail thuộc M3 |

R01 trượt một phần vì cấu trúc (mới có 1 cao trào); phần còn lại xếp ở bảng dưới.

**FAIL thật — sửa ở M3** (không kịp thêm một vòng render ~40' + checks ~50' trước điểm dừng an toàn):

| luật | đo được | nguyên nhân | cách sửa |
|---|---|---|---|
| F03 | \|frames − duration×30\| = 1,57 (ngưỡng ≤ 1) | container dài hơn luồng hình (audio) | cắt audio đúng số frame khi mux |
| F08 | banding 31,4% ở t = 192 s, 24,9% ở t = 0 | gradient tối (a1-payoff, co-lines); các frame khác ≤ 5% | tăng dither/grain ở gradient nền, hoặc bỏ gradient ở 2 cảnh này |
| F09 | 1 cue dài 0,8 s (122,47 s) | — | gộp cue |
| A15 | act1 146,8 | xem phần giọng | chọn lần đọc nhanh hơn / bớt dấu ngừng |
| R01 | r music level 0,18; 1 đỉnh giả | nhạc không lên cùng độ căng | vẽ lại đường nhạc theo đỉnh cao trào (đỉnh đo được t = 165 s so với climax 160,4 s) |
| R06 | 70% cut thấy được (cần ≥ 90%) | 9 cut có thay đổi hình quá nhỏ (7,5 / 12,1 / 17,1 / 26,9 / 85,0 / 107,4 / 123,1 / 143,1 / 160,0 s) | đổi nền, cỡ cảnh hoặc độ sáng ở mỗi cut |
| V06 | 2 rack gắn với bước ngoặt (cần 3) | rack của a1-real / a1-avgmirror rơi vào cửa sổ ~2 s sau cut nên bị cut "nuốt" | dời rack ra ≥ 2 s sau cut |
| V07 | median blur ratio 1,20 (cần ≤ 0,8) | grain tĩnh pha loãng phép đo; chỉ 2 chuyển động được đo | giảm grain trên vùng chuyển động, hoặc tăng tốc độ ngang |
| V08 / C14 | co-a0 / co-a1 3,58 và 3,19:1 | nhãn trục co-lines ở t = 0 quá tối (30 px) | làm sáng nhãn trục |
| C13 | 1 cặp lệch −433 ms (a1-start "initial") | số hiện sớm hơn lời | dời thời điểm hiện theo ASR |

**Chỉ số vừa chạm ngưỡng (near):**

| luật | chỉ số | giá trị / ngưỡng |
|---|---|---|
| A15 | wpm cold-open | 156,3 |
| S04 | stocks tolerance | 0,5 / 0,5 |
| S11 | core claims | 1 / 1 |
| S15 | cold open | 14,83 s / 15 s |
| V07 | subframes | 8 / 8 |

Các chỉ số near khác xem trong `report.json` (các cờ `near`).

### Thời gian chạy và số lần render
- **Render M2: 2 lần.**
  - Lần 1: 1.847 s wall, 9,25 s/s.
  - Lần 2: **1.660,6 s wall cho 203 s video (8,18 s/s)**, 4 worker, 1.931/6.091 frame supersample. Encode 20 Mbps khoảng 10 phút; audio, mux và bản xem trước khoảng 4 phút.
- **checks/run.sh:** khoảng 51 phút cho 203 s (sampler trang chiếm phần lớn).
- **Ước tính M3** (phần còn lại khoảng 500 s, toàn bài khoảng 703 s):

  | bước | thời gian |
  |---|---|
  | render phần còn lại | ≈ 70 phút |
  | render lại M2 sau khi sửa | ≈ 28 phút |
  | encode + âm thanh + mux | ≈ 20 phút |
  | checks toàn bài (≈ 15 s/s) | ≈ 3 giờ |
  | **mỗi vòng render + check** | **≈ 4,5–5 giờ** |

  Chưa tính thời gian dựng các cảnh act 2/3, method, outro và thumbnail.

### Việc chưa làm
- Các FAIL thật liệt kê ở trên (M2).
- Luật bố cục "≤ 2 lần/90 s" theo nghĩa chặt.
- act3 wpm 149,6.
- Act 2, act 3, method card, outro, ad break, thumbnail (M3).
- Chọn giọng chính thức (#158) — V8 vẫn là tạm thời.

**DỪNG**, chờ duyệt.
