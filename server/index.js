import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';
import crypto from 'crypto';

// 浣跨敤鏂扮殑 SQLite 鏁版嵁搴?
import {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserPoints,
  updateUserLogin,
  saveUserInput,
  saveAnalysis,
  getAnalysesByUserId,
  getAnalysisById,
  getAllUsers,
  getAllInputs,
  getAllAnalyses,
  getStats,
  logEvent,
  getSystemLogs,
  migrateFromJson,
  nowIso,
  createArticle,
  getArticleBySlug,
  getArticles,
  getAllArticlesAdmin,
  upsertArticle,
  getKnowledgeArticleCount,
  incrementArticleView,
  searchArticles,
  createCase,
  getCaseById,
  getCases,
  getAllCasesAdmin,
  upsertCase,
  getCaseCount,
  incrementCaseView,
  getDb,
  createShareReward,
  getUserShareRewards,
  getUserProfiles,
  createUserProfile,
  getUserProfileById,
  updateUserProfile,
  updateUserProfileCompat,
  deleteUserProfile,
  setDefaultProfile,
  getUserPreferences,
  updateUserPreferences,
  createUserPreferences,
  updateProfileCoreDocumentStatus,
  // 鏂板杩愬娍鐩稿叧鍑芥暟
  saveDailyFortuneDetail,
  getDailyFortuneDetail,
  hasDailyFortuneAiEnhanced,
  getFortuneCache,
  createFortuneCache,
  // 鐐瑰埜鍏戞崲
  createVoucher,
  getVoucher,
  redeemVoucher,
  // 鍚嶄汉妗堜緥
  getCelebrityCases,
  getTrendingCelebrityCases,
  getCelebrityCaseById,
  incrementCelebrityCaseView,
  // Email related
  createEmailSubscription,
  getEmailSubscription,
  updateEmailSubscription,
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  createPaymentOrder,
  getPaymentOrder,
  getPaymentOrders,
  markPaymentOrderPaid,
  markPaymentOrderFailed,
  updatePaymentOrderPayInfo,
} from './database.js';
import { hashPassword, verifyPassword, signToken, requireAuth, getTokenFromReq, verifyToken } from './auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './emailService.js';
import { BAZI_SYSTEM_INSTRUCTION, buildUserPrompt } from './prompt.js';
import { handleAnalyzeStream } from './analyzeStream.js';
import { handleParallelAnalyzeStream } from './analyzeParallelStream.js';
import { handleUnifiedAnalyzeStream } from './analyzeUnifiedStream.js';
import { calculateLifeTimeline, calculate36MonthTimeline, generate36MonthFallbackKLine, calculate7MonthTimeline, generate7MonthFallbackKLine, calculate61DayTimeline, generate61DayFallbackKLine } from './baziCalculator.js';
import { getCacheStats, computeBaziHash, getCachedAnalysis } from './cacheManager.js';
import { getPublicSiteConfig } from './siteConfig.js';
import { POINTS_CONFIG, getFeatureCost, checkUserPoints, deductUserPoints } from './pointsManager.js';
import { AGENT_DAILY_FORTUNE_PROMPT } from './agentPrompts.js';
import { generateCelebrityAnalysis } from './celebrityAnalyzer.js';
import { regenerateCoreDocument } from './coreDocumentEngine.js';
import { startEmailScheduler } from './emailScheduler.js';
import {
  getPricing,
  updatePricing,
  batchUpdatePricing,
  getPointPackages,
  updatePointPackage,
  batchUpdatePointPackages,
  getPublicPricing,
} from './pricingManager.js';
import {
  createWechatNativeOrder,
  createWechatH5Order,
  decryptWechatResource,
  getWechatPayAdminConfig,
  getWechatPayPublicConfig,
  saveWechatPayConfig,
  queryWechatOrder,
  verifyWechatNotifySignature,
} from './wechatPay.js';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const DEFAULT_API_BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_API_KEY = process.env.API_KEY || ''; // 闇€瑕佸湪 .env 涓厤缃?
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gemini-3-pro-preview';

// 妯″瀷闄嶇骇鍒楄〃锛氬綋涓绘ā鍨嬪け璐ユ椂渚濇灏濊瘯
const FALLBACK_MODELS = [
  'gemini-2.5-pro',
];

const FREE_INIT_POINTS = process.env.FREE_INIT_POINTS ? parseInt(process.env.FREE_INIT_POINTS, 10) : 1000;
const COST_PER_ANALYSIS = process.env.COST_PER_ANALYSIS ? parseInt(process.env.COST_PER_ANALYSIS, 10) : 50;
const EMAIL_BINDING_REWARD = process.env.EMAIL_BINDING_REWARD ? parseInt(process.env.EMAIL_BINDING_REWARD, 10) : 1000;
const EMAIL_SUBSCRIPTION_REWARD = process.env.EMAIL_SUBSCRIPTION_REWARD ? parseInt(process.env.EMAIL_SUBSCRIPTION_REWARD, 10) : 1000;

const app = express();
app.set('trust proxy', 1);
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => {
    if (req.originalUrl === '/api/payment/wechat/notify') {
      req.rawBody = buf.toString('utf8');
    }
  },
}));
app.use(cookieParser());

const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const adminCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 12 * 60 * 60 * 1000,
};

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_VOUCHER_PASSWORD || 'admin123';
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || `${JWT_SECRET}:admin`;

const sanitizeEmail = (email) => String(email || '').trim().toLowerCase();

const requireAdmin = (req, res, next) => {
  const token = req.cookies?.admin_token;
  if (!token) return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
  try {
    const decoded = verifyToken(token, ADMIN_TOKEN_SECRET);
    if (decoded?.role !== 'admin') return res.status(403).json({ error: 'ADMIN_FORBIDDEN' });
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED' });
  }
};

const getAuthedUser = (req) => {
  const token = getTokenFromReq(req);
  if (!token) return null;
  try {
    const decoded = verifyToken(token, JWT_SECRET);
    const user = getUserById(decoded.sub);
    if (!user) return null;
    return { user, decoded };
  } catch {
    return null;
  }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// 绔欑偣閰嶇疆 API - 杩斿洖鍓嶇鍙敤鐨勭珯鐐归厤缃?
app.get('/api/site-config', (_req, res) => {
  res.json(getPublicSiteConfig());
});

app.post('/api/admin/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!ADMIN_USERNAME || username !== ADMIN_USERNAME || !ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'INVALID_ADMIN_CREDENTIALS' });
  }

  const token = signToken({ role: 'admin', username: ADMIN_USERNAME }, ADMIN_TOKEN_SECRET);
  res.cookie('admin_token', token, adminCookieOptions);
  return res.json({ ok: true, username: ADMIN_USERNAME });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('admin_token');
  return res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (_req, res) => {
  return res.json({ admin: true });
});

app.post('/api/auth/register', async (req, res) => {
  const email = sanitizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'INVALID_INPUT' });

  // 妫€鏌ラ偖绠辨槸鍚﹀凡瀛樺湪
  const existing = getUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'EMAIL_EXISTS' });

  const passwordHash = await hashPassword(password);
  const user = createUser(nanoid(), email, passwordHash, FREE_INIT_POINTS);
  createUserPreferences(user.id);

  // 璁板綍鏃ュ織
  logEvent('info', '鐢ㄦ埛娉ㄥ唽', { email }, user.id, req.ip);

  const token = signToken({ sub: user.id, email: user.email }, JWT_SECRET);
  res.cookie('token', token, authCookieOptions);
  return res.json({ user: { id: user.id, email: user.email, points: user.points } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = sanitizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'INVALID_INPUT' });

  const user = getUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  // 鏇存柊鐧诲綍淇℃伅
  updateUserLogin(user.id);
  logEvent('info', '鐢ㄦ埛鐧诲綍', { email }, user.id, req.ip);

  const token = signToken({ sub: user.id, email: user.email }, JWT_SECRET);
  res.cookie('token', token, authCookieOptions);
  return res.json({ user: { id: user.id, email: user.email, points: user.points } });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token');
  return res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const info = getAuthedUser(req);
  if (!info) return res.status(200).json({ user: null });
  return res.json({ user: { id: info.user.id, email: info.user.email, points: info.user.points } });
});

app.get('/api/history', requireAuth(JWT_SECRET), (req, res) => {
  const analyses = getAnalysesByUserId(req.auth.sub, 20, 0);
  const list = analyses.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    cost: a.cost,
    summary: a.analysisData?.summary || ''
  }));
  return res.json({ items: list });
});

app.get('/api/history/:id', requireAuth(JWT_SECRET), (req, res) => {
  const analysis = getAnalysisById(req.params.id);
  if (!analysis || analysis.userId !== req.auth.sub) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  return res.json({
    item: {
      id: analysis.id,
      createdAt: analysis.createdAt,
      cost: analysis.cost,
      result: {
        chartData: analysis.chartData,
        analysis: analysis.analysisData,
      }
    }
  });
});

// 鏂板娴佸紡鍒嗘瀽绔偣 (鍘熺増鍗曟ā鍨?
app.post('/api/analyze-stream', async (req, res) => {
  const body = req.body || {};
  const useCustomApi = false;

  let authedInfo = null;

  if (!useCustomApi) {
    let info = getAuthedUser(req);

    if (info) {
      authedInfo = info;
      if (info.user.points < COST_PER_ANALYSIS) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: 'INSUFFICIENT_POINTS', points: info.user.points })}\n\n`);
        return res.end();
      }
    }
  }

  req.__authedInfo = authedInfo;
  return handleAnalyzeStream(req, res);
});

// 鏂板骞惰鍒嗘瀽绔偣 (6涓狝gent骞惰 + 缂撳瓨)
app.post('/api/analyze-parallel', async (req, res) => {
  const body = req.body || {};
  const useCustomApi = false;

  let authedInfo = null;

  if (!useCustomApi) {
    let info = getAuthedUser(req);

    if (info) {
      authedInfo = info;
      if (info.user.points < COST_PER_ANALYSIS) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: 'INSUFFICIENT_POINTS', points: info.user.points })}\n\n`);
        return res.end();
      }
    }
  }

  req.__authedInfo = authedInfo;
  return handleParallelAnalyzeStream(req, res);
});

