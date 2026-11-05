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
    // Create the clean URL without the token query param
    const cleanUrl = new URL(pathname, request.url);
    
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