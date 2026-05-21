/**
 * Remember 技能
 * 
 * 功能：帮助 AI 记住重要信息，存储到 .ai_memory 文件中
 * 
 * 使用场景：
 * - 记住项目的架构决策
 * - 记住用户的偏好设置
 * - 记住重要的约定和规范
 * 
 * 教学要点：
 * 1. 记忆管理：AI 需要长期记忆来保持上下文
 * 2. 文件持久化：将记忆存储到文件系统
 * 3. 结构化存储：使用 JSON 格式便于读取和更新
 */

import { Skill } from '../types';

export default {
  name: 'remember',
  displayName: '记忆管理',
  description: '帮助 AI 记住重要信息，存储到项目的 .ai_memory 文件中',
  category: 'memory',
  prompt: `你是一个记忆管理助手。当用户要求你记住某些信息时，你需要：

1. 理解用户想要记住的内容
2. 将信息结构化存储到 .ai_memory/memory.json 文件中
3. 使用清晰的分类（如：architecture, preferences, conventions, decisions）
4. 为每条记忆添加时间戳和描述

记忆格式示例：
{
  "architecture": [
    {
      "timestamp": "2026-05-21",
      "content": "项目使用 TypeScript + React 架构",
      "tags": ["tech-stack", "architecture"]
    }
  ],
  "preferences": [
    {
      "timestamp": "2026-05-21",
      "content": "用户偏好使用函数式组件而非类组件",
      "tags": ["coding-style", "react"]
    }
  ]
}

请使用 FileWriteTool 或 FileEditTool 来更新记忆文件。`,
  examples: [
    '请记住：我们的项目使用 TypeScript 和 React',
    '记住我喜欢使用函数式编程风格',
    '请记录：API 基础 URL 是 https://api.example.com',
  ],
  tags: ['memory', 'persistence', 'context'],
} as Skill;
