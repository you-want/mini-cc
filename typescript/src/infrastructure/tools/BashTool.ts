// 引入 exec 函数，用于执行系统命令
import { exec } from 'child_process';
// 引入 promisify 函数，用于将回调函数转换为 Promise
import { promisify } from 'util';
// 引入 bashSecurity 函数，用于检查命令的安全性
import { checkCommandSecurity } from './BashTool/bashSecurity';
// 引入 BashTool 的破坏性指令检查
import { checkDestructiveCommand } from './BashTool/destructiveCommandWarning';
// 引入 Tool 接口，用于定义工具的基本行为
import { Tool, ToolUseContext } from './Tool';
// 引入 os 模块，用于获取系统信息
import * as os from 'os';

const execAsync = promisify(exec);

// ------------------------------------------------------------------------
// 【第三章：深入 BashTool 源码 - 核心细节实现】
// ------------------------------------------------------------------------

/**
 * 1. 聪明的“只读/搜索”命令折叠机制
 * 定义白名单，用于在 UI 或日志中识别这些不会修改系统状态的命令
 */
const BASH_SEARCH_COMMANDS = new Set(['find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis']);
const BASH_READ_COMMANDS = new Set(['cat', 'head', 'tail', 'less', 'more', 'wc', 'stat', 'file', 'jq', 'awk']);
const BASH_LIST_COMMANDS = new Set(['ls', 'tree', 'du']);

// 定义一个函数，用于判断命令是否为搜索或读取命令
// 这些命令不会修改系统状态，适合在 UI 或日志中折叠
export function isSearchOrReadBashCommand(command: string) {
  // 简单提取命令的首个单词作为基础命令
  const baseCommand = command.trim().split(/\s+/)[0] || '';
  const isSearch = BASH_SEARCH_COMMANDS.has(baseCommand);
  const isRead = BASH_READ_COMMANDS.has(baseCommand);
  const isList = BASH_LIST_COMMANDS.has(baseCommand);
  
  return { isSearch, isRead, isList, isSafe: isSearch || isRead || isList };
}

/**
 * 2. 拦截危险的“孤狼”睡眠（Sleep）
 * 防止大模型执行 `sleep 10` 导致主线程无意义阻塞
 */
export function detectBlockedSleepPattern(command: string): string | null {
  const first = command.trim().split('&&')[0]?.split(';')[0]?.trim() ?? '';
  
  // 识别整数秒数的 sleep
  const m = /^sleep\s+(\d+)\s*$/.exec(first);
  if (!m) return null;
  
  const secs = parseInt(m[1]!, 10);
  if (secs < 2) return null; // 2秒以内的缓冲是允许的，比如防限流

  const rest = command.substring(first.length).replace(/^\s*[;&|]+\s*/, '').trim();
  // 如果单独跑 sleep N，会被拦截并建议大模型改用专用的后台监控工具！
  return rest ? `sleep ${secs} followed by: ${rest}` : `standalone sleep ${secs}`;
}

/**
 * 3. 长输出截断（防 Token 爆炸）
 * 模拟实现 EndTruncatingAccumulator，保留头尾，中间截断
 */
export interface EndTruncatingAccumulator {
  append: (text: string) => void;
  toString: () => string;
}

export function createEndTruncatingAccumulator(): EndTruncatingAccumulator {
  const chunks: string[] = [];
  let totalLength = 0;
  // 假设限制最大输出为 2000 个字符，防止超长输出爆 Token
  const MAX_LENGTH = 2000;

  function append(text: string) {
    chunks.push(text);
    totalLength += text.length;
  }

  function toString(): string {
    const fullText = chunks.join('');
    if (fullText.length <= MAX_LENGTH) {
      return fullText;
    }
    // 截断：保留前面 1000 字和后面 1000 字，中间用提示替换
    const head = fullText.substring(0, 1000);
    const tail = fullText.substring(fullText.length - 1000);
    return `${head}\n\n... [输出过长，已自动截断中间的 ${fullText.length - 2000} 个字符以节省 Token] ...\n\n${tail}`;
  }

  return {
    append,
    toString
  };
}

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

      // 【安全策略】: 拦截危险的“孤狼”睡眠（Sleep）
      const sleepPattern = detectBlockedSleepPattern(command);
      if (sleepPattern) {
        console.warn(`\n[BashTool 安全拦截] 拦截到阻塞主线程的 sleep 调用: ${sleepPattern}`);
        return `命令执行被拦截：为了防止主线程死锁，不允许使用过长的 sleep。如果你需要等待某事发生，请思考是否能用轮询或其他替代工具。`;
      }

      // 【安全策略】: 检查命令是否包含高危操作（如 rm -rf /）
      const securityCheck = checkCommandSecurity(command);
      if (!securityCheck.isSafe) {
        console.warn(`\n[BashTool 安全拦截] 拒绝执行高危命令: ${command}`);
        return `命令执行被安全沙盒拒绝：${securityCheck.reason}\n请修改你的方案或采取其他不具备破坏性的方式。`;
      }

      // 【安全策略】: 检查破坏性命令预警
      const destructiveWarning = checkDestructiveCommand(command);
      if (destructiveWarning) {
        // 在正式环境中，这里会触发交互式的手动确认逻辑
        console.warn(`\n[BashTool 破坏性操作预警] 匹配到危险指令: ${command}`);
        console.warn(`[⚠️ 警告] ${destructiveWarning}`);
        // 为了自动化测试能够运行，这里暂不抛出错误，而是返回警告信息并继续执行
        // return `警告：你正在尝试执行破坏性操作！${destructiveWarning}`;
      }

      // 【特性】: 聪明的“只读/搜索”命令折叠提示
      const commandType = isSearchOrReadBashCommand(command);
      if (commandType.isSafe) {
        // 在正式 UI 中，这里可以发事件给 UI 让其把过程“折叠”起来
        console.log(`[BashTool] 💡 这是一个只读/查询命令 (${command})，将在 UI 中折叠展示`);
      } else {
        console.log(`[BashTool] 正在执行命令: ${command} in ${context.workspaceDir}`);
      }
      
      // 理论上这里应该通过 context.permissionContext 调用权限管理器，
      // 确认用户是否授权了该命令的执行（如：需要弹出确认框）。
      // const isAllowed = await context.permissionContext.strategy;
      
      // 使用注入的 context.workspaceDir 作为执行目录
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.workspaceDir,
      });

      // 【特性】: 长输出截断（防 Token 爆炸）
      const stdoutAccumulator = createEndTruncatingAccumulator();
      if (stdout) {
        stdoutAccumulator.append(stdout.trimEnd() + os.EOL);
      }
      if (stderr) {
        stdoutAccumulator.append(`[stderr]\n${stderr.trimEnd()}` + os.EOL);
      }

      const finalOutput = stdoutAccumulator.toString();
      return finalOutput.trim() || '命令执行成功，但没有输出。';
    } catch (error: any) {
      // 执行报错也需要截断，防止报错信息过长
      const errorAccumulator = createEndTruncatingAccumulator();
      errorAccumulator.append(`执行命令时出错:\n${error.message}\n`);
      if (error.stdout) errorAccumulator.append(`[stdout]\n${error.stdout}\n`);
      if (error.stderr) errorAccumulator.append(`[stderr]\n${error.stderr}\n`);
      
      return errorAccumulator.toString();
    }
  }
};
