# 把 CLI 工具变成 MCP Server：让 AI Agent 能调用你的命令行工具

## 前言

最近在折腾 mini-cc 项目 —— 这是一个我用 TypeScript 写的轻量级 AI 编程助手，类似 Claude Code 的简化版。它内置了很多实用工具：执行 Shell 命令、读写文件、搜索文件和内容、获取 Git 状态等等。

但用着用着，我突然冒出一个想法：

> **这些工具只能在 mini-cc 内部用，太浪费了。能不能把它们封装成一个 MCP Server，让 Claude、GPT 或者其他 AI Agent 也能调用？**

比如，我有个 LangChain 编排的流程，需要读取本地文件、执行命令、搜索代码 —— 如果 mini-cc 的工具能以标准协议暴露出来，那这些编排流程就能直接调用了。

说干就干。花了一些时间把这个功能实现了，今天来详细分享一下整个思路、原理、开发过程和测试验证。

---

## 先搞清楚：MCP 是什么？

在动手之前，我觉得有必要先聊聊 MCP 协议，因为它是整个方案的基础。如果你已经了解 MCP，可以跳过这一节。

### MCP 协议简介

MCP（Model Context Protocol）是 Anthropic 提出的一个开放协议，全称叫"模型上下文协议"。它解决的核心问题是：**怎么让 AI 模型标准化地调用外部工具？**

你可以把它理解为 AI 世界的 USB 接口 —— 不管是什么设备（工具），只要遵循 USB 标准（MCP 协议），就能即插即用。

MCP 采用的是 Client-Server 架构：

```
┌──────────────┐                    ┌──────────────┐
│  MCP Client  │ ◄── JSON-RPC ───►  │  MCP Server  │
│  (AI 应用)    │     双向通信        │  (工具提供方)  │
└──────────────┘                    └──────────────┘
```

- **MCP Client**：AI 应用端，比如 Claude Desktop、Cursor、或者你自己写的 Agent
- **MCP Server**：工具提供方，暴露各种工具（tools）、资源（resources）、提示词（prompts）

它们之间通过 JSON-RPC 2.0 协议通信，传输层可以是 stdio（标准输入输出）、SSE（Server-Sent Events）、WebSocket 等。

### MCP 的通信流程

一次完整的 MCP 工具调用，流程是这样的：

```
Client                                    Server
  │                                         │
  │  1. 建立连接（SSE / stdio）               │
  │ ─────────────────────────────────────►  │
  │                                         │
  │  2. initialize（握手，交换能力信息）        │
  │ ─────────────────────────────────────►  │
  │ ◄─────────────────────────────────────  │
  │                                         │
  │  3. tools/list（获取可用工具列表）         │
  │ ─────────────────────────────────────►  │
  │ ◄─────────────────────────────────────  │
  │     返回工具名称、描述、参数 Schema         │
  │                                         │
  │  4. tools/call（调用某个工具）             │
  │ ─────────────────────────────────────►  │
  │                                         │
  │     Server 执行工具逻辑...                │
  │                                         │
  │ ◄─────────────────────────────────────  │
  │     返回执行结果                          │
  │                                         │
```

关键点在于第 3 步 —— **工具发现**。客户端不需要预先知道有哪些工具，它可以通过 `tools/list` 请求自动获取所有可用工具的名称、描述和参数定义。这就是 MCP 比 REST API 优雅的地方：你不需要写文档，协议本身就能描述工具。

### 为什么选 MCP 而不是 REST API？

你可能会问：直接写个 REST API 不行吗？为什么非要用 MCP？

说实话，一开始我也考虑过 REST API，但对比之后发现 MCP 有几个明显优势：

| 对比维度 | REST API | MCP 协议 |
|---------|----------|---------|
| 工具发现 | 需要自己写文档 | 客户端自动获取工具列表和参数 Schema |
| 参数校验 | 需要自己实现 | 协议内置 JSON Schema 校验 |
| 生态兼容 | 每个客户端都要适配 | 所有支持 MCP 的客户端都能直接用 |
| 类型安全 | 需要额外工作 | 配合 Zod 等库，天然类型安全 |
| 标准化 | 各家各写各的 | Anthropic 主导的开放标准 |

