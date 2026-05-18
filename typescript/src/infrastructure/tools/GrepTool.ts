import * as fs from 'fs/promises';
import { Tool, ToolUseContext } from './Tool';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Grep 内容搜索工具 (实现 Tool 接口)
 * 
 * 功能：在文件中搜索匹配指定模式的内容（支持正则表达式）。
 * 
 * 使用场景：
 * - 查找包含特定函数名的文件：`function handleSubmit`
 * - 搜索 TODO 注释：`TODO|FIXME`
 * - 查找导入语句：`import.*from.*react`
 * - 搜索配置项：`API_KEY|SECRET`
 * 
 * 教学要点：
 * 1. Grep 是 Unix 经典工具，用于文本搜索
 * 2. 支持正则表达式，提供强大的模式匹配能力
 * 3. 可以指定文件类型过滤（如只搜索 .ts 文件）
 * 4. 返回匹配的行号和上下文，方便定位
 */

interface GrepMatch {
  file: string;
  line: number;
  content: string;
  context?: {
    before?: string[];
    after?: string[];
  };
}

interface GrepOutput {
  matches: GrepMatch[];
  totalMatches: number;
  filesSearched: number;
  truncated: boolean;
}

export const grepTool: Tool<
  { 
    pattern: string; 
    path?: string; 
    filePattern?: string;
    caseSensitive?: boolean;
    contextLines?: number;
  }, 
  GrepOutput
> = {
  name: 'GrepTool',
  description: `
    在文件中搜索匹配指定模式的内容。支持正则表达式。
    
    参数说明：
    - pattern: 搜索模式（支持正则表达式）
    - path: 可选，搜索的目录（默认为当前工作目录）
    - filePattern: 可选，文件过滤模式（如 "*.ts" 只搜索 TypeScript 文件）
    - caseSensitive: 可选，是否区分大小写（默认 false）
    - contextLines: 可选，显示匹配行前后的上下文行数（默认 0）
    
    正则表达式示例：
    - "function\\s+\\w+" : 匹配函数定义
    - "TODO|FIXME" : 匹配 TODO 或 FIXME 注释
    - "import.*from" : 匹配 import 语句
    - "\\b[A-Z_]+\\b" : 匹配全大写的常量名
    
    注意：
    - 默认不区分大小写
    - 自动忽略 node_modules、.git 等目录
    - 结果限制为 200 个匹配，超出会被截断
    - 二进制文件会被自动跳过
  `,
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: '搜索模式（支持正则表达式）',
      },
      path: {
        type: 'string',
        description: '可选：搜索的目录路径',
      },
      filePattern: {
        type: 'string',
        description: '可选：文件过滤模式，如 "*.ts" 或 "**/*.json"',
      },
      caseSensitive: {
        type: 'boolean',
        description: '可选：是否区分大小写（默认 false）',
      },
      contextLines: {
        type: 'number',
        description: '可选：显示匹配行前后的上下文行数（默认 0，最大 3）',
      },
    },
    required: ['pattern'],
  },
  execute: async (
    args: { 
      pattern: string; 
      path?: string; 
      filePattern?: string;
      caseSensitive?: boolean;
      contextLines?: number;
    },
    context: ToolUseContext
  ): Promise<GrepOutput> => {
    try {
      const { 
        pattern, 
        path: searchPath, 
        filePattern = '**/*',
        caseSensitive = false,
        contextLines = 0,
      } = args;
      
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
          throw new Error(`路径不是目录: ${searchPath || context.workspaceDir}`);
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`目录不存在: ${searchPath || context.workspaceDir}`);
        }
        throw error;
      }

      console.log(`[GrepTool] 在目录 ${cwd} 中搜索模式: ${pattern}`);

      // 创建正则表达式
      const flags = caseSensitive ? 'g' : 'gi';
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags);
      } catch (error: any) {
        throw new Error(`无效的正则表达式: ${error.message}`);
      }

      // 获取要搜索的文件列表
      const files = await glob(filePattern, {
        cwd,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/.next/**',
          '**/coverage/**',
          '**/.cache/**',
          '**/*.min.js',
          '**/*.map',
        ],
        nodir: true,
        absolute: false,
      });

      console.log(`[GrepTool] 找到 ${files.length} 个文件待搜索`);

      const matches: GrepMatch[] = [];
      const MAX_MATCHES = 200;
      const MAX_CONTEXT_LINES = 3;
      const actualContextLines = Math.min(contextLines, MAX_CONTEXT_LINES);
      let filesSearched = 0;
      let truncated = false;

      // 遍历文件进行搜索
      for (const file of files) {
        if (matches.length >= MAX_MATCHES) {
          truncated = true;
          break;
        }

        const filePath = path.join(cwd, file);
        
        try {
          // 读取文件内容
          const content = await fs.readFile(filePath, 'utf-8');
          filesSearched++;

          // 按行分割
          const lines = content.split('\n');

          // 搜索每一行
          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= MAX_MATCHES) {
              truncated = true;
              break;
            }

            const line = lines[i];
            if (regex.test(line)) {
              const match: GrepMatch = {
                file,
                line: i + 1,
                content: line.trim(),
              };

              // 添加上下文行
              if (actualContextLines > 0) {
                match.context = {};
                
                // 前面的行
                if (i > 0) {
                  const beforeStart = Math.max(0, i - actualContextLines);
                  match.context.before = lines.slice(beforeStart, i).map(l => l.trim());
                }
                
                // 后面的行
                if (i < lines.length - 1) {
                  const afterEnd = Math.min(lines.length, i + actualContextLines + 1);
                  match.context.after = lines.slice(i + 1, afterEnd).map(l => l.trim());
                }
              }

              matches.push(match);
            }
          }
        } catch (error: any) {
          // 跳过无法读取的文件（如二进制文件）
          if (error.code !== 'ENOENT') {
            console.warn(`[GrepTool] 跳过文件 ${file}: ${error.message}`);
          }
          continue;
        }
      }

      console.log(`[GrepTool] 搜索完成，找到 ${matches.length} 个匹配${truncated ? '（已截断）' : ''}`);

      return {
        matches,
        totalMatches: matches.length,
        filesSearched,
        truncated,
      };
    } catch (error: any) {
      throw new Error(`Grep 搜索失败: ${error.message}`);
    }
  },
};
