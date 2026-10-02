import './globals.css';
import type {Metadata} from 'next';
import RouteFeedback from '@/components/route-feedback';
export const metadata: Metadata = {
  title: 'Jewish Horse', robots: {index: false, follow: false}
};
export default function RootLayout({children}: {children: React.ReactNode}) {
  // Browser extensions such as Trancy may add attributes to <html> before
  // React hydrates. Ignore those external attribute differences.
  return <html lang="en" suppressHydrationWarning>
    <head>
      {/* Start the font downloads with the HTML instead of after the stylesheet is parsed. */}
      <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/>
      <link rel="preconnect" href="https://fonts.cdnfonts.com" crossOrigin="anonymous"/>
    </head>
    <body><RouteFeedback/>{children}</body>
  </html>;
}