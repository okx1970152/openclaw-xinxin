/**
 * 超级大龙虾 - 错误管理器
 * Error Manager
 * 
 * 存放于 src/error-handling/error-manager.ts
 * 集中错误处理、优雅降级、错误统计
 */

import {
  ErrorCode,
  ErrorSeverity,
  RecoveryStrategy,
  type ErrorHandlingResult,
  type ErrorStats,
  type ErrorListener,
  type IErrorHandler,
} from './types';
import { AppError, toAppError } from './app-error';

/**
 * 默认错误处理器映射
 */
const DEFAULT_HANDLERS: Map<ErrorCode, IErrorHandler> = new Map();

// 注册默认处理器
[
  ErrorCode.MEMORY_OVERFLOW,
  ErrorCode.MEMORY_READ_ERROR,
  ErrorCode.MEMORY_WRITE_ERROR,
].forEach(code => {
  DEFAULT_HANDLERS.set(code, {
    code,
    handle: async (error: AppError) => ({
      handled: true,
      strategy: RecoveryStrategy.FALLBACK,
      message: `内存错误: ${error.message}，已启用降级模式`,
      shouldRetry: false,
    }),
  });
});

[
  ErrorCode.LLM_ERROR,
  ErrorCode.LLM_TIMEOUT,
  ErrorCode.LLM_RATE_LIMIT,
].forEach(code => {
  DEFAULT_HANDLERS.set(code, {
    code,
    handle: async (error: AppError) => ({
      handled: true,
      strategy: RecoveryStrategy.RETRY,
      message: `LLM 错误: ${error.message}，将重试`,
      shouldRetry: true,
      retryDelayMs: 1000,
      value: error.fallback?.(),
    }),
  });
});

[
  ErrorCode.SECURITY_VIOLATION,
  ErrorCode.PERMISSION_DENIED,
].forEach(code => {
  DEFAULT_HANDLERS.set(code, {
    code,
    handle: async (error: AppError) => ({
      handled: true,
      strategy: RecoveryStrategy.ABORT,
      message: `安全错误: ${error.message}`,
      shouldRetry: false,
    }),
  });
});

[
  ErrorCode.NETWORK_ERROR,
  ErrorCode.WEBSOCKET_ERROR,
].forEach(code => {
  DEFAULT_HANDLERS.set(code, {
    code,
    handle: async (error: AppError) => ({
      handled: true,
      strategy: RecoveryStrategy.RETRY,
      message: `网络错误: ${error.message}，将重试`,
      shouldRetry: true,
      retryDelayMs: 2000,
    }),
  });
});

/**
 * 错误管理器
 */
export class ErrorManager {
  private handlers: Map<ErrorCode, IErrorHandler> = new Map(DEFAULT_HANDLERS);
  private listeners: ErrorListener[] = [];
  private errorHistory: Array<{ error: AppError; result: ErrorHandlingResult }> = [];
  private maxHistorySize = 100;
  private startTime = Date.now();

  /**
   * 注册错误处理器
   */
  registerHandler(handler: IErrorHandler): void {
    const codes = Array.isArray(handler.code) ? handler.code : [handler.code];
    for (const code of codes) {
      this.handlers.set(code, handler);
    }
  }

