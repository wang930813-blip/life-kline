/**
 * 骞惰鍒嗘瀽鍣?- 6涓狝gent鍚屾椂宸ヤ綔
 * 瀹炵幇娓愯繘寮廠SE鎺ㄩ€侊紝鐢ㄦ埛鎰熺煡鍒扮殑绛夊緟鏃堕棿 = 鏈€蹇獳gent鐨勮繑鍥炴椂闂?
 * K绾垮垎涓鸿繃鍘?鍑虹敓鍒颁粖骞?鍜屾湭鏉?浠婂勾鍒?00宀?涓や釜骞惰璇锋眰锛屾彁鍗囩敓鎴愰€熷害
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
const DEFAULT_API_KEY = process.env.API_KEY || '';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4';

// 浼樺厛浣跨敤 .env 涓殑 DEFAULT_MODEL锛屽彧鏈夊け璐ユ椂鎵嶅洖閫€
const AGENT_MODEL_ASSIGNMENT = {
  core: DEFAULT_MODEL,
  kline_past: DEFAULT_MODEL,
  kline_future: DEFAULT_MODEL,
  career: DEFAULT_MODEL,
  marriage: DEFAULT_MODEL,
  crypto: DEFAULT_MODEL,
};

// 澶囩敤妯″瀷鍒楄〃
const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  'grok-4-auto',
  'grok-4',
  'gemini-3-pro-preview',
  'claude-haiku-4-5-20251001',
];

/**
 * 鍙戦€丼SE浜嬩欢
 */
export const sendSSE = (res, event, data) => {
  if (!res.writableEnded) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
};

/**
 * 鍗曚釜Agent璇锋眰
 */
const makeAgentRequest = async (agentType, model, apiBaseUrl, apiKey, systemPrompt, userPrompt, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[Agent:${agentType}] 浣跨敤妯″瀷 ${model} 寮€濮嬭姹?..`);
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
        temperature: 0.6, // 绋嶄綆鐨勬俯搴︿互淇濇寔涓€鑷存€?
      }),
    });

    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Agent:${agentType}] 璇锋眰澶辫触 (${elapsed}s): ${response.status}`);
      return { success: false, agentType, error: `HTTP ${response.status}`, elapsed };
    }

    const responseText = await response.text();
    let jsonResult;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (e) {
      console.warn(`[Agent:${agentType}] JSON瑙ｆ瀽澶辫触 (${elapsed}s)`);
      return { success: false, agentType, error: 'INVALID_API_RESPONSE', elapsed };
    }

    let content = jsonResult.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, agentType, error: 'EMPTY_RESPONSE', elapsed };
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
      console.warn(`[Agent:${agentType}] 鍐呭JSON瑙ｆ瀽澶辫触 (${elapsed}s): ${content.substring(0, 100)}`);
      return { success: false, agentType, error: 'INVALID_JSON_FORMAT', elapsed };
    }

    console.log(`[Agent:${agentType}] 鉁?鎴愬姛 (${elapsed}s)`);
    return { success: true, agentType, data, elapsed, model };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[Agent:${agentType}] 璇锋眰瓒呮椂`);
      return { success: false, agentType, error: 'TIMEOUT' };
    }
    console.warn(`[Agent:${agentType}] 璇锋眰寮傚父: ${error.message}`);
    return { success: false, agentType, error: error.message };
  }
};

/**
 * 楠岃瘉Agent杩斿洖鏁版嵁鏄惁瀹屾暣
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
      console.warn(`[Agent:${agentType}] 瀛楁 ${field} 缂哄け鎴栧唴瀹瑰お鐭璥);
      return false;
    }
  }
  return true;
};

/**
 * 甯﹂噸璇曠殑Agent璇锋眰
 */
