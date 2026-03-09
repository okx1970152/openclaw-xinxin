/**
 * 超级大龙虾 - 模板库
 * Template Library
 * 
 * 存放于 src/templates/index.ts
 * 包含预定义的子代理模板、任务模式模板、导入导出机制
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentTemplate, TaskStrategy } from '../types/core';

// ===== 预定义子代理模板 =====

/**
 * 代码开发代理模板
 */
export const CODE_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'CodeAgent',
  name: '代码开发代理',
  description: '专注于代码编写、调试、重构和代码审查',
  domain: '代码开发与调试',
  keywords: ['代码', '编写', '调试', '重构', 'bug', 'fix', 'code', 'develop', '编程', '实现'],
  permissions: ['file_rw', 'code_exec', 'shell_limited'],
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 8000,
  system_prompt_template: `你是一个专业的代码开发代理。

专业领域：代码开发与调试

核心能力：
- 编写高质量代码（支持多种编程语言）
- 调试和修复 Bug
- 代码重构和优化
- 代码审查和建议

工作原则：
1. 编写代码前先理解需求
2. 遵循项目代码规范
3. 注重代码可读性和可维护性
4. 提供清晰的代码注释

当前任务：{{task}}
项目上下文：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

/**
 * 研究分析代理模板
 */
export const RESEARCH_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'ResearchAgent',
  name: '研究分析代理',
  description: '专注于信息检索、数据分析和研究报告',
  domain: '信息检索与分析',
  keywords: ['研究', '分析', '搜索', '查询', '数据', '报告', 'research', 'analysis', '调查', '统计'],
  permissions: ['network_read'],
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 6000,
  system_prompt_template: `你是一个专业的研究分析代理。

专业领域：信息检索与分析

核心能力：
- 信息搜索和整理
- 数据分析和统计
- 报告撰写和总结
- 趋势分析和预测

工作原则：
1. 信息来源要可靠
2. 分析要有理有据
3. 结论要客观中立
4. 报告要结构清晰

当前任务：{{task}}
研究范围：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

/**
 * 内容创作代理模板
 */
export const WRITER_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'WriterAgent',
  name: '内容创作代理',
  description: '专注于文章写作、文案创作和内容优化',
  domain: '内容创作与编辑',
  keywords: ['写作', '文章', '文案', '内容', '编辑', 'write', 'content', '创作', '优化', '润色'],
  permissions: ['file_rw'],
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 10000,
  system_prompt_template: `你是一个专业的内容创作代理。

专业领域：内容创作与编辑

核心能力：
- 文章写作和编辑
- 文案创作和优化
- 内容结构设计
- 多风格写作支持

工作原则：
1. 内容要有价值
2. 结构要清晰
3. 语言要流畅
4. 风格要匹配受众

当前任务：{{task}}
写作要求：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

/**
 * 通用助手代理模板
 */
export const ASSISTANT_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'AssistantAgent',
  name: '通用助手代理',
  description: '处理通用任务和日常助手工作',
  domain: '通用助手',
  keywords: ['帮助', '助手', '咨询', '问答', '协助', 'help', 'assistant', '支持', '服务', '建议'],
  permissions: ['file_rw'],
  default_model: 'claude-haiku-4-5-20251001',
  max_tokens: 4000,
  system_prompt_template: `你是一个友好的通用助手代理。

专业领域：通用助手

核心能力：
- 问答和咨询
- 任务协助
- 信息整理
- 日程管理

工作原则：
1. 回答要准确
2. 态度要友好
3. 建议要实用
4. 沟通要高效

当前任务：{{task}}
用户需求：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

/**
 * 数据库专家代理模板
 */
