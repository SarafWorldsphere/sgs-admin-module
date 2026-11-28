'use client';

import { useState, useEffect } from 'react';
import { fetchUnmatchedTopics, matchTopicToChapter } from '../../../lib/syllabus-api';

export default function SyllabusPlanPage() {
  const [unmatched, setUnmatched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  
  // Real dropdowns (mocked endpoints for now)
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  // Mock data for dropdowns - replace with actual fetch('/api/admin/classes') later
  const classes = [{ id: '1', name: 'Class 8' }, { id: '2', name: 'Class 9' }];
  const subjects = [{ id: '1', name: 'Mathematics' }, { id: '2', name: 'Science' }];

  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;

    async function loadTopics() {
      setLoading(true);
      setMessage(null);
      try {
        const data = await fetchUnmatchedTopics(selectedClass, selectedSubject);
        setUnmatched(data.items || []);
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadTopics();
  }, [selectedClass, selectedSubject]);

  const handleMatch = async (planId: number, chapterIdStr: string, versionNo: number) => {
    const chapterId = parseInt(chapterIdStr);
    if (!chapterId) {
      setMessage({ type: 'error', text: 'Please enter a valid Chapter ID' });
      return;
    }

    try {
      await matchTopicToChapter(planId, chapterId, versionNo);
      
      // Fix: Use functional state update to avoid stale state
      setUnmatched(prev => prev.filter((u: any) => u.plan_id !== planId));
      setMessage({ type: 'success', text: 'Topic matched successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Topic to Chapter Matching</h1>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <select className="border rounded p-2" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">Select Class</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="border rounded p-2" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}>
          <option value="">Select Subject</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading && <div>Loading...</div>}

      {!loading && selectedClass && selectedSubject && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Topic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Chapter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Override Chapter ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unmatched.map((item: any) => (
                <tr key={item.plan_id}>
                  <td className="px-6 py-4 whitespace-nowrap">{item.topic_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-600 font-medium">
                    {item.suggested_chapter_name || 'None'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Allows admin to override the suggestion */}
                    <input 
                      type="number" 
                      placeholder="Chapter ID" 
                      defaultValue={item.suggested_chapter_id || ''}
                      id={`input-chapter-${item.plan_id}`}
                      className="border rounded p-1 w-24"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => {
                        const input = document.getElementById(`input-chapter-${item.plan_id}`) as HTMLInputElement;
                        handleMatch(item.plan_id, input.value, item.version_no);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Confirm Match
                    </button>
                  </td>
                </tr>
              ))}
              {unmatched.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">All topics are matched!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}