import {NextResponse} from 'next/server';
import {devAdminLoginEnabled, discordConfig, googleConfig} from '@/lib/oauth-helpers';

export async function GET() {
  return NextResponse.json({google: Boolean(googleConfig()), discord: Boolean(discordConfig()), devAdmin: devAdminLoginEnabled()}, {headers: {'Cache-Control': 'no-store'}});
}
