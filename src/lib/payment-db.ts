import {PrismaClient} from '@prisma/client';
const globalDb = globalThis as unknown as {paymentDb?: PrismaClient};
export const paymentDb = globalDb.paymentDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.paymentDb = paymentDb;