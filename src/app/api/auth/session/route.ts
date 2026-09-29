import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const account = await getSession();
  return NextResponse.json({account: account ? {id: account.id, name: account.name, role: account.role, mustChangePassword: Boolean(account.mustChangePassword)} : null}, {headers: {'Cache-Control': 'no-store'}});
}
