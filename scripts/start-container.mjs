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
  console.error('[start-container] DATABASE_URL is not set. Link the Render PostgreSQL database to this service.');
  process.exit(1);
}

// Run Prisma migrations before starting the app.
// The CLI lives in ./prisma-cli (self-contained install, see Dockerfile).
console.log('[start-container] Running database migrations...');
const migrate = spawn('node', [
  'prisma-cli/node_modules/prisma/build/index.js',
  'migrate',
  'deploy',
  '--schema',
  'prisma/schema.prisma'
], {
  stdio: 'inherit',
  env: process.env
});

migrate.on('close', (code) => {
  if (code !== 0) {
    console.error(`[start-container] Migration failed with exit code ${code}`);
    process.exit(code);
  }
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
});

migrate.on('error', (err) => {
  console.error('[start-container] Failed to run migrations:', err);
  process.exit(1);
});