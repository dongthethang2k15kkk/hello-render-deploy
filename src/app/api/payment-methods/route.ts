import {getLtcRate} from '@/lib/exchange-rates';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';

/** Which payment methods checkout can offer right now, with the current Litecoin price for an estimate. */
export async function GET() {
  const headers = {'Cache-Control': 'no-store'};
  if (!process.env.DATABASE_URL) return Response.json({bank: false, ltc: null, usdt: false}, {headers});
  try {
    const db = getPaymentDb();
    const [banks, ltcWallets, usdtWallets] = await Promise.all([
      db.bankAccount.count({where: {active: true}}),
      db.cryptoWallet.count({where: {active: true, network: 'LTC'}}),
      db.cryptoWallet.count({where: {active: true, network: 'TRC20'}})
    ]);
    const rate = ltcWallets ? await getLtcRate() : null;
    // USDT follows the dollar, so the USD price on the page is the amount to send.
    return Response.json({bank: banks > 0, ltc: rate ? {vndPerLtc: rate.vndPerLtc, source: rate.source} : null, usdt: usdtWallets > 0}, {headers});
  } catch { return Response.json({bank: false, ltc: null, usdt: false}, {headers}); }
}
