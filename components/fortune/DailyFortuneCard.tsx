import React, { useEffect, useState } from 'react';
import { Calendar, ChevronRight, Minus, Sparkles, Star, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { PointsConfirmDialog } from '../PointsConfirmDialog';
import { ProfileInfo, ProfileQuickSwitch } from './ProfileQuickSwitch';
import { normalizeText } from '../../utils/normalizeText';

interface FortuneAspect {
  score: number;
  trend: 'up' | 'down' | 'stable';
  description: string;
  advice: string;
  keyPoint: string;
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
  deepAnalysis?: string;
}

interface DailyFortuneCardProps {
  profileId: string | null;
  profiles: ProfileInfo[];
  onProfileChange: (profileId: string) => void;
  onManageProfiles: () => void;
  isLoggedIn: boolean;
  userPoints: number;
  onViewDetail: (fortune: DailyFortuneData) => void;
  onRequestEnhanced: () => void;
  onLogin: () => void;
}

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'stable'; className?: string }> = ({ trend, className = '' }) => {
  if (trend === 'up') return <TrendingUp className={`text-green-500 ${className}`} />;
  if (trend === 'down') return <TrendingDown className={`text-red-500 ${className}`} />;
  return <Minus className={`text-gray-400 ${className}`} />;
};

const ScoreBar: React.FC<{ score: number; className?: string }> = ({ score, className = '' }) => (
  <div className={`h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}>
    <div
      className={`h-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'} transition-all duration-500`}
      style={{ width: `${score}%` }}
    />
  </div>
);

export const DailyFortuneCard: React.FC<DailyFortuneCardProps> = ({
  profileId,
  profiles,
  onProfileChange,
  onManageProfiles,
  isLoggedIn,
  userPoints,
  onViewDetail,
  onRequestEnhanced,
  onLogin,
}) => {
  const [fortune, setFortune] = useState<DailyFortuneData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [enhancedLoading, setEnhancedLoading] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const weekdayStr = today.toLocaleDateString('zh-CN', { weekday: 'long' });

  useEffect(() => {
    setFortune(null);
    setError(null);
    setAiEnhanced(false);
  }, [profileId]);

  const fetchDailyFortune = async (enhanced = false) => {
    if (!profileId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fortune/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profileId,
          date: new Date().toISOString().split('T')[0],
          enhanced,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.error === 'INSUFFICIENT_POINTS') {
          setError(`积分不足，需要 ${data.required} 点`);
          return;
        }
        if (data.error === 'AUTH_REQUIRED') {
          setError('请先登录');
          return;
        }
        throw new Error(data.message || '获取运势失败');
      }

      setFortune(normalizeText(data.fortune));
      setAiEnhanced(data.aiEnhanced);
    } catch (err: any) {
      setError(err.message || '获取运势失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEnhancedRequest = () => {
    if (!isLoggedIn) {
      onLogin();
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmEnhanced = async () => {
    setEnhancedLoading(true);
    setError(null);
    try {
      await fetchDailyFortune(true);
      setShowConfirmDialog(false);
      onRequestEnhanced();
    } finally {
      setEnhancedLoading(false);
    }
  };

  if (!profileId) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-800">今日运势</h3>
          </div>
          <ProfileQuickSwitch
            profiles={profiles}
            currentProfileId={profileId}
            onProfileChange={onProfileChange}
            onManageProfiles={onManageProfiles}
          />
        </div>
        <p className="text-sm text-gray-500 mb-3">
          {profiles.length === 0 ? '请先创建一个八字档案来查看今日运势' : '请选择一个档案来查看今日运势'}
        </p>
        {profiles.length === 0 && (
          <button
            onClick={onManageProfiles}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            创建我的八字档案
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="h-5 bg-gray-200 rounded w-24" />
        </div>
        <div className="h-16 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error && !fortune) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">今日运势</h3>
        </div>
        <p className="text-sm text-red-500 mb-3">{error}</p>
        <button
          onClick={() => fetchDailyFortune()}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          重新获取
        </button>
      </div>
    );
  }

  if (!fortune) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-800">今日运势</h3>
          </div>
          <ProfileQuickSwitch
            profiles={profiles}
            currentProfileId={profileId}
            onProfileChange={onProfileChange}
            onManageProfiles={onManageProfiles}
          />
        </div>
        <p className="text-sm text-gray-500 mb-3">点击获取今日运势分析</p>
        <button
          onClick={() => fetchDailyFortune()}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          获取今日运势
        </button>
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
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <h3 className="font-semibold text-gray-800">今日运势</h3>
          {aiEnhanced && (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" />
              AI
            </span>
          )}
        </div>
        <ProfileQuickSwitch
          profiles={profiles}
          currentProfileId={profileId}
          onProfileChange={onProfileChange}
          onManageProfiles={onManageProfiles}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          <span>农历{fortune.lunarDate}</span>
          <span className="text-indigo-600 font-medium">{fortune.dayGanZhi}</span>
        </div>
        <span className="text-xs text-gray-400">{dateStr} {weekdayStr}</span>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">综合评分</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-indigo-600">{fortune.overallScore}</span>
            <span className="text-sm text-gray-400">/100</span>
            <TrendIcon trend={fortune.overallTrend} className="w-4 h-4 ml-1" />
          </div>
        </div>
        <ScoreBar score={fortune.overallScore} />
        <p className="text-xs text-gray-600 mt-2">{fortune.overallSummary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatRow label="事业" score={fortune.career.score} trend={fortune.career.trend} />
        <StatRow label="财运" score={fortune.wealth.score} trend={fortune.wealth.trend} />
        <StatRow label="感情" score={fortune.relationship.score} trend={fortune.relationship.trend} />
        <StatRow label="健康" score={fortune.health.score} trend={fortune.health.trend} />
      </div>

      {fortune.luckyElements && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {fortune.luckyElements.colors.slice(0, 2).map((color, i) => (
            <span key={`color-${i}`} className="px-2 py-0.5 bg-rose-50 text-rose-600 text-xs rounded-full">
              {color}
            </span>
          ))}
          {fortune.luckyElements.directions.slice(0, 1).map((dir, i) => (
            <span key={`dir-${i}`} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
              {dir}
            </span>
          ))}
          {fortune.luckyElements.numbers.slice(0, 2).map((num, i) => (
            <span key={`num-${i}`} className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full">
              {num}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onViewDetail(fortune)}
          className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
        >
          查看详情
          <ChevronRight className="w-4 h-4" />
        </button>
        {!aiEnhanced && (
          <button
            onClick={handleEnhancedRequest}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <Zap className="w-4 h-4" />
            深度分析
            <span className="opacity-80 text-xs">20点</span>
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-2 text-center">{error}</p>}

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

const StatRow = ({ label, score, trend }: { label: string; score: number; trend: 'up' | 'down' | 'stable' }) => (
  <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
    <span className="text-xs text-gray-500">{label}</span>
    <div className="flex items-center gap-1">
      <span className="text-sm font-semibold text-gray-700">{score}</span>
      <TrendIcon trend={trend} className="w-3.5 h-3.5" />
    </div>
  </div>
);

export default DailyFortuneCard;
