# Phase 1 — Customer accounts, sign-in history and persistent chat

Status: approved by the owner on 2026-09-29 (chat). Direction and decisions are logged in `HANDOFF.md`.

## Goal

The shop will sell for real. Customer accounts, sign-ins and support chat must survive Render
restarts and be reviewable by Admin through curated, filterable pages. Passwords are never
viewable; Admin can set a new password for a customer who forgot theirs.

## Decisions

| Topic | Decision |
|---|---|
| Customer sign-in | Google, or email + password |
| Email delivery | None for now (no owned domain; Render Free blocks SMTP). Password accounts are unverified |
| Forgotten password | `/en/forgot-password` shows the shop's Zalo QR (`public/contact/zalo-qr.png`). Admin verifies identity and sets a new password |
| Sign-in history | Time, method, result, device (user agent) and IP; deleted after 90 days |
| Chat | Stored in PostgreSQL; chat images are private and deleted after 90 days; text is kept |
| Session length | Customers 30 days; revoked on password change, lock, or "sign out everywhere". Admin unchanged (Google, 8 h signed cookie) |
| Demo accounts | Removed (`customer/customer123` etc.). Tests register their own accounts |
| Admin navigation | Chat, **Customers**, Settings. Customers has two tabs: Customers and Sign-in activity |

## Data model (new tables)

- `Customer`: email (unique, lowercase), name, `passwordHash` (scrypt `salt:hash`, null for
  Google-only), `googleSub` (unique), `emailVerified` (true once proven by Google), `status`
  (`active` / `locked`), `lockedReason`, `mustChangePassword`, `createdAt`, `lastLoginAt`.
- `CustomerSession`: `tokenHash` (SHA-256 of a random 32-byte cookie token; the token itself is
  never stored), ip, userAgent, createdAt, lastSeenAt, expiresAt, revokedAt.
- `LoginEvent`: customerId (nullable), email tried, method (`password` / `google` / `register`),
  outcome (`success`, `wrong_password`, `unknown_email`, `no_password`, `locked`,
  `rate_limited`), ip, userAgent, createdAt. Indexed by time, email, IP, customer.
- `ChatMessage`: customerId (conversation owner), authorRole (`customer` / `admin`),
  authorName, body, optional `ChatImage`, createdAt.
- `ChatImage`: bytes, MIME type, name, size, createdAt. Served only to the owner and Admin.
- `AuditLog`: actor email, action, customerId, summary, createdAt. Phase 1 records Admin
  actions on customers; phase 4 extends it.

Migration is additive; existing product tables are untouched.

## Behaviour

**Customers**
- Register with name, email, password (8–128). Signing up signs in.
- Sign in with email + password, or "Continue with Google" (scope `openid email profile`).
- Google sign-in: allowlisted emails become Admin (unchanged). Otherwise find the customer by
  Google subject, then by email, else create one. When a Google sign-in claims an email that
  already has an **unverified** password account, the password is removed and all its sessions
  are revoked (prevents someone pre-registering another person's email).
- `/en/account`: profile, change password (or set one for Google-only accounts), sign out
  everywhere. `mustChangePassword` shows a required change form after sign-in.
- Locked accounts cannot sign in; their sessions are revoked immediately.

**Admin (curated, filtered; never shows password hashes or session tokens)**
- Customers list: name, email, verified badge, sign-in methods, created, last sign-in, status.
  Filters: search (name/email), status, method, created date range; 50 per page.
- Customer detail: active sessions (device, IP, last seen), 90-day sign-in history with outcome
  filter, Admin action log. Actions: lock/unlock with reason, set password (typed or generated,
  optional "must change at next sign-in"), sign out everywhere, open chat, delete account
  (type the email to confirm).
- Sign-in activity: all events with filters for time range, outcome, method and email/IP.

**Chat**
- Same UI and API shape (`room = user:<customerId>`), backed by PostgreSQL.
- Images: PNG/JPEG/WebP up to 1 MB, max 30 stored per conversation, served from
  `/api/chat/images/<id>` with an owner/Admin check and `private, no-store`.

## Security

- Rate limits from `LoginEvent`: 5 failed attempts per email or 20 per IP within 15 minutes
  block further attempts for that window; 5 registrations per IP per hour.
- Client IP: `cf-connecting-ip` when present (set by Cloudflare in front of Render), else the
  first `x-forwarded-for` entry. Verified with a spoofed header after deploy.
- State-changing auth, account and Admin routes reject requests whose `Origin` header does not
  match the host (CSRF defence in addition to `SameSite=Lax` cookies).
- Session lookups are cached in memory for 60 s (single Render instance) and invalidated
  in-process on revoke, lock and password change. This keeps the 5 s chat polling from hitting
  Neon on every request.
- Retention purge runs in-process at most every 6 hours: sign-in events and chat images older
  than 90 days, and sessions expired or revoked for more than 7 days.
- `/en/privacy` explains what is stored and for how long; linked from the footer and the
  register form. Google requires a privacy policy URL before the OAuth app is published.

## Testing

- Unit tests for the pure rules: password hashing, token hashing, rate-limit decisions, client
  IP parsing, `next` redirect allowlist, Google account-linking decision, Admin filter parsing.
- Playwright runs against a dedicated Neon branch `e2e` (`E2E_DATABASE_URL` in local `.env`).
  Global setup refuses to run when that URL equals `DATABASE_URL`, resets the branch with
  `prisma migrate reset`, and seeds the demo catalog. Tests register their own customers.
- GitHub Actions smoke test no longer uses the removed Admin password login; it registers a
  customer against the Compose PostgreSQL instead.

## Out of scope for phase 1

Orders, payments, stock deduction, overview dashboard, email delivery, unread counts,
removing the storefront "DEMO" labels (launch checklist).
