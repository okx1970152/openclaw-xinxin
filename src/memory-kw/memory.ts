/**
 * 超级大龙虾 - 记忆管理器实现
 * Memory Manager Implementation
 * 
 * 存放于 src/memory-kw/memory.ts
 * 三层记忆的读写、轮换、备份
 */

import * as fs from 'fs';
import * as path from 'path';
// #24 修复：使用异步 I/O
import { promises as fsp } from 'fs';
import type {
  TempMemEntry,
  PermMemEntry,
  MemorySlot,
  MemoryConfig,
  MemoryStats,
  IRefinementEngine,
} from './types';
import { IMemoryManager } from './types';
import { RefinementEngine } from './refine';

/** 默认记忆配置 */
const DEFAULT_CONFIG: MemoryConfig = {
  memory_dir: './memory',
  temp_mem_max_size: 50 * 1024, // 50KB
  perm_mem_max_size: 50 * 1024, // 50KB
  archive_retention_days: 30,
  auto_refine_enabled: true,
  refine_threshold_ratio: 0.9, // 90% 时触发提练
};

/**
 * 记忆管理器实现
 */
export class MemoryManager implements IMemoryManager {
  private config: MemoryConfig;
  private activeSlot: MemorySlot = 1;
  private slotFilePath: string;
  private tempFiles: Record<MemorySlot, string>;
  private permFile: string;
  private archiveDir: string;
  /** 最近提练时间 */
  private lastRefineAt: string | null = null;
  /** 提练引擎实例 */
  private refinementEngine: IRefinementEngine;

  constructor(config?: Partial<MemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化路径
    this.tempFiles = {
      1: path.join(this.config.memory_dir, 'temp_mem_1.json'),
      2: path.join(this.config.memory_dir, 'temp_mem_2.json'),
    };
    this.permFile = path.join(this.config.memory_dir, 'perm_mem.json');
    this.archiveDir = path.join(this.config.memory_dir, 'archive');
    this.slotFilePath = path.join(this.config.memory_dir, 'active_slot.json');
    
    // 初始化目录和文件
    this.initialize();
    
    // 初始化提练引擎
    this.refinementEngine = new RefinementEngine();
  }

  /**
   * 初始化记忆目录和文件
   * #24 修复：改为异步初始化
   */
  private async initialize(): Promise<void> {
    // 创建目录
    try {
      await fsp.mkdir(this.config.memory_dir, { recursive: true });
    } catch (e) {
      // 目录已存在，忽略
    }
    try {
      await fsp.mkdir(this.archiveDir, { recursive: true });
    } catch (e) {
      // 目录已存在，忽略
    }

    // 初始化临时记忆文件
    for (const slot of [1, 2] as MemorySlot[]) {
      try {
        await fsp.access(this.tempFiles[slot]);
      } catch {
        await this.writeJsonFileAsync(this.tempFiles[slot], []);
      }
    }

    // 初始化永久记忆文件
    try {
      await fsp.access(this.permFile);
    } catch {
      await this.writeJsonFileAsync(this.permFile, []);
    }

    // 读取或初始化活跃槽位
    try {
      await fsp.access(this.slotFilePath);
      const slotData = await this.readJsonFileAsync(this.slotFilePath);
      this.activeSlot = (slotData as { active_slot: MemorySlot }).active_slot;
    } catch {
      await this.writeJsonFileAsync(this.slotFilePath, { active_slot: this.activeSlot });
    }
  }

  // ===== 文件操作工具 =====
  // #24 修复：保留同步方法用于初始化，添加异步方法

  private readJsonFile(filePath: string): unknown {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // 文件损坏或不存在，返回空数组
      console.error(`[MemoryManager] 读取文件失败: ${filePath}`, error);
      return [];
    }
  }

  private writeJsonFile(filePath: string, data: unknown): void {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  // #24 新增：异步版本
  private async readJsonFileAsync(filePath: string): Promise<unknown> {
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`[MemoryManager] 读取文件失败: ${filePath}`, error);
      return [];
    }
  }

  private async writeJsonFileAsync(filePath: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await fsp.writeFile(filePath, content, 'utf-8');
  }

  private async getFileSizeAsync(filePath: string): Promise<number> {
    try {
      const stats = await fsp.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  // ===== 临时记忆操作 =====

  // #24 修复：使用异步 I/O
  async appendTemp(entry: TempMemEntry): Promise<void> {
    const currentFile = this.tempFiles[this.activeSlot];
    const entries = await this.readTemp(this.activeSlot);
    
    // 检查大小限制
    const currentSize = await this.getFileSizeAsync(currentFile);
    const entrySize = JSON.stringify(entry).length;
    
    if (currentSize + entrySize >= this.config.temp_mem_max_size) {
      // 触发槽位切换
      if (this.config.auto_refine_enabled) {
        await this.switchSlot();
        // 切换后重新追加到新槽位
        return this.appendTemp(entry);
      }
      throw new Error('MEMORY_OVERFLOW: 临时记忆已达上限，请先执行提练');
    }

    entries.push(entry);
    await this.writeJsonFileAsync(currentFile, entries);
  }

  // #24 修复：使用异步 I/O
  async readTemp(slot: MemorySlot): Promise<TempMemEntry[]> {
    const result = await this.readJsonFileAsync(this.tempFiles[slot]);
    return (result as TempMemEntry[]) || [];
  }

  async getTempSize(slot: MemorySlot): Promise<number> {
    return this.getFileSizeAsync(this.tempFiles[slot]);
  }

  async clearTemp(slot: MemorySlot): Promise<void> {
    await this.writeJsonFileAsync(this.tempFiles[slot], []);
  }

  async switchSlot(): Promise<void> {
    const oldSlot = this.activeSlot;
    
    console.log(`[MemoryManager] 开始槽位切换: ${oldSlot} -> ${oldSlot === 1 ? 2 : 1}`);
    
    // 1. 归档旧槽位
    await this.archiveTemp(oldSlot);
    
    // #11 修复：提取 pinned 消息，在清空后迁移到新槽位
    const tempEntries = await this.readTemp(oldSlot);
    const pinnedEntries = tempEntries.filter(e => e.pinned);
    const unpinnedEntries = tempEntries.filter(e => !e.pinned);
    
    console.log(`[MemoryManager] 临时记忆: ${tempEntries.length} 条, 其中 pinned: ${pinnedEntries.length} 条`);
    
    // 2. 触发提练流程（仅处理非 pinned 消息）
    if (unpinnedEntries.length > 0) {
      try {
        const result = await this.refinementEngine.refine(
          unpinnedEntries,
          'default_agent',
          'general'
        );
        
        // 将提练结果写入永久记忆
        for (const entry of result.entries) {
          await this.appendPerm(entry);
        }
        
        console.log(`[MemoryManager] 提练完成，生成 ${result.entries.length} 条永久记忆`);
      } catch (error) {
        console.error('[MemoryManager] 提练失败:', error);
        // 提练失败不阻断流程，继续执行清空和切换
      }
    }
    
    // 3. 清空旧槽位
    await this.clearTemp(oldSlot);
    
    // 4. 切换到新槽位
    this.activeSlot = oldSlot === 1 ? 2 : 1;
    
    // 5. 保存槽位状态
    await this.writeJsonFileAsync(this.slotFilePath, { active_slot: this.activeSlot });
    
    // #11 修复：6. 将 pinned 消息迁移到新槽位
    if (pinnedEntries.length > 0) {
      await this.writeJsonFileAsync(this.tempFiles[this.activeSlot], pinnedEntries);
      console.log(`[MemoryManager] 已迁移 ${pinnedEntries.length} 条 pinned 消息到新槽位 ${this.activeSlot}`);
    }
    
    // 7. 更新最近提练时间
    this.lastRefineAt = new Date().toISOString();
    
    console.log(`[MemoryManager] 槽位切换完成: ${oldSlot} -> ${this.activeSlot}`);
  }

  getActiveSlot(): MemorySlot {
    return this.activeSlot;
  }

  // ===== 永久记忆操作 =====

  // #24 修复：使用异步 I/O
  async appendPerm(entry: PermMemEntry): Promise<void> {
    const entries = await this.readPerm();
    
    // 检查大小限制
    const currentSize = await this.getFileSizeAsync(this.permFile);
    const entrySize = JSON.stringify(entry).length;
    
    if (currentSize + entrySize >= this.config.perm_mem_max_size) {
      throw new Error('MEMORY_OVERFLOW: 永久记忆已达上限，请执行提练精简');
    }

    entries.push(entry);
    await this.writeJsonFileAsync(this.permFile, entries);
  }

  async readPerm(): Promise<PermMemEntry[]> {
    const result = await this.readJsonFileAsync(this.permFile);
    return (result as PermMemEntry[]) || [];
  }

  async getPermSize(): Promise<number> {
    return this.getFileSizeAsync(this.permFile);
  }

  async searchPerm(keywords: string[]): Promise<PermMemEntry[]> {
    const entries = await this.readPerm();
    
    if (keywords.length === 0) {
      return entries;
    }

    // 简单的关键词匹配
    return entries.filter(entry => {
      const entryKeywords = entry.keywords.map(k => k.toLowerCase());
      const searchKeywords = keywords.map(k => k.toLowerCase());
      
      // 至少匹配一个关键词
      return searchKeywords.some(sk => 
        entryKeywords.some(ek => ek.includes(sk))
      );
    });
  }

  // #24 修复：使用异步 I/O
  async updatePerm(entry: PermMemEntry): Promise<void> {
    const entries = await this.readPerm();
    const index = entries.findIndex(e => e.id === entry.id);
    
    if (index >= 0) {
      entries[index] = entry;
      await this.writeJsonFileAsync(this.permFile, entries);
    }
  }

  async deletePerm(entryId: string): Promise<void> {
    const entries = await this.readPerm();
    const filtered = entries.filter(e => e.id !== entryId);
    await this.writeJsonFileAsync(this.permFile, filtered);
  }

  // ===== 快照备份 =====

  // #24 修复：使用异步 I/O
  async archiveTemp(slot: MemorySlot): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `temp_mem_${slot}_${timestamp}.json`;
    const archivePath = path.join(this.archiveDir, archiveName);
    
    // 复制当前槽位内容到归档
    const entries = await this.readTemp(slot);
    await this.writeJsonFileAsync(archivePath, entries);
    
    console.log(`[MemoryManager] 归档完成: ${archivePath}`);
    return archivePath;
  }

  async cleanOldArchives(days: number): Promise<number> {
    const files = await fsp.readdir(this.archiveDir);
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.archiveDir, file);
      const stats = await fsp.stat(filePath);
      
      if (stats.mtimeMs < cutoffTime) {
        await fsp.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async restoreFromArchive(archivePath: string, slot: MemorySlot): Promise<void> {
    try {
      await fsp.access(archivePath);
    } catch {
      throw new Error(`归档文件不存在: ${archivePath}`);
    }
    
    const entries = await this.readJsonFileAsync(archivePath);
    await this.writeJsonFileAsync(this.tempFiles[slot], entries);
  }

  // ===== 状态查询 =====

  // #24 修复：使用异步 I/O
  async getStats(): Promise<MemoryStats> {
    const permEntries = await this.readPerm();
    
    let archiveCount = 0;
    try {
      const files = await fsp.readdir(this.archiveDir);
      archiveCount = files.length;
    } catch {
      archiveCount = 0;
    }
    
    return {
      temp_slot1_size: await this.getTempSize(1),
      temp_slot2_size: await this.getTempSize(2),
      perm_mem_size: await this.getPermSize(),
      perm_mem_count: permEntries.length,
      active_slot: this.activeSlot,
      archive_count: archiveCount,
      last_refine_at: this.lastRefineAt || undefined,
    };
  }
}

/**
 * 创建记忆管理器实例
 */
export function createMemoryManager(config?: Partial<MemoryConfig>): IMemoryManager {
  return new MemoryManager(config);
}

// 默认导出
export default MemoryManager;
