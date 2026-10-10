# Kế hoạch: thanh toán PayPal + gian bán tài khoản Hypixel SkyBlock

Ngày: 2026-10-10. Trạng thái: đã chốt với chủ shop, chưa sửa code. Người thực hiện: Claude Sonnet 5.5.

## 0. Cách làm việc (đọc trước khi code)

- Làm theo thứ tự phase A → G. Phase A (PayPal) độc lập, có thể deploy trước. Mỗi phase xong phải chạy
  `npm run typecheck` + `npm test`. Chưa có kết quả thì chưa coi là xong.
- **Hỏi chủ shop ngay** (bằng tiếng Việt, dễ hiểu, không giả định họ biết code) khi gặp quyết định nghiệp vụ chưa có
  trong tài liệu này. Không tự đoán giá, chính sách hoàn tiền hay câu chữ pháp lý.
- Giao diện khách và Admin: **tiếng Anh**, giống phần còn lại của site. Báo cáo cho chủ shop: tiếng Việt.
- Viết code giống code xung quanh: dòng dài kiểu one-liner, comment ngắn giải thích "tại sao", Zod cho mọi input,
  `sameOrigin` + `getSession()` cho mọi POST Admin, `recordAudit` cho mọi thao tác Admin, `Cache-Control: no-store`.
- Thêm dependency: **bắt buộc dùng npm 10 đi kèm repo**:
  `node .local-cache/tools/node-v22.20.0-win-x64/node_modules/npm/bin/npm-cli.js install <pkg>`, rồi kiểm tra
  `npm ci --dry-run` bằng cùng npm đó. npm 11 từng làm hỏng build Docker trên Render.
- Lệnh nào mở kết nối PostgreSQL (Prisma, `db:status`, Playwright E2E) phải chạy bằng **PowerShell**. Sandbox của Bash
  chặn mạng của Prisma. Không bao giờ chạy `prisma migrate reset`/`db push` và không lách cơ chế chặn reset của Prisma.
- Migration viết tay trong `prisma/migrations/<timestamp>_<tên>/migration.sql`. Kiểm tra bằng
  `prisma migrate diff --from-schema-datamodel <schema cũ> --to-schema-datamodel prisma/schema.prisma --script`
  (lưu schema cũ ra scratchpad bằng `git show HEAD:prisma/schema.prisma`). Render tự chạy `migrate deploy` khi khởi động.
- Không commit, push hay deploy khi chủ shop chưa đồng ý. Deploy = `git push origin main`, Render tự build.
- Không sao chép code hoặc bảng hằng số từ SkyCrypt: repo đó dùng giấy phép **AGPLv3**. Chỉ dùng API chính thức của
  Hypixel, thư viện MIT (mục C.2) và số liệu công khai.

### File cần đọc trước

```text
prisma/schema.prisma
src/lib/order-store.ts            createOrder, confirmPayment, cancel/expire, customerOrder
src/lib/order-rules.ts            CRYPTO_METHODS, statuses, reportSchema, generateOrderCode
src/lib/order-stock.ts            restockItems, reReserveItems
src/lib/payment-detection.ts      markPaidAutomatically
src/lib/usdt.ts                   usdtAmount (cent riêng cho mỗi đơn)
src/lib/catalog.ts, catalog-server.ts, cart.ts
src/lib/mailer.ts                 mẫu mã hóa AES-256-GCM + HKDF từ AUTH_SECRET
src/lib/housekeeping.ts           chạy định kỳ qua /api/cron/tick
src/app/api/orders/route.ts, src/app/api/orders/[code]/route.ts, src/app/api/payment-methods/route.ts
src/app/api/admin/settings/payments/route.ts, src/app/[locale]/admin/settings/payments/page.tsx
src/app/[locale]/checkout/page.tsx, src/app/[locale]/orders/[code]/page.tsx
src/components/store-ui.tsx (Catalog), src/components/admin-order-view.tsx, src/components/admin-nav.tsx
src/app/api/admin/products/route.ts, src/app/api/admin/product-images/route.ts (upload ảnh để tái dùng)
src/lib/email-templates.ts, src/lib/chat-store.ts (postPaymentMessage)
```

## 1. Quyết định đã chốt với chủ shop

| Hạng mục | Quyết định |
| --- | --- |
| PayPal | Link **PayPal.me** + mã QR, số USD điền sẵn. Mỗi đơn có số cent riêng để đối chiếu. **Admin xác nhận tay**, giống chuyển khoản ngân hàng. Không dùng PayPal API, không cần env mới. |
| Hàng mới | Tài khoản **Hypixel SkyBlock** (farming). **Mỗi acc là một món riêng**: giá, ảnh, thông số riêng, số lượng luôn = 1. |
| Thông số acc | Admin nhập IGN → server gọi **Hypixel API** (key do Admin dán trong trang Admin) → tự điền thông số. Admin sửa tay được. Tự làm mới định kỳ. Không có key thì vẫn nhập tay được. |
| Hiển thị thông số | Khách luôn thấy **đủ như SkyCrypt** (xem mục C.3): level, 12 skill có thanh XP, purse, bank, average skill, fairy souls, networth, armor/equipment. |
| IGN | **Tùy chọn cho từng acc** (công tắc `Show IGN`). Bật thì hiện IGN + nút "View on SkyCrypt" + "Elite". Tắt thì IGN chỉ giao kèm thông tin đăng nhập. |
| Giao hàng | **Tự động**: Admin nạp sẵn thông tin đăng nhập (mã hóa trong DB). Khi tiền được xác nhận (tay hoặc tự động), web gán acc cho đơn và hiện trên trang đơn. Email chỉ báo "đã giao", **không chứa mật khẩu**. Đơn chỉ có acc thì **bỏ bước chọn giờ hẹn**. |
| Vị trí | Trang chủ, catalog có **2 tab**: "Packages" và "SkyBlock accounts". Admin đổi được nhãn tab. |
| Cấu hình | Mọi thứ chỉnh trong trang Admin: PayPal, Hypixel key, chữ của gian hàng, từng acc. |

