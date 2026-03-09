/**
 * 超级大龙虾 - 性能监控器
 * Performance Monitor
 * 
 * 存放于 src/performance/monitor.ts
 * 综合性能监控、报告生成、优化建议
 */

import type {
  PerformanceMetrics,
  PerformanceReport,
  PerformanceConfig,
  PerformanceEventListener,
} from './types';
import { LRUCache } from './cache';
import { MemoryMonitor } from './memory-monitor';

/**
 * 默认性能配置
 */
const DEFAULT_CONFIG: PerformanceConfig = {
  enableCache: true,
  cache: {
    maxEntries: 1000,
    ttlMs: 60000,
    enableLRU: true,
  },
  enableLazyLoading: true,
  enableWarmup: true,
  memoryWarningThreshold: 512 * 1024 * 1024,
  monitorIntervalMs: 10000,
};

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private config: PerformanceConfig;
  private startTime: number;
  private cache: LRUCache;
  private memoryMonitor: MemoryMonitor;
  private listeners: PerformanceEventListener[] = [];

  // 性能指标收集
  private searchLatencies: number[] = [];
  private taskDurations: number[] = [];
  private indexBuildTime = 0;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();

    // 初始化缓存
    this.cache = new LRUCache(this.config.cache);

    // 初始化内存监控
    this.memoryMonitor = new MemoryMonitor({
      warningThreshold: this.config.memoryWarningThreshold,
      monitorIntervalMs: this.config.monitorIntervalMs,
    });
    this.memoryMonitor.registerCache(this.cache);
    this.memoryMonitor.addListener(event => {
      if (event.type === 'memory_warning') {
        this.emit(event);
      }
    });
  }

  /**
   * 启动监控
   */
  start(): void {
    this.memoryMonitor.start();
    console.log('[PerformanceMonitor] 性能监控已启动');
  }

  /**
   * 停止监控
   */
  stop(): void {
    this.memoryMonitor.stop();
    this.cache.destroy();
    console.log('[PerformanceMonitor] 性能监控已停止');
  }

  /**
   * 记录启动完成
   */
  recordStartupComplete(): void {
    const durationMs = Date.now() - this.startTime;
    this.emit({ type: 'startup_complete', durationMs });
    console.log(`[PerformanceMonitor] 启动完成，耗时 ${durationMs} ms`);
  }

  /**
   * 记录检索查询
   */
  recordSearchQuery(query: string, durationMs: number): void {
    this.searchLatencies.push(durationMs);

    // 保留最近 100 条
    if (this.searchLatencies.length > 100) {
      this.searchLatencies.shift();
    }

    this.emit({ type: 'search_query', query, durationMs });
  }

  /**
   * 记录索引重建
   */
  recordIndexRebuild(durationMs: number): void {
    this.indexBuildTime = durationMs;
    this.emit({ type: 'index_rebuild', durationMs });
  }

  /**
   * 记录任务完成
   */
  recordTaskCompleted(taskId: string, durationMs: number): void {
    this.taskDurations.push(durationMs);

    // 保留最近 100 条
    if (this.taskDurations.length > 100) {
      this.taskDurations.shift();
    }

    this.emit({ type: 'task_completed', taskId, durationMs });
  }

  /**
   * 获取缓存
   */
  getCache(): LRUCache {
    return this.cache;
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    const memoryReport = this.memoryMonitor.getReport();
    const cacheStats = this.cache.getStats();

    // 计算平均检索延迟
    const avgSearchLatencyMs = this.searchLatencies.length > 0
      ? this.searchLatencies.reduce((a, b) => a + b, 0) / this.searchLatencies.length
      : 0;

    // 计算任务吞吐量（任务/分钟）
    const uptimeMinutes = (Date.now() - this.startTime) / 60000;
    const taskThroughput = uptimeMinutes > 0 ? this.taskDurations.length / uptimeMinutes : 0;

    return {
      startupTimeMs: Date.now() - this.startTime,
      memoryUsageBytes: memoryReport.current.heapUsed,
      avgSearchLatencyMs,
      indexBuildTimeMs: this.indexBuildTime,
      taskThroughput,
      cacheHitRate: cacheStats.hitRate,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const metrics = this.getMetrics();
    const cacheStats = this.cache.getStats();
    const memoryReport = this.memoryMonitor.getReport();

    return {
      reportTime: new Date().toISOString(),
      uptimeMs: Date.now() - this.startTime,
      metrics,
      cacheStats,
      memorySnapshot: memoryReport.current,
      recommendations: this.generateRecommendations(metrics, cacheStats, memoryReport),
    };
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: PerformanceEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeListener(listener: PerformanceEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  // ===== 私有方法 =====

  /**
   * 发送事件
   */
  private emit(event: PerformanceEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[PerformanceMonitor] 监听器执行错误:', error);
      }
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(
    metrics: PerformanceMetrics,
    cacheStats: { hitRate: number; totalEntries: number },
    memoryReport: { status: string; trend: string }
  ): string[] {
    const recommendations: string[] = [];

    // 缓存命中率建议
    if (cacheStats.hitRate < 0.5) {
      recommendations.push('缓存命中率较低，建议增加缓存大小或调整 TTL');
    }

    // 检索延迟建议
    if (metrics.avgSearchLatencyMs > 100) {
      recommendations.push('检索延迟较高，建议优化索引或启用索引缓存');
    }

    // 内存建议
    if (memoryReport.status === 'warning') {
      recommendations.push('内存使用接近阈值，建议清理缓存或检查内存泄漏');
    }

    // 启动时间建议
    if (metrics.startupTimeMs > 10000) {
      recommendations.push('启动时间较长，建议启用延迟加载');
    }

    // 吞吐量建议
    if (metrics.taskThroughput < 1 && this.taskDurations.length > 10) {
      recommendations.push('任务处理吞吐量较低，建议优化任务处理逻辑');
    }

    if (recommendations.length === 0) {
      recommendations.push('系统性能良好，无需优化');
    }

    return recommendations;
  }
}

/**
 * 创建性能监控器实例
 */
export function createPerformanceMonitor(config?: Partial<PerformanceConfig>): PerformanceMonitor {
  return new PerformanceMonitor(config);
}

// 单例实例
let instance: PerformanceMonitor | null = null;

/**
 * 获取全局性能监控器实例
 */
export function getPerformanceMonitor(config?: Partial<PerformanceConfig>): PerformanceMonitor {
  if (!instance) {
    instance = createPerformanceMonitor(config);
  }
  return instance;
}

export default PerformanceMonitor;
