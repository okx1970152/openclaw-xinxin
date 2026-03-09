/**
 * 超级大龙虾 - 性能优化类型定义
 * Performance Types
 * 
 * 存放于 src/performance/types.ts
 */

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 启动时间（毫秒） */
  startupTimeMs: number;
  /** 内存使用（字节） */
  memoryUsageBytes: number;
  /** 检索平均延迟（毫秒） */
  avgSearchLatencyMs: number;
  /** 索引构建时间（毫秒） */
  indexBuildTimeMs: number;
  /** 任务处理吞吐量（任务/分钟） */
  taskThroughput: number;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 最大缓存条目数 */
  maxEntries: number;
  /** 缓存过期时间（毫秒） */
  ttlMs: number;
  /** 是否启用 LRU 淘汰 */
  enableLRU: boolean;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = unknown> {
  /** 缓存值 */
  value: T;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 访问次数 */
  accessCount: number;
}

/**
 * 缓存统计
 */
export interface CacheStats {
  /** 总条目数 */
  totalEntries: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 淘汰次数 */
  evictions: number;
  /** 命中率 */
  hitRate: number;
  /** 平均访问次数 */
  avgAccessCount: number;
  /** 内存占用估算（字节） */
  estimatedSizeBytes: number;
}

/**
 * 性能优化配置
 */
export interface PerformanceConfig {
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存配置 */
  cache: CacheConfig;
  /** 是否启用延迟加载 */
  enableLazyLoading: boolean;
  /** 是否启用预热 */
  enableWarmup: boolean;
  /** 内存警告阈值（字节） */
  memoryWarningThreshold: number;
  /** 性能监控间隔（毫秒） */
  monitorIntervalMs: number;
}

/**
 * 内存快照
 */
export interface MemorySnapshot {
  /** 堆内存使用 */
  heapUsed: number;
  /** 堆内存总量 */
  heapTotal: number;
  /** 外部内存 */
  external: number;
  /** RSS（驻留集大小） */
  rss: number;
  /** 数组缓冲区 */
  arrayBuffers: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  /** 报告时间 */
  reportTime: string;
  /** 运行时长（毫秒） */
  uptimeMs: number;
  /** 当前指标 */
  metrics: PerformanceMetrics;
  /** 缓存统计 */
  cacheStats: CacheStats;
  /** 内存快照 */
  memorySnapshot: MemorySnapshot;
  /** 建议 */
  recommendations: string[];
}

/**
 * 检索优化配置
 */
export interface SearchOptimizationConfig {
  /** 是否启用索引缓存 */
  enableIndexCache: boolean;
  /** 批量查询最大数量 */
  batchQueryMaxSize: number;
  /** 预加载热门关键词 */
  preloadKeywords: string[];
  /** 查询结果缓存 TTL（毫秒） */
  resultCacheTtlMs: number;
}

/**
 * 启动优化配置
 */
export interface StartupOptimizationConfig {
  /** 是否启用延迟初始化 */
  enableDeferredInit: boolean;
  /** 关键模块预加载 */
  criticalModules: string[];
  /** 非关键模块延迟加载（毫秒） */
  deferredModuleDelayMs: number;
}

/**
 * 性能事件
 */
export type PerformanceEvent =
  | { type: 'startup_complete'; durationMs: number }
  | { type: 'cache_hit'; key: string }
  | { type: 'cache_miss'; key: string }
  | { type: 'search_query'; query: string; durationMs: number }
  | { type: 'index_rebuild'; durationMs: number }
  | { type: 'memory_warning'; usageBytes: number; thresholdBytes: number }
  | { type: 'task_completed'; taskId: string; durationMs: number };

/**
 * 性能事件监听器
 */
export type PerformanceEventListener = (event: PerformanceEvent) => void;
