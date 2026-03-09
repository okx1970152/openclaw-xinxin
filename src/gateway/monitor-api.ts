/**
 * 监控 API 端点
 * Monitoring API Endpoints
 *
 * 为监控面板提供数据接口：
 * - 子代理状态
 * - 记忆使用量
 * - Token 统计
 * - 任务队列状态
 */

import type { Response } from 'express';
import type { AgentRegistry, IndexStats } from '../types/core';

// ==================== 类型定义 ====================

/** 监控数据响应 */
export interface MonitorDataResponse {
  /** 系统状态 */
  system: {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    version: string;
    lastUpdate: string;
  };
  /** 代理统计 */
  agents: {
    total: number;
    active: number;
    idle: number;
    hibernating: number;
    list: AgentSummary[];
  };
  /** 任务队列 */
  tasks: {
    queued: number;
    running: number;
    completed: number;
    failed: number;
    recent: TaskSummary[];
  };
  /** Token 使用 */
  tokens: {
    hourly: number;
    hourlyLimit: number;
    daily: number;
    dailyLimit: number;
    total: number;
    avgPerTask: number;
  };
  /** 记忆使用 */
  memory: {
    permUsed: number;
    permLimit: number;
    tempUsed: number;
    tempLimit: number;
    indexStats: IndexStats | null;
  };
}

/** 代理摘要 */
export interface AgentSummary {
  id: string;
  domain: string;
  status: string;
  successCount: number;
  failCount: number;
  lastActive: string;
}

/** 任务摘要 */
export interface TaskSummary {
  id: string;
  content: string;
  priority: string;
  status: string;
  assignedAgent: string | null;
  createdAt: string;
}

// ==================== 监控数据收集器 ====================

/**
 * 监控数据收集器
 * 从各个模块收集监控数据
 */
export class MonitorDataCollector {
  private startTime: number;
  private version: string;
  private registryPath: string;
  private memoryPath: string;

  constructor(config: { version?: string; registryPath?: string; memoryPath?: string } = {}) {
    this.startTime = Date.now();
    this.version = config.version || '3.0.0';
    this.registryPath = config.registryPath || '';
    this.memoryPath = config.memoryPath || '';
  }

  /**
   * 获取完整监控数据
   */
  async getMonitorData(): Promise<MonitorDataResponse> {
    const [agents, tasks, tokens, memory] = await Promise.all([
      this.collectAgentData(),
      this.collectTaskData(),
      this.collectTokenData(),
      this.collectMemoryData(),
    ]);

    // 确定系统状态
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    
    // 检查 Token 使用率
    const tokenUsageRate = tokens.daily / tokens.dailyLimit;
    if (tokenUsageRate > 0.9) {
      status = 'error';
    } else if (tokenUsageRate > 0.7 || tokens.hourly / tokens.hourlyLimit > 0.8) {
      status = 'warning';
    }

    // 检查记忆使用率
    const memoryUsageRate = memory.permUsed / memory.permLimit;
    if (memoryUsageRate > 0.9) {
      status = 'error';
    } else if (memoryUsageRate > 0.7 && status === 'healthy') {
      status = 'warning';
    }

    return {
      system: {
        status,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        version: this.version,
        lastUpdate: new Date().toISOString(),
      },
      agents,
      tasks,
      tokens,
      memory,
    };
  }

  /**
   * 收集代理数据
   */
  private async collectAgentData(): Promise<MonitorDataResponse['agents']> {
    // 尝试读取注册表
    let registry: AgentRegistry | null = null;
    try {
      if (this.registryPath) {
        const fs = await import('fs/promises');
        const data = await fs.readFile(this.registryPath, 'utf-8');
        registry = JSON.parse(data);
      }
    } catch {
      // 文件不存在或解析失败
    }

    // 如果没有注册表，返回模拟数据
    if (!registry || !registry.agents) {
      return this.getMockAgentData();
    }

    const agents = registry.agents.map((entry) => ({
      id: entry.agent_id,
      domain: entry.config.domain,
      status: entry.config.status,
      successCount: entry.config.capability_profile.success_count,
      failCount: entry.config.capability_profile.fail_count,
      lastActive: entry.config.capability_profile.last_active,
    }));

    return {
      total: agents.length,
      active: agents.filter((a) => a.status === 'active').length,
      idle: agents.filter((a) => a.status === 'idle').length,
      hibernating: agents.filter((a) => a.status === 'hibernating').length,
      list: agents,
    };
  }

  /**
   * 收集任务数据
   */
  private async collectTaskData(): Promise<MonitorDataResponse['tasks']> {
    // TODO: 从任务队列模块获取实际数据
    return this.getMockTaskData();
  }

  /**
   * 收集 Token 数据
   */
  private async collectTokenData(): Promise<MonitorDataResponse['tokens']> {
    // TODO: 从 Token 限流器获取实际数据
    return this.getMockTokenData();
  }

  /**
   * 收集记忆数据
   */
  private async collectMemoryData(): Promise<MonitorDataResponse['memory']> {
    // TODO: 从记忆管理器获取实际数据
    return this.getMockMemoryData();
  }

  // ==================== 模拟数据 ====================

