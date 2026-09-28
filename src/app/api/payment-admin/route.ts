import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {canManageReceivers, canProcessOrders, paymentRole} from '@/lib/payment-auth';
import {getPaymentDb} from '@/lib/payment-db';
import {receiverSchema, quoteMinor, nextPaymentStatus} from '@/lib/payment-rules';
import {cartSchema, totalUsdCents} from '@/lib/cart';

export const runtime = 'nodejs';
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data, (_, v) => typeof v === 'bigint' ? v.toString() : v), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
const commandSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('receiver'), id: z.string().optional(), receiver: receiverSchema}).strict(),
  z.object({action: z.literal('create'), requestKey: z.string().uuid(), method: z.enum(['bank', 'ltc']), lines: cartSchema.refine(v => v.length > 0)}).strict(),
  z.object({action: z.enum(['report', 'confirm', 'deliver']), id: z.string().min(1), evidence: z.string().trim().min(1).max(500)}).strict()
]);

export async function GET(request: Request) {
  const role = paymentRole(request);
  if (!role) return reply({error: 'Unauthorized'}, 401);
  if (!process.env.DATABASE_URL) return reply({error: 'Database is not configured'}, 503);
  try {
    const db = getPaymentDb();
    const [receivers, orders] = await Promise.all([db.paymentReceiver.findMany({orderBy: {lastAssigned: 'asc'}}), db.paymentOrder.findMany({take: 100, orderBy: {createdAt: 'desc'}, include: {events: true}})]);
    return reply({receivers, orders, role, staging: true});
  } catch {return reply({error: 'Database unavailable. Generate client and apply reviewed migration.'}, 503);}
}

export async function POST(request: Request) {
  const role = paymentRole(request);
  if (!canProcessOrders(role)) return reply({error: 'Unauthorized'}, 401);
  if (!process.env.DATABASE_URL) return reply({error: 'Database is not configured'}, 503);
  const raw = await request.text();
  if (raw.length > 20000) return reply({error: 'Payload too large'}, 413);
  let parsed;
  try {parsed = commandSchema.safeParse(JSON.parse(raw));} catch {return reply({error: 'Invalid JSON'}, 400);}
  if (!parsed.success) return reply({error: 'Invalid input'}, 400);
  const command = parsed.data;
  if (command.action === 'receiver' && !canManageReceivers(role)) return reply({error: 'Admin role required'}, 403);
  try {
    const db = getPaymentDb();
    // One transaction-wide lock serializes allocation, edits and confirmations across processes.
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(2072601)`;
      if (command.action === 'receiver') {
        return command.id ? tx.paymentReceiver.update({where: {id: command.id}, data: command.receiver}) : tx.paymentReceiver.create({data: command.receiver});
      }
      if (command.action === 'create') {
        const existing = await tx.paymentOrder.findUnique({where: {requestKey: command.requestKey}});
        if (existing) {
          if (existing.method !== command.method || !isDeepStrictEqual(existing.lines, command.lines)) throw new Error('Idempotency key already used');
          return existing;
        }
        const rate = process.env[command.method === 'bank' ? 'PAYMENT_VND_PER_USD' : 'PAYMENT_LITOSHI_PER_USD'] ?? '';
        const validUntil = Date.parse(process.env.PAYMENT_RATE_VALID_UNTIL ?? '');
        if (!Number.isFinite(validUntil) || validUntil <= Date.now()) throw new Error('Configure an unexpired, reviewed exchange rate');
        const cents = totalUsdCents(command.lines);
        const amount = quoteMinor(cents, rate);
        const receivers = await tx.paymentReceiver.findMany({where: {active: true, method: command.method}, orderBy: [{lastAssigned: 'asc'}, {id: 'asc'}]});
        for (const receiver of receivers) {
          // Expired unpaid orders remain pending: late transfers require manual reconciliation.
          const pending = await tx.paymentOrder.count({where: {receiverId: receiver.id, status: {in: ['PENDING', 'REVIEW']}}});
          if (pending >= receiver.pendingLimit) continue;
          await tx.paymentReceiver.update({where: {id: receiver.id}, data: {lastAssigned: new Date()}});
          return tx.paymentOrder.create({data: {
            requestKey: command.requestKey, receiverId: receiver.id,
            receiverSnapshot: {label: receiver.label, destination: receiver.destination, bank: receiver.bank, holder: receiver.holder, qrPath: receiver.qrPath},
            lines: command.lines, usdCents: cents, amountMinor: amount, unitsPerUsd: BigInt(rate), method: command.method,
            reference: `DH${randomUUID().replaceAll('-', '').toUpperCase()}`,
            expiresAt: new Date(Math.min(Date.now() + 15 * 60000, validUntil)),
            events: {create: {actor: role, action: 'CREATED_STAGING'}}
          }});
        }
        throw new Error('No receiving account available');
      }
      const order = await tx.paymentOrder.findUniqueOrThrow({where: {id: command.id}});
      const status = nextPaymentStatus(order.status, command.action);
      let transactionKey: string | undefined;
      if (command.action === 'confirm') {
        if (order.method === 'ltc' && !/^[a-fA-F0-9]{64}$/.test(command.evidence)) throw new Error('Enter a 64-character TXID');
        // A bank reference is scoped to its destination; an LTC TXID cannot pay two orders.
        const snapshot = order.receiverSnapshot as {bank: string; destination: string};
        transactionKey = order.method === 'ltc' ? `ltc:${command.evidence.toLowerCase()}` : `bank:${snapshot.bank.toLowerCase()}:${snapshot.destination}:${command.evidence.toLowerCase()}`;
      }
      return tx.paymentOrder.update({where: {id: order.id}, data: {status, transactionKey, ...(command.action === 'deliver' ? {deliveryNote: command.evidence} : {}), events: {create: {actor: role, action: `${command.action}: ${command.evidence}`}}}});
    });
    return reply(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) return reply({error: error.code === 'P2002' ? 'Transaction already assigned to another order' : 'Database operation failed'}, 409);
    const known = ['Invalid state transition', 'Invalid quote', 'Configure an unexpired, reviewed exchange rate', 'No receiving account available', 'Enter a 64-character TXID', 'Idempotency key already used'];
    return reply({error: error instanceof Error && known.includes(error.message) ? error.message : 'Payment operation unavailable'}, 409);
  }
}