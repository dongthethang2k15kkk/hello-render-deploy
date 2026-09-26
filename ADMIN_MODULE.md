# Admin Module — Đặc tả UX và nghiệp vụ

> Cập nhật: 2026-09-26  
> Trạng thái: Đã chốt phạm vi UX/định hướng triển khai, chưa triển khai module mới.  
> Project: `D:\H'Nam207`

## 1. Mục tiêu

Admin là khu vực vận hành gian hàng, không phải storefront dành cho khách mua hàng.
Admin không cần giỏ hàng, checkout hoặc luồng mua sản phẩm. Admin chỉ có hai khu vực
cấp cao:

```text
Admin
├── Chat
└── Settings
    ├── Tổng quan gian hàng
    ├── Sản phẩm
    ├── Khuyến mãi
    ├── Giao diện gian hàng
    ├── Cài đặt chat
    ├── Đơn hàng / giao hàng
    ├── Thanh toán staging
    └── Bảo mật
```

## 2. Quyết định đã chốt

- Admin được quản lý **tất cả sản phẩm** trong catalog của gian hàng.
- Phạm vi hiện tại là **một gian hàng**; chưa xây multi-store/marketplace.
- Có thể thêm, sửa, ẩn/hiện và xóa sản phẩm.
- Admin chỉnh được giá, tồn kho, ảnh, nội dung, package/variant và form giao hàng.
- Khuyến mãi giai đoạn này chỉ dùng **sale price**, chưa có coupon/mã giảm giá.
- Admin được chỉnh tồn kho thủ công.
- Thay đổi sản phẩm **áp dụng ngay**, không qua Draft → Preview → Publish.
- Mọi thay đổi quan trọng phải được kiểm tra quyền ở server; UI không được là lớp bảo vệ duy nhất.
- Admin không được thấy cart/checkout controls trong Admin shell.
- Customer vẫn dùng storefront và `/[locale]/workspace` để chat; không truy cập được Admin routes.

## 3. Route và layout

### Admin routes

```text
/vi/admin
/en/admin
/vi/admin/chat
/en/admin/chat
/vi/admin/settings
/en/admin/settings
/vi/admin/settings/products
/en/admin/settings/products
/vi/admin/settings/products/new
/en/admin/settings/products/new
/vi/admin/settings/products/[id]
/en/admin/settings/products/[id]
/vi/admin/settings/promotions
/en/admin/settings/promotions
/vi/admin/settings/storefront
/en/admin/settings/storefront
/vi/admin/settings/chat
/en/admin/settings/chat
/vi/admin/settings/payments
/en/admin/settings/payments
```

### Admin shell

Desktop:

```text
┌────────────────────────────────────────────────────────────┐
│ SHOP / ADMIN       Chat   Settings        Admin   Log out   │
├───────────────┬────────────────────────────────────────────┤
│ Settings nav  │ Nội dung tab hiện tại                      │
│               │                                            │
└───────────────┴────────────────────────────────────────────┘
```

Mobile:

- Header gọn, không có cart.
- Hai tab cấp cao hiển thị rõ: `Chat`, `Settings`.
- Settings menu chuyển thành list/card hoặc select dễ dùng trên màn hình hẹp.
- Form dài chia thành section, không dùng một form ngang bị tràn.

## 4. Phân quyền

### Admin

- Xem và trả lời mọi customer room.
- Xem, thêm, sửa, ẩn/hiện, xóa sản phẩm.
- Sửa giá gốc, sale price, tồn kho và nội dung storefront.
- Sửa hình ảnh sản phẩm.
- Quản lý khuyến mãi dạng sale price.
- Chỉnh cấu hình chat và giao diện gian hàng.
- Xem và xử lý các nghiệp vụ payment/fulfillment theo phạm vi staging.

### Customer/user

- Không truy cập Admin routes.
- Chỉ xem sản phẩm đang active và được phép hiển thị.
- Chỉ dùng chat room của chính mình.
- Không được gọi API Admin bằng cách sửa URL hoặc request client.

