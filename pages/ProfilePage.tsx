import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings, History, LogOut, Coins, ChevronRight, Calendar, TrendingUp } from 'lucide-react';

interface ProfileData {
  id: string;
  createdAt: string;
  cost: number;
  input: {
    name?: string;
    birthYear: number;
    birthMonth: number;
    birthDay: number;
    birthHour: number;
    gender: string;
  };
  result?: any;
}

const ProfilePage: React.FC = () => {
  const [userInfo, setUserInfo] = useState<{ email: string; points: number } | null>(null);
  const [profileList, setProfileList] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check auth and load user info
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setIsLoggedIn(true);
            setUserInfo({ email: data.user.email, points: data.user.points });
            loadProfileList();
          } else {
            setIsLoggedIn(false);
            loadLocalProfiles();
          }
        } else {
          setIsLoggedIn(false);
          loadLocalProfiles();
        }
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

  // Load profile list from localStorage
  const loadLocalProfiles = () => {
    try {
      const data = localStorage.getItem('lifekline_history');
      if (data) {
        const history = JSON.parse(data);
        setProfileList(history);
      }
    } catch (e) {
      console.error('Failed to load local profiles:', e);
    }
  };

  // Load profile list from server (if logged in)
  const loadProfileList = async () => {
    try {
      const response = await fetch('/api/profiles', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const profiles = (data.profiles || []).map((p: any) => ({
          id: p.id,
          createdAt: p.createdAt,
          cost: 0,
          input: {
            name: p.name,
            birthYear: p.birthYear || 0,
            birthMonth: 0,
            birthDay: 0,
            birthHour: 0,
            gender: p.gender || '',
          },
        }));
        setProfileList(profiles);
      } else {
        // Fallback to local storage
        loadLocalProfiles();
      }
    } catch (error) {
      console.error('Failed to load profiles from server:', error);
      loadLocalProfiles();
    }
  };

  // Logout handler
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

  // Format date
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
        {/* Header */}
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

          {/* Points display */}
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

          {/* Guest mode prompt */}
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

        {/* Menu items */}
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

        {/* Profile list */}
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
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {profile.input.name || '未命名'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {profile.input.birthYear}年{profile.input.birthMonth}月
                        {profile.input.birthDay}日 {profile.input.birthHour}时
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
