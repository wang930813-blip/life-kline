import { Gender } from '../types';

export interface CurrentProfile {
  id: string;
  name: string;
  gender: Gender;
  birthYear: number;
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  hourPillar: string;
  birthPlace?: string;
  isDefault?: boolean;
}

const STORAGE_KEY = 'lifekline_current_profile';
const EVENT_NAME = 'profileChanged';

const normalizeProfile = (profile: any): CurrentProfile | null => {
  if (!profile?.id) return null;
  return {
    id: profile.id,
    name: profile.name || '',
    gender: profile.gender === 'female' || profile.gender === Gender.FEMALE ? Gender.FEMALE : Gender.MALE,
    birthYear: Number(profile.birthYear || 0),
    yearPillar: profile.yearPillar || '',
    monthPillar: profile.monthPillar || '',
    dayPillar: profile.dayPillar || '',
    hourPillar: profile.hourPillar || '',
    birthPlace: profile.birthPlace || '',
    isDefault: Boolean(profile.isDefault),
  };
};

export const getStoredCurrentProfile = (): CurrentProfile | null => {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return normalizeProfile(JSON.parse(saved));
  } catch {
    return null;
  }
};

export const setStoredCurrentProfile = (profile: any) => {
  if (typeof window === 'undefined') return;
  const normalized = normalizeProfile(profile);
  if (!normalized) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const clearStoredCurrentProfile = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const syncCurrentProfileFromServer = async (): Promise<CurrentProfile | null> => {
  try {
    const [profilesRes, prefRes] = await Promise.all([
      fetch('/api/profiles', { credentials: 'include' }),
      fetch('/api/preferences', { credentials: 'include' }),
    ]);

    if (!profilesRes.ok) return getStoredCurrentProfile();
    const profilesData = await profilesRes.json();
    const profiles = (profilesData.profiles || []).map(normalizeProfile).filter(Boolean) as CurrentProfile[];

    let defaultProfileId: string | null = null;
    if (prefRes.ok) {
      const prefData = await prefRes.json();
      defaultProfileId = prefData.preferences?.defaultProfileId || null;
    }

    const selected =
      profiles.find((p) => p.id === defaultProfileId) ||
      profiles.find((p) => p.isDefault) ||
      profiles[0] ||
      null;

    if (selected) {
      setStoredCurrentProfile(selected);
      return selected;
    }

    clearStoredCurrentProfile();
    return null;
  } catch {
    return getStoredCurrentProfile();
  }
};

export const updateServerDefaultProfile = async (profileId: string) => {
  await fetch(`/api/profiles/${profileId}/set-default`, {
    method: 'POST',
    credentials: 'include',
  });

  await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ defaultProfileId: profileId }),
  });
};

export const CURRENT_PROFILE_EVENT = EVENT_NAME;