## 2. Hiện trạng code (những điểm sẽ chạm)

- `PaymentMethod = 'bank' | 'ltc' | 'usdt'` lặp lại ở `order-store.ts`, `orders/route.ts` (z.enum), `checkout/page.tsx`,
  `orders/[code]/page.tsx`, `admin-order-view.tsx`, `admin-workspace.tsx`.
- `Order.bankSnapshot` (Json) chứa bản chụp nơi nhận tiền. Code đang phân biệt bằng hình dạng: `'address' in snapshot`
  nghĩa là crypto, còn lại là ngân hàng. Thêm PayPal thì cách này sai, **phải chuyển sang phân biệt theo `paymentMethod`**.
- `Order.cryptoAmount` (string) đang giữ số tiền chính xác phải gửi. `createOrder` tìm các đơn mở cùng phương thức để
  chọn số cent không trùng (`usdtAmount`).
- Kho hàng: `Package.stockOnHand`. Đơn giữ hàng 30 phút (`HOLD_MINUTES`). Hết hạn/hủy thì `restockItems`, thanh toán
  muộn thì `reReserveItems`.
- Thanh toán được xác nhận ở 2 nơi: `confirmPayment` (Admin) và `markPaidAutomatically` (blockchain). Cả hai gọi
  `grantPaidOrderSpin`, `postPaymentMessage` và gửi email.
- Catalog công khai (`getPublicCatalog`) trả về `CatalogProduct[]`. Mỗi package là một dòng có `stock` và `fields`.
  Giỏ hàng lưu `{productId, quantity, delivery}` trên thiết bị.

---

## Phase A — PayPal (PayPal.me + QR, xác nhận tay)

### A.1 Cài đặt (StoreSetting, không cần migration)

`src/lib/paypal.ts` (thuần, không import Prisma, có unit test) và `src/lib/paypal-settings.ts` (server-only, đọc/ghi
`StoreSetting` key `paypal`, cache giống `amount-slider.ts`):

```ts
type PaypalSettings = {
  enabled: boolean;
  username: string;          // tên PayPal.me, /^[A-Za-z0-9]{1,20}$/
  email: string | null;      // tùy chọn, hiện cho khách muốn gửi tay
  feePercent: number;        // 0–15, mặc định 0 (phụ phí cộng vào đơn PayPal)
  feeFixedCents: number;     // 0–500, mặc định 0
  instructions: string;      // ≤ 500 ký tự, hiện trên trang đơn (vd. "Send as Friends & Family")
};
```

Hàm thuần:
- `paypalMeLink(username, amount)` → `https://paypal.me/${username}/${amount}USD`. **Cần xác minh** PayPal còn nhận
  số tiền trên đường dẫn: mở link thật bằng nút Test QR (mục A.5). Nếu PayPal bỏ số tiền thì vẫn dùng link + dặn khách
  gõ đúng số.
- `paypalAmount(totalVnd, vndPerUsd, fees, taken: Set<string>)`: base = ceil(totalVnd·100 / vndPerUsd) cent; cộng phí
  = ceil(base·feePercent/100) + feeFixedCents; rồi cộng thêm số cent nhỏ nhất (0–99) chưa có đơn PayPal mở nào dùng.
  Trả về `"12.34"`.
- Tách phần "cộng cent nhỏ nhất chưa dùng" của `usdtAmount` ra helper chung `uniqueCents(baseCents, taken)`
  (vd. `src/lib/unique-cents.ts`) cho cả USDT và PayPal dùng. `tests/unit/usdt.test.ts` phải vẫn xanh.

### A.2 Đơn hàng

- `PaymentMethod` thêm `'paypal'`. Gom kiểu này về một chỗ (`order-rules.ts`: `PAYMENT_METHODS`) và cập nhật mọi nơi
  liệt kê ở mục 2, kể cả `z.enum` trong `src/app/api/orders/route.ts`.
- Snapshot PayPal trong `bankSnapshot`: `{paypalMe: string; email: string | null; instructions: string}`. Thêm helper
  `paymentKind(order)`: `'bank' | 'crypto' | 'paypal'` theo `paymentMethod` và thay **mọi** chỗ `'address' in ...`
  (route `orders/[code]`, trang đơn khách, `admin-order-view.tsx`, `cryptoMail` trong `order-store.ts`).
- `createOrder(method='paypal')`: settings tắt hoặc thiếu username thì báo lỗi 503 kiểu USDT ("PayPal payments are
  not set up yet…"). Số tiền lưu vào `cryptoAmount` (cột này chứa "số tiền chính xác phải gửi", ghi comment ở
  schema), `cryptoRateVnd = vndPerUsd`. Đơn mở dùng để chống trùng cent là các đơn `paymentMethod: 'paypal'`,
  trạng thái `awaiting_payment`/`payment_reported`.
