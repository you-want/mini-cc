# 🦀 mini-cc (Rust Edition)

这是 `mini-cc` 智能体的 **Rust 语言实现版本**。

基于 Rust 的“所有权”、“内存安全”以及“无畏并发”理念，本项目不仅提供了原生二进制级别的高性能执行效率，也通过 `tokio`、`reqwest` 异步框架实现了极致的流式流转与事件响应。

在实现上，Rust 版本延续了项目“极简”、“纯函数式架构”的基因。

我们自己手动实现了 SSE (Server-Sent Events) 的流式解析，从而深度接管大模型的 Tool Use 与 Reasoning Content 推理。

## ✨ 已实现功能

1. **强安全与零开销抽象**：避免了 `class` 以及繁重的面向对象系统，状态安全由生命周期与借用检查器严格保证。
2. **多模型 SSE 流式输出**：通过 `eventsource-stream` 解析大模型的打字机流式响应，包括思维链。
3. **Agent 核心闭环 (Tool Use)**：
   - `BashTool`：利用 `std::process::Command` 高效并安全地执行外壳命令。
   - `FileReadTool`：借用 `std::fs` 实现超大文件自动行数截断和读取。
   - `FileWriteTool`：使用 `std::path::Path` 和 `create_dir_all` 安全地自动补全文件目录及内容覆盖。
4. **完整多轮决策循环**：当模型判断需要继续收集信息时，循环不间断自动调用工具并返回执行结果给模型，直至任务圆满解决。

## 🚀 使用步骤

### 1. 环境准备

确保你的系统已安装 **Rust 1.70+**（推荐使用 `rustup` 进行安装及管理工具链）。

### 2. 编译项目

进入项目目录并使用 Cargo 构建依赖包：

```bash
cd mini-cc/rust
cargo check
```

### 3. 配置环境变量

在 `mini-cc/rust` 目录下创建一个 `.env` 文件，并填入以下内容：

```env
# 必填：你的大模型 API Key
OPENAI_API_KEY="sk-xxxxxx"

# 选填：大模型接口的 Base URL（如果不填，默认为 OpenAI 官方地址）
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# 选填：你想使用的模型名称（默认为 qwen3.6-plus）
MODEL_NAME="qwen-max"
```

### 4. 启动 Agent

通过 Cargo 直接运行：

```bash
cargo run
```

等待编译（首次编译可能需要下载 `tokio`、`reqwest` 等宏大依赖），启动后将显示 `mini-cc>`。现在，你可以尝试向它输入命令让它自动为你读写代码了！
