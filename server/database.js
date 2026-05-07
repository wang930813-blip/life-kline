import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'lifekline.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
const initDatabase = () => {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      points INTEGER DEFAULT 1000,
      role TEXT DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT,
      last_login_at TEXT,
      login_count INTEGER DEFAULT 0
    )
  `);

  // 用户输入信息表（存储每次填写的八字信息）
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_inputs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      gender TEXT NOT NULL,
      birth_year INTEGER,
      year_pillar TEXT,
      month_pillar TEXT,
      day_pillar TEXT,
      hour_pillar TEXT,
      start_age INTEGER,
      first_da_yun TEXT,
      model_name TEXT,
      api_base_url TEXT,
      use_custom_api INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 分析结果表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      input_id TEXT,
      cost INTEGER DEFAULT 0,
      model_used TEXT,
      chart_data TEXT,
      analysis_data TEXT,
      created_at TEXT NOT NULL,
      processing_time_ms INTEGER,
      status TEXT DEFAULT 'completed',
      error_message TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (input_id) REFERENCES user_inputs(id)
    )
  `);

  // 系统日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      user_id TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 知识文章表
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      tags TEXT,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      view_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      published INTEGER DEFAULT 1
    )
  `);

  // 案例表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      persona TEXT NOT NULL,
      curve_type TEXT NOT NULL,
      chart_data TEXT NOT NULL,
      highlights TEXT,
      narrative TEXT NOT NULL,
      tags TEXT,
      view_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      published INTEGER DEFAULT 1
    )
  `);

  // 名人案例表（命理加强版）
  db.exec(`
    CREATE TABLE IF NOT EXISTS celebrity_cases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_cn TEXT NOT NULL,
      category TEXT NOT NULL,
      category_cn TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      birth_location_city TEXT,
      birth_location_lat REAL,
      birth_location_lng REAL,
      description TEXT NOT NULL,
      tags TEXT,
      year_pillar TEXT,
      month_pillar TEXT,
      day_pillar TEXT,
      hour_pillar TEXT,
      chart_data TEXT,
      highlights TEXT,
      hotness_score INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      published INTEGER DEFAULT 1
    )
  `);

  // 用户档案表（存储每个用户的多个八字档案，最多10个）
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
      birth_year INTEGER NOT NULL,
      year_pillar TEXT,
      month_pillar TEXT,
      day_pillar TEXT,
      hour_pillar TEXT,
      start_age INTEGER,
      first_da_yun TEXT,
      birth_place TEXT,
      is_default INTEGER DEFAULT 0 CHECK (is_default IN (0, 1)),
      is_deleted INTEGER DEFAULT 0 CHECK (is_deleted IN (0, 1)),
      deleted_at TEXT,
      core_document_status TEXT DEFAULT 'pending' CHECK (core_document_status IN ('pending', 'generating', 'ready', 'failed')),
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 添加软删除和核心文档状态字段（如果不存在）
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN is_deleted INTEGER DEFAULT 0`);
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN deleted_at TEXT`);
  } catch (e) { /* 列已存在 */ }
  try {
    db.exec(`ALTER TABLE user_profiles ADD COLUMN core_document_status TEXT DEFAULT 'pending'`);
  } catch (e) { /* 列已存在 */ }

  // 分享奖励表（基于信任，无限制）
  db.exec(`
    CREATE TABLE IF NOT EXISTS share_rewards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK (platform IN ('wechat', 'weibo', 'qq', 'douyin', 'xiaohongshu', 'other')),
      analysis_id TEXT,
      points_rewarded INTEGER DEFAULT 300,
      shared_at TEXT NOT NULL,
      ip_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 运势缓存表
  db.exec(`
    CREATE TABLE IF NOT EXISTS fortune_cache (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      fortune_type TEXT NOT NULL CHECK (fortune_type IN ('daily', 'monthly', 'yearly')),
      date_key TEXT NOT NULL,
      predictions TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
    )
  `);

  // 用户偏好设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
      notifications_enabled INTEGER DEFAULT 1 CHECK (notifications_enabled IN (0, 1)),
      default_profile_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (default_profile_id) REFERENCES user_profiles(id) ON DELETE SET NULL
    )
  `);

  // 每日运势详情表 - 存储AI增强的每日运势
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_fortune_detail (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      fortune_data TEXT NOT NULL,
      ai_enhanced INTEGER DEFAULT 0,
      model_used TEXT,
      points_cost INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
    )
  `);

  // 月度K线缓存表
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_kline_cache (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      kline_data TEXT NOT NULL,
      model_used TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
    )
  `);

  // 日度K线缓存表
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_kline_cache (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      kline_data TEXT NOT NULL,
      model_used TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
    )
  `);

  // 八字分析永久缓存表 - 同一八字返回相同核心结论
  db.exec(`
    CREATE TABLE IF NOT EXISTS bazi_analysis_cache (
      id TEXT PRIMARY KEY,
      bazi_hash TEXT NOT NULL,           -- 四柱哈希 (SHA256前16位)
      gender TEXT NOT NULL,              -- 性别 (male/female)

      -- L1: 结构数据 (JSON)
      structural_data TEXT NOT NULL,     -- 五行、大运、十神、八字数组

      -- L2: 命理骨架 (JSON) - 核心分析内容
      personality_core TEXT,             -- 性格核心特征
      career_core TEXT,                  -- 事业核心方向
      wealth_core TEXT,                  -- 财运核心特征
      marriage_core TEXT,                -- 婚姻核心特点
      health_core TEXT,                  -- 健康注意事项

      -- L3: K线数据 (JSON)
      kline_data TEXT,                   -- 100年K线数据
      peak_years TEXT,                   -- 巅峰年份数组
      trough_years TEXT,                 -- 低谷年份数组

      -- L4: 扩展分析维度 (JSON)
      crypto_core TEXT,                  -- 币圈交易分析
      monthly_fortune TEXT,              -- 本月运势
      yearly_fortune TEXT,               -- 今年运势
      lucky_elements TEXT,               -- 幸运元素 (颜色/方向/属相/数字)
      physical_traits TEXT,              -- 个人特征 (相貌/体型/皮肤/性格)
      key_dates TEXT,                    -- 重点日期
      past_events TEXT,                  -- 过往大事件
      future_events TEXT,                -- 今年大事件

      -- 元数据
      model_used TEXT,                   -- 使用的AI模型
      version INTEGER DEFAULT 1,         -- 算法版本，用于缓存失效
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 点券兑换表
  db.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      points INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      used_by TEXT,
      FOREIGN KEY (used_by) REFERENCES users(id)
    )
  `);

  // 邮箱订阅表
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      email_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_sent_at TEXT,
      verified_at TEXT,
      sub_daily_fortune INTEGER DEFAULT 0,
      sub_monthly_fortune INTEGER DEFAULT 0,
      sub_yearly_fortune INTEGER DEFAULT 0,
      sub_birthday_reminder INTEGER DEFAULT 0,
      sub_low_points INTEGER DEFAULT 1,
      sub_feature_updates INTEGER DEFAULT 1,
      sub_promotions INTEGER DEFAULT 0,
      binding_reward_claimed INTEGER DEFAULT 0,
      subscription_reward_claimed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 邮件日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      email_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 密码重置令牌表
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 定价配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_config (
      id TEXT PRIMARY KEY,
      feature_key TEXT UNIQUE NOT NULL,
      points_cost INTEGER NOT NULL,
      price_usd REAL,
      price_cny REAL,
      display_name TEXT,
      category TEXT,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT
    )
  `);

  // 积分套餐表
  db.exec(`
    CREATE TABLE IF NOT EXISTS point_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      points_amount INTEGER NOT NULL,
      price_usd REAL NOT NULL,
      price_cny REAL NOT NULL,
      bonus_points INTEGER DEFAULT 0,
      is_recommended INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 999,
      is_active INTEGER DEFAULT 1
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      package_name TEXT NOT NULL,
      points INTEGER NOT NULL,
      bonus_points INTEGER DEFAULT 0,
      total_points INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'CNY',
      provider TEXT DEFAULT 'wechat',
      status TEXT DEFAULT 'pending',
      code_url TEXT,
      transaction_id TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      raw_notify TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_inputs_user_id ON user_inputs(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_inputs_created_at ON user_inputs(created_at);
    CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at);
    CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_articles(category);
    CREATE INDEX IF NOT EXISTS idx_knowledge_slug ON knowledge_articles(slug);
    CREATE INDEX IF NOT EXISTS idx_cases_curve_type ON cases(curve_type);
    CREATE INDEX IF NOT EXISTS idx_celebrity_cases_category ON celebrity_cases(category);
    CREATE INDEX IF NOT EXISTS idx_celebrity_cases_hotness ON celebrity_cases(hotness_score);

    -- 新表索引
    CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id_default ON user_profiles(user_id, is_default);
    CREATE INDEX IF NOT EXISTS idx_share_rewards_user_id ON share_rewards(user_id);
    CREATE INDEX IF NOT EXISTS idx_share_rewards_shared_at ON share_rewards(shared_at);
    CREATE INDEX IF NOT EXISTS idx_fortune_cache_profile_type_date ON fortune_cache(profile_id, fortune_type, date_key);
    CREATE INDEX IF NOT EXISTS idx_fortune_cache_expires_at ON fortune_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

    -- 八字缓存索引 (永久缓存)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bazi_cache_hash_gender ON bazi_analysis_cache(bazi_hash, gender);
    CREATE INDEX IF NOT EXISTS idx_bazi_cache_created_at ON bazi_analysis_cache(created_at);

    -- 每日运势详情索引
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_fortune_profile_date ON daily_fortune_detail(profile_id, date_key);
    CREATE INDEX IF NOT EXISTS idx_daily_fortune_expires_at ON daily_fortune_detail(expires_at);

    -- 月度K线缓存索引
    CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_kline_profile_year ON monthly_kline_cache(profile_id, year);

    -- 日度K线缓存索引
    CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_kline_profile_yearmonth ON daily_kline_cache(profile_id, year, month);

    -- 邮箱订阅索引
    CREATE INDEX IF NOT EXISTS idx_email_subscriptions_user_id ON email_subscriptions(user_id);

    -- 邮件日志索引
    CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

    -- 密码重置令牌索引
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

    -- 定价配置索引
    CREATE INDEX IF NOT EXISTS idx_pricing_feature ON pricing_config(feature_key);

    -- 积分套餐索引
    CREATE INDEX IF NOT EXISTS idx_packages_order ON point_packages(display_order);
    CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
    CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at);
  `);

  // 名人案例表新增字段 (Schema Migration)
  // 使用 try-catch 处理已存在的列
  const celebrityMigrations = [
    'ALTER TABLE celebrity_cases ADD COLUMN analysis_data TEXT',
    'ALTER TABLE celebrity_cases ADD COLUMN scores TEXT',
    'ALTER TABLE celebrity_cases ADD COLUMN financial_data TEXT',
    'ALTER TABLE celebrity_cases ADD COLUMN honors TEXT',
    'ALTER TABLE celebrity_cases ADD COLUMN analysis_generated_at TEXT',
    'ALTER TABLE celebrity_cases ADD COLUMN analysis_version INTEGER DEFAULT 0',
  ];

  for (const migration of celebrityMigrations) {
    try {
      db.exec(migration);
    } catch (e) {
      // Column already exists, ignore the error
    }
  }

  console.log('✓ 数据库初始化完成');
};

