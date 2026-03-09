/**
 * 超级大龙虾 - 子代理模块入口
 * Child Agent Module Entry
 * 
 * 存放于 src/agents/index.ts
 */

// 导出类型
export * from './types';

// 导出生命周期管理
export { ChildAgent, ChildAgentFactory, createChildAgent } from './lifecycle';

// 导出注册表
export { AgentRegistry, createAgentRegistry } from './registry';
export type { RegistryConfig, RegistryStats } from './registry';

// 导出模板管理
export {
  TemplateManager,
  createTemplateManager,
  createConfigFromTemplate,
  generateSystemPrompt,
} from './template';
export type { TemplateManagerConfig } from './template';

// 导出安全审查
export { SecurityAgent, createSecurityAgent } from './security';
export type { SecurityAuditConfig, ISecurityAgent } from './security';

// 导出能力画像更新器
export { ProfileUpdater, createProfileUpdater } from './profile';
export type { ProfileUpdaterConfig, IProfileUpdater } from './profile';

// 导出代理克隆器
export { AgentCloner, createAgentCloner } from './clone';
export type { CloneConfig, CloneResult, IAgentCloner } from './clone';

// 导出 Worker 线程池
export { WorkerPool, isMainThread } from './worker';
export type {
  WorkerMessage,
  TaskStartPayload,
  TaskProgressPayload,
  TaskCompletePayload,
  TaskErrorPayload,
  WorkerTaskOptions,
  WorkerPoolConfig,
  WorkerTaskHandle,
} from './worker';

// 导出核心类型
export type {
  AgentConfig,
  AgentStatus,
  Permission,
  CapabilityProfile,
  AgentResult,
  AgentTemplate,
  AuditReport,
  AuditCheck,
  RiskLevel,
} from '../types/core';
