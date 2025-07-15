import React, { useState, useEffect } from 'react';
import { Users, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useStudentAuth, VisualPassword, StudentProfile, ClassInfo } from '../contexts/StudentAuthContext';

interface StudentLoginProps {
  classAccessToken: string;
  onSuccess?: () => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ classAccessToken, onSuccess }) => {
  const { getClassByToken, getStudentsInClass, getVisualPasswords, authenticateStudent } = useStudentAuth();
  
  const [step, setStep] = useState<'loading' | 'select-student' | 'select-password'>('loading');
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [visualPasswords, setVisualPasswords] = useState<VisualPassword[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [selectedPassword, setSelectedPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load class and students
  useEffect(() => {
    const loadClassData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Loading class data for token:', classAccessToken);

        // Get class info
        const { class: classData, error: classError } = await getClassByToken(classAccessToken);
        console.log('Class data result:', { classData, classError });
        
        if (classError || !classData) {
          setError(classError || 'Class not found');
          setLoading(false);
          setStep('loading');
          return;
        }
        setClassInfo(classData);

        // Get students in class
        const { students: studentsData, error: studentsError } = await getStudentsInClass(classData.id);
        console.log('Students data result:', { studentsData, studentsError });
        
        if (studentsError) {
          console.warn('Failed to load students, but continuing anyway:', studentsError);
          // Don't fail completely if students can't be loaded - they can be created on login
        }
        setStudents(studentsData || []);

        // Get visual passwords
        const { passwords, error: passwordsError } = await getVisualPasswords();
        console.log('Visual passwords result:', { passwords, passwordsError });
        
        if (passwordsError) {
          console.warn('Failed to load visual passwords, using fallback');
          // Provide fallback visual passwords
          setVisualPasswords([
            { id: 'cat', name: 'Cat', display_emoji: '🐱', category: 'animals' as const },
            { id: 'dog', name: 'Dog', display_emoji: '🐶', category: 'animals' as const },
            { id: 'star', name: 'Star', display_emoji: '⭐', category: 'shapes' as const },
            { id: 'heart', name: 'Heart', display_emoji: '❤️', category: 'shapes' as const }
          ]);
        } else {
          setVisualPasswords(passwords);
        }

        setStep('select-student');
        setLoading(false);
      } catch (error) {
        console.error('Error loading class data:', error);
        setError('Failed to load class information');
        setLoading(false);
        setStep('loading');
      }
    };

    loadClassData();
  }, [classAccessToken, getClassByToken, getStudentsInClass, getVisualPasswords]);

  const handleStudentSelect = (student: StudentProfile) => {
    setSelectedStudent(student);
    setError(null);
    setStep('select-password');
  };

  const handlePasswordSelect = async (passwordId: string) => {
    if (!selectedStudent) return;

    setSelectedPassword(passwordId);
    setLoading(true);
    setError(null);

    const { success, error: authError } = await authenticateStudent(
      classAccessToken,
      selectedStudent.full_name,
      passwordId
    );

    if (success) {
      onSuccess?.();
    } else {
      setError(authError || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const handleBackToStudents = () => {
    setSelectedStudent(null);
    setSelectedPassword(null);
    setError(null);
    setStep('select-student');
  };

  const getPasswordsByCategory = (category: string) => {
    return visualPasswords.filter(p => p.category === category);
  };

  const getIconComponent = (password: VisualPassword) => {
    // If we have display_emoji, use it directly
    if (password.display_emoji) {
      return (
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
          {password.display_emoji}
        </div>
      );
    }

    // For colors, return colored circles
    if (password.category === 'colors') {
      const colorMap: Record<string, string> = {
        red: '#ef4444',
        blue: '#3b82f6',
        green: '#22c55e',
        yellow: '#eab308',
        purple: '#a855f7',
        orange: '#f97316'
      };
      
      return (
        <div 
          className="w-12 h-12 rounded-full border-2 border-gray-300"
          style={{ backgroundColor: colorMap[password.id] || '#6b7280' }}
        />
      );
    }

    // Fallback to icon_name mapping
    const iconName = password.icon_name || password.name;
    return (
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
        {iconName === 'Cat' && '🐱'}
        {iconName === 'Dog' && '🐶'}
        {iconName === 'Rabbit' && '🐰'}
        {iconName === 'Fish' && '🐟'}
        {iconName === 'Bird' && '🐦'}
        {iconName === 'Turtle' && '🐢'}
        {iconName === 'Circle' && '⭕'}
        {iconName === 'Square' && '⬜'}
        {iconName === 'Triangle' && '🔺'}
        {iconName === 'Star' && '⭐'}
        {iconName === 'Heart' && '❤️'}
        {iconName === 'Diamond' && '💎'}
        {iconName === 'Car' && '🚗'}
        {iconName === 'Home' && '🏠'}
        {iconName === 'Tree' && '🌳'}
        {iconName === 'Flower' && '🌸'}
        {iconName === 'Sun' && '☀️'}
        {iconName === 'Moon' && '🌙'}
        {!['Cat', 'Dog', 'Rabbit', 'Fish', 'Bird', 'Turtle', 'Circle', 'Square', 'Triangle', 'Star', 'Heart', 'Diamond', 'Car', 'Home', 'Tree', 'Flower', 'Sun', 'Moon'].includes(iconName) && '📝'}
      </div>
    );
  };

  if (step === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading Your Class</h2>
          <p className="text-gray-600 mb-4">
            {step === 'loading' ? 'Checking class information...' : 'Signing you in...'}
          </p>
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              Access Token: <span className="font-mono">{classAccessToken}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !classInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Please check with your teacher for the correct link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-lg p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="p-3 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome to {classInfo?.name}!
          </h1>
          <p className="text-gray-600">
            {step === 'select-student' ? 'Find your name below' : 'Choose your password'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-center">{error}</p>
          </div>
        )}

        {/* Step 1: Select Student */}
        {step === 'select-student' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
              Click on your name:
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  className="p-4 bg-gray-50 hover:bg-blue-50 border-2 border-transparent hover:border-blue-300 rounded-xl transition-all duration-200 hover:scale-105 text-center"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="font-medium text-gray-800 text-sm">{student.full_name}</p>
                </button>
              ))}
            </div>

            {students.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No students found in this class.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Visual Password */}
        {step === 'select-password' && selectedStudent && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleBackToStudents}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                ← Back to names
              </button>
              <h2 className="text-lg font-semibold text-gray-800">
                Hi {selectedStudent.full_name}! Choose your password:
              </h2>
              <div></div>
            </div>

            {/* Visual Password Categories */}
            <div className="space-y-8">
              {['animals', 'shapes', 'objects', 'colors'].map((category) => {
                const categoryPasswords = getPasswordsByCategory(category);
                if (categoryPasswords.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="text-md font-medium text-gray-700 mb-4 capitalize">
                      {category}
                    </h3>
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                      {categoryPasswords.map((password) => (
                        <button
                          key={password.id}
                          onClick={() => handlePasswordSelect(password.id)}
                          disabled={loading}
                          className={`p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 flex flex-col items-center gap-2 ${
                            selectedPassword === password.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300 bg-gray-50 hover:bg-blue-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {getIconComponent(password)}
                          <span className="text-xs font-medium text-gray-700">
                            {password.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};