// 初始化数据库
initDatabase();

// 初始化定价表
import('./pricingManager.js')
  .then(module => {
    module.initializePricingTables();
  })
  .catch(err => {
    console.error('定价表初始化失败:', err);
  });

// ============ 用户操作 ============

export const createUser = (id, email, passwordHash, points = 1000) => {
  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, points, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  stmt.run(id, email, passwordHash, points, now);
  return { id, email, points, createdAt: now };
};

export const getUserByEmail = (email) => {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const row = stmt.get(email);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    points: row.points,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
  };
};

export const getUserById = (id) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    points: row.points,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
  };
};

export const updateUserPoints = (userId, newPoints) => {
  const stmt = db.prepare('UPDATE users SET points = ?, updated_at = ? WHERE id = ?');
  stmt.run(newPoints, new Date().toISOString(), userId);
};

export const updateUserLogin = (userId) => {
  const stmt = db.prepare(`
    UPDATE users
    SET last_login_at = ?, login_count = login_count + 1, updated_at = ?
    WHERE id = ?
  `);
  const now = new Date().toISOString();
  stmt.run(now, now, userId);
};

export const getAllUsers = (limit = 100, offset = 0) => {
  const stmt = db.prepare(`
    SELECT id, email, points, role, created_at, last_login_at, login_count
    FROM users
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset).map(row => ({
    id: row.id,
    email: row.email,
    points: row.points,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    loginCount: row.login_count,
  }));
};

export const getUserCount = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  return stmt.get().count;
};

// ============ 用户输入记录 ============

export const saveUserInput = (inputData) => {
  const stmt = db.prepare(`
    INSERT INTO user_inputs (
      id, user_id, name, gender, birth_year, year_pillar, month_pillar,
      day_pillar, hour_pillar, start_age, first_da_yun, model_name,
      api_base_url, use_custom_api, created_at, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    inputData.id,
    inputData.userId || null,
    inputData.name || null,
    inputData.gender,
    inputData.birthYear || null,
    inputData.yearPillar || null,
    inputData.monthPillar || null,
    inputData.dayPillar || null,
    inputData.hourPillar || null,
    inputData.startAge || null,
    inputData.firstDaYun || null,
    inputData.modelName || null,
    inputData.apiBaseUrl || null,
    inputData.useCustomApi ? 1 : 0,
    now,
    inputData.ipAddress || null,
    inputData.userAgent || null
  );

  return { ...inputData, createdAt: now };
};

export const getUserInputs = (userId, limit = 20, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM user_inputs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset);
};

