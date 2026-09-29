import {NextResponse} from 'next/server';
import {devAdminLoginEnabled, googleConfig} from '@/lib/oauth-helpers';

export async function GET() {
  return NextResponse.json({google: Boolean(googleConfig()), devAdmin: devAdminLoginEnabled()}, {headers: {'Cache-Control': 'no-store'}});
}
