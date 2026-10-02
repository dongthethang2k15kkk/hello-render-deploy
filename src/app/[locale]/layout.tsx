import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {messages} from '@/i18n/messages';
import {CartProvider} from '@/components/cart-provider';
import {CatalogProvider} from '@/components/catalog-provider';
import Link from 'next/link';
import {SHOP_DISCORD_URL} from '@/lib/contact';
import {StoreHeader} from '@/components/store-ui';
import ChatWidget from '@/components/chat-widget';
import {headers} from 'next/headers';
import BackgroundSceneLayers from '@/components/background-scene';
import {getBackgroundScene} from '@/lib/background-scene';

export default async function LocaleLayout({children, params}: {
  children: React.ReactNode; params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (locale !== 'en') notFound();
  const t = messages[locale];
  if ((await headers()).get('x-shop-admin') === '1') {
    return <NextIntlClientProvider locale={locale} messages={t}>{children}</NextIntlClientProvider>;
  }
  return <NextIntlClientProvider locale={locale} messages={t}>
      <BackgroundSceneLayers scene={await getBackgroundScene()}/>
      <CatalogProvider><CartProvider>
        <StoreHeader/>
        <main className="shell">{children}</main>
        <ChatWidget/>
        <footer className="site-footer"><div className="shell footer-grid"><div><Link className="brand" href={`/${locale}`}>Jewish Horse</Link><p>Digital packages, delivered by appointment.</p></div><div><strong>Explore</strong><Link href={`/${locale}#catalog`}>{t.catalog}</Link><Link href={`/${locale}#faq`}>FAQ</Link><Link href={`/${locale}/privacy`}>Privacy Policy</Link><a href={SHOP_DISCORD_URL} target="_blank" rel="noreferrer">Contact on Discord</a></div><div><strong>GOOD TO KNOW</strong><p>{t.privacy}</p><p>{t.storage}</p></div></div><div className="shell footer-bottom">JEWISH HORSE <span>PAY BY BANK TRANSFER · VIETQR</span></div></footer>
      </CartProvider></CatalogProvider>
    </NextIntlClientProvider>;
}
