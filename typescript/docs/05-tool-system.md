# 05. mini-cc 工具系统：让 AI 拥有动手能力

## 引言

说实话，没有工具系统的 AI 就是个大型陪聊机器人。你说"帮我改个文件"，它说"好的，我建议你用 sed 命令……"——光说不练，假把式。

工具系统的核心价值就一句话：**让 AI 从'只会说'变成'会做事'**。

今天说一下 mini-cc 里这套工具系统是怎么设计的，以及写代码时踩过的一些坑坑。

## 工具接口：一个统一契约

所有工具必须遵循相同的接口定义，Agent 才能用统一的方式调用它们。

我最后写出来的接口长这样（`src/infrastructure/tools/Tool.ts`）：

```typescript
// src/infrastructure/tools/Tool.ts
export interface Tool<Input = any, Output = any> {
  name: string;                       // 工具名称，供 LLM 识别
  description: string;                // 工具描述，告诉 LLM 这个工具是干嘛的
  inputSchema: any;                   // JSON Schema，用于 LLM 生成结构化的参数
  execute(args: Input, context: ToolUseContext): Promise<Output>;
}
```

重点说说这个 `context`。

早期设计里，我让每个工具自己去读取全局状态。结果单元测试时工具的行为完全不可预测——因为它依赖了外部的全局变量。

后来改成依赖注入的思路，在调用工具时由 Agent 主动传入上下文。`ToolUseContext` 里包括：

- `stateStore`：全局状态管理器
- `permissionContext`：当前的权限策略，告诉工具什么能做什么不能做
- `workspaceDir`：当前工作目录，文件操作用这个解析相对路径

如果你翻开 `src/infrastructure/tools/Tool.ts` 的源码，这几行注释就在那里写着：

```typescript
/**
 * 工具使用上下文 (依赖注入模式)
 * 在每次执行工具时，由调用方（Agent）组装并传入。
 * 这样工具函数内部就不需要直接依赖全局变量，提升了可测试性和解耦度。
 */
```

## 工具注册中心：管好这些工具

工具注册中心的代码放在 `src/infrastructure/tools/index.ts`，用简单的数组和函数实现：

```typescript
// 所有已注册的工具数组
export const tools: Tool<any, any>[] = [
  bashTool,
  fileReadTool,
  fileWriteTool,
  gitStatusTool,
  globTool,
  grepTool,
  // ... 更多工具
];

// 注册单个工具
export function registerTool(tool: Tool<any, any>): void {
  tools.push(tool);
}

// 批量注册工具
export function registerTools(newTools: Tool<any, any>[]): void {
  tools.push(...newTools);
}
```

Agent 在构建系统提示词时，直接遍历 `tools` 数组，动态生成 tool definitions 塞给 LLM。

## 几个有代表性的内置工具

### FileReadTool：最简单的工具

`src/infrastructure/tools/FileReadTool.ts` 里只做了三件事：

```typescript
export const fileReadTool: Tool<{ file_path: string }, string> = {
  name: 'FileReadTool',
  description: `读取本地文件内容，用于获取代码文件或配置文件。注意：请提供绝对路径。`,

  execute: async (args: { file_path: string }, context: ToolUseContext): Promise<string> => {
    let filePath = args.file_path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.resolve(context.workspaceDir, filePath);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    if (lines.length > 1000) {
      console.warn(`文件 ${filePath} 行数超过 1000 行，将进行截断`);
      return lines.slice(0, 1000).join('\n') +
             '\n\n... (文件已截断，仅显示前 1000 行)';
    }

    return content;
  }
};
```

说三点设计上的取舍：

1. **只支持绝对路径解析**：用户传给 AI 的路径可能是相对路径，我需要用 `workspaceDir` 把它转成绝对路径，防止路径解析出问题。
2. **1000 行截断**：LLM 的上下文窗口有限。有一次 AI 要读一个 5000 行的日志文件，我直接整个内容传过去，那次 API token 消耗直接翻了三倍。后来加了截断，体验好多了。
3. **错误处理**：文件不存在、权限不足，都返回清晰的错误消息，让 AI 能理解失败原因并决定下一步。`execute` 函数内直接 `return` 了错误文案，而不是 `throw`，因为我不想让工具执行失败把整个 Agent 循环搞崩溃。

### FileWriteTool / BashTool：敏感工具

这两个工具的真实实现比想象中复杂。关键点：

- **FileWriteTool** 支持 `require_new` 参数（设为 true 时，若目标文件已存在则拒绝写入），同时会自动创建不存在的父目录。
- **BashTool** 执行命令时，有一个危险命令黑名单（`rm -rf /`、`format`、`chmod 777` 等），一旦匹配就拒绝执行并返回明确的拒绝原因。同时还有长输出截断机制（超过 2000 字符自动截断），防止 Token 爆炸。

你可以去 `src/infrastructure/tools/BashTool.ts` 和 `src/infrastructure/tools/FileWriteTool.ts` 翻一下 `checkCommandSecurity` 和 `checkDestructiveCommand` 的逻辑。

## 安全机制：三层防护

mini-cc 用了三层防护。

### 第一层：权限策略

有一套策略模式来管理权限，核心逻辑在 `src/infrastructure/permissions/index.ts`：

