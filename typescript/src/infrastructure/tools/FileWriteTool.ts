import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool, ToolUseContext } from './Tool';

/**
 * 文件写入工具 (实现 Tool 接口)
 * 允许大模型创建或覆盖本地文件。
 */
export const fileWriteTool: Tool<{ file_path: string; content: string; require_new?: boolean }, string> = {
  name: 'FileWriteTool',
  description: `
    将内容写入到指定文件。
    注意：
    - 此操作会完全覆盖目标文件。如果要修改现有文件，请确保你已经读取了它，并在调用此工具时提供完整的更新后内容。
    - 如果你旨在创建一个新文件（非修改旧文件），强烈建议将 require_new 设置为 true。如果目标文件已存在，工具将报错并拒绝覆盖，这能有效防止意外覆盖用户的旧代码。
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
      require_new: {
        type: 'boolean',
        description: '可选。如果为 true，当目标文件已存在时将拒绝写入并报错。用于确保不会意外覆盖用户的文件。',
      },
    },
    required: ['file_path', 'content'],
  },
  execute: async (args: { file_path: string; content: string; require_new?: boolean }, context: ToolUseContext): Promise<string> => {
    try {
      let { file_path, content, require_new } = args;
      if (!file_path) {
        return `写入文件时出错：file_path 不能为空`;
      }
      
      // 如果路径是相对路径，使用上下文中的 workspaceDir 解析为绝对路径
      if (!path.isAbsolute(file_path)) {
        file_path = path.resolve(context.workspaceDir, file_path);
      }

      console.log(`[FileWriteTool] 正在写入文件: ${file_path}`);
      
      // 如果大模型明确想要创建新文件，检查目标是否已存在
      if (require_new) {
        try {
          await fs.access(file_path);
          // 如果没有抛出异常，说明文件存在
          return `写入失败：文件 ${file_path} 已经存在！为了保护你的旧代码不被意外覆盖，本次写入已被拒绝。如果你是想修改它，请将 require_new 设为 false。如果你想创建一个新文件，请更换一个不同的文件名。`;
        } catch {
          // 文件不存在，这是预期的行为，可以继续写入
        }
      }
      
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
