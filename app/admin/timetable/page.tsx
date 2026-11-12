"use client";

import dynamic from 'next/dynamic';

// 🛑 CRITICAL: We must use ssr: false to prevent the "ReferenceError: s is not defined" (xlsx crash)
const TimetablePageContent = dynamic(() => import('../../../components/TimetablePageContent'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-gray-900">
      <div className="text-white text-xl font-semibold animate-pulse">
        Loading Timetable...
      </div>
    </div>
  )
});

export default function TimetablePage() {
  return <TimetablePageContent />;
}