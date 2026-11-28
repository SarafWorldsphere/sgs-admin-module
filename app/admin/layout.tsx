// app/admin/layout.tsx
import { getTenantName } from '../../lib/getTenant';
import AdminLayoutClient from './AdminLayoutClient';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Returns { name: '...', logo: '...' }
  const tenant = await getTenantName();

  return (
    <AdminLayoutClient tenant={tenant}>
      {children}
    </AdminLayoutClient>
  );
}