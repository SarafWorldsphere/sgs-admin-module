import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 1. The URL of the login portal
  const loginPortalUrl = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in/login';

  // 2. Capture the token if the portal redirected here (?token=...)
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

  // 3. Check for ANY valid login token
  // - admin_token: from our SSO endpoint
  // - next-auth.session-token: from the portal login (if they share the domain)
  const adminToken = request.cookies.get('admin_token')?.value;
  const nextAuthToken = request.cookies.get('next-auth.session-token')?.value 
                     || request.cookies.get('__Secure-next-auth.session-token')?.value;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const hasToken = adminToken || nextAuthToken || bearerToken;

  // 4. If NO token at all, redirect to the portal
  if (!hasToken) {
    // If you are already on the portal, don't redirect in a loop
    if (pathname === '/login') {
      return NextResponse.next();
    }
    return NextResponse.redirect(loginPortalUrl);
  }

  // 5. Token exists, allow access to /admin/students
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect admin pages. Do not match /login to prevent loops.
    '/admin/:path*',
  ],
};