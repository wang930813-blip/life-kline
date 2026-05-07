import React, { useState, useMemo, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import BaziForm from '../components/BaziForm';
import { UserInput, LifeDestinyResult, AgentType, AgentStatus, Gender } from '../types';
import { generateLifeAnalysis, generateParallelAnalysis, ParallelAnalysisCallbacks } from '../services/geminiService';
import { API_STATUS } from '../constants';
import { AlertCircle, Download, Printer, Trophy, Loader2, BookOpen, Users, CheckCircle, Clock, Zap, RefreshCw, Eye, PanelRightOpen, PanelRightClose, FileText, X } from 'lucide-react';
import SEO from '../components/SEO';
import SharePanel from '../components/share/SharePanel';
import PartialResultsModal from '../components/PartialResultsModal';
import BaziSavePrompt from '../components/BaziSavePrompt';
import SaveProfileDialog from '../components/SaveProfileDialog';

// Lazy load heavy components
const LifeKLineChart = lazy(() => import('../components/LifeKLineChart'));
const AnalysisResult = lazy(() => import('../components/AnalysisResult'));
const KLineTextTable = lazy(() => import('../components/KLineTextTable'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
  </div>
);

const AgentStatusBadge: React.FC<{ agentType: AgentType; status: AgentStatus; name: string }> = ({ status, name }) => {
  const getStatusIcon = () => {
    switch (status.status) {
      case 'pending': return <Clock className="w-3 h-3 text-gray-400" />;
      case 'running': return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failed': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const getBgColor = () => {
    switch (status.status) {
      case 'pending': return 'bg-gray-100';
      case 'running': return 'bg-blue-50 border-blue-200';
      case 'completed': return 'bg-green-50 border-green-200';
      case 'failed': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getBgColor()}`}>
      {getStatusIcon()}
      <span>{name}</span>
      {status.elapsed && <span className="text-gray-400">({status.elapsed})</span>}
    </div>
  );
};

const getAgentPreview = (type: AgentType, data: any) => {
  if (!data) return '';
  const pick = (...values: unknown[]) => values.find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;

  const text =
    type === 'core' ? pick(data.summary, data.personality, data.family, data.fengShui) :
    type === 'kline' ? pick(data.summary, data.pastEvents?.[0]?.event, data.futureEvents?.[0]?.event, data.chartPoints?.[0]?.reason) :
    type === 'career' ? pick(data.industry, data.wealth) :
    type === 'marriage' ? pick(data.marriage, data.health) :
    type === 'crypto' ? pick(data.crypto, data.cryptoStyle, data.cryptoYear) :
    '';

  if (!text) return '该模块已完成，正在合并结果。';
  return text;
};

const mergeByYearAndAge = (items: any[] = []) => {
  return items
    .filter(Boolean)
    .filter((point, index, points) => points.findIndex(item => item?.year === point.year && item?.age === point.age) === index)
    .sort((a, b) => (a.age || 0) - (b.age || 0));
};

const mergeEvents = (items: any[] = []) => {
  return items
    .filter(Boolean)
    .filter((event, index, events) => {
      const key = `${event?.year || ''}-${event?.event || event?.reason || JSON.stringify(event)}`;
      return events.findIndex(item => `${item?.year || ''}-${item?.event || item?.reason || JSON.stringify(item)}` === key) === index;
    });
};

const LoginRequiredCard: React.FC<{ onLogin: () => void; onRegister: () => void }> = ({ onLogin, onRegister }) => (
  <div className="bamboo-card w-full max-w-md p-8 text-center space-y-5">
    <div>
      <h3 className="text-2xl font-serif-sc font-bold text-[var(--color-qingdai)] mb-2">登录后开始排盘</h3>
      <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
        为了保存命盘、扣减点数并同步历史记录，请先登录账号后再填写出生信息。
      </p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <button type="button" onClick={onLogin} className="classical-button py-3 font-bold">
        登录
      </button>
      <button type="button" onClick={onRegister} className="ink-ripple py-3 font-bold rounded-full border border-[var(--border-ink)] text-[var(--color-qingdai)] bg-[var(--color-xuan-paper)]">
        注册
      </button>
    </div>
  </div>
);

const ParallelAnalysisProgress: React.FC<{
  agentStatuses: Record<AgentType, AgentStatus>;
  progressMessage: string;
  fromCache: boolean;
  onShowPartialResults?: () => void;
}> = ({ agentStatuses, progressMessage, fromCache, onShowPartialResults }) => {
  const agentNames: Record<AgentType, string> = {
    core: '核心命理', kline: 'K线数据', career: '事业财富', marriage: '婚姻健康', crypto: '币圈分析',
  };

  const completedCount = Object.values(agentStatuses).filter(s => s.status === 'completed').length;
  const totalAgents = Object.keys(agentStatuses).length;
  const hasCompletedAgents = completedCount > 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">5个专业Agent并行分析中</h3>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>分析进度</span>
            <span>{completedCount}/{totalAgents} 完成</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${(completedCount / totalAgents) * 100}%` }} />
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {(Object.keys(agentStatuses) as AgentType[]).map(type => {
            const status = agentStatuses[type];
            return (
              <div key={type} className="rounded-xl border border-[var(--border-ink)] bg-[rgb(251_247_234_/_0.78)] p-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <AgentStatusBadge agentType={type} status={status} name={agentNames[type]} />
                  {status.elapsed && <span className="text-xs text-gray-400">{status.elapsed}s</span>}
                </div>
                {(status.status === 'completed' || (type === 'kline' && status.data)) && (
                  <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--color-qingdai)]">
                    {getAgentPreview(type, status.data)}
                  </p>
                )}
                {status.status === 'failed' && (
                  <p className="mt-2 text-sm text-red-600">{status.error || '该模块暂时失败，系统会尽量合并已完成结果。'}</p>
                )}
              </div>
            );
          })}
        </div>

        {hasCompletedAgents && onShowPartialResults && (
          <div className="mb-4">
            <button onClick={onShowPartialResults} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all font-medium shadow-sm">
              <Eye className="w-4 h-4" />
              <span>查看已有结果 ({completedCount}个模块已完成)</span>
            </button>
          </div>
        )}

        {progressMessage && <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-lg p-2">{progressMessage}</div>}
        {fromCache && <div className="mt-3 text-center"><span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">✓ 命中缓存 - 一致性保证</span></div>}
      </div>
    </div>
  );
};

// Local storage helpers
const HISTORY_STORAGE_KEY = 'lifekline_history';
const MAX_LOCAL_HISTORY = 10;
const PROFILES_STORAGE_KEY = 'lifekline_profiles';
const MAX_PROFILES = 10;

interface UserProfile extends UserInput {
  id: string;
  isDefault: boolean;
  createdAt: string;
}

const saveLocalHistory = (input: UserInput, result: LifeDestinyResult) => {
  try {
    const data = localStorage.getItem(HISTORY_STORAGE_KEY);
    const history = data ? JSON.parse(data) : [];
    const newItem = { id: `local_${Date.now()}`, createdAt: new Date().toISOString(), cost: 0, input, result };
    const updated = [newItem, ...history].slice(0, MAX_LOCAL_HISTORY);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
};

const loadProfiles = (): UserProfile[] => {
  try {
    const saved = localStorage.getItem(PROFILES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

const saveProfile = (profileData: { name: string; gender: Gender; birthYear: string; yearPillar: string; monthPillar: string; dayPillar: string; hourPillar: string; startAge?: string; firstDaYun?: string; }): UserProfile | null => {
  const profiles = loadProfiles();
  if (profiles.length >= MAX_PROFILES) throw new Error('档案数量已达上限');

  const newProfile: UserProfile = {
    id: `profile_${Date.now()}`, name: profileData.name, gender: profileData.gender, birthYear: profileData.birthYear, birthPlace: '',
    yearPillar: profileData.yearPillar, monthPillar: profileData.monthPillar, dayPillar: profileData.dayPillar, hourPillar: profileData.hourPillar,
    startAge: profileData.startAge || '', firstDaYun: profileData.firstDaYun || '', modelName: '', apiBaseUrl: '', apiKey: '', useCustomApi: false,
    isDefault: profiles.length === 0, createdAt: new Date().toISOString(),
  };

  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify([...profiles, newProfile]));
  return newProfile;
};

interface HomePageProps {
  isLoggedIn: boolean;
  isGuest: boolean;
  setIsGuest: (value: boolean) => void;
  setIsLoggedIn: (value: boolean) => void;
  setUserInfo: (info: { email: string; points: number } | null) => void;
  openLoginModal?: () => void;
  openRegisterModal: () => void;
  refreshUserInfo: () => void;
  // From App: history selection
  historyResult?: LifeDestinyResult | null;
  historyInput?: UserInput | null;
  onClearHistory?: () => void;
  // From App: analysis panel state
  onAnalysisPanelChange?: (isOpen: boolean) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  isLoggedIn, isGuest, setIsGuest, setIsLoggedIn, setUserInfo, openLoginModal, openRegisterModal, refreshUserInfo,
  historyResult, historyInput, onClearHistory, onAnalysisPanelChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LifeDestinyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [currentInput, setCurrentInput] = useState<UserInput | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Right panel state
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  // Notify parent when analysis panel state changes
  useEffect(() => {
    onAnalysisPanelChange?.(rightPanelOpen);
  }, [rightPanelOpen, onAnalysisPanelChange]);

  // Wake Lock
  const wakeLockRef = useRef<any>(null);
  const requestWakeLock = useCallback(async () => {
    try { if ('wakeLock' in navigator) wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {}
  }, []);
  const releaseWakeLock = useCallback(() => { if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; } }, []);
  useEffect(() => () => releaseWakeLock(), [releaseWakeLock]);

  // Analysis state
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentType, AgentStatus>>({
    core: { status: 'pending' }, kline: { status: 'pending' }, career: { status: 'pending' }, marriage: { status: 'pending' }, crypto: { status: 'pending' },
  });
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [fromCache, setFromCache] = useState(false);
  const [showPartialResults, setShowPartialResults] = useState(false);

  // Save profile state
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePromptDismissed, setSavePromptDismissed] = useState(false);

  const resetAgentStatuses = useCallback(() => {
    setAgentStatuses({ core: { status: 'running' }, kline: { status: 'running' }, career: { status: 'running' }, marriage: { status: 'running' }, crypto: { status: 'running' } });
    setProgressMessage('');
    setFromCache(false);
  }, []);

  // Handle history selection from LeftNav (via App)
  useEffect(() => {
    if (historyResult && historyInput) {
      setResult(historyResult);
      setUserName(historyInput.name || '');
      setCurrentInput(historyInput);
      setError(null);
      setSavePromptDismissed(true);
    }
  }, [historyResult, historyInput]);

  const handleNewCalculation = useCallback(() => {
    setResult(null);
    setUserName('');
    setCurrentInput(null);
    setError(null);
    setRightPanelOpen(false);
    setSavePromptDismissed(false);
    onClearHistory?.();
  }, [onClearHistory]);

  useEffect(() => {
    if (result && currentInput && !savePromptDismissed) {
      const isBaziComplete = currentInput.yearPillar && currentInput.monthPillar && currentInput.dayPillar && currentInput.hourPillar;
      if (isBaziComplete) {
        const timer = setTimeout(() => setShowSavePrompt(true), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [result, currentInput, savePromptDismissed]);

  const handleSaveProfile = async (profileName: string) => {
    if (!currentInput) throw new Error('没有可保存的八字信息');
    saveProfile({ name: profileName, gender: currentInput.gender, birthYear: currentInput.birthYear, yearPillar: currentInput.yearPillar, monthPillar: currentInput.monthPillar, dayPillar: currentInput.dayPillar, hourPillar: currentInput.hourPillar, startAge: currentInput.startAge, firstDaYun: currentInput.firstDaYun });
    if (isLoggedIn) {
      try {
        await fetch('/api/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: profileName, gender: currentInput.gender === Gender.MALE ? 'male' : 'female', birthYear: parseInt(currentInput.birthYear, 10), yearPillar: currentInput.yearPillar, monthPillar: currentInput.monthPillar, dayPillar: currentInput.dayPillar, hourPillar: currentInput.hourPillar }) });
      } catch {}
    }
    setShowSavePrompt(false);
    setSavePromptDismissed(true);
  };

  const handleFormSubmit = async (data: UserInput) => {
    if (API_STATUS === 0) { setError("System is under maintenance"); return; }
    if (!isLoggedIn) {
      openLoginModal?.();
      setError('请先登录后再生成分析。');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setUserName(data.name || '');
    setCurrentInput(data);
    resetAgentStatuses();
    setShowSavePrompt(false);
    setSavePromptDismissed(false);

    await requestWakeLock();

    const callbacks: ParallelAnalysisCallbacks = {
      onProgress: setProgressMessage,
      onAgentUpdate: (agentType, status) => setAgentStatuses(prev => {
        const previous = prev[agentType];
        const mergedData = agentType === 'kline'
          ? {
              ...(previous.data || {}),
              ...(status.data || {}),
              agentParts: Array.from(new Set([
                ...((previous.data?.agentParts || []) as string[]),
                ...(status.data?.agentPart ? [status.data.agentPart] : []),
              ])),
              chartPoints: mergeByYearAndAge([
                ...((previous.data?.chartPoints || []) as any[]),
                ...((status.data?.chartPoints || []) as any[]),
              ]),
              pastEvents: mergeEvents([
                ...((previous.data?.pastEvents || []) as any[]),
                ...((status.data?.pastEvents || []) as any[]),
              ]),
              futureEvents: mergeEvents([
                ...((previous.data?.futureEvents || []) as any[]),
                ...((status.data?.futureEvents || []) as any[]),
              ]),
            }
          : status.data;
        const klineCompleted = agentType === 'kline'
          ? ['kline_past', 'kline_future'].every(part => (mergedData?.agentParts || []).includes(part))
          : false;
        const nextStatus = agentType === 'kline'
          ? (klineCompleted ? 'completed' : status.status === 'failed' ? 'failed' : 'running')
          : status.status;

        return {
          ...prev,
          [agentType]: {
            ...previous,
            ...status,
            status: nextStatus,
            data: mergedData,
          },
        };
      }),
      onCacheHit: () => setFromCache(true),
    };

    try {
      const response = await generateParallelAnalysis(data, callbacks);
      setResult(response.result);
      setIsGuest(response.isGuest);
      setFromCache(response.fromCache || false);
      if (response.user) { setIsLoggedIn(true); setUserInfo({ email: response.user.email, points: response.user.points }); }
      saveLocalHistory(data, response.result);
      if (!response.isGuest) refreshUserInfo();
    } catch (err: any) {
      try {
        const response = await generateLifeAnalysis(data, setProgressMessage);
        setResult(response.result);
        setIsGuest(response.isGuest);
        if (response.user) { setIsLoggedIn(true); setUserInfo({ email: response.user.email, points: response.user.points }); }
        saveLocalHistory(data, response.result);
        if (!response.isGuest) refreshUserInfo();
      } catch (legacyErr: any) {
        setError(legacyErr.message || "分析失败，请重试");
      }
    } finally {
      setLoading(false);
      releaseWakeLock();
    }
  };

  const requireLogin = (action: () => void) => { if (isGuest && !isLoggedIn) openRegisterModal(); else action(); };
  const handlePrint = () => requireLogin(() => window.print());

  const handleSaveHtml = () => {
    if (!result || (isGuest && !isLoggedIn)) { openRegisterModal(); return; }
    const now = new Date();
    const chartSvg = document.querySelector('.recharts-surface')?.outerHTML || '';
    const analysisHtml = document.getElementById('analysis-result-container')?.innerHTML || '';
    const tableRows = result.chartData.map(item => `<tr><td class="p-2 text-center">${item.age}岁</td><td class="p-2 text-center">${item.year} ${item.ganZhi}</td><td class="p-2 text-center">${item.daYun || '-'}</td><td class="p-2 text-center ${item.close >= item.open ? 'text-green-600' : 'text-red-600'}">${item.score}</td><td class="p-2 text-sm">${item.reason}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${userName || 'User'} - 人生K线报告</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-gray-50 p-8"><div class="max-w-6xl mx-auto"><h1 class="text-3xl font-bold text-center mb-8">${userName ? userName + '的' : ''}人生K线命理报告</h1><div class="bg-white p-6 rounded-xl shadow mb-8">${chartSvg}</div><div class="space-y-6">${analysisHtml}</div><table class="w-full mt-8 bg-white rounded-xl shadow"><thead><tr class="bg-gray-100"><th class="p-2">年龄</th><th class="p-2">流年</th><th class="p-2">大运</th><th class="p-2">评分</th><th class="p-2">运势</th></tr></thead><tbody>${tableRows}</tbody></table></div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${userName || 'User'}_Life_Kline.html`;
    a.click();
  };

  const peakYearItem = useMemo(() => result?.chartData?.length ? result.chartData.reduce((prev, cur) => prev.high > cur.high ? prev : cur) : null, [result]);
  const failedAgents = useMemo(() => Object.entries(agentStatuses).filter(([_, s]) => s.status === 'failed').map(([t]) => t as AgentType), [agentStatuses]);
  const hasFailedAgents = failedAgents.length > 0;
  const hasEmptyKLine = result && (!result.chartData || result.chartData.length === 0);
  const agentNames: Record<AgentType, string> = { core: '核心命理', kline: 'K线数据', career: '事业财富', marriage: '婚姻健康', crypto: '币圈分析' };
  const handleRetry = useCallback(() => { if (currentInput) handleFormSubmit(currentInput); }, [currentInput]);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      <SEO title="人生K线 - 洞悉命运起伏，预见人生轨迹" description="结合传统八字命理与金融可视化技术，将您的一生运势绘制成K线图。" url="/" />

      {/* 主布局 - 主内容和右侧面板 */}
      <div className="flex h-full relative">
        {/* 主内容区 - 右面板展开时收起 */}
        <div className={`flex-1 overflow-y-auto bg-gray-50 transition-all duration-300 ease-in-out ${rightPanelOpen ? 'opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto' : 'opacity-100'}`}>
          <div className="max-w-5xl mx-auto px-4 py-8">
            {/* 无结果：显示表单 */}
            {!result && (
              <div className="mobile-compact-home flex flex-col items-center justify-start gap-3 md:gap-6 animate-fade-in">
                <div className="text-center max-w-2xl">
                  <h2 className="text-4xl md:text-5xl font-serif-sc font-bold mb-4 md:mb-6">
                    <span className="classical-hero-title">
                      洞悉命运起伏 预见人生轨迹
                    </span>
                  </h2>
                  <p className="text-gray-500 text-lg leading-relaxed mb-1 md:mb-4">
                    结合<strong>传统八字命理</strong>与<strong>金融可视化技术</strong>，将您的一生运势绘制成类似股票行情的K线图。
                  </p>
                </div>

                {!loading && (isLoggedIn ? (
                  <BaziForm onSubmit={handleFormSubmit} isLoading={loading} isLoggedIn={isLoggedIn} />
                ) : (
                  <LoginRequiredCard onLogin={() => openLoginModal?.()} onRegister={openRegisterModal} />
                ))}
                {loading && <ParallelAnalysisProgress agentStatuses={agentStatuses} progressMessage={progressMessage} fromCache={fromCache} onShowPartialResults={() => setShowPartialResults(true)} />}
                {error && <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-100 max-w-md"><AlertCircle className="w-5 h-5" /><p className="text-sm font-bold">{error}</p></div>}

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <Link to="/knowledge" className="flex items-center gap-1 hover:text-indigo-600"><BookOpen className="w-4 h-4" /> 命理知识</Link>
                  <span>|</span>
                  <Link to="/cases" className="flex items-center gap-1 hover:text-indigo-600"><Users className="w-4 h-4" /> 案例库</Link>
                </div>
              </div>
            )}

            {/* 有结果：显示报告 */}
            {result && (
              <div className="animate-fade-in space-y-6">
                {/* 失败提示 */}
                {(hasFailedAgents || hasEmptyKLine) && !loading && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="font-medium text-amber-800">部分分析未能完成</p>
                        <p className="text-sm text-amber-600">{hasFailedAgents ? `失败: ${failedAgents.map(a => agentNames[a]).join('、')}` : 'K线数据生成失败'}</p>
                      </div>
                    </div>
                    <button onClick={handleRetry} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm"><RefreshCw className="w-4 h-4" /> 重试</button>
                  </div>
                )}

                {showSavePrompt && !loading && <BaziSavePrompt isVisible={showSavePrompt} onSave={() => { setShowSavePrompt(false); setShowSaveDialog(true); }} onDismiss={() => { setShowSavePrompt(false); setSavePromptDismissed(true); }} />}

                {/* 顶部操作栏 */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold font-serif-sc text-gray-800">{userName ? `${userName}的` : ''}命盘分析报告</h2>
                    {fromCache && <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> 一致性结果</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap no-print relative">
                    <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${rightPanelOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                      {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />} 详细分析
                    </button>
                    <SharePanel userName={userName} resultRef={resultRef} captureElementId="share-report-content" shareUrl={shareUrl} onShareSuccess={() => refreshUserInfo()} />
                    <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"><Printer className="w-4 h-4" /> PDF</button>
                    <button onClick={handleSaveHtml} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm"><Download className="w-4 h-4" /> 网页</button>
                    <button onClick={handleNewCalculation} className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm">← 重新排盘</button>
                  </div>
                </div>

                {/* K线图 */}
                <div ref={resultRef} id="share-report-content" className="space-y-6">
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-lg font-bold text-gray-800">流年大运走势图</h3>
                  </div>
                  {peakYearItem && <p className="text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 rounded px-3 py-2 mb-4 inline-flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> 人生巅峰：{peakYearItem.year}年 - {peakYearItem.age}岁，评分 <span className="font-bold text-amber-600">{peakYearItem.high}</span></p>}
                  {hasEmptyKLine ? (
                    <div className="bg-gray-100 rounded-xl p-8 text-center"><AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" /><p className="text-gray-600">K线数据生成失败</p></div>
                  ) : (
                    <Suspense fallback={<LoadingFallback />}><LifeKLineChart data={result.chartData} /></Suspense>
                  )}
                  <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span>运势上涨</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded"></span>运势下跌</span>
                  </div>
                </section>

                {/* 文字K线表格 */}
                {!hasEmptyKLine && result.chartData?.length > 0 && <Suspense fallback={<LoadingFallback />}><KLineTextTable data={result.chartData} /></Suspense>}

                {/* 内联分析报告（右侧面板关闭时显示） */}
                {!rightPanelOpen && <section id="analysis-result-container"><Suspense fallback={<LoadingFallback />}><AnalysisResult analysis={result.analysis} /></Suspense></section>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧面板 - 命盘分析报告 */}
        {result && rightPanelOpen && (
          <div className="fixed inset-0 lg:relative lg:inset-auto lg:w-[520px] bg-gray-50 border-l border-gray-200 z-40 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-gray-800">命盘分析报告</h3>
              </div>
              <button onClick={() => setRightPanelOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4" id="analysis-result-container">
              <Suspense fallback={<LoadingFallback />}><AnalysisResult analysis={result.analysis} /></Suspense>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PartialResultsModal isOpen={showPartialResults} onClose={() => setShowPartialResults(false)} agentStatuses={agentStatuses} result={result} />
      <SaveProfileDialog isOpen={showSaveDialog} onClose={() => setShowSaveDialog(false)} onSave={handleSaveProfile} baziInfo={{ yearPillar: currentInput?.yearPillar || '', monthPillar: currentInput?.monthPillar || '', dayPillar: currentInput?.dayPillar || '', hourPillar: currentInput?.hourPillar || '', birthYear: currentInput?.birthYear || '', gender: currentInput?.gender === Gender.MALE ? 'Male' : 'Female' }} />
    </>
  );
};

export default HomePage;
