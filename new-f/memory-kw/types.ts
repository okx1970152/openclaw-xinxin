/**
 * 超级大龙虾 - 记忆系统类型定义
 * Memory System Type Definitions
 * 
 * 存放于 src/memory-kw/types.ts
 * 三层记忆结构相关类型
 */

// 重新导出核心类型中的记忆相关类型
export type {
  PermMemCategory,
  RelationTag,
  PermMemEntry,
  TempMemEntry,
  ValidationSeverity,
  ValidationCheckName,
  ValidationCheck,
  ValidationReport,
  RefinementResult,
  ConfirmationStrategy,
} from '../types/core';

/** 记忆槽位编号 */
export type MemorySlot = 1 | 2;

/** 记忆配置 */
export interface MemoryConfig {
  /** 记忆存储根目录 */
  memory_dir: string;
  /** 临时记忆单槽最大大小（字节），默认 50KB */
  temp_mem_max_size: number;
  /** 永久记忆最大大小（字节），默认 50KB */
  perm_mem_max_size: number;
  /** 备份保留天数 */
  archive_retention_days: number;
  /** 是否启用自动提练 */
  auto_refine_enabled: boolean;
  /** 触发提练的临时记忆大小阈值（比例） */
  refine_threshold_ratio: number;
}

/** 记忆管理器接口 */
export interface IMemoryManager {
  // ===== 临时记忆操作 =====
  
  /** 追加临时记忆条目 */
  appendTemp(entry: TempMemEntry): Promise<void>;
  
  /** 读取指定槽位的临时记忆 */
  readTemp(slot: MemorySlot): Promise<TempMemEntry[]>;
  
  /** 获取指定槽位的大小（字节数） */
  getTempSize(slot: MemorySlot): Promise<number>;
  
  /** 清空指定槽位的临时记忆 */
  clearTemp(slot: MemorySlot): Promise<void>;
  
  /** 切换活跃槽位（触发提练后） */
  switchSlot(): Promise<void>;
  
  /** 获取当前活跃槽位 */
  getActiveSlot(): MemorySlot;
  
  // ===== 永久记忆操作 =====
  
  /** 追加永久记忆条目 */
  appendPerm(entry: PermMemEntry): Promise<void>;
  
  /** 读取永久记忆 */
  readPerm(): Promise<PermMemEntry[]>;
  
  /** 获取永久记忆大小（字节数） */
  getPermSize(): Promise<number>;
  
  /** 按关键词搜索永久记忆 */
  searchPerm(keywords: string[]): Promise<PermMemEntry[]>;
  
  /** 更新永久记忆条目 */
  updatePerm(entry: PermMemEntry): Promise<void>;
  
  /** 删除永久记忆条目 */
  deletePerm(entryId: string): Promise<void>;
  
  // ===== 快照备份 =====
  
  /** 归档指定槽位的临时记忆 */
  archiveTemp(slot: MemorySlot): Promise<string>;
  
  /** 清理过期的备份文件 */
  cleanOldArchives(days: number): Promise<number>;
  
  /** 从备份恢复临时记忆 */
  restoreFromArchive(archivePath: string, slot: MemorySlot): Promise<void>;
  
  // ===== 状态查询 =====
  
  /** 获取记忆统计信息 */
  getStats(): Promise<MemoryStats>;
}

/** 记忆统计信息 */
export interface MemoryStats {
  /** 临时记忆槽位1大小 */
  temp_slot1_size: number;
  /** 临时记忆槽位2大小 */
  temp_slot2_size: number;
  /** 永久记忆大小 */
  perm_mem_size: number;
  /** 永久记忆条目数 */
  perm_mem_count: number;
  /** 当前活跃槽位 */
  active_slot: MemorySlot;
  /** 备份文件数 */
  archive_count: number;
  /** 最近提练时间 */
  last_refine_at?: string;
}

/** 提练引擎接口 */
export interface IRefinementEngine {
  /**
   * 从临时记忆提练永久记忆
   * @param rawContent 原始临时记忆内容
   * @param agentId 子代理ID
   * @param agentDomain 子代理领域
   * @returns 提练结果
   */
  refine(
    rawContent: TempMemEntry[],
    agentId: string,
    agentDomain: string
  ): Promise<RefinementResult>;
}

/** 验证器接口 */
export interface IValidator {
  /**
   * 验证永久记忆条目
   * @param entry 待验证的条目
   * @param rawContent temp_mem 原文（用于回溯检查）
   * @param registryPath registry.json 路径
   * @returns 验证报告
   */
  validate(
    entry: PermMemEntry,
    rawContent: string,
    registryPath: string
  ): Promise<ValidationReport>;
}

/** 检索引擎接口 */
export interface ISearchEngine {
  // ===== 检索操作 =====
  
  /** 关键词检索（第一层） */
  searchByKeyword(query: string): Promise<SearchResult[]>;
  
  /** FTS5 全文检索（第二层 fallback） */
  searchByFTS(query: string): Promise<SearchResult[]>;
  
  /** 综合检索（按策略自动选择） */
  search(query: string): Promise<SearchResult[]>;
  
  // ===== 索引管理 =====
  
  /** 全量重建索引 */
  buildIndex(): Promise<void>;
  
  /** 增量更新索引 */
  updateIndex(filePath: string): Promise<void>;
  
  /** 获取索引统计 */
  getIndexStats(): Promise<IndexStats>;
  
  /** 检查索引是否存在 */
  isIndexReady(): boolean;
}

// 导入需要的类型
import type {
  TempMemEntry,
  PermMemEntry,
  ValidationReport,
  RefinementResult,
  SearchResult,
  IndexStats,
} from '../types/core';
