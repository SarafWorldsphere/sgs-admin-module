// lib/syllabus-api.js

export async function fetchUnmatchedTopics(classId, subjectId) {
  // Adding the proxy paths Bhuvan requested
  const res = await fetch(`/admin/api/academic-setup/syllabus-plan/unmatched?class_id=${classId}&subject_id=${subjectId}`);
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to fetch unmatched topics');
  }
  return res.json();
}

export async function matchTopicToChapter(planId, chapterId, versionNo) {
  const res = await fetch(`/admin/api/academic-setup/syllabus-plan/${planId}`, {
    method: 'PATCH', // Will work once Swati updates proxy
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_id: chapterId, version_no: versionNo })
  });
  
  if (!res.ok) {
    const err = await res.json();
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : err.detail;
    throw new Error(msg || 'Failed to match topic');
  }
  return res.json();
}