import React, { useState, useEffect } from 'react';
import { GraduationCap, Smile, ArrowRight, AlertCircle } from 'lucide-react';
import type { VisualPassword } from '../../services/railwayDatabaseService';

interface Student {
  id: string;
  full_name: string;
  class_id: string;
  visual_password_id?: string;
}

interface StudentLoginFormProps {
  onLogin: (credentials: { 
    full_name: string; 
    visual_password_id: string; 
    class_access_token: string; 
  }) => Promise<void>;
  loading?: boolean;
  error?: string;
}

export const StudentLoginForm: React.FC<StudentLoginFormProps> = ({
  onLogin,
  loading = false,
  error
}) => {
  const [step, setStep] = useState<'class' | 'name' | 'visual'>('class');
  const [classAccessToken, setClassAccessToken] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [visualPasswords, setVisualPasswords] = useState<VisualPassword[]>([]);
  const [selectedVisualPassword, setSelectedVisualPassword] = useState<string>('');
  const [stepError, setStepError] = useState<string>('');

  // Load visual passwords on component mount
  useEffect(() => {
    loadVisualPasswords();
  }, []);

  const loadVisualPasswords = async () => {
    try {
      const response = await fetch('/api/visual-passwords', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (result.status === 200) {
        setVisualPasswords(result.data || []);
      }
    } catch (err) {
      console.error('Error loading visual passwords:', err);
    }
  };

  const handleClassAccess = async () => {
    if (!classAccessToken.trim()) {
      setStepError('Please enter your class code');
      return;
    }

    setStepError('');
    
    try {
      // Fetch students for this class
      // Note: We'll need to create an endpoint for this
      const response = await fetch(`/api/classes/students?access_token=${classAccessToken}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      if (result.status === 200) {
        setStudents(result.data || []);
        setStep('name');
      } else {
        setStepError(result.error || 'Invalid class code');
      }
    } catch (err) {
      setStepError('Failed to access class. Please try again.');
    }
  };

  const handleStudentSelection = (student: Student) => {
    setSelectedStudent(student);
    setStepError('');
    setStep('visual');
  };

  const handleVisualPasswordSelection = async (visualPasswordId: string) => {
    if (!selectedStudent) return;
    
    setSelectedVisualPassword(visualPasswordId);
    setStepError('');
    
    // Automatically submit when visual password is selected
    try {
      await onLogin({
        full_name: selectedStudent.full_name,
        visual_password_id: visualPasswordId,
        class_access_token: classAccessToken
      });
    } catch (err) {
      // Error will be handled by parent component
    }
  };

  const goBack = () => {
    setStepError('');
    if (step === 'name') {
      setStep('class');
      setStudents([]);
    } else if (step === 'visual') {
      setStep('name');
      setSelectedStudent(null);
      setSelectedVisualPassword('');
    }
  };

  // Group visual passwords by category
  const groupedVisualPasswords = visualPasswords.reduce((groups, vp) => {
    const category = vp.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(vp);
    return groups;
  }, {} as Record<string, VisualPassword[]>);

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Student Login</h2>
          <p className="text-gray-600 text-sm">
            {step === 'class' && 'Enter your class code to get started'}
            {step === 'name' && 'Select your name from the list'}
            {step === 'visual' && 'Choose your special login picture'}
          </p>
        </div>

        {/* Error Display */}
        {(error || stepError) && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error || stepError}</span>
          </div>
        )}

        {/* Step 1: Class Access Code */}
        {step === 'class' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="classCode" className="block text-sm font-medium text-gray-700 mb-2">
                Class Code
              </label>
              <input
                type="text"
                id="classCode"
                value={classAccessToken}
                onChange={(e) => setClassAccessToken(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center text-lg font-mono tracking-wider"
                placeholder="ABC123"
                maxLength={8}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                Ask your teacher for the class code
              </p>
            </div>
            <button
              onClick={handleClassAccess}
              disabled={loading || !classAccessToken.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <span>Enter Class</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 2: Student Name Selection */}
        {step === 'name' && (
          <div className="space-y-4">
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Smile className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No students found in this class</p>
                </div>
              ) : (
                students.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleStudentSelection(student)}
                    className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    disabled={loading}
                  >
                    <span className="font-medium text-gray-800">{student.full_name}</span>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={goBack}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Back to Class Code
            </button>
          </div>
        )}

        {/* Step 3: Visual Password Selection */}
        {step === 'visual' && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Hi <span className="font-semibold text-purple-600">{selectedStudent?.full_name}</span>!
              </p>
              <p className="text-xs text-gray-500">Click on your special picture to log in</p>
            </div>
            
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {Object.entries(groupedVisualPasswords).map(([category, passwords]) => (
                <div key={category}>
                  <h4 className="text-xs font-medium text-gray-600 uppercase mb-2">
                    {category}
                  </h4>
                  <div className="grid grid-cols-6 gap-2">
                    {passwords.map((vp) => (
                      <button
                        key={vp.id}
                        onClick={() => handleVisualPasswordSelection(vp.id)}
                        className={`
                          p-3 rounded-lg border-2 transition-all hover:scale-105 active:scale-95
                          ${selectedVisualPassword === vp.id 
                            ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500 ring-opacity-50' 
                            : 'border-gray-200 hover:border-purple-300'
                          }
                        `}
                        title={vp.name}
                        disabled={loading}
                      >
                        <span className="text-2xl block">{vp.display_emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={goBack}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Back to Name Selection
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 text-purple-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              <span className="text-sm">Logging in...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};