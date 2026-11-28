import { NextResponse } from 'next/server';

export function middleware(request) {
  const { searchParams } = request.nextUrl;

  // Where to send someone who is not signed in.
  //
  // One deployment serves every school, and which school you are is decided
  // by the host you arrived on. A hardcoded default therefore sends every
  // school's admin to one particular school's portal: an admin signing in at
  // sss-test was redirected onto sgs-test, crossing a tenant boundary on a
  // fallback value.
  //
  // So: relative to the request, which returns the admin to the host they
  // came from. The environment variable is still honoured for a deployment
  // that genuinely serves the portal from somewhere else, but it is no
  // longer required to prevent the wrong school being used.
  const configuredPortal = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL;
  const loginPortalUrl = configuredPortal
    ? new URL(configuredPortal)
    : new URL('/', request.url);

  // 1. If portal redirects with ?token=..., save it and clean URL.
  //
  //    The clean URL is built from request.url, not from nextUrl.pathname.
  //    This app runs under basePath '/admin', and nextUrl.pathname has that
  //    prefix stripped — so redirecting to it sent an admin arriving at
  //    /admin/student/dashboard on to /student/dashboard, which nginx routes
  //    to the student module on another port. The admin never reached their
  //    own dashboard and was bounced back to the portal.
  //
  //    Taking request.url keeps the basePath and any other query parameters,
  //    and only the token is removed.
  const urlToken = searchParams.get('token');
  if (urlToken) {
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete('token');
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set('admin_token', urlToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    return response;
  }

  // 2. Check for existing token in cookie or header
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
    // Protect everything under /admin and /api
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};