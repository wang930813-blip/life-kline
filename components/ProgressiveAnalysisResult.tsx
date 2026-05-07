/**
 * 渐进式分析结果展示组件
 * 支持多Agent并行返回，先到先展示
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText, Briefcase, Coins, Heart, Activity, Users, Star, Info,
  Brain, Bitcoin, Compass, Calendar, Sparkles, TrendingUp, TrendingDown,
  User, MapPin, Clock, Zap, AlertCircle, CheckCircle, Loader2, RefreshCw
} from 'lucide-react';
import ProgressiveSkeleton from './ProgressiveSkeleton';
import ResultActions from './ResultActions';
import { normalizeText } from '../utils/normalizeText';

// Agent类型定义
type AgentType = 'core' | 'kline_past' | 'kline_future' | 'career' | 'marriage' | 'crypto';

interface AgentStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  data?: any;
  error?: string;
  elapsed?: string;
}

interface ProgressiveAnalysisResultProps {
  // SSE事件源URL
  analysisUrl?: string;
  // 或者直接传入请求参数
  requestData?: any;
  // 分析完成回调
  onComplete?: (result: any) => void;
  // 错误回调
  onError?: (error: string) => void;
  // 用户名称（用于保存档案和下载图片）
  userName?: string;
  // 保存档案回调
  onSaveProfile?: (profileName: string) => Promise<void>;
  // 分享回调
  onShare?: () => void;
  // 档案ID（用于重新生成）
  profileId?: string;
}

// 验证结果完整性
interface ValidationResult {
  isValid: boolean;
  issues: string[];
  score: number;
}

const validateAnalysisResult = (chartData: any[], analysisData: any): ValidationResult => {
  const issues: string[] = [];
  let score = 100;

  // 检查 chartData
  if (!chartData || !Array.isArray(chartData)) {
    issues.push('K线数据缺失');
    score -= 40;
  } else if (chartData.length === 0) {
    issues.push('K线数据为空');
    score -= 40;
  } else if (chartData.length < 10) {
    issues.push('K线数据不完整（少于10个数据点）');
    score -= 30;
  }

  // 检查 analysisData 核心字段
  if (!analysisData) {
    issues.push('分析数据完全缺失');
    score -= 60;
  } else {
    // 检查性格分析
    if (!analysisData.personality || analysisData.personality.trim().length === 0) {
      issues.push('性格分析内容为空');
      score -= 10;
    }

    // 检查事业分析
    if (!analysisData.industry || analysisData.industry.trim().length === 0) {
      issues.push('事业分析内容为空');
      score -= 10;
    }

    // 检查财富分析
    if (!analysisData.wealth || analysisData.wealth.trim().length === 0) {
      issues.push('财富分析内容为空');
      score -= 10;
    }
  }

  return {
    isValid: score >= 70,
    issues,
    score
  };
};

const ScoreBar = ({ score }: { score: number }) => {
  let colorClass = "bg-gray-300";
  if (score >= 9) colorClass = "bg-green-500";
  else if (score >= 7) colorClass = "bg-indigo-500";
  else if (score >= 5) colorClass = "bg-yellow-500";
  else if (score >= 3) colorClass = "bg-orange-500";
  else colorClass = "bg-red-500";

  return (
    <div className="flex items-center gap-3 mt-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-sm font-bold text-gray-700 min-w-[2.5rem] text-right">
        {score} / 10
      </span>
    </div>
  );
};

const AgentStatusBadge = ({ status, agentName }: { status: AgentStatus; agentName: string }) => {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-100' },
    running: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50', animate: true },
    completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
  };

  const config = statusConfig[status.status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg}`}>
      <Icon className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`} />
      <span className={`text-xs font-medium ${config.color}`}>{agentName}</span>
      {status.elapsed && (
        <span className="text-xs text-gray-400">{status.elapsed}s</span>
      )}
    </div>
  );
};

const toDisplayText = (content: unknown) => {
  if (typeof content === 'string') return normalizeText(content).replace(/\*\*/g, '');
  if (content === null || content === undefined) return '';
  if (Array.isArray(content)) return normalizeText(content.map((item) => String(item)).join('\n')).replace(/\*\*/g, '');
  if (typeof content === 'object') {
    try {
      return normalizeText(JSON.stringify(content)).replace(/\*\*/g, '');
    } catch {
      return normalizeText(String(content)).replace(/\*\*/g, '');
    }
  }
  return normalizeText(String(content)).replace(/\*\*/g, '');
};

