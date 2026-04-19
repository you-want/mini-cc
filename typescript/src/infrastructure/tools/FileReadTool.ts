import * as fs from 'fs/promises';
import { Tool, ToolUseContext } from './Tool';
import * as path from 'path';

/**
 * 文件读取工具 (实现 Tool 接口)
 * 允许大模型读取本地文件的内容。
 */
export const fileReadTool: Tool<{ file_path: string }, string> = {
  name: 'FileReadTool',
  description: `
    读取本地系统上的文件内容。
    用于获取代码文件、配置文件或者日志。
    注意：
    - 请提供需要读取的文件的绝对路径，不要使用相对路径。
    - 如果遇到过大文件（如日志），该工具只会返回前 1000 行。
  `,
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '需要读取文件的绝对路径',
      },
    },
    required: ['file_path'],
  },
  execute: async (args: { file_path: string }, context: ToolUseContext): Promise<string> => {
    try {
      let { file_path } = args;
      if (!file_path) {
        return `读取文件时出错：file_path 不能为空`;
      }
      
      // 如果路径是相对路径，使用上下文中的 workspaceDir 解析为绝对路径
      if (!path.isAbsolute(file_path)) {
        file_path = path.resolve(context.workspaceDir, file_path);
      }
      
      console.log(`[FileReadTool] 正在读取文件: ${file_path}`);
      
      const content = await fs.readFile(file_path, 'utf-8');

      // 内容截断策略：防止读取过大文件撑爆大模型的 Context Window
      const lines = content.split('\n');
      if (lines.length > 1000) {
        console.warn(`[FileReadTool] 文件 ${file_path} 行数超过 1000 行，将进行截断`);
        return lines.slice(0, 1000).join('\n') + '\n\n... (文件已截断，仅显示前 1000 行)';
      }
      
      return content;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return `错误：文件未找到。路径：${args.file_path}`;
      }
      return `读取文件时出错：${error.message}`;
    }
  }
};