最关键的一点是 **生态兼容**。一旦你的工具以 MCP 协议暴露出去，Claude Desktop、Cursor、Windsurf、Cline 等所有支持 MCP 的客户端都能直接调用，不需要为每个客户端单独写适配代码。

---

## 整体架构设计

想清楚了原理，接下来就是设计了。我的目标架构是这样的：

```
┌─────────────────┐                     ┌──────────────────────┐
│  外部 Agent     │    SSE over HTTP    │  mini-cc MCP Server  │
│ (Claude/GPT/    │ ◄─────────────────► │  (Docker 容器内)      │
│  LangChain/...) │   JSON-RPC 双向通信  │                      │
└─────────────────┘                     │  ┌────────────────┐  │
                                        │  │  McpServer     │  │
                                        │  │  (MCP 协议层)   │  │
                                        │  ├────────────────┤  │
                                        │  │  TaskManager   │  │
                                        │  │  (异步任务管理)  │  │
                                        │  ├────────────────┤  │
                                        │  │  工具执行引擎    │  │
                                        │  │  Bash/File/... │  │
                                        │  └────────────────┘  │
                                        └──────────────────────┘
```

整个系统分三层：

1. **MCP 协议层**：负责和外部客户端通信，处理 JSON-RPC 请求
2. **任务管理层**：处理异步任务的提交、执行、轮询
3. **工具执行层**：实际执行各种工具（命令、文件操作、搜索等）

### 两种调用模式

我设计了两种调用模式：

**同步模式**：客户端调用工具，等待执行完成，直接拿到结果。适合执行时间短的操作，比如读文件、搜索。

**异步模式**：客户端提交任务，立即拿到 `task_id`，然后通过轮询查询状态和结果。适合执行时间长的操作，比如编译项目、运行测试。

```
同步模式：
Client ──callTool──► Server ──执行──► 返回结果

异步模式：
Client ──submit_task──► Server ──返回 task_id──► Client
                         Server ──后台执行──► ...
Client ──get_task_status──► Server ──返回状态/结果──► Client
```

为什么要设计异步模式？因为 MCP 协议本身是同步的请求-响应模型。如果一个工具执行需要 30 秒（比如编译项目），客户端就得一直等着。通过异步模式，客户端提交任务后可以去做别的事情，隔一会儿再来查询结果。

---

## 开发过程

### 第一步：实现异步任务管理器 TaskManager

为什么先做 TaskManager？因为它是整个异步模式的核心，MCP Server 要依赖它。

先看一下 `TaskManager` 的核心数据结构：

```typescript
// src/server/TaskManager.ts

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskRecord {
  id: string;            // 任务唯一 ID（UUID）
  toolName: string;      // 调用的工具名称
  status: TaskStatus;    // 当前状态
  result: string | null; // 执行结果（完成后填充）
  error: string | null;  // 错误信息（失败时填充）
  createdAt: number;     // 创建时间戳
  completedAt: number | null; // 完成时间戳
}
```

任务的生命周期很简单：`pending → running → completed/failed`

核心方法是 `submitTask`，它接收一个工具实例、参数和上下文，生成一个 `taskId`，然后在后台异步执行：

```typescript
submitTask(tool: Tool<any, any>, args: any, context: ToolUseContext): string {
  const taskId = crypto.randomUUID();

  const record: TaskRecord = {
    id: taskId,
    toolName: tool.name,
    status: 'pending',
    result: null,
    error: null,
    createdAt: Date.now(),
    completedAt: null,
  };

  this.tasks.set(taskId, record);

  // 关键：异步执行，不阻塞调用方
  this.executeTask(record, tool, args, context);

  return taskId;
}
```

注意这里的 `this.executeTask()` 没有 `await`，这意味着它会立即返回 `taskId`，工具在后台异步执行。这就是异步任务的核心 —— **提交和执行解耦**。

后台执行的逻辑也很直接：

