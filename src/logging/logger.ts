/**
 * 日志记录器
 * Logger Implementation
 */

import { formatMessage, getMessage, type LogCategory } from './messages';

// ==================== 类型定义 ====================

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** 日志条目 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: string;
  /** 日志级别 */
  level: LogLevel;
  /** 日志分类 */
  category: LogCategory;
  /** 消息内容 */
  message: string;
  /** 附加数据 */
  data?: Record<string, unknown>;
  /** 错误堆栈 */
  stack?: string;
}

/** 日志配置 */
export interface LoggerConfig {
  /** 最小日志级别 */
  minLevel: LogLevel;
  /** 是否输出到控制台 */
  console: boolean;
  /** 是否输出到文件 */
  file: boolean;
  /** 日志文件路径 */
  filePath?: string;
  /** 是否使用中文 */
  useChinese: boolean;
  /** 时间戳格式 */
  timestampFormat: 'iso' | 'locale' | 'unix';
}

// ==================== 日志级别优先级 ====================

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  console: true,
  file: false,
  useChinese: true,
  timestampFormat: 'locale',
};

// ==================== Logger 类 ====================

/**
 * 中文化日志记录器
 */
export class Logger {
  private config: LoggerConfig;
  private category: LogCategory;

  constructor(category: LogCategory, config: Partial<LoggerConfig> = {}) {
    this.category = category;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 调试日志
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * 信息日志
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * 警告日志
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const entry: LogEntry = this.createEntry('error', message, data);
    
    if (error instanceof Error) {
      entry.stack = error.stack;
      entry.data = { ...entry.data, errorName: error.name, errorMessage: error.message };
    } else if (error !== undefined) {
      entry.data = { ...entry.data, error };
    }
    
    this.output(entry);
  }

  /**
   * 致命错误日志
   */
  fatal(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const entry: LogEntry = this.createEntry('fatal', message, data);
    
    if (error instanceof Error) {
      entry.stack = error.stack;
      entry.data = { ...entry.data, errorName: error.name, errorMessage: error.message };
    } else if (error !== undefined) {
      entry.data = { ...entry.data, error };
    }
    
    this.output(entry);
  }

  /**
   * 使用消息模板
   */
  template(key: string, params?: Record<string, string | number>, level: LogLevel = 'info'): void {
    const message = getMessage(key, this.category, params);
    this.log(level, message);
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.minLevel]) {
      return;
    }
    
    const entry = this.createEntry(level, message, data);
    this.output(entry);
  }

  /**
   * 创建日志条目
   */
  private createEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
    return {
      timestamp: this.getTimestamp(),
      level,
      category: this.category,
      message: formatMessage(message, this.category),
      data,
    };
  }

  /**
   * 获取时间戳
   */
  private getTimestamp(): string {
    switch (this.config.timestampFormat) {
      case 'iso':
        return new Date().toISOString();
      case 'unix':
        return Math.floor(Date.now() / 1000).toString();
      case 'locale':
      default:
        return new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
    }
  }

  /**
   * 输出日志
   */
  private output(entry: LogEntry): void {
    if (this.config.console) {
      this.outputToConsole(entry);
    }
    
    if (this.config.file && this.config.filePath) {
      this.outputToFile(entry);
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    const levelColors: Record<LogLevel, string> = {
      debug: '\x1b[36m',  // 青色
      info: '\x1b[32m',   // 绿色
      warn: '\x1b[33m',   // 黄色
      error: '\x1b[31m',  // 红色
      fatal: '\x1b[35m',  // 紫色
    };
    
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';
    
    const levelTag = `${levelColors[entry.level]}${bold}[${entry.level.toUpperCase().padEnd(5)}]${reset}`;
    const categoryTag = `\x1b[34m[${entry.category}]${reset}`;
    const timestamp = `\x1b[90m${entry.timestamp}${reset}`;
    
    let output = `${timestamp} ${levelTag} ${categoryTag} ${entry.message}`;
    
    if (entry.data && Object.keys(entry.data).length > 0) {
      output += `\n  数据: ${JSON.stringify(entry.data, null, 2).split('\n').join('\n  ')}`;
    }
    
    if (entry.stack) {
      output += `\n  堆栈: ${entry.stack.split('\n').join('\n  ')}`;
    }
    
    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  /**
   * 输出到文件
   */
  private outputToFile(entry: LogEntry): void {
    // 文件输出使用 JSON 格式
    const line = JSON.stringify(entry) + '\n';
    
    // 异步写入文件（不阻塞主线程）
    import('fs/promises').then((fs) => {
      if (this.config.filePath) {
        fs.appendFile(this.config.filePath, line).catch(() => {
          // 忽略写入错误，避免循环日志
        });
      }
    });
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 创建子日志记录器
   */
  child(subCategory: string): Logger {
    return new Logger(`${this.category}:${subCategory}` as LogCategory, this.config);
  }
}

// ==================== 日志管理器 ====================

/**
 * 日志管理器
 * 管理多个分类的日志记录器
 */
export class LogManager {
  private static instance: LogManager;
  private loggers: Map<LogCategory, Logger> = new Map();
  private globalConfig: LoggerConfig;

  private constructor(config: Partial<LoggerConfig> = {}) {
    this.globalConfig = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: Partial<LoggerConfig>): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager(config);
    }
    return LogManager.instance;
  }

  /**
   * 获取指定分类的日志记录器
   */
  getLogger(category: LogCategory): Logger {
    if (!this.loggers.has(category)) {
      this.loggers.set(category, new Logger(category, this.globalConfig));
    }
    return this.loggers.get(category)!;
  }

  /**
   * 更新全局配置
   */
  updateGlobalConfig(config: Partial<LoggerConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    
    // 更新所有现有日志记录器的配置
    for (const logger of this.loggers.values()) {
      logger.updateConfig(this.globalConfig);
    }
  }

  /**
   * 获取全局配置
   */
  getGlobalConfig(): LoggerConfig {
    return { ...this.globalConfig };
  }
}

// ==================== 便捷工厂函数 ====================

/**
 * 创建日志记录器
 */
export function createLogger(category: LogCategory, config?: Partial<LoggerConfig>): Logger {
  return new Logger(category, config);
}

/**
 * 获取全局日志记录器
 */
export function getLogger(category: LogCategory): Logger {
  return LogManager.getInstance().getLogger(category);
}

// ==================== 预定义日志记录器 ====================

/** 主代理日志 */
export const masterLogger = getLogger('master');

/** 子代理日志 */
export const agentLogger = getLogger('agent');

/** 记忆系统日志 */
export const memoryLogger = getLogger('memory');

/** 任务队列日志 */
export const taskLogger = getLogger('task');

/** 安全审查日志 */
export const securityLogger = getLogger('security');

/** 网关日志 */
export const gatewayLogger = getLogger('gateway');

/** 系统日志 */
export const systemLogger = getLogger('system');
