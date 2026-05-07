/**
 * 八字分析缓存管理器
 * 实现永久缓存策略，同一八字返回相同核心结论
 */
import crypto from 'crypto';
import { getDb, nowIso } from './database.js';

/**
 * 计算八字哈希值
 * @param {string} yearPillar - 年柱
 * @param {string} monthPillar - 月柱
 * @param {string} dayPillar - 日柱
 * @param {string} hourPillar - 时柱
 * @returns {string} 16位哈希值
 */
export const computeBaziHash = (yearPillar, monthPillar, dayPillar, hourPillar) => {
  const combined = `${yearPillar}|${monthPillar}|${dayPillar}|${hourPillar}`;
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
};

/**
 * 获取缓存的核心分析结果
 * @param {string} baziHash - 八字哈希
 * @param {string} gender - 性别 (male/female)
 * @returns {object|null} 缓存的分析结果或null
 */
export const getCachedAnalysis = (baziHash, gender) => {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM bazi_analysis_cache
    WHERE bazi_hash = ? AND gender = ?
  `);

  const row = stmt.get(baziHash, gender);
  if (!row) return null;

  return {
    id: row.id,
    baziHash: row.bazi_hash,
    gender: row.gender,
    // 结构数据
    structuralData: JSON.parse(row.structural_data || '{}'),
    // 命理骨架
    personalityCore: JSON.parse(row.personality_core || '{}'),
    careerCore: JSON.parse(row.career_core || '{}'),
    wealthCore: JSON.parse(row.wealth_core || '{}'),
    marriageCore: JSON.parse(row.marriage_core || '{}'),
    healthCore: JSON.parse(row.health_core || '{}'),
    // K线数据
    klineData: JSON.parse(row.kline_data || '[]'),
    peakYears: JSON.parse(row.peak_years || '[]'),
    troughYears: JSON.parse(row.trough_years || '[]'),
    // 新增分析维度
    cryptoCore: JSON.parse(row.crypto_core || '{}'),
    monthlyFortune: JSON.parse(row.monthly_fortune || '{}'),
    yearlyFortune: JSON.parse(row.yearly_fortune || '{}'),
    luckyElements: JSON.parse(row.lucky_elements || '{}'),
    physicalTraits: JSON.parse(row.physical_traits || '{}'),
    keyDates: JSON.parse(row.key_dates || '{}'),
    pastEvents: JSON.parse(row.past_events || '[]'),
    futureEvents: JSON.parse(row.future_events || '[]'),
    // 元数据
    modelUsed: row.model_used,
    version: row.version,
    createdAt: row.created_at,
  };
};

/**
 * 保存分析结果到缓存
 * @param {object} data - 分析数据
 */
export const cacheAnalysis = (data) => {
  const db = getDb();
  const id = `cache_${data.baziHash}_${data.gender}_${Date.now()}`;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO bazi_analysis_cache (
      id, bazi_hash, gender,
      structural_data, personality_core, career_core, wealth_core,
      marriage_core, health_core, kline_data, peak_years, trough_years,
      crypto_core, monthly_fortune, yearly_fortune, lucky_elements,
      physical_traits, key_dates, past_events, future_events,
      model_used, version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.baziHash,
    data.gender,
    JSON.stringify(data.structuralData || {}),
    JSON.stringify(data.personalityCore || {}),
    JSON.stringify(data.careerCore || {}),
    JSON.stringify(data.wealthCore || {}),
    JSON.stringify(data.marriageCore || {}),
    JSON.stringify(data.healthCore || {}),
    JSON.stringify(data.klineData || []),
    JSON.stringify(data.peakYears || []),
    JSON.stringify(data.troughYears || []),
    JSON.stringify(data.cryptoCore || {}),
    JSON.stringify(data.monthlyFortune || {}),
    JSON.stringify(data.yearlyFortune || {}),
    JSON.stringify(data.luckyElements || {}),
    JSON.stringify(data.physicalTraits || {}),
    JSON.stringify(data.keyDates || {}),
    JSON.stringify(data.pastEvents || []),
    JSON.stringify(data.futureEvents || []),
    data.modelUsed || 'unknown',
    data.version || 1,
    nowIso()
  );

  return id;
};

/**
 * 从完整分析结果中提取核心数据用于缓存
 * @param {object} analysisResult - AI返回的完整分析结果
 * @param {object} chartData - K线数据
 * @returns {object} 核心缓存数据
 */
export const extractCoreData = (analysisResult, chartData) => {
  // 找出巅峰年和低谷年
  const sortedByScore = [...(chartData || [])].sort((a, b) => b.score - a.score);
  const peakYears = sortedByScore.slice(0, 5).map(p => ({ year: p.year, age: p.age, score: p.score }));
  const troughYears = sortedByScore.slice(-5).reverse().map(p => ({ year: p.year, age: p.age, score: p.score }));

  return {
    structuralData: {
      bazi: analysisResult.bazi,
      summaryScore: analysisResult.summaryScore,
    },
    personalityCore: {
      content: analysisResult.personality,
      score: analysisResult.personalityScore,
    },
    careerCore: {
      content: analysisResult.industry,
      score: analysisResult.industryScore,
    },
    wealthCore: {
      content: analysisResult.wealth,
      score: analysisResult.wealthScore,
    },
    marriageCore: {
      content: analysisResult.marriage,
      score: analysisResult.marriageScore,
    },
    healthCore: {
      content: analysisResult.health,
      score: analysisResult.healthScore,
      bodyParts: analysisResult.healthBodyParts || [],
    },
    klineData: chartData,
    peakYears,
    troughYears,
    cryptoCore: {
      content: analysisResult.crypto,
      score: analysisResult.cryptoScore,
      cryptoYear: analysisResult.cryptoYear,
      cryptoStyle: analysisResult.cryptoStyle,
    },
    monthlyFortune: {
      content: analysisResult.monthlyFortune,
      highlights: analysisResult.monthlyHighlights || [],
    },
    yearlyFortune: {
      content: analysisResult.yearlyFortune,
      keyEvents: analysisResult.yearlyKeyEvents || [],
    },
    luckyElements: {
      colors: analysisResult.luckyColors || [],
      directions: analysisResult.luckyDirections || [],
      zodiac: analysisResult.luckyZodiac || [],
      numbers: analysisResult.luckyNumbers || [],
    },
    physicalTraits: {
      appearance: analysisResult.appearance,
      bodyType: analysisResult.bodyType,
      skin: analysisResult.skin,
      characterSummary: analysisResult.characterSummary,
    },
    keyDates: {
      thisYear: analysisResult.keyDatesThisYear || [],
      thisMonth: analysisResult.keyDatesThisMonth || [],
    },
    pastEvents: analysisResult.pastEvents || [],
    futureEvents: analysisResult.futureEvents || [],
  };
};

/**
 * 合并缓存数据和新生成的润色文字
 * @param {object} cachedData - 缓存的核心数据
 * @param {object} freshPolish - 新生成的文字润色（可选）
 * @returns {object} 最终分析结果
 */
export const mergeCachedWithFresh = (cachedData, freshPolish = null) => {
  // 如果没有新润色，直接返回缓存数据构建的结果
  const result = {
    bazi: cachedData.structuralData?.bazi || [],
    summary: freshPolish?.summary || cachedData.structuralData?.summary || '命理分析已从缓存加载',
    summaryScore: cachedData.structuralData?.summaryScore || 5,

    personality: cachedData.personalityCore?.content || '',
    personalityScore: cachedData.personalityCore?.score || 5,

    industry: cachedData.careerCore?.content || '',
    industryScore: cachedData.careerCore?.score || 5,

    wealth: cachedData.wealthCore?.content || '',
    wealthScore: cachedData.wealthCore?.score || 5,

    marriage: cachedData.marriageCore?.content || '婚姻情感详细内容暂未生成，建议结合现实沟通模式、责任分配与阶段运势综合判断。',
    marriageScore: cachedData.marriageCore?.score || 5,

    health: cachedData.healthCore?.content || '健康分析详细内容暂未生成。建议保持规律作息，并结合个人体质进行定期体检。',
    healthScore: cachedData.healthCore?.score || 5,
    healthBodyParts: cachedData.healthCore?.bodyParts || [],

    family: freshPolish?.family || cachedData.familyCore?.content || '六亲关系详细内容暂未生成，建议结合父母、伴侣、子女及合作关系的实际互动继续观察。',
    familyScore: cachedData.familyCore?.score || 5,

    fengShui: freshPolish?.fengShui || cachedData.fengShuiCore?.content || '发展风水详细内容暂未生成。可先以居住环境整洁、采光通风、动线舒展为基本开运原则。',
    fengShuiScore: cachedData.fengShuiCore?.score || 5,

    crypto: cachedData.cryptoCore?.content || '币圈交易详细内容暂未生成。投资风险较高，建议控制仓位、重视风控，避免情绪化交易。',
    cryptoScore: cachedData.cryptoCore?.score || 5,
    cryptoYear: cachedData.cryptoCore?.cryptoYear || '待定',
    cryptoStyle: cachedData.cryptoCore?.cryptoStyle || '现货定投',

    // 新增字段
    monthlyFortune: cachedData.monthlyFortune?.content || '',
    monthlyHighlights: cachedData.monthlyFortune?.highlights || [],

    yearlyFortune: cachedData.yearlyFortune?.content || '',
    yearlyKeyEvents: cachedData.yearlyFortune?.keyEvents || [],

    luckyColors: cachedData.luckyElements?.colors || [],
    luckyDirections: cachedData.luckyElements?.directions || [],
    luckyZodiac: cachedData.luckyElements?.zodiac || [],
    luckyNumbers: cachedData.luckyElements?.numbers || [],

    appearance: cachedData.physicalTraits?.appearance || '',
    bodyType: cachedData.physicalTraits?.bodyType || '',
    skin: cachedData.physicalTraits?.skin || '',
    characterSummary: cachedData.physicalTraits?.characterSummary || '',

    keyDatesThisYear: cachedData.keyDates?.thisYear || [],
    keyDatesThisMonth: cachedData.keyDates?.thisMonth || [],

    pastEvents: cachedData.pastEvents || [],
    futureEvents: cachedData.futureEvents || [],

    peakYears: cachedData.peakYears || [],
    troughYears: cachedData.troughYears || [],
  };

  return result;
};

/**
 * 检查缓存是否存在
 * @param {string} baziHash - 八字哈希
 * @param {string} gender - 性别
 * @returns {boolean}
 */
export const hasCachedAnalysis = (baziHash, gender) => {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM bazi_analysis_cache
    WHERE bazi_hash = ? AND gender = ?
  `);
  const row = stmt.get(baziHash, gender);
  return row.count > 0;
};

/**
 * 获取缓存统计信息
 * @returns {object} 缓存统计
 */
export const getCacheStats = () => {
  const db = getDb();
  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM bazi_analysis_cache');
  const total = totalStmt.get().count;

  const recentStmt = db.prepare(`
    SELECT COUNT(*) as count FROM bazi_analysis_cache
    WHERE created_at > datetime('now', '-24 hours')
  `);
  const recent = recentStmt.get().count;

  return { total, recentlyAdded: recent };
};

export default {
  computeBaziHash,
  getCachedAnalysis,
  cacheAnalysis,
  extractCoreData,
  mergeCachedWithFresh,
  hasCachedAnalysis,
  getCacheStats,
};
