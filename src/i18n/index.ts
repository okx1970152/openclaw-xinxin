/**
 * i18n 国际化模块
 * 支持中文和英文语言包
 */

import zhCN from './zh-CN.json';

// 语言包类型定义
export type Locale = 'zh-CN' | 'en-US';

// 所有语言包
const locales: Record<Locale, Record<string, unknown>> = {
  'zh-CN': zhCN,
  'en-US': {} as Record<string, unknown>, // 英文包待实现
};

// 当前语言
let currentLocale: Locale = 'zh-CN';

/**
 * 设置当前语言
 */
export function setLocale(locale: Locale): void {
  if (locales[locale]) {
    currentLocale = locale;
  } else {
    console.warn(`Locale ${locale} not available, fallback to zh-CN`);
    currentLocale = 'zh-CN';
  }
}

/**
 * 获取当前语言
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * 获取语言包
 */
export function getMessages(): Record<string, unknown> {
  return locales[currentLocale];
}

/**
 * 获取嵌套属性值
 * @param path 点分隔的路径，如 'commands.create_agent.success'
 * @param params 替换参数
 */
export function t(path: string, params?: Record<string, string | number>): string {
  const keys = path.split('.');
  let value: unknown = locales[currentLocale];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      // 路径不存在，返回路径本身作为 fallback
      return path;
    }
  }

  if (typeof value !== 'string') {
    return path;
  }

  // 替换参数
  if (params) {
    return Object.entries(params).reduce(
      (str, [key, val]) => str.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val)),
      value
    );
  }

  return value;
}

/**
 * 解析中文指令
 * @param input 用户输入
 * @returns 指令名称和参数
 */
export function parseChineseCommand(input: string): { command: string; params: Record<string, string> } | null {
  const messages = getMessages();
  const commands = messages.commands as Record<string, { command: string; params?: Record<string, string> }>;

  // 遍历所有指令寻找匹配
  for (const [cmdKey, cmdValue] of Object.entries(commands)) {
    if (input.startsWith(cmdValue.command)) {
      const paramStr = input.slice(cmdValue.command.length).trim();
      const params: Record<string, string> = {};

      // 解析参数（格式：参数名 参数值）
      if (cmdValue.params && paramStr) {
        const paramKeys = Object.keys(cmdValue.params);
        const parts = paramStr.split(/\s+/);

        for (let i = 0; i < parts.length; i += 2) {
          if (parts[i] && paramKeys.includes(parts[i])) {
            params[parts[i]] = parts[i + 1] || '';
          }
        }

        // 如果没有命名参数，尝试按顺序匹配
        if (Object.keys(params).length === 0 && parts.length > 0) {
          const paramKeys = Object.keys(cmdValue.params);
          for (let i = 0; i < parts.length && i < paramKeys.length; i++) {
            params[paramKeys[i]] = parts[i];
          }
        }
      }

      return { command: cmdKey, params };
    }
  }

  return null;
}

/**
 * 格式化错误信息
 */
export function formatError(errorCode: string, params?: Record<string, string | number>): string {
  return t(`errors.${errorCode}`, params);
}

/**
 * 格式化状态文本
 */
export function formatStatus(type: 'agent' | 'task' | 'priority', status: string): string {
  return t(`status.${type}.${status}`);
}

// 导出语言包
export { zhCN };
