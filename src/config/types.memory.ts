import type { SessionSendPolicyConfig } from "./types.base.js";

export type MemoryBackend = "builtin" | "qmd";
export type MemoryCitationsMode = "auto" | "on" | "off";
export type MemoryQmdSearchMode = "query" | "search" | "vsearch";

/**
 * 记忆引擎类型
 * 
 * - embedding: 使用原版 Embedding 语义检索
 * - keyword: 使用关键词检索（超级大龙虾新增）
 */
export type MemoryEngine = "embedding" | "keyword";

export type MemoryConfig = {
  backend?: MemoryBackend;
  citations?: MemoryCitationsMode;
  qmd?: MemoryQmdConfig;
  /**
   * 记忆引擎选择
   * 
   * - "embedding": 使用原版 Embedding 语义检索（默认）
   * - "keyword": 使用关键词检索（超级大龙虾新增）
   * 
   * 当设置为 "keyword" 时，将绕过 embedding 模块，
   * 使用 src/memory-kw/ 实现的关键词检索系统
   */
  engine?: MemoryEngine;
};

export type MemoryQmdConfig = {
  command?: string;
  mcporter?: MemoryQmdMcporterConfig;
  searchMode?: MemoryQmdSearchMode;
  includeDefaultMemory?: boolean;
  paths?: MemoryQmdIndexPath[];
  sessions?: MemoryQmdSessionConfig;
  update?: MemoryQmdUpdateConfig;
  limits?: MemoryQmdLimitsConfig;
  scope?: SessionSendPolicyConfig;
};

export type MemoryQmdMcporterConfig = {
  /**
   * Route QMD searches through mcporter (MCP runtime) instead of spawning `qmd` per query.
   * Requires:
   * - `mcporter` installed and on PATH
   * - A configured mcporter server that runs `qmd mcp` with `lifecycle: keep-alive`
   */
  enabled?: boolean;
  /** mcporter server name (defaults to "qmd") */
  serverName?: string;
  /** Start the mcporter daemon automatically (defaults to true when enabled). */
  startDaemon?: boolean;
};

export type MemoryQmdIndexPath = {
  path: string;
  name?: string;
  pattern?: string;
};

export type MemoryQmdSessionConfig = {
  enabled?: boolean;
  exportDir?: string;
  retentionDays?: number;
};

export type MemoryQmdUpdateConfig = {
  interval?: string;
  debounceMs?: number;
  onBoot?: boolean;
  waitForBootSync?: boolean;
  embedInterval?: string;
  commandTimeoutMs?: number;
  updateTimeoutMs?: number;
  embedTimeoutMs?: number;
};

export type MemoryQmdLimitsConfig = {
  maxResults?: number;
  maxSnippetChars?: number;
  maxInjectedChars?: number;
  timeoutMs?: number;
};
