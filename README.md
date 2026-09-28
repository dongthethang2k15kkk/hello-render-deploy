Docker / Render deployment: see [DEPLOYMENT.md](./DEPLOYMENT.md).

# Shop foundation / Nền tảng cửa hàng

## Payment staging (bổ sung)

Trang nội bộ: http://localhost:3001/vi/admin/payments hoặc
http://localhost:3001/en/admin/payments. Checkout công khai vẫn mô phỏng;
**không chuyển tiền thật**. Các ghi chú phạm vi demo bên dưới mô tả storefront,
không bao gồm backend staging mới.

- Prisma đã bổ sung tài khoản nhận, hóa đơn có snapshot bất biến và nhật ký.
- Admin cấu hình nhiều ngân hàng/địa chỉ LTC, bật/tắt và ngưỡng đơn chờ.
- Phân bổ luân phiên bằng thời điểm lần cấp gần nhất, có PostgreSQL advisory
  transaction lock để tuần tự hóa thao tác đồng thời. Hết tài khoản thì từ chối.
- Idempotency key chống tạo trùng hóa đơn khi thử lại; đổi payload phải đổi key.
- Đơn hết báo giá vẫn chiếm ngưỡng chờ để không bỏ sót tiền chuyển muộn.
  Chưa có luồng hủy/giải phóng ngưỡng: đây là giới hạn staging cần hoàn thiện.
- Admin là CSKH: xem đơn, báo chuyển, xác nhận và ghi nhận giao hàng; không được sửa
  tài khoản nhận hoặc tải QR. Operator có toàn quyền vận hành, bao gồm các quyền này.
  Báo chuyển chỉ sang REVIEW, không tự thành PAID. TXID LTC duy nhất toàn hệ thống;
  mã giao dịch ngân hàng duy nhất theo ngân hàng/tài khoản nhận.
- Xác nhận là thủ công: không có node/block explorer kiểm tra tự động.
  Operator chịu trách nhiệm kiểm tra địa chỉ, tiền thực nhận và confirmations.
- Khóa admin/operator riêng trong `.env`, tối thiểu 32 ký tự ngẫu nhiên;
  gửi Bearer token, chỉ giữ trong bộ nhớ trang, không lưu localStorage.
  Đây chưa phải đăng nhập cá nhân/2FA: audit chỉ nhận diện vai trò, chưa nhận diện
  từng nhân viên. Chỉ dùng localhost hoặc mạng nội bộ HTTPS, không public endpoint
  trước khi bổ sung đăng nhập, rate limiting, giới hạn body ở proxy và giám sát.
- Cấu hình tỷ giá thủ công: PAYMENT_VND_PER_USD là VND/USD;
  PAYMENT_LITOSHI_PER_USD là số đơn vị 1e-8 LTC/USD. Không điền tỷ giá phỏng đoán.
  PAYMENT_RATE_VALID_UNTIL là ISO timestamp có timezone. Hóa đơn hết hạn sau tối đa
  15 phút hoặc khi tỷ giá hết hạn. Tính số nguyên và làm tròn lên đơn vị nhỏ nhất.
- QR hiện là **ảnh tĩnh operator tải trực tiếp trong trang quản trị**,
  tùy chọn, được lưu dưới thư mục `D:\H'Nam207\public\payment-qr` khi chạy local.
  API giới hạn 5 MB, chỉ nhận PNG/JPEG/WebP và kiểm tra magic bytes; tên file
  được sinh ngẫu nhiên. Ảnh không tự chứa giá hoặc mã đơn.
  Chưa có QR động theo số tiền/mã đơn, chưa có ví sinh địa chỉ LTC riêng từng đơn.
  Địa chỉ LTC chỉ kiểm tra hình thức, chưa xác minh checksum/quyền sở hữu.
- Giao hàng chỉ lưu ghi chú và trạng thái, chưa gửi email hay sản phẩm tự động.

### Khởi tạo database staging

Sao chép `.env.example` thành `.env`, cấu hình PostgreSQL staging riêng và khóa
truy cập; không dùng dữ liệu hoặc seed phrase ví thật. Sau khi xác minh DB đích:

```bat
cd /d "D:\H'Nam207"
npm run db:generate
npm run db:migrate -- --name payment_staging
npm run typecheck
npm test
```

Migration chưa được tạo/chạy trong phiên triển khai này. Công cụ terminal không
trả kết quả xác minh nên chưa xác nhận client generate/typecheck/test/build.
Sau khi DB hoạt động, thử: hai tài khoản ngưỡng 1 → hai đơn vào hai tài khoản;
đơn thứ ba bị từ chối; retry cùng key không tạo thêm đơn; sửa tài khoản không đổi
  snapshot cũ; admin sửa/tải tài khoản bị 403; operator sửa được; một TXID không xác nhận hai đơn;
REVIEW không được giao hàng trước PAID. Chưa có kiểm thử tích hợp database tự động.

Trước khi mở bán còn cần: catalog thật và tồn kho giao dịch, phiên đăng nhập
cá nhân/2FA, đơn khách có quyền truy cập an toàn, QR động được kiểm chứng,
nguồn tỷ giá/chính sách quote, hủy/hoàn và thanh toán thiếu/thừa, fulfillment,
kiểm thử đồng thời với PostgreSQL, kiểm tra pháp lý và nghiệm thu end-to-end.