export const DATABASE_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'DatabaseAgent',
  name: '数据库专家代理',
  description: '专注于数据库设计、优化和维护',
  domain: '数据库管理与优化',
  keywords: ['数据库', 'SQL', '查询', '优化', '索引', 'database', 'MySQL', 'PostgreSQL', 'MongoDB', '表结构'],
  permissions: ['file_rw', 'code_exec'],
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 6000,
  system_prompt_template: `你是一个专业的数据库专家代理。

专业领域：数据库管理与优化

核心能力：
- 数据库设计和建模
- SQL 查询优化
- 索引策略设计
- 数据迁移和备份

工作原则：
1. 设计要规范化
2. 查询要高效
3. 数据要安全
4. 变更要可追溯

当前任务：{{task}}
数据库环境：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

/**
 * 测试工程师代理模板
 */
export const TEST_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'TestAgent',
  name: '测试工程师代理',
  description: '专注于测试用例设计、自动化测试和质量保障',
  domain: '测试与质量保障',
  keywords: ['测试', '用例', '自动化', '质量', 'QA', 'test', 'unit', 'integration', 'e2e', '覆盖率'],
  permissions: ['file_rw', 'code_exec', 'shell_limited'],
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 6000,
  system_prompt_template: `你是一个专业的测试工程师代理。

专业领域：测试与质量保障

核心能力：
- 测试用例设计
- 自动化测试开发
- 测试覆盖率分析
- Bug 报告和追踪

工作原则：
1. 用例要全面
2. 边界要覆盖
3. 报告要清晰
4. 回归要严格

当前任务：{{task}}
测试范围：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

/**
 * DevOps 工程师代理模板
 */
export const DEVOPS_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'DevOpsAgent',
  name: 'DevOps 工程师代理',
  description: '专注于 CI/CD、容器化和基础设施管理',
  domain: 'DevOps 与基础设施',
  keywords: ['DevOps', 'CI/CD', 'Docker', 'Kubernetes', '部署', '流水线', '容器', 'infra', 'pipeline', '自动化'],
  permissions: ['file_rw', 'code_exec', 'shell_limited', 'network_write'],
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 6000,
  system_prompt_template: `你是一个专业的 DevOps 工程师代理。

专业领域：DevOps 与基础设施

核心能力：
- CI/CD 流水线设计
- 容器化部署
- 基础设施代码化
- 监控和告警配置

工作原则：
1. 流程要自动化
2. 环境要一致
3. 部署要可回滚
4. 监控要完善

当前任务：{{task}}
基础设施环境：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

/**
 * 安全专家代理模板
 */
export const SECURITY_AGENT_TEMPLATE: AgentTemplate = {
  template_id: 'SecurityAgent',
  name: '安全专家代理',
  description: '专注于安全审计、漏洞检测和安全加固',
  domain: '安全与合规',
  keywords: ['安全', '漏洞', '审计', '加密', '认证', 'security', 'vulnerability', 'penetration', '合规', '隐私'],
  permissions: ['file_rw', 'code_exec', 'shell_limited'],
  default_model: 'claude-sonnet-4-20250514',
  max_tokens: 6000,
  system_prompt_template: `你是一个专业的安全专家代理。

专业领域：安全与合规

核心能力：
- 安全漏洞扫描
- 代码安全审计
- 安全加固建议
- 合规性检查

工作原则：
1. 扫描要全面
2. 风险要分级
3. 建议要可行
4. 合规要严格

当前任务：{{task}}
安全范围：{{context}}

