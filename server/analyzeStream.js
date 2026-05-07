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

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_API_KEY = process.env.API_KEY || ''; // 闇€瑕佸湪 .env 涓厤缃?
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4';

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
  onProgress(`姝ｅ湪骞跺彂璇锋眰 ${models.length} 涓ā鍨?..`);

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
          onProgress(`鉁?妯″瀷 ${result.model} 鍝嶅簲鎴愬姛 (${result.elapsed}s)`);
          resolve(result);
        } else if (!result.success) {
          onProgress(`鉁?妯″瀷 ${result.model} 澶辫触: ${result.error}`);
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
        message: '鏈嶅姟鍣ㄦ湭閰嶇疆API瀵嗛挜锛岃浣跨敤鑷畾涔堿PI鎴栬仈绯荤鐞嗗憳'
      });
      return res.end();
    }
  } else {
    if (!apiBaseUrl || !apiKey || !modelName) {
      sendSSE(res, 'error', {
        error: 'MISSING_CUSTOM_API_CONFIG',
        message: '璇峰畬鏁村～鍐欒嚜瀹氫箟API閰嶇疆'
      });
      return res.end();
    }
  }

  const inputId = nanoid();
  const startTime = Date.now();

  // 鍙戦€佸垵濮嬪寲杩涘害
  sendSSE(res, 'progress', { message: '姝ｅ湪鍒濆鍖?..' });

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
    onProgress('宸茬敓鎴?100 骞存祦骞撮鏋?..');
  } catch (err) {
    console.error('楠ㄦ灦璁＄畻澶辫触:', err);
    sendSSE(res, 'error', {
      error: 'SKELETON_CALC_FAILED',
      message: '娴佸勾楠ㄦ灦璁＄畻澶辫触锛岃妫€鏌ヨ緭鍏ユ暟鎹?
    });
    return res.end();
  }

  const userPrompt = String(body.userPrompt || '').trim() || buildUserPrompt({ ...input, gender: input.gender }, skeletonData);

  let result = null;
  let usedModel = null;

  if (useCustomApi) {
    // 鑷畾涔堿PI妯″紡 - 鍙娇鐢ㄧ敤鎴锋寚瀹氱殑妯″瀷锛屽甫閲嶈瘯
    onProgress(`浣跨敤鑷畾涔夋ā鍨? ${modelName}`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      onProgress(`灏濊瘯绗?${attempt} 娆?..`);
      const response = await makeModelRequest(modelName, apiBaseUrl, apiKey, userPrompt, 60000);

      if (response.success) {
        result = response.data;
        usedModel = modelName;
        onProgress(`鉁?鎴愬姛鑾峰彇缁撴灉`);
        break;
      } else {
        onProgress(`鉁?绗?${attempt} 娆″け璐? ${response.error}`);
        if (attempt < 3) {
          onProgress('绛夊緟1绉掑悗閲嶈瘯...');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  } else {
    // 鍏嶈垂妯″紡 - 骞跺彂璇锋眰澶氫釜妯″瀷
    onProgress('鍚姩澶氭ā鍨嬪苟鍙戣姹傜瓥鐣?..');

    // 绗竴杞細骞跺彂璇锋眰涓绘ā鍨嬪拰涓€涓閫夋ā鍨?
    const firstRoundModels = [modelName];
    let raceResult = await raceModels(firstRoundModels, apiBaseUrl, apiKey, userPrompt, onProgress);

    if (raceResult.success) {
      result = raceResult.data;
      usedModel = raceResult.model;
    } else {
      // 绗簩杞細灏濊瘯鍏朵粬妯″瀷
      onProgress('绗竴杞け璐ワ紝鍚姩绗簩杞閫夋ā鍨?..');
      const secondRoundModels = [modelName];
      raceResult = await raceModels(secondRoundModels, apiBaseUrl, apiKey, userPrompt, onProgress);

      if (raceResult.success) {
        result = raceResult.data;
        usedModel = raceResult.model;
      }
    }

    // 濡傛灉杩樻槸澶辫触锛屾渶鍚庡皾璇曢€愪釜璇锋眰
    if (!result) {
      onProgress('骞跺彂璇锋眰鍏ㄩ儴澶辫触锛屽皾璇曢€愪釜璇锋眰...');
      for (const model of ALL_MODELS) {
        onProgress(`鏈€鍚庡皾璇? ${model}...`);
        const response = await makeModelRequest(model, apiBaseUrl, apiKey, userPrompt, 45000);
        if (response.success) {
          result = response.data;
          usedModel = model;
          onProgress(`鉁?缁堜簬鎴愬姛: ${model}`);
          break;
        }
      }
    }
  }

  if (!result) {
    console.error('鎵€鏈夋ā鍨嬪潎澶辫触');
    sendSSE(res, 'error', {
      error: 'ALL_MODELS_FAILED',
      message: '鎵€鏈堿I妯″瀷鍧囨棤娉曞搷搴旓紝璇风◢鍚庨噸璇曟垨浣跨敤鑷畾涔堿PI'
    });
    return res.end();
  }

  onProgress('姝ｅ湪澶勭悊鍛界悊鏁版嵁...');

  const finalResult = {
    chartData: result.chartPoints,
    analysis: {
      bazi: result.bazi || [],
      summary: result.summary || '鏃犳憳瑕?,
      summaryScore: result.summaryScore || 5,
      personality: result.personality || '鏃犳€ф牸鍒嗘瀽',
      personalityScore: result.personalityScore || 5,
      industry: result.industry || '鏃?,
      industryScore: result.industryScore || 5,
      fengShui: result.fengShui || '寤鸿澶氫翰杩戣嚜鐒讹紝淇濇寔蹇冨骞冲拰銆?,
      fengShuiScore: result.fengShuiScore || 5,
      wealth: result.wealth || '鏃?,
      wealthScore: result.wealthScore || 5,
      marriage: result.marriage || '鏃?,
      marriageScore: result.marriageScore || 5,
      health: result.health || '鏃?,
      healthScore: result.healthScore || 5,
      family: result.family || '鏃?,
      familyScore: result.familyScore || 5,
      crypto: result.crypto || '鏆傛棤浜ゆ槗鍒嗘瀽',
      cryptoScore: result.cryptoScore || 5,
      cryptoYear: result.cryptoYear || '寰呭畾',
      cryptoStyle: result.cryptoStyle || '鐜拌揣瀹氭姇',
    },
  };

  let user = null;
  let cost = 0;
  let isGuest = false;

  onProgress('淇濆瓨鍒嗘瀽缁撴灉...');

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

