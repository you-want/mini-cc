# mini-cc

这是一个轻量级的 AI 编程助手实现，灵感来源于业界优秀的 AI 代码助手。它通过 TypeScript 和面向对象设计，提供了强大的本地代码操作和终端执行能力。

本实现完全基于本地代码重写，并且移除了特定厂商的命名和敏感商标，定位于通用的 `AI 编程助手 Agent` 核心框架。

## 核心特性

- **多模型支持**：支持 Anthropic API 和 OpenAI 兼容接口，可自由切换 Claude、DeepSeek、Qwen、Kimi 等多种大模型。
- **流式输出与思考过程**：支持模型的流式文本输出，并且适配了如 Qwen 等模型的推理思考过程（`reasoning_content`）实时展示。
- **Tool Use (工具调用)**：
  - `BashTool`：执行系统终端命令（支持 npm、git、文件操作等）。
  - `FileReadTool`：读取本地文件，提供上下文。
  - `FileWriteTool`：覆盖写入本地文件，实现代码自动修改。
- **Agent 循环**：实现了类似原始 CC 的消息事件循环，支持多次连续工具调用直到任务完成。
- **详尽中文注释**：源码中包含大量准确详细的中文注释，非常适合作为学习 Agent 开发的入门参考。

## 安装与使用

1. **安装依赖**：
   ```bash
   pnpm install
   ```

2. **配置环境变量**：
   在项目根目录下创建一个 `.env` 文件。该项目支持 **Anthropic** 和 **OpenAI 兼容** 的接口（如 DeepSeek, 通义千问, Qwen, Kimi 等），用户可以自己随意选择模型。

   配置示例：
   ```env
   # 选项: 'anthropic' 或 'openai'
   PROVIDER=openai

   # 如果使用 OpenAI 兼容接口（如 Qwen, DeepSeek, Kimi 等）
   OPENAI_API_KEY=your_api_key_here
   OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
   MODEL_NAME=qwen3.6-plus

   # ==========================================
   # 如果使用 Anthropic
   # ==========================================
   # PROVIDER=anthropic
   # ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxx
   # MODEL_NAME=claude-3-7-sonnet-20250219
   ```

3. **编译代码**（可选，如果您想直接运行编译后的 JS）：
   ```bash
   pnpm run build
   ```

4. **启动 Mini CC**：
   可以直接使用 `ts-node` 在开发模式下运行：
   ```bash
   pnpm run dev
   ```
   或运行编译后的代码：
   ```bash
   pnpm start
   ```

## 交互示例

启动程序后，您可以在终端中直接输入指令，例如：
- "帮我创建一个 hello.js 文件，内容是输出 Hello World。" （未指明目录，默认输出到 mini-cc/test_file）
- "列出当前目录下有哪些文件？"
- "读取 package.json，并告诉我项目名称是什么。"

程序会通过调用工具自动执行您的需求，并最终将结果反馈给您。

## 源码结构参考

本项目的源码结构参考了原始的 `claude-code/src` 目录：
- `src/index.ts`：CLI 交互界面入口。
- `src/core/Agent.ts`：管理对话上下文和工具分发的核心大脑。
- `src/tools/`：定义了各种具体的操作工具。

---
*本项目完全开源，旨在为 AI Agent 开发者提供轻量级学习范例。*
