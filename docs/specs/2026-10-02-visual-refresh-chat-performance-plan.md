# Kế hoạch làm mới giao diện và giảm độ trễ chat

Ngày: 2026-10-02. Trạng thái: đề xuất, chưa sửa mã ứng dụng hoặc triển khai.

## 1. Mục tiêu và phạm vi

- Giữ phần lớn sản phẩm hiện tại: bố cục, trang, thành phần giao diện, ảnh, nội dung, chức năng mua hàng, đăng nhập, đơn hàng, thanh toán và cách deploy Docker.
- Hiểu yêu cầu “giữ 90%” là giữ cấu trúc và chức năng; không cam kết một tỷ lệ dòng code khi chưa có diff triển khai. Giao diện chủ yếu sửa màu, độ tương phản, viền, bóng và một ít typography trong CSS dùng chung.
- Giữ nhận diện Minecraft và xanh lá, nhưng tạo phân cấp thị giác bằng nền trung tính và màu nhấn có vai trò rõ ràng.
- Tách ba vấn đề chat: thời gian thấy tin vừa gửi, thời gian người nhận thấy tin, và thời gian khởi động lại hạ tầng sau khi ngủ.
- Mã hiện tại là chat khách ↔ đội ngũ admin theo phòng của khách. Không mở rộng sang nhắn tin tùy ý giữa khách hàng trong đợt tối ưu này.

## 2. Bằng chứng khảo sát

Đã đọc code Next.js 15 / React 19 / Prisma, cấu hình Docker và Render; mở trang công khai https://jewish-horse.onrender.com/en bằng trình duyệt và xem ảnh chụp trang. Chưa đăng nhập production, gửi tin thử, đo API có xác thực hoặc xem metrics Render.

| Phát hiện | Vị trí | Hệ quả |
| --- | --- | --- |
| Nền, card, viền, nút và tiêu đề dùng nhiều sắc xanh tương tự; bóng và blur xuất hiện dày | `src/app/globals.css` | Thiếu tương phản giữa các khu vực; hành động chính khó nổi bật |
| Chat gọi GET mỗi 5 giây | `src/components/chat-panel.tsx:51` | Tin đến có thể chờ gần 5 giây trước khi bắt đầu request tiếp theo, rồi cộng thời gian mạng/server |
| Gửi POST xong mới gọi `load()`; chưa dùng message mà POST trả về để cập nhật giao diện | `src/components/chat-panel.tsx:70-91` | Người gửi phải chờ cả POST và GET; nút gửi bị khóa trong thời gian này |
| GET thay nguyên mảng messages; interval không chặn request chồng nhau | `src/components/chat-panel.tsx:38-51` | Response cũ có thể ghi đè trạng thái mới; cần xử lý khi thêm optimistic UI |
| Admin POST gọi `listRooms()` để xác thực một phòng | `src/app/api/chat/route.ts:54` | Gửi một tin kéo theo đọc danh sách phòng, thông tin đơn và unread không cần thiết |
| Admin GET tải lại danh sách phòng, unread và tối đa 200 tin mỗi lượt | `src/app/api/chat/route.ts`, `src/lib/chat-store.ts` | Chi phí tăng theo lịch sử và số cuộc hội thoại |
| Đã có index `(customerId, createdAt)` và Prisma singleton | `prisma/schema.prisma:198`, `src/lib/payment-db.ts` | Cần tối ưu luồng truy vấn trước; không mặc định thêm index hoặc pool mới |
| Read marker dùng thời điểm hiện tại | `src/lib/chat-store.ts:95-110` | Có cửa sổ đánh dấu đã đọc cả tin mới chưa thực sự hiển thị |
| Blueprint khai báo `plan: free`, `region: singapore` | `render.yaml` | Cần đối chiếu Dashboard: đây chưa phải bằng chứng gói và region đang chạy thực tế |

## 3. Hướng thiết kế: nền than, xanh lá làm điểm nhấn

Tỷ lệ định hướng cho storefront: khoảng 75–80% bề mặt trung tính, phần còn lại dành cho ảnh và các điểm nhấn. Không rải thêm màu lên mọi thành phần.

