/**
 * 超级大龙虾 - 全局核心类型定义
 * Global Core Type Definitions
 * 
 * 存放于 src/types/core.ts
 * 所有模块共享的基础类型
 */

// ==================== 统一消息格式 ====================

/** 消息来源平台 */
export type MessageSource = 'cli' | 'telegram';

/** 附件类型 */
export type AttachmentType = 'file' | 'image' | 'audio' | 'video';

/** 附件信息 */
export interface Attachment {
  /** 附件类型 */
  type: AttachmentType;
  /** 本地文件路径 */
  path: string;
  /** MIME 类型 */
  mime_type: string;
  /** 文件大小（字节） */
  size_bytes: number;
}

/** 统一消息格式 - 所有入口消息转换为该格式 */
export interface UnifiedMessage {
  /** 消息来源平台 */
  source: MessageSource;
  /** 用户唯一标识 */
  user_id: string;
  /** 消息内容 */
  content: string;
  /** 时间戳 (ISO8601) */
  timestamp: string;
  /** 附件列表 */
  attachments: Attachment[];
  /** 原始平台消息ID（可选） */
  message_id?: string;
  /** 会话/线程ID（用于多轮对话） */
  thread_id?: string;
}

// ==================== 子代理配置类型 ====================

/** 子代理状态 */
export type AgentStatus = 'active' | 'idle' | 'hibernating' | 'destroying';

/** 权限类型 */
export type Permission = 
  | 'file_rw'        // 文件读写
  | 'code_exec'      // 代码执行
  | 'shell_limited'  // 受限 Shell
  | 'network_read'   // 网络读取
  | 'network_write'; // 网络写入

/** 能力画像 - 动态更新的子代理能力评估 */
export interface CapabilityProfile {
  /** 已验证的技能标签 */
  skills_proven: string[];
  /** 成功任务计数 */
  success_count: number;
  /** 失败任务计数 */
  fail_count: number;
  /** 滑动平均每任务 Token 消耗 */
  avg_tokens_per_task: number;
  /** 最后活跃时间 (ISO8601) */
  last_active: string;
}

/** 子代理配置 */
export interface AgentConfig {
  /** 代理唯一ID，如 'CodeAgent_001' */
  agent_id: string;
  /** 领域描述，如 '代码开发与调试' */
  domain: string;
  /** 领域关键词，用于路由匹配 */
  keywords: string[];
  /** 权限列表 */
  permissions: Permission[];
  /** 工作目录 */
  work_dir: string;
  /** 当前状态 */
  status: AgentStatus;
  /** LLM 提供商 */
  llm_provider: string;
  /** LLM 模型名称 */
  llm_model: string;
  /** 每轮最大 Token 数 */
  max_tokens_per_turn: number;
  /** 能力画像 */
  capability_profile: CapabilityProfile;
  /** 自定义字段 */
  custom_fields: Record<string, unknown>;
  /** 创建时间 (ISO8601) */
  created_at: string;
  /** 模板ID（如果是从模板创建的） */
  template_id?: string;
  /** 克隆来源代理ID（如果是克隆的） */
  cloned_from?: string;
}

// ==================== 子代理执行结果 ====================

/** 错误码 */
export type ErrorCode =
  | 'LLM_TIMEOUT'        // LLM API 超时
  | 'LLM_RATE_LIMIT'     // LLM API 限流
  | 'LLM_ERROR'          // LLM API 其他错误
  | 'TOKEN_LIMIT'        // 达到 Token 上限
  | 'PERMISSION_DENIED'  // 权限不足
  | 'FILE_NOT_FOUND'     // 文件不存在
  | 'EXEC_FAILED'        // 命令执行失败
  | 'MEMORY_OVERFLOW'    // 记忆文件超限
  | 'CANCELLED'          // 任务被取消
  | 'MAX_RETRY_EXCEEDED' // 重试次数超限
  | 'UNKNOWN';           // 未知错误

/** 子代理执行结果 */
export interface AgentResult {
  /** 执行状态 */
  status: 'success' | 'failure' | 'partial';
  /** 执行结果摘要 */
  result: string;
  /** 本次消耗的 Token 数 */
  tokens_used: number;
  /** 错误码（失败时） */
  error_code?: ErrorCode;
  /** 错误详情（失败时） */
  error_detail?: string;
  /** 新创建的文件路径列表 */
  files_created?: string[];
  /** 修改的文件路径列表 */
  files_modified?: string[];
  /** 执行耗时（毫秒） */
  duration_ms?: number;
}

// ==================== 任务队列类型 ====================

/** 任务优先级 */
export type TaskPriority = 'urgent' | 'normal' | 'low';