export const getAllInputs = (limit = 100, offset = 0) => {
  const stmt = db.prepare(`
    SELECT ui.*, u.email as user_email
    FROM user_inputs ui
    LEFT JOIN users u ON ui.user_id = u.id
    ORDER BY ui.created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset);
};

export const getInputCount = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM user_inputs');
  return stmt.get().count;
};

// ============ 分析结果 ============

export const saveAnalysis = (analysisData) => {
  const stmt = db.prepare(`
    INSERT INTO analyses (
      id, user_id, input_id, cost, model_used, chart_data, analysis_data,
      created_at, processing_time_ms, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    analysisData.id,
    analysisData.userId || null,
    analysisData.inputId || null,
    analysisData.cost || 0,
    analysisData.modelUsed || null,
    JSON.stringify(analysisData.chartData || []),
    JSON.stringify(analysisData.analysisData || {}),
    now,
    analysisData.processingTimeMs || null,
    analysisData.status || 'completed',
    analysisData.errorMessage || null
  );

  return { ...analysisData, createdAt: now };
};

export const getAnalysesByUserId = (userId, limit = 20, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM analyses
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset).map(row => ({
    id: row.id,
    userId: row.user_id,
    inputId: row.input_id,
    cost: row.cost,
    modelUsed: row.model_used,
    chartData: JSON.parse(row.chart_data || '[]'),
    analysisData: JSON.parse(row.analysis_data || '{}'),
    createdAt: row.created_at,
    processingTimeMs: row.processing_time_ms,
    status: row.status,
  }));
};

export const getAnalysisById = (id) => {
  const stmt = db.prepare(`
    SELECT
      a.*,
      ui.name,
      ui.gender,
      ui.birth_year,
      ui.year_pillar,
      ui.month_pillar,
      ui.day_pillar,
      ui.hour_pillar,
      ui.start_age,
      ui.first_da_yun,
      ui.model_name,
      ui.api_base_url,
      ui.use_custom_api
    FROM analyses a
    LEFT JOIN user_inputs ui ON ui.id = a.input_id
    WHERE a.id = ?
  `);
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    inputId: row.input_id,
    cost: row.cost,
    modelUsed: row.model_used,
    chartData: JSON.parse(row.chart_data || '[]'),
    analysisData: JSON.parse(row.analysis_data || '{}'),
    createdAt: row.created_at,
    processingTimeMs: row.processing_time_ms,
    status: row.status,
    input: row.input_id ? {
      name: row.name || '',
      gender: row.gender,
      birthYear: row.birth_year ? String(row.birth_year) : '',
      yearPillar: row.year_pillar || '',
      monthPillar: row.month_pillar || '',
      dayPillar: row.day_pillar || '',
      hourPillar: row.hour_pillar || '',
      startAge: row.start_age ? String(row.start_age) : '',
      firstDaYun: row.first_da_yun || '',
      modelName: row.model_name || '',
      apiBaseUrl: row.api_base_url || '',
      apiKey: '',
      useCustomApi: row.use_custom_api === 1,
    } : null,
  };
};

export const getAllAnalyses = (limit = 100, offset = 0) => {
  const stmt = db.prepare(`
    SELECT a.*, u.email as user_email
    FROM analyses a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset).map(row => ({
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    cost: row.cost,
    modelUsed: row.model_used,
    summary: JSON.parse(row.analysis_data || '{}')?.summary || '',
    createdAt: row.created_at,
    status: row.status,
  }));
};

export const getAnalysisCount = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM analyses');
  return stmt.get().count;
};

// ============ 系统日志 ============

export const logEvent = (level, message, details = null, userId = null, ipAddress = null) => {
  const stmt = db.prepare(`
    INSERT INTO system_logs (level, message, details, user_id, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(level, message, details ? JSON.stringify(details) : null, userId, ipAddress, new Date().toISOString());
};

export const getSystemLogs = (limit = 100, offset = 0, level = null) => {
  let sql = 'SELECT * FROM system_logs';
  const params = [];

  if (level) {
    sql += ' WHERE level = ?';
    params.push(level);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...params);
};

// ============ 统计信息 ============

export const getStats = () => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const inputCount = db.prepare('SELECT COUNT(*) as count FROM user_inputs').get().count;
  const analysisCount = db.prepare('SELECT COUNT(*) as count FROM analyses').get().count;
  const totalPoints = db.prepare('SELECT SUM(points) as total FROM users').get().total || 0;
  const totalCost = db.prepare('SELECT SUM(cost) as total FROM analyses').get().total || 0;

  // 今日统计
  const today = new Date().toISOString().split('T')[0];
  const todayUsers = db.prepare(`SELECT COUNT(*) as count FROM users WHERE created_at LIKE '${today}%'`).get().count;
  const todayAnalyses = db.prepare(`SELECT COUNT(*) as count FROM analyses WHERE created_at LIKE '${today}%'`).get().count;

  return {
    userCount,
    inputCount,
    analysisCount,
    totalPoints,
    totalCost,
    todayUsers,
    todayAnalyses,
  };
};

// ============ 数据迁移工具 ============

export const migrateFromJson = async (jsonDbPath) => {
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonDbPath, 'utf-8'));

    // 迁移用户
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, email, password_hash, points, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const user of jsonData.users || []) {
      insertUser.run(user.id, user.email, user.passwordHash, user.points, user.createdAt);
    }

    // 迁移分析记录
    const insertAnalysis = db.prepare(`
      INSERT OR IGNORE INTO analyses (id, user_id, cost, chart_data, analysis_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertInput = db.prepare(`
      INSERT OR IGNORE INTO user_inputs (
        id, user_id, name, gender, birth_year, year_pillar, month_pillar,
        day_pillar, hour_pillar, start_age, first_da_yun, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const analysis of jsonData.analyses || []) {
      const inputId = `input_${analysis.id}`;
      const input = analysis.input || {};

      // 保存输入
      insertInput.run(
        inputId,
        analysis.userId,
        input.name || null,
        input.gender || 'Male',
        input.birthYear || null,
        input.yearPillar || null,
        input.monthPillar || null,
        input.dayPillar || null,
        input.hourPillar || null,
        input.startAge || null,
        input.firstDaYun || null,
        analysis.createdAt
      );

      // 保存分析结果
      insertAnalysis.run(
        analysis.id,
        analysis.userId,
        analysis.cost || 0,
        JSON.stringify(analysis.result?.chartData || []),
        JSON.stringify(analysis.result?.analysis || {}),
        analysis.createdAt
      );
    }

    console.log(`✓ 迁移完成: ${jsonData.users?.length || 0} 用户, ${jsonData.analyses?.length || 0} 分析记录`);
    return true;
  } catch (err) {
    console.error('迁移失败:', err);
    return false;
  }
};

// ============ Knowledge Articles ============

