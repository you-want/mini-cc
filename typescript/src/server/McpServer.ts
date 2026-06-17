import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { IncomingMessage, ServerResponse, createServer } from 'http';
import { z } from 'zod';
import { TaskManager } from './TaskManager';
import {
  bashTool,
  fileReadTool,
  fileWriteTool,
  gitStatusTool,
  globTool,
  grepTool,
  webFetchTool,
} from '../infrastructure/tools/index';
import { Tool, ToolUseContext } from '../infrastructure/tools/Tool';
import { createAppStateStore } from '../infrastructure/state/AppStateStore';

/**
 * mini-cc MCP Server
 *
 * 将 mini-cc 的工具系统封装为 MCP 服务，供外部 Agent 调用。
 * 支持两种模式：
 * 1. 同步模式 - 直接调用工具并返回结果
 * 2. 异步模式 - 通过 submit_task 提交任务，通过 get_task_status 轮询结果
 *
 * 传输层使用 SSE（Server-Sent Events），兼容标准 MCP 客户端。
 */
export class MiniCCMcpServer {
  private server: McpServer;
  private taskManager: TaskManager;
  private tools: Tool<any, any>[];
  private context: ToolUseContext;
  private transports = new Map<string, SSEServerTransport>();
  private httpServer: ReturnType<typeof createServer> | null = null;

  constructor() {
    this.server = new McpServer({
      name: 'mini-cc-mcp-server',
      version: '1.0.0',
    });

    this.taskManager = new TaskManager();

    this.tools = [
      bashTool,
      fileReadTool,
      fileWriteTool,
      gitStatusTool,
      globTool,
      grepTool,
      webFetchTool,
    ];

    this.context = this.createDefaultContext();

    this.registerAllTools();
  }

  /**
   * 创建默认的工具执行上下文
   */
  private createDefaultContext(): ToolUseContext {
    const stateStore = createAppStateStore({
      settings: { verbose: false, mainLoopModel: 'openai' },
      tasks: {},
      toolPermissionContext: {
        strategy: 'auto',
        allowedTools: new Set(),
        deniedTools: new Set(),
      },
      activeSkill: null,
    });

    return {
      stateStore,
      permissionContext: {
        strategy: 'auto' as const,
        allowedTools: new Set<string>(),
        deniedTools: new Set<string>(),
      },
      workspaceDir: process.env.WORKSPACE_DIR || process.cwd(),
    };
  }

  /**
   * 使用 McpServer 高层 API 注册所有工具
   */
  private registerAllTools(): void {
    // ─── 注册业务工具 ──────────────────────────────────────

    // BashTool
    this.server.registerTool('BashTool', {
      description: '在本地系统执行 Bash/Shell 命令。用于运行测试、执行脚本、操作文件系统。',
      inputSchema: { command: z.string().describe('需要执行的 shell 命令') },
    }, async ({ command }) => {
      const output = await bashTool.execute({ command }, this.context);
      return { content: [{ type: 'text' as const, text: String(output) }] };
    });

    // FileReadTool
    this.server.registerTool('FileReadTool', {
      description: '读取本地系统上的文件内容。',
      inputSchema: { file_path: z.string().describe('需要读取文件的绝对路径') },
    }, async ({ file_path }) => {
      const output = await fileReadTool.execute({ file_path }, this.context);
      return { content: [{ type: 'text' as const, text: String(output) }] };
    });

    // FileWriteTool
    this.server.registerTool('FileWriteTool', {
      description: '将内容写入到指定文件。会完全覆盖目标文件。',
      inputSchema: {
        file_path: z.string().describe('目标文件的绝对路径'),
        content: z.string().describe('要写入的完整文件内容'),
        require_new: z.boolean().optional().describe('如果为 true，文件已存在时拒绝写入'),
      },
    }, async (args) => {
      const output = await fileWriteTool.execute(args, this.context);
      return { content: [{ type: 'text' as const, text: String(output) }] };
    });

    // GitStatusTool
    this.server.registerTool('GitStatus', {
      description: '获取当前代码库的 git 状态。只读操作。',
      inputSchema: { directory: z.string().optional().describe('要检查的目录路径') },
    }, async ({ directory }) => {
      const output = await gitStatusTool.execute({ directory }, this.context);
      return { content: [{ type: 'text' as const, text: String(output) }] };
    });

    // GlobTool
    this.server.registerTool('GlobTool', {
      description: '使用 glob 模式搜索匹配的文件。',
      inputSchema: {
        pattern: z.string().describe('Glob 匹配模式，如 "**/*.ts"'),
        path: z.string().optional().describe('搜索的起始目录'),
      },
    }, async (args) => {
      const output = await globTool.execute(args, this.context);
      const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    });

    // GrepTool
    this.server.registerTool('GrepTool', {
      description: '在文件中搜索匹配指定模式的内容。支持正则表达式。',
      inputSchema: {
        pattern: z.string().describe('搜索模式（支持正则表达式）'),
        path: z.string().optional().describe('搜索的目录路径'),
        filePattern: z.string().optional().describe('文件过滤模式，如 "*.ts"'),
        caseSensitive: z.boolean().optional().describe('是否区分大小写'),
        contextLines: z.number().optional().describe('显示匹配行前后的上下文行数'),
      },
    }, async (args) => {
      const output = await grepTool.execute(args, this.context);
      const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    });

    // WebFetchTool
    this.server.registerTool('WebFetchTool', {
      description: '获取指定 URL 的网页内容。',
      inputSchema: {
        url: z.string().describe('要获取的 URL'),
        method: z.enum(['GET', 'POST']).optional().describe('HTTP 方法，默认 GET'),
        headers: z.record(z.string(), z.string()).optional().describe('HTTP 请求头'),
        body: z.string().optional().describe('HTTP 请求体'),
      },
    }, async (args) => {
      const output = await webFetchTool.execute(
        {
          url: args.url,
          method: args.method as 'GET' | 'POST' | undefined,
          headers: args.headers as Record<string, string> | undefined,
          body: args.body,
        },
        this.context
      );
      const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    });

    // ─── 注册任务管理工具 ──────────────────────────────────

    // submit_task - 提交异步任务
    this.server.registerTool('submit_task', {
      description:
        '提交一个异步任务。工具在后台执行，返回 task_id。通过 get_task_status 轮询查询结果。',
      inputSchema: {
        tool_name: z.string().describe('要执行的工具名称'),
        args: z.record(z.string(), z.any()).describe('工具参数'),
      },
    }, ({ tool_name, args }) => {
      const tool = this.tools.find((t) => t.name === tool_name);
      if (!tool) {
        return {
          content: [{ type: 'text' as const, text: `错误：工具 ${tool_name} 不存在` }],
          isError: true,
        };
      }

      const taskId = this.taskManager.submitTask(tool, args, this.context);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              task_id: taskId,
              status: 'pending',
              message: '任务已提交，请使用 get_task_status 查询状态',
            }),
          },
        ],
      };
    });

    // get_task_status - 查询任务状态
    this.server.registerTool('get_task_status', {
      description: '查询异步任务的状态和结果',
      inputSchema: { task_id: z.string().describe('任务 ID') },
    }, ({ task_id }) => {
      const task = this.taskManager.getTask(task_id);
      if (!task) {
        return {
          content: [{ type: 'text' as const, text: `错误：任务 ${task_id} 不存在` }],
          isError: true,
        };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
    });

    // list_tasks - 列出所有任务
    this.server.registerTool('list_tasks', {
      description: '列出所有任务',
      inputSchema: {},
    }, () => {
      const tasks = this.taskManager.listTasks();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ tasks, count: tasks.length }, null, 2),
          },
        ],
      };
    });

    // cancel_task - 取消任务
    this.server.registerTool('cancel_task', {
      description: '取消一个尚未完成的任务',
      inputSchema: { task_id: z.string().describe('任务 ID') },
    }, ({ task_id }) => {
      const success = this.taskManager.cancelTask(task_id);
      return {
        content: [
          {
            type: 'text' as const,
            text: success ? '任务已取消' : '取消失败：任务不存在或已完成',
          },
        ],
      };
    });

    console.log(`[MCP Server] 已注册 ${this.tools.length} 个业务工具 + 4 个任务管理工具`);
  }

  // ─── HTTP 服务器 ───────────────────────────────────────────

  /**
   * 启动 HTTP 服务器
   */
  async start(port: number = 3000): Promise<void> {
    this.httpServer = createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);

      // SSE 连接
      if (url.pathname === '/sse' && req.method === 'GET') {
        await this.handleSseConnection(req, res);
        return;
      }

      // 消息发送
      if (url.pathname === '/message' && req.method === 'POST') {
        await this.handleMessage(req, res);
        return;
      }

      // 健康检查
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'mini-cc-mcp-server' }));
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(port, () => {
        console.log(`[MCP Server] 服务已启动，端口 ${port}`);
        console.log(`[MCP Server] SSE 端点: http://localhost:${port}/sse`);
        console.log(`[MCP Server] 消息端点: http://localhost:${port}/message`);
        resolve();
      });
    });
  }

  private async handleSseConnection(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    const transport = new SSEServerTransport('/message', res);
    const sessionId = transport.sessionId;

    this.transports.set(sessionId, transport);

    transport.onclose = () => {
      this.transports.delete(sessionId);
      console.log(`[MCP Server] 会话断开: ${sessionId}`);
    };

    await this.server.connect(transport);
    console.log(`[MCP Server] 新会话: ${sessionId}`);
  }

  private async handleMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      res.writeHead(400);
      res.end('Missing sessionId');
      return;
    }

    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.writeHead(404);
      res.end('Session not found');
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const message = JSON.parse(body);
        await transport.handlePostMessage(req, res, message);
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  }

  /**
   * 关闭服务器
   */
  async shutdown(): Promise<void> {
    this.taskManager.shutdown();

    for (const transport of this.transports.values()) {
      await transport.close();
    }
    this.transports.clear();

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }

    console.log('[MCP Server] 已关闭');
  }
}
