// 引入 MCP 客户端和传输层
// 这两个模块是官方提供的，用于与 MCP 插件进行通信
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// 引入 MCP 插件配置接口
import { McpServerConfig } from '../../utils/plugins/mcpPluginIntegration';

/**
 * 封装 MCP 客户端实例接口
 */
export interface McpClientInstance {
  /** 官方 MCP Client 对象，用于调用 callTool 等方法 */
  client: Client;
  /** 基于 stdio 的传输层对象 */
  transport: StdioClientTransport;
  /** 建立与子进程的通信连接 */
  connect: () => Promise<void>;
  /** 关闭传输层，断开连接并杀死子进程 */
  disconnect: () => Promise<void>;
}

/**
 * 创建并连接一个基于 stdio 的 MCP 客户端
 * 
 * 在这里，Claude Code 会作为一个客户端，通过创建一个独立的子进程（Subprocess）
 * 来运行 MCP 插件。主进程与子进程之间通过标准输入输出 (stdio) 进行 JSON-RPC 通信。
 * 
 * @param serverName 服务器名称（用于日志和代理前缀）
 * @param config 服务器配置 (包含需要执行的命令、参数以及环境变量)
 */
export function createMcpClient(serverName: string, config: McpServerConfig): McpClientInstance {
  // 过滤掉值为 undefined 的环境变量
  // 因为 Node.js 的 spawn/exec 对环境变量字典的值有严格要求
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      if (value !== undefined) env[key] = value;
    }
  }

  // 这里高明的设计：通过 stdio 进程隔离
  // 这意味着，即使用户下载的第三方插件代码写得稀烂，运行时直接崩溃了（Crash），
  // 我们的主进程依然稳如泰山，仅仅是那个插件不可用而已。
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env,
    // stderr: 'pipe' 的作用非常关键：
    // 它能防止插件里的 console.error 或系统报错直接打印到用户的终端 UI 里，导致界面错乱
    stderr: 'pipe', 
  });

  // 实例化官方的 MCP Client
  const client = new Client(
    {
      name: `mini-cc-client-${serverName}`,
      version: '1.0.0',
    },
    {
      capabilities: {}, // 声明客户端具备的能力
    }
  );

  async function connect() {
    await client.connect(transport);
    console.log(`[MCP Client] 成功连接到远端插件服务器: ${serverName}`);
  }

  async function disconnect() {
    await transport.close();
    console.log(`[MCP Client] 已断开与远端插件服务器的连接: ${serverName}`);
  }

  return {
    client,
    transport,
    connect,
    disconnect,
  };
}
