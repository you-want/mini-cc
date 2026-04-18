export { BashTool } from './BashTool';
export { FileReadTool } from './FileReadTool';
export { FileWriteTool } from './FileWriteTool';

/**
 * 所有注册在 Agent 中的工具实例。
 * 扩展时可以在此注册更多工具，例如 GitTool、GlobTool 等。
 */
export const tools = [
  new (require('./BashTool').BashTool)(),
  new (require('./FileReadTool').FileReadTool)(),
  new (require('./FileWriteTool').FileWriteTool)()
];
