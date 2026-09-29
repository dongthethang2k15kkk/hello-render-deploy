# Jewish Horse — Project Handoff

> Updated: 2026-09-28
> Path: `E:\Tai_lieu_E\DONGTHETHANG\04_Cá_nhân\hello`
> This is a demo storefront UI, not a production commerce system.

## Overview

English-only digital package shop demo with catalog, product detail, cart, simulated checkout, login/register, admin/user roles, and private customer support chat.

Brand "Jewish Horse" and the dark green/lime palette are placeholder designs for demo purposes.

## Stack & Commands

- Next.js 15, React 19, TypeScript, next-intl, Zod.
- Main CSS: `src/app/globals.css`.
- Vitest (unit) and Playwright (E2E) in scripts.
- Demo storefront with no real database; Prisma/payment staging are separate scope.

```powershell
cd "E:\Tai_lieu_E\DONGTHETHANG\04_Cá_nhân\hello"
npm install
npm run dev
```

Open `http://localhost:3000/en` (default locale).

```powershell
npm run typecheck
npm test              # Vitest unit tests
npm run build
```

As of 2026-09-28: typecheck passes, 24 unit tests pass, 8 E2E tests pass (Edge, 1 worker).

## Completed Features

### Storefront

- English-only locale (`en`), header, navigation, account and cart.
- Demo catalog with two sample packages, product detail, cart persisted in `localStorage`.
- Simulated checkout: no real payment, no real order creation.
- Legacy `/vi/*` URLs redirect to `/en/*`.

### Auth & Roles

- Login/logout/register/session in `src/app/api/auth`.
- HMAC session cookie in `src/lib/demo-auth.ts`.
- Roles: `admin` and `user`.
- Workspace is protected; guests are redirected to login.
- Checkout preserves `next=checkout`; default login redirects to workspace.
- New accounts hash passwords with `scrypt`.

### Chat

- API: `src/app/api/chat/route.ts`.
- State: `src/lib/demo-chat.ts`.
- UI: `src/components/chat-panel.tsx`.
- Workspace: `src/app/[locale]/workspace/page.tsx`.
- Each user has room `user:<accountId>`; admin can switch between customer rooms.
- Polling ~5 seconds; Enter to send, Shift+Enter for newline; 1–1000 chars.

## Demo Scope & Limitations

Demo credentials are in `src/lib/demo-credentials.ts`. There are Admin, Customer 1, and Customer 2 accounts for testing.

Registered accounts, chat rooms, and messages are stored in Node process `Map`s. Restarting the server clears all data; multiple processes do not share state. Do not enter real personal information, real passwords, seed phrases, or real payment data.

README describes an internal payment staging system, but the public checkout is still simulated and **does not process real payments**.

## Agreed UX Decisions

### Floating consultation widget

Currently chat is a header link to `/en/workspace`. Should be supplemented or replaced by a Messenger/Intercom-style button:

- Fixed bottom-right, open/close state, unread badge.
- Guest sees an explanation and CTA to login/register.
- Logged-in customer opens their private conversation.
- Admin does not see Admin controls in the public widget, only a link to the Admin inbox.
- English labels.
- Mobile near full-screen.
- Keep the full workspace page.

### Admin inbox

Stop reusing the user panel for Admin. Design like Messenger Inbox/Zendesk/WhatsApp Web:

- Sidebar conversations list.
- Customer name, last message, timestamp, unread count, active state.
- Main panel with identity and chat history.
- Composer with loading/error states.
- Empty/loading/offline states.
- Mobile switches between list and message panel.
- Replies must go to the correct room.

### Login/register

Modern auth card with tab/segmented switch, clear labels, validation, show/hide password, focus/keyboard accessibility, loading/error states. Demo accounts in a secondary panel/accordion. Preserve `next=checkout` and workspace redirect. Register should have client-side confirm password and clearly state that demo data is temporary.

## Priority Backlog

### P0

1. Create `src/components/chat-widget.tsx`, mount in `src/app/[locale]/layout.tsx`.
2. Widget appears on public storefront; avoid covering login/admin/checkout if needed.
3. Split Admin into `admin-inbox.tsx`, don't reuse user layout.
4. Fix responsive header per handoff images: narrow viewport causes `Demo Customer`, `Sign out`, `Cart` to be cramped/clipped/overflowing. Check gap, overflow, font size, mobile collapse.
5. Run typecheck, test, build after each group of changes.

### P1 — chat

- Room metadata: last message, time, unread count.
- Mark-as-read, welcome/unread/sending/error states.
- Scroll to latest message when switching rooms or sending.
- Split message list/composer if needed.
- Admin API should return metadata and selected room instead of all messages.

### P1 — auth

- Split `auth-shell.tsx`, `demo-account-picker.tsx`.
- Show/hide password, confirm password.
- Test redirect, session refresh, and keyboard accessibility.

