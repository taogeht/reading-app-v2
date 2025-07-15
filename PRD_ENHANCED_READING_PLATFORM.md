# Product Requirements Document (PRD)
## Enhanced Reading Practice Platform

### Product Overview

**Vision:** Transform the current reading practice application into a comprehensive educational platform with pre-generated TTS audio, student recording submissions, and teacher-centered management tools.

**Mission:** Provide schools with a cost-effective, privacy-focused reading assessment platform that eliminates ongoing API costs while giving teachers complete control over content and student progress.

### Current State Analysis

**Existing Components:**
- React app with TTS playback using ElevenLabs API
- Student voice recording with Google Speech analysis
- Instant feedback system with detailed analysis
- Custom story input functionality

**Current Pain Points:**
- High ongoing API costs for both TTS and speech analysis
- No teacher management or progress tracking
- Students can add custom content (not suitable for classroom control)
- Real-time analysis creates performance pressure on students
- No persistent storage for student recordings

### Target Users

**Primary Users:**
1. **Teachers** - Content managers, assignment creators, progress reviewers
2. **Students** - Content consumers, recording submitters
3. **School Administrators** - System managers, data overseers

**User Personas:**
- **Elementary Teacher (Grade 1-3):** Needs simple content management, clear student progress tracking
- **Reading Specialist:** Requires detailed analytics, intervention identification tools
- **School IT Administrator:** Wants cost-effective, privacy-compliant, easily maintainable system

### Product Goals

**Educational Goals:**
- Improve student reading fluency and pronunciation
- Provide teachers with actionable insights on student progress
- Enable scalable reading assessment across entire school districts
- Support differentiated instruction based on individual student needs

**Business Goals:**
- Eliminate recurring API costs after initial setup
- Ensure FERPA compliance and student data privacy
- Provide predictable total cost of ownership for schools
- Create scalable solution for multi-school deployment

**Technical Goals:**
- Achieve sub-second audio loading times for students
- Handle unlimited student recordings without additional costs
- Maintain 99%+ system uptime during school hours
- Enable offline operation after initial content preparation

### Core Features

#### Phase 1: Foundation & Content Management

**1.1 Curated Story Library**
- Remove custom story input functionality
- Display pre-approved educational stories only
- Organize content by grade level, subject, difficulty
- Teacher-controlled story selection and assignment

**1.2 Pre-Generated Audio Library**
- Static file serving for TTS audio files
- Multiple voice options (accent, gender) per story
- Organized file structure for efficient retrieval
- Bulk audio generation tools for teachers

**1.3 Student Recording System**
- Simplified recording workflow: Record → Preview → Submit
- Upload recordings to server storage
- Confirmation messages instead of instant analysis
- Remove real-time feedback pressure on students

#### Phase 2: Teacher Management Tools

**2.1 Assignment Creation**
- Select stories for class assignments
- Set recording deadlines and parameters
- Generate assignment codes for student access
- Bulk assignment creation for multiple classes

**2.2 Recording Review Interface**
- View all student submissions by assignment
- Play recordings with auto-generated transcripts
- Add manual feedback and grades
- Flag recordings requiring follow-up

**2.3 Progress Tracking**
- Individual student reading progress over time
- Class-wide performance analytics
- Comparison tools for before/after assessment
- Export capabilities for gradebook integration

#### Phase 3: Advanced Analytics

**3.1 Automated Analysis (Local Whisper)**
- Speech-to-text transcription for all recordings
- Reading speed and accuracy calculations
- Pause detection and fluency assessment
- Pronunciation variation identification

**3.2 Teacher Dashboard**
- Class overview with completion status
- Student progress visualization
- Automated flagging of students needing attention
- Bulk processing and report generation

**3.3 Administrative Tools**
- Multi-class management for teachers
- School-wide analytics for administrators
- System usage and storage monitoring
- Backup and maintenance tools

### User Experience Requirements

#### Student Experience

**Story Selection Flow:**
1. Student logs in and sees assigned stories only
2. Click story to see details and hear TTS audio
3. Listen to audio with word highlighting
4. Record reading when ready
5. Optional preview of their recording
6. Submit with confirmation message

**Recording Flow Requirements:**
- Maximum 3-click process from story selection to recording
- Clear visual feedback during recording process
- Simple preview functionality with standard audio controls
- Encouraging confirmation messages upon submission
- No complexity around analysis or scoring

**Accessibility Requirements:**
- Keyboard navigation support
- Screen reader compatibility
- Large button targets for young students
- High contrast visual design
- Multiple audio playback speeds

#### Teacher Experience

