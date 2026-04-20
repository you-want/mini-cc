// 引入 Tool 接口，用于定义工具的行为
import { Tool, ToolUseContext } from './Tool';
// 引入 exec 函数，用于执行系统命令
import { exec } from 'child_process';
// 引入 promisify 函数，用于将回调函数转换为 Promise
import { promisify } from 'util';
// 引入 os 模块，用于获取当前工作目录
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * 分身术：AgentTool 与子代理机制 (第四章)
 * 允许大模型派生出小弟（子代理）来完成特定任务，支持后台运行和沙箱隔离。
 */
export const agentTool: Tool<
  { 
    prompt: string; 
    name?: string; 
    isolation?: 'worktree' | 'none'; 
    run_in_background?: boolean;
  }, 
  string
> = {
  name: 'AgentTool',
  description: `
    派生子代理（Agent 分身术）。
    当你遇到需要独立试错的子任务，或者需要跑大量测试时，你可以派生一个小弟。
    - isolation: "worktree" 会利用 git worktree 创建一个平行的物理克隆目录（沙箱），在此执行任何破坏性操作都不会弄脏你的主分支！
    - run_in_background: true 会让子代理在后台运行，主代理可以立刻继续与用户对话，稍后再回来检查结果。
  `,
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '给子代理的任务指令。'
      },
      name: {
        type: 'string',
        description: '子代理的代号（例如：BugFixer_1）'
      },
      isolation: {
        type: 'string',
        enum: ['worktree', 'none'],
        description: '隔离模式。"worktree" 会创建一个临时的 git worktree 作为沙箱工作区。'
      },
      run_in_background: {
        type: 'boolean',
        description: '是否在后台异步运行。'
      }
    },
    required: ['prompt']
  },
  execute: async (args, context: ToolUseContext): Promise<string> => {
    const { prompt, name = 'SubAgent', isolation = 'none', run_in_background = false } = args;
    
    let workDir = context.workspaceDir;
    let worktreePath = '';

    console.log(`\n[AgentTool] 🚀 正在派生子代理 "${name}"...`);

    // 【分身术核心 1】: 绝对隔离 (isolation: 'worktree')
    if (isolation === 'worktree') {
      try {
        const branchName = `agent-sandbox-${Date.now()}`;
        worktreePath = `${os.tmpdir()}/mini-cc-worktree-${branchName}`;
        
        console.log(`[AgentTool] 📦 正在为 "${name}" 创建隔离沙箱 (git worktree)...`);
        console.log(`[AgentTool] $ git worktree add -b ${branchName} ${worktreePath}`);
        
        // 真实调用 git 命令创建工作区
        await execAsync(`git worktree add -b ${branchName} ${worktreePath}`, { cwd: workDir });
        workDir = worktreePath;
      } catch (e: any) {
        return `创建隔离沙箱失败：${e.message}\n请确保当前目录是一个干净的 Git 仓库。`;
      }
    }

    // 模拟启动子代理的过程（真实环境会启动一个新的 Agent 实例或者起子进程）
    const subAgentTask = async () => {
      console.log(`\n[子代理 ${name}] 开始在 ${workDir} 中执行任务: "${prompt}"...`);
      // 模拟耗时操作
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = `任务 "${prompt}" 已完成！(模拟返回)`;
      console.log(`\n[子代理 ${name}] 🎉 任务完成！`);

      // 任务完成后，如果是 worktree 隔离，自动清理战场
      if (isolation === 'worktree' && worktreePath) {
        console.log(`[AgentTool] 🧹 正在清理 "${name}" 的临时沙箱...`);
        try {
          await execAsync(`git worktree remove -f ${worktreePath}`, { cwd: context.workspaceDir });
        } catch (e) {
          console.error(`[AgentTool] 清理沙箱失败: ${e}`);
        }
      }

      return result;
    };

    // 【分身术核心 2】: 后台运行 (run_in_background)
    if (run_in_background) {
      console.log(`[AgentTool] 🔄 子代理 "${name}" 已在后台启动，主进程立刻返回。`);
      
      // 不 await，直接让其在后台跑，这里模拟将 Promise 挂载到全局，供以后查询
      // 在真实的系统里，会有一个全局的 TaskRegistry 来管理后台任务的状态
      subAgentTask().catch(e => console.error(`[子代理 ${name}] 后台任务出错:`, e));
      
      return `[async_launched] 子代理 "${name}" 已成功在后台启动。你可以继续其他工作，稍后可以通过查日志或专门的工具获取它的结果。`;
    } else {
      // 阻塞等待执行完毕
      const result = await subAgentTask();
      return result;
    }
  }
};