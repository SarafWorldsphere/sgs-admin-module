import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;
  
  const loginPortalUrl = process.env.NEXT_PUBLIC_LOGIN_PORTAL_URL || 'https://staging.sgs.swais.in/login';

  // 1. Handle portal redirect token
  const urlToken = searchParams.get('token');
  if (urlToken) {
    const response = NextResponse.redirect(new URL(pathname, request.url));
    response.cookies.set('admin_token', urlToken, { httpOnly: true, path: '/', maxAge: 86400 });
    return response;
  }

  // 2. Check for existing token
  const token = request.cookies.get('admin_token')?.value 
             || request.headers.get('authorization')?.replace('Bearer ', '');

  // 3. If no token, bounce to the portal
  if (!token) {
    return NextResponse.redirect(loginPortalUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};