# Chấm cuối bài D — Phiên K (audit độc lập)

Ngày 2026-09-27.
- Nhánh Phiên D: `claude/opus55-cine-phase-d-jw6me1` @ `e31631d`.
- Master: `media/opus55-cine-phase-d-m3`, ghép theo `m3/README.md`.
- Nhánh này (`audit/d-final`) chỉ thêm thư mục `audit/`. Tôi không sửa gì khác.

## 1. Khoá checks/

| | SHA-256 |
|---|---|
| `checks/LOCK` trên nhánh D | `0478df7377b754137071e202c2ff396d7deba94293823cabf5f18932c411c612` |
| Tính lại trên nhánh D (lệnh ở cuối `checks/README.md`) | `0478df7377b754137071e202c2ff396d7deba94293823cabf5f18932c411c612` |
| `git diff 5dccb03 e31631d -- checks BRIEF-D.md` | rỗng |

→ **Khớp.** Phiên D không sửa `checks/` và không sửa `BRIEF-D.md`. Các thay đổi đầu bài nằm ở `BRIEF-D-amendments.md`, do chủ dự án quyết định.

Master: 16 phần đều đúng `parts.sha256`. File ghép có SHA `dd6117c66fa66dffbba6ea59fb67eaa670e9f278023f8563f1d374910ffb089a` (1 528 861 420 byte), **khớp**.

## 2. Chạy lại toàn bộ checks, độc lập

**Cách làm**
- Root hợp đồng mới ở `/home/user/aw/root`. Nó là bản sao đã giải symlink của `out/m3/root` trên nhánh D, bỏ `out/checks/` (kết quả và bộ đệm của D).
- `out/video.mp4` là master vừa kiểm SHA.
- `page.json` trỏ tới `render-d/prod/page.html` của commit `e31631d`.
- Bộ lấy mẫu trang chạy mới toàn bộ: 7060 mẫu đối tượng, 3368 mẫu điểm ảnh, mất 4967 s.
- ASR faster-whisper chạy mới trên bản mix, bộ đệm riêng.

**Kết quả của tôi: 54 PASS · 11 FAIL · 6 MISSING · 0 ERROR.**
Phiên D (`checks-report-r2.md`) báo 58 PASS · 13 FAIL.

| Luật | Của tôi | Luật | Của tôi | Luật | Của tôi |
|---|---|---|---|---|---|
| F01–F10 | PASS cả 10 | S01–S03 | PASS | V01, V02 | PASS |
| A01–A06 | PASS cả 6 | **S04** | FAIL | **V03** | FAIL |
| A07, A08 | **MISSING** | S05–S11 | PASS | V04 | PASS |
| A09 | PASS | **S12** | FAIL | **V05** | FAIL |
| A10, A11, A12 | **MISSING** | S13–S15 | PASS | V06 | PASS |
| A13, A14 | PASS | **R01** | **MISSING** | **V07, V08** | FAIL |
| **A15** | FAIL | R02–R05 | PASS (R03 PASS) | V09, V10 | PASS |
| C01–C03 | PASS | **R06** | FAIL | **V11** | FAIL |
| **C04** | FAIL | C05–C12, C14, C15 | PASS | **C13** | FAIL |
| P01 | PASS | | | | |

**Lệch so với `out/m3/checks-report-r2.md`: 7 luật.** 64/71 luật còn lại trùng cả trạng thái lẫn **từng giá trị chỉ số** (so tự động, xem `checks-report-audit.json`), kể cả mọi luật khung hình và luật điểm ảnh.

| Luật | Phiên D | Tôi | Vì sao lệch |
|---|---|---|---|
| A07 | PASS (19,90 dB) | MISSING | Stem M3 (`out/m3/root/out/audio/stems/*`) bị `.gitignore`, không có trong git lẫn nhánh media. Chỉ có stem của M2/M2b. |
| A08 | PASS | MISSING | Như trên |
| A10 | PASS (ρ 0,94) | MISSING | Như trên |
| A11 | PASS (r 0,99) | MISSING | Như trên |
| A12 | PASS | MISSING | Như trên |
| R01 | FAIL (2 đỉnh giả) | MISSING | Như trên. Tension map đo từ stem. |
| R03 | FAIL (khoảng lặng 0,11 s) | PASS (1,08 s) | Không có stem giọng nên luật chỉ dựa vào ASR. Tôi đã kiểm trên master: FAIL của D chủ yếu là **lỗi luật**, xem §6. |

