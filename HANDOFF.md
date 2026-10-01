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
- **Built:** `src/lib/exchange-rates.ts` replaces `store-settings.ts` and `ltc-rate.ts`. VND/USD comes from currency-api (jsDelivr, then `currency-api.pages.dev`; the providers publish daily, cached 30 min); VND/LTC from CoinGecko, then Binance LTC/USDT × VND/USD (cached 60 s). Stale values are served while a refresh runs in the background; failures are retried at most every 2 min; out-of-range answers are rejected (`exchange-rate-rules.ts`, unit-tested). Orders lock an LTC price at most a minute old. Settings keys: `vndPerUsdMode`/`ltcRateMode` (absent = auto) and the existing `vndPerUsd`/`ltcVndOverride`, which now hold the fixed value, also used as the fallback in Automatic mode. **Effect on production:** the manual 1,745,000 ₫/LTC that used to override the market becomes the fallback, so the live price applies after deploy. `/api/catalog` returns `vndPerLtc` while an LTC wallet is active; `Price` shows "≈ 0.1493 LTC" on product cards, the product page and the cart total; checkout shows the estimate next to USD; the hero/catalog pills say "paid in VND or LTC" and the FAQ mentions Litecoin. Settings → Payments shows the rate in use with its source and time, the market rate when fixed, and radio cards for the mode. E2E runs with `EXCHANGE_RATES_OFFLINE=1` (fixed numbers only, no network).
