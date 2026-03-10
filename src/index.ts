/**
 * 超级大龙虾 (Super Lobster) - 核心模块入口
 * 
 * @module super-lobster
 */

// 核心类型
export * from './types/core.js';

// 记忆系统
export * from './memory-kw/types.js';
export { MemoryManager } from './memory-kw/memory.js';
export { RefinementEngine } from './memory-kw/refine.js';
export { SearchEngine } from './memory-kw/search.js';
export { FourStepValidator } from './memory-kw/validate.js';

// 主代理
export { MasterAgent } from './master/agent.js';
export { AgentRegistryManager } from './master/registry.js';

// #15 修复：补全缺失的导出
// 主代理模块 - 成本控制
export { SmartModelSelector, TokenLimiter } from './master/cost.js';
export type { ModelConfig, CORE_MODELS, EXTENDED_MODELS, AVAILABLE_MODELS } from './master/cost.js';

// 主代理模块 - 任务编排
export { TaskOrchestrator } from './master/orchestrate.js';
export type { OrchestrationConfig, TaskContext, ITaskHandler } from './master/orchestrate.js';

// 主代理模块 - 上下文管理
export { ContextManager } from './master/context.js';
export type { ContextManagerConfig, ContextEntry, PruningStrategy, PruningResult } from './master/context.js';

// 主代理模块 - 任务模式库
export { PatternLibrary } from './master/patterns.js';
export type { PatternLibraryConfig } from './master/patterns.js';

// 主代理模块 - 类型定义
export type {
  IPatternLibrary,
  IModelSelector,
  ITokenLimiter,
  ITaskOrchestrator,
  IAgentRegistry,
  ModelType,
  ModelSelectorConfig,
  TokenLimiterConfig,
} from './master/types.js';

// CLI 适配器
export { CLIAdapter } from './cli/adapter.js';
export type { ICLIAdapter, ParsedCommand, CLIAdapterConfig } from './cli/adapter.js';
export { COMMAND_MAP, COMMAND_ALIASES, COMMAND_HELP } from './cli/adapter.js';

// Telegram 适配器
export { TelegramAdapter } from './telegram/adapter.js';
export type {
  ITelegramAdapter,
  TelegramAdapterConfig,
  SendMessageOptions,
  ConfirmationOptions,
  TelegramInlineKeyboard,
  TelegramUpdate,
  TelegramMessage,
  TelegramCallbackQuery,
} from './telegram/adapter.js';
