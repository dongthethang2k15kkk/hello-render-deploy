# SHOP / CONCEPT — Tài liệu bàn giao

> Cập nhật: 2026-09-26
> Project: `D:\H'Nam207`
> Đây là storefront/demo UI, chưa phải production commerce.

## Mục tiêu

Storefront demo sản phẩm số song ngữ Việt/Anh, gồm catalog, search/filter/sort, product detail, cart, checkout mô phỏng, login/register, Admin/User roles và chat tư vấn riêng.

Tên SHOP / CONCEPT, màu olive/xanh và hình CSS chỉ là thiết kế thử, chưa phải thương hiệu chính thức.

## Stack và lệnh

- Next.js 15, React 19, TypeScript, next-intl, Zod.
- CSS chính ở `src/app/globals.css`.
- Vitest và Playwright có trong scripts.
- Storefront demo chưa nối database; Prisma/payment staging là phạm vi riêng.

```bat
cd /d "D:\H'Nam207"
npm install
npm run dev
```

Mở `http://localhost:3000/vi` hoặc `/en`.

```bat
npm run typecheck
npm test
npm run build
```

Trước khi bàn giao, typecheck, build và 19 tests đã từng pass; luôn tin kết quả lệnh mới nhất.

## Đã hoàn thành

### Storefront

- Locale `vi`/`en`, header, navigation, language switch, account và cart.
- Catalog demo với search/filter/sort, product detail, cart `localStorage`.
- Checkout mô phỏng: không thanh toán thật, không tạo đơn thật.

### Auth và role

- Login/logout/register/session ở `src/app/api/auth`.
- HMAC session cookie trong `src/lib/demo-auth.ts`.
- Roles `admin` và `user`.
- Workspace protected; guest được chuyển login.
- Checkout giữ `next=checkout`; login mặc định chuyển workspace.
- Account đăng ký mới hash bằng `scrypt`.

### Chat

- API: `src/app/api/chat/route.ts`.
- State: `src/lib/demo-chat.ts`.
- UI: `src/components/chat-panel.tsx`.
- Workspace: `src/app/[locale]/workspace/page.tsx`.
- User có room `user:<accountId>`; Admin chuyển được giữa customer rooms.
- Polling khoảng 5 giây; Enter gửi, Shift+Enter xuống dòng; giới hạn 1–1000 ký tự.

## Giới hạn demo

Demo credentials xem tại `src/lib/demo-credentials.ts`. Có Admin, Customer 1 và Customer 2 để test.

Account đăng ký và chat rooms/messages nằm trong `Map` của process Node. Restart server sẽ mất dữ liệu; nhiều process không chia sẻ state. Không nhập thông tin cá nhân, mật khẩu thật, seed phrase hoặc payment data thật.

README có payment staging nội bộ, nhưng checkout công khai chưa phải payment thật.

## Quyết định UX đã thống nhất

### Floating consultation widget

Hiện chat là link header tới `/vi/workspace` hoặc `/en/workspace`. Cần bổ sung/thay bằng nút kiểu Messenger/Intercom:

- fixed bottom-right, open/close state, unread badge;
- guest thấy lời giải thích và CTA login/register;
- customer đã login mở conversation riêng;
- Admin không thấy Admin controls trong public widget, chỉ link Admin inbox;
- label Việt/Anh;
- mobile gần full-screen;
- vẫn giữ workspace đầy đủ.

### Admin inbox

Không tiếp tục dùng panel user cho Admin. Thiết kế theo Messenger Inbox/Zendesk/WhatsApp Web:

- sidebar conversations;
- customer name, last message, timestamp, unread count, active state;
- main panel có identity và lịch sử chat;
- composer có loading/error;
- empty/loading/offline states;
- mobile chuyển giữa list và message panel;
- reply phải đi đúng room.

### Login/register

Auth card hiện đại với tab/segmented switch, label rõ, validation, show/hide password, focus/keyboard accessibility, loading/error states. Demo accounts là panel/accordion phụ. Giữ `next=checkout` và workspace redirect. Register nên có confirm password client-side và ghi rõ dữ liệu demo tạm thời.

