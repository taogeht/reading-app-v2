import React, { useState, useEffect } from 'react';
import { X, User, GraduationCap, Save, AlertCircle, Smile } from 'lucide-react';
import { profileService, classService } from '../../services/railwayDatabaseService';
import type { UserProfile, Class, VisualPassword } from '../../services/railwayDatabaseService';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: UserProfile | null;
  onSave: () => void;
}

interface StudentFormData {
  full_name: string;
  class_id: string;
  visual_password_id: string;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onSave
}) => {
  const [formData, setFormData] = useState<StudentFormData>({
    full_name: '',
    class_id: '',
    visual_password_id: ''
  });
  const [classes, setClasses] = useState<Class[]>([]);
  const [visualPasswords, setVisualPasswords] = useState<VisualPassword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isEditing = !!student;

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadClasses();
      loadVisualPasswords();
    }
  }, [isOpen]);

  // Initialize form data when student prop changes
  useEffect(() => {
    if (student) {
      setFormData({
        full_name: student.full_name || '',
        class_id: student.class_id || '',
        visual_password_id: student.visual_password_id || ''
      });
    } else {
      setFormData({
        full_name: '',
        class_id: '',
        visual_password_id: ''
      });
    }
    setError(null);
    setValidationErrors({});
  }, [student, isOpen]);

  const loadClasses = async () => {
    try {
      const classesData = await classService.getAll();
      // Filter to only active classes
      setClasses(classesData.filter(c => c.is_active));
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  };

  const loadVisualPasswords = async () => {
    try {
      const response = await fetch('/api/visual-passwords', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const result = await response.json();
      if (result.status === 200) {
        setVisualPasswords(result.data || []);
      }
    } catch (err) {
      console.error('Error loading visual passwords:', err);
    }
  };

  // Validation function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Student name is required';
    } else if (formData.full_name.length < 2) {
      errors.full_name = 'Name must be at least 2 characters';
    } else if (formData.full_name.length > 50) {
      errors.full_name = 'Name must be less than 50 characters';
    }

    if (!formData.class_id) {
      errors.class_id = 'Please select a class';
    }

    if (!formData.visual_password_id) {
      errors.visual_password_id = 'Please select a visual password';
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
      if (isEditing && student) {
        // Update existing student
        await profileService.updateStudent(student.id, {
          full_name: formData.full_name,
          class_id: formData.class_id,
          visual_password_id: formData.visual_password_id
        });
      } else {
        // Create new student
        await profileService.create({
          full_name: formData.full_name,
          role: 'student',
          class_id: formData.class_id,
          visual_password_id: formData.visual_password_id,
          email: `student.${Date.now()}@temp.local`, // Temporary email that won't be used
          username: `student_${Date.now()}`
        });
      }

      onSave();
      onClose();
    } catch (err: any) {
      console.error('Error saving student:', err);
      setError(err.message || 'Failed to save student');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof StudentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Group visual passwords by category
  const groupedVisualPasswords = visualPasswords.reduce((groups, vp) => {
    const category = vp.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(vp);
    return groups;
  }, {} as Record<string, VisualPassword[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">
              {isEditing ? 'Edit Student' : 'Add New Student'}
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

          {/* Student Name */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
              Student Name
            </label>
            <input
              type="text"
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                validationErrors.full_name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter student's full name"
            />
            {validationErrors.full_name && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.full_name}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              This is the name the student will select when logging in
            </p>
          </div>

          {/* Class Assignment */}
          <div>
            <label htmlFor="class_id" className="block text-sm font-medium text-gray-700 mb-1">
              Assign to Class
            </label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <select
                id="class_id"
                value={formData.class_id}
                onChange={(e) => handleInputChange('class_id', e.target.value)}
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                  validationErrors.class_id ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} (Grade {cls.grade_level})
                  </option>
                ))}
              </select>
            </div>
            {validationErrors.class_id && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.class_id}</p>
            )}
          </div>

          {/* Visual Password Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visual Password
            </label>
            <div className="space-y-3">
              {Object.entries(groupedVisualPasswords).map(([category, passwords]) => (
                <div key={category}>
                  <h4 className="text-xs font-medium text-gray-600 uppercase mb-2">
                    {category}
                  </h4>
                  <div className="grid grid-cols-6 gap-2">
                    {passwords.map((vp) => (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => handleInputChange('visual_password_id', vp.id)}
                        className={`
                          p-3 rounded-lg border-2 transition-all hover:scale-105 active:scale-95
                          ${formData.visual_password_id === vp.id 
                            ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500 ring-opacity-50' 
                            : 'border-gray-200 hover:border-purple-300'
                          }
                        `}
                        title={vp.name}
                      >
                        <span className="text-2xl block">{vp.display_emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {validationErrors.visual_password_id && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.visual_password_id}</p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Student will click on this icon to log in (no password needed)
            </p>
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Update Student' : 'Create Student'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};