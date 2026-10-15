import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// ---- Helpers -----------------------------------------------------------

function toSubjectsArray(input) {
  if (input === null || input === undefined) return [];
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean);
  }
  const str = String(input).trim();
  if (!str) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  const normalized =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits;
  if (!/^[6-9]\d{9}$/.test(normalized)) return null;
  return normalized;
}

function toBigintOrNull(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '') return null;
  if (!/^\d+$/.test(str)) return null;
  return parseInt(str, 10);
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isGmailEmail(email) {
  if (!email || !String(email).trim()) return true;
  return /^[^\s@]+@gmail\.com$/i.test(String(email).trim());
}

function friendlyDbError(error) {
  const msg = String(error?.message || '');
  const code = error?.code;

  if (code === '23505' || /duplicate key/i.test(msg)) {
    if (msg.includes('teacher_master_email_id_key')) return 'This email is already registered to another teacher.';
    if (msg.includes('teacher_master_pkey')) return 'A teacher with this ID already exists.';
    if (msg.includes('uq_teacher_class_map_assignment')) return 'Duplicate class-section-subject assignment detected.';
    return 'A duplicate record was detected. Please check the values and try again.';
  }

  if (code === '23514' || /violates check constraint/i.test(msg)) {
    return 'One of the values does not meet the required format.';
  }

  if (code === '23503' || /foreign key/i.test(msg)) {
    if (msg.includes('class_id')) return 'One of the selected classes does not exist.';
    return 'A referenced record does not exist.';
  }

  return 'Something went wrong while saving. Please try again or contact support.';
}

