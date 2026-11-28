/**
 * Mint an admin token for the login portal.
 *
 * The portal authenticates the person (password or OTP), then asks the
 * dashboard that owns the role to issue a token for them. It never shares a
 * JWT secret between services — it only holds the SSO secret that authorises
 * it to ask.
 *
 * This replaces route.ls, which was never a route: Next only recognises
 * route.js / route.ts, so the file sat in the tree since 2 November and the
 * endpoint simply did not exist. With no endpoint the portal's SGS_ADMIN_SSO_URL
 * had nothing to call, so a School Admin was redirected to the dashboard with
 * no token at all and bounced straight back to the portal.
 *
 * Three other things were wrong in it and are corrected here:
 *
 *   - It queried sgs_users_masters, which does not exist in this database.
 *     The table is users_masters.
 *   - It read columns `email` and `school_id`, which are `email_id` and
 *     `tenant_id` here, and matched roles 'School Admin' / 'Admin' /
 *     'Super Admin' when the stored values are lowercase ('admin').
 *   - It answered { token }, while the portal reads data.access_token — so
 *     even a successful call produced an undefined token.
 */

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { sql } from '../../../../lib/db';

const JWT_SECRET = process.env.AUTH_SECRET || 'your-shared-secret';

// Compared lowercase: the column stores 'admin' on this deployment, but the
// older single-tenant data used the longer spellings.
const ADMIN_ROLES = new Set(['admin', 'school admin', 'super admin']);

export async function POST(request) {
  try {
    // This endpoint mints an administrator credential from nothing but an
    // email address, so it must only answer the portal. The previous version
    // checked nothing at all: anything able to reach port 4105 could have
    // asked it for a School Admin token.
    const expectedSecret = process.env.SGS_SSO_SECRET || '';
    const providedSecret = request.headers.get('x-sso-secret') || '';
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
    }

    const body = await request.json();
    const email = (body?.email || '').trim().toLowerCase();
    const phone = (body?.phone || '').trim();

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
    }

    // The tenant comes from the Host header the portal forwards — see lib/db.
    // So this can only ever find a user belonging to the school the person
    // signed in at.
    const users = email
      ? await sql`
          SELECT user_id, email_id, mobile_no, full_name, role, tenant_id
          FROM users_masters
          WHERE lower(email_id) = ${email} AND is_active = true
          LIMIT 1
        `
      : await sql`
          SELECT user_id, email_id, mobile_no, full_name, role, tenant_id
          FROM users_masters
          WHERE (mobile_no = ${phone} OR login_id = ${phone}) AND is_active = true
          LIMIT 1
        `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'No such user at this school' }, { status: 404 });
    }

    const user = users[0];
    if (!ADMIN_ROLES.has((user.role || '').trim().toLowerCase())) {
      return NextResponse.json({ error: 'User is not a School Admin' }, { status: 403 });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email_id,
        name: user.full_name,
        role: user.role,
        // Carried so a later request can be checked against the school the
        // token was issued for, rather than trusting the Host alone.
        tenant_id: user.tenant_id,
      },
      JWT_SECRET,
      { expiresIn: '1d' },
    );

    // access_token is the field the portal reads. `token` is kept alongside
    // it so anything already calling this keeps working.
    return NextResponse.json({ access_token: token, token });
  } catch (error) {
    console.error('SSO token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
