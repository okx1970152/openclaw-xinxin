/**
 * 超级大龙虾 - 提练引擎
 * Refinement Engine
 * 
 * 存放于 src/memory-kw/refine.ts
 * 从临时记忆提练永久记忆
 */

import type {
  PermMemEntry,
  TempMemEntry,
  RefinementResult,
  ValidationReport,
  PermMemCategory,
  RelationTag,
  ConfirmationStrategy,
} from '../types/core';
import type { IRefinementEngine } from './types';
import { FourStepValidator } from './validate';

/**
 * 提练配置
 * #14 修复：LLM 配置改为可配置
 */
export interface RefinementConfig {
  /** 是否需要人工确认阈值：Token 消耗 */
  tokenConfirmThreshold: number;
  /** 摘要最大长度 */
  maxSummaryLength: number;
  /** 关键词数量范围 */
  keywordCountRange: [number, number];
  /** 是否自动验证 */
  autoValidate: boolean;
  /** 是否使用 LLM 增强提炼 */
  useLLMExtraction: boolean;
  /** LLM API 端点（可选） */
  llmApiEndpoint?: string;
  // #14 新增：可配置的 LLM 参数
  /** LLM 模型名称，默认 'claude-haiku-4-5-20251001' */
  llmModel?: string;
  /** LLM max_tokens，默认 1024 */
  llmMaxTokens?: number;
  /** LLM API 版本，默认 '2023-06-01' */
  llmApiVersion?: string;
}

/**
 * 默认配置
 * #14 修复：添加 LLM 可配置默认值
 */
const DEFAULT_CONFIG: RefinementConfig = {
  tokenConfirmThreshold: 5000,
  maxSummaryLength: 200,
  keywordCountRange: [3, 5],
  autoValidate: true,
  useLLMExtraction: true,
  // #14 新增默认值
  llmModel: 'claude-haiku-4-5-20251001',
  llmMaxTokens: 1024,
  llmApiVersion: '2023-06-01',
};

/**
 * 提练引擎实现
 */
export class RefinementEngine implements IRefinementEngine {
  private config: RefinementConfig;
  private validator: FourStepValidator;

  constructor(config?: Partial<RefinementConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validator = new FourStepValidator();
  }

  /**
   * 提练临时记忆
   */
  async refine(
    rawContent: TempMemEntry[],
    agentId: string,
    agentDomain: string
  ): Promise<RefinementResult> {
    // 1. 分析临时记忆内容
    const analysis = this.analyzeContent(rawContent);
    
    // 2. 提练永久记忆条目（支持 LLM 增强）
    const entries = await this.extractEntries(rawContent, agentId, agentDomain, analysis);
    
    // 3. 使用独立验证器验证提练结果
    let validation: ValidationReport;
    if (this.config.autoValidate) {
      const rawContentStr = rawContent.map(e => e.content).join('\n');
      const registryPath = './memory/registry.json';
      // 对每个条目进行验证
      const validationResults = await this.validator.validateBatch(entries, rawContentStr, registryPath);
      // 汇总验证结果
      validation = this.aggregateValidationResults(validationResults);
    } else {
      validation = { passed: true, severity: 'ok', checks: [], auto_fixes: [] };
    }
    
    // 4. 判断确认策略（返回 ConfirmationStrategy 而非 boolean）
    const confirmationStrategy = this.getConfirmationStrategy(
      analysis.totalTokens,
      analysis.hasMatchedPattern,
      analysis.taskSucceeded
    );

    // 5. 创建快照路径（伪路径，实际由调用方处理）
    const archivedPath = `memory/archive/temp_mem_${Date.now()}.json`;

    return {
      entries,
      validation,
      requires_confirmation: confirmationStrategy !== 'auto',
      archived_path: archivedPath,
    };
  }

  /**
   * 汇总验证结果
   */
  private aggregateValidationResults(
    results: Map<string, ValidationReport>
  ): ValidationReport {
    const allChecks: ValidationReport['checks'] = [];
    const allAutoFixes: string[] = [];
    let overallSeverity: ValidationReport['severity'] = 'ok';
    let allPassed = true;

    for (const [, report] of results) {
      allChecks.push(...report.checks);
      allAutoFixes.push(...report.auto_fixes);
      if (report.severity === 'major') {
        overallSeverity = 'major';
        allPassed = false;
      } else if (report.severity === 'minor' && overallSeverity === 'ok') {
        overallSeverity = 'minor';
      }
    }

    return {
      passed: allPassed,
      severity: overallSeverity,
      checks: allChecks,
      auto_fixes: allAutoFixes,
    };
  }

