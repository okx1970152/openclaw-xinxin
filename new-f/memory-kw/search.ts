/**
 * 超级大龙虾 - 检索引擎
 * Search Engine
 * 
 * 存放于 src/memory-kw/search.ts
 * 关键词检索 + FTS5 全文检索
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  SearchResult,
  IndexStats,
  PermMemCategory,
} from '../types/core';
import type { ISearchEngine } from './types';
import type { PermMemEntry } from './types';

/**
 * 检索引擎配置
 */
export interface SearchConfig {
  /** 索引目录 */
  indexDir: string;
  /** 永久记忆文件路径 */
  permMemPath: string;
  /** 最大结果数 */
  maxResults: number;
  /** 最小匹配分数 */
  minMatchScore: number;
  /** 是否使用 nodejieba 中文分词（如果可用） */
  useJieba: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SearchConfig = {
  indexDir: './memory/index',
  permMemPath: './memory/perm_mem.json',
  maxResults: 10,
  minMatchScore: 0.1,
  useJieba: true, // 默认尝试使用 nodejieba
};

// 尝试加载 nodejieba
let jieba: {
  cut: (text: string) => string[];
  extract: (text: string, topN: number) => Array<{ word: string; weight: number }>;
  load: (dict?: string) => void;
} | null = null;

try {
  // 动态加载 nodejieba（可选依赖）
  jieba = require('nodejieba');
  console.log('[SearchEngine] nodejieba 中文分词已加载');
} catch {
  console.log('[SearchEngine] nodejieba 未安装，使用简单分词');
}

/**
 * 索引条目
 */
interface IndexEntry {
  id: string;
  keywords: string[];
  summary: string;
  file_path: string;
  category: PermMemCategory | string;
  created_at: string;
}

/**
 * 关键词倒排索引
 */
interface InvertedIndex {
  [keyword: string]: string[]; // keyword -> entry ids
}

/**
 * 检索引擎实现
 */
export class SearchEngine implements ISearchEngine {
  private config: SearchConfig;
  private invertedIndex: InvertedIndex = {};
  private entries: Map<string, IndexEntry> = new Map();
  private indexStats: IndexStats;
  private indexReady: boolean = false;
  private jiebaAvailable: boolean;  // nodejieba 是否可用

  constructor(config?: Partial<SearchConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.jiebaAvailable = jieba !== null && this.config.useJieba;
    this.indexStats = {
      total_files: 0,
      total_keywords: 0,
      last_built: '',
      size_bytes: 0,
    };
  }

  /**
   * 关键词检索（第一层）
   */
  async searchByKeyword(query: string): Promise<SearchResult[]> {
    if (!this.indexReady) {
      await this.buildIndex();
    }

    // 分词
    const queryKeywords = this.tokenize(query);
    if (queryKeywords.length === 0) {
      return [];
    }

    // 从倒排索引查找
    const matchedIds = new Map<string, number>();

    for (const keyword of queryKeywords) {
      const lowerKeyword = keyword.toLowerCase();
      
      // 精确匹配
      if (this.invertedIndex[lowerKeyword]) {
        for (const id of this.invertedIndex[lowerKeyword]) {
          matchedIds.set(id, (matchedIds.get(id) || 0) + 1);
        }
      }

      // 模糊匹配（前缀）
      for (const [indexKey, ids] of Object.entries(this.invertedIndex)) {
        if (indexKey.includes(lowerKeyword) || lowerKeyword.includes(indexKey)) {
          for (const id of ids) {
            matchedIds.set(id, (matchedIds.get(id) || 0) + 0.5);
          }
        }
      }
    }

    // 排序并生成结果
    const sortedIds = Array.from(matchedIds.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxResults);

    const results: SearchResult[] = [];
    for (const [id, score] of sortedIds) {
      const entry = this.entries.get(id);
      if (entry) {
        const matchScore = Math.min(1, score / queryKeywords.length);
        if (matchScore >= this.config.minMatchScore) {
          results.push({
            file_name: path.basename(entry.file_path),
            file_path: entry.file_path,
            keywords: entry.keywords,
            summary: entry.summary,
            match_score: matchScore,
            source: 'keyword',
          });
        }
      }
    }

    return results;
  }

  /**
   * FTS5 全文检索（第二层 fallback）
   */
  async searchByFTS(query: string): Promise<SearchResult[]> {
    if (!this.indexReady) {
      await this.buildIndex();
    }

    // 简化的全文检索实现（遍历所有条目）
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);
    
    const results: SearchResult[] = [];
    
    for (const [_id, entry] of this.entries) {
      const content = `${entry.keywords.join(' ')} ${entry.summary}`.toLowerCase();
      
      // 计算匹配分数
      let matchCount = 0;
      for (const term of queryTerms) {
        if (content.includes(term)) {
          matchCount++;
        }
      }
      
      if (matchCount > 0) {
        const matchScore = matchCount / queryTerms.length;
        if (matchScore >= this.config.minMatchScore) {
          results.push({
            file_name: path.basename(entry.file_path),
            file_path: entry.file_path,
            keywords: entry.keywords,
            summary: entry.summary,
            match_score: matchScore,
            source: 'fts5',
          });
        }
      }
    }

    // 按匹配分数排序
    results.sort((a, b) => b.match_score - a.match_score);
    
    return results.slice(0, this.config.maxResults);
  }

  /**
   * 综合检索（按策略自动选择）
   */
  async search(query: string): Promise<SearchResult[]> {
    // 首先尝试关键词检索
    const keywordResults = await this.searchByKeyword(query);
    
    if (keywordResults.length > 0) {
      return keywordResults;
    }

    // 关键词检索无结果，使用 FTS5 全文检索
    return this.searchByFTS(query);
  }

