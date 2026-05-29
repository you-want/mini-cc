/**
 * Remember 技能 - 记忆管理
 * 
 * 功能：帮助 AI 记住重要信息，存储到 .ai_memory 文件中
 * 
 * 使用场景：
 * - 记住项目的架构决策
 * - 记住用户的偏好设置
 * - 记住重要的约定和规范
 */

import { createMemoryManager } from '../../memdir/MemoryManager';

export interface RememberSkillConfig {
  name: string;
  displayName: string;
  description: string;
  category: string;
  prompt: string;
  examples: string[];
  tags: string[];
}

/**
 * Remember 技能配置
 */
const rememberSkillConfig: RememberSkillConfig = {
  name: 'remember',
  displayName: '记忆管理',
  description: '帮助 AI 记住重要信息，存储到项目的 .ai_memory 文件中',
  category: 'memory',
  prompt: `你是一个记忆管理助手。当用户要求你记住某些信息时，你需要：

1. 理解用户想要记住的内容
2. 将信息结构化存储到 .ai_memory 目录中
3. 使用清晰的分类（如：architecture, preferences, conventions, decisions）
4. 为每条记忆添加时间戳和描述

记忆存储方式：
- 使用两步走法则：详细内容写入独立的 .md 文件
- 在 MEMORY.md 索引文件中添加指向该文件的单行链接描述
- 每个记忆文件可以包含 frontmatter 元数据（type, description 等）

记忆文件格式示例：
---
type: architecture
description: 项目技术栈说明
---

# 技术栈

项目使用 TypeScript + React 架构，采用函数式编程风格。

## 主要依赖
- React 18
- TypeScript 5
- Vite

请使用 FileWriteTool 或 FileEditTool 来创建和更新记忆文件。`,
  examples: [
    '请记住：我们的项目使用 TypeScript 和 React',
    '记住我喜欢使用函数式编程风格',
    '请记录：API 基础 URL 是 https://api.example.com',
  ],
  tags: ['memory', 'persistence', 'context'],
};

export const rememberSkill = rememberSkillConfig;

export default rememberSkillConfig;

/**
 * 执行 Remember 技能
 * 
 * @param args 用户输入的参数
 * @param workspaceDir 工作区目录
 */
export async function executeRememberSkill(
  args: string,
  workspaceDir: string = process.cwd()
): Promise<string> {
  const memoryManager = createMemoryManager(workspaceDir);
  
  // 解析用户输入，提取主题和详情
  const { topic, details, summary } = parseRememberInput(args);
  
  // 保存记忆
  memoryManager.saveMemory(topic, details, summary);
  
  return `✅ 已记住：${topic}\n\n${summary}`;
}

/**
 * 解析用户的记忆输入
 */
function parseRememberInput(input: string): {
  topic: string;
  details: string;
  summary: string;
} {
  // 简单的解析逻辑
  // 实际应用中可以使用更复杂的 NLP 技术
  
  const lines = input.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return {
      topic: 'general',
      details: input,
      summary: input.slice(0, 100),
    };
  }
  
  // 第一行作为主题
  const topic = lines[0].replace(/^(记住|请记住|记录|请记录)[：:]\s*/, '').trim();
  
  // 所有内容作为详情
  const details = input;
  
  // 生成摘要（取前100个字符）
  const summary = input.replace(/\n/g, ' ').slice(0, 100);
  
  return { topic, details, summary };
}

/**
 * 获取 Remember 技能的提示词
 */
export function getRememberSkillPrompt(additionalContext?: string): string {
  let prompt = rememberSkill.prompt;
  
  if (additionalContext) {
    prompt += `\n\n## 额外上下文\n\n${additionalContext}`;
  }
  
  return prompt;
}
