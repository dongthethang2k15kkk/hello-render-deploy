import {NextRequest, NextResponse} from 'next/server';
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // English-only storefront: permanently send legacy /vi URLs to /en.
  if (pathname === '/vi' || pathname.startsWith('/vi/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/vi/, '/en');
    return NextResponse.redirect(url, 308);
  }
  const headers = new Headers(request.headers);
  headers.set('x-shop-locale', 'en');
  headers.set('x-shop-admin', /^\/en\/admin(\/|$)/.test(pathname) ? '1' : '0');
  return NextResponse.next({request: {headers}});
}
export const config = {matcher: ['/((?!api|_next|favicon.ico).*)']};