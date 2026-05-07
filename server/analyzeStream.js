import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import {
  updateUserPoints,
  saveUserInput,
  saveAnalysis,
  logEvent,
} from './database.js';
import { BAZI_SYSTEM_INSTRUCTION, buildUserPrompt } from './prompt.js';
import { calculateLifeTimeline } from './baziCalculator.js';
import { normalizeApiBaseUrl, normalizeModelName } from './llmConfig.js';

const DEFAULT_API_BASE_URL = normalizeApiBaseUrl();
const DEFAULT_API_KEY = process.env.API_KEY || ''; // 闇€瑕佸湪 .env 涓厤缃?
const DEFAULT_MODEL = normalizeModelName();

// 澶囬€夋ā鍨嬪垪琛?- 鐢ㄤ簬骞跺彂璇锋眰鍜岄檷绾?
const ALL_MODELS = [DEFAULT_MODEL];

const COST_PER_ANALYSIS = process.env.COST_PER_ANALYSIS ? parseInt(process.env.COST_PER_ANALYSIS, 10) : 50;

/**
 * 鍙戦€丼SE浜嬩欢鍒板鎴风
 */
const sendSSE = (res, event, data) => {
  if (!res.writableEnded) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};

/**
 * 鍗曟API璇锋眰 - 杩斿洖Promise
 */
