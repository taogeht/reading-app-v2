import React, { useState, useEffect } from 'react';
import { X, Building, Save, AlertCircle, GraduationCap } from 'lucide-react';
import { classService, profileService } from '../../services/databaseService';
import type { Class } from '../../services/databaseService';
import type { UserProfile } from '../../contexts/AuthContext';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData?: Class | null;
  onSave: () => void;
}

interface ClassFormData {
  name: string;
  description: string;
  grade_level: number;
  teacher_id: string;
  is_active: boolean;
  max_students: number;
  school_year: string;
}

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  classData,
  onSave
}) => {
  const [formData, setFormData] = useState<ClassFormData>({
    name: '',
    description: '',
    grade_level: 1,
    teacher_id: '',
    is_active: true,
    max_students: 25,
    school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
  });
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isEditing = !!classData;

  // Load teachers when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTeachers();
    }
  }, [isOpen]);

  // Initialize form data when classData prop changes
  useEffect(() => {
    if (classData) {
      setFormData({
        name: classData.name,
        description: classData.description || '',
        grade_level: classData.grade_level,
        teacher_id: classData.teacher_id || '',
        is_active: classData.is_active,
        max_students: classData.max_students || 25,
        school_year: classData.school_year || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
      });
    } else {
      setFormData({
        name: '',
        description: '',
        grade_level: 1,
        teacher_id: '',
        is_active: true,
        max_students: 25,
        school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
      });
    }
    setError(null);
    setValidationErrors({});
  }, [classData, isOpen]);

  const loadTeachers = async () => {
    try {
      const teachersData = await profileService.getTeachers();
      setTeachers(teachersData);
    } catch (err) {
      console.error('Error loading teachers:', err);
    }
  };

  // Validation function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Class name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Class name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      errors.name = 'Class name must be less than 50 characters';
    }

    if (!formData.teacher_id) {
      errors.teacher_id = 'Please select a teacher';
    }

    if (formData.grade_level < 1 || formData.grade_level > 12) {
      errors.grade_level = 'Grade level must be between 1 and 12';
    }

    if (formData.max_students < 1) {
      errors.max_students = 'Maximum students must be at least 1';
    } else if (formData.max_students > 100) {
      errors.max_students = 'Maximum students cannot exceed 100';
    }

    if (!formData.school_year.trim()) {
      errors.school_year = 'School year is required';
    } else if (!/^\d{4}-\d{4}$/.test(formData.school_year)) {
      errors.school_year = 'School year must be in format YYYY-YYYY (e.g., 2024-2025)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditing && classData) {
        // Update existing class
        await classService.updateClass(classData.id, formData);
      } else {
        // Create new class
        await classService.createClass({
          name: formData.name,
          grade_level: formData.grade_level,
          teacher_id: formData.teacher_id,
          school_year: formData.school_year,
          description: formData.description,
          max_students: formData.max_students,
        });
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Error saving class:', err);
      setError(err.message || 'Failed to save class');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ClassFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg">
              <Building className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">
              {isEditing ? 'Edit Class' : 'Add New Class'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Class Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Class Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g., Mrs. Smith's Class"
            />
            {validationErrors.name && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of the class"
            />
          </div>

          {/* Grade Level */}
          <div>
            <label htmlFor="grade_level" className="block text-sm font-medium text-gray-700 mb-1">
              Grade Level
            </label>
            <select
              id="grade_level"
              value={formData.grade_level}
              onChange={(e) => handleInputChange('grade_level', parseInt(e.target.value))}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.grade_level ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                <option key={grade} value={grade}>
                  Grade {grade}
                </option>
              ))}
            </select>
            {validationErrors.grade_level && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.grade_level}</p>
            )}
          </div>

          {/* Teacher Assignment */}
          <div>
            <label htmlFor="teacher_id" className="block text-sm font-medium text-gray-700 mb-1">
              Assigned Teacher
            </label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <select
                id="teacher_id"
                value={formData.teacher_id}
                onChange={(e) => handleInputChange('teacher_id', e.target.value)}
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.teacher_id ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name} ({teacher.email})
                  </option>
                ))}
              </select>
            </div>
            {validationErrors.teacher_id && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.teacher_id}</p>
            )}
          </div>

          {/* School Year */}
          <div>
            <label htmlFor="school_year" className="block text-sm font-medium text-gray-700 mb-1">
              School Year
            </label>
            <input
              type="text"
              id="school_year"
              value={formData.school_year}
              onChange={(e) => handleInputChange('school_year', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.school_year ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="2024-2025"
            />
            {validationErrors.school_year && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.school_year}</p>
            )}
          </div>

          {/* Maximum Students */}
          <div>
            <label htmlFor="max_students" className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Students
            </label>
            <input
              type="number"
              id="max_students"
              min="1"
              max="100"
              value={formData.max_students}
              onChange={(e) => handleInputChange('max_students', parseInt(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.max_students ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="25"
            />
            {validationErrors.max_students && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.max_students}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Set the maximum number of students that can be enrolled in this class
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => handleInputChange('is_active', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Class is active
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Update Class' : 'Create Class'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};