'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Plus, Pencil, Trash2, Search, Eye,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../../components/ConfirmModal';
import ModifyLookupModal from '../../../components/ModifyLookupModal';
import AlertModal from '../../../components/AlertModal';
import ViewModal from '../../../components/ViewModal';
import { isValidName, isValidEmail, isGmailEmail, isValidPhone, normalizePhone } from '../../../lib/validators';
import { formatClassName } from '../../../lib/format-class-name';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [viewTeacher, setViewTeacher] = useState(null);
  const modalBodyRef = useRef(null);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'error' });

  const showAlert = (message, variant = 'error', title = 'Error') =>
    setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () =>
    setAlertState({ isOpen: false, title: '', message: '', variant: 'error' });

  const [formData, setFormData] = useState({
    teacher_id: '',
    full_name: '',
    subject_name: '',
    qualification: '',
    class_id: '',
    section_1: '',
    section_2: '',
    role: 'Teacher',
    is_class_teacher: false,
    subjects: '',
    phone: '',
    email_id: '',
    is_active: true
  });

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/teachers`);
      const data = await response.json();
      setTeachers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/classes`);
      const data = await response.json();
      setAvailableClasses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const validateForm = () => {
    if (!formData.teacher_id.trim()) { setValidationError('Teacher ID is required'); return false; }
    if (!formData.teacher_id.match(/^[TH]/)) { setValidationError('Teacher ID must start with "T" (Teacher) or "H" (Headmaster)'); return false; }
    if (!formData.full_name.trim()) { setValidationError('Teacher Name is required'); return false; }
    if (!isValidName(formData.full_name)) { setValidationError('Teacher Name can only contain letters, spaces, dots, hyphens and apostrophes'); return false; }
    if (!formData.email_id.trim()) { setValidationError('Email is required'); return false; }
    if (!isValidEmail(formData.email_id)) { setValidationError('Please enter a valid email address (e.g., name@domain.com)'); return false; }
    if (!isGmailEmail(formData.email_id)) { setValidationError('Teacher email must be a @gmail.com address'); return false; }
    if (formData.phone && formData.phone.trim() !== '') {
      if (!isValidPhone(formData.phone)) { setValidationError('Enter a valid 10-digit mobile number (starting 6-9)'); return false; }
    }
    if (formData.subject_name && !isValidName(formData.subject_name)) { setValidationError('Subject can only contain letters, spaces, dots, hyphens and apostrophes'); return false; }
    if (formData.qualification && !isValidName(formData.qualification)) { setValidationError('Qualification can only contain letters, spaces, dots, hyphens and apostrophes'); return false; }
    if (formData.section_1 && !/^[A-Za-z]$/.test(String(formData.section_1).trim())) { setValidationError('Section 1 must be a single letter (A-Z)'); return false; }
    if (formData.section_2 && !/^[A-Za-z]$/.test(String(formData.section_2).trim())) { setValidationError('Section 2 must be a single letter (A-Z)'); return false; }
    if (formData.subjects && String(formData.subjects).trim()) {
      const parts = String(formData.subjects).split(',').map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (!isValidName(part)) {
          setValidationError(`Invalid subject: "${part}". Only letters, spaces, dots, hyphens and apostrophes allowed.`);
          return false;
        }
      }
    }
    setValidationError('');
    return true;
  };

  const handleAdd = async () => {
    if (!validateForm()) { scrollToTop(); return; }
    try {
      const classIdValue = formData.class_id && String(formData.class_id).trim() !== ''
        ? parseInt(formData.class_id)
        : null;

      const response = await fetch(`${API_BASE_URL}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: formData.teacher_id,
          name: formData.full_name,
          subject: formData.subject_name,
          qualification: formData.qualification,
          class_id: classIdValue,
          section_1: formData.section_1,
          section_2: formData.section_2,
          role: formData.role,
          is_class_teacher: formData.is_class_teacher,
          subjects: formData.subjects,
          contact: formData.phone ? normalizePhone(formData.phone) : null,
          email: formData.email_id,
          status: formData.is_active ? 'Active' : 'Inactive'
        })
      });
      if (response.ok) {
        fetchTeachers();
        setIsModalOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        setValidationError(error.error || 'Failed to add teacher');
        scrollToTop();
      }
    } catch (error) {
      console.error('Error adding teacher:', error);
      setValidationError('Failed to add teacher');
      scrollToTop();
    }
  };

  const handleModify = async () => {
    if (!validateForm()) { scrollToTop(); return; }
    if (selectedTeacher) {
      try {
        const classIdValue = formData.class_id && String(formData.class_id).trim() !== ''
          ? parseInt(formData.class_id)
          : null;

        const response = await fetch(`${API_BASE_URL}/teachers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teacher_id: formData.teacher_id,
            name: formData.full_name,
            subject: formData.subject_name,
            qualification: formData.qualification,
            class_id: classIdValue,
            section_1: formData.section_1,
            section_2: formData.section_2,
            role: formData.role,
            is_class_teacher: formData.is_class_teacher,
            subjects: formData.subjects,
            contact: formData.phone ? normalizePhone(formData.phone) : null,
            email: formData.email_id,
            status: formData.is_active ? 'Active' : 'Inactive'
          })
        });
        if (response.ok) {
          fetchTeachers();
          setIsModalOpen(false);
          resetForm();
        } else {
          const error = await response.json();
          setValidationError(error.error || 'Failed to update teacher');
          scrollToTop();
        }
      } catch (error) {
        console.error('Error updating teacher:', error);
        setValidationError('Failed to update teacher');
        scrollToTop();
      }
    }
  };

  const scrollToTop = () => {
    if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
  };

  const handleToggleStatus = async (teacher) => {
    const currentStatus = teacher.status || (teacher.is_active ? 'Active' : 'Inactive');
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    setTeachers((prev) =>
      prev.map((t) =>
        t.teacher_id === teacher.teacher_id
          ? { ...t, status: newStatus, is_active: newStatus === 'Active' }
          : t
      )
    );

    try {
      const response = await fetch(`${API_BASE_URL}/teachers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacher.teacher_id || teacher.id, status: newStatus }),
      });

      if (!response.ok) {
        setTeachers((prev) =>
          prev.map((t) =>
            t.teacher_id === teacher.teacher_id
              ? { ...t, status: currentStatus, is_active: currentStatus === 'Active' }
              : t
          )
        );
        const err = await response.json();
        showAlert(err.error || 'Failed to update status', 'error', 'Update Failed');
        return;
      }
      fetchTeachers();
    } catch (error) {
      console.error('Toggle error:', error);
      setTeachers((prev) =>
        prev.map((t) =>
          t.teacher_id === teacher.teacher_id
            ? { ...t, status: currentStatus, is_active: currentStatus === 'Active' }
            : t
        )
      );
      showAlert('Network error. Please try again.', 'error', 'Network Error');
    }
  };

  const handleModifyLookup = (id) => {
    const teacher = teachers.find(
      (t) => String(t.id) === String(id) || String(t.teacher_id) === String(id)
    );
    if (teacher) {
      setLookupOpen(false);
      openModal('modify', teacher);
      return true;
    }
    return false;
  };

  const handleDelete = (id) => setDeleteTarget(id);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE_URL}/teachers?id=${deleteTarget}`, { method: 'DELETE' });
      fetchTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      showAlert('Could not delete the teacher. Please try again.', 'error', 'Delete Failed');
    } finally {
      setDeleteTarget(null);
    }
  };

  const resetForm = () => {
    setFormData({
      teacher_id: '', full_name: '', subject_name: '', qualification: '',
      class_id: '', section_1: '', section_2: '', role: 'Teacher',
      is_class_teacher: false, subjects: '', phone: '', email_id: '', is_active: true
    });
    setSelectedTeacher(null);
    setValidationError('');
  };

  const openModal = (type, teacher = null) => {
    setModalType(type);
    setValidationError('');
    if (type === 'add') {
      resetForm();
      const nextId = teachers.length + 1;
      setFormData(prev => ({ ...prev, teacher_id: `T${String(nextId).padStart(3, '0')}` }));
    } else if (type === 'modify' && teacher) {
      setSelectedTeacher(teacher);
      setFormData({
        teacher_id: teacher.id || teacher.teacher_id || '',
        full_name: teacher.name || teacher.full_name || '',
        subject_name: teacher.subject || teacher.subject_name || '',
        qualification: teacher.qualification || '',
        class_id: teacher.class_id || '',
        section_1: teacher.section_1 || '',
        section_2: teacher.section_2 || '',
        role: teacher.role || 'Teacher',
        is_class_teacher: teacher.is_class_teacher || false,
        subjects: Array.isArray(teacher.subjects) ? teacher.subjects.join(', ') : teacher.subjects || '',
        phone: teacher.contact || teacher.phone || '',
        email_id: teacher.email || teacher.email_id || '',
        is_active: teacher.status === 'Active' || teacher.is_active === true
      });
    }
    setIsModalOpen(true);
  };

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digits }));
  };

  const filteredTeachers = Array.isArray(teachers) ? teachers.filter(t => {
    const term = searchTerm.toLowerCase();
    const idStr = t.id ? String(t.id) : '';
    const nameStr = t.name || '';
    const subjectStr = t.subject || '';
    return nameStr.toLowerCase().includes(term) || 
           idStr.toLowerCase().includes(term) ||
           subjectStr.toLowerCase().includes(term);
  }) : [];

  const stats = {
    total: Array.isArray(teachers) ? teachers.length : 0,
    active: Array.isArray(teachers) ? teachers.filter(t => t.status === 'Active' || t.is_active === true).length : 0,
    inactive: Array.isArray(teachers) ? teachers.filter(t => t.status === 'Inactive' || t.is_active === false).length : 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-2 sm:gap-3">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0" />
            <span className="truncate">Teacher Management</span>
          </h1>
          <p className="text-white/60 text-sm sm:text-base">Manage all teachers, track their progress, and update records</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-4 sm:p-6">
            <p className="text-white/80 text-sm">Total Teachers</p>
            <p className="text-white text-3xl sm:text-4xl font-bold">{stats.total}</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">Enrolled this year</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 sm:p-6">
            <p className="text-white/80 text-sm">Active Teachers</p>
            <p className="text-white text-3xl sm:text-4xl font-bold">{stats.active}</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">Currently teaching</p>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 sm:p-6 sm:col-span-2 md:col-span-1">
            <p className="text-white/80 text-sm">Inactive Teachers</p>
            <p className="text-white text-3xl sm:text-4xl font-bold">{stats.inactive}</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">Not currently teaching</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-6">
          <button
            onClick={() => openModal('add')}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 sm:px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
          >
            <Plus size={18} /> Add Teacher
          </button>
          <button
            onClick={() => setLookupOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 sm:px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
          >
            <Pencil size={18} /> Modify Teacher
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="flex-1 sm:min-w-[200px] relative">
            <input
              type="text"
              placeholder="Search by name, ID, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
            />
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">ID</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Name</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Subject</th>
                  <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Qualification</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Class</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Section 1</th>
                  <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Section 2</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Role</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Phone</th>
                  <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Email</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={12} className="text-center py-8 text-white/60">Loading...</td></tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-8 text-white/60">{searchTerm ? 'No teachers match your search' : 'No teachers found'}</td></tr>
                ) : (
                  filteredTeachers.map((teacher, idx) => {
                    const isActive = teacher.status === 'Active' || teacher.is_active === true;
                    return (
                    <tr key={teacher.id || teacher.teacher_id || idx} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{teacher.id || teacher.teacher_id || '-'}</td>
                      <td className="px-3 sm:px-4 py-3 text-white text-xs sm:text-sm font-medium">{teacher.name || teacher.full_name || '-'}</td>
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{teacher.subject || teacher.subject_name || '-'}</td>
                      <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{teacher.qualification || '-'}</td>
                      <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">
                        {teacher.class_id
                          ? formatClassName(
                              availableClasses.find(c => String(c.class_id) === String(teacher.class_id))?.class_name
                              || teacher.class_id
                           )
                          : '-'}
                      </td>
                      <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{teacher.section_1 || '-'}</td>
                      <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{teacher.section_2 || '-'}</td>
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{teacher.role || 'Teacher'}</td>
                      <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{teacher.contact || teacher.phone || '-'}</td>
                      <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{teacher.email || teacher.email_id || '-'}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(teacher)}
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                            isActive
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          }`}
                        >
                          {isActive ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex gap-1.5 sm:gap-2">
                          <button
                            onClick={() => setViewTeacher(teacher)}
                            className="p-1.5 rounded-lg bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 transition"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openModal('modify', teacher)}
                            className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(teacher.id || teacher.teacher_id)}
                            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 sm:p-8 w-full max-w-2xl border border-white/20 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              ref={modalBodyRef}
            >
              <div className="flex justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {modalType === 'add' ? 'Add New Teacher' : 'Modify Teacher'}
                </h2>
                <button 
                  onClick={() => { setIsModalOpen(false); resetForm(); }} 
                  className="text-white/40 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {validationError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-400 text-sm text-center mb-4">
                  {validationError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-white/70 text-sm block mb-1">
                    Teacher ID * <span className="text-xs text-white/40">(auto-generated, read-only)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., T001"
                    value={formData.teacher_id}
                    readOnly
                    disabled
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white/60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Teacher Name *</label>
                  <input
                    type="text"
                    placeholder="Enter teacher name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g., Mathematics"
                    value={formData.subject_name}
                    onChange={(e) => setFormData({...formData, subject_name: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Qualification</label>
                  <input
                    type="text"
                    placeholder="e.g., M.Sc, B.Ed"
                    value={formData.qualification}
                    onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>

                <div>
                  <label className="text-white/70 text-sm block mb-1">Class</label>
                  <select
                    value={formData.class_id}
                    onChange={(e) => setFormData({...formData, class_id: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
                  >
                    <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                      — No class assigned —
                    </option>
                    {availableClasses.map((cls, i) => (
                      <option key={cls.class_id || i} value={cls.class_id} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                        {formatClassName(cls.class_name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-white/70 text-sm block mb-1">Section 1</label>
                  <input
                    type="text"
                    placeholder="e.g., A"
                    value={formData.section_1}
                    onChange={(e) => setFormData({...formData, section_1: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Section 2</label>
                  <input
                    type="text"
                    placeholder="e.g., B"
                    value={formData.section_2}
                    onChange={(e) => setFormData({...formData, section_2: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Subjects (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g., Math, Science"
                    value={formData.subjects}
                    onChange={(e) => setFormData({...formData, subjects: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Contact Number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                  <p className="text-xs text-white/40 mt-1">10 digits, starting with 6-9</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">
                    Email * <span className="text-xs text-white/40">(gmail only)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="teacher@gmail.com"
                    value={formData.email_id}
                    onChange={(e) => setFormData({...formData, email_id: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
                  >
                    <option value="Teacher"       style={{ color: '#111827', backgroundColor: '#ffffff' }}>Teacher</option>
                    <option value="Headmaster"    style={{ color: '#111827', backgroundColor: '#ffffff' }}>Headmaster</option>
                    <option value="Class Teacher" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Class Teacher</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Status</label>
                  <select
                    value={formData.is_active ? 'Active' : 'Inactive'}
                    onChange={(e) => setFormData({...formData, is_active: e.target.value === 'Active'})}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
                  >
                    <option value="Active"   style={{ color: '#111827', backgroundColor: '#ffffff' }}>Active</option>
                    <option value="Inactive" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Inactive</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-white/70 text-sm">Class Teacher:</label>
                  <input
                    type="checkbox"
                    checked={formData.is_class_teacher}
                    onChange={(e) => setFormData({...formData, is_class_teacher: e.target.checked})}
                    className="w-5 h-5 accent-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={modalType === 'add' ? handleAdd : handleModify}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
                >
                  {modalType === 'add' ? 'Add Teacher' : 'Save Changes'}
                </button>
                <button
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="flex-1 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModifyLookupModal
        isOpen={lookupOpen}
        onClose={() => setLookupOpen(false)}
        onSubmit={handleModifyLookup}
        title="Modify Teacher"
        placeholder="Enter Teacher ID (e.g., T001 or H001)"
        errorText="Teacher not found. Please check the ID."
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Teacher?"
        message={`Are you sure you want to delete teacher ${deleteTarget || ''}? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ViewModal
        isOpen={!!viewTeacher}
        title={viewTeacher ? `${viewTeacher.name || viewTeacher.full_name || ''} — ${viewTeacher.teacher_id || viewTeacher.id || ''}` : ''}
        sections={viewTeacher ? [
          {
            title: 'Teacher Information',
            fields: [
              { label: 'Teacher ID', value: viewTeacher.teacher_id || viewTeacher.id },
              { label: 'Name', value: viewTeacher.name || viewTeacher.full_name },
              { label: 'Subject', value: viewTeacher.subject || viewTeacher.subject_name },
              { label: 'Qualification', value: viewTeacher.qualification },
              { label: 'Role', value: viewTeacher.role },
              { label: 'Status', value: viewTeacher.status },
              { label: 'Phone', value: viewTeacher.contact || viewTeacher.phone },
              { label: 'Email', value: viewTeacher.email || viewTeacher.email_id },
            ],
          },
          {
            title: 'Class Assignment',
            fields: [
              { label: 'Class', value: viewTeacher.class_id
                  ? formatClassName(
                      availableClasses.find(c => String(c.class_id) === String(viewTeacher.class_id))?.class_name
                      || viewTeacher.class_id
                    )
                  : '' },
              { label: 'Section 1', value: viewTeacher.section_1 },
              { label: 'Section 2', value: viewTeacher.section_2 },
              { label: 'Class Teacher', value: viewTeacher.is_class_teacher ? 'Yes' : 'No' },
            ],
          },
          {
            title: 'Subjects Taught',
            fields: [
              { label: 'Subjects', value: Array.isArray(viewTeacher.subjects)
                  ? viewTeacher.subjects.join(', ')
                  : viewTeacher.subjects, fullWidth: true },
            ],
          },
        ] : []}
        onClose={() => setViewTeacher(null)}
      />

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