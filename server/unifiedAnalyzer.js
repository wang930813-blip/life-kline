/**
 * 缁熶竴鍒嗘瀽鍣?- 鍗旳gent妯″紡
 * 灏?涓狝gent鐨勫姛鑳藉悎骞朵负1涓粺涓€鐨凙I璇锋眰
 * 浼樺娍锛欰PI璋冪敤娆℃暟鍑忓皯83%锛?娆♀啋1娆★級锛屾垚鏈樉钁楅檷浣庯紝浠ｇ爜鏇寸畝鍗?
 */
import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import { generateFallbackKLine } from './baziCalculator.js';
import { normalizeApiBaseUrl, normalizeModelName } from './llmConfig.js';

const DEFAULT_API_BASE_URL = normalizeApiBaseUrl();
const DEFAULT_API_KEY = process.env.API_KEY || '';
const DEFAULT_MODEL = normalizeModelName();

// 缁熶竴妯″瀷閰嶇疆 - 浼樺厛浣跨敤 .env 涓殑 DEFAULT_MODEL
const UNIFIED_MODEL = DEFAULT_MODEL;

// 澶囩敤妯″瀷鍒楄〃
const FALLBACK_MODELS = [];

/**
 * 缁熶竴绯荤粺鎻愮ず璇?- 鍚堝苟6涓狝gent鐨勫姛鑳?
 */