请开始执行任务。`,
  created_at: new Date().toISOString(),
};

// 所有预定义模板
export const PREDEFINED_TEMPLATES: AgentTemplate[] = [
  CODE_AGENT_TEMPLATE,
  RESEARCH_AGENT_TEMPLATE,
  WRITER_AGENT_TEMPLATE,
  ASSISTANT_AGENT_TEMPLATE,
  DATABASE_AGENT_TEMPLATE,
  TEST_AGENT_TEMPLATE,
  DEVOPS_AGENT_TEMPLATE,
  SECURITY_AGENT_TEMPLATE,
];

// ===== 预定义任务模式模板 =====

/**
 * 任务模式模板接口
 */
export interface TaskPatternTemplate {
  pattern_id: string;
  name: string;
  description: string;
  match_keywords: string[];
  input_pattern: string;
  strategy: TaskStrategy;
  recommended_agent: string;
  pitfalls: string[];
}

/**
 * 代码审查模式模板
 */
export const CODE_REVIEW_PATTERN: TaskPatternTemplate = {
  pattern_id: 'code_review',
  name: '代码审查',
  description: '对代码进行全面的审查，包括代码质量、安全性、性能等方面',
  match_keywords: ['代码审查', 'code review', '审查', 'review', '检查代码', '代码检查'],
  input_pattern: '需要审查的代码文件或代码片段',
  strategy: {
    steps: [
      '1. 读取和理解代码逻辑',
      '2. 检查代码质量和规范',
      '3. 分析潜在安全风险',
      '4. 评估性能影响',
      '5. 生成审查报告和建议',
    ],
    tool_chain: ['read_file', 'analyze_code', 'security_check', 'report_generator'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '不要只关注语法问题，要关注设计问题',
    '注意代码的可维护性和可测试性',
    '检查是否有硬编码的敏感信息',
  ],
};

/**
 * Bug 修复模式模板
 */
export const BUG_FIX_PATTERN: TaskPatternTemplate = {
  pattern_id: 'bug_fix',
  name: 'Bug 修复',
  description: '定位和修复代码中的 Bug',
  match_keywords: ['bug', '修复', 'fix', '错误', '异常', '报错', '问题', 'error', 'exception'],
  input_pattern: '问题描述或错误信息',
  strategy: {
    steps: [
      '1. 理解问题描述和预期行为',
      '2. 定位问题代码位置',
      '3. 分析问题根本原因',
      '4. 设计修复方案',
      '5. 实施修复并测试',
    ],
    tool_chain: ['search_code', 'analyze_error', 'debug', 'fix_code', 'test'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '修复前要理解完整的上下文',
    '避免引入新的问题',
    '修复后要进行回归测试',
  ],
};

/**
 * 文档生成模式模板
 */
export const DOC_GENERATION_PATTERN: TaskPatternTemplate = {
  pattern_id: 'doc_generation',
  name: '文档生成',
  description: '生成代码文档、API 文档或用户手册',
  match_keywords: ['文档', 'document', 'doc', 'API文档', '说明', '手册', 'README'],
  input_pattern: '需要文档化的代码或功能',
  strategy: {
    steps: [
      '1. 分析代码结构和功能',
      '2. 提取关键接口和参数',
      '3. 编写文档内容',
      '4. 添加示例代码',
      '5. 格式化和润色',
    ],
    tool_chain: ['analyze_code', 'extract_api', 'write_doc', 'format'],
  },
  recommended_agent: 'WriterAgent',
  pitfalls: [
    '文档要与代码保持同步',
    '示例代码要可运行',
    '避免过度技术化，要面向目标读者',
  ],
};

/**
 * 数据分析模式模板
 */
export const DATA_ANALYSIS_PATTERN: TaskPatternTemplate = {
  pattern_id: 'data_analysis',
  name: '数据分析',
  description: '对数据进行统计分析和可视化',
  match_keywords: ['数据分析', '统计', '分析', 'analysis', 'data', '报表', '可视化', '图表'],
  input_pattern: '数据源和分析需求',
  strategy: {
    steps: [
      '1. 数据采集和清洗',
      '2. 数据统计和聚合',
      '3. 趋势和模式识别',
      '4. 可视化展示',
      '5. 结论和建议',
    ],
    tool_chain: ['read_data', 'clean_data', 'analyze', 'visualize', 'report'],
  },
  recommended_agent: 'ResearchAgent',
  pitfalls: [
    '确保数据质量',
    '注意数据隐私',
    '结论要有数据支撑',
  ],
};

/**
 * 测试用例生成模式模板
 */
export const TEST_GENERATION_PATTERN: TaskPatternTemplate = {
  pattern_id: 'test_generation',
  name: '测试用例生成',
  description: '为代码生成单元测试或集成测试',
  match_keywords: ['测试用例', '单元测试', 'unit test', '测试', 'test case', '覆盖率', '测试代码'],
  input_pattern: '需要测试的代码',
  strategy: {
    steps: [
      '1. 分析代码逻辑和边界',
      '2. 设计测试用例',
      '3. 编写测试代码',
      '4. 执行测试验证',
      '5. 优化测试覆盖',
    ],
    tool_chain: ['analyze_code', 'design_test', 'write_test', 'run_test', 'coverage'],
  },
  recommended_agent: 'TestAgent',
  pitfalls: [
    '覆盖边界条件',
    '测试要独立和可重复',
    '避免过度 Mock',
  ],
};

/**
 * 重构模式模板
 */
export const REFACTOR_PATTERN: TaskPatternTemplate = {
  pattern_id: 'refactor',
  name: '代码重构',
  description: '优化代码结构，提高代码质量',
  match_keywords: ['重构', 'refactor', '优化', '重构代码', '改进', '清理', '优化结构'],
  input_pattern: '需要重构的代码',
  strategy: {
    steps: [
      '1. 理解现有代码结构',
      '2. 识别重构目标',
      '3. 设计重构方案',
      '4. 小步重构实施',
      '5. 验证功能正确性',
    ],
    tool_chain: ['analyze_code', 'design', 'refactor', 'test', 'verify'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '保持功能不变',
    '小步提交',
    '确保测试通过',
  ],
};

/**
 * API 设计模式模板
 */
export const API_DESIGN_PATTERN: TaskPatternTemplate = {
  pattern_id: 'api_design',
  name: 'API 设计',
  description: '设计和实现 RESTful API 或 GraphQL API',
  match_keywords: ['API', '接口', 'REST', 'GraphQL', 'endpoint', '接口设计', 'API设计'],
  input_pattern: '功能需求和数据模型',
  strategy: {
    steps: [
      '1. 分析业务需求',
      '2. 设计 API 结构',
      '3. 定义数据模型',
      '4. 实现接口逻辑',
      '5. 编写 API 文档',
    ],
    tool_chain: ['design_api', 'define_schema', 'implement', 'document'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '遵循 RESTful 规范',
    '做好版本管理',
    '完善的错误处理',
  ],
};

/**
 * 性能优化模式模板
 */
export const PERFORMANCE_OPT_PATTERN: TaskPatternTemplate = {
  pattern_id: 'performance_opt',
  name: '性能优化',
  description: '分析并优化系统性能瓶颈',
  match_keywords: ['性能', '优化', '慢', '性能优化', 'performance', '加速', '响应时间', '内存泄漏', 'CPU'],
  input_pattern: '性能问题描述或需要优化的代码/系统',
  strategy: {
    steps: [
      '1. 性能问题诊断和基准测试',
      '2. 瓶颈识别（CPU/内存/IO）',
      '3. 优化方案设计',
      '4. 优化实施',
      '5. 性能对比验证',
    ],
    tool_chain: ['profile', 'analyze', 'optimize', 'benchmark', 'verify'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '优化前要有基准数据',
    '避免过早优化',
    '注意优化的可维护性',
  ],
};

/**
 * 安全审计模式模板
 */
export const SECURITY_AUDIT_PATTERN: TaskPatternTemplate = {
  pattern_id: 'security_audit',
  name: '安全审计',
  description: '对代码或系统进行安全审计',
  match_keywords: ['安全', '审计', '漏洞', '安全审计', 'security', 'vulnerability', '渗透', '风险'],
  input_pattern: '需要审计的代码或系统',
  strategy: {
    steps: [
      '1. 资产识别和威胁建模',
      '2. 漏洞扫描和分析',
      '3. 风险等级评估',
      '4. 修复建议',
      '5. 验证和报告',
    ],
    tool_chain: ['scan', 'analyze', 'assess', 'recommend', 'verify'],
  },
  recommended_agent: 'SecurityAgent',
  pitfalls: [
    '全面覆盖各类漏洞',
    '注意误报和漏报',
    '修复要验证有效性',
  ],
};

/**
 * 代码生成模式模板
 */
export const CODE_GENERATION_PATTERN: TaskPatternTemplate = {
  pattern_id: 'code_generation',
  name: '代码生成',
  description: '根据需求描述生成代码',
  match_keywords: ['生成代码', '编写代码', '代码生成', '实现', '开发', 'create', 'implement', '开发功能'],
  input_pattern: '功能需求描述',
  strategy: {
    steps: [
      '1. 理解需求和约束条件',
      '2. 设计代码结构',
      '3. 编写代码实现',
      '4. 代码审查',
      '5. 测试验证',
    ],
    tool_chain: ['analyze', 'design', 'code', 'review', 'test'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '确保理解需求',
    '遵循项目规范',
    '添加必要注释',
  ],
};

/**
 * 依赖升级模式模板
 */
export const DEPENDENCY_UPGRADE_PATTERN: TaskPatternTemplate = {
  pattern_id: 'dependency_upgrade',
  name: '依赖升级',
  description: '升级项目依赖并处理兼容性问题',
  match_keywords: ['升级', '依赖', '更新', 'upgrade', 'dependency', 'npm', 'package', '版本'],
  input_pattern: '需要升级的依赖信息',
  strategy: {
    steps: [
      '1. 分析当前依赖版本',
      '2. 检查 Breaking Changes',
      '3. 制定升级计划',
      '4. 执行升级',
      '5. 兼容性测试',
    ],
    tool_chain: ['analyze', 'check', 'plan', 'upgrade', 'test'],
  },
  recommended_agent: 'DevOpsAgent',
  pitfalls: [
    '先检查 Breaking Changes',
    '小步升级',
    '充分测试',
  ],
};

/**
 * 日志分析模式模板
 */
export const LOG_ANALYSIS_PATTERN: TaskPatternTemplate = {
  pattern_id: 'log_analysis',
  name: '日志分析',
  description: '分析日志文件，提取有价值的信息',
  match_keywords: ['日志', '分析', 'log', '排查', '调试', '错误日志', '日志分析'],
  input_pattern: '日志文件或日志来源',
  strategy: {
    steps: [
      '1. 收集和解析日志',
      '2. 过滤和聚合',
      '3. 异常识别',
      '4. 根因分析',
      '5. 生成报告',
    ],
    tool_chain: ['collect', 'parse', 'filter', 'analyze', 'report'],
  },
  recommended_agent: 'ResearchAgent',
  pitfalls: [
    '注意日志格式差异',
    '保护敏感信息',
    '关联分析多维度',
  ],
};

/**
 * 配置管理模式模板
 */
export const CONFIG_MANAGEMENT_PATTERN: TaskPatternTemplate = {
  pattern_id: 'config_management',
  name: '配置管理',
  description: '管理系统配置和环境变量',
  match_keywords: ['配置', '环境变量', 'config', 'env', '设置', '配置管理', '部署配置'],
  input_pattern: '配置需求或问题',
  strategy: {
    steps: [
      '1. 分析配置需求',
      '2. 设计配置结构',
      '3. 实现配置管理',
      '4. 验证配置正确性',
      '5. 文档化',
    ],
    tool_chain: ['analyze', 'design', 'implement', 'verify', 'document'],
  },
  recommended_agent: 'DevOpsAgent',
  pitfalls: [
    '敏感信息加密',
    '配置版本管理',
    '环境隔离',
  ],
};

/**
 * 数据迁移模式模板
 */
export const DATA_MIGRATION_PATTERN: TaskPatternTemplate = {
  pattern_id: 'data_migration',
  name: '数据迁移',
  description: '设计和执行数据迁移方案',
  match_keywords: ['迁移', '数据迁移', 'migration', '导入', '导出', '数据库迁移'],
  input_pattern: '迁移需求和源/目标信息',
  strategy: {
    steps: [
      '1. 分析源数据和目标结构',
      '2. 设计迁移方案',
      '3. 编写迁移脚本',
      '4. 测试迁移',
      '5. 执行和验证',
    ],
    tool_chain: ['analyze', 'design', 'script', 'test', 'execute'],
  },
  recommended_agent: 'DatabaseAgent',
  pitfalls: [
    '备份原数据',
    '处理数据冲突',
    '验证迁移完整性',
  ],
};

/**
 * 翻译本地化模式模板
 */
export const LOCALIZATION_PATTERN: TaskPatternTemplate = {
  pattern_id: 'localization',
  name: '翻译本地化',
  description: '翻译和本地化内容',
  match_keywords: ['翻译', '本地化', 'translate', 'i18n', 'l10n', '多语言', '国际化'],
  input_pattern: '需要翻译或本地化的内容',
  strategy: {
    steps: [
      '1. 识别翻译内容',
      '2. 提取翻译字符串',
      '3. 翻译处理',
      '4. 格式适配',
      '5. 验证和调整',
    ],
    tool_chain: ['extract', 'translate', 'format', 'validate', 'adjust'],
  },
  recommended_agent: 'WriterAgent',
  pitfalls: [
    '保持术语一致性',
    '注意文化差异',
    '处理格式化字符串',
  ],
};

/**
 * 问题排查模式模板
 */
export const TROUBLESHOOTING_PATTERN: TaskPatternTemplate = {
  pattern_id: 'troubleshooting',
  name: '问题排查',
  description: '系统性排查和解决问题',
  match_keywords: ['排查', '问题', '调试', 'troubleshoot', 'debug', '诊断', '解决'],
  input_pattern: '问题描述和上下文',
  strategy: {
    steps: [
      '1. 问题复现和记录',
      '2. 收集诊断信息',
      '3. 假设验证',
      '4. 根因定位',
      '5. 解决和预防',
    ],
    tool_chain: ['reproduce', 'collect', 'hypothesize', 'verify', 'solve'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '系统化排查',
    '记录排查过程',
    '验证解决方案',
  ],
};

/**
 * 代码搜索模式模板
 */
export const CODE_SEARCH_PATTERN: TaskPatternTemplate = {
  pattern_id: 'code_search',
  name: '代码搜索',
  description: '在代码库中搜索特定模式的代码',
  match_keywords: ['搜索', '查找', 'search', 'find', 'grep', '定位', '检索'],
  input_pattern: '搜索关键词或模式',
  strategy: {
    steps: [
      '1. 理解搜索目标',
      '2. 设计搜索模式',
      '3. 执行搜索',
      '4. 结果过滤和排序',
      '5. 结果展示',
    ],
    tool_chain: ['analyze', 'pattern', 'search', 'filter', 'display'],
  },
  recommended_agent: 'ResearchAgent',
  pitfalls: [
    '使用精确的搜索模式',
    '排除干扰结果',
    '关联相关代码',
  ],
};

/**
 * 架构设计模式模板
 */
export const ARCHITECTURE_DESIGN_PATTERN: TaskPatternTemplate = {
  pattern_id: 'architecture_design',
  name: '架构设计',
  description: '设计和规划系统架构',
  match_keywords: ['架构', '设计', 'architecture', '结构', '系统设计', '架构设计', '技术选型'],
  input_pattern: '系统需求和技术约束',
  strategy: {
    steps: [
      '1. 分析业务需求',
      '2. 设计架构方案',
      '3. 技术选型',
      '4. 架构评审',
      '5. 架构文档',
    ],
    tool_chain: ['analyze', 'design', 'select', 'review', 'document'],
  },
  recommended_agent: 'CodeAgent',
  pitfalls: [
    '考虑扩展性',
    '平衡复杂度',
    '文档化决策',
  ],
};

/**
 * 单元测试执行模式模板
 */
export const UNIT_TEST_EXEC_PATTERN: TaskPatternTemplate = {
  pattern_id: 'unit_test_exec',
  name: '单元测试执行',
  description: '执行单元测试并分析结果',
  match_keywords: ['执行测试', '运行测试', '单元测试', 'run test', 'test', '测试执行'],
  input_pattern: '测试目标或测试文件',
  strategy: {
    steps: [
      '1. 确定测试范围',
      '2. 准备测试环境',
      '3. 执行测试',
      '4. 分析测试结果',
      '5. 生成报告',
    ],
    tool_chain: ['prepare', 'execute', 'analyze', 'report', 'fix'],
  },
  recommended_agent: 'TestAgent',
  pitfalls: [
    '隔离测试环境',
    '处理测试依赖',
    '分析失败原因',
  ],
};

/**
 * 环境搭建模式模板
 */
export const ENVIRONMENT_SETUP_PATTERN: TaskPatternTemplate = {
  pattern_id: 'environment_setup',
  name: '环境搭建',
  description: '搭建开发或部署环境',
  match_keywords: ['环境', '搭建', '安装', 'setup', 'install', '配置环境', '部署环境'],
  input_pattern: '环境需求和配置信息',
  strategy: {
    steps: [
      '1. 分析环境需求',
      '2. 准备安装包和依赖',
      '3. 执行安装配置',
      '4. 验证环境',
      '5. 文档化',
    ],
    tool_chain: ['analyze', 'prepare', 'install', 'verify', 'document'],
  },
  recommended_agent: 'DevOpsAgent',
  pitfalls: [
    '记录安装步骤',
    '版本兼容性检查',
    '环境隔离',
  ],
};

// 所有预定义任务模式模板
export const PREDEFINED_PATTERNS: TaskPatternTemplate[] = [
  CODE_REVIEW_PATTERN,
  BUG_FIX_PATTERN,
  DOC_GENERATION_PATTERN,
  DATA_ANALYSIS_PATTERN,
  TEST_GENERATION_PATTERN,
  REFACTOR_PATTERN,
  API_DESIGN_PATTERN,
  PERFORMANCE_OPT_PATTERN,
  SECURITY_AUDIT_PATTERN,
  CODE_GENERATION_PATTERN,
  DEPENDENCY_UPGRADE_PATTERN,
  LOG_ANALYSIS_PATTERN,
  CONFIG_MANAGEMENT_PATTERN,
  DATA_MIGRATION_PATTERN,
  LOCALIZATION_PATTERN,
  TROUBLESHOOTING_PATTERN,
  CODE_SEARCH_PATTERN,
  ARCHITECTURE_DESIGN_PATTERN,
  UNIT_TEST_EXEC_PATTERN,
  ENVIRONMENT_SETUP_PATTERN,
];

// ===== 模板库管理器 =====

/**
 * 模板库配置
 */
export interface TemplateLibraryConfig {
  /** 模板存储路径 */
  templatePath: string;
  /** 模式存储路径 */
  patternPath: string;
  /** 是否自动加载预定义模板 */
  loadPredefined: boolean;
}

/**
 * 模板库管理器
 */
export class TemplateLibrary {
  private config: TemplateLibraryConfig;
  private templates: Map<string, AgentTemplate> = new Map();
  private patterns: Map<string, TaskPatternTemplate> = new Map();

  constructor(config?: Partial<TemplateLibraryConfig>) {
    this.config = {
      templatePath: config?.templatePath || './templates/agents',
      patternPath: config?.patternPath || './templates/patterns',
      loadPredefined: config?.loadPredefined ?? true,
    };

    // 加载预定义模板
    if (this.config.loadPredefined) {
      this.loadPredefinedTemplates();
    }
  }

  /**
   * 加载预定义模板
   */
  private loadPredefinedTemplates(): void {
    // 加载代理模板
    for (const template of PREDEFINED_TEMPLATES) {
      this.templates.set(template.template_id, template);
    }

    // 加载任务模式模板
    for (const pattern of PREDEFINED_PATTERNS) {
      this.patterns.set(pattern.pattern_id, pattern);
    }

    console.log(`[TemplateLibrary] 加载预定义模板: ${this.templates.size} 个代理, ${this.patterns.size} 个模式`);
  }

  // ===== 代理模板操作 =====

  /**
   * 获取代理模板
   */
  getAgentTemplate(templateId: string): AgentTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 获取所有代理模板
   */
  getAllAgentTemplates(): AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 注册代理模板
   */
  registerAgentTemplate(template: AgentTemplate): void {
    this.templates.set(template.template_id, template);
  }

  /**
   * 移除代理模板
   */
  removeAgentTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  /**
   * 按关键词匹配代理模板
   */
  matchAgentTemplate(keywords: string[]): AgentTemplate | undefined {
    let bestMatch: AgentTemplate | undefined;
    let bestScore = 0;

    const lowerKeywords = keywords.map(k => k.toLowerCase());

    for (const template of this.templates.values()) {
      const templateKeywords = template.keywords.map(k => k.toLowerCase());
      let score = 0;

      for (const keyword of lowerKeywords) {
        for (const templateKeyword of templateKeywords) {
          if (templateKeyword.includes(keyword) || keyword.includes(templateKeyword)) {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = template;
      }
    }

    return bestMatch;
  }

  // ===== 任务模式操作 =====

  /**
   * 获取任务模式模板
   */
  getPatternTemplate(patternId: string): TaskPatternTemplate | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * 获取所有任务模式模板
   */
  getAllPatternTemplates(): TaskPatternTemplate[] {
    return Array.from(this.patterns.values());
  }

  /**
   * 注册任务模式模板
   */
  registerPatternTemplate(pattern: TaskPatternTemplate): void {
    this.patterns.set(pattern.pattern_id, pattern);
  }

  /**
   * 移除任务模式模板
   */
  removePatternTemplate(patternId: string): boolean {
    return this.patterns.delete(patternId);
  }

  /**
   * 按关键词匹配任务模式
   */
  matchPatternTemplate(keywords: string[]): TaskPatternTemplate | undefined {
    let bestMatch: TaskPatternTemplate | undefined;
    let bestScore = 0;

    const lowerKeywords = keywords.map(k => k.toLowerCase());

    for (const pattern of this.patterns.values()) {
      const patternKeywords = pattern.match_keywords.map(k => k.toLowerCase());
      let score = 0;

      for (const keyword of lowerKeywords) {
        for (const patternKeyword of patternKeywords) {
          if (patternKeyword.includes(keyword) || keyword.includes(patternKeyword)) {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    return bestMatch;
  }

  // ===== 导入导出 =====

  /**
   * 导出所有模板
   */
  exportAll(): {
    agentTemplates: AgentTemplate[];
    patternTemplates: TaskPatternTemplate[];
    exportedAt: string;
    version: string;
  } {
    return {
      agentTemplates: this.getAllAgentTemplates(),
      patternTemplates: this.getAllPatternTemplates(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * 导出为 JSON 文件
   */
  exportToFile(filePath: string): void {
    const data = this.exportAll();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[TemplateLibrary] 导出模板到: ${filePath}`);
  }

  /**
   * 从 JSON 文件导入
   */
  importFromFile(filePath: string): {
    agentTemplatesCount: number;
    patternTemplatesCount: number;
  } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    let agentTemplatesCount = 0;
    let patternTemplatesCount = 0;

    // 导入代理模板
    if (data.agentTemplates && Array.isArray(data.agentTemplates)) {
      for (const template of data.agentTemplates) {
        this.templates.set(template.template_id, template);
        agentTemplatesCount++;
      }
    }

    // 导入任务模式模板
    if (data.patternTemplates && Array.isArray(data.patternTemplates)) {
      for (const pattern of data.patternTemplates) {
        this.patterns.set(pattern.pattern_id, pattern);
        patternTemplatesCount++;
      }
    }

    console.log(`[TemplateLibrary] 从 ${filePath} 导入: ${agentTemplatesCount} 个代理模板, ${patternTemplatesCount} 个模式模板`);

    return {
      agentTemplatesCount,
      patternTemplatesCount,
    };
  }

  /**
   * 导入代理模板
   */
  importAgentTemplates(templates: AgentTemplate[]): number {
    let count = 0;
    for (const template of templates) {
      this.templates.set(template.template_id, template);
      count++;
    }
    return count;
  }

  /**
   * 导入任务模式模板
   */
  importPatternTemplates(patterns: TaskPatternTemplate[]): number {
    let count = 0;
    for (const pattern of patterns) {
      this.patterns.set(pattern.pattern_id, pattern);
      count++;
    }
    return count;
  }

  // ===== 统计信息 =====

  /**
   * 获取统计信息
   */
  getStats(): {
    agentTemplatesCount: number;
    patternTemplatesCount: number;
    agentTemplatesByDomain: Record<string, number>;
  } {
    const agentTemplatesByDomain: Record<string, number> = {};

    for (const template of this.templates.values()) {
      const domain = template.domain;
      agentTemplatesByDomain[domain] = (agentTemplatesByDomain[domain] || 0) + 1;
    }

    return {
      agentTemplatesCount: this.templates.size,
      patternTemplatesCount: this.patterns.size,
      agentTemplatesByDomain,
    };
  }
}

// 导出单例创建函数
let instance: TemplateLibrary | null = null;

export function getTemplateLibrary(config?: Partial<TemplateLibraryConfig>): TemplateLibrary {
  if (!instance) {
    instance = new TemplateLibrary(config);
  }
  return instance;
}

export function createTemplateLibrary(config?: Partial<TemplateLibraryConfig>): TemplateLibrary {
  return new TemplateLibrary(config);
}
