import * as fs from 'fs/promises';
import { Tool, ToolUseContext } from './Tool';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Glob 文件搜索工具 (实现 Tool 接口)
 * 
 * 功能：通过通配符模式（如 *.ts, **\/*.json）快速查找匹配的文件。
 * 
 * 使用场景：
 * - 查找项目中所有的 TypeScript 文件：`**\/*.ts`
 * - 查找特定目录下的配置文件：`src/**\/config.json`
 * - 查找所有测试文件：`**\/*.test.ts`
 * 
 * 教学要点：
 * 1. Glob 模式是一种文件路径匹配语法，比正则表达式更简单直观
 * 2. `*` 匹配单层目录中的任意字符
 * 3. `**` 匹配任意层级的目录
 * 4. 结果限制在 100 个文件以内，避免返回过多结果
 */
export const globTool: Tool<{ pattern: string; path?: string }, { files: string[]; count: number; truncated: boolean }> = {
  name: 'GlobTool',
  description: `
    使用 glob 模式搜索匹配的文件。
    
    Glob 模式语法：
    - * : 匹配任意字符（不包括路径分隔符）
    - ** : 匹配任意层级的目录
    - ? : 匹配单个字符
    - [abc] : 匹配方括号中的任意一个字符
    
    示例：
    - "*.ts" : 当前目录下所有 .ts 文件
    - "**/*.json" : 所有子目录中的 .json 文件
    - "src/**/*.test.ts" : src 目录下所有测试文件
    - "lib/[a-z]*.js" : lib 目录下以小写字母开头的 .js 文件
    
    注意：
    - 默认在当前工作目录搜索
    - 结果限制为 100 个文件，超出会被截断
    - 自动忽略 node_modules、.git 等常见目录
  `,
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob 匹配模式，如 "**/*.ts" 或 "src/**/*.json"',
      },
      path: {
        type: 'string',
        description: '可选：搜索的起始目录。如果不指定，则使用当前工作目录',
      },
    },
    required: ['pattern'],
  },
  execute: async (
    args: { pattern: string; path?: string },
    context: ToolUseContext
  ): Promise<{ files: string[]; count: number; truncated: boolean }> => {
    try {
      const { pattern, path: searchPath } = args;
      
      if (!pattern) {
        throw new Error('pattern 参数不能为空');
      }

      // 确定搜索的根目录
      const cwd = searchPath 
        ? (path.isAbsolute(searchPath) ? searchPath : path.resolve(context.workspaceDir, searchPath))
        : context.workspaceDir;

      // 验证目录是否存在
      try {
        const stats = await fs.stat(cwd);
        if (!stats.isDirectory()) {
          return {
            files: [],
            count: 0,
            truncated: false,
          };
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`目录不存在: ${searchPath || context.workspaceDir}`);
        }
        throw error;
      }

      console.log(`[GlobTool] 在目录 ${cwd} 中搜索模式: ${pattern}`);

      // 使用 glob 库进行文件搜索
      // ignore 选项：忽略常见的不需要搜索的目录
      const matches = await glob(pattern, {
        cwd,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**',
          '**/.cache/**',
        ],
        nodir: true, // 只返回文件，不返回目录
        absolute: false, // 返回相对路径
      });

      // 限制结果数量，避免返回过多文件
      const MAX_RESULTS = 100;
      const truncated = matches.length > MAX_RESULTS;
      const files = matches.slice(0, MAX_RESULTS);

      console.log(`[GlobTool] 找到 ${matches.length} 个匹配文件${truncated ? '（已截断到 100 个）' : ''}`);

      return {
        files,
        count: files.length,
        truncated,
      };
    } catch (error: any) {
      throw new Error(`Glob 搜索失败: ${error.message}`);
    }
  },
};
