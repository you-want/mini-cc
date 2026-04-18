import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * FileReadTool
 * 
 * 作用：允许模型读取本地文件系统上的文件内容。
 * 它是核心工具之一，负责在阅读项目源码、配置等场景时提供只读访问权限。
 */
export class FileReadTool {
  /**
   * 对应在大模型 API 里的工具名称
   */
  public readonly name = 'FileReadTool';

  /**
   * 工具描述，用于告知模型工具的适用场景与注意事项。
   * 特别说明只支持绝对路径。
   */
  public readonly description = `
    读取本地系统上的文件内容。
    用于获取代码文件、配置文件或者日志。
    注意：
    - 请提供需要读取的文件的绝对路径，不要使用相对路径。
    - 如果遇到过大文件（如日志），该工具只会返回前 1000 行。
  `;

  /**
   * 定义参数的 JSON Schema 格式
   */
  public readonly inputSchema = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '需要读取文件的绝对路径',
      },
    },
    required: ['file_path'],
  };

  /**
   * 读取文件的实现
   * 
   * @param args - 包含 \`file_path\` 属性
   * @returns 文件的内容。如果文件不存在，则抛出或返回相关错误。
   */
  public async execute(args: { file_path: string }): Promise<string> {
    try {
      const { file_path } = args;
      if (!file_path) {
        return `读取文件时出错：file_path 不能为空`;
      }
      console.log(`[FileReadTool] 正在读取文件: ${file_path}`);
      
      // 读取文件并以 utf-8 编码转换为字符串
      const content = await fs.readFile(file_path, 'utf-8');

      // 这里可以实现简单的文件行数截断逻辑，以防止上下文超出限制
      const lines = content.split('\n');
      if (lines.length > 1000) {
        console.warn(`[FileReadTool] 文件 ${file_path} 行数超过 1000 行，将进行截断`);
        return lines.slice(0, 1000).join('\n') + '\n\n... (文件已截断，仅显示前 1000 行)';
      }
      
      return content;
    } catch (error: any) {
      // 如果发生如“文件不存在” (ENOENT) 错误，明确提示模型
      if (error.code === 'ENOENT') {
        return `错误：文件未找到。路径：${args.file_path}`;
      }
      return `读取文件时出错：${error.message}`;
    }
  }
}
