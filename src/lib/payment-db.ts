import {PrismaClient} from '@prisma/client';
const globalDb = globalThis as unknown as {paymentDb?: PrismaClient};
export function getPaymentDb() {
  const db = globalDb.paymentDb ?? new PrismaClient();
  globalDb.paymentDb = db;
  return db;
}