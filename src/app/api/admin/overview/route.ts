import {getSession} from '@/lib/auth';
import {mailStatus} from '@/lib/mailer';
import {overview} from '@/lib/order-store';
import {getPaymentDb} from '@/lib/payment-db';
import {getVndPerUsd} from '@/lib/store-settings';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try {
    const [stats, mail, bankAccounts, vndPerUsd] = await Promise.all([overview(), mailStatus(), getPaymentDb().bankAccount.count({where: {active: true}}), getVndPerUsd()]);
    return json({...stats, mail, setup: {bankAccounts, gmail: Boolean(mail), vndPerUsd}});
  } catch (error) {
    console.error('Overview failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The overview could not be loaded.'}, 503);
  }
}
