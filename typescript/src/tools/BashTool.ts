import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { checkCommandSecurity } from './BashTool/bashSecurity';

// 将基于回调的 exec 函数转换为返回 Promise 的异步函数
const execAsync = promisify(exec);

/**
 * BashTool
 * 
 * 作用：允许模型在当前操作系统上执行 Shell 命令。
 * 这是一个核心工具，使得 Claude Code 具备了执行测试、安装依赖、查看系统状态等能力。
 */
export class BashTool {
  /**
   * 工具的名称，大模型 API 调用时需使用此名称
   */
  public readonly name = 'BashTool';

  /**
   * 工具的详细描述，用于告诉大模型何时以及如何使用该工具。
   * 包含对安全性、执行环境以及如何处理交互式命令的说明。
   */
  public readonly description = `
    在本地系统执行 Bash/Shell 命令。
    使用该工具来运行测试、执行脚本、操作文件系统或调用命令行工具。
    注意：
    - 命令是无交互式的（non-interactive），请避免运行需要用户输入的命令（如 vim, nano）。
    - 始终使用绝对路径或基于当前工作目录的相对路径。
    - 如果命令可能会产生大量输出，请使用 \`head\` 或 \`grep\` 进行截断和过滤。
    - 如果你仅仅是为了在写入文件前创建目录（如 mkdir -p），请不要使用此工具！FileWriteTool 在写入时会自动为你创建所需的目录层级。
  `;

  /**
   * 定义该工具所需的参数（符合 JSON Schema 规范）
   */
  public readonly inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '需要执行的 shell 命令，例如：npm run build',
      },
    },
    required: ['command'],
  };

  /**
   * 执行命令的方法
   * 
   * @param args - 包含 \`command\` 属性的对象
   * @returns 执行结果的 stdout，如果发生错误则返回 stderr 结合错误信息
   */
  public async execute(args: { command: string }): Promise<string> {
    try {
      const { command } = args;
      if (!command) {
        return `执行命令时出错: command 不能为空`;
      }

      // 【安全沙盒机制】：拦截高危指令，防止大模型抽风 (根据文档 09-security-and-sandbox 实现)
      const securityCheck = checkCommandSecurity(command);
      if (!securityCheck.isSafe) {
        console.warn(`\n[BashTool 安全拦截] 拒绝执行高危命令: ${command}`);
        return `命令执行被安全沙盒拒绝：${securityCheck.reason}\n请修改你的方案或采取其他不具备破坏性的方式。`;
      }

      console.log(`[BashTool] 正在执行命令: ${command}`);
      
      // 在当前工作目录执行命令
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
      });

      // 如果有标准错误输出，将其与标准输出合并返回
      if (stderr) {
        return `[stdout]\n${stdout}\n[stderr]\n${stderr}`;
      }
      
      return stdout || '命令执行成功，但没有输出。';
    } catch (error: any) {
      // 捕获并返回执行期间的错误，例如非 0 的退出码
      return `执行命令时出错:\n${error.message}\n[stdout]\n${error.stdout || ''}\n[stderr]\n${error.stderr || ''}`;
    }
  }
}
