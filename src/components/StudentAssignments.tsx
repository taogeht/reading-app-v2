import React, { useState, useEffect } from 'react';
import { BookOpen, Play, User, LogOut } from 'lucide-react';
import { useStudentAuth } from '../contexts/StudentAuthContext';
import { useNavigate } from 'react-router-dom';

interface Assignment {
  id: string;
  title: string;
  story_title: string;
  due_date?: string;
  instructions?: string;
  story_id: string;
}

export const StudentAssignments: React.FC = () => {
  const { session, loading: authLoading, signOut, getAssignmentsForClass } = useStudentAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // Redirect if not logged in
    if (!session) {
      navigate('/');
      return;
    }

    // Load assignments for the student's class
    fetchAssignments();
  }, [session, authLoading, navigate]);

  const fetchAssignments = async () => {
    try {
      if (!session?.class_id) {
        console.log('No class ID available for fetching assignments');
        setLoading(false);
        return;
      }

      console.log('Fetching assignments for class:', session.class_id);

      // Use the StudentAuthContext method that bypasses RLS issues
      const { assignments: classAssignments, error } = await getAssignmentsForClass(session.class_id);
      
      if (error) {
        console.error('Error fetching assignments:', error);
        setAssignments([]);
        setLoading(false);
        return;
      }

      // Transform assignments to match our interface
      const transformedAssignments: Assignment[] = classAssignments.map((assignment: any) => ({
        id: assignment.id,
        title: assignment.title,
        story_title: assignment.story_title,
        due_date: assignment.due_date,
        instructions: assignment.instructions,
        story_id: assignment.story_id
      }));

      console.log('✅ Successfully fetched assignments for student:', transformedAssignments);
      setAssignments(transformedAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleStartAssignment = (assignment: Assignment) => {
    console.log('Starting assignment:', assignment);
    
    // Navigate to assignment-specific practice page
    navigate(`/assignment/${assignment.id}`);
  };

  // Show loading while auth is loading or while checking assignments
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Checking authentication...' : 'Loading assignments...'}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Reading Practice</h1>
                <p className="text-sm text-gray-600">{session.class?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-gray-700 font-medium">{session.student?.full_name}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 text-center">
          <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <BookOpen className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Welcome back, {session.student?.full_name}! 👋
          </h2>
          <p className="text-gray-600">
            Ready to practice reading? Choose an assignment below to get started.
          </p>
        </div>

        {/* Assignments Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Your Reading Assignments</h3>
          
          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-600 mb-2">No assignments yet</h4>
              <p className="text-gray-500">
                Your teacher will add reading assignments for you to practice with. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">
                        {assignment.title}
                      </h4>
                      <p className="text-gray-600 mb-2">
                        Story: {assignment.story_title}
                      </p>
                      {assignment.instructions && (
                        <p className="text-sm text-gray-500 mb-3">
                          {assignment.instructions}
                        </p>
                      )}
                      {assignment.due_date && (
                        <p className="text-sm text-blue-600">
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleStartAssignment(assignment)}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <Play className="h-5 w-5" />
                      Start Reading
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Practice Section - Always available */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Free Practice</h3>
          <p className="text-gray-600 mb-6">
            Want to practice reading on your own? Choose any story to practice with!
          </p>
          
          <button
            onClick={() => navigate('/practice')}
            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <BookOpen className="h-5 w-5" />
            Start Free Practice
          </button>
        </div>
      </main>
    </div>
  );
};