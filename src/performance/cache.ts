/**
 * 超级大龙虾 - LRU 缓存实现
 * LRU Cache Implementation
 * 
 * 存放于 src/performance/cache.ts
 * 高性能缓存，支持 TTL 和 LRU 淘汰
 */

import type { CacheConfig, CacheEntry, CacheStats } from './types';

/**
 * 默认缓存配置
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  ttlMs: 60000, // 1 分钟
  enableLRU: true,
};

/**
 * LRU 缓存实现
 */
export class LRUCache<T = unknown> {
  private config: CacheConfig;
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats: CacheStats;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      avgAccessCount: 0,
      estimatedSizeBytes: 0,
    };

    // 启动清理定时器
    this.startCleanupTimer();
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return undefined;
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateStats();
      return undefined;
    }

    // 更新访问时间
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    // LRU：移动到末尾（Map 保持插入顺序）
    if (this.config.enableLRU) {
      this.cache.delete(key);
      this.cache.set(key, entry);
    }

    this.stats.hits++;
    this.updateStats();

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T): void {
    // 检查是否需要淘汰
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
    };

    // 如果已存在，先删除（更新位置）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, entry);
    this.updateStats();
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) { return false; }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.updateStats();
      return false;
    }

    return true;
  }

  /**
   * 删除缓存值
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      this.updateStats();
    }
    return result;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.updateStats();
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  /**
   * 批量获取
   */
  getMany(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * 批量设置
   */
  setMany(entries: Array<[string, T]>): void {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  // ===== 私有方法 =====

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    if (this.config.ttlMs <= 0) { return false; }
    return Date.now() - entry.createdAt > this.config.ttlMs;
  }

  /**
   * 淘汰最老的条目
   */
  private evictOldest(): void {
    // Map 的迭代顺序是插入顺序，第一个就是最老的
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;

    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // 估算内存占用
    let totalAccessCount = 0;
    let estimatedSize = 0;

    for (const [key, entry] of this.cache) {
      totalAccessCount += entry.accessCount;
      estimatedSize += key.length * 2; // UTF-16
      estimatedSize += JSON.stringify(entry.value).length;
    }

    this.stats.avgAccessCount = this.cache.size > 0 ? totalAccessCount / this.cache.size : 0;
    this.stats.estimatedSizeBytes = estimatedSize;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    // 每 30 秒清理一次过期条目
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 30000);
  }

  /**
   * 清理过期条目
   */
  private cleanupExpired(): void {
    if (this.config.ttlMs <= 0) { return; }

    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      this.updateStats();
    }
  }
}

/**
 * 创建 LRU 缓存实例
 */
export function createLRUCache<T>(config?: Partial<CacheConfig>): LRUCache<T> {
  return new LRUCache<T>(config);
}

export default LRUCache;