  /**
   * 添加错误监听器
   */
  addListener(listener: ErrorListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除错误监听器
   */
  removeListener(listener: ErrorListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 处理错误
   */
  async handle(error: unknown): Promise<ErrorHandlingResult> {
    const appError = toAppError(error);

    // 查找处理器
    const handler = this.handlers.get(appError.code);

    let result: ErrorHandlingResult;

    if (handler) {
      result = await handler.handle(appError);
    } else {
      // 默认处理
      result = this.defaultHandle(appError);
    }

    // 记录历史
    this.errorHistory.push({ error: appError, result });
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // 通知监听器
    for (const listener of this.listeners) {
      try {
        listener(appError, result);
      } catch (e) {
        console.error('[ErrorManager] 监听器执行错误:', e);
      }
    }

    // 记录日志
    this.logError(appError, result);

    return result;
  }

  /**
   * 获取错误统计
   */
  getStats(): ErrorStats {
    const byCode: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const recentErrors: ErrorStats['recentErrors'] = [];

    for (const { error } of this.errorHistory) {
      byCode[error.code] = (byCode[error.code] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    for (const { error } of this.errorHistory.slice(-10)) {
      recentErrors.push({
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
      });
    }

    const uptimeHours = (Date.now() - this.startTime) / 3600000;
    const errorRate = uptimeHours > 0 ? this.errorHistory.length / uptimeHours : 0;

    return {
      totalErrors: this.errorHistory.length,
      byCode,
      bySeverity,
      recentErrors,
      errorRate,
    };
  }

  /**
   * 获取错误历史
   */
  getHistory(): Array<{ error: AppError; result: ErrorHandlingResult }> {
    return [...this.errorHistory];
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * 包装异步函数，自动处理错误
   */
  wrapAsync<T>(
    fn: () => Promise<T>,
    fallback?: () => T
  ): Promise<T | undefined> {
    return fn().catch(async (error) => {
      const result = await this.handle(error);

      if (result.value !== undefined) {
        return result.value as T;
      }

      if (fallback) {
        return fallback();
      }

      return undefined;
    });
  }

  /**
   * 使用重试策略执行
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        const result = await this.handle(error);

        if (!result.shouldRetry || attempt === maxRetries) {
          throw error;
        }

        // 等待重试
        await this.delay(result.retryDelayMs || delayMs);
      }
    }

    throw lastError;
  }

  // ===== 私有方法 =====

  /**
   * 默认处理
   */
  private defaultHandle(error: AppError): ErrorHandlingResult {
    switch (error.severity) {
      case ErrorSeverity.LOW:
        return {
          handled: true,
          strategy: RecoveryStrategy.IGNORE,
          message: `已忽略: ${error.message}`,
          shouldRetry: false,
        };

      case ErrorSeverity.MEDIUM:
        return {
          handled: true,
          strategy: error.retryable ? RecoveryStrategy.RETRY : RecoveryStrategy.FALLBACK,
          message: error.message,
          shouldRetry: error.retryable,
          retryDelayMs: 1000,
        };

      case ErrorSeverity.HIGH:
        return {
          handled: true,
          strategy: RecoveryStrategy.FALLBACK,
          message: `高严重度错误: ${error.message}`,
          shouldRetry: false,
          value: error.fallback?.(),
        };

      case ErrorSeverity.CRITICAL:
        return {
          handled: false,
          strategy: RecoveryStrategy.ABORT,
          message: `严重错误: ${error.message}，需要人工介入`,
          shouldRetry: false,
        };

      default:
        return {
          handled: false,
          strategy: RecoveryStrategy.IGNORE,
          message: error.message,
          shouldRetry: false,
        };
    }
  }

  /**
   * 记录错误日志
   */
  private logError(error: AppError, result: ErrorHandlingResult): void {
    const logLevel = this.getLogLevel(error.severity);
    const prefix = `[ErrorManager] [${error.code}]`;

    const message = `${prefix} ${error.message} -> ${result.strategy} (${result.handled ? '已处理' : '未处理'})`;

    switch (logLevel) {
      case 'error':
        console.error(message, error.context || '');
        break;
      case 'warn':
        console.warn(message, error.context || '');
        break;
      default:
        console.log(message, error.context || '');
    }
  }

  /**
   * 获取日志级别
   */
  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'log' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      default:
        return 'log';
    }
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 单例实例
let instance: ErrorManager | null = null;

/**
 * 获取全局错误管理器实例
 */
export function getErrorManager(): ErrorManager {
  if (!instance) {
    instance = new ErrorManager();
  }
  return instance;
}

/**
 * 创建错误管理器实例
 */
export function createErrorManager(): ErrorManager {
  return new ErrorManager();
}

export default ErrorManager;