### Quy tắc bắt buộc

- Server route phải gọi `getSession()` và kiểm tra `account.role === 'admin'`.
- API mutation phải kiểm tra role lại; không tin role gửi từ client.
- Xóa sản phẩm cần xác nhận ở UI và kiểm tra ràng buộc ở server.
- Không xóa dữ liệu lịch sử đã được snapshot vào order/payment record.
- Tất cả mutation nên ghi audit event tối thiểu: actor, action, entity, entityId, before/after hoặc summary, createdAt.

## 5. Tab Chat

Tab Chat dùng lại nền tảng `ChatPanel` hiện tại nhưng đặt trong Admin shell riêng.

### Desktop UX

- Sidebar conversation.
- Tên customer, avatar/chữ cái đầu.
- Tin nhắn cuối và thời gian.
- Trạng thái room đang chọn.
- Main panel có identity, lịch sử và composer.
- Gửi text và ảnh.
- Loading, empty, error, retry, sending.

### Mobile UX

- Màn hình danh sách conversation.
- Chọn room thì chuyển sang màn hình message.
- Có nút quay lại danh sách.
- Không để sidebar và composer làm tràn viewport.

### Backlog chưa làm

- Unread count chính xác.
- Mark as read.
- Online/offline thật.
- Search conversation.
- Realtime WebSocket/SSE.
- Persistence chat bằng database.

Không hiển thị unread count giả khi chưa có read state server-side.

## 6. Tab Settings — tổng quan

Settings là trung tâm quản trị, không phải một form duy nhất. Sidebar nên có các nhóm:

1. Overview
2. Products
3. Promotions
4. Storefront
5. Chat
6. Orders & fulfillment
7. Payments
8. Security

Mỗi màn hình cần có:

- Heading và mô tả ngắn.
- Trạng thái loading.
- Empty state.
- Error state và retry.
- Success feedback sau khi lưu.
- Validation ở client và server.
- Nút hủy/reset rõ ràng.
- Không báo “đã lưu” nếu request thất bại.

## 7. Settings / Overview

Dashboard hiển thị số liệu vận hành, không phải số liệu giả:

- Tổng sản phẩm active.
- Sản phẩm đang ẩn.
- Sản phẩm sắp hết hàng.
- Sale price đang hoạt động.
- Conversation mới hoặc chưa đọc khi read state đã có.
- Hoạt động Admin gần đây.

Nếu dữ liệu chưa có trong database, hiển thị `Demo / chưa có dữ liệu`, không tự tạo số.

## 8. Settings / Products

### Product list

Cần có:

- Search theo tên, slug, SKU.
- Filter active/inactive.
- Filter category.
- Filter còn hàng/hết hàng.
- Filter đang sale.
- Sort theo updatedAt, tên, giá, tồn kho.
- Bulk action: activate, deactivate, update stock nếu nghiệp vụ được kiểm soát.
- Nút Add product.
- Nút Edit.
- Nút Duplicate.
- Nút Delete với confirm.

### Product form

#### Basic information

- Slug duy nhất.
- Tên VI.
- Tên EN.
- Mô tả VI.
- Mô tả EN.
- Category.
- Active/inactive.
- Thứ tự hiển thị.

#### Pricing

- Giá gốc bằng số nguyên minor unit, không dùng số floating point.
- Sale price tùy chọn.
- Sale price phải nhỏ hơn hoặc bằng giá gốc.
- Nếu bỏ sale price thì trở về giá gốc.
- Hiển thị rõ giá gốc, giá sale và phần trăm giảm.
- Không tự đổi tỷ giá.

#### Stock

- Tồn kho hiện tại.
- Chỉnh tồn kho thủ công.
- Không cho tồn kho âm.
- Có thể bật/tắt “cho phép đặt khi hết hàng” nếu sau này cần.
- Ghi audit khi tồn kho thay đổi.

#### Images

