if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  console.error('Set AUTH_SECRET to a random value of at least 32 characters before starting the container.');
  process.exit(1);
}
await import('../server.js');