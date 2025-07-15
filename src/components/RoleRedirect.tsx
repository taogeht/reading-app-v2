import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const RoleRedirect: React.FC = () => {
  const { profile, loading } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect based on user role
  if (profile?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  
  if (profile?.role === 'teacher') {
    return <Navigate to="/teacher" replace />;
  }

  // Default to welcome page if no profile
  return <Navigate to="/welcome" replace />;
};