import './globals.css';
import {headers} from 'next/headers';
import type {Metadata} from 'next';
export const metadata: Metadata = {
  title: 'Shop Demo', robots: {index: false, follow: false}
};
export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = (await headers()).get('x-shop-locale') === 'en' ? 'en' : 'vi';
  // Browser extensions such as Trancy may add attributes to <html> before
  // React hydrates. Ignore those external attribute differences.
  return <html lang={locale} suppressHydrationWarning><body>{children}</body></html>;
}