/**
 * 超级大龙虾 - 任务模式库
 * Task Pattern Library
 * 
 * 存放于 src/master/patterns.ts
 * 任务模式匹配和经验归档
 */

import * as fs from 'fs';
import * as path from 'path';
// #24 修复：使用异步 I/O
import { promises as fsp } from 'fs';
import type {
  TaskPattern,
  TaskStrategy,
  TaskPerformance,
  AgentResult,
} from '../types/core';
import type { IPatternLibrary } from './types';
// #23 修复：导入公共关键词提取函数
import { extractKeywords as sharedExtractKeywords } from '../shared/keywords';

/**
 * 模式库配置
 */
export interface PatternLibraryConfig {
  /** 模式存储目录 */
  patternsDir: string;
  /** 索引文件路径 */
  indexPath: string;
  /** 最小匹配关键词数 */
  minMatchKeywords: number;
  /** 性能统计滑动窗口大小 */
  performanceWindowSize: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PatternLibraryConfig = {
  patternsDir: './memory/task_patterns',
  indexPath: './memory/task_patterns/index.json',
  minMatchKeywords: 2,
  performanceWindowSize: 10,
};

/**
 * 模式索引
 */
interface PatternIndex {
  version: string;
  last_updated: string;
  patterns: PatternIndexEntry[];
}

interface PatternIndexEntry {
  pattern_id: string;
  task_type: string;
  keywords: string[];
  file_path: string;
}

/**
 * 任务模式库实现
 */
export class PatternLibrary implements IPatternLibrary {
  private config: PatternLibraryConfig;
  private patterns: Map<string, TaskPattern> = new Map();
  private index: PatternIndex;
  private initialized = false;

  constructor(config?: Partial<PatternLibraryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.index = {
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      patterns: [],
    };
    // #24 修复：构造函数中启动异步加载
    this.load().then(() => {
      this.initialized = true;
    }).catch(console.error);
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.load();
      this.initialized = true;
    }
  }

