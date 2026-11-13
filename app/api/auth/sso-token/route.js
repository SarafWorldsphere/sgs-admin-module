import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

// AUTH_SECRET, because lib/auth-verify.js verifies with it and that is what
// the protected routes use. lib/auth.js reads JWT_SECRET instead and no route
// imports it, so signing with JWT_SECRET would produce tokens nothing checks —
// and the two variables hold different values on the server.
//
// Neither falls back to a literal: a published default would mean a deployment
// that forgot to set it still issued tokens anyone could forge.
const JWT_SECRET = process.env.JWT_SECRET;
const SSO_SECRET = process.env.SGS_SSO_SECRET;

export async function POST(request) {
  if (!JWT_SECRET || !SSO_SECRET) {
    console.error('sso-token: AUTH_SECRET or SGS_SSO_SECRET is not configured');
    return NextResponse.json({ error: 'SSO is not configured' }, { status: 500 });
  }

  // The portal sends this header. Without checking it, anything that can reach
  // this port could mint an admin token for any address.
  if (request.headers.get('x-sso-secret') !== SSO_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Default to null to prevent Postgres UNDEFINED_VALUE errors
    const email = body.email || null;
    const phone = body.phone || null;

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
    }

    const users = await sql`
      SELECT user_id, login_id, email_id, full_name, role_id, school_id
      FROM sgs_users_masters
      WHERE (email_id = ${email} OR login_id = ${email} OR mobile_no = ${phone})
        AND is_active = true
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 403 });
    }

    const user = users[0];
    
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email_id,
        login_id: user.login_id,
        // 'admin', not role_id: lib/auth.js checks the strings 'admin' and
        // 'super_admin', so a number never matches and every route behind
        // requireAdmin would answer 403. role_id is also null for 28 of the 30
        // rows, so there is nothing meaningful to map yet. role_id is carried
        // alongside for when there is.
        role: 'admin',
        role_id: user.role_id,
        school_id: user.school_id,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // access_token is the field the login portal reads. Returning only
    // `token` meant the portal got undefined, redirected without one, and the
    // middleware bounced the user straight back — the login loop. `token` is
    // kept as well so any existing caller keeps working.
    return NextResponse.json({ access_token: token, token });
  } catch (error) {
    // The detail goes to the log, not the response: this endpoint mints
    // credentials and should not describe its database to a caller.
    console.error('SSO token error:', error);
    return NextResponse.json({ error: 'Failed to issue token' }, { status: 500 });
  }
}