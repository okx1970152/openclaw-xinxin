/**
 * 超级大龙虾 - 优雅降级模块
 * Graceful Degradation
 * 
 * 存放于 src/error-handling/degradation.ts
 * 系统降级策略和降级状态管理
 */

import type { ErrorCode } from './types';

/**
 * 降级级别
 */
export enum DegradationLevel {
  /** 正常运行 */
  NORMAL = 'normal',
  /** 轻度降级 - 禁用非核心功能 */
  LIGHT = 'light',
  /** 中度降级 - 禁用部分核心功能 */
  MEDIUM = 'medium',
  /** 重度降级 - 仅保留最基本功能 */
  HEAVY = 'heavy',
  /** 紧急模式 - 最小功能集 */
  EMERGENCY = 'emergency',
}

/**
 * 功能模块
 */
export type FeatureModule =
  | 'memory_refine'     // 记忆提练
  | 'memory_search'     // 记忆检索
  | 'pattern_match'     // 模式匹配
  | 'agent_clone'       // 子代理克隆
  | 'agent_parallel'    // 并行执行
  | 'worker_threads'    // Worker 线程
  | 'cache'             // 缓存
  | 'monitor'           // 监控
  | 'logging_detail'    // 详细日志
  | 'i18n_full';        // 完整国际化

/**
 * 降级配置
 */
export interface DegradationConfig {
  /** 当前降级级别 */
  level: DegradationLevel;
  /** 禁用的功能模块 */
  disabledModules: FeatureModule[];
  /** 降级触发原因 */
  reason: string;
  /** 降级时间 */
  since: string;
  /** 预计恢复时间 */
  estimatedRecovery?: string;
}

/**
 * 各降级级别对应的禁用模块
 */
const DEGRADATION_MODULES: Record<DegradationLevel, FeatureModule[]> = {
  [DegradationLevel.NORMAL]: [],
  [DegradationLevel.LIGHT]: ['logging_detail', 'monitor', 'i18n_full'],
  [DegradationLevel.MEDIUM]: ['logging_detail', 'monitor', 'i18n_full', 'worker_threads', 'cache'],
  [DegradationLevel.HEAVY]: ['logging_detail', 'monitor', 'i18n_full', 'worker_threads', 'cache', 'agent_parallel', 'agent_clone'],
  [DegradationLevel.EMERGENCY]: ['logging_detail', 'monitor', 'i18n_full', 'worker_threads', 'cache', 'agent_parallel', 'agent_clone', 'memory_refine', 'memory_search', 'pattern_match'],
};

/**
 * 降级管理器
 */
export class DegradationManager {
  private currentLevel: DegradationLevel = DegradationLevel.NORMAL;
  private config: DegradationConfig = {
    level: DegradationLevel.NORMAL,
    disabledModules: [],
    reason: '',
    since: new Date().toISOString(),
  };
  private listeners: Array<(config: DegradationConfig) => void> = [];

  /**
   * 获取当前降级配置
   */
  getConfig(): DegradationConfig {
    return { ...this.config };
  }

  /**
   * 获取当前降级级别
   */
  getLevel(): DegradationLevel {
    return this.currentLevel;
  }

  /**
   * 检查功能模块是否可用
   */
  isFeatureEnabled(module: FeatureModule): boolean {
    return !this.config.disabledModules.includes(module);
  }

