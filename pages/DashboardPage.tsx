import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  Coins,
  History,
  Plus,
  Settings,
  TrendingUp,
  Share2,
  Award,
  Calendar,
  Star,
  Eye,
  Edit,
  Trash2,
  ChevronRight,
  Loader2,
  RefreshCw,
  LogOut,
  Ticket,
  Check,
  X
} from 'lucide-react';
import ProfileManager from '../components/profile/ProfileManager';
import PointsRechargePanel from '../components/payment/PointsRechargePanel';
import { UserInput, Gender, LifeDestinyResult, HistoryListItem, UserProfile } from '../types';
import { normalizeText } from '../utils/normalizeText';

interface DashboardStats {
  profileCount: number;
  totalAnalyses: number;
  totalShares: number;
  pointsEarned: number;
}

interface ShareReward {
  id: string;
  createdAt: string;
  points: number;
  sharerEmail?: string;
}

interface UserInfo {
  email: string;
  points: number;
}

interface DashboardPageProps {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onHistorySelect?: (result: LifeDestinyResult, input: UserInput) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  isLoggedIn,
  userInfo,
  onLoginClick,
  onLogout,
  onHistorySelect
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'profiles' | 'fortune' | 'history' | 'recharge'>('overview');
  const [stats, setStats] = useState<DashboardStats>({
    profileCount: 0,
    totalAnalyses: 0,
    totalShares: 0,
    pointsEarned: 0
  });
  const [recentAnalyses, setRecentAnalyses] = useState<HistoryListItem[]>([]);
  const [shareRewards, setShareRewards] = useState<ShareReward[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animatedPoints, setAnimatedPoints] = useState(0);

  // Voucher redemption states
  const [voucherCode, setVoucherCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; message: string; points?: number } | null>(null);
  const [showRedeemInput, setShowRedeemInput] = useState(false);

  // Handle tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'profiles', 'fortune', 'history', 'recharge'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  // Handle voucher redemption
  const handleRedeem = async () => {
    if (!voucherCode.trim()) return;

    setIsRedeeming(true);
    setRedeemResult(null);

    try {
      const response = await fetch('/api/voucher/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: voucherCode.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setRedeemResult({ success: true, message: data.message, points: data.points });
        setVoucherCode('');
        // Refresh page to update points
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setRedeemResult({ success: false, message: data.message || '兑换失败' });
      }
    } catch (err) {
      setRedeemResult({ success: false, message: '网络错误，请重试' });
    } finally {
      setIsRedeeming(false);
    }
  };

