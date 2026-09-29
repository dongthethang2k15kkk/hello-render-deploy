# Database deployment

## Quyết định cho bản miễn phí

Giữ ứng dụng trên **Render Free** và đặt PostgreSQL ở một dịch vụ bên ngoài có lưu trữ
bền vững. Neon Free là lựa chọn đề xuất cho bản demo này. Không chạy PostgreSQL trong
cùng Docker container với ứng dụng trên Render Free.

Lý do: filesystem của Render Free là tạm thời. Dữ liệu ghi trong container bị mất khi
service sleep, restart hoặc redeploy; Free Web Service cũng không gắn được persistent
disk. Render PostgreSQL Free hiện hết hạn sau 30 ngày. Docker không thay đổi hai giới
hạn này vì volume của Docker vẫn nằm trên filesystem của máy chủ.

Tài liệu chính thức:

- Render Free: https://render.com/docs/free
- Render persistent disks: https://render.com/docs/disks
- Neon pricing: https://neon.com/pricing
- Neon và Prisma: https://neon.com/docs/guides/prisma

## Phương án A — Render Free + Neon Free

Đây là phương án ít vận hành nhất và không cần cài Docker/PostgreSQL trên máy cá nhân.

1. Tạo một project tại https://console.neon.tech và chọn region gần Render nhất trong
   danh sách Neon cung cấp.
2. Trong **Connect**, sao chép PostgreSQL connection string. URL phải dùng TLS, thường
   có `sslmode=require`. Dùng pooled connection string mặc định cho ứng dụng và Prisma 6.
3. Trong Render → Web Service → **Environment**, thay `DATABASE_URL` bằng URL Neon.
   Không ghi URL này vào Git, `render.yaml`, ảnh chụp hoặc tin nhắn công khai.
4. Save/Deploy. `scripts/start-container.mjs` tự chạy `prisma migrate deploy` trước khi
   khởi động Next.js, nên database trống sẽ được tạo đúng schema.
5. Kiểm tra log có `Migrations completed successfully`, sau đó mở `/api/health`,
   storefront và Admin → Settings → Products.
6. Trên máy đã đặt URL Neon trong `.env`, kiểm tra an toàn bằng:

   ```powershell
   npm run db:status
   npx prisma migrate status
   ```

Database Render hiện tại được kiểm tra ngày 2026-09-29: schema đã cập nhật nhưng tất cả
bảng nghiệp vụ đều có 0 dòng. Vì vậy có thể chuyển thẳng sang Neon và chạy migration,
không cần nhập dữ liệu. Nếu database có dữ liệu trước lúc chuyển, dùng Neon Import Data
Assistant với source connection string hoặc tạo `pg_dump` trước khi đổi `DATABASE_URL`.

## Phương án B — tự chạy PostgreSQL bằng Docker

Phương án này hoạt động trên máy cá nhân hoặc VPS mà bạn kiểm soát ổ đĩa. Nó không phải
cách lưu database bền vững trên Render Free.

Repo đã có `compose.db.yaml`. File này tạo PostgreSQL 17 ở private Docker network, dùng
named volume `postgres_data`, chờ health check, chạy migration rồi mới mở ứng dụng:

```powershell
# .env cần AUTH_SECRET và POSTGRES_PASSWORD ngẫu nhiên, không để trống.
docker compose -f compose.yaml -f compose.db.yaml up --build -d
docker compose -f compose.yaml -f compose.db.yaml ps
docker compose -f compose.yaml -f compose.db.yaml logs migrate
```

Restart hoặc `docker compose down` không xóa named volume. Không chạy `down -v` trừ khi
chủ ý xóa database. Named volume không phải backup; hỏng ổ đĩa hoặc xóa Docker Desktop
vẫn có thể làm mất dữ liệu.