- Ảnh đại diện.
- Gallery.
- Sắp xếp ảnh.
- Chọn ảnh chính.
- Xóa/thay ảnh.
- PNG/JPEG/WebP.
- Kiểm tra MIME và magic bytes ở server.
- Giới hạn kích thước và số ảnh cấu hình ở server.

#### Packages / variants

Mỗi package/variant có thể có:

- SKU duy nhất.
- Tên VI/EN.
- Mô tả VI/EN.
- Giá riêng nếu cần.
- Sale price riêng nếu cần.
- Tồn kho riêng.
- Active/inactive.
- Ảnh riêng tùy chọn.

#### Delivery form

Mỗi package có form giao hàng versioned:

- Key ổn định.
- Label VI/EN.
- Type: text, textarea, select nếu được hỗ trợ.
- Required.
- Max length.
- Options cho select.
- Thứ tự field.
- Preview form phía customer.

### Áp dụng ngay

Sau khi Admin lưu thành công:

- Storefront đọc dữ liệu mới ở request tiếp theo.
- Cache/revalidation phải được xử lý để customer không thấy dữ liệu cũ quá lâu.
- Không cần nút publish.
- UI cần cảnh báo: “Thay đổi sẽ áp dụng ngay cho khách hàng.”

## 9. Settings / Promotions

Giai đoạn này chỉ có sale price, chưa có coupon.

### Promotion model UX

- Chọn product/package.
- Giá gốc.
- Sale price.
- Tỷ lệ giảm tự tính để preview.
- Thời gian bắt đầu.
- Thời gian kết thúc.
- Active/inactive.
- Ghi chú nội bộ.

### Validation

- Sale price không âm.
- Sale price không lớn hơn giá gốc.
- Thời gian kết thúc sau thời gian bắt đầu.
- Không có hai sale price active xung đột trên cùng một target.
- Xóa/tắt sale phải lưu audit.

### Customer display

```text
Giá gốc: $25.00
Giá sale: $20.00
Giảm 20%
```

Không ghi đè giá gốc bằng giá sale, vì cần giữ lịch sử và hiển thị minh bạch.

## 10. Settings / Storefront

Admin có thể chỉnh:

- Tên gian hàng.
- Logo và favicon.
- Màu chính/phụ.
- Hero title VI/EN.
- Hero description VI/EN.
- Hero image/banner.
- CTA label/link.
- Bật/tắt Hero.
- Bật/tắt How it works.
- Bật/tắt FAQ.
- Nội dung footer VI/EN.
- Hiển thị floating chat widget.

Thay đổi áp dụng ngay sau khi lưu. Có preview ở cùng màn hình trước khi bấm lưu là tốt,
nhưng không được coi preview là đã lưu.

## 11. Settings / Chat

- Bật/tắt widget.
- Tên support hiển thị.
- Lời chào VI/EN.
- Guest CTA VI/EN.
- Thời gian phản hồi dự kiến.
- Trạng thái hiển thị: online, away, offline.
- Cho phép gửi ảnh.
- Kích thước ảnh tối đa.
- Giờ hỗ trợ nếu sau này có offline logic.

Không được để Admin controls xuất hiện trong public widget.

## 12. Settings / Orders & fulfillment

Khu vực này dành cho vận hành, không phải checkout của Admin:

- Danh sách order.
- Lọc theo trạng thái.
- Xem snapshot sản phẩm, giá và receiver.
- Ghi nhận thanh toán thủ công.
- Ghi chú fulfillment.
- Xác nhận đã giao.
- Audit log.

Checkout công khai hiện vẫn là demo. Không được biến UI Admin thành cam kết rằng payment
hoặc fulfillment production đã hoạt động.

## 13. Settings / Payments

Giữ payment staging tách biệt và gắn nhãn rõ:

- Receiving accounts.
- Bank/LTC destination.
- QR tĩnh.
- Active/inactive.
- Pending limit.
- Tỷ giá và thời hạn quote.
- Manual reconciliation.

