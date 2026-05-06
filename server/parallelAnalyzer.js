/**
 * 并行分析器 - 6个Agent同时工作
 * 实现渐进式SSE推送，用户感知到的等待时间 = 最快Agent的返回时间
 * K线分为过去(出生到今年)和未来(今年到100岁)两个并行请求，提升生成速度
 */
import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import {
  AGENT_PROMPTS,
  AGENT_CORE_PROMPT,
  AGENT_KLINE_PAST_PROMPT,
  AGENT_KLINE_FUTURE_PROMPT,
  AGENT_CAREER_PROMPT,
  AGENT_MARRIAGE_PROMPT,
  AGENT_CRYPTO_PROMPT,
} from './agentPrompts.js';
import { generateFallbackKLine } from './baziCalculator.js';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_API_KEY = process.env.API_KEY || ''; // 需要在 .env 中配置
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4';

// 优先使用 .env 中的 DEFAULT_MODEL，只有失败时才回退
const AGENT_MODEL_ASSIGNMENT = {
  core: DEFAULT_MODEL,
  kline_past: DEFAULT_MODEL,
  kline_future: DEFAULT_MODEL,
  career: DEFAULT_MODEL,
  marriage: DEFAULT_MODEL,
  crypto: DEFAULT_MODEL,
};

// 备用模型列表
const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  'grok-4-auto',
  'grok-4',
  'gemini-3-pro-preview',
  'claude-haiku-4-5-20251001',
];

/**
 * 发送SSE事件
 */
export const sendSSE = (res, event, data) => {
  if (!res.writableEnded) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};

/**
 * 单个Agent请求
 */
const makeAgentRequest = async (agentType, model, apiBaseUrl, apiKey, systemPrompt, userPrompt, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[Agent:${agentType}] 使用模型 ${model} 开始请求...`);
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.6, // 稍低的温度以保持一致性
      }),
    });

    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Agent:${agentType}] 请求失败 (${elapsed}s): ${response.status}`);
      return { success: false, agentType, error: `HTTP ${response.status}`, elapsed };
    }

    const responseText = await response.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      console.warn(`[Agent:${agentType}] JSON解析失败 (${elapsed}s)`);
      return { success: false, agentType, error: 'INVALID_API_RESPONSE', elapsed };
    }

    let content = jsonResult.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, agentType, error: 'EMPTY_RESPONSE', elapsed };
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
      console.warn(`[Agent:${agentType}] 内容JSON解析失败 (${elapsed}s): ${content.substring(0, 100)}`);
      return { success: false, agentType, error: 'INVALID_JSON_FORMAT', elapsed };
    }

    console.log(`[Agent:${agentType}] ✓ 成功 (${elapsed}s)`);
    return { success: true, agentType, data, elapsed, model };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[Agent:${agentType}] 请求超时`);
      return { success: false, agentType, error: 'TIMEOUT' };
    }
    console.warn(`[Agent:${agentType}] 请求异常: ${error.message}`);
    return { success: false, agentType, error: error.message };
  }
};

/**
 * 验证Agent返回数据是否完整
 */
const validateAgentResponse = (agentType, data) => {
  if (!data || typeof data !== 'object') return false;

  const requiredFields = {
    core: ['summary', 'personality'],
    career: ['industry', 'wealth'],
    marriage: ['marriage', 'health'],
    crypto: ['crypto'],
    kline_past: ['chartPoints'],
    kline_future: ['chartPoints'],
  };

  const fields = requiredFields[agentType] || [];
  for (const field of fields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim().length < 10)) {
      console.warn(`[Agent:${agentType}] 字段 ${field} 缺失或内容太短`);
      return false;
    }
  }
  return true;
};

/**
 * 带重试的Agent请求
 */
const makeAgentRequestWithRetry = async (agentType, apiBaseUrl, apiKey, systemPrompt, userPrompt, maxRetries = 2) => {
  const primaryModel = AGENT_MODEL_ASSIGNMENT[agentType] || DEFAULT_MODEL;
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await makeAgentRequest(agentType, model, apiBaseUrl, apiKey, systemPrompt, userPrompt);

      if (result.success) {
        // 验证返回数据是否完整
        if (validateAgentResponse(agentType, result.data)) {
          return result;
        }
        console.warn(`[Agent:${agentType}] 模型 ${model} 返回数据不完整，尝试重新请求...`);
      }

      // 如果是最后一次尝试这个模型，切换到下一个模型
      if (attempt === maxRetries) {
        console.warn(`[Agent:${agentType}] 模型 ${model} 失败，尝试备用模型...`);
      } else {
        // 等待后重试
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  return { success: false, agentType, error: 'ALL_ATTEMPTS_FAILED' };
};

/**
 * 构建Agent用户提示词
 */
const buildAgentUserPrompt = (input, skeletonData, agentType) => {
  const genderStr = input.gender === 'Male' ? '男 (乾造)' : '女 (坤造)';

  // 精简的时间线数据
  const timelineStr = JSON.stringify(skeletonData.timeline.slice(0, 30).map(t => ({
    a: t.age,
    y: t.year,
    gz: t.ganZhi,
    dy: t.daYun
  })));

  const baseInfo = `