## Backlog ưu tiên

### P0

1. Tạo `src/components/chat-widget.tsx`, mount trong `src/app/[locale]/layout.tsx`.
2. Widget xuất hiện trên public storefront; tránh che login/admin/checkout nếu cần.
3. Tách Admin thành `admin-inbox.tsx`, không dùng layout user.
4. Sửa responsive header theo ảnh bàn giao: viewport hẹp làm `Demo Customer`, `Đăng xuất`, `Giỏ hàng` chật/cắt/tràn. Kiểm tra gap, overflow, font size, mobile collapse.
5. Chạy typecheck, test, build sau mỗi nhóm thay đổi.

### P1 — chat

- Room metadata: last message, time, unread count.
- Mark-as-read, welcome/unread/sending/error states.
- Scroll tới tin mới nhất khi đổi room/gửi.
- Tách message list/composer nếu cần.
- API Admin nên trả metadata và selected room thay vì tất cả messages.

### P1 — auth

- Tách `auth-shell.tsx`, `demo-account-picker.tsx`.
- Show/hide password, confirm password.
- Chuẩn hóa VI/EN vì một số text còn hard-code tiếng Việt.
- Test redirect, session refresh và keyboard accessibility.

### P2 — production

Chuyển account/session/chat sang database; session expiry/rotation/CSRF; rate limit/audit/monitoring; 2FA Admin; realtime; persistence/read receipts; catalog/order/payment/fulfillment thật. Không public payment staging trước security review.

## File cần đọc trước khi sửa

```text
src/app/globals.css
src/app/[locale]/layout.tsx
src/app/[locale]/workspace/page.tsx
src/app/[locale]/login/page.tsx
src/components/store-ui.tsx
src/components/chat-panel.tsx
src/lib/demo-auth.ts
src/lib/demo-accounts.ts
src/lib/demo-chat.ts
src/app/api/auth/*
src/app/api/chat/route.ts
src/app/[locale]/checkout/page.tsx
README.md
```

## Ràng buộc

- User chỉ đọc/gửi room của mình; không phá role separation.
- Không lộ Admin controls trong public widget.
- Không biến checkout demo thành payment thật ngoài phạm vi yêu cầu.
- Giữ `vi` và `en`.
- Nhớ state account/chat mất sau restart.
- Kiểm tra desktop/mobile, đặc biệt header và floating widget.
- Project path Windows: `D:\H'Nam207`.

## Checklist nghiệm thu

- [ ] Guest mở/đóng widget và thấy CTA đúng locale.
- [ ] User gửi đúng room riêng.
- [ ] Hai customer không thấy room của nhau.
- [ ] Admin chuyển room và reply đúng customer.
- [ ] Unread/read state đúng.
- [ ] Widget không che nội dung mobile.
- [ ] Header không còn bị cắt như ảnh bàn giao.
- [ ] Auth có focus, error, password toggle, loading.
- [ ] `next=checkout` hoạt động.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass.
- [ ] E2E riêng cho guest, customer 1, customer 2 và Admin.

## Ghi chú cho người tiếp quản

Đây là điểm dừng giữa bản demo chức năng và đợt redesign UX. Auth, role, room separation và checkout gate đã có. Việc đầu tiên: đọc các file trên, triển khai P0 (floating widget, Admin inbox, responsive header), chạy kiểm tra; chưa cần viết lại backend ngay. Sau khi UX ổn định mới bổ sung persistence, unread/read receipts và realtime.

## Nhật ký quyết định và triển khai — 2026-09-26

Yêu cầu mới của chủ dự án: từ nay các quyết định đã chốt trong hội thoại phải ghi lại trong file doc này. Ghi rõ phần đã làm và chưa làm, không đánh dấu đề xuất thành hoàn thành khi chưa kiểm chứng.

