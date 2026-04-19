import { exec } from 'child_process';
import { promisify } from 'util';
import { checkCommandSecurity } from './BashTool/bashSecurity';
import { Tool, ToolUseContext } from './Tool';

const execAsync = promisify(exec);

/**
 * Bash 命令执行工具 (实现 Tool 接口)
 * 允许大模型在用户的机器上执行 Shell 命令，是 Agent 进行系统交互的核心。
 */
export const bashTool: Tool<{ command: string }, string> = {
  name: 'BashTool',
  description: `
    在本地系统执行 Bash/Shell 命令。
    使用该工具来运行测试、执行脚本、操作文件系统或调用命令行工具。
    注意：
    - 命令是无交互式的（non-interactive），请避免运行需要用户输入的命令（如 vim, nano）。
    - 始终使用绝对路径或基于当前工作目录的相对路径。
    - 如果命令可能会产生大量输出，请使用 \`head\` 或 \`grep\` 进行截断和过滤。
    - 如果你仅仅是为了在写入文件前创建目录（如 mkdir -p），请不要使用此工具！FileWriteTool 在写入时会自动为你创建所需的目录层级。
  `,
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '需要执行的 shell 命令，例如：npm run build',
      },
    },
    required: ['command'],
  },
  execute: async (args: { command: string }, context: ToolUseContext): Promise<string> => {
    try {
      const { command } = args;
      if (!command) {
        return `执行命令时出错: command 不能为空`;
      }

      // 【安全策略】: 检查命令是否包含高危操作（如 rm -rf /）
      const securityCheck = checkCommandSecurity(command);
      if (!securityCheck.isSafe) {
        console.warn(`\n[BashTool 安全拦截] 拒绝执行高危命令: ${command}`);
        return `命令执行被安全沙盒拒绝：${securityCheck.reason}\n请修改你的方案或采取其他不具备破坏性的方式。`;
      }

      // 理论上这里应该通过 context.permissionContext 调用权限管理器，
      // 确认用户是否授权了该命令的执行（如：需要弹出确认框）。
      // const isAllowed = await context.permissionContext.strategy;
      
      console.log(`[BashTool] 正在执行命令: ${command} in ${context.workspaceDir}`);
      
      // 使用注入的 context.workspaceDir 作为执行目录
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.workspaceDir,
      });

      if (stderr) {
        return `[stdout]\n${stdout}\n[stderr]\n${stderr}`;
      }
      
      return stdout || '命令执行成功，但没有输出。';
    } catch (error: any) {
      return `执行命令时出错:\n${error.message}\n[stdout]\n${error.stdout || ''}\n[stderr]\n${error.stderr || ''}`;
    }
  }
};
