import React, { useState, useEffect } from 'react';
import { Book, Filter, GraduationCap, BookOpen } from 'lucide-react';
import { Story } from '../types';

interface StoryManagerProps {
  onStorySelect: (story: Story) => void;
  selectedStory: Story | null;
  initialStories?: Story[];
}

export const StoryManager: React.FC<StoryManagerProps> = ({
  onStorySelect,
  selectedStory,
  initialStories,
}) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [filteredStories, setFilteredStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [selectedSubject, setSelectedSubject] = useState<string | 'all'>('all');

  useEffect(() => {
    if (initialStories && initialStories.length > 0) {
      // Use provided stories instead of fetching
      setStories(initialStories);
      setFilteredStories(initialStories);
      setLoading(false);
    } else {
      // Fetch stories if not provided
      fetch('/stories.json')
        .then(response => response.json())
        .then(data => {
          setStories(data);
          setFilteredStories(data);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error loading stories:', error);
          setLoading(false);
        });
    }
  }, [initialStories]);

  // Filter stories based on selected grade and subject
  useEffect(() => {
    let filtered = stories;
    
    if (selectedGrade !== 'all') {
      filtered = filtered.filter(story => story.gradeLevel === selectedGrade);
    }
    
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(story => story.subject === selectedSubject);
    }
    
    setFilteredStories(filtered);
  }, [stories, selectedGrade, selectedSubject]);

  // Get unique subjects for filter dropdown
  const uniqueSubjects = Array.from(new Set(stories.map(story => story.subject)));
  const uniqueGrades = Array.from(new Set(stories.map(story => story.gradeLevel))).sort((a, b) => a - b);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Book className="h-6 w-6 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Educational Story Library</h2>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500">
          <p>Loading stories...</p>
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-blue-600" />
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Grades</option>
            {uniqueGrades.map(grade => (
              <option key={grade} value={grade}>Grade {grade}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-green-600" />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Subjects</option>
            {uniqueSubjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-600 ml-auto">
          {filteredStories.length} {filteredStories.length === 1 ? 'story' : 'stories'} found
        </div>
      </div>

      {/* Story Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredStories.map((story) => (
          <button
            key={story.id}
            onClick={() => onStorySelect(story)}
            className={`p-4 rounded-xl text-left transition-all duration-200 hover:scale-105 hover:shadow-md ${
              selectedStory?.id === story.id
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <Book className="h-5 w-5 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{story.title}</h3>
                <p className="text-sm opacity-80 line-clamp-2 mb-2">
                  {story.text.substring(0, 100)}...
                </p>
              </div>
            </div>
            
            {/* Story Metadata */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  Grade {story.gradeLevel}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${getDifficultyColor(story.difficulty)}`}>
                  {story.difficulty}
                </span>
              </div>
              
              <div className="text-xs opacity-75">
                <div>{story.subject} • {story.wordCount} words</div>
                <div className="mt-1">
                  {story.themes.slice(0, 2).join(', ')}
                  {story.themes.length > 2 && ` +${story.themes.length - 2} more`}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filteredStories.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Book className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No stories found matching your filters.</p>
          <p className="text-sm">Try adjusting your grade level or subject selection.</p>
        </div>
      )}
    </div>
  );
};