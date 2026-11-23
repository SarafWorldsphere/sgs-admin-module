'use client';

import { useState, useEffect } from 'react';

// 1. Define TypeScript interfaces so your IDE knows the shape of the data
interface UnmatchedTopic {
  plan_id: number;
  block_name: string;
  topic_name: string;
  plan_seq: number;
  suggested_chapter_id: number | null;
  suggested_chapter_name: string | null;
  version_no: number; // We need this for the PATCH request
}

interface Chapter {
  chapter_id: number;
  chapter_name: string;
}

export default function SyllabusPlanPage() {
  const [unmatched, setUnmatched] = useState<UnmatchedTopic[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Hardcoded for testing - replace with actual dropdown selection logic later
  const classId = 8; 
  const subjectId = 3;
  // In the real app, use: const token = sessionStorage.getItem('admin_token');
  const token = "dev-admin"; 

  useEffect(() => {
    async function fetchData() {
      try {
        // 1. Fetch unmatched topics
        const resUnmatched = await fetch(`http://localhost:8010/api/v1/syllabus-plan/unmatched?class_id=${classId}&subject_id=${subjectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataUnmatched = await resUnmatched.json();
        setUnmatched(dataUnmatched.items || []);

        // 2. Fetch available chapters
        const resChapters = await fetch(`http://localhost:8010/api/v1/chapters?class_id=${classId}&subject_id=${subjectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataChapters = await resChapters.json();
        setChapters(dataChapters.items || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 2. Fix the DOM null check and type the parameters
  const handleMatch = async (planId: number, chapterId: string, versionNo: number) => {
    if (!chapterId) {
      alert("Please select a chapter first.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:8010/api/v1/syllabus-plan/${planId}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          chapter_id: parseInt(chapterId, 10),
          version_no: versionNo 
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        // Error unpacking as PM requested
        const errorMsg = Array.isArray(err.detail) ? err.detail[0].msg : err.detail;
        alert(`Error: ${errorMsg}`);
        return;
      }
      
      alert('Matched successfully!');
      // Remove the matched item from the UI so the list stays clean
      setUnmatched(prev => prev.filter(item => item.plan_id !== planId));
      
    } catch (e) {
      console.error(e);
      alert("An error occurred while saving.");
    }
  };

  if (loading) return <div className="p-6">Loading topics...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Topic to Chapter Matching</h1>
      
      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Block</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Match Chapter</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {unmatched.map((item) => (
              <tr key={item.plan_id}>
                <td className="px-6 py-4 whitespace-nowrap">{item.topic_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.block_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select 
                    className="border rounded p-2 w-full"
                    defaultValue={item.suggested_chapter_id || ""}
                    id={`chapter-select-${item.plan_id}`}
                  >
                    <option value="">-- Select Chapter --</option>
                    {chapters.map(c => (
                      <option key={c.chapter_id} value={c.chapter_id}>{c.chapter_name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button 
                    onClick={() => {
                      const selectElement = document.getElementById(`chapter-select-${item.plan_id}`) as HTMLSelectElement | null;
                      
                      // 3. Safely check if selectElement exists before accessing .value
                      if (selectElement && selectElement.value) {
                        // Use item.version_no from the database, fallback to 1 if missing
                        handleMatch(item.plan_id, selectElement.value, item.version_no || 1); 
                      }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    Save Match
                  </button>
                </td>
              </tr>
            ))}
            {unmatched.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  All topics are matched! 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}