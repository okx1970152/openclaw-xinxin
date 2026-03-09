/**
 * 超级大龙虾 - 子代理类型定义
 * Child Agent Types
 * 
 * 存放于 src/agents/types.ts
 */

// 重新导出核心类型中的子代理相关类型
export type {
  AgentConfig,
  AgentStatus,
  Permission,
  CapabilityProfile,
  AgentResult,
} from '../types/core';

/**
 * 子代理接口
 */
export interface IChildAgent {
  /** 代理配置 */
  readonly config: AgentConfig;
  /** 记忆管理器 */
  readonly memory?: IMemoryManager;
  
  /**
   * 执行任务
   * @param task 任务项
   * @returns 执行结果
   */
  execute(task: TaskItem): Promise<AgentResult>;
  
  /**
   * 激活代理 (idle/hibernating → active)
   */
  activate(): Promise<void>;
  
  /**
   * 完成任务 (active → idle)
   */
  complete(): Promise<void>;
  
  /**
   * 休眠代理 (idle → hibernating)
   */
  hibernate(): Promise<void>;
  
  /**
   * 销毁代理 (any → destroying)
   */
  destroy(): Promise<void>;
  
  /**
   * 获取当前状态
   */
  getStatus(): AgentStatus;
  
  /**
   * 获取能力画像
   */
  getCapability(): CapabilityProfile;
}

/**
 * 子代理克隆器接口
 */
export interface IAgentCloner {
  /**
   * 克隆子代理
   * @param sourceAgentId 源代理ID
   * @returns 新代理配置
   */
  clone(sourceAgentId: string): Promise<AgentConfig>;
}

/**
 * 能力画像更新器接口
 */
export interface IProfileUpdater {
  /**
   * 任务完成后更新能力画像
   * @param agentId 代理ID
   * @param taskDescription 任务描述（用于 LLM 提取新技能标签）
   * @param result 执行结果
   * @returns 更新后的能力画像
   */
  updateAfterTask(
    agentId: string,
    taskDescription: string,
    result: AgentResult
  ): Promise<CapabilityProfile>;
}

// 导入需要的类型
import type { TaskItem, AgentStatus, CapabilityProfile, AgentResult } from '../types/core';
import type { IMemoryManager } from '../memory-kw/types';