  private getMockAgentData(): MonitorDataResponse['agents'] {
    return {
      total: 4,
      active: 1,
      idle: 2,
      hibernating: 1,
      list: [
        {
          id: 'CodeAgent_001',
          domain: '代码开发与调试',
          status: 'active',
          successCount: 156,
          failCount: 3,
          lastActive: new Date().toISOString(),
        },
        {
          id: 'ResearchAgent_001',
          domain: '信息检索与分析',
          status: 'idle',
          successCount: 89,
          failCount: 1,
          lastActive: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'WriterAgent_001',
          domain: '内容创作与编辑',
          status: 'idle',
          successCount: 45,
          failCount: 0,
          lastActive: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'AssistantAgent_001',
          domain: '通用助手',
          status: 'hibernating',
          successCount: 234,
          failCount: 12,
          lastActive: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    };
  }

  private getMockTaskData(): MonitorDataResponse['tasks'] {
    return {
      queued: 3,
      running: 1,
      completed: 128,
      failed: 4,
      recent: [
        {
          id: 'task_001',
          content: '修复登录页面样式问题',
          priority: 'urgent',
          status: 'running',
          assignedAgent: 'CodeAgent_001',
          createdAt: new Date(Date.now() - 300000).toISOString(),
        },
        {
          id: 'task_002',
          content: '分析用户行为数据',
          priority: 'normal',
          status: 'queued',
          assignedAgent: null,
          createdAt: new Date(Date.now() - 600000).toISOString(),
        },
        {
          id: 'task_003',
          content: '生成产品文档',
          priority: 'low',
          status: 'queued',
          assignedAgent: null,
          createdAt: new Date(Date.now() - 900000).toISOString(),
        },
      ],
    };
  }

  private getMockTokenData(): MonitorDataResponse['tokens'] {
    return {
      hourly: 12500,
      hourlyLimit: 50000,
      daily: 85000,
      dailyLimit: 200000,
      total: 1250000,
      avgPerTask: 2500,
    };
  }

  private getMockMemoryData(): MonitorDataResponse['memory'] {
    return {
      permUsed: 15,
      permLimit: 50,
      tempUsed: 22,
      tempLimit: 50,
      indexStats: {
        total_files: 128,
        total_keywords: 1024,
        last_built: new Date(Date.now() - 3600000).toISOString(),
        size_bytes: 51200,
      },
    };
  }
}

// ==================== Express 路由处理 ====================

/**
 * 创建监控 API 路由处理器
 */
export function createMonitorApiHandlers(collector: MonitorDataCollector) {
  return {
    /**
     * GET /api/monitor
     * 获取完整监控数据
     */
    async getMonitorData(_req: unknown, res: Response): Promise<void> {
      try {
        const data = await collector.getMonitorData();
        res.json({
          success: true,
          data,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    },

    /**
     * GET /api/monitor/agents
     * 获取代理状态
     */
    async getAgentStatus(_req: unknown, res: Response): Promise<void> {
      try {
        const data = await collector.getMonitorData();
        res.json({
          success: true,
          data: data.agents,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    },

    /**
     * GET /api/monitor/tokens
     * 获取 Token 统计
     */
    async getTokenStats(_req: unknown, res: Response): Promise<void> {
      try {
        const data = await collector.getMonitorData();
        res.json({
          success: true,
          data: data.tokens,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    },

    /**
     * GET /api/monitor/memory
     * 获取记忆使用量
     */
    async getMemoryStats(_req: unknown, res: Response): Promise<void> {
      try {
        const data = await collector.getMonitorData();
        res.json({
          success: true,
          data: data.memory,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    },

    /**
     * GET /api/monitor/tasks
     * 获取任务队列状态
     */
    async getTaskStats(_req: unknown, res: Response): Promise<void> {
      try {
        const data = await collector.getMonitorData();
        res.json({
          success: true,
          data: data.tasks,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    },

    /**
     * GET /api/monitor/health
     * 健康检查端点
     */
    async healthCheck(_req: unknown, res: Response): Promise<void> {
      try {
        const data = await collector.getMonitorData();
        const status = data.system.status;
        
        res.status(status === 'error' ? 503 : 200).json({
          status,
          uptime: data.system.uptime,
          version: data.system.version,
          timestamp: data.system.lastUpdate,
        });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    },
  };
}

// ==================== 路由注册 ====================

/**
 * 注册监控 API 路由到 Express 应用
 */
export function registerMonitorApiRoutes(
  app: import('express').Application,
  collector: MonitorDataCollector,
  basePath: string = '/api/monitor'
): void {
  const handlers = createMonitorApiHandlers(collector);

  // 注册路由
  app.get(basePath, handlers.getMonitorData);
  app.get(`${basePath}/agents`, handlers.getAgentStatus);
  app.get(`${basePath}/tokens`, handlers.getTokenStats);
  app.get(`${basePath}/memory`, handlers.getMemoryStats);
  app.get(`${basePath}/tasks`, handlers.getTaskStats);
  app.get(`${basePath}/health`, handlers.healthCheck);

  console.log(`[监控API] 路由已注册: ${basePath}`);
}

// 导出单例收集器
let defaultCollector: MonitorDataCollector | null = null;

export function getDefaultCollector(config?: { version?: string; registryPath?: string; memoryPath?: string }): MonitorDataCollector {
  if (!defaultCollector) {
    defaultCollector = new MonitorDataCollector(config);
  }
  return defaultCollector;
}
