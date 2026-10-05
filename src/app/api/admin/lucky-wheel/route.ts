import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {listLuckyPrizes, listLuckySpinHistory, saveLuckyPrizes} from '@/lib/lucky-wheel';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const prize = z.object({id: z.string().optional(), label: z.string().trim().min(1).max(80), coinAmount: z.number().int().positive().max(2_147_483_647), weight: z.number().int().min(0).max(1_000_000), active: z.boolean(), sortOrder: z.number().int().min(0).max(10_000)});

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json({prizes: await listLuckyPrizes(), history: await listLuckySpinHistory()}); }
  catch { return json({error: 'Lucky wheel settings could not be loaded.'}, 503); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = z.object({prizes: z.array(prize).min(1).max(100)}).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid prizes.'}, 400);
  try { return json({ok: true, ...(await saveLuckyPrizes(admin.email, parsed.data.prizes))}); }
  catch { return json({error: 'Lucky wheel settings could not be saved.'}, 503); }
}
