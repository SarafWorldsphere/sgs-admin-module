import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/teacher-class-map?teacher_id=T001
// Returns the teacher's class map rows (Active only).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = (searchParams.get('teacher_id') || '').trim();

    if (!teacherId) {
      return NextResponse.json({ error: 'teacher_id is required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT 
        map_id,
        teacher_id,
        class_id,
        section,
        subject_name,
        is_class_teacher,
        record_status
      FROM sgs_teacher_class_map
      WHERE teacher_id = ${teacherId}
        AND (record_status IS NULL OR record_status = 'Active')
      ORDER BY class_id, section, subject_name
    `;

    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error('Error fetching teacher class map:', error);
    return NextResponse.json([], { status: 200 });
  }
}