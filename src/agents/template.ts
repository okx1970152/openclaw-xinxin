/**
 * 超级大龙虾 - 子代理模板
 * Agent Template
 * 
 * 存放于 src/agents/template.ts
 * 子代理模板定义和管理
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AgentConfig,
  AgentTemplate,
  Permission,
  CapabilityProfile,
} from '../types/core';

/**
 * 模板管理器配置
 */
export interface TemplateManagerConfig {
  /** 模板目录 */
  templatesDir: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: TemplateManagerConfig = {
  templatesDir: './templates/agents',
};

/**
 * 内置模板列表
 */
const BUILTIN_TEMPLATES: AgentTemplate[] = [
  {
    template_id: 'CodeAgent',
    name: '代码开发代理',
    description: '专注于代码编写、调试、重构等开发任务',
    domain: '代码开发与调试',
    keywords: ['代码', 'code', '编程', 'debug', '重构', '实现', '函数', '类', '模块'],
    default_permissions: ['file_rw', 'code_exec', 'shell_limited'],
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4-20250514',
    max_tokens_per_turn: 8192,
    system_prompt_template: `你是一个专业的代码开发助手。你的职责是：
1. 编写高质量、可维护的代码
2. 调试和修复代码问题
3. 重构和优化现有代码
4. 提供代码审查建议

工作目录: {{work_dir}}
请遵循最佳实践，保持代码整洁。`,
  },
  {
    template_id: 'ResearchAgent',
    name: '研究分析代理',
    description: '专注于信息搜集、分析、总结等研究任务',
    domain: '信息搜集与分析',
    keywords: ['研究', '分析', '调研', '搜索', '查找', '总结', '报告', '文档'],
    default_permissions: ['file_rw', 'network_read'],
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4-20250514',
    max_tokens_per_turn: 4096,
    system_prompt_template: `你是一个专业的研究分析助手。你的职责是：
1. 搜集和整理信息
2. 分析数据和趋势
3. 生成研究报告
4. 提供决策建议

工作目录: {{work_dir}}
请确保信息准确、分析深入。`,
  },
  {
    template_id: 'WriterAgent',
    name: '写作代理',
    description: '专注于文档撰写、内容创作等任务',
    domain: '文档撰写与内容创作',
    keywords: ['写作', '文档', '文章', '报告', '博客', '说明', 'README', '内容'],
    default_permissions: ['file_rw'],
    llm_provider: 'anthropic',
    llm_model: 'claude-sonnet-4-20250514',
    max_tokens_per_turn: 4096,
    system_prompt_template: `你是一个专业的写作助手。你的职责是：
1. 撰写各类文档和文章
2. 优化文字表达
3. 创建技术文档
4. 编写用户指南

工作目录: {{work_dir}}
请确保内容清晰、准确、易懂。`,
  },
  {
    template_id: 'AssistantAgent',
    name: '通用助手代理',
    description: '处理日常通用任务',
    domain: '通用任务',
    keywords: ['帮助', '协助', '处理', '完成', '执行', '通用'],
    default_permissions: ['file_rw'],
    llm_provider: 'anthropic',
    llm_model: 'claude-haiku-4-5-20251001',
    max_tokens_per_turn: 4096,
    system_prompt_template: `你是一个通用助手。你的职责是：
1. 回答用户问题
2. 执行简单任务
3. 提供帮助和建议

工作目录: {{work_dir}}
请友好、高效地完成任务。`,
  },
];

/**
 * 模板管理器
 */
export class TemplateManager {
  private config: TemplateManagerConfig;
  private templates: Map<string, AgentTemplate> = new Map();

  constructor(config?: Partial<TemplateManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadTemplates();
  }