export const createArticle = (articleData) => {
  const stmt = db.prepare(`
    INSERT INTO knowledge_articles (
      id, slug, title, category, level, tags, summary, content,
      view_count, created_at, updated_at, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    articleData.id,
    articleData.slug,
    articleData.title,
    articleData.category,
    articleData.level || 1,
    articleData.tags ? JSON.stringify(articleData.tags) : null,
    articleData.summary,
    articleData.content,
    0,
    now,
    null,
    articleData.published !== undefined ? (articleData.published ? 1 : 0) : 1
  );

  return { ...articleData, createdAt: now };
};

export const getArticleBySlug = (slug) => {
  const stmt = db.prepare('SELECT * FROM knowledge_articles WHERE slug = ? AND published = 1');
  const row = stmt.get(slug);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    level: row.level,
    tags: row.tags ? JSON.parse(row.tags) : [],
    summary: row.summary,
    content: row.content,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getArticles = (category, limit = 20, offset = 0) => {
  let sql = 'SELECT * FROM knowledge_articles WHERE published = 1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...params).map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    level: row.level,
    tags: row.tags ? JSON.parse(row.tags) : [],
    summary: row.summary,
    viewCount: row.view_count,
    createdAt: row.created_at,
  }));
};

export const getAllArticlesAdmin = (category, limit = 50, offset = 0) => {
  let sql = 'SELECT * FROM knowledge_articles WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params).map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    level: row.level,
    tags: row.tags ? JSON.parse(row.tags) : [],
    summary: row.summary,
    content: row.content,
    viewCount: row.view_count,
    published: row.published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const upsertArticle = (articleData) => {
  const now = new Date().toISOString();
  const id = articleData.id || `article_${Date.now()}`;

  db.prepare(`
    INSERT INTO knowledge_articles (
      id, slug, title, category, level, tags, summary, content,
      view_count, created_at, updated_at, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      category = excluded.category,
      level = excluded.level,
      tags = excluded.tags,
      summary = excluded.summary,
      content = excluded.content,
      updated_at = excluded.updated_at,
      published = excluded.published
  `).run(
    id,
    articleData.slug,
    articleData.title,
    articleData.category,
    articleData.level || 1,
    articleData.tags ? JSON.stringify(articleData.tags) : null,
    articleData.summary,
    articleData.content,
    articleData.viewCount || 0,
    articleData.createdAt || now,
    now,
    articleData.published === false ? 0 : 1
  );

  return id;
};

export const getKnowledgeArticleCount = () => {
  return db.prepare('SELECT COUNT(*) as count FROM knowledge_articles').get().count;
};

export const incrementArticleView = (slug) => {
  const stmt = db.prepare('UPDATE knowledge_articles SET view_count = view_count + 1 WHERE slug = ?');
  stmt.run(slug);
};

export const searchArticles = (query, limit = 10) => {
  const searchPattern = `%${query}%`;
  const stmt = db.prepare(`
    SELECT id, slug, title, category, summary
    FROM knowledge_articles
    WHERE published = 1 AND (title LIKE ? OR summary LIKE ?)
    LIMIT ?
  `);
  return stmt.all(searchPattern, searchPattern, limit).map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    summary: row.summary,
  }));
};

// ============ Cases ============

export const createCase = (caseData) => {
  const stmt = db.prepare(`
    INSERT INTO cases (
      id, title, persona, curve_type, chart_data, highlights, narrative,
      tags, view_count, created_at, updated_at, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    caseData.id,
    caseData.title,
    caseData.persona,
    caseData.curveType,
    JSON.stringify(caseData.chartData),
    caseData.highlights ? JSON.stringify(caseData.highlights) : null,
    caseData.narrative,
    caseData.tags ? JSON.stringify(caseData.tags) : null,
    0,
    now,
    null,
    caseData.published !== undefined ? (caseData.published ? 1 : 0) : 1
  );

  return { ...caseData, createdAt: now };
};

export const getCaseById = (id) => {
  const stmt = db.prepare('SELECT * FROM cases WHERE id = ? AND published = 1');
  const row = stmt.get(id);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    persona: row.persona,
    curveType: row.curve_type,
    chartData: JSON.parse(row.chart_data),
    highlights: row.highlights ? JSON.parse(row.highlights) : [],
    narrative: row.narrative,
    tags: row.tags ? JSON.parse(row.tags) : [],
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getCases = (curveType, limit = 20, offset = 0) => {
  let sql = 'SELECT * FROM cases WHERE published = 1';
  const params = [];

  if (curveType) {
    sql += ' AND curve_type = ?';
    params.push(curveType);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...params).map(row => ({
    id: row.id,
    title: row.title,
    persona: row.persona,
    curveType: row.curve_type,
    chartData: JSON.parse(row.chart_data),
    highlights: row.highlights ? JSON.parse(row.highlights) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
    viewCount: row.view_count,
    createdAt: row.created_at,
  }));
};

export const getAllCasesAdmin = (curveType, limit = 50, offset = 0) => {
  let sql = 'SELECT * FROM cases WHERE 1=1';
  const params = [];

  if (curveType) {
    sql += ' AND curve_type = ?';
    params.push(curveType);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params).map(row => ({
    id: row.id,
    title: row.title,
    persona: row.persona,
    curveType: row.curve_type,
    chartData: row.chart_data ? JSON.parse(row.chart_data) : [],
    highlights: row.highlights ? JSON.parse(row.highlights) : [],
    narrative: row.narrative,
    tags: row.tags ? JSON.parse(row.tags) : [],
    viewCount: row.view_count,
    published: row.published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const upsertCase = (caseData) => {
  const now = new Date().toISOString();
  const id = caseData.id || `case_${Date.now()}`;

  db.prepare(`
    INSERT INTO cases (
      id, title, persona, curve_type, chart_data, highlights, narrative,
      tags, view_count, created_at, updated_at, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      persona = excluded.persona,
      curve_type = excluded.curve_type,
      chart_data = excluded.chart_data,
      highlights = excluded.highlights,
      narrative = excluded.narrative,
      tags = excluded.tags,
      updated_at = excluded.updated_at,
      published = excluded.published
  `).run(
    id,
    caseData.title,
    caseData.persona,
    caseData.curveType,
    JSON.stringify(caseData.chartData || []),
    caseData.highlights ? JSON.stringify(caseData.highlights) : null,
    caseData.narrative,
    caseData.tags ? JSON.stringify(caseData.tags) : null,
    caseData.viewCount || 0,
    caseData.createdAt || now,
    now,
    caseData.published === false ? 0 : 1
  );

  return id;
};

export const getCaseCount = () => {
  return db.prepare('SELECT COUNT(*) as count FROM cases').get().count;
};

export const incrementCaseView = (id) => {
  const stmt = db.prepare('UPDATE cases SET view_count = view_count + 1 WHERE id = ?');
  stmt.run(id);
};

// ============ Celebrity Cases ============

// 创建名人案例
export const createCelebrityCase = (caseData) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO celebrity_cases (
      id, name, name_cn, category, category_cn, birth_date, birth_location_city,
      birth_location_lat, birth_location_lng, description, tags, year_pillar,
      month_pillar, day_pillar, hour_pillar, chart_data, highlights,
      hotness_score, view_count, created_at, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    caseData.id,
    caseData.name,
    caseData.name_cn,
    caseData.category,
    caseData.category_cn,
    caseData.birth_date,
    caseData.birth_location_city || null,
    caseData.birth_location_lat || null,
    caseData.birth_location_lng || null,
    caseData.description,
    caseData.tags ? JSON.stringify(caseData.tags) : null,
    caseData.year_pillar || null,
    caseData.month_pillar || null,
    caseData.day_pillar || null,
    caseData.hour_pillar || null,
    caseData.chart_data ? JSON.stringify(caseData.chart_data) : null,
    caseData.highlights ? JSON.stringify(caseData.highlights) : null,
    caseData.hotness_score || 0,
    caseData.view_count || 0,
    now,
    caseData.published !== undefined ? (caseData.published ? 1 : 0) : 1
  );

  return { ...caseData, createdAt: now };
};

// 获取名人案例列表
export const getCelebrityCases = (category = null, limit = 20, offset = 0) => {
  let sql = 'SELECT * FROM celebrity_cases WHERE published = 1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY hotness_score DESC, view_count DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...params).map(row => ({
    id: row.id,
    name: row.name,
    name_cn: row.name_cn,
    category: row.category,
    category_cn: row.category_cn,
    birth_date: row.birth_date,
    birth_location_city: row.birth_location_city,
    birth_location_lat: row.birth_location_lat,
    birth_location_lng: row.birth_location_lng,
    description: row.description,
    tags: row.tags ? JSON.parse(row.tags) : [],
    year_pillar: row.year_pillar,
    month_pillar: row.month_pillar,
    day_pillar: row.day_pillar,
    hour_pillar: row.hour_pillar,
    chart_data: row.chart_data ? JSON.parse(row.chart_data) : null,
    highlights: row.highlights ? JSON.parse(row.highlights) : [],
    hotness_score: row.hotness_score,
    view_count: row.view_count,
    createdAt: row.created_at,
  }));
};

// 获取热门名人案例
export const getTrendingCelebrityCases = (limit = 10) => {
  const stmt = db.prepare(`
    SELECT * FROM celebrity_cases
    WHERE published = 1
    ORDER BY hotness_score DESC, view_count DESC
    LIMIT ?
  `);

  return stmt.all(limit).map(row => ({
    id: row.id,
    name: row.name,
    name_cn: row.name_cn,
    category: row.category,
    category_cn: row.category_cn,
    description: row.description,
    tags: row.tags ? JSON.parse(row.tags) : [],
    hotness_score: row.hotness_score,
    view_count: row.view_count,
  }));
};

// 根据ID获取名人案例
export const getCelebrityCaseById = (id) => {
  const stmt = db.prepare('SELECT * FROM celebrity_cases WHERE id = ? AND published = 1');
  const row = stmt.get(id);
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    name_cn: row.name_cn,
    category: row.category,
    category_cn: row.category_cn,
    birth_date: row.birth_date,
    birth_location_city: row.birth_location_city,
    birth_location_lat: row.birth_location_lat,
    birth_location_lng: row.birth_location_lng,
    description: row.description,
    tags: row.tags ? JSON.parse(row.tags) : [],
    year_pillar: row.year_pillar,
    month_pillar: row.month_pillar,
    day_pillar: row.day_pillar,
    hour_pillar: row.hour_pillar,
    chart_data: row.chart_data ? JSON.parse(row.chart_data) : null,
    highlights: row.highlights ? JSON.parse(row.highlights) : [],
    hotness_score: row.hotness_score,
    view_count: row.view_count,
    analysis_data: row.analysis_data,
    scores: row.scores,
    financial_data: row.financial_data,
    honors: row.honors,
    analysis_generated_at: row.analysis_generated_at,
    analysis_version: row.analysis_version,
    createdAt: row.created_at,
  };
};

// 增加名人案例浏览次数
export const incrementCelebrityCaseView = (id) => {
  const stmt = db.prepare('UPDATE celebrity_cases SET view_count = view_count + 1 WHERE id = ?');
  stmt.run(id);
};

// ============ User Profiles ============

// 创建用户档案
export const createUserProfile = (input) => {
  // 检查用户档案数量限制（排除已删除）
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM user_profiles WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)');
  const { count } = countStmt.get(input.userId);

  if (count >= 10) {
    throw new Error('用户最多只能创建10个档案');
  }

  // 如果设置为默认，先取消其他默认档案
  if (input.isDefault) {
    const clearDefaultStmt = db.prepare('UPDATE user_profiles SET is_default = 0 WHERE user_id = ?');
    clearDefaultStmt.run(input.userId);
  }

  const stmt = db.prepare(`
    INSERT INTO user_profiles (
      id, user_id, name, gender, birth_year, year_pillar, month_pillar,
      day_pillar, hour_pillar, start_age, first_da_yun, birth_place,
      is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    input.id,
    input.userId,
    input.name,
    input.gender,
    input.birthYear,
    input.yearPillar || null,
    input.monthPillar || null,
    input.dayPillar || null,
    input.hourPillar || null,
    input.startAge || null,
    input.firstDaYun || null,
    input.birthPlace || null,
    input.isDefault ? 1 : 0,
    now,
    now
  );

  return { ...input, id: input.id, createdAt: now, updatedAt: now };
};

// 获取用户的所有档案（排除已删除）
export const getUserProfiles = (userId, limit = 10) => {
  const stmt = db.prepare(`
    SELECT * FROM user_profiles
    WHERE user_id = ? AND (is_deleted = 0 OR is_deleted IS NULL)
    ORDER BY is_default DESC, created_at DESC
    LIMIT ?
  `);
  return stmt.all(userId, limit).map(row => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    gender: row.gender,
    birthYear: row.birth_year,
    yearPillar: row.year_pillar,
    monthPillar: row.month_pillar,
    dayPillar: row.day_pillar,
    hourPillar: row.hour_pillar,
    startAge: row.start_age,
    firstDaYun: row.first_da_yun,
    birthPlace: row.birth_place,
    isDefault: row.is_default === 1,
    coreDocumentStatus: row.core_document_status || 'pending',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

// 根据ID获取档案（排除已删除）
export const getUserProfileById = (id) => {
  const stmt = db.prepare('SELECT * FROM user_profiles WHERE id = ? AND (is_deleted = 0 OR is_deleted IS NULL)');
  const row = stmt.get(id);
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    gender: row.gender,
    birthYear: row.birth_year,
    yearPillar: row.year_pillar,
    monthPillar: row.month_pillar,
    dayPillar: row.day_pillar,
    hourPillar: row.hour_pillar,
    startAge: row.start_age,
    firstDaYun: row.first_da_yun,
    birthPlace: row.birth_place,
    isDefault: row.is_default === 1,
    coreDocumentStatus: row.core_document_status || 'pending',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// 更新用户档案
export const updateUserProfile = (id, data) => {
  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && key !== 'id' && key !== 'userId') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`
    UPDATE user_profiles
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);
  return getUserProfileById(id);
};

export const updateUserProfileCompat = (id, data) => {
  const fieldMap = {
    name: 'name',
    gender: 'gender',
    birthYear: 'birth_year',
    yearPillar: 'year_pillar',
    monthPillar: 'month_pillar',
    dayPillar: 'day_pillar',
    hourPillar: 'hour_pillar',
    startAge: 'start_age',
    firstDaYun: 'first_da_yun',
    birthPlace: 'birth_place',
  };

  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    const dbField = fieldMap[key];
    if (value !== undefined && dbField) {
      fields.push(`${dbField} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return null;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  const stmt = db.prepare(`
    UPDATE user_profiles
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);
  return getUserProfileById(id);
};

// 设置默认档案
export const setDefaultProfile = (userId, profileId) => {
  // 先取消所有默认档案
  const clearStmt = db.prepare('UPDATE user_profiles SET is_default = 0 WHERE user_id = ?');
  clearStmt.run(userId);

  // 设置新的默认档案
  const setStmt = db.prepare('UPDATE user_profiles SET is_default = 1, updated_at = ? WHERE id = ? AND user_id = ?');
  const now = new Date().toISOString();
  const result = setStmt.run(now, profileId, userId);

  return result.changes > 0;
};

// 软删除用户档案（前端调用）
export const deleteUserProfile = (id) => {
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE user_profiles SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?');
  const result = stmt.run(now, now, id);
  return result.changes > 0;
};

// 硬删除用户档案（管理员用）
export const hardDeleteUserProfile = (id) => {
  const stmt = db.prepare('DELETE FROM user_profiles WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
};

// 更新档案核心文档状态
export const updateProfileCoreDocumentStatus = (id, status) => {
  const stmt = db.prepare('UPDATE user_profiles SET core_document_status = ?, updated_at = ? WHERE id = ?');
  const result = stmt.run(status, new Date().toISOString(), id);
  return result.changes > 0;
};

// ============ Share Rewards ============

// 创建分享奖励记录
export const createShareReward = (data) => {
  const stmt = db.prepare(`
    INSERT INTO share_rewards (
      id, user_id, platform, analysis_id, points_rewarded, shared_at, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    data.id,
    data.userId,
    data.platform,
    data.analysisId || null,
    data.pointsRewarded || 300,
    now,
    data.ipAddress || null
  );

  // 更新用户积分
  updateUserPoints(data.userId, (data.currentPoints || 0) + (data.pointsRewarded || 300));

  return {
    id: data.id,
    userId: data.userId,
    platform: data.platform,
    analysisId: data.analysisId,
    pointsRewarded: data.pointsRewarded || 300,
    sharedAt: now,
  };
};

// 获取用户的分享奖励记录
export const getUserShareRewards = (userId, limit = 50, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM share_rewards
    WHERE user_id = ?
    ORDER BY shared_at DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(userId, limit, offset).map(row => ({
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    analysisId: row.analysis_id,
    pointsRewarded: row.points_rewarded,
    sharedAt: row.shared_at,
    ipAddress: row.ip_address,
  }));
};

// 获取今日分享次数
export const getTodayShareCount = (userId) => {
  const today = new Date().toISOString().split('T')[0];
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM share_rewards
    WHERE user_id = ? AND shared_at LIKE ?
  `);
  const result = stmt.get(userId, `${today}%`);
  return result.count;
};

// ============ Fortune Cache ============

// 创建运势缓存
export const createFortuneCache = (data) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO fortune_cache (
      id, profile_id, fortune_type, date_key, predictions, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    data.id,
    data.profileId,
    data.fortuneType,
    data.dateKey,
    JSON.stringify(data.predictions),
    now,
    data.expiresAt
  );

  return { ...data, createdAt: now };
};

// 获取运势缓存
export const getFortuneCache = (profileId, fortuneType, dateKey) => {
  const stmt = db.prepare(`
    SELECT * FROM fortune_cache
    WHERE profile_id = ? AND fortune_type = ? AND date_key = ? AND expires_at > ?
  `);

  const row = stmt.get(profileId, fortuneType, dateKey, new Date().toISOString());
  if (!row) return null;

  return {
    id: row.id,
    profileId: row.profile_id,
    fortuneType: row.fortune_type,
    dateKey: row.date_key,
    predictions: JSON.parse(row.predictions),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
};

// 清理过期缓存
export const cleanExpiredFortuneCache = () => {
  const stmt = db.prepare('DELETE FROM fortune_cache WHERE expires_at <= ?');
  const result = stmt.run(new Date().toISOString());
  return result.changes;
};

// ============ User Preferences ============

// 创建用户偏好设置
export const createUserPreferences = (userId) => {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO user_preferences (
      id, user_id, theme, notifications_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const id = `pref_${userId}_${Date.now()}`;

  stmt.run(
    id,
    userId,
    'light',
    1,
    now,
    now
  );

  return {
    id,
    userId,
    theme: 'light',
    notificationsEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
};

// 获取用户偏好设置
export const getUserPreferences = (userId) => {
  const stmt = db.prepare(`
    SELECT * FROM user_preferences WHERE user_id = ?
  `);

  const row = stmt.get(userId);
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    theme: row.theme,
    notificationsEnabled: row.notifications_enabled === 1,
    defaultProfileId: row.default_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// 更新用户偏好设置
export const updateUserPreferences = (userId, data) => {
  if (!getUserPreferences(userId)) {
    createUserPreferences(userId);
  }

  const fields = [];
  const values = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && key !== 'id' && key !== 'userId') {
      // 转换驼峰命名
      let dbKey = key;
      if (key === 'notificationsEnabled') dbKey = 'notifications_enabled';
      if (key === 'defaultProfileId') dbKey = 'default_profile_id';

      fields.push(`${dbKey} = ?`);
      if (key === 'notificationsEnabled') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
  });

  if (fields.length === 0) return null;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(userId);

  const stmt = db.prepare(`
    UPDATE user_preferences
    SET ${fields.join(', ')}
    WHERE user_id = ?
  `);

  stmt.run(...values);
  return getUserPreferences(userId);
};

// 导出数据库实例（用于高级操作）
export const getDb = () => db;

// 关闭数据库连接
export const closeDb = () => db.close();

export const nowIso = () => new Date().toISOString();

// ============ Daily Fortune Detail ============

// 保存每日运势详情
export const saveDailyFortuneDetail = (data) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO daily_fortune_detail (
      id, profile_id, date_key, fortune_data, ai_enhanced, model_used, points_cost, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    data.id,
    data.profileId,
    data.dateKey,
    JSON.stringify(data.fortuneData),
    data.aiEnhanced ? 1 : 0,
    data.modelUsed || null,
    data.pointsCost || 0,
    now,
    data.expiresAt || null
  );

  return { ...data, createdAt: now };
};

// 获取每日运势详情
export const getDailyFortuneDetail = (profileId, dateKey) => {
  const stmt = db.prepare(`
    SELECT * FROM daily_fortune_detail
    WHERE profile_id = ? AND date_key = ?
  `);

  const row = stmt.get(profileId, dateKey);
  if (!row) return null;

  // 检查是否过期（如果有过期时间且已过期，返回null）
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return null;
  }

  return {
    id: row.id,
    profileId: row.profile_id,
    dateKey: row.date_key,
    fortuneData: JSON.parse(row.fortune_data),
    aiEnhanced: row.ai_enhanced === 1,
    modelUsed: row.model_used,
    pointsCost: row.points_cost,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
};

// 检查今日运势是否有AI增强版
export const hasDailyFortuneAiEnhanced = (profileId, dateKey) => {
  const stmt = db.prepare(`
    SELECT ai_enhanced FROM daily_fortune_detail
    WHERE profile_id = ? AND date_key = ? AND ai_enhanced = 1
  `);
  const row = stmt.get(profileId, dateKey);
  return !!row;
};

// ============ Monthly K-Line Cache ============

// 保存月度K线缓存 (本年度36月K线)
export const saveMonthlyKlineCache = (data) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO monthly_kline_cache (
      id, profile_id, year, kline_data, model_used, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    data.id,
    data.profileId,
    data.year,
    JSON.stringify(data.klineData),
    data.modelUsed || null,
    now,
    data.expiresAt
  );

  return { ...data, createdAt: now };
};

// 获取月度K线缓存
export const getMonthlyKlineCache = (profileId, year) => {
  const stmt = db.prepare(`
    SELECT * FROM monthly_kline_cache
    WHERE profile_id = ? AND year = ? AND expires_at > ?
  `);

  const row = stmt.get(profileId, year, new Date().toISOString());
  if (!row) return null;

  return {
    id: row.id,
    profileId: row.profile_id,
    year: row.year,
    klineData: JSON.parse(row.kline_data),
    modelUsed: row.model_used,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
};

// ============ Daily K-Line Cache ============

// 保存日度K线缓存 (当月61天K线)
export const saveDailyKlineCache = (data) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO daily_kline_cache (
      id, profile_id, year, month, kline_data, model_used, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  stmt.run(
    data.id,
    data.profileId,
    data.year,
    data.month,
    JSON.stringify(data.klineData),
    data.modelUsed || null,
    now,
    data.expiresAt
  );

  return { ...data, createdAt: now };
};

// 获取日度K线缓存
export const getDailyKlineCache = (profileId, year, month) => {
  const stmt = db.prepare(`
    SELECT * FROM daily_kline_cache
    WHERE profile_id = ? AND year = ? AND month = ? AND expires_at > ?
  `);

  const row = stmt.get(profileId, year, month, new Date().toISOString());
  if (!row) return null;

  return {
    id: row.id,
    profileId: row.profile_id,
    year: row.year,
    month: row.month,
    klineData: JSON.parse(row.kline_data),
    modelUsed: row.model_used,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
};

// 清理所有过期缓存
export const cleanAllExpiredCache = () => {
  const now = new Date().toISOString();
  let totalCleaned = 0;

  // 清理运势缓存
  const stmt1 = db.prepare('DELETE FROM fortune_cache WHERE expires_at <= ?');
  totalCleaned += stmt1.run(now).changes;

  // 清理每日运势详情（有过期时间且已过期的）
  const stmt2 = db.prepare('DELETE FROM daily_fortune_detail WHERE expires_at IS NOT NULL AND expires_at <= ?');
  totalCleaned += stmt2.run(now).changes;

  // 清理月度K线缓存
  const stmt3 = db.prepare('DELETE FROM monthly_kline_cache WHERE expires_at <= ?');
  totalCleaned += stmt3.run(now).changes;

  // 清理日度K线缓存
  const stmt4 = db.prepare('DELETE FROM daily_kline_cache WHERE expires_at <= ?');
  totalCleaned += stmt4.run(now).changes;

  return totalCleaned;
};

// ============ 点券兑换 ============

// 生成兑换码 (8位大写字母+数字)
const generateVoucherCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 创建兑换码
export const createVoucher = (points) => {
  const code = generateVoucherCode();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO vouchers (id, points, created_at)
    VALUES (?, ?, ?)
  `);

  stmt.run(code, points, now);

  return { code, points, createdAt: now };
};

// 查询兑换码
export const getVoucher = (code) => {
  const stmt = db.prepare('SELECT * FROM vouchers WHERE id = ?');
  const row = stmt.get(code.toUpperCase());

  if (!row) return null;

  return {
    code: row.id,
    points: row.points,
    createdAt: row.created_at,
    usedAt: row.used_at,
    usedBy: row.used_by,
  };
};

// 兑换点券
export const redeemVoucher = (code, userId) => {
  const voucher = getVoucher(code);

  if (!voucher) {
    return { success: false, error: 'INVALID_CODE', message: '无效的兑换码' };
  }

  if (voucher.usedAt) {
    return { success: false, error: 'ALREADY_USED', message: '该兑换码已被使用' };
  }

  // 获取用户当前积分
  const user = getUserById(userId);
  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND', message: '用户不存在' };
  }

  const newBalance = user.points + voucher.points;
  const now = new Date().toISOString();

  // 使用事务更新
  const updateVoucher = db.prepare('UPDATE vouchers SET used_at = ?, used_by = ? WHERE id = ?');
  const updateUser = db.prepare('UPDATE users SET points = ?, updated_at = ? WHERE id = ?');

  const transaction = db.transaction(() => {
    updateVoucher.run(now, userId, code.toUpperCase());
    updateUser.run(newBalance, now, userId);
  });

  transaction();

  return {
    success: true,
    points: voucher.points,
    newBalance,
    message: `成功兑换 ${voucher.points} 点券`,
  };
};

// ============ Email Subscriptions ============

// 创建邮箱订阅记录
export const createEmailSubscription = (userId) => {
  const id = `email_sub_${userId}_${Date.now()}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO email_subscriptions (
      id, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, userId, now, now);

  return {
    id,
    userId,
    emailVerified: false,
    verificationToken: null,
    verificationSentAt: null,
    verifiedAt: null,
    subDailyFortune: false,
    subMonthlyFortune: false,
    subYearlyFortune: false,
    subBirthdayReminder: false,
    subLowPoints: true,
    subFeatureUpdates: true,
    subPromotions: false,
    bindingRewardClaimed: false,
    subscriptionRewardClaimed: false,
    createdAt: now,
    updatedAt: now,
  };
};

// 获取邮箱订阅记录
export const getEmailSubscription = (userId) => {
  const stmt = db.prepare('SELECT * FROM email_subscriptions WHERE user_id = ?');
  const row = stmt.get(userId);
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    emailVerified: row.email_verified === 1,
    verificationToken: row.verification_token,
    verificationSentAt: row.verification_sent_at,
    verifiedAt: row.verified_at,
    subDailyFortune: row.sub_daily_fortune === 1,
    subMonthlyFortune: row.sub_monthly_fortune === 1,
    subYearlyFortune: row.sub_yearly_fortune === 1,
    subBirthdayReminder: row.sub_birthday_reminder === 1,
    subLowPoints: row.sub_low_points === 1,
    subFeatureUpdates: row.sub_feature_updates === 1,
    subPromotions: row.sub_promotions === 1,
    bindingRewardClaimed: row.binding_reward_claimed === 1,
    subscriptionRewardClaimed: row.subscription_reward_claimed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// 更新邮箱订阅设置
export const updateEmailSubscription = (userId, data) => {
  const fields = [];
  const values = [];

  const fieldMap = {
    emailVerified: 'email_verified',
    verificationToken: 'verification_token',
    verificationSentAt: 'verification_sent_at',
    verifiedAt: 'verified_at',
    subDailyFortune: 'sub_daily_fortune',
    subMonthlyFortune: 'sub_monthly_fortune',
    subYearlyFortune: 'sub_yearly_fortune',
    subBirthdayReminder: 'sub_birthday_reminder',
    subLowPoints: 'sub_low_points',
    subFeatureUpdates: 'sub_feature_updates',
    subPromotions: 'sub_promotions',
    bindingRewardClaimed: 'binding_reward_claimed',
    subscriptionRewardClaimed: 'subscription_reward_claimed',
  };

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && fieldMap[key]) {
      const dbKey = fieldMap[key];
      fields.push(`${dbKey} = ?`);
      // Convert boolean to integer for SQLite
      if (typeof value === 'boolean') {
        values.push(value ? 1 : 0);
      } else {
        values.push(value);
      }
    }
  });

  if (fields.length === 0) return null;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(userId);

  const stmt = db.prepare(`
    UPDATE email_subscriptions
    SET ${fields.join(', ')}
    WHERE user_id = ?
  `);

  stmt.run(...values);
  return getEmailSubscription(userId);
};

// ============ Email Logs ============

// 创建邮件日志
export const createEmailLog = (data) => {
  const stmt = db.prepare(`
    INSERT INTO email_logs (
      user_id, email_type, recipient, subject, status, error_message, sent_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  const result = stmt.run(
    data.userId || null,
    data.emailType,
    data.recipient,
    data.subject,
    data.status || 'pending',
    data.errorMessage || null,
    data.sentAt || null,
    now
  );

  return {
    id: result.lastInsertRowid,
    userId: data.userId,
    emailType: data.emailType,
    recipient: data.recipient,
    subject: data.subject,
    status: data.status || 'pending',
    errorMessage: data.errorMessage,
    sentAt: data.sentAt,
    createdAt: now,
  };
};

// 获取用户邮件日志
export const getEmailLogs = (userId, limit = 50, offset = 0) => {
  const stmt = db.prepare(`
    SELECT * FROM email_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  return stmt.all(userId, limit, offset).map(row => ({
    id: row.id,
    userId: row.user_id,
    emailType: row.email_type,
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }));
};

// ============ Password Reset Tokens ============

// 创建密码重置令牌
export const createPasswordResetToken = (userId, token, expiresAt) => {
  const id = `reset_${userId}_${Date.now()}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO password_reset_tokens (
      id, user_id, token, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, userId, token, expiresAt, now);

  return {
    id,
    userId,
    token,
    expiresAt,
    used: false,
    createdAt: now,
  };
};

// 获取密码重置令牌
export const getPasswordResetToken = (token) => {
  const stmt = db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token = ? AND used = 0 AND expires_at > ?
  `);

  const row = stmt.get(token, new Date().toISOString());
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    expiresAt: row.expires_at,
    used: row.used === 1,
    createdAt: row.created_at,
  };
};

// 标记令牌已使用
export const markPasswordResetTokenUsed = (token) => {
  const stmt = db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?');
  const result = stmt.run(token);
  return result.changes > 0;
};

// 清理过期令牌
export const cleanupExpiredTokens = () => {
  const stmt = db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used = 1');
  const result = stmt.run(new Date().toISOString());
  return result.changes;
};

// ============ Admin Settings ============

export const getAdminSetting = (key) => {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key);
  return row ? row.value : null;
};

