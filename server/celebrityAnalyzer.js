/**
 * 鍚嶄汉鍛界悊鍒嗘瀽鍣?
 * 浣跨敤LLM涓哄悕浜?浼佷笟鐢熸垚娣卞害鍏瓧鍒嗘瀽鎶ュ憡
 */
import fetch from 'node-fetch';
import { AGENT_CELEBRITY_ANALYSIS_PROMPT } from './agentPrompts.js';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_API_KEY = process.env.API_KEY || ''; // 闇€瑕佸湪 .env 涓厤缃?

// 鍚嶄汉鍒嗘瀽浣跨敤鐨勬ā鍨?- 闇€瑕侀珮璐ㄩ噺杈撳嚭
const CELEBRITY_ANALYSIS_MODEL = process.env.DEFAULT_MODEL || 'gpt-4';
const FALLBACK_MODELS = []; 

/**
 * 鏋勫缓鍚嶄汉鍒嗘瀽鐨勭敤鎴锋彁绀鸿瘝
 * @param {object} celebrity - 鍚嶄汉鏁版嵁瀵硅薄
 */
function buildCelebrityPrompt(celebrity) {
  const birthDate = new Date(celebrity.birthDate || celebrity.birth_date);
  const birthYear = birthDate.getFullYear();
  const birthMonth = birthDate.getMonth() + 1;
  const birthDay = birthDate.getDate();
  const birthHour = birthDate.getHours();

  const isCompany = celebrity.category === 'corporate_fate' ||
                    celebrity.category === 'ai_tech' ||
                    celebrity.category === 'crypto_macro';

  return `
銆?{isCompany ? '浼佷笟/椤圭洰' : '鍚嶄汉'}淇℃伅銆?
鍚嶇О: ${celebrity.nameCn || celebrity.name_cn} (${celebrity.name})
绫诲埆: ${celebrity.categoryCn || celebrity.category_cn}
${isCompany ? '鎴愮珛' : '鍑虹敓'}鏃ユ湡: ${birthYear}骞?{birthMonth}鏈?{birthDay}鏃?${birthHour}鏃?
${isCompany ? '鎬婚儴' : '鍑虹敓'}鍦扮偣: ${celebrity.birthLocation?.city || celebrity.birth_location_city || '鏈煡'}

銆愬叓瀛楀洓鏌便€?
骞存煴: ${celebrity.yearPillar || celebrity.year_pillar}
鏈堟煴: ${celebrity.monthPillar || celebrity.month_pillar}
鏃ユ煴: ${celebrity.dayPillar || celebrity.day_pillar}
鏃舵煴: ${celebrity.hourPillar || celebrity.hour_pillar}

銆愬凡鏈夋弿杩般€?
${celebrity.description}

銆愭爣绛俱€?
${(celebrity.tags || []).join(', ')}

銆愬垎鏋愯姹傘€?
璇蜂负姝?{isCompany ? '浼佷笟/椤圭洰' : '鍚嶄汉'}鐢熸垚娣卞害鍏瓧鍛界悊鍒嗘瀽鎶ュ憡銆?
${isCompany ? '娉ㄦ剰锛氫紒涓氬叓瀛椾互鎴愮珛鏃ユ湡涓哄噯锛屽垎鏋愬叾鍙戝睍杩愬娍銆? : ''}
鍒嗘瀽闇€瑕佸熀浜庣湡瀹炵殑鍛界悊閫昏緫锛屾瘡涓淮搴﹁嚦灏?00瀛楋紝蹇呴』鏈夊懡鐞嗕緷鎹敮鎾戙€?
`;
}

/**
 * 瑙ｆ瀽LLM鍝嶅簲涓殑JSON
 * @param {string} content - LLM杩斿洖鐨勫唴瀹?
 */