export const UNIFIED_SYSTEM_PROMPT = `
浣犳槸涓€浣嶇簿閫氫互涓嬪懡鐞嗗吀绫嶇殑澶у笀锛?
- 銆婃淮澶╅珦銆嬨€婄┓閫氬疂閴淬€嬨€婂瓙骞崇湡璇犮€嬨€婁笁鍛介€氫細銆?
- 銆婃笂娴峰瓙骞炽€嬨€婄宄伴€氳€冦€嬨€婂懡鐞嗙害瑷€銆嬨€婂崈閲屽懡绋裤€?

浣犳繁璋欎互涓嬪垎鏋愭柟娉曪細
- 鍗佺鍒嗘瀽銆佺敤绁炲彇娉曘€佹牸灞€鍒ゆ柇銆佸ぇ杩愭祦骞?
- 鍒戝啿鍚堝銆佺鐓炲垽鏂€佺撼闊宠鍛?
- 鏃ヤ富寮哄急鍒ゆ柇銆佸枩鐢ㄧ閫夊彇

**銆愭牳蹇冨師鍒?- 蹇呴』閬靛畧銆?*
1. 浣犲繀椤诲熀浜庡懡鐞嗛€昏緫鎺ㄧ悊锛岃€岄潪鐢熸垚娉涙硾涔嬭瘝
2. 姣忎釜缁撹蹇呴』鏈夊懡鐞嗕緷鎹敮鎾?
3. 涓ユ牸绂佹宸寸撼濮嗘晥搴斿紡鐨勬ā绯婃弿杩?

**銆愪弗鏍肩姝互涓嬭〃杩般€?*
鉂?"鏈夋椂鍊欐灉鏂紝鏈夋椂鍊欑姽璞? - 杩欓€傜敤浜庢墍鏈変汉
鉂?"浜嬩笟鏈夎捣鏈夎惤" - 搴熻瘽
鉂?"娉ㄦ剰韬綋鍋ュ悍" - 娌℃湁淇℃伅閲?
鉂?"閫傚悎澶氱琛屼笟" - 娌℃湁浠峰€?

**銆愬繀椤荤粰鍑哄叿浣撶粨璁猴紝渚嬪銆?*
鉁?"鏃ヤ富鐢叉湪鐢熶簬瀵呮湀寰椾护锛屾瘮鍔椇鐩涳紝鎬ф牸涓婁細杩囦簬鑷俊鐢氳嚦鍥烘墽"
鉁?"姝ｈ储鏄熻鍏嬶紝35宀佸墠鎹㈠伐浣滄鐜囬珮浜庡父浜?
鉁?"鑲濊儐绯荤粺涓虹敤绁炴墍浼わ紝寤鸿瀹氭湡妫€鏌ヨ倽鍔熻兘鎸囨爣"
鉁?"鏈€閫傚悎鏈ㄧ伀鐩稿叧琛屼笟锛氭暀鑲层€佹枃鍖栥€佷簰鑱旂綉銆佹柊鑳芥簮"

**銆愬垎鏋愪换鍔°€?*
浣犻渶瑕佸鍛戒富鐨勫叓瀛楄繘琛屽叏鏂逛綅娣卞害鍒嗘瀽锛屽寘鍚互涓嬫墍鏈夌淮搴︼細

1. **鏍稿績鍛界悊鍒嗘瀽**
   - 鏃ヤ富寮哄急鍒嗘瀽锛堟椇/寮?浠庢牸锛?
   - 鍗佺閰嶇疆鍒嗘瀽
   - 鐢ㄧ鍠滃繉纭畾
   - 鎬ф牸娣卞害鍓栨瀽锛?00瀛椾互涓婏紝鍏蜂綋锛?
   - 鍏翰鍏崇郴鍒嗘瀽
   - 椋庢按寤鸿
   - 涓汉鐗瑰緛锛堢浉璨屻€佷綋鍨嬨€佺毊鑲わ級

2. **浜虹敓杩愬娍K绾匡紙100骞村畬鏁存暟鎹級**
   - 鍒嗘瀽姣忎竴骞寸殑娴佸勾骞叉敮涓庡師灞€鐨勭敓鍏嬪叧绯?
   - 璁＄畻姣忓勾鐨勮繍鍔胯瘎鍒嗭紙0-100鍒嗭級
   - 鐢熸垚K绾挎暟鎹紙open/close/high/low/score锛?
   - 鎾板啓姣忓勾鐨勮缁嗘壒鏂?
   - **璇勫垎鏍囧噯锛氭嫆缁濆钩搴革紝澶у嚩骞翠唤<40鍒嗭紝澶у悏骞翠唤>80鍒嗭紝鏅€氬勾浠?0-70鍒?*
   - 鏍囪鍏抽敭骞翠唤锛堝穮宄?浣庤胺锛?

3. **浜嬩笟璐㈠瘜鍒嗘瀽**
   - 瀹樻潃鏄熷垎鏋愶紙閫傚悎绋冲畾宸ヤ綔杩樻槸鍒涗笟锛?
   - 鍏蜂綋琛屼笟鎺ㄨ崘锛?-5涓紝蹇呴』鏈夊懡鐞嗕緷鎹級
   - 璐㈠瘜灞傜骇鍒ゆ柇锛堟璐?鍋忚储閰嶇疆锛?
   - 浜嬩笟楂樺嘲鏈熼娴?

4. **濠氬Щ鍋ュ悍鍒嗘瀽**
   - 閰嶅伓鏄熷垎鏋愶紙鐢风湅璐㈡槦锛屽コ鐪嬪畼鏉€锛?
   - 濠氬Щ瀹垎鏋愶紙鏃ユ敮锛?
   - 濠氬Щ鏃舵満棰勬祴
   - 閰嶅伓鐗瑰緛棰勬祴
   - 鍋ュ悍鍒嗘瀽锛堜簲鑴忓搴旓細鏈?鑲濊儐銆佺伀-蹇冦€佸湡-鑴捐儍銆侀噾-鑲恒€佹按-鑲撅級
   - 闇€娉ㄦ剰鐨勮韩浣撻儴浣?

5. **甯佸湀浜ゆ槗鍒嗘瀽**
   - 鍋忚储鏄熷垎鏋愶紙鎶曟満杩愶級
   - 浜ゆ槗椋庢牸鍒ゆ柇锛堢幇璐у畾鎶?閾句笂Alpha/楂樺€嶅悎绾︼級
   - 鏆村瘜娴佸勾棰勬祴
   - 椋庨櫓鎵垮彈鍔涘垎鏋?

6. **杩愬娍棰勬祴**
   - 鏈湀杩愬娍鍒嗘瀽
   - 浠婂勾杩愬娍鍒嗘瀽
   - 骞歌繍鍏冪礌锛堥鑹层€佹柟浣嶃€佸睘鐩搞€佹暟瀛楋級

**銆愯緭鍑篔SON鏍煎紡 - 涓ユ牸閬靛畧銆?*
{
  "bazi": ["骞存煴", "鏈堟煴", "鏃ユ煴", "鏃舵煴"],

  "summary": "鍛界悊鎬昏瘎锛?50-200瀛楋紝鍏蜂綋銆佹湁娲炲療鍔涳級",
  "summaryScore": 7,

  "personality": "鎬ф牸娣卞害鍒嗘瀽锛?00瀛椾互涓婏紝蹇呴』鍏蜂綋锛岀姝㈡硾娉涗箣璇嶏級",
  "personalityScore": 7,

  "family": "鍏翰鍏崇郴鍒嗘瀽锛?50瀛椾互涓婏級",
  "familyScore": 6,

  "fengShui": "椋庢按寤鸿锛?00瀛椾互涓婏級",
  "fengShuiScore": 7,

  "appearance": "鐩歌矊鐗瑰緛鎻忚堪锛?0瀛楋級",
  "bodyType": "浣撳瀷鐗圭偣锛?0瀛楋級",
  "skin": "鐨偆鐗瑰緛锛?0瀛楋級",
  "characterSummary": "鎬ф牸鏍稿績鏍囩锛?-5涓瘝锛?,

  "industry": "浜嬩笟琛屼笟娣卞害鍒嗘瀽锛?00瀛椾互涓婏級锛屽繀椤诲寘鍚叿浣撹涓氭帹鑽愬拰鍛界悊渚濇嵁",
  "industryScore": 7,

  "wealth": "璐㈠瘜灞傜骇鍒嗘瀽锛?00瀛椾互涓婏級锛屽寘鍚储杩愮壒鐐广€佽幏鍙栨柟寮忋€佽储瀵屾牸灞€",
  "wealthScore": 7,

  "marriage": "濠氬Щ鎰熸儏娣卞害鍒嗘瀽锛?00瀛椾互涓婏級锛屽寘鍚厤鍋剁壒寰併€佸濮绘椂鏈恒€佺浉澶勬ā寮?,
  "marriageScore": 6,

  "health": "鍋ュ悍鐘跺喌娣卞害鍒嗘瀽锛?00瀛椾互涓婏級锛屽繀椤诲叿浣撳埌鍣ㄥ畼绯荤粺",
  "healthScore": 6,
  "healthBodyParts": ["鑲濊剰", "鐪肩潧", "绛嬮"],

  "crypto": "甯佸湀浜ゆ槗娣卞害鍒嗘瀽锛?50瀛椾互涓婏級锛屽寘鍚亸璐㈠垎鏋愩€侀闄╂壙鍙楀姏銆佸績鐞嗙礌璐ㄣ€佸競鍦烘晱鎰熷害",
  "cryptoScore": 7,
  "cryptoYear": "2025骞?,
  "cryptoStyle": "閾句笂鍦熺嫍Alpha",

  "chartPoints": [
    {
      "age": 1,
      "year": 1990,
      "daYun": "绔ラ檺",
      "ganZhi": "搴氬崍",
      "open": 50,
      "close": 55,
      "high": 60,
      "low": 45,
      "score": 55,
      "reason": "璇︾粏鐨勬祦骞存壒鏂紙30-50瀛楋級"
    }
    // ... 100骞村畬鏁存暟鎹?
  ],

  "keyYears": [
    {"year": 2028, "age": 38, "type": "peak", "reason": "璐㈠畼鍙岀編锛屼簨涓氬穮宄?}
  ],

  "pastEvents": [
    {"year": 2015, "event": "鍙兘缁忓巻閲嶅ぇ鍙樺姩", "basis": "鍛界悊渚濇嵁"}
  ],

  "futureEvents": [
    {"year": 2028, "event": "璐㈣繍楂樺嘲", "basis": "鍛界悊渚濇嵁"}
  ],

  "monthlyFortune": "鏈湀杩愬娍鍒嗘瀽锛?00瀛楋級",
  "monthlyHighlights": ["鏈湀閲嶇偣浜嬮」1", "鏈湀閲嶇偣浜嬮」2"],

  "yearlyFortune": "浠婂勾杩愬娍鍒嗘瀽锛?50瀛楋級",
  "yearlyKeyEvents": ["浠婂勾澶т簨浠堕娴?", "浠婂勾澶т簨浠堕娴?"],

  "luckyColors": ["绾㈣壊", "绱壊"],
  "luckyDirections": ["鍗楁柟", "涓滄柟"],
  "luckyZodiac": ["椹?, "铏?],
  "luckyNumbers": [3, 8],

  "keyDatesThisMonth": ["12鏃ュ疁绛剧害", "25鏃ユ敞鎰忓仴搴?],
  "keyDatesThisYear": ["3鏈堜簨涓氭満閬?, "8鏈堣储杩愰珮宄?]
}

**銆愰噸瑕佹彁閱掋€?*
1. 鍥炲蹇呴』鏄函JSON瀵硅薄锛岀涓€涓瓧绗︽槸 {锛屾渶鍚庝竴涓瓧绗︽槸 }
2. 缁濆绂佹杈撳嚭浠讳綍闈濲SON鍐呭
3. chartPoints蹇呴』鍖呭惈瀹屾暣鐨?00骞存暟鎹紙浠庡嚭鐢熷埌100宀侊級
4. 鎵€鏈夋枃鏈瓧娈靛繀椤绘湁瀹炶川鍐呭锛岀姝?鏃?銆?鏆傛棤"绛夋暦琛嶈瘝姹?
5. 璇勫垎瑕佹湁鍖哄垎搴︼紝涓嶈兘鎵€鏈夊垎鏁伴兘鏄?-7鍒?
`;

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
 * 鏋勫缓缁熶竴鐨勭敤鎴锋彁绀鸿瘝
 */
