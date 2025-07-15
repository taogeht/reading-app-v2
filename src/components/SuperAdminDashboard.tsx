import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Settings, 
  Plus, 
  QrCode, 
  BarChart3,
  UserCheck,
  Building,
  LogOut,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { classService, profileService, assignmentService, recordingService } from '../services/databaseService';
import { TeacherModal } from './modals/TeacherModal';
import { StudentModal } from './modals/StudentModal';
import { ClassModal } from './modals/ClassModal';
import { BulkImportModal } from './modals/BulkImportModal';
import { ClassRosterManager } from './ClassRosterManager';
import type { Class, Assignment, Recording } from '../services/databaseService';
import type { UserProfile } from '../contexts/AuthContext';

interface DashboardStats {
  totalTeachers: number;
  totalClasses: number;
  totalStudents: number;
  totalAssignments: number;
  totalRecordings: number;
}

type TabType = 'overview' | 'teachers' | 'classes' | 'students';

export const SuperAdminDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  
  // State management
  const [stats, setStats] = useState<DashboardStats>({
    totalTeachers: 0,
    totalClasses: 0,
    totalStudents: 0,
    totalAssignments: 0,
    totalRecordings: 0
  });
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Modal states
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [rosterManagerOpen, setRosterManagerOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<UserProfile | null>(null);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedClassForRoster, setSelectedClassForRoster] = useState<Class | null>(null);

  // Bulk operations state
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [teacherAuthStatus, setTeacherAuthStatus] = useState<Record<string, { hasAuthUser: boolean; profileExists: boolean }>>({});

  // Search and filtering state
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [classStatusFilter, setClassStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [studentClassFilter, setStudentClassFilter] = useState<string>('all');

  // Pagination state
  const [teacherPage, setTeacherPage] = useState(1);
  const [classPage, setClassPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [pageSize] = useState(10); // Items per page

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load teachers
      const teachersData = await profileService.getTeachers();
      setTeachers(teachersData);

      // Check auth status for each teacher
      const authStatuses: Record<string, { hasAuthUser: boolean; profileExists: boolean }> = {};
      for (const teacher of teachersData) {
        try {
          const status = await profileService.checkTeacherAuthStatus(teacher.id);
          authStatuses[teacher.id] = status;
        } catch (error) {
          console.error(`Error checking auth status for teacher ${teacher.id}:`, error);
          authStatuses[teacher.id] = { hasAuthUser: false, profileExists: true };
        }
      }
      setTeacherAuthStatus(authStatuses);

      // Load classes
      const classesData = await classService.getClasses();
      setClasses(classesData);

      // Load all students across all classes
      let allStudents: UserProfile[] = [];
      for (const classItem of classesData) {
        const students = await profileService.getStudentsByClass(classItem.id);
        allStudents = [...allStudents, ...students];
      }
      setStudents(allStudents);

      // Load assignments (with error handling)
      let assignmentsData = [];
      try {
        assignmentsData = await assignmentService.getAssignments();
      } catch (error) {
        console.warn('Assignments table not available yet:', error);
      }

      // Load recordings (with error handling)
      let recordingsData = [];
      try {
        recordingsData = await recordingService.getRecordings();
      } catch (error) {
        console.warn('Recordings table not available yet:', error);
      }

      // Calculate stats
      setStats({
        totalTeachers: teachersData.length,
        totalClasses: classesData.length,
        totalStudents: allStudents.length,
        totalAssignments: assignmentsData.length,
        totalRecordings: recordingsData.length
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to handle logout
  const handleLogout = async () => {
    await signOut();
  };

  // Filtering and pagination functions
  const getFilteredTeachers = () => {
    return teachers.filter(teacher => {
      const matchesSearch = teacherSearchTerm === '' || 
        teacher.full_name?.toLowerCase().includes(teacherSearchTerm.toLowerCase()) ||
        teacher.email?.toLowerCase().includes(teacherSearchTerm.toLowerCase());
      
      const matchesStatus = teacherStatusFilter === 'all' || 
        (teacherStatusFilter === 'active' && teacher.is_active) ||
        (teacherStatusFilter === 'inactive' && !teacher.is_active);
      
      return matchesSearch && matchesStatus;
    });
  };

  const getFilteredClasses = () => {
    return classes.filter(classItem => {
      const matchesSearch = classSearchTerm === '' || 
        classItem.name?.toLowerCase().includes(classSearchTerm.toLowerCase()) ||
        classItem.teacher?.full_name?.toLowerCase().includes(classSearchTerm.toLowerCase()) ||
        classItem.grade_level?.toString().includes(classSearchTerm);
      
      const matchesStatus = classStatusFilter === 'all' || 
        (classStatusFilter === 'active' && classItem.is_active) ||
        (classStatusFilter === 'inactive' && !classItem.is_active);
      
      return matchesSearch && matchesStatus;
    });
  };

  const getFilteredStudents = () => {
    return students.filter(student => {
      const matchesSearch = studentSearchTerm === '' || 
        student.full_name?.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(studentSearchTerm.toLowerCase());
      
      const matchesStatus = studentStatusFilter === 'all' || 
        (studentStatusFilter === 'active' && student.is_active) ||
        (studentStatusFilter === 'inactive' && !student.is_active);
      
      const matchesClass = studentClassFilter === 'all' || student.class_id === studentClassFilter;
      
      return matchesSearch && matchesStatus && matchesClass;
    });
  };

  const getPaginatedData = <T,>(data: T[], page: number) => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (totalItems: number) => {
    return Math.ceil(totalItems / pageSize);
  };

  // Data export functions
  const downloadCSV = (data: any[], filename: string, headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header.toLowerCase().replace(/\s+/g, '_')] || '';
        // Escape commas and quotes in CSV
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTeachers = () => {
    const filteredTeachers = getFilteredTeachers();
    const exportData = filteredTeachers.map(teacher => ({
      full_name: teacher.full_name,
      email: teacher.email,
      status: teacher.is_active ? 'Active' : 'Inactive',
      created_at: new Date(teacher.created_at).toLocaleDateString(),
      class_count: classes.filter(c => c.teacher_id === teacher.id).length
    }));
    
    downloadCSV(
      exportData, 
      `teachers_${new Date().toISOString().split('T')[0]}.csv`,
      ['Full Name', 'Email', 'Status', 'Created At', 'Class Count']
    );
  };

  const exportClasses = () => {
    const filteredClasses = getFilteredClasses();
    const exportData = filteredClasses.map(classItem => ({
      name: classItem.name,
      grade_level: classItem.grade_level,
      teacher_name: classItem.teacher?.full_name || '',
      teacher_email: classItem.teacher?.email || '',
      student_count: classItem.student_count || 0,
      status: classItem.is_active ? 'Active' : 'Inactive',
      created_at: new Date(classItem.created_at).toLocaleDateString(),
      access_token: classItem.access_token || ''
    }));
    
    downloadCSV(
      exportData, 
      `classes_${new Date().toISOString().split('T')[0]}.csv`,
      ['Name', 'Grade Level', 'Teacher Name', 'Teacher Email', 'Student Count', 'Status', 'Created At', 'Access Token']
    );
  };

  const exportStudents = () => {
    const filteredStudents = getFilteredStudents();
    const exportData = filteredStudents.map(student => {
      const studentClass = classes.find(c => c.id === student.class_id);
      return {
        full_name: student.full_name,
        email: student.email,
        class_name: studentClass?.name || '',
        class_grade: studentClass?.grade_level || '',
        teacher_name: studentClass?.teacher?.full_name || '',
        status: student.is_active ? 'Active' : 'Inactive',
        created_at: new Date(student.created_at).toLocaleDateString(),
        last_accessed: student.last_accessed_at ? new Date(student.last_accessed_at).toLocaleDateString() : 'Never'
      };
    });
    
    downloadCSV(
      exportData, 
      `students_${new Date().toISOString().split('T')[0]}.csv`,
      ['Full Name', 'Email', 'Class Name', 'Grade Level', 'Teacher Name', 'Status', 'Created At', 'Last Accessed']
    );
  };

  // Modal handler functions
  const handleAddTeacher = () => {
    setEditingTeacher(null);
    setTeacherModalOpen(true);
  };

  const handleEditTeacher = (teacher: UserProfile) => {
    setEditingTeacher(teacher);
    setTeacherModalOpen(true);
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (window.confirm('Are you sure you want to delete this teacher?')) {
      try {
        await profileService.deleteTeacher(teacherId);
        await loadDashboardData();
      } catch (error) {
        console.error('Error deleting teacher:', error);
        alert('Failed to delete teacher');
      }
    }
  };

  const handleResetTeacherPassword = async (teacherId: string, teacherName: string) => {
    if (window.confirm(`Reset password for ${teacherName}? This will generate a new password that you'll need to provide to the teacher.`)) {
      try {
        const result = await profileService.resetTeacherPassword(teacherId);
        alert(`Password reset successful!\n\nUsername: ${result.username}\nNew Password: ${result.password}\n\nPlease provide these credentials to the teacher.`);
      } catch (error) {
        console.error('Error resetting password:', error);
        alert('Failed to reset password: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  const handleRepairTeacherAccount = async (teacherId: string, teacherName: string) => {
    const confirmMessage = `Repair account for ${teacherName}?\n\nThis will:\n• Create a new authentication user\n• Generate a new password\n• Fix the broken account\n\nContinue?`;
    
    if (window.confirm(confirmMessage)) {
      try {
        const result = await profileService.repairOrphanedTeacherProfile(teacherId);
        alert(`Account repair successful!\n\nUsername: ${result.username}\nNew Password: ${result.password}\nNew User ID: ${result.newUserId}\n\nThe teacher can now log in with these credentials.`);
        
        // Reload dashboard to refresh auth status
        await loadDashboardData();
      } catch (error) {
        console.error('Error repairing account:', error);
        alert('Failed to repair account: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  };

  const handleAddStudent = () => {
    setEditingStudent(null);
    setStudentModalOpen(true);
  };

  const handleEditStudent = (student: UserProfile) => {
    setEditingStudent(student);
    setStudentModalOpen(true);
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await profileService.deleteStudent(studentId);
        await loadDashboardData();
      } catch (error) {
        console.error('Error deleting student:', error);
        alert('Failed to delete student');
      }
    }
  };

  const handleAddClass = () => {
    setEditingClass(null);
    setClassModalOpen(true);
  };

  const handleEditClass = (classData: Class) => {
    setEditingClass(classData);
    setClassModalOpen(true);
  };

  const handleDeleteClass = async (classId: string) => {
    if (window.confirm('Are you sure you want to delete this class?')) {
      try {
        await classService.deleteClass(classId);
        await loadDashboardData();
      } catch (error) {
        console.error('Error deleting class:', error);
        alert('Failed to delete class');
      }
    }
  };

  const handleModalSave = async () => {
    await loadDashboardData();
  };

  const handleBulkImport = () => {
    setBulkImportModalOpen(true);
  };

  const handleManageRoster = (classData: Class) => {
    setSelectedClassForRoster(classData);
    setRosterManagerOpen(true);
  };

  // Bulk operations handlers
  const handleSelectAllTeachers = (checked: boolean) => {
    if (checked) {
      setSelectedTeachers(new Set(getFilteredTeachers().map(t => t.id)));
    } else {
      setSelectedTeachers(new Set());
    }
  };

  const handleSelectTeacher = (teacherId: string, checked: boolean) => {
    const newSelected = new Set(selectedTeachers);
    if (checked) {
      newSelected.add(teacherId);
    } else {
      newSelected.delete(teacherId);
    }
    setSelectedTeachers(newSelected);
  };

  const handleSelectAllStudents = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(getFilteredStudents().map(s => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const handleBulkActivateTeachers = async () => {
    if (selectedTeachers.size === 0) return;
    
    setBulkOperationLoading(true);
    try {
      for (const teacherId of selectedTeachers) {
        await profileService.updateTeacher(teacherId, { is_active: true });
      }
      await loadDashboardData();
      setSelectedTeachers(new Set());
    } catch (error) {
      console.error('Error activating teachers:', error);
      alert('Failed to activate some teachers');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkDeactivateTeachers = async () => {
    if (selectedTeachers.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to deactivate ${selectedTeachers.size} teachers?`)) {
      return;
    }

    setBulkOperationLoading(true);
    try {
      for (const teacherId of selectedTeachers) {
        await profileService.deleteTeacher(teacherId);
      }
      await loadDashboardData();
      setSelectedTeachers(new Set());
    } catch (error) {
      console.error('Error deactivating teachers:', error);
      alert('Failed to deactivate some teachers');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkActivateStudents = async () => {
    if (selectedStudents.size === 0) return;
    
    setBulkOperationLoading(true);
    try {
      for (const studentId of selectedStudents) {
        await profileService.updateStudent(studentId, { is_active: true });
      }
      await loadDashboardData();
      setSelectedStudents(new Set());
    } catch (error) {
      console.error('Error activating students:', error);
      alert('Failed to activate some students');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  const handleBulkDeactivateStudents = async () => {
    if (selectedStudents.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to deactivate ${selectedStudents.size} students?`)) {
      return;
    }

    setBulkOperationLoading(true);
    try {
      for (const studentId of selectedStudents) {
        await profileService.deleteStudent(studentId);
      }
      await loadDashboardData();
      setSelectedStudents(new Set());
    } catch (error) {
      console.error('Error deactivating students:', error);
      alert('Failed to deactivate some students');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  // Tab configuration
  const tabs = [
    { 
      id: 'overview' as TabType, 
      label: 'Overview', 
      icon: <BarChart3 className="h-4 w-4" />,
      description: 'Platform statistics and overview'
    },
    { 
      id: 'teachers' as TabType, 
      label: 'Teachers', 
      icon: <GraduationCap className="h-4 w-4" />,
      description: 'Manage teacher accounts'
    },
    { 
      id: 'classes' as TabType, 
      label: 'Classes', 
      icon: <Building className="h-4 w-4" />,
      description: 'Manage classes and assignments'
    },
    { 
      id: 'students' as TabType, 
      label: 'Students', 
      icon: <Users className="h-4 w-4" />,
      description: 'Manage student accounts'
    }
  ];

  // Check if current user is super admin
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <UserCheck className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access the super admin dashboard.</p>
        </div>
      </div>
    );
  }

  const generateQRCodeURL = (accessToken: string) => {
    const classURL = `${window.location.origin}/class/${accessToken}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(classURL)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string }> = 
    ({ title, value, icon, color }) => (
      <div className="bg-white rounded-xl shadow-md p-6 border-l-4" style={{ borderLeftColor: color }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
            {icon}
          </div>
        </div>
      </div>
    );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Main dashboard layout
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Brand and title */}
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                <Settings className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
                <p className="text-sm text-gray-600">Reading Practice Platform Management</p>
              </div>
            </div>

            {/* Admin user info and logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'Admin User'}</p>
                <p className="text-xs text-gray-500">{profile?.email}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Enhanced Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-1">
            <nav className="flex space-x-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.icon}
                  <div className="text-left">
                    <div className="font-semibold">{tab.label}</div>
                    {activeTab === tab.id && (
                      <div className="text-xs opacity-90">{tab.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <StatCard
                title="Teachers"
                value={stats.totalTeachers}
                icon={<GraduationCap className="h-6 w-6 text-blue-600" />}
                color="#3b82f6"
              />
              <StatCard
                title="Classes"
                value={stats.totalClasses}
                icon={<Users className="h-6 w-6 text-green-600" />}
                color="#22c55e"
              />
              <StatCard
                title="Students"
                value={stats.totalStudents}
                icon={<Users className="h-6 w-6 text-purple-600" />}
                color="#a855f7"
              />
              <StatCard
                title="Assignments"
                value={stats.totalAssignments}
                icon={<BookOpen className="h-6 w-6 text-orange-600" />}
                color="#f97316"
              />
              <StatCard
                title="Recordings"
                value={stats.totalRecordings}
                icon={<BookOpen className="h-6 w-6 text-red-600" />}
                color="#ef4444"
              />
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Platform Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Recent Classes</h4>
                  <div className="space-y-2">
                    {classes.slice(0, 5).map((classItem) => (
                      <div key={classItem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-800">{classItem.name}</p>
                          <p className="text-sm text-gray-600">Grade {classItem.grade_level}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          classItem.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {classItem.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Teachers</h4>
                  <div className="space-y-2">
                    {teachers.slice(0, 5).map((teacher) => (
                      <div key={teacher.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-800">{teacher.full_name}</p>
                          <p className="text-sm text-gray-600">{teacher.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">All Classes</h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportClasses}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button 
                  onClick={handleAddClass}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Class
                </button>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 flex-1 min-w-64">
                  <Search className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search classes by name, teacher, or grade..."
                    value={classSearchTerm}
                    onChange={(e) => {
                      setClassSearchTerm(e.target.value);
                      setClassPage(1); // Reset to first page on search
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={classStatusFilter}
                    onChange={(e) => {
                      setClassStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                      setClassPage(1); // Reset to first page on filter change
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  {getFilteredClasses().length} classes found
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teacher
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Access
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getPaginatedData(getFilteredClasses(), classPage).map((classItem) => (
                      <tr key={classItem.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{classItem.name}</div>
                            <div className="text-sm text-gray-500">Grade {classItem.grade_level}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{classItem.teacher?.full_name || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{classItem.teacher?.email || ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{classItem.student_count || 0} students</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyToClipboard(`${window.location.origin}/class/${classItem.access_token}`)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => window.open(generateQRCodeURL(classItem.access_token || ''), '_blank')}
                              className="text-green-600 hover:text-green-800"
                            >
                              <QrCode className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            classItem.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {classItem.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleManageRoster(classItem)}
                              className="text-blue-600 hover:text-blue-900 text-sm flex items-center gap-1"
                            >
                              <Users className="h-3 w-3" />
                              Manage Roster
                            </button>
                            <button
                              onClick={() => handleEditClass(classItem)}
                              className="text-green-600 hover:text-green-900 text-sm flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {getFilteredClasses().length > pageSize && (
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing {((classPage - 1) * pageSize) + 1} to {Math.min(classPage * pageSize, getFilteredClasses().length)} of {getFilteredClasses().length} classes
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setClassPage(Math.max(1, classPage - 1))}
                        disabled={classPage === 1}
                        className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium text-gray-700">
                        Page {classPage} of {getTotalPages(getFilteredClasses().length)}
                      </span>
                      <button
                        onClick={() => setClassPage(Math.min(getTotalPages(getFilteredClasses().length), classPage + 1))}
                        disabled={classPage === getTotalPages(getFilteredClasses().length)}
                        className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {getFilteredClasses().length === 0 && (
                <div className="text-center py-12">
                  <Building className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {classSearchTerm || classStatusFilter !== 'all' ? 'No classes match your filters' : 'No classes found'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {classSearchTerm || classStatusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Start by adding your first class'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Teachers Management</h2>
                <p className="text-gray-600">Manage teacher accounts and their class assignments</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportTeachers}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
                <button 
                  onClick={handleAddTeacher}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add Teacher
                </button>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 flex-1 min-w-64">
                  <Search className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search teachers by name or email..."
                    value={teacherSearchTerm}
                    onChange={(e) => {
                      setTeacherSearchTerm(e.target.value);
                      setTeacherPage(1); // Reset to first page on search
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={teacherStatusFilter}
                    onChange={(e) => {
                      setTeacherStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                      setTeacherPage(1); // Reset to first page on filter change
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="text-sm text-gray-600">
                  {getFilteredTeachers().length} teachers found
                </div>
              </div>
            </div>

            {/* Bulk Actions for Teachers */}
            {selectedTeachers.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-blue-800 font-medium">
                    {selectedTeachers.size} teacher{selectedTeachers.size > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkActivateTeachers}
                      disabled={bulkOperationLoading}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Activate
                    </button>
                    <button
                      onClick={handleBulkDeactivateTeachers}
                      disabled={bulkOperationLoading}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                    <button
                      onClick={() => setSelectedTeachers(new Set())}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedTeachers.size === teachers.length && teachers.length > 0}
                          onChange={(e) => handleSelectAllTeachers(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teacher
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Classes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getPaginatedData(getFilteredTeachers(), teacherPage).map((teacher) => {
                      const teacherClasses = classes.filter(c => c.teacher_id === teacher.id);
                      return (
                        <tr key={teacher.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedTeachers.has(teacher.id)}
                              onChange={(e) => handleSelectTeacher(teacher.id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                                <GraduationCap className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                  {teacher.full_name}
                                  {/* Auth status indicator */}
                                  {teacherAuthStatus[teacher.id]?.hasAuthUser ? (
                                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                      Active
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                      Needs Repair
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">{teacher.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{teacherClasses.length} classes</div>
                            {teacherClasses.length > 0 && (
                              <div className="text-sm text-gray-500">
                                {teacherClasses.map(c => c.name).join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(teacher.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleEditTeacher(teacher)}
                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </button>
                              
                              {/* Show different buttons based on auth status */}
                              {teacherAuthStatus[teacher.id]?.hasAuthUser ? (
                                // Working account - show password reset
                                <button 
                                  onClick={() => handleResetTeacherPassword(teacher.id, teacher.full_name)}
                                  className="text-orange-600 hover:text-orange-900 flex items-center gap-1"
                                  title="Reset teacher password"
                                >
                                  <Settings className="h-3 w-3" />
                                  Reset Pwd
                                </button>
                              ) : (
                                // Orphaned account - show repair button
                                <button 
                                  onClick={() => handleRepairTeacherAccount(teacher.id, teacher.full_name)}
                                  className="text-yellow-600 hover:text-yellow-900 flex items-center gap-1"
                                  title="Repair broken teacher account"
                                >
                                  <Settings className="h-3 w-3" />
                                  Repair Account
                                </button>
                              )}
                              
                              <button 
                                onClick={() => handleDeleteTeacher(teacher.id)}
                                className="text-red-600 hover:text-red-900 flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {teachers.length === 0 && (
                <div className="text-center py-12">
                  <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No teachers found</p>
                  <p className="text-sm text-gray-400">Start by adding your first teacher</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Students Management</h2>
                <p className="text-gray-600">Manage student accounts and class assignments</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleBulkImport}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg hover:shadow-xl transition-all"
                >
                  <BookOpen className="h-4 w-4" />
                  Bulk Import
                </button>
                <button 
                  onClick={handleAddStudent}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add Student
                </button>
              </div>
            </div>

            {/* Bulk Actions for Students */}
            {selectedStudents.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-blue-800 font-medium">
                    {selectedStudents.size} student{selectedStudents.size > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkActivateStudents}
                      disabled={bulkOperationLoading}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Activate
                    </button>
                    <button
                      onClick={handleBulkDeactivateStudents}
                      disabled={bulkOperationLoading}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                    <button
                      onClick={() => setSelectedStudents(new Set())}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={selectedStudents.size === getFilteredStudents().length && getFilteredStudents().length > 0}
                          onChange={(e) => handleSelectAllStudents(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Class
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Visual Password
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Active
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {students.map((student) => {
                      const studentClass = classes.find(c => c.id === student.class_id);
                      return (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.id)}
                              onChange={(e) => handleSelectStudent(student.id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full flex items-center justify-center">
                                <Users className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                                <div className="text-sm text-gray-500">{student.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{studentClass?.name || 'No class assigned'}</div>
                            {studentClass && (
                              <div className="text-sm text-gray-500">Grade {studentClass.grade_level}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {student.visual_password_id ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                  {student.visual_password_id}
                                </span>
                              ) : (
                                <span className="text-gray-400">Not set</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {student.last_accessed_at 
                                ? new Date(student.last_accessed_at).toLocaleDateString()
                                : 'Never'
                              }
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleEditStudent(student)}
                                className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                              >
                                <Edit className="h-3 w-3" />
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteStudent(student.id)}
                                className="text-red-600 hover:text-red-900 flex items-center gap-1"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {students.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No students found</p>
                  <p className="text-sm text-gray-400">Students will appear here once they're added to classes</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modals */}
      <TeacherModal
        isOpen={teacherModalOpen}
        onClose={() => setTeacherModalOpen(false)}
        teacher={editingTeacher}
        onSave={handleModalSave}
      />

      <StudentModal
        isOpen={studentModalOpen}
        onClose={() => setStudentModalOpen(false)}
        student={editingStudent}
        onSave={handleModalSave}
      />

      <ClassModal
        isOpen={classModalOpen}
        onClose={() => setClassModalOpen(false)}
        classData={editingClass}
        onSave={handleModalSave}
      />

      <BulkImportModal
        isOpen={bulkImportModalOpen}
        onClose={() => setBulkImportModalOpen(false)}
        onComplete={handleModalSave}
      />

      {selectedClassForRoster && (
        <ClassRosterManager
          isOpen={rosterManagerOpen}
          onClose={() => setRosterManagerOpen(false)}
          classData={selectedClassForRoster}
          onUpdate={handleModalSave}
        />
      )}
    </div>
  );
};