- `isCrypto('paypal')` phải là false. PayPal không tự dò thanh toán, nên không vào `checkOpenCryptoOrders`.
- `reportSchema`: thêm `paypalTxid` tùy chọn, `/^[A-Z0-9]{17}$/` (mã giao dịch PayPal 17 ký tự). Lưu vào
  `customerTxid` **giữ chữ hoa** (txid crypto vẫn lowercase như cũ). Không tạo link explorer cho PayPal.

### A.3 API

- `GET /api/payment-methods`: thêm `paypal: {feePercent, feeFixedCents} | null` (null khi tắt).
- `GET /api/orders/[code]`: với PayPal đang `awaiting_payment`, `paymentUri = paypalMeLink(...)`, `qrSvg` = QR của link
  đó (dùng `QRCode.toString` như hiện tại).
- `src/lib/catalog-server.ts`: thêm `paypalCheckout()` giống `usdtCheckout()` cho chữ trên trang chủ.

### A.4 Giao diện khách

- Checkout (`checkout/page.tsx`): thêm lựa chọn **"PayPal · USD"**, mô tả "Send {amount} with PayPal · QR code on the
  next page". Khi phí > 0 thì ghi rõ "includes {x}% PayPal fee". Phần tổng bên phải hiện số USD gồm phí khi chọn PayPal.
  `noMethod` phải tính cả PayPal. Thứ tự mặc định giữ nguyên (ngân hàng nếu có).
- Trang đơn (`orders/[code]/page.tsx`), nhánh PayPal: QR (chú thích "Scan with your phone camera to open PayPal"), nút
  **"Open PayPal"** (`paymentUri`), các dòng Copy: Amount (USD), PayPal.me, PayPal email (nếu có), Order code. Cảnh báo:
  "Send exactly {amount} USD and write **{code}** in the note: the cents identify your order." Hiện `instructions`
  của Admin. Ô "PayPal transaction ID (optional)". Nút "I've paid with PayPal →" vẫn khóa 30 giây như cũ.
- Tổng bên phải: "paid as {amount} USD via PayPal" (đừng rơi về nhãn mặc định "LTC").
- Trang chủ (`[locale]/page.tsx`): danh sách tiền tệ ("pay in VND, USDT or …") và FAQ "How do I pay?" thêm PayPal khi bật.

### A.5 Admin

- Settings → Payments: thêm card **PayPal**: bật/tắt, PayPal.me username, email, phí %, phí cố định (USD), hướng dẫn,
  nút **Test QR** ($1.00) hiện QR + link mở thử. Viết thêm action vào `api/admin/settings/payments/route.ts`
  (`save-paypal`, `test-paypal-qr`) + audit `settings.paypal`. Sửa câu giới thiệu đầu trang cho có PayPal.
- `admin-order-view.tsx`: Method "PayPal", Expected "{amount} USD to paypal.me/{user}", TXID khách gửi (nếu có),
  hướng dẫn "Check PayPal for exactly {amount} USD with note {code}". Form xác nhận giữ nguyên (VND nhận được,
  mặc định = tổng đơn).
- `admin-workspace.tsx`: nhãn " · PayPal".
- Email `adminPaymentReported`: thay tham số `crypto` bằng mô tả phương thức tổng quát để email Admin ghi đúng
  "PayPal {amount} USD".

### A.6 Kiểm thử phase A

- Unit `tests/unit/paypal.test.ts`: link, username hợp lệ/không hợp lệ, tính phí, chống trùng cent, làm tròn lên.
- Chạy lại toàn bộ unit test. E2E ở phase G.

---

## Phase B — Mô hình dữ liệu tài khoản game

Một migration, ví dụ `20261010120000_skyblock_accounts`:

```prisma
// One Hypixel SkyBlock account for sale. Exactly one unit; login details are encrypted at rest.
model GameAccount {
  id             String    @id @default(cuid())
  code           String    @unique            // public code "SB" + 6 ký tự, dùng trong URL /en/accounts/{code}
  ign            String                       // tên trong game lúc fetch gần nhất
  uuid           String?                      // Mojang UUID (không đổi khi đổi tên)
  profileId      String?                      // SkyBlock profile được chọn
  profileName    String?                      // cute name, vd. "Mango"
  showIgn        Boolean   @default(false)
  title          String
  description    String    @default("")
  priceVnd       Int
  salePriceVnd   Int?
  status         String    @default("draft")  // draft | available | reserved | sold | hidden
  sortOrder      Int       @default(0)
  imagePaths     Json      @default("[]")     // ảnh chụp thêm: "/api/product-images/<id>"
  stats          Json?                        // AccountStats (mục C.3)
  statsSource    String    @default("manual") // hypixel | manual
  statsLocked    Boolean   @default(false)    // Admin sửa tay → không tự làm mới
  statsFetchedAt DateTime?
  statsError     String?
  secretEnc      String                       // thông tin đăng nhập, AES-256-GCM
  orderId        String?
  reservedAt     DateTime?
  soldAt         DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([status, sortOrder])
  @@index([orderId])
  @@index([statsFetchedAt])
}
```

`OrderItem` thêm cột:
- `kind String @default("package")`: `package` | `account`.
- `accountId String?`.
- `deliveredSecretEnc String?`: bản sao thông tin đăng nhập lúc giao. Đơn giữ bản này dù Admin sửa/xóa acc sau đó.
- `deliveredAt DateTime?`.

Với dòng account, `packageId` chứa id account (cột không có FK). **Mọi chỗ dùng `packageId` phải rẽ nhánh theo `kind`.**

`Order` thêm `needsAppointment Boolean @default(true)`. Đặt false khi mọi dòng đều là account.

