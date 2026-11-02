import postgres from 'postgres';
import { headers } from 'next/headers';

const SLOTS = Number(process.env.DB_SERVICE_SLOTS ?? 12);
const RESERVE = Number(process.env.DB_RESERVE ?? 0.2);
const MAX_CONNECTIONS = Number(process.env.DB_MAX_CONNECTIONS ?? 80);
const share = Math.max(2, Math.floor((MAX_CONNECTIONS * (1 - RESERVE)) / SLOTS));
const globalForDb = globalThis;

// Base connection
const sqlBase = globalForDb.__sql ?? postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: share,
  idle_timeout: 30,
  connect_timeout: 10,
  connection: { application_name: process.env.DB_APP_NAME ?? 'sgs-admin' },
});

if (process.env.NODE_ENV !== 'production') globalForDb.__sql = sqlBase;

/**
 * Resolve the tenant_id based on the host header.
 * We cache this in memory to avoid a DB roundtrip on every single query.
 */
const tenantCache = new Map();

async function getTenantId(host) {
  if (!host) return null;
  
  // Clean the host: remove port (e.g., localhost:3000 -> localhost)
  const cleanHost = host.split(':')[0];
  
  if (tenantCache.has(cleanHost)) {
    return tenantCache.get(cleanHost);
  }

  try {
    // Look up the tenant in the platform table
    const rows = await sqlBase`
      SELECT tenant_id 
      FROM platform.tenant_domains 
      WHERE domain = ${cleanHost} 
      LIMIT 1
    `;
    
    const tenantId = rows.length > 0 ? rows[0].tenant_id : null;
    tenantCache.set(cleanHost, tenantId); // cache it
    return tenantId;
  } catch (err) {
    console.error('Error resolving tenant:', err);
    return null;
  }
}

/**
 * The exported `sql` function.
 * It wraps the query in a transaction and sets app.tenant_id before running.
 */
export async function sql(strings, ...args) {
  try {
    const headersList = headers();
    // In Next.js, x-forwarded-host is set by Nginx, falling back to host
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    
    const tenantId = await getTenantId(host);

    // If no tenant found, run the query without RLS context (it will return 0 rows)
    if (!tenantId) {
      return sqlBase(strings, ...args);
    }

    // Use sqlBase.begin to ensure the set_config happens in the same connection context
    return await sqlBase.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return tx(strings, ...args);
    });
  } catch (error) {
    // If headers() fails (e.g., outside request context), fallback to raw query
    return sqlBase(strings, ...args);
  }
}