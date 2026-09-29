import {PrismaClient} from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const db = new PrismaClient();

try {
  const [
    products,
    productTranslations,
    packages,
    packageTranslations,
    deliveryForms,
    productImages,
    paymentReceivers,
    paymentOrders,
    paymentEvents,
    databaseTime
  ] = await Promise.all([
    db.product.count(),
    db.productTranslation.count(),
    db.package.count(),
    db.packageTranslation.count(),
    db.deliveryForm.count(),
    db.productImage.count(),
    db.paymentReceiver.count(),
    db.paymentOrder.count(),
    db.paymentEvent.count(),
    db.$queryRaw`SELECT CURRENT_TIMESTAMP AS now`
  ]);

  const host = new URL(process.env.DATABASE_URL).hostname;
  console.log(JSON.stringify({
    ok: true,
    host,
    databaseTime: databaseTime[0]?.now,
    rows: {products, productTranslations, packages, packageTranslations, deliveryForms, productImages, paymentReceivers, paymentOrders, paymentEvents}
  }, null, 2));
} catch (error) {
  console.error(`Database check failed: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
