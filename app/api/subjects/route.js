import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/subjects         → all distinct subjects across the school
// GET /api/subjects?class_id=18  → subjects for that class only (kept for back-compat)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get('class_id');

    let rows;
    if (classIdParam && String(classIdParam).trim() !== '') {
      const classId = parseInt(classIdParam, 10);
      if (isNaN(classId)) {
        return NextResponse.json({ error: 'Invalid class_id' }, { status: 400 });
      }
      rows = await sql`
        SELECT DISTINCT subject_name
        FROM sgs_subject_master
        WHERE class_id = ${classId}
          AND (record_status IS NULL OR record_status = 'Active')
          AND subject_name IS NOT NULL
          AND subject_name != ''
        ORDER BY subject_name
      `;
    } else {
      rows = await sql`
        SELECT DISTINCT subject_name
        FROM sgs_subject_master
        WHERE (record_status IS NULL OR record_status = 'Active')
          AND subject_name IS NOT NULL
          AND subject_name != ''
        ORDER BY subject_name
      `;
    }

    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return NextResponse.json([], { status: 200 });
  }
}