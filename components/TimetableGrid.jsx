'use client';

import { useState } from 'react';
import { Clock, Coffee, Utensils, Droplet, Users, Plus, Minus } from 'lucide-react';
import TimetableCellPicker from './TimetableCellPicker';

const dayNames = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

const iconForBreak = (label) => {
  if (/lunch/i.test(label)) return Utensils;
  if (/water/i.test(label)) return Droplet;
  if (/break/i.test(label)) return Coffee;
  return Clock;
};

export default function TimetableGrid({ timetable, assignments, onGridChange, isReadOnly = false, onPeriodChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCell, setPickerCell] = useState(null);
  const [addingPeriod, setAddingPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ label: '', start_time: '', end_time: '' });

  const { periods, days } = timetable;

  const slotLookup = new Map();
  for (const day of days) {
    for (const slot of day.slots) {
      slotLookup.set(`${day.day_of_week}::${slot.period_no}`, slot);
    }
  }

  const openPicker = (dayOfWeek, periodNo) => {
    if (isReadOnly) return;
    const current = slotLookup.get(`${dayOfWeek}::${periodNo}`) || null;
    setPickerCell({ day_of_week: dayOfWeek, period_no: periodNo, current });
    setPickerOpen(true);
  };

  const handlePickerSave = (subjectName, teacherId, activityType) => {
    // ... same logic as before ...
    if (!pickerCell) return;
    const { day_of_week, period_no } = pickerCell;

    const newDays = days.map((day) => {
      if (day.day_of_week !== day_of_week) return day;
      const existing = slotLookup.get(`${day_of_week}::${period_no}`);
      let newSlots;
      if (!subjectName) {
        newSlots = day.slots.filter((s) => s.period_no !== period_no);
      } else if (existing) {
        newSlots = day.slots.map((s) =>
          s.period_no === period_no ? { ...s, subject_name: subjectName, teacher_id: teacherId, activity_type: activityType } : s
        );
      } else {
        newSlots = [...day.slots, { period_no, subject_name: subjectName, teacher_id: teacherId, activity_type: activityType }];
      }
      return { ...day, slots: newSlots };
    });

    onGridChange({ ...timetable, days: newDays });
    setPickerOpen(false);
    setPickerCell(null);
  };

  // ✅ NEW: Handle Add Period
  const handleAddPeriod = () => {
    if (!newPeriod.label || !newPeriod.start_time || !newPeriod.end_time) return;
    onPeriodChange('add', newPeriod);
    setAddingPeriod(false);
    setNewPeriod({ label: '', start_time: '', end_time: '' });
  };

  // ✅ NEW: Handle Delete Period
  const handleDeletePeriod = (periodId, periodNo) => {
    // Check if any cell in this period has data
    const hasData = timetable.days.some(day => day.slots.some(s => s.period_no === periodNo));
    if (hasData) {
      alert("You must clear all classes for this period before deleting it.");
      return;
    }
    onPeriodChange('delete', { periodId });
  };

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-white/10">
                <th className="px-3 py-3 text-left text-white text-xs font-medium w-40">Period</th>
                {[1, 2, 3, 4, 5, 6].map((dow) => (
                  <th key={dow} className="px-3 py-3 text-left text-white text-xs font-medium">
                    {dayNames[dow]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const BreakIcon = !p.is_teaching ? iconForBreak(p.label) : null;
                return (
                  <tr key={p.period_no} className={p.is_teaching ? 'border-t border-white/10' : 'border-t border-white/10 bg-white/5'}>
                    <td className="px-3 py-2 text-xs align-top relative group">
                      <div className="flex items-start gap-2">
                        {BreakIcon && <BreakIcon size={14} className="text-white/40 mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className={`font-medium ${p.is_teaching ? 'text-white' : 'text-white/60'}`}>{p.label}</p>
                          <p className="text-white/40 text-[10px]">{p.start_time}–{p.end_time}</p>
                        </div>
                      </div>
                      
                      {/* ✅ NEW: Delete Button (Only if not readonly) */}
                      {!isReadOnly && p.is_teaching && (
                        <button 
                          onClick={() => handleDeletePeriod(p.period_id, p.period_no)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition rounded hover:bg-red-500/20"
                          title="Remove this period"
                        >
                          <Minus size={12} />
                        </button>
                      )}
                    </td>
                    {!p.is_teaching ? (
                      <td colSpan={6} className="px-3 py-2 text-center text-xs text-white/40 italic">{p.label}</td>
                    ) : (
                      [1, 2, 3, 4, 5, 6].map((dow) => {
                        const slot = slotLookup.get(`${dow}::${p.period_no}`);
                        const subtext = slot?.teacher_name ? `${slot.teacher_name}` : slot?.class_name ? `${slot.class_name} ${slot.section}` : slot?.teacher_id;
                        return (
                          <td key={dow} className="px-2 py-2 align-top">
                            <button onClick={() => openPicker(dow, p.period_no)} disabled={isReadOnly && !slot} className={`w-full text-left px-2 py-1.5 rounded text-xs transition min-h-[48px] ${slot ? slot.activity_type ? 'bg-purple-500/20 border border-purple-500/40 text-white' : 'bg-blue-500/20 border border-blue-500/40 text-white' : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'} ${isReadOnly ? 'cursor-default' : 'hover:opacity-80'}`}>
                              {slot ? (<div><div className="font-medium truncate">{slot.subject_name}</div>{subtext && (<div className="text-[10px] text-white/60 truncate flex items-center gap-1"><Users size={9} /> {subtext}</div>)}</div>) : (!isReadOnly && '+ add')}
                            </button>
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ NEW: Add Period Button */}
      {!isReadOnly && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-white/50 flex flex-wrap items-center gap-4">
            <span>● Click any teaching cell to assign a subject or activity.</span>
          </div>
          <button 
            onClick={() => setAddingPeriod(true)} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-blue-700 transition"
          >
            <Plus size={16} /> Add Period
          </button>
        </div>
      )}

      {/* ✅ NEW: Add Period Modal */}
      {addingPeriod && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Add New Period</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Label (e.g., "9th Period")</label>
                <input type="text" value={newPeriod.label} onChange={(e) => setNewPeriod({...newPeriod, label: e.target.value})} className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-white/70 mb-1">Start Time</label>
                  <input type="time" value={newPeriod.start_time} onChange={(e) => setNewPeriod({...newPeriod, start_time: e.target.value})} className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">End Time</label>
                  <input type="time" value={newPeriod.end_time} onChange={(e) => setNewPeriod({...newPeriod, end_time: e.target.value})} className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setAddingPeriod(false)} className="flex-1 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20">Cancel</button>
              <button onClick={handleAddPeriod} className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add</button>
            </div>
          </div>
        </div>
      )}

      {pickerOpen && pickerCell && (
        <TimetableCellPicker isOpen={pickerOpen} cell={pickerCell} assignments={assignments} onSave={handlePickerSave} onCancel={() => { setPickerOpen(false); setPickerCell(null); }} />
      )}
    </>
  );
}s