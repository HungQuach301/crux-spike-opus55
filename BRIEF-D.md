# BÀI THỬ D — "Same average, different fate" (chuẩn điện ảnh)

## 0. Phạm vi và vai trò
- Video hoàn chỉnh ≥ 10:00 (đích 10:30–11:30), 16:9, tiếng Anh Mỹ, kênh us-personal-finance, thể loại data-explainer.
- Không mặt người, không footage thật.
- Giữ nguyên: 1920×1080, 30 fps CFR (quyết định #92); giọng TTS tạm thời gpt-4o-mini-tts (KHÔNG phải quyết định chọn giọng #158).
- Hai phiên tách biệt:
  - Phiên K viết và khoá checks/ (SHA trong checks/LOCK).
  - Phiên D dựng, KHÔNG được sửa checks/. Nếu cho rằng luật sai: ghi vào checks-appeal.md, tiếp tục làm, chờ quyết định.
- Cấm thêm bất kỳ phần tử nào chỉ để vượt ngưỡng một chỉ số. Mọi chỉ số chỉ vừa chạm ngưỡng (trong 5% quanh ngưỡng) phải được nêu tên trong báo cáo.
- Mốc (DỪNG ở cuối mỗi mốc, commit, báo cáo):
  - M0 bước 0
  - M1 tiền kỳ
  - M2 bản dựng mẫu: cold open + hồi 1
  - M3 bản đầy đủ

## 1. Nội dung và dữ liệu
1.1 Câu hỏi: hai người nghỉ hưu cùng lợi suất bình quân, vì sao kết cục trái ngược? Chỉ áp cho Mỹ.
1.2 Mô hình [MÁY]:
- Danh mục 60/40 (S&P 500 gồm cổ tức / trái phiếu kho bạc 10 năm), tái cân bằng hằng năm.
- Rút đầu năm: năm 1 rút 4% số dư ban đầu; các năm sau điều chỉnh theo lạm phát năm trước. Kỳ hạn 30 năm.
- Không thuế, không phí. Ghi điều này trên màn hình và trong thẻ phương pháp.
1.3 Dữ liệu [MÁY]:
- Nguồn chính: Damodaran, NYU Stern (histretSP), lợi suất năm từ 1928 và lạm phát.
- Nguồn đối chiếu độc lập: FRED (CPI), cộng một nguồn thứ hai cho lợi suất cổ phiếu nếu truy cập được. Nếu cần domain mới: báo tên domain, không tự đổi nguồn.
- Mọi năm dùng tới phải khớp giữa các nguồn trong dung sai ghi rõ. Lệch thì báo, không tự chọn nguồn.
- Commit file gốc kèm SHA-256, ngày tải, URL, và điều khoản sử dụng (trích dẫn nguyên câu kèm đường dẫn). Nếu điều khoản không cho phép dùng cho kênh có quảng cáo: DỪNG, báo lại.
1.4 Nhân vật:
- "The 1966 retiree" dùng chuỗi thật 1966–1995.
- "The mirror retiree" dùng cùng chuỗi đó theo thứ tự đảo ngược (ILLUSTRATIVE; bình quân nhân phải bằng nhau tới 0,01%) [MÁY].
- Hồi 3: bản đồ mọi năm bắt đầu 1928–1996 (mọi cửa sổ 30 năm có đủ dữ liệu).
1.5 Đúng số [MÁY]:
- Mọi số trên màn hình và trong lời là claim (công thức + nguồn).
- Số lịch sử gắn năm dữ liệu. Số không có nguồn gắn ILLUSTRATIVE, huy hiệu hiện CÙNG LÚC với số.
- Phân biệt rõ danh nghĩa và thực (đã trừ lạm phát) ở mọi con số tiền.
1.6 Nhân dạng [MÁY]:
- "We" chỉ người phân tích; không câu khuyên; không dự báo thị trường.
- Không khuyến nghị mức rút; "4%" chỉ là đầu vào mô tả lịch sử.
- Nêu "US only" và "history, not a forecast".
1.7 Chống chọn mẫu có lợi: hồi 3 phải cho thấy MỌI năm bắt đầu, gồm cả các năm mà thứ tự không gây hại.

## 2. Kịch bản
2.1 Cấu trúc:
- Cold open ≤ 15 s: hình đi trước lời; đặt một câu hỏi mở (open loop) được trả lời ở hồi 3 [NGƯỜI].
- Câu móc lại ở 0:30–0:45: hứa hẹn điều người xem sẽ biết [NGƯỜI].
- Ident ≤ 3 s.
- Hồi 1: dựng hai nhân vật và luật chơi.
- Hồi 2: hai số phận tách nhau; cao trào tại năm chênh lệch lớn nhất.
- Hồi 3: mọi năm; điều gì quyết định; giới hạn của phép phân tích.
- Thẻ phương pháp. Outro ≥ 20 s, vùng trống cho end screen.
2.2 Mỗi hồi có: câu hỏi riêng, bước ngoặt, và payoff [NGƯỜI].
2.3 Cái giá cụ thể: nói bằng năm và số dư, không bằng khái niệm trừu tượng [NGƯỜI].
2.4 Callback: con số cốt lõi quay lại ≥ 3 lần, mỗi lần mang nghĩa mới [MÁY: đếm lần xuất hiện của claim cốt lõi].
2.5 Mật độ: trung bình ≤ 1 con số mới mỗi 8 s; không cảnh nào > 2 con số mới [MÁY].
2.6 Câu ngắn và câu dài xen kẽ: độ lệch chuẩn/trung bình độ dài câu ≥ 0,35 [MÁY].
2.7 Table read: đọc toàn kịch bản bằng TTS trước khi dựng; nộp bản audio và danh sách chỗ sửa sau khi nghe.
2.8 Điểm chèn quảng cáo: 2–3 điểm tại ranh giới hồi, có khoảng lặng tự nhiên ≥ 1 s; ghi mốc thời gian [MÁY].

## 3. Nhịp điệu
3.1 Bản đồ căng–chùng: nộp tension-map.json/png (tốc độ cắt, mật độ âm thanh, mức nhạc theo thời gian); đỉnh ở cao trào mỗi hồi, thung lũng nghỉ sau đó [MÁY: có đủ đỉnh và thung lũng như khai báo].
3.2 Ngắt nhịp: không đoạn nào > 60 s mà không đổi họ layout, cỡ cảnh hoặc lớp âm thanh [MÁY].
3.3 Khoảng thở: sau mỗi con số quyết định ≥ 1,0 s không lời [MÁY].
3.4 Cắt đúng phách hoặc đúng điểm hành động (±1 khung) cho ≥ 70% số cú cắt [MÁY].
3.5 Độ dài cảnh: 1,2–12 s; độ lệch chuẩn/trung bình ≥ 0,4; hồi 2 tăng tốc (độ dài cảnh trung bình giảm dần tới cao trào) [MÁY].

## 4. Hình ảnh
4.1 Tiền kỳ: nộp storyboard, shot list, color script. Mỗi shot có: cỡ cảnh, góc máy, tiêu cự giả lập (24/35/50/85 mm), chuyển động máy, và LÝ DO của chuyển động [MÁY: mọi shot có đủ trường].
4.2 Bố cục:
- Điểm nhìn chính ở giao điểm một phần ba hoặc trục giữa có chủ ý.
- Đường dẫn mắt; khoảng trống phía trước theo hướng chuyển động.
- Thứ bậc ba mức; khoảng âm [NGƯỜI + MÁY: vị trí phần tử mức 1].
- Vùng an toàn chữ 90% [MÁY].
4.3 Máy quay:
- Không gian 3D perspective, ≥ 3 lớp chiều sâu.
- Establishing shot đầu mỗi hồi.
- Quy tắc 180°: thời gian trái → phải; nhân vật 1966 và nhân vật mirror luôn giữ phía, màu và HÌNH DẠNG riêng [MÁY].
- Máy có quán tính: lấy đà, trễ, vượt nhẹ; không chuyển động tuyến tính; giới hạn gia tốc [MÁY: phân tích đường cong camera].
- Rack focus ≥ 3 lần, mỗi lần gắn với một chuyển ý; độ sâu trường ảnh [MÁY: đếm].
- Làm mờ chuyển động: siêu lấy mẫu ≥ 8 khung con/khung. Chỉ được hạ xuống 4 nếu bước 0 chứng minh quá chậm, và phải ghi rõ [MÁY].
4.4 Ánh sáng và màu:
- Ánh sáng key/fill/rim có nguồn gốc; bóng đổ mềm.
- Bảng màu đổi theo hồi đúng color script.
- Mọi màu từ token qua MỘT bảng grade.
- Grain và vignette nhẹ, cố định.
- Không banding trên gradient tối [MÁY].
- Tương phản chữ ≥ 4,5:1 [MÁY].
- Hai nhân vật phân biệt được khi mô phỏng mù màu deuteranopia và protanopia, và ở thang xám [MÁY].
4.5 Hoạt hình: áp các nguyên lý lấy đà, theo đà, chồng lớp chuyển động, cung chuyển động, dàn cảnh [NGƯỜI]. Chữ động theo nhịp lời.
4.6 Chuyển cảnh: ≥ 5 match cut (hình học hoặc ý nghĩa); ≥ 4 J-cut/L-cut; không dùng dissolve mặc định [MÁY: đếm theo khai báo + kiểm hình].
4.7 Giữ toàn bộ luật bài C [MÁY]:
- Bố cục; đồng bộ số–lời ±250 ms theo giá trị cuối; đọc được ở cỡ 25%; hiểu được ở thang xám; chỉ dùng token.
- Không lặp một layout quá 2 lần trong 90 s; tỷ lệ cột đúng; nhãn trục có neo.

## 5. Âm thanh
5.1 Spotting và cue sheet: mỗi cue ghi thời điểm, chức năng kịch tính, giọng (key), tempo; chỗ nào im và vì sao.
5.2 Nhạc (sinh bằng code, có sổ giấy phép):
- Leitmotif cho từng nhân vật, biến tấu theo số phận.
- Đổi hoà âm tại bước ngoặt.
- Tempo map khớp dựng; điểm nhấn khớp cú cắt ±1 khung [MÁY].
- Không sóng sin trơn: phải có envelope, filter, và MỘT không gian reverb thống nhất.
- Không vòng lặp nào nghe ra được [NGƯỜI].
5.3 Sound design:
- Whoosh theo chuyển động máy, cường độ theo tốc độ [MÁY: tương quan].
- Riser vào mỗi lần hé lộ; impact hoặc sub-drop tại con số quyết định; room tone.
- Pan theo vị trí ngang của vật thể [MÁY: tương quan pan–x]; reverb tăng theo chiều sâu.
- ≥ 3 khoảng lặng có chủ ý 0,8–1,5 s [MÁY].
5.4 Lời đọc:
- Chỉ đạo diễn xuất từng câu (cảm xúc, chỗ nghỉ, nhấn); 150–160 từ/phút mỗi chương; không câu > 175.
- Giãn thời gian ≤ 10%; vượt thì sinh take mới [MÁY].
- MỌI từ quan trọng phải có mặt trong ASR [MÁY].
- Xử lý: khử sibilance, EQ, nén nhẹ.
5.5 Mix:
- Lời là ưu tiên số một.
- Nhạc khoét dải 1–4 kHz khi có lời (ducking đa dải) [MÁY: phổ].
- Nhạc thấp hơn lời 18–22 dB (trung bình năng lượng) [MÁY].
5.6 Master [MÁY]:
- −14 LUFS ±1; true peak ≤ −1 dBTP; LRA 6–10 LU.
- Không clip; tương quan pha trung bình > 0,3; nghe được khi gộp mono.

## 6. Kỹ thuật file [MÁY]
- H.264 High, yuv420p, 30 fps CFR, ≥ 16 Mbps.
- Metadata BT.709 (primaries, transfer, matrix), dải limited.
- Không rơi hoặc lặp khung (theo PTS).
- AAC 48 kHz 320 kbps stereo.
- Phụ đề SRT khớp kịch bản 100%: ≤ 42 ký tự mỗi dòng, ≤ 2 dòng, 1–7 s.
- Chapters: ≥ 3 mốc, mỗi mốc ≥ 10 s, bắt đầu từ 0:00.

## 7. Đóng gói
- 3 phương án tiêu đề.
- 3 thumbnail 1280×720 chỉ dùng token, đọc được ở cỡ 10% [MÁY: ảnh thu nhỏ].
- Thumbnail không được gợi ý kết luận mà video không đưa ra.
- Mô tả có: nguồn (URL, năm dữ liệu), giả định, chapters, "not advice", ghi rõ giọng tổng hợp.

## 8. Bước 0 (thuộc Phiên D; DỪNG nếu trượt)
a) Tải được dữ liệu; điều khoản cho phép sử dụng (theo mục 1.3).
b) Render thử 10 s cảnh 3D có độ sâu trường ảnh + làm mờ chuyển động 8×. Báo số giây render cho mỗi giây video.
   Nếu > 60 s/giây: DỪNG, đề xuất phương án giảm tải.
c) TTS + faster-whisper chạy được (như bài C).

## 9. Báo cáo mỗi mốc
- Kết quả checks/ (do Phiên D chạy, KHÔNG sửa).
- Thời gian chạy, số lần render.
- Danh sách chỉ số chỉ vừa chạm ngưỡng.
- Nội dung checks-appeal.md.
- Việc chưa làm.