/** 任务状态 */
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

/** 任务项 */
export interface TaskItem {
  /** 任务唯一ID (UUID) */
  task_id: string;
  /** 任务描述 */
  content: string;
  /** 原始消息 */
  source_message: UnifiedMessage;
  /** 优先级 */
  priority: TaskPriority;
  /** 分配的子代理ID */
  assigned_agent?: string;
  /** 匹配到的任务模式ID */
  matched_pattern?: string;
  /** 创建时间 (ISO8601) */
  created_at: string;
  /** 任务状态 */
  status: TaskStatus;
  /** 执行开始时间 (ISO8601) */
  started_at?: string;
  /** 执行结束时间 (ISO8601) */
  completed_at?: string;
  /** 执行结果 */
  result?: AgentResult;
  /** 失败重试次数 */
  retry_count?: number;
}

// ==================== 模型选择类型 ====================

/** 模型选择结果 */
export interface ModelChoice {
  /** 提供商名称，如 'anthropic' */
  provider: string;
  /** 模型名称，如 'claude-haiku-4-5-20251001' */
  model: string;
  /** 选择原因（日志用） */
  reason: string;
}

/** Token 限流状态 */
export interface LimitStatus {
  /** 是否允许执行 */
  allowed: boolean;
  /** 小时剩余额度 */
  hourly_remaining: number;
  /** 日剩余额度 */
  daily_remaining: number;
  /** 拒绝原因（不允许时） */
  reason?: string;
}

/** Token 使用统计 */
export interface UsageStats {
  /** 小时已用量 */
  hourly_used: number;
  /** 小时限额 */
  hourly_limit: number;
  /** 日已用量 */
  daily_used: number;
  /** 日限额 */
  daily_limit: number;
  /** 总用量 */
  total_used: number;
}

// ==================== 子代理模板类型 ====================

/** 子代理模板定义 */
export interface AgentTemplate {
  /** 模板唯一ID */
  template_id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 领域描述 */
  domain: string;
  /** 关键词 */
  keywords: string[];
  /** 默认权限 */
  default_permissions: Permission[];
  /** LLM 提供商 */
  llm_provider: string;
  /** LLM 模型 */
  llm_model: string;
  /** 每轮最大 Token */
  max_tokens_per_turn: number;
  /** 系统提示词模板 */
  system_prompt_template: string;
  /** 初始永久记忆（可选） */
  initial_perm_mem?: PermMemEntry[];
}

// ==================== 记忆系统类型（从 memory-kw/types.ts 导入） ====================

/** 永久记忆分类 */
export type PermMemCategory =
  | '子代理能力'
  | '路由规则'
  | '协作流程'
  | '创建模板'
  | '失败结论'
  | '成功流程';

/** 关系标签 */
export interface RelationTag {
  /** 项目名称 */
  project: string;
  /** 子代理ID */
  agent: string;
  /** 技术栈 */
  tech_stack: string[];
  /** 关联的任务模式ID */
  related_patterns: string[];
}

/** 永久记忆条目 */
export interface PermMemEntry {
  /** 条目唯一ID，如 'pm_001' */
  id: string;
  /** 分类 */
  category: PermMemCategory;
  /** 核心关键词（3-5个） */
  keywords: string[];
  /** 摘要（≤200字） */
  summary: string;
  /** 关系标签 */
  relations: RelationTag;
  /** 实际存在的文件路径 */
  file_refs: string[];
  /** 避坑点 */
  pitfalls: string[];
  /** 创建时间 (ISO8601) */
  created_at: string;
}

/** 临时记忆条目 */
export interface TempMemEntry {
  /** 条目唯一ID */
  id: string;
  /** 时间戳 (ISO8601) */
  timestamp: string;
  /** 角色 */
  role: 'user' | 'assistant' | 'system';
  /** 内容 */
  content: string;
  /** 钉住标记（剪裁时跳过） */
  pinned: boolean;
  /** 钉住原因 */
  pin_reason?: string;
}

// ==================== 任务模式类型 ====================

/** 任务执行策略 */
export interface TaskStrategy {
  /** 执行步骤描述 */
  steps: string[];
  /** 使用的工具链 */
  tool_chain: string[];
}

/** 任务执行性能统计 */
export interface TaskPerformance {
  /** 平均 Token 消耗 */
  avg_tokens: number;
  /** 平均执行时长（秒） */
  avg_duration_sec: number;
  /** 成功率 (0-1) */
  success_rate: number;
}

