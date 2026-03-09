/**
 * Worker Threads 封装
 * 用于在独立线程中执行子代理任务，实现 CPU 密集型操作的隔离
 *
 * 设计要点：
 * 1. 主线程负责任务调度和结果收集
 * 2. Worker 线程负责实际执行
 * 3. 支持任务超时、取消和进度报告
 */

import { Worker, isMainThread, parentPort } from 'worker_threads';
import { cpus } from 'os';
import type { AgentResult, TaskItem, AgentConfig } from '../types/core';

// Worker 消息类型
export interface WorkerMessage {
  type: 'task_start' | 'task_progress' | 'task_complete' | 'task_error' | 'heartbeat';
  payload: unknown;
  timestamp: string;
}

export interface TaskStartPayload {
  taskId: string;
  agentId: string;
  config: AgentConfig;
  task: TaskItem;
}

export interface TaskProgressPayload {
  taskId: string;
  progress: number; // 0-100
  message: string;
}

export interface TaskCompletePayload {
  taskId: string;
  result: AgentResult;
}

export interface TaskErrorPayload {
  taskId: string;
  error: string;
  code?: string;
}

// Worker 任务选项
export interface WorkerTaskOptions {
  timeout?: number; // 超时时间（毫秒），默认 5 分钟
  onProgress?: (progress: TaskProgressPayload) => void;
  onHeartbeat?: () => void;
}

// Worker 池配置
export interface WorkerPoolConfig {
  maxWorkers?: number; // 最大 Worker 数量
  idleTimeout?: number; // 空闲 Worker 超时时间
  taskTimeout?: number; // 默认任务超时时间
}

// Worker 任务句柄
export interface WorkerTaskHandle {
  taskId: string;
  promise: Promise<AgentResult>;
  abort: () => void;
}

/**
 * Worker 线程池管理器
 */
export class WorkerPool {
  private workers: Map<string, Worker> = new Map();
  private taskQueue: Array<{
    task: TaskItem;
    config: AgentConfig;
    resolve: (result: AgentResult) => void;
    reject: (error: Error) => void;
    options: WorkerTaskOptions;
  }> = [];
  private activeCount = 0;
  private maxWorkers: number;
  private idleTimeout: number;
  private taskTimeout: number;
  private workerFile: string;

  constructor(config: WorkerPoolConfig = {}, workerFile?: string) {
    this.maxWorkers = config.maxWorkers || Math.min(cpus().length, 4);
    this.idleTimeout = config.idleTimeout || 30000;
    this.taskTimeout = config.taskTimeout || 300000; // 5 分钟
    // Worker 脚本路径，默认使用当前文件
    this.workerFile = workerFile || __filename;
  }

  /**
   * 提交任务到 Worker 池
   */
  submitTask(
    task: TaskItem,
    config: AgentConfig,
    options: WorkerTaskOptions = {}
  ): WorkerTaskHandle {
    let resolveResult!: (result: AgentResult) => void;
    let rejectResult!: (error: Error) => void;

    const promise = new Promise<AgentResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.taskQueue.push({
      task,
      config,
      resolve: resolveResult,
      reject: rejectResult,
      options: {
        timeout: options.timeout || this.taskTimeout,
        onProgress: options.onProgress,
        onHeartbeat: options.onHeartbeat,
      },
    });

    // 尝试处理队列
    this.processQueue();

    return {
      taskId: task.task_id,
      promise,
      abort: () => {
        // 从队列移除或中断正在执行的任务
        const index = this.taskQueue.findIndex((item) => item.task.task_id === task.task_id);
        if (index >= 0) {
          this.taskQueue.splice(index, 1);
          rejectResult(new Error('Task aborted'));
        }
      },
    };
  }

  /**
   * 处理任务队列
   */
  private processQueue(): void {
    while (this.activeCount < this.maxWorkers && this.taskQueue.length > 0) {
      const item = this.taskQueue.shift();
      if (item) {
        this.executeTask(item);
      }
    }
  }

