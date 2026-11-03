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
    const { email, phone } = await request.json();

    // The portal sends whichever identifier was verified: Google login gives an
    // email, OTP login gives a phone. Requiring email would reject every admin
    // who signed in with a phone number.
    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
    }

    // Phone numbers are stored inconsistently — with and without the country
    // code — so match on the last ten digits rather than the raw string. The
    // character class is written [^0-9] rather than \D: a backslash escape in
    // a template literal is swallowed by JavaScript before Postgres sees it.
    const digits = String(phone || '').replace(/[^0-9]/g, '');
    const last10 = digits.length >= 10 ? digits.slice(-10) : null;

    if (!email && !last10) {
      return NextResponse.json({ error: 'Phone number is not valid' }, { status: 400 });
    }

    // Column names are the ones this table actually has: email_id, mobile_no,
    // login_id, full_name. Not email/username/role — those belong to a schema
    // this app was written against and never had here.
    const users = email
      ? await sql`
          SELECT user_id, login_id, full_name, email_id, role_id, is_active
          FROM sgs_users_masters
          WHERE lower(email_id) = lower(${String(email).trim()})
          LIMIT 1
        `
      : await sql`
          SELECT user_id, login_id, full_name, email_id, role_id, is_active
          FROM sgs_users_masters
          WHERE right(regexp_replace(coalesce(mobile_no, ''), '[^0-9]', '', 'g'), 10) = ${last10}
          LIMIT 1
        `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'No admin found for this account' }, { status: 404 });
    }

    const user = users[0];

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Membership of sgs_users_masters IS the rule, which is what the login
    // portal's own role mapping uses for School Admin. There is deliberately no
    // role check here because there is nothing to check against: role_id is
    // null for 28 of the 30 rows and no lookup table defines what 8 or 9 mean.
    //
    // That is weaker than it should be — a headmaster resolves through the same
    // table — and it should become a real role check once role_id is populated.
    // Tightening it here alone would simply lock everyone out while the portal
    // kept admitting them.
    const access_token = jwt.sign(
      { userId: user.user_id, email: user.email_id, role: 'admin' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      access_token,
      user: {
        id: user.user_id,
        username: user.login_id,
        name: user.full_name,
        email: user.email_id,
        role: 'admin',
      },
    });
  } catch (error) {
    console.error('sso-token error:', error);
    return NextResponse.json({ error: 'Failed to issue token' }, { status: 500 });
  }
}
