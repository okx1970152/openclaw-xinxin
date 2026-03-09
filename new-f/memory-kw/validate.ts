/**
 * 超级大龙虾 - 四步验证器
 * Four-Step Validator
 * 
 * 存放于 src/memory-kw/validate.ts
 * 永久记忆条目的四步验证
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  PermMemEntry,
  ValidationReport,
  ValidationCheck,
  ValidationSeverity,
} from '../types/core';
import type { IValidator } from './types';

/**
 * 验证器配置
 */
export interface ValidatorConfig {
  /** 是否自动修复 */
  autoFix: boolean;
  /** 关键词最小数量 */
  minKeywordCount: number;
  /** 关键词最大数量 */
  maxKeywordCount: number;
  /** 摘要最大长度 */
  maxSummaryLength: number;
  /** 是否检查文件真实存在 */
  checkFileExists: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ValidatorConfig = {
  autoFix: true,
  minKeywordCount: 3,
  maxKeywordCount: 5,
  maxSummaryLength: 200,
  checkFileExists: true,
};

/**
 * 四步验证器实现
 * 
 * 验证步骤：
 * 1. 文件路径真实性检查
 * 2. 关键词回溯检查
 * 3. 关系一致性检查
 * 4. 格式合规检查
 */
export class FourStepValidator implements IValidator {
  private config: ValidatorConfig;

