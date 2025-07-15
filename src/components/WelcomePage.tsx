import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Users, ExternalLink } from 'lucide-react';
import { DebugTeacherAccounts } from './DebugTeacherAccounts';

export const WelcomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reading & Recording Practice</h1>
              <p className="text-gray-600">Interactive reading platform for students and teachers</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* Welcome Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-6">
            Welcome to Reading Practice!
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            This platform helps students practice reading with interactive assignments and provides teachers 
            with tools to manage their classes and track student progress.
          </p>
        </div>

        {/* User Type Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Students Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100">
            <div className="p-4 bg-blue-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Users className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Students</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Access your reading assignments through a special link provided by your teacher. 
              Practice reading stories and get instant feedback on your pronunciation and fluency.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 justify-center text-blue-700 font-medium mb-2">
                <ExternalLink className="h-4 w-4" />
                How to Access
              </div>
              <p className="text-sm text-blue-600">
                Your teacher will provide you with a special class link. Click on that link to access your assignments.
              </p>
            </div>
          </div>

          {/* Teachers Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100">
            <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <GraduationCap className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Teachers</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Manage your classes, create reading assignments, and track student progress. 
              Access your teacher dashboard with your provided credentials.
            </p>
            <Link
              to="/teacher"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <GraduationCap className="h-5 w-5" />
              Teacher Login
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Platform Features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-3">🎤</div>
              <h4 className="font-semibold text-gray-800 mb-2">Voice Recording</h4>
              <p className="text-sm text-gray-600">Record yourself reading and get instant feedback</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📊</div>
              <h4 className="font-semibold text-gray-800 mb-2">Progress Tracking</h4>
              <p className="text-sm text-gray-600">Teachers can monitor student reading improvement</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-3">📚</div>
              <h4 className="font-semibold text-gray-800 mb-2">Interactive Stories</h4>
              <p className="text-sm text-gray-600">Engaging reading materials with audio support</p>
            </div>
          </div>
        </div>

        {/* Debug Section - Remove in production */}
        <DebugTeacherAccounts />

        {/* Help Section */}
        <div className="text-center text-gray-500">
          <p className="text-sm">
            Need help? Contact your school administrator or IT support.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-600">
          <p>Made with ❤️ for young readers everywhere</p>
        </div>
      </footer>
    </div>
  );
};