/**
 * 超级大龙虾 - 成本控制模块
 * Cost Control Module
 * 
 * 存放于 src/master/cost.ts
 * 模型选择和 Token 限流
 */

import type {
  ModelChoice,
  LimitStatus,
  UsageStats,
} from '../types/core';
import type { IModelSelector, ITokenLimiter } from './types';

// ===== 模型定义 =====

/**
 * 模型配置
 */
export interface ModelConfig {
  provider: string;
  model: string;
  maxTokens: number;
  costPer1kTokens: number;
  capabilities: string[];
}

/**
 * 可用模型列表
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    maxTokens: 32768,
    costPer1kTokens: 0.075,
    capabilities: ['complex-reasoning', 'code-generation', 'analysis'],
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 16384,
    costPer1kTokens: 0.015,
    capabilities: ['code-generation', 'analysis', 'writing'],
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    costPer1kTokens: 0.002,
    capabilities: ['simple-tasks', 'quick-responses'],
  },
  {
    provider: 'google',
    model: 'gemini-2.5-pro',
    maxTokens: 32768,
    costPer1kTokens: 0.035,
    capabilities: ['complex-reasoning', 'multimodal'],
  },
  {
    provider: 'google',
    model: 'gemini-2.5-flash',
    maxTokens: 16384,
    costPer1kTokens: 0.003,
    capabilities: ['fast-responses', 'simple-tasks'],
  },
  {
    provider: 'openai',
    model: 'gpt-4.1',
    maxTokens: 32768,
    costPer1kTokens: 0.05,
    capabilities: ['complex-reasoning', 'code-generation'],
  },
  {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    maxTokens: 16384,
    costPer1kTokens: 0.004,
    capabilities: ['simple-tasks', 'fast-responses'],
  },
];

// ===== 模型选择器 =====

/**
 * 模型选择器配置
 */
export interface ModelSelectorConfig {
  /** 默认模型 */
  defaultModel: ModelChoice;
  /** 失败升级阈值 */
  upgradeAfterFailures: number;
  /** 是否考虑成本 */
  considerCost: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_SELECTOR_CONFIG: ModelSelectorConfig = {
  defaultModel: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    reason: '默认使用 Sonnet 作为平衡选择',
  },
  upgradeAfterFailures: 2,
  considerCost: true,
};

/**
 * 智能模型选择器
 */
export class SmartModelSelector implements IModelSelector {
  private config: ModelSelectorConfig;

  constructor(config?: Partial<ModelSelectorConfig>) {
    this.config = { ...DEFAULT_SELECTOR_CONFIG, ...config };
  }

  /**
   * 选择模型
   */
  selectModel(
    taskDescription: string,
    hasMatchedPattern: boolean,
    previousFailures: number
  ): ModelChoice {
    // 1. 检查是否需要升级（失败次数过多）
    if (previousFailures >= this.config.upgradeAfterFailures) {
      return this.selectUpgradedModel(previousFailures);
    }

    // 2. 检查任务复杂度
    const complexity = this.assessComplexity(taskDescription);

    // 3. 有匹配模式且简单任务
    if (hasMatchedPattern && complexity === 'simple') {
      return {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        reason: '有匹配模式且任务简单，使用 Haiku 节省成本',
      };
    }

    // 4. 代码相关任务
    if (this.isCodeTask(taskDescription)) {
      if (complexity === 'complex') {
        return {
          provider: 'anthropic',
          model: 'claude-opus-4-20250514',
          reason: '复杂代码任务，使用 Opus 确保质量',
        };
      }
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        reason: '代码任务，使用 Sonnet 平衡质量和成本',
      };
    }

