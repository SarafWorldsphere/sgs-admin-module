import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// Config per ID type
function getConfigFor(type) {
  switch (type) {
    case 'teacher':
      return { prefix: 'T', tableName: 'sgs_teacher_master', idColumn: 'teacher_id' };
    case 'headmaster':
      return { prefix: 'H', tableName: 'sgs_teacher_master', idColumn: 'teacher_id' };
    case 'student':
    default:
      return { prefix: 'S', tableName: 'sgs_student_master', idColumn: 'admission_no' };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'student';
  const { prefix, tableName, idColumn } = getConfigFor(type);

  try {
    console.log(`🔍 Generating ${type} ID...`);
    console.log(`📋 Table: ${tableName}, Column: ${idColumn}, Prefix: ${prefix}`);

    // Check if table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )`,
      [tableName]
    );

    if (!tableCheck.rows[0].exists) {
      console.log(`❌ Table ${tableName} not found`);
      return NextResponse.json({ id: `${prefix}001` });
    }

    // ✅ FIX: numeric sort instead of string sort.
    // Extract the numeric part after the prefix and sort numerically.
    // This works for T1, T76, T215, S001, S312, etc.
    // Also includes soft-deleted rows so IDs are never reused.
    let result;
    try {
      result = await pool.query(
        `SELECT ${idColumn} 
         FROM ${tableName} 
         WHERE ${idColumn} ~ $1
         ORDER BY CAST(SUBSTRING(${idColumn} FROM '^[A-Z]([0-9]+)$') AS BIGINT) DESC NULLS LAST
         LIMIT 1`,
        [`^${prefix}[0-9]+$`]
      );
    } catch (err) {
      console.log('⚠️ Numeric sort failed, using fallback:', err.message);
      // Very defensive fallback: return the first of the top N by string order
      result = await pool.query(
        `SELECT ${idColumn} 
         FROM ${tableName} 
         WHERE ${idColumn} LIKE $1
         ORDER BY ${idColumn} DESC 
         LIMIT 100`,
        [`${prefix}%`]
      );
    }

    let nextNumber = 1;
    if (result.rows.length > 0) {
      // Find the true max numeric across the returned rows (in case fallback was used)
      let maxNum = 0;
      for (const row of result.rows) {
        const rawId = row[idColumn];
        const match = String(rawId).match(new RegExp(`^${prefix}(\\d+)$`));
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
      if (maxNum > 0) {
        nextNumber = maxNum + 1;
        console.log(`📝 Highest ${prefix}-ID found: ${prefix}${maxNum}`);
        console.log(`📊 Next number: ${nextNumber}`);
      } else {
        console.log(`📊 No numeric ${prefix}-IDs found, starting from 1`);
      }
    } else {
      console.log(`📊 No existing IDs found, starting from 1`);
    }

    const newId = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    console.log(`✅ Generated ${type} ID: ${newId}`);

    return NextResponse.json({ id: newId });
  } catch (error) {
    console.error('❌ Error generating ID:', error);
    // ✅ FIXED: fallback uses the correct prefix per type (was hardcoded S001)
    const fallbackId = `${prefix}001`;
    console.log(`⚠️ Using fallback ID: ${fallbackId}`);
    return NextResponse.json({ id: fallbackId });
  }
}