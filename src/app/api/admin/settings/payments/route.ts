import QRCode from 'qrcode';
import {z} from 'zod';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {getPaymentDb} from '@/lib/payment-db';
import {getLtcRate, getMarketRates, getRateSettings, getUsdRate, saveLtcRateSettings, saveUsdRateSettings} from '@/lib/exchange-rates';
import {validLitecoinAddress} from '@/lib/ltc';
import {validTronAddress} from '@/lib/usdt';
import {litecoinUri} from '@/lib/ltc-format';
import {vietQrPayload} from '@/lib/vietqr';
import {bankName, vnBanks} from '@/lib/vn-banks';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const accountSelect = {id: true, bankBin: true, bankName: true, accountNumber: true, accountHolder: true, active: true, lastAssigned: true} as const;

async function state() {
  const db = getPaymentDb();
  const [accounts, wallets, rateSettings, market] = await Promise.all([
    db.bankAccount.findMany({orderBy: {createdAt: 'asc'}, select: accountSelect}),
    db.cryptoWallet.findMany({orderBy: {createdAt: 'asc'}, select: {id: true, network: true, address: true, label: true, active: true}}),
    getRateSettings(), getMarketRates()
  ]);
  // The rates in use come after the market lookup, so they reuse its fresh cache.
  const [usdRate, ltcRate] = await Promise.all([getUsdRate(), getLtcRate()]);
  return {accounts, banks: vnBanks, wallets, rates: {...rateSettings, usdRate, ltcRate, market}};
}

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json(await state()); } catch { return json({error: 'Payment settings could not be loaded.'}, 503); }
}

/** Banks print the holder in capitals without accents; matching that avoids mismatches in banking apps. */
const holderName = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'D').toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trim();

const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('rate'), mode: z.enum(['auto', 'fixed']), vndPerUsd: z.number().int().min(1000).max(1_000_000)}).strict(),
  z.object({action: z.literal('save-account'), id: z.string().max(40).optional(), bankBin: z.string().regex(/^\d{6}$/, 'Bank BIN must be 6 digits.'), accountNumber: z.string().trim().regex(/^[0-9A-Za-z]{4,19}$/, 'Account number: 4–19 letters or digits, no spaces.'), accountHolder: z.string().max(80), active: z.boolean()}).strict(),
  z.object({action: z.literal('delete-account'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('test-qr'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('save-wallet'), id: z.string().max(40).optional(), network: z.enum(['LTC', 'TRC20']).default('LTC'), address: z.string().trim().max(100), label: z.string().trim().max(60).default(''), active: z.boolean()}).strict(),
  z.object({action: z.literal('delete-wallet'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('test-wallet-qr'), id: z.string().max(40)}).strict(),
  z.object({action: z.literal('ltc-rate'), mode: z.enum(['auto', 'fixed']), vndPerLtc: z.number().int().min(1000).max(1_000_000_000).nullable()}).strict()
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
      await saveUsdRateSettings({mode: input.mode, vndPerUsd: input.vndPerUsd}, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.rate', summary: input.mode === 'auto' ? `USD rate follows the market (fallback ${input.vndPerUsd.toLocaleString('vi-VN')} VND/USD)` : `Fixed the USD rate at ${input.vndPerUsd.toLocaleString('vi-VN')} VND/USD`, entityType: 'settings'});
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
      const usdt = input.network === 'TRC20';
      if (usdt ? !validTronAddress(input.address) : !validLitecoinAddress(input.address)) return json({error: usdt ? 'This is not a valid TRON (TRC20) address: it starts with T, has 34 characters and its checksum must match. Copy it again from your wallet.' : 'This is not a valid Litecoin address (checksum failed). Copy it again from your wallet.'}, 400);
      const duplicate = await db.cryptoWallet.findUnique({where: {address: input.address}});
      if (duplicate && duplicate.id !== input.id) return json({error: 'This wallet address is already added.'}, 409);
      const data = {address: input.address, label: input.label || (usdt ? 'USDT wallet' : 'Litecoin wallet'), active: input.active, network: input.network};
      const saved = input.id ? await db.cryptoWallet.update({where: {id: input.id}, data}) : await db.cryptoWallet.create({data});
      await recordAudit({actorEmail: admin.email, action: input.id ? 'settings.wallet_updated' : 'settings.wallet_added', summary: `${input.id ? 'Updated' : 'Added'} ${usdt ? 'USDT (TRC20)' : 'Litecoin'} wallet …${data.address.slice(-6)} (${data.active ? 'active' : 'inactive'})`, entityType: 'settings', entityId: saved.id});
    } else if (input.action === 'delete-wallet') {
      const removed = await db.cryptoWallet.delete({where: {id: input.id}});
      await recordAudit({actorEmail: admin.email, action: 'settings.wallet_deleted', summary: `Removed ${removed.network === 'TRC20' ? 'USDT (TRC20)' : 'Litecoin'} wallet …${removed.address.slice(-6)}`, entityType: 'settings', entityId: input.id});
    } else if (input.action === 'test-wallet-qr') {
      const wallet = await db.cryptoWallet.findUnique({where: {id: input.id}});
      if (!wallet) return json({error: 'Wallet not found.'}, 404);
      // TRON wallets read a plain address; Litecoin wallets read a litecoin: link with a test amount.
      return json({qrSvg: await QRCode.toString(wallet.network === 'TRC20' ? wallet.address : litecoinUri(wallet.address, '0.00100000', 'TEST'), {type: 'svg', margin: 1, errorCorrectionLevel: 'M'})});
    } else if (input.action === 'ltc-rate') {
      if (input.mode === 'fixed' && !input.vndPerLtc) return json({error: 'Enter the fixed Litecoin price in VND.'}, 400);
      await saveLtcRateSettings({mode: input.mode, vndPerLtc: input.vndPerLtc}, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.ltc_rate', summary: input.mode === 'fixed' ? `Fixed the Litecoin price at ${input.vndPerLtc!.toLocaleString('vi-VN')} VND/LTC` : `Litecoin price follows the market${input.vndPerLtc ? ` (fallback ${input.vndPerLtc.toLocaleString('vi-VN')} VND/LTC)` : ''}`, entityType: 'settings'});
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
