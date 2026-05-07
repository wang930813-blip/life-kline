import { normalizeApiBaseUrl, normalizeModelName } from './llmConfig.js';

/**
 * API Gateway - 路由层
 * 支持自托管 API 和官方云服务两种模式
 */

// API 运行模式
export const API_MODE = {
  SELF_HOSTED: 'self',      // 用户自己的 API
  CLOUD_SERVICE: 'cloud'    // 官方云服务
};

// 官方云服务端点
export const CLOUD_API_ENDPOINT = process.env.CLOUD_API_ENDPOINT || 'https://api.life-kline.com/v1';

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 120000;

/**
 * 获取当前 API 模式
 */
export function getApiMode() {
  const mode = process.env.API_MODE || API_MODE.SELF_HOSTED;

  // 验证模式有效性
  if (mode !== API_MODE.SELF_HOSTED && mode !== API_MODE.CLOUD_SERVICE) {
    console.warn(`[API Gateway] 无效的 API_MODE: ${mode}, 使用默认值: ${API_MODE.SELF_HOSTED}`);
    return API_MODE.SELF_HOSTED;
  }

  return mode;
}

/**
 * 获取 API 配置
 * @returns {Object} API 配置对象
 */
export function getApiConfig() {
  const mode = getApiMode();

  if (mode === API_MODE.CLOUD_SERVICE) {
    return {
      mode: API_MODE.CLOUD_SERVICE,
      endpoint: CLOUD_API_ENDPOINT,
      apiKey: process.env.CLOUD_API_KEY || '',
      timeout: DEFAULT_TIMEOUT
    };
  }

  // 自托管模式
  return {
    mode: API_MODE.SELF_HOSTED,
    endpoint: normalizeApiBaseUrl(),
    apiKey: process.env.API_KEY || '',
    model: normalizeModelName(),
    timeout: DEFAULT_TIMEOUT
  };
}

/**
 * 验证 API 配置是否完整
 * @param {Object} config - API 配置
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateApiConfig(config) {
  if (!config) {
    return { valid: false, error: 'API 配置为空' };
  }

  if (config.mode === API_MODE.CLOUD_SERVICE) {
    if (!config.apiKey) {
      return {
        valid: false,
        error: '云服务模式需要配置 CLOUD_API_KEY，请访问 life-kline.com 申请'
      };
    }
    if (!config.endpoint) {
      return { valid: false, error: '云服务端点未配置' };
    }
  } else {
    if (!config.apiKey) {
      return {
        valid: false,
        error: '自托管模式需要配置 API_KEY'
      };
    }
    if (!config.endpoint) {
      return { valid: false, error: 'API_BASE_URL 未配置' };
    }
    if (!config.model) {
      return { valid: false, error: 'DEFAULT_MODEL 未配置' };
    }
  }

  return { valid: true };
}

/**
 * 路由分析请求到对应的处理器
 * @param {string} mode - API 模式
 * @param {Object} payload - 请求载荷
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} 分析结果
 */
export async function routeAnalysisRequest(mode, payload, options = {}) {
  const config = getApiConfig();

  // 验证配置
  const validation = validateApiConfig(config);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 根据模式路由
  if (mode === API_MODE.CLOUD_SERVICE) {
    const { callCloudService } = await import('./cloudService.js');
    return callCloudService(payload, config, options);
  } else {
    const { callSelfHostedAPI } = await import('./selfHostedService.js');
    return callSelfHostedAPI(payload, config, options);
  }
}

/**
 * 健康检查
 * @returns {Promise<Object>} 健康状态
 */
export async function healthCheck() {
  const config = getApiConfig();
  const validation = validateApiConfig(config);

  return {
    status: validation.valid ? 'healthy' : 'unhealthy',
    mode: config.mode,
    endpoint: config.endpoint,
    configured: validation.valid,
    error: validation.error || null,
    timestamp: new Date().toISOString()
  };
}

/**
 * 获取 API 网关统计信息
 * @returns {Object} 统计信息
 */
export function getGatewayStats() {
  const config = getApiConfig();

  return {
    mode: config.mode,
    endpoint: config.endpoint,
    configured: validateApiConfig(config).valid,
    timestamp: new Date().toISOString()
  };
}
