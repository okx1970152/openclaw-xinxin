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
  TaskPriority,
  AgentConfig,
  AgentResult,
  ModelChoice,
  LimitStatus,
  UsageStats,
} from '../types/core';
import type { IMemoryManager } from '../memory-kw/types';

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
 * 任务队列接口
 */
export interface ITaskQueue {
  enqueue(task: TaskItem): void;
  dequeue(): TaskItem | undefined;
  peek(): TaskItem | undefined;
  size(): number;
  isEmpty(): boolean;
  getAll(): TaskItem[];
}

/**
 * 模型选择器接口
 */
export interface IModelSelector {
  selectModel(
    taskDescription: string,
    hasMatchedPattern: boolean,
    previousFailures: number
  ): ModelChoice;
}

/**
 * Token 限流器接口
 */
export interface ITokenLimiter {
  checkLimit(): Promise<LimitStatus>;
  recordUsage(tokens: number): Promise<void>;
  getUsageStats(): Promise<UsageStats>;
}

/**
 * 任务队列实现（严格串行）
 */
export class TaskQueue implements ITaskQueue {
  private queue: TaskItem[] = [];
  private isProcessing = false;
  private onProcessCallback?: (task: TaskItem) => Promise<void>;

  /**
   * 优先级排序权重
   */
  private priorityWeight: Record<TaskPriority, number> = {
    urgent: 3,
    normal: 2,
    low: 1,
  };

  enqueue(task: TaskItem): void {
    this.queue.push(task);
    this.sortByPriority();
  }

  dequeue(): TaskItem | undefined {
    return this.queue.shift();
  }

  peek(): TaskItem | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  getAll(): TaskItem[] {
    return [...this.queue];
  }

  /**
   * 设置处理回调
   */
  setProcessCallback(callback: (task: TaskItem) => Promise<void>): void {
    this.onProcessCallback = callback;
  }

  /**
   * 按优先级排序
   */
  private sortByPriority(): void {
    this.queue.sort((a, b) => {
      const weightA = this.priorityWeight[a.priority];
      const weightB = this.priorityWeight[b.priority];
      return weightB - weightA; // 高优先级在前
    });
  }

  /**
   * 获取处理状态
   */
  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * 设置处理状态
   */
  setIsProcessing(value: boolean): void {
    this.isProcessing = value;
  }
}

/**
 * 简单模型选择器实现
 */
export class SimpleModelSelector implements IModelSelector {
  private defaultModel: ModelChoice = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    reason: '默认使用 Sonnet 作为平衡选择',
  };

  selectModel(
    taskDescription: string,
    hasMatchedPattern: boolean,
    previousFailures: number
  ): ModelChoice {
    // 失败次数 >= 2 时升级模型
    if (previousFailures >= 2) {
      return {
        provider: 'anthropic',
        model: 'claude-opus-4-20250514',
        reason: '连续失败2次，升级到 Opus',
      };
    }

    // 有匹配模式且任务简单时使用 Haiku
    if (hasMatchedPattern && taskDescription.length < 50) {
      return {
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        reason: '有匹配模式且任务简单，使用 Haiku 节省成本',
      };
    }

    // 涉及代码/复杂逻辑使用 Sonnet
    const codeKeywords = ['代码', 'code', '编程', 'debug', '重构', '实现'];
    if (codeKeywords.some(kw => taskDescription.toLowerCase().includes(kw))) {
      return {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        reason: '涉及代码任务，使用 Sonnet',
      };
    }

    return this.defaultModel;
  }
}

/**
 * 简单 Token 限流器实现
 */
export class SimpleTokenLimiter implements ITokenLimiter {
  private hourlyLimit: number;
  private dailyLimit: number;
  private hourlyUsed: number = 0;
  private dailyUsed: number = 0;
  private totalUsed: number = 0;
  private lastHourReset: number = Date.now();
  private lastDayReset: number = Date.now();

  constructor(hourlyLimit: number = 100000, dailyLimit: number = 500000) {
    this.hourlyLimit = hourlyLimit;
    this.dailyLimit = dailyLimit;
  }

