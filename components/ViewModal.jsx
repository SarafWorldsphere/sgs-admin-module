'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Reusable read-only "view details" modal.
 * Sections: array of { title, fields: [{ label, value }] }
 */
const ViewModal = ({
  isOpen,
  title = 'Details',
  sections = [],
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
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
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10">
              <h3 className="text-lg sm:text-xl font-semibold text-white truncate">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
              {sections.map((section, si) => (
                <div key={si}>
                  {section.title && (
                    <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">
                      {section.title}
                    </h4>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {section.fields.map((field, fi) => (
                      <div key={fi} className={field.fullWidth ? 'sm:col-span-2' : ''}>
                        <p className="text-xs text-white/50 mb-0.5">{field.label}</p>
                        <p className="text-sm text-white break-words">
                          {field.value !== null && field.value !== undefined && field.value !== '' && field.value !== '-'
                            ? field.value
                            : <span className="text-white/40 italic">Not provided</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-white/10">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ViewModal;