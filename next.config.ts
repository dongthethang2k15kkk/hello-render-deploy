import createNextIntlPlugin from 'next-intl/plugin';

export default createNextIntlPlugin('./src/i18n/request.ts')({
  output: 'standalone',
  distDir: process.env.NEXT_BUILD_DIR || '.next'
});