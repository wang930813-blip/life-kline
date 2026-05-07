import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, History, LogOut, Coins, ChevronRight, Calendar, TrendingUp } from 'lucide-react';
import { normalizeText } from '../utils/normalizeText';

interface ProfileData {
  id: string;
  createdAt: string;
  cost: number;
  input: {
    name?: string;
    birthYear?: string | number;
    yearPillar?: string;
    monthPillar?: string;
    dayPillar?: string;
    hourPillar?: string;
    gender?: string;
  };
  result?: any;
}

const HISTORY_STORAGE_KEY = 'lifekline_history';

const ProfilePage: React.FC = () => {
  const [userInfo, setUserInfo] = useState<{ email: string; points: number } | null>(null);
  const [profileList, setProfileList] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setIsLoggedIn(true);
            setUserInfo({ email: data.user.email, points: data.user.points });
            await loadRecentAnalyses();
            return;
          }
        }

        setIsLoggedIn(false);
        loadLocalProfiles();
      } catch (error) {
        console.error('Auth check error:', error);
        setIsLoggedIn(false);
        loadLocalProfiles();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const loadLocalProfiles = () => {
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      setProfileList(data ? normalizeText(JSON.parse(data)) : []);
    } catch (e) {
      console.error('Failed to load local profiles:', e);
      setProfileList([]);
    }
  };

  const loadRecentAnalyses = async () => {
    try {
      const response = await fetch('/api/history', { credentials: 'include' });
      if (!response.ok) {
        loadLocalProfiles();
        return;
      }

      const data = await response.json();
      const items = data.items || [];
      const fullHistory: ProfileData[] = [];

      for (const item of items.slice(0, 10)) {
        try {
          const detailRes = await fetch(`/api/history/${item.id}`, { credentials: 'include' });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            if (detail.item?.input) {
              fullHistory.push(normalizeText(detail.item));
            }
          }
        } catch {
          // Keep the rest of the list usable if one detail request fails.
        }
      }

      setProfileList(fullHistory);
    } catch (error) {
      console.error('Failed to load recent analyses:', error);
      loadLocalProfiles();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors
    }
    setIsLoggedIn(false);
    setUserInfo(null);
    window.location.href = '/';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBirthInfo = (input: ProfileData['input']) => {
    const pillars = [input.yearPillar, input.monthPillar, input.dayPillar, input.hourPillar].filter(Boolean);
    const birthYear = input.birthYear ? `${input.birthYear}年` : '';

    if (birthYear && pillars.length === 4) {
      return `${birthYear} · ${pillars.join(' ')}`;
    }

    if (pillars.length === 4) {
      return pillars.join(' ');
    }

    return birthYear || '出生信息未完整保存';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {isLoggedIn ? '我的账户' : '游客模式'}
              </h1>
              {userInfo && (
                <p className="text-white/80 text-sm mt-1">{userInfo.email}</p>
              )}
            </div>
          </div>

          {isLoggedIn && userInfo && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Coins className="w-6 h-6 text-yellow-300" />
                <div>
                  <p className="text-white/80 text-sm">可用点数</p>
                  <p className="text-2xl font-bold">{userInfo.points}</p>
                </div>
              </div>
              <Link
                to="/dashboard?tab=recharge"
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                充值
              </Link>
            </div>
          )}

          {!isLoggedIn && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-white/90 text-sm mb-3">
                登录后可以保存分析记录、查看历史数据、获得更多测算次数
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
              >
                立即登录
              </Link>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <Link
            to="/dashboard"
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">分析记录</p>
                <p className="text-sm text-gray-500">查看历史分析结果</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          <Link
            to="/fortune/daily"
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">每日运势</p>
                <p className="text-sm text-gray-500">查看今日运程</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">退出登录</p>
                  <p className="text-sm text-gray-500">退出当前账户</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              最近分析
            </h2>
          </div>

          {profileList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>暂无分析记录</p>
              <Link
                to="/"
                className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                开始分析
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {profileList.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {normalizeText(profile.input.name || '未命名')}
                      </p>
                      <p className="text-sm text-gray-500 mt-1 truncate">
                        {formatBirthInfo(profile.input)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(profile.createdAt)}
                      </p>
                    </div>
                    {profile.cost > 0 && (
                      <div className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-medium rounded">
                        -{profile.cost} 点
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
