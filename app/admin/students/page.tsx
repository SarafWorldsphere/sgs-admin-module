'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Pencil, Trash2, Search, X, Eye, Download,
  Users, UserCheck, UserX, BookOpen
} from 'lucide-react';
import StudentFormWizard from '../../../components/StudentFormWizard';
import ConfirmModal from '../../../components/ConfirmModal';
import ModifyLookupModal from '../../../components/ModifyLookupModal';
import AlertModal from '../../../components/AlertModal';
import ViewModal from '../../../components/ViewModal';
import { formatClassName } from '../../../lib/format-class-name';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewStudent, setViewStudent] = useState(null);
  const [exportClass, setExportClass] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'error' });

  const showAlert = (message, variant = 'error', title = 'Error') =>
    setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () =>
    setAlertState({ isOpen: false, title: '', message: '', variant: 'error' });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/students`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const mappedStudents = data.map(s => ({
          id: s.admission_no || s.id,
          student_id: s.admission_no || s.student_id,
          admission_no: s.admission_no,
          name: s.full_name || s.name,
          full_name: s.full_name || s.name,
          class: s.class_name || s.class || '',
          class_id: s.class_id,
          class_name: s.class_name || '',
          section: s.section || '',
          roll_no: s.roll_no || '',
          parent1_name: s.parent1_name || '',
          parent1_phone: s.parent1_phone || '',
          parent1_email: s.parent1_email || '',
          parent2_name: s.parent2_name || '',
          parent2_phone: s.parent2_phone || '',
          parent2_email: s.parent2_email || '',
          student_contact: s.student_phone || s.student_contact || '',
          student_phone: s.student_phone || '',
          student_email: s.student_email || '',
          guardian_name: s.guardian_name || '',
          guardian_phone: s.guardian_phone || '',
          guardian_email: s.guardian_email || '',
          status: s.record_status || s.status || 'Active',
          record_status: s.record_status || 'Inactive'
        }));
        setStudents(mappedStudents);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (student) => {
    const currentStatus = student.status || student.record_status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    setStudents((prev) =>
      prev.map((s) =>
        s.admission_no === student.admission_no
          ? { ...s, status: newStatus, record_status: newStatus }
          : s
      )
    );

    try {
      const response = await fetch(`${API_BASE_URL}/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admission_no: student.admission_no, status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStudents((prev) =>
          prev.map((s) =>
            s.admission_no === student.admission_no
              ? { ...s, status: currentStatus, record_status: currentStatus }
              : s
          )
        );
        showAlert(data.error || 'Failed to update status', 'error', 'Update Failed');
        return;
      }
      fetchStudents();
    } catch (error) {
      console.error('Toggle error:', error);
      setStudents((prev) =>
        prev.map((s) =>
          s.admission_no === student.admission_no
            ? { ...s, status: currentStatus, record_status: currentStatus }
            : s
        )
      );
      showAlert('Network error. Please try again.', 'error', 'Network Error');
    }
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setValidationError('');
  };

  const openModal = (type, student = null) => {
    setModalType(type);
    setValidationError('');
    if (type === 'add') {
      resetForm();
      setEditingStudent(null);
    } else if (type === 'modify' && student) {
      setSelectedStudent(student);
      setEditingStudent(student);
    }
    setIsModalOpen(true);
  };

  const handleWizardSuccess = () => fetchStudents();

  const handleWizardClose = () => {
    setIsModalOpen(false);
    setEditingStudent(null);
    resetForm();
  };

  const handleDelete = (id) => setDeleteTarget(id);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`${API_BASE_URL}/students?id=${deleteTarget}`, { method: 'DELETE' });
      if (response.ok) {
        fetchStudents();
      } else {
        showAlert('Could not delete the student. Please try again.', 'error', 'Delete Failed');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      showAlert('An error occurred while deleting the student.', 'error', 'Error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleModifyLookup = (id) => {
    const student = students.find(
      s => s.admission_no === id || s.student_id === id || s.id === id
    );
    if (!student) return false;
    setLookupOpen(false);
    openModal('modify', student);
    return true;
  };

  // ✅ Phase 1 — Item 7: Export to Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const source = exportClass === 'all'
        ? filteredStudents
        : filteredStudents.filter(s => String(s.class_name) === String(exportClass));

      if (source.length === 0) {
        showAlert('No students to export for the selected class.', 'warning', 'Nothing to Export');
        setExporting(false);
        return;
      }

      const rows = source.map((s) => ({
        'Admission No': s.admission_no || '',
        'Name': s.full_name || '',
        'Class': s.class_name ? formatClassName(s.class_name) : '',
        'Section': s.section || '',
        'Roll No': s.roll_no || '',
        'Student Phone': s.student_phone || '',
        'Student Email': s.student_email || '',
        'Parent 1 Name': s.parent1_name || '',
        'Parent 1 Phone': s.parent1_phone || '',
        'Parent 1 Email': s.parent1_email || '',
        'Parent 2 Name': s.parent2_name || '',
        'Parent 2 Phone': s.parent2_phone || '',
        'Parent 2 Email': s.parent2_email || '',
        'Guardian Name': s.guardian_name || '',
        'Guardian Phone': s.guardian_phone || '',
        'Guardian Email': s.guardian_email || '',
        'Status': s.status || '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      const sheetName = exportClass === 'all' ? 'All Students' : `Class ${exportClass}`;
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const fileName = exportClass === 'all'
        ? `students_all_${new Date().toISOString().split('T')[0]}.xlsx`
        : `students_class_${exportClass}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Could not generate the Excel file. Please try again.', 'error', 'Export Failed');
    } finally {
      setExporting(false);
    }
  };

  const filteredStudents = Array.isArray(students) ? students.filter(s => {
    const term = searchTerm.toLowerCase();
    if (searchType === 'name') return s.name?.toLowerCase().includes(term);
    if (searchType === 'id') return s.admission_no?.toLowerCase().includes(term) || s.student_id?.toLowerCase().includes(term);
    if (searchType === 'class') return (s.class_name || '').toLowerCase().includes(term);
    if (searchType === 'section') return s.section?.toLowerCase().includes(term);
    return true;
  }) : [];

  const uniqueClassNames = Array.from(
    new Set(students.map((s) => (s.class_name || '').trim()).filter(Boolean))
  ).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const stats = {
    total: Array.isArray(students) ? students.length : 0,
    active: Array.isArray(students) ? students.filter(s => s.status === 'Active').length : 0,
    inactive: Array.isArray(students) ? students.filter(s => s.status === 'Inactive').length : 0,
  };

  // Build sections for the View modal
  const buildViewSections = (s) => [
    {
      title: 'Student Information',
      fields: [
        { label: 'Admission No', value: s.admission_no },
        { label: 'Name', value: s.full_name },
        { label: 'Class', value: s.class_name ? formatClassName(s.class_name) : '' },
        { label: 'Section', value: s.section },
        { label: 'Roll No', value: s.roll_no },
        { label: 'Status', value: s.status },
        { label: 'Student Phone', value: s.student_phone },
        { label: 'Student Email', value: s.student_email },
      ],
    },
    {
      title: 'Parent 1',
      fields: [
        { label: 'Name', value: s.parent1_name },
        { label: 'Phone', value: s.parent1_phone },
        { label: 'Email', value: s.parent1_email, fullWidth: true },
      ],
    },
    {
      title: 'Parent 2',
      fields: [
        { label: 'Name', value: s.parent2_name },
        { label: 'Phone', value: s.parent2_phone },
        { label: 'Email', value: s.parent2_email, fullWidth: true },
      ],
    },
    {
      title: 'Guardian',
      fields: [
        { label: 'Name', value: s.guardian_name },
        { label: 'Phone', value: s.guardian_phone },
        { label: 'Email', value: s.guardian_email, fullWidth: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-2 sm:gap-3">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0" />
            <span className="truncate">Student Management</span>
          </h1>
          <p className="text-white/60 text-sm sm:text-base">Manage all students, track their progress, and update records</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-4 sm:p-6">
            <p className="text-white/80 text-sm">Total Students</p>
            <p className="text-white text-3xl sm:text-4xl font-bold">{stats.total}</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">Enrolled this year</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 sm:p-6">
            <p className="text-white/80 text-sm">Active Students</p>
            <p className="text-white text-3xl sm:text-4xl font-bold">{stats.active}</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">Currently attending</p>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 sm:p-6 sm:col-span-2 md:col-span-1">
            <p className="text-white/80 text-sm">Inactive Students</p>
            <p className="text-white text-3xl sm:text-4xl font-bold">{stats.inactive}</p>
            <p className="text-white/60 text-xs sm:text-sm mt-2">Not currently enrolled</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-6">
          <button
            onClick={() => openModal('add')}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 sm:px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
          >
            <Plus size={18} /> Add Student
          </button>
          <button
            onClick={() => setLookupOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-5 sm:px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
          >
            <Pencil size={18} /> Modify Student
          </button>

          {/* ✅ Phase 1 — Item 7: Export to Excel */}
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
            <select
              value={exportClass}
              onChange={(e) => setExportClass(e.target.value)}
              className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-white/40"
              style={{ colorScheme: 'dark' }}
            >
              <option value="all" style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                All Classes
              </option>
              {uniqueClassNames.map((cn) => (
                <option key={cn} value={cn} style={{ color: '#111827', backgroundColor: '#ffffff' }}>
                  {formatClassName(cn)}
                </option>
              ))}
            </select>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-5 sm:px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-50"
            >
              <Download size={18} /> {exporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="flex-1 sm:min-w-[200px] relative">
            <input
              type="text"
              placeholder="Search by name, ID, class, or section..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
            />
          </div>
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
            className="w-full sm:w-auto px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
            style={{ colorScheme: 'dark' }}
          >
            <option value="name"    style={{ color: '#111827', backgroundColor: '#ffffff' }}>Search by Name</option>
            <option value="id"      style={{ color: '#111827', backgroundColor: '#ffffff' }}>Search by ID</option>
            <option value="class"   style={{ color: '#111827', backgroundColor: '#ffffff' }}>Search by Class</option>
            <option value="section" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Search by Section</option>
          </select>
        </div>

        <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">ID</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Name</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Class</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Section</th>
                  <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Roll No</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Parent 1 Name</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Parent 1 Phone</th>
                  <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Parent 1 Email</th>
                  <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Parent 2 Name</th>
                  <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Parent 2 Phone</th>
                  <th className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Parent 2 Email</th>
                  <th className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Guardian Name</th>
                  <th className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Guardian Phone</th>
                  <th className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Guardian Email</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={16} className="text-center py-8 text-white/60">Loading...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="text-center py-8 text-white/60">
                      {searchTerm ? 'No students match your search' : 'No students found'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, idx) => (
                    <tr key={student.id || idx} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{student.admission_no || student.student_id || student.id}</td>
                      <td className="px-3 sm:px-4 py-3 text-white text-xs sm:text-sm font-medium">{student.name || student.full_name}</td>
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">
                        {student.class_name
                          ? formatClassName(student.class_name)
                          : (student.class ? formatClassName(student.class) : '-')}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.section || '-'}</td>
                      <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.roll_no || '-'}</td>
                      <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.parent1_name || '-'}</td>
                      <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{student.parent1_phone || '-'}</td>
                      <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.parent1_email || '-'}</td>
                      <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.parent2_name || '-'}</td>
                      <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{student.parent2_phone || '-'}</td>
                      <td className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.parent2_email || '-'}</td>
                      <td className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.guardian_name || '-'}</td>
                      <td className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{student.guardian_phone || '-'}</td>
                      <td className="hidden 2xl:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{student.guardian_email || '-'}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(student)}
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap ${
                            student.status === 'Active' 
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          } transition cursor-pointer`}
                        >
                          {student.status === 'Active' ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex gap-1.5 sm:gap-2">
                          {/* ✅ Phase 1 — Item 5: View */}
                          <button
                            onClick={() => setViewStudent(student)}
                            className="p-1.5 rounded-lg bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 transition"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openModal('modify', student)}
                            className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                            title="Modify"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(student.admission_no || student.id)}
                            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <StudentFormWizard
        isOpen={isModalOpen}
        onClose={handleWizardClose}
        onSuccess={handleWizardSuccess}
        editData={editingStudent}
        theme="dark"
      />

      <ModifyLookupModal
        isOpen={lookupOpen}
        onClose={() => setLookupOpen(false)}
        title="Modify Student"
        placeholder="Enter Admission Number or Student ID"
        errorText="Student not found"
        onSubmit={handleModifyLookup}
        isDark={true}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Student?"
        message={`Are you sure you want to delete student ${deleteTarget || ''}? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ✅ Phase 1 — Item 5: View Modal */}
      <ViewModal
        isOpen={!!viewStudent}
        title={viewStudent ? `${viewStudent.full_name} — ${viewStudent.admission_no}` : ''}
        sections={viewStudent ? buildViewSections(viewStudent) : []}
        onClose={() => setViewStudent(null)}
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