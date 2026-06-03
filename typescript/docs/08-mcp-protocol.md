# 08. mini-cc 的 MCP 协议：给 AI 装个 USB-C 接口

## 前言

今天咱们聊一个稍微硬核一点的话题：**MCP（Model Context Protocol）**。

这东西是 Anthropic 在 2024 年底提出来的一套开放标准，目标是让 AI 应用能以一种标准化的方式跟外部工具和数据源对接。

## 什么是 MCP

你可以把 MCP 理解为 **AI 世界的 USB-C 接口**。以前要往 AI 里加一个新能力，比如查天气、查数据库、发邮件，每个系统都得单独写一套对接代码。

M 个模型 × N 个工具，维护成本直接爆炸。

MCP 要解决的就是这个问题——**标准化**。

用上 MCP 之后，事情从 M×N 变成了 M+N。任何一个 MCP 客户端都能接任何一个 MCP 服务器，就像 USB-C 一样，接口统一了。

### MCP 的三个核心概念

根据官方规范，MCP 定义了几类服务器能提供的功能。我这里重点说三个：

1. **Tools（工具）**：AI 能主动调用的函数，比如"查天气""读文件"。这是最核心的能力，AI 自己决定什么时候用。
2. **Resources（资源）**：被动提供的数据，比如文件内容、API 数据。AI 不能主动调用，只能在需要的时候读取。
3. **Prompts（提示词模板）**：预定义好的提示词模板，用户可以一键调用。

举个例子：一个 MCP Server 可以同时提供"搜索文档"（Tool）和"项目说明文档"（Resource），AI 既能自己决定什么时候需要搜索，也能在你问的时候直接读取文档。

### 架构：Host → Client → Server

MCP 采用的是三层架构：

- **Host**：你直接打交道的 AI 应用，比如 Claude Desktop、Cursor，或者 mini-cc。
- **Client**：Host 内部维护的模块，每个 MCP Server 对应一个 Client，负责具体的 JSON-RPC 通信。
- **Server**：真正干活的后台，可以用任何语言写——Python、Node.js、Go、Rust 都行。

通信走的是 JSON-RPC，传输方式支持 stdio（本地进程间通信）和 HTTP/SSE（远程服务）。

## mini-cc 中的 MCP 实现

那 mini-cc 里这套东西具体怎么整的？看我们的源码，其实没想象的那么复杂。

### 预加载策略

mini-cc 用的是 **预加载** 策略，不是按需加载。启动的时候把所有 MCP Server 连好，把工具塞到工具注册中心。

我当时也纠结过：是每次需要工具再去连接，还是一启动就连上？后来选了预加载。

因为 mini-cc 运行过程中子 Agent 会频繁创建，如果每个子 Agent 创建时都去重新连 MCP Server，延迟会明显变高。启动时慢一点点没关系，子 Agent 创建顺畅就值了。

当然，预加载也有代价——如果哪个 MCP Server 挂了，启动可能变慢或者整个挂掉。所以我做了容错，某个 Server 连不上就打句警告继续启动，不影响核心功能。

启动流程大概是这样：

```
启动 mini-cc
    ↓
扫描 MCP Server 配置
    ↓
全部连接，获取工具列表
    ↓
注册到全局 ToolRegistry
    ↓
Agent 循环可以直接使用
```

### 配置文件的优先级

MCP Server 的配置放在 `.minicc/mcp.json` 文件里。

配置文件的查找是有优先级的：先找当前工作目录下的 `.minicc/mcp.json`，找不到再找用户的 `~/.minicc/mcp.json`，都找不到就当没有 MCP Server。

环境变量的优先级更高：**环境变量 > 项目配置 > 全局配置**。这样做的好处是，你可以在某个特定项目里配置特殊的 MCP Server，而不影响其他项目的配置。

### 两种 Server 连接方式

mini-cc 支持两种 MCP Server 连接方式：