【命主信息】
性别：${genderStr}
姓名：${input.name || '未提供'}
出生年份：${input.birthYear}年
出生地点：${input.birthPlace || '未提供'}

【八字四柱】
年柱：${skeletonData.bazi[0]}
月柱：${skeletonData.bazi[1]}
日柱：${skeletonData.bazi[2]}
时柱：${skeletonData.bazi[3]}

【大运信息】
起运年龄：${skeletonData.startAge} 岁
大运顺逆：${skeletonData.direction}
`;

  // 根据Agent类型添加特定信息
  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(input.birthYear, 10);
  const currentAge = currentYear - birthYear + 1;

  switch (agentType) {
    case 'kline_past': {
      // 过去K线：从出生到今年
      const pastTimeline = skeletonData.timeline.filter(t => t.year <= currentYear);
      const pastTimelineStr = JSON.stringify(pastTimeline.map(t => ({
        a: t.age,
        y: t.year,
        gz: t.ganZhi,
        dy: t.daYun
      })));
      return baseInfo + `\n【当前年份】${currentYear}年（${currentAge}岁）\n【待填充的过去时间轴（出生到今年）】\n${pastTimelineStr}`;
    }

    case 'kline_future': {
      // 未来K线：从今年到100岁
      const futureTimeline = skeletonData.timeline.filter(t => t.year >= currentYear);
      const futureTimelineStr = JSON.stringify(futureTimeline.map(t => ({
        a: t.age,
        y: t.year,
        gz: t.ganZhi,
        dy: t.daYun
      })));
      return baseInfo + `\n【当前年份】${currentYear}年（${currentAge}岁）\n【待填充的未来时间轴（今年到100岁）】\n${futureTimelineStr}`;
    }

    case 'core':
      return baseInfo + `\n【前30年时间轴参考】\n${timelineStr}\n\n请深度分析此八字的核心命理结构。`;

    case 'career':
      return baseInfo + `\n请专注分析此八字的事业财富运势。`;

    case 'marriage':
      return baseInfo + `\n请专注分析此八字的婚姻感情和健康状况。`;

    case 'crypto':
      return baseInfo + `\n当前年份：${currentYear}\n请专注分析此八字的币圈交易运势和投机潜力。`;

    default:
      return baseInfo;
  }
};

/**
 * 并行执行6个Agent分析
 * @param {object} input - 用户输入
 * @param {object} skeletonData - 时间线骨架
 * @param {object} res - SSE响应对象
 * @param {function} onProgress - 进度回调
 */
export const runParallelAgents = async (input, skeletonData, res, onProgress) => {
  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const apiKey = DEFAULT_API_KEY;

  const agents = [
    { type: 'core', prompt: AGENT_CORE_PROMPT, priority: 1 },
    { type: 'kline_past', prompt: AGENT_KLINE_PAST_PROMPT, priority: 2 },
    { type: 'kline_future', prompt: AGENT_KLINE_FUTURE_PROMPT, priority: 3 },
    { type: 'career', prompt: AGENT_CAREER_PROMPT, priority: 4 },
    { type: 'marriage', prompt: AGENT_MARRIAGE_PROMPT, priority: 5 },
    { type: 'crypto', prompt: AGENT_CRYPTO_PROMPT, priority: 6 },
  ];

  onProgress(`启动 ${agents.length} 个专业Agent并行分析...`);

  const results = {};
  const completedAgents = [];

  // 创建所有Agent的Promise
  const agentPromises = agents.map(agent => {
    const userPrompt = buildAgentUserPrompt(input, skeletonData, agent.type);

    return makeAgentRequestWithRetry(
      agent.type,
      apiBaseUrl,
      apiKey,
      agent.prompt,
      userPrompt
    ).then(result => {
      if (result.success) {
        results[agent.type] = result.data;
        completedAgents.push(agent.type);

        // 立即推送该Agent的结果
        sendSSE(res, `agent_${agent.type}_complete`, {
          agentType: agent.type,
          data: result.data,
          elapsed: result.elapsed,
          model: result.model,
          completedCount: completedAgents.length,
          totalAgents: agents.length,
        });

        onProgress(`✓ Agent[${agent.type}] 完成 (${result.elapsed}s) - 已完成 ${completedAgents.length}/${agents.length}`);
      } else {
        onProgress(`✗ Agent[${agent.type}] 失败: ${result.error}`);
        sendSSE(res, `agent_${agent.type}_error`, {
          agentType: agent.type,
          error: result.error,
        });
      }
      return result;
    });
  });

  // 等待所有Agent完成
  const allResults = await Promise.allSettled(agentPromises);

  // 汇总结果
  const successCount = allResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;

  onProgress(`并行分析完成: ${successCount}/${agents.length} 成功`);

  return {
    success: successCount > 0,
    results,
    completedAgents,
    totalAgents: agents.length,
    successCount,
  };
};

/**
 * 基于八字生成事业财富降级内容
 * @param {object} core - 核心分析结果
 * @param {object} skeletonData - 时间线骨架数据
 */
const generateCareerFallback = (core, skeletonData) => {
  const bazi = core?.bazi || skeletonData?.bazi || [];
  const dayPillar = bazi[2] || '';
  const dayGan = dayPillar ? dayPillar[0] : '';

  // 基于日主五行推断适合行业
  const dayGanIndustries = {
    '甲': { industries: '教育、文化、出版、环保、园艺', element: '木' },
    '乙': { industries: '设计、美容、花艺、服装、医药', element: '木' },
    '丙': { industries: '能源、娱乐、餐饮、传媒、演艺', element: '火' },
    '丁': { industries: '科技、电子、文化创意、教育培训', element: '火' },
    '戊': { industries: '房地产、建筑、矿业、农业、物流', element: '土' },
    '己': { industries: '农业、食品、陶瓷、中介、服务业', element: '土' },
    '庚': { industries: '金融、机械、汽车、五金、军工', element: '金' },
    '辛': { industries: '珠宝、精密仪器、法律、金融、美容', element: '金' },
    '壬': { industries: '物流、航运、旅游、水产、饮料', element: '水' },
    '癸': { industries: '咨询、教育、医疗、心理、艺术', element: '水' },
  };

  const info = dayGanIndustries[dayGan] || { industries: '综合服务类行业', element: '平衡' };

  const industry = `根据八字日主「${dayGan || '未知'}」分析，您五行属${info.element}，事业适合方向包括：${info.industries}。日主强弱影响事业发展模式，建议结合实际情况选择最适合自己的发展道路。命局中官杀星代表事业机遇，财星代表财富获取能力，需综合判断以获得最佳事业规划。`;

  const wealth = `从财运角度分析，八字中财星的强弱决定了财富获取的方式和规模。${dayGan ? `日主${dayGan}` : '您的命局'}具有一定的理财天赋，建议稳健投资为主。正财代表稳定收入如工资薪金，偏财代表投资理财等非固定收入。根据大运流年的不同，财运会有起伏变化，宜把握财运旺盛的年份积极进取。`;

  return {
    industry,
    industryScore: 6,
    wealth,
    wealthScore: 6,
    recommendedIndustries: [
      { name: info.industries.split('、')[0], reason: `五行属${info.element}，与命局相合` },
      { name: info.industries.split('、')[1] || '综合服务', reason: '命理分析推荐' }
    ],
    wealthPattern: '正偏财兼有',
    wealthPotential: '中等偏上',
  };
};

/**
 * 合并多个Agent的结果为最终分析
 * @param {object} agentResults - 各Agent返回的结果
 * @param {object} skeletonData - 时间线骨架数据（用于K线降级）
 */
export const mergeAgentResults = (agentResults, skeletonData = null) => {
  const { core, kline_past, kline_future, career, marriage, crypto } = agentResults;

  // 如果career数据缺失，生成降级内容
  const careerFallback = (!career?.industry || !career?.wealth)
    ? generateCareerFallback(core, skeletonData)
    : null;

  if (careerFallback) {
    console.log('[mergeAgentResults] Career数据缺失，使用降级内容生成事业财富分析');
  }

  // K线数据：合并过去和未来的K线数据
  let chartPoints = [];
  const currentYear = new Date().getFullYear();

  // 获取过去K线数据
  const pastPoints = kline_past?.chartPoints || [];
  // 获取未来K线数据
  const futurePoints = kline_future?.chartPoints || [];

  // 检查两个K线Agent是否都有数据
  const hasPastData = pastPoints.length > 0;
  const hasFutureData = futurePoints.length > 0;

  if (hasPastData && hasFutureData) {
    // 最佳情况：两段K线数据都有，正常合并
    const allPoints = [...pastPoints];

    // 未来K线避免重复年份
    for (const point of futurePoints) {
      if (!allPoints.some(p => p.year === point.year && p.age === point.age)) {
        allPoints.push(point);
      }
    }

    chartPoints = allPoints.sort((a, b) => a.age - b.age);
    console.log(`[mergeAgentResults] K线完整合并: 过去${pastPoints.length}年 + 未来${futurePoints.length}年 = 总${chartPoints.length}年`);

  } else if (hasPastData || hasFutureData) {
    // 部分数据：只有一段K线数据，使用fallback补全缺失部分
    console.warn(`[mergeAgentResults] K线数据不完整: 过去=${pastPoints.length}年, 未来=${futurePoints.length}年，使用fallback补全`);

    if (skeletonData) {
      const fallbackPoints = generateFallbackKLine(skeletonData);
      const existingYears = new Set([
        ...pastPoints.map(p => p.year),
        ...futurePoints.map(p => p.year)
      ]);

      // 合并已有数据
      const allPoints = [...pastPoints, ...futurePoints];

      // 用fallback填补缺失的年份
      for (const point of fallbackPoints) {
        if (!existingYears.has(point.year)) {
          allPoints.push(point);
        }
      }

      chartPoints = allPoints.sort((a, b) => a.age - b.age);
      console.log(`[mergeAgentResults] K线混合合并: AI数据${pastPoints.length + futurePoints.length}年 + Fallback补全 = 总${chartPoints.length}年`);
    } else {
      // 无skeleton数据，只能用现有数据
      chartPoints = [...pastPoints, ...futurePoints].sort((a, b) => a.age - b.age);
      console.warn(`[mergeAgentResults] 无skeleton数据，仅使用部分K线: ${chartPoints.length}年`);
    }

  } else if (skeletonData) {
    // 两段K线都失败，完全使用降级算法
    console.log('[mergeAgentResults] K线Agent全部失败，使用完整降级算法生成K线数据');
    chartPoints = generateFallbackKLine(skeletonData);
  }

  // 最终数据验证：确保数据点数量足够（至少50年）
  const MIN_CHART_POINTS = 50;
  if (chartPoints.length < MIN_CHART_POINTS && skeletonData) {
    console.warn(`[mergeAgentResults] K线数据不足(${chartPoints.length}点 < ${MIN_CHART_POINTS}点)，使用完整fallback替换`);
    chartPoints = generateFallbackKLine(skeletonData);
    console.log(`[mergeAgentResults] Fallback生成完成: ${chartPoints.length}年`);
  }

  // 合并过去和未来的关键事件
  const pastEvents = kline_past?.pastEvents || core?.pastEvents || [];
  const futureEvents = kline_future?.futureEvents || core?.futureEvents || [];
  const keyYears = [
    ...(kline_past?.keyYears || []),
    ...(kline_future?.keyYears || [])
  ].sort((a, b) => a.year - b.year);

  return {
    // 基础信息
    bazi: core?.bazi || [],
    summary: core?.summary || '命理分析完成',
    summaryScore: core?.summaryScore || 5,

    // 核心Agent - 性格/六亲/风水
    personality: core?.personality || '',
    personalityScore: core?.personalityScore || 5,
    family: core?.family || '',
    familyScore: core?.familyScore || 5,
    fengShui: core?.fengShui || '',
    fengShuiScore: core?.fengShuiScore || 5,

    // 个人特征
    appearance: core?.appearance || '',
    bodyType: core?.bodyType || '',
    skin: core?.skin || '',
    characterSummary: core?.characterSummary || '',

    // 事业Agent - 使用fallback如果原数据缺失
    industry: career?.industry || careerFallback?.industry || '暂无事业分析，请稍后重试',
    industryScore: career?.industryScore || careerFallback?.industryScore || 5,
    wealth: career?.wealth || careerFallback?.wealth || '暂无财富分析，请稍后重试',
    wealthScore: career?.wealthScore || careerFallback?.wealthScore || 5,

    // 婚姻健康Agent
    marriage: marriage?.marriage || '',
    marriageScore: marriage?.marriageScore || 5,
    health: marriage?.health || '',
    healthScore: marriage?.healthScore || 5,
    healthBodyParts: marriage?.healthBodyParts || [],

    // 币圈Agent
    crypto: crypto?.crypto || '',
    cryptoScore: crypto?.cryptoScore || 5,
    cryptoYear: crypto?.cryptoYear || '待定',
    cryptoStyle: crypto?.cryptoStyle || '现货定投',

    // K线Agent - 使用已计算的chartPoints（含降级逻辑）
    chartPoints: chartPoints,

    // 运势预测
    monthlyFortune: core?.monthlyFortune || marriage?.monthlyFortune || '',
    monthlyHighlights: core?.monthlyHighlights || [],
    yearlyFortune: core?.yearlyFortune || career?.yearlyFortune || '',
    yearlyKeyEvents: core?.yearlyKeyEvents || career?.yearlyKeyEvents || [],

    // 幸运元素
    luckyColors: core?.luckyColors || [],
    luckyDirections: core?.luckyDirections || [],
    luckyZodiac: core?.luckyZodiac || [],
    luckyNumbers: core?.luckyNumbers || [],

    // 重点日期和事件
    keyDatesThisYear: core?.keyDatesThisYear || [],
    keyDatesThisMonth: core?.keyDatesThisMonth || [],
    pastEvents: pastEvents,
    futureEvents: futureEvents,
    keyYears: keyYears,
  };
};

export default {
  runParallelAgents,
  mergeAgentResults,
  sendSSE,
};