- **Widget:** triển khai nút nổi trên các storefront pages, ẩn ở `/workspace`, `/login`, `/admin`, `/checkout` để tránh trùng giao diện. Guest thấy CTA đăng nhập; user thấy chat riêng; Admin chỉ có link mở workspace. Mobile (<=480px) mở full-screen. File: `src/components/chat-widget.tsx`, mount trong locale layout.
- **Unread badge:** vẫn là backlog. Chưa có read state server-side nên không hiển thị số chưa đọc giả. Muốn triển khai chính xác phải bổ sung last-read/mark-as-read per room và per user, rồi kiểm tra giữa các phiên.
- **Admin inbox:** UI sidebar và message panel nằm trong `src/components/chat-panel.tsx`, dựa vào API hiện tại; không thay đổi quyền API. Có tên, snippet và timestamp tin cuối, loading/empty/error và sending. **Chưa** có unread count và mobile chưa chuyển thành hai màn hình độc lập (hiện list nằm phía trên message panel).
- **Auth:** login/register dùng segmented switch, show/hide password, confirm password client-side, native required/minlength/pattern, demo accounts trong details; giữ redirect checkout/workspace. Error từ API có thể còn tiếng Việt khi locale EN vì server trả chuỗi tiếng Việt.
- **Header:** mobile chuyển header actions sang hàng riêng để tránh account/logout/cart bị cắt. Cần kiểm tra bằng viewport thực tế.
- **Chat gửi tin:** chỉ xóa text sau khi POST thành công; có sending/error/retry; giữ polling 5 giây. Chưa có offline detection riêng hoặc message delivery/read receipts.

### Tiếp tục — 2026-09-26

- **Admin inbox:** GET `/api/chat` của Admin giờ trả metadata tin cuối cho từng room, nhưng chỉ trả lịch sử của room đang chọn (`?room=`). Client polling, retry và gửi tin tiếp tục dùng room đã chọn. Trên màn hình <=480px, sidebar và nội dung chat chuyển thành hai màn hình với nút quay lại danh sách; desktop giữ giao diện hai cột.
- **Chưa làm:** unread/read state, offline detection, persistence và E2E phân quyền vẫn là backlog; không hiển thị số unread giả.
- **Kiểm chứng:** 19 unit tests pass ở lượt chạy đầu; các lượt typecheck/build tiếp theo bị công cụ terminal ngắt hoặc chạy sai do cú pháp `;` trong cmd.exe, chưa coi là đã pass. Cần chạy lại trên terminal ổn định và kiểm tra trực quan mobile.
- **Chat ảnh:** user và Admin có thể chọn/gửi PNG, JPEG hoặc WebP tối đa 1 MB; server kiểm tra MIME và magic bytes, giới hạn 10 ảnh mỗi room demo. Ảnh được lưu dạng data URL trong `Map`, nên mất khi server restart và chưa phù hợp production storage/CDN.
- **Xác minh link:** dev server cổng 3001 báo Ready; `GET http://127.0.0.1:3001/vi/login?next=workspace` trả HTTP 200. 19 unit tests pass; typecheck chưa có kết quả hoàn tất vì công cụ terminal không theo dõi được thời điểm kết thúc. Chưa kiểm thử upload hai chiều end-to-end qua browser.
- **Admin module — quyết định mới:** Admin chỉ có hai khu vực cấp cao là `Chat` và `Settings`; Settings quản lý toàn bộ sản phẩm của một gian hàng. Admin được thêm/sửa/ẩn/hiện/xóa sản phẩm, sửa giá, sale price, tồn kho, ảnh, package/variant và delivery form. Khuyến mãi giai đoạn đầu chỉ là sale price, không có coupon. Thay đổi áp dụng ngay sau khi lưu, không dùng Draft/Preview/Publish. Đặc tả đầy đủ nằm ở `D:\H'Nam207\ADMIN_MODULE.md`; module chưa triển khai.

Khi quyết định thay đổi phạm vi/thiết kế ở các phiên tới: bổ sung ngày, lựa chọn đã chốt, lý do ngắn và trạng thái thực hiện ngay tại đây. Các checklist ở trên là backlog lịch sử, không tự động coi là đã nghiệm thu.