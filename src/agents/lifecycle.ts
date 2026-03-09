/**
 * 超级大龙虾 - 子代理生命周期
 * Child Agent Lifecycle
 * 
 * 存放于 src/agents/lifecycle.ts
 * 子代理的创建、执行、状态管理
 */

import type {
  AgentConfig,
  AgentStatus,
  AgentResult,
  TaskItem,
  CapabilityProfile,
} from '../types/core';
import type { IMemoryManager } from '../memory-kw/types';
import type { IChildAgent } from './types';

/**
 * 子代理接口
 */
export interface IChildAgent {
  readonly config: AgentConfig;
  readonly memory?: IMemoryManager;
  
  // 执行任务
  execute(task: TaskItem): Promise<AgentResult>;
  
  // 状态管理
  activate(): Promise<void>;
  complete(): Promise<void>;
  hibernate(): Promise<void>;
  destroy(): Promise<void>;
  
  // 查询
  getStatus(): AgentStatus;
  getCapability(): CapabilityProfile;
}

/**
 * 子代理实现
 */
export class ChildAgent implements IChildAgent {
  readonly config: AgentConfig;
  readonly memory?: IMemoryManager;
  
  private status: AgentStatus;

  constructor(config: AgentConfig, memory?: IMemoryManager) {
    this.config = config;
    this.memory = memory;
    this.status = config.status;
  }

  /**
   * 执行任务（核心方法）
   */
  async execute(task: TaskItem): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      // 1. 激活代理
      await this.activate();
      
      // 2. 执行任务（Phase 1 骨架实现）
      console.log(`[ChildAgent ${this.config.agent_id}] 执行任务: ${task.task_id}`);
      
      // TODO: 实际的任务执行逻辑
      // - 加载系统提示词
      // - 构建上下文（临时记忆 + 永久记忆）
      // - 调用 LLM
      // - 解析响应
      // - 执行工具调用
      
      // 模拟执行结果
      const result: AgentResult = {
        status: 'success',
        result: `任务 "${task.content}" 已由 ${this.config.agent_id} 处理`,
        tokens_used: 100,
        duration_ms: Date.now() - startTime,
      };
      
      // 3. 更新能力画像
      this.updateCapabilityAfterTask(task, result);
      
      // 4. 完成任务
      await this.complete();
      
      return result;
    } catch (error) {
      // 失败处理
      const errorResult: AgentResult = {
        status: 'failure',
        result: `任务执行失败: ${error instanceof Error ? error.message : String(error)}`,
        tokens_used: 0,
        error_code: 'EXEC_FAILED',
        error_detail: error instanceof Error ? error.stack : undefined,
        duration_ms: Date.now() - startTime,
      };
      
      this.config.capability_profile.fail_count++;
      await this.complete();
      
      return errorResult;
    }
  }

  /**
   * 激活代理 (idle/hibernating → active)
   */
  async activate(): Promise<void> {
    if (this.status === 'destroying') {
      throw new Error(`代理正在销毁中: ${this.config.agent_id}`);
    }
    
    this.status = 'active';
    this.config.status = 'active';
    this.config.capability_profile.last_active = new Date().toISOString();
    console.log(`[ChildAgent ${this.config.agent_id}] 已激活`);
  }

  /**
   * 完成任务 (active → idle)
   */
  async complete(): Promise<void> {
    this.status = 'idle';
    this.config.status = 'idle';
    console.log(`[ChildAgent ${this.config.agent_id}] 任务完成，进入空闲状态`);
  }

  /**
   * 休眠代理 (idle → hibernating)
   */
  async hibernate(): Promise<void> {
    if (this.status === 'active') {
      console.warn(`[ChildAgent ${this.config.agent_id}] 代理正在执行任务，无法休眠`);
      return;
    }
    
    this.status = 'hibernating';
    this.config.status = 'hibernating';
    console.log(`[ChildAgent ${this.config.agent_id}] 已休眠`);
  }

  /**
   * 销毁代理 (any → destroying)
   */
  async destroy(): Promise<void> {
    this.status = 'destroying';
    this.config.status = 'destroying';
    console.log(`[ChildAgent ${this.config.agent_id}] 已标记为销毁`);
    
    // TODO: 清理资源
    // - 保存永久记忆
    // - 清理临时文件
    // - 释放内存
  }

  /**
   * 获取状态
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * 获取能力画像
   */
  getCapability(): CapabilityProfile {
    return this.config.capability_profile;
  }

  /**
   * 任务完成后更新能力画像
   */
  private updateCapabilityAfterTask(task: TaskItem, result: AgentResult): void {
    const profile = this.config.capability_profile;
    
    // 更新成功/失败计数
    if (result.status === 'success') {
      profile.success_count++;
    } else if (result.status === 'failure') {
      profile.fail_count++;
    }
    
    // 更新平均 Token 消耗
    const totalTasks = profile.success_count + profile.fail_count;
    profile.avg_tokens_per_task = 
      (profile.avg_tokens_per_task * (totalTasks - 1) + result.tokens_used) / totalTasks;
    
    // 更新最后活跃时间
    profile.last_active = new Date().toISOString();
    
    // TODO: 从任务描述提取新技能标签
    // 使用 LLM 从 task.content 提取 1-3 个技能标签
  }
}

/**
 * 子代理工厂
 */
export class ChildAgentFactory {
  /**
   * 创建子代理
   */
  static create(config: AgentConfig, memory?: IMemoryManager): IChildAgent {
    return new ChildAgent(config, memory);
  }
}

/**
 * 创建子代理实例
 */
export function createChildAgent(config: AgentConfig, memory?: IMemoryManager): IChildAgent {
  return ChildAgentFactory.create(config, memory);
}

export default ChildAgent;
