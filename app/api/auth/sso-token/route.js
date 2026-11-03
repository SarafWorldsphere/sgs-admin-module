import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

/**
 * Mints a dashboard token for a school admin the login portal has already
 * authenticated.
 *
 * The portal verifies identity (Google or OTP) and then asks each dashboard for
 * its own token, so no JWT secret is shared between services — the portal only
 * holds the SSO secret that authorises it to ask.
 *
 * Without this route a School Admin fell through to the faculty backend, which
 * looks up a teacher. An admin who is not also a teacher got a 404, the portal
 * redirected here with no token, and the middleware bounced them back to the
 * portal — the loop that made admin unreachable.
 *
 * The payload and signing secret deliberately match app/api/user/login so that
 * lib/auth.js verifies a token from either source identically.
 */

const ADMIN_ROLES = ['admin', 'super_admin'];

export async function POST(request) {
  // Both secrets are required rather than defaulted. A fallback here would mean
  // that a deployment which forgot to set them still accepted requests — signed
  // with a string published in this repository.
  const ssoSecret = process.env.SGS_SSO_SECRET;
  const jwtSecret = process.env.JWT_SECRET;

  if (!ssoSecret || !jwtSecret) {
    console.error('sso-token: SGS_SSO_SECRET or JWT_SECRET is not configured');
    return NextResponse.json({ error: 'SSO is not configured' }, { status: 500 });
  }

  if (request.headers.get('x-sso-secret') !== ssoSecret) {
    // 401 with no detail: this endpoint mints credentials, so it should not
    // confirm whether an address exists to a caller that cannot authenticate.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const users = await sql`
      SELECT user_id, username, email, role, is_active
      FROM sgs_users_masters
      WHERE lower(email) = lower(${email.trim()})
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'No admin found for this email' }, { status: 404 });
    }

    const user = users[0];

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // The portal asked for a School Admin token; issuing one to a teacher or a
    // parent because they happen to have an account would hand them the admin
    // dashboard.
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Not an admin account' }, { status: 403 });
    }

    const access_token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      access_token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('sso-token error:', error);
    return NextResponse.json({ error: 'Failed to issue token' }, { status: 500 });
  }
}