| Vai trò | Màu dự kiến | Cách dùng |
| --- | --- | --- |
| Nền chính | `#111318` | Nền trang và header |
| Bề mặt | `#1B2028` / `#242B35` | Card, panel, hover |
| Chữ chính / phụ | `#F4F6FA` / `#A8B1C2` | Tiêu đề trắng dịu, nội dung dễ đọc |
| Nhận diện / hành động chính | `#95D47A` | Logo, CTA chính; chữ tối trên nền xanh |
| Nhấn phụ | `#B6A3FF` | Chi tiết hero, link hoặc vùng hỗ trợ, dùng tiết chế |
| Trạng thái chờ / lịch hẹn | `#F2BF6B` | Badge có nhãn chữ đi kèm |
| Viền | `#343C49` | Viền mảnh, giảm cảm giác tất cả đều phát sáng |

Các thay đổi cụ thể:

1. Header trung tính, logo vẫn xanh; navigation trắng/xám, trạng thái active rõ ràng.
2. Giữ hero hai cột, carousel và ảnh hiện có. Tiêu đề chủ yếu trắng, chỉ nhấn một cụm; giảm nền xanh, bóng chữ và blur phủ rộng.
3. Giữ grid sản phẩm, kích thước ảnh và vị trí giá/nút. Card xám than, viền nhẹ, giá dễ đọc; xanh ưu tiên cho nút mua/xem chi tiết.
4. Giữ feature strip, phần hướng dẫn, FAQ và footer; phân biệt bằng độ sáng bề mặt và khoảng cách hiện tại.
5. Giữ font Minecraft cho logo và tiêu đề nhận diện; dùng Inter ở form, nội dung, chat và bảng dữ liệu. Rà soát tiêu đề nhỏ để tránh khó đọc.
6. Chat và admin giữ cấu trúc hiện tại; admin tiếp tục nền sáng trung tính. Chat phân biệt tin gửi/nhận rõ, màu trạng thái có nhãn, không để CSS của storefront làm chữ sáng rơi vào panel trắng.
7. Tạo biến CSS theo vai trò và scope storefront/admin/chat; thay màu tại selector liên quan. Tránh chồng thêm hàng loạt override `!important` vào cuối file.
8. Giảm hiệu ứng blur/bóng trên bề mặt lớn; tôn trọng reduced motion. Tác động tới độ mượt cuộn phải đo riêng, không coi đây là sửa độ trễ mạng.

Phạm vi dự kiến: `src/app/globals.css` là chính; chỉ thêm class/theme scope ở layout hoặc component nếu cần. Không thay thư viện UI hoặc dựng lại trang.

## 4. Tối ưu chat theo thứ tự

### Bước A — Đo trước khi sửa

- Dùng hai tài khoản thử trên môi trường kiểm thử và bản build production trong Docker.
- Đo: click → bubble xuất hiện; POST → xác nhận lưu DB; gửi → người nhận thấy; GET phòng/tin; số query, payload và request/phút.
- Phân đoạn thời gian xác thực, kiểm tra phòng, đọc/ghi DB; dùng request ID / Server-Timing, không ghi nội dung tin hoặc token vào log.
- Tách kết quả service đang chạy với lần truy cập sau idle. Ghi rõ vị trí client, app, database và tải thử.
- Đối chiếu gói Render, region database, CPU/RAM, pool wait và query latency. Chưa có các số này nên chưa kết luận DB hoặc gói máy là nút thắt chính.

### Bước B — Người gửi thấy phản hồi ngay