  /**
   * 触发降级
   */
  degrade(level: DegradationLevel, reason: string): void {
    if (level === this.currentLevel) { return; }

    const prevLevel = this.currentLevel;
    this.currentLevel = level;

    this.config = {
      level,
      disabledModules: DEGRADATION_MODULES[level],
      reason,
      since: new Date().toISOString(),
    };

    console.log(`[DegradationManager] 降级: ${prevLevel} -> ${level} (${reason})`);

    // 通知监听器
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        console.error('[DegradationManager] 监听器执行错误:', error);
      }
    }
  }

  /**
   * 恢复到更高级别
   */
  recover(level: DegradationLevel = DegradationLevel.NORMAL): void {
    if (this.currentLevel === DegradationLevel.NORMAL) { return; }

    const levelOrder = [
      DegradationLevel.NORMAL,
      DegradationLevel.LIGHT,
      DegradationLevel.MEDIUM,
      DegradationLevel.HEAVY,
      DegradationLevel.EMERGENCY,
    ];

    const currentIndex = levelOrder.indexOf(this.currentLevel);
    const targetIndex = levelOrder.indexOf(level);

    // 只能恢复到更高级别（索引更小）
    if (targetIndex < currentIndex) {
      this.degrade(level, '系统恢复');
    }
  }

  /**
   * 根据错误代码自动降级
   */
  handleErrorCode(code: ErrorCode): void {
    switch (code) {
      case 'MEMORY_OVERFLOW':
      case 'MEMORY_CORRUPTED':
        this.degrade(DegradationLevel.HEAVY, `内存错误: ${code}`);
        break;

      case 'AGENT_CRASHED':
      case 'AGENT_TIMEOUT':
        this.degrade(DegradationLevel.MEDIUM, `子代理错误: ${code}`);
        break;

      case 'LLM_ERROR':
      case 'LLM_RATE_LIMIT':
        this.degrade(DegradationLevel.LIGHT, `LLM 错误: ${code}`);
        break;

      case 'NETWORK_ERROR':
      case 'WEBSOCKET_ERROR':
        // 网络错误通常不触发降级
        break;

      default:
        break;
    }
  }

  /**
   * 添加降级监听器
   */
  addListener(listener: (config: DegradationConfig) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除降级监听器
   */
  removeListener(listener: (config: DegradationConfig) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 获取降级状态报告
   */
  getReport(): {
    level: DegradationLevel;
    levelName: string;
    disabledFeatures: FeatureModule[];
    enabledFeatures: FeatureModule[];
    reason: string;
    duration: string;
  } {
    const allFeatures: FeatureModule[] = [
      'memory_refine', 'memory_search', 'pattern_match',
      'agent_clone', 'agent_parallel', 'worker_threads',
      'cache', 'monitor', 'logging_detail', 'i18n_full',
    ];

    const disabledFeatures = this.config.disabledModules;
    const enabledFeatures = allFeatures.filter(f => !disabledFeatures.includes(f));

    const since = new Date(this.config.since);
    const duration = this.formatDuration(Date.now() - since.getTime());

    const levelNames: Record<DegradationLevel, string> = {
      [DegradationLevel.NORMAL]: '正常运行',
      [DegradationLevel.LIGHT]: '轻度降级',
      [DegradationLevel.MEDIUM]: '中度降级',
      [DegradationLevel.HEAVY]: '重度降级',
      [DegradationLevel.EMERGENCY]: '紧急模式',
    };

    return {
      level: this.currentLevel,
      levelName: levelNames[this.currentLevel],
      disabledFeatures,
      enabledFeatures,
      reason: this.config.reason || '无',
      duration: this.currentLevel === DegradationLevel.NORMAL ? '-' : duration,
    };
  }

  /**
   * 格式化时长
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) { return `${days} 天 ${hours % 24} 小时`; }
    if (hours > 0) { return `${hours} 小时 ${minutes % 60} 分钟`; }
    if (minutes > 0) { return `${minutes} 分钟 ${seconds % 60} 秒`; }
    return `${seconds} 秒`;
  }
}

// 单例实例
let instance: DegradationManager | null = null;

/**
 * 获取全局降级管理器实例
 */
export function getDegradationManager(): DegradationManager {
  if (!instance) {
    instance = new DegradationManager();
  }
  return instance;
}

/**
 * 创建降级管理器实例
 */
export function createDegradationManager(): DegradationManager {
  return new DegradationManager();
}

export default DegradationManager;
