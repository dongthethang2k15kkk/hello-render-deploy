import {createHash, timingSafeEqual} from 'node:crypto';
import {customerLuckySpinGranted} from '@/lib/email-templates';
import {sendMail} from '@/lib/mailer';
import {appOrigin} from '@/lib/oauth-helpers';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAMPAIGN = 'customer.lucky_spin_backfill';
const TOKEN_KEY = 'one-time:paid-spin-email:2026-10-06';
const hash = (value: string) => createHash('sha256').update(value).digest();

/** One-time production campaign. The token hash lives only in StoreSetting and is deleted after every email succeeds. */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return Response.json({ok: false}, {status: 503});
  const db = getPaymentDb();
  const setting = await db.storeSetting.findUnique({where: {key: TOKEN_KEY}, select: {value: true}});
  const expected = setting?.value && typeof setting.value === 'object' && !Array.isArray(setting.value) && 'tokenHash' in setting.value
    ? String((setting.value as {tokenHash?: unknown}).tokenHash ?? '') : '';
  const supplied = request.headers.get('x-campaign-token') ?? '';
  const suppliedHash = hash(supplied);
  const expectedHash = /^[a-f0-9]{64}$/.test(expected) ? Buffer.from(expected, 'hex') : Buffer.alloc(32);
  if (!supplied || !timingSafeEqual(suppliedHash, expectedHash)) return Response.json({ok: false}, {status: 404});

  const customers = await db.customer.findMany({
    where: {
      status: 'active',
      email: {not: {endsWith: '.invalid'}},
      orders: {some: {paidAt: {not: null}}},
      luckySpins: {some: {spunAt: null}}
    },
    orderBy: {createdAt: 'asc'},
    take: 500,
    select: {name: true, email: true}
  });
  const wheelUrl = `${appOrigin(request.url)}/en#lucky-wheel`;
  let sent = 0; let alreadySent = 0; let failed = 0;
  for (const customer of customers) {
    const recipient = customer.email.trim().toLowerCase();
    const prior = await db.emailLog.findFirst({where: {kind: CAMPAIGN, recipient, status: 'sent'}, select: {id: true}});
    if (prior) {alreadySent += 1; continue;}
    const result = await sendMail({to: [recipient], ...customerLuckySpinGranted({name: customer.name, wheelUrl}), kind: CAMPAIGN});
    if (result.status === 'sent') sent += 1; else failed += 1;
  }
  if (!failed) await db.storeSetting.deleteMany({where: {key: TOKEN_KEY}});
  return Response.json({ok: failed === 0, eligible: customers.length, sent, alreadySent, failed}, {status: failed ? 502 : 200, headers: {'Cache-Control': 'no-store'}});
}
