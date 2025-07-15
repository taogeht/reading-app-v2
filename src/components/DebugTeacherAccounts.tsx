import React, { useState, useEffect } from 'react';
import { query } from '../lib/database';

interface TeacherAccount {
  id: string;
  username?: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export const DebugTeacherAccounts: React.FC = () => {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      console.log('🔍 Fetching teacher accounts for debugging...');
      
      const result = await query(
        'SELECT id, username, email, full_name FROM profiles WHERE role = $1 ORDER BY full_name',
        ['teacher']
      );

      console.log('✅ Found teachers:', result.rows);
      setTeachers(result.rows.map(row => ({
        ...row,
        is_active: true // Default to active since we don't have this field in our schema
      })));
    } catch (err) {
      console.error('💥 Unexpected error:', err);
      setError('Unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
        <h3 className="font-semibold text-yellow-800 mb-2">🔍 Debug: Loading Teacher Accounts...</h3>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
      <h3 className="font-semibold text-yellow-800 mb-4">🔍 Debug: Teacher Accounts in Database</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-200 rounded p-3 mb-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {teachers.length === 0 ? (
        <div className="bg-orange-100 border border-orange-200 rounded p-3">
          <p className="text-orange-700 text-sm">
            ⚠️ No teacher accounts found in the database. 
            This might explain the login issues.
          </p>
          <p className="text-orange-600 text-xs mt-2">
            Use the admin dashboard to create a teacher account first.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-yellow-700 text-sm mb-3">
            Found {teachers.length} teacher account(s):
          </p>
          
          {teachers.map((teacher) => (
            <div key={teacher.id} className="bg-white border rounded p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Name:</strong> {teacher.full_name}</div>
                <div><strong>Active:</strong> {teacher.is_active ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Email:</strong> {teacher.email}</div>
                <div><strong>Username:</strong> {teacher.username || '❌ Not set'}</div>
              </div>
              
              {teacher.username && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                  <strong>Login instructions:</strong> Use username "{teacher.username}" 
                  with the password provided when the account was created.
                  <br />
                  <strong>⚠️ Important:</strong> Teachers must use the auto-generated password given by the admin, 
                  not a custom password.
                </div>
              )}
              
              {!teacher.username && (
                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                  ⚠️ This account has no username set. Username-based login will not work.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 space-y-2">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs">
          <p className="text-blue-700">
            <strong>🔧 Troubleshooting Teacher Login Issues:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-blue-600">
            <li>• If login fails with "Invalid credentials", the teacher may need a password reset</li>
            <li>• Teachers must use the auto-generated password from account creation</li>
            <li>• Use the "Reset Pwd" button in Admin → Teachers to generate a new password</li>
            <li>• The new password will be shown in a popup - provide it to the teacher</li>
          </ul>
        </div>
        
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <p className="text-yellow-700">
            <strong>Note:</strong> This debug component should be removed in production. 
            It's only for troubleshooting authentication issues.
          </p>
        </div>
      </div>
    </div>
  );
};