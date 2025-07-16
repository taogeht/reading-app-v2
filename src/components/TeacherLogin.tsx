import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useAuth } from '../contexts/UnifiedAuthContext';

interface TeacherLoginProps {
  onSuccess?: () => void;
  onBackToMain?: () => void;
}

export const TeacherLogin: React.FC<TeacherLoginProps> = ({ onSuccess, onBackToMain }) => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('🔐 Teacher login attempt:', { email: formData.email });
      
      // Simple direct authentication with email and password
      const { error: signInError } = await signIn({
        email: formData.email,
        password: formData.password
      });

      if (signInError) {
        console.error('❌ Authentication error:', signInError);
        if (signInError.includes('Invalid email or password')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (signInError.includes('Email not confirmed')) {
          setError('Your account email is not confirmed. Please contact your administrator.');
        } else if (signInError.includes('too many requests')) {
          setError('Too many login attempts. Please wait a few minutes before trying again.');
        } else {
          setError(`Sign in failed: ${signInError}`);
        }
      } else {
        console.log('✅ Teacher login successful');
        if (onSuccess) onSuccess();
        navigate('/teacher');
      }
    } catch (err) {
      console.error('💥 Unexpected teacher login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="p-3 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <GraduationCap className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">
          Teacher Login
        </h2>
        <p className="text-gray-600 mt-2">
          Access your teacher dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors"
              placeholder="teacher@school.edu"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-colors"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Signing In...
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <LogIn className="h-5 w-5 mr-2" />
              Sign In
            </div>
          )}
        </button>

        {/* Back to main login */}
        {onBackToMain && (
          <div className="text-center">
            <button
              type="button"
              onClick={onBackToMain}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back to main login
            </button>
          </div>
        )}
      </form>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600 text-center">
          <strong>Teachers:</strong> Use the email and password provided by your administrator. 
          If you don't have login credentials, contact your school's admin.
        </p>
      </div>
    </div>
  );
};