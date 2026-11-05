import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 1. Login Portal URL (should be https://staging.sgs.swais.in)
  const loginPortalUrl = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in';

  // 2. Allow SSO endpoint and static files
  if (
    pathname.startsWith('/api/auth/') || 
    pathname.startsWith('/_next/') || 
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next();
  }

  // 3. Catch the token from the portal redirect (?token=...)
  const urlToken = searchParams.get('token');
  if (urlToken) {
    // Clone the request URL and drop the token, rather than rebuilding one from
    // `pathname`.
    //
    // next.config.js sets basePath: '/admin', so Next has already stripped that
    // prefix by the time middleware runs — pathname here is "/students", not
    // "/admin/students". Building a fresh URL from it produced a redirect to
    // /students, which matches no route and 404s. Cloning nextUrl keeps the
    // basePath, so the browser goes back to /admin/students as intended.
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete('token');

    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set('admin_token', urlToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });
    return response;
  }

  // 4. Check for existing token
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