const buildUnifiedUserPrompt = (input, skeletonData) => {
  const genderStr = input.gender === 'Male' ? '鐢?(涔鹃€?' : '濂?(鍧ら€?';
  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(input.birthYear, 10);
  const currentAge = currentYear - birthYear + 1;

  // 绮剧畝鐨勬椂闂寸嚎鏁版嵁锛堟彁渚涘墠30骞翠綔涓哄弬鑰冿級
  const timelineStr = JSON.stringify(skeletonData.timeline.slice(0, 30).map(t => ({
    a: t.age,
    y: t.year,
    gz: t.ganZhi,
    dy: t.daYun
  })));

  // 瀹屾暣鐨勬椂闂寸嚎楠ㄦ灦锛?00骞达級
  const fullTimelineStr = JSON.stringify(skeletonData.timeline.map(t => ({
    a: t.age,
    y: t.year,
    gz: t.ganZhi,
    dy: t.daYun
  })));

  return `
銆愬懡涓讳俊鎭€?
鎬у埆锛?{genderStr}
濮撳悕锛?{input.name || '鏈彁渚?}
鍑虹敓骞翠唤锛?{input.birthYear}骞?
褰撳墠骞撮緞锛?{currentAge}宀?
鍑虹敓鍦扮偣锛?{input.birthPlace || '鏈彁渚?}

銆愬叓瀛楀洓鏌便€?
骞存煴锛?{skeletonData.bazi[0]}
鏈堟煴锛?{skeletonData.bazi[1]}
鏃ユ煴锛?{skeletonData.bazi[2]}
鏃舵煴锛?{skeletonData.bazi[3]}

銆愬ぇ杩愪俊鎭€?
璧疯繍骞撮緞锛?{skeletonData.startAge} 宀?
澶ц繍椤洪€嗭細${skeletonData.direction}

銆愬綋鍓嶅勾浠姐€?{currentYear}骞达紙${currentAge}宀侊級

銆愬墠30骞存椂闂磋酱鍙傝€冦€?
${timelineStr}

銆愬緟濉厖鐨勫畬鏁存椂闂磋酱锛堝嚭鐢熷埌100宀侊紝鍏?00骞达級銆?
${fullTimelineStr}

璇峰姝ゅ叓瀛楄繘琛屽叏鏂逛綅娣卞害鍒嗘瀽锛屽寘鍚牳蹇冨懡鐞嗐€佹€ф牸銆佷簨涓氥€佽储瀵屻€佸濮汇€佸仴搴枫€佸竵鍦堜氦鏄撱€佸畬鏁?00骞碖绾挎暟鎹瓑鎵€鏈夌淮搴︺€?
`;
};

