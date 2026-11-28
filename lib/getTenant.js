import { sql } from './db';

export async function getTenantName() {
  try {
    // Assuming your tenants table has a 'name' and a 'logo_url' column.
    // If the logo is just a filename, you can return that instead.
    const result = await sql`
      SELECT name, slug 
      FROM platform.tenants 
      LIMIT 1
    `;
    
    if (result && result.length > 0) {
      return { 
        name: result[0].name,
        // If you have a logo column use it, otherwise fallback to a default
        logo: result[0].logo_url || (result[0].slug === 'sss' ? '/ssslogo.jpeg' : '/sgslogo.jpeg')
      };
    }
  } catch (error) {
    console.error("Failed to fetch tenant info:", error);
  }
  return { name: 'Admin Dashboard', logo: '/sgslogo.jpeg' }; // Fallback
}