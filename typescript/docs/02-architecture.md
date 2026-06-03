---
theme: channing-cyan
---

## 引言

书接上回。今天我们不扯虚的，直接扒开 mini-cc 的源码，聊聊它到底是怎么设计的。

对了，所有代码都在这：  
[https://github.com/you-want/mini-cc/tree/main/typescript](https://github.com/you-want/mini-cc/tree/main/typescript)  
建议你一边读这篇文章，一边打开 `src` 目录对照着看。我接下来讲的每一个模块，源码里都有对应的实现。

## 我坚持的几个设计原则

一开始我也想过要不要搞个特别“企业级”的架构，后来发现没必要。mini-cc 最后只守住了四条简单的原则。

### 1. 分层架构：各层管好各层的事

就是最经典的三层：

- **表现层（Presentation Layer）**：UI 组件、命令行交互、打字机效果。
- **应用层（Application Layer）**：Agent 循环、业务逻辑。
- **基础设施层（Infrastructure Layer）**：工具注册、记忆管理、Provider 对接。

你在 `src/` 下看到的目录，跟这三层几乎一一对应，没什么神奇的。

### 2. 依赖倒置：不把具体实现写死在核心代码里

这是我能同时支持 OpenAI、Anthropic、Qwen 等多个模型的关键。核心引擎只依赖一个 `LLMProvider` 接口：

```typescript
interface LLMProvider {
  chat(messages: Message[]): Promise<ChatResponse>;
  supportsToolCalling(): boolean;
}
```

任何模型只要实现这个接口，就能被 mini-cc 驱动。具体实现放在 `src/services/providers/` 下，核心代码完全不需要改动。

### 3. 单一职责：一个文件只干一件事

- `QueryEngine.ts` – 只负责 Agent 循环
- `Tool.ts` – 只定义工具和执行逻辑
- `MemoryManager.ts` – 只管理记忆

这样改 bug 的时候不用翻遍整个项目，省心。

### 4. 开闭原则：对扩展开放，对修改关闭

想加一个新工具？不用碰 `QueryEngine`，只需要实现 `Tool` 接口，然后注册进去。想加一个新 Provider？同理，实现 `LLMProvider` 就行。核心代码像一块稳定的底座，上面可以随意插拔。

## 核心模块详解（附源码路径）

### 1. Agent 循环引擎

这是 mini-cc 的大脑。它的工作流程就是一个 **思考 → 执行 → 再思考** 的循环。

```typescript
// src/application/QueryEngine.ts
export class QueryEngine {
  async run(prompt: string): Promise<string> {
    // 1. 构建上下文（从记忆系统里捞历史）
    const context = await this.memory.buildContext(prompt);
    
    // 2. 调用 LLM，看它想干什么
    const response = await this.provider.chat(context);
    
    // 3. 解析 AI 的回复里有没有工具调用
    const toolCalls = this.parseToolCalls(response);
    
    // 4. 如果有工具要执行，执行完把结果喂给 AI，递归继续
    if (toolCalls.length > 0) {
      const results = await this.executeTools(toolCalls);
      return this.run(results);   // 递归调用，形成循环
    }
    
    // 5. 没有工具调用了，直接把回答返回给用户
    return response.content;
  }
}
```

**设计要点**：递归循环、状态管理靠 `MemoryManager`、Provider 和 Tool 都是接口注入。  
**源码位置**：`src/application/QueryEngine.ts` – 整个 Agent 的入口，你可以从这里开始读。

### 2. 工具系统

工具是 AI 能干实事的根本。没有工具，它就是个只会耍嘴皮的聊天机器人。

```typescript
// src/infrastructure/tools/Tool.ts
export interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  execute(args: Record<string, any>): Promise<ToolResult>;
}

// 工具注册中心
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  register(tool: Tool) { this.tools.set(tool.name, tool); }
  get(name: string): Tool | undefined { return this.tools.get(name); }
}
```

内置的几个常用工具（源码都在 `src/infrastructure/tools/` 下）：

| 工具名称 | 功能 | 安全性 | 源码文件 |
|---------|------|--------|----------|
| `FileReadTool` | 读取文件 | ✅ 安全 | `fileRead.ts` |
| `FileWriteTool` | 写入文件 | ⚠️ 需审批 | `fileWrite.ts` |
| `BashTool` | 执行命令 | ⚠️ 需审批 | `bash.ts` |
| `GrepTool` | 代码搜索 | ✅ 安全 | `search.ts` |
| `GitStatusTool` | Git 状态 | ✅ 安全 | `gitStatus.ts` |

想加新工具？在 `src/infrastructure/tools/` 下新建一个文件，实现 `Tool` 接口就行，其他地方不用改。

### 3. Provider 抽象层

这个模块负责屏蔽不同大模型 API 的差异。统一接口长这样：

```typescript
// src/services/providers/index.ts
export interface LLMProvider {
  name: string;
  supportsToolCalling: boolean;
  chat(messages: Message[], tools?: Tool[], options?: ChatOptions): Promise<ChatResponse>;
  streamChat(messages: Message[], tools?: Tool[], onChunk?: (chunk: string) => void): Promise<ChatResponse>;
}
```

目前已经支持的 Provider（每个都在 `src/services/providers/` 下有独立文件夹）：

| Provider | 工具调用 | 流式响应 |
|----------|---------|---------|
| Anthropic | ✅ | ✅ |
| OpenAI | ✅ | ✅ |
| Qwen (DashScope) | ✅ | ✅ |
| DeepSeek | ✅ | ✅ |
| Ollama | ⚠️ 有限支持 | ✅ |

**源码指路**：接口定义在 `src/services/providers/index.ts`，每个具体 Provider 的实现都在子目录里。新增 Provider 只需在这个目录下加一套实现，核心引擎零改动。

### 4. 记忆系统

对话一长，Token 成本就爆炸。我设计了一个两层的记忆系统：

```typescript
// src/memdir/MemoryManager.ts
export class MemoryManager {
  private shortTermMemory: Message[] = [];   // 短期记忆，最多50条
  private longTermMemory: MemoryItem[] = []; // 长期记忆，存摘要
  
  async addMessage(message: Message) {
    this.shortTermMemory.push(message);
    // 超过50条 → 让 AI 压缩成摘要，存入长期记忆
    if (this.shortTermMemory.length > 50) {
      const summary = await this.summarize();
      this.longTermMemory.push({ timestamp: Date.now(), summary });
      this.shortTermMemory = this.shortTermMemory.slice(-20);
    }
  }
  
  async buildContext(prompt: string): Promise<Message[]> {
    const context: Message[] = [];
    // 把最近的长期记忆摘要加进去
    if (this.longTermMemory.length > 0) {
      context.push({
        role: 'system',
        content: `长期记忆摘要:\n${this.longTermMemory.slice(-5).map(m => m.summary).join('\n')}`
      });
    }
    context.push(...this.shortTermMemory);
    context.push({ role: 'user', content: prompt });
    return context;
  }
}
```

**记忆策略**：短期记忆存最近对话，超过阈值就压缩成摘要扔进长期记忆。这样既保留关键信息，又控制住 Token 消耗。  
**源码位置**：核心逻辑分散在 `src/memdir/compact.ts` 和 `src/context/` 下。README 里提到的“防爆舱”那个 `truncateHeadForPTLRetry` 函数，你翻到那儿就知道了。

## 整体数据流

```
用户输入
    │
    ▼
┌─────────────────┐
│  UI 层接收输入   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Agent 循环引擎  │←──→ │  记忆系统         │
│  QueryEngine    │     │  MemoryManager  │
└────────┬────────┘     └─────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Provider│ │ Tool   │
│ (LLM)  │ │Registry│
└────────┘ └────────┘
```

## 几个我觉得比较得意的设计亮点

### 1. 插件化设计 – 通过 MCP 协议

```typescript
// src/utils/plugins/mcpPluginIntegration.ts
export class MCPPluginIntegration {
  async loadPlugins(): Promise<void> {
    const plugins = await this.scanPlugins();        // 扫描 ~/.mini-cc/plugins/
    for (const plugin of plugins) {
      const server = await MCP.connect(plugin.path);
      const tools = await server.listTools();
      for (const tool of tools) {
        this.toolRegistry.register(new MCPTool(tool));
      }
    }
  }
}
```

你配好 `settings.json`，启动时就会自动扫描并连接 MCP Server，动态注册工具。  
**源码**：`src/utils/plugins/mcpPluginIntegration.ts`

### 2. 权限控制系统 – 安全不能马虎

我分了三个安全等级：

- `STRICT_LOCAL` – 严格本地模式，所有工具调用都要审批
- `USER_APPROVAL` – 危险工具需要用户显式确认
- `FULL_ACCESS` – 完全信任（不推荐）

```typescript
// src/infrastructure/permissions/index.ts
export class PermissionManager {
  checkPermission(toolName: string): PermissionResult {
    if (this.isDangerousTool(toolName)) {
      return { allowed: false, requiresApproval: true };
    }
    return { allowed: true };
  }
}
```

**使用**：运行 `mini-cc` 后输入 `/permissions` 就能看到当前策略。  
**源码**：`src/infrastructure/permissions/`

### 3. 可观测性 – 埋点但不侵犯隐私

```typescript
// src/services/analytics/firstPartyEventLogger.ts
export function logEvent(eventName: string, payload?: Record<string, any>) {
  if (getPrivacyLevel() === PrivacyLevel.STRICT_LOCAL) return;
  console.debug(`[Telemetry] ${eventName}`, payload);
}
```

默认只上报使用次数、模型类型等聚合数据，不传代码内容。用户可以在设置里完全关闭。

## 总结

mini-cc 的架构其实没有什么黑科技，就是老老实实把几个经典设计原则落到代码里：

- **模块化** – 目录结构即架构，看 `src` 就知道每块干什么。
- **可扩展** – 接口+插件，新增 Provider、工具、技能都不动核心。
- **安全优先** – 权限控制从设计第一天就嵌进去，而不是事后打补丁。
- **可观测** – 埋点、日志、超时兜底，生产环境能跑稳。

> 对了，再贴一次源码地址：[https://github.com/you-want/mini-cc/tree/main/typescript](https://github.com/you-want/mini-cc/tree/main/typescript)  
> 欢迎 clone 下来跑一跑，顺手点个 ⭐️ 就更好了。

还有后续，这是个连续剧，还未完结，请关注不迷路～

---

**思考时间**：你觉得一个 AI 编程助手还缺什么核心能力？评论区聊聊，说不定下期就写它。
