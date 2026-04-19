# 🚀 mini-cc：打造你的专属轻量级 AI 编程智能体

你是否想过拥有一个像 Claude Code 一样强大的命令行 AI 编程助手？  

你是否想深入了解 Agent（智能体）背后的核心事件循环与工具调用（Tool Use）原理？

**mini-cc** 就是为你准备的开源解决方案！

这是一个完全使用 TypeScript 编写的轻量级 AI 编程 Agent 核心框架。

它摒弃了复杂的历史包袱，采用纯粹的**函数式编程（Functional Programming）**范式，将大模型、工具系统、记忆上下文与事件循环精简到了极致。

---

## ✨ 核心能力与亮点

### 1. 🧠 多模型兼容与无缝切换

- **双擎驱动**：原生支持 Anthropic API（如 Claude 3.5 Sonnet/Opus）以及基于 OpenAI 标准的各类大模型接口。
- **开源/国产模型适配**：完美适配 Qwen（通义千问）、DeepSeek、Kimi 等热门模型。只需修改 `.env` 环境变量，即可一键切换底层大脑。

### 2. 💡 沉浸式的“思考”体验（深度适配推理模型）

- **流式输出**：支持极速的流式文本渲染，告别漫长的等待。
- **思维链（CoT）可视化**：深度适配如 Qwen-Max / DeepSeek-R1 等带有 `reasoning_content` 的模型。
- AI 的推导和思考过程在终端中实时呈现，让你清晰看到它解决问题的每一步逻辑。

### 3. 🛠️ 强大的自主行动力（Tool Use 系统）

- **BashTool**：赋予 AI 终端执行权限，它可以帮你自动执行 `npm install`、`git commit`、运行测试脚本等。安全沙盒机制保障高危命令被有效拦截。
- **FileReadTool**：赋予 AI 读取本地代码库的权限，支持突破长度限制的智能截断。
- **FileWriteTool**：赋予 AI 修改、覆盖代码的能力，支持自动补全缺失的目录层级。你只需提出需求，代码修改全自动完成。

### 4. 🔁 永不言弃的 Agent 循环

- 实现了专业的 Tool Use 事件循环（Agent Loop）。
- 当任务复杂时，AI 会连续多次调用工具（如：先 `FileReadTool` 看代码 -> 再 `BashTool` 运行测试 -> 最后 `FileWriteTool` 修复 Bug），直到彻底解决你的问题。

### 5. 🛡️ 纯粹的函数式架构

- 全面拥抱函数式编程（FP）思想，零 `class` 依赖。闭包状态管理使得核心更加安全、高效且易于测试与扩展。
- 附带详尽的中文注释，是学习和二次开发 Agent 的绝佳教科书。

---

## 🎮 交互效果展示：一句话生成五子棋游戏！

在终端中启动 `mini-cc` 后，你只需一句自然语言指令，它就能化身为全栈开发工程师，从构思到编码，一气呵成。

以下是真实交互实录（还原了利用 `test_file/gomoku` 编写五子棋的过程）：

```text
mini-cc> 帮我写一个网页版的五子棋游戏，放在 test_file/gomoku 目录下。页面要好看，带黑白棋提示。

[Agent] 已收到指令，正在思考中...

==================== 思考过程 ====================
1. 用户需要一个五子棋游戏，包含 HTML/CSS/JS。
2. 目标目录是相对于当前工作目录的 test_file/gomoku。
3. 需要提供漂亮的 UI 界面，以及当前轮到哪一方下棋的提示（如：黑棋先行）。
4. 我将使用 FileWriteTool 分别创建 index.html、style.css 和 script.js。
5. 棋盘可以使用 Canvas 或者 DOM 元素网格来实现，为了简单直观，我这里使用 DOM 网格结合 CSS 样式来实现。

==================== 模型回复 ====================
好的，我这就为您创建带有精美 UI 和状态提示的五子棋小游戏。

▶ [Agent] 正在调用工具: FileWriteTool ...
[FileWriteTool] 正在写入文件: /xxxx/mini-cc/test_file/gomoku/index.html
✔ [Agent] 工具 FileWriteTool 执行完毕。

▶ [Agent] 正在调用工具: FileWriteTool ...
[FileWriteTool] 正在写入文件: /xxxx/mini-cc/test_file/gomoku/style.css
✔ [Agent] 工具 FileWriteTool 执行完毕。

▶ [Agent] 正在调用工具: FileWriteTool ...
[FileWriteTool] 正在写入文件: /xxxx/mini-cc/test_file/gomoku/script.js
✔ [Agent] 工具 FileWriteTool 执行完毕。

==================== 思考过程 ====================
文件均已创建成功。

==================== 完整回复 ====================
五子棋小游戏已经为您创建完成！

我为您生成了以下文件：
1. `index.html`: 包含游戏棋盘和状态提示栏（`<div class="status" id="status">黑棋先行</div>`）。
2. `style.css`: 提供了木质棋盘配色和黑白棋子的立体阴影效果。
3. `script.js`: 实现了 15x15 的棋盘逻辑、落子交替规则以及横、竖、斜向的五子连珠胜负判断。

您可以直接用浏览器打开 `test_file/gomoku/index.html` 体验游戏！
```

只需几秒钟，一个带有 `<div class="status" id="status">黑棋先行</div>` 状态提示的五子棋网页便自动生成并落盘！

---

## 🚀 立即开始你的 Agent 之旅

无论你是想打造自己的效率工具，还是想探索大模型在工程领域的无限潜能，**mini-cc** 都是一个绝佳的起点。

👉 **查看源码与文档**：[mini-cc GitHub Repository](https://github.com/you-want/mini-cc)  来个 Star ✨。
👉 **深入架构设计**：请阅读我们的 [📚 文档指南](./docs/00-outline.md)
