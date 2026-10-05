import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// ============================================================================
// HELPERS
// ============================================================================

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
    if (msg.includes('student_email')) return 'This student email is already used by another student.';
    if (msg.includes('admission_no')) return 'A student with this admission number already exists.';
    if (msg.includes('sgs_parent_master_email_key')) return 'This parent email conflicts with an existing parent record.';
    return 'A duplicate record was detected. Please check the values and try again.';
  }

  if (code === '23514' || /violates check constraint/i.test(msg)) {
    if (msg.includes('chk_student_email')) return 'Student email must be a @gmail.com address.';
    if (msg.includes('chk_guardian_email')) return 'Guardian email must be a @gmail.com address.';
    return 'One of the values does not meet the required format.';
  }

  if (code === '23503' || /foreign key/i.test(msg)) {
    if (msg.includes('class_id')) return 'The selected class does not exist.';
    return 'A referenced record does not exist.';
  }

  return 'Something went wrong while saving. Please try again or contact support.';
}

function buildParentsFromPayload(body) {
  const list = [];
  const tryAdd = (name, email, phone, relationship) => {
    if (!email || !String(email).trim()) return;
    if (!isValidEmail(email)) return;
    if (!name || !String(name).trim()) return;
    list.push({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? normalizePhone(phone) : null,
      relationship,
    });
  };
  tryAdd(body.parent1_name, body.parent1_email, body.parent1_phone, 'parent');
  tryAdd(body.parent2_name, body.parent2_email, body.parent2_phone, 'parent');
  tryAdd(body.guardian_name, body.guardian_email, body.guardian_phone, 'guardian');
  return list;
}

async function reconcileParents(tx, studentId, parents) {
  const parentRefs = [];
  for (const p of parents) {
    const rows = await tx`
      INSERT INTO sgs_parent_master (full_name, email, phone, record_status, version_no)
      VALUES (${p.name}, ${p.email}, ${p.phone}, 'Active', 1)
      ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            phone = COALESCE(EXCLUDED.phone, sgs_parent_master.phone),
            updated_at = CURRENT_TIMESTAMP
      RETURNING parent_id
    `;
    if (rows.length > 0) {
      parentRefs.push({ parent_id: rows[0].parent_id, relationship: p.relationship });
    }
  }

  if (parentRefs.length > 0) {
    const keepIds = parentRefs.map((r) => r.parent_id);
    await tx`
      DELETE FROM sgs_parent_student_map
      WHERE student_id = ${studentId}
        AND parent_id NOT IN ${tx(keepIds)}
    `;
  } else {
    await tx`
      DELETE FROM sgs_parent_student_map
      WHERE student_id = ${studentId}
    `;
  }

  for (const ref of parentRefs) {
    await tx`
      INSERT INTO sgs_parent_student_map (parent_id, student_id, relationship_type)
      VALUES (${ref.parent_id}, ${studentId}, ${ref.relationship})
      ON CONFLICT (parent_id, student_id) DO UPDATE
        SET relationship_type = EXCLUDED.relationship_type
    `;
  }

  return parentRefs.length;
}

// ============================================================================
// GET /api/students
// ============================================================================

