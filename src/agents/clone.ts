/**
 * 超级大龙虾 - 子代理克隆器
 * Agent Cloner
 * 
 * 存放于 src/agents/clone.ts
 * 克隆有经验的子代理
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentConfig } from '../types/core';
import type { IAgentCloner, IMemoryManager } from './types';

/**
 * 克隆器配置
 */
export interface CloneConfig {
  /** 代理目录 */
  agentsDir: string;
  /** 是否复制永久记忆 */
  copyPermMem: boolean;
  /** 是否复制知识库 */
  copyKnowledge: boolean;
  /** 是否复制临时记忆 */
  copyTempMem: boolean;
  /** 是否复制代码脚本 */
  copyCodeScripts: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: CloneConfig = {
  agentsDir: './agents',
  copyPermMem: true,
  copyKnowledge: true,
  copyTempMem: false,
  copyCodeScripts: false,
};

/**
 * 子代理克隆器实现
 */
export class AgentCloner implements IAgentCloner {
  private config: CloneConfig;
  private memoryManager?: IMemoryManager;

  constructor(config?: Partial<CloneConfig>, memoryManager?: IMemoryManager) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryManager = memoryManager;
  }

  /**
   * 克隆子代理
   */
  async clone(sourceAgentId: string): Promise<AgentConfig> {
    // 1. 读取源代理配置
    const sourceConfig = await this.readAgentConfig(sourceAgentId);
    if (!sourceConfig) {
      throw new Error(`找不到源代理: ${sourceAgentId}`);
    }

    // 2. 生成新代理 ID
    const newAgentId = this.generateNewAgentId(sourceAgentId);

    // 3. 创建新代理目录
    const newWorkDir = path.join(this.config.agentsDir, newAgentId);
    await this.ensureDir(newWorkDir);

    // 4. 复制永久记忆
    if (this.config.copyPermMem) {
      await this.copyPermMem(sourceAgentId, newAgentId, newWorkDir);
    }

    // 5. 复制知识库
    if (this.config.copyKnowledge) {
      await this.copyKnowledgeDir(sourceAgentId, newWorkDir);
    }

    // 6. 创建空的临时记忆文件
    if (this.config.copyTempMem) {
      await this.createEmptyTempMem(newWorkDir);
    }

    // 7. 创建空的代码脚本目录
    if (this.config.copyCodeScripts) {
      await this.createEmptyCodeScriptsDir(newWorkDir);
    }

    // 8. 创建新代理配置
    const clonedConfig: AgentConfig = {
      ...sourceConfig,
      agent_id: newAgentId,
      status: 'idle',
      work_dir: newWorkDir,
      capability_profile: {
        ...sourceConfig.capability_profile,
        last_active: new Date().toISOString(),
      },
      cloned_from: sourceAgentId,
      created_at: new Date().toISOString(),
    };

    // 9. 保存新代理配置
    await this.saveAgentConfig(newAgentId, clonedConfig);

    console.log(`[AgentCloner] 克隆完成: ${sourceAgentId} -> ${newAgentId}`);
    return clonedConfig;
  }

  /**
   * 批量克隆
   */
  async batchClone(
    sourceAgentId: string,
    count: number
  ): Promise<AgentConfig[]> {
    const results: AgentConfig[] = [];

    for (let i = 0; i < count; i++) {
      const cloned = await this.clone(sourceAgentId);
      results.push(cloned);
    }

    return results;
  }

  /**
   * 验证源代理是否可克隆
   */
  async canClone(agentId: string): Promise<{
    canClone: boolean;
    reason?: string;
  }> {
    const config = await this.readAgentConfig(agentId);
    
    if (!config) {
      return { canClone: false, reason: '代理不存在' };
    }

    if (config.status === 'destroying') {
      return { canClone: false, reason: '代理正在销毁中' };
    }

    // 检查是否有足够经验值得克隆
    const profile = config.capability_profile;
    if (profile.success_count < 3) {
      return { canClone: false, reason: '代理经验不足（成功任务 < 3）' };
    }

    return { canClone: true };
  }

  // ===== 私有方法 =====

