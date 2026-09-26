# Table read: danh sách sửa sau khi nghe (BRIEF-D §2.7)

**Hai bản table read:**
- `tableread-v1.mp3`: take đầu tiên của mọi câu, bản kịch bản đầu. Dài 612 s.
- `tableread-v2.mp3`: take được chọn của kịch bản đã sửa, đã giãn theo kế hoạch (≤ ±10%). Dài 667 s.

Số liệu đo của từng bản nằm trong `tableread-v1.json` và `tableread-v2.json`.

**"Nghe" ở đây làm thế nào.** Phiên D không có tai. Mỗi take được nghe qua ba kênh:
- faster-whisper small.en chép lại lời.
- Đo nhịp theo đúng định nghĩa A15.
- Kiểm từ khoá bằng chính hàm `key_words`/`match_keys` đã khoá của checks, chỉ đọc (`audio/d_choose.py`).

Sau đó Phiên D đọc lại bản chép của từng câu. **Chủ dự án vẫn nên nghe v2 bằng tai**, nhất là ngữ điệu và cảm xúc: máy đo không thay được phần này.

## Sửa lời (kịch bản)

| # | Chỗ | Vấn đề nghe thấy ở v1 | Sửa |
|---|---|---|---|
| 1 | method.1 | ASR chép "Professor de Motoran", tên riêng sẽ trượt A14 | Bỏ tên khỏi lời: "annual returns compiled at NYU Stern". Tên Damodaran vẫn hiện trên thẻ phương pháp và trong mô tả |
| 2 | a3-all.2 | "30 full years" bị nghe thành "34 years" | "each with 30 years of data" |
| 3 | 10 câu có "retiree's" | Sở hữu cách nghe như số nhiều: người xem nghe "the 1966 retirees portfolio", ASR chép "retirees" | Viết lại không dùng sở hữu cách ("The portfolio of the 1966 retiree…"). Xem checks-appeal.md §1 |
| 4 | a1-assets.1 | "S and P 500" được chép "S &P" | Đọc tên đầy đủ "Standard & Poor's 500 index". Màn hình giữ "S&P 500". Xem checks-appeal.md §2 |
| 5 | a2-short | **Sai số:** "nothing is left for the last 5 years". Tiền cạn ở năm 26, năm 26 chỉ trả được một phần, nên chỉ có 4 năm (27–30) trống | "That last payment is short of the full withdrawal, and the final 4 years of the plan get nothing." (claim `emptyYears` = 30 − 26) |
| 6 | 4 câu mang số quyết định | Số nằm giữa câu, nên sau số không có khoảng thở (R03 đo từ cuối cụm số) | Đưa số ra cuối câu: "…hits zero in 1991.", "In 1966 dollars, the 1966 retiree ends 1974 with $461,000.", "…is now ahead by $1.96 million.", "…first decade … averaged −1.8%." |
| 7 | a3-good | "Start in 1982, and…" là câu mệnh lệnh, dính mẫu ADVICE `^start` | "A retiree who started in 1982 under the same rules ended with…" |
| 8 | Cold open | 134 wpm. "Same… same… same…" đọc ngắt quãng. Tổng dài hơn 15 s | Gộp thành một câu liền: "Two retirees with the same balance, the same withdrawals and the same average return." Bỏ "The other never came close." (hình đã kể). Cold open còn 14,6 s |
| 9 | co-question | Thêm "So... what decided it?" vào lời đọc thì chậm tới 90–104 wpm | Bỏ dấu "..." |
| 10 | Câu móc (a1-hook) | v2 đầu tiên rơi vào 33,5–45,8 s, tràn khỏi 0:45 | Rút gọn a1-who, lead của a1-est 1,2 → 0,7 s. Câu móc nay ở 32,4–44,7 s |
| 11 | Độ dài | v1 dài 612 s, sát 10:00 | Thêm các nhịp cụ thể bằng năm và số dư: a1-who (trớ trêu kịch), a1-arith (trung bình cộng cũng bằng nhau, 10.3%), a2-7576 (1975–76 tăng 23.6% / 20.7%), a2-grind + a2-1979 (13.3%), a2-1981 ($108,553 danh nghĩa = $40,000 năm 1966), a2-seq (gọi tên "sequence-of-returns risk"), a2-years (khoảng cách = 49 năm rút tiền), a2-mirror-late (lỗ 1974 đến vào 1987), a3-real66 (4.1% thực; 17 năm bắt đầu có trung bình thực thấp hơn mà không cạn), a3-less (26/69 kết thúc dưới số vốn thực), a3-1929 (năm sụp đổ vẫn không cạn nhờ giảm phát, 3.9% thực) |
| 12 | a3-1969 | Câu so sánh dài, hai số dồn một chỗ | Tách thành hai câu ngắn: "After inflation, the 1969 retiree averaged 5.6% a year." / "The 1928 retiree averaged less: 4.9%." |

## Sửa đọc (take)

- **Nhịp ở v1.** 28 câu > 175 wpm (nhanh nhất 248) và 21 câu < 140 wpm. TTS đọc câu ngắn rất nhanh, giống hiện tượng đã thấy ở bài C.
- **Cách xử lý.**
  - Sinh tới 4 take cho mỗi câu lệch nhịp. Từ take thứ 2 trở đi có thêm gợi ý nhịp trong instruction.
  - Chọn take đủ từ khoá và gần 156 wpm nhất.
  - Giãn thời gian ±10% (rubberband, giữ cao độ và formant).
  - Riêng 6 câu: thêm dấu ngắt ("...", ",") vào trường `spoken`, còn `text` và phụ đề giữ nguyên.
- **Kết quả v2** (sau giãn theo kế hoạch):
  - Cold open 157,3 · hồi 1 156,3 · hồi 2 156,1 · hồi 3 157,5 · phương pháp 154,4 · outro 156,5 wpm.
  - 0 câu > 175.
  - 1 câu < 140: "Analysts call this sequence-of-returns risk.", 128 wpm, câu đặt tên nên chậm là có chủ ý.
- **Còn lại cho M2:**
  - 29/117 câu đang dùng đúng mức giãn tối đa ±10%, tức sát ngưỡng A13. Cần sinh thêm take để giảm mức giãn.
  - Nhịp phải đo lại trên bản mix thật (A15 tự chạy ASR trên bản mix).
