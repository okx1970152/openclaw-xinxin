/**
 * 超级大龙虾 - 主代理模块类型定义
 * Master Agent Type Definitions
 * 
 * 存放于 src/master/types.ts
 * 主代理模块的接口和类型定义
 */

import type {
  TaskPattern,
  AgentResult,
  ModelChoice,
  LimitStatus,
  UsageStats,
} from '../types/core';

// ==================== 模式库接口 ====================

/**
 * 任务模式库接口
 */
export interface IPatternLibrary {
  /**
   * 匹配任务模式
   * @param keywords 关键词列表
   * @returns 匹配的任务模式，无匹配返回 null
   */
  matchPattern(keywords: string[]): Promise<TaskPattern | null>;

  /**
   * 归档新模式
   * @param taskDescription 任务描述
   * @param agentResult 执行结果
   * @param agentId 子代理ID
   * @param tokensUsed 消耗的 Token 数
   * @returns 创建的任务模式
   */
  archivePattern(
    taskDescription: string,
    agentResult: AgentResult,
    agentId: string,
    tokensUsed: number
  ): Promise<TaskPattern>;

  /**
   * 更新模式性能统计
   * @param patternId 模式ID
   * @param tokensUsed Token 消耗
   * @param durationSec 执行时长（秒）
   * @param succeeded 是否成功
   */
  updatePerformance(
    patternId: string,
    tokensUsed: number,
    durationSec: number,
    succeeded: boolean
  ): Promise<void>;

  /**
   * 导出所有模式
   */
  exportAll(): Promise<TaskPattern[]>;

  /**
   * 导入模式
   * @param patterns 模式列表
   * @returns 实际导入的数量
   */
  importPatterns(patterns: TaskPattern[]): Promise<number>;
}

// ==================== 模型选择器接口 ====================

/**
 * 模型类型
 */
export type ModelType = 'haiku' | 'sonnet' | 'opus';

/**
 * 模型选择器接口
 */
export interface IModelSelector {
  /**
   * 选择模型
   * @param taskDescription 任务描述
   * @param hasMatchedPattern 是否有匹配的模式
   * @param previousFailures 之前的失败次数
   * @returns 模型选择结果
   */
  selectModel(
    taskDescription: string,
    hasMatchedPattern: boolean,
    previousFailures: number
  ): ModelChoice;

  /**
   * 获取当前模型类型
   */
  getCurrentModel?(): ModelType;

  /**
   * 升级模型
   */
  upgradeModel?(reason: string): ModelChoice;
}

/**
 * 智能模型选择器配置
 */
export interface ModelSelectorConfig {
  /** 默认模型 */
  defaultModel: ModelChoice;
  /** 失败升级阈值 */
  upgradeAfterFailures: number;
  /** 是否考虑成本 */
  considerCost: boolean;
}

// ==================== Token 限流器接口 ====================

/**
 * Token 限流器接口
 */
export interface ITokenLimiter {
  /**
   * 检查是否允许使用
   * @returns 限流状态
   */
  checkLimit(): Promise<LimitStatus>;

  /**
   * 记录使用量
   * @param tokens 使用的 Token 数
   */
  recordUsage(tokens: number): Promise<void>;

  /**
   * 获取使用统计
   */
  getUsageStats(): Promise<UsageStats>;
}

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

// ==================== 任务编排接口 ====================

/**
 * 任务编排器接口
 */
export interface ITaskOrchestrator {
  /**
   * 添加任务到队列
   */
  enqueue(task: import('../types/core').TaskItem): void;

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean;

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    currentTaskId: string | null;
  };
}

// ==================== 注册表接口 ====================

/**
 * 代理注册表接口
 */
export interface IAgentRegistry {
  /**
   * 注册代理
   */
  register(config: import('../types/core').AgentConfig): Promise<void>;

  /**
   * 注销代理
   */
  unregister(agentId: string): Promise<void>;

  /**
   * 获取代理配置
   */
  get(agentId: string): import('../types/core').AgentConfig | undefined;

  /**
   * 获取所有代理
   */
  getAll(): import('../types/core').AgentConfig[];

  /**
   * 更新代理状态
   */
  updateStatus(agentId: string, status: import('../types/core').AgentStatus): Promise<void>;
}

// ==================== 导出所有类型 ====================

export type {
  TaskPattern,
  AgentResult,
  ModelChoice,
  LimitStatus,
  UsageStats,
};
