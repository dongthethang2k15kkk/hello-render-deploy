import {NextRequest, NextResponse} from 'next/server';
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-shop-locale', request.nextUrl.pathname.split('/')[1] === 'en' ? 'en' : 'vi');
  return NextResponse.next({request: {headers}});
}
export const config = {matcher: ['/((?!api|_next|favicon.ico).*)']};