import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  const loginPortalUrl = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in';

  // Allow SSO endpoint and static assets
  if (
    pathname.startsWith('/api/auth/') || 
    pathname.startsWith('/_next/') || 
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next();
  }

  // Catch the token from the portal redirect (?token=...)
  const urlToken = searchParams.get('token');
  if (urlToken) {
    // Strip the token from the URL and save it to sessionStorage in the browser
    const cleanUrl = new URL(pathname, request.url);
    const response = NextResponse.redirect(cleanUrl);
    
    // We cannot set sessionStorage from the middleware, so we pass a short-lived cookie 
    // ONLY to survive the immediate redirect.
    response.cookies.set('admin_token_transient', urlToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60, // 1 minute (only enough to survive the redirect)
    });
    return response;
  }

  // Check for the transient cookie (just arrived from portal)
  const transientToken = request.cookies.get('admin_token_transient')?.value;
  if (transientToken) {
    // Clear the transient cookie and let them in
    const response = NextResponse.next();
    response.cookies.delete('admin_token_transient');
    return response;
  }

  // Check for Authorization header (used by API calls)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return NextResponse.next();
  }

  // ❌ If none of the above, block and redirect
  return NextResponse.redirect(loginPortalUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};