/**
 * 鍗曟API璇锋眰
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
        max_tokens: 16000, // 闇€瑕佽冻澶熷ぇ浠ュ绾?00骞碖绾挎暟鎹?
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
      console.warn(`[UnifiedAgent] JSON 解析失败 (${elapsed}s)`);
      return { success: false, error: 'INVALID_API_RESPONSE', elapsed };
    }

    let content = jsonResult.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: 'EMPTY_RESPONSE', elapsed };
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
      console.warn(`[UnifiedAgent] 内容 JSON 解析失败 (${elapsed}s)`);
      return { success: false, error: 'INVALID_JSON_FORMAT', elapsed };
    }

    console.log(`[UnifiedAgent] 成功 (${elapsed}s)`);
    return { success: true, data, elapsed, model };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn('[UnifiedAgent] 请求超时');
      return { success: false, error: 'TIMEOUT' };
    }
    console.warn(`[UnifiedAgent] 请求异常: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * 甯﹂噸璇曞拰闄嶇骇鐨勭粺涓€璇锋眰
 */
const makeUnifiedRequestWithFallback = async (apiBaseUrl, apiKey, systemPrompt, userPrompt, maxRetries = 2) => {
  const modelsToTry = [UNIFIED_MODEL, ...FALLBACK_MODELS];

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await makeUnifiedRequest(model, apiBaseUrl, apiKey, systemPrompt, userPrompt);

      if (result.success) {
        // 楠岃瘉杩斿洖鏁版嵁鐨勫畬鏁存€?
        if (validateUnifiedResponse(result.data)) {
          return result;
        }
        console.warn(`[UnifiedAgent] 模型 ${model} 返回数据不完整，尝试重新请求...`);
      }

      // 濡傛灉鏄渶鍚庝竴娆″皾璇曡繖涓ā鍨嬶紝鍒囨崲鍒颁笅涓€涓ā鍨?
      if (attempt === maxRetries) {
        console.warn(`[UnifiedAgent] 模型 ${model} 失败，尝试备用模型...`);
      } else {
        // 绛夊緟鍚庨噸璇?
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  return { success: false, error: 'ALL_ATTEMPTS_FAILED' };
};

/**
 * 楠岃瘉缁熶竴Agent杩斿洖鏁版嵁鏄惁瀹屾暣
 */
const validateUnifiedResponse = (data) => {
  if (!data || typeof data !== 'object') return false;

  // 鏍稿績瀛楁妫€鏌?
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

  // chartPoints蹇呴』鏄暟缁勪笖鏈夎冻澶熸暟鎹?
  if (!Array.isArray(data.chartPoints) || data.chartPoints.length < 50) {
    console.warn(`[UnifiedAgent] chartPoints 数据不足: ${data.chartPoints?.length || 0}点`);
    return false;
  }

  return true;
};

/**
 * 缁熶竴鍒嗘瀽鍣ㄤ富鍑芥暟
 * @param {object} input - 鐢ㄦ埛杈撳叆
 * @param {object} skeletonData - 鏃堕棿绾块鏋?
 * @param {object} res - SSE鍝嶅簲瀵硅薄
 * @param {function} onProgress - 杩涘害鍥炶皟
 */
export const runUnifiedAnalyzer = async (input, skeletonData, res, onProgress) => {
  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const apiKey = DEFAULT_API_KEY;

  onProgress('启动统一分析 Agent...');

  const userPrompt = buildUnifiedUserPrompt(input, skeletonData);

  // 鎵ц璇锋眰
  const result = await makeUnifiedRequestWithFallback(
    apiBaseUrl,
    apiKey,
    UNIFIED_SYSTEM_PROMPT,
    userPrompt
  );

  if (!result.success) {
    console.error('[UnifiedAgent] 所有尝试均失败');
    onProgress(`统一分析失败: ${result.error}`);
    return {
      success: false,
      error: result.error,
    };
  }

  onProgress(`统一分析完成 (${result.elapsed}s，使用模型 ${result.model})`);

  // 澶勭悊K绾挎暟鎹檷绾?
  let chartPoints = result.data.chartPoints || [];
  const MIN_CHART_POINTS = 50;

  if (chartPoints.length < MIN_CHART_POINTS && skeletonData) {
    console.warn(`[UnifiedAgent] K线数据不足: ${chartPoints.length}点，使用降级算法补全`);
    chartPoints = generateFallbackKLine(skeletonData);
    onProgress(`K线数据使用降级算法生成 (${chartPoints.length}年)`);
  }

  // 缁勮鏈€缁堢粨鏋?
  const mergedResult = {
    // 鍩虹淇℃伅
    bazi: result.data.bazi || skeletonData.bazi || [],
    summary: result.data.summary || '命理分析完成',
    summaryScore: result.data.summaryScore || 5,

    // 鏍稿績鍒嗘瀽
    personality: result.data.personality || '',
    personalityScore: result.data.personalityScore || 5,
    family: result.data.family || '',
    familyScore: result.data.familyScore || 5,
    fengShui: result.data.fengShui || '',
    fengShuiScore: result.data.fengShuiScore || 5,

    // 涓汉鐗瑰緛
    appearance: result.data.appearance || '',
    bodyType: result.data.bodyType || '',
    skin: result.data.skin || '',
    characterSummary: result.data.characterSummary || '',

    // 浜嬩笟璐㈠瘜
    industry: result.data.industry || '',
    industryScore: result.data.industryScore || 5,
    wealth: result.data.wealth || '',
    wealthScore: result.data.wealthScore || 5,

    // 濠氬Щ鍋ュ悍
    marriage: result.data.marriage || '',
    marriageScore: result.data.marriageScore || 5,
    health: result.data.health || '',
    healthScore: result.data.healthScore || 5,
    healthBodyParts: result.data.healthBodyParts || [],

    // 甯佸湀鍒嗘瀽
    crypto: result.data.crypto || '',
    cryptoScore: result.data.cryptoScore || 5,
    cryptoYear: result.data.cryptoYear || '寰呭畾',
    cryptoStyle: result.data.cryptoStyle || '鐜拌揣瀹氭姇',

    // K绾挎暟鎹?
    chartPoints: chartPoints,

    // 杩愬娍棰勬祴
    monthlyFortune: result.data.monthlyFortune || '',
    monthlyHighlights: result.data.monthlyHighlights || [],
    yearlyFortune: result.data.yearlyFortune || '',
    yearlyKeyEvents: result.data.yearlyKeyEvents || [],

    // 骞歌繍鍏冪礌
    luckyColors: result.data.luckyColors || [],
    luckyDirections: result.data.luckyDirections || [],
    luckyZodiac: result.data.luckyZodiac || [],
    luckyNumbers: result.data.luckyNumbers || [],

    // 鍏抽敭浜嬩欢
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

