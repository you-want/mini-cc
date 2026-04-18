import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * FileWriteTool
 * 
 * 作用：允许大模型修改、创建或覆盖本地文件系统中的文件。
 * 结合文件读取和 Bash 工具，它构成了修改项目源码、自动修复错误的基础能力。
 */
export class FileWriteTool {
  /**
   * 工具在大模型 API 中的标识符
   */
  public readonly name = 'FileWriteTool';

  /**
   * 工具的具体用途与要求
   * 特别强调需要提供完整的内容来覆盖文件。
   */
  public readonly description = `
    将内容写入到指定文件。
    注意：
    - 此操作会完全覆盖目标文件。如果要修改现有文件，请确保你已经读取了它，并在调用此工具时提供完整的更新后内容。
    - 如果目录不存在，它将自动创建。
    - 始终使用绝对路径。
  `;

  /**
   * 输入参数架构定义（JSON Schema）
   */
  public readonly inputSchema = {
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
  };

  /**
   * 写入文件的具体实现
   * 
   * @param args - 包含 \`file_path\` 和 \`content\` 属性的对象
   * @returns 操作结果说明
   */
  public async execute(args: { file_path: string; content: string }): Promise<string> {
    try {
      const { file_path, content } = args;
      console.log(`[FileWriteTool] 正在写入文件: ${file_path}`);
      
      // 解析文件所在的目录，以备创建可能不存在的目录层级
      const dir = path.dirname(file_path);

      // 如果目标目录不存在，使用 recursive 参数创建父级目录
      await fs.mkdir(dir, { recursive: true });
      
      // 以 utf-8 编码将完整内容写入文件
      await fs.writeFile(file_path, content, 'utf-8');
      
      return `文件写入成功：${file_path}`;
    } catch (error: any) {
      return `写入文件时出错：${error.message}`;
    }
  }
}
