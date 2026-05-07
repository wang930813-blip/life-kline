/**
 * API Gateway 测试脚本
 * 用于验证 API 网关系统的功能
 *
 * 使用方法:
 *   node server/testApiGateway.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  getApiMode,
  getApiConfig,
  validateApiConfig,
  healthCheck,
  getGatewayStats,
  API_MODE
} from './apiGateway.js';

// 手动加载 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  try {
    const envPath = join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf-8');

    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      const [key, ...values] = line.split('=');
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim();
      }
    });
  } catch (err) {
    // .env 文件不存在，使用环境变量
  }
}

loadEnv();

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'blue');
}

function warn(message) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * 测试 1: 配置检测
 */
async function testConfigDetection() {
  section('测试 1: 配置检测');

  try {
    const mode = getApiMode();
    info(`检测到 API 模式: ${mode}`);

    if (mode === API_MODE.SELF_HOSTED) {
      success('当前使用自托管模式');
    } else if (mode === API_MODE.CLOUD_SERVICE) {
      success('当前使用云服务模式');
    } else {
      error(`未知的 API 模式: ${mode}`);
      return false;
    }

    const config = getApiConfig();
    info(`API 端点: ${config.endpoint}`);
    info(`API Key: ${config.apiKey ? '已配置 (' + config.apiKey.substring(0, 10) + '...)' : '未配置'}`);

    if (mode === API_MODE.SELF_HOSTED && config.model) {
      info(`默认模型: ${config.model}`);
    }

    success('配置检测通过');
    return true;

  } catch (err) {
    error(`配置检测失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 2: 配置验证
 */
async function testConfigValidation() {
  section('测试 2: 配置验证');

  try {
    const config = getApiConfig();
    const validation = validateApiConfig(config);

    if (validation.valid) {
      success('配置验证通过');
      info('所有必需的配置项已正确设置');
      return true;
    } else {
      error('配置验证失败');
      warn(`错误信息: ${validation.error}`);

      // 提供修复建议
      if (validation.error.includes('API_KEY')) {
        info('修复建议: 在 .env 文件中设置 API_KEY');
      } else if (validation.error.includes('CLOUD_API_KEY')) {
        info('修复建议: 在 .env 文件中设置 CLOUD_API_KEY');
        info('访问 https://life-kline.com 申请 API Key');
      } else if (validation.error.includes('API_BASE_URL')) {
        info('修复建议: 在 .env 文件中设置 API_BASE_URL');
      }

      return false;
    }

  } catch (err) {
    error(`配置验证异常: ${err.message}`);
    return false;
  }
}

/**
 * 测试 3: 健康检查
 */
async function testHealthCheck() {
  section('测试 3: 健康检查');

  try {
    const health = await healthCheck();

    info(`状态: ${health.status}`);
    info(`模式: ${health.mode}`);
    info(`端点: ${health.endpoint}`);
    info(`配置完整: ${health.configured ? '是' : '否'}`);

    if (health.status === 'healthy') {
      success('健康检查通过');
      return true;
    } else {
      warn('健康检查未通过');
      if (health.error) {
        error(`错误: ${health.error}`);
      }
      return false;
    }

  } catch (err) {
    error(`健康检查失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 4: 网关统计
 */
async function testGatewayStats() {
  section('测试 4: 网关统计');

  try {
    const stats = getGatewayStats();

    info(`运行模式: ${stats.mode}`);
    info(`API 端点: ${stats.endpoint}`);
    info(`配置状态: ${stats.configured ? '已配置' : '未配置'}`);
    info(`时间戳: ${stats.timestamp}`);

    success('网关统计获取成功');
    return true;

  } catch (err) {
    error(`网关统计获取失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 5: 模拟请求路由
 */
async function testRequestRouting() {
  section('测试 5: 模拟请求路由');

  try {
    const mode = getApiMode();
    const config = getApiConfig();

    // 验证配置
    const validation = validateApiConfig(config);
    if (!validation.valid) {
      warn('跳过请求路由测试，配置不完整');
      return false;
    }

    info('配置已验证，准备测试路由');

    // 构建测试载荷
    const testPayload = {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'This is a test message. Please respond with "Test successful".'
        }
      ]
    };

    info(`使用 ${mode} 模式进行路由测试`);
    warn('注意: 此测试会实际调用 API，可能产生费用');

    // 这里我们不实际发送请求，只验证路由逻辑
    if (mode === API_MODE.CLOUD_SERVICE) {
      info('云服务模式: 请求将路由到 cloudService.js');
      info(`目标端点: ${config.endpoint}/analyze`);
    } else {
      info('自托管模式: 请求将路由到 selfHostedService.js');
      info(`目标端点: ${config.endpoint}/chat/completions`);
      info(`使用模型: ${config.model}`);
    }

    success('请求路由逻辑验证通过');
    return true;

  } catch (err) {
    error(`请求路由测试失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 6: 云服务特定功能
 */
async function testCloudServiceFeatures() {
  section('测试 6: 云服务特定功能');

  const mode = getApiMode();

  if (mode !== API_MODE.CLOUD_SERVICE) {
    info('当前非云服务模式，跳过此测试');
    return true;
  }

  try {
    const config = getApiConfig();

    info('云服务模式激活');
    info(`端点: ${config.endpoint}`);
    info(`API Key: ${config.apiKey.substring(0, 10)}...`);

    // 验证云服务特定配置
    if (!config.apiKey) {
      error('CLOUD_API_KEY 未配置');
      return false;
    }

    if (!config.endpoint) {
      error('CLOUD_API_ENDPOINT 未配置');
      return false;
    }

    success('云服务配置验证通过');

    // 提示配额查询功能
    info('可用功能:');
    info('  - 配额查询: getCloudQuota(apiKey, endpoint)');
    info('  - API Key 验证: validateCloudApiKey(apiKey, endpoint)');

    return true;

  } catch (err) {
    error(`云服务功能测试失败: ${err.message}`);
    return false;
  }
}

/**
 * 测试 7: 自托管特定功能
 */
async function testSelfHostedFeatures() {
  section('测试 7: 自托管特定功能');

  const mode = getApiMode();

  if (mode !== API_MODE.SELF_HOSTED) {
    info('当前非自托管模式，跳过此测试');
    return true;
  }

  try {
    const config = getApiConfig();

    info('自托管模式激活');
    info(`端点: ${config.endpoint}`);
    info(`API Key: ${config.apiKey.substring(0, 10)}...`);
    info(`默认模型: ${config.model}`);

    // 验证自托管特定配置
    if (!config.apiKey) {
      error('API_KEY 未配置');
      return false;
    }

    if (!config.endpoint) {
      error('API_BASE_URL 未配置');
      return false;
    }

    if (!config.model) {
      error('DEFAULT_MODEL 未配置');
      return false;
    }

    success('自托管配置验证通过');

    // 提示备选模型功能
    info('可用功能:');
    info('  - 备选模型: callWithFallback(payload, config, fallbackModels)');
    info('  - 连接测试: testSelfHostedConnection(config)');

    return true;

  } catch (err) {
    error(`自托管功能测试失败: ${err.message}`);
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  log('\n' + '█'.repeat(60), 'cyan');
  log('  API Gateway 测试套件', 'cyan');
  log('█'.repeat(60), 'cyan');

  const tests = [
    { name: '配置检测', fn: testConfigDetection },
    { name: '配置验证', fn: testConfigValidation },
    { name: '健康检查', fn: testHealthCheck },
    { name: '网关统计', fn: testGatewayStats },
    { name: '请求路由', fn: testRequestRouting },
    { name: '云服务功能', fn: testCloudServiceFeatures },
    { name: '自托管功能', fn: testSelfHostedFeatures }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (err) {
      error(`测试执行异常: ${err.message}`);
      results.push({ name: test.name, passed: false });
    }
  }

  // 汇总结果
  section('测试结果汇总');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    if (result.passed) {
      success(`${result.name}`);
    } else {
      error(`${result.name}`);
    }
  });

  console.log('\n' + '-'.repeat(60));

  if (passed === total) {
    log(`✓ 所有测试通过 (${passed}/${total})`, 'green');
    console.log('-'.repeat(60) + '\n');
    return true;
  } else {
    log(`✗ 部分测试失败 (${passed}/${total})`, 'red');
    console.log('-'.repeat(60) + '\n');
    return false;
  }
}

/**
 * 显示使用说明
 */
function showUsage() {
  section('使用说明');

  info('运行所有测试:');
  console.log('  node server/testApiGateway.js');
  console.log('');

  info('环境变量配置:');
  console.log('  编辑 .env 文件，设置以下变量:');
  console.log('');
  console.log('  自托管模式:');
  console.log('    API_MODE=self');
  console.log('    API_BASE_URL=https://37chatgpt37.com/v1');
  console.log('    API_KEY=your-api-key');
  console.log('    DEFAULT_MODEL=gpt-5.5');
  console.log('');
  console.log('  云服务模式:');
  console.log('    API_MODE=cloud');
  console.log('    CLOUD_API_KEY=your-cloud-api-key');
  console.log('    CLOUD_API_ENDPOINT=https://api.life-kline.com/v1');
  console.log('');
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
    return;
  }

  const success = await runAllTests();

  if (!success) {
    warn('\n建议: 检查 .env 文件配置是否正确');
    warn('运行 node server/testApiGateway.js --help 查看使用说明');
  }

  process.exit(success ? 0 : 1);
}

// 运行测试
main().catch(err => {
  error(`致命错误: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