  /**
   * 读取代理配置
   */
  private async readAgentConfig(agentId: string): Promise<AgentConfig | null> {
    const configPath = path.join(this.config.agentsDir, agentId, 'config.json');
    
    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[AgentCloner] 读取配置失败: ${configPath}`, error);
      return null;
    }
  }

  /**
   * 保存代理配置
   */
  private async saveAgentConfig(agentId: string, config: AgentConfig): Promise<void> {
    const configPath = path.join(this.config.agentsDir, agentId, 'config.json');
    
    await this.ensureDir(path.dirname(configPath));

    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(configPath, content, 'utf-8');
  }

  /**
   * 生成新代理 ID
   */
  private generateNewAgentId(sourceId: string): string {
    // 提取基础名称和序号
    const match = sourceId.match(/^(.+?)(?:_(\d+))?$/);
    const baseName = match ? match[1] : sourceId;
    
    // 查找现有克隆数量
    const existingClones = this.countExistingClones(baseName);
    const nextNum = existingClones + 1;

    return `${baseName}_clone_${nextNum}`;
  }

  /**
   * 计算现有克隆数量
   */
  private countExistingClones(baseName: string): number {
    if (!fs.existsSync(this.config.agentsDir)) {
      return 0;
    }

    const dirs = fs.readdirSync(this.config.agentsDir, { withFileTypes: true });
    let count = 0;

    for (const dir of dirs) {
      if (dir.isDirectory() && dir.name.startsWith(`${baseName}_clone_`)) {
        count++;
      }
    }

    return count;
  }

  /**
   * 复制永久记忆
   */
  private async copyPermMem(
    sourceId: string,
    newId: string,
    newWorkDir: string
  ): Promise<void> {
    const sourceMemPath = path.join(this.config.agentsDir, sourceId, 'memory', 'perm_mem.json');
    
    if (fs.existsSync(sourceMemPath)) {
      const targetDir = path.join(newWorkDir, 'memory');
      await this.ensureDir(targetDir);
      
      const targetPath = path.join(targetDir, 'perm_mem.json');
      fs.copyFileSync(sourceMemPath, targetPath);
      
      console.log(`[AgentCloner] 复制永久记忆: ${sourceMemPath} -> ${targetPath}`);
    }
  }

  /**
   * 复制知识库目录
   */
  private async copyKnowledgeDir(sourceId: string, newWorkDir: string): Promise<void> {
    const sourceKnowledgePath = path.join(this.config.agentsDir, sourceId, 'knowledge');
    
    if (fs.existsSync(sourceKnowledgePath)) {
      const targetPath = path.join(newWorkDir, 'knowledge');
      await this.copyDir(sourceKnowledgePath, targetPath);
      
      console.log(`[AgentCloner] 复制知识库: ${sourceKnowledgePath} -> ${targetPath}`);
    }
  }

  /**
   * 创建空的临时记忆文件
   */
  private async createEmptyTempMem(workDir: string): Promise<void> {
    const memoryDir = path.join(workDir, 'memory');
    await this.ensureDir(memoryDir);

    // 创建空的临时记忆槽位
    const emptyArray = '[]';
    fs.writeFileSync(path.join(memoryDir, 'temp_mem_1.json'), emptyArray, 'utf-8');
    fs.writeFileSync(path.join(memoryDir, 'temp_mem_2.json'), emptyArray, 'utf-8');
  }

  /**
   * 创建空的代码脚本目录
   */
  private async createEmptyCodeScriptsDir(workDir: string): Promise<void> {
    const scriptsDir = path.join(workDir, 'code_scripts');
    await this.ensureDir(scriptsDir);
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 复制目录
   */
  private async copyDir(source: string, target: string): Promise<void> {
    await this.ensureDir(target);

    const entries = fs.readdirSync(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        await this.copyDir(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }
}

/**
 * 创建克隆器实例
 */
export function createAgentCloner(
  config?: Partial<CloneConfig>,
  memoryManager?: IMemoryManager
): IAgentCloner {
  return new AgentCloner(config, memoryManager);
}

export default AgentCloner;
