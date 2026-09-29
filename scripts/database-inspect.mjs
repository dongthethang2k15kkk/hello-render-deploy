import {PrismaClient} from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const db = new PrismaClient();
let connected = false;

try {
  await db.$connect();
  connected = true;
  const tables = await db.$queryRaw`
    SELECT table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const readableTables = [];
  for (const {tableName} of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) throw new Error('Unexpected table identifier');
    const [{count}] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
    readableTables.push({table: tableName, rows: count});
  }
  const host = new URL(process.env.DATABASE_URL).hostname;
  console.log(JSON.stringify({ok: true, host, readableTableCount: readableTables.length, tables: readableTables}, null, 2));
} catch (error) {
  console.error(`Database inspection failed: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  if (connected) await db.$disconnect();
}
