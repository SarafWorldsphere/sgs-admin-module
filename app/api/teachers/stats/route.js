import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

// GET /api/teachers/stats
// Returns total / active / inactive teacher counts.
export async function GET() {
  try {
    const rows = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false OR is_active IS NULL) as inactive,
        COUNT(*) as total
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