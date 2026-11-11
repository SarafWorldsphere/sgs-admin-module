import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // ✅ CRITICAL: Do NOT block CSS, JS, Images, or API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // catches favicon.ico, images, etc.
  ) {
    return NextResponse.next();
  }

  // Allow the page to load if there is a token in the URL
  const token = request.nextUrl.searchParams.get('token');
  if (token) {
    return NextResponse.next();
  }

  // Let the client-side layout handle the rest (sessionStorage check)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};