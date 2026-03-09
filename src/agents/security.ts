/**
 * 超级大龙虾 - SecurityAgent 安全审查模块
 * Security Agent Module
 * 
 * 存放于 src/agents/security.ts
 * 实现五层安全审查机制
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AuditReport,
  AuditCheck,
  RiskLevel,
} from '../types/core';

/**
 * 安全审查器接口
 */
export interface ISecurityAgent {
  /**
   * 审查 Skill 文件
   * @param skillPath Skill 文件或目录路径
   * @returns 审查报告
   */
  auditSkill(skillPath: string): Promise<AuditReport>;
}

/**
 * 安全审查配置
 */
export interface SecurityAuditConfig {
  /** 是否检查危险命令 */
  checkDangerousCommands: boolean;
  /** 是否检查网络请求 */
  checkNetworkRequests: boolean;
  /** 是否检查 Prompt 注入 */
  checkPromptInjection: boolean;
  /** 是否检查敏感文件访问 */
  checkSensitiveFileAccess: boolean;
  /** 危险命令白名单 */
  dangerousCommandWhitelist: string[];
  /** 敏感路径模式 */
  sensitivePathPatterns: string[];
}

/**
 * 默认安全审查配置
 */
const DEFAULT_CONFIG: SecurityAuditConfig = {
  checkDangerousCommands: true,
  checkNetworkRequests: true,
  checkPromptInjection: true,
  checkSensitiveFileAccess: true,
  dangerousCommandWhitelist: [],
  sensitivePathPatterns: [
    '~/.openclaw/',
    '.env',
    'credentials',
    'token',
    'secret',
    'password',
    'private_key',
    '.pem',
    '.key',
  ],
};

/**
 * 危险命令模式
 */
