import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 1. Login Portal URL
  const loginPortalUrl = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in/login';

  // 2. Allow the SSO endpoint to pass through (the portal calls this)
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // 3. Capture token from portal
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

  // 4. Check for token in cookies or headers
  const cookieToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  // 5. Redirect to portal if no token
  if (!token) {
    return NextResponse.redirect(loginPortalUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all admin pages and API routes
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};