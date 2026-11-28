// app/academic-setup/layout.tsx
import AdminLayoutClient from '../admin/AdminLayoutClient';
import { getTenantName } from '../../lib/getTenant';

export default async function AcademicSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch the tenant dynamically so the sidebar works for both SGS and SSS
  const tenant = await getTenantName();

  return (
    <AdminLayoutClient tenant={tenant}>
      {children}
    </AdminLayoutClient>
  );
}