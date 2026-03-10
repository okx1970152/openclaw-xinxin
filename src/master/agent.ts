/**
 * 超级大龙虾 - 主代理模块
 * Master Agent Module
 * 
 * 存放于 src/master/agent.ts
 * 核心调度：接收指令 → 派发子代理 → 返回结果
 */

import type {
  UnifiedMessage,
  TaskItem,
  AgentConfig,
  AgentResult,
  ModelChoice,
  PermMemEntry,
  TaskPattern,
} from '../types/core';
import type { IMemoryManager } from '../memory-kw/types';
import type { IPatternLibrary, IModelSelector, ITokenLimiter } from './types';
import { SmartModelSelector, TokenLimiter } from './cost.js';
import { TaskOrchestrator } from './orchestrate.js';
import { ContextManager } from './context.js';
import { AgentRegistryManager } from './registry.js';
// #23 修复：导入公共关键词提取函数
import { extractKeywords as sharedExtractKeywords } from '../shared/keywords';

/**
 * 主代理接口
 */
export interface IMasterAgent {
  // ===== 核心调度 =====
  
  /**
   * 处理统一消息（入口点）
   */
  handleMessage(msg: UnifiedMessage): Promise<string>;
  
  // ===== 任务队列 =====
  
  /**
   * 将任务加入队列
   */
  enqueueTask(task: TaskItem): void;
  
  /**
   * 处理下一个任务
   */
  processNextTask(): Promise<void>;
  
  /**
   * 获取队列状态
   */
  getQueueStatus(): TaskItem[];
  
  // ===== 子代理管理 =====
  
  /**
   * 创建子代理
   */
  createAgent(templateId: string): Promise<AgentConfig>;
  
  /**
   * 克隆子代理
   */
  cloneAgent(sourceAgentId: string): Promise<AgentConfig>;
  
  /**
   * 激活子代理
   */
  activateAgent(agentId: string): Promise<void>;
  
  /**
   * 休眠子代理
   */
  hibernateAgent(agentId: string): Promise<void>;
  
  /**
   * 销毁子代理
   */
  destroyAgent(agentId: string): Promise<void>;
  
  /**
   * 获取子代理注册表
   */
  getAgentRegistry(): Promise<AgentConfig[]>;
  
  // ===== 经验归档 =====
  
  /**
   * 归档任务经验
   */
  archiveExperience(task: TaskItem, result: AgentResult): Promise<void>;
}

/**
 * 主代理配置选项
 */
export interface MasterAgentOptions {
  memory?: IMemoryManager;
  modelSelector?: IModelSelector;
  tokenLimiter?: ITokenLimiter;
  patternLibrary?: IPatternLibrary;
  registryPath?: string;
}

/**
 * 主代理实现
 * 
 * 修复说明：
 * - #1: 使用 cost.ts 的 SmartModelSelector 和 TokenLimiter，删除 Simple 版本
 * - #2: 使用 orchestrate.ts 的 TaskOrchestrator，删除本地 TaskQueue
 * - #3: 集成 ContextManager 管理上下文
 * - #4: 完善 handleMessage 流程（关键词提取 + 模式匹配 + 子代理分配）
 * - #5: 使用 AgentRegistryManager 管理代理注册表
 */
export class MasterAgent implements IMasterAgent {
  // 核心组件（从外部模块导入）
  private orchestrator: TaskOrchestrator;
  private modelSelector: IModelSelector;
  private tokenLimiter: ITokenLimiter;
  private contextManager: ContextManager;
  private registry: AgentRegistryManager;
  
  // 可选组件
  private memory?: IMemoryManager;
  private patternLibrary?: IPatternLibrary;
  
