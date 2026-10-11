import {publicAccount} from '@/lib/account-public';

export const runtime = 'nodejs';

/** One game account for the account page: public data only, cached for a minute. */
export async function GET(_request: Request, {params}: {params: Promise<{code: string}>}) {
  const {code} = await params;
  try {
    const account = await publicAccount(code.toUpperCase());
    if (!account) return Response.json({error: 'This account is no longer available.'}, {status: 404, headers: {'Cache-Control': 'public, max-age=30'}});
    return Response.json({account}, {headers: {'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'}});
  } catch { return Response.json({error: 'The account could not be loaded.'}, {status: 503, headers: {'Cache-Control': 'no-store'}}); }
}
