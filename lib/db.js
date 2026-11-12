import postgres from 'postgres';
import { headers } from 'next/headers';

const SLOTS = Number(process.env.DB_SERVICE_SLOTS ?? 12);
const RESERVE = Number(process.env.DB_RESERVE ?? 0.2);
const MAX_CONNECTIONS = Number(process.env.DB_MAX_CONNECTIONS ?? 80);
const share = Math.max(2, Math.floor((MAX_CONNECTIONS * (1 - RESERVE)) / SLOTS));
const globalForDb = globalThis;

const sqlBase = globalForDb.__sql ?? postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: share,
  idle_timeout: 30,
  connect_timeout: 10,
  connection: { application_name: process.env.DB_APP_NAME ?? 'sgs-admin' },
});

if (process.env.NODE_ENV !== 'production') globalForDb.__sql = sqlBase;

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
    tenantCache.set(cleanHost, tenantId);
    return tenantId;
  } catch (err) {
    return null;
  }
}

// ✅ Correctly export the tagged template function
export async function sql(strings, ...args) {
  try {
    const headersList = headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    
    const tenantId = await getTenantId(host);
    
    // Fallback if no tenant
    if (!tenantId) return sqlBase(strings, ...args);

    // Run inside a transaction with set_config
    return await sqlBase.begin(async (tx) => {
      await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      
      // 🚨 THE ACTUAL FIX FOR NOT_TAGGED_CALL
      // postgres.js needs to execute the query as a tagged template. 
      // Since 'strings' is the raw array, we can use tx.unsafe() to execute it properly.
      // However, the easiest way to pass template literals through is to use the built-in helper:
      
      const query = strings.reduce((acc, str, i) => {
        return acc + str + (i < args.length ? `$${i + 1}` : '');
      }, '');

      return await tx.unsafe(query, args);
    });
  } catch (error) {
    console.error("DB Query Error:", error);
    // Fallback to base if transaction fails
    return sqlBase(strings, ...args);
  }
}