Payment staging hiện dùng cơ chế riêng trong README và `/[locale]/admin/payments`. Khi
đưa vào Admin Settings cần thống nhất lại auth/permission, không để Admin UI mới vô tình
bỏ qua Bearer key hoặc các giới hạn bảo mật staging.

## 14. Database direction

Schema hiện có nền tảng `Product`, `ProductTranslation`, `Package`,
`PackageTranslation`, `DeliveryForm`, nhưng storefront hiện vẫn đọc `src/lib/catalog.ts`.

Các model nên bổ sung:

```text
Store
StoreSetting / StoreSettingsVersion
ProductImage
Category
Promotion
PromotionTarget
AuditLog
```

Các field cần cân nhắc:

- Product: active, sortOrder, categoryId, deletedAt.
- Package: salePrice, stockOnHand, active.
- ProductImage: url, altText, sortOrder, isPrimary.
- Promotion: targetId, salePrice, startsAt, endsAt, active.
- StoreSettings: key, locale, value hoặc JSON đã validate.
- AuditLog: actorId/actorRole, action, entity, entityId, summary, createdAt.

Giá phải lưu bằng integer minor unit. Ảnh không nên lưu data URL trong database khi làm
production; dùng local upload cho demo hoặc object storage/CDN cho production.

## 15. API direction

Mọi endpoint mutation phải có server-side Admin guard.

```text
GET    /api/admin/store
PATCH  /api/admin/store

GET    /api/admin/products
POST   /api/admin/products
GET    /api/admin/products/:id
PATCH  /api/admin/products/:id
DELETE /api/admin/products/:id
POST   /api/admin/products/:id/duplicate

GET    /api/admin/promotions
POST   /api/admin/promotions
PATCH  /api/admin/promotions/:id
DELETE /api/admin/promotions/:id

POST   /api/admin/uploads/product-image

GET    /api/admin/audit
```

API cần validate body bằng schema server-side, giới hạn payload, kiểm tra quyền và trả
error có cấu trúc để UI hiển thị đúng trạng thái.

## 16. Không nằm trong phiên bản đầu

- Multi-store.
- Coupon code.
- Flash sale phức tạp.
- Voucher theo shipping.
- Affiliate.
- Ads/marketing campaign.
- Tự động đồng bộ Shopee.
- Realtime chat.
- 2FA production.
- Payment thật.
- Fulfillment tự động.

## 17. Acceptance checklist

- [ ] Admin vào `/vi/admin` được chuyển tới Admin shell.
- [ ] Customer không truy cập được Admin routes/API.
- [ ] Admin shell chỉ có Chat và Settings.
- [ ] Admin không thấy cart/checkout trong shell.
- [ ] Admin xem và trả lời đúng customer room.
- [ ] Admin tạo được product VI/EN.
- [ ] Admin sửa giá và sale price.
- [ ] Sale price hiển thị đúng cho customer.
- [ ] Admin chỉnh tồn kho và không thể nhập tồn âm.
- [ ] Admin thêm/xóa/sắp xếp ảnh.
- [ ] Admin chỉnh delivery form.
- [ ] Admin ẩn/hiện sản phẩm.
- [ ] Admin xóa sản phẩm có confirm và audit.
- [ ] Mọi thay đổi áp dụng ngay sau khi lưu thành công.
- [ ] Storefront không còn phụ thuộc catalog hard-code sau khi migration hoàn tất.
- [ ] Các lỗi lưu/validation hiển thị rõ, không báo thành công giả.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass.
- [ ] Có E2E cho Admin và Customer role separation.

## 18. Thứ tự triển khai đề xuất

1. Prisma schema + migration cho Store/Product/Image/Promotion/Audit.
2. Seed catalog hiện tại vào database.
3. API Admin guard và CRUD Product.
4. Storefront đọc catalog từ database.
5. Admin shell với Chat/Settings.
6. Product list và product editor.
7. Upload/sort/delete product images.
8. Sale price và stock management.
9. Delivery form editor.
10. Storefront/chat settings.
11. Audit log.
12. E2E, typecheck, test, build và kiểm tra mobile.