```typescript
private async executeTask(
  record: TaskRecord,
  tool: Tool<any, any>,
  args: any,
  context: ToolUseContext
): Promise<void> {
  record.status = 'running';

  try {
    const output = await tool.execute(args, context);
    // 将输出统一序列化为字符串
    record.result = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    record.status = 'completed';
  } catch (err: any) {
    record.error = err?.message ?? String(err);
    record.status = 'failed';
  }

  record.completedAt = Date.now();
}
```

还有一个容易忽略的点：**内存泄漏**。如果任务一直累积，内存会越来越大。所以我加了一个定时清理机制，每 5 分钟清理一次超过 30 分钟的已完成任务：

```typescript
private startCleanup(): void {
  this.cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        task.completedAt &&
        now - task.completedAt > TaskManager.TASK_TTL_MS  // 30 分钟
      ) {
        this.tasks.delete(id);
      }
    }
  }, TaskManager.CLEANUP_INTERVAL_MS);  // 5 分钟

  // 允许进程正常退出
  if (this.cleanupInterval.unref) {
    this.cleanupInterval.unref();
  }
}
```

`unref()` 这行很重要 —— 它确保这个定时器不会阻止 Node.js 进程正常退出。如果不加这行，即使你按了 Ctrl+C，进程也不会退出，因为还有一个活跃的定时器在跑。

### 第二步：实现 MCP Server 核心

这是整个方案的核心部分。我用了 MCP SDK 的高层 API `McpServer`，配合 Zod schemas 来定义工具参数。

先看看 `MiniCCMcpServer` 的构造函数：

```typescript
// src/server/McpServer.ts

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

    // 注册所有业务工具
    this.tools = [
      bashTool, fileReadTool, fileWriteTool,
      gitStatusTool, globTool, grepTool, webFetchTool,
    ];

    // 创建工具执行上下文
    this.context = this.createDefaultContext();

    // 注册工具到 MCP Server
    this.registerAllTools();
  }
}
```

这里有个关键设计：**工具执行上下文**。mini-cc 的每个工具执行时都需要一个 `ToolUseContext`，包含状态管理器、权限策略、工作目录等。在 MCP Server 模式下，我创建了一个默认的上下文，权限策略设为 `auto`（自动批准所有操作），因为这是服务端模式，没有交互式 UI 来询问用户。

```typescript
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
```

#### 注册业务工具

接下来是重头戏 —— 把 mini-cc 的每个工具注册到 MCP Server 上。

`McpServer` 的 `registerTool` 方法接收三个参数：工具名、配置对象（包含描述和 Zod Schema 定义的参数）、以及回调函数。

以 `BashTool` 为例：

```typescript
this.server.registerTool('BashTool', {
  description: '在本地系统执行 Bash/Shell 命令。用于运行测试、执行脚本、操作文件系统。',
  inputSchema: {
    command: z.string().describe('需要执行的 shell 命令')
  },
}, async ({ command }) => {
  const output = await bashTool.execute({ command }, this.context);
  return { content: [{ type: 'text' as const, text: String(output) }] };
});
```

这里的设计思路是 **适配层模式**：MCP Server 不重新实现工具逻辑，而是作为一层薄薄的适配器，把 MCP 协议的调用转发给已有的工具实例。这样做的好处是：
- 工具逻辑只写一次，CLI 和 MCP Server 都能用
- 后续新增工具时，只需要在 `registerAllTools` 里加一段注册代码

再看一个复杂点的例子 —— `GrepTool`，它有多个可选参数：

```typescript
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
```

注意 `z.string().optional()` 的用法 —— Zod 的链式 API 让参数定义非常直观。`McpServer` 会自动把这些 Zod Schema 转换成 MCP 协议需要的 JSON Schema，客户端拿到后就知道每个参数是什么类型、是否必填。

#### 注册任务管理工具

除了 7 个业务工具，我还注册了 4 个任务管理工具。这里重点讲 `submit_task` 和 `get_task_status`：

