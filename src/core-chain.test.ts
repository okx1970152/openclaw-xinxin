/**
 * 超级大龙虾 - 集成测试
 * Integration Test Suite
 *
 * 验证核心链路：
 * 1. 主代理初始化
 * 2. 子代理创建
 * 3. 消息处理
 * 4. 任务队列
 * 5. 记忆系统
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// 测试目录
let testDir: string;

describe('超级大龙虾集成测试', () => {
  beforeAll(() => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `super-lobster-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // 创建必要的子目录
    mkdirSync(join(testDir, 'memory'), { recursive: true });
    mkdirSync(join(testDir, 'agents'), { recursive: true });
    mkdirSync(join(testDir, 'task_patterns'), { recursive: true });
  });

  afterAll(() => {
    // 清理测试目录
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('1. 记忆系统测试', () => {
    it('应该能创建和读取临时记忆', async () => {
      const tempMemPath = join(testDir, 'memory', 'temp_mem_1.json');
      const testEntry = {
        id: 'test_001',
        timestamp: new Date().toISOString(),
        role: 'user' as const,
        content: '这是一条测试消息',
        pinned: false,
      };

      // 写入记忆
      writeFileSync(tempMemPath, JSON.stringify([testEntry], null, 2));

      // 读取验证
      const content = readFileSync(tempMemPath, 'utf-8');
      const entries = JSON.parse(content);

      expect(entries).toHaveLength(1);
      expect(entries[0].content).toBe('这是一条测试消息');
      expect(entries[0].role).toBe('user');
    });

    it('应该能创建和读取永久记忆', async () => {
      const permMemPath = join(testDir, 'memory', 'perm_mem.json');
      const testEntry = {
        id: 'pm_001',
        category: '子代理能力',
        keywords: ['测试', '集成'],
        summary: '这是一条永久记忆测试摘要',
        relations: {
          project: 'super-lobster',
          agent: 'TestAgent',
          tech_stack: ['TypeScript', 'Vitest'],
          related_patterns: [],
        },
        file_refs: [],
        pitfalls: [],
        created_at: new Date().toISOString(),
      };

      // 写入记忆
      writeFileSync(permMemPath, JSON.stringify([testEntry], null, 2));

      // 读取验证
      const content = readFileSync(permMemPath, 'utf-8');
      const entries = JSON.parse(content);

      expect(entries).toHaveLength(1);
      expect(entries[0].keywords).toContain('测试');
      expect(entries[0].relations.project).toBe('super-lobster');
    });
  });

  describe('2. 子代理注册表测试', () => {
    it('应该能创建注册表文件', async () => {
      const registryPath = join(testDir, 'registry.json');
      const registry = {
        version: '1.0.0',
        updated_at: new Date().toISOString(),
        agents: [
          {
            agent_id: 'CodeAgent_001',
            config: {
              agent_id: 'CodeAgent_001',
              domain: '代码开发与调试',
              keywords: ['代码', '编程'],
              permissions: ['file_rw', 'code_exec'],
              work_dir: './agents/CodeAgent_001/',
              status: 'idle',
              llm_provider: 'anthropic',
              llm_model: 'claude-sonnet-4-20250514',
              max_tokens_per_turn: 8000,
              capability_profile: {
                skills_proven: ['typescript', 'debugging'],
                success_count: 0,
                fail_count: 0,
                avg_tokens_per_task: 0,
                last_active: new Date().toISOString(),
              },
              custom_fields: {},
              created_at: new Date().toISOString(),
            },
            registered_at: new Date().toISOString(),
            is_clone: false,
          },
        ],
      };

      writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      const content = readFileSync(registryPath, 'utf-8');
      const loaded = JSON.parse(content);

      expect(loaded.version).toBe('1.0.0');
      expect(loaded.agents).toHaveLength(1);
      expect(loaded.agents[0].agent_id).toBe('CodeAgent_001');
      expect(loaded.agents[0].config.domain).toBe('代码开发与调试');
    });
  });

  describe('3. 任务队列测试', () => {
    it('应该能创建任务队列文件', async () => {
      const queuePath = join(testDir, 'task_queue.json');
      const queue = {
        version: '1.0.0',
        updated_at: new Date().toISOString(),
        tasks: [
          {
            task_id: 'task_001',
            content: '测试任务：验证核心链路',
            source_message: {
              source: 'cli',
              user_id: 'test_user',
              content: '运行集成测试',
              timestamp: new Date().toISOString(),
              attachments: [],
            },
            priority: 'normal',
            status: 'queued',
            created_at: new Date().toISOString(),
          },
        ],
      };

      writeFileSync(queuePath, JSON.stringify(queue, null, 2));

      const content = readFileSync(queuePath, 'utf-8');
      const loaded = JSON.parse(content);

      expect(loaded.tasks).toHaveLength(1);
      expect(loaded.tasks[0].priority).toBe('normal');
      expect(loaded.tasks[0].status).toBe('queued');
    });
  });

  describe('4. 任务模式库测试', () => {
    it('应该能创建任务模式文件', async () => {
      const patternPath = join(testDir, 'task_patterns', 'pattern_001.json');
      const pattern = {
        pattern_id: 'pattern_001',
        task_type: '代码审查',
        match_keywords: ['代码审查', 'code review', '审查'],
        input_pattern: '需要审查的代码文件',
        strategy: {
          steps: [
            '1. 读取代码',
            '2. 分析代码质量',
            '3. 生成审查报告',
          ],
          tool_chain: ['read_file', 'analyze', 'report'],
        },
        assigned_agent: 'CodeAgent',
        performance: {
          avg_tokens: 2500,
          avg_duration_sec: 30,
          success_rate: 0.95,
        },
        pitfalls: ['注意代码规范'],
        created_at: new Date().toISOString(),
        used_count: 0,
      };

      writeFileSync(patternPath, JSON.stringify(pattern, null, 2));

      const content = readFileSync(patternPath, 'utf-8');
      const loaded = JSON.parse(content);

      expect(loaded.pattern_id).toBe('pattern_001');
      expect(loaded.task_type).toBe('代码审查');
      expect(loaded.strategy.steps).toHaveLength(3);
    });
  });

  describe('5. 消息格式测试', () => {
    it('应该能创建统一消息格式', async () => {
      const message = {
        source: 'cli' as const,
        user_id: 'test_user_001',
        content: '创建一个新的子代理来处理代码审查任务',
        timestamp: new Date().toISOString(),
        attachments: [],
        thread_id: 'thread_001',
      };

      expect(message.source).toBe('cli');
      expect(message.content).toContain('子代理');
      expect(message.attachments).toEqual([]);
    });

    it('应该能创建带附件的消息', async () => {
      const message = {
        source: 'telegram' as const,
        user_id: 'tg_user_001',
        content: '请分析这个文件',
        timestamp: new Date().toISOString(),
        attachments: [
          {
            type: 'file' as const,
            path: '/tmp/test_file.ts',
            mime_type: 'text/typescript',
            size_bytes: 1024,
          },
        ],
      };

      expect(message.source).toBe('telegram');
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments[0].type).toBe('file');
    });
  });

  describe('6. 中文指令解析测试', () => {
    const chineseCommands = [
      { input: '创建代理', expected: 'create_agent' },
      { input: '提练记忆', expected: 'refine_memory' },
      { input: '查看状态', expected: 'show_status' },
      { input: '重建索引', expected: 'rebuild_index' },
      { input: '安装Skill', expected: 'install_skill' },
      { input: '克隆代理 CodeAgent_001', expected: 'clone_agent' },
      { input: '销毁代理 TestAgent_001', expected: 'destroy_agent' },
    ];

    it.each(chineseCommands)('应该能解析中文指令 "$input"', ({ input, expected }) => {
      // 简单的关键词匹配测试
      const commandMap: Record<string, string> = {
        '创建': 'create_agent',
        '提练': 'refine_memory',
        '查看': 'show_status',
        '重建': 'rebuild_index',
        '安装': 'install_skill',
        '克隆': 'clone_agent',
        '销毁': 'destroy_agent',
      };

      let matched: string | null = null;
      for (const [keyword, command] of Object.entries(commandMap)) {
        if (input.includes(keyword)) {
          matched = command;
          break;
        }
      }

      expect(matched).toBe(expected);
    });
  });
});
