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

export const handleUnifiedAnalyzeStream = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const body = req.body || {};
  const skipCache = Boolean(body.skipCache);
  const authedInfo = req.__authedInfo || null;

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

  const onProgress = (message) => {
    sendSSE(res, 'progress', { message, timestamp: Date.now() });
  };

  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 10000);

  const cleanup = () => clearInterval(keepAliveInterval);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  sendSSE(res, 'progress', { message: '正在初始化统一分析系统...', phase: 'init' });

  const baziHash = computeBaziHash(
    input.yearPillar,
    input.monthPillar,
    input.dayPillar,
    input.hourPillar
  );
  const genderKey = input.gender === 'Male' ? 'male' : 'female';

  sendSSE(res, 'progress', { message: `八字哈希: ${baziHash}`, phase: 'hash' });

  if (!skipCache) {
    const cachedData = getCachedAnalysis(baziHash, genderKey);

    if (cachedData) {
      sendSSE(res, 'cache_hit', {
        message: '命中永久缓存，直接返回一致性结果',
        baziHash,
        cachedAt: cachedData.createdAt,
      });

      const cachedResult = mergeCachedWithFresh(cachedData);
      const finalResult = {
        chartData: cachedData.klineData || [],
        analysis: cachedResult,
      };

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

      sendSSE(res, 'complete', {
        result: finalResult,
        user,
        cost,
        isGuest,
        fromCache: true,
        processingTimeMs: Date.now() - startTime,
      });

      return res.end();
    }

    sendSSE(res, 'cache_miss', { message: '缓存未命中，启动统一分析...', baziHash });
  }

  let skeletonData = null;
  try {
    skeletonData = calculateLifeTimeline(input);
    sendSSE(res, 'progress', { message: '已生成 100 年流年骨架', phase: 'skeleton' });
  } catch (err) {
    console.error('骨架计算失败:', err);
    sendSSE(res, 'error', {
      error: 'SKELETON_CALC_FAILED',
      message: '流年骨架计算失败，请检查输入数据',
    });
    return res.end();
  }

  sendSSE(res, 'unified_start', {
    message: '启动统一分析 Agent（单次请求，全维度分析）...',
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
      fengShui: analysisResult.data.fengShui || '发展风水详细内容暂未生成。可先以居住环境整洁、采光通风、动线舒展为基本开运原则。',
      fengShuiScore: analysisResult.data.fengShuiScore || 5,
      wealth: analysisResult.data.wealth || '',
      wealthScore: analysisResult.data.wealthScore || 5,
      marriage: analysisResult.data.marriage || '婚姻情感详细内容暂未生成，建议结合现实沟通模式、责任分配与阶段运势综合判断。',
      marriageScore: analysisResult.data.marriageScore || 5,
      health: analysisResult.data.health || '健康分析详细内容暂未生成。建议保持规律作息，并结合个人体质进行定期体检。',
      healthScore: analysisResult.data.healthScore || 5,
      family: analysisResult.data.family || '六亲关系详细内容暂未生成，建议结合父母、伴侣、子女及合作关系的实际互动继续观察。',
      familyScore: analysisResult.data.familyScore || 5,
      crypto: analysisResult.data.crypto || '币圈交易详细内容暂未生成。投资风险较高，建议控制仓位、重视风控，避免情绪化交易。',
      cryptoScore: analysisResult.data.cryptoScore || 5,
      cryptoYear: analysisResult.data.cryptoYear || '待定',
      cryptoStyle: analysisResult.data.cryptoStyle || '现货定投',
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

  if (!skipCache) {
    try {
      const coreData = extractCoreData(finalResult.analysis, finalResult.chartData);
      cacheAnalysis({
        baziHash,
        gender: genderKey,
        ...coreData,
        modelUsed: analysisResult.model,
        version: 1,
      });
      sendSSE(res, 'progress', { message: '结果已存入永久缓存', phase: 'cache' });
    } catch (cacheErr) {
      console.error('缓存保存失败:', cacheErr);
    }
  }

  let user = null;
  let cost = 0;
  let isGuest = false;

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
      inputId,
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
      inputId,
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

  return res.end();
};

export default handleUnifiedAnalyzeStream;
