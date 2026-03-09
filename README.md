# 超级大龙虾 (Super Lobster)

> OpenClaw 深度改造版 - 智能 AI 助理系统

## 项目概述

超级大龙虾是基于 OpenClaw 进行深度改造的智能 AI 助理系统，实现了以下核心特性：

- **主代理智能调度** - 智能解析指令，调度专业子代理执行
- **多子代理专业执行** - 8 种专业代理模板，动态能力画像
- **任务模式库** - 20 个验证任务模式，自动匹配复用
- **经验沉淀复用** - 三层记忆结构，智能提练引擎
- **Token 精细控制** - 智能模型选择，自动限流
- **Worker 线程隔离** - CPU 密集型任务独立执行
- **全中文交互** - 命令、日志、消息完整中文化

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8

### 安装

```bash
# 克隆项目
git clone <repository-url>

# 进入项目目录
cd super-lobster

# 安装依赖
pnpm install
```

### 配置

1. 复制配置模板：
```bash
cp config.example.yaml config.yaml
```

2. 编辑配置文件，设置必要的 API 密钥：
```yaml
model:
  provider: "anthropic"
  api_key: "${ANTHROPIC_API_KEY}"

memory:
  engine: "keyword"  # 使用关键词检索（无需 embedding）
```

### 启动

```bash
# 开发模式
pnpm run dev

# CLI 模式
pnpm run cli

# Telegram Bot 模式
pnpm run telegram
```

## 核心模块

### 1. 主代理 (Master Agent)

主代理负责：
- 解析用户指令
- 匹配任务模式
- 调度子代理执行
- Token 成本控制

```typescript
import { MasterAgent } from './master';

const agent = new MasterAgent({
  modelSelector: { defaultModel: 'claude-3-haiku' },
  tokenLimiter: { hourlyLimit: 100000 },
});

const result = await agent.handleMessage({
  content: '帮我优化这段代码',
  source: 'cli',
  userId: 'user-001',
});
```

### 2. 子代理系统 (Child Agents)

支持 8 种专业代理模板：

| 模板 | 用途 |
|------|------|
| CodeAgent | 代码开发与调试 |
| ResearchAgent | 信息检索与分析 |
| WriterAgent | 内容创作与编辑 |
| AssistantAgent | 通用助手 |
| DatabaseAgent | 数据库管理与优化 |
| TestAgent | 测试与质量保障 |
| DevOpsAgent | DevOps 与基础设施 |
| SecurityAgent | 安全与合规 |

```typescript
import { TemplateManager } from './agents';

const template = TemplateManager.matchByKeywords(['代码', '优化']);
// -> CodeAgent

const config = TemplateManager.createConfigFromTemplate(template, {
  id: 'my-coder',
  name: '我的代码助手',
});
```

### 3. 记忆系统 (Memory System)

三层记忆结构：

```
┌─────────────────────────────────────┐
│        temp_mem_1 (50KB)            │ ← 当前工作记忆
├─────────────────────────────────────┤
│        temp_mem_2 (50KB)            │ ← 备用/归档
├─────────────────────────────────────┤
│        perm_mem (50KB)              │ ← 永久记忆
│        - 关键词索引                  │
│        - 摘要 + 关系标签             │
└─────────────────────────────────────┘
```

```typescript
import { MemoryManager } from './memory-kw';

const memory = new MemoryManager();

// 写入临时记忆
await memory.appendTemp({
  role: 'user',
  content: '优化图片加载速度',
  timestamp: new Date().toISOString(),
});

// 提练到永久记忆
await memory.appendPerm({
  id: 'exp-001',
  keywords: ['图片优化', '懒加载', 'CDN'],
  summary: '用户希望优化图片加载，建议使用懒加载和CDN',
  category: '用户偏好',
  relations: ['性能优化'],
  created_at: new Date().toISOString(),
});

// 检索
const results = await memory.searchPerm(['图片', '优化']);
```

### 4. 任务模式库 (Pattern Library)

20 个预定义任务模式：

| 模式 | 描述 |
|------|------|
| code_review | 代码审查 |
| bug_fix | Bug 修复 |
| doc_generation | 文档生成 |
| data_analysis | 数据分析 |
| test_generation | 测试用例生成 |
| refactor | 代码重构 |
| api_design | API 设计 |
| performance_opt | 性能优化 |
| security_audit | 安全审计 |
| code_generation | 代码生成 |
| dependency_upgrade | 依赖升级 |
| log_analysis | 日志分析 |
| config_management | 配置管理 |
| data_migration | 数据迁移 |
| localization | 本地化 |
| troubleshooting | 故障排查 |
| code_search | 代码搜索 |
| architecture_design | 架构设计 |
| unit_test_exec | 单元测试执行 |
| environment_setup | 环境配置 |

