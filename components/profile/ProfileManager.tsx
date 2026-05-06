import React, { useEffect, useState } from 'react';
import { Plus, User } from 'lucide-react';
import ProfileCard from './ProfileCard';
import CreateProfileModal from './CreateProfileModal';
import { UserInput, Gender } from '../../types';
import { setStoredCurrentProfile, updateServerDefaultProfile } from '../../utils/currentProfile';

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

const PROFILES_STORAGE_KEY = 'lifekline_profiles';

const normalizeApiProfile = (p: any): UserProfile => ({
  id: p.id,
  name: p.name || '',
  gender: p.gender === 'male' ? Gender.MALE : Gender.FEMALE,
  birthYear: p.birthYear?.toString() || '',
  yearPillar: p.yearPillar || '',
  monthPillar: p.monthPillar || '',
  dayPillar: p.dayPillar || '',
  hourPillar: p.hourPillar || '',
  startAge: p.startAge?.toString() || '',
  firstDaYun: p.firstDaYun || '',
  birthPlace: p.birthPlace || '',
  modelName: '',
  apiBaseUrl: '',
  apiKey: '',
  useCustomApi: false,
  isDefault: Boolean(p.isDefault),
  coreDocumentStatus: p.coreDocumentStatus || 'pending',
  createdAt: p.createdAt,
});

const ProfileManager: React.FC<ProfileManagerProps> = ({
  onProfileSelect,
  currentProfileId,
}) => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persistLocalProfiles = (nextProfiles: UserProfile[]) => {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
    setProfiles(nextProfiles);
  };

  const loadProfiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/profiles', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const apiProfiles: UserProfile[] = (data.profiles || []).map(normalizeApiProfile);
        persistLocalProfiles(apiProfiles);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.error('Failed to load profiles from API:', err);
    }

    const saved = localStorage.getItem(PROFILES_STORAGE_KEY);
    setProfiles(saved ? JSON.parse(saved) : []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreateProfile = async (profileData: UserInput) => {
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: profileData.name,
          gender: profileData.gender === Gender.MALE ? 'male' : 'female',
          birthYear: parseInt(profileData.birthYear, 10) || 0,
          yearPillar: profileData.yearPillar,
          monthPillar: profileData.monthPillar,
          dayPillar: profileData.dayPillar,
          hourPillar: profileData.hourPillar,
          startAge: profileData.startAge ? parseInt(profileData.startAge, 10) : undefined,
          firstDaYun: profileData.firstDaYun,
          birthPlace: profileData.birthPlace,
          isDefault: profiles.length === 0,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '创建档案失败');

      const nextProfiles = [...profiles, normalizeApiProfile(data.profile)];
      persistLocalProfiles(nextProfiles);
      setStoredCurrentProfile(nextProfiles.find((p) => p.isDefault) || nextProfiles[nextProfiles.length - 1]);
      setShowCreateModal(false);
    } catch (err: any) {
      setError(err.message || '创建档案失败');
    }
  };

  const handleEditProfile = async (profileData: UserInput) => {
    if (!editingProfile) return;

    try {
      const response = await fetch(`/api/profiles/${editingProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: profileData.name,
          gender: profileData.gender === Gender.MALE ? 'male' : 'female',
          birthYear: parseInt(profileData.birthYear, 10) || 0,
          yearPillar: profileData.yearPillar,
          monthPillar: profileData.monthPillar,
          dayPillar: profileData.dayPillar,
          hourPillar: profileData.hourPillar,
          startAge: profileData.startAge ? parseInt(profileData.startAge, 10) : undefined,
          firstDaYun: profileData.firstDaYun,
          birthPlace: profileData.birthPlace,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '更新档案失败');

      const nextProfiles = profiles.map((p) => (p.id === editingProfile.id ? normalizeApiProfile(data.profile) : p));
      persistLocalProfiles(nextProfiles);
      if (editingProfile.id === currentProfileId) {
        const updatedCurrent = nextProfiles.find((p) => p.id === editingProfile.id);
        if (updatedCurrent) setStoredCurrentProfile(updatedCurrent);
      }
      setEditingProfile(null);
    } catch (err: any) {
      setError(err.message || '更新档案失败');
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (profiles.length <= 1) {
      setError('不能删除唯一的档案');
      return;
    }

    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '删除档案失败');

      const nextProfiles = profiles.filter((p) => p.id !== profileId);
      persistLocalProfiles(nextProfiles);
      if (profileId === currentProfileId && nextProfiles[0]) {
        setStoredCurrentProfile(nextProfiles[0]);
      }
    } catch (err: any) {
      setError(err.message || '删除档案失败');
    }
  };

  const handleSetDefault = async (profileId: string) => {
    try {
      await updateServerDefaultProfile(profileId);

      const nextProfiles = profiles.map((p) => ({
        ...p,
        isDefault: p.id === profileId,
      }));
      persistLocalProfiles(nextProfiles);
      const selected = nextProfiles.find((p) => p.id === profileId);
      if (selected) setStoredCurrentProfile(selected);
    } catch (err: any) {
      setError(err.message || '设置默认档案失败');
    }
  };

  const handleRegenerateCore = async (profileId: string) => {
    try {
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, coreDocumentStatus: 'generating' } : p))
      );

      const response = await fetch(`/api/profiles/${profileId}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || '重新生成失败');

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId ? { ...p, coreDocumentStatus: data.coreDocumentStatus || 'generating' } : p
        )
      );
    } catch (err) {
      console.error('Failed to regenerate core document:', err);
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, coreDocumentStatus: 'failed' } : p))
      );
    }
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
            <p className="mt-3 text-sm text-amber-600">最多可创建 10 个档案，请先删除已有档案。</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isCurrent={profile.id === currentProfileId}
              onEdit={() => setEditingProfile(profile)}
              onDelete={() => handleDeleteProfile(profile.id)}
              onSetDefault={() => handleSetDefault(profile.id)}
              onSelect={() => onProfileSelect?.(profile)}
              onRegenerateCore={() => handleRegenerateCore(profile.id)}
            />
          ))}
        </div>

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

      {showCreateModal && <CreateProfileModal onClose={closeModal} onSave={handleCreateProfile} />}
      {editingProfile && <CreateProfileModal onClose={closeModal} onSave={handleEditProfile} initialData={editingProfile} />}
    </div>
  );
};

export default ProfileManager;
