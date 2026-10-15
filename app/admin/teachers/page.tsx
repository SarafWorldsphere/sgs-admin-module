'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Pencil, Trash2, Search, Eye,
  BookOpen
} from 'lucide-react';
import ConfirmModal from '../../../components/ConfirmModal';
import AlertModal from '../../../components/AlertModal';
import ViewModal from '../../../components/ViewModal';
import { formatClassName } from '../../../lib/format-class-name';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';

export default function TeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTeacher, setViewTeacher] = useState(null);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'error' });
  const [statsData, setStatsData] = useState({ total: 0, active: 0, inactive: 0 });

  const showAlert = (message, variant = 'error', title = 'Error') =>
    setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () =>
    setAlertState({ isOpen: false, title: '', message: '', variant: 'error' });

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
    fetchStats();
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

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/teachers/stats`);
      const data = await response.json();
      setStatsData({
        total: Number(data.total) || 0,
        active: Number(data.active) || 0,
        inactive: Number(data.inactive) || 0,
      });
    } catch (error) {
      console.error('Error fetching teacher stats:', error);
    }
  };

  // ✅ Toggle touches ONLY is_active (per Bhuvan)
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
      fetchStats();
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

  const handleDelete = (id) => setDeleteTarget(id);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API_BASE_URL}/teachers?id=${deleteTarget}`, { method: 'DELETE' });
      fetchTeachers();
      fetchStats();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      showAlert('Could not delete the teacher. Please try again.', 'error', 'Delete Failed');
    } finally {
      setDeleteTarget(null);
    }
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

  const stats = statsData;

  // ✅ Format a single assignment for display: "8A (Maths, Science)"
  const formatAssignment = (a) => {
    const className = a.class_id
      ? formatClassName(
          availableClasses.find(c => String(c.class_id) === String(a.class_id))?.class_name
          || a.class_id
        )
      : '';
    const sectionPart = a.section ? ` ${a.section}` : '';
    const subjectList = Array.isArray(a.subjects)
      ? a.subjects.filter(Boolean).join(', ')
      : (a.subjects || '');
    const subjectPart = subjectList ? ` (${subjectList})` : '';
    const ct = a.is_class_teacher ? ' · CT' : '';
    return `${className}${sectionPart}${subjectPart}${ct}`;
  };

  // ✅ Format all assignments joined with " • "
  const formatAllAssignments = (assignments) => {
    if (!Array.isArray(assignments) || assignments.length === 0) return '-';
    return assignments.map(formatAssignment).join(' • ');
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
            onClick={() => router.push('/admin/teachers/new')}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-5 sm:px-6 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
          >
            <Plus size={18} /> Add Teacher
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
            <table className="w-full min-w-[700px]">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">ID</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Name</th>
                  <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Qualification</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Assignments</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Role</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Phone</th>
                  <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Email</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-white/60">Loading...</td></tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-white/60">{searchTerm ? 'No teachers match your search' : 'No teachers found'}</td></tr>
                ) : (
                  filteredTeachers.map((teacher, idx) => {
                    const isActive = teacher.is_active === true;
                    const hasInactiveNull = teacher.is_active === null || teacher.is_active === undefined;
                    return (
                    <tr key={teacher.id || teacher.teacher_id || idx} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{teacher.id || teacher.teacher_id || '-'}</td>
                      <td className="px-3 sm:px-4 py-3 text-white text-xs sm:text-sm font-medium">{teacher.name || teacher.full_name || '-'}</td>
                      <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{teacher.qualification || '-'}</td>
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">
                        <div className="max-w-md break-words">
                          {formatAllAssignments(teacher.assignments)}
                        </div>
                      </td>
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
                            onClick={() => router.push(`/admin/teachers/${encodeURIComponent(teacher.teacher_id || teacher.id)}/edit`)}
                            className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                            title="Modify"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(teacher.id || teacher.teacher_id)}
                            className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                            title="Delete"
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
              { label: 'Qualification', value: viewTeacher.qualification },
              { label: 'Role', value: viewTeacher.role },
              { label: 'Status', value: viewTeacher.is_active === true ? 'Active' : 'Inactive' },
              { label: 'Phone', value: viewTeacher.contact || viewTeacher.phone },
              { label: 'Email', value: viewTeacher.email || viewTeacher.email_id },
            ],
          },
          {
            title: 'Class Assignments',
            fields: (viewTeacher.assignments && viewTeacher.assignments.length > 0)
              ? viewTeacher.assignments.map((a, i) => ({
                  label: `Assignment ${i + 1}`,
                  value: formatAssignment(a),
                  fullWidth: true,
                }))
              : [{ label: 'Assignments', value: 'None', fullWidth: true }],
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