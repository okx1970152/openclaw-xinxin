/**
 * 超级大龙虾 - 应用错误类
 * Application Error Class
 * 
 * 存放于 src/error-handling/app-error.ts
 */

import {
  ErrorCode,
  ErrorSeverity,
  RecoveryStrategy,
  type AppErrorOptions,
} from './types';

/**
 * 应用错误基类
 * 
 * 继承自 Error，提供结构化的错误信息
 */
export class AppError extends Error {
  /** 错误代码 */
  readonly code: ErrorCode;
  /** 严重级别 */
  readonly severity: ErrorSeverity;
  /** 恢复策略 */
  readonly recoveryStrategy: RecoveryStrategy;
  /** 原始错误 */
  readonly cause?: Error;
  /** 上下文数据 */
  readonly context?: Record<string, unknown>;
  /** 是否可重试 */
  readonly retryable: boolean;
  /** 最大重试次数 */
  readonly maxRetries?: number;
  /** 降级函数 */
  readonly fallback?: () => unknown;
  /** 时间戳 */
  readonly timestamp: string;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.severity = options.severity;
    this.recoveryStrategy = options.recoveryStrategy;
    this.cause = options.cause;
    this.context = options.context;
    this.retryable = options.retryable;
    this.maxRetries = options.maxRetries;
    this.fallback = options.fallback;
    this.timestamp = new Date().toISOString();

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * 转换为 JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recoveryStrategy: this.recoveryStrategy,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }

  /**
   * 创建用户友好的错误消息
   */
  toUserMessage(): string {
    switch (this.severity) {
      case ErrorSeverity.LOW:
        return `提示: ${this.message}`;
      case ErrorSeverity.MEDIUM:
        return `警告: ${this.message}`;
      case ErrorSeverity.HIGH:
        return `错误: ${this.message}`;
      case ErrorSeverity.CRITICAL:
        return `严重错误: ${this.message}，请联系管理员`;
      default:
        return this.message;
    }
  }

  // ===== 静态工厂方法 =====

  /**
   * 创建内存溢出错误
   */
  static memoryOverflow(message: string, context?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.MEMORY_OVERFLOW,
      message,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.FALLBACK,
      retryable: false,
      context,
    });
  }

  /**
   * 创建子代理未找到错误
   */
  static agentNotFound(agentId: string): AppError {
    return new AppError({
      code: ErrorCode.AGENT_NOT_FOUND,
      message: `子代理未找到: ${agentId}`,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.ABORT,
      retryable: false,
      context: { agentId },
    });
  }

  /**
   * 创建任务超时错误
   */
  static taskTimeout(taskId: string, timeoutMs: number): AppError {
    return new AppError({
      code: ErrorCode.TASK_TIMEOUT,
      message: `任务超时: ${taskId} (${timeoutMs}ms)`,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
      maxRetries: 3,
      context: { taskId, timeoutMs },
    });
  }

  /**
   * 创建 LLM 错误
   */
  static llmError(message: string, cause?: Error): AppError {
    return new AppError({
      code: ErrorCode.LLM_ERROR,
      message,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
      maxRetries: 3,
      cause,
    });
  }

  /**
   * 创建安全违规错误
   */
  static securityViolation(message: string, context?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.SECURITY_VIOLATION,
      message,
      severity: ErrorSeverity.CRITICAL,
      recoveryStrategy: RecoveryStrategy.ABORT,
      retryable: false,
      context,
    });
  }

  /**
   * 创建配置错误
   */
  static configError(message: string, context?: Record<string, unknown>): AppError {
    return new AppError({
      code: ErrorCode.CONFIG_ERROR,
      message,
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.ABORT,
      retryable: false,
      context,
    });
  }

  /**
   * 创建网络错误
   */
  static networkError(message: string, cause?: Error): AppError {
    return new AppError({
      code: ErrorCode.NETWORK_ERROR,
      message,
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
      maxRetries: 5,
      cause,
    });
  }

  /**
   * 创建未知错误
   */
  static unknown(cause?: Error): AppError {
    return new AppError({
      code: ErrorCode.UNKNOWN,
      message: cause?.message || '未知错误',
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.IGNORE,
      retryable: false,
      cause,
    });
  }
}

/**
 * 判断是否为 AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 将普通错误转换为 AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return AppError.unknown(error);
  }

  return AppError.unknown(new Error(String(error)));
}

export default AppError;