const DANGEROUS_COMMAND_PATTERNS = [
  { pattern: /\brm\s+(-[rf]+\s+|.*-rf)/gi, name: 'rm -rf 删除命令' },
  { pattern: /\brm\s+--no-preserve-root/gi, name: '危险 rm 命令' },
  { pattern: /\bcurl\s+.*\|\s*(bash|sh|zsh)/gi, name: 'curl 管道执行' },
  { pattern: /\bwget\s+.*\|\s*(bash|sh|zsh)/gi, name: 'wget 管道执行' },
  { pattern: /\bchmod\s+[0-7]{3,4}\s+\//gi, name: 'chmod 修改系统权限' },
  { pattern: /\bdd\s+if=.*of=\/dev\//gi, name: 'dd 磁盘操作' },
  { pattern: /\bmkfs\./gi, name: '格式化命令' },
  { pattern: /\b>\s*\/dev\/(sda|hda|nvme|sd[a-z])/gi, name: '写入设备文件' },
  { pattern: /eval\s*\(/gi, name: 'eval 动态执行' },
  { pattern: /exec\s*\(/gi, name: 'exec 执行' },
  { pattern: /Function\s*\(/gi, name: 'Function 构造器' },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/gi, name: 'child_process 引入' },
  { pattern: /import.*from\s+['"]child_process['"]/gi, name: 'child_process 导入' },
];

/**
 * Prompt 注入模式
 */
const PROMPT_INJECTION_PATTERNS = [
  { pattern: /ignore\s+(previous|all)\s+(instructions?|prompts?)/gi, name: '忽略指令' },
  { pattern: /forget\s+(your|all)\s+(instructions?|prompts?)/gi, name: '忘记指令' },
  { pattern: /you\s+are\s+now\s+a?\s*(different|new|malicious)/gi, name: '身份切换' },
  { pattern: /system\s*:\s*you\s+are/gi, name: '系统伪装' },
  { pattern: /disregard\s+(all\s+)?(previous\s+)?(rules|instructions)/gi, name: '无视规则' },
  { pattern: /override\s+(previous\s+)?(instructions?|settings?)/gi, name: '覆盖指令' },
  { pattern: /<\|im_start\|>/gi, name: 'ChatML 注入' },
  { pattern: /\[SYSTEM\]/gi, name: '系统标签伪装' },
  { pattern: /###\s*instruction/gi, name: 'Alpaca 注入' },
];

/**
 * 敏感路径模式
 */
const SENSITIVE_PATH_PATTERNS = [
  /^~\/\.openclaw\//,
  /^\.env(\.|$)/,
  /credentials/i,
  /secret/i,
  /password/i,
  /private_key/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /\.ssh\//,
];

/**
 * SecurityAgent 实现
 */
export class SecurityAgent implements ISecurityAgent {
  private config: SecurityAuditConfig;

  constructor(config?: Partial<SecurityAuditConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 审查 Skill
   */
  async auditSkill(skillPath: string): Promise<AuditReport> {
    const checks: AuditCheck[] = [];
    let maxRiskLevel: RiskLevel = 'safe';

    // 读取 Skill 内容
    const content = await this.readSkillContent(skillPath);
    const yamlFrontMatter = this.parseYamlFrontMatter(content);

    // Layer 1: YAML 权限检查
    const layer1Check = this.checkYamlPermissions(yamlFrontMatter, content);
    checks.push(layer1Check);
    maxRiskLevel = this.updateRiskLevel(maxRiskLevel, layer1Check);

    // Layer 2: 危险命令检查
    if (this.config.checkDangerousCommands) {
      const layer2Check = this.checkDangerousCommands(content);
      checks.push(layer2Check);
      maxRiskLevel = this.updateRiskLevel(maxRiskLevel, layer2Check);
    }

    // Layer 3: 网络请求检查
    if (this.config.checkNetworkRequests) {
      const layer3Check = this.checkNetworkRequests(content, yamlFrontMatter);
      checks.push(layer3Check);
      maxRiskLevel = this.updateRiskLevel(maxRiskLevel, layer3Check);
    }

    // Layer 4: Prompt 注入检查
    if (this.config.checkPromptInjection) {
      const layer4Check = this.checkPromptInjection(content);
      checks.push(layer4Check);
      maxRiskLevel = this.updateRiskLevel(maxRiskLevel, layer4Check);
    }

    // Layer 5: 敏感文件访问检查
    if (this.config.checkSensitiveFileAccess) {
      const layer5Check = this.checkSensitiveFileAccess(content);
      checks.push(layer5Check);
      maxRiskLevel = this.updateRiskLevel(maxRiskLevel, layer5Check);
    }

    // 生成建议
    const recommendation = this.generateRecommendation(maxRiskLevel, checks);
    const passed = maxRiskLevel === 'safe' || maxRiskLevel === 'low';

    return {
      skill_name: path.basename(skillPath),
      passed,
      checks,
      risk_level: maxRiskLevel,
      recommendation,
    };
  }

  /**
   * 读取 Skill 内容
   */
  private async readSkillContent(skillPath: string): Promise<string> {
    try {
      const stat = fs.statSync(skillPath);
      if (stat.isDirectory()) {
        // 读取目录下的所有可扫描文件
        const files = this.findScannableFiles(skillPath);
        const contents: string[] = [];
        for (const file of files) {
          contents.push(await fs.promises.readFile(file, 'utf-8'));
        }
        return contents.join('\n\n--- FILE ---\n\n');
      } else {
        return fs.readFileSync(skillPath, 'utf-8');
      }
    } catch (error) {
      console.error(`[SecurityAgent] 读取文件失败: ${skillPath}`, error);
      return '';
    }
  }

  /**
   * 查找可扫描文件
   */
  private findScannableFiles(dirPath: string): string[] {
    const scannableExtensions = ['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '.md', '.json'];
    const files: string[] = [];

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && scannableExtensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };

    walk(dirPath);
    return files;
  }

  /**
   * 解析 YAML Front Matter
   */
  private parseYamlFrontMatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) {
      return {};
    }

    const yaml = match[1];
    const result: Record<string, unknown> = {};

    // 简单的 YAML 解析（只支持基本键值对）
    const lines = yaml.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Layer 1: YAML 权限检查
   */
  private checkYamlPermissions(yaml: Record<string, unknown>, content: string): AuditCheck {
    const findings: string[] = [];
    const declaredPermissions = yaml.permissions as string | undefined;

    // 检查声明的权限与实际功能是否匹配
    const needsNetwork = /fetch\s*\(|http\.request|axios|\.get\s*\(|\.post\s*\(/i.test(content);
    const needsShell = /exec\s*\(|spawn\s*\(|child_process/i.test(content);
    const needsFileAccess = /fs\.|readFile|writeFile|open\s*\(/i.test(content);

    if (needsNetwork && !declaredPermissions?.includes('network')) {
      findings.push('使用了网络请求但未声明 network 权限');
    }
    if (needsShell && !declaredPermissions?.includes('shell_exec')) {
      findings.push('使用了 Shell 执行但未声明 shell_exec 权限');
    }
    if (needsFileAccess && !declaredPermissions?.includes('file_rw')) {
      findings.push('使用了文件操作但未声明 file_rw 权限');
    }

    return {
      layer: 1,
      name: 'yaml_permissions',
      passed: findings.length === 0,
      findings,
    };
  }

  /**
   * Layer 2: 危险命令检查
   */
  private checkDangerousCommands(content: string): AuditCheck {
    const findings: string[] = [];

    for (const { pattern, name } of DANGEROUS_COMMAND_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        // 检查白名单
        const isWhitelisted = this.config.dangerousCommandWhitelist.some(
          wl => content.includes(wl)
        );
        if (!isWhitelisted) {
          findings.push(`检测到危险命令: ${name}`);
        }
      }
    }

    return {
      layer: 2,
      name: 'dangerous_commands',
      passed: findings.length === 0,
      findings,
    };
  }

  /**
   * Layer 3: 网络请求检查
   */
  private checkNetworkRequests(
    content: string,
    yaml: Record<string, unknown>
  ): AuditCheck {
    const findings: string[] = [];

    // 检测 fetch、axios、http.request 等
    const networkPatterns = [
      { pattern: /\bfetch\s*\(/gi, name: 'fetch' },
      { pattern: /\baxios\./gi, name: 'axios' },
      { pattern: /http\.request\s*\(/gi, name: 'http.request' },
      { pattern: /https\.request\s*\(/gi, name: 'https.request' },
      { pattern: /WebSocket\s*\(/gi, name: 'WebSocket' },
    ];

    const detectedNetworks: string[] = [];
    for (const { pattern, name } of networkPatterns) {
      if (pattern.test(content)) {
        detectedNetworks.push(name);
      }
    }

    // 检查是否有硬编码的外部 URL
    const urlPattern = /https?:\/\/[^\s"']+/gi;
    const urls = content.match(urlPattern) || [];
    const externalUrls = urls.filter(url => {
      const host = new URL(url).host;
      return !['localhost', '127.0.0.1', '::1'].includes(host);
    });

    if (detectedNetworks.length > 0) {
      const declaredNetwork = (yaml.permissions as string)?.includes('network');
      if (!declaredNetwork) {
        findings.push(`检测到网络请求 (${detectedNetworks.join(', ')}) 但未声明 network 权限`);
      }
    }

    if (externalUrls.length > 0) {
      findings.push(`检测到外部 URL: ${externalUrls.slice(0, 3).join(', ')}${externalUrls.length > 3 ? '...' : ''}`);
    }

    return {
      layer: 3,
      name: 'network_requests',
      passed: findings.length === 0,
      findings,
    };
  }

  /**
   * Layer 4: Prompt 注入检查
   */
  private checkPromptInjection(content: string): AuditCheck {
    const findings: string[] = [];

    for (const { pattern, name } of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        findings.push(`检测到可能的 Prompt 注入: ${name}`);
      }
    }

    return {
      layer: 4,
      name: 'prompt_injection',
      passed: findings.length === 0,
      findings,
    };
  }

  /**
   * Layer 5: 敏感文件访问检查
   */
  private checkSensitiveFileAccess(content: string): AuditCheck {
    const findings: string[] = [];

    for (const pattern of SENSITIVE_PATH_PATTERNS) {
      if (pattern.test(content)) {
        findings.push(`检测到敏感路径模式: ${pattern.source}`);
      }
    }

    // 检查环境变量访问
    if (/process\.env\s*\[|process\.env\.\w+/.test(content)) {
      findings.push('检测到环境变量访问');
    }

    return {
      layer: 5,
      name: 'sensitive_file_access',
      passed: findings.length === 0,
      findings,
    };
  }

  /**
   * 更新风险等级
   */
  private updateRiskLevel(current: RiskLevel, check: AuditCheck): RiskLevel {
    if (check.passed) {
      return current;
    }

    const riskOrder: RiskLevel[] = ['safe', 'low', 'medium', 'high', 'critical'];

    // 根据检查层级和发现数量确定风险
    let newRisk: RiskLevel = 'low';

    if (check.name === 'prompt_injection' || check.name === 'dangerous_commands') {
      // Prompt 注入和危险命令风险最高
      newRisk = check.findings.length > 1 ? 'critical' : 'high';
    } else if (check.name === 'sensitive_file_access') {
      newRisk = check.findings.length > 1 ? 'high' : 'medium';
    } else if (check.name === 'network_requests') {
      newRisk = 'medium';
    } else if (check.name === 'yaml_permissions') {
      newRisk = 'low';
    }

    const currentIndex = riskOrder.indexOf(current);
    const newIndex = riskOrder.indexOf(newRisk);

    return newIndex > currentIndex ? newRisk : current;
  }

  /**
   * 生成建议
   */
  private generateRecommendation(riskLevel: RiskLevel, checks: AuditCheck[]): string {
    const failedChecks = checks.filter(c => !c.passed);

    if (failedChecks.length === 0) {
      return '该 Skill 通过所有安全检查，可以安全使用。';
    }

    const recommendations: string[] = [];

    switch (riskLevel) {
      case 'critical':
        recommendations.push('⚠️ 警告: 该 Skill 存在严重安全风险，强烈不建议使用！');
        break;
      case 'high':
        recommendations.push('⚠️ 注意: 该 Skill 存在较高安全风险，建议谨慎评估后使用。');
        break;
      case 'medium':
        recommendations.push('提示: 该 Skill 存在一定安全风险，建议审核后使用。');
        break;
      case 'low':
        recommendations.push('提示: 该 Skill 存在轻微安全问题，建议检查后使用。');
        break;
      default:
        recommendations.push('该 Skill 通过安全检查。');
    }

    for (const check of failedChecks) {
      recommendations.push(`- ${check.name}: ${check.findings.join('; ')}`);
    }

    return recommendations.join('\n');
  }
}

/**
 * 创建 SecurityAgent 实例
 */
export function createSecurityAgent(config?: Partial<SecurityAuditConfig>): ISecurityAgent {
  return new SecurityAgent(config);
}

export default SecurityAgent;
