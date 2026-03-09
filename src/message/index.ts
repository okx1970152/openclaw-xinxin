/**
 * 超级大龙虾 - 统一消息格式工具
 * Unified Message Utilities
 * 
 * 存放于 src/message/index.ts
 * 用于将不同平台的消息转换为统一格式
 */

import type { UnifiedMessage, Attachment, MessageSource } from '../types/core';

/**
 * 消息构建器
 */
export class MessageBuilder {
  private source: MessageSource = 'cli';
  private userId: string = 'default_user';
  private content: string = '';
  private timestamp: string = new Date().toISOString();
  private attachments: Attachment[] = [];
  private messageId?: string;
  private threadId?: string;

  /**
   * 设置来源
   */
  setSource(source: MessageSource): this {
    this.source = source;
    return this;
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string): this {
    this.userId = userId;
    return this;
  }

  /**
   * 设置内容
   */
  setContent(content: string): this {
    this.content = content;
    return this;
  }

  /**
   * 设置时间戳
   */
  setTimestamp(timestamp: string): this {
    this.timestamp = timestamp;
    return this;
  }

  /**
   * 添加附件
   */
  addAttachment(attachment: Attachment): this {
    this.attachments.push(attachment);
    return this;
  }

  /**
   * 设置附件列表
   */
  setAttachments(attachments: Attachment[]): this {
    this.attachments = attachments;
    return this;
  }

  /**
   * 设置消息ID
   */
  setMessageId(messageId: string): this {
    this.messageId = messageId;
    return this;
  }

  /**
   * 设置线程ID
   */
  setThreadId(threadId: string): this {
    this.threadId = threadId;
    return this;
  }

  /**
   * 构建消息
   */
  build(): UnifiedMessage {
    const message: UnifiedMessage = {
      source: this.source,
      user_id: this.userId,
      content: this.content,
      timestamp: this.timestamp,
      attachments: this.attachments,
    };

    if (this.messageId) {
      message.message_id = this.messageId;
    }

    if (this.threadId) {
      message.thread_id = this.threadId;
    }

    return message;
  }
}

/**
 * 从 CLI 输入创建消息
 */
export function createCliMessage(input: string, userId: string = 'cli_user'): UnifiedMessage {
  return new MessageBuilder()
    .setSource('cli')
    .setUserId(userId)
    .setContent(input)
    .build();
}

/**
 * 从 Telegram 消息创建统一消息
 */
export function createTelegramMessage(
  telegramMessage: {
    message_id: number;
    from?: { id: number; username?: string };
    chat: { id: number };
    text?: string;
    date: number;
  }
): UnifiedMessage {
  const builder = new MessageBuilder()
    .setSource('telegram')
    .setUserId(telegramMessage.from?.id?.toString() || 'unknown')
    .setContent(telegramMessage.text || '')
    .setTimestamp(new Date(telegramMessage.date * 1000).toISOString())
    .setMessageId(telegramMessage.message_id.toString())
    .setThreadId(telegramMessage.chat.id.toString());

  return builder.build();
}

/**
 * 解析中文指令
 */
export function parseChineseCommand(content: string): ParsedCommand | null {
  const trimmed = content.trim();
  
  // 中文指令映射表
  const commandMap: Record<string, string> = {
    '创建代理': 'create_agent',
    '克隆代理': 'clone_agent',
    '查看状态': 'show_status',
    '提练记忆': 'refine_memory',
    '重建索引': 'rebuild_index',
    '安装技能': 'install_skill',
    '卸载技能': 'uninstall_skill',
    '重新提练': 'retry_refine',
    '查看代理': 'list_agents',
    '删除代理': 'destroy_agent',
    '休眠代理': 'hibernate_agent',
    '激活代理': 'activate_agent',
    '帮助': 'help',
    '版本': 'version',
  };

  // 检查是否是指令格式（以 / 开头）
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // 提取指令部分
  const parts = trimmed.slice(1).split(/\s+/);
  const commandPart = parts[0];
  const args = parts.slice(1).join(' ');

  // 尝试匹配中文指令
  if (commandMap[commandPart]) {
    return {
      command: commandMap[commandPart],
      rawCommand: commandPart,
      args: args,
      isChinese: true,
    };
  }

  // 英文指令
  return {
    command: commandPart.toLowerCase(),
    rawCommand: commandPart,
    args: args,
    isChinese: false,
  };
}

/**
 * 解析后的指令
 */
export interface ParsedCommand {
  /** 标准化的指令名 */
  command: string;
  /** 原始指令 */
  rawCommand: string;
  /** 指令参数 */
  args: string;
  /** 是否是中文指令 */
  isChinese: boolean;
}

/**
 * 格式化响应消息
 */
export function formatResponse(
  content: string,
  options?: {
    prefix?: string;
    includeTimestamp?: boolean;
  }
): string {
  let response = content;
  
  if (options?.prefix) {
    response = `${options.prefix}\n${response}`;
  }
  
  if (options?.includeTimestamp) {
    const timestamp = new Date().toLocaleString('zh-CN');
    response = `[${timestamp}]\n${response}`;
  }
  
  return response;
}

/**
 * 创建错误响应
 */
export function createErrorResponse(error: Error | string, code?: string): string {
  const message = error instanceof Error ? error.message : error;
  const prefix = code ? `[错误 ${code}]` : '[错误]';
  return `${prefix} ${message}`;
}

export default {
  MessageBuilder,
  createCliMessage,
  createTelegramMessage,
  parseChineseCommand,
  formatResponse,
  createErrorResponse,
};
