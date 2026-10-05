import {currentCustomerSession} from '@/lib/auth';
import {getLuckyWheelState, spinLuckyWheel} from '@/lib/lucky-wheel';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  const session = await currentCustomerSession();
  if (!session) return json({error: 'Sign in to use the lucky wheel.'}, 401);
  try { return json(await getLuckyWheelState(session.customerId)); }
  catch { return json({error: 'Lucky wheel could not be loaded.'}, 503); }
}

export async function POST(request: Request) {
  const session = await currentCustomerSession();
  if (!session) return json({error: 'Sign in to use the lucky wheel.'}, 401);
  const body = await request.json().catch(() => ({}));
  if (typeof body.spinId !== 'string' || !body.spinId) return json({error: 'Choose an available spin.'}, 400);
  try { return json(await spinLuckyWheel(session.customerId, body.spinId)); }
  catch (error) { return json({error: error instanceof Error ? error.message : 'Spin failed.'}, 409); }
}