export async function GET() {
  try {
    const students = await sql`
      SELECT 
        s.admission_no, s.full_name, s.class_id, s.section, s.roll_no,
        s.parent1_name, s.parent1_phone, s.parent1_email,
        s.parent2_name, s.parent2_phone, s.parent2_email,
        s.student_phone, s.student_email,
        s.guardian_name, s.guardian_phone, s.guardian_email,
        s.record_status, s.is_active,
        c.class_name
      FROM sgs_student_master s
      LEFT JOIN sgs_class_master c ON c.class_id = s.class_id
      WHERE s.record_status IN ('Active', 'Inactive')
        AND s.full_name IS NOT NULL
        AND s.full_name != ''
      ORDER BY s.admission_no
    `;
    return NextResponse.json(students);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// ============================================================================
// POST /api/students
// ============================================================================

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      admission_no, full_name, class_id, section, roll_no,
      parent1_name, parent1_phone, parent1_email,
      parent2_name, parent2_phone, parent2_email,
      student_phone, student_email,
      guardian_name, guardian_phone, guardian_email,
    } = body;

    if (!admission_no || !full_name || !class_id || !section) {
      return NextResponse.json(
        { error: 'Student ID, Name, Class and Section are required' },
        { status: 400 }
      );
    }

    const classCheck = await sql`
      SELECT class_id FROM sgs_class_master
      WHERE class_id = ${class_id} AND record_status = 'Active'
    `;
    if (classCheck.length === 0) {
      return NextResponse.json({ error: `Class ID ${class_id} does not exist.` }, { status: 400 });
    }

    const existing = await sql`
      SELECT admission_no FROM sgs_student_master WHERE admission_no = ${admission_no}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ error: `Student ID ${admission_no} already exists. Please refresh the form to get a new ID.` }, { status: 400 });
    }

    if (student_email && !isGmailEmail(student_email)) {
      return NextResponse.json({ error: 'Student email must be a @gmail.com address.' }, { status: 400 });
    }
    if (guardian_email && !isGmailEmail(guardian_email)) {
      return NextResponse.json({ error: 'Guardian email must be a @gmail.com address.' }, { status: 400 });
    }

    if (student_email && String(student_email).trim()) {
      const dupe = await sql`
        SELECT admission_no, full_name
        FROM sgs_student_master
        WHERE LOWER(student_email) = LOWER(${String(student_email).trim()})
          AND record_status IN ('Active', 'Inactive')
        LIMIT 1
      `;
      if (dupe.length > 0) {
        return NextResponse.json(
          { error: `This student email is already used by ${dupe[0].admission_no}${dupe[0].full_name ? ` (${dupe[0].full_name})` : ''}. Each student must have a unique email.` },
          { status: 400 }
        );
      }
    }

    const parents = buildParentsFromPayload(body);

    const result = await sql.begin(async (tx) => {
      // ✅ FIX (Madhuri): is_active = true on insert so Faculty + Parent can see the student
      const studentRows = await tx`
        INSERT INTO sgs_student_master (
          admission_no, full_name, class_id, section, roll_no,
          parent1_name, parent1_phone, parent1_email,
          parent2_name, parent2_phone, parent2_email,
          student_phone, student_email,
          guardian_name, guardian_phone, guardian_email,
          record_status, is_active
        ) VALUES (
          ${admission_no}, ${full_name}, ${class_id}, ${section}, ${roll_no},
          ${parent1_name || null}, ${parent1_phone ? normalizePhone(parent1_phone) : null}, ${parent1_email || null},
          ${parent2_name || null}, ${parent2_phone ? normalizePhone(parent2_phone) : null}, ${parent2_email || null},
          ${student_phone ? normalizePhone(student_phone) : null}, ${student_email || null},
          ${guardian_name || null}, ${guardian_phone ? normalizePhone(guardian_phone) : null}, ${guardian_email || null},
          'Active', true
        ) RETURNING student_id, admission_no
      `;

      const studentId = studentRows[0].student_id;
      const parentCount = await reconcileParents(tx, studentId, parents);

      return { student: studentRows[0], parentCount };
    });

    return NextResponse.json(
      { success: true, student: result.student, parentsLinked: result.parentCount },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding student:', error);
    return NextResponse.json({ error: friendlyDbError(error) }, { status: 500 });
  }
}

// ============================================================================
// PUT /api/students
// ============================================================================

export async function PUT(request) {
  try {
    const body = await request.json();
    const { admission_no, status } = body;

    if (!admission_no) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // STATUS-ONLY TOGGLE — keeps is_active and record_status in sync
    if (status !== undefined && !body.full_name) {
      const newStatus = status === 'Active' ? 'Active' : 'Inactive';
      const newIsActive = newStatus === 'Active';
      const result = await sql`
        UPDATE sgs_student_master
        SET record_status = ${newStatus},
            is_active = ${newIsActive}
        WHERE admission_no = ${admission_no}
        RETURNING *
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, student: result[0] });
    }

    // FULL UPDATE
    const {
      full_name, class_id, section, roll_no,
      parent1_name, parent1_phone, parent1_email,
      parent2_name, parent2_phone, parent2_email,
      student_phone, student_email,
      guardian_name, guardian_phone, guardian_email,
    } = body;

    if (class_id) {
      const classCheck = await sql`
        SELECT class_id FROM sgs_class_master
        WHERE class_id = ${class_id} AND record_status = 'Active'
      `;
      if (classCheck.length === 0) {
        return NextResponse.json({ error: `Class ID ${class_id} does not exist.` }, { status: 400 });
      }
    }

    if (student_email && !isGmailEmail(student_email)) {
      return NextResponse.json({ error: 'Student email must be a @gmail.com address.' }, { status: 400 });
    }
    if (guardian_email && !isGmailEmail(guardian_email)) {
      return NextResponse.json({ error: 'Guardian email must be a @gmail.com address.' }, { status: 400 });
    }

    if (student_email && String(student_email).trim()) {
      const dupe = await sql`
        SELECT admission_no, full_name
        FROM sgs_student_master
        WHERE LOWER(student_email) = LOWER(${String(student_email).trim()})
          AND admission_no != ${admission_no}
          AND record_status IN ('Active', 'Inactive')
        LIMIT 1
      `;
      if (dupe.length > 0) {
        return NextResponse.json(
          { error: `This student email is already used by ${dupe[0].admission_no}${dupe[0].full_name ? ` (${dupe[0].full_name})` : ''}. Each student must have a unique email.` },
          { status: 400 }
        );
      }
    }

    const parents = buildParentsFromPayload(body);

    const result = await sql.begin(async (tx) => {
      const updatedRows = await tx`
        UPDATE sgs_student_master SET
          full_name = ${full_name},
          class_id = ${class_id || null},
          section = ${section || null},
          roll_no = ${roll_no || null},
          parent1_name = ${parent1_name || null},
          parent1_phone = ${parent1_phone ? normalizePhone(parent1_phone) : null},
          parent1_email = ${parent1_email || null},
          parent2_name = ${parent2_name || null},
          parent2_phone = ${parent2_phone ? normalizePhone(parent2_phone) : null},
          parent2_email = ${parent2_email || null},
          student_phone = ${student_phone ? normalizePhone(student_phone) : null},
          student_email = ${student_email || null},
          guardian_name = ${guardian_name || null},
          guardian_phone = ${guardian_phone ? normalizePhone(guardian_phone) : null},
          guardian_email = ${guardian_email || null}
        WHERE admission_no = ${admission_no}
        RETURNING student_id
      `;

      if (updatedRows.length === 0) {
        throw new Error('Student not found');
      }

      const studentId = updatedRows[0].student_id;
      const parentCount = await reconcileParents(tx, studentId, parents);

      return { parentCount };
    });

    return NextResponse.json({ success: true, parentsLinked: result.parentCount });
  } catch (error) {
    console.error('Error updating student:', error);
    if (error.message === 'Student not found') {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json({ error: friendlyDbError(error) }, { status: 500 });
  }
}

// ============================================================================
// DELETE /api/students
// ============================================================================

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // ✅ Set both record_status='Deleted' AND is_active=false
    const result = await sql`
      UPDATE sgs_student_master
      SET record_status = 'Deleted', is_active = false
      WHERE admission_no = ${id} RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: friendlyDbError(error) }, { status: 500 });
  }
}