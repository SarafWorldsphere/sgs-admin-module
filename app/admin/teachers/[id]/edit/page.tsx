'use client';

import { useRouter, useParams } from 'next/navigation';
import TeacherFormPage from '../../../../../components/TeacherFormPage';

export default function EditTeacherPage() {
  const router = useRouter();
  const params = useParams();
  const teacherId = params?.id ? String(params.id) : '';

  return (
    <TeacherFormPage
      mode="edit"
      teacherId={teacherId}
      onCancel={() => router.push('/admin/teachers')}
      onSuccess={() => router.push('/admin/teachers')}
    />
  );
}