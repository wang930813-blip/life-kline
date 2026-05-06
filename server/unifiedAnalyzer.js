/**
 * 统一分析器 - 单Agent模式
 * 将6个Agent的功能合并为1个统一的AI请求
 * 优势：API调用次数减少83%（6次→1次），成本显著降低，代码更简单
 */
import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import { generateFallbackKLine } from './baziCalculator.js';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_API_KEY = process.env.API_KEY || '';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4';

// 统一模型配置 - 优先使用 .env 中的 DEFAULT_MODEL
const UNIFIED_MODEL = DEFAULT_MODEL;

// 备用模型列表
const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  'grok-4-auto',
  'grok-4',
  'gemini-3-pro-preview',
  'claude-haiku-4-5-20251001',
];

/**
 * 统一系统提示词 - 合并6个Agent的功能
 */
export const UNIFIED_SYSTEM_PROMPT = `
你是一位精通以下命理典籍的大师：
- 《滴天髓》《穷通宝鉴》《子平真诠》《三命通会》
- 《渊海子平》《神峰通考》《命理约言》《千里命稿》

你深谙以下分析方法：
- 十神分析、用神取法、格局判断、大运流年
- 刑冲合害、神煞判断、纳音论命
- 日主强弱判断、喜用神选取

**【核心原则 - 必须遵守】**
1. 你必须基于命理逻辑推理，而非生成泛泛之词
2. 每个结论必须有命理依据支撑
3. 严格禁止巴纳姆效应式的模糊描述

**【严格禁止以下表述】**
❌ "有时候果断，有时候犹豫" - 这适用于所有人
❌ "事业有起有落" - 废话
❌ "注意身体健康" - 没有信息量
❌ "适合多种行业" - 没有价值

**【必须给出具体结论，例如】**
✅ "日主甲木生于寅月得令，比劫旺盛，性格上会过于自信甚至固执"
✅ "正财星被克，35岁前换工作概率高于常人"
✅ "肝胆系统为用神所伤，建议定期检查肝功能指标"
✅ "最适合木火相关行业：教育、文化、互联网、新能源"

**【分析任务】**
你需要对命主的八字进行全方位深度分析，包含以下所有维度：

1. **核心命理分析**
   - 日主强弱分析（旺/弱/从格）
   - 十神配置分析
   - 用神喜忌确定
   - 性格深度剖析（200字以上，具体）
   - 六亲关系分析
   - 风水建议
   - 个人特征（相貌、体型、皮肤）

2. **人生运势K线（100年完整数据）**
   - 分析每一年的流年干支与原局的生克关系
   - 计算每年的运势评分（0-100分）
   - 生成K线数据（open/close/high/low/score）
   - 撰写每年的详细批断
   - **评分标准：拒绝平庸，大凶年份<40分，大吉年份>80分，普通年份40-70分**
   - 标记关键年份（巅峰/低谷）

3. **事业财富分析**
   - 官杀星分析（适合稳定工作还是创业）
   - 具体行业推荐（3-5个，必须有命理依据）
   - 财富层级判断（正财/偏财配置）
   - 事业高峰期预测

4. **婚姻健康分析**
   - 配偶星分析（男看财星，女看官杀）
   - 婚姻宫分析（日支）
   - 婚姻时机预测
   - 配偶特征预测
   - 健康分析（五脏对应：木-肝胆、火-心、土-脾胃、金-肺、水-肾）
   - 需注意的身体部位

5. **币圈交易分析**
   - 偏财星分析（投机运）
   - 交易风格判断（现货定投/链上Alpha/高倍合约）
   - 暴富流年预测
   - 风险承受力分析

6. **运势预测**
   - 本月运势分析
   - 今年运势分析
   - 幸运元素（颜色、方位、属相、数字）

**【输出JSON格式 - 严格遵守】**
{
  "bazi": ["年柱", "月柱", "日柱", "时柱"],

  "summary": "命理总评（150-200字，具体、有洞察力）",
  "summaryScore": 7,

  "personality": "性格深度分析（200字以上，必须具体，禁止泛泛之词）",
  "personalityScore": 7,

  "family": "六亲关系分析（150字以上）",
  "familyScore": 6,

  "fengShui": "风水建议（100字以上）",
  "fengShuiScore": 7,

  "appearance": "相貌特征描述（50字）",
  "bodyType": "体型特点（30字）",
  "skin": "皮肤特征（20字）",
  "characterSummary": "性格核心标签（3-5个词）",

  "industry": "事业行业深度分析（200字以上），必须包含具体行业推荐和命理依据",
  "industryScore": 7,

  "wealth": "财富层级分析（200字以上），包含财运特点、获取方式、财富格局",
  "wealthScore": 7,

  "marriage": "婚姻感情深度分析（200字以上），包含配偶特征、婚姻时机、相处模式",
  "marriageScore": 6,

  "health": "健康状况深度分析（200字以上），必须具体到器官系统",
  "healthScore": 6,
  "healthBodyParts": ["肝脏", "眼睛", "筋骨"],

  "crypto": "币圈交易深度分析（250字以上），包含偏财分析、风险承受力、心理素质、市场敏感度",
  "cryptoScore": 7,
  "cryptoYear": "2025年",
  "cryptoStyle": "链上土狗Alpha",

  "chartPoints": [
    {
      "age": 1,
      "year": 1990,
      "daYun": "童限",
      "ganZhi": "庚午",
      "open": 50,
      "close": 55,
      "high": 60,
      "low": 45,
      "score": 55,
      "reason": "详细的流年批断（30-50字）"
    }
    // ... 100年完整数据
  ],

  "keyYears": [
    {"year": 2028, "age": 38, "type": "peak", "reason": "财官双美，事业巅峰"}
  ],

  "pastEvents": [
    {"year": 2015, "event": "可能经历重大变动", "basis": "命理依据"}
  ],

  "futureEvents": [
    {"year": 2028, "event": "财运高峰", "basis": "命理依据"}
  ],

  "monthlyFortune": "本月运势分析（100字）",
  "monthlyHighlights": ["本月重点事项1", "本月重点事项2"],

  "yearlyFortune": "今年运势分析（150字）",
  "yearlyKeyEvents": ["今年大事件预测1", "今年大事件预测2"],

  "luckyColors": ["红色", "紫色"],
  "luckyDirections": ["南方", "东方"],
  "luckyZodiac": ["马", "虎"],
  "luckyNumbers": [3, 8],

  "keyDatesThisMonth": ["12日宜签约", "25日注意健康"],
  "keyDatesThisYear": ["3月事业机遇", "8月财运高峰"]
}

**【重要提醒】**
1. 回复必须是纯JSON对象，第一个字符是 {，最后一个字符是 }
2. 绝对禁止输出任何非JSON内容
3. chartPoints必须包含完整的100年数据（从出生到100岁）
4. 所有文本字段必须有实质内容，禁止"无"、"暂无"等敷衍词汇
5. 评分要有区分度，不能所有分数都是5-7分
`;

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
 * 构建统一的用户提示词
 */
