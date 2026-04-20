export { bashTool } from './BashTool';
export { fileReadTool } from './FileReadTool';
export { fileWriteTool } from './FileWriteTool';
export { gitStatusTool } from './GitStatusTool';
export { agentTool } from './AgentTool';

import { bashTool } from './BashTool';
import { fileReadTool } from './FileReadTool';
import { fileWriteTool } from './FileWriteTool';
import { gitStatusTool } from './GitStatusTool';
import { agentTool } from './AgentTool';

/**
 * 所有注册在 Agent 中的工具实例。
 * 扩展时可以在此注册更多工具，例如 GitTool、GlobTool 等。
 */
export const tools = [
  bashTool,
  fileReadTool,
  fileWriteTool,
  gitStatusTool,
  agentTool
];
