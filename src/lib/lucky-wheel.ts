import {randomInt} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {getPaymentDb} from './payment-db';

export const DEFAULT_LUCKY_PRIZES = [
  {label: '5M coins', coinAmount: 5_000_000, weight: 40, sortOrder: 0},
  {label: '10M coins', coinAmount: 10_000_000, weight: 25, sortOrder: 1},
  {label: '50M coins', coinAmount: 50_000_000, weight: 18, sortOrder: 2},
  {label: '100M coins', coinAmount: 100_000_000, weight: 12, sortOrder: 3},
  {label: '500M coins', coinAmount: 500_000_000, weight: 5, sortOrder: 4}
] as const;

export type LuckyPrizeInput = {id?: string; label: string; coinAmount: number; weight: number; active: boolean; sortOrder: number};

export async function ensureLuckyWheelPrizes(db = getPaymentDb()) {
  const existing = await db.luckyWheelPrize.count();
  if (existing > 0) return;
  await db.$transaction(DEFAULT_LUCKY_PRIZES.map(prize => db.luckyWheelPrize.create({data: prize})));
}

export async function listLuckyPrizes() {
  await ensureLuckyWheelPrizes();
  return getPaymentDb().luckyWheelPrize.findMany({orderBy: [{sortOrder: 'asc'}, {createdAt: 'asc'}]});
}

export async function getLuckyWheelState(customerId: string) {
  await ensureLuckyWheelPrizes();
  const db = getPaymentDb();
  const [available, history, prizes] = await Promise.all([
    db.luckySpin.findMany({where: {customerId, spunAt: null}, orderBy: {createdAt: 'asc'}, select: {id: true, orderId: true, createdAt: true}}),
    db.luckySpin.findMany({where: {customerId, spunAt: {not: null}}, orderBy: {spunAt: 'desc'}, take: 30, select: {id: true, prizeLabel: true, coinAmount: true, spunAt: true, createdAt: true}}),
    db.luckyWheelPrize.findMany({where: {active: true}, orderBy: [{sortOrder: 'asc'}, {createdAt: 'asc'}], select: {id: true, label: true, coinAmount: true, weight: true, sortOrder: true}})
  ]);
  return {available, history, prizes};
}

function choosePrize(prizes: {id: string; label: string; coinAmount: number; weight: number}[]) {
  const eligible = prizes.filter(prize => prize.weight > 0);
  const total = eligible.reduce((sum, prize) => sum + prize.weight, 0);
  if (!total) throw new Error('No active lucky wheel prizes are configured.');
  let cursor = randomInt(total);
  for (const prize of eligible) {
    if (cursor < prize.weight) return prize;
    cursor -= prize.weight;
  }
  return eligible.at(-1)!;
}

export async function spinLuckyWheel(customerId: string, spinId: string) {
  const db = getPaymentDb();
  return db.$transaction(async tx => {
    const spin = await tx.luckySpin.findFirst({where: {id: spinId, customerId}, select: {id: true, spunAt: true}});
    if (!spin) throw new Error('Spin not found.');
    if (spin.spunAt) throw new Error('This spin has already been used.');
    const prizes = await tx.luckyWheelPrize.findMany({where: {active: true}, orderBy: [{sortOrder: 'asc'}, {createdAt: 'asc'}], select: {id: true, label: true, coinAmount: true, weight: true}});
    const prize = choosePrize(prizes);
    const updated = await tx.luckySpin.updateMany({where: {id: spinId, customerId, spunAt: null}, data: {prizeId: prize.id, prizeLabel: prize.label, coinAmount: prize.coinAmount, spunAt: new Date()}});
    if (updated.count !== 1) throw new Error('This spin was already used.');
    return {id: spinId, prize};
  });
}

export async function saveLuckyPrizes(adminEmail: string, input: LuckyPrizeInput[]) {
  const db = getPaymentDb();
  await db.$transaction(async tx => {
    const ids = input.flatMap(item => item.id ? [item.id] : []);
    if (ids.length) await tx.luckyWheelPrize.deleteMany({where: {id: {notIn: ids}}});
    else await tx.luckyWheelPrize.deleteMany();
    for (const [index, item] of input.entries()) {
      const data = {label: item.label.trim().slice(0, 80), coinAmount: item.coinAmount, weight: item.weight, active: item.active, sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index};
      if (item.id) await tx.luckyWheelPrize.update({where: {id: item.id}, data});
      else await tx.luckyWheelPrize.create({data});
    }
  });
  return {adminEmail, prizes: await listLuckyPrizes()};
}

export async function listLuckySpinHistory() {
  return getPaymentDb().luckySpin.findMany({orderBy: {createdAt: 'desc'}, take: 200, include: {customer: {select: {name: true, email: true}}, order: {select: {code: true}}, prize: {select: {label: true}}}});
}

export type LuckyTx = Prisma.TransactionClient;