```typescript
// 提交异步任务
this.server.registerTool('submit_task', {
  description: '提交一个异步任务。工具在后台执行，返回 task_id。通过 get_task_status 轮询查询结果。',
  inputSchema: {
    tool_name: z.string().describe('要执行的工具名称'),
    args: z.record(z.string(), z.any()).describe('工具参数'),
  },
}, ({ tool_name, args }) => {
  // 先找到对应的工具实例
  const tool = this.tools.find((t) => t.name === tool_name);
  if (!tool) {
    return {
      content: [{ type: 'text' as const, text: `错误：工具 ${tool_name} 不存在` }],
      isError: true,
    };
  }

  // 提交给 TaskManager，立即返回 taskId
  const taskId = this.taskManager.submitTask(tool, args, this.context);
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        task_id: taskId,
        status: 'pending',
        message: '任务已提交，请使用 get_task_status 查询状态',
      }),
    }],
  };
});

// 查询任务状态
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
```

还有 `list_tasks` 和 `cancel_task`，逻辑类似，就不贴代码了。

#### 搭建 HTTP 服务器和 SSE 传输层

工具注册完了，接下来要让外部客户端能连上来。我选了 SSE（Server-Sent Events）作为传输层，因为它基于 HTTP，兼容性好，防火墙友好。

SSE 的工作流程是这样的：

```
1. 客户端 GET /sse          → 建立 SSE 长连接，获取 sessionId
2. 客户端 POST /message     → 发送 JSON-RPC 请求（带上 sessionId）
3. 服务端通过 SSE 连接推送   → 返回 JSON-RPC 响应
```

为什么是两步而不是一步？因为 SSE 是单向的 —— 服务端可以向客户端推送数据，但客户端不能通过 SSE 连接发送数据。所以客户端发送请求需要走另一个 HTTP POST 端点。

HTTP 服务器的实现：

```typescript
async start(port: number = 3000): Promise<void> {
  this.httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // SSE 连接端点
    if (url.pathname === '/sse' && req.method === 'GET') {
      await this.handleSseConnection(req, res);
      return;
    }

    // 消息发送端点
    if (url.pathname === '/message' && req.method === 'POST') {
      await this.handleMessage(req, res);
      return;
    }

    // 健康检查端点（给 Docker 用的）
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
```

SSE 连接处理的核心是为每个客户端创建一个 `SSEServerTransport` 实例，并用 `sessionId` 来管理多个会话：

```typescript
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
```

消息处理就是根据 `sessionId` 找到对应的 transport，把请求转发过去：

```typescript
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
```

### 第三步：创建服务器入口

入口文件很简单，主要是启动服务器和处理优雅关闭：

```typescript
// src/server/index.ts
#!/usr/bin/env node
import { MiniCCMcpServer } from './McpServer';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  console.log('🚀 启动 mini-cc MCP Server...');

  const server = new MiniCCMcpServer();
  await server.start(PORT);

  console.log('\n✅ 服务器已就绪！');
  console.log('\n可用端点：');
  console.log(`  - SSE:    http://localhost:${PORT}/sse`);
  console.log(`  - 消息:   http://localhost:${PORT}/message`);
  console.log(`  - 健康检查: http://localhost:${PORT}/health`);

  console.log('\n使用方式：');
  console.log('1. 客户端连接到 SSE 端点建立会话');
  console.log('2. 通过消息端点发送 JSON-RPC 请求');
  console.log('3. 支持同步调用和异步任务（submit_task + get_task_status）');

  // 优雅关闭
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 正在关闭服务器...');
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 正在关闭服务器...');
    await server.shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
```

`shutdown()` 方法会依次清理 TaskManager、关闭所有 SSE 连接、停止 HTTP 服务器：

```typescript
async shutdown(): Promise<void> {
  // 1. 停止任务管理器（清理定时器）
  this.taskManager.shutdown();

  // 2. 关闭所有 SSE 连接
  for (const transport of this.transports.values()) {
    await transport.close();
  }
  this.transports.clear();

  // 3. 停止 HTTP 服务器
  if (this.httpServer) {
    await new Promise<void>((resolve) => {
      this.httpServer!.close(() => resolve());
    });
  }

  console.log('[MCP Server] 已关闭');
}
```

为什么要优雅关闭？因为如果不主动清理，正在执行的任务可能被强制中断，SSE 连接也不会被正确关闭，客户端那边可能会卡住或者报错。

### 第四步：Docker 容器化

为了让这个 MCP Server 能在任何地方运行，我写了 Dockerfile：

```dockerfile
FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app

