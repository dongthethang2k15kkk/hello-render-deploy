import 'server-only';
import type {Prisma} from '@prisma/client';
import {recordAudit} from './audit';
import {deleteProblem, generateAccountCode, statusProblem} from './account-rules';
import {openLogin, sealLogin} from './account-vault';
import type {AccountInput} from './account-input';
import {formatVnd} from './money';
import {getPaymentDb} from './payment-db';
import {accountStatsSchema} from './skyblock-stats';

export class AccountError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

// The sealed login never leaves this file except through `revealLogin`.
const adminSelect = {
  id: true, code: true, ign: true, uuid: true, profileId: true, profileName: true, showIgn: true, title: true, description: true, priceVnd: true, salePriceVnd: true, status: true, sortOrder: true,
  imagePaths: true, stats: true, statsSource: true, statsLocked: true, statsFetchedAt: true, statsError: true, orderId: true, reservedAt: true, soldAt: true, adminNote: true, createdAt: true, updatedAt: true
} satisfies Prisma.GameAccountSelect;

type Row = Prisma.GameAccountGetPayload<{select: typeof adminSelect}>;
/** The account as the Admin pages see it: stats validated, images listed, never the login. */
export function adminAccountView(row: Row) {
  const stats = accountStatsSchema.safeParse(row.stats);
  const images = Array.isArray(row.imagePaths) ? row.imagePaths.filter((path): path is string => typeof path === 'string') : [];
  return {...row, imagePaths: images, stats: stats.success ? stats.data : null};
}

export async function listAccounts(status: string) {
  const db = getPaymentDb();
  const where: Prisma.GameAccountWhereInput = status !== 'all' ? {status} : {};
  const [rows, grouped] = await Promise.all([
    db.gameAccount.findMany({where, orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}], take: 300, select: adminSelect}),
    db.gameAccount.groupBy({by: ['status'], _count: true})
  ]);
  const counts: Record<string, number> = {all: 0};
  for (const item of grouped) { counts[item.status] = item._count; counts.all += item._count; }
  return {accounts: rows.map(adminAccountView), counts};
}

export async function getAccount(id: string) {
  const row = await getPaymentDb().gameAccount.findUnique({where: {id}, select: {...adminSelect, secretEnc: true}});
  if (!row) return null;
  const {secretEnc, ...rest} = row;
  const login = openLogin(secretEnc);
  return {...adminAccountView(rest), hasLogin: Boolean(login?.trim()), loginReadable: login !== null};
}

/** The login details, opened for an Admin who asked to see them. Recorded in Activity without the text. */
export async function revealLogin(adminEmail: string, id: string) {
  const row = await getPaymentDb().gameAccount.findUnique({where: {id}, select: {secretEnc: true, code: true}});
  if (!row) throw new AccountError('Account not found.', 404);
  const login = openLogin(row.secretEnc);
  if (login === null) throw new AccountError('The saved login details cannot be opened (AUTH_SECRET changed?). Replace them with the details you have.', 409);
  await recordAudit({actorEmail: adminEmail, action: 'account.secret_revealed', summary: `Revealed the login details of ${row.code}`, entityType: 'account', entityId: id});
  return login;
}

async function freshCode() {
  const db = getPaymentDb();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateAccountCode();
    if (!await db.gameAccount.findUnique({where: {code}, select: {id: true}})) return code;
  }
  throw new AccountError('Could not make a unique account code. Try again.', 503);
}

const dataOf = (input: AccountInput) => ({
  ign: input.ign, uuid: input.uuid, profileId: input.profileId, profileName: input.profileName, showIgn: input.showIgn, title: input.title, description: input.description,
  priceVnd: input.priceVnd, salePriceVnd: input.salePriceVnd, sortOrder: input.sortOrder, imagePaths: input.imagePaths,
  stats: input.stats ? input.stats as unknown as Prisma.InputJsonValue : undefined, statsSource: input.statsSource, statsLocked: input.statsLocked, adminNote: input.adminNote || null
});

function checkSale(input: AccountInput, hasLogin: boolean, current: string) {
  const problem = statusProblem({status: current, priceVnd: input.priceVnd, salePriceVnd: input.salePriceVnd, hasLogin}, input.status);
  if (problem) throw new AccountError(problem, 409);
}