// 鏂板缁熶竴鍒嗘瀽绔偣 (鍗旳gent妯″紡 + 缂撳瓨)
// 浼樺娍锛欰PI璋冪敤娆℃暟鍑忓皯83%锛?娆♀啋1娆★級锛屾垚鏈樉钁楅檷浣?
app.post('/api/analyze-unified', async (req, res) => {
  const body = req.body || {};
  const useCustomApi = false;

  let authedInfo = null;

  if (!useCustomApi) {
    let info = getAuthedUser(req);

    if (info) {
      authedInfo = info;
      if (info.user.points < COST_PER_ANALYSIS) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: 'INSUFFICIENT_POINTS', points: info.user.points })}\n\n`);
        return res.end();
      }
    }
  }

  req.__authedInfo = authedInfo;
  return handleUnifiedAnalyzeStream(req, res);
});

// 鑾峰彇缂撳瓨缁熻淇℃伅
app.get('/api/cache/stats', (req, res) => {
  try {
    const stats = getCacheStats();
    return res.json({ stats });
  } catch (error) {
    console.error('鑾峰彇缂撳瓨缁熻澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/analyze', async (req, res) => {
  const body = req.body || {};
  const useCustomApi = false;

  let authedInfo = null;

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
    let info = getAuthedUser(req);

    // 鍏佽鏈櫥褰曠敤鎴峰厤璐逛綋楠岋紙娓稿妯″紡锛?
    if (info) {
      authedInfo = info;
      // 宸茬櫥褰曠敤鎴锋鏌ョН鍒?
      if (info.user.points < COST_PER_ANALYSIS) {
        return res.status(402).json({ error: 'INSUFFICIENT_POINTS', points: info.user.points });
      }
    }
    // 鏈櫥褰曠敤鎴峰彲浠ュ厤璐逛綋楠屼竴娆★紙娓稿妯″紡锛屼笉鎵ｇ偣锛?

    apiBaseUrl = DEFAULT_API_BASE_URL;
    apiKey = DEFAULT_API_KEY;
    modelName = DEFAULT_MODEL;

    // 妫€鏌?API 閰嶇疆
    if (!DEFAULT_API_KEY || DEFAULT_API_KEY === 'sk-example-key') {
      return res.status(500).json({
        error: 'SERVER_DEFAULT_KEY_NOT_SET',
        message: 'Please configure API key on server or use custom API with your own key'
      });
    }
  } else {
    if (!apiBaseUrl || !apiKey || !modelName) return res.status(400).json({ error: 'MISSING_CUSTOM_API_CONFIG' });
  }

  // 棰勮绠楃敓鍛藉懆鏈熼鏋?(Skeleton)
  let skeletonData = null;
  try {
    skeletonData = calculateLifeTimeline(input);
  } catch (err) {
    console.error('楠ㄦ灦璁＄畻澶辫触:', err);
    return res.status(500).json({
      error: 'SKELETON_CALC_FAILED',
      message: '流年骨架计算失败，请检查输入数据',
    });
  }

  const userPrompt = String(body.userPrompt || '').trim() || buildUserPrompt({ ...input, gender: input.gender }, skeletonData);

  // 鏋勫缓瑕佸皾璇曠殑妯″瀷鍒楄〃锛堜富妯″瀷 + 闄嶇骇妯″瀷锛?
  const modelsToTry = [modelName];
  // 鍙湁浣跨敤榛樿妯″瀷鏃舵墠鍚敤闄嶇骇鏈哄埗
  if (!useCustomApi) {
    modelsToTry.push(...FALLBACK_MODELS);
  }

  // 鍗曟璇锋眰鍑芥暟
  const makeRequest = async (currentModel, currentApiBaseUrl, currentApiKey) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 180绉掕秴鏃?

    try {
      const response = await fetch(`${currentApiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentApiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: BAZI_SYSTEM_INSTRUCTION },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  };

  // 甯﹂噸璇曠殑鍗曟ā鍨嬭姹?
  const tryModelWithRetries = async (currentModel) => {
    let retryCount = 0;
    const maxRetries = 1; // 姣忎釜妯″瀷鏈€澶氶噸璇?娆?

    while (retryCount <= maxRetries) {
      try {
        console.log(`灏濊瘯妯″瀷: ${currentModel} (绗?{retryCount + 1}娆?`);
        const response = await makeRequest(currentModel, apiBaseUrl, apiKey);

        if (response.ok) {
          return { success: true, response, model: currentModel };
        }

        // 妫€鏌ユ槸鍚︽槸鍙噸璇曠殑閿欒
        const errText = await response.text();
        console.warn(`妯″瀷 ${currentModel} 璇锋眰澶辫触:`, response.status, errText.substring(0, 200));

        // 401/403 璁よ瘉閿欒涓嶉噸璇?
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'AUTH_ERROR', status: response.status, errText };
        }

        retryCount++;
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 绛夊緟2绉掑悗閲嶈瘯
        }
      } catch (err) {
        console.warn(`妯″瀷 ${currentModel} 璇锋眰寮傚父:`, err.message);
        retryCount++;
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    return { success: false, error: 'FAILED_AFTER_RETRIES' };
  };

  // 渚濇灏濊瘯鎵€鏈夋ā鍨?
  let lastError = null;
  let successResponse = null;
  let usedModel = null;

  for (const currentModel of modelsToTry) {
    const result = await tryModelWithRetries(currentModel);

    if (result.success) {
      successResponse = result.response;
      usedModel = result.model;
      console.log(`鉁?妯″瀷 ${currentModel} 璇锋眰鎴愬姛`);
      break;
    }

    lastError = result;
    console.warn(`鉁?妯″瀷 ${currentModel} 澶辫触锛屽皾璇曚笅涓€涓?..`);
  }

  if (!successResponse) {
    console.error('鎵€鏈夋ā鍨嬪潎澶辫触:', lastError);

    if (lastError?.error === 'AUTH_ERROR') {
      return res.status(500).json({
        error: 'API_AUTH_FAILED',
        message: 'API瀵嗛挜璁よ瘉澶辫触锛岃妫€鏌PI閰嶇疆'
      });
    }

    return res.status(502).json({
      error: 'ALL_MODELS_FAILED',
      message: '所有 AI 模型均无法响应，请稍后重试',
      triedModels: modelsToTry
    });
  }

  const response = successResponse;

  const responseText = await response.text();
  let jsonResult;
  try {
    jsonResult = JSON.parse(responseText);
  } catch (e) {
    console.error('API response parse error. Status:', response.status, 'Content type:', response.headers.get('content-type'));
    console.error('Body preview:', responseText.substring(0, 200));
    return res.status(502).json({ 
      error: 'INVALID_API_RESPONSE', 
      message: 'AI鏈嶅姟杩斿洖浜嗛潪JSON鏍煎紡鏁版嵁',
      details: responseText.substring(0, 100)
    });
  }

  let content = jsonResult.choices?.[0]?.message?.content;
  if (!content) return res.status(502).json({ error: 'EMPTY_MODEL_RESPONSE' });

  // 娓呯悊鍙兘鐨?markdown 浠ｇ爜鍧楁爣璁?
  content = content.trim();

  // 绉婚櫎 <think> 鎬濊€冭繃绋嬫爣绛撅紙鍖呮嫭澶氳锛?
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 绉婚櫎鍙兘鐨勫紑鍦虹櫧锛堝"濂界殑"銆?鎴戞潵鍒嗘瀽"绛夛級
  content = content.replace(/^[\s\S]*?(?=\{)/m, '');

  if (content.startsWith('```json')) {
    content = content.slice(7);
  } else if (content.startsWith('```')) {
    content = content.slice(3);
  }
  if (content.endsWith('```')) {
    content = content.slice(0, -3);
  }
  content = content.trim();

  // 灏濊瘯鎻愬彇JSON瀵硅薄锛堟壘鍒扮涓€涓獅鍜屾渶鍚庝竴涓獇锛?
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    content = content.slice(jsonStart, jsonEnd + 1);
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch (parseErr) {
    console.error('JSON parse error:', parseErr.message, 'Content:', content.substring(0, 200));
    return res.status(502).json({ error: 'INVALID_JSON_FORMAT', message: '模型返回的数据格式无效' });
  }
  if (!data.chartPoints || !Array.isArray(data.chartPoints)) return res.status(502).json({ error: 'INVALID_MODEL_JSON' });

  const result = {
    chartData: data.chartPoints,
    analysis: {
      bazi: data.bazi || [],
      summary: data.summary || '无摘要',
      summaryScore: data.summaryScore || 5,
      personality: data.personality || '鏃犳€ф牸鍒嗘瀽',
      personalityScore: data.personalityScore || 5,
      industry: data.industry || '暂无行业分析',
      industryScore: data.industryScore || 5,
      fengShui: data.fengShui || '建议多亲近自然，保持心境平和。',
      fengShuiScore: data.fengShuiScore || 5,
      wealth: data.wealth || '暂无财富分析',
      wealthScore: data.wealthScore || 5,
      marriage: data.marriage || '暂无婚姻分析',
      marriageScore: data.marriageScore || 5,
      health: data.health || '暂无健康分析',
      healthScore: data.healthScore || 5,
      family: data.family || '暂无家庭分析',
      familyScore: data.familyScore || 5,
      crypto: data.crypto || '鏆傛棤浜ゆ槗鍒嗘瀽',
      cryptoScore: data.cryptoScore || 5,
      cryptoYear: data.cryptoYear || '寰呭畾',
      cryptoStyle: data.cryptoStyle || '鐜拌揣瀹氭姇',
    },
  };

  let user = null;
  let cost = 0;
  let isGuest = false;

  // 璁板綍鐢ㄦ埛杈撳叆淇℃伅
  const inputId = nanoid();
  const startTime = Date.now();

  if (!useCustomApi) {
    const info = authedInfo;

    // 淇濆瓨鐢ㄦ埛杈撳叆
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

    // 淇濆瓨鍒嗘瀽缁撴灉
    const analysisId = nanoid();

    if (info) {
      // 宸茬櫥褰曠敤鎴凤細鎵ｉ櫎绉垎骞朵繚瀛樺埌璐︽埛
      const newPoints = Math.max(0, info.user.points - COST_PER_ANALYSIS);
      updateUserPoints(info.user.id, newPoints);
      cost = COST_PER_ANALYSIS;

      saveAnalysis({
        id: analysisId,
        userId: info.user.id,
        inputId: inputId,
        cost,
        modelUsed: usedModel,
        chartData: result.chartData,
        analysisData: result.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '鐢熸垚鍒嗘瀽', { analysisId, cost, model: usedModel }, info.user.id, req.ip);
      user = { id: info.user.id, email: info.user.email, points: newPoints };
    } else {
      // 娓稿妯″紡锛氬厤璐逛綋楠岋紝涓嶆墸鐐癸紝鏍囪涓烘父瀹?
      isGuest = true;

      saveAnalysis({
        id: analysisId,
        userId: null,
        inputId: inputId,
        cost: 0,
        modelUsed: usedModel,
        chartData: result.chartData,
        analysisData: result.analysis,
        processingTimeMs: Date.now() - startTime,
        status: 'completed',
      });

      logEvent('info', '娓稿浣撻獙', { analysisId, model: usedModel }, null, req.ip);
    }
  } else {
    // 鑷畾涔堿PI妯″紡锛岃褰曡緭鍏ワ紙鏃犵敤鎴稩D锛?
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

  return res.json({ result, user, cost, isGuest });
});

// ============ Content API ============

// 鏂囩珷鍒楄〃
app.get('/api/content/knowledge', (req, res) => {
  const { category, limit = 20, offset = 0 } = req.query;
  const articles = getArticles(category || null, parseInt(limit), parseInt(offset));
  return res.json({ items: articles, total: articles.length });
});

// 鏂囩珷璇︽儏
app.get('/api/content/knowledge/:slug', (req, res) => {
  const article = getArticleBySlug(req.params.slug);
  if (!article) {
    return res.status(404).json({ error: 'ARTICLE_NOT_FOUND' });
  }
  incrementArticleView(req.params.slug);
  return res.json({ article });
});

// 妗堜緥鍒楄〃
app.get('/api/content/cases', (req, res) => {
  const { curveType, limit = 20, offset = 0 } = req.query;
  const cases = getCases(curveType || null, parseInt(limit), parseInt(offset));
  return res.json({ items: cases, total: cases.length });
});

// 妗堜緥璇︽儏
app.get('/api/content/cases/:id', (req, res) => {
  const caseItem = getCaseById(req.params.id);
  if (!caseItem) {
    return res.status(404).json({ error: 'CASE_NOT_FOUND' });
  }
  incrementCaseView(req.params.id);
  return res.json({ case: caseItem });
});

// 鎼滅储
app.get('/api/content/search', (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'QUERY_TOO_SHORT' });
  }

  // 鎼滅储鏂囩珷
  const searchPattern = `%${q}%`;
  const db = getDb();
  const articleStmt = db.prepare(`
    SELECT id, slug, title, category, summary
    FROM knowledge_articles
    WHERE published = 1 AND (title LIKE ? OR summary LIKE ?)
    LIMIT ?
  `);
  const articles = articleStmt.all(searchPattern, searchPattern, parseInt(limit));

  // 鎼滅储妗堜緥
  const caseStmt = db.prepare(`
    SELECT id, title, persona, curve_type
    FROM cases
    WHERE published = 1 AND (title LIKE ? OR narrative LIKE ?)
    LIMIT ?
  `);
  const cases = caseStmt.all(searchPattern, searchPattern, parseInt(limit));

  return res.json({ articles, cases });
});

// ============ Celebrity Cases API ============

