import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { verifyAdminToken } from '../../../lib/auth-verify';

const DEFAULT_ACADEMIC_YEAR = '2026-27';

export async function GET(request) {
  // 🛑 1. SECURITY CHECK (Synchronous - no await needed if using jsonwebtoken.verify)
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get('class_id');
    const sectionParam = searchParams.get('section');
    const academicYear = (searchParams.get('academic_year') || DEFAULT_ACADEMIC_YEAR).trim();

    if (!classIdParam || !sectionParam) {
      return NextResponse.json({ error: 'class_id and section are required' }, { status: 400 });
    }
    const classId = parseInt(classIdParam, 10);
    const section = sectionParam.trim();

    // 1. Get periods
    const periodRows = await sql`
      SELECT period_id, period_no, period_label, start_time, end_time, is_teaching
      FROM sgs_period_master
      WHERE academic_year = ${academicYear} AND schedule_type = 'full'
        AND (record_status IS NULL OR record_status = 'Active')
      ORDER BY period_no
    `;

    // 2. Get slots (now including activity_type)
    const slotRows = await sql`
      SELECT day_of_week, period_no, subject_name, teacher_id, activity_type
      FROM sgs_timetable
      WHERE academic_year = ${academicYear} AND class_id = ${classId} AND section = ${section}
        AND (record_status IS NULL OR record_status = 'Active')
      ORDER BY day_of_week, period_no
    `;

    // 3. Get teacher names
    const teacherIds = Array.from(new Set(slotRows.map((r) => r.teacher_id).filter(Boolean)));
    let teacherNameById = new Map();
    if (teacherIds.length > 0) {
      const teacherRows = await sql`
        SELECT teacher_id, full_name FROM sgs_teacher_master WHERE teacher_id IN ${sql(teacherIds)}
      `;
      teacherNameById = new Map(teacherRows.map((t) => [t.teacher_id, t.full_name]));
    }

    // 4. Group by day
    const byDay = new Map();
    for (const r of slotRows) {
      if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
      byDay.get(r.day_of_week).push({
        period_no: r.period_no,
        subject_name: r.subject_name,
        activity_type: r.activity_type,
        teacher_id: r.teacher_id,
        teacher_name: teacherNameById.get(r.teacher_id) || null,
      });
    }

    const dayNames = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    const days = [1, 2, 3, 4, 5, 6].map((dow) => ({
      day_of_week: dow,
      day_name: dayNames[dow],
      slots: byDay.get(dow) || [],
    }));

    return NextResponse.json({
      academic_year: academicYear, class_id: classId, section, schedule_type: 'full',
      periods: periodRows.map((p) => ({
        period_id: p.period_id,
        period_no: p.period_no, label: p.period_label,
        start_time: p.start_time ? String(p.start_time).slice(0, 5) : null,
        end_time: p.end_time ? String(p.end_time).slice(0, 5) : null,
        is_teaching: p.is_teaching === true,
      })),
      days,
    });
  } catch (error) {
    console.error('Timetable GET Error:', error);
    return NextResponse.json({ error: 'Could not load timetable.' }, { status: 500 });
  }
}

export async function PUT(request) {
  // 🛑 1. SECURITY CHECK
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { academic_year, class_id, section, slots } = body;
    const year = (academic_year || DEFAULT_ACADEMIC_YEAR).trim();
    const classId = parseInt(class_id, 10);
    const sectionStr = String(section).trim();

    if (!Array.isArray(slots)) return NextResponse.json({ error: 'slots array required' }, { status: 400 });

    const normalizedSlots = [];
    for (const s of slots) {
      const dow = parseInt(s.day_of_week, 10);
      const pno = parseInt(s.period_no, 10);
      if (isNaN(dow) || dow < 1 || dow > 6 || isNaN(pno)) {
         return NextResponse.json({ error: `Invalid day/period` }, { status: 400 });
      }
      normalizedSlots.push({
        day_of_week: dow,
        period_no: pno,
        subject_name: String(s.subject_name).trim(),
        teacher_id: String(s.teacher_id).trim(),
        activity_type: s.activity_type || null,
      });
    }

    // Check for clashes (omitted for brevity, keep your existing clash check here!)
    // ... [INSERT YOUR CLASH CHECK LOGIC HERE] ...

    await sql.begin(async (tx) => {
      await tx`DELETE FROM sgs_timetable WHERE academic_year = ${year} AND class_id = ${classId} AND section = ${sectionStr}`;
      
      for (const s of normalizedSlots) {
        await tx`
          INSERT INTO sgs_timetable (
            academic_year, class_id, section, day_of_week, period_no, 
            subject_name, teacher_id, activity_type, record_status
          ) VALUES (
            ${year}, ${classId}, ${sectionStr}, ${s.day_of_week}, ${s.period_no},
            ${s.subject_name}, ${s.teacher_id}, ${s.activity_type}, 'Active'
          )
        `;
      }
    });

    return NextResponse.json({ success: true, saved: normalizedSlots.length });
  } catch (error) {
    console.error('Timetable PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}