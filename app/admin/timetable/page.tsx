'use client';

import { useState, useEffect } from 'react';
import { Save, AlertCircle, RefreshCw } from 'lucide-react';
import TimetableGrid from '../../../components/TimetableGrid';
import AlertModal from '../../../components/AlertModal';
import { formatClassName } from '../../../lib/format-class-name';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';
const DEFAULT_YEAR = '2026-27';

export default function TimetablePage() {
  const [classes, setClasses] = useState([]);
  const [sectionsByClass, setSectionsByClass] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  const [timetable, setTimetable] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'info' });
  const showAlert = (message, variant = 'error', title = 'Error') =>
    setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () => setAlertState({ isOpen: false, title: '', message: '', variant: 'info' });

  // Fetch classes on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/classes`);
        const data = await res.json();
        setClasses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading classes:', err);
        showAlert('Could not load classes.', 'error', 'Load Failed');
      }
    })();
  }, []);

  // Fetch sections when class changes
  useEffect(() => {
    if (!selectedClass) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sections?class_id=${selectedClass}`);
        const data = await res.json();
        setSectionsByClass((prev) => ({ ...prev, [selectedClass]: data.sections || [] }));
        setSelectedSection('');
        setTimetable(null);
      } catch (err) {
        console.error('Error loading sections:', err);
      }
    })();
  }, [selectedClass]);

  // Load timetable when class+section ready
  useEffect(() => {
    if (!selectedClass || !selectedSection) {
        setTimetable(null);
        setAssignments([]);
        return;
    }
    (async () => {
      setLoading(true);
      setHasUnsavedChanges(false);
      try {
        const [ttRes, asRes] = await Promise.all([
          fetch(`${API_BASE_URL}/timetable?class_id=${selectedClass}&section=${selectedSection}&academic_year=${DEFAULT_YEAR}`),
          fetch(`${API_BASE_URL}/timetable/teacher-assignments?class_id=${selectedClass}&section=${selectedSection}`),
        ]);
        const ttData = await ttRes.json();
        const asData = await asRes.json();
        setTimetable(ttData);
        setAssignments(Array.isArray(asData.assignments) ? asData.assignments : []);
      } catch (err) {
        console.error('Error loading timetable:', err);
        showAlert('Could not load the timetable.', 'error', 'Load Failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedClass, selectedSection]);

  const handleGridChange = (newTimetable) => {
    setTimetable(newTimetable);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!timetable) return;

    // Flatten grid → slots array
    const slots = [];
    for (const day of timetable.days) {
      for (const slot of day.slots) {
        if (slot.subject_name && slot.teacher_id) {
          slots.push({
            day_of_week: day.day_of_week,
            period_no: slot.period_no,
            subject_name: slot.subject_name,
            teacher_id: slot.teacher_id,
          });
        }
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/timetable`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_year: timetable.academic_year,
          class_id: timetable.class_id,
          section: timetable.section,
          slots,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasUnsavedChanges(false);
        showAlert(`Saved ${data.saved} slots successfully.`, 'success', 'Timetable Saved');
      } else if (response.status === 409) {
        // Teacher clash
        const clashDetails = data.clashes
          ? data.clashes.map((c) => {
              if (c.conflict_class_name) {
                return `${c.teacher_id} booked on day ${c.day_of_week} period ${c.period_no} in ${c.conflict_class_name} ${c.conflict_section}`;
              }
              return `${c.teacher_id} double-booked on day ${c.day_of_week} period ${c.period_no}`;
            }).join('\n')
          : data.error;
        showAlert(clashDetails, 'warning', 'Teacher Clash Detected');
      } else {
        showAlert(data.error || 'Failed to save timetable.', 'error', 'Save Failed');
      }
    } catch (err) {
      console.error('Save error:', err);
      showAlert('Network error. Please try again.', 'error', 'Network Error');
    } finally {
      setSaving(false);
    }
  };

  const availableSections = sectionsByClass[selectedClass] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Timetable</h1>
          <p className="text-white/60 text-sm sm:text-base">
            Pick a class and section to view or edit the timetable. Teaching periods are editable; breaks and assembly are shown for context.
          </p>
        </div>

        {/* Class / Section selectors */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-white/40"
          >
            <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Select Class</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                {formatClassName(c.class_name)}
              </option>
            ))}
          </select>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={!selectedClass || availableSections.length === 0}
            className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-white/40 disabled:opacity-40"
          >
            <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>
              {!selectedClass ? 'Select class first' : availableSections.length === 0 ? 'No sections' : 'Select Section'}
            </option>
            {availableSections.map((s) => (
              <option key={s} value={s} style={{ color: '#111827', backgroundColor: '#ffffff' }}>{s}</option>
            ))}
          </select>
          {selectedClass && selectedSection && (
            <div className="flex items-center gap-2 ml-auto">
              {hasUnsavedChanges && (
                <span className="text-xs text-yellow-400 flex items-center gap-1">
                  <AlertCircle size={14} /> Unsaved changes
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg transition disabled:opacity-50"
              >
                <Save size={16} /> {saving ? 'Saving…' : 'Save Timetable'}
              </button>
            </div>
          )}
        </div>

        {/* Grid */}
        {!selectedClass || !selectedSection ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-white/50">
            Select a class and section to begin.
          </div>
        ) : loading ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-white/50 flex items-center justify-center gap-3">
            <RefreshCw className="animate-spin" size={20} /> Loading timetable…
          </div>
        ) : timetable ? (
          <TimetableGrid
            timetable={timetable}
            assignments={assignments}
            onGridChange={handleGridChange}
          />
        ) : null}
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={closeAlert}
      />
    </div>
  );
}