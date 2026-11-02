'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, BookOpen, User } from 'lucide-react';

export default function NotificationViewModal({ isOpen, onClose, notification }) {
  if (!isOpen || !notification) return null;

  // Format date to "12-Sep-2026"
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="w-full max-w-2xl bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/20 shadow-2xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Notification Details</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title */}
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{notification.title}</h3>
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} /> {formatDate(notification.date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen size={14} /> {notification.applicable_class === 'all' ? 'All Classes' : `Class ${notification.applicable_class}`}
                </span>
                {notification.posted_by && (
                  <span className="flex items-center gap-1.5">
                    <User size={14} /> Posted by ID: {notification.posted_by}
                  </span>
                )}
              </div>
            </div>

            {/* Message Body */}
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <p className="text-white/90 whitespace-pre-wrap leading-relaxed">
                {notification.message}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}