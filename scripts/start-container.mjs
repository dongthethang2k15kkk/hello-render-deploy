import { spawn } from 'child_process';

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('Set AUTH_SECRET to a random value of at least 32 characters before starting the container.');
  process.exit(1);
}

// Ensure PORT is set (Render.com provides this dynamically)
const PORT = process.env.PORT || 3000;
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

console.log(`Server will bind to ${HOSTNAME}:${PORT}`);

// Run Prisma migrations before starting the app
console.log('Running database migrations...');
const migrate = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true
});

migrate.on('close', (code) => {
  if (code !== 0) {
    console.error(`Migration failed with exit code ${code}`);
    process.exit(code);
  }
  console.log('Migrations completed successfully. Starting server...');
  
  // Set env vars for Next.js standalone server
  process.env.PORT = PORT;
  process.env.HOSTNAME = HOSTNAME;
  
  import('../server.js');
});

migrate.on('error', (err) => {
  console.error('Failed to run migrations:', err);
  process.exit(1);
});