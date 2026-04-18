# 从零手写一个简易版 Claude Code (TypeScript 实现指南)

欢迎来到 **mini-claude-code** 的实现教程！

这篇教程将带你一步步拆解并搭建一个具备**工具调用 (Tool Use)** 能力的本地命令行 AI 编程助手。

通过本教程，你将深刻理解 AI Agent 的底层运作机制。

## 🎯 我们要实现什么？

一个类似原始 Claude Code 的命令行工具，它能够：
1. **理解自然语言指令**（如“帮我写个五子棋游戏”）。
2. **自主调用本地工具**（执行 Shell 命令、读取文件、写入文件）。
3. **多模型支持**（不仅支持 Claude 3.7，还能接入兼容 OpenAI 接口的 DeepSeek、通义千问、Qwen 等）。
4. **展示思考过程**（流式输出 Qwen 等模型的推理过程 `reasoning_content`）。

---

## 第一步：项目初始化与环境搭建

首先，我们需要搭建一个基础的 TypeScript 运行环境。这里我们强制使用 `pnpm` 作为包管理器。

1. **初始化项目并安装依赖**
   ```bash
   mkdir typescript && cd typescript
   pnpm init
   
   # 安装核心依赖
   pnpm add openai @anthropic-ai/sdk dotenv chalk
   
   # 安装开发依赖
   pnpm add -D typescript ts-node @types/node
   ```

2. **配置 TypeScript**
   创建 `tsconfig.json`：
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "CommonJS",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     }
   }
   ```

3. **配置强制 pnpm (可选但推荐)**
   在 `package.json` 中加入钩子，防止误用 npm：
   ```json
   "scripts": {
     "preinstall": "npx only-allow pnpm"
   }
   ```

---

## 第二步：定义 AI 的“手和眼” —— 工具 (Tools)

大模型本身只是一个文本生成器，为了让它能改变现实世界，我们需要给它提供工具。

我们在 `src/tools/` 目录下定义三个核心工具。

每个工具都需要包含三个核心属性：
- `name`：大模型调用时的标识。
- `description`：告诉大模型这个工具是干什么的、有什么注意事项。
- `inputSchema`：工具参数的 JSON Schema 格式。

### 1. BashTool (执行终端命令)

基于 Node.js 的 `child_process.exec`。允许模型执行如 `npm install`、`mkdir`、`ls` 等命令。
*关键点：捕获 `stdout` 和 `stderr`，并在出错时将错误信息返回给模型，而不是直接崩溃。*

### 2. FileReadTool (读取文件)

基于 `fs.promises.readFile`。让模型能够读取本地代码以获取上下文。
*关键点：需要限制读取行数（如最多 1000 行），防止上下文超载。*

### 3. FileWriteTool (写入文件)

基于 `fs.promises.writeFile`。让模型能自动创建或修改代码。
*关键点：如果目标目录不存在，需要先使用 `{ recursive: true }` 创建目录。*

---

## 第三步：抽象大模型服务 (LLM Provider)

因为我们想要支持多家模型（Anthropic 和 OpenAI 兼容系列），所以需要设计一个统一的 `LLMProvider` 接口，位于 `src/core/providers/index.ts`。

```typescript
export interface ProviderResponse {
  text: string;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  // 发送用户消息
  sendMessage(userMessage: string, onTextResponse: Function): Promise<ProviderResponse>;
  // 发送工具执行结果
  sendToolResults(results: any[], onTextResponse: Function): Promise<ProviderResponse>;
}
```

### 1. 实现 OpenAIProvider (兼容 Qwen, DeepSeek 等)

在 `OpenAIProvider.ts` 中，我们初始化 `openai` 客户端，并将 `src/tools` 注入到请求的 `tools` 参数中。

最复杂的地方在于**处理流式输出 (Streaming)** 和 **思考过程 (reasoning_content)**：
- 遍历 `stream` 块，拦截 `delta.reasoning_content` 进行思考过程的高亮打印。
- 拦截 `delta.tool_calls`，将增量的工具调用参数拼接起来。
- **重点避坑**：像 Qwen 这样的模型容易在输出的 JSON 中直接混入未转义的物理换行符 `\n`，导致 `JSON.parse` 报错。我们需要用正则 `.replace(/\n/g, '\\n')` 手动为其转义。

### 2. 实现 AnthropicProvider

逻辑类似，调用 `@anthropic-ai/sdk`，使用 `messages.create` 接口，并将工具转为 Anthropic 的 Schema 格式。

---

## 第四步：构建 Agent 核心事件循环

Agent 是整个系统的大脑，它负责“接收用户输入 -> 询问大模型 -> 解析工具调用 -> 执行本地工具 -> 将结果传回给大模型”，直到大模型认为任务完成。

我们在 `src/core/Agent.ts` 中实现：

```typescript
export class Agent {
  constructor(private provider: LLMProvider) {}

  public async chat(userMessage: string, onTextResponse: Function): Promise<void> {
    // 1. 发送用户消息
    let response = await this.provider.sendMessage(userMessage, onTextResponse);

    // 2. 进入 Tool Use 事件循环（While 循环是 Agent 的核心！）
    while (response.toolCalls && response.toolCalls.length > 0) {
      
      // 3. 在本地执行大模型要求的工具
      const toolResults = await this.handleToolCalls(response.toolCalls);
      
      // 4. 将执行结果发回给大模型，获取下一步指示
      response = await this.provider.sendToolResults(toolResults, onTextResponse);
    }
    // 循环结束：说明大模型没有再下发工具调用，任务完成。
  }
}
```

**关键容错逻辑**：在 `handleToolCalls` 中，如果工具参数 JSON 解析失败（或缺少必填字段），我们**决不能抛出异常让程序崩溃**。而是要将带有明确错误信息的文本（如 `[Agent 内部错误] JSON 格式不合法`）作为工具的 `result` **返回给大模型**。大模型看到错误后，会立刻意识到自己的语法问题，并在下一次循环中自我修正。

---

## 第五步：搭建命令行交互界面 (CLI)

最后，我们需要一个美观的终端入口 `src/index.ts`。

1. **加载环境变量**：使用 `dotenv` 读取 `.env` 中的 `PROVIDER`、`API_KEY`、`BASE_URL`。
2. **实例化 Provider 和 Agent**：根据环境变量动态注入 `OpenAIProvider` 或 `AnthropicProvider`。
3. **建立交互式 REPL**：使用 Node 的 `readline` 模块监听终端输入。
   ```typescript
   const rl = readline.createInterface({
     input: process.stdin,
     output: process.stdout,
     prompt: chalk.cyan('mini-cc> ')
   });
   
   rl.on('line', async (line) => {
     // 将用户输入丢给 Agent 处理
     await agent.chat(line, (text, isThinking) => {
       // 使用 chalk 为思考过程和正式回复上色
       if (isThinking) process.stdout.write(chalk.dim(text));
       else process.stdout.write(chalk.green(text));
     });
     rl.prompt(); // 等待下一次输入
   });
   ```

---

## 总结

恭喜你！通过以上五步，你已经实现了一个完整的基于 TypeScript 的大语言模型编程 Agent。

回顾整个过程，你会发现 Agent 并非什么魔法，其本质就是：**大模型强大的逻辑推理能力** + **定义良好的工具 Schema** + **一个 While 循环**。

只要妥善处理好 JSON 解析异常、环境变量注入和流式渲染，你就可以把它打造成你专属的“赛博程序员”。

接下来，你可以尝试为其添加更多有趣的工具，比如：网络搜索工具、数据库查询工具、甚至是浏览器控制工具（Puppeteer）！