import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, FileText, Users } from 'lucide-react';
import { profileService, classService } from '../../services/railwayDatabaseService';
import type { Class } from '../../services/railwayDatabaseService';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface StudentImportData {
  full_name: string;
  email: string;
  class_name: string;
  class_id?: string;
  visual_password_id?: string;
  row: number;
}

interface ImportProgress {
  total: number;
  completed: number;
  errors: Array<{ row: number; error: string; data: StudentImportData }>;
  successful: Array<{ row: number; data: StudentImportData }>;
}

const VISUAL_PASSWORDS = [
  'cat', 'dog', 'star', 'heart', 'sun', 'flower', 'red', 'blue',
  'tree', 'car', 'house', 'book', 'apple', 'butterfly', 'moon', 'rainbow'
];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [csvData, setCsvData] = useState<StudentImportData[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0,
    completed: 0,
    errors: [],
    successful: []
  });
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load classes when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadClasses();
    }
  }, [isOpen]);

  const loadClasses = async () => {
    try {
      const classesData = await classService.getClasses();
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const downloadTemplate = () => {
    const csvContent = 'full_name,email,class_name\n' +
                      'John Doe,john.doe@school.edu,Mrs. Smith Grade 2\n' +
                      'Jane Smith,jane.smith@school.edu,Mrs. Smith Grade 2\n' +
                      'Bob Johnson,bob.johnson@school.edu,Mr. Brown Grade 3';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): StudentImportData[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    const requiredHeaders = ['full_name', 'email', 'class_name'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    const students: StudentImportData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const student: StudentImportData = {
        full_name: '',
        email: '',
        class_name: '',
        row: i + 1
      };

      headers.forEach((header, index) => {
        const value = values[index] || '';
        switch (header) {
          case 'full_name':
            student.full_name = value;
            break;
          case 'email':
            student.email = value;
            break;
          case 'class_name':
            student.class_name = value;
            break;
        }
      });

      // Find matching class
      const matchingClass = classes.find(c => 
        c.name.toLowerCase() === student.class_name.toLowerCase()
      );
      student.class_id = matchingClass?.id;

      // Assign random visual password
      student.visual_password_id = VISUAL_PASSWORDS[Math.floor(Math.random() * VISUAL_PASSWORDS.length)];

      students.push(student);
    }

    return students;
  };

  const validateStudentData = (students: StudentImportData[]): string[] => {
    const errors: string[] = [];
    const emails = new Set<string>();

    students.forEach((student, index) => {
      const rowNum = index + 2; // +2 because CSV has header and is 1-indexed

      // Validate required fields
      if (!student.full_name?.trim()) {
        errors.push(`Row ${rowNum}: Full name is required`);
      }

      if (!student.email?.trim()) {
        errors.push(`Row ${rowNum}: Email is required`);
      } else {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(student.email)) {
          errors.push(`Row ${rowNum}: Invalid email format`);
        }

        // Check for duplicate emails in CSV
        if (emails.has(student.email.toLowerCase())) {
          errors.push(`Row ${rowNum}: Duplicate email found in CSV`);
        } else {
          emails.add(student.email.toLowerCase());
        }
      }

      if (!student.class_name?.trim()) {
        errors.push(`Row ${rowNum}: Class name is required`);
      } else if (!student.class_id) {
        errors.push(`Row ${rowNum}: Class "${student.class_name}" not found`);
      }
    });

    return errors;
  };

  const handleFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      const students = parseCSV(text);
      
      const validationErrors = validateStudentData(students);
      if (validationErrors.length > 0) {
        alert(`Validation errors found:\n\n${validationErrors.slice(0, 10).join('\n')}${validationErrors.length > 10 ? `\n... and ${validationErrors.length - 10} more errors` : ''}`);
        return;
      }

      setCsvData(students);
      setShowResults(false);
    } catch (error: any) {
      alert(`Error parsing CSV: ${error.message}`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      handleFileUpload(csvFile);
    } else {
      alert('Please upload a CSV file');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const importStudents = async () => {
    if (csvData.length === 0) return;

    setIsImporting(true);
    setProgress({
      total: csvData.length,
      completed: 0,
      errors: [],
      successful: []
    });

    for (let i = 0; i < csvData.length; i++) {
      const student = csvData[i];
      
      try {
        await profileService.createStudent({
          full_name: student.full_name,
          email: student.email,
          class_id: student.class_id!,
          visual_password_id: student.visual_password_id
        });

        setProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          successful: [...prev.successful, { row: student.row, data: student }]
        }));
      } catch (error: any) {
        setProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          errors: [...prev.errors, { row: student.row, error: error.message, data: student }]
        }));
      }

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsImporting(false);
    setShowResults(true);
  };

  const handleClose = () => {
    setCsvData([]);
    setProgress({ total: 0, completed: 0, errors: [], successful: [] });
    setShowResults(false);
    onClose();
    if (progress.successful.length > 0) {
      onComplete();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg">
              <Upload className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Bulk Import Students</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">📋 Import Instructions</h3>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Upload a CSV file with columns: <code>full_name</code>, <code>email</code>, <code>class_name</code></li>
              <li>• Class names must match existing classes exactly</li>
              <li>• Email addresses must be unique and valid</li>
              <li>• Visual passwords will be assigned automatically</li>
            </ul>
          </div>

          {/* Download Template */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-800">Step 1: Download Template</h3>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download CSV Template
            </button>
          </div>

          {/* File Upload */}
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-3">Step 2: Upload CSV File</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDragIn}
              onDragLeave={handleDragOut}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg text-gray-600 mb-2">
                Drag and drop your CSV file here, or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Choose File
              </button>
            </div>
          </div>

          {/* Preview Data */}
          {csvData.length > 0 && !showResults && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-3">
                Step 3: Review Data ({csvData.length} students)
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-3 gap-4 font-medium text-gray-700 mb-2">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Class</div>
                </div>
                {csvData.slice(0, 10).map((student, index) => (
                  <div key={index} className="grid grid-cols-3 gap-4 py-2 border-t border-gray-200 text-sm">
                    <div>{student.full_name}</div>
                    <div>{student.email}</div>
                    <div className={!student.class_id ? 'text-red-600' : ''}>
                      {student.class_name}
                      {!student.class_id && ' (Not Found)'}
                    </div>
                  </div>
                ))}
                {csvData.length > 10 && (
                  <div className="text-center text-gray-500 text-sm pt-2">
                    ... and {csvData.length - 10} more students
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setCsvData([])}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Upload Different File
                </button>
                <button
                  onClick={importStudents}
                  disabled={isImporting}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Users className="h-4 w-4" />
                  {isImporting ? 'Importing...' : `Import ${csvData.length} Students`}
                </button>
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="font-medium text-blue-800">
                  Importing students... ({progress.completed}/{progress.total})
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Import Results */}
          {showResults && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800">Import Results</h3>
              
              {/* Success Summary */}
              {progress.successful.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      Successfully imported {progress.successful.length} students
                    </span>
                  </div>
                </div>
              )}

              {/* Error Summary */}
              {progress.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">
                      {progress.errors.length} students failed to import
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {progress.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700 bg-red-100 p-2 rounded">
                        <strong>Row {error.row}:</strong> {error.data.full_name} - {error.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};