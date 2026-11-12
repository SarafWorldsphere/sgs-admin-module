
import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { verifyAdminToken } from '../../../lib/auth-verify';

// ============================================================================
// GET — return BOTH Active + Inactive. Graceful if table doesn't exist.
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

    const events = await sql`
      SELECT 
        event_id as id,
        event_title as title,
        event_description as message,
        event_date as date,
        event_type as type,
        applicable_class,
        record_status as status
      FROM sgs_events
      WHERE record_status IN ('Active', 'Inactive')
      ORDER BY event_date DESC, event_id DESC
    `;
    return NextResponse.json(events);
  } catch (error) {
    // Table might not exist yet — return empty instead of crashing
    if (error.code === '42P01') {
      console.log('sgs_events table does not exist yet');
      return NextResponse.json([], { status: 200 });
    }
    console.error('Database error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// ============================================================================
// POST — insert OR update
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
    const { id, title, message, date, applicable_class, type } = body;

    if (id) {
      const result = await sql`
        UPDATE sgs_events
        SET
          event_title = ${title},
          event_description = ${message},
          event_date = ${date},
          applicable_class = ${applicable_class || 'all'},
          event_type = ${type || 'event'}
        WHERE event_id = ${id}
        RETURNING *
      `;
      if (result.length === 0) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, event: result[0], message: 'Event updated successfully' });
    }

    const result = await sql`
      INSERT INTO sgs_events (
        event_title, event_description, event_date, applicable_class, event_type, record_status
      ) VALUES (
        ${title}, ${message}, ${date}, ${applicable_class || 'all'}, ${type || 'event'}, 'Active'
      ) RETURNING *
    `;
    return NextResponse.json({ success: true, event: result[0], message: 'Event created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error saving event:', error);
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'Events table does not exist yet. Please contact your DB administrator.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================================
// PUT — status-only toggle
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
      return NextResponse.json({ error: 'Event id is required' }, { status: 400 });
    }
    if (status !== 'Active' && status !== 'Inactive') {
      return NextResponse.json({ error: 'status must be "Active" or "Inactive"' }, { status: 400 });
    }

    const result = await sql`
      UPDATE sgs_events
      SET record_status = ${status}
      WHERE event_id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, event: result[0] });
  } catch (error) {
    console.error('Error toggling event status:', error);
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'Events table does not exist yet' },
        { status: 503 }
      );
    }
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
      UPDATE sgs_events SET record_status = 'Deleted'
      WHERE event_id = ${id} RETURNING *
    `;
    if (result.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