Mã hóa: `src/lib/account-vault.ts` (server-only), làm giống `mailer.ts` nhưng `info` HKDF riêng
(`'game-account-login'`). Ghi rõ trong comment và DEPLOYMENT.md: **đổi `AUTH_SECRET` sẽ làm mất toàn bộ thông tin
đăng nhập đã lưu**. Trước khi đổi phải xuất ra (nút Reveal trong Admin).

Trạng thái acc (`src/lib/account-rules.ts`, thuần, có unit test):
- `draft` (chưa bán) ↔ `available` (đang bán) ↔ `hidden` (Admin ẩn): Admin đổi tự do.
- `available` → `reserved`: khi đặt đơn (atomic `updateMany where status='available'`).
- `reserved` → `available`: đơn hết hạn hoặc bị hủy **trước khi giao**.
- `reserved` → `sold`: khi giao (tiền được xác nhận).
- Hủy đơn **sau khi đã giao** (đơn hỗn hợp, xem F.4) → `hidden`. Ghi chú nội bộ "Login details were revealed; change
  the password before relisting". Không bao giờ tự đưa acc đã lộ thông tin về `available`.
- `sold`/`reserved` không xóa được. Chỉ xóa khi chưa từng nằm trong đơn nào.

---

## Phase C — Lấy thông số từ Hypixel

### C.1 Cài đặt Admin (StoreSetting key `hypixel`, `accounts-shelf`)

- `hypixel`: `{apiKeyEnc: string | null, autoRefreshHours: 0 | 6 | 12 | 24 (mặc định 12), fairySoulsTotal: number (mặc định 289)}`.
  Key mã hóa giống B. **Key không bao giờ được gửi xuống trình duyệt.** Admin chỉ thấy 4 ký tự cuối, các nút
  Save / Test / Remove. Test = gọi 1 request rồi báo còn bao nhiêu lượt (header `RateLimit-Remaining`).
- `accounts-shelf`: `{enabled, packagesTabLabel: 'Packages', accountsTabLabel: 'SkyBlock accounts', heading, intro, showIgnByDefault: false}`.

### C.2 Nguồn dữ liệu (chỉ gọi từ server)

| Dữ liệu | Nguồn | Ghi chú |
| --- | --- | --- |
| IGN → UUID | `GET https://api.mojang.com/users/profiles/minecraft/{ign}` | 204/404 = không có. Khi làm mới, đổi UUID → tên hiện tại qua `https://sessionserver.mojang.com/session/minecraft/profile/{uuid}` để bắt trường hợp đổi tên. |
| Profiles | `GET https://api.hypixel.net/v2/skyblock/profiles?uuid=` + header `API-Key` | Có nhiều profile thì Admin chọn, mặc định profile `selected: true`. |
| Museum (cho networth) | `GET https://api.hypixel.net/v2/skyblock/museum?profile=` | Tùy chọn. Lỗi thì networth tính không có museum. |
| Bảng XP skill | `GET https://api.hypixel.net/v2/resources/skyblock/skills` | Không cần key. Cache 24 giờ trong bộ nhớ. |
| Networth | npm `skyhelper-networth` (MIT) | `new ProfileNetworthCalculator(member, museumMember?, bankBalance?)` → `getNetworth()`, `getNonCosmeticNetworth()`. Giá item lấy online, có cache. **Xác minh API của bản đang cài.** |
| Đọc NBT (armor/equipment) | npm `prismarine-nbt` (MIT) + `zlib.gunzipSync` | Dữ liệu base64 gzip trong `inventory.inv_armor.data`, `inventory.equipment_contents.data`. |

Quy định của Hypixel: không tạo proxy công khai. Request của khách **không bao giờ** kích hoạt gọi Hypixel. Khách chỉ
đọc snapshot trong DB. Chỉ gọi khi Admin bấm Fetch/Refresh và khi cron làm mới. Gặp 429 thì dừng, ghi `statsError`.
Đọc header `RateLimit-Remaining` và ngừng làm mới hàng loạt khi còn dưới 10.

Hai thư viện trên chỉ import trong file `server-only`. Nếu Next bundle lỗi thì thêm vào `serverExternalPackages`
trong `next.config.ts`.

### C.3 Snapshot hiển thị (`src/lib/skyblock-stats.ts`, thuần, unit test bằng fixture)

```ts
type AccountStats = {
  version: 1; fetchedAt: string; source: 'hypixel' | 'manual';
  profile: {cuteName: string | null; gameMode: string /* normal | ironman | stranded | bingo */; coop: boolean};
  level: {level: number; xp: number; next: number};            // Level 138, 2 / 100 XP
  skills: {key: string; label: string; level: number; cap: number; xpInto: number; xpNext: number | null; totalXp: number; maxed: boolean}[];
  summary: {joinedAt: string | null; purse: number | null; bank: number | null; averageSkill: number;
            fairySouls: {collected: number; total: number} | null; networth: number | null; nonCosmeticNetworth: number | null};
  gear: {inventoryApiOff: boolean; armor: GearGroup | null; equipment: GearGroup | null};
};
type GearGroup = {setName: string | null; bonus: {stat: string; short: string; value: number}[];
                  items: {name: string; rarity: string; slot: string}[]};
```

Đối chiếu với ảnh SkyCrypt chủ shop gửi:

- **Level**: `member.leveling.experience`. Level = floor(xp/100), thanh = xp % 100 trên 100.
- **12 skill**, xếp theo chữ cái như SkyCrypt: Alchemy, Carpentry, Combat, Enchanting, Farming, Fishing, Foraging,
  Hunting, Mining, Runecrafting, Social, Taming. XP lấy từ `member.player_data.experience.SKILL_<NAME>`. Level tra bảng
  `resources/skyblock/skills`. Hiển thị "61.72K / 300K XP" (XP trong level hiện tại / XP cần cho level kế). Đã max
  (level = cap) thì thanh **vàng** và chỉ ghi tổng XP ("110 XP"). Cần xác minh trên dữ liệu thật:
  khóa của Hunting (skill mới), cap Farming = 50 + `jacobs_contest.perks.farming_level_cap`, cap Taming, cap
  Runecrafting/Social. Chưa chắc thì dùng `maxLevel` của bảng resources.
- **Average Skill Level** = trung bình **level nguyên** của 10 skill, bỏ Runecrafting và Social. Kiểm chứng bằng ảnh:
  (20+29+30+44+45+16+28+17+33+41)/10 = **30.30**, khớp SkyCrypt.
- **Joined**: `member.profile.first_join` → "2 years ago". **Purse**: `member.currencies.coin_purse`.
  **Bank**: `profile.banking.balance` (không có thì null → "API off"). Kiểm tra thêm bank cá nhân
  `member.profile.bank_account` nếu có.
- **Fairy Souls**: `member.fairy_soul.total_collected` / `fairySoulsTotal` (Admin chỉnh được, mặc định 289).
- **Networth / Non-Cosmetic Networth**: `skyhelper-networth`. Lệch vài % so với SkyCrypt là chấp nhận được (nguồn giá khác).
- **Gear**: đọc 4 món armor và 4 món equipment. Mỗi món lấy tên (bỏ mã màu `§x` và sao), rarity (dòng lore cuối,
  vd. "EPIC BOOTS"), slot. **Set name**: bỏ chữ Helmet/Chestplate/Leggings/Boots; nếu cả 4 giống nhau thì là set
  (vd. "Mantid Fermento Armor"). **Bonus**: cộng các dòng lore dạng `Tên chỉ số: +số` của cả nhóm, đổi tên sang viết
  tắt có màu: Farming Fortune→FrmFrt (vàng), Bonus Pest Chance→BPC (xanh lá), Defense→Def (xanh lá), Health→HP (đỏ),
  Speed→Spd (trắng). Chỉ số lạ (vd. "OB" trong ảnh) hiện tên gốc, cần xác minh nghĩa trên dữ liệu thật. Người chơi tắt
  Inventory API → `inventoryApiOff: true`, và trang Admin nhắc "Bật Inventory API trong game rồi Refresh".
- Định dạng số gọn dùng chung: 162.90M, 849.23M, 1.28M, 61.72K. Nhỏ hơn 100K thì ghi đủ có dấu phẩy.

Fixture test: `tests/fixtures/skyblock-profile.json`, một profile thật đã **cắt gọn và đổi UUID/tên thành giả**.
Test phải khẳng định level 138, Farming 45, average 30.30 khi fixture lấy từ đúng acc trong ảnh. Cần chủ shop cung cấp
IGN của acc mẫu và Hypixel key để tạo fixture.

### C.4 Lấy dữ liệu & tự làm mới (`src/lib/skyblock-fetch.ts`, server-only)

- `lookupPlayer(ign)` → `{uuid, ign, profiles: [{id, cuteName, gameMode, selected, lastSave}]}`.
- `fetchAccountStats(uuid, profileId)` → `AccountStats` (gọi profiles + museum + skills resource, rồi hàm thuần C.3).
- `refreshDueAccountStats(origin, limit = 5)`: chọn acc `draft`/`available`/`reserved` có `statsLocked=false` và
  `statsFetchedAt` cũ hơn `autoRefreshHours`, làm mới tối đa `limit` acc. Gọi từ `runHousekeeping` (`/api/cron/tick`
  chạy 15 phút/lần ban ngày). Acc `sold` không làm mới nữa, giữ snapshot lúc bán làm bằng chứng.
- Lỗi thì giữ snapshot cũ, ghi `statsError`, không xóa dữ liệu.

---

## Phase D — Trang Admin

### D.1 Tab mới "Accounts" trên thanh Admin (`admin-nav.tsx`), đặt sau "Orders"

- `/en/admin/accounts`: bảng acc có lọc theo trạng thái (All / Available / Reserved / Sold / Draft / Hidden). Cột: ảnh
  hoặc ô màu, code, title, IGN (kèm biểu tượng ẩn/hiện), Level, Farming, Networth, giá (VND + USD), trạng thái,
  "Stats updated 3h ago". Đầu trang có số đếm từng trạng thái. Nút "Add account".
- `/en/admin/accounts/new` và `/en/admin/accounts/[id]`, theo thứ tự thao tác:
  1. **IGN** + nút **Fetch stats**. Có nhiều profile thì hiện danh sách chọn (cute name, chế độ, lần chơi cuối).
     Chưa có key thì nút bị khóa, kèm link sang Settings và lựa chọn "Enter stats manually".
  2. **Xem trước** đúng thẻ acc khách sẽ thấy (dùng chung component với storefront).
  3. Title (gợi ý tự động, vd. "Farming 45 · Mantid Fermento · 849M NW"), mô tả, **giá VND** (hiện USD ngay bên dưới
     theo tỷ giá hiện tại, giống trang Products), giá sale, sort order.
  4. Công tắc **Show IGN to customers** (mặc định theo `showIgnByDefault`).
  5. **Ảnh chụp thêm** (tối đa 8): tái dùng upload của Products (`/api/admin/product-images`). Kéo để đổi thứ tự.
     Nhớ đưa đường dẫn ảnh acc vào danh sách ảnh đang dùng để không bị dọn mất, như announcements/background đang làm.
  6. **Login details**: textarea có mẫu gợi ý (Email / Password / Recovery / Notes). Lưu mã hóa. Khi sửa acc đã có thì
     hiện "••• saved", nút **Reveal** (hỏi xác nhận, ghi audit `account.secret_revealed`) và **Replace**.
  7. Trạng thái: Draft / Available / Hidden. Không cho Available nếu thiếu login details hoặc giá.
  8. Nút **Refresh stats** + "Lock stats" (tự bật khi Admin sửa tay một con số).
