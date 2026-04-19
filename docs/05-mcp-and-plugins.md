# 第五章：我是如何剖析 Claude Code 的 MCP 服务与插件生态系统的

大家好。今天，我们将继续探索 Claude Code 的核心源码。

在上一章，我们弄懂了它是如何管理和压缩上下文记忆的。但你有没有想过，一个单机版的 AI 编程助手，怎么能随心所欲地去查天气、读内部数据库，甚至和公司的专属 API 打交道呢？

今天，我们就来揭开让 Claude Code 拥有无限扩展能力的终极武器——**MCP 服务与插件生态系统**。

## 学习目标

学习完这章后，你会对以下内容有清晰的认识：
1. 理解 MCP 的架构原理与通信机制（为什么不直接写内置 Tool？）。
2. 掌握 Claude Code 插件（Plugins）生态系统的设计，以及它与 MCP 的关系。
3. 了解跨进程工具调用的“透明代理”是如何实现的。
4. 能够亲手编写并集成一个自定义的 MCP 插件。

---

## 理论讲解：为什么需要 MCP 与插件系统？

在看这部分源码之前，我一直有个疑问：如果我想让 Claude Code 能查天气、读数据库或者调公司内部的 API，直接在源码里加几个新的 Tool 不就好了吗？

直到我翻开源码，看到 Anthropic 提出的 **MCP（Model Context Protocol，模型上下文协议）** 以及建立在其上的 **插件系统（Plugin System）** 时，我才恍然大悟——人家的格局大多了。

内置的 Tool（比如 BashTool、ReadTool）是硬编码在代码里的，采用 TypeScript 编写，和核心引擎深度绑定。但如果我们希望接入百花齐放的外部能力，这种紧耦合的模式显然行不通。

**MCP 就像是 AI 时代的 USB 接口，而插件（Plugin）则是封装好的 U 盘。** 

MCP 是一种标准化的通信协议，允许 Claude Code（作为客户端）与本地或远程的服务器（MCP Server）进行交互。通过这个接口，你可以让 Claude Code 获得：
1. **工具（Tools）**：暴露可执行的函数供模型调用。
2. **资源（Resources）**：暴露静态的上下文数据（比如 API 文档、数据库表结构）。
3. **提示词模板（Prompts）**：提供预定义的 Prompt 模板。

而**插件系统**，则是为了让用户能更方便地分发和安装这些 MCP 服务。在 Claude Code 中，你可以通过 `/plugin` 命令直接从插件市场下载别人写好的插件包，这些插件底层往往就是一个或多个 MCP Server。

最棒的是，由于它是跨进程的，你可以用 Python、Go、Rust 任何你喜欢的语言来写插件，彻底打破了生态的壁垒。

---

## 源码分析：解密插件加载与 MCP 通信

### 1. 插件生态与配置加载（`src/utils/plugins/` & `src/services/mcp/config.ts`）

当你在终端敲下 `claude` 启动时，它是如何找到并加载这些外部插件的？

在源码的 `src/utils/plugins/` 目录下，我看到了完整的插件生命周期管理。一个标准的 Claude Code 插件通常包含一个 `manifest.json`，里面声明了它提供的能力。更硬核的是，为了方便分发，源码还支持一种叫做 **MCPB（MCP Bundle）** 的格式。

在 `src/utils/plugins/mcpPluginIntegration.ts` 中，`loadPluginMcpServers` 函数展示了插件加载的优先级：
1. 解析插件目录下的 `.mcp.json`。
2. 解析 `manifest.json` 中的 `mcpServers` 字段。
3. 如果配置的是一个 `.mcpb` 压缩包，它会调用 `loadMcpbFile` 自动下载、解压缓存，甚至还能处理需要用户填写的鉴权配置（比如 API Key）。

最后，在 `src/services/mcp/config.ts` 中，Claude Code 会把这些插件提供的 MCP 服务，与用户全局（`user` scope）或项目目录（`project` scope）下手动配置的 `.claude/settings.json` 进行合并。这种多层级的配置聚合，保证了灵活性的同时也兼顾了项目的隔离。

### 2. 通信枢纽（`src/services/mcp/client.ts`）

拿到所有配置后，就该建立连接了。翻开 `client.ts`，这个是我在源码里看到的最硬核的设计之一。

Claude Code 支持了多种传输层协议，包括 **stdio（标准输入输出）**、**SSE** 和 **HTTP**。其中我们平时写本地插件最常用到的就是 `stdio`。

