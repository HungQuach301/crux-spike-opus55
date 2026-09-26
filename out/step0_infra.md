# Bài thử C — Bước 0: kiểm hạ tầng (2026-09-26)

**Trạng thái (cập nhật):** chủ dự án xác nhận bước a) ĐẠT, vì API cho biết môi trường là `env_012JGf3HjmS8LM53EPzCYAUV` / `crux-spike-av`, và TTS chạy được mà không gửi khoá (bằng chứng độc lập rằng credential của crux-spike-av đang được áp dụng). Phạm vi tiếp tục trong cùng phiên.

| Bước | Kết quả |
|---|---|
| a) `CLAUDE_CODE_ENVIRONMENT_NAME` | **ĐẠT (chủ dự án chấp nhận bằng chứng qua API)**. Ban đầu ghi là TRƯỢT — nguyên văn lệnh in ra: `ENV=` (biến không được đặt, giá trị rỗng). Đối chiếu qua API phiên: session này chạy trên `environment_id env_012JGf3HjmS8LM53EPzCYAUV`, tên môi trường là `crux-spike-av`. Nghĩa là môi trường đúng, nhưng biến chưa được xuất vào container. |
| b) Công cụ | faster_whisper 1.2.1 và pyloudnorm có sẵn. ffmpeg ban đầu chưa có (`ffmpeg: command not found`); đã tự cài bằng apt → `/usr/bin/ffmpeg`. |
| c) OpenAI TTS | **ĐẠT, lần 1**: gọi `POST /v1/audio/speech` (model `gpt-4o-mini-tts`, voice `alloy`, mp3) KHÔNG kèm header Authorization → HTTP 200, MP3 24 kHz mono, 6,86 s. Proxy môi trường tự gắn khoá. Không cần tới SDK hay OPENAI_API_KEY. Không in khoá nào. |
| d) faster-whisper small.en (CPU, int8) | **ĐẠT**. Câu gửi đi: "Paying off a five point two percent car loan early saves one thousand two hundred forty dollars in interest." Bản chép lời: `Paying off a 5.2% car loan early saves $1,240 in interest.` Có mốc thời gian cho từng từ (14 từ). |

Lưu ý: trong câu thử, số viết bằng chữ khi gửi TTS; ASR trả về ở dạng chữ số. Máy kiểm "đọc đúng số" sẽ phải chuẩn hoá cả hai phía trước khi so.

## Cần sửa môi trường sau

- **ffmpeg do phiên tự cài**, vì bước `apt` trong setup script của môi trường `crux-spike-av` thất bại (theo chủ dự án). Phiên chỉ quan sát được `ffmpeg: command not found`, rồi chạy `apt-get install -y ffmpeg` (có `apt-get update` dự phòng). Cần sửa setup script để container mới có ffmpeg sẵn.
- `CLAUDE_CODE_ENVIRONMENT_NAME` không được xuất vào container. Nếu còn dùng làm cổng kiểm, cần đặt biến này trong cấu hình môi trường.