Kết luận §2:
- Mọi con số Phiên D báo mà tôi tái lập được đều **đúng tới chữ số cuối**.
- 6 luật âm thanh/nhịp **không kiểm độc lập được** vì stem M3 không được giao. `checks/CONTRACT.md` bắt buộc giao stem, nên đây là thiếu sót giao hàng của Phiên D.
  - `REPORT-D.md` dòng 208 ghi "Có trong git: stems". Câu đó chỉ đúng với M2.

## 3. Artefact khai báo so với điểm ảnh thật

Dữ liệu ở `audit/pixels/`.

**(a) 24 thời điểm ngẫu nhiên** (seed 20260927, trải 0,5–705,5 s)
- Ở mỗi thời điểm, lấy danh sách chữ trang dựng khai báo (`CHECKS.objects()`: chữ, số, nhãn, hộp), rồi OCR đúng hộp đó trên khung giải mã từ **master** (tesseract).
- 111 đoạn chữ: **104 khớp** (độ giống ≥ 0,8). 42 đoạn có số; 36 đoạn đọc lại được số bằng OCR.
- 7 đoạn không khớp, tôi xem ảnh từng cái:
  - 3 là OCR đọc sai, ảnh đúng: "8" đọc thành "S" hai lần, "1995" đọc thành "7995" (`z356b.png`).
  - **4 ở t = 9,1 s** (cảnh `co-broke`, trong đoạn máy quay chuyển 7,54–9,54 s). Trên master, nhãn "1966 / 1995 / 1966 retiree" bị nhoè ngang, còn **"mirror retiree" hiện hai bản chồng lệch nhau khoảng 20 px** (`cmp-9.100.png`, `z9.png`). Trang dựng cho một bản sạch.
  - Hiện tượng tương tự ở t = 2,43 s (`co-same`): hai nhãn nhân vật bị nhân đôi (`moves-sheet.png`, ô giữa-phải).
  - Luật khung hình miễn chấm trong đoạn máy quay chuyển (thiết kế từ bài C), nên **máy kiểm không bắt được**. Xem §6.
- PSNR giữa ảnh trang dựng và khung master: 29–34 dB ở 22/23 thời điểm có chữ. Khung master có thêm grain, vignette và grade. Riêng mẫu đầu (5,47 s) 22,8 dB do phông của trình duyệt kiểm chưa kịp nạp; đây là lỗi script kiểm của tôi, không phải lỗi bài.

**(b) Thời điểm hiện**
- Lấy 14 chữ mang claim ngẫu nhiên từ `out/m3/text-first.json` (seed 7).
- Trang khai báo độ mờ 0 ở t_hiện − 0,3 s và 1 ở t_hiện + 0,5 s, với 13/14 chữ.
- Trên master, ở +0,5 s, OCR đọc đúng số hoặc nhãn ở 10/13 chữ; 3 ca còn lại là OCR đọc sai, ảnh đúng ("$40,000" thành "940, 000", "5.6%" thành "2.6%", "8" thành ":").
- Độ sáng p95 trong hộp tăng 117–206 mức ở 10/13 chữ. 3 chữ không tăng vì chữ mới thay chữ cũ đúng chỗ (ví dụ "$1.96 million" thay "The mirror is ahead", `cmp-climax.png`).
- Ca thứ 14 (`mr-t20`) ra ngoài khung ở +0,5 s do máy quay lia. Đây là khai báo đúng.

→ Artefact khai báo khớp điểm ảnh ở mọi khung "đứng yên". Chỗ lệch duy nhất là chữ bị nhân đôi hoặc nhoè khi máy quay chuyển.

