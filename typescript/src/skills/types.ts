/**
 * 技能系统类型定义
 * 
 * 技能（Skill）是预定义的工作流程，可以自动执行一系列操作。
 * 例如：remember 技能可以帮助 AI 记住重要信息，verify 技能可以验证代码质量。
 */

/**
 * 技能接口
 */
export interface Skill {
  name: string;
  displayName: string;
  description: string;
  category: SkillCategory;
  prompt: string;
  examples?: string[];
  tags?: string[];
}

/**
 * 技能分类
 */
export type SkillCategory = 
  | 'memory'      // 记忆管理
  | 'code'        // 代码相关
  | 'analysis'    // 分析相关
  | 'workflow'    // 工作流
  | 'custom';     // 自定义

/**
 * 技能执行上下文
 */
export interface SkillContext {
  userInput?: string;
  workspaceDir: string;
  currentFiles?: string[];
}

/**
 * 技能执行结果
 */
export interface SkillResult {
  success: boolean;
  message: string;
  data?: any;
}
