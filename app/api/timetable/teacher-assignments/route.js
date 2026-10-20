import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

// ============================================================================
// GET /api/timetable/teacher-assignments
// Query params:
//   class_id  (required) - bigint
//   section   (required) - section code
//
// Returns the teachers and subjects assigned to THIS class-section, per
// sgs_teacher_class_map. Used to drive the subject+teacher picker in the
// entry screen — assignments first, as Bhuvan specified.
//
// Shape:
//   { assignments: [{ teacher_id, teacher_name, subject_name, is_class_teacher }] }
// ============================================================================

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get('class_id');
    const sectionParam = searchParams.get('section');

    if (!classIdParam) {
      return NextResponse.json({ error: 'class_id is required' }, { status: 400 });
    }
    if (!sectionParam || !sectionParam.trim()) {
      return NextResponse.json({ error: 'section is required' }, { status: 400 });
    }

    const classId = parseInt(classIdParam, 10);
    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class_id' }, { status: 400 });
    }
    const section = sectionParam.trim();

    // Pull map rows for this class-section, joined to teacher_master for
    // the teacher name. subject_name is plain text in the map table, so we
    // pass it through as-is (Bhuvan's note).
    const rows = await sql`
      SELECT 
        m.teacher_id,
        m.subject_name,
        m.is_class_teacher,
        t.full_name as teacher_name
      FROM sgs_teacher_class_map m
      LEFT JOIN sgs_teacher_master t ON t.teacher_id = m.teacher_id
      WHERE m.class_id = ${classId}
        AND m.section = ${section}
        AND (m.record_status IS NULL OR m.record_status = 'Active')
      ORDER BY m.subject_name, m.teacher_id
    `;

    const assignments = rows.map((r) => ({
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name || null,
      subject_name: r.subject_name,
      is_class_teacher: r.is_class_teacher === true,
    }));

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    return NextResponse.json(
      { error: 'Could not load teacher assignments. Please try again.' },
      { status: 500 }
    );
  }
}