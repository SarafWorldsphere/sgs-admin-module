import { NextResponse } from 'next/server';
// Adjusted path: from app/api/classes/route.js, go up 3 levels to reach lib/
import { sql } from '../../../lib/db';
import { verifyAdminToken } from '../../../lib/auth-verify'; 

export async function GET(request) { // Added request parameter to read headers
  try {
    // 🛑 1. PROTECT THE ROUTE
    const admin = await verifyAdminToken(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing token' }, { status: 401 });
    }

    // 🟢 2. RUN DATABASE QUERY (Only if auth passes)
    const rows = await sql`
      SELECT 
        class_id,
        class_name,
        section_name
      FROM sgs_class_master
      WHERE record_status = 'Active'
      ORDER BY class_id
    `;

    // Group by class_name → unique classes with their available sections
    const byClassName = new Map();
    for (const r of rows) {
      const name = (r.class_name || '').trim();
      if (!name) continue; // skip blank names
      const section = (r.section_name || '').trim();
      if (!byClassName.has(name)) {
        byClassName.set(name, {
          class_name: name,
          class_ids: [],
          sections: new Set(),
        });
      }
      const entry = byClassName.get(name);
      entry.class_ids.push(r.class_id);
      if (section) entry.sections.add(section);
    }

    // Convert Sets to arrays, produce sorted output
    const classes = Array.from(byClassName.values())
      .map((c) => ({
        class_name: c.class_name,
        class_ids: c.class_ids,
        // Primary class_id for back-compat (first match)
        class_id: c.class_ids[0],
        sections: Array.from(c.sections).sort(),
      }))
      .sort((a, b) => {
        const na = parseInt(a.class_name, 10);
        const nb = parseInt(b.class_name, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.class_name.localeCompare(b.class_name);
      });

    console.log('✅ Fetched classes:', classes.length);
    return NextResponse.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json([], { status: 200 });
  }
}