function parseAnalysisResponse(content) {
  try {
    // 娓呯悊鍐呭
    let cleaned = content.trim();
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    cleaned = cleaned.replace(/^[\s\S]*?(?=\{)/m, '');

    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[celebrityAnalyzer] JSON瑙ｆ瀽澶辫触:', error.message);
    console.error('[celebrityAnalyzer] 鍘熷鍐呭鍓?00瀛?', content.substring(0, 500));
    return null;
  }
}

/**
 * 楠岃瘉鍒嗘瀽缁撴灉鏄惁瀹屾暣
 * @param {object} result - 瑙ｆ瀽鍚庣殑鍒嗘瀽缁撴灉
 */
function validateAnalysisResult(result) {
  if (!result || typeof result !== 'object') return false;

  const { analysisData, scores } = result;

  // 妫€鏌ュ繀瑕佺殑鍒嗘瀽瀛楁
  const requiredAnalysisFields = ['summary', 'personality', 'career', 'wealth', 'marriage', 'health'];
  for (const field of requiredAnalysisFields) {
    if (!analysisData?.[field] || analysisData[field].length < 100) {
      console.warn(`[celebrityAnalyzer] 瀛楁 ${field} 缂哄け鎴栧唴瀹瑰お鐭?(${analysisData?.[field]?.length || 0}瀛?`);
      return false;
    }
  }

  // 妫€鏌ヨ瘎鍒嗗瓧娈?
  const requiredScoreFields = ['overall', 'personality', 'career', 'wealth', 'marriage', 'health'];
  for (const field of requiredScoreFields) {
    if (typeof scores?.[field] !== 'number' || scores[field] < 0 || scores[field] > 100) {
      console.warn(`[celebrityAnalyzer] 璇勫垎瀛楁 ${field} 鏃犳晥: ${scores?.[field]}`);
      return false;
    }
  }

  return true;
}

/**
 * 璋冪敤LLM API鐢熸垚鍒嗘瀽
 * @param {string} model - 妯″瀷鍚嶇О
 * @param {string} userPrompt - 鐢ㄦ埛鎻愮ず璇?
 * @param {number} timeoutMs - 瓒呮椂鏃堕棿
 */
async function callLLMApi(model, userPrompt, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[celebrityAnalyzer] 浣跨敤妯″瀷 ${model} 寮€濮嬬敓鎴愬垎鏋?..`);
    const startTime = Date.now();

    const response = await fetch(`${DEFAULT_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEFAULT_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: AGENT_CELEBRITY_ANALYSIS_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    clearTimeout(timeoutId);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[celebrityAnalyzer] API璇锋眰澶辫触 (${elapsed}s): ${response.status} - ${errText.substring(0, 200)}`);
      return { success: false, error: `HTTP ${response.status}`, elapsed };
    }

    const responseJson = await response.json();
    const content = responseJson.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'EMPTY_RESPONSE', elapsed };
    }

    const parsed = parseAnalysisResponse(content);
    if (!parsed) {
      return { success: false, error: 'PARSE_ERROR', elapsed };
    }

    if (!validateAnalysisResult(parsed)) {
      return { success: false, error: 'VALIDATION_ERROR', data: parsed, elapsed };
    }

    console.log(`[celebrityAnalyzer] 鉁?鍒嗘瀽鐢熸垚鎴愬姛 (${elapsed}s)`);
    return { success: true, data: parsed, elapsed, model };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[celebrityAnalyzer] 璇锋眰瓒呮椂`);
      return { success: false, error: 'TIMEOUT' };
    }
    console.warn(`[celebrityAnalyzer] 璇锋眰寮傚父: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 涓哄悕浜虹敓鎴愬畬鏁寸殑鍛界悊鍒嗘瀽
 * @param {object} celebrity - 鍚嶄汉鏁版嵁瀵硅薄
 * @param {object} options - 閫夐」
 * @returns {Promise<object>} 鍒嗘瀽缁撴灉
 */
export async function generateCelebrityAnalysis(celebrity, options = {}) {
  const { maxRetries = 2 } = options;
  const userPrompt = buildCelebrityPrompt(celebrity);
  const modelsToTry = [CELEBRITY_ANALYSIS_MODEL, ...FALLBACK_MODELS];

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`[celebrityAnalyzer] 灏濊瘯妯″瀷 ${model} (绗?{attempt}娆?...`);

      const result = await callLLMApi(model, userPrompt);

      if (result.success) {
        return {
          success: true,
          analysisData: result.data.analysisData,
          scores: result.data.scores,
          financialData: result.data.financialData || null,
          honors: result.data.honors || [],
          generatedAt: new Date().toISOString(),
          model: result.model,
          elapsed: result.elapsed,
        };
      }

      // 濡傛灉鏈夐儴鍒嗘暟鎹絾楠岃瘉澶辫触锛屽皾璇曚娇鐢?
      if (result.error === 'VALIDATION_ERROR' && result.data) {
        console.warn(`[celebrityAnalyzer] 鏁版嵁楠岃瘉澶辫触浣嗘湁閮ㄥ垎鏁版嵁锛屽皾璇曡ˉ鍏?..`);
        const partialData = result.data;
        // 濉厖缂哄け鐨勯粯璁ゅ€?
        partialData.scores = partialData.scores || {
          overall: 60, personality: 60, career: 60, wealth: 60, marriage: 60, health: 60
        };
        partialData.analysisData = partialData.analysisData || {};

        return {
          success: true,
          analysisData: partialData.analysisData,
          scores: partialData.scores,
          financialData: partialData.financialData || null,
          honors: partialData.honors || [],
          generatedAt: new Date().toISOString(),
          model: model,
          elapsed: result.elapsed,
          partial: true,
        };
      }

      if (attempt < maxRetries) {
        console.log(`[celebrityAnalyzer] 绛夊緟1.5绉掑悗閲嶈瘯...`);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    console.warn(`[celebrityAnalyzer] 妯″瀷 ${model} 鎵€鏈夊皾璇曞け璐ワ紝鍒囨崲澶囩敤妯″瀷...`);
  }

  return {
    success: false,
    error: 'ALL_MODELS_FAILED',
    message: '鎵€鏈夋ā鍨嬪潎鏃犳硶鐢熸垚鏈夋晥鍒嗘瀽',
  };
}

/**
 * 鎵归噺鐢熸垚鍚嶄汉鍒嗘瀽锛堢敤浜庡悗鍙颁换鍔★級
 * @param {Array} celebrities - 鍚嶄汉鏁版嵁鏁扮粍
 * @param {function} onProgress - 杩涘害鍥炶皟
 */
export async function batchGenerateCelebrityAnalysis(celebrities, onProgress) {
  const results = [];
  const total = celebrities.length;

  for (let i = 0; i < total; i++) {
    const celebrity = celebrities[i];
    console.log(`[celebrityAnalyzer] 鎵归噺鐢熸垚杩涘害: ${i + 1}/${total} - ${celebrity.nameCn || celebrity.name_cn}`);

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        celebrity: celebrity.nameCn || celebrity.name_cn,
        status: 'processing',
      });
    }

    const result = await generateCelebrityAnalysis(celebrity);
    results.push({
      id: celebrity.id,
      name: celebrity.nameCn || celebrity.name_cn,
      ...result,
    });

    // 姣忔璇锋眰鍚庣瓑寰?绉掞紝閬垮厤API闄愭祦
    if (i < total - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return results;
}

export default {
  generateCelebrityAnalysis,
  batchGenerateCelebrityAnalysis,
};

