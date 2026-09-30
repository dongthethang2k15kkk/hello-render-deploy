import {appOrigin} from '@/lib/oauth-helpers';
import {handleSepayTransfer, sepayAuthorized, type SepayPayload} from '@/lib/payment-detection';

export const runtime = 'nodejs';

/**
 * SePay calls this when money arrives in the shop's bank account (header "Authorization: Apikey <key>").
 * Any 2xx stops SePay retrying, so handled-but-unmatched transfers still answer success.
 */
export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return Response.json({success: false}, {status: 503});
  if (!await sepayAuthorized(request.headers.get('authorization'))) return Response.json({success: false, error: 'Unauthorized'}, {status: 401});
  const payload = await request.json().catch(() => null) as SepayPayload | null;
  if (!payload || typeof payload !== 'object') return Response.json({success: false, error: 'Invalid JSON'}, {status: 400});
  try {
    const outcome = await handleSepayTransfer(payload, appOrigin(request.url));
    return Response.json({success: true, outcome}, {status: outcome === 'invalid' ? 400 : 200});
  } catch (error) {
    console.error('SePay webhook failed', error instanceof Error ? error.message : error);
    return Response.json({success: false}, {status: 500});
  }
}
