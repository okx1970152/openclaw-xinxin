/**
 * 超级大龙虾 - 启动优化器
 * Startup Optimizer
 * 
 * 存放于 src/performance/startup.ts
 * 延迟加载、预热缓存、关键路径优化
 */

import type { StartupOptimizationConfig } from './types';

/**
 * 默认启动优化配置
 */
const DEFAULT_CONFIG: StartupOptimizationConfig = {
  enableDeferredInit: true,
  criticalModules: ['memory', 'master'],
  deferredModuleDelayMs: 100,
};

/**
 * 模块加载状态
 */
interface ModuleLoadState {
  name: string;
  loaded: boolean;
  loadTimeMs: number;
  isCritical: boolean;
}

/**
 * 启动优化器
 */
export class StartupOptimizer {
  private config: StartupOptimizationConfig;
  private startTime: number = 0;
  private moduleStates: Map<string, ModuleLoadState> = new Map();
  private deferredQueue: Array<() => Promise<void>> = [];

  constructor(config?: Partial<StartupOptimizationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 开始启动计时
   */
  startTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * 获取启动耗时
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 注册模块加载
   */
  registerModule(name: string, loadFn: () => Promise<void> | void): void {
    const isCritical = this.config.criticalModules.includes(name);

    this.moduleStates.set(name, {
      name,
      loaded: false,
      loadTimeMs: 0,
      isCritical,
    });

    if (isCritical || !this.config.enableDeferredInit) {
      // 关键模块立即加载
      void this.loadModule(name, loadFn);
    } else {
      // 非关键模块延迟加载
      this.deferredQueue.push(async () => {
        await this.loadModule(name, loadFn);
      });
    }
  }

  /**
   * 加载模块
   */
  private async loadModule(
    name: string,
    loadFn: () => Promise<void> | void
  ): Promise<void> {
    const startMs = Date.now();

    try {
      await loadFn();

      const state = this.moduleStates.get(name);
      if (state) {
        state.loaded = true;
        state.loadTimeMs = Date.now() - startMs;
      }

      console.log(`[StartupOptimizer] 模块加载完成: ${name} (${state?.loadTimeMs} ms)`);
    } catch (error) {
      console.error(`[StartupOptimizer] 模块加载失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 执行延迟加载
   */
  async processDeferred(): Promise<void> {
    if (this.deferredQueue.length === 0) { return; }

    // 延迟一小段时间，让主线程先处理关键任务
    await this.delay(this.config.deferredModuleDelayMs);

    console.log(`[StartupOptimizer] 开始加载 ${this.deferredQueue.length} 个延迟模块`);

    for (const loadFn of this.deferredQueue) {
      await loadFn();
    }

    this.deferredQueue = [];
  }

  /**
   * 获取加载报告
   */
  getLoadReport(): {
    totalModules: number;
    loadedModules: number;
    totalLoadTimeMs: number;
    criticalLoadTimeMs: number;
    modules: ModuleLoadState[];
  } {
    const states = Array.from(this.moduleStates.values());
    const loadedModules = states.filter(s => s.loaded);

    return {
      totalModules: states.length,
      loadedModules: loadedModules.length,
      totalLoadTimeMs: states.reduce((sum, s) => sum + s.loadTimeMs, 0),
      criticalLoadTimeMs: states.filter(s => s.isCritical).reduce((sum, s) => sum + s.loadTimeMs, 0),
      modules: states,
    };
  }

  /**
   * 等待所有模块加载完成
   */
  async waitForAll(): Promise<void> {
    // 处理延迟队列
    await this.processDeferred();

    // 等待所有模块加载
    const maxWait = 30000; // 最大等待 30 秒
    const startWait = Date.now();

    while (Date.now() - startWait < maxWait) {
      const allLoaded = Array.from(this.moduleStates.values()).every(s => s.loaded);
      if (allLoaded) { return; }

      await this.delay(10);
    }

    // 超时警告
    const unloaded = Array.from(this.moduleStates.values())
      .filter(s => !s.loaded)
      .map(s => s.name);

    if (unloaded.length > 0) {
      console.warn(`[StartupOptimizer] 模块加载超时: ${unloaded.join(', ')}`);
    }
  }

  // ===== 私有方法 =====

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建启动优化器实例
 */
export function createStartupOptimizer(config?: Partial<StartupOptimizationConfig>): StartupOptimizer {
  return new StartupOptimizer(config);
}

/**
 * 预热缓存
 */
export async function warmupCache(
  preloadFn: () => Promise<void>
): Promise<number> {
  const startMs = Date.now();

  try {
    await preloadFn();
    const durationMs = Date.now() - startMs;
    console.log(`[StartupOptimizer] 缓存预热完成 (${durationMs} ms)`);
    return durationMs;
  } catch (error) {
    console.error('[StartupOptimizer] 缓存预热失败:', error);
    return -1;
  }
}

export default StartupOptimizer;
