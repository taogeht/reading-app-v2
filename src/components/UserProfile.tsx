import React from 'react';
import { User, LogOut, Settings, GraduationCap, BookOpen, Shield } from 'lucide-react';
import { useAuth } from '../contexts/BetterAuthContext';

export const UserProfile: React.FC = () => {
  const { user, profile, signOut } = useAuth();

  if (!user || !profile) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'teacher':
        return <GraduationCap className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'teacher':
        return 'bg-green-100 text-green-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-3 bg-white rounded-xl shadow-md p-3 border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-gray-600" />
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800">
                {profile.full_name || user.email}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(profile.role)}`}>
                {getRoleIcon(profile.role)}
                {profile.role}
              </span>
            </div>
            <span className="text-sm text-gray-500">{user.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4 border-l pl-4">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleSignOut}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};