- Sửa tay thông số: form gọn cho các con số trong `summary`, level và từng skill. Lưu là `statsSource='manual'`, `statsLocked=true`.
- API: `GET/POST/DELETE /api/admin/accounts`, `GET/POST /api/admin/accounts/[id]` (actions `fetch-stats`, `lookup`,
  `reveal-secret`, `set-status`, `save`). Mọi action có Zod, `sameOrigin`, kiểm tra Admin, audit. Audit **không bao giờ**
  chứa mật khẩu.

### D.2 Settings

- Card mới **"SkyBlock accounts"** → `/en/admin/settings/accounts`: chữ của gian hàng (C.1 `accounts-shelf`), Hypixel API
  key (Save/Test/Remove), chu kỳ tự làm mới, tổng fairy souls, mặc định Show IGN. Có hướng dẫn ngắn bằng tiếng Anh cách
  lấy **Personal API key** ở developer.hypixel.net (key "Create API Key" hết hạn sau 3 ngày, phải dùng "Create App" →
  Personal API Key).
- Card Payments: thêm "PayPal" vào mô tả.

---

## Phase E — Gian hàng trên storefront

### E.1 Catalog

- `catalogProductSchema` thêm `kind: z.enum(['package', 'account']).default('package')` và
  `account: accountCardSchema.nullable().default(null)`. Đây là bản **gọn**: code, profileName, gameMode, ign (chỉ khi
  showIgn), level, farming level, average skill, networth, purse, set name, ảnh đầu tiên, status. Không đưa toàn bộ
  stats vào catalog: catalog tải ở mọi trang.
- `readDatabaseCatalog` đọc thêm acc `available` + `reserved` (reserved: `stock: 0`, hiện nhãn "Reserved"). Mỗi acc thành
  một `CatalogProduct`: `id = account.id`, `sku = code`, `stock = 1`, `fields = []`, `category = 'skyblock-account'`.
- `getPublicCatalog` trả thêm `shelf` (chữ gian hàng). Chỉ trả acc khi `enabled`.
- Kiểm tra mọi chỗ đang dùng `catalog.products` cho package: QuickBuy, amount slider, `products/[id]`, "Buy again",
  `filterCatalog`. Các chỗ này phải lọc `kind === 'package'`.

### E.2 Tab trên trang chủ (`Catalog` trong `store-ui.tsx`)

- Hai tab `role="tablist"`: "{packagesTabLabel}" | "{accountsTabLabel} ({số acc available})". Tab chọn được lưu vào
  URL (`?shelf=accounts`) để chia sẻ link. Link `#accounts` mở thẳng tab acc. Gian tắt hoặc không có acc nào thì ẩn tab.
- Tab Packages: giữ nguyên toàn bộ như hiện tại (QuickBuy, slider, grid).
- Tab Accounts: heading + intro do Admin đặt. Có tìm kiếm/sắp xếp (giá, networth, farming level) khi trên 4 acc.
  Grid **thẻ acc**:
  - Ảnh đầu tiên, hoặc ô nền tối có Level lớn.
  - Title. Dòng phụ: profile cute name, chế độ (badge Ironman/Stranded nếu có), IGN nếu bật.
  - 4 chỉ số nổi bật: Level, Farming (kèm mini bar), Networth, Purse.
  - Set armor (màu theo rarity).
  - Giá USD lớn, VND nhỏ (dùng `Price`). Nút "View account →" sang trang chi tiết. Acc reserved thì nút khóa, ghi "Reserved".

### E.3 Trang chi tiết `/en/accounts/[code]`

- Dữ liệu từ `GET /api/accounts/[code]`: snapshot đầy đủ, ảnh, mô tả. Không có thông tin bí mật. Có `ign` và link chỉ
  khi showIgn. Cache 60 giây. Acc `sold`/`draft`/`hidden` → 404 "This account is no longer available".
