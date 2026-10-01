import { spawn } from 'child_process';

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('Set AUTH_SECRET to a random value of at least 32 characters before starting the container.');
  process.exit(1);
}

// Ensure PORT and HOSTNAME are set BEFORE any operations (Render.com provides PORT dynamically)
const PORT = process.env.PORT || '3000';
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

// Set them in process.env immediately so child processes inherit them
process.env.PORT = PORT;
process.env.HOSTNAME = HOSTNAME;

console.log(`[start-container] PORT=${PORT}, HOSTNAME=${HOSTNAME}`);

if (!process.env.DATABASE_URL) {
  console.error('[start-container] DATABASE_URL is not set. Configure a persistent external PostgreSQL database, or use compose.db.yaml on a self-hosted Docker machine.');
  process.exit(1);
}

// Run Prisma migrations before starting the app.
// The CLI lives in ./prisma-cli (self-contained install, see Dockerfile).
// Through a PgBouncer pooler (Neon "-pooler" hosts) Prisma's session advisory lock can stay held on a pooled
// connection and make the next deploy time out (P1002), so it is skipped there; Render runs a single instance.
const migrateEnv = {...process.env};
try {
  if (new URL(process.env.DATABASE_URL).hostname.includes('-pooler.')) migrateEnv.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1';
} catch {}
const MAX_MIGRATE_ATTEMPTS = 3;

function runMigrations(attempt = 1) {
  console.log(`[start-container] Running database migrations (attempt ${attempt}/${MAX_MIGRATE_ATTEMPTS})...`);
  const migrate = spawn('node', [
    'prisma-cli/node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'prisma/schema.prisma'
  ], {
    stdio: 'inherit',
    env: migrateEnv
  });

  migrate.on('close', (code) => {
    if (code !== 0) {
      // A sleeping Neon database can take a few seconds to wake up.
      if (attempt < MAX_MIGRATE_ATTEMPTS) {
        console.error(`[start-container] Migration failed with exit code ${code}; retrying in 5 seconds...`);
        setTimeout(() => runMigrations(attempt + 1), 5000);
        return;
      }
      console.error(`[start-container] Migration failed with exit code ${code}`);
      process.exit(code);
    }
    startServer();
  });

  migrate.on('error', (err) => {
    console.error('[start-container] Failed to run migrations:', err);
    process.exit(1);
  });
}

function startServer() {
  console.log('[start-container] Migrations completed successfully.');
  console.log(`[start-container] Starting Next.js server on ${HOSTNAME}:${PORT}...`);

  // Spawn server.js as a new process to ensure it reads PORT correctly
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    env: process.env
  });

  server.on('error', (err) => {
    console.error('[start-container] Failed to start server:', err);
    process.exit(1);
  });

  server.on('close', (code) => {
    console.log(`[start-container] Server exited with code ${code}`);
    process.exit(code);
  });
}

runMigrations();