export const setAdminSetting = (key, value) => {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO admin_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, now);
  return { key, value, updatedAt: now };
};

export const getAdminSettingsByPrefix = (prefix) => {
  const rows = db.prepare('SELECT key, value, updated_at FROM admin_settings WHERE key LIKE ? ORDER BY key').all(`${prefix}%`);
  return rows.reduce((acc, row) => {
    acc[row.key] = { value: row.value, updatedAt: row.updated_at };
    return acc;
  }, {});
};

// ============ Payment Orders ============

export const createPaymentOrder = (order) => {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO payment_orders (
      id, user_id, package_id, package_name, points, bonus_points, total_points,
      amount_cents, currency, provider, status, code_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.userId,
    order.packageId,
    order.packageName,
    order.points,
    order.bonusPoints || 0,
    order.totalPoints,
    order.amountCents,
    order.currency || 'CNY',
    order.provider || 'wechat',
    order.status || 'pending',
    order.codeUrl || null,
    now,
    now
  );
  return getPaymentOrder(order.id);
};

const mapPaymentOrder = (row) => row ? ({
  id: row.id,
  userId: row.user_id,
  packageId: row.package_id,
  packageName: row.package_name,
  points: row.points,
  bonusPoints: row.bonus_points,
  totalPoints: row.total_points,
  amountCents: row.amount_cents,
  currency: row.currency,
  provider: row.provider,
  status: row.status,
  codeUrl: row.code_url,
  transactionId: row.transaction_id,
  paidAt: row.paid_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  rawNotify: row.raw_notify,
}) : null;