- Chèn tin cục bộ ngay khi bấm gửi, hiển thị “Đang gửi”; thành công đổi thành “Đã gửi”, lỗi có “Gửi lại”. “Đã gửi” chỉ xuất hiện sau khi server xác nhận lưu.
- Đọc `{message}` từ POST để thay tin tạm, bỏ GET toàn cuộc trò chuyện khỏi đường chờ gửi.
- Mỗi tin có `clientMessageId`; server chống ghi trùng bằng unique constraint được scope theo người gửi/phòng. Cần migration nhỏ cho độ an toàn khi retry sau timeout.
- Quản lý hàng đợi theo phòng, cho phép nhập/gửi tin tiếp theo; không khóa toàn composer vì một lượt đồng bộ lịch sử.
- Merge theo ID, bảo toàn tin pending, chống response cũ ghi đè và chống tin xuất hiện nhầm khi chuyển phòng.
- Với ảnh: preview cục bộ, trạng thái tải, giữ kiểm tra loại/kích thước và quyền truy cập hiện tại; thu hồi object URL khi không dùng.
- Chỉ tự cuộn khi người dùng đang gần cuối hoặc vừa tự gửi. Đang đọc lịch sử thì hiện chỉ báo có tin mới.

### Bước C — Giảm việc server phải làm

- Admin gửi tin: kiểm tra trực tiếp khách/phòng mục tiêu và quyền truy cập với cùng điều kiện nghiệp vụ hiện có; không gọi `listRooms()` để xác thực một phòng.
- Tách truy vấn danh sách phòng và tin của phòng đang mở. Tải trang tin đầu có giới hạn; các lần sau chỉ lấy phần mới theo cursor, lịch sử tải thêm khi cần.
- Giữ index đang có; chỉ thêm/chỉnh index sau khi xem query plan trên dữ liệu đại diện, đặc biệt truy vấn unread.
- Cập nhật read marker tới tin đã hiển thị, không dùng thời điểm request như mốc đọc. Chỉ đánh dấu đọc khi phòng đang mở và trang đang hiển thị.
- Chặn request polling chồng nhau; khi tab ẩn giảm/tạm dừng và đồng bộ lại khi quay về.

### Bước D — Đẩy tin tới người nhận bằng SSE

Đề xuất SSE cùng API POST hiện có: trình duyệt vẫn gửi bằng HTTP; server thông báo tin mới qua kết nối mở. Phù hợp Next.js Route Handlers và Docker standalone hiện tại, giảm phạm vi thay đổi máy chủ.

- Thêm `/api/chat/events` và một nơi quản lý sự kiện dùng chung. Phát sự kiện sau khi lưu DB thành công, bao gồm tin tự động từ luồng thanh toán qua `addMessage()`.
- Với đúng một Node process/instance: thử event bus trong process, kiểm tra trong bản Docker standalone rằng các route thực sự dùng chung bus. Không mặc định điều này đúng chỉ vì chạy được ở dev.
- Nếu có nhiều process/instance hoặc luồng ghi bên ngoài process, cần broker chung như Redis Pub/Sub hoặc cơ chế thông báo DB phù hợp. Chỉ chọn sau khi xác nhận topology; không mặc định tăng hạ tầng ngay.
- PostgreSQL vẫn là nguồn dữ liệu chuẩn. SSE là thông báo; mất kết nối/redeploy phải reconnect và lấy bù bằng cursor, có cơ chế chống trùng và tránh bỏ sót trong lúc chuyển từ tải lịch sử sang nghe sự kiện.
- Có heartbeat, cleanup khi ngắt kết nối, giới hạn kết nối và kiểm tra lại phiên/quyền khi kết nối dài; logout/thu hồi quyền phải chấm dứt quyền nhận tin.
- Mỗi khách chỉ nhận sự kiện của mình; admin nhận theo quyền. Không broadcast nội dung riêng tư cho toàn bộ client.
- Dùng một kết nối dùng chung trong mỗi tab để đồng bộ chat, danh sách phòng và badge. Giữ polling nhẹ có backoff làm dự phòng khi SSE thất bại; không chạy full polling 5 giây song song SSE.
- Thử khả năng stream/flush và reconnect thực tế trên Render. Nếu nhiều tab/HTTP version tạo giới hạn kết nối, bổ sung phối hợp tab khi cần.

Luồng dự kiến: bấm gửi → bubble “Đang gửi” → POST → lưu DB → response xác nhận + sự kiện SSE → phía nhận cập nhật. Optimistic UI cải thiện phản hồi cục bộ; SSE và truy vấn nhẹ cải thiện nhận tin thực tế.

## 5. Render và database

