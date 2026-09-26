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