### P2 — production

Move account/session/chat to database; session expiry/rotation/CSRF; rate limit/audit/monitoring; 2FA for Admin; realtime; persistence/read receipts; real catalog/order/payment/fulfillment. Do not make payment staging public before security review.

## Files to Read Before Editing

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

## Constraints

- User can only read/send messages in their own room; do not break role separation.
- Do not expose Admin controls in the public widget.
- Do not turn demo checkout into real payment outside the requested scope.
- Only use `en` (removed `vi` on 2026-09-28; `/vi/*` redirects 308 to `/en/*`). Do not re-add Vietnamese to the UI.
- Remember account/chat state is lost after restart.
- Check desktop/mobile, especially header and floating widget.
- Project path Windows: `E:\Tai_lieu_E\DONGTHETHANG\04_Cá_nhân\hello`.

## Acceptance Checklist

- [ ] Guest can open/close widget and sees the correct CTA.
- [ ] User sends to their own room.
- [ ] Two customers do not see each other's rooms.
- [ ] Admin switches rooms and replies to the correct customer.
- [ ] Unread/read state is correct.
- [ ] Widget does not cover content on mobile.
- [ ] Header is no longer clipped as in handoff images.
- [ ] Auth has focus, error, password toggle, loading.
- [ ] `next=checkout` works.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass.
- [ ] Separate E2E for guest, customer 1, customer 2, and Admin.

## Notes for the Next Developer

This is a pause point between the functional demo and the UX redesign wave. Auth, roles, room separation, and checkout gate are already in place. First step: read the files above, implement P0 (floating widget, Admin inbox, responsive header), run checks; no need to rewrite the backend immediately. After UX stabilizes, add persistence, unread/read receipts, and realtime.

## Decision and Implementation Log — 2026-09-26

New project owner requirement: from now on, agreed decisions in conversations must be recorded in this doc file. State clearly what was done and what was not; do not mark proposals as completed without verification.

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

### Tiếp tục trong repo trên ổ E — 2026-09-26

- Đã thêm Admin shell riêng tại `/[locale]/admin`: chỉ hiển thị Chat, Settings, đổi ngôn ngữ và đăng xuất; không mount storefront header/cart/widget/footer. Route guard vẫn dựa trên demo session; `/admin` chuyển tới `/admin/chat`, `/admin/settings` nêu rõ tính năng chưa triển khai và giữ link tới payment staging với Bearer key riêng.
- Admin đăng nhập hoặc vào workspace được chuyển tới Admin inbox; customer bị từ chối ở Admin layout. Thêm E2E kiểm tra guest/customer/admin. Chưa có CRUD sản phẩm, migration catalog, upload ảnh, sale price, stock, settings lưu trữ, unread/read receipts hay auth production; không coi đây là hoàn thành ADMIN_MODULE.md.
- Cài dependencies với cache/temp ở `.local-cache` (được ignore) thuộc repo ổ E. `npm test` báo 19/19 pass; `npm run db:generate` và `npm run typecheck` thành công. E2E Admin mới có `test-results/.last-run.json` ghi `passed`. Build biên dịch thành công nhưng Prisma engine Windows báo lỗi tải DLL trong bước tạo trang; không có `.next/BUILD_ID`, vì vậy **build chưa đạt**. Cần xử lý Prisma engine/runtime trước khi triển khai.

### Khắc phục build / database — 2026-09-26

- Windows trên máy chạy Node `win32/arm64`; Prisma Client sinh engine `query_engine-windows.dll.node` không tương thích. Payment DB giờ được khởi tạo chỉ khi GET/POST staging thực sự cần DB (sau bước kiểm tra cấu hình/role), tránh khởi tạo ở import trong build; chưa kiểm chứng được payment khi có database ARM64.
- `npm run build` với `NEXT_BUILD_DIR=.next-verify` đã tạo `.next-verify/BUILD_ID`; build staging trên ARM64 cần test runtime riêng. `next-env.d.ts` được giữ trỏ tới `.next/types/routes.d.ts` sau build kiểm tra.
- Người dùng chọn dựng PostgreSQL và dữ liệu trên ổ E, **chưa có Docker/psql/pg_ctl/initdb trong PATH**. Chưa cài PostgreSQL, chưa tạo DB và chưa chạy migration. Nguồn PostgreSQL Windows liệt kê EDB installer và zip archive; chưa xác nhận zip ARM64 phù hợp. Không tự động cài installer có thể ghi lên C.
- Quyết định mới nhất: tạm hoãn PostgreSQL, chờ người dùng test UI và phản hồi; không cài thêm hoặc chạy migration.
- Kết quả kiểm tra mới nhất thay thế kết quả trước: E2E Admin failed do vượt timeout 30000ms; snapshot vẫn ở Chat sau khi bấm Settings, chat còn loading. Chưa xác định là cold compilation hay lỗi điều hướng/API; không tăng timeout để che lỗi. Hiện cả `.next/BUILD_ID` và `.next-verify/BUILD_ID` đều không còn; cần build lại có log/mã thoát lưu trong repo trước khi xác nhận đạt. Preview `/en` đã trả HTTP 200, không đồng nghĩa toàn bộ UI/API hoạt động đúng.
- Sau đó chạy lại E2E cùng timeout 30 giây thì pass. Tách thành ba bài độc lập (guest/customer/admin); lượt mới nhất `test-results/.last-run.json` ghi `passed`. Bài E2E đầu thất bại có thể là cold compile nhưng chưa chứng minh được. `BUILD_ID` từng xuất hiện rồi biến mất khi dev/E2E hoạt động đồng thời; chưa coi build đạt cho tới khi chạy lại riêng, không dùng chung build dir với dev.
### Triển khai Docker / hosting miễn phí — 2026-09-28

