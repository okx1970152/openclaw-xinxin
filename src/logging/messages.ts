/**
 * 中文日志消息
 * Chinese Log Messages
 *
 * 定义所有日志消息的中文模板
 */

// ==================== 日志分类 ====================

/** 日志分类类型 */
export type LogCategory =
  | 'master'     // 主代理
  | 'agent'      // 子代理
  | 'memory'     // 记忆系统
  | 'task'       // 任务队列
  | 'security'   // 安全审查
  | 'gateway'    // 网关
  | 'system'     // 系统
  | 'cli'        // 命令行
  | 'telegram';  // Telegram

// ==================== 消息模板 ====================

/** 消息模板定义 */
export interface MessageTemplate {
  /** 消息键 */
  key: string;
  /** 中文模板 */
  zh: string;
  /** 英文模板 */
  en: string;
  /** 分类 */
  category: LogCategory;
}

/** 消息模板库 */
const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // ========== 主代理 ==========
  {
    key: 'master.start',
    zh: '主代理启动中...',
    en: 'Master agent starting...',
    category: 'master',
  },
  {
    key: 'master.ready',
    zh: '主代理就绪，等待指令',
    en: 'Master agent ready, waiting for commands',
    category: 'master',
  },
  {
    key: 'master.command_received',
    zh: '收到指令: {command}',
    en: 'Command received: {command}',
    category: 'master',
  },
  {
    key: 'master.routing',
    zh: '正在路由任务到子代理: {agentId}',
    en: 'Routing task to agent: {agentId}',
    category: 'master',
  },
  {
    key: 'master.routing_failed',
    zh: '任务路由失败，无可用子代理',
    en: 'Task routing failed, no available agent',
    category: 'master',
  },
  {
    key: 'master.pattern_matched',
    zh: '匹配到任务模式: {patternId}',
    en: 'Task pattern matched: {patternId}',
    category: 'master',
  },

  // ========== 子代理 ==========
  {
    key: 'agent.created',
    zh: '子代理已创建: {agentId} ({domain})',
    en: 'Agent created: {agentId} ({domain})',
    category: 'agent',
  },
  {
    key: 'agent.destroyed',
    zh: '子代理已销毁: {agentId}',
    en: 'Agent destroyed: {agentId}',
    category: 'agent',
  },
  {
    key: 'agent.activated',
    zh: '子代理已激活: {agentId}',
    en: 'Agent activated: {agentId}',
    category: 'agent',
  },
  {
    key: 'agent.hibernated',
    zh: '子代理已休眠: {agentId}',
    en: 'Agent hibernated: {agentId}',
    category: 'agent',
  },
  {
    key: 'agent.task_started',
    zh: '子代理 {agentId} 开始执行任务: {taskId}',
    en: 'Agent {agentId} started task: {taskId}',
    category: 'agent',
  },
  {
    key: 'agent.task_completed',
    zh: '子代理 {agentId} 完成任务: {taskId}，耗时 {duration}ms',
    en: 'Agent {agentId} completed task: {taskId}, duration: {duration}ms',
    category: 'agent',
  },
  {
    key: 'agent.task_failed',
    zh: '子代理 {agentId} 任务失败: {taskId}，原因: {reason}',
    en: 'Agent {agentId} task failed: {taskId}, reason: {reason}',
    category: 'agent',
  },
  {
    key: 'agent.cloned',
    zh: '子代理已克隆: {sourceId} -> {newId}',
    en: 'Agent cloned: {sourceId} -> {newId}',
    category: 'agent',
  },

  // ========== 记忆系统 ==========
  {
    key: 'memory.write',
    zh: '写入{type}记忆: {entryId}',
    en: 'Writing {type} memory: {entryId}',
    category: 'memory',
  },
  {
    key: 'memory.read',
    zh: '读取{type}记忆: {count} 条',
    en: 'Reading {type} memory: {count} entries',
    category: 'memory',
  },
  {
    key: 'memory.refine_start',
    zh: '开始记忆提练...',
    en: 'Starting memory refinement...',
    category: 'memory',
  },
  {
    key: 'memory.refine_complete',
    zh: '记忆提练完成，新增 {count} 条永久记忆',
    en: 'Memory refinement complete, {count} permanent memories added',
    category: 'memory',
  },
  {
    key: 'memory.refine_failed',
    zh: '记忆提练失败: {reason}',
    en: 'Memory refinement failed: {reason}',
    category: 'memory',
  },
  {
    key: 'memory.validation_passed',
    zh: '记忆验证通过',
    en: 'Memory validation passed',
    category: 'memory',
  },
  {
    key: 'memory.validation_failed',
    zh: '记忆验证失败: {check}',
    en: 'Memory validation failed: {check}',
    category: 'memory',
  },
  {
    key: 'memory.search',
    zh: '搜索记忆: "{query}"，找到 {count} 条结果',
    en: 'Searching memory: "{query}", found {count} results',
    category: 'memory',
  },
  {
    key: 'memory.index_rebuilt',
    zh: '索引重建完成，共 {count} 个文件',
    en: 'Index rebuilt, {count} files indexed',
    category: 'memory',
  },
  {
    key: 'memory.overflow',
    zh: '记忆文件超出限制 ({size}/{limit})',
    en: 'Memory file exceeds limit ({size}/{limit})',
    category: 'memory',
  },

  // ========== 任务队列 ==========
  {
    key: 'task.enqueued',
    zh: '任务已入队: {taskId}，优先级: {priority}',
    en: 'Task enqueued: {taskId}, priority: {priority}',
    category: 'task',
  },
  {
    key: 'task.started',
    zh: '任务开始执行: {taskId}',
    en: 'Task started: {taskId}',
    category: 'task',
  },
  {
    key: 'task.completed',
    zh: '任务完成: {taskId}，Token 消耗: {tokens}',
    en: 'Task completed: {taskId}, tokens used: {tokens}',
    category: 'task',
  },
  {
    key: 'task.failed',
    zh: '任务失败: {taskId}，错误: {error}',
    en: 'Task failed: {taskId}, error: {error}',
    category: 'task',
  },
  {
    key: 'task.retry',
    zh: '任务重试: {taskId}，第 {attempt} 次',
    en: 'Task retry: {taskId}, attempt {attempt}',
    category: 'task',
  },
  {
    key: 'task.timeout',
    zh: '任务超时: {taskId}，超时时间: {timeout}ms',
    en: 'Task timeout: {taskId}, timeout: {timeout}ms',
    category: 'task',
  },

  // ========== 安全审查 ==========
  {
    key: 'security.audit_start',
    zh: '开始安全审查: {skillName}',
    en: 'Starting security audit: {skillName}',
    category: 'security',
  },
  {
    key: 'security.audit_passed',
    zh: '安全审查通过: {skillName}',
    en: 'Security audit passed: {skillName}',
    category: 'security',
  },
  {
    key: 'security.audit_failed',
    zh: '安全审查失败: {skillName}，风险等级: {riskLevel}',
    en: 'Security audit failed: {skillName}, risk level: {riskLevel}',
    category: 'security',
  },
  {
    key: 'security.layer_check',
    zh: '层级 {layer} 检查: {check} - {result}',
    en: 'Layer {layer} check: {check} - {result}',
    category: 'security',
  },
  {
    key: 'security.dangerous_command',
    zh: '检测到危险命令: {command}',
    en: 'Dangerous command detected: {command}',
    category: 'security',
  },
  {
    key: 'security.injection_attempt',
    zh: '检测到 Prompt 注入尝试',
    en: 'Prompt injection attempt detected',
    category: 'security',
  },

  // ========== 网关 ==========
  {
    key: 'gateway.start',
    zh: '网关服务启动中，端口: {port}',
    en: 'Gateway service starting on port: {port}',
    category: 'gateway',
  },
  {
    key: 'gateway.ready',
    zh: '网关服务就绪',
    en: 'Gateway service ready',
    category: 'gateway',
  },
  {
    key: 'gateway.connection',
    zh: '新连接: {clientId}',
    en: 'New connection: {clientId}',
    category: 'gateway',
  },
  {
    key: 'gateway.disconnection',
    zh: '连接断开: {clientId}',
    en: 'Connection closed: {clientId}',
    category: 'gateway',
  },
  {
    key: 'gateway.auth_success',
    zh: '认证成功: {userId}',
    en: 'Authentication successful: {userId}',
    category: 'gateway',
  },
  {
    key: 'gateway.auth_failed',
    zh: '认证失败: {reason}',
    en: 'Authentication failed: {reason}',
    category: 'gateway',
  },
  {
    key: 'gateway.rate_limit',
    zh: '请求限流: {clientId}，超过 {limit} 次/分钟',
    en: 'Rate limited: {clientId}, exceeded {limit} requests/min',
    category: 'gateway',
  },

  // ========== 系统 ==========
  {
    key: 'system.start',
    zh: '系统启动中...',
    en: 'System starting...',
    category: 'system',
  },
  {
    key: 'system.ready',
    zh: '系统就绪',
    en: 'System ready',
    category: 'system',
  },
  {
    key: 'system.shutdown',
    zh: '系统关闭中...',
    en: 'System shutting down...',
    category: 'system',
  },
  {
    key: 'system.error',
    zh: '系统错误: {error}',
    en: 'System error: {error}',
    category: 'system',
  },
  {
    key: 'system.config_loaded',
    zh: '配置已加载: {configFile}',
    en: 'Configuration loaded: {configFile}',
    category: 'system',
  },
  {
    key: 'system.config_error',
    zh: '配置加载失败: {reason}',
    en: 'Configuration load failed: {reason}',
    category: 'system',
  },

  // ========== CLI ==========
  {
    key: 'cli.start',
    zh: 'CLI 启动中...',
    en: 'CLI starting...',
    category: 'cli',
  },
  {
    key: 'cli.command',
    zh: '执行命令: {command}',
    en: 'Executing command: {command}',
    category: 'cli',
  },
  {
    key: 'cli.unknown_command',
    zh: '未知命令: {command}',
    en: 'Unknown command: {command}',
    category: 'cli',
  },
  {
    key: 'cli.exit',
    zh: 'CLI 退出',
    en: 'CLI exited',
    category: 'cli',
  },

  // ========== Telegram ==========
  {
    key: 'telegram.start',
    zh: 'Telegram Bot 启动中...',
    en: 'Telegram Bot starting...',
    category: 'telegram',
  },
  {
    key: 'telegram.message',
    zh: '收到消息: 用户 {userId}，内容: {content}',
    en: 'Message received: user {userId}, content: {content}',
    category: 'telegram',
  },
  {
    key: 'telegram.sent',
    zh: '发送消息到 {chatId}: {content}',
    en: 'Message sent to {chatId}: {content}',
    category: 'telegram',
  },
  {
    key: 'telegram.error',
    zh: 'Telegram 错误: {error}',
    en: 'Telegram error: {error}',
    category: 'telegram',
  },
];