```typescript
// src/services/mcp/client.ts (片段)
transport = new StdioClientTransport({
  command: finalCommand,
  args: finalArgs,
  env: {
    ...subprocessEnv(),
    ...serverRef.env,
  },
  stderr: 'pipe', // 防止插件的报错直接污染用户的 UI 界面
})
```

**这里有个非常高明的设计理念：进程隔离。**
你的 MCP Server 是作为一个独立的子进程被拉起的。Claude Code 通过标准输入输出来发送和接收 JSON-RPC 消息。这意味着什么？这意味着就算你下载的第三方插件代码写得稀烂，运行时直接崩溃了（Crash），主进程依然稳如泰山，仅仅是那个插件不可用而已。

### 3. 透明代理（`src/tools/MCPTool/MCPTool.ts`）

当 MCP Server 连上后，它暴露出来的工具是怎么让大模型看到的呢？大模型能区分哪个是内置工具，哪个是远端插件工具吗？

答案是：**完全区分不出来。**

在 `MCPTool.ts` 中，源码使用了一个非常优雅的“代理”模式，把远端工具包装成了本地标准格式：

```typescript
// src/tools/MCPTool/MCPTool.ts
export const MCPTool = buildTool({
  isMcp: true,
  name: 'mcp', // 实际运行时会被覆盖为 mcp__serverName__toolName
  maxResultSizeChars: 100_000,
  // ...
})
```

结合 `src/services/mcp/mcpStringUtils.ts` 中的 `buildMcpToolName` 方法，它会给远端插件暴露的工具打上一个前缀，比如 `mcp__weather__get_weather`。但在扔给大模型调度时，它和普通的内置 `Tool` 实现了同一个接口。

对于 QueryEngine（我们在第二章讲过的查询引擎）来说，它只管调用 `tool.call()`，根本不关心这个调用最终是跑在本地，还是通过 `stdio` 被序列化成 JSON 发送到了另一个 Python 进程里。这就是透明代理的魅力！

---

## 动手实践：写一个天气查询插件

光看不练假把式。我当时为了验证这个流程，随手用 Node.js 写了一个极简的天气查询 MCP Server。你可以跟着我一步步来。

**第一步：编写 MCP Server 脚本**

创建一个 `weather-mcp-server.js`，引入官方的 SDK，暴露一个 `get_weather` 工具：

```javascript
// weather-mcp-server.js
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const server = new Server({
  name: 'weather-plugin',
  version: '1.0.0',
}, {
  capabilities: { tools: {} }
});

// 1. 注册工具及其参数 Schema
server.setRequestHandler('listTools', async () => ({
  tools: [{
    name: 'get_weather',
    description: '获取指定城市的天气',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string', description: '城市拼音，如 Beijing' } },
      required: ['city']
    }
  }]
}));

// 2. 处理大模型的工具调用请求
server.setRequestHandler('callTool', async (request) => {
  if (request.params.name === 'get_weather') {
    const city = request.params.arguments.city;
    // 这里可以换成真实的 API 调用，比如查第三方天气接口
    const weather = city === 'Beijing' ? 'Sunny, 25°C' : 'Unknown';
    return {
      content: [{ type: 'text', text: `The weather in ${city} is ${weather}.` }]
    };
  }
  throw new Error('Tool not found');
});

// 3. 启动基于 stdio 的传输层
const transport = new StdioServerTransport();
server.connect(transport);
```

**第二步：集成到 Claude Code**

在你的项目根目录找到（或创建）`.claude/settings.json`，把我们刚才写的脚本配进去（在真实的插件生态中，这一步往往由安装 MCPB 包代劳）：

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/绝对路径/或者/相对路径/weather-mcp-server.js"]
    }
  }
}
```

**第三步：见证奇迹**

在终端运行 `claude`，然后直接问它：“帮我查一下北京的天气”。

你会看到，Claude Code 乖乖地调用了 `mcp__weather__get_weather` 工具，并且准确地告诉了你“Sunny, 25°C”。整个过程丝滑无比。

---

## 推荐阅读

如果你对如何开发更复杂的 MCP 插件感兴趣，强烈建议阅读以下资料：

- **[Model Context Protocol (MCP) 官方文档](https://modelcontextprotocol.io/)**：了解完整的协议规范，包括 Resources 和 Prompts 的用法。
- **[MCP 规范与 JSON-RPC](https://www.jsonrpc.org/specification)**：深入了解底层的通信数据格式。
- **Claude Code `src/utils/plugins/` 源码目录**：深入研究 Claude Code 是如何解析插件 manifest 以及处理 MCPB 格式包的。

---

*（未完待续，下一章我们将继续解析... 一键三连，关注不迷路）*