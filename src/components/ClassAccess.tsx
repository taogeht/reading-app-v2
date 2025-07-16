import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, Users, ArrowRight } from 'lucide-react';
import { StudentLogin } from './StudentLogin';
import { useAuth } from '../contexts/UnifiedAuthContext';

export const ClassAccess: React.FC = () => {
  const { accessToken } = useParams<{ accessToken: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    // If student is already logged in, redirect to assignments
    if (user && user.role === 'student') {
      navigate('/assignments');
    }
  }, [user, navigate]);

  const handleGetStarted = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = () => {
    navigate('/assignments');
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
          <p className="text-gray-600">
            This link appears to be invalid. Please check with your teacher for the correct link.
          </p>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <StudentLogin 
        classAccessToken={accessToken} 
        onSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        
        {/* Welcome Section */}
        <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <Users className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Ready for Reading Practice?
        </h1>
        
        <p className="text-gray-600 mb-8">
          You're about to join your class for some fun reading activities! 
          Click below to find your name and get started.
        </p>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-xl p-4 mb-8 text-left">
          <h3 className="font-semibold text-blue-800 mb-2">What you'll do:</h3>
          <ol className="text-blue-700 text-sm space-y-1">
            <li>1. Find and click your name</li>
            <li>2. Choose your special password</li>
            <li>3. Start reading practice!</li>
          </ol>
        </div>

        {/* Get Started Button */}
        <button
          onClick={handleGetStarted}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
        >
          Get Started
          <ArrowRight className="h-5 w-5" />
        </button>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 mt-6">
          Need help? Ask your teacher!
        </p>
      </div>
    </div>
  );
};