/** 任务模式 */
export interface TaskPattern {
  /** 模式唯一ID */
  pattern_id: string;
  /** 任务类型描述 */
  task_type: string;
  /** 匹配关键词 */
  match_keywords: string[];
  /** 输入特征描述 */
  input_pattern: string;
  /** 执行策略 */
  strategy: TaskStrategy;
  /** 推荐的子代理ID */
  assigned_agent: string;
  /** 性能统计 */
  performance: TaskPerformance;
  /** 避坑点 */
  pitfalls: string[];
  /** 创建时间 (ISO8601) */
  created_at: string;
  /** 使用次数 */
  used_count: number;
}

// ==================== 安全审查类型 ====================

/** 审查层级 */
export type AuditLayer = 1 | 2 | 3 | 4 | 5;

/** 风险等级 */
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

/** 审查检查项名称 */
export type AuditCheckName =
  | 'yaml_permissions'      // 层级1: YAML 权限
  | 'dangerous_commands'    // 层级2: 危险命令
  | 'network_requests'      // 层级3: 网络请求
  | 'prompt_injection'      // 层级4: Prompt 注入
  | 'sensitive_file_access'; // 层级5: 敏感文件访问

/** 审查检查项结果 */
export interface AuditCheck {
  /** 检查层级 */
  layer: AuditLayer;
  /** 检查项名称 */
  name: AuditCheckName;
  /** 是否通过 */
  passed: boolean;
  /** 发现的问题列表 */
  findings: string[];
}

/** 审查报告 */
export interface AuditReport {
  /** Skill 名称 */
  skill_name: string;
  /** 是否通过审查 */
  passed: boolean;
  /** 各层检查结果 */
  checks: AuditCheck[];
  /** 风险等级 */
  risk_level: RiskLevel;
  /** 给用户的建议 */
  recommendation: string;
}

// ==================== 验证相关类型 ====================

/** 验证严重程度 */
export type ValidationSeverity = 'ok' | 'minor' | 'major';

/** 验证检查项名称 */
export type ValidationCheckName =
  | 'file_path_exists'     // 步骤1: 文件路径真实性
  | 'keyword_in_source'    // 步骤2: 关键词回溯
  | 'relations_consistent' // 步骤3: 关系一致性
  | 'format_compliant';    // 步骤4: 格式合规

/** 验证检查项结果 */
export interface ValidationCheck {
  /** 检查项名称 */
  name: ValidationCheckName;
  /** 是否通过 */
  passed: boolean;
  /** 检查结果详情 */
  detail: string;
  /** 被剔除的项目 */
  removed_items?: string[];
}

/** 验证报告 */
export interface ValidationReport {
  /** 是否通过验证 */
  passed: boolean;
  /** 严重程度 */
  severity: ValidationSeverity;
  /** 各项检查结果 */
  checks: ValidationCheck[];
  /** 自动修复的内容描述 */
  auto_fixes: string[];
}

// ==================== 检索相关类型 ====================

/** 检索来源 */
export type SearchSource = 'keyword' | 'fts5' | 'semantic';

/** 检索结果 */
export interface SearchResult {
  /** 文件名 */
  file_name: string;
  /** 文件路径 */
  file_path: string;
  /** 匹配的关键词 */
  keywords: string[];
  /** 摘要（不返回全文！） */
  summary: string;
  /** 匹配分数 (0-1) */
  match_score: number;
  /** 检索来源 */
  source: SearchSource;
}

/** 索引统计 */
export interface IndexStats {
  /** 总文件数 */
  total_files: number;
  /** 总关键词数 */
  total_keywords: number;
  /** 最后构建时间 */
  last_built: string;
  /** 索引大小（字节） */
  size_bytes: number;
}

// ==================== 提练相关类型 ====================

/** 提练结果 */
export interface RefinementResult {
  /** 提练出的条目列表 */
  entries: PermMemEntry[];
  /** 验证报告 */
  validation: ValidationReport;
  /** 是否需要人工确认 */
  requires_confirmation: boolean;
  /** temp_mem 快照备份路径 */
  archived_path: string;
}

/** 确认策略类型 */
export type ConfirmationStrategy = 'auto' | 'confirm' | 'force_confirm';

// ==================== 注册表相关类型 ====================

/** 注册表条目 */
export interface RegistryEntry {
  /** 代理ID */
  agent_id: string;
  /** 代理配置 */
  config: AgentConfig;
  /** 注册时间 (ISO8601) */
  registered_at: string;
  /** 是否是克隆代理 */
  is_clone: boolean;
  /** 克隆来源代理ID（如果是克隆的） */
  cloned_from?: string;
}

/** 代理注册表 */
export interface AgentRegistry {
  /** 注册表版本 */
  version: string;
  /** 最后更新时间 (ISO8601) */
  updated_at: string;
  /** 代理列表 */
  agents: RegistryEntry[];
}
