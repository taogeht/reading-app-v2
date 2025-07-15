import React, { useState, useEffect } from 'react';
import { Plus, Calendar, BookOpen, Users, Trash2, Edit, X } from 'lucide-react';
import { assignmentService, recordingService } from '../services/databaseService';
import { useAuth } from '../contexts/AuthContext';

interface Assignment {
  id: string;
  title: string;
  story_id: string;
  story_title: string;
  class_id: string;
  class_name: string;
  due_date: string;
  instructions: string;
  status: 'active' | 'completed' | 'draft';
  created_at: string;
  submission_count: number;
  total_students: number;
}

interface Story {
  id: string;
  title: string;
  grade_level: number;
}

interface TeacherClass {
  id: string;
  name: string;
  grade_level: number;
  student_count: number;
}

interface AssignmentManagerProps {
  classes: TeacherClass[];
  onAssignmentCreated?: () => void;
  refreshTrigger?: number; // Add refresh trigger prop
}

export const AssignmentManager: React.FC<AssignmentManagerProps> = ({ 
  classes, 
  onAssignmentCreated,
  refreshTrigger
}) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    story_id: '',
    class_id: '',
    due_date: '',
    instructions: ''
  });

  useEffect(() => {
    fetchAssignments();
    fetchStories();
  }, [user?.id, classes]); // Re-fetch when user or classes change

  // Refresh assignments when refreshTrigger prop changes
  useEffect(() => {
    if (refreshTrigger && assignments.length > 0) {
      console.log('Refreshing assignment submission counts due to trigger...');
      refreshSubmissionCounts();
    }
  }, [refreshTrigger]);

  const refreshSubmissionCounts = async () => {
    if (assignments.length === 0) return;
    
    try {
      console.log('Refreshing submission counts for existing assignments...');
      const updatedAssignments = await fetchSubmissionCounts(assignments);
      setAssignments(updatedAssignments);
    } catch (error) {
      console.error('Error refreshing submission counts:', error);
    }
  };

  // Initialize due date to today when form is opened
  useEffect(() => {
    if (showCreateForm && !formData.due_date) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Default to tomorrow
      const dateString = tomorrow.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, due_date: dateString }));
    }
  }, [showCreateForm]);

  const fetchSubmissionCounts = async (assignmentList: Assignment[]) => {
    const updatedAssignments = await Promise.all(
      assignmentList.map(async (assignment) => {
        try {
          // Get all recordings for this assignment
          const recordings = await recordingService.getRecordingsByAssignment(assignment.id);
          
          // Count unique students who have submitted (avoid counting multiple attempts from same student)
          const uniqueStudents = new Set(recordings.map(recording => recording.student_id));
          const submissionCount = uniqueStudents.size;
          
          return {
            ...assignment,
            submission_count: submissionCount
          };
        } catch (error) {
          console.error(`Error fetching submissions for assignment ${assignment.id}:`, error);
          return assignment; // Return original assignment if error
        }
      })
    );
    
    return updatedAssignments;
  };

  const fetchAssignments = async () => {
    try {
      if (!user?.id) {
        console.log('No user ID available for fetching assignments');
        setLoading(false);
        return;
      }

      console.log('Fetching assignments for teacher:', user.id);
      const teacherAssignments = await assignmentService.getAssignmentsByTeacher(user.id);
      
      // Transform database assignments to match our interface
      const transformedAssignments: Assignment[] = teacherAssignments.map(assignment => {
        const assignedClass = classes.find(c => c.id === assignment.class_id);
        return {
          id: assignment.id,
          title: assignment.title,
          story_id: assignment.story_id,
          story_title: assignment.story_title,
          class_id: assignment.class_id,
          class_name: assignedClass?.name || 'Unknown Class',
          due_date: assignment.due_date || '',
          instructions: assignment.instructions || '',
          status: assignment.is_published ? 'active' : 'draft',
          created_at: assignment.created_at,
          submission_count: 0, // Will be calculated below
          total_students: assignedClass?.student_count || 0
        };
      });

      console.log('Fetched assignments:', transformedAssignments);
      
      // Calculate submission counts for each assignment
      console.log('Calculating submission counts...');
      const assignmentsWithCounts = await fetchSubmissionCounts(transformedAssignments);
      console.log('Assignments with submission counts:', assignmentsWithCounts);
      
      setAssignments(assignmentsWithCounts);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStories = async () => {
    try {
      console.log('Fetching stories from stories.json');
      const response = await fetch('/stories.json');
      if (!response.ok) {
        throw new Error('Failed to fetch stories');
      }
      const storiesData = await response.json();
      
      // Transform stories data to match our interface
      const transformedStories: Story[] = storiesData.map((story: any) => ({
        id: story.id,
        title: story.title,
        grade_level: story.gradeLevel
      }));

      console.log('Fetched stories:', transformedStories);
      setStories(transformedStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
      // Fallback to empty array if stories can't be loaded
      setStories([]);
    }
  };

  const handleCreateAssignment = async () => {
    if (!formData.title || !formData.story_id || !formData.class_id || !formData.due_date) {
      alert('Please fill in all required fields');
      return;
    }

    if (!user?.id) {
      alert('User not authenticated');
      return;
    }

    try {
      const selectedStory = stories.find(s => s.id === formData.story_id);
      const selectedClass = classes.find(c => c.id === formData.class_id);

      console.log('Creating assignment:', {
        title: formData.title,
        story_id: formData.story_id,
        story_title: selectedStory?.title || 'Unknown Story',
        class_id: formData.class_id,
        teacher_id: user.id,
        due_date: formData.due_date,
        instructions: formData.instructions
      });

      const { data: newAssignmentData, error } = await assignmentService.createAssignment({
        title: formData.title,
        story_id: formData.story_id,
        story_title: selectedStory?.title || 'Unknown Story',
        class_id: formData.class_id,
        teacher_id: user.id,
        due_date: formData.due_date,
        instructions: formData.instructions
      });

      if (error || !newAssignmentData) {
        console.error('Error creating assignment:', error);
        alert('Failed to create assignment: ' + (error?.message || 'Unknown error'));
        return;
      }

      console.log('Assignment created successfully:', newAssignmentData);

      // Immediately publish the assignment (make it visible to students)
      const { error: publishError } = await assignmentService.publishAssignment(newAssignmentData.id);
      if (publishError) {
        console.error('Error publishing assignment:', publishError);
        // Still continue - assignment was created, just not published
      }

      // Add the new assignment to our local state
      const newAssignment: Assignment = {
        id: newAssignmentData.id,
        title: newAssignmentData.title,
        story_id: newAssignmentData.story_id,
        story_title: newAssignmentData.story_title,
        class_id: newAssignmentData.class_id,
        class_name: selectedClass?.name || 'Unknown Class',
        due_date: newAssignmentData.due_date || '',
        instructions: newAssignmentData.instructions || '',
        status: 'active',
        created_at: newAssignmentData.created_at,
        submission_count: 0,
        total_students: selectedClass?.student_count || 0
      };

      setAssignments(prev => [newAssignment, ...prev]);
      setShowCreateForm(false);
      setFormData({
        title: '',
        story_id: '',
        class_id: '',
        due_date: '',
        instructions: ''
      });

      if (onAssignmentCreated) {
        onAssignmentCreated();
      }

      alert('Assignment created and published successfully!');
    } catch (error) {
      console.error('Error creating assignment:', error);
      alert('Failed to create assignment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) {
      return;
    }

    try {
      console.log('Deleting assignment:', assignmentId);
      const { error } = await assignmentService.deleteAssignment(assignmentId);
      
      if (error) {
        console.error('Error deleting assignment:', error);
        alert('Failed to delete assignment: ' + (error.message || 'Unknown error'));
        return;
      }

      console.log('Assignment deleted successfully');
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      alert('Assignment deleted successfully');
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressPercentage = (submitted: number, total: number) => {
    return total > 0 ? Math.round((submitted / total) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Assignments
          </h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Assignment
          </button>
        </div>
      </div>

      {/* Create Assignment Form */}
      {showCreateForm && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Create New Assignment</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Read 'The Little Red Hen'"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Story *
              </label>
              <select
                value={formData.story_id}
                onChange={(e) => setFormData(prev => ({ ...prev, story_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Select a story...</option>
                {stories.map(story => (
                  <option key={story.id} value={story.id}>
                    {story.title} (Grade {story.grade_level})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Class *
              </label>
              <select
                value={formData.class_id}
                onChange={(e) => setFormData(prev => ({ ...prev, class_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Select a class...</option>
                {classes.map(classInfo => (
                  <option key={classInfo.id} value={classInfo.id}>
                    {classInfo.name} ({classInfo.student_count} students)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instructions
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Additional instructions for students..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCreateAssignment}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Assignment
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Assignments List */}
      <div className="p-6">
        {assignments.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No assignments yet</h3>
            <p className="text-gray-500 mb-4">Create your first assignment to get started</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Assignment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map(assignment => (
              <div key={assignment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-800">{assignment.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                        {assignment.status}
                      </span>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="space-y-1">
                        <p><span className="font-medium">Story:</span> {assignment.story_title}</p>
                        <p><span className="font-medium">Class:</span> {assignment.class_name}</p>
                      </div>
                      <div className="space-y-1">
                        <p><span className="font-medium">Due:</span> {formatDate(assignment.due_date)}</p>
                        <p><span className="font-medium">Created:</span> {formatDate(assignment.created_at)}</p>
                      </div>
                    </div>

                    {assignment.instructions && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Instructions:</span> {assignment.instructions}
                        </p>
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Student Progress</span>
                        <span>{assignment.submission_count}/{assignment.total_students} submitted</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${getProgressPercentage(assignment.submission_count, assignment.total_students)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => {/* TODO: Implement edit */}}
                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit assignment"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete assignment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};