## 4. Ý kiến về `checks-appeal.md` (không sửa luật)

**§1 A14, "retiree's" và "retirees": khiếu nại ĐÚNG, luật sai.**
- `common.stem` cắt hậu tố không đối xứng: `stem("retiree's") = "retiree"`, `stem("retirees") = "retire"`, `stem("retiree") = "retiree"`.
- Cùng một từ phát âm như nhau lại bị coi là khác nhau. Đây là lỗi của Phiên K, không phải của lời đọc.
- Cách sửa đúng: chuẩn hoá hai phía bằng cùng một phép (bỏ `'s`/`s'` rồi mới bỏ `s`/`es`), hoặc so ở mức lemma.
- Cách né của D (bỏ sở hữu cách) không làm đổi nghĩa và chấp nhận được.

**§2 A14, "S&P": khiếu nại ĐÚNG, luật sai.**
- Kiểm trực tiếp: `asr_join(['the','S','&P','500']) = 'the S &P 500'`. Chuỗi này không chứa `s&p` hay `s and p`.
- `asr_join` phải nối cả token bắt đầu bằng `&`.
- Cách né của D (đọc "Standard & Poor's 500 index") đúng về nội dung.

**§3 S04: không phải khiếu nại.**
- Luật đúng: 3 năm cổ phiếu (2023–2025) thiếu ở nguồn thứ hai. Chủ dự án đã chấp nhận trượt. Tôi đồng ý luật giữ nguyên.

**§4 C04, biểu đồ tròn "đống tiền": khiếu nại ĐÚNG. Lỗi do Phiên K chuyển luật sai.**
- Luật gốc bài C (`render-av/rules.js:144`) chỉ xét `path`/`polyline`:
  `if (el.tagName !== 'path' && el.tagName !== 'polyline') continue;`
- Bản chuyển sang `checks/page/objrules.js:69` **bỏ mất điều kiện này**. Nó chỉ còn yêu cầu `vertices >= 10 && markHex`, nên mọi hình tô kín nhiều đỉnh mang màu chuỗi đều bị coi là "chuỗi đường".
- Đối tượng bị gắn cờ (`a2-bite-p0-rest`, `a2-bite-p1-rest`) có `tag: 'poly'`, là đa giác kín tô `fill`, không có `stroke`, và khai báo `role: 'mark'` chứ không phải `'series'`.
- Theo đúng ý luật C ("biểu đồ đường có trục và hai mốc số"), đối tượng này không thuộc phạm vi luật.
- 364 khung C04 trượt là **dương tính giả**. Biểu đồ tròn không cần trục.
- Đề xuất của D (chỉ xét đường hở không tô, hoặc `role: 'series'`) trùng với luật gốc. Luật chỉ được sửa khi chủ dự án quyết định mở khoá.

## 5. Kiểm mô hình độc lập từ `data/raw`

`audit/model/recompute.py`:
- Đọc thẳng `data/raw/histretSP.xls`: sheet "Returns by year" lấy S&P 500 gồm cổ tức và T.Bond 10 năm; sheet "Inflation Rate" lấy CPI Dec/Dec từ FRED.
- Không dùng `data/normalized` hay mã của D.
- Viết lại mô hình theo §1.2: 60/40, tái cân bằng năm, rút đầu năm, 4% × $1M, chỉnh theo lạm phát năm trước, 30 năm, không thuế, không phí.
- Kết quả thô ở `recompute.json`.
- Đối chiếu phụ: `data/normalized/annual.csv` khớp xls **chính xác** (lệch tối đa 0).

**Mọi con số trong lời đọc hồi 2 và hồi 3 (48 câu có số) đều khớp** với số hiển thị sau khi làm tròn:

| Claim | Tính lại | Claim | Tính lại |
|---|---|---|---|
| 1966 lỗ 4,8% | 4,819% | mirror năm 1: +31,7% | 31,709% |
| lạm phát 1969: 6,2% | 6,197% | 1973/74 thực: CP −21,2/−34,0%, TP −4,6/−9,2% (cả hai lỗ) | đúng |
| 1974 lỗ 14,7%, giá +12,3% | 14,746 / 12,338% | cuối 1974 thực: $461k / mirror $1,27M | 460 508 / 1 271 038 |
| khoản rút vẫn $40,000 (đô la 1966) | 40 000 | 1975 +23,6%, 1976 +20,7% | 23,639 / 20,692 |
| lạm phát 1979: 13,3% | 13,294% | khoản rút 1981: $108,553 danh nghĩa | 108 553,44 |
| 1982 +25,4%; khoản rút = 16,9% số dư | 25,377 / 16,937% | **"8 of its years with gains above 10%"** | **8**: 1979, 1980, 1983, 1985, 1986, 1988, 1989, 1991 |
| đỉnh 1986, cách $1,96M, bằng 49 năm rút | 1986; 1 956 582; 48,9 | trả $96,829 cuối cùng, về 0 năm 1991, 4 năm trống | 96 829,03; 1991; 4 |
| mirror cuối: $6,96M danh nghĩa / $1,44M thực | 6 956 173 / 1 441 084 | bình quân nhân 9,7% (cả hai) | 9,6717% = 9,6717% |
| 69 cửa sổ; 65 đủ 30 năm; 4 cạn: 1965, 1966, 1968, 1969 | đúng | 1982 → $5,36M (đô la 1982) | 5 360 393 |
| 1929 không cạn; thập kỷ đầu thực 3,9% | đúng; 3,858% | 26 cửa sổ cuối kỳ < số dư đầu (thực) | 26 |
| thực 1966: 4,1%; 17 năm thấp hơn mà không cạn | 4,065%; 17 (1945, 1946, 1950–1964) | 1969: 5,6%; 1928: 4,9% | 5,617 / 4,870% |
| 1928 → $1,21M; 1969 cạn ở năm thứ 28 | 1 211 927; 28 | 4 năm cạn đều lỗ thực trong 10 năm đầu | −2,64 / −1,76 / −1,53 / −2,31% |
| thập kỷ đầu 1966: −1,8%; mirror: 6,9% | −1,762 / 6,878% | "lợi suất thực 30 năm khớp nhất với số dư cuối" | Spearman 0,782 (30 năm) > 0,728 (10 năm đầu) |
| 98 năm dữ liệu, 3 đoạn 30 năm tách rời | 98; ⌊98/30⌋ = 3 | | |

**Ghi chú về claim "8"**
- Đếm 8 là đúng theo công thức đã khai (`endReal < startReal` và lợi suất danh mục > 10%).
- **Năm 1991 là năm cạn tiền.** Số dư đầu năm $96,829 nhỏ hơn khoản rút $168,302, nên sau khi rút còn 0. Lợi suất 10% áp lên số 0, và "số dư vẫn giảm" đúng một cách tầm thường.
- Nếu chỉ tính những năm còn tiền sau khi rút thì là **7**.
- Năm 1980 và 1985 chỉ giảm theo giá trị thực; giá trị danh nghĩa vẫn tăng. Câu có ghi "after the withdrawal and inflation", nên vẫn đúng.
- Tôi coi đây là câu **đúng nhưng dễ gây hiểu lầm nhẹ**. Chủ dự án đã duyệt danh sách năm (amendment 14). Cách nói gọn hơn là "7 of its years…, and in 1991 the money ran out".

Mirror dùng lợi suất đảo ngược, lạm phát giữ theo thứ tự lịch (`reverse: ["returns"]`); lựa chọn này đã được khai báo. Nếu đảo cả lạm phát thì $1,27M (1974) thành $1,51M; số trong lời khớp với lựa chọn đã khai báo.

## 6. Kết luận

**Phiên D**
- Mọi số trong lời hồi 2–3 đúng với dữ liệu gốc.
- Mọi kết quả checks tái lập được đều trùng.
- Artefact khai báo khớp điểm ảnh ở khung đứng yên.
- Không thấy báo cáo sai.