  /**
   * 执行单个任务
   */
  private executeTask(item: {
    task: TaskItem;
    config: AgentConfig;
    resolve: (result: AgentResult) => void;
    reject: (error: Error) => void;
    options: WorkerTaskOptions;
  }): void {
    this.activeCount++;

    const workerId = `${item.task.task_id}_${Date.now()}`;
    let timeoutId: NodeJS.Timeout | null = null;

    const worker = new Worker(this.workerFile, {
      workerData: {
        type: 'init',
        task: item.task,
        config: item.config,
      },
    });

    this.workers.set(workerId, worker);

    // 设置超时
    const timeout = item.options.timeout || this.taskTimeout;
    timeoutId = setTimeout(() => {
      void worker.terminate();
      this.workers.delete(workerId);
      this.activeCount--;
      item.reject(new Error(`Task timeout after ${timeout}ms`));
      this.processQueue();
    }, timeout);

    // 监听消息
    worker.on('message', (message: WorkerMessage) => {
      switch (message.type) {
        case 'task_progress':
          if (item.options.onProgress) {
            item.options.onProgress(message.payload as TaskProgressPayload);
          }
          break;
        case 'task_complete':
          if (timeoutId) { clearTimeout(timeoutId); }
          this.workers.delete(workerId);
          this.activeCount--;
          item.resolve(message.payload as AgentResult);
          this.processQueue();
          break;
        case 'task_error':
          if (timeoutId) { clearTimeout(timeoutId); }
          this.workers.delete(workerId);
          this.activeCount--;
          const errorPayload = message.payload as TaskErrorPayload;
          item.reject(new Error(errorPayload.error));
          this.processQueue();
          break;
        case 'heartbeat':
          if (item.options.onHeartbeat) {
            item.options.onHeartbeat();
          }
          // 重置超时计时器
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              void worker.terminate();
              this.workers.delete(workerId);
              this.activeCount--;
              item.reject(new Error(`Task timeout after ${timeout}ms`));
              this.processQueue();
            }, timeout);
          }
          break;
      }
    });

    // 错误处理
    worker.on('error', (error) => {
      if (timeoutId) { clearTimeout(timeoutId); }
      this.workers.delete(workerId);
      this.activeCount--;
      item.reject(error);
      this.processQueue();
    });

    // 退出处理
    worker.on('exit', (code) => {
      if (code !== 0) {
        if (timeoutId) { clearTimeout(timeoutId); }
        this.workers.delete(workerId);
        this.activeCount--;
        item.reject(new Error(`Worker stopped with exit code ${code}`));
        this.processQueue();
      }
    });

    // 发送任务开始消息
    const startPayload: TaskStartPayload = {
      taskId: item.task.task_id,
      agentId: item.config.agent_id,
      config: item.config,
      task: item.task,
    };

    worker.postMessage({
      type: 'task_start',
      payload: startPayload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取池状态
   */
  getStatus(): { activeWorkers: number; maxWorkers: number; queuedTasks: number } {
    return {
      activeWorkers: this.activeCount,
      maxWorkers: this.maxWorkers,
      queuedTasks: this.taskQueue.length,
    };
  }

  /**
   * 关闭所有 Worker
   */
  async shutdown(): Promise<void> {
    const terminations = Array.from(this.workers.values()).map((worker) => worker.terminate());
    await Promise.all(terminations);
    this.workers.clear();
    this.taskQueue = [];
  }
}

/**
 * Worker 线程执行函数
 * 当此文件作为 Worker 运行时执行
 */
function runAsWorker(): void {
  if (!parentPort) {
    return;
  }

  // 心跳定时器
  let heartbeatInterval: NodeJS.Timeout | null = null;

  parentPort.on('message', async (message: WorkerMessage) => {
    if (message.type === 'task_start') {
      const payload = message.payload as TaskStartPayload;

      // 启动心跳
      heartbeatInterval = setInterval(() => {
        parentPort?.postMessage({
          type: 'heartbeat',
          payload: { taskId: payload.taskId },
          timestamp: new Date().toISOString(),
        });
      }, 10000); // 每 10 秒发送心跳

      try {
        // 报告进度
        const reportProgress = (progress: number, msg: string) => {
          parentPort?.postMessage({
            type: 'task_progress',
            payload: {
              taskId: payload.taskId,
              progress,
              message: msg,
            },
            timestamp: new Date().toISOString(),
          });
        };

        reportProgress(10, '正在初始化任务执行环境...');

        // 执行任务
        const result = await executeTaskInWorker(payload.task, payload.config, reportProgress);

        // 停止心跳
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }

        // 发送完成消息
        parentPort.postMessage({
          type: 'task_complete',
          payload: {
            taskId: payload.taskId,
            result,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // 停止心跳
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }

        // 发送错误消息
        parentPort.postMessage({
          type: 'task_error',
          payload: {
            taskId: payload.taskId,
            error: error instanceof Error ? error.message : String(error),
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
}

/**
 * 在 Worker 中执行任务
 * 这里实现实际的任务执行逻辑
 */
async function executeTaskInWorker(
  task: TaskItem,
  config: AgentConfig,
  reportProgress: (progress: number, message: string) => void
): Promise<AgentResult> {
  // 阶段 1: 准备环境
  reportProgress(20, '正在准备执行环境...');

  // 阶段 2: 加载上下文
  reportProgress(40, '正在加载任务上下文...');

  // 阶段 3: 执行核心逻辑
  reportProgress(60, '正在执行任务...');

  // 阶段 4: 处理结果
  reportProgress(80, '正在处理执行结果...');

  // 这里是实际的执行逻辑占位
  // 在实际实现中，这里会调用子代理的 execute 方法

  // 阶段 5: 完成
  reportProgress(100, '任务执行完成');

  return {
    status: 'success',
    result: `Task ${task.task_id} completed by agent ${config.agent_id}`,
    tokens_used: 0,
  };
}

// 如果是 Worker 线程，启动 Worker 逻辑
if (!isMainThread) {
  runAsWorker();
}

// 导出主线程使用的类和接口
export { isMainThread };
