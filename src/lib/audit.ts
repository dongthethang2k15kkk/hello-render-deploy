import 'server-only';
import {getPaymentDb} from './payment-db';

export type AuditEntity = 'customer' | 'order' | 'product' | 'settings' | 'email' | 'account';

/** Records an Admin action for the Activity page. Failures are logged, never thrown, so the action itself still succeeds. */
export async function recordAudit(entry: {actorEmail: string; action: string; summary: string; entityType: AuditEntity; entityId?: string | null; customerId?: string | null}) {
  try {
    await getPaymentDb().auditLog.create({data: {
      actorEmail: entry.actorEmail, action: entry.action, summary: entry.summary.slice(0, 500), entityType: entry.entityType,
      entityId: entry.entityId ?? null, customerId: entry.customerId ?? null
    }});
  } catch (error) {
    console.error('Audit log write failed', error instanceof Error ? error.message.split('\n')[0] : error);
  }
}
