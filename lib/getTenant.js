import { sql } from './db';
import { headers } from 'next/headers';

export async function getTenantName() {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    
    // 1. First try to get from DB safely
    try {
      const result = await sql`
        SELECT * FROM platform.tenants 
        WHERE slug = ${host.includes('sss') ? 'sss' : 'sgs'}
        LIMIT 1
      `;
      if (result && result.length > 0) {
        return { 
          name: result[0].tenant_name || result[0].name || (host.includes('sss') ? 'Shiva Satya Sai School' : 'SGS High School'),
          logo: host.includes('sss') ? '/ssslogo.jpeg' : '/ssslogo.jpeg'
        };
      }
    } catch (e) {
      // Ignore DB error, fall through to URL check
    }

    // 2. If DB fails, use URL
    if (host.includes('sss')) {
      return { name: 'Shiva Satya Sai School', logo: '/sgslogo.jpeg' };
    } else if (host.includes('sgs')) {
      return { name: 'SGS High School', logo: '/sgslogo.jpeg' };
    }
  } catch (error) {
    console.error("Headers error:", error);
  }

  return { name: 'Admin Dashboard', logo: '/ssslogo.jpeg' };
}