import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {adminTestEmail} from '@/lib/email-templates';
import {disconnectMail, mailStatus, sendMail} from '@/lib/mailer';
import {appOrigin, parseAllowlist} from '@/lib/oauth-helpers';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

async function state() {
  const [connection, logs] = await Promise.all([
    mailStatus(),
    getPaymentDb().emailLog.findMany({orderBy: {createdAt: 'desc'}, take: 50, select: {id: true, recipient: true, subject: true, kind: true, status: true, error: true, orderId: true, createdAt: true}})
  ]);
  return {connection, logs, adminRecipients: parseAllowlist(process.env.ADMIN_GOOGLE_EMAILS)};
}

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json(await state()); } catch { return json({error: 'Email settings could not be loaded.'}, 503); }
}

/** Sends a test message to every Admin email, proving the connection end to end. */
export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  const connection = await mailStatus();
  if (!connection) return json({error: 'Connect Gmail first.'}, 409);
  const recipients = parseAllowlist(process.env.ADMIN_GOOGLE_EMAILS);
  const result = await sendMail({to: recipients.length ? recipients : [admin.email], ...adminTestEmail({sender: connection.email, adminUrl: `${appOrigin(request.url)}/en/admin`}), kind: 'admin.test'});
  await recordAudit({actorEmail: admin.email, action: 'email.test', summary: `Sent a test email (${result.status})`, entityType: 'email'});
  return json({result, ...(await state())}, result.status === 'sent' ? 200 : 502);
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  await disconnectMail();
  await recordAudit({actorEmail: admin.email, action: 'email.disconnected', summary: 'Disconnected the Gmail sender', entityType: 'email'});
  return json({ok: true, ...(await state())});
}