export const getPaymentOrder = (orderId) => {
  const row = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId);
  return mapPaymentOrder(row);
};

export const getPaymentOrders = (limit = 50, offset = 0) => {
  const rows = db.prepare(`
    SELECT * FROM payment_orders
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  return rows.map(mapPaymentOrder);
};

export const updatePaymentOrderPayInfo = (orderId, { codeUrl = null, provider = 'wechat' } = {}) => {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE payment_orders
    SET code_url = ?, provider = ?, updated_at = ?
    WHERE id = ?
  `).run(codeUrl, provider, now, orderId);
  return getPaymentOrder(orderId);
};

export const markPaymentOrderPaid = ({ orderId, transactionId, rawNotify }) => {
  const order = getPaymentOrder(orderId);
  if (!order) return { success: false, error: 'ORDER_NOT_FOUND' };
  if (order.status === 'paid') return { success: true, order, alreadyPaid: true };

  const user = getUserById(order.userId);
  if (!user) return { success: false, error: 'USER_NOT_FOUND' };

  const now = new Date().toISOString();
  const newBalance = user.points + order.totalPoints;
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE payment_orders
      SET status = 'paid', transaction_id = ?, paid_at = ?, updated_at = ?, raw_notify = ?
      WHERE id = ? AND status != 'paid'
    `).run(transactionId || null, now, now, rawNotify ? JSON.stringify(rawNotify) : null, orderId);
    db.prepare('UPDATE users SET points = ?, updated_at = ? WHERE id = ?').run(newBalance, now, order.userId);
  });
  tx();

  return {
    success: true,
    order: { ...order, status: 'paid', transactionId, paidAt: now },
    newBalance,
    alreadyPaid: false,
  };
};

export const markPaymentOrderFailed = (orderId, rawNotify = null) => {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE payment_orders
    SET status = 'failed', updated_at = ?, raw_notify = ?
    WHERE id = ? AND status != 'paid'
  `).run(now, rawNotify ? JSON.stringify(rawNotify) : null, orderId);
  return result.changes > 0;
};