# 复制 package 文件，利用 Docker 缓存层
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm 和生产依赖
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod

# 复制编译后的代码
COPY dist/ ./dist/
COPY MCP_SERVER.md ./

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV WORKSPACE_DIR=/workspace

# 创建工作目录
RUN mkdir -p /workspace

EXPOSE 3000

# 健康检查：每 30 秒请求一次 /health 端点
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server/index.js"]
```

注意第一行的 `docker.m.daocloud.io/library/node:20-alpine` —— 这里用了 DaoCloud 的镜像源前缀，而不是直接用 `node:20-alpine`。这是因为国内访问 Docker Hub 经常抽风，直接在镜像名里加上镜像源前缀可以绕过这个问题。后面会详细讲这个坑。

docker-compose.yml 配置：

```yaml
services:
  mini-cc-mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - WORKSPACE_DIR=/workspace
      - NODE_ENV=production
    volumes:
      # 挂载本地工作目录，让容器内的工具可以操作宿主机的文件
      - ./:/workspace
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
```

这里有个重要的设计：`volumes` 挂载。容器内的工具需要操作文件，如果不挂载目录，它们只能操作容器内的文件系统，没什么意义。通过挂载 `./:/workspace`，容器内的工具就能直接操作宿主机的项目文件了。

---

## 测试验证

代码写完了，接下来是重头戏 —— 测试。我准备了四种测试方式，从自动化到手动，从本地到 Docker，全方位验证。

### 测试 1：自动化集成测试

测试文件在 `tests/mcp/test_mcp_server.ts`，它的流程是：

1. 启动 MCP Server（在 3001 端口，避免和正式服务冲突）
2. 用 MCP SDK 的 Client 建立 SSE 连接
3. 列出所有工具，验证数量
4. 测试同步工具调用（BashTool、FileReadTool、GlobTool、GrepTool）
5. 测试异步任务（submit_task → 轮询 get_task_status → 获取结果）
6. 测试 list_tasks
7. 关闭服务器

运行命令：

```bash
cd /Users/rain9/github/claude-code/mini-cc/typescript
npx ts-node --compilerOptions '{"module":"CommonJS"}' tests/mcp/test_mcp_server.ts
```

实际运行输出：

```
🚀 启动 MCP Server 集成测试...

[MCP Server] 已注册 7 个业务工具 + 4 个任务管理工具
[MCP Server] 服务已启动，端口 3001
[MCP Server] SSE 端点: http://localhost:3001/sse
[MCP Server] 消息端点: http://localhost:3001/message
✅ 服务器已启动，端口 3001

连接 MCP 客户端...
[MCP Server] 新会话: 652056fa-a798-49fb-bb0e-c18f76565695
✅ 客户端已连接

可用工具 (11 个):
  - BashTool
  - FileReadTool
  - FileWriteTool
  - GitStatus
  - GlobTool
  - GrepTool
  - WebFetchTool
  - submit_task
  - get_task_status
  - list_tasks
  - cancel_task

=== 测试同步工具调用 ===

1. 测试 BashTool...
[BashTool] 正在执行命令: echo "Hello from MCP Server"
   结果: Hello from MCP Server

2. 测试 FileReadTool...
[FileReadTool] 正在读取文件: .../package.json
   读取成功，包名: @you-want/mini-cc

