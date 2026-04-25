<div align="center">
  <h1>mini-cc</h1>
  <p>一个极简架构的轻量级 AI 编程智能体，剖析、学习和复刻大厂 Agent 架构的开源教学项目。</p>
  
  <p>
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
    <img src="https://img.shields.io/badge/typescript-5.x-blue" alt="TypeScript">
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node">
  </p>
</div>

由于部分商标保护和合规原因，本项目已更名为 **mini-cc**。它旨在用最简单的代码复刻原版 Claude Code CLI 的核心交互、工具调用机制（Tool Use）、沙盒执行与记忆压缩策略。它支持多模型提供商（Anthropic、OpenAI 以及所有兼容 OpenAI 接口的模型如 Qwen、DeepSeek 等），提供读取文件、写入文件和执行 Bash 终端命令的能力。

通过本项目，你可以学习到 Agent 的核心事件循环、工具定义与分发、多模型的适配，以及如何构建一个炫酷的终端 React UI。

## 🌟 核心特性

本项目目前已在 TypeScript 版本中实现了以下核心特性：

- **多模型支持**：支持 Anthropic API 和 OpenAI 兼容接口，可自由切换 Claude、DeepSeek、Qwen、Kimi 等多种大模型。
- **纯函数式 Agent 循环**：清晰展示大模型如何自主调用工具、思考（CoT）和反馈。支持如 Qwen 等模型的推理思考过程（`reasoning_content`）实时展示。
- **Tool Use (工具调用)**：
  - `BashTool`：执行系统终端命令（支持 npm、git、文件操作等）。
  - `FileReadTool`：读取本地文件，提供上下文。
  - `FileWriteTool`：覆盖写入本地文件，实现代码自动修改。
- **安全的 Bash 沙盒**：实现了命令执行包装器的剥离与高危破坏性命令（如 `rm -rf /`）拦截。
- **.ai_memory 记忆引擎**：实现两步法则的上下文记录和过长 Token 截断机制，防止 Token 爆炸。
- **MCP 插件集成**：支持模型上下文协议，实现工具的无缝扩充（例如安全执行网络请求与系统操作）。
- **炫酷的终端 UI**：基于 React (Ink) 构建，拥有虚拟滚动和流畅的流式打字机输出效果。
- **趣味彩蛋**：内置 `/buddy` 伴侣系统（基于 Mulberry32 与反作弊算法）和 `/voice` 模拟语音对讲。

## 🛠️ 架构图解

### Agent 循环与工具调用 (Tool Use)
系统通过 `AgentTool` (Agent 分身术) 和基于 stdio 的进程隔离通信，把复杂的命令执行下发给不同子工具。主控节点持续将结果追加进 `messages`，一旦遇到 `tool_calls` 即打断当前生成，进入异步工具调用，结果产生后再唤醒生成，形成自动循环。

### .ai_memory 记忆与上下文压缩
为了防止 Token 爆炸，程序维护了一套本地的文件系统记忆：
1. **压缩层 (`compact.ts`)**：自动剥离图片和超长文档。
2. **防爆舱 (`truncateHeadForPTLRetry`)**：如果 API 报出 `Prompt Too Long`，强制削减最老的历史。
3. **两步法则**：在工作区生成 `.ai_memory`，记录核心的约定与项目架构级长效记忆。

### MCP (Model Context Protocol) 插件架构
大模型调用工具的请求，会通过 `MCPTool.ts` 进行透明代理，转发至远程或本地的 MCP 插件服务，实现跨进程和跨应用的安全隔离执行。

## 📚 文档指南

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

## 📁 语言实现版本

本项目采用多语言架构，计划使用多种编程语言实现相同的功能。目前已包含：

- [TypeScript 实现](./typescript) (✅ 已完成)
- *Python 实现 (⏳ 计划中)*
- *Go 实现 (⏳ 计划中)*
- *Rust 实现 (⏳ 计划中)*

## 🚀 快速开始 (TypeScript 版本)

### 方法一：全局安装 (推荐)

```bash
npm install -g mini-cc
mini-cc
```

### 方法二：源码构建 & Bun 二进制打包

如果你希望自己修改代码，或者将其打包为一个无需 Node 环境即可运行的单一二进制文件：

```bash
git clone https://github.com/your-username/mini-cc.git
cd mini-cc/typescript
npm install
npm run build

# 运行
npm start
# 或者构建独立二进制可执行文件（需安装 Bun）
bun build --compile src/main.ts --outfile mini-cc
```

### 配置 API Key

初次运行 `mini-cc`，如果未检测到 API Key，程序会自动弹出交互式配置引导，帮助你一键设置并保存在全局目录 `~/.mini-cc/config.json` 中。

```text
⚠️ 未检测到 OpenAI 兼容接口的 API Key。
? 欢迎使用！请粘贴您的 OPENAI_API_KEY: **********
? 请输入您想使用的模型名称 (默认: qwen3.6-plus): qwen3.6-plus
? 如果您使用的是兼容接口，请输入 BASE_URL (可选): https://dashscope.aliyuncs.com/compatible-mode/v1
✓ 配置已保存至全局目录 (~/.mini-cc/config.json)
```

你也可以通过命令行手动配置：
```bash
mini-cc config set OPENAI_API_KEY sk-xxxxx
mini-cc config set MODEL_NAME qwen-max
```

## 💻 交互示例

启动程序后，你可以直接在终端中输入自然语言指令。例如：
- "帮我创建一个 hello.js 文件，内容是输出 Hello World。" 
- "列出当前目录下有哪些文件？"
- "读取 package.json，并告诉我项目名称是什么。"

程序会思考并调用相应的工具自动执行你的需求，最终将结果反馈给你。

## 🎮 趣味指令

在聊天输入框内输入以下指令可触发彩蛋：
- `/clear`：清空当前会话上下文。
- `/buddy`：召唤基于系统种子生成的数字伴侣（小黄鸭/小章鱼），拥有隐藏稀有度属性。
- `/voice`：进入模拟语音对讲模式（按住空格说话）。

## 🛡️ 高级架构演示 (Mocks)

部分在官方版里极为底层的能力（如跨平台截屏、接管 Chrome 浏览器扩展抓取 AppData 数据、基于 CCR 云端集群推演）为了保证本项目轻量跨平台，在 `src/architecture-mocks` 中作为**架构演练**展示，暂不含实体功能（详见该目录声明）。

## 📄 开源协议

本项目基于 [MIT 协议](./LICENSE) 开源，欢迎自由学习、修改和分发。