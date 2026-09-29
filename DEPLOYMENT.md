# Triển khai bằng Docker

> Chiến lược database miễn phí, Neon và Docker tự host được tách rõ trong
> [DATABASE.md](./DATABASE.md). Render Free chỉ chạy app container; PostgreSQL phải nằm
> ở dịch vụ ngoài hoặc trên một VPS/máy riêng có volume bền vững.

## Phạm vi hiện tại

Bản deploy này là **demo công khai**. Khách hàng có tài khoản mẫu; Admin chỉ đăng
nhập bằng Google theo allowlist. Chat và tài khoản khách đăng ký nằm trong bộ nhớ,
mất sau restart/sleep/redeploy. Chỉ chạy một instance. Checkout là mô phỏng.
Khi có `DATABASE_URL`, catalog storefront đọc sản phẩm do Admin tạo trong PostgreSQL.

Render Blueprint không cấu hình khóa payment. `DATABASE_URL` và các biến Google
nhập trong dashboard. Payment staging cần triển khai nội bộ và đánh giá riêng
trước khi mở ra Internet.

## Đề xuất: Render Free (Docker)

Render hỗ trợ Docker và cấp URL HTTPS dạng `https://<ten-service>.onrender.com`.
Gói Free ngủ sau 15 phút không có truy cập; lần mở lại có thể mất khoảng một phút.
Có 750 giờ chạy miễn phí/workspace/tháng, giới hạn build và bandwidth.
Filesystem không bền vững. PostgreSQL miễn phí của Render hết hạn sau 30 ngày,
vì vậy Blueprint này không tạo database và `DATABASE_URL` phải trỏ tới PostgreSQL
bền vững bên ngoài. Xem quy trình Neon trong `DATABASE.md`.

1. Đưa các thay đổi đã kiểm tra trong thư mục này lên GitHub
   `https://github.com/dongthethang2k15kkk/hello-render-deploy` (repo cần chứa Dockerfile và render.yaml).
2. Đăng nhập https://dashboard.render.com bằng GitHub và cấp quyền đọc repo.
3. Chọn **New → Blueprint**, kết nối repo, chọn branch có cấu hình triển khai.
4. Kiểm tra service dùng **Docker**, plan **Free**, region **Singapore**.
   Blueprint tự sinh `AUTH_SECRET`; `PAYMENT_ADMIN_KEY` để trống. Điền `DATABASE_URL`
   từ Neon cùng các biến Google OAuth trong Render Environment.
5. Deploy; đợi build và health check thành công. Mở URL Render cấp, thêm `/vi`
   hoặc `/en`. URL chỉ tồn tại sau khi Render tạo service.
6. Kiểm tra `/api/health` trả `{"status":"ok"}`, mở trang sản phẩm, đăng nhập,
   thử chat bằng hai phiên trình duyệt, kiểm tra Admin → Chat/Settings.
   Tạo một sản phẩm trong Admin, bật product/package, rồi reload storefront để xác nhận
   catalog đang dùng database ngoài.

Có thể dùng **New → Web Service** nếu không dùng Blueprint: chọn Docker,
Free, Dockerfile `./Dockerfile`, health check `/api/health`; tự tạo AUTH_SECRET.
Không đặt Build Command/Start Command thay thế: dùng lệnh từ Dockerfile.
Không nhập secret vào Dockerfile, GitHub hoặc build arguments.

Repo triển khai riêng tư thuộc tài khoản dongthethang2k15kkk; remote Git là `render`.
Repo nguồn elliotthewizerd/hello vẫn giữ ở remote `origin`. Sau khi commit thay đổi,
dùng `git push render main` để cập nhật bản triển khai.

## Đăng nhập Admin bằng Google (miễn phí)

Admin chỉ đăng nhập bằng Google; mật khẩu chỉ dùng cho khách hàng. Tạo OAuth client
không cần bật billing/thẻ:

1. https://console.cloud.google.com → tạo project → **APIs & Services → OAuth consent screen**:
   User type **External**, điền tên app + email; ở **Test users** thêm 3 Gmail admin
   (chế độ Testing đủ dùng, không cần xác minh app với scope `openid email`).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://<ten-service>.onrender.com/api/auth/google/callback`
3. Điền vào `.env` (local) và Render → Environment: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `ADMIN_GOOGLE_EMAILS=a@gmail.com,b@gmail.com,c@gmail.com`,
   `APP_URL=https://<ten-service>.onrender.com` (chỉ cần trên Render).

Allowlist được kiểm tra mỗi request: xóa email khỏi `ADMIN_GOOGLE_EMAILS` rồi
redeploy là thu hồi quyền. Đổi `AUTH_SECRET` sẽ đăng xuất mọi phiên.
`ALLOW_DEV_ADMIN_LOGIN=1` bật nút "Dev admin" chỉ khi không phải production (dùng cho E2E/local).

Trạng thái production ngày 2026-09-29: bốn biến OAuth đã được cấu hình trên Render và
`/api/auth/providers` trả `google: true`, `devAdmin: false`. Callback production là
`https://jewish-horse.onrender.com/api/auth/google/callback`. Không ghi Client ID/secret vào
tài liệu, Git hoặc `.env` local. Còn cần đăng nhập thủ công bằng tài khoản trong allowlist để
nghiệm thu; sau đó rotate secret đầu tiên đã từng được truyền qua chat và nhập secret thay thế
trực tiếp trong Render.

Trạng thái "ai đang xem chat/settings nào" lưu trong bộ nhớ, poll 3 giây, hết hạn
sau 20 giây; chỉ đúng khi chạy **một instance** (đúng với Render Free).

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
