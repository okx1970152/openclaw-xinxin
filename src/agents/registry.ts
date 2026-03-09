/**
 * 超级大龙虾 - 子代理注册表
 * Agent Registry
 * 
 * 存放于 src/agents/registry.ts
 * 管理所有子代理的配置和状态
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AgentConfig,
  AgentStatus,
  Permission,
  CapabilityProfile,
} from '../types/core';

/**
 * 注册表配置
 */
export interface RegistryConfig {
  /** 注册表文件路径 */
  registryPath: string;
  /** 子代理目录 */
  agentsDir: string;
}

/**
 * 默认注册表配置
 */
const DEFAULT_CONFIG: RegistryConfig = {
  registryPath: './agents/registry.json',
  agentsDir: './agents',
};

/**
 * 注册表数据结构
 */
interface RegistryData {
  /** 版本号 */
  version: string;
  /** 最后更新时间 */
  last_updated: string;
  /** 子代理列表 */
  agents: AgentConfig[];
}

/**
 * 子代理注册表
 */
export class AgentRegistry {
  private config: RegistryConfig;
  private data: RegistryData;

  constructor(config?: Partial<RegistryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.data = this.load();
  }

  /**
   * 加载注册表
   */
  private load(): RegistryData {
    if (!fs.existsSync(this.config.registryPath)) {
      // 创建默认注册表
      const defaultData: RegistryData = {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        agents: [],
      };
      this.save(defaultData);
      return defaultData;
    }

    try {
      const content = fs.readFileSync(this.config.registryPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[AgentRegistry] 加载注册表失败:', error);
      return {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        agents: [],
      };
    }
  }

  /**
   * 保存注册表
   */
  private save(data: RegistryData = this.data): void {
    // 确保目录存在
    const dir = path.dirname(this.config.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    data.last_updated = new Date().toISOString();
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(this.config.registryPath, content, 'utf-8');
  }

  // ===== CRUD 操作 =====

  /**
   * 注册子代理
   */
  register(config: AgentConfig): void {
    const existing = this.data.agents.find(a => a.agent_id === config.agent_id);
    if (existing) {
      throw new Error(`代理已存在: ${config.agent_id}`);
    }
    this.data.agents.push(config);
    this.save();
    console.log(`[AgentRegistry] 注册子代理: ${config.agent_id}`);
  }

  /**
   * 注销子代理
   */
  unregister(agentId: string): boolean {
    const index = this.data.agents.findIndex(a => a.agent_id === agentId);
    if (index < 0) {
      return false;
    }
    this.data.agents.splice(index, 1);
    this.save();
    console.log(`[AgentRegistry] 注销子代理: ${agentId}`);
    return true;
  }

  /**
   * 获取子代理配置
   */
  get(agentId: string): AgentConfig | undefined {
    return this.data.agents.find(a => a.agent_id === agentId);
  }

  /**
   * 获取所有子代理
   */
  getAll(): AgentConfig[] {
    return [...this.data.agents];
  }

  /**
   * 更新子代理配置
   */
  update(agentId: string, updates: Partial<AgentConfig>): boolean {
    const agent = this.data.agents.find(a => a.agent_id === agentId);
    if (!agent) {
      return false;
    }
    Object.assign(agent, updates);
    this.save();
    return true;
  }

  // ===== 状态管理 =====

  /**
   * 更新子代理状态
   */
  updateStatus(agentId: string, status: AgentStatus): boolean {
    return this.update(agentId, { status });
  }

  /**
   * 更新能力画像
   */
  updateCapability(agentId: string, profile: Partial<CapabilityProfile>): boolean {
    const agent = this.data.agents.find(a => a.agent_id === agentId);
    if (!agent) {
      return false;
    }
    agent.capability_profile = {
      ...agent.capability_profile,
      ...profile,
    };
    this.save();
    return true;
  }

  // ===== 查询操作 =====

  /**
   * 按状态查询
   */
  findByStatus(status: AgentStatus): AgentConfig[] {
    return this.data.agents.filter(a => a.status === status);
  }

  /**
   * 按关键词查询
   */
  findByKeyword(keyword: string): AgentConfig[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.data.agents.filter(a => 
      a.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
      a.domain.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 按权限查询
   */
  findByPermission(permission: Permission): AgentConfig[] {
    return this.data.agents.filter(a => a.permissions.includes(permission));
  }

  /**
   * 获取空闲的子代理
   */
  getIdleAgents(): AgentConfig[] {
    return this.findByStatus('idle');
  }

  /**
   * 获取可用的子代理（idle 或 active）
   */
  getAvailableAgents(): AgentConfig[] {
    return this.data.agents.filter(a => 
      a.status === 'idle' || a.status === 'active'
    );
  }

  // ===== 统计信息 =====

  /**
   * 获取统计信息
   */
  getStats(): RegistryStats {
    const stats: RegistryStats = {
      total: this.data.agents.length,
      by_status: {
        active: 0,
        idle: 0,
        hibernating: 0,
        destroying: 0,
      },
      total_success_count: 0,
      total_fail_count: 0,
    };

    for (const agent of this.data.agents) {
      stats.by_status[agent.status]++;
      stats.total_success_count += agent.capability_profile.success_count;
      stats.total_fail_count += agent.capability_profile.fail_count;
    }

    return stats;
  }
}

/**
 * 注册表统计信息
 */
export interface RegistryStats {
  /** 总数 */
  total: number;
  /** 按状态统计 */
  by_status: Record<AgentStatus, number>;
  /** 总成功次数 */
  total_success_count: number;
  /** 总失败次数 */
  total_fail_count: number;
}

/**
 * 创建注册表实例
 */
export function createAgentRegistry(config?: Partial<RegistryConfig>): AgentRegistry {
  return new AgentRegistry(config);
}

export default AgentRegistry;