// ==================== 消息查找和格式化 ====================

/** 消息模板映射 */
const messageMap = new Map<string, MessageTemplate>();

// 初始化消息映射
for (const template of MESSAGE_TEMPLATES) {
  messageMap.set(template.key, template);
}

/**
 * 获取消息模板
 */
export function getMessage(
  key: string,
  category: LogCategory,
  params?: Record<string, string | number>,
  useChinese: boolean = true
): string {
  const template = messageMap.get(key);
  
  if (!template) {
    // 如果找不到模板，返回格式化的键
    return `[${category}] ${key}`;
  }
  
  let message = useChinese ? template.zh : template.en;
  
  // 替换参数
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      message = message.replace(`{${paramKey}}`, String(paramValue));
    }
  }
  
  return message;
}

/**
 * 格式化消息
 * 为消息添加分类前缀
 */
export function formatMessage(message: string, category: LogCategory): string {
  const categoryNames: Record<LogCategory, string> = {
    master: '主代理',
    agent: '子代理',
    memory: '记忆',
    task: '任务',
    security: '安全',
    gateway: '网关',
    system: '系统',
    cli: '命令行',
    telegram: 'Telegram',
  };
  
  return `[${categoryNames[category]}] ${message}`;
}

/**
 * 获取所有消息模板
 */
export function getAllTemplates(): MessageTemplate[] {
  return [...MESSAGE_TEMPLATES];
}

/**
 * 获取指定分类的消息模板
 */
export function getTemplatesByCategory(category: LogCategory): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter((t) => t.category === category);
}