  /**
   * 分析临时记忆内容
   */
  private analyzeContent(content: TempMemEntry[]): ContentAnalysis {
    let totalTokens = 0;
    let userMessages = 0;
    let assistantMessages = 0;
    let hasMatchedPattern = false;
    let taskSucceeded = true; // 默认成功

    for (const entry of content) {
      // 简单估算 Token 数（中文约 1.5 字/token，英文约 4 字符/token）
      const charCount = entry.content.length;
      const estimatedTokens = Math.ceil(charCount / 2);
      totalTokens += estimatedTokens;

      if (entry.role === 'user') {
        userMessages++;
      } else if (entry.role === 'assistant') {
        assistantMessages++;
      }

      // 检测是否有模式匹配标记
      if (entry.content.includes('[PATTERN_MATCHED]')) {
        hasMatchedPattern = true;
      }

      // 检测任务是否失败
      if (entry.content.includes('[TASK_FAILED]') || 
          entry.content.includes('错误') ||
          entry.content.includes('失败')) {
        taskSucceeded = false;
      }
    }

    return {
      totalTokens,
      userMessages,
      assistantMessages,
      hasMatchedPattern,
      taskSucceeded,
      totalEntries: content.length,
    };
  }

  /**
   * 提练永久记忆条目
   */
  private async extractEntries(
    content: TempMemEntry[],
    agentId: string,
    agentDomain: string,
    analysis: ContentAnalysis
  ): Promise<PermMemEntry[]> {
    const entries: PermMemEntry[] = [];

    // 如果启用 LLM 增强，使用 LLM 提取
    if (this.config.useLLMExtraction) {
      const llmExtracted = await this.extractWithLLM(content, agentId, agentDomain, analysis);
      if (llmExtracted.length > 0) {
        return llmExtracted;
      }
    }

    // 回退到正则提取
    // 提取用户意图
    const userIntents = this.extractUserIntents(content);
    
    // 提取关键决策
    const keyDecisions = this.extractKeyDecisions(content);
    
    // 提取技术要点
    const techPoints = this.extractTechPoints(content);
    
    // 提取文件引用
    const fileRefs = this.extractFileRefs(content);

    // 生成关键词
    const keywords = this.generateKeywords(content, userIntents, techPoints);

    // 根据任务结果选择分类
    const category: PermMemCategory = analysis.taskSucceeded 
      ? '成功流程' 
      : '失败结论';

    // 生成摘要
    const summary = this.generateSummary(content, analysis);

    // 创建关系标签
    const relations: RelationTag = {
      project: this.extractProjectName(content),
      agent: agentId,
      tech_stack: techPoints.slice(0, 5),
      related_patterns: [],
    };

    // 创建永久记忆条目
    const entry: PermMemEntry = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      keywords,
      summary,
      relations,
      file_refs: fileRefs,
      pitfalls: analysis.taskSucceeded ? [] : this.extractPitfalls(content),
      created_at: new Date().toISOString(),
    };

    entries.push(entry);

