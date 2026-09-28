# Triển khai bằng Docker

## Phạm vi hiện tại

Bản deploy này là **demo công khai**. Login có tài khoản mẫu, chat và tài khoản
đăng ký nằm trong bộ nhớ, mất sau restart/sleep/redeploy. Chỉ chạy một instance.
Checkout là mô phỏng. Catalog storefront vẫn đọc dữ liệu mẫu; CRUD Admin dùng
PostgreSQL riêng và chưa làm thay đổi catalog storefront. Không nhập dữ liệu thật.

Render Blueprint không cấu hình database hoặc khóa payment. Không đưa database
thật vào bản demo có mật khẩu Admin công khai. Payment staging cần triển khai
nội bộ và đánh giá riêng trước khi mở ra Internet.

## Đề xuất: Render Free (Docker)

Render hỗ trợ Docker và cấp URL HTTPS dạng `https://<ten-service>.onrender.com`.
Gói Free ngủ sau 15 phút không có truy cập; lần mở lại có thể mất khoảng một phút.
Có 750 giờ chạy miễn phí/workspace/tháng, giới hạn build và bandwidth.
Filesystem không bền vững. PostgreSQL miễn phí của Render hết hạn sau 30 ngày,
vì vậy Blueprint này không tạo database.

1. Đưa các thay đổi đã kiểm tra trong thư mục này lên GitHub
   `https://github.com/elliotthewizerd/hello` (repo cần chứa Dockerfile và render.yaml).
2. Đăng nhập https://dashboard.render.com bằng GitHub và cấp quyền đọc repo.
3. Chọn **New → Blueprint**, kết nối repo, chọn branch có cấu hình triển khai.
4. Kiểm tra service dùng **Docker**, plan **Free**, region **Singapore**.
   Blueprint tự sinh `AUTH_SECRET`; `PAYMENT_ADMIN_KEY` để trống.
5. Deploy; đợi build và health check thành công. Mở URL Render cấp, thêm `/vi`
   hoặc `/en`. URL chỉ tồn tại sau khi Render tạo service.
6. Kiểm tra `/api/health` trả `{"status":"ok"}`, mở trang sản phẩm, đăng nhập,
   thử chat bằng hai phiên trình duyệt, kiểm tra Admin → Chat/Settings.
   CRUD sản phẩm sẽ báo chưa cấu hình database trên bản demo này.

Có thể dùng **New → Web Service** nếu không dùng Blueprint: chọn Docker,
Free, Dockerfile `./Dockerfile`, health check `/api/health`; tự tạo AUTH_SECRET.
Không đặt Build Command/Start Command thay thế: dùng lệnh từ Dockerfile.
Không nhập secret vào Dockerfile, GitHub hoặc build arguments.

## Chạy Docker trên máy

Cài Docker Desktop tương thích kiến trúc máy và bật Linux containers. Máy đã
kiểm tra ở phiên này dùng Windows ARM64; image không khóa kiến trúc và Prisma
được generate trong Linux lúc build.

Tạo `.env` từ `.env.example`; điền AUTH_SECRET ngẫu nhiên tối thiểu 32 ký tự.
Có thể sinh chuỗi mới bằng lệnh sau (chỉ lưu kết quả vào .env):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 app
```

Mở http://localhost:3000/vi; kiểm tra http://localhost:3000/api/health.
Dùng `localhost` để trình duyệt hỗ trợ secure cookie trên máy local.
Để đổi cổng host, đặt APP_PORT trong .env. Compose chỉ bind loopback;
trên VPS cần reverse proxy HTTPS và cấu hình mạng riêng trước khi public.

`docker compose down` dừng demo. Không dùng `down -v` nếu muốn giữ database.

## PostgreSQL staging tùy chọn

Dùng database **mới, trống**. Migration đầu tiên được sinh từ schema hiện tại.
Nếu DB đã có bảng, cần baseline theo Prisma; không chạy reset hoặc db push
để xử lý lỗi migration. Chưa chuyển auth/chat sang PostgreSQL.

Điền POSTGRES_PASSWORD bằng chuỗi hex ngẫu nhiên (tránh ký tự đặc biệt trong URL).
Lệnh này tạo PostgreSQL private với named volume, chạy migrate deploy một lần,
rồi khởi động app; không public cổng database:

```powershell
docker compose -f compose.yaml -f compose.db.yaml up --build -d
docker compose -f compose.yaml -f compose.db.yaml logs migrate
```

Khóa payment vẫn để trống. Phần CRUD Admin dùng DB này để thử dữ liệu mẫu.
Named volume giữ dữ liệu qua restart, không thay thế backup. Docker Desktop
lưu volume theo vị trí disk image của Docker; nếu muốn toàn bộ nằm ở ổ E,
đổi vị trí disk image trong Docker Desktop trước khi tạo database.

Với PostgreSQL bên ngoài, có thể xem **Neon Free** (có hạn mức lưu trữ/compute).
Chỉ kết nối sau khi có auth Admin phù hợp nếu dịch vụ công khai. Migration
chạy riêng từ image target `migration`, không chạy trong mỗi lần app start:

```powershell
docker build --target migration -t shop-migrate .
docker run --rm --env-file .env shop-migrate
```

Lệnh này dùng DATABASE_URL trong .env; kiểm tra đúng DB đích trước khi chạy.
Với Neon, dùng URL direct có TLS cho migration. Chưa có migration trên DB thật
trong phiên chuẩn bị cấu hình này.

## Máy chủ thay thế

**Oracle Cloud Always Free** phù hợp nếu cần VPS để tự chạy Docker Compose và
PostgreSQL, nhưng phụ thuộc capacity khu vực, xác minh tài khoản và hạn mức
tài nguyên hiện hành. Phải tự cấu hình HTTPS, firewall, backup và cập nhật máy.
Kiểm tra nhãn Always Free và giá trên màn hình tạo máy; không coi trial credit
là máy chủ miễn phí lâu dài. Hướng Render ở trên đơn giản hơn cho demo hiện tại.

## Kiểm chứng

Workflow `.github/workflows/docker.yml` kiểm tra unit tests, build Docker,
migration PostgreSQL trên Linux và smoke test container. Workflow chỉ chạy khi
được push lên GitHub; file workflow tồn tại không có nghĩa các check đã pass.
Docker build cũng chạy Prisma generate và Next.js production build.

Tình trạng chạy thực tế mới nhất được ghi trong HANDOFF.md. Chưa có URL public
hoặc Docker build thành công nếu chưa có kết quả kiểm chứng từ máy có Docker.

## Tài liệu chính thức

- Render Free: https://render.com/docs/free
- Docker trên Render: https://render.com/docs/docker
- Render Blueprint: https://render.com/docs/blueprint-spec
- Next.js standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Neon: https://neon.com/pricing
- Oracle: https://www.oracle.com/cloud/free/