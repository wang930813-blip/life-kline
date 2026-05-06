/**
 * 并行分析流处理器
 * 支持6个Agent并行执行，渐进式SSE推送
 * K线分为过去(出生到今年)和未来(今年到100岁)两个并行请求
 * 支持缓存命中时直接返回
 */
import { nanoid } from 'nanoid';
import {
  updateUserPoints,
  saveUserInput,
  saveAnalysis,
  logEvent,
} from './database.js';
import { calculateLifeTimeline } from './baziCalculator.js';
import { runParallelAgents, mergeAgentResults, sendSSE } from './parallelAnalyzer.js';
import {
  computeBaziHash,
  getCachedAnalysis,
  cacheAnalysis,
  extractCoreData,
  mergeCachedWithFresh,
  hasCachedAnalysis,
} from './cacheManager.js';

const COST_PER_ANALYSIS = process.env.COST_PER_ANALYSIS ? parseInt(process.env.COST_PER_ANALYSIS, 10) : 50;

/**
 * 并行分析流处理器
 */
export const handleParallelAnalyzeStream = async (req, res) => {
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const body = req.body || {};
  const useCustomApi = false;
  const skipCache = Boolean(body.skipCache); // 是否跳过缓存

  let authedInfo = req.__authedInfo || null;

  const input = {
    name: body.name || '',
    birthPlace: body.birthPlace || '',
    gender: body.gender,
    birthYear: body.birthYear,
    yearPillar: body.yearPillar,
    monthPillar: body.monthPillar,
    dayPillar: body.dayPillar,
    hourPillar: body.hourPillar,
    startAge: body.startAge,
    firstDaYun: body.firstDaYun,
  };

  const inputId = nanoid();
  const startTime = Date.now();

  // 进度回调
  const onProgress = (message) => {
    sendSSE(res, 'progress', { message, timestamp: Date.now() });
  };

  // 启动心跳保活
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 10000);

  const cleanup = () => clearInterval(keepAliveInterval);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  sendSSE(res, 'progress', { message: '正在初始化并行分析系统...', phase: 'init' });

  // 计算八字哈希
  const baziHash = computeBaziHash(
    input.yearPillar,
    input.monthPillar,
    input.dayPillar,
    input.hourPillar
  );
  const genderKey = input.gender === 'Male' ? 'male' : 'female';

  sendSSE(res, 'progress', { message: `八字哈希: ${baziHash}`, phase: 'hash' });

  // 检查缓存
  if (!skipCache && !useCustomApi) {
    const cachedData = getCachedAnalysis(baziHash, genderKey);

    if (cachedData) {
      sendSSE(res, 'cache_hit', {
        message: '✓ 命中永久缓存，直接返回一致性结果',
        baziHash,
        cachedAt: cachedData.createdAt,
      });

      // 从缓存构建结果
      const cachedResult = mergeCachedWithFresh(cachedData);

      const finalResult = {
        chartData: cachedData.klineData || [],
        analysis: cachedResult,
      };

      // 处理用户积分（缓存命中也扣分）
      let user = null;
      let cost = 0;
      let isGuest = false;

      if (authedInfo) {
        const newPoints = Math.max(0, authedInfo.user.points - COST_PER_ANALYSIS);
        updateUserPoints(authedInfo.user.id, newPoints);
        cost = COST_PER_ANALYSIS;
        user = { id: authedInfo.user.id, email: authedInfo.user.email, points: newPoints };

        logEvent('info', '缓存命中分析', { baziHash, cost }, authedInfo.user.id, req.ip);
      } else {
        isGuest = true;
        logEvent('info', '游客缓存命中', { baziHash }, null, req.ip);
      }

      // 发送完成事件
      sendSSE(res, 'complete', {
        result: finalResult,
        user,
        cost,
        isGuest,
        fromCache: true,
        processingTimeMs: Date.now() - startTime,
      });

      return res.end();
    } else {
      sendSSE(res, 'cache_miss', { message: '缓存未命中，启动并行分析...', baziHash });
    }
  }

  // 预计算生命周期骨架
  let skeletonData = null;
  try {
    skeletonData = calculateLifeTimeline(input);
    sendSSE(res, 'progress', { message: '✓ 已生成100年流年骨架', phase: 'skeleton' });
  } catch (err) {
    console.error('骨架计算失败:', err);
    sendSSE(res, 'error', {
      error: 'SKELETON_CALC_FAILED',
      message: '流年骨架计算失败，请检查输入数据'
    });
    return res.end();
  }

  // 执行并行Agent分析
  sendSSE(res, 'parallel_start', {
    message: '🚀 启动6个专业Agent并行分析...',
    agents: ['core', 'kline_past', 'kline_future', 'career', 'marriage', 'crypto'],
  });

  const parallelResult = await runParallelAgents(input, skeletonData, res, onProgress);

  if (!parallelResult.success) {
    sendSSE(res, 'error', {
      error: 'ALL_AGENTS_FAILED',
      message: '所有Agent分析均失败，请稍后重试'
    });
    return res.end();
  }

  // 合并Agent结果
  sendSSE(res, 'progress', { message: '正在合并分析结果...', phase: 'merge' });
  const mergedAnalysis = mergeAgentResults(parallelResult.results, skeletonData);

  const finalResult = {
    chartData: mergedAnalysis.chartPoints || [],
    analysis: {
      bazi: mergedAnalysis.bazi || [],
      summary: mergedAnalysis.summary || '命理分析完成',
      summaryScore: mergedAnalysis.summaryScore || 5,
      personality: mergedAnalysis.personality || '',
      personalityScore: mergedAnalysis.personalityScore || 5,
      industry: mergedAnalysis.industry || '',
      industryScore: mergedAnalysis.industryScore || 5,
      fengShui: mergedAnalysis.fengShui || '',
      fengShuiScore: mergedAnalysis.fengShuiScore || 5,
      wealth: mergedAnalysis.wealth || '',
      wealthScore: mergedAnalysis.wealthScore || 5,
      marriage: mergedAnalysis.marriage || '',
      marriageScore: mergedAnalysis.marriageScore || 5,
      health: mergedAnalysis.health || '',
      healthScore: mergedAnalysis.healthScore || 5,
      family: mergedAnalysis.family || '',
      familyScore: mergedAnalysis.familyScore || 5,
      crypto: mergedAnalysis.crypto || '',
      cryptoScore: mergedAnalysis.cryptoScore || 5,
      cryptoYear: mergedAnalysis.cryptoYear || '待定',
      cryptoStyle: mergedAnalysis.cryptoStyle || '现货定投',

      // 扩展字段
      appearance: mergedAnalysis.appearance,
      bodyType: mergedAnalysis.bodyType,
      skin: mergedAnalysis.skin,
      characterSummary: mergedAnalysis.characterSummary,
      monthlyFortune: mergedAnalysis.monthlyFortune,
      monthlyHighlights: mergedAnalysis.monthlyHighlights,
      yearlyFortune: mergedAnalysis.yearlyFortune,
      yearlyKeyEvents: mergedAnalysis.yearlyKeyEvents,
      luckyColors: mergedAnalysis.luckyColors,
      luckyDirections: mergedAnalysis.luckyDirections,
      luckyZodiac: mergedAnalysis.luckyZodiac,
      luckyNumbers: mergedAnalysis.luckyNumbers,
      keyDatesThisMonth: mergedAnalysis.keyDatesThisMonth,
      keyDatesThisYear: mergedAnalysis.keyDatesThisYear,
      pastEvents: mergedAnalysis.pastEvents,
      futureEvents: mergedAnalysis.futureEvents,
      keyYears: mergedAnalysis.keyYears,
      peakYears: mergedAnalysis.peakYears,
      troughYears: mergedAnalysis.troughYears,
      healthBodyParts: mergedAnalysis.healthBodyParts,
    },
  };

  // 保存到缓存（永久缓存）
  if (!useCustomApi && !skipCache) {
    try {
      const coreData = extractCoreData(finalResult.analysis, finalResult.chartData);
      cacheAnalysis({
        baziHash,
        gender: genderKey,
        ...coreData,
        modelUsed: 'parallel-agents',
        version: 1,
      });
      sendSSE(res, 'progress', { message: '✓ 结果已存入永久缓存', phase: 'cache' });
    } catch (cacheErr) {
      console.error('缓存保存失败:', cacheErr);
      // 缓存失败不影响主流程
    }
  }

  // 处理用户数据
  let user = null;
  let cost = 0;
  let isGuest = false;

  if (!useCustomApi) {
    // 保存用户输入
    saveUserInput({
      id: inputId,
      userId: authedInfo ? authedInfo.user.id : null,
      name: input.name,
      gender: input.gender,
      birthYear: input.birthYear,
      yearPillar: input.yearPillar,
      monthPillar: input.monthPillar,
      dayPillar: input.dayPillar,
      hourPillar: input.hourPillar,
      startAge: input.startAge,
      firstDaYun: input.firstDaYun,
      modelName: 'parallel-agents',
      apiBaseUrl: '',
      useCustomApi: false,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const analysisId = nanoid();

    if (authedInfo) {
      const newPoints = Math.max(0, authedInfo.user.points - COST_PER_ANALYSIS);
      updateUserPoints(authedInfo.user.id, newPoints);
      cost = COST_PER_ANALYSIS;

      saveAnalysis({
        id: analysisId,
        userId: authedInfo.user.id,
        inputId: inputId,
        cost,
        modelUsed: 'parallel-agents',
        chartData: finalResult.chartData,
        analysisData: finalResult.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '并行分析完成', {
        analysisId,
        cost,
        agents: parallelResult.completedAgents,
        successCount: parallelResult.successCount,
      }, authedInfo.user.id, req.ip);

      user = { id: authedInfo.user.id, email: authedInfo.user.email, points: newPoints };
    } else {
      isGuest = true;

      saveAnalysis({
        id: analysisId,
        userId: null,
        inputId: inputId,
        cost: 0,
        modelUsed: 'parallel-agents',
        chartData: finalResult.chartData,
        analysisData: finalResult.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '游客并行分析', {
        analysisId,
        agents: parallelResult.completedAgents,
      }, null, req.ip);
    }
  }

  // 发送完成事件
  sendSSE(res, 'complete', {
    result: finalResult,
    user,
    cost,
    isGuest,
    fromCache: false,
    processingTimeMs: Date.now() - startTime,
    agentsUsed: parallelResult.completedAgents,
    successCount: parallelResult.successCount,
    totalAgents: parallelResult.totalAgents,
  });

  res.end();
};

export default handleParallelAnalyzeStream;