  constructor(config?: Partial<ValidatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 验证永久记忆条目
   * @param entry 待验证的条目
   * @param rawContent temp_mem 原文（用于回溯检查）
   * @param registryPath registry.json 路径
   * @returns 验证报告
   */
  async validate(
    entry: PermMemEntry,
    rawContent: string,
    registryPath: string
  ): Promise<ValidationReport> {
    const checks: ValidationCheck[] = [];
    const autoFixes: string[] = [];
    let severity: ValidationSeverity = 'ok';

    // 步骤1: 文件路径真实性检查
    const fileCheck = await this.checkFilePaths(entry, registryPath);
    checks.push(fileCheck);
    if (!fileCheck.passed) {
      severity = 'minor';
      if (fileCheck.removed_items && fileCheck.removed_items.length > 0) {
        autoFixes.push(`移除了不存在的文件路径: ${fileCheck.removed_items.join(', ')}`);
      }
    }

    // 步骤2: 关键词回溯检查
    const keywordCheck = this.checkKeywords(entry, rawContent);
    checks.push(keywordCheck);
    if (!keywordCheck.passed) {
      if (severity === 'ok') severity = 'minor';
      if (keywordCheck.removed_items && keywordCheck.removed_items.length > 0) {
        autoFixes.push(`移除了未在原文中出现的关键词: ${keywordCheck.removed_items.join(', ')}`);
      }
    }

    // 步骤3: 关系一致性检查
    const relationCheck = await this.checkRelations(entry, registryPath);
    checks.push(relationCheck);
    if (!relationCheck.passed) {
      severity = 'major';
    }

    // 步骤4: 格式合规检查
    const formatCheck = this.checkFormat(entry);
    checks.push(formatCheck);
    if (!formatCheck.passed) {
      if (severity === 'ok') severity = 'minor';
      if (formatCheck.removed_items && formatCheck.removed_items.length > 0) {
        autoFixes.push(`格式修复: ${formatCheck.detail}`);
      }
    }

    return {
      passed: severity !== 'major',
      severity,
      checks,
      auto_fixes: autoFixes,
    };
  }

  /**
   * 批量验证
   */
  async validateBatch(
    entries: PermMemEntry[],
    rawContent: string,
    registryPath: string
  ): Promise<Map<string, ValidationReport>> {
    const results = new Map<string, ValidationReport>();

    for (const entry of entries) {
      const report = await this.validate(entry, rawContent, registryPath);
      results.set(entry.id, report);
    }

    return results;
  }

  // ===== 步骤1: 文件路径真实性检查 =====

  private async checkFilePaths(
    entry: PermMemEntry,
    registryPath: string
  ): Promise<ValidationCheck> {
    const removedItems: string[] = [];
    const registryDir = path.dirname(registryPath);

    const validFiles = entry.file_refs.filter(filePath => {
      // 检查格式是否合法
      const isValidFormat = /^\.?\.?\/[\w\-./]+$/.test(filePath) || 
                            /^\/[\w\-./]+$/.test(filePath) ||
                            /^[a-zA-Z]:\\[\w\-./\\]+$/.test(filePath);
      
      if (!isValidFormat) {
        removedItems.push(filePath);
        return false;
      }

      // 如果配置了检查真实存在
      if (this.config.checkFileExists) {
        // 尝试解析相对路径
        let absolutePath = filePath;
        if (!path.isAbsolute(filePath)) {
          absolutePath = path.resolve(registryDir, filePath);
        }

        if (!fs.existsSync(absolutePath)) {
          removedItems.push(filePath);
          return false;
        }
      }

      return true;
    });

    // 自动修复
    if (this.config.autoFix && removedItems.length > 0) {
      entry.file_refs = validFiles;
    }

    return {
      name: 'file_path_exists',
      passed: removedItems.length === 0,
      detail: removedItems.length > 0
        ? `发现 ${removedItems.length} 个无效文件路径并已移除`
        : '所有文件路径验证通过',
      removed_items: removedItems,
    };
  }

  // ===== 步骤2: 关键词回溯检查 =====

  private checkKeywords(
    entry: PermMemEntry,
    rawContent: string
  ): ValidationCheck {
    const removedItems: string[] = [];
    const rawTextLower = rawContent.toLowerCase();

    const validKeywords = entry.keywords.filter(keyword => {
      const found = rawTextLower.includes(keyword.toLowerCase());
      if (!found) {
        removedItems.push(keyword);
      }
      return found;
    });

    // 自动修复
    if (this.config.autoFix && removedItems.length > 0) {
      entry.keywords = validKeywords;
    }

    return {
      name: 'keyword_in_source',
      passed: removedItems.length === 0,
      detail: removedItems.length > 0
        ? `移除了 ${removedItems.length} 个未在原文中出现的关键词`
        : '所有关键词都在原文中找到',
      removed_items: removedItems,
    };
  }

  // ===== 步骤3: 关系一致性检查 =====

  private async checkRelations(
    entry: PermMemEntry,
    registryPath: string
  ): Promise<ValidationCheck> {
    const issues: string[] = [];

    // 检查必要的关联字段
    if (!entry.relations.agent || entry.relations.agent.trim() === '') {
      issues.push('缺少代理信息');
    }

    if (!entry.relations.project || entry.relations.project.trim() === '') {
      issues.push('缺少项目信息');
    }

    // 检查 tech_stack 是否有效
    if (!Array.isArray(entry.relations.tech_stack)) {
      issues.push('技术栈格式错误');
    }

    // 检查 related_patterns 是否有效
    if (!Array.isArray(entry.relations.related_patterns)) {
      issues.push('关联模式格式错误');
    }

    return {
      name: 'relations_consistent',
      passed: issues.length === 0,
      detail: issues.length > 0 ? issues.join('; ') : '关系信息完整且一致',
    };
  }

  // ===== 步骤4: 格式合规检查 =====

  private checkFormat(entry: PermMemEntry): ValidationCheck {
    const issues: string[] = [];
    const removedItems: string[] = [];

    // 检查摘要长度
    if (entry.summary.length > this.config.maxSummaryLength) {
      issues.push(`摘要超长 (${entry.summary.length} > ${this.config.maxSummaryLength})`);
      if (this.config.autoFix) {
        entry.summary = entry.summary.substring(0, this.config.maxSummaryLength - 3) + '...';
        removedItems.push('摘要已截断');
      }
    }

    // 检查关键词数量
    if (entry.keywords.length < this.config.minKeywordCount) {
      issues.push(`关键词数量不足 (${entry.keywords.length} < ${this.config.minKeywordCount})`);
    }

    if (entry.keywords.length > this.config.maxKeywordCount) {
      issues.push(`关键词数量过多 (${entry.keywords.length} > ${this.config.maxKeywordCount})`);
      if (this.config.autoFix) {
        entry.keywords = entry.keywords.slice(0, this.config.maxKeywordCount);
        removedItems.push('关键词已裁剪');
      }
    }

    // 检查分类是否有效
    const validCategories = ['子代理能力', '路由规则', '协作流程', '创建模板', '失败结论', '成功流程'];
    if (!validCategories.includes(entry.category)) {
      issues.push(`无效的分类: ${entry.category}`);
    }

    // 检查时间戳格式
    if (!this.isValidISO8601(entry.created_at)) {
      issues.push('创建时间格式无效');
    }

    return {
      name: 'format_compliant',
      passed: issues.length === 0,
      detail: issues.length > 0 ? issues.join('; ') : '格式符合规范',
      removed_items: removedItems.length > 0 ? removedItems : undefined,
    };
  }

  /**
   * 检查 ISO8601 格式
   */
  private isValidISO8601(timestamp: string): boolean {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
    return iso8601Regex.test(timestamp);
  }
}

/**
 * 创建验证器实例
 */
export function createValidator(config?: Partial<ValidatorConfig>): IValidator {
  return new FourStepValidator(config);
}

/**
 * 快速验证单个条目
 */
export async function validateEntry(
  entry: PermMemEntry,
  rawContent: string,
  registryPath: string
): Promise<ValidationReport> {
  const validator = new FourStepValidator();
  return validator.validate(entry, rawContent, registryPath);
}

export default FourStepValidator;
