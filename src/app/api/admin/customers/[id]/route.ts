import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {passwordSchema, sameOrigin} from '@/lib/customer-rules';
import {customerDetail, deleteCustomer, lockCustomer, setCustomerPassword, signOutCustomerEverywhere, unlockCustomer} from '@/lib/customer-store';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const validId = (id: string) => /^[a-z0-9]{10,40}$/.test(id);

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const {id} = await params;
  if (!validId(id)) return json({error: 'Customer not found'}, 404);
  try {
    const detail = await customerDetail(id);
    return detail ? json(detail) : json({error: 'Customer not found'}, 404);
  } catch { return json({error: 'Customer could not be loaded.'}, 503); }
}

const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('lock'), reason: z.string().trim().max(200).default('')}),
  z.object({action: z.literal('unlock')}),
  z.object({action: z.literal('set-password'), password: passwordSchema, requireChange: z.boolean()}),
  z.object({action: z.literal('sign-out-everywhere')}),
  z.object({action: z.literal('delete'), confirmEmail: z.string().trim().toLowerCase()})
]);

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const {id} = await params;
  if (!validId(id)) return json({error: 'Customer not found'}, 404);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid action.'}, 400);
  try {
    const detail = await customerDetail(id);
    if (!detail) return json({error: 'Customer not found'}, 404);
    const input = parsed.data;
    if (input.action === 'lock') await lockCustomer(admin.email, id, input.reason);
    else if (input.action === 'unlock') await unlockCustomer(admin.email, id);
    else if (input.action === 'set-password') await setCustomerPassword(admin.email, id, input.password, input.requireChange);
    else if (input.action === 'sign-out-everywhere') await signOutCustomerEverywhere(admin.email, id);
    else {
      if (input.confirmEmail !== detail.customer.email) return json({error: 'Type the customer’s email exactly to confirm deletion.'}, 400);
      const outcome = await deleteCustomer(admin.email, id);
      return outcome === 'deleted' ? json({ok: true, deleted: true}) : json({ok: true, anonymized: true, ...(await customerDetail(id))});
    }
    return json({ok: true, ...(await customerDetail(id))});
  } catch (error) {
    console.error('Customer action failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The action could not be completed.'}, 503);
  }
}
