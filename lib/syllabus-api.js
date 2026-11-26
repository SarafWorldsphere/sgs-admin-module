// lib/syllabus-api.js

// Uses the proxy path provided by Bhuvan. 
// No localhost, no tokens needed (the proxy handles auth on the server).

export async function fetchUnmatchedTopics(classId, subjectId) {
  const res = await fetch(
    `/admin/api/academic-setup/syllabus-plan/unmatched?class_id=${classId}&subject_id=${subjectId}`
  );
  
  if (!res.ok) {
    throw new Error('Failed to fetch unmatched topics');
  }
  
  return res.json();
}

export async function matchTopicToChapter(planId, chapterId, versionNo) {
  const res = await fetch(`/admin/api/academic-setup/syllabus-plan/${planId}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ 
      chapter_id: chapterId,
      version_no: versionNo 
    })
  });
  
  if (!res.ok) {
    const err = await res.json();
    // Unpack the FastAPI error array as the PM instructed to avoid [object Object]
    const msg = Array.isArray(err.detail) ? err.detail[0].msg : err.detail;
    throw new Error(msg || 'Failed to match topic');
  }
  
  return res.json();
}