  /**
   * 全量重建索引
   */
  async buildIndex(): Promise<void> {
    // 清空现有索引
    this.invertedIndex = {};
    this.entries.clear();

    // 读取永久记忆
    if (fs.existsSync(this.config.permMemPath)) {
      try {
        const content = fs.readFileSync(this.config.permMemPath, 'utf-8');
        const permEntries = JSON.parse(content) as PermMemEntry[];
        
        for (const entry of permEntries) {
          this.addToIndex({
            id: entry.id,
            keywords: entry.keywords,
            summary: entry.summary,
            file_path: `${this.config.permMemPath}#${entry.id}`,
            category: entry.category,
            created_at: entry.created_at,
          });
        }
      } catch (error) {
        console.error('[SearchEngine] 读取永久记忆失败:', error);
      }
    }

    // 扫描并索引其他文件
    await this.scanAndIndex(this.config.indexDir);

    // 更新统计
    this.indexStats = {
      total_files: this.entries.size,
      total_keywords: Object.keys(this.invertedIndex).length,
      last_built: new Date().toISOString(),
      size_bytes: this.calculateIndexSize(),
    };

    this.indexReady = true;
    console.log(`[SearchEngine] 索引构建完成: ${this.indexStats.total_files} 条目, ${this.indexStats.total_keywords} 关键词`);
  }

  /**
   * 增量更新索引
   */
  async updateIndex(_filePath: string): Promise<void> {
    // 简化实现：重新构建整个索引
    // TODO: 实现真正的增量更新
    await this.buildIndex();
  }

  /**
   * 获取索引统计
   */
  async getIndexStats(): Promise<IndexStats> {
    return { ...this.indexStats };
  }

  /**
   * 检查索引是否存在
   */
  isIndexReady(): boolean {
    return this.indexReady;
  }

  // ===== 私有方法 =====

  /**
   * 添加条目到索引
   */
  private addToIndex(entry: IndexEntry): void {
    // 存储条目
    this.entries.set(entry.id, entry);

    // 更新倒排索引
    for (const keyword of entry.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (!this.invertedIndex[lowerKeyword]) {
        this.invertedIndex[lowerKeyword] = [];
      }
      if (!this.invertedIndex[lowerKeyword].includes(entry.id)) {
        this.invertedIndex[lowerKeyword].push(entry.id);
      }
    }

    // 也索引摘要中的关键词
    const summaryTerms = this.tokenize(entry.summary);
    for (const term of summaryTerms) {
      const lowerTerm = term.toLowerCase();
      if (lowerTerm.length >= 2 && !this.invertedIndex[lowerTerm]) {
        this.invertedIndex[lowerTerm] = [entry.id];
      } else if (lowerTerm.length >= 2 && !this.invertedIndex[lowerTerm].includes(entry.id)) {
        this.invertedIndex[lowerTerm].push(entry.id);
      }
    }
  }

  /**
   * 分词
   * 实施方案 6.1 节要求：query → nodejieba 分词 → 关键词倒排索引查询
   */
  private tokenize(text: string): string[] {
    const terms: string[] = [];
    
    // 英文单词
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    terms.push(...englishWords);
    
    // 中文分词
    const chinesePhrases = text.match(/[\u4e00-\u9fa5]+/g) || [];
    
    if (this.jiebaAvailable && jieba) {
      // 使用 nodejieba 进行专业中文分词
      try {
        for (const phrase of chinesePhrases) {
          const cutResult = jieba.cut(phrase);
          terms.push(...cutResult);
        }
      } catch (error) {
        // jieba 分词失败，回退到简单分词
        console.warn('[SearchEngine] jieba 分词失败，回退到简单分词:', error);
        terms.push(...this.simpleChineseTokenize(chinesePhrases.join('')));
      }
    } else {
      // 使用简单分词（双字滑动窗口）
      terms.push(...this.simpleChineseTokenize(chinesePhrases.join('')));
    }

    return [...new Set(terms.map(t => t.toLowerCase()))];
  }

  /**
   * 简单中文分词（双字滑动窗口 + 单字）
   */
  private simpleChineseTokenize(text: string): string[] {
    const terms: string[] = [];
    
    // 双字词组
    for (let i = 0; i < text.length - 1; i++) {
      terms.push(text.substring(i, i + 2));
    }
    // 单字也保留
    for (const char of text) {
      terms.push(char);
    }

    return terms;
  }

  /**
   * 扫描并索引目录
   */
  private async scanAndIndex(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      
      if (file.isDirectory()) {
        await this.scanAndIndex(fullPath);
      } else if (file.name.endsWith('.md') || file.name.endsWith('.json')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const keywords = this.tokenize(content);
          
          this.addToIndex({
            id: `file_${file.name}_${Date.now()}`,
            keywords: keywords.slice(0, 10), // 最多10个关键词
            summary: content.substring(0, 200),
            file_path: fullPath,
            category: 'file',
            created_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`[SearchEngine] 索引文件失败: ${fullPath}`, error);
        }
      }
    }
  }

  /**
   * 计算索引大小
   */
  private calculateIndexSize(): number {
    let size = 0;
    for (const [key, value] of Object.entries(this.invertedIndex)) {
      size += key.length * 2; // UTF-16
      size += value.length * 32; // 每个 ID 约 32 字节
    }
    return size;
  }
}

/**
 * 创建检索引擎实例
 */
export function createSearchEngine(config?: Partial<SearchConfig>): ISearchEngine {
  return new SearchEngine(config);
}

export default SearchEngine;
