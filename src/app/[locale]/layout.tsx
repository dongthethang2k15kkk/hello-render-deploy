import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {messages} from '@/i18n/messages';
import {CartProvider} from '@/components/cart-provider';
import Link from 'next/link';
import {StoreHeader} from '@/components/store-ui';
import ChatWidget from '@/components/chat-widget';

export default async function LocaleLayout({children, params}: {
  children: React.ReactNode; params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (locale !== 'vi' && locale !== 'en') notFound();
  const t = messages[locale];
  return <NextIntlClientProvider locale={locale} messages={t}>
      <CartProvider>
        <div className="demo">{t.demo}</div>
        <StoreHeader/>
        <main className="shell">{children}</main>
        <ChatWidget/>
        <footer className="site-footer"><div className="shell footer-grid"><div><Link className="brand" href={`/${locale}`}>SHOP / CONCEPT</Link><p>{locale === 'vi' ? 'Giao diện thử nghiệm. Thương hiệu chưa chốt.' : 'A storefront concept. Final branding is not set.'}</p></div><div><strong>{locale === 'vi' ? 'Khám phá' : 'Explore'}</strong><Link href={`/${locale}#catalog`}>{t.catalog}</Link><Link href={`/${locale}#faq`}>FAQ</Link></div><div><strong>PREVIEW ONLY</strong><p>{t.privacy}</p><p>{t.storage}</p></div></div><div className="shell footer-bottom">VIETNAM · USA · EUROPE · AUSTRALIA <span>UI / UX PROTOTYPE</span></div></footer>
      </CartProvider>
    </NextIntlClientProvider>;
}