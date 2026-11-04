import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { verifyAdminToken } from '../../../../lib/auth-verify';

// POST: Add a new period
export async function POST(request) {
  const auth = verifyAdminToken(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { academic_year, label, start_time, end_time } = await request.json();

    if (!label || !start_time || !end_time) {
      return NextResponse.json({ error: 'Label, start time, and end time are required' }, { status: 400 });
    }

    // Find the highest period_no to append after
    const maxPeriod = await sql`
      SELECT MAX(period_no) as max_no 
      FROM sgs_period_master 
      WHERE academic_year = ${academic_year} AND schedule_type = 'full'
    `;
    
    const nextNo = maxPeriod[0].max_no !== null ? maxPeriod[0].max_no + 1 : 1;

    const newPeriod = await sql`
      INSERT INTO sgs_period_master (
        academic_year, schedule_type, period_no, period_label, start_time, end_time, is_teaching, record_status
      ) VALUES (
        ${academic_year}, 'full', ${nextNo}, ${label}, ${start_time}, ${end_time}, true, 'Active'
      ) RETURNING *
    `;

    return NextResponse.json({ success: true, period: newPeriod[0] });
  } catch (error) {
    console.error('Error adding period:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a period
export async function DELETE(request) {
  const auth = verifyAdminToken(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('id');

    if (!periodId) return NextResponse.json({ error: 'Period ID required' }, { status: 400 });

    // Check if this period has data in ANY timetable
    const conflicts = await sql`
      SELECT COUNT(*) as count FROM sgs_timetable 
      WHERE period_no = (SELECT period_no FROM sgs_period_master WHERE period_id = ${periodId})
      AND record_status = 'Active'
    `;

    if (parseInt(conflicts[0].count) > 0) {
      return NextResponse.json({ 
        error: `Cannot delete this period because it has timetable data assigned to it. Please clear the timetable for this period first.` 
      }, { status: 400 });
    }

    await sql`
      DELETE FROM sgs_period_master WHERE period_id = ${periodId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting period:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}