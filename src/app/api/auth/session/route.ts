import {NextResponse} from 'next/server';
import {getSession} from '@/lib/demo-auth';
export async function GET() {
  const account = await getSession();
  return NextResponse.json({account: account ? {id: account.id, name: account.name, role: account.role} : null}, {headers: {'Cache-Control': 'no-store'}});
}