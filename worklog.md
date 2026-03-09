# 超级大龙虾 (Super Lobster) 改造工作日志

## 项目概述
将 OpenClaw 深度改造为智能 AI 助理系统，实现主代理调度、多子代理执行、任务模式库、经验沉淀复用等核心能力。

---

## Phase 0: 环境准备 ✅ 已完成

### 任务完成情况

| 编号 | 任务 | 状态 | 完成时间 |
|------|------|------|----------|
| 0.1 | 复制原版代码 | ✅ 完成 | 2026-03-09 |
| 0.2 | 删除 ui/ 前端目录 | ✅ 完成 | 2026-03-09 |
| 0.3 | 分析依赖关系 | ✅ 完成 | 2026-03-09 |
| 0.4 | 验证基础功能 | ✅ 完成 | 2026-03-09 |
| 0.5 | 创建工作日志 | ✅ 完成 | 2026-03-09 |

### 完成的工作
1. 项目初始化：复制 openclaw-source 为 super-lobster
2. 项目更名：openclaw → super-lobster
3. 前端清理：删除 ui/ 目录
4. 依赖分析：梳理 memory/ 和 agents/ 模块引用关系
5. 包依赖修复：更新 packages/clawdbot 和 packages/moltbot 的依赖引用
6. 依赖安装：pnpm install 成功

---

## Phase 1: 最小可用版本 🔄 进行中

### 目标
跑通基础链路：主代理接收指令 → 调度子代理 → 返回结果

### 任务完成情况

| 编号 | 任务 | 状态 | 说明 |
|------|------|------|------|
| 1.1 | 全局核心类型定义 | ✅ 完成 | src/types/core.ts |
| 1.2 | 记忆类型定义 | ✅ 完成 | src/memory-kw/types.ts |
| 1.3 | 三层记忆结构实现 | ✅ 完成 | src/memory-kw/memory.ts |
| 1.4 | 记忆系统索引文件 | ✅ 完成 | src/memory-kw/index.ts |
| 1.5 | MasterAgent 骨架 | ✅ 完成 | src/master/agent.ts |
| 1.6 | 子代理注册表 | ✅ 完成 | src/master/registry.ts |
| 1.7 | 全局索引文件 | ✅ 完成 | src/index.ts |
| 1.8 | Embedding 旁路开关 | ⏳ 待做 | 需要修改配置和启动流程 |
| 1.9 | WebSocket 安全加固 | ⏳ 待做 | 需要修改 gateway 模块 |
| 1.10 | 统一消息格式 | ⏳ 待做 | 需要修改 CLI/TG 适配器 |

### 已完成的模块

#### 1. 核心类型 (src/types/core.ts)
- UnifiedMessage: 统一消息格式
- AgentConfig: 子代理配置类型
- AgentResult: 执行结果类型
- TaskItem: 任务队列类型
- AgentRegistry: 注册表类型
- SuperLobsterConfig: 系统配置类型

#### 2. 记忆类型 (src/memory-kw/types.ts)
- PermMemEntry: 永久记忆条目
- TempMemEntry: 临时记忆条目
- RelationTag: 关系标签
- MemoryStatus: 记忆状态
- ValidationReport: 验证报告
- MEMORY_CONFIG: 配置常量

#### 3. 记忆管理器 (src/memory-kw/memory.ts)
- MemoryManager 类
- 三层记忆读写
- 槽位轮换
- 快照备份
- 归档管理

#### 4. 主代理 (src/master/agent.ts)
- MasterAgent 类
- 消息处理入口
- 任务队列管理
- 串行执行
- 子代理创建/激活/休眠/销毁

#### 5. 注册表 (src/master/registry.ts)
- AgentRegistryManager 类
- 代理注册/注销
- 状态更新
- 能力画像更新
- 统计查询

### Lint 检查结果
- 新增代码: 0 错误
- 原版代码: 3 个错误（非改造引入）

### 目录结构
```
super-lobster/src/
├── types/
│   └── core.ts          # 全局核心类型 ✅
├── memory-kw/           # 关键词记忆系统 ✅
│   ├── types.ts         # 记忆类型定义 ✅
│   ├── memory.ts        # 记忆管理器实现 ✅
│   └── index.ts         # 模块入口 ✅
├── master/              # 主代理模块 ✅
│   ├── agent.ts         # MasterAgent 实现 ✅
│   ├── registry.ts      # 注册表管理 ✅
│   └── index.ts         # 模块入口 ✅
├── index.ts             # 全局入口 ✅
├── memory/              # 原版 Embedding 模块（保留待旁路）
├── agents/              # 原版 Agent 模块（改造基础）
├── cli/                 # CLI 入口（保留）
├── telegram/            # Telegram 入口（保留）
└── gateway/             # WebSocket 网关（保留+加固）
```

---

## 待完成任务

### Phase 1 剩余任务
1. **Embedding 旁路开关**: 在配置中添加 `memory.engine: "keyword"` 开关
2. **WebSocket 安全加固**: 添加 Origin 校验 + Token 强制生成
3. **统一消息格式**: 修改 CLI/TG 适配器，使用 UnifiedMessage

### Phase 2 预览
- 中文关键词检索 (nodejieba 分词)
- 记忆提练引擎
- 四步验证器
- 任务模式库
- SecurityAgent

---

## 备注
- 原版仓库: https://github.com/openclaw/openclaw
- 改造依据: 《超级大龙虾_OpenClaw深度改造升级实施方案_v3.0.docx》
- 技术参考: 《超级大龙虾_3.0配套技术设计文档_v2.0.docx》
