/**
 * 上下文钉住 + 剪裁策略模块
 *
 * 设计要点：
 * 1. 智能识别关键信息并钉住（pinned）
 * 2. Token 预算管理
 * 3. 多种剪裁策略（滑动窗口、摘要压缩、重要性排序）
 * 4. 保持上下文连贯性
 */

import type { TempMemEntry } from '../memory-kw/types';

// 剪裁策略类型
export type PruningStrategy = 'sliding_window' | 'summarize' | 'importance' | 'hybrid';

// 上下文条目（扩展临时记忆条目）
export interface ContextEntry extends TempMemEntry {
  importance: number; // 重要性评分 0-1
  token_count: number; // Token 数量估算
  can_prune: boolean; // 是否可以剪裁
  prune_reason?: string; // 剪裁原因
}

// 上下文管理器配置
export interface ContextManagerConfig {
  maxTokens: number; // 最大 Token 数量
  reserveTokens: number; // 保留给回复的 Token 数量
  pruningStrategy: PruningStrategy; // 剪裁策略
  pinnedRatio: number; // 钉住条目的最大比例
  windowSize?: number; // 滑动窗口大小（条目数）
  summarizeThreshold?: number; // 触发摘要压缩的阈值
}

// 剪裁结果
export interface PruningResult {
  entries: ContextEntry[];
  pruned_count: number;
  pruned_tokens: number;
  strategy_used: PruningStrategy;
  summary?: string; // 如果使用摘要策略
}

// 钉住规则
export interface PinRule {
  condition: (entry: ContextEntry) => boolean;
  reason: string;
  priority: number; // 优先级，越高越重要
}

/**
 * 默认钉住规则
 */
const DEFAULT_PIN_RULES: PinRule[] = [
  {
    condition: (entry) => entry.pinned === true,
    reason: '用户显式钉住',
    priority: 100,
  },
  {
    condition: (entry) =>
      entry.content.includes('重要') ||
      entry.content.includes('关键') ||
      entry.content.toLowerCase().includes('important'),
    reason: '包含重要性标记',
    priority: 80,
  },
  {
    condition: (entry) => entry.role === 'system',
    reason: '系统消息',
    priority: 90,
  },
  {
    condition: (entry) => {
      // 包含文件路径或代码块
      return (
        entry.content.includes('```') ||
        /[/\w]+\.[\w]+/.test(entry.content) // 文件路径模式
      );
    },
    reason: '包含代码或文件路径',
    priority: 60,
  },
  {
    condition: (entry) => {
      // 包含决策或结论
      return (
        entry.content.includes('决定') ||
        entry.content.includes('结论') ||
        entry.content.includes('结果') ||
        entry.content.toLowerCase().includes('decision')
      );
    },
    reason: '包含决策信息',
    priority: 70,
  },
];

/**
 * 上下文管理器
 */
export class ContextManager {
  private config: Required<ContextManagerConfig>;
  private pinRules: PinRule[];
  private entries: ContextEntry[] = [];

  constructor(config: Partial<ContextManagerConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens || 32000,
      reserveTokens: config.reserveTokens || 8000,
      pruningStrategy: config.pruningStrategy || 'hybrid',
      pinnedRatio: config.pinnedRatio || 0.2,
      windowSize: config.windowSize || 50,
      summarizeThreshold: config.summarizeThreshold || 0.8,
    };