- Đã đọc repo hiện tại và giữ các thay đổi đang có. Ưu tiên đợt này là chuẩn bị deploy demo bằng Docker.
- Thêm Dockerfile nhiều stage dùng Node 22 Debian, Prisma generate trong Linux, Next.js standalone, runtime user node, health check và kiểm tra AUTH_SECRET lúc khởi động. .dockerignore loại env, cache và build local khỏi image.
- Thêm compose.yaml cho demo; compose.db.yaml tùy chọn PostgreSQL 17 private, volume và job migrate deploy. Migration đầu tiên sinh từ schema hiện tại bằng migrate diff --from-empty; chỉ dành cho database mới hoặc đã baseline.
- render.yaml tạo Web Service Docker Free ở Singapore, tự sinh AUTH_SECRET, không cấu hình DB hoặc khóa payment. DEPLOYMENT.md có hướng dẫn Render, Docker local và lựa chọn Neon/Oracle.
- Sửa getPaymentDb để tái sử dụng PrismaClient cả trong production, tránh tạo pool mới theo mỗi request.
- Sửa ProductForm: chờ kiểm tra session xong mới cho bấm thêm giỏ. Cập nhật E2E vốn còn giả định khách chưa đăng nhập được thêm giỏ; kiểm tra thêm logout, chặn checkout và đăng nhập trở lại đúng checkout.
- Kiểm chứng: 23/23 unit tests; 8/8 Playwright E2E bằng Edge, 1 worker, timeout mỗi bài vẫn 30 giây; Prisma validate thành công. Production standalone build (.next-verify-docker) và typecheck thành công sau thay đổi.
- Smoke test HTTP của standalone trên Windows đã kiểm tra /vi, /en, login, CSS/JS, health, quyền Admin API và payment mặc định tắt. Đây không phải kết quả chạy Docker.
- Chưa chạy Docker image hoặc migration trên PostgreSQL thật vì máy chưa có Docker/PostgreSQL. Workflow .github/workflows/docker.yml đã được chuẩn bị để build image, migrate PostgreSQL và smoke test trên Linux; chưa push/chạy workflow.
- Chưa commit/push repo, chưa tạo service Render và chưa có URL public. Cần đăng nhập Render, kết nối GitHub repo và triển khai sau khi các thay đổi được đưa lên GitHub. Phiên này chưa có quyền truy cập tài khoản Render.
- Còn tồn tại: tài khoản đăng ký/chat lưu RAM và mất khi restart; Admin dùng mật khẩu demo công khai; storefront vẫn dùng catalog mẫu, chưa nối CRUD; chưa có unread/read receipts, persistent auth/chat, upload sản phẩm/audit đầy đủ hay thanh toán thật. Không coi toàn bộ ADMIN_MODULE.md đã hoàn thành.
### Deploy từ terminal — 2026-09-28

- Theo yêu cầu người dùng, đã commit và push toàn bộ bản demo đang được phát triển lên origin/main: 1d58d0f (Prepare Docker deployment and complete demo admin integration).
- GitHub Actions Docker checks đã SUCCESS: https://github.com/elliotthewizerd/hello/actions/runs/36382810194. Đã thực sự build/chạy Docker trên Linux, migrate PostgreSQL và smoke test HTTP/API Admin với DB. Kết quả này thay thế ghi chú chưa kiểm chứng Docker ở trên.
- Đã cài Render CLI v2.28.0 Windows ARM64 từ release chính thức vào .local-cache/tools/render trên ổ E. Người dùng đã xác thực CLI thành công; cấu hình đăng nhập nằm trong .local-cache/render-auth (gitignored).
- Workspace Render: My Workspace, tea-dasvrf8473hc73e56vtg. render.yaml được Render xác nhận valid.
- Chưa tạo được service: Render trả HTTP 400, repository URL invalid or unfetchable cho https://github.com/elliotthewizerd/hello. Đã yêu cầu người dùng kết nối Git Deployment Credentials và cấp Render GitHub App quyền đọc riêng repo hello. Đăng nhập CLI không đồng nghĩa Render đã có quyền đọc GitHub.
- Tiếp tục sau khi cấp quyền: render services create, type web_service, runtime docker, plan free, region singapore, branch main, health /api/health, AUTH_SECRET sinh ngẫu nhiên, PAYMENT_ADMIN_KEY trống. Không có service nào được tạo từ các lần HTTP 400; chưa có URL public. Lấy URL thực từ Render sau khi deploy live, rồi kiểm tra /api/health và /vi trước khi bàn giao.
### Repo triển khai thuộc tài khoản người dùng — 2026-09-28

