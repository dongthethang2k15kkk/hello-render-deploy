import {runHousekeeping} from '@/lib/housekeeping';
import {appOrigin} from '@/lib/oauth-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Periodic housekeeping, called every 15 minutes in the daytime by a GitHub Actions schedule (Render Free has no
 * cron). It only does work that is due and never twice, so it is safe to leave public; calls within a minute are ignored.
 */
export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) return Response.json({ok: false}, {status: 503});
  try {
    const result = await runHousekeeping(appOrigin(request.url));
    return Response.json(result ? {ok: true, ...result} : {ok: true, skipped: true}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error('Tick failed', error instanceof Error ? error.message : error);
    return Response.json({ok: false}, {status: 500});
  }
}
