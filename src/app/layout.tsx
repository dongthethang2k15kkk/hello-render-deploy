import './globals.css';
import type {Metadata} from 'next';
export const metadata: Metadata = {
  title: 'Jewish Horse', robots: {index: false, follow: false}
};
export default function RootLayout({children}: {children: React.ReactNode}) {
  // Browser extensions such as Trancy may add attributes to <html> before
  // React hydrates. Ignore those external attribute differences.
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}