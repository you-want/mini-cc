import { Tool, ToolUseContext } from './Tool';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * LSP 操作类型
 */
type LSPOperation = 
  | 'findDefinition'      // 查找定义
  | 'findReferences'      // 查找引用
  | 'getSymbols'          // 获取符号列表
  | 'getHover';           // 获取悬停信息

/**
 * LSPTool 输入参数
 */
interface LSPInput {
  operation: LSPOperation;   // 要执行的操作
  filePath: string;          // 文件路径（绝对或相对）
  symbol?: string;           // 符号名称（用于查找定义/引用）
  line?: number;             // 行号（1-based）
  character?: number;        // 字符位置（1-based）
}

/**
 * LSP 结果项
 */
interface LSPResult {
  file: string;       // 文件路径
  line: number;       // 行号
  column: number;     // 列号
  content: string;    // 该行内容
}

/**
 * LSPTool 输出结果
 */
interface LSPOutput {
  operation: LSPOperation;
  results: LSPResult[];
  count: number;
  message: string;
}

/**
 * 在文件中搜索符号定义（简化版）
 */
async function findDefinitionInFile(
  filePath: string,
  symbol: string
): Promise<LSPResult[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const results: LSPResult[] = [];

    // 简化的定义查找：搜索常见的定义模式
    const patterns = [
      // 函数定义：function name(, const name = function, name: ( => )
      new RegExp(`(?:function\\s+|const\\s+|let\\s+|var\\s+)?${symbol}\\s*[=:]`, 'i'),
      // 类定义：class Name
      new RegExp(`class\\s+${symbol}`, 'i'),
      // 接口定义：interface Name
      new RegExp(`interface\\s+${symbol}`, 'i'),
      // TypeScript/JavaScript 导出：export ... name
      new RegExp(`export\\s+(?:default\\s+)?(?:function|class|const|let|var|interface|type)?\\s*${symbol}`, 'i'),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          results.push({
            file: filePath,
            line: i + 1,
            column: 1,
            content: line.trim(),
          });
          break; // 每行只匹配一次
        }
      }
    }

    return results;
  } catch (error: any) {
    throw new Error(`读取文件失败: ${error.message}`);
  }
}

/**
 * 在项目中搜索符号引用（简化版）
 */
async function findReferencesInProject(
  workspaceDir: string,
  symbol: string,
  excludeDirs: string[] = ['node_modules', '.git', 'dist', 'build']
): Promise<LSPResult[]> {
  try {
    const results: LSPResult[] = [];
    const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'g');

    // 递归搜索文件
    async function searchDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // 跳过排除的目录
        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            await searchDir(fullPath);
          }
          continue;
        }

        // 只搜索源代码文件
        if (!entry.isFile() || !/\.(ts|tsx|js|jsx|py|java|go|rs)$/.test(entry.name)) {
          continue;
        }

        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (symbolRegex.test(lines[i])) {
              results.push({
                file: path.relative(workspaceDir, fullPath),
                line: i + 1,
                column: 1,
                content: lines[i].trim(),
              });
            }
          }
        } catch (error) {
          // 忽略无法读取的文件
          continue;
        }
      }
    }

    await searchDir(workspaceDir);
    return results.slice(0, 100); // 限制结果数量
  } catch (error: any) {
    throw new Error(`搜索引用失败: ${error.message}`);
  }
}

/**
 * 获取文件中的符号列表（简化版）
 */
async function getSymbolsInFile(filePath: string): Promise<LSPResult[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const results: LSPResult[] = [];

    // 搜索常见的符号定义模式
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/,
      /(?:export\s+)?class\s+(\w+)/,
      /(?:export\s+)?interface\s+(\w+)/,
      /(?:export\s+)?type\s+(\w+)\s*=/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          results.push({
            file: filePath,
            line: i + 1,
            column: 1,
            content: `${match[1]} - ${line.trim()}`,
          });
          break;
        }
      }
    }

    return results;
  } catch (error: any) {
    throw new Error(`读取文件失败: ${error.message}`);
  }
}

/**
 * LSPTool - 语言服务器协议工具（简化版）
 * 
 * 功能：提供基础的代码智能功能，如查找定义、引用、符号等。
 * 
 * 使用场景：
 * - 快速跳转到函数或变量的定义位置
 * - 查找某个符号在代码库中的所有引用
 * - 浏览文件中的所有函数、类、变量等符号
 * - 了解代码结构和依赖关系
 * 
 * 教学要点：
 * 1. LSP（Language Server Protocol）是微软开发的开放协议
 * 2. 完整的 LSP 实现需要运行语言服务器进程（如 typescript-language-server）
 * 3. 本实现是简化版，使用正则表达式进行基本的代码分析
 * 4. 生产环境建议使用完整的 LSP 客户端-服务器架构
 * 5. LSP 支持多种编程语言，每种语言需要对应的语言服务器
 * 
 * 支持的操作：
 * - findDefinition: 查找符号的定义位置
 * - findReferences: 查找符号的所有引用
 * - getSymbols: 获取文件中的所有符号
 * - getHover: 获取符号的简要信息（当前返回空）
 * 
 * 示例用法：
 * ```json
 * {
 *   "operation": "findDefinition",
 *   "filePath": "src/utils/helper.ts",
 *   "symbol": "calculateTotal"
 * }
 * ```
 * 
 * 注意：
 * - 这是简化实现，准确性不如完整的 LSP 服务器
 * - 仅支持基本的文本模式匹配
 * - 不支持复杂的类型分析和语义理解
 */
