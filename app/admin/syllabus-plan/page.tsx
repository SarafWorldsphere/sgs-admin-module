'use client';

import { useState, useEffect } from 'react';
import { fetchUnmatchedTopics, matchTopicToChapter } from '../../../lib/syllabus-api'; // Adjust import path if needed

export default function SyllabusPlanPage() {
  const [unmatched, setUnmatched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Murthy's Fix: Dynamic selections
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Dummy dropdowns (You will wire these to real APIs later)
  const classes = [{ id: '1', name: 'Class 8' }, { id: '2', name: 'Class 9' }];
  const subjects = [{ id: '1', name: 'Mathematics' }, { id: '2', name: 'Science' }];

  useEffect(() => {
    // Only fetch when both are selected
    if (!selectedClass || !selectedSubject) return;

    async function loadTopics() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchUnmatchedTopics(selectedClass, selectedSubject);
        setUnmatched(data.items || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadTopics();
  }, [selectedClass, selectedSubject]);

  const handleMatch = async (planId: number, chapterId: number, versionNo: number) => {
    try {
      await matchTopicToChapter(planId, chapterId, versionNo);
      
      // Remove from the list on success
      setUnmatched(unmatched.filter((u: any) => u.plan_id !== planId));
      alert('Topic matched successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Topic to Chapter Matching</h1>
      
      {/* Dropdowns to fix the hardcoded IDs */}
      <div className="flex gap-4 mb-6">
        <select 
          className="border rounded p-2" 
          value={selectedClass} 
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="">Select Class</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select 
          className="border rounded p-2" 
          value={selectedSubject} 
          onChange={(e) => setSelectedSubject(e.target.value)}
        >
          <option value="">Select Subject</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}
      {loading && <div>Loading unmatched topics...</div>}

      {!loading && selectedClass && selectedSubject && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Block</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Chapter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unmatched.map((item: any) => (
                <tr key={item.plan_id}>
                  <td className="px-6 py-4 whitespace-nowrap">{item.topic_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.block_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Using the suggestion from the backend as Bhuvan requested */}
                    {item.suggested_chapter_name ? (
                      <span className="text-green-600 font-medium">{item.suggested_chapter_name}</span>
                    ) : (
                      <span className="text-gray-400 italic">No suggestion</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => {
                        if (!item.suggested_chapter_id) {
                          alert("Cannot match: No suggested chapter ID provided by backend yet.");
                          return;
                        }
                        handleMatch(item.plan_id, item.suggested_chapter_id, item.version_no);
                      }}
                      disabled={!item.suggested_chapter_id}
                      className={`px-4 py-2 rounded text-white ${item.suggested_chapter_id ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                      Confirm Match
                    </button>
                  </td>
                </tr>
              ))}
              {unmatched.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No unmatched topics found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}