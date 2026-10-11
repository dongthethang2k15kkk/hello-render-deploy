# Jewish Horse — Project Handoff

> Updated: 2026-09-30
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
- **Cosmetic (fixed later the same day):** stock and display-order inputs kept showing typed leading zeros (e.g. `0019`); they now show the saved number when leaving the field. The Slug hint no longer claims the slug is used in the product URL (product pages use the package id).

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
- **Production (2026-09-29):** commit `79f95ee` deployed as `dep-datqojvf3r2c73e2bsrg`, live at 12:19:51Z. `prisma migrate status` on Neon `main`: 3 migrations, up to date. `/en`, `/en/login`, `/en/forgot-password`, `/en/privacy`, `/en/account` 200; `/contact/zalo-qr.png` served as PNG; providers `google: true`, `devAdmin: false`; anonymous `/api/chat` and `/api/account` 401, `/api/admin/customers` and `/api/admin/login-events` 403, unknown chat image 404; catalog source `database` with `kh-nh-vy`, `sample-plus`.
- **Client IP check on production:** two failed sign-ins for the non-existent `ip-check@example.invalid` with spoofed `X-Forwarded-For: 1.2.3.4` and `True-Client-IP: 9.9.9.9` were both recorded with the real client IP; a spoofed `CF-Connecting-IP` is rejected by Cloudflare (error 1000, HTTP 403) before reaching the app. Those two "Unknown email" events remain in Sign-in activity until the 90-day purge.
- **Owner must still:** sign in to Admin again (cookie renamed); publish the Google OAuth app (Testing → In production) with the privacy URL so any customer can use Google; decide whether `hello-render-deploy` should be private.

### Phases 2–5 implemented: orders, bank-transfer payment, appointments, Gmail, audit log, overview — 2026-09-29

- **Owner decisions (chat, approved plan):** Admin enters prices in VND; the store shows USD large and VND small using an Admin-set rate (default 26,000 VND/USD); customers pay the exact VND amount. Payment is a Vietnamese bank transfer with a VietQR code; stock is held 30 minutes. Delivery is by appointment: after "I've transferred" the customer proposes 1–5 free time windows; all `ADMIN_GOOGLE_EMAILS` get a Gmail with a link to the order; one Admin confirms payment and picks the time in one step; the customer gets Gmail + web Inbox with calendar links; both meet in the site chat; the Admin completes the order with a delivery note visible only to that customer. Admin emails are Vietnamese, customer emails English. Spec: `docs/specs/2026-09-29-phases-2-5-orders-design.md`.
- **Optimisations agreed:** payment confirmation and scheduling in one action; `.ics` + Google Calendar link instead of server reminders (Render Free has no scheduler); completion email never contains the delivery note; the scheduling Admin is assigned to the order; email failures are logged with resend and every event also lands in the Inbox; Admin deep links from email survive Google sign-in (`next` path); late transfers can be confirmed on an expired order when stock allows.
- **Built:** migration `20260929180000_orders_payments_appointments` (additive; backfills `Package.priceVnd` from USD cents × 260). Checkout creates real orders (`/api/orders`), `/en/orders`, `/en/orders/<code>` (VietQR from `src/lib/vietqr.ts` rendered with `qrcode`, countdown, copy buttons, time-window dialog, appointment with calendar, delivery note, timeline), `/en/inbox`, header Orders/Inbox badge. Admin: Overview, Orders (+ needs-action badge in nav), order page, Activity (AuditLog now has `entityType`/`entityId`; product saves/deletes, settings, email, order and customer actions are logged), Settings → Payments (bank accounts with NAPAS BIN list, holder normalised to capitals, test QR, rate) and Email (Gmail API connect via the existing callback with `gmail.send` + offline access, test email, log). Customers with orders are anonymised instead of deleted. The Bearer-key payment staging page/API and the demo quote API were removed; their empty tables remain. Demo/preview wording and the DEMO banner were removed from the storefront.
- **Bugs caught by tests and fixed:** "Đ" was dropped from VietQR transfer notes; an order opened right after its hold ended still showed "awaiting payment" because expiry was throttled; a stale "connect Gmail" cookie could have hijacked a later sign-in (now cleared on every sign-in start).
- **Verification before deploy:** TypeScript passed; Vitest 75/75 (VietQR CRC-16/CCITT-FALSE vector and payload fields, transitions, windows, VN time conversion, .ics, MIME/header injection, template escaping); Playwright 29/29 against the Neon `e2e` branch, including the full order flow, customer cancel, expiry + late confirmation and access control; production build created `BUILD_ID`. Local E2E limits were raised to 60 s per test / 15 s per assertion because each Neon query from this machine takes 80–300 ms behind an on-demand dev server; CI uses a local PostgreSQL. Pages were checked visually on desktop and 390 px; fixed header link spacing, dialog centring/contrast, a low-contrast caption and the chat button covering the payment details.
- **Not verified:** scanning the generated VietQR with a real banking app, and real Gmail delivery (no Gmail connected in tests; emails are logged as `skipped`). Both need the owner.
- **Deploy incident:** the first Render build of `45bcb84` failed at `npm ci` ("Missing: @swc/helpers from lock file") because the lock file had been written by the local npm 11 while the Docker image uses npm 10. The live site stayed on the previous deploy. Fixed in `7142787` by regenerating `package-lock.json` with npm 10.9 (`.local-cache/tools/node-v22.20.0-win-x64`); use that npm for future dependency changes.
- **Production (2026-09-29):** deploy `dep-dattjftg1s2s73fgs6ag` live at 15:34:09Z. `prisma migrate status`: 4 migrations, up to date. Catalog source `database`, rate 26,000, prices converted (`kh-nh-vy` 26,000 ₫, `sample-plus` 650,000 ₫). New customer and Admin pages return 200; anonymous order/notification APIs 401, Admin APIs 403; `/en/admin/orders` redirects to `/en/login?next=%2Fen%2Fadmin%2Forders`; the DEMO banner is gone. GitHub Actions for `7142787`: `verify` (Docker build, migration, smoke) and `e2e` (Playwright on PostgreSQL) both succeeded.
- **Owner must still do before selling:** add the real bank account and scan the Test QR with a banking app; connect Gmail (enable Gmail API first) and send a test email; add the other two Admin Gmails to `ADMIN_GOOGLE_EMAILS` on Render; publish the Google OAuth app; enter real VND prices; place one small real order end to end.

### Badges, Admins in Settings, announcements, Discord contact and Litecoin — 2026-09-30

