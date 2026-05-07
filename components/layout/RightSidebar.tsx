import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, TrendingUp, Star, ChevronRight, Save, User, AlertCircle, Check, X } from 'lucide-react';
import { CTACard } from '../widgets/CTACard';
import { TrendingCard } from '../widgets/TrendingCard';
import { DailyFortuneCard } from '../fortune/DailyFortuneCard';
import { ProfileInfo } from '../fortune/ProfileQuickSwitch';
import { CURRENT_PROFILE_EVENT, getStoredCurrentProfile, setStoredCurrentProfile, syncCurrentProfileFromServer } from '../../utils/currentProfile';
import { normalizeText } from '../../utils/normalizeText';

const PROFILES_STORAGE_KEY = 'lifekline_profiles';
const HISTORY_STORAGE_KEY = 'lifekline_history';

interface UserProfile {
  id: string;
  name: string;
  gender: string;
  birthYear: number;
  yearPillar?: string;
  monthPillar?: string;
  dayPillar?: string;
  hourPillar?: string;
}

interface CurrentCalculation {
  name?: string;
  birthYear?: string;
  gender?: string;
  yearPillar: string;
  monthPillar: string;
  dayPillar: string;
  hourPillar: string;
}

// 当前档案显示卡片
const CurrentProfileCard: React.FC<{
  profile: UserProfile | null;
  profiles: ProfileInfo[];
  onProfileChange: (profileId: string) => void;
  onManageProfiles: () => void;
}> = ({ profile, profiles, onProfileChange, onManageProfiles }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  if (!profile && profiles.length === 0) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-sm sm:text-base truncate">创建八字档案</h3>
            <p className="text-xs text-gray-500 truncate">保存八字以查看运势分析</p>
          </div>
        </div>
        <button
          onClick={onManageProfiles}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          创建档案
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-sm sm:text-base truncate">选择档案</h3>
            <p className="text-xs text-gray-500 truncate">请选择要查看运势的档案</p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm text-left flex items-center justify-between hover:border-indigo-300 transition-colors"
          >
            <span className="text-gray-500 truncate">选择档案...</span>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showDropdown ? 'rotate-90' : ''}`} />
          </button>
          {showDropdown && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onProfileChange(p.id);
                    setShowDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 transition-colors"
                >
                  <div className="font-medium text-gray-800 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {p.yearPillar} {p.monthPillar} {p.dayPillar} {p.hourPillar}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-sm sm:text-base truncate">{profile.name}</h3>
            <p className="text-xs text-gray-500 truncate">当前查看档案</p>
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            title="切换档案"
          >
            <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showDropdown ? 'rotate-90' : ''}`} />
          </button>
          {showDropdown && profiles.length > 1 && (
            <div className="absolute z-20 right-0 w-48 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
              {profiles.filter(p => p.id !== profile.id).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onProfileChange(p.id);
                    setShowDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50 transition-colors"
                >
                  <div className="font-medium text-gray-800 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {p.yearPillar} {p.monthPillar} {p.dayPillar} {p.hourPillar}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 四柱显示 */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3">
        <div className="text-center bg-white/60 rounded-lg py-1.5 sm:py-2 px-1">
          <div className="text-xs text-gray-500 mb-0.5 truncate">年柱</div>
          <div className="font-bold text-xs sm:text-sm text-indigo-700 font-serif-sc truncate">{profile.yearPillar}</div>
        </div>
        <div className="text-center bg-white/60 rounded-lg py-1.5 sm:py-2 px-1">
          <div className="text-xs text-gray-500 mb-0.5 truncate">月柱</div>
          <div className="font-bold text-xs sm:text-sm text-indigo-700 font-serif-sc truncate">{profile.monthPillar}</div>
        </div>
        <div className="text-center bg-white/60 rounded-lg py-1.5 sm:py-2 px-1">
          <div className="text-xs text-gray-500 mb-0.5 truncate">日柱</div>
          <div className="font-bold text-xs sm:text-sm text-indigo-700 font-serif-sc truncate">{profile.dayPillar}</div>
        </div>
        <div className="text-center bg-white/60 rounded-lg py-1.5 sm:py-2 px-1">
          <div className="text-xs text-gray-500 mb-0.5 truncate">时柱</div>
          <div className="font-bold text-xs sm:text-sm text-indigo-700 font-serif-sc truncate">{profile.hourPillar}</div>
        </div>
      </div>

      <button
        onClick={onManageProfiles}
        className="w-full py-1.5 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors"
      >
        管理我的档案
      </button>
    </div>
  );
};

// 保存当前命盘提示组件
const SaveCurrentBaziPrompt: React.FC<{
  currentBazi: CurrentCalculation;
  onSave: (name: string) => void;
  onDismiss: () => void;
}> = ({ currentBazi, onSave, onDismiss }) => {
  const [showInput, setShowInput] = useState(false);
  const [profileName, setProfileName] = useState(currentBazi.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!profileName.trim()) return;
    setSaving(true);
    onSave(profileName.trim());
  };

  if (!showInput) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-800 text-sm mb-1">保存当前命盘</h4>
            <p className="text-xs text-gray-600 mb-3">
              检测到您刚完成一次测算，是否将此八字保存为档案以便查看运势?
            </p>
            <div className="text-xs text-gray-500 mb-3 bg-white/50 rounded-lg p-2 overflow-x-auto">
              <span className="font-medium">八字：</span>
              <span className="whitespace-nowrap">
                {currentBazi.yearPillar} {currentBazi.monthPillar} {currentBazi.dayPillar} {currentBazi.hourPillar}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInput(true)}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">保存档案</span>
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm flex-shrink-0"
              >
                暂不
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 text-sm">为此命盘取个名字</h4>
        <button onClick={() => setShowInput(false)} className="p-1 hover:bg-amber-100 rounded flex-shrink-0">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <input
        type="text"
        value={profileName}
        onChange={(e) => setProfileName(e.target.value)}
        placeholder="如：我自己、小明、张三..."
        className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-amber-300"
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={!profileName.trim() || saving}
        className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5"
      >
        {saving ? '保存中...' : <><Check className="w-4 h-4 flex-shrink-0" />确认保存</>}
      </button>
    </div>
  );
};

