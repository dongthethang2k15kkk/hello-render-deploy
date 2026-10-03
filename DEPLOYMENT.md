# Triển khai bằng Docker

> Chiến lược database miễn phí, Neon và Docker tự host được tách rõ trong
> [DATABASE.md](./DATABASE.md). Render Free chỉ chạy app container; PostgreSQL phải nằm
> ở dịch vụ ngoài hoặc trên một VPS/máy riêng có volume bền vững.

## Phạm vi hiện tại

Website hiện chạy tại https://jewish-horse.onrender.com/en. Tài khoản, chat,
catalog, đơn hàng và cấu hình thanh toán được lưu trong PostgreSQL/Neon, tồn tại
qua restart/sleep/redeploy. Admin đăng nhập bằng Google theo danh sách được cấp quyền.
Chỉ chạy một instance; presence và bus sự kiện chat realtime dùng bộ nhớ của process.
`DATABASE_URL`, `AUTH_SECRET` và các biến Google được quản lý trong Render Environment.
Chi tiết bản cải tiến chat/giao diện: [PRODUCT-POLISH.md](docs/PRODUCT-POLISH.md).

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

Trong checkout hiện tại, remote `origin` trỏ tới repo triển khai riêng tư
`dongthethang2k15kkk/hello-render-deploy`. Commit rồi `git push origin main` để
Render tự build/deploy. Xác nhận `git remote -v` trước khi push từ checkout khác.
Service đang chạy tại **Oregon**, Docker, Free, một instance; `Singapore` ở trên
là cấu hình blueprint cho service mới. Không tạo lại service hoặc đổi region khi cập nhật.

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

**Khách hàng đăng nhập bằng Google (giai đoạn 1):** cùng OAuth client, cùng callback. Email
trong `ADMIN_GOOGLE_EMAILS` vào Admin; mọi email Google khác trở thành tài khoản khách. Khi mở bán,
trong Google Auth Platform chuyển app từ **Testing** sang **In production** (Audience → Publish app)
và điền trang chủ `https://jewish-horse.onrender.com/en` cùng Privacy Policy
`https://jewish-horse.onrender.com/en/privacy`. Khi còn ở Testing, chỉ Test users đăng nhập được.
Scope dùng là `openid email profile` (không nhạy cảm). Cookie Admin đổi tên thành
`shop_admin_session` trong bản này, nên Admin phải đăng nhập lại một lần sau khi deploy.

Trạng thái "ai đang xem chat/settings nào" lưu trong bộ nhớ, poll 3 giây, hết hạn
sau 20 giây; chỉ đúng khi chạy **một instance** (đúng với Render Free).

## Checklist mở bán (giai đoạn 2–5)

1. **Admin**: `ADMIN_GOOGLE_EMAILS` trên Render liệt kê cả 3 Gmail admin (phân cách bằng dấu phẩy). Mọi email trong
   danh sách nhận thư báo đơn mới. Nếu OAuth app còn ở Testing, thêm cả 3 vào Test users.
2. **Tài khoản ngân hàng**: Admin → Settings → Payments → Add an account. Bấm **Test QR**, quét bằng app ngân hàng:
   phải thấy đúng ngân hàng, chủ tài khoản, 10.000 ₫ và nội dung "JH TEST". Không có tài khoản active thì khách không đặt được.
3. **Tỷ giá**: Settings → Payments → *USD rate* và *Litecoin price*. Mặc định **Automatic**: USD/VND lấy từ currency-api
   (cập nhật hằng ngày), giá LTC từ Coinbase (dự phòng CoinGecko, Kraken, Binance), làm mới mỗi phút. Chọn **Fixed** để ép theo số nhập tay; ở chế
   độ Automatic số nhập tay chỉ dùng khi không lấy được giá thị trường. Giá gốc vẫn là VND do Admin nhập; khách chuyển khoản
   đúng số VND, còn USD và LTC là quy đổi (đơn LTC chốt giá lúc đặt).
4. **Giá thật**: Settings → Products, nhập giá VND. Giá cũ đã được quy đổi tạm 26.000 ₫/USD.
5. **Gmail**: Google Cloud Console → APIs & Services → Library → bật **Gmail API** trong project đang dùng cho đăng nhập.
   Sau đó Admin → Settings → Email → **Connect Gmail** bằng Gmail gửi thư của shop, cho phép "Send email on your behalf",
   rồi **Send test email**. Không cần thêm Redirect URI (dùng lại callback đăng nhập). Google sẽ báo app chưa xác minh với
   tài khoản này; chọn Advanced → tiếp tục. Khi OAuth app còn ở Testing, quyền gửi mail hết hạn sau 7 ngày; publish app
   để kết nối bền.
