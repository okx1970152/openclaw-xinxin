/**
 * 超级大龙虾 (Super Lobster) - 主代理注册表
 * 
 * 管理所有子代理的注册、激活、休眠、销毁
 * 
 * @module master/registry
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentConfig, AgentRegistry, RegistryEntry, AgentStatus } from '../types/core';

/**
 * 注册表配置
 */
const REGISTRY_VERSION = '1.0.0';

/**
 * 子代理注册表管理器
 */
export class AgentRegistryManager {
  private registryPath: string;
  private registry: AgentRegistry | null = null;

  constructor(baseDir: string) {
    this.registryPath = path.join(baseDir, 'registry.json');
  }

  /**
   * 初始化注册表
   */
  async initialize(): Promise<void> {
    if (fs.existsSync(this.registryPath)) {
      this.registry = await this.loadRegistry();
    } else {
      this.registry = {
        version: REGISTRY_VERSION,
        updated_at: new Date().toISOString(),
        agents: [],
      };
      await this.saveRegistry();
    }
  }

  /**
   * 加载注册表
   */
  private async loadRegistry(): Promise<AgentRegistry> {
    const content = fs.readFileSync(this.registryPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 保存注册表
   */
  private async saveRegistry(): Promise<void> {
    if (!this.registry) {
      return;
    }
    
    this.registry.updated_at = new Date().toISOString();
    const content = JSON.stringify(this.registry, null, 2);
    fs.writeFileSync(this.registryPath, content, 'utf-8');
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.registry) {
      throw new Error('注册表未初始化，请先调用 initialize()');
    }
  }

  // --------------------------------------------------------------------------
  // 代理注册
  // --------------------------------------------------------------------------

  /**
   * 注册新代理
   */
  async registerAgent(config: AgentConfig, isClone: boolean = false, clonedFrom?: string): Promise<RegistryEntry> {
    this.ensureInitialized();

    const entry: RegistryEntry = {
      agent_id: config.agent_id,
      config,
      registered_at: new Date().toISOString(),
      is_clone: isClone,
      cloned_from: clonedFrom,
    };

    this.registry!.agents.push(entry);
    await this.saveRegistry();

    return entry;
  }

  /**
   * 注销代理
   */
  async unregisterAgent(agentId: string): Promise<boolean> {
    this.ensureInitialized();

    const index = this.registry!.agents.findIndex(a => a.agent_id === agentId);
    if (index === -1) {
      return false;
    }

    this.registry!.agents.splice(index, 1);
    await this.saveRegistry();

    return true;
  }

  // --------------------------------------------------------------------------
  // 代理查询
  // --------------------------------------------------------------------------

  /**
   * 获取所有代理
   */
  async getAllAgents(): Promise<RegistryEntry[]> {
    this.ensureInitialized();
    return [...this.registry!.agents];
  }

  /**
   * 获取代理配置
   */
  async getAgent(agentId: string): Promise<RegistryEntry | null> {
    this.ensureInitialized();
    return this.registry!.agents.find(a => a.agent_id === agentId) || null;
  }

  /**
   * 按状态获取代理
   */
  async getAgentsByStatus(status: AgentStatus): Promise<RegistryEntry[]> {
    this.ensureInitialized();
    return this.registry!.agents.filter(a => a.config.status === status);
  }

  /**
   * 按关键词获取代理
   */
  async getAgentsByKeywords(keywords: string[]): Promise<RegistryEntry[]> {
    this.ensureInitialized();
    
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    
    return this.registry!.agents.filter(entry => {
      const agentKeywords = entry.config.keywords.map(k => k.toLowerCase());
      return lowerKeywords.some(kw => 
        agentKeywords.some(ak => ak.includes(kw) || kw.includes(ak))
      );
    });
  }

  /**
   * 获取空闲代理
   */
  async getIdleAgents(): Promise<RegistryEntry[]> {
    return this.getAgentsByStatus('idle');
  }

  /**
   * 获取有经验的代理（成功完成任务过的）
   */
  async getExperiencedAgents(): Promise<RegistryEntry[]> {
    this.ensureInitialized();
    return this.registry!.agents.filter(
      a => a.config.capability_profile.success_count > 0
    );
  }

  // --------------------------------------------------------------------------
  // 状态更新
  // --------------------------------------------------------------------------

  /**
   * 更新代理状态
   */
  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<boolean> {
    this.ensureInitialized();

    const entry = this.registry!.agents.find(a => a.agent_id === agentId);
    if (!entry) {
      return false;
    }

    entry.config.status = status;
    entry.config.capability_profile.last_active = new Date().toISOString();
    
    await this.saveRegistry();
    return true;
  }

  /**
   * 更新代理配置
   */
  async updateAgentConfig(agentId: string, updates: Partial<AgentConfig>): Promise<boolean> {
    this.ensureInitialized();

    const entry = this.registry!.agents.find(a => a.agent_id === agentId);
    if (!entry) {
      return false;
    }

    entry.config = { ...entry.config, ...updates };
    await this.saveRegistry();
    
    return true;
  }

  /**
   * 更新能力画像
   */
  async updateCapability(
    agentId: string,
    updates: {
      newSkill?: string;
      success?: boolean;
      tokensUsed?: number;
    }
  ): Promise<boolean> {
    this.ensureInitialized();

    const entry = this.registry!.agents.find(a => a.agent_id === agentId);
    if (!entry) {
      return false;
    }

    const profile = entry.config.capability_profile;

    // 更新成功/失败计数
    if (updates.success !== undefined) {
      if (updates.success) {
        profile.success_count++;
      } else {
        profile.fail_count++;
      }
    }

    // 更新平均 Token
    if (updates.tokensUsed !== undefined) {
      const totalTasks = profile.success_count + profile.fail_count;
      if (totalTasks > 1) {
        profile.avg_tokens_per_task = 
          (profile.avg_tokens_per_task * (totalTasks - 1) + updates.tokensUsed) / totalTasks;
      } else {
        profile.avg_tokens_per_task = updates.tokensUsed;
      }
    }

    // 添加新技能
    if (updates.newSkill && !profile.skills_proven.includes(updates.newSkill)) {
      profile.skills_proven.push(updates.newSkill);
    }

    profile.last_active = new Date().toISOString();
    
    await this.saveRegistry();
    return true;
  }

  // --------------------------------------------------------------------------
  // 统计
  // --------------------------------------------------------------------------

  /**
   * 获取注册表统计
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    idle: number;
    hibernating: number;
  }> {
    this.ensureInitialized();

    const agents = this.registry!.agents;
    
    return {
      total: agents.length,
      active: agents.filter(a => a.config.status === 'active').length,
      idle: agents.filter(a => a.config.status === 'idle').length,
      hibernating: agents.filter(a => a.config.status === 'hibernating').length,
    };
  }
}

export default AgentRegistryManager;