```typescript
const SAFE_TOOLS = new Set<string>([
  'FileReadTool',
  'GlobTool',
  'GrepTool',
  'GitStatusTool',
  'WebFetchTool',
  'WebSearchTool',
  'TodoWrite',
  'TaskCreate',
  'TaskList',
  'LSPTool',
]);

const SENSITIVE_TOOLS = new Set<string>([
  'BashTool',
  'FileWriteTool',
  'FileEditTool',
  'NotebookEdit',
  'AgentTool',
]);

// 默认策略下，敏感工具直接拒绝，安全工具放行
if (SAFE_TOOLS.has(toolName)) return true;
if (SENSITIVE_TOOLS.has(toolName)) return false;
```

默认情况下，FileReadTool 可以直接执行，但 BashTool 会被拦截。用户需要用 `/allow BashTool` 手动授权后才能使用。

两个细节值得一提：

- **白名单/黑名单覆盖策略**：如果用户在会话中通过 `/allow` 手动授权了某个敏感工具（比如 `BashTool`），`PermissionContext` 中的 `allowedTools` 会记录它，覆盖默认的拦截规则。
- **全自动模式策略**：如果用户启动了 auto 模式，策略会切换成 `createAutoStrategy()`，所有工具执行前不再检查权限，直接放行。

这套设计的巧妙之处在于：**策略和审批记录分离**——`PermissionContext` 只记录用户在当前会话中的手动授权（白名单/黑名单），而 `PermissionStrategy` 负责具体的规则判断逻辑（比如默认策略下敏感工具默认拦截）。这样不管切换成哪种策略，`allowedTools` 和 `deniedTools` 都能继续生效，不需要重新授权。

### 第二层：工具内部的风险自检

FileReadTool 没有路径校验，因为它的权限策略是 SAFE（只读）。但 BashTool 会在执行前扫描命令，碰到危险 pattern 就直接拒绝。

### 第三层：用户手动授权

敏感工具被拦截时，Agent 会返回提示，用户可以输入 `/allow` 临时授权，或者切换到 auto 模式。

现在的效果是：用 mini-cc 的第一天，除了读文件、搜代码这些只读操作自动放行之外，所有写文件、跑命令的操作都需要你明确说 YES。

早期有一版我忘了加上 `FileWriteTool` 的审批要求，结果 AI 直接把用户的项目文件覆盖了。从那之后我就把权限系统做得特别严格。

## 动态工具加载：MCP 集成

mini-cc 支持 MCP（Model Context Protocol）协议，可以动态加载外部工具，代码在 `src/tools/MCPTool/` 下面。

基本逻辑是：扫描配置好的 MCP Server 配置，用 MCP SDK 连接上去，列出该 Server 提供的所有工具，然后把每个工具包装成 MCPTool 注册进去。客户端连接后，工具可以自动注册。

插件集成这块我直接复用了 Claude 官方的 MCP SDK。你配置好 `~/.mini-cc/settings.json` 之后，启动时就会自动扫描并连接。客户端可以从 MCP 服务器动态拉取工具。

在 `src/utils/plugins/mcpPluginIntegration.ts` 里，核心逻辑是动态注册工具，重启 mini-cc 之后就能自动用上新工具。

MCP 工具统一包装成异步函数，Agent 可以像调用本地工具一样调用它们。

## 一个真实的工具调用示例

想象一下这样的对话：

```
用户：帮我看看 package.json 里写的项目名称是什么

AI: 我来读取文件看看。 [调用 FileReadTool]
FileReadTool: {"file_path": "/Users/me/my-project/package.json"}

AI: 根据 package.json，这个项目的名称是 "my-awesome-project"。
```

这个过程里，Agent 做了这几件事：

1. 识别出用户意图需要读文件 → 生成 tool call，格式是标准的 function calling 格式
2. 从工具数组中获取 FileReadTool 实例
3. 调用 `tool.execute` 执行读取操作
4. 把读取结果返回给 LLM，LLM 从中提取出 name 字段，生成最终回复

如果用户问的是"用 echo 命令输出 Hello World"，那就会触发 BashTool，系统会先检查权限策略，如果默认策略下 BashTool 在 SENSITIVE_TOOLS 中，就会被拦截，提醒用户需要审批。

## 总结

工具系统做下来，我的几个体会：

1. **接口统一是基础**：统一的 `Tool` 接口，让 Agent 可以无差别调用任何工具。
2. **安全是底线**：权限策略 + 内部风险自检 + 用户审批，三层防护保安全。
3. **可观测性很重要**：工具执行要有日志，失败时要返回清晰的错误信息，方便排查。
4. **扩展性不能忽视**：通过 MCP 协议动态加载工具，让 mini-cc 的能力可以无限扩展。

**源码指路**：工具系统的核心代码都在 `src/infrastructure/tools/` 目录下。

`Tool.ts` 定义了接口，`index.ts` 是注册中心，具体实现比如 `FileReadTool.ts`、`BashTool.ts`、`FileWriteTool.ts` 都在同目录下。

权限策略相关代码在 `src/infrastructure/permissions/index.ts`。

- **⭐ Star 一下，非常感谢 🙏**：[GitHub 仓库](https://github.com/you-want/mini-cc)

