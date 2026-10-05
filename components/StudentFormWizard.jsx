'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { isValidName, isValidPhone, normalizePhone, isValidEmail, isGmailEmail } from '../lib/validators';
import { formatClassName } from '../lib/format-class-name';
import AlertModal from './AlertModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/admin/api';

const SECTION_OPTIONS = ['A', 'B', 'C', 'D'];

const StudentFormWizard = ({ isOpen, onClose, onSuccess, editData, theme = 'dark' }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [formData, setFormData] = useState({
    admission_no: '',
    full_name: '',
    class_id: '',
    section: '',
    roll_no: '',
    student_phone: '',
    student_email: '',
    parent1_name: '',
    parent1_phone: '',
    parent1_email: '',
    parent2_name: '',
    parent2_phone: '',
    parent2_email: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
  });
  const [errors, setErrors] = useState({});
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '', variant: 'info' });

  const showAlert = (message, variant = 'error', title = 'Error') =>
    setAlertState({ isOpen: true, title, message, variant });
  const closeAlert = () =>
    setAlertState({ isOpen: false, title: '', message: '', variant: 'info' });

  useEffect(() => {
    if (isOpen) fetchAvailableClasses();
  }, [isOpen]);

  const fetchAvailableClasses = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/classes`);
      if (response.ok) {
        const data = await response.json();
        setAvailableClasses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  useEffect(() => {
    if (isOpen && !editData) {
      setFormData({
        admission_no: '', full_name: '', class_id: '', section: '', roll_no: '',
        student_phone: '', student_email: '',
        parent1_name: '', parent1_phone: '', parent1_email: '',
        parent2_name: '', parent2_phone: '', parent2_email: '',
        guardian_name: '', guardian_phone: '', guardian_email: '',
      });
      setStep(1);
      setErrors({});
      generateStudentId();
    }
  }, [isOpen, editData]);

  useEffect(() => {
    if (editData) {
      setFormData({
        admission_no: editData.admission_no || '',
        full_name: editData.full_name || '',
        class_id: editData.class_id || '',
        section: editData.section || '',
        roll_no: editData.roll_no || '',
        student_phone: editData.student_phone || '',
        student_email: editData.student_email || '',
        parent1_name: editData.parent1_name || '',
        parent1_phone: editData.parent1_phone || '',
        parent1_email: editData.parent1_email || '',
        parent2_name: editData.parent2_name || '',
        parent2_phone: editData.parent2_phone || '',
        parent2_email: editData.parent2_email || '',
        guardian_name: editData.guardian_name || '',
        guardian_phone: editData.guardian_phone || '',
        guardian_email: editData.guardian_email || '',
      });
    }
  }, [editData]);

  const generateStudentId = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/generate-id?type=student`);
      const data = await response.json();
      if (data.id) setFormData((prev) => ({ ...prev, admission_no: data.id }));
    } catch (error) {
      console.error('Error generating ID:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name.includes('phone')) v = value.replace(/[^\d]/g, '').slice(0, 10);
    if (name === 'roll_no') v = value.replace(/[^\d]/g, '').slice(0, 3);
    // ✅ Admission Number: digits only, max 10 characters
    if (name === 'admission_no') v = value.replace(/[^\d]/g, '').slice(0, 10);

    if (name === 'class_id') {
      setFormData((prev) => ({ ...prev, class_id: v, section: '' }));
      if (errors[name] || errors.section) setErrors((prev) => ({ ...prev, [name]: '', section: '' }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: v }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateStep = (stepNumber) => {
    const e = {};

    if (stepNumber === 1) {
      if (!formData.admission_no) e.admission_no = 'Student ID is required';
      else if (!/^\d+$/.test(String(formData.admission_no).trim()))
        e.admission_no = 'Admission Number must contain digits only';
      if (!formData.full_name) e.full_name = 'Student Name is required';
      else if (!isValidName(formData.full_name))
        e.full_name = 'Name can only contain letters, spaces, dots, hyphens and apostrophes';
      if (!formData.class_id) e.class_id = 'Please select a class';
      if (!formData.section) e.section = 'Section is required';
      if (formData.student_email) {
        if (!isValidEmail(formData.student_email)) e.student_email = 'Please enter a valid email address';
        else if (!isGmailEmail(formData.student_email)) e.student_email = 'Only @gmail.com addresses are allowed';
      }
      if (formData.student_phone && !isValidPhone(formData.student_phone))
        e.student_phone = 'Enter a valid 10-digit mobile number';
      if (formData.roll_no && String(formData.roll_no).length > 3)
        e.roll_no = 'Roll number must be 1-3 digits';
    }

    if (stepNumber === 2) {
      if (!formData.parent1_name) e.parent1_name = 'Parent 1 Name is required';
      else if (!isValidName(formData.parent1_name))
        e.parent1_name = 'Name can only contain letters, spaces, dots, hyphens and apostrophes';
      if (!formData.parent1_phone) e.parent1_phone = 'Parent 1 Phone is required';
      else if (!isValidPhone(formData.parent1_phone))
        e.parent1_phone = 'Enter a valid 10-digit mobile number';

      if (formData.parent1_email && !isValidEmail(formData.parent1_email))
        e.parent1_email = 'Please enter a valid email address (e.g., name@domain.com)';

      if (formData.parent2_name && !isValidName(formData.parent2_name))
        e.parent2_name = 'Name can only contain letters, spaces, dots, hyphens and apostrophes';
      if (formData.parent2_phone && !isValidPhone(formData.parent2_phone))
        e.parent2_phone = 'Enter a valid 10-digit mobile number';

      if (formData.parent2_email && !isValidEmail(formData.parent2_email))
        e.parent2_email = 'Please enter a valid email address (e.g., name@domain.com)';
    }

    if (stepNumber === 3) {
      if (formData.guardian_name && !isValidName(formData.guardian_name))
        e.guardian_name = 'Name can only contain letters, spaces, dots, hyphens and apostrophes';
      if (formData.guardian_phone && !isValidPhone(formData.guardian_phone))
        e.guardian_phone = 'Enter a valid 10-digit mobile number';
      if (formData.guardian_email) {
        if (!isValidEmail(formData.guardian_email)) e.guardian_email = 'Please enter a valid email address';
        else if (!isGmailEmail(formData.guardian_email)) e.guardian_email = 'Only @gmail.com addresses are allowed';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => { if (validateStep(step)) setStep(step + 1); };
  const prevStep = () => setStep(step - 1);

  const handleCancel = () => {
    setFormData({
      admission_no: '', full_name: '', class_id: '', section: '', roll_no: '',
      student_phone: '', student_email: '',
      parent1_name: '', parent1_phone: '', parent1_email: '',
      parent2_name: '', parent2_phone: '', parent2_email: '',
      guardian_name: '', guardian_phone: '', guardian_email: '',
    });
    setStep(1);
    setErrors({});
    onClose();
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/students`;
      const method = editData ? 'PUT' : 'POST';

      const payload = {
        admission_no: formData.admission_no,
        full_name: formData.full_name.trim(),
        class_id: formData.class_id ? parseInt(formData.class_id) : null,
        section: formData.section,
        roll_no: formData.roll_no || null,
        parent1_name: formData.parent1_name?.trim() || null,
        parent1_phone: formData.parent1_phone ? normalizePhone(formData.parent1_phone) : null,
        parent1_email: formData.parent1_email || null,
        parent2_name: formData.parent2_name?.trim() || null,
        parent2_phone: formData.parent2_phone ? normalizePhone(formData.parent2_phone) : null,
        parent2_email: formData.parent2_email || null,
        student_phone: formData.student_phone ? normalizePhone(formData.student_phone) : null,
        student_email: formData.student_email || null,
        guardian_name: formData.guardian_name?.trim() || null,
        guardian_phone: formData.guardian_phone ? normalizePhone(formData.guardian_phone) : null,
        guardian_email: formData.guardian_email || null,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        onSuccess();
        handleCancel();
      } else {
        showAlert(data.error || 'Failed to save student', 'error', 'Could Not Save');
      }
    } catch (error) {
      console.error('Error:', error);
      showAlert('A network error occurred. Please try again.', 'error', 'Network Error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const inputBg = isDark ? 'bg-white/10' : 'bg-gray-50';
  const inputBorder = isDark ? 'border-white/20' : 'border-gray-300';
  const inputText = isDark ? 'text-white' : 'text-gray-900';
  const labelColor = isDark ? 'text-white/80' : 'text-gray-700';
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200';
  const placeholderColor = isDark ? 'placeholder-white/60' : 'placeholder-gray-400';

  const sectionsForSelectedClass = (() => {
    if (formData.section && !SECTION_OPTIONS.includes(formData.section)) {
      return [formData.section, ...SECTION_OPTIONS];
    }
    return [...SECTION_OPTIONS];
  })();

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`w-full max-w-3xl ${bgColor} rounded-2xl shadow-2xl max-h-[90vh] flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}>
                <div>
                  <h3 className={`text-xl font-semibold ${textColor}`}>
                    {editData ? 'Edit Student' : 'Add New Student'}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Step {step} of 3</p>
                </div>
                <button onClick={handleCancel} className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition`}>
                  <X className={`w-5 h-5 ${isDark ? 'text-white/60' : 'text-gray-500'}`} />
                </button>
              </div>

              <div className="px-6 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium ${step >= 1 ? 'text-blue-400' : isDark ? 'text-white/40' : 'text-gray-400'}`}>Student Info</span>
                  <span className={`text-xs font-medium ${step >= 2 ? 'text-blue-400' : isDark ? 'text-white/40' : 'text-gray-400'}`}>Parents Info</span>
                  <span className={`text-xs font-medium ${step >= 3 ? 'text-blue-400' : isDark ? 'text-white/40' : 'text-gray-400'}`}>Guardian Info</span>
                </div>
                <div className={`w-full h-2 ${isDark ? 'bg-white/10' : 'bg-gray-200'} rounded-full`}>
                  <div
                    className="h-2 transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                    style={{ width: `${((step - 1) / 2) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                {step === 1 && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                    <h4 className={`text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}>Student Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>
                          Admission Number * <span className="text-xs text-white/40">(digits only{editData ? ', read-only' : ''})</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={10}
                          name="admission_no"
                          value={formData.admission_no}
                          onChange={handleChange}
                          readOnly={!!editData}
                          disabled={!!editData}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.admission_no ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500 ${editData ? 'cursor-not-allowed' : ''}`}
                          placeholder="e.g., 12345"
                        />
                        {errors.admission_no && <p className="mt-1 text-xs text-red-500">{errors.admission_no}</p>}
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>Student Name *</label>
                        <input
                          type="text"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.full_name ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                          placeholder="e.g., John Doe"
                        />
                        {errors.full_name && <p className="mt-1 text-xs text-red-500">{errors.full_name}</p>}
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>Class *</label>
                        <select
                          name="class_id"
                          value={formData.class_id}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.class_id ? 'border-red-500' : inputBorder} rounded-lg ${inputText} focus:outline-none focus:border-blue-500`}
                        >
                          <option value="" style={{ color: "#111827", backgroundColor: "#ffffff" }}>Select Class</option>
                          {availableClasses.map((cls, i) => (
                            <option key={cls.class_id || i} value={cls.class_id} style={{ color: "#111827", backgroundColor: '#ffffff' }}>
                              {formatClassName(cls.class_name)}
                            </option>
                          ))}
                        </select>
                        {errors.class_id && <p className="mt-1 text-xs text-red-500">{errors.class_id}</p>}
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>Section *</label>
                        <select
                          name="section"
                          value={formData.section}
                          onChange={handleChange}
                          disabled={!formData.class_id}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.section ? 'border-red-500' : inputBorder} rounded-lg ${inputText} focus:outline-none focus:border-blue-500 ${!formData.class_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <option value="" style={{ color: "#111827", backgroundColor: "#ffffff" }}>
                            {formData.class_id ? 'Select Section' : 'Select Class first'}
                          </option>
                          {sectionsForSelectedClass.map((sec) => (
                            <option key={sec} value={sec} style={{ color: "#111827", backgroundColor: '#ffffff' }}>
                              {sec}
                            </option>
                          ))}
                        </select>
                        {errors.section && <p className="mt-1 text-xs text-red-500">{errors.section}</p>}
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>Roll Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={3}
                          name="roll_no"
                          value={formData.roll_no}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.roll_no ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                          placeholder="e.g., 1 (digits only)"
                        />
                        {errors.roll_no && <p className="mt-1 text-xs text-red-500">{errors.roll_no}</p>}
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>Student Phone</label>
                        <input
                          type="tel"
                          name="student_phone"
                          value={formData.student_phone}
                          onChange={handleChange}
                          maxLength={10}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.student_phone ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                          placeholder="10-digit mobile"
                        />
                        {errors.student_phone && <p className="mt-1 text-xs text-red-500">{errors.student_phone}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className={`block text-sm font-medium ${labelColor}`}>
                          Student Email <span className="text-xs text-white/40">(gmail only)</span>
                        </label>
                        <input
                          type="email"
                          name="student_email"
                          value={formData.student_email}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.student_email ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                          placeholder="student@gmail.com"
                        />
                        {errors.student_email && <p className="mt-1 text-xs text-red-500">{errors.student_email}</p>}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-6">
                    <h4 className={`text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}>Parents Information</h4>

                    <div className={`p-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-lg border ${borderColor}`}>
                      <h5 className={`text-sm font-medium ${isDark ? 'text-white/60' : 'text-gray-600'} mb-3`}>Parent 1</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-sm font-medium ${labelColor}`}>Name *</label>
                          <input
                            type="text"
                            name="parent1_name"
                            value={formData.parent1_name}
                            onChange={handleChange}
                            className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.parent1_name ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                            placeholder="e.g., John Doe"
                          />
                          {errors.parent1_name && <p className="mt-1 text-xs text-red-500">{errors.parent1_name}</p>}
                        </div>
                        <div>
                          <label className={`block text-sm font-medium ${labelColor}`}>Phone *</label>
                          <input
                            type="tel"
                            name="parent1_phone"
                            value={formData.parent1_phone}
                            onChange={handleChange}
                            maxLength={10}
                            className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.parent1_phone ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                            placeholder="10-digit mobile"
                          />
                          {errors.parent1_phone && <p className="mt-1 text-xs text-red-500">{errors.parent1_phone}</p>}
                        </div>
                        <div className="md:col-span-2">
                          <label className={`block text-sm font-medium ${labelColor}`}>Email</label>
                          <input
                            type="email"
                            name="parent1_email"
                            value={formData.parent1_email}
                            onChange={handleChange}
                            className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.parent1_email ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                            placeholder="parent1@email.com"
                          />
                          {errors.parent1_email && <p className="mt-1 text-xs text-red-500">{errors.parent1_email}</p>}
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'} rounded-lg border ${borderColor}`}>
                      <h5 className={`text-sm font-medium ${isDark ? 'text-white/60' : 'text-gray-600'} mb-3`}>
                        Parent 2 <span className="text-xs text-white/40">(Optional)</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-sm font-medium ${labelColor}`}>Name</label>
                          <input
                            type="text"
                            name="parent2_name"
                            value={formData.parent2_name}
                            onChange={handleChange}
                            className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.parent2_name ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                            placeholder="e.g., Jane Doe"
                          />
                          {errors.parent2_name && <p className="mt-1 text-xs text-red-500">{errors.parent2_name}</p>}
                        </div>
                        <div>
                          <label className={`block text-sm font-medium ${labelColor}`}>Phone</label>
                          <input
                            type="tel"
                            name="parent2_phone"
                            value={formData.parent2_phone}
                            onChange={handleChange}
                            maxLength={10}
                            className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.parent2_phone ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                            placeholder="10-digit mobile"
                          />
                          {errors.parent2_phone && <p className="mt-1 text-xs text-red-500">{errors.parent2_phone}</p>}
                        </div>
                        <div className="md:col-span-2">
                          <label className={`block text-sm font-medium ${labelColor}`}>Email</label>
                          <input
                            type="email"
                            name="parent2_email"
                            value={formData.parent2_email}
                            onChange={handleChange}
                            className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.parent2_email ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                            placeholder="parent2@email.com"
                          />
                          {errors.parent2_email && <p className="mt-1 text-xs text-red-500">{errors.parent2_email}</p>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-4">
                    <h4 className={`text-sm font-medium ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                      Guardian Information <span className="text-xs text-white/40">(Optional)</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>Guardian Name</label>
                        <input
                          type="text"
                          name="guardian_name"
                          value={formData.guardian_name}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.guardian_name ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                          placeholder="e.g., Guardian Name"
                        />
                        {errors.guardian_name && <p className="mt-1 text-xs text-red-500">{errors.guardian_name}</p>}
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${labelColor}`}>Guardian Phone</label>
                        <input
                          type="tel"
                          name="guardian_phone"
                          value={formData.guardian_phone}
                          onChange={handleChange}
                          maxLength={10}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.guardian_phone ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                          placeholder="10-digit mobile"
                        />
                        {errors.guardian_phone && <p className="mt-1 text-xs text-red-500">{errors.guardian_phone}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className={`block text-sm font-medium ${labelColor}`}>
                          Guardian Email <span className="text-xs text-white/40">(gmail only)</span>
                        </label>
                        <input
                          type="email"
                          name="guardian_email"
                          value={formData.guardian_email}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 mt-1 ${inputBg} border ${errors.guardian_email ? 'border-red-500' : inputBorder} rounded-lg ${inputText} ${placeholderColor} focus:outline-none focus:border-blue-500`}
                          placeholder="guardian@gmail.com"
                        />
                        {errors.guardian_email && <p className="mt-1 text-xs text-red-500">{errors.guardian_email}</p>}
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 pt-4 border-t border-white/10">
                  <div className="flex gap-3">
                    {step > 1 && (
                      <button type="button" onClick={prevStep} className="flex items-center gap-2 px-6 py-2.5 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                    )}
                    <button type="button" onClick={handleCancel} className="px-6 py-2.5 bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 transition">
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-3">
                    {step < 3 ? (
                      <button type="button" onClick={nextStep} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition">
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button type="button" onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50">
                        {loading ? (editData ? 'Updating...' : 'Adding...') : editData ? 'Update Student' : 'Add Student'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

export default StudentFormWizard;