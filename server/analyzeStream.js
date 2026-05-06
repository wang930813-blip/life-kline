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
const DEFAULT_API_KEY = process.env.API_KEY || ''; // 需要在 .env 中配置
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gemini-3-pro-preview';

// 备选模型列表 - 用于并发请求和降级
const ALL_MODELS = [
  'gemini-3-pro-preview',
  'grok-4-auto',
  'grok-4-mini-thinking-tahoe',
  'grok-4-1-non-thinking-w-tool',
  'claude-haiku-4-5-20251001',
];

const COST_PER_ANALYSIS = process.env.COST_PER_ANALYSIS ? parseInt(process.env.COST_PER_ANALYSIS, 10) : 50;

/**
 * 发送SSE事件到客户端
 */
const sendSSE = (res, event, data) => {
  if (!res.writableEnded) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};

/**
 * 单次API请求 - 返回Promise
 */
const makeModelRequest = async (model, apiBaseUrl, apiKey, userPrompt, timeoutMs = 120000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[${model}] 开始请求...`);
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
      console.warn(`[${model}] 请求失败 (${elapsed}s): ${response.status} - ${errText.substring(0, 100)}`);
      return { success: false, model, error: `HTTP ${response.status}`, elapsed };
    }

    const responseText = await response.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      console.warn(`[${model}] JSON解析失败 (${elapsed}s): ${responseText.substring(0, 100)}`);
      return { success: false, model, error: 'INVALID_API_RESPONSE', elapsed };
    }

    let content = jsonResult.choices?.[0]?.message?.content;
    if (!content) {
      console.warn(`[${model}] 无内容返回 (${elapsed}s)`);
      return { success: false, model, error: 'EMPTY_RESPONSE', elapsed };
    }

    // 清理内容
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
      console.warn(`[${model}] 内容JSON解析失败 (${elapsed}s): ${content.substring(0, 100)}`);
      return { success: false, model, error: 'INVALID_JSON_FORMAT', elapsed };
    }

    if (!data.chartPoints || !Array.isArray(data.chartPoints)) {
      console.warn(`[${model}] 数据结构错误 (${elapsed}s): 缺少chartPoints`);
      return { success: false, model, error: 'INVALID_DATA_STRUCTURE', elapsed };
    }

    console.log(`[${model}] ✓ 成功 (${elapsed}s)`);
    return { success: true, model, data, elapsed };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[${model}] 请求超时`);
      return { success: false, model, error: 'TIMEOUT' };
    }
    console.warn(`[${model}] 请求异常: ${error.message}`);
    return { success: false, model, error: error.message };
  }
};

/**
 * 并发请求多个模型，返回第一个成功的结果
 */
const raceModels = async (models, apiBaseUrl, apiKey, userPrompt, onProgress) => {
  onProgress(`正在并发请求 ${models.length} 个模型...`);

  // 创建所有请求的Promise
  const promises = models.map(model =>
    makeModelRequest(model, apiBaseUrl, apiKey, userPrompt, 180000)
  );

  // 使用Promise.allSettled等待所有请求完成，但我们会在第一个成功时就返回
  // 同时使用一个自定义的race逻辑
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
          onProgress(`✓ 模型 ${result.model} 响应成功 (${result.elapsed}s)`);
          resolve(result);
        } else if (!result.success) {
          onProgress(`✗ 模型 ${result.model} 失败: ${result.error}`);
        }

        // 如果所有请求都完成了但没有成功的
        if (completedCount === promises.length && !resolved) {
          resolve({ success: false, results });
        }
      });
    });
  });
};

/**
 * 流式分析处理器
 */
