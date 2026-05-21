# Mini-CC

> 一个以“可读、可扩展、可上线”为目标的 CLI 编程智能体项目：复刻 Claude Code 的核心 Tool-Use 交互，并提供可插拔工具生态与 MCP 插件扩展。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

`mini-cc` 是一个生产可用的 CLI Agent 雏形：支持 OpenAI 兼容接口与 Anthropic Claude，内置终端 UI、权限系统、可中断请求、工具超时保护，并支持通过 MCP 动态加载外部工具。

## ✨ 核心特性

- **Tool-Use 主循环**：模型可自主调用工具（读/写/编辑/搜索/网络/任务等），并在工具结果回传后继续推理。
- **生产级安全护栏**：默认权限策略更安全（敏感工具需显式 `/allow`），支持 `HARD_DENY_TOOLS` 强制禁用。
- **可中断与超时兜底**：`Esc` / `Ctrl+C` 中断当前请求；工具执行超时防卡死（默认 120s，BashTool 300s）。
- **多 Provider + 热切换**：`/provider` 支持会话级/全局级切换，无需重启。
- **技能系统（Skills）**：内置 remember/simplify/verify；支持用户自定义技能 JSON；激活技能自动注入主循环。
- **MCP 动态工具加载**：启动时连接 MCP servers，`listTools` 拉取远端工具并注册为本地 Tool。
- **终端 UI（Ink/React）**：消息虚拟列表、流式打字机输出、进度条组件。

## 📚 文档入口（发布用“四件套”）

- README：你正在阅读的文档（功能/能力/配置/命令）
- QUICK_TEST：快速冒烟测试清单 [QUICK_TEST.md](./QUICK_TEST.md)
- MANUAL_TEST_GUIDE：完整手动测试流程 [MANUAL_TEST_GUIDE.md](./MANUAL_TEST_GUIDE.md)
- CHANGELOG：版本变更记录 [CHANGELOG.md](./CHANGELOG.md)

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

**配置向导示例（OpenAI 兼容接口）**：
```text
? 欢迎使用！请粘贴您的 OPENAI_API_KEY: **********
? 请输入您想使用的模型名称 (默认: qwen3.6-plus): qwen3.6-plus
? 如果您使用的是兼容接口 (如 DeepSeek/Qwen)，请输入 BASE_URL (可选):
✓ 配置已保存
```

你也可以随时通过命令行修改配置：
```bash
mini-cc config set OPENAI_API_KEY=sk-xxxxx
mini-cc config set OPENAI_BASE_URL=https://api.deepseek.com/v1
mini-cc config set MODEL_NAME=deepseek-coder
```

配置保存位置：`~/.mini-cc/config.json`

## 🔐 权限与安全（生产默认）

- 默认策略会自动放行“只读/低风险工具”，并拒绝敏感工具（如 BashTool / FileWriteTool / FileEditTool / AgentTool / NotebookEdit）。
- 在会话内显式授权敏感工具：
  - `/allow BashTool`
  - `/allow FileWriteTool`
  - `/allow FileEditTool`
  - `/allow AgentTool`
  - `/allow NotebookEdit`
- 查看当前授权状态：`/permissions`
- 强制禁止（不可被 /allow 覆盖）：
  - 环境变量：`HARD_DENY_TOOLS=BashTool,FileWriteTool`
  - 或配置：`mini-cc config set HARD_DENY_TOOLS=BashTool,FileWriteTool`

## ⌨️ 常用命令

- `/help`：命令帮助
- `/provider`：查看 provider 列表与当前配置
- `/provider openai` / `/provider anthropic`：切换 provider（全局）
- `/provider openai -s`：仅当前会话切换
- `/skill` / `/skill search <q>` / `/skill <name>`：技能列表/搜索/激活
- `/allow <ToolName>` / `/deny <ToolName>` / `/permissions`：权限预审批
- `/clear`：清空当前会话上下文
- `Esc` / `Ctrl+C`：中断当前请求（生成中）

