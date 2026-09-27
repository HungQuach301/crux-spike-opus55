# BRIEF-D — sửa đổi (chủ dự án quyết định, ghi bởi Phiên D)

`BRIEF-D.md` giữ nguyên; các quyết định sau có hiệu lực kể từ ngày ghi.

## 2026-09-26 — sau khi duyệt M1

1. **TTS chuyển sang ElevenLabs** cho bài D (thay `gpt-4o-mini-tts` ở §0). Lý do: chủ dự án nghe table read v2 — giọng không ổn định; 0:00–0:25 chậm và "ồm", 0:25–0:28 (a1-start, gần như không giãn) thì đạt.
   - Vẫn là **giọng tạm thời, KHÔNG phải quyết định chọn giọng #158**.
   - Endpoint: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps`; khoá do proxy môi trường gắn (header `xi-api-key`), không có trong code, lệnh hay log.
   - Tốc độ chỉnh bằng `voice_settings.speed`; **không giãn thời gian** (rubberband hay xử lý tương tự) cho giọng ElevenLabs. Lệch nhịp thì sinh lại take hoặc đổi `speed`.
2. **Thử giọng mù (M1b-1)** trước table read v3: 4 giọng General American × 2 model (`eleven_multilingual_v2`, `eleven_v3`) trên 7 câu; file mù V1–V8, giải mã trong `out/voice-audition/key.json`, không nêu trong báo cáo.
3. **Table read v3 (M1b-2, chờ lệnh)**: toàn bài bằng giọng được chọn, không giãn; thêm một bản "nghe" có khoảng lặng rút về ≤ 0,8 s.
4. **checks-appeal §1, §2**: chấp nhận cách né (bỏ sở hữu cách; đọc "Standard & Poor's 500 index"); luật giữ nguyên.
5. **checks-appeal §3**: thêm nguồn đối chiếu cổ phiếu thứ hai nếu truy cập được; lệch thì báo, không tự chọn nguồn.
6. **Kịch bản**: a2-7374 sửa thành "After inflation, stocks and bonds both lose money in 1973 and 1974." (trái phiếu tăng danh nghĩa 1973 +3.66%, 1974 +1.99%); nói "US only" và "history, not a forecast" một lần ở hồi 1.

## 2026-09-26 — sau khi duyệt M1b-1
7. **Giọng: V8 = Eric, `eleven_v3`** (ElevenLabs). Giọng tạm cho bài D, KHÔNG phải quyết định #158. Câu nào 4 take `eleven_v3` vẫn không đạt thì dùng Eric `eleven_multilingual_v2` cho riêng câu đó (liệt kê trong báo cáo).
8. **Nhịp (A15):** chấp nhận luật A15 trượt ở trần 175 wpm từng câu cho các câu diễn có chủ ý. Ràng buộc giữ: trung bình mỗi hồi 150–160 wpm, mọi câu 120–190 wpm. Luật `checks/` giữ nguyên.
9. **S04:** chấp nhận trượt (phương pháp khác nhau; dữ liệu Yale dừng ở 09/2023). Không mở thêm domain. Mô hình vẫn dùng Damodaran.
10. **Không dừng chờ nghe giọng:** làm liền M1b-2 (giọng toàn bài, kiểm bằng máy) rồi M2 (cold open + ident + hồi 1, chất lượng cuối); dừng khi xong M2. Chọn take: (a) đủ từ quan trọng, (b) 120–190 wpm, (c) gần 156 wpm; tối đa 4 take; không giãn thời gian.

## 2026-09-27 — sau M2c: dừng hướng 3D, làm M3
11. **Phong cách:** hướng 3D "thế giới vật lý" (M2b lookdev, M2c ngữ pháp hình + animatic) KHÔNG hợp với nội dung data-explainer và dừng lại. Toàn bộ M2b/M2c (`render-d/look/`, `out/m2b/`, `out/m2c/`, `preprod/visual-bible.md`, `preprod/visual-grammar.md`, `preprod/style*/`) được giữ làm tài sản cho dự án khác, không dùng trong bài D.
12. **"Chuẩn điện ảnh" cho thể loại này** = tay nghề: kịch bản, nhịp, âm thanh, dựng, máy quay có lý do. Không phải thế giới 3D. Hướng M3: **biểu đồ là nhân vật chính, tay nghề điện ảnh bao quanh**.
13. **§4.3 làm ở mức 2.5D:**
    - Phối cảnh 3D ≥ 3 lớp → parallax nhiều lớp.
    - Rack focus → làm mờ lớp nền để dẫn mắt.
    - Làm mờ chuyển động 8× → làm mờ khi máy quay di chuyển trên mặt phẳng.
    - Luật nào không đạt thì báo trượt kèm lý do; KHÔNG sửa `checks/`.
14. **Kịch bản M3:**
    - Bỏ 5 câu dạy thế giới 3D thêm ở M2c; khôi phục dòng thời gian tương ứng.
    - Thêm một câu hồi 2 (V8, cùng quy tắc chọn take) cho claim mới: "In 8 of its years with gains above 10%, the 1966 retiree's balance still fell after the withdrawal and inflation." (1979, 1980, 1983, 1985, 1986, 1988, 1989, 1991), có test.
    - Giữ các sửa âm thanh của M2c: cắt đuôi câu quyết định +250 ms; ducking quanh các con số.

## 2026-09-27 — M3, vòng sửa 2 (chỉ dẫn của chủ dự án)
15. **Trượt đã biết ở 2.5D (không đuổi theo):**
    - **R06** (cắt thấy được trên hình, 68.6%): luật đo mức đổi hình ở mỗi điểm cắt. Bài dựng theo match cut và các biểu đồ nối tiếp nhau, nên nhiều điểm cắt cố ý không thấy rõ.
    - **V05** (ease/overshoot): các chuyển động có quán tính (cameras.js) và `back()` khi số hiện ra.
    - **V07** (tỉ lệ mờ 1.19): mờ chuyển động 8× chỉ có khi máy quay đi trên mặt phẳng biểu đồ, không phải mờ theo chiều sâu 3D.
    - Cả ba ghi "trượt đã biết" theo mục 13. Không sửa `checks/`.
16. **A15, lệch giữa hai cách đo (khoảng 7 wpm):**
    - Cả hai cùng công thức: số từ của `spoken` chia khoảng từ đầu đến từ cuối của ASR.
    - Phiên đo trên từng take sạch, trước khi trộn: các hồi ra 151–159 wpm (`out/voice/wpm-report.md`).
    - Checks đo bằng faster-whisper trên bản trộn cuối, có nhạc và hiệu ứng: các hồi ra 144.8–146.8 wpm.
    - Mốc từ trên bản trộn rộng hơn, nhất là đầu và cuối câu, nên tốc độ đo được thấp hơn chừng 7–9 wpm. M2 đã thấy điều này (hồi 1 thấp hơn khoảng 9 wpm).
    - Theo chỉ dẫn: ghi lại, **không sinh lại giọng**.