  /**
   * 加载模板
   */
  private loadTemplates(): void {
    // 加载内置模板
    for (const template of BUILTIN_TEMPLATES) {
      this.templates.set(template.template_id, template);
    }

    // 加载自定义模板
    if (fs.existsSync(this.config.templatesDir)) {
      const files = fs.readdirSync(this.config.templatesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.config.templatesDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const template = JSON.parse(content) as AgentTemplate;
            this.templates.set(template.template_id, template);
          } catch (error) {
            console.error(`[TemplateManager] 加载模板失败: ${file}`, error);
          }
        }
      }
    }
  }

  /**
   * 获取模板
   */
  get(templateId: string): AgentTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 获取所有模板
   */
  getAll(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 添加自定义模板
   */
  add(template: AgentTemplate): void {
    this.templates.set(template.template_id, template);
    this.saveCustomTemplate(template);
  }

  /**
   * 保存自定义模板
   */
  private saveCustomTemplate(template: AgentTemplate): void {
    if (!fs.existsSync(this.config.templatesDir)) {
      fs.mkdirSync(this.config.templatesDir, { recursive: true });
    }
    const filePath = path.join(this.config.templatesDir, `${template.template_id}.json`);
    const content = JSON.stringify(template, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * 删除自定义模板
   */
  delete(templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    // 不允许删除内置模板
    if (BUILTIN_TEMPLATES.some(t => t.template_id === templateId)) {
      console.warn(`[TemplateManager] 不能删除内置模板: ${templateId}`);
      return false;
    }

    this.templates.delete(templateId);
    const filePath = path.join(this.config.templatesDir, `${templateId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  }

  /**
   * 根据关键词匹配合适的模板
   */
  matchByKeywords(keywords: string[]): AgentTemplate | undefined {
    let bestMatch: AgentTemplate | undefined;
    let bestScore = 0;

    for (const template of this.templates.values()) {
      const score = this.calculateMatchScore(keywords, template.keywords);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }

    return bestMatch;
  }

  /**
   * 计算关键词匹配分数
   */
  private calculateMatchScore(inputKeywords: string[], templateKeywords: string[]): number {
    const inputLower = inputKeywords.map(k => k.toLowerCase());
    const templateLower = templateKeywords.map(k => k.toLowerCase());
    
    let matchCount = 0;
    for (const ik of inputLower) {
      if (templateLower.some(tk => tk.includes(ik) || ik.includes(tk))) {
        matchCount++;
      }
    }
    
    return matchCount / inputKeywords.length;
  }
}

/**
 * 从模板创建子代理配置
 */
export function createConfigFromTemplate(
  template: AgentTemplate,
  options?: {
    agentId?: string;
    workDir?: string;
    permissions?: Permission[];
    customFields?: Record<string, unknown>;
  }
): AgentConfig {
  const agentId = options?.agentId || `${template.template_id}_${Date.now()}`;
  const workDir = options?.workDir || `./agents/${agentId}`;

  const capabilityProfile: CapabilityProfile = {
    skills_proven: [],
    success_count: 0,
    fail_count: 0,
    avg_tokens_per_task: 0,
    last_active: new Date().toISOString(),
  };

  const config: AgentConfig = {
    agent_id: agentId,
    domain: template.domain,
    keywords: [...template.keywords],
    permissions: options?.permissions || [...template.default_permissions],
    work_dir: workDir,
    status: 'idle',
    llm_provider: template.llm_provider,
    llm_model: template.llm_model,
    max_tokens_per_turn: template.max_tokens_per_turn,
    capability_profile: capabilityProfile,
    custom_fields: options?.customFields || {},
    created_at: new Date().toISOString(),
    template_id: template.template_id,
  };

  return config;
}

/**
 * 生成系统提示词
 */
export function generateSystemPrompt(
  template: AgentTemplate,
  workDir: string
): string {
  return template.system_prompt_template.replace('{{work_dir}}', workDir);
}

/**
 * 创建模板管理器实例
 */
export function createTemplateManager(config?: Partial<TemplateManagerConfig>): TemplateManager {
  return new TemplateManager(config);
}

export default TemplateManager;
