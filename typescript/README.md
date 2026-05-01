# Mini-CC

> 一个极简架构的轻量级 AI 编程智能体，剖析、学习和复刻大厂 Agent 架构的开源教学项目。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

`mini-cc` 旨在用最简单的代码复刻原版 Claude Code CLI 的核心交互、工具调用机制（Tool Use）、沙盒执行与记忆压缩策略。它内置了终端 React UI 渲染、MCP 插件生态支持，并提供多语言版本（当前为 TypeScript 版）。

## ✨ 核心特性

- **纯函数式 Agent 循环**：清晰展示大模型如何自主调用工具、思考（CoT）和反馈。
- **安全的 Bash 沙盒**：实现了命令执行包装器的剥离与高危破坏性命令（如 `rm -rf /`）拦截。
- **.ai_memory 记忆引擎**：实现两步法则的上下文记录和过长 Token 截断机制。
- **MCP 插件集成**：支持模型上下文协议，实现工具的无缝扩充（例如安全执行网络请求与系统操作）。
- **炫酷的终端 UI**：基于 React (Ink) 构建，拥有虚拟滚动和流畅的流式打字机输出效果。
- **趣味彩蛋**：内置 `/buddy` 伴侣系统（基于 Mulberry32 与反作弊算法）和 `/voice` 模拟语音对讲。

## 📦 安装指南

你可以通过 npm 全局安装，或者直接使用 npx 免安装运行。

### 方法一：npx 免安装直接运行 (最简单)

无需克隆代码，直接在你的任何项目目录下执行：

```bash
npx @you-want/mini-cc
```

### 方法二：全局安装

```bash
npm install -g @you-want/mini-cc
```
安装后，在任意终端输入 `mini-cc` 即可唤醒 AI 助手。

### 方法三：源码构建

如果你希望自己修改代码：

```bash
git clone https://github.com/BiggerRain/mini-cc.git
cd mini-cc/typescript
pnpm install
pnpm run build

# 测试全局链接
npm link
mini-cc
```

## 🚀 快速开始

初次运行 `mini-cc`，程序会自动引导你配置 API Key。我们默认支持 **OpenAI 格式的兼容接口**（例如通义千问、DeepSeek 等）。

```bash
mini-cc
```

**配置向导示例**：
```text
? 欢迎使用！请粘贴您的 OPENAI_API_KEY: **********
? 请输入您想使用的模型名称 (默认: qwen-max): qwen-max
? 如果您使用的是兼容接口，请输入 BASE_URL (可选): https://dashscope.aliyuncs.com/compatible-mode/v1
✓ 配置已保存
```

你也可以随时通过命令行修改配置：
```bash
mini-cc config set OPENAI_API_KEY=sk-xxxxx
mini-cc config set BASE_URL=https://api.deepseek.com/v1
mini-cc config set MODEL_NAME=deepseek-coder
```

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

## 🎮 趣味指令

在聊天输入框内输入以下指令可触发彩蛋：
- `/clear`：清空当前会话上下文。
- `/buddy`：召唤基于系统种子生成的数字伴侣（小黄鸭/小章鱼），拥有隐藏稀有度属性。
- `/voice`：进入模拟语音对讲模式（按住空格说话）。

## 🛡️ 高级架构演示 (Mocks)

部分在官方版里极为底层的能力（如跨平台截屏、接管 Chrome 浏览器扩展抓取 AppData 数据、基于 CCR 云端集群推演）为了保证本项目轻量跨平台，在 `src/architecture-mocks` 中作为**架构演练**展示，暂不含实体功能（详见该目录声明）。

---
**License**: MIT
