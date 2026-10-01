import {getLtcRate} from '@/lib/exchange-rates';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';

/** Which payment methods checkout can offer right now, with the current Litecoin price for an estimate. */
export async function GET() {
  const headers = {'Cache-Control': 'no-store'};
  if (!process.env.DATABASE_URL) return Response.json({bank: false, ltc: null}, {headers});
  try {
    const db = getPaymentDb();
    const [banks, wallets] = await Promise.all([db.bankAccount.count({where: {active: true}}), db.cryptoWallet.count({where: {active: true, network: 'LTC'}})]);
    const rate = wallets ? await getLtcRate() : null;
    return Response.json({bank: banks > 0, ltc: rate ? {vndPerLtc: rate.vndPerLtc, source: rate.source} : null}, {headers});
  } catch { return Response.json({bank: false, ltc: null}, {headers}); }
}