    // 5. 分析任务
    if (this.isAnalysisTask(taskDescription)) {
      if (complexity === 'complex') {
        return {
          provider: 'anthropic',
          model: 'claude-opus-4-20250514',
          reason: '复杂分析任务，使用 Opus',
        };
      }
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        reason: '分析任务，使用 Sonnet',
      };
    }

    // 6. 写作任务
    if (this.isWritingTask(taskDescription)) {
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        reason: '写作任务，使用 Sonnet',
      };
    }

    // 7. 默认
    return this.config.defaultModel;
  }

  /**
   * 获取模型配置
   */
  getModelConfig(model: string): ModelConfig | undefined {
    return AVAILABLE_MODELS.find(m => m.model === model);
  }

  // ===== 私有方法 =====

  /**
   * 选择升级模型
   */
  private selectUpgradedModel(previousFailures: number): ModelChoice {
    // 根据失败次数升级
    if (previousFailures >= 3) {
      return {
        provider: 'anthropic',
        model: 'claude-opus-4-20250514',
        reason: `连续失败 ${previousFailures} 次，升级到 Opus`,
      };
    }

    return {
      provider: 'anthropic',
      model: 'claude-opus-4-20250514',
      reason: `连续失败 ${previousFailures} 次，升级到 Opus`,
    };
  }

  /**
   * 评估任务复杂度
   */
  private assessComplexity(description: string): 'simple' | 'medium' | 'complex' {
    const length = description.length;
    const hasCode = /代码|code|编程|debug|实现|重构/.test(description);
    const hasAnalysis = /分析|研究|调研|评估/.test(description);
    const hasMultiple = /同时|多个|批量|并行/.test(description);

    if (length < 50 && !hasCode && !hasAnalysis) {
      return 'simple';
    }

    if (length > 200 || hasMultiple || (hasCode && hasAnalysis)) {
      return 'complex';
    }

    return 'medium';
  }

  /**
   * 判断是否是代码任务
   */
  private isCodeTask(description: string): boolean {
    const codeKeywords = [
      '代码', 'code', '编程', 'debug', '重构', '实现',
      '函数', '类', '模块', 'API', '接口', 'bug',
      '修复', '开发', '编写代码',
    ];
    return codeKeywords.some(kw => description.toLowerCase().includes(kw));
  }

  /**
   * 判断是否是分析任务
   */
  private isAnalysisTask(description: string): boolean {
    const analysisKeywords = [
      '分析', '研究', '调研', '评估', '调查',
      '比较', '对比', '总结', '归纳', '数据',
    ];
    return analysisKeywords.some(kw => description.toLowerCase().includes(kw));
  }

  /**
   * 判断是否是写作任务
   */
  private isWritingTask(description: string): boolean {
    const writingKeywords = [
      '写', '撰写', '编写', '生成', '创作',
      '文档', '文章', '报告', '说明', 'README',
    ];
    return writingKeywords.some(kw => description.toLowerCase().includes(kw));
  }
}

// ===== Token 限流器 =====

/**
 * Token 限流器配置
 */
export interface TokenLimiterConfig {
  /** 小时限额 */
  hourlyLimit: number;
  /** 日限额 */
  dailyLimit: number;
  /** 月限额 */
  monthlyLimit: number;
  /** 警告阈值（比例） */
  warningThreshold: number;
}

/**
 * 默认限流配置
 */
const DEFAULT_LIMITER_CONFIG: TokenLimiterConfig = {
  hourlyLimit: 100000,
  dailyLimit: 500000,
  monthlyLimit: 10000000,
  warningThreshold: 0.8,
};

/**
 * Token 限流器
 */
export class TokenLimiter implements ITokenLimiter {
  private config: TokenLimiterConfig;
  private usage: {
    hourly: number;
    daily: number;
    monthly: number;
    total: number;
  };
  private lastReset: {
    hourly: number;
    daily: number;
    monthly: number;
  };

  constructor(config?: Partial<TokenLimiterConfig>) {
    this.config = { ...DEFAULT_LIMITER_CONFIG, ...config };
    
    const now = Date.now();
    this.usage = {
      hourly: 0,
      daily: 0,
      monthly: 0,
      total: 0,
    };
    this.lastReset = {
      hourly: now,
      daily: now,
      monthly: now,
    };
  }

