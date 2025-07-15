import React, { useState } from 'react';
import { User, Lock, AtSign, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface EnhancedAuthFormProps {
  onSuccess?: () => void;
}

export const EnhancedAuthForm: React.FC<EnhancedAuthFormProps> = ({ onSuccess }) => {
  const { signIn } = useAuth();
  const [formData, setFormData] = useState({
    identifier: '', // Can be username or email
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loginType, setLoginType] = useState<'auto' | 'email' | 'username'>('auto');

  const detectLoginType = (value: string): 'email' | 'username' => {
    return value.includes('@') ? 'email' : 'username';
  };

  const handleUsernameLogin = async (username: string, password: string) => {
    const { data, error } = await supabase.rpc('authenticate_with_username', {
      p_username: username,
      p_password: password
    });

    if (error || !data.success) {
      throw new Error(data?.error || 'Username authentication failed');
    }

    // For username login, we need to create a temporary session
    // since Supabase Auth expects email-based authentication
    const fakeEmail = `${username}@teacherlogin.internal`;
    
    // Try to sign in with the fake email (this will work if the account exists)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password: password
    });

    if (signInError) {
      throw new Error('Authentication failed');
    }

    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const detectedType = loginType === 'auto' ? detectLoginType(formData.identifier) : loginType;
      
      if (detectedType === 'username') {
        // Use username authentication
        await handleUsernameLogin(formData.identifier, formData.password);
      } else {
        // Use email authentication (existing method)
        const { error } = await signIn(formData.identifier, formData.password);
        if (error) {
          throw new Error(error.message);
        }
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
    
    // Auto-detect login type when identifier changes
    if (field === 'identifier' && loginType === 'auto') {
      const type = detectLoginType(value);
      setLoginType(type);
    }
  };

  const getIdentifierIcon = () => {
    const type = loginType === 'auto' ? detectLoginType(formData.identifier) : loginType;
    return type === 'email' ? <Mail className="h-4 w-4" /> : <AtSign className="h-4 w-4" />;
  };

  const getIdentifierPlaceholder = () => {
    const type = loginType === 'auto' ? detectLoginType(formData.identifier) : loginType;
    return type === 'email' ? 'admin@example.com' : 'username';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="text-center p-8 pb-6">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <User className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Login Type Selector */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setLoginType('auto')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                loginType === 'auto'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Auto-detect
            </button>
            <button
              type="button"
              onClick={() => setLoginType('username')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                loginType === 'username'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Username
            </button>
            <button
              type="button"
              onClick={() => setLoginType('email')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                loginType === 'email'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Email
            </button>
          </div>

          {/* Username/Email Field */}
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-2">
              {loginType === 'username' ? 'Username' : loginType === 'email' ? 'Email' : 'Username or Email'}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-2.5 text-gray-400">
                {getIdentifierIcon()}
              </div>
              <input
                type="text"
                id="identifier"
                value={formData.identifier}
                onChange={(e) => handleInputChange('identifier', e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={getIdentifierPlaceholder()}
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Signing in...
              </div>
            ) : (
              'Sign In'
            )}
          </button>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Teachers: Use your username • Admins: Use your email
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};