const makeAgentRequestWithRetry = async (agentType, apiBaseUrl, apiKey, systemPrompt, userPrompt, maxRetries = 2) => {
  const primaryModel = AGENT_MODEL_ASSIGNMENT[agentType] || DEFAULT_MODEL;
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await makeAgentRequest(agentType, model, apiBaseUrl, apiKey, systemPrompt, userPrompt);

      if (result.success) {
        // 楠岃瘉杩斿洖鏁版嵁鏄惁瀹屾暣
        if (validateAgentResponse(agentType, result.data)) {
          return result;
        }
        console.warn(`[Agent:${agentType}] 妯″瀷 ${model} 杩斿洖鏁版嵁涓嶅畬鏁达紝灏濊瘯閲嶆柊璇锋眰...`);
      }

      // 濡傛灉鏄渶鍚庝竴娆″皾璇曡繖涓ā鍨嬶紝鍒囨崲鍒颁笅涓€涓ā鍨?
      if (attempt === maxRetries) {
        console.warn(`[Agent:${agentType}] 妯″瀷 ${model} 澶辫触锛屽皾璇曞鐢ㄦā鍨?..`);
      } else {
        // 绛夊緟鍚庨噸璇?
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  return { success: false, agentType, error: 'ALL_ATTEMPTS_FAILED' };
};

/**
 * 鏋勫缓Agent鐢ㄦ埛鎻愮ず璇?
 */
const buildAgentUserPrompt = (input, skeletonData, agentType) => {
  const genderStr = input.gender === 'Male' ? '鐢?(涔鹃€?' : '濂?(鍧ら€?';

  // 绮剧畝鐨勬椂闂寸嚎鏁版嵁
  const timelineStr = JSON.stringify(skeletonData.timeline.slice(0, 30).map(t => ({
    a: t.age,
    y: t.year,
    gz: t.ganZhi,
    dy: t.daYun
  })));

  const baseInfo = `
銆愬懡涓讳俊鎭€?
鎬у埆锛?{genderStr}
濮撳悕锛?{input.name || '鏈彁渚?}
鍑虹敓骞翠唤锛?{input.birthYear}骞?
鍑虹敓鍦扮偣锛?{input.birthPlace || '鏈彁渚?}

銆愬叓瀛楀洓鏌便€?
骞存煴锛?{skeletonData.bazi[0]}
鏈堟煴锛?{skeletonData.bazi[1]}
鏃ユ煴锛?{skeletonData.bazi[2]}
鏃舵煴锛?{skeletonData.bazi[3]}

銆愬ぇ杩愪俊鎭€?
璧疯繍骞撮緞锛?{skeletonData.startAge} 宀?
澶ц繍椤洪€嗭細${skeletonData.direction}
`;

  // 鏍规嵁Agent绫诲瀷娣诲姞鐗瑰畾淇℃伅
  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(input.birthYear, 10);
  const currentAge = currentYear - birthYear + 1;

  switch (agentType) {
    case 'kline_past': {
      // 杩囧幓K绾匡細浠庡嚭鐢熷埌浠婂勾
      const pastTimeline = skeletonData.timeline.filter(t => t.year <= currentYear);
      const pastTimelineStr = JSON.stringify(pastTimeline.map(t => ({
        a: t.age,
        y: t.year,
        gz: t.ganZhi,
        dy: t.daYun
      })));
      return baseInfo + `\n銆愬綋鍓嶅勾浠姐€?{currentYear}骞达紙${currentAge}宀侊級\n銆愬緟濉厖鐨勮繃鍘绘椂闂磋酱锛堝嚭鐢熷埌浠婂勾锛夈€慭n${pastTimelineStr}`;
    }

    case 'kline_future': {
      // 鏈潵K绾匡細浠庝粖骞村埌100宀?
      const futureTimeline = skeletonData.timeline.filter(t => t.year >= currentYear);
      const futureTimelineStr = JSON.stringify(futureTimeline.map(t => ({
        a: t.age,
        y: t.year,
        gz: t.ganZhi,
        dy: t.daYun
      })));
      return baseInfo + `\n銆愬綋鍓嶅勾浠姐€?{currentYear}骞达紙${currentAge}宀侊級\n銆愬緟濉厖鐨勬湭鏉ユ椂闂磋酱锛堜粖骞村埌100宀侊級銆慭n${futureTimelineStr}`;
    }

    case 'core':
      return baseInfo + `\n銆愬墠30骞存椂闂磋酱鍙傝€冦€慭n${timelineStr}\n\n璇锋繁搴﹀垎鏋愭鍏瓧鐨勬牳蹇冨懡鐞嗙粨鏋勩€俙;

    case 'career':
      return baseInfo + `\n璇蜂笓娉ㄥ垎鏋愭鍏瓧鐨勪簨涓氳储瀵岃繍鍔裤€俙;

    case 'marriage':
      return baseInfo + `\n璇蜂笓娉ㄥ垎鏋愭鍏瓧鐨勫濮绘劅鎯呭拰鍋ュ悍鐘跺喌銆俙;

    case 'crypto':
      return baseInfo + `\n褰撳墠骞翠唤锛?{currentYear}\n璇蜂笓娉ㄥ垎鏋愭鍏瓧鐨勫竵鍦堜氦鏄撹繍鍔垮拰鎶曟満娼滃姏銆俙;

    default:
      return baseInfo;
  }
};

/**
 * 骞惰鎵ц6涓狝gent鍒嗘瀽
 * @param {object} input - 鐢ㄦ埛杈撳叆
 * @param {object} skeletonData - 鏃堕棿绾块鏋?
 * @param {object} res - SSE鍝嶅簲瀵硅薄
 * @param {function} onProgress - 杩涘害鍥炶皟
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

  onProgress(`鍚姩 ${agents.length} 涓笓涓欰gent骞惰鍒嗘瀽...`);

  const results = {};
  const completedAgents = [];

  // 鍒涘缓鎵€鏈堿gent鐨凱romise
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

        // 绔嬪嵆鎺ㄩ€佽Agent鐨勭粨鏋?
        sendSSE(res, `agent_${agent.type}_complete`, {
          agentType: agent.type,
          data: result.data,
          elapsed: result.elapsed,
          model: result.model,
          completedCount: completedAgents.length,
          totalAgents: agents.length,
        });

        onProgress(`鉁?Agent[${agent.type}] 瀹屾垚 (${result.elapsed}s) - 宸插畬鎴?${completedAgents.length}/${agents.length}`);
      } else {
        onProgress(`鉁?Agent[${agent.type}] 澶辫触: ${result.error}`);
        sendSSE(res, `agent_${agent.type}_error`, {
          agentType: agent.type,
          error: result.error,
        });
      }
      return result;
    });
  });

  // 绛夊緟鎵€鏈堿gent瀹屾垚
  const allResults = await Promise.allSettled(agentPromises);

  // 姹囨€荤粨鏋?
  const successCount = allResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;

  onProgress(`骞惰鍒嗘瀽瀹屾垚: ${successCount}/${agents.length} 鎴愬姛`);

  return {
    success: successCount > 0,
    results,
    completedAgents,
    totalAgents: agents.length,
    successCount,
  };
};

/**
 * 鍩轰簬鍏瓧鐢熸垚浜嬩笟璐㈠瘜闄嶇骇鍐呭
 * @param {object} core - 鏍稿績鍒嗘瀽缁撴灉
 * @param {object} skeletonData - 鏃堕棿绾块鏋舵暟鎹?
 */
const generateCareerFallback = (core, skeletonData) => {
  const bazi = core?.bazi || skeletonData?.bazi || [];
  const dayPillar = bazi[2] || '';
  const dayGan = dayPillar ? dayPillar[0] : '';

  // 鍩轰簬鏃ヤ富浜旇鎺ㄦ柇閫傚悎琛屼笟
  const dayGanIndustries = {
    '鐢?: { industries: '鏁欒偛銆佹枃鍖栥€佸嚭鐗堛€佺幆淇濄€佸洯鑹?, element: '鏈? },
    '涔?: { industries: '璁捐銆佺編瀹广€佽姳鑹恒€佹湇瑁呫€佸尰鑽?, element: '鏈? },
    '涓?: { industries: '鑳芥簮銆佸ū涔愩€侀楗€佷紶濯掋€佹紨鑹?, element: '鐏? },
    '涓?: { industries: '绉戞妧銆佺數瀛愩€佹枃鍖栧垱鎰忋€佹暀鑲插煿璁?, element: '鐏? },
    '鎴?: { industries: '鎴垮湴浜с€佸缓绛戙€佺熆涓氥€佸啘涓氥€佺墿娴?, element: '鍦? },
    '宸?: { industries: '鍐滀笟銆侀鍝併€侀櫠鐡枫€佷腑浠嬨€佹湇鍔′笟', element: '鍦? },
    '搴?: { industries: '閲戣瀺銆佹満姊般€佹苯杞︺€佷簲閲戙€佸啗宸?, element: '閲? },
    '杈?: { industries: '鐝犲疂銆佺簿瀵嗕华鍣ㄣ€佹硶寰嬨€侀噾铻嶃€佺編瀹?, element: '閲? },
    '澹?: { industries: '鐗╂祦銆佽埅杩愩€佹梾娓搞€佹按浜с€侀ギ鏂?, element: '姘? },
    '鐧?: { industries: '鍜ㄨ銆佹暀鑲层€佸尰鐤椼€佸績鐞嗐€佽壓鏈?, element: '姘? },
  };

  const info = dayGanIndustries[dayGan] || { industries: '缁煎悎鏈嶅姟绫昏涓?, element: '骞宠　' };

  const industry = `鏍规嵁鍏瓧鏃ヤ富銆?{dayGan || '鏈煡'}銆嶅垎鏋愶紝鎮ㄤ簲琛屽睘${info.element}锛屼簨涓氶€傚悎鏂瑰悜鍖呮嫭锛?{info.industries}銆傛棩涓诲己寮卞奖鍝嶄簨涓氬彂灞曟ā寮忥紝寤鸿缁撳悎瀹為檯鎯呭喌閫夋嫨鏈€閫傚悎鑷繁鐨勫彂灞曢亾璺€傚懡灞€涓畼鏉€鏄熶唬琛ㄤ簨涓氭満閬囷紝璐㈡槦浠ｈ〃璐㈠瘜鑾峰彇鑳藉姏锛岄渶缁煎悎鍒ゆ柇浠ヨ幏寰楁渶浣充簨涓氳鍒掋€俙;

  const wealth = `浠庤储杩愯搴﹀垎鏋愶紝鍏瓧涓储鏄熺殑寮哄急鍐冲畾浜嗚储瀵岃幏鍙栫殑鏂瑰紡鍜岃妯°€?{dayGan ? `鏃ヤ富${dayGan}` : '鎮ㄧ殑鍛藉眬'}鍏锋湁涓€瀹氱殑鐞嗚储澶╄祴锛屽缓璁ǔ鍋ユ姇璧勪负涓汇€傛璐唬琛ㄧǔ瀹氭敹鍏ュ宸ヨ祫钖噾锛屽亸璐唬琛ㄦ姇璧勭悊璐㈢瓑闈炲浐瀹氭敹鍏ャ€傛牴鎹ぇ杩愭祦骞寸殑涓嶅悓锛岃储杩愪細鏈夎捣浼忓彉鍖栵紝瀹滄妸鎻¤储杩愭椇鐩涚殑骞翠唤绉瀬杩涘彇銆俙;

  return {
    industry,
    industryScore: 6,
    wealth,
    wealthScore: 6,
    recommendedIndustries: [
      { name: info.industries.split('銆?)[0], reason: `浜旇灞?{info.element}锛屼笌鍛藉眬鐩稿悎` },
      { name: info.industries.split('銆?)[1] || '缁煎悎鏈嶅姟', reason: '鍛界悊鍒嗘瀽鎺ㄨ崘' }
    ],
    wealthPattern: '姝ｅ亸璐㈠吋鏈?,
    wealthPotential: '涓瓑鍋忎笂',
  };
};

/**
 * 鍚堝苟澶氫釜Agent鐨勭粨鏋滀负鏈€缁堝垎鏋?
 * @param {object} agentResults - 鍚凙gent杩斿洖鐨勭粨鏋?
 * @param {object} skeletonData - 鏃堕棿绾块鏋舵暟鎹紙鐢ㄤ簬K绾块檷绾э級
 */
export const mergeAgentResults = (agentResults, skeletonData = null) => {
  const { core, kline_past, kline_future, career, marriage, crypto } = agentResults;

  // 濡傛灉career鏁版嵁缂哄け锛岀敓鎴愰檷绾у唴瀹?
  const careerFallback = (!career?.industry || !career?.wealth)
    ? generateCareerFallback(core, skeletonData)
    : null;

  if (careerFallback) {
    console.log('[mergeAgentResults] Career鏁版嵁缂哄け锛屼娇鐢ㄩ檷绾у唴瀹圭敓鎴愪簨涓氳储瀵屽垎鏋?);
  }

  // K绾挎暟鎹細鍚堝苟杩囧幓鍜屾湭鏉ョ殑K绾挎暟鎹?
  let chartPoints = [];
  const currentYear = new Date().getFullYear();

  // 鑾峰彇杩囧幓K绾挎暟鎹?
  const pastPoints = kline_past?.chartPoints || [];
  // 鑾峰彇鏈潵K绾挎暟鎹?
  const futurePoints = kline_future?.chartPoints || [];

  // 妫€鏌ヤ袱涓狵绾緼gent鏄惁閮芥湁鏁版嵁
  const hasPastData = pastPoints.length > 0;
  const hasFutureData = futurePoints.length > 0;

  if (hasPastData && hasFutureData) {
    // 鏈€浣虫儏鍐碉細涓ゆK绾挎暟鎹兘鏈夛紝姝ｅ父鍚堝苟
    const allPoints = [...pastPoints];

    // 鏈潵K绾块伩鍏嶉噸澶嶅勾浠?
    for (const point of futurePoints) {
      if (!allPoints.some(p => p.year === point.year && p.age === point.age)) {
        allPoints.push(point);
      }
    }

    chartPoints = allPoints.sort((a, b) => a.age - b.age);
    console.log(`[mergeAgentResults] K绾垮畬鏁村悎骞? 杩囧幓${pastPoints.length}骞?+ 鏈潵${futurePoints.length}骞?= 鎬?{chartPoints.length}骞碻);

  } else if (hasPastData || hasFutureData) {
    // 閮ㄥ垎鏁版嵁锛氬彧鏈変竴娈礙绾挎暟鎹紝浣跨敤fallback琛ュ叏缂哄け閮ㄥ垎
    console.warn(`[mergeAgentResults] K绾挎暟鎹笉瀹屾暣: 杩囧幓=${pastPoints.length}骞? 鏈潵=${futurePoints.length}骞达紝浣跨敤fallback琛ュ叏`);

    if (skeletonData) {
      const fallbackPoints = generateFallbackKLine(skeletonData);
      const existingYears = new Set([
        ...pastPoints.map(p => p.year),
        ...futurePoints.map(p => p.year)
      ]);

      // 鍚堝苟宸叉湁鏁版嵁
      const allPoints = [...pastPoints, ...futurePoints];

      // 鐢╢allback濉ˉ缂哄け鐨勫勾浠?
      for (const point of fallbackPoints) {
        if (!existingYears.has(point.year)) {
          allPoints.push(point);
        }
      }

      chartPoints = allPoints.sort((a, b) => a.age - b.age);
      console.log(`[mergeAgentResults] K绾挎贩鍚堝悎骞? AI鏁版嵁${pastPoints.length + futurePoints.length}骞?+ Fallback琛ュ叏 = 鎬?{chartPoints.length}骞碻);
    } else {
      // 鏃爏keleton鏁版嵁锛屽彧鑳界敤鐜版湁鏁版嵁
      chartPoints = [...pastPoints, ...futurePoints].sort((a, b) => a.age - b.age);
      console.warn(`[mergeAgentResults] 鏃爏keleton鏁版嵁锛屼粎浣跨敤閮ㄥ垎K绾? ${chartPoints.length}骞碻);
    }

  } else if (skeletonData) {
    // 涓ゆK绾块兘澶辫触锛屽畬鍏ㄤ娇鐢ㄩ檷绾х畻娉?
    console.log('[mergeAgentResults] K绾緼gent鍏ㄩ儴澶辫触锛屼娇鐢ㄥ畬鏁撮檷绾х畻娉曠敓鎴怟绾挎暟鎹?);
    chartPoints = generateFallbackKLine(skeletonData);
  }

  // 鏈€缁堟暟鎹獙璇侊細纭繚鏁版嵁鐐规暟閲忚冻澶燂紙鑷冲皯50骞达級
  const MIN_CHART_POINTS = 50;
  if (chartPoints.length < MIN_CHART_POINTS && skeletonData) {
    console.warn(`[mergeAgentResults] K绾挎暟鎹笉瓒?${chartPoints.length}鐐?< ${MIN_CHART_POINTS}鐐?锛屼娇鐢ㄥ畬鏁磃allback鏇挎崲`);
    chartPoints = generateFallbackKLine(skeletonData);
    console.log(`[mergeAgentResults] Fallback鐢熸垚瀹屾垚: ${chartPoints.length}骞碻);
  }

  // 鍚堝苟杩囧幓鍜屾湭鏉ョ殑鍏抽敭浜嬩欢
  const pastEvents = kline_past?.pastEvents || core?.pastEvents || [];
  const futureEvents = kline_future?.futureEvents || core?.futureEvents || [];
  const keyYears = [
    ...(kline_past?.keyYears || []),
    ...(kline_future?.keyYears || [])
  ].sort((a, b) => a.year - b.year);

  return {
    // 鍩虹淇℃伅
    bazi: core?.bazi || [],
    summary: core?.summary || '鍛界悊鍒嗘瀽瀹屾垚',
    summaryScore: core?.summaryScore || 5,

    // 鏍稿績Agent - 鎬ф牸/鍏翰/椋庢按
    personality: core?.personality || '',
    personalityScore: core?.personalityScore || 5,
    family: core?.family || '',
    familyScore: core?.familyScore || 5,
    fengShui: core?.fengShui || '',
    fengShuiScore: core?.fengShuiScore || 5,

    // 涓汉鐗瑰緛
    appearance: core?.appearance || '',
    bodyType: core?.bodyType || '',
    skin: core?.skin || '',
    characterSummary: core?.characterSummary || '',

    // 浜嬩笟Agent - 浣跨敤fallback濡傛灉鍘熸暟鎹己澶?
    industry: career?.industry || careerFallback?.industry || '鏆傛棤浜嬩笟鍒嗘瀽锛岃绋嶅悗閲嶈瘯',
    industryScore: career?.industryScore || careerFallback?.industryScore || 5,
    wealth: career?.wealth || careerFallback?.wealth || '鏆傛棤璐㈠瘜鍒嗘瀽锛岃绋嶅悗閲嶈瘯',
    wealthScore: career?.wealthScore || careerFallback?.wealthScore || 5,

    // 濠氬Щ鍋ュ悍Agent
    marriage: marriage?.marriage || '',
    marriageScore: marriage?.marriageScore || 5,
    health: marriage?.health || '',
    healthScore: marriage?.healthScore || 5,
    healthBodyParts: marriage?.healthBodyParts || [],

    // 甯佸湀Agent
    crypto: crypto?.crypto || '',
    cryptoScore: crypto?.cryptoScore || 5,
    cryptoYear: crypto?.cryptoYear || '寰呭畾',
    cryptoStyle: crypto?.cryptoStyle || '鐜拌揣瀹氭姇',

    // K绾緼gent - 浣跨敤宸茶绠楃殑chartPoints锛堝惈闄嶇骇閫昏緫锛?
    chartPoints: chartPoints,

    // 杩愬娍棰勬祴
    monthlyFortune: core?.monthlyFortune || marriage?.monthlyFortune || '',
    monthlyHighlights: core?.monthlyHighlights || [],
    yearlyFortune: core?.yearlyFortune || career?.yearlyFortune || '',
    yearlyKeyEvents: core?.yearlyKeyEvents || career?.yearlyKeyEvents || [],

    // 骞歌繍鍏冪礌
    luckyColors: core?.luckyColors || [],
    luckyDirections: core?.luckyDirections || [],
    luckyZodiac: core?.luckyZodiac || [],
    luckyNumbers: core?.luckyNumbers || [],

    // 閲嶇偣鏃ユ湡鍜屼簨浠?
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

