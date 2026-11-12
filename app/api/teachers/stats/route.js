import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { verifyAdminToken } from '../../../../lib/auth-verify';

// GET /api/teachers/stats
// Total = not deleted (record_status != 'Deleted')
// Active = is_active = true (and not deleted)
// Inactive = is_active = false or NULL (and not deleted)
export async function GET(request) {
  try {
    // 🛑 1. VERIFY JWT TOKEN (Security Check)
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing token' }, { status: 401 });
    }

    // 🟢 2. RUN DATABASE QUERY
    const rows = await sql`
      SELECT 
        COUNT(*) FILTER (
          WHERE (record_status IS NULL OR record_status != 'Deleted')
        ) as total,
        COUNT(*) FILTER (
          WHERE (record_status IS NULL OR record_status != 'Deleted')
            AND is_active = true
        ) as active,
        COUNT(*) FILTER (
          WHERE (record_status IS NULL OR record_status != 'Deleted')
            AND (is_active = false OR is_active IS NULL)
        ) as inactive
      FROM sgs_teacher_master
    `;
    const stats = rows[0] || { total: 0, active: 0, inactive: 0 };
    return NextResponse.json({
      total: Number(stats.total) || 0,
      active: Number(stats.active) || 0,
      inactive: Number(stats.inactive) || 0,
    });
  } catch (error) {
    console.error('Error fetching teacher stats:', error);
    return NextResponse.json({ total: 0, active: 0, inactive: 0 });
  }
}