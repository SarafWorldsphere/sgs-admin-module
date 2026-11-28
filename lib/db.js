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
  const cleanHost = host.split(':')[0];
  if (tenantCache.has(cleanHost)) return tenantCache.get(cleanHost);

  try {
    const rows = await sqlBase`
      SELECT tenant_id FROM platform.tenant_domains WHERE domain = ${cleanHost} LIMIT 1
    `;
    const tenantId = rows.length > 0 ? rows[0].tenant_id : null;
    if (tenantId) tenantCache.set(cleanHost, tenantId);
    return tenantId;
  } catch (err) {
    console.error('Error resolving tenant from DB:', err);
    return null;
  }
}

// 3. Export the main `sql` function
export async function sql(strings, ...args) {
  try {
    // Awaited: headers() returns a Promise from Next 15 onwards, and this
    // module is on 16.2. Without the await, headersList was the Promise
    // itself, so .get threw "c.get is not a function" and every query in the
    // admin module failed — the error does not mention headers, so the catch
    // below rethrew it as a bare 500 with nothing pointing at the cause.
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    
    const tenantId = await getTenantId(host);

    // CRITICAL FIX: If no tenant found, DO NOT fall back to unscoped queries.
    // Throw an error so the UI knows it failed, instead of returning 0 rows (blank page).
    if (!tenantId) {
      throw new Error(`Tenant resolution failed for host: ${host}. Ensure domain is mapped in platform.tenant_domains.`);
    }

    // Run query in a transaction and set the tenant context
    return await sqlBase.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return tx(strings, ...args);
    });
  } catch (error) {
    // If headers() fails (e.g., during next build), handle it
    if (error.message.includes('Dynamic server usage') || error.message.includes('headers()')) {
        return sqlBase(strings, ...args);
    }
    console.error('SQL Execution Error:', error.message);
    throw error; // Fail loudly!
  }
}
