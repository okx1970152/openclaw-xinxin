/**
 * 超级大龙虾 - 公共工具函数
 * Shared Utilities
 * 
 * 存放于 src/shared/keywords.ts
 * #23 修复：提取公共关键词提取函数
 */

/**
 * 从文本中提取关键词
 * 
 * @param text 输入文本
 * @param maxCount 最大关键词数量，默认 5
 * @returns 关键词数组
 */
export function extractKeywords(text: string, maxCount: number = 5): string[] {
  const keywords: string[] = [];
  
  // 中文词汇（双字及以上）
  const chinesePhrases = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  keywords.push(...chinesePhrases);
  
  // 英文单词（3字符及以上，支持驼峰和下划线）
  const englishWords = text.match(/[a-zA-Z_]\w{2,}/g) || [];
  keywords.push(...englishWords.map(w => w.toLowerCase()));
  
  // 去重并限制数量
  return [...new Set(keywords)].slice(0, maxCount);
}

/**
 * 计算关键词匹配分数
 * 
 * @param inputKeywords 输入关键词
 * @param targetKeywords 目标关键词
 * @returns 匹配分数 (0-1)
 */
export function calculateKeywordMatchScore(
  inputKeywords: string[],
  targetKeywords: string[]
): number {
  if (inputKeywords.length === 0 || targetKeywords.length === 0) {
    return 0;
  }
  
  const inputLower = inputKeywords.map(k => k.toLowerCase());
  const targetLower = targetKeywords.map(k => k.toLowerCase());
  
  let matchCount = 0;
  for (const ik of inputLower) {
    if (targetLower.some(tk => tk.includes(ik) || ik.includes(tk))) {
      matchCount++;
    }
  }
  
  return matchCount / inputKeywords.length;
}

/**
 * 从关键词数组中选择最佳匹配
 * 
 * @param inputKeywords 输入关键词
 * @param candidates 候选项数组
 * @param getKeywords 从候选项获取关键词的函数
 * @returns 最佳匹配项，无匹配返回 null
 */
export function selectBestMatch<T>(
  inputKeywords: string[],
  candidates: T[],
  getKeywords: (candidate: T) => string[]
): T | null {
  let bestMatch: T | null = null;
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const score = calculateKeywordMatchScore(inputKeywords, getKeywords(candidate));
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

export default {
  extractKeywords,
  calculateKeywordMatchScore,
  selectBestMatch,
};
