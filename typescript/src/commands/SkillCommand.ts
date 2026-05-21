/**
 * Skill 命令处理器
 * 
 * 功能：管理和使用技能系统
 * 
 * 使用场景：
 * - /skill - 查看所有可用技能
 * - /skill <name> - 使用指定技能
 * - /skill search <query> - 搜索技能
 * 
 * 教学要点：
 * 1. 技能系统：预定义的工作流程，提高效率
 * 2. 命令路由：根据参数执行不同操作
 * 3. 用户体验：清晰的帮助信息和错误提示
 */

import { SkillManager } from '../skills/SkillManager';
import { Skill } from '../skills/types';
import chalk from 'chalk';

/**
 * 显示所有可用技能
 */
export function showSkillList(): string {
  const skillManager = SkillManager.getInstance();
  const allSkills = skillManager.getAllSkills();
  const stats = skillManager.getStats();

  let output = chalk.cyan.bold('\n🎯 技能系统\n\n');
  
  output += chalk.yellow(`共有 ${stats.total} 个技能可用\n\n`);

  // 按分类显示技能
  const categories = {
    memory: '📝 记忆管理',
    code: '💻 代码相关',
    analysis: '🔍 分析相关',
    workflow: '⚙️  工作流',
    custom: '🎨 自定义',
  };

  for (const [category, label] of Object.entries(categories)) {
    const skills = skillManager.getSkillsByCategory(category as any);
    
    if (skills.length > 0) {
      output += chalk.cyan(`${label}\n`);
      
      skills.forEach(skill => {
        output += `  • ${chalk.green(skill.name)} - ${skill.displayName}\n`;
        output += `    ${chalk.gray(skill.description)}\n`;
        
        if (skill.examples && skill.examples.length > 0) {
          output += `    ${chalk.gray('示例: ' + skill.examples[0])}\n`;
        }
        output += '\n';
      });
    }
  }

  output += chalk.gray('使用方法：\n');
  output += chalk.gray('  /skill <name>           - 使用指定技能\n');
  output += chalk.gray('  /skill search <query>   - 搜索技能\n');
  output += chalk.gray('  /skill                  - 显示此列表\n');

  return output;
}

/**
 * 搜索技能
 */
export function searchSkills(query: string): string {
  const skillManager = SkillManager.getInstance();
  const results = skillManager.searchSkills(query);

  let output = chalk.cyan.bold(`\n🔍 搜索结果: "${query}"\n\n`);

  if (results.length === 0) {
    output += chalk.yellow('未找到匹配的技能\n');
    return output;
  }

  output += chalk.green(`找到 ${results.length} 个技能：\n\n`);

  results.forEach(skill => {
    output += `• ${chalk.cyan(skill.name)} - ${skill.displayName}\n`;
    output += `  ${chalk.gray(skill.description)}\n`;
    
    if (skill.tags && skill.tags.length > 0) {
      output += `  ${chalk.gray('标签: ' + skill.tags.join(', '))}\n`;
    }
    output += '\n';
  });

  return output;
}

/**
 * 使用技能
 */
export function useSkill(skillName: string): { success: boolean; message: string; prompt?: string } {
  const skillManager = SkillManager.getInstance();
  const skill = skillManager.getSkill(skillName);

  if (!skill) {
    return {
      success: false,
      message: chalk.red(`❌ 未找到技能: ${skillName}\n`) +
               chalk.gray('使用 /skill 查看所有可用技能'),
    };
  }

  const message = chalk.green(`✓ 已激活技能: ${skill.displayName}\n\n`) +
                  chalk.cyan('技能说明：\n') +
                  chalk.gray(skill.description) + '\n\n' +
                  chalk.cyan('AI 将按照以下指引工作：\n') +
                  chalk.gray('(技能提示词已注入到对话上下文中)');

  return {
    success: true,
    message,
    prompt: skill.prompt,
  };
}

/**
 * 解析 skill 命令参数
 */
export function parseSkillCommand(args: string[]): {
  action: 'list' | 'search' | 'use';
  skillName?: string;
  query?: string;
} {
  if (args.length === 0) {
    return { action: 'list' };
  }

  const firstArg = args[0].toLowerCase();

  if (firstArg === 'search') {
    return {
      action: 'search',
      query: args.slice(1).join(' '),
    };
  }

  return {
    action: 'use',
    skillName: firstArg,
  };
}