function normalizeClassMap(input) {
  if (!Array.isArray(input)) return null;
  const rows = [];
  for (const entry of input) {
    const classId = toBigintOrNull(entry?.class_id);
    const section = entry?.section ? String(entry.section).trim() : '';
    if (classId === null || !section) continue;

    const isClassTeacher = !!entry.is_class_teacher;
    const subjects = Array.isArray(entry.subjects)
      ? entry.subjects.map((s) => String(s).trim()).filter(Boolean)
      : [];

    if (subjects.length === 0) {
      rows.push({
        class_id: classId,
        section,
        subject_name: null,
        is_class_teacher: isClassTeacher,
      });
    } else {
      const seen = new Set();
      for (const subj of subjects) {
        const key = `${classId}::${section}::${subj.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          class_id: classId,
          section,
          subject_name: subj,
          is_class_teacher: isClassTeacher,
        });
      }
    }
  }
  return rows;
}

async function replaceTeacherClassMap(tx, teacherId, rows) {
  await tx`
    DELETE FROM sgs_teacher_class_map
    WHERE teacher_id = ${teacherId}
  `;

  for (const r of rows) {
    await tx`
      INSERT INTO sgs_teacher_class_map
        (teacher_id, class_id, section, subject_name, is_class_teacher, record_status)
      VALUES
        (${teacherId}, ${r.class_id}, ${r.section}, ${r.subject_name}, ${r.is_class_teacher}, 'Active')
    `;
  }
}

// ============================================================================
// GET /api/teachers
// - Hides ONLY record_status = 'Deleted' (per Bhuvan).
// - Includes aggregated "assignments" array per teacher, built from
//   sgs_teacher_class_map. Falls back to a single assignment built from
//   teacher_master (class_id + section_1 + subjects) if the teacher has no
//   map rows yet.
// ============================================================================

export async function GET() {
  try {
    const teachers = await sql`
      SELECT 
        teacher_id as id,
        full_name as name,
        subject_name as subject,
        qualification,
        class_id,
        section_1,
        section_2,
        role,
        is_class_teacher,
        subjects,
        phone as contact,
        email_id as email,
        is_active,
        record_status,
        CASE WHEN is_active = true THEN 'Active' ELSE 'Inactive' END as status
      FROM sgs_teacher_master
      WHERE (record_status IS NULL OR record_status != 'Deleted')
      ORDER BY teacher_id
    `;

    // Fetch all map rows in one query — keyed by teacher_id
    const mapRows = await sql`
      SELECT teacher_id, class_id, section, subject_name, is_class_teacher
      FROM sgs_teacher_class_map
      WHERE (record_status IS NULL OR record_status != 'Deleted')
      ORDER BY teacher_id, class_id, section, subject_name
    `;

    // Group map rows by teacher
    const byTeacher = new Map();
    for (const r of mapRows) {
      const tid = String(r.teacher_id);
      if (!byTeacher.has(tid)) byTeacher.set(tid, new Map());
      const byClassSection = byTeacher.get(tid);
      const cid = String(r.class_id);
      const sec = String(r.section || '');
      const key = `${cid}::${sec}`;
      if (!byClassSection.has(key)) {
        byClassSection.set(key, {
          class_id: cid,
          section: sec,
          subjects: new Set(),
          is_class_teacher: false,
        });
      }
      const entry = byClassSection.get(key);
      if (r.subject_name) entry.subjects.add(r.subject_name);
      if (r.is_class_teacher) entry.is_class_teacher = true;
    }

    const normalized = teachers.map((t) => {
      const tid = String(t.id);
      const assignments = [];

      const grouped = byTeacher.get(tid);
      if (grouped && grouped.size > 0) {
        for (const entry of grouped.values()) {
          assignments.push({
            class_id: entry.class_id,
            section: entry.section,
            subjects: Array.from(entry.subjects),
            is_class_teacher: entry.is_class_teacher,
          });
        }
      } else if (t.class_id) {
        // Legacy: teacher has class_id in master but no map rows yet
        assignments.push({
          class_id: String(t.class_id),
          section: String(t.section_1 || ''),
          subjects: Array.isArray(t.subjects)
            ? t.subjects
            : (typeof t.subjects === 'string' && t.subjects
                ? t.subjects.split(',').map((s) => s.trim()).filter(Boolean)
                : []),
          is_class_teacher: t.is_class_teacher === true,
        });
      }

      return {
        ...t,
        subjects: Array.isArray(t.subjects) ? t.subjects.join(', ') : t.subjects || '',
        assignments,
      };
    });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// ============================================================================
// POST /api/teachers
// ============================================================================

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      teacher_id, name, subject, qualification, class_id,
      section_1, section_2, role, is_class_teacher,
      subjects, contact, email, status,
      class_map,
    } = body;

    if (!teacher_id || !name || !email) {
      return NextResponse.json(
        { error: 'Teacher ID, Name and Email are required' },
        { status: 400 }
      );
    }

    if (!teacher_id.match(/^[TH]/)) {
      return NextResponse.json(
        { error: 'Teacher ID must start with T or H' },
        { status: 400 }
      );
    }

    if (!isGmailEmail(email)) {
      return NextResponse.json(
        { error: 'Teacher email must be a @gmail.com address.' },
        { status: 400 }
      );
    }

    const dupeId = await sql`
      SELECT teacher_id FROM sgs_teacher_master WHERE teacher_id = ${teacher_id}
    `;
    if (dupeId.length > 0) {
      return NextResponse.json(
        { error: `Teacher ID ${teacher_id} already exists. Please use a different ID.` },
        { status: 400 }
      );
    }

    if (email && String(email).trim()) {
      const dupeEmail = await sql`
        SELECT teacher_id, full_name
        FROM sgs_teacher_master
        WHERE LOWER(email_id) = LOWER(${String(email).trim()})
        LIMIT 1
      `;
      if (dupeEmail.length > 0) {
        return NextResponse.json(
          { error: `This email is already registered to teacher ${dupeEmail[0].teacher_id}${dupeEmail[0].full_name ? ` (${dupeEmail[0].full_name})` : ''}. Please use a different email address.` },
          { status: 400 }
        );
      }
    }

    const normalizedPhone = normalizePhone(contact);
    if (contact && !normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit mobile number' },
        { status: 400 }
      );
    }

    const classIdValue = toBigintOrNull(class_id);
    if (classIdValue !== null) {
      const classCheck = await sql`
        SELECT class_id FROM sgs_class_master
        WHERE class_id = ${classIdValue} AND record_status = 'Active'
      `;
      if (classCheck.length === 0) {
        return NextResponse.json(
          { error: `Class ID ${classIdValue} does not exist` },
          { status: 400 }
        );
      }
    }

    const subjectsArray = toSubjectsArray(subjects);
    const mapRows = normalizeClassMap(class_map);

    const result = await sql.begin(async (tx) => {
      const inserted = await tx`
        INSERT INTO sgs_teacher_master (
          teacher_id, full_name, subject_name, qualification, class_id,
          section_1, section_2, role, is_class_teacher,
          subjects, phone, email_id, is_active, record_status
        ) VALUES (
          ${teacher_id}, ${name}, ${subject || null}, ${qualification || null}, ${classIdValue},
          ${section_1 || null}, ${section_2 || null}, ${role || 'Teacher'}, ${is_class_teacher || false},
          ${subjectsArray}, ${normalizedPhone}, ${email}, ${status === 'Active'}, 'Active'
        ) RETURNING *
      `;

      if (mapRows !== null) {
        await replaceTeacherClassMap(tx, teacher_id, mapRows);
      }

      return inserted[0];
    });

    return NextResponse.json(
      { success: true, teacher: result },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding teacher:', error);
    return NextResponse.json(
      { error: friendlyDbError(error) },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/teachers
// - Status-only toggle touches ONLY is_active (per Bhuvan).
// - Full update writes all fields including class_map.
// ============================================================================

export async function PUT(request) {
  try {
    const body = await request.json();
    const { teacher_id, status } = body;

    if (!teacher_id) {
      return NextResponse.json({ error: 'Teacher ID is required' }, { status: 400 });
    }

    // ---- STATUS-ONLY TOGGLE (is_active only — no record_status) ----
    if (status !== undefined && !body.name) {
      const newStatus = status === 'Active';
      const result = await sql`
        UPDATE sgs_teacher_master
        SET is_active = ${newStatus}
        WHERE teacher_id = ${teacher_id}
        RETURNING *
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, teacher: result[0] });
    }

    // ---- FULL UPDATE ----
    const {
      name, subject, qualification, class_id,
      section_1, section_2, role, is_class_teacher,
      subjects, contact, email,
      class_map,
    } = body;

    if (!email || !String(email).trim() || !isGmailEmail(email)) {
      return NextResponse.json(
        { error: 'Teacher email must be a @gmail.com address.' },
        { status: 400 }
      );
    }

    if (email && String(email).trim()) {
      const dupeEmail = await sql`
        SELECT teacher_id, full_name
        FROM sgs_teacher_master
        WHERE LOWER(email_id) = LOWER(${String(email).trim()})
          AND teacher_id != ${teacher_id}
        LIMIT 1
      `;
      if (dupeEmail.length > 0) {
        return NextResponse.json(
          { error: `This email is already registered to teacher ${dupeEmail[0].teacher_id}${dupeEmail[0].full_name ? ` (${dupeEmail[0].full_name})` : ''}. Please use a different email address.` },
          { status: 400 }
        );
      }
    }

    const normalizedPhone = normalizePhone(contact);
    if (contact && !normalizedPhone) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit mobile number' },
        { status: 400 }
      );
    }

    const classIdValue = toBigintOrNull(class_id);
    if (classIdValue !== null) {
      const classCheck = await sql`
        SELECT class_id FROM sgs_class_master
        WHERE class_id = ${classIdValue} AND record_status = 'Active'
      `;
      if (classCheck.length === 0) {
        return NextResponse.json(
          { error: `Class ID ${classIdValue} does not exist` },
          { status: 400 }
        );
      }
    }

    const subjectsArray = toSubjectsArray(subjects);
    const mapRows = normalizeClassMap(class_map);

    const result = await sql.begin(async (tx) => {
      const updated = await tx`
        UPDATE sgs_teacher_master SET
          full_name = ${name},
          subject_name = ${subject || null},
          qualification = ${qualification || null},
          class_id = ${classIdValue},
          section_1 = ${section_1 || null},
          section_2 = ${section_2 || null},
          role = ${role || 'Teacher'},
          is_class_teacher = ${is_class_teacher || false},
          subjects = ${subjectsArray},
          phone = ${normalizedPhone},
          email_id = ${email},
          is_active = ${status === 'Active'}
        WHERE teacher_id = ${teacher_id}
        RETURNING *
      `;

      if (updated.length === 0) {
        throw new Error('Teacher not found');
      }

      if (mapRows !== null) {
        await replaceTeacherClassMap(tx, teacher_id, mapRows);
      }

      return updated[0];
    });

    return NextResponse.json({ success: true, teacher: result });
  } catch (error) {
    console.error('Error updating teacher:', error);
    if (error.message === 'Teacher not found') {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: friendlyDbError(error) },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/teachers
// - Sets BOTH record_status = 'Deleted' AND is_active = false
//   (per Bhuvan: faculty login only checks is_active, so both must be set).
// ============================================================================

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const result = await sql`
      UPDATE sgs_teacher_master
      SET record_status = 'Deleted', is_active = false
      WHERE teacher_id = ${id}
      RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    return NextResponse.json(
      { error: friendlyDbError(error) },
      { status: 500 }
    );
  }
}