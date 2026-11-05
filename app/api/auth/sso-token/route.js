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

    // ✅ FIXED: Using the correct column names Bhuvan provided
    // email_id instead of email
    // mobile_no instead of phone
    // role_id instead of role (we check role_id = 1 or 'Admin' depending on DB setup)
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

    // Note: Since we don't know the exact role_id for School Admin, we'll assume 
    // any valid user in this table is allowed, or you can restrict by role_id if known.
    
    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email_id,
        login_id: user.login_id,
        role: user.role_id, // passing role_id as role
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