**Lỗi hoặc thiếu mà Phiên D bỏ sót**
1. **Stem M3 không được giao** (bị gitignore). 6 luật (A07, A08, A10, A11, A12, R01) không kiểm độc lập được, và `REPORT-D.md` ghi stem có trong git (chỉ đúng với M2).
2. **Chữ nhân đôi hoặc nhoè khi máy quay chuyển** trong cold open (`co-same` quanh 2,4 s; `co-broke` 7,5–9,5 s): nhãn nhân vật hiện hai bản. Người xem thấy được ngay ở 15 giây đầu. Máy kiểm miễn chấm đoạn này.
3. Claim "8" gồm năm cạn tiền 1991 (xem §5).
4. Nhỏ: nhãn "first retiree" ở cảnh cao trào (`cmp-climax.png`), trong khi mọi chỗ khác gọi là "1966 retiree".

**Lỗi của máy kiểm (Phiên K), tôi tự nhận, KHÔNG sửa**
1. A14: stem không đối xứng (§4.1).
2. A14: `asr_join` không nối `&` (§4.2).
3. C04: bản chuyển luật bỏ điều kiện `path`/`polyline` của luật C (§4.4). 364 khung trượt là dương tính giả.
4. **R03, xác nhận chiều dương tính giả:** khi có stem giọng, luật lấy khung "có giọng" đầu tiên sau `end + 0,1 s` làm hết khoảng lặng. Khung đó thường là **đuôi của chính từ vừa đọc**, nên D bị báo 0,11 s.
   - Tôi đo trên master, dải 300–3400 Hz. Sau "1991." ở 10,74 s, lời kết thúc khoảng 10,84 s rồi im tới 12,24 s: khoảng lặng thật khoảng 1,4 s.
   - Sau "$1.96 million dollars." lặng khoảng 1,3 s.
   - Luật đúng phải tìm lần giọng **bắt đầu lại** sau một đoạn im, không phải bất kỳ khung có giọng nào.
   - R03 FAIL trong báo cáo D vì vậy **không đáng tin**. Ở 2/5 vị trí khoảng lặng thật ≥ 1 s. 3 vị trí còn lại bị nhạc che trên master, không tách được nếu không có stem.
5. **R03, nghi có chiều dương tính giả ngược lại:** từ bắt đầu trong vòng 20 ms sau số bị bỏ qua (`w['start'] > end + 0.02`). Ví dụ "dollars" ngay sau "$1.96 million", nên khoảng lặng bị tính từ sau từ kế tiếp. Ở đây kết quả không đổi vì 1,3 s vẫn ≥ 1 s, nhưng luật có thể cho qua sai ở chỗ khác.
6. R06: 2/102 cú cắt nằm lệch lưới khung (207,25 s và 318,55 s) không lấy được khung, nên bị tính là "không thấy". Tỷ lệ bị kéo thấp thêm khoảng 2 điểm %. Không đổi kết luận vì 69,6% vẫn thấp hơn nhiều so với ngưỡng 90%.
7. Thiết kế: miễn chấm trong đoạn chuyển động máy khiến lỗi ở mục D-2 lọt qua.

**Đánh giá các trượt còn lại của D**
- A15, S04, R06, V05, V07: chủ dự án đã chấp nhận hoặc ghi "trượt đã biết".
- C04: dương tính giả, xem trên.
- S12, V03, V08, V11, C13: là trượt thật, tái lập đúng giá trị.
- R01: không kiểm được vì thiếu stem.
- R03: xem mục K-4.

## Tệp trong audit/

- `checks-report-audit.{json,md}`: kết quả 71 luật của lượt chạy độc lập.
- `page-audit.json`, `sampler.log`, `run-full.log`: dữ liệu và log lượt chạy.
- `model/recompute.py`, `model/recompute.json`: tính lại mô hình.
- `pixels/`: 24 thời điểm và 14 lần hiện; script, JSON kết quả, ảnh bằng chứng.
