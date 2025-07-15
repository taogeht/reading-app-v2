import React from 'react';
import { CheckCircle, XCircle, Clock, TrendingUp, Award, RotateCcw, MessageSquare } from 'lucide-react';
import { FeedbackData, Story } from '../types';
import { getReadingPaceColor, getReadingPaceMessage } from '../utils/audioAnalysis';

interface FeedbackDisplayProps {
  feedback: FeedbackData;
  story: Story;
  onTryAgain: () => void;
}

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  feedback,
  story,
  onTryAgain,
}) => {
  const getWordClassName = (status: string) => {
    switch (status) {
      case 'correct':
        return 'bg-green-200 text-green-800 border border-green-300';
      case 'incorrect':
        return 'bg-orange-200 text-orange-800 border border-orange-300';
      case 'missed':
        return 'bg-red-200 text-red-800 border border-red-300';
      case 'extra':
        return 'bg-purple-200 text-purple-800 border border-purple-300';
      default:
        return '';
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-600';
    if (accuracy >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAccuracyMessage = (accuracy: number) => {
    if (accuracy >= 95) return 'Outstanding reading! Perfect pronunciation!';
    if (accuracy >= 90) return 'Excellent reading! Great job!';
    if (accuracy >= 80) return 'Very good reading! Keep it up!';
    if (accuracy >= 70) return 'Good effort! Practice makes perfect!';
    if (accuracy >= 60) return 'Nice try! Keep practicing to improve!';
    return 'Keep working at it! Every practice session helps!';
  };

  const getAccuracyIcon = (accuracy: number) => {
    if (accuracy >= 90) return <Award className="h-8 w-8 text-yellow-500" />;
    if (accuracy >= 75) return <TrendingUp className="h-8 w-8 text-green-500" />;
    return <Clock className="h-8 w-8 text-blue-500" />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-xl">
          {getAccuracyIcon(feedback.accuracy)}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Your Reading Analysis</h2>
          <p className="text-gray-600">Powered by Local Whisper AI</p>
        </div>
      </div>

      {/* Overall Score */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
          <div className={`text-4xl font-bold mb-2 ${getAccuracyColor(feedback.accuracy)}`}>
            {feedback.accuracy}%
          </div>
          <div className="text-gray-700 font-medium mb-1">Reading Accuracy</div>
          <div className={`text-sm ${getAccuracyColor(feedback.accuracy)} font-medium`}>
            {getAccuracyMessage(feedback.accuracy)}
          </div>
        </div>

        <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
          <div className={`text-xl font-bold mb-2 ${getReadingPaceColor(feedback.readingPace)}`}>
            {feedback.readingPace === 'just-right' ? 'Perfect Pace!' : 
             feedback.readingPace === 'too-fast' ? 'Too Fast' : 'Too Slow'}
          </div>
          <div className="text-gray-700 font-medium mb-1">Reading Speed</div>
          <div className={`text-sm ${getReadingPaceColor(feedback.readingPace)} font-medium`}>
            {getReadingPaceMessage(feedback.readingPace)}
          </div>
          {feedback.wordsPerMinute && (
            <div className="text-xs text-gray-500 mt-1">
              {Math.round(feedback.wordsPerMinute)} words/min
            </div>
          )}
        </div>

        <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
          <div className="text-2xl font-bold mb-2 text-orange-600">
            {feedback.pauseCount}
          </div>
          <div className="text-gray-700 font-medium mb-1">Pauses Detected</div>
          <div className="text-sm text-orange-600 font-medium">
            {feedback.pauseCount <= 2 ? 'Smooth reading flow!' : 
             feedback.pauseCount <= 4 ? 'Good flow with some pauses' : 
             'Try for smoother reading'}
          </div>
        </div>

        {feedback.fluencyScore !== undefined && (
          <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
            <div className={`text-3xl font-bold mb-2 ${
              feedback.fluencyScore >= 80 ? 'text-green-600' :
              feedback.fluencyScore >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {Math.round(feedback.fluencyScore)}%
            </div>
            <div className="text-gray-700 font-medium mb-1">Fluency Score</div>
            <div className={`text-sm font-medium ${
              feedback.fluencyScore >= 80 ? 'text-green-600' :
              feedback.fluencyScore >= 60 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {feedback.fluencyScore >= 80 ? 'Excellent flow!' :
               feedback.fluencyScore >= 60 ? 'Good rhythm' :
               'Keep practicing!'}
            </div>
          </div>
        )}
      </div>

      {/* Detailed Statistics */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-800">Words Read Correctly</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{feedback.correctWords.length}</div>
        </div>

        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-orange-600" />
            <span className="font-semibold text-orange-800">Words Needing Practice</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">{feedback.incorrectWords.length}</div>
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-800">Words Missed</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{feedback.missedWords.length}</div>
        </div>
      </div>

      {/* Full Transcription */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-blue-600" />
          What You Said
        </h3>
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="text-lg text-gray-700 italic leading-relaxed">
            "{feedback.transcript}"
          </div>
          <div className="text-sm text-blue-600 mt-3 font-medium">
            📝 This is exactly what our AI heard you say
          </div>
        </div>
      </div>

      {/* Word Analysis */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>🔍</span>
          Word-by-Word Comparison
        </h3>
        <div className="bg-gray-50 rounded-xl p-6 border">
          <div className="space-y-3">
            {feedback.wordAnalysis.map((analysis, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border-l-4 ${
                  analysis.status === 'correct' ? 'border-green-500 bg-green-50' :
                  analysis.status === 'incorrect' ? 'border-orange-500 bg-orange-50' :
                  analysis.status === 'missed' ? 'border-red-500 bg-red-50' :
                  'border-purple-500 bg-purple-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-600">Expected:</span>
                      <span className="font-semibold text-gray-800">
                        {analysis.status === 'extra' ? '(not in original)' : analysis.originalWord}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-600">You said:</span>
                      <span className={`font-semibold ${
                        analysis.status === 'correct' ? 'text-green-700' :
                        analysis.status === 'incorrect' ? 'text-orange-700' :
                        analysis.status === 'missed' ? 'text-red-700 italic' :
                        'text-purple-700'
                      }`}>
                        {analysis.spokenWord || '(not spoken)'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      analysis.status === 'correct' ? 'bg-green-200 text-green-800' :
                      analysis.status === 'incorrect' ? 'bg-orange-200 text-orange-800' :
                      analysis.status === 'missed' ? 'bg-red-200 text-red-800' :
                      'bg-purple-200 text-purple-800'
                    }`}>
                      {analysis.status === 'correct' ? '✓ Correct' :
                       analysis.status === 'incorrect' ? '⚠ Different' :
                       analysis.status === 'missed' ? '❌ Missed' :
                       '+ Extra'}
                    </span>
                    {analysis.confidence && (
                      <span className="text-xs text-gray-500">
                        {Math.round(analysis.confidence * 100)}% confident
                      </span>
                    )}
                    {analysis.timing && (
                      <span className="text-xs text-gray-400">
                        {analysis.timing.startTime.toFixed(1)}s-{analysis.timing.endTime.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-800 mb-3">Reading Analysis Legend</h4>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="w-4 h-4 bg-green-200 border border-green-300 rounded"></div>
            <span className="text-sm text-green-800 font-medium">Correct pronunciation</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="w-4 h-4 bg-orange-200 border border-orange-300 rounded"></div>
            <span className="text-sm text-orange-800 font-medium">Different pronunciation</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="w-4 h-4 bg-red-200 border border-red-300 rounded"></div>
            <span className="text-sm text-red-800 font-medium">Word skipped</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="w-4 h-4 bg-purple-200 border border-purple-300 rounded"></div>
            <span className="text-sm text-purple-800 font-medium">Extra word added</span>
          </div>
        </div>
      </div>

      {/* Encouragement Message */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🌟</span>
          <span className="font-semibold text-gray-800">Keep Up the Great Work!</span>
        </div>
        <p className="text-gray-700">
          {feedback.accuracy >= 90 
            ? "You're doing amazing! Your reading skills are excellent. Keep practicing to maintain this high level!"
            : feedback.accuracy >= 75
            ? "You're making great progress! Focus on the highlighted words and keep practicing regularly."
            : "Every practice session makes you better! Don't give up - improvement comes with consistent effort."
          }
        </p>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={onTryAgain}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <RotateCcw className="h-5 w-5" />
          Practice Again
        </button>
      </div>
    </div>
  );
};