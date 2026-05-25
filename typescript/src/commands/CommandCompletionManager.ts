/**
 * 命令补全管理器
 * 
 * 功能：管理所有可用的命令和技能，提供自动补全建议
 * 
 * 使用场景：
 * - 用户输入 / 时显示所有可用命令
 * - 用户输入 /skill 时显示所有技能
 * - 支持模糊搜索和过滤
 */

import { SkillManager } from '../skills/SkillManager';
import * as fs from 'fs';
import * as path from 'path';

export interface CommandSuggestion {
  command: string;
  description: string;
  category: 'skill' | 'system' | 'custom';
  fullCommand?: string;
}

export class CommandCompletionManager {
  private static instance: CommandCompletionManager;
  private systemCommands: CommandSuggestion[] = [];
  private customSkills: CommandSuggestion[] = [];

  private constructor() {
    this.initializeSystemCommands();
    this.loadCustomSkills();
  }

  public static getInstance(): CommandCompletionManager {
    if (!CommandCompletionManager.instance) {
      CommandCompletionManager.instance = new CommandCompletionManager();
    }
    return CommandCompletionManager.instance;
  }

  /**
   * 初始化系统命令
   */
  private initializeSystemCommands(): void {
    this.systemCommands = [
      {
        command: '/help',
        description: '显示帮助信息',
        category: 'system',
      },
      {
        command: '/clear',
        description: '清空对话历史',
        category: 'system',
      },
      {
        command: '/provider',
        description: '查看或切换 AI Provider',
        category: 'system',
      },
      {
        command: '/skill',
        description: '查看所有可用技能',
        category: 'system',
      },
      {
        command: '/permissions',
        description: '查看权限状态',
        category: 'system',
      },
      {
        command: '/allow',
        description: '授权工具执行权限',
        category: 'system',
      },
      {
        command: '/deny',
        description: '禁止工具执行',
        category: 'system',
      },
      {
        command: '/buddy',
        description: '召唤数字伙伴',
        category: 'system',
      },
      {
        command: '/voice',
        description: '启动语音模式',
        category: 'system',
      },
    ];
  }

  /**
   * 加载自定义技能（从 Cursor skills 目录）
   */
  private loadCustomSkills(): void {
    const cursorSkillsDir = path.join(process.env.HOME || '', '.cursor', 'skills-cursor');
    
    if (!fs.existsSync(cursorSkillsDir)) {
      return;
    }

    try {
      const entries = fs.readdirSync(cursorSkillsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(cursorSkillsDir, entry.name, 'SKILL.md');
          
          if (fs.existsSync(skillPath)) {
            try {
              const content = fs.readFileSync(skillPath, 'utf-8');
              const metadata = this.parseSkillMetadata(content);
              
              if (metadata.name && metadata.description) {
                this.customSkills.push({
                  command: `/skill ${metadata.name}`,
                  description: metadata.description,
                  category: 'custom',
                  fullCommand: `/skill ${metadata.name}`,
                });
              }
            } catch (error) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      // 忽略读取错误
    }
  }

  /**
   * 解析 SKILL.md 的元数据
   */
  private parseSkillMetadata(content: string): { name?: string; description?: string } {
    const metadata: { name?: string; description?: string } = {};
    
    // 解析 YAML frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      
      const nameMatch = frontmatter.match(/name:\s*(.+)/);
      if (nameMatch) {
        metadata.name = nameMatch[1].trim();
      }
      
      const descMatch = frontmatter.match(/description:\s*>?-?\s*\n?\s*(.+?)(?=\n\w+:|$)/s);
      if (descMatch) {
        metadata.description = descMatch[1].trim().replace(/\n\s*/g, ' ');
      }
    }
    
    return metadata;
  }

  /**
   * 获取所有建议
   */
  public getAllSuggestions(input: string = ''): CommandSuggestion[] {
    const trimmedInput = input.trim().toLowerCase();
    
    // 获取内置技能
    const skillManager = SkillManager.getInstance();
    const builtInSkills = skillManager.getAllSkills().map(skill => ({
      command: `/skill ${skill.name}`,
      description: skill.description,
      category: 'skill' as const,
      fullCommand: `/skill ${skill.name}`,
    }));

    // 合并所有命令
    const allSuggestions = [
      ...this.systemCommands,
      ...builtInSkills,
      ...this.customSkills,
    ];

    // 如果没有输入或只输入了 /，返回所有命令
    if (!trimmedInput || trimmedInput === '/') {
      return allSuggestions;
    }

    // 过滤匹配的命令
    return allSuggestions.filter(suggestion => {
      const commandLower = suggestion.command.toLowerCase();
      const descLower = suggestion.description.toLowerCase();
      
      return commandLower.includes(trimmedInput) || descLower.includes(trimmedInput);
    });
  }

  /**
   * 获取技能建议
   */
  public getSkillSuggestions(query: string = ''): CommandSuggestion[] {
    const skillManager = SkillManager.getInstance();
    const skills = query 
      ? skillManager.searchSkills(query)
      : skillManager.getAllSkills();

    return skills.map(skill => ({
      command: `/skill ${skill.name}`,
      description: skill.description,
      category: 'skill' as const,
      fullCommand: `/skill ${skill.name}`,
    }));
  }

  /**
   * 刷新自定义技能列表
   */
  public refresh(): void {
    this.customSkills = [];
    this.loadCustomSkills();
  }
}
