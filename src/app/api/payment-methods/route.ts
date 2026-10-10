import {getLtcRate} from '@/lib/exchange-rates';
import {paypalReady} from '@/lib/paypal';
import {getPaypalSettings} from '@/lib/paypal-settings';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';

/** Which payment methods checkout can offer right now, with the current Litecoin price for an estimate. */
export async function GET() {
  const headers = {'Cache-Control': 'no-store'};
  if (!process.env.DATABASE_URL) return Response.json({bank: false, ltc: null, usdt: false, paypal: null}, {headers});
  try {
    const db = getPaymentDb();
    const [banks, ltcWallets, usdtWallets, paypal] = await Promise.all([
      db.bankAccount.count({where: {active: true}}),
      db.cryptoWallet.count({where: {active: true, network: 'LTC'}}),
      db.cryptoWallet.count({where: {active: true, network: 'TRC20'}}),
      getPaypalSettings()
    ]);
    const rate = ltcWallets ? await getLtcRate() : null;
    // USDT follows the dollar, so the USD price on the page is the amount to send. PayPal adds the shop's fee on top.
    return Response.json({bank: banks > 0, ltc: rate ? {vndPerLtc: rate.vndPerLtc, source: rate.source} : null, usdt: usdtWallets > 0, paypal: paypalReady(paypal) ? {feePercent: paypal.feePercent, feeFixedCents: paypal.feeFixedCents} : null}, {headers});
  } catch { return Response.json({bank: false, ltc: null, usdt: false, paypal: null}, {headers}); }
}
