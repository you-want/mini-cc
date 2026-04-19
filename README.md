# mini-cc

这是一个轻量级的 AI 编程 Agent 核心框架实现，完全使用 TypeScript 编写。

由于部分商标保护和合规原因，本项目已更名为 **mini-cc**（或者 OmniCoder 等泛化名称）。它支持多模型提供商（Anthropic、OpenAI 以及所有兼容 OpenAI 接口的模型如 Qwen、DeepSeek 等），提供读取文件、写入文件和执行 Bash 终端命令的能力。

通过本项目，你可以学习到 Agent 的核心事件循环、工具定义与分发、以及多模型的适配。

## 🌟 核心特性

本项目目前已在 TypeScript 版本中实现了以下核心特性：

- **多模型支持**：支持 Anthropic API 和 OpenAI 兼容接口，可自由切换 Claude、DeepSeek、Qwen、Kimi 等多种大模型。
- **流式输出与思考过程**：支持模型的流式文本输出，并且适配了如 Qwen 等模型的推理思考过程（`reasoning_content`）实时展示。
- **Tool Use (工具调用)**：
  - `BashTool`：执行系统终端命令（支持 npm、git、文件操作等）。
  - `FileReadTool`：读取本地文件，提供上下文。
  - `FileWriteTool`：覆盖写入本地文件，实现代码自动修改。
- **Agent 循环**：实现了类似原始 CC 的消息事件循环，支持多次连续工具调用直到任务完成。
- **详尽中文注释**：源码中包含大量准确详细的中文注释，非常适合作为学习 Agent 开发的入门参考。

## � 文档指南

为了帮助开发者更深入地理解本项目的架构设计与核心实现，我们提供了详细的文档。你可以在 [`docs`](./docs) 目录下找到这些内容：

- [00. 项目大纲](./docs/00-outline.md)
- [01. 核心架构](./docs/01-architecture.md)
- [02. 查询引擎 (Query Engine)](./docs/02-query-engine.md)
- [03. 工具系统 (Tool System)](./docs/03-tool-system.md)
- [04. 记忆与上下文 (Memory & Context)](./docs/04-memory-and-context.md)
- [05. MCP与插件系统 (MCP & Plugins)](./docs/05-mcp-and-plugins.md)
- [06. UI 与 Ink (UI & Ink)](./docs/06-ui-and-ink.md)
- [07. 优化与部署 (Optimization & Deployment)](./docs/07-optimization-and-deployment.md)
- [08. 电子宠物彩蛋 (Buddy Easter Egg)](./docs/08-buddy-easter-egg.md)
- [09. 安全与沙盒 (Security & Sandbox)](./docs/09-security-and-sandbox.md)
- [10. 终极 Agent 能力](./docs/10-ultimate-agent-capabilities.md)

## �📁 语言实现版本

本项目采用多语言架构，计划使用多种编程语言实现相同的功能。目前已包含：

- [TypeScript 实现](./typescript) (✅ 已完成)
- *Python 实现 (⏳ 计划中)*
- *Go 实现 (⏳ 计划中)*
- *Rust 实现 (⏳ 计划中)*

## 🚀 快速开始

以下是以 **TypeScript 版本** 为例的操作步骤：

### 1. 进入对应语言目录并安装依赖
```bash
cd typescript
pnpm install
```

### 2. 配置环境变量
在 `typescript` 目录下创建一个 `.env` 文件。你可以复制配置模板并修改：
```bash
cp .env.example .env
```
在 `.env` 文件中配置你选择的大模型（支持 OpenAI 兼容格式或 Anthropic）。例如配置 Qwen：

```env
# 选项: 'anthropic' 或 'openai'
PROVIDER=openai

# 如果使用 OpenAI 兼容接口（如 Qwen, DeepSeek, Kimi 等）
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen3.6-plus
```

### 3. 启动应用
你可以直接使用 `ts-node` 在开发模式下运行：
```bash
pnpm run dev
```
或者，先编译然后再运行：
```bash
pnpm run build
pnpm start
```

## 💻 交互示例

启动程序后，你可以直接在终端中输入自然语言指令。例如：
- "帮我创建一个 hello.js 文件，内容是输出 Hello World。" （未指明目录，默认输出到 mini-cc/test_file）
- "列出当前目录下有哪些文件？"
- "读取 package.json，并告诉我项目名称是什么。"

程序会思考并调用相应的工具自动执行你的需求，最终将结果反馈给你。

## 📄 开源协议

本项目基于 [MIT 协议](./LICENSE) 开源，欢迎自由学习、修改和分发。
