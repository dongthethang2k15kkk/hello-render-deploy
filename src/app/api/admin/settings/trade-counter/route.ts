import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {tradeCounterSchema} from '@/lib/trade-counter-rules';
import {getTradeCounterState, setTradeCounterSettings} from '@/lib/trade-stats';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try {
    return json(await getTradeCounterState());
  } catch {
    return json({error: 'Trade counter settings could not be loaded.'}, 503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = tradeCounterSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: 'Previous completed trades must be a whole number from 0 to 100,000,000.'}, 400);
  try {
    await setTradeCounterSettings(parsed.data, admin.email);
    const state = await getTradeCounterState();
    await recordAudit({
      actorEmail: admin.email,
      action: 'settings.trade_counter',
      summary: `Set previous completed trades to ${state.historicalCompleted.toLocaleString('en-US')}; ${state.shopCompleted.toLocaleString('en-US')} completed shop orders; ${state.total.toLocaleString('en-US')} shown`,
      entityType: 'settings'
    });
    return json({ok: true, ...state});
  } catch {
    return json({error: 'Trade counter settings could not be saved.'}, 503);
  }
}
