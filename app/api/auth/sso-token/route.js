import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_SECRET || 'your-shared-secret';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // ✅ FIX: Default to null to prevent Postgres UNDEFINED_VALUE errors
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
        role: user.role_id,
        school_id: user.school_id,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error('SSO token error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}