import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {customerUnreadCount} from '@/lib/chat-store';
import {unreadCount} from '@/lib/notifications';
import {getCoinBalance} from '@/lib/coin-ledger';

export const runtime = 'nodejs';

export async function GET() {
  const account = await getSession();
  const [unread, chatUnread, coinBalance] = account?.role === 'user'
    ? await Promise.all([unreadCount(account.id).catch(() => 0), customerUnreadCount(account.id).catch(() => 0), getCoinBalance(account.id).catch(() => BigInt(0))])
    : [0, 0, BigInt(0)];
  return NextResponse.json({account: account ? {id: account.id, name: account.name, role: account.role, mustChangePassword: Boolean(account.mustChangePassword), unread, chatUnread, ...(account.role === 'user' ? {coinBalance: coinBalance.toString()} : {})} : null}, {headers: {'Cache-Control': 'no-store'}});
}