- Xác minh GitHub credential hiện tại thuộc dongthethang2k15kkk. Repo gốc elliotthewizerd/hello là private; người dùng có push nhưng không có quyền admin/maintain.
- Để không phụ thuộc quyền cài Render App của chủ repo gốc, đã tạo private repo https://github.com/dongthethang2k15kkk/hello-render-deploy và push main. Remote render trỏ tới repo này; origin và upstream của main vẫn là origin/main.
- DEPLOYMENT.md đã cập nhật repo triển khai và lệnh git push render main. Không thay đổi visibility repo gốc hoặc repo mới.
- Render vẫn trả 400 invalid or unfetchable cho repo mới. Cần người dùng hoàn tất Render Settings → Account Security → Git Deployment Credentials → Add credential → GitHub, cho phép đọc hello-render-deploy trong tài khoản dongthethang2k15kkk. Người dùng đã được gửi hướng dẫn; chưa có service hay URL public.
- Khi tiếp tục, kiểm tra render services trước khi tạo để tránh trùng. Dùng repo mới, Docker, Free, Singapore, /api/health, secret ngẫu nhiên. CLI và config vẫn trong .local-cache trên ổ E.
### Redesign "Jewish Horse" + bỏ tiếng Việt — 2026-09-28

Quyết định đã chốt trong hội thoại và trạng thái:

