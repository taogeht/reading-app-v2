import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  GraduationCap, 
  AlertCircle, 
  CheckCircle,
  X,
  Search,
  Filter
} from 'lucide-react';
import { classService, profileService } from '../services/railwayDatabaseService';
import type { Class } from '../services/railwayDatabaseService';
import type { UserProfile } from '../contexts/BetterAuthContext';

interface ClassRosterManagerProps {
  isOpen: boolean;
  onClose: () => void;
  classData: Class;
  onUpdate: () => void;
}

interface DragDropState {
  isDragging: boolean;
  draggedStudent: UserProfile | null;
  dropTarget: 'assigned' | 'unassigned' | null;
}

export const ClassRosterManager: React.FC<ClassRosterManagerProps> = ({
  isOpen,
  onClose,
  classData,
  onUpdate
}) => {
  const [assignedStudents, setAssignedStudents] = useState<UserProfile[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [dragState, setDragState] = useState<DragDropState>({
    isDragging: false,
    draggedStudent: null,
    dropTarget: null
  });

  useEffect(() => {
    if (isOpen) {
      loadStudents();
    }
  }, [isOpen, classData.id]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Get students assigned to this class
      const assigned = await profileService.getStudentsByClass(classData.id);
      setAssignedStudents(assigned);

      // Get all students
      const allStudents = await profileService.getAllStudents();
      
      // Filter out students already assigned to this class
      const unassigned = allStudents.filter(
        student => !assigned.some(assignedStudent => assignedStudent.id === student.id)
      );
      setUnassignedStudents(unassigned);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, student: UserProfile) => {
    setDragState({
      isDragging: true,
      draggedStudent: student,
      dropTarget: null
    });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', student.id);
  };

  const handleDragEnd = () => {
    setDragState({
      isDragging: false,
      draggedStudent: null,
      dropTarget: null
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (target: 'assigned' | 'unassigned') => {
    setDragState(prev => ({ ...prev, dropTarget: target }));
  };

  const handleDragLeave = () => {
    setDragState(prev => ({ ...prev, dropTarget: null }));
  };

  const handleDrop = async (e: React.DragEvent, target: 'assigned' | 'unassigned') => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('text/plain');
    const student = dragState.draggedStudent;

    if (!student || !studentId) return;

    try {
      if (target === 'assigned') {
        // Check capacity limit
        if (classData.max_students && assignedStudents.length >= classData.max_students) {
          alert(`Class is at capacity (${classData.max_students} students). Cannot add more students.`);
          return;
        }

        // Assign student to class
        await profileService.updateStudent(studentId, { class_id: classData.id });
        
        // Update local state
        setUnassignedStudents(prev => prev.filter(s => s.id !== studentId));
        setAssignedStudents(prev => [...prev, student]);
      } else {
        // Remove student from class
        await profileService.updateStudent(studentId, { class_id: null });
        
        // Update local state
        setAssignedStudents(prev => prev.filter(s => s.id !== studentId));
        setUnassignedStudents(prev => [...prev, student]);
      }

      onUpdate();
    } catch (error) {
      console.error('Error updating student assignment:', error);
      alert('Failed to update student assignment');
    }

    setDragState({
      isDragging: false,
      draggedStudent: null,
      dropTarget: null
    });
  };

  const handleQuickAssign = async (student: UserProfile) => {
    if (classData.max_students && assignedStudents.length >= classData.max_students) {
      alert(`Class is at capacity (${classData.max_students} students). Cannot add more students.`);
      return;
    }

    try {
      await profileService.updateStudent(student.id, { class_id: classData.id });
      setUnassignedStudents(prev => prev.filter(s => s.id !== student.id));
      setAssignedStudents(prev => [...prev, student]);
      onUpdate();
    } catch (error) {
      console.error('Error assigning student:', error);
      alert('Failed to assign student');
    }
  };

  const handleQuickRemove = async (student: UserProfile) => {
    try {
      await profileService.updateStudent(student.id, { class_id: null });
      setAssignedStudents(prev => prev.filter(s => s.id !== student.id));
      setUnassignedStudents(prev => [...prev, student]);
      onUpdate();
    } catch (error) {
      console.error('Error removing student:', error);
      alert('Failed to remove student');
    }
  };

  const filteredUnassignedStudents = unassignedStudents.filter(student => {
    const matchesSearch = student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = filterGrade === null || true; // Could add grade filtering if needed
    return matchesSearch && matchesGrade;
  });

  const filteredAssignedStudents = assignedStudents.filter(student => {
    return student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           student.email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const enrollmentPercentage = classData.max_students ? 
    (assignedStudents.length / classData.max_students) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Manage Class Roster</h2>
              <p className="text-sm text-gray-600">{classData.name} - Grade {classData.grade_level}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Class Info & Capacity */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-700">
                  {assignedStudents.length} / {classData.max_students || '∞'} Students
                </span>
              </div>
              {classData.max_students && (
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        enrollmentPercentage >= 100 ? 'bg-red-500' :
                        enrollmentPercentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(enrollmentPercentage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">{enrollmentPercentage.toFixed(0)}%</span>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Capacity Warning */}
          {classData.max_students && assignedStudents.length >= classData.max_students && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Class is at maximum capacity</span>
            </div>
          )}
        </div>

        {/* Roster Management */}
        <div className="flex h-[500px]">
          {/* Assigned Students */}
          <div className="flex-1 p-6 border-r">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-800">Enrolled Students</h3>
              <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded-full">
                {filteredAssignedStudents.length}
              </span>
            </div>

            <div
              className={`h-full border-2 border-dashed rounded-lg p-4 transition-colors ${
                dragState.dropTarget === 'assigned' && dragState.isDragging
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter('assigned')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'assigned')}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredAssignedStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Users className="h-12 w-12 mb-2" />
                  <p>No students enrolled</p>
                  <p className="text-sm">Drag students here to enroll them</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-full overflow-y-auto">
                  {filteredAssignedStudents.map((student) => (
                    <div
                      key={student.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, student)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg cursor-move hover:bg-green-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{student.full_name}</p>
                          <p className="text-sm text-gray-600">{student.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickRemove(student)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                        title="Remove from class"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Available Students */}
          <div className="flex-1 p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Available Students</h3>
              <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                {filteredUnassignedStudents.length}
              </span>
            </div>

            <div
              className={`h-full border-2 border-dashed rounded-lg p-4 transition-colors ${
                dragState.dropTarget === 'unassigned' && dragState.isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter('unassigned')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'unassigned')}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredUnassignedStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <UserPlus className="h-12 w-12 mb-2" />
                  <p>No available students</p>
                  <p className="text-sm">All students are assigned to classes</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-full overflow-y-auto">
                  {filteredUnassignedStudents.map((student) => (
                    <div
                      key={student.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, student)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-move hover:bg-blue-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <Users className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{student.full_name}</p>
                          <p className="text-sm text-gray-600">{student.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuickAssign(student)}
                        className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded"
                        title="Add to class"
                        disabled={classData.max_students && assignedStudents.length >= classData.max_students}
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              💡 <strong>Tip:</strong> Drag and drop students between the two panels to manage enrollment
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};