export const handleAnalyzeStream = async (req, res) => {
  // 设置SSE响应头
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
        message: '服务器未配置API密钥，请使用自定义API或联系管理员'
      });
      return res.end();
    }
  } else {
    if (!apiBaseUrl || !apiKey || !modelName) {
      sendSSE(res, 'error', {
        error: 'MISSING_CUSTOM_API_CONFIG',
        message: '请完整填写自定义API配置'
      });
      return res.end();
    }
  }

  const inputId = nanoid();
  const startTime = Date.now();

  // 发送初始化进度
  sendSSE(res, 'progress', { message: '正在初始化...' });

  // 启动心跳保活
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 10000); // 每10秒

  const cleanup = () => clearInterval(keepAliveInterval);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  // 进度回调
  const onProgress = (message) => {
    sendSSE(res, 'progress', { message });
  };

  // 预计算生命周期骨架 (Skeleton)
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
    // 自定义API模式 - 只使用用户指定的模型，带重试
    onProgress(`使用自定义模型: ${modelName}`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      onProgress(`尝试第 ${attempt} 次...`);
      const response = await makeModelRequest(modelName, apiBaseUrl, apiKey, userPrompt, 60000);

      if (response.success) {
        result = response.data;
        usedModel = modelName;
        onProgress(`✓ 成功获取结果`);
        break;
      } else {
        onProgress(`✗ 第 ${attempt} 次失败: ${response.error}`);
        if (attempt < 3) {
          onProgress('等待1秒后重试...');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  } else {
    // 免费模式 - 并发请求多个模型
    onProgress('启动多模型并发请求策略...');

    // 第一轮：并发请求主模型和一个备选模型
    const firstRoundModels = [modelName, 'grok-4'];
    let raceResult = await raceModels(firstRoundModels, apiBaseUrl, apiKey, userPrompt, onProgress);

    if (raceResult.success) {
      result = raceResult.data;
      usedModel = raceResult.model;
    } else {
      // 第二轮：尝试其他模型
      onProgress('第一轮失败，启动第二轮备选模型...');
      const secondRoundModels = ['claude-haiku-4-5-20251001', 'grok-4-1-non-thinking-w-tool', 'grok-4-auto', 'gemini-3-pro-preview'];
      raceResult = await raceModels(secondRoundModels, apiBaseUrl, apiKey, userPrompt, onProgress);

      if (raceResult.success) {
        result = raceResult.data;
        usedModel = raceResult.model;
      }
    }

    // 如果还是失败，最后尝试逐个请求
    if (!result) {
      onProgress('并发请求全部失败，尝试逐个请求...');
      for (const model of ALL_MODELS) {
        onProgress(`最后尝试: ${model}...`);
        const response = await makeModelRequest(model, apiBaseUrl, apiKey, userPrompt, 45000);
        if (response.success) {
          result = response.data;
          usedModel = model;
          onProgress(`✓ 终于成功: ${model}`);
          break;
        }
      }
    }
  }

  if (!result) {
    console.error('所有模型均失败');
    sendSSE(res, 'error', {
      error: 'ALL_MODELS_FAILED',
      message: '所有AI模型均无法响应，请稍后重试或使用自定义API'
    });
    return res.end();
  }

  onProgress('正在处理命理数据...');

  const finalResult = {
    chartData: result.chartPoints,
    analysis: {
      bazi: result.bazi || [],
      summary: result.summary || '无摘要',
      summaryScore: result.summaryScore || 5,
      personality: result.personality || '无性格分析',
      personalityScore: result.personalityScore || 5,
      industry: result.industry || '无',
      industryScore: result.industryScore || 5,
      fengShui: result.fengShui || '建议多亲近自然，保持心境平和。',
      fengShuiScore: result.fengShuiScore || 5,
      wealth: result.wealth || '无',
      wealthScore: result.wealthScore || 5,
      marriage: result.marriage || '无',
      marriageScore: result.marriageScore || 5,
      health: result.health || '无',
      healthScore: result.healthScore || 5,
      family: result.family || '无',
      familyScore: result.familyScore || 5,
      crypto: result.crypto || '暂无交易分析',
      cryptoScore: result.cryptoScore || 5,
      cryptoYear: result.cryptoYear || '待定',
      cryptoStyle: result.cryptoStyle || '现货定投',
    },
  };

  let user = null;
  let cost = 0;
  let isGuest = false;

  onProgress('保存分析结果...');

  // 保存数据
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

      logEvent('info', '生成分析', { analysisId, cost, model: usedModel }, info.user.id, req.ip);
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

      logEvent('info', '游客体验', { analysisId, model: usedModel }, null, req.ip);
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

  // 发送完成事件
  sendSSE(res, 'complete', { result: finalResult, user, cost, isGuest, modelUsed: usedModel });
  res.end();
};
