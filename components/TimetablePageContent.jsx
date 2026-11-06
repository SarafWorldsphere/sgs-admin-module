'use client';

import { useState, useEffect } from 'react';
import { Save, AlertCircle, RefreshCw, BookOpen, User, Download, Upload } from 'lucide-react';
import TimetableGrid from './TimetableGrid';
import AlertModal from './AlertModal';
import { formatClassName } from '../lib/format-class-name';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';
const DEFAULT_YEAR = '2026-27';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimetablePageContent() {
  const [viewMode, setViewMode] = useState('class');
  
  const [classes, setClasses] = useState([]);
  const [sectionsByClass, setSectionsByClass] = useState({});
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const [timetable, setTimetable] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'info' });
  const showAlert = (message, variant = 'error', title = 'Error') => setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () => setAlertState({ isOpen: false, title: '', message: '', variant: 'info' });

  useEffect(() => {
    (async () => {
      try {
        const [cRes, tRes] = await Promise.all([
          fetch(`${API_BASE_URL}/classes`),
          fetch(`${API_BASE_URL}/teachers`)
        ]);
        const cData = await cRes.json();
        const tData = await tRes.json();
        setClasses(Array.isArray(cData) ? cData : []);
        setTeachers(Array.isArray(tData) ? tData : []);
      } catch (err) { console.error(err); }
    })();
  }, []);

  useEffect(() => {
    if (!selectedClass || viewMode !== 'class') return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sections?class_id=${selectedClass}`);
        const data = await res.json();
        setSectionsByClass((prev) => ({ ...prev, [selectedClass]: data.sections || [] }));
        setSelectedSection('');
        setTimetable(null);
      } catch (err) {}
    })();
  }, [selectedClass, viewMode]);

  useEffect(() => {
    if (viewMode === 'class') {
      if (!selectedClass || !selectedSection) { setTimetable(null); setAssignments([]); return; }
      (async () => {
        setLoading(true); setHasUnsavedChanges(false);
        try {
          const [ttRes, asRes] = await Promise.all([
            fetch(`${API_BASE_URL}/timetable?class_id=${selectedClass}&section=${selectedSection}&academic_year=${DEFAULT_YEAR}`),
            fetch(`${API_BASE_URL}/timetable/teacher-assignments?class_id=${selectedClass}&section=${selectedSection}`),
          ]);
          const ttData = await ttRes.json();
          const asData = await asRes.json();
          if (!ttData || ttData.error) throw new Error(ttData?.error || 'Failed to load timetable');
          setTimetable(ttData);
          setAssignments(Array.isArray(asData.assignments) ? asData.assignments : []);
        } catch (err) { showAlert(err.message, 'error', 'Load Failed'); } finally { setLoading(false); }
      })();
    } else {
      if (!selectedTeacher) { setTimetable(null); return; }
      (async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/timetable/teacher?teacher_id=${selectedTeacher}&academic_year=${DEFAULT_YEAR}`);
          const data = await res.json();
          if (!data || data.error) throw new Error(data?.error || 'Failed to load teacher');
          const days = [1,2,3,4,5,6].map(dow => ({
            day_of_week: dow,
            day_name: DAYS[dow-1],
            slots: (data.slots || []).filter(s => s.day_of_week === dow).map(s => ({
              period_no: s.period_no, subject_name: s.subject_name, activity_type: s.activity_type,
              teacher_id: selectedTeacher, teacher_name: null, class_name: s.class_name, section: s.section
            }))
          }));
          setTimetable({ periods: data.periods, days });
        } catch (err) { showAlert(err.message, 'error', 'Load Failed'); } finally { setLoading(false); }
      })();
    }
  }, [viewMode, selectedClass, selectedSection, selectedTeacher]);

  const handleGridChange = (newTimetable) => { setTimetable(newTimetable); setHasUnsavedChanges(true); };

  const handleSave = async () => {
    if (!timetable || viewMode !== 'class') return;
    const slots = [];
    for (const day of timetable.days) {
      for (const slot of day.slots) {
        if (slot.subject_name && slot.teacher_id) {
          slots.push({
            day_of_week: day.day_of_week, period_no: slot.period_no,
            subject_name: slot.subject_name, teacher_id: slot.teacher_id, activity_type: slot.activity_type || null,
          });
        }
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/timetable`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: timetable.academic_year, class_id: timetable.class_id, section: timetable.section, slots }),
      });
      const data = await response.json();
      if (response.ok) {
        setHasUnsavedChanges(false);
        showAlert(`Saved ${data.saved} slots successfully.`, 'success', 'Timetable Saved');
      } else if (response.status === 409) {
        showAlert('Teacher clash detected. Please check overlapping slots.', 'warning', 'Clash Detected');
      } else {
        showAlert(data.error || 'Failed to save.', 'error', 'Save Failed');
      }
    } catch (err) { showAlert('Network error.', 'error'); } finally { setSaving(false); }
  };

  const handleExport = async () => {
    if (!timetable) return; 
    try {
      const XLSX = await import('xlsx');
      const rows = [['Period', ...DAYS]];
      for (const p of timetable.periods) {
        if (!p.is_teaching) continue; 
        const row = [`${p.label} (${p.start_time})`];
        for (let i = 1; i <= 6; i++) {
          const day = timetable.days.find(d => d.day_of_week === i);
          const slot = day?.slots.find(s => s.period_no === p.period_no);
          if (slot) {
            const teacher = assignments.find(a => a.teacher_id === slot.teacher_id)?.teacher_name || slot.teacher_id;
            row.push(`${slot.subject_name} (${teacher})`);
          } else { row.push(''); }
        }
        rows.push(row);
      }
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Timetable');
      const className = classes.find(c => String(c.class_id) === String(selectedClass))?.class_name || selectedClass;
      XLSX.writeFile(workbook, `Timetable_${className}_${selectedSection}.xlsx`);
    } catch (err) { showAlert('Export failed.', 'error'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !timetable) return;
    e.target.value = '';

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length < 2) return showAlert('Excel file is empty.', 'error');

      const newTimetable = { ...timetable };
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const periodLabel = row[0];
        const period = timetable.periods.find(p => periodLabel && periodLabel.includes(p.label));
        if (!period) continue;

        for (let c = 1; c <= 6; c++) {
          const cellValue = row[c];
          if (!cellValue) continue;
          let subject = cellValue;
          let teacherId = 'ACTIVITY';
          let activityType = null;
          if (cellValue.includes('(')) {
            const match = cellValue.match(/(.+)\((.+)\)/);
            if (match) {
              subject = match[1].trim();
              const teacherName = match[2].trim();
              const assign = assignments.find(a => a.teacher_name === teacherName || a.teacher_id === teacherName);
              teacherId = assign ? assign.teacher_id : 'UNKNOWN';
            }
          } else {
            const act = ['GAMES', 'LIBRARY', 'LAB'].find(a => subject.toUpperCase().includes(a));
            if (act) activityType = act.toLowerCase();
          }
          const dayIndex = newTimetable.days.findIndex(d => d.day_of_week === c);
          if (dayIndex !== -1) {
            const existingSlotIndex = newTimetable.days[dayIndex].slots.findIndex(s => s.period_no === period.period_no);
            const newSlot = { period_no: period.period_no, subject_name: subject, teacher_id: teacherId, activity_type: activityType };
            if (existingSlotIndex !== -1) newTimetable.days[dayIndex].slots[existingSlotIndex] = newSlot;
            else newTimetable.days[dayIndex].slots.push(newSlot);
          }
        }
      }
      setTimetable(newTimetable);
      setHasUnsavedChanges(true);
      showAlert('Imported! Review the grid and click Save.', 'success', 'Import Successful');
    } catch (err) { showAlert('Import failed.', 'error'); }
  };

  const handlePeriodChange = async (action, data) => {
    try {
      if (action === 'add') {
        const res = await fetch(`${API_BASE_URL}/timetable/periods`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ academic_year: DEFAULT_YEAR, label: data.label, start_time: data.start_time, end_time: data.end_time }),
        });
        const resData = await res.json();
        if (!res.ok) return showAlert(resData.error, 'error');
      } else if (action === 'delete') {
        const res = await fetch(`${API_BASE_URL}/timetable/periods?id=${data.periodId}`, { method: 'DELETE' });
        const resData = await res.json();
        if (!res.ok) return showAlert(resData.error, 'error');
      }
      
      if (selectedClass && selectedSection) {
        const refreshRes = await fetch(`${API_BASE_URL}/timetable?class_id=${selectedClass}&section=${selectedSection}&academic_year=${DEFAULT_YEAR}`);
        setTimetable(await refreshRes.json());
        setHasUnsavedChanges(true); 
      }
      // ✅ FIX 1: Proper Title for Success
      showAlert(`Period ${action === 'add' ? 'added' : 'deleted'} successfully.`, 'success', 'Success');
    } catch (err) { showAlert('Network error.', 'error'); }
  };

  const availableSections = sectionsByClass[selectedClass] || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Timetable</h1>
          <p className="text-white/60 text-sm sm:text-base">Manage class schedules and view individual teacher assignments.</p>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-xl w-full sm:w-64 border border-white/10">
          <button onClick={() => { setViewMode('class'); setSelectedTeacher(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'class' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}><BookOpen size={16} /> By Class</button>
          <button onClick={() => { setViewMode('teacher'); setSelectedClass(''); setSelectedSection(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition ${viewMode === 'teacher' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}><User size={16} /> By Teacher</button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {viewMode === 'class' ? (
            <>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-white/40">
                <option value="" style={{ color: '#111827' }}>Select Class</option>
                {classes.map((c) => <option key={c.class_id} value={c.class_id} style={{ color: '#111827' }}>{formatClassName(c.class_name)}</option>)}
              </select>
              <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass || availableSections.length === 0} className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-white/40 disabled:opacity-40">
                <option value="" style={{ color: '#111827' }}>{!selectedClass ? 'Select class first' : availableSections.length === 0 ? 'No sections' : 'Select Section'}</option>
                {availableSections.map((s) => <option key={s} value={s} style={{ color: '#111827' }}>{s}</option>)}
              </select>
              
              {selectedClass && selectedSection && (
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  {hasUnsavedChanges && <span className="text-xs text-yellow-400 flex items-center gap-1"><AlertCircle size={14} /> Unsaved</span>}
                  <button onClick={handleExport} className="px-4 py-2.5 bg-white/10 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-white/20 transition"><Download size={16} /> Export</button>
                  <label className="px-4 py-2.5 bg-white/10 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-white/20 transition cursor-pointer"><Upload size={16} /> Import<input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} /></label>
                  <button onClick={handleSave} disabled={saving || !hasUnsavedChanges} className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg transition disabled:opacity-50"><Save size={16} /> {saving ? 'Saving…' : 'Save Timetable'}</button>
                </div>
              )}
            </>
          ) : (
            <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-white/40 w-full sm:w-96">
              <option value="" style={{ color: '#111827' }}>Select Teacher to view their timetable</option>
              {teachers.map((t) => <option key={t.id} value={t.id} style={{ color: '#111827' }}>{t.name} ({t.id})</option>)}
            </select>
          )}
        </div>

        {((viewMode === 'class' && (!selectedClass || !selectedSection)) || (viewMode === 'teacher' && !selectedTeacher)) ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-white/50">{viewMode === 'class' ? 'Select a class and section to begin.' : 'Select a teacher to view their schedule.'}</div>
        ) : loading ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-white/50 flex items-center justify-center gap-3"><RefreshCw className="animate-spin" size={20} /> Loading timetable…</div>
        ) : timetable ? (
          <TimetableGrid timetable={timetable} assignments={assignments} onGridChange={handleGridChange} isReadOnly={viewMode === 'teacher'} onPeriodChange={handlePeriodChange} />
        ) : null}
      </div>

      <AlertModal isOpen={alertState.isOpen} title={alertState.title} message={alertState.message} variant={alertState.variant} onClose={closeAlert} />
    </div>
  );
}