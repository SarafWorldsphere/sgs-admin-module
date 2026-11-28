// lib/syllabus-api.ts

export async function fetchUnmatchedTopics(classId: string, subjectId: string) {
  const res = await fetch(`/admin/api/academic-setup/syllabus-plan/unmatched?class_id=${classId}&subject_id=${subjectId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch unmatched topics');
  }
  return res.json();
}

export async function matchTopicToChapter(planId: number, chapterId: number, versionNo: number) {
  const res = await fetch(`/admin/api/academic-setup/syllabus-plan/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      chapter_id: chapterId, 
      version_no: versionNo 
    })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : err.detail;
    throw new Error(msg || 'Failed to match topic');
  }
  return res.json();
}