- **Owner requests (chat):** make Orders/Inbox prominent with counts; the owner chose **Orders = number of items in the cart** (same as Cart), Inbox = unread notifications (the Inbox page also lists upcoming appointments), Chat = unread replies from Admin; the same idea for Admin (Orders needing action, unread customer chat). Admins can add other Admin emails in the UI. The hero panel ("A new way to explore…") becomes an Admin-managed announcement carousel (several images, swipe/arrows, auto-advance). The contact QR is a **Discord** invite (`https://discord.gg/pD4MdsJB`, decoded from the image), not Zalo. Litecoin payment with a QR like VietQR.
- **Products "Admin role required" on production:** not a database problem. The 8-hour Admin cookie expired while the tab stayed open; client-side navigation inside Admin does not re-run the layout check, so API calls returned 403 and the page showed a misleading "Configure PostgreSQL" hint. Fixed: Admin sessions last 24 h; the presence heartbeat (3 s), the nav badge poll and the Products page redirect to `/en/login?next=<current page>` on 403; the hint text no longer mentions PostgreSQL.
- **Built:** migration `20260930090000_chat_read_state` (`Customer.chatReadAt`, `adminChatReadAt`) and `20260930120000_litecoin_payments` (`CryptoWallet`; `Order.paymentMethod`, `cryptoAmount`, `cryptoRateVnd`, `customerTxid`). Header pills with red count badges and a badge on the floating Chat button; `/api/auth/session` returns `unread` and `chatUnread`; customer chat marks replies read when loaded (conditional write). Admin nav is a client component polling `/api/admin/counts` every 20 s with per-room unread counts in the inbox. Settings → Admins (`StoreSetting.adminEmails`; owners stay in `ADMIN_GOOGLE_EMAILS` and cannot be removed in the UI; all Admins receive order emails). Settings → Announcements (`StoreSetting.announcements`, up to 10 images stored like product images, optional caption and link, 3–30 s interval, preview); the storefront carousel pauses on hover/focus, has a pause button, swipes on touch and respects reduced motion; image cleanup and deletion now keep images used by announcements.
- **Litecoin:** Settings → Payments → Litecoin wallets (checksum-verified Base58Check/Bech32/Bech32m addresses; test QR for 0.001 LTC) and Litecoin price (automatic CoinGecko VND price with Binance LTC/USDT × VND/USD fallback, cached 5 min; optional manual override). Checkout offers bank transfer and/or Litecoin depending on what is configured. The rate is locked per order; each open order on an address gets a unique amount (rounded up to 1,000 litoshi plus a 1–999 litoshi tag) because crypto transfers have no memo. Order page shows a `litecoin:` URI QR, exact amount, address and an "Open in wallet app" link; the report dialog accepts an optional 64-hex TXID; Admin sees the expected amount, locked rate, wallet and TXID with litecoinspace.org links, and confirmation records the order's VND value.
- **Verification:** TypeScript passed; Vitest 86/86 (including BIP173/BIP350 Bech32 vectors and the Bitcoin genesis Base58Check address); Playwright 34/34 on the Neon `e2e` branch, including badges, Admin management, announcements carousel, expired-session redirect, Discord contact and a full Litecoin order; production build created `BUILD_ID`. Visual check on desktop and 390 px; fixed announcement caption contrast in Admin.
- **Not verified:** scanning the Litecoin QR with a real wallet and receiving real LTC; live CoinGecko/Binance prices from Render (tests use a manual price).
- **Production (2026-09-30):** commit `731738c` deployed as `dep-dau72fk9v7es73ba5kng`, live at 02:20:02Z; `prisma migrate status`: 6 migrations, up to date. `/api/payment-methods` returned `bank: true` (the owner has added an active bank account) and `ltc: null` (no wallet yet). Forgot-password page shows the Discord invite; new Admin APIs return 403 anonymously and Admin pages redirect to login with `next`.

### Automatic payment detection, "free right now", Start now and reminders — 2026-09-30