  /**
   * 匹配任务模式
   * #19 修复：移除查询操作的写入副作用
   */
  async matchPattern(keywords: string[]): Promise<TaskPattern | null> {
    await this.ensureInitialized();
    
    if (keywords.length === 0) {
      return null;
    }

    const lowerKeywords = keywords.map(k => k.toLowerCase());
    let bestMatch: TaskPattern | null = null;
    let bestScore = 0;

    for (const pattern of this.patterns.values()) {
      const score = this.calculateMatchScore(lowerKeywords, pattern.match_keywords);
      
      if (score >= this.config.minMatchKeywords && score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    // #19 修复：不再在此处修改 used_count
    // used_count 更新移到 recordPatternUsage 方法
    return bestMatch;
  }

  /**
   * #19 新增：记录模式使用情况
   * 在任务实际执行后调用
   * #24 修复：使用异步 I/O
   */
  async recordPatternUsage(patternId: string): Promise<void> {
    await this.ensureInitialized();
    
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.used_count++;
      await this.savePattern(pattern);
    }
  }

  /**
   * 归档新模式
   * #24 修复：使用异步 I/O
   */
  async archivePattern(
    taskDescription: string,
    agentResult: AgentResult,
    agentId: string,
    tokensUsed: number
  ): Promise<TaskPattern> {
    await this.ensureInitialized();
    
    // 从任务描述提取关键词
    const keywords = this.extractKeywords(taskDescription);
    
    // 生成模式ID
    const patternId = `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // 创建新模式
    const pattern: TaskPattern = {
      pattern_id: patternId,
      task_type: this.classifyTask(taskDescription),
      match_keywords: keywords,
      input_pattern: taskDescription.substring(0, 100),
      strategy: {
        steps: this.extractSteps(taskDescription),
        tool_chain: this.extractToolChain(taskDescription),
      },
      assigned_agent: agentId,
      performance: {
        avg_tokens: tokensUsed,
        avg_duration_sec: 0,
        success_rate: agentResult.status === 'success' ? 1 : 0,
      },
      pitfalls: agentResult.status === 'failure' 
        ? [agentResult.error_detail || agentResult.result]
        : [],
      created_at: new Date().toISOString(),
      used_count: 1,
    };

    // 保存模式
    this.patterns.set(patternId, pattern);
    await this.savePattern(pattern);
    await this.updateIndex(pattern);

    console.log(`[PatternLibrary] 创建新模式: ${patternId} (${pattern.task_type})`);
    return pattern;
  }

  /**
   * 更新模式性能统计
   * #24 修复：使用异步 I/O
   */
  async updatePerformance(
    patternId: string,
    tokensUsed: number,
    durationSec: number,
    succeeded: boolean
  ): Promise<void> {
    await this.ensureInitialized();
    
    const pattern = this.patterns.get(patternId);
    if (!pattern) {
      console.warn(`[PatternLibrary] 模式不存在: ${patternId}`);
      return;
    }

    const perf = pattern.performance;
    const window = this.config.performanceWindowSize;

    // 滑动平均计算
    perf.avg_tokens = (perf.avg_tokens * (window - 1) + tokensUsed) / window;
    perf.avg_duration_sec = (perf.avg_duration_sec * (window - 1) + durationSec) / window;
    
    // 更新成功率
    const currentSuccessRate = succeeded ? 1 : 0;
    perf.success_rate = (perf.success_rate * (window - 1) + currentSuccessRate) / window;

    await this.savePattern(pattern);
  }

  /**
   * 导出所有模式
   */
  async exportAll(): Promise<TaskPattern[]> {
    await this.ensureInitialized();
    return Array.from(this.patterns.values());
  }

  /**
   * 导入模式
   * #24 修复：使用异步 I/O
   */
  async importPatterns(patterns: TaskPattern[]): Promise<number> {
    await this.ensureInitialized();
    
    let imported = 0;
    
    for (const pattern of patterns) {
      if (!this.patterns.has(pattern.pattern_id)) {
        this.patterns.set(pattern.pattern_id, pattern);
        await this.savePattern(pattern);
        await this.updateIndex(pattern);
        imported++;
      }
    }

    console.log(`[PatternLibrary] 导入 ${imported} 个新模式`);
    return imported;
  }

  // ===== 私有方法 =====

  /**
   * 加载模式库
   * #24 修复：使用异步 I/O
   */
  private async load(): Promise<void> {
    // 确保目录存在
    try {
      await fsp.mkdir(this.config.patternsDir, { recursive: true });
    } catch {
      // 目录已存在，忽略
    }

    // 加载索引
    try {
      await fsp.access(this.config.indexPath);
      const content = await fsp.readFile(this.config.indexPath, 'utf-8');
      this.index = JSON.parse(content);
      
      // 加载所有模式文件
      for (const entry of this.index.patterns) {
        const filePath = entry.file_path;
        try {
          await fsp.access(filePath);
          const patternContent = await fsp.readFile(filePath, 'utf-8');
          const pattern = JSON.parse(patternContent) as TaskPattern;
          this.patterns.set(pattern.pattern_id, pattern);
        } catch (e) {
          console.error(`[PatternLibrary] 加载模式文件失败: ${filePath}`, e);
        }
      }
      
      console.log(`[PatternLibrary] 加载 ${this.patterns.size} 个模式`);
    } catch (e) {
      // 索引文件不存在，创建新的空索引
      this.index = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        patterns: [],
      };
    }
  }

  /**
   * 保存模式
   * #24 修复：使用异步 I/O
   */
  private async savePattern(pattern: TaskPattern): Promise<void> {
    const filePath = path.join(this.config.patternsDir, `${pattern.pattern_id}.json`);
    
    try {
      const content = JSON.stringify(pattern, null, 2);
      await fsp.writeFile(filePath, content, 'utf-8');
    } catch (e) {
      console.error(`[PatternLibrary] 保存模式失败: ${pattern.pattern_id}`, e);
    }
  }

  /**
   * 更新索引
   * #24 修复：使用异步 I/O
   */
  private async updateIndex(pattern: TaskPattern): Promise<void> {
    // 检查是否已存在
    const existingIndex = this.index.patterns.findIndex(
      p => p.pattern_id === pattern.pattern_id
    );
    
    const entry: PatternIndexEntry = {
      pattern_id: pattern.pattern_id,
      task_type: pattern.task_type,
      keywords: pattern.match_keywords,
      file_path: path.join(this.config.patternsDir, `${pattern.pattern_id}.json`),
    };

    if (existingIndex >= 0) {
      this.index.patterns[existingIndex] = entry;
    } else {
      this.index.patterns.push(entry);
    }

    this.index.last_updated = new Date().toISOString();
    
    // 保存索引
    try {
      const content = JSON.stringify(this.index, null, 2);
      await fsp.writeFile(this.config.indexPath, content, 'utf-8');
    } catch (e) {
      console.error('[PatternLibrary] 保存索引失败', e);
    }
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(
    inputKeywords: string[],
    patternKeywords: string[]
  ): number {
    let matchCount = 0;
    
    for (const ik of inputKeywords) {
      for (const pk of patternKeywords) {
        if (ik === pk || ik.includes(pk) || pk.includes(ik)) {
          matchCount++;
          break;
        }
      }
    }
    
    return matchCount;
  }

  /**
   * 提取关键词
   * #23 修复：使用公共函数
   */
  private extractKeywords(text: string): string[] {
    return sharedExtractKeywords(text, 10);
  }

  /**
   * 分类任务类型
   */
  private classifyTask(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    // 简单的任务分类
    if (/代码|code|编程|debug|重构|实现/.test(lowerDesc)) {
      return '代码开发';
    }
    if (/分析|研究|调研|搜索/.test(lowerDesc)) {
      return '研究分析';
    }
    if (/写作|文档|文章|报告/.test(lowerDesc)) {
      return '文档撰写';
    }
    if (/测试|test|验证/.test(lowerDesc)) {
      return '测试验证';
    }
    if (/部署|deploy|发布|打包/.test(lowerDesc)) {
      return '部署运维';
    }
    
    return '通用任务';
  }

  /**
   * 提取执行步骤
   */
  private extractSteps(description: string): string[] {
    // 简化的步骤提取
    const steps: string[] = [];
    const lines = description.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // 匹配数字序号
      if (/^\d+[.、)）]\s*.+/.test(trimmed)) {
        steps.push(trimmed);
      }
      // 匹配"首先"、"然后"、"最后"等
      if (/^(首先|然后|接着|最后|接下来)/.test(trimmed)) {
        steps.push(trimmed);
      }
    }
    
    return steps.slice(0, 5);
  }

  /**
   * 提取工具链
   */
  private extractToolChain(description: string): string[] {
    const tools: string[] = [];
    
    // 常见工具模式
    const toolPatterns = [
      { pattern: /git\s+(\w+)/gi, prefix: 'git' },
      { pattern: /npm\s+(\w+)/gi, prefix: 'npm' },
      { pattern: /pnpm\s+(\w+)/gi, prefix: 'pnpm' },
      { pattern: /docker\s+(\w+)/gi, prefix: 'docker' },
      { pattern: /\b(curl|wget|grep|sed|awk)\b/gi, prefix: '' },
    ];
    
    for (const { pattern, prefix } of toolPatterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        const tool = prefix ? `${prefix} ${match[1]}` : match[1];
        if (!tools.includes(tool)) {
          tools.push(tool.toLowerCase());
        }
      }
    }
    
    return tools.slice(0, 5);
  }
}

/**
 * 创建模式库实例
 */
export function createPatternLibrary(config?: Partial<PatternLibraryConfig>): IPatternLibrary {
  return new PatternLibrary(config);
}

export default PatternLibrary;
