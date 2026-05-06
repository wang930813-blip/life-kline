/**
 * 统一分析流处理器 - 单Agent模式
 * 优势：
 * - API调用次数减少83%（6次→1次）
 * - 成本显著降低
 * - 代码更简单易维护
 * - 保持输出格式兼容（前端无需大改）
 */
import { nanoid } from 'nanoid';
import {
  updateUserPoints,
  saveUserInput,
  saveAnalysis,
  logEvent,
} from './database.js';
import { calculateLifeTimeline } from './baziCalculator.js';
import { runUnifiedAnalyzer, sendSSE } from './unifiedAnalyzer.js';
import {
  computeBaziHash,
  getCachedAnalysis,
  cacheAnalysis,
  extractCoreData,
  mergeCachedWithFresh,
} from './cacheManager.js';

const COST_PER_ANALYSIS = process.env.COST_PER_ANALYSIS ? parseInt(process.env.COST_PER_ANALYSIS, 10) : 50;

/**
 * 统一分析流处理器
 */
export const handleUnifiedAnalyzeStream = async (req, res) => {
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const body = req.body || {};
  const useCustomApi = false;
  const skipCache = Boolean(body.skipCache);

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

  sendSSE(res, 'progress', { message: '正在初始化统一分析系统...', phase: 'init' });

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
      sendSSE(res, 'cache_miss', { message: '缓存未命中，启动统一分析...', baziHash });
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

  // 执行统一分析
  sendSSE(res, 'unified_start', {
    message: '🚀 启动统一分析Agent（单次请求，全维度分析）...',
  });

  const analysisResult = await runUnifiedAnalyzer(input, skeletonData, res, onProgress);

  if (!analysisResult.success) {
    sendSSE(res, 'error', {
      error: 'UNIFIED_ANALYSIS_FAILED',
      message: '统一分析失败，请稍后重试',
      details: analysisResult.error,
    });
    return res.end();
  }

  // 组装最终结果
  sendSSE(res, 'progress', { message: '正在整理分析结果...', phase: 'finalize' });

  const finalResult = {
    chartData: analysisResult.data.chartPoints || [],
    analysis: {
      bazi: analysisResult.data.bazi || [],
      summary: analysisResult.data.summary || '命理分析完成',
      summaryScore: analysisResult.data.summaryScore || 5,
      personality: analysisResult.data.personality || '',
      personalityScore: analysisResult.data.personalityScore || 5,
      industry: analysisResult.data.industry || '',
      industryScore: analysisResult.data.industryScore || 5,
      fengShui: analysisResult.data.fengShui || '',
      fengShuiScore: analysisResult.data.fengShuiScore || 5,
      wealth: analysisResult.data.wealth || '',
      wealthScore: analysisResult.data.wealthScore || 5,
      marriage: analysisResult.data.marriage || '',
      marriageScore: analysisResult.data.marriageScore || 5,
      health: analysisResult.data.health || '',
      healthScore: analysisResult.data.healthScore || 5,
      family: analysisResult.data.family || '',
      familyScore: analysisResult.data.familyScore || 5,
      crypto: analysisResult.data.crypto || '',
      cryptoScore: analysisResult.data.cryptoScore || 5,
      cryptoYear: analysisResult.data.cryptoYear || '待定',
      cryptoStyle: analysisResult.data.cryptoStyle || '现货定投',

      // 扩展字段
      appearance: analysisResult.data.appearance,
      bodyType: analysisResult.data.bodyType,
      skin: analysisResult.data.skin,
      characterSummary: analysisResult.data.characterSummary,
      monthlyFortune: analysisResult.data.monthlyFortune,
      monthlyHighlights: analysisResult.data.monthlyHighlights,
      yearlyFortune: analysisResult.data.yearlyFortune,
      yearlyKeyEvents: analysisResult.data.yearlyKeyEvents,
      luckyColors: analysisResult.data.luckyColors,
      luckyDirections: analysisResult.data.luckyDirections,
      luckyZodiac: analysisResult.data.luckyZodiac,
      luckyNumbers: analysisResult.data.luckyNumbers,
      keyDatesThisMonth: analysisResult.data.keyDatesThisMonth,
      keyDatesThisYear: analysisResult.data.keyDatesThisYear,
      pastEvents: analysisResult.data.pastEvents,
      futureEvents: analysisResult.data.futureEvents,
      keyYears: analysisResult.data.keyYears,
      healthBodyParts: analysisResult.data.healthBodyParts,
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
        modelUsed: analysisResult.model,
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
      modelName: analysisResult.model,
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
        modelUsed: analysisResult.model,
        chartData: finalResult.chartData,
        analysisData: finalResult.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '统一分析完成', {
        analysisId,
        cost,
        model: analysisResult.model,
        elapsed: analysisResult.elapsed,
      }, authedInfo.user.id, req.ip);

      user = { id: authedInfo.user.id, email: authedInfo.user.email, points: newPoints };
    } else {
      isGuest = true;

      saveAnalysis({
        id: analysisId,
        userId: null,
        inputId: inputId,
        cost: 0,
        modelUsed: analysisResult.model,
        chartData: finalResult.chartData,
        analysisData: finalResult.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '游客统一分析', {
        analysisId,
        model: analysisResult.model,
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
    modelUsed: analysisResult.model,
    mode: 'unified',
  });

  res.end();
};

export default handleUnifiedAnalyzeStream;