Tạo backup dạng PostgreSQL custom dump bằng image chính thức:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup-postgres.ps1
```

File backup nằm trong `backups/` và bị Git bỏ qua. Công cụ này cần Docker đang chạy.
Kiểm tra khả năng restore trên một database tạm trước khi coi backup là hợp lệ.

## Cutover an toàn

1. Tạo database đích và chạy migration/import.
2. Kiểm tra số dòng bằng `npm run db:status` ở cả nguồn và đích.
3. Tạm dừng thao tác ghi trong Admin.
4. Đổi duy nhất `DATABASE_URL` trên Render rồi deploy.
5. Tạo thử một sản phẩm, reload storefront, sửa lại sản phẩm và xác nhận dữ liệu còn sau
   một lần redeploy.
6. Chỉ xóa database cũ sau khi database mới đã hoạt động và có backup đã kiểm tra.

## Ảnh sản phẩm

Ảnh Admin tải lên được lưu trong bảng `ProductImage` (cột `BYTEA`) của cùng database, không
ghi vào filesystem của container, nên không mất khi Render Free sleep/restart/redeploy. Trình
duyệt tự thu nhỏ ảnh lớn (tối đa 1800 px, WebP) trước khi gửi; server chỉ nhận PNG, JPEG hoặc
WebP tối đa 2 MB và kiểm tra magic bytes. Ảnh trùng nội dung (SHA-256) được dùng lại.

- Storefront đọc ảnh qua `GET /api/product-images/<id>` với cache `immutable`.
- Ảnh đã tải nhưng không được lưu vào sản phẩm nào sẽ bị dọn sau 24 giờ, ở lần upload kế tiếp.
- Server từ chối xóa ảnh còn được sản phẩm tham chiếu.
- Ảnh chiếm dung lượng database. Neon Free có giới hạn lưu trữ theo project (xem
  https://neon.com/pricing); kiểm tra số dòng `productImages` bằng `npm run db:status` hoặc
  `npm run db:inspect` trước khi tải nhiều ảnh.

## Tài khoản khách, lịch sử đăng nhập và chat

Từ giai đoạn 1, tài khoản khách, phiên đăng nhập, lịch sử đăng nhập, chat và nhật ký thao tác
Admin nằm trong PostgreSQL (bảng `Customer`, `CustomerSession`, `LoginEvent`, `ChatMessage`,
`ChatImage`, `AuditLog`). Không có database thì khách không đăng ký/đăng nhập được.

- Mật khẩu chỉ lưu dạng băm scrypt; cookie phiên chỉ lưu dạng SHA-256. Admin không đọc được cả hai.
- Lịch sử đăng nhập và ảnh chat tự xóa sau 90 ngày; phiên hết hạn hoặc bị thu hồi quá 7 ngày cũng bị
  xóa. Việc dọn chạy trong ứng dụng, tối đa 6 giờ một lần, khi có sự kiện đăng nhập.
- Xóa tài khoản trong Admin xóa luôn phiên, chat, ảnh chat và lịch sử đăng nhập của khách đó.
- Thiết kế: `docs/specs/2026-09-29-phase1-accounts-chat-design.md`.

## Đơn hàng, thanh toán và lịch hẹn

Giai đoạn 2–5 thêm `Order`, `OrderItem` (bản chụp giá, tên, thông tin giao), `OrderSlot` (khung giờ khách chọn),
`OrderEvent` (dòng thời gian), `Notification` (Inbox), `BankAccount`, `StoreSetting` (tỷ giá), `EmailLog`,
`MailConnection` (refresh token Gmail mã hóa AES-256-GCM bằng khóa dẫn xuất từ `AUTH_SECRET`; đổi `AUTH_SECRET`
thì phải kết nối Gmail lại). Giá gói nằm ở `Package.priceVnd`/`salePriceVnd`; cột USD cũ giữ lại, không dùng.

- Đặt hàng trừ tồn ngay trong transaction; đơn chưa báo chuyển sau 30 phút tự hết hạn và trả tồn (kiểm tra khi có
  người mở catalog/đơn/Admin, vì Render Free không có tác vụ nền).
- Khách có đơn không bị xóa hẳn: Admin xóa sẽ ẩn danh tài khoản, giữ đơn để đối soát.
- Đây là dữ liệu tài chính: định kỳ tạo bản sao lưu (`scripts/backup-postgres.ps1` hoặc Neon Console) và kiểm tra
  khôi phục được. Bảng staging cũ `PaymentReceiver`/`PaymentOrder`/`PaymentEvent` rỗng và không còn được dùng.

## Database cho E2E

Playwright cần `E2E_DATABASE_URL` trỏ tới database dùng một lần, **không bao giờ** là production.
Global setup từ chối chạy nếu host trùng `DATABASE_URL`, và chỉ chạy `migrate deploy` + seed
demo, không xóa dữ liệu. Test tự tạo khách với email riêng nên dữ liệu các lần chạy trước vô hại.

- CI: service PostgreSQL mới mỗi lần chạy (`.github/workflows/docker.yml`, job `e2e`).
- Máy local: branch Neon `e2e` tạo bằng `--schema-only` từ `main`, nên không có sản phẩm thật.
  Branch schema-only không mang theo lịch sử migration: lần đầu phải đánh dấu các migration đã có
  trong schema là applied bằng `prisma migrate resolve --applied <tên>` (chỉ trên branch e2e).
- Prisma chặn `migrate reset` khi do AI agent chạy; không vượt qua chặn này.

## Demo catalog

Để tạo hoặc cập nhật hai sản phẩm mẫu đã gắn nhãn demo trên database trong `.env`, chạy:

```powershell
npm run db:seed-demo
npm run db:status
```

Seed dùng slug/SKU cố định nên có thể chạy lại mà không tạo bản sao. Nó không xóa hoặc sửa các
sản phẩm khác. Không dùng dữ liệu mẫu này làm nội dung bán hàng thật.