**Daily Workflow:**
1. Check dashboard for new student submissions
2. Review recordings with automated analysis summaries
3. Listen to flagged recordings requiring attention
4. Provide written feedback and assign grades
5. Track class progress and identify intervention needs

**Content Management:**
1. Access story library and select content for assignments
2. Bulk generate audio for new stories or voice preferences
3. Create assignments with deadlines and student access
4. Monitor audio generation progress and storage usage

**Analytics and Reporting:**
1. View class performance summaries
2. Track individual student progress over time
3. Export data for parent-teacher conferences
4. Generate reports for administrative review

### Technical Requirements

#### Architecture Overview

**Frontend (React Application):**
- Modified existing components for teacher/student roles
- Static audio file integration
- Recording upload functionality
- Teacher dashboard interface

**Backend Services:**
- File upload API for student recordings
- Audio library management system
- User authentication and authorization
- Metadata storage and retrieval

**Local Whisper Server:**
- Docker container on school Unraid server
- REST API for speech-to-text processing
- Background job queue for batch analysis
- Integration with main application database

**Storage Requirements:**
- Static audio files organized by educational content
- Student recordings with metadata
- User accounts and assignment data
- System configuration and preferences

#### Component Modifications

**StoryManager.tsx Changes:**
```typescript
// Remove custom story functionality
// Add teacher assignment integration
// Filter stories by student access permissions
// Display assignment deadlines and status
```

**TTSPlayer.tsx Changes:**
```typescript
// Integrate with static audio file library
// Remove API calls for audio generation
// Add fallback to API if static file missing
// Optimize for classroom network conditions
```

**VoiceRecorder.tsx Changes:**
```typescript
// Remove instant feedback button
// Add recording upload functionality
// Implement preview playback
// Add submission confirmation workflow
```

**Remove FeedbackDisplay.tsx:**
```typescript
// Replace with simple submission confirmation
// Teacher provides feedback through dashboard
// Focus on encouragement rather than analysis
```

#### New Components Required

**AudioLibraryService.ts:**
```typescript
interface AudioLibraryService {
  getAudioUrl(storyId: string, voiceSettings: VoiceSettings): string;
  checkAudioAvailability(storyId: string): boolean;
  generateAudioBulk(stories: Story[], voices: VoiceSettings[]): Promise<void>;
  getLibraryStatus(): AudioLibraryStatus;
}
```

**RecordingUploadService.ts:**
```typescript
interface RecordingUploadService {
  uploadRecording(audioBlob: Blob, metadata: RecordingMetadata): Promise<string>;
  getUploadProgress(uploadId: string): Promise<UploadStatus>;
  validateRecording(audioBlob: Blob): Promise<ValidationResult>;
}
```

**TeacherDashboard.tsx:**
```typescript
interface TeacherDashboardProps {
  classes: ClassInfo[];
  assignments: Assignment[];
  recordings: StudentRecording[];
  onReviewRecording: (recordingId: string) => void;
  onProvidefeedback: (recordingId: string, feedback: string) => void;
}
```

#### Database Schema

