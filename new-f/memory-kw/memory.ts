/**
 * 超级大龙虾 - 记忆管理器实现
 * Memory Manager Implementation
 * 
 * 存放于 src/memory-kw/memory.ts
 * 三层记忆的读写、轮换、备份
 */

import * as fs from 'fs';
import * as path from 'path';
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
   */
  private initialize(): void {
    // 创建目录
    if (!fs.existsSync(this.config.memory_dir)) {
      fs.mkdirSync(this.config.memory_dir, { recursive: true });
    }
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }

    // 初始化临时记忆文件
    for (const slot of [1, 2] as MemorySlot[]) {
      if (!fs.existsSync(this.tempFiles[slot])) {
        this.writeJsonFile(this.tempFiles[slot], []);
      }
    }

    // 初始化永久记忆文件
    if (!fs.existsSync(this.permFile)) {
      this.writeJsonFile(this.permFile, []);
    }

    // 读取或初始化活跃槽位
    if (fs.existsSync(this.slotFilePath)) {
      const slotData = this.readJsonFile(this.slotFilePath);
      this.activeSlot = slotData.active_slot as MemorySlot;
    } else {
      this.writeJsonFile(this.slotFilePath, { active_slot: this.activeSlot });
    }
  }

  // ===== 文件操作工具 =====

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

  private getFileSize(filePath: string): number {
    if (!fs.existsSync(filePath)) {
      return 0;
    }
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  // ===== 临时记忆操作 =====

  async appendTemp(entry: TempMemEntry): Promise<void> {
    const currentFile = this.tempFiles[this.activeSlot];
    const entries = await this.readTemp(this.activeSlot);
    
    // 检查大小限制
    const currentSize = this.getFileSize(currentFile);
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
    this.writeJsonFile(currentFile, entries);
  }

  async readTemp(slot: MemorySlot): Promise<TempMemEntry[]> {
    return (this.readJsonFile(this.tempFiles[slot]) as TempMemEntry[]) || [];
  }

  async getTempSize(slot: MemorySlot): Promise<number> {
    return this.getFileSize(this.tempFiles[slot]);
  }

  async clearTemp(slot: MemorySlot): Promise<void> {
    this.writeJsonFile(this.tempFiles[slot], []);
  }

  async switchSlot(): Promise<void> {
    const oldSlot = this.activeSlot;
    
    // 1. 归档旧槽位
    await this.archiveTemp(oldSlot);
    
    // 2. 触发提练流程（技术设计文档 2.2 节要求）
    const tempEntries = await this.readTemp(oldSlot);
    if (tempEntries.length > 0) {
      try {
        const result = await this.refinementEngine.refine(
          tempEntries,
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
    this.writeJsonFile(this.slotFilePath, { active_slot: this.activeSlot });
    
    // 6. 更新最近提练时间
    this.lastRefineAt = new Date().toISOString();
    
    console.log(`[MemoryManager] 槽位切换: ${oldSlot} -> ${this.activeSlot}`);
  }

  getActiveSlot(): MemorySlot {
    return this.activeSlot;
  }

  // ===== 永久记忆操作 =====

  async appendPerm(entry: PermMemEntry): Promise<void> {
    const entries = await this.readPerm();
    
    // 检查大小限制
    const currentSize = this.getFileSize(this.permFile);
    const entrySize = JSON.stringify(entry).length;
    
    if (currentSize + entrySize >= this.config.perm_mem_max_size) {
      throw new Error('MEMORY_OVERFLOW: 永久记忆已达上限，请执行提练精简');
    }

    entries.push(entry);
    this.writeJsonFile(this.permFile, entries);
  }

  async readPerm(): Promise<PermMemEntry[]> {
    return (this.readJsonFile(this.permFile) as PermMemEntry[]) || [];
  }

  async getPermSize(): Promise<number> {
    return this.getFileSize(this.permFile);
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

  async updatePerm(entry: PermMemEntry): Promise<void> {
    const entries = await this.readPerm();
    const index = entries.findIndex(e => e.id === entry.id);
    
    if (index >= 0) {
      entries[index] = entry;
      this.writeJsonFile(this.permFile, entries);
    }
  }

  async deletePerm(entryId: string): Promise<void> {
    const entries = await this.readPerm();
    const filtered = entries.filter(e => e.id !== entryId);
    this.writeJsonFile(this.permFile, filtered);
  }

  // ===== 快照备份 =====

  async archiveTemp(slot: MemorySlot): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `temp_mem_${slot}_${timestamp}.json`;
    const archivePath = path.join(this.archiveDir, archiveName);
    
    // 复制当前槽位内容到归档
    const entries = await this.readTemp(slot);
    this.writeJsonFile(archivePath, entries);
    
    console.log(`[MemoryManager] 归档完成: ${archivePath}`);
    return archivePath;
  }

  async cleanOldArchives(days: number): Promise<number> {
    const files = fs.readdirSync(this.archiveDir);
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.archiveDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async restoreFromArchive(archivePath: string, slot: MemorySlot): Promise<void> {
    if (!fs.existsSync(archivePath)) {
      throw new Error(`归档文件不存在: ${archivePath}`);
    }
    
    const entries = this.readJsonFile(archivePath);
    this.writeJsonFile(this.tempFiles[slot], entries);
  }

  // ===== 状态查询 =====

  async getStats(): Promise<MemoryStats> {
    const permEntries = await this.readPerm();
    
    return {
      temp_slot1_size: await this.getTempSize(1),
      temp_slot2_size: await this.getTempSize(2),
      perm_mem_size: await this.getPermSize(),
      perm_mem_count: permEntries.length,
      active_slot: this.activeSlot,
      archive_count: fs.readdirSync(this.archiveDir).length,
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
