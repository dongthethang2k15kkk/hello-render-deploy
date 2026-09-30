import {getSession} from '@/lib/auth';
import {adminUnreadByCustomer} from '@/lib/chat-store';
import {needsActionCount} from '@/lib/order-store';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

/** Badge numbers for the Admin navigation: orders needing action and unread customer chat messages. */
export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({orders: 0, chat: 0});
  try {
    const [orders, unread] = await Promise.all([needsActionCount(), adminUnreadByCustomer()]);
    return json({orders, chat: [...unread.values()].reduce((sum, value) => sum + value, 0)});
  } catch { return json({orders: 0, chat: 0}); }
}
