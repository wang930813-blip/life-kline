/**
 * API Gateway 使用示例
 * 演示如何在现有代码中集成 API 网关
 */

import {
  getApiMode,
  getApiConfig,
  validateApiConfig,
  routeAnalysisRequest,
  healthCheck,
  API_MODE
} from './apiGateway.js';
import { normalizeModelName } from './llmConfig.js';

import { callWithFallback, testSelfHostedConnection } from './selfHostedService.js';
import { getCloudQuota, validateCloudApiKey } from './cloudService.js';

/**
 * 示例 1: 基础分析请求
 */
export async function basicAnalysisExample(userId, baziData) {
  try {
    // 获取当前配置
    const mode = getApiMode();
    const config = getApiConfig();

    console.log(`[Example] 当前模式: ${mode}`);

    // 验证配置
    const validation = validateApiConfig(config);
    if (!validation.valid) {
      throw new Error(`配置错误: ${validation.error}`);
    }

    // 构建请求载荷
    const payload = {
      messages: [
        {
          role: 'system',
          content: '你是一位专业的命理分析师...'
        },
        {
          role: 'user',
          content: `请分析以下八字：${JSON.stringify(baziData)}`
        }
      ]
    };

    // 路由请求
    const result = await routeAnalysisRequest(mode, payload, {
      userId,
      analysisType: 'bazi'
    });

    console.log(`[Example] 分析成功，来源: ${result.source}`);
    console.log(`[Example] 耗时: ${result.elapsed}s`);

    return result.data;

  } catch (error) {
    console.error('[Example] 分析失败:', error.message);
    throw error;
  }
}

/**
 * 示例 2: 使用备选模型（仅自托管模式）
 */
export async function fallbackModelExample(userId, baziData) {
  const mode = getApiMode();

  // 仅在自托管模式下使用备选模型
  if (mode !== API_MODE.SELF_HOSTED) {
    console.log('[Example] 云服务模式不支持备选模型');
    return basicAnalysisExample(userId, baziData);
  }

  try {
    const config = getApiConfig();

    const payload = {
      messages: [
        {
          role: 'system',
          content: '你是一位专业的命理分析师...'
        },
        {
          role: 'user',
          content: `请分析以下八字：${JSON.stringify(baziData)}`
        }
      ]
    };

    // 定义备选模型列表
    const fallbackModels = [
      normalizeModelName()
    ];

    // 使用备选模型
    const result = await callWithFallback(
      payload,
      config,
      fallbackModels,
      { userId }
    );

    console.log(`[Example] 成功使用模型: ${result.data.model}`);

    return result.data;

  } catch (error) {
    console.error('[Example] 所有模型均失败:', error.message);
    throw error;
  }
}

/**
 * 示例 3: 健康检查
 */
export async function healthCheckExample() {
  try {
    const health = await healthCheck();

    console.log('[Example] 健康检查结果:');
    console.log(`  状态: ${health.status}`);
    console.log(`  模式: ${health.mode}`);
    console.log(`  端点: ${health.endpoint}`);
    console.log(`  配置完整: ${health.configured}`);

    if (!health.configured) {
      console.warn(`  错误: ${health.error}`);
    }

    return health;

  } catch (error) {
    console.error('[Example] 健康检查失败:', error.message);
    throw error;
  }
}

/**
 * 示例 4: 查询云服务配额（仅云服务模式）
 */
export async function cloudQuotaExample() {
  const mode = getApiMode();

  if (mode !== API_MODE.CLOUD_SERVICE) {
    console.log('[Example] 当前非云服务模式');
    return null;
  }

  try {
    const config = getApiConfig();
    const quota = await getCloudQuota(config.apiKey, config.endpoint);

    console.log('[Example] 云服务配额:');
    console.log(`  总配额: ${quota.total}`);
    console.log(`  已使用: ${quota.used}`);
    console.log(`  剩余: ${quota.remaining}`);
    console.log(`  重置日期: ${quota.resetDate}`);
    console.log(`  套餐: ${quota.plan}`);

    return quota;

  } catch (error) {
    console.error('[Example] 查询配额失败:', error.message);
    throw error;
  }
}

/**
 * 示例 5: 验证 API Key
 */