**stdio 模式**：本地进程，通过标准输入输出通信，最常用。配置示例：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Desktop"],
      "env": { "DEBUG": "true" }
    }
  }
}
```

**HTTP/SSE 模式**：远程服务，通过 HTTP 加 Server-Sent Events 通信。适合需要中心化部署的场景。

配置里还支持环境变量自动展开，格式 `${ENV_VAR}` 或者带默认值的 `${ENV_VAR:-default}`。

### 工具适配器

mini-cc 里有个 `MCPToolAdapter`，干的事情很直接：把 MCP Server 返回的工具定义拿过来，包装成 mini-cc 自己的 `Tool` 接口格式，然后在 `execute` 方法里把调用转发给 MCP Client 等结果。

```typescript
class MCPToolAdapter implements Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  
  async execute(args: any, context: ToolUseContext): Promise<ToolResult> {
    const result = await this.client.callTool(this.name, args);
    return result;
  }
}
```

这样 Agent 在调用工具的时候，根本不知道这个工具是内置的还是 MCP 插件——接口把这一切都给抹平了。

### MCP 客户端的核心逻辑

MCP 客户端的核心其实不复杂，就是通过 stdio 跟 Server 进程通信，用 JSON-RPC 发请求、解析响应。

但我当时为了写好客户端，花了半天研究 `ChildProcess` 的标准输入输出怎么正确处理。

数据粘包（多个响应拼在一起）或者解析卡死的问题很容易碰到。

后来发现官方 MCP SDK（`@modelcontextprotocol/sdk`）已经把底层逻辑封装好了，直接拿来用就行。

mini-cc 里也引了这个包。自己写 MCP 客户端的话，建议直接用 SDK，别重复造轮子。

## MCP 的安全特性

说句实在话，MCP 协议本身不负责安全，安全得自己实现。MCP 的角色是运输层，不是安全层。但 mini-cc 也做了几层防护：

### 1. 进程隔离

每个 MCP Server 是独立进程，崩了不会影响主程序。还做了资源限制：

```typescript
const process = spawn(serverPath, [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  resourceLimits: {
    maxCPU: 1000,           // 最多跑 1 秒 CPU 时间
    maxMemory: 512 * 1024 * 1024  // 限制 512MB 内存
  }
});
```

### 2. 严格模式

如果你希望某个环境"必须"有 MCP Server，可以通过 `MINICC_MCP_STRICT=1` 环境变量让启动失败：

| 场景 | 普通模式 | 严格模式 |
|------|----------|----------|
| 缺少 MCP 依赖 | 警告 + 跳过 | 启动失败 |
| MCP 配置文件格式错误 | 警告 + 跳过 | 启动失败 |
| MCP Server 连不上 | 警告 + 跳过 | 启动失败 |
| 没有 MCP 配置文件 | 正常运行 | 正常运行 |

这个设计很实用。本地开发时 MCP 不是必需品，连不上就跳过；但在 CI/CD 流水线上，如果没有配置好 MCP 测试环境，就应该提前报错，而不是把问题带到生产环境。

### 3. 用户审批

敏感操作需要用户明确授权，这在前面工具系统的文章里详细讲过。

MCP 官方网站对安全有三条核心建议：
- **用户同意**：涉及数据访问和操作必须用户明确同意
- **数据隐私**：不能未经同意把用户数据传给第三方
- **工具安全**：工具本质上是可执行任意代码的，调用前必须用户确认

这些原则 mini-cc 在设计时基本都考虑到了。

## 测试你的 MCP Server

开发 MCP Server 的时候怎么调试？官方提供了一个 **MCP Inspector** 工具：

```bash
npx @modelcontextprotocol/inspector node your-server.js
```

打开浏览器就能看到 Server 暴露了什么 Tools 和 Resources，还可以交互式地测试调用。

我写第一个 MCP Server 时就靠这个工具一步步验证，省了不少时间。

## 一个简单的 MCP Server 示例

一个最简单的 Node.js 天气插件长这样：

```javascript
#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');

const server = new Server({
  name: 'weather-server',
  version: '1.0.0'
});

server.setRequestHandler('list_tools', async () => ({
  tools: [{
    name: 'get_weather',
    description: '获取城市天气',
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名称' }
      },
      required: ['city']
    }
  }]
}));

server.setRequestHandler('call_tool', async (request) => {
  if (request.params.name === 'get_weather') {
    const city = request.params.arguments.city;
    const weather = cities[city] || { temp: '未知', condition: '未知' };
    return { content: `${city} 天气: ${weather.temp}°C ${weather.condition}` };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
```

配置好之后重启 mini-cc，`get_weather` 工具就会出现在 Agent 的工具列表里。用户在聊天中提到天气，Agent 会自己决定调用这个工具。

## 总结

MCP 协议是 mini-cc 插件生态的基石：

1. **标准化接口**：统一的工具定义和调用方式，不用再给每个 AI 单独写对接了
2. **语言无关**：插件可以用任何语言编写——Python、Node.js、Go、Rust 都行
3. **安全隔离**：插件运行在独立进程中，崩了不会影响主程序
4. **预加载策略**：启动时全部加载并缓存，子 Agent 创建时零延迟

如果你觉得 mini-cc 自带工具不够用，随时可以自己开发 MCP 插件来扩展功能。

**P.S.** 关于安全这块，MCP 协议本身只定义消息怎么发，安全还得靠上层 Host 自己做。我写了一套审批流程，敏感工具调用前会弹出来让你确认。如果要在生产环境用 MCP，建议加一个网关做权限控制、审计和限流，不然日志和审计会比较头疼。

---

**最后问一句**：你想开发什么样的 MCP 插件？欢迎在评论区聊聊！

---

## 🌟 如果觉得有用

- **⭐ Star 一下**：[GitHub 仓库](https://github.com/you-want/mini-cc)
- **📝 关注博客**：后续还会更新更多内容

你的支持是我继续写的动力！🚀