import React from 'react';
import { Settings, User, Globe } from 'lucide-react';
import { VoiceSettings as VoiceSettingsType } from '../types';

interface VoiceSettingsProps {
  settings: VoiceSettingsType;
  onSettingsChange: (settings: VoiceSettingsType) => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-xl">
          <Settings className="h-6 w-6 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Voice Settings</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="flex items-center gap-2 text-lg font-medium text-gray-700 mb-3">
            <Globe className="h-5 w-5" />
            Accent
          </label>
          <div className="space-y-2">
            {(['USA', 'UK'] as const).map((accent) => (
              <button
                key={accent}
                onClick={() => onSettingsChange({ ...settings, accent })}
                className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                  settings.accent === accent
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <span className="font-medium">{accent}</span>
                <span className="ml-2 text-sm opacity-80">
                  {accent === 'USA' ? '🇺🇸 American' : '🇬🇧 British'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-lg font-medium text-gray-700 mb-3">
            <User className="h-5 w-5" />
            Gender
          </label>
          <div className="space-y-2">
            {(['Male', 'Female'] as const).map((gender) => (
              <button
                key={gender}
                onClick={() => onSettingsChange({ ...settings, gender })}
                className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${
                  settings.gender === gender
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <span className="font-medium">{gender}</span>
                <span className="ml-2 text-sm opacity-80">
                  {gender === 'Male' ? '👨 Male Voice' : '👩 Female Voice'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};