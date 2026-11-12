
import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { verifyAdminToken } from '../../../lib/auth-verify';

// ============================================================================
// GET — return BOTH Active + Inactive (so the toggle is possible)
// ============================================================================

export async function GET(request) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing token' },
        { status: 401 }
      );
    }

    const notices = await sql`
      SELECT
        notice_id as id,
        notice_title as title,
        notice_text as message,
        notice_date as date,
        applicable_class,
        record_status as status
      FROM sgs_notice_board
      WHERE record_status IN ('Active', 'Inactive')
      ORDER BY notice_date DESC, notice_id DESC
    `;
    return NextResponse.json(notices);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// ============================================================================
// POST — insert new OR update existing (id present)
// ============================================================================

export async function POST(request) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, title, message, date, applicable_class } = body;

    if (id) {
      const result = await sql`
        UPDATE sgs_notice_board
        SET
          notice_title = ${title},
          notice_text = ${message},
          notice_date = ${date},
          applicable_class = ${applicable_class || 'all'}
        WHERE notice_id = ${id}
        RETURNING *
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, notice: result[0], message: 'Notice updated successfully' });
    }

    const result = await sql`
      INSERT INTO sgs_notice_board (
        notice_title, notice_text, notice_date, applicable_class, record_status
      ) VALUES (
        ${title}, ${message}, ${date}, ${applicable_class || 'all'}, 'Active'
      ) RETURNING *
    `;
    return NextResponse.json({ success: true, notice: result[0], message: 'Notice created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error saving notice:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================================
// PUT — status-only toggle
// Body: { id, status: 'Active' | 'Inactive' }
// ============================================================================

export async function PUT(request) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Notice id is required' }, { status: 400 });
    }
    if (status !== 'Active' && status !== 'Inactive') {
      return NextResponse.json({ error: 'status must be "Active" or "Inactive"' }, { status: 400 });
    }

    const result = await sql`
      UPDATE sgs_notice_board
      SET record_status = ${status}
      WHERE notice_id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, notice: result[0] });
  } catch (error) {
    console.error('Error toggling notice status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

// ============================================================================
// DELETE — soft delete
// ============================================================================

export async function DELETE(request) {
  try {
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const result = await sql`
      UPDATE sgs_notice_board SET record_status = 'Deleted'
      WHERE notice_id = ${id} RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Notice not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Notice deleted successfully' });
  } catch (error) {
    console.error('Error deleting notice:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