- Bố cục mobile-first, nhìn giống ảnh SkyCrypt nhưng dùng màu và class của site:
  1. Đầu trang: title, badge trạng thái, giá, nút **Buy this account** (thêm vào giỏ với quantity 1 rồi mở checkout),
     "Stats updated {x} ago · from Hypixel". Nếu showIgn: IGN, **View on SkyCrypt**
     (`https://sky.shiiyu.moe/stats/{ign}/{profileName}`), **Elite** (`https://elitebot.dev/@{ign}/{profileName}`,
     kiểm tra lại định dạng link).
  2. Khối **Level** + **12 skill**: icon nhỏ, "Farming 45", "1.28M / 2.90M XP", thanh xanh, thanh vàng khi max.
  3. Khối **Summary**: Joined, Purse, Bank Account, Average Skill Level, Fairy Souls, Networth, Non-Cosmetic Networth,
     có tooltip (i) giải thích ngắn.
  4. **Gear**: Armor (Set + dòng Bonus có màu) và Equipment (Bonus). Mỗi món là ô vuông nền màu rarity
     (COMMON #FFFFFF, UNCOMMON #55FF55, RARE #5555FF, EPIC #AA00AA, LEGENDARY #FFAA00, MYTHIC #FF55FF, DIVINE #55FFFF,
     SPECIAL #FF5555) + icon SVG đơn giản theo slot (mũ/áo/quần/giày/dây chuyền…) + tên khi hover/chạm. Không lấy ảnh
     item từ SkyCrypt.
  5. **Screenshots** do Admin tải (lightbox đơn giản), sau đó là mô tả.
  6. Ghi chú cố định: "Stats are a snapshot from the Hypixel API; the account is delivered with full login details
     right after payment."
- CSS mới gom trong một khối `/* SkyBlock accounts */` ở `globals.css`. Dùng biến màu sẵn có. Kiểm tra ở bề rộng 360px.

---

## Phase F — Giỏ hàng, checkout, đơn hàng, giao tự động

### F.1 Giỏ & checkout

- Dòng acc trong giỏ: `{productId: account.id, quantity: 1, delivery: {}}`. `createCartSchema` đã chặn quantity > stock (1).
  Trang Cart: dòng acc không có nút tăng/giảm, chỉ có Remove. Hiện "SkyBlock account · {code}".
- Checkout: **giỏ chỉ có acc → ẩn mục "01 / WHEN"** và đánh lại số các mục. Không gửi `timing`. Câu dẫn: "Pay with the
  QR code; your account details appear on your order page as soon as the payment is confirmed." Giỏ hỗn hợp → giữ mục
  WHEN như cũ.

### F.2 `createOrder`

- Tách dòng theo `kind`. Package: giữ code cũ. Account: trong cùng transaction
  `gameAccount.updateMany({where: {id, status: 'available'}, data: {status: 'reserved', orderId, reservedAt: now}})`,
  count ≠ 1 thì `OrderError('Sorry, this account was just sold. Please review your cart.', 409)`.
  Phải chạy sau khi tạo `order` (cần `order.id`), hoặc tạo trước id bằng `cuid`. Chọn cách nào cũng phải giữ atomic.
- `OrderItem` cho acc: `kind: 'account'`, `accountId`, `packageId = accountId`, `title = "SkyBlock account · {title}"`,
  `sku = code`, `quantity: 1`, `delivery: {}`.
- `needsAppointment = items.some(kind === 'package')`. Đơn chỉ acc mà gửi kèm `timing` thì bỏ qua timing.
- Ghi event "Order placed" kèm số acc.

### F.3 Giữ hàng / hết hạn / thanh toán muộn

- `restockItems`: dòng package như cũ. Dòng account chưa giao → acc `available`, `orderId: null`, `reservedAt: null`
  (chỉ khi `orderId` khớp và `status = 'reserved'`). Dòng account đã giao → `hidden` (xem B).
- `reReserveItems` (Admin xác nhận đơn đã hết hạn): acc phải còn `available`, nếu không thì `StockError` với thông báo
  rõ "the account was sold to another customer; refund this payment".

### F.4 Giao tự động (`src/lib/account-delivery.ts`)

- `deliverAccounts(tx, orderId)`: với mỗi dòng account chưa giao: acc phải `reserved` + đúng `orderId` → chép
  `secretEnc` sang `orderItem.deliveredSecretEnc`, đặt `deliveredAt`, acc → `sold`, `soldAt`. Trả về số acc đã giao.
- Gọi **bên trong transaction** của cả `confirmPayment` và `markPaidAutomatically`, ngay sau khi đổi trạng thái sang paid.
- Đơn `needsAppointment = false`: trong cùng transaction chuyển thẳng `completed` (`completedAt`, `deliveryNote =
  'Account login details are on your order page.'`, event `completed`), sau đó `invalidateTradeStats()`. Vẫn
  `grantPaidOrderSpin`. Không gửi email/chat về lịch hẹn: thay `postPaymentMessage` bằng tin "Payment received for
  {code}. Your account details are on your order page." và email mới `customerAccountsDelivered` (**không chứa mật khẩu**).
- Đơn hỗn hợp: giao acc ngay khi trả tiền, phần package đi theo luồng hẹn cũ. Email thanh toán thêm câu "Your account
  details are already on your order page."
- Form Admin xác nhận tiền: ẩn phần đặt lịch khi `needsAppointment = false`. Nút ghi "Confirm payment & deliver".
- `reportTransfer`: bỏ yêu cầu "Tell us when you are free first" khi `needsAppointment = false`. `updateTimes`: báo lỗi
  409 cho đơn đó.

### F.5 Khách xem thông tin đăng nhập

- `customerOrder`: với dòng account có `deliveredAt` và đơn ở `paid`/`scheduled`/`completed`, giải mã và trả về
  `accounts: [{code, title, ign, profileName, loginDetails}]`. Lần đầu khách mở → event `accounts_viewed` (actor
  customer, kèm thời điểm) để làm bằng chứng khi có tranh chấp PayPal. Không ghi lại ở các lần sau.
- Trang đơn: card **"Your SkyBlock account"** ở trên cùng: IGN, profile, login details (font mono, nút Copy từng dòng),
  cảnh báo nổi bật "Change the password and recovery email right away. Message us in Chat if anything does not work."
- Admin order view: liệt kê acc trong đơn (link sang trang acc trong Admin), trạng thái đã giao/chưa giao, nút Reveal
  (audit), và thời điểm khách mở xem lần đầu.

---

## Phase G — Kiểm thử, tài liệu, deploy

### Unit (Vitest)

- `paypal.test.ts` (A.6). `skyblock-stats.test.ts`: level từ XP, level skill theo bảng + cap, thanh vàng khi max,
  average 30.30, đọc set name, cộng bonus từ lore, định dạng số gọn, Inventory API tắt.
  `account-rules.test.ts`: chuyển trạng thái, `needsAppointment`, giỏ có acc (quantity 2 bị từ chối).
  `usdt.test.ts` vẫn xanh sau khi tách `uniqueCents`.

### E2E (Playwright, DB dùng một lần, chạy bằng PowerShell) — `tests/e2e/paypal-accounts.spec.ts`

1. Admin bật PayPal (username giả), lưu thành công.
2. Khách mua package, chọn PayPal → trang đơn có QR, số USD có 2 chữ số thập phân, link `paypal.me/<user>/<amount>USD`.
3. Admin tạo acc bằng **nhập tay** (E2E không gọi Hypixel), có login details, đặt Available.
4. Trang chủ: tab "SkyBlock accounts" hiện acc. Trang chi tiết hiện skill + summary.
5. Khách khác mua acc: checkout **không có** mục WHEN. Đặt đơn → acc thành Reserved, khách thứ ba thấy nút khóa.
6. Admin xác nhận tiền → đơn `completed`, trang đơn khách hiện login details, acc biến khỏi storefront.
7. Hủy/hết hạn trước khi trả → acc về Available.

### Kiểm tra cuối

`npm run typecheck`, `npm test`, `NEXT_BUILD_DIR=.next-verify npm run build`, `npm run test:e2e`. Chụp màn hình tab acc
và trang chi tiết ở 360px và 1280px để chủ shop duyệt.

### Tài liệu

- README: thêm PayPal và SkyBlock accounts vào danh sách chức năng.
- DEPLOYMENT.md: mục "PayPal và SkyBlock accounts (ngày deploy)" gồm các bước chủ shop phải tự làm (mục 4) và cảnh báo
  không đổi `AUTH_SECRET`.
- HANDOFF.md: ghi commit, deploy, tình trạng.

---

## 3. Rủi ro và điểm cần xác minh

| Vấn đề | Cách xử lý |
| --- | --- |
| PayPal.me có thể bỏ qua số tiền trên link | Nút Test QR trong Admin. Trang đơn luôn hiện số tiền + nút Copy. |
| PayPal Goods & Services cho phép khách mở tranh chấp sau khi nhận acc | Admin tự viết `instructions`. Lưu event `accounts_viewed` + snapshot stats lúc bán làm bằng chứng. Đây là quyết định kinh doanh của chủ shop, code không chặn. |
| Hypixel cấm mua bán bằng tiền thật; key gắn với tài khoản Hypixel của chủ shop | Mất key thì chức năng nhập tay vẫn chạy. Ghi rõ trong trang Settings. |
| Tên trường Hypixel thay đổi (Hunting mới, cap skill, bank) | Xác minh trên response thật. Thiếu trường thì hiện "—", không làm hỏng trang. |
| Người chơi tắt Inventory API | `inventoryApiOff`, nhắc Admin. |
| Đổi `AUTH_SECRET` làm mất mật khẩu acc đã lưu | Cảnh báo trong DEPLOYMENT.md và trang Settings. Admin xuất bằng Reveal trước khi đổi. |
| Hai khách cùng mua một acc | `updateMany where status='available'` trong transaction, test ở E2E bước 5. |
| AGPL của SkyCrypt | Không sao chép code/hằng số. Chỉ dùng Hypixel API + thư viện MIT. |

## 4. Việc chủ shop phải tự làm

1. Tạo **Hypixel Personal API key**: developer.hypixel.net → đăng nhập → Create App → loại Personal API Key → chờ duyệt.
   Không dùng "Create API Key" (hết hạn sau 3 ngày). Dán key vào Admin → Settings → SkyBlock accounts.
2. Gửi IGN của acc trong ảnh mẫu để Sonnet tạo fixture test và đối chiếu số với SkyCrypt.
3. Chuẩn bị tên PayPal.me (và email PayPal nếu muốn hiện), quyết định phụ phí % và câu hướng dẫn thanh toán.
4. Trước khi đăng acc: bật **API settings** (Inventory, Banking, Collections…) trong game cho acc đó, nếu không thì
   gear/bank sẽ không đọc được.
5. Duyệt ảnh chụp giao diện trước khi deploy.

## 5. Định nghĩa "xong"

- [ ] Checkout có PayPal khi bật trong Admin. Trang đơn có QR + link + số tiền riêng từng đơn. Admin xác nhận được.
- [ ] Admin thêm acc bằng IGN → Fetch stats → thông số khớp SkyCrypt (level, skill, average, purse, fairy souls; networth lệch dưới ~5%).
- [ ] Bật/tắt IGN cho từng acc hoạt động đúng ở thẻ, trang chi tiết và API công khai.
- [ ] Trang chủ có 2 tab. Trang chi tiết hiện đủ các khối như ảnh SkyCrypt. Dùng tốt ở 360px.
- [ ] Mua acc không cần chọn giờ. Tiền xác nhận (tay hoặc tự động) → acc giao tự động, đơn completed, mật khẩu chỉ hiện cho đúng khách.
- [ ] Hết hạn/hủy trả acc về kho. Acc đã lộ thông tin không bao giờ tự bán lại.
- [ ] typecheck, unit, build, E2E đều xanh, có output làm bằng chứng. Tài liệu đã cập nhật.