interface DailyFortuneData {
  date: string;
  dayGanZhi: string;
  lunarDate: string;
  overallScore: number;
  overallTrend: 'up' | 'down' | 'stable';
  overallSummary: string;
  career: { score: number; trend: 'up' | 'down' | 'stable'; description: string; advice: string; keyPoint: string };
  wealth: { score: number; trend: 'up' | 'down' | 'stable'; description: string; advice: string; keyPoint: string };
  relationship: { score: number; trend: 'up' | 'down' | 'stable'; description: string; advice: string; keyPoint: string };
  health: { score: number; trend: 'up' | 'down' | 'stable'; description: string; advice: string; keyPoint: string };
  luckyElements?: { colors: string[]; directions: string[]; numbers: number[]; zodiac: string[] };
}

interface RightSidebarProps {
  isLoggedIn: boolean;
  userInfo: { email: string; points: number } | null;
  onLogin: () => void;
  onLogout: () => void;
  onGenerate: () => void;
  isAnalysisPanelOpen?: boolean; // 当命盘分析报告展开时隐藏
}

// 月度运势卡片组件
const MonthlyFortuneCard: React.FC<{ profileId: string | null; onViewDetail: () => void }> = ({
  profileId,
  onViewDetail,
}) => {
  const [fortune, setFortune] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const monthStr = new Date().toLocaleDateString('zh-CN', { month: 'long' });

  // Reset state when profileId changes (no auto-fetch)
  useEffect(() => {
    setFortune(null);
    setError(null);
  }, [profileId]);

  const fetchMonthlyFortune = async () => {
    if (!profileId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/fortune/monthly/${currentYear}/${currentMonth}?profileId=${profileId}`
      );
      if (response.ok) {
        const data = await response.json();
          setFortune(normalizeText(data.fortune));
      } else {
        setError('获取月度运势失败');
      }
    } catch (err) {
      console.error('获取月度运势失败:', err);
      setError('获取月度运势失败');
    } finally {
      setLoading(false);
    }
  };

  if (!profileId) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-800">{monthStr}运势</h3>
        </div>
        <p className="text-sm text-gray-500">选择档案查看本月运势</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-5 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-800">{monthStr}运势</h3>
          <span className="px-1.5 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">免费</span>
        </div>
      </div>
      {fortune ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">综合评分</span>
            <span className="text-lg font-bold text-blue-600">{fortune.overallScore}</span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-2">{fortune.theme}</p>
          <button
            onClick={onViewDetail}
            className="w-full py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center justify-center gap-1"
          >
            查看详情 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={() => { fetchMonthlyFortune(); }}
            className="w-full py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">查看本月运势走向和关键时间点</p>
          <button
            onClick={fetchMonthlyFortune}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            获取本月运势
          </button>
        </div>
      )}
    </div>
  );
};

// 年度运势卡片组件
const YearlyFortuneCard: React.FC<{ profileId: string | null; onViewDetail: () => void }> = ({
  profileId,
  onViewDetail,
}) => {
  const [fortune, setFortune] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  // Reset state when profileId changes (no auto-fetch)
  useEffect(() => {
    setFortune(null);
    setError(null);
  }, [profileId]);

  const fetchYearlyFortune = async () => {
    if (!profileId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fortune/yearly/${currentYear}?profileId=${profileId}`);
      if (response.ok) {
        const data = await response.json();
          setFortune(normalizeText(data.fortune));
      } else {
        setError('获取年度运势失败');
      }
    } catch (err) {
      console.error('获取年度运势失败:', err);
      setError('获取年度运势失败');
    } finally {
      setLoading(false);
    }
  };

  if (!profileId) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">{currentYear}年运势</h3>
        </div>
        <p className="text-sm text-gray-500">选择档案查看今年运势</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-5 bg-gray-200 rounded w-24" />
        </div>
        <div className="h-10 bg-gray-200 rounded" />
      </div>
    );
  }

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'rising': return '上升期';
      case 'stable': return '平稳期';
      case 'volatile': return '波动期';
      case 'declining': return '调整期';
      default: return '平稳期';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">{currentYear}年运势</h3>
          <span className="px-1.5 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">免费</span>
        </div>
      </div>
      {fortune ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">综合评分</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-amber-600">{fortune.overallScore}</span>
              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                {getTrendText(fortune.overallTrend)}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            <span className="text-green-600">吉月:</span> {fortune.favorableMonths?.slice(0, 3).join('、')}月
          </div>
          <button
            onClick={onViewDetail}
            className="w-full py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg flex items-center justify-center gap-1"
          >
            查看详情 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={() => { fetchYearlyFortune(); }}
            className="w-full py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg"
          >
            重试
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">查看全年运势走向和吉凶月份</p>
          <button
            onClick={fetchYearlyFortune}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            获取年度运势
          </button>
        </div>
      )}
    </div>
  );
};

