// Application-level security utilities
// Simple role-based access control to replace complex RLS policies

export type UserRole = 'student' | 'teacher' | 'admin';

export interface SecurityContext {
  userId?: string;
  role?: UserRole;
  classId?: string;
}

/**
 * Check if user can manage assignments (create, edit, delete)
 */
export const canManageAssignments = (context: SecurityContext): boolean => {
  return context.role === 'teacher' || context.role === 'admin';
};

/**
 * Check if user can view assignments for a specific class
 */
export const canViewClassAssignments = (context: SecurityContext, targetClassId: string): boolean => {
  // Admins can view all classes
  if (context.role === 'admin') {
    return true;
  }
  
  // Teachers can view their own classes (checked at application level)
  if (context.role === 'teacher') {
    return true; // Teacher class ownership verified in components
  }
  
  // Students can view assignments for their enrolled class
  if (context.role === 'student') {
    return context.classId === targetClassId;
  }
  
  return false;
};

/**
 * Check if user can access student recordings
 */
export const canAccessRecording = (context: SecurityContext, recordingOwnerId: string): boolean => {
  // Admins can access all recordings
  if (context.role === 'admin') {
    return true;
  }
  
  // Students can only access their own recordings
  if (context.role === 'student') {
    return context.userId === recordingOwnerId;
  }
  
  // Teachers can access recordings from students in their classes (verified at component level)
  if (context.role === 'teacher') {
    return true; // Additional class membership check done in components
  }
  
  return false;
};

/**
 * Check if user can manage classes (create, edit, delete)
 */
export const canManageClasses = (context: SecurityContext): boolean => {
  return context.role === 'admin';
};

/**
 * Check if user can manage users (create teachers, manage students)
 */
export const canManageUsers = (context: SecurityContext): boolean => {
  return context.role === 'admin';
};

/**
 * Get redirect path based on user role
 */
export const getDefaultRedirectPath = (role: UserRole): string => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'teacher':
      return '/teacher';
    case 'student':
      return '/assignments';
    default:
      return '/';
  }
};

/**
 * Validate that user has required role for a route
 */
export const validateRouteAccess = (context: SecurityContext, requiredRoles: UserRole[]): boolean => {
  if (!context.role) {
    return false;
  }
  
  return requiredRoles.includes(context.role);
};

/**
 * Simple audit logging for sensitive operations
 * In a real app, this would send to a logging service
 */
export const auditLog = (action: string, context: SecurityContext, details?: any): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    userId: context.userId,
    role: context.role,
    details: details || {}
  };
  
  // In development, log to console
  if (import.meta.env.DEV) {
    console.log('🛡️ Security Audit:', logEntry);
  }
  
  // In production, you would send this to your logging service
  // Example: sendToLoggingService(logEntry);
};

/**
 * Example usage in components:
 * 
 * const securityContext = {
 *   userId: user?.id,
 *   role: profile?.role,
 *   classId: profile?.class_id
 * };
 * 
 * if (!canManageAssignments(securityContext)) {
 *   return <AccessDenied />;
 * }
 * 
 * auditLog('assignment_created', securityContext, { assignmentId: newAssignment.id });
 */