import createNextIntlPlugin from 'next-intl/plugin';

export default createNextIntlPlugin('./src/i18n/request.ts')({
  output: 'standalone',
  // Server-only libraries for the SkyBlock accounts (networth and item data); keep them out of the bundle.
  serverExternalPackages: ['skyhelper-networth', 'prismarine-nbt'],
  distDir: process.env.NEXT_BUILD_DIR || '.next'
});