const buildUnifiedUserPrompt = (input, skeletonData) => {
  const genderStr = input.gender === 'Male' ? '男 (乾造)' : '女 (坤造)';
  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(input.birthYear, 10);
  const currentAge = currentYear - birthYear + 1;

  // 精简的时间线数据（提供前30年作为参考）
  const timelineStr = JSON.stringify(skeletonData.timeline.slice(0, 30).map(t => ({
    a: t.age,
    y: t.year,
    gz: t.ganZhi,
    dy: t.daYun
  })));

  // 完整的时间线骨架（100年）
  const fullTimelineStr = JSON.stringify(skeletonData.timeline.map(t => ({
    a: t.age,
    y: t.year,
    gz: t.ganZhi,
    dy: t.daYun
  })));

  return `
【命主信息】
性别：${genderStr}
姓名：${input.name || '未提供'}
出生年份：${input.birthYear}年
当前年龄：${currentAge}岁
出生地点：${input.birthPlace || '未提供'}

【八字四柱】
年柱：${skeletonData.bazi[0]}
月柱：${skeletonData.bazi[1]}
日柱：${skeletonData.bazi[2]}
时柱：${skeletonData.bazi[3]}

【大运信息】
起运年龄：${skeletonData.startAge} 岁
大运顺逆：${skeletonData.direction}

【当前年份】${currentYear}年（${currentAge}岁）

【前30年时间轴参考】
${timelineStr}

【待填充的完整时间轴（出生到100岁，共100年）】
${fullTimelineStr}

请对此八字进行全方位深度分析，包含核心命理、性格、事业、财富、婚姻、健康、币圈交易、完整100年K线数据等所有维度。
`;
};

