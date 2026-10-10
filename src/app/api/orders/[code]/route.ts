import QRCode from 'qrcode';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {appOrigin} from '@/lib/oauth-helpers';
import {isCrypto, orderCodePattern, paymentKind, reportSchema, timingSchema, type BankSnapshot, type PaypalSnapshot, type WalletSnapshot} from '@/lib/order-rules';
import {cancelByCustomer, customerOrder, OrderError, reportTransfer, updateTimes} from '@/lib/order-store';
import {litecoinUri} from '@/lib/ltc-format';
import {paypalMeLink} from '@/lib/paypal';
import {vietQrPayload} from '@/lib/vietqr';
import {checkCryptoOrder} from '@/lib/payment-detection';
import {mailStatus} from '@/lib/mailer';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET(request: Request, {params}: {params: Promise<{code: string}>}) {
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in required.'}, 401);
  const {code} = await params;
  if (!orderCodePattern.test(code)) return json({error: 'Order not found.'}, 404);
  try {
    let order = await customerOrder(account.id, code);
    if (!order) return json({error: 'Order not found.'}, 404);
    if (isCrypto(order.paymentMethod) && ['awaiting_payment', 'payment_reported'].includes(order.status)) {
      const check = await checkCryptoOrder(order.id, appOrigin(request.url));
      if (check?.seen) order = (await customerOrder(account.id, code)) ?? order;
    }
    // Crypto payments are detected on the blockchain, so the page updates by itself when the money arrives.
    const autoDetect = isCrypto(order.paymentMethod);
    let qrSvg: string | null = null;
    let paymentUri: string | null = null;
    if (order.status === 'awaiting_payment') {
      const kind = paymentKind(order);
      let payload: string;
      if (kind === 'paypal') {
        // The PayPal.me link opens the payment screen with the exact USD amount filled in.
        paymentUri = paypalMeLink((order.bankSnapshot as PaypalSnapshot).paypalMe, order.cryptoAmount ?? '');
        payload = paymentUri;
      } else if (kind === 'crypto') {
        // TRON wallets scan a plain address (the amount is typed in); Litecoin wallets read the amount from the link.
        const wallet = order.bankSnapshot as WalletSnapshot;
        paymentUri = order.paymentMethod === 'usdt' ? wallet.address : litecoinUri(wallet.address, order.cryptoAmount ?? '', order.code);
        payload = paymentUri;
      } else {
        const bank = order.bankSnapshot as BankSnapshot;
        payload = vietQrPayload({bankBin: bank.bankBin, accountNumber: bank.accountNumber, amountVnd: order.totalVnd, note: order.code});
      }
      qrSvg = await QRCode.toString(payload, {type: 'svg', margin: 1, errorCorrectionLevel: 'M'});
    }
    // The shop's sending address, so the order page can tell customers which emails to look for in Spam.
    const mailFrom = (await mailStatus().catch(() => null))?.email ?? null;
    return json({order, qrSvg, paymentUri, autoDetect, mailFrom, serverTime: new Date().toISOString()});
  } catch (error) {
    console.error('Order load failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'This order is unavailable right now.'}, 503);
  }
}

const action = z.discriminatedUnion('action', [
  reportSchema.extend({action: z.literal('report')}),
  timingSchema.extend({action: z.literal('update-times')}),
  z.object({action: z.literal('cancel')})
]);

export async function POST(request: Request, {params}: {params: Promise<{code: string}>}) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in required.'}, 401);
  const {code} = await params;
  if (!orderCodePattern.test(code)) return json({error: 'Order not found.'}, 404);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid request.'}, 400);
  try {
    const input = parsed.data;
    if (input.action === 'report') await reportTransfer(account, code, input, appOrigin(request.url));
    else if (input.action === 'update-times') await updateTimes(account.id, code, input, appOrigin(request.url));
    else await cancelByCustomer(account.id, code);
    return json({ok: true});
  } catch (error) {
    if (error instanceof OrderError) return json({error: error.message}, error.status);
    console.error('Order action failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The action could not be completed. Please try again.'}, 503);
  }
}
