'use client';

import dynamic from 'next/dynamic';

// ✅ Load the component ONLY on the client side. Skip SSR entirely.
const TimetablePageContent = dynamic(
  () => import('../../../components/TimetablePageContent'),
  { ssr: false }
);

export default function TimetablePage() {
  return <TimetablePageContent />;
}