const RightSidebar: React.FC<RightSidebarProps> = ({
  isLoggedIn,
  userInfo,
  onLogin,
  onLogout: _onLogout,
  onGenerate,
  isAnalysisPanelOpen = false,
}) => {
  const navigate = useNavigate();
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<ProfileInfo[]>([]);
  const [currentCalculation, setCurrentCalculation] = useState<CurrentCalculation | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [savePromptDismissed, setSavePromptDismissed] = useState(false);

  // Load current calculation from history
  const loadCurrentCalculation = useCallback(() => {
    try {
      const historyData = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (historyData) {
        const history = JSON.parse(historyData);
        if (history.length > 0) {
          const latest = history[0];
          if (latest.input?.yearPillar && latest.input?.monthPillar && latest.input?.dayPillar && latest.input?.hourPillar) {
            setCurrentCalculation({
              name: latest.input.name,
              birthYear: latest.input.birthYear,
              gender: latest.input.gender,
              yearPillar: latest.input.yearPillar,
              monthPillar: latest.input.monthPillar,
              dayPillar: latest.input.dayPillar,
              hourPillar: latest.input.hourPillar,
            });
          }
        }
      }
    } catch {
      setCurrentCalculation(null);
    }
  }, []);

  // Load all profiles from API (logged in) or localStorage (not logged in)
  const loadProfiles = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      if (isLoggedIn) {
        // Fetch from API when logged in
        const response = await fetch('/api/profiles', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const profileInfos: ProfileInfo[] = data.profiles.map((p: any) => ({
            id: p.id,
            name: p.name,
            yearPillar: p.yearPillar || '',
            monthPillar: p.monthPillar || '',
            dayPillar: p.dayPillar || '',
            hourPillar: p.hourPillar || '',
            isDefault: p.isDefault,
          }));
          setAllProfiles(profileInfos);

          // Set default profile as current if no current profile selected
          const saved = getStoredCurrentProfile();
          if (!saved) {
            const defaultProfile = profileInfos.find(p => p.isDefault);
            if (defaultProfile) {
              const fullProfile: UserProfile = {
                id: defaultProfile.id,
                name: defaultProfile.name,
                gender: '',
                birthYear: 0,
                yearPillar: defaultProfile.yearPillar,
                monthPillar: defaultProfile.monthPillar,
                dayPillar: defaultProfile.dayPillar,
                hourPillar: defaultProfile.hourPillar,
              };
              setCurrentProfile(fullProfile);
              setStoredCurrentProfile(fullProfile);
            }
          }
          return;
        }
      }

      // Fallback to localStorage when not logged in or API fails
      const saved = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (saved) {
        const profiles = JSON.parse(saved);
        const profileInfos: ProfileInfo[] = profiles.map((p: UserProfile) => ({
          id: p.id,
          name: p.name,
          yearPillar: p.yearPillar || '',
          monthPillar: p.monthPillar || '',
          dayPillar: p.dayPillar || '',
          hourPillar: p.hourPillar || '',
        }));
        setAllProfiles(profileInfos);
      }
    } catch {
      // Fallback to localStorage on error
      try {
        const saved = localStorage.getItem(PROFILES_STORAGE_KEY);
        if (saved) {
          const profiles = JSON.parse(saved);
          const profileInfos: ProfileInfo[] = profiles.map((p: UserProfile) => ({
            id: p.id,
            name: p.name,
            yearPillar: p.yearPillar || '',
            monthPillar: p.monthPillar || '',
            dayPillar: p.dayPillar || '',
            hourPillar: p.hourPillar || '',
          }));
          setAllProfiles(profileInfos);
        }
      } catch {
        setAllProfiles([]);
      }
    }
  }, [isLoggedIn]);

  // Load current profile
  const loadCurrentProfile = useCallback(() => {
    setCurrentProfile(getStoredCurrentProfile());
  }, []);

  useEffect(() => {
    loadProfiles();
    if (isLoggedIn) {
      syncCurrentProfileFromServer().then(setCurrentProfile).catch(loadCurrentProfile);
    } else {
      loadCurrentProfile();
    }
    loadCurrentCalculation();
  }, [isLoggedIn]); // Only run on mount and when login status changes

  // Separate effect for event listeners
  useEffect(() => {
    // Listen for storage changes (profile selection in other components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lifekline_current_profile') {
        loadCurrentProfile();
      } else if (e.key === PROFILES_STORAGE_KEY) {
        loadProfiles();
      } else if (e.key === HISTORY_STORAGE_KEY) {
        loadCurrentCalculation();
      }
    };

    // Listen for custom event within same tab
    const handleProfileChange = () => {
      loadCurrentProfile();
      loadProfiles();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(CURRENT_PROFILE_EVENT, handleProfileChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(CURRENT_PROFILE_EVENT, handleProfileChange);
    };
  }, [loadProfiles, loadCurrentProfile, loadCurrentCalculation]);

  // Show save prompt when we have a calculation but no profiles
  useEffect(() => {
    if (currentCalculation && allProfiles.length === 0 && !savePromptDismissed && !currentProfile) {
      setShowSavePrompt(true);
    } else {
      setShowSavePrompt(false);
    }
  }, [currentCalculation, allProfiles.length, savePromptDismissed, currentProfile]);

  // Handle profile change
  const handleProfileChange = useCallback((profileId: string) => {
    const profile = allProfiles.find(p => p.id === profileId);
    if (profile) {
      const fullProfile: UserProfile = {
        id: profile.id,
        name: profile.name,
        gender: '',
        birthYear: 0,
        yearPillar: profile.yearPillar,
        monthPillar: profile.monthPillar,
        dayPillar: profile.dayPillar,
        hourPillar: profile.hourPillar,
      };
      setCurrentProfile(fullProfile);
      setStoredCurrentProfile(fullProfile);
    }
  }, [allProfiles]);

  // Handle manage profiles click
  const handleManageProfiles = useCallback(() => {
    navigate('/dashboard?tab=profiles');
  }, [navigate]);

  // Handle save current bazi to profile
  const handleSaveCurrentBazi = useCallback(async (name: string) => {
    if (!currentCalculation) return;

    try {
      if (isLoggedIn) {
        // Save to API when logged in
        const response = await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name,
            gender: currentCalculation.gender || 'male',
            birthYear: parseInt(currentCalculation.birthYear || '1990', 10),
            yearPillar: currentCalculation.yearPillar,
            monthPillar: currentCalculation.monthPillar,
            dayPillar: currentCalculation.dayPillar,
            hourPillar: currentCalculation.hourPillar,
            isDefault: true, // Set as default
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const newProfile: UserProfile = {
            id: data.profile.id,
            name: data.profile.name,
            gender: data.profile.gender || '',
            birthYear: data.profile.birthYear || 0,
            yearPillar: data.profile.yearPillar,
            monthPillar: data.profile.monthPillar,
            dayPillar: data.profile.dayPillar,
            hourPillar: data.profile.hourPillar,
          };

          // Set as current profile
          setCurrentProfile(newProfile);
          setStoredCurrentProfile(newProfile);

          // Refresh profiles list
          loadProfiles();
          setShowSavePrompt(false);
          return;
        }
      }

      // Fallback to localStorage when not logged in or API fails
      const newProfile: UserProfile = {
        id: `profile_${Date.now()}`,
        name,
        gender: currentCalculation.gender || '',
        birthYear: parseInt(currentCalculation.birthYear || '0', 10),
        yearPillar: currentCalculation.yearPillar,
        monthPillar: currentCalculation.monthPillar,
        dayPillar: currentCalculation.dayPillar,
        hourPillar: currentCalculation.hourPillar,
      };

      const existingProfiles = JSON.parse(localStorage.getItem(PROFILES_STORAGE_KEY) || '[]');
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify([...existingProfiles, newProfile]));

      // Set as current profile
      setStoredCurrentProfile(newProfile);

      // Refresh state
      loadProfiles();
      setCurrentProfile(newProfile);
      setShowSavePrompt(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  }, [currentCalculation, isLoggedIn, loadProfiles]);

  // Sample trending data
  const trendingCases = [
    { id: 'early', name: '早发型', count: 1280 },
    { id: 'late', name: '晚成型', count: 956 },
    { id: 'volatile', name: '大起大落型', count: 734 },
  ];

  const trendingCategories = [
    { id: 'basics', name: '八字基础', count: 450 },
    { id: 'dayun', name: '大运流年', count: 320 },
    { id: 'career', name: '事业财运', count: 280 },
  ];

  const handleCaseClick = (caseId: string) => {
    window.location.href = `/cases?type=${caseId}`;
  };

  const handleCategoryClick = (categoryId: string) => {
    window.location.href = `/knowledge?category=${categoryId}`;
  };

  const handleViewDailyFortuneDetail = (fortune: DailyFortuneData) => {
    // Navigate to daily fortune detail page
    navigate(`/fortune/daily/${fortune.date}`);
  };

  const handleRequestEnhanced = () => {
    // This will be handled by the DailyFortuneCard component
    // It will show confirmation dialog and request AI enhancement
  };

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${isAnalysisPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      {/* Current Profile Card - Priority 0 */}
      <CurrentProfileCard
        profile={currentProfile}
        profiles={allProfiles}
        onProfileChange={handleProfileChange}
        onManageProfiles={handleManageProfiles}
      />

      {/* Save Current Bazi Prompt - Show when no profiles but has calculation */}
      {showSavePrompt && currentCalculation && (
        <SaveCurrentBaziPrompt
          currentBazi={currentCalculation}
          onSave={handleSaveCurrentBazi}
          onDismiss={() => setSavePromptDismissed(true)}
        />
      )}

      {/* Daily Fortune Card - Priority 1 */}
      <DailyFortuneCard
        profileId={currentProfile?.id || null}
        profiles={allProfiles}
        onProfileChange={handleProfileChange}
        onManageProfiles={handleManageProfiles}
        isLoggedIn={isLoggedIn}
        userPoints={userInfo?.points || 0}
        onViewDetail={handleViewDailyFortuneDetail}
        onRequestEnhanced={handleRequestEnhanced}
        onLogin={onLogin}
      />

      {/* Monthly Fortune Card - Priority 2 */}
      <MonthlyFortuneCard
        profileId={currentProfile?.id || null}
        onViewDetail={() => navigate('/fortune/monthly')}
      />

      {/* Yearly Fortune Card - Priority 3 */}
      <YearlyFortuneCard
        profileId={currentProfile?.id || null}
        onViewDetail={() => navigate('/fortune/yearly')}
      />

      {/* CTA Card */}
      <CTACard onGenerate={onGenerate} />

      {/* Trending */}
      <TrendingCard
        trendingCases={trendingCases}
        trendingCategories={trendingCategories}
        onCaseClick={handleCaseClick}
        onCategoryClick={handleCategoryClick}
      />

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 text-center px-4 py-2">
        仅供娱乐与文化研究，请勿迷信
      </div>
    </div>
  );
};

export default RightSidebar;
