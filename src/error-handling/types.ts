/**
 * 超级大龙虾 - 错误处理类型定义
 * Error Handling Types
 * 
 * 存放于 src/error-handling/types.ts
 */

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 系统错误
  UNKNOWN = 'UNKNOWN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',

  // 记忆系统错误
  MEMORY_OVERFLOW = 'MEMORY_OVERFLOW',
  MEMORY_READ_ERROR = 'MEMORY_READ_ERROR',
  MEMORY_WRITE_ERROR = 'MEMORY_WRITE_ERROR',
  MEMORY_CORRUPTED = 'MEMORY_CORRUPTED',

  // 子代理错误
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_CREATION_FAILED = 'AGENT_CREATION_FAILED',
  AGENT_EXECUTION_FAILED = 'AGENT_EXECUTION_FAILED',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  AGENT_CRASHED = 'AGENT_CRASHED',

  // 任务错误
  TASK_QUEUE_FULL = 'TASK_QUEUE_FULL',
  TASK_EXECUTION_FAILED = 'TASK_EXECUTION_FAILED',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  TASK_CANCELLED = 'TASK_CANCELLED',

  // LLM 错误
  LLM_ERROR = 'LLM_ERROR',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  LLM_TOKEN_LIMIT = 'LLM_TOKEN_LIMIT',

  // 安全错误
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SKILL_NOT_APPROVED = 'SKILL_NOT_APPROVED',

  // 配置错误
  CONFIG_ERROR = 'CONFIG_ERROR',
  CONFIG_MISSING = 'CONFIG_MISSING',
  CONFIG_INVALID = 'CONFIG_INVALID',

  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',

  // 检索错误
  SEARCH_ERROR = 'SEARCH_ERROR',
  INDEX_ERROR = 'INDEX_ERROR',
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  /** 低 - 可忽略 */
  LOW = 'low',
  /** 中 - 需要注意 */
  MEDIUM = 'medium',
  /** 高 - 影响功能 */
  HIGH = 'high',
  /** 严重 - 影响系统 */
  CRITICAL = 'critical',
}

/**
 * 错误恢复策略
 */
export enum RecoveryStrategy {
  /** 忽略 */
  IGNORE = 'ignore',
  /** 重试 */
  RETRY = 'retry',
  /** 降级 */
  FALLBACK = 'fallback',
  /** 终止 */
  ABORT = 'abort',
  /** 重启 */
  RESTART = 'restart',
}

/**
 * 应用错误基类
 */
export interface AppErrorOptions {
  /** 错误代码 */
  code: ErrorCode;
  /** 错误消息 */
  message: string;
  /** 严重级别 */
  severity: ErrorSeverity;
  /** 恢复策略 */
  recoveryStrategy: RecoveryStrategy;
  /** 原始错误 */
  cause?: Error;
  /** 上下文数据 */
  context?: Record<string, unknown>;
  /** 是否可重试 */
  retryable: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 降级函数 */
  fallback?: () => unknown;
}

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult<T = unknown> {
  /** 是否已处理 */
  handled: boolean;
  /** 恢复策略 */
  strategy: RecoveryStrategy;
  /** 处理后的值 */
  value?: T;
  /** 处理消息 */
  message: string;
  /** 是否需要重试 */
  shouldRetry: boolean;
  /** 重试延迟（毫秒） */
  retryDelayMs?: number;
}

/**
 * 错误处理器接口
 */
export interface IErrorHandler {
  /** 错误代码 */
  code: ErrorCode | ErrorCode[];
  /** 处理函数 */
  handle: (error: AppError) => Promise<ErrorHandlingResult>;
}

/**
 * 错误统计
 */
export interface ErrorStats {
  /** 总错误数 */
  totalErrors: number;
  /** 按代码分类 */
  byCode: Record<string, number>;
  /** 按严重级别分类 */
  bySeverity: Record<string, number>;
  /** 最近错误 */
  recentErrors: Array<{
    code: string;
    message: string;
    timestamp: string;
  }>;
  /** 错误率（错误/小时） */
  errorRate: number;
}

/**
 * 错误监听器
 */
export type ErrorListener = (error: AppError, result: ErrorHandlingResult) => void;