    // 如果有子代理能力相关的信息，创建额外条目
    if (techPoints.length > 0) {
      entries.push({
        id: `pm_cap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category: '子代理能力',
        keywords: [agentDomain, ...techPoints.slice(0, 3)],
        summary: `${agentId} 在 ${agentDomain} 领域展示了 ${techPoints.slice(0, 3).join(', ')} 能力`,
        relations: {
          project: this.extractProjectName(content),
          agent: agentId,
          tech_stack: techPoints.slice(0, 5),
          related_patterns: [],
        },
        file_refs: fileRefs,
        pitfalls: [],
        created_at: new Date().toISOString(),
      });
    }

    return entries;
  }

  /**
   * 使用 LLM 增强提取
   * 实施方案 3.3 节的七步提练流程
   */
  private async extractWithLLM(
    content: TempMemEntry[],
    agentId: string,
    agentDomain: string,
    analysis: ContentAnalysis
  ): Promise<PermMemEntry[]> {
    // 构建结构化提练模板
    const prompt = this.buildRefinementPrompt(content, agentId, agentDomain);
    
    try {
      // 调用 LLM API
      const response = await this.callLLM(prompt);
      
      // 解析 LLM 响应
      return this.parseLLMResponse(response, agentId, agentDomain, analysis);
    } catch (error) {
      console.warn('[RefinementEngine] LLM 提取失败，回退到正则提取:', error);
      return []; // 返回空数组，触发回退逻辑
    }
  }

  /**
   * 构建提练提示词
   */
  private buildRefinementPrompt(
    content: TempMemEntry[],
    agentId: string,
    agentDomain: string
  ): string {
    const contentText = content.map(e => `[${e.role}]: ${e.content}`).join('\n\n');
    
    return `请从以下对话记录中提取永久记忆条目。

## 输入信息
- 代理ID: ${agentId}
- 领域: ${agentDomain}
- 对话记录:
${contentText}

## 输出要求
请以 JSON 格式输出一个记忆条目，包含以下字段：
{
  "keywords": ["关键词1", "关键词2", "关键词3"],  // 3-5个核心关键词
  "summary": "摘要内容，不超过200字",
  "category": "成功流程|失败结论|子代理能力",  // 根据任务结果选择
  "tech_stack": ["技术1", "技术2"],  // 涉及的技术栈
  "file_refs": ["文件路径1"],  // 实际提及的文件路径
  "pitfalls": ["避坑点1"]  // 如有失败，提取教训
}

只输出 JSON，不要有其他内容。`;
  }

  /**
   * 调用 LLM API
   * #14 修复：使用配置中的 LLM 参数
   */
  private async callLLM(prompt: string): Promise<string> {
    const endpoint = this.config.llmApiEndpoint || process.env.LLM_API_ENDPOINT || 'https://api.anthropic.com/v1/messages';
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('未配置 ANTHROPIC_API_KEY');
    }

    // #14 修复：使用配置值替代硬编码
    const model = this.config.llmModel || 'claude-haiku-4-5-20251001';
    const maxTokens = this.config.llmMaxTokens || 1024;
    const apiVersion = this.config.llmApiVersion || '2023-06-01';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': apiVersion,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API 调用失败: ${response.status}`);
    }

    const data = await response.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text || '';
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(
    response: string,
    agentId: string,
    agentDomain: string,
    analysis: ContentAnalysis
  ): PermMemEntry[] {
    const entries: PermMemEntry[] = [];
    
    try {
      // 提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]) as {
        keywords?: string[];
        summary?: string;
        category?: string;
        tech_stack?: string[];
        file_refs?: string[];
        pitfalls?: string[];
      };
      
      // 创建条目
      const entry: PermMemEntry = {
        id: `pm_llm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        category: (['成功流程', '失败结论', '子代理能力'].includes(parsed.category || '') 
          ? parsed.category 
          : (analysis.taskSucceeded ? '成功流程' : '失败结论')) as PermMemCategory,
        keywords: parsed.keywords?.slice(0, 5) || [],
        summary: (parsed.summary || '').substring(0, this.config.maxSummaryLength),
        relations: {
          project: 'default_project',
          agent: agentId,
          tech_stack: parsed.tech_stack?.slice(0, 5) || [],
          related_patterns: [],
        },
        file_refs: parsed.file_refs?.slice(0, 10) || [],
        pitfalls: parsed.pitfalls?.slice(0, 5) || [],
        created_at: new Date().toISOString(),
      };
      
      entries.push(entry);
    } catch (e) {
      console.warn('[RefinementEngine] 解析 LLM 响应失败:', e);
    }
    
    return entries;
  }

  /**
   * 验证提练结果
   */
  private validateEntries(
    entries: PermMemEntry[],
    rawContent: TempMemEntry[]
  ): ValidationReport {
    const checks: ValidationReport['checks'] = [];
    const autoFixes: string[] = [];
    let severity: 'ok' | 'minor' | 'major' = 'ok';

    // 检查1: 文件路径真实性（简化版）
    const filePathCheck = this.checkFilePaths(entries);
    checks.push(filePathCheck);
    if (!filePathCheck.passed && filePathCheck.removed_items && filePathCheck.removed_items.length > 0) {
      severity = 'minor';
      autoFixes.push(`移除了不存在的文件路径: ${filePathCheck.removed_items.join(', ')}`);
    }

    // 检查2: 关键词回溯
    const keywordCheck = this.checkKeywords(entries, rawContent);
    checks.push(keywordCheck);
    if (!keywordCheck.passed) {
      severity = 'minor';
    }

    // 检查3: 关系一致性
    const relationCheck = this.checkRelations(entries);
    checks.push(relationCheck);
    if (!relationCheck.passed) {
      severity = 'major';
    }

    // 检查4: 格式合规
    const formatCheck = this.checkFormat(entries);
    checks.push(formatCheck);
    if (!formatCheck.passed) {
      if (severity === 'ok') severity = 'minor';
    }

    return {
      passed: severity !== 'major',
      severity,
      checks,
      auto_fixes: autoFixes,
    };
  }

  /**
   * 判断确认策略
   * 技术设计文档 3.2 节定义了 ConfirmationStrategy = 'auto' | 'confirm' | 'force_confirm'
   */
  private getConfirmationStrategy(
    tokensUsed: number,
    hasMatchedPattern: boolean,
    taskSucceeded: boolean
  ): ConfirmationStrategy {
    // 失败任务强制确认
    if (!taskSucceeded) {
      return 'force_confirm';
    }

    // 高消耗新任务需确认
    if (tokensUsed > this.config.tokenConfirmThreshold && !hasMatchedPattern) {
      return 'confirm';
    }

    // 其他情况自动处理
    return 'auto';
  }

  /**
   * 判断是否需要确认（兼容旧接口）
   * @deprecated 请使用 getConfirmationStrategy
   */
  private needsConfirmation(
    tokensUsed: number,
    hasMatchedPattern: boolean,
    taskSucceeded: boolean
  ): boolean {
    return this.getConfirmationStrategy(tokensUsed, hasMatchedPattern, taskSucceeded) !== 'auto';
  }

  // ===== 提取辅助方法 =====

  private extractUserIntents(content: TempMemEntry[]): string[] {
    const intents: string[] = [];
    for (const entry of content) {
      if (entry.role === 'user') {
        // 简单提取意图关键词
        const lines = entry.content.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          intents.push(lines[0].substring(0, 50));
        }
      }
    }
    return intents.slice(0, 3);
  }

  private extractKeyDecisions(content: TempMemEntry[]): string[] {
    const decisions: string[] = [];
    const decisionPatterns = [
      /决定/g,
      /选择/g,
      /使用/g,
      /采用/g,
      /实现/g,
    ];

    for (const entry of content) {
      if (entry.role === 'assistant') {
        for (const pattern of decisionPatterns) {
          if (pattern.test(entry.content)) {
            const matches = entry.content.match(new RegExp(`.{0,20}${pattern.source}.{0,20}`, 'g'));
            if (matches) {
              decisions.push(...matches.slice(0, 2));
            }
          }
        }
      }
    }

    return decisions.slice(0, 5);
  }

  private extractTechPoints(content: TempMemEntry[]): string[] {
    const points = new Set<string>();
    const techPatterns = [
      /\b(TypeScript|JavaScript|Python|Go|Rust|Java)\b/gi,
      /\b(React|Vue|Angular|Next\.js|Node\.js)\b/gi,
      /\b(Docker|Kubernetes|AWS|GCP|Azure)\b/gi,
      /\b(PostgreSQL|MySQL|MongoDB|Redis)\b/gi,
      /\b(Git|GitHub|GitLab)\b/gi,
    ];

    for (const entry of content) {
      for (const pattern of techPatterns) {
        const matches = entry.content.match(pattern);
        if (matches) {
          matches.forEach(m => points.add(m));
        }
      }
    }

    return Array.from(points).slice(0, 10);
  }

  private extractFileRefs(content: TempMemEntry[]): string[] {
    const files = new Set<string>();
    const filePattern = /(?:^|\s|[("'`])(\.?\.?\/[\w\-./]+\.[\w]+)|(?:^|\s|[("'`])(\/[\w\-./]+\.[\w]+)/g;

    for (const entry of content) {
      let match;
      while ((match = filePattern.exec(entry.content)) !== null) {
        const filePath = match[1] || match[2];
        if (filePath && !filePath.includes('node_modules')) {
          files.add(filePath);
        }
      }
    }

    return Array.from(files).slice(0, 10);
  }

  private generateKeywords(
    content: TempMemEntry[],
    intents: string[],
    techPoints: string[]
  ): string[] {
    const keywords: string[] = [];
    
    // 从意图提取
    for (const intent of intents) {
      const words = intent.split(/[\s,，。.]+/).filter(w => w.length >= 2);
      keywords.push(...words.slice(0, 2));
    }

    // 添加技术点
    keywords.push(...techPoints.slice(0, 3));

    // 去重并限制数量
    const uniqueKeywords = [...new Set(keywords)];
    const [min, max] = this.config.keywordCountRange;
    
    if (uniqueKeywords.length < min) {
      // 补充通用关键词
      uniqueKeywords.push('任务', '执行');
    }

    return uniqueKeywords.slice(0, max);
  }

  private extractProjectName(content: TempMemEntry[]): string {
    for (const entry of content) {
      // 尝试从路径中提取项目名
      const pathMatch = entry.content.match(/\/([\w\-]+)(?:\/|$)/);
      if (pathMatch) {
        return pathMatch[1];
      }
    }
    return 'default_project';
  }

  private generateSummary(content: TempMemEntry[], analysis: ContentAnalysis): string {
    const parts: string[] = [];

    if (analysis.taskSucceeded) {
      parts.push('成功完成');
    } else {
      parts.push('任务执行遇到问题');
    }

    parts.push(`共处理 ${analysis.totalEntries} 条消息`);
    parts.push(`用户消息 ${analysis.userMessages} 条，助手消息 ${analysis.assistantMessages} 条`);

    const summary = parts.join('，');
    
    // 限制长度
    if (summary.length > this.config.maxSummaryLength) {
      return summary.substring(0, this.config.maxSummaryLength - 3) + '...';
    }

    return summary;
  }

  private extractPitfalls(content: TempMemEntry[]): string[] {
    const pitfalls: string[] = [];
    const pitfallPatterns = [
      /错误[：:]\s*(.+)/g,
      /失败[：:]\s*(.+)/g,
      /注意[：:]\s*(.+)/g,
      /避免[：:]\s*(.+)/g,
    ];

    for (const entry of content) {
      for (const pattern of pitfallPatterns) {
        let match;
        while ((match = pattern.exec(entry.content)) !== null) {
          if (match[1] && match[1].trim()) {
            pitfalls.push(match[1].trim().substring(0, 50));
          }
        }
      }
    }

    return pitfalls.slice(0, 5);
  }

  // ===== 验证辅助方法 =====

  private checkFilePaths(entries: PermMemEntry[]): ValidationReport['checks'][0] {
    const removedItems: string[] = [];
    
    for (const entry of entries) {
      const validFiles = entry.file_refs.filter(file => {
        // 简化检查：只检查格式是否合法
        const isValid = /^\.?\.?\/[\w\-./]+$/.test(file) || /^\/[\w\-./]+$/.test(file);
        if (!isValid) {
          removedItems.push(file);
        }
        return isValid;
      });
      entry.file_refs = validFiles;
    }

    return {
      name: 'file_path_exists',
      passed: removedItems.length === 0,
      detail: removedItems.length > 0 
        ? `发现 ${removedItems.length} 个无效文件路径` 
        : '所有文件路径格式正确',
      removed_items: removedItems,
    };
  }

  private checkKeywords(entries: PermMemEntry[], rawContent: TempMemEntry[]): ValidationReport['checks'][0] {
    const rawText = rawContent.map(e => e.content).join(' ').toLowerCase();
    const removedItems: string[] = [];

    for (const entry of entries) {
      const validKeywords = entry.keywords.filter(kw => {
        const found = rawText.includes(kw.toLowerCase());
        if (!found) {
          removedItems.push(kw);
        }
        return found;
      });
      entry.keywords = validKeywords;
    }

    return {
      name: 'keyword_in_source',
      passed: removedItems.length === 0,
      detail: removedItems.length > 0 
        ? `移除了 ${removedItems.length} 个未在原文中出现的关键词` 
        : '所有关键词都在原文中找到',
      removed_items: removedItems,
    };
  }

  private checkRelations(entries: PermMemEntry[]): ValidationReport['checks'][0] {
    // 简化检查：验证关系字段是否完整
    const issues: string[] = [];

    for (const entry of entries) {
      if (!entry.relations.agent) {
        issues.push('缺少代理信息');
      }
      if (!entry.relations.project) {
        issues.push('缺少项目信息');
      }
    }

    return {
      name: 'relations_consistent',
      passed: issues.length === 0,
      detail: issues.length > 0 ? issues.join('; ') : '关系信息完整',
    };
  }

  private checkFormat(entries: PermMemEntry[]): ValidationReport['checks'][0] {
    const issues: string[] = [];

    for (const entry of entries) {
      if (entry.summary.length > this.config.maxSummaryLength) {
        issues.push(`摘要超长 (${entry.summary.length} > ${this.config.maxSummaryLength})`);
        entry.summary = entry.summary.substring(0, this.config.maxSummaryLength - 3) + '...';
      }

      const [min, max] = this.config.keywordCountRange;
      if (entry.keywords.length < min) {
        issues.push(`关键词数量不足 (${entry.keywords.length} < ${min})`);
      }
    }

    return {
      name: 'format_compliant',
      passed: issues.length === 0,
      detail: issues.length > 0 ? issues.join('; ') : '格式符合规范',
    };
  }
}

/**
 * 内容分析结果
 */
interface ContentAnalysis {
  totalTokens: number;
  userMessages: number;
  assistantMessages: number;
  hasMatchedPattern: boolean;
  taskSucceeded: boolean;
  totalEntries: number;
}

/**
 * 创建提练引擎实例
 */
export function createRefinementEngine(config?: Partial<RefinementConfig>): IRefinementEngine {
  return new RefinementEngine(config);
}

export default RefinementEngine;
