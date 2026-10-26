'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';

const dayNames = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

export default function TimetableCellPicker({ isOpen, cell, assignments, onSave, onCancel }) {
  const [subject, setSubject] = useState('');
  const [teacherId, setTeacherId] = useState('');

  // Prefill from current cell
  useEffect(() => {
    if (cell?.current) {
      setSubject(cell.current.subject_name || '');
      setTeacherId(cell.current.teacher_id || '');
    } else {
      setSubject('');
      setTeacherId('');
    }
  }, [cell]);

  // Unique subjects from assignments
  const uniqueSubjects = Array.from(
    new Set(assignments.map((a) => a.subject_name).filter(Boolean))
  ).sort();

  // Filter teachers who teach the selected subject
  const teacherOptions = subject
    ? assignments.filter((a) => a.subject_name === subject)
    : assignments;

  // If user changes subject, reset teacher if not compatible
  useEffect(() => {
    if (!subject || !teacherId) return;
    const valid = teacherOptions.some((t) => t.teacher_id === teacherId);
    if (!valid) setTeacherId('');
  }, [subject]);

  if (!isOpen || !cell) return null;

  const handleSave = () => {
    if (!subject || !teacherId) return;
    onSave(subject, teacherId);
  };

  const handleRemove = () => {
    onSave(null, null);
  };

  const canSave = subject && teacherId;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-md bg-gray-900 rounded-2xl border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {cell.current ? 'Edit' : 'Add'} Slot
              </h3>
              <p className="text-sm text-white/60 mt-0.5">
                {dayNames[cell.day_of_week]} · Period {cell.period_no}
              </p>
            </div>
            <button onClick={onCancel} className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Select a subject</option>
                {uniqueSubjects.map((s) => (
                  <option key={s} value={s} style={{ color: '#111827', backgroundColor: '#ffffff' }}>{s}</option>
                ))}
              </select>
              {uniqueSubjects.length === 0 && (
                <p className="mt-1 text-xs text-yellow-400">
                  No teachers are assigned to this class-section yet. Assign them in Teacher Management first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Teacher</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                disabled={!subject}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                  {subject ? 'Select a teacher' : 'Select subject first'}
                </option>
                {teacherOptions.map((t) => (
                  <option key={t.teacher_id} value={t.teacher_id} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                    {t.teacher_name || t.teacher_id}{t.is_class_teacher ? ' ★' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
            {cell.current && (
              <button
                onClick={handleRemove}
                className="px-4 py-2.5 bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 transition flex items-center justify-center gap-2"
              >
                <Trash2 size={16} /> Remove
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              Save Slot
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}