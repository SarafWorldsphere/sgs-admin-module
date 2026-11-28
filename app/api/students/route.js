import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { verifyAdminToken } from '../../../lib/auth-verify'; // ✅ Import helper
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
    if (msg.includes('parent_master_email_key')) return 'This parent email conflicts with an existing parent record.';
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
      INSERT INTO parent_master (full_name, email, phone, record_status, version_no)
      VALUES (${p.name}, ${p.email}, ${p.phone}, 'Active', 1)
      ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            phone = COALESCE(EXCLUDED.phone, parent_master.phone),
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
      DELETE FROM parent_student_map
      WHERE student_id = ${studentId}
        AND parent_id NOT IN ${tx(keepIds)}
    `;
  } else {
    await tx`
      DELETE FROM parent_student_map
      WHERE student_id = ${studentId}
    `;
  }

  for (const ref of parentRefs) {
    await tx`
      INSERT INTO parent_student_map (parent_id, student_id, relationship_type)
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

export async function GET(request) {
  // ✅ Verify token first
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  try {
    const students = await sql`
      SELECT 
        s.admission_no, s.full_name, s.class_id, s.section, s.roll_no,
        -- Assuming these columns exist on student_master, if not we will fix next
        s.student_phone, s.student_email,
        s.guardian_name, s.guardian_phone, s.guardian_email,
        s.record_status, s.is_active,
        c.class_name,
        -- Fetch parent 1 (Assuming relationship_type = 'Father')
        p1.full_name AS parent1_name, 
        p1.phone AS parent1_phone, 
        p1.email AS parent1_email,
        -- Fetch parent 2 (Assuming relationship_type = 'Mother')
        p2.full_name AS parent2_name, 
        p2.phone AS parent2_phone, 
        p2.email AS parent2_email
      FROM student_master s
      LEFT JOIN parent_student_map psm1 ON s.student_id = psm1.student_id AND psm1.relationship_type = 'Father'
      LEFT JOIN parent_master p1 ON psm1.parent_id = p1.parent_id
      LEFT JOIN parent_student_map psm2 ON s.student_id = psm2.student_id AND psm2.relationship_type = 'Mother'
      LEFT JOIN parent_master p2 ON psm2.parent_id = p2.parent_id
      WHERE s.record_status IS NOT NULL
      ORDER BY s.admission_no
    `;
    return NextResponse.json(students);
  } catch (error) {
    // 🚨 LOG THE ACTUAL ERROR so it shows in PM2 logs
    console.error('🔥 Database error in students API:', error.message);
    // Return empty array to prevent frontend crash, but the log will tell us why
    return NextResponse.json([], { status: 200 });
  }
}

// ============================================================================
// POST /api/students
// ============================================================================

export async function POST(request) {
  const auth = verifyAdminToken(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const body = await request.json();
    
    // 1. Insert the student
    const studentResult = await sql`
      INSERT INTO student_master (
        admission_no, full_name, class_id, section, roll_no, 
        student_phone, student_email, guardian_name, guardian_phone, guardian_email, 
        record_status, is_active
      ) VALUES (
        ${body.admission_no}, ${body.full_name}, ${body.class_id}, ${body.section}, ${body.roll_no},
        ${body.student_phone}, ${body.student_email}, ${body.guardian_name}, ${body.guardian_phone}, ${body.guardian_email},
        'Active', true
      ) RETURNING student_id
    `;
    const studentId = studentResult[0].student_id;

    // 2. Insert Parent 1 (If provided)
    if (body.parent1_name) {
      const p1 = await sql`
        INSERT INTO parent_master (full_name, phone, email)
        VALUES (${body.parent1_name}, ${body.parent1_phone}, ${body.parent1_email})
        RETURNING parent_id
      `;
      await sql`
        INSERT INTO parent_student_map (parent_id, student_id, relationship_type)
        VALUES (${p1[0].parent_id}, ${studentId}, 'Father')
      `;
    }

    // 3. Insert Parent 2 (If provided)
    if (body.parent2_name) {
      const p2 = await sql`
        INSERT INTO parent_master (full_name, phone, email)
        VALUES (${body.parent2_name}, ${body.parent2_phone}, ${body.parent2_email})
        RETURNING parent_id
      `;
      await sql`
        INSERT INTO parent_student_map (parent_id, student_id, relationship_type)
        VALUES (${p2[0].parent_id}, ${studentId}, 'Mother')
      `;
    }

    return NextResponse.json({ success: true, message: "Student added successfully" });
  } catch (error) {
    console.error('🔥 Error adding student:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================================
// PUT /api/students
// ============================================================================

export async function PUT(request) {
  // ✅ Verify token first
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

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
        UPDATE student_master
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
        SELECT class_id FROM class_master
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
        FROM student_master
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
        UPDATE student_master SET
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
  // ✅ Verify token first
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // ✅ Set both record_status='Deleted' AND is_active=false
    const result = await sql`
      UPDATE student_master
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