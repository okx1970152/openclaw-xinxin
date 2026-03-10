/**
 * 超级大龙虾 - Telegram 适配器
 * Telegram Adapter
 * 
 * 存放于 src/telegram/adapter.ts
 * Telegram Bot 接口适配器
 */

import type { UnifiedMessage, Attachment } from '../types/core';

// ==================== Telegram 适配器接口 ====================

/**
 * Telegram 适配器接口
 * 技术设计文档 9.2 节定义
 */
export interface ITelegramAdapter {
  /**
   * 启动 Telegram Bot
   */
  start(): Promise<void>;

  /**
   * 停止 Telegram Bot
   */
  stop(): Promise<void>;

  /**
   * 发送消息
   */
  sendMessage(chatId: string | number, message: string, options?: SendMessageOptions): Promise<void>;

  /**
   * 发送确认请求
   */
  sendConfirmation(chatId: string | number, message: string, options?: ConfirmationOptions): Promise<void>;
}

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  /** 解析模式 */
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  /** 回复的消息ID */
  replyToMessageId?: number;
  /** 是否禁用通知 */
  disableNotification?: boolean;
  /** 内联键盘 */
  replyMarkup?: TelegramInlineKeyboard;
}

/**
 * 确认选项
 */
export interface ConfirmationOptions {
  /** 确认回调数据 */
  confirmCallback?: string;
  /** 取消回调数据 */
  cancelCallback?: string;
  /** 超时时间（秒） */
  timeout?: number;
}

/**
 * 内联键盘
 */
export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

/**
 * 内联键盘按钮
 */
export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

// ==================== Telegram 消息类型 ====================

/**
 * Telegram 更新类型
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * Telegram 消息
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  audio?: TelegramAudio;
  video?: TelegramVideo;
  reply_to_message?: TelegramMessage;
}

/**
 * Telegram 用户
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram 聊天
 */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram 回调查询
 */
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

/**
 * Telegram 图片尺寸
 */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Telegram 文档
 */
export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram 音频
 */
export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram 视频
 */
export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

// ==================== Telegram 适配器实现 ====================

/**
 * Telegram 适配器配置
 */
export interface TelegramAdapterConfig {
  /** Bot Token */
  token: string;
  /** Webhook URL（可选，不设置则使用轮询） */
  webhookUrl?: string;
  /** 轮询间隔（毫秒） */
  pollingInterval?: number;
  /** 允许的用户ID列表（空则允许所有） */
  allowedUserIds?: number[];
  /** 管理员用户ID列表 */
  adminUserIds?: number[];
}

/**
 * Telegram 适配器实现
 */
export class TelegramAdapter implements ITelegramAdapter {
  private config: TelegramAdapterConfig;
  private running = false;
  private pollingInterval?: NodeJS.Timeout;
  private lastUpdateId = 0;
  private onMessageCallback?: (message: UnifiedMessage) => Promise<string>;
  private onCallbackCallback?: (callback: TelegramCallbackQuery) => Promise<void>;

  constructor(config: TelegramAdapterConfig) {
    this.config = config;
  }

  /**
   * 设置消息处理回调
   */
  setMessageHandler(handler: (message: UnifiedMessage) => Promise<string>): void {
    this.onMessageCallback = handler;
  }

  /**
   * 设置回调处理
   */
  setCallbackHandler(handler: (callback: TelegramCallbackQuery) => Promise<void>): void {
    this.onCallbackCallback = handler;
  }

  /**
   * 启动 Bot
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    console.log('[TelegramAdapter] 启动 Telegram Bot...');

    // 验证 Token
    const me = await this.callApi('getMe');
    if (!me.ok) {
      throw new Error(`Telegram Bot Token 验证失败: ${me.description}`);
    }

    console.log(`[TelegramAdapter] Bot 已连接: @${me.result.username}`);

    // 设置 Webhook 或开始轮询
    if (this.config.webhookUrl) {
      await this.setupWebhook(this.config.webhookUrl);
    } else {
      this.startPolling();
    }
  }

  /**
   * 停止 Bot
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    console.log('[TelegramAdapter] Bot 已停止');
  }

  /**
   * 发送消息
   */
  async sendMessage(
    chatId: string | number,
    message: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const params: Record<string, unknown> = {
      chat_id: chatId,
      text: message,
    };

    if (options?.parseMode) {
      params.parse_mode = options.parseMode;
    }
    if (options?.replyToMessageId) {
      params.reply_to_message_id = options.replyToMessageId;
    }
    if (options?.disableNotification) {
      params.disable_notification = options.disableNotification;
    }
    if (options?.replyMarkup) {
      params.reply_markup = JSON.stringify(options.replyMarkup);
    }

    const result = await this.callApi('sendMessage', params);
    if (!result.ok) {
      console.error('[TelegramAdapter] 发送消息失败:', result.description);
    }
  }

