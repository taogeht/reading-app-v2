import React, { useState, useEffect } from 'react';
import { X, User, Mail, Save, AlertCircle, Key, Copy, Check } from 'lucide-react';
import { profileService } from '../../services/databaseService';
import type { UserProfile } from '../../contexts/AuthContext';

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher?: UserProfile | null;
  onSave: () => void;
}

interface TeacherFormData {
  full_name: string;
  email: string;
}

interface TeacherCreationResult {
  email: string;
  password: string;
}

export const TeacherModal: React.FC<TeacherModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onSave
}) => {
  const [formData, setFormData] = useState<TeacherFormData>({
    full_name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [creationResult, setCreationResult] = useState<TeacherCreationResult | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const isEditing = !!teacher;

  // Initialize form data when teacher prop changes
  useEffect(() => {
    if (teacher) {
      setFormData({
        full_name: teacher.full_name || '',
        email: teacher.email || ''
      });
    } else {
      setFormData({
        full_name: '',
        email: ''
      });
    }
    setError(null);
    setValidationErrors({});
    setCreationResult(null);
    setPasswordCopied(false);
  }, [teacher, isOpen]);

  // Validation function
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      errors.full_name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    } else if (formData.email.length > 255) {
      errors.email = 'Email address must be less than 255 characters';
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
      if (isEditing && teacher) {
        // Update existing teacher
        await profileService.updateTeacher(teacher.id, {
          full_name: formData.full_name,
          email: formData.email
        });
        onSave();
        onClose();
      } else {
        // Create new teacher with email
        const result = await profileService.createTeacherWithEmail({
          full_name: formData.full_name,
          email: formData.email
        });
        
        // Show the generated credentials
        setCreationResult({
          email: result.email,
          password: result.password
        });
      }
    } catch (err: any) {
      console.error('Error saving teacher:', err);
      setError(err.message || 'Failed to save teacher');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    if (creationResult?.password) {
      try {
        await navigator.clipboard.writeText(creationResult.password);
        setPasswordCopied(true);
        setTimeout(() => setPasswordCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy password:', err);
      }
    }
  };

  const handleFinishCreation = () => {
    onSave();
    onClose();
  };

  const handleInputChange = (field: keyof TeacherFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  // Show credentials after successful creation
  if (creationResult) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg">
                <Key className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">
                Teacher Created Successfully!
              </h2>
            </div>
          </div>

          {/* Credentials Display */}
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Account Created & Auto-Confirmed</span>
              </div>
              <p className="text-sm text-green-700">
                The teacher account has been created and is ready to use immediately.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
                <span className="font-mono text-gray-800">{creationResult.email}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Generated Password
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2">
                  <span className="font-mono text-gray-800">{creationResult.password}</span>
                </div>
                <button
                  onClick={copyPassword}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {passwordCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Share these credentials securely with the teacher
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">Next Steps:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Share the email and password with the teacher</li>
                <li>• Teacher can log in at /teacher using these credentials</li>
                <li>• Teacher can change their password after first login</li>
              </ul>
            </div>

            <button
              onClick={handleFinishCreation}
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">
              {isEditing ? 'Edit Teacher' : 'Add New Teacher'}
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
              placeholder="Enter teacher's full name"
            />
            {validationErrors.full_name && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.full_name}</p>
            )}
          </div>

          {/* Email Address */}
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
                placeholder="teacher@school.edu"
              />
            </div>
            {validationErrors.email && (
              <p className="text-red-600 text-xs mt-1">{validationErrors.email}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {isEditing ? 'Email address for login access' : 'Teacher will use this email to log in. A secure password will be auto-generated.'}
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? 'Update Teacher' : 'Create Teacher'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};