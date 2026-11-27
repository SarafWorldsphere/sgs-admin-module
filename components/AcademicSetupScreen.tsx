'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, GraduationCap, Plus, Trash2, Save, RefreshCw, ArrowRight } from 'lucide-react';
import { emptyYear, sameYear, positiveId, yearPayload, apiError, academicSetupApiUrl } from '../lib/academic-setup.mjs';
type Year = { board_id: string | number; calendar_id: string | number; academic_year: string; start_date: string; end_date: string; school_year_id?: number };
type Board = { board_id: number; board_name: string; description?: string };
type Calendar = { calendar_id: number; calendar_name: string; description?: string; academic_year: string };
type Holiday = { holiday_id: number; holiday_date: string; reason: string };
const input = 'w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/40 disabled:opacity-50 [color-scheme:dark] [&>option]:bg-slate-900 [&>option]:text-white';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40';
const panel = 'rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7';
async function api(path: string, method = 'GET', body?: object) {
  const response = await fetch(academicSetupApiUrl(path, process.env.NEXT_PUBLIC_APP_BASE_PATH || ''), { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(Error(apiError(data, response.status)), { status: response.status });
  if (!data) throw Error('The planner service returned an unexpected response.');
  return data;
}
async function readSetup() {
  const [boards, calendars, active] = await Promise.all([api('boards'), api('calendars'), api('academic-year').catch(err => { if (err.status === 404) return null; throw err; })]);
  const holidays = active ? await api('holidays') : { items: [] };
  return { boards: boards.items, calendars: calendars.items, active, holidays: holidays.items };
}
export default function AcademicSetupScreen() {
  const [year, setYear] = useState<Year>(emptyYear);
  const [saved, setSaved] = useState<Year | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayDate, setHolidayDate] = useState('');
  const [reason, setReason] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const clean = sameYear(saved, year);
  const selectedBoard = boards.find(item => String(item.board_id) === String(year.board_id));
  const selectedCalendar = calendars.find(item => String(item.calendar_id) === String(year.calendar_id));
  function applySetup(data: Awaited<ReturnType<typeof readSetup>>) {
    setBoards(data.boards); setCalendars(data.calendars); setSaved(data.active); setHolidays(data.holidays);
    setYear(data.active || { ...emptyYear(), board_id: data.boards[0]?.board_id || '', calendar_id: data.calendars[0]?.calendar_id || '' });
    setReady(true);
  }
  async function load() {
    try {
      applySetup(await readSetup());
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load academic setup.'); }
    finally { setLoading(false); }
  }
  function reload() {
    if (!(clean || !ready || !saved || window.confirm('Discard unsaved year changes and reload?'))) return;
    setLoading(true); setReady(false); setError(''); setResult(null); setMessage('');
    void load();
  }
  useEffect(() => {
    let cancelled = false;
    void readSetup().then(data => { if (!cancelled) applySetup(data); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load academic setup.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  async function mutate(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage(''); setResult(null);
    try { await work(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Request failed.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function update(key: keyof Year, value: string) { setYear(current => ({ ...current, [key]: value })); setMessage(''); setResult(null); }
  function save(event: React.FormEvent) {
    event.preventDefault(); void mutate(async () => {
      const body = yearPayload(year);
      if (!selectedBoard || !selectedCalendar) throw Error('Choose a configured board and calendar.');
      if (selectedCalendar.academic_year !== year.academic_year) throw Error('Choose a calendar for the entered academic year.');
      if (saved && !window.confirm('Saving opens a new active school year and closes the current one. Its holidays and plan remain with the previous year. Continue?')) return;
      const active = await api('academic-year', 'POST', body);
      setSaved(active); setYear(active); setHolidays([]);
      setMessage('Academic year saved. You can now add holidays and generate the plan.');
    });
  }
  function addHoliday(event: React.FormEvent) {
    event.preventDefault(); void mutate(async () => {
      if (!clean) throw Error('Save the academic year before adding holidays.');
      if (!holidayDate || holidayDate < year.start_date || holidayDate > year.end_date || !reason.trim()) throw Error('Enter a holiday within the school year and a reason.');
      if (holidays.some(item => item.holiday_date === holidayDate)) throw Error('A holiday is already saved for this date.');
      const item = await api('holidays', 'POST', { holiday_date: holidayDate, reason: reason.trim() });
      setHolidays(current => [...current, item].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)));
      setHolidayDate(''); setReason(''); setMessage('Holiday added.');
    });
  }
  return <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8 text-white sm:px-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-300">School administration</p><h1 className="text-3xl font-bold">Academic setup</h1><p className="mt-2 text-sm text-slate-300">Set the school year, local holidays and syllabus plan.</p></div><button className={button} disabled={busy || loading} onClick={reload}><RefreshCw size={16} />Reload</button></header>
    {error && <div role="alert" className="rounded-xl border border-red-400/40 bg-red-950/60 p-4 text-red-100">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-950/50 p-4 text-emerald-100">{message}</div>}
    {loading && <p role="status">Loading academic setup...</p>}
    <form className={panel} onSubmit={save}><h2 className="mb-5 flex items-center gap-3 text-xl font-semibold"><GraduationCap className="text-indigo-300" />Academic year</h2>
      <fieldset disabled={!ready || busy || loading} className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm">Board<select id="board" className={input} required value={year.board_id} onChange={e => update('board_id', e.target.value)}><option value="">Choose board</option>{boards.map(item => <option key={item.board_id} value={item.board_id}>{item.board_name}</option>)}</select><span className="block text-xs text-slate-400">{selectedBoard?.description || 'Select a configured board.'}</span></label>
        <label className="space-y-2 text-sm">Calendar<select id="calendar" className={input} required value={year.calendar_id} onChange={e => update('calendar_id', e.target.value)}><option value="">Choose calendar</option>{calendars.map(item => <option key={item.calendar_id} value={item.calendar_id}>{item.calendar_name}</option>)}</select><span className="block text-xs text-slate-400">{selectedCalendar?.description || 'Calendars are independent of boards.'}</span></label>
        <label className="space-y-2 text-sm">Academic year<input className={input} required placeholder="2026-27" maxLength={9} value={year.academic_year} onChange={e => update('academic_year', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-sm">Start date<input id="start-date" type="date" className={input} required value={year.start_date} onChange={e => update('start_date', e.target.value)} /></label><label className="space-y-2 text-sm">End date<input id="end-date" type="date" className={input} required min={year.start_date} value={year.end_date} onChange={e => update('end_date', e.target.value)} /></label></div>
      </fieldset><div className="mt-5 flex flex-wrap items-center gap-4"><button className={button} disabled={!ready || busy || loading || clean}><Save size={16} />Save year</button><p className="text-xs text-slate-400">{saved ? clean ? 'Current year is saved.' : 'Unsaved changes. Saving opens a new active year.' : 'Save the year before adding holidays or generating a plan.'}</p></div>
    </form>
    <section className={panel}><h2 className="mb-5 flex items-center gap-3 text-xl font-semibold"><CalendarDays className="text-indigo-300" />Local holidays</h2>
      <form onSubmit={addHoliday}><fieldset disabled={!ready || !clean || busy || loading} className="grid items-end gap-4 sm:grid-cols-[1fr_2fr_auto]"><label className="space-y-2 text-sm">Holiday date<input id="holiday-date" type="date" className={input} required min={year.start_date} max={year.end_date} value={holidayDate} onChange={e => setHolidayDate(e.target.value)} /></label><label className="space-y-2 text-sm">Reason<input id="holiday-name" className={input} required maxLength={150} value={reason} onChange={e => setReason(e.target.value)} placeholder="Local festival or school closure" /></label><button className={button}><Plus size={16} />Add holiday</button></fieldset></form>
      <ul className="mt-5 divide-y divide-white/10">{holidays.map(item => <li key={item.holiday_id} className="flex items-center justify-between gap-3 py-3"><div><span className="mr-4 text-sm text-indigo-200">{item.holiday_date}</span><span className="break-words text-sm">{item.reason}</span></div><button aria-label={`Remove ${item.reason}`} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-40" disabled={!clean || busy || loading || !ready} onClick={() => void mutate(async () => { await api(`holidays/${item.holiday_id}`, 'DELETE'); setHolidays(current => current.filter(h => h.holiday_id !== item.holiday_id)); setMessage('Holiday removed.'); })}><Trash2 size={17} /></button></li>)}</ul>{!holidays.length && <p className="mt-4 text-sm text-slate-400">No local holidays saved for this year.</p>}
    </section>
    <section className={panel}><h2 className="text-xl font-semibold">Generate syllabus plan</h2><p className="mt-2 text-sm text-slate-300">Use the class and subject IDs from your school records. Existing plan rows are kept.</p>
      <form onSubmit={e => { e.preventDefault(); void mutate(async () => { if (!clean) throw Error('Save your year changes first.'); if (!positiveId(classId) || !positiveId(subjectId)) throw Error('Enter valid positive class and subject IDs.'); const generated = await api('syllabus-plan/generate', 'POST', { class_id: Number(classId), subject_id: Number(subjectId) }); setResult(generated); }); }}><fieldset disabled={!ready || !clean || busy || loading} className="mt-5 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"><label className="space-y-2 text-sm">Class ID<input className={input} type="number" required min="1" step="1" value={classId} onChange={e => { setClassId(e.target.value); setResult(null); }} /></label><label className="space-y-2 text-sm">Subject ID<input className={input} type="number" required min="1" step="1" value={subjectId} onChange={e => { setSubjectId(e.target.value); setResult(null); }} /></label><button className={button}><ArrowRight size={16} />Generate Plan</button></fieldset></form>
      {busy && <p role="status" className="mt-4 text-sm">Saving your request...</p>}
      {result && <div role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-950/40 p-4">Plan generation complete: <strong>{result.created}</strong> rows created, <strong>{result.skipped}</strong> existing rows skipped.{result.created === 0 && result.skipped === 0 && <p className="mt-2 text-sm">No matching syllabus rows were available for these selections.</p>}</div>}
    </section>
  </div></main>;
}
