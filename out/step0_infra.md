# Bài thử C — Bước 0: kiểm hạ tầng (2026-09-26)

**Trạng thái: DỪNG ở bước a) theo đúng luật. Chưa bắt đầu phần PHẠM VI.**

| Bước | Kết quả |
|---|---|
| a) `CLAUDE_CODE_ENVIRONMENT_NAME` | **TRƯỢT** — nguyên văn lệnh in ra: `ENV=` (biến không được đặt, giá trị rỗng). Đối chiếu qua API phiên: session này chạy trên `environment_id env_012JGf3HjmS8LM53EPzCYAUV`, tên môi trường là `crux-spike-av`. Nghĩa là môi trường đúng, nhưng biến chưa được xuất vào container. |
| b) Công cụ | faster_whisper 1.2.1 và pyloudnorm có sẵn. ffmpeg ban đầu chưa có (`ffmpeg: command not found`); đã tự cài bằng apt → `/usr/bin/ffmpeg`. |
| c) OpenAI TTS | **ĐẠT, lần 1**: gọi `POST /v1/audio/speech` (model `gpt-4o-mini-tts`, voice `alloy`, mp3) KHÔNG kèm header Authorization → HTTP 200, MP3 24 kHz mono, 6,86 s. Proxy môi trường tự gắn khoá. Không cần tới SDK hay OPENAI_API_KEY. Không in khoá nào. |
| d) faster-whisper small.en (CPU, int8) | **ĐẠT**. Câu gửi đi: "Paying off a five point two percent car loan early saves one thousand two hundred forty dollars in interest." Bản chép lời: `Paying off a 5.2% car loan early saves $1,240 in interest.` Có mốc thời gian cho từng từ (14 từ). |

Lưu ý: trong câu thử, số viết bằng chữ khi gửi TTS; ASR trả về ở dạng chữ số. Máy kiểm "đọc đúng số" sẽ phải chuẩn hoá cả hai phía trước khi so.
