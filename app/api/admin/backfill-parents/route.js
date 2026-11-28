import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

// ============================================================================
// Helpers (duplicated from students route — kept inline so this endpoint is
// self-contained and can be deleted after one-time use)
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

function buildParentsFromRow(row) {
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
  tryAdd(row.parent1_name, row.parent1_email, row.parent1_phone, 'parent');
  tryAdd(row.parent2_name, row.parent2_email, row.parent2_phone, 'parent');
  tryAdd(row.guardian_name, row.guardian_email, row.guardian_phone, 'guardian');
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
// POST /api/admin/backfill-parents
// Auth: requires "Authorization: Bearer <AUTH_SECRET>" header
//       (app login uses localStorage, not NextAuth cookies — so bearer token)
// Query: ?dryRun=true  → no writes, just prints what would happen
// ============================================================================

export async function POST(request) {
  try {
    // ---- Auth check ----
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== process.env.AUTH_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';

    // ---- Fetch all students (skip Deleted) ----
    const students = await sql`
      SELECT 
        student_id, admission_no, full_name,
        parent1_name, parent1_email, parent1_phone,
        parent2_name, parent2_email, parent2_phone,
        guardian_name, guardian_email, guardian_phone
      FROM student_master
      WHERE record_status IN ('Active', 'Inactive')
      ORDER BY student_id
    `;

    const results = [];

    for (const s of students) {
      const parents = buildParentsFromRow(s);

      if (parents.length === 0) {
        results.push({
          student_id: s.student_id,
          admission_no: s.admission_no,
          name: s.full_name,
          action: 'skipped',
          reason: 'no valid parent/guardian with email',
        });
        continue;
      }

      if (dryRun) {
        results.push({
          student_id: s.student_id,
          admission_no: s.admission_no,
          name: s.full_name,
          action: 'would-write',
          parents: parents.map((p) => ({ email: p.email, relationship: p.relationship })),
        });
        continue;
      }

      // ---- Real write in transaction ----
      try {
        const count = await sql.begin(async (tx) => {
          return await reconcileParents(tx, s.student_id, parents);
        });
        results.push({
          student_id: s.student_id,
          admission_no: s.admission_no,
          name: s.full_name,
          action: 'written',
          parentsLinked: count,
        });
      } catch (err) {
        console.error(`Backfill failed for student ${s.admission_no}:`, err);
        results.push({
          student_id: s.student_id,
          admission_no: s.admission_no,
          name: s.full_name,
          action: 'error',
          error: err.message,
        });
      }
    }

    const summary = {
      dryRun,
      total: results.length,
      skipped: results.filter((r) => r.action === 'skipped').length,
      written: results.filter((r) => r.action === 'written').length,
      errored: results.filter((r) => r.action === 'error').length,
    };

    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Block GET — force POST so backfill can't be triggered by a link/refresh
export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}