import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolUseContext } from './Tool';

/**
 * 文件写入工具 (实现 Tool 接口)
 * 允许大模型创建或覆盖本地文件。
 */
export const fileWriteTool: Tool<{ file_path: string; content: string }, string> = {
  name: 'FileWriteTool',
  description: `
    将内容写入到指定文件。
    注意：
    - 此操作会完全覆盖目标文件。如果要修改现有文件，请确保你已经读取了它，并在调用此工具时提供完整的更新后内容。
    - 如果目录不存在，系统会自动为你递归创建所需的父目录，因此你完全不需要提前调用 BashTool 执行 mkdir 命令。
    - 始终使用绝对路径。
  `,
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '目标文件的绝对路径',
      },
      content: {
        type: 'string',
        description: '要写入的完整文件内容',
      },
    },
    required: ['file_path', 'content'],
  },
  execute: async (args: { file_path: string; content: string }, context: ToolUseContext): Promise<string> => {
    try {
      let { file_path, content } = args;
      if (!file_path) {
        return `写入文件时出错：file_path 不能为空`;
      }
      
      // 如果路径是相对路径，使用上下文中的 workspaceDir 解析为绝对路径
      if (!path.isAbsolute(file_path)) {
        file_path = path.resolve(context.workspaceDir, file_path);
      }

      console.log(`[FileWriteTool] 正在写入文件: ${file_path}`);
      
      // 提取文件所在的目录路径
      const dir = path.dirname(file_path);

      // 递归创建父级目录 (mkdir -p)，防止写入由于目录不存在而失败
      await fs.mkdir(dir, { recursive: true });
      
      // 执行文件覆盖写入
      await fs.writeFile(file_path, content, 'utf-8');
      
      return `文件写入成功：${file_path}`;
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return `写入文件时出错：权限不足，无法写入文件 ${args.file_path}。错误信息: ${error.message}`;
      }
      return `写入文件时出错：${error.message}`;
    }
  }
};
