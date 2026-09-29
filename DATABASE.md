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