    this.pinRules = [...DEFAULT_PIN_RULES];
  }

  /**
   * 添加自定义钉住规则
   */
  addPinRule(rule: PinRule): void {
    this.pinRules.push(rule);
    // 按优先级排序
    this.pinRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 添加条目
   */
  addEntry(entry: TempMemEntry): ContextEntry {
    const contextEntry: ContextEntry = {
      ...entry,
      importance: this.calculateImportance(entry),
      token_count: this.estimateTokens(entry.content),
      can_prune: true,
    };

    // 应用钉住规则
    this.applyPinRules(contextEntry);

    this.entries.push(contextEntry);

    // 检查是否需要剪裁
    if (this.getTotalTokens() > this.config.maxTokens - this.config.reserveTokens) {
      this.prune();
    }

    return contextEntry;
  }

  /**
   * 批量添加条目
   */
  addEntries(entries: TempMemEntry[]): ContextEntry[] {
    return entries.map((entry) => this.addEntry(entry));
  }

  /**
   * 获取所有条目
   */
  getEntries(): ContextEntry[] {
    return [...this.entries];
  }

  /**
   * 获取钉住的条目
   */
  getPinnedEntries(): ContextEntry[] {
    return this.entries.filter((entry) => entry.pinned);
  }

  /**
   * 获取总 Token 数量
   */
  getTotalTokens(): number {
    return this.entries.reduce((sum, entry) => sum + entry.token_count, 0);
  }

  /**
   * 获取可用 Token 数量
   */
  getAvailableTokens(): number {
    return Math.max(0, this.config.maxTokens - this.config.reserveTokens - this.getTotalTokens());
  }

  /**
   * 计算条目重要性
   */
  private calculateImportance(entry: TempMemEntry): number {
    let importance = 0.5; // 基础重要性

    // 角色权重
    if (entry.role === 'system') {
      importance += 0.3;
    } else if (entry.role === 'assistant') {
      importance += 0.1;
    }

    // 内容特征
    const content = entry.content.toLowerCase();

    // 包含问题的消息更重要
    if (content.includes('?') || content.includes('？')) {
      importance += 0.1;
    }

    // 包含代码的消息更重要
    if (content.includes('```')) {
      importance += 0.15;
    }

    // 较长的消息可能包含更多信息
    if (entry.content.length > 500) {
      importance += 0.05;
    }

    // 最近的条目稍微重要一些（通过位置计算）
    const index = this.entries.length;
    if (index > 0) {
      const recencyBonus = Math.min(0.1, index / 100);
      importance += recencyBonus;
    }

    return Math.min(1, importance);
  }

  /**
   * 估算 Token 数量
   */
  private estimateTokens(content: string): number {
    // 简单估算：中文约 1.5 字符/token，英文约 4 字符/token
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = content.length - chineseChars;

    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 应用钉住规则
   */
  private applyPinRules(entry: ContextEntry): void {
    for (const rule of this.pinRules) {
      if (rule.condition(entry)) {
        entry.pinned = true;
        entry.pin_reason = rule.reason;
        entry.can_prune = false;
        break; // 只应用第一个匹配的规则
      }
    }
  }

  /**
   * 执行剪裁
   */
  prune(): PruningResult {
    const targetTokens = this.config.maxTokens - this.config.reserveTokens;
    const currentTokens = this.getTotalTokens();

    if (currentTokens <= targetTokens) {
      return {
        entries: this.entries,
        pruned_count: 0,
        pruned_tokens: 0,
        strategy_used: this.config.pruningStrategy,
      };
    }

    let result: PruningResult;

    switch (this.config.pruningStrategy) {
      case 'sliding_window':
        result = this.pruneBySlidingWindow(targetTokens);
        break;
      case 'summarize':
        result = this.pruneBySummarize(targetTokens);
        break;
      case 'importance':
        result = this.pruneByImportance(targetTokens);
        break;
      case 'hybrid':
      default:
        result = this.pruneByHybrid(targetTokens);
    }

    // 更新条目列表
    this.entries = result.entries;

    return result;
  }

  /**
   * 滑动窗口剪裁
   */
  private pruneBySlidingWindow(targetTokens: number): PruningResult {
    const pinnedEntries = this.entries.filter((e) => e.pinned);
    const unpinnedEntries = this.entries.filter((e) => !e.pinned);

    // 保留钉住的条目和最近的 N 条
    const windowSize = this.config.windowSize || 50;
    const keepEntries = unpinnedEntries.slice(-windowSize);

    const newEntries = [...pinnedEntries, ...keepEntries];
    const newTokens = newEntries.reduce((sum, e) => sum + e.token_count, 0);

    // 如果仍然超限，进一步缩减
    if (newTokens > targetTokens) {
      const canRemove = keepEntries.filter((e) => e.can_prune);
      let removed = 0;

      while (newTokens - removed > targetTokens && canRemove.length > 0) {
        const removedEntry = canRemove.shift()!;
        removed += removedEntry.token_count;
        const idx = newEntries.indexOf(removedEntry);
        if (idx >= 0) {
          newEntries.splice(idx, 1);
        }
      }
    }

    return {
      entries: newEntries,
      pruned_count: this.entries.length - newEntries.length,
      pruned_tokens: this.getTotalTokens() - newEntries.reduce((sum, e) => sum + e.token_count, 0),
      strategy_used: 'sliding_window',
    };
  }

  /**
   * 摘要压缩剪裁
   */
  private pruneBySummarize(_targetTokens: number): PruningResult {
    const pinnedEntries = this.entries.filter((e) => e.pinned);
    const unpinnedEntries = this.entries.filter((e) => !e.pinned);

    // 将早期的消息压缩为摘要
    const midPoint = Math.floor(unpinnedEntries.length / 2);
    const toSummarize = unpinnedEntries.slice(0, midPoint);
    const toKeep = unpinnedEntries.slice(midPoint);

    // 创建摘要条目
    const summaryContent = this.createSummary(toSummarize);
    const summaryEntry: ContextEntry = {
      id: `summary_${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'system',
      content: summaryContent,
      pinned: false,
      importance: 0.7,
      token_count: this.estimateTokens(summaryContent),
      can_prune: true,
    };

    const newEntries = [...pinnedEntries, summaryEntry, ...toKeep];
    const newTokens = newEntries.reduce((sum, e) => sum + e.token_count, 0);

    return {
      entries: newEntries,
      pruned_count: toSummarize.length,
      pruned_tokens: this.getTotalTokens() - newTokens,
      strategy_used: 'summarize',
      summary: summaryContent,
    };
  }

  /**
   * 重要性排序剪裁
   */
  private pruneByImportance(targetTokens: number): PruningResult {
    const pinnedEntries = this.entries.filter((e) => e.pinned);
    const unpinnedEntries = this.entries.filter((e) => !e.pinned);

    // 按重要性排序
    const sorted = [...unpinnedEntries].sort((a, b) => b.importance - a.importance);

    let currentTokens = pinnedEntries.reduce((sum, e) => sum + e.token_count, 0);
    const keepEntries: ContextEntry[] = [];

    for (const entry of sorted) {
      if (currentTokens + entry.token_count <= targetTokens) {
        keepEntries.push(entry);
        currentTokens += entry.token_count;
      }
    }

    // 按原始顺序重新排序
    const newEntries = [...pinnedEntries, ...keepEntries].sort(
      (a, b) => this.entries.indexOf(a) - this.entries.indexOf(b)
    );

    return {
      entries: newEntries,
      pruned_count: this.entries.length - newEntries.length,
      pruned_tokens: this.getTotalTokens() - currentTokens,
      strategy_used: 'importance',
    };
  }

  /**
   * 混合策略剪裁
   */
  private pruneByHybrid(targetTokens: number): PruningResult {
    const pinnedEntries = this.entries.filter((e) => e.pinned);
    const unpinnedEntries = this.entries.filter((e) => !e.pinned);

    const pinnedTokens = pinnedEntries.reduce((sum, e) => sum + e.token_count, 0);
    const availableForUnpinned = targetTokens - pinnedTokens;

    // 对未钉住的条目使用重要性排序
    const sorted = [...unpinnedEntries].sort((a, b) => b.importance - a.importance);

    let currentTokens = 0;
    const keepEntries: ContextEntry[] = [];

    for (const entry of sorted) {
      if (currentTokens + entry.token_count <= availableForUnpinned) {
        keepEntries.push(entry);
        currentTokens += entry.token_count;
      } else if (entry.importance >= 0.7) {
        // 高重要性的条目即使超限也保留
        keepEntries.push(entry);
        currentTokens += entry.token_count;
      }
    }

    // 按原始顺序重新排序
    const newEntries = [...pinnedEntries, ...keepEntries].sort(
      (a, b) => this.entries.indexOf(a) - this.entries.indexOf(b)
    );

    // 如果仍有大量内容被剪裁，创建摘要
    const prunedCount = this.entries.length - newEntries.length;
    let summary: string | undefined;

    if (prunedCount > 10) {
      const prunedEntries = unpinnedEntries.filter((e) => !keepEntries.includes(e));
      summary = this.createSummary(prunedEntries);
    }

    return {
      entries: newEntries,
      pruned_count: prunedCount,
      pruned_tokens: this.getTotalTokens() - newEntries.reduce((sum, e) => sum + e.token_count, 0),
      strategy_used: 'hybrid',
      summary,
    };
  }

  /**
   * 创建摘要
   */
  private createSummary(entries: ContextEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const parts: string[] = ['[上下文摘要]'];

    // 按角色分组
    const userMessages = entries.filter((e) => e.role === 'user');
    const assistantMessages = entries.filter((e) => e.role === 'assistant');

    // 用户消息摘要
    if (userMessages.length > 0) {
      parts.push(`用户提问: ${userMessages.length} 条`);
      const topics = this.extractTopics(userMessages);
      if (topics.length > 0) {
        parts.push(`主要话题: ${topics.slice(0, 3).join(', ')}`);
      }
    }

    // 助手消息摘要
    if (assistantMessages.length > 0) {
      parts.push(`助手回复: ${assistantMessages.length} 条`);
      const actions = this.extractActions(assistantMessages);
      if (actions.length > 0) {
        parts.push(`主要操作: ${actions.slice(0, 3).join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 提取话题
   */
  private extractTopics(entries: ContextEntry[]): string[] {
    const content = entries.map((e) => e.content).join(' ');

    // 简单的关键词提取
    const words = content.match(/[\u4e00-\u9fa5]{2,4}|[a-zA-Z]{3,}/g) || [];
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    return Array.from(wordCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * 提取操作
   */
  private extractActions(entries: ContextEntry[]): string[] {
    const actions: string[] = [];
    const content = entries.map((e) => e.content).join(' ');

    // 提取操作关键词
    const actionPatterns = [
      /创建/g,
      /修改/g,
      /删除/g,
      /执行/g,
      /分析/g,
      /生成/g,
      /优化/g,
      /修复/g,
    ];

    for (const pattern of actionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        actions.push(matches[0]);
      }
    }

    return [...new Set(actions)];
  }

  /**
   * 手动钉住条目
   */
  pinEntry(entryId: string, reason?: string): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (entry) {
      entry.pinned = true;
      entry.pin_reason = reason || '用户手动钉住';
      entry.can_prune = false;
      return true;
    }
    return false;
  }

  /**
   * 取消钉住
   */
  unpinEntry(entryId: string): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (entry) {
      entry.pinned = false;
      entry.pin_reason = undefined;
      entry.can_prune = true;
      return true;
    }
    return false;
  }

  /**
   * 清空上下文
   */
  clear(): void {
    // 保留钉住的条目
    this.entries = this.entries.filter((e) => e.pinned);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total_entries: number;
    total_tokens: number;
    available_tokens: number;
    pinned_entries: number;
    pinned_tokens: number;
  } {
    const pinnedEntries = this.entries.filter((e) => e.pinned);
    return {
      total_entries: this.entries.length,
      total_tokens: this.getTotalTokens(),
      available_tokens: this.getAvailableTokens(),
      pinned_entries: pinnedEntries.length,
      pinned_tokens: pinnedEntries.reduce((sum, e) => sum + e.token_count, 0),
    };
  }
}

// 导出工厂函数
export function createContextManager(config?: Partial<ContextManagerConfig>): ContextManager {
  return new ContextManager(config);
}
