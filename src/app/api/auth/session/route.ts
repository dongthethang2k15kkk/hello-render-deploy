import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {unreadCount} from '@/lib/notifications';

export const runtime = 'nodejs';

export async function GET() {
  const account = await getSession();
  const unread = account?.role === 'user' ? await unreadCount(account.id).catch(() => 0) : 0;
  return NextResponse.json({account: account ? {id: account.id, name: account.name, role: account.role, mustChangePassword: Boolean(account.mustChangePassword), unread} : null}, {headers: {'Cache-Control': 'no-store'}});
}