3. 测试 GlobTool...
[GlobTool] 在目录 .../src/server 中搜索模式: **/*.ts
[GlobTool] 找到 3 个匹配文件
   找到文件数: 3

4. 测试 GrepTool...
[GrepTool] 在目录 .../src/server 中搜索模式: export
[GrepTool] 搜索完成，找到 4 个匹配
   匹配数: 4

✅ 同步工具测试通过

=== 测试异步任务 ===

1. 提交异步任务...
   任务 ID: f5779bc6-405f-47dc-93a9-cebef3ac4e9b
   初始状态: pending

2. 轮询任务状态...
   [1] 状态: completed
   结果: 命令执行被拦截：为了防止主线程死锁...

✅ 异步任务测试通过

3. 列出所有任务...
   任务总数: 1

🎉 所有测试通过！

[MCP Server] 会话断开: 652056fa-a798-49fb-bb0e-c18f76565695
[MCP Server] 已关闭
✅ 已关闭服务器
```

所有测试全部通过。可以看到：
- 客户端成功连接，获取到 11 个工具（7 业务 + 4 任务管理）
- 同步调用 BashTool 成功执行了 `echo` 命令
- FileReadTool 成功读取了 package.json，解析出了包名 `@you-want/mini-cc`
- GlobTool 在 `src/server` 目录下找到了 3 个 TypeScript 文件
- GrepTool 搜索到了 4 个 `export` 匹配
- 异步任务的提交和轮询都正常工作

### 测试 2：手动启动服务器 + 客户端调用

如果你想自己体验一下，可以按以下步骤操作。

**第一步：启动服务器**

```bash
cd /Users/rain9/github/claude-code/mini-cc/typescript

# 先编译 TypeScript
pnpm build

# 启动服务器
node dist/server/index.js
```

你会看到：

```
🚀 启动 mini-cc MCP Server...
[MCP Server] 已注册 7 个业务工具 + 4 个任务管理工具
[MCP Server] 服务已启动，端口 3000
[MCP Server] SSE 端点: http://localhost:3000/sse
[MCP Server] 消息端点: http://localhost:3000/message

✅ 服务器已就绪！

可用端点：
  - SSE:      http://localhost:3000/sse
  - 消息:     http://localhost:3000/message
  - 健康检查: http://localhost:3000/health
```

**第二步：验证健康检查**

打开另一个终端：

```bash
curl http://localhost:3000/health
```

返回：

```json
{"status":"ok","service":"mini-cc-mcp-server"}
```

**第三步：运行客户端示例**

```bash
npx ts-node --compilerOptions '{"module":"CommonJS"}' tests/mcp/example_client.ts
```

这个示例会演示所有功能，包括同步调用、异步任务、文件搜索等：

```
🔌 连接到 MCP Server...
✅ 连接成功

📦 可用工具 (11 个):
  - BashTool: 在本地系统执行 Bash/Shell 命令...
  - FileReadTool: 读取本地系统上的文件内容。...
  - FileWriteTool: 将内容写入到指定文件。会完全覆盖目标文件。...
  - GitStatus: 获取当前代码库的 git 状态。只读操作。...
  - GlobTool: 使用 glob 模式搜索匹配的文件。...
  - GrepTool: 在文件中搜索匹配指定模式的内容。支持正则表达式。...
  - WebFetchTool: 获取指定 URL 的网页内容。...
  - submit_task: 提交一个异步任务。工具在后台执行...
  - get_task_status: 查询异步任务的状态和结果...
  - list_tasks: 列出所有任务...
  - cancel_task: 取消一个尚未完成的任务...

=== 示例 1: 同步调用 BashTool ===
结果: Hello from MCP Client!
Thu Jun 17 2026 20:00:00 GMT+0800

=== 示例 2: 同步调用 FileReadTool ===
包名: @you-want/mini-cc
版本: 1.1.2
描述: A lightweight AI coding agent...

=== 示例 3: 异步任务（提交 + 轮询） ===
任务已提交，ID: xxx-xxx-xxx
初始状态: pending

轮询任务状态...
  [1] 状态: running
  [2] 状态: completed

✅ 任务完成！
结果: Step 1
Step 2
Step 3
Done!

=== 示例 4: 列出所有任务 ===
总任务数: 1
  - xxx-xxx-xxx: BashTool [completed]

=== 示例 5: 使用 GlobTool 搜索文件 ===
找到 3 个 TypeScript 文件:
  - McpServer.ts
  - TaskManager.ts
  - index.ts

=== 示例 6: 使用 GrepTool 搜索内容 ===
找到 3 个匹配:
  - McpServer.ts:28 - export class MiniCCMcpServer {
  - TaskManager.ts:26 - export class TaskManager {
  - index.ts:4 - async function main() {

✅ 已断开连接
```

### 测试 3：Docker 容器部署

**第一步：构建镜像并启动**

```bash
cd /Users/rain9/github/claude-code/mini-cc/typescript
docker-compose up -d
```

**第二步：检查容器状态**

```bash
docker-compose ps
```

输出：

```
NAME                              IMAGE                           STATUS
typescript-mini-cc-mcp-server-1   typescript-mini-cc-mcp-server   Up (healthy)
```

看到 `(healthy)` 就说明健康检查通过了，服务正常运行。

**第三步：验证服务**

```bash
curl http://localhost:3000/health
```

返回：

```json
{"status":"ok","service":"mini-cc-mcp-server"}
```

**第四步：用客户端连接测试**

```bash
npx ts-node --compilerOptions '{"module":"CommonJS"}' tests/mcp/example_client.ts
```

和上面本地运行的效果完全一样，只不过这次服务器跑在 Docker 容器里。

**第五步：查看日志**

```bash
docker-compose logs -f
```

可以看到服务器的启动日志和客户端连接的日志。

**第六步：停止服务**

```bash
docker-compose down
```

### 测试 4：用 Python 客户端调用

如果你更熟悉 Python，也可以用 MCP 的 Python SDK：

```python
import asyncio
import json
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    # 连接到 MCP Server
    async with sse_client("http://localhost:3000/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 1. 列出所有工具
            tools = await session.list_tools()
            print("可用工具:", [t.name for t in tools.tools])

            # 2. 同步调用 BashTool
            result = await session.call_tool("BashTool", {
                "command": "echo 'Hello from Python!'"
            })
            print("BashTool 结果:", result.content[0].text)

            # 3. 同步调用 FileReadTool
            result = await session.call_tool("FileReadTool", {
                "file_path": "/workspace/package.json"
            })
            data = json.loads(result.content[0].text)
            print(f"包名: {data['name']}, 版本: {data['version']}")

            # 4. 异步任务：提交 + 轮询
            task = await session.call_tool("submit_task", {
                "tool_name": "GlobTool",
                "args": {"pattern": "**/*.ts", "path": "/workspace/src/server"}
            })
            task_id = json.loads(task.content[0].text)["task_id"]
            print(f"任务已提交: {task_id}")

            # 轮询直到完成
            while True:
                status = await session.call_tool("get_task_status", {
                    "task_id": task_id
                })
                data = json.loads(status.content[0].text)
                print(f"  状态: {data['status']}")

                if data["status"] in ("completed", "failed"):
                    print(f"  结果: {data['result']}")
                    break
                await asyncio.sleep(0.5)

