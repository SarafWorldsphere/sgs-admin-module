import postgres from 'postgres';
import { headers } from 'next/headers';

const globalForDb = globalThis;

// 1. Create the base connection
const sqlBase = globalForDb.__sql ?? postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});

if (process.env.NODE_ENV !== 'production') globalForDb.__sql = sqlBase;

// 2. Cache tenant lookups to avoid hitting DB on every query
const tenantCache = new Map();

async function getTenantId(host) {
  if (!host) return null;
  const cleanHost = host.split(':')[0]; // remove port (localhost:3000 -> localhost)
  if (tenantCache.has(cleanHost)) return tenantCache.get(cleanHost);

  try {
    const rows = await sqlBase`
      SELECT tenant_id FROM platform.tenant_domains WHERE domain = ${cleanHost} LIMIT 1
    `;
    const tenantId = rows.length > 0 ? rows[0].tenant_id : null;
    tenantCache.set(cleanHost, tenantId);
    return tenantId;
  } catch (err) {
    console.error('Error resolving tenant:', err);
    return null;
  }
}

// 3. Export the main `sql` function
export async function sql(strings, ...args) {
  try {
    // Next.js App Router way to get headers
    const headersList = headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    
    const tenantId = await getTenantId(host);

    // If no tenant found, run without RLS context (returns 0 rows)
    if (!tenantId) {
      return sqlBase(strings, ...args);
    }

    // Run query in a transaction and set the tenant context
    return await sqlBase.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return tx(strings, ...args);
    });
  } catch (error) {
    // Fallback for Next.js build-time execution where headers() fails
    return sqlBase(strings, ...args);
  }
}