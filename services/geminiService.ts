
import { UserInput, LifeDestinyResult, AgentType, AgentStatus, ParallelAnalysisResponse } from "../types";

export interface AnalysisResponse {
  result: LifeDestinyResult;
  isGuest: boolean;
  user: { id: string; email: string; points: number } | null;
  cost: number;
  fromCache?: boolean;
}

export interface ProgressCallback {
  (message: string): void;
}

export interface AgentProgressCallback {
  (agentType: AgentType, status: AgentStatus): void;
}

export interface ParallelAnalysisCallbacks {
  onProgress?: ProgressCallback;
  onAgentUpdate?: AgentProgressCallback;
  onCacheHit?: () => void;
}

const normalizeAgentType = (agentType: string): AgentType => {
  if (agentType === 'kline_past' || agentType === 'kline_future') return 'kline';
  return agentType as AgentType;
};

/**
 * 使用SSE流式获取分析结果，提供实时进度反馈
 * 主要API - 支持长时间请求（通过心跳保活）
 */
export const generateLifeAnalysis = async (
  input: UserInput,
  onProgress?: ProgressCallback
): Promise<AnalysisResponse> => {
  return new Promise((resolve, reject) => {
    // 使用fetch + SSE手动处理
    fetch('/api/analyze-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        // 处理特定错误
        if (payload?.error === 'INSUFFICIENT_POINTS') {
          throw new Error(`点数不足（当前剩余 ${payload?.points ?? 0} 点），请充值或使用自定义 API。`);
        }
        throw new Error(payload?.message || payload?.error || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理SSE消息
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // 忽略心跳注释行
          if (line.startsWith(': keep-alive')) continue;

          const eventMatch = line.match(/^event: (.+)$/m);
          const dataMatch = line.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            let data;
            try {
              data = JSON.parse(dataMatch[1]);
            } catch {
              console.warn('无法解析SSE数据:', dataMatch[1]);
              continue;
            }

            if (event === 'progress') {
              onProgress?.(data.message);
            } else if (event === 'complete') {
              resolve({
                result: data.result as LifeDestinyResult,
                isGuest: data.isGuest || false,
                user: data.user || null,
                cost: data.cost || 0,
              });
              return;
            } else if (event === 'error') {
              // 处理特定错误码
              if (data.error === 'INSUFFICIENT_POINTS') {
                reject(new Error(`点数不足（当前剩余 ${data.points ?? 0} 点），请充值或使用自定义 API。`));
              } else if (data.error === 'INVALID_JSON_FORMAT') {
                reject(new Error('AI模型返回格式错误，请重试'));
              } else if (data.error === 'ALL_MODELS_FAILED') {
                reject(new Error('所有AI模型均无法响应，请稍后重试'));
              } else {
                reject(new Error(data.message || data.error || '分析失败'));
              }
              return;
            }
          }
        }
      }

      // 如果流结束但没有收到complete事件
      reject(new Error('连接意外中断，请重试'));
    }).catch(error => {
      console.error("Gemini/OpenAI API Error:", error);
      reject(error);
    });
  });
};

/**
 * 兼容旧版本的非流式API（已废弃，保留用于降级）
 */
export const generateLifeAnalysisLegacy = async (input: UserInput): Promise<AnalysisResponse> => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (payload?.error === 'LOGIN_REQUIRED') {
        throw new Error('免费模式需要登录：请在表单里填写邮箱与密码（系统将自动注册/登录），或开启"自定义 API"。');
      }
      if (payload?.error === 'INVALID_CREDENTIALS') {
        throw new Error('邮箱或密码错误。');
      }
      if (payload?.error === 'INVALID_INPUT') {
        throw new Error('邮箱或密码不合法（密码至少 6 位）。');
      }
      if (payload?.error === 'INSUFFICIENT_POINTS') {
        throw new Error(`点数不足（当前剩余 ${payload?.points ?? 0} 点），请充值或使用自定义 API。`);
      }
      if (payload?.error === 'MISSING_CUSTOM_API_CONFIG') {
        throw new Error('请完整填写自定义 API 配置（Base URL / Key / 模型）。');
      }
      if (payload?.detail) {
        throw new Error(`API 请求失败: ${payload.detail}`);
      }
      throw new Error(payload?.error || '命理测算过程中发生了意外错误，请重试。');
    }

    if (!payload?.result) {
      throw new Error('模型未返回任何内容。');
    }

    return {
      result: payload.result as LifeDestinyResult,
      isGuest: payload.isGuest || false,
      user: payload.user || null,
      cost: payload.cost || 0,
    };
  } catch (error) {
    console.error("Gemini/OpenAI API Error:", error);
    throw error;
  }
};

