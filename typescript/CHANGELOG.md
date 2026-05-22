# 更新日志

本文档记录 mini-cc 项目的所有重要变更。

## [未发布]

### 新增

- N/A

### 改进

- N/A

## [1.1.2] - 2026-05-22

### 新增

- **生产级稳定性能力**
  - 请求可中断：交互 UI 支持 `Esc` / `Ctrl+C` 中断当前请求（Provider/Agent 全链路支持 AbortSignal）
  - 工具超时兜底：工具执行默认 120s 超时（BashTool 300s），避免卡死
- **权限系统增强**
  - 默认策略更安全：敏感工具默认拒绝，需显式预审批
  - 新增命令：`/allow`、`/deny`、`/permissions`
  - 支持 `HARD_DENY_TOOLS` 强制禁止工具（环境变量或全局配置）
- **Provider 热切换**
  - `/provider` 支持会话级与全局级切换，无需重启
  - 切换时会重建 agent/provider 会话上下文，避免混聊
- **技能系统（Skills）**
  - 内置技能：remember / simplify / verify
  - 支持用户自定义技能：`~/.mini-cc/skills/*.json` 与 `<project>/.mini-cc/skills/*.json`
  - 激活技能后会注入到主循环请求中
- **MCP 插件生态（运行时接线）**
  - 启动时自动连接 MCP servers，并将远端 tools 动态注册到本地 Tool 列表
  - AppExit 自动断开连接，减少资源泄漏
- **新增工具集（阶段二）**
  - TodoWrite / TaskCreate / TaskList
  - WebSearchTool（DuckDuckGo HTML）
  - LSPTool（简化实现：symbols/definition/references/hover）
  - NotebookEditTool（.ipynb 读/增/改/删 cell）
  - 支持标准 glob 语法（`*`, `**`, `?`, `[abc]`）

### 改进

- 工具注册机制支持运行时动态注册（为 MCP 动态工具加载提供基础）
- Jest 配置更贴近生产（忽略 dist、自测脚本不再误判为测试用例）

### 初始版本

- 基础 Agent 循环实现
- 核心工具集：
  - BashTool: 命令执行
  - FileReadTool: 文件读取
  - FileWriteTool: 文件写入
  - GitStatusTool: Git 状态查询
  - AgentTool: Agent 分身术
- MCP 协议支持
- 终端 UI（基于 Ink/React）
- 记忆引擎（.ai_memory）
- 配置管理系统
- 多 Provider 支持（OpenAI、Anthropic）
- 彩蛋功能（/buddy、/voice）

---

## 版本说明

本项目遵循[语义化版本](https://semver.org/lang/zh-CN/)规范。

### 版本格式

- **主版本号**：不兼容的 API 修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

### 变更类型

- **新增**：新功能
- **改进**：对现有功能的改进
- **修复**：Bug 修复
- **废弃**：即将移除的功能
- **移除**：已移除的功能
- **安全**：安全相关的修复
- **文档**：文档更新
