import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Calendar,
  Clock,
  Compass,
  Palette,
  Hash,
  Users,
  Briefcase,
  Wallet,
  Heart,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Zap,
} from 'lucide-react';
import { PointsConfirmDialog } from '../components/PointsConfirmDialog';
import { CURRENT_PROFILE_EVENT, getStoredCurrentProfile, syncCurrentProfileFromServer } from '../utils/currentProfile';

interface FortuneAspect {
  score: number;
  trend: 'up' | 'down' | 'stable';
  description: string;
  advice: string;
  keyPoint: string;
}

interface AuspiciousHour {
  hour: string;
  branch: string;
  quality: string;
  activities?: string[];
  reason?: string;
}

interface DailyFortuneData {
  date: string;
  dayGanZhi: string;
  lunarDate: string;
  overallScore: number;
  overallTrend: 'up' | 'down' | 'stable';
  overallSummary: string;
  career: FortuneAspect;
  wealth: FortuneAspect;
  relationship: FortuneAspect;
  health: FortuneAspect;
  luckyElements?: {
    colors: string[];
    directions: string[];
    numbers: number[];
    zodiac: string[];
  };
  dailyAdvice?: string[];
  warnings?: string[];
  auspiciousHours?: AuspiciousHour[];
  inauspiciousHours?: AuspiciousHour[];
  deepAnalysis?: string;
  generatedAt?: string;
}

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'stable'; className?: string }> = ({ trend, className = '' }) => {
  if (trend === 'up') return <TrendingUp className={`text-green-500 ${className}`} />;
  if (trend === 'down') return <TrendingDown className={`text-red-500 ${className}`} />;
  return <Minus className={`text-gray-400 ${className}`} />;
};

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 120 }) => {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return '#22c55e';
    if (s >= 60) return '#3b82f6';
    if (s >= 40) return '#eab308';
    return '#ef4444';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(score)}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-800">{score}</span>
        <span className="text-xs text-gray-500">综合评分</span>
      </div>
    </div>
  );
};

const AspectCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  aspect: FortuneAspect;
  colorClass: string;
}> = ({ title, icon, aspect, colorClass }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${colorClass}`}>{icon}</div>
        <span className="font-semibold text-gray-800">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-2xl font-bold text-gray-700">{aspect.score}</span>
        <TrendIcon trend={aspect.trend} className="w-5 h-5" />
      </div>
    </div>
    <p className="text-sm text-gray-600 mb-2">{aspect.description}</p>
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">今日建议</p>
      <p className="text-sm text-gray-700">{aspect.advice}</p>
    </div>
    <div className="mt-2 text-xs text-indigo-600 font-medium">
      核心要点：{aspect.keyPoint}
    </div>
  </div>
);

const DailyFortunePage: React.FC = () => {
  const { date } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const [fortune, setFortune] = useState<DailyFortuneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [userPoints, setUserPoints] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [enhancedLoading, setEnhancedLoading] = useState(false);

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Load current profile
  useEffect(() => {
    syncCurrentProfileFromServer().then(setCurrentProfile).catch(() => setCurrentProfile(getStoredCurrentProfile()));

    const handleProfileChange = () => {
      setCurrentProfile(getStoredCurrentProfile());
    };

    window.addEventListener(CURRENT_PROFILE_EVENT, handleProfileChange);

    // Fetch user info for points
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserPoints(data.user.points);
        }
      })
      .catch(console.error);
    return () => window.removeEventListener(CURRENT_PROFILE_EVENT, handleProfileChange);
  }, []);

  // Fetch fortune data
  useEffect(() => {
    if (currentProfile?.id) {
      fetchFortune();
    }
  }, [currentProfile, targetDate]);

  const fetchFortune = async (enhanced = false) => {
    if (!currentProfile?.id) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fortune/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profileId: currentProfile.id,
          date: targetDate,
          enhanced,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '获取运势失败');
      }

      const data = await response.json();
      setFortune(data.fortune);
      setAiEnhanced(data.aiEnhanced);

      if (data.remainingPoints !== null) {
        setUserPoints(data.remainingPoints);
      }
    } catch (err: any) {
      setError(err.message || '获取运势失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEnhanced = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmEnhanced = async () => {
    setEnhancedLoading(true);
    try {
      await fetchFortune(true);
      setShowConfirmDialog(false);
    } finally {
      setEnhancedLoading(false);
    }
  };

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <Star className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">选择八字档案</h2>
          <p className="text-gray-600 mb-6">请先选择或创建一个八字档案来查看每日运势</p>
          <button
            onClick={() => navigate('/dashboard/profiles')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
          >
            管理我的档案
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-gray-600">正在加载运势数据...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => fetchFortune()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!fortune) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-white/80 hover:text-white mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            返回
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                <h1 className="text-2xl font-bold">今日运势详情</h1>
                {aiEnhanced && (
                  <span className="px-2 py-1 bg-white/20 rounded-full text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI增强版
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{fortune.date}</span>
                </div>
                <span>农历{fortune.lunarDate}</span>
                <span className="font-medium text-white">{fortune.dayGanZhi}</span>
              </div>
            </div>
            <ScoreRing score={fortune.overallScore} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Overall Summary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendIcon trend={fortune.overallTrend} className="w-6 h-6" />
            <h2 className="text-lg font-bold text-gray-800">今日运势概览</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">{fortune.overallSummary}</p>

          {/* AI Enhancement Button */}
          {!aiEnhanced && (
            <button
              onClick={handleRequestEnhanced}
              className="mt-4 w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5" />
              获取AI深度分析 (20点)
            </button>
          )}
        </div>

        {/* Four Dimensions */}
        <div className="grid md:grid-cols-2 gap-4">
          <AspectCard
            title="事业运势"
            icon={<Briefcase className="w-5 h-5 text-blue-600" />}
            aspect={fortune.career}
            colorClass="bg-blue-100"
          />
          <AspectCard
            title="财运分析"
            icon={<Wallet className="w-5 h-5 text-amber-600" />}
            aspect={fortune.wealth}
            colorClass="bg-amber-100"
          />
          <AspectCard
            title="感情运势"
            icon={<Heart className="w-5 h-5 text-rose-600" />}
            aspect={fortune.relationship}
            colorClass="bg-rose-100"
          />
          <AspectCard
            title="健康提醒"
            icon={<Activity className="w-5 h-5 text-green-600" />}
            aspect={fortune.health}
            colorClass="bg-green-100"
          />
        </div>

        {/* Auspicious Hours */}
        {fortune.auspiciousHours && fortune.auspiciousHours.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-800">吉时分析</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fortune.auspiciousHours.map((hour, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border ${
                    hour.quality === 'best'
                      ? 'bg-green-50 border-green-200'
                      : hour.quality === 'good'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800">{hour.hour}</span>
                    <span className="text-xs text-gray-500">{hour.branch}</span>
                  </div>
                  {hour.activities && (
                    <div className="flex flex-wrap gap-1">
                      {hour.activities.map((activity, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white/50 text-xs text-gray-600 rounded"
                        >
                          {activity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lucky Elements */}
        {fortune.luckyElements && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">今日幸运元素</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Colors */}
              <div className="p-4 bg-rose-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-rose-600" />
                  <span className="text-sm font-medium text-gray-700">幸运颜色</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {fortune.luckyElements.colors.map((color, i) => (
                    <span key={i} className="px-2 py-1 bg-white text-sm text-rose-600 rounded">
                      {color}
                    </span>
                  ))}
                </div>
              </div>

              {/* Directions */}
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">吉利方位</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {fortune.luckyElements.directions.map((dir, i) => (
                    <span key={i} className="px-2 py-1 bg-white text-sm text-blue-600 rounded">
                      {dir}
                    </span>
                  ))}
                </div>
              </div>

              {/* Numbers */}
              <div className="p-4 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">幸运数字</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {fortune.luckyElements.numbers.map((num, i) => (
                    <span key={i} className="px-2 py-1 bg-white text-sm text-amber-600 rounded">
                      {num}
                    </span>
                  ))}
                </div>
              </div>

              {/* Zodiac */}
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">贵人生肖</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {fortune.luckyElements.zodiac.map((zodiac, i) => (
                    <span key={i} className="px-2 py-1 bg-white text-sm text-purple-600 rounded">
                      {zodiac}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Advice & Warnings */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Advice */}
          {fortune.dailyAdvice && fortune.dailyAdvice.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-800">今日建议</h2>
              </div>
              <ul className="space-y-3">
                {fortune.dailyAdvice.map((advice, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 shrink-0" />
                    <span className="text-gray-700">{advice}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {fortune.warnings && fortune.warnings.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-gray-800">注意事项</h2>
              </div>
              <ul className="space-y-3">
                {fortune.warnings.map((warning, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 shrink-0" />
                    <span className="text-gray-700">{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Deep Analysis (AI Enhanced only) */}
        {aiEnhanced && fortune.deepAnalysis && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-bold text-gray-800">AI深度解析</h2>
            </div>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {fortune.deepAnalysis}
              </p>
            </div>
          </div>
        )}

        {/* Generated Time */}
        {fortune.generatedAt && (
          <p className="text-xs text-gray-400 text-center">
            生成时间：{new Date(fortune.generatedAt).toLocaleString('zh-CN')}
          </p>
        )}
      </div>

      {/* Points Confirmation Dialog */}
      <PointsConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmEnhanced}
        title="AI深度运势分析"
        description="使用AI深度分析今日运势，包含12时辰吉凶、四维运势详解、个性化建议等专业内容。"
        cost={20}
        currentPoints={userPoints}
        loading={enhancedLoading}
        featureName="DAILY_FORTUNE_AI"
      />
    </div>
  );
};

export default DailyFortunePage;