Đợt 1: Next.js + TypeScript, next-intl, Tailwind CSS, Zod, Prisma/PostgreSQL,
Vitest và Playwright. Giao diện Việt/Anh, danh mục mẫu, chi tiết gói, giỏ hàng
nhiều mục và trường giao hàng riêng từng gói.

## Phạm vi thực tế

- UI concept mới: hero, hình minh họa CSS, tìm kiếm/lọc/sắp xếp, hướng dẫn,
  FAQ, trang chi tiết, điều chỉnh số lượng giỏ và checkout mô phỏng.
- Checkout không gửi email, không tạo đơn và không kết nối thanh toán.
- Màu xanh olive và hình khối là phương án thiết kế thử để duyệt, không phải
  bộ nhận diện thương hiệu chính thức hoặc hình ảnh sản phẩm thật.
- Server preview phiên làm việc dùng http://127.0.0.1:3001/vi và /en.
  Playwright dùng cổng 3001; local có thể dùng lại server đang chạy.

- Đây là bản demo, không phải cửa hàng sẵn sàng production.
- Sản phẩm minh họa không đại diện cho danh mục kinh doanh đã được duyệt.
- Giỏ lưu localStorage; không nhập dữ liệu cá nhân thật hoặc bí mật.
- Giá demo chỉ dùng USD. Chưa có nguồn tỷ giá VND/EUR, không tự tạo tỷ giá.
- API `POST /api/demo/quote` nhận mảng dòng giỏ, kiểm tra dữ liệu bằng Zod,
  tính giá từ catalog phía server, không tạo đơn hoặc giữ tồn thực tế.
- Prisma mới định nghĩa catalog, gói, bản dịch và phiên bản biểu mẫu.
  UI/API demo chưa kết nối database; chưa có migration được chạy.
- Chưa có đăng nhập, 2FA, quản trị, thanh toán, email, hoàn tiền hoặc tác vụ nền.
- Tồn demo chỉ được kiểm tra trong một giỏ, không phải tồn dùng chung giữa khách.
- Không kích hoạt Hypixel SkyBlock Coins; cần xác minh quy định nhà phát hành
  và điều kiện nhà cung cấp thanh toán trước khi xem xét mở bán.
- Thị trường mục tiêu: Việt Nam, Mỹ, châu Âu và Úc; không đồng nghĩa mọi
  quốc gia đã được xác minh đủ điều kiện thanh toán.

## Chạy local (Windows)

Yêu cầu Node.js LTS tương thích (khuyến nghị Node 22), npm.

```bat
cd /d "D:\H'Nam207"
npm install
npm run dev
```

Truy cập http://localhost:3000/vi hoặc http://localhost:3000/en.
Không cần PostgreSQL để xem demo.

## Kiểm tra

```bat
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Chưa được coi là kiểm tra thành công nếu lệnh không có kết quả xác nhận.
Nếu Chromium chưa tải xong nhưng Microsoft Edge đã có trên máy, có thể đặt
`PLAYWRIGHT_CHANNEL=msedge` trước khi chạy E2E. Để build không ghi đè output
của preview đang chạy, đặt `NEXT_BUILD_DIR=.next-verify` trước `npm run build`.
Sau khi cài thành công, giữ package-lock.json trong quản lý phiên bản để cố
định dependency. Kiểm tra cảnh báo bảo mật trước mọi lần triển khai công khai.

## Database (bước triển khai tiếp theo)

Sao chép `.env.example` thành `.env`, dùng tài khoản PostgreSQL local riêng.
Thông tin trong file mẫu chỉ dành cho local, không dùng cho production.

```bat
npm run db:generate
npm run db:migrate -- --name initial_catalog
```

Chỉ chạy migration sau khi đã kiểm tra đúng database đích. Schema còn cần bổ
sung ràng buộc nghiệp vụ, đơn hàng, transaction giữ tồn, thanh toán và audit
trước khi kết nối luồng mua thật.

## Các bước tiếp theo cần nghiệm thu

1. Duyệt giao diện, thương hiệu và bộ trường giao hàng.
2. Chọn thư viện xác thực; xây email/mật khẩu và 2FA TOTP cho nội bộ.
3. Xây quản trị, catalog database và kiểm tra quyền ở backend.
4. Xây đơn, giữ tồn 30 phút, giá/tỷ giá snapshot và xử lý đồng thời.
5. Xác minh nhà cung cấp ngân hàng/QR, thẻ, PayPal và quốc gia được hỗ trợ.
6. Tích hợp sandbox, đối soát và ngoại lệ; không dựa vào redirect trình duyệt.
7. Giao từng mục, yêu cầu hủy/hoàn, email, nhật ký và kiểm thử bảo mật.
8. Staging, sao lưu/khôi phục, giám sát và duyệt điều kiện mở bán.

Tên SHOP / DEMO và màu giao diện chỉ nhận diện bản thử, không phải thương hiệu
đã chốt. Hosting, nhà cung cấp email, nguồn tỷ giá và phí vận hành chưa chọn.