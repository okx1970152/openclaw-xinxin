/**
 * 超级大龙虾 (Super Lobster) - 安全配置模块
 * 
 * 提供以下安全加固功能：
 * 1. 强制 Token 生成（禁止空密码运行）
 * 2. Origin 校验增强
 * 3. 本地绑定（默认 127.0.0.1）
 * 
 * @module security/gateway-security
 */

import * as crypto from 'crypto';

/**
 * 安全配置
 */
export interface GatewaySecurityConfig {
  /** 是否强制生成 Token */
  forceTokenGeneration: boolean;
  /** 是否绑定本地 */
  bindLocalhost: boolean;
  /** 允许的 Origin 白名单 */
  allowedOrigins: string[];
  /** 生成的 Token 长度 */
  tokenLength: number;
}

/**
 * 默认安全配置
 */
export const DEFAULT_SECURITY_CONFIG: GatewaySecurityConfig = {
  forceTokenGeneration: true,
  bindLocalhost: true,
  allowedOrigins: ['http://localhost:*', 'http://127.0.0.1:*'],
  tokenLength: 32,
};

/**
 * 安全配置管理器
 */
export class GatewaySecurityManager {
  private config: GatewaySecurityConfig;
  private generatedToken: string | null = null;

  constructor(config: Partial<GatewaySecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * 生成强随机 Token
   */
  generateToken(length: number = this.config.tokenLength): string {
    const bytes = crypto.randomBytes(Math.ceil(length / 2));
    return bytes.toString('hex').substring(0, length);
  }

  /**
   * 获取或生成 Token
   * 
   * 如果配置了 forceTokenGeneration 且没有现成 Token，则自动生成
   */
  getOrGenerateToken(existingToken?: string): string {
    if (existingToken && existingToken.trim()) {
      return existingToken.trim();
    }

    if (this.config.forceTokenGeneration) {
      if (!this.generatedToken) {
        this.generatedToken = this.generateToken();
        console.log(`[Security] 自动生成 Token: ${this.generatedToken.substring(0, 8)}...`);
      }
      return this.generatedToken;
    }

    throw new Error(
      '未配置 Token 且禁用了自动生成。请设置 OPENCLAW_GATEWAY_TOKEN 环境变量或启用 forceTokenGeneration'
    );
  }

  /**
   * 检查 Origin 是否允许
   */
  isOriginAllowed(origin: string): boolean {
    if (!origin || origin === 'null') {
      // 允许非浏览器请求（无 Origin）
      return true;
    }

    const allowed = this.config.allowedOrigins;
    if (allowed.includes('*')) {
      return true;
    }

    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.host.toLowerCase();
      const originProtocol = originUrl.protocol;

      for (const pattern of allowed) {
        if (pattern.includes('*')) {
          // 支持通配符匹配
          const regex = new RegExp(
            '^' + pattern
              .replace(/\*/g, '.*')
              .replace(/\./g, '\\.')
              .replace(/:/g, '\\:') + '$'
          );
          if (regex.test(origin)) {
            return true;
          }
        } else {
          // 精确匹配
          if (origin === pattern) {
            return true;
          }
        }
      }

      // 检查是否是本地回环地址
      if (this.config.bindLocalhost) {
        const localhosts = ['localhost', '127.0.0.1', '::1'];
        if (localhosts.includes(originUrl.hostname)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 获取绑定地址
   */
  getBindAddress(): string {
    return this.config.bindLocalhost ? '127.0.0.1' : '0.0.0.0';
  }

  /**
   * 获取安全配置
   */
  getConfig(): GatewaySecurityConfig {
    return { ...this.config };
  }

  /**
   * 验证安全配置
   */
  validate(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.config.forceTokenGeneration && this.config.allowedOrigins.includes('*')) {
      issues.push('禁用 Token 自动生成时，不允许 Origin 白名单为 "*"');
    }

    if (!this.config.bindLocalhost && this.config.allowedOrigins.length === 0) {
      issues.push('绑定公网地址时，必须配置 Origin 白名单');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

/**
 * 创建安全配置实例
 */
export function createSecurityManager(config?: Partial<GatewaySecurityConfig>): GatewaySecurityManager {
  return new GatewaySecurityManager(config);
}

/**
 * 快速生成 Token（便捷函数）
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').substring(0, length);
}

export default GatewaySecurityManager;