const FALLBACK_ANALYSIS_TEXT = '该项详细内容暂未生成。你可以重新测算，或稍后从历史记录中重新打开结果。';

const Card = ({ title, icon: Icon, content, score, colorClass, extraBadges, loading, fallback = FALLBACK_ANALYSIS_TEXT }: any) => {
  if (loading) {
    return <ProgressiveSkeleton type="card" title={title} />;
  }

  const displayContent = React.isValidElement(content) ? content : toDisplayText(content);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex flex-col h-full relative overflow-hidden animate-fade-in">
      <div className={`flex items-center justify-between mb-3 ${colorClass}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <h3 className="font-serif-sc font-bold text-lg">{title}</h3>
        </div>
        <Star className="w-4 h-4 opacity-50" />
      </div>

      {extraBadges && (
        <div className="flex flex-wrap gap-2 mb-3">
          {extraBadges}
        </div>
      )}

      <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap flex-grow">
        {displayContent || fallback}
      </div>

      {typeof score === 'number' && (
        <div className="pt-4 mt-2 border-t border-gray-50">
          <div className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wider">Rating</div>
          <ScoreBar score={score} />
        </div>
      )}
    </div>
  );
};

// 新增: 结果验证警告横幅
const ResultValidationWarning: React.FC<{
  validation: ValidationResult;
  onRegenerate: () => void;
  isRegenerating: boolean;
}> = ({ validation, onRegenerate, isRegenerating }) => {
  if (validation.isValid) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg mb-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-amber-800 font-bold mb-1">检测到分析结果可能不完整</h3>
          <p className="text-amber-700 text-sm mb-2">
            完整性评分: {validation.score}/100
          </p>
          {validation.issues.length > 0 && (
            <ul className="text-amber-700 text-sm space-y-1 mb-3">
              {validation.issues.map((issue, idx) => (
                <li key={idx} className="flex items-center gap-1">
                  <span className="w-1 h-1 bg-amber-600 rounded-full"></span>
                  {issue}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在重新生成...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                重新生成核心分析
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// 新增: 幸运元素卡片
const LuckyElementsCard = ({ data, loading }: { data: any; loading: boolean }) => {
  if (loading) {
    return <ProgressiveSkeleton type="card" title="幸运元素" />;
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-100 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-4 text-amber-600">
        <Sparkles className="w-5 h-5" />
        <h3 className="font-serif-sc font-bold text-lg">幸运元素</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {data?.luckyColors?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">幸运颜色</div>
            <div className="flex flex-wrap gap-1">
              {data.luckyColors.map((color: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-white rounded text-xs font-medium">{color}</span>
              ))}
            </div>
          </div>
        )}

        {data?.luckyDirections?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">幸运方位</div>
            <div className="flex flex-wrap gap-1">
              {data.luckyDirections.map((dir: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-white rounded text-xs font-medium">{dir}</span>
              ))}
            </div>
          </div>
        )}

        {data?.luckyZodiac?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">幸运属相</div>
            <div className="flex flex-wrap gap-1">
              {data.luckyZodiac.map((zodiac: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-white rounded text-xs font-medium">{zodiac}</span>
              ))}
            </div>
          </div>
        )}

        {data?.luckyNumbers?.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">幸运数字</div>
            <div className="flex flex-wrap gap-1">
              {data.luckyNumbers.map((num: number, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-white rounded text-xs font-medium">{num}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 新增: 个人特征卡片
const PersonalTraitsCard = ({ data, loading }: { data: any; loading: boolean }) => {
  if (loading) {
    return <ProgressiveSkeleton type="card" title="个人特征" />;
  }

  if (!data?.appearance && !data?.bodyType && !data?.skin && !data?.characterSummary) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 p-6 rounded-xl border border-violet-100 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-4 text-violet-600">
        <User className="w-5 h-5" />
        <h3 className="font-serif-sc font-bold text-lg">个人特征</h3>
      </div>

      <div className="space-y-3 text-sm">
        {data?.appearance && (
          <div>
            <span className="text-gray-500">相貌:</span>
            <span className="ml-2 text-gray-700">{data.appearance}</span>
          </div>
        )}
        {data?.bodyType && (
          <div>
            <span className="text-gray-500">体型:</span>
            <span className="ml-2 text-gray-700">{data.bodyType}</span>
          </div>
        )}
        {data?.skin && (
          <div>
            <span className="text-gray-500">肤质:</span>
            <span className="ml-2 text-gray-700">{data.skin}</span>
          </div>
        )}
        {data?.characterSummary && (
          <div>
            <span className="text-gray-500">性格标签:</span>
            <span className="ml-2 text-gray-700">{data.characterSummary}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// 新增: 运势预测卡片
const FortuneCard = ({ data, loading }: { data: any; loading: boolean }) => {
  if (loading) {
    return <ProgressiveSkeleton type="card" title="运势预测" />;
  }

  return (
    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-6 rounded-xl border border-cyan-100 shadow-sm col-span-full animate-fade-in">
      <div className="flex items-center gap-2 mb-4 text-cyan-600">
        <Calendar className="w-5 h-5" />
        <h3 className="font-serif-sc font-bold text-lg">运势预测</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {data?.monthlyFortune && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Clock className="w-4 h-4" /> 本月运势
            </h4>
            <p className="text-sm text-gray-600">{data.monthlyFortune}</p>
            {data?.monthlyHighlights?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {data.monthlyHighlights.map((item: string, i: number) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                    <span className="text-cyan-500">•</span> {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {data?.yearlyFortune && (
          <div>
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Zap className="w-4 h-4" /> 今年运势
            </h4>
            <p className="text-sm text-gray-600">{data.yearlyFortune}</p>
            {data?.yearlyKeyEvents?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {data.yearlyKeyEvents.map((item: string, i: number) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                    <span className="text-cyan-500">•</span> {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 重点日期 */}
      {(data?.keyDatesThisMonth?.length > 0 || data?.keyDatesThisYear?.length > 0) && (
        <div className="mt-4 pt-4 border-t border-cyan-100">
          <h4 className="font-medium text-gray-700 mb-2">重点日期</h4>
          <div className="flex flex-wrap gap-2">
            {data?.keyDatesThisMonth?.map((date: string, i: number) => (
              <span key={`m${i}`} className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs rounded">
                {date}
              </span>
            ))}
            {data?.keyDatesThisYear?.map((date: string, i: number) => (
              <span key={`y${i}`} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                {date}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 主组件
const ProgressiveAnalysisResult: React.FC<ProgressiveAnalysisResultProps> = ({
  analysisUrl,
  requestData,
  onComplete,
  onError,
  userName,
  onSaveProfile,
  onShare,
  profileId,
}) => {
  // Agent状态
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentType, AgentStatus>>({
    core: { status: 'pending' },
    kline_past: { status: 'pending' },
    kline_future: { status: 'pending' },
    career: { status: 'pending' },
    marriage: { status: 'pending' },
    crypto: { status: 'pending' },
  });

  // K线数据需要分别保存过去和未来
  const [pastChartData, setPastChartData] = useState<any[]>([]);

  // 合并后的分析数据
  const [analysis, setAnalysis] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);

  // 验证和重新生成状态
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // 更新Agent状态
  const updateAgentStatus = useCallback((agentType: AgentType, update: Partial<AgentStatus>) => {
    setAgentStatuses(prev => ({
      ...prev,
      [agentType]: { ...prev[agentType], ...update },
    }));
  }, []);

  // 合并Agent数据到analysis
  const mergeAgentData = useCallback((agentType: AgentType, data: any) => {
    setAnalysis(prev => {
      const newAnalysis = { ...prev };

      switch (agentType) {
        case 'core':
          Object.assign(newAnalysis, {
            bazi: data.bazi,
            summary: data.summary,
            summaryScore: data.summaryScore,
            personality: data.personality,
            personalityScore: data.personalityScore,
            family: data.family,
            familyScore: data.familyScore,
            fengShui: data.fengShui,
            fengShuiScore: data.fengShuiScore,
            appearance: data.appearance,
            bodyType: data.bodyType,
            skin: data.skin,
            characterSummary: data.characterSummary,
            luckyColors: data.luckyColors,
            luckyDirections: data.luckyDirections,
            luckyZodiac: data.luckyZodiac,
            luckyNumbers: data.luckyNumbers,
            monthlyFortune: data.monthlyFortune,
            monthlyHighlights: data.monthlyHighlights,
            yearlyFortune: data.yearlyFortune,
            yearlyKeyEvents: data.yearlyKeyEvents,
            keyDatesThisMonth: data.keyDatesThisMonth,
            keyDatesThisYear: data.keyDatesThisYear,
          });
          break;

        case 'kline_past':
          // 保存过去K线数据
          if (data.chartPoints) {
            setPastChartData(data.chartPoints);
            // 立即合并到chartData
            setChartData(prevChart => {
              // 合并过去和现有的未来数据
              const futurePoints = prevChart.filter(p => !data.chartPoints.some((pp: any) => pp.year === p.year && pp.age === p.age));
              return [...data.chartPoints, ...futurePoints].sort((a, b) => a.age - b.age);
            });
          }
          Object.assign(newAnalysis, {
            pastEvents: data.pastEvents || newAnalysis.pastEvents,
          });
          break;

        case 'kline_future':
          // 保存未来K线数据并与过去数据合并
          if (data.chartPoints) {
            setChartData(prevChart => {
              // 获取已有的过去数据
              const existingPastPoints = prevChart.filter(p => !data.chartPoints.some((fp: any) => fp.year === p.year && fp.age === p.age));
              return [...existingPastPoints, ...data.chartPoints].sort((a, b) => a.age - b.age);
            });
          }
          Object.assign(newAnalysis, {
            futureEvents: data.futureEvents || newAnalysis.futureEvents,
            peakYears: data.keyYears?.filter((k: any) => k.type === 'peak') || newAnalysis.peakYears,
            troughYears: data.keyYears?.filter((k: any) => k.type === 'trough') || newAnalysis.troughYears,
          });
          break;

        case 'career':
          Object.assign(newAnalysis, {
            industry: data.industry,
            industryScore: data.industryScore,
            wealth: data.wealth,
            wealthScore: data.wealthScore,
          });
          break;

        case 'marriage':
          Object.assign(newAnalysis, {
            marriage: data.marriage,
            marriageScore: data.marriageScore,
            health: data.health,
            healthScore: data.healthScore,
            healthBodyParts: data.healthBodyParts,
          });
          break;

        case 'crypto':
          Object.assign(newAnalysis, {
            crypto: data.crypto,
            cryptoScore: data.cryptoScore,
            cryptoYear: data.cryptoYear,
            cryptoStyle: data.cryptoStyle,
          });
          break;
      }

      return newAnalysis;
    });
  }, []);

  // SSE连接处理
  useEffect(() => {
    if (!requestData) return;

    // 初始化所有Agent为running状态
    setAgentStatuses({
      core: { status: 'running' },
      kline_past: { status: 'running' },
      kline_future: { status: 'running' },
      career: { status: 'running' },
      marriage: { status: 'running' },
      crypto: { status: 'running' },
    });

    const url = analysisUrl || '/api/analyze-parallel';

    // 使用fetch + ReadableStream处理SSE
    const abortController = new AbortController();

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
      signal: abortController.signal,
    }).then(async response => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析SSE事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);

            if (currentEvent && currentData) {
              try {
                const data = JSON.parse(currentData);

                // 处理不同类型的事件
                if (currentEvent === 'progress') {
                  setProgressMessages(prev => [...prev.slice(-4), data.message]);
                } else if (currentEvent.startsWith('agent_') && currentEvent.endsWith('_complete')) {
                  const agentType = currentEvent.replace('agent_', '').replace('_complete', '') as AgentType;
                  updateAgentStatus(agentType, {
                    status: 'completed',
                    data: data.data,
                    elapsed: data.elapsed,
                  });
                  mergeAgentData(agentType, data.data);
                } else if (currentEvent.startsWith('agent_') && currentEvent.endsWith('_error')) {
                  const agentType = currentEvent.replace('agent_', '').replace('_error', '') as AgentType;
                  updateAgentStatus(agentType, {
                    status: 'failed',
                    error: data.error,
                  });
                } else if (currentEvent === 'cache_hit') {
                  setFromCache(true);
                  setProgressMessages(prev => [...prev, '✓ 命中缓存']);
                } else if (currentEvent === 'complete') {
                  setIsComplete(true);
                  setFromCache(data.fromCache || false);

                  // 如果是完整结果（缓存命中），直接设置
                  if (data.result) {
                    setAnalysis(data.result.analysis);
                    setChartData(data.result.chartData || []);
                  }

                  onComplete?.(data);
                } else if (currentEvent === 'error') {
                  onError?.(data.message || data.error);
                }
              } catch (e) {
                console.error('SSE解析错误:', e);
              }
            }

            currentEvent = '';
            currentData = '';
          }
        }
      }
    }).catch(error => {
      if (error.name !== 'AbortError') {
        console.error('SSE连接错误:', error);
        onError?.(error.message);
      }
    });

    return () => {
      abortController.abort();
    };
  }, [requestData, analysisUrl, onComplete, onError, updateAgentStatus, mergeAgentData]);

  // 验证分析结果完整性（当分析完成时）
  useEffect(() => {
    if (isComplete && analysis && chartData) {
      const validationResult = validateAnalysisResult(chartData, analysis);
      setValidation(validationResult);

      if (!validationResult.isValid) {
        console.warn('[ProgressiveAnalysisResult] 检测到分析结果不完整:', validationResult);
      }
    }
  }, [isComplete, analysis, chartData]);

  // 重新生成核心文档
  const handleRegenerate = useCallback(async () => {
    if (!profileId) {
      onError?.('无法重新生成：缺少档案ID');
      return;
    }

    setIsRegenerating(true);

    try {
      const response = await fetch(`/api/profiles/${profileId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reason: '用户手动触发 - 结果不完整'
        }),
      });

      if (!response.ok) {
        throw new Error('重新生成失败');
      }

      const data = await response.json();

      // 显示成功消息
      setProgressMessages(prev => [...prev, '✓ 核心文档重新生成已触发']);

      // 等待2秒后刷新页面或重新加载结果
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('[ProgressiveAnalysisResult] 重新生成失败:', error);
      onError?.('重新生成失败，请稍后重试');
    } finally {
      setIsRegenerating(false);
    }
  }, [profileId, onError]);

  // Agent名称映射
  const agentNames: Record<AgentType, string> = {
    core: '核心命理',
    kline_past: '过去K线',
    kline_future: '未来K线',
    career: '事业财富',
    marriage: '婚姻健康',
    crypto: '币圈分析',
  };

  // 检查特定Agent是否完成
  const isAgentComplete = (type: AgentType) => agentStatuses[type].status === 'completed';

  // 检查K线是否完成（过去或未来任意一个完成就算部分完成）
  const isKlinePartialComplete = () =>
    agentStatuses.kline_past.status === 'completed' ||
    agentStatuses.kline_future.status === 'completed';

  return (
    <div className="w-full space-y-8 animate-fade-in-up">
      {/* Agent状态指示器 */}
      <div className="bg-gray-50 p-4 rounded-xl">
        <div className="flex flex-wrap gap-2 justify-center">
          {(Object.keys(agentStatuses) as AgentType[]).map(type => (
            <AgentStatusBadge
              key={type}
              status={agentStatuses[type]}
              agentName={agentNames[type]}
            />
          ))}
        </div>

        {/* 进度消息 */}
        {progressMessages.length > 0 && (
          <div className="mt-3 text-center text-xs text-gray-500">
            {progressMessages[progressMessages.length - 1]}
          </div>
        )}

        {/* 缓存命中标记 */}
        {fromCache && (
          <div className="mt-2 text-center">
            <span className="px-3 py-1 bg-green-100 text-green-600 text-xs rounded-full">
              ✓ 结果来自缓存 - 一致性保证
            </span>
          </div>
        )}
      </div>

      {/* Result Actions - Save Profile, Download Image, Share */}
      {isComplete && analysis?.bazi?.length > 0 && (
        <div className="flex justify-center">
          <ResultActions
            baziInfo={{
              yearPillar: analysis.bazi[0] || '',
              monthPillar: analysis.bazi[1] || '',
              dayPillar: analysis.bazi[2] || '',
              hourPillar: analysis.bazi[3] || '',
              birthYear: requestData?.birthYear || '',
            }}
            userName={userName}
            onSaveProfile={onSaveProfile}
            onShare={onShare}
            resultElementId="result-chart-section"
          />
        </div>
      )}

      {/* 结果验证警告 */}
      {validation && !validation.isValid && profileId && (
        <ResultValidationWarning
          validation={validation}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        />
      )}

      {/* Results Section - Wrapper for image capture */}
      <div id="result-chart-section">
      {/* Bazi Pillars */}
      {analysis?.bazi?.length > 0 && (
        <div className="flex justify-center gap-2 md:gap-8 bg-gray-900 text-amber-50 p-6 rounded-xl shadow-sm overflow-x-auto animate-fade-in">
          {analysis.bazi.map((pillar: string, index: number) => {
            const labels = ['年柱', '月柱', '日柱', '时柱'];
            return (
              <div key={index} className="text-center min-w-[60px]">
                <div className="text-xs text-gray-400 mb-1">{labels[index]}</div>
                <div className="text-xl md:text-3xl font-serif-sc font-bold tracking-widest">{pillar}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {(isAgentComplete('core') || analysis?.summary) ? (
        <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 shadow-sm animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <h3 className="flex items-center gap-2 font-serif-sc font-bold text-xl text-indigo-900">
              <ScrollText className="w-5 h-5" />
              命理总评
            </h3>
            <div className="w-full md:w-1/3">
              <ScoreBar score={analysis?.summaryScore || 5} />
            </div>
          </div>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">
            {analysis?.summary || '正在分析中...'}
          </p>
        </div>
      ) : (
        <ProgressiveSkeleton type="summary" />
      )}

      {/* 个人特征 & 幸运元素 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PersonalTraitsCard data={analysis} loading={!isAgentComplete('core')} />
        <LuckyElementsCard data={analysis} loading={!isAgentComplete('core')} />
      </div>

      {/* 运势预测 */}
      <FortuneCard data={analysis} loading={!isAgentComplete('core')} />

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Crypto Analysis - 优先展示 */}
        <Card
          title="币圈交易运势"
          icon={Bitcoin}
          content={analysis?.crypto}
          score={analysis?.cryptoScore}
          colorClass="text-amber-600"
          loading={!isAgentComplete('crypto')}
          extraBadges={
            isAgentComplete('crypto') && (
              <>
                <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded border border-amber-200">
                  🔥 暴富流年: {analysis?.cryptoYear || '待定'}
                </span>
                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded border border-indigo-200">
                  🎯 推荐: {analysis?.cryptoStyle || '待定'}
                </span>
              </>
            )
          }
        />

        <Card
          title="性格分析"
          icon={Brain}
          content={analysis?.personality}
          score={analysis?.personalityScore}
          colorClass="text-teal-600"
          loading={!isAgentComplete('core')}
        />

        <Card
          title="事业行业"
          icon={Briefcase}
          content={analysis?.industry}
          score={analysis?.industryScore}
          colorClass="text-blue-600"
          loading={!isAgentComplete('career')}
        />

        <Card
          title="发展风水"
          icon={Compass}
          content={analysis?.fengShui}
          score={analysis?.fengShuiScore}
          colorClass="text-cyan-700"
          loading={!isAgentComplete('core')}
        />

        <Card
          title="财富层级"
          icon={Coins}
          content={analysis?.wealth}
          score={analysis?.wealthScore}
          colorClass="text-amber-600"
          loading={!isAgentComplete('career')}
        />

        <Card
          title="婚姻情感"
          icon={Heart}
          content={analysis?.marriage}
          score={analysis?.marriageScore}
          colorClass="text-pink-600"
          loading={!isAgentComplete('marriage')}
        />

        <Card
          title="身体健康"
          icon={Activity}
          content={analysis?.health}
          score={analysis?.healthScore}
          colorClass="text-emerald-600"
          loading={!isAgentComplete('marriage')}
          extraBadges={
            isAgentComplete('marriage') && analysis?.healthBodyParts?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {analysis.healthBodyParts.map((part: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded">
                    注意: {part}
                  </span>
                ))}
              </div>
            )
          }
        />

        <Card
          title="六亲关系"
          icon={Users}
          content={analysis?.family}
          score={analysis?.familyScore}
          colorClass="text-purple-600"
          loading={!isAgentComplete('core')}
        />

        {/* Score Explanation Card */}
        <Card
          title="评分讲解"
          icon={Info}
          colorClass="text-gray-600"
          loading={false}
          content={
            <div className="space-y-4">
              <ul className="space-y-1.5 font-mono text-xs md:text-sm">
                <li className="flex justify-between items-center border-b border-gray-100 pb-1">
                  <span>0-2分</span>
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded font-bold">极差</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-1">
                  <span>3-4分</span>
                  <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded font-bold">差</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-1">
                  <span>5-6分</span>
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded font-bold">一般</span>
                </li>
                <li className="flex justify-between items-center border-b border-gray-100 pb-1">
                  <span>7-8分</span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded font-bold">好</span>
                </li>
                <li className="flex justify-between items-center">
                  <span>9-10分</span>
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded font-bold">极好</span>
                </li>
              </ul>
              <p className="text-xs text-black leading-relaxed border-t border-gray-100 pt-2 text-justify">
                注：命运还受环境和个人选择影响，八字趋势不能完全代表真实人生。
              </p>
            </div>
          }
        />
      </div>

      {/* Peak & Trough Years */}
      {(analysis?.peakYears?.length > 0 || analysis?.troughYears?.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          {analysis?.peakYears?.length > 0 && (
            <div className="bg-green-50 p-5 rounded-xl border border-green-100 animate-fade-in">
              <div className="flex items-center gap-2 mb-3 text-green-600">
                <TrendingUp className="w-5 h-5" />
                <h3 className="font-bold">巅峰年份</h3>
              </div>
              <div className="space-y-2">
                {analysis.peakYears.map((peak: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{peak.year}年 ({peak.age}岁)</span>
                    <span className="text-green-600 font-bold">{peak.score}分</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis?.troughYears?.length > 0 && (
            <div className="bg-red-50 p-5 rounded-xl border border-red-100 animate-fade-in">
              <div className="flex items-center gap-2 mb-3 text-red-600">
                <TrendingDown className="w-5 h-5" />
                <h3 className="font-bold">低谷年份</h3>
              </div>
              <div className="space-y-2">
                {analysis.troughYears.map((trough: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{trough.year}年 ({trough.age}岁)</span>
                    <span className="text-red-600 font-bold">{trough.score}分</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div> {/* End of result-chart-section wrapper */}
    </div>
  );
};

export default ProgressiveAnalysisResult;