  async checkLimit(): Promise<LimitStatus> {
    this.resetIfNeeded();

    const hourlyRemaining = this.hourlyLimit - this.hourlyUsed;
    const dailyRemaining = this.dailyLimit - this.dailyUsed;

    if (hourlyRemaining <= 0) {
      return {
        allowed: false,
        hourly_remaining: 0,
        daily_remaining: dailyRemaining,
        reason: '已达到小时 Token 上限',
      };
    }

    if (dailyRemaining <= 0) {
      return {
        allowed: false,
        hourly_remaining: hourlyRemaining,
        daily_remaining: 0,
        reason: '已达到每日 Token 上限',
      };
    }

    return {
      allowed: true,
      hourly_remaining: hourlyRemaining,
      daily_remaining: dailyRemaining,
    };
  }

  async recordUsage(tokens: number): Promise<void> {
    this.resetIfNeeded();
    this.hourlyUsed += tokens;
    this.dailyUsed += tokens;
    this.totalUsed += tokens;
  }

  async getUsageStats(): Promise<UsageStats> {
    this.resetIfNeeded();
    return {
      hourly_used: this.hourlyUsed,
      hourly_limit: this.hourlyLimit,
      daily_used: this.dailyUsed,
      daily_limit: this.dailyLimit,
      total_used: this.totalUsed,
    };
  }

  private resetIfNeeded(): void {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;

    // 重置小时计数
    if (now - this.lastHourReset >= hourMs) {
      this.hourlyUsed = 0;
      this.lastHourReset = now;
    }

    // 重置日计数
    if (now - this.lastDayReset >= dayMs) {
      this.dailyUsed = 0;
      this.lastDayReset = now;
    }
  }
}

/**
 * 主代理骨架实现
 */
export class MasterAgent implements IMasterAgent {
  private taskQueue: TaskQueue;
  private modelSelector: IModelSelector;
  private tokenLimiter: ITokenLimiter;
  private agentRegistry: Map<string, AgentConfig> = new Map();
  private memory?: IMemoryManager;

  constructor(options?: {
    memory?: IMemoryManager;
    modelSelector?: IModelSelector;
    tokenLimiter?: ITokenLimiter;
  }) {
    this.taskQueue = new TaskQueue();
    this.modelSelector = options?.modelSelector ?? new SimpleModelSelector();
    this.tokenLimiter = options?.tokenLimiter ?? new SimpleTokenLimiter();
    this.memory = options?.memory;

    // 设置任务处理回调
    this.taskQueue.setProcessCallback(this.processTask.bind(this));
  }

  // ===== 核心调度 =====

  async handleMessage(msg: UnifiedMessage): Promise<string> {
    // 1. 创建任务
    const task: TaskItem = {
      task_id: this.generateTaskId(),
      content: msg.content,
      source_message: msg,
      priority: 'normal',
      created_at: new Date().toISOString(),
      status: 'queued',
    };

    // 2. 加入队列
    this.enqueueTask(task);

    // 3. 尝试处理（如果当前没有在处理）
    if (!this.taskQueue.getIsProcessing()) {
      // 异步处理，不阻塞
      this.processNextTask().catch(err => {
        console.error('[MasterAgent] 任务处理失败:', err);
      });
    }

    // 4. 返回确认消息
    return `任务已加入队列，任务ID: ${task.task_id}`;
  }

  // ===== 任务队列 =====

  enqueueTask(task: TaskItem): void {
    this.taskQueue.enqueue(task);
    console.log(`[MasterAgent] 任务入队: ${task.task_id}, 优先级: ${task.priority}`);
  }

  async processNextTask(): Promise<void> {
    if (this.taskQueue.isEmpty()) {
      this.taskQueue.setIsProcessing(false);
      return;
    }

    this.taskQueue.setIsProcessing(true);
    const task = this.taskQueue.dequeue()!;

    try {
      await this.processTask(task);
    } catch (error) {
      console.error(`[MasterAgent] 任务执行失败: ${task.task_id}`, error);
      task.status = 'failed';
    }

    // 处理下一个任务（严格串行）
    await this.processNextTask();
  }

