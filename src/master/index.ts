/**
 * 超级大龙虾 - 主代理模块入口
 * Master Agent Module Entry
 * 
 * 存放于 src/master/index.ts
 */

// 导出主代理
export {
  MasterAgent,
  TaskQueue,
  SimpleModelSelector,
  SimpleTokenLimiter,
  createMasterAgent,
} from './agent';

// 导出接口
export type {
  IMasterAgent,
  ITaskQueue,
  IModelSelector,
  ITokenLimiter,
} from './agent';

// 导出任务模式库
export {
  PatternLibrary,
  createPatternLibrary,
} from './patterns';
export type { PatternLibraryConfig, IPatternLibrary } from './patterns';

// 导出任务编排
export {
  TaskOrchestrator,
  createTaskOrchestrator,
} from './orchestrate';
export type {
  OrchestrationConfig,
  TaskContext,
  ITaskHandler,
} from './orchestrate';

// 导出成本控制
export {
  SmartModelSelector,
  TokenLimiter,
  createModelSelector,
  createTokenLimiter,
  AVAILABLE_MODELS,
} from './cost';
export type {
  ModelSelectorConfig,
  TokenLimiterConfig,
  ModelConfig,
} from './cost';

// 导出上下文管理
export {
  ContextManager,
  createContextManager,
  DEFAULT_PIN_RULES,
} from './context';
export type {
  PruningStrategy,
  ContextEntry,
  ContextManagerConfig,
  PruningResult,
  PinRule,
} from './context';

// 导出核心类型
export type {
  UnifiedMessage,
  TaskItem,
  TaskPriority,
  TaskStatus,
  AgentConfig,
  AgentResult,
  ModelChoice,
  LimitStatus,
  UsageStats,
  TaskPattern,
  TaskStrategy,
  TaskPerformance,
} from '../types/core';
