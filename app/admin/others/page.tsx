'use client';

import { useState, useEffect } from 'react';
import {
  Bell, Calendar, Plus, Search, Edit2, Trash2,
  X, Megaphone, CalendarPlus, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../../../components/ConfirmModal';
import AlertModal from '../../../components/AlertModal';
import NotificationViewModal from '../../../components/NotificationViewModal';
import { fetchWithAuth } from '../../../lib/fetchWithAuth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';

const OPTION_STYLE = { color: '#111827', backgroundColor: '#ffffff' };

export default function OthersPage() {
  const [notifications, setNotifications] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('notifications');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [modalFor, setModalFor] = useState('notice');
  const [selectedItem, setSelectedItem] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'error' });
  
  // ✅ NEW: State for the full view modal
  const [viewItem, setViewItem] = useState(null);

  const showAlert = (message, variant = 'error', title = 'Error') =>
    setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () =>
    setAlertState({ isOpen: false, title: '', message: '', variant: 'error' });

  const [formData, setFormData] = useState({
    title: '',
    message: '',
    date: '',
    applicable_class: 'all',
    type: 'event',
  });

  useEffect(() => {
    fetchNotifications();
    fetchEvents();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/notices`);
      if (!response.ok) {
        setNotifications([]);
        return;
      }
      const data = await response.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching notices:', error);
      setNotifications([]);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/events`);
      if (!response.ok) {
        setEvents([]);
        return;
      }
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const validateForm = () => {
    if (!formData.title.trim()) { setValidationError('Title is required'); return false; }
    if (!formData.message.trim()) { setValidationError('Message is required'); return false; }
    if (!formData.date) { setValidationError('Date is required'); return false; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(formData.date);
    selected.setHours(0, 0, 0, 0);
    if (selected < today) {
      setValidationError('Cannot create a notification with a past date');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    const apiEndpoint = modalFor === 'notice' ? 'notices' : 'events';
    const payload: any = {
      title: formData.title,
      message: formData.message,
      date: formData.date,
      applicable_class: formData.applicable_class,
    };
    if (modalType === 'modify' && selectedItem && selectedItem.id) {
      payload.id = selectedItem.id;
    }
    if (modalFor === 'event') {
      payload.type = formData.type || 'event';
    }
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        if (modalFor === 'notice') fetchNotifications();
        else fetchEvents();
        setIsModalOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        showAlert(error.error || `Failed to save ${modalFor}`, 'error', 'Save Failed');
      }
    } catch (error) {
      console.error(`Error saving ${modalFor}:`, error);
      showAlert('A network error occurred.', 'error', 'Network Error');
    }
  };

  const handleToggleStatus = async (item) => {
    const isNotice = activeTab === 'notifications';
    const itemType = isNotice ? 'notice' : 'event';
    const apiEndpoint = isNotice ? 'notices' : 'events';
    const currentStatus = item.status || 'Active';
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';

    const updateList = (list) =>
      list.map((it) =>
        it.id === item.id ? { ...it, status: newStatus } : it
      );
    if (isNotice) setNotifications((prev) => updateList(prev));
    else setEvents((prev) => updateList(prev));

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/${apiEndpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: newStatus }),
      });
      if (!response.ok) {
        const revert = (list) =>
          list.map((it) =>
            it.id === item.id ? { ...it, status: currentStatus } : it
          );
        if (isNotice) setNotifications((prev) => revert(prev));
        else setEvents((prev) => revert(prev));
        const err = await response.json();
        showAlert(err.error || `Failed to update ${itemType} status`, 'error', 'Update Failed');
        return;
      }
      if (isNotice) fetchNotifications();
      else fetchEvents();
    } catch (error) {
      console.error(`Toggle ${itemType} error:`, error);
      const revert = (list) =>
        list.map((it) =>
          it.id === item.id ? { ...it, status: currentStatus } : it
        );
      if (isNotice) setNotifications((prev) => revert(prev));
      else setEvents((prev) => revert(prev));
      showAlert('Network error. Please try again.', 'error', 'Network Error');
    }
  };

  const handleDelete = (id, type) => {
    setDeleteTarget({ id, type });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    try {
      const apiEndpoint = type === 'notice' ? 'notices' : 'events';
      const response = await fetchWithAuth(`${API_BASE_URL}/${apiEndpoint}?id=${id}`, { method: 'DELETE' });
      if (response.ok) {
        if (type === 'notice') fetchNotifications();
        else fetchEvents();
      } else {
        showAlert(`Failed to delete ${type}`, 'error', 'Delete Failed');
      }
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      showAlert('An error occurred while deleting.', 'error', 'Error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      message: '',
      date: getTodayDate(),
      applicable_class: 'all',
      type: 'event',
    });
    setSelectedItem(null);
    setValidationError('');
  };

  const openModal = (type, item = null, forType = 'notice') => {
    setModalType(type);
    setModalFor(forType);
    setValidationError('');
    if (type === 'add') {
      resetForm();
    } else if (type === 'modify' && item) {
      setSelectedItem(item);
      setFormData({
        title: item.title || '',
        message: item.message || '',
        date: item.date ? String(item.date).split('T')[0] : getTodayDate(),
        applicable_class: item.applicable_class || 'all',
        type: item.type || 'event',
      });
    }
    setIsModalOpen(true);
  };

  const filteredNotifications = Array.isArray(notifications)
    ? notifications.filter((n) => {
        const term = searchTerm.toLowerCase();
        return (
          (n.title || '').toLowerCase().includes(term) ||
          (n.message || '').toLowerCase().includes(term)
        );
      })
    : [];

  const filteredEvents = Array.isArray(events)
    ? events.filter((e) => {
        const term = searchTerm.toLowerCase();
        return (
          (e.title || '').toLowerCase().includes(term) ||
          (e.message || '').toLowerCase().includes(term)
        );
      })
    : [];

  const currentData = activeTab === 'notifications' ? filteredNotifications : filteredEvents;
  const isDataEmpty = currentData.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 flex items-center gap-2 sm:gap-3">
            <Megaphone className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0" />
            <span className="truncate">Communication & Events</span>
          </h1>
          <p className="text-white/60 text-sm sm:text-base">Manage notifications, tours, and school functions</p>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 sm:flex-initial px-3 sm:px-6 py-2.5 rounded-xl font-semibold transition text-sm sm:text-base ${
              activeTab === 'notifications'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
            }`}
          >
            <Bell className="inline w-4 h-4 mr-1 sm:mr-2" />
            Notifications ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex-1 sm:flex-initial px-3 sm:px-6 py-2.5 rounded-xl font-semibold transition text-sm sm:text-base ${
              activeTab === 'events'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
            }`}
          >
            <Calendar className="inline w-4 h-4 mr-1 sm:mr-2" />
            Events ({events.length})
          </button>
        </div>

        <div className="mb-4 sm:mb-6">
          {activeTab === 'notifications' ? (
            <button
              onClick={() => openModal('add', null, 'notice')}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
            >
              <Plus size={18} /> Add Notice
            </button>
          ) : (
            <button
              onClick={() => openModal('add', null, 'event')}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition"
            >
              <CalendarPlus size={18} /> Add Event
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="flex-1 sm:min-w-[200px] relative">
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Title</th>
                  <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Message</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Date</th>
                  <th className="hidden sm:table-cell px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Class</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-white text-xs sm:text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-white/60">Loading...</td></tr>
                ) : isDataEmpty ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-white/60">
                      {searchTerm ? `No ${activeTab} match your search` : `No ${activeTab} found`}
                    </td>
                  </tr>
                ) : (
                  currentData.map((item, idx) => {
                    const isActive = (item.status || 'Active') === 'Active';
                    return (
                    <tr key={item.id || idx} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 sm:px-4 py-3 text-white text-xs sm:text-sm font-medium">
                        <div>{item.title || '-'}</div>
                        <div className="md:hidden text-white/60 text-xs mt-1 line-clamp-2">{item.message || ''}</div>
                      </td>
                      <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm max-w-xs truncate">{item.message || '-'}</td>
                      <td className="px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm whitespace-nowrap">{formatDate(item.date)}</td>
                      <td className="hidden sm:table-cell px-3 sm:px-4 py-3 text-white/80 text-xs sm:text-sm">{item.applicable_class || 'all'}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(item)}
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
                          {/* ✅ NEW: View button */}
                          <button
                            onClick={() => setViewItem(item)}
                            className="p-1.5 rounded-lg bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 transition"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openModal('modify', item, activeTab === 'notifications' ? 'notice' : 'event')}
                            className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, activeTab === 'notifications' ? 'notice' : 'event')}
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
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 sm:p-8 w-full max-w-lg border border-white/20 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {modalType === 'add'
                    ? `Add New ${modalFor === 'notice' ? 'Notice' : 'Event'}`
                    : `Modify ${modalFor === 'notice' ? 'Notice' : 'Event'}`}
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

              <div className="space-y-4">
                <div>
                  <label className="text-white/70 text-sm block mb-1">Title *</label>
                  <input
                    type="text"
                    placeholder={`Enter ${modalFor} title`}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Message *</label>
                  <textarea
                    placeholder={`Enter ${modalFor} message`}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 min-h-[100px]"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    min={getTodayDate()}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                {modalFor === 'event' && (
                  <div>
                    <label className="text-white/70 text-sm block mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
                    >
                      <option value="event"     style={OPTION_STYLE}>Event</option>
                      <option value="tour"      style={OPTION_STYLE}>Tour</option>
                      <option value="function"  style={OPTION_STYLE}>Function</option>
                      <option value="workshop"  style={OPTION_STYLE}>Workshop</option>
                      <option value="other"     style={OPTION_STYLE}>Other</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-white/70 text-sm block mb-1">Applicable Class</label>
                  <select
                    value={formData.applicable_class}
                    onChange={(e) => setFormData({ ...formData, applicable_class: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
                  >
                    <option value="all" style={OPTION_STYLE}>All Classes</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                      <option key={num} value={num} style={OPTION_STYLE}>Class {num}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={handleAdd}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
                >
                  {modalType === 'add' ? `Add ${modalFor === 'notice' ? 'Notice' : 'Event'}` : 'Save Changes'}
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

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === 'notice' ? 'Notice' : 'Event'}?`}
        message={`Are you sure you want to delete this ${deleteTarget?.type === 'notice' ? 'notice' : 'event'}? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ✅ NEW: Full View Modal */}
      <NotificationViewModal
        isOpen={!!viewItem}
        notification={viewItem}
        onClose={() => setViewItem(null)}
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