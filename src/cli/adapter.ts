/**
 * 超级大龙虾 - CLI 适配器
 * CLI Adapter
 * 
 * 存放于 src/cli/adapter.ts
 * 命令行接口适配器，支持中文指令映射
 */

import * as readline from 'readline';
import type { UnifiedMessage, Attachment } from '../types/core';

// ==================== 中文指令映射表 ====================

/**
 * 中文指令映射表
 * 技术设计文档 9.1 节定义
 * #12 修复：补全缺失的4个指令
 */
export const COMMAND_MAP: Record<string, string> = {
  // 子代理管理
  '创建代理': 'create_agent',
  '销毁代理': 'destroy_agent',
  '克隆代理': 'clone_agent',
  '查看代理': 'list_agents',
  
  // 任务执行
  '执行任务': 'execute_task',
  '取消任务': 'cancel_task',
  
  // 记忆管理
  '搜索记忆': 'search_memory',
  '提炼记忆': 'refine_memory',
  
  // #12 新增指令
  '查看状态': 'show_status',
  '重建索引': 'rebuild_index',
  '安装Skill': 'install_skill',
  '重新提练': 'retry_refine',
};

/**
 * 指令别名映射
 * #12 修复：添加新指令的别名
 */
export const COMMAND_ALIASES: Record<string, string> = {
  // 创建代理别名
  '新建代理': '创建代理',
  '添加代理': '创建代理',
  '创建子代理': '创建代理',
  
  // 销毁代理别名
  '删除代理': '销毁代理',
  '移除代理': '销毁代理',
  
  // 克隆代理别名
  '复制代理': '克隆代理',
  
  // 查看代理别名
  '列出代理': '查看代理',
  '显示代理': '查看代理',
  '代理列表': '查看代理',
  
  // 执行任务别名
  '运行任务': '执行任务',
  '开始任务': '执行任务',
  '执行': '执行任务',
  
  // 取消任务别名
  '停止任务': '取消任务',
  '终止任务': '取消任务',
  
  // 搜索记忆别名
  '查找记忆': '搜索记忆',
  '查询记忆': '搜索记忆',
  '搜索': '搜索记忆',
  
  // 提炼记忆别名
  '提练记忆': '提炼记忆',
  '整理记忆': '提炼记忆',
  '提炼': '提炼记忆',
  
  // #12 新增指令别名
  '状态': '查看状态',
  '显示状态': '查看状态',
  '系统状态': '查看状态',
  
  '重建': '重建索引',
  '重置索引': '重建索引',
  '索引重建': '重建索引',
  
  '安装技能': '安装Skill',
  '安装skill': '安装Skill',
  '安装插件': '安装Skill',
  
  '重试提练': '重新提练',
  '再次提练': '重新提练',
};

/**
 * 指令帮助文本
 * #12 修复：添加新指令帮助
 */
export const COMMAND_HELP: Record<string, string> = {
  'create_agent': '创建新的子代理\n用法: 创建代理 [模板ID] [代理名称]',
  'destroy_agent': '销毁指定的子代理\n用法: 销毁代理 [代理ID]',
  'clone_agent': '克隆现有子代理\n用法: 克隆代理 [源代理ID]',
  'list_agents': '列出所有子代理\n用法: 查看代理',
  'execute_task': '执行任务\n用法: 执行任务 [任务描述]',
  'cancel_task': '取消正在执行的任务\n用法: 取消任务 [任务ID]',
  'search_memory': '搜索永久记忆\n用法: 搜索记忆 [关键词]',
  'refine_memory': '提炼临时记忆到永久记忆\n用法: 提炼记忆',
  // #12 新增帮助
  'show_status': '查看系统状态\n用法: 查看状态',
  'rebuild_index': '重建记忆索引\n用法: 重建索引',
  'install_skill': '安装 Skill 技能包\n用法: 安装Skill [技能包路径]',
  'retry_refine': '重新执行提炼\n用法: 重新提练',
};

// ==================== CLI 适配器接口 ====================

/**
 * CLI 适配器接口
 */
export interface ICLIAdapter {
  /**
   * 启动 CLI
   */
  start(): Promise<void>;

  /**
   * 停止 CLI
   */
  stop(): Promise<void>;

  /**
   * 解析命令
   */
  parseCommand(input: string): ParsedCommand;

  /**
   * 显示响应
   */
  displayResponse(response: string): void;

  /**
   * 显示状态
   */
  displayStatus(status: string): void;
}

/**
 * 解析后的命令
 */
export interface ParsedCommand {
  /** 是否是命令 */
  isCommand: boolean;
  /** 命令名称（英文） */
  command?: string;
  /** 命令名称（中文原始） */
  commandRaw?: string;
  /** 命令参数 */
  args: string[];
  /** 原始输入 */
  rawInput: string;
}

// ==================== CLI 适配器实现 ====================

/**
 * CLI 适配器配置
 */