6. **Publish OAuth app** (Testing → In production) với homepage và privacy URL ở trên để mọi khách dùng được Google.
7. Thử một đơn thật số tiền nhỏ từ đầu đến cuối trước khi quảng bá.

## Admin, thông báo và Litecoin (2026-09-30)

- **Thêm Admin**: Admin → Settings → Admins. Email trong `ADMIN_GOOGLE_EMAILS` là chủ (không xóa được từ web);
  email thêm trong web được lưu trong database và có hiệu lực trong khoảng 30 giây. Khi OAuth app còn Testing, thêm họ
  vào Test users trong Google Cloud.
- **Thông báo trang chủ**: Settings → Announcements, tải 1–10 ảnh (nên 4:3), chú thích/link tùy chọn, chọn số giây tự
  chuyển, bấm Save. Không có ảnh thì trang chủ hiện hình minh họa mặc định.
- **Litecoin**: Settings → Payments → Litecoin wallets → Add wallet (địa chỉ nhận LTC từ ví, web kiểm tra checksum) →
  **Test QR** bằng app ví. Khi có ví đang bật, cửa hàng hiện thêm giá ước tính bằng LTC cạnh USD và VND. Mỗi đơn LTC có
  số lẻ riêng để nhận ra đơn nào đã trả; khách có thể dán TXID. Kiểm tra tiền về trên litecoinspace.org.
- **Workspace (cách làm việc hằng ngày)**: Admin → **Workspace**. Khi có email "đã báo chuyển khoản", bấm link trong email
  hoặc mở Workspace → **Take this customer**. Màn hình chia đôi: đơn bên trái, chat với khách bên phải. Đối chiếu tiền →
  **Confirm payment** (kèm chốt giờ) → giao hàng trong chat → **Complete transaction** (chỉ lúc này mới tính vào doanh thu).
  Bận thì **Release** để Admin khác nhận; Admin khác vắng thì **Take over**.
- **Ảnh nền**: Settings → Background → kéo thả ảnh vào khung xem trước, kéo ảnh tới vị trí muốn đặt, chỉnh kích thước/độ mờ/xoay/blur
  → **Save background**. *Reset to default* về lại nền ban đầu. Cửa hàng cập nhật trong khoảng 30 giây.
- **Liên hệ**: Discord `https://discord.gg/pD4MdsJB` (`src/lib/contact.ts`, ảnh `public/contact/discord-qr.png`).

## Thanh toán, "rảnh ngay" và nhắc hẹn (2026-09-30)

- **Chuyển khoản ngân hàng**: Admin tự kiểm tra sao kê rồi bấm xác nhận trong trang đơn (tự nhận diện qua SePay đã được
  bỏ theo yêu cầu chủ shop). Nút *I’ve transferred* chỉ bấm được sau khi đặt đơn 1 phút, để khách chuyển tiền trước
  rồi mới báo; server cũng từ chối báo sớm.
- **Litecoin**: không cần cài gì; web tự đọc blockchain qua litecoinspace.org khi khách/Admin mở trang đơn và mỗi lần
  lịch định kỳ chạy, tự xác nhận khi giao dịch đủ 2 confirmations. Admin có nút *Check payment now*.
- **Lịch định kỳ**: Render Free không có cron, nên `.github/workflows/tick.yml` gọi `GET /api/cron/tick` mỗi 15 phút từ
  08:00 đến 23:59 giờ Việt Nam (GitHub có thể chạy trễ vài phút). Tick: hết hạn đơn chưa trả, kiểm tra LTC, gửi nhắc hẹn
  (Chat + Inbox + email ~10–20 phút trước giờ hẹn, mỗi lịch một lần). Khi có Admin đang mở trang Admin, việc này cũng
  chạy mỗi 3 phút kể cả ban đêm. Chạy tay: GitHub → Actions → *Shop housekeeping* → *Run workflow*. GitHub tự tắt lịch
  của repo public sau 60 ngày không có commit; khi đó bấm *Enable workflow*.
- **Rảnh ngay**: khách tích *I'm free right now* khi báo đã chuyển khoản hoặc khi chọn giờ sau khi đã thanh toán. Admin thấy
  nhãn *Free now*, bấm **Start now** (30 phút–2 giờ) → khách nhận ngay tin trong Chat, Inbox và email.

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

Tình trạng chạy thực tế, commit và deploy ID được ghi trong [HANDOFF.md](HANDOFF.md).
Sau deploy, kiểm tra Render báo `live`, migration hoàn thành và website trả lời đúng.

## Tài liệu chính thức

- Render Free: https://render.com/docs/free
- Docker trên Render: https://render.com/docs/docker
- Render Blueprint: https://render.com/docs/blueprint-spec
- Next.js standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Neon: https://neon.com/pricing
- Oracle: https://www.oracle.com/cloud/free/
