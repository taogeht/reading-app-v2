import React, { useState, useEffect } from 'react';
import { X, Users, Mail, Save, AlertCircle, Eye, Shuffle } from 'lucide-react';
import { profileService, classService } from '../../services/databaseService';
import type { UserProfile } from '../../contexts/AuthContext';
import type { Class } from '../../services/databaseService';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: UserProfile | null;
  onSave: () => void;
}

interface StudentFormData {
  full_name: string;
  email: string;
  class_id: string;
  visual_password_id?: string;
}

interface VisualPassword {
  id: string;
  category: string;
  name: string;
  image_url: string;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onSave
}) => {
  const [formData, setFormData] = useState<StudentFormData>({
    full_name: '',
    email: '',
    class_id: ''
  });
  const [classes, setClasses] = useState<Class[]>([]);
  const [visualPasswords, setVisualPasswords] = useState<VisualPassword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const isEditing = !!student;

  // Load classes and visual passwords when modal opens
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
        email: student.email,
        class_id: student.class_id || '',
        visual_password_id: student.visual_password_id || ''
      });
    } else {
      setFormData({
        full_name: '',
        email: '',
        class_id: ''
      });
    }
    setError(null);
    setValidationErrors({});
  }, [student, isOpen]);

  const loadClasses = async () => {
    try {
      const classesData = await classService.getClasses();
      setClasses(classesData);
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  };

  const loadVisualPasswords = async () => {
    try {
      // Mock visual passwords - in real app, this would come from the database
      const mockPasswords: VisualPassword[] = [
        { id: 'cat', category: 'animals', name: 'Cat', image_url: '🐱' },
        { id: 'dog', category: 'animals', name: 'Dog', image_url: '🐶' },
        { id: 'star', category: 'shapes', name: 'Star', image_url: '⭐' },
        { id: 'heart', category: 'shapes', name: 'Heart', image_url: '💖' },
        { id: 'sun', category: 'objects', name: 'Sun', image_url: '☀️' },
        { id: 'flower', category: 'objects', name: 'Flower', image_url: '🌸' },
        { id: 'red', category: 'colors', name: 'Red', image_url: '🔴' },
        { id: 'blue', category: 'colors', name: 'Blue', image_url: '🔵' }
      ];
      setVisualPasswords(mockPasswords);
    } catch (err) {
      console.error('Error loading visual passwords:', err);
    }
  };

  // Generate random visual password
  const generateRandomPassword = () => {
    if (visualPasswords.length > 0) {
      const randomPassword = visualPasswords[Math.floor(Math.random() * visualPasswords.length)];
      setFormData(prev => ({ ...prev, visual_password_id: randomPassword.id }));
    }
  };

  // Validation function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.class_id) {
      errors.class_id = 'Please select a class';
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
          email: formData.email,
          class_id: formData.class_id,
          visual_password_id: formData.visual_password_id
        });
      } else {
        // Create new student
        await profileService.createStudent({
          full_name: formData.full_name,
          email: formData.email,
          class_id: formData.class_id,
          visual_password_id: formData.visual_password_id
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

  const getSelectedPassword = () => {
    return visualPasswords.find(p => p.id === formData.visual_password_id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg">
              <Users className="h-5 w-5 text-white" />
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

          {/* Full Name */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleInputChange('full_name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.full_name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter student's full name"
            />
            {validationErrors.full_name && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.full_name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="student@school.edu"
              />
            </div>
            {validationErrors.email && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.email}</p>
            )}
          </div>

          {/* Class Selection */}
          <div>
            <label htmlFor="class_id" className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              id="class_id"
              value={formData.class_id}
              onChange={(e) => handleInputChange('class_id', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.class_id ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="">Select a class</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} - Grade {classItem.grade_level}
                </option>
              ))}
            </select>
            {validationErrors.class_id && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.class_id}</p>
            )}
          </div>

          {/* Visual Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visual Password
            </label>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <select
                  value={formData.visual_password_id || ''}
                  onChange={(e) => handleInputChange('visual_password_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a visual password</option>
                  {visualPasswords.map((password) => (
                    <option key={password.id} value={password.id}>
                      {password.name} ({password.category})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                title="Generate random password"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </div>
            
            {/* Visual Password Preview */}
            {getSelectedPassword() && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span className="text-2xl">{getSelectedPassword()?.image_url}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700">{getSelectedPassword()?.name}</p>
                  <p className="text-xs text-gray-500">Category: {getSelectedPassword()?.category}</p>
                </div>
              </div>
            )}
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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