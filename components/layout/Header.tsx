import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { User, Coins, LogOut, LogIn, UserPlus, LayoutDashboard } from 'lucide-react';
import ProfileSelector from '../profile/ProfileSelector';
import { useSiteConfig } from '../../utils/siteConfig';

interface HeaderProps {
  isLoggedIn: boolean;
  userInfo: { email: string; points: number } | null;
  isGuest: boolean;
  showUserMenu: boolean;
  setShowUserMenu: (show: boolean) => void;
  onLoginClick: () => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({
  isLoggedIn,
  userInfo,
  showUserMenu,
  setShowUserMenu,
  onLoginClick,
  onLogout,
}) => {
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const profileSelectorRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const siteConfig = useSiteConfig();

  // Close profile selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileSelectorRef.current && !profileSelectorRef.current.contains(event.target as Node)) {
        setShowProfileSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load current profile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lifekline_current_profile');
      if (saved) {
        setCurrentProfile(JSON.parse(saved));
      }
    }
  }, []);

  const handleProfileChange = (profile: any) => {
    setCurrentProfile(profile);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lifekline_current_profile', JSON.stringify(profile));
    }
  };

  const handleManageProfiles = () => {
    // Navigate to dashboard profiles tab
    window.location.href = '/dashboard/profiles';
  };
  return (
    <header className="w-full bg-white border-b border-gray-200 py-4 sticky top-0 z-50 no-print">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        {/* Logo with Pro Badge */}
        <NavLink to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-xl font-serif-sc font-bold text-gray-900 tracking-wide">{siteConfig.name}</span>
          <span className="px-2.5 py-0.5 text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full shadow-sm">
            Pro
          </span>
        </NavLink>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-3">
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLink
              to="/knowledge"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              知识中心
            </NavLink>
            <NavLink
              to="/cases"
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              案例库
            </NavLink>
            {/* Dashboard link - only show for logged in users */}
            {isLoggedIn && (
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium rounded-full transition-all ${
                    isActive || location.pathname.startsWith('/dashboard')
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="flex items-center gap-1.5">
                  <LayoutDashboard className="w-4 h-4" />
                  控制面板
                </span>
              </NavLink>
            )}
          </nav>

          {/* User Status Display */}
          {isLoggedIn && userInfo ? (
            <div className="flex items-center gap-3">
              {/* Profile Selector */}
              <div className="relative" ref={profileSelectorRef}>
                <button
                  onClick={() => setShowProfileSelector(!showProfileSelector)}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {currentProfile ? currentProfile.name || '未命名档案' : '选择档案'}
                  </span>
                </button>

                {showProfileSelector && (
                  <div className="absolute right-0 top-full mt-2 z-50">
                    <ProfileSelector
                      currentProfile={currentProfile}
                      onProfileChange={handleProfileChange}
                      onManageProfiles={handleManageProfiles}
                    />
                  </div>
                )}
              </div>

              {/* User Points Display */}
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 rounded-full border border-indigo-100">
                <div className="flex items-center gap-1 text-amber-600">
                  <Coins className="w-4 h-4" />
                  <span className="text-sm font-bold">{userInfo.points}</span>
                </div>
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {userInfo.email.split('@')[0]}
                  </span>
                </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[200px] z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">当前账号</p>
                    <p className="text-sm font-medium text-gray-800 truncate">{userInfo.email}</p>
                  </div>
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">点数余额</p>
                    <p className="text-lg font-bold text-amber-600">
                      {userInfo.points} <span className="text-xs text-gray-500">点</span>
                    </p>
                  </div>
                  <button
                    onClick={onLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onLoginClick}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">登录</span>
              </button>
              <button
                onClick={onLoginClick}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">注册</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};

export default Header;