## 🛠️ 工具生态

mini-cc 提供了完整的工具集，让 AI 能够自主完成各种开发任务：

### 文件操作工具
- **FileReadTool**: 读取文件内容，支持大文件自动截断
- **FileWriteTool**: 创建或覆盖文件
- **FileEditTool**: 智能编辑，基于精确字符串替换

### 文件搜索工具
- **GlobTool**: 使用 glob 模式搜索文件（如 `**/*.ts`）
- **GrepTool**: 内容搜索，支持正则表达式和上下文显示

### 系统操作工具
- **BashTool**: 安全的命令执行，带破坏性命令检测
- **GitStatusTool**: Git 仓库状态查询

### 网络工具
- **WebFetchTool**: HTTP/HTTPS 请求，支持 GET/POST
- **WebSearchTool**: 网络搜索（DuckDuckGo HTML）

### 项目管理工具
- **TodoWrite**: 会话级 Todo 清单
- **TaskCreate / TaskList**: 任务创建与列表（存储于会话 state）

### 高级工具
- **AgentTool**: Agent 分身术（当前偏演示，生产级并行/共享记忆仍在推进）

### 代码智能与 Notebook
- **LSPTool**: 符号/引用/悬停信息（简化实现）
- **NotebookEdit**: .ipynb 单元格读/增/改/删

详细使用说明请查看 [工具使用指南](./docs/tools-guide.md)。

## 🔌 MCP 插件（动态工具加载）

mini-cc 会在启动时读取 MCP 配置并连接服务器，将远端工具注册进本地工具列表：

- 项目级：`<project>/.mini-cc/settings.json`
- 用户级：`~/.mini-cc/settings.json`
- 插件目录：`<project>/.mini-cc/plugins`（用于放置插件配置/清单）

（截图占位：MCP tools 在 /permissions 或日志中展示的效果）

## 🧩 自定义技能（Skills）

你可以把技能定义为 JSON 放到以下目录之一：

- 用户级：`~/.mini-cc/skills/*.json`
- 项目级：`<project>/.mini-cc/skills/*.json`

（截图占位：/skill 列表与激活后的提示）

## 🏗️ 架构概览

### Agent 循环与工具调用 (Tool Use)
系统通过 `AgentTool` (Agent 分身术) 和基于 stdio 的进程隔离通信，把复杂的命令执行下发给不同子工具。主控节点持续将结果追加进 `messages`，一旦遇到 `tool_calls` 即打断当前生成，进入异步工具调用，结果产生后再唤醒生成，形成自动循环。

### .ai_memory 记忆与上下文压缩
为了防止 Token 爆炸，程序维护了一套本地的文件系统记忆：
1. **压缩层 (`compact.ts`)**：自动剥离图片和超长文档。
2. **防爆舱 (`truncateHeadForPTLRetry`)**：如果 API 报出 `Prompt Too Long`，强制削减最老的历史。
3. **两步法则**：在工作区生成 `.ai_memory`，记录核心的约定与项目架构级长效记忆。

### MCP (Model Context Protocol) 插件架构
大模型调用工具的请求，会通过 `MCPTool.ts` 进行透明代理，转发至远程或本地的 MCP 插件服务，实现跨进程和跨应用的安全隔离执行。

## 🖼️ 截图占位

- （截图占位：启动欢迎页 / WelcomeBanner）
- （截图占位：一次典型 Tool-Use 工作流：read → grep → edit → test）
- （截图占位：权限拒绝提示 + /allow 授权流程）
- （截图占位：/provider 热切换前后）
- （截图占位：MCP 插件工具列表）

## 🛡️ 高级架构演示 (Mocks)

部分在官方版里极为底层的能力（如跨平台截屏、接管 Chrome 浏览器扩展抓取 AppData 数据、基于 CCR 云端集群推演）为了保证本项目轻量跨平台，在 `src/architecture-mocks` 中作为**架构演练**展示，暂不含实体功能（详见该目录声明）。

---
**License**: MIT
