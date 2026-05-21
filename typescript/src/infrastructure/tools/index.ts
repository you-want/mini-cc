export { bashTool } from './BashTool';
export { fileReadTool } from './FileReadTool';
export { fileWriteTool } from './FileWriteTool';
export { gitStatusTool } from './GitStatusTool';
export { agentTool } from './AgentTool';
export { globTool } from './GlobTool';
export { grepTool } from './GrepTool';
export { fileEditTool } from './FileEditTool';
export { webFetchTool } from './WebFetchTool';
export { todoWriteTool } from './TodoWriteTool';
export { taskCreateTool } from './TaskCreateTool';
export { taskListTool } from './TaskListTool';
export { webSearchTool } from './WebSearchTool';
export { lspTool } from './LSPTool';
export { notebookEditTool } from './NotebookEditTool';

import type { Tool } from './Tool';
import { bashTool } from './BashTool';
import { fileReadTool } from './FileReadTool';
import { fileWriteTool } from './FileWriteTool';
import { gitStatusTool } from './GitStatusTool';
import { agentTool } from './AgentTool';
import { globTool } from './GlobTool';
import { grepTool } from './GrepTool';
import { fileEditTool } from './FileEditTool';
import { webFetchTool } from './WebFetchTool';
import { todoWriteTool } from './TodoWriteTool';
import { taskCreateTool } from './TaskCreateTool';
import { taskListTool } from './TaskListTool';
import { webSearchTool } from './WebSearchTool';
import { lspTool } from './LSPTool';
import { notebookEditTool } from './NotebookEditTool';

/**
 * 所有注册在 Agent 中的工具实例。
 * 
 * 工具分类：
 * - 文件操作：fileReadTool, fileWriteTool, fileEditTool
 * - 文件搜索：globTool, grepTool
 * - 系统操作：bashTool, gitStatusTool
 * - 网络请求：webFetchTool, webSearchTool
 * - 任务管理：todoWriteTool, taskCreateTool, taskListTool
 * - 代码智能：lspTool
 * - Notebook：notebookEditTool
 * - 高级功能：agentTool (Agent 分身术)
 */
export const tools: Tool<any, any>[] = [
  // 基础工具
  bashTool,
  fileReadTool,
  fileWriteTool,
  gitStatusTool,
  
  // 核心工具（阶段一）
  globTool,
  grepTool,
  fileEditTool,
  webFetchTool,
  
  // 新增工具（阶段二）
  todoWriteTool,
  taskCreateTool,
  taskListTool,
  webSearchTool,
  lspTool,
  notebookEditTool,
  
  // 高级工具
  agentTool,
];

export function registerTool(tool: Tool<any, any>): void {
  tools.push(tool);
}

export function registerTools(newTools: Tool<any, any>[]): void {
  tools.push(...newTools);
}
