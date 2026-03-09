/**
 * 超级大龙虾 - 内存监控器
 * Memory Monitor
 * 
 * 存放于 src/performance/memory-monitor.ts
 * 实时监控内存使用，支持警告和自动清理
 */

import type { MemorySnapshot, PerformanceEventListener } from './types';
import { LRUCache } from './cache';

/**
 * 内存监控配置
 */
export interface MemoryMonitorConfig {
  /** 警告阈值（字节），默认 512MB */
  warningThreshold: number;
  /** 严重阈值（字节），默认 1GB */
  criticalThreshold: number;
  /** 监控间隔（毫秒），默认 10 秒 */
  monitorIntervalMs: number;
  /** 是否启用自动 GC 建议 */
  enableAutoGCSuggest: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: MemoryMonitorConfig = {
  warningThreshold: 512 * 1024 * 1024, // 512MB
  criticalThreshold: 1024 * 1024 * 1024, // 1GB
  monitorIntervalMs: 10000, // 10 秒
  enableAutoGCSuggest: true,
};

/**
 * 内存状态
 */
export type MemoryStatus = 'normal' | 'warning' | 'critical';

/**
 * 内存监控器
 */
export class MemoryMonitor {
  private config: MemoryMonitorConfig;
  private snapshots: MemorySnapshot[] = [];
  private maxSnapshots = 100;
  private monitorInterval?: ReturnType<typeof setInterval>;
  private listeners: PerformanceEventListener[] = [];
  private currentStatus: MemoryStatus = 'normal';
  private caches: LRUCache[] = [];

  constructor(config?: Partial<MemoryMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动监控
   */
  start(): void {
    if (this.monitorInterval) { return; }

    this.monitorInterval = setInterval(() => {
      this.check();
    }, this.config.monitorIntervalMs);

    // 立即执行一次检查
    this.check();
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
  }

  /**
   * 获取当前内存快照
   */
  getSnapshot(): MemorySnapshot {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      arrayBuffers: mem.arrayBuffers,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取历史快照
   */
  getHistory(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * 获取当前状态
   */
  getStatus(): MemoryStatus {
    return this.currentStatus;
  }

  /**
   * 注册缓存（用于自动清理）
   */
  registerCache(cache: LRUCache): void {
    this.caches.push(cache);
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

  /**
   * 手动触发内存检查
   */
  check(): MemoryStatus {
    const snapshot = this.getSnapshot();

    // 保存快照
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // 判断状态
    const prevStatus = this.currentStatus;

    if (snapshot.heapUsed >= this.config.criticalThreshold) {
      this.currentStatus = 'critical';
      this.handleCritical(snapshot);
    } else if (snapshot.heapUsed >= this.config.warningThreshold) {
      this.currentStatus = 'warning';
      this.handleWarning(snapshot);
    } else {
      this.currentStatus = 'normal';
    }

    // 状态变化时通知
    if (prevStatus !== this.currentStatus) {
      this.notifyStatusChange(prevStatus, this.currentStatus, snapshot);
    }

    return this.currentStatus;
  }

  /**
   * 获取内存使用报告
   */
  getReport(): {
    current: MemorySnapshot;
    status: MemoryStatus;
    trend: 'increasing' | 'stable' | 'decreasing';
    recommendation: string;
  } {
    const current = this.getSnapshot();
    const trend = this.calculateTrend();
    const recommendation = this.generateRecommendation(current, trend);

    return {
      current,
      status: this.currentStatus,
      trend,
      recommendation,
    };
  }

  /**
   * 建议执行垃圾回收
   */
  suggestGC(): void {
    if (this.config.enableAutoGCSuggest && global.gc) {
      global.gc();
      console.log('[MemoryMonitor] 已执行垃圾回收');
    }
  }

  /**
   * 清理缓存
   */
  clearCaches(): number {
    let cleared = 0;
    for (const cache of this.caches) {
      const size = cache.size();
      cache.clear();
      cleared += size;
    }
    return cleared;
  }

  // ===== 私有方法 =====

  /**
   * 处理警告状态
   */
  private handleWarning(snapshot: MemorySnapshot): void {
    console.warn(`[MemoryMonitor] 内存警告: 使用 ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    // 通知监听器
    for (const listener of this.listeners) {
      listener({
        type: 'memory_warning',
        usageBytes: snapshot.heapUsed,
        thresholdBytes: this.config.warningThreshold,
      });
    }
  }

  /**
   * 处理严重状态
   */
  private handleCritical(snapshot: MemorySnapshot): void {
    console.error(`[MemoryMonitor] 内存严重: 使用 ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)} MB`);

    // 自动清理缓存
    const cleared = this.clearCaches();
    console.log(`[MemoryMonitor] 自动清理了 ${cleared} 个缓存条目`);

    // 建议 GC
    this.suggestGC();
  }

  /**
   * 计算内存趋势
   */
  private calculateTrend(): 'increasing' | 'stable' | 'decreasing' {
    if (this.snapshots.length < 5) { return 'stable'; }

    const recent = this.snapshots.slice(-5);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;

    const diff = last - first;
    const threshold = 10 * 1024 * 1024; // 10MB

    if (diff > threshold) { return 'increasing'; }
    if (diff < -threshold) { return 'decreasing'; }
    return 'stable';
  }

  /**
   * 生成建议
   */
  private generateRecommendation(
    snapshot: MemorySnapshot,
    trend: 'increasing' | 'stable' | 'decreasing'
  ): string {
    const heapMB = (snapshot.heapUsed / 1024 / 1024).toFixed(2);

    if (this.currentStatus === 'critical') {
      return `内存使用严重过高 (${heapMB} MB)，建议立即重启服务或清理缓存`;
    }

    if (this.currentStatus === 'warning') {
      if (trend === 'increasing') {
        return `内存使用警告 (${heapMB} MB) 且持续增长，建议检查是否有内存泄漏`;
      }
      return `内存使用警告 (${heapMB} MB)，建议清理缓存或优化内存使用`;
    }

    if (trend === 'increasing') {
      return `内存使用正常但持续增长 (${heapMB} MB)，建议关注内存趋势`;
    }

    return `内存使用正常 (${heapMB} MB)`;
  }

  /**
   * 通知状态变化
   */
  private notifyStatusChange(
    prevStatus: MemoryStatus,
    newStatus: MemoryStatus,
    snapshot: MemorySnapshot
  ): void {
    console.log(`[MemoryMonitor] 状态变化: ${prevStatus} -> ${newStatus} (${(snapshot.heapUsed / 1024 / 1024).toFixed(2)} MB)`);
  }
}

/**
 * 创建内存监控器实例
 */
export function createMemoryMonitor(config?: Partial<MemoryMonitorConfig>): MemoryMonitor {
  return new MemoryMonitor(config);
}

export default MemoryMonitor;
