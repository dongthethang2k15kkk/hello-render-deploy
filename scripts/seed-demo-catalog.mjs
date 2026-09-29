import {PrismaClient} from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

if (!process.argv.includes('--confirm-demo')) {
  console.error('Refusing to write without --confirm-demo. This command creates or updates clearly labeled demo catalog data.');
  process.exit(1);
}

const demoProducts = [
  {
    slug: 'sample-basic',
    category: 'demo',
    sortOrder: 0,
    imagePath: '',
    active: true,
    title: 'Basic sample package',
    description: 'Test data for the shopping flow. This is not an offered service.',
    package: {
      sku: 'SAMPLE_BASIC',
      baseUsdCents: 1000,
      saleUsdCents: null,
      stockOnHand: 5,
      active: true,
      title: 'Basic sample package',
      description: 'Test data for the shopping flow. This is not an offered service.',
      fields: [
        {key: 'recipient', labelEn: 'Recipient name (test data)', required: true, maxLength: 80}
      ]
    }
  },
  {
    slug: 'sample-plus',
    category: 'demo',
    sortOrder: 1,
    imagePath: '',
    active: true,
    title: 'Extended sample package',
    description: 'Demonstrates a different delivery form. Payment is unavailable.',
    package: {
      sku: 'SAMPLE_PLUS',
      baseUsdCents: 2500,
      saleUsdCents: null,
      stockOnHand: 5,
      active: true,
      title: 'Extended sample package',
      description: 'Demonstrates a different delivery form. Payment is unavailable.',
      fields: [
        {key: 'recipient', labelEn: 'Recipient name (test data)', required: true, maxLength: 80},
        {key: 'note', labelEn: 'Delivery note (no sensitive information)', required: false, maxLength: 300}
      ]
    }
  }
];

const db = new PrismaClient();
let connected = false;

try {
  await db.$connect();
  connected = true;
  const seeded = await db.$transaction(async tx => {
    const results = [];

    for (const item of demoProducts) {
      const product = await tx.product.upsert({
        where: {slug: item.slug},
        update: {
          category: item.category,
          sortOrder: item.sortOrder,
          imagePath: item.imagePath,
          active: item.active
        },
        create: {
          slug: item.slug,
          category: item.category,
          sortOrder: item.sortOrder,
          imagePath: item.imagePath,
          active: item.active
        }
      });

      await tx.productTranslation.upsert({
        where: {productId_locale: {productId: product.id, locale: 'en'}},
        update: {title: item.title, description: item.description},
        create: {productId: product.id, locale: 'en', title: item.title, description: item.description}
      });

      const packageRecord = await tx.package.upsert({
        where: {sku: item.package.sku},
        update: {
          productId: product.id,
          baseUsdCents: item.package.baseUsdCents,
          saleUsdCents: item.package.saleUsdCents,
          stockOnHand: item.package.stockOnHand,
          active: item.package.active
        },
        create: {
          productId: product.id,
          sku: item.package.sku,
          baseUsdCents: item.package.baseUsdCents,
          saleUsdCents: item.package.saleUsdCents,
          stockOnHand: item.package.stockOnHand,
          active: item.package.active
        }
      });

      await tx.packageTranslation.upsert({
        where: {packageId_locale: {packageId: packageRecord.id, locale: 'en'}},
        update: {title: item.package.title, description: item.package.description},
        create: {
          packageId: packageRecord.id,
          locale: 'en',
          title: item.package.title,
          description: item.package.description
        }
      });

      const latestForm = await tx.deliveryForm.findFirst({
        where: {packageId: packageRecord.id},
        orderBy: {version: 'desc'}
      });
      if (JSON.stringify(latestForm?.fields ?? []) !== JSON.stringify(item.package.fields)) {
        await tx.deliveryForm.create({
          data: {
            packageId: packageRecord.id,
            version: (latestForm?.version ?? 0) + 1,
            fields: item.package.fields
          }
        });
      }

      results.push({slug: product.slug, sku: packageRecord.sku});
    }

    return results;
  }, {maxWait: 10000, timeout: 30000});

  const host = new URL(process.env.DATABASE_URL).hostname;
  console.log(JSON.stringify({ok: true, host, seeded}, null, 2));
} catch (error) {
  console.error(`Demo catalog seed failed: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  if (connected) await db.$disconnect();
}