**Students Table:**
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  grade_level INTEGER,
  class_id UUID REFERENCES classes(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Assignments Table:**
```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  story_id VARCHAR(50) NOT NULL,
  class_id UUID REFERENCES classes(id),
  teacher_id UUID REFERENCES teachers(id),
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active'
);
```

**Recordings Table:**
```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  assignment_id UUID REFERENCES assignments(id),
  file_path VARCHAR(255) NOT NULL,
  duration_seconds INTEGER,
  transcript TEXT,
  analysis_data JSONB,
  teacher_feedback TEXT,
  grade VARCHAR(10),
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);
```

#### API Endpoints

**Student Endpoints:**
```typescript
GET /api/student/assignments - Get assigned stories
POST /api/student/recordings - Upload recording
GET /api/student/recordings/:id/preview - Get recording for preview
PUT /api/student/recordings/:id/submit - Final submission
```

**Teacher Endpoints:**
```typescript
GET /api/teacher/classes - Get teacher's classes
POST /api/teacher/assignments - Create new assignment
GET /api/teacher/recordings - Get student submissions
PUT /api/teacher/recordings/:id/feedback - Add feedback
POST /api/teacher/audio/generate - Bulk audio generation
```

**Audio Library Endpoints:**
```typescript
GET /api/audio/:storyId/:voiceSettings - Get audio file
POST /api/audio/generate - Generate single audio file
GET /api/audio/status - Check generation progress
```

#### File Organization Structure

**Audio Library:**
```
/public/audio-library/
  /system-stories/
    /grade-1/
      /little-red-hen/
        usa-female-bella.mp3
        usa-male-josh.mp3
        uk-female-charlotte.mp3
        uk-male-daniel.mp3
        manifest.json
    /grade-2/
      /three-little-pigs/
        [voice variations...]
  /teacher-uploads/
    /teacher-123/
      /custom-story-001/
        [voice variations...]
```

**Student Recordings:**
```
/uploads/recordings/
  /2024-25-school-year/
    /lincoln-elementary/
      /grade-3/
        /ms-smith-class/
          /little-red-hen-assignment/
            /student-sarah-123/
              recording.wav
              metadata.json
              analysis.json
```

### Implementation Timeline

#### Phase 1: Foundation (Weeks 1-2)

**Week 1: Core Infrastructure**
- Remove custom story functionality from StoryManager
- Set up static audio file serving
- Create basic file upload API for recordings
- Implement user authentication system

**Week 2: Recording System**
- Modify VoiceRecorder for upload workflow
- Add recording preview functionality
- Create submission confirmation flow
- Set up basic file organization structure

#### Phase 2: Audio Library (Weeks 3-4)

**Week 3: TTS Integration**
- Implement audio library service
- Create bulk audio generation tools
- Set up static file fallback system
- Add audio availability checking

**Week 4: Teacher Tools**
- Build basic teacher dashboard
- Add assignment creation functionality
- Implement class and student management
- Create recording review interface

#### Phase 3: Analytics (Weeks 5-6)

**Week 5: Whisper Integration**
- Set up local Whisper server
- Create speech-to-text processing pipeline
- Implement background job queue
- Add automated analysis generation

**Week 6: Advanced Dashboard**
- Build comprehensive teacher analytics
- Add progress tracking visualizations
- Implement automated flagging system
- Create bulk feedback tools

#### Phase 4: Production (Weeks 7-8)

**Week 7: Optimization**
- Performance testing and optimization
- Security audit and hardening
- Backup and recovery procedures
- Documentation and training materials

**Week 8: Deployment**
- Production deployment procedures
- System monitoring and alerting
- User training and onboarding
- Post-launch support planning

### Success Metrics

#### Educational Effectiveness
- **Student Engagement:** 90%+ assignment completion rates
- **Reading Improvement:** Measurable progress in student assessments
- **Teacher Satisfaction:** 85%+ positive feedback on usability
- **Time Efficiency:** 50% reduction in assessment review time

#### Technical Performance
- **Audio Loading:** <1 second average load time
- **System Uptime:** 99.5% during school hours
- **Storage Efficiency:** <500MB per student per school year
- **Processing Speed:** <60 seconds per 2-minute recording analysis

#### Cost Effectiveness
- **API Cost Reduction:** 95%+ reduction in ongoing fees
- **Total Cost of Ownership:** <$500 per classroom per year
- **Setup ROI:** Break-even within 6 months for typical classroom
- **Scalability:** Support 1000+ students per server

### Risk Assessment

#### Technical Risks
- **Storage Capacity:** Plan for 1TB+ per 500 students annually
- **Processing Load:** Peak usage during class assignment deadlines
- **Network Bandwidth:** Large audio file transfers during class time
- **Hardware Failure:** Single point of failure without redundancy

**Mitigation Strategies:**
- Implement storage monitoring and expansion procedures
- Design background processing for off-peak hours
- Add audio compression and progressive loading
- Plan backup server deployment for critical schools

#### Educational Risks
- **Teacher Adoption:** Resistance to new technology workflows
- **Student Privacy:** Concerns about voice recording storage
- **Technical Support:** Limited IT resources in school districts
- **Content Quality:** Inconsistent audio generation quality

**Mitigation Strategies:**
- Comprehensive teacher training and support programs
- Clear privacy policies and data retention guidelines
- Remote monitoring and automated issue detection
- Quality assurance testing for all generated audio

### Future Enhancements

#### Year 1 Roadmap
- Mobile app for tablet-based recording
- Multi-language support for ESL students
- Integration with popular learning management systems
- Advanced pronunciation scoring algorithms

#### Year 2+ Vision
- AI-powered reading level recommendations
- Cross-school district analytics and benchmarking
- Parent portal for home practice and progress viewing
- Advanced accessibility features for students with disabilities

### Conclusion

This enhanced reading practice platform represents a strategic shift from expensive API-dependent tools to a comprehensive, locally-controlled educational technology solution. By prioritizing teacher autonomy, student privacy, and cost predictability, we create a sustainable platform that schools can deploy with confidence and maintain for years to come.

The focus on pre-generated content, delayed analysis, and teacher-centered workflows aligns with educational best practices while providing the technical benefits of local processing and unlimited scalability. This approach positions the platform as a long-term investment in student reading development rather than a recurring expense.