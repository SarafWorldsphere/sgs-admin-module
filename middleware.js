import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  const loginPortalUrl = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in/login';

  // 1. Capture token from portal
  const urlToken = searchParams.get('token');
  if (urlToken) {
    const response = NextResponse.redirect(new URL(pathname, request.url));
    response.cookies.set('admin_token', urlToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return response;
  }

  // 2. Check for token
  const cookieToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  // 3. Redirect to portal if no token
  if (!token) {
    return NextResponse.redirect(loginPortalUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};