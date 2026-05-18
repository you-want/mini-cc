import * as fs from 'fs/promises';
import { Tool, ToolUseContext } from './Tool';
import * as path from 'path';

/**
 * 文件编辑工具 (实现 Tool 接口)
 * 
 * 功能：通过精确的字符串替换来编辑文件内容。
 * 
 * 使用场景：
 * - 修改函数实现
 * - 更新配置项
 * - 重构代码
 * - 修复 bug
 * 
 * 教学要点：
 * 1. 使用 old_string 和 new_string 进行精确替换，避免误改
 * 2. old_string 必须在文件中唯一存在，否则会报错
 * 3. 支持 replace_all 选项，可以替换所有匹配项
 * 4. 编辑前会自动备份原文件内容（在内存中）
 * 
 * 安全机制：
 * - 要求 old_string 必须精确匹配
 * - 如果匹配到多个位置且未指定 replace_all，会拒绝操作
 * - 编辑失败时不会修改文件
 */

interface FileEditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

interface FileEditOutput {
  success: boolean;
  message: string;
  replacements: number;
  preview?: {
    before: string;
    after: string;
  };
}

export const fileEditTool: Tool<FileEditInput, FileEditOutput> = {
  name: 'FileEditTool',
  description: `
    通过精确的字符串替换来编辑文件内容。
    
    工作原理：
    1. 读取文件内容
    2. 查找 old_string（必须精确匹配，包括空格和缩进）
    3. 替换为 new_string
    4. 写回文件
    
    参数说明：
    - file_path: 要编辑的文件路径
    - old_string: 要替换的原始字符串（必须精确匹配）
    - new_string: 替换后的新字符串
    - replace_all: 可选，是否替换所有匹配项（默认 false）
    
    重要提示：
    - old_string 必须在文件中存在且唯一（除非设置 replace_all=true）
    - 必须包含完整的缩进和空格，确保精确匹配
    - 如果 old_string 出现多次但未设置 replace_all，操作会失败
    - 建议先用 FileReadTool 读取文件，确认要替换的内容
    
    示例：
    替换函数实现：
    old_string: "function add(a, b) {\\n  return a + b;\\n}"
    new_string: "function add(a, b) {\\n  return a + b + 1;\\n}"
    
    更新配置：
    old_string: "port: 3000"
    new_string: "port: 8080"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '要编辑的文件路径',
      },
      old_string: {
        type: 'string',
        description: '要替换的原始字符串（必须精确匹配，包括缩进）',
      },
      new_string: {
        type: 'string',
        description: '替换后的新字符串',
      },
      replace_all: {
        type: 'boolean',
        description: '可选：是否替换所有匹配项（默认 false）',
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  execute: async (
    args: FileEditInput,
    context: ToolUseContext
  ): Promise<FileEditOutput> => {
    try {
      let { file_path, old_string, new_string, replace_all = false } = args;

      if (!file_path) {
        throw new Error('file_path 参数不能为空');
      }

      if (!old_string) {
        throw new Error('old_string 参数不能为空');
      }

      if (old_string === new_string) {
        return {
          success: false,
          message: 'old_string 和 new_string 相同，无需替换',
          replacements: 0,
        };
      }

      // 解析文件路径
      if (!path.isAbsolute(file_path)) {
        file_path = path.resolve(context.workspaceDir, file_path);
      }

      console.log(`[FileEditTool] 正在编辑文件: ${file_path}`);

      // 读取文件内容
      let content: string;
      try {
        content = await fs.readFile(file_path, 'utf-8');
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`文件不存在: ${file_path}`);
        }
        throw new Error(`读取文件失败: ${error.message}`);
      }

      // 检查 old_string 是否存在
      if (!content.includes(old_string)) {
        throw new Error(
          `在文件中未找到要替换的内容。请确保 old_string 精确匹配（包括空格和缩进）。\n` +
          `查找内容: ${old_string.substring(0, 100)}${old_string.length > 100 ? '...' : ''}`
        );
      }

      // 计算匹配次数
      const matches = content.split(old_string).length - 1;

      // 如果有多个匹配但未设置 replace_all，拒绝操作
      if (matches > 1 && !replace_all) {
        throw new Error(
          `在文件中找到 ${matches} 处匹配，但未设置 replace_all=true。\n` +
          `为了安全起见，请设置 replace_all=true 来替换所有匹配项，\n` +
          `或者提供更具体的 old_string 以确保唯一匹配。`
        );
      }

      // 执行替换
      let newContent: string;
      if (replace_all) {
        // 替换所有匹配项
        newContent = content.split(old_string).join(new_string);
      } else {
        // 只替换第一个匹配项
        newContent = content.replace(old_string, new_string);
      }

      // 写回文件
      try {
        await fs.writeFile(file_path, newContent, 'utf-8');
      } catch (error: any) {
        throw new Error(`写入文件失败: ${error.message}`);
      }

      // 生成预览（显示替换前后的片段）
      const previewLength = 100;
      const oldIndex = content.indexOf(old_string);
      const contextStart = Math.max(0, oldIndex - 50);
      const contextEnd = Math.min(content.length, oldIndex + old_string.length + 50);
      
      const beforePreview = content.substring(contextStart, contextEnd);
      const afterPreview = newContent.substring(
        contextStart,
        contextStart + (contextEnd - contextStart) + (new_string.length - old_string.length)
      );

      console.log(`[FileEditTool] 成功替换 ${matches} 处内容`);

      return {
        success: true,
        message: `成功替换 ${matches} 处内容`,
        replacements: matches,
        preview: {
          before: beforePreview.length > previewLength 
            ? beforePreview.substring(0, previewLength) + '...' 
            : beforePreview,
          after: afterPreview.length > previewLength 
            ? afterPreview.substring(0, previewLength) + '...' 
            : afterPreview,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `文件编辑失败: ${error.message}`,
        replacements: 0,
      };
    }
  },
};