  /**
   * 检查是否允许使用
   */
  async checkLimit(): Promise<LimitStatus> {
    this.resetIfNeeded();

    const hourlyRemaining = this.config.hourlyLimit - this.usage.hourly;
    const dailyRemaining = this.config.dailyLimit - this.usage.daily;

    // 检查小时限额
    if (hourlyRemaining <= 0) {
      return {
        allowed: false,
        hourly_remaining: 0,
        daily_remaining: dailyRemaining,
        reason: '已达到小时 Token 上限',
      };
    }

    // 检查日限额
    if (dailyRemaining <= 0) {
      return {
        allowed: false,
        hourly_remaining: hourlyRemaining,
        daily_remaining: 0,
        reason: '已达到每日 Token 上限',
      };
    }

    // 检查月限额
    const monthlyRemaining = this.config.monthlyLimit - this.usage.monthly;
    if (monthlyRemaining <= 0) {
      return {
        allowed: false,
        hourly_remaining: hourlyRemaining,
        daily_remaining: dailyRemaining,
        reason: '已达到每月 Token 上限',
      };
    }

    // 警告检查
    let reason: string | undefined;
    if (hourlyRemaining < this.config.hourlyLimit * (1 - this.config.warningThreshold)) {
      reason = `小时额度即将耗尽（剩余 ${hourlyRemaining} tokens）`;
    } else if (dailyRemaining < this.config.dailyLimit * (1 - this.config.warningThreshold)) {
      reason = `日额度即将耗尽（剩余 ${dailyRemaining} tokens）`;
    }

    return {
      allowed: true,
      hourly_remaining: hourlyRemaining,
      daily_remaining: dailyRemaining,
      reason,
    };
  }

  /**
   * 记录使用量
   */
  async recordUsage(tokens: number): Promise<void> {
    this.resetIfNeeded();

    this.usage.hourly += tokens;
    this.usage.daily += tokens;
    this.usage.monthly += tokens;
    this.usage.total += tokens;
  }

  /**
   * 获取使用统计
   */
  async getUsageStats(): Promise<UsageStats> {
    this.resetIfNeeded();

    return {
      hourly_used: this.usage.hourly,
      hourly_limit: this.config.hourlyLimit,
      daily_used: this.usage.daily,
      daily_limit: this.config.dailyLimit,
      total_used: this.usage.total,
    };
  }

  /**
   * 获取详细统计
   */
  getDetailedStats(): {
    hourly: number;
    daily: number;
    monthly: number;
    total: number;
    limits: TokenLimiterConfig;
  } {
    this.resetIfNeeded();

    return {
      hourly: this.usage.hourly,
      daily: this.usage.daily,
      monthly: this.usage.monthly,
      total: this.usage.total,
      limits: this.config,
    };
  }

  /**
   * 重置使用量（手动）
   */
  reset(type: 'hourly' | 'daily' | 'monthly' | 'all'): void {
    const now = Date.now();

    if (type === 'hourly' || type === 'all') {
      this.usage.hourly = 0;
      this.lastReset.hourly = now;
    }
    if (type === 'daily' || type === 'all') {
      this.usage.daily = 0;
      this.lastReset.daily = now;
    }
    if (type === 'monthly' || type === 'all') {
      this.usage.monthly = 0;
      this.lastReset.monthly = now;
    }
  }

  // ===== 私有方法 =====

  /**
   * 按需重置
   */
  private resetIfNeeded(): void {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const monthMs = 30 * 24 * 60 * 60 * 1000;

    if (now - this.lastReset.hourly >= hourMs) {
      this.usage.hourly = 0;
      this.lastReset.hourly = now;
    }

    if (now - this.lastReset.daily >= dayMs) {
      this.usage.daily = 0;
      this.lastReset.daily = now;
    }

    if (now - this.lastReset.monthly >= monthMs) {
      this.usage.monthly = 0;
      this.lastReset.monthly = now;
    }
  }
}

// ===== 工厂函数 =====

/**
 * 创建模型选择器
 */
export function createModelSelector(config?: Partial<ModelSelectorConfig>): IModelSelector {
  return new SmartModelSelector(config);
}

/**
 * 创建 Token 限流器
 */
export function createTokenLimiter(config?: Partial<TokenLimiterConfig>): ITokenLimiter {
  return new TokenLimiter(config);
}

export default {
  SmartModelSelector,
  TokenLimiter,
  AVAILABLE_MODELS,
};
