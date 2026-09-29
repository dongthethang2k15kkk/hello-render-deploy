import QRCode from 'qrcode';
import {z} from 'zod';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {getPaymentDb} from '@/lib/payment-db';
import {getVndPerUsd, setVndPerUsd} from '@/lib/store-settings';
import {vietQrPayload} from '@/lib/vietqr';
import {bankName, vnBanks} from '@/lib/vn-banks';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const accountSelect = {id: true, bankBin: true, bankName: true, accountNumber: true, accountHolder: true, active: true, lastAssigned: true} as const;

async function state() {
  const [vndPerUsd, accounts] = await Promise.all([getVndPerUsd(), getPaymentDb().bankAccount.findMany({orderBy: {createdAt: 'asc'}, select: accountSelect})]);
  return {vndPerUsd, accounts, banks: vnBanks};
}

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json(await state()); } catch { return json({error: 'Payment settings could not be loaded.'}, 503); }
}

/** Banks print the holder in capitals without accents; matching that avoids mismatches in banking apps. */
const holderName = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'D').toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();

const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('rate'), vndPerUsd: z.number().int().min(1000).max(1_000_000)}).strict(),
  z.object({action: z.literal('save-account'), id: z.string().max(40).optional(), bankBin: z.string().regex(/^\d{6}$/, 'Bank BIN must be 6 digits.'), accountNumber: z.string().trim().regex(/^[0-9A-Za-z]{4,19}$/, 'Account number: 4–19 letters or digits, no spaces.'), accountHolder: z.string().max(80), active: z.boolean()}).strict(),
  z.object({action: z.literal('delete-account'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('test-qr'), id: z.string().max(40)}).strict()
]);

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid request.'}, 400);
  const input = parsed.data;
  const db = getPaymentDb();
  try {
    if (input.action === 'rate') {
      await setVndPerUsd(input.vndPerUsd, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.rate', summary: `Set the display rate to ${input.vndPerUsd.toLocaleString('vi-VN')} VND/USD`, entityType: 'settings'});
    } else if (input.action === 'save-account') {
      const holder = holderName(input.accountHolder);
      if (holder.length < 3) return json({error: 'Enter the account holder name as printed by the bank.'}, 400);
      const data = {bankBin: input.bankBin, bankName: bankName(input.bankBin), accountNumber: input.accountNumber, accountHolder: holder, active: input.active};
      const saved = input.id ? await db.bankAccount.update({where: {id: input.id}, data}) : await db.bankAccount.create({data});
      await recordAudit({actorEmail: admin.email, action: input.id ? 'settings.bank_updated' : 'settings.bank_added', summary: `${input.id ? 'Updated' : 'Added'} bank account ${data.bankName} ••${data.accountNumber.slice(-4)} (${data.active ? 'active' : 'inactive'})`, entityType: 'settings', entityId: saved.id});
    } else if (input.action === 'delete-account') {
      const removed = await db.bankAccount.delete({where: {id: input.id}});
      await recordAudit({actorEmail: admin.email, action: 'settings.bank_deleted', summary: `Removed bank account ${removed.bankName} ••${removed.accountNumber.slice(-4)}`, entityType: 'settings', entityId: input.id});
    } else {
      const account = await db.bankAccount.findUnique({where: {id: input.id}});
      if (!account) return json({error: 'Bank account not found.'}, 404);
      const payload = vietQrPayload({bankBin: account.bankBin, accountNumber: account.accountNumber, amountVnd: 10000, note: 'JH TEST'});
      return json({qrSvg: await QRCode.toString(payload, {type: 'svg', margin: 1, errorCorrectionLevel: 'M'})});
    }
    return json({ok: true, ...(await state())});
  } catch (error) {
    console.error('Payment settings failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The settings could not be saved.'}, 503);
  }
}
