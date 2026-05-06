import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sparkles,
  Home,
  BookOpen,
  FolderOpen,
  User,
  Coins,
  LogIn,
  UserPlus,
  LogOut,
  LayoutDashboard,
  History,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { LifeDestinyResult, UserInput } from '../../types';
import { useSiteConfig } from '../../utils/siteConfig';

interface HistoryItem {
  id: string;
  createdAt: string;
  cost: number;
  input: UserInput;
  result: LifeDestinyResult;
}

interface LeftNavProps {
  isLoggedIn: boolean;
  userInfo: { email: string; points: number } | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onHistorySelect?: (result: LifeDestinyResult, input: UserInput) => void;
  onNewCalculation?: () => void;
}

const HISTORY_STORAGE_KEY = 'lifekline_history';

const getLocalHistory = (): HistoryItem[] => {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const deleteLocalHistoryItem = (id: string) => {
  try {
    const history = getLocalHistory();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

const LeftNav: React.FC<LeftNavProps> = ({
  isLoggedIn,
  userInfo,
  onLoginClick,
  onLogout,
  onHistorySelect,
  onNewCalculation,
}) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const siteConfig = useSiteConfig();

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      if (isLoggedIn) {
        const response = await fetch('/api/history', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const items = data.items || [];
          const fullHistory: HistoryItem[] = [];

          for (const item of items.slice(0, 10)) {
            try {
              const detailRes = await fetch(`/api/history/${item.id}`, { credentials: 'include' });
              if (detailRes.ok) {
                const detail = await detailRes.json();
                if (detail.item?.input && detail.item?.result) {
                  fullHistory.push(detail.item);
                }
              }
            } catch {
              // Skip
            }
          }

          const localHistory = getLocalHistory();
          const mergedHistory = [...fullHistory, ...localHistory]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 20);
          setHistory(mergedHistory);
        } else {
          setHistory(getLocalHistory());
        }
      } else {
        setHistory(getLocalHistory());
      }
    } catch {
      setHistory(getLocalHistory());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [isLoggedIn]);

  useEffect(() => {
    const handleStorage = () => setHistory(getLocalHistory());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这条记录吗？')) {
      const updated = deleteLocalHistoryItem(id);
      setHistory(updated);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const displayHistory = historyExpanded ? history : history.slice(0, 3);

  return (
    <div className="flex flex-col h-full p-4 bg-[#fef9f3]">
      {/* Logo with Pro Badge */}
      <NavLink to="/" className="flex items-center gap-3 mb-8 hover:opacity-80 transition-opacity">
        <div className="bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 text-white p-2 rounded-lg shadow-md">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-serif-sc font-bold text-gray-900 tracking-wide">{siteConfig.name}</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white rounded-full shadow-sm">
              Pro
            </span>
          </div>
          <p className="text-[10px] text-gray-500 tracking-wide mt-0.5">命理加强版</p>
        </div>
      </NavLink>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-2 overflow-y-auto">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-4 px-4 py-3 rounded-full transition-all ${
              isActive
                ? 'bg-purple-100 text-purple-700 font-semibold'
                : 'text-gray-600 hover:bg-[#f5f0ea] hover:text-gray-800'
            }`
          }
        >
          <Home className="w-6 h-6" />
          <span className="text-lg">首页</span>
        </NavLink>

        <NavLink
          to="/knowledge"
          className={({ isActive }) =>
            `flex items-center gap-4 px-4 py-3 rounded-full transition-all ${
              isActive
                ? 'bg-purple-100 text-purple-700 font-semibold'
                : 'text-gray-600 hover:bg-[#f5f0ea] hover:text-gray-800'
            }`
          }
        >
          <BookOpen className="w-6 h-6" />
          <span className="text-lg">知识中心</span>
        </NavLink>

        <NavLink
          to="/cases"
          className={({ isActive }) =>
            `flex items-center gap-4 px-4 py-3 rounded-full transition-all ${
              isActive
                ? 'bg-purple-100 text-purple-700 font-semibold'
                : 'text-gray-600 hover:bg-[#f5f0ea] hover:text-gray-800'
            }`
          }
        >
          <FolderOpen className="w-6 h-6" />
          <span className="text-lg">案例库</span>
        </NavLink>

        {/* Dashboard - Only show when logged in */}
        {isLoggedIn && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 rounded-full transition-all ${
                isActive || location.pathname.startsWith('/dashboard')
                  ? 'bg-purple-100 text-purple-700 font-semibold'
                  : 'text-gray-600 hover:bg-[#f5f0ea] hover:text-gray-800'
              }`
            }
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-lg">控制面板</span>
          </NavLink>
        )}

        {/* History Section - Only on homepage */}
        {isHomePage && history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {/* History Header */}
            <button
              onClick={() => setHistoryExpanded(!historyExpanded)}
              className="w-full flex items-center justify-between px-2 py-2 text-gray-600 hover:text-gray-800"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span className="text-sm font-medium">测算历史</span>
                <span className="text-xs text-gray-400">({history.length})</span>
              </div>
              {historyExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* New Calculation Button */}
            {onNewCalculation && (
              <button
                onClick={onNewCalculation}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white rounded-lg hover:shadow-lg hover:shadow-amber-300/40 transition-all text-sm font-medium shadow-md"
              >
                <Plus className="w-4 h-4" />
                新建测算
              </button>
            )}

            {/* History List */}
            <div className="mt-2 space-y-1">
              {displayHistory.map((item) => (
                <div
                  key={item.id}
                  className="group relative"
                >
                  <button
                    onClick={() => onHistorySelect && item.result && item.input && onHistorySelect(item.result, item.input)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg hover:bg-[#f5f0ea] transition-colors"
                  >
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {item.input?.name || '匿名'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>

            {/* Expand/Collapse */}
            {history.length > 3 && (
              <button
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="w-full text-center text-xs text-purple-600 hover:text-purple-700 py-2 font-medium"
              >
                {historyExpanded ? '收起' : `查看全部 ${history.length} 条`}
              </button>
            )}
          </div>
        )}
      </nav>

      {/* User Status Section */}
      <div className="mt-auto pt-4 border-t border-amber-200/30">
        {isLoggedIn && userInfo ? (
          <div className="space-y-3">
            {/* User Info Display */}
            <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 p-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-white/90" />
                <span className="text-sm font-medium text-white truncate">
                  {userInfo.email.split('@')[0]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-lg font-bold text-amber-300">
                  {userInfo.points}
                </span>
                <span className="text-xs text-white/80">点</span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Login Button */}
            <button
              onClick={onLoginClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-purple-700 hover:bg-[#f5f0ea] rounded-lg transition-all border border-gray-300"
            >
              <LogIn className="w-4 h-4" />
              登录
            </button>

            {/* Register Button */}
            <button
              onClick={onLoginClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:shadow-lg hover:shadow-amber-300/50 rounded-lg shadow-md transition-all"
            >
              <UserPlus className="w-4 h-4" />
              注册
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeftNav;