  // Animate points balance on load
  useEffect(() => {
    if (userInfo?.points) {
      const targetPoints = userInfo.points;
      const duration = 1500; // 1.5 seconds
      const steps = 30;
      const increment = targetPoints / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= targetPoints) {
          setAnimatedPoints(targetPoints);
          clearInterval(timer);
        } else {
          setAnimatedPoints(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [userInfo?.points]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isLoggedIn) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch profiles from localStorage
        if (typeof window !== 'undefined') {
          const savedProfiles = localStorage.getItem('lifekline_profiles');
          if (savedProfiles) {
            const parsed = JSON.parse(savedProfiles);
            setProfiles(parsed);
            setStats(prev => ({ ...prev, profileCount: parsed.length }));
          }
        }

        // Fetch recent analyses
        try {
          const historyResponse = await fetch('/api/history', {
            credentials: 'include'
          });
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setRecentAnalyses((historyData.items?.slice(0, 5) || []).map((item: HistoryListItem) => ({
              ...item,
              summary: normalizeText(item.summary || '历史分析')
            })));
            setStats(prev => ({ ...prev, totalAnalyses: historyData.total || 0 }));
          }
        } catch (err) {
          console.error('Failed to fetch history:', err);
          // Fallback to localStorage
          const localHistory = localStorage.getItem('lifekline_history');
          if (localHistory) {
            const parsed = JSON.parse(localHistory);
            setRecentAnalyses(parsed.slice(0, 5).map((item: any) => ({
              id: item.id,
              createdAt: item.createdAt,
              cost: item.cost || 0,
              summary: normalizeText(item.result?.analysis?.summary || '历史分析')
            })));
          }
        }

        // Fetch share rewards
        try {
          const shareResponse = await fetch('/api/share/history', {
            credentials: 'include'
          });
          if (shareResponse.ok) {
            const shareData = await shareResponse.json();
            setShareRewards(shareData.rewards?.slice(0, 5) || []);
            const totalPoints = shareData.rewards?.reduce((sum: number, r: ShareReward) => sum + r.points, 0) || 0;
            setStats(prev => ({ ...prev, totalShares: shareData.rewards?.length || 0, pointsEarned: totalPoints }));
          }
        } catch (err) {
          console.error('Failed to fetch share rewards:', err);
        }

      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [isLoggedIn]);

  const handleViewHistory = () => {
    navigate('/');
    // Scroll to history section
    setTimeout(() => {
      const historyElement = document.getElementById('history-section');
      historyElement?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleOpenHistory = async (analysis: HistoryListItem) => {
    try {
      const response = await fetch(`/api/history/${analysis.id}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const item = data.item;
        if (item?.result && item?.input) {
          onHistorySelect?.(normalizeText(item.result), normalizeText(item.input));
          navigate('/');
          return;
        }
      }
    } catch (err) {
      console.error('Failed to open history:', err);
    }

    const localHistory = localStorage.getItem('lifekline_history');
    if (localHistory) {
      const found = JSON.parse(localHistory).find((item: any) => item.id === analysis.id);
      if (found?.result && found?.input) {
        onHistorySelect?.(normalizeText(found.result), normalizeText(found.input));
        navigate('/');
      }
    }
  };

  const handleAddProfile = () => {
    setActiveTab('profiles');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}天前`;
    if (diffHours > 0) return `${diffHours}小时前`;
    return '刚刚';
  };

  const refreshUserInfo = () => {
    // Trigger a page reload to refresh user points
    window.location.reload();
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-mystic-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-mystic-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">
            请登录以访问您的个人中心和管理档案
          </p>
          <button
            onClick={onLoginClick}
            className="w-full py-3 bg-gradient-mystic text-white font-bold rounded-lg hover:opacity-90 shadow-glow-purple transition-opacity"
          >
            登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">个人中心</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1 truncate">{userInfo?.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 px-3 sm:px-4 py-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>退出登录</span>
            </button>
          </div>

          {/* Points Balance with Animation */}
          <div className="bg-gradient-mystic rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white shadow-glow-purple">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-2">
                  <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-golden-300" />
                  <span className="text-base sm:text-lg font-medium">积分余额</span>
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-golden-300">
                  {animatedPoints.toLocaleString()}
                </div>
                <p className="text-xs sm:text-sm text-white/90 mt-1">可用于分析测算</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <div className="text-xl sm:text-2xl mb-1">🎯</div>
                <p className="text-xs sm:text-sm text-white/90 whitespace-nowrap">等级 {Math.floor((userInfo?.points || 0) / 100) + 1}</p>
              </div>
            </div>

            {/* Voucher Redemption */}
            <div className="mt-4 pt-4 border-t border-white/30">
              {!showRedeemInput ? (
                <button
                  onClick={() => setShowRedeemInput(true)}
                  className="flex items-center gap-2 text-sm text-golden-200 hover:text-golden-100 transition-colors"
                >
                  <Ticket className="w-4 h-4" />
                  <span>兑换点券</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                      placeholder="输入兑换码"
                      maxLength={8}
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 font-mono tracking-wider"
                    />
                    <button
                      onClick={handleRedeem}
                      disabled={isRedeeming || !voucherCode.trim()}
                      className="px-4 py-2 bg-gradient-golden text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isRedeeming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        '兑换'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowRedeemInput(false);
                        setVoucherCode('');
                        setRedeemResult(null);
                      }}
                      className="p-2 text-white/70 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {redeemResult && (
                    <div className={`flex items-center gap-2 text-sm ${
                      redeemResult.success ? 'text-green-200' : 'text-red-200'
                    }`}>
                      {redeemResult.success ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      <span>{redeemResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <button
            onClick={handleAddProfile}
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm hover:shadow-glow-purple transition-shadow text-center group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mystic-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-mystic-200 transition-colors">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-mystic-600" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-gray-700 block truncate px-1">添加档案</span>
          </button>

          <button
            onClick={handleViewHistory}
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow text-center group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-green-200 transition-colors">
              <History className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-gray-700 block truncate px-1">查看历史</span>
          </button>

          <button
            onClick={() => navigate('/knowledge')}
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow text-center group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-200 transition-colors">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-gray-700 block truncate px-1">了解更多</span>
          </button>

          <button
            onClick={() => navigate('/cases')}
            className="bg-white p-3 sm:p-4 rounded-xl shadow-sm hover:shadow-glow-golden transition-shadow text-center group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-golden-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-golden-200 transition-colors">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-golden-600" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-gray-700 block truncate px-1">浏览案例</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
            {[
              { id: 'overview', label: '概览', icon: TrendingUp },
              { id: 'profiles', label: '我的档案', icon: User },
              { id: 'fortune', label: '运势', icon: Star },
              { id: 'history', label: '历史', icon: History },
              { id: 'recharge', label: '充值', icon: Coins },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-1.5 sm:space-x-2 py-3 sm:py-4 px-3 sm:px-6 font-medium text-sm sm:text-base transition-colors whitespace-nowrap min-w-0 ${
                  activeTab === tab.id
                    ? 'text-mystic-600 border-b-2 border-mystic-600 bg-mystic-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-mystic-600 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-mystic-600 hover:text-mystic-800"
                >
                  重试
                </button>
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.profileCount}</div>
                        <div className="text-xs sm:text-sm text-gray-600 truncate">档案数</div>
                      </div>
                      <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalAnalyses}</div>
                        <div className="text-xs sm:text-sm text-gray-600 truncate">分析次数</div>
                      </div>
                      <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalShares}</div>
                        <div className="text-xs sm:text-sm text-gray-600 truncate">分享次数</div>
                      </div>
                      <div className="bg-gradient-to-br from-golden-50 to-golden-100 p-3 sm:p-4 rounded-lg border border-golden-200">
                        <div className="text-xl sm:text-2xl font-bold text-golden-700">{stats.pointsEarned}</div>
                        <div className="text-xs sm:text-sm text-golden-600 truncate">获得积分</div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Recent Analyses */}
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">最近分析</h3>
                        <div className="space-y-2">
                          {recentAnalyses.length > 0 ? (
                            recentAnalyses.slice(0, 3).map(analysis => (
                              <button
                                key={analysis.id}
                                onClick={() => handleOpenHistory(analysis)}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-2 text-left hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm sm:text-base text-gray-900 truncate">{normalizeText(analysis.summary || '历史分析')}</div>
                                  <div className="text-xs sm:text-sm text-gray-500 truncate">{formatTime(analysis.createdAt)}</div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              </button>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-4">暂无分析记录</p>
                          )}
                        </div>
                      </div>

                      {/* Recent Rewards */}
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">分享奖励</h3>
                        <div className="space-y-2">
                          {shareRewards.length > 0 ? (
                            shareRewards.slice(0, 3).map(reward => (
                              <div key={reward.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-golden-50 to-amber-50 border border-golden-200 rounded-lg gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm sm:text-base text-gray-900">获得积分</div>
                                  <div className="text-xs sm:text-sm text-gray-500 truncate">{formatTime(reward.createdAt)}</div>
                                </div>
                                <span className="text-golden-600 font-bold whitespace-nowrap flex-shrink-0">+{reward.points}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 text-center py-4">暂无奖励记录</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fortune Preview */}
                    <div className="bg-white border-2 border-golden-400 p-4 sm:p-6 rounded-xl shadow-glow-golden">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-golden-500">🌟</span>
                        今日运势
                      </h3>
                      <div className="text-sm sm:text-base text-gray-700">
                        <p className="mb-2">您的运势今日看起来非常积极！适合做出重要决定。</p>
                        <p className="text-xs sm:text-sm text-golden-600 font-medium">幸运数字: 7, 14, 21 | 幸运颜色: 蓝色</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profiles Tab */}
                {activeTab === 'profiles' && (
                  <ProfileManager />
                )}

                {/* Fortune Tab */}
                {activeTab === 'fortune' && (
                  <div className="space-y-6">
                    <div className="text-center py-12">
                      <div className="text-5xl sm:text-6xl mb-4">🔮</div>
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">运势预测</h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-6 px-4">获取基于您八字分析的个性化运势解读</p>
                      <button
                        onClick={() => navigate('/')}
                        className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-golden text-white text-sm sm:text-base font-medium rounded-lg hover:opacity-90 shadow-glow-golden transition-opacity"
                      >
                        开始新分析
                      </button>
                    </div>

                    <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                      <div className="bg-amber-50 p-4 sm:p-6 rounded-xl hover:shadow-glow-purple transition-shadow">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-2">📅 本周运势</h4>
                        <p className="text-xs sm:text-sm text-gray-700">本周职业发展机会良好，保持开放心态迎接新的联系。</p>
                      </div>
                      <div className="bg-blue-50 p-4 sm:p-6 rounded-xl hover:shadow-glow-purple transition-shadow">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-2">💰 财运展望</h4>
                        <p className="text-xs sm:text-sm text-gray-700">财务状况正在改善，避免冲动投资。</p>
                      </div>
                      <div className="bg-pink-50 p-4 sm:p-6 rounded-xl hover:shadow-glow-purple transition-shadow">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-2">❤️ 感情运势</h4>
                        <p className="text-xs sm:text-sm text-gray-700">和谐的关系即将到来，真诚表达你的感受。</p>
                      </div>
                      <div className="bg-green-50 p-4 sm:p-6 rounded-xl hover:shadow-glow-purple transition-shadow">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 mb-2">🌟 健康运势</h4>
                        <p className="text-xs sm:text-sm text-gray-700">精力充沛，保持运动习惯。</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">分析历史</h3>
                      <button
                        onClick={() => navigate('/')}
                        className="text-mystic-600 hover:text-mystic-800 text-xs sm:text-sm font-medium"
                      >
                        查看全部
                      </button>
                    </div>

                    {recentAnalyses.length > 0 ? (
                      recentAnalyses.map(analysis => (
                        <button
                          key={analysis.id}
                          onClick={() => handleOpenHistory(analysis)}
                          className="w-full bg-gray-50 p-3 sm:p-4 rounded-lg text-left hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm sm:text-base text-gray-900 truncate">{normalizeText(analysis.summary || '历史分析')}</h4>
                              <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 mt-2 text-xs sm:text-sm text-gray-500">
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                  <span className="truncate">{formatDate(analysis.createdAt)}</span>
                                </span>
                                <span className="flex items-center whitespace-nowrap">
                                  <Coins className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                  {analysis.cost} 点
                                </span>
                              </div>
                            </div>
                            <span className="text-gray-400 flex-shrink-0">
                              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <History className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm sm:text-base text-gray-500 mb-4">暂无分析历史</p>
                        <button
                          onClick={() => navigate('/')}
                          className="text-sm sm:text-base text-mystic-600 hover:text-mystic-800 font-medium"
                        >
                          开始您的第一次分析
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'recharge' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900">积分充值</h3>
                      <p className="mt-1 text-sm text-gray-500">PC 端支持微信扫码支付，移动端支持微信 H5 支付。</p>
                    </div>
                    <PointsRechargePanel onPaid={refreshUserInfo} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