export async function validateApiKeyExample() {
  const mode = getApiMode();
  const config = getApiConfig();

  console.log(`[Example] 验证 ${mode} 模式的 API Key...`);

  if (mode === API_MODE.CLOUD_SERVICE) {
    // 验证云服务 API Key
    const result = await validateCloudApiKey(config.apiKey, config.endpoint);

    console.log('[Example] 云服务 API Key 验证结果:');
    console.log(`  有效: ${result.valid}`);
    if (result.valid) {
      console.log(`  用户ID: ${result.userId}`);
      console.log(`  套餐: ${result.plan}`);
    } else {
      console.log(`  错误: ${result.error}`);
    }

    return result;

  } else {
    // 测试自托管 API 连接
    const result = await testSelfHostedConnection(config);

    console.log('[Example] 自托管 API 连接测试结果:');
    console.log(`  成功: ${result.success}`);
    console.log(`  端点: ${result.endpoint}`);
    console.log(`  模型: ${result.model}`);

    if (result.success) {
      console.log(`  耗时: ${result.elapsed}s`);
      console.log(`  ${result.message}`);
    } else {
      console.log(`  错误: ${result.error}`);
    }

    return result;
  }
}

/**
 * 示例 6: 错误处理最佳实践
 */
export async function errorHandlingExample(userId, baziData) {
  const mode = getApiMode();

  try {
    const payload = {
      messages: [
        {
          role: 'system',
          content: '你是一位专业的命理分析师...'
        },
        {
          role: 'user',
          content: `请分析以下八字：${JSON.stringify(baziData)}`
        }
      ]
    };

    const result = await routeAnalysisRequest(mode, payload, {
      userId,
      analysisType: 'bazi'
    });

    return {
      success: true,
      data: result.data,
      mode: result.source
    };

  } catch (error) {
    // 根据错误类型进行不同处理
    if (error.message.includes('配额不足')) {
      return {
        success: false,
        error: 'QUOTA_EXCEEDED',
        message: '您的配额已用完，请升级套餐或购买额外配额',
        action: 'upgrade'
      };
    }

    if (error.message.includes('API Key 无效')) {
      return {
        success: false,
        error: 'INVALID_API_KEY',
        message: 'API Key 无效，请检查配置',
        action: 'reconfigure'
      };
    }

    if (error.message.includes('请求频率过高')) {
      return {
        success: false,
        error: 'RATE_LIMIT',
        message: '请求过于频繁，请稍后重试',
        action: 'retry'
      };
    }

    if (error.message.includes('超时')) {
      return {
        success: false,
        error: 'TIMEOUT',
        message: '请求超时，请检查网络连接或稍后重试',
        action: 'retry'
      };
    }

    if (error.message.includes('无法连接')) {
      return {
        success: false,
        error: 'CONNECTION_ERROR',
        message: '无法连接到服务，请检查网络或配置',
        action: 'check_config'
      };
    }

    // 未知错误
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: error.message || '分析失败，请稍后重试',
      action: 'contact_support'
    };
  }
}

/**
 * 示例 7: 在 Express 路由中使用
 */
export function setupGatewayRoutes(app) {
  // 健康检查端点
  app.get('/api/gateway/health', async (req, res) => {
    try {
      const health = await healthCheck();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 配额查询端点（仅云服务）
  app.get('/api/gateway/quota', async (req, res) => {
    const mode = getApiMode();

    if (mode !== API_MODE.CLOUD_SERVICE) {
      return res.status(400).json({
        error: '配额查询仅在云服务模式下可用'
      });
    }

    try {
      const config = getApiConfig();
      const quota = await getCloudQuota(config.apiKey, config.endpoint);
      res.json(quota);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Key 验证端点
  app.post('/api/gateway/validate', async (req, res) => {
    try {
      const result = await validateApiKeyExample();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 分析请求端点
  app.post('/api/gateway/analyze', async (req, res) => {
    const { userId, baziData } = req.body;

    if (!userId || !baziData) {
      return res.status(400).json({
        error: '缺少必要参数: userId, baziData'
      });
    }

    try {
      const result = await errorHandlingExample(userId, baziData);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 导出所有示例
export default {
  basicAnalysisExample,
  fallbackModelExample,
  healthCheckExample,
  cloudQuotaExample,
  validateApiKeyExample,
  errorHandlingExample,
  setupGatewayRoutes
};
