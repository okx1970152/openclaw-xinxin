/**
 * 超级大龙虾 - 性能优化模块
 * Performance Module
 * 
 * 存放于 src/performance/index.ts
 */

// 类型导出
export type {
  PerformanceMetrics,
  CacheConfig,
  CacheEntry,
  CacheStats,
  PerformanceConfig,
  MemorySnapshot,
  PerformanceReport,
  SearchOptimizationConfig,
  StartupOptimizationConfig,
  PerformanceEvent,
  PerformanceEventListener,
} from './types';

// 类导出
export { LRUCache, createLRUCache } from './cache';
export { MemoryMonitor, createMemoryMonitor } from './memory-monitor';
export type { MemoryMonitorConfig, MemoryStatus } from './memory-monitor';
export { PerformanceMonitor, createPerformanceMonitor, getPerformanceMonitor } from './monitor';
export { StartupOptimizer, createStartupOptimizer, warmupCache } from './startup';

// 默认导出
import { PerformanceMonitor } from './monitor';
export default PerformanceMonitor;
