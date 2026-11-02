import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_SECRET || 'your-shared-secret';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, phone } = body;

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone required' }, { status: 400 });
    }

    // 1. Verify the user exists and is an active Admin
    // We check sgs_users_masters for the role.
    const users = await sql`
      SELECT user_id, email, username, role, school_id
      FROM sgs_users_masters
      WHERE (email = ${email} OR username = ${phone})
        AND is_active = true
        AND role IN ('School Admin', 'Admin', 'Super Admin')
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User is not a School Admin' }, { status: 403 });
    }

    const user = users[0];

    // 2. Generate the JWT
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        school_id: user.school_id,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error('SSO token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}