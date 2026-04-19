import * as fs from 'fs/promises';
import * as path from 'path';

export const fileWriteTool = {
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
  execute: async (args: { file_path: string; content: string }): Promise<string> => {
    try {
      const { file_path, content } = args;
      if (!file_path) {
        return `写入文件时出错：file_path 不能为空`;
      }
      console.log(`[FileWriteTool] 正在写入文件: ${file_path}`);
      
      const dir = path.dirname(file_path);

      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(file_path, content, 'utf-8');
      
      return `文件写入成功：${file_path}`;
    } catch (error: any) {
      return `写入文件时出错：${error.message}`;
    }
  }
};
