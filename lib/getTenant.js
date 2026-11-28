import { sql } from './db';
import { headers } from 'next/headers';

export async function getTenantName() {
  try {
    const result = await sql`
     SELECT * FROM platform.tenants LIMIT 1
   `;
    
    if (result && result.length > 0) {
      return { 
       name: result[0].tenant_name || result[0].name || 'Admin Dashboard',
       logo: '/sgslogo.jpeg'
      };
 }
  } catch (error) {
    console.error("Failed to fetch tenant info:", error);
  }
  
  // FALLBACK: Check URL if DB fails
  try {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    
    if (host.includes('sss')) {
      return { name: 'Shiva Satya Sai School', logo: '/ssslogo.jpeg' };
    }
  } catch (e) {
    // Ignore error
  }

  return { name: 'Admin Dashboard', logo: '/sgslogo.jpeg' };
}