export const lspTool: Tool<LSPInput, LSPOutput> = {
  name: 'LSPTool',
  description: `
    提供基础的代码智能功能（简化版 LSP）。
    
    适用场景：
    - 查找函数、变量、类的定义位置
    - 搜索符号在代码库中的所有引用
    - 浏览文件中的符号列表（函数、类、变量等）
    - 了解代码结构和依赖关系
    
    支持的操作：
    1. findDefinition: 查找符号的定义
       - 需要提供 symbol 参数
       - 在当前文件中搜索定义位置
    
    2. findReferences: 查找符号的引用
       - 需要提供 symbol 参数
       - 在整个工作区中搜索所有引用
    
    3. getSymbols: 获取文件中的符号列表
       - 不需要 symbol 参数
       - 返回文件中定义的所有函数、类、变量等
    
    4. getHover: 获取符号信息
       - 需要提供 symbol 参数
       - 当前返回基本信息（简化实现）
    
    重要规则：
    1. filePath 可以是相对路径或绝对路径
    2. symbol 应该是准确的标识符名称
    3. 搜索结果可能包含误报，需要人工验证
    4. 大型项目的 findReferences 可能较慢
    5. 建议先使用 getSymbols 了解文件结构
    
    注意：
    - 这是简化实现，使用正则表达式匹配
    - 不支持复杂的类型系统和语义分析
    - 生产环境建议使用完整的 LSP 服务器
  `,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: '要执行的 LSP 操作',
        enum: ['findDefinition', 'findReferences', 'getSymbols', 'getHover'],
      },
      filePath: {
        type: 'string',
        description: '目标文件的路径（相对或绝对）',
      },
      symbol: {
        type: 'string',
        description: '要查找的符号名称（findDefinition/findReferences/getHover 需要）',
      },
      line: {
        type: 'number',
        description: '行号（1-based，可选）',
      },
      character: {
        type: 'number',
        description: '字符位置（1-based，可选）',
      },
    },
    required: ['operation', 'filePath'],
    additionalProperties: false,
  },
  execute: async (
    args: LSPInput,
    context: ToolUseContext
  ): Promise<LSPOutput> => {
    try {
      const { operation, filePath, symbol } = args;

      // 解析文件路径
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.workspaceDir, filePath);

      // 验证文件是否存在
      try {
        const stats = await fs.stat(resolvedPath);
        if (!stats.isFile()) {
          throw new Error('路径不是文件');
        }
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          throw new Error(`文件不存在: ${filePath}`);
        }
        throw error;
      }

      console.log(`[LSPTool] 执行操作: ${operation} on ${filePath}${symbol ? ` (symbol: ${symbol})` : ''}`);

      let results: LSPResult[] = [];
      let message = '';

      // 根据操作类型执行不同的逻辑
      switch (operation) {
        case 'findDefinition':
          if (!symbol) {
            throw new Error('findDefinition 需要提供 symbol 参数');
          }
          results = await findDefinitionInFile(resolvedPath, symbol);
          message = results.length === 0
            ? `未找到 "${symbol}" 的定义`
            : `找到 ${results.length} 个 "${symbol}" 的定义`;
          break;

        case 'findReferences':
          if (!symbol) {
            throw new Error('findReferences 需要提供 symbol 参数');
          }
          results = await findReferencesInProject(context.workspaceDir, symbol);
          message = results.length === 0
            ? `未找到 "${symbol}" 的引用`
            : `找到 ${results.length} 个 "${symbol}" 的引用`;
          break;

        case 'getSymbols':
          results = await getSymbolsInFile(resolvedPath);
          message = results.length === 0
            ? '未找到任何符号'
            : `找到 ${results.length} 个符号`;
          break;

        case 'getHover':
          if (!symbol) {
            throw new Error('getHover 需要提供 symbol 参数');
          }
          // 简化实现：返回基本信息
          results = [{
            file: resolvedPath,
            line: args.line || 1,
            column: args.character || 1,
            content: `Symbol: ${symbol}\nFile: ${filePath}`,
          }];
          message = `获取 "${symbol}" 的信息`;
          break;

        default:
          throw new Error(`不支持的操作: ${operation}`);
      }

      console.log(`[LSPTool] ${message}`);

      return {
        operation,
        results,
        count: results.length,
        message,
      };
    } catch (error: any) {
      throw new Error(`LSPTool 执行失败: ${error.message}`);
    }
  },
};
