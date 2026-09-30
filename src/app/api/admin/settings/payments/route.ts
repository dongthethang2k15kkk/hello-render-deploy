import QRCode from 'qrcode';
import {z} from 'zod';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {getPaymentDb} from '@/lib/payment-db';
import {getVndPerUsd, setVndPerUsd} from '@/lib/store-settings';
import {validLitecoinAddress} from '@/lib/ltc';
import {litecoinUri} from '@/lib/ltc-format';
import {getLtcOverride, getLtcRate, setLtcOverride} from '@/lib/ltc-rate';
import {vietQrPayload} from '@/lib/vietqr';
import {getSepayKey, rotateSepayKey} from '@/lib/payment-detection';
import {bankName, vnBanks} from '@/lib/vn-banks';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const accountSelect = {id: true, bankBin: true, bankName: true, accountNumber: true, accountHolder: true, active: true, lastAssigned: true} as const;

async function state() {
  const db = getPaymentDb();
  const [vndPerUsd, accounts, wallets, ltcOverride, ltcRate] = await Promise.all([
    getVndPerUsd(), db.bankAccount.findMany({orderBy: {createdAt: 'asc'}, select: accountSelect}),
    db.cryptoWallet.findMany({orderBy: {createdAt: 'asc'}, select: {id: true, network: true, address: true, label: true, active: true}}),
    getLtcOverride(), getLtcRate()
  ]);
  const [sepayKey, transfers] = await Promise.all([getSepayKey(), db.bankTransaction.findMany({orderBy: {receivedAt: 'desc'}, take: 20, select: {id: true, amountVnd: true, content: true, outcome: true, orderId: true, receivedAt: true}})]);
  return {vndPerUsd, accounts, banks: vnBanks, wallets, ltcOverride, ltcRate, sepay: {configured: Boolean(sepayKey), keyHint: sepayKey ? `…${sepayKey.slice(-4)}` : null}, transfers};
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
  z.object({action: z.literal('test-qr'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('save-wallet'), id: z.string().max(40).optional(), address: z.string().trim().max(100), label: z.string().trim().max(60).default(''), active: z.boolean()}).strict(),
  z.object({action: z.literal('delete-wallet'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('test-wallet-qr'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('ltc-override'), vndPerLtc: z.number().int().min(1000).max(1_000_000_000).nullable()}).strict(),
  z.object({action: z.literal('sepay-rotate')}).strict()
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
    } else if (input.action === 'save-wallet') {
      // A typo in a receiving address would lose customer money, so the checksum is verified.
      if (!validLitecoinAddress(input.address)) return json({error: 'This is not a valid Litecoin address (checksum failed). Copy it again from your wallet.'}, 400);
      const duplicate = await db.cryptoWallet.findUnique({where: {address: input.address}});
      if (duplicate && duplicate.id !== input.id) return json({error: 'This wallet address is already added.'}, 409);
      const data = {address: input.address, label: input.label || 'Litecoin wallet', active: input.active, network: 'LTC'};
      const saved = input.id ? await db.cryptoWallet.update({where: {id: input.id}, data}) : await db.cryptoWallet.create({data});
      await recordAudit({actorEmail: admin.email, action: input.id ? 'settings.wallet_updated' : 'settings.wallet_added', summary: `${input.id ? 'Updated' : 'Added'} Litecoin wallet …${data.address.slice(-6)} (${data.active ? 'active' : 'inactive'})`, entityType: 'settings', entityId: saved.id});
    } else if (input.action === 'delete-wallet') {
      const removed = await db.cryptoWallet.delete({where: {id: input.id}});
      await recordAudit({actorEmail: admin.email, action: 'settings.wallet_deleted', summary: `Removed Litecoin wallet …${removed.address.slice(-6)}`, entityType: 'settings', entityId: input.id});
    } else if (input.action === 'test-wallet-qr') {
      const wallet = await db.cryptoWallet.findUnique({where: {id: input.id}});
      if (!wallet) return json({error: 'Wallet not found.'}, 404);
      return json({qrSvg: await QRCode.toString(litecoinUri(wallet.address, '0.00100000', 'TEST'), {type: 'svg', margin: 1, errorCorrectionLevel: 'M'})});
    } else if (input.action === 'sepay-rotate') {
      const key = await rotateSepayKey(admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.sepay_key', summary: 'Generated a new SePay webhook key', entityType: 'settings'});
      // The full key is shown once so it can be pasted into SePay.
      return json({ok: true, sepayKey: key, ...(await state())});
    } else if (input.action === 'ltc-override') {
      await setLtcOverride(input.vndPerLtc, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.ltc_rate', summary: input.vndPerLtc ? `Set a manual Litecoin price of ${input.vndPerLtc.toLocaleString('vi-VN')} VND/LTC` : 'Switched the Litecoin price back to automatic', entityType: 'settings'});
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
