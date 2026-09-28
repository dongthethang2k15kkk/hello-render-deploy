import {NextRequest, NextResponse} from 'next/server';
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-shop-locale', request.nextUrl.pathname.split('/')[1] === 'en' ? 'en' : 'vi');
  headers.set('x-shop-admin', /^\/(vi|en)\/admin(\/|$)/.test(request.nextUrl.pathname) ? '1' : '0');
  return NextResponse.next({request: {headers}});
}
export const config = {matcher: ['/((?!api|_next|favicon.ico).*)']};