- Nếu deployment thực sự dùng Free: Render ghi rõ service ngủ sau 15 phút không có lưu lượng vào; đánh thức có thể mất khoảng một phút. Đánh giá gói compute không ngủ nếu cần chat sẵn sàng liên tục. Đây là vấn đề khác với polling 5 giây trong code.
- Kiểm tra database có gần app Singapore không và có suspend sau idle không. Nếu DB ở xa, đánh giá chuyển region bằng kế hoạch migration riêng; không tự chuyển DB production trong đợt sửa UI/chat.
- Kiểm tra pooling và số connection theo số instance thực tế; code đã tái sử dụng PrismaClient. Không tăng pool hoặc thêm Redis khi chưa có bằng chứng cần thiết.
- SSE/WebSocket không tự chữa thời gian đánh thức app hoặc độ trễ ghi DB. Nâng gói cũng không bỏ được độ trễ polling nếu giữ nguyên code.
- Giữ Docker và cách deploy hiện tại; chỉ chỉnh khi kiểm chứng yêu cầu stream hoặc tài nguyên. Không coi việc Docker build thành công là kiểm chứng hiệu năng chat.

## 6. Mốc triển khai và nghiệm thu

| Mốc | Kết quả có thể review | Điều kiện hoàn thành |
| --- | --- | --- |
| 1. Baseline và mẫu giao diện | Số đo chat; preview trang chủ, chat và một trang admin trên desktop/mobile | Thống nhất palette, giữ vị trí thành phần và luồng hiện tại |
| 2. Gửi tin và query | Optimistic UI, xác nhận trực tiếp từ POST, chống trùng, kiểm tra phòng gọn | Thử chậm mạng, timeout sau commit, retry, gửi liên tiếp và chuyển phòng |
| 3. Nhận tin realtime | SSE, reconnect/catch-up, unread/read state | Hai trình duyệt, nhiều admin, nhiều tab, restart container; không mất/trùng/lộ tin |
| 4. Áp dụng theme và kiểm tra tổng thể | CSS dùng chung và diff nhỏ theo thành phần | Không vỡ responsive hoặc các luồng mua hàng/admin |

Mục tiêu hiệu năng ban đầu (cần baseline để xác nhận khả thi, không phải kết quả đã đo):

- Tin văn bản xuất hiện cục bộ trong 100 ms sau click ở thiết bị thử đại diện.
- Khi app và DB đang chạy, mạng ổn định: p95 xác nhận tin văn bản dưới 700 ms; p95 từ lúc gửi đến người nhận thấy dưới 1 giây ở tải thử công bố rõ.
- Không cần GET toàn bộ cuộc trò chuyện để hiển thị tin vừa gửi; đường nhận tin chính không còn chờ interval 5 giây.
- Không mất/trùng tin sau retry hoặc reconnect; không đánh dấu đã đọc tin chưa hiển thị.
- Ảnh và cold start đo riêng, không gộp vào chỉ tiêu tin văn bản đang chạy ổn định.

Kiểm chứng khi triển khai: typecheck, unit test hiện có, build production, E2E chat/quyền riêng tư/unread và smoke các luồng đặt hàng/thanh toán. Test dữ liệu dùng `E2E_DATABASE_URL` riêng theo quy định hiện có. Kiểm tra contrast WCAG AA cho văn bản, focus và trạng thái tương tác; screenshot ở 390, 768 và 1440 px. Commit phần theme và chat riêng để rollback độc lập; migration chống trùng phải tương thích dữ liệu cũ.

## 7. Tài liệu đối chiếu

- Render Free và cold start: https://render.com/docs/free
- Render hỗ trợ WebSocket và yêu cầu xử lý mất kết nối: https://render.com/docs/websocket
- Next.js 15 Route Handlers và streaming: https://nextjs.org/docs/15/app/api-reference/file-conventions/route
- EventSource/SSE, reconnect, ID và giới hạn kết nối: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events

Các lựa chọn còn cần số liệu: gói/region thực tế, region và trạng thái idle của DB, số người chat đồng thời, hiệu năng API đã xác thực. Không cần thay đổi production để hoàn thành bản kế hoạch này.
