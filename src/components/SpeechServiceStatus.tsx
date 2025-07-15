import React, { useState, useEffect } from 'react';
import { whisperService } from '../services/whisperService';

interface ServiceStatus {
  whisperAvailable: boolean;
  whisperUrl: string;
}

export const SpeechServiceStatus: React.FC = () => {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const whisperAvailable = await whisperService.checkHealth();
        const whisperUrl = import.meta.env.VITE_WHISPER_SERVER_URL || 'http://localhost:8000';
        
        setStatus({
          whisperAvailable,
          whisperUrl,
        });
      } catch (error) {
        console.error('Failed to check Whisper service status:', error);
        setStatus({
          whisperAvailable: false,
          whisperUrl: import.meta.env.VITE_WHISPER_SERVER_URL || 'http://localhost:8000',
        });
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span>Checking Whisper server...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center space-x-2 text-sm text-red-600">
        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
        <span>Speech service status unavailable</span>
      </div>
    );
  }

  const getStatusColor = (available: boolean) => available ? 'green' : 'red';
  const getStatusText = (available: boolean) => available ? 'Connected' : 'Offline';

  return (
    <div className="bg-gray-50 rounded-lg p-4 border">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Speech Recognition Service</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 bg-${getStatusColor(status.whisperAvailable)}-500 rounded-full`}></span>
            <span className="text-sm text-gray-600">Local Whisper Server</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full bg-${getStatusColor(status.whisperAvailable)}-100 text-${getStatusColor(status.whisperAvailable)}-700`}>
            {getStatusText(status.whisperAvailable)}
          </span>
        </div>

        <div className="text-xs text-gray-500">
          <span>Server URL: </span>
          <code className="bg-gray-100 px-1 py-0.5 rounded">{status.whisperUrl}</code>
        </div>

        {status.whisperAvailable ? (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              ✓ Whisper server is online and ready for speech analysis
            </p>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              ✗ Unable to connect to Whisper server. Please check that the server is running at the configured URL.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};