const makeModelRequest = async (model, apiBaseUrl, apiKey, userPrompt, timeoutMs = 120000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[${model}] 寮€濮嬭姹?..`);
    const startTime = Date.now();

    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: BAZI_SYSTEM_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[${model}] 璇锋眰澶辫触 (${elapsed}s): ${response.status} - ${errText.substring(0, 100)}`);
      return { success: false, model, error: `HTTP ${response.status}`, elapsed };
    }

    const responseText = await response.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      console.warn(`[${model}] JSON瑙ｆ瀽澶辫触 (${elapsed}s): ${responseText.substring(0, 100)}`);
      return { success: false, model, error: 'INVALID_API_RESPONSE', elapsed };
    }

    let content = jsonResult.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[${model}] 鏃犲唴瀹硅繑鍥?(${elapsed}s)`);
      return { success: false, model, error: 'EMPTY_RESPONSE', elapsed };
    }

    // 娓呯悊鍐呭
    content = content.trim();
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    content = content.replace(/^[\s\S]*?(?=\{)/m, '');
    if (content.startsWith('```json')) content = content.slice(7);
    else if (content.startsWith('```')) content = content.slice(3);
    if (content.endsWith('```')) content = content.slice(0, -3);
    content = content.trim();

    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      content = content.slice(jsonStart, jsonEnd + 1);
    }

    let data;
    try {
      data = JSON.parse(content);
    } catch (parseErr) {
      console.warn(`[${model}] 鍐呭JSON瑙ｆ瀽澶辫触 (${elapsed}s): ${content.substring(0, 100)}`);
      return { success: false, model, error: 'INVALID_JSON_FORMAT', elapsed };
    }

    if (!data.chartPoints || !Array.isArray(data.chartPoints)) {
      console.warn(`[${model}] 鏁版嵁缁撴瀯閿欒 (${elapsed}s): 缂哄皯chartPoints`);
      return { success: false, model, error: 'INVALID_DATA_STRUCTURE', elapsed };
    }

    console.log(`[${model}] 鉁?鎴愬姛 (${elapsed}s)`);
    return { success: true, model, data, elapsed };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[${model}] 璇锋眰瓒呮椂`);
      return { success: false, model, error: 'TIMEOUT' };
    }
    console.warn(`[${model}] 璇锋眰寮傚父: ${error.message}`);
    return { success: false, model, error: error.message };
  }
};

/**
 * 骞跺彂璇锋眰澶氫釜妯″瀷锛岃繑鍥炵涓€涓垚鍔熺殑缁撴灉
 */
const raceModels = async (models, apiBaseUrl, apiKey, userPrompt, onProgress) => {
  onProgress(`正在并发请求 ${models.length} 个模型...`);

  // 鍒涘缓鎵€鏈夎姹傜殑Promise
  const promises = models.map(model =>
    makeModelRequest(model, apiBaseUrl, apiKey, userPrompt, 180000)
  );

  // 浣跨敤Promise.allSettled绛夊緟鎵€鏈夎姹傚畬鎴愶紝浣嗘垜浠細鍦ㄧ涓€涓垚鍔熸椂灏辫繑鍥?
  // 鍚屾椂浣跨敤涓€涓嚜瀹氫箟鐨剅ace閫昏緫
  return new Promise((resolve) => {
    let resolved = false;
    const results = [];
    let completedCount = 0;

    promises.forEach((promise, index) => {
      promise.then(result => {
        completedCount++;
        results.push(result);

        if (result.success && !resolved) {
          resolved = true;
          onProgress(`模型 ${result.model} 响应成功 (${result.elapsed}s)`);
          resolve(result);
        } else if (!result.success) {
          onProgress(`模型 ${result.model} 失败: ${result.error}`);
        }

        // 濡傛灉鎵€鏈夎姹傞兘瀹屾垚浜嗕絾娌℃湁鎴愬姛鐨?
        if (completedCount === promises.length && !resolved) {
          resolve({ success: false, results });
        }
      });
    });
  });
};

/**
 * 娴佸紡鍒嗘瀽澶勭悊鍣?
 */
export const handleAnalyzeStream = async (req, res) => {
  // 璁剧疆SSE鍝嶅簲澶?
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const body = req.body || {};
  const useCustomApi = false;

  let authedInfo = req.__authedInfo || null;

  let apiBaseUrl = String(body.apiBaseUrl || '').trim().replace(/\/+$/, '');
  let apiKey = String(body.apiKey || '').trim();
  let modelName = String(body.modelName || '').trim();

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

  if (!useCustomApi) {
    apiBaseUrl = DEFAULT_API_BASE_URL;
    apiKey = DEFAULT_API_KEY;
    modelName = DEFAULT_MODEL;

    if (!DEFAULT_API_KEY || DEFAULT_API_KEY === 'sk-example-key') {
      sendSSE(res, 'error', {
        error: 'SERVER_DEFAULT_KEY_NOT_SET',
        message: '服务器未配置 API 密钥，请联系管理员'
      });
      return res.end();
    }
  } else {
    if (!apiBaseUrl || !apiKey || !modelName) {
      sendSSE(res, 'error', {
        error: 'MISSING_CUSTOM_API_CONFIG',
        message: '请完整填写自定义 API 配置'
      });
      return res.end();
    }
  }

  const inputId = nanoid();
  const startTime = Date.now();

  // 鍙戦€佸垵濮嬪寲杩涘害
  sendSSE(res, 'progress', { message: '正在初始化...' });

  // 鍚姩蹇冭烦淇濇椿
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 10000); // 姣?0绉?

  const cleanup = () => clearInterval(keepAliveInterval);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  // 杩涘害鍥炶皟
  const onProgress = (message) => {
    sendSSE(res, 'progress', { message });
  };

  // 棰勮绠楃敓鍛藉懆鏈熼鏋?(Skeleton)
  let skeletonData = null;
  try {
    skeletonData = calculateLifeTimeline(input);
    onProgress('已生成 100 年流年骨架...');
  } catch (err) {
    console.error('骨架计算失败:', err);
    sendSSE(res, 'error', {
      error: 'SKELETON_CALC_FAILED',
      message: '流年骨架计算失败，请检查输入数据'
    });
    return res.end();
  }

  const userPrompt = String(body.userPrompt || '').trim() || buildUserPrompt({ ...input, gender: input.gender }, skeletonData);

  let result = null;
  let usedModel = null;

  if (useCustomApi) {
    // 鑷畾涔堿PI妯″紡 - 鍙娇鐢ㄧ敤鎴锋寚瀹氱殑妯″瀷锛屽甫閲嶈瘯
    onProgress(`使用自定义模型 ${modelName}`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      onProgress(`尝试第 ${attempt} 次...`);
      const response = await makeModelRequest(modelName, apiBaseUrl, apiKey, userPrompt, 60000);

      if (response.success) {
        result = response.data;
        usedModel = modelName;
        onProgress('成功获取结果');
        break;
      } else {
        onProgress(`第 ${attempt} 次失败: ${response.error}`);
        if (attempt < 3) {
          onProgress('等待 1 秒后重试...');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  } else {
    // 鍏嶈垂妯″紡 - 骞跺彂璇锋眰澶氫釜妯″瀷
    onProgress('启动模型请求...');

    // 绗竴杞細骞跺彂璇锋眰涓绘ā鍨嬪拰涓€涓閫夋ā鍨?
    const firstRoundModels = [modelName];
    let raceResult = await raceModels(firstRoundModels, apiBaseUrl, apiKey, userPrompt, onProgress);

    if (raceResult.success) {
      result = raceResult.data;
      usedModel = raceResult.model;
    } else {
      // 绗簩杞細灏濊瘯鍏朵粬妯″瀷
      onProgress('第一轮失败，开始重试...');
      const secondRoundModels = [modelName];
      raceResult = await raceModels(secondRoundModels, apiBaseUrl, apiKey, userPrompt, onProgress);

      if (raceResult.success) {
        result = raceResult.data;
        usedModel = raceResult.model;
      }
    }

    // 濡傛灉杩樻槸澶辫触锛屾渶鍚庡皾璇曢€愪釜璇锋眰
    if (!result) {
      onProgress('并发请求全部失败，尝试逐个请求...');
      for (const model of ALL_MODELS) {
        onProgress(`最后尝试 ${model}...`);
        const response = await makeModelRequest(model, apiBaseUrl, apiKey, userPrompt, 45000);
        if (response.success) {
          result = response.data;
          usedModel = model;
          onProgress(`请求成功: ${model}`);
          break;
        }
      }
    }
  }

  if (!result) {
    console.error('所有模型均失败');
    sendSSE(res, 'error', {
      error: 'ALL_MODELS_FAILED',
      message: 'AI 模型暂时无法响应，请稍后重试'
    });
    return res.end();
  }

  onProgress('正在处理命理数据...');

  const finalResult = {
    chartData: result.chartPoints,
    analysis: {
      bazi: result.bazi || [],
      summary: result.summary || '暂无摘要',
      summaryScore: result.summaryScore || 5,
      personality: result.personality || '暂无性格分析',
      personalityScore: result.personalityScore || 5,
      industry: result.industry || '暂无行业分析',
      industryScore: result.industryScore || 5,
      fengShui: result.fengShui || '发展风水详细内容暂未生成。可先以居住环境整洁、采光通风、动线舒展为基本开运原则。',
      fengShuiScore: result.fengShuiScore || 5,
      wealth: result.wealth || '暂无财富分析',
      wealthScore: result.wealthScore || 5,
      marriage: result.marriage || '婚姻情感详细内容暂未生成，建议结合现实沟通模式、责任分配与阶段运势综合判断。',
      marriageScore: result.marriageScore || 5,
      health: result.health || '健康分析详细内容暂未生成。建议保持规律作息，并结合个人体质进行定期体检。',
      healthScore: result.healthScore || 5,
      family: result.family || '六亲关系详细内容暂未生成，建议结合父母、伴侣、子女及合作关系的实际互动继续观察。',
      familyScore: result.familyScore || 5,
      crypto: result.crypto || '币圈交易详细内容暂未生成。投资风险较高，建议控制仓位、重视风控，避免情绪化交易。',
      cryptoScore: result.cryptoScore || 5,
      cryptoYear: result.cryptoYear || '待定',
      cryptoStyle: result.cryptoStyle || '现货定投',
    },
  };

  let user = null;
  let cost = 0;
  let isGuest = false;

  onProgress('保存分析结果...');

  // 淇濆瓨鏁版嵁
  if (!useCustomApi) {
    const info = authedInfo;

    saveUserInput({
      id: inputId,
      userId: info ? info.user.id : null,
      name: input.name,
      gender: input.gender,
      birthYear: input.birthYear,
      yearPillar: input.yearPillar,
      monthPillar: input.monthPillar,
      dayPillar: input.dayPillar,
      hourPillar: input.hourPillar,
      startAge: input.startAge,
      firstDaYun: input.firstDaYun,
      modelName: usedModel,
      apiBaseUrl: apiBaseUrl,
      useCustomApi: false,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const analysisId = nanoid();

    if (info) {
      const newPoints = Math.max(0, info.user.points - COST_PER_ANALYSIS);
      updateUserPoints(info.user.id, newPoints);
      cost = COST_PER_ANALYSIS;

      saveAnalysis({
        id: analysisId,
        userId: info.user.id,
        inputId: inputId,
        cost,
        modelUsed: usedModel,
        chartData: finalResult.chartData,
        analysisData: finalResult.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '鐢熸垚鍒嗘瀽', { analysisId, cost, model: usedModel }, info.user.id, req.ip);
      user = { id: info.user.id, email: info.user.email, points: newPoints };
    } else {
      isGuest = true;

      saveAnalysis({
        id: analysisId,
        userId: null,
        inputId: inputId,
        cost: 0,
        modelUsed: usedModel,
        chartData: finalResult.chartData,
        analysisData: finalResult.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '娓稿浣撻獙', { analysisId, model: usedModel }, null, req.ip);
    }
  } else {
    saveUserInput({
      id: inputId,
      userId: null,
      name: input.name,
      gender: input.gender,
      birthYear: input.birthYear,
      yearPillar: input.yearPillar,
      monthPillar: input.monthPillar,
      dayPillar: input.dayPillar,
      hourPillar: input.hourPillar,
      startAge: input.startAge,
      firstDaYun: input.firstDaYun,
      modelName: modelName,
      apiBaseUrl: apiBaseUrl,
      useCustomApi: true,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // 鍙戦€佸畬鎴愪簨浠?
  sendSSE(res, 'complete', { result: finalResult, user, cost, isGuest, modelUsed: usedModel });
  res.end();
};

