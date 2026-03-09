/**
 * 超级大龙虾 - 引擎选择器
 * Memory Engine Selector
 * 
 * 存放于 src/memory-kw/engine-selector.ts
 * 智能选择记忆引擎
 */

import type { MemoryEngine } from '../config/types.memory';

/**
 * 引擎描述
 */
const ENGINE_DESCRIPTIONS: Record<MemoryEngine, string> = {
  embedding: 'Embedding 语义检索（原版）',
  keyword: '关键词检索（超级大龙虾）',
};

/**
 * 引擎能力矩阵
 */
const ENGINE_CAPABILITIES: Record<MemoryEngine, {
  supportsSemantic: boolean;
  supportsKeyword: boolean;
  supportsFts: boolean;
  requiresEmbedding: boolean;
  requiresVectorDb: boolean;
}> = {
  embedding: {
    supportsSemantic: true,
    supportsKeyword: false,
    supportsFts: false,
    requiresEmbedding: true,
    requiresVectorDb: true,
  },
  keyword: {
    supportsSemantic: false,
    supportsKeyword: true,
    supportsFts: true,
    requiresEmbedding: false,
    requiresVectorDb: false,
  },
};

/**
 * 检查是否使用关键词引擎
 */
export function isKeywordEngine(engine?: MemoryEngine): boolean {
  return engine === 'keyword';
}

/**
 * 检查是否使用 Embedding 引擎
 */
export function isEmbeddingEngine(engine?: MemoryEngine): boolean {
  return engine === 'embedding' || engine === undefined;
}

/**
 * 获取引擎描述
 */
export function getEngineDescription(engine: MemoryEngine): string {
  return ENGINE_DESCRIPTIONS[engine];
}

/**
 * 获取引擎能力
 */
export function getEngineCapabilities(engine: MemoryEngine) {
  return ENGINE_CAPABILITIES[engine];
}

/**
 * 根据环境推荐引擎
 */
export function recommendEngine(params?: {
  hasEmbeddingModel?: boolean;
  hasVectorDb?: boolean;
  preferSpeed?: boolean;
  preferAccuracy?: boolean;
}): MemoryEngine {
  // 如果没有 Embedding 模型或向量数据库，推荐关键词引擎
  if (!params?.hasEmbeddingModel || !params?.hasVectorDb) {
    return 'keyword';
  }

  // 如果偏好速度，推荐关键词引擎
  if (params?.preferSpeed) {
    return 'keyword';
  }

  // 如果偏好准确性和语义理解，推荐 Embedding 引擎
  if (params?.preferAccuracy) {
    return 'embedding';
  }

  // 默认使用 Embedding 引擎（保持向后兼容）
  return 'embedding';
}

/**
 * 引擎选择器类
 */
export class MemoryEngineSelector {
  private engine: MemoryEngine;

  constructor(engine: MemoryEngine = 'embedding') {
    this.engine = engine;
  }

  /**
   * 是否使用关键词引擎
   */
  isKeyword(): boolean {
    return isKeywordEngine(this.engine);
  }

  /**
   * 是否使用 Embedding 引擎
   */
  isEmbedding(): boolean {
    return isEmbeddingEngine(this.engine);
  }

  /**
   * 获取引擎类型
   */
  getEngine(): MemoryEngine {
    return this.engine;
  }

  /**
   * 获取引擎描述
   */
  getDescription(): string {
    return getEngineDescription(this.engine);
  }

  /**
   * 获取引擎能力
   */
  getCapabilities() {
    return getEngineCapabilities(this.engine);
  }

  /**
   * 获取记忆模块路径
   */
  getModulePath(): string {
    return this.isKeyword() ? 'memory-kw' : 'memory';
  }

  /**
   * 检查是否需要 Embedding 服务
   */
  requiresEmbeddingService(): boolean {
    return this.getCapabilities().requiresEmbedding;
  }
}

/**
 * 创建引擎选择器
 */
export function createEngineSelector(engine?: MemoryEngine): MemoryEngineSelector {
  return new MemoryEngineSelector(engine);
}

export default MemoryEngineSelector;
