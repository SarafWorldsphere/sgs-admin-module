'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, X, Check } from 'lucide-react';
import AlertModal from './AlertModal';
import { isValidName, isValidEmail, isGmailEmail, isValidPhone, normalizePhone } from '../lib/validators';
import { formatClassName } from '../lib/format-class-name';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';

const TeacherFormPage = ({ mode = 'add', teacherId = '', onCancel, onSuccess }) => {
  const [availableClasses, setAvailableClasses] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    teacher_id: '',
    full_name: '',
    email_id: '',
    phone: '',
    qualification: '',
    role: 'Teacher',
    is_active: true,
  });

  const [assignments, setAssignments] = useState([]);
  const [primaryIndex, setPrimaryIndex] = useState(-1);
  const [sectionsByClass, setSectionsByClass] = useState({});

  const [errors, setErrors] = useState({});
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'error' });

  const showAlert = (message, variant = 'error', title = 'Error') =>
    setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () =>
    setAlertState({ isOpen: false, title: '', message: '', variant: 'error' });

  // ---- fetch sections per class (cached) ----
  const fetchSections = useCallback(async (classId) => {
    if (!classId) return;
    const cid = String(classId);
    if (sectionsByClass[cid]) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sections?class_id=${cid}`);
      const data = await res.json();
      const sections = Array.isArray(data?.sections) ? data.sections : [];
      setSectionsByClass((prev) => ({ ...prev, [cid]: sections }));
    } catch (err) {
      console.error('Error loading sections:', err);
      setSectionsByClass((prev) => ({ ...prev, [cid]: [] }));
    }
  }, [sectionsByClass]);

  // ---- initial load (classes + subjects) ----
  useEffect(() => {
    (async () => {
      try {
        const [clsRes, subjRes] = await Promise.all([
          fetch(`${API_BASE_URL}/classes`),
          fetch(`${API_BASE_URL}/subjects`),
        ]);
        const clsData = await clsRes.json();
        const subjData = await subjRes.json();
        setAvailableClasses(Array.isArray(clsData) ? clsData : []);
        setAllSubjects(Array.isArray(subjData) ? subjData : []);
      } catch (err) {
        console.error('Error loading form data:', err);
      }
    })();
  }, []);

  // ---- auto-generate teacher ID in add mode ----
  useEffect(() => {
    if (mode !== 'add') return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/generate-id?type=teacher`);
        const data = await res.json();
        if (data.id) setFormData((prev) => ({ ...prev, teacher_id: data.id }));
      } catch (err) {
        console.error('Error generating teacher ID:', err);
      }
    })();
  }, [mode]);

  // ---- edit mode: load teacher + map rows ----
  useEffect(() => {
    if (mode !== 'edit' || !teacherId) return;
    (async () => {
      try {
        setLoading(true);

        const [tRes, mRes] = await Promise.all([
          fetch(`${API_BASE_URL}/teachers`),
          fetch(`${API_BASE_URL}/teacher-class-map?teacher_id=${encodeURIComponent(teacherId)}`),
        ]);
        const teachers = await tRes.json();
        const mapRows = await mRes.json();

        const teacher = Array.isArray(teachers)
          ? teachers.find((t) => String(t.teacher_id || t.id) === String(teacherId))
          : null;

        if (!teacher) {
          showAlert(`Teacher ${teacherId} not found.`, 'error', 'Not Found');
          setLoading(false);
          return;
        }

        setFormData({
          teacher_id: teacher.teacher_id || teacher.id || '',
          full_name: teacher.name || teacher.full_name || '',
          email_id: teacher.email || teacher.email_id || '',
          phone: teacher.contact || teacher.phone || '',
          qualification: teacher.qualification || '',
          role: teacher.role || 'Teacher',
          is_active: teacher.status === 'Active' || teacher.is_active === true,
        });

        // Group map rows by (class_id, section)
        const grouped = new Map(); // use Map with string keys to preserve order
        if (Array.isArray(mapRows)) {
          for (const r of mapRows) {
            const cid = String(r.class_id ?? '').trim();
            const sec = String(r.section ?? '').trim();
            if (!cid || !sec) continue; // skip malformed
            const key = `${cid}::${sec}`;
            if (!grouped.has(key)) {
              grouped.set(key, {
                class_id: cid,               // keep as string — matches <option value>
                section: sec,
                subjects: [],
                is_class_teacher: false,
              });
            }
            const entry = grouped.get(key);
            if (r.subject_name) entry.subjects.push(r.subject_name);
            if (r.is_class_teacher) entry.is_class_teacher = true;
          }
        }

        let assignmentList = Array.from(grouped.values());

        // No map rows yet — seed from teacher_master.class_id + section_1
        if (assignmentList.length === 0 && teacher.class_id) {
          const cid = String(teacher.class_id);
          const sec = String(teacher.section_1 || '').trim();
          if (cid && sec) {
            assignmentList = [{
              class_id: cid,
              section: sec,
              subjects: Array.isArray(teacher.subjects)
                ? teacher.subjects
                : (typeof teacher.subjects === 'string' && teacher.subjects
                    ? teacher.subjects.split(',').map((s) => s.trim()).filter(Boolean)
                    : []),
              is_class_teacher: teacher.is_class_teacher === true,
            }];
          }
        }

        setAssignments(assignmentList);

        // Determine primary
        let pIdx = -1;
        if (teacher.class_id && teacher.section_1) {
          pIdx = assignmentList.findIndex(
            (a) =>
              String(a.class_id) === String(teacher.class_id) &&
              String(a.section) === String(teacher.section_1)
          );
        }
        if (pIdx < 0 && assignmentList.length > 0) pIdx = 0;
        setPrimaryIndex(pIdx);

        // Pre-fetch sections for all loaded classes
        const classIdsToFetch = new Set(assignmentList.map((a) => String(a.class_id)));
        for (const cid of classIdsToFetch) {
          fetchSections(cid);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading teacher:', err);
        showAlert('Could not load the teacher. Please try again.', 'error', 'Load Failed');
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, teacherId]);

  // ---- assignment mutations ----
  const addAssignment = () => {
    setAssignments((prev) => [
      ...prev,
      { class_id: '', section: '', subjects: [], is_class_teacher: false },
    ]);
  };

  const removeAssignment = (idx) => {
    setAssignments((prev) => prev.filter((_, i) => i !== idx));
    setPrimaryIndex((prev) => {
      if (prev === idx) return -1;
      if (prev > idx) return prev - 1;
      return prev;
    });
  };

  const updateAssignment = (idx, patch) => {
    setAssignments((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    );
    if (patch.class_id !== undefined) {
      fetchSections(patch.class_id);
    }
  };

  const toggleSubject = (idx, subjectName) => {
    setAssignments((prev) =>
      prev.map((a, i) => {
        if (i !== idx) return a;
        const has = a.subjects.includes(subjectName);
        return {
          ...a,
          subjects: has
            ? a.subjects.filter((s) => s !== subjectName)
            : [...a.subjects, subjectName],
        };
      })
    );
  };

  const markAsPrimary = (idx) => setPrimaryIndex(idx);

  // ---- validation ----
  const validate = () => {
    const e = {};

    if (!formData.teacher_id.trim()) e.teacher_id = 'Teacher ID is required';
    if (!formData.full_name.trim()) e.full_name = 'Teacher Name is required';
    else if (!isValidName(formData.full_name)) e.full_name = 'Only letters, spaces, dots, hyphens and apostrophes';

    if (!formData.email_id.trim()) e.email_id = 'Email is required';
    else if (!isValidEmail(formData.email_id)) e.email_id = 'Please enter a valid email address';
    else if (!isGmailEmail(formData.email_id)) e.email_id = 'Teacher email must be a @gmail.com address';

    if (formData.phone && formData.phone.trim() !== '' && !isValidPhone(formData.phone))
      e.phone = 'Enter a valid 10-digit mobile number';

    if (formData.qualification && !isValidName(formData.qualification))
      e.qualification = 'Only letters, spaces, dots, hyphens and apostrophes';

    const invalidAssignments = assignments.filter((a) => !a.class_id || !a.section);
    if (assignments.length > 0 && invalidAssignments.length > 0) {
      e.assignments = 'Every class assignment needs a class and a section.';
    }

    if (assignments.length > 0 && primaryIndex < 0) {
      e.primary = 'Please mark one class as the primary class.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ---- submit (Step 3b) ----
  const handleSubmit = async () => {
    if (!validate()) {
      // scroll to top so the errors are visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      // Primary class → goes into teacher_master.class_id + section_1
      const primary = primaryIndex >= 0 ? assignments[primaryIndex] : null;
      const classIdValue = primary?.class_id ? parseInt(primary.class_id, 10) : null;
      const section1Value = primary?.section || '';
      // Section 2 = the second section of the primary class, if any
      const otherSectionsOfPrimary = assignments
        .filter((a, i) => i !== primaryIndex && String(a.class_id) === String(primary?.class_id))
        .map((a) => a.section);
      const section2Value = otherSectionsOfPrimary[0] || '';

      // All subjects across all assignments → subjects array on teacher_master
      const allSelectedSubjects = Array.from(
        new Set(assignments.flatMap((a) => a.subjects))
      );

      // class_map → array for the API
      const classMapPayload = assignments.map((a) => ({
        class_id: parseInt(a.class_id, 10),
        section: a.section,
        subjects: a.subjects,
        is_class_teacher: a.is_class_teacher,
      }));

      const payload = {
        teacher_id: formData.teacher_id,
        name: formData.full_name.trim(),
        subject: allSelectedSubjects[0] || null,
        qualification: formData.qualification?.trim() || null,
        class_id: classIdValue,
        section_1: section1Value,
        section_2: section2Value,
        role: formData.role,
        is_class_teacher: primary?.is_class_teacher || false,
        subjects: allSelectedSubjects.join(', '),
        contact: formData.phone ? normalizePhone(formData.phone) : null,
        email: formData.email_id.trim(),
        status: formData.is_active ? 'Active' : 'Inactive',
        class_map: classMapPayload,
      };

      const url = `${API_BASE_URL}/teachers`;
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // success → go back to list
        if (typeof onSuccess === 'function') onSuccess();
      } else {
        showAlert(data.error || 'Failed to save teacher', 'error', 'Could Not Save');
      }
    } catch (err) {
      console.error('Error saving teacher:', err);
      showAlert('A network error occurred. Please try again.', 'error', 'Network Error');
    } finally {
      setSaving(false);
    }
  };

  // ---- helpers ----
  const classLabel = (classId) => {
    const found = availableClasses.find((c) => String(c.class_id) === String(classId));
    return found ? formatClassName(found.class_name) : '';
  };

  const sectionsForClass = (classId) => {
    if (!classId) return [];
    return sectionsByClass[String(classId)] || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-white/70">Loading teacher…</div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-3 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {mode === 'add' ? 'Add Teacher' : 'Edit Teacher'}
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Enter the teacher details and assign classes and sections.
              </p>
            </div>
          </div>

          {/* Teacher Details */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 mb-4">
            <h2 className="text-lg font-semibold text-white mb-4">Teacher Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Teacher ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.teacher_id}
                  readOnly
                  className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white/70 cursor-not-allowed"
                />
                {errors.teacher_id && <p className="mt-1 text-xs text-red-400">{errors.teacher_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Priya Sharma"
                  className={`w-full px-3 py-2 bg-white/10 border ${errors.full_name ? 'border-red-500' : 'border-white/20'} rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500`}
                />
                {errors.full_name && <p className="mt-1 text-xs text-red-400">{errors.full_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Email Address <span className="text-red-400">*</span>{' '}
                  <span className="text-xs text-white/40">(gmail only)</span>
                </label>
                <input
                  type="email"
                  value={formData.email_id}
                  onChange={(e) => setFormData({ ...formData, email_id: e.target.value })}
                  placeholder="teacher@gmail.com"
                  className={`w-full px-3 py-2 bg-white/10 border ${errors.email_id ? 'border-red-500' : 'border-white/20'} rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500`}
                />
                {errors.email_id && <p className="mt-1 text-xs text-red-400">{errors.email_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Phone Number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                  }
                  placeholder="10-digit mobile"
                  className={`w-full px-3 py-2 bg-white/10 border ${errors.phone ? 'border-red-500' : 'border-white/20'} rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500`}
                />
                {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Qualification</label>
                <input
                  type="text"
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  placeholder="e.g., M.Sc, B.Ed"
                  className={`w-full px-3 py-2 bg-white/10 border ${errors.qualification ? 'border-red-500' : 'border-white/20'} rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500`}
                />
                {errors.qualification && <p className="mt-1 text-xs text-red-400">{errors.qualification}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Teacher" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Teacher</option>
                  <option value="Headmaster" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Headmaster</option>
                  <option value="Class Teacher" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Class Teacher</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-blue-500"
                  />
                  Active (visible in Faculty and Student dashboards)
                </label>
              </div>
            </div>
          </div>

          {/* Assign Classes & Sections */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 mb-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">Assign Classes &amp; Sections</h2>
              <p className="text-white/60 text-sm mt-1">
                Add one block per class-section. Select subjects taught in that class-section.
                Mark <span className="text-blue-400">one</span> block as primary.
              </p>
            </div>

            {errors.assignments && (
              <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                {errors.assignments}
              </div>
            )}
            {errors.primary && (
              <div className="mb-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                {errors.primary}
              </div>
            )}

            {assignments.length === 0 ? (
              <div className="text-center text-white/50 text-sm py-6 border border-dashed border-white/15 rounded-xl">
                No class assignments yet. Click below to add one.
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.map((a, idx) => {
                  const isPrimary = primaryIndex === idx;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 ${
                        isPrimary ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => markAsPrimary(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                              isPrimary
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                          >
                            {isPrimary ? (
                              <span className="flex items-center gap-1"><Check size={12} /> Primary</span>
                            ) : 'Set as primary'}
                          </button>
                          <span className="text-white/60 text-xs">
                            {a.class_id && a.section
                              ? `${classLabel(a.class_id)} • Section ${a.section}`
                              : 'New assignment'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAssignment(idx)}
                          className="p-1.5 rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20 transition"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-white/70 mb-1">Class</label>
                          <select
                            value={String(a.class_id || '')}
                            onChange={(e) => {
                              updateAssignment(idx, {
                                class_id: e.target.value,   // keep as string
                                section: '',
                              });
                            }}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                          >
                            <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Select Class</option>
                            {availableClasses.map((cls) => (
                              <option key={cls.class_id} value={String(cls.class_id)} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                                {formatClassName(cls.class_name)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-white/70 mb-1">Section</label>
                          {sectionsForClass(a.class_id).length > 0 ? (
                            <select
                              value={a.section}
                              onChange={(e) => updateAssignment(idx, { section: e.target.value })}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                            >
                              <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Select Section</option>
                              {sectionsForClass(a.class_id).map((s) => (
                                <option key={s} value={s} style={{ color: '#111827', backgroundColor: '#ffffff' }}>{s}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={a.section}
                              onChange={(e) => updateAssignment(idx, { section: e.target.value.toUpperCase().slice(0, 2) })}
                              placeholder={a.class_id ? 'Type section (e.g., A)' : 'Select class first'}
                              disabled={!a.class_id}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            />
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-medium text-white/70 mb-1">Subjects Taught</label>
                        <div className="max-h-40 overflow-y-auto bg-white/5 border border-white/10 rounded-lg p-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {allSubjects.map((s) => {
                              const name = s.subject_name;
                              const checked = a.subjects.includes(name);
                              return (
                                <label
                                  key={name}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${
                                    checked ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleSubject(idx, name)}
                                    className="w-4 h-4 accent-blue-500"
                                  />
                                  <span className="text-white">{name}</span>
                                </label>
                              );
                            })}
                            {allSubjects.length === 0 && (
                              <div className="text-white/50 text-xs">No subjects found.</div>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-white/40">
                          {a.subjects.length} subject{a.subjects.length === 1 ? '' : 's'} selected
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={a.is_class_teacher}
                            onChange={(e) => updateAssignment(idx, { is_class_teacher: e.target.checked })}
                            className="w-4 h-4 accent-blue-500"
                          />
                          This teacher is the Class Teacher of this section
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={addAssignment}
              className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition"
            >
              <Plus size={16} /> Add Class Assignment
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : (mode === 'add' ? 'Save Teacher' : 'Update Teacher')}
            </button>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        variant={alertState.variant}
        onClose={closeAlert}
      />
    </>
  );
};

export default TeacherFormPage;