- **Chỉ tiếng Anh (đã làm):** bỏ locale `vi` khỏi `i18n/messages.ts`, `i18n/request.ts`, `middleware.ts`, `lib/catalog.ts`, `lib/product-rules.ts`, API admin products. `/` và `/vi/*` redirect (308) sang `/en/*`. Bỏ nút VI/EN ở header storefront và Admin. Lý do: font pixel Minecraft vỡ dấu tiếng Việt. Toàn bộ chuỗi tiếng Việt hard-code ở trang, component và lỗi API (login, register, chat) đã dịch sang tiếng Anh.
- **Schema sản phẩm (đã làm):** `productInput` chỉ nhận `en` và `labelEn`; payload có `vi`/`labelVi` sẽ bị từ chối. Trang Admin Products lọc bỏ `labelVi` cũ trước khi lưu. Bản dịch `vi` cũ trong database (nếu có) không bị xóa tự động, nhưng lần lưu sau sẽ chỉ ghi `en`.
- **Thương hiệu (đã làm):** logo "Jewish Horse" (font Minecraft) + tagline "Digital package shop" thay `SHOP / CONCEPT`. Title trang, footer, Admin header đã đổi.
- **Font (đã làm):** Minecraft chỉ cho logo, h1/h2, eyebrow, tiêu đề bước. Inter (Google Fonts qua `@import` trong `globals.css`, không dùng `next/font` để giữ cách import sẵn có) cho body, menu, giá, nút, FAQ, form. Body 16–17px, line-height ~1.7.
- **Tương phản (đã làm):** mô tả bước, câu trả lời FAQ, placeholder, `.muted`, caption, footer chuyển sang màu sáng hơn (#d4e8c8 / #b8d4a8). Ghi đè `.muted` màu xám cũ (#667368).
- **Nút (đã làm):** "Explore packages" là nút lime đặc chữ tối; "How it works" là text link. Nút "Package details" trên card là nút chính; tag "Demo" nhỏ, nhạt; giá to, đậm.
- **Hero (đã làm):** hộp trắng đè ảnh được thay bằng caption nền xanh đậm nằm trong khung ảnh, không bị cắt.
- **Catalog (đã làm):** bỏ ô tìm kiếm, chip lọc, sort. Thêm ô ảnh preview (placeholder có ghi rõ), 2 điểm so sánh Basic/Extended lấy từ dữ liệu catalog hiện có, khối "What you get after purchase".
- **Chưa làm, chờ người dùng cung cấp:** mô tả shop thật (thay "Digital goods. A better experience."), tên/giá/nội dung thật của 2 gói, điểm khác biệt thật, cách giao hàng sau mua, ảnh preview thật trong `public/`, và quyết định demo hay bán thật (các nhãn "Demo", "Sample prices", "no payments or delivery", "UI preview" vẫn giữ nguyên).
- **Giữ nguyên có chủ ý:** "Bank / VND" và định dạng VND trong payment staging là đơn vị tiền tệ ngân hàng, không phải ngôn ngữ giao diện.
- **Kiểm chứng:** `tsc --noEmit` pass; Vitest 24/24 pass; Playwright 8/8 pass (Edge, 1 worker), gồm test redirect `/vi` → `/en` và kiểm tra không tràn ngang ở viewport 390px. Đã xem ảnh chụp desktop. `npm run build` (NEXT_BUILD_DIR=.next-verify) thành công, có `.next-verify/BUILD_ID`. Mobile chỉ được kiểm tra tự động (không tràn ngang), chưa xem trực quan.

### UX usability pass — 2026-09-29

- **Luồng mua:** khách chưa đăng nhập giờ được thêm sản phẩm vào giỏ trên thiết bị thay vì bị chuyển sang đăng nhập trước khi lưu. Checkout vẫn yêu cầu tài khoản; sau đăng nhập giỏ được giữ nguyên. Từng dòng giỏ có `Edit details`, điền lại đúng dữ liệu qua `?edit=`, và xóa có `Undo`.
- **Mobile:** thêm menu điều hướng thực dưới 900px, đóng sau khi chọn liên kết; rút gọn hero mobile và sửa box sizing. Đã đo lại trang chủ và checkout ở viewport 390px: `scrollWidth === innerWidth`.
- **Khả năng đọc:** chat và toàn bộ Admin dùng nền sáng/chữ tối có tương phản rõ; checkout sửa màu trạng thái chọn và nội dung phương thức. Admin chuyển sang work-surface sáng, giảm font pixel/bóng chữ trong khu vực vận hành.
- **Chat:** widget dùng dialog semantics, đóng bằng Escape, trả focus về nút mở, giữ focus trong dialog và khóa cuộn nền trên mobile. Admin có tìm conversation và lọc `Needs reply` dựa vào vai trò của tin cuối; bản nháp text được giữ riêng theo room, ảnh được xóa khi chuyển room để tránh gửi nhầm. Nhãn trạng thái đổi thành `Demo support`, không khẳng định nhân viên đang online.
- **Admin Products:** thiết kế lại thành danh sách + editor, chia Product information / Packages / Delivery information; nhập giá bằng USD thay vì cents; checkbox đúng kích thước; có trạng thái visible/available, tự gợi ý slug, cảnh báo bỏ thay đổi, save bar, trường delivery và lỗi database ở đầu trang. Kiểm tra database tự timeout sau 8 giây; khi database chưa cấu hình, form không cho nhập vô ích. Đã kiểm tra trực quan desktop/mobile bằng response API giả lập; không tràn ngang.
- **Nội dung:** checkout không còn nói guest checkout trong khi đã bắt đăng nhập; bỏ chi tiết staging khỏi lựa chọn thanh toán của khách; FAQ trỏ tới chat đang tồn tại; workspace thống nhất tên `Chat with support`.
- **Kiểm thử:** TypeScript pass; Vitest 24/24 pass; Playwright 10/10 pass bằng Edge, 1 worker; production build `.next-verify` thành công và có `BUILD_ID`. Thêm E2E cho guest add/edit cart và Escape/focus của support dialog. Playwright đổi sang cổng 3000 để dùng lại preview local, tránh hai Next dev server cùng ghi `.next` làm hỏng cache; kiểm tra lại preview `/en` trả HTTP 200.
- **Còn giới hạn:** storefront/cart validation vẫn dùng catalog demo tĩnh trong `src/lib/catalog.ts`; CRUD Admin dùng PostgreSQL và chưa phải nguồn dữ liệu chung cho storefront. Local chưa cấu hình PostgreSQL nên chưa kiểm tra save/delete thật. Chat/account vẫn lưu RAM và mất khi server restart; chưa có unread/read receipts hoặc đơn hàng thật.

### Admin catalog to storefront integration — 2026-09-29

- **Shared catalog:** active Admin products and active packages are now flattened into the public storefront catalog. Package price, sale price, stock, image path, English title/description, SKU and the latest delivery form are shared by the home page, product detail, cart and checkout.
- **Safe fallback:** when `DATABASE_URL` is absent, the two clearly labeled demo packages remain available. If a configured database times out or fails, the storefront shows the demo packages with a visible fallback status. A successful empty database catalog stays empty so Admin can intentionally hide all packages.
- **Consistent validation:** the browser cart, demo quote and staging payment route validate against the same catalog shape. Staging payment creation requires a reachable database catalog and rejects stale product IDs, delivery fields, quantities or stock before calculating the server-side total.
- **Customer behavior:** carts saved under an older catalog are cleared when their product/package or delivery form no longer validates. Out-of-stock packages remain visible but cannot be opened or added. Configured product images now render in catalog cards, product detail and cart.
- **Verification:** TypeScript passed; Vitest passed 25/25; Playwright passed 11/11 with Microsoft Edge and one worker. The public catalog endpoint, desktop storefront, 390 px checkout, guest cart editing, permissions and support dialog were covered. Storefront and `/api/catalog` returned HTTP 200. The optimized production build completed and created `.next-verify/BUILD_ID`.
- **Remaining limit:** local PostgreSQL is still not configured, so the real Admin save/delete to storefront round trip has not been exercised on this Windows machine. The Linux/PostgreSQL workflow remains the source of database runtime coverage. Account/chat persistence, unread state and real order/payment fulfillment remain separate backlog items.

### Persistent database plan — 2026-09-29

- The configured Render PostgreSQL database is reachable and `prisma migrate status` reports the schema up to date. A read-only status check found 0 products, 0 packages, 0 delivery forms, 0 payment receivers, 0 orders and 0 payment events, so no business data needs migration before changing providers.
- Render Free cannot safely host PostgreSQL inside the app Docker container: its filesystem is ephemeral and Free Web Services cannot attach persistent disks. Render Free PostgreSQL also expires after 30 days. The recommended free layout is Render Free for the app plus external Neon Free PostgreSQL.
- Added `DATABASE.md`, `npm run db:status` and `scripts/backup-postgres.ps1`. The backup helper uses the official PostgreSQL 17 Docker image and writes ignored custom dumps under `backups/`. Docker is not installed on this Windows machine, so the helper was prepared but not executed here.
- `compose.db.yaml` remains the self-hosted option for a local machine or VPS. It keeps PostgreSQL private and uses the named volume `postgres_data`; this is durable only when the Docker host itself has persistent storage and backups.
- A Neon Free project named `jewish-horse-shop` was created in `aws-ap-southeast-1` (Singapore), project ID `hidden-mud-85827432`, with PostgreSQL 17 and database `game_shop`. Migration `20260928000000_initial` applied successfully and `npm run db:status` confirmed the new database is reachable and empty.
- Render Web Service `srv-dat16tvpn0mc73ag25vg` (`https://jewish-horse.onrender.com`) now uses the Neon connection as its secret `DATABASE_URL`. Deploy `dep-datmjlfavr4c73e5dgu0` reached `live` at 2026-09-29T07:34:25Z. The old empty Render database remains available only as a short rollback source and expires 2026-10-28; it is no longer the configured local/Render target.
- Verification after the database work: TypeScript passed, Vitest 38/38 passed, Playwright 13/13 passed with its own no-database demo server, and the production build created `.next-verify/BUILD_ID`. The application/database work was committed as `2e57f13`; the first database cutover deploy used the previous app commit `d64558d`, so Render must finish the automatic deploy of `2e57f13` after push before final public smoke testing.
- Final application deploy `dep-datmlfu0tbcc73843f5g` reached `live` from commit `c140da6` at 2026-09-29T07:40:02Z. Public smoke checks returned: `/en` HTTP 200, `/api/health` `ok`, `/api/catalog` source `database` with 0 products, and unauthenticated `/api/admin/products` HTTP 403.
- `/api/auth/providers` currently reports `google: false` and `devAdmin: false` on Render. This is correct for the disabled development shortcut. `APP_URL=https://jewish-horse.onrender.com` is now configured; production Admin sign-in remains unavailable until valid `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_GOOGLE_EMAILS` values are supplied.

### Neon demo catalog seed — 2026-09-29

- Added the guarded, idempotent `npm run db:seed-demo` command. It upserts only the clearly labeled `sample-basic` / `SAMPLE_BASIC` and `sample-plus` / `SAMPLE_PLUS` demo records, including English translations and versioned delivery forms; it does not delete unrelated catalog data.
- Ran the seed twice against Neon to confirm repeatability. Database status then reported 2 products, 2 packages and 2 delivery forms, with payment tables still empty.
- Public `https://jewish-horse.onrender.com/api/catalog` immediately returned source `database` with both demo packages. No application redeploy was required for the database content change.
- Render `APP_URL` was set to the public HTTPS origin. The three Google-specific values in local `.env` are empty strings, so they were not uploaded as fake credentials.

### Production catalog and Google Admin OAuth — 2026-09-29

- Commit `8503157` (`Seed Neon demo catalog`) was pushed to `origin/main`. Render deploy `dep-datnd7gu01pc73fg57ag` reached `live` from that commit at 2026-09-29T08:30:37Z.
- Production smoke checks passed: `/en` and a database-backed product detail returned HTTP 200; `/api/health` returned `ok`; `/api/catalog` returned source `database` with 2 products; the demo quote endpoint validated a seeded item and returned USD 1000 cents with payment disabled; unauthenticated Admin products remained HTTP 403.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_GOOGLE_EMAILS` were configured directly as Render environment variables. No credential value was written to local `.env`, source files, Git or this document. The Admin allowlist currently contains the email of the authenticated Render account.
- Render deploy `dep-datnm6m0tbcc73ejlnmg` reached `live` at 2026-09-29T08:48:06Z after the OAuth environment update. Public provider status reports `google: true` and `devAdmin: false`. The authorization redirect uses Google Accounts, the exact production callback `https://jewish-horse.onrender.com/api/auth/google/callback`, and PKCE S256; an anonymous configuration check found no `invalid_client` or `redirect_uri_mismatch` response.
- Remaining manual acceptance: sign in through `/en/login` with the allowlisted Google account and confirm the redirect to `/en/admin/chat`. Because the first client secret was supplied through chat, rotate it in Google Cloud after acceptance and enter the replacement directly in Render without sending it through chat. Then revoke the old secret and run the provider/redirect smoke checks again.

### Admin product image upload — 2026-09-29

- **Decision:** Admin no longer types an image path. Products → Product information has an image manager with preview, file picker and drag and drop. Images are stored in PostgreSQL (`ProductImage`, `BYTEA`) instead of the container filesystem, because Render Free loses local files on sleep, restart or redeploy.
- **Behavior:** the browser accepts PNG, JPEG or WebP up to 12 MB and resizes anything over 2 MB or 1800 px to WebP before upload. `POST /api/admin/product-images` (Admin only) re-checks type, 2 MB limit and magic bytes, deduplicates by SHA-256 and returns `/api/product-images/<id>`. The public `GET` route serves the bytes with `immutable` cache and `nosniff`. Uploaded-but-unsaved images are removed when the draft changes, and unreferenced images older than 24 hours are purged on the next upload. The server refuses to delete an image that a product still references. Legacy `/product-images/*.webp` paths remain valid.
- **Database:** migration `20260929090000_product_images` adds the table. `prisma migrate status` against Neon reports 2 migrations and the schema up to date. Added `npm run db:inspect` (per-table row counts) and image counts in `npm run db:status`. See the image section in `DATABASE.md`; images use Neon storage quota.
- **Verification:** TypeScript passed; Prisma schema valid; Vitest 42/42 passed; production build into `.next-upload-verify` created `BUILD_ID`. Playwright ran 14 tests: 13 passed on the first run; the mobile checkout test timed out once after clicking `Preview checkout` (dev server first-hit compile of `/checkout`) and all 8 storefront tests passed on the rerun. The new E2E covers choosing an image with mocked upload API.
- **Not verified locally:** a real upload to Neon. On this Windows ARM64 machine the Prisma query engine could not open a connection to Neon (`migrate status` worked, the client did not), so the upload → storefront round trip must be checked on Render after signing in as Admin.
- **Production:** commit `a0a840e` pushed; Render deploy `dep-datobjlg1s2s73f9l580` reached `live` at 2026-09-29T09:35:25Z. Smoke checks: `/en` 200, `/api/health` ok, providers `google: true` / `devAdmin: false`, catalog source `database` with 2 products, `GET /api/product-images/<missing>` 404 (table reachable; 503 would mean storage failure), guest upload and delete 403, guest `/en/admin/settings/products` redirects to login.
- **Next manual step:** sign in with the allowlisted Google account, upload an image to a product, save, and confirm it shows on the storefront and still loads after a Render restart. Then rotate the Google client secret as noted above.

### Product saved but not shown in store — 2026-09-29

- **Report:** the owner created product `Khánh Vy` (slug `kh-nh-vy`); Admin listed it as "Visible in store · 1 package", but the public catalog only returned `sample-plus`. `sample-basic` is no longer in the catalog either.
- **Cause:** the storefront lists a product only when the product **and** at least one package are active (`getPublicCatalog`). New packages defaulted to `active: false` and stock 0, while the Admin list label only reflected the product switch. Admin therefore showed "Visible" for a product customers could not see.
- **Fix:** new packages now default to available. `src/lib/admin-product-status.ts` mirrors the storefront rule; the Admin list shows `Live in store`, `Not in store`, `In store · out of stock` or `Hidden from store`, the editor explains what to switch on, stock 0 on an available package shows a warning, and the save message says whether the product is actually live. Slugs now strip Vietnamese diacritics (`Khánh Vy` → `khanh-vy`) instead of dropping the letters.
- **Existing data:** the saved `Khánh Vy` package is still unavailable in Neon; the owner must open it, turn on "Package available", set stock above 0 and save. Changing the slug to `khanh-vy` is optional.
- **Verification:** TypeScript passed; Vitest 49/49; production build created `BUILD_ID`; Playwright 15/15 in one run (an earlier Admin run had three 30 s `page.goto` timeouts while the dev server recompiled, passing on rerun). New E2E covers the "visible product with no available package" case.

### Catalog fallback after idle — 2026-09-29

- **Accepted by owner:** `Khánh Vy` now saves as "live in the store"; public catalog returned source `database` with `kh-nh-vy` and `sample-plus` on three consecutive checks (~1.3 s each).
- **Bug found:** the first catalog request after an idle period returned source `fallback` with the two demo packages. `getPublicCatalog` gave the database 3 s; a suspended Neon Free compute plus a fresh Prisma connection can exceed that, so customers briefly saw demo products instead of the real catalog.
- **Fix:** default catalog timeout raised to 10 s. The fallback behavior itself is unchanged (still used when the database is really unreachable).
- **Cosmetic, not fixed:** a number input can keep showing typed leading zeros (e.g. stock `0019`); the saved value is correct (19).

### Admin management area — direction agreed 2026-09-29

- **Business direction (owner choice "1a"):** the shop will sell for real soon. Customers pay by bank transfer; the owner confirms payments manually. This supersedes the open "demo or real" question above; demo labels must be revisited before launch.
- **Data viewing:** customer, order, payment and activity data is viewed inside Admin through curated pages with filters (time, status, search). No raw database browser in Admin; sensitive fields (password hashes, session secrets, keys) are never shown. Raw access, if ever needed, stays in the Neon Console.
- **Passwords:** never viewable by anyone. Admin gets account info, last sign-in, lock/unlock and reset actions instead.
- **Phases (each: design → owner approval → build):** 1 accounts and sign-in history in PostgreSQL; 2 real orders with stock deduction; 3 manual payment recording; 4 Admin audit log; 5 overview dashboard. Status: design in progress, nothing implemented.
- **Phase 1 decisions (2026-09-29):** customers sign in with Google or email + password. No custom domain yet, so no automated email: password accounts are unverified, and forgotten passwords are handled by Admin issuing a temporary password. Render Free blocks outbound SMTP ports 25/465/587 (Render changelog, Sept 2025), so any future email must use an HTTP email API, ideally with an owned domain. Sign-in history records time, result, method, device and IP, auto-deleted after 90 days. Chat moves to PostgreSQL in phase 1. Design awaiting owner approval; nothing implemented.

### Phase 1 implemented: customer accounts, sign-in history, persistent chat — 2026-09-29

- **Owner approvals:** design approved in chat with two additions: Admin can set a new password for a customer who forgot theirs (never read it), and the forgot-password contact is the shop's Zalo QR image (`public/contact/zalo-qr.png`). Spec: `docs/specs/2026-09-29-phase1-accounts-chat-design.md`.
- **Built:** migration `20260929120000_customer_accounts_chat` (additive: `Customer`, `CustomerSession`, `LoginEvent`, `ChatMessage`, `ChatImage`, `AuditLog`). Customers register/sign in with email + password or Google; allowlisted Google emails still become Admin. 30-day database sessions (only the SHA-256 of the cookie token is stored), 60 s in-process session cache invalidated on lock/password change/sign-out-everywhere. Rate limits: 5 failed attempts per email or 20 per IP in 15 minutes, 5 registrations per IP per hour (loopback ignored). Google linking removes an unverified password when the real owner signs in with Google. `/en/account` (change/set password, sign out other devices, forced change after an Admin-set password), `/en/forgot-password`, `/en/privacy`. Chat and chat images in PostgreSQL; images private (`/api/chat/images/<id>`, owner or Admin only), 30 per conversation, deleted after 90 days with sign-in history. Admin → **Customers** (list with filters, Sign-in activity tab with filters, customer page with devices, history, audit log, set password, lock/unlock, sign out everywhere, delete with typed email). Demo accounts (`customer/customer123`) and the in-memory account/chat stores were removed.
- **Bugs found while testing and fixed:** `safeNext('__proto__')` was accepted (unit test); Admin filter lists could show stale unfiltered results when an older request finished last (E2E), now aborted; sign-in and register made sequential database round trips, now parallel.
- **CI:** the GitHub "Docker checks" workflow had been failing on every push since the Admin password login was removed (smoke script still used `admin/admin123`). The smoke script now registers a customer; a new `e2e` job runs Playwright against a PostgreSQL service. The deploy repo `dongthethang2k15kkk/hello-render-deploy` is currently **public** (GitHub API answers without auth); a history scan found no committed secrets.
- **E2E database:** Neon branch `e2e` (schema-only from `main`, endpoint `ep-broad-dawn-…`) in `E2E_DATABASE_URL` of local `.env`. An earlier full-copy branch created the same day was deleted. Prisma refused `migrate reset` because it detected an AI agent; the setup was redesigned to only `migrate deploy` + seed.
- **Verification before deploy:** TypeScript passed; Vitest 66/66; Playwright 24/24 against the Neon `e2e` branch (a later rerun of the account and Admin specs after UI fixes: 16/16); production build created `BUILD_ID`. Pages were checked visually at desktop and 390 px; fixed a stretched checkbox, clipped checkbox label, unreadable pixel-font card headings and the chat button covering the QR code.
