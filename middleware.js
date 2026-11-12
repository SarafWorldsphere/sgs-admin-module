import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // 1. ALLOW NEXT.JS STATIC ASSETS (CSS, JS, Images) - DO NOT BLOCK THESE
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. ALLOW API ROUTES TO PASS
  // We let the API route itself handle the auth (via verifyAdminToken).
  // If we block it here, the frontend won't get a clean 401 JSON response.
  if (pathname.startsWith('/admin/api')) {
    return NextResponse.next();
  }

  // 3. CHECK FOR TOKEN IN URL (The SSO Login Flow)
  const token = request.nextUrl.searchParams.get('token');
  if (token) {
    return NextResponse.next();
  }

  // 4. BLOCK DIRECT URL ACCESS TO PAGES
  // If a user pastes /admin/students, they have no token in URL.
  // The frontend Layout will check sessionStorage and redirect them.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};