  getQueueStatus(): TaskItem[] {
    return this.taskQueue.getAll();
  }

  // ===== 子代理管理 =====

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

    this.agentRegistry.set(agentId, config);
    console.log(`[MasterAgent] 创建子代理: ${agentId}`);
    return config;
  }

  async cloneAgent(sourceAgentId: string): Promise<AgentConfig> {
    const source = this.agentRegistry.get(sourceAgentId);
    if (!source) {
      throw new Error(`找不到源代理: ${sourceAgentId}`);
    }

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

    this.agentRegistry.set(newAgentId, cloned);
    console.log(`[MasterAgent] 克隆子代理: ${sourceAgentId} -> ${newAgentId}`);
    return cloned;
  }

  async activateAgent(agentId: string): Promise<void> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`找不到代理: ${agentId}`);
    }
    agent.status = 'active';
    agent.capability_profile.last_active = new Date().toISOString();
    console.log(`[MasterAgent] 激活子代理: ${agentId}`);
  }

  async hibernateAgent(agentId: string): Promise<void> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`找不到代理: ${agentId}`);
    }
    agent.status = 'hibernating';
    console.log(`[MasterAgent] 休眠子代理: ${agentId}`);
  }

  async destroyAgent(agentId: string): Promise<void> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`找不到代理: ${agentId}`);
    }
    agent.status = 'destroying';
    this.agentRegistry.delete(agentId);
    console.log(`[MasterAgent] 销毁子代理: ${agentId}`);
  }

  async getAgentRegistry(): Promise<AgentConfig[]> {
    return Array.from(this.agentRegistry.values());
  }

  // ===== 经验归档 =====

  async archiveExperience(task: TaskItem, result: AgentResult): Promise<void> {
    console.log(`[MasterAgent] 归档经验: 任务 ${task.task_id}, 状态: ${result.status}`);
    // TODO: 实现经验归档逻辑
    // 1. 更新任务模式库
    // 2. 更新能力画像
    // 3. 追加到永久记忆
  }

  // ===== 私有方法 =====

  private async processTask(task: TaskItem): Promise<void> {
    console.log(`[MasterAgent] 开始处理任务: ${task.task_id}`);
    task.status = 'running';
    task.started_at = new Date().toISOString();

    // 1. 检查 Token 限制
    const limitStatus = await this.tokenLimiter.checkLimit();
    if (!limitStatus.allowed) {
      console.warn(`[MasterAgent] Token 限制: ${limitStatus.reason}`);
      task.status = 'failed';
      task.result = {
        status: 'failure',
        result: limitStatus.reason || 'Token 限制',
        tokens_used: 0,
        error_code: 'TOKEN_LIMIT',
      };
      return;
    }

    // 2. 选择模型
    const modelChoice = this.modelSelector.selectModel(
      task.content,
      !!task.matched_pattern,
      task.retry_count || 0
    );
    console.log(`[MasterAgent] 选择模型: ${modelChoice.model}, 原因: ${modelChoice.reason}`);

    // 3. 路由到子代理（这里需要实现子代理调度）
    // TODO: 实现子代理路由和执行
    task.assigned_agent = 'default_agent';

    // 4. 模拟执行结果（Phase 1 骨架）
    const mockResult: AgentResult = {
      status: 'success',
      result: `任务 "${task.content}" 已处理`,
      tokens_used: 100,
    };

    // 5. 记录 Token 使用
    await this.tokenLimiter.recordUsage(mockResult.tokens_used);

    // 6. 更新任务状态
    task.status = 'completed';
    task.completed_at = new Date().toISOString();
    task.result = mockResult;

    // 7. 归档经验
    await this.archiveExperience(task, mockResult);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * 创建主代理实例
 */
export function createMasterAgent(options?: {
  memory?: IMemoryManager;
  modelSelector?: IModelSelector;
  tokenLimiter?: ITokenLimiter;
}): IMasterAgent {
  return new MasterAgent(options);
}

export default MasterAgent;
