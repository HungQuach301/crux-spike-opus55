# M1b-1: thử giọng mù (ElevenLabs)

**Các file:**
- V1.mp3 … V8.mp3: 4 giọng General American lấy từ thư viện ElevenLabs (nhóm premade), mỗi giọng đọc bằng 2 model.
- `key.json`: bảng giải mã. Không nêu nội dung ở đây.
- `metrics.json`: số đo từng câu, gồm cả các vòng chỉnh speed.

**7 câu được đọc:** co-same, co-broke, co-question, a1-est, a1-start, a1-hook, a2-climax. Văn bản lấy từ kịch bản hiện hành.

**Cách làm:**
- Nhịp chỉ chỉnh bằng `voice_settings.speed`, trong khoảng 0,7–1,2 theo giới hạn của API. Không giãn thời gian.
- Mỗi câu: đọc ở speed 1,0, đo nhịp, rồi đặt lại speed theo tỉ lệ về 155 wpm. Tối đa 2 lần chỉnh.
- **wpm** = số từ đọc / (cuối ký tự cuối − đầu ký tự đầu), tính theo mốc thời gian ký tự ElevenLabs trả về (`normalized_alignment`).
- **ASR:** chạy faster-whisper small.en riêng cho từng clip. Từ quan trọng (số, tên riêng, thuật ngữ) được so bằng hàm A14 đã khoá.
- **Ghép:** mỗi clip cắt về đúng đoạn có tiếng. Nghỉ 0,40 s giữa các câu, 0,70 s sau câu có số quyết định. Khoảng lặng trong câu dài hơn 0,75 s được rút về 0,70 s (chỉ xảy ra 1 lần, ở V7). Mọi khoảng lặng ≤ 0,76 s.
- **Âm lượng:** mọi bản đưa về −20 LUFS bằng một mức gain duy nhất, không dùng limiter.

**Bảng 1.** wpm từng câu, speed cuối trong ngoặc. Ở dòng co-question (4 từ), 0,70 là mức speed thấp nhất API cho phép.

| câu | V1 | V2 | V3 | V4 | V5 | V6 | V7 | V8 |
|---|---|---|---|---|---|---|---|---|
| co-same | 150 (0.86) | 152 (1.00) | 153 (0.74) | 154 (0.94) | 160 (0.82) | 139 (0.89) | 153 (0.70) | 184 (0.70) |
| co-broke | 207 (0.70) | 207 (0.70) | 177 (0.70) | 207 (0.70) | 152 (0.70) | 162 (0.70) | 182 (0.70) | 222 (0.70) |
| co-question | 176 (0.70) | 167 (0.70) | 160 (0.70) | 188 (0.70) | 164 (0.70) | 165 (0.70) | 167 (0.70) | 188 (0.70) |
| a1-est | 134 (1.20) | 134 (1.20) | 151 (1.05) | 125 (1.20) | 166 (1.07) | 165 (1.09) | 164 (0.86) | 101 (1.20) |
| a1-start | 150 (1.05) | 152 (1.00) | 158 (1.00) | 141 (1.20) | 156 (1.12) | 157 (1.00) | 156 (0.84) | 132 (1.20) |
| a1-hook | 182 (0.70) | 195 (0.70) | 158 (0.70) | 176 (0.70) | 153 (0.79) | 151 (0.82) | 159 (0.77) | 163 (0.77) |
| a2-climax | 150 (1.20) | 154 (1.00) | 148 (0.92) | 154 (1.00) | 156 (0.89) | 153 (0.90) | 152 (0.78) | 156 (1.00) |

**Bảng 2.** Tổng hợp theo bản.

| | V1 | V2 | V3 | V4 | V5 | V6 | V7 | V8 |
|---|---|---|---|---|---|---|---|---|
| wpm toàn đoạn | 163.5 | 168.3 | 156.4 | 161.6 | 156.1 | 152.5 | 158.5 | 158.3 |
| độ lệch chuẩn wpm giữa các câu | 23.3 | 24.2 | 8.9 | 26.1 | **4.9** | 8.7 | 9.8 | 36.6 |
| số câu nằm trong 150–160 wpm (trên 6 câu ≥ 4 từ) | 3 | 3 | 4 | 2 | 5 | 3 | 4 | 1 |
| độ nhạy với speed (1 = nhịp theo đúng speed) | 0.18 | 0.20 | 0.99 | 0.09 | 1.07 | 0.99 | 1.05 | 0.19 |
| từ quan trọng ASR không nghe thấy (trên 15) | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 1 |
| LUFS gốc | −19.4 | −18.6 | −24.0 | −17.1 | −22.8 | −19.9 | −23.8 | −18.5 |
| LUFS của file | −20.4 | −20.4 | −20.5 | −20.5 | −20.5 | −20.4 | −20.5 | −20.4 |
| true peak (dBTP) | −2.4 | −3.1 | −0.3 | −3.8 | −0.7 | −2.0 | −1.8 | −4.5 |
| khoảng lặng dài nhất (s) | 0.76 | 0.74 | 0.72 | 0.70 | 0.76 | 0.76 | 0.76 | 0.76 |
| thời lượng (s) | 36.0 | 35.2 | 37.8 | 36.7 | 37.9 | 38.8 | 37.0 | 36.2 |

**Từ quan trọng ASR bỏ sót:**
- V1: "mirror" ở a2-climax, ASR nghe thành "mere".
- V3: "retiree" ở a1-start ("retirees") và "mirror" ở a2-climax ("mere").
- V8: "mirror" ở a2-climax ("Mira").

**Nhận xét, không kèm giải mã:**
- **Bốn bản gần như không theo `speed`:** V1, V2, V4, V8 (độ nhạy 0,09–0,20). Với các bản này, nhịp chỉ còn trông vào việc sinh lại take, nên sẽ khó giữ được 150–160 wpm cho toàn bài.
- **Bốn bản theo `speed` gần đúng tỉ lệ:** V3, V5, V6, V7 (độ nhạy 0,99–1,07).
- **Câu co-broke** ("One ran out of money in 1991.", 8 từ) vẫn nhanh hơn 160 wpm ở 6/8 bản, dù đã ở speed thấp nhất 0,7. Nếu cần thì sửa ở v3: sinh lại take, hoặc cho câu ngắn đó một ngoại lệ có lý do.
- **Âm lượng:** các file đã cùng mức −20 LUFS. V3 và V5 có true peak cao (−0,3 và −0,7 dBTP) vì âm gốc nhỏ nên phải nâng nhiều, không phải vì bị vỡ tiếng.
