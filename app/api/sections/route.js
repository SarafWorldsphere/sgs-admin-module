import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/sections?class_id=18
// Returns distinct sections that actually have students in this class.
// Falls back to the class_master.section_name if no students yet.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get('class_id');

    if (!classIdParam || String(classIdParam).trim() === '') {
      return NextResponse.json({ error: 'class_id is required' }, { status: 400 });
    }
    const classId = parseInt(classIdParam, 10);
    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class_id' }, { status: 400 });
    }

    // Bhuvan: "The only truthful source today is the students"
    const rows = await sql`
      SELECT DISTINCT section
      FROM sgs_student_master
      WHERE class_id = ${classId}
        AND section IS NOT NULL
        AND section != ''
        AND record_status IN ('Active', 'Inactive')
      ORDER BY section
    `;

    const sections = rows.map((r) => r.section).filter(Boolean);

    if (sections.length > 0) {
      return NextResponse.json({ sections, source: 'students' });
    }

    // Fallback: the class_master section_name (may be blank)
    const fallback = await sql`
      SELECT section_name
      FROM sgs_class_master
      WHERE class_id = ${classId}
        AND record_status = 'Active'
      LIMIT 1
    `;
    const fallbackSection = fallback[0]?.section_name?.trim() || '';
    const fallbackSections = fallbackSection ? [fallbackSection] : [];

    return NextResponse.json({
      sections: fallbackSections,
      source: fallbackSections.length > 0 ? 'class_master' : 'empty',
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return NextResponse.json({ sections: [], source: 'error' }, { status: 200 });
  }
}