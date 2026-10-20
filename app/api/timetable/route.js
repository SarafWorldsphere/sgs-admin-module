import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

const DEFAULT_ACADEMIC_YEAR = '2026-27';

// ============================================================================
// GET /api/timetable
// ============================================================================

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const classIdParam = searchParams.get('class_id');
    const sectionParam = searchParams.get('section');
    const academicYear = (searchParams.get('academic_year') || DEFAULT_ACADEMIC_YEAR).trim();

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

    const periodRows = await sql`
      SELECT 
        period_no, period_label, start_time, end_time, is_teaching, schedule_type
      FROM sgs_period_master
      WHERE academic_year = ${academicYear}
        AND schedule_type = 'full'
        AND (record_status IS NULL OR record_status = 'Active')
      ORDER BY period_no
    `;

    const periods = periodRows.map((p) => ({
      period_no: p.period_no,
      label: p.period_label,
      start_time: formatTime(p.start_time),
      end_time: formatTime(p.end_time),
      is_teaching: p.is_teaching === true,
    }));

    const slotRows = await sql`
      SELECT 
        day_of_week,
        period_no,
        subject_name,
        teacher_id
      FROM sgs_timetable
      WHERE academic_year = ${academicYear}
        AND class_id = ${classId}
        AND section = ${section}
        AND (record_status IS NULL OR record_status = 'Active')
      ORDER BY day_of_week, period_no
    `;

    const teacherIds = Array.from(new Set(slotRows.map((r) => r.teacher_id).filter(Boolean)));
    let teacherNameById = new Map();
    if (teacherIds.length > 0) {
      const teacherRows = await sql`
        SELECT teacher_id, full_name
        FROM sgs_teacher_master
        WHERE teacher_id IN ${sql(teacherIds)}
      `;
      teacherNameById = new Map(teacherRows.map((t) => [t.teacher_id, t.full_name]));
    }

    const byDay = new Map();
    for (const r of slotRows) {
      if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
      byDay.get(r.day_of_week).push({
        period_no: r.period_no,
        subject_name: r.subject_name,
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
      academic_year: academicYear,
      class_id: classId,
      section,
      schedule_type: 'full',
      periods,
      days,
    });
  } catch (error) {
    console.error('Error fetching timetable:', error);
    return NextResponse.json(
      { error: 'Could not load timetable. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/timetable
// Saves the full grid for ONE class-section, atomically.
// Rejects (409) if any teacher in the submitted grid is already booked
// somewhere else in the DB for the same (day_of_week, period_no).
// ============================================================================

export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      academic_year,
      class_id,
      section,
      slots,
    } = body;

    // ---- Basic validation ----
    if (!class_id) {
      return NextResponse.json({ error: 'class_id is required' }, { status: 400 });
    }
    if (!section || !String(section).trim()) {
      return NextResponse.json({ error: 'section is required' }, { status: 400 });
    }
    const year = (academic_year || DEFAULT_ACADEMIC_YEAR).trim();
    const classId = parseInt(class_id, 10);
    if (isNaN(classId)) {
      return NextResponse.json({ error: 'Invalid class_id' }, { status: 400 });
    }
    const sectionStr = String(section).trim();

    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: 'slots must be an array' }, { status: 400 });
    }

    // ---- Normalize slots ----
    const normalizedSlots = [];
    for (const s of slots) {
      const dow = parseInt(s.day_of_week, 10);
      const pno = parseInt(s.period_no, 10);
      const subj = s.subject_name ? String(s.subject_name).trim() : '';
      const tid = s.teacher_id ? String(s.teacher_id).trim() : '';

      if (!dow || dow < 1 || dow > 6) {
        return NextResponse.json(
          { error: `Invalid day_of_week: ${s.day_of_week}` },
          { status: 400 }
        );
      }
      if (isNaN(pno)) {
        return NextResponse.json(
          { error: `Invalid period_no for day ${dow}` },
          { status: 400 }
        );
      }
      if (!subj || !tid) {
        return NextResponse.json(
          { error: `Slot for day ${dow} period ${pno} needs both a subject and a teacher.` },
          { status: 400 }
        );
      }

      normalizedSlots.push({
        day_of_week: dow,
        period_no: pno,
        subject_name: subj,
        teacher_id: tid,
      });
    }

    // ---- Reject duplicate (day, period) within the payload ----
    const seen = new Set();
    for (const s of normalizedSlots) {
      const k = `${s.day_of_week}::${s.period_no}`;
      if (seen.has(k)) {
        return NextResponse.json(
          { error: `Duplicate slot for day ${s.day_of_week} period ${s.period_no} in the submitted grid.` },
          { status: 400 }
        );
      }
      seen.add(k);
    }

    // ---- In-payload teacher clash check (same teacher, same day+period) ----
    const teacherSlotMap = new Map(); // teacherId::day::period -> count
    for (const s of normalizedSlots) {
      const k = `${s.teacher_id}::${s.day_of_week}::${s.period_no}`;
      teacherSlotMap.set(k, (teacherSlotMap.get(k) || 0) + 1);
    }
    const inPayloadClashes = [];
    for (const [k, count] of teacherSlotMap.entries()) {
      if (count > 1) {
        const [tid, dow, pno] = k.split('::');
        inPayloadClashes.push({
          teacher_id: tid,
          day_of_week: Number(dow),
          period_no: Number(pno),
          reason: 'Teacher scheduled for two subjects in the same slot',
        });
      }
    }
    if (inPayloadClashes.length > 0) {
      return NextResponse.json(
        {
          error: 'Teacher is double-booked in the submitted timetable.',
          clashes: inPayloadClashes,
        },
        { status: 409 }
      );
    }

    // ---- DB clash check: any teacher in this payload already booked elsewhere? ----
    // Exclude the class-section we're writing (its rows are getting replaced).
    if (normalizedSlots.length > 0) {
      const teacherIds = Array.from(new Set(normalizedSlots.map((s) => s.teacher_id)));

      const dbBookings = await sql`
        SELECT 
          t.teacher_id,
          t.day_of_week,
          t.period_no,
          t.class_id,
          t.section,
          c.class_name
        FROM sgs_timetable t
        LEFT JOIN sgs_class_master c ON c.class_id = t.class_id
        WHERE t.academic_year = ${year}
          AND (t.record_status IS NULL OR t.record_status = 'Active')
          AND t.teacher_id IN ${sql(teacherIds)}
          AND NOT (t.class_id = ${classId} AND t.section = ${sectionStr})
      `;

      // Build a lookup: teacherId::day::period -> conflicting booking
      const conflictMap = new Map();
      for (const b of dbBookings) {
        const k = `${b.teacher_id}::${b.day_of_week}::${b.period_no}`;
        conflictMap.set(k, b);
      }

      const dbClashes = [];
      for (const s of normalizedSlots) {
        const k = `${s.teacher_id}::${s.day_of_week}::${s.period_no}`;
        const conflict = conflictMap.get(k);
        if (conflict) {
          dbClashes.push({
            teacher_id: s.teacher_id,
            day_of_week: s.day_of_week,
            period_no: s.period_no,
            conflict_class_id: conflict.class_id,
            conflict_section: conflict.section,
            conflict_class_name: conflict.class_name || String(conflict.class_id),
          });
        }
      }

      if (dbClashes.length > 0) {
        const readable = dbClashes
          .map((c) => `${c.teacher_id} is already booked on day ${c.day_of_week} period ${c.period_no} in ${c.conflict_class_name} ${c.conflict_section}`)
          .join('; ');
        return NextResponse.json(
          {
            error: `Teacher clash detected: ${readable}`,
            clashes: dbClashes,
          },
          { status: 409 }
        );
      }
    }

    // ---- Atomic write: replace all rows for this class-section-year ----
    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM sgs_timetable
        WHERE academic_year = ${year}
          AND class_id = ${classId}
          AND section = ${sectionStr}
      `;

      for (const s of normalizedSlots) {
        await tx`
          INSERT INTO sgs_timetable (
            academic_year, class_id, section,
            day_of_week, period_no, subject_name, teacher_id,
            record_status
          ) VALUES (
            ${year}, ${classId}, ${sectionStr},
            ${s.day_of_week}, ${s.period_no}, ${s.subject_name}, ${s.teacher_id},
            'Active'
          )
        `;
      }
    });

    return NextResponse.json({
      success: true,
      saved: normalizedSlots.length,
      academic_year: year,
      class_id: classId,
      section: sectionStr,
    });
  } catch (error) {
    console.error('Error saving timetable:', error);
    // Unique key violation (day+period dup within class-section)
    if (error?.code === '23505' || /duplicate key/i.test(String(error?.message || ''))) {
      return NextResponse.json(
        { error: 'Duplicate slot detected for this class-section. Please reload and try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Could not save timetable. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatTime(t) {
  if (!t) return null;
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}