/**
 * 并行分析API - 5个Agent同时工作，支持渐进式展示
 * 推荐使用此API以获得最佳用户体验
 */
export const generateParallelAnalysis = async (
  input: UserInput,
  callbacks?: ParallelAnalysisCallbacks
): Promise<ParallelAnalysisResponse> => {
  return new Promise((resolve, reject) => {
    fetch('/api/analyze-parallel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));

        if (payload?.error === 'INSUFFICIENT_POINTS') {
          throw new Error(`点数不足（当前剩余 ${payload?.points ?? 0} 点），请充值或使用自定义 API。`);
        }
        throw new Error(payload?.message || payload?.error || '请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理SSE消息
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith(': keep-alive')) continue;

          const eventMatch = line.match(/^event: (.+)$/m);
          const dataMatch = line.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            let data;
            try {
              data = JSON.parse(dataMatch[1]);
            } catch {
              console.warn('无法解析SSE数据:', dataMatch[1]);
              continue;
            }

            // 处理不同类型的事件
            if (event === 'progress') {
              callbacks?.onProgress?.(data.message);
            } else if (event.startsWith('agent_') && event.endsWith('_complete')) {
              const rawAgentType = event.replace('agent_', '').replace('_complete', '');
              const agentType = normalizeAgentType(rawAgentType);
              callbacks?.onAgentUpdate?.(agentType, {
                status: 'completed',
                data: { ...(data.data || {}), agentPart: rawAgentType },
                elapsed: data.elapsed,
                model: data.model,
              });
            } else if (event.startsWith('agent_') && event.endsWith('_error')) {
              const agentType = normalizeAgentType(event.replace('agent_', '').replace('_error', ''));
              callbacks?.onAgentUpdate?.(agentType, {
                status: 'failed',
                error: data.error,
              });
            } else if (event === 'cache_hit') {
              callbacks?.onCacheHit?.();
              callbacks?.onProgress?.('✓ 命中缓存，直接返回一致性结果');
            } else if (event === 'parallel_start') {
              callbacks?.onProgress?.('🚀 启动5个专业Agent并行分析...');
            } else if (event === 'complete') {
              resolve({
                result: data.result as LifeDestinyResult,
                isGuest: data.isGuest || false,
                user: data.user || null,
                cost: data.cost || 0,
                fromCache: data.fromCache || false,
                processingTimeMs: data.processingTimeMs,
                agentsUsed: data.agentsUsed,
                successCount: data.successCount,
                totalAgents: data.totalAgents,
              });
              return;
            } else if (event === 'error') {
              if (data.error === 'INSUFFICIENT_POINTS') {
                reject(new Error(`点数不足（当前剩余 ${data.points ?? 0} 点），请充值或使用自定义 API。`));
              } else if (data.error === 'ALL_AGENTS_FAILED') {
                reject(new Error('所有Agent分析均失败，请稍后重试'));
              } else {
                reject(new Error(data.message || data.error || '分析失败'));
              }
              return;
            }
          }
        }
      }

      reject(new Error('连接意外中断，请重试'));
    }).catch(error => {
      console.error("Parallel Analysis API Error:", error);
      reject(error);
    });
  });
};

/**
 * 检查缓存状态（不执行分析）
 */
export const checkCacheStatus = async (input: UserInput): Promise<{ cached: boolean }> => {
  try {
    const response = await fetch('/api/cache/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        yearPillar: input.yearPillar,
        monthPillar: input.monthPillar,
        dayPillar: input.dayPillar,
        hourPillar: input.hourPillar,
        gender: input.gender,
      }),
    });

    const data = await response.json();
    return { cached: data.cached || false };
  } catch {
    return { cached: false };
  }
};

/**
 * 获取缓存统计信息
 */
export const getCacheStats = async (): Promise<{ total: number; recentlyAdded: number }> => {
  try {
    const response = await fetch('/api/cache/stats');
    const data = await response.json();
    return data.stats || { total: 0, recentlyAdded: 0 };
  } catch {
    return { total: 0, recentlyAdded: 0 };
  }
};
