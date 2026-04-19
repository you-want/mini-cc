# 🐹 mini-cc (Go Edition)

这是 `mini-cc` 智能体的 **Go 语言实现版本**。

作为编译型强类型语言，Go 版本在保持极简、函数式架构的同时，具有极高的启动速度、并发性能以及出色的部署便利性。

本版本完全实现了核心的 Agent 循环、多轮工具调用（Tool Use）以及大模型的流式推理和思维链显示。

## ✨ 已实现功能

1. **高性能与零依赖部署**：编译为单个可执行文件，即可直接在不同环境运行。
2. **多模型无缝切换**：采用 [sashabaranov/go-openai](https://github.com/sashabaranov/go-openai) 标准库，轻松对接各大 OpenAI 兼容模型接口（包含对深度推理 `reasoning_content` 的支持）。
3. **完整工具链 (Tool Use)**：
   - `BashTool`：利用 Go 的 `os/exec` 原生调用系统命令行，支持安全拦截。
   - `FileReadTool`：支持读取代码及配置文件，超长文件内容自动截断防止 token 爆炸。
   - `FileWriteTool`：使用原生 `os.MkdirAll` 递归创建目录并直接覆写文件。
4. **多轮 Agent 思考闭环**：能够在一轮对话中连续多次触发工具执行。

## 🚀 使用步骤

### 1. 环境准备

确保你的系统已安装 **Go 1.20+** 版本。

### 2. 获取依赖包

进入项目目录并下载依赖：

```bash
cd mini-cc/go
go mod tidy
```

### 3. 配置环境变量

在 `mini-cc/go` 目录下创建一个 `.env` 文件，并填入以下内容：

```env
# 必填：你的大模型 API Key
OPENAI_API_KEY="sk-xxxxxx"

# 选填：大模型接口的 Base URL（如果不填，默认为 OpenAI 官方地址）
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# 选填：你想使用的模型名称（默认为 qwen3.6-plus）
MODEL_NAME="qwen-max"
```

### 4. 运行 Agent

你可以直接运行源代码：

```bash
go run main.go
```

或者编译成独立的二进制文件并运行：

```bash
go build -o minicc main.go
./minicc
```

启动后，出现 `mini-cc>` 提示符即代表环境配置成功。快来尝试给它下达你的编程指令吧！
