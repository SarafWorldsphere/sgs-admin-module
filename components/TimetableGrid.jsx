'use client';

import { useState } from 'react';
import { Clock, Coffee, Utensils, Droplet, Users } from 'lucide-react';
import TimetableCellPicker from './TimetableCellPicker';

const dayNames = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

const iconForBreak = (label) => {
  if (/lunch/i.test(label)) return Utensils;
  if (/water/i.test(label)) return Droplet;
  if (/break/i.test(label)) return Coffee;
  return Clock;
};

export default function TimetableGrid({ timetable, assignments, onGridChange, isReadOnly = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCell, setPickerCell] = useState(null);

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
        newSlots = [
          ...day.slots,
          { period_no, subject_name: subjectName, teacher_id: teacherId, activity_type: activityType },
        ];
      }
      return { ...day, slots: newSlots };
    });

    onGridChange({ ...timetable, days: newDays });
    setPickerOpen(false);
    setPickerCell(null);
  };

  return (
    <>
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-white/10">
                <th className="px-3 py-3 text-left text-white text-xs font-medium w-32">Period</th>
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
                    <td className="px-3 py-2 text-xs align-top">
                      <div className="flex items-start gap-2">
                        {BreakIcon && <BreakIcon size={14} className="text-white/40 mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className={`font-medium ${p.is_teaching ? 'text-white' : 'text-white/60'}`}>
                            {p.label}
                          </p>
                          <p className="text-white/40 text-[10px]">
                            {p.start_time}–{p.end_time}
                          </p>
                        </div>
                      </div>
                    </td>
                    {!p.is_teaching ? (
                      <td colSpan={6} className="px-3 py-2 text-center text-xs text-white/40 italic">
                        {p.label}
                      </td>
                    ) : (
                      [1, 2, 3, 4, 5, 6].map((dow) => {
                        const slot = slotLookup.get(`${dow}::${p.period_no}`);
                        
                        // For teacher view, we show class name. For class view, we show teacher name.
                        const subtext = slot?.teacher_name 
                          ? `${slot.teacher_name}`
                          : slot?.class_name ? `${slot.class_name} ${slot.section}` : slot?.teacher_id;

                        return (
                          <td key={dow} className="px-2 py-2 align-top">
                            <button
                              onClick={() => openPicker(dow, p.period_no)}
                              disabled={isReadOnly && !slot}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition min-h-[48px] ${
                                slot
                                  ? slot.activity_type 
                                    ? 'bg-purple-500/20 border border-purple-500/40 text-white'
                                    : 'bg-blue-500/20 border border-blue-500/40 text-white'
                                  : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'
                              } ${isReadOnly ? 'cursor-default' : 'hover:opacity-80'}`}
                            >
                              {slot ? (
                                <div>
                                  <div className="font-medium truncate">{slot.subject_name}</div>
                                  {subtext && (
                                    <div className="text-[10px] text-white/60 truncate flex items-center gap-1">
                                      <Users size={9} /> {subtext}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                !isReadOnly && '+ add'
                              )}
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

      {!isReadOnly && (
        <div className="mt-4 text-xs text-white/50 flex flex-wrap items-center gap-4">
          <span>● Click any teaching cell to assign a subject or activity.</span>
          <span>● Breaks and assembly are shown for reference.</span>
        </div>
      )}

      {pickerOpen && pickerCell && (
        <TimetableCellPicker
          isOpen={pickerOpen}
          cell={pickerCell}
          assignments={assignments}
          onSave={handlePickerSave}
          onCancel={() => { setPickerOpen(false); setPickerCell(null); }}
        />
      )}
    </>
  );
}