```typescript
import { PatternLibrary } from './master';

const patterns = new PatternLibrary();

// 匹配模式
const matched = patterns.match(['代码', '审查', '质量']);
// -> code_review

// 归档新模式
patterns.archive({
  id: 'pattern-new',
  name: '新任务模式',
  keywords: ['新', '模式'],
  description: '自定义任务模式',
});
```

### 5. 成本控制 (Cost Control)

```typescript
import { CostController } from './master';

const controller = new CostController({
  defaultModel: 'claude-3-haiku',
  hourlyTokenLimit: 100000,
  dailyTokenLimit: 1000000,
});

// 智能模型选择
const model = controller.selectModel({
  complexity: 'high',
  taskType: 'code_generation',
});
// -> 'claude-3-sonnet' 或 'claude-3-opus'

// Token 使用统计
const stats = controller.getUsageStats();
```

### 6. 监控面板 (Monitor Dashboard)

访问 `http://localhost:3000/monitor` 查看：
- 子代理状态
- 任务队列
- Token 使用统计
- 记忆使用情况

## 配置参考

### 完整配置示例

```yaml
# config.yaml

# 模型配置
model:
  provider: "anthropic"
  api_key: "${ANTHROPIC_API_KEY}"
  default_model: "claude-3-haiku"
  
  # 模型别名
  aliases:
    fast: "claude-3-haiku"
    smart: "claude-3-sonnet"
    best: "claude-3-opus"

# 记忆配置
memory:
  engine: "keyword"
  memory_dir: "./memory"
  temp_mem_max_size: 51200  # 50KB
  perm_mem_max_size: 51200  # 50KB
  auto_refine_enabled: true

# Token 限制
token_limits:
  hourly_limit: 100000
  daily_limit: 1000000

# 子代理配置
agents:
  templates_dir: "./templates"
  max_concurrent: 3
  
# 监控配置
monitor:
  enabled: true
  port: 3000
  refresh_interval_ms: 5000

# 日志配置
logging:
  level: "info"
  language: "zh-CN"  # 中文日志
```

## API 文档

### REST API

#### 获取监控数据

```
GET /api/monitor
```

响应：
```json
{
  "agents": [...],
  "tokenStats": {...},
  "memoryUsage": {...},
  "taskQueue": [...]
}
```

#### 创建子代理

```
POST /api/agents
```

请求体：
```json
{
  "template": "CodeAgent",
  "name": "我的代码助手",
  "permissions": ["file_read", "file_write"]
}
```

### WebSocket API

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// 发送消息
ws.send(JSON.stringify({
  type: 'chat',
  content: '帮我优化代码',
  userId: 'user-001',
}));

// 接收响应
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

## 开发指南

### 项目结构

```
src/
├── types/core.ts         # 全局核心类型
├── memory-kw/            # 记忆系统
├── master/               # 主代理
├── agents/               # 子代理
├── templates/            # 模板库
├── i18n/                 # 国际化
├── logging/              # 日志模块
├── performance/          # 性能优化
├── error-handling/       # 错误处理
├── gateway/              # 网关
└── monitor/              # 监控面板
```

### 添加新的子代理模板

```typescript
// src/templates/index.ts

const myTemplate: AgentTemplate = {
  id: 'MyCustomAgent',
  name: '自定义代理',
  description: '我的自定义代理模板',
  default_capabilities: {
    skills: ['custom_skill'],
    permissions: ['file_read'],
  },
  keywords: ['自定义', 'special'],
  system_prompt: '你是一个专业的自定义代理...',
};

TemplateLibrary.register(myTemplate);
```

### 添加新的任务模式

```typescript
// src/master/patterns.ts

const myPattern: TaskPattern = {
  id: 'my_task_pattern',
  name: '我的任务模式',
  keywords: ['关键词1', '关键词2'],
  description: '任务模式描述',
  recommended_agent: 'MyCustomAgent',
  strategies: [...],
};

patternLibrary.archive(myPattern);
```

## 约束规则

### 必须遵守的铁律

1. **记忆永不膨胀** - `perm_mem` 单文件 ≤ 50KB，单条 ≤ 200 字
2. **严格串行执行** - 同一时间只有一个子代理 active
3. **检索不返回全文** - 只返回索引 + 摘要
4. **跑通过的代理绝不销毁** - 保留全部资产

### Token 控制

- Claude Haiku: 适用于简单任务
- Claude Sonnet: 适用于中等复杂度任务
- Claude Opus: 适用于高复杂度任务

## 故障排除

### 常见问题

**Q: 记忆溢出怎么办？**

A: 系统会自动触发提练，将临时记忆精炼后存入永久记忆。如仍有问题，可手动执行：
```bash
pnpm run refine
```

**Q: Token 超限怎么办？**

A: 系统会自动暂停任务并通知。可以通过配置调整限制：
```yaml
token_limits:
  hourly_limit: 200000
```

**Q: 子代理崩溃如何恢复？**

A: Worker 线程隔离确保崩溃不影响主进程。系统会自动重试，重试失败后会通知用户。

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request！

---

**超级大龙虾** - 让 AI 助理更智能、更高效
