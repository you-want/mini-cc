# mini-cc (Python 版本)

`you-want-mini-cc` 是轻量级 AI 结对编程智能体 `@you-want/mini-cc` 的纯 Python 移植版本。
它由大语言模型（如 Claude 3.5 Sonnet 和 Qwen 等）驱动，旨在提供无缝、流畅的终端结对编程体验。

## 安装

```bash
pip install you-want-mini-cc
```

## 快速开始

在运行之前，你需要配置你的大模型 API 凭证。本智能体同时支持兼容 OpenAI 格式的 API 以及 Anthropic 官方 API。

1. 在你的工作目录（或用户主目录 `~/.mini-cc-env`）创建一个 `.env` 文件：
```env
# 如果使用 OpenAI 兼容模型 (例如: Qwen, DeepSeek 等)
PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.your-provider.com/v1
MODEL_NAME=qwen3.6-plus

# 或者使用 Anthropic 模型
PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here
MODEL_NAME=claude-3-7-sonnet-20250219
```

2. 在终端中运行 CLI：
```bash
mini-cc
```

## 核心特性
- **纯 Python 与 Asyncio**：完全基于异步架构构建，提供极速的非阻塞 I/O 体验。
- **Agent 循环闭环**：内置 `BashTool` (终端执行)、`FileReadTool` (文件读取) 和 `FileWriteTool` (文件写入)，实现代码自主编写与运行。
- **安全沙盒机制**：内置 Bash 命令包装器智能剥离逻辑，并强制拦截高危破坏性系统命令（如 `rm -rf /`）。
- **高保真终端 UI**：支持动态 ANSI 渲染的欢迎横幅、流式打字机输出与思维链（CoT）展示。
- **MCP 插件支持**：通过 `stdio` 与模型上下文协议（Model Context Protocol）插件无缝对接，轻松扩展能力边界。

## 🛠️ 架构图解

### Agent 循环与工具调用 (Tool Use)
系统通过 `AgentTool` (Agent 分身术) 和基于 stdio 的进程隔离通信，把复杂的命令执行下发给不同子工具。主控节点持续将结果追加进 `messages`，一旦遇到 `tool_calls` 即打断当前生成，进入异步工具调用，结果产生后再唤醒生成，形成自动循环。

### .ai_memory 记忆与上下文压缩
为了防止 Token 爆炸，程序维护了一套本地的文件系统记忆：
1. **压缩层 (`memory.py`)**：自动剥离图片和截断超长文档。
2. **防爆舱 (`truncateHeadForPTLRetry`)**：如果 API 报出 `Prompt Too Long`，强制削减最老的历史对话。
3. **两步法则**：在工作区生成 `.ai_memory`，持久化记录核心的约定与项目架构级长效记忆。

### MCP (Model Context Protocol) 插件架构
大模型调用工具的请求，会通过 `mcp_tool.py` 进行透明代理，转发至远程或本地的 MCP 插件服务，实现跨进程的安全隔离执行。

## 使用方法
在进入 `mini-cc>` 提示符后，直接用自然语言要求智能体为你执行任务即可，例如：
> "读取 src/main.py 文件，并为所有函数添加中文注释。"
> "运行测试用例，并修复所有报错的代码。"

## 🎮 趣味指令
在聊天输入框内输入以下指令可触发彩蛋：
- `/clear`：清空当前会话的上下文记忆。
- `/buddy`：召唤基于系统随机种子生成的数字伴侣（如小黄鸭/小章鱼），拥有隐藏稀有度属性。

## 📚 文档指南
为了帮助开发者更深入地理解本项目的架构设计与核心实现，请参阅主仓库根目录 [`docs`](../docs) 文件夹下的详细教学文档。

## 开源协议
MIT License