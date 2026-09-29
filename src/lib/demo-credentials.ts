// Public sample customer accounts for the demo login picker; never use these credentials in production.
// Admin access is Google sign-in only (see src/lib/oauth-helpers.ts).
export const demoCredentials = [
  {id: 'demo-user', username: 'customer', name: 'Demo Customer', role: 'user', password: 'customer123'},
  {id: 'demo-user-2', username: 'customer2', name: 'Demo Customer 2', role: 'user', password: 'customer2123'},
] as const;