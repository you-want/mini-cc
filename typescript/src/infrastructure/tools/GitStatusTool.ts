// 引入 exec 函数，用于执行系统命令
import { exec } from 'child_process';
// 引入 promisify 函数，用于将回调函数转换为 Promise
import { promisify } from 'util';
// 引入 Tool 接口，用于定义工具的行为
import { Tool, ToolUseContext } from './Tool';

const execAsync = promisify(exec);

/**
 * 极简版 Git 状态工具 (实现 Tool 接口)
 * 帮助大模型快速获取当前代码库的 git 状态。
 * 这是一个绝对安全的只读操作示例。
 */
export const gitStatusTool: Tool<{ directory?: string }, string> = {
  name: 'GitStatus',
  description: `
    获取当前代码库的 git 状态。
    这是一个只读工具，用于快速了解当前分支是否干净、有哪些未提交的修改。
  `,
  inputSchema: {
    type: 'object',
    properties: {
      directory: {
        type: 'string',
        description: '要检查的目录路径，默认当前工作路径',
      },
    },
  },
  execute: async (args: { directory?: string }, context: ToolUseContext): Promise<string> => {
    // 优先使用传入的 directory，如果没有则使用上下文中的 workspaceDir
    const cwd = args.directory || context.workspaceDir;
    
    try {
      console.log(`\n[GitStatusTool] 正在获取 Git 状态 (目录: ${cwd})...`);
      
      // 真实执行系统命令
      const { stdout } = await execAsync('git status --short', { cwd });
      
      const result = stdout.trim();
      return result || '当前分支很干净，没有任何未提交的修改。';
    } catch (error: any) {
      return `执行 Git 状态查询失败: ${error.message}`;
    }
  }
};
