export { bashTool } from './BashTool';
export { fileReadTool } from './FileReadTool';
export { fileWriteTool } from './FileWriteTool';
export { gitStatusTool } from './GitStatusTool';
export { agentTool } from './AgentTool';
export { globTool } from './GlobTool';
export { grepTool } from './GrepTool';
export { fileEditTool } from './FileEditTool';
export { webFetchTool } from './WebFetchTool';

import { bashTool } from './BashTool';
import { fileReadTool } from './FileReadTool';
import { fileWriteTool } from './FileWriteTool';
import { gitStatusTool } from './GitStatusTool';
import { agentTool } from './AgentTool';
import { globTool } from './GlobTool';
import { grepTool } from './GrepTool';
import { fileEditTool } from './FileEditTool';
import { webFetchTool } from './WebFetchTool';

/**
 * 所有注册在 Agent 中的工具实例。
 * 
 * 工具分类：
 * - 文件操作：fileReadTool, fileWriteTool, fileEditTool
 * - 文件搜索：globTool, grepTool
 * - 系统操作：bashTool, gitStatusTool
 * - 网络请求：webFetchTool
 * - 高级功能：agentTool (Agent 分身术)
 */
export const tools = [
  // 基础工具
  bashTool,
  fileReadTool,
  fileWriteTool,
  gitStatusTool,
  
  // 新增核心工具（阶段一）
  globTool,
  grepTool,
  fileEditTool,
  webFetchTool,
  
  // 高级工具
  agentTool,
];