- **Owner request (chat):** detect successful payments in the app; let customers book from the moment they order and let a free Admin start immediately; asked whether customers are notified at appointment time and how Admins contact customers.
- **Answer given:** at appointment time the customer gets a Chat message, an Inbox notification and an email about 10–20 minutes before (plus the calendar file from the booking email); when an Admin presses **Start now** they get Chat + Inbox + a "We are ready for you now" email at once. Admins talk to customers in the site Chat (Admin → order → Open customer chat; the customer sees the red Chat badge), backed by email; Discord stays the general contact. Web push is a possible later addition.
- **Built:** migration `20260930150000_auto_payment_detection` (`Order.asap`, `paymentSource`, `paymentSeenAt`, `txConfirmations`, `reminderSentAt`; `BankTransaction` log). `POST /api/payments/sepay` (SePay webhook, `Authorization: Apikey <key>`, key generated in Settings → Payments and stored in `StoreSetting.sepayWebhookKey`, compared in constant time; dedupe by SePay id; order code found anywhere in code/content/description; account number must match the order's snapshot; underpaid → event + Admin email; paid → order `paid` with `paymentConfirmedBy = auto:sepay`, customer Inbox + email, email to every Admin). Litecoin: `litecoinspace.org` address txs matched by exact unique amount after the order time; first sighting stores TXID/`paymentSeenAt`, auto-confirms at 2 confirmations; checked when the order page (customer polls every 10 s while unpaid) or Admin page loads, on "Check payment now", and on each tick. `src/lib/order-stock.ts` holds restock/re-reserve so detection can revive an expired order when stock allows. `GET /api/cron/tick` + `src/lib/housekeeping.ts` (expire, LTC checks, reminders; 1-minute throttle; reminders claim `reminderSentAt` so each is sent once) called by `.github/workflows/tick.yml` every 15 min 08:00–23:59 VN and by the Admin badge poll every 3 min while an Admin is online. Time dialog: "I’m free right now" (sends a now→+3 h window, later times optional); slots may start up to 10 min in the past. Admin order page: "Free now" badge, **Start now** (30 min–2 h, `start-now` action → appointment now, Chat/Inbox immediately, "ready now" email), "Check payment now", automatic-confirmation details, auto-refresh every 20 s while live. Settings → Payments: SePay setup steps, key (shown once), recent incoming transfers with outcomes.
- **Verification:** TypeScript passed; Vitest 91/91 (order-code extraction from bank-rewritten content, Litecoin matching by exact amount, old transactions ignored, confirmations); Playwright 36/36 on the Neon `e2e` branch, including a SePay webhook test (no key/wrong key 401, underpaid flagged, matched once, duplicate ignored, customer "free now", Admin Start now → Chat + Inbox) and a tick reminder test (sent once by Chat + Inbox). E2E tests cancel their orders at the end because the seeded packages only have 5 in stock. Production build created `BUILD_ID`. Screens checked at 390 px (time dialog, order page) and desktop (Admin order, Payments settings).
- **Not verified:** a real SePay account and real bank transfer; real Litecoin payments.
- **Production (2026-09-30):** commit `7f8fb1a` live at about 03:35Z; `prisma migrate status`: 7 migrations, up to date. `GET /api/cron/tick` returned `{"ok":true,"ltcChecked":0,"reminders":0}` and a second call within a minute `{"ok":true,"skipped":true}`; `POST /api/payments/sepay` with a wrong key returned 401 (the owner has not generated a SePay key yet); Admin pages redirect anonymously, `/api/admin/counts` 403. GitHub lists the workflow "Shop housekeeping" as active, and "Docker checks" passed for `7f8fb1a`; as of 04:06Z no scheduled run had fired yet (new schedules can take a while to start). Until it runs, reminders still go out while an Admin has the site open.

### SePay removed, one-minute wait before "I've transferred" — 2026-09-30

- **Owner request (chat):** remove SePay; the "I've transferred" button should only become clickable about a minute after ordering. Also asked what publishing the Google OAuth app is for and whether web push works on iPhone.
- **Answer given:** publishing moves the Google app from Testing to In production so any Google account (not only listed test users) can sign in, and the Gmail sending connection stops expiring every 7 days. Web push works on iPhone only for iOS/iPadOS 16.4+ when the site is added to the Home Screen and the customer allows notifications from inside it; not in a normal Safari tab.
- **Built:** removed the SePay webhook route, key setting, transfer list, bank-note parsing and the underpaid email; migration `20260930170000_remove_sepay` drops the empty `BankTransaction` table (production had 0 rows and no key stored). Litecoin detection, "free right now", Start now and reminders stay. `REPORT_DELAY_SECONDS = 60` in `order-rules.ts`: the order page shows the countdown on the button ("I’ve transferred → (45s)") and a hint to pay first; `reportTransfer` refuses reports earlier than 55 s after `createdAt`. E2E: `appointments.spec.ts` replaces `auto-payments.spec.ts` (payment confirmed by the Admin API); order tests assert the locked button and the refused early report, then move `createdAt` back in the E2E database.
- **Verification:** TypeScript passed; Vitest 89/89; Playwright 36/36 on the Neon `e2e` branch (15 min); production build created `BUILD_ID`. Production `BankTransaction` was checked again before deploy: 0 rows.
- **Production (2026-09-30):** commit `0bf5111` live at about 11:01Z; `prisma migrate status`: 8 migrations, up to date. `POST /api/payments/sepay` now 404; `/en`, `/en/login`, `/en/orders` 200; `/en/admin/settings/payments` redirects to login with `next`; anonymous order API 401, Admin payments API 403; `/api/cron/tick` `{"ok":true,"ltcChecked":0,"reminders":0}`; `/api/payment-methods` shows bank and Litecoin (manual price 1,745,000 ₫/LTC set by the owner). "Docker checks" passed for `0bf5111`; the scheduled "Shop housekeeping" workflow has started running (a scheduled run on `6595448` succeeded).

### No device notifications; time-window note; chat opens after payment — 2026-10-01

- **Owner decisions (chat):** after a plan for web push/Discord/"incoming call" alerts, the owner dropped device notifications entirely ("customers have paid, so they will watch the site themselves"). The time dialog gets a note; customers may still change their times until an Admin books (the owner chose not to lock them). When an Admin confirms the payment, the customer's conversation appears in Admin Chat and the Admin can write first.
- **Built:** `TimeSlotsDialog` shows "Please choose carefully. After you pay and book, an Admin will pick a free time inside the windows you choose to complete the transaction. Once booked, it cannot be undone or changed." (`.slots-final-note`). `listRooms` also lists customers with a `paid`/`scheduled` order, with a `booking` tag (code + appointment start) shown in the room list and conversation header ("Paid · JH… · time not set" / "Booked · JH… · Fri 3 Oct, 19:00"); rooms sort by last message or payment time. `postPaymentMessage` (chat-store) writes "Payment received for order … We will talk with you here in this chat" from "Jewish Horse" when an Admin confirms a payment and when Litecoin is confirmed automatically, so the customer sees the Chat badge; failures are logged and never block the confirmation. On phones the full-screen Admin conversation list is no longer clipped at 220 px.
- **Verification:** TypeScript passed; Vitest 89/89; Playwright 38/38 on the Neon `e2e` branch (35 in the full run; 3 timed out while litecoinspace.org and Neon were slow and passed on rerun), including a new test: the paid customer who never wrote is listed with `booking`, the automatic "Payment received" message is there, the Admin writes first and the customer receives it, and the conversation header shows "Paid · JH… · time not set". Screens checked: time dialog at 390 px, Admin chat on desktop and 390 px. Production build created `BUILD_ID`.
- **Deploy incident:** the deploys of `b310dd9` (docs only, 2026-09-30) and `14501e0` failed with `update_failed`: on start `prisma migrate deploy` timed out on `pg_advisory_lock` (P1002) through the Neon pooler, so the live site stayed on `0bf5111`. `scripts/start-container.mjs` now sets `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` when `DATABASE_URL` is a `-pooler` host (Render runs one instance) and retries migrations up to 3 times, 5 s apart. Neon's direct host could not be tested from this machine (it only resolved to IPv6 here), so it was not used.
- **Production (2026-10-01):** commit `6d9fb27` deployed as `dep-dauui1e417fc73fp0tu0`, live at 05:02:51Z. The order page bundle contains the new note; `/en`, `/en/orders` 200; `/en/admin/chat` redirects to login with `next`; anonymous `/api/chat` 401; `/api/cron/tick` ok. "Docker checks" passed for `6d9fb27`.

### Settings card heading overflow — 2026-10-01

- **Owner report (screenshot):** on Admin → Settings the "Announcements" heading ran out of its card on a ~1560 px wide screen. Card headings in `.settings-grid` are now 24 px (cards keep the same width on every desktop size) with `overflow-wrap: break-word`; checked at 1560, 1440, 1280, 1024 and 390 px.
- **Owner question:** publishing the Google OAuth app is done once by the owner of the Google Cloud project; the other Admins do not verify anything. Their Gmail addresses are only needed later, to add them in Settings → Admins.

### Google OAuth client moved to project "hello"; Gmail connected — 2026-10-01

- The owner published project **hello** (`hello-510108`, number `351045338738`), but the live site still used a client from another Google Cloud project (number `984018544527`, still in Testing, probably created with another Google account), so Connect Gmail failed with "Error 403: access_denied". The owner created a new Web client in `hello` (redirect URIs: production and `http://localhost:3000` callbacks), enabled the Gmail API there and replaced `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` on Render. This also replaces the first secret that had been pasted into chat. Verified: `/api/auth/google/start` now redirects with `client_id=351045338738-…`.
- Gmail `mvua448@gmail.com` is connected as the shop sender; the test email to `dongthethang0210@gmail.com` was logged as `sent` at 09:41Z but landed in Gmail Spam (new sender, link to an `onrender.com` subdomain). The client secret JSON lives outside the repo in `E:\Tai_lieu_E\DONGTHETHANG\`; never commit it.

### Live exchange rates and LTC prices in the store — 2026-10-01

- **Owner request (chat):** connect an exchange-rate API so payments convert at real-time rates, and show the LTC price next to USD and VND in the shop. **Decisions:** keep VND as the base price (Admin enters VND; bank transfers pay that exact amount); each rate gets an **Automatic / Fixed** switch, Automatic by default.
- **Built:** `src/lib/exchange-rates.ts` replaces `store-settings.ts` and `ltc-rate.ts`. VND/USD comes from currency-api (jsDelivr, then `currency-api.pages.dev`; the providers publish daily, cached 30 min); VND/LTC from Coinbase `LTC-VND` spot, then CoinGecko, Kraken LTC/USD and Binance LTC/USDT × VND/USD (cached 60 s). Coinbase goes first because Render runs in Oregon: right after the first deploy, production fell back to the fixed price (Binance refuses US addresses and CoinGecko apparently refused the Render server). Stale values are served while a refresh runs in the background; failures are retried at most every 2 min; out-of-range answers are rejected (`exchange-rate-rules.ts`, unit-tested). Orders lock an LTC price at most a minute old. Settings keys: `vndPerUsdMode`/`ltcRateMode` (absent = auto) and the existing `vndPerUsd`/`ltcVndOverride`, which now hold the fixed value, also used as the fallback in Automatic mode. **Effect on production:** the manual 1,745,000 ₫/LTC that used to override the market becomes the fallback, so the live price applies after deploy. `/api/catalog` returns `vndPerLtc` while an LTC wallet is active; `Price` shows "≈ 0.1493 LTC" on product cards, the product page and the cart total; checkout shows the estimate next to USD; the hero/catalog pills say "paid in VND or LTC" and the FAQ mentions Litecoin. Settings → Payments shows the rate in use with its source and time, the market rate when fixed, and radio cards for the mode. E2E runs with `EXCHANGE_RATES_OFFLINE=1` (fixed numbers only, no network).
- **Verification:** TypeScript passed; Vitest 95/95 (parsers for currency-api, Coinbase, CoinGecko, Kraken, Binance; out-of-range answers; LTC estimate format); Playwright 37/37 (36 in the full run, the first registration test timed out right after the dev server started and passed on rerun), including the Litecoin test: fixed mode requires a price (400), `/api/catalog` returns `vndPerLtc`, the store card shows "≈ 0.325 LTC", Settings shows the fixed price and the checked "Fixed" card. Local run against live APIs: currency-api 25,934 ₫/USD and CoinGecko 1,741,988 ₫/LTC. Screens checked: store cards and product page (desktop), Settings rate cards (desktop and 390 px; fixed a radio layout clash with `.admin-panel form label`). Production build created `BUILD_ID`.
- **Production (2026-10-01):** `95393f6` went live at 10:25Z with USD from currency-api (25,934) but LTC on the fallback 1,745,000; `499bd17` (Coinbase/Kraken) went live as `dep-dav7eq5g1s2s73dfntg0` at 15:10Z and `/api/payment-methods` reports `{"vndPerLtc":1735033,"source":"coinbase"}`; `/api/catalog` returns `vndPerUsd: 25934`, `vndPerLtc: 1735033`; the store cards show "≈ 0.01499 LTC" and "≈ 0.3746 LTC". "Docker checks" passed for `95393f6`.

### Charcoal theme and realtime chat (another session) — 2026-10-02

- Done in a separate session and recorded in detail in [docs/PRODUCT-POLISH.md](docs/PRODUCT-POLISH.md): charcoal/green/purple theme on the existing layout; chat shows messages instantly, retries without duplicates (`clientMessageId` → unique `requestKey`, migration `20261002120000_chat_delivery`), receives in real time over SSE (`/api/chat/events`, in-process bus, one instance), pages history, acknowledges reads only for rendered messages; catalog search/sort, per-conversation drafts and Admin quick replies (patterns taken from Medusa and Chatwoot, no code copied). Commit `e91bb92` went live as `dep-davth08ae00c73e03l1g` at 16:17Z; GitHub "Docker checks" passed (101 unit, 43 E2E, container smoke).

### Smoothness pass — 2026-10-02/03

- **Owner request (chat):** the "smooth like Medusa/Chatwoot" part of the UI had not been done. Scope agreed by the earlier request: keep every feature and the deploy flow, apply the smoothness ideas, write docs.
- **Built (details in PRODUCT-POLISH.md, section "Độ mượt giao diện — đợt 2"):** self-hosted Inter (OFL, `public/fonts`) and a `font-display: swap` face for the Minecraft font instead of two chained remote stylesheets; removed fixed-attachment backgrounds and full-screen blur filters; specific transitions instead of `transition: all`; `RouteFeedback` (top progress bar on internal link clicks + 220 ms content fade, no remount, no `loading.tsx`); skeletons (`LoadingRows`) instead of "Loading…" on 17 screens; header account remembered per tab; opaque header, signed-in header on one line from 901–1500 px (icon pills); chat widget without the duplicate title, auto-growing composer, compact image picker, readable disabled Send; entrance animations for dialogs, the chat window, the mobile menu and new messages; dark sign-in tabs. All motion respects `prefers-reduced-motion`.
- **Verification:** TypeScript; Vitest 101/101; Playwright 43/43 (42 in the full run; the header-pills test timed out while the E2E database answered slowly on `/en/workspace` and passed on rerun); production build created `BUILD_ID`. Local browser check: progress bar went `loading → done → idle`, no page errors; screenshots in `.local-cache/smooth-preview/`.
- **Production (2026-10-03):** commit `ec8bf92` live as `dep-davu6f3tqb8s73fr2np0` at 17:02:52Z (00:02 Vietnam time). `/en`, `/en/login`, `/api/health` 200; `/fonts/inter-latin.woff2` served as `font/woff2` and preloaded in the HTML; in a real browser both Inter and Minecraft loaded, the progress bar went `loading → done → idle` when opening a product, no page errors; the phone header stays opaque while scrolling (`.local-cache/smooth-preview/live-scrolled-390.png`).

### "Add to cart" opens the cart — 2026-10-03

- **Owner request (screenshot):** after "Add to cart" the product page only said "Added to cart. View cart →"; with just two packages the customer should go straight to the cart. `ProductForm` now saves the line and calls `router.push('/en/cart')` (also after "Update cart" when editing a line); the status text stays for screen readers and save failures. E2E steps that waited for the status/"View cart" link now expect the cart URL. Verified: TypeScript, Vitest 101/101, Playwright store/orders/badges specs 17/17, production build.
- **Production (2026-10-03):** `354bd71` live as `dep-davub6dg1s2s7385c61g` at 17:12:44Z. On the live site (guest, cart kept in the browser only, no order created): opening a product, filling its field and pressing "Add to cart" landed on `/en/cart` with the item listed, no page errors.

### Photo product cards and USD-first prices — 2026-10-03

- **Owner request (screenshots):** (1) the product photo was cropped to a strip with the details covering more than half of the card; the photo should be clear, with the text on a blurred "liquid glass" background so the whole photo stays visible. (2) Customer-facing prices must lead with USD; VND (what the shop receives, shown in Admin) and LTC in small type at checkout.
- **Built:** catalog cards (`.product-card.has-photo`) now show the photo across the whole card (min-height `clamp(500px, 44vw, 620px)`, 540 px on phones) with the details on a frosted panel (`backdrop-filter: blur(18px) saturate(170%)`, light tint, inner highlight, solid fallback without backdrop-filter); description clamped to two lines and the stock/field facts as small chips. Cards without a photo keep the striped placeholder. Checkout: line items, the total ("You pay by bank transfer" → `$10.00`), the "how it works" step ("Pay $10.00 (260.000 ₫)") and the bank option ("Charged as 260.000 ₫ …") lead with USD; VND and the LTC estimate are small. My orders and the order page totals also lead with USD; the payment instructions keep the exact VND amount / exact LTC amount the customer must send. Admin screens stay in VND. Also fixed the low-contrast text in the selected payment option and the spacing above "Place order".
- **Verification:** TypeScript, Vitest 101/101, Playwright store/orders/product-polish/badges specs 19/19 (the full-order test now checks `$10.00` as the checkout total with `260.000 ₫` underneath); production build. Screenshots with two public images borrowed temporarily for the E2E products (restored afterwards) in `.local-cache/card-preview/`.
- **Production (2026-10-03):** `394212a` live as `dep-davuhqojo6nc7392ui0g` at 17:26:53Z. Both live packages render as photo cards (`has-photo`) with the glass panel at 1440 and 390 px, no page errors (`.local-cache/card-preview/live-cards-1440.png`, `live-card-390.png`).

### Liquid glass across the storefront — 2026-10-03

- **Owner request (chat):** loved the frosted glass on the product cards, asked how it works and wanted it on many more parts of the site. Explained the recipe (backdrop blur + saturation, dark tint with a diagonal sheen, 1px light edge with inner highlight, soft shadow).
- **Built (details in PRODUCT-POLISH.md, "Kính mờ"):** shared glass tokens and one rule for storefront surfaces (cards, feature strip, how-it-works, hero frame and floating card, notices, footer, empty states, inbox items, pills, header pills, secondary buttons, sign-in tabs, cart undo) plus a frosted header; Admin, white chat panels, the time dialog and the chat window are excluded. Added fixed colour fields behind the page (`body::after`) so the glass has colour to pick up, and moved the page colour to `<html>` with a transparent `<body>` (the opaque body had been hiding every negative z-index layer, including the old 4% backdrop image). Solid fallbacks without `backdrop-filter` and for `prefers-reduced-transparency`.
- **Verification:** TypeScript; Playwright store/product-polish/badges/accounts 22/22; production build; screenshots in `.local-cache/glass-preview/`.
- **Production (2026-10-03):** `4cf0b49` live as `dep-davuq0gjo6nc7393a2ng` at 17:44:16Z; on the live home page the feature strip computes `backdrop-filter: blur(18px) saturate(1.7)`, the colour fields and glass header render, no page errors (`.local-cache/glass-preview/live-home-1440.png`).

### "Admin" name for customers, one-screen chat, faster switching, background editor, spam reminder — 2026-10-03

- **Owner messages (chat):** handled Render sleep with an external ping every 15 minutes (advised 10 minutes, since Render sleeps after 15 idle minutes); yes to the spam reminder; customers must see team replies as "Admin" (real names only in Admin); the chat pages (store and Admin) must fit one screen with the reply box visible; Admins should customise the faint background pictures on a drag-and-drop page; switching conversations showed ugly grey placeholders — proposed keeping messages in the browser and writing to the database only when the tab closes.
- **Answer on the proposal:** not adopted — the other side would not receive messages until the sender closes the tab, a crash or dead battery loses them, and cookies hold ~4 KB and travel with every request. Messages keep being saved immediately (sending already shows instantly); reading was made instant instead (prefetch + per-tab cache).
- **Built (details in PRODUCT-POLISH.md, section of 2026-10-03):** `forCustomer` masks team replies as "Admin" in `GET /api/chat` and the SSE stream for customers; ChatPanel sets `--chat-fit-height` from its position and re-measures on header/body resize, fonts and window resize, with compact phone headers and an inline Send button; fixed the conversation-list skeleton (it followed message loading), prefetch of the latest page for the first 8 conversations, live merge of events for loaded conversations, per-tab `sessionStorage` cache (12 conversations × 60 messages, cleared on logout); Settings → Background (`StoreSetting.backgroundScene`, `background-rules.ts`, `/api/admin/settings/background`, editor with drag-and-drop upload, draggable pictures, sliders, built-in pictures, reset) rendered by `BackgroundSceneLayers` in the storefront layout and replacing the CSS Minecraft backdrop and floating horses (default scene identical); background images are protected from image cleanup/deletion; order page reminder naming the connected Gmail sender; signed-in desktop header pills icon-only at every desktop width (with tooltips).
- **Verification:** TypeScript; Vitest 105/105 (background rules); Playwright 46/46 (44 in the full run plus the new `background-chat.spec.ts` after fixing a style regex in the new test); production build. Local browser checks: dragging a picture in the editor and saving moved it on the store; customers saw "Admin", Admin saw the real name; reply box and Send on screen for the store chat and Admin inbox at 1440 and 390 px (store chat card bottom 828/844 px); no list skeleton after switching conversations; screenshots in `.local-cache/batch-preview/`. The spam reminder needs a connected Gmail, so it was not shown locally (the E2E database has none).
- **Production (2026-10-03):** `651ff14` live as `dep-davvbtqvcj2c738phfp0` at 18:22:39Z. The live home page renders the default background scene (one backdrop, two floating pictures hidden on phones) with no page errors; `/en/admin/settings/background` and `/en/workspace` redirect to sign-in when anonymous; `/api/admin/settings/background` 403.

### No duplicate "Chat support" link — 2026-10-03

- **Owner question (screenshot):** why both a Chat pill and a "Chat support" link in the header? Both opened `/en/workspace`; the link predates the pills. The nav link is now shown only when no customer is signed in (guests and Admins); signed-in customers use the Chat pill with its unread count. Verified: TypeScript, Playwright store/badges specs 11/11, production build.
- **Production (2026-10-03):** `72367f0` live as `dep-davvi0lg1s2s73874uj0` at 18:35:31Z; `/en` 200.

### Orders/Inbox windows, glass Chat button, new "How it works" — 2026-10-03

- **Owner requests (screenshots):** rewrite the "How it works" section; drop the small header chat pill because the floating "Chat" button already exists, and make that button liquid glass; Orders and Inbox should open a small window to read while the rest of the page stays usable, and only a click on an order/notification opens the full page.
- **Built (details in PRODUCT-POLISH.md):** `header-popover.tsx` with non-modal glass windows (portal to `<body>`, positioned from the pill, closes on Escape/outside click/navigation, one open at a time); Orders shows the cart count and the 5 latest orders (USD totals), Inbox shows upcoming appointments and the 6 latest notifications with read state, "Mark all read" and per-item read on click (updates the bell count). Header chat pill removed; the floating Chat launcher (with unread badge) is glass. "How it works" copy rewritten ("Three steps. No guesswork."; Litecoin mentioned only when enabled) with each step on a small glass pane.
- **Verification:** TypeScript; Vitest 105/105; Playwright 45/45 (44 in the full run; the first registration test timed out while the dev server warmed up, as before, and passed on rerun) including new checks: Inbox window shows the booking notification and closes with Escape, an order in the Orders window opens its page, a notification opens its order; production build. Local browser check: the page still scrolls with a window open, no page errors; screenshots in `.local-cache/popover-preview/`.
- **Production (2026-10-03):** `54a98eb` live as `dep-db003oo473hc73fm2a0g` at 19:13:29Z; the live home page serves the new "Three steps" copy.

### Admin Workspace — 2026-10-03

- **Owner request (chat):** the work was too scattered across tabs; build one Admin workspace starting from the customer's payment report. "I've transferred" unlocks after 30 s (was 60 s). Ticking "I'm free right now" must immediately say an Admin may not be free and ask for at least one more time today. All Admins get the email; the first to claim handles the customer; the link goes to the workspace for that customer with the chat, the order details and a "complete transaction" button — only that button records the sale for statistics.
- **Owner decisions (questions asked):** keep the steps Take → Confirm payment & book → Complete; the extra time is required (≥1) and suggested for today, but another day is allowed (late at night); allow Release by the claimer and Take over by another Admin (confirmed, recorded in Activity).
- **Built (details in PRODUCT-POLISH.md, "Admin Workspace"):** `REPORT_DELAY_SECONDS = 30`; `ASAP_NOTICE`/`asapProblem` enforced in the time dialog and in `reportTransfer`/`updateTimes`; `claimOrder` (conditional claim), `assertHandles` (409 for confirm/schedule/complete/cancel/start-now when another Admin holds the order), `workspaceQueues`, `unclaimedCount`; admin order API actions `claim`/`release`/`take-over` and `me` in responses; `/api/admin/workspace`; `/en/admin/workspace` (Waiting / Mine / Others, refresh every 15 s) and `/en/admin/workspace/<id>` (shared `AdminOrderView` with a claim bar + `ChatPanel` locked to the customer; tabs on phones); Workspace nav tab with the unclaimed count; admin emails link to the workspace and explain claiming; claim events hidden from customers; "Complete transaction" wording; Overview revenue counts completed orders only (by completion date); `validChatCustomer` accepts reported orders so the handler can write first; admin header widened to 1520 px. **Fixed on the way:** the Admin conversation list took 200 arbitrary customers — it now takes the 200 most recent conversations (plus customers with a paid order), which had hidden the newest conversation once the E2E database passed 200 rooms.
- **Verification:** TypeScript; Vitest 105/105; Playwright 46/46 in three groups (17 + 13 + 16; the full-order test needed a rerun after the dev server's first compile of the new view; an earlier single run was cut off by the 10-minute tool limit and showed a network suspension, unrelated) including the new `workspace.spec.ts` (30 s guard, free-now alone refused, take from the queue, chat in the workspace with the customer seeing "Admin", 409 while another Admin holds the order, Take over, confirm without revenue, Complete adds exactly one sale, claim events hidden); production build. Local screenshots in `.local-cache/workspace-preview/` (queues, desktop detail, phone order/chat tabs, time dialog with the notice).
- **Production (2026-10-03):** `c27c3a9` live as `dep-db06mmrtqb8s7384pqs0` at 02:43:20Z (no migration). `/en` 200; `/en/admin/workspace` and `/en/admin/workspace/<id>` redirect to sign-in with `next` when anonymous; `/api/admin/workspace` and `/api/admin/counts` 403.
### Conversion batch: Online button, time before paying, USDT (TRC20), amount slider, Discord sign-in — 2026-10-03

- **Owner answers to the marketing analysis (chat + questions):** keep the catalog and the 2 combos and add a slider for any amount, configurable in Admin Settings; coin stock is unlimited; customers are mostly abroad — Google Pay / Apple Pay are not possible for this shop (explained), so add **USDT on TRON (TRC20)** sent to the shop's T… address; sign-in with Discord (or Google, or email); every Admin gets a big **Online** button so customers can "Trade now", switched off **only by hand**; customers choose **Trade now / a time before paying**; no Discord bot, no commissions; no mention of Hypixel bans on the site; brand/name/banner stay as set in Admin (not touched); improve on the current look rather than redesign. **Guest checkout is still open** (owner: "cần bàn thêm") — options explained in chat, nothing built.
- **Built (details in PRODUCT-POLISH.md, "Đợt tăng chuyển đổi"):**
  - *Online:* `StoreSetting.adminAvailability` (`src/lib/availability.ts`), `GET /api/availability` (count only), `GET/POST /api/admin/availability` (audited), `AvailabilityToggle` in the Admin header, `LiveStatus` pill on the home hero and product page, `useOnlineAdmins()` (30 s polling).
  - *Time before paying:* checkout section "When do you want to trade?" (Trade now only while someone is online, plus the required backup time; or Schedule), shared `time-picker.tsx` (also used by the old dialog), `POST /api/orders` accepts `timing` (`timingSchema`), `createOrder` validates and stores slots/asap/time zone, `reportSchema.slots` optional — "I've paid" reports at once with the stored times (orders without times still get the dialog); the pay card lists the chosen times.
  - *USDT:* wallets have a network (`LTC`/`TRC20`, TRON Base58Check validated, Tronscan links, plain-address test QR); payment method `usdt` (amount = USD price at the store rate plus the smallest free cent per open order on the address, `src/lib/usdt.ts`); automatic detection of confirmed USDT transfers through TronGrid (`checkCryptoOrder`/`checkOpenCryptoOrders`, optional `TRONGRID_API_KEY`); order page with network warning, TXID field, Tronscan links; admin view, workspace cards and emails name the coin and network; payment methods API returns `usdt`; home/FAQ copy lists the enabled currencies.
  - *Amount slider:* `StoreSetting.amountSlider` (`amount-slider-rules.ts`, `amount-slider.ts`), Settings → Amount slider (`/en/admin/settings/slider`, `/api/admin/settings/slider`), glass card above the packages (range, exact number, presets, delivery fields, live USD/VND/LTC price, Buy → cart as that package × amount ÷ *one package holds*, so the live 100M package sells 100M, 200M, …), optional hiding of that package from the grid; stock ≥ 1,000,000 reads "Always in stock".
  - *Discord:* migration `20261003090000_discord_login` (`Customer.discordId` unique, `discordUsername`), `/api/auth/discord/start|callback` (scopes identify+email, verified email required, links by email like Google, Admin emails refused), login button when `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` are set, Discord shown in Admin order/customer pages and sign-in filters.
  - Footer line no longer says bank transfer only. **Test fix:** the Litecoin E2E built its address from `Date.now() % 256`, so it collided with wallets left by earlier runs; it now uses random bytes.
- **Verification:** TypeScript; Vitest 116/116 (new `conversion.test.ts`, Discord linking, USDT); Playwright 50/50 in groups (16 + 17 + 13 + new `conversion.spec.ts` 4; the full-order test hit the known first-test cart flake after the dev server start and passed on rerun, the Litecoin test passed after the address fix): Online button → store and checkout show it, Trade now order keeps asap + backup time, offline disables it; USDT wallet validation, $10.00 / $10.01 amounts, network warning, direct report; slider settings and purchase; Discord hidden until configured. Production build. Screenshots checked (home hero, slider desktop/phone, checkout, USDT order page, Admin header).
- **Production (2026-10-03):** `47377a0` live as `dep-db0aph3tqb8s7387nrr0` at 07:23:05Z (migration `20261003090000_discord_login` applied on start), then the slider "one package holds" follow-up `a757b6f` live as `dep-db0at3ff3r2c73asn60g` at 07:30:11Z. Live checks: `/en` 200 with the Online status pill, new hero/FAQ copy and footer; `/api/availability` → `{"online":0}`; `/api/payment-methods` → `usdt:false` (no TRON wallet yet); `/api/auth/providers` → `discord:false`; `/api/auth/discord/start` → login with `discord_not_configured`; `/api/admin/availability` and `/api/admin/settings/slider` 403; `/en/admin/settings/slider` redirects to sign-in. Slider is off until the owner sets it up (live 100M package: one package holds 100 M coins).
### One-page buying: quick buy box, sign-in inside checkout, real trades, Buy again — 2026-10-03

- **Owner feedback (chat):** "we decided lots of things — is it all done? it looks the same and is still hard to use." Checked against the agreed phase 1 of the marketing plan: the earlier batch had shipped features that stay off until configured (slider, USDT wallet, Discord) and had not built the one-page buy flow, the in-checkout sign-in, the real trades line, the `/buy/100m` rebuy link, "Buy again" or the "price locked" line.
- **Built (details in PRODUCT-POLISH.md, "Mua một trang"):**
  - *Quick buy box* (`src/components/quick-buy.tsx`) at the top of the buy section, which now sits right under the hero (hero button "Buy now →" jumps to it): choose **Any amount** (slider) or one of the packages (chips with USD price), a quantity stepper for packages, delivery fields, live USD/VND/LTC price; **Buy now goes straight to checkout** with exactly that item (no product page, no cart). Package cards say "Buy <package> →"; search/sort/in-stock tools only appear with more than 4 packages.
  - *Automatic slider*: until an Admin saves one, `autoSlider` uses the smallest package whose name starts with an amount ("100M · …" → one package holds 100 M coins, 100M–10B in 100M steps, start 300M); amounts read the way players write them ("1.5B coins"). Settings → Amount slider shows the automatic setup with a note until it is saved. `getSavedAmountSlider`/`storeAmountSlider` replace `getAmountSlider`.
  - *Stock*: customers see "Available" / "Out of stock", never a count.
  - *Checkout*: the "How it works" card is replaced by one line; steps are 01 When, 02 Payment, 03 Account. Signed-out customers **sign in or create an account inside checkout** (`src/components/checkout-sign-in.tsx`: Discord/Google buttons when configured, or "New here" / "I have an account" with email), keeping the chosen time; the header refreshes through a `jh-account-changed` event. Place order stays disabled until signed in, with a link to step 03.
  - *Product page*: "Buy now →" (checkout with just this item) above "Add to cart".
  - *Order page*: "Price locked · pay within mm:ss"; **Buy again** on every order that is no longer waiting for payment (same packages by SKU at today's price, same delivery details → checkout).
  - *Short links* `/en/buy/<slug or SKU>` (e.g. `/en/buy/100m`) open that package; unknown names go to the buy box.
  - *Trust line*: `getTradeStats` (`src/lib/trade-stats.ts`, 60 s cache) — count of completed trades and the latest three ("300M delivered · 12 min ago"), no names; hidden while there are none (`TradeFeed`).
  - **Fixed:** the catalog loader in the browser gave up after 5 s and fell back to the demo list, so right after the database woke up "Add to cart" refused real packages ("Unable to save the cart on this device" — also the cause of the earlier "flaky" full-order test). It now waits 12 s and retries twice before falling back.
- **Verification:** TypeScript; Vitest 119/119 (amount parsing, unit formatting, automatic slider, stock text); Playwright 51/51 (13 + 25 + 13): quick buy → checkout, sign-in inside checkout, sign-up inside checkout keeping the time, Buy again, `/en/buy/…`, trades line, small catalog without search tools, slider "200M coins" → 2 packages → checkout; the full-order test passed first time. Production build. Screenshots checked (buy box desktop/phone, signed-out checkout).
- **Production (2026-10-03):** `d6f87f6` live as `dep-db0bf43m8hqs73cu47tg` at 08:08:41Z, then round quick-pick amounts (`sliderPresets`: smallest, ×1/×5 round numbers, largest) `32319e4` live as `dep-db0bia2vcj2c73952brg` at 08:15:23Z. Live checks (Edge against https://jewish-horse.onrender.com): the buy box shows the automatic slider from the live 100M package (300M = $11.07, quick picks 100M / 500M / 1B / 5B / 9.9B — 9.9B because that package has 99 in stock), the 1B chip at $34.97, Buy now opens checkout with the sign-in box inside (0.3 s) and Place order disabled until signed in; `/en/buy/100m` → the 100M product page; no page errors. No trades line yet (no completed orders on production).
### Online pill in the header, attention-grabbing bell with sound — 2026-10-03

- **Owner request (screenshots):** make the "Online now" status big, wide and prominent in the header; when a notification arrives the bell must clearly catch the customer's attention, with a notification sound.
- **Built:** `HeaderLiveStatus` (`src/components/availability.tsx`) in the store header on every page, linking to the buy box: a large glowing green pill "Online now · N trader(s) ready · Trade now →" (pulsing dot) while an Admin is online, a small amber "Away · Order now · pick a time" otherwise; the subtitle hides between 901 and 1280 px; on phones it is a full-width row under the brand. It replaces the hero and product-page status pills (`LiveStatus` removed). Inbox bell: amber with a pulsing badge while anything is unread; when the unread count rises the bell shakes and glows for 4 s, a two-note chime plays (`src/lib/notify-sound.ts`, Web Audio, no file; browsers allow sound only after the visitor has clicked or typed on the page) and a glass pop-up under the header shows the new notification (click opens it and marks it read, × dismisses, hides after 12 s; above the Chat button on phones). The tab title shows "(N)" while notifications are unread. "🔔 Sound on / 🔕 Sound off" in the Inbox window (kept in the browser). The header now checks every 20 s, also in background tabs (browsers slow that to about once a minute). Reduced-motion turns the animations off.
- **Verification:** TypeScript; Vitest 120/120; Playwright header/store/badges/conversion specs 17/17 including the new bell test (a notification created while the page is open → pop-up, ringing amber bell, "(1)" in the title, click opens the Inbox and clears the count); production build; screenshots at 1440, 1100 and 390 px (signed in and guest).
- **Production (2026-10-03):** `eaf48b2` live as `dep-db0bveuq1p3s73e6jcg0` at 08:43:26Z. Live check (Edge): the header pill renders on the home page ("Away · Order now · pick a time" — no Admin online at that moment), no page errors.

### PayPal, SkyBlock accounts shelf, phone chat sheet — 2026-10-11

- **Owner request:** pay with PayPal (PayPal.me link + QR, confirmed by hand); sell Hypixel SkyBlock accounts one by one with SkyCrypt-like stats from the Hypixel API, delivered automatically; stop the phone keyboard from pushing the whole site up while chatting. Plan: `docs/specs/2026-10-10-paypal-skyblock-accounts-plan.md`.
- **PayPal (phase A):** `src/lib/paypal.ts` (link, fee, per-order cents via shared `unique-cents.ts`), `paypal-settings.ts`, `PaymentMethod` now lives in `order-rules.ts` with `paymentKind(order)` (decides bank/crypto/PayPal by method, not snapshot shape), Admin card with Test QR, `adminPaymentReported` takes a general `payment`. Commit `024f7c0` (pushed 2026-10-11).
- **Phone chat (`ac4b2aa`):** `ChatPanel` becomes a fixed full-screen sheet at <=700 px (`.chat-fullscreen`, sized to `visualViewport`, page scroll locked, back arrow via `backHref`/`onBack`); the floating widget already worked this way.
- **Accounts data (phase B):** migration `20261011010000_skyblock_accounts` (`GameAccount`, `OrderItem.kind/accountId/deliveredSecretEnc/deliveredAt`, `Order.needsAppointment`). Logins sealed with AES-256-GCM (`secret-box.ts`, `account-vault.ts`, HKDF info `game-account-login`). Status rules in `account-rules.ts`.
- **Stats (phase C):** `skyblock-stats.ts` (pure snapshot: level, 12 skills from Hypixel's public skills table, average over 10 skills, gear/set/bonus from lore), `skyblock-fetch.ts` (Mojang + Hypixel, `skyhelper-networth` and `prismarine-nbt` loaded only here, key never leaves the server, 429/low-remaining stop), refresh from `runHousekeeping`. Tests use `tests/fixtures/skyblock-profile.json`, which is SYNTHETIC (made-up numbers matching the screenshot: level 138, Farming 45, average 30.30); replace with a trimmed real profile once a Hypixel key and the sample IGN exist.
- **Admin (phase D):** `/en/admin/accounts` (list, new, edit with preview, manual stats editor, screenshots, Reveal/Replace login), Settings → SkyBlock accounts (shelf words, key Save/Test/Remove, refresh interval, fairy souls total).
- **Store (phase E):** catalog keeps `products` = packages and adds `accounts` + `shelf` (`purchasable` = both, used by cart/checkout/orders); two tabs on the home page (`?shelf=accounts` / `#accounts`), `AccountCardTile`, `/en/accounts/[code]` and `GET /api/accounts/[code]` (public data only; IGN only with Show IGN).
- **Orders (phase F):** `createOrder` reserves each account atomically in the order's transaction; accounts-only orders skip times (`needsAppointment=false`), checkout drops "01 / WHEN"; `deliverAccounts` runs inside both `confirmPayment` and `markPaidAutomatically`, completes accounts-only orders at once; expiry/cancel return undelivered accounts to sale, delivered ones go Hidden; customer sees the login on the order page (`accounts_viewed` event once); Admin Reveal on the order is audited without the text.
- **Verification:** TypeScript clean; Vitest 189/189; Playwright `paypal-accounts`, `skyblock-accounts` (5), `chat-sheet` green on the Neon E2E branch. Known flake: the full suite is slow on this machine (dev server compiles routes on demand); runs of `conversion`/`store`/`workspace` alone pass, and the USDT test can fail if a previous aborted run left open USDT orders holding the 10.00/10.01 amounts (they expire after 30 minutes).
- **Not verified live:** Hypixel calls (no API key yet), PayPal.me amount-in-link behaviour (use Test QR), networth numbers against SkyCrypt, Farming/Taming caps beyond Farming's Jacob perk.