export interface CLIAdapterConfig {
  /** 提示符 */
  prompt: string;
  /** 欢迎消息 */
  welcomeMessage: string;
  /** 是否启用中文指令 */
  enableChineseCommands: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: CLIAdapterConfig = {
  prompt: '🦞 超级大龙虾> ',
  welcomeMessage: `
╔══════════════════════════════════════════════════════════════╗
║                    🦞 超级大龙虾 v1.0                        ║
║              OpenClaw 深度改造版 - 智能代理系统              ║
╠══════════════════════════════════════════════════════════════╣
║  中文指令:                                                   ║
║    创建代理 [模板]  - 创建新的子代理                         ║
║    销毁代理 [ID]    - 销毁指定的子代理                       ║
║    克隆代理 [ID]    - 克隆现有子代理                         ║
║    查看代理         - 列出所有子代理                         ║
║    执行任务 [描述]  - 执行任务                               ║
║    取消任务 [ID]    - 取消正在执行的任务                     ║
║    搜索记忆 [关键词] - 搜索永久记忆                          ║
║    提炼记忆         - 提炼临时记忆到永久记忆                 ║
║    帮助 [命令]      - 显示帮助信息                           ║
║    退出             - 退出程序                               ║
╚══════════════════════════════════════════════════════════════╝
`,
  enableChineseCommands: true,
};

/**
 * CLI 适配器实现
 */
export class CLIAdapter implements ICLIAdapter {
  private config: CLIAdapterConfig;
  private rl: readline.Interface | null = null;
  private running = false;
  private onCommandCallback?: (cmd: ParsedCommand) => Promise<string>;

  constructor(config?: Partial<CLIAdapterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 设置命令处理回调
   */
  setCommandHandler(handler: (cmd: ParsedCommand) => Promise<string>): void {
    this.onCommandCallback = handler;
  }

  /**
   * 启动 CLI
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // 创建 readline 接口
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.config.prompt,
    });

    // 显示欢迎消息
    console.log(this.config.welcomeMessage);

    // 设置提示符
    this.rl.prompt();

    // 监听输入
    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();

      // 空输入
      if (!trimmed) {
        this.rl?.prompt();
        return;
      }

      // 退出命令
      if (trimmed === '退出' || trimmed === 'exit' || trimmed === 'quit') {
        await this.stop();
        return;
      }

      // 解析命令
      const parsed = this.parseCommand(trimmed);

      // 处理命令
      if (this.onCommandCallback) {
        try {
          const response = await this.onCommandCallback(parsed);
          this.displayResponse(response);
        } catch (error) {
          this.displayResponse(`错误: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      this.rl?.prompt();
    });

    // 监听关闭
    this.rl.on('close', () => {
      this.running = false;
      console.log('\n再见！🦞');
    });
  }

  /**
   * 停止 CLI
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * 解析命令
   */
  parseCommand(input: string): ParsedCommand {
    const parts = input.split(/\s+/);
    const firstPart = parts[0];
    const args = parts.slice(1);

    // 检查是否是中文命令
    if (this.config.enableChineseCommands) {
      // 检查别名
      const aliasTarget = COMMAND_ALIASES[firstPart];
      if (aliasTarget) {
        const command = COMMAND_MAP[aliasTarget];
        if (command) {
          return {
            isCommand: true,
            command,
            commandRaw: firstPart,
            args,
            rawInput: input,
          };
        }
      }

      // 检查直接映射
      const directCommand = COMMAND_MAP[firstPart];
      if (directCommand) {
        return {
          isCommand: true,
          command: directCommand,
          commandRaw: firstPart,
          args,
          rawInput: input,
        };
      }
    }

    // 检查英文命令
    const englishCommands = Object.values(COMMAND_MAP);
    if (englishCommands.includes(firstPart)) {
      return {
        isCommand: true,
        command: firstPart,
        commandRaw: firstPart,
        args,
        rawInput: input,
      };
    }

    // 检查帮助命令
    if (firstPart === '帮助' || firstPart === 'help') {
      return {
        isCommand: true,
        command: 'help',
        commandRaw: firstPart,
        args,
        rawInput: input,
      };
    }

    // 不是命令，当作任务描述
    return {
      isCommand: false,
      args: [],
      rawInput: input,
    };
  }

  /**
   * 显示响应
   */
  displayResponse(response: string): void {
    console.log(`\n${response}\n`);
  }

  /**
   * 显示状态
   */
  displayStatus(status: string): void {
    console.log(`[状态] ${status}`);
  }

  /**
   * 获取帮助文本
   */
  getHelp(command?: string): string {
    if (command && COMMAND_HELP[command]) {
      return `${command}:\n${COMMAND_HELP[command]}`;
    }

    // 返回所有帮助
    const helpLines = Object.entries(COMMAND_HELP).map(
      ([cmd, desc]) => `  ${cmd}:\n    ${desc.replace(/\n/g, '\n    ')}`
    );
    return `可用命令:\n${helpLines.join('\n\n')}`;
  }

  /**
   * 转换为统一消息格式
   */
  toUnifiedMessage(input: string, userId: string = 'cli_user'): UnifiedMessage {
    return {
      source: 'cli',
      user_id: userId,
      content: input,
      timestamp: new Date().toISOString(),
      attachments: [],
    };
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 CLI 适配器实例
 */
export function createCLIAdapter(config?: Partial<CLIAdapterConfig>): ICLIAdapter {
  return new CLIAdapter(config);
}

/**
 * 快速解析命令（无需创建实例）
 */
export function parseChineseCommand(input: string): ParsedCommand {
  const parts = input.split(/\s+/);
  const firstPart = parts[0];
  const args = parts.slice(1);

  // 检查别名
  const aliasTarget = COMMAND_ALIASES[firstPart];
  if (aliasTarget) {
    const command = COMMAND_MAP[aliasTarget];
    if (command) {
      return { isCommand: true, command, commandRaw: firstPart, args, rawInput: input };
    }
  }

  // 检查直接映射
  const directCommand = COMMAND_MAP[firstPart];
  if (directCommand) {
    return { isCommand: true, command: directCommand, commandRaw: firstPart, args, rawInput: input };
  }

  return { isCommand: false, args: [], rawInput: input };
}

export default CLIAdapter;
