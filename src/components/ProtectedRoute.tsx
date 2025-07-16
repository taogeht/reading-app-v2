import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../contexts/UnifiedAuthContext';
import { AuthForm } from './AuthForm';
import { TeacherLogin } from './TeacherLogin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles,
  requireAuth = true 
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const isTeacherRoute = location.pathname === '/teacher';
  const isAdminRoute = location.pathname === '/admin';

  // Smart redirection based on role mismatch (must be at top level)
  useEffect(() => {
    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      console.log(`Role mismatch: User has role "${user.role}", but route requires: ${allowedRoles.join(' or ')}`);
      
      // Redirect to appropriate dashboard based on user's actual role
      if (user.role === 'teacher') {
        console.log('Redirecting teacher to teacher dashboard');
        navigate('/teacher', { replace: true });
      } else if (user.role === 'admin') {
        console.log('Redirecting admin to admin dashboard');
        navigate('/admin', { replace: true });
      } else {
        console.log('Unknown role, redirecting to welcome page');
        navigate('/welcome', { replace: true });
      }
    }
  }, [allowedRoles, user, navigate]);

  // Show loading spinner while checking auth state
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

  // If authentication is required but user is not logged in
  if (requireAuth && !user) {
    // Show teacher login for teacher route, regular login for others
    if (isTeacherRoute) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <TeacherLogin />
          </div>
        </div>
      );
    } else {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <AuthForm />
          </div>
        </div>
      );
    }
  }

  // If there's a role mismatch, show loading while redirecting
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and authorized, render children
  return <>{children}</>;
};