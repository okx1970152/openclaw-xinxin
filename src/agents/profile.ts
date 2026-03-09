/**
 * 超级大龙虾 - 能力画像更新器
 * Capability Profile Updater
 * 
 * 存放于 src/agents/profile.ts
 * 任务完成后更新子代理能力画像
 */

import type {
  CapabilityProfile,
  AgentResult,
} from '../types/core';
import type { IProfileUpdater } from './types';

/**
 * 画像更新配置
 */
export interface ProfileUpdateConfig {
  /** 技能提取最大数量 */
  maxSkillsExtract: number;
  /** 平均 Token 计算衰减因子 */
  avgTokenDecay: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ProfileUpdateConfig = {
  maxSkillsExtract: 3,
  avgTokenDecay: 0.9,
};

/**
 * 能力画像更新器实现
 */
export class ProfileUpdater implements IProfileUpdater {
  private config: ProfileUpdateConfig;

  constructor(config?: Partial<ProfileUpdateConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 任务完成后更新能力画像
   */
  async updateAfterTask(
    agentId: string,
    taskDescription: string,
    result: AgentResult
  ): Promise<CapabilityProfile> {
    // 获取当前画像（这里模拟，实际需要从注册表获取）
    const currentProfile = await this.getCurrentProfile(agentId);
    
    // 更新成功/失败计数
    if (result.status === 'success') {
      currentProfile.success_count++;
    } else if (result.status === 'failure') {
      currentProfile.fail_count++;
    }

    // 更新平均 Token 消耗
    this.updateAvgTokens(currentProfile, result.tokens_used);

    // 提取新技能标签
    const newSkills = await this.extractNewSkills(taskDescription, result);
    for (const skill of newSkills) {
      if (!currentProfile.skills_proven.includes(skill)) {
        currentProfile.skills_proven.push(skill);
      }
    }

    // 限制技能数量
    if (currentProfile.skills_proven.length > 20) {
      currentProfile.skills_proven = currentProfile.skills_proven.slice(-20);
    }

    // 更新最后活跃时间
    currentProfile.last_active = new Date().toISOString();

    // 保存画像（实际需要调用注册表）
    await this.saveProfile(agentId, currentProfile);

    return currentProfile;
  }

  /**
   * 批量更新画像
   */
  async batchUpdate(
    updates: Array<{
      agentId: string;
      taskDescription: string;
      result: AgentResult;
    }>
  ): Promise<Map<string, CapabilityProfile>> {
    const results = new Map<string, CapabilityProfile>();

    for (const update of updates) {
      const profile = await this.updateAfterTask(
        update.agentId,
        update.taskDescription,
        update.result
      );
      results.set(update.agentId, profile);
    }

    return results;
  }

  /**
   * 计算成功率
   */
  calculateSuccessRate(profile: CapabilityProfile): number {
    const total = profile.success_count + profile.fail_count;
    if (total === 0) { return 0; }
    return profile.success_count / total;
  }

  /**
   * 评估能力等级
   */
  assessCapabilityLevel(profile: CapabilityProfile): 'beginner' | 'intermediate' | 'expert' | 'master' {
    const totalTasks = profile.success_count + profile.fail_count;
    const successRate = this.calculateSuccessRate(profile);

    if (totalTasks >= 100 && successRate >= 0.95) {
      return 'master';
    } else if (totalTasks >= 50 && successRate >= 0.85) {
      return 'expert';
    } else if (totalTasks >= 10 && successRate >= 0.7) {
      return 'intermediate';
    }
    
    return 'beginner';
  }

  // ===== 私有方法 =====

  /**
   * 获取当前画像
   */
  private async getCurrentProfile(_agentId: string): Promise<CapabilityProfile> {
    // 实际实现需要从注册表获取
    // 这里返回默认值
    return {
      skills_proven: [],
      success_count: 0,
      fail_count: 0,
      avg_tokens_per_task: 0,
      last_active: new Date().toISOString(),
    };
  }

  /**
   * 保存画像
   */
  private async saveProfile(agentId: string, profile: CapabilityProfile): Promise<void> {
    // 实际实现需要更新注册表
    console.log(`[ProfileUpdater] 更新代理 ${agentId} 能力画像: 成功 ${profile.success_count}, 失败 ${profile.fail_count}`);
  }

  /**
   * 更新平均 Token 消耗
   */
  private updateAvgTokens(profile: CapabilityProfile, newTokens: number): void {
    const totalTasks = profile.success_count + profile.fail_count;
    
    if (totalTasks === 1) {
      profile.avg_tokens_per_task = newTokens;
    } else {
      // 加权平均，新数据权重较低
      const oldWeight = this.config.avgTokenDecay;
      const newWeight = 1 - oldWeight;
      
      profile.avg_tokens_per_task = 
        profile.avg_tokens_per_task * oldWeight + newTokens * newWeight;
    }
  }

  /**
   * 提取新技能标签
   */
  private async extractNewSkills(
    taskDescription: string,
    result: AgentResult
  ): Promise<string[]> {
    const skills: string[] = [];
    const text = `${taskDescription} ${result.result}`.toLowerCase();

    // 技能关键词映射
    const skillPatterns: Record<string, RegExp[]> = {
      '代码编写': [/代码|code|编写|实现|开发/],
      '代码调试': [/调试|debug|修复|bug|错误/],
      '代码重构': [/重构|refactor|优化|改善/],
      '代码审查': [/审查|review|检查|审核/],
      '文档编写': [/文档|readme|说明|文档撰写/],
      '测试编写': [/测试|test|单元测试|集成测试/],
      'API设计': [/api|接口|restful|graphql/],
      '数据库操作': [/数据库|sql|查询|database/],
      '前端开发': [/前端|ui|界面|页面|react|vue/],
      '后端开发': [/后端|服务端|server|backend/],
      'DevOps': [/部署|deploy|docker|k8s|cicd/],
      '性能优化': [/性能|优化|performance|加速/],
      '安全审查': [/安全|security|漏洞|风险/],
      '数据分析': [/数据|分析|统计|analytics/],
      '文件操作': [/文件|file|读写|目录/],
    };

    for (const [skill, patterns] of Object.entries(skillPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          skills.push(skill);
          break;
        }
      }
    }

    // 限制数量
    return skills.slice(0, this.config.maxSkillsExtract);
  }
}

/**
 * 创建画像更新器实例
 */
export function createProfileUpdater(config?: Partial<ProfileUpdateConfig>): IProfileUpdater {
  return new ProfileUpdater(config);
}

export default ProfileUpdater;
