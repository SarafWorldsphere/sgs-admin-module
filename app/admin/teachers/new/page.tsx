'use client';

import { useRouter } from 'next/navigation';
import TeacherFormPage from '../../../../components/TeacherFormPage';

export default function NewTeacherPage() {
  const router = useRouter();
  return (
    <TeacherFormPage
      mode="add"
      onCancel={() => router.push('/admin/teachers')}
      onSuccess={() => router.push('/admin/teachers')}
    />
  );
}