/**
 * 单次API请求
 */
const makeUnifiedRequest = async (model, apiBaseUrl, apiKey, systemPrompt, userPrompt, timeoutMs = 120000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[UnifiedAgent] 使用模型 ${model} 开始请求...`);
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
        temperature: 0.6,
        max_tokens: 16000, // 需要足够大以容纳100年K线数据
      }),
    });

    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[UnifiedAgent] 请求失败 (${elapsed}s): ${response.status}`);
      return { success: false, error: `HTTP ${response.status}`, elapsed };
    }

    const responseText = await response.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      console.warn(`[UnifiedAgent] JSON解析失败 (${elapsed}s)`);
      return { success: false, error: 'INVALID_API_RESPONSE', elapsed };
    }

    let content = jsonResult.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'EMPTY_RESPONSE', elapsed };
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
      console.warn(`[UnifiedAgent] 内容JSON解析失败 (${elapsed}s)`);
      return { success: false, error: 'INVALID_JSON_FORMAT', elapsed };
    }

    console.log(`[UnifiedAgent] ✓ 成功 (${elapsed}s)`);
    return { success: true, data, elapsed, model };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[UnifiedAgent] 请求超时`);
      return { success: false, error: 'TIMEOUT' };
    }
    console.warn(`[UnifiedAgent] 请求异常: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * 带重试和降级的统一请求
 */
