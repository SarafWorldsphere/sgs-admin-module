import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 1. Full login portal URL
  const loginPortalUrl = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in/login';

  // 2. Capture the token from the portal redirect (?token=...)
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

  // 3. Check for existing token
  const cookieToken = request.cookies.get('admin_token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  // 4. If no token, redirect to the external login portal
  if (!token) {
    return NextResponse.redirect(loginPortalUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all admin pages
    '/admin/:path*',
  ],
};