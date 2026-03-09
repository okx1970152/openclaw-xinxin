/**
 * 超级大龙虾 - 错误处理模块
 * Error Handling Module
 * 
 * 存放于 src/error-handling/index.ts
 */

// 类型导出
export {
  ErrorCode,
  ErrorSeverity,
  RecoveryStrategy,
} from './types';

export type {
  AppErrorOptions,
  ErrorHandlingResult,
  IErrorHandler,
  ErrorStats,
  ErrorListener,
} from './types';

// 错误类导出
export { AppError, isAppError, toAppError } from './app-error';

// 错误管理器导出
export { ErrorManager, getErrorManager, createErrorManager } from './error-manager';

// 降级管理器导出
export {
  DegradationManager,
  DegradationLevel,
  getDegradationManager,
  createDegradationManager,
} from './degradation';

export type {
  DegradationConfig,
  FeatureModule,
} from './degradation';

// 默认导出
import { ErrorManager } from './error-manager';
export default ErrorManager;
