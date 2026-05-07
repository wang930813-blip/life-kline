/**
 * 自托管服务模块
 * 调用用户自己配置的 AI API
 */

import fetch from 'node-fetch';
import { logEvent } from './database.js';

/**
 * 调用自托管 API 进行分析
 * @param {Object} payload - 分析请求载荷
 * @param {Object} config - API 配置
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} 分析结果
 */
export async function callSelfHostedAPI(payload, config, options = {}) {
  const { endpoint, apiKey, model, timeout = 120000 } = config;
  const { userId, systemPrompt, userPrompt, temperature = 0.7 } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const startTime = Date.now();

    // 日志记录
    await logEvent('self_hosted_request', {
      userId,
      model,
      timestamp: new Date().toISOString()
    });

    console.log(`[Self Hosted] 发起自托管 API 请求 - 模型: ${model}`);

    // 构建请求消息
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt });
    }

    // 如果 payload 包含完整的 messages，使用它
    const requestMessages = payload.messages || messages;

    // 调用自托管 API
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: requestMessages,
        temperature: temperature,
        ...payload.options // 允许传入其他参数
      })
    });

    clearTimeout(timeoutId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // 处理响应
    if (!response.ok) {
      const errorText = await response.text();

      // 日志记录失败
      await logEvent('self_hosted_error', {
        userId,
        model,
        status: response.status,
        error: errorText.substring(0, 200),
        elapsed: `${elapsed}s`
      });

      throw new Error(`自托管 API 请求失败 (HTTP ${response.status}): ${errorText.substring(0, 100)}`);
    }

    const responseText = await response.text();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (e) {
      await logEvent('self_hosted_parse_error', {
        userId,
        model,
        error: 'JSON 解析失败',
        response: responseText.substring(0, 200)
      });
      throw new Error('API 响应格式错误，无法解析 JSON');
    }

    // 提取内容
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      await logEvent('self_hosted_empty_response', {
        userId,
        model,
        result: JSON.stringify(result).substring(0, 200)
      });
      throw new Error('API 返回空内容');
    }

    // 日志记录成功
    await logEvent('self_hosted_success', {
      userId,
      model,
      elapsed: `${elapsed}s`,
      tokens: result.usage?.total_tokens || null
    });

    console.log(`[Self Hosted] 自托管 API 请求成功 - 模型: ${model}, 耗时: ${elapsed}s`);

    // 返回标准化结果
    return {
      success: true,
      data: {
        content: cleanResponseContent(content),
        rawContent: content,
        model: result.model || model,
        usage: result.usage || null
      },
      elapsed: parseFloat(elapsed),
      source: 'self-hosted'
    };

  } catch (error) {
    clearTimeout(timeoutId);

    // 超时处理
    if (error.name === 'AbortError') {
      await logEvent('self_hosted_timeout', {
        userId,
        model,
        timeout: `${timeout}ms`
      });
      throw new Error('自托管 API 请求超时，请检查网络或增加超时时间');
    }

    // 网络错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      await logEvent('self_hosted_network_error', {
        userId,
        model,
        endpoint,
        error: error.message
      });
      throw new Error(`无法连接到 ${endpoint}，请检查 API_BASE_URL 配置`);
    }

    // 其他错误
    console.error('[Self Hosted] 自托管 API 请求失败:', error);
    throw error;
  }
}

/**
 * 清理响应内容
 * 移除 markdown 代码块、thinking 标签等
 * @param {string} content - 原始内容
 * @returns {string} 清理后的内容
 */
function cleanResponseContent(content) {
  if (!content) return '';

  let cleaned = content.trim();

  // 移除 <think> 标签
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 移除前导非 JSON 内容
  cleaned = cleaned.replace(/^[\s\S]*?(?=\{)/m, '');

  // 移除 markdown 代码块标记
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  // 提取 JSON 部分
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

/**
 * 使用备选模型进行请求
 * @param {Object} payload - 分析请求载荷
 * @param {Object} config - API 配置
 * @param {Array<string>} fallbackModels - 备选模型列表
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} 分析结果
 */
export async function callWithFallback(payload, config, fallbackModels, options = {}) {
  const models = [config.model];
  const errors = [];

  for (const model of models) {
    try {
      console.log(`[Self Hosted] 尝试模型: ${model}`);

      const result = await callSelfHostedAPI(payload, { ...config, model }, options);

      console.log(`[Self Hosted] 模型 ${model} 请求成功`);
      return result;

    } catch (error) {
      console.warn(`[Self Hosted] 模型 ${model} 请求失败:`, error.message);
      errors.push({ model, error: error.message });

      // 如果是配置错误或网络错误，不继续尝试
      if (error.message.includes('无法连接') || error.message.includes('API_BASE_URL')) {
        throw error;
      }
    }
  }

  // 所有模型都失败
  const errorMsg = errors.map(e => `${e.model}: ${e.error}`).join('; ');
  throw new Error(`所有模型请求均失败: ${errorMsg}`);
}

/**
 * 测试自托管 API 连接
 * @param {Object} config - API 配置
 * @returns {Promise<Object>} 测试结果
 */
export async function testSelfHostedConnection(config) {
  const { endpoint, apiKey, model } = config;

  try {
    const testPayload = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Connection test successful" in one sentence.' }
      ]
    };

    const result = await callSelfHostedAPI(
      testPayload,
      config,
      { timeout: 30000 } // 30秒超时
    );

    return {
      success: true,
      endpoint,
      model,
      elapsed: result.elapsed,
      message: '连接测试成功'
    };

  } catch (error) {
    return {
      success: false,
      endpoint,
      model,
      error: error.message
    };
  }
}
