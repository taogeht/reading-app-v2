import React, { useState, useEffect } from 'react';
import { Users, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth, VisualPassword } from '../contexts/UnifiedAuthContext';

interface StudentLoginProps {
  classAccessToken: string;
  onSuccess?: () => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ classAccessToken, onSuccess }) => {
  const { getVisualPasswords, authenticateWithClass } = useAuth();
  
  const [step, setStep] = useState<'loading' | 'input-name' | 'select-password'>('loading');
  const [visualPasswords, setVisualPasswords] = useState<VisualPassword[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [selectedPassword, setSelectedPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load visual passwords
  useEffect(() => {
    const loadVisualPasswords = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Loading visual passwords for class access token:', classAccessToken);

        // Get visual passwords for selection
        const { passwords, error: passwordsError } = await getVisualPasswords();
        console.log('Visual passwords result:', { passwords, passwordsError });
        
        if (passwordsError || !passwords) {
          setError(passwordsError || 'Failed to load visual passwords');
          setLoading(false);
          setStep('loading');
          return;
        }

        setVisualPasswords(passwords);
        setStep('input-name');
        setLoading(false);
      } catch (error) {
        console.error('Error loading visual passwords:', error);
        setError('Failed to load visual passwords');
        setLoading(false);
        setStep('loading');
      }
    };

    loadVisualPasswords();
  }, [classAccessToken, getVisualPasswords]);

  const handleNameSubmit = () => {
    if (!studentName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError(null);
    setStep('select-password');
  };

  const handlePasswordSelect = async (passwordId: string) => {
    if (!studentName.trim()) return;

    setSelectedPassword(passwordId);
    setLoading(true);
    setError(null);

    try {
      console.log('Authenticating student:', { studentName, passwordId, classAccessToken });
      
      const { error: authError } = await authenticateWithClass(
        classAccessToken,
        studentName.trim(),
        passwordId
      );

      if (authError) {
        console.error('Authentication failed:', authError);
        setError(authError);
      } else {
        console.log('Authentication successful!');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Failed to authenticate');
    } finally {
      setLoading(false);
      setSelectedPassword(null);
    }
  };

  // Group visual passwords by category
  const groupedPasswords = visualPasswords.reduce((acc, password) => {
    if (!acc[password.category]) {
      acc[password.category] = [];
    }
    acc[password.category].push(password);
    return acc;
  }, {} as Record<string, VisualPassword[]>);

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Loading...</h2>
              <p className="text-gray-600">Please wait while we prepare your login</p>
            </>
          ) : (
            <>
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        {step === 'input-name' && (
          <>
            <div className="text-center mb-8">
              <div className="p-3 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Welcome to Class!</h2>
              <p className="text-gray-600 mt-2">Please enter your name to continue</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors"
                  onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleNameSubmit}
                disabled={!studentName.trim()}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </button>
            </div>
          </>
        )}

        {step === 'select-password' && (
          <>
            <div className="text-center mb-8">
              <div className="p-3 bg-purple-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Lock className="h-8 w-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Hi {studentName}!</h2>
              <p className="text-gray-600 mt-2">Choose your visual password</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-6">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              {Object.entries(groupedPasswords).map(([category, passwords]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 capitalize">
                    {category}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {passwords.map((password) => (
                      <button
                        key={password.id}
                        onClick={() => handlePasswordSelect(password.id)}
                        disabled={loading}
                        className={`p-4 border-2 rounded-xl transition-all duration-200 flex flex-col items-center gap-2 hover:border-purple-300 hover:shadow-md ${
                          selectedPassword === password.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className="text-3xl">{password.display_emoji}</span>
                        <span className="text-sm font-medium text-gray-700">
                          {password.name}
                        </span>
                        {loading && selectedPassword === password.id && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => setStep('input-name')}
                disabled={loading}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
              >
                ← Back to name entry
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};