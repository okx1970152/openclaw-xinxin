/**
 * 文件监听 + 索引更新模块
 *
 * 使用 chokidar 监听文件变化，自动更新检索索引
 * 设计要点：
 * 1. 防抖处理，避免频繁更新
 * 2. 批量更新索引
 * 3. 错误恢复机制
 */

import chokidar, { FSWatcher } from 'chokidar';
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, extname } from 'path';
import type { SearchResult, IndexStats } from '../types/core';

// 索引条目类型
export interface IndexEntry {
  file_path: string;
  file_name: string;
  keywords: string[];
  summary: string;
  last_modified: string;
  size_bytes: number;
}

// 索引文件结构
export interface IndexFile {
  version: string;
  last_built: string;
  entries: Record<string, IndexEntry>;
  stats: IndexStats;
}

// Watcher 配置
export interface WatcherConfig {
  watchPaths: string[]; // 监听的目录路径
  ignorePatterns?: string[]; // 忽略的文件模式
  debounceMs?: number; // 防抖时间（毫秒）
  indexFilePath?: string; // 索引文件路径
  maxFileSize?: number; // 最大索引文件大小（字节）
}

// 默认忽略模式
const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/*.lock',
  '**/*.log',
];

// 支持的文件类型
const SUPPORTED_EXTENSIONS = [
  '.json', '.md', '.txt', '.yaml', '.yml',
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.go', '.rs', '.java',
];

/**
 * 文件监听器 + 索引管理器
 */
