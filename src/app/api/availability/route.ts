import {onlineCount} from '@/lib/availability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live status for the store: how many Admins are online to trade right now (no names). */
export async function GET() {
  const online = await onlineCount().catch(() => 0);
  return Response.json({online}, {headers: {'Cache-Control': 'no-store'}});
}
