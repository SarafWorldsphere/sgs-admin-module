import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { verifyAdminToken } from '../../../../lib/auth-verify';

export async function GET(request) {
  const auth = verifyAdminToken(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get('teacher_id');
  const academicYear = searchParams.get('academic_year') || '2026-27';

  if (!teacherId) return NextResponse.json({ error: 'teacher_id required' }, { status: 400 });

  try {
    const slots = await sql`
      SELECT t.day_of_week, t.period_no, t.class_id, t.section, t.subject_name, t.activity_type, c.class_name
      FROM sgs_timetable t
      LEFT JOIN sgs_class_master c ON c.class_id = t.class_id
      WHERE t.teacher_id = ${teacherId} AND t.academic_year = ${academicYear}
        AND (t.record_status IS NULL OR t.record_status = 'Active')
      ORDER BY t.day_of_week, t.period_no
    `;

    const periods = await sql`
      SELECT period_no, period_label, start_time, end_time, is_teaching
      FROM sgs_period_master
      WHERE academic_year = ${academicYear} AND schedule_type = 'full'
      ORDER BY period_no
    `;

    return NextResponse.json({ periods, slots });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}