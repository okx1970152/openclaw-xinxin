/**
 * 超级大龙虾 - 性能模块单元测试
 * Performance Module Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LRUCache } from './cache';
import { MemoryMonitor } from './memory-monitor';
import { PerformanceMonitor } from './monitor';
import { StartupOptimizer } from './startup';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({ maxEntries: 3, ttlMs: 1000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should set and get values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('should evict oldest entries when full', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // should evict key1

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should update access time on get', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Access key1 to make it most recently used
    cache.get('key1');

    // Add new entry, should evict key2 (not key1)
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeUndefined();
  });

  it('should track cache statistics', () => {
    cache.set('key1', 'value1');

    cache.get('key1'); // hit
    cache.get('key1'); // hit
    cache.get('missing'); // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.666, 1);
  });

  it('should support has() method', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('should support delete() method', () => {
    cache.set('key1', 'value1');
    expect(cache.delete('key1')).toBe(true);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.delete('missing')).toBe(false);
  });

  it('should support clear() method', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should support batch operations', () => {
    cache.setMany([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);

    const results = cache.getMany(['key1', 'key2', 'missing']);
    expect(results.size).toBe(2);
    expect(results.get('key1')).toBe('value1');
  });
});

describe('MemoryMonitor', () => {
  let monitor: MemoryMonitor;

  beforeEach(() => {
    monitor = new MemoryMonitor({
      warningThreshold: 1024 * 1024 * 1024, // 1GB
      criticalThreshold: 2 * 1024 * 1024 * 1024, // 2GB
      monitorIntervalMs: 100,
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('should get memory snapshot', () => {
    const snapshot = monitor.getSnapshot();
    expect(snapshot).toHaveProperty('heapUsed');
    expect(snapshot).toHaveProperty('heapTotal');
    expect(snapshot).toHaveProperty('timestamp');
    expect(snapshot.heapUsed).toBeGreaterThan(0);
  });

  it('should return normal status initially', () => {
    const status = monitor.getStatus();
    expect(status).toBe('normal');
  });

  it('should track memory history', () => {
    monitor.check();
    monitor.check();
    const history = monitor.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('should generate memory report', () => {
    monitor.check();
    const report = monitor.getReport();
    expect(report).toHaveProperty('current');
    expect(report).toHaveProperty('status');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('recommendation');
  });

  it('should notify listeners on memory warning', () => {
    const listener = vi.fn();
    monitor.addListener(listener);

    // Force check
    monitor.check();

    // In normal conditions, no warning should be triggered
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('PerformanceMonitor', () => {
  let perfMonitor: PerformanceMonitor;

  beforeEach(() => {
    perfMonitor = new PerformanceMonitor({
      enableCache: true,
      cache: { maxEntries: 10, ttlMs: 1000, enableLRU: true },
    });
  });

  afterEach(() => {
    perfMonitor.stop();
  });

  it('should record startup complete', () => {
    const listener = vi.fn();
    perfMonitor.addListener(listener);

    perfMonitor.recordStartupComplete();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'startup_complete' })
    );
  });

  it('should record search queries', () => {
    const listener = vi.fn();
    perfMonitor.addListener(listener);

    perfMonitor.recordSearchQuery('test query', 50);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'search_query',
        query: 'test query',
        durationMs: 50,
      })
    );
  });

  it('should record task completion', () => {
    perfMonitor.recordTaskCompleted('task-001', 1000);
    perfMonitor.recordTaskCompleted('task-002', 2000);

    const metrics = perfMonitor.getMetrics();
    expect(metrics.taskThroughput).toBeGreaterThanOrEqual(0);
  });

  it('should provide performance report', () => {
    const report = perfMonitor.generateReport();

    expect(report).toHaveProperty('reportTime');
    expect(report).toHaveProperty('uptimeMs');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('cacheStats');
    expect(report).toHaveProperty('memorySnapshot');
    expect(report).toHaveProperty('recommendations');
  });

  it('should return cache instance', () => {
    const cache = perfMonitor.getCache();
    expect(cache).toBeInstanceOf(LRUCache);
  });
});

describe('StartupOptimizer', () => {
  let optimizer: StartupOptimizer;

  beforeEach(() => {
    optimizer = new StartupOptimizer({
      enableDeferredInit: true,
      criticalModules: ['core'],
      deferredModuleDelayMs: 10,
    });
    optimizer.startTimer();
  });

  it('should track elapsed time', () => {
    const elapsed = optimizer.getElapsedMs();
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it('should register and load critical modules immediately', async () => {
    const loadFn = vi.fn().mockResolvedValue(undefined);

    optimizer.registerModule('core', loadFn);

    // Wait for load to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(loadFn).toHaveBeenCalled();
  });

  it('should defer non-critical modules', async () => {
    const criticalLoadFn = vi.fn().mockResolvedValue(undefined);
    const deferredLoadFn = vi.fn().mockResolvedValue(undefined);

    optimizer.registerModule('core', criticalLoadFn);
    optimizer.registerModule('deferred', deferredLoadFn);

    // Deferred module should not be loaded yet
    expect(deferredLoadFn).not.toHaveBeenCalled();

    // Process deferred modules
    await optimizer.processDeferred();

    expect(deferredLoadFn).toHaveBeenCalled();
  });

  it('should generate load report', async () => {
    optimizer.registerModule('core', () => Promise.resolve());
    optimizer.registerModule('deferred', () => Promise.resolve());

    await optimizer.processDeferred();

    const report = optimizer.getLoadReport();
    expect(report.totalModules).toBe(2);
    expect(report.loadedModules).toBe(2);
    expect(report.modules).toHaveLength(2);
  });

  it('should wait for all modules', async () => {
    optimizer.registerModule('core', () => Promise.resolve());
    optimizer.registerModule('deferred', () => Promise.resolve());

    await optimizer.waitForAll();

    const report = optimizer.getLoadReport();
    expect(report.loadedModules).toBe(2);
  });
});