// GET /api/celebrity-cases - List all celebrity cases with optional category filter
app.get('/api/celebrity-cases', (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;
    const cases = getCelebrityCases(
      category || null,
      parseInt(limit),
      parseInt(offset)
    );

    return res.json({
      items: cases,
      total: cases.length,
      category: category || 'all'
    });
  } catch (error) {
    console.error('鑾峰彇鍚嶄汉妗堜緥鍒楄〃澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/celebrity-cases/trending - Get trending celebrity cases
app.get('/api/celebrity-cases/trending', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const cases = getTrendingCelebrityCases(parseInt(limit));

    return res.json({
      items: cases,
      total: cases.length
    });
  } catch (error) {
    console.error('鑾峰彇鐑棬鍚嶄汉妗堜緥澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// NOTE: More specific routes with :id must come BEFORE the generic :id route

// POST /api/celebrity-cases/:id/similarity - Calculate similarity with user profile
app.post('/api/celebrity-cases/:id/similarity', (req, res) => {
  try {
    const { id } = req.params;
    const { userBazi } = req.body;

    // Get celebrity case
    const celebrityCase = getCelebrityCaseById(id);
    if (!celebrityCase) {
      return res.status(404).json({
        error: 'CASE_NOT_FOUND',
        message: '鏈壘鍒拌鍚嶄汉妗堜緥'
      });
    }

    // Validate user bazi
    if (!userBazi || !userBazi.yearPillar || !userBazi.monthPillar ||
        !userBazi.dayPillar || !userBazi.hourPillar) {
      return res.status(400).json({
        error: 'INVALID_BAZI',
        message: '璇锋彁渚涘畬鏁寸殑鍏瓧淇℃伅'
      });
    }

    // Calculate similarity score
    const similarity = calculateBaziSimilarity(
      {
        yearPillar: celebrityCase.year_pillar,
        monthPillar: celebrityCase.month_pillar,
        dayPillar: celebrityCase.day_pillar,
        hourPillar: celebrityCase.hour_pillar,
      },
      userBazi
    );

    return res.json({
      similarity: similarity,
      celebrityName: celebrityCase.name_cn,
      matchPoints: similarity.matchPoints,
      maxPoints: similarity.maxPoints,
      percentage: Math.round((similarity.matchPoints / similarity.maxPoints) * 100),
      details: similarity.details
    });
  } catch (error) {
    console.error('璁＄畻鍏瓧鐩镐技搴﹀け璐?', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/celebrity-cases/:id/full - Get celebrity with full analysis (generates on-demand if missing)
app.get('/api/celebrity-cases/:id/full', async (req, res) => {
  try {
    const { id } = req.params;
    const { regenerate } = req.query; // Optional: force regenerate

    // Get celebrity case
    const celebrityCase = getCelebrityCaseById(id);
    if (!celebrityCase) {
      return res.status(404).json({
        error: 'CASE_NOT_FOUND',
        message: '鏈壘鍒拌鍚嶄汉妗堜緥'
      });
    }

    // Check if analysis exists and is not forced to regenerate
    if (celebrityCase.analysis_data && !regenerate) {
      // Increment view count
      incrementCelebrityCaseView(id);

      return res.json({
        case: {
          ...celebrityCase,
          analysisData: JSON.parse(celebrityCase.analysis_data),
          scores: celebrityCase.scores ? JSON.parse(celebrityCase.scores) : null,
          financialData: celebrityCase.financial_data ? JSON.parse(celebrityCase.financial_data) : null,
          honors: celebrityCase.honors ? JSON.parse(celebrityCase.honors) : [],
        },
        fromCache: true,
        generatedAt: celebrityCase.analysis_generated_at,
      });
    }

    // Generate analysis on-demand
    console.log(`[API] 涓哄悕浜?${celebrityCase.name_cn || celebrityCase.name} 鐢熸垚鍒嗘瀽...`);

    const analysisResult = await generateCelebrityAnalysis(celebrityCase);

    if (!analysisResult.success) {
      console.error('鍚嶄汉鍒嗘瀽鐢熸垚澶辫触:', analysisResult.error);
      // Return basic case data without analysis
      incrementCelebrityCaseView(id);
      return res.json({
        case: celebrityCase,
        fromCache: false,
        analysisError: analysisResult.error,
      });
    }

    // Save analysis to database
    const db = getDb();
    const updateStmt = db.prepare(`
      UPDATE celebrity_cases
      SET analysis_data = ?,
          scores = ?,
          financial_data = ?,
          honors = ?,
          analysis_generated_at = ?,
          analysis_version = COALESCE(analysis_version, 0) + 1
      WHERE id = ?
    `);

    updateStmt.run(
      JSON.stringify(analysisResult.analysisData),
      JSON.stringify(analysisResult.scores),
      JSON.stringify(analysisResult.financialData),
      JSON.stringify(analysisResult.honors),
      analysisResult.generatedAt,
      id
    );

    // Increment view count
    incrementCelebrityCaseView(id);

    return res.json({
      case: {
        ...celebrityCase,
        analysisData: analysisResult.analysisData,
        scores: analysisResult.scores,
        financialData: analysisResult.financialData,
        honors: analysisResult.honors,
      },
      fromCache: false,
      generatedAt: analysisResult.generatedAt,
      model: analysisResult.model,
      elapsed: analysisResult.elapsed,
    });

  } catch (error) {
    console.error('鑾峰彇鍚嶄汉瀹屾暣鍒嗘瀽澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// GET /api/celebrity-cases/:id - Get single celebrity case detail (must be AFTER more specific routes)
app.get('/api/celebrity-cases/:id', (req, res) => {
  try {
    const { id } = req.params;
    const celebrityCase = getCelebrityCaseById(id);

    if (!celebrityCase) {
      return res.status(404).json({
        error: 'CASE_NOT_FOUND',
        message: '鏈壘鍒拌鍚嶄汉妗堜緥'
      });
    }

    // Increment view count
    incrementCelebrityCaseView(id);

    return res.json({
      case: celebrityCase
    });
  } catch (error) {
    console.error('鑾峰彇鍚嶄汉妗堜緥璇︽儏澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/celebrity-cases/:id/generate-analysis - Admin endpoint to regenerate analysis
app.post('/api/celebrity-cases/:id/generate-analysis', requireAuth(JWT_SECRET), async (req, res) => {
  try {
    const { id } = req.params;

    // Get celebrity case
    const celebrityCase = getCelebrityCaseById(id);
    if (!celebrityCase) {
      return res.status(404).json({
        error: 'CASE_NOT_FOUND',
        message: '鏈壘鍒拌鍚嶄汉妗堜緥'
      });
    }

    console.log(`[API] 绠＄悊鍛樹负鍚嶄汉 ${celebrityCase.name_cn || celebrityCase.name} 閲嶆柊鐢熸垚鍒嗘瀽...`);

    const analysisResult = await generateCelebrityAnalysis(celebrityCase);

    if (!analysisResult.success) {
      return res.status(500).json({
        error: 'GENERATION_FAILED',
        message: analysisResult.message || '鍒嗘瀽鐢熸垚澶辫触',
        details: analysisResult.error,
      });
    }

    // Save analysis to database
    const db = getDb();
    const updateStmt = db.prepare(`
      UPDATE celebrity_cases
      SET analysis_data = ?,
          scores = ?,
          financial_data = ?,
          honors = ?,
          analysis_generated_at = ?,
          analysis_version = COALESCE(analysis_version, 0) + 1
      WHERE id = ?
    `);

    updateStmt.run(
      JSON.stringify(analysisResult.analysisData),
      JSON.stringify(analysisResult.scores),
      JSON.stringify(analysisResult.financialData),
      JSON.stringify(analysisResult.honors),
      analysisResult.generatedAt,
      id
    );

    return res.json({
      success: true,
      message: '鍒嗘瀽鐢熸垚鎴愬姛',
      analysisData: analysisResult.analysisData,
      scores: analysisResult.scores,
      financialData: analysisResult.financialData,
      honors: analysisResult.honors,
      generatedAt: analysisResult.generatedAt,
      model: analysisResult.model,
      elapsed: analysisResult.elapsed,
    });

  } catch (error) {
    console.error('閲嶆柊鐢熸垚鍚嶄汉鍒嗘瀽澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// ============ Share API ============

// POST /api/share/reward - Record and reward sharing
app.post('/api/share/reward', requireAuth(JWT_SECRET), (req, res) => {
  const { platform, analysisId } = req.body;

  // Validate platform
  if (!['twitter', 'telegram', 'wechat'].includes(platform)) {
    return res.status(400).json({ error: 'INVALID_PLATFORM' });
  }

  // Get current user
  const user = getUserById(req.auth.sub);
  if (!user) {
    return res.status(401).json({ error: 'USER_NOT_FOUND' });
  }

  // Create share reward record (trust-based system - no restrictions)
  const shareId = nanoid();
  const pointsRewarded = 300;

  try {
    createShareReward({
      id: shareId,
      userId: user.id,
      platform: platform,
      analysisId: analysisId || null,
      pointsRewarded: pointsRewarded,
      currentPoints: user.points,
      ipAddress: req.ip,
    });

    // Log the event
    logEvent('info', '鍒嗕韩濂栧姳', {
      platform,
      analysisId,
      pointsRewarded,
      shareId
    }, user.id, req.ip);

    // Get updated user points
    const updatedUser = getUserById(user.id);

    return res.json({
      success: true,
      pointsRewarded: pointsRewarded,
      newPointsBalance: updatedUser.points
    });

  } catch (error) {
    console.error('鍒嗕韩濂栧姳鍒涘缓澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/share/history - Get user's share history
app.get('/api/share/history', requireAuth(JWT_SECRET), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  try {
    const shareRewards = getUserShareRewards(req.auth.sub, limit, offset);

    return res.json({
      items: shareRewards.map(reward => ({
        id: reward.id,
        platform: reward.platform,
        analysisId: reward.analysisId,
        pointsRewarded: reward.pointsRewarded,
        sharedAt: reward.sharedAt
      }))
    });

  } catch (error) {
    console.error('鑾峰彇鍒嗕韩鍘嗗彶澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============ 鐐瑰埜鍏戞崲 API ============

// POST /api/admin/voucher/generate - 绠＄悊鍛樼敓鎴愬厬鎹㈢爜
const ADMIN_VOUCHER_PASSWORD = process.env.ADMIN_VOUCHER_PASSWORD || 'change-this-password';

app.post('/api/admin/voucher/generate-v2', requireAdmin, (req, res) => {
  const pointsNum = parseInt(req.body?.points, 10);
  if (!pointsNum || pointsNum <= 0 || pointsNum > 100000) {
    return res.status(400).json({ error: 'INVALID_POINTS', message: '鐐规暟蹇呴』鍦?1-100000 涔嬮棿' });
  }

  try {
    const voucher = createVoucher(pointsNum);
    logEvent('info', '生成兑换码', { code: voucher.code, points: pointsNum }, null, req.ip);
    return res.json({
      success: true,
      code: voucher.code,
      points: voucher.points,
      createdAt: voucher.createdAt,
    });
  } catch (error) {
    console.error('鐢熸垚鍏戞崲鐮佸け璐?', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '鐢熸垚澶辫触' });
  }
});

app.post('/api/admin/voucher/generate', (req, res) => {
  const { password, points } = req.body;

  // 楠岃瘉瀵嗙爜
  if (password !== ADMIN_VOUCHER_PASSWORD) {
    return res.status(403).json({ error: 'INVALID_PASSWORD', message: '瀵嗙爜閿欒' });
  }

  // 楠岃瘉鐐规暟
  const pointsNum = parseInt(points, 10);
  if (!pointsNum || pointsNum <= 0 || pointsNum > 100000) {
    return res.status(400).json({ error: 'INVALID_POINTS', message: '鐐规暟蹇呴』鍦?1-100000 涔嬮棿' });
  }

  try {
    const voucher = createVoucher(pointsNum);
    logEvent('info', '生成兑换码', { code: voucher.code, points: pointsNum }, null, req.ip);

    return res.json({
      success: true,
      code: voucher.code,
      points: voucher.points,
      createdAt: voucher.createdAt
    });
  } catch (error) {
    console.error('鐢熸垚鍏戞崲鐮佸け璐?', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '鐢熸垚澶辫触' });
  }
});

// POST /api/voucher/redeem - 鐢ㄦ埛鍏戞崲鐐瑰埜
app.post('/api/voucher/redeem', requireAuth(JWT_SECRET), (req, res) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({ error: 'INVALID_CODE', message: '璇疯緭鍏ュ厬鎹㈢爜' });
  }

  try {
    const result = redeemVoucher(code.trim(), req.auth.sub);

    if (!result.success) {
      return res.status(400).json(result);
    }

    logEvent('info', '鐐瑰埜鍏戞崲鎴愬姛', { code: code.trim(), points: result.points }, req.auth.sub, req.ip);

    return res.json(result);
  } catch (error) {
    console.error('鍏戞崲鐐瑰埜澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '鍏戞崲澶辫触' });
  }
});

// GET /api/profiles - Get user's profiles (for share tracking)
app.get('/api/profiles', requireAuth(JWT_SECRET), (req, res) => {
  try {
    const profiles = getUserProfiles(req.auth.sub);

    return res.json({
      profiles
    });

  } catch (error) {
    console.error('鑾峰彇鐢ㄦ埛妗ｆ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ============ Profile Management API ============

// POST /api/profiles - Create a new profile
app.post('/api/profiles', requireAuth(JWT_SECRET), (req, res) => {
  const { name, gender, birthYear, yearPillar, monthPillar, dayPillar, hourPillar, startAge, firstDaYun, birthPlace, isDefault } = req.body;
  const normalizedGender = gender === 'male' || gender === 'female'
    ? gender
    : gender === 'Male'
      ? 'male'
      : gender === 'Female'
        ? 'female'
        : '';

  // Validate required fields
  if (!name || !normalizedGender || !birthYear) {
    return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS', message: 'Name, gender, and birthYear are required' });
  }

  // Validate gender
  if (!['male', 'female'].includes(normalizedGender)) {
    return res.status(400).json({ error: 'INVALID_GENDER', message: 'Gender must be male or female' });
  }

  try {
    const profileId = nanoid();
    const profile = createUserProfile({
      id: profileId,
      userId: req.auth.sub,
      name,
      gender: normalizedGender,
      birthYear,
      yearPillar,
      monthPillar,
      dayPillar,
      hourPillar,
      startAge,
      firstDaYun,
      birthPlace,
      isDefault: Boolean(isDefault),
    });

    logEvent('info', '鍒涘缓妗ｆ', { profileId, name }, req.auth.sub, req.ip);

    return res.status(201).json({ profile });

  } catch (error) {
    if (error.message === '用户最多只能创建10个档案') {
      return res.status(409).json({ error: 'PROFILE_LIMIT_EXCEEDED', message: error.message });
    }
    console.error('鍒涘缓妗ｆ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create profile' });
  }
});

// GET /api/profiles/:id - Get a specific profile
app.get('/api/profiles/:id', requireAuth(JWT_SECRET), (req, res) => {
  const { id } = req.params;

  try {
    const profile = getUserProfileById(id);

    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    }

    // Check if profile belongs to the authenticated user
    if (profile.userId !== req.auth.sub) {
      return res.status(403).json({ error: 'ACCESS_DENIED', message: 'You can only access your own profiles' });
    }

    return res.json({ profile });

  } catch (error) {
    console.error('鑾峰彇妗ｆ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch profile' });
  }
});

// PUT /api/profiles/:id - Update a profile
app.put('/api/profiles/:id', requireAuth(JWT_SECRET), (req, res) => {
  const { id } = req.params;
  const { name, gender, birthYear, yearPillar, monthPillar, dayPillar, hourPillar, startAge, firstDaYun, birthPlace } = req.body;
  const normalizedGender = gender === undefined
    ? undefined
    : gender === 'male' || gender === 'female'
      ? gender
      : gender === 'Male'
        ? 'male'
        : gender === 'Female'
          ? 'female'
          : '';

  try {
    // First check if profile exists and belongs to user
    const existingProfile = getUserProfileById(id);

    if (!existingProfile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    }

    if (existingProfile.userId !== req.auth.sub) {
      return res.status(403).json({ error: 'ACCESS_DENIED', message: 'You can only update your own profiles' });
    }

    // Validate gender if provided
    if (normalizedGender !== undefined && !['male', 'female'].includes(normalizedGender)) {
      return res.status(400).json({ error: 'INVALID_GENDER', message: 'Gender must be male or female' });
    }

    const updateData = {
      name,
      gender: normalizedGender,
      birthYear,
      yearPillar,
      monthPillar,
      dayPillar,
      hourPillar,
      startAge,
      firstDaYun,
      birthPlace,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedProfile = updateUserProfileCompat(id, updateData);

    if (!updatedProfile) {
      return res.status(500).json({ error: 'UPDATE_FAILED', message: 'Failed to update profile' });
    }

    logEvent('info', '鏇存柊妗ｆ', { profileId: id, name }, req.auth.sub, req.ip);

    return res.json({ profile: updatedProfile });

  } catch (error) {
    console.error('鏇存柊妗ｆ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update profile' });
  }
});

// DELETE /api/profiles/:id - Delete a profile
app.delete('/api/profiles/:id', requireAuth(JWT_SECRET), (req, res) => {
  const { id } = req.params;

  try {
    // First check if profile exists and belongs to user
    const existingProfile = getUserProfileById(id);

    if (!existingProfile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    }

    if (existingProfile.userId !== req.auth.sub) {
      return res.status(403).json({ error: 'ACCESS_DENIED', message: 'You can only delete your own profiles' });
    }

    const success = deleteUserProfile(id);

    if (!success) {
      return res.status(500).json({ error: 'DELETE_FAILED', message: 'Failed to delete profile' });
    }

    logEvent('info', '鍒犻櫎妗ｆ', { profileId: id, name: existingProfile.name }, req.auth.sub, req.ip);

    return res.json({ success: true });

  } catch (error) {
    console.error('鍒犻櫎妗ｆ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to delete profile' });
  }
});

// POST /api/profiles/:id/set-default - Set profile as default
app.post('/api/profiles/:id/set-default', requireAuth(JWT_SECRET), (req, res) => {
  const { id } = req.params;

  try {
    // First check if profile exists and belongs to user
    const existingProfile = getUserProfileById(id);

    if (!existingProfile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    }

    if (existingProfile.userId !== req.auth.sub) {
      return res.status(403).json({ error: 'ACCESS_DENIED', message: 'You can only set your own profiles as default' });
    }

    const success = setDefaultProfile(req.auth.sub, id);

    if (!success) {
      return res.status(500).json({ error: 'SET_DEFAULT_FAILED', message: 'Failed to set profile as default' });
    }

    updateUserPreferences(req.auth.sub, { defaultProfileId: id });
    logEvent('info', '璁剧疆榛樿妗ｆ', { profileId: id, name: existingProfile.name }, req.auth.sub, req.ip);

    return res.json({ success: true, defaultProfileId: id });

  } catch (error) {
    console.error('璁剧疆榛樿妗ｆ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to set default profile' });
  }
});

// POST /api/profiles/:id/regenerate - Trigger core document regeneration
app.post('/api/profiles/:id/regenerate', requireAuth(JWT_SECRET), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.auth.sub;

    // Verify profile belongs to user
    const profile = getUserProfileById(id);
    if (!profile || profile.userId !== userId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log(`[API] Triggering core document regeneration for profile ${id}, reason: ${reason || '鎵嬪姩瑙﹀彂'}`);

    // Trigger async regeneration via coreDocumentEngine
    // This runs in the background, so we return immediately
    regenerateCoreDocument(id, reason || '鎵嬪姩瑙﹀彂')
      .then(result => {
        console.log(`[API] Core document regeneration completed for profile ${id}`);
      })
      .catch(error => {
        console.error(`[API] Core document regeneration failed for profile ${id}:`, error);
      });

    // Return success immediately
    res.json({
      success: true,
      message: '鏍稿績鏂囨。姝ｅ湪閲嶆柊鐢熸垚',
      status: 'generating'
    });
  } catch (error) {
    console.error('Regenerate error:', error);
    res.status(500).json({ error: '閲嶆柊鐢熸垚澶辫触' });
  }
});

// GET /api/profiles/:id/core-document - Get core document for a profile
app.get('/api/profiles/:id/core-document', requireAuth(JWT_SECRET), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth.sub;

    const profile = getUserProfileById(id);
    if (!profile || profile.userId !== userId) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get cached analysis using baziHash
    const baziHash = computeBaziHash(
      profile.yearPillar,
      profile.monthPillar,
      profile.dayPillar,
      profile.hourPillar
    );

    const cached = getCachedAnalysis(baziHash, profile.gender);

    if (cached) {
      res.json({
        success: true,
        coreDocument: cached,
        status: 'ready'
      });
    } else {
      res.json({
        success: true,
        coreDocument: null,
        status: profile.coreDocumentStatus || 'pending'
      });
    }
  } catch (error) {
    console.error('Get core document error:', error);
    res.status(500).json({ error: '鑾峰彇鏍稿績鏂囨。澶辫触' });
  }
});

// GET /api/preferences - Get user preferences
app.get('/api/preferences', requireAuth(JWT_SECRET), (req, res) => {
  try {
    let preferences = getUserPreferences(req.auth.sub);
    if (!preferences) {
      preferences = createUserPreferences(req.auth.sub);
    }
    return res.json({ preferences: preferences || {} });

  } catch (error) {
    console.error('鑾峰彇鐢ㄦ埛鍋忓ソ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch preferences' });
  }
});

// PUT /api/preferences - Update user preferences
app.put('/api/preferences', requireAuth(JWT_SECRET), (req, res) => {
  const { theme, notificationsEnabled, defaultProfileId } = req.body;

  try {
    // If defaultProfileId is provided, verify it belongs to the user
    if (defaultProfileId) {
      const profile = getUserProfileById(defaultProfileId);
      if (!profile || profile.userId !== req.auth.sub) {
        return res.status(400).json({ error: 'INVALID_PROFILE', message: 'Default profile must belong to you' });
      }
    }

    const updateData = {
      theme,
      notificationsEnabled,
      defaultProfileId,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    let updatedPreferences = updateUserPreferences(req.auth.sub, updateData);
    if (!updatedPreferences) {
      createUserPreferences(req.auth.sub);
      updatedPreferences = updateUserPreferences(req.auth.sub, updateData);
    }

    logEvent('info', '鏇存柊鍋忓ソ璁剧疆', { theme, notificationsEnabled }, req.auth.sub, req.ip);

    return res.json({ preferences: updatedPreferences || {} });

  } catch (error) {
    console.error('鏇存柊鐢ㄦ埛鍋忓ソ澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update preferences' });
  }
});

// ============ Email API ============

// POST /api/email/send-verification - Send verification email to logged-in user
app.post('/api/email/send-verification', requireAuth(JWT_SECRET), async (req, res) => {
  try {
    const userId = req.auth.sub;
    const user = getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: '用户不存在' });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');

    // Create or update email subscription record
    let subscription = getEmailSubscription(userId);
    if (!subscription) {
      createEmailSubscription({
        userId,
        email: user.email,
        verificationToken: token,
        emailVerified: 0,
      });
    } else {
      updateEmailSubscription(userId, {
        verificationToken: token,
      });
    }

    // Send verification email
    await sendVerificationEmail(user.email, token);

    logEvent('info', '发送验证邮件', { email: user.email }, userId, req.ip);

    return res.json({ success: true, message: '验证邮件已发送' });

  } catch (error) {
    console.error('鍙戦€侀獙璇侀偖浠跺け璐?', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '发送失败，请稍后重试' });
  }
});

// POST /api/email/verify - Verify email with token
app.post('/api/email/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'MISSING_TOKEN', message: '缂哄皯楠岃瘉浠ょ墝' });
    }

    // Find subscription by token
    const db = getDb();
    const subscription = db.prepare('SELECT * FROM email_subscriptions WHERE verification_token = ?').get(token);

    if (!subscription) {
      return res.status(404).json({ error: 'INVALID_TOKEN', message: '无效的验证令牌' });
    }

    if (subscription.email_verified === 1) {
      return res.status(400).json({ error: 'ALREADY_VERIFIED', message: '邮箱已验证' });
    }

    // Update verification status
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE email_subscriptions
      SET email_verified = 1, verified_at = ?
      WHERE user_id = ?
    `).run(now, subscription.user_id);

    // Award points if not already claimed
    let pointsAwarded = 0;
    if (subscription.binding_reward_claimed === 0) {
      const user = getUserById(subscription.user_id);
      const newPoints = user.points + EMAIL_BINDING_REWARD;
      updateUserPoints(subscription.user_id, newPoints);

      db.prepare('UPDATE email_subscriptions SET binding_reward_claimed = 1 WHERE user_id = ?')
        .run(subscription.user_id);

      pointsAwarded = EMAIL_BINDING_REWARD;

      logEvent('info', '閭楠岃瘉濂栧姳', { points: pointsAwarded }, subscription.user_id, req.ip);
    }

    logEvent('info', '閭楠岃瘉鎴愬姛', { email: subscription.email }, subscription.user_id, req.ip);

    const updatedUser = getUserById(subscription.user_id);

    return res.json({
      success: true,
      pointsAwarded,
      newPoints: updatedUser.points
    });

  } catch (error) {
    console.error('閭楠岃瘉澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '楠岃瘉澶辫触' });
  }
});

// GET /api/email/subscription - Get user's subscription settings
app.get('/api/email/subscription', requireAuth(JWT_SECRET), (req, res) => {
  try {
    const userId = req.auth.sub;
    const subscription = getEmailSubscription(userId);

    return res.json({
      subscription: subscription || null,
      emailVerified: subscription ? subscription.emailVerified === 1 : false
    });

  } catch (error) {
    console.error('鑾峰彇璁㈤槄璁剧疆澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '鑾峰彇澶辫触' });
  }
});

// PUT /api/email/subscription - Update subscription settings
app.put('/api/email/subscription', requireAuth(JWT_SECRET), (req, res) => {
  try {
    const userId = req.auth.sub;
    const {
      subDailyFortune,
      subMonthlyFortune,
      subYearlyFortune,
      subBirthdayReminder,
      subLowPoints,
      subFeatureUpdates,
      subPromotions
    } = req.body;

    let subscription = getEmailSubscription(userId);

    if (!subscription) {
      const user = getUserById(userId);
      createEmailSubscription({
        userId,
        email: user.email,
        emailVerified: 0,
      });
      subscription = getEmailSubscription(userId);
    }

    // Check if this is first time enabling any subscription
    const wasAnySubEnabled = subscription.subDailyFortune || subscription.subMonthlyFortune ||
                             subscription.subYearlyFortune || subscription.subBirthdayReminder ||
                             subscription.subLowPoints || subscription.subFeatureUpdates ||
                             subscription.subPromotions;

    const isAnySubEnabled = subDailyFortune || subMonthlyFortune || subYearlyFortune ||
                            subBirthdayReminder || subLowPoints || subFeatureUpdates || subPromotions;

    // Update subscription settings
    const updateData = {};
    if (subDailyFortune !== undefined) updateData.subDailyFortune = subDailyFortune ? 1 : 0;
    if (subMonthlyFortune !== undefined) updateData.subMonthlyFortune = subMonthlyFortune ? 1 : 0;
    if (subYearlyFortune !== undefined) updateData.subYearlyFortune = subYearlyFortune ? 1 : 0;
    if (subBirthdayReminder !== undefined) updateData.subBirthdayReminder = subBirthdayReminder ? 1 : 0;
    if (subLowPoints !== undefined) updateData.subLowPoints = subLowPoints ? 1 : 0;
    if (subFeatureUpdates !== undefined) updateData.subFeatureUpdates = subFeatureUpdates ? 1 : 0;
    if (subPromotions !== undefined) updateData.subPromotions = subPromotions ? 1 : 0;

    updateEmailSubscription(userId, updateData);

    // Award points for first subscription
    let pointsAwarded = 0;
    if (!wasAnySubEnabled && isAnySubEnabled && subscription.subscription_reward_claimed === 0) {
      const user = getUserById(userId);
      const newPoints = user.points + EMAIL_SUBSCRIPTION_REWARD;
      updateUserPoints(userId, newPoints);

      const db = getDb();
      db.prepare('UPDATE email_subscriptions SET subscription_reward_claimed = 1 WHERE user_id = ?')
        .run(userId);

      pointsAwarded = EMAIL_SUBSCRIPTION_REWARD;

      logEvent('info', '璁㈤槄閭欢濂栧姳', { points: pointsAwarded }, userId, req.ip);
    }

    const updatedSubscription = getEmailSubscription(userId);

    logEvent('info', '鏇存柊閭欢璁㈤槄', updateData, userId, req.ip);

    return res.json({
      success: true,
      subscription: updatedSubscription,
      pointsAwarded: pointsAwarded > 0 ? pointsAwarded : undefined
    });

  } catch (error) {
    console.error('鏇存柊璁㈤槄璁剧疆澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '鏇存柊澶辫触' });
  }
});

// POST /api/auth/forgot-password - Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'MISSING_EMAIL', message: '请输入邮箱' });
    }

    const user = getUserByEmail(sanitizeEmail(email));
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({ success: true, message: '重置邮件已发送' });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    // Create password reset token
    createPasswordResetToken({
      userId: user.id,
      token,
      expiresAt,
    });

    // Send reset email
    await sendPasswordResetEmail(user.email, token);

    logEvent('info', '璇锋眰瀵嗙爜閲嶇疆', { email: user.email }, user.id, req.ip);

    return res.json({ success: true, message: '重置邮件已发送' });

  } catch (error) {
    console.error('璇锋眰瀵嗙爜閲嶇疆澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '发送失败，请稍后重试' });
  }
});

// POST /api/auth/reset-password - Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: '缂哄皯蹇呰鍙傛暟' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'PASSWORD_TOO_SHORT', message: '密码至少 6 个字符' });
    }

    // Get token from database
    const resetToken = getPasswordResetToken(token);

    if (!resetToken) {
      return res.status(404).json({ error: 'INVALID_TOKEN', message: '无效的重置令牌' });
    }

    if (resetToken.used === 1) {
      return res.status(400).json({ error: 'TOKEN_USED', message: '该令牌已被使用' });
    }

    if (new Date(resetToken.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'TOKEN_EXPIRED', message: '令牌已过期' });
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);
    const db = getDb();
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, resetToken.userId);

    // Mark token as used
    markPasswordResetTokenUsed(token);

    logEvent('info', '瀵嗙爜閲嶇疆鎴愬姛', {}, resetToken.userId, req.ip);

    return res.json({ success: true, message: '密码已重置' });

  } catch (error) {
    console.error('瀵嗙爜閲嶇疆澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '閲嶇疆澶辫触' });
  }
});

// POST /api/email/claim-binding-reward - Claim email binding reward
app.post('/api/email/claim-binding-reward', requireAuth(JWT_SECRET), (req, res) => {
  try {
    const userId = req.auth.sub;
    const subscription = getEmailSubscription(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'NO_SUBSCRIPTION', message: '未找到邮箱订阅记录' });
    }

    if (subscription.emailVerified !== 1) {
      return res.status(400).json({ error: 'EMAIL_NOT_VERIFIED', message: '邮箱未验证' });
    }

    if (subscription.bindingRewardClaimed === 1) {
      return res.status(400).json({ error: 'ALREADY_CLAIMED', message: '奖励已领取' });
    }

    // Award points
    const user = getUserById(userId);
    const newPoints = user.points + EMAIL_BINDING_REWARD;
    updateUserPoints(userId, newPoints);

    // Mark as claimed
    const db = getDb();
    db.prepare('UPDATE email_subscriptions SET binding_reward_claimed = 1 WHERE user_id = ?')
      .run(userId);

    logEvent('info', '棰嗗彇閭缁戝畾濂栧姳', { points: EMAIL_BINDING_REWARD }, userId, req.ip);

    return res.json({
      success: true,
      pointsAwarded: EMAIL_BINDING_REWARD,
      newPoints
    });

  } catch (error) {
    console.error('棰嗗彇缁戝畾濂栧姳澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '棰嗗彇澶辫触' });
  }
});

// POST /api/email/claim-subscription-reward - Claim subscription reward
app.post('/api/email/claim-subscription-reward', requireAuth(JWT_SECRET), (req, res) => {
  try {
    const userId = req.auth.sub;
    const subscription = getEmailSubscription(userId);

    if (!subscription) {
      return res.status(404).json({ error: 'NO_SUBSCRIPTION', message: '未找到邮箱订阅记录' });
    }

    // Check if at least one subscription is enabled
    const hasSubscription = subscription.subDailyFortune || subscription.subMonthlyFortune ||
                           subscription.subYearlyFortune || subscription.subBirthdayReminder ||
                           subscription.subLowPoints || subscription.subFeatureUpdates ||
                           subscription.subPromotions;

    if (!hasSubscription) {
      return res.status(400).json({ error: 'NO_ACTIVE_SUBSCRIPTION', message: '请至少启用一项订阅' });
    }

    if (subscription.subscriptionRewardClaimed === 1) {
      return res.status(400).json({ error: 'ALREADY_CLAIMED', message: '奖励已领取' });
    }

    // Award points
    const user = getUserById(userId);
    const newPoints = user.points + EMAIL_SUBSCRIPTION_REWARD;
    updateUserPoints(userId, newPoints);

    // Mark as claimed
    const db = getDb();
    db.prepare('UPDATE email_subscriptions SET subscription_reward_claimed = 1 WHERE user_id = ?')
      .run(userId);

    logEvent('info', '棰嗗彇璁㈤槄濂栧姳', { points: EMAIL_SUBSCRIPTION_REWARD }, userId, req.ip);

    return res.json({
      success: true,
      pointsAwarded: EMAIL_SUBSCRIPTION_REWARD,
      newPoints
    });

  } catch (error) {
    console.error('棰嗗彇璁㈤槄濂栧姳澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: '棰嗗彇澶辫触' });
  }
});

// ============ Fortune API ============

// POST /api/fortune/daily - Get or generate daily fortune
app.post('/api/fortune/daily', async (req, res) => {
  const { profileId, date, enhanced } = req.body;

  // 楠岃瘉鍙傛暟
  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID', message: 'profileId is required' });
  }

  const dateKey = date || new Date().toISOString().split('T')[0];

  // 鑾峰彇璁よ瘉鐢ㄦ埛淇℃伅
  const authInfo = getAuthedUser(req);

  try {
    // 鑾峰彇妗ｆ
    const profile = getUserProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
    }

    // 楠岃瘉妗ｆ褰掑睘锛堝鏋滃凡鐧诲綍锛?
    if (authInfo && profile.userId !== authInfo.user.id) {
      return res.status(403).json({ error: 'ACCESS_DENIED', message: 'You can only access your own profiles' });
    }

    // 妫€鏌ョ紦瀛?
    const cached = getDailyFortuneDetail(profileId, dateKey);
    if (cached) {
      // 濡傛灉璇锋眰AI澧炲己鐗堜絾缂撳瓨涓病鏈夛紝缁х画鐢熸垚
      if (enhanced && !cached.aiEnhanced) {
        // 缁х画鍒颁笅闈㈢敓鎴怉I澧炲己鍐呭
      } else {
        return res.json({
          fortune: cached.fortuneData,
          fromCache: true,
          pointsDeducted: 0,
          remainingPoints: authInfo ? authInfo.user.points : null,
          aiEnhanced: cached.aiEnhanced,
        });
      }
    }

    // AI澧炲己鐗堥渶瑕佺櫥褰曞拰鎵ｇ偣
    if (enhanced) {
      if (!authInfo) {
        return res.status(401).json({
          error: 'AUTH_REQUIRED',
          message: '每日运势 AI 增强版需要登录',
          cost: POINTS_CONFIG.PAID.DAILY_FORTUNE_AI,
        });
      }

      const pointsCheck = checkUserPoints(authInfo.user.id, 'DAILY_FORTUNE_AI');
      if (!pointsCheck.sufficient) {
        return res.status(402).json({
          error: 'INSUFFICIENT_POINTS',
          message: '绉垎涓嶈冻',
          required: pointsCheck.required,
          current: pointsCheck.current,
        });
      }
    }

    // 鏋勫缓鍏瓧鏁版嵁
    const bazi = {
      yearPillar: profile.yearPillar || '',
      monthPillar: profile.monthPillar || '',
      dayPillar: profile.dayPillar || '',
      hourPillar: profile.hourPillar || '',
      gender: profile.gender,
    };

    // 浣跨敤FortuneCalculator鐢熸垚鍩虹杩愬娍
    const { Lunar, Solar } = await import('lunar-javascript');
    const targetDate = new Date(dateKey);
    const solar = Solar.fromDate(targetDate);
    const lunar = solar.getLunar();
    const dayGanZhi = `${lunar.getDayGan()}${lunar.getDayZhi()}`;
    const lunarDateStr = `${lunar.getMonthInChinese()}鏈?{lunar.getDayInChinese()}`;

    // 鍩虹杩愬娍璁＄畻锛堟湰鍦帮級
    const baseFortune = calculateBasicDailyFortune(bazi, targetDate, dayGanZhi, lunar);

    let aiEnhancedData = null;
    let pointsDeducted = 0;

    // AI澧炲己鐗堬細璋冪敤Agent
    if (enhanced && authInfo) {
      try {
        aiEnhancedData = await generateDailyFortuneAI(bazi, dateKey, dayGanZhi, lunarDateStr, profile);

        // 鎵ｉ櫎绉垎
        const deductResult = deductUserPoints(authInfo.user.id, 'DAILY_FORTUNE_AI', req.ip);
        if (deductResult.success) {
          pointsDeducted = deductResult.cost;
        }
      } catch (aiError) {
        console.error('AI澧炲己鐢熸垚澶辫触:', aiError);
        // AI澶辫触涓嶅奖鍝嶅熀纭€鐗堣繑鍥?
      }
    }

    // 缁勮瀹屾暣杩愬娍鏁版嵁
    const fortuneData = {
      date: dateKey,
      dayGanZhi,
      lunarDate: lunarDateStr,
      ...baseFortune,
      ...(aiEnhancedData || {}),
      generatedAt: new Date().toISOString(),
    };

    // 淇濆瓨鍒扮紦瀛?
    saveDailyFortuneDetail({
      id: nanoid(),
      profileId,
      dateKey,
      fortuneData,
      aiEnhanced: !!aiEnhancedData,
      modelUsed: aiEnhancedData ? 'claude-sonnet-4' : null,
      pointsCost: pointsDeducted,
      // AI澧炲己鐗堟案涔呯紦瀛橈紝鍩虹鐗堟鏃ヨ繃鏈?
      expiresAt: aiEnhancedData ? null : getNextMidnight().toISOString(),
    });

    logEvent('info', '鐢熸垚姣忔棩杩愬娍', {
      profileId,
      dateKey,
      enhanced: !!aiEnhancedData,
      pointsDeducted,
    }, authInfo?.user.id, req.ip);

    return res.json({
      fortune: fortuneData,
      fromCache: false,
      pointsDeducted,
      remainingPoints: authInfo ? getUserById(authInfo.user.id).points : null,
      aiEnhanced: !!aiEnhancedData,
    });

  } catch (error) {
    console.error('鐢熸垚姣忔棩杩愬娍澶辫触:', error);
    return res.status(500).json({ error: 'GENERATION_FAILED', message: error.message });
  }
});

// GET /api/fortune/daily/:date - Get cached daily fortune
app.get('/api/fortune/daily/:date', (req, res) => {
  const { date } = req.params;
  const { profileId } = req.query;

  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID' });
  }

  const cached = getDailyFortuneDetail(profileId, date);
  if (!cached) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'No fortune data for this date' });
  }

  return res.json({
    fortune: cached.fortuneData,
    aiEnhanced: cached.aiEnhanced,
    createdAt: cached.createdAt,
  });
});

// GET /api/fortune/monthly/:year/:month - Get monthly fortune (free)
app.get('/api/fortune/monthly/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const { profileId } = req.query;

  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID' });
  }

  try {
    const profile = getUserProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    const dateKey = `${year}-${month.padStart(2, '0')}`;

    // 妫€鏌ョ紦瀛?
    const cached = getFortuneCache(profileId, 'monthly', dateKey);
    if (cached) {
      return res.json({ fortune: cached.predictions, fromCache: true });
    }

    // 鐢熸垚鏈堝害杩愬娍锛堟湰鍦拌绠楋級
    const bazi = {
      yearPillar: profile.yearPillar || '',
      monthPillar: profile.monthPillar || '',
      dayPillar: profile.dayPillar || '',
      hourPillar: profile.hourPillar || '',
      gender: profile.gender,
    };

    const fortune = calculateBasicMonthlyFortune(bazi, parseInt(year), parseInt(month));

    // 淇濆瓨缂撳瓨锛?涓湀杩囨湡锛?
    const nextMonth = new Date(parseInt(year), parseInt(month), 1);
    createFortuneCache({
      id: nanoid(),
      profileId,
      fortuneType: 'monthly',
      dateKey,
      predictions: fortune,
      expiresAt: nextMonth.toISOString(),
    });

    return res.json({ fortune, fromCache: false });

  } catch (error) {
    console.error('鑾峰彇鏈堝害杩愬娍澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/fortune/yearly/:year - Get yearly fortune (free)
app.get('/api/fortune/yearly/:year', (req, res) => {
  const { year } = req.params;
  const { profileId } = req.query;

  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID' });
  }

  try {
    const profile = getUserProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    const dateKey = year;

    // 妫€鏌ョ紦瀛?
    const cached = getFortuneCache(profileId, 'yearly', dateKey);
    if (cached) {
      return res.json({ fortune: cached.predictions, fromCache: true });
    }

    // 鐢熸垚骞村害杩愬娍锛堟湰鍦拌绠楋級
    const bazi = {
      yearPillar: profile.yearPillar || '',
      monthPillar: profile.monthPillar || '',
      dayPillar: profile.dayPillar || '',
      hourPillar: profile.hourPillar || '',
      gender: profile.gender,
    };

    const fortune = calculateBasicYearlyFortune(bazi, parseInt(year));

    // 淇濆瓨缂撳瓨锛?骞磋繃鏈燂級
    const nextYear = new Date(parseInt(year) + 1, 0, 1);
    createFortuneCache({
      id: nanoid(),
      profileId,
      fortuneType: 'yearly',
      dateKey,
      predictions: fortune,
      expiresAt: nextYear.toISOString(),
    });

    return res.json({ fortune, fromCache: false });

  } catch (error) {
    console.error('鑾峰彇骞村害杩愬娍澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// GET /api/fortune/cache-status - Check cache status for a profile
app.get('/api/fortune/cache-status', (req, res) => {
  const { profileId, date } = req.query;

  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID' });
  }

  const today = date || new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const dailyCached = getDailyFortuneDetail(profileId, today);
  const monthlyCached = getFortuneCache(profileId, 'monthly', `${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const yearlyCached = getFortuneCache(profileId, 'yearly', String(currentYear));

  return res.json({
    status: {
      daily: !!dailyCached,
      dailyAiEnhanced: dailyCached?.aiEnhanced || false,
      monthly: !!monthlyCached,
      yearly: !!yearlyCached,
    },
    profileId,
    date: today,
  });
});

// ============ Helper Functions ============

// 鑾峰彇涓嬩竴涓崍澶滄椂闂?
function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight;
}

// 璁＄畻鍏瓧鐩镐技搴?
function calculateBaziSimilarity(celebrityBazi, userBazi) {
  let matchPoints = 0;
  const maxPoints = 100;
  const details = [];

  const heavenlyStems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const earthlyBranches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 浜旇灞炴€?
  const stemElement = {
    '甲': '木', '乙': '木',
    '丙': '火', '丁': '火',
    '戊': '土', '己': '土',
    '庚': '金', '辛': '金',
    '壬': '水', '癸': '水',
  };

  const branchElement = {
    '子': '水', '丑': '土', '寅': '木', '卯': '木',
    '辰': '土', '巳': '火', '午': '火', '未': '土',
    '申': '金', '酉': '金', '戌': '土', '亥': '水',
  };

  // 1. 骞存煴鍖归厤锛?5鍒嗭級
  if (celebrityBazi.yearPillar === userBazi.yearPillar) {
    matchPoints += 25;
    details.push({ pillar: '骞存煴', match: 'exact', points: 25, text: '骞存煴瀹屽叏鐩稿悓' });
  } else {
    const celebrityStem = celebrityBazi.yearPillar[0];
    const celebrityBranch = celebrityBazi.yearPillar[1];
    const userStem = userBazi.yearPillar[0];
    const userBranch = userBazi.yearPillar[1];

    let pillarPoints = 0;
    if (stemElement[celebrityStem] === stemElement[userStem]) {
      pillarPoints += 10;
      details.push({ pillar: '骞存煴', match: 'stem_element', points: 10, text: '骞村共浜旇鐩稿悓' });
    }
    if (branchElement[celebrityBranch] === branchElement[userBranch]) {
      pillarPoints += 10;
      details.push({ pillar: '骞存煴', match: 'branch_element', points: 10, text: '骞存敮浜旇鐩稿悓' });
    }
    matchPoints += pillarPoints;
  }

  // 2. 鏈堟煴鍖归厤锛?5鍒嗭級
  if (celebrityBazi.monthPillar === userBazi.monthPillar) {
    matchPoints += 25;
    details.push({ pillar: '鏈堟煴', match: 'exact', points: 25, text: '鏈堟煴瀹屽叏鐩稿悓' });
  } else {
    const celebrityStem = celebrityBazi.monthPillar[0];
    const celebrityBranch = celebrityBazi.monthPillar[1];
    const userStem = userBazi.monthPillar[0];
    const userBranch = userBazi.monthPillar[1];

    let pillarPoints = 0;
    if (stemElement[celebrityStem] === stemElement[userStem]) {
      pillarPoints += 10;
      details.push({ pillar: '鏈堟煴', match: 'stem_element', points: 10, text: '鏈堝共浜旇鐩稿悓' });
    }
    if (branchElement[celebrityBranch] === branchElement[userBranch]) {
      pillarPoints += 10;
      details.push({ pillar: '鏈堟煴', match: 'branch_element', points: 10, text: '鏈堟敮浜旇鐩稿悓' });
    }
    matchPoints += pillarPoints;
  }

  // 3. 鏃ユ煴鍖归厤锛?0鍒?- 鏈€閲嶈锛?
  if (celebrityBazi.dayPillar === userBazi.dayPillar) {
    matchPoints += 30;
    details.push({ pillar: '鏃ユ煴', match: 'exact', points: 30, text: '鏃ユ煴瀹屽叏鐩稿悓锛堟棩涓荤浉鍚岋級' });
  } else {
    const celebrityStem = celebrityBazi.dayPillar[0];
    const celebrityBranch = celebrityBazi.dayPillar[1];
    const userStem = userBazi.dayPillar[0];
    const userBranch = userBazi.dayPillar[1];

    let pillarPoints = 0;
    if (celebrityStem === userStem) {
      pillarPoints += 15;
      details.push({ pillar: '鏃ユ煴', match: 'day_master', points: 15, text: '鏃ヤ富鐩稿悓锛堝懡鏍肩浉浼硷級' });
    } else if (stemElement[celebrityStem] === stemElement[userStem]) {
      pillarPoints += 8;
      details.push({ pillar: '鏃ユ煴', match: 'stem_element', points: 8, text: '鏃ュ共浜旇鐩稿悓' });
    }
    if (branchElement[celebrityBranch] === branchElement[userBranch]) {
      pillarPoints += 8;
      details.push({ pillar: '鏃ユ煴', match: 'branch_element', points: 8, text: '鏃ユ敮浜旇鐩稿悓' });
    }
    matchPoints += pillarPoints;
  }

  // 4. 鏃舵煴鍖归厤锛?0鍒嗭級
  if (celebrityBazi.hourPillar === userBazi.hourPillar) {
    matchPoints += 20;
    details.push({ pillar: '鏃舵煴', match: 'exact', points: 20, text: '鏃舵煴瀹屽叏鐩稿悓' });
  } else {
    const celebrityStem = celebrityBazi.hourPillar[0];
    const celebrityBranch = celebrityBazi.hourPillar[1];
    const userStem = userBazi.hourPillar[0];
    const userBranch = userBazi.hourPillar[1];

    let pillarPoints = 0;
    if (stemElement[celebrityStem] === stemElement[userStem]) {
      pillarPoints += 8;
      details.push({ pillar: '鏃舵煴', match: 'stem_element', points: 8, text: '鏃跺共浜旇鐩稿悓' });
    }
    if (branchElement[celebrityBranch] === branchElement[userBranch]) {
      pillarPoints += 8;
      details.push({ pillar: '鏃舵煴', match: 'branch_element', points: 8, text: '鏃舵敮浜旇鐩稿悓' });
    }
    matchPoints += pillarPoints;
  }

  return {
    matchPoints,
    maxPoints,
    percentage: Math.round((matchPoints / maxPoints) * 100),
    details,
    interpretation: getInterpretation(matchPoints)
  };
}

// 鐩镐技搴﹁В璇?
function getInterpretation(matchPoints) {
  if (matchPoints >= 80) {
    return {
      level: 'very_high',
      text: '极高相似度',
      description: '你与该名人的八字格局高度相似，可能在人生轨迹、性格特征和起伏节奏上有很强共鸣。',
    };
  }
  if (matchPoints >= 60) {
    return {
      level: 'high',
      text: '高相似度',
      description: '你与该名人的八字有较多共同点，在某些人生阶段或特定领域可能会有相似经历。',
    };
  }
  if (matchPoints >= 40) {
    return {
      level: 'medium',
      text: '中等相似度',
      description: '你与该名人在部分命理特征上有共通之处，可作为人生参考，但仍需注意个体差异。',
    };
  }
  if (matchPoints >= 20) {
    return {
      level: 'low',
      text: '低相似度',
      description: '你与该名人的八字差异较大，命运轨迹可能明显不同，参考价值有限。',
    };
  }
  return {
    level: 'very_low',
    text: '极低相似度',
    description: '你与该名人的八字格局差异显著，命运走向可能完全不同。',
  };
}

// 鍩虹姣忔棩杩愬娍璁＄畻锛堟湰鍦帮級
function calculateBasicDailyFortune(bazi, date, dayGanZhi, lunar) {
  const heavenlyStems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const earthlyBranches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  const dayMaster = bazi.dayPillar?.[0] || '甲';
  const dayStem = dayGanZhi[0];
  const dayBranch = dayGanZhi[1];

  // 璁＄畻鍩虹鍒嗘暟
  let baseScore = 60;

  // 澶╁共鍏崇郴
  const stemIndex1 = heavenlyStems.indexOf(dayMaster);
  const stemIndex2 = heavenlyStems.indexOf(dayStem);
  if (stemIndex1 === stemIndex2) baseScore += 10;
  else if ((stemIndex1 - stemIndex2 + 10) % 10 === 5) baseScore -= 15;
  else if ((stemIndex1 - stemIndex2 + 10) % 2 === 0) baseScore += 5;

  // 鍦版敮鍏崇郴
  const dayPillarBranch = bazi.dayPillar?.[1] || '子';
  const branchIndex1 = earthlyBranches.indexOf(dayPillarBranch);
  const branchIndex2 = earthlyBranches.indexOf(dayBranch);

  // 鍏悎
  const combinations = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
  if (combinations.some(c => c.includes(dayPillarBranch) && c.includes(dayBranch))) {
    baseScore += 15;
  }

  // 鍏啿
  const clashes = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
  if (clashes.some(c => c.includes(dayPillarBranch) && c.includes(dayBranch))) {
    baseScore -= 20;
  }

  // 闅忔満娉㈠姩
  const dateHash = date.getTime() % 20 - 10;
  baseScore += dateHash;
  baseScore = Math.max(30, Math.min(95, baseScore));

  // 璁＄畻鍚勭淮搴﹀垎鏁?
  const careerScore = Math.max(30, Math.min(95, baseScore + Math.floor(Math.random() * 20 - 10)));
  const wealthScore = Math.max(30, Math.min(95, baseScore + Math.floor(Math.random() * 20 - 10)));
  const relationshipScore = Math.max(30, Math.min(95, baseScore + Math.floor(Math.random() * 20 - 10)));
  const healthScore = Math.max(30, Math.min(95, baseScore + Math.floor(Math.random() * 20 - 10)));

  const getTrend = (score) => score > 70 ? 'up' : score < 45 ? 'down' : 'stable';

  // 浜旇棰滆壊
  const elementColors = {
    '甲': ['绿色', '青色'], '乙': ['绿色', '青色'],
    '丙': ['红色', '紫色'], '丁': ['红色', '紫色'],
    '戊': ['黄色', '棕色'], '己': ['黄色', '棕色'],
    '庚': ['白色', '金色'], '辛': ['白色', '金色'],
    '壬': ['黑色', '蓝色'], '癸': ['黑色', '蓝色'],
  };

  const elementDirections = {
    '甲': ['东方'], '乙': ['东方'],
    '丙': ['南方'], '丁': ['南方'],
    '戊': ['中央'], '己': ['中央'],
    '庚': ['西方'], '辛': ['西方'],
    '壬': ['北方'], '癸': ['北方'],
  };

  return {
    overallScore: baseScore,
    overallTrend: getTrend(baseScore),
    overallSummary: baseScore > 70 ? '浠婃棩杩愬娍鑹ソ锛岄€傚悎涓诲姩鍑哄嚮' :
                    baseScore < 45 ? '浠婃棩杩愬娍杈冨急锛屽疁闈欎笉瀹滃姩' :
                    '今日运势平稳，宜稳中求进',
    career: {
      score: careerScore,
      trend: getTrend(careerScore),
      description: careerScore > 70 ? '事业运势旺盛，贵人相助' : careerScore < 45 ? '事业面临挑战，需要谨慎' : '事业运势平稳',
      advice: careerScore > 70 ? '把握机会，积极表现' : '保持低调，稳步前进',
      keyPoint: careerScore > 70 ? '今日适合争取项目' : '今日宜保守行事',
    },
    wealth: {
      score: wealthScore,
      trend: getTrend(wealthScore),
      description: wealthScore > 70 ? '财运亨通，收入有增' : wealthScore < 45 ? '财运较弱，注意支出' : '财运平稳',
      advice: wealthScore > 70 ? '可适当投资' : '避免高风险投资',
      keyPoint: wealthScore > 70 ? '今日财运佳' : '今日宜保守理财',
    },
    relationship: {
      score: relationshipScore,
      trend: getTrend(relationshipScore),
      description: relationshipScore > 70 ? '浜洪檯鍏崇郴鍜岃皭' : relationshipScore < 45 ? '闇€娉ㄦ剰浜洪檯鍏崇郴' : '鎰熸儏杩愬娍骞崇ǔ',
      advice: relationshipScore > 70 ? '多参与社交活动' : '避免不必要的冲突',
      keyPoint: relationshipScore > 70 ? '今日适合社交' : '今日宜低调',
    },
    health: {
      score: healthScore,
      trend: getTrend(healthScore),
      description: healthScore > 70 ? '身体状态良好' : healthScore < 45 ? '需要注意休息' : '健康状况一般',
      advice: healthScore > 70 ? '保持良好作息' : '注意饮食和休息',
      keyPoint: healthScore > 70 ? '精力充沛' : '注意劳逸结合',
    },
    auspiciousHours: [
      { hour: '09:00-11:00', branch: '宸虫椂', quality: 'good', activities: ['绛剧害', '浼氳'] },
      { hour: '13:00-15:00', branch: '鏈椂', quality: 'good', activities: ['绀句氦', '鎷滆'] },
    ],
    luckyElements: {
      colors: elementColors[dayMaster] || ['绾㈣壊'],
      directions: elementDirections[dayMaster] || ['鍗楁柟'],
      numbers: [date.getDate() % 9 + 1, (date.getDate() + 3) % 9 + 1],
      zodiac: ['马', '虎'],
    },
    dailyAdvice: [
      baseScore > 70 ? '今日适合主动出击' : '今日宜稳中求进',
      '保持积极心态',
    ],
    warnings: baseScore < 50 ? ['注意劳逸结合', '避免重要决策'] : [],
  };
}

// 鍩虹鏈堝害杩愬娍璁＄畻
function calculateBasicMonthlyFortune(bazi, year, month) {
  const dayMaster = bazi.dayPillar?.[0] || '甲';
  let baseScore = 65;

  // 绠€鍗曠殑鏈堜唤褰卞搷璁＄畻
  const monthFactor = (month + year) % 12;
  baseScore += (monthFactor - 6) * 3;
  baseScore = Math.max(40, Math.min(90, baseScore));

  const themes = ['财运月', '事业月', '学习月', '平稳月', '权威月'];
  const theme = themes[month % themes.length];

  return {
    year,
    month,
    overallScore: baseScore,
    theme: `${theme} - ${baseScore > 70 ? '鎶婃彙鏈洪亣' : '绋充腑姹傝繘'}`,
    career: { score: baseScore + Math.floor(Math.random() * 10 - 5), advice: '绋虫鍙戝睍' },
    wealth: { score: baseScore + Math.floor(Math.random() * 10 - 5), advice: '理性理财' },
    relationship: { score: baseScore + Math.floor(Math.random() * 10 - 5), advice: '鐢ㄥ績缁忚惀' },
    health: { score: baseScore + Math.floor(Math.random() * 10 - 5), advice: '娉ㄦ剰浣滄伅' },
    keyDates: [
      { date: 8, event: '閫傚悎绛剧害', impact: 'positive' },
      { date: 15, event: '璐典汉鐩稿姪', impact: 'positive' },
      { date: 22, event: '娉ㄦ剰鍋ュ悍', impact: 'neutral' },
    ],
    monthlyAdvice: ['把握本月机遇', '注意劳逸结合'],
  };
}

// 鍩虹骞村害杩愬娍璁＄畻
function calculateBasicYearlyFortune(bazi, year) {
  const dayMaster = bazi.dayPillar?.[0] || '甲';
  let baseScore = 68;

  // 骞翠唤褰卞搷
  const yearFactor = year % 10;
  baseScore += (yearFactor - 5) * 2;
  baseScore = Math.max(45, Math.min(88, baseScore));

  const trends = ['rising', 'stable', 'volatile', 'declining'];
  const trend = baseScore > 75 ? 'rising' : baseScore > 60 ? 'stable' : baseScore > 50 ? 'volatile' : 'declining';

  return {
    year,
    overallScore: baseScore,
    overallTrend: trend,
    analysis: {
      career: { score: baseScore + 5, peakMonths: [3, 8], challengingMonths: [6], advice: '绋虫鍙戝睍' },
      wealth: { score: baseScore + 2, peakMonths: [5, 11], challengingMonths: [2], advice: '理性投资' },
      relationship: { score: baseScore, peakMonths: [2, 9], challengingMonths: [7], advice: '鐢ㄥ績缁忚惀' },
      health: { score: baseScore - 3, peakMonths: [4, 10], challengingMonths: [1], advice: '娉ㄦ剰璋冨吇' },
    },
    keyMoments: [
      { month: 3, event: '浜嬩笟鏈洪亣', impact: 'major', type: 'opportunity' },
      { month: 8, event: '璐㈣繍楂樺嘲', impact: 'major', type: 'opportunity' },
    ],
    favorableMonths: [3, 5, 8, 11],
    challengingMonths: [2, 6, 9],
    yearlyAdvice: [
      trend === 'rising' ? '鎶婃彙鏈轰細绉瀬杩涘彇' : '绋充腑姹傝繘',
      '淇濇寔韬績鍋ュ悍',
      '鐢ㄥ績缁忚惀浜洪檯鍏崇郴',
    ],
  };
}

// AI澧炲己鐗堟瘡鏃ヨ繍鍔跨敓鎴?
async function generateDailyFortuneAI(bazi, dateKey, dayGanZhi, lunarDateStr, profile) {
  const userPrompt = `
璇蜂负浠ヤ笅鍛戒富鐢熸垚${dateKey}鐨勮缁嗘瘡鏃ヨ繍鍔垮垎鏋愩€?

**鍛戒富鍏瓧锛?*
骞存煴锛?{bazi.yearPillar}
鏈堟煴锛?{bazi.monthPillar}
鏃ユ煴锛?{bazi.dayPillar}
鏃舵煴锛?{bazi.hourPillar}
鎬у埆锛?{bazi.gender === 'male' ? '鐢? : '濂?}

**浠婃棩淇℃伅锛?*
闃冲巻锛?{dateKey}
鍐滃巻锛?{lunarDateStr}
娴佹棩骞叉敮锛?{dayGanZhi}

璇蜂弗鏍兼寜鐓SON鏍煎紡杈撳嚭锛屽寘鍚繁搴﹀垎鏋愬拰鍏蜂綋寤鸿銆?
`;

  try {
    const response = await fetch(`${DEFAULT_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEFAULT_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-3-pro-preview',
        messages: [
          { role: 'system', content: AGENT_DAILY_FORTUNE_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty AI response');
    }

    // 瑙ｆ瀽JSON鍝嶅簲
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('AI澧炲己杩愬娍鐢熸垚澶辫触:', error);
    throw error;
  }
}

// ===============================
// K-line API Endpoints
// ===============================

// POST /api/kline/yearly - Generate 36-month K-line (FREE)
app.post('/api/kline/yearly', async (req, res) => {
  const { profileId } = req.body;

  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID' });
  }

  try {
    const profile = getUserProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    const currentYear = new Date().getFullYear();
    const cacheKey = `${currentYear}`;

    // Check cache
    const cached = getFortuneCache(profileId, 'yearly_kline', cacheKey);
    if (cached) {
      return res.json({
        kline: cached.predictions,
        fromCache: true,
        years: [currentYear - 1, currentYear, currentYear + 1]
      });
    }

    // Generate 36-month timeline
    const skeleton = calculate36MonthTimeline({
      yearPillar: profile.yearPillar || '',
      monthPillar: profile.monthPillar || '',
      dayPillar: profile.dayPillar || '',
      hourPillar: profile.hourPillar || '',
      gender: profile.gender,
      startAge: profile.startAge || 1,
      birthYear: profile.birthYear
    }, currentYear);

    // Generate K-line using fallback algorithm (no AI for free tier)
    const klineData = generate36MonthFallbackKLine(skeleton);

    // Prepare result
    const result = {
      monthlyPoints: klineData,
      bestMonths: klineData
        .filter(p => p.score >= 75)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(p => ({ year: p.year, month: p.month, reason: `${p.keyword} - 缁煎悎璇勫垎${p.score}` })),
      worstMonths: klineData
        .filter(p => p.score <= 45)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(p => ({ year: p.year, month: p.month, reason: `${p.keyword} - 缁煎悎璇勫垎${p.score}` })),
      yearlyTrends: {}
    };

    // Calculate yearly trends
    for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
      const yearPoints = klineData.filter(p => p.year === year);
      const avgScore = yearPoints.reduce((sum, p) => sum + p.score, 0) / yearPoints.length;
      result.yearlyTrends[year] = {
        avgScore: Math.round(avgScore),
        theme: avgScore >= 70 ? '收获年' : avgScore >= 55 ? '平稳年' : '调整年',
        keywords: avgScore >= 70 ? ['鏈洪亣', '绐佺牬'] : avgScore >= 55 ? ['绋冲畾', '绉疮'] : ['璋冩暣', '钃勫姏']
      };
    }

    // Cache for 1 year
    const nextYear = new Date(currentYear + 1, 0, 1);
    createFortuneCache({
      id: nanoid(),
      profileId,
      fortuneType: 'yearly_kline',
      dateKey: cacheKey,
      predictions: result,
      expiresAt: nextYear.toISOString()
    });

    return res.json({
      kline: result,
      fromCache: false,
      years: [currentYear - 1, currentYear, currentYear + 1]
    });

  } catch (error) {
    console.error('鐢熸垚36鏈圞绾垮け璐?', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /api/kline/monthly - Generate 7-month K-line (30 points)
app.post('/api/kline/monthly', async (req, res) => {
  const { profileId } = req.body;

  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID' });
  }

  // Get user from cookie
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }

  const user = getUserById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'USER_NOT_FOUND' });
  }

  const COST = 30;

  // Check points
  if (user.points < COST) {
    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      required: COST,
      current: user.points
    });
  }

  try {
    const profile = getUserProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const cacheKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // Check cache
    const cached = getFortuneCache(profileId, 'monthly_kline', cacheKey);
    if (cached) {
      return res.json({
        kline: cached.predictions,
        fromCache: true,
        centerMonth: { year: currentYear, month: currentMonth }
      });
    }

    // Deduct points
    updateUserPoints(user.id, user.points - COST);
    logEvent('points_deduct', { userId: user.id, amount: COST, feature: 'MONTHLY_KLINE' });

    // Generate 7-month timeline
    const skeleton = calculate7MonthTimeline({
      yearPillar: profile.yearPillar || '',
      monthPillar: profile.monthPillar || '',
      dayPillar: profile.dayPillar || '',
      hourPillar: profile.hourPillar || '',
      gender: profile.gender,
      startAge: profile.startAge || 1,
      birthYear: profile.birthYear
    }, currentYear, currentMonth);

    // Generate K-line
    const klineData = generate7MonthFallbackKLine(skeleton);

    const result = {
      monthlyPoints: klineData,
      focusMonth: klineData.find(p => p.isCurrent),
      bestMonths: klineData.filter(p => p.score >= 70).map(p => ({
        year: p.year,
        month: p.month,
        reason: p.keyword
      })),
      worstMonths: klineData.filter(p => p.score <= 45).map(p => ({
        year: p.year,
        month: p.month,
        reason: p.keyword
      }))
    };

    // Cache for 1 month
    const nextMonth = new Date(currentYear, currentMonth, 1);
    createFortuneCache({
      id: nanoid(),
      profileId,
      fortuneType: 'monthly_kline',
      dateKey: cacheKey,
      predictions: result,
      expiresAt: nextMonth.toISOString()
    });

    return res.json({
      kline: result,
      fromCache: false,
      centerMonth: { year: currentYear, month: currentMonth },
      remainingPoints: user.points - COST
    });

  } catch (error) {
    console.error('鐢熸垚7鏈圞绾垮け璐?', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// POST /api/kline/daily - Generate 61-day K-line (20 points)
app.post('/api/kline/daily', async (req, res) => {
  const { profileId, date } = req.body;

  if (!profileId) {
    return res.status(400).json({ error: 'MISSING_PROFILE_ID' });
  }

  // Get user from cookie
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }

  const user = getUserById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'USER_NOT_FOUND' });
  }

  const COST = 20;

  // Check points
  if (user.points < COST) {
    return res.status(402).json({
      error: 'INSUFFICIENT_POINTS',
      required: COST,
      current: user.points
    });
  }

  try {
    const profile = getUserProfileById(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    }

    const centerDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = centerDate;

    // Check cache
    const cached = getFortuneCache(profileId, 'daily_kline', cacheKey);
    if (cached) {
      return res.json({
        kline: cached.predictions,
        fromCache: true,
        centerDate
      });
    }

    // Deduct points
    updateUserPoints(user.id, user.points - COST);
    logEvent('points_deduct', { userId: user.id, amount: COST, feature: 'DAILY_KLINE' });

    // Generate 61-day timeline
    const skeleton = calculate61DayTimeline({
      yearPillar: profile.yearPillar || '',
      monthPillar: profile.monthPillar || '',
      dayPillar: profile.dayPillar || '',
      hourPillar: profile.hourPillar || '',
      gender: profile.gender,
      startAge: profile.startAge || 1,
      birthYear: profile.birthYear
    }, centerDate);

    // Generate K-line
    const klineData = generate61DayFallbackKLine(skeleton);

    const result = {
      dailyPoints: klineData,
      todayAnalysis: klineData.find(p => p.isCurrent),
      bestDays: klineData
        .filter(p => p.score >= 70)
        .slice(0, 5)
        .map(p => ({ date: p.date, reason: p.qualityText })),
      worstDays: klineData
        .filter(p => p.score <= 40)
        .slice(0, 5)
        .map(p => ({ date: p.date, reason: p.qualityText }))
    };

    // Cache for 1 day
    const tomorrow = new Date(centerDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    createFortuneCache({
      id: nanoid(),
      profileId,
      fortuneType: 'daily_kline',
      dateKey: cacheKey,
      predictions: result,
      expiresAt: tomorrow.toISOString()
    });

    return res.json({
      kline: result,
      fromCache: false,
      centerDate,
      remainingPoints: user.points - COST
    });

  } catch (error) {
    console.error('鐢熸垚61澶㎏绾垮け璐?', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// ============ Pricing Management API ============

// GET /api/admin/pricing - Get all pricing configuration
app.get('/api/admin/pricing', requireAdmin, (req, res) => {
  try {
    const features = getPricing();
    const packages = getPointPackages();

    return res.json({
      features,
      packages
    });
  } catch (error) {
    console.error('鑾峰彇瀹氫环閰嶇疆澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// PUT /api/admin/pricing - Update pricing configuration
app.put('/api/admin/pricing', requireAdmin, (req, res) => {
  try {
    const { features } = req.body;

    if (!features || !Array.isArray(features)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'features must be an array' });
    }

    // 鎵归噺鏇存柊鍔熻兘瀹氫环
    const configs = features.map(f => ({
      feature_key: f.feature_key,
      points: f.points,
      price_usd: f.price_usd,
      price_cny: f.price_cny,
      display_name: f.display_name,
      category: f.category
    }));

    const result = batchUpdatePricing(configs);

    if (!result.success) {
      return res.status(500).json({ error: 'UPDATE_FAILED', message: result.error });
    }

    logEvent('info', '鏇存柊瀹氫环閰嶇疆', { updated: result.updated }, null, req.ip);

    return res.json({
      success: true,
      updated: result.updated,
      message: `成功更新 ${result.updated} 项配置`
    });
  } catch (error) {
    console.error('鏇存柊瀹氫环閰嶇疆澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// GET /api/admin/packages - Get point packages
app.get('/api/admin/packages', requireAdmin, (req, res) => {
  try {
    const packages = getPointPackages();
    return res.json({ packages });
  } catch (error) {
    console.error('鑾峰彇绉垎濂楅澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// PUT /api/admin/packages - Update point packages
app.put('/api/admin/packages', requireAdmin, (req, res) => {
  try {
    const { packages } = req.body;

    if (!packages || !Array.isArray(packages)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'packages must be an array' });
    }

    // 鎵归噺鏇存柊绉垎濂楅
    const result = batchUpdatePointPackages(packages);

    if (!result.success) {
      return res.status(500).json({ error: 'UPDATE_FAILED', message: result.error });
    }

    logEvent('info', '鏇存柊绉垎濂楅', { updated: result.updated }, null, req.ip);

    return res.json({
      success: true,
      updated: result.updated,
      message: `成功更新 ${result.updated} 个套餐`
    });
  } catch (error) {
    console.error('鏇存柊绉垎濂楅澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// GET /api/public/pricing - Get public pricing info (for frontend display)
app.get('/api/public/pricing', (req, res) => {
  try {
    const pricing = getPublicPricing();
    return res.json(pricing);
  } catch (error) {
    console.error('鑾峰彇鍏紑瀹氫环淇℃伅澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  try {
    return res.json({
      stats: getStats(),
      users: getAllUsers(20, 0),
      analyses: getAllAnalyses(20, 0),
      orders: getPaymentOrders(20, 0),
      knowledgeCount: getKnowledgeArticleCount(),
      caseCount: getCaseCount(),
      wechatPay: getWechatPayPublicConfig(),
    });
  } catch (error) {
    console.error('鑾峰彇鍚庡彴姒傝澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.get('/api/admin/wechat-pay', requireAdmin, (_req, res) => {
  return res.json({ config: getWechatPayAdminConfig(), publicConfig: getWechatPayPublicConfig() });
});

app.put('/api/admin/wechat-pay', requireAdmin, (req, res) => {
  try {
    saveWechatPayConfig(req.body || {});
    logEvent('info', '鏇存柊寰俊鏀粯閰嶇疆', { fields: Object.keys(req.body || {}) }, null, req.ip);
    return res.json({ success: true, config: getWechatPayAdminConfig(), publicConfig: getWechatPayPublicConfig() });
  } catch (error) {
    console.error('淇濆瓨寰俊鏀粯閰嶇疆澶辫触:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return res.json({ orders: getPaymentOrders(limit, offset) });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return res.json({ users: getAllUsers(limit, offset) });
});

app.get('/api/admin/analyses', requireAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return res.json({ analyses: getAllAnalyses(limit, offset) });
});

app.get('/api/admin/content/knowledge', requireAdmin, (req, res) => {
  const { category } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return res.json({ items: getAllArticlesAdmin(category || null, limit, offset) });
});

app.put('/api/admin/content/knowledge/:id', requireAdmin, (req, res) => {
  try {
    const id = upsertArticle({ ...req.body, id: req.params.id });
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.post('/api/admin/content/knowledge', requireAdmin, (req, res) => {
  try {
    const id = upsertArticle(req.body);
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.get('/api/admin/content/cases', requireAdmin, (req, res) => {
  const { curveType } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return res.json({ items: getAllCasesAdmin(curveType || null, limit, offset) });
});

app.put('/api/admin/content/cases/:id', requireAdmin, (req, res) => {
  try {
    const id = upsertCase({ ...req.body, id: req.params.id });
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.post('/api/admin/content/cases', requireAdmin, (req, res) => {
  try {
    const id = upsertCase(req.body);
    return res.json({ success: true, id });
  } catch (error) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

app.post('/api/payment/wechat/create', requireAuth(JWT_SECRET), async (req, res) => {
  const packageId = String(req.body?.packageId || '').trim();
  const mode = req.body?.mode === 'h5' ? 'h5' : 'native';
  const returnUrl = String(req.body?.returnUrl || '').trim();
  const packages = getPointPackages();
  const pkg = packages.find(item => item.id === packageId && item.is_active !== false);

  if (!pkg) return res.status(404).json({ error: 'PACKAGE_NOT_FOUND', message: '积分套餐不存在' });
  if (!pkg.price_cny || pkg.price_cny <= 0) return res.status(400).json({ error: 'INVALID_PACKAGE_PRICE' });

  const totalPoints = Number(pkg.points || 0) + Number(pkg.bonus || 0);
  const amountCents = Math.round(Number(pkg.price_cny) * 100);
  const orderId = `wx_${Date.now()}_${nanoid(8)}`;

  let order = createPaymentOrder({
    id: orderId,
    userId: req.auth.sub,
    packageId: pkg.id,
    packageName: pkg.name,
    points: pkg.points,
    bonusPoints: pkg.bonus || 0,
    totalPoints,
    amountCents,
    provider: mode === 'h5' ? 'wechat_h5' : 'wechat_native',
  });

  try {
    const description = `${pkg.name} ${totalPoints}点`;
    if (mode === 'h5') {
      const result = await createWechatH5Order({
        order,
        description,
        clientIp: req.ip,
      });
      order = updatePaymentOrderPayInfo(order.id, { provider: 'wechat_h5' });
      const h5Url = returnUrl
        ? `${result.h5_url}${result.h5_url.includes('?') ? '&' : '?'}redirect_url=${encodeURIComponent(returnUrl)}`
        : result.h5_url;
      return res.json({ order, mode, h5Url });
    }

    const result = await createWechatNativeOrder({ order, description });
    order = updatePaymentOrderPayInfo(order.id, { codeUrl: result.code_url, provider: 'wechat_native' });
    return res.json({ order, mode, codeUrl: result.code_url });
  } catch (error) {
    markPaymentOrderFailed(order.id, { error: error.message });
    console.error('鍒涘缓寰俊鏀粯璁㈠崟澶辫触:', error);
    return res.status(500).json({ error: 'WECHAT_PAY_CREATE_FAILED', message: error.message });
  }
});

app.get('/api/payment/orders/:id', requireAuth(JWT_SECRET), async (req, res) => {
  const order = getPaymentOrder(req.params.id);
  if (!order || order.userId !== req.auth.sub) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

  if (order.status === 'pending') {
    try {
      const wxOrder = await queryWechatOrder(order.id);
      if (wxOrder.trade_state === 'SUCCESS') {
        const paid = markPaymentOrderPaid({
          orderId: order.id,
          transactionId: wxOrder.transaction_id,
          rawNotify: wxOrder,
        });
        return res.json({ order: paid.order, status: 'paid', newBalance: paid.newBalance });
      }
    } catch (error) {
      console.warn('鏌ヨ寰俊璁㈠崟澶辫触:', error.message);
    }
  }

  return res.json({ order: getPaymentOrder(order.id) });
});

app.post('/api/payment/wechat/notify', (req, res) => {
  try {
    const bodyText = req.rawBody || JSON.stringify(req.body || {});
    verifyWechatNotifySignature(req.headers, bodyText);
    const payload = JSON.parse(bodyText || '{}');
    const data = decryptWechatResource(payload.resource);
    const orderId = data.out_trade_no;
    const tradeState = data.trade_state;

    if (tradeState === 'SUCCESS') {
      const result = markPaymentOrderPaid({
        orderId,
        transactionId: data.transaction_id,
        rawNotify: data,
      });

      if (!result.success) {
        console.error('寰俊鏀粯鍥炶皟澶勭悊澶辫触:', result.error, orderId);
      } else {
        logEvent('info', '寰俊鏀粯鍒拌处', {
          orderId,
          transactionId: data.transaction_id,
          totalPoints: result.order.totalPoints,
          alreadyPaid: result.alreadyPaid,
        }, result.order.userId, null);
      }
    } else {
      markPaymentOrderFailed(orderId, data);
    }

    return res.json({ code: 'SUCCESS', message: '鎴愬姛' });
  } catch (error) {
    console.error('寰俊鏀粯閫氱煡澶勭悊澶辫触:', error);
    return res.status(500).json({ code: 'FAIL', message: error.message });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '..', 'dist');

app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
  process.stdout.write(`server listening on ${PORT}\n`);

  // Start email scheduler
  startEmailScheduler();
});

