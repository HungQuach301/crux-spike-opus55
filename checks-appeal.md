# checks-appeal.md — Phiên D

Phiên D không sửa `checks/`. Dưới đây là các điểm luật có vẻ đo sai, kèm bằng chứng. Phiên D không lách: kịch bản được viết lại theo cách nói tự nhiên tương đương (ghi rõ bên dưới), và chờ chủ dự án quyết định.

## 1. A14: sở hữu cách "retiree's" không bao giờ khớp với bản chép ASR "retirees"

**Luật (checks/py/r_audio.py, `key_words` + `match_keys`, `common.stem`).**
- Từ "retiree's" trong `text`: `strip` giữ nguyên dấu nháy ở giữa → `stem("retiree's")` bỏ `'s` → `retiree` (thuật ngữ định nghĩa `retiree`).
- faster-whisper nghe sở hữu cách và số nhiều như nhau, thường viết "retirees" (không có nháy) → `stem("retirees")` bỏ `es` → `retire`.
- Kết quả: `retire ≠ retiree`, nên từ khoá bị tính là **không nghe thấy**, dù giọng đọc đúng.

**Bằng chứng.**
- Table read v1 (`out/voice/asr-takes.json`): 7 câu có "retiree's" đều bị `match_keys` báo thiếu "retiree's": a1-avg1966, a1-avgmirror, a2-y1.2, a2-1982r, a3-real66, a3-mirror-d, a1-hook.
- Ví dụ ASR: "The 1966 retirees portfolio earned an average return of 9 .7%."
- Một take hiếm hoi được chép "1928 retiree's" thì qua.

**Hệ quả.** Luật trượt vì cách viết của ASR, không vì lời thiếu. Sở hữu cách và số nhiều của danh từ này đọc giống hệt nhau.

**Đề xuất (cho Phiên K).** Chuẩn hoá cả hai phía trước khi so stem: bỏ `'s`/`s'` và `s`/`es` rồi mới so. Hoặc coi `retire`/`retiree` là cùng một stem.

**Phiên D đã làm.** Viết lại 10 câu, không dùng sở hữu cách. Ví dụ: "The portfolio of the 1966 retiree…", "The 1966 retiree loses 4.8%". Nghĩa và số giữ nguyên.

## 2. A14: "S&P" không bao giờ khớp vì `asr_join` không nối token "&P"

**Luật.**
- `S&P` nằm trong `PROPER_ALWAYS`.
- `match_keys` chỉ chấp nhận khi `'s&p' in low` hoặc `'s and p' in low`.
- faster-whisper small.en chép "S&P" thành hai token, `"S"` và `"&P"`.
- `common.asr_join` chỉ nối token bắt đầu bằng `, . %` (hoặc token sau `$`/`-`), nên ghép ra "s &p" (có dấu cách). Chuỗi này không khớp mẫu nào.

**Bằng chứng.**
- Cả 4 take của câu "The stocks are the S&P 500 with dividends reinvested." (spoken "S and P five hundred") đều bị chép thành `The stocks are the S &P 500 …`.
- Xem `out/voice/asr-takes.json`, mục a1-assets.1.t0…t3 của table read v1, và `out/voice/choice-report.json` bản v1 (lỗi "missing P").

**Đề xuất.** Để `asr_join` nối cả token bắt đầu bằng `&`, hoặc so `S&P` sau khi bỏ dấu cách.

**Phiên D đã làm.** Lời đọc nói tên đầy đủ "the Standard & Poor's 500 index". ASR nghe đúng "Standard" và "Poor's". Trên màn hình vẫn ghi "S&P 500", vì A14 không đọc màn hình.

## 3. (Ghi nhận, không kháng nghị) S04: không có nguồn thứ hai cho lợi suất cổ phiếu

Domain cần mở nếu chủ dự án muốn có nguồn đối chiếu lợi suất cổ phiếu:
- `www.econ.yale.edu`: dữ liệu Shiller, trả 403 "Host not in allowlist".
- `shillerdata.com`: bị proxy từ chối ngay ở bước CONNECT.

Theo brief §1.3, Phiên D không tự đổi nguồn. S04 hiện chỉ so lạm phát với FRED. `tolerance.stocks_pp = 0.5` được khai báo nhưng chưa dùng vì không có `stocks2.csv`.

## Quyết định của chủ dự án (2026-09-26, sau M1b-1)
- §1, §2: chấp nhận cách né; luật giữ nguyên.
- §3 / S04: **chấp nhận S04 trượt**, không mở thêm domain. Lý do: lệch do phương pháp — Shiller dùng giá trung bình tháng, Damodaran dùng mức cuối năm (82/95 năm lệch > 0,5 pp, trung vị 1,61 pp); bản dữ liệu Yale truy cập được dừng ở 09/2023 nên thiếu 2023–2025. Đối chiếu mô tả trong `data/sources.json` (`crosscheck.stocks.descriptive`): cùng chiều tăng/giảm 91/95 năm; bình quân nhân 30 năm lệch trung bình 0,13 pp (tối đa 0,53 pp), cửa sổ 1966–1995 lệch 0,011 pp. Mô hình vẫn dùng Damodaran.
- A15: chấp nhận trượt trần 175 wpm từng câu cho các câu diễn có chủ ý; ràng buộc giữ: trung bình mỗi hồi 150–160 wpm, mọi câu 120–190 wpm (ghi ở BRIEF-D-amendments.md). Luật không đổi.