  /** 执行统计信息 */
  private executionStats = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    totalTokensUsed: 0,
    lastArchiveTime: new Date().toISOString(),
  };

  constructor(options?: MasterAgentOptions) {
    // 初始化核心组件（#1 修复：使用增强版）
    this.modelSelector = options?.modelSelector ?? new SmartModelSelector();
    this.tokenLimiter = options?.tokenLimiter ?? new TokenLimiter();
    
    // #2 修复：使用 TaskOrchestrator
    this.orchestrator = new TaskOrchestrator();
    
    // #3 修复：初始化 ContextManager
    this.contextManager = new ContextManager();
    
    // #5 修复：使用 AgentRegistryManager
    const registryPath = options?.registryPath || './memory/registry.json';
    this.registry = new AgentRegistryManager(registryPath);
    
    // 可选组件
    this.memory = options?.memory;
    this.patternLibrary = options?.patternLibrary;
    
    // 注册任务处理器
    this.orchestrator.setTaskHandler({
      execute: async (task: TaskItem) => {
        return this.processTask(task);
      }
    });
    
    // 设置完成回调
    this.orchestrator.setOnComplete(async (task: TaskItem, result: AgentResult) => {
      await this.archiveExperience(task, result);
    });
  }

  /**
   * 初始化（异步）
   */
  async initialize(): Promise<void> {
    await this.registry.initialize();
    console.log('[MasterAgent] 初始化完成');
  }

  // ===== 核心调度 =====

  /**
   * 处理统一消息
   * 
   * #4 修复：完善流程
   * 1. 提取关键词
   * 2. 匹配任务模式
   * 3. 选择模型
   * 4. 选择/分配子代理
   * 5. 创建任务并入队
   */
  async handleMessage(msg: UnifiedMessage): Promise<string> {
    // 1. 提取关键词
    const keywords = this.extractKeywords(msg.content);
    
    // 2. 匹配任务模式
    let matchedPattern: TaskPattern | null = null;
    if (this.patternLibrary) {
      matchedPattern = await this.patternLibrary.matchPattern(keywords);
    }
    
    // 3. 选择模型
    const model = this.modelSelector.selectModel(
      msg.content,
      !!matchedPattern,
      0
    );
    
    // 4. 选择/分配子代理
    const agentId = matchedPattern?.assigned_agent 
      || await this.findBestAgent(keywords)
      || 'default_agent';
    
    // #3 修复：添加任务上下文
    this.contextManager.addEntry({
      id: `ctx_${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'user',
      content: msg.content,
      pinned: false,
    });
    
    // 5. 创建任务并入队
    const task: TaskItem = {
      task_id: this.generateTaskId(),
      content: msg.content,
      source_message: msg,
      priority: 'normal',
      assigned_agent: agentId,
      matched_pattern: matchedPattern?.pattern_id,
      created_at: new Date().toISOString(),
      status: 'queued',
    };
    
    this.enqueueTask(task);
    
    return `任务已创建 [${task.task_id.slice(0, 8)}]，分配给 ${agentId}`;
  }

  /**
   * 查找最佳代理
   */
  private async findBestAgent(keywords: string[]): Promise<string | null> {
    try {
      const agents = await this.registry.getAgentsByKeywords(keywords);
      if (agents.length > 0) {
        // 返回最匹配的代理
        return agents[0].agent_id;
      }
    } catch (error) {
      console.warn('[MasterAgent] 查找代理失败:', error);
    }
    return null;
  }

  // ===== 任务队列 =====

  /**
   * 将任务加入队列
   * #2 修复：使用 TaskOrchestrator
   */
  enqueueTask(task: TaskItem): void {
    this.orchestrator.enqueue(task);
    console.log(`[MasterAgent] 任务入队: ${task.task_id}, 优先级: ${task.priority}`);
  }

  /**
   * 处理下一个任务
   * #2 修复：由 TaskOrchestrator 驱动，此方法保留兼容性
   */
  async processNextTask(): Promise<void> {
    // TaskOrchestrator 自动处理队列
    // 此方法保留以保持接口兼容
    const status = this.orchestrator.getQueueStatus();
    console.log(`[MasterAgent] 队列状态: ${status.queueLength} 个任务, 处理中: ${status.isProcessing}`);
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): TaskItem[] {
    const status = this.orchestrator.getQueueStatus();
    // 返回简化的队列信息
    return status.currentTaskId ? [{ 
      task_id: status.currentTaskId, 
      content: '', 
      source_message: {} as UnifiedMessage,
      priority: 'normal', 
      created_at: '', 
      status: 'running' 
    }] : [];
  }

  // ===== 子代理管理 =====

  /**
   * 创建子代理
   * #5 修复：使用 AgentRegistryManager
   */
  async createAgent(templateId: string): Promise<AgentConfig> {
    const agentId = `${templateId}_${Date.now()}`;
    const config: AgentConfig = {
      agent_id: agentId,
      domain: '通用任务',
      keywords: [],
      permissions: ['file_rw'],
      work_dir: `./agents/${agentId}`,
      status: 'idle',
      llm_provider: 'anthropic',
      llm_model: 'claude-sonnet-4-20250514',
      max_tokens_per_turn: 4096,
      capability_profile: {
        skills_proven: [],
        success_count: 0,
        fail_count: 0,
        avg_tokens_per_task: 0,
        last_active: new Date().toISOString(),
      },
      custom_fields: {},
      created_at: new Date().toISOString(),
      template_id: templateId,
    };

    await this.registry.registerAgent(config);
    console.log(`[MasterAgent] 创建子代理: ${agentId}`);
    return config;
  }

  /**
   * 克隆子代理
   * #5 修复：使用 AgentRegistryManager
   */
  async cloneAgent(sourceAgentId: string): Promise<AgentConfig> {
    const sourceEntry = await this.registry.getAgent(sourceAgentId);
    if (!sourceEntry) {
      throw new Error(`找不到源代理: ${sourceAgentId}`);
    }

    const source = sourceEntry.config;
    const newAgentId = `${sourceAgentId}_clone_${Date.now()}`;
    const cloned: AgentConfig = {
      ...source,
      agent_id: newAgentId,
      status: 'idle',
      capability_profile: {
        ...source.capability_profile,
        last_active: new Date().toISOString(),
      },
      cloned_from: sourceAgentId,
      created_at: new Date().toISOString(),
    };

    await this.registry.registerAgent(cloned, true, sourceAgentId);
    console.log(`[MasterAgent] 克隆子代理: ${sourceAgentId} -> ${newAgentId}`);
    return cloned;
  }

  /**
   * 激活子代理
   */
  async activateAgent(agentId: string): Promise<void> {
    await this.registry.updateAgentStatus(agentId, 'active');
    console.log(`[MasterAgent] 激活子代理: ${agentId}`);
  }

  /**
   * 休眠子代理
   */
  async hibernateAgent(agentId: string): Promise<void> {
    await this.registry.updateAgentStatus(agentId, 'hibernating');
    console.log(`[MasterAgent] 休眠子代理: ${agentId}`);
  }

  /**
   * 销毁子代理
   */
  async destroyAgent(agentId: string): Promise<void> {
    await this.registry.unregisterAgent(agentId);
    console.log(`[MasterAgent] 销毁子代理: ${agentId}`);
  }

  /**
   * 获取子代理注册表
   */
  async getAgentRegistry(): Promise<AgentConfig[]> {
    const entries = await this.registry.getAllAgents();
    return entries.map(e => e.config);
  }

  // ===== 经验归档 =====

  /**
   * 归档任务经验
   */
  async archiveExperience(task: TaskItem, result: AgentResult): Promise<void> {
    console.log(`[MasterAgent] 开始归档经验: 任务 ${task.task_id}, 状态: ${result.status}`);

    const succeeded = result.status === 'success';
    const agentId = task.assigned_agent || 'unknown';
    const durationSec = task.started_at && task.completed_at
      ? (new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000
      : 0;

    // ===== 步骤1: 更新任务模式库 =====
    let createdPatternId: string | undefined;
    if (this.patternLibrary) {
      try {
        const pattern = await this.patternLibrary.archivePattern(
          task.content,
          result,
          agentId,
          result.tokens_used
        );
        createdPatternId = pattern.pattern_id;
        
        if (task.matched_pattern) {
          await this.patternLibrary.updatePerformance(
            task.matched_pattern,
            result.tokens_used,
            durationSec,
            succeeded
          );
        }
        
        console.log(`[MasterAgent] 步骤1完成: 更新任务模式库, 模式ID: ${createdPatternId}`);
      } catch (error) {
        console.error(`[MasterAgent] 步骤1失败: 更新任务模式库出错`, error);
      }
    }

    // ===== 步骤2: 更新能力画像 =====
    try {
      await this.registry.updateCapability(agentId, {
        newSkill: succeeded ? this.extractSkillFromTask(task.content) : undefined,
        success: succeeded,
        tokensUsed: result.tokens_used,
      });
      console.log(`[MasterAgent] 步骤2完成: 更新能力画像`);
    } catch (error) {
      console.error(`[MasterAgent] 步骤2失败: 更新能力画像出错`, error);
    }

    // ===== 步骤3: 追加到永久记忆 =====
    if (this.memory) {
      try {
        const permMemEntry: PermMemEntry = {
          id: `pm_${task.task_id}_${Date.now()}`,
          category: succeeded ? '成功流程' : '失败结论',
          keywords: this.extractKeywords(task.content),
          summary: this.generateSummary(task, result),
          relations: {
            project: 'default',
            agent: agentId,
            tech_stack: [],
            related_patterns: createdPatternId ? [createdPatternId] : [],
          },
          file_refs: [
            ...(result.files_created || []),
            ...(result.files_modified || []),
          ],
          pitfalls: result.status === 'failure' && result.error_detail
            ? [result.error_detail]
            : [],
          created_at: new Date().toISOString(),
        };
        
        await this.memory.appendPerm(permMemEntry);
        console.log(`[MasterAgent] 步骤3完成: 追加永久记忆`);
      } catch (error) {
        console.error(`[MasterAgent] 步骤3失败: 追加永久记忆出错`, error);
      }
    }

    // ===== 步骤4: 记录执行统计 =====
    this.executionStats.totalTasks++;
    this.executionStats.totalTokensUsed += result.tokens_used;
    if (succeeded) {
      this.executionStats.successfulTasks++;
    } else {
      this.executionStats.failedTasks++;
    }
    this.executionStats.lastArchiveTime = new Date().toISOString();
    
    console.log(`[MasterAgent] 步骤4完成: 记录执行统计`);
    console.log(`[MasterAgent] 归档经验完成: 任务 ${task.task_id}`);
  }

  // ===== 私有方法 =====

  /**
   * 处理单个任务
   */
  private async processTask(task: TaskItem): Promise<AgentResult> {
    console.log(`[MasterAgent] 开始处理任务: ${task.task_id}`);
    task.status = 'running';
    task.started_at = new Date().toISOString();

    // 1. 检查 Token 限制
    const limitStatus = await this.tokenLimiter.checkLimit();
    if (!limitStatus.allowed) {
      console.warn(`[MasterAgent] Token 限制: ${limitStatus.reason}`);
      return {
        status: 'failure',
        result: limitStatus.reason || 'Token 限制',
        tokens_used: 0,
        error_code: 'TOKEN_LIMIT',
      };
    }

    // 2. 选择模型
    const modelChoice = this.modelSelector.selectModel(
      task.content,
      !!task.matched_pattern,
      task.retry_count || 0
    );
    console.log(`[MasterAgent] 选择模型: ${modelChoice.model}, 原因: ${modelChoice.reason}`);

    // #3 修复：使用上下文管理器获取压缩上下文
    const contextEntries = this.contextManager.getEntries();
    const contextStats = this.contextManager.getStats();
    console.log(`[MasterAgent] 上下文: ${contextStats.total_entries} 条, ${contextStats.total_tokens} tokens`);

    // 3. 模拟执行结果（Phase 1 骨架）
    // TODO: 实现实际的子代理执行
    const mockResult: AgentResult = {
      status: 'success',
      result: `任务 "${task.content}" 已处理`,
      tokens_used: 100,
    };

    // 4. 记录 Token 使用
    await this.tokenLimiter.recordUsage(mockResult.tokens_used);

    // 5. 更新任务状态
    task.status = 'completed';
    task.completed_at = new Date().toISOString();
    task.result = mockResult;

    // 6. 添加助手回复到上下文
    this.contextManager.addEntry({
      id: `ctx_${Date.now()}`,
      timestamp: new Date().toISOString(),
      role: 'assistant',
      content: mockResult.result,
      pinned: false,
    });

    return mockResult;
  }

  /**
   * 从任务描述中提取技能标签
   */
  private extractSkillFromTask(taskContent: string): string {
    const content = taskContent.toLowerCase();
    
    const skillPatterns: Array<{ pattern: RegExp; skill: string }> = [
      { pattern: /代码|code|编程|实现|开发/, skill: '代码开发' },
      { pattern: /调试|debug|修复|fix/, skill: '问题调试' },
      { pattern: /测试|test|验证/, skill: '测试验证' },
      { pattern: /文档|document|写作|撰写/, skill: '文档撰写' },
      { pattern: /分析|研究|调研/, skill: '研究分析' },
      { pattern: /部署|deploy|发布/, skill: '部署运维' },
      { pattern: /重构|refactor/, skill: '代码重构' },
      { pattern: /数据库|database|sql/, skill: '数据库操作' },
      { pattern: /api|接口/, skill: 'API开发' },
    ];
    
    for (const { pattern, skill } of skillPatterns) {
      if (pattern.test(content)) {
        return skill;
      }
    }
    
    return '通用任务';
  }

  /**
   * 从文本中提取关键词
   * #23 修复：使用公共函数
   */
  private extractKeywords(text: string, maxCount: number = 5): string[] {
    return sharedExtractKeywords(text, maxCount);
  }

  /**
   * 生成任务摘要
   */
  private generateSummary(task: TaskItem, result: AgentResult): string {
    const status = result.status === 'success' ? '成功' : 
                   result.status === 'failure' ? '失败' : '部分完成';
    const taskPreview = task.content.length > 50 
      ? task.content.substring(0, 50) + '...' 
      : task.content;
    const resultPreview = result.result.length > 100 
      ? result.result.substring(0, 100) + '...' 
      : result.result;
    
    return `任务"${taskPreview}"执行${status}。结果: ${resultPreview}`;
  }

  /**
   * 获取执行统计信息
   */
  getExecutionStats(): typeof this.executionStats {
    return { ...this.executionStats };
  }

  /**
   * 获取上下文统计信息
   */
  getContextStats(): ReturnType<ContextManager['getStats']> {
    return this.contextManager.getStats();
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * 创建主代理实例
 */
export async function createMasterAgent(options?: MasterAgentOptions): Promise<IMasterAgent> {
  const agent = new MasterAgent(options);
  await agent.initialize();
  return agent;
}

export default MasterAgent;
