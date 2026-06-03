/**
 * 技能管理器
 * 
 * 负责加载、注册和执行技能
 * 
 * 要点：
 * 1. 单例模式：确保全局只有一个技能管理器实例
 * 2. 插件架构：技能可以动态加载和注册
 * 3. 分类管理：按类别组织技能，便于查找
 */

import { Skill, SkillCategory } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class SkillManager {
  private static instance: SkillManager;
  private skills: Map<string, Skill> = new Map();
  private skillsByCategory: Map<SkillCategory, Skill[]> = new Map();

  private constructor() {
    this.initializeCategories();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SkillManager {
    if (!SkillManager.instance) {
      SkillManager.instance = new SkillManager();
    }
    return SkillManager.instance;
  }

  /**
   * 初始化分类
   */
  private initializeCategories(): void {
    const categories: SkillCategory[] = ['memory', 'code', 'analysis', 'workflow', 'custom'];
    categories.forEach(category => {
      this.skillsByCategory.set(category, []);
    });
  }

  /**
   * 注册技能
   */
  public registerSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
    
    const categorySkills = this.skillsByCategory.get(skill.category) || [];
    categorySkills.push(skill);
    this.skillsByCategory.set(skill.category, categorySkills);
    
    console.log(`[SkillManager] 注册技能: ${skill.name} (${skill.category})`);
  }

  /**
   * 获取技能
   */
  public getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * 获取所有技能
   */
  public getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 按分类获取技能
   */
  public getSkillsByCategory(category: SkillCategory): Skill[] {
    return this.skillsByCategory.get(category) || [];
  }

  /**
   * 搜索技能
   */
  public searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSkills().filter(skill => 
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.displayName.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery) ||
      skill.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 加载内置技能
   */
  public loadBuiltInSkills(): void {
    const builtInSkillsPath = path.join(__dirname, 'built-in');
    
    if (!fs.existsSync(builtInSkillsPath)) {
      console.warn(`[SkillManager] 内置技能目录不存在: ${builtInSkillsPath}`);
      return;
    }

    const files = fs.readdirSync(builtInSkillsPath);
    
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        try {
          const skillModule = require(path.join(builtInSkillsPath, file));
          if (skillModule.default && typeof skillModule.default === 'object') {
            this.registerSkill(skillModule.default);
          }
        } catch (error: any) {
          console.error(`[SkillManager] 加载技能失败 ${file}:`, error.message);
        }
      }
    }
  }

  /**
   * 加载用户自定义技能
   */
  public loadUserSkills(skillsDir: string): void {
    if (!fs.existsSync(skillsDir)) {
      return;
    }

    const files = fs.readdirSync(skillsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const skillPath = path.join(skillsDir, file);
          const skillData = JSON.parse(fs.readFileSync(skillPath, 'utf-8'));
          
          if (this.validateSkill(skillData)) {
            this.registerSkill(skillData);
          }
        } catch (error: any) {
          console.error(`[SkillManager] 加载用户技能失败 ${file}:`, error.message);
        }
      }
    }
  }

  /**
   * 验证技能数据
   */
  private validateSkill(data: any): boolean {
    return (
      typeof data.name === 'string' &&
      typeof data.displayName === 'string' &&
      typeof data.description === 'string' &&
      typeof data.category === 'string' &&
      typeof data.prompt === 'string'
    );
  }

  /**
   * 获取技能统计
   */
  public getStats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    
    this.skillsByCategory.forEach((skills, category) => {
      byCategory[category] = skills.length;
    });

    return {
      total: this.skills.size,
      byCategory,
    };
  }
}
