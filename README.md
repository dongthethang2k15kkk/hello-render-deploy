Docker / Render deployment: see [DEPLOYMENT.md](./DEPLOYMENT.md). Database: [DATABASE.md](./DATABASE.md). Decision log: [HANDOFF.md](./HANDOFF.md).

# Jewish Horse — cửa hàng gói số

Web bán gói số: khách đặt hàng, chuyển khoản VND bằng mã VietQR, chọn khung giờ rảnh; Admin xác
nhận tiền, chốt lịch hẹn và giao hàng qua chat trên web. Live: https://jewish-horse.onrender.com

## Chức năng hiện có

**Khách hàng**
- Đăng ký / đăng nhập bằng email + mật khẩu hoặc Google; trang Account, Forgot password (Discord: link + QR), Privacy.
- Catalog từ PostgreSQL: giá nhập bằng VND, hiển thị USD (to) và VND (nhỏ) theo tỷ giá Admin đặt.
- Giỏ hàng lưu trên thiết bị; Checkout tạo đơn thật, giữ hàng 30 phút.
- Trang đơn: mã VietQR điền sẵn số tiền + nội dung (mã đơn), đồng hồ đếm ngược, nút "I've transferred"
  kèm chọn 1–5 khung giờ rảnh; lịch hẹn kèm Google Calendar / file .ics; nội dung giao chỉ khách đó xem.
- My orders, Inbox (thông báo có số chưa đọc), chat hỗ trợ lưu vĩnh viễn (ảnh chat riêng tư, xóa sau 90 ngày).

**Admin** (đăng nhập Google theo `ADMIN_GOOGLE_EMAILS`)
- Overview: việc cần làm, lịch hẹn sắp tới, doanh thu hôm nay/7/30 ngày, khách, hàng sắp hết, dung lượng DB, Gmail.
- Orders: lọc, "Needs action"; trang đơn: xác nhận tiền + chốt lịch trong một bước, đổi lịch, hoàn tất, hủy (trả tồn),
  ghi chú nội bộ, gửi lại email, dòng thời gian, nhật ký email.
- Customers: danh sách/lọc, lịch sử đăng nhập, khóa/mở, đặt mật khẩu mới, đăng xuất mọi nơi, xóa/ẩn danh.
- Activity: nhật ký mọi thao tác Admin. Settings: Products, Payments (tài khoản ngân hàng, QR thử, tỷ giá), Email (Gmail).

**Email**: gửi qua Gmail API từ Gmail của shop (Render Free chặn SMTP). Admin nhận thư khi khách báo đã chuyển;
khách nhận thư lịch hẹn (kèm .ics), xác nhận tiền, hoàn tất, hủy. Mọi sự kiện đồng thời vào Inbox trên web.

Thiết kế: `docs/specs/2026-09-29-phase1-accounts-chat-design.md`, `docs/specs/2026-09-29-phases-2-5-orders-design.md`.

## Chạy local (Windows)

Yêu cầu Node.js 22+, npm và một PostgreSQL (khuyên dùng một branch Neon riêng, không dùng production).

```bat
cd /d "E:\Tai_lieu_E\DONGTHETHANG\04_Cá_nhân\hello"
npm install
npm run db:generate
npm run dev
```

Truy cập http://localhost:3000/en. Không có `DATABASE_URL` thì chỉ xem được catalog mẫu; tài khoản, đơn và chat cần database.
`ALLOW_DEV_ADMIN_LOGIN=1` bật nút "Dev admin" (chỉ khi không phải production).

## Kiểm tra

```bat
npm run typecheck
npm test
set NEXT_BUILD_DIR=.next-verify && npm run build
npx playwright install chromium
npm run test:e2e
```

E2E cần `E2E_DATABASE_URL` trỏ tới database dùng một lần (xem DATABASE.md); global setup chỉ chạy `migrate deploy`
+ seed, không xóa dữ liệu, và từ chối chạy nếu trùng host với `DATABASE_URL`. Trên Windows có Edge, Playwright dùng
`msedge`. Chưa coi là đạt nếu lệnh không có kết quả xác nhận.