export async function createAccount(adminEmail: string, input: AccountInput) {
  const login = (input.login ?? '').trim();
  checkSale(input, Boolean(login), 'draft');
  const code = await freshCode();
  const row = await getPaymentDb().gameAccount.create({data: {...dataOf(input), code, status: input.status, secretEnc: sealLogin(login), statsFetchedAt: input.stats ? new Date(input.stats.fetchedAt) : null}, select: {id: true, code: true}});
  await recordAudit({actorEmail: adminEmail, action: 'account.created', summary: `Added account ${row.code} · ${input.title} · ${formatVnd(input.priceVnd)} (${input.status})`, entityType: 'account', entityId: row.id});
  return row;
}

export async function updateAccount(adminEmail: string, id: string, input: AccountInput) {
  const db = getPaymentDb();
  const current = await db.gameAccount.findUnique({where: {id}, select: {status: true, secretEnc: true, code: true, statsFetchedAt: true, stats: true}});
  if (!current) throw new AccountError('Account not found.', 404);
  if (current.status === 'reserved' || current.status === 'sold') {
    // An account in an order keeps its price, login and stats; only the private note may change.
    await db.gameAccount.update({where: {id}, data: {adminNote: input.adminNote || null}});
    await recordAudit({actorEmail: adminEmail, action: 'account.note', summary: `Changed the note of ${current.code} (${current.status})`, entityType: 'account', entityId: id});
    return {code: current.code, onlyNote: true};
  }
  const newLogin = input.login?.trim();
  const hasLogin = newLogin ? true : Boolean(openLogin(current.secretEnc)?.trim());
  checkSale(input, hasLogin, current.status);
  const data = dataOf(input);
  await db.gameAccount.update({where: {id}, data: {...data, status: input.status, ...(newLogin ? {secretEnc: sealLogin(newLogin)} : {}), ...(input.stats && input.stats.fetchedAt !== (current.stats as {fetchedAt?: string} | null)?.fetchedAt ? {statsFetchedAt: new Date(input.stats.fetchedAt)} : {})}});
  await recordAudit({actorEmail: adminEmail, action: 'account.updated', summary: `Updated account ${current.code} · ${input.title} · ${formatVnd(input.priceVnd)} (${input.status})${newLogin ? ' · login details replaced' : ''}`, entityType: 'account', entityId: id});
  return {code: current.code, onlyNote: false};
}

export async function setAccountStatus(adminEmail: string, id: string, target: string) {
  const db = getPaymentDb();
  const row = await db.gameAccount.findUnique({where: {id}, select: {status: true, priceVnd: true, salePriceVnd: true, secretEnc: true, code: true}});
  if (!row) throw new AccountError('Account not found.', 404);
  const problem = statusProblem({status: row.status, priceVnd: row.priceVnd, salePriceVnd: row.salePriceVnd, hasLogin: Boolean(openLogin(row.secretEnc)?.trim())}, target);
  if (problem) throw new AccountError(problem, 409);
  const changed = await db.gameAccount.updateMany({where: {id, status: row.status}, data: {status: target}});
  if (changed.count !== 1) throw new AccountError('The account changed meanwhile. Reload and try again.', 409);
  await recordAudit({actorEmail: adminEmail, action: 'account.status', summary: `Account ${row.code}: ${row.status} → ${target}`, entityType: 'account', entityId: id});
}

export async function deleteAccount(adminEmail: string, id: string) {
  const db = getPaymentDb();
  const row = await db.gameAccount.findUnique({where: {id}, select: {status: true, orderId: true, code: true, title: true}});
  if (!row) throw new AccountError('Account not found.', 404);
  const problem = deleteProblem(row, await db.orderItem.count({where: {accountId: id}}) > 0);
  if (problem) throw new AccountError(problem, 409);
  await db.gameAccount.delete({where: {id}});
  await recordAudit({actorEmail: adminEmail, action: 'account.deleted', summary: `Deleted account ${row.code} · ${row.title}`, entityType: 'account', entityId: id});
}

/** Image paths in use by accounts, so image cleanup never removes them. */
export async function accountImagePaths() {
  if (!process.env.DATABASE_URL) return new Set<string>();
  const rows = await getPaymentDb().gameAccount.findMany({select: {imagePaths: true}});
  return new Set(rows.flatMap(row => Array.isArray(row.imagePaths) ? row.imagePaths.filter((path): path is string => typeof path === 'string') : []));
}