const makeUnifiedRequestWithFallback = async (apiBaseUrl, apiKey, systemPrompt, userPrompt, maxRetries = 2) => {
  const modelsToTry = [UNIFIED_MODEL, ...FALLBACK_MODELS];

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await makeUnifiedRequest(model, apiBaseUrl, apiKey, systemPrompt, userPrompt);

      if (result.success) {
        // 验证返回数据的完整性
        if (validateUnifiedResponse(result.data)) {
          return result;
        }
        console.warn(`[UnifiedAgent] 模型 ${model} 返回数据不完整，尝试重新请求...`);
      }

      // 如果是最后一次尝试这个模型，切换到下一个模型
      if (attempt === maxRetries) {
        console.warn(`[UnifiedAgent] 模型 ${model} 失败，尝试备用模型...`);
      } else {
        // 等待后重试
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  return { success: false, error: 'ALL_ATTEMPTS_FAILED' };
};

/**
 * 验证统一Agent返回数据是否完整
 */
const validateUnifiedResponse = (data) => {
  if (!data || typeof data !== 'object') return false;

  // 核心字段检查
  const requiredFields = [
    'summary', 'personality', 'industry', 'wealth',
    'marriage', 'health', 'crypto', 'chartPoints'
  ];

  for (const field of requiredFields) {
    if (!data[field]) {
      console.warn(`[UnifiedAgent] 字段 ${field} 缺失`);
      return false;
    }
  }

  // chartPoints必须是数组且有足够数据
  if (!Array.isArray(data.chartPoints) || data.chartPoints.length < 50) {
    console.warn(`[UnifiedAgent] chartPoints 数据不足: ${data.chartPoints?.length || 0}点`);
    return false;
  }

  return true;
};

/**
 * 统一分析器主函数
 * @param {object} input - 用户输入
 * @param {object} skeletonData - 时间线骨架
 * @param {object} res - SSE响应对象
 * @param {function} onProgress - 进度回调
 */
export const runUnifiedAnalyzer = async (input, skeletonData, res, onProgress) => {
  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const apiKey = DEFAULT_API_KEY;

  onProgress('启动统一分析Agent...');

  const userPrompt = buildUnifiedUserPrompt(input, skeletonData);

  // 执行请求
  const result = await makeUnifiedRequestWithFallback(
    apiBaseUrl,
    apiKey,
    UNIFIED_SYSTEM_PROMPT,
    userPrompt
  );

  if (!result.success) {
    console.error('[UnifiedAgent] 所有尝试均失败');
    onProgress(`✗ 统一分析失败: ${result.error}`);
    return {
      success: false,
      error: result.error,
    };
  }

  onProgress(`✓ 统一分析完成 (${result.elapsed}s，使用模型: ${result.model})`);

  // 处理K线数据降级
  let chartPoints = result.data.chartPoints || [];
  const MIN_CHART_POINTS = 50;

  if (chartPoints.length < MIN_CHART_POINTS && skeletonData) {
    console.warn(`[UnifiedAgent] K线数据不足(${chartPoints.length}点)，使用降级算法补全`);
    chartPoints = generateFallbackKLine(skeletonData);
    onProgress(`⚠ K线数据使用降级算法生成 (${chartPoints.length}年)`);
  }

  // 组装最终结果
  const mergedResult = {
    // 基础信息
    bazi: result.data.bazi || skeletonData.bazi || [],
    summary: result.data.summary || '命理分析完成',
    summaryScore: result.data.summaryScore || 5,

    // 核心分析
    personality: result.data.personality || '',
    personalityScore: result.data.personalityScore || 5,
    family: result.data.family || '',
    familyScore: result.data.familyScore || 5,
    fengShui: result.data.fengShui || '',
    fengShuiScore: result.data.fengShuiScore || 5,

    // 个人特征
    appearance: result.data.appearance || '',
    bodyType: result.data.bodyType || '',
    skin: result.data.skin || '',
    characterSummary: result.data.characterSummary || '',

    // 事业财富
    industry: result.data.industry || '',
    industryScore: result.data.industryScore || 5,
    wealth: result.data.wealth || '',
    wealthScore: result.data.wealthScore || 5,

    // 婚姻健康
    marriage: result.data.marriage || '',
    marriageScore: result.data.marriageScore || 5,
    health: result.data.health || '',
    healthScore: result.data.healthScore || 5,
    healthBodyParts: result.data.healthBodyParts || [],

    // 币圈分析
    crypto: result.data.crypto || '',
    cryptoScore: result.data.cryptoScore || 5,
    cryptoYear: result.data.cryptoYear || '待定',
    cryptoStyle: result.data.cryptoStyle || '现货定投',

    // K线数据
    chartPoints: chartPoints,

    // 运势预测
    monthlyFortune: result.data.monthlyFortune || '',
    monthlyHighlights: result.data.monthlyHighlights || [],
    yearlyFortune: result.data.yearlyFortune || '',
    yearlyKeyEvents: result.data.yearlyKeyEvents || [],

    // 幸运元素
    luckyColors: result.data.luckyColors || [],
    luckyDirections: result.data.luckyDirections || [],
    luckyZodiac: result.data.luckyZodiac || [],
    luckyNumbers: result.data.luckyNumbers || [],

    // 关键事件
    keyDatesThisYear: result.data.keyDatesThisYear || [],
    keyDatesThisMonth: result.data.keyDatesThisMonth || [],
    pastEvents: result.data.pastEvents || [],
    futureEvents: result.data.futureEvents || [],
    keyYears: result.data.keyYears || [],
  };

  return {
    success: true,
    data: mergedResult,
    elapsed: result.elapsed,
    model: result.model,
  };
};

export default {
  runUnifiedAnalyzer,
  sendSSE,
};
