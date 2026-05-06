import React, { useState, useEffect } from 'react';
import { Plus, User, Settings, Star, Trash2, Edit } from 'lucide-react';
import ProfileCard from './ProfileCard';
import CreateProfileModal from './CreateProfileModal';
import { UserInput, Gender } from '../../types';

type CoreDocumentStatus = 'pending' | 'generating' | 'ready' | 'failed';

interface UserProfile extends UserInput {
  id: string;
  isDefault: boolean;
  createdAt: string;
  coreDocumentStatus?: CoreDocumentStatus;
}

interface ProfileManagerProps {
  onProfileSelect?: (profile: UserProfile) => void;
  currentProfileId?: string;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({
  onProfileSelect,
  currentProfileId
}) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const PROFILES_STORAGE_KEY = 'lifekline_profiles';

  // Load profiles from API first, with localStorage as fallback
  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoading(true);
      try {
        // Try API first
        const response = await fetch('/api/profiles', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const apiProfiles: UserProfile[] = data.profiles.map((p: any) => ({
            id: p.id,
            name: p.name,
            gender: p.gender,
            birthYear: p.birthYear?.toString() || '',
            yearPillar: p.yearPillar || '',
            monthPillar: p.monthPillar || '',
            dayPillar: p.dayPillar || '',
            hourPillar: p.hourPillar || '',
            startAge: p.startAge?.toString() || '',
            firstDaYun: p.firstDaYun || '',
            birthPlace: p.birthPlace || '',
            isDefault: p.isDefault || false,
            coreDocumentStatus: p.coreDocumentStatus || 'pending',
            createdAt: p.createdAt,
          }));
          setProfiles(apiProfiles);
          // Sync to localStorage as backup
          localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(apiProfiles));
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('API fetch failed, using localStorage:', err);
      }

      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(PROFILES_STORAGE_KEY);
        if (saved) {
          setProfiles(JSON.parse(saved));
        }
      }
      setIsLoading(false);
    };

    loadProfiles();
  }, []);

  // Save profiles to localStorage
  const saveProfiles = async (updatedProfiles: UserProfile[]) => {
    try {
      // Save to localStorage for now
      if (typeof window !== 'undefined') {
        localStorage.setItem('lifekline_profiles', JSON.stringify(updatedProfiles));
      }

      // TODO: Save to API when backend is ready
      // await fetch('/api/profiles', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ profiles: updatedProfiles })
      // });

      setProfiles(updatedProfiles);
    } catch (err) {
      setError('保存档案失败');
      console.error('Error saving profiles:', err);
    }
  };

  const handleCreateProfile = async (profileData: UserInput) => {
    const newProfile: UserProfile = {
      ...profileData,
      id: Date.now().toString(),
      isDefault: profiles.length === 0, // First profile is default
      createdAt: new Date().toISOString(),
    };

    const updatedProfiles = [...profiles, newProfile];
    await saveProfiles(updatedProfiles);
    setShowCreateModal(false);
  };

  const handleEditProfile = async (profileData: UserInput) => {
    if (!editingProfile) return;

    const updatedProfiles = profiles.map(p =>
      p.id === editingProfile.id
        ? { ...p, ...profileData }
        : p
    );

    await saveProfiles(updatedProfiles);
    setEditingProfile(null);
  };

  const handleDeleteProfile = async (profileId: string) => {
    const profileToDelete = profiles.find(p => p.id === profileId);

    // Don't allow deletion if it's the only profile
    if (profiles.length <= 1) {
      setError('不能删除唯一的档案');
      return;
    }

    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // If deleting default profile, make another one default
        let updatedProfiles = profiles.filter(p => p.id !== profileId);
        if (profileToDelete?.isDefault && updatedProfiles.length > 0) {
          updatedProfiles[0].isDefault = true;
        }

        // Remove from local state
        setProfiles(updatedProfiles);
        // Update localStorage
        localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedProfiles));
        return;
      }
    } catch (err) {
      console.error('API delete failed, using localStorage only:', err);
    }

    // Fallback to localStorage only delete
    let updatedProfiles = profiles.filter(p => p.id !== profileId);
    if (profileToDelete?.isDefault && updatedProfiles.length > 0) {
      updatedProfiles[0].isDefault = true;
    }
    setProfiles(updatedProfiles);
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updatedProfiles));
  };

  const handleSetDefault = async (profileId: string) => {
    const updatedProfiles = profiles.map(p => ({
      ...p,
      isDefault: p.id === profileId
    }));

    await saveProfiles(updatedProfiles);
  };

  const handleRegenerateCore = async (profileId: string) => {
    try {
      // Update status to generating immediately
      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, coreDocumentStatus: 'generating' as CoreDocumentStatus } : p
      ));

      const response = await fetch(`/api/profiles/${profileId}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Update with response data
        setProfiles(prev => prev.map(p =>
          p.id === profileId ? { ...p, coreDocumentStatus: data.coreDocumentStatus || 'generating' } : p
        ));
      } else {
        // On error, set to failed
        setProfiles(prev => prev.map(p =>
          p.id === profileId ? { ...p, coreDocumentStatus: 'failed' as CoreDocumentStatus } : p
        ));
      }
    } catch (err) {
      console.error('Failed to regenerate core document:', err);
      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, coreDocumentStatus: 'failed' as CoreDocumentStatus } : p
      ));
    }
  };

  const openEditModal = (profile: UserProfile) => {
    setEditingProfile(profile);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingProfile(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">档案管理</h1>
                <p className="text-gray-600">管理你的八字档案与命理分析记录</p>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              disabled={profiles.length >= 10}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              <span>添加档案</span>
            </button>
          </div>

          {profiles.length >= 10 && (
            <p className="mt-3 text-sm text-amber-600">
              最多可创建 10 个档案。请删除已有档案后再添加新档案。
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isCurrent={profile.id === currentProfileId}
              onEdit={() => openEditModal(profile)}
              onDelete={() => handleDeleteProfile(profile.id)}
              onSetDefault={() => handleSetDefault(profile.id)}
              onSelect={() => onProfileSelect?.(profile)}
              onRegenerateCore={() => handleRegenerateCore(profile.id)}
            />
          ))}
        </div>

        {/* Empty State */}
        {profiles.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无档案</h3>
            <p className="text-gray-600 mb-6">创建第一个档案，开始进行命理分析</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>创建第一个档案</span>
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CreateProfileModal
          onClose={closeModal}
          onSave={handleCreateProfile}
        />
      )}

      {editingProfile && (
        <CreateProfileModal
          onClose={closeModal}
          onSave={handleEditProfile}
          initialData={editingProfile}
        />
      )}
    </div>
  );
};

export default ProfileManager;
