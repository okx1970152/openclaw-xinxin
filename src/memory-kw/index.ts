/**
 * 超级大龙虾 - 记忆系统模块入口
 * Memory System Module Entry
 * 
 * 存放于 src/memory-kw/index.ts
 */

// 导出类型
export * from './types';

// 导出记忆管理器
export { MemoryManager, createMemoryManager } from './memory';

// 导出检索引擎
export { SearchEngine, createSearchEngine } from './search';
export type { SearchConfig } from './search';

// 导出提练引擎
export { RefinementEngine, createRefinementEngine } from './refine';
export type { RefinementConfig } from './refine';

// 导出引擎选择器
export {
  MemoryEngineSelector,
  isKeywordEngine,
  isEmbeddingEngine,
  getEngineDescription,
  getEngineCapabilities,
  recommendEngine,
  createEngineSelector,
} from './engine-selector';

// 导出文件监听器
export { FileWatcher, createFileWatcher } from './watcher';
export type { WatcherConfig, IndexEntry, IndexFile } from './watcher';

// 导出核心类型
export type {
  PermMemCategory,
  RelationTag,
  PermMemEntry,
  TempMemEntry,
  ValidationSeverity,
  ValidationCheckName,
  ValidationCheck,
  ValidationReport,
  RefinementResult,
  ConfirmationStrategy,
  MemorySlot,
  MemoryConfig,
  MemoryStats,
  IMemoryManager,
  IRefinementEngine,
  IValidator,
  ISearchEngine,
} from './types';
