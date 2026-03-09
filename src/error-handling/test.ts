/**
 * 超级大龙虾 - 错误处理模块单元测试
 * Error Handling Module Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AppError,
  isAppError,
  toAppError,
  ErrorCode,
  ErrorSeverity,
  RecoveryStrategy,
} from './index';
import { ErrorManager } from './error-manager';
import { DegradationManager, DegradationLevel } from './degradation';

describe('AppError', () => {
  it('should create an AppError with all properties', () => {
    const error = new AppError({
      code: ErrorCode.MEMORY_OVERFLOW,
      message: 'Memory overflow occurred',
      severity: ErrorSeverity.HIGH,
      recoveryStrategy: RecoveryStrategy.FALLBACK,
      retryable: false,
      context: { used: 100, limit: 50 },
    });

    expect(error.code).toBe(ErrorCode.MEMORY_OVERFLOW);
    expect(error.message).toBe('Memory overflow occurred');
    expect(error.severity).toBe(ErrorSeverity.HIGH);
    expect(error.recoveryStrategy).toBe(RecoveryStrategy.FALLBACK);
    expect(error.retryable).toBe(false);
    expect(error.context).toEqual({ used: 100, limit: 50 });
    expect(error.timestamp).toBeDefined();
  });

  it('should convert to JSON', () => {
    const error = new AppError({
      code: ErrorCode.LLM_ERROR,
      message: 'LLM error',
      severity: ErrorSeverity.MEDIUM,
      recoveryStrategy: RecoveryStrategy.RETRY,
      retryable: true,
    });

    const json = error.toJSON();
    expect(json.code).toBe(ErrorCode.LLM_ERROR);
    expect(json.message).toBe('LLM error');
  });

  it('should generate user-friendly messages', () => {
    const lowError = new AppError({
      code: ErrorCode.UNKNOWN,
      message: 'Low severity error',
      severity: ErrorSeverity.LOW,
      recoveryStrategy: RecoveryStrategy.IGNORE,
      retryable: false,
    });

    const criticalError = new AppError({
      code: ErrorCode.SECURITY_VIOLATION,
      message: 'Security violation',
      severity: ErrorSeverity.CRITICAL,
      recoveryStrategy: RecoveryStrategy.ABORT,
      retryable: false,
    });

    expect(lowError.toUserMessage()).toContain('提示:');
    expect(criticalError.toUserMessage()).toContain('严重错误:');
    expect(criticalError.toUserMessage()).toContain('请联系管理员');
  });

  it('should create memory overflow error', () => {
    const error = AppError.memoryOverflow('内存已满', { size: 100 });
    expect(error.code).toBe(ErrorCode.MEMORY_OVERFLOW);
    expect(error.severity).toBe(ErrorSeverity.HIGH);
  });

  it('should create agent not found error', () => {
    const error = AppError.agentNotFound('agent-001');
    expect(error.code).toBe(ErrorCode.AGENT_NOT_FOUND);
    expect(error.context).toEqual({ agentId: 'agent-001' });
  });

  it('should create task timeout error', () => {
    const error = AppError.taskTimeout('task-001', 5000);
    expect(error.code).toBe(ErrorCode.TASK_TIMEOUT);
    expect(error.retryable).toBe(true);
    expect(error.maxRetries).toBe(3);
  });

  it('should create LLM error', () => {
    const cause = new Error('API Error');
    const error = AppError.llmError('Claude API failed', cause);
    expect(error.code).toBe(ErrorCode.LLM_ERROR);
    expect(error.cause).toBe(cause);
    expect(error.retryable).toBe(true);
  });

  it('should create security violation error', () => {
    const error = AppError.securityViolation('未授权访问', { ip: '1.2.3.4' });
    expect(error.code).toBe(ErrorCode.SECURITY_VIOLATION);
    expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    expect(error.retryable).toBe(false);
  });
});

describe('isAppError', () => {
  it('should return true for AppError instances', () => {
    const error = new AppError({
      code: ErrorCode.UNKNOWN,
      message: 'test',
      severity: ErrorSeverity.LOW,
      recoveryStrategy: RecoveryStrategy.IGNORE,
      retryable: false,
    });
    expect(isAppError(error)).toBe(true);
  });

  it('should return false for regular errors', () => {
    const error = new Error('regular error');
    expect(isAppError(error)).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});

describe('toAppError', () => {
  it('should return same AppError if already one', () => {
    const error = new AppError({
      code: ErrorCode.UNKNOWN,
      message: 'test',
      severity: ErrorSeverity.LOW,
      recoveryStrategy: RecoveryStrategy.IGNORE,
      retryable: false,
    });
    expect(toAppError(error)).toBe(error);
  });

  it('should wrap regular errors', () => {
    const error = new Error('regular error');
    const appError = toAppError(error);
    expect(isAppError(appError)).toBe(true);
    expect(appError.message).toBe('regular error');
  });

  it('should wrap non-errors', () => {
    const appError = toAppError('string error');
    expect(isAppError(appError)).toBe(true);
  });
});

describe('ErrorManager', () => {
  let manager: ErrorManager;

  beforeEach(() => {
    manager = new ErrorManager();
  });

  it('should handle memory overflow errors', async () => {
    const error = AppError.memoryOverflow('内存已满');
    const result = await manager.handle(error);

    expect(result.handled).toBe(true);
    expect(result.strategy).toBe(RecoveryStrategy.FALLBACK);
  });

  it('should handle LLM errors with retry', async () => {
    const error = AppError.llmError('API failed');
    const result = await manager.handle(error);

    expect(result.handled).toBe(true);
    expect(result.shouldRetry).toBe(true);
  });

  it('should handle security errors with abort', async () => {
    const error = AppError.securityViolation('未授权访问');
    const result = await manager.handle(error);

    expect(result.strategy).toBe(RecoveryStrategy.ABORT);
  });

  it('should track error statistics', async () => {
    await manager.handle(AppError.llmError('Error 1'));
    await manager.handle(AppError.llmError('Error 2'));
    await manager.handle(AppError.networkError('Error 3'));

    const stats = manager.getStats();
    expect(stats.totalErrors).toBe(3);
    expect(stats.byCode[ErrorCode.LLM_ERROR]).toBe(2);
    expect(stats.byCode[ErrorCode.NETWORK_ERROR]).toBe(1);
  });

  it('should notify listeners', async () => {
    const listener = vi.fn();
    manager.addListener(listener);

    const error = AppError.llmError('Test error');
    await manager.handle(error);

    expect(listener).toHaveBeenCalledWith(error, expect.any(Object));
  });

  it('should wrap async functions', async () => {
    const fn = vi.fn().mockRejectedValue(AppError.llmError('Test error'));
    const fallback = vi.fn().mockReturnValue('fallback value');

    const result = await manager.wrapAsync(fn, fallback);

    expect(fallback).toHaveBeenCalled();
    expect(result).toBe('fallback value');
  });

  it('should retry with retry strategy', async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw AppError.llmError('Temporary error');
      }
      return Promise.resolve('success');
    });

    const result = await manager.withRetry(fn, 3, 10);

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should clear history', async () => {
    await manager.handle(AppError.llmError('Error'));
    manager.clearHistory();

    const stats = manager.getStats();
    expect(stats.totalErrors).toBe(0);
  });
});

describe('DegradationManager', () => {
  let manager: DegradationManager;

  beforeEach(() => {
    manager = new DegradationManager();
  });

  it('should start at normal level', () => {
    expect(manager.getLevel()).toBe(DegradationLevel.NORMAL);
  });

  it('should degrade to specified level', () => {
    manager.degrade(DegradationLevel.LIGHT, '测试降级');

    expect(manager.getLevel()).toBe(DegradationLevel.LIGHT);

    const config = manager.getConfig();
    expect(config.reason).toBe('测试降级');
    expect(config.disabledModules.length).toBeGreaterThan(0);
  });

  it('should not degrade to same level', () => {
    const listener = vi.fn();
    manager.addListener(listener);

    manager.degrade(DegradationLevel.NORMAL, 'should not trigger');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should check feature availability', () => {
    expect(manager.isFeatureEnabled('cache')).toBe(true);

    manager.degrade(DegradationLevel.MEDIUM, 'test');

    expect(manager.isFeatureEnabled('cache')).toBe(false);
    expect(manager.isFeatureEnabled('monitor')).toBe(false);
  });

  it('should recover to higher level', () => {
    manager.degrade(DegradationLevel.HEAVY, 'test');
    expect(manager.getLevel()).toBe(DegradationLevel.HEAVY);

    manager.recover(DegradationLevel.LIGHT);
    expect(manager.getLevel()).toBe(DegradationLevel.LIGHT);
  });

  it('should not recover to lower level', () => {
    manager.degrade(DegradationLevel.LIGHT, 'test');

    manager.recover(DegradationLevel.HEAVY);

    // Should still be at LIGHT level
    expect(manager.getLevel()).toBe(DegradationLevel.LIGHT);
  });

  it('should handle error codes', () => {
    manager.handleErrorCode('MEMORY_OVERFLOW');
    expect(manager.getLevel()).toBe(DegradationLevel.HEAVY);
  });

  it('should generate report', () => {
    manager.degrade(DegradationLevel.MEDIUM, '测试降级');

    const report = manager.getReport();

    expect(report.level).toBe(DegradationLevel.MEDIUM);
    expect(report.levelName).toBe('中度降级');
    expect(report.disabledFeatures.length).toBeGreaterThan(0);
    expect(report.reason).toBe('测试降级');
  });

  it('should notify listeners on degradation', () => {
    const listener = vi.fn();
    manager.addListener(listener);

    manager.degrade(DegradationLevel.LIGHT, 'test');

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      level: DegradationLevel.LIGHT,
    }));
  });
});
