import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, User, Settings, Star } from 'lucide-react';
import { UserInput, Gender } from '../../types';

interface UserProfile extends UserInput {
  id: string;
  isDefault: boolean;
  createdAt: string;
}

interface ProfileSelectorProps {
  currentProfile?: UserProfile;
  onProfileChange?: (profile: UserProfile) => void;
  onManageProfiles?: () => void;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  currentProfile,
  onProfileChange,
  onManageProfiles
}) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load profiles on mount
  useEffect(() => {
    const loadProfiles = () => {
      if (typeof window !== 'undefined') {
        const savedProfiles = localStorage.getItem('lifekline_profiles');
        if (savedProfiles) {
          const parsed = JSON.parse(savedProfiles);
          setProfiles(parsed);
        }
      }
    };

    loadProfiles();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileSelect = (profile: UserProfile) => {
    onProfileChange?.(profile);
    setIsOpen(false);
  };

  const getGenderIcon = (gender: Gender) => {
    return gender === Gender.MALE ? '♂️' : '♀️';
  };

  const getDisplayName = (profile: UserProfile) => {
    return profile.name || '未命名档案';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-0 max-w-xs"
      >
        <User className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <span className="truncate text-sm font-medium text-gray-900">
          {currentProfile ? (
            <span className="flex items-center space-x-1">
              <span>{getDisplayName(currentProfile)}</span>
              <span className="text-base">{getGenderIcon(currentProfile.gender)}</span>
            </span>
          ) : (
            '选择档案'
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">档案列表</h3>
              <button
                onClick={onManageProfiles}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Settings className="w-3 h-3" />
                <span>管理</span>
              </button>
            </div>
          </div>

          {/* Profile List */}
          <div className="max-h-64 overflow-y-auto">
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileSelect(profile)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    currentProfile?.id === profile.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-lg">
                        {getGenderIcon(profile.gender)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getDisplayName(profile)}
                          </p>
                          {profile.isDefault && (
                            <Star className="w-3 h-3 text-amber-500 fill-current flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {profile.birthYear ? `出生年份：${profile.birthYear}` : '出生年份：--'} • {profile.birthPlace || '出生地点：--'}
                        </p>
                      </div>
                    </div>
                    {currentProfile?.id === profile.id && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                    )}
                  </div>

                  {/* Bazi Preview */}
                  {profile.yearPillar && profile.monthPillar && profile.dayPillar && profile.hourPillar && (
                    <div className="mt-2 grid grid-cols-4 gap-1 text-xs">
                      <div className="text-center font-mono text-gray-600">
                        {profile.yearPillar}
                      </div>
                      <div className="text-center font-mono text-gray-600">
                        {profile.monthPillar}
                      </div>
                      <div className="text-center font-mono text-gray-600">
                        {profile.dayPillar}
                      </div>
                      <div className="text-center font-mono text-gray-600">
                        {profile.hourPillar}
                      </div>
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">暂无档案</p>
                <button
                  onClick={onManageProfiles}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  创建第一个档案
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {profiles.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-600 text-center">
                已保存 {profiles.length} 个档案
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileSelector;