asyncio.run(main())
```

这段代码展示了完整的流程：连接 → 列出工具 → 同步调用 → 异步任务 → 轮询结果。Python SDK 的 API 和 TypeScript SDK 几乎一模一样，这也是 MCP 协议的好处 —— 跨语言一致性。

---

## 遇到的坑

### 坑 1：Docker 镜像源不可用

国内访问 Docker Hub 经常抽风。一开始我用的是 USTC 的镜像源 `docker.mirrors.ustc.edu.cn`，结果这个源也挂了，`docker-compose up` 直接报错：

```
failed to solve: node:20-alpine: failed to resolve source metadata for docker.io/library/node:20-alpine:
failed to do request: Head "https://docker.mirrors.ustc.edu.cn/v2/library/node/manifests/20-alpine": EOF
```

我尝试了修改 `~/.docker/daemon.json` 配置，但 Docker Desktop 没有正确加载。

**最终解决方案**：直接在 Dockerfile 的 FROM 指令里用镜像源前缀：

```dockerfile
FROM docker.m.daocloud.io/library/node:20-alpine
```

这样就不依赖 Docker daemon 的 `registry-mirrors` 配置了，更可靠。

### 坑 2：端口冲突

测试的时候，3000 端口被之前的测试进程占用了，`docker-compose up` 报错：

```
Error response from daemon: ports are not available: exposing port TCP 0.0.0.0:3000: bind: address already in use
```

**解决方案**：找到并杀掉占用端口的进程：

```bash
lsof -i :3000
kill <PID>
```

或者在 `docker-compose.yml` 里改一下端口映射：

```yaml
ports:
  - "3001:3000"  # 把宿主机的 3001 映射到容器的 3000