  /**
   * 发送确认请求
   */
  async sendConfirmation(
    chatId: string | number,
    message: string,
    options?: ConfirmationOptions
  ): Promise<void> {
    const keyboard: TelegramInlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '✅ 确认',
            callback_data: options?.confirmCallback || 'confirm_yes',
          },
          {
            text: '❌ 取消',
            callback_data: options?.cancelCallback || 'confirm_no',
          },
        ],
      ],
    };

    await this.sendMessage(chatId, message, {
      replyMarkup: keyboard,
    });
  }

  /**
   * #13 修复：带回调函数的确认发送
   * 符合技术设计文档 9.2 节签名要求
   */
  async sendConfirmationWithCallbacks(
    chatId: string | number,
    message: string,
    onConfirm: () => Promise<void>,
    onReject: () => Promise<void>,
    timeout: number = 60
  ): Promise<void> {
    const confirmId = `confirm_${Date.now()}`;
    const cancelId = `cancel_${Date.now()}`;
    
    // 注册回调处理器
    const originalHandler = this.onCallbackCallback;
    
    this.setCallbackHandler(async (callback: TelegramCallbackQuery) => {
      if (callback.data === confirmId) {
        await onConfirm();
        // 恢复原始处理器
        if (originalHandler) {
          this.setCallbackHandler(originalHandler);
        }
      } else if (callback.data === cancelId) {
        await onReject();
        // 恢复原始处理器
        if (originalHandler) {
          this.setCallbackHandler(originalHandler);
        }
      } else if (originalHandler) {
        await originalHandler(callback);
      }
    });
    
    await this.sendConfirmation(chatId, message, {
      confirmCallback: confirmId,
      cancelCallback: cancelId,
      timeout,
    });
    
    // 超时自动清理
    setTimeout(() => {
      // 恢复原始处理器
      if (originalHandler) {
        this.setCallbackHandler(originalHandler);
      }
    }, timeout * 1000);
  }

  // ===== 私有方法 =====

  /**
   * 设置 Webhook
   */
  private async setupWebhook(url: string): Promise<void> {
    const result = await this.callApi('setWebhook', { url });
    if (!result.ok) {
      throw new Error(`设置 Webhook 失败: ${result.description}`);
    }
    console.log(`[TelegramAdapter] Webhook 已设置: ${url}`);
  }

  /**
   * 开始轮询
   */
  private startPolling(): void {
    console.log('[TelegramAdapter] 开始轮询更新...');

    const poll = async () => {
      if (!this.running) return;

      try {
        const updates = await this.getUpdates(this.lastUpdateId + 1);
        
        for (const update of updates) {
          this.lastUpdateId = update.update_id;
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.error('[TelegramAdapter] 轮询错误:', error);
      }
    };

    // 立即执行一次
    poll();

    // 设置定时轮询
    const interval = this.config.pollingInterval || 1000;
    this.pollingInterval = setInterval(poll, interval);
  }

  /**
   * 获取更新
   */
  private async getUpdates(offset: number): Promise<TelegramUpdate[]> {
    const result = await this.callApi('getUpdates', {
      offset,
      timeout: 0,
      limit: 100,
    });

    return result.ok ? result.result : [];
  }

  /**
   * 处理更新
   */
  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    // 处理回调查询
    if (update.callback_query) {
      if (this.onCallbackCallback) {
        await this.onCallbackCallback(update.callback_query);
      }
      return;
    }

    // 处理消息
    if (update.message) {
      const message = update.message;

      // 检查用户权限
      if (this.config.allowedUserIds && this.config.allowedUserIds.length > 0) {
        if (!message.from || !this.config.allowedUserIds.includes(message.from.id)) {
          console.log(`[TelegramAdapter] 拒绝非授权用户: ${message.from?.id}`);
          return;
        }
      }

      // 转换为统一消息格式
      const unifiedMessage = this.toUnifiedMessage(message);

      // 调用消息处理回调
      if (this.onMessageCallback) {
        try {
          const response = await this.onMessageCallback(unifiedMessage);
          await this.sendMessage(message.chat.id, response);
        } catch (error) {
          console.error('[TelegramAdapter] 处理消息错误:', error);
          await this.sendMessage(message.chat.id, '处理消息时发生错误，请稍后重试。');
        }
      }
    }
  }

  /**
   * 调用 Telegram API
   */
  private async callApi(
    method: string,
    params?: Record<string, unknown>
  ): Promise<{ ok: boolean; result?: unknown; description?: string }> {
    const url = `https://api.telegram.org/bot${this.config.token}/${method}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: params ? JSON.stringify(params) : undefined,
      });

      return await response.json() as { ok: boolean; result?: unknown; description?: string };
    } catch (error) {
      return {
        ok: false,
        description: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 转换为统一消息格式
   */
  private toUnifiedMessage(message: TelegramMessage): UnifiedMessage {
    const attachments: Attachment[] = [];

    // 处理图片
    if (message.photo && message.photo.length > 0) {
      const largest = message.photo[message.photo.length - 1];
      attachments.push({
        type: 'image',
        path: largest.file_id,
        mime_type: 'image/jpeg',
        size_bytes: largest.file_size || 0,
      });
    }

    // 处理文档
    if (message.document) {
      attachments.push({
        type: 'file',
        path: message.document.file_id,
        mime_type: message.document.mime_type || 'application/octet-stream',
        size_bytes: message.document.file_size || 0,
      });
    }

    // 处理音频
    if (message.audio) {
      attachments.push({
        type: 'audio',
        path: message.audio.file_id,
        mime_type: message.audio.mime_type || 'audio/mpeg',
        size_bytes: message.audio.file_size || 0,
      });
    }

    // 处理视频
    if (message.video) {
      attachments.push({
        type: 'video',
        path: message.video.file_id,
        mime_type: message.video.mime_type || 'video/mp4',
        size_bytes: message.video.file_size || 0,
      });
    }

    return {
      source: 'telegram',
      user_id: message.from?.id.toString() || 'unknown',
      content: message.text || message.caption || '',
      timestamp: new Date(message.date * 1000).toISOString(),
      attachments,
      message_id: message.message_id.toString(),
      thread_id: message.chat.id.toString(),
    };
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 Telegram 适配器实例
 */
export function createTelegramAdapter(config: TelegramAdapterConfig): ITelegramAdapter {
  return new TelegramAdapter(config);
}

export default TelegramAdapter;
