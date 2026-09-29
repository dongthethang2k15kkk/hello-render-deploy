# Phases 2–5 — Orders, bank-transfer payments, appointments, audit log and overview

Status: approved by the owner on 2026-09-29 (chat). Builds on phase 1 (`2026-09-29-phase1-accounts-chat-design.md`).

## Owner decisions

| Topic | Decision |
|---|---|
| Prices | Admin enters VND. Storefront shows USD large and VND smaller, converted with an Admin-set VND/USD rate. Customers pay the exact VND total; USD is informational |
| Payment | Vietnamese bank transfer with a VietQR code (amount and order code pre-filled); Admin confirms manually against the bank statement |
| Hold | Placing an order reserves stock for 30 minutes. Not reported as paid in time → order expires and stock returns |
| Delivery | Appointment based. After transferring, the customer proposes 1–5 free time windows. All Admin emails receive a Gmail with a link to the order. An Admin confirms payment and picks the time in one step; the customer receives Gmail + web Inbox notification with calendar links. At the appointment both talk in the site chat. Admin completes the order with a delivery note visible only to that customer |
| Email | Gmail API from the shop's Gmail (HTTPS; Render Free blocks SMTP; no owned domain). Admin emails in Vietnamese, customer emails in English |

## Order lifecycle

`awaiting_payment` → (customer reports transfer + time windows) `payment_reported` → (Admin confirms payment) `paid` → (Admin sets appointment) `scheduled` → (Admin completes) `completed`.
Side exits: `expired` (hold elapsed, system), `cancelled` (customer before reporting, or Admin with reason). Stock is reserved at creation and returned on `expired`/`cancelled`. Admin may confirm payment and schedule in one action. Rescheduling keeps `scheduled` and re-notifies.

Expiry is enforced lazily (order reads, order creation, catalog reads throttled to once a minute) because Render Free has no background jobs.

## Optimisations over the owner's description

- One Admin screen confirms payment and sets the appointment.
- Appointment emails carry an `.ics` file and a Google Calendar link so phones remind both sides; no server cron needed.
- The completion email never contains the delivery note; customers read it on the site.
- The Admin who schedules is assigned to the order; other Admins see who handles it.
- Email failures never lose information: every event also creates a web notification or appears in Admin; an email log with resend is kept.
- The "web mailbox" is an Inbox of notifications with an unread badge plus the existing persistent chat.

## Data (additive migration)

- `Package.priceVnd`, `Package.salePriceVnd` (backfilled from USD cents × 260); USD columns kept with default 0, unused.
- `StoreSetting` (key/value JSON; `vndPerUsd`, default 26 000), `BankAccount` (NAPAS BIN, bank name, account number, holder, active, round-robin).
- `Order`, `OrderItem` (price/title/delivery snapshot), `OrderSlot` (customer windows), `OrderEvent` (timeline), `Notification` (customer inbox), `EmailLog`, `MailConnection` (Gmail refresh token encrypted with AES-256-GCM, key derived from `AUTH_SECRET`).
- `AuditLog` gains `entityType`/`entityId` so every Admin action (products, orders, settings, customers, email) is recorded.
- A customer with orders is anonymised instead of deleted (financial records stay).
- The Bearer-key payment staging page and API are removed; its empty tables remain.

## Pages

Customer: checkout (real order), `/en/orders`, `/en/orders/<code>` (payment panel with VietQR and countdown, transfer-report dialog with time windows, appointment with calendar links, delivery note, cancel), `/en/inbox`. Header shows Inbox unread count. Demo/preview labels are removed.

Admin: Overview (needs-action counts, upcoming appointments, revenue today/7/30 days, new customers, low stock, database size, Gmail status), Orders (filters, needs-action tab) and order page (confirm payment + schedule, reschedule, complete, cancel, internal note, resend email, timeline), Activity (audit log with filters), Settings → Payments (VND/USD rate, bank accounts, test QR) and Email (connect Gmail, send test, log).

## Gmail connection

Admin → Settings → Email → Connect Gmail runs Google OAuth with `gmail.send` and offline access through the existing callback (no new redirect URI). The owner must enable the Gmail API in the Google Cloud project; Google shows an unverified-app notice to that one account. Refresh tokens survive only when the OAuth app is published (Testing tokens expire after 7 days).

## Testing

Unit: money formatting and conversion, VietQR payload and CRC (CRC-16/CCITT-FALSE vector), order transitions, slot validation, order codes, `.ics`/calendar links, email MIME/templates escaping. E2E (Neon `e2e` branch / CI Postgres): bank account setup, checkout → payment page → report with windows → Admin confirms + schedules → customer inbox/order shows appointment → Admin completes → delivery note visible only to the owner of the order; customer cancel restores stock; missing bank account blocks checkout clearly; activity log and overview reflect actions.