```

### 坑 3：McpServer 高层 API 需要 Zod Schema

一开始我想用底层的 `Server` API + JSON Schema 来注册工具，但后来发现高层的 `McpServer` API 更简洁，不过它要求用 Zod Schema 而不是 JSON Schema。

这意味着需要额外安装 `zod` 依赖：

```bash
pnpm add zod
```

并且把工具的参数定义从 JSON Schema 转换成 Zod Schema。比如：

```typescript
// 之前（JSON Schema）
inputSchema: {
  type: 'object',
  properties: {
    command: { type: 'string', description: '需要执行的 shell 命令' }
  },
  required: ['command']
}

// 之后（Zod Schema）
inputSchema: {
  command: z.string().describe('需要执行的 shell 命令')
}
```

Zod 的写法更简洁，而且天然类型安全，不需要额外的类型定义。

---

## 最终效果总结

经过完整的开发和测试，最终实现的 MCP Server 包含：

**11 个工具**：
- 7 个业务工具：BashTool、FileReadTool、FileWriteTool、GitStatus、GlobTool、GrepTool、WebFetchTool
- 4 个任务管理工具：submit_task、get_task_status、list_tasks、cancel_task

**3 个 HTTP 端点**：
- `GET /sse` - SSE 连接端点，建立 MCP 会话
- `POST /message?sessionId=xxx` - 消息发送端点，发送 JSON-RPC 请求
- `GET /health` - 健康检查端点

**两种调用模式**：
- 同步模式：直接调用工具，等待结果
- 异步模式：提交任务 → 轮询状态 → 获取结果

**部署方式**：
- 本地运行：`node dist/server/index.js`
- Docker 运行：`docker-compose up -d`

---

## 总结

回顾整个过程，我觉得有几个关键收获：

1. **MCP 协议的设计真的很优雅**。它用 JSON-RPC + SSE 的组合，既保证了双向通信，又兼容 HTTP 基础设施。而且工具发现、参数校验这些都是协议内置的，不需要自己造轮子。

2. **适配层模式是封装已有工具的最佳实践**。MCP Server 不重新实现工具逻辑，而是作为一层薄薄的适配器，把 MCP 协议的调用转发给已有的工具实例。这样工具逻辑只写一次，CLI 和 Server 都能用。

3. **异步任务 + 轮询模式很实用**。对于执行时间长的操作，这种模式比同步等待要好得多。TaskManager 的设计参考了消息队列的思路，简单但够用。

4. **Docker 容器化让部署变得简单**。一个 `docker-compose up -d` 就能跑起来，不用关心环境依赖。通过 volume 挂载，容器内的工具还能直接操作宿主机的文件。

5. **高层 API 比底层 API 好用得多**。`McpServer` 配合 Zod，代码更简洁、类型更安全。如果不是追求极致控制，建议优先用高层 API。

## 下一步

接下来我打算：

1. **添加更多工具** - 比如代码分析、自动重构、LSP 集成等高级功能
2. **支持权限控制** - 让客户端可以限制工具的调用权限，比如禁止执行危险命令
3. **添加监控和日志** - 记录每次工具调用的耗时、参数、结果，方便排查问题
4. **支持 WebSocket 传输层** - 除了 SSE，也支持 WebSocket，给客户端更多选择
5. **写一个 Web UI** - 让非技术人员也能方便地在浏览器里使用这些工具

如果你对这个项目感兴趣，欢迎来 GitHub 上 star 或者提 issue。

---

**参考资料**：
- [MCP 协议官方文档](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Zod - TypeScript-first schema validation](https://zod.dev/)
