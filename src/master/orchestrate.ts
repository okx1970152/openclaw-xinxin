/**
 * 超级大龙虾 - 任务编排模块
 * Task Orchestration
 * 
 * 存放于 src/master/orchestrate.ts
 * 完整的任务调度和执行流程
 */

import type {
  TaskItem,
  AgentConfig,
  AgentResult,
  TaskPriority,
} from '../types/core';
import type { IMemoryManager } from '../memory-kw/types';

/**
 * 编排器配置
 */
export interface OrchestrationConfig {
  /** 最大重试次数 */
  maxRetryCount: number;
  /** 任务超时时间（毫秒） */
  taskTimeoutMs: number;
  /** 是否启用自动降级 */
  enableAutoFallback: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: OrchestrationConfig = {
  maxRetryCount: 3,
  taskTimeoutMs: 300000, // 5分钟
  enableAutoFallback: true,
};

/**
 * 任务执行上下文
 */
export interface TaskContext {
  task: TaskItem;
  assignedAgent: AgentConfig | null;
  retryCount: number;
  startTime: number;
  memory?: IMemoryManager;
}

/**
 * 任务处理器接口
 * 支持两种调用方式：仅任务参数 或 任务+上下文
 */
export interface ITaskHandler {
  execute(task: TaskItem, context?: TaskContext): Promise<AgentResult>;
}

/**
 * 任务编排器
 */
export class TaskOrchestrator {
  private config: OrchestrationConfig;
  private queue: TaskItem[] = [];
  private isProcessing = false;
  private currentTask: TaskItem | null = null;
  private context: TaskContext | null = null;
  private taskHandler?: ITaskHandler;
  private onComplete?: (task: TaskItem, result: AgentResult) => Promise<void>;

  constructor(config?: Partial<OrchestrationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置任务处理器
   */
  setTaskHandler(handler: ITaskHandler): void {
    this.taskHandler = handler;
  }

  /**
   * 设置完成回调
   */
  setOnComplete(callback: (task: TaskItem, result: AgentResult) => Promise<void>): void {
    this.onComplete = callback;
  }

  /**
   * 添加任务到队列
   */
  enqueue(task: TaskItem): void {
    this.queue.push(task);
    this.sortQueue();

    console.log(`[Orchestrator] 任务入队: ${task.task_id}, 优先级: ${task.priority}, 队列长度: ${this.queue.length}`);

    // 如果没有在处理，开始处理
    if (!this.isProcessing) {
      this.processNext().catch(err => {
        console.error('[Orchestrator] 处理失败:', err);
      });
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    currentTaskId: string | null;
  } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentTaskId: this.currentTask?.task_id || null,
    };
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    // 检查是否是当前任务
    if (this.currentTask?.task_id === taskId) {
      this.currentTask.status = 'failed';
      this.currentTask.result = {
        status: 'failure',
        result: '任务已取消',
        tokens_used: 0,
        error_code: 'CANCELLED',
      };
      return true;
    }

    // 从队列中移除
    const index = this.queue.findIndex(t => t.task_id === taskId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * 获取任务优先级
   */
  getTaskPosition(taskId: string): number {
    return this.queue.findIndex(t => t.task_id === taskId);
  }

  // ===== 私有方法 =====

  /**
   * 处理下一个任务
   * #17 修复：改用循环避免递归栈溢出
   */
  private async processNext(): Promise<void> {
    // 使用循环而非递归
    while (this.queue.length > 0 || this.isProcessing) {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        this.currentTask = null;
        this.context = null;
        return;
      }

      this.isProcessing = true;
      this.currentTask = this.queue.shift()!;
      
      console.log(`[Orchestrator] 开始处理任务: ${this.currentTask.task_id}`);

      // 创建执行上下文
      this.context = {
        task: this.currentTask,
        assignedAgent: null,
        retryCount: 0,
        startTime: Date.now(),
      };

      try {
        // 执行任务
        const result = await this.executeTask(this.currentTask, this.context);
        
        // 更新任务状态
        this.currentTask.status = result.status === 'success' ? 'completed' : 'failed';
        this.currentTask.result = result;
        this.currentTask.completed_at = new Date().toISOString();

        // 调用完成回调
        if (this.onComplete) {
          await this.onComplete(this.currentTask, result);
        }

      } catch (error) {
        console.error(`[Orchestrator] 任务执行异常: ${this.currentTask.task_id}`, error);
        
        this.currentTask.status = 'failed';
        this.currentTask.result = {
          status: 'failure',
          result: error instanceof Error ? error.message : String(error),
          tokens_used: 0,
          error_code: 'EXEC_FAILED',
        };
      }
      
      // 循环继续处理下一个任务
    }
    
    // 队列为空，重置状态
    this.isProcessing = false;
    this.currentTask = null;
    this.context = null;
  }

  /**
   * 执行任务（含重试逻辑）
   */
  private async executeTask(
    task: TaskItem,
    context: TaskContext
  ): Promise<AgentResult> {
    let lastError: Error | null = null;
    let retryCount = 0;

    while (retryCount <= this.config.maxRetryCount) {
      try {
        // 设置超时
        const result = await this.withTimeout(
          this.executeWithHandler(task, context),
          this.config.taskTimeoutMs
        );

        // 成功则返回
        if (result.status === 'success') {
          return result;
        }

        // 失败但可重试
        if (result.error_code && this.isRetryable(result.error_code)) {
          lastError = new Error(result.error_detail || result.result);
          retryCount++;
          context.retryCount = retryCount;
          
          console.warn(`[Orchestrator] 任务重试 ${retryCount}/${this.config.maxRetryCount}: ${task.task_id}`);
          continue;
        }

        // 不可重试的错误直接返回
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;
        context.retryCount = retryCount;

        if (retryCount > this.config.maxRetryCount) {
          break;
        }

        console.warn(`[Orchestrator] 任务异常重试 ${retryCount}/${this.config.maxRetryCount}:`, lastError.message);
      }
    }

    // 重试耗尽
    return {
      status: 'failure',
      result: lastError?.message || '任务执行失败，重试耗尽',
      tokens_used: 0,
      error_code: 'MAX_RETRY_EXCEEDED',
      error_detail: lastError?.stack,
    };
  }

  /**
   * 使用处理器执行任务
   */
  private async executeWithHandler(
    task: TaskItem,
    context: TaskContext
  ): Promise<AgentResult> {
    if (this.taskHandler) {
      return this.taskHandler.execute(task, context);
    }

    // 默认实现：返回模拟结果
    return {
      status: 'success',
      result: `任务 "${task.content}" 已处理`,
      tokens_used: 100,
    };
  }

  /**
   * 超时包装
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`任务超时 (${timeoutMs}ms)`));
      }, timeoutMs);

      promise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryable(errorCode: string): boolean {
    const retryableErrors = [
      'LLM_TIMEOUT',
      'LLM_RATE_LIMIT',
      'LLM_ERROR',
      'TOKEN_LIMIT',
    ];
    return retryableErrors.includes(errorCode);
  }

  /**
   * 按优先级排序队列
   */
  private sortQueue(): void {
    const priorityWeight: Record<TaskPriority, number> = {
      urgent: 3,
      normal: 2,
      low: 1,
    };

    this.queue.sort((a, b) => {
      const weightA = priorityWeight[a.priority];
      const weightB = priorityWeight[b.priority];
      return weightB - weightA;
    });
  }
}

/**
 * 创建任务编排器实例
 */
export function createTaskOrchestrator(config?: Partial<OrchestrationConfig>): TaskOrchestrator {
  return new TaskOrchestrator(config);
}

export default TaskOrchestrator;