export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private config: Required<WatcherConfig>;
  private index: IndexFile;
  private pendingUpdates: Map<string, 'add' | 'change' | 'unlink'> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(config: WatcherConfig) {
    this.config = {
      watchPaths: config.watchPaths,
      ignorePatterns: config.ignorePatterns || DEFAULT_IGNORE_PATTERNS,
      debounceMs: config.debounceMs || 1000,
      indexFilePath: config.indexFilePath || join(process.cwd(), 'memory', 'index.json'),
      maxFileSize: config.maxFileSize || 1024 * 1024, // 1MB
    };

    // 初始化索引
    this.index = this.loadOrCreateIndex();
  }

  /**
   * 加载或创建索引文件
   */
  private loadOrCreateIndex(): IndexFile {
    if (existsSync(this.config.indexFilePath)) {
      try {
        const content = readFileSync(this.config.indexFilePath, 'utf-8');
        return JSON.parse(content);
      } catch {
        console.warn('Failed to load index file, creating new one');
      }
    }

    return {
      version: '1.0.0',
      last_built: new Date().toISOString(),
      entries: {},
      stats: {
        total_files: 0,
        total_keywords: 0,
        last_built: new Date().toISOString(),
        size_bytes: 0,
      },
    };
  }

  /**
   * 保存索引文件
   */
  private saveIndex(): void {
    // 确保目录存在
    const dir = join(this.config.indexFilePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // 更新统计信息
    this.updateStats();

    // 写入文件
    writeFileSync(this.config.indexFilePath, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const entries = Object.values(this.index.entries);
    let totalKeywords = 0;

    for (const entry of entries) {
      totalKeywords += entry.keywords.length;
    }

    this.index.stats = {
      total_files: entries.length,
      total_keywords: totalKeywords,
      last_built: this.index.last_built,
      size_bytes: existsSync(this.config.indexFilePath)
        ? statSync(this.config.indexFilePath).size
        : 0,
    };
  }

  /**
   * 启动文件监听
   */
  async start(): Promise<void> {
    if (this.watcher) {
      return;
    }

    // 创建监听器
    this.watcher = chokidar.watch(this.config.watchPaths, {
      ignored: this.config.ignorePatterns,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    // 绑定事件处理
    this.watcher
      .on('add', (path) => this.onFileChange(path, 'add'))
      .on('change', (path) => this.onFileChange(path, 'change'))
      .on('unlink', (path) => this.onFileChange(path, 'unlink'))
      .on('error', (error) => this.onError(error));

    // 等待初始扫描完成
    await new Promise<void>((resolve) => {
      this.watcher!.on('ready', () => {
        console.log('File watcher ready');
        resolve();
      });
    });
  }

  /**
   * 停止文件监听
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // 处理剩余的更新
    if (this.pendingUpdates.size > 0) {
      await this.processPendingUpdates();
    }
  }

  /**
   * 文件变化处理（防抖）
   */
  private onFileChange(filePath: string, event: 'add' | 'change' | 'unlink'): void {
    // 检查文件扩展名
    const ext = extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext) && event !== 'unlink') {
      return;
    }

    // 添加到待处理队列
    this.pendingUpdates.set(filePath, event);

    // 防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingUpdates().catch(console.error);
    }, this.config.debounceMs);
  }

  /**
   * 处理待更新的文件
   */
  private async processPendingUpdates(): Promise<void> {
    if (this.isProcessing || this.pendingUpdates.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const updates = new Map(this.pendingUpdates);
      this.pendingUpdates.clear();

      for (const [filePath, event] of updates) {
        try {
          if (event === 'unlink') {
            this.removeEntry(filePath);
          } else {
            await this.updateEntry(filePath);
          }
        } catch (error) {
          console.error(`Failed to process ${event} for ${filePath}:`, error);
        }
      }

      // 保存更新后的索引
      this.saveIndex();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 更新索引条目
   */
  private async updateEntry(filePath: string): Promise<void> {
    // 检查文件大小
    const stats = statSync(filePath);
    if (stats.size > this.config.maxFileSize) {
      console.warn(`File too large to index: ${filePath}`);
      return;
    }

    // 读取文件内容
    const content = readFileSync(filePath, 'utf-8');

    // 提取关键词和摘要
    const { keywords, summary } = this.extractFromContent(content, filePath);

    // 创建索引条目
    const relativePath = relative(process.cwd(), filePath);
    const fileName = filePath.split('/').pop() || filePath;

    const entry: IndexEntry = {
      file_path: relativePath,
      file_name: fileName,
      keywords,
      summary,
      last_modified: stats.mtime.toISOString(),
      size_bytes: stats.size,
    };

    this.index.entries[relativePath] = entry;
  }

  /**
   * 移除索引条目
   */
  private removeEntry(filePath: string): void {
    const relativePath = relative(process.cwd(), filePath);
    delete this.index.entries[relativePath];
  }

  /**
   * 从内容提取关键词和摘要
   */
  private extractFromContent(content: string, filePath: string): {
    keywords: string[];
    summary: string;
  } {
    const ext = extname(filePath).toLowerCase();
    let keywords: string[] = [];
    let summary = '';

    switch (ext) {
      case '.json':
        // JSON 文件：提取 key 和部分 value
        try {
          const json = JSON.parse(content);
          keywords = this.extractKeywordsFromJSON(json);
          summary = this.createJSONSummary(json);
        } catch {
          keywords = ['json', 'parse-error'];
          summary = 'JSON parse error';
        }
        break;

      case '.md':
        // Markdown：提取标题和关键词
        keywords = this.extractKeywordsFromMarkdown(content);
        summary = this.createMarkdownSummary(content);
        break;

      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        // 代码文件：提取函数名、类名等
        keywords = this.extractKeywordsFromCode(content);
        summary = this.createCodeSummary(content);
        break;

      default:
        // 其他文件：简单提取
        keywords = this.extractSimpleKeywords(content);
        summary = content.slice(0, 200);
    }

    return {
      keywords: keywords.slice(0, 10), // 最多 10 个关键词
      summary: summary.slice(0, 200), // 最多 200 字符摘要
    };
  }

  /**
   * 从 JSON 提取关键词
   */
  private extractKeywordsFromJSON(json: unknown, depth = 0): string[] {
    if (depth > 3) { return []; }

    const keywords: string[] = [];

    if (typeof json === 'object' && json !== null) {
      for (const key of Object.keys(json as Record<string, unknown>)) {
        keywords.push(key);
        const value = (json as Record<string, unknown>)[key];
        if (typeof value === 'object' && value !== null) {
          keywords.push(...this.extractKeywordsFromJSON(value, depth + 1));
        }
      }
    }

    return [...new Set(keywords)];
  }

  /**
   * 创建 JSON 摘要
   */
  private createJSONSummary(json: unknown): string {
    if (typeof json !== 'object' || json === null) {
      return String(json);
    }

    const keys = Object.keys(json as Record<string, unknown>);
    return `JSON object with keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`;
  }

  /**
   * 从 Markdown 提取关键词
   */
  private extractKeywordsFromMarkdown(content: string): string[] {
    const keywords: string[] = [];

    // 提取标题
    const headers = content.match(/^#+\s+(.+)$/gm) || [];
    for (const header of headers.slice(0, 3)) {
      keywords.push(header.replace(/^#+\s+/, '').trim());
    }

    // 提取代码块语言
    const codeBlocks = content.match(/```(\w+)/g) || [];
    for (const block of codeBlocks) {
      keywords.push(block.replace('```', ''));
    }

    // 提取关键词（简单实现：提取重复出现的词）
    const words = content.toLowerCase().match(/\b[a-z\u4e00-\u9fa5]{2,}\b/g) || [];
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    // 取出现次数最多的词
    const topWords = Array.from(wordCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    keywords.push(...topWords);

    return [...new Set(keywords)];
  }

  /**
   * 创建 Markdown 摘要
   */
  private createMarkdownSummary(content: string): string {
    // 取第一个非空段落
    const paragraphs = content.split('\n\n')
      .filter((p) => p.trim() && !p.startsWith('#') && !p.startsWith('```'));

    if (paragraphs.length > 0) {
      return paragraphs[0].trim().slice(0, 200);
    }

    // 如果没有段落，取标题
    const firstHeader = content.match(/^#+\s+(.+)$/m);
    if (firstHeader) {
      return `标题: ${firstHeader[1]}`;
    }

    return content.slice(0, 200);
  }

  /**
   * 从代码提取关键词
   */
  private extractKeywordsFromCode(content: string): string[] {
    const keywords: string[] = [];

    // 提取函数名
    const functions = content.match(/(?:function|const|let|var)\s+(\w+)\s*[=(]/g) || [];
    for (const fn of functions.slice(0, 5)) {
      const match = fn.match(/(\w+)\s*[=(]/);
      if (match) { keywords.push(match[1]); }
    }

    // 提取类名
    const classes = content.match(/class\s+(\w+)/g) || [];
    for (const cls of classes.slice(0, 3)) {
      keywords.push(cls.replace('class ', ''));
    }

    // 提取导入的模块
    const imports = content.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
    for (const imp of imports.slice(0, 5)) {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (match) { keywords.push(match[1]); }
    }

    return [...new Set(keywords)];
  }

  /**
   * 创建代码摘要
   */
  private createCodeSummary(content: string): string {
    // 提取文件顶部的注释
    const commentMatch = content.match(/^(\/\/.*|\/\*[\s\S]*?\*\/)/);
    if (commentMatch) {
      return commentMatch[0].slice(0, 200);
    }

    // 提取第一个函数/类定义
    const firstDefMatch = content.match(/(?:export\s+)?(?:function|class|const)\s+\w+/);
    if (firstDefMatch) {
      return `Defines: ${firstDefMatch[0]}`;
    }

    return content.slice(0, 200);
  }

  /**
   * 简单关键词提取
   */
  private extractSimpleKeywords(content: string): string[] {
    const words = content.toLowerCase().match(/\b[a-z\u4e00-\u9fa5]{2,}\b/g) || [];
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * 错误处理
   */
  private onError(error: Error): void {
    console.error('File watcher error:', error);
  }

  /**
   * 手动重建索引
   */
  async rebuildIndex(): Promise<IndexStats> {
    // 清空现有索引
    this.index.entries = {};
    this.index.last_built = new Date().toISOString();

    // 遍历所有监听路径
    for (const watchPath of this.config.watchPaths) {
      if (existsSync(watchPath)) {
        await this.scanDirectory(watchPath);
      }
    }

    // 保存索引
    this.saveIndex();

    return this.index.stats;
  }

  /**
   * 扫描目录并更新索引
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    const { readdirSync, statSync } = await import('fs');
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = statSync(fullPath);

      // 检查是否在忽略模式中
      const relativePath = relative(process.cwd(), fullPath);
      if (this.config.ignorePatterns.some((pattern) => {
        // 简单的模式匹配
        return relativePath.includes(pattern.replace(/\*\*/g, '').replace(/\*/g, ''));
      })) {
        continue;
      }

      if (stats.isDirectory()) {
        await this.scanDirectory(fullPath);
      } else if (stats.isFile()) {
        const ext = extname(fullPath).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            await this.updateEntry(fullPath);
          } catch (error) {
            console.error(`Failed to index ${fullPath}:`, error);
          }
        }
      }
    }
  }

  /**
   * 搜索索引
   */
  search(query: string, limit = 10): SearchResult[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    const results: SearchResult[] = [];

    for (const entry of Object.values(this.index.entries)) {
      // 计算匹配分数
      let score = 0;

      // 关键词匹配
      for (const keyword of entry.keywords) {
        for (const queryWord of queryWords) {
          if (keyword.toLowerCase().includes(queryWord)) {
            score += 0.3;
          }
        }
      }

      // 文件名匹配
      if (entry.file_name.toLowerCase().includes(queryLower)) {
        score += 0.5;
      }

      // 摘要匹配
      if (entry.summary.toLowerCase().includes(queryLower)) {
        score += 0.2;
      }

      if (score > 0) {
        results.push({
          file_name: entry.file_name,
          file_path: entry.file_path,
          keywords: entry.keywords,
          summary: entry.summary,
          match_score: Math.min(score, 1),
          source: 'keyword',
        });
      }
    }

    // 按分数排序并限制数量
    return results
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);
  }

  /**
   * 获取索引统计信息
   */
  getStats(): IndexStats {
    return this.index.stats;
  }
}

// 导出单例创建函数
export function createFileWatcher(config: WatcherConfig